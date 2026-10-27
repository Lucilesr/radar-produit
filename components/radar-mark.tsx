/** Orbite — the Signal mark, shared by the workspace and future illustrations. */
export function RadarMark({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 48 48" width={36} height={36} aria-hidden="true" focusable="false">
    <rect x="2" y="2" width="44" height="44" rx="7" fill="#e3edf2" />
    <circle cx="24" cy="24" r="15.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <path d="M30 15a11 11 0 1 0 4 13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <circle cx="24" cy="24" r="3.3" fill="currentColor" />
    <path d="M24 24 35 13" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <circle cx="35" cy="13" r="4" fill="var(--signal-citron)" stroke="currentColor" strokeWidth="1.4" />
  </svg>;
}
