import type { JobInput } from "./types";
import { isNorthAmericaRestricted } from "./market-scope";

function unescape(value: string) {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&#(\d+);/g, (_, code) => { const n = Number(code); return n <= 0x10ffff ? String.fromCodePoint(n) : ""; })
    .replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ");
}
export function plainFeedText(value: string) { return unescape(value).replace(/<\s*(?:br|\/p|\/li|\/div|\/h[1-6])\s*\/?\s*>/gi, "\n").replace(/<[^>]*>/g, "").replace(/\n[ \t]*\n+/g, "\n\n").trim(); }
function tag(item: string, name: string) { return item.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i"))?.[1] ?? ""; }
export function parseWwrFeed(xml: string): JobInput[] {
  const offers: JobInput[] = [];
  for (const match of xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)) {
    const item = match[1]; const fullTitle = plainFeedText(tag(item, "title"));
    if (!/product\s*(?:owner|manager|builder|ops|lead)|head of product/i.test(fullTitle)) continue;
    const sourceUrl = unescape(tag(item, "link")).trim();
    try { const url = new URL(sourceUrl); if (url.hostname !== "weworkremotely.com" || !["https:", "http:"].includes(url.protocol)) continue; } catch { continue; }
    const separator = fullTitle.indexOf(":"); const company = separator > 0 ? fullTitle.slice(0, separator).trim() : undefined;
    const title = (separator > 0 ? fullTitle.slice(separator + 1) : fullTitle).trim();
    const description = plainFeedText(tag(item, "content:encoded") || tag(item, "description")).slice(0, 12000);
    if (isNorthAmericaRestricted({ title, description })) continue;
    const date = new Date(plainFeedText(tag(item, "pubDate")));
    offers.push({ title, company, source: "We Work Remotely", sourceUrl, applicationUrl: sourceUrl, description,
      contractType: /freelance|contractor|contract role/i.test(description) ? "freelance" : /full[- ]time|permanent/i.test(description) ? "cdi" : "other",
      remoteMode: "full_remote", language: "en", annualSalary: null, dailyRate: null,
      onsiteCadence: "Pays autorisés et fuseau de travail à vérifier dans la description",
      contentCoverage: "summary", publishedAt: Number.isNaN(date.getTime()) ? undefined : date.toISOString() });
  }
  return offers;
}
