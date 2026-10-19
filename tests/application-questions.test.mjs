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
    if (spec === "cloudflare:workers") target = dataUrl("export const env = globalThis.__questionEnv;");
    else if (spec === "@/app/chatgpt-auth") target = dataUrl("export async function getChatGPTUser(){return globalThis.__questionUser ? {userId:globalThis.__questionUser}:null;}");
    else if (spec.startsWith(".") || spec.startsWith("@/")) {
      let path = spec.startsWith("@/") ? resolve(root, spec.slice(2)) : resolve(dirname(file), spec);
      if (spec === "@/db") path += "/index";
      target = moduleUrl(path + ".ts");
    } else target = import.meta.resolve(spec);
    return `from ${JSON.stringify(target)}`;
  });
  const url = dataUrl(code); cache.set(file, url); return url;
}

test("questions et brouillons : persistance, versions, relance et isolation A/B", async () => {
  const sqlite = new DatabaseSync(":memory:");
  for (const file of readdirSync(resolve(root, "drizzle")).filter(name => name.endsWith(".sql")).sort()) sqlite.exec(readFileSync(resolve(root, "drizzle", file), "utf8"));
  function prepare(query) {
    let args = [];
    return { query, get args() { return args; }, bind(...values) { args = values; return this; },
      async all() { return { results: sqlite.prepare(query).all(...args) }; },
      async raw() { const stmt = sqlite.prepare(query); stmt.setReturnArrays(true); return stmt.all(...args); },
      async run() { return sqlite.prepare(query).run(...args); } };
  }
  async function batch(statements) {
    sqlite.exec("BEGIN");
    try { const results = statements.map(stmt => {
      const prepared = sqlite.prepare(stmt.query);
      if (stmt.query.trim().toLowerCase().startsWith("select")) return { results: prepared.all(...stmt.args), success: true };
      return { meta: prepared.run(...stmt.args), success: true, results: [] };
    }); sqlite.exec("COMMIT"); return results; }
    catch (error) { sqlite.exec("ROLLBACK"); throw error; }
  }
  globalThis.__questionEnv = { DB: { prepare, batch } };
  const route = await import(moduleUrl("app/api/application-questions/route.ts"));
  const itemRoute = await import(moduleUrl("app/api/application-questions/[id]/route.ts"));
  const job = id => sqlite.prepare("INSERT INTO jobs(id,user_id,fingerprint,title) VALUES(?,?,?,?)").run(id, id, "fp-" + id, "PM fictif");
  job("alice"); job("bob");
  const id = "11111111-1111-4111-8111-111111111111";
  const input = { id, jobId: "alice", question: "Pourquoi ce produit ?", characterLimit: 120, answer: "" };
  const post = body => new Request("https://radar.test/api/application-questions", { method: "POST", body: JSON.stringify(body) });
  const patch = body => new Request("https://radar.test/api/application-questions/" + id, { method: "PATCH", body: JSON.stringify(body) });
  const ctx = { params: Promise.resolve({ id }) };
  globalThis.__questionUser = null;
  assert.equal((await route.POST(post(input))).status, 401);
  globalThis.__questionUser = "alice";
  assert.equal((await route.POST(new Request("https://radar.test/api/application-questions", { method: "POST", headers: { Origin: "https://evil.test" }, body: JSON.stringify(input) }))).status, 403);
  const created = await route.POST(post(input)); assert.equal(created.status, 201);
  const first = (await created.json()).question; assert.equal(first.version, 1);
  assert.equal((await route.POST(post(input))).status, 201, "une relance ne duplique pas la question");
  assert.equal(sqlite.prepare("SELECT count(*) AS n FROM application_answer_revisions").get().n, 1);
  const changed = await itemRoute.PATCH(patch({ version: 1, question: input.question, characterLimit: 120, answer: "Réponse fictive relue." }), ctx);
  assert.equal(changed.status, 200); assert.equal((await changed.json()).question.version, 2);
  assert.equal((await itemRoute.PATCH(patch({ version: 1, question: input.question, characterLimit: 120, answer: "Réponse fictive relue." }), ctx)).status, 200, "une réponse réseau perdue ne crée pas de version supplémentaire");
  assert.equal((await itemRoute.PATCH(patch({ version: 1, question: input.question, characterLimit: 120, answer: "Écrasement interdit" }), ctx)).status, 400);
  const history = (await (await itemRoute.GET(new Request("https://radar.test"), ctx)).json()).revisions;
  assert.deepEqual(history.map(row => row.answer), ["Réponse fictive relue.", ""]);
  assert.equal((await route.GET(new Request("https://radar.test/api/application-questions?jobId=alice"))).status, 200);
  assert.equal((await route.GET(new Request("https://radar.test/api/application-questions?jobId=bob"))).status, 400);
  globalThis.__questionUser = "bob";
  assert.equal((await route.GET(new Request("https://radar.test/api/application-questions?jobId=alice"))).status, 400);
  assert.equal((await itemRoute.GET(new Request("https://radar.test"), ctx)).status, 404);
  assert.equal((await itemRoute.PATCH(patch({ version: 2, question: input.question, characterLimit: null, answer: "Vol" }), ctx)).status, 400);
  assert.equal((await route.POST(post(input))).status, 400, "même id entre comptes refusé");
  globalThis.__questionUser = "alice";
  assert.equal((await itemRoute.PATCH(patch({ action: "archive", version: 2 }), ctx)).status, 200);
  assert.equal((await itemRoute.PATCH(patch({ action: "archive", version: 2 }), ctx)).status, 200, "archivage répété sans doublon");
  const listed = await (await route.GET(new Request("https://radar.test/api/application-questions?jobId=alice"))).json();
  assert.equal(listed.questions.length, 0);
  const archived = await (await route.GET(new Request("https://radar.test/api/application-questions?jobId=alice&includeArchived=1"))).json();
  assert.equal(archived.questions.length,1);assert.equal(archived.questions[0].version,3);
  assert.equal(sqlite.prepare("SELECT answer FROM application_questions WHERE id=?").get(id).answer, "Réponse fictive relue.");
  assert.equal((await (await itemRoute.GET(new Request("https://radar.test"), ctx)).json()).revisions.length, 3);
  assert.equal((await itemRoute.PATCH(patch({action:"restore",version:3}),ctx)).status,200);
  assert.equal((await (await route.GET(new Request("https://radar.test/api/application-questions?jobId=alice"))).json()).questions.length,1);
  sqlite.close();
});

test("brief : questions et limites seulement, jamais les brouillons", async () => {
  const code = ts.transpileModule(readFileSync(resolve(root, "lib/candidate-brief.ts"), "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
  const { createCandidateBrief } = await import(dataUrl(code));
  const brief = createCandidateBrief({ offer: { title: "PM", company: "Atlas", contractType: "cdi", remoteMode: "full_remote", description: "Produit fictif" }, facts: [], questions: [{ question: "Présentez-vous", characterLimit: 200 }] });
  assert.match(brief, /Présentez-vous/); assert.match(brief, /200 caractères/);
  assert.doesNotMatch(brief, /Brouillon privé/);
  const api = readFileSync(resolve(root, "app/api/brief/route.ts"), "utf8");
  assert.match(api, /questions\.map\(\(\{question,characterLimit\}\)/);
  assert.doesNotMatch(api, /answer:|candidateNote|interviews/);
});
