import { reviewDue, terminalStatuses } from "./application-workflow";
import { upcomingInterviews } from "./workspace-agenda";
import type { JobRecord } from "./types";

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
  if (["interview", "next_step"].includes(job.status) || job.interviews?.some(event => event.state !== "cancelled")) return "interviews";
  if (["applied", "awaiting_response"].includes(job.status)) return "sent";
  return "other";
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
