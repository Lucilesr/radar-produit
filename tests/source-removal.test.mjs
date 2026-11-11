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
    if (spec === "cloudflare:workers") target = dataUrl("export const env = globalThis.__sourceEnv;");
    else if (spec === "@/app/chatgpt-auth") target = dataUrl("export async function getChatGPTUser(){return globalThis.__sourceUser ? {userId:globalThis.__sourceUser}:null;}");
    else if (spec.startsWith(".") || spec.startsWith("@/")) {
      let path = spec.startsWith("@/") ? resolve(root, spec.slice(2)) : resolve(dirname(file), spec);
      if (spec === "@/db") path += "/index";
      target = moduleUrl(path + ".ts");
    } else target = import.meta.resolve(spec);
    return `from ${JSON.stringify(target)}`;
  });
  const url = dataUrl(code); cache.set(file, url); return url;
}

test("suppression des sources : confirmation, persistance, isolation et réajout sans perte", async () => {
  const sqlite = new DatabaseSync(":memory:");
  for (const file of readdirSync(resolve(root, "drizzle")).filter(name => name.endsWith(".sql")).sort()) sqlite.exec(readFileSync(resolve(root, "drizzle", file), "utf8"));
  function prepare(sql) { let args=[]; return {
    bind(...values){args=values;return this;},
    async all(){return {results:sqlite.prepare(sql).all(...args)};},
    async raw(){const stmt=sqlite.prepare(sql);stmt.setReturnArrays(true);return stmt.all(...args);},
    async run(){return sqlite.prepare(sql).run(...args);},
  }; }
  globalThis.__sourceEnv={DB:{prepare}};
  const store=await import(moduleUrl("lib/source-store.ts"));
  const route=await import(moduleUrl("app/api/sources/route.ts"));
  const {isSourceVisible}=await import(moduleUrl("lib/source-visibility.ts"));
  const defaults=new Set(["LinkedIn Jobs","We Work Remotely"]);
  assert.equal(isSourceVisible("LinkedIn Jobs",[],defaults),true);
  assert.equal(isSourceVisible("Malt",[],defaults),false);
  const req=(body,origin="https://radar.test")=>new Request("https://radar.test/api/sources",{method:"DELETE",headers:{Origin:origin},body:JSON.stringify(body)});
  const input={source:"LinkedIn Jobs",confirmed:true};
  globalThis.__sourceUser=null;
  assert.equal((await route.DELETE(req(input))).status,401);
  globalThis.__sourceUser="alice";
  assert.equal((await route.DELETE(req(input,"https://evil.test"))).status,403);
  for(const body of [{source:"LinkedIn Jobs"},{...input,confirmed:false},{...input,userId:"bob"},{...input,source:"inconnue"},{...input,source:"Ajout manuel"}]) assert.equal((await route.DELETE(req(body))).status,400);
  const setting={state:"configured",notes:"Notes fictives à conserver",linkUrl:"https://example.test/search",selected:true};
  await store.userSourceSetting("alice",{source:"LinkedIn Jobs",...setting});
  await store.userSearchLinks("alice",{source:"LinkedIn Jobs",role:"Product Owner",links:{Site:"https://example.test/search"}});
  await store.userSourceSetting("bob",{source:"LinkedIn Jobs",...setting});
  sqlite.prepare("INSERT INTO jobs(id,user_id,title,source,fingerprint) VALUES(?,?,?,?,?)").run("offre-fictive","alice","Product Owner fictif","LinkedIn Jobs","fictive");
  const before=(await store.listSourceSettings("alice"))[0];
  assert.equal((await route.DELETE(req(input))).status,200);
  await route.DELETE(req(input));
  const rows=(await (await route.GET()).json()).sources;
  assert.equal(isSourceVisible("LinkedIn Jobs",rows,defaults),false,"une source par défaut configurée reste supprimée après relecture");
  for(const key of ["state","notes","linkUrl","searchLinks"]) assert.deepEqual(rows[0][key],before[key]);
  assert.equal((await store.listSourceSettings("bob"))[0].selected,true);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM jobs").get().n,1);
  await store.userSearchLinks("alice",{source:"LinkedIn Jobs",role:"Product Owner",links:{Google:"https://example.test/new"}});
  assert.equal(isSourceVisible("LinkedIn Jobs",await store.listSourceSettings("alice"),defaults),false);
  const add=await route.POST(new Request("https://radar.test/api/sources",{method:"POST",body:JSON.stringify({source:"LinkedIn Jobs",...setting})}));
  assert.equal(add.status,200);
  assert.equal(isSourceVisible("LinkedIn Jobs",await store.listSourceSettings("alice"),defaults),true);
  assert.equal((await store.listSourceSettings("alice"))[0].notes,setting.notes);
  assert.equal((await route.DELETE(req({source:"We Work Remotely",confirmed:true}))).status,200);
  const fetchBefore=globalThis.fetch;
  globalThis.fetch=()=>{throw new Error("Aucun accès au flux après retrait");};
  try {assert.equal((await store.syncAuthorizedFeed("alice")).paused,true);} finally {globalThis.fetch=fetchBefore;}
  await store.recordCollectiveAlert("alice",{url:"https://app.collective.work/my-personal-space/jobs",notificationAt:"2026-11-03T09:00:00Z",label:"Alerte fictive"});
  await route.DELETE(req({source:"Collective",confirmed:true}));
  await store.recordCollectiveAlert("alice",{url:"https://app.collective.work/my-personal-space/jobs",notificationAt:"2026-11-03T10:00:00Z",label:"Nouvelle alerte fictive"});
  assert.equal(isSourceVisible("Collective",await store.listSourceSettings("alice"),new Set(["Collective"])),false);
  // The API infers configuration and preserves other saved settings.
  const post=body=>route.POST(new Request("https://radar.test/api/sources",{method:"POST",headers:{Origin:"https://radar.test"},body:JSON.stringify(body)}));
  const saved=async body=>{const response=await post(body);assert.equal(response.status,200);return (await response.json()).source;};
  assert.equal((await saved({source:"Apec",notes:"Note fictive seule"})).state,"not_configured");
  assert.equal((await saved({source:"Apec",state:"configured"})).state,"not_configured","a declaration cannot configure a source");
  assert.equal((await saved({source:"Apec",linkUrl:"https://example.test/alert"})).state,"configured");
  const noted=await saved({source:"Apec",notes:"Autre note fictive"});
  assert.equal(noted.state,"configured");assert.equal(noted.linkUrl,"https://example.test/alert");
  assert.equal((await saved({source:"Apec",linkUrl:""})).state,"not_configured");
  assert.equal((await post({source:"Apec",linkUrl:"ftp://example.test/alert"})).status,400);
  assert.equal((await saved({source:"Collective",notes:"Alerte reçue conservée"})).state,"configured");
  assert.equal((await saved({source:"Jobgether",selected:true})).state,"configured");
  assert.equal((await saved({source:"Jobgether",paused:true})).state,"paused");
  assert.equal((await saved({source:"Jobgether",notes:"Ne pas reprendre"})).state,"paused");
  await Promise.all([
    store.userSourceSetting("alice",{source:"Jobgether",paused:false}),
    store.recordSourceVisit("alice",{source:"Jobgether",visited:true}),
    store.userSourceSetting("alice",{source:"Jobgether",notes:"Note enregistrée en parallèle"}),
  ]);
  const jobgether=(await store.listSourceSettings("alice")).find(source=>source.source==="Jobgether");
  assert.equal(jobgether.state,"configured");
  assert.equal(jobgether.notes,"Note enregistrée en parallèle");
  assert(Number.isFinite(Date.parse(jobgether.lastVisitedAt)));
  await store.userSourceSetting("alice",{source:"Jobgether",paused:true});
  await store.saveSourceSetting("alice","Jobgether",{state:"configured",health:"active",error:null});
  const scanned=(await store.listSourceSettings("alice")).find(source=>source.source==="Jobgether");
  assert.equal(scanned.state,"paused","la collecte déjà lancée ne reprend pas une source mise en pause");
  assert.equal(scanned.health,"active");
  assert.equal(scanned.error,null);
  assert.equal((await store.listSourceSettings("bob")).some(item=>item.source==="Apec"),false);
  sqlite.close();
});
