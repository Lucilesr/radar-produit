import {activityDb,activityStatement,jobActivityStatement} from "./activity-store";
import {jobActivity} from "./activity";
import { and, desc, eq, isNull, inArray, isNotNull, like, lt, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { jobs, profiles, interviews, applicationQuestions, applicationAnswerRevisions, applicationAnswerProposals, workspaceWrites } from "@/db/schema";
import { assessJob, createFingerprint, scoreFields } from "./matching";
import { searchPreferences } from "./search-preferences";
import { readCandidateProfile } from "./profile-store";
import { normalizeJobInput, rowToJob } from "./server";
import { offerPatchSchema } from "./import-contract";
import { rowToInterview } from "./interview-store";
import { workspaceNoteValue, workspaceNoteValues } from "./workspace-write-store";
import { z } from "zod";
import { showJobgetherOffer } from "./jobgether-match";
import { storedReviewDecision } from "./opportunity-views";

// Browser and agent imports share the same per-user, retry-safe write path.
export async function saveOffer(userId: string, value: unknown) {
  const input = normalizeJobInput(value);
  const fingerprint = createFingerprint(input);
  const db = getDb();
  const assessment = assessJob(input, searchPreferences((await readCandidateProfile(userId))?.searchPreferences));
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
  if (inserted[0]) return { job: { ...rowToJob(inserted[0]), ...scoreFields(assessment) }, deduplicated: false };
  const [existing] = await db.select().from(jobs).where(and(
    eq(jobs.userId, userId), eq(jobs.fingerprint, fingerprint),
  )).limit(1);
  if (!existing) throw new Error("Import non confirmé ; vérifier avant de réessayer.");
  // Reassess stored facts after a scoring correction, never overwrite an
  // existing description, contact or application status with a repeated import.
  const current = rowToJob(existing);
  const updatedAssessment = assessJob(current, searchPreferences((await readCandidateProfile(userId))?.searchPreferences));
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
    reasons: updatedAssessment.reasons, flags: updatedAssessment.flags, ...scoreFields(updatedAssessment) }, deduplicated: true };
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
  const preferences = searchPreferences(profileRows[0] ? JSON.parse(profileRows[0].data).searchPreferences : undefined);
  const interviewsByJob = new Map<string, ReturnType<typeof rowToInterview>[]>();
  for (const row of interviewRows) {
    const entries = interviewsByJob.get(row.jobId) ?? [];
    entries.push(rowToInterview(row));
    interviewsByJob.set(row.jobId, entries);
  }
  return rows.map(row => {
    const job = rowToJob(row);
    const assessment = assessJob(job, preferences);
    return { ...job, matchScore: assessment.score, matchTier: assessment.tier,
      reasons: assessment.reasons, flags: assessment.flags, ...scoreFields(assessment),
      candidateNote: typeof notes[job.id] === "string" ? notes[job.id] : undefined,
      interviews: interviewsByJob.get(job.id) ?? [] };
  }).filter(job => !!job.deletedAt || showJobgetherOffer(job.source, job.matchScore, preferences.minimumMatchScore, job.status, job.reviewState));
}

export async function getOffer(userId: string, id: string, includeDeleted = false) {
  const db = getDb();
  const [rows, profileRows, interviewRows, savedNote] = await Promise.all([
    db.select().from(jobs).where(and(eq(jobs.userId, userId), eq(jobs.id, id), includeDeleted ? undefined : isNull(jobs.deletedAt))).limit(1),
    db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1),
    db.select().from(interviews).where(and(eq(interviews.userId, userId), eq(interviews.jobId, id))).orderBy(desc(interviews.startAt)),
    workspaceNoteValue(userId, id),
  ]);
  if (!rows[0]) return undefined;
  const job = rowToJob(rows[0]);
  const assessment = assessJob(job, searchPreferences(profileRows[0] ? JSON.parse(profileRows[0].data).searchPreferences : undefined));
  const notes = profileRows[0] ? JSON.parse(profileRows[0].data).applicationNotes ?? {} : {};
  return { ...job, matchScore: assessment.score, matchTier: assessment.tier,
    reasons: assessment.reasons, flags: assessment.flags, ...scoreFields(assessment),
    candidateNote: savedNote ?? (typeof notes[id] === "string" ? notes[id] : undefined),
    interviews: interviewRows.map(rowToInterview) };
}

// Keep the row and its fingerprint: repeated imports cannot resurrect a dismissed offer.
// No status, note, interview or document is removed. Repeated requests are idempotent.
export async function setOfferDeleted(userId: string, id: string, deleted: boolean, reason?: string, note?: string) {
  return (await setOffersDeleted(userId, [id], deleted, reason, note))[0] ?? null;
}

export async function setOffersDeleted(userId: string, ids: string[], deleted: boolean, reason?: string, note?: string) {
  if (!ids.length || ids.length > 50 || ids.some(id => typeof id !== "string" || !id || id.length > 100)) throw new Error("Sélection invalide : 1 à 50 offres.");
  if (reason !== undefined && !["filled", "applications_closed", "not_interested", "other"].includes(reason)) throw new Error("Motif de corbeille invalide.");
  if (note && note.length > 500) throw new Error("Commentaire trop long.");
  const unique=[...new Set(ids)],at=new Date().toISOString();
  const event=jobActivityStatement(userId,deleted?"offer_sorted":"offer_restored",unique,at,deleted?"deleted_at IS NULL":"deleted_at IS NOT NULL",[],deleted?"discarded":null);
  const update=activityDb().prepare(`UPDATE jobs SET deleted_at=${deleted?"coalesce(deleted_at,?)":"NULL"},dismissal_reason=${deleted?"coalesce(dismissal_reason,?)":"NULL"},dismissal_note=${deleted?"coalesce(dismissal_note,?)":"NULL"} WHERE user_id=? AND id IN (${unique.map(()=>"?").join(",")}) RETURNING id,deleted_at AS deletedAt,dismissal_reason AS dismissalReason,dismissal_note AS dismissalNote`).bind(...(deleted?[at,reason??null,note?.trim()||null]:[]),userId,...unique);
  const result=await activityDb().batch([event,update]);
  return result[1].results as {id:string;deletedAt:string|null;dismissalReason:string|null;dismissalNote:string|null}[];
}

// D1 accepts at most 100 bound parameters per statement. Nested cleanup
// subqueries repeat the eligible IDs, so keep each batch well below the limit.
const TRASH_PURGE_BATCH_SIZE = 20;

// Run when an account loads opportunities. A bounded batch keeps the request short.
async function purgeExpiredTrashBatch(userId: string, now: Date) {
  const db = getDb();
  const cutoff = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString();
  const expired = await db.select({ id: jobs.id }).from(jobs)
    .where(and(eq(jobs.userId, userId), isNotNull(jobs.deletedAt), lt(jobs.deletedAt, cutoff))).limit(TRASH_PURGE_BATCH_SIZE);
  const ids = expired.map(row => row.id);
  if (!ids.length) return 0;
  const eligible = db.select({ id: jobs.id }).from(jobs)
    .where(and(eq(jobs.userId, userId), inArray(jobs.id, ids), isNotNull(jobs.deletedAt), lt(jobs.deletedAt, cutoff)));
  const questions = db.select({ id: applicationQuestions.id }).from(applicationQuestions)
    .where(and(eq(applicationQuestions.userId, userId), inArray(applicationQuestions.jobId, eligible)));
  const relatedInterviews = db.select({ id: interviews.id }).from(interviews)
    .where(and(eq(interviews.userId, userId), inArray(interviews.jobId, eligible)));
  const results = await db.batch([
    db.delete(workspaceWrites).where(and(eq(workspaceWrites.userId, userId), or(
      and(or(like(workspaceWrites.key, "note:%"), like(workspaceWrites.key, "offer:%")), inArray(sql<string>`substr(${workspaceWrites.key}, instr(${workspaceWrites.key}, ':') + 1)`, eligible)),
      and(or(like(workspaceWrites.key, "review:%"), like(workspaceWrites.key, "schedule:%")), inArray(sql<string>`substr(${workspaceWrites.key}, instr(${workspaceWrites.key}, ':') + 1)`, relatedInterviews)),
      and(like(workspaceWrites.key, "answer:%"), inArray(sql<string>`substr(${workspaceWrites.key}, 8)`, questions)),
    ))),
    db.delete(applicationAnswerRevisions).where(and(eq(applicationAnswerRevisions.userId, userId), inArray(applicationAnswerRevisions.questionId, questions))),
    db.delete(applicationAnswerProposals).where(and(eq(applicationAnswerProposals.userId, userId), inArray(applicationAnswerProposals.jobId, eligible))),
    db.delete(applicationQuestions).where(and(eq(applicationQuestions.userId, userId), inArray(applicationQuestions.jobId, eligible))),
    db.delete(interviews).where(and(eq(interviews.userId, userId), inArray(interviews.jobId, eligible))),
    db.delete(jobs).where(and(eq(jobs.userId, userId), inArray(jobs.id, ids), isNotNull(jobs.deletedAt), lt(jobs.deletedAt, cutoff))).returning({ id: jobs.id }),
  ]);
  const removed = results[5].map(row => row.id);
  if (removed.length) {
    const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
    if (profile) {
      const data = JSON.parse(profile.data);
      const notes = { ...data.applicationNotes };
      for (const id of removed) delete notes[id];
      await db.update(profiles).set({ data: JSON.stringify({ ...data, applicationNotes: notes }), updatedAt: now.toISOString() })
        .where(and(eq(profiles.userId, userId), eq(profiles.data, profile.data)));
    }
  }
  return removed.length;
}

export async function purgeExpiredTrash(userId: string, now = new Date()) {
  let total = 0;
  let removed: number;
  do { removed = await purgeExpiredTrashBatch(userId, now); total += removed; } while (removed === TRASH_PURGE_BATCH_SIZE);
  return total;
}

export async function setOfferReviewState(userId: string, id: string, reviewState: "to_review" | "selected" | "later") {
  const current=await getOffer(userId,id);if(!current)return null;
  const next=storedReviewDecision(reviewState),status=current.status==="closed"?"new":current.status;
  if(current.reviewState===next&&status===current.status)return current;
  const at=new Date().toISOString(),where="id=? AND user_id=? AND status IS ? AND review_state IS ? AND updated_at IS ? AND deleted_at IS NULL",args=[id,userId,current.status,current.reviewState??null,current.updatedAt??null];
  const action=jobActivity(current,{...current,status,reviewState:next});
  const operations=action?[activityStatement(userId,{action:action.action,objectType:"job",objectId:id,createdAt:at,data:{...action.data,source:current.source,fit:current.fit??null,fitLabel:current.fitLabel??null}},`EXISTS(SELECT 1 FROM jobs WHERE ${where})`,args)]:[];
  operations.push(activityDb().prepare(`UPDATE jobs SET review_state=?,status=?,updated_at=? WHERE ${where} RETURNING id`).bind(next,status,at,...args));
  const result=await activityDb().batch(operations);
  return result.at(-1)?.results.length?getOffer(userId,id):null;
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
  // A pay figure typed by hand replaces the announced range instead of being averaged with it.
  const handTyped = {
    ...("annualSalary" in patch && patch.annualSalary !== current.annualSalary && !("salaryMin" in patch) && !("salaryMax" in patch) ? { salaryMin: null, salaryMax: null } : {}),
    ...("dailyRate" in patch && patch.dailyRate !== current.dailyRate && !("dailyRateMin" in patch) && !("dailyRateMax" in patch) ? { dailyRateMin: null, dailyRateMax: null } : {}),
  };
  // A long description typed or pasted by hand is the full announcement (Score v2 S4).
  const pasted = typeof patch.description === "string" && patch.description.trim().length >= 600 && patch.description !== current.description
    && current.contentCoverage !== "full" && (patch.contentCoverage === undefined || patch.contentCoverage === current.contentCoverage)
    ? { contentCoverage: "full" as const } : {};
  const normalized = normalizeJobInput({ ...current, ...handTyped, ...patch, ...pasted });
  const inferred = (["annualSalary", "dailyRate", "salaryMin", "salaryMax", "dailyRateMin", "dailyRateMax", "contractType", "remoteMode", "language"] as const)
    .filter(key => key in handTyped || ((current[key] == null || current[key] === "other" || current[key] === "unknown") && normalized[key] !== current[key]));
  const changed = Object.fromEntries([...new Set([...Object.keys(patch), ...Object.keys(pasted), ...inferred])]
    .map(key => [key, normalized[key as keyof typeof normalized] ?? null]));
  const assessment = assessJob({ ...current, ...normalized }, searchPreferences((await readCandidateProfile(userId))?.searchPreferences));
  await getDb().update(jobs).set({ ...changed, matchScore: assessment.score, matchTier: assessment.tier,
    reasons: JSON.stringify(assessment.reasons), flags: JSON.stringify(assessment.flags), updatedAt: new Date().toISOString() })
    .where(and(eq(jobs.id, id), eq(jobs.userId, userId)));
  return getOffer(userId, id);
}
