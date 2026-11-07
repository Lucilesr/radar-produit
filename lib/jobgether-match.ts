/** Keep offers the user has already selected or acted on, even if criteria change. */
export function showJobgetherOffer(source: string, score: number, minimumScore: number, status?: string, reviewState?: string) {
  return source !== "Jobgether" || score >= minimumScore ||
    (status !== undefined && status !== "new") || reviewState === "selected" || reviewState === "later" || reviewState === "reopened";
}
