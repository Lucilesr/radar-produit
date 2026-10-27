import { ExternalLink } from "lucide-react";
import { discoveryQueries, searchUrl } from "@/lib/web-discovery";
import { HelpTooltip } from "@/components/help-tooltip";
import { WorkspacePanelHeader } from "@/components/workspace-form";

export function WebDiscoveryPanel() {
  return <section className="signal-source-panel signal-web-discovery" aria-labelledby="web-discovery-title">
    <WorkspacePanelHeader id="web-discovery-title" title="Recherche PO/PM en français"/>
    <p className="signal-help">LinkedIn et Welcome to the Jungle · tous pays</p>
    <div className="inline-help"><span>Ouvre une recherche publique. Radar ne lit ni ton compte LinkedIn ni les résultats à ta place.</span><HelpTooltip label="À propos de la recherche">Ces liens interrogent l’index public de Google ou Bing. Tu vérifies toi-même les résultats sur la plateforme source. Radar n’en collecte ni n’enregistre le contenu. Brave et les services payants ne sont pas utilisés.</HelpTooltip></div>
    <ul className="signal-source-web-grid">
      {discoveryQueries.map(query => <li key={query.id}>
        <h3>{query.role}</h3><p className="signal-help">{query.source}</p>
        <div className="signal-source-web-actions">
          <a className="secondary-button" aria-label={`Google · ${query.role} · ${query.source}`} href={searchUrl(query.expression, "Google")} target="_blank" rel="noopener noreferrer">Google <ExternalLink size={14} aria-hidden /></a>
          <a className="secondary-button" aria-label={`Bing · ${query.role} · ${query.source}`} href={searchUrl(query.expression, "Bing")} target="_blank" rel="noopener noreferrer">Bing <ExternalLink size={14} aria-hidden /></a>
        </div>
      </li>)}
    </ul>
    <p className="signal-help">Pour enregistrer une offre dans Radar, utilise son descriptif depuis la page carrière officielle de l’employeur ou son connecteur ATS public lorsqu’il existe.</p>
  </section>;
}
