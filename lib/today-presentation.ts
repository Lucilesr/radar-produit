import type { DailyLot } from "./daily-lot";
import type { NextStep } from "./next-steps";

/** Presentation only: retain the ranking and estimates of the actual queue. */
export function todayStepLabel(step: NextStep, lot?: DailyLot | null) {
  if (step.kind === "triage" && lot) {
    const count = lot.remaining.length;
    const close = lot.remaining.filter(job => job.fitLabel === "very_close").length;
    return `Trier votre lot du jour : ${count} offre${count !== 1 ? "s" : ""}${close ? `, dont ${close} très proche${close !== 1 ? "s" : ""}` : ""}`;
  }
  return step.label;
}
