import { ExternalLink } from "lucide-react";
import { discoveryQueries, searchUrl } from "@/lib/web-discovery";
import { HelpTooltip } from "@/components/help-tooltip";

export function WebDiscoveryPanel() {
  return <section className="glass-panel p-5 space-y-4" aria-labelledby="web-discovery-title">
    <div>
      <h2 id="web-discovery-title" className="source-heading">Recherche PO/PM en français</h2>
      <p className="mt-2 text-sm text-[#535768]">LinkedIn et Welcome to the Jungle · tous pays</p>
    </div>
    <div className="inline-help"><span>Ouvre une recherche publique. Radar ne lit ni ton compte LinkedIn ni les résultats à ta place.</span><HelpTooltip label="À propos de la recherche">Ces liens interrogent l’index public de Google ou Bing. Tu vérifies toi-même les résultats sur la plateforme source. Radar n’en collecte ni n’enregistre le contenu. Brave et les services payants ne sont pas utilisés.</HelpTooltip></div>
    <ul className="grid gap-3 sm:grid-cols-2">
      {discoveryQueries.map(query => <li key={query.id} className="rounded-xl border border-[#d0d4e4] p-4">
        <h3 className="font-semibold">{query.role}</h3><p className="mt-1 text-sm text-[#535768]">{query.source}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a className="secondary-button inline-flex items-center gap-2" href={searchUrl(query.expression, "Google")} target="_blank" rel="noopener noreferrer">Google <ExternalLink size={14} aria-hidden /></a>
          <a className="secondary-button inline-flex items-center gap-2" href={searchUrl(query.expression, "Bing")} target="_blank" rel="noopener noreferrer">Bing <ExternalLink size={14} aria-hidden /></a>
        </div>
      </li>)}
    </ul>
    <p className="text-sm text-[#535768]">Pour enregistrer une offre dans Radar, utilise son descriptif depuis la page carrière officielle de l’employeur ou son connecteur ATS public lorsqu’il existe.</p>
  </section>;
}
