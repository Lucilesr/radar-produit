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


const rules=await import(moduleUrl("lib/application-care.ts"));
function fixture(){
 const sqlite=new DatabaseSync(":memory:");for(const file of readdirSync(resolve(root,"drizzle")).filter(f=>f.endsWith(".sql")).sort())sqlite.exec(readFileSync(resolve(root,"drizzle",file),"utf8"));
 let hook=null;
 function prepare(sql){let args=[];return {bind(...values){assert(values.length<=100);args=values;return this;},execute(){const results=sqlite.prepare(sql).all(...args);return {success:true,results,meta:{changes:Number(sqlite.prepare("SELECT changes() n").get().n)}};},async all(){return this.execute();},async raw(){const stmt=sqlite.prepare(sql);stmt.setReturnArrays(true);return stmt.all(...args);},async first(){return sqlite.prepare(sql).get(...args)??null;},async run(){const result=sqlite.prepare(sql).run(...args);return {success:true,meta:{changes:Number(result.changes)}};}};}
 const db={prepare,async batch(statements){if(hook){const next=hook;hook=null;next();}sqlite.exec("BEGIN");try{const result=statements.map(s=>s.execute());sqlite.exec("COMMIT");return result;}catch(error){sqlite.exec("ROLLBACK");throw error;}}};globalThis.__trashEnv={DB:db};globalThis.__trashUser="alice";
 for(const user of ["alice","bob"])sqlite.prepare("INSERT INTO profiles(user_id,data) VALUES(?,?)").run(user,JSON.stringify({headline:"SECRET_PROFILE_"+user,preferences:{reducedMotion:true},searchPreferences:{roles:["Product Owner"]},applicationNotes:{}}));
 return {sqlite,hook(fn){hook=fn;},events(user="alice"){return sqlite.prepare("SELECT * FROM activity_events WHERE user_id=? ORDER BY created_at,id").all(user).map(row=>({...row,data:JSON.parse(row.data)}));}};
}
const offer={title:"Product Owner fictif",company:"Atelier fictif",contractType:"cdi",remoteMode:"full_remote",language:"fr",source:"Ajout manuel",description:"Description privée fictive."};
test("C1 : quatre repères explicites, seuil trois et manque précis",()=>{
 assert.equal(rules.careCount(rules.emptyCare()),0);assert.equal(rules.careCount(rules.readCare({cv:"true",message:1})),0);
 const care=rules.readCare({cv:true,message:true,questions:true});assert.equal(rules.careSummary(care),"Soignée à 3 sur 4 : il manque le contact");assert.equal(rules.careSummary({...care,contact:true}),"Soignée à 4 sur 4");assert.equal(rules.careCount(rules.readCare("not-json")),0);
 assert.deepEqual(rules.latestCare({...care,version:3},{...rules.emptyCare(),version:1}),{...care,version:3});
});
test("C1 SQLite : CV global sans coche automatique, indépendance des offres et du compte",async()=>{
 const f=fixture(),jobs=await import(moduleUrl("lib/job-store.ts")),store=await import(moduleUrl("lib/application-care-store.ts"));try{
  f.sqlite.prepare("UPDATE profiles SET data=json_set(data,'$.cvFrDocumentId','global-cv') WHERE user_id='alice'").run();
  const a=(await jobs.saveOffer("alice",offer)).job,b=(await jobs.saveOffer("alice",{...offer,company:"Deux"})).job,foreign=(await jobs.saveOffer("bob",offer)).job;
  assert.equal(rules.careCount(await store.readApplicationCare("alice",a.id)),0);await store.writeApplicationCare("alice",a.id,{field:"cv",checked:true,version:0});assert.equal((await store.readApplicationCare("alice",a.id)).cv,true);assert.equal((await store.readApplicationCare("alice",b.id)).cv,false);assert.equal(await store.readApplicationCare("alice",foreign.id),null);assert.equal(await store.writeApplicationCare("alice",foreign.id,{field:"cv",checked:true,version:0}),null);
  const read=await jobs.getOffer("alice",a.id);assert.equal(read.applicationCare.cv,true);assert.equal(read.status,"new");const all=await jobs.listOffers("alice");assert.equal(all.find(j=>j.id===a.id).applicationCare.cv,true);assert.equal(all.find(j=>j.id===b.id).applicationCare,undefined);
  const drafts=await import(moduleUrl("lib/workspace-write-store.ts"));assert.equal(await drafts.ownsWorkspaceKey("alice",`application:care:${a.id}`),false,"pas d’écriture générique non validée de ces repères");
 }finally{f.sqlite.close();}
});
test("C1 SQLite : actions confirmées, reçu du seuil, réessai et retrait de coche",async()=>{
 const f=fixture(),jobs=await import(moduleUrl("lib/job-store.ts")),store=await import(moduleUrl("lib/application-care-store.ts"));try{
  const job=(await jobs.saveOffer("alice",offer)).job;let version=0;
  for(const field of ["cv","message","questions"]){const value=await store.writeApplicationCare("alice",job.id,{field,checked:true,version});version=value.version;}
  assert.equal(f.events().filter(e=>e.action==="application_cared").length,1);assert.equal(f.events()[0].data.score,3);assert.equal(f.events()[0].data.source,"Ajout manuel");
  const retry=await store.writeApplicationCare("alice",job.id,{field:"questions",checked:true,version:2});assert.equal(retry.version,3);assert.equal(f.events().length,1);
  await store.writeApplicationCare("alice",job.id,{field:"contact",checked:true,version:3});assert.equal(f.events().length,1,"le quatrième repère ne double pas la candidature soignée");
  const unchecked=await store.writeApplicationCare("alice",job.id,{field:"cv",checked:false,version:4});assert.equal(rules.careCount(unchecked),3);assert.equal((await jobs.getOffer("alice",job.id)).status,"new");assert.doesNotMatch(JSON.stringify(f.events()),/Description privée|SECRET_PROFILE/);
 }finally{f.sqlite.close();}
});
test("C1 SQLite : deux onglets ne remplacent pas leurs coches respectives",async()=>{
 const f=fixture(),jobs=await import(moduleUrl("lib/job-store.ts")),store=await import(moduleUrl("lib/application-care-store.ts"));try{
  const job=(await jobs.saveOffer("alice",offer)).job;const results=await Promise.allSettled([store.writeApplicationCare("alice",job.id,{field:"cv",checked:true,version:0}),store.writeApplicationCare("alice",job.id,{field:"message",checked:true,version:0})]);assert.equal(results.filter(r=>r.status==="fulfilled").length,1);assert(results.find(r=>r.status==="rejected").reason instanceof store.CareConflict);
  const before=await store.readApplicationCare("alice",job.id),field=before.cv?"message":"cv";const next=await store.writeApplicationCare("alice",job.id,{field,checked:true,version:before.version});assert.equal(next.cv,true);assert.equal(next.message,true);assert.equal(next.version,2);
 }finally{f.sqlite.close();}
});
test("C1 SQLite : transaction annulée sans coche ni événement orphelin",async()=>{
 const f=fixture(),jobs=await import(moduleUrl("lib/job-store.ts")),store=await import(moduleUrl("lib/application-care-store.ts"));try{
  const job=(await jobs.saveOffer("alice",offer)).job;await store.writeApplicationCare("alice",job.id,{field:"cv",checked:true,version:0});await store.writeApplicationCare("alice",job.id,{field:"message",checked:true,version:1});
  f.sqlite.exec("CREATE TRIGGER block_care BEFORE INSERT ON activity_events WHEN new.action='application_cared' BEGIN SELECT RAISE(ABORT,'test rollback'); END");await assert.rejects(()=>store.writeApplicationCare("alice",job.id,{field:"questions",checked:true,version:2}));assert.equal((await store.readApplicationCare("alice",job.id)).version,2);assert.equal(rules.careCount(await store.readApplicationCare("alice",job.id)),2);assert.equal(f.events().length,0);
 }finally{f.sqlite.close();}
});
test("C1 API : authentification, origine et dossier étranger",async()=>{
 const f=fixture(),jobs=await import(moduleUrl("lib/job-store.ts")),api=await import(moduleUrl("app/api/application-care/[id]/route.ts"));try{
  const job=(await jobs.saveOffer("bob",offer)).job,context={params:Promise.resolve({id:job.id})};assert.equal((await api.GET(new Request("https://radar.test/api/application-care/"+job.id),context)).status,404);globalThis.__trashUser=null;assert.equal((await api.GET(new Request("https://radar.test/api/application-care/"+job.id),context)).status,401);globalThis.__trashUser="alice";assert.equal((await api.PUT(new Request("https://radar.test/api/application-care/"+job.id,{method:"PUT",headers:{Origin:"https://evil.test"},body:"{}"}),context)).status,403);
 }finally{f.sqlite.close();}
});

test("C1 SQLite : disparition du dossier entre lecture et transaction sans reçu orphelin",async()=>{
 const f=fixture(),jobs=await import(moduleUrl("lib/job-store.ts")),store=await import(moduleUrl("lib/application-care-store.ts"));try{const job=(await jobs.saveOffer("alice",offer)).job;f.hook(()=>f.sqlite.prepare("DELETE FROM jobs WHERE id=?").run(job.id));assert.equal(await store.writeApplicationCare("alice",job.id,{field:"cv",checked:true,version:0}),null);assert.equal(f.events().length,0);assert.equal(f.sqlite.prepare("SELECT count(*) n FROM workspace_writes WHERE key=?").get(`application:care:${job.id}`).n,0);}finally{f.sqlite.close();}
});
