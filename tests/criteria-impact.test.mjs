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
const arrangement = moduleUrl("work-arrangement");
const workflow = moduleUrl("application-workflow");
const marketScope = moduleUrl("market-scope");
const countries = moduleUrl("countries");
const locations = moduleUrl("location-criteria", { "./countries": countries, "./market-scope": marketScope });
const tracks = moduleUrl("search-tracks");
const preferences = moduleUrl("search-preferences", { "./location-criteria": locations, "./search-tracks": tracks });
const matching = moduleUrl("matching", { "./work-arrangement": arrangement, "./application-workflow": workflow, "./market-scope": marketScope, "./search-preferences": preferences, "./location-criteria": locations });
const views = moduleUrl("opportunity-views");
const criteria = moduleUrl("search-criteria", { "./search-preferences": preferences, "./search-tracks": tracks });
const { searchPreferences } = await import(preferences);
const { countToReview, describeCriteriaChanges, impactMessage } = await import(moduleUrl("criteria-impact", { "./search-preferences": preferences, "./matching": matching, "./opportunity-views": views, "./search-criteria": criteria }));
const nbsp = text => text.replace(/[  ]/g, " ");

// Fictional offers only.
const offer = (id, extra) => ({ id, title: "Product Owner", company: "Atlas", contractType: "freelance", remoteMode: "full_remote", language: "fr", source: "Autre", status: "new", matchScore: 0, matchTier: "exception", reasons: [], flags: [], ...extra });
const jobs = [
  offer("a", { dailyRate: 450 }),
  offer("b", { dailyRate: 520 }),
  offer("c", { dailyRate: 480 }),
  offer("d", { dailyRate: 600, deletedAt: "2026-11-01T00:00:00Z" }),
  offer("e", { dailyRate: 700, status: "applied" }),
];

test("baisser le TJM minimum remet en « À examiner » les offres entre les deux seuils", () => {
  const strict = searchPreferences({ contracts: ["freelance"], minimumDailyRate: 500 });
  const relaxed = searchPreferences({ contracts: ["freelance"], minimumDailyRate: 450 });
  assert.equal(countToReview(jobs, strict), 1);
  assert.equal(countToReview(jobs, relaxed), 3);
});

test("les offres supprimées ou déjà candidatées ne comptent pas", () => {
  assert.equal(countToReview(jobs, searchPreferences({ contracts: ["freelance"], minimumDailyRate: 0 })), 3);
});

test("chaque changement de critère est décrit en clair", () => {
  const before = searchPreferences({ roles: ["Product Owner"], contracts: ["cdi"], excludedLocations: [], minimumDailyRate: 500, remote: "hybrid" });
  const after = searchPreferences({ roles: ["Product Owner", "Product Manager"], contracts: ["cdi", "freelance"], excludedLocations: ["Roumanie"], minimumDailyRate: 450, remote: "full_remote" });
  assert.deepEqual(describeCriteriaChanges(before, after).map(nbsp), [
    "Poste ajouté : Product Manager",
    "Contrat ajouté : Freelance",
    "Lieu exclu : Roumanie",
    "Présence Hybride → Full remote",
    "Pistes de recherche mises à jour",
    "TJM 500 € → 450 €/jour",
  ]);
  assert.deepEqual(describeCriteriaChanges(before, before), []);
});

test("le message résume deux changements et l'effet sur la liste", () => {
  assert.equal(impactMessage(["A", "B", "C"], 14, 22), "A · B · +1. 22 offres à examiner (+8).");
  assert.equal(impactMessage(["A"], 3, 3), "A. 3 offres à examiner.");
  assert.equal(impactMessage(["A"], 2, 1), "A. 1 offre à examiner (-1).");
});

test("un mot-clé écarté retire l'offre de « À examiner »", () => {
  const offers = [offer("k", { title: "Product Owner — stage", dailyRate: 600 })];
  assert.equal(countToReview(offers, searchPreferences({ contracts: ["freelance"], minimumDailyRate: 500 })), 1);
  assert.equal(countToReview(offers, searchPreferences({ contracts: ["freelance"], minimumDailyRate: 500, excludeKeywords: ["stage"] })), 0);
});

test("la confirmation couvre aussi la présence par contrat et les pistes",()=>{
 const before=searchPreferences({remoteByContract:{cdi:"hybrid"},searchTracks:[]});
 const after={...before,remoteByContract:{cdi:"full_remote"},searchTracks:[{id:"data",label:"Data",kind:"core",terms:["Data Analyst"]}]};
 assert.deepEqual(describeCriteriaChanges(before,after),["Présence CDI Hybride → Full remote","Pistes de recherche mises à jour"]);
});
