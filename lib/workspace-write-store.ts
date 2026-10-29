import { and, desc, eq, like, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { applicationQuestions, interviews, jobs, profiles, workspaceWrites } from "@/db/schema";

export async function ownsWorkspaceKey(userId: string, key: string) {
  const match = /^(note|review|schedule|offer|answer):([a-zA-Z0-9-]{1,100})$/.exec(key);
  if (!match) return false;
  const [,kind,id] = match, db = getDb();
  if (kind === "review") return !!(await db.select({id:interviews.id}).from(interviews).where(and(eq(interviews.userId,userId),eq(interviews.id,id))).limit(1))[0];
  if (kind === "answer") return !!(await db.select({id:applicationQuestions.id}).from(applicationQuestions).where(and(eq(applicationQuestions.userId,userId),eq(applicationQuestions.id,id))).limit(1))[0];
  if(kind==="schedule" && (await db.select({id:interviews.id}).from(interviews).where(and(eq(interviews.userId,userId),eq(interviews.id,id))).limit(1))[0])return true;
  return !!(await db.select({id:jobs.id}).from(jobs).where(and(eq(jobs.userId,userId),eq(jobs.id,id))).limit(1))[0];
}
export async function readWorkspaceWrite(userId: string, key: string) {
  const db = getDb();
  const [row] = await db.select().from(workspaceWrites).where(and(eq(workspaceWrites.userId,userId),eq(workspaceWrites.key,key))).orderBy(desc(workspaceWrites.version)).limit(1);
  if (row) return {value:row.value,version:row.version};
  let value = "";
  if (key.startsWith("note:")) {
    const [profile] = await db.select().from(profiles).where(eq(profiles.userId,userId)).limit(1);
    const note = profile ? JSON.parse(profile.data).applicationNotes?.[key.slice(5)] : "";
    value = typeof note === "string" ? note : "";
  }
  return {value,version:0};
}
export async function saveWorkspaceWrite(userId: string, key: string, value: string, version: number, base: string) {
  const current = await readWorkspaceWrite(userId,key);
  if (current.version !== version || current.value !== base) return current.value === value ? current : null;
  const createdAt = new Date().toISOString();
  // Unique owner/key/version provides an atomic compare-and-swap, even across tabs.
  // Version zero keeps a copy of the original imported note as well.
  if (current.version === 0) await getDb().insert(workspaceWrites).values({userId,key,version:0,value:base,createdAt}).onConflictDoNothing();
  const rows = await getDb().insert(workspaceWrites).values({userId,key,version:version+1,value,createdAt}).onConflictDoNothing().returning();
  if (rows.length) return {value,version:version+1};
  const latest = await readWorkspaceWrite(userId,key);
  return latest.value === value ? latest : null;
}
export async function workspaceNoteValues(userId: string): Promise<Record<string,string>> {
  const rows = await getDb().select().from(workspaceWrites).where(and(eq(workspaceWrites.userId,userId),like(workspaceWrites.key,"note:%"),sql`not exists (select 1 from workspace_writes newer where newer.user_id = ${workspaceWrites.userId} and newer.key = ${workspaceWrites.key} and newer.version > ${workspaceWrites.version})`));
  return Object.fromEntries(rows.map(row=>[row.key.slice(5),row.value]));
}
export async function workspaceNoteValue(userId: string, jobId: string): Promise<string | undefined> {
  const [row] = await getDb().select({ value: workspaceWrites.value }).from(workspaceWrites)
    .where(and(eq(workspaceWrites.userId, userId), eq(workspaceWrites.key, `note:${jobId}`)))
    .orderBy(desc(workspaceWrites.version)).limit(1);
  return row?.value;
}
export async function workspaceHistory(userId:string,key:string) {
  return getDb().select({value:workspaceWrites.value,version:workspaceWrites.version,createdAt:workspaceWrites.createdAt}).from(workspaceWrites).where(and(eq(workspaceWrites.userId,userId),eq(workspaceWrites.key,key))).orderBy(desc(workspaceWrites.version)).limit(50);
}
