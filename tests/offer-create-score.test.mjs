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
    if (spec === "cloudflare:workers") target = dataUrl("export const env = globalThis.__createScoreEnv;");
    else if (spec === "@/app/chatgpt-auth") target = dataUrl("export async function getChatGPTUser(){return globalThis.__createScoreUser ? {userId:globalThis.__createScoreUser}:null;}");
    else if (spec.startsWith(".") || spec.startsWith("@/")) {
      let path = spec.startsWith("@/") ? resolve(root, spec.slice(2)) : resolve(dirname(file), spec);
      if (spec === "@/db") path += "/index";
      target = moduleUrl(path + ".ts");
    } else target = import.meta.resolve(spec);
    return `from ${JSON.stringify(target)}`;
  });
  const url = dataUrl(code); cache.set(file, url); return url;
}

test("création API : adéquation disponible sans rechargement, y compris après réimport", async () => {
  const sqlite = new DatabaseSync(":memory:");
  try {
    for (const file of readdirSync(resolve(root, "drizzle")).filter(name => name.endsWith(".sql")).sort()) sqlite.exec(readFileSync(resolve(root, "drizzle", file), "utf8"));
    function prepare(sql) { let args = []; return {
      bind(...values) { args = values; return this; },
      async all() { return { results: sqlite.prepare(sql).all(...args) }; },
      async raw() { const stmt = sqlite.prepare(sql); stmt.setReturnArrays(true); return stmt.all(...args); },
      async run() { return sqlite.prepare(sql).run(...args); },
    }; }
    globalThis.__createScoreEnv = { DB: { prepare } };
    globalThis.__createScoreUser = "score-fixture";
    const search = { roles: ["Product Owner", "Product Manager"], contracts: ["cdi"], remote: "full_remote", minimumSalary: 55000, targetLevel: "senior", boostKeywords: ["paiements", "SEPA"] };
    sqlite.prepare("INSERT INTO profiles(user_id,data) VALUES(?,?)").run("score-fixture", JSON.stringify({ searchPreferences: search }));
    const { POST, GET } = await import(moduleUrl("app/api/jobs/route.ts"));
    const fields = job => Object.fromEntries(["matchScore", "matchTier", "reasons", "flags", "fit", "fitLabel", "fitParts", "conditions", "confidence", "missing", "signals"].map(key => [key, job[key]]));
    const post = input => POST(new Request("https://radar.test/api/jobs", { method: "POST", headers: { Origin: "https://radar.test", "Content-Type": "application/json" }, body: JSON.stringify(input) }));
    const fixtures = [
      { title: "Senior Product Owner fictif", description: "Missions paiements et SEPA.", annualSalary: 66000, salaryMin: 62000, salaryMax: 70000, label: "very_close", fit: 90 },
      { title: "Chef de produit fictif", description: "Missions paiements.", annualSalary: 65000, label: "close", fit: 76 },
      { title: "Lead Product Owner fictif", description: "Missions paiements.", annualSalary: 100000, label: "to_weigh", fit: 57 },
      { title: "Junior Product Owner fictif", description: "Premier poste.", label: "far", fit: 35 },
      { title: "Product Owner fictif incomplet", description: "Résumé fictif.", contentCoverage: "summary", remoteMode: "unknown", language: "unknown", label: undefined, fit: 100 },
    ];
    for (const { label, fit, ...fixture } of fixtures) {
      const input = { company: "Atelier fictif", source: "Ajout manuel", contractType: "cdi", remoteMode: "full_remote", language: "fr", contentCoverage: "full", ...fixture };
      const created = await post(input); assert.equal(created.status, 201);
      const { job, deduplicated } = await created.json(); assert.equal(deduplicated, false);
      assert.equal(job.fitLabel, label); assert.equal(job.fit, fit);
      assert(job.confidence); assert(Array.isArray(job.missing)); assert(Array.isArray(job.signals));
      if (label === "to_weigh") assert(job.signals.some(signal => /un cran au-dessus/.test(signal)));
      if (!label) assert.deepEqual(job.missing, ["description complète", "rémunération", "présence", "niveau", "langue"]);
      const reimport = await post(input); assert.equal(reimport.status, 200);
      const repeated = await reimport.json(); assert.equal(repeated.deduplicated, true); assert.equal(repeated.job.id, job.id);
      assert.deepEqual(fields(repeated.job), fields(job));
      const read = await GET(new Request("https://radar.test/api/jobs")); assert.equal(read.status, 200);
      const listed = (await read.json()).jobs.find(item => item.id === job.id);
      assert.deepEqual(fields(listed), fields(job), "la création renvoie déjà les champs de la lecture suivante");
    }
    // A retry reassesses stored facts against the account's current target.
    sqlite.prepare("UPDATE profiles SET data=? WHERE user_id=?").run(JSON.stringify({ searchPreferences: { ...search, targetLevel: "junior" } }), "score-fixture");
    const changed = await post({ company: "Atelier fictif", source: "Ajout manuel", contractType: "cdi", remoteMode: "full_remote", language: "fr", contentCoverage: "full", ...fixtures[3] });
    assert.equal(changed.status, 200);
    const changedJob = (await changed.json()).job;
    assert.equal(changedJob.fitLabel, "close"); assert.equal(changedJob.fit, 65); assert.deepEqual(changedJob.signals, []);
  } finally { sqlite.close(); delete globalThis.__createScoreEnv; delete globalThis.__createScoreUser; }
});
