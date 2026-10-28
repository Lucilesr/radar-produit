import { and, eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "@/db";
import { documents, experienceItems, interviews, jobs, profiles } from "@/db/schema";
import { assessJob, createFingerprint } from "./matching";
import { normalizeJobInput } from "./server";
import type { CandidateProfile, JobStatus } from "./types";

// Every visitor gets a separate fictional workspace. This seed never reads the private Site.
const examples = [
  { title: "Product Owner · Portail partenaires", company: "Atlas Studio", contractType: "cdi", annualSalary: 69000, remoteMode: "hybrid", source: "Collective", status: "new", reviewState: "to_review", description: "Exemple fictif. Piloter un portail B2B, clarifier les besoins de partenaires et prioriser les évolutions avec design, data et ingénierie. Deux jours de présence mensuelle à discuter." },
  { title: "Product Manager · Plateforme SaaS", company: "Boréal Labs", contractType: "cdi", annualSalary: 78000, remoteMode: "full_remote", source: "Apec", status: "new", reviewState: "to_review", description: "Exemple fictif. Construire la feuille de route d’une plateforme SaaS, mener la discovery et mesurer l’adoption. Anglais professionnel attendu." },
  { title: "Product Owner · Services numériques", company: "Solstice Conseil", contractType: "freelance", dailyRate: 620, remoteMode: "full_remote", source: "Malt", status: "new", reviewState: "to_review", description: "Exemple fictif. Mission de cadrage produit et de coordination d’une équipe pluridisciplinaire sur des services numériques." },
  { title: "Product Lead · Expérience client", company: "Nébula", contractType: "cdi", annualSalary: 82000, remoteMode: "hybrid", source: "LinkedIn Jobs", status: "shortlist", reviewState: "selected", description: "Exemple fictif. Améliorer un parcours client de bout en bout, structurer les priorités et accompagner les équipes produit." },
  { title: "Senior Product Manager · Marketplace", company: "Cime Market", contractType: "cdi", annualSalary: 74000, remoteMode: "hybrid", source: "Apec", status: "prepare", reviewState: "selected", description: "Exemple fictif. Développer une marketplace à deux faces, suivre les indicateurs d’usage et préparer les arbitrages de roadmap." },
  { title: "Product Owner · Outils métiers", company: "Orion Cloud", contractType: "freelance", dailyRate: 600, remoteMode: "full_remote", source: "Malt", status: "interview", reviewState: "selected", description: "Exemple fictif. Accompagner la refonte d’outils internes, animer les ateliers métiers et sécuriser les livraisons." },
  { title: "Product Manager · Finance durable", company: "Lumen Finance", contractType: "cdi", annualSalary: 76000, remoteMode: "hybrid", source: "Collective", status: "awaiting_response", reviewState: "selected", description: "Exemple fictif. Développer un produit financier réglementé, avec une démarche de discovery et une mesure rigoureuse de l’impact." },
  { title: "Product Manager · Écosystème B2B", company: "Mira Services", contractType: "cdi", annualSalary: 80000, remoteMode: "full_remote", source: "We Work Remotely", status: "offer", reviewState: "selected", description: "Exemple fictif. Coordonner un écosystème de partenaires B2B et lancer de nouveaux parcours. Proposition de recrutement fictive." },
] as const;

const profile: CandidateProfile = {
  headline: "Product Manager / Product Owner · produits B2B et services numériques",
  summary: "Profil entièrement fictif pour montrer Radar Produit. Expérience en discovery, priorisation, delivery et mesure d’adoption sur des produits B2B.",
  location: "Paris · remote ou hybride",
  languages: ["Français", "Anglais professionnel"],
  roleKeywords: ["Product Manager", "Product Owner"],
  skills: ["Discovery", "Roadmap", "Priorisation", "Delivery", "Analyse de données"],
  industries: ["SaaS", "Services numériques", "Finance"],
  achievements: [], evidence: [], linkedinUrl: "",
};

const experience = [
  { title: "Product Owner · Portail B2B", organization: "Atelier Horizon (fictif)", role: "Product Owner", period: "2023–2025", context: "Refonte fictive d’un portail de services pour des partenaires professionnels.", contribution: "Animation des ateliers, clarification des besoins et priorisation du backlog avec l’équipe produit.", result: "Parcours simplifié et indicateurs d’adoption définis pour le suivi du lancement.", claimKey: "portail-b2b" },
  { title: "Product Manager · SaaS", organization: "Ligne Claire (fictif)", role: "Product Manager", period: "2020–2023", context: "Développement fictif d’une plateforme SaaS utilisée par plusieurs équipes métiers.", contribution: "Discovery, cadrage de la roadmap et coordination avec design, data et ingénierie.", result: "Livraisons mieux séquencées et retours utilisateurs intégrés aux décisions.", claimKey: "saas-discovery" },
];

export async function ensureOnboardingDemo(userId: string): Promise<void> {
  const db = getDb();
  const existing = await db.select({ id: jobs.id }).from(jobs).where(eq(jobs.userId, userId)).limit(1);
  if (existing.length) return;
  const now = new Date();
  const nowIso = now.toISOString();
  const daysAgo = (days: number) => new Date(now.getTime() - days * 86400000).toISOString();
  const rows = examples.map((example, index) => {
    const input = normalizeJobInput({ ...example, language: "fr", contentCoverage: "summary" });
    const assessment = assessJob(input);
    return {
      id: crypto.randomUUID(), userId, fingerprint: createFingerprint(input), ...input,
      status: example.status as JobStatus, reviewState: example.reviewState,
      appliedAt: index >= 5 ? daysAgo(index === 5 ? 5 : index === 6 ? 9 : 12) : null,
      matchScore: assessment.score, matchTier: assessment.tier,
      reasons: JSON.stringify(assessment.reasons), flags: JSON.stringify(assessment.flags),
      createdAt: daysAgo(9 - index), updatedAt: nowIso,
    };
  });
  await db.insert(profiles).values({ userId, data: JSON.stringify(profile), updatedAt: nowIso }).onConflictDoNothing();
  for (const row of rows) await db.insert(jobs).values(row).onConflictDoNothing({ target: [jobs.userId, jobs.fingerprint] });
  const [interviewJob] = await db.select({ id: jobs.id }).from(jobs).where(and(eq(jobs.userId, userId), eq(jobs.fingerprint, rows[5].fingerprint))).limit(1);
  const interviewStart = new Date(now.getTime() + 4 * 86400000);
  interviewStart.setUTCHours(9, 0, 0, 0);
  const interviewEnd = new Date(interviewStart.getTime() + 3600000);
  if (interviewJob) await db.insert(interviews).values({ id: interviewJob.id, userId, jobId: interviewJob.id, label: "Entretien métier · exemple", startAt: interviewStart.toISOString(), endAt: interviewEnd.toISOString(), timeZone: "Europe/Paris", format: "video", state: "planned", data: "{}", updatedAt: nowIso }).onConflictDoNothing();
  await db.insert(experienceItems).values(experience.map((item, index) => ({
    id: crypto.randomUUID(), userId, kind: "experience", parentId: null,
    data: JSON.stringify({ ...item, reviewModel: 1, reviewPoints: [], provenance: [{ type: "manual", name: "Exemple fictif", quote: item.context }] }),
    validation: "approved", applicationAllowed: true, applicationConsent: "granted",
    publicProfileAllowed: true, version: 1, importKey: `demo-experience-${index}`,
    createdAt: nowIso, updatedAt: nowIso,
  }))).onConflictDoNothing({ target: [experienceItems.userId, experienceItems.importKey] });
  const bucket = env.BUCKET;
  if (bucket) {
    const files = [
      { slot: "cvFrDocumentId", name: "CV-Camille-exemple.md", text: "# Camille · profil fictif\n\nProduct Manager / Product Owner. Exemple de document, sans coordonnées personnelles.\n\nCompétences : discovery, priorisation, delivery, analyse de données.\n" },
      { slot: "detailedExperienceDocumentId", name: "Experiences-Camille-exemple.md", text: "# Expériences fictives\n\n## Atelier Horizon\nRefonte d’un portail B2B fictif.\n\n## Ligne Claire\nDiscovery et roadmap d’une plateforme SaaS fictive.\n" },
    ] as const;
    const links: Partial<CandidateProfile> = {};
    for (const file of files) {
      const id = userId.slice(5, -1) + (file.slot === "cvFrDocumentId" ? "a" : "b");
      const objectKey = `demo/${userId}/${id}`;
      await bucket.put(objectKey, file.text, { httpMetadata: { contentType: "text/markdown; charset=utf-8" } });
      await db.insert(documents).values({ id, userId, originalName: file.name, objectKey, contentType: "text/markdown; charset=utf-8", size: new TextEncoder().encode(file.text).byteLength, createdAt: nowIso }).onConflictDoNothing();
      links[file.slot] = id;
    }
    await db.update(profiles).set({ data: JSON.stringify({ ...profile, ...links }) }).where(eq(profiles.userId, userId));
  }
}
