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
const countries = moduleUrl("countries");
const locations = moduleUrl("location-criteria", { "./countries": countries, "./market-scope": marketScope });
const preferences = moduleUrl("search-preferences", { "./location-criteria": locations, "./search-tracks": moduleUrl("search-tracks") });
const seniority = moduleUrl("seniority");
const fit = moduleUrl("fit", { "./seniority": seniority, "./search-preferences": preferences });
const views = moduleUrl("opportunity-views");
const triage = moduleUrl("triage", { "./application-workflow": moduleUrl("application-workflow"), "./opportunity-views": views });
const { buildDailyLot, pickLot, lotDay, lotHeadline } = await import(moduleUrl("daily-lot", { "./fit": fit, "./opportunity-views": views, "./triage": triage }));
const { triageScore } = await import(triage);

const now = new Date(2026, 10, 7, 9, 30).getTime();
const day = lotDay(now);
const offer = (id, fitValue, extra = {}) => ({ id, title: id, company: "Fixture", status: "new", reviewState: "to_review", matchScore: 0, matchTier: "match", flags: [], reasons: [],
  fit: fitValue, fitLabel: fitValue >= 80 ? "very_close" : fitValue >= 60 ? "close" : "far", fitParts: { role: 30, domain: 20 }, confidence: "high", conditions: "pass", ...extra });
const mystery = (id) => offer(id, 100, { fitLabel: undefined, fitParts: { role: 30 }, confidence: "low" });
const many = (count, prefix = "o", start = 99) => Array.from({ length: count }, (_, index) => offer(`${prefix}${String(index).padStart(2, "0")}`, start - index));

test("Tri Q1 : une offre jugée sur le seul intitulé ne passe pas devant une offre proche", () => {
  assert.equal(triageScore(mystery("m"), now), 55);
  assert.equal(triageScore(offer("p", 76), now), 76);
});

test("Tri Q1 : le lot prend les 20 mieux classées, dont 5 fiches mystère au plus", () => {
  const jobs = [...many(30), ...Array.from({ length: 7 }, (_, index) => mystery(`m${index}`))];
  const lot = pickLot(jobs, now);
  assert.equal(lot.length, 20);
  assert.equal(lot.filter(job => job.id.startsWith("m")).length, 5);
  assert.deepEqual(lot.filter(job => job.id.startsWith("o")).map(job => job.id), many(15).map(job => job.id));
  // Not enough ordinary offers: mystery offers fill the free places.
  assert.equal(pickLot([...many(3), ...Array.from({ length: 7 }, (_, index) => mystery(`m${index}`))], now).length, 10);
});

test("Tri Q1 : le compteur ne fait que descendre, trier n'ajoute pas d'offre au lot", () => {
  const jobs = many(30);
  const first = buildDailyLot(jobs, null, now);
  assert.equal(first.size, 20); assert.equal(first.triaged, 0); assert.equal(first.waiting, 10);
  assert.equal(lotHeadline(first), "20 offres dans votre lot du jour");
  const sorted = jobs.map(job => job.id === "o00" ? { ...job, reviewState: "selected" } : job.id === "o01" ? { ...job, deletedAt: "2026-11-07T08:00:00Z" } : job);
  const next = buildDailyLot(sorted, { day, ids: first.ids }, now);
  assert.equal(next.size, 20); assert.equal(next.triaged, 2); assert.equal(next.remaining.length, 18);
  assert.ok(!next.ids.includes("o20"));
  assert.equal(lotHeadline(next), "Plus que 18 offres");
});

test("Tri Q1 : tant que rien n'est trié, le lot suit les nouvelles offres du matin", () => {
  const first = buildDailyLot(many(20), null, now);
  const morning = [...many(20), offer("nouvelle", 100)];
  const refreshed = buildDailyLot(morning, { day, ids: first.ids }, now);
  assert.ok(refreshed.ids.includes("nouvelle"));
  assert.equal(refreshed.size, 20);
});

test("Tri Q1 : un lot entamé même incomplet ne se remplit pas avec de nouvelles offres", () => {
  const small = many(3);
  const first = buildDailyLot(small, null, now);
  const sorted = [{ ...small[0], reviewState: "selected" }, small[1], small[2], ...many(4, "n", 70)];
  const next = buildDailyLot(sorted, { day, ids: first.ids }, now);
  assert.equal(next.size, 3); assert.equal(next.triaged, 1); assert.equal(next.remaining.length, 2);
});

test("Tri Q1 : nouveau jour, autre compte ou offres disparues : le lot est choisi à nouveau", () => {
  const jobs = many(25);
  assert.equal(buildDailyLot(jobs, { day: "2026-11-06", ids: ["o24"] }, now).ids[0], "o00");
  assert.equal(buildDailyLot(jobs, { day, ids: ["autre-compte-1", "autre-compte-2"] }, now).size, 20);
});

test("Tri Q1 : lot bouclé et libellés", () => {
  const jobs = many(2);
  const first = buildDailyLot(jobs, null, now);
  const done = buildDailyLot(jobs.map(job => ({ ...job, reviewState: "selected" })), { day, ids: first.ids }, now);
  assert.equal(done.remaining.length, 0); assert.equal(done.triaged, 2);
  assert.equal(lotHeadline(done), "Lot du jour bouclé");
  assert.equal(lotHeadline({ remaining: [jobs[0]], triaged: 1, size: 2 }), "Plus qu’une offre");
  assert.equal(lotHeadline({ remaining: [], triaged: 0, size: 0 }), "Aucune offre à trier aujourd’hui");
});

test("Tri Q1d : le premier choix verrouille exactement les identifiants affichés avant la réponse", () => {
 const jobs = many(3);
 const first = buildDailyLot(jobs, null, now);
 const pending = buildDailyLot([...jobs, offer("nouvelle", 100)], {day, ids:first.ids, locked:true}, now);
 assert.deepEqual(pending.ids, first.ids); assert.equal(pending.triaged, 0);
 const confirmed = buildDailyLot([...jobs.map(j => j.id===first.ids[0]?{...j,reviewState:"later"}:j),offer("nouvelle",100)],{day,ids:first.ids,locked:true},now);
 assert.equal(confirmed.size,3);assert.equal(confirmed.triaged,1);assert.equal(confirmed.remaining.length,2);
 assert.equal(lotHeadline(confirmed),"Plus que 2 offres");
});
