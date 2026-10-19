import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL("../", import.meta.url));
const dataUrl = code => "data:text/javascript;base64," + Buffer.from(code).toString("base64");
const cache = new Map();
function moduleUrl(file) {
  file = resolve(root, file);
  if (cache.has(file)) return cache.get(file);
  let code = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  code = code.replace(/from "([^"]+)"/g, (_, spec) => {
    let target;
    if (spec === "cloudflare:workers") target = dataUrl("export const env = globalThis.__proposalEnv;");
    else if (spec === "@/app/chatgpt-auth") target = dataUrl("export async function getChatGPTUser(){return globalThis.__proposalUser ? {userId:globalThis.__proposalUser}:null;}");
    else if (spec.startsWith(".") || spec.startsWith("@/")) {
      let path = spec.startsWith("@/") ? resolve(root, spec.slice(2)) : resolve(dirname(file), spec);
      if (spec === "@/db") path += "/index";
      target = moduleUrl(path + (path.endsWith(".mts") ? "" : ".ts"));
    } else target = pathToFileURL(require.resolve(spec)).href;
    return `from ${JSON.stringify(target)}`;
  });
  const url = dataUrl(code); cache.set(file, url); return url;
}

test("ChatGPT → Radar : contexte minimal, variante persistée, jamais de remplacement silencieux", async () => {
  const sqlite = new DatabaseSync(":memory:");
  for (const file of readdirSync(resolve(root, "drizzle")).filter(name => name.endsWith(".sql")).sort()) sqlite.exec(readFileSync(resolve(root, "drizzle", file), "utf8"));
  function prepare(query) { let args = []; return { query, get args() { return args; }, bind(...values) { args = values; return this; },
    async all() { return { results: sqlite.prepare(query).all(...args) }; },
    async first() { return sqlite.prepare(query).get(...args) ?? null; },
    async raw() { const stmt = sqlite.prepare(query); stmt.setReturnArrays(true); return stmt.all(...args); },
    async run() { return sqlite.prepare(query).run(...args); } }; }
  async function batch(statements) { sqlite.exec("BEGIN"); try { const results = statements.map(stmt => {
    const prepared = sqlite.prepare(stmt.query);
    return stmt.query.trim().toLowerCase().startsWith("select") ? { results: prepared.all(...stmt.args), success: true } : { meta: prepared.run(...stmt.args), success: true, results: [] };
  }); sqlite.exec("COMMIT"); return results; } catch (error) { sqlite.exec("ROLLBACK"); throw error; } }
  globalThis.__proposalEnv = { DB: { prepare, batch } };
  const questionId = "11111111-1111-4111-8111-111111111111";
  const questionIdB = "22222222-2222-4222-8222-222222222222";
  for (const [user, questionIdOfUser] of [["alice", questionId], ["bob", questionIdB]]) {
    sqlite.prepare("INSERT INTO jobs(id,user_id,fingerprint,title,description) VALUES(?,?,?,?,?)").run(user, user, "fp-"+user, "Product Owner OAuth", "Offre fictive sur OAuth. SECRET_JOB_NOTE absent.");
    sqlite.prepare("INSERT INTO application_questions(id,user_id,job_id,question,character_limit,answer,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)")
      .run(questionIdOfUser,user,user,"Décrivez votre travail sur OAuth.",180,"BROUILLON_PRIVÉ_"+user,"now","now");
    sqlite.prepare("INSERT INTO profiles(user_id,data) VALUES(?,?)").run(user,JSON.stringify({applicationNotes:{[user]:"SECRET_NOTE_"+user}}));
  }
  const domain = await import(moduleUrl("lib/experience-domain.ts"));
  function fact(id,user,term,allowed) {
    const data = { ...domain.emptyData(), title: term, context: `J’ai cadré ${term} pour un produit fictif.`, contribution: `Spécifications ${term}`, result: "Livraison documentée", provenance: [{type:"manual",name:"Source privée",quote:"SECRET_PROVENANCE"}] };
    sqlite.prepare("INSERT INTO experience_items(id,user_id,kind,data,validation,application_allowed,application_consent,version,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)")
      .run(id,user,"fact",JSON.stringify(data),"approved",allowed?1:0,allowed?"granted":"declined",1,"now","now");
  }
  fact("oauth-alice","alice","OAuth",true);
  fact("budget-alice","alice","Budgets",true);
  fact("secret-alice","alice","SECRET_UNAPPROVED",false);
  fact("oauth-bob","bob","OAuth BOB",true);
  const store = await import(moduleUrl("lib/application-proposal-store.ts"));
  const context = await store.getQuestionGenerationContext("alice","alice",questionId);
  assert.equal(context.facts.length,1);
  assert.equal(context.facts[0].id,"oauth-alice");
  assert.doesNotMatch(JSON.stringify(context),/BROUILLON_PRIVÉ|SECRET_NOTE|SECRET_PROVENANCE|SECRET_UNAPPROVED|OAuth BOB/);
  await assert.rejects(store.getQuestionGenerationContext("bob","alice",questionId),/introuvable/);
  await assert.rejects(store.getQuestionGenerationContext("alice","alice",questionIdB),/introuvable/);
  const input={id:"33333333-3333-4333-8333-333333333333",jobId:"alice",questionId,contextDigest:context.contextDigest,answer:"J’ai cadré le parcours OAuth du produit fictif.",language:"fr"};
  assert.deepEqual(await store.saveAnswerProposal("alice",input),{id:input.id,saved:true,repeated:false});
  assert.deepEqual(await store.saveAnswerProposal("alice",input),{id:input.id,saved:true,repeated:true});
  await assert.rejects(store.saveAnswerProposal("bob",input),/introuvable/);
  await assert.rejects(store.saveAnswerProposal("alice",{...input,id:crypto.randomUUID(),answer:"T".repeat(181)}),/limite/);
  assert.equal((await store.listAnswerProposals("alice",questionId)).length,1);
  await assert.rejects(store.listAnswerProposals("bob",questionId),/introuvable/);
  assert.equal(sqlite.prepare("SELECT answer FROM application_questions WHERE id=?").get(questionId).answer,"BROUILLON_PRIVÉ_alice");
  assert.equal(sqlite.prepare("SELECT count(*) AS n FROM application_answer_proposals").get().n,1);
  const mcp = await import(moduleUrl("app/mcp/route.ts"));
  const rpc = (name,args) => new Request("https://radar.test/mcp",{method:"POST",body:JSON.stringify({jsonrpc:"2.0",id:1,method:"tools/call",params:{name,arguments:args}})});
  globalThis.__proposalUser=null;
  assert.equal((await mcp.POST(rpc("radar_get_question_context",{jobId:"alice",questionId}))).status,401);
  globalThis.__proposalUser="alice";
  const mcpContext=(await (await mcp.POST(rpc("radar_get_question_context",{jobId:"alice",questionId}))).json()).result.structuredContent;
  assert.equal(mcpContext.contextDigest,context.contextDigest);
  assert.doesNotMatch(JSON.stringify(mcpContext),/BROUILLON_PRIVÉ|SECRET_NOTE|SECRET_PROVENANCE/);
  assert.equal((await (await mcp.POST(rpc("radar_save_answer_proposal",input))).json()).result.structuredContent.repeated,true);
  const proposalsRoute = await import(moduleUrl("app/api/application-questions/[id]/proposals/route.ts"));
  const proposalContext = {params:Promise.resolve({id:questionId})};
  assert.equal((await proposalsRoute.GET(new Request("https://radar.test"),proposalContext)).status,200);
  globalThis.__proposalUser="bob";
  assert.equal((await (await mcp.POST(rpc("radar_get_question_context",{jobId:"alice",questionId}))).json()).result.isError,true);
  assert.equal((await proposalsRoute.GET(new Request("https://radar.test"),proposalContext)).status,404);
  globalThis.__proposalUser=null;
  assert.equal((await proposalsRoute.GET(new Request("https://radar.test"),proposalContext)).status,401);
  globalThis.__proposalUser="alice";
  const concurrentInput={...input,id:"44444444-4444-4444-8444-444444444444"};
  const concurrent=await Promise.all([
    store.saveAnswerProposal("alice",concurrentInput),
    store.saveAnswerProposal("alice",concurrentInput),
  ]);
  assert.deepEqual(concurrent.map(result=>result.repeated).sort(),[false,true]);
  assert.equal(sqlite.prepare("SELECT count(*) AS n FROM application_answer_proposals WHERE id=?").get(concurrentInput.id).n,1);
  const collisionId="55555555-5555-4555-8555-555555555555";
  const collision=await Promise.allSettled([
    store.saveAnswerProposal("alice",{...input,id:collisionId,answer:"Première variante fictive"}),
    store.saveAnswerProposal("alice",{...input,id:collisionId,answer:"Autre variante fictive"}),
  ]);
  assert.equal(collision.filter(result=>result.status==="fulfilled").length,1);
  assert.match(collision.find(result=>result.status==="rejected").reason.message,/identifiant déjà utilisé/);
  assert.equal(sqlite.prepare("SELECT count(*) AS n FROM application_answer_proposals WHERE id=?").get(collisionId).n,1);
  sqlite.prepare("UPDATE experience_items SET application_allowed=0,application_consent='declined' WHERE id='oauth-alice'").run();
  const revoked = await store.getQuestionGenerationContext("alice","alice",questionId);
  assert.equal(revoked.facts.length,0);
  await assert.rejects(store.saveAnswerProposal("alice",{...input,id:crypto.randomUUID()}),/contexte a changé/);
  assert.equal((await store.listAnswerProposals("alice",questionId)).length,3,"la révocation ne supprime pas les variantes déjà préparées");
  sqlite.close();
});

test("contrat MCP : outils privés, aucun moteur facturé ni rédaction silencieuse dans la route HTTP", () => {
  const mcp=readFileSync(resolve(root,"app/mcp/route.ts"),"utf8");
  const ui=readFileSync(resolve(root,"components/application-questions.tsx"),"utf8");
  assert.match(mcp,/radar_get_question_context/);assert.match(mcp,/radar_save_answer_proposal/);
  assert.match(mcp,/getChatGPTUser\(\)/);assert.match(mcp,/user\.userId/);
  assert.match(ui,/Copier la demande ChatGPT/);assert.match(ui,/Actualiser les propositions/);
  assert.match(ui,/Ouvrir ChatGPT/);assert.match(ui,/https:\/\/chatgpt\.com\//);
  assert.doesNotMatch(mcp+ui,/OPENAI_API_KEY|api\.openai\.com|anthropic\.com/);
});
