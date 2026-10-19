import type { Assessment, JobInput, JobStatus } from "./types";
import { detectWorkArrangement } from "./work-arrangement";
import { activeStatuses } from "./application-workflow";
import { isNorthAmericaRestricted } from "./market-scope";

const coreRoles = [/product owner/i, /product manager/i, /\b(?:po|pm)\b/i, /chef de produit (?:digital|numerique|numérique)/i];
const adjacentRoles = [/product builder/i, /product ops/i, /product lead/i];

export function assessJob(job: JobInput & { status?: JobStatus }): Assessment {
  const text = `${job.title} ${job.description ?? ""}`;
  const reasons: string[] = [];
  const flags: string[] = [];
  let score = 0;
  let exception = false;
  let excluded = false;

  if (isNorthAmericaRestricted(job)) {
    excluded = true;
    flags.push("Marché limité aux États-Unis / Amérique du Nord : hors de votre recherche.");
  }

  if (coreRoles.some((pattern) => pattern.test(job.title))) {
    score += 38;
    reasons.push("Rôle Product Owner / Product Manager au cœur de cible.");
  } else if (adjacentRoles.some((pattern) => pattern.test(job.title))) {
    score += 27;
    reasons.push("Rôle produit adjacent : à examiner comme alternative.");
    flags.push("Rôle secondaire");
  } else {
    flags.push("Intitulé éloigné des rôles ciblés");
    score -= 12;
  }

  const arrangement = detectWorkArrangement(`${job.onsiteCadence ?? ""} ${job.description ?? ""}`, job.remoteMode);
  const pursued = !!job.status && activeStatuses.includes(job.status);
  if (arrangement.mode === "full_remote") {
    score += 25;
    reasons.push("Full remote explicite.");
  } else if (arrangement.mode === "exceptional") {
    score += 21;
    reasons.push("Présence ponctuelle compatible avec vos préférences.");
  } else if (arrangement.mode === "unknown") {
    score += 5;
    exception = true;
    flags.push("Politique remote à confirmer");
  } else if (arrangement.mode === "hybrid" && arrangement.lightHybrid !== false) {
    score += 12;
    exception = true;
    flags.push(arrangement.daysOnsite === 1
      ? "Présence annoncée : 1 jour sur site ; fréquence et dérogation remote à négocier"
      : arrangement.lightHybrid ? "Présence limitée sur site : dérogation remote à négocier" : "Fréquence de présence sur site à confirmer et remote à négocier");
  } else if (pursued) {
    exception = true;
    flags.push("Candidature suivie par votre choix ; dérogation remote à négocier, non acquise");
  } else {
    excluded = true;
    flags.push("Présence régulière incompatible avec le remote recherché");
  }

  if (job.contractType === "cdi") {
    if (job.annualSalary == null) {
      exception = true;
      flags.push("Salaire non communiqué");
    } else if (job.annualSalary >= 55000) {
      score += 20;
      reasons.push(`Rémunération annoncée à ${formatEuro(job.annualSalary)} brut/an ou plus.`);
    } else if (job.annualSalary >= 50000) {
      exception = true;
      flags.push("Salaire légèrement sous le seuil de 55 k€");
    } else {
      excluded = true;
      flags.push("Salaire clairement sous le seuil de 55 k€");
    }
  }

  if (job.contractType === "freelance") {
    if (job.dailyRate == null) {
      exception = true;
      flags.push("TJM non communiqué");
    } else if (job.dailyRate >= 500) {
      score += 20;
      reasons.push(`TJM annoncé à ${formatEuro(job.dailyRate)} HT/jour ou plus.`);
    } else if (job.dailyRate >= 450) {
      exception = true;
      flags.push("TJM légèrement sous le seuil de 500 €");
    } else {
      excluded = true;
      flags.push("TJM clairement sous le seuil de 500 €");
    }
  }

  if (job.contractType === "other") {
    exception = true;
    flags.push("Contrat et rémunération à confirmer");
  }
  if (/pays autorisés.*(?:vérifier|confirmer)|pays de travail.*confirmer/i.test(job.onsiteCadence ?? "")) {
    exception = true;
    flags.push("Pays de travail autorisés à vérifier : remote ne signifie pas partout dans le monde");
  }

  if (job.language === "fr" || job.language === "professional_en") {
    score += 10;
    reasons.push("Langue compatible avec votre profil.");
  } else if (job.language === "en") {
    score += 7;
    reasons.push("Offre en anglais, candidature accompagnée recommandée.");
  } else if (job.language === "advanced_en") {
    exception = true;
    flags.push("Exigence d’anglais avancé à confirmer");
  } else {
    score += 4;
    flags.push("Niveau de langue non précisé");
  }
  if (job.language !== "advanced_en" && /(?:bilingual|bilingue|native[- ]level English|anglais (?:natif|courant exigé)|English\s+(?:C1|C2)|(?:C1|C2)\s+English)/i.test(text)) {
    exception = true;
    flags.push("Exigence bilingue / anglais avancé : vérifier avant de candidater");
  }

  if (/\b(?:fintech|payment|bank|investment|regulated|acpr|saas|ai|llm|generative|public sector|secteur public)\b/i.test(text)) {
    score += 7;
    reasons.push("Secteur ou contexte proche de vos réalisations.");
  }

  score = Math.max(0, Math.min(100, score));
  const tier = excluded
    ? "excluded"
    : exception || score < 60
      ? "exception"
      : score >= 82
        ? "priority"
        : "match";

  return { score, tier, reasons, flags };
}

export function createFingerprint(job: JobInput) {
  return `${job.title}|${job.company ?? ""}|${job.sourceUrl ?? ""}`
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 240);
}

export function formatEuro(value: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}
