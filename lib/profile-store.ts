import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { profiles } from "@/db/schema";
import { workspaceNoteValues } from "./workspace-write-store";
import type { CandidateProfile } from "./types";

export async function readCandidateProfile(userId: string): Promise<CandidateProfile | null> {
  const [profile] = await getDb().select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  if (!profile) return null;
  const value: CandidateProfile = JSON.parse(profile.data);
  const notes = await workspaceNoteValues(userId);
  return Object.keys(notes).length ? { ...value, applicationNotes: { ...value.applicationNotes, ...notes } } : value;
}
