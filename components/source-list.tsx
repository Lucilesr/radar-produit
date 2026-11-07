"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { type SourceSetting } from "@/components/source-card";
import { SourceLogo } from "@/components/source-logo";
import { WorkspaceButton } from "@/components/workspace-form";
import { formatDate } from "@/lib/application-workflow";
import { sourceCatalog } from "@/lib/source-catalog";
import { sourceDrift } from "@/lib/search-drift";
import { searchPreferences } from "@/lib/search-preferences";
import { needsAction, sourceKind, sourceStatus, statusActions, statusLabels, statusTones, type SourceStatus } from "@/lib/source-status";
import type { CandidateProfile, JobRecord } from "@/lib/types";

type Source = typeof sourceCatalog[number];
export type SourceFilter = "all" | "automatic" | "manual" | "action";
const filters: [SourceFilter, string][] = [["all", "Toutes"], ["automatic", "Automatiques"], ["manual", "À consulter"], ["action", "Action requise"]];
const groups: [Exclude<SourceFilter, "all" | "action">, string, string][] = [
  ["automatic", "Automatiques", "Radar collecte ces offres pour vous."],
  ["manual", "À consulter", "Radar prépare les recherches ; vous ouvrez le site. Radar ne lit pas vos comptes."],
];

/** Sources grouped by how they work, each row saying where it stands and what to do next. */
export function SourceList({ sources, settings, jobs, profile, onOpen, onVisit }: {
  sources: Source[]; settings: SourceSetting[]; jobs: JobRecord[]; profile: CandidateProfile;
  onOpen: (source: Source) => void; onVisit: (source: Source) => Promise<void>;
}) {
  const preferences = searchPreferences(profile.searchPreferences);
  const [filter, setFilter] = useState<SourceFilter>("all");
  const [visiting, setVisiting] = useState<string | null>(null);
  const settingFor = (name: string) => settings.find(item => item.source === name);
  const statusFor = (source: Source) => sourceStatus(settingFor(source.name), source.mode);
  // A saved search looking for a title the account dropped also needs attention.
  const driftFor = (source: Source) => sourceDrift(settingFor(source.name), preferences);
  const attention = (source: Source) => needsAction(statusFor(source)) || driftFor(source).length > 0;
  const counts = { action: sources.filter(attention).length };
  const keep = (source: Source) => filter === "all" || (filter === "action" ? attention(source) : sourceKind(source.mode) === filter);


  return <section className="signal-source-list" aria-labelledby="source-settings-title">
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
          const drift = driftFor(source);
          return <li key={source.name} data-source={source.name} data-status={status}>
            <div className="signal-source-row">
              <span className="signal-source-row-logo"><SourceLogo name={source.name} compact /></span>
              <span className="signal-source-row-name">
                <button type="button" className="signal-source-row-open" aria-haspopup="dialog" onClick={() => onOpen(source)}>{source.name}</button>
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
                <WorkspaceButton variant={kind === "manual" ? "quiet" : "secondary"} aria-haspopup="dialog" onClick={() => onOpen(source)}>
                  {statusActions[status] === "Ouvrir" ? "Réglages" : statusActions[status]}
                </WorkspaceButton>
              </span>
            </div>
          </li>;
        })}</ul>
      </div>;
    })}
    {sources.filter(keep).length === 0 ? <p className="signal-help">Aucune source dans ce filtre.</p> : null}
  </section>;
}


function rowMeta(status: SourceStatus, setting: SourceSetting | undefined, count: number) {
  const offers = `${count} offre${count > 1 ? "s" : ""}`;
  if (status === "error") return setting?.lastAttemptAt ? `Dernière tentative le ${formatDate(setting.lastAttemptAt, "Indian/Mauritius", true)}` : "Collecte interrompue";
  if (status === "to_configure") return null;
  if (status === "paused") return "Ignorée par les scans";
  if (status === "new") return `Jamais visitée · ${offers}`;
  if (setting?.lastVisitedAt) return `Vu le ${formatDate(setting.lastVisitedAt, "Indian/Mauritius")} · ${offers}`;
  if (setting?.lastSyncedAt) return `Collecte le ${formatDate(setting.lastSyncedAt, "Indian/Mauritius", true)} · ${offers}`;
  return offers;
}
