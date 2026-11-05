"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Pencil } from "lucide-react";
import { SearchPreferencesForm } from "@/components/search-preferences-form";
import { WorkspaceButton } from "@/components/workspace-form";
import { criteriaGroups, criteriaTokens, type CriteriaTarget } from "@/lib/search-criteria";
import { searchPreferences } from "@/lib/search-preferences";
import type { CandidateProfile } from "@/lib/types";

type View = "summary" | "details" | "edit";
const viewKey = "radar:search-criteria-view";
// First field of each form group, focused when a criterion is opened for editing.
const editTargets: Record<Exclude<CriteriaTarget, "jobgether">, string> = {
  roles: "#searched-role",
  conditions: "section[aria-labelledby=search-conditions-title] input",
  locations: "#includedLocations",
  pay: "section[aria-labelledby=search-pay-title] input",
};

function readView(): Exclude<View, "edit"> {
  if (typeof window === "undefined") return "summary";
  try { return window.localStorage.getItem(viewKey) === "details" ? "details" : "summary"; } catch { return "summary"; }
}
function storeView(view: View) {
  try { window.localStorage.setItem(viewKey, view); } catch { /* Preference only: the panel works without storage. */ }
}

/** Criteria read at a glance, expanded on demand, and edited with the existing form. */
export function SearchCriteriaPanel({ profile, onSave, onOpenJobgether }: { profile: CandidateProfile; onSave: (profile: CandidateProfile) => Promise<boolean>; onOpenJobgether: () => void }) {
  // A first visit keeps the form open so the onboarding step can save the first criteria.
  const firstSetup = !profile.searchPreferences;
  const [resting, setResting] = useState(readView);
  const [view, setView] = useState<View>(() => firstSetup ? "edit" : resting);
  const focusTarget = useRef<CriteriaTarget | null>(null);
  const editButton = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false);
  const preferences = searchPreferences(profile.searchPreferences);

  useEffect(() => {
    const target = focusTarget.current;
    if (view !== "edit" || !target || target === "jobgether") return;
    focusTarget.current = null;
    const field = document.querySelector<HTMLElement>(editTargets[target]);
    field?.scrollIntoView({ block: "center" });
    field?.focus({ preventScroll: true });
  }, [view]);

  useEffect(() => {
    if (view !== "edit" && returnFocus.current) { returnFocus.current = false; editButton.current?.focus(); }
  }, [view]);

  function toggle() {
    const next = view === "details" ? "summary" : "details";
    setView(next); setResting(next); storeView(next);
  }
  function edit(target: CriteriaTarget | null) {
    if (target === "jobgether") { onOpenJobgether(); return; }
    focusTarget.current = target; setView("edit");
  }
  function done() { returnFocus.current = true; setView(resting); }

  return <section className="search-criteria-panel" aria-labelledby="search-criteria-title">
    <header className="search-criteria-panel-header">
      <div>
        <h2 id="search-criteria-title" className="source-heading">Ce que je recherche</h2>
        <p>Ces critères classent vos offres dans Radar. Ils ne modifient pas les alertes créées sur les sites externes.</p>
      </div>
      <div className="search-criteria-panel-actions">
        {view === "edit"
          ? firstSetup ? null : <WorkspaceButton variant="primary" onClick={done}>Terminé</WorkspaceButton>
          : <>
            <WorkspaceButton variant="quiet" aria-expanded={view === "details"} aria-controls="search-criteria-details" onClick={toggle}>
              {view === "details" ? "Replier" : "Tout voir"}{view === "details" ? <ChevronUp size={15} aria-hidden /> : <ChevronDown size={15} aria-hidden />}
            </WorkspaceButton>
            <WorkspaceButton ref={editButton} onClick={() => edit(null)}><Pencil size={14} aria-hidden />Modifier</WorkspaceButton>
          </>}
      </div>
    </header>

    {view === "summary" ? <ul className="search-criteria-tokens" aria-label="Critères enregistrés">
      {criteriaTokens(preferences).map(token => <li key={token.id}>
        <button type="button" className="search-criteria-token" data-tone={token.tone} title={token.fullValue} aria-label={`${token.label} : ${token.fullValue}. Modifier`} onClick={() => edit(token.target)}>
          <span>{token.label}</span><strong>{token.value}</strong>
        </button>
      </li>)}
    </ul> : null}

    {view === "details" ? <div id="search-criteria-details" className="search-criteria-details">
      {criteriaGroups(preferences).map(group => <section key={group.id} aria-labelledby={`search-criteria-${group.id}`}>
        <h3 id={`search-criteria-${group.id}`}>{group.title}</h3>
        <dl>{group.rows.map(row => <div key={row.id} className="search-criteria-row">
          <dt>{row.label}</dt>
          <dd><ul className="search-criteria-values">{row.values.map(value => <li key={value} data-tone={row.tone}>{value}</li>)}</ul></dd>
          <dd className="search-criteria-row-action"><WorkspaceButton variant="quiet" aria-label={`Modifier : ${row.label}`} onClick={() => edit(row.target)}>Modifier</WorkspaceButton></dd>
        </div>)}</dl>
      </section>)}
    </div> : null}

    {view === "edit" ? <SearchPreferencesForm profile={profile} onSave={onSave} showIntro={false} /> : null}
  </section>;
}
