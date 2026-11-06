import type { JobRecord } from "./types";
import { remindsInToday, sourceKind, sourceStatus, type SourceMode } from "./source-status";
import { terminalStatuses } from "./application-workflow";
export function upcomingInterviews(jobs: JobRecord[], now = Date.now()) {
  return jobs.filter(job => !terminalStatuses.includes(job.status)).flatMap(job => (job.interviews || [])
    .filter(event => event.state === "planned" && Number.isFinite(Date.parse(event.endAt)) && Date.parse(event.endAt) > now)
    .map(event => ({job,event}))).sort((a,b) => Date.parse(a.event.startAt)-Date.parse(b.event.startAt));
}

type VisitableSource = { source: string; lastVisitedAt?: string; visitEveryDays?: number; remindInToday?: boolean; state?: string; selected?: boolean; health?: string };

/**
 * Sources to go through today: the ones Radar does not collect by itself, due for a visit,
 * and still reminded. Nothing here is tied to a particular source or profile.
 */
export function sourcesToVisit(settings: VisitableSource[], modeOf: (name: string) => SourceMode | undefined, now = new Date()) {
  return settings.flatMap(setting => {
    const mode = modeOf(setting.source);
    if (!mode || sourceKind(mode) !== "manual" || !remindsInToday(setting)) return [];
    const status = sourceStatus(setting, mode, now);
    if (status !== "to_visit" && status !== "new") return [];
    return [{ source: setting.source, status, detail: visitDetail(setting.lastVisitedAt, now) }];
  }).sort((a, b) => a.source.localeCompare(b.source, "fr"));
}

function visitDetail(last: string | undefined, now: Date) {
  const time = Date.parse(last ?? "");
  if (!Number.isFinite(time)) return "Jamais visitée";
  const days = Math.floor((now.getTime() - time) / 86400000);
  return days <= 0 ? "Vue aujourd\u2019hui" : days === 1 ? "Vue hier" : `Vue il y a ${days} jours`;
}
