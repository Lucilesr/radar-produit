import type { SearchPreferences } from "./types";
import { normalizeLocationRules } from "./location-criteria";

export const defaultSearchPreferences: SearchPreferences = {
  roles: ["Product Owner", "Product Manager"],
  includedLocations: [],
  excludedLocations: [],
  contracts: ["cdi", "freelance"],
  remote: "hybrid",
  minimumSalary: 55000,
  minimumDailyRate: 500,
  boostKeywords: [],
  excludeKeywords: [],
  minimumMatchScore: 55,
  payTolerancePercent: 0,
};

export function normalizeRoleTitles(value: unknown): string[] {
  if (!Array.isArray(value)) return defaultSearchPreferences.roles;
  const roles = value.filter((role): role is string => typeof role === "string")
    .map(role => role.trim().replace(/\s+/g, " "))
    .map(role => role.toLowerCase() === "po" || role.toLowerCase() === "product owner" ? "Product Owner" : role.toLowerCase() === "pm" || role.toLowerCase() === "product manager" ? "Product Manager" : role)
    .filter(role => role.length >= 2 && role.length <= 80 && /[\p{L}\p{N}]/u.test(role));
  const unique = [...new Map(roles.map(role => [role.toLocaleLowerCase("fr"), role])).values()];
  return unique.length ? unique.slice(0, 12) : defaultSearchPreferences.roles;
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
export const foldKeyword = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr");

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
    excludeKeywords: normalizeKeywords(raw.excludeKeywords),
    minimumSalary: amount(raw.minimumSalary, defaultSearchPreferences.minimumSalary),
    minimumDailyRate: amount(raw.minimumDailyRate, defaultSearchPreferences.minimumDailyRate),
    payTolerancePercent: typeof raw.payTolerancePercent === "number" && Number.isInteger(raw.payTolerancePercent) && raw.payTolerancePercent >= 0 && raw.payTolerancePercent <= 20 ? raw.payTolerancePercent : 0,
    minimumMatchScore: typeof raw.minimumMatchScore === "number" && Number.isInteger(raw.minimumMatchScore) && raw.minimumMatchScore >= 0 && raw.minimumMatchScore <= 100 ? raw.minimumMatchScore : defaultSearchPreferences.minimumMatchScore,
  };
}
