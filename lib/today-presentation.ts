import { interviewThemes } from "./radar-reach";
import type { DailyLot } from "./daily-lot";
import type { NextStep } from "./next-steps";

/** Presentation only: retain the ranking and estimates of the actual queue. */
export function todayStepLabel(step: NextStep, lot?: DailyLot | null) {
  if (step.kind === "triage" && lot) {
    const count = lot.remaining.length;
    const close = lot.remaining.filter(job => job.fitLabel === "very_close").length;
    return `Trier votre lot du jour : ${count} offre${count !== 1 ? "s" : ""}${close ? `, dont ${close} très proche${close !== 1 ? "s" : ""}` : ""}`;
  }
  if (step.action.type === "story" && step.kind === "interview") {
    // Keep the selected theme from the queue, without choosing a different story.
    const selected = interviewThemes.find(theme => step.action.type === "story" && theme.id === step.action.theme);
    return selected ? `Préparer l’histoire « ${selected.label} » pour votre entretien` : step.label;
  }
  return step.label;
}
