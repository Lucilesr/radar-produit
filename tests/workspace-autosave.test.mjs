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

test("autosave SQLite : versions conservées, conflits, isolation et dossier inchangé",async()=>{
 const sqlite=new DatabaseSync(":memory:");for(const file of readdirSync(resolve(root,"drizzle")).filter(f=>f.endsWith(".sql")).sort())sqlite.exec(readFileSync(resolve(root,"drizzle",file),"utf8"));
 function prepare(sql){let args=[];return {bind(...values){args=values;return this;},async all(){return {results:sqlite.prepare(sql).all(...args)};},async raw(){const stmt=sqlite.prepare(sql);stmt.setReturnArrays(true);return stmt.all(...args);},async run(){return sqlite.prepare(sql).run(...args);}};}
 globalThis.__trashEnv={DB:{prepare}};
 const route=await import(moduleUrl("app/api/workspace-drafts/[key]/route.ts")),store=await import(moduleUrl("lib/job-store.ts"));
 const job=(await store.saveOffer("alice",{title:"Poste fictif",company:"Atlas fictif",contractType:"cdi",remoteMode:"full_remote",language:"fr",source:"Ajout manuel"})).job;
 sqlite.prepare("UPDATE jobs SET status='interview',applied_at='2026-10-01' WHERE id=?").run(job.id);
 sqlite.prepare("INSERT INTO profiles(user_id,data) VALUES(?,?)").run("alice",JSON.stringify({headline:"Profil à conserver",applicationNotes:{[job.id]:"Note initiale"}}));
 sqlite.prepare("INSERT INTO interviews(id,user_id,job_id,label,start_at,end_at,time_zone,data) VALUES(?,?,?,?,?,?,?,?)").run("event","alice",job.id,"Échange fictif","2026-10-30T09:00:00Z","2026-10-30T10:00:00Z","Europe/Paris",JSON.stringify({summary:"Bilan conservé"}));
 const key="note:"+job.id,context={params:Promise.resolve({key})},get=()=>route.GET(new Request("https://radar.test/api/workspace-drafts/"+key),context);
 const put=(body,origin)=>route.PUT(new Request("https://radar.test/api/workspace-drafts/"+key,{method:"PUT",headers:origin?{Origin:origin}:{},body:JSON.stringify(body)}),context);
 globalThis.__trashUser=null;assert.equal((await get()).status,401);globalThis.__trashUser="bob";assert.equal((await get()).status,404);assert.equal((await put({value:"intrusion",version:0,base:""})).status,404);
 globalThis.__trashUser="alice";assert.deepEqual(await(await get()).json(),{value:"Note initiale",version:0});
 const before=await store.getOffer("alice",job.id),rawProfile=sqlite.prepare("SELECT data FROM profiles WHERE user_id='alice'").get().data;
 assert.equal((await put({value:"Texte",version:0,base:"Note initiale"},"https://evil.test")).status,403);
 assert.equal((await put({value:"**Nouveau texte**",version:0,base:"Note initiale"})).status,200);
 assert.equal((await put({value:"**Nouveau texte**",version:0,base:"Note initiale"})).status,200,"réessai idempotent");
 assert.equal((await put({value:"Autre onglet",version:0,base:"Note initiale"})).status,409);
 assert.equal((await put({value:"A".repeat(2001),version:1,base:"**Nouveau texte**"})).status,400);
 assert.equal((await put({value:"Suite",version:1,base:"**Nouveau texte**"})).status,200);
 const after=await store.getOffer("alice",job.id);assert.equal(after.candidateNote,"Suite");assert.equal(after.status,before.status);assert.equal(after.appliedAt,before.appliedAt);assert.deepEqual(after.interviews,before.interviews);assert.equal(sqlite.prepare("SELECT data FROM profiles WHERE user_id='alice'").get().data,rawProfile,"profil importé intact");
 const history=await route.GET(new Request("https://radar.test/api/workspace-drafts/"+key+"?history=1"),context);assert.deepEqual((await history.json()).history.map(v=>v.value),["Suite","**Nouveau texte**","Note initiale"]);
 const reviewKey="review:event",reviewContext={params:Promise.resolve({key:reviewKey})};
 const draft=JSON.stringify({summary:"Bilan en cours",outcome:"offer"});assert.equal((await route.PUT(new Request("https://radar.test/api/workspace-drafts/"+reviewKey,{method:"PUT",body:JSON.stringify({value:draft,base:"",version:0})}),reviewContext)).status,200);
 const reviewed=await store.getOffer("alice",job.id);assert.equal(reviewed.status,before.status);assert.deepEqual(reviewed.interviews,before.interviews,"le brouillon ne termine pas le bilan");
 sqlite.close();
});
