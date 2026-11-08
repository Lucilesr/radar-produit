import { useId } from "react";
import { radarEchoes } from "@/lib/scan-presentation";

/** Decorative only. The adjacent text describes sync and its actual results. */
export function SignalRadar({ size = 96, scanning = false, blip = false, echoes = [], newIds = [] }: { size?: number; scanning?: boolean; blip?: boolean; echoes?: readonly string[]; newIds?: readonly string[] }) {
  const id = useId().replace(/:/g, "");
  const width = Math.max(48, Math.min(200, size));
  return <svg className={`signal-radar${scanning ? " is-scanning" : ""}${blip ? " has-blip" : ""}`} width={width} height={width} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
    <defs><linearGradient id={id}><stop stopColor="currentColor" stopOpacity="0"/><stop offset="1" stopColor="currentColor" stopOpacity=".3"/></linearGradient></defs>
    {[46, 31, 16].map(radius => <circle key={radius} cx="50" cy="50" r={radius} fill="none" stroke="currentColor" strokeWidth="1.5" opacity=".55"/>)}
    <path d="M50 4V96M4 50H96" stroke="currentColor" strokeWidth="1" opacity=".3"/>
    {scanning ? <g className="signal-radar-sweep"><path d="M50 50L50 4A46 46 0 0 1 96 50Z" fill={`url(#${id})`}/><path d="M50 50H96" stroke="currentColor" strokeWidth="2"/></g> : null}
    <circle cx="50" cy="50" r="3" fill="currentColor"/>
    {radarEchoes(echoes).map(echo => <circle key={echo.id} className={"signal-radar-echo" + (!scanning && newIds.includes(echo.id) ? " is-new" : "")} cx={echo.x} cy={echo.y} r="2.8" fill="currentColor"/>)}
    {blip ? <circle className="signal-radar-blip" cx="70" cy="30" r="4" fill="currentColor"/> : null}
  </svg>;
}
