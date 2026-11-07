import {activityDb,activityStatement,activityPrepared} from "./activity-store";
import { and, asc, sql, eq, inArray, lte, isNull, notInArray } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { interviews, jobs } from "@/db/schema";
import { terminalStatuses } from "./application-workflow";
import type { InterviewRecord } from "./types";

const instant = z.string().datetime({ offset: true }).transform(value => new Date(value).toISOString());
const scheduleFields = {
  label: z.string().trim().min(1).max(180), startAt: instant, endAt: instant,
  timeZone: z.string().max(80).refine(value => { try { new Intl.DateTimeFormat("fr", { timeZone: value }); return true; } catch { return false; } }),
  format: z.enum(["video", "phone", "onsite", "other"]).default("video"),
};
function validSchedule(value: { startAt: string; endAt: string }) { const duration = Date.parse(value.endAt) - Date.parse(value.startAt); return duration > 0 && duration <= 8 * 60 * 60 * 1000; }
export const createInterviewSchema = z.object({ id: z.string().uuid(), jobId: z.string().min(1).max(100), ...scheduleFields }).strict().refine(validSchedule, "La durée doit être positive et inférieure à 8 heures.");
export const interviewPatchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("schedule"), ...scheduleFields }).strict(),
  z.object({ action: z.literal("cancel") }).strict(),
  z.object({ action: z.literal("review"), outcome: z.enum(["waiting", "next_step", "rejected", "withdrawn", "offer"]), summary: z.string().max(5000).default(""), strengths: z.string().max(3000).default(""), weaknesses: z.string().max(3000).default(""), nextAction: z.string().max(2000).default(""), followUpAt: z.union([instant, z.literal("")]).optional() }).strict(),
]);
export function rowToInterview(row: typeof interviews.$inferSelect): InterviewRecord {
  return { id: row.id, jobId: row.jobId, label: row.label, startAt: row.startAt, endAt: row.endAt, timeZone: row.timeZone, format: row.format as InterviewRecord["format"], state: row.state as InterviewRecord["state"], ...JSON.parse(row.data), remindedAt: row.remindedAt ?? undefined, updatedAt: row.updatedAt };
}
export async function createInterview(userId: string, value: unknown) {
  const input = createInterviewSchema.parse(value); const db = getDb();
  const [job] = await db.select().from(jobs).where(and(eq(jobs.id, input.jobId), eq(jobs.userId, userId))).limit(1);
  if (!job) throw new Error("Offre introuvable");
  const [existing] = await db.select().from(interviews).where(eq(interviews.id, input.id)).limit(1);
  if (existing) { if (existing.userId !== userId || existing.jobId !== input.jobId) throw new Error("Entretien introuvable"); return rowToInterview(existing); }
  const updatedAt = new Date().toISOString();
  const receipt=crypto.randomUUID();
  await activityDb().batch([
    activityStatement(userId,{id:receipt,action:"interview_scheduled",objectType:"interview",objectId:input.id,createdAt:updatedAt,data:{jobId:input.jobId,source:job.source,startAt:input.startAt,endAt:input.endAt,timeZone:input.timeZone}},"NOT EXISTS(SELECT 1 FROM interviews WHERE id=?)",[input.id]),
    activityPrepared(db.insert(interviews).values({ ...input, userId, updatedAt }).onConflictDoNothing()),
    activityPrepared(db.update(jobs).set({ status: "interview", updatedAt }).where(and(eq(jobs.id,input.jobId),eq(jobs.userId,userId),sql`exists(select 1 from activity_events where id=${receipt} and user_id=${userId})`))),
  ]);
  const [row] = await db.select().from(interviews).where(and(eq(interviews.id, input.id), eq(interviews.userId, userId))).limit(1);
  if (!row) throw new Error("Écriture non confirmée"); return rowToInterview(row);
}
export async function updateInterview(userId: string, id: string, value: unknown) {
  const input = interviewPatchSchema.parse(value); const db = getDb();
  const [current] = await db.select().from(interviews).where(and(eq(interviews.id, id), eq(interviews.userId, userId))).limit(1);
  if (!current) throw new Error("Entretien introuvable");
  const updatedAt=new Date().toISOString(),scope=and(eq(interviews.id,id),eq(interviews.userId,userId));
  const [job]=await db.select({source:jobs.source}).from(jobs).where(and(eq(jobs.id,current.jobId),eq(jobs.userId,userId))).limit(1);
  if(!job)throw new Error("Candidature introuvable.");
  const receipt=crypto.randomUUID(),marker=sql`exists(select 1 from activity_events where id=${receipt} and user_id=${userId})`;
  const gate="EXISTS(SELECT 1 FROM interviews WHERE id=? AND user_id=? AND updated_at IS ? AND state IS ? AND data IS ? AND start_at IS ? AND end_at IS ?)";
  const guard=[id,userId,current.updatedAt,current.state,current.data,current.startAt,current.endAt];
  const statements:D1PreparedStatement[]=[];
  if(input.action==="schedule"){
    if(!validSchedule(input))throw new Error("Durée invalide.");
    const {action:_,...fields}=input;
    if(Object.entries(fields).every(([key,value])=>current[key as keyof typeof current]===value))return rowToInterview(current);
    statements.push(activityStatement(userId,{id:receipt,action:"interview_scheduled",objectType:"interview",objectId:id,createdAt:updatedAt,data:{jobId:current.jobId,source:job.source,startAt:input.startAt,endAt:input.endAt,timeZone:input.timeZone,rescheduled:true}},gate,guard));
    statements.push(activityPrepared(db.update(interviews).set({...fields,updatedAt,remindedAt:current.state==="planned"?null:current.remindedAt}).where(and(scope,marker))));
  }else if(input.action==="cancel"){
    if(current.state==="cancelled")return rowToInterview(current);
    statements.push(activityStatement(userId,{id:receipt,action:"interview_cancelled",objectType:"interview",objectId:id,createdAt:updatedAt,data:{jobId:current.jobId,source:job.source}},gate,guard));
    statements.push(activityPrepared(db.update(interviews).set({state:"cancelled",updatedAt}).where(and(scope,marker))));
  }else{
    if(current.state==="cancelled")throw new Error("Cet entretien est annulé.");
    if(Date.parse(current.endAt)>Date.now())throw new Error("L’entretien n’est pas encore terminé. Corrigez sa date si nécessaire.");
    const {action:_,...fields}=input,previous=JSON.parse(current.data);
    const data={...fields,...(previous.followUpAt===fields.followUpAt&&previous.followUpDoneFor===fields.followUpAt?{followUpDoneAt:previous.followUpDoneAt,followUpDoneFor:previous.followUpDoneFor}:{})},value=JSON.stringify(data);
    if(current.state==="reviewed"&&current.data===value)return rowToInterview(current);
    const status={waiting:"awaiting_response",next_step:"next_step",rejected:"rejected",withdrawn:"withdrawn",offer:"offer"}[input.outcome];
    statements.push(activityStatement(userId,{id:receipt,action:"interview_noted",objectType:"interview",objectId:id,createdAt:updatedAt,data:{jobId:current.jobId,source:job.source,outcome:input.outcome,startAt:current.startAt,endAt:current.endAt}},gate,guard));
    statements.push(activityPrepared(db.update(interviews).set({state:"reviewed",data:value,updatedAt}).where(and(scope,marker))));
    statements.push(activityPrepared(db.update(jobs).set({status,updatedAt}).where(and(eq(jobs.id,current.jobId),eq(jobs.userId,userId),marker))));
  }
  const result=await activityDb().batch(statements);
  if(!result[0].results.length)throw new Error("L’entretien a changé. Relisez le dossier avant de réessayer.");
  const [row] = await db.select().from(interviews).where(scope).limit(1); return rowToInterview(row);
}
export async function dueInterviews(userId: string) {
  const rows = await getDb().select({ interview: interviews, title: jobs.title, company: jobs.company }).from(interviews)
    .innerJoin(jobs, and(eq(interviews.jobId, jobs.id), eq(jobs.userId, userId)))
    .where(and(eq(interviews.userId, userId), eq(interviews.state, "planned"), isNull(interviews.remindedAt), lte(interviews.endAt, new Date().toISOString()), notInArray(jobs.status, terminalStatuses)))
    .orderBy(asc(interviews.endAt)).limit(50);
  return rows.map(row => ({ ...rowToInterview(row.interview), title: row.title, company: row.company, reviewUrl: `/?offer=${row.interview.jobId}&view=interviews` }));
}
export async function markInterviewsReminded(userId: string, value: unknown) {
  const { ids } = z.object({ ids: z.array(z.string().min(1).max(100)).max(50) }).strict().parse(value);
  const eligible = (await dueInterviews(userId)).filter(event => ids.includes(event.id)).map(event => event.id);
  if (!eligible.length) return { marked: [], remaining: await dueInterviews(userId) };
  const now = new Date().toISOString();
  await getDb().update(interviews).set({ remindedAt: now }).where(and(eq(interviews.userId, userId), inArray(interviews.id, eligible), eq(interviews.state, "planned"), lte(interviews.endAt, now), isNull(interviews.remindedAt)));
  return { marked: eligible, remaining: await dueInterviews(userId) };
}
