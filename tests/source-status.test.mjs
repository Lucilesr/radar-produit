import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

function moduleUrl(name) {
  const source = readFileSync(new URL(`../lib/${name}.ts`, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  return "data:text/javascript;base64," + Buffer.from(compiled).toString("base64");
}
const { sourceKind, sourceStatus, needsAction, defaultVisitEveryDays } = await import(moduleUrl("source-status"));
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
  assert.equal(sourceStatus(undefined, "api", now), "to_configure");
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
