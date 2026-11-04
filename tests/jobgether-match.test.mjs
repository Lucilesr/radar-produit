import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../lib/jobgether-match.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { showJobgetherOffer } = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));

test("le seuil Jobgether dépend du réglage du compte", () => {
  assert.equal(showJobgetherOffer("Jobgether", 54, 55, "new", "to_review"), false);
  assert.equal(showJobgetherOffer("Jobgether", 55, 55, "new", "to_review"), true);
  assert.equal(showJobgetherOffer("Jobgether", 54, 50, "new", "to_review"), true);
  assert.equal(showJobgetherOffer("Jobgether", 0, 0, "new", "to_review"), true);
});

test("les choix déjà suivis et les autres sources restent accessibles", () => {
  assert.equal(showJobgetherOffer("Jobgether", 54, 80, "new", "selected"), true);
  assert.equal(showJobgetherOffer("Jobgether", 54, 80, "applied", "to_review"), true);
  assert.equal(showJobgetherOffer("We Work Remotely", 54, 80, "new", "to_review"), true);
});
