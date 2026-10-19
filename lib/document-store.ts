import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { documents, profiles } from "@/db/schema";
import { profileTemplate } from "./profile-template";
import { documentLinks, type DocumentSlot } from "./document-input";
import type { CandidateProfile } from "./types";

export async function profileForDocument(userId: string, slot: DocumentSlot, documentId: string) {
  const db = getDb();
  const [stored] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  const current: CandidateProfile = stored ? JSON.parse(stored.data) : profileTemplate;
  const next = { ...current, [slot]: documentId };
  const data = JSON.stringify(next); const updatedAt = new Date().toISOString();
  const statement = db.insert(profiles).values({ userId, data, updatedAt })
    .onConflictDoUpdate({ target: profiles.userId, set: { data, updatedAt } });
  return { statement, links: documentLinks(next) };
}

export async function linkExistingDocument(userId: string, documentId: string, slot: DocumentSlot) {
  const db = getDb();
  const [document] = await db.select().from(documents).where(and(eq(documents.id, documentId), eq(documents.userId, userId))).limit(1);
  if (!document) return null;
  const linked = await profileForDocument(userId, slot, documentId);
  await linked.statement;
  return { document, links: linked.links };
}
