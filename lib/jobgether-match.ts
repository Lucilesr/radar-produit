export const MIN_JOBGETHER_MATCH_SCORE = 55;

/** Keep offers the user has already selected or acted on, even if criteria change. */
export function showJobgetherOffer(source: string, score: number, status?: string, reviewState?: string) {
  return source !== "Jobgether" || score >= MIN_JOBGETHER_MATCH_SCORE ||
    (status !== undefined && status !== "new") || reviewState === "selected";
}
