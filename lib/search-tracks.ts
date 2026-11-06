import type { SearchPreferences, SearchTrack } from "./types";

/** Terms are compared without case, accents or ligatures: « Cœur » and « coeur » are the same. */
export const foldTerm = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("fr").replace(/œ/g, "oe").replace(/æ/g, "ae");

export const trackKindLabels: Record<SearchTrack["kind"], string> = { core: "Principale", broad: "Élargie", alternative: "Alternative" };
export const trackKinds = ["core", "broad", "alternative"] as const;
export const maxTracks = 8;
export const maxTermsPerTrack = 12;

/**
 * The three tracks Radar searched for every account before tracks became per-account.
 * An account that still searched these roles keeps them, so no saved term is lost.
 */
export const legacySearchTracks: SearchTrack[] = [
  { id: "core", label: "Cœur de cible", kind: "core", terms: ["Product Owner", "Product Manager"] },
  { id: "broad", label: "Filet large", kind: "broad", terms: ["chef de produit digital", "chef de projet produit", "Proxy Product Owner", "Digital Product Owner"] },
  { id: "alternative", label: "Alternatives pertinentes", kind: "alternative", terms: ["Product Builder", "Product Ops", "Product Lead", "AI Product Manager"] },
];
const legacyRoles = ["product owner", "product manager"];

/** Tracks saved on the account, cleaned up; `undefined` when none hold up. */
export function normalizeSearchTracks(value: unknown): SearchTrack[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const tracks = value.flatMap(entry => {
    if (!entry || typeof entry !== "object") return [];
    const raw = entry as Partial<SearchTrack>;
    const terms = Array.isArray(raw.terms) ? raw.terms : [];
    const seen = new Set<string>();
    // The first spelling wins, so « Product Owner » is not replaced by « product owner ».
    const cleaned = terms
      .filter((term): term is string => typeof term === "string")
      .map(term => term.trim().replace(/\s+/g, " "))
      .filter(term => term.length >= 2 && term.length <= 80 && /[\p{L}\p{N}]/u.test(term))
      .filter(term => !seen.has(foldTerm(term)) && seen.add(foldTerm(term)) !== undefined)
      .slice(0, maxTermsPerTrack);
    if (!cleaned.length) return [];
    const label = typeof raw.label === "string" ? raw.label.trim().replace(/\s+/g, " ").slice(0, 60) : "";
    const id = typeof raw.id === "string" && /^[a-z0-9-]{1,40}$/.test(raw.id) ? raw.id : foldTerm(label || cleaned[0]).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "piste";
    const kind = (trackKinds as readonly string[]).includes(raw.kind as string) ? raw.kind as SearchTrack["kind"] : "core";
    return [{ id, label: label || cleaned[0], kind, terms: cleaned }];
  });
  const unique = [...new Map(tracks.map(track => [track.id, track])).values()].slice(0, maxTracks);
  return unique.length ? unique : undefined;
}

/** Legacy tracks only for an account that searched exactly the old default roles. */
export function inheritedSearchTracks(roles: string[]): SearchTrack[] | undefined {
  const folded = roles.map(foldTerm);
  const sameAsLegacy = folded.length === legacyRoles.length && legacyRoles.every(role => folded.includes(role));
  return sameAsLegacy ? legacySearchTracks.map(track => ({ ...track, terms: [...track.terms] })) : undefined;
}

/** The account's tracks, or a single core track built from its own roles. */
export function searchTracksFor(preferences: Pick<SearchPreferences, "roles"> & { searchTracks?: SearchTrack[] }): SearchTrack[] {
  if (preferences.searchTracks?.length) return preferences.searchTracks;
  if (!preferences.roles.length) return [];
  return [{ id: "core", label: "Cœur de cible", kind: "core", terms: preferences.roles.slice(0, maxTermsPerTrack) }];
}

/** Every term the account searches, folded: its roles plus the terms of every track. */
export function searchedTerms(preferences: Pick<SearchPreferences, "roles"> & { searchTracks?: SearchTrack[] }): Set<string> {
  return new Set([...preferences.roles, ...searchTracksFor(preferences).flatMap(track => track.terms)].map(foldTerm));
}

/** `"Product Owner" OR "Product Manager"` — what the track looks for on a job board. */
export const trackQuery = (track: SearchTrack) => track.terms.map(term => `"${term.replace(/["\\\r\n]+/g, " ").trim()}"`).join(" OR ");
