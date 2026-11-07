import type { JobInput } from "./types";
import { detectWorkArrangement } from "./work-arrangement";
import { parsePayRange, payMidpoint } from "./pay-range";

export function parseOfferText(text: string, source: string, sourceUrl?: string): Partial<JobInput> {
  const cleaned = text.replace(/\r/g, "").trim();
  const lines = cleaned.split("\n").map((line) => line.trim()).filter(Boolean);
  const title = lines.find((line) => /product owner|product manager|product builder|product ops|product lead/i.test(line)) ?? "";
  const daily = payFrom(lines, "daily", /(?:tjm|daily rate|tarif journalier|€\s*\/\s*(?:jour|j|day)\b|euros?\s*\/\s*jour|par jour)/i);
  const annual = payFrom(lines, "annual", /(?:salaire|salary|rémunération|remuneration|compensation|package|\bbrut\b|par an\b|\/\s*an\b|per year|\d\s*k\s*(?:€|euros?|eur\b))/i);
  const dailyRate = payMidpoint(daily);
  const annualSalary = payMidpoint(annual);
  const contractType = /portage salarial|société de portage|en portage\b/i.test(cleaned)
    ? "portage"
    : /temps partag[ée]|temps partiel|part[- ]time|mi[- ]temps|\b[2-4]\s*jours?\s*(?:\/|par)\s*semaine\b/i.test(cleaned)
    ? "part_time"
    : /freelance|tjm|contractor|contract\b/i.test(cleaned)
    ? "freelance"
    : /\bcdi\b|permanent|full[- ]time employment/i.test(cleaned)
      ? "cdi"
      : /\bcdd\b|contrat à durée déterminée/i.test(cleaned)
        ? "cdd"
      : "other";
  const arrangement = detectWorkArrangement(cleaned);
  const remoteMode = arrangement.mode;
  const language = /c1|c2|fluent english|native english/i.test(cleaned)
    ? "advanced_en"
    : /english|anglais/i.test(cleaned)
      ? "professional_en"
      : /français|french/i.test(cleaned)
        ? "fr"
        : "unknown";

  return {
    title,
    company: companyFrom(lines),
    contractType,
    annualSalary,
    dailyRate,
    salaryMin: annual?.min ?? null,
    salaryMax: annual?.max ?? null,
    dailyRateMin: daily?.min ?? null,
    dailyRateMax: daily?.max ?? null,
    remoteMode,
    onsiteCadence: arrangement.cadence,
    language,
    source,
    sourceUrl,
    description: cleaned.slice(0, 12000),
  };
}

function payFrom(lines: string[], kind: "annual" | "daily", topic: RegExp) {
  for (const line of lines) {
    if (!topic.test(line)) continue;
    if (kind === "annual" && /(?:tjm|daily rate|tarif journalier|\/\s*(?:jour|j|day)\b|par jour)/i.test(line)) continue;
    const pay = parsePayRange(line, kind);
    if (pay) return pay;
  }
  return null;
}

function companyFrom(lines: string[]) {
  const match = lines.find((line) => /^(?:chez|at|company|entreprise)\s*[:\-]/i.test(line));
  return match?.replace(/^(?:chez|at|company|entreprise)\s*[:\-]\s*/i, "").slice(0, 160) ?? "";
}
