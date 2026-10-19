import { BACKUP_FORMAT, BACKUP_TABLES, canonical, sha256 } from "./account-backup-format.mjs";

type Row = Record<string, string | number | null>;
export class BackupError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}
const MAX_ROWS = 10000;
const MAX_DB_BYTES = 8 * 1024 * 1024;
const MAX_OBJECT_BYTES = 16 * 1024 * 1024;
const MAX_OBJECTS = 100;
function fail(code = "verification"): never { throw new BackupError(409, `Sauvegarde non complète (${code}). Aucun export partiel n’a été produit ; réessayez.`); }

async function snapshot(db: D1Database, userId: string) {
  // Fixed identifiers only. Counts and raw rows are read in ONE D1 batch/transaction.
  // Never accept SQL, an owner ID, a table, or an object key from the browser.
  const statements = [db.prepare("SELECT name, type, tbl_name, sql FROM sqlite_master WHERE type IN ('table','index') AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name")];
  for (const table of BACKUP_TABLES) {
    statements.push(db.prepare(`SELECT COUNT(*) AS total FROM "${table}" WHERE user_id = ?`).bind(userId));
    statements.push(db.prepare(`SELECT * FROM "${table}" WHERE user_id = ? ORDER BY ${table === "profiles" ? "user_id" : "id"} LIMIT ${MAX_ROWS + 1}`).bind(userId));
  }
  const result = await db.batch<Row>(statements);
  if (result.length !== statements.length || result.some(r => !r.success || !Array.isArray(r.results))) fail("lecture-base");
  const catalog = result[0].results;
  // A new business table must be explicitly included before an export can claim completeness.
  // __appgarden_migrations was observed on the hosted database during lot-0 recipe.
  // It belongs to the deployment platform, not to a candidate account.
  const technicalTables = ["d1_migrations", "__drizzle_migrations", "__appgarden_migrations"];
  const unknown = catalog.filter(r => r.type === "table" && !BACKUP_TABLES.includes(String(r.name)) && !technicalTables.includes(String(r.name)));
  if (unknown.length) fail("schema-inattendu:" + unknown.map(r => String(r.name).replace(/[^a-zA-Z0-9_]/g, "").slice(0, 80)).join(","));
  const tables: Record<string, Row[]> = {};
  for (const [index, table] of BACKUP_TABLES.entries()) {
    const total = result[1 + index * 2].results[0]?.total;
    const rows = result[2 + index * 2].results;
    if (typeof total !== "number" || total !== rows.length || rows.length > MAX_ROWS) throw new BackupError(413, "Volume trop important pour cet export intégral. Aucun fichier tronqué n’a été créé.");
    if (rows.some(row => row.user_id !== userId)) fail("proprietaire");
    tables[table] = rows;
  }
  if (new TextEncoder().encode(canonical(tables)).byteLength > MAX_DB_BYTES) throw new BackupError(413, "Sauvegarde trop volumineuse. Aucun export partiel n’a été créé.");
  const schema = catalog.filter(r => BACKUP_TABLES.includes(String(r.tbl_name)));
  const platformSchema = catalog.filter(r => technicalTables.includes(String(r.tbl_name)));
  return { tables, schema, platformSchema };
}

async function listObjects(bucket: R2Bucket, prefixes: string[]) {
  const objects: R2Object[] = [];
  for (const prefix of prefixes) {
    let cursor: string | undefined;
    do {
      const page = await bucket.list({ prefix, cursor, limit: 100 });
      if (page.objects.some(o => !o.key.startsWith(prefix))) fail("perimetre-fichiers");
      objects.push(...page.objects);
      if (objects.length > MAX_OBJECTS) throw new BackupError(413, "Trop de fichiers pour cet export intégral. Aucun export partiel n’a été créé.");
      if (!page.truncated) break;
      if (!page.cursor || page.cursor === cursor) fail("pagination-fichiers");
      cursor = page.cursor;
    } while (true);
  }
  objects.sort((a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
  if (new Set(objects.map(o => o.key)).size !== objects.length) fail("doublon-fichiers");
  return objects;
}
const objectIdentity = (o: R2Object) => ({ key: o.key, version: o.version, etag: o.etag, size: o.size, uploaded: o.uploaded.toISOString() });
function base64(bytes: Uint8Array) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
}

export async function createAccountBackup(db: D1Database, bucket: R2Bucket, userId: string) {
  if (!userId || !/^[^/\\\u0000-\u001f]{1,200}$/.test(userId)) throw new BackupError(401, "Authentification requise");
  const startedAt = new Date().toISOString();
  const before = await snapshot(db, userId);
  // All storage namespaces used by this application, including the old disabled fictional probe.
  // No global bucket listing, no reading another account's objects.
  const prefixes = [`users/${userId}/`, `lot0-fictional-probes/${encodeURIComponent(userId)}/`];
  const listed = await listObjects(bucket, prefixes);
  if (listed.reduce((sum, o) => sum + o.size, 0) > MAX_OBJECT_BYTES) throw new BackupError(413, "Les fichiers dépassent la limite de cet export intégral. Aucun export partiel n’a été créé.");
  const docs = before.tables.documents;
  if (docs.some(d => typeof d.object_key !== "string" || !d.object_key.startsWith(prefixes[0]) || !listed.some(o => o.key === d.object_key && o.size === d.size))) fail("original-manquant");
  const files = [];
  for (const listedObject of listed) {
    const object = await bucket.get(listedObject.key);
    if (!object || canonical(objectIdentity(object)) !== canonical(objectIdentity(listedObject))) fail("fichier-modifie");
    const bytes = new Uint8Array(await object.arrayBuffer());
    if (bytes.byteLength !== object.size) fail("taille-fichier");
    const metadata = { ...objectIdentity(object), httpMetadata: object.httpMetadata ?? {}, customMetadata: object.customMetadata ?? {}, storageClass: object.storageClass };
    files.push({ ...metadata, sha256: await sha256(bytes), encoding: "base64", content: base64(bytes) });
  }
  // R2 and D1 have no shared transaction: fail closed if either changed during the download.
  const after = await snapshot(db, userId);
  const relisted = await listObjects(bucket, prefixes);
  if (canonical(before) !== canonical(after) || canonical(listed.map(objectIdentity)) !== canonical(relisted.map(objectIdentity))) fail("modification-pendant-export");
  const tables = Object.fromEntries(await Promise.all(BACKUP_TABLES.map(async name => [name, { count: before.tables[name].length, sha256: await sha256(canonical(before.tables[name])) }])));
  const manifest = {
    format: BACKUP_FORMAT, scope: "authenticated-account-only", complete: true, startedAt, completedAt: new Date().toISOString(),
    tables, databaseSha256: await sha256(canonical(before)),
    files: files.map(({ content: _content, encoding: _encoding, ...metadata }) => metadata),
    exclusions: ["Secrets et connexions OAuth gérés par la plateforme : non exportables et non clonés.", "Accès et tâches de veille : inventaire séparé via Sites, pas de duplication ni d’activation.", "Lignes du journal interne des déploiements Sites : hors données du compte. Son schéma est inventorié ; les migrations applicatives sont conservées dans la sauvegarde du code."],
  };
  return { manifest, database: before, files };
}
