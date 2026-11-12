import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
const code = ts.transpileModule(readFileSync(new URL("../lib/radar-navigation.ts", import.meta.url), "utf8"), {compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
const {readRadarRoute, readProfileSection, readSearchSection, radarSearch, canonicalRadarSearch, profileSectionForRoute} = await import("data:text/javascript;base64,"+Buffer.from(code).toString("base64"));

test("P5 : les anciens profils ouvrent leur section dans les quatre espaces",()=>{
 for(const [old,tab,section] of [["experiences","radar","carnet"],["documents","radar","documents"],["stories","radar","stories"],["months","radar","months"],["portee","radar","reach"],["lessons","pipeline","lessons"],["account","account",undefined]]){
  const route=readRadarRoute("?tab=profile&profile="+old+"&utm_source=demo");
  assert.equal(route.tab,tab);assert.equal(route.section,section);
  const canonical=canonicalRadarSearch("?tab=profile&profile="+old+"&utm_source=demo");
  assert(!new URLSearchParams(canonical).has("profile"));assert.match(canonical,/utm_source=demo/);
  assert.deepEqual(readRadarRoute(canonical),route);
 }
});
test("P5 : critères et sources gardent les anciens liens directs et la source ouverte",()=>{
 for(const [old,section] of [["criteria","criteria"],["channels","sources"],["outreach","outreach"]]){
  const input="?tab=sources&sources="+old,route=readRadarRoute(input),canonical=canonicalRadarSearch(input);
  assert.equal(route.tab,"radar");assert.equal(route.section,section);assert(!new URLSearchParams(canonical).has("sources"));assert.deepEqual(readRadarRoute(canonical),route);
 }
 assert.equal(readRadarRoute("?tab=radar&source=LinkedIn+Jobs").section,"sources");
 const linked="?tab=sources&source=LinkedIn+Jobs&utm_source=demo";
 assert.equal(readRadarRoute(linked).section,"sources");assert.equal(new URLSearchParams(canonicalRadarSearch(linked)).get("source"),"LinkedIn Jobs");
 const offers=radarSearch({...readRadarRoute(linked),tab:"offers"},linked);
 assert(!new URLSearchParams(offers).has("source"));assert(!new URLSearchParams(offers).has("section"));
});
test("P5 : section seule, anciennes variantes et valeurs hostiles restent prévisibles",()=>{
 for(const [old,tab,section] of [["experiences","radar","carnet"],["channels","radar","sources"],["portee","radar","reach"],["lessons","pipeline","lessons"],["account","account",undefined]]){
  const route=readRadarRoute("?section="+old);assert.equal(route.tab,tab);assert.equal(route.section,section);
 }
 for(const unknown of ["invalid","__proto__","constructor","prototype"]){assert.equal(readRadarRoute("?tab=radar&section="+unknown).section,"criteria");assert.equal(readRadarRoute("?tab=profile&profile="+unknown).section,"carnet");}
 assert.equal(readRadarRoute("?tab=offers&section=account").tab,"offers");
});
test("P5 : navigation métier, filtres, recherche et paramètres externes sont conservés",()=>{
 const route=readRadarRoute("?tab=offers&filter=selected&q=Product&offer=demo&view=brief");
 assert.deepEqual(readRadarRoute(radarSearch(route,"?utm_source=demo")),route);
 assert.match(radarSearch(route,"?utm_source=demo"),/utm_source=demo/);
 const conditions=readRadarRoute("?tab=offers&offer=demo&view=conditions");
 assert.equal(conditions.view,"conditions");
 assert.deepEqual(readRadarRoute(radarSearch(conditions)),conditions);
 const closed=readRadarRoute(radarSearch({...route,offer:undefined},"?offer=demo&view=brief"));
 assert.equal(closed.offer,undefined);assert.equal(closed.view,"offer");assert.equal(closed.filter,"selected");
 assert.equal(readRadarRoute("?offer=demo&view=interviews").tab,"pipeline");
 assert.equal(readRadarRoute("?tab=invalid&filter=unknown&view=bad").tab,"dashboard");
 assert.equal(readRadarRoute("?tab=offers&filter=all").filter,"to_review");assert.equal(readRadarRoute("?q="+"a".repeat(400)).query.length,200);
});
test("P5 : un aller-retour vers Candidatures ne rouvre pas Documents par erreur",()=>{
 const original="?tab=radar&section=documents&utm_source=demo",documents=readRadarRoute(original);
 const pipeline=readRadarRoute(radarSearch({...documents,tab:"pipeline"},original));
 assert.equal(pipeline.section,undefined);
 const backToRadar=readRadarRoute(radarSearch({...pipeline,tab:"radar"},radarSearch(pipeline)));
 assert.equal(backToRadar.section,"criteria");assert.equal(readRadarRoute(original).section,"documents");
 assert.match(radarSearch(backToRadar,original),/utm_source=demo/);
});
test("P5 et C4 : le dossier garde les leçons à la fermeture, la sortie reste explicite",()=>{
 const source="?tab=profile&profile=lessons&offer=fictif&view=application",route=readRadarRoute(source);
 assert.equal(route.tab,"pipeline");assert.equal(route.section,"lessons");assert.equal(route.offer,"fictif");assert.equal(route.view,"application");
 const closed=readRadarRoute(radarSearch({...route,offer:undefined,view:"offer"},source));assert.equal(closed.section,"lessons");assert.equal(closed.offer,undefined);
 const normal=readRadarRoute(radarSearch({...route,section:undefined,offer:undefined},source));assert.equal(normal.section,undefined);assert.equal(normal.offer,undefined);
});
test("P5 : les lecteurs de formulaires anciens restent compatibles",()=>{
 assert.equal(readProfileSection("account"),"account");assert.equal(readProfileSection("unknown"),"experiences");
 assert.equal(readSearchSection("outreach"),"outreach");assert.equal(readSearchSection("unknown"),"criteria");
 assert.equal(profileSectionForRoute(readRadarRoute("?tab=radar&section=stories")),"stories");
 assert.equal(profileSectionForRoute(readRadarRoute("?tab=account")),"account");
});
test("P5 : normaliser une URL deux fois ne modifie pas son point de reprise",()=>{
 for(const search of ["?tab=profile&profile=stories&utm_source=demo","?tab=sources&sources=outreach","?tab=radar","?tab=account","?offer=demo&view=interviews"]){const once=canonicalRadarSearch(search);assert.equal(canonicalRadarSearch(once),once);}
});

test("Q2b : filtre exact de source conservé après rechargement et effaçable sans toucher aux anciens liens",()=>{
 const input="?tab=offers&source=We+Work+Remotely",route=readRadarRoute(input);
 assert.equal(route.source,"We Work Remotely");assert.equal(route.tab,"offers");assert.deepEqual(readRadarRoute(radarSearch(route)),route);
 assert.equal(new URLSearchParams(radarSearch({...route,source:undefined},input)).has("source"),false);
 assert.equal(readRadarRoute("?tab=radar&section=sources&source=Jobgether").source,undefined);
 assert.equal(new URLSearchParams(canonicalRadarSearch("?tab=radar&section=sources&source=Jobgether")).get("source"),"Jobgether");
});
