import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
const code = ts.transpileModule(readFileSync(new URL("../lib/radar-navigation.ts", import.meta.url), "utf8"), {compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
const {readRadarRoute, readProfileSection, readSearchSection, radarSearch} = await import("data:text/javascript;base64,"+Buffer.from(code).toString("base64"));
test("navigation : lien partageable, filtres et recherche restaurés sans perdre les paramètres externes", () => {
  const route = readRadarRoute("?tab=offers&filter=selected&q=Product&offer=demo&view=brief");
  assert.deepEqual(readRadarRoute(radarSearch(route,"?utm_source=demo")), route);
  assert.match(radarSearch(route,"?utm_source=demo"), /utm_source=demo/);
  const closed = readRadarRoute(radarSearch({...route, offer:undefined}, "?offer=demo&view=brief"));
  assert.equal(closed.offer, undefined); assert.equal(closed.view,"offer"); assert.equal(closed.filter,"selected");
});
test("navigation : les sections de Ma recherche gardent leur lien direct", () => {
  const alerts = "?tab=sources&sources=channels&utm_source=demo";
  assert.equal(readSearchSection(new URLSearchParams(alerts).get("sources")), "channels");
  assert.equal(new URLSearchParams(radarSearch(readRadarRoute(alerts), alerts)).get("sources"), "channels");
  const offers = radarSearch({...readRadarRoute(alerts), tab:"offers"}, alerts);
  assert.equal(new URLSearchParams(offers).has("sources"), false);
  assert.equal(readSearchSection(new URLSearchParams(offers).get("sources")), "criteria");
  assert.equal(readSearchSection("invalid"), "criteria");
});
test("navigation : anciens liens d’entretien et paramètres invalides", () => {
  assert.equal(readRadarRoute("?offer=demo&view=interviews").tab,"pipeline");
  assert.equal(readRadarRoute("?tab=invalid&filter=unknown&view=bad").tab,"dashboard");
  assert.equal(readRadarRoute("?tab=offers&filter=all").filter,"to_review");
  assert.equal(readRadarRoute("?q="+"a".repeat(400)).query.length,200);
});
test("navigation : Mes documents → Candidatures → Mon profil revient au carnet", () => {
  const documents = "?tab=profile&profile=documents&utm_source=demo";
  const pipeline = radarSearch({...readRadarRoute(documents), tab:"pipeline"}, documents);
  const profile = radarSearch({...readRadarRoute(pipeline), tab:"profile"}, pipeline);
  assert.equal(new URLSearchParams(pipeline).has("profile"), false);
  assert.equal(readProfileSection(new URLSearchParams(profile).get("profile")), "experiences");
  assert.equal(new URLSearchParams(profile).get("utm_source"), "demo");
  // A direct link or Back/Forward to the original entry still opens documents.
  assert.equal(readProfileSection(new URLSearchParams(documents).get("profile")), "documents");
  assert.equal(new URLSearchParams(radarSearch(readRadarRoute(documents), documents)).get("profile"), "documents");
});

test("Ma recherche : les trois anciens liens ciblent une section valide",()=>{
 for(const section of ["criteria","channels","outreach"]){
  const search=`?tab=sources&sources=${section}`;
  assert.equal(readSearchSection(new URLSearchParams(search).get("sources")),section);
  assert.equal(new URLSearchParams(radarSearch(readRadarRoute(search),search)).get("sources"),section);
 }
});

test("navigation : « Mon compte » s'ouvre par lien direct, une valeur inconnue revient au carnet", () => {
  assert.equal(readProfileSection("account"), "account");
  assert.equal(readProfileSection("compte"), "experiences");
});

test("P2 : Mes histoires ouvre le carnet par lien direct sans perdre les paramètres",()=>{const search="?tab=profile&profile=stories&utm_source=demo";assert.equal(readProfileSection("stories"),"stories");assert.equal(new URLSearchParams(radarSearch(readRadarRoute(search),search)).get("profile"),"stories");assert.equal(new URLSearchParams(radarSearch({...readRadarRoute(search),tab:"offers"},search)).has("profile"),false);});
