import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
const compiled = ts.transpileModule(readFileSync(new URL("../lib/triage-learning.ts",import.meta.url),"utf8"),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {triageSuggestions,suggestionPreferences,rememberTriageDismissal,normalizeTriageDismissals,triageShortcut}=await import("data:text/javascript;base64,"+Buffer.from(compiled).toString("base64"));
const now=Date.UTC(2026,10,7,12), day=86400000;
const search={roles:["Product Owner"],contracts:["cdi","freelance"],remote:"hybrid",remoteByContract:{freelance:"full_remote"},excludeKeywords:[],excludeSources:[]};
const job=(i,extra={})=>({id:`fictif-${i}`,title:"Product Owner",source:"Source fictive",contractType:"cdi",remoteMode:"hybrid",onsiteDaysPerWeek:3,deletedAt:new Date(now-2*day).toISOString(),...extra});
const pool=Array.from({length:4},(_,i)=>job(i));
test("Q1d : seuil de quatre faits communs, pas de raison inventée",()=>{
 assert.equal(triageSuggestions(pool.slice(0,3),search,{},now).length,0);
 const suggestions=triageSuggestions(pool,search,{},now);
 assert.deepEqual(suggestions.map(s=>s.kind),["presence","contract","title","source"]);
 assert.ok(suggestions.every(s=>s.count===4));
 assert.equal(triageSuggestions([...pool.slice(0,3),pool[0]],search,{},now).length,0);
});
test("Q1d : seules les décisions des sept derniers jours, hors annonces pourvues",()=>{
 for(const extra of [{deletedAt:undefined},{deletedAt:"invalide"},{deletedAt:new Date(now+1).toISOString()},{deletedAt:new Date(now-7*day-1).toISOString()},{dismissalReason:"filled"},{dismissalReason:"applications_closed"}])
  assert.equal(triageSuggestions([...pool.slice(0,3),job(3,extra)],search,{},now).length,0);
 assert.equal(triageSuggestions([...pool.slice(0,3),job(3,{deletedAt:new Date(now-7*day).toISOString()})],search,{},now)[0].count,4);
});
test("Q1d : Non merci masque exactement cette proposition pendant trente jours",()=>{
 const first=triageSuggestions(pool,search,{},now)[0];
 const dismissed=rememberTriageDismissal({},first.key,now);
 assert.ok(!triageSuggestions(pool,search,dismissed,now+day).some(s=>s.key===first.key));
 assert.equal(triageSuggestions(pool,search,dismissed,now).find(s=>s.kind==="contract").count,4);
 const recent=pool.map(j=>({...j,deletedAt:new Date(now+30*day-day).toISOString()}));
 assert.ok(triageSuggestions(recent,search,dismissed,now+30*day).some(s=>s.key===first.key));
 assert.equal(Object.keys(rememberTriageDismissal(Object.fromEntries(Array.from({length:80},(_,i)=>[`source:${i}`,new Date(now).toISOString()])),first.key,now)).length,60);
});
test("Q1d : préremplir ne modifie pas les critères et chaque proposition ne touche que son champ",()=>{
 const before=JSON.stringify(search),suggestions=triageSuggestions(pool,search,{},now);
 for(const s of suggestions){const next=suggestionPreferences(s,search);assert.equal(JSON.stringify(search),before);assert.deepEqual(next.roles,search.roles);}
 const presence=suggestionPreferences(suggestions[0],search);assert.equal(presence.remoteByContract.cdi,"exceptional");assert.equal(presence.remoteByContract.freelance,"full_remote");
 assert.deepEqual(suggestionPreferences(suggestions[1],search).contracts,["freelance"]);
 assert.deepEqual(suggestionPreferences(suggestions[2],search).excludeKeywords,["Product Owner"]);
 assert.deepEqual(suggestionPreferences(suggestions[3],search).excludeSources,["Source fictive"]);
 assert.ok(!triageSuggestions(pool,{...search,contracts:["cdi"],remote:"full_remote",excludeSources:["Source fictive"],excludeKeywords:["Product Owner"]},{},now).length);
});
test("Q1d : S/L/X sur une offre ouverte, jamais pendant la saisie ou une commande modifiée",()=>{
 const context={open:true,editing:false};
 assert.equal(triageShortcut("s",context),"selected");assert.equal(triageShortcut("L",context),"later");assert.equal(triageShortcut("x",context),"discard");
 for(const override of [{open:false},{editing:true},{disabled:true},{modifier:true},{repeat:true}])assert.equal(triageShortcut("s",{...context,...override}),null);
 assert.equal(triageShortcut("Enter",context),null);
});

test("Q1d : les refus malformés ne cassent pas le profil et le nouveau refus reste parmi les soixante",()=>{
 assert.deepEqual(normalizeTriageDismissals(null,now),{});assert.deepEqual(normalizeTriageDismissals(["2026-11-07"],now),{});
 assert.deepEqual(normalizeTriageDismissals({"source:a":1,"source:b":{},"source:c":"invalide","source:d":new Date(now+day).toISOString()},now),{});
 const previous=Object.fromEntries(Array.from({length:80},(_,i)=>[`source:${i}`,new Date(now).toISOString()]));
 assert.ok(rememberTriageDismissal(previous,"source:nouveau",now)["source:nouveau"]);
});
