// Shared by the read-only Worker exporter and the offline restore verifier.
export const LEGACY_BACKUP_FORMAT = "radar-private-account-v1";
export const LEGACY_BACKUP_TABLES = ["document_extractions", "documents", "experience_conflicts", "experience_items", "experience_revisions", "interviews", "jobs", "profiles", "source_settings"];
export const BACKUP_FORMAT = "radar-private-account-v2";
export const BACKUP_TABLES = ["application_answer_proposals", "application_answer_revisions", "application_questions", ...LEGACY_BACKUP_TABLES];
export function canonical(value) {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value !== null && typeof value === "object") return "{" + Object.keys(value).sort().map(k => JSON.stringify(k) + ":" + canonical(value[k])).join(",") + "}";
  return JSON.stringify(value);
}
export async function sha256(value) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(b => b.toString(16).padStart(2, "0")).join("");
}
