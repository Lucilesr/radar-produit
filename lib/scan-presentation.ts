import {demoScanSources,demoScanState} from "./demo-scan-plan";
import { automaticSources, type SourceReading } from "./source-sync";
import { isSourceVisible } from "./source-visibility";
import type { SourceSetting } from "../components/source-card";

export type ScanSourceState = "waiting" | "running" | SourceReading["state"];
export type ScanSourceProgress = { source: string; state: ScanSourceState };
const defaults = new Set(["Collective", "Apec", "Free-Work", "We Work Remotely", "LinkedIn Jobs", "Welcome to the Jungle", "Wellfound", "Himalayas"]);
export function automaticSourceActive(name: string, settings: readonly SourceSetting[]) {
  const setting = settings.find(item => item.source === name);
  return setting?.state !== "paused" && (name === "We Work Remotely" ? setting?.selected !== false : setting?.selected === true);
}
export function scanPlan(settings: readonly SourceSetting[], simulated=false): ScanSourceProgress[] {
  return simulated?demoScanSources.map(source=>({source,state:demoScanState(source,settings)})):automaticSources.map(source => ({ source, state: automaticSourceActive(source, settings) ? "waiting" : "paused" }));
}
export function sortedScanReadings(readings: readonly SourceReading[]) {
  return readings.filter(item => item.state !== "paused").toSorted((a, b) => b.matchedIds.length - a.matchedIds.length || b.total - a.total || a.source.localeCompare(b.source, "fr"));
}
export function scanBar(reading: SourceReading, max: number) {
  const total = Math.max(0, reading.total), matching = Math.min(total, new Set(reading.matchedIds).size);
  return { width: max > 0 ? Math.min(100, total / max * 100) : 0, matching: total > 0 ? matching / total * 100 : 0 };
}
type CatalogSource = { name: string; mode: string; url: string };
export function scanSourceGroups(catalog: readonly CatalogSource[], settings: readonly SourceSetting[]) {
  const active = (source: CatalogSource) => (automaticSources as readonly string[]).includes(source.name)
    ? automaticSourceActive(source.name, settings)
    : source.mode !== "manual" && settings.find(item => item.source === source.name)?.state !== "paused" && isSourceVisible(source.name, [...settings], defaults);
  const visitedAt = (name: string) => { const time = Date.parse(settings.find(item => item.source === name)?.lastVisitedAt ?? ""); return Number.isFinite(time) ? time : -Infinity; };
  const visits = catalog.filter(source => source.mode !== "api" && source.mode !== "rss" && active(source))
    .toSorted((a, b) => visitedAt(a.name) - visitedAt(b.name) || a.name.localeCompare(b.name, "fr"));
  return { visits: visits.slice(0, 3), otherVisits: visits.slice(3), paused: catalog.filter(source => source.mode !== "manual" && !active(source)) };
}
export function visitUrl(source: CatalogSource, settings: readonly SourceSetting[]) {
  const value = settings.find(item => item.source === source.name)?.linkUrl || source.url;
  try { const url = new URL(value); return ["https:", "http:"].includes(url.protocol) ? url.href : null; } catch { return null; }
}
/** Positions depend on identity, not order, so an arriving source never moves old echoes. */
export function radarEchoes(ids: readonly string[]) {
  return [...new Set(ids)].map(id => {
    let hash = 2166136261;
    for (let index = 0; index < id.length; index++) hash = Math.imul(hash ^ id.charCodeAt(index), 16777619);
    const angle = (hash >>> 0) / 4294967296 * Math.PI * 2;
    const radius = 10 + ((hash >>> 8) % 3200) / 100;
    return { id, x: 50 + Math.cos(angle) * radius, y: 50 + Math.sin(angle) * radius };
  });
}
export function scanSourceStatus(state: ScanSourceState) {
  return state === "waiting" ? "en attente" : state === "running" ? "en cours" : state === "error" ? "erreur" : state === "paused" ? "en pause" : state === "cached" ? "✓ lecture récente conservée" : "✓ terminé";
}
/** Sequential reads expose waiting/running/completed states and keep every confirmed result. */
export async function scanSources(
  names: readonly string[], read: (source: string) => Promise<SourceReading>,
  update: (source: string, state: ScanSourceState, reading?: SourceReading) => void,
  signal: AbortSignal,
) {
  const readings: SourceReading[] = [];
  for (const source of names) update(source, "waiting");
  for (const source of names) {
    update(source, "running");
    let reading: SourceReading;
    try { signal.throwIfAborted(); reading = await read(source); }
    catch { reading = { source, state: "error", ok: false, total: 0, imported: 0, deduplicated: 0, matchedIds: [], error: signal.aborted ? "Le balayage s’est arrêté. Vos offres restent conservées." : "Cette source n’a pas répondu. Les autres résultats sont conservés." }; }
    readings.push(reading); update(source, reading.state, reading);
  }
  return readings;
}
export function offersFromSource<T extends { source: string }>(jobs: readonly T[], source?: string) {
  return source ? jobs.filter(job => job.source === source) : [...jobs];
}

/** The reference precedes this run; the completion time is never used as history. */
export function noNewScanLabel(previousAt:string|undefined){
 const previous=Date.parse(previousAt??"");
 return Number.isFinite(previous)?`Rien de nouveau depuis ${new Date(previous).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})}`:"Aucune nouvelle offre à ce premier balayage";
}
