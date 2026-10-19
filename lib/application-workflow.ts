import type { InterviewRecord, JobStatus } from "./types";

export const statusLabels: Record<JobStatus, string> = {
  new: "À examiner", watchlist: "Ancienne veille", shortlist: "Ancienne shortlist", prepare: "À préparer", ready: "Dossier prêt à envoyer", applied: "Candidature envoyée",
  interview: "Entretien prévu / en cours", awaiting_response: "En attente de retour", next_step: "Prochaine étape",
  offer: "Proposition reçue", rejected: "Refus reçu", withdrawn: "Candidature retirée par moi", closed: "Ancienne archive à reclasser",
};
export const activeStatuses: JobStatus[] = ["shortlist", "prepare", "ready", "applied", "interview", "awaiting_response", "next_step", "offer"];
export const terminalStatuses: JobStatus[] = ["rejected", "withdrawn", "closed"];
export function reviewDue(interview: InterviewRecord, now = Date.now()) {
  return interview.state === "planned" && Date.parse(interview.endAt) <= now;
}
export function formatDate(value?: string, timeZone = "Europe/Paris", withTime = false) {
  if (!value) return "Non communiquée";
  const parsed = new Date(value.includes("T") ? value : value.includes(" ") ? value.replace(" ", "T") + "Z" : value + "T12:00:00Z");
  if (Number.isNaN(parsed.getTime())) return "Non communiquée";
  return new Intl.DateTimeFormat("fr-FR", { timeZone, day: "2-digit", month: "short", year: "numeric", ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}) }).format(parsed);
}
export function zonedInput(value: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(value));
  const p = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
export function fromZonedInput(value: string, timeZone: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error("Renseignez une date et une heure valides.");
  let timestamp = Date.parse(value + "Z"); const target = timestamp;
  for (let i = 0; i < 3; i++) timestamp += target - Date.parse(zonedInput(new Date(timestamp).toISOString(), timeZone) + "Z");
  const result = new Date(timestamp).toISOString();
  if (zonedInput(result, timeZone) !== value) throw new Error("Cette heure n’existe pas dans ce fuseau. Choisissez une autre heure.");
  return result;
}
