/** True only for explicit US/North-American eligibility limits; employer HQ alone is not enough. */
export function isNorthAmericaRestricted(job: { title: string; description?: string; onsiteCadence?: string }) {
  const text = `${job.title}\n${job.onsiteCadence ?? ""}\n${job.description ?? ""}`;
  return /\b(?:remote[\s|,–:-]*(?:u\.?s\.?a?\.?|united states(?: of america)?|north america)|(?:u\.?s\.?a?\.?|united states(?: of america)?|north america)\s+(?:only|based)|(?:only|based in)\s+(?:the\s+)?(?:u\.?s\.?a?\.?|united states(?: of america)?|north america)|(?:u\.?s\.?|united states)[- ]based|north america only)\b/i.test(text);
}
