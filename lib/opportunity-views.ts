import type { JobRecord } from "./types";

const appliedStatuses = new Set(["applied", "interview", "awaiting_response", "next_step", "offer", "rejected", "withdrawn"]);

export function hasApplication(job: JobRecord) {
  return appliedStatuses.has(job.status) || !!job.interviews?.length;
}

export function reviewState(job: JobRecord): "to_review" | "selected" | "none" {
  if (job.reviewState) return job.reviewState;
  if (["shortlist", "prepare", "ready"].includes(job.status)) return "selected";
  if (["new", "watchlist"].includes(job.status)) return "to_review";
  return "none";
}

export type OpportunityView = "to_review" | "selected" | "good_matches" | "all" | "trash";

export function inOpportunityView(job: JobRecord, view: OpportunityView) {
  if (view === "trash") return !!job.deletedAt;
  if (job.deletedAt) return false;
  if (view === "all") return true;
  if (view === "to_review") return reviewState(job) === "to_review" && !hasApplication(job);
  if (view === "selected") return reviewState(job) === "selected" && !hasApplication(job);
  return job.matchScore >= 75 && job.matchTier !== "excluded";
}
