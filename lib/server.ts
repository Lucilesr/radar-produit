import { isCountryCode } from "./countries";
import type { CandidateProfile, JobInput, JobRecord, JobStatus } from "./types";
import { statusLabels } from "./application-workflow";

const contractTypes = new Set(["cdi", "freelance", "other"]);
const remoteModes = new Set(["full_remote", "exceptional", "hybrid", "onsite", "unknown"]);
const languages = new Set(["fr", "en", "professional_en", "advanced_en", "unknown"]);
const statuses = new Set(Object.keys(statusLabels));

export function ensureSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export function normalizeJobInput(value: unknown): JobInput {
  if (!value || typeof value !== "object") throw new Error("Format d’offre invalide");
  const raw = value as Record<string, unknown>;
  const title = asText(raw.title, 180);
  if (!title) throw new Error("L’intitulé du poste est obligatoire");

  return {
    title,
    company: asText(raw.company, 160) || "Entreprise non précisée",
    contractType: contractTypes.has(raw.contractType as string)
      ? (raw.contractType as JobInput["contractType"])
      : "other",
    annualSalary: asNumber(raw.annualSalary),
    dailyRate: asNumber(raw.dailyRate),
    remoteMode: remoteModes.has(raw.remoteMode as string)
      ? (raw.remoteMode as JobInput["remoteMode"])
      : "unknown",
    onsiteCadence: asText(raw.onsiteCadence, 180),
    onsiteDaysPerWeek: dayCount(raw.onsiteDaysPerWeek,5),
    onsiteDaysPerMonth: dayCount(raw.onsiteDaysPerMonth,31),
    remoteCountry: country(raw.remoteCountry),
    language: languages.has(raw.language as string)
      ? (raw.language as JobInput["language"])
      : "unknown",
    source: asText(raw.source, 80) || "Ajout manuel",
    sourceUrl: asUrl(raw.sourceUrl),
    contact: asText(raw.contact, 160),
    description: asText(raw.description, 12000),
    publishedAt: asText(raw.publishedAt, 30),
    applicationUrl: asUrl(raw.applicationUrl),
    contentCoverage: ["full", "summary", "partial", "unknown"].includes(String(raw.contentCoverage)) ? raw.contentCoverage as JobInput["contentCoverage"] : "unknown",
    notificationAt: asText(raw.notificationAt, 30),
  };
}

export function rowToJob(row: Record<string, unknown>): JobRecord {
  return {
    id: String(row.id),
    deletedAt: stringOrUndefined(row.deletedAt),
    reviewState: row.reviewState === "to_review" || row.reviewState === "selected" ? row.reviewState : undefined,
    boardColumnId: stringOrUndefined(row.boardColumnId),
    dismissalReason: ["filled", "applications_closed", "not_interested", "other"].includes(String(row.dismissalReason)) ? row.dismissalReason as JobRecord["dismissalReason"] : undefined,
    dismissalNote: stringOrUndefined(row.dismissalNote),
    dismissalEvidence: stringOrUndefined(row.dismissalEvidence),
    title: String(row.title),
    company: String(row.company ?? "Entreprise non précisée"),
    contractType: (row.contractType as JobInput["contractType"]) ?? "other",
    annualSalary: numberOrNull(row.annualSalary),
    dailyRate: numberOrNull(row.dailyRate),
    remoteMode: (row.remoteMode as JobInput["remoteMode"]) ?? "unknown",
    onsiteCadence: stringOrUndefined(row.onsiteCadence),
    onsiteDaysPerWeek: numberOrNull(row.onsiteDaysPerWeek),
    onsiteDaysPerMonth: numberOrNull(row.onsiteDaysPerMonth),
    remoteCountry: isCountryCode(row.remoteCountry)?row.remoteCountry:undefined,
    language: (row.language as JobInput["language"]) ?? "unknown",
    source: String(row.source ?? "Ajout manuel"),
    sourceUrl: stringOrUndefined(row.sourceUrl),
    contact: stringOrUndefined(row.contact),
    description: String(row.description ?? ""),
    publishedAt: stringOrUndefined(row.publishedAt),
    applicationUrl: stringOrUndefined(row.applicationUrl),
    contentCoverage: row.contentCoverage as JobInput["contentCoverage"] ?? "unknown",
    notificationAt: stringOrUndefined(row.notificationAt),
    status: (row.status as JobStatus) ?? "new",
    appliedAt: stringOrUndefined(row.appliedAt),
    matchScore: Number(row.matchScore ?? 0),
    matchTier: (row.matchTier as JobRecord["matchTier"]) ?? "exception",
    reasons: parseArray(row.reasons),
    flags: parseArray(row.flags),
    createdAt: stringOrUndefined(row.createdAt),
    updatedAt: stringOrUndefined(row.updatedAt),
  };
}

export function parseProfile(value: unknown): CandidateProfile {
  if (!value || typeof value !== "object") throw new Error("Profil invalide");
  return value as CandidateProfile;
}

export function isStatus(value: unknown): value is JobStatus {
  return typeof value === "string" && statuses.has(value);
}

function asText(value: unknown, limit: number) {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

function asNumber(value: unknown) {
  if (value === "" || value == null) return null;
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.round(number) : null;
}

function asUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return undefined;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function parseArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function numberOrNull(value: unknown) {
  return typeof value === "number" ? value : null;
}

function stringOrUndefined(value: unknown) {
  return typeof value === "string" && value ? value : undefined;
}

function dayCount(value: unknown,max:number):number|null {
  if(value==null||value==="")return null;
  if(typeof value!=="number"||!Number.isInteger(value)||value<0||value>max)throw new Error(`Présence invalide : 0 à ${max} jours.`);
  return value;
}
function country(value:unknown):string { if(value==null||value==="")return "";if(!isCountryCode(value))throw new Error("Pays invalide");return value; }
