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
const { changedCriteriaIds, criteriaGroups, criteriaTokens, missingCriteria } = await import(moduleUrl("search-criteria", { "./search-preferences": preferences, "./search-tracks": tracks, "./seniority": moduleUrl("seniority") }));
const nbsp = text => text.replace(/[  ]/g, " ");

test("les critères enregistrés donnent une étiquette par critère renseigné", () => {
  const tokens = criteriaTokens({ ...searchPreferences(undefined), roles: ["Product Owner", "Product Manager"], contracts: ["cdi", "freelance"], remote: "hybrid", minimumSalary: 55000, minimumDailyRate: 500 });
  assert.deepEqual(tokens.map(token => token.id), ["roles", "contracts", "remote", "salary", "dailyRate", "matchScore", "includedLocations"]);
  assert.equal(tokens[0].value, "Product Owner, Product Manager");
  assert.equal(nbsp(tokens.find(token => token.id === "salary").value), "≥ 55 000 € brut/an");
  assert.equal(nbsp(tokens.find(token => token.id === "dailyRate").value), "≥ 500 € HT/jour");
  assert.equal(tokens.find(token => token.id === "includedLocations").value, "Tous les lieux");
  assert.ok(tokens.every(token => token.tone === "include"));
});

test("un nouveau compte part de critères neutres, sans poste ni minimum", () => {
  const neutral = searchPreferences(undefined);
  assert.deepEqual(neutral.roles, []);
  assert.deepEqual(neutral.contracts, ["cdi", "cdd", "freelance", "portage", "part_time"]);
  assert.equal(neutral.remote, "onsite");
  assert.equal(neutral.minimumSalary, 0);
  assert.equal(neutral.minimumDailyRate, 0);
  assert.equal(neutral.searchTracks, undefined);
  const tokens = criteriaTokens(neutral);
  assert.equal(tokens[0].value, "Aucun poste choisi");
  assert.equal(tokens.find(token => token.id === "salary").value, "Aucun minimum");
  assert.equal(tokens.find(token => token.id === "dailyRate").value, "Aucun minimum");
  assert.ok(!tokens.some(token => /Product/.test(token.fullValue)));
});

test("un compte enregistré garde ses valeurs, même en retirant tous ses postes", () => {
  const saved = searchPreferences({ roles: ["Data Analyst"], contracts: ["cdi"], remote: "full_remote", minimumSalary: 48000, minimumDailyRate: 0 });
  assert.deepEqual(saved.roles, ["Data Analyst"]);
  assert.equal(saved.minimumSalary, 48000);
  assert.deepEqual(searchPreferences({ ...saved, roles: [] }).roles, []);
  assert.deepEqual(searchPreferences({ ...saved, roles: "Product Owner" }).roles, []);
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

test("la tolérance n'apparaît que si elle est réglée", () => {
  assert.ok(!criteriaTokens(searchPreferences({})).some(token => token.id === "payTolerance"));
  const token = criteriaTokens(searchPreferences({ payTolerancePercent: 5 })).find(item => item.id === "payTolerance");
  assert.equal(token.label, "Tolérance");
  assert.equal(token.value, "−5 %");
});

test("« + Critère » ne propose que ce qui n’est pas encore réglé", () => {
  const fresh = missingCriteria(searchPreferences({ contracts: ["cdi"], roles: ["Data Analyst"] })).map(item => item.id);
  assert.deepEqual(fresh, ["boostKeywords", "excludeKeywords", "payTolerance", "searchTracks", "level"]);
  const filled = missingCriteria(searchPreferences({ contracts: ["cdi"], roles: ["Data Analyst"], boostKeywords: ["fintech"], payTolerancePercent: 5 })).map(item => item.id);
  assert.deepEqual(filled, ["excludeKeywords", "searchTracks", "level"]);
  const leveled = missingCriteria(searchPreferences({ contracts: ["cdi"], roles: ["Data Analyst"], targetLevel: "senior" })).map(item => item.id);
  assert.ok(!leveled.includes("level"));
  const unpaid = missingCriteria(searchPreferences({ contracts: ["part_time"], roles: ["Data Analyst"] })).map(item => item.id);
  assert.ok(!unpaid.includes("payTolerance"));
});

const {criteriaEditParts,criterionParts,criteriaEditGroups,mergeCriteriaDraft}=await import(moduleUrl("criteria-editor",{"./search-criteria":moduleUrl("search-criteria",{"./search-preferences":preferences,"./search-tracks":tracks,"./seniority":moduleUrl("seniority")})}));
test("chaque ligne de critères pointe vers un contrôle existant, sans doublons dans le tableau",()=>{
 const prefs=searchPreferences({contracts:["cdi","freelance","portage"],remoteByContract:{cdi:"onsite",freelance:"full_remote"},includedLocations:["Europe"],excludedLocations:["Roumanie"],boostKeywords:["SaaS"],excludeKeywords:["stage"],payTolerancePercent:10,searchTracks:[{id:"data",label:"Data",kind:"core",terms:["Data Analyst"]}]});
 for(const row of criteriaGroups(prefs).flatMap(group=>group.rows))assert.ok(criteriaEditParts.includes(criterionParts[row.id]),row.id);
 const rows=criteriaEditGroups(prefs).flatMap(group=>group.rows);
 assert.equal(rows.filter(row=>row.part==="locations").length,1);
 assert.equal(rows.filter(row=>row.part==="presence").length,1);
 assert.equal(rows.filter(row=>row.part==="tracks").length,1);
});
test("le tableau ouvre les critères vides demandés et garde une tolérance éditable à zéro",()=>{
 const prefs=searchPreferences({searchTracks:[],boostKeywords:[],excludeKeywords:[],payTolerancePercent:0});
 const before=criteriaEditGroups(prefs).flatMap(group=>group.rows).map(row=>row.part);
 assert.ok(before.includes("tolerance"));assert.ok(!before.includes("boostKeywords"));
 const after=criteriaEditGroups(prefs,["boostKeywords","excludeKeywords","searchTracks"]).flatMap(group=>group.rows).map(row=>row.part);
 for(const part of ["boostKeywords","excludeKeywords","tracks"])assert.ok(after.includes(part));
 assert.equal(new Set(after).size,after.length);
});
test("les sauvegardes de champs distincts conservent les dernières valeurs des autres contrôles",()=>{
 const base=searchPreferences({boostKeywords:[],searchTracks:[],minimumSalary:55000});
 const next={...base,minimumSalary:60000};
 const current={...base,boostKeywords:["SaaS"],contracts:["cdi"],searchTracks:[{id:"data",label:"Data",kind:"core",terms:["Data Analyst"]}]};
 const merged=mergeCriteriaDraft(base,next,current);
 assert.equal(merged.minimumSalary,60000);assert.deepEqual(merged.boostKeywords,["SaaS"]);assert.deepEqual(merged.contracts,["cdi"]);assert.deepEqual(merged.searchTracks,current.searchTracks);
 assert.equal(base.minimumSalary,55000);
});

test("les repères ciblent seulement les critères modifiés, y compris présence par contrat et retraits",()=>{
 const before=searchPreferences({searchTracks:[],boostKeywords:["SaaS"],remoteByContract:{cdi:"hybrid"},excludedLocations:["Roumanie"]});
 const after={...before,minimumSalary:60000,remoteByContract:{cdi:"full_remote"},boostKeywords:[],excludedLocations:[],searchTracks:[{id:"data",label:"Data",kind:"core",terms:["Data Analyst"]}]};
 assert.deepEqual(changedCriteriaIds(before,before),[]);
 assert.deepEqual(changedCriteriaIds(before,after),["searchTracks","remote","salary","excludedLocations","boostKeywords"]);
 assert.deepEqual(changedCriteriaIds({...before,boostKeywords:undefined},{...before,boostKeywords:[]}),[]);
});

test("une sauvegarde différée de rémunération conserve les suggestions écartées du compte",()=>{
 const base=searchPreferences({roles:["Data Analyst"]});
 const current={...base,dismissedRoleSuggestions:["Chef de produit"]};
 const result=mergeCriteriaDraft(base,{...base,minimumSalary:60000},current);
 assert.deepEqual(searchPreferences(JSON.parse(JSON.stringify(result))).dismissedRoleSuggestions,["Chef de produit"]);
});

test("Score v2 S2 : le niveau visé devient une ligne du poste une fois choisi", () => {
  assert.ok(!criteriaGroups(searchPreferences({ contracts: ["cdi"], roles: ["Product Owner"] }))[0].rows.some(row => row.id === "level"));
  const rows = criteriaGroups(searchPreferences({ contracts: ["cdi"], roles: ["Product Owner"], targetLevel: "senior", acceptLevelAbove: true }))[0].rows;
  const level = rows.find(row => row.id === "level");
  assert.deepEqual(level.values, ["Senior · niveau supérieur accepté"]);
  assert.equal(level.target, "level");
  assert.ok(rows.findIndex(row => row.id === "level") < rows.findIndex(row => row.id === "contracts"));
  assert.equal(criteriaTokens(searchPreferences({ contracts: ["cdi"], roles: ["Product Owner"], targetLevel: "lead" })).find(token => token.id === "level").value, "Lead");
  assert.deepEqual(changedCriteriaIds(searchPreferences({ roles: ["PO"] }), searchPreferences({ roles: ["PO"], targetLevel: "senior" })), ["level"]);
});
