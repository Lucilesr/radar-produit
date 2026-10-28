import { and, desc, eq, isNull, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { jobs, profiles, interviews } from "@/db/schema";
import { assessJob, createFingerprint } from "./matching";
import { normalizeJobInput, rowToJob } from "./server";
import { offerPatchSchema } from "./import-contract";
import { rowToInterview } from "./interview-store";
import { workspaceNoteValues } from "./workspace-write-store";
import { z } from "zod";

// Browser and agent imports share the same per-user, retry-safe write path.
export async function saveOffer(userId: string, value: unknown) {
  const input = normalizeJobInput(value);
  const fingerprint = createFingerprint(input);
  const db = getDb();
  const assessment = assessJob(input);
  const record = {
    id: crypto.randomUUID(), userId, fingerprint, ...input,
    company: input.company ?? "Entreprise non précisée",
    description: input.description ?? "",
    status: "new",
    reviewState: "to_review",
    matchScore: assessment.score, matchTier: assessment.tier,
    reasons: JSON.stringify(assessment.reasons), flags: JSON.stringify(assessment.flags),
    updatedAt: new Date().toISOString(),
  };
  const inserted = await db.insert(jobs).values(record).onConflictDoNothing({
    target: [jobs.userId, jobs.fingerprint],
  }).returning();
  if (inserted[0]) return { job: rowToJob(inserted[0]), deduplicated: false };
  const [existing] = await db.select().from(jobs).where(and(
    eq(jobs.userId, userId), eq(jobs.fingerprint, fingerprint),
  )).limit(1);
  if (!existing) throw new Error("Import non confirmé ; vérifier avant de réessayer.");
  // Reassess stored facts after a scoring correction, never overwrite an
  // existing description, contact or application status with a repeated import.
  const current = rowToJob(existing);
  const updatedAssessment = assessJob(current);
  const updated = {
    matchScore: updatedAssessment.score, matchTier: updatedAssessment.tier,
    reasons: JSON.stringify(updatedAssessment.reasons), flags: JSON.stringify(updatedAssessment.flags),
  };
  if (existing.matchScore !== updated.matchScore || existing.matchTier !== updated.matchTier ||
      existing.reasons !== updated.reasons || existing.flags !== updated.flags) {
    await db.update(jobs).set({ ...updated, updatedAt: new Date().toISOString() })
      .where(and(eq(jobs.id, existing.id), eq(jobs.userId, userId)));
  }
  return { job: { ...current, matchScore: updatedAssessment.score, matchTier: updatedAssessment.tier,
    reasons: updatedAssessment.reasons, flags: updatedAssessment.flags }, deduplicated: true };
}

export async function listOffers(userId: string, limit?: number, includeDeleted = false) {
  const db = getDb();
  const query = db.select().from(jobs).where(and(eq(jobs.userId, userId), includeDeleted ? undefined : isNull(jobs.deletedAt))).orderBy(desc(jobs.createdAt));
  const [rows, profileRows, interviewRows, savedNotes] = await Promise.all([
    limit === undefined ? query : query.limit(limit),
    db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1),
    db.select().from(interviews).where(eq(interviews.userId, userId)).orderBy(desc(interviews.startAt)),
    workspaceNoteValues(userId),
  ]);
  const notes = { ...(profileRows[0] ? JSON.parse(profileRows[0].data).applicationNotes ?? {} : {}), ...savedNotes };
  return rows.map(row => {
    const job = rowToJob(row);
    const assessment = assessJob(job);
    return { ...job, matchScore: assessment.score, matchTier: assessment.tier,
      reasons: assessment.reasons, flags: assessment.flags,
      candidateNote: typeof notes[job.id] === "string" ? notes[job.id] : undefined,
      interviews: interviewRows.filter(item => item.jobId === job.id).map(rowToInterview) };
  });
}

export async function getOffer(userId: string, id: string, includeDeleted = false) { return (await listOffers(userId, undefined, includeDeleted)).find(job => job.id === id); }

// Keep the row and its fingerprint: repeated imports cannot resurrect a dismissed offer.
// No status, note, interview or document is removed. Repeated requests are idempotent.
export async function setOfferDeleted(userId: string, id: string, deleted: boolean, reason?: string, note?: string) {
  return (await setOffersDeleted(userId, [id], deleted, reason, note))[0] ?? null;
}

export async function setOffersDeleted(userId: string, ids: string[], deleted: boolean, reason?: string, note?: string) {
  if (!ids.length || ids.length > 50 || ids.some(id => typeof id !== "string" || !id || id.length > 100)) throw new Error("Sélection invalide : 1 à 50 offres.");
  if (deleted && !["filled", "applications_closed", "not_interested", "other"].includes(reason ?? "")) throw new Error("Choisissez un motif de corbeille.");
  if (note && note.length > 500) throw new Error("Commentaire trop long.");
  // One bounded atomic write + returning, instead of SELECT / UPDATE / SELECT per offer.
  // COALESCE preserves the original timestamp on retries; owner scope stays server-side.
  return getDb().update(jobs).set({ deletedAt: deleted ? sql`coalesce(${jobs.deletedAt}, ${new Date().toISOString()})` : null,
    dismissalReason: deleted ? sql`coalesce(${jobs.dismissalReason}, ${reason})` : null,
    dismissalNote: deleted ? sql`coalesce(${jobs.dismissalNote}, ${note?.trim() || null})` : null })
    .where(and(eq(jobs.userId, userId), inArray(jobs.id, [...new Set(ids)])))
    .returning({ id: jobs.id, deletedAt: jobs.deletedAt, dismissalReason: jobs.dismissalReason, dismissalNote: jobs.dismissalNote });
}

export async function setOfferReviewState(userId: string, id: string, reviewState: "to_review" | "selected") {
  const [row] = await getDb().update(jobs).set({ reviewState, updatedAt: new Date().toISOString() })
    .where(and(eq(jobs.userId, userId), eq(jobs.id, id), isNull(jobs.deletedAt)))
    .returning({ id: jobs.id });
  return row ? getOffer(userId, id) : null;
}

const closureSchema = z.object({ id: z.string().min(1).max(100), reason: z.enum(["filled", "applications_closed"]), source: z.string().min(1).max(80), sourceUrl: z.string().url(), evidence: z.string().trim().min(12).max(500) }).strict();
export async function markOfferClosedFromSource(userId: string, value: unknown) {
  const input = closureSchema.parse(value);
  const [row] = await getDb().select().from(jobs).where(and(eq(jobs.userId, userId), eq(jobs.id, input.id))).limit(1);
  if (!row || row.source !== input.source || row.sourceUrl !== input.sourceUrl) throw new Error("Signal non attribuable à cette offre.");
  const explicit = input.reason === "filled" ? /(?:poste|offre|mission).{0,90}(?:pourvu|pourvue)|(?:position|role|job).{0,90}(?:filled|hired)/i : /(?:candidatures?|recrutement|applications?).{0,90}(?:ferm[ée]es?|clos(?:es|ed)?|closed|no longer accepted)|(?:no longer accepting applications)/i;
  if (!explicit.test(input.evidence)) throw new Error("Fermeture non explicite.");
  if (row.deletedAt || row.dismissalEvidence) return { job: rowToJob(row), changed: false };
  const at = new Date().toISOString();
  const [updated] = await getDb().update(jobs).set({ deletedAt: at, dismissalReason: input.reason,
    dismissalEvidence: JSON.stringify({ source: input.source, sourceUrl: input.sourceUrl, quote: input.evidence, observedAt: at }) })
    .where(and(eq(jobs.userId, userId), eq(jobs.id, input.id), isNull(jobs.deletedAt), isNull(jobs.dismissalEvidence))).returning();
  return { job: rowToJob(updated ?? row), changed: !!updated };
}
export async function updateOffer(userId: string, id: string, value: unknown) {
  const patch = offerPatchSchema.parse(value); const current = await getOffer(userId, id);
  if (!current) throw new Error("Offre introuvable");
  const normalized = normalizeJobInput({ ...current, ...patch });
  const changed = Object.fromEntries(Object.keys(patch).map(key => [key, normalized[key as keyof typeof normalized] ?? null]));
  const assessment = assessJob({ ...current, ...normalized });
  await getDb().update(jobs).set({ ...changed, matchScore: assessment.score, matchTier: assessment.tier,
    reasons: JSON.stringify(assessment.reasons), flags: JSON.stringify(assessment.flags), updatedAt: new Date().toISOString() })
    .where(and(eq(jobs.id, id), eq(jobs.userId, userId)));
  return getOffer(userId, id);
}
