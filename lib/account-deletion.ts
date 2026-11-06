import { BACKUP_TABLES, PLATFORM_TABLES } from "./account-backup-format.mjs";

/** Word the account owner types to confirm; compared exactly, after trimming. */
export const DELETE_CONFIRMATION = "SUPPRIMER";

export class AccountDeletionError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}
const incomplete = (step: string): never => {
  throw new AccountDeletionError(409, `Suppression non terminée (${step}). Rien n’a été annoncé comme supprimé ; réessayez pour la finir.`);
};

/** Every storage namespace the application writes for one account, and only that account. */
export function accountStoragePrefixes(userId: string) {
  return [`users/${userId}/`, `lot0-fictional-probes/${encodeURIComponent(userId)}/`, `demo/${userId}/`];
}

const MAX_PAGES = 50;

async function deleteObjects(bucket: R2Bucket, prefix: string) {
  let removed = 0;
  // Pages restart from the beginning: deleted keys leave the listing, so no cursor is needed.
  for (let page = 0; page < MAX_PAGES; page++) {
    const listed = await bucket.list({ prefix, limit: 1000 });
    if (listed.objects.some(object => !object.key.startsWith(prefix))) incomplete("perimetre-fichiers");
    if (!listed.objects.length) return removed;
    await bucket.delete(listed.objects.map(object => object.key));
    removed += listed.objects.length;
  }
  return incomplete("trop-de-fichiers");
}

/**
 * Permanently deletes one account: its files first, then every row of every account table
 * in a single D1 batch (one transaction). A failure leaves the rest in place and a retry finishes it.
 * Never accepts a table, a key or an owner from the browser.
 */
export async function deleteAccount(db: D1Database, bucket: R2Bucket, userId: string) {
  if (!userId || !/^[^/\\\u0000-\u001f]{1,200}$/.test(userId)) throw new AccountDeletionError(401, "Authentification requise");

  // Same rule as the export: a new business table must be listed before deletion can claim completeness.
  const catalog = await db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'").all<{ name: string }>();
  const unknown = (catalog.results ?? []).map(row => String(row.name)).filter(name => !BACKUP_TABLES.includes(name) && !PLATFORM_TABLES.includes(name));
  if (unknown.length) incomplete("schema-inattendu");

  let files = 0;
  for (const prefix of accountStoragePrefixes(userId)) files += await deleteObjects(bucket, prefix);

  const results = await db.batch(BACKUP_TABLES.map(table => db.prepare(`DELETE FROM "${table}" WHERE user_id = ?`).bind(userId)));
  if (results.length !== BACKUP_TABLES.length || results.some(result => !result.success)) incomplete("base");
  const rows = results.reduce((sum, result) => sum + (result.meta?.changes ?? 0), 0);

  const left = await db.batch<{ total: number }>(BACKUP_TABLES.map(table => db.prepare(`SELECT COUNT(*) AS total FROM "${table}" WHERE user_id = ?`).bind(userId)));
  if (left.some(result => Number(result.results?.[0]?.total ?? 1) !== 0)) incomplete("verification-base");
  for (const prefix of accountStoragePrefixes(userId)) if ((await bucket.list({ prefix, limit: 1 })).objects.length) incomplete("verification-fichiers");

  return { rows, files };
}
