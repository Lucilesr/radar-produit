import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { applicationAnswerRevisions, applicationQuestions, jobs } from "@/db/schema";

const fields = {
  question: z.string().trim().min(1, "Saisissez la question du recruteur.").max(2000),
  characterLimit: z.number().int().min(1).max(10000).nullable(),
  answer: z.string().max(10000),
};
const createSchema = z.object({ id: z.string().uuid(), jobId: z.string().min(1).max(100), ...fields }).strict();
const saveSchema = z.object({ version: z.number().int().min(1), ...fields }).strict();
const archiveSchema = z.object({ version: z.number().int().min(1), archived: z.boolean() }).strict();

async function ownedJob(userId: string, jobId: string) {
  const [job] = await getDb().select({ id: jobs.id }).from(jobs)
    .where(and(eq(jobs.id, jobId), eq(jobs.userId, userId))).limit(1);
  if (!job) throw new Error("Offre introuvable.");
}

export async function listApplicationQuestions(userId: string, jobId: string, includeArchived = false) {
  await ownedJob(userId, jobId);
  return getDb().select().from(applicationQuestions)
    .where(and(eq(applicationQuestions.userId, userId), eq(applicationQuestions.jobId, jobId), includeArchived ? undefined : isNull(applicationQuestions.archivedAt)))
    .orderBy(asc(applicationQuestions.createdAt), asc(applicationQuestions.id)).limit(50);
}

export async function createApplicationQuestion(userId: string, value: unknown) {
  const input = createSchema.parse(value);
  await ownedJob(userId, input.jobId);
  const db = getDb();
  const [existing] = await db.select().from(applicationQuestions).where(eq(applicationQuestions.id, input.id)).limit(1);
  if (existing) {
    if (existing.userId !== userId || existing.jobId !== input.jobId) throw new Error("Question introuvable.");
    return existing; // A retried create must not add another answer version.
  }
  const count = await db.select({ value: sql<number>`count(*)` }).from(applicationQuestions)
    .where(and(eq(applicationQuestions.userId, userId), eq(applicationQuestions.jobId, input.jobId), isNull(applicationQuestions.archivedAt)));
  if (Number(count[0]?.value ?? 0) >= 30) throw new Error("Maximum de 30 questions par offre.");
  const now = new Date().toISOString();
  await db.batch([
    db.insert(applicationQuestions).values({ ...input, userId, createdAt: now, updatedAt: now }),
    db.insert(applicationAnswerRevisions).values({ id: crypto.randomUUID(), userId, questionId: input.id,
      version: 1, question: input.question, characterLimit: input.characterLimit, answer: input.answer,
      origin: "manual", createdAt: now }),
  ]);
  const [row] = await db.select().from(applicationQuestions)
    .where(and(eq(applicationQuestions.id, input.id), eq(applicationQuestions.userId, userId))).limit(1);
  if (!row) throw new Error("Enregistrement non confirmé.");
  return row;
}

export async function saveApplicationQuestion(userId: string, id: string, value: unknown) {
  const input = saveSchema.parse(value);
  const db = getDb();
  const [current] = await db.select().from(applicationQuestions)
    .where(and(eq(applicationQuestions.id, id), eq(applicationQuestions.userId, userId), isNull(applicationQuestions.archivedAt))).limit(1);
  if (!current) throw new Error("Question introuvable.");
  await ownedJob(userId, current.jobId);
  if (current.question === input.question && current.characterLimit === input.characterLimit && current.answer === input.answer) return current;
  if (current.version !== input.version) throw new Error("Cette question a changé ailleurs. Rechargez-la avant d’enregistrer.");
  const nextVersion = current.version + 1;
  const now = new Date().toISOString();
  // D1 batch is transactional. The unique revision key rolls back a concurrent stale update.
  try {
    await db.batch([
      db.update(applicationQuestions).set({ question: input.question, characterLimit: input.characterLimit,
        answer: input.answer, version: nextVersion, updatedAt: now })
        .where(and(eq(applicationQuestions.id, id), eq(applicationQuestions.userId, userId),
          eq(applicationQuestions.version, current.version), isNull(applicationQuestions.archivedAt))),
      db.insert(applicationAnswerRevisions).values({ id: crypto.randomUUID(), userId, questionId: id,
        version: nextVersion, question: input.question, characterLimit: input.characterLimit,
        answer: input.answer, origin: "manual", createdAt: now }),
    ]);
  } catch { throw new Error("Enregistrement non confirmé. Rechargez la question pour éviter d’écraser une autre version."); }
  const [row] = await db.select().from(applicationQuestions)
    .where(and(eq(applicationQuestions.id, id), eq(applicationQuestions.userId, userId))).limit(1);
  if (!row || row.version !== nextVersion) throw new Error("Enregistrement non confirmé.");
  return row;
}

export async function archiveApplicationQuestion(userId: string, id: string, value: unknown) {
  const input = archiveSchema.parse(value); const db = getDb();
  const [current] = await db.select().from(applicationQuestions)
    .where(and(eq(applicationQuestions.id, id), eq(applicationQuestions.userId, userId))).limit(1);
  if (!current) throw new Error("Question introuvable.");
  await ownedJob(userId, current.jobId);
  if (input.archived && current.archivedAt) return { id, archived: true };
  if (!input.archived && !current.archivedAt) return { id, archived: false };
  if (current.version !== input.version) throw new Error("Cette question a changé ailleurs. Rechargez-la.");
  const archivedAt = input.archived ? current.archivedAt ?? new Date().toISOString() : null;
  if (archivedAt === current.archivedAt) return { id, archived: Boolean(archivedAt) };
  const now = new Date().toISOString(); const nextVersion = current.version + 1;
  try {
    await db.batch([
      db.update(applicationQuestions).set({ archivedAt, version: nextVersion, updatedAt: now })
        .where(and(eq(applicationQuestions.id, id), eq(applicationQuestions.userId, userId), eq(applicationQuestions.version, input.version))),
      db.insert(applicationAnswerRevisions).values({ id: crypto.randomUUID(), userId, questionId: id,
        version: nextVersion, question: current.question, characterLimit: current.characterLimit,
        answer: current.answer, origin: "manual", createdAt: now }),
    ]);
  } catch { throw new Error("Archivage non confirmé. Rechargez la question."); }
  return { id, archived: Boolean(archivedAt) };
}

export async function applicationQuestionHistory(userId: string, id: string) {
  const db = getDb();
  const [current] = await db.select({ jobId: applicationQuestions.jobId }).from(applicationQuestions)
    .where(and(eq(applicationQuestions.id, id), eq(applicationQuestions.userId, userId))).limit(1);
  if (!current) throw new Error("Question introuvable.");
  await ownedJob(userId, current.jobId);
  return db.select().from(applicationAnswerRevisions)
    .where(and(eq(applicationAnswerRevisions.userId, userId), eq(applicationAnswerRevisions.questionId, id)))
    .orderBy(desc(applicationAnswerRevisions.version)).limit(50);
}
