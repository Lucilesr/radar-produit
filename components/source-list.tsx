"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { SourceCard, type SourceSetting } from "@/components/source-card";
import { SourceLogo } from "@/components/source-logo";
import { WorkspaceButton } from "@/components/workspace-form";
import { useWorkspaceFeedback } from "@/components/workspace-feedback";
import { formatDate } from "@/lib/application-workflow";
import { sourceCatalog } from "@/lib/source-catalog";
import { sourceDrift, type Drift } from "@/lib/search-drift";
import { searchPreferences } from "@/lib/search-preferences";
import { maxTermsPerTrack, maxTracks, searchTracksFor } from "@/lib/search-tracks";
import { needsAction, sourceKind, sourceStatus, statusActions, statusLabels, statusTones, type SourceStatus } from "@/lib/source-status";
import type { CandidateProfile, JobRecord } from "@/lib/types";

type Source = typeof sourceCatalog[number];
export type SourceFilter = "all" | "automatic" | "manual" | "action";
const filters: [SourceFilter, string][] = [["all", "Toutes"], ["automatic", "Automatiques"], ["manual", "À consulter"], ["action", "Action requise"]];
const groups: [Exclude<SourceFilter, "all" | "action">, string, string][] = [
  ["automatic", "Automatiques", "Radar collecte ces offres pour vous."],
  ["manual", "À consulter", "Radar prépare les recherches ; vous ouvrez le site."],
];

/** Sources grouped by how they work, each row saying where it stands and what to do next. */
export function SourceList({ sources, settings, jobs, profile, onSaveSearch, onSaved, onRemove, onVisit }: {
  sources: Source[]; settings: SourceSetting[]; jobs: JobRecord[]; profile: CandidateProfile;
  onSaveSearch: (profile: CandidateProfile) => Promise<boolean>; onSaved: (setting: SourceSetting) => void;
  onRemove: (source: Source) => void; onVisit: (source: Source) => Promise<void>;
}) {
  const notify = useWorkspaceFeedback();
  const preferences = searchPreferences(profile.searchPreferences);
  const [filter, setFilter] = useState<SourceFilter>("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [visiting, setVisiting] = useState<string | null>(null);
  const settingFor = (name: string) => settings.find(item => item.source === name);
  const statusFor = (source: Source) => sourceStatus(settingFor(source.name), source.mode);
  // A saved search looking for a title the account dropped also needs attention.
  const driftFor = (source: Source) => sourceDrift(settingFor(source.name), preferences);
  const attention = (source: Source) => needsAction(statusFor(source)) || driftFor(source).length > 0;
  const counts = { action: sources.filter(attention).length };
  const keep = (source: Source) => filter === "all" || (filter === "action" ? attention(source) : sourceKind(source.mode) === filter);

  /** « L'ajouter à mes pistes » : the term joins the account's alternative track. */
  async function keepTerm(term: string) {
    const tracks = searchTracksFor(preferences);
    const alternative = tracks.find(track => track.kind === "alternative");
    const next = alternative
      ? tracks.map(track => track === alternative ? { ...track, terms: [...track.terms, term].slice(0, maxTermsPerTrack) } : track)
      : [...tracks, { id: "alternatives", label: "Alternatives", kind: "alternative" as const, terms: [term] }].slice(0, maxTracks);
    setBusy(term);
    try {
      const saved = await onSaveSearch({ ...profile, searchPreferences: { ...preferences, searchTracks: next } });
      notify(saved ? { message: `« ${term} » ajouté à vos pistes de recherche.` } : { message: "Piste non enregistrée. Réessayez.", tone: "error" });
    } finally { setBusy(null); }
  }
  /** « Retirer de cette recherche » : the source keeps no link for that title any more. */
  async function dropSearch(source: Source, searchId: string) {
    setBusy(searchId);
    try {
      const response = await fetch("/api/sources", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source: source.name, role: searchId, links: {} }) });
      const body = await response.json() as { source?: SourceSetting; error?: string };
      if (!response.ok || !body.source) throw new Error(body.error ?? "Recherche non retirée");
      onSaved(body.source);
      notify({ message: `Recherche « ${searchId} » retirée de ${source.name}.` });
    } catch { notify({ message: "Recherche non retirée. Réessayez.", tone: "error" }); }
    finally { setBusy(null); }
  }

  return <section className="signal-source-list" aria-labelledby="source-list-title">
    <div className="signal-source-list-head">
      <h2 id="source-list-title">Sources suivies</h2>
      <p className="signal-help">{sources.length} source{sources.length > 1 ? "s" : ""}{counts.action ? ` · ${counts.action} demande${counts.action > 1 ? "nt" : ""} une action` : " · rien à faire"}</p>
    </div>
    <div role="tablist" aria-label="Filtrer les sources" className="signal-source-filters">
      {filters.map(([id, label]) => <button type="button" key={id} role="tab" aria-selected={filter === id} onClick={() => setFilter(id)}>
        {label}{id === "action" && counts.action ? <span className="quiet-tag">{counts.action}</span> : null}
      </button>)}
    </div>
    {groups.map(([kind, title, help]) => {
      const rows = sources.filter(source => sourceKind(source.mode) === kind && keep(source));
      if (!rows.length) return null;
      return <div className="signal-source-group" key={kind}>
        <div className="signal-source-group-head"><h3>{title}</h3><p className="signal-help">{help}</p></div>
        <ul>{rows.map(source => {
          const setting = settingFor(source.name);
          const status = statusFor(source);
          const count = jobs.filter(job => job.source === source.name).length;
          const expanded = open === source.name;
          const drift = driftFor(source);
          return <li key={source.name} data-status={status}>
            <div className="signal-source-row">
              <span className="signal-source-row-logo"><SourceLogo name={source.name} compact /></span>
              <span className="signal-source-row-name">
                <strong>{source.name}</strong>
                <span className="signal-help">{source.group}</span>
              </span>
              <span className="signal-source-pill" data-tone={statusTones[status]}>{statusLabels[status]}</span>
              {drift.length ? <span className="signal-source-pill" data-tone="warning">{drift.length} écart{drift.length > 1 ? "s" : ""}</span> : null}
              <span className="signal-source-row-meta">{rowMeta(status, setting, count)}</span>
              <span className="signal-source-row-actions">
                {kind === "manual"
                  ? <a className="secondary-button" href={setting?.linkUrl || source.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} aria-hidden />Ouvrir</a>
                  : null}
                {kind === "manual"
                  ? <WorkspaceButton variant="quiet" busy={visiting === source.name} disabled={visiting !== null} onClick={async () => { setVisiting(source.name); try { await onVisit(source); } finally { setVisiting(null); } }}>J’ai fait le tour</WorkspaceButton>
                  : null}
                <WorkspaceButton variant={kind === "manual" ? "quiet" : "secondary"} aria-expanded={expanded} aria-controls={`source-card-${slug(source.name)}`} onClick={() => setOpen(expanded ? null : source.name)}>
                  {expanded ? "Fermer" : statusActions[status] === "Ouvrir" ? "Réglages" : statusActions[status]}
                </WorkspaceButton>
              </span>
            </div>
            {expanded ? <div className="signal-source-row-card" id={`source-card-${slug(source.name)}`}>
              {drift.map(item => <DriftNotice key={`${item.searchId}-${item.value}`} drift={item} busy={busy === item.value || busy === item.searchId} onKeep={() => void keepTerm(item.value)} onDrop={() => void dropSearch(source, item.searchId)} />)}
              <SourceCard source={source} setting={setting} count={count} profile={profile} onSaveSearch={onSaveSearch} onSaved={onSaved} onRemove={() => onRemove(source)} />
            </div> : null}
          </li>;
        })}</ul>
      </div>;
    })}
    {sources.filter(keep).length === 0 ? <p className="signal-help">Aucune source dans ce filtre.</p> : null}
  </section>;
}

/** « « Product Builder » n'est pas dans vos critères » — the account decides what to do with it. */
function DriftNotice({ drift, busy, onKeep, onDrop }: { drift: Drift; busy: boolean; onKeep: () => void; onDrop: () => void }) {
  return <div className="signal-source-drift" role="note">
    <p>« {drift.value} » n’est pas dans vos critères. Cette recherche cherche encore ce titre sur la source.</p>
    <div className="signal-source-drift-actions">
      <WorkspaceButton variant="secondary" disabled={busy} busy={busy} onClick={onKeep}>L’ajouter à mes pistes</WorkspaceButton>
      <WorkspaceButton variant="quiet" disabled={busy} onClick={onDrop}>Retirer de cette recherche</WorkspaceButton>
    </div>
  </div>;
}

const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

function rowMeta(status: SourceStatus, setting: SourceSetting | undefined, count: number) {
  const offers = `${count} offre${count > 1 ? "s" : ""}`;
  if (status === "error") return setting?.lastAttemptAt ? `Dernière tentative le ${formatDate(setting.lastAttemptAt, "Indian/Mauritius", true)}` : "Collecte interrompue";
  if (status === "to_configure") return "Réglage à terminer";
  if (status === "paused") return "Ignorée par les scans";
  if (status === "new") return `Jamais visitée · ${offers}`;
  if (setting?.lastVisitedAt) return `Vu le ${formatDate(setting.lastVisitedAt, "Indian/Mauritius")} · ${offers}`;
  if (setting?.lastSyncedAt) return `Collecte le ${formatDate(setting.lastSyncedAt, "Indian/Mauritius", true)} · ${offers}`;
  return offers;
}
