import { remoteForContract } from "./search-preferences";
import { levelLabels } from "./seniority";
import { assessJob } from "./matching";
import { inOpportunityView } from "./opportunity-views";
import { contractLabels, remoteLabels } from "./search-criteria";
import type { JobRecord, SearchPreferences } from "./types";

/**
 * Offers that would sit in « À examiner » with these criteria. The jobs already loaded are
 * re-assessed in the browser, with the same rule as the Offres view; no server call.
 */
export function countToReview(jobs: JobRecord[], preferences: SearchPreferences) {
  return jobs.filter(job => {
    if (job.deletedAt) return false;
    const assessment = assessJob(job, preferences);
    return inOpportunityView({ ...job, matchScore: assessment.score, matchTier: assessment.tier, flags: assessment.flags }, "to_review");
  }).length;
}

const euro = (amount: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(amount) + " €";
const contractLabel = (value: string) => contractLabels[value as keyof typeof contractLabels] ?? value;
function listChange(single: string, before: string[], after: string[], added: string, removed: string) {
  const plus = after.filter(item => !before.includes(item));
  const minus = before.filter(item => !after.includes(item));
  return [
    ...(plus.length ? [`${single} ${added} : ${plus.join(", ")}`] : []),
    ...(minus.length ? [`${single} ${removed} : ${minus.join(", ")}`] : []),
  ];
}

/** Short French descriptions of what changed, for the confirmation shown after a save. */
export function describeCriteriaChanges(before: SearchPreferences, after: SearchPreferences): string[] {
  const changes = [
    ...listChange("Poste", before.roles, after.roles, "ajouté", "retiré"),
    ...listChange("Contrat", before.contracts.map(contractLabel), after.contracts.map(contractLabel), "ajouté", "retiré"),
    ...listChange("Lieu", before.includedLocations ?? [], after.includedLocations ?? [], "inclus", "retiré"),
    ...listChange("Lieu", before.excludedLocations ?? [], after.excludedLocations ?? [], "exclu", "réautorisé"),
  ];
  if (before.remote !== after.remote) changes.push(`Présence ${remoteLabels[before.remote]} → ${remoteLabels[after.remote]}`);
  for(const contract of before.contracts){
    const previous=remoteForContract(before,contract),next=remoteForContract(after,contract);
    if(previous!==next && before.remote===after.remote)changes.push(`Présence ${contractLabel(contract)} ${remoteLabels[previous]} → ${remoteLabels[next]}`);
  }
  if(JSON.stringify(before.searchTracks??[])!==JSON.stringify(after.searchTracks??[]))changes.push("Pistes de recherche mises à jour");
  if ((before.targetLevel ?? null) !== (after.targetLevel ?? null)) changes.push(`Niveau visé ${before.targetLevel ? levelLabels[before.targetLevel] : "non précisé"} → ${after.targetLevel ? levelLabels[after.targetLevel] : "non précisé"}`);
  if (!!before.acceptLevelAbove !== !!after.acceptLevelAbove && before.targetLevel === after.targetLevel) changes.push(after.acceptLevelAbove ? "Niveau supérieur accepté" : "Niveau supérieur signalé");
  if (before.minimumSalary !== after.minimumSalary) changes.push(`Salaire ${euro(before.minimumSalary)} → ${euro(after.minimumSalary)}/an`);
  if (before.minimumDailyRate !== after.minimumDailyRate) changes.push(`TJM ${euro(before.minimumDailyRate)} → ${euro(after.minimumDailyRate)}/jour`);
  changes.push(...listChange("Mot-clé", before.boostKeywords ?? [], after.boostKeywords ?? [], "ajouté", "retiré"));
  changes.push(...listChange("Domaine", before.domainTerms ?? [], after.domainTerms ?? [], "ajouté", "retiré"));
  changes.push(...listChange("Mot-clé", before.excludeKeywords ?? [], after.excludeKeywords ?? [], "écarté", "réautorisé"));
  if ((before.payTolerancePercent ?? 0) !== (after.payTolerancePercent ?? 0)) changes.push(`Tolérance ${before.payTolerancePercent ?? 0} % → ${after.payTolerancePercent ?? 0} %`);
  if (before.minimumMatchScore !== after.minimumMatchScore) changes.push(`Score Jobgether ${before.minimumMatchScore} → ${after.minimumMatchScore}`);
  return changes;
}

/** « TJM 500 € → 450 €/jour. 22 offres à examiner (+8). » */
export function impactMessage(changes: string[], before: number, after: number) {
  const shown = changes.slice(0, 2).join(" · ") + (changes.length > 2 ? ` · +${changes.length - 2}` : "");
  const delta = after - before;
  const count = `${after} offre${after > 1 ? "s" : ""} à examiner${delta ? ` (${delta > 0 ? "+" : ""}${delta})` : ""}`;
  return `${shown}. ${count}.`;
}
