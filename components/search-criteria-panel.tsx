"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Pencil, Plus } from "lucide-react";
import { SearchPreferencesForm, type CriteriaFormPart, type CriteriaSaveStatus, type CriteriaFormHandle } from "@/components/search-preferences-form";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { HelpTooltip } from "@/components/help-tooltip";
import { useIsMobile } from "@/hooks/use-mobile";
import { WorkspaceButton } from "@/components/workspace-form";
import { useWorkspaceFeedback } from "@/components/workspace-feedback";
import { countToReview, describeCriteriaChanges, impactMessage } from "@/lib/criteria-impact";
import { changedCriteriaIds, criteriaGroups, criteriaTokens, missingCriteria, type CriteriaTarget, type MissingCriterion } from "@/lib/search-criteria";
import { searchPreferences } from "@/lib/search-preferences";
import type { CandidateProfile, JobRecord } from "@/lib/types";

type View = "summary" | "details" | "edit";
const viewKey = "radar:search-criteria-view";
// First field of each form group, focused when a criterion is opened for editing.
const editTargets: Record<Exclude<CriteriaTarget, "jobgether">, string> = {
  keywords: "#boostKeywords",
  roles: "#searched-role",
  level: "[role=group][aria-label='Niveau visé'] button",
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
export function SearchCriteriaPanel({ overview=false,profile, jobs, onSave, onOpenJobgether, active = true,domainContent }: { overview?:boolean;domainContent?:React.ReactNode; profile: CandidateProfile; jobs: JobRecord[]; onSave: (profile: CandidateProfile) => Promise<boolean>; onOpenJobgether: () => void; active?:boolean }) {
  // A first visit keeps the form open so the onboarding step can save the first criteria.
  const firstSetup = !profile.searchPreferences;
  const [resting, setResting] = useState<Exclude<View,"edit">>(()=>overview?"summary":readView());
  const [view, setView] = useState<View>(() => firstSetup&&!overview ? "edit" : resting);
  const focusTarget = useRef<CriteriaTarget | null>(null);
  const editButton = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false);
  const preferences = searchPreferences(profile.searchPreferences);
  const [saveStatus,setSaveStatus]=useState<CriteriaSaveStatus>({state:"idle"});
  const formCommit = useRef<CriteriaFormHandle>(null);
  const finishing = useRef(false);
  const [committing, setCommitting] = useState(false);
  async function finishEditor(close: () => void) {
    if (finishing.current) return;
    finishing.current = true; setCommitting(true);
    try { if (await (formCommit.current?.commit() ?? true)) close(); }
    finally { finishing.current = false; setCommitting(false); }
  }
  const reportStatus=useCallback((status:CriteriaSaveStatus)=>setSaveStatus(status),[]);
  const notify = useWorkspaceFeedback();
  const [modified,setModified]=useState<Set<string>>(()=>new Set());
  const [justSaved,setJustSaved]=useState(false);
  const recentTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  useEffect(()=>{
    setModified(new Set());setJustSaved(false);
    if(recentTimer.current)clearTimeout(recentTimer.current);
    return()=>{if(recentTimer.current)clearTimeout(recentTimer.current);};
  },[active]);
  function recordChanges(before:ReturnType<typeof searchPreferences>,after:ReturnType<typeof searchPreferences>){
    const ids=changedCriteriaIds(before,after);
    if(!ids.length)return;
    setModified(current=>new Set([...current,...ids]));setJustSaved(true);
    if(recentTimer.current)clearTimeout(recentTimer.current);
    recentTimer.current=setTimeout(()=>setJustSaved(false),7000);
  }
  const previousSaved=useRef(profile.searchPreferences);
  const wasActive=useRef(active);
  // Also cover changes made in a source's detail (Jobgether).
  useEffect(()=>{
    if(active&&wasActive.current)recordChanges(searchPreferences(previousSaved.current),preferences);
    previousSaved.current=profile.searchPreferences;wasActive.current=active;
  },[profile.searchPreferences,active]); // eslint-disable-line react-hooks/exhaustive-deps
  const [openToken, setOpenToken] = useState<string | null>(null);
  const [editingRow, setEditingRow] = useState<string | null>(null);
  // « + Critère » : the menu first, then the chosen criterion's own control, in the same panel.
  const [adding, setAdding] = useState(false);
  const [addTarget, setAddTarget] = useState<MissingCriterion | null>(null);
  const missing = missingCriteria(preferences).filter(item=>!overview||item.id!=="searchTracks");
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

  /** Every save confirms what changed and how many offers it leaves to review. */
  async function saveWithImpact(next: CandidateProfile) {
    const previous = profile;
    const before = searchPreferences(previous.searchPreferences);
    const after = searchPreferences(next.searchPreferences);
    const saved = await onSave(next);
    const changes = saved ? describeCriteriaChanges(before, after) : [];
    if (changes.length) notify({
      message: impactMessage(changes, countToReview(jobs, before), countToReview(jobs, after)),
    });
    return saved;
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
  const edit=useCallback((target: CriteriaTarget | null) => {
    if (target === "jobgether") { onOpenJobgether(); return; }
    focusTarget.current = target; setView("edit");
  },[onOpenJobgether]);
  useEffect(()=>{if(!active)return;const receive=(event:Event)=>{const target=(event as CustomEvent).detail;if(target==='level'){setView('summary');setAddTarget({id:'level',label:'Niveau visé',help:'Le niveau recherché.',target:'level'});setAdding(true);setOpenToken(null);}else if(target==='roles')edit(target);};window.addEventListener('radar:edit-criterion',receive);return()=>window.removeEventListener('radar:edit-criterion',receive);},[active,edit]);
  useEffect(()=>{if(!adding||addTarget?.id!=='level')return;const frame=requestAnimationFrame(()=>document.querySelector<HTMLElement>('#search-criteria-add-inline button,.search-criteria-popover button')?.focus());return()=>cancelAnimationFrame(frame);},[adding,addTarget?.id]);
  function done() { void finishEditor(() => { returnFocus.current = true; setView(resting); }); }

  return <section className="search-criteria-panel" aria-labelledby="search-criteria-title">
    <header className="search-criteria-panel-header">
      <div>
        <div className="search-criteria-title-line"><h2 id="search-criteria-title" className="source-heading">{overview?"Vos critères":"Critères"}</h2><span className="signal-help" role="status">{justSaved?"Enregistré à l’instant":"Enregistrés automatiquement"}</span></div>
        <div className="criteria-help-line"><p>Vos critères trient les offres.</p><HelpTooltip label="Critères">Les offres hors critères sont masquées dans À examiner. Les alertes des sites externes gardent leurs propres réglages.</HelpTooltip></div>
      </div>
      <div className="search-criteria-panel-actions">
        {view === "edit"
          ? <><span className="search-criteria-save-summary"><span role="status">{saveStatus.state==="error"?"Non enregistré":saveStatus.state==="draft"?"À enregistrer avec Terminé":saveStatus.state==="pending"||saveStatus.state==="saving"?"Enregistrement…":"Enregistré"}</span>{saveStatus.state==="error"&&saveStatus.retry?<WorkspaceButton variant="quiet" onClick={saveStatus.retry}>Réessayer</WorkspaceButton>:null}<span>{countToReview(jobs,preferences)} offres à examiner</span></span>{firstSetup&&!committing&&saveStatus.state!=="draft"?null:<WorkspaceButton variant="primary" busy={committing} onClick={done}>Terminé</WorkspaceButton>}</>
          : <>
            <WorkspaceButton variant="quiet" aria-expanded={view === "details"} aria-controls="search-criteria-details" onClick={toggle}>
              {view === "details" ? "Replier" : "Tout voir"}{view === "details" ? <ChevronUp size={15} aria-hidden /> : <ChevronDown size={15} aria-hidden />}
            </WorkspaceButton>
            <WorkspaceButton ref={editButton} onClick={() => edit(null)}><Pencil size={14} aria-hidden />Tout modifier</WorkspaceButton>
          </>}
      </div>
    </header>

    {view === "summary"&&overview&&!preferences.roles.length?<p className="signal-help">Choisissez votre poste pour commencer.</p>:null}
    {view === "summary"&&overview&&preferences.roles.length?<dl className="mon-radar-criteria-lines">{criteriaGroups(preferences).flatMap(group=>group.rows).filter(row=>!['searchTracks','matchScore'].includes(row.id)).map(row=><div key={row.key??row.id}><dt>{row.label}</dt><dd>{row.id==='roles'?row.values.map(value=><span className="quiet-tag" key={value}>{value}</span>):row.values.join(' · ')}</dd></div>)}</dl>:null}
    {view === "summary" ? <ul className="search-criteria-tokens" aria-label="Critères enregistrés">
      {criteriaTokens(preferences).filter(()=>!overview).filter(token=>!["searchTracks","matchScore"].includes(token.id)).map(token => {
        const label = `${token.label} : ${token.fullValue}. Modifier${modified.has(token.id)?". Modifié lors de cette visite":""}`;
        const content = <><span>{token.label}</span><strong>{token.value}</strong>{modified.has(token.id)?<span className="search-criteria-changed-dot" aria-hidden="true"/>:null}</>;
        if (token.target === "jobgether") return <li key={token.key}><button type="button" className="search-criteria-token" data-tone={token.tone} title={token.fullValue} aria-label={label} onClick={onOpenJobgether}>{content}</button></li>;
        if (mobile) return <li key={token.key}><button type="button" ref={node => { if (node) tokenButtons.current.set(token.key, node); }} className="search-criteria-token" data-tone={token.tone} data-state={openToken === token.key ? "open" : "closed"} title={token.fullValue} aria-label={label} aria-expanded={openToken === token.key} aria-controls="search-criteria-inline" onClick={() => setOpenToken(openToken === token.key ? null : token.key)}>{content}</button></li>;
        return <li key={token.key}>
          <Popover open={openToken === token.key} onOpenChange={open => setOpenToken(open ? token.key : null)}>
            <PopoverTrigger asChild>
              <button type="button" className="search-criteria-token" data-tone={token.tone} title={token.fullValue} aria-label={label}>{content}</button>
            </PopoverTrigger>
            <PopoverContent align="start" collisionPadding={{ top: 12, right: 12, left: 12, bottom: 96 }} className="search-criteria-popover" onInteractOutside={keepOpenForNestedMenus} onFocusOutside={keepOpenForNestedMenus}>
              <SearchPreferencesForm commitRef={formCommit} jobs={jobs} profile={profile} onSave={saveWithImpact} showIntro={false} only={formPart(token.target)} />
              <div className="search-criteria-popover-actions"><WorkspaceButton variant="primary" busy={committing} onClick={() => void finishEditor(() => setOpenToken(null))}>Terminé</WorkspaceButton></div>
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
                <SearchPreferencesForm commitRef={formCommit} jobs={jobs} profile={profile} onSave={saveWithImpact} showIntro={false} only={formPart(addTarget.target)} />
                <div className="search-criteria-popover-actions"><WorkspaceButton variant="primary" busy={committing} onClick={() => void finishEditor(closeAdd)}>Terminé</WorkspaceButton></div>
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
          <SearchPreferencesForm commitRef={formCommit} jobs={jobs} profile={profile} onSave={saveWithImpact} showIntro={false} only={formPart(addTarget.target)} />
          <div className="search-criteria-popover-actions"><WorkspaceButton variant="primary" busy={committing} onClick={() => void finishEditor(closeAdd)}>Terminé</WorkspaceButton></div>
        </>
        : <ul className="search-criteria-add-menu">{missing.map(item => <li key={item.id}>
          <button type="button" onClick={() => setAddTarget(item)}><strong>{item.label}</strong><span>{item.help}</span></button>
        </li>)}</ul>}
    </div> : null}
    {view === "summary" && inlineToken ? <div id="search-criteria-inline" ref={inlineEditor} className="search-criteria-inline-editor">
      <SearchPreferencesForm commitRef={formCommit} jobs={jobs} profile={profile} onSave={saveWithImpact} showIntro={false} only={formPart(inlineToken.target)} />
      <div className="search-criteria-popover-actions"><WorkspaceButton variant="primary" busy={committing} onClick={() => void finishEditor(closeInline)}>Terminé</WorkspaceButton></div>
    </div> : null}

    {view === "details" ? <div id="search-criteria-details" className="search-criteria-details">
      {criteriaGroups(preferences).map(group => <section key={group.id} aria-labelledby={`search-criteria-${group.id}`}>
        <h3 id={`search-criteria-${group.id}`}>{group.title}</h3>
        <dl>{group.rows.map(row => <div key={row.key ?? row.id} className="search-criteria-row" data-editing={editingRow === (row.key ?? row.id) || undefined}>
          <dt>{row.label}</dt>
          <dd><ul className="search-criteria-values">{row.values.map(value => <li key={value} data-tone={row.tone}>{value}</li>)}</ul></dd>
          <dd className="search-criteria-row-action">{editingRow === (row.key ?? row.id) ? null : <WorkspaceButton variant="quiet" aria-label={`Modifier : ${row.label}`} aria-expanded={false} onClick={() => row.target === "jobgether" ? onOpenJobgether() : setEditingRow(row.key ?? row.id)}>Modifier</WorkspaceButton>}</dd>
          {editingRow === (row.key ?? row.id) ? <dd className="search-criteria-row-editor">
            <SearchPreferencesForm commitRef={formCommit} jobs={jobs} profile={profile} onSave={saveWithImpact} showIntro={false} only={formPart(row.target)} />
            <div className="search-criteria-popover-actions"><WorkspaceButton variant="primary" busy={committing} onClick={() => void finishEditor(() => setEditingRow(null))}>Terminé</WorkspaceButton></div>
          </dd> : null}
        </div>)}</dl>
        {group.id==="pay"?<p className="search-criteria-salary-note signal-help">Sans salaire affiché : gardées, à vérifier</p>:null}
      </section>)}
    </div> : null}

    {view === "edit" ? <SearchPreferencesForm commitRef={formCommit} jobs={jobs} profile={profile} onSave={saveWithImpact} showIntro={false} table onStatusChange={reportStatus} onOpenJobgether={onOpenJobgether} /> : null}
    {domainContent}
  </section>;
}
