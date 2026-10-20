export type EmployerOfferPreview = {
  provider: "Greenhouse" | "Ashby";
  title: string;
  company?: string;
  description: string;
  sourceUrl: string;
  applicationUrl?: string;
  publishedAt?: string;
  contentCoverage: "full" | "partial";
  language: "unknown" | "fr" | "en";
  remoteMode: "unknown" | "full_remote" | "hybrid" | "onsite";
};

type Target = { provider: EmployerOfferPreview["provider"]; url: string; board: string; jobId?: string };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function employerTarget(value: string): Target | null {
  try {
    const input = new URL(value);
    if (input.protocol !== "https:" || input.username || input.password || input.port) return null;
    if (["boards.greenhouse.io", "job-boards.greenhouse.io"].includes(input.hostname)) {
      const match = input.pathname.match(/^\/([a-zA-Z0-9_-]{1,100})\/jobs\/(\d{1,12})\/?$/);
      if (!match || input.searchParams.has("gh_src")) return null;
      const [, board, jobId] = match;
      return { provider: "Greenhouse", board, jobId, url: `https://job-boards.greenhouse.io/${board}/jobs/${jobId}` };
    }
    if (input.hostname === "jobs.ashbyhq.com") {
      const match = input.pathname.match(/^\/([a-zA-Z0-9_-]{1,100})\/([0-9a-f-]{36})\/?$/i);
      if (!match || !uuid.test(match[2])) return null;
      const [, board, jobId] = match;
      return { provider: "Ashby", board, jobId, url: `https://jobs.ashbyhq.com/${board}/${jobId}` };
    }
  } catch { /* Invalid URLs never become network destinations. */ }
  return null;
}

function plainText(value: unknown) {
  if (typeof value !== "string") return { text: "", contentCoverage: "partial" as const };
  const cleaned = value.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, " ")
    .replace(/<\/(?:p|div|li|h[1-6]|br)\s*>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/[ \t]+/g, " ").replace(/\n[ \t]+/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return { text: cleaned.slice(0, 12000), contentCoverage: cleaned.length > 12000 ? "partial" as const : "full" as const };
}

function text(value: unknown, max = 12000) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
function language(value: unknown): EmployerOfferPreview["language"] {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (/^(?:fr(?:[-_].*)?|french|français)$/.test(normalized)) return "fr";
  if (/^(?:en(?:[-_].*)?|english)$/.test(normalized)) return "en";
  return "unknown";
}
function date(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}
function providerUrl(value: unknown, provider: EmployerOfferPreview["provider"]) {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    const allowed = provider === "Greenhouse" ? ["boards.greenhouse.io", "job-boards.greenhouse.io"] : ["jobs.ashbyhq.com"];
    return url.protocol === "https:" && allowed.includes(url.hostname) && !url.username && !url.password && !url.port ? url.toString() : undefined;
  } catch { return undefined; }
}
async function readBounded(response: Response, maxBytes: number) {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) { await reader.cancel(); throw new Error("La réponse carrière dépasse la limite autorisée."); }
    chunks.push(value);
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(body);
}

export async function previewEmployerOffer(value: unknown, fetcher: typeof fetch = fetch): Promise<EmployerOfferPreview> {
  if (typeof value !== "string" || value.length > 1500) throw new Error("Lien carrière non valide.");
  const target = employerTarget(value);
  if (!target) throw new Error("Seuls les liens d’offre Greenhouse ou Ashby sont pris en charge.");
  const endpoint = target.provider === "Greenhouse"
    ? `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(target.board)}/jobs/${encodeURIComponent(target.jobId!)}?content=true`
    : `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(target.board)}`;
  const response = await fetcher(endpoint, { method: "GET", redirect: "error", signal: AbortSignal.timeout(10000), headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("La fiche carrière est indisponible ou n’est plus publiée.");
  const raw = await readBounded(response, 1_000_000);
  let data: Record<string, unknown> | null;
  try { data = record(JSON.parse(raw)); } catch { throw new Error("Réponse carrière illisible."); }
  if (!data) throw new Error("Réponse carrière illisible.");
  if (target.provider === "Greenhouse") {
    const id = String(data.id ?? "");
    const title = text(data.title, 180);
    const description = plainText(data.content);
    if (id !== target.jobId || !title || !description.text) throw new Error("La fiche reçue ne correspond pas à l’offre demandée.");
    return { provider: "Greenhouse", title, company: text(data.company_name, 160) || undefined, description: description.text, contentCoverage: description.contentCoverage,
      sourceUrl: providerUrl(data.absolute_url, "Greenhouse") ?? target.url, applicationUrl: providerUrl(data.absolute_url, "Greenhouse"),
      publishedAt: date(data.first_published), language: language(data.language), remoteMode: "unknown" };
  }
  const jobs = Array.isArray(data.jobs) ? data.jobs.map(record).filter((item): item is Record<string, unknown> => item !== null) : [];
  const job = jobs.find(item => String(item.id ?? "") === target.jobId && item.isListed !== false);
  const title = text(job?.title, 180);
  const description = plainText(job?.descriptionPlain || job?.descriptionHtml);
  if (!job || !title || !description.text) throw new Error("Cette fiche n’est plus publiée ou ne correspond pas au lien.");
  const workplace = String(job?.workplaceType ?? "").toLowerCase();
  const remoteMode = job?.isRemote === true || workplace === "remote" ? "full_remote" : workplace === "hybrid" ? "hybrid" : workplace === "onsite" ? "onsite" : "unknown";
  return { provider: "Ashby", title, description: description.text, contentCoverage: description.contentCoverage,
    sourceUrl: providerUrl(job?.jobUrl, "Ashby") ?? target.url, applicationUrl: providerUrl(job?.applyUrl, "Ashby"),
    publishedAt: date(job?.publishedAt), language: language(job?.language), remoteMode };
}
