import type { JobInput } from "./types";
import { detectWorkArrangement } from "./work-arrangement";

export function parseOfferText(text: string, source: string, sourceUrl?: string): Partial<JobInput> {
  const cleaned = text.replace(/\r/g, "").trim();
  const lines = cleaned.split("\n").map((line) => line.trim()).filter(Boolean);
  const title = lines.find((line) => /product owner|product manager|product builder|product ops|product lead/i.test(line)) ?? "";
  const dailyRate = numberFrom(cleaned, /(?:tjm|daily rate|€\s*\/\s*jour|euros?\s*\/\s*jour)[^\d]{0,16}(\d{3,4})|(?<!\d)(\d{3,4})\s*(?:€|euros?)\s*(?:\/\s*jour|\/day)/i);
  const annualSalary = numberFrom(cleaned, /(?:salaire|salary|rémunération|compensation)[^\d]{0,24}(\d{2,3})\s*[kK]|(?<!\d)(\d{2,3})\s*[kK]\s*(?:€|euros?)/i, true);
  const contractType = /freelance|tjm|contractor|contract\b/i.test(cleaned)
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
    remoteMode,
    onsiteCadence: arrangement.cadence,
    language,
    source,
    sourceUrl,
    description: cleaned.slice(0, 12000),
  };
}

function numberFrom(text: string, pattern: RegExp, thousands = false) {
  const match = text.match(pattern);
  const value = match?.[1] ?? match?.[2];
  if (!value) return null;
  const number = Number(value.replace(/\s/g, ""));
  return Number.isFinite(number) ? (thousands && number < 1000 ? number * 1000 : number) : null;
}

function companyFrom(lines: string[]) {
  const match = lines.find((line) => /^(?:chez|at|company|entreprise)\s*[:\-]/i.test(line));
  return match?.replace(/^(?:chez|at|company|entreprise)\s*[:\-]\s*/i, "").slice(0, 160) ?? "";
}
