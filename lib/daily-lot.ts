import { isMysteryOffer } from "./fit";
import { awaitingDecision, inOpportunityView } from "./opportunity-views";
import { triageScore } from "./triage";
import type { JobRecord } from "./types";

/** Tri Q1: a short, finite batch of offers to sort each day instead of an endless list. */
export const DAILY_LOT_SIZE = 20;
/** Mystery offers may take up to this many places in the lot (Score v2 S4). */
export const DAILY_LOT_MYSTERY_SLOTS = 5;

export type StoredLot = { day: string; ids: string[] };
export type DailyLot = StoredLot & {
  /** Offers of the lot still to sort, best ranked first. */
  remaining: JobRecord[];
  triaged: number;
  size: number;
  /** Offers to examine that are not in the lot. */
  waiting: number;
};

const pad = (value: number) => String(value).padStart(2, "0");

/** Local calendar day of `now`, such as "2026-11-07". */
export function lotDay(now: number) {
  const date = new Date(now);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Best offers first: up to `mysterySlots` mystery offers at their rank, the others fill the lot. */
export function pickLot(toReview: readonly JobRecord[], now: number, size = DAILY_LOT_SIZE, mysterySlots = DAILY_LOT_MYSTERY_SLOTS) {
  if (size <= 0) return [];
  const ranked = [...toReview].sort((a, b) => triageScore(b, now) - triageScore(a, now) || a.id.localeCompare(b.id));
  const mysteries = new Set(ranked.filter(isMysteryOffer).slice(0, mysterySlots));
  const picked: JobRecord[] = [];
  let others = size - mysteries.size;
  for (const job of ranked) {
    if (picked.length >= size) break;
    if (mysteries.has(job)) picked.push(job);
    else if (!isMysteryOffer(job) && others > 0) { picked.push(job); others -= 1; }
  }
  // Fewer ordinary offers than places: the remaining mystery offers may fill the lot.
  for (const job of ranked) if (picked.length < size && !picked.includes(job)) picked.push(job);
  return picked;
}

/**
 * Lot of the day. It is chosen again as long as nothing in it was sorted (offers found by the
 * morning refresh still get in), then it is frozen: sorting an offer never brings a new one in,
 * so the counter only goes down. A lot smaller than the size is topped up with new offers.
 */
export function buildDailyLot(jobs: readonly JobRecord[], stored: StoredLot | null | undefined, now: number, size = DAILY_LOT_SIZE): DailyLot {
  const day = lotDay(now);
  const byId = new Map(jobs.map(job => [job.id, job]));
  // « Plus tard » and other decisions take an offer out of the lot; it stays in « À examiner ».
  const toReview = jobs.filter(job => awaitingDecision(job, now));
  const pending = (job: JobRecord | undefined) => !!job && awaitingDecision(job, now);
  const examined = jobs.filter(job => inOpportunityView(job, "to_review", now)).length;
  // Ids of another day, another account or a deleted offer are simply dropped.
  const kept = stored?.day === day ? [...new Set(stored.ids)].filter(id => byId.has(id)).slice(0, size) : [];
  const started = kept.some(id => !pending(byId.get(id)));
  let ids: string[];
  if (!started) ids = pickLot(toReview, now, size).map(job => job.id);
  else {
    const inLot = new Set(kept);
    ids = [...kept, ...pickLot(toReview.filter(job => !inLot.has(job.id)), now, size - kept.length).map(job => job.id)];
  }
  const remaining = ids.map(id => byId.get(id)).filter(pending) as JobRecord[];
  remaining.sort((a, b) => triageScore(b, now) - triageScore(a, now) || a.id.localeCompare(b.id));
  return { day, ids, remaining, triaged: ids.length - remaining.length, size: ids.length, waiting: examined - remaining.length };
}

/** "Plus que 3", "Plus qu’une", or the size of a lot not started yet. */
export function lotHeadline(lot: Pick<DailyLot, "remaining" | "triaged" | "size">) {
  const left = lot.remaining.length;
  if (!lot.size) return "Aucune offre à trier aujourd’hui";
  if (!left) return "Lot du jour bouclé";
  if (!lot.triaged) return `${left} offre${left > 1 ? "s" : ""} dans votre lot du jour`;
  return left === 1 ? "Plus qu’une offre" : `Plus que ${left} offres`;
}
