import type { ApprovedFacts, BriefOffer } from "./candidate-brief";

export type RecruiterQuestion = { id: string; question: string; characterLimit: number | null };
const common = new Set([
  "avec", "dans", "pour", "vous", "votre", "avez", "faire", "fait", "comment", "quelle", "quelles", "quel", "quels",
  "nous", "notre", "poste", "role", "experience", "experiences", "produit", "product", "manager", "owner", "projet",
  "the", "and", "your", "have", "this", "that", "what", "which", "would", "could", "about", "work", "please", "describe",
]);
function tokens(value: string) {
  return new Set((value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").match(/[a-z0-9]{4,}/g) ?? [])
    .filter(word => !common.has(word)));
}

// Narrow deterministic projection: no source quotes, personal notes or whole profile.
export function relevantFacts(facts: ApprovedFacts, offer: BriefOffer, question: RecruiterQuestion): ApprovedFacts {
  const q = tokens(question.question); const role = tokens(offer.title);
  return facts.map(fact => {
    const haystack = tokens([fact.title, fact.experience?.title ?? "", fact.context, fact.contribution, fact.result].join(" "));
    const questionHits = [...q].filter(word => haystack.has(word)).length;
    const roleHits = [...role].filter(word => haystack.has(word)).length;
    return { fact, score: questionHits * 3 + roleHits };
  }).filter(entry => entry.score > 0).sort((a, b) => b.score - a.score || a.fact.id.localeCompare(b.fact.id))
    .slice(0, 6).map(entry => entry.fact);
}

export async function generationContextDigest(value: { offer: BriefOffer; question: RecruiterQuestion; facts: ApprovedFacts }) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}
