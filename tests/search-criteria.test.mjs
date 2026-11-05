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
const countries = moduleUrl("countries");
const marketScope = moduleUrl("market-scope");
const locations = moduleUrl("location-criteria", { "./countries": countries, "./market-scope": marketScope });
const { searchPreferences } = await import(moduleUrl("search-preferences", { "./location-criteria": locations }));
const { criteriaGroups, criteriaTokens } = await import(moduleUrl("search-criteria"));
const nbsp = text => text.replace(/[  ]/g, " ");

test("les préférences par défaut donnent une étiquette par critère renseigné", () => {
  const tokens = criteriaTokens(searchPreferences(undefined));
  assert.deepEqual(tokens.map(token => token.id), ["roles", "contracts", "remote", "salary", "dailyRate", "matchScore", "includedLocations"]);
  assert.equal(tokens[0].value, "Product Owner, Product Manager");
  assert.equal(nbsp(tokens.find(token => token.id === "salary").value), "≥ 55 000 € brut/an");
  assert.equal(nbsp(tokens.find(token => token.id === "dailyRate").value), "≥ 500 € HT/jour");
  assert.equal(tokens.find(token => token.id === "includedLocations").value, "Tous les lieux");
  assert.ok(tokens.every(token => token.tone === "include"));
});

test("les seuils suivent les contrats recherchés", () => {
  const cdiOnly = criteriaTokens(searchPreferences({ contracts: ["cdi"] })).map(token => token.id);
  assert.ok(cdiOnly.includes("salary"));
  assert.ok(!cdiOnly.includes("dailyRate"));
  const freelanceOnly = criteriaTokens(searchPreferences({ contracts: ["freelance"] })).map(token => token.id);
  assert.ok(!freelanceOnly.includes("salary"));
  assert.ok(freelanceOnly.includes("dailyRate"));
});

test("les exclusions de lieu forment une étiquette distincte", () => {
  const tokens = criteriaTokens(searchPreferences({ includedLocations: ["Europe"], excludedLocations: ["Roumanie"] }));
  const excluded = tokens.find(token => token.id === "excludedLocations");
  assert.equal(excluded.label, "Sauf");
  assert.equal(excluded.value, "Roumanie");
  assert.equal(excluded.tone, "exclude");
  assert.equal(tokens.find(token => token.id === "includedLocations").value, "Europe");
});

test("une liste longue garde trois valeurs puis le nombre restant", () => {
  const roles = ["Product Owner", "Product Manager", "Chef de produit", "Product Lead", "Product Ops"];
  const token = criteriaTokens(searchPreferences({ roles })).find(item => item.id === "roles");
  assert.equal(token.value, "Product Owner, Product Manager, Chef de produit +2");
  assert.equal(token.fullValue, roles.join(", "));
});

test("la vue dépliée range chaque critère dans son thème", () => {
  const groups = criteriaGroups(searchPreferences({ excludedLocations: ["Asie"] }));
  assert.deepEqual(groups.map(group => group.title), ["Le poste", "La présence", "La rémunération", "La géographie"]);
  assert.deepEqual(groups.find(group => group.id === "geography").rows.map(row => row.label), ["Lieux inclus", "Sauf"]);
  assert.equal(groups.find(group => group.id === "pay").rows.find(row => row.id === "matchScore").target, "jobgether");
});
