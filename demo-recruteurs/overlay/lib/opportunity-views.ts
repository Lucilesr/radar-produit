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

export function reviewState(job: JobRecord): "to_review" | "selected" | "none" {
  if (job.reviewState) return job.reviewState;
  if (["shortlist", "prepare", "ready"].includes(job.status)) return "selected";
  if (["new", "watchlist"].includes(job.status)) return "to_review";
  return "none";
}

export type OpportunityView = "to_review" | "selected" | "good_matches" | "trash";

export function inOpportunityView(job: JobRecord, view: OpportunityView) {
  if (view === "trash") return !!job.deletedAt;
  if (job.deletedAt) return false;
  if (view === "to_review") return reviewState(job) === "to_review" && !hasApplication(job);
  if (view === "selected") return reviewState(job) === "selected" && !hasApplication(job);
  return !hasApplication(job) && job.matchScore >= 75 && job.matchTier !== "excluded";
}
