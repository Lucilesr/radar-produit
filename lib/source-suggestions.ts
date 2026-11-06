import { sourceKind, type SourceMode } from "./source-status";
import type { SearchPreferences } from "./types";

type CatalogSource = { name: string; group: string; url: string; mode: SourceMode; note: string };

export const modeLabels: Record<SourceMode, string> = {
  api: "Collecte sans compte",
  rss: "Flux à activer",
  email: "Alerte email",
  web: "À consulter",
  research: "À qualifier",
  manual: "Ajout volontaire",
};

/** Two or three words about what a source brings, read from its catalogue entry. */
export function sourceTags(source: CatalogSource): string[] {
  const fromGroup = source.group.split("·").map(part => part.trim()).filter(Boolean);
  return [modeLabels[source.mode] ?? "À consulter", ...fromGroup].slice(0, 3);
}

const has = (text: string, word: string) => text.toLocaleLowerCase("fr").includes(word);

/**
 * How well a source fits the account's criteria: contracts searched, presence accepted and
 * whether the search goes beyond France. Nothing here is tied to a particular profile.
 */
export function sourceScore(source: CatalogSource, preferences: SearchPreferences): number {
  const group = source.group;
  const freelance = preferences.contracts.some(contract => contract === "freelance" || contract === "portage");
  const salaried = preferences.contracts.some(contract => contract === "cdi" || contract === "cdd");
  const remote = preferences.remote === "full_remote" || preferences.remote === "exceptional";
  const abroad = (preferences.includedLocations ?? []).length === 0
    || (preferences.includedLocations ?? []).some(place => !has(place, "france"));
  let score = 0;
  if (freelance && has(group, "freelance")) score += 2;
  if (salaried && has(group, "cdi")) score += 2;
  if (remote && (has(group, "remote") || has(group, "international"))) score += 2;
  if (abroad && has(group, "international")) score += 1;
  if (!abroad && has(group, "france")) score += 1;
  // A source Radar can collect by itself asks less of the person.
  if (sourceKind(source.mode) === "automatic") score += 1;
  return score;
}

/** The catalogue, best fit first; ties keep the catalogue's own order. */
export function rankSources<T extends CatalogSource>(sources: readonly T[], preferences: SearchPreferences): T[] {
  return sources.map((source, index) => ({ source, index, score: sourceScore(source, preferences) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(entry => entry.source);
}

/** Free search over the name, the group and the tags. */
export function matchesSourceQuery(source: CatalogSource, query: string): boolean {
  const needle = query.trim().toLocaleLowerCase("fr");
  if (!needle) return true;
  return [source.name, source.group, ...sourceTags(source)].some(text => has(text, needle));
}

/** Four untracked collection/consultation sources at most, using the catalogue ranking. */
export function suggestedSources<T extends CatalogSource>(sources: readonly T[], preferences: SearchPreferences, followedNames: readonly string[]): T[] {
  const followed = new Set(followedNames);
  return rankSources(sources.filter(source => sourceKind(source.mode) !== "outreach" && !followed.has(source.name)), preferences).slice(0, 4);
}
