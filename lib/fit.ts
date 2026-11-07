import { foldKeyword, domainKeywords } from "./search-preferences";
import { levelGap, type DetectedLevel } from "./seniority";
import type { JobInput, SearchPreferences } from "./types";

/** Score v2: how well the job itself fits, apart from the conditions filter. */
export type FitParts = { role?: number; level?: number; pay?: number; domain?: number };
export type Confidence = "high" | "medium" | "low";
export type RoleMatch = "exact" | "ambiguous" | "none";

export const FIT_WEIGHTS = { role: 30, level: 25, pay: 15, domain: 30 } as const;
/** Pay above these multiples of the account's minimum hints at a more senior job. */
export const PAY_ABOVE_TARGET = 1.35;
export const PAY_LIKELY_SENIOR = 1.6;
const DOMAIN_STEPS = [12, 8, 5];
const DOMAIN_TAIL = 2;

/** A description long enough to read missions from, whatever the source said about its coverage. */
export function hasReadableDescription(job: Pick<JobInput, "contentCoverage" | "description">) {
  // A two-line summary says nothing about the missions: it must not count as "no match".
  return job.contentCoverage === "full" || (job.description ?? "").trim().length >= 300;
}

function payPart(job: JobInput, search: SearchPreferences, level: DetectedLevel | undefined) {
  const daily = job.contractType === "freelance" || job.contractType === "portage" || (job.annualSalary == null && job.dailyRate != null);
  const figure = daily ? job.dailyRate ?? null : job.annualSalary ?? null;
  const minimum = daily ? search.minimumDailyRate : search.minimumSalary;
  if (figure == null || !minimum) return undefined;
  if (level && search.targetLevel && levelGap(level.level, search.targetLevel) === 0) return { points: FIT_WEIGHTS.pay };
  const ratio = figure / minimum;
  if (ratio <= PAY_ABOVE_TARGET) return { points: FIT_WEIGHTS.pay };
  if (ratio <= PAY_LIKELY_SENIOR) return { points: 8, signal: "Rémunération au-dessus de votre cible : vérifiez le niveau attendu." };
  return { points: 0, signal: "Rémunération très au-dessus de votre cible : poste probablement plus senior." };
}

function domainPart(job: JobInput, search: SearchPreferences) {
  const terms = domainKeywords(search);
  if (!terms.length || !hasReadableDescription(job)) return undefined;
  const haystack = foldKeyword(job.description ?? "");
  const found = [...new Set(terms.filter(term => haystack.includes(foldKeyword(term))))];
  return found.reduce((total, _term, index) => total + (DOMAIN_STEPS[index] ?? DOMAIN_TAIL), 0);
}

function levelPart(level: DetectedLevel | undefined, target: SearchPreferences["targetLevel"]) {
  if (!level || !target) return undefined;
  const gap = levelGap(level.level, target);
  return gap === 0 ? FIT_WEIGHTS.level : gap === 1 ? 15 : gap === -1 ? 10 : 0;
}

/** Fit out of 100 on the known parts only: a missing fact never lowers it. */
export function assessFit(job: JobInput, search: SearchPreferences, role: RoleMatch, level: DetectedLevel | undefined) {
  const parts: FitParts = {};
  const signals: string[] = [];
  if (search.roles.length) parts.role = role === "exact" ? FIT_WEIGHTS.role : role === "ambiguous" ? 15 : 0;
  const levelPoints = levelPart(level, search.targetLevel);
  if (levelPoints != null) parts.level = levelPoints;
  const pay = payPart(job, search, level);
  if (pay) { parts.pay = pay.points; if (pay.signal) signals.push(pay.signal); }
  const domain = domainPart(job, search);
  if (domain != null) parts.domain = Math.min(FIT_WEIGHTS.domain, domain);
  const known = (Object.keys(parts) as (keyof FitParts)[]);
  const weight = known.reduce((total, key) => total + FIT_WEIGHTS[key], 0);
  const points = known.reduce((total, key) => total + (parts[key] ?? 0), 0);
  // "To weigh": one level above the target, or pay well above it; not a junior or far too senior job.
  const toWeigh = levelPoints === 15 || signals.length > 0;
  return { fit: weight ? Math.round(points / weight * 100) : null, parts, signals, toWeigh };
}

/** How much of the offer is actually known: description, pay, presence, level and language. */
export function assessConfidence(job: JobInput, presenceKnown: boolean, level: DetectedLevel | undefined): { confidence: Confidence; missing: string[] } {
  const longEnough = (job.description ?? "").trim().length >= 1200 && job.contentCoverage !== "summary";
  const checks: Array<[boolean, string]> = [
    [job.contentCoverage === "full" || longEnough, "description complète"],
    [job.annualSalary != null || job.dailyRate != null || job.salaryMin != null || job.salaryMax != null || job.dailyRateMin != null || job.dailyRateMax != null, "rémunération"],
    [presenceKnown, "présence"],
    [!!level, "niveau"],
    [job.language !== "unknown", "langue"],
  ];
  const known = checks.filter(([ok]) => ok).length;
  return { confidence: known >= 4 ? "high" : known === 3 ? "medium" : "low", missing: checks.filter(([ok]) => !ok).map(([, label]) => label) };
}

export type FitLabel = "very_close" | "close" | "to_weigh" | "far";
export const fitLabels: Record<FitLabel, string> = { very_close: "Très proche", close: "Proche", to_weigh: "À jauger", far: "Loin" };

/**
 * Label shown instead of a figure. The title and pay alone say nothing about the job itself:
 * without its level or missions, the offer must be completed first.
 */
export function fitLabel(fit: number | null | undefined, parts: FitParts = {}, toWeigh = false): FitLabel | undefined {
  if (fit == null || parts.role == null || (parts.level == null && parts.domain == null)) return undefined;
  if (fit < 50) return "far";
  if (toWeigh) return "to_weigh";
  return fit >= 80 ? "very_close" : fit >= 60 ? "close" : "far";
}

type MysteryCandidate = { conditions?: "pass" | "check" | "excluded"; fitParts?: FitParts; confidence?: Confidence; deletedAt?: string };

/** Score v2 S4: the right job, but the source only gave a glimpse. Completing it reveals its fit. */
export function isMysteryOffer(job: MysteryCandidate) {
  return !job.deletedAt && job.conditions !== "excluded" && job.fitParts?.role === FIT_WEIGHTS.role && job.confidence === "low";
}

/** Up to `limit` mystery offers first, in their current order, then the others unchanged. */
export function pinMysteryOffers<T extends MysteryCandidate>(jobs: readonly T[], limit = 5): T[] {
  const pinned = jobs.filter(isMysteryOffer).slice(0, limit);
  return [...pinned, ...jobs.filter(job => !pinned.includes(job))];
}

/** Message when a completed offer reveals its fit; "Bonne pioche" for a very close one. */
export function revealMessage(job: { fit?: number | null; fitLabel?: FitLabel }) {
  if (!job.fitLabel || job.fit == null) return "Fiche complétée. Il manque encore le niveau ou les missions pour la juger.";
  const label = `${fitLabels[job.fitLabel]} (${job.fit} sur 100)`;
  return job.fitLabel === "very_close" ? `Bonne pioche : ${label}.` : `Fiche complétée : ${label}.`;
}
