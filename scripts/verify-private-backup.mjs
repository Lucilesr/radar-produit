// Offline only: no network, no cloud credentials, no production database writes.
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir, chmod } from "node:fs/promises";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { BACKUP_FORMAT, BACKUP_TABLES, V2_BACKUP_FORMAT, V2_BACKUP_TABLES, LEGACY_BACKUP_FORMAT, LEGACY_BACKUP_TABLES, canonical, sha256 } from "../lib/account-backup-format.mjs";

const tablesFor = format => format === BACKUP_FORMAT ? BACKUP_TABLES : format === V2_BACKUP_FORMAT ? V2_BACKUP_TABLES : format === LEGACY_BACKUP_FORMAT ? LEGACY_BACKUP_TABLES : null;

export async function verifyBackup(backup) {
  const tables = tablesFor(backup.manifest.format);
  assert(tables, "Format de sauvegarde inconnu");
  assert.equal(backup.manifest.complete, true);
  assert.equal(backup.manifest.scope, "authenticated-account-only");
  assert.deepEqual(Object.keys(backup.database.tables).sort(), [...tables].sort());
  assert.deepEqual(Object.keys(backup.manifest.tables).sort(), [...tables].sort());
  assert.equal(await sha256(canonical(backup.database)), backup.manifest.databaseSha256, "Empreinte de la base différente");
  const owners = new Set();
  for (const table of tables) {
    const rows = backup.database.tables[table];
    assert.equal(rows.length, backup.manifest.tables[table].count);
    assert.equal(await sha256(canonical(rows)), backup.manifest.tables[table].sha256, `Empreinte différente : ${table}`);
    for (const row of rows) {
      assert.equal(typeof row.user_id, "string"); owners.add(row.user_id);
      assert(Object.values(row).every(v => v === null || typeof v === "string" || typeof v === "number"));
    }
  }
  assert(owners.size <= 1, "Plusieurs propriétaires dans une même sauvegarde");
  const keys = new Set();
  for (const file of backup.files) {
    assert(!keys.has(file.key), "Objet dupliqué"); keys.add(file.key);
    assert.equal(file.encoding, "base64");
    const bytes = Buffer.from(file.content, "base64");
    assert.equal(bytes.toString("base64"), file.content, "Encodage incomplet");
    assert.equal(bytes.length, file.size);
    assert.equal(await sha256(bytes), file.sha256, "Empreinte fichier différente");
    if (owners.size) {
      const owner = [...owners][0];
      assert(file.key.startsWith(`users/${owner}/`) || file.key.startsWith(`lot0-fictional-probes/${encodeURIComponent(owner)}/`), "Objet hors du compte");
    }
  }
  assert.deepEqual(backup.files.map(({ content, encoding, ...metadata }) => metadata), backup.manifest.files);
  for (const doc of backup.database.tables.documents) assert(backup.files.some(f => f.key === doc.object_key && f.size === doc.size), "Original absent");
  return { counts: Object.fromEntries(tables.map(t => [t, backup.database.tables[t].length])), objectCount: backup.files.length, objectBytes: backup.files.reduce((n, f) => n + f.size, 0) };
}

export function compareBackups(a, b) {
  assert.equal(canonical(a.database), canonical(b.database), "Les données ont changé entre les deux exports");
  assert.equal(canonical(a.manifest.files), canonical(b.manifest.files), "Les fichiers ou métadonnées ont changé");
}

export async function restoreBackup(backupPath, outputDirectory) {
  const bytes = await readFile(backupPath);
  const backup = JSON.parse(bytes.toString("utf8"));
  const summary = await verifyBackup(backup);
  const tables = tablesFor(backup.manifest.format);
  assert(tables);
  // Exclusive creation: never replace an existing directory/database or original file.
  const output = resolve(outputDirectory);
  await mkdir(output, { mode: 0o700 });
  await mkdir(join(output, "objects"), { mode: 0o700 });
  const dbPath = join(output, "radar-restaure.sqlite");
  const db = new DatabaseSync(dbPath);
  await chmod(dbPath, 0o600);
  try {
    // Execute only the immutable, locally reviewed migrations, NEVER SQL from the backup.
    const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
    const migrations = ["0000_unusual_alex_power.sql", "0001_elite_robin_chapel.sql", "0002_sloppy_glorian.sql", "0003_first_marvel_apes.sql", "0004_nostalgic_terror.sql"];
    if (backup.manifest.format !== LEGACY_BACKUP_FORMAT) migrations.push("0005_clear_black_bird.sql", "0006_confused_ego.sql", "0007_easy_banshee.sql", "0008_friendly_guardsmen.sql");
    // Older v2 exports can already contain later job columns; select only reviewed migrations
    // that match the schema carried by the verified export.
    const jobSchema = backup.database.schema.find(row => row.name === "jobs")?.sql ?? "";
    if (jobSchema.includes("onsite_days_per_week")) migrations.push("0009_friendly_spencer_smythe.sql");
    if (jobSchema.includes("applied_at")) migrations.push("0010_messy_mac_gargan.sql");
    if (jobSchema.includes("board_column_id") || backup.manifest.format === BACKUP_FORMAT) migrations.push("0011_low_vanisher.sql");
    if (backup.manifest.format === BACKUP_FORMAT) migrations.push("0012_futuristic_slipstream.sql");
    for (const migration of migrations) db.exec(await readFile(join(root, "drizzle", migration), "utf8"));
    db.exec("BEGIN");
    try {
      for (const table of tables) {
      const columns = db.prepare(`PRAGMA table_info("${table}")`).all().map(c => c.name);
        const insert = db.prepare(`INSERT INTO "${table}" (${columns.map(c => '"' + c + '"').join(",")}) VALUES (${columns.map(() => "?").join(",")})`);
        for (const row of backup.database.tables[table]) {
          assert.deepEqual(Object.keys(row).sort(), [...columns].sort(), "Colonnes incompatibles avec la version du code");
          insert.run(...columns.map(c => row[c]));
        }
      }
      db.exec("COMMIT");
    } catch (error) { db.exec("ROLLBACK"); throw error; }
    const restoredHashes = {};
    for (const table of tables) {
      const order = table === "profiles" || table === "application_boards" ? "user_id" : table === "workspace_writes" ? 'user_id, "key", version' : "id";
      const rows = db.prepare(`SELECT * FROM "${table}" ORDER BY ${order}`).all();
      assert.equal(canonical(rows), canonical(backup.database.tables[table]), `Restauration différente : ${table}`);
      restoredHashes[table] = await sha256(canonical(rows));
    }
    assert.equal(db.prepare("PRAGMA integrity_check").get().integrity_check, "ok");
    assert.equal(db.prepare("SELECT COUNT(DISTINCT user_id) AS n FROM profiles").get().n, backup.database.tables.profiles.length);
    // Preserve any pre-existing dangling references as evidence rather than silently fixing them.
    const referenceDiagnostics = {
      interviewsWithoutJob: db.prepare("SELECT COUNT(*) AS n FROM interviews i LEFT JOIN jobs j ON i.job_id=j.id AND i.user_id=j.user_id WHERE j.id IS NULL").get().n,
      realizationsWithoutParent: db.prepare("SELECT COUNT(*) AS n FROM experience_items i LEFT JOIN experience_items p ON i.parent_id=p.id AND i.user_id=p.user_id WHERE i.parent_id IS NOT NULL AND p.id IS NULL").get().n,
      revisionsWithoutItem: db.prepare("SELECT COUNT(*) AS n FROM experience_revisions r LEFT JOIN experience_items i ON r.item_id=i.id AND r.user_id=i.user_id WHERE i.id IS NULL").get().n,
      ...(backup.manifest.format === BACKUP_FORMAT ? {
        questionsWithoutJob: db.prepare("SELECT COUNT(*) AS n FROM application_questions q LEFT JOIN jobs j ON q.job_id=j.id AND q.user_id=j.user_id WHERE j.id IS NULL").get().n,
        answerRevisionsWithoutQuestion: db.prepare("SELECT COUNT(*) AS n FROM application_answer_revisions r LEFT JOIN application_questions q ON r.question_id=q.id AND r.user_id=q.user_id WHERE q.id IS NULL").get().n,
        proposalsWithoutQuestion: db.prepare("SELECT COUNT(*) AS n FROM application_answer_proposals p LEFT JOIN application_questions q ON p.question_id=q.id AND p.user_id=q.user_id WHERE q.id IS NULL").get().n,
      } : {}),
    };
    const restoredObjects = [];
    for (const [index, file] of backup.files.entries()) {
      const relativePath = `objects/${String(index + 1).padStart(4, "0")}.bin`;
      const filePath = join(output, relativePath);
      await writeFile(filePath, Buffer.from(file.content, "base64"), { mode: 0o600, flag: "wx" });
      assert.equal(await sha256(await readFile(filePath)), file.sha256, "Relecture fichier restauré différente");
      const { content, encoding, ...metadata } = file;
      restoredObjects.push({ ...metadata, relativePath });
    }
    await writeFile(join(output, "objects-manifest.json"), JSON.stringify(restoredObjects, null, 2), { mode: 0o600, flag: "wx" });
    const proof = { format: backup.manifest.format, verifiedAt: new Date().toISOString(), sourceBackupSha256: await sha256(bytes), databaseSha256: backup.manifest.databaseSha256, ...summary, restoredHashes, integrityCheck: "ok", referenceDiagnostics, fullRowComparison: true, fullFileReadback: true, networkUsed: false, productionWritten: false };
    await writeFile(join(output, "preuve-restauration.json"), JSON.stringify(proof, null, 2), { mode: 0o600, flag: "wx" });
    return proof;
  } finally { db.close(); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv[2] === "--compare") {
      const [a, b] = await Promise.all(process.argv.slice(3, 5).map(p => readFile(p, "utf8").then(JSON.parse)));
      await verifyBackup(a); await verifyBackup(b); compareBackups(a, b);
      console.log(JSON.stringify({ allRowsUnchanged: true, allObjectsUnchanged: true }));
    } else {
      assert.equal(process.argv.length, 4, "Usage : node scripts/verify-private-backup.mjs sauvegarde.json nouveau-dossier-local");
      console.log(JSON.stringify(await restoreBackup(process.argv[2], process.argv[3])));
    }
  } catch { console.error("Vérification refusée. Sauvegarde corrompue, incompatible, modifiée ou destination non vide. Aucun changement de la production."); process.exitCode = 1; }
}
