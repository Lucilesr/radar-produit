import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import ts from "typescript";
const code=ts.transpileModule(readFileSync(new URL("../lib/radar-reach.ts",import.meta.url),"utf8"),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {radarReach,interviewThemes,isInterviewStory}=await import("data:text/javascript;base64,"+Buffer.from(code).toString("base64"));
const fact=(id,kind="experience",extra={})=>({id,kind,parentId:null,validation:"approved",data:{title:id,context:"Contexte documenté",contribution:"Action personnelle",result:"Effet observé",claimKey:""},...extra});
const base={roles:[],sources:[],facts:[],modeOf:name=>name==="unknown"?undefined:name==="feed"?"rss":"web"};
test("Q4 : compte neuf à zéro, premier choix réel et aucune fonction bloquée",()=>{
 const reach=radarReach(base);assert.equal(reach.points,0);assert.equal(reach.label,"Votre radar s’allume");assert.equal(reach.next.kind,"criteria");
 assert.equal(radarReach({...base,roles:["Product Owner"]}).points,2);assert.equal(radarReach({...base,roles:[" "]}).points,0);
});
test("Q4 : les dix crans créditent les informations déjà validées",()=>{
 const full={...base,roles:["Product Owner"],targetLevel:"senior",sources:[{source:"a",lastVisitedAt:"2026-11-07"},{source:"b"},{source:"feed"}],facts:[fact("e1"),fact("e2"),...interviewThemes.slice(0,4).map(theme=>fact(theme.id,"fact",{data:{...fact("x").data,claimKey:`interview-story:${theme.id}`}}))]};
 const reach=radarReach(full);assert.equal(reach.points,10);assert.equal(reach.label,"Précision atteinte");assert.equal(reach.next,null);assert.equal(reach.doneThemes.length,4);
 assert.equal(radarReach({...full,facts:full.facts.slice(0,2),sources:full.sources.map(({source})=>({source}))}).points,7);
});
test("Q4 : suggestions, pauses, désactivation et doublons ne créent pas de portée",()=>{
 const sources=[{source:"a"},{source:"a"},{source:"b",state:"paused"},{source:"c",selected:false},{source:"unknown"}];
 const reach=radarReach({...base,sources});assert.equal(reach.activeSources,1);assert.equal(reach.points,0);
 const visited=radarReach({...base,sources:[{source:"feed",lastVisitedAt:"2026-11-07"}]});assert.equal(visited.visited,false);
});
test("Q4 : seuls les récits personnels validés et leurs parents visibles comptent",()=>{
 const approved=fact("story","fact"),proposed={...approved,id:"pending",validation:"proposed"},hidden=fact("hidden","experience",{validation:"rejected"});
 const facts=[approved,approved,proposed,hidden,{...approved,id:"child",parentId:"hidden"},{...approved,id:"company",data:{...approved.data,contribution:""}}];
 const reach=radarReach({...base,facts});assert.equal(reach.stories,1);assert.equal(reach.experiences,0);assert.equal(isInterviewStory(proposed),false);
});
test("Q4 : une seule prochaine action et des seuils stables",()=>{
 let input={...base,roles:["Product Owner"],targetLevel:"senior"};assert.equal(radarReach(input).next.kind,"sources");
 input={...input,sources:[{source:"a"},{source:"b"},{source:"feed"}]};assert.equal(radarReach(input).next.kind,"visit");
 input={...input,sources:[{source:"a",lastVisitedAt:"2026-11-07"},{source:"b"},{source:"feed"}]};assert.equal(radarReach(input).next.kind,"experiences");
 input={...input,facts:[fact("e1"),fact("e2")]};assert.equal(radarReach(input).next.kind,"story");assert.equal(radarReach(input).stage,2);
});
