import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

function moduleUrl(name) {
  const source = readFileSync(new URL(`../lib/${name}.ts`, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  return "data:text/javascript;base64," + Buffer.from(compiled).toString("base64");
}
const { followedSourcesSummary, hasSourceConfiguration, sourceKind, sourceStatus, needsAction, defaultVisitEveryDays, remindsInToday, visitEvery, visitRhythms } = await import(moduleUrl("source-status"));
const now = new Date("2026-11-05T12:00:00Z");
const daysAgo = days => new Date(now.getTime() - days * 86400000).toISOString();

test("chaque mode de source a son type", () => {
  assert.equal(sourceKind("rss"), "automatic");
  assert.equal(sourceKind("api"), "automatic");
  assert.equal(sourceKind("email"), "automatic");
  assert.equal(sourceKind("web"), "manual");
  assert.equal(sourceKind("research"), "manual");
  assert.equal(sourceKind("manual"), "outreach");
});

test("les sources automatiques suivent leur état et leur santé", () => {
  assert.equal(sourceStatus({ state: "configured" }, "rss", now), "ok");
  assert.equal(sourceStatus({ state: "configured", health: "degraded" }, "rss", now), "error");
  assert.equal(sourceStatus({ state: "paused", health: "degraded" }, "rss", now), "paused");
  assert.equal(sourceStatus({ state: "not_configured" }, "email", now), "to_configure");
  assert.equal(sourceStatus({ state: "action_needed" }, "email", now), "to_configure");
  assert.equal(sourceStatus(undefined, "api", now), "ok");
});

test("les sources à consulter suivent leur rythme de visite", () => {
  assert.equal(sourceStatus(undefined, "web", now), "new");
  assert.equal(sourceStatus({ state: "configured" }, "web", now), "new");
  assert.equal(sourceStatus({ lastVisitedAt: daysAgo(1) }, "web", now), "up_to_date");
  assert.equal(sourceStatus({ lastVisitedAt: daysAgo(3) }, "web", now), "to_visit");
  assert.equal(sourceStatus({ lastVisitedAt: daysAgo(3), visitEveryDays: 7 }, "research", now), "up_to_date");
  assert.equal(sourceStatus({ lastVisitedAt: daysAgo(8), visitEveryDays: 7 }, "research", now), "to_visit");
  // An unreadable date asks for a visit rather than hiding the source.
  assert.equal(sourceStatus({ lastVisitedAt: "pas une date" }, "web", now), "to_visit");
  assert.equal(defaultVisitEveryDays, 2);
});

test("le filtre « action requise » retient les statuts qui demandent un geste", () => {
  assert.deepEqual(["error", "to_configure", "to_visit", "new", "ok", "up_to_date", "paused"].filter(needsAction), ["error", "to_configure", "to_visit", "new"]);
});

test("le rythme de visite accepte trois valeurs, deux jours par défaut", () => {
  assert.deepEqual(visitRhythms.map(([days]) => days), [1, 2, 7]);
  assert.equal(visitEvery(undefined), 2);
  assert.equal(visitEvery({ visitEveryDays: 7 }), 7);
  assert.equal(visitEvery({ visitEveryDays: 3 }), 2);
  assert.equal(visitEvery({ visitEveryDays: "7" }), 2);
});

test("« Aujourd\u2019hui » rappelle une source sauf si le compte l\u2019a coupé", () => {
  assert.equal(remindsInToday(undefined), true);
  assert.equal(remindsInToday({ remindInToday: true }), true);
  assert.equal(remindsInToday({ remindInToday: false }), false);
});

test("le rythme choisi décide quand une source repasse à visiter", () => {
  const visitedThreeDaysAgo = { lastVisitedAt: new Date("2026-11-02T08:00:00Z").toISOString() };
  const now = new Date("2026-11-05T08:00:00Z");
  assert.equal(sourceStatus({ ...visitedThreeDaysAgo, visitEveryDays: 7 }, "manual", now), "up_to_date");
  assert.equal(sourceStatus({ ...visitedThreeDaysAgo, visitEveryDays: 1 }, "manual", now), "to_visit");
});

test("le résumé des sources suivies compte les sources et celles qui demandent une action",()=>{
 assert.equal(followedSourcesSummary(0,0),"");
 assert.equal(followedSourcesSummary(1,0),"1 source · rien à faire");
 assert.equal(followedSourcesSummary(1,1),"1 source · 1 demande une action");
 assert.equal(followedSourcesSummary(8,2),"8 sources · 2 demandent une action");
});


test("la configuration suit les réglages réels, jamais une déclaration ni des notes", () => {
  assert.equal(hasSourceConfiguration(undefined, "email"), false);
  assert.equal(hasSourceConfiguration({ state: "configured" }, "email"), false);
  assert.equal(sourceStatus({ state: "configured" }, "email", now), "to_configure");
  assert.equal(sourceStatus({ linkUrl: "https://example.test/alert" }, "email", now), "ok");
  assert.equal(hasSourceConfiguration({ linkUrl: "ftp://example.test/alert" }, "email"), false);
  assert.equal(hasSourceConfiguration({ linkUrl: "https://user:secret@example.test" }, "email"), false);
  assert.equal(hasSourceConfiguration({ searchLinks: { Produit: { Site: "https://example.test/search" } } }, "web"), true);
  assert.equal(sourceStatus({ latestAlert: { url: "https://app.collective.work/my-personal-space/jobs" } }, "email", now), "ok");
  assert.equal(hasSourceConfiguration(undefined, "rss"), true);
  assert.equal(hasSourceConfiguration(undefined, "api"), true);
  assert.equal(sourceStatus({ linkUrl: "https://example.test", health: "degraded" }, "email", now), "error");
});
