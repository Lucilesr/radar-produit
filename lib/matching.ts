import type { Assessment, JobInput, JobStatus, SearchPreferences } from "./types";
import { searchPreferences } from "./search-preferences";
import { detectWorkArrangement } from "./work-arrangement";
import { activeStatuses } from "./application-workflow";
import { isNorthAmericaRestricted } from "./market-scope";

const ownerRoles = [/\bproduct owner\b/i, /\bpo\b/i];
const managerRoles = [/\bproduct manager\b/i, /\bpm\b/i, /chef de produit (?:digital|numerique|numérique)\b/i];
const productRole = /\bproduct\b|\bproduit\b|\b(?:po|pm)\b/i;

function matchesSearchedRole(title: string, role: string) {
  if (role === "Product Owner") return ownerRoles.some(pattern => pattern.test(title));
  if (role === "Product Manager") return managerRoles.some(pattern => pattern.test(title));
  const normalized = (value: string) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr").replace(/[^a-z0-9]+/g, " ").trim();
  return (` ${normalized(title)} `).includes(` ${normalized(role)} `);
}

export function assessJob(job: JobInput & { status?: JobStatus }, preferences?: SearchPreferences): Assessment {
  const search = searchPreferences(preferences);
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

  const matchedRole = search.roles.find(role => matchesSearchedRole(job.title, role));
  if (matchedRole) {
    score += 38;
    reasons.push(`Intitulé proche de votre recherche : ${matchedRole}.`);
  } else if (productRole.test(job.title)) {
    score += 27;
    exception = true;
    reasons.push("Autre rôle produit : à examiner comme piste secondaire.");
    flags.push("Rôle secondaire");
  } else {
    flags.push("Intitulé éloigné des rôles ciblés");
    score -= 12;
  }

  const detected = detectWorkArrangement(`${job.onsiteCadence ?? ""} ${job.description ?? ""}`, job.remoteMode);
  const weekly=job.onsiteDaysPerWeek,monthly=job.onsiteDaysPerMonth;
  const explicitPresence=weekly!=null||monthly!=null;
  const arrangement=explicitPresence&&job.remoteMode==="hybrid" ? {mode:"hybrid" as const,daysOnsite:weekly??undefined,lightHybrid:(weekly==null||weekly<=1)&&(monthly==null||monthly<=4)} : detected;
  const pursued = !!job.status && activeStatuses.includes(job.status);
  if (arrangement.mode === "full_remote") {
    score += 25;
    reasons.push("Full remote explicite.");
  } else if (arrangement.mode === "exceptional" && search.remote !== "full_remote") {
    score += 21;
    reasons.push("Présence ponctuelle compatible avec vos préférences.");
  } else if (arrangement.mode === "unknown") {
    score += 5;
    exception = true;
    flags.push("Politique remote à confirmer");
  } else if (arrangement.mode === "hybrid" && arrangement.lightHybrid !== false && search.remote === "light_hybrid") {
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
    flags.push("Présence sur site incompatible avec votre recherche");
  }

  if ((job.contractType === "cdi" || job.contractType === "freelance") && !search.contracts.includes(job.contractType)) {
    excluded = true;
    flags.push("Type de contrat non recherché.");
  }

  if (job.contractType === "cdi") {
    if (job.annualSalary == null) {
      exception = true;
      flags.push("Salaire non communiqué");
    } else if (job.annualSalary >= search.minimumSalary) {
      score += 20;
      reasons.push(`Rémunération annoncée à ${formatEuro(job.annualSalary)} brut/an.`);
    } else if (job.annualSalary >= search.minimumSalary - 5000) {
      exception = true;
      flags.push(`Salaire légèrement sous votre seuil de ${formatEuro(search.minimumSalary)}.`);
    } else {
      excluded = true;
      flags.push(`Salaire sous votre seuil de ${formatEuro(search.minimumSalary)}.`);
    }
  }

  if (job.contractType === "freelance") {
    if (job.dailyRate == null) {
      exception = true;
      flags.push("TJM non communiqué");
    } else if (job.dailyRate >= search.minimumDailyRate) {
      score += 20;
      reasons.push(`TJM annoncé à ${formatEuro(job.dailyRate)} HT/jour.`);
    } else if (job.dailyRate >= search.minimumDailyRate - 50) {
      exception = true;
      flags.push(`TJM légèrement sous votre seuil de ${formatEuro(search.minimumDailyRate)}.`);
    } else {
      excluded = true;
      flags.push(`TJM sous votre seuil de ${formatEuro(search.minimumDailyRate)}.`);
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
