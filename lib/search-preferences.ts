import type { SearchPreferences } from "./types";
import { normalizeLocationRules } from "./location-criteria";
import { foldTerm, inheritedSearchTracks, normalizeSearchTracks } from "./search-tracks";

/**
 * Neutral starting point of an account that has not chosen its criteria yet:
 * no role, every contract, any presence, no pay minimum. Radar asks for the role
 * during onboarding; a saved profile always keeps its own values.
 */
export const defaultSearchPreferences: SearchPreferences = {
  roles: [],
  dismissedRoleSuggestions: [],
  includedLocations: [],
  excludedLocations: [],
  contracts: ["cdi", "cdd", "freelance", "portage", "part_time"],
  remote: "onsite",
  minimumSalary: 0,
  minimumDailyRate: 0,
  boostKeywords: [],
  domainTerms: [],
  excludeKeywords: [],
  minimumMatchScore: 55,
  payTolerancePercent: 0,
};

export function normalizeRoleTitles(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const roles = value.filter((role): role is string => typeof role === "string")
    .map(role => role.trim().replace(/\s+/g, " "))
    .map(role => role.toLowerCase() === "po" || role.toLowerCase() === "product owner" ? "Product Owner" : role.toLowerCase() === "pm" || role.toLowerCase() === "product manager" ? "Product Manager" : role)
    .filter(role => role.length >= 2 && role.length <= 80 && /[\p{L}\p{N}]/u.test(role));
  const unique = [...new Map(roles.map(role => [role.toLocaleLowerCase("fr"), role])).values()];
  return unique.slice(0, 12);
}

/** True once the account has chosen at least one role: offers can then be ranked. */
export function hasSearchedRole(preferences: Pick<SearchPreferences, "roles">) {
  return preferences.roles.length > 0;
}

/** Lowest pay kept with a tolerance, rounded to the euro: 55 000 at 5 % gives 52 250. */
export function payFloor(minimum: number, tolerancePercent = 0) {
  return Math.round(minimum * (100 - tolerancePercent) / 100);
}

/** From the strictest to the most permissive: a kept offer must fit the accepted presence. */
const remoteOrder = ["full_remote", "exceptional", "hybrid", "onsite"] as const;
type Remote = SearchPreferences["remote"];
const remoteValue = (value: unknown): Remote | undefined =>
  value === "light_hybrid" ? "hybrid" : value === "occasional" ? "exceptional"
    : (remoteOrder as readonly string[]).includes(value as string) ? value as Remote : undefined;

/** Presence accepted for one offer; an unknown contract follows the most permissive one searched. */
export function remoteForContract(search: SearchPreferences, contract?: string): Remote {
  const forContract = (name: string) => search.remoteByContract?.[name as keyof NonNullable<SearchPreferences["remoteByContract"]>] ?? search.remote;
  if (contract && contract !== "other" && search.contracts.includes(contract as SearchPreferences["contracts"][number])) return forContract(contract);
  const searched = search.contracts.map(forContract);
  return remoteOrder.filter(level => searched.includes(level)).at(-1) ?? search.remote;
}

/** Keywords are compared without case or accents; 12 at most, 2 to 40 characters each. */
export function normalizeKeywords(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const words = value.filter((word): word is string => typeof word === "string")
    .map(word => word.trim().replace(/\s+/g, " "))
    .filter(word => word.length >= 2 && word.length <= 40);
  return [...new Map(words.map(word => [foldKeyword(word), word])).values()].slice(0, 12);
}
export const foldKeyword = foldTerm;
export const maxDomainTerms=40;
export function normalizeDomainTerms(value:unknown):string[]{
  if(!Array.isArray(value))return [];
  const words=value.filter((word):word is string=>typeof word==="string").map(word=>word.trim().replace(/\s+/g," ")).filter(word=>word.length>=2&&word.length<=40&&/[\p{L}\p{N}]/u.test(word));
  return [...new Map(words.map(word=>[foldKeyword(word),word])).values()].slice(0,maxDomainTerms);
}
/** A manual keyword and a domain term never earn the same points twice. */
export function domainKeywords(search:Pick<SearchPreferences,"boostKeywords"|"domainTerms">){return [...new Map([...normalizeKeywords(search.boostKeywords),...normalizeDomainTerms(search.domainTerms)].map(term=>[foldKeyword(term),term])).values()];}

export const maxDismissedRoleSuggestions = 30;

/** Keep the account's dismissals without losing an older choice on another criteria save. */
export function normalizeDismissedRoleSuggestions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const titles = value.filter((title): title is string => typeof title === "string")
    .map(title => title.trim().replace(/\s+/g, " "))
    .filter(title => title.length >= 2 && title.length <= 80 && /\p{L}/u.test(title));
  const seen = new Set<string>();
  return titles.filter(title => !seen.has(foldTerm(title)) && seen.add(foldTerm(title)) !== undefined).slice(0, maxDismissedRoleSuggestions);
}

export function searchPreferences(value: unknown): SearchPreferences {
  if (!value || typeof value !== "object") return defaultSearchPreferences;
  const raw = value as Partial<SearchPreferences>;
  const roles = normalizeRoleTitles(raw.roles);
  const known = ["cdi", "cdd", "freelance", "portage", "part_time"] as const;
  const contracts = Array.isArray(raw.contracts) ? raw.contracts.filter((contract): contract is typeof known[number] => (known as readonly string[]).includes(contract as string)) : defaultSearchPreferences.contracts;
  const remote = (raw as { remote?: string }).remote;
  const amount = (number: unknown, fallback: number) => typeof number === "number" && Number.isInteger(number) && number >= 0 && number <= 1000000 ? number : fallback;
  return {
    roles,
    searchTracks: normalizeSearchTracks(raw.searchTracks) ?? inheritedSearchTracks(roles),
    dismissedRoleSuggestions: normalizeDismissedRoleSuggestions(raw.dismissedRoleSuggestions),
    includedLocations: normalizeLocationRules(raw.includedLocations),
    excludedLocations: normalizeLocationRules(raw.excludedLocations ?? defaultSearchPreferences.excludedLocations),
    contracts: contracts.length ? [...new Set(contracts)] : defaultSearchPreferences.contracts,
    remote: remote === "light_hybrid" ? "hybrid" : remote === "occasional" ? "exceptional" : remote === "onsite" || remote === "hybrid" || remote === "exceptional" || remote === "full_remote" ? remote : defaultSearchPreferences.remote,
    remoteByContract: raw.remoteByContract && typeof raw.remoteByContract === "object"
      ? Object.fromEntries(Object.entries(raw.remoteByContract).flatMap(([contract, value]) => {
        const level = remoteValue(value);
        return level && contracts.includes(contract as typeof known[number]) ? [[contract, level] as const] : [];
      }))
      : undefined,
    boostKeywords: normalizeKeywords(raw.boostKeywords),
    domainTerms: normalizeDomainTerms(raw.domainTerms),
    excludeKeywords: normalizeKeywords(raw.excludeKeywords),
    excludeSources: Array.isArray(raw.excludeSources) ? [...new Map(raw.excludeSources.filter((name):name is string=>typeof name==="string").map(name=>name.trim()).filter(name=>name.length>=2&&name.length<=80).map(name=>[foldKeyword(name),name])).values()].slice(0,30) : [],
    minimumSalary: amount(raw.minimumSalary, defaultSearchPreferences.minimumSalary),
    minimumDailyRate: amount(raw.minimumDailyRate, defaultSearchPreferences.minimumDailyRate),
    payTolerancePercent: typeof raw.payTolerancePercent === "number" && Number.isInteger(raw.payTolerancePercent) && raw.payTolerancePercent >= 0 && raw.payTolerancePercent <= 20 ? raw.payTolerancePercent : 0,
    targetLevel: ["junior", "confirmed", "senior", "lead", "head"].includes(raw.targetLevel as string) ? raw.targetLevel : undefined,
    targetLevelAny: raw.targetLevelAny === true && !["junior","confirmed","senior","lead","head"].includes(raw.targetLevel as string) ? true : undefined,
    acceptLevelAbove: raw.acceptLevelAbove === true ? true : undefined,
    minimumMatchScore: typeof raw.minimumMatchScore === "number" && Number.isInteger(raw.minimumMatchScore) && raw.minimumMatchScore >= 0 && raw.minimumMatchScore <= 100 ? raw.minimumMatchScore : defaultSearchPreferences.minimumMatchScore,
  };
}
