import { foldTerm, searchedTerms } from "./search-tracks";
import { allRolesLabel } from "./web-discovery";
import type { SearchPreferences } from "./types";

export type Drift = { kind: "term" | "contract" | "location"; value: string; searchId: string };
export type SavedSearch = { id: string; terms: string[]; contracts?: string[]; locations?: string[] };

/** Short forms accepted as the full title, as the roles field already accepts them. */
const aliases: Record<string, string> = { po: "product owner", pm: "product manager" };
const expand = (term: string) => { const folded = foldTerm(term); return aliases[folded] ?? folded; };

/**
 * What a saved search looks for and the account no longer asks for. Terms only for now:
 * contracts and locations arrive when a saved search carries those filters.
 */
export function searchDrift(search: SavedSearch, preferences: SearchPreferences): Drift[] {
  const searched = new Set([...searchedTerms(preferences)].map(term => aliases[term] ?? term));
  return search.terms
    .filter(term => term.trim().length > 0 && !searched.has(expand(term)))
    .map(term => ({ kind: "term" as const, value: term.trim(), searchId: search.id }));
}

/** Searches saved on a source: one per role for which links were kept, grouped search aside. */
export function sourceSavedSearches(setting: { searchLinks?: Record<string, { Google?: string; Site?: string }> } | undefined): SavedSearch[] {
  return Object.entries(setting?.searchLinks ?? {})
    .filter(([role, links]) => role !== allRolesLabel && links && (links.Site || links.Google))
    .map(([role]) => ({ id: role, terms: [role] }));
}

/** Every drift of one source, so the list can flag it as needing attention. */
export function sourceDrift(setting: Parameters<typeof sourceSavedSearches>[0], preferences: SearchPreferences): Drift[] {
  return sourceSavedSearches(setting).flatMap(search => searchDrift(search, preferences));
}
