import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
function moduleUrl(name){return "data:text/javascript;base64,"+Buffer.from(ts.transpileModule(readFileSync(new URL(`../lib/${name}.ts`,import.meta.url),"utf8"),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText).toString("base64");}
const {scanMatches,summarizeScan,mergeScan,readScanSummary,mergeSourceSettings}=await import(moduleUrl("source-sync"));
const {demoScenario,demoScenarioNotice}=await import(moduleUrl("demo-scenarios"));
const at="2026-11-07T17:00:00Z";
const reading=(source,extra={})=>({source,state:"ok",ok:true,total:4,imported:2,deduplicated:2,matchedIds:[`${source}-1`],...extra});
test("Q2 : les compteurs proviennent des lectures et les offres proches sont uniques",()=>{
 const result=summarizeScan([reading("A",{matchedIds:["partage","a"]}),reading("B",{total:3,imported:1,deduplicated:2,matchedIds:["partage","b"]})],at);
 assert.equal(result.total,7);assert.equal(result.imported,3);assert.equal(result.deduplicated,4);assert.equal(result.matching,3);assert.equal(result.partialFailure,false);
});
test("Q2 : échec partiel, total et sources inactives sont distincts",()=>{
 const error=reading("B",{state:"error",ok:false,total:0,imported:0,deduplicated:0,matchedIds:[],error:"Panne fictive"});
 const partial=summarizeScan([reading("A"),error],at);assert.equal(partial.partialFailure,true);assert.equal(partial.allFailed,false);assert.equal(partial.imported,2);
 assert.equal(summarizeScan([error],at).allFailed,true);
 const paused=reading("A",{state:"paused",total:0,imported:0,deduplicated:0,matchedIds:[]});
 assert.equal(summarizeScan([paused,error],at).allFailed,true);
 assert.equal(summarizeScan([paused],at).inactive,true);assert.equal(summarizeScan([paused],at).allFailed,false);
 const cached={...paused,state:"cached"};assert.equal(summarizeScan([cached,error],at).partialFailure,true);
});
test("Q2 : une reprise ne perd pas les chiffres des sources déjà réussies",()=>{
 const first=summarizeScan([reading("A"),reading("B",{state:"error",ok:false,total:0,imported:0,deduplicated:0,matchedIds:[]})],at);
 const result=mergeScan(first,summarizeScan([reading("B",{total:2,imported:1,deduplicated:1,matchedIds:["A-1","B-1"]})],at));
 assert.equal(result.total,6);assert.equal(result.imported,3);assert.equal(result.matching,2);assert.equal(result.partialFailure,false);assert.deepEqual(result.sources[0],first.sources[0]);
});
test("Q2 : adéquation ou conditions connues, les exclusions et la corbeille priment",()=>{
 for(const extra of [{fit:60,conditions:"check"},{fit:null,conditions:"pass"},{fit:40,conditions:"pass"}])assert.equal(scanMatches({id:"fictif",...extra}),true);
 for(const extra of [{fit:59,conditions:"check"},{fit:null,conditions:"check"},{fit:90,conditions:"excluded"},{fit:90,conditions:"pass",deletedAt:at}])assert.equal(scanMatches({id:"fictif",...extra}),false);
});
test("Q2 : une réponse invalide ne produit ni chiffres inventés ni contenu non textuel",()=>{
 const good=summarizeScan([reading("A")],at);assert.equal(readScanSummary(good).total,4);
 for(const value of [null,{}, {...good,at:"invalide"}, {...good,sources:[reading("A",{total:NaN})]}, {...good,sources:[reading("A",{total:-1})]}, {...good,sources:[reading("A",{error:{message:"x"}})]}, {...good,sources:[reading("A",{matchedIds:[{}]})]}, {...good,sources:[reading("A",{imported:7})]}])assert.equal(readScanSummary(value),null);
});
test("Q2 : une lecture de source ancienne n’efface pas une modification récente",()=>{
 const current=[{source:"Collective",updatedAt:"2026-11-07T17:00:00Z",lastVisitedAt:at}];
 const merged=mergeSourceSettings(current,[{source:"Collective",updatedAt:"2026-11-07T16:00:00Z"},{source:"Malt",updatedAt:at}]);
 assert.equal(merged[0].lastVisitedAt,at);assert.equal(merged.length,2);
 assert.equal(mergeSourceSettings(current,[{source:"Collective",updatedAt:"2026-11-07T18:00:00Z",selected:false}])[0].selected,false);
});
test("Q2 : les scénarios de démo sont fermés et explicitement annoncés",()=>{
 assert.equal(demoScenario("scan-partial"),"scan-partial");assert.equal(demoScenario("arbitraire"),"full");assert.equal(demoScenario({}),"full");
 assert.match(demoScenarioNotice("scan-partial"),/fictif.*panne/);assert.match(demoScenarioNotice("scan-reduced"),/mouvements réduits/);
});
