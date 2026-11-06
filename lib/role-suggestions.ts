import { normalizeRoleTitles } from "./search-preferences";
import { foldTerm, searchedTerms } from "./search-tracks";
import type { JobRecord, SearchPreferences } from "./types";

/** Strip offer suffixes while keeping meaningful words such as Lead and full-stack. */
export function suggestedRoleTitle(title: string): string {
  const cleaned = title
    .replace(/\b(?:h\s*\/\s*f|f\s*\/\s*h|m\s*\/\s*f|f\s*\/\s*m)\b/gi, " ")
    .split(/\s+[-–—]\s*|\s*[-–—]\s+|[–—]|\(/, 1)[0]
    .replace(/\b(?:senior|sénior|junior)\b/giu, " ")
    .replace(/\s+/g, " ").replace(/^[\s,/|:]+|[\s,/|:]+$/g, "").trim();
  if (cleaned.length < 2 || cleaned.length > 80 || !/\p{L}/u.test(cleaned)) return "";
  return normalizeRoleTitles([cleaned])[0];
}

const roleKey = (title: string) => foldTerm(suggestedRoleTitle(title) || title.trim()).replace(/\s+/g, " ");

/** Jobs must be the current account's offers. No shared cache, storage or cross-account state. */
export function suggestedRoles(jobs: JobRecord[], preferences: SearchPreferences, dismissed: string[] = [], now = new Date()): Array<{ title: string; count: number }> {
  const end = now.getTime();
  if (!Number.isFinite(end)) return [];
  const start = end - 30 * 86400000;
  const excluded = new Set([
    ...searchedTerms(preferences),
    ...preferences.roles,
    ...(preferences.dismissedRoleSuggestions ?? []),
    ...dismissed,
  ].map(roleKey));
  const counts = new Map<string, { title: string; count: number }>();
  for (const job of jobs) {
    if (job.deletedAt) continue;
    const published = Date.parse(job.publishedAt ?? "");
    const date = Number.isFinite(published) ? published : Date.parse(job.createdAt ?? "");
    if (!Number.isFinite(date) || date < start || date > end) continue;
    const title = suggestedRoleTitle(job.title);
    if (!title) continue;
    const key = roleKey(title);
    if (excluded.has(key)) continue;
    const found = counts.get(key);
    if (found) found.count++; else counts.set(key, { title, count: 1 });
  }
  return [...counts.values()].filter(item => item.count >= 3)
    .sort((a, b) => b.count - a.count || foldTerm(a.title).localeCompare(foldTerm(b.title), "fr"))
    .slice(0, 3);
}
