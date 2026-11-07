"use client";

import { useState } from "react";
import { ExternalLink, Trash2, X } from "lucide-react";
import { Sheet, SheetContent, SheetClose, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ChoiceSelect } from "@/components/choice-select";
import { Switch } from "@/components/ui/switch";
import { SourceCard, type SourceSetting } from "@/components/source-card";
import { CollectiveAlertPanel } from "@/components/collective-alert-panel";
import { SourceLogo } from "@/components/source-logo";
import { WorkspaceButton } from "@/components/workspace-form";
import { useWorkspaceFeedback } from "@/components/workspace-feedback";
import { formatDate } from "@/lib/application-workflow";
import { hasApplication } from "@/lib/opportunity-views";
import { sourceDrift, type Drift } from "@/lib/search-drift";
import { searchPreferences } from "@/lib/search-preferences";
import { maxTermsPerTrack, maxTracks, searchTracksFor, trackKindLabels, trackQuery } from "@/lib/search-tracks";
import type { sourceCatalog } from "@/lib/source-catalog";
import { remindsInToday, sourceKind, sourceStatus, statusLabels, statusTones, visitEvery, visitRhythms } from "@/lib/source-status";
import { searchUrl, validSearchLink } from "@/lib/web-discovery";
import type { CandidateProfile, JobRecord } from "@/lib/types";

type Source = typeof sourceCatalog[number];

/** Searches Radar prepares from the account's tracks, plus the ones saved on the source. */
function sourceSearches(source: Source, setting: SourceSetting | undefined, profile: CandidateProfile) {
  const preferences = searchPreferences(profile.searchPreferences);
  const host = (() => { try { return new URL(source.url).hostname.replace(/^www\./, ""); } catch { return ""; } })();
  const generated = searchTracksFor(preferences).map(track => ({
    id: track.id,
    label: track.label,
    detail: `${trackKindLabels[track.kind]} · ${track.terms.join(", ")}`,
    url: setting?.searchLinks?.[track.label]?.Site ?? searchUrl(host ? `site:${host} (${trackQuery(track)})` : trackQuery(track)),
  }));
  const saved = Object.entries(setting?.searchLinks ?? {})
    .filter(([, links]) => links && (links.Site || links.Google))
    .map(([role, links]) => ({ id: `saved-${role}`, label: role, detail: "Recherche enregistrée sur le site", url: (links.Site || links.Google) as string }));
  return [...generated, ...saved.filter(item => !generated.some(search => search.url === item.url))];
}

/** Everything about one source: what to open, when to come back, and what it brought. */
export function SourceDetail({ source, setting, jobs, profile, onClose, onSaveSearch, onSaved, onRemove, onVisit, onAddOffer, onReturnFocus }: {
  onReturnFocus?: () => void;
  source: Source | null; setting?: SourceSetting; jobs: JobRecord[]; profile: CandidateProfile;
  onClose: () => void; onSaveSearch: (profile: CandidateProfile) => Promise<boolean>; onSaved: (setting: SourceSetting) => void;
  onRemove: (source: Source) => void; onVisit: (source: Source) => Promise<void>; onAddOffer?: (url: string) => void;
}) {
  const notify = useWorkspaceFeedback();
  const [busy, setBusy] = useState(false);
  const [offerUrl, setOfferUrl] = useState("");
  if (!source) return null;
  const preferences = searchPreferences(profile.searchPreferences);
  const kind = sourceKind(source.mode);
  const status = sourceStatus(setting, source.mode);
  const searches = sourceSearches(source, setting, profile);
  const drift = sourceDrift(setting, preferences);
  const found = jobs.filter(job => job.source === source.name);
  const applied = found.filter(hasApplication).length;

  async function save(data: { visitEveryDays?: number; remindInToday?: boolean }) {
    if (!source) return;
    setBusy(true);
    try {
      const response = await fetch("/api/sources", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source: source.name, rhythm: true, visitEveryDays: data.visitEveryDays ?? visitEvery(setting), remindInToday: data.remindInToday ?? remindsInToday(setting) }) });
      const body = await response.json() as { source?: SourceSetting; error?: string };
      if (!response.ok || !body.source) throw new Error(body.error ?? "Rythme non enregistré");
      onSaved(body.source);
    } catch { notify({ message: "Rythme de visite non enregistré. Réessayez.", tone: "error" }); }
    finally { setBusy(false); }
  }
  /** « L'ajouter à mes pistes » : the term joins the account's alternative track. */
  async function keepTerm(term: string) {
    const tracks = searchTracksFor(preferences);
    const alternative = tracks.find(track => track.kind === "alternative");
    const next = alternative
      ? tracks.map(track => track === alternative ? { ...track, terms: [...track.terms, term].slice(0, maxTermsPerTrack) } : track)
      : [...tracks, { id: "alternatives", label: "Alternatives", kind: "alternative" as const, terms: [term] }].slice(0, maxTracks);
    setBusy(true);
    try {
      const saved = await onSaveSearch({ ...profile, searchPreferences: { ...preferences, searchTracks: next } });
      notify(saved ? { message: `« ${term} » ajouté à vos pistes de recherche.` } : { message: "Piste non enregistrée. Réessayez.", tone: "error" });
    } finally { setBusy(false); }
  }
  async function dropSearch(searchId: string) {
    if (!source) return;
    setBusy(true);
    try {
      const response = await fetch("/api/sources", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source: source.name, role: searchId, links: {} }) });
      const body = await response.json() as { source?: SourceSetting; error?: string };
      if (!response.ok || !body.source) throw new Error(body.error ?? "Recherche non retirée");
      onSaved(body.source);
      notify({ message: `Recherche « ${searchId} » retirée de ${source.name}.` });
    } catch { notify({ message: "Recherche non retirée. Réessayez.", tone: "error" }); }
    finally { setBusy(false); }
  }

  return <Sheet open onOpenChange={open => { if (!open) onClose(); }}>
    <SheetContent side="right" className="source-detail" showCloseButton={false} onCloseAutoFocus={event=>{if(onReturnFocus){event.preventDefault();onReturnFocus();}}}>
      <SheetHeader className="source-detail-head">
        <span className="source-detail-logo"><SourceLogo name={source.name} compact /></span>
        <SheetTitle>{source.name}</SheetTitle>
        <SheetDescription>
          {kind === "manual" ? "Source à consulter" : kind === "automatic" ? "Collecte automatique" : "Autre piste"}
        </SheetDescription>
        <div className="source-detail-head-actions">
          <span className="signal-source-pill" data-tone={statusTones[status]}>{statusLabels[status]}</span>
          <SheetClose asChild><WorkspaceButton variant="quiet" aria-label="Fermer la source" className="source-detail-close"><X size={20} aria-hidden /></WorkspaceButton></SheetClose>
        </div>
      </SheetHeader>

      <div className="source-detail-body">
        <section className="source-detail-action" aria-labelledby="source-detail-open">
          <h3 id="source-detail-open" className="sr-only">Consulter la source</h3>
          <div className="source-detail-buttons">
            <a className="secondary-button" href={setting?.linkUrl || source.url} target="_blank" rel="noopener noreferrer">
              Ouvrir le site<ExternalLink size={14} aria-hidden />
            </a>
            {kind === "manual" ? <WorkspaceButton variant="secondary" disabled={busy} onClick={async () => { setBusy(true); try { await onVisit(source); } finally { setBusy(false); } }}>J’ai fait le tour</WorkspaceButton> : null}
          </div>
          {kind === "manual" ? <p className="signal-help">Ouvrez une recherche puis marquez la visite comme terminée.</p> : <p className="signal-help">{source.note}</p>}
        </section>

        {kind === "manual" ? <section aria-label="Recherches">
          <ul className="source-detail-searches">{searches.map(search => <li key={search.id}>
            <span><strong>{search.label}</strong><span className="signal-help">{search.detail}</span></span>
            <a className="secondary-button" href={search.url} target="_blank" rel="noopener noreferrer">Ouvrir<ExternalLink size={13} aria-hidden /></a>
          </li>)}</ul>
          {drift.map(item => <DriftNotice key={`${item.searchId}-${item.value}`} drift={item} busy={busy} onKeep={() => void keepTerm(item.value)} onDrop={() => void dropSearch(item.searchId)} />)}
        </section> : null}

        <SourceCard key={source.name} embedded source={source} setting={setting} count={found.length} profile={profile} onSaveSearch={onSaveSearch} onSaved={onSaved} settingsExtra={kind === "manual" ? <section aria-label="Rythme de visite">
          <ChoiceSelect label="Rythme de visite" value={String(visitEvery(setting))} disabled={busy} options={visitRhythms.map(([days, label]) => ({ value: String(days), label }))} onChange={days => void save({ visitEveryDays: Number(days) })} />
          <label className="source-detail-switch">
            <Switch checked={remindsInToday(setting)} disabled={busy} onCheckedChange={checked => void save({ remindInToday: checked })} />
            <span>Me le rappeler dans « Aujourd’hui »</span>
          </label>
          {setting?.lastVisitedAt ? <p className="signal-help">Dernière visite le {formatDate(setting.lastVisitedAt, "Indian/Mauritius")}.</p> : <p className="signal-help">Jamais visitée depuis Radar.</p>}
        </section> : null} />
        {source.name==="Collective"?<CollectiveAlertPanel setting={setting} onSaved={onSaved}/>:null}

        <section aria-labelledby="source-detail-found">
          <h3 id="source-detail-found">Offres trouvées ici</h3>
          <p className="signal-help">{found.length} offre{found.length > 1 ? "s" : ""} dans Radar · {applied} candidature{applied > 1 ? "s" : ""}.</p>
          {onAddOffer ? <form className="search-role-entry source-detail-offer" onSubmit={event => { event.preventDefault(); const url = offerUrl.trim(); if (!validSearchLink(url)) { notify({ message: "Saisissez une URL https valide.", tone: "error" }); return; } setOfferUrl(""); onAddOffer(url); }}>
            <input type="url" value={offerUrl} onChange={event => setOfferUrl(event.target.value)} placeholder="https://…" aria-label={`Coller l’URL d’une offre vue sur ${source.name}`} />
            <WorkspaceButton type="submit" variant="secondary" disabled={!offerUrl.trim()}>Ajouter cette offre</WorkspaceButton>
          </form> : null}
          {onAddOffer ? <p className="signal-help">Collez l’URL d’une offre vue sur ce site : le formulaire d’ajout s’ouvre, prérempli.</p> : null}
        </section>

      </div>
      <div className="source-detail-footer">
        <WorkspaceButton variant="danger" onClick={() => onRemove(source)}><Trash2 size={15} aria-hidden />Supprimer la source</WorkspaceButton>
        <SheetClose asChild><WorkspaceButton variant="secondary">Fermer</WorkspaceButton></SheetClose>
      </div>
    </SheetContent>
  </Sheet>;
}

/** « « Product Builder » n'est pas dans vos critères » — the account decides what to do with it. */
export function DriftNotice({ drift, busy, onKeep, onDrop }: { drift: Drift; busy: boolean; onKeep: () => void; onDrop: () => void }) {
  return <div className="signal-source-drift" role="note">
    <p>« {drift.value} » n’est pas dans vos critères. Cette recherche cherche encore ce titre sur la source.</p>
    <div className="signal-source-drift-actions">
      <WorkspaceButton variant="secondary" disabled={busy} onClick={onKeep}>L’ajouter à mes pistes</WorkspaceButton>
      <WorkspaceButton variant="quiet" disabled={busy} onClick={onDrop}>Retirer de cette recherche</WorkspaceButton>
    </div>
  </div>;
}
