import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

function moduleUrl(name, imports = {}) {
  const source = readFileSync(new URL(`../lib/${name}.ts`, import.meta.url), "utf8");
  let compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  for (const [from, to] of Object.entries(imports)) compiled = compiled.replaceAll(`"${from}"`, JSON.stringify(to));
  return "data:text/javascript;base64," + Buffer.from(compiled).toString("base64");
}
const marketScope = moduleUrl("market-scope");
const locations = moduleUrl("location-criteria", { "./countries": moduleUrl("countries"), "./market-scope": marketScope });
const preferences = moduleUrl("search-preferences", { "./location-criteria": locations, "./search-tracks": moduleUrl("search-tracks") });
const fit = moduleUrl("fit", { "./seniority": moduleUrl("seniority"), "./search-preferences": preferences });
const views = moduleUrl("opportunity-views");
const triage = moduleUrl("triage", { "./application-followup":moduleUrl("application-followup"), "./application-workflow": moduleUrl("application-workflow"), "./opportunity-views": views });
const { isArchived, inOpportunityView, awaitingDecision, lastActivity, archiveReferenceTime, storedReviewDecision, reviewState } = await import(views);
const { groupReserve, reserveGroup } = await import(moduleUrl("reserve", { "./opportunity-views": views }));
const { buildDailyLot, lotDay } = await import(moduleUrl("daily-lot", { "./fit": fit, "./opportunity-views": views, "./triage": triage }));

const now = Date.parse("2026-11-07T10:00:00Z");
const daysAgo = days => new Date(now - days * 864e5).toISOString();
const offer = (id, extra = {}) => ({ id, title: id, company: "Fixture", status: "new", reviewState: "to_review", matchScore: 0, matchTier: "match", flags: [], reasons: [],
  fit: 80, fitLabel: "very_close", fitParts: { role: 30, domain: 20 }, confidence: "high", conditions: "pass", annualSalary: 60000, createdAt: daysAgo(2), updatedAt: daysAgo(2), ...extra });

test("archives : sans publication connue, la date d’ajout sert de référence", () => {
  const old = offer("ancienne", { createdAt: "2026-10-10 08:00:00", updatedAt: "2026-10-10 08:00:00" });
  assert.equal(lastActivity(old), Date.parse("2026-10-10T08:00:00Z"));
  assert.ok(isArchived(old, now));
  assert.ok(!inOpportunityView(old, "to_review", now));
  assert.ok(inOpportunityView(old, "archived", now));
  assert.ok(!inOpportunityView({ ...old, fit: 90 }, "good_matches", now));
  // An edit alone does not rejuvenate an old import without a publication date.
  assert.ok(isArchived({ ...old, updatedAt: daysAgo(0) }, now));
  assert.ok(isArchived({ ...old, publishedAt: "inconnue", updatedAt: daysAgo(0) }, now));
  // 20 days: still to examine. Later counts the same.
  assert.ok(!isArchived(offer("vingt", { createdAt: daysAgo(20), updatedAt: daysAgo(20) }), now));
  assert.ok(isArchived(offer("plus-tard", { reviewState: "later", createdAt: daysAgo(30), updatedAt: daysAgo(22) }), now));
  // Never archived: selected, in the trash, or with an application.
  assert.ok(!isArchived({ ...old, reviewState: "selected" }, now));
  assert.ok(!isArchived({ ...old, deletedAt: daysAgo(1) }, now));
  assert.ok(!isArchived({ ...old, status: "applied" }, now));
  // No date at all: never archived.
  assert.ok(!isArchived(offer("sans-date", { createdAt: undefined, updatedAt: undefined }), now));
});

test("archives : la publication ancienne prime sur une arrivée ou une correction récente", () => {
  const old = offer("publiee", { publishedAt: daysAgo(32), createdAt: daysAgo(0), updatedAt: daysAgo(0) });
  assert.equal(archiveReferenceTime(old), Date.parse(daysAgo(32)));
  assert.ok(isArchived(old, now));
  assert.ok(inOpportunityView(old, "archived", now));
  assert.ok(!awaitingDecision(old, now));
  assert.ok(!inOpportunityView(old, "good_matches", now));
  assert.equal(buildDailyLot([old], null, now).size, 0);
  assert.ok(isArchived({ ...old, publishedAt: daysAgo(21) }, now));
  assert.ok(!isArchived({ ...old, publishedAt: daysAgo(20) }, now));
  assert.ok(!isArchived({ ...old, publishedAt: daysAgo(-2) }, now));
  // A recent publication wins even on an older imported record.
  assert.ok(!isArchived({ ...old, publishedAt: daysAgo(3), createdAt: daysAgo(60) }, now));
  assert.ok(!isArchived({ ...old, reviewState: "selected" }, now));
  assert.ok(!isArchived({ ...old, status: "applied" }, now));
  assert.ok(!isArchived({ ...old, interviews: [{ id: "entretien" }] }, now));
  assert.ok(!isArchived({ ...old, deletedAt: daysAgo(0) }, now));
});

test("archives : remettre à examiner redonne un délai persistant et revient dans le lot", () => {
  const old = offer("publiee", { publishedAt: daysAgo(32) });
  const reopened = { ...old, reviewState: storedReviewDecision("to_review"), updatedAt: daysAgo(0) };
  const afterReload = JSON.parse(JSON.stringify(reopened));
  assert.equal(afterReload.reviewState, "reopened");
  assert.equal(reviewState(afterReload), "to_review");
  assert.ok(!isArchived(afterReload, now));
  assert.ok(inOpportunityView(afterReload, "to_review", now));
  assert.ok(!inOpportunityView(afterReload, "archived", now));
  assert.deepEqual(buildDailyLot([afterReload], null, now).ids, [old.id]);
  assert.ok(!isArchived(afterReload, now + 20 * 864e5));
  assert.ok(isArchived(afterReload, now + 21 * 864e5));
  const later = { ...old, reviewState: storedReviewDecision("later"), updatedAt: daysAgo(0) };
  assert.ok(!isArchived(later, now));
  assert.ok(!awaitingDecision(later, now));
  assert.ok(isArchived(later, now + 21 * 864e5));
});

test("Tri Q1b : « Plus tard » reste dans À examiner mais sort du lot et compte comme trié", () => {
  const later = offer("plus-tard", { reviewState: "later" });
  assert.ok(inOpportunityView(later, "to_review", now));
  assert.ok(!awaitingDecision(later, now));
  const jobs = [offer("a", { fit: 90 }), offer("b", { fit: 85 }), offer("c", { fit: 70, fitLabel: "close" })];
  const first = buildDailyLot(jobs, null, now);
  assert.equal(first.size, 3);
  const next = buildDailyLot(jobs.map(job => job.id === "a" ? { ...job, reviewState: "later" } : job), { day: lotDay(now), ids: first.ids }, now);
  assert.equal(next.triaged, 1); assert.equal(next.remaining.length, 2);
  assert.equal(next.waiting, 1);
});

test("Tri Q1b : groupes exclusifs, dans l'ordre, sans groupe vide", () => {
  const jobs = [
    offer("autre"),
    offer("plus-tard", { reviewState: "later", conditions: "excluded" }),
    offer("hors-conditions", { conditions: "excluded", fitLabel: "far" }),
    offer("loin", { fitLabel: "far", annualSalary: null }),
    offer("sans-salaire", { annualSalary: null, publishedAt: daysAgo(40) }),
    offer("ancienne", { publishedAt: daysAgo(30) }),
    offer("recente", { publishedAt: daysAgo(3) }),
  ];
  assert.deepEqual(jobs.map(job => reserveGroup(job, now)), ["other", "later", "conditions", "far", "pay", "old", "other"]);
  const groups = groupReserve(jobs, now);
  assert.deepEqual(groups.map(group => group.id), ["later", "conditions", "far", "pay", "old", "other"]);
  assert.deepEqual(groups.at(-1).jobs.map(job => job.id), ["autre", "recente"]);
  assert.equal(groups.reduce((total, group) => total + group.jobs.length, 0), jobs.length);
  assert.deepEqual(groupReserve([offer("seule")], now).map(group => group.id), ["other"]);
  // A range alone counts as pay.
  assert.equal(reserveGroup(offer("fourchette", { annualSalary: null, salaryMax: 70000 }), now), "other");
});
