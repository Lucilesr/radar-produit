"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { discoveryQueriesForRoles, defaultSearchLinks, validSearchLink, type SearchLinks } from "@/lib/web-discovery";
import { HelpTooltip } from "@/components/help-tooltip";
import { WorkspacePanelHeader } from "@/components/workspace-form";
import type { SourceSetting } from "@/components/source-card";

type Query = ReturnType<typeof discoveryQueriesForRoles>[number];

export function WebDiscoveryPanel({ roles, settings, onSaved }: { roles: string[]; settings: SourceSetting[]; onSaved: (setting: SourceSetting) => void }) {
  return <section className="signal-source-panel signal-web-discovery" aria-labelledby="web-discovery-title">
    <WorkspacePanelHeader id="web-discovery-title" title="Recherches web pour vos postes"/>
    <p className="signal-help">LinkedIn et Welcome to the Jungle · tous pays</p>
    <div className="inline-help"><span>Ouvre une recherche publique ou un lien que tu as enregistré.</span><HelpTooltip label="À propos de la recherche">Remplace chaque URL par celle d’une recherche préparée sur le site. Radar ouvre le lien ; tu vérifies les résultats toi-même.</HelpTooltip></div>
    <ul className="signal-source-web-grid">{discoveryQueriesForRoles(roles).map(query => <SearchCard key={`${query.source}:${query.role}`} query={query} setting={settings.find(setting => setting.source === query.source)} onSaved={onSaved}/>)}</ul>
    <p className="signal-help">Pour Welcome to the Jungle, prépare ta recherche sur le site et copie son URL ici. Une connexion peut être demandée. Vérifie chaque annonce avant de l’ajouter à Radar.</p>
  </section>;
}

function SearchCard({ query, setting, onSaved }: { query: Query; setting?: SourceSetting; onSaved: (setting: SourceSetting) => void }) {
  const defaults = defaultSearchLinks(query);
  const saved = setting?.searchLinks?.[query.role] ?? {};
  const [draft, setDraft] = useState<SearchLinks | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fields: (keyof SearchLinks)[] = query.source === "Welcome to the Jungle" ? ["Site", "Google", "Bing"] : ["Google", "Bing"];
  async function save() {
    const next = draft ?? {};
    if (Object.values(next).some(url => url && !validSearchLink(url))) { setError("Saisis une URL https valide pour chaque lien modifié."); return; }
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/sources", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source: query.source, role: query.role, links: next }) });
      const data = await response.json() as { source?: SourceSetting; error?: string };
      if (!response.ok || !data.source) throw new Error(data.error ?? "Liens non enregistrés.");
      onSaved(data.source); setDraft(null); setEditing(false);
    } catch (problem) { setError(problem instanceof Error ? problem.message : "Liens non enregistrés."); }
    finally { setBusy(false); }
  }
  return <li>
    <h3>{query.role}</h3><p className="signal-help">{query.source}</p>
    <div className="signal-source-web-actions">{fields.map(field => <a key={field} className="secondary-button" href={saved[field] || defaults[field]} target="_blank" rel="noopener noreferrer" aria-label={`${field === "Site" ? "Recherche sur le site" : field} · ${query.role} · ${query.source}`}>{field === "Site" ? "Sur le site" : field} <ExternalLink size={14} aria-hidden /></a>)}</div>
    <button type="button" className="mt-3 text-sm underline" onClick={() => { setDraft(saved); setEditing(!editing); setError(""); }}>{editing ? "Fermer" : "Modifier les liens"}</button>
    {editing ? <div className="mt-3 space-y-3">{fields.map(field => <label key={field} className="block text-sm"><span className="block font-medium">{field === "Site" ? "Recherche sur le site" : field}</span><input type="url" value={draft?.[field] ?? ""} onChange={event => setDraft({ ...(draft ?? {}), [field]: event.target.value })} placeholder={defaults[field]} className="mt-1 w-full rounded-lg border border-[#d0d4e4] px-3 py-2 text-sm"/><span className="block text-xs text-[#535768]">Vide = lien proposé par Radar</span></label>)}
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
      <button type="button" disabled={busy} onClick={() => void save()} className="radar-add-button">{busy ? "Enregistrement…" : "Enregistrer les liens"}</button>
    </div> : null}
  </li>;
}
