import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { jobs } from "@/db/schema";
import { hasApplication } from "./opportunity-views";
import { rowToJob } from "./server";
import { readWorkspaceWrite, saveWorkspaceWrite } from "./workspace-write-store";
import { editApplicationTags, type ApplicationTag, type ApplicationTags } from "./application-tags";

const key = "application-tags";

export async function readApplicationTags(userId: string): Promise<ApplicationTags> {
  const current = await readWorkspaceWrite(userId, key);
  const tags = current.value ? JSON.parse(current.value) as ApplicationTag[] : [];
  return { version: current.version, tags };
}

export async function changeApplicationTags(userId: string, input: Record<string, unknown>): Promise<ApplicationTags | null> {
  const current = await readWorkspaceWrite(userId, key);
  if (input.version !== current.version) return null;
  if (input.action === "toggle" || input.action === "create" && input.jobId !== undefined) {
    const [job] = await getDb().select().from(jobs).where(and(eq(jobs.userId, userId), eq(jobs.id, String(input.jobId ?? "")))).limit(1);
    if (!job || !hasApplication(rowToJob(job))) throw new Error("Candidature introuvable.");
  }
  const tags = editApplicationTags(current.value ? JSON.parse(current.value) as ApplicationTag[] : [], input);
  const next = await saveWorkspaceWrite(userId, key, JSON.stringify(tags), current.version, current.value);
  return next ? { version: next.version, tags } : null;
}
