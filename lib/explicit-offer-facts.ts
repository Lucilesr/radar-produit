import type { JobInput } from "./types";
import { parsePayRange, payMidpoint } from "./pay-range";

// Only facts attached to an offer condition are safe to apply without review.
// Search filters, locations and figures in the employer presentation are not offer facts.
export function explicitOfferFacts(description: string): Partial<JobInput> {
  const facts: Partial<JobInput> = {};
  const lines = description.slice(0, 12000).split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  for (const line of lines) {
    if (facts.annualSalary == null && /\b(?:salaire|r[ée]mun[ée]ration|salary|compensation)\b/i.test(line) &&
        /\b(?:annuel|annuelle|brut\/an|par an|per year|annual)\b/i.test(line) &&
        !/\b(?:salaire|r[ée]mun[ée]ration|salary|compensation)\b[^.;]{0,35}\b(?:non communiqu[ée]|selon profil|[àa] confirmer|not disclosed)\b/i.test(line)) {
      const pay = parsePayRange(line, "annual");
      if (pay) Object.assign(facts, { annualSalary: payMidpoint(pay), salaryMin: pay.min, salaryMax: pay.max });
    }
    if (facts.dailyRate == null && /\b(?:TJM|tarif journalier|daily rate)\b/i.test(line) && !/\b(?:mensuel|monthly|par mois)\b/i.test(line) &&
        !/\b(?:TJM|tarif journalier|daily rate)\b[^.;]{0,35}\b(?:non communiqu[ée]|selon profil|[àa] confirmer|not disclosed)\b/i.test(line)) {
      const pay = parsePayRange(line, "daily");
      if (pay) Object.assign(facts, { dailyRate: payMidpoint(pay), dailyRateMin: pay.min, dailyRateMax: pay.max });
    }
    if (facts.contractType == null && /^(?:contrat|type de contrat|mission)\s*[:\-]/i.test(line)) {
      const types = ["cdi", "cdd", "freelance", "portage"].filter(type => new RegExp(`\\b${type}\\b`, "i").test(line));
      if (types.length === 1) facts.contractType = types[0] as JobInput["contractType"];
    }
    if (facts.language == null && !/\b(?:cours|formation|lessons?|facultatif|non requis|non exig[ée]|not required)\b/i.test(line)) {
      if (/\b(?:anglais|english)\b[^.;]{0,35}\b(?:courant|couramment|fluent|bilingue|C1|C2|advanced)\b|\b(?:courant|couramment|fluent|bilingue|C1|C2|advanced)\b[^.;]{0,35}\b(?:anglais|english)\b/i.test(line)) facts.language = "advanced_en";
      else if (/\b(?:anglais|english)\b[^.;]{0,35}\b(?:professionnel|professional|B2|requis|required|exig[ée])\b/i.test(line)) facts.language = "professional_en";
    }
    if (facts.remoteMode == null && !/\b(?:non pr[ée]cis[ée]|[àa] confirmer|pas de|not confirmed)\b/i.test(line)) {
      if (/\b(?:100\s*%\s*(?:remote|t[ée]l[ée]travail)|full[ -]?remote|t[ée]l[ée]travail [àa] temps complet)\b/i.test(line)) facts.remoteMode = "full_remote";
      else if (/\b(?:hybride|hybrid|t[ée]l[ée]travail\s*:\s*\d{1,2}\s*%\s*remote)\b/i.test(line)) facts.remoteMode = "hybrid";
      else if (/\b(?:100\s*%\s*pr[ée]sentiel|sur site uniquement|aucun t[ée]l[ée]travail)\b/i.test(line)) facts.remoteMode = "onsite";
    }
  }
  return facts;
}
