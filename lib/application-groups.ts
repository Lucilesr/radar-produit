import { applicationColumn } from "./application-board";
import { defaultBoard, personalColumn, type PersonalColumn } from "./personal-board";
import type { JobRecord } from "./types";

/** The mobile list projects the personal board without changing a dossier. */
export function applicationGroups(jobs: JobRecord[], columns: PersonalColumn[]) {
  const safeColumns = columns.filter((column, index) => columns.findIndex(item => item.id === column.id) === index);
  for (const fallback of defaultBoard().columns) {
    if (!safeColumns.some(column => column.id === fallback.id)) safeColumns.push(fallback);
  }
  const groups = safeColumns.map(column => ({ column, jobs: [] as JobRecord[] }));
  const seen = new Set<string>();
  for (const job of jobs) {
    if (seen.has(job.id)) continue;
    seen.add(job.id);
    const target = personalColumn(job, safeColumns);
    const group = groups.find(item => item.column.id === target) ?? groups.find(item => item.column.id === applicationColumn(job));
    group?.jobs.push(job);
  }
  return groups.filter(group => group.column.stage !== "other" || group.jobs.length);
}
