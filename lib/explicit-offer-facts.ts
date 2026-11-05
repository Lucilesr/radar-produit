import type { JobInput } from "./types";

// Only facts attached to an offer condition are safe to apply without review.
// Search filters, locations and figures in the employer presentation are not offer facts.
export function explicitOfferFacts(description: string): Partial<JobInput> {
  const facts: Partial<JobInput> = {};
  const lines = description.slice(0, 12000).split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  for (const line of lines) {
    if (facts.annualSalary == null && /\b(?:salaire|r[ée]mun[ée]ration|salary|compensation)\b/i.test(line) &&
        /\b(?:annuel|annuelle|brut\/an|par an|per year|annual)\b/i.test(line) &&
        !/\b(?:salaire|r[ée]mun[ée]ration|salary|compensation)\b[^.;]{0,35}\b(?:non communiqu[ée]|selon profil|[àa] confirmer|not disclosed)\b/i.test(line)) {
      const amount = line.match(/(?<!\d)(\d{2,3})\s*k\s*(?:€|EUR\b|euros?)|(?<!\d)(\d{2,3}(?:[\s\u00a0]\d{3})+|\d{5,6})\s*(?:€|EUR\b|euros?)/i);
      if (amount && !/\b(?:USD|GBP|dollars?|pounds?)\b|\b\d{2,6}\s*[–—-]\s*\d{2,6}/i.test(line)) facts.annualSalary = amount[1] ? Number(amount[1]) * 1000 : Number(amount[2].replace(/\s/g, ""));
    }
    if (facts.dailyRate == null && /\b(?:TJM|tarif journalier|daily rate)\b/i.test(line) && !/\b(?:mensuel|monthly|par mois)\b/i.test(line) &&
        !/\b(?:TJM|tarif journalier|daily rate)\b[^.;]{0,35}\b(?:non communiqu[ée]|selon profil|[àa] confirmer|not disclosed)\b/i.test(line)) {
      const amount = line.match(/(?<!\d)(\d{3,4})\s*(?:€|EUR\b|euros?)\s*(?:\/?\s*(?:jour|day))?|(?:€|EUR\b)\s*(\d{3,4})\s*\/\s*(?:jour|day)/i);
      if (amount && !/[–—-]\s*\d{3,4}\s*(?:€|EUR\b|euros?)/i.test(line)) facts.dailyRate = Number(amount[1] ?? amount[2]);
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
