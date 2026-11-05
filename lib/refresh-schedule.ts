export type RefreshMode = "on_open" | "manual";
export const defaultRefreshMode: RefreshMode = "on_open";
export const defaultRefreshEveryHours = 12;
export const refreshModeLabels: Record<RefreshMode, string> = {
  on_open: "Actualiser automatiquement à l’ouverture",
  manual: "Seulement quand je le demande",
};
export const refreshMode = (value: unknown): RefreshMode => value === "manual" ? "manual" : defaultRefreshMode;

const hour = 3600000;

/** The most recent collection across the sources Radar reads by itself. */
export function lastRefreshAt(settings: { lastSyncedAt?: string }[]): string | undefined {
  const times = settings.map(setting => Date.parse(setting.lastSyncedAt ?? "")).filter(Number.isFinite);
  return times.length ? new Date(Math.max(...times)).toISOString() : undefined;
}

/**
 * Radar refreshes on its own only if the account asked for it and the last collection is older
 * than `everyHours`. The caches of each source still apply: this never forces a fetch.
 */
export function shouldRefreshOnOpen(mode: RefreshMode, last: string | undefined, now = Date.now(), everyHours = defaultRefreshEveryHours): boolean {
  if (mode !== "on_open") return false;
  const time = Date.parse(last ?? "");
  return !Number.isFinite(time) || now - time >= everyHours * hour;
}

/** « à l'instant », « il y a 2 h », « hier », « le 29 oct. » — short enough for a header. */
export function refreshedAgo(last: string | undefined, now = Date.now()): string {
  const time = Date.parse(last ?? "");
  if (!Number.isFinite(time)) return "Jamais actualisé";
  const minutes = Math.max(0, Math.round((now - time) / 60000));
  if (minutes < 2) return "Actualisé à l’instant";
  if (minutes < 60) return `Actualisé il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Actualisé il y a ${hours} h`;
  const days = Math.round(hours / 24);
  return days === 1 ? "Actualisé hier" : `Actualisé il y a ${days} jours`;
}
