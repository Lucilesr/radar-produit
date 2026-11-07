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

const rules=await import(moduleUrl("lib/week-plan.ts"));
const now=new Date("2026-11-04T10:00:00Z");
const plan=(week="2026-W45")=>({week,timeZone:"Europe/Paris",rhythm:"calm",commitments:[{id:"a",when:week==="2026-W45"?"2026-11-04T10:00":"2026-11-11T10:00",action:"write",targetId:"prioriser",targetType:"story",label:"Prioriser"},{id:"b",when:week==="2026-W45"?"2026-11-05T10:00":"2026-11-12T10:00",action:"review",label:"Relire ma semaine"}]});
test("Q5 : semaine ISO, changement d’année et fuseau près du lundi",()=>{
 assert.equal(rules.weekKey(new Date("2021-01-01Z")),"2020-W53");assert.equal(rules.weekKey(new Date("2026-11-08T21:00Z"),"Indian/Mauritius"),"2026-W46");assert.equal(rules.weekKey(new Date("2026-11-08T21:00Z"),"Europe/Paris"),"2026-W45");
 assert.equal(rules.weekKey(new Date("2026-03-29T22:30Z"),"Europe/Paris"),"2026-W14");
 assert.equal(rules.localTimeInZone(new Date("2026-11-08T21:00Z"),"Indian/Mauritius"),"2026-11-09T01:00");
});
test("Q5 : rythme complet, dates et actions fermées sans coche fabriquée",()=>{
 const original=plan();original.commitments[0].doneAt="inventé";assert.equal(rules.validateWeekPlan(original,now).commitments[0].doneAt,undefined);
 for(const invalid of [{...plan(),rhythm:"unknown"},{...plan(),commitments:[]},{...plan(),timeZone:"Mars"},{...plan(),week:"2026-W46"}])assert.throws(()=>rules.validateWeekPlan(invalid,now));
 for(const change of [{when:"2026-11-09T10:00"},{when:"2026-11-04T25:00"},{action:"send-email"},{label:" "},{id:"b"}]){const value=plan();Object.assign(value.commitments[0],change);assert.throws(()=>rules.validateWeekPlan(value,now));}
});
test("Q5 : déplacer conserve le progrès, changer d’action ou de cible retire la coche",()=>{
 const old=plan();old.commitments[0].doneAt=now.toISOString();let next=plan();next.commitments[0].when="2026-11-06T10:00";assert.equal(rules.carryDone(old,next).commitments[0].doneAt,now.toISOString());
 next.commitments[0].label="Une autre histoire";assert.equal(rules.carryDone(old,next).commitments[0].doneAt,undefined);
 assert.equal(rules.planHeld(null),false);assert.equal(rules.planHeld({...old,commitments:[]}),false);assert.equal(rules.planHeld(old),false);old.commitments[1].doneAt=now.toISOString();assert.equal(rules.planHeld(old),true);
 assert.equal(rules.commitmentOverdue(plan().commitments[0],"2026-11-04T11:00"),true);assert.equal(rules.commitmentOverdue(old.commitments[0],"2026-11-04T11:00"),false);
});
test("Q5 : historique non perdu et sans doublon lors d’une nouvelle semaine",()=>{
 const old=plan(),next=plan("2026-W46");assert.deepEqual(rules.archivePlan([],old,old),[]);assert.deepEqual(rules.archivePlan([old],old,next),[old]);
});
test("Q5 SQLite : confirmation, reprise idempotente, concurrence, isolation et profil conservé",async()=>{
 const sqlite=new DatabaseSync(":memory:");for(const file of readdirSync(resolve(root,"drizzle")).filter(f=>f.endsWith(".sql")).sort())sqlite.exec(readFileSync(resolve(root,"drizzle",file),"utf8"));
 function prepare(sql){let args=[];return {bind(...values){args=values;return this;},execute(){const results=sqlite.prepare(sql).all(...args);return {success:true,results};},async first(){return sqlite.prepare(sql).get(...args)??null;},async all(){return {results:sqlite.prepare(sql).all(...args)};},async raw(){const stmt=sqlite.prepare(sql);stmt.setReturnArrays(true);return stmt.all(...args);},async run(){const result=sqlite.prepare(sql).run(...args);return {...result,meta:{changes:Number(result.changes)}};}};}
 globalThis.__trashEnv={DB:{prepare,async batch(statements){sqlite.exec("BEGIN");try{const results=statements.map(statement=>statement.execute());sqlite.exec("COMMIT");return results;}catch(error){sqlite.exec("ROLLBACK");throw error;}}}};
 const store=await import(moduleUrl("lib/week-plan-store.ts"));
 const route=await import(moduleUrl("app/api/week-plan/route.ts"));globalThis.__trashUser=null;assert.equal((await route.GET()).status,401);globalThis.__trashUser="alice";assert.equal((await route.PUT(new Request("https://radar.test/api/week-plan",{method:"PUT",headers:{Origin:"https://evil.test"},body:"{}"}))).status,403);
 sqlite.prepare("INSERT INTO profiles(user_id,data) VALUES(?,?)").run("alice",JSON.stringify({headline:"Profil privé",preferences:{reducedMotion:true},applicationNotes:{one:"Note conservée"}}));
 assert.equal((await store.readWeekPlan("alice")).version,0);
 let saved=await store.writeWeekPlan("alice",{version:0,plan:plan()},now);assert.equal(saved.version,1);
 assert.equal((await store.writeWeekPlan("alice",{version:0,plan:plan()},now)).version,1,"réessai sans double écriture");
 assert.equal((await store.readWeekPlan("bob")).plan,null);
 saved=await store.writeWeekPlan("alice",{version:1,id:"a",done:true},now);assert.equal(saved.plan.commitments[0].doneAt,now.toISOString());
 assert.equal((await store.writeWeekPlan("alice",{version:1,id:"a",done:true},now)).version,2);
 await assert.rejects(()=>store.writeWeekPlan("alice",{version:1,id:"b",done:true},now),store.WeekPlanConflict);
 await assert.rejects(()=>store.writeWeekPlan("bob",{version:2,id:"a",done:true},now));
 saved=await store.writeWeekPlan("alice",{version:2,id:"b",done:true},now);assert(rules.planHeld(saved.plan));
 const data=JSON.parse(sqlite.prepare("SELECT data FROM profiles WHERE user_id='alice'").get().data);assert.equal(data.headline,"Profil privé");assert.equal(data.applicationNotes.one,"Note conservée");assert.equal(data.preferences.reducedMotion,true);
 const profile=await import(moduleUrl("app/api/profile/route.ts"));globalThis.__trashUser="alice";
 const response=await profile.POST(new Request("https://radar.test/api/profile",{method:"POST",body:JSON.stringify({headline:"Nouveau titre",weekPlan:null,weekPlans:[],weekPlanRevision:0})}));assert.equal(response.status,200);assert(rules.planHeld((await store.readWeekPlan("alice")).plan),"un formulaire de profil périmé ne décoche pas le plan");
 saved=await store.writeWeekPlan("alice",{version:3,plan:plan("2026-W46")},new Date("2026-11-11T10:00Z"));assert.equal(saved.history.length,1);assert(rules.planHeld(saved.history[0]));assert.equal(saved.plan.week,"2026-W46");
 await assert.rejects(()=>store.writeWeekPlan("alice",{version:4,id:"a",done:true},new Date("2026-11-18T10:00Z")));
 sqlite.close();
});
