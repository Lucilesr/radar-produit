import { ARCHIVE_AFTER_DAYS } from "./opportunity-views";
import type { JobRecord } from "./types";

/** Tri Q1b: the offers outside the lot of the day, sorted into groups decided in one go. */
export type ReserveGroupId = "later" | "conditions" | "far" | "pay" | "old" | "other";

export const reserveGroups: Array<{ id: ReserveGroupId; label: string; help: string }> = [
  { id: "later", label: "Gardées pour plus tard", help: "Les offres que vous avez mises de côté." },
  { id: "conditions", label: "Hors de vos conditions", help: "Présence, contrat ou autre condition non remplie." },
  { id: "far", label: "Loin de votre recherche", help: "Adéquation sous 50 sur 100." },
  { id: "pay", label: "Rémunération non communiquée", help: "Ni salaire ni TJM dans l’annonce." },
  { id: "old", label: `Publiées il y a plus de ${ARCHIVE_AFTER_DAYS} jours`, help: "Annonces anciennes, souvent déjà pourvues." },
  { id: "other", label: "Les autres", help: "Le reste de la réserve." },
];

function payUnknown(job: JobRecord) {
  return job.annualSalary == null && job.dailyRate == null && job.salaryMin == null && job.salaryMax == null && job.dailyRateMin == null && job.dailyRateMax == null;
}

/** First group that matches, in the order above: every offer belongs to exactly one group. */
export function reserveGroup(job: JobRecord, now: number): ReserveGroupId {
  if (job.reviewState === "later") return "later";
  if (job.conditions === "excluded") return "conditions";
  if (job.fitLabel === "far") return "far";
  if (payUnknown(job)) return "pay";
  const published = job.publishedAt ? Date.parse(job.publishedAt) : Number.NaN;
  if (Number.isFinite(published) && now - published > ARCHIVE_AFTER_DAYS * 86400000) return "old";
  return "other";
}

/** Non-empty groups, in order, each keeping the order of `jobs`. */
export function groupReserve(jobs: readonly JobRecord[], now: number) {
  const byGroup = new Map<ReserveGroupId, JobRecord[]>();
  for (const job of jobs) {
    const id = reserveGroup(job, now);
    byGroup.set(id, [...(byGroup.get(id) ?? []), job]);
  }
  return reserveGroups.filter(group => byGroup.has(group.id)).map(group => ({ ...group, jobs: byGroup.get(group.id)! }));
}
