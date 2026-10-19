import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { profiles } from "@/db/schema";
import type { CandidateProfile } from "./types";

export async function readCandidateProfile(userId: string): Promise<CandidateProfile | null> {
  const [profile] = await getDb().select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  return profile ? JSON.parse(profile.data) : null;
}
