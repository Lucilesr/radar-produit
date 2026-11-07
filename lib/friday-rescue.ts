import type { JobRecord } from "./types";
import { hasApplication } from "./opportunity-views";

export function rescueDay(now: Date) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function hash(value: string) {
  let result = 2166136261;
  for (const char of value) result = Math.imul(result ^ char.charCodeAt(0), 16777619);
  return result >>> 0;
}

/** Same local Friday + same pool => same three offers, independent of input order. */
export function fridayRescue(jobs: readonly JobRecord[], now = new Date()) {
  if (now.getDay() !== 5) return [];
  const day = rescueDay(now);
  return jobs.filter(job => {
    const deleted = Date.parse(job.deletedAt ?? "");
    const age = now.getTime() - deleted;
    return Number.isFinite(deleted) && age >= 0 && age <= 7 * 86400000 && !hasApplication(job)
      && (job.fitLabel === "close" || job.fitLabel === "very_close")
      && job.fit != null && job.fit >= 60 && job.conditions !== "excluded";
  }).sort((a, b) => hash(`${day}:${a.id}`) - hash(`${day}:${b.id}`) || a.id.localeCompare(b.id)).slice(0, 3);
}

/** Isolated demo only: render the Friday state without changing the device clock. */
export function demoFriday(now = new Date()) {
  const friday = new Date(now);
  friday.setDate(friday.getDate() - (friday.getDay() + 2) % 7);
  return friday;
}
