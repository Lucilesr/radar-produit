import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import ts from "typescript";
const modules=new Map();
function moduleUrl(file){
 if(modules.has(file.href))return modules.get(file.href);
 let code=ts.transpileModule(readFileSync(file,"utf8"),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
 code=code.replace(/(from\s+|import\s*)["'](\.[^"']+)["']/g,(_,prefix,path)=>prefix+JSON.stringify(moduleUrl(new URL(path.endsWith(".ts")?path:path+".ts",file))));
 const url="data:text/javascript;base64,"+Buffer.from(code).toString("base64");modules.set(file.href,url);return url;
}
const {todayStepLabel}=await import(moduleUrl(new URL("../lib/today-presentation.ts",import.meta.url)));
const {demoTodayInitialState}=await import(moduleUrl(new URL("../lib/demo-today.ts",import.meta.url)));
const {demoScenario,demoAutoScan}=await import(moduleUrl(new URL("../lib/demo-scenarios.ts",import.meta.url)));
test("Aujourd’hui : décrire le lot réel sans compter une fiche incomplète comme très proche",()=>{
 const step={kind:"triage",label:"Trier",minutes:3,action:{type:"triage"}},lot={remaining:[{id:"a",fitLabel:"very_close"},{id:"b",fit:100},{id:"c",fitLabel:"to_weigh"}]},before=structuredClone(lot);
 assert.equal(todayStepLabel(step,lot),"Trier votre lot du jour : 3 offres, dont 1 très proche");
 assert.equal(todayStepLabel(step,{remaining:[{id:"b",fit:100}]}),"Trier votre lot du jour : 1 offre");
 assert.equal(todayStepLabel(step,null),"Trier");assert.deepEqual(lot,before);assert.equal(step.minutes,3);
});
test("Aujourd’hui : conserver le thème d’entretien choisi par le classement",()=>{
 const step={kind:"interview",label:"Préparer",action:{type:"story",theme:"prioriser",jobId:"job"}};
 assert.match(todayStepLabel(step),/Prioriser/);assert.equal(step.action.theme,"prioriser");
 assert.equal(todayStepLabel({...step,action:{type:"story",theme:"unknown"}}),"Préparer");
});
test("Aujourd’hui : une démonstration de panne ou chargement ne modifie jamais un compte réel ni les données",()=>{
 const state={jobs:[{id:"preserved"}],profile:{headline:"Privé"},errors:{jobs:false,profile:false}},before=structuredClone(state);
 for(const mode of ["today-error","today-loading"])assert.equal(demoTodayInitialState("owner",mode,state),state);
 assert.deepEqual(demoTodayInitialState("demo:fiction","today-error",state),{...state,errors:{jobs:true,profile:false}});
 assert.equal(demoTodayInitialState("demo:fiction","today-loading",state),undefined);
 assert.equal(demoTodayInitialState("demo:fiction","today-interview",state),state);assert.deepEqual(state,before);
});
test("Aujourd’hui : seuls les scénarios explicites autorisent un balayage automatique fictif",()=>{
 for(const mode of ["today-error","today-loading","today-interview"]){assert.equal(demoScenario(mode),mode);assert.equal(demoAutoScan(mode),false);}
 assert.equal(demoAutoScan("today-partial"),true);assert.equal(demoAutoScan("unknown"),false);
});
