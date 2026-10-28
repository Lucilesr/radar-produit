import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { jobs } from "@/db/schema";
import { assessJob, createFingerprint } from "./matching";
import { normalizeJobInput } from "./server";

const examples = [
  {
    title: "EXEMPLE — Product Owner à examiner",
    company: "Entreprise fictive Atlas",
    contractType: "cdi",
    remoteMode: "hybrid",
    language: "fr",
    source: "Exemple Radar",
    description: "Offre entièrement fictive pour tester le tri, les notes et la préparation d’une candidature. Aucun poste réel n’est proposé.",
    status: "new",
    reviewState: "to_review",
  },
  {
    title: "EXEMPLE — Product Manager, candidature envoyée",
    company: "Entreprise fictive Boréal",
    contractType: "cdi",
    remoteMode: "full_remote",
    language: "fr",
    source: "Exemple Radar",
    description: "Candidature entièrement fictive pour tester le suivi, les étapes et les entretiens. Aucun envoi réel n’a été effectué.",
    status: "applied",
    reviewState: "selected",
  },
] as const;

// Home is the first account entry point. Any row, including a trashed example,
// means this account has already been initialized or used.
export async function ensureOnboardingDemo(userId: string): Promise<void> {
  const db = getDb();
  const existing = await db.select({ id: jobs.id }).from(jobs).where(eq(jobs.userId, userId)).limit(1);
  if (existing.length) return;

  const now = new Date().toISOString();
  const rows = examples.map(example => {
    const input = normalizeJobInput(example);
    const assessment = assessJob(input);
    return {
      id: crypto.randomUUID(),
      userId,
      fingerprint: createFingerprint(input),
      ...input,
      status: example.status,
      reviewState: example.reviewState,
      appliedAt: example.status === "applied" ? now : null,
      matchScore: assessment.score,
      matchTier: assessment.tier,
      reasons: JSON.stringify(assessment.reasons),
      flags: JSON.stringify(assessment.flags),
      createdAt: now,
      updatedAt: now,
    };
  });
  await db.insert(jobs).values(rows).onConflictDoNothing({ target: [jobs.userId, jobs.fingerprint] });
}
