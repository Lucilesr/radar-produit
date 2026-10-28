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

test("tableau personnel SQLite : isolation, version, déplacements et conservation", async () => {
  const sqlite=new DatabaseSync(":memory:");
  for(const file of readdirSync(resolve(root,"drizzle")).filter(f=>f.endsWith(".sql")).sort())sqlite.exec(readFileSync(resolve(root,"drizzle",file),"utf8"));
  function prepare(sql){let args=[];return {bind(...values){args=values;return this;},async all(){return {results:sqlite.prepare(sql).all(...args)};},async raw(){const stmt=sqlite.prepare(sql);stmt.setReturnArrays(true);return stmt.all(...args);},async run(){return sqlite.prepare(sql).run(...args);}};}
  globalThis.__trashEnv={DB:{prepare}};
  const route=await import(moduleUrl("app/api/application-board/route.ts"));
  const jobs=await import(moduleUrl("app/api/jobs/[id]/route.ts"));
  const store=await import(moduleUrl("lib/job-store.ts"));
  const request=(payload,origin)=>new Request("https://radar.test/api/application-board",{method:"PATCH",headers:origin?{Origin:origin}:{},body:JSON.stringify(payload)});
  globalThis.__trashUser=null;assert.equal((await route.GET()).status,401);
  globalThis.__trashUser="alice";
  assert.equal((await route.PATCH(request({action:"add"},"https://evil.test"))).status,403);
  let board=(await (await route.GET()).json()).board;assert.equal(board.version,0);
  const added=await route.PATCH(request({action:"add",version:0,label:"Échange RH",stage:"interviews"}));assert.equal(added.status,200);
  board=(await added.json()).board;const column=board.columns.find(c=>c.id.startsWith("custom-"));assert(column);
  assert.equal((await route.PATCH(request({action:"rename",version:0,id:column.id,label:"Périmé"}))).status,409);
  assert.equal((await route.PATCH(request({action:"rename",version:1,id:column.id,label:"Équipe produit"}))).status,200);
  globalThis.__trashUser="bob";assert.equal((await (await route.GET()).json()).board.columns.length,5);
  assert.equal((await route.PATCH(request({action:"rename",version:0,id:column.id,label:"Intrusion"}))).status,400);
  globalThis.__trashUser="alice";
  const job=(await store.saveOffer("alice",{title:"Poste fictif",company:"Atlas fictif",contractType:"cdi",remoteMode:"full_remote",language:"fr",source:"Ajout manuel"})).job;
  sqlite.prepare("UPDATE jobs SET status='applied',applied_at='2026-10-01' WHERE id=?").run(job.id);
  sqlite.prepare("INSERT INTO profiles(user_id,data) VALUES(?,?)").run("alice",JSON.stringify({headline:"Profil fictif",applicationNotes:{[job.id]:"Note à conserver"}}));
  sqlite.prepare("INSERT INTO interviews(id,user_id,job_id,label,start_at,end_at,time_zone,data) VALUES(?,?,?,?,?,?,?,?)").run("event","alice",job.id,"Échange fictif","2026-10-30T09:00:00Z","2026-10-30T10:00:00Z","Europe/Paris",JSON.stringify({summary:"Bilan à conserver"}));
  const before=await store.getOffer("alice",job.id);
  const move=payload=>jobs.PATCH(new Request("https://radar.test/api/jobs/"+job.id,{method:"PATCH",body:JSON.stringify(payload)}),{params:Promise.resolve({id:job.id})});
  assert.equal((await move({status:"interview",expectedStatus:"offer",boardColumnId:column.id})).status,409);
  assert.equal((await move({status:"offer",expectedStatus:"applied",boardColumnId:column.id})).status,400);
  assert.equal((await move({status:"interview",expectedStatus:"applied",boardColumnId:column.id})).status,200);
  let after=await store.getOffer("alice",job.id);assert.equal(after.boardColumnId,column.id);
  assert.equal(after.candidateNote,before.candidateNote);assert.deepEqual(after.interviews,before.interviews);assert.equal(after.appliedAt,before.appliedAt);
  assert.equal((await move({status:"offer"})).status,200);after=await store.getOffer("alice",job.id);assert.equal(after.boardColumnId,undefined);
  assert.equal(after.candidateNote,before.candidateNote);assert.deepEqual(after.interviews,before.interviews);
  sqlite.close();
});
