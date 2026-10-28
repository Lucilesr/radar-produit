import { reviewDue, terminalStatuses } from "./application-workflow";
import { upcomingInterviews } from "./workspace-agenda";
import type { JobRecord, JobStatus } from "./types";

export const applicationColumns = [
  { id: "sent", label: "Envoyées" },
  { id: "interviews", label: "Entretiens" },
  { id: "offer", label: "Propositions" },
  { id: "closed", label: "Closes" },
  { id: "other", label: "À préciser" },
] as const;
export type ApplicationColumn = typeof applicationColumns[number]["id"];

/** A view of existing statuses; no status or interview is written by grouping. */
export function applicationColumn(job: JobRecord): ApplicationColumn {
  if (terminalStatuses.includes(job.status)) return "closed";
  if (job.status === "offer") return "offer";
  // Explicitly returning to Sent keeps the interview history without forcing its column.
  if (job.status === "applied") return "sent";
  if (["interview", "next_step"].includes(job.status) || job.interviews?.some(event => event.state !== "cancelled")) return "interviews";
  if (job.status === "awaiting_response") return "sent";
  return "other";
}

export type ApplicationMove = { kind: "none" | "unavailable" | "confirm-close" } | { kind: "status"; status: JobStatus };

/** A column change requests a status only; it never rewrites notes or events. */
export function applicationMove(job: JobRecord, target: string, closure?: JobStatus): ApplicationMove {
  if (applicationColumn(job) === target) return { kind: "none" };
  if (target === "sent") return { kind: "status", status: "applied" };
  if (target === "interviews") return { kind: "status", status: "interview" };
  if (target === "offer") return { kind: "status", status: "offer" };
  if (target === "closed") return closure === "rejected" || closure === "withdrawn" ? { kind: "status", status: closure } : { kind: "confirm-close" };
  return { kind: "unavailable" };
}

export function applicationInterviewStep(job: JobRecord, now: number) {
  const events = (job.interviews ?? []).filter(event => event.state !== "cancelled" && Number.isFinite(Date.parse(event.startAt)))
    .sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt) || a.id.localeCompare(b.id));
  const next = upcomingInterviews([job], now).find(({ event }) => Number.isFinite(Date.parse(event.startAt)))?.event;
  const current = next ?? events.at(-1);
  return { next, current, rank: current ? events.findIndex(event => event.id === current.id) + 1 : null };
}

export function applicationDestination(job: JobRecord, now: number): "application" | "interviews" {
  if (job.status === "offer") return "application";
  return job.interviews?.some(event => reviewDue(event, now)) || upcomingInterviews([job], now).length || job.status === "interview" ? "interviews" : "application";
}
