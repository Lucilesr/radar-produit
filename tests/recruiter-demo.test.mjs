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

test("démo recruteurs : deux visiteurs isolés, relance sans doublon ni résurrection", async () => {
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
  const { ensureRecruiterDemo } = await import(moduleUrl("lib/recruiter-demo.ts"));

  await Promise.all([ensureRecruiterDemo("demo:alice"), ensureRecruiterDemo("demo:alice")]);
  let alice = sqlite.prepare("SELECT id,user_id,title,status,applied_at,deleted_at,description FROM jobs WHERE user_id=? ORDER BY title").all("demo:alice");
  assert.equal(alice.length, 8);
  assert.deepEqual(alice.map(row => row.status).sort(), ["awaiting_response", "interview", "new", "new", "new", "offer", "prepare", "shortlist"]);
  assert(alice.every(row => row.description.includes("Exemple fictif")));
  assert(alice.filter(row => ["interview", "awaiting_response", "offer"].includes(row.status)).every(row => row.applied_at));
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS total FROM profiles WHERE user_id=?").get("demo:alice").total, 1);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS total FROM experience_items WHERE user_id=?").get("demo:alice").total, 2);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS total FROM interviews WHERE user_id=?").get("demo:alice").total, 1);

  await ensureRecruiterDemo("demo:bob");
  const bob = sqlite.prepare("SELECT id,user_id FROM jobs WHERE user_id=?").all("demo:bob");
  assert.equal(bob.length, 8);
  assert(bob.every(row => row.user_id === "demo:bob" && !alice.some(other => other.id === row.id)));

  await ensureRecruiterDemo("demo:carole", true);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS total FROM jobs WHERE user_id=?").get("demo:carole").total, 8);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS total FROM profiles WHERE user_id=?").get("demo:carole").total, 0);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS total FROM experience_items WHERE user_id=?").get("demo:carole").total, 0);

  // The scan adapter must exercise real per-owner writes without calling external feeds.
  await ensureRecruiterDemo("demo:scan",{scanDemo:true,reducedMotion:true});
  const scanProfile=JSON.parse(sqlite.prepare("SELECT data FROM profiles WHERE user_id=?").get("demo:scan").data);
  assert.equal(scanProfile.searchPreferences.targetLevel,"senior");assert.equal(scanProfile.preferences.reducedMotion,true);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM source_settings WHERE user_id=?").get("demo:scan").n,4);
  const {syncDemoSources}=await import(moduleUrl("lib/demo-scan.ts"));
  const originalFetch=globalThis.fetch;let externalCalls=0;
  globalThis.fetch=async()=>{externalCalls++;throw new Error("Un flux externe ne doit jamais être contacté en démo");};
  try{
    const first=await syncDemoSources("demo:scan","scan");
    assert.equal(first.total,4);assert.equal(first.imported,3);assert.equal(first.deduplicated,1);assert.equal(first.matching,3);
    const repeated=await syncDemoSources("demo:scan","scan");
    assert.equal(repeated.imported,0);assert.equal(repeated.deduplicated,4);assert.equal(repeated.matching,3);
    assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM jobs WHERE user_id=?").get("demo:scan").n,11);
    await ensureRecruiterDemo("demo:partial",{scanDemo:true});
    const partial=await syncDemoSources("demo:partial","scan-partial");
    assert.equal(partial.partialFailure,true);assert.equal(partial.imported,1);
    const retry=await syncDemoSources("demo:partial","scan-partial","Jobgether");
    assert.equal(retry.partialFailure,false);assert.equal(retry.imported,2);
    const failed=await syncDemoSources("demo:partial","scan-error");assert.equal(failed.allFailed,true);
    assert.equal(externalCalls,0);
    for(const source of ["We Work Remotely","Jobgether"])sqlite.prepare("UPDATE source_settings SET data=? WHERE user_id=? AND source=?").run(JSON.stringify({selected:true,state:"paused"}),"demo:scan",source);
    const paused=await syncDemoSources("demo:scan","scan");assert.equal(paused.inactive,true);assert.equal(paused.imported,0);
    const pausedSetting=JSON.parse(sqlite.prepare("SELECT data FROM source_settings WHERE user_id=? AND source=?").get("demo:scan","Jobgether").data);assert.equal(pausedSetting.state,"paused");
    await assert.rejects(()=>syncDemoSources("owner","scan"),/compte fictif/);
  }finally{globalThis.fetch=originalFetch;}

  await ensureRecruiterDemo("demo:session",{sessionDemo:true});
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM experience_items WHERE user_id=? AND validation='proposed'").get("demo:session").n,1);
  const review=sqlite.prepare("SELECT state,data FROM interviews WHERE user_id=?").get("demo:session");assert.equal(review.state,"reviewed");assert.ok(Date.parse(JSON.parse(review.data).followUpAt)<Date.now());
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM source_settings WHERE user_id=?").get("demo:session").n,2);
  await ensureRecruiterDemo("demo:session-empty",{sessionEmpty:true});
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM jobs WHERE user_id=? AND review_state='to_review'").get("demo:session-empty").n,0);
  const trashedId = alice[0].id;
  sqlite.prepare("UPDATE jobs SET deleted_at=? WHERE user_id=? AND id=?").run("2026-10-28T00:00:00Z", "demo:alice", trashedId);
  await ensureRecruiterDemo("demo:alice");
  alice = sqlite.prepare("SELECT id,deleted_at FROM jobs WHERE user_id=?").all("demo:alice");
  assert.equal(alice.length, 8);
  assert.equal(alice.find(row => row.id === trashedId)?.deleted_at, "2026-10-28T00:00:00Z");

  sqlite.prepare("INSERT INTO jobs(id,user_id,fingerprint,title) VALUES(?,?,?,?)").run("existing", "owner", "manual", "Offre personnelle");
  await assert.rejects(() => ensureRecruiterDemo("owner"), /session fictive/);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS total FROM jobs WHERE user_id=?").get("owner").total, 1);
  sqlite.close();
});
