const heading = /^(?:about(?: the role)?|context(?:e)?|mission|responsabilit[eé]s|missions?|what you(?:'ll| will) do|what you bring|requirements?|qualifications?|profil recherch[eé]|p[eé]rim[eè]tre|livrables|conditions|benefits|company overview)\b/i;
const boilerplate = /^(?:apply now|learn more|read more|postuler|en savoir plus|equal opportunity|equal employment|we are an equal|privacy policy|terms of use)\b/i;
const missionCue = /\b(?:we are looking for|we're looking for|looking for a|as (?:a|our) product|you will|you'll|your role|responsible for|own the|lead the|recherche un|recherchons|nous recherchons|vous rejoignez|vous aurez pour mission|vous serez charg[eé]e? de|piloter|d[eé]finir|concevoir|structurer|accompagner|la mission vise)\b/i;
const missionFocus = /\b(?:own the|lead the|responsible for|drive (?:the|product)|define the|pour piloter|pour structurer|pour d[eé]finir|vous aurez pour mission|vous serez charg[eé]e? de|la mission vise)\b/i;

function cleanLine(line: string) {
  return line.replace(/^\s*(?:[-*•▪◦]|\d+[.)])\s*/, "").replace(/\s+/g, " ").trim();
}

function shorten(text: string, max = 310) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const boundary = Math.max(cut.lastIndexOf(" "), cut.lastIndexOf(","));
  return `${cut.slice(0, boundary > max * 0.65 ? boundary : cut.length).trimEnd()}…`;
}

/** Extracts a compact, faithful overview from supplied offer text; it never invents missing facts. */
export function summarizeOfferDescription(offer: {
  title: string; company?: string; contractType: "cdi" | "freelance" | "other";
  annualSalary?: number | null; dailyRate?: number | null;
  remoteMode: "full_remote" | "exceptional" | "hybrid" | "onsite" | "unknown";
  description?: string;
}) {
  const description = offer.description ?? "";
  const lines = (description ?? "")
    .replace(/\r/g, "")
    .replace(/https?:\/\/\S+/g, "")
    .split(/\n+/)
    .map(cleanLine)
    .filter(line => line.length >= 45 && !heading.test(line) && !boilerplate.test(line));
  if (!lines.length) {
    const contract = offer.contractType === "cdi" ? "CDI" : offer.contractType === "freelance" ? "Freelance" : "contrat à confirmer";
    const work = { full_remote: "full remote annoncé", exceptional: "présence ponctuelle annoncée", hybrid: "organisation hybride à confirmer", onsite: "présence sur site annoncée", unknown: "mode de travail à vérifier" }[offer.remoteMode];
    const pay = offer.annualSalary != null ? `${new Intl.NumberFormat("fr-FR").format(offer.annualSalary)} € brut/an` : offer.dailyRate != null ? `${new Intl.NumberFormat("fr-FR").format(offer.dailyRate)} € HT/jour` : "rémunération non communiquée";
    return `${offer.title}${offer.company ? ` chez ${offer.company}` : ""} · ${contract} · ${work} · ${pay}. Le texte reçu ne décrit pas les missions : le lien d’origine reste nécessaire.`;
  }

  const sentences = lines.flatMap(line => line.match(/[^.!?]+(?:[.!?]+|$)/g) ?? [line]).map(sentence => sentence.trim()).filter(sentence => sentence.length >= 45);
  const mission = sentences.find(sentence => missionFocus.test(sentence)) ?? sentences.find(sentence => missionCue.test(sentence)) ?? lines[0];
  return shorten(mission, 250);
}
