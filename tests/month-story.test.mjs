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
    if (spec === "next/headers") target = dataUrl('export async function cookies(){return {get:()=>({value:globalThis.__monthDemoMode??""})};}');
    else if (spec === "cloudflare:workers") target = dataUrl("export const env = {get DB(){return globalThis.__trashEnv.DB;}};");
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


function fixture(){
 const sqlite=new DatabaseSync(":memory:");for(const file of readdirSync(resolve(root,"drizzle")).filter(f=>f.endsWith(".sql")).sort())sqlite.exec(readFileSync(resolve(root,"drizzle",file),"utf8"));
 let hook=null;
 function prepare(sql){let args=[];return {bind(...values){assert(values.length<=100);args=values;return this;},execute(){const results=sqlite.prepare(sql).all(...args);return {success:true,results,meta:{changes:Number(sqlite.prepare("SELECT changes() n").get().n)}};},async all(){return this.execute();},async raw(){const stmt=sqlite.prepare(sql);stmt.setReturnArrays(true);return stmt.all(...args);},async first(){return sqlite.prepare(sql).get(...args)??null;},async run(){const result=sqlite.prepare(sql).run(...args);return {success:true,meta:{changes:Number(result.changes)}};}};}
 const db={prepare,async batch(statements){if(hook){const next=hook;hook=null;next();}sqlite.exec("BEGIN");try{const result=statements.map(s=>s.execute());sqlite.exec("COMMIT");return result;}catch(error){sqlite.exec("ROLLBACK");throw error;}}};globalThis.__trashEnv={DB:db};globalThis.__trashUser="alice";
 for(const user of ["alice","bob"])sqlite.prepare("INSERT INTO profiles(user_id,data) VALUES(?,?)").run(user,JSON.stringify({headline:"SECRET_PROFILE_"+user,preferences:{reducedMotion:true},searchPreferences:{roles:["Product Owner"]},applicationNotes:{}}));
 return {sqlite,hook(fn){hook=fn;},events(user="alice"){return sqlite.prepare("SELECT * FROM activity_events WHERE user_id=? ORDER BY created_at,id").all(user).map(row=>({...row,data:JSON.parse(row.data)}));}};
}


const rules=await import(moduleUrl("lib/month-story.ts")),at=new Date("2026-11-08T12:00:00Z");
let n=0;const event=(action,id,day,data={},objectType="job")=>({id:"e"+(++n),action,objectType,objectId:id,createdAt:`2026-10-${String(day).padStart(2,'0')}T12:00:00Z`,data});
function plan(week="2026-W41",done="2026-10-08T12:00:00Z"){return {week,timeZone:"UTC",rhythm:"calm",commitments:[{id:"a",doneAt:done},{id:"b",doneAt:done}]};}
function addEvent(f,user,value){f.sqlite.prepare("INSERT INTO activity_events(id,user_id,action,object_type,object_id,created_at,data) VALUES(?,?,?,?,?,?,?)").run(value.id,user,value.action,value.objectType,value.objectId,value.createdAt,JSON.stringify(value.data));}
function addJob(f,id,user="alice",extra={}){f.sqlite.prepare("INSERT INTO jobs(id,user_id,fingerprint,title,company,status,review_state,deleted_at) VALUES(?,?,?,?,?,?,?,?)").run(id,user,id,"Offre fictive "+id,"Atelier fictif",extra.status??"new",extra.reviewState??"selected",extra.deletedAt??null);}
test("L5 : mois civil, changement d’année, DST et fenêtre accueil du1au7",()=>{
 assert.equal(rules.shiftMonth("2026-01",-1),"2025-12");assert.equal(rules.monthLabel("2026-10"),"octobre 2026");
 const window=rules.monthWindow("2026-10","Europe/Paris");assert.equal(window.start,"2026-09-30T22:00:00.000Z");assert.equal(window.end,"2026-10-31T23:00:00.000Z");assert.equal(Date.parse(window.end)-Date.parse(window.start),31*86400000+3600000);
 assert.equal(rules.storyHomeVisible(new Date("2026-11-07T22:59:00Z"),"Europe/Paris"),true);assert.equal(rules.storyHomeVisible(new Date("2026-11-07T23:00:00Z"),"Europe/Paris"),false);assert.equal(rules.storyHomeVisible(new Date("2026-11-01T00:00:00Z")),true);assert.equal(rules.isMonth("2026-13"),false);
});
test("L5 : démo au1erdu mois seulement pour un compte fictif explicitement demandé",()=>{
 assert.equal(rules.monthStoryClock("alice","month-story",at).getTime(),at.getTime());assert.equal(rules.monthStoryClock("demo:test","full",at).getTime(),at.getTime());assert.equal(rules.monthDay(rules.monthStoryClock("demo:test","month-story",at,"Europe/Paris"),"Europe/Paris"),"2026-11-01");
});
test("L5 : décisions nettes, préparations et notes sans doublon ni fait inventé",()=>{
 const a=event("offer_sorted","a",2,{decision:"selected"}),rows=[a,{...a},event("offer_restored","a",3),event("offer_sorted","b",4,{decision:"later"}),event("offer_sorted","c",5,{decision:"discarded"}),event("application_cared","care",6,{score:3}),event("application_cared","care",7,{score:4}),event("application_cared","low",8,{score:2}),event("interview_noted","meeting",10,{},"interview"),event("interview_noted","meeting",11,{},"interview"),{...event("offer_sorted","outside",1,{decision:"selected"}),createdAt:"2026-11-01T00:00:00Z"},{...event("offer_sorted","invalid",1),createdAt:"broken"}];
 const story=rules.buildMonthStory("2026-10","UTC",rows,[],"2026-09-01T00:00:00Z");assert.equal(story.sorted,2);assert.equal(story.cared,1);assert.equal(story.interviews,1);assert.equal(story.weeks,0);assert.equal(story.gem,null);assert.equal(story.partial,false);assert.equal(rules.monthStoryCards(story).length,5);
});
test("L5 : semaines réellement cochées, dernière version par semaine et mois de confirmation",()=>{
 const held=plan(),later=plan("2026-W42","2026-11-01T12:00:00Z"),invalid=plan("2026-W43","now"),incomplete={...plan("2026-W44"),commitments:[{id:"a",doneAt:"2026-10-20T12:00:00Z"},{id:"b"}]};let story=rules.buildMonthStory("2026-10","UTC",[],[held,later,invalid,incomplete],null);assert.equal(story.weeks,1);assert.equal(story.partial,true);
 story=rules.buildMonthStory("2026-10","UTC",[],[held,{...held,commitments:[{id:"a"},{id:"b"}]}],null);assert.equal(story.weeks,0);assert.deepEqual(rules.availableStoryMonths("2026-08-01T00:00:00Z","2026-10").map(x=>x.value),["2026-10","2026-09","2026-08"]);
});
test("L5 SQLite : lecture privée, pépite encore accessible et sélection la plus récente",async()=>{
 const f=fixture(),store=await import(moduleUrl("lib/month-story-store.ts"));try{addJob(f,"a");addJob(f,"b");addJob(f,"foreign","bob");for(const e of [event("offer_sorted","a",1,{decision:"selected"}),event("offer_restored","a",2),event("offer_sorted","a",28,{decision:"selected"}),event("offer_sorted","b",20,{decision:"selected"})])addEvent(f,"alice",e);addEvent(f,"bob",event("offer_sorted","foreign",29,{decision:"selected"}));
 let value=await store.readMonthStory("alice",{now:at,zone:"UTC"});assert.equal(value.story.sorted,2);assert.equal(value.story.gem.id,"a");assert.equal(value.homeVisible,false);assert.doesNotMatch(JSON.stringify(value),/SECRET_PROFILE|foreign/);const before=f.events().length;
 f.sqlite.prepare("UPDATE jobs SET deleted_at='2026-11-01T00:00:00Z' WHERE id='a'").run();value=await store.readMonthStory("alice",{now:at});assert.equal(value.story.gem.id,"b");f.sqlite.prepare("UPDATE jobs SET status='rejected' WHERE id='b'").run();assert.equal((await store.readMonthStory("alice",{now:at})).story.gem,null);assert.equal(f.events().length,before,"le récit ne modifie pas les faits");assert.equal((await store.readMonthStory("bob",{now:at})).story.sorted,1);
 }finally{f.sqlite.close();}
});
test("L5 SQLite : vide, historique partiel, mois terminé et fuseau du compte préservés",async()=>{
 const f=fixture(),store=await import(moduleUrl("lib/month-story-store.ts"));try{
 f.sqlite.prepare("UPDATE profiles SET data=json_set(data,'$.weekSeries',json(?),'$.weekPlans',json(?)) WHERE user_id='alice'").run(JSON.stringify({timeZone:"Europe/Paris"}),JSON.stringify([plan()]));const before=f.sqlite.prepare("SELECT data FROM profiles WHERE user_id='alice'").get().data;
 const value=await store.readMonthStory("alice",{now:at,zone:"UTC"});assert.equal(value.story.weeks,1);assert.equal(value.story.sorted,0);assert.equal(value.story.timeZone,"Europe/Paris");assert.equal(value.story.firstKnownAt,"2026-10-08T12:00:00.000Z");assert.equal(value.story.partial,true);assert.equal(f.sqlite.prepare("SELECT data FROM profiles WHERE user_id='alice'").get().data,before);
 const empty=await store.readMonthStory("nobody",{now:at});assert.equal(empty.story.sorted,0);assert.equal(empty.story.cared,0);assert.equal(empty.story.interviews,0);assert.equal(empty.story.weeks,0);assert.equal(empty.story.gem,null);assert.equal(empty.story.partial,true);
 await assert.rejects(()=>store.readMonthStory("alice",{now:at,month:"2026-11"}),store.MonthRequestError);await assert.rejects(()=>store.readMonthStory("alice",{now:at,zone:"Not/AZone"}),store.MonthRequestError);
 }finally{f.sqlite.close();}
});
test("L5 démo :12tris,3préparations,2entretiens,2semaines et pépite, initialisation une seule fois",async()=>{
 const f=fixture(),demo=await import(moduleUrl("lib/recruiter-demo.ts")),store=await import(moduleUrl("lib/month-story-store.ts")),owner="demo:month-fixture";try{
 assert.equal(await demo.ensureRecruiterDemo(owner,{monthStoryDemo:true}),true);const data=await store.readMonthStory(owner,{mode:"month-story"});assert.equal(data.homeVisible,true);assert.ok(data.simulatedDate);assert.deepEqual([data.story.sorted,data.story.cared,data.story.interviews,data.story.weeks],[12,3,2,2]);assert.ok(data.story.gem);const before=f.events(owner).length;assert.equal(await demo.ensureRecruiterDemo(owner,{monthStoryDemo:true}),false);assert.equal(f.events(owner).length,before);
 }finally{f.sqlite.close();}
});
test("L5 API : authentification, date invalide et événement illisible restent explicites",async()=>{
 const f=fixture(),api=await import(moduleUrl("app/api/month-story/route.ts"));try{globalThis.__trashUser=null;assert.equal((await api.GET(new Request("https://radar.test/api/month-story"))).status,401);globalThis.__trashUser='alice';assert.equal((await api.GET(new Request("https://radar.test/api/month-story?month=2099-01"))).status,400);const good=await api.GET(new Request("https://radar.test/api/month-story"));assert.equal(good.status,200);assert.equal(good.headers.get("Cache-Control"),"private, no-store");const month=(await good.json()).story.month;
 f.sqlite.prepare("INSERT INTO activity_events(id,user_id,action,object_type,object_id,created_at,data) VALUES('broken','alice','offer_sorted','job','a',?,'broken')").run(month+'-15T12:00:00Z');assert.equal((await api.GET(new Request("https://radar.test/api/month-story"))).status,503);
 }finally{f.sqlite.close();}
});
