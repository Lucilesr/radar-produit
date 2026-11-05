import { remoteForContract } from "./search-preferences";
import type { SearchPreferences } from "./types";

/** Where a criterion is edited: a group of the criteria form, or the Jobgether card. */
export type CriteriaTarget = "roles" | "conditions" | "locations" | "pay" | "keywords" | "jobgether";
export type CriteriaTone = "include" | "exclude";

export type CriteriaRow = {
  id: "roles" | "contracts" | "remote" | "salary" | "dailyRate" | "payTolerance" | "matchScore" | "includedLocations" | "excludedLocations" | "boostKeywords" | "excludeKeywords";
  label: string;
  /** Set when several rows share an id, as with one presence row per contract. */
  key?: string;
  values: string[];
  tone: CriteriaTone;
  target: CriteriaTarget;
};
export type CriteriaGroup = { id: "role" | "presence" | "pay" | "geography" | "announcement"; title: string; rows: CriteriaRow[] };
export type CriteriaToken = { id: CriteriaRow["id"]; key: string; label: string; value: string; fullValue: string; tone: CriteriaTone; target: CriteriaTarget };

export const contractLabels: Record<SearchPreferences["contracts"][number], string> = { cdi: "CDI", cdd: "CDD", freelance: "Freelance", portage: "Portage salarial", part_time: "Temps partagé" };
export const remoteLabels: Record<SearchPreferences["remote"], string> = {
  full_remote: "Full remote",
  exceptional: "Présence exceptionnelle",
  hybrid: "Hybride",
  onsite: "Présentiel",
};
const euro = (amount: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(amount) + " €";

/** One row when every contract accepts the same presence, one row per contract otherwise. */
function presenceRows(preferences: SearchPreferences): CriteriaRow[] {
  const byContract = preferences.contracts.map(contract => [contract, remoteForContract(preferences, contract)] as const);
  const levels = new Set(byContract.map(([, level]) => level));
  if (levels.size <= 1) return [{ id: "remote", label: "Présence acceptable", values: [remoteLabels[byContract[0]?.[1] ?? preferences.remote]], tone: "include", target: "conditions" }];
  return byContract.map(([contract, level]) => ({ id: "remote" as const, key: contract, label: `Présence · ${contractLabels[contract]}`, values: [remoteLabels[level]], tone: "include" as const, target: "conditions" as const }));
}

/** Rows of the expanded view, grouped by theme. Pay rows only appear for the contracts searched. */
export function criteriaGroups(preferences: SearchPreferences): CriteriaGroup[] {
  const contracts = preferences.contracts;
  const salaried = contracts.includes("cdi") || contracts.includes("cdd");
  const included = preferences.includedLocations ?? [];
  const excluded = preferences.excludedLocations ?? [];
  const pay: CriteriaRow[] = [];
  if (salaried) pay.push({ id: "salary", label: "Salaire minimum", values: [`${euro(preferences.minimumSalary)} brut/an`], tone: "include", target: "pay" });
  if (contracts.includes("freelance") || contracts.includes("portage")) pay.push({ id: "dailyRate", label: "TJM minimum", values: [`${euro(preferences.minimumDailyRate)} HT/jour`], tone: "include", target: "pay" });
  if ((preferences.payTolerancePercent ?? 0) > 0 && (salaried || contracts.includes("freelance"))) pay.push({ id: "payTolerance", label: "Tolérance sous le minimum", values: [`${preferences.payTolerancePercent} %`], tone: "include", target: "pay" });
  pay.push({ id: "matchScore", label: "Score Jobgether minimum", values: [`${preferences.minimumMatchScore} / 100`], tone: "include", target: "jobgether" });
  const boost = preferences.boostKeywords ?? [];
  const avoid = preferences.excludeKeywords ?? [];
  const announcement: CriteriaRow[] = [
    ...(boost.length ? [{ id: "boostKeywords" as const, label: "Mettre en avant", values: boost, tone: "include" as const, target: "keywords" as const }] : []),
    ...(avoid.length ? [{ id: "excludeKeywords" as const, label: "Écarter si l’annonce contient", values: avoid, tone: "exclude" as const, target: "keywords" as const }] : []),
  ];
  const geography: CriteriaRow[] = [{ id: "includedLocations", label: "Lieux inclus", values: included.length ? included : ["Tous les lieux"], tone: "include", target: "locations" }];
  if (excluded.length) geography.push({ id: "excludedLocations", label: "Sauf", values: excluded, tone: "exclude", target: "locations" });
  return [
    { id: "role", title: "Le poste", rows: [
      { id: "roles", label: "Postes visés", values: preferences.roles, tone: "include", target: "roles" },
      { id: "contracts", label: "Contrats", values: contracts.map(contract => contractLabels[contract]), tone: "include", target: "conditions" },
    ] },
    { id: "presence", title: "La présence", rows: presenceRows(preferences) },
    { id: "pay", title: "La rémunération", rows: pay },
    { id: "geography", title: "La géographie", rows: geography },
    ...(announcement.length ? [{ id: "announcement" as const, title: "L’annonce", rows: announcement }] : []),
  ];
}

const shortLabels: Partial<Record<CriteriaRow["id"], string>> = {
  roles: "Poste", contracts: "Contrat", remote: "Présence", salary: "Salaire", dailyRate: "TJM",
  matchScore: "Score Jobgether", includedLocations: "Lieux", payTolerance: "Tolérance", boostKeywords: "Mots-clés", excludeKeywords: "Sans",
};

/** One compact tag per criterion for the collapsed bar. Long lists keep three values, then « +n ». */
export function criteriaTokens(preferences: SearchPreferences, visible = 3): CriteriaToken[] {
  const rows = criteriaGroups(preferences).flatMap(group => group.rows);
  // The bar keeps one presence tag even when each contract has its own level, so it stays stable.
  const presence = rows.filter(row => row.id === "remote");
  const merged: CriteriaRow[] = presence.length > 1
    ? [{ id: "remote", label: "Présence acceptable", values: [presence.map(row => `${row.label.replace("Présence · ", "")} : ${row.values[0]}`).join(", ")], tone: "include", target: "conditions" }]
    : presence;
  return rows.flatMap(row => row.id === "remote" ? (row === presence[0] ? merged : []) : [row]).map(row => {
    const shown = row.values.slice(0, visible).join(", ");
    const hidden = row.values.length - visible;
    const prefix = row.id === "salary" || row.id === "dailyRate" || row.id === "matchScore" ? "≥ " : row.id === "payTolerance" ? "−" : "";
    return {
      id: row.id,
      key: row.key ?? row.id,
      label: row.key ? row.label : shortLabels[row.id] ?? row.label,
      value: prefix + shown + (hidden > 0 ? ` +${hidden}` : ""),
      fullValue: prefix + row.values.join(", "),
      tone: row.tone,
      target: row.target,
    };
  });
}
