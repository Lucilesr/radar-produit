/** Orbite — the Signal mark, shared by the workspace and future illustrations. */
export function RadarMark({ className, watermark=false }: { className?: string; watermark?: boolean }) {
  const ink=watermark?"#ffffff":"currentColor";
  const stroke=watermark ? 0.45 : 1.8;
  return <svg className={className} viewBox="0 0 48 48" width={36} height={36} aria-hidden="true" focusable="false">
    {!watermark?<rect x="2" y="2" width="44" height="44" rx="7" fill="#e3edf2" />:null}
    <circle cx="24" cy="24" r="15.5" fill="none" stroke={ink} strokeWidth={stroke} strokeOpacity={watermark ? 0.22 : undefined}/>
    <path d="M30 15a11 11 0 1 0 4 13" fill="none" stroke={ink} strokeWidth={stroke} strokeOpacity={watermark ? 0.22 : undefined} strokeLinecap="round"/>
    <circle cx="24" cy="24" r={watermark?1.1:3.3} fill={ink} fillOpacity={watermark ? 0.3 : undefined}/>
    <path d="M24 24 35 13" fill="none" stroke={ink} strokeWidth={stroke} strokeOpacity={watermark ? 0.22 : undefined}/>
    <circle cx="35" cy="13" r={watermark?2.2:4} fill={watermark?"none":"var(--signal-citron)"} stroke={watermark?"var(--signal-citron)":ink} strokeOpacity={watermark ? 0.8 : undefined} strokeWidth={watermark ? 0.45 : 1.4}/>
  </svg>;
}
