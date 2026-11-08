import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url));
const dataUrl = code => "data:text/javascript;base64," + Buffer.from(code).toString("base64");
const cache = new Map();
function moduleUrl(file) {
  file = resolve(root, file);
  if (cache.has(file)) return cache.get(file);
  let code = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  code = code.replace(/from "([^"]+)"/g, (_, spec) => {
    let target;
    if (spec === "cloudflare:workers") target = dataUrl("export const env = globalThis.__trashEnv;");
    else if (spec === "@/app/chatgpt-auth") target = dataUrl("export async function getChatGPTUser(){return globalThis.__trashUser ? {userId:globalThis.__trashUser}:null;}");
    else if (spec.startsWith(".") || spec.startsWith("@/")) {
      let path = spec.startsWith("@/") ? resolve(root, spec.slice(2)) : resolve(dirname(file), spec);
      if (spec === "@/db") path += "/index";
      target = moduleUrl(path + ".ts");
    } else target = import.meta.resolve(spec);
    return `from ${JSON.stringify(target)}`;
  });
  const url = dataUrl(code); cache.set(file, url); return url;
}


const prompts=await import(moduleUrl("lib/contextual-prompts.ts"));
const engine=await import(moduleUrl("lib/next-steps.ts"));
const prefs=await import(moduleUrl("lib/search-preferences.ts"));
const criteria=await import(moduleUrl("lib/search-criteria.ts"));
const reach=await import(moduleUrl("lib/radar-reach.ts"));
const now=Date.parse("2026-11-08T10:00:00Z"),delay=prompts.promptDelay;
const job=(id,title="Senior Product Owner",extra={})=>({id,title,status:"new",...extra});
test("P7 : Plus tard dure sept jours exactement, lire ne prolonge rien",()=>{
 const original={later:{"lesson:old":"invalid"}},copy=structuredClone(original),state=prompts.postponePrompt(original,"level",now);
 assert.deepEqual(original,copy);assert.equal(Date.parse(state.later.level),now+delay);
 assert.equal(prompts.promptVisible(state,"level",now+delay-1),false);
 assert.equal(prompts.promptVisible(state,"level",now+delay),true);
 assert.deepEqual(prompts.readPromptState(state,now+1000),state);
 for(const key of ["__proto__","unknown","terms:","source:\n", "x".repeat(201)])assert.throws(()=>prompts.postponePrompt({},key,now));
 assert.deepEqual(prompts.readPromptState({later:{"level":"invalid",unknown:new Date(now+delay).toISOString()}},now),{later:{}});
});
test("P7 : niveau proposé seulement dans un lot Senior/Lead, jamais préenregistré",()=>{
 const input={context:"offers",now,lot:{size:1,remaining:[job("one")]},levelSet:false};
 assert.equal(engine.nextContextualStep(input).kind,"level");
 for(const changed of [{levelSet:true},{lot:{size:0,remaining:[job("one")]}},{lot:{size:1,remaining:[job("one","Junior PM")]}},{lot:null}])assert.equal(engine.nextContextualStep({...input,...changed}),null);
 const pending=prompts.postponePrompt({},"level",now);
 assert.equal(engine.nextContextualStep({...input,prompts:pending}),null);
 assert.equal(engine.nextContextualStep({...input,prompts:pending,now:now+delay}).kind,"level");
 assert.equal(input.levelSet,false);
});
test("P7 : entretien planifié, thème restant et masquage propre à chaque entretien",()=>{
 const event=(id,offset,state="planned")=>({id,startAt:new Date(now+offset).toISOString(),endAt:new Date(now+offset+3600000).toISOString(),state});
 const jobs=[job("cancelled","PM",{status:"interview",interviews:[event("x",1000,"cancelled")]}),job("later","PM",{status:"interview",interviews:[event("b",6*86400000)]}),job("first","PM",{status:"interview",interviews:[event("a",86400000)]})];
 const input={context:"interviews",now,jobs,doneThemes:["prioriser"]};
 assert.equal(engine.nextContextualStep(input).key,"interview:a");
 assert.notEqual(engine.nextContextualStep(input).action.theme,"prioriser");
 assert.equal(engine.nextContextualStep({...input,prompts:prompts.postponePrompt({},"interview:a",now)}).key,"interview:b");
 assert.equal(engine.nextContextualStep({...input,jobs:[]}),null);
});
test("P7 : une visite proposée uniquement après le lot, depuis la file P4",()=>{
 const queue=[{id:"manual",kind:"sources",action:{type:"source",source:"Source fictive"}}],sources=[{source:"Source fictive",lastVisitedAt:new Date(now-9*86400000).toISOString()}];
 const input={context:"offers",now,queue,sources,lot:{size:20,remaining:[]}};
 assert.match(engine.nextContextualStep(input).label,/9 jours sans visite/);
 assert.equal(engine.nextContextualStep({...input,queue:[]}),null);
 assert.equal(engine.nextContextualStep({...input,lot:{size:20,remaining:[job("junior","Junior PM")]}}),null);
 assert.equal(engine.nextContextualStep({...input,prompts:prompts.postponePrompt({},"source:Source fictive",now)}),null);
 assert.equal(engine.nextContextualStep({context:"lesson",objectId:"lesson-1",now}).action.type,"story");
 assert.equal(engine.nextContextualStep({context:"terms",objectId:"experience-1",now}).key,"terms:experience-1");
});
test("P7 : P4 respecte les mêmes choix, sans retirer le tri prioritaire",()=>{
 const event={id:"meeting",state:"planned",startAt:new Date(now+1000).toISOString(),endAt:new Date(now+3600000).toISOString()};
 let state=prompts.postponePrompt({},"interview:meeting",now);state=prompts.postponePrompt(state,"level",now);state=prompts.postponePrompt(state,"source:first",now);
 const input={now,timeZone:"UTC",jobs:[job("meeting","PM",{status:"interview",interviews:[event]})],lotRemaining:2,plan:{week:"2026-W45"},reach:{next:{kind:"level",label:"Niveau",minutes:1},doneThemes:[]},sources:[{source:"first"},{source:"second"}],modeOf:()=>"web",prompts:state};
 const steps=engine.nextSteps(input);assert.equal(steps[0].kind,"triage");assert(!steps.some(step=>["interview","setting"].includes(step.kind)));assert.equal(steps.at(-1).action.source,"second");
});
test("P7 : Peu importe est un choix explicite modifiable, sans niveau fictif pour le score",()=>{
 const search=prefs.searchPreferences({roles:["Product Owner"],targetLevelAny:true});
 assert.equal(search.targetLevel,undefined);assert.equal(search.targetLevelAny,true);
 assert.equal(prefs.searchPreferences({...search,targetLevel:"senior"}).targetLevelAny,undefined);
 assert.equal(criteria.criteriaGroups(search).flatMap(group=>group.rows).find(row=>row.id==="level").values[0],"Peu importe");
 assert(!criteria.missingCriteria(search).some(row=>row.id==="level"));
 assert.equal(reach.radarReach({roles:["Product Owner"],targetLevelAny:true,sources:[],facts:[],modeOf:()=>"web"}).level,true);
});
test("P7 SQLite : choix privés, concurrence, profil ancien et niveaux atomiques",async()=>{
 const sqlite=new DatabaseSync(":memory:");for(const file of readdirSync(resolve(root,"drizzle")).filter(f=>f.endsWith(".sql")).sort())sqlite.exec(readFileSync(resolve(root,"drizzle",file),"utf8"));
 let concurrent=false;
 function prepare(sql){let args=[];return {bind(...values){args=values;return this;},async first(){return sqlite.prepare(sql).get(...args)??null;},async all(){return {results:sqlite.prepare(sql).all(...args)};},async raw(){const stmt=sqlite.prepare(sql);stmt.setReturnArrays(true);return stmt.all(...args);},async run(){if(concurrent&&sql.startsWith("UPDATE profiles SET data=json_set(data,'$.contextualPrompts'")){concurrent=false;sqlite.prepare("UPDATE profiles SET data=json_set(data,'$.weekPlanRevision',8) WHERE user_id='alice'").run();}const result=sqlite.prepare(sql).run(...args);return {...result,meta:{changes:Number(result.changes)}};}};}
 globalThis.__trashEnv={DB:{prepare}};
 sqlite.prepare("INSERT INTO profiles(user_id,data) VALUES(?,?)").run("alice",JSON.stringify({headline:"Compte fictif",preferences:{reducedMotion:true},searchPreferences:{roles:["Product Owner"],domainTerms:["SaaS"]},weekPlanRevision:4}));
 const store=await import(moduleUrl("lib/contextual-prompts-store.ts")),route=await import(moduleUrl("app/api/contextual-prompts/route.ts")),profile=await import(moduleUrl("app/api/profile/route.ts"));
 concurrent=true;await store.writeContextualPrompt("alice",{action:"later",key:"level"});
 let raw=JSON.parse(sqlite.prepare("SELECT data FROM profiles WHERE user_id='alice'").get().data);
 assert.equal(raw.weekPlanRevision,8);assert.equal(raw.preferences.reducedMotion,true);assert.deepEqual(raw.searchPreferences.domainTerms,["SaaS"]);
 const expiry=raw.contextualPrompts.later.level;
 globalThis.__trashUser="alice";assert.equal((await profile.POST(new Request("https://radar.test/api/profile",{method:"POST",body:JSON.stringify({headline:"Profil fictif modifié",contextualPrompts:{later:{}},searchPreferences:{roles:["Product Owner"]}})}))).status,200);
 assert.equal((await store.readContextualPrompts("alice")).state.later.level,expiry,"un ancien formulaire ne rétablit pas la proposition");
 await Promise.all([store.writeContextualPrompt("alice",{action:"later",key:"lesson:first"}),store.writeContextualPrompt("alice",{action:"later",key:"terms:experience"})]);
 assert.equal(Object.keys((await store.readContextualPrompts("alice")).state.later).length,3);
 assert.deepEqual((await store.readContextualPrompts("bob")).state,{later:{}});
 assert.equal((await store.writeContextualPrompt("alice",{action:"level",level:"any"})).searchPreferences.targetLevelAny,true);
 await assert.rejects(()=>store.writeContextualPrompt("alice",{action:"level",level:"senior"}),store.PromptConflict);
 assert.equal((await store.readContextualPrompts("alice")).searchPreferences.targetLevel,undefined);
 await assert.rejects(()=>store.writeContextualPrompt("bob",{action:"level",level:"invalid"}),/niveau/);
 await assert.rejects(()=>store.writeContextualPrompt("bob",{action:"later",key:"arbitrary"}),/invalide/);
 globalThis.__trashUser=null;assert.equal((await route.GET()).status,401);
 globalThis.__trashUser="alice";assert.equal((await route.POST(new Request("https://radar.test/api/contextual-prompts",{method:"POST",headers:{Origin:"https://evil.test"},body:"{}"}))).status,403);
 assert.equal((await route.POST(new Request("https://radar.test/api/contextual-prompts",{method:"POST",body:JSON.stringify({action:"level",level:"lead"})}))).status,409);
 sqlite.close();
});
