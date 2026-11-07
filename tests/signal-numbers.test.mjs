import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../lib/signal-numbers.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { signalProgress, signalCountAt } = await import("data:text/javascript;base64," + Buffer.from(compiled).toString("base64"));

test("Signal : une progression vide, dépassée ou invalide reste bornée", () => {
  assert.deepEqual(signalProgress(0, 0), { value: 0, max: 0, percent: 0 });
  assert.deepEqual(signalProgress(23, 20), { value: 20, max: 20, percent: 100 });
  assert.deepEqual(signalProgress(-1, 20), { value: 0, max: 20, percent: 0 });
  assert.deepEqual(signalProgress(NaN, Infinity), { value: 0, max: 0, percent: 0 });
  assert.equal(signalProgress(1, 20).percent, 5);
});

test("Signal : les nombres arrivent à leur valeur réelle à 600 ms, même en descente", () => {
  assert.equal(signalCountAt(0, 214, 0), 0);
  assert.equal(signalCountAt(0, 214, 600), 214);
  assert.equal(signalCountAt(0, 214, 900), 214);
  assert.equal(signalCountAt(20, 2, 600), 2);
  assert.equal(signalCountAt(0, 4, 0, 0), 4);
  const frames = [0, 100, 200, 300, 400, 500, 600].map(t => signalCountAt(0, 214, t));
  assert.ok(frames.every((n, i) => i === 0 || n >= frames[i - 1]));
});
