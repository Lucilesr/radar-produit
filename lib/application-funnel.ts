import type { ActivityEvent } from "./activity";
import { sourceCatalog } from "./source-catalog";

export const FUNNEL_DAYS = 90;
const DAY = 86_400_000;

export type FunnelSource = { source: string; applications: number; interviews: number; offers: number; rate: number; applicationsWithoutDate: number };
export type ApplicationFunnel = {
  windowStart: string;
  windowEnd: string;
  applications: number;
  applicationsWithoutDate: number;
  interviews: number;
  offers: number;
  offersWithoutInterview: number;
  applicationInterviewRate: number | null;
  interviewOfferRate: number | null;
  monthlyInterviews: number | null;
  missing: number;
  visible: boolean;
  sources: FunnelSource[];
};

export type FunnelJob = {
  id: string;
  source: string;
  sourceUrl: string | null;
  applicationUrl: string | null;
  appliedAt: string | null;
  status: string;
};
export type FunnelInterview = { id: string; jobId: string; state: string; startAt: string; createdAt: string; updatedAt: string; outcome: string | null };

type Meeting = { at: number; cancelled: boolean; reviewed: boolean };
type Cycle = {
  source: string;
  start: number | null;
  hasPriorSend: boolean;
  cancelled: boolean;
  stageInterviewAt: number;
  offerAt: number;
  meetings: Map<string, Meeting>;
  hasInterviewStage: boolean;
  hasOfferStage: boolean;
};

const eventOrder: Record<string, number> = {
  application_sent: 0,
  interview_scheduled: 1,
  application_stage_changed: 2,
  interview_noted: 3,
  interview_cancelled: 4,
  application_cancelled: 5,
};
const sourcesByName = new Map<string, string>(sourceCatalog.map(({ name }) => [name.toLowerCase(), name]));
const sourceDomains = sourceCatalog.filter(({ url, name }) => url && name !== "Post LinkedIn")
  .map(({ name, url }) => ({ name, domain: new URL(url).hostname.replace(/^(www|app|fr)\./, "") }));
const genericSources = new Set(["", "manual", "ajout manuel", "autre", "source non renseignée"]);
const sendStatuses = new Set(["applied", "interview", "awaiting_response", "next_step", "offer", "rejected", "withdrawn"]);
const interviewStatuses = new Set(["interview", "next_step"]);

function sourceFromUrl(link: string | null | undefined) {
  if (!link) return undefined;
  try {
    const { protocol, hostname, pathname } = new URL(link);
    if (protocol !== "http:" && protocol !== "https:") return undefined;
    const source = sourceDomains.find(({ domain }) => hostname === domain || hostname.endsWith(`.${domain}`));
    if (source?.name === "LinkedIn Jobs") {
      if (pathname.startsWith("/jobs/")) return source.name;
      if (pathname.startsWith("/posts/") || pathname.startsWith("/feed/update/")) return "Post LinkedIn";
      return undefined;
    }
    return source?.name;
  } catch {
    return undefined;
  }
}

function funnelSource(recorded: unknown, job?: FunnelJob) {
  const source = (typeof recorded === "string" ? recorded.trim() : "") || job?.source.trim() || "";
  const key = source.toLowerCase();
  if (!genericSources.has(key)) return sourcesByName.get(key) ?? source;
  const currentSource = job?.source.trim();
  if (currentSource && !genericSources.has(currentSource.toLowerCase())) return sourcesByName.get(currentSource.toLowerCase()) ?? currentSource;
  return sourceFromUrl(job?.sourceUrl) ?? (!job?.sourceUrl ? sourceFromUrl(job?.applicationUrl) : undefined) ??
    (key === "autre" ? "Autre" : key === "manual" || key === "ajout manuel" ? "Ajout manuel" : "Source non renseignée");
}

function newCycle(start: number | null, source: string, hasPriorSend = false): Cycle {
  return { start, source, hasPriorSend, cancelled: false, stageInterviewAt: Infinity, offerAt: Infinity, meetings: new Map(), hasInterviewStage: false, hasOfferStage: false };
}

function interviewAt(cycle: Cycle) {
  let first = cycle.meetings.size ? Infinity : cycle.stageInterviewAt;
  for (const meeting of cycle.meetings.values()) {
    if (meeting.reviewed || !meeting.cancelled) first = Math.min(first, meeting.at);
  }
  return first;
}

/** Count each application cycle once, with current dossier facts filling gaps in the journal. */
export function applicationFunnel(events: ActivityEvent[], now = Date.now(), jobs: FunnelJob[] = [], interviews: FunnelInterview[] = []): ApplicationFunnel {
  const cutoff = now - FUNNEL_DAYS * DAY;
  const jobsById = new Map(jobs.map(job => [job.id, job]));
  const jobsWithInterviews = new Set(interviews.filter(meeting => meeting.state !== "cancelled").map(meeting => meeting.jobId));
  const entries = events.filter(event => Object.hasOwn(eventOrder, event.action)).map(event => ({ event, at: Date.parse(event.createdAt) }))
    .filter(({ at }) => Number.isFinite(at) && at <= now);
  const lastSendAt = new Map<string, number>();
  for (const { event, at } of entries) {
    if (event.action === "application_sent" && event.objectType === "job") lastSendAt.set(event.objectId, Math.max(at, lastSendAt.get(event.objectId) ?? -Infinity));
  }

  const cycles: Cycle[] = [];
  const current = new Map<string, Cycle>();
  for (const job of jobs) {
    const appliedAt = Date.parse(job.appliedAt ?? "");
    const recorded = lastSendAt.get(job.id);
    if (Number.isFinite(appliedAt)) {
      if (appliedAt <= now && (recorded === undefined || appliedAt > recorded)) {
        const event: ActivityEvent = { id: `dated-application:${job.id}`, action: "application_sent", objectType: "job", objectId: job.id, createdAt: job.appliedAt!, data: { source: job.source } };
        entries.push({ event, at: appliedAt });
      }
    } else if (recorded === undefined && (sendStatuses.has(job.status) || jobsWithInterviews.has(job.id))) {
      const cycle = newCycle(null, funnelSource(job.source, job));
      cycles.push(cycle);
      current.set(job.id, cycle);
    }
  }

  entries.sort((a, b) => a.at - b.at || eventOrder[a.event.action] - eventOrder[b.event.action] || a.event.id.localeCompare(b.event.id));
  const seen = new Set<string>();
  const sends = new Map<string, number>();
  const meetingOwners = new Map<string, Cycle>();
  for (const { event, at } of entries) {
    if (seen.has(event.id)) continue;
    seen.add(event.id);
    const jobId = event.objectType === "job" ? event.objectId : event.data.jobId;
    if (typeof jobId !== "string") continue;
    if (event.action === "application_sent") {
      if (sends.get(jobId) === at) continue;
      const cycle = newCycle(at, funnelSource(event.data.source, jobsById.get(jobId)), sends.has(jobId));
      sends.set(jobId, at);
      cycles.push(cycle);
      current.set(jobId, cycle);
      continue;
    }
    const cycle = current.get(jobId);
    if (!cycle) continue;
    if (event.action === "application_cancelled") {
      cycle.cancelled = true;
      current.delete(jobId);
      continue;
    }
    if (event.action === "application_stage_changed") {
      if (interviewStatuses.has(String(event.data.from)) || interviewStatuses.has(String(event.data.to))) {
        cycle.stageInterviewAt = Math.min(cycle.stageInterviewAt, at);
      }
      if (event.data.from === "offer") cycle.hasOfferStage = true;
      if (event.data.to === "offer") cycle.offerAt = Math.min(cycle.offerAt, at);
      continue;
    }
    const owner = meetingOwners.get(event.objectId);
    if (owner && owner !== cycle) continue;
    const previous = cycle.meetings.get(event.objectId);
    if (event.action === "interview_cancelled") {
      // Keep the cancellation even when the original appointment predates the journal.
      cycle.meetings.set(event.objectId, { at: previous?.at ?? Infinity, cancelled: true, reviewed: previous?.reviewed ?? false });
    } else {
      const reviewed = event.action === "interview_noted";
      const stated = reviewed && typeof event.data.startAt === "string" ? Date.parse(event.data.startAt) : at;
      const signalAt = Number.isFinite(stated) && stated >= (cycle.start ?? -Infinity) && stated <= now ? stated : at;
      cycle.meetings.set(event.objectId, { at: Math.min(previous?.at ?? signalAt, signalAt), cancelled: previous?.cancelled ?? false, reviewed: reviewed || (previous?.reviewed ?? false) });
      if (reviewed && event.data.outcome === "offer") cycle.offerAt = Math.min(cycle.offerAt, at);
    }
    meetingOwners.set(event.objectId, cycle);
  }

  for (const job of jobs) {
    const cycle = current.get(job.id);
    if (!cycle) continue;
    cycle.hasInterviewStage = interviewStatuses.has(job.status);
    if (job.status === "offer") cycle.hasOfferStage = true;
  }
  for (const interview of interviews) {
    const cycle = current.get(interview.jobId);
    const owner = meetingOwners.get(interview.id);
    if (!cycle || (owner && owner !== cycle)) continue;
    const scheduledAt = Date.parse(interview.createdAt);
    // With multiple recorded sends, an unlinked appointment can only support the current send if it follows it.
    if (!owner && cycle.start !== null && cycle.hasPriorSend && !(scheduledAt >= cycle.start)) continue;
    const previous = cycle.meetings.get(interview.id);
    const reviewed = interview.state === "reviewed";
    const at = reviewed ? Date.parse(interview.startAt) : scheduledAt;
    const validAt = Number.isFinite(at) && (!cycle.hasPriorSend || at >= cycle.start!) && at <= now;
    cycle.meetings.set(interview.id, {
      at: Math.min(previous?.at ?? Infinity, validAt ? at : Infinity),
      cancelled: previous?.cancelled || interview.state === "cancelled",
      reviewed: previous?.reviewed || reviewed,
    });
    if (reviewed && interview.outcome === "offer") {
      cycle.hasOfferStage = true;
      const offeredAt = Date.parse(interview.updatedAt);
      if (Number.isFinite(offeredAt) && offeredAt >= (cycle.start ?? -Infinity) && offeredAt <= now) cycle.offerAt = Math.min(cycle.offerAt, offeredAt);
    }
  }

  const bySource = new Map<string, FunnelSource>();
  let applications = 0, applicationsWithoutDate = 0, withInterview = 0, recentDatedInterviews = 0, recentDatedApplications = 0, offers = 0, offersAfterInterview = 0;
  for (const cycle of cycles) {
    if (cycle.cancelled) continue;
    const firstInterview = interviewAt(cycle);
    const hasInterview = Number.isFinite(firstInterview) || [...cycle.meetings.values()].some(meeting => meeting.reviewed || !meeting.cancelled) ||
      (cycle.meetings.size === 0 && cycle.hasInterviewStage);
    const hasOffer = Number.isFinite(cycle.offerAt) || cycle.hasOfferStage;
    applications++;
    if (cycle.start === null) applicationsWithoutDate++;
    if (hasInterview) withInterview++;
    if (cycle.start !== null && cycle.start >= cutoff) {
      recentDatedApplications++;
      if (hasInterview) recentDatedInterviews++;
    }
    if (hasOffer) offers++;
    if (Number.isFinite(cycle.offerAt) && firstInterview <= cycle.offerAt) offersAfterInterview++;
    const group = bySource.get(cycle.source) ?? { source: cycle.source, applications: 0, applicationsWithoutDate: 0, interviews: 0, offers: 0, rate: 0 };
    group.applications++;
    if (cycle.start === null) group.applicationsWithoutDate++;
    if (hasInterview) group.interviews++;
    if (hasOffer) group.offers++;
    group.rate = group.interviews / group.applications;
    bySource.set(cycle.source, group);
  }
  return {
    windowStart: new Date(cutoff).toISOString(), windowEnd: new Date(now).toISOString(), applications, applicationsWithoutDate,
    interviews: withInterview, offers, offersWithoutInterview: offers - offersAfterInterview,
    applicationInterviewRate: applications ? withInterview / applications : null,
    interviewOfferRate: withInterview ? offersAfterInterview / withInterview : null,
    monthlyInterviews: recentDatedApplications >= 5 ? recentDatedInterviews / (FUNNEL_DAYS / 30) : null,
    missing: Math.max(0, 5 - applications), visible: applications >= 5,
    sources: [...bySource.values()].sort((a, b) => b.interviews - a.interviews || b.applications - a.applications || a.source.localeCompare(b.source, "fr")),
  };
}

export function funnelMonthlyLabel(value: number) {
  const count = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(value);
  return `Environ ${count} candidature${value >= 2 ? "s" : ""} avec entretien par mois`;
}
