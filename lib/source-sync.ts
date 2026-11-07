import type { JobRecord } from "./types";

export const automaticSources = ["We Work Remotely", "Jobgether"] as const;
export type AutomaticSource = typeof automaticSources[number];
export type SourceReading = {
  source: string; state: "ok" | "cached" | "paused" | "error"; ok: boolean;
  total: number; imported: number; deduplicated: number; matchedIds: string[];
  lastSyncedAt?: string; cachedTotal?: number; error?: string; retryAt?: string;
};
export type ScanSummary = {
  at: string; total: number; imported: number; deduplicated: number; matching: number;
  partialFailure: boolean; allFailed: boolean; inactive: boolean; sources: SourceReading[];
};

/** Unknown fit is not zero; the roadmap also accepts explicitly fulfilled conditions. */
export function scanMatches(job: Pick<JobRecord,"id"|"fit"|"conditions"|"deletedAt">) {
  return !job.deletedAt && job.conditions !== "excluded" && ((job.fit != null && job.fit >= 60) || job.conditions === "pass");
}

export function summarizeScan(sources: readonly SourceReading[], at: string): ScanSummary {
  const active = sources.filter(source=>source.state!=="paused");
  const errors = active.filter(source=>source.state==="error").length;
  return {
    at, sources:[...sources], total:sources.reduce((n,s)=>n+s.total,0), imported:sources.reduce((n,s)=>n+s.imported,0), deduplicated:sources.reduce((n,s)=>n+s.deduplicated,0),
    matching:new Set(sources.flatMap(source=>source.matchedIds)).size,
    partialFailure:errors>0&&errors<active.length, allFailed:active.length>0&&errors===active.length, inactive:active.length===0,
  };
}

/** A retry replaces only that source's reading; successful sources keep their actual counts. */
export function mergeScan(previous: ScanSummary | null, next: ScanSummary) {
  if(!previous)return next;
  const readings=new Map(previous.sources.map(source=>[source.source,source]));
  next.sources.forEach(source=>readings.set(source.source,source));
  return summarizeScan([...readings.values()],next.at);
}

export class SourceReadingError extends Error {
  constructor(public reading: SourceReading) { super(reading.error || "Lecture de la source interrompue."); }
}

/** Validate the API boundary before rendering counters or source names. */
export function readScanSummary(value: unknown): ScanSummary | null {
  if(!value||typeof value!=="object")return null;
  const raw=value as Partial<ScanSummary>;
  const count=(n:unknown)=>typeof n==="number"&&Number.isInteger(n)&&n>=0&&n<=10_000_000;
  if(typeof raw.at!=="string"||!Number.isFinite(Date.parse(raw.at))||!Array.isArray(raw.sources)||raw.sources.length>30)return null;
  for(const source of raw.sources){
    if(!source||typeof source.source!=="string"||!source.source.trim()||source.source.length>100||!["ok","cached","paused","error"].includes(source.state)
      ||![source.total,source.imported,source.deduplicated].every(count)||source.imported+source.deduplicated>source.total
      ||(source.error!==undefined&&(typeof source.error!=="string"||source.error.length>500))
      ||(source.retryAt!==undefined&&(typeof source.retryAt!=="string"||!Number.isFinite(Date.parse(source.retryAt))))
      ||!Array.isArray(source.matchedIds)||source.matchedIds.length>2000||source.matchedIds.some(id=>typeof id!=="string"||!id||id.length>100))return null;
  }
  return summarizeScan(raw.sources.map(source=>({...source,matchedIds:[...new Set(source.matchedIds)]})),raw.at);
}

export function mergeSourceSettings<T extends {source:string;updatedAt?:string}>(current: readonly T[], incoming: readonly T[]) {
  const map=new Map(current.map(source=>[source.source,source]));
  for(const source of incoming){const previous=map.get(source.source);if(!previous||Date.parse(previous.updatedAt??"")<=Date.parse(source.updatedAt??"")||!Number.isFinite(Date.parse(previous.updatedAt??"")))map.set(source.source,source);}
  return [...map.values()];
}
