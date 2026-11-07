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


const rules=await import(moduleUrl("lib/reserve.ts")),views=await import(moduleUrl("lib/opportunity-views.ts"));
const now=new Date("2026-11-07T10:00:00Z"),old="2026-10-01T10:00:00Z";
test("réserve : poste proposé présent dans le groupe, jamais déjà visé ni inventé",()=>{
 assert.equal(rules.neighboringRole([{title:"Senior Growth Product Manager"}],["Product Owner"]),"Growth PM");
 assert.equal(rules.neighboringRole([{title:"Growth PM"}],["growth product manager"]),null);
 assert.equal(rules.neighboringRole([{title:"Product Owner"}],["Product Manager"]),null);
});
function fixture(){
 const sqlite=new DatabaseSync(":memory:");for(const file of readdirSync(resolve(root,"drizzle")).filter(f=>f.endsWith(".sql")).sort())sqlite.exec(readFileSync(resolve(root,"drizzle",file),"utf8"));
 let beforeBatch=null;
 function prepare(sql){let args=[];return {bind(...values){assert(values.length<=100);args=values;return this;},execute(){const result=sqlite.prepare(sql).run(...args);return {success:true,meta:{changes:Number(result.changes)}};},async first(){return sqlite.prepare(sql).get(...args)??null;},async all(){return {results:sqlite.prepare(sql).all(...args)};},async run(){return this.execute();}};}
 const db={prepare,async batch(ops){if(beforeBatch){const hook=beforeBatch;beforeBatch=null;hook();}sqlite.exec("BEGIN");try{const result=ops.map(op=>op.execute());sqlite.exec("COMMIT");return result;}catch(error){sqlite.exec("ROLLBACK");throw error;}}};globalThis.__trashEnv={DB:db};
 const add=(id,extra={})=>{sqlite.prepare("INSERT INTO jobs(id,user_id,fingerprint,title,published_at,created_at,updated_at,status,review_state) VALUES(?,?,?,?,?,?,?,?,?)").run(id,extra.user??"alice",id,extra.title??"Product Owner",extra.published??old,old,now.toISOString(),extra.status??"new",extra.state??"reopened");};
 const profile={headline:"Privé",preferences:{reducedMotion:true},weekPlan:{private:"préservé"},searchPreferences:{roles:["Product Owner"],domainTerms:["SEPA"]}};
 sqlite.prepare("INSERT INTO profiles(user_id,data) VALUES(?,?)").run("alice",JSON.stringify(profile));
 return {sqlite,add,profile,hook(fn){beforeBatch=fn;},job(id){const row=sqlite.prepare("SELECT * FROM jobs WHERE id=?").get(id);return {...row,reviewState:row.review_state,publishedAt:row.published_at,createdAt:row.created_at,updatedAt:row.updated_at};}};
}
test("réserve SQLite : décisions et annulation atomiques, sans perte ni compte croisé",async()=>{
 const f=fixture(),store=await import(moduleUrl("lib/reserve-action-store.ts"));try{
  f.add("a");f.add("b");f.add("foreign",{user:"bob"});f.add("application",{status:"applied"});f.add("selection",{state:"selected"});
  const id=crypto.randomUUID(),command={id,action:"discard",ids:["a","b"]};let r=await store.reserveAction("alice",command,now);assert.equal(r.removed,2);assert(f.job("a").deleted_at);assert(f.job("b").deleted_at);
  assert.deepEqual(await store.reserveAction("alice",command,now),r,"requête rejouée sans doubler le rangement");
  assert.equal((await store.reserveAction("alice",{id,action:"undo"},now)).undone,true);assert.equal(f.job("a").deleted_at,null);assert.equal(f.job("b").review_state,"reopened");assert.equal(f.job("a").updated_at,now.toISOString());
  assert.equal((await store.reserveAction("alice",command,now)).undone,true,"un ancien POST ne réapplique pas une action annulée");
  for(const ids of [["a","foreign"],["application"],["selection"],Array.from({length:51},(_,i)=>"x"+i)])await assert.rejects(()=>store.reserveAction("alice",{id:crypto.randomUUID(),action:"discard",ids},now));
  assert.equal(f.job("a").deleted_at,null);assert.equal(f.job("foreign").deleted_at,null);
  assert.equal(JSON.parse(f.sqlite.prepare("SELECT data FROM profiles WHERE user_id='alice'").get().data).weekPlan.private,"préservé");
 }finally{f.sqlite.close();}
});
test("réserve SQLite : archives restaurables, réserve et conflit concurrent avant écriture",async()=>{
 const f=fixture(),store=await import(moduleUrl("lib/reserve-action-store.ts"));try{
  f.add("old");assert.equal(views.isArchived(f.job("old"),now.getTime()),false);
  const id=crypto.randomUUID();await store.reserveAction("alice",{id,action:"archive",ids:["old"]},now);assert.equal(views.isArchived(f.job("old"),now.getTime()),true);
  await store.reserveAction("alice",{id,action:"undo"},now);assert.equal(views.isArchived(f.job("old"),now.getTime()),false);
  const keep=crypto.randomUUID();await store.reserveAction("alice",{id:keep,action:"keep",ids:["old"]},now);assert.equal(f.job("old").review_state,"later");assert.equal(f.job("old").deleted_at,null);
  await store.reserveAction("alice",{id:keep,action:"undo"},now);assert.equal(f.job("old").review_state,"reopened");
  f.add("fresh",{published:now.toISOString()});await assert.rejects(()=>store.reserveAction("alice",{id:crypto.randomUUID(),action:"archive",ids:["fresh"]},now));
  f.hook(()=>f.sqlite.prepare("UPDATE jobs SET status='applied' WHERE id='fresh'").run());const conflict=crypto.randomUUID();await assert.rejects(()=>store.reserveAction("alice",{id:conflict,action:"discard",ids:["old","fresh"]},now),store.ReserveConflict);
  assert.equal(f.job("old").deleted_at,null);assert.equal(f.job("fresh").deleted_at,null);assert.equal(f.sqlite.prepare("SELECT count(*) n FROM workspace_writes WHERE key=?").get("reserve-action:"+conflict).n,0);
  const parallel=crypto.randomUUID();await store.reserveAction("alice",{id:parallel,action:"discard",ids:["old"]},now);
  const undos=await Promise.allSettled([store.reserveAction("alice",{id:parallel,action:"undo"},now),store.reserveAction("alice",{id:parallel,action:"undo"},now)]);assert(undos.some(result=>result.status==="fulfilled"));assert.equal(f.job("old").deleted_at,null,"deux annulations concurrentes ne rejouent pas une écriture périmée");
  const again=crypto.randomUUID();await store.reserveAction("alice",{id:again,action:"discard",ids:["old"]},now);
  f.sqlite.prepare("UPDATE jobs SET updated_at='2026-11-08',dismissal_note='Choix ultérieur privé' WHERE id='old'").run();await assert.rejects(()=>store.reserveAction("alice",{id:again,action:"undo"},now),store.ReserveConflict);assert.equal(f.job("old").dismissal_note,"Choix ultérieur privé");assert(f.job("old").deleted_at);
 }finally{f.sqlite.close();}
});
test("réserve SQLite : rôle volontaire, autres données conservées, annulation et accès protégés",async()=>{
 const f=fixture(),store=await import(moduleUrl("lib/reserve-action-store.ts")),route=await import(moduleUrl("app/api/reserve-actions/route.ts"));try{
  f.add("growth",{title:"Growth PM"});const id=crypto.randomUUID();await store.reserveAction("alice",{id,action:"role",ids:["growth"],role:"Growth PM"},now);
  let p=JSON.parse(f.sqlite.prepare("SELECT data FROM profiles WHERE user_id='alice'").get().data);assert.deepEqual(p.searchPreferences.roles,["Product Owner","Growth PM"]);assert.deepEqual(p.searchPreferences.domainTerms,["SEPA"]);assert.equal(p.preferences.reducedMotion,true);
  p.headline="Autre saisie conservée";f.sqlite.prepare("UPDATE profiles SET data=? WHERE user_id='alice'").run(JSON.stringify(p));
  await store.reserveAction("alice",{id,action:"undo"},now);p=JSON.parse(f.sqlite.prepare("SELECT data FROM profiles WHERE user_id='alice'").get().data);assert.deepEqual(p.searchPreferences.roles,["Product Owner"]);assert.equal(p.headline,"Autre saisie conservée");
  const next=crypto.randomUUID();await store.reserveAction("alice",{id:next,action:"role",ids:["growth"],role:"Growth PM"},now);p.searchPreferences.roles=["Product Manager"];f.sqlite.prepare("UPDATE profiles SET data=? WHERE user_id='alice'").run(JSON.stringify(p));await assert.rejects(()=>store.reserveAction("alice",{id:next,action:"undo"},now),store.ReserveConflict);
  await assert.rejects(()=>store.reserveAction("bob",{id:next,action:"undo"},now),store.ReserveConflict);
  globalThis.__trashUser=null;assert.equal((await route.POST(new Request("https://radar.test/api/reserve-actions",{method:"POST",body:"{}"}))).status,401);globalThis.__trashUser="alice";assert.equal((await route.POST(new Request("https://radar.test/api/reserve-actions",{method:"POST",headers:{Origin:"https://evil.test"},body:"{}"}))).status,403);
 }finally{f.sqlite.close();}
});
