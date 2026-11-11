import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../lib/tab-return-refresh.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {createTabReturnRefresh} = await import("data:text/javascript;base64," + Buffer.from(compiled).toString("base64"));

function setup() {
  let now = 0;
  const refresh = createTabReturnRefresh(() => now);
  return {
    ...refresh,
    hide(at) { now = at; refresh.visibilityChanged(true); },
    show(at) { now = at; refresh.visibilityChanged(false); },
  };
}

test("Seul un retour après cinq secondes masquées lance une relecture", () => {
  const refresh = setup();
  let reads = 0;
  refresh.subscribe("week-plan", () => reads++);
  refresh.show(0);
  refresh.hide(10);
  refresh.show(4_999);
  assert.equal(reads, 0);
  refresh.hide(10_000);
  refresh.hide(13_000);
  refresh.show(20_000);
  refresh.show(21_000);
  assert.equal(reads, 1);
});

test("Les blocs se relisent séparément et une seule fois par période de trente secondes", () => {
  const refresh = setup();
  const reads = [];
  const stop = refresh.subscribe("continuity", () => reads.push("séance"));
  refresh.subscribe("continuity", () => reads.push("lot"));
  refresh.hide(0);
  refresh.show(10_000);
  stop();
  refresh.subscribe("week-plan", () => reads.push("plan"));
  refresh.hide(12_000);
  refresh.show(22_000);
  assert.deepEqual(reads, ["séance", "plan"]);
  refresh.hide(29_000);
  refresh.show(40_000);
  assert.deepEqual(reads, ["séance", "plan", "lot"]);
});

test("Remonter un bloc conserve son délai et retirer le dernier abonné arrête les lectures", () => {
  const refresh = setup();
  let reads = 0;
  const read = () => reads++;
  const first = refresh.subscribe("care:job", read);
  refresh.hide(0);
  refresh.show(10_000);
  first();
  const second = refresh.subscribe("care:job", read);
  refresh.hide(15_000);
  refresh.show(25_000);
  second();
  refresh.hide(41_000);
  refresh.show(51_000);
  assert.equal(reads, 1);
});
