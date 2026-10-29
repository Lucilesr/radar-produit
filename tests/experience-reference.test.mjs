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
    if (spec === "cloudflare:workers") target = dataUrl("export const env = globalThis.__referenceEnv;");
    else if (spec === "@/app/chatgpt-auth") target = dataUrl("export async function getChatGPTUser(){return globalThis.__referenceUser ? {userId:globalThis.__referenceUser}:null;}");
    else if (spec.startsWith(".") || spec.startsWith("@/")) {
      let path = spec.startsWith("@/") ? resolve(root, spec.slice(2)) : resolve(dirname(file), spec);
      if (spec === "@/db") path += "/index";
      target = moduleUrl(path + ".ts");
    } else target = import.meta.resolve(spec);
    return `from ${JSON.stringify(target)}`;
  });
  const url = dataUrl(code); cache.set(file, url); return url;
}

test("carnet : priorité document détaillé, puis CV français/anglais, isolation du propriétaire", async()=>{
 const sqlite=new DatabaseSync(":memory:");
 for(const file of readdirSync(resolve(root,"drizzle")).filter(f=>f.endsWith(".sql")).sort()) sqlite.exec(readFileSync(resolve(root,"drizzle",file),"utf8"));
 function prepare(sql){let args=[];return {bind(...values){args=values;return this;},async all(){return {results:sqlite.prepare(sql).all(...args)};},async first(){return sqlite.prepare(sql).get(...args)??null;}};}
 globalThis.__referenceEnv={DB:{prepare}};
 const {library}=await import(moduleUrl("lib/experience-store.ts"));
 for(const [id,owner] of [["detail","alice"],["fr","alice"],["en","alice"],["private","bob"]]) sqlite.prepare("INSERT INTO documents(id,user_id,original_name,object_key,content_type,size) VALUES(?,?,?,?,?,?)").run(id,owner,id+".txt",id,"text/plain",20);
 sqlite.prepare("INSERT INTO profiles(user_id,data) VALUES(?,?)").run("alice","{}");
 const set=links=>sqlite.prepare("UPDATE profiles SET data=? WHERE user_id='alice'").run(JSON.stringify(links));
 assert.equal((await library("alice")).reference,null);
 set({cvEnDocumentId:"en"});assert.equal((await library("alice")).reference.documentId,"en");
 set({cvFrDocumentId:"fr",cvEnDocumentId:"en",detailedExperienceDocumentId:""});assert.equal((await library("alice")).reference.documentId,"fr");
 set({cvFrDocumentId:"fr",cvEnDocumentId:"en",detailedExperienceDocumentId:"detail"});assert.equal((await library("alice")).reference.documentId,"detail");
 set({cvFrDocumentId:"private"});assert.equal((await library("alice")).reference,null);
 assert.equal((await library("bob")).reference,null);
 sqlite.close();
});
