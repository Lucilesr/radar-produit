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

const rules=await import(moduleUrl("lib/celebrations.ts"));
const event=(id="one")=>({kind:"application_sent",objectId:id,stamp:"2026-11-07T10:00:00Z"});
const empty={lastAt:0,seen:[]},now=Date.parse("2026-11-07T10:00Z");
test("Q6 : seules les actions prévues sont éligibles, aucun refus ni tri",()=>{
 for(const kind of ["rejected","discarded","selected","source_visited","unknown"])assert.equal(rules.progressEvent({...event(),kind}),null);
 assert.equal(rules.celebrationDraw("alice","celebrations",.9),.9);assert.equal(rules.celebrationDraw("demo:example","celebrations",.9),0);assert.equal(rules.celebrationDraw("demo:example","full",.9),.9);
 assert.deepEqual(rules.progressEvent(event()),event());assert.equal(rules.progressEvent({...event(),objectId:"x".repeat(101)}),null);assert.equal(rules.progressEvent(null),null);
});
test("Q6 : probabilité d’un tiers, borne et au plus un encouragement par heure",()=>{
 assert.equal(rules.celebrationDecision(event(),empty,{},now,0).accepted,true);assert.equal(rules.celebrationDecision(event(),empty,{},now,1/3).accepted,false);assert.equal(rules.celebrationDecision(event(),empty,{},now,1/3-.00001).accepted,true);
 for(const draw of [-1,1,NaN,Infinity])assert.equal(rules.celebrationDecision(event(),empty,{},now,draw).accepted,false);
 const first=rules.celebrationDecision(event(),empty,{},now,0).state;
 assert.equal(rules.celebrationDecision(event("two"),first,{},now+3599999,0).accepted,false);assert.equal(rules.celebrationDecision(event("two"),first,{},now+3600000,0).accepted,true);
 assert.equal(rules.celebrationDecision(event(),first,{},now+3600000,0).duplicate,true);
});
test("Q6 : une action sans surprise n’est pas rejouée, réglages et reçus bornés",()=>{
 const lost=rules.celebrationDecision(event(),empty,{},now,.9).state;assert.equal(rules.celebrationDecision(event(),lost,{},now,0).accepted,false);
 for(const prefs of [{reducedMotion:true},{celebrations:false}])assert.equal(rules.celebrationDecision(event(),empty,prefs,now,0).accepted,false);
 assert.throws(()=>rules.preferencePatch({triageShortcuts:"yes"}));assert.throws(()=>rules.preferencePatch({lastAt:0}));assert.deepEqual(rules.preferencePatch({reducedMotion:true,celebrations:false}),{reducedMotion:true,celebrations:false});
 const state=rules.normalizeCelebrationState({lastAt:now,seen:Array.from({length:700},(_,i)=>({id:String(i),at:now}))},now);assert.equal(state.seen.length,499);assert.equal(rules.celebrationDecision(event(),state,{},now,0).state.seen.length,500);
});
test("Q6 SQLite : quota entre appareils, preuve propriétaire, refus exclus et réglages conservés",async()=>{
 const sqlite=new DatabaseSync(":memory:");for(const file of readdirSync(resolve(root,"drizzle")).filter(f=>f.endsWith(".sql")).sort())sqlite.exec(readFileSync(resolve(root,"drizzle",file),"utf8"));
 function prepare(sql){let args=[];return {bind(...values){args=values;return this;},async first(){return sqlite.prepare(sql).get(...args)??null;},async all(){return {results:sqlite.prepare(sql).all(...args)};},async raw(){const stmt=sqlite.prepare(sql);stmt.setReturnArrays(true);return stmt.all(...args);},async run(){const result=sqlite.prepare(sql).run(...args);return {...result,meta:{changes:Number(result.changes)}};}};}
 globalThis.__trashEnv={DB:{prepare}};
 const store=await import(moduleUrl("lib/preferences-store.ts"));
 const plan={week:"2026-W45",timeZone:"Europe/Paris",rhythm:"calm",commitments:[{id:"c1",doneAt:"now"},{id:"c2",doneAt:"now"}]};
 sqlite.prepare("INSERT INTO profiles(user_id,data) VALUES(?,?)").run("alice",JSON.stringify({headline:"Profil à conserver",weekPlan:plan,weekPlanRevision:4,preferences:{triageShortcuts:true,unknownFuture:true}}));
 for(const id of ["one","two","three","four"])sqlite.prepare("INSERT INTO jobs(id,user_id,fingerprint,title,status,applied_at) VALUES(?,?,?,?,?,?)").run(id,"alice",id,"Poste fictif","applied",event().stamp);
 assert.equal((await store.claimCelebration("alice",event("missing"),now,0)).accepted,false);assert.equal((await store.claimCelebration("bob",event(),now,0)).accepted,false);
 const parallel=await Promise.all([store.claimCelebration("alice",event(),now,0),store.claimCelebration("alice",event("two"),now,0)]);assert.equal(parallel.filter(item=>item.accepted).length,1,"quota commun aux deux appareils");
 assert.equal((await store.claimCelebration("alice",event(),now+3600000,0)).accepted,false,"reçu idempotent");
 assert.equal((await store.claimCelebration("alice",event("three"),now+3600000,0)).accepted,true);
 await Promise.all([store.writePreferences("alice",{reducedMotion:true,celebrations:false}),store.writePreferences("alice",{triageShortcuts:false})]);let prefs=await store.readPreferences("alice");assert.equal(prefs.reducedMotion,true);assert.equal(prefs.triageShortcuts,false);assert.equal(prefs.unknownFuture,true);
 assert.equal((await store.claimCelebration("alice",event("four"),now+7200000,0)).accepted,false);
 const profile=await import(moduleUrl("app/api/profile/route.ts"));globalThis.__trashUser="alice";assert.equal((await profile.POST(new Request("https://radar.test/api/profile",{method:"POST",body:JSON.stringify({headline:"Autre titre",preferences:{reducedMotion:false,triageShortcuts:true},celebrationState:{lastAt:0}})}))).status,200);
 const stored=JSON.parse(sqlite.prepare("SELECT data FROM profiles WHERE user_id='alice'").get().data);assert.equal(stored.preferences.reducedMotion,true);assert.equal(stored.celebrationState.lastAt,now+3600000);assert.equal(stored.weekPlanRevision,4);assert.deepEqual(stored.weekPlan,plan);
 await store.writePreferences("alice",{reducedMotion:false,celebrations:true});
 sqlite.prepare("UPDATE jobs SET status='rejected' WHERE id='four'").run();assert.equal((await store.claimCelebration("alice",event("four"),now+7200000,0)).accepted,false);
 sqlite.prepare("INSERT INTO interviews(id,user_id,job_id,label,start_at,end_at,time_zone,state,data,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)").run("interview","alice","one","Échange fictif","2026-11-01T10:00Z","2026-11-01T11:00Z","Europe/Paris","reviewed",JSON.stringify({summary:"Un apprentissage",outcome:"rejected",followUpAt:event().stamp}),event().stamp);
 assert.equal((await store.claimCelebration("alice",{kind:"interview_review",objectId:"interview",stamp:event().stamp},now+7200000,0)).accepted,false,"pas de surprise après un refus");
 sqlite.prepare("UPDATE interviews SET data=? WHERE id='interview'").run(JSON.stringify({summary:"Un apprentissage",outcome:"waiting",followUpAt:event().stamp}));
 assert.equal((await store.claimCelebration("alice",{kind:"interview_review",objectId:"interview",stamp:event().stamp},now+7200000,0)).accepted,true);
 assert.equal((await store.claimCelebration("alice",{kind:"followup_done",objectId:"interview",stamp:event().stamp},now+10800000,0)).accepted,true);
 assert.equal((await store.claimCelebration("alice",{kind:"week_held",objectId:plan.week,stamp:plan.week},now+14400000,0)).accepted,true);
 const route=await import(moduleUrl("app/api/preferences/route.ts"));globalThis.__trashUser=null;assert.equal((await route.GET()).status,401);globalThis.__trashUser="alice";assert.equal((await route.PATCH(new Request("https://radar.test/api/preferences",{method:"PATCH",headers:{Origin:"https://evil.test"},body:"{}"}))).status,403);
 sqlite.close();
});
