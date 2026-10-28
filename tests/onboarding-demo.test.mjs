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
    if (spec === "cloudflare:workers") target = dataUrl("export const env = globalThis.__onboardingEnv;");
    else if (spec.startsWith(".") || spec.startsWith("@/")) {
      let path = spec.startsWith("@/") ? resolve(root, spec.slice(2)) : resolve(dirname(file), spec);
      if (spec === "@/db") path += "/index";
      target = moduleUrl(path + ".ts");
    } else target = import.meta.resolve(spec);
    return `from ${JSON.stringify(target)}`;
  });
  const url = dataUrl(code); cache.set(file, url); return url;
}

test("exemples de premier accès : deux comptes isolés, relance sans doublon ni résurrection", async () => {
  const sqlite = new DatabaseSync(":memory:");
  for (const file of readdirSync(resolve(root, "drizzle")).filter(name => name.endsWith(".sql")).sort())
    sqlite.exec(readFileSync(resolve(root, "drizzle", file), "utf8"));
  function prepare(sql) { let args = []; return {
    bind(...values) { args = values; return this; },
    async all() { return { results: sqlite.prepare(sql).all(...args) }; },
    async raw() { const statement = sqlite.prepare(sql); statement.setReturnArrays(true); return statement.all(...args); },
    async run() { return sqlite.prepare(sql).run(...args); },
  }; }
  globalThis.__onboardingEnv = { DB: { prepare } };
  const { ensureOnboardingDemo } = await import(moduleUrl("lib/onboarding-demo.ts"));

  await Promise.all([ensureOnboardingDemo("alice"), ensureOnboardingDemo("alice")]);
  let alice = sqlite.prepare("SELECT id,user_id,title,status,applied_at,deleted_at,description FROM jobs WHERE user_id=? ORDER BY title").all("alice");
  assert.equal(alice.length, 2);
  assert.deepEqual(alice.map(row => row.status).sort(), ["applied", "new"]);
  assert(alice.every(row => row.title.startsWith("EXEMPLE — ") && row.description.includes("fictive")));
  assert(alice.find(row => row.status === "applied").applied_at);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS total FROM profiles").get().total, 0);

  await ensureOnboardingDemo("bob");
  const bob = sqlite.prepare("SELECT id,user_id FROM jobs WHERE user_id=?").all("bob");
  assert.equal(bob.length, 2);
  assert(bob.every(row => row.user_id === "bob" && !alice.some(other => other.id === row.id)));

  const trashedId = alice[0].id;
  sqlite.prepare("UPDATE jobs SET deleted_at=? WHERE user_id=? AND id=?").run("2026-10-28T00:00:00Z", "alice", trashedId);
  await ensureOnboardingDemo("alice");
  alice = sqlite.prepare("SELECT id,deleted_at FROM jobs WHERE user_id=?").all("alice");
  assert.equal(alice.length, 2);
  assert.equal(alice.find(row => row.id === trashedId)?.deleted_at, "2026-10-28T00:00:00Z");

  sqlite.prepare("INSERT INTO jobs(id,user_id,fingerprint,title) VALUES(?,?,?,?)").run("existing", "owner", "manual", "Offre personnelle");
  await ensureOnboardingDemo("owner");
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS total FROM jobs WHERE user_id=?").get("owner").total, 1);
  sqlite.close();
});
