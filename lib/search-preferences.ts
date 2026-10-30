import type { SearchPreferences } from "./types";

export const defaultSearchPreferences: SearchPreferences = {
  roles: ["po", "pm"],
  contracts: ["cdi", "freelance"],
  remote: "light_hybrid",
  minimumSalary: 55000,
  minimumDailyRate: 500,
};

export function searchPreferences(value: unknown): SearchPreferences {
  if (!value || typeof value !== "object") return defaultSearchPreferences;
  const raw = value as Partial<SearchPreferences>;
  const roles = Array.isArray(raw.roles) ? raw.roles.filter((role): role is "po" | "pm" => role === "po" || role === "pm") : defaultSearchPreferences.roles;
  const contracts = Array.isArray(raw.contracts) ? raw.contracts.filter((contract): contract is "cdi" | "freelance" => contract === "cdi" || contract === "freelance") : defaultSearchPreferences.contracts;
  const amount = (number: unknown, fallback: number) => typeof number === "number" && Number.isInteger(number) && number >= 0 && number <= 1000000 ? number : fallback;
  return {
    roles: roles.length ? [...new Set(roles)] : defaultSearchPreferences.roles,
    contracts: contracts.length ? [...new Set(contracts)] : defaultSearchPreferences.contracts,
    remote: raw.remote === "full_remote" || raw.remote === "occasional" || raw.remote === "light_hybrid" ? raw.remote : defaultSearchPreferences.remote,
    minimumSalary: amount(raw.minimumSalary, defaultSearchPreferences.minimumSalary),
    minimumDailyRate: amount(raw.minimumDailyRate, defaultSearchPreferences.minimumDailyRate),
  };
}
