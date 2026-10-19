import { reviewDue, terminalStatuses } from "./application-workflow";
import type { JobRecord } from "./types";
import { hasApplication, inOpportunityView, reviewState } from "./opportunity-views";

export type TriageAction = {
  job: JobRecord;
  kind: "interview_review" | "interview_date" | "application" | "offer_check";
  title: string;
  detail: string;
};

function offerRank(job: JobRecord, now: number) {
  const published = job.publishedAt ? Date.parse(job.publishedAt) : Number.NaN;
  const age = Number.isFinite(published) ? (now - published) / 86400000 : Number.POSITIVE_INFINITY;
  const freshness = age < 0 ? 0 : age <= 7 ? 24 : age <= 21 ? 12 : age <= 45 ? 3 : 0;
  const detail = job.contentCoverage === "full" ? 6 : job.contentCoverage === "summary" ? 3 : 0;
  const eligibility = job.flags.some(flag => /pays de travail autorisés|anglais avancé|bilingue/i.test(flag)) ? -12 : 0;
  return job.matchScore + freshness + detail + eligibility;
}

function firstQuestion(job: JobRecord) {
  if (job.flags.some(flag => /TJM non communiqué|Salaire non communiqué|rémunération à confirmer/i.test(flag))) return "Vérifier le salaire ou le TJM annoncé.";
  if (job.flags.some(flag => /pays de travail autorisés/i.test(flag))) return "Confirmer les pays depuis lesquels ce poste est ouvert.";
  if (job.flags.some(flag => /anglais avancé|bilingue/i.test(flag))) return "Vérifier le niveau d’anglais réellement exigé.";
  if (job.flags.some(flag => /remote|présence/i.test(flag))) return "Clarifier la fréquence de présence sur site.";
  return "Lire la fiche et décider si elle mérite une shortlist.";
}

export function sortOffersForTriage(jobs: JobRecord[], now = Date.now()) {
  return jobs.filter(job => inOpportunityView(job, "to_review"))
    .sort((a, b) => offerRank(b, now) - offerRank(a, now));
}

export function selectTriageActions(jobs: JobRecord[], now = Date.now(), limit = 3): TriageAction[] {
  const active = jobs.filter(job => !terminalStatuses.includes(job.status) && (!job.deletedAt || hasApplication(job)));
  const due = active.filter(job => job.interviews?.some(event => reviewDue(event, now)))
    .map(job => ({ job, kind: "interview_review" as const, title: "Faire le bilan de l’entretien", detail: `${job.company} · rendez-vous terminé, suite à choisir.` }));
  const undated = active.filter(job => job.status === "interview" && !job.interviews?.some(event => event.state === "planned" || event.state === "reviewed"))
    .map(job => ({ job, kind: "interview_date" as const, title: "Ajouter la date de l’entretien", detail: `${job.company} · la date est nécessaire pour le rappel.` }));
  const candidatures = active.filter(job => (reviewState(job) === "selected" && !job.deletedAt) || ["applied", "awaiting_response", "next_step", "offer"].includes(job.status))
    .map(job => {
      const pending = reviewState(job) === "selected" && !hasApplication(job);
      const name = job.company && job.company !== "Entreprise non précisée" ? job.company : job.title;
      return { job, kind: "application" as const, title: pending ? "Préparer l’offre sélectionnée" : "Faire avancer la candidature", detail: pending ? `${name} · dans Ma sélection, candidature non envoyée.` : `${name} · candidature ${job.status === "applied" ? "envoyée" : "en cours"}.` };
    });
  const offers = sortOffersForTriage(active, now)
    .map(job => ({ job, kind: "offer_check" as const, title: "Qualifier cette offre", detail: `${job.company} · ${firstQuestion(job)}` }));
  const seen = new Set<string>();
  return [...due, ...undated, ...candidatures, ...offers].filter(action => {
    if (seen.has(action.job.id)) return false;
    seen.add(action.job.id); return true;
  }).slice(0, limit);
}
