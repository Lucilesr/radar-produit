function getAsset(name: string) {
  const label = name.toLocaleLowerCase();
  if (label.includes("linkedin")) return "linkedin";
  if (label.includes("collective")) return "collective";
  if (label.includes("malt")) return "malt";
  if (label.includes("welcome to the jungle")) return "welcome-to-the-jungle";
  if (label.includes("apec")) return "apec";
  if (label.includes("free-work") || label.includes("freework")) return "free-work";
  if (label.includes("indeed")) return "indeed";
  if (label.includes("hello") && label.includes("work")) return "hellowork";
  if (label.includes("we work remotely")) return "we-work-remotely";
  if (label.includes("wellfound")) return "wellfound";
  if (label.includes("himalayas")) return "himalayas";
  if (label.includes("remote") && label.includes("ok")) return "remote-ok";
  if (label.includes("remotive")) return "remotive";
  if (label.includes("freelancerepublik")) return "freelancerepublik";
  if (label.includes("mindquest")) return "mindquest";
  return null;
}

export function SourceLogo({ name, compact = false }: { name: string; compact?: boolean }) {
  const asset = getAsset(name);
  const className = compact ? "source-logo source-logo-compact" : "source-logo";
  if (!asset) return <img className={`${className} source-logo-fallback`} src="/source-logos/source-generic.svg" alt="" aria-hidden="true" />;
  return <img
    className={className}
    src={`/source-logos/${asset}.svg`}
    alt=""
    aria-hidden="true"
    onError={event => { event.currentTarget.src = "/source-logos/source-generic.svg"; }}
  />;
}
