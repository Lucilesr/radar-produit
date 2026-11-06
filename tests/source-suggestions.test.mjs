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
const { suggestedSources, matchesSourceQuery, rankSources, sourceTags } = await import(moduleUrl("source-suggestions", { "./source-status": moduleUrl("source-status") }));

// Fictional catalogue entries.
const sources = [
  { name: "Alpha", group: "France · CDI", url: "https://a.test", mode: "email", note: "" },
  { name: "Beta", group: "France · freelance", url: "https://b.test", mode: "email", note: "" },
  { name: "Gamma", group: "International · remote", url: "https://c.test", mode: "api", note: "" },
  { name: "Delta", group: "Ajout volontaire", url: "https://d.test", mode: "manual", note: "" },
];

test("les sources freelance remontent pour un compte freelance", () => {
  const order = rankSources(sources, searchPreferences({ contracts: ["freelance"], remote: "hybrid", includedLocations: ["France"] })).map(source => source.name);
  assert.equal(order[0], "Beta");
  assert.ok(order.indexOf("Beta") < order.indexOf("Alpha"));
});

test("un compte CDI en France ne voit pas l’international en premier", () => {
  const order = rankSources(sources, searchPreferences({ contracts: ["cdi"], remote: "hybrid", includedLocations: ["France"] })).map(source => source.name);
  assert.equal(order[0], "Alpha");
});

test("le full remote fait remonter les sources internationales", () => {
  const order = rankSources(sources, searchPreferences({ contracts: ["cdi"], remote: "full_remote", includedLocations: [] })).map(source => source.name);
  assert.equal(order[0], "Gamma");
});

test("chaque source porte deux ou trois étiquettes lisibles", () => {
  assert.deepEqual(sourceTags(sources[2]), ["Collecte sans compte", "International", "remote"]);
  assert.deepEqual(sourceTags(sources[3]), ["Ajout volontaire", "Ajout volontaire"]);
});

test("la recherche porte sur le nom, le groupe et les étiquettes", () => {
  assert.ok(matchesSourceQuery(sources[1], "free"));
  assert.ok(matchesSourceQuery(sources[2], "alerte") === false);
  assert.ok(matchesSourceQuery(sources[0], "Alerte email"));
  assert.ok(matchesSourceQuery(sources[0], "  "));
});

test("les suggestions excluent les sources suivies et volontaires, avec quatre propositions au plus",()=>{
 const catalog=[...sources,...Array.from({length:5},(_,index)=>({...sources[2],name:`Source ${index}`}))];
 const prefs=searchPreferences({contracts:["freelance"],remote:"full_remote"});
 const followed=["Gamma","Source 0"];
 const expected=rankSources(catalog.filter(source=>source.mode!=="manual"&&!followed.includes(source.name)),prefs).slice(0,4);
 const result=suggestedSources(catalog,prefs,followed);
 assert.deepEqual(result,expected);assert.equal(result.length,4);
 assert.deepEqual(suggestedSources(catalog,prefs,catalog.map(source=>source.name)),[]);
 assert.deepEqual(suggestedSources([],prefs,[]),[]);
});
