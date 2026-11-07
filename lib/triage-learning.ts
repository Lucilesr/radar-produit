import type { CandidateProfile, JobRecord, SearchPreferences } from "./types";

type Contract = SearchPreferences["contracts"][number];
export type TriageSuggestion = { key: string; kind: "presence" | "contract" | "title" | "source"; value: string; contract?: Contract; count: number; label: string };
const fold = (s: string) => s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const day = 86400000;

/** Observed shared facts, never a claim to know why someone discarded an offer. */
export function triageSuggestions(jobs: readonly JobRecord[], search: SearchPreferences, dismissals: CandidateProfile["triageDismissals"] = {}, now = Date.now()) {
  const savedDismissals = normalizeTriageDismissals(dismissals, now);
  const groups = new Map<string, TriageSuggestion & { ids: Set<string> }>();
  const add = (kind: TriageSuggestion["kind"], value: string, label: string, job: JobRecord, contract?: Contract) => {
    if (!value || value.length > 80) return;
    const key = `${kind}:${contract ?? ""}:${fold(value)}`;
    const dismissed = Date.parse(savedDismissals[key] ?? "");
    if (Number.isFinite(dismissed) && now - dismissed < 30 * day) return;
    const group = groups.get(key) ?? { key, kind, value, label, contract, count: 0, ids: new Set<string>() };
    group.ids.add(job.id); groups.set(key, group);
  };
  for (const job of jobs) {
    const age = now - Date.parse(job.deletedAt ?? "");
    if (!Number.isFinite(age) || age < 0 || age > 7 * day) continue;
    // A filled vacancy is not evidence that the person's criteria should change.
    if (job.dismissalReason === "filled" || job.dismissalReason === "applications_closed") continue;
    const contract = search.contracts.find(c => c === job.contractType);
    const accepted = contract ? search.remoteByContract?.[contract] ?? search.remote : search.remote;
    if (contract && job.remoteMode === "hybrid" && job.onsiteDaysPerWeek != null && job.onsiteDaysPerWeek >= 2 && (accepted === "hybrid" || accepted === "onsite"))
      add("presence", String(job.onsiteDaysPerWeek), `en hybride ${job.onsiteDaysPerWeek} jours par semaine`, job, contract);
    if (contract && search.contracts.length > 1) add("contract", contract, `en ${contract === "cdi" ? "CDI" : contract === "cdd" ? "CDD" : contract === "freelance" ? "freelance" : contract === "portage" ? "portage salarial" : "temps partagé"}`, job, contract);
    if (job.title.trim().length<=40&&(search.excludeKeywords?.length??0)<12&&!(search.excludeKeywords ?? []).some(term => fold(term) === fold(job.title))) add("title", job.title.trim(), `intitulées « ${job.title.trim()} »`, job);
    if ((search.excludeSources?.length??0)<30&&!(search.excludeSources ?? []).some(source => fold(source) === fold(job.source))) add("source", job.source.trim(), `issues de ${job.source.trim()}`, job);
  }
  const priority = { presence: 0, contract: 1, title: 2, source: 3 };
  return [...groups.values()].filter(group => group.ids.size >= 4).map(({ ids, ...group }) => ({ ...group, count: ids.size }))
    .sort((a, b) => priority[a.kind] - priority[b.kind] || b.count - a.count || a.key.localeCompare(b.key));
}

export function suggestionPreferences(suggestion: TriageSuggestion, current: SearchPreferences): SearchPreferences {
  if (suggestion.kind === "presence" && suggestion.contract) return { ...current, remoteByContract: { ...current.remoteByContract, [suggestion.contract]: "exceptional" } };
  if (suggestion.kind === "contract") return { ...current, contracts: current.contracts.filter(c => c !== suggestion.value) };
  if (suggestion.kind === "title") return { ...current, excludeKeywords: [...new Set([...(current.excludeKeywords ?? []), suggestion.value])] };
  return { ...current, excludeSources: [...new Set([...(current.excludeSources ?? []), suggestion.value])] };
}

export function normalizeTriageDismissals(value: unknown, now = Date.now()): Record<string,string> {
  if(!value||typeof value!=="object"||Array.isArray(value))return {};
  const values = Object.entries(value).filter((entry):entry is [string,string]=>{const [name,at]=entry;return /^(presence|contract|title|source):/.test(name)&&name.length<=120&&typeof at==="string"&&Number.isFinite(Date.parse(at))&&now-Date.parse(at)>=0&&now-Date.parse(at)<30*day;});
  return Object.fromEntries(values.sort((a, b) => b[1].localeCompare(a[1])).slice(0, 60));
}

export function rememberTriageDismissal(current: CandidateProfile["triageDismissals"], key: string, now = Date.now()) {
  const values: [string,string][] = [[key,new Date(now).toISOString()],...Object.entries(normalizeTriageDismissals(current,now)).filter(([name])=>name!==key)];
  return normalizeTriageDismissals(Object.fromEntries(values),now);
}

export function triageShortcut(key: string, context: { open: boolean; editing: boolean; disabled?: boolean; modifier?: boolean; repeat?: boolean }) {
  if (!context.open || context.editing || context.disabled || context.modifier || context.repeat) return null;
  return ({ s: "selected", l: "later", x: "discard" } as const)[key.toLowerCase() as "s" | "l" | "x"] ?? null;
}
