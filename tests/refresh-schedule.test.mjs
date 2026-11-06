import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

function moduleUrl(name) {
  const source = readFileSync(new URL(`../lib/${name}.ts`, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  return "data:text/javascript;base64," + Buffer.from(compiled).toString("base64");
}
const { lastRefreshAt, refreshMode, refreshedAgo, shouldRefreshOnOpen } = await import(moduleUrl("refresh-schedule"));
const nbsp = text => text.replace(/[  ]/g, " ");
const now = Date.parse("2026-11-05T12:00:00Z");
const hoursAgo = hours => new Date(now - hours * 3600000).toISOString();

test("la dernière actualisation est la plus récente des sources", () => {
  assert.equal(lastRefreshAt([{ lastSyncedAt: hoursAgo(5) }, {}, { lastSyncedAt: hoursAgo(1) }]), new Date(now - 3600000).toISOString());
  assert.equal(lastRefreshAt([{}, { lastSyncedAt: "jamais" }]), undefined);
});

test("l’actualisation à l’ouverture respecte le choix du compte et le délai", () => {
  assert.equal(shouldRefreshOnOpen("manual", hoursAgo(48), now), false);
  assert.equal(shouldRefreshOnOpen("on_open", hoursAgo(2), now), false);
  assert.equal(shouldRefreshOnOpen("on_open", hoursAgo(13), now), true);
  assert.equal(shouldRefreshOnOpen("on_open", undefined, now), true);
  assert.equal(shouldRefreshOnOpen("on_open", hoursAgo(5), now, 4), true);
});

test("le délai s’écrit en clair", () => {
  assert.equal(refreshedAgo(undefined, now), "Jamais actualisé");
  assert.equal(nbsp(refreshedAgo(new Date(now - 30000).toISOString(), now)), "Actualisé à l’instant");
  assert.equal(nbsp(refreshedAgo(hoursAgo(0.5), now)), "Actualisé il y a 30 min");
  assert.equal(nbsp(refreshedAgo(hoursAgo(2), now)), "Actualisé il y a 2 h");
  assert.equal(nbsp(refreshedAgo(hoursAgo(26), now)), "Actualisé hier");
  assert.equal(nbsp(refreshedAgo(hoursAgo(72), now)), "Actualisé il y a 3 jours");
});

test("seul « manual » sort du mode par défaut", () => {
  assert.equal(refreshMode(undefined), "on_open");
  assert.equal(refreshMode("manual"), "manual");
  assert.equal(refreshMode("autre"), "on_open");
});
