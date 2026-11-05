"use client";

import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SourceLogo } from "@/components/source-logo";
import { WorkspaceButton, WorkspaceFormError } from "@/components/workspace-form";
import { searchPreferences } from "@/lib/search-preferences";
import type { sourceCatalog } from "@/lib/source-catalog";
import { matchesSourceQuery, rankSources, sourceTags } from "@/lib/source-suggestions";
import { sourceKind } from "@/lib/source-status";
import type { CandidateProfile } from "@/lib/types";

type Source = typeof sourceCatalog[number];
export type AddFilter = "all" | "automatic" | "manual";
const filters: [AddFilter, string][] = [["all", "Toutes"], ["automatic", "Automatiques"], ["manual", "À consulter"]];

/** The catalogue, ordered by what the account searches, plus a field for a site of its own. */
export function SourceAddSheet({ open, initialFilter = "all", sources, followed, profile, adding, error, onAdd, onAddSite, onClose }: {
  open: boolean; initialFilter?: AddFilter; sources: readonly Source[]; followed: (name: string) => boolean;
  profile: CandidateProfile; adding: string | null; error: string;
  onAdd: (name: string) => Promise<void>; onAddSite: (url: string) => Promise<boolean>; onClose: () => void;
}) {
  const [filter, setFilter] = useState<AddFilter>(initialFilter);
  const [query, setQuery] = useState("");
  const [site, setSite] = useState("");
  const [savingSite, setSavingSite] = useState(false);
  const ranked = rankSources(sources, searchPreferences(profile.searchPreferences))
    .filter(source => filter === "all" || sourceKind(source.mode) === filter)
    .filter(source => matchesSourceQuery(source, query));

  return <Sheet open={open} onOpenChange={next => { if (!next) onClose(); }}>
    <SheetContent side="right" className="source-add-sheet">
      <SheetHeader>
        <SheetTitle>Ajouter une source</SheetTitle>
        <SheetDescription>Les plus proches de vos critères sont en tête. Radar ne crée aucun compte à votre place.</SheetDescription>
      </SheetHeader>
      <div className="source-add-body">
        <label className="source-add-search">
          <Search size={16} aria-hidden />
          <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Chercher une source" aria-label="Chercher une source" />
        </label>
        <div role="tablist" aria-label="Filtrer le catalogue" className="signal-source-filters">
          {filters.map(([id, label]) => <button type="button" key={id} role="tab" aria-selected={filter === id} onClick={() => setFilter(id)}>{label}</button>)}
        </div>
        <ul className="source-add-list">{ranked.map(source => {
          const already = followed(source.name);
          return <li key={source.name}>
            <span className="source-add-logo"><SourceLogo name={source.name} compact /></span>
            <span className="source-add-name">
              <strong>{source.name}</strong>
              <span className="source-add-tags">{sourceTags(source).map((tag, index) => <span key={`${tag}-${index}`} className="quiet-tag">{tag}</span>)}</span>
            </span>
            {already
              ? <span className="signal-help">Ajoutée</span>
              : <WorkspaceButton variant="secondary" busy={adding === source.name} disabled={adding !== null} onClick={() => void onAdd(source.name)}><Plus size={14} aria-hidden />Ajouter</WorkspaceButton>}
          </li>;
        })}</ul>
        {!ranked.length ? <p className="signal-help">Aucune source ne correspond à cette recherche.</p> : null}
        <WorkspaceFormError message={error} />
        <form className="source-add-site" onSubmit={async event => {
          event.preventDefault();
          setSavingSite(true);
          try { if (await onAddSite(site.trim())) setSite(""); } finally { setSavingSite(false); }
        }}>
          <h3>Votre site n’est pas dans la liste ?</h3>
          <p className="signal-help">Collez l’URL de votre recherche. Elle devient une source à consulter ; Radar n’y collecte rien.</p>
          <div className="search-role-entry">
            <input type="url" value={site} onChange={event => setSite(event.target.value)} placeholder="https://…" aria-label="URL de votre recherche" />
            <WorkspaceButton type="submit" variant="secondary" busy={savingSite} disabled={savingSite || !site.trim()}>Ajouter</WorkspaceButton>
          </div>
        </form>
      </div>
    </SheetContent>
  </Sheet>;
}
