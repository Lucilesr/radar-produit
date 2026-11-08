import { signalProgress } from "@/lib/signal-numbers";

export function SignalProgress({ value, max, label, tone = "neutral", className = "",segments }: { value: number; max: number; label: string; tone?: "neutral" | "energy" | "finished"; className?: string;segments?:readonly number[] }) {
  const progress = signalProgress(value, max);
  return <div className={`signal-progress signal-progress-${tone} ${className}${segments?.length?" is-segmented":""}`} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={progress.max || 1} aria-valuenow={progress.value} aria-valuetext={`${progress.value} sur ${progress.max}`}>
    {segments?.length?segments.map((end,index)=>{const start=segments[index-1]??0,percent=Math.min(100,Math.max(0,(progress.value-start)/Math.max(1,end-start)*100));return <span key={end} aria-hidden><span style={{width:`${percent}%`}}/></span>;}):<span style={{ width: `${progress.percent}%` }} />}
  </div>;
}
