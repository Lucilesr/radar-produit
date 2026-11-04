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
  minimumMatchScore: 55,
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

export function searchPreferences(value: unknown): SearchPreferences {
  if (!value || typeof value !== "object") return defaultSearchPreferences;
  const raw = value as Partial<SearchPreferences>;
  const roles = normalizeRoleTitles(raw.roles);
  const contracts = Array.isArray(raw.contracts) ? raw.contracts.filter((contract): contract is "cdi" | "cdd" | "freelance" => contract === "cdi" || contract === "cdd" || contract === "freelance") : defaultSearchPreferences.contracts;
  const remote = (raw as { remote?: string }).remote;
  const amount = (number: unknown, fallback: number) => typeof number === "number" && Number.isInteger(number) && number >= 0 && number <= 1000000 ? number : fallback;
  return {
    roles,
    includedLocations: normalizeLocationRules(raw.includedLocations),
    excludedLocations: normalizeLocationRules(raw.excludedLocations ?? defaultSearchPreferences.excludedLocations),
    contracts: contracts.length ? [...new Set(contracts)] : defaultSearchPreferences.contracts,
    remote: remote === "light_hybrid" ? "hybrid" : remote === "occasional" ? "exceptional" : remote === "onsite" || remote === "hybrid" || remote === "exceptional" || remote === "full_remote" ? remote : defaultSearchPreferences.remote,
    minimumSalary: amount(raw.minimumSalary, defaultSearchPreferences.minimumSalary),
    minimumDailyRate: amount(raw.minimumDailyRate, defaultSearchPreferences.minimumDailyRate),
    minimumMatchScore: typeof raw.minimumMatchScore === "number" && Number.isInteger(raw.minimumMatchScore) && raw.minimumMatchScore >= 0 && raw.minimumMatchScore <= 100 ? raw.minimumMatchScore : defaultSearchPreferences.minimumMatchScore,
  };
}
