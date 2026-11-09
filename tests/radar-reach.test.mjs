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

const presentationCode=ts.transpileModule(readFileSync(new URL("../lib/reach-presentation.ts",import.meta.url),"utf8"),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const presentation=await import("data:text/javascript;base64,"+Buffer.from(presentationCode).toString("base64"));
test("P2 : six réglages concrets dans trois groupes, sans modifier le calcul de portée",()=>{
 const reach=radarReach({...base,roles:["Product Owner"],facts:[fact("e1"),fact("e2")]});const before=structuredClone(reach),settings=presentation.reachSettings(reach);
 assert.equal(settings.length,6);assert.deepEqual([...new Set(settings.map(setting=>setting.group))],[0,1,2]);assert.equal(settings.filter(setting=>setting.done).length,2);assert.equal(reach.points,4);assert.deepEqual(reach,before);
 assert(settings.every(setting=>!/(?:cran|point)/i.test(setting.label+setting.effect)));assert.equal(settings.find(setting=>setting.kind===reach.next.kind).label,"Niveau visé");
});
test("P2 : libellés explicites, quatre paliers et complétude gardée à dix",()=>{
 assert.equal(presentation.reachTitle(0),"Votre radar est réglé à 0 sur 10");assert.equal(presentation.reachTitle(10),"Votre radar est réglé à 10 sur 10");assert.match(presentation.reachTitle(4,true),/connus/);
 assert.deepEqual(presentation.reachSegmentStops,[2,6,9,10]);assert.equal(presentation.reachSegmentStops.length,4);
 const full={...radarReach(base),criteria:true,level:true,activeSources:3,visited:true,experiences:2,interviewMaterial:4};assert(presentation.reachSettings(full).every(setting=>setting.done));
});
test("Précision : les réalisations détaillées et validées du carnet comptent sans réécrire d’histoire",()=>{
 const long="Contexte, choix et résultat détaillés dans le carnet. ".repeat(9);
 const job=fact("capsens"),example=n=>fact("ex"+n,"fact",{parentId:"capsens",data:{title:"Exemple "+n,context:long,contribution:"",result:"",claimKey:""}});
 const input={...base,roles:["Product Owner"],targetLevel:"senior",sources:[{source:"a",lastVisitedAt:"2026-11-07"},{source:"b"},{source:"feed"}],facts:[job,fact("steamulo"),...[1,2,3,4].map(example)]};
 const reach=radarReach(input);assert.equal(reach.points,10);assert.equal(reach.next,null);assert.equal(reach.doneThemes.length,0);
 assert.equal(reach.stories,0);assert.equal(presentation.reachSettings(reach).find(setting=>setting.kind==="story").done,true);
 // Short notes, unvalidated blocks or blocks under a hidden experience are not interview material.
 const short=example(5);short.data={...short.data,context:"Raison du départ"};
 const weak={...input,facts:[job,fact("steamulo"),short,{...example(6),validation:"proposed"},{...example(7),parentId:"ghost"},example(8)]};
 assert.equal(radarReach(weak).next.kind,"story");assert.match(radarReach(weak).next.label,/Préparez 3 histoires/);
});
