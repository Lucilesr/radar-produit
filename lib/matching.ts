import type { Assessment, JobInput, JobStatus, SearchPreferences } from "./types";
import { foldKeyword, payFloor, remoteForContract, searchPreferences } from "./search-preferences";
import { detectWorkArrangement } from "./work-arrangement";
import { activeStatuses } from "./application-workflow";
import { isNorthAmericaRestricted } from "./market-scope";
import { announcedLocationFor, assessLocation } from "./location-criteria";

const ownerRoles = [/\bproduct owner\b/i, /\bpo\b/i];
const managerRoles = [/\bproduct manager\b/i, /\bchef(?:fe)? de produits?\b/i, /\bresponsable produit\b/i];
// "PM" also means Project Manager: it is refused when the offer speaks of project management and not of product.
const ambiguousManager = /\bpm\b/i;
const projectRole = /\b(?:project manager|chef(?:fe)? de projets?|program(?:me)? manager)\b/i;
const projectWork = /\b(?:project manager|project management|gestion de projets?|chef(?:fe)? de projets?|pmo|pmp|prince2|maîtrise d['’]œuvre|moa|erp|btp|chantiers?)\b/i;
const productWork = /\bproduct\b|\bproduit\b/i;

function matchesSearchedRole(title: string, role: string, description = "") {
  if (role === "Product Owner") return ownerRoles.some(pattern => pattern.test(title));
  if (role === "Product Manager") {
    if (managerRoles.some(pattern => pattern.test(title))) return true;
    if (!ambiguousManager.test(title) || projectRole.test(title)) return false;
    const context = `${title} ${description.slice(0, 600)}`;
    return productWork.test(context) || !projectWork.test(context);
  }
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

  const northAmericaRequested = !!search.includedLocations?.length && ["États-Unis", "Canada"].some(place => {
    const result = assessLocation(place, search.includedLocations ?? [], []);
    return !result.excluded && !result.uncertain;
  });
  if (!northAmericaRequested && isNorthAmericaRestricted(job)) {
    excluded = true;
    flags.push("Marché limité aux États-Unis / Amérique du Nord : hors de votre recherche.");
  }

  const location = announcedLocationFor(job);
  const locationAssessment = assessLocation(location, search.includedLocations ?? [], search.excludedLocations ?? []);
  if (locationAssessment.excluded) {
    excluded = true;
    flags.push(`Lieu annoncé hors de votre recherche${location ? ` : ${location}` : ""}.`);
  } else if (locationAssessment.uncertain) {
    exception = true;
    flags.push("Lieu annoncé à vérifier selon vos critères géographiques.");
  }

  const matchedRole = search.roles.find(role => matchesSearchedRole(job.title, role, job.description ?? ""));
  if (!search.roles.length) {
    exception = true;
    flags.push("Aucun poste choisi : indiquez le poste que vous cherchez dans Ma recherche.");
  } else if (matchedRole) {
    score += 38;
    reasons.push(`Intitulé proche de votre recherche : ${matchedRole}.`);
  } else {
    flags.push("Intitulé éloigné des rôles ciblés");
    score -= 12;
  }

  const detected = detectWorkArrangement(`${job.onsiteCadence ?? ""} ${job.description ?? ""}`, job.remoteMode);
  const weekly=job.onsiteDaysPerWeek,monthly=job.onsiteDaysPerMonth;
  const explicitPresence=weekly!=null||monthly!=null;
  const arrangement=explicitPresence&&job.remoteMode==="hybrid" ? {mode:"hybrid" as const,daysOnsite:weekly??undefined,lightHybrid:(weekly==null||weekly<=1)&&(monthly==null||monthly<=4)} : detected;
  const pursued = !!job.status && activeStatuses.includes(job.status);
  const acceptedPresence = remoteForContract(search, job.contractType);
  if (arrangement.mode === "full_remote") {
    score += 25;
    reasons.push("Full remote explicite.");
  } else if (arrangement.mode === "exceptional" && acceptedPresence !== "full_remote") {
    score += 21;
    reasons.push("Présence ponctuelle compatible avec vos préférences.");
  } else if (arrangement.mode === "unknown") {
    score += 5;
    exception = true;
    flags.push("Politique remote à confirmer");
  } else if (arrangement.mode === "hybrid" && (acceptedPresence === "hybrid" || acceptedPresence === "onsite")) {
    score += 12;
    reasons.push("Organisation hybride compatible avec votre présence acceptable.");
  } else if (arrangement.mode === "onsite" && acceptedPresence === "onsite") {
    score += 12;
    reasons.push("Présence sur site compatible avec votre recherche.");
  } else if (pursued) {
    exception = true;
    flags.push("Candidature suivie par votre choix ; dérogation remote à négocier, non acquise");
  } else {
    excluded = true;
    flags.push("Présence sur site incompatible avec votre recherche");
  }

  if (job.contractType !== "other" && !search.contracts.includes(job.contractType)) {
    excluded = true;
    flags.push("Type de contrat non recherché.");
  }

  const tolerance = search.payTolerancePercent ?? 0;
  const salaryHigh = job.salaryMax ?? job.annualSalary ?? null;
  const salaryLow = job.salaryMin ?? job.annualSalary ?? null;
  if (job.contractType !== "part_time" && (salaryHigh != null || job.contractType === "cdi" || job.contractType === "cdd")) {
    if (salaryHigh == null) {
      // Without a minimum, a missing salary blocks nothing: no flag to check.
      if (search.minimumSalary > 0) {
        exception = true;
        flags.push("Salaire non communiqué");
      }
    } else if (salaryHigh >= search.minimumSalary) {
      score += 20;
      reasons.push(`Rémunération annoncée ${payLabel(job.salaryMin, job.salaryMax, job.annualSalary, "brut/an")}.`);
      // Only the top of the range must reach the minimum; the bottom is worth knowing before applying.
      if (salaryLow != null && salaryLow < search.minimumSalary) flags.push(`Bas de fourchette sous votre minimum de ${formatEuro(search.minimumSalary)} brut/an.`);
    } else if (tolerance && salaryHigh >= payFloor(search.minimumSalary, tolerance)) {
      exception = true;
      flags.push(`Sous votre minimum de ${formatEuro(search.minimumSalary)} brut/an (dans votre tolérance de ${tolerance} %).`);
    } else {
      excluded = true;
      flags.push(`Salaire sous votre seuil de ${formatEuro(search.minimumSalary)}.`);
    }
  }

  const rateHigh = job.dailyRateMax ?? job.dailyRate ?? null;
  const rateLow = job.dailyRateMin ?? job.dailyRate ?? null;
  if (rateHigh != null || job.contractType === "freelance" || job.contractType === "portage") {
    if (rateHigh == null) {
      if (search.minimumDailyRate > 0) {
        exception = true;
        flags.push("TJM non communiqué");
      }
    } else if (rateHigh >= search.minimumDailyRate) {
      score += 20;
      reasons.push(`TJM annoncé ${payLabel(job.dailyRateMin, job.dailyRateMax, job.dailyRate, "HT/jour")}.`);
      if (rateLow != null && rateLow < search.minimumDailyRate) flags.push(`Bas de fourchette sous votre minimum de ${formatEuro(search.minimumDailyRate)} HT/jour.`);
    } else if (tolerance && rateHigh >= payFloor(search.minimumDailyRate, tolerance)) {
      exception = true;
      flags.push(`Sous votre minimum de ${formatEuro(search.minimumDailyRate)} HT/jour (dans votre tolérance de ${tolerance} %).`);
    } else {
      excluded = true;
      flags.push(`TJM sous votre seuil de ${formatEuro(search.minimumDailyRate)}.`);
    }
  }

  if (job.contractType === "part_time" && job.dailyRate == null) {
    exception = true;
    flags.push(job.annualSalary == null
      ? "Rémunération du temps partagé à vérifier."
      : `Rémunération à temps partiel : ${formatEuro(job.annualSalary)} annoncés, à ramener à un temps plein avant de comparer à votre minimum.`);
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

  const haystack = foldKeyword(`${text} ${job.company ?? ""}`);
  const found = (words?: string[]) => (words ?? []).filter(word => haystack.includes(foldKeyword(word)));
  const boosted = found(search.boostKeywords);
  if (boosted.length) {
    score += Math.min(12, 6 * boosted.length);
    reasons.push(`Mentionne ${boosted.join(", ")}.`);
  }
  const unwanted = found(search.excludeKeywords);
  if (unwanted.length) {
    excluded = true;
    flags.push(`Contient ${unwanted.join(", ")}, que vous écartez.`);
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

/** "à 55 000 € brut/an", or "entre 62 000 € et 70 000 € brut/an" for an announced range. */
export function payLabel(min: number | null | undefined, max: number | null | undefined, value: number | null | undefined, unit: string) {
  if (min != null && max != null && min !== max) return `entre ${formatEuro(min)} et ${formatEuro(max)} ${unit}`;
  const single = value ?? max ?? min;
  return single == null ? unit : `à ${formatEuro(single)} ${unit}`;
}
