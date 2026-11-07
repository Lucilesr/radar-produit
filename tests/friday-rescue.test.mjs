import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
function moduleUrl(name, imports = {}) {
  let compiled = ts.transpileModule(readFileSync(new URL(`../lib/${name}.ts`, import.meta.url), "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  for (const [from, to] of Object.entries(imports)) compiled = compiled.replaceAll(`"${from}"`, JSON.stringify(to));
  return "data:text/javascript;base64," + Buffer.from(compiled).toString("base64");
}
const { fridayRescue, demoFriday } = await import(moduleUrl("friday-rescue", { "./opportunity-views": moduleUrl("opportunity-views") }));
const now = new Date(2026, 10, 6, 15);
const offer = (id, overrides = {}) => ({ id, title: "Exemple fictif", status: "new", fit: 72, fitLabel: "close", conditions: "pass", deletedAt: new Date(now.getTime() - 2 * 86400000).toISOString(), ...overrides });
test("Q1c : trois offres, tirage stable sur la journée et indépendant de l’ordre", () => {
  const pool = Array.from({ length: 20 }, (_, index) => offer(`fictif-${index}`));
  const ids = date => fridayRescue(pool, date).map(job => job.id);
  assert.equal(ids(now).length, 3);
  assert.deepEqual(ids(now), ids(new Date(2026, 10, 6, 23)));
  assert.deepEqual(ids(now), fridayRescue([...pool].reverse(), now).map(job => job.id));
  assert.equal(pool.length, 20);
});
test("Q1c : uniquement les écartées depuis sept jours au plus et proches ou mieux", () => {
  const pool = [offer("oui"), offer("tres-proche", { fit: 85, fitLabel: "very_close" }), offer("limite", { deletedAt: new Date(now.getTime() - 7 * 86400000).toISOString() }),
    offer("ancienne", { deletedAt: new Date(now.getTime() - 7 * 86400000 - 1).toISOString() }), offer("demain", { deletedAt: new Date(now.getTime() + 1).toISOString() }),
    offer("invalide", { deletedAt: "pas-une-date" }), offer("non-ecartee", { deletedAt: undefined }), offer("a-jauger", { fit: 55, fitLabel: "to_weigh" }),
    offer("incomplete", { fitLabel: undefined }), offer("exclue", { conditions: "excluded" }), offer("candidature", { status: "applied" })];
  assert.deepEqual(new Set(fridayRescue(pool, now).map(job => job.id)), new Set(["oui", "tres-proche", "limite"]));
});
test("Q1c : aucune carte hors du vendredi ni sans offre éligible", () => {
  for (const day of [1, 2, 3, 4, 5, 7]) assert.deepEqual(fridayRescue([offer("oui")], new Date(2026, 10, day, 15)), []);
  assert.deepEqual(fridayRescue([], now), []);
  assert.equal(demoFriday(new Date(2026, 10, 7, 15)).getDay(), 5);
});
