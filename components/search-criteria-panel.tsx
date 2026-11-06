"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Pencil, Plus } from "lucide-react";
import { SearchPreferencesForm, type CriteriaFormPart } from "@/components/search-preferences-form";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useIsMobile } from "@/hooks/use-mobile";
import { WorkspaceButton } from "@/components/workspace-form";
import { useWorkspaceFeedback } from "@/components/workspace-feedback";
import { countToReview, describeCriteriaChanges, impactMessage } from "@/lib/criteria-impact";
import { criteriaGroups, criteriaTokens, missingCriteria, type CriteriaTarget, type MissingCriterion } from "@/lib/search-criteria";
import { searchPreferences } from "@/lib/search-preferences";
import type { CandidateProfile, JobRecord } from "@/lib/types";

type View = "summary" | "details" | "edit";
const viewKey = "radar:search-criteria-view";
// First field of each form group, focused when a criterion is opened for editing.
const editTargets: Record<Exclude<CriteriaTarget, "jobgether">, string> = {
  keywords: "#boostKeywords",
  roles: "#searched-role",
  conditions: "section[aria-labelledby=search-conditions-title] input",
  locations: "#includedLocations",
  pay: "section[aria-labelledby=search-pay-title] input",
};

// Menus opened from inside a popover (country list, select, mobile drawer) render elsewhere in
// the page; a click in them must not close the popover that owns them.
const nestedLayers = "[data-slot=combobox-content],[data-slot=select-content],[data-vaul-drawer],[data-slot=drawer-content]";
function keepOpenForNestedMenus(event: { target: EventTarget | null; preventDefault: () => void }) {
  if (event.target instanceof Element && event.target.closest(nestedLayers)) event.preventDefault();
}

function readView(): Exclude<View, "edit"> {
  if (typeof window === "undefined") return "summary";
  try { return window.localStorage.getItem(viewKey) === "details" ? "details" : "summary"; } catch { return "summary"; }
}
function storeView(view: View) {
  try { window.localStorage.setItem(viewKey, view); } catch { /* Preference only: the panel works without storage. */ }
}

/** Criteria read at a glance, expanded on demand, and edited with the existing form. */
export function SearchCriteriaPanel({ profile, jobs, onSave, onOpenJobgether }: { profile: CandidateProfile; jobs: JobRecord[]; onSave: (profile: CandidateProfile) => Promise<boolean>; onOpenJobgether: () => void }) {
  // A first visit keeps the form open so the onboarding step can save the first criteria.
  const firstSetup = !profile.searchPreferences;
  const [resting, setResting] = useState(readView);
  const [view, setView] = useState<View>(() => firstSetup ? "edit" : resting);
  const focusTarget = useRef<CriteriaTarget | null>(null);
  const editButton = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false);
  const preferences = searchPreferences(profile.searchPreferences);
  const notify = useWorkspaceFeedback();
  // Remounts the form after an undo so its fields show the restored values.
  const [formRevision, setFormRevision] = useState(0);
  const [openToken, setOpenToken] = useState<string | null>(null);
  const [editingRow, setEditingRow] = useState<string | null>(null);
  // « + Critère » : the menu first, then the chosen criterion's own control, in the same panel.
  const [adding, setAdding] = useState(false);
  const [addTarget, setAddTarget] = useState<MissingCriterion | null>(null);
  const missing = missingCriteria(preferences);
  function closeAdd() { setAdding(false); setAddTarget(null); }
  const formPart = (target: CriteriaTarget) => target as CriteriaFormPart;
  // On a phone a floating panel has no room: the setting opens in the page, under the tags.
  const mobile = useIsMobile();
  const inlineToken = mobile ? criteriaTokens(preferences).find(token => token.key === openToken) : undefined;
  const inlineEditor = useRef<HTMLDivElement>(null);
  const tokenButtons = useRef(new Map<string, HTMLButtonElement>());
  useEffect(() => {
    if (!inlineToken) return;
    inlineEditor.current?.scrollIntoView({ block: "nearest" });
    inlineEditor.current?.querySelector<HTMLElement>("input,button,[role=combobox]")?.focus({ preventScroll: true });
  }, [inlineToken?.key]); // eslint-disable-line react-hooks/exhaustive-deps
  function closeInline() {
    const id = openToken; setOpenToken(null);
    if (id) requestAnimationFrame(() => tokenButtons.current.get(id)?.focus());
  }

  /** Every save says what changed and how many offers it leaves to review, with one-step undo. */
  async function saveWithImpact(next: CandidateProfile) {
    const previous = profile;
    const before = searchPreferences(previous.searchPreferences);
    const after = searchPreferences(next.searchPreferences);
    const saved = await onSave(next);
    const changes = saved ? describeCriteriaChanges(before, after) : [];
    if (changes.length) notify({
      message: impactMessage(changes, countToReview(jobs, before), countToReview(jobs, after)),
      action: previous.searchPreferences ? { label: "Annuler", onClick: () => void undo(previous) } : undefined,
    });
    return saved;
  }
  async function undo(previous: CandidateProfile) {
    const restored = await onSave(previous);
    if (restored) setFormRevision(value => value + 1);
    notify(restored ? { message: "Modification annulée.", tone: "info" } : { message: "Annulation non enregistrée. Réessayez.", tone: "error" });
  }

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
            <WorkspaceButton ref={editButton} onClick={() => edit(null)}><Pencil size={14} aria-hidden />Tout modifier</WorkspaceButton>
          </>}
      </div>
    </header>

    {view === "summary" ? <ul className="search-criteria-tokens" aria-label="Critères enregistrés">
      {criteriaTokens(preferences).map(token => {
        const label = `${token.label} : ${token.fullValue}. Modifier`;
        const content = <><span>{token.label}</span><strong>{token.value}</strong></>;
        if (token.target === "jobgether") return <li key={token.key}><button type="button" className="search-criteria-token" data-tone={token.tone} title={token.fullValue} aria-label={label} onClick={onOpenJobgether}>{content}</button></li>;
        if (mobile) return <li key={token.key}><button type="button" ref={node => { if (node) tokenButtons.current.set(token.key, node); }} className="search-criteria-token" data-tone={token.tone} data-state={openToken === token.key ? "open" : "closed"} title={token.fullValue} aria-label={label} aria-expanded={openToken === token.key} aria-controls="search-criteria-inline" onClick={() => setOpenToken(openToken === token.key ? null : token.key)}>{content}</button></li>;
        return <li key={token.key}>
          <Popover open={openToken === token.key} onOpenChange={open => setOpenToken(open ? token.key : null)}>
            <PopoverTrigger asChild>
              <button type="button" className="search-criteria-token" data-tone={token.tone} title={token.fullValue} aria-label={label}>{content}</button>
            </PopoverTrigger>
            <PopoverContent align="start" collisionPadding={{ top: 12, right: 12, left: 12, bottom: 96 }} className="search-criteria-popover" onInteractOutside={keepOpenForNestedMenus} onFocusOutside={keepOpenForNestedMenus}>
              <SearchPreferencesForm key={formRevision} profile={profile} onSave={saveWithImpact} showIntro={false} only={formPart(token.target)} />
              <div className="search-criteria-popover-actions"><WorkspaceButton variant="primary" onClick={() => setOpenToken(null)}>Terminé</WorkspaceButton></div>
            </PopoverContent>
          </Popover>
        </li>;
      })}
      {missing.length && mobile ? <li>
        <button type="button" className="search-criteria-add" aria-expanded={adding} aria-controls="search-criteria-add-inline" onClick={() => { if (adding) closeAdd(); else { setAdding(true); setAddTarget(null); setOpenToken(null); } }}><Plus size={14} aria-hidden />Critère</button>
      </li> : null}
      {missing.length && !mobile ? <li>
        <Popover open={adding} onOpenChange={open => { if (open) { setAdding(true); setAddTarget(null); } else closeAdd(); }}>
          <PopoverTrigger asChild>
            <button type="button" className="search-criteria-add"><Plus size={14} aria-hidden />Critère</button>
          </PopoverTrigger>
          <PopoverContent align="start" collisionPadding={{ top: 12, right: 12, left: 12, bottom: 96 }} className="search-criteria-popover" onInteractOutside={keepOpenForNestedMenus} onFocusOutside={keepOpenForNestedMenus}>
            {addTarget
              ? <>
                <SearchPreferencesForm key={formRevision} profile={profile} onSave={saveWithImpact} showIntro={false} only={formPart(addTarget.target)} />
                <div className="search-criteria-popover-actions"><WorkspaceButton variant="primary" onClick={closeAdd}>Terminé</WorkspaceButton></div>
              </>
              : <ul className="search-criteria-add-menu">{missing.map(item => <li key={item.id}>
                <button type="button" onClick={() => setAddTarget(item)}><strong>{item.label}</strong><span>{item.help}</span></button>
              </li>)}</ul>}
          </PopoverContent>
        </Popover>
      </li> : null}
    </ul> : null}
    {view === "summary" && mobile && adding ? <div id="search-criteria-add-inline" className="search-criteria-inline-editor">
      {addTarget
        ? <>
          <SearchPreferencesForm key={formRevision} profile={profile} onSave={saveWithImpact} showIntro={false} only={formPart(addTarget.target)} />
          <div className="search-criteria-popover-actions"><WorkspaceButton variant="primary" onClick={closeAdd}>Terminé</WorkspaceButton></div>
        </>
        : <ul className="search-criteria-add-menu">{missing.map(item => <li key={item.id}>
          <button type="button" onClick={() => setAddTarget(item)}><strong>{item.label}</strong><span>{item.help}</span></button>
        </li>)}</ul>}
    </div> : null}
    {view === "summary" && inlineToken ? <div id="search-criteria-inline" ref={inlineEditor} className="search-criteria-inline-editor">
      <SearchPreferencesForm key={formRevision} profile={profile} onSave={saveWithImpact} showIntro={false} only={formPart(inlineToken.target)} />
      <div className="search-criteria-popover-actions"><WorkspaceButton variant="primary" onClick={closeInline}>Terminé</WorkspaceButton></div>
    </div> : null}

    {view === "details" ? <div id="search-criteria-details" className="search-criteria-details">
      {criteriaGroups(preferences).map(group => <section key={group.id} aria-labelledby={`search-criteria-${group.id}`}>
        <h3 id={`search-criteria-${group.id}`}>{group.title}</h3>
        <dl>{group.rows.map(row => <div key={row.key ?? row.id} className="search-criteria-row" data-editing={editingRow === (row.key ?? row.id) || undefined}>
          <dt>{row.label}</dt>
          <dd><ul className="search-criteria-values">{row.values.map(value => <li key={value} data-tone={row.tone}>{value}</li>)}</ul></dd>
          <dd className="search-criteria-row-action">{editingRow === (row.key ?? row.id) ? null : <WorkspaceButton variant="quiet" aria-label={`Modifier : ${row.label}`} aria-expanded={false} onClick={() => row.target === "jobgether" ? onOpenJobgether() : setEditingRow(row.key ?? row.id)}>Modifier</WorkspaceButton>}</dd>
          {editingRow === (row.key ?? row.id) ? <dd className="search-criteria-row-editor">
            <SearchPreferencesForm key={formRevision} profile={profile} onSave={saveWithImpact} showIntro={false} only={formPart(row.target)} />
            <div className="search-criteria-popover-actions"><WorkspaceButton variant="primary" onClick={() => setEditingRow(null)}>Terminé</WorkspaceButton></div>
          </dd> : null}
        </div>)}</dl>
      </section>)}
    </div> : null}

    {view === "edit" ? <SearchPreferencesForm key={formRevision} profile={profile} onSave={saveWithImpact} showIntro={false} /> : null}
  </section>;
}
