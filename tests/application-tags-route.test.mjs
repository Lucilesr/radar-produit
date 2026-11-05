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
    if (spec === "cloudflare:workers") target = dataUrl("export const env = globalThis.__tagEnv;");
    else if (spec === "@/app/chatgpt-auth") target = dataUrl("export async function getChatGPTUser(){return globalThis.__tagUser ? {userId:globalThis.__tagUser}:null;}");
    else if (spec.startsWith(".") || spec.startsWith("@/")) {
      let path = spec.startsWith("@/") ? resolve(root, spec.slice(2)) : resolve(dirname(file), spec);
      if (spec === "@/db") path += "/index";
      target = moduleUrl(path + ".ts");
    } else target = import.meta.resolve(spec);
    return `from ${JSON.stringify(target)}`;
  });
  const url = dataUrl(code); cache.set(file, url); return url;
}

test("API tags : isolation, attribution et conflit de version", async () => {
  const sqlite = new DatabaseSync(":memory:");
  for (const file of readdirSync(resolve(root, "drizzle")).filter(file => file.endsWith(".sql")).sort()) sqlite.exec(readFileSync(resolve(root, "drizzle", file), "utf8"));
  function prepare(sql) { let args = []; return { bind(...values) { args = values; return this; }, async all() { return { results: sqlite.prepare(sql).all(...args) }; }, async raw() { const statement = sqlite.prepare(sql); statement.setReturnArrays(true); return statement.all(...args); }, async run() { return sqlite.prepare(sql).run(...args); } }; }
  globalThis.__tagEnv = { DB: { prepare } };
  const route = await import(moduleUrl("app/api/application-tags/route.ts"));
  const colors = await import(moduleUrl("lib/application-tags.ts"));
  const patch = value => route.PATCH(new Request("https://radar.test/api/application-tags", { method: "PATCH", headers: { origin: "https://radar.test" }, body: JSON.stringify(value) }));
  globalThis.__tagUser = null;
  assert.equal((await route.GET()).status, 401);
  globalThis.__tagUser = "alice";
  assert.deepEqual(await (await route.GET()).json(), { version: 0, tags: [] });
  sqlite.prepare("INSERT INTO jobs(id,user_id,fingerprint,title,status,applied_at) VALUES(?,?,?,?,?,?)").run("carte-alice", "alice", "fingerprint-alice", "Poste fictif", "applied", "2026-11-01");
  const created = await (await patch({ action: "create", version: 0, name: "À relancer", color: colors.tagColors[0].value, jobId: "carte-alice" })).json();
  assert.equal(created.version, 1);
  assert.deepEqual(created.tags[0].jobIds, ["carte-alice"]);
  const id = created.tags[0].id;
  assert.equal((await patch({ action: "create", version: 0, name: "Périmé", color: colors.tagColors[0].value })).status, 409);
  assert.equal((await patch({ action: "toggle", version: 1, id, jobId: "autre-compte" })).status, 400);
  globalThis.__tagUser = "bob";
  assert.deepEqual(await (await route.GET()).json(), { version: 0, tags: [] });
  globalThis.__tagUser = "alice";
  assert.equal((await patch({ action: "delete", version: 1, id })).status, 200);
  assert.deepEqual((await (await route.GET()).json()).tags, []);
});
