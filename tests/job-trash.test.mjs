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

test("corbeille SQLite : isolation A/B, relance, réimport, rappels et restauration sans perte", async () => {
  const sqlite = new DatabaseSync(":memory:");
  let queryCount = 0;
  for (const file of readdirSync(resolve(root, "drizzle")).filter(name => name.endsWith(".sql")).sort()) sqlite.exec(readFileSync(resolve(root, "drizzle", file), "utf8"));
  function prepare(sql) { let args = []; return {
    bind(...values) { args = values; return this; },
    async all() { return { results: sqlite.prepare(sql).all(...args) }; },
    async raw() { queryCount++; const stmt = sqlite.prepare(sql); stmt.setReturnArrays(true); return stmt.all(...args); },
    async run() { return sqlite.prepare(sql).run(...args); },
  }; }
  globalThis.__trashEnv = { DB: { prepare, async batch(statements) {
    sqlite.exec("BEGIN");
    try { const results = []; for (const statement of statements) results.push(await statement.all()); sqlite.exec("COMMIT"); return results; }
    catch (error) { sqlite.exec("ROLLBACK"); throw error; }
  } } };
  const store = await import(moduleUrl("lib/job-store.ts"));
  const interviews = await import(moduleUrl("lib/interview-store.ts"));
  const route = await import(moduleUrl("app/api/jobs/[id]/route.ts"));
  const restore = await import(moduleUrl("app/api/jobs/[id]/restore/route.ts"));
  const bulk = await import(moduleUrl("app/api/jobs/trash/route.ts"));
  const input = { title: "Product Manager fictif", company: "Atlas fictif", contractType: "cdi", annualSalary: 65000, remoteMode: "full_remote", language: "fr", source: "Ajout manuel", description: "Mission fictive de gestion de produit." };
  const a = (await store.saveOffer("alice", input)).job;
  const b = (await store.saveOffer("bob", input)).job;
  globalThis.__trashUser = "alice";
  const apply = status => route.PATCH(new Request("https://radar.test/api/jobs/" + a.id, { method: "PATCH", body: JSON.stringify({ status }) }), { params: Promise.resolve({ id: a.id }) });
  assert.equal((await apply("applied")).status, 200);
  const appliedAt = sqlite.prepare("SELECT applied_at AS appliedAt FROM jobs WHERE id=?").get(a.id).appliedAt;
  assert.match(appliedAt, /^\d{4}-\d\d-\d\dT/);
  assert.equal((await store.getOffer("alice", a.id)).appliedAt, appliedAt);
  assert.equal((await apply("interview")).status, 200);
  assert.equal((await apply("applied")).status, 200);
  assert.equal(sqlite.prepare("SELECT applied_at AS appliedAt FROM jobs WHERE id=?").get(a.id).appliedAt, appliedAt);
  sqlite.prepare("UPDATE jobs SET status='interview' WHERE id=?").run(a.id);
  sqlite.prepare("INSERT INTO profiles(user_id,data) VALUES(?,?)").run("alice", JSON.stringify({ applicationNotes: { [a.id]: "Note fictive conservée" } }));
  sqlite.prepare("INSERT INTO workspace_writes(user_id,key,version,value,created_at) VALUES(?,?,?,?,?)").run("alice", `note:${a.id}`, 1, "Note fictive actualisée", "2026-01-01T08:00:00Z");
  assert.equal((await store.getOffer("alice", a.id)).candidateNote, "Note fictive actualisée", "la lecture ciblée conserve la dernière note");
  assert.equal((await store.listOffers("alice"))[0].candidateNote, "Note fictive actualisée", "la liste et le détail concordent");
  sqlite.prepare("INSERT INTO interviews(id,user_id,job_id,label,start_at,end_at,time_zone) VALUES(?,?,?,?,?,?,?)").run("entretien-fictif", "alice", a.id, "Échange fictif", "2026-01-01T09:00:00Z", "2026-01-01T10:00:00Z", "Europe/Paris");
  const beforeMoves = await store.getOffer("alice", a.id);
  const profileBeforeMoves = sqlite.prepare("SELECT data FROM profiles WHERE user_id='alice'").get().data;
  for (const status of ["applied", "offer", "rejected", "withdrawn", "interview"]) {
    const response = await apply(status); assert.equal(response.status, 200);
    const moved = (await response.json()).job;
    assert.equal(moved.status, status);
    assert.equal(moved.candidateNote, beforeMoves.candidateNote, "une étape ne modifie pas la note");
    assert.deepEqual(moved.interviews, JSON.parse(JSON.stringify(beforeMoves.interviews)), "une étape ne réécrit pas les rendez-vous ou bilans");
    assert.equal(moved.appliedAt, beforeMoves.appliedAt, "la date d’origine reste conservée");
    assert.equal(sqlite.prepare("SELECT data FROM profiles WHERE user_id='alice'").get().data, profileBeforeMoves);
  }
  const before = await store.getOffer("alice", a.id);
  const ctx = id => ({ params: Promise.resolve({ id }) });
  const req = origin => new Request("https://radar.test/api/jobs/" + a.id, { method: "DELETE", headers: origin ? { Origin: origin } : {} });
  globalThis.__trashUser = null;
  assert.equal((await route.DELETE(req(), ctx(a.id))).status, 401);
  assert.equal((await restore.POST(req(), ctx(a.id))).status, 401);
  globalThis.__trashUser = "alice";
  assert.equal((await route.DELETE(req("https://evil.test"), ctx(a.id))).status, 403);
  assert.equal((await restore.POST(req("https://evil.test"), ctx(a.id))).status, 403);
  assert.equal((await route.DELETE(req(), ctx(b.id))).status, 404);
  assert.equal((await restore.POST(req(), ctx(b.id))).status, 404);
  assert.equal((await interviews.dueInterviews("alice")).length, 1);
  const first = await (await route.DELETE(req(), ctx(a.id))).json();
  assert(first.deletedAt);
  assert.deepEqual(await (await route.DELETE(req(), ctx(a.id))).json(), first);
  assert.equal((await store.listOffers("alice")).length, 0);
  assert.equal(await store.getOffer("alice", a.id), undefined);
  assert.equal((await store.listOffers("alice", undefined, true)).length, 1);
  assert.equal((await interviews.dueInterviews("alice")).length, 1, "une candidature engagée conserve son rappel");
  assert.equal((await store.listOffers("bob")).length, 1);
  const reimport = await store.saveOffer("alice", input);
  assert(reimport.deduplicated); assert.equal(reimport.job.id, a.id); assert.equal(reimport.job.deletedAt, first.deletedAt);
  assert.equal((await store.listOffers("alice")).length, 0);
  assert.equal((await route.PATCH(new Request("https://radar.test/api/jobs/" + a.id, { method: "PATCH", body: JSON.stringify({ status: "interview" }) }), ctx(a.id))).status, 200, "le suivi engagé reste modifiable");
  const afterPatch = await store.getOffer("alice", a.id, true);
  afterPatch.deletedAt = undefined;
  afterPatch.dismissalReason = undefined;
  await assert.rejects(store.updateOffer("alice", a.id, { description: "changed" }), /introuvable/);
  const restored = await restore.POST(req(), ctx(a.id)); assert.equal(restored.status, 200);
  await restore.POST(req(), ctx(a.id));
  assert.deepEqual(await store.getOffer("alice", a.id), afterPatch);
  assert.equal((await interviews.dueInterviews("alice")).length, 1);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM jobs").get().n, 2);
  const requestBulk = (body, origin) => new Request("https://radar.test/api/jobs/trash", { method: "POST", headers: origin ? { Origin: origin } : {}, body: JSON.stringify(body) });
  globalThis.__trashUser = null;
  assert.equal((await bulk.POST(requestBulk({ ids: [a.id], deleted: true }))).status, 401);
  globalThis.__trashUser = "alice";
  assert.equal((await bulk.POST(requestBulk({ ids: [a.id], deleted: true }, "https://evil.test"))).status, 403);
  for (const ids of [[], Array(51).fill(a.id), [12]]) assert.equal((await bulk.POST(requestBulk({ ids, deleted: true }))).status, 400);
  assert.equal((await bulk.POST(requestBulk({ ids: [a.id], deleted: true, userId: "bob" }))).status, 400);
  const mixed = await bulk.POST(requestBulk({ ids: [a.id, b.id, "absent", a.id], deleted: true }));
  assert.deepEqual((await mixed.json()).results.map(row => row.id), [a.id]);
  assert.equal((await store.getOffer("alice", a.id, true)).dismissalReason, undefined);
  assert.equal((await store.listOffers("bob")).length, 1);
  const ids = [a.id];
  for (let i = 1; i < 50; i++) ids.push((await store.saveOffer("alice", { ...input, company: `Fictif ${i}` })).job.id);
  const beforeBatch = queryCount;
  const results = await store.setOffersDeleted("alice", ids, true);
  assert.equal(queryCount - beforeBatch, 1, "50 offres supprimées en UNE requête SQL");
  assert.equal(results.length, 50);
  assert.deepEqual(await store.setOffersDeleted("alice", ids, true), results, "relance sans réécriture des dates");
  assert.equal((await store.listOffers("alice")).length, 0);
  const restoredBatch = await bulk.POST(requestBulk({ ids, deleted: false }));
  assert.equal((await restoredBatch.json()).results.length, 50);
  assert.deepEqual(await store.getOffer("alice", a.id), afterPatch);
  assert.equal((await store.listOffers("alice")).length, 50);
  const linked = (await store.saveOffer("alice", { ...input, company: "Source vérifiée", source: "Malt", sourceUrl: "https://example.test/jobs/123" })).job;
  const closure = { id: linked.id, source: "Malt", sourceUrl: "https://example.test/jobs/123", reason: "applications_closed", evidence: "Les candidatures sont fermées pour cette mission." };
  await assert.rejects(store.markOfferClosedFromSource("alice", { ...closure, evidence: "La page demande une connexion." }), /Fermeture non explicite/);
  await assert.rejects(store.markOfferClosedFromSource("alice", { ...closure, sourceUrl: "https://example.test/jobs/other" }), /non attribuable/);
  await assert.rejects(store.markOfferClosedFromSource("bob", closure), /non attribuable/);
  const closed = await store.markOfferClosedFromSource("alice", closure);
  assert(closed.changed); assert.equal(closed.job.dismissalReason, "applications_closed");
  assert.equal((await store.markOfferClosedFromSource("alice", closure)).changed, false);
  await store.setOfferDeleted("alice", linked.id, false);
  assert.equal((await store.markOfferClosedFromSource("alice", closure)).changed, false, "restauration humaine non annulée par la même alerte");
  assert.equal((await store.getOffer("alice", linked.id)).deletedAt, undefined);
  const beforeFacts=await store.getOffer("alice",a.id);
  const facts={remoteMode:"hybrid",language:"professional_en",remoteCountry:"MU",onsiteDaysPerWeek:1,onsiteDaysPerMonth:3,description:"Description fictive enrichie."};
  const enriched=await store.updateOffer("alice",a.id,facts);
  assert.equal(enriched.remoteCountry,"MU");assert.equal(enriched.onsiteDaysPerWeek,1);assert.equal(enriched.onsiteDaysPerMonth,3);
  assert.equal(enriched.status,beforeFacts.status);assert.equal(enriched.candidateNote,beforeFacts.candidateNote);assert.deepEqual(enriched.interviews,beforeFacts.interviews);
  assert.equal((await store.getOffer("bob",b.id)).remoteMode,"full_remote");
  await assert.rejects(store.updateOffer("bob",a.id,facts),/introuvable/);
  await assert.rejects(store.updateOffer("alice",a.id,{remoteCountry:"ZZ"}));
  await assert.rejects(store.updateOffer("alice",a.id,{onsiteDaysPerWeek:6}));
  await store.updateOffer("alice",a.id,{onsiteDaysPerWeek:null,onsiteDaysPerMonth:null,remoteCountry:""});
  const cleared=await store.getOffer("alice",a.id);assert.equal(cleared.onsiteDaysPerWeek,null);assert.equal(cleared.remoteCountry,undefined);
  const incomplete=(await store.saveOffer("alice",{title:"Product Owner test",source:"Free-Work",contractType:"other",remoteMode:"unknown",language:"unknown"})).job;
  const completed=await store.updateOffer("alice",incomplete.id,{description:"Contrat : CDI\nSalaire annuel brut : 68 000 €\nAnglais professionnel requis"});
  assert.equal(completed.contractType,"cdi");assert.equal(completed.annualSalary,68000);assert.equal(completed.language,"professional_en");
  const now = new Date("2026-11-04T12:00:00.000Z");
  const old = (await store.saveOffer("alice", { ...input, company: "Ancienne corbeille" })).job;
  const edge = (await store.saveOffer("alice", { ...input, company: "Corbeille dix jours" })).job;
  const recent = (await store.saveOffer("alice", { ...input, company: "Corbeille récente" })).job;
  await store.setOffersDeleted("alice", [old.id, edge.id, recent.id], true);
  await store.setOfferDeleted("bob", b.id, true);
  for (const [id, at] of [[old.id,"2026-10-24T11:59:59.000Z"],[edge.id,"2026-10-25T12:00:00.000Z"],[recent.id,"2026-10-26T12:00:00.000Z"],[b.id,"2026-10-01T00:00:00.000Z"]]) sqlite.prepare("UPDATE jobs SET deleted_at=? WHERE id=?").run(at,id);
  sqlite.prepare("INSERT INTO interviews(id,user_id,job_id,label,start_at,end_at,time_zone) VALUES(?,?,?,?,?,?,?)").run("old-interview","alice",old.id,"Échange fictif","2026-01-01T09:00:00Z","2026-01-01T10:00:00Z","Europe/Paris");
  sqlite.prepare("INSERT INTO application_questions(id,user_id,job_id,question,created_at,updated_at) VALUES(?,?,?,?,?,?)").run("old-question","alice",old.id,"Question fictive",now.toISOString(),now.toISOString());
  sqlite.prepare("INSERT INTO application_answer_revisions(id,user_id,question_id,version,question,answer,created_at) VALUES(?,?,?,?,?,?,?)").run("old-revision","alice","old-question",1,"Question fictive","Réponse fictive",now.toISOString());
  sqlite.prepare("INSERT INTO application_answer_proposals(id,user_id,job_id,question_id,question_text,answer,language,context_digest,created_at) VALUES(?,?,?,?,?,?,?,?,?)").run("old-proposal","alice",old.id,"old-question","Question fictive","Proposition fictive","fr","digest",now.toISOString());
  sqlite.prepare("INSERT INTO workspace_writes(user_id,key,version,value,created_at) VALUES(?,?,?,?,?)").run("alice",`note:${old.id}`,1,"À effacer",now.toISOString());
  sqlite.prepare("INSERT INTO workspace_writes(user_id,key,version,value,created_at) VALUES(?,?,?,?,?)").run("alice",`note:${recent.id}`,1,"À conserver",now.toISOString());
  const profile = JSON.parse(sqlite.prepare("SELECT data FROM profiles WHERE user_id='alice'").get().data);
  profile.applicationNotes = { ...profile.applicationNotes, [old.id]: "À effacer", [recent.id]: "À conserver" };
  sqlite.prepare("UPDATE profiles SET data=? WHERE user_id='alice'").run(JSON.stringify(profile));
  assert.equal(await store.purgeExpiredTrash("alice", now), 1);
  assert.equal(await store.purgeExpiredTrash("alice", now), 0, "purge répétée sans effet");
  assert.equal(await store.getOffer("alice", old.id, true), undefined);
  assert(await store.getOffer("alice", edge.id, true), "à exactement 10 jours, restauration possible");
  assert(await store.getOffer("alice", recent.id, true));
  assert(await store.getOffer("bob", b.id, true), "isolation des comptes");
  for (const table of ["interviews", "application_questions", "application_answer_revisions", "application_answer_proposals"]) {
    assert.equal(sqlite.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE id LIKE 'old-%'`).get().n, 0, table);
  }
  const remainingNotes = JSON.parse(sqlite.prepare("SELECT data FROM profiles WHERE user_id='alice'").get().data).applicationNotes;
  assert.equal(remainingNotes[old.id], undefined);
  assert.equal(remainingNotes[recent.id], "À conserver");
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM workspace_writes WHERE user_id='alice' AND key=?").get(`note:${old.id}`).n, 0);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM workspace_writes WHERE user_id='alice' AND key=?").get(`note:${recent.id}`).n, 1);
  sqlite.close();
});

test("sélection limitée à la vue ; mise à jour immédiate et retour après échec sans écraser les notes", async () => {
  const { applyTrashState, selectionInView } = await import(moduleUrl("lib/offer-trash-ui.ts"));
  const before = [{ id: "a", candidateNote: "avant" }, { id: "b" }];
  const pending = applyTrashState(before, [{ id: "a", deletedAt: "pending" }]);
  assert.equal(pending.filter(row => !row.deletedAt).length, 1);
  pending[0].candidateNote = "note plus récente";
  const rollback = applyTrashState(pending, before);
  assert.equal(rollback.filter(row => !row.deletedAt).length, 2);
  assert.equal(rollback[0].candidateNote, "note plus récente");
  assert.equal(before[0].candidateNote, "avant");
  assert.deepEqual(selectionInView([before[1]], ["a", "b"]).map(row => row.id), ["b"]);
  const many = Array.from({length: 70}, (_, i) => ({ id: String(i) }));
  assert.equal(selectionInView(many, many.map(row => row.id)).length, 50);
});
