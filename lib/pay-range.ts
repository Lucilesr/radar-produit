/** Pay announced in an offer: an annual gross salary or a daily rate, as a single value or a range, in euros only. */
export type PayRange = { kind: "annual" | "daily"; min: number | null; max: number | null };

const ANNUAL = { low: 15000, high: 500000 };
const DAILY = { low: 100, high: 3000 };

// Other currencies are not compared with euro minimums.
const foreignCurrency = /(?:\$|£|\bUSD\b|\bGBP\b|\bCHF\b|\bCAD\b|dollars?|pounds?)/i;
const monthly = /(?:\/\s*mois|par mois|mensuel(?:le)?|monthly|per month|\/\s*month)/i;
const daily = /(?:\btjm\b|tarif journalier|daily rate|\/\s*(?:jour|j|day)\b|par jour|per day)/i;
const amount = String.raw`(\d{1,3}(?:[\s .,]\d{3})+|\d+(?:[.,]\d+)?)\s*(k)?`;
const rangePattern = new RegExp(String.raw`(?:entre\s+|between\s+|de\s+|from\s+)?${amount}\s*(?:€|eur\b|euros?)?(?:\s*[-–—]\s*|\s+(?:à|a|et|to|and)\s+)(?:€|eur\b)?\s*${amount}`, "i");
const singlePattern = new RegExp(String.raw`(?:€|eur\b)?\s*${amount}\s*(?:€|eur\b|euros?)?`, "gi");
const lowerOnly = /(?:à partir de|a partir de|dès|des\s|minimum|\bmin\.?\s|from|starting at|at least|au moins)\s*$/i;
const upperOnly = /(?:jusqu['’]à|jusqu['’]a|up to|maximum|\bmax\.?\s|au plus)\s*$/i;

function toNumber(raw: string, thousands: string | undefined) {
  const compact = raw.replace(/[\s ]/g, "");
  // "60.000" or "60,000" are thousands separators; "62,5k" is a decimal.
  const grouped = /^\d{1,3}(?:[.,]\d{3})+$/.test(compact);
  const value = Number(grouped ? compact.replace(/[.,]/g, "") : compact.replace(",", "."));
  if (!Number.isFinite(value)) return null;
  return thousands ? value * 1000 : value;
}

function plausible(kind: PayRange["kind"], value: number | null) {
  if (value == null) return null;
  const bounds = kind === "annual" ? ANNUAL : DAILY;
  return value >= bounds.low && value <= bounds.high ? Math.round(value) : null;
}

/** Reads the first euro pay figure of a text. Returns null when nothing reliable is found. */
export function parsePayRange(text: string, expected?: PayRange["kind"]): PayRange | null {
  const line = text.replace(/ /g, " ");
  if (!line.trim() || foreignCurrency.test(line) || monthly.test(line)) return null;
  const kind: PayRange["kind"] = expected ?? (daily.test(line) ? "daily" : "annual");
  const euro = /€|\beur\b|euros?/i.test(line);
  const range = line.match(rangePattern);
  if (range) {
    const highK = range[4];
    const lowK = range[2] ?? highK; // "62–70 k€": the unit of the second figure applies to both.
    let min = toNumber(range[1], lowK);
    let max = toNumber(range[3], highK);
    if (kind === "annual" && !lowK && !highK && min != null && max != null && min < 1000 && max < 1000) { min *= 1000; max *= 1000; }
    min = plausible(kind, min); max = plausible(kind, max);
    if (min != null && max != null && (euro || kind === "daily" || highK)) return min <= max ? { kind, min, max } : { kind, min: max, max: min };
  }
  for (const match of line.matchAll(singlePattern)) {
    const before = line.slice(0, match.index ?? 0);
    const hasUnit = !!match[2] || /€|eur\b|euros?/i.test(match[0]);
    // A bare figure is only a rate when the line itself speaks in euros ("TJM : 550 € HT").
    if (!hasUnit && !(kind === "daily" && euro)) continue;
    const value = plausible(kind, toNumber(match[1], match[2]));
    if (value == null) continue;
    if (upperOnly.test(before)) return { kind, min: null, max: value };
    if (lowerOnly.test(before)) return { kind, min: value, max: null };
    return { kind, min: value, max: value };
  }
  return null;
}

/** One comparable figure: the midpoint of a range, or its known bound. */
export function payMidpoint(range: Pick<PayRange, "min" | "max"> | null | undefined) {
  if (!range) return null;
  if (range.min != null && range.max != null) return Math.round((range.min + range.max) / 2);
  return range.min ?? range.max ?? null;
}

/** "62 000 € – 70 000 € brut/an", or one figure when no range is known. */
export function formatPay(min: number | null | undefined, max: number | null | undefined, value: number | null | undefined, unit: string) {
  const euro = (amount: number) => `${new Intl.NumberFormat("fr-FR").format(amount)} €`;
  if (min != null && max != null && min !== max) return `${euro(min)} – ${euro(max)} ${unit}`;
  if (min != null && max == null && value == null) return `à partir de ${euro(min)} ${unit}`;
  if (max != null && min == null && value == null) return `jusqu’à ${euro(max)} ${unit}`;
  const single = value ?? min ?? max;
  return single == null ? null : `${euro(single)} ${unit}`;
}

/** Compact range for lists: "62–70 k€ / an", "450–600 € / jour"; null when there is no range. */
export function formatPayRangeShort(min: number | null | undefined, max: number | null | undefined, kind: PayRange["kind"]) {
  if (min == null || max == null || min === max) return null;
  if (kind === "daily") return `${min}–${max} € / jour`;
  const k = (value: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(value / 1000);
  return `${k(min)}–${k(max)} k€ / an`;
}
