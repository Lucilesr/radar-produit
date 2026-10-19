// Pure domain contracts. No offer, interview, private note or model dependency.
export type Provenance = { type: "document" | "legacy_profile" | "manual"; documentId?: string; name: string; page?: number; line?: number; quote: string; field?: string };
export type ReviewPoint = { id: string; question: string; decision: "pending" | "confirmed" | "excluded"; answer: string };
export type ItemData = { title: string; organization: string; role: string; period: string; context: string; contribution: string; result: string; claimKey: string; provenance: Provenance[]; reviewModel?: 1; reviewPoints?: ReviewPoint[]; disposition?: { reason: "hidden" | "duplicate"; targetId?: string; targetTitle?: string } };
export type ExperienceItem = { id: string; kind: "experience" | "fact"; parentId: string | null; data: ItemData; validation: "proposed" | "approved" | "rejected" | "superseded"; applicationAllowed: boolean; applicationConsent?: "pending" | "granted" | "declined"; publicProfileAllowed: boolean; version: number; createdAt: string; updatedAt: string };
export type ExperienceConflict = { id: string; leftId: string; rightId: string; reason: string; state: string; resolution: string | null };
export function effectiveApplicationConsent(consent: ExperienceItem["applicationConsent"], allowed: boolean): "pending" | "granted" | "declined" {
  // Before this field existed, the explicit application_allowed flag was the recorded permission.
  return allowed ? "granted" : consent === "declined" ? "declined" : "pending";
}
export type ExtractionPage = { page: number; text: string };
export type Proposal = { key: string; parentKey: string | null; kind: ExperienceItem["kind"]; data: ItemData };
export const emptyData = (): ItemData => ({ title: "", organization: "", role: "", period: "", context: "", contribution: "", result: "", claimKey: "", provenance: [] });
export type ReviewIssue = { itemId: string; title: string; field: "context" | "contribution" | "result" | "reviewPoints"; start: number; end: number; quote: string };
/** Legacy import adapter only. Decisions subsequently live in structured fields, never in prose. */
export function structuredReview(data: ItemData): ItemData {
  if (data.reviewModel === 1) return data;
  const next: ItemData = { ...data, reviewModel: 1, reviewPoints: [...(data.reviewPoints || [])] };
  const marker = /non confirm[ée]|source (?:est )?introuvable|à confirmer/i;
  for (const field of ["context", "contribution", "result"] as const) {
    const passages = contextPassages(data[field]);
    for (const p of [...passages].reverse()) if (marker.test(p.text)) {
      if (!next.reviewPoints!.some(q => q.question === p.text || q.question.includes(p.text))) next.reviewPoints!.unshift({id:`legacy-${field}-${p.start}`,question:p.text,decision:"pending",answer:""});
      next[field] = next[field].slice(0,p.start) + next[field].slice(p.end);
    }
    next[field] = next[field].trim();
  }
  return next;
}
/** Same actionable validation diagnostics in the editor and on the server. */
export function reviewIssues(item: ExperienceItem): ReviewIssue[] {
  if (item.data.reviewModel === 1) return (item.data.reviewPoints || []).flatMap((q,n) => q.decision === "pending" || q.decision === "confirmed" && !q.answer.trim() ? [{itemId:item.id,title:detailHeading(item),field:"reviewPoints" as const,start:n,end:n,quote:q.question}] : []);
  return (["context", "contribution", "result"] as const).flatMap(field => {
    const text = item.data[field];
    if (field === "context" && !text.trim()) return [{ itemId: item.id, title: detailHeading(item), field, start: 0, end: 0, quote: "Description vide" }];
    return Array.from(text.matchAll(/non confirm[ée]|source (?:est )?introuvable|à confirmer/gi), match => ({ itemId: item.id, title: detailHeading(item), field, start: match.index!, end: match.index! + match[0].length, quote: match[0] }));
  });
}
export class ReviewBlockedError extends Error {
  constructor(public issues: ReviewIssue[]) { super("Une incertitude ou une description vide empêche la validation. Ouvrez le passage indiqué pour le préciser ; ne supprimez pas une limite réelle simplement pour valider."); }
}
/** Keep exact whitespace and offsets: editing one passage never rebuilds the others. */
export function contextPassages(text: string) {
  return Array.from(text.matchAll(/[^\r\n]+(?:\r?\n(?![ \t]*\r?\n)[^\r\n]+)*/g), match => ({ start: match.index!, end: match.index! + match[0].length, text: match[0] }));
}
export function replaceContextPassage(data: ItemData, start: number, end: number, replacement: string): ItemData {
  const before = data.context.slice(start, end);
  if (start < 0 || end < start || end > data.context.length) throw new Error("Passage périmé : rouvrez le bloc.");
  const next = { ...data, context: data.context.slice(0, start) + replacement + data.context.slice(end) };
  // Only synchronize an exact copy generated from the explicitly labelled source paragraph.
  for (const [field, label] of [["contribution", "Son rôle"], ["result", "Le résultat"]] as const) {
    const prefix = `**${label}.**`;
    if (before.startsWith(prefix) && before.slice(prefix.length).trim() === data[field].trim() && replacement.startsWith(prefix)) next[field] = replacement.slice(prefix.length).trim();
  }
  return next;
}
export function replaceDocumentedField(data: ItemData, field: "contribution" | "result", value: string): ItemData {
  const prefix = field === "contribution" ? "**Son rôle.**" : "**Le résultat.**";
  const copies = contextPassages(data.context).filter(p => p.text.startsWith(prefix) && p.text.slice(prefix.length).trim() === data[field].trim());
  const next = { ...data, [field]: value };
  if (copies.length === 1) { const p = copies[0]; next.context = data.context.slice(0,p.start) + prefix + " " + value + data.context.slice(p.end); }
  return next;
}
const clean = (s: string) => s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

/** Follow the visible reading order. Hidden items and their children never count as pending. */
export function nextReviewTarget(items: ExperienceItem[], order: string[], completed: string[]): string | null {
  const pending = order.filter(id => {const item=items.find(i=>i.id===id);return item?.validation==="proposed" && (!item.parentId || items.find(p=>p.id===item.parentId)?.validation!=="rejected");});
  const last=Math.max(-1,...completed.map(id=>order.indexOf(id)));
  return pending.find(id=>order.indexOf(id)>last) || pending[0] || null;
}

// A document is a changing reference, not another set of experiences to validate.
// Manual additions stay visible; other document versions are retained as history.
export function currentItems(items: ExperienceItem[], documentId?: string | null) {
  const newerParsers = new Set(items.filter(i => i.id.includes(":segments-v2:")).flatMap(i => i.data.provenance.filter(p => p.documentId).map(p => p.documentId)));
  return items.filter(i => i.validation !== "superseded" && !(i.id.includes(":segments-v1:") && i.data.provenance.some(p => newerParsers.has(p.documentId))) && (!documentId || !i.data.provenance.some(p => p.type === "document") || i.data.provenance.some(p => p.documentId === documentId)));
}
export function itemStatus(item: ExperienceItem, parent?: ExperienceItem) {
  if(item.kind === "fact" && parent?.validation === "rejected" && item.validation !== "rejected") return `Masqué avec l’expérience « ${parent.data.organization || parent.data.title} »`;
  if (item.validation === "rejected") return item.data.disposition?.reason === "duplicate"
    ? `Doublon de « ${item.data.disposition.targetTitle || "bloc conservé"} »`
    : item.data.disposition?.reason === "hidden" ? "Masqué — restaurable" : "Masqué précédemment — motif non renseigné";
  return { proposed: "À relire", approved: "Validé", superseded: "Ancienne version remplacée" }[item.validation];
}
export function sectionType(item: ExperienceItem): "experience" | "overview" | "knowledge" {
  const title = item.data.title.replace(/^\d+[.)]\s*/, "");
  if (/^(?:Parcours à répartir|Parcours en un coup d|Résumé|Introduction)/i.test(title)) return "overview";
  if (/^(?:COMPÉTENCES|COMPETENCES|SKILLS|FORMATION|EDUCATION|LANGUES|LANGUAGES)\b/i.test(title)) return "knowledge";
  return "experience";
}
export function experienceHeading(item: ExperienceItem) {
  const match = /^(.*?)\s+[—–]\s+(.+?)(?:\s+\(([^)]+)\))?$/.exec(item.data.title);
  return { organization: item.data.organization || match?.[1] || item.data.title, role: item.data.role || match?.[2] || "", period: item.data.period || match?.[3] || "" };
}
export function isContextOnly(item: ExperienceItem) {
  return item.kind === "fact" && (/^###\s+(?:Contexte|L’entreprise|Le produit)\s*$/im.test(item.data.context) || (item.data.context.length < 500 && !/^###|\*\*/m.test(item.data.context) && !/\b(?:alternance|responsable|cheffe?|gestion|pilotage|recette|backlog)\b/i.test(item.data.context) && !item.data.contribution && !item.data.result && /^(?:ESN\b|Agence\b|Entreprise\b)/i.test(item.data.context.trim())));
}
export function isSensitiveDetail(item: ExperienceItem) {
  if (item.data.reviewModel === 1) return /^(?:###\s*)?Raison du départ/im.test(item.data.context) || reviewIssues(item).length > 0;
  return /^(?:###\s*)?(?:Raison du départ|Non confirmé)/im.test(item.data.context) || /non confirm[ée]|à confirmer/i.test(item.data.context + " " + item.data.contribution + " " + item.data.result);
}
export function detailHeading(item: ExperienceItem) {
  const heading = /^###\s+(?:\d+\.\d+\s+)?(.+)/m.exec(item.data.context)?.[1];
  // A paragraph is the content, not a second, truncated copy of the title.
  return heading || (item.data.context.startsWith("**Le produit") ? "Produit, contributions et résultats" : item.data.title.length > 100 ? "Détails de la mission" : item.data.title);
}

/** Conservative segmentation, not an assertion of personal contribution. No facts from offers. */
export function proposeDocument(documentId: string, name: string, pages: ExtractionPage[]): Proposal[] {
  const proposals: Proposal[] = []; let group: Proposal | undefined; let count = 0;
  const groupFor = (title: string, page: number, line: number, quote: string, role = "", period = "", organization = "") => {
    group = { key: `group-${count++}`, parentKey: null, kind: "experience", data: { ...emptyData(), title:title.slice(0,180), organization, role, period, context: title, provenance: [{ type: "document", documentId, name, page, line, quote }] } };
    proposals.push(group);
  };
  for (const page of pages) {
    const markdown = /\.md$/i.test(name);
    const lines = page.text.split("\n"); let buffer: string[] = []; let start = 1;
    const flush = () => {
      const text = buffer.join("\n").trim(); buffer = [];
      if (text.length < 18) return;
      if (!group) groupFor(`Parcours à répartir — ${name}`, page.page, start, text.slice(0, 200));
      // Bounded chunks retain source verbatim; no silent truncation of an extraction.
      for (let offset = 0; offset < text.length; offset += 5000) {
        const quote = text.slice(offset, offset + 5000);
        const contribution = /\*\*Son rôle\.\*\*\s*([\s\S]*?)(?=\n\n\*\*|$)/i.exec(quote)?.[1] ?? "";
        const result = /\*\*Le résultat\.\*\*\s*([\s\S]*?)(?=\n\n\*\*|$)/i.exec(quote)?.[1] ?? "";
        proposals.push({ key: `fact-${count++}`, parentKey: group!.key, kind: "fact", data: { ...emptyData(), title: quote.replace(/[#*_]/g, "").split("\n")[0].slice(0, 160), context: quote, contribution, result, provenance: [{ type: "document", documentId, name, page: page.page, line: start, quote }] } });
      }
    };
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const md = /^##\s+(?:\d+[.)]\s*)?(.+)/.exec(line);
      const roleDate = /^(.*?)\s+((?:\d{2}\/)?20\d{2}\s*[–—-]\s*(?:(?:\d{2}\/)?20\d{2}|présent|present|aujourd’hui)).*$/i.exec(line);
      if (md) { flush(); const title = md[1]; const org = title.split(/\s+[—–]|\s+\(/)[0].trim(); const metadata=/^(.*?)\s+[—–]\s+(.+?)(?:\s+\(([^)]+)\))?$/.exec(title); groupFor(title, page.page, i + 1, line, metadata?.[2]||"", metadata?.[3]||"", org); }
      else if (!markdown && roleDate && /^(?:Product|Cheffe?|Project|Responsable|Customer)/i.test(roleDate[1])) {
        flush(); let next=i+1; while(next<lines.length && !lines[next].trim())next++;
        const employer=(lines[next]??"").trim();
        groupFor(`${employer || "Expérience à préciser"} — ${roleDate[1]}`, page.page, i+1, line+"\n"+employer, roleDate[1], roleDate[2], employer.split(/[·|/]/)[0].trim());
        i=employer?next:i;
      }
      else if(!markdown && /^(?:FORMATION|EDUCATION|COMPÉTENCES|SKILLS|LANGUES|LANGUAGES)\b/i.test(line)) {flush();groupFor(line,page.page,i+1,line);}
      else if (/^###\s/.test(line)) { flush(); start = i + 1; buffer.push(line); }
      else if (!line && !markdown && buffer.join("\n").trim().length>=18) { flush(); start = i + 1; }
      else { if (!buffer.length) start = i + 1; buffer.push(lines[i]); }
    }
    flush();
  }
  return proposals;
}

export function possibleConflict(a: ExperienceItem, b: ExperienceItem): string | null {
  if ([a.validation,b.validation].some(v=>v==="rejected"||v==="superseded")) return null;
  if (a.kind === "experience" && b.kind === "experience" && clean(a.data.organization) && clean(a.data.organization) === clean(b.data.organization)) {
    if (a.data.period && b.data.period && clean(a.data.period) !== clean(b.data.period)) return "Périodes différentes pour une même organisation : à comparer (missions distinctes possibles).";
    if (a.data.role && b.data.role && clean(a.data.role) !== clean(b.data.role)) return "Intitulés différents pour une même organisation : traduction ou divergence à préciser.";
    const sourceA = a.data.provenance.find(p => p.type === "document")?.documentId;
    const sourceB = b.data.provenance.find(p => p.type === "document")?.documentId;
    if(sourceA && sourceB && sourceA !== sourceB) return "Même organisation décrite dans deux documents : comparer les contributions, chiffres et limites des faits rattachés avant réutilisation. Ce rapprochement n’affirme pas qu’il y a une contradiction.";
  }
  if (a.kind === "fact" && b.kind === "fact" && a.parentId === b.parentId && a.data.claimKey && clean(a.data.claimKey) === clean(b.data.claimKey) && clean(a.data.context + a.data.result) !== clean(b.data.context + b.data.result)) return "Deux versions d’un même sujet : arbitrage nécessaire.";
  return null;
}

export function minimalApprovedFacts(items: ExperienceItem[], conflicts: ExperienceConflict[], purpose: "application" | "public_profile", ids?: string[]) {
  const blocked = new Set(conflicts.filter(c => c.state === "open").flatMap(c => [c.leftId, c.rightId]));
  const permitted = (i: ExperienceItem) => i.validation === "approved" && !blocked.has(i.id) && !(i.data.reviewModel===1&&reviewIssues(i).length) && (purpose === "application" ? i.applicationAllowed : i.publicProfileAllowed);
  return items.filter(i => i.kind === "fact" && permitted(i) && (!ids || ids.includes(i.id)) && (!i.parentId || items.some(p => p.id === i.parentId && permitted(p)))).map(i => {
    const parent = items.find(p => p.id === i.parentId);
    const title=(i.data.reviewPoints||[]).some(q=>clean(q.question).includes(clean(i.data.title)))?"Réalisation documentée":i.data.title;
    return { id: i.id, version: i.version, title, context: [i.data.context,...(i.data.reviewPoints||[]).filter(q=>q.decision==="confirmed").map(q=>q.answer)].filter(Boolean).join("\n\n"), contribution: i.data.contribution, result: i.data.result,
      experience: parent ? { id: parent.id, version: parent.version, title: parent.data.title, ...experienceHeading(parent) } : null };
  }).filter(i=>!!(i.context.trim()||i.contribution.trim()||i.result.trim()));
}

export function revisedItem(item: ExperienceItem, patch: Partial<ItemData>, permissions?: { applicationAllowed: boolean; publicProfileAllowed: boolean }): ExperienceItem {
  const data = { ...item.data, ...patch, provenance: item.data.provenance }; // Original provenance is immutable.
  const changed = JSON.stringify(data) !== JSON.stringify(item.data);
  return { ...item, data, ...(changed ? { applicationAllowed:false, applicationConsent:"pending" as const, publicProfileAllowed:false } : permissions ?? {}), validation: changed ? "proposed" : item.validation, version: item.version + 1, updatedAt: new Date().toISOString() };
}
