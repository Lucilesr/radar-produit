import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import ts from "typescript";
const code=ts.transpileModule(readFileSync(new URL("../lib/radar-session.ts",import.meta.url),"utf8"),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {sessionDay,sessionSnapshot,sessionVisits,sessionFollowups,sessionSteps,sessionEstimate,sessionProgress,readSession,pauseSession}=await import("data:text/javascript;base64,"+Buffer.from(code).toString("base64"));
const now=new Date(2026,10,7,10).getTime();
const job=(id,extra={})=>({id,status:"new",reviewState:"to_review",interviews:[],...extra});
const source=(source,extra={})=>({source,selected:true,lastVisitedAt:new Date(now-8*86400000).toISOString(),...extra});
const facts=[{id:"a",validation:"approved"},{id:"b",validation:"proposed"}];
function session(jobs,sources=[]){return {id:"session",day:sessionDay(now),startedAt:now,activeMs:0,resumedAt:now,steps:["triage"],current:0,initial:sessionSnapshot(jobs,sources,facts),sent:[],paused:false};}
test("Q3 : les étapes suivent le lot, les échéances et les blocs réels, sans étape vide",()=>{
 assert.deepEqual(sessionSteps(0,0,0,[]),[]);
 assert.deepEqual(sessionSteps(0,1,2,[]),["followups","sources"]);
 assert.deepEqual(sessionSteps(3,1,2,facts),["triage","followups","sources","validation"]);
 assert.deepEqual(sessionSteps(0,0,0,[{id:"p",validation:"rejected"},{id:"c",validation:"proposed",parentId:"p"}]),[]);
 assert.equal(sessionEstimate(4,2,7),13);assert.equal(sessionEstimate(0,0,0),0);
});
test("Q3 : seules les sources consultables actives sans visite depuis plus de cinq jours sont proposées",()=>{
 const list=[source("old"),source("recent",{lastVisitedAt:new Date(now-5*86400000).toISOString()}),source("never",{lastVisitedAt:undefined}),source("paused",{state:"paused"}),source("off",{selected:false}),source("feed")];
 assert.deepEqual(sessionVisits(list,name=>name==="feed"?"rss":"email",now).map(x=>x.source),["old","never"]);
});
test("Q3 : une date de relance doit être passée, active et non confirmée",()=>{
 const event=(id,time,state="reviewed")=>({id,state,followUpAt:new Date(time).toISOString()});
 const list=[job("a",{status:"interview",interviews:[event("due",now-1000),event("future",now+1000),event("planned",now-1000,"planned")]}),job("b",{status:"rejected",interviews:[event("closed",now-1000)]})];
 assert.deepEqual(sessionFollowups(list,now).map(x=>x.id),["due"]);assert.equal(sessionFollowups(list,now,["due"]).length,0);
});
test("Q3 : le bilan ne compte ni un clic suivant, ni une note, ni une restauration",()=>{
 const before=[job("a"),job("b"),job("c",{deletedAt:"old"}),job("d",{reviewState:"selected"}),job("e")],sources=[source("manual")];
 const start=session(before,sources);
 assert.equal(sessionProgress(start,before,sources,facts,now+30000).total,0);
 const after=[job("a",{reviewState:"selected",fit:86,fitLabel:"very_close"}),job("b",{candidateNote:"une note"}),job("c"),job("d",{status:"applied",reviewState:"selected"}),job("e",{reviewState:"later"}),job("new",{reviewState:"selected",fit:100,fitLabel:"very_close"})];
 const result=sessionProgress({...start,sent:["due","due"]},after,[source("manual",{lastVisitedAt:new Date(now+1000).toISOString()})],[...facts.map(x=>x.id==="b"?{...x,validation:"approved"}:x)],now+61000);
 assert.deepEqual(result,{sorted:2,followups:1,visited:1,validated:1,total:5,minutes:2,gemId:"a"});
});
test("Q3 : écarter compte seulement après confirmation et ne crée jamais de pépite",()=>{
 const before=[job("a")],start=session(before);
 const after=[job("a",{deletedAt:new Date(now+1000).toISOString(),fit:100,fitLabel:"very_close"})];
 assert.equal(sessionProgress(start,after,[],facts,now+1000).sorted,1);assert.equal(sessionProgress(start,after,[],facts,now+1000).gemId,undefined);
});
test("Q3 : une offre arrivée pendant la séance compte après une vraie décision",()=>{
 const start=session([]),fresh=job("fresh",{createdAt:new Date(now+1000).toISOString()});
 assert.equal(sessionProgress(start,[fresh],[],facts,now+2000).sorted,0);
 assert.equal(sessionProgress(start,[{...fresh,reviewState:"selected"}],[],facts,now+2000).sorted,1);
});
test("Q3 : reprise limitée au jour et refus d’un stockage altéré",()=>{
 const value=session([job("a")]);assert.deepEqual(readSession(JSON.stringify(value),now),value);
 for(const bad of [{...value,current:4},{...value,steps:["constructor"]},{...value,steps:["triage","triage"]},{...value,initial:{...value.initial,approved:[13]}},{...value,startedAt:now+120000}])assert.equal(readSession(JSON.stringify(bad),now),null);
 assert.equal(readSession(JSON.stringify(value),now+86400000),null);assert.equal(readSession("{",now),null);
});

test("Q3 : la pause ne gonfle pas les minutes de séance",()=>{
 const start=session([job("a")]);const paused=pauseSession(start,now+30000);assert.equal(paused.activeMs,30000);assert.equal(paused.resumedAt,null);
 const afterPause=now+10*3600000;assert.equal(sessionProgress(paused,[],[],facts,afterPause).minutes,1);
 const resumed={...paused,paused:false,resumedAt:afterPause};assert.equal(sessionProgress(resumed,[],[],facts,afterPause+30000).minutes,1);
 assert.equal(pauseSession(paused,afterPause).activeMs,30000);
});
test("Q4 : les blocs complets restent hors de l’instantané de confort de séance",()=>{
 const snapshot=sessionSnapshot([job("a",{description:"PRIVATE_OFFER_TEXT"})],[source("manual")],[{id:"fact",validation:"approved",data:{context:"PRIVATE_STORY_TEXT"}}]);
 assert.doesNotMatch(JSON.stringify(snapshot),/PRIVATE_/);assert.deepEqual(snapshot.approved,["fact"]);
});
