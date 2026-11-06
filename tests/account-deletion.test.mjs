import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import ts from "typescript";
import { BACKUP_TABLES } from "../lib/account-backup-format.mjs";

const source = readFileSync(new URL("../lib/account-deletion.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
  .replace('"./account-backup-format.mjs"', JSON.stringify(new URL("../lib/account-backup-format.mjs", import.meta.url).href));
const { deleteAccount, accountStoragePrefixes, DELETE_CONFIRMATION, AccountDeletionError } = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));

const migrations = readdirSync(new URL("../drizzle/", import.meta.url)).filter(name => /^\d+.*\.sql$/.test(name)).sort();

function fixture({ failDelete = false } = {}) {
  const state = { failDelete };
  const sqlite = new DatabaseSync(":memory:");
  for (const name of migrations) sqlite.exec(readFileSync(new URL("../drizzle/" + name, import.meta.url), "utf8"));
  const objects = new Map();
  for (const user of ["alice", "bob"]) {
    sqlite.prepare("INSERT INTO profiles(user_id,data) VALUES(?,?)").run(user, JSON.stringify({ headline: "Profil " + user }));
    sqlite.prepare("INSERT INTO jobs(id,user_id,fingerprint,title) VALUES(?,?,?,?)").run("job-" + user, user, "meme-offre", "Même offre");
    sqlite.prepare("INSERT INTO documents(id,user_id,original_name,object_key,content_type,size) VALUES(?,?,?,?,?,?)").run("doc-" + user, user, "cv.pdf", `users/${user}/cv.pdf`, "application/pdf", 3);
    sqlite.prepare("INSERT INTO application_boards(user_id,data) VALUES(?,?)").run(user, "{}");
    sqlite.prepare("INSERT INTO workspace_writes(user_id,key,version,value,created_at) VALUES(?,?,?,?,?)").run(user, "note", 1, "Note", "now");
    sqlite.prepare("INSERT INTO source_settings(id,user_id,source) VALUES(?,?,?)").run("src-" + user, user, "Apec");
    sqlite.prepare("INSERT INTO experience_items(id,user_id,kind,data,created_at,updated_at) VALUES(?,?,?,?,?,?)").run("exp-" + user, user, "experience", "{}", "now", "now");
    sqlite.prepare("INSERT INTO application_questions(id,user_id,job_id,question,created_at,updated_at) VALUES(?,?,?,?,?,?)").run("q-" + user, user, "job-" + user, "Pourquoi ?", "now", "now");
    for (const key of [`users/${user}/cv.pdf`, `users/${user}/autre.md`, `demo/${user}/exemple.md`]) objects.set(key, { key });
  }
  // A neighbouring prefix must survive: « alice2 » is another account.
  objects.set("users/alice2/cv.pdf", { key: "users/alice2/cv.pdf" });
  const db = {
    prepare(sql) {
      let values = [];
      return {
        bind(...args) { values = args; return this; },
        async all() { return { success: true, results: sqlite.prepare(sql).all(...values) }; },
        execute() {
          if (/^\s*SELECT/i.test(sql)) return { success: true, results: sqlite.prepare(sql).all(...values), meta: {} };
          if (state.failDelete && /jobs/.test(sql)) throw new Error("panne simulée");
          return { success: true, results: [], meta: { changes: Number(sqlite.prepare(sql).run(...values).changes) } };
        },
      };
    },
    async batch(statements) { sqlite.exec("BEGIN"); try { const rows = statements.map(s => s.execute()); sqlite.exec("COMMIT"); return rows; } catch (e) { sqlite.exec("ROLLBACK"); throw e; } },
  };
  const bucket = {
    async list({ prefix, limit = 1000 }) { return { truncated: false, objects: [...objects.values()].filter(o => o.key.startsWith(prefix)).slice(0, limit) }; },
    async delete(keys) { for (const key of [].concat(keys)) objects.delete(key); },
  };
  const count = user => BACKUP_TABLES.reduce((sum, table) => sum + Number(sqlite.prepare(`SELECT COUNT(*) AS n FROM "${table}" WHERE user_id = ?`).get(user).n), 0);
  return { sqlite, db, bucket, objects, count, state };
}

test("suppression : tout le compte A est effacé, le compte B et un préfixe voisin restent intacts", async () => {
  const { db, bucket, objects, count } = fixture();
  const bobBefore = count("bob");
  const result = await deleteAccount(db, bucket, "alice");
  assert.equal(count("alice"), 0);
  assert.equal(result.rows, 8);
  assert.equal(result.files, 3);
  assert.equal(count("bob"), bobBefore);
  assert.deepEqual([...objects.keys()].sort(), ["demo/bob/exemple.md", "users/alice2/cv.pdf", "users/bob/autre.md", "users/bob/cv.pdf"]);
});

test("suppression : relancer après une panne termine le travail sans rien laisser", async () => {
  const { db, bucket, objects, count, state } = fixture({ failDelete: true });
  await assert.rejects(deleteAccount(db, bucket, "alice"));
  // The D1 batch rolled back as a whole: no half-deleted rows. Files go first, so no CV outlives its record.
  assert.equal(count("alice"), 8);
  assert.equal(objects.has("users/alice/cv.pdf"), false);
  state.failDelete = false;
  const retry = await deleteAccount(db, bucket, "alice");
  assert.equal(retry.rows, 8);
  assert.equal(count("alice"), 0);
  assert.equal((await deleteAccount(db, bucket, "alice")).rows, 0);
});

test("suppression : une table inconnue bloque avant tout effacement", async () => {
  const { sqlite, db, bucket, objects, count } = fixture();
  sqlite.exec("CREATE TABLE new_private_table(user_id text, data text)");
  const before = count("alice");
  await assert.rejects(deleteAccount(db, bucket, "alice"), error => error instanceof AccountDeletionError && /schema-inattendu/.test(error.message));
  assert.equal(count("alice"), before);
  assert.ok(objects.has("users/alice/cv.pdf"));
});

test("suppression : identifiant de compte refusé s'il est vide ou contient un chemin", async () => {
  const { db, bucket } = fixture();
  for (const userId of ["", "../bob", "a/b"]) await assert.rejects(deleteAccount(db, bucket, userId), error => error.status === 401);
});

test("suppression : préfixes de stockage du compte et mot de confirmation", () => {
  assert.deepEqual(accountStoragePrefixes("alice"), ["users/alice/", "lot0-fictional-probes/alice/", "demo/alice/"]);
  assert.equal(DELETE_CONFIRMATION, "SUPPRIMER");
});

test("API : propriétaire tiré de la session, confirmation exacte, démo et origine croisée refusées", () => {
  const route = readFileSync(new URL("../app/api/account/route.ts", import.meta.url), "utf8");
  assert.match(route, /deleteAccount\(env\.DB, env\.BUCKET, user\.userId\)/);
  assert.match(route, /body\.confirmation\.trim\(\) !== DELETE_CONFIRMATION/);
  assert.match(route, /startsWith\("demo:"\)/);
  assert.match(route, /ensureSameOrigin\(request\)/);
  assert.doesNotMatch(route, /export async function (GET|POST|PUT)/);
});
