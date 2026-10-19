import type { RemoteMode } from "./types";

const numbers: Record<string, number> = { un: 1, une: 1, one: 1, deux: 2, two: 2, trois: 3, three: 3, quatre: 4, four: 4, cinq: 5, five: 5 };
const amount = "([1-5]|un|une|deux|trois|quatre|cinq|one|two|three|four|five)";
const days = "\\s*(?:jours?|days?|j)\\b";
const period = "(?:\\s*(?:/|par|per|a)\\s*(?:semaine|week|mois|month))?";
const onsite = "(?:sur\\s+(?:le\\s+)?site|on[ -]?site|presentiel|au\\s+bureau|in[ -]?office)";
const remote = "(?:teletravail|remote|work(?:ing)? from home)";

function clean(text: string) { return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }
function count(value: string) { return numbers[value] ?? Number(value); }

export function detectWorkArrangement(text: string, declaredMode: RemoteMode = "unknown") {
  const normalized = clean(text);
  const sitePatterns = [
    new RegExp("(?<![\\d.,])\\b" + amount + days + period + "\\s*(?:(?:en|de|of|in)\\s+)?" + onsite + period, "g"),
    new RegExp(onsite + "\\s*(?::|,|-)?\\s*" + amount + days + period, "g"),
  ];
  const siteMatches = sitePatterns.flatMap(pattern => Array.from(normalized.matchAll(pattern)));
  if (siteMatches.length) {
    const daysOnsite = Math.max(...siteMatches.map(match => count(match[1])));
    const cadence = siteMatches.map(match => match[0]).join(" ; ");
    // A monthly requirement is negotiable too, but never call it full remote.
    const monthly = siteMatches.every(match => /mois|month/.test(match[0]));
    return { mode: "hybrid" as const, daysOnsite, lightHybrid: monthly || daysOnsite <= 1, cadence };
  }
  const remotePatterns = [
    new RegExp("\\b" + amount + days + "\\s*(?:(?:de|en|of)\\s+)?" + remote + "\\s*(?:/|par|per|a)\\s*(?:semaine|week)", "g"),
    new RegExp(remote + "\\s*(?:annonce\\s*)?(?::|,|-)?\\s*" + amount + days + "\\s*(?:/|par|per|a)\\s*(?:semaine|week)", "g"),
  ];
  const remoteMatches = remotePatterns.flatMap(pattern => Array.from(normalized.matchAll(pattern)));
  if (remoteMatches.length) {
    // Only infer the complement when a full five-day work week is explicit.
    const fullWeek = /toute la semaine|5\s*jours\s*(?:par|\/)\s*semaine|five[- ]day (?:work )?week/.test(normalized);
    const remoteDays = Math.min(...remoteMatches.map(match => count(match[1])));
    const daysOnsite = fullWeek ? 5 - remoteDays : undefined;
    return { mode: remoteDays === 5 ? "full_remote" as const : "hybrid" as const,
      daysOnsite, lightHybrid: daysOnsite === undefined || daysOnsite <= 1,
      cadence: remoteMatches.map(match => match[0]).join(" ; ") };
  }
  if (declaredMode === "hybrid" || declaredMode === "onsite") return { mode: declaredMode };
  if (/(?:pas de|no|not|non)[ -]+full[ -]?remote|(?:ne pas|not to)\s+(?:presumer|assume)[^.!?\n]{0,60}full[ -]?remote|full[ -]?remote\s+(?:a confirmer|non confirme)/.test(normalized)) return { mode: declaredMode === "full_remote" ? "unknown" as const : declaredMode };
  if (/full[ -]?remote|100\s*%\s*(?:remote|teletravail)|remote only|teletravail (?:a temps complet|uniquement)/.test(normalized)) return { mode: "full_remote" as const };
  if (/ponctuel|quarterly|trimestre|important moments|seminaire/.test(normalized)) return { mode: "exceptional" as const };
  if (/hybrid|hybride|on[- ]?site|presentiel|sur site/.test(normalized)) return { mode: "hybrid" as const };
  return { mode: declaredMode };
}
