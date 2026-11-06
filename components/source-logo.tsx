import { sourceLogoPath } from "@/lib/source-logos";

export function SourceLogo({ name, compact = false }: { name: string; compact?: boolean }) {
  const asset = sourceLogoPath(name);
  const className = compact ? "source-logo source-logo-compact" : "source-logo";
  return <img
    className={`${className}${asset.endsWith(".svg") ? "" : " source-logo-square"}`}
    src={asset}
    alt=""
    aria-hidden="true"
    onError={event => { event.currentTarget.src = "/source-logos/source-generic.svg"; }}
  />;
}
