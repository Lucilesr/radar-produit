import type { JobRecord } from "./types";

const appliedStatuses = new Set(["applied", "interview", "awaiting_response", "next_step", "offer", "rejected", "withdrawn"]);

export function hasApplication(job: JobRecord) {
  return appliedStatuses.has(job.status) || !!job.interviews?.length;
}

export function workspaceSections(context: "opportunity" | "application") {
  return context === "opportunity"
    ? ["offer", "brief"] as const
    : ["offer", "application", "interviews", "brief"] as const;
}

export function reviewState(job: JobRecord): "to_review" | "selected" | "later" | "none" {
  if (job.reviewState === "reopened") return "to_review";
  if (job.reviewState) return job.reviewState;
  if (["shortlist", "prepare", "ready"].includes(job.status)) return "selected";
  if (["new", "watchlist"].includes(job.status)) return "to_review";
  return "none";
}

export type OpportunityView = "to_review" | "selected" | "good_matches" | "trash" | "archived";

/** Age of an announcement before it leaves « À examiner » for the archive. */
export const ARCHIVE_AFTER_DAYS = 21;

export type ReviewDecision = "to_review" | "selected" | "later";

/** An explicit return is distinct from an untouched import, even after a reload. */
export function storedReviewDecision(decision: ReviewDecision): NonNullable<JobRecord["reviewState"]> {
  return decision === "to_review" ? "reopened" : decision;
}

// SQLite's CURRENT_TIMESTAMP gives "2026-11-07 09:30:00", in UTC without a marker.
function timeOf(value: string | undefined) {
  if (!value) return Number.NaN;
  return Date.parse(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(value) ? `${value.replace(" ", "T")}Z` : value);
}

/** Last decision or arrival: the most recent of the creation and the last change. */
export function lastActivity(job: Pick<JobRecord, "createdAt" | "updatedAt">) {
  const times = [timeOf(job.createdAt), timeOf(job.updatedAt)].filter(Number.isFinite);
  return times.length ? Math.max(...times) : Number.NaN;
}

/** Publication wins over import/edit dates; an explicit decision starts a fresh delay. */
export function archiveReferenceTime(job: JobRecord) {
  if (job.reviewState === "reopened" || job.reviewState === "later") return lastActivity(job);
  const published = timeOf(job.publishedAt);
  if (Number.isFinite(published)) return published;
  const created = timeOf(job.createdAt);
  return Number.isFinite(created) ? created : timeOf(job.updatedAt);
}

/** Computed at read time: selections and applications are never archived. */
export function isArchived(job: JobRecord, now = Date.now()) {
  const state = reviewState(job);
  if (job.deletedAt || hasApplication(job) || (state !== "to_review" && state !== "later")) return false;
  const reference = archiveReferenceTime(job);
  return Number.isFinite(reference) && now - reference >= ARCHIVE_AFTER_DAYS * 86400000;
}

const outOfSearch = (job: JobRecord) => job.matchTier === "excluded" && job.flags?.some(flag => flag.startsWith("Lieu annoncé hors de votre recherche") || flag.startsWith("Marché limité aux États-Unis") || flag.startsWith("Salaire sous votre seuil") || flag.startsWith("TJM sous votre seuil") || flag.startsWith("Contient "));

/** In « À examiner » and still without any decision: the pool of the lot of the day. */
export function awaitingDecision(job: JobRecord, now = Date.now()) {
  return reviewState(job) === "to_review" && inOpportunityView(job, "to_review", now);
}

export function sortOpportunitiesByDate(jobs: JobRecord[], view: OpportunityView, order: "newest" | "oldest") {
  const field = view === "trash" ? "deletedAt" : "createdAt";
  const direction = order === "newest" ? -1 : 1;
  return [...jobs].sort((a, b) => {
    const dateOrder = (a[field] ?? "").localeCompare(b[field] ?? "");
    return dateOrder ? dateOrder * direction : a.id.localeCompare(b.id);
  });
}

export function inOpportunityView(job: JobRecord, view: OpportunityView, now = Date.now()) {
  if (view === "trash") return !!job.deletedAt;
  if (job.deletedAt) return false;
  if (view === "archived") return isArchived(job, now) && !outOfSearch(job);
  if (view === "to_review") return (reviewState(job) === "to_review" || reviewState(job) === "later") && !hasApplication(job)
    && !outOfSearch(job) && !isArchived(job, now);
  if (view === "selected") return reviewState(job) === "selected" && !hasApplication(job);
  if (hasApplication(job) || isArchived(job, now)) return false;
  // Score v2: a good match fits the job and is known well enough; older records keep the legacy rule.
  if (job.fit !== undefined) return job.fit != null && job.fit >= 80 && job.conditions !== "excluded" && job.confidence !== "low";
  return job.matchScore >= 75 && job.matchTier !== "excluded";
}
