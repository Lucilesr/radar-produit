import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import ts from "typescript";
const modules=new Map();
function moduleUrl(file){
 const key=file.href;if(modules.has(key))return modules.get(key);
 let code=ts.transpileModule(readFileSync(file,"utf8"),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
 code=code.replace(/(from\s+|import\s*)["'](\.[^"']+)["']/g,(_,prefix,path)=>prefix+JSON.stringify(moduleUrl(new URL(path.endsWith(".ts")?path:path+".ts",file))));
 const url="data:text/javascript;base64,"+Buffer.from(code).toString("base64");modules.set(key,url);return url;
}
const {nextSteps,nextStepActionKey}=await import(moduleUrl(new URL("../lib/next-steps.ts",import.meta.url)));
const {readSession,sessionDay,sessionSnapshot,sessionProgress}=await import(moduleUrl(new URL("../lib/radar-session.ts",import.meta.url)));
const {continuitySession}=await import(moduleUrl(new URL("../lib/radar-continuity.ts",import.meta.url)));
const {weekKey}=await import(moduleUrl(new URL("../lib/week-plan.ts",import.meta.url)));
const now=Date.parse("2026-11-08T10:00:00Z");
const iso=offset=>new Date(now+offset).toISOString();
const job=(id,extra={})=>({id,status:"new",reviewState:"to_review",interviews:[],...extra});
const base={now,timeZone:"Indian/Mauritius",jobs:[],lotRemaining:0,plan:{week:weekKey(now,"Indian/Mauritius")},reach:{next:null,doneThemes:[]},sources:[],modeOf:name=>name==="feed"?"rss":"web"};
const interview=(offset=3600000)=>({id:"meeting",state:"planned",startAt:iso(offset),endAt:iso(offset+3600000)});
test("P4 : une file unique dans les sept priorités du guide",()=>{
 const input={...base,plan:null,lotRemaining:3,jobs:[job("meeting-job",{status:"interview",interviews:[interview()]}),job("due",{status:"applied",appliedAt:iso(-8*86400000)}),job("chosen",{reviewState:"selected"})],reach:{next:{kind:"level",label:"Choisir le niveau",button:"Choisir",minutes:1},doneThemes:[]},sources:[{source:"manual",lastVisitedAt:iso(-8*86400000)}]};
 assert.deepEqual(nextSteps(input).map(x=>x.kind),["interview","followups","triage","plan","care","setting","sources"]);
 assert.deepEqual(nextSteps(input).map(x=>x.minutes),[10,3,3,5,5,1,3]);
 assert.deepEqual(nextSteps(input)[0].action,{type:"interview",jobId:"meeting-job"});
 assert.match(nextSteps(input)[0].label,/^Préparer votre entretien chez .+ · /);
 assert.equal(nextSteps(input)[0].action.jobId,"meeting-job");
});
test("P4 : aucune étape inventée lorsque tout est fait",()=>{
 assert.deepEqual(nextSteps(base),[]);
 assert.deepEqual(nextSteps({...base,now:NaN}),[]);
 assert.deepEqual(nextSteps({...base,lotRemaining:-3}),[]);
 assert.equal(nextSteps({...base,lotRemaining:1000})[0].minutes,20);
});
test("P4 : entretien prioritaire dans les 48 h, limites et calendrier réel",()=>{
 assert.equal(nextSteps({...base,jobs:[job("a",{status:"interview",interviews:[interview(48*3600000)]})]})[0].kind,"interview");
 for(const event of [interview(48*3600000+1),{...interview(),state:"cancelled"},{...interview(),startAt:"invalid"}])
  assert.deepEqual(nextSteps({...base,jobs:[job("a",{status:"interview",interviews:[event]})]}),[]);
 // A past interview no longer needs preparing: it asks for its debrief.
 const past=nextSteps({...base,jobs:[job("a",{company:"Atelier fictif Orion",status:"interview",interviews:[interview(-3*3600000)]})]});
 assert.deepEqual(past.map(x=>[x.kind,x.label,x.action.type]),[["interview","Faire le bilan de votre entretien chez Atelier fictif Orion","interview"]]);
 assert.deepEqual(nextSteps({...base,jobs:[job("a",{status:"interview",interviews:[{...interview(-3*3600000),state:"reviewed"}]})]}),[]);
 assert.deepEqual(nextSteps({...base,jobs:[job("a",{status:"rejected",interviews:[interview(-3*3600000)]})]}),[]);
 assert.deepEqual(nextSteps({...base,jobs:[job("a",{status:"rejected",interviews:[interview()]})]}),[]);
});
test("P4 : relances confirmées et check-lists déjà remplies ne sont pas reproposées",()=>{
 const due=job("due",{status:"applied",appliedAt:iso(-8*86400000)});
 assert.equal(nextSteps({...base,jobs:[due]})[0].kind,"followups");
 assert.deepEqual(nextSteps({...base,jobs:[due],confirmedFollowups:["application:due"]}),[]);
 const ready={cv:true,message:true,questions:true,contact:false,version:1};
 assert.deepEqual(nextSteps({...base,jobs:[job("c",{reviewState:"selected",applicationCare:ready}),job("already-sent",{status:"ready",reviewState:"selected",appliedAt:iso(-86400000)})]}),[]);
 assert.equal(nextSteps({...base,jobs:[job("c",{reviewState:"selected",applicationCare:{...ready,questions:false}})]})[0].kind,"care");
});
test("P4 : source manuelle à sept jours, choix désactivés et visites futures respectés",()=>{
 const sources=[{source:"recent",lastVisitedAt:iso(-7*86400000+1)},{source:"exact",lastVisitedAt:iso(-7*86400000)},{source:"off",selected:false},{source:"paused",state:"paused"},{source:"quiet",remindInToday:false},{source:"future",lastVisitedAt:iso(86400000)},{source:"feed"}];
 assert.equal(nextSteps({...base,sources})[0].action.source,"exact");
 assert.equal(nextSteps({...base,sources:[{source:"never"}]})[0].kind,"sources");
});
test("P4 : pas de doublon entre entretien, réglage et visite de source ; entrées immuables",()=>{
 const source=Object.freeze({source:"manual"}),sources=Object.freeze([source,source]);
 const input={...base,sources,reach:{next:{kind:"visit",label:"Visiter",button:"Ouvrir",minutes:3,target:"manual"},doneThemes:[]}};
 const before=JSON.stringify(input),result=nextSteps(input);
 assert.deepEqual(result.map(x=>x.kind),["setting"]);
 assert.equal(new Set(result.map(x=>nextStepActionKey(x.action))).size,result.length);
 assert.equal(JSON.stringify(input),before);
 const stories={...base,jobs:[job("m",{status:"interview",interviews:[interview()]})],reach:{next:{kind:"story",label:"Écrire",button:"Écrire",minutes:5,target:"prioriser"},doneThemes:[]}};
 // Preparing the interview opens it; writing a story stays a separate, later radar setting.
 assert.deepEqual(nextSteps(stories).map(x=>x.kind),["interview","setting"]);
 assert.equal(nextSteps(stories)[0].action.type,"interview");
});
test("P4 : le lundi ouvre une nouvelle semaine, un plan déjà confirmé ne se répète pas",()=>{
 const monday=Date.parse("2026-11-09T01:30:00Z"),plan={week:weekKey(monday,"America/New_York")};
 assert.deepEqual(nextSteps({...base,now:monday,timeZone:"America/New_York",plan}),[]);
 assert.equal(nextSteps({...base,now:monday,timeZone:"UTC",plan})[0].kind,"plan");
 assert.equal(nextSteps({...base,now:monday,timeZone:"not-a-zone",plan})[0].kind,"plan");
});
test("P4 : une ancienne séance et une séance à sept étapes restent relisibles",()=>{
 const original={id:"session",day:sessionDay(now),startedAt:now,activeMs:0,resumedAt:now,steps:["triage","followups","sources","validation"],current:0,initial:sessionSnapshot([],[],[]),sent:[],paused:true};
 assert.deepEqual(readSession(JSON.stringify(original),now),original);
 const seven={...original,steps:["interview","followups","triage","plan","care","setting","sources"]};
 assert.deepEqual(readSession(JSON.stringify(seven),now),seven);
 assert.equal(readSession(JSON.stringify({...seven,steps:[...seven.steps,"unknown"]}),now),null);
});

test("P4 : une préparation confirmée pendant la séance compte une fois, sans reconstruire une ancienne séance",()=>{
 const value={id:"care-session",day:sessionDay(now),startedAt:now,activeMs:0,resumedAt:now,steps:["care"],current:0,initial:sessionSnapshot([],[],[],{chosen:2}),sent:[],paused:false};
 assert.deepEqual(continuitySession({...value,privateNote:"PRIVATE_TEXT"},new Date(now)).initial.care,{chosen:2});
 assert.doesNotMatch(JSON.stringify(continuitySession({...value,privateNote:"PRIVATE_TEXT"},new Date(now))),/PRIVATE_TEXT/);
 assert.equal(sessionProgress(value,[],[],[],now,{chosen:2}).total,0);
 assert.equal(sessionProgress(value,[],[],[],now,{chosen:3}).cared,1);
 assert.equal(sessionProgress(value,[],[],[],now,{chosen:4}).cared,1);
 assert.equal(sessionProgress({...value,initial:sessionSnapshot([],[],[])},[],[],[],now,{chosen:3}).cared,undefined);
 for(const care of [{chosen:5},{chosen:-1},{chosen:1.5},{chosen:"3"}])assert.equal(readSession(JSON.stringify({...value,initial:{...value.initial,care}}),now),null);
});
