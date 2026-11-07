import type { sourceCatalog } from "./source-catalog";

export type SourceMode = typeof sourceCatalog[number]["mode"];
export type SourceKind = "automatic" | "manual" | "outreach";
export type SourceStatus = "ok" | "error" | "to_configure" | "paused" | "new" | "to_visit" | "up_to_date";

/** What a setting of one source holds, as far as its status is concerned. */
export type SourceStatusInput = {
  state?: string;
  linkUrl?: string;
  searchLinks?: Record<string, { Site?: string; Google?: string }>;
  latestAlert?: { url: string };
  lastSyncedAt?: string;
  selected?: boolean;
  health?: string;
  lastVisitedAt?: string;
  visitEveryDays?: number;
} | undefined;

/** Radar collects on its own, or it prepares links the person opens. */
export function sourceKind(mode: SourceMode): SourceKind {
  if (mode === "manual") return "outreach";
  return mode === "web" || mode === "research" ? "manual" : "automatic";
}

export const defaultVisitEveryDays = 2;
/** How often a source to visit should be gone through, and how it is named. */
export const visitRhythms: [number, string][] = [[1, "Chaque jour"], [2, "Tous les 2 jours"], [7, "Chaque semaine"]];
export const visitEvery = (setting?: { visitEveryDays?: number }) =>
  visitRhythms.some(([days]) => days === setting?.visitEveryDays) ? setting!.visitEveryDays! : defaultVisitEveryDays;
/** « Aujourd'hui » reminds about a source to visit unless the account turned it off. */
export const remindsInToday = (setting?: { remindInToday?: boolean }) => setting?.remindInToday !== false;

/** Configuration is inferred from saved inputs, never from a declared progress state. */
export function hasSourceConfiguration(setting: SourceStatusInput, mode: SourceMode): boolean {
  // These built-in collectors have no per-source setup to complete.
  if (mode === "rss" || mode === "api") return true;
  const usable = (value?: string) => {
    if (!value || value.length > 2048) return false;
    try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password; }
    catch { return false; }
  };
  return usable(setting?.linkUrl) || usable(setting?.latestAlert?.url)
    || Object.values(setting?.searchLinks ?? {}).some(links => usable(links?.Site) || usable(links?.Google));
}

export function sourceStatus(setting: SourceStatusInput, mode: SourceMode, now: Date = new Date()): SourceStatus {
  if (sourceKind(mode) === "automatic") {
    if (setting?.state === "paused") return "paused";
    if (setting?.health === "degraded") return "error";
    return hasSourceConfiguration(setting, mode) ? "ok" : "to_configure";
  }
  if (!setting?.lastVisitedAt) return "new";
  const days = setting.visitEveryDays && setting.visitEveryDays > 0 ? setting.visitEveryDays : defaultVisitEveryDays;
  const elapsed = now.getTime() - Date.parse(setting.lastVisitedAt);
  return Number.isNaN(elapsed) || elapsed > days * 86400000 ? "to_visit" : "up_to_date";
}

export const statusLabels: Record<SourceStatus, string> = {
  ok: "Configurée",
  error: "Erreur",
  to_configure: "À configurer",
  paused: "En pause",
  new: "Nouvelle",
  to_visit: "À visiter",
  up_to_date: "À jour",
};

/** Tone drives the colour: success, warning, danger, quiet or information. */
export const statusTones: Record<SourceStatus, "ok" | "warning" | "danger" | "quiet" | "info"> = {
  ok: "ok", up_to_date: "ok", to_configure: "warning", to_visit: "warning", error: "danger", paused: "quiet", new: "info",
};

export const statusActions: Record<SourceStatus, string> = {
  ok: "Réglages", error: "Réessayer", to_configure: "Terminer", paused: "Reprendre",
  new: "Ouvrir", to_visit: "Ouvrir", up_to_date: "Ouvrir",
};

export const needsAction = (status: SourceStatus) => status === "error" || status === "to_configure" || status === "to_visit" || status === "new";

/** Summary beside « Sources suivies »: how many sources, and how many need the person. */
export function followedSourcesSummary(total: number, needingAction: number): string {
  if (total <= 0) return "";
  const action = needingAction > 0 ? `${needingAction} demande${needingAction > 1 ? "nt" : ""} une action` : "rien à faire";
  return `${total} source${total > 1 ? "s" : ""} · ${action}`;
}
