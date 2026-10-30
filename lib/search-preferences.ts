import type { SearchPreferences } from "./types";

export const defaultSearchPreferences: SearchPreferences = {
  roles: ["Product Owner", "Product Manager"],
  contracts: ["cdi", "freelance"],
  remote: "light_hybrid",
  minimumSalary: 55000,
  minimumDailyRate: 500,
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
  const contracts = Array.isArray(raw.contracts) ? raw.contracts.filter((contract): contract is "cdi" | "freelance" => contract === "cdi" || contract === "freelance") : defaultSearchPreferences.contracts;
  const amount = (number: unknown, fallback: number) => typeof number === "number" && Number.isInteger(number) && number >= 0 && number <= 1000000 ? number : fallback;
  return {
    roles,
    contracts: contracts.length ? [...new Set(contracts)] : defaultSearchPreferences.contracts,
    remote: raw.remote === "full_remote" || raw.remote === "occasional" || raw.remote === "light_hybrid" ? raw.remote : defaultSearchPreferences.remote,
    minimumSalary: amount(raw.minimumSalary, defaultSearchPreferences.minimumSalary),
    minimumDailyRate: amount(raw.minimumDailyRate, defaultSearchPreferences.minimumDailyRate),
  };
}
