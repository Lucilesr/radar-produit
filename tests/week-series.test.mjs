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
    if (spec === "cloudflare:workers") target = dataUrl("export const env = {get DB(){return globalThis.__trashEnv.DB;}};");
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


const rules=await import(moduleUrl("lib/week-series.ts"));
function fixture(){
 const sqlite=new DatabaseSync(":memory:");for(const file of readdirSync(resolve(root,"drizzle")).filter(f=>f.endsWith(".sql")).sort())sqlite.exec(readFileSync(resolve(root,"drizzle",file),"utf8"));
 let hook=null;
 function prepare(sql){let args=[];return {bind(...values){assert(values.length<=100);args=values;return this;},execute(){const results=sqlite.prepare(sql).all(...args);return {success:true,results,meta:{changes:Number(sqlite.prepare("SELECT changes() n").get().n)}};},async all(){return this.execute();},async raw(){const stmt=sqlite.prepare(sql);stmt.setReturnArrays(true);return stmt.all(...args);},async first(){return sqlite.prepare(sql).get(...args)??null;},async run(){const result=sqlite.prepare(sql).run(...args);return {success:true,meta:{changes:Number(result.changes)}};}};}
 const db={prepare,async batch(statements){if(hook){const next=hook;hook=null;next();}sqlite.exec("BEGIN");try{const result=statements.map(s=>s.execute());sqlite.exec("COMMIT");return result;}catch(error){sqlite.exec("ROLLBACK");throw error;}}};globalThis.__trashEnv={DB:db};globalThis.__trashUser="alice";
 for(const user of ["alice","bob"])sqlite.prepare("INSERT INTO profiles(user_id,data) VALUES(?,?)").run(user,JSON.stringify({headline:"SECRET_PROFILE_"+user,preferences:{reducedMotion:true},searchPreferences:{roles:["Product Owner"]},applicationNotes:{}}));
 return {sqlite,hook(fn){hook=fn;},events(user="alice"){return sqlite.prepare("SELECT * FROM activity_events WHERE user_id=? ORDER BY created_at,id").all(user).map(row=>({...row,data:JSON.parse(row.data)}));}};
}
const now=key=>new Date(rules.weekMonday(key).getTime()+2*86400000+12*3600000);
function held(week,complete=true){return {week,timeZone:"Europe/Paris",rhythm:"calm",commitments:[{id:"a",when:week,label:"Privé",action:"review",doneAt:"2026-01-01T10:00:00Z"},{id:"b",when:week,label:"Privé",action:"write",...(complete?{doneAt:"2026-01-01T10:00:00Z"}:{})}]};}
const history=Array.from({length:4},(_,i)=>held(rules.shiftWeek("2026-W40",i)));
test("L2 : seules les semaines entièrement cochées comptent, la semaine ouverte ne casse rien",()=>{
 let value=rules.weekSeries({weekPlans:history,weekPlan:held("2026-W44",false)},now("2026-W44"));assert.equal(value.streak,4);assert.equal(value.heldTotal,4);assert.equal(value.jokers,1);assert.equal(value.weeks.at(-1).outcome,"open");
 value=rules.weekSeries({weekPlans:history,weekPlan:held("2026-W44")},now("2026-W44"));assert.equal(value.streak,5);assert.equal(value.heldTotal,5);
 assert.equal(rules.weekSeries({},now("2026-W44")).streak,0);
});
test("L2 : joker automatique, remise à zéro sobre, gain cumulatif et plafond de deux",()=>{
 let value=rules.weekSeries({weekPlans:history},now("2026-W45"));assert.equal(value.streak,4);assert.equal(value.jokers,0);assert.equal(value.weeks.at(-2).outcome,"joker");
 value=rules.weekSeries({weekPlans:history},now("2026-W46"));assert.equal(value.streak,0);assert.equal(value.justReset,true);assert.equal(value.heldTotal,4);
 const twelve=Array.from({length:12},(_,i)=>held(rules.shiftWeek("2026-W30",i)));value=rules.weekSeries({weekPlans:twelve},now("2026-W42"));assert.equal(value.streak,12);assert.equal(value.jokers,2);
});
test("L2 : quatre semaines de pause sans consommation, puis reprise et dates ISO",()=>{
 const pausedWeeks=Array.from({length:4},(_,i)=>rules.shiftWeek("2026-W44",i));let value=rules.weekSeries({weekPlans:history,weekSeries:{pausedWeeks}},now("2026-W48"));assert.equal(value.streak,4);assert.equal(value.jokers,1);assert.equal(value.weeks.filter(w=>w.outcome==="pause").length,4);
 value=rules.weekSeries({weekPlans:history,weekSeries:{pausedWeeks},weekPlan:held("2026-W46")},now("2026-W47"));assert.equal(value.streak,5,"une semaine cochée pendant la pause compte tout de même");
 assert.equal(rules.shiftWeek("2026-W53",1),"2027-W01");assert.equal(rules.shiftWeek("2027-W01",-1),"2026-W53");assert.equal(rules.weekMonday("2025-W53"),null);
});
test("L2 : une coche retirée dans la semaine courante retire son gain provisoire",()=>{
 const three=history.slice(0,3),week="2026-W43";assert.equal(rules.weekSeries({weekPlans:three,weekPlan:held(week)},now(week)).jokers,1);assert.equal(rules.weekSeries({weekPlans:three,weekPlan:held(week,false)},now(week)).jokers,0);
});
test("L2 SQLite : pause confirmée, reprise anticipée, versions et isolation",async()=>{
 const f=fixture(),store=await import(moduleUrl("lib/week-series-store.ts"));try{
  f.sqlite.prepare("UPDATE profiles SET data=json_set(data,'$.weekPlans',json(?)) WHERE user_id='alice'").run(JSON.stringify(history));
  const date=now("2026-W44"),base=await store.readWeekSeries("alice",date);assert.equal(base.streak,4);const paused=await store.writeWeekSeries("alice",{action:"pause",version:0,weeks:4,timeZone:"Europe/Paris"},date);assert.equal(paused.paused,true);assert.equal(paused.pauseEnd,"2026-W47");assert.equal(paused.jokers,1);
  await assert.rejects(()=>store.writeWeekSeries("alice",{action:"pause",version:0,weeks:2},date),store.WeekSeriesConflict);await assert.rejects(()=>store.writeWeekSeries("alice",{action:"pause",version:1,weeks:5},date));
  const resume=await store.writeWeekSeries("alice",{action:"resume",version:1},now("2026-W46"));assert.equal(resume.pauseStart,null);assert.equal(resume.streak,4);assert.equal(resume.jokers,1);assert.equal(resume.weeks.filter(w=>w.outcome==="pause").length,2);
  assert.equal((await store.readWeekSeries("bob",date)).pauseStart,null);assert.equal(JSON.parse(f.sqlite.prepare("SELECT data FROM profiles WHERE user_id='alice'").get().data).headline,"SECRET_PROFILE_alice");
 }finally{f.sqlite.close();}
});
test("L2 SQLite : semaine déjà tenue, pause lundi suivant et moment vu une seule fois dans le compte",async()=>{
 const f=fixture(),store=await import(moduleUrl("lib/week-series-store.ts"));try{
  const date=now("2026-W44");f.sqlite.prepare("UPDATE profiles SET data=json_set(data,'$.weekPlan',json(?)) WHERE user_id='alice'").run(JSON.stringify(held("2026-W44")));
  const paused=await store.writeWeekSeries("alice",{action:"pause",version:0,weeks:1},date);assert.equal(paused.pauseStart,"2026-W45");assert.equal(paused.paused,false);
  const welcome=await store.writeWeekSeries("alice",{action:"welcome",version:1},date);assert.equal(welcome.welcomeSeen,true);assert.equal((await store.writeWeekSeries("alice",{action:"welcome",version:1},date)).version,2);assert.equal((await store.readWeekSeries("alice",now("2026-W45"))).welcomeSeen,false);
  const route=await import(moduleUrl("app/api/profile/route.ts"));const response=await route.POST(new Request("https://radar.test/api/profile",{method:"POST",body:JSON.stringify({weekSeries:{version:999,pausedWeeks:[]}})}));assert.equal(response.status,200);assert.equal((await store.readWeekSeries("alice",date)).pauseStart,"2026-W45");
  const api=await import(moduleUrl("app/api/week-series/route.ts"));globalThis.__trashUser=null;assert.equal((await api.GET(new Request("https://radar.test/api/week-series"))).status,401);globalThis.__trashUser="alice";assert.equal((await api.PUT(new Request("https://radar.test/api/week-series",{method:"PUT",headers:{Origin:"https://evil.test"},body:"{}"}))).status,403);
 }finally{f.sqlite.close();}
});

test("L2 : scénarios de recette isolés, calcul réel et aucune fixture pour un compte normal",async()=>{
 const demo=await import(moduleUrl("lib/demo-week-series.ts"));assert.equal(demo.demoWeekSeries("normal",now("2026-W44")),null);
 const expected={"weeks-held":[4,1],"weeks-joker":[4,0],"weeks-reset":[0,0],"weeks-pause":[4,1],"weeks-reduced":[4,1]};
 for(const [scenario,result] of Object.entries(expected)){const value=rules.weekSeries(demo.demoWeekSeries(scenario,now("2026-W44")),now("2026-W44"));assert.deepEqual([value.streak,value.jokers],result);assert.equal(value.paused,scenario==="weeks-pause");}
});
