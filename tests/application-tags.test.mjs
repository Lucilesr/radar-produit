import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const file = fileURLToPath(new URL("../lib/application-tags.ts", import.meta.url));
const code = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { editApplicationTags, tagColors, tagsForJob } = await import("data:text/javascript;base64," + Buffer.from(code).toString("base64"));

test("tags : création vide, attribution, modification et suppression globale", () => {
  assert.throws(() => editApplicationTags([], { action: "create", name: "  ", color: tagColors[0].value }), /nom de tag/);
  const created = editApplicationTags([], { action: "create", name: "Prioritaire", color: tagColors[0].value, jobId: "carte-1" });
  assert.equal(created.length, 1);
  const id = created[0].id;
  assert.equal(tagsForJob(created, "carte-1").length, 1);
  const assigned = editApplicationTags(created, { action: "toggle", id, jobId: "carte-1" });
  assert.equal(tagsForJob(assigned, "carte-1").length, 0);
  const reassigned = editApplicationTags(assigned, { action: "toggle", id, jobId: "carte-1" });
  const changed = editApplicationTags(reassigned, { action: "update", id, name: "À relancer", color: tagColors[2].value });
  assert.equal(changed[0].jobIds[0], "carte-1");
  assert.equal(changed[0].name, "À relancer");
  assert.equal(tagsForJob(editApplicationTags(changed, { action: "delete", id }), "carte-1").length, 0);
  assert.equal(tagsForJob(editApplicationTags(changed, { action: "toggle", id, jobId: "carte-1" }), "carte-1").length, 0);
});

test("tags : doublons et couleurs hors palette refusés", () => {
  const tags = editApplicationTags([], { action: "create", name: "Prioritaire", color: tagColors[0].value });
  assert.throws(() => editApplicationTags(tags, { action: "create", name: "prioritaire", color: tagColors[1].value }), /existe déjà/);
  assert.throws(() => editApplicationTags(tags, { action: "create", name: "Autre", color: "#000000" }), /couleur/);
});
