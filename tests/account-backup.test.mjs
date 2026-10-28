import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import ts from "typescript";
import { BACKUP_TABLES, BACKUP_FORMAT, V2_BACKUP_FORMAT, V2_BACKUP_TABLES, LEGACY_BACKUP_TABLES, LEGACY_BACKUP_FORMAT, canonical, sha256 } from "../lib/account-backup-format.mjs";
import { verifyBackup, restoreBackup, compareBackups } from "../scripts/verify-private-backup.mjs";
const source = readFileSync(new URL("../lib/account-backup.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText.replace('"./account-backup-format.mjs"', JSON.stringify(new URL("../lib/account-backup-format.mjs", import.meta.url).href));
const { createAccountBackup } = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
function fixture() {
  const sqlite = new DatabaseSync(":memory:");
  for (const name of ["0000_unusual_alex_power.sql", "0001_elite_robin_chapel.sql", "0002_sloppy_glorian.sql", "0003_first_marvel_apes.sql", "0004_nostalgic_terror.sql", "0005_clear_black_bird.sql", "0006_confused_ego.sql", "0007_easy_banshee.sql", "0008_friendly_guardsmen.sql", "0009_friendly_spencer_smythe.sql", "0010_messy_mac_gargan.sql", "0011_low_vanisher.sql", "0012_futuristic_slipstream.sql"]) sqlite.exec(readFileSync(new URL("../drizzle/" + name, import.meta.url), "utf8"));
  const long = "Texte privé complet avec accents et ".repeat(2000);
  const objects = new Map();
  for (const user of ["alice", "bob"]) {
    const key = `users/${user}/same-name.md`;
    const content = Buffer.from(long + user);
    sqlite.prepare("INSERT INTO profiles(user_id,data) VALUES(?,?)").run(user, JSON.stringify({ notes: long + user }));
    sqlite.prepare("INSERT INTO documents(id,user_id,original_name,object_key,content_type,size) VALUES(?,?,?,?,?,?)").run("doc-" + user, user, "same-name.md", key, "text/markdown", content.length);
    sqlite.prepare("INSERT INTO jobs(id,user_id,fingerprint,title,description) VALUES(?,?,?,?,?)").run("job-" + user, user, "identical", "Même offre", long + user);
    sqlite.prepare("INSERT INTO application_boards(user_id,data) VALUES(?,?)").run(user, JSON.stringify({ columns: ["Entretien RH"] }));
    sqlite.prepare("INSERT INTO workspace_writes(user_id,key,version,value,created_at) VALUES(?,?,?,?,?)").run(user,"draft:job-"+user,1,"Note sauvegardée", "now");
    sqlite.prepare("INSERT INTO application_questions(id,user_id,job_id,question,answer,created_at,updated_at) VALUES(?,?,?,?,?,?,?)")
      .run("question-"+user,user,"job-"+user,"Question fictive", "Brouillon privé "+user,"now","now");
    sqlite.prepare("INSERT INTO application_answer_revisions(id,user_id,question_id,version,question,answer,created_at) VALUES(?,?,?,?,?,?,?)")
      .run("revision-"+user,user,"question-"+user,1,"Question fictive","Brouillon privé "+user,"now");
    sqlite.prepare("INSERT INTO application_answer_proposals(id,user_id,job_id,question_id,question_text,answer,language,context_digest,created_at) VALUES(?,?,?,?,?,?,?,?,?)")
      .run("proposal-"+user,user,"job-"+user,"question-"+user,"Question fictive","Variante fictive "+user,"fr","a".repeat(64),"now");
    objects.set(key, { key, version: "v1", etag: "e1", size: content.length, uploaded: new Date("2026-10-16"), storageClass: "Standard", httpMetadata: { contentType: "text/markdown" }, customMetadata: {}, async arrayBuffer() { return content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength); } });
  }
  const queries = [];
  const db = {
    prepare(sql) { queries.push(sql); let values = []; return { bind(...args) { values = args; return this; }, execute() { return { success: true, results: sqlite.prepare(sql).all(...values) }; } }; },
    async batch(statements) { sqlite.exec("BEGIN"); try { const rows = statements.map(s => s.execute()); sqlite.exec("COMMIT"); return rows; } catch (e) { sqlite.exec("ROLLBACK"); throw e; } },
  };
  const bucket = { async list({ prefix }) { return { truncated: false, objects: [...objects.values()].filter(o => o.key.startsWith(prefix)) }; }, async get(key) { return objects.get(key) ?? null; } };
  return { sqlite, db, bucket, objects, queries };
}
test("sauvegarde intégrale A/B : noms/contenus/offres identiques, aucune donnée croisée ni écriture", async () => {
  const f = fixture();
  try {
    const before = f.sqlite.serialize();
    const [a, b] = await Promise.all([createAccountBackup(f.db, f.bucket, "alice"), createAccountBackup(f.db, f.bucket, "bob")]);
    assert.deepEqual(Object.keys(a.database.tables), BACKUP_TABLES);
    assert(a.database.tables.jobs[0].description.length > 50000);
    assert.equal(a.manifest.files.length, 1);
    assert.equal(a.manifest.format,BACKUP_FORMAT);
    assert.equal(a.database.tables.application_questions[0].answer,"Brouillon privé alice");
    assert.equal(a.database.tables.application_answer_proposals[0].answer,"Variante fictive alice");
    assert.equal(a.database.tables.workspace_writes[0].value,"Note sauvegardée");
    assert.equal(a.database.tables.application_boards[0].user_id,"alice");
    assert(a.files.every(o => o.key.startsWith("users/alice/")));
    assert.doesNotMatch(JSON.stringify(a), /job-bob|doc-bob|users\/bob/);
    assert.equal(b.database.tables.profiles[0].user_id, "bob");
    await verifyBackup(a); await verifyBackup(b);
    compareBackups(a, await createAccountBackup(f.db, f.bucket, "alice"));
    assert.deepEqual(f.sqlite.serialize(), before);
    assert(f.queries.every(q => q.startsWith("SELECT")));
  } finally { f.sqlite.close(); }
});
test("restauration locale complète, relecture, refus d’écrasement et altération détectée", async () => {
  const f = fixture();
  try {
    const backup = await createAccountBackup(f.db, f.bucket, "alice");
    const root = await mkdtemp(join(tmpdir(), "radar-backup-test-"));
    const { writeFile } = await import("node:fs/promises");
    const file = join(root, "backup.json"); await writeFile(file, JSON.stringify(backup), { mode: 0o600 });
    const proof = await restoreBackup(file, join(root, "restore"));
    assert(proof.fullRowComparison && proof.fullFileReadback);
    assert.equal(proof.counts.jobs, 1);
    assert.equal(proof.counts.application_answer_proposals,1);
    assert.equal(proof.counts.workspace_writes,1);
    assert.equal(proof.counts.application_boards,1);
    assert.equal(proof.referenceDiagnostics.proposalsWithoutQuestion,0);
    assert.equal(JSON.parse(await readFile(join(root, "restore", "preuve-restauration.json"), "utf8")).integrityCheck, "ok");
    await assert.rejects(restoreBackup(file, join(root, "restore")), /EEXIST/);
    const corrupt = structuredClone(backup); corrupt.files[0].content = "YmFk";
    await assert.rejects(verifyBackup(corrupt));
    const changed = structuredClone(backup); changed.database.tables.profiles[0].data = "{}";
    await assert.rejects(verifyBackup(changed));
    assert.throws(() => compareBackups(backup, changed));
  } finally { f.sqlite.close(); }
});
test("une sauvegarde v1 reste restaurable après l’ajout des questions et variantes", async () => {
  const f=fixture();
  try {
    const legacy=structuredClone(await createAccountBackup(f.db,f.bucket,"alice"));
    legacy.manifest.format=LEGACY_BACKUP_FORMAT;
    for(const table of BACKUP_TABLES.filter(name=>!LEGACY_BACKUP_TABLES.includes(name))){
      delete legacy.database.tables[table];delete legacy.manifest.tables[table];
    }
    legacy.database.schema=legacy.database.schema.filter(row=>LEGACY_BACKUP_TABLES.includes(row.tbl_name));
    legacy.manifest.databaseSha256=await sha256(canonical(legacy.database));
    await verifyBackup(legacy);
    const root=await mkdtemp(join(tmpdir(),"radar-backup-v1-test-"));
    const {writeFile}=await import("node:fs/promises");
    const file=join(root,"backup-v1.json");await writeFile(file,JSON.stringify(legacy),{mode:0o600});
    const proof=await restoreBackup(file,join(root,"restore-v1"));
    assert.equal(proof.format,LEGACY_BACKUP_FORMAT);assert.equal(proof.counts.jobs,1);
    assert.equal(proof.fullRowComparison,true);
  } finally {f.sqlite.close();}
});
test("une sauvegarde v2 reste restaurable après l’ajout des colonnes Kanban et du journal", async () => {
  const f=fixture();
  try {
    const previous=structuredClone(await createAccountBackup(f.db,f.bucket,"alice"));
    previous.manifest.format=V2_BACKUP_FORMAT;
    for(const table of BACKUP_TABLES.filter(name=>!V2_BACKUP_TABLES.includes(name))){
      delete previous.database.tables[table];delete previous.manifest.tables[table];
    }
    previous.database.schema=previous.database.schema.filter(row=>V2_BACKUP_TABLES.includes(row.tbl_name));
    previous.manifest.databaseSha256=await sha256(canonical(previous.database));
    await verifyBackup(previous);
    const root=await mkdtemp(join(tmpdir(),"radar-backup-v2-test-"));
    const {writeFile}=await import("node:fs/promises");
    const file=join(root,"backup-v2.json");await writeFile(file,JSON.stringify(previous),{mode:0o600});
    const proof=await restoreBackup(file,join(root,"restore-v2"));
    assert.equal(proof.format,V2_BACKUP_FORMAT);assert.equal(proof.counts.jobs,1);
    assert.equal(proof.fullRowComparison,true);
  } finally {f.sqlite.close();}
});
test("refus complet si original manquant, namespace incorrect, fichier changeant, table inconnue ou identité absente", async () => {
  const f = fixture();
  try {
    await assert.rejects(createAccountBackup(f.db, f.bucket, ""), /Authentification/);
    await assert.rejects(createAccountBackup(f.db, f.bucket, "alice/../bob"), /Authentification/);
    const original = f.objects.get("users/alice/same-name.md"); f.objects.delete(original.key);
    await assert.rejects(createAccountBackup(f.db, f.bucket, "alice"), /complète/);
    f.objects.set(original.key, original);
    await assert.rejects(createAccountBackup(f.db, { ...f.bucket, async get() { return { ...original, etag: "changed" }; } }, "alice"), /complète/);
    f.sqlite.exec("CREATE TABLE unexpected_business_table (id TEXT)");
    await assert.rejects(createAccountBackup(f.db, f.bucket, "alice"), /complète/);
  } finally { f.sqlite.close(); }
});
test("export HTTP : authentification serveur, pas de sélection de propriétaire, pas de cache ni outil MCP", () => {
  const route = readFileSync(new URL("../app/api/backup/route.ts", import.meta.url), "utf8");
  assert.match(route, /getChatGPTUser/); assert.match(route, /status: 401/);
  assert.match(route, /user\.userId/); assert.match(route, /private, no-store/);
  assert.match(route, /new URL\(request.url\).search/); assert.match(route, /cross-site/);
  assert.doesNotMatch(route, /request\.json|console\.|export async function (POST|PATCH|DELETE)/);
  assert.doesNotMatch(readFileSync(new URL("../app/mcp/route.ts", import.meta.url), "utf8"), /createAccountBackup|radar_export/);
});
test("route HTTP exécutée : 401 anonyme, paramètres et origine refusés, téléchargement privé complet", async () => {
  const f = fixture();
  try {
    globalThis.__backupHttpEnv = { DB: f.db, BUCKET: f.bucket };
    globalThis.__backupHttpUser = null;
    let code = ts.transpileModule(readFileSync(new URL("../app/api/backup/route.ts", import.meta.url), "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
    code = code.replace('"cloudflare:workers"', '"data:text/javascript,export const env=globalThis.__backupHttpEnv"').replace('"@/app/chatgpt-auth"', '"data:text/javascript,export async function getChatGPTUser(){return globalThis.__backupHttpUser}"').replace('"@/lib/account-backup"', JSON.stringify("data:text/javascript;base64," + Buffer.from(js).toString("base64")));
    const { GET } = await import("data:text/javascript;base64," + Buffer.from(code).toString("base64"));
    assert.equal((await GET(new Request("https://radar.test/api/backup"))).status, 401);
    globalThis.__backupHttpUser = { userId: "alice" };
    assert.equal((await GET(new Request("https://radar.test/api/backup?userId=bob"))).status, 403);
    assert.equal((await GET(new Request("https://radar.test/api/backup", { headers: { "Sec-Fetch-Site": "cross-site" } }))).status, 403);
    const response = await GET(new Request("https://radar.test/api/backup"));
    assert.equal(response.status, 200);
    assert.match(response.headers.get("Cache-Control"), /no-store/);
    assert.match(response.headers.get("Content-Disposition"), /attachment/);
    const backup = await response.json(); await verifyBackup(backup);
    assert.equal(backup.database.tables.profiles[0].user_id, "alice");
    assert.doesNotMatch(JSON.stringify(backup), /job-bob|doc-bob|users\/bob/);
  } finally { f.sqlite.close(); delete globalThis.__backupHttpUser; delete globalThis.__backupHttpEnv; }
});
test("une modification pendant l’export ou un dépassement de volume ne produit pas un faux succès", async () => {
  const f = fixture();
  try {
    const changing = { ...f.bucket, async get(key) { f.sqlite.prepare("UPDATE jobs SET title=? WHERE user_id=?").run("Modifié pendant la lecture", "alice"); return f.bucket.get(key); } };
    await assert.rejects(createAccountBackup(f.db, changing, "alice"), /complète/);
    const oversized = { ...f.bucket, async list() { return { truncated: false, objects: [{ ...f.objects.get("users/alice/same-name.md"), size: 17 * 1024 * 1024 }] }; } };
    await assert.rejects(createAccountBackup(f.db, oversized, "alice"));
    const incompletePage = { ...f.bucket, async list() { return { truncated: true, objects: [], cursor: undefined }; } };
    await assert.rejects(createAccountBackup(f.db, incompletePage, "alice"), /complète/);
  } finally { f.sqlite.close(); }
});
test("journal technique Sites observé : schéma inventorié séparément, jamais confondu avec les données métier", async () => {
  const f = fixture();
  try {
    f.sqlite.exec("CREATE TABLE __appgarden_migrations (fixture_id TEXT)");
    const backup = await createAccountBackup(f.db, f.bucket, "alice");
    assert.equal(backup.database.platformSchema[0].name, "__appgarden_migrations");
    assert.deepEqual(Object.keys(backup.database.tables), BACKUP_TABLES);
    await verifyBackup(backup);
  } finally { f.sqlite.close(); }
});
