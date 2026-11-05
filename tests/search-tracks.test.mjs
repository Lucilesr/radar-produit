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
const tracks = moduleUrl("search-tracks");
const preferences = moduleUrl("search-preferences", { "./location-criteria": locations, "./search-tracks": tracks });
const { searchPreferences } = await import(preferences);
const { legacySearchTracks, normalizeSearchTracks, searchTracksFor, searchedTerms, trackQuery } = await import(tracks);
const { searchDrift, sourceDrift } = await import(moduleUrl("search-drift", { "./search-tracks": tracks, "./web-discovery": moduleUrl("web-discovery") }));

test("sans pistes enregistrées, une seule piste est déduite des postes", () => {
  const derived = searchTracksFor({ roles: ["Data Analyst", "Analytics Engineer"] });
  assert.equal(derived.length, 1);
  assert.deepEqual(derived[0].terms, ["Data Analyst", "Analytics Engineer"]);
  assert.equal(trackQuery(derived[0]), '"Data Analyst" OR "Analytics Engineer"');
});

test("un compte qui cherchait les anciens postes garde les trois pistes", () => {
  const inherited = searchPreferences({ roles: ["Product Owner", "Product Manager"], contracts: ["cdi"] });
  assert.deepEqual(inherited.searchTracks?.map(track => track.label), legacySearchTracks.map(track => track.label));
  assert.ok(inherited.searchTracks?.some(track => track.terms.includes("Product Builder")));
});

test("un autre compte ne reçoit aucun terme des anciens postes", () => {
  const other = searchPreferences({ roles: ["Data Analyst"], contracts: ["cdi"] });
  assert.equal(other.searchTracks, undefined);
  const terms = searchedTerms(other);
  assert.ok(terms.has("data analyst"));
  for (const legacy of ["product owner", "product builder", "product ops"]) assert.ok(!terms.has(legacy));
});

test("les pistes enregistrées sont nettoyées et bornées", () => {
  const tracks = normalizeSearchTracks([
    { id: "Coeur!", label: "  Cœur   de cible  ", kind: "unknown", terms: ["Product Owner", "product owner", " ", "PO"] },
    { label: "Vide", kind: "broad", terms: [] },
    { label: "Longue", kind: "broad", terms: Array.from({ length: 20 }, (_, index) => `Terme ${index}`) },
  ]);
  assert.equal(tracks.length, 2);
  assert.deepEqual(tracks[0].terms, ["Product Owner", "PO"]);
  assert.equal(tracks[0].kind, "core");
  assert.equal(tracks[0].label, "Cœur de cible");
  assert.equal(tracks[0].id, "coeur-de-cible");
  assert.equal(tracks[1].terms.length, 12);
  assert.equal(normalizeSearchTracks("non"), undefined);
});

test("un terme absent des postes et des pistes est signalé", () => {
  const account = searchPreferences({ roles: ["Data Analyst"], contracts: ["cdi"] });
  assert.deepEqual(searchDrift({ id: "s1", terms: ["Data Analyst"] }, account), []);
  const drift = searchDrift({ id: "s1", terms: ["Product Builder", "data analyst"] }, account);
  assert.deepEqual(drift, [{ kind: "term", value: "Product Builder", searchId: "s1" }]);
});

test("les abréviations et les accents ne comptent pas comme un écart", () => {
  const account = searchPreferences({ roles: ["Product Owner"], contracts: ["cdi"], searchTracks: [{ id: "core", label: "Cœur", kind: "core", terms: ["Chef de produit"] }] });
  assert.deepEqual(searchDrift({ id: "s1", terms: ["PO", "chef de PRODUIT"] }, account), []);
});

test("les écarts d'une source viennent de ses recherches enregistrées", () => {
  const account = searchPreferences({ roles: ["Data Analyst"], contracts: ["cdi"] });
  const setting = { searchLinks: { "Data Analyst": { Google: "https://x" }, "Product Builder": { Site: "https://y" }, "Product Ops": {}, "Tous les postes": { Site: "https://z" } } };
  // « Tous les postes » is the grouped search, not a title: it is never an écart.
  assert.deepEqual(sourceDrift(setting, account).map(drift => drift.value), ["Product Builder"]);
  assert.deepEqual(sourceDrift(undefined, account), []);
});
