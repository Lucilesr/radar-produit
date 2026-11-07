import { signalProgress } from "@/lib/signal-numbers";

export function SignalProgress({ value, max, label, tone = "neutral", className = "" }: { value: number; max: number; label: string; tone?: "neutral" | "energy" | "finished"; className?: string }) {
  const progress = signalProgress(value, max);
  return <div className={`signal-progress signal-progress-${tone} ${className}`} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={progress.max || 1} aria-valuenow={progress.value} aria-valuetext={`${progress.value} sur ${progress.max}`}>
    <span style={{ width: `${progress.percent}%` }} />
  </div>;
}
