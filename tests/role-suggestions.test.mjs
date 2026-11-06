import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

function moduleUrl(name, imports = {}) {
  let code = ts.transpileModule(readFileSync(new URL(`../lib/${name}.ts`, import.meta.url), "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  for (const [from, to] of Object.entries(imports)) code = code.replaceAll(`"${from}"`, JSON.stringify(to));
  return "data:text/javascript;base64," + Buffer.from(code).toString("base64");
}
const tracks = moduleUrl("search-tracks");
const locations = moduleUrl("location-criteria", { "./countries": moduleUrl("countries"), "./market-scope": moduleUrl("market-scope") });
const preferencesUrl = moduleUrl("search-preferences", { "./search-tracks": tracks, "./location-criteria": locations });
const { searchPreferences, normalizeDismissedRoleSuggestions } = await import(preferencesUrl);
const { suggestedRoles, suggestedRoleTitle } = await import(moduleUrl("role-suggestions", { "./search-preferences": preferencesUrl, "./search-tracks": tracks }));
const now = new Date("2026-11-06T12:00:00Z");
const date = days => new Date(now.getTime() - days * 86400000).toISOString();
const prefs = searchPreferences({ roles: ["Data Analyst"] });
const offers = (title, count = 3, changes = {}) => Array.from({ length: count }, (_, index) => ({ id: `${title}-${index}`, title, createdAt: date(1), ...changes }));
const suggest = (jobs, preferences = prefs, dismissed = []) => suggestedRoles(jobs, preferences, dismissed, now);

test("les titres perdent genre, séniorité et suffixes ; Lead et les mots composés restent", () => {
  assert.equal(suggestedRoleTitle("Senior Chef de produit H/F – Paris"), "Chef de produit");
  assert.equal(suggestedRoleTitle("Junior Chef de produit (CDI)"), "Chef de produit");
  assert.equal(suggestedRoleTitle("Sénior Product Lead F/H - Lyon"), "Product Lead");
  assert.equal(suggestedRoleTitle("H/F Product Lead"), "Product Lead");
  assert.equal(suggestedRoleTitle("Développeur full-stack - Remote"), "Développeur full-stack");
  assert.equal(suggestedRoleTitle("Chef de produit junior/senior"), "Chef de produit");
  assert.equal(suggestedRoleTitle("PO (CDI)"), "Product Owner");
  assert.equal(suggestedRoleTitle("Senior (Paris)"), "");
});

test("trois occurrences sont nécessaires, sans distinction d’accents ni de casse", () => {
  assert.deepEqual(suggest(offers("Chef de produit", 2)), []);
  const jobs = [...offers("Senior Chef de produit H/F", 1), ...offers("chef de PRODUIT (CDI)", 1), ...offers("CHEF DE PRODUIT – Paris", 1)];
  assert.deepEqual(suggest(jobs), [{ title: "Chef de produit", count: 3 }]);
  assert.deepEqual(suggest([...offers("Ingénieur produit", 2), ...offers("ingenieur PRODUIT", 1)]), [{ title: "Ingénieur produit", count: 3 }]);
});

test("seules les offres non supprimées des trente derniers jours comptent", () => {
  assert.deepEqual(suggest([...offers("Chef de produit", 2), ...offers("Chef de produit", 1, { deletedAt: date(0) })]), []);
  assert.deepEqual(suggest(offers("Chef de produit", 3, { publishedAt: date(31), createdAt: date(1) })), []);
  assert.deepEqual(suggest(offers("Chef de produit", 3, { createdAt: date(30) })), [{ title: "Chef de produit", count: 3 }]);
  for (const changes of [{ createdAt: date(30.01) }, { createdAt: undefined }, { createdAt: "invalide" }, { createdAt: date(-1) }]) assert.deepEqual(suggest(offers("Chef de produit", 3, changes)), []);
  assert.equal(suggest(offers("Chef de produit", 3, { publishedAt: "invalide" })).length, 1);
});

test("trois propositions au plus, par fréquence puis ordre stable en cas d’égalité", () => {
  const jobs = [...offers("UX Designer", 4), ...offers("Product Lead", 6), ...offers("Chef de produit", 5), ...offers("Business Analyst", 4)];
  assert.deepEqual(suggest(jobs), [{ title: "Product Lead", count: 6 }, { title: "Chef de produit", count: 5 }, { title: "Business Analyst", count: 4 }]);
});

test("les postes et les termes des pistes du compte ne sont jamais proposés", () => {
  const preferences = searchPreferences({ roles: ["Product Owner", "Ingénieur produit"], searchTracks: [{ id: "core", label: "Produit", kind: "core", terms: ["Chef de produit", "Product Lead"] }] });
  const jobs = [...offers("PO H/F"), ...offers("ingenieur PRODUIT"), ...offers("Senior Chef de produit – Paris"), ...offers("Product Lead F/H")];
  assert.deepEqual(suggest(jobs, preferences), []);
});

test("les suggestions écartées sont validées et conservées après relecture du compte", () => {
  assert.deepEqual(searchPreferences(undefined).dismissedRoleSuggestions, []);
  assert.deepEqual(searchPreferences({ roles: ["Data Analyst"] }).dismissedRoleSuggestions, []);
  assert.deepEqual(normalizeDismissedRoleSuggestions([null, 42, " ", "A", "x".repeat(81), "  Ingénieur   produit ", "ingenieur produit"]), ["Ingénieur produit"]);
  assert.equal(normalizeDismissedRoleSuggestions(Array.from({ length: 40 }, (_, index) => `Poste ${index}`)).length, 30);
  const stored = searchPreferences({ ...prefs, dismissedRoleSuggestions: ["Ingénieur produit"] });
  const restored = searchPreferences(JSON.parse(JSON.stringify(stored)));
  assert.deepEqual(suggest(offers("ingenieur produit"), restored), []);
  assert.deepEqual(suggest(offers("Chef de produit"), prefs, ["chef DE PRODUIT"]), []);
});

test("les offres et les refus d’un compte ne modifient jamais ceux d’un autre", () => {
  const jobsA = offers("Chef de produit");
  const jobsB = offers("Chef de produit", 4);
  const accountA = searchPreferences({ roles: ["Data Analyst"], dismissedRoleSuggestions: ["Chef de produit"] });
  const accountB = searchPreferences({ roles: ["UX Designer"] });
  const before = JSON.stringify({ jobsA, jobsB, accountA, accountB });
  assert.deepEqual(suggest(jobsA, accountA), []);
  assert.deepEqual(suggest(jobsB, accountB), [{ title: "Chef de produit", count: 4 }]);
  assert.equal(JSON.stringify({ jobsA, jobsB, accountA, accountB }), before);
});
