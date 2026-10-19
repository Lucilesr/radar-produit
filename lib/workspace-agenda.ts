import type { JobRecord } from "./types";
import { terminalStatuses } from "./application-workflow";
export function upcomingInterviews(jobs: JobRecord[], now = Date.now()) {
  return jobs.filter(job => !terminalStatuses.includes(job.status)).flatMap(job => (job.interviews || [])
    .filter(event => event.state === "planned" && Number.isFinite(Date.parse(event.endAt)) && Date.parse(event.endAt) > now)
    .map(event => ({job,event}))).sort((a,b) => Date.parse(a.event.startAt)-Date.parse(b.event.startAt));
}
