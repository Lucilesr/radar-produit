import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { sourceSettings } from "@/db/schema";
import { sourceCatalog } from "./source-catalog";
import { parseWwrFeed } from "./rss-offers";
import { saveOffer } from "./job-store";

export async function listSourceSettings(userId: string) { const rows = await getDb().select().from(sourceSettings).where(eq(sourceSettings.userId, userId)); return rows.map(row => ({ source: row.source, ...JSON.parse(row.data), updatedAt: row.updatedAt })); }
export async function saveSourceSetting(userId: string, source: string, data: Record<string, unknown>) {
  const db = getDb(); const [existing] = await db.select().from(sourceSettings).where(and(eq(sourceSettings.userId, userId), eq(sourceSettings.source, source))).limit(1);
  const merged = { ...(existing ? JSON.parse(existing.data) : {}), ...data };
  const record = { id: existing?.id ?? crypto.randomUUID(), userId, source, data: JSON.stringify(merged), updatedAt: new Date().toISOString() };
  await db.insert(sourceSettings).values(record).onConflictDoUpdate({ target: [sourceSettings.userId, sourceSettings.source], set: { data: record.data, updatedAt: record.updatedAt } });
  return { source, ...merged, updatedAt: record.updatedAt };
}
export async function userSourceSetting(userId: string, value: unknown) {
  const input = z.object({ source: z.string().refine(name => sourceCatalog.some(source => source.name === name)), state: z.enum(["not_configured", "action_needed", "configured", "paused"]), notes: z.string().max(1500).default("") }).strict().parse(value);
  return saveSourceSetting(userId, input.source, { state: input.state, notes: input.notes, verification: "Déclarée dans le Radar" });
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
  return saveSourceSetting(userId, "Collective", { latestAlert: alert, verification: "Alerte email reçue ; annonces individuelles à vérifier sur Collective" });
}
export async function syncAuthorizedFeed(userId: string) {
  const previous = (await listSourceSettings(userId)).find(source => source.source === "We Work Remotely");
  if (previous?.state === "paused") return { paused: true, imported: 0, deduplicated: 0 };
  if (previous?.lastSyncedAt && Date.now() - Date.parse(previous.lastSyncedAt) < 15 * 60 * 1000) return { cached: true, imported: 0, deduplicated: 0, lastSyncedAt: previous.lastSyncedAt };
  try {
    const response = await fetch("https://weworkremotely.com/categories/remote-product-jobs.rss", { signal: AbortSignal.timeout(15000), headers: { Accept: "application/rss+xml, application/xml" } });
    if (!response.ok) throw new Error("Flux temporairement indisponible");
    const text = await response.text(); if (text.length > 2_000_000) throw new Error("Flux trop volumineux");
    const offers = parseWwrFeed(text).slice(0, 40); let imported = 0; let deduplicated = 0;
    for (const offer of offers) { const result = await saveOffer(userId, offer); result.deduplicated ? deduplicated++ : imported++; }
    const lastSyncedAt = new Date().toISOString(); await saveSourceSetting(userId, "We Work Remotely", { state: "configured", verification: "Flux public autorisé", lastSyncedAt, error: null, lastCount: offers.length });
    return { imported, deduplicated, total: offers.length, lastSyncedAt };
  } catch { await saveSourceSetting(userId, "We Work Remotely", { error: "Lecture du flux non confirmée. Vos offres existantes restent conservées." }); throw new Error("Flux non disponible. Réessayez plus tard."); }
}
