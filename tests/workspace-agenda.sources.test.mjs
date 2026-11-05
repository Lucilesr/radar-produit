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
const { sourcesToVisit } = await import(moduleUrl("workspace-agenda", {
  "./application-workflow": moduleUrl("application-workflow", { "./work-arrangement": moduleUrl("work-arrangement") }),
  "./source-status": moduleUrl("source-status"),
}));
const now = new Date("2026-11-05T09:00:00Z");
const daysAgo = days => new Date(now.getTime() - days * 86400000).toISOString();
// Fictional sources only.
const modes = { "LinkedIn Jobs": "web", Himalayas: "research", Jobgether: "api" };
const modeOf = name => modes[name];

test("une source à consulter en retard est rappelée, avec la date de la dernière visite", () => {
  const entries = sourcesToVisit([{ source: "LinkedIn Jobs", lastVisitedAt: daysAgo(3) }], modeOf, now);
  assert.deepEqual(entries, [{ source: "LinkedIn Jobs", status: "to_visit", detail: "Vue il y a 3 jours" }]);
});

test("une source jamais visitée est rappelée aussi", () => {
  assert.deepEqual(sourcesToVisit([{ source: "Himalayas" }], modeOf, now).map(entry => entry.detail), ["Jamais visitée"]);
});

test("le rappel coupé, la visite récente et les sources automatiques ne remontent pas", () => {
  const entries = sourcesToVisit([
    { source: "LinkedIn Jobs", lastVisitedAt: daysAgo(3), remindInToday: false },
    { source: "Himalayas", lastVisitedAt: daysAgo(1) },
    { source: "Jobgether", selected: true, state: "configured" },
    { source: "Inconnue", lastVisitedAt: daysAgo(9) },
  ], modeOf, now);
  assert.deepEqual(entries, []);
});

test("le rythme choisi décide du rappel", () => {
  const weekly = [{ source: "LinkedIn Jobs", lastVisitedAt: daysAgo(3), visitEveryDays: 7 }];
  assert.deepEqual(sourcesToVisit(weekly, modeOf, now), []);
  const daily = [{ source: "LinkedIn Jobs", lastVisitedAt: daysAgo(3), visitEveryDays: 1 }];
  assert.equal(sourcesToVisit(daily, modeOf, now).length, 1);
});
