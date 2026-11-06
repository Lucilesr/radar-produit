"use client";

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
import { SourceDetail } from "@/components/source-detail";
import { SourceAddSheet, type AddFilter } from "@/components/source-add-sheet";
import { sourceCatalog } from "@/lib/source-catalog";
import { validSearchLink } from "@/lib/web-discovery";
import type { JobRecord } from "@/lib/types";
import type { CandidateProfile } from "@/lib/types";
import { SearchCriteriaPanel } from "@/components/search-criteria-panel";
import { lastRefreshAt, refreshMode, refreshModeLabels, refreshedAgo, shouldRefreshOnOpen } from "@/lib/refresh-schedule";
import { useDemoMode } from "@/components/demo-mode";
import { readSearchSection, type SearchSection } from "@/lib/radar-navigation";

const initialAlertSources = new Set(["Collective", "Apec", "Free-Work", "We Work Remotely"]);
const initialJobboardSources = new Set(["LinkedIn Jobs", "Welcome to the Jungle", "Wellfound", "Himalayas"]);
const allInitialSources = new Set([...initialAlertSources, ...initialJobboardSources]);

export function SourcePanel({jobs,profile,onSave,onSynced,onAddOffer,active=true,headerTarget}:{jobs:JobRecord[];profile:CandidateProfile;onSave:(profile:CandidateProfile)=>Promise<boolean>;onSynced:()=>Promise<boolean>;onAddOffer?:(url:string)=>void;active?:boolean;headerTarget?:HTMLElement|null}) {
  const demo=useDemoMode();
  const notify=useWorkspaceFeedback();
  const [settings,setSettings]=useState<SourceSetting[]|null>(null);
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
  const [operation,setOperation]=useState<"sync"|null>(null);
  const [syncError,setSyncError]=useState("");
  const [addingSource,setAddingSource]=useState<string|null>(null),[addSourceError,setAddSourceError]=useState("");
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
  const locked=useRef(false);
  const busy=operation!==null;
  async function load(){
    setLoading(true);
    try{const response=await fetch("/api/sources",{cache:"no-store"});if(!response.ok)throw new Error();setSettings(((await response.json()) as {sources:SourceSetting[]}).sources);setLoadError("");return true;}
    catch{setLoadError("Impossible de lire la configuration des sources.");return false;}
    finally{setLoading(false);}
  }
  useEffect(()=>{let active=true;fetch("/api/sources",{cache:"no-store"}).then(async response=>{if(!response.ok)throw new Error();const data=await response.json() as {sources:SourceSetting[]};if(active){setSettings(data.sources);setLoadError("");}}).catch(()=>{if(active)setLoadError("Impossible de lire la configuration des sources.");}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[]);
  // One attempt per visit: the caches of each source still decide what is really fetched.
  const autoRefreshed=useRef(false);
  useEffect(()=>{
    if(!active||demo||!settings||autoRefreshed.current)return;
    if(!shouldRefreshOnOpen(refreshMode(profile.refreshMode),lastRefreshAt(settings)))return;
    autoRefreshed.current=true;
    void sync(true);
  },[active,demo,settings,profile.refreshMode]); // eslint-disable-line react-hooks/exhaustive-deps

  async function saveRefreshMode(mode:string){
    const saved=await onSave({...profile,refreshMode:mode==="manual"?"manual":"on_open"});
    notify(saved?{message:mode==="manual"?"Radar n’actualisera plus tout seul.":"Radar actualisera vos flux à l’ouverture."}:{message:"Choix non enregistré. Réessayez.",tone:"error"});
  }

  async function sync(quiet=false){
    if(locked.current)return;locked.current=true;setOperation("sync");setSyncError("");
    try{
      const response=await fetch("/api/sources/sync",{method:"POST"});
      const data=await response.json() as {error?:string;imported?:number;deduplicated?:number;partialFailure?:boolean};
      if(!response.ok)throw new Error(data.error??"Actualisation non confirmée.");
      const [sourcesRead,jobsRead]=await Promise.all([load(),onSynced()]);
      if(!sourcesRead||!jobsRead)throw new Error("Le flux a répondu, mais les données affichées n’ont pas toutes pu être actualisées. Vos dernières données sont conservées.");
      if(!quiet||data.imported)notify({message:`${data.imported} nouvelles fiches et ${data.deduplicated} fiches déjà présentes.${data.partialFailure?" Une source est indisponible : voir son état ci-dessous.":""}`,tone:data.partialFailure?"info":"success"});
    }catch(problem){setSyncError(problem instanceof Error?problem.message:"Actualisation non confirmée.");}
    finally{locked.current=false;setOperation(null);}
  }
  async function visitSource(source:typeof sourceCatalog[number]){
    try{
      const response=await fetch("/api/sources",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({source:source.name,visited:true})});
      const data=await response.json() as {source?:SourceSetting;error?:string};
      if(!response.ok||!data.source)throw new Error(data.error??"Visite non enregistrée.");
      onSourceSaved(data.source);notify({message:`${source.name} marqué comme consulté.`});
    }catch(problem){notify({message:problem instanceof Error?problem.message:"Visite non enregistrée.",tone:"error"});}
  }
  const onSourceSaved=(updated:SourceSetting)=>setSettings(current=>[updated,...(current??[]).filter(item=>item.source!==updated.source)]);
  const alertCatalog=sourceCatalog.filter(source=>source.mode==="email"||source.mode==="rss"||source.mode==="api");
  const jobboardCatalog=sourceCatalog.filter(source=>source.mode==="web"||source.mode==="research");
  const sourceVisible=(name:string,defaults:Set<string>)=>isSourceVisible(name,settings??[],defaults);
  async function addSource(name:string){
    const existing=settings?.find(item=>item.source===name);
    setAddingSource(name);setAddSourceError("");
    try{const response=await fetch("/api/sources",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({source:name,state:existing?.state??"not_configured",notes:existing?.notes??"",linkUrl:existing?.linkUrl??"",selected:true})});const data=await response.json() as {source?:SourceSetting;error?:string};if(!response.ok||!data.source)throw new Error(data.error??"Source non ajoutée.");onSourceSaved(data.source);notify({message:name==="Jobgether"?"Jobgether activé pour ce compte.":`${name} ajouté aux sources à configurer.`});if(name==="Jobgether"&&!demo)await sync();}
    catch(problem){setAddSourceError(problem instanceof Error?problem.message:"Source non ajoutée.");}
    finally{setAddingSource(null);}
  }
  /** A site the person follows themselves: its URL becomes a source to visit. */
  async function addCustomSite(url:string){
    setAddSourceError("");
    if(!validSearchLink(url)){setAddSourceError("Saisissez une URL https valide.");return false;}
    setAddingSource("Mon site");
    try{
      const response=await fetch("/api/sources",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({source:"Mon site",state:"configured",notes:settings?.find(item=>item.source==="Mon site")?.notes??"",linkUrl:url,selected:true})});
      const data=await response.json() as {source?:SourceSetting;error?:string};
      if(!response.ok||!data.source)throw new Error(data.error??"Site non ajouté.");
      onSourceSaved(data.source);notify({message:"Votre site est ajouté aux sources à consulter."});
      return true;
    }catch(problem){setAddSourceError(problem instanceof Error?problem.message:"Site non ajouté.");return false;}
    finally{setAddingSource(null);}
  }
  const followedSources=[...jobboardCatalog,...alertCatalog].filter(source=>sourceVisible(source.name,allInitialSources));
  const cards=(modes:readonly string[])=>settings===null
    ? <div className="signal-source-panel">{loadError?<WorkspaceButton disabled={loading} busy={loading} onClick={()=>void load()}>Réessayer de charger les sources</WorkspaceButton>:<LoadingSkeleton label="Chargement des configurations…" rows={2}/>}</div>
    : <div className="source-settings-grid">{sourceCatalog.filter(source=>modes.includes(source.mode)).map(source=><SourceCard key={source.name} source={source} setting={settings.find(item=>item.source===source.name)} count={jobs.filter(job=>job.source===source.name).length} profile={profile} onSaveSearch={onSave} onSaved={onSourceSaved}/>)}</div>;
  return <div className="source-workspace signal-sources-workspace">
    {active&&headerTarget?createPortal(<div className="source-refresh-actions">
      <span className="signal-help" role="status">{refreshedAgo(lastRefreshAt(settings??[]))}</span>
      <WorkspaceButton variant="primary" busy={operation==="sync"} disabled={demo||busy||!settings} onClick={()=>void sync()}><RefreshCw size={14} aria-hidden/>Actualiser maintenant</WorkspaceButton>
      <Popover><PopoverTrigger asChild><WorkspaceButton variant="quiet" aria-label="Réglages d’actualisation"><MoreHorizontal size={18} aria-hidden/></WorkspaceButton></PopoverTrigger><PopoverContent align="end"><ChoiceSelect label="Actualisation" value={refreshMode(profile.refreshMode)} options={[{value:"on_open",label:refreshModeLabels.on_open},{value:"manual",label:refreshModeLabels.manual}]} onChange={mode=>void saveRefreshMode(mode)} disabled={demo||busy}/></PopoverContent></Popover>
    </div>,headerTarget):null}
    <div id="source-panel-criteria" className="source-subpanel">
      <SearchCriteriaPanel profile={profile} jobs={jobs} onSave={onSave} onOpenJobgether={openJobgether}/>
      <div className="market-boundary-note"><span className="market-boundary-dot"/><p><strong>Les lieux annoncés servent au classement.</strong> La langue de l’annonce et les pays autorisés pour le télétravail restent à vérifier sur la page employeur.</p></div>
    </div>
    <div id="source-panel-channels" className="source-subpanel">
      <WorkspacePanelHeader id="source-settings-title" title="Sources" actions={<WorkspaceButton variant="secondary" aria-haspopup="dialog" disabled={!settings} onClick={()=>setAddFilter("all")}><Plus size={16} aria-hidden/>Ajouter une source</WorkspaceButton>}/>
      <p className="signal-help">Radar collecte les flux automatiques et prépare vos recherches sur les sites à consulter, sans lire vos comptes.</p>
      {demo?<p className="signal-help">L’actualisation des flux externes et l’ajout d’alertes Collective sont désactivés dans la démo.</p>:null}
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
    </div>
    <ExpandableSection title="Autres pistes" className="source-research signal-source-research">
    <div id="source-panel-outreach" className="source-subpanel">
      <section className="signal-source-panel" aria-labelledby="source-strategies-title"><WorkspacePanelHeader id="source-strategies-title" title="Pistes hors annonces"/><p className="signal-help">Pistes de travail, pas campagnes automatiques. Priorité aux organisations distribuées et aux recruteurs qui connaissent les missions produit. Toute prise de contact reste à relire et à envoyer volontairement.</p><div className="signal-source-strategies"><Strategy title="Entreprises ciblées" text="Constituer une liste de SaaS, fintech et acteurs publics/ESN compatibles avec votre expérience. Vérifier leurs pages carrières et pays autorisés, puis préparer une candidature spontanée centrée sur un problème concret de delivery."/><Strategy title="Réseau & communautés" text="Anciens collègues, agences, clients et communautés produit : demander une introduction à un Head of Product ou un recruteur, pas seulement “avez-vous une offre ?”. Repérer ateliers et rencontres où une conversation peut déboucher sur une recommandation."/><Strategy title="Recruteurs spécialisés" text="Présenter une disponibilité claire : PO/PM delivery, tarif à préciser selon la mission, remote prioritaire, présence exceptionnelle négociable. Demander quelles équipes acceptent déjà cette organisation, même sans annonce publiée."/></div><div className="signal-source-message"><h3>Message de mise en relation à adapter</h3><p>« Je cherche une mission PO/PM orientée delivery de produits métiers complexes. Dans cet exemple fictif, j’ai contribué au cadrage d’un produit SaaS. Connaissez-vous une équipe remote qui aurait besoin de structurer son backlog, sécuriser ses livraisons ou renforcer sa recette ? Je suis ouverte aux échanges, même si le besoin n’est pas encore publié. »</p></div></section>
      <section className="source-manual-heading" aria-labelledby="source-manual-title"><h2 id="source-manual-title">Ajouts volontaires</h2><p>Pour les annonces ou posts que vous choisissez d’ajouter vous-même.</p></section>
      {cards(["manual"])}
    </div>
    </ExpandableSection>
    {settings?<SourceAddSheet open={addFilter!==null} initialFilter={addFilter??"all"} sources={[...jobboardCatalog,...alertCatalog]} followed={name=>sourceVisible(name,allInitialSources)} profile={profile} adding={addingSource} error={addSourceError} onAdd={async name=>{await addSource(name);}} onAddSite={addCustomSite} onClose={()=>{setAddFilter(null);setAddSourceError("");}}/>:null}
    <SourceDetail onReturnFocus={restoreDetailFocus} source={detailSource} setting={detailSource?settings?.find(item=>item.source===detailSource.name):undefined} jobs={jobs} profile={profile} onClose={()=>setDetailSource(null)} onSaveSearch={onSave} onSaved={onSourceSaved} onRemove={source=>{setDetailSource(null);setRemovingSource(source);}} onVisit={visitSource} onAddOffer={onAddOffer?url=>{setDetailSource(null);onAddOffer(url);}:undefined}/>
    <SourceRemovalDialog source={removingSource} onClose={()=>setRemovingSource(null)} onRemoved={updated=>{onSourceSaved(updated);setRemovingSource(null);notify({message:`${updated.source} supprimé des sources suivies.`});}} focusAfterRemoval={()=>document.querySelector<HTMLElement>("#source-panel-channels button")?.focus()}/>
  </div>;
}
function Strategy({title,text}:{title:string;text:string}){return <section><h3>{title}</h3><p className="signal-help">{text}</p></section>;}
