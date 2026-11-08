import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
const urls=new Map();
function moduleUrl(name){
 if(urls.has(name))return urls.get(name);
 let code=ts.transpileModule(readFileSync(new URL(`../lib/${name}.ts`,import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 code=code.replace(/from "\.\/([^".]+)"/g,(_,dependency)=>`from "${moduleUrl(dependency)}"`);
 const url="data:text/javascript;base64,"+Buffer.from(code).toString("base64");urls.set(name,url);return url;
}
const {scanPlan,sortedScanReadings,scanBar,scanSourceGroups,visitUrl,radarEchoes,scanSourceStatus,scanSources,offersFromSource}=await import(moduleUrl("scan-presentation"));
const {sourceCatalog}=await import(moduleUrl("source-catalog"));
const reading=(source,total=4,matchedIds=["a"],extra={})=>({source,state:"ok",ok:true,total,matchedIds,imported:1,deduplicated:total-1,...extra});
test("Q2b : barres triées par correspondances, puis parcours, sans muter le bilan",()=>{
 const rows=[reading("C",2,[]),reading("B",8,["b","c"]),reading("A",4,["a","d"]),reading("Pause",0,[],{state:"paused"})],copy=structuredClone(rows);
 assert.deepEqual(sortedScanReadings(rows).map(item=>item.source),["B","A","C"]);assert.deepEqual(rows,copy);
 assert.deepEqual(scanBar(reading("A",4,["a","b"]),8),{width:50,matching:50});assert.deepEqual(scanBar(reading("A",0,[]),0),{width:0,matching:0});
 assert.equal(scanBar(reading("A",4,["a","a"]),8).matching,25);
});
test("Q2b : trois visites les plus anciennes, jamais visitées d’abord, pauses hors visites",()=>{
 const settings=[{source:"Collective",selected:true,lastVisitedAt:"2026-11-08"},{source:"Apec",selected:true,lastVisitedAt:"2026-10-01"},{source:"LinkedIn Jobs",selected:true,lastVisitedAt:"2026-10-15"},{source:"Free-Work",state:"paused"},{source:"Welcome to the Jungle",selected:false}];
 const group=scanSourceGroups(sourceCatalog,settings),all=[...group.visits,...group.otherVisits];
 assert.equal(group.visits.length,3);assert(all.findIndex(item=>item.name==="Apec")<all.findIndex(item=>item.name==="LinkedIn Jobs"));assert(all.findIndex(item=>item.name==="LinkedIn Jobs")<all.findIndex(item=>item.name==="Collective"));
 assert(group.visits.slice(0,2).every(item=>!settings.find(setting=>setting.source===item.name)?.lastVisitedAt));assert.equal(group.visits[2].name,"Apec");
 for(const name of ["Free-Work","Welcome to the Jungle","Jobgether"]){assert(group.paused.some(item=>item.name===name));assert(!all.some(item=>item.name===name));}
 assert(!all.some(item=>item.name==="Post LinkedIn"));
 assert.equal(visitUrl({name:"Mon site",url:""},[{source:"Mon site",linkUrl:"https://example.org/offres-fictives"}]),"https://example.org/offres-fictives");
 assert.equal(visitUrl({name:"Mon site",url:""},[{source:"Mon site",linkUrl:"javascript:alert(1)"}]),null);
});
test("Q2b : activation réelle et libellés des états",()=>{
 assert.deepEqual(scanPlan([]).map(item=>item.state),["waiting","paused"]);
 assert.deepEqual(scanPlan([{source:"Jobgether",selected:true},{source:"We Work Remotely",state:"paused"}]).map(item=>item.state),["paused","waiting"]);
 assert.equal(scanSourceStatus("waiting"),"en attente");assert.equal(scanSourceStatus("running"),"en cours");assert.match(scanSourceStatus("ok"),/terminé/);assert.equal(scanSourceStatus("error"),"erreur");
});
test("Q2b : la première lecture est affichée avant la fin de la seconde, reprise ciblée",async()=>{
 let release;const first=new Promise(resolve=>{release=resolve}),events=[];let calls=0;
 const pending=scanSources(["We Work Remotely","Jobgether"],async source=>{calls++;if(calls===1)await first;return reading(source);},(source,state,result)=>events.push({source,state,result}),new AbortController().signal);
 assert.deepEqual(events.map(item=>item.state),["waiting","waiting","running"]);assert.equal(calls,1);
 release();const results=await pending;assert.equal(results.length,2);assert.deepEqual(events.map(item=>item.state),["waiting","waiting","running","ok","running","ok"]);
 const retry=[];await scanSources(["Jobgether"],async source=>reading(source),source=>retry.push(source),new AbortController().signal);assert(retry.every(source=>source==="Jobgether"));
});
test("Q2b : une panne ne bloque pas la source suivante, une annulation termine les états",async()=>{
 const result=await scanSources(["We Work Remotely","Jobgether"],async source=>{if(source==="We Work Remotely")throw new Error("Panne fictive");return reading(source);},()=>{},new AbortController().signal);
 assert.equal(result[0].state,"error");assert.equal(result[1].state,"ok");
 const abort=new AbortController();abort.abort();let calls=0;
 const interrupted=await scanSources(["We Work Remotely","Jobgether"],async source=>{calls++;return reading(source);},()=>{},abort.signal);
 assert.equal(calls,0);assert(interrupted.every(item=>item.state==="error"));assert(interrupted.every(item=>item.total===0));
});
test("Q2b : un écho par offre unique, stable lors d’une arrivée et contenu dans le radar",()=>{
 const first=radarEchoes(["ancienne","ancienne","nouvelle"]);assert.equal(first.length,2);
 assert.deepEqual(radarEchoes(["autre","nouvelle","ancienne"]).find(item=>item.id==="ancienne"),first[0]);
 for(const point of radarEchoes(Array.from({length:1000},(_,index)=>"offre-fictive-"+index)))assert(Math.hypot(point.x-50,point.y-50)<43);
});
test("Q2b : le filtre de source est exact, même si une entreprise contient le nom",()=>{
 const jobs=[{id:"1",source:"Jobgether",company:"Fictive"},{id:"2",source:"Autre",company:"Jobgether"}];assert.deepEqual(offersFromSource(jobs,"Jobgether").map(job=>job.id),["1"]);assert.equal(offersFromSource(jobs).length,2);assert.equal(jobs.length,2);
});
