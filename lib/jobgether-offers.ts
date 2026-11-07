import { z } from "zod";
import type { JobInput } from "./types";
import { parsePayRange, payMidpoint } from "./pay-range";

const jobSchema = z.object({
  id: z.string(), title: z.string(), company: z.string().nullish(), url: z.string().url(),
  location: z.string().nullish(), remote: z.string().nullish(), contractType: z.string().nullish(),
  salaryRange: z.string().nullish(), postedAt: z.string().nullish(),
});
const responseSchema = z.object({ jobs: z.array(jobSchema), pagination: z.object({ hasMore: z.boolean() }) });

export function parseJobgetherPage(value: unknown): { offers: JobInput[]; hasMore: boolean } {
  const page = responseSchema.parse(value);
  const offers: JobInput[] = [];
  for (const job of page.jobs) {
    const url = new URL(job.url);
    if (url.protocol !== "https:" || !["jobgether.com", "www.jobgether.com"].includes(url.hostname) || !url.pathname.startsWith("/offer/")) continue;
    const salary = job.salaryRange ? parsePayRange(job.salaryRange, "annual") : null;
    const published = job.postedAt ? new Date(job.postedAt) : null;
    offers.push({
      title: job.title, company: job.company?.trim() || undefined, source: "Jobgether",
      sourceUrl: url.toString(), applicationUrl: url.toString(),
      announcedLocation: job.location?.trim() || undefined,
      description: [job.location ? `Lieu annoncé : ${job.location}` : "", job.remote ? `Organisation annoncée : ${job.remote}` : ""].filter(Boolean).join(". "),
      contractType: /freelance|contract/i.test(job.contractType ?? "") ? "freelance" : "other",
      remoteMode: /full remote/i.test(job.remote ?? "") ? "full_remote" : /hybrid/i.test(job.remote ?? "") ? "hybrid" : "unknown",
      // A listing's location is not a guarantee that work from that country is permitted.
      language: "unknown",
      annualSalary: payMidpoint(salary), salaryMin: salary?.min ?? null, salaryMax: salary?.max ?? null,
      dailyRate: null, contentCoverage: "summary",
      publishedAt: published && !Number.isNaN(published.getTime()) ? published.toISOString() : undefined,
    });
  }
  return { offers, hasMore: page.pagination.hasMore };
}
