/** Seniority asked by an offer, compared with the level an account aims for. */
export const levels = ["junior", "confirmed", "senior", "lead", "head"] as const;
export type Level = typeof levels[number];

export const levelLabels: Record<Level, string> = {
  junior: "Junior",
  confirmed: "Confirmé",
  senior: "Senior",
  lead: "Lead",
  head: "Head of",
};

export type DetectedLevel = { level: Level; evidence: string[] };

const titleRules: Array<[Level, RegExp]> = [
  ["head", /\b(?:head of|director|directeur|directrice|vp|vice[- ]president|chief|cpo)\b/i],
  ["lead", /\b(?:lead|staff|principal|group product (?:manager|owner))\b/i],
  ["senior", /\b(?:senior|sr\.?)(?=\s|$|\W)/i],
  ["junior", /\b(?:junior|jr\.?|stagiaire|intern(?:ship)?|alternante?|alternance|apprentie?|graduate|entry[- ]level)\b/i],
];

// "5 ans d'expérience", "5+ years", "au moins 8 ans", "minimum 3 years of experience".
const yearsPattern = /(?:au moins|minimum|min\.?|at least|plus de|over)?\s*(\d{1,2})\s*(?:\+|ans? et plus|ou plus|or more)?\s*(?:\+)?\s*(?:ans?|années?|years?|yrs?)(?:\s+(?:d['’]\s*)?(?:exp[ée]rience|of experience|experience|minimum))?/gi;
const experienceContext = /exp[ée]rience|experience|expérimenté|track record|background/i;
const managerRoles = String.raw`(?:product managers?|product owners?|pms|pos|chef(?:fe)?s? de produits?|managers)`;
// Managing managers needs a team or a head count: "working with product owners" is not management.
const managesManagers = new RegExp(String.raw`\b(?:manag(?:e|es|ing)|lead(?:s|ing)?|encadr(?:er|ez|ement)|dirig(?:er|ez))\b[^.\n]{0,30}?(?:(?:a\s+)?team of|(?:une\s+)?[ée]quipe de|\d+)\s*(?:\d+\s*)?${managerRoles}\b`, "i");
const managesTeam = /\b(?:encadr(?:er|ez|ement d['’]une?)|manag(?:e|es|ing) a team|people management|management d['’][ée]quipe)\b/i;

function fromYears(years: number): Level {
  if (years <= 2) return "junior";
  if (years <= 4) return "confirmed";
  if (years <= 7) return "senior";
  return "lead";
}

function rank(level: Level) { return levels.indexOf(level); }

function managementSignal(text: string): DetectedLevel | undefined {
  const managers = text.match(managesManagers);
  if (managers) return { level: "head", evidence: [`« ${managers[0].trim()} »`] };
  const team = text.match(managesTeam);
  return team ? { level: "lead", evidence: [`« ${team[0].trim()} »`] } : undefined;
}

/**
 * Level asked by an offer, with the words that show it. The title wins over the years asked,
 * but managing a team raises it: a "Senior PM" who manages PMs is a head of product.
 */
export function detectLevel(title: string, description = ""): DetectedLevel | undefined {
  const text = description.slice(0, 6000);
  const management = managementSignal(text);
  for (const [level, pattern] of titleRules) {
    if (!pattern.test(title)) continue;
    const fromTitle: DetectedLevel = { level, evidence: ["d’après l’intitulé"] };
    return management && rank(management.level) > rank(level) ? management : fromTitle;
  }
  const signals: DetectedLevel[] = [];
  for (const match of text.matchAll(yearsPattern)) {
    // The figure must sit next to the word experience, not anywhere in the same sentence.
    const start = match.index ?? 0;
    const around = text.slice(Math.max(0, start - 40), start + match[0].length + 40);
    const years = Number(match[1]);
    if (experienceContext.test(around) && years >= 1 && years <= 25) signals.push({ level: fromYears(years), evidence: [`« ${match[0].trim()} »`] });
  }
  if (management) signals.push(management);
  if (!signals.length) return undefined;
  const top = signals.reduce((best, next) => rank(next.level) > rank(best.level) ? next : best);
  return { level: top.level, evidence: signals.filter(signal => signal.level === top.level).flatMap(signal => signal.evidence).slice(0, 2) };
}

/** Steps between the offer and the target: positive above, negative below. */
export function levelGap(offer: Level, target: Level) { return rank(offer) - rank(target); }

/** Point to check shown with the offer, or undefined when the level fits. */
export function levelSignal(detected: DetectedLevel | undefined, target: Level | undefined, acceptAbove = false): string | undefined {
  if (!detected || !target) return undefined;
  const gap = levelGap(detected.level, target);
  const asked = `${levelLabels[detected.level]} (${detected.evidence.join(", ")})`;
  if (gap === 1) return acceptAbove ? undefined : `Niveau demandé : ${asked}, un cran au-dessus de votre cible.`;
  if (gap >= 2) return `Poste probablement trop senior : ${asked}.`;
  if (gap <= -1) return `Poste plus junior que votre cible : ${asked}.`;
  return undefined;
}
