"use client";
import { requestError } from "@/lib/request-error";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChoiceSelect } from "@/components/choice-select";
import { MoreHorizontal, Plus, RefreshCw } from "lucide-react";
import { ExpandableSection, revealCollapsibleAncestors } from "@/components/experience-section";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { WorkspaceButton, WorkspaceFormError, WorkspacePanelHeader } from "@/components/workspace-form";
import { useWorkspaceFeedback } from "@/components/workspace-feedback";
import { SourceRemovalDialog } from "@/components/source-removal-dialog";
import { isSourceVisible } from "@/lib/source-visibility";
import { SourceCard, type SourceSetting } from "@/components/source-card";
import { SourceList } from "@/components/source-list";
import { sessionWrite } from "@/lib/session-write";
import { SourceDetail } from "@/components/source-detail";
import { SourceAddSheet, type AddFilter } from "@/components/source-add-sheet";
import { followedSourcesSummary, needsAction, sourceStatus } from "@/lib/source-status";
import { sourceDrift } from "@/lib/search-drift";
import { suggestedSources } from "@/lib/source-suggestions";
import { hasSearchedRole, searchPreferences } from "@/lib/search-preferences";
import { sourceCatalog } from "@/lib/source-catalog";
import { validSearchLink } from "@/lib/web-discovery";
import type { JobRecord } from "@/lib/types";
import type { CandidateProfile } from "@/lib/types";
import { SearchCriteriaPanel } from "@/components/search-criteria-panel";
import { lastRefreshAt, refreshMode, refreshModeLabels, refreshedAgo } from "@/lib/refresh-schedule";
import { useDemoMode } from "@/components/demo-mode";
import { readSearchSection, type SearchSection } from "@/lib/radar-navigation";

const initialAlertSources = new Set(["Collective", "Apec", "Free-Work", "We Work Remotely"]);
const initialJobboardSources = new Set(["LinkedIn Jobs", "Welcome to the Jungle", "Wellfound", "Himalayas"]);
const allInitialSources = new Set([...initialAlertSources, ...initialJobboardSources]);

export function SourcePanel({jobs,profile,onSave,onSync,syncBusy=false,syncError="",syncedSettings,onSettingsChanged,onAddOffer,onQuitSession,sessionWriting=false,active=true,headerTarget}:{jobs:JobRecord[];profile:CandidateProfile;onSave:(profile:CandidateProfile)=>Promise<boolean>;onSync:(quiet?:boolean)=>Promise<boolean>;syncBusy?:boolean;syncError?:string;syncedSettings?:SourceSetting[];onSettingsChanged:(sources:SourceSetting[])=>void;onAddOffer?:(url:string)=>void;onQuitSession?:()=>void;sessionWriting?:boolean;active?:boolean;headerTarget?:HTMLElement|null}) {
  const demo=useDemoMode();
  const notify=useWorkspaceFeedback();
  const [settings,setSettings]=useState<SourceSetting[]|null>(null);
  const [seenSettings,setSeenSettings]=useState(syncedSettings);
  useEffect(()=>{const restore=()=>{if(active){const requested=new URLSearchParams(window.location.search).get("sources");if(requested)selectSection(readSearchSection(requested));}};restore();window.addEventListener("popstate",restore);return()=>window.removeEventListener("popstate",restore);},[active]);
  // « Aujourd'hui » links to one source: open its panel, then drop the parameter.
  useEffect(()=>{
    if(!active||!settings)return;
    const wanted=new URLSearchParams(window.location.search).get("source");
    const source=wanted?sourceCatalog.find(item=>item.name===wanted):undefined;
    if(!source)return;
    openDetail(source);
    const url=new URL(window.location.href);
    url.searchParams.delete("source");
    window.history.replaceState(null,"",url.pathname+url.search+url.hash);
  },[active,settings]);
  function selectSection(next:SearchSection){
    const element=document.getElementById("source-panel-"+next);
    revealCollapsibleAncestors(element);
    requestAnimationFrame(()=>element?.scrollIntoView({block:"start"}));
  }
  function openJobgether(){
    selectSection("channels");
    const source=sourceCatalog.find(item=>item.name==="Jobgether");
    if(source)openDetail(source);
    requestAnimationFrame(()=>document.querySelector<HTMLElement>('[data-source="Jobgether"]')?.scrollIntoView({block:"center"}));
  }
  const [loading,setLoading]=useState(true),[loadError,setLoadError]=useState("");

  const [addingSource,setAddingSource]=useState<string|null>(null),[addSourceError,setAddSourceError]=useState("");
  const suggestionTrigger=useRef<HTMLElement|null>(null);
  useEffect(()=>{
    if(addingSource!==null||!suggestionTrigger.current)return;
    const trigger=suggestionTrigger.current;suggestionTrigger.current=null;
    const target=trigger.isConnected?trigger:(document.querySelector<HTMLElement>(".source-suggestions button:not(:disabled)")??document.querySelector<HTMLElement>("#source-panel-channels .signal-panel-actions button"));
    target?.focus();
  },[addingSource,settings]);
  const [detailSource,setDetailSource]=useState<typeof sourceCatalog[number]|null>(null);
  const [addFilter,setAddFilter]=useState<AddFilter|null>(null);
  const [removingSource,setRemovingSource]=useState<typeof sourceCatalog[number]|null>(null);
  const detailTrigger=useRef<HTMLElement|null>(null);
  function openDetail(source:typeof sourceCatalog[number]){
    detailTrigger.current=document.activeElement instanceof HTMLElement?document.activeElement:null;
    setDetailSource(source);
  }
  function restoreDetailFocus(){
    const trigger=detailTrigger.current;
    if(trigger?.isConnected&&trigger!==document.body)trigger.focus();
    else document.querySelector<HTMLElement>("#source-panel-channels button")?.focus();
  }
  const busy=syncBusy;
  if(syncedSettings&&syncedSettings!==seenSettings){setSeenSettings(syncedSettings);setSettings(syncedSettings);setLoadError("");setLoading(false);}
  async function load(){
    setLoading(true);
    try{const response=await fetch("/api/sources",{signal:AbortSignal.timeout(15000),cache:"no-store"});if(!response.ok)throw new Error();const sources=((await response.json()) as {sources:SourceSetting[]}).sources;setSettings(sources);onSettingsChanged(sources);setLoadError("");return true;}
    catch{setLoadError("Impossible de lire la configuration des sources.");return false;}
    finally{setLoading(false);}
  }
  useEffect(()=>{let active=true;fetch("/api/sources",{signal:AbortSignal.timeout(15000),cache:"no-store"}).then(async response=>{if(!response.ok)throw new Error();const data=await response.json() as {sources:SourceSetting[]};if(active){setSettings(data.sources);onSettingsChanged(data.sources);setLoadError("");}}).catch(()=>{if(active)setLoadError("Impossible de lire la configuration des sources.");}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[]);
  async function saveRefreshMode(mode:string){
    const saved=await onSave({...profile,refreshMode:mode==="manual"?"manual":"on_open"});
    notify(saved?{message:mode==="manual"?"Radar n’actualisera plus tout seul.":"Radar actualisera vos flux à l’ouverture."}:{message:"Choix non enregistré. Réessayez.",tone:"error"});
  }

  async function sync(quiet=false){return onSync(quiet);}
  async function visitSource(source:typeof sourceCatalog[number]){
    const writeKey=crypto.randomUUID();sessionWrite(writeKey,true);
    try{
      const response=await fetch("/api/sources",{signal:AbortSignal.timeout(15000),method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({source:source.name,visited:true})});
      const data=await response.json() as {source?:SourceSetting;error?:string};
      if(!response.ok||!data.source)throw new Error(data.error??"Visite non enregistrée.");
      onSourceSaved(data.source);notify({message:`${source.name} marqué comme consulté.`});
    }catch(problem){notify({message:requestError(problem, "Visite non enregistrée."),tone:"error"});}finally{sessionWrite(writeKey,false);}
  }
  const onSourceSaved=(updated:SourceSetting)=>{const next=[updated,...(settings??[]).filter(item=>item.source!==updated.source)];setSettings(next);onSettingsChanged(next);};
  const alertCatalog=sourceCatalog.filter(source=>source.mode==="email"||source.mode==="rss"||source.mode==="api");
  const jobboardCatalog=sourceCatalog.filter(source=>source.mode==="web"||source.mode==="research");
  const sourceVisible=(name:string,defaults:Set<string>)=>isSourceVisible(name,settings??[],defaults);
  async function addSource(name:string){
    if(addingSource!==null)return;
    const existing=settings?.find(item=>item.source===name);
    setAddingSource(name);setAddSourceError("");
    try{const response=await fetch("/api/sources",{signal:AbortSignal.timeout(15000),method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({source:name,notes:existing?.notes??"",linkUrl:existing?.linkUrl??"",selected:true})});const data=await response.json() as {source?:SourceSetting;error?:string};if(!response.ok||!data.source)throw new Error(data.error??"Source non ajoutée.");onSourceSaved(data.source);notify({message:name==="Jobgether"?"Jobgether activé pour ce compte.":`${name} ajouté aux sources suivies.`});if(name==="Jobgether"&&!demo)await sync();}
    catch(problem){setAddSourceError(requestError(problem, "Source non ajoutée."));}
    finally{setAddingSource(null);}
  }
  /** A site the person follows themselves: its URL becomes a source to visit. */
  async function addCustomSite(url:string){
    setAddSourceError("");
    if(!validSearchLink(url)){setAddSourceError("Saisissez une URL https valide.");return false;}
    setAddingSource("Mon site");
    try{
      const response=await fetch("/api/sources",{signal:AbortSignal.timeout(15000),method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({source:"Mon site",notes:settings?.find(item=>item.source==="Mon site")?.notes??"",linkUrl:url,selected:true})});
      const data=await response.json() as {source?:SourceSetting;error?:string};
      if(!response.ok||!data.source)throw new Error(data.error??"Site non ajouté.");
      onSourceSaved(data.source);notify({message:"Votre site est ajouté aux sources à consulter."});
      return true;
    }catch(problem){setAddSourceError(requestError(problem, "Site non ajouté."));return false;}
    finally{setAddingSource(null);}
  }
  const followedSources=[...jobboardCatalog,...alertCatalog].filter(source=>sourceVisible(source.name,allInitialSources));
  const suggested=settings?suggestedSources([...jobboardCatalog,...alertCatalog],searchPreferences(profile.searchPreferences),followedSources.map(source=>source.name)):[];
  // Same rule as the « Action requise » filter: a status to handle or a saved search that drifted.
  const needingAction=settings?followedSources.filter(source=>{const setting=settings.find(item=>item.source===source.name);return needsAction(sourceStatus(setting,source.mode))||sourceDrift(setting,searchPreferences(profile.searchPreferences)).length>0;}).length:0;
  const summary=settings?followedSourcesSummary(followedSources.length,needingAction):"";
  async function addSuggested(name:string,trigger:HTMLElement){
    suggestionTrigger.current=trigger;
    await addSource(name);
  }
  const cards=(modes:readonly string[])=>settings===null
    ? <div className="signal-source-panel">{loadError?<WorkspaceButton disabled={loading} busy={loading} onClick={()=>void load()}>Réessayer de charger les sources</WorkspaceButton>:<LoadingSkeleton label="Chargement des configurations…" rows={2}/>}</div>
    : <div className="source-settings-grid">{sourceCatalog.filter(source=>modes.includes(source.mode)).map(source=><SourceCard key={source.name} source={source} setting={settings.find(item=>item.source===source.name)} count={jobs.filter(job=>job.source===source.name).length} profile={profile} onSaveSearch={onSave} onSaved={onSourceSaved}/>)}</div>;
  return <div className="source-workspace signal-sources-workspace">
    {active&&headerTarget?createPortal(<div className="source-refresh-actions">
      <span className="signal-help" role="status">{refreshedAgo(lastRefreshAt(settings??[]))}</span>
      <WorkspaceButton variant="primary" busy={syncBusy} disabled={busy||!settings||!hasSearchedRole(searchPreferences(profile.searchPreferences))} onClick={()=>void sync()}><RefreshCw size={14} aria-hidden/>Actualiser maintenant</WorkspaceButton>
      <Popover><PopoverTrigger asChild><WorkspaceButton variant="quiet" aria-label="Réglages d’actualisation"><MoreHorizontal size={18} aria-hidden/></WorkspaceButton></PopoverTrigger><PopoverContent align="end"><ChoiceSelect label="Actualisation" value={refreshMode(profile.refreshMode)} options={[{value:"on_open",label:refreshModeLabels.on_open},{value:"manual",label:refreshModeLabels.manual}]} onChange={mode=>void saveRefreshMode(mode)} disabled={demo||busy}/></PopoverContent></Popover>
    </div>,headerTarget):null}
    <div id="source-panel-criteria" className="source-subpanel">
      <SearchCriteriaPanel active={active} profile={profile} jobs={jobs} onSave={onSave} onOpenJobgether={openJobgether}/>
    </div>
    <div id="source-panel-channels" className="source-subpanel">
      <WorkspacePanelHeader id="source-settings-title" title={<span className="source-title-line"><span>Sources suivies</span>{summary?<span className="source-summary">{summary}</span>:null}</span>} actions={<WorkspaceButton variant="secondary" aria-haspopup="dialog" disabled={!settings} onClick={()=>setAddFilter("all")}><Plus size={16} aria-hidden/>Ajouter une source</WorkspaceButton>}/>
      {demo?<p className="signal-help">Les balayages sont fictifs : aucun flux externe n’est contacté. L’ajout d’alertes Collective reste désactivé dans la démo.</p>:null}
      <WorkspaceFormError message={syncError}/><WorkspaceFormError message={loadError}/>
      {settings&&!followedSources.length?<section className="source-empty" aria-labelledby="source-empty-title">
        <h2 id="source-empty-title">Où Radar doit-il chercher ?</h2>
        <p className="signal-help">Choisissez un premier endroit. Vous pourrez en ajouter d’autres à tout moment.</p>
        <div className="source-empty-choices">
          <button type="button" onClick={()=>setAddFilter("automatic")}><strong>Automatiques</strong><span>Radar collecte les offres pour vous, sans compte ni clé. Par exemple Jobgether ou We Work Remotely.</span></button>
          <button type="button" onClick={()=>setAddFilter("manual")}><strong>À consulter</strong><span>Radar prépare les recherches, vous ouvrez le site. Par exemple LinkedIn Jobs ou Welcome to the Jungle.</span></button>
        </div>
      </section>:null}
      {settings===null
        ? <div className="signal-source-panel">{loadError?<WorkspaceButton disabled={loading} busy={loading} onClick={()=>void load()}>Réessayer de charger les sources</WorkspaceButton>:<LoadingSkeleton label="Chargement des configurations…" rows={3}/>}</div>
        : followedSources.length?<SourceList sources={followedSources} settings={settings} jobs={jobs} profile={profile} onOpen={openDetail} onVisit={visitSource}/>:null}
      {settings&&suggested.length?<div className="source-suggestions" role="group" aria-label="Sources suggérées pour vos critères"><span className="signal-help">Suggérées pour vos critères :</span>{suggested.map(source=><WorkspaceButton key={source.name} variant="quiet" disabled={addingSource!==null} busy={addingSource===source.name} onClick={event=>void addSuggested(source.name,event.currentTarget)}><Plus size={14} aria-hidden/>{source.name}</WorkspaceButton>)}</div>:null}
      {addFilter===null?<WorkspaceFormError message={addSourceError}/>:null}
    </div>
    <ExpandableSection title="Autres pistes" className="source-research signal-source-research">
    <div id="source-panel-outreach" className="source-subpanel">
      <section className="signal-source-panel" aria-labelledby="source-strategies-title"><WorkspacePanelHeader id="source-strategies-title" title="Pistes hors annonces"/><p className="signal-help">Pistes de travail, pas campagnes automatiques. Priorité aux organisations distribuées et aux recruteurs qui connaissent les missions produit. Toute prise de contact reste à relire et à envoyer volontairement.</p><div className="signal-source-strategies"><Strategy title="Entreprises ciblées" text="Constituer une liste de SaaS, fintech et acteurs publics/ESN compatibles avec votre expérience. Vérifier leurs pages carrières et pays autorisés, puis préparer une candidature spontanée centrée sur un problème concret de delivery."/><Strategy title="Réseau & communautés" text="Anciens collègues, agences, clients et communautés produit : demander une introduction à un Head of Product ou un recruteur, pas seulement “avez-vous une offre ?”. Repérer ateliers et rencontres où une conversation peut déboucher sur une recommandation."/><Strategy title="Recruteurs spécialisés" text="Présenter une disponibilité claire : PO/PM delivery, tarif à préciser selon la mission, remote prioritaire, présence exceptionnelle négociable. Demander quelles équipes acceptent déjà cette organisation, même sans annonce publiée."/></div><div className="signal-source-message"><h3>Message de mise en relation à adapter</h3><p>« Je cherche une mission PO/PM orientée delivery de produits métiers complexes. Dans cet exemple fictif, j’ai contribué au cadrage d’un produit SaaS. Connaissez-vous une équipe remote qui aurait besoin de structurer son backlog, sécuriser ses livraisons ou renforcer sa recette ? Je suis ouverte aux échanges, même si le besoin n’est pas encore publié. »</p></div></section>
      <section className="source-manual-heading" aria-labelledby="source-manual-title"><h2 id="source-manual-title">Ajouts volontaires</h2><p>Pour les annonces ou posts que vous choisissez d’ajouter vous-même.</p></section>
      {cards(["manual"])}
    </div>
    </ExpandableSection>
    {settings?<SourceAddSheet open={addFilter!==null} initialFilter={addFilter??"all"} sources={[...jobboardCatalog,...alertCatalog]} followed={name=>sourceVisible(name,allInitialSources)} profile={profile} adding={addingSource} error={addSourceError} onAdd={async name=>{await addSource(name);}} onAddSite={addCustomSite} onClose={()=>{setAddFilter(null);setAddSourceError("");}}/>:null}
    <SourceDetail sessionWriting={sessionWriting} onQuitSession={onQuitSession?()=>{setDetailSource(null);onQuitSession();}:undefined} key={detailSource?.name ?? "closed"} onReturnFocus={restoreDetailFocus} source={detailSource} setting={detailSource?settings?.find(item=>item.source===detailSource.name):undefined} jobs={jobs} profile={profile} onClose={()=>setDetailSource(null)} onSaveSearch={onSave} onSaved={onSourceSaved} onRemove={source=>{setDetailSource(null);setRemovingSource(source);}} onVisit={visitSource} onAddOffer={onAddOffer?url=>{setDetailSource(null);onAddOffer(url);}:undefined}/>
    <SourceRemovalDialog focusAfterCancel={restoreDetailFocus} source={removingSource} onClose={()=>setRemovingSource(null)} onRemoved={updated=>{onSourceSaved(updated);setRemovingSource(null);notify({message:`${updated.source} supprimé des sources suivies.`});}} focusAfterRemoval={()=>document.querySelector<HTMLElement>("#source-panel-channels button")?.focus()}/>
  </div>;
}
function Strategy({title,text}:{title:string;text:string}){return <section><h3>{title}</h3><p className="signal-help">{text}</p></section>;}
