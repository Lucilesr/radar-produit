import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { sourceSettings } from "@/db/schema";
import { sourceCatalog } from "./source-catalog";
import { parseWwrFeed } from "./rss-offers";
import { saveOffer } from "./job-store";
import { validSearchLink } from "./web-discovery";
import { parseJobgetherPage } from "./jobgether-offers";
import { readCandidateProfile } from "./profile-store";
import { searchPreferences } from "./search-preferences";
import { assessJob } from "./matching";
import { hasSourceConfiguration } from "./source-status";
import { showJobgetherOffer } from "./jobgether-match";
import { automaticSources, scanMatches, SourceReadingError, summarizeScan, type AutomaticSource, type SourceReading } from "./source-sync";

export async function listSourceSettings(userId: string) { const rows = await getDb().select().from(sourceSettings).where(eq(sourceSettings.userId, userId)); return rows.map(row => ({ source: row.source, ...JSON.parse(row.data), updatedAt: row.updatedAt })); }
export async function saveSourceSetting(userId: string, source: string, data: Record<string, unknown>, preservePause = true) {
  const record = { id: crypto.randomUUID(), userId, source, data: JSON.stringify(data), updatedAt: new Date().toISOString() };
  const fields = Object.entries(data).map(([key, value]) => {
    const path = `$.${key}`;
    const next = sql`json(${JSON.stringify(value ?? null)})`;
    return key === "state" && preservePause
      ? sql`${path}, CASE WHEN json_extract(${sourceSettings.data}, '$.state') = 'paused' THEN 'paused' ELSE ${next} END`
      : sql`${path}, ${next}`;
  });
  const [saved] = await getDb().insert(sourceSettings).values(record).onConflictDoUpdate({
    target: [sourceSettings.userId, sourceSettings.source],
    set: { data: sql`json_set(${sourceSettings.data}, ${sql.join(fields, sql`, `)})`, updatedAt: record.updatedAt },
  }).returning();
  return { source, ...JSON.parse(saved.data), updatedAt: saved.updatedAt };
}
/** Marks a source the person went through, so its visit rhythm restarts. */
export async function recordSourceVisit(userId: string, value: unknown) {
  const input = z.object({
    source: z.string().refine(name => sourceCatalog.some(source => source.name === name)),
    visited: z.literal(true),
  }).strict().parse(value);
  return saveSourceSetting(userId, input.source, { lastVisitedAt: new Date().toISOString() });
}

/** How often this source should be gone through, and whether Aujourd'hui reminds about it. */
export async function saveSourceVisitRhythm(userId: string, value: unknown) {
  const input = z.object({
    source: z.string().refine(name => sourceCatalog.some(source => source.name === name)),
    rhythm: z.literal(true),
    visitEveryDays: z.union([z.literal(1), z.literal(2), z.literal(7)]),
    remindInToday: z.boolean(),
  }).strict().parse(value);
  return saveSourceSetting(userId, input.source, { visitEveryDays: input.visitEveryDays, remindInToday: input.remindInToday });
}

export async function userSourceSetting(userId: string, value: unknown) {
  const input = z.object({
    source: z.string().refine(name => sourceCatalog.some(source => source.name === name)),
    // Accept older clients; these declarations no longer determine configuration.
    state: z.enum(["not_configured", "action_needed", "configured", "paused"]).optional(),
    paused: z.boolean().optional(), notes: z.string().max(1500).optional(),
    linkUrl: z.string().trim().max(2048).optional(), selected: z.boolean().optional(),
  }).strict().parse(value);
  if (input.linkUrl && !validSearchLink(input.linkUrl)) throw new Error("Lien invalide");
  const source = sourceCatalog.find(source => source.name === input.source)!;
  const previous = (await listSourceSettings(userId)).find(setting => setting.source === input.source);
  const fields = { ...(input.notes !== undefined ? { notes: input.notes } : {}), ...(input.linkUrl !== undefined ? { linkUrl: input.linkUrl } : {}), ...(input.selected !== undefined ? { selected: input.selected } : {}) };
  const canPause = source.mode === "api" || source.mode === "rss";
  const paused = canPause && (input.paused ?? input.state === "paused");
  const state = paused ? "paused" : hasSourceConfiguration({ ...previous, ...fields }, source.mode) ? "configured" : "not_configured";
  return saveSourceSetting(userId, input.source, { ...fields, state }, input.paused === undefined && input.state === undefined);
}
/** Retire la carte du suivi sans effacer ses réglages ni les offres associées. */
export async function removeUserSource(userId: string, value: unknown) {
  const input = z.object({
    source: z.string().refine(name => sourceCatalog.some(source => source.name === name && source.mode !== "manual")),
    confirmed: z.literal(true),
  }).strict().parse(value);
  return saveSourceSetting(userId, input.source, { selected: false });
}
export async function userSearchLinks(userId: string, value: unknown) {
  const input = z.object({
    source: z.enum(["LinkedIn Jobs", "Welcome to the Jungle"]),
    role: z.string().trim().min(2).max(80).refine(role => !["__proto__", "constructor", "prototype"].includes(role)),
    links: z.object({ Google: z.string().max(2048).optional(), Site: z.string().max(2048).optional() }).strict(),
  }).strict().parse(value);
  if (Object.values(input.links).some(url => url && !validSearchLink(url))) throw new Error("Lien invalide");
  const previous = (await listSourceSettings(userId)).find(setting => setting.source === input.source) as { searchLinks?: Record<string, unknown> } | undefined;
  const searchLinks = { ...(previous?.searchLinks ?? {}), [input.role]: input.links };
  return saveSourceSetting(userId, input.source, { searchLinks });
}
export async function recordCollectiveAlert(userId: string, value: unknown) {
  const alert = z.object({
    url: z.string().url().refine(url => {
      const parsed = new URL(url);
      return parsed.protocol === "https:" && parsed.hostname === "app.collective.work" && parsed.pathname === "/my-personal-space/jobs";
    }),
    notificationAt: z.string().datetime({ offset: true }),
    label: z.string().trim().min(1).max(120),
  }).strict().parse(value);
  const previous = (await listSourceSettings(userId)).find(source => source.source === "Collective") as { latestAlert?: typeof alert } | undefined;
  if (previous?.latestAlert && Date.parse(previous.latestAlert.notificationAt) > Date.parse(alert.notificationAt)) return previous;
  return saveSourceSetting(userId, "Collective", { latestAlert: alert, state: "configured", verification: "Alerte email reçue ; annonces individuelles à vérifier sur Collective" });
}
export async function syncAuthorizedFeed(userId: string, signal = AbortSignal.timeout(40000)) {
  const previous = (await listSourceSettings(userId)).find(source => source.source === "We Work Remotely");
  if (previous?.selected === false || previous?.state === "paused") return { paused: true, imported: 0, deduplicated: 0 };
  if (previous?.lastSyncedAt && Date.now() - Date.parse(previous.lastSyncedAt) < 15 * 60 * 1000) return { cached: true, imported: 0, deduplicated: 0, lastSyncedAt: previous.lastSyncedAt };
  let imported=0,deduplicated=0,total=0; const matchedIds=new Set<string>();
  try {
    signal.throwIfAborted();
    const response = await fetch("https://weworkremotely.com/categories/remote-product-jobs.rss", { signal: AbortSignal.any([signal,AbortSignal.timeout(15000)]), headers: { Accept: "application/rss+xml, application/xml" } });
    if (!response.ok) throw new Error("Flux temporairement indisponible");
    const text = await response.text(); if (text.length > 2_000_000) throw new Error("Flux trop volumineux");
    const offers = parseWwrFeed(text).slice(0, 40); total = offers.length;
    for (const offer of offers) { signal.throwIfAborted(); const result = await saveOffer(userId, offer); result.deduplicated ? deduplicated++ : imported++; if(scanMatches(result.job))matchedIds.add(result.job.id); }
    const lastSyncedAt = new Date().toISOString(); await saveSourceSetting(userId, "We Work Remotely", { state: "configured", verification: "Flux public autorisé", lastAttemptAt: lastSyncedAt, lastSyncedAt, health: "active", failureCount: 0, error: null, lastCount: offers.length });
    return { imported, deduplicated, total, matchedIds:[...matchedIds], lastSyncedAt };
  } catch { const failureCount = (typeof previous?.failureCount === "number" ? previous.failureCount : 0) + 1; await saveSourceSetting(userId, "We Work Remotely", { lastAttemptAt: new Date().toISOString(), failureCount, health: failureCount >= 2 ? "degraded" : "retrying", error: failureCount >= 2 ? "Flux indisponible depuis plusieurs tentatives. Radar réessaiera ; vos offres restent conservées." : "Lecture du flux non confirmée. Nouvel essai prévu." }); throw new SourceReadingError({source:"We Work Remotely",state:"error",ok:false,total,imported,deduplicated,matchedIds:[...matchedIds],error:"Flux non disponible. Réessayez plus tard."}); }
}

/** One bounded search per saved role, two pages at most. Jobgether asks API clients to cache and avoid bulk crawling. */
export async function syncJobgetherFeed(userId: string, signal = AbortSignal.timeout(40000)) {
  const previous = (await listSourceSettings(userId)).find(source => source.source === "Jobgether");
  if (!previous || previous.selected !== true || previous.state === "paused") return { paused: true, imported: 0, deduplicated: 0 };
  const search = searchPreferences((await readCandidateProfile(userId))?.searchPreferences);
  const criteria = JSON.stringify({ roles: search.roles, contracts: search.contracts, remote: search.remote, minimumMatchScore: search.minimumMatchScore });
  if (previous.nextRetryAt && Date.now() < Date.parse(previous.nextRetryAt))
    return { cached: true, imported: 0, deduplicated: 0, nextRetryAt: previous.nextRetryAt };
  if (previous.lastSyncedAt && previous.criteria === criteria && Date.now() - Date.parse(previous.lastSyncedAt) < 20 * 60 * 60 * 1000)
    return { cached: true, imported: 0, deduplicated: 0, lastSyncedAt: previous.lastSyncedAt };
  const now = new Date().toISOString();
  let imported = 0, deduplicated = 0, total = 0, nextRetryAt: string | null = null;
  const matchedIds=new Set<string>();
  try {
    const pagesPerRole = Math.min(2, Math.max(1, Math.floor(12 / search.roles.length)));
    for (const role of search.roles) {
      for (let page = 1; page <= pagesPerRole; page++) {
        signal.throwIfAborted();
        const url = new URL("https://jobgether.com/api/v1/jobs");
        url.searchParams.set("keyword", role); url.searchParams.set("sort", "date");
        url.searchParams.set("limit", "25"); url.searchParams.set("page", String(page));
        if (search.contracts.every(contract => contract !== "cdd" && contract !== "part_time"))
          url.searchParams.set("contractType", [...new Set(search.contracts.map(contract => contract === "freelance" || contract === "portage" ? "freelance" : "full-time"))].join(","));
        if (search.remote === "full_remote") url.searchParams.set("remoteType", "full-remote");
        else url.searchParams.set("includeHybrid", "true");
        const response = await fetch(url, { signal: AbortSignal.any([signal,AbortSignal.timeout(15000)]), headers: { Accept: "application/json" } });
        if (!response.ok) {
          if (response.status === 429) {
            const retry = response.headers.get("Retry-After");
            const seconds = retry && /^\d+$/.test(retry) ? Number(retry) : null;
            const until = seconds !== null ? Date.now() + seconds * 1000 : retry ? Date.parse(retry) : NaN;
            const safeUntil = Number.isFinite(until) && until > Date.now() ? Math.min(until, Date.now() + 7 * 24 * 60 * 60 * 1000) : Date.now() + 60 * 60 * 1000;
            nextRetryAt = new Date(safeUntil).toISOString();
          }
          throw new Error(response.status === 429 ? "Limite temporaire atteinte" : response.status === 404 || response.status === 410 ? "API Jobgether indisponible ou modifiée" : `API Jobgether : erreur ${response.status}`);
        }
        const body = await response.text();
        if (body.length > 600_000) throw new Error("Réponse Jobgether trop volumineuse");
        const result = parseJobgetherPage(JSON.parse(body));
        total+=result.offers.length;
        for (const offer of result.offers) {
          signal.throwIfAborted();
          if (!showJobgetherOffer(offer.source, assessJob(offer, search).score, search.minimumMatchScore)) continue;
          const saved = await saveOffer(userId, offer);
          saved.deduplicated ? deduplicated++ : imported++;
          if(scanMatches(saved.job))matchedIds.add(saved.job.id);
        }
        if (!result.hasMore) break;
      }
    }
    await saveSourceSetting(userId, "Jobgether", { state: "configured", lastAttemptAt: now, lastSyncedAt: now, criteria, error: null, failureCount: 0, health: "active", nextRetryAt: null, lastCount: total });
    return { imported, deduplicated, total, matchedIds:[...matchedIds], lastSyncedAt: now };
  } catch (problem) {
    const failureCount = (typeof previous.failureCount === "number" ? previous.failureCount : 0) + 1;
    const formatChanged = problem instanceof z.ZodError || problem instanceof SyntaxError;
    const reason = formatChanged ? "Format de réponse Jobgether modifié" : problem instanceof Error ? problem.message : "Réponse non reconnue";
    const incompatible = formatChanged || /API Jobgether indisponible ou modifiée|Réponse non reconnue/.test(reason);
    const alert = incompatible || failureCount >= 2;
    await saveSourceSetting(userId, "Jobgether", { lastAttemptAt: now, failureCount, health: alert ? "degraded" : "retrying", nextRetryAt, error: alert ? `Collecte interrompue : ${reason}. Aucune action requise pour le moment ; Radar réessaiera.` : "Collecte temporairement indisponible ; nouvel essai automatique prévu." });
    throw new SourceReadingError({source:"Jobgether",state:"error",ok:false,total,imported,deduplicated,matchedIds:[...matchedIds],error:signal.aborted?"Le délai de lecture est dépassé. Réessayez.":incompatible?"Le format de cette source a changé. Vos offres existantes restent conservées.":"Cette source est momentanément indisponible. Réessayez."});
  }
}

export async function syncAuthorizedFeeds(userId: string, requested?: AutomaticSource) {
  const signal=AbortSignal.timeout(40000);
  const names=requested?[requested]:[...automaticSources];
  const results=await Promise.allSettled(names.map(source=>source==="We Work Remotely"?syncAuthorizedFeed(userId,signal):syncJobgetherFeed(userId,signal)));
  const readings:SourceReading[]=results.map((result,index)=>{
    const source=names[index];
    if(result.status==="rejected")return result.reason instanceof SourceReadingError?result.reason.reading:{source,state:"error",ok:false,total:0,imported:0,deduplicated:0,matchedIds:[],error:"Lecture de la source non confirmée."};
    const value=result.value;
    if("nextRetryAt" in value&&typeof value.nextRetryAt==="string")return {source,state:"error",ok:false,total:0,imported:0,deduplicated:0,matchedIds:[],retryAt:value.nextRetryAt,error:"Cette source demande d’attendre avant le prochain essai. Vos offres restent conservées."};
    return {source,state:"paused" in value?"paused":"cached" in value?"cached":"ok",ok:true,total:"total" in value?value.total??0:0,imported:value.imported,deduplicated:value.deduplicated,matchedIds:"matchedIds" in value?value.matchedIds??[]:[],lastSyncedAt:"lastSyncedAt" in value?value.lastSyncedAt:undefined};
  });
  return summarizeScan(readings,new Date().toISOString());
}
