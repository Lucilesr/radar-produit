import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../lib/jobgether-match.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { showJobgetherOffer } = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));

test("le seuil Jobgether de 55 vaut pour les nouvelles offres de chaque compte", () => {
  for (const score of [0, 54]) assert.equal(showJobgetherOffer("Jobgether", score, "new", "to_review"), false);
  for (const score of [55, 100]) assert.equal(showJobgetherOffer("Jobgether", score, "new", "to_review"), true);
});

test("les choix déjà suivis et les autres sources restent accessibles", () => {
  assert.equal(showJobgetherOffer("Jobgether", 54, "new", "selected"), true);
  assert.equal(showJobgetherOffer("Jobgether", 54, "applied", "to_review"), true);
  assert.equal(showJobgetherOffer("We Work Remotely", 54, "new", "to_review"), true);
});
