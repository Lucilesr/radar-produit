import type { JobRecord } from "./types";

// Patch only deletion state; keep any newer note/status received while the request ran.
export function applyTrashState(current: JobRecord[], results: { id: string; deletedAt?: string | null; dismissalReason?: JobRecord["dismissalReason"] | null; dismissalNote?: string | null }[]) {
  const states = new Map(results.map(item => [item.id, item]));
  return current.map(job => { const state = states.get(job.id); return state ? { ...job, deletedAt: state.deletedAt ?? undefined,
    dismissalReason: "dismissalReason" in state ? state.dismissalReason ?? undefined : job.dismissalReason,
    dismissalNote: "dismissalNote" in state ? state.dismissalNote ?? undefined : job.dismissalNote } : job; });
}

export function selectionInView(jobs: JobRecord[], ids: string[]) {
  const selected = new Set(ids);
  return jobs.filter(job => selected.has(job.id)).slice(0, 50);
}
