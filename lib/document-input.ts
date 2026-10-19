import type { CandidateProfile } from "./types";

export const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024;
export const documentSlots = ["cvFrDocumentId", "cvEnDocumentId", "detailedExperienceDocumentId"] as const;
export type DocumentSlot = typeof documentSlots[number];
export type DocumentLinks = Pick<CandidateProfile, DocumentSlot>;
export type PrivateDocument = { id: string; originalName: string; contentType: string; size: number; createdAt?: string };
const mimeTypes: Record<string, string> = { pdf: "application/pdf", doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", md: "text/markdown; charset=utf-8", txt: "text/plain; charset=utf-8" };

export function isDocumentSlot(value: unknown): value is DocumentSlot { return typeof value === "string" && documentSlots.includes(value as DocumentSlot); }
export function documentLinks(profile: CandidateProfile): DocumentLinks {
  return Object.fromEntries(documentSlots.map(slot => [slot, profile[slot]]));
}
export function publicDocument(row: { id: string; originalName: string; contentType: string; size: number; createdAt?: string }): PrivateDocument {
  return { id: row.id, originalName: row.originalName, contentType: row.contentType, size: row.size, createdAt: row.createdAt };
}
export function validateDocumentMeta(name: string, size: number) {
  const extension = name.split(".").at(-1)?.toLowerCase() ?? "";
  if (!(extension in mimeTypes)) throw new Error("Format non accepté. Utilisez PDF, DOC, DOCX, MD ou TXT.");
  if (size === 0) throw new Error("Le fichier est vide.");
  if (size > MAX_DOCUMENT_BYTES) throw new Error("Fichier trop volumineux : 8 Mo maximum.");
  return extension;
}
export function validateDocumentBytes(name: string, bytes: ArrayBuffer) {
  const extension = validateDocumentMeta(name, bytes.byteLength);
  const data = new Uint8Array(bytes);
  if (extension === "pdf" && !new TextDecoder().decode(data.slice(0, 1024)).includes("%PDF-")) throw new Error("Ce fichier ne semble pas être un PDF valide.");
  if (extension === "docx" && !(data[0] === 0x50 && data[1] === 0x4b)) throw new Error("Ce fichier ne semble pas être un document DOCX valide.");
  if (extension === "doc" && ![0xd0, 0xcf, 0x11, 0xe0].every((value, index) => data[index] === value)) throw new Error("Ce fichier ne semble pas être un document DOC valide.");
  if (extension === "txt" || extension === "md") {
    try { new TextDecoder("utf-8", { fatal: true }).decode(data); }
    catch { throw new Error("Le texte doit être enregistré en UTF-8."); }
    if (data.includes(0)) throw new Error("Ce fichier contient des données binaires, pas du texte.");
  }
  return mimeTypes[extension];
}
export function downloadDisposition(name: string) {
  const safe = name.replace(/[\u0000-\u001f\u007f]/g, "");
  const ascii = safe.replace(/[^a-zA-Z0-9._ -]/g, "_").slice(0, 140) || "document";
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(safe).replace(/'/g, "%27")}`;
}
