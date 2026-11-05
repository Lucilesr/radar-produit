"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, Plus, RefreshCw, Save } from "lucide-react";
import { ExpandableSection } from "@/components/experience-section";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { WorkspaceButton, WorkspaceFormError, WorkspacePanelHeader } from "@/components/workspace-form";
import { useWorkspaceFeedback } from "@/components/workspace-feedback";
import { SourceRemovalDialog } from "@/components/source-removal-dialog";
import { isSourceVisible } from "@/lib/source-visibility";
import { SourceCard, type SourceSetting } from "@/components/source-card";
import { SourceList } from "@/components/source-list";
import { WebDiscoveryPanel } from "@/components/web-discovery-panel";
import { sourceCatalog } from "@/lib/source-catalog";
import { searchTracksFor, trackKindLabels, trackQuery } from "@/lib/search-tracks";
import { formatDate } from "@/lib/application-workflow";
import type { JobRecord } from "@/lib/types";
import type { CandidateProfile } from "@/lib/types";
import { SearchCriteriaPanel } from "@/components/search-criteria-panel";
import { searchPreferences } from "@/lib/search-preferences";
import { useDemoMode } from "@/components/demo-mode";
import { readSearchSection, type SearchSection } from "@/lib/radar-navigation";

const sections: [SearchSection,string][] = [["criteria","Mes critères"],["channels","Sources"],["outreach","Autres pistes"]];
const initialAlertSources = new Set(["Collective", "Apec", "Free-Work", "We Work Remotely"]);
const initialJobboardSources = new Set(["LinkedIn Jobs", "Welcome to the Jungle", "Wellfound", "Himalayas"]);
const allInitialSources = new Set([...initialAlertSources, ...initialJobboardSources]);

export function SourcePanel({jobs,profile,onSave,onSynced,active=true}:{jobs:JobRecord[];profile:CandidateProfile;onSave:(profile:CandidateProfile)=>Promise<boolean>;onSynced:()=>Promise<boolean>;active?:boolean}) {
  const demo=useDemoMode();
  const notify=useWorkspaceFeedback();
  const [settings,setSettings]=useState<SourceSetting[]|null>(null);
  const [section,setSection]=useState<SearchSection>("criteria");
  useEffect(()=>{const restore=()=>{if(active)setSection(readSearchSection(new URLSearchParams(window.location.search).get("sources")));};restore();window.addEventListener("popstate",restore);return()=>window.removeEventListener("popstate",restore);},[active]);
  function selectSection(next:SearchSection){setSection(next);const url=new URL(window.location.href);url.searchParams.set("sources",next);window.history.pushState(null,"",url.pathname+url.search+url.hash);}
  function openJobgether(){selectSection("channels");requestAnimationFrame(()=>document.querySelector<HTMLElement>(".signal-source-api-card")?.scrollIntoView({block:"start"}));}
  const [loading,setLoading]=useState(true),[loadError,setLoadError]=useState("");
  const [operation,setOperation]=useState<"sync"|"alert"|null>(null);
  const [syncError,setSyncError]=useState(""),[alertError,setAlertError]=useState("");
  const [collectiveUrl,setCollectiveUrl]=useState("");
  const [addingSource,setAddingSource]=useState<string|null>(null),[addSourceError,setAddSourceError]=useState("");
  const [removingSource,setRemovingSource]=useState<typeof sourceCatalog[number]|null>(null);
  const locked=useRef(false);
  const busy=operation!==null;
  async function load(){
    setLoading(true);
    try{const response=await fetch("/api/sources",{cache:"no-store"});if(!response.ok)throw new Error();setSettings(((await response.json()) as {sources:SourceSetting[]}).sources);setLoadError("");return true;}
    catch{setLoadError("Impossible de lire la configuration des sources.");return false;}
    finally{setLoading(false);}
  }
  useEffect(()=>{let active=true;fetch("/api/sources",{cache:"no-store"}).then(async response=>{if(!response.ok)throw new Error();const data=await response.json() as {sources:SourceSetting[]};if(active){setSettings(data.sources);setLoadError("");}}).catch(()=>{if(active)setLoadError("Impossible de lire la configuration des sources.");}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[]);
  async function sync(){
    if(locked.current)return;locked.current=true;setOperation("sync");setSyncError("");
    try{
      const response=await fetch("/api/sources/sync",{method:"POST"});
      const data=await response.json() as {error?:string;imported?:number;deduplicated?:number;partialFailure?:boolean};
      if(!response.ok)throw new Error(data.error??"Actualisation non confirmée.");
      const [sourcesRead,jobsRead]=await Promise.all([load(),onSynced()]);
      if(!sourcesRead||!jobsRead)throw new Error("Le flux a répondu, mais les données affichées n’ont pas toutes pu être actualisées. Vos dernières données sont conservées.");
      notify({message:`${data.imported} nouvelles fiches et ${data.deduplicated} fiches déjà présentes.${data.partialFailure?" Une source est indisponible : voir son état ci-dessous.":""}`,tone:data.partialFailure?"info":"success"});
    }catch(problem){setSyncError(problem instanceof Error?problem.message:"Actualisation non confirmée.");}
    finally{locked.current=false;setOperation(null);}
  }
  async function saveCollectiveAlert(){
    if(locked.current)return;locked.current=true;setOperation("alert");setAlertError("");
    try{
      const response=await fetch("/api/sources/collective-alert",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({url:collectiveUrl.trim()})});
      const data=await response.json() as {error?:string;source?:SourceSetting};
      if(!response.ok||!data.source)throw new Error(data.error??"Alerte non enregistrée.");
      setSettings(current=>current?[data.source!,...current.filter(item=>item.source!=="Collective")]:current);
      setCollectiveUrl("");notify({message:"Alerte Collective enregistrée."});
      if(settings===null)await load();
    }catch(problem){setAlertError(problem instanceof Error?problem.message:"Alerte non enregistrée.");}
    finally{locked.current=false;setOperation(null);}
  }
  const collectiveAlert=settings?.find(item=>item.source==="Collective"&&item.selected!==false)?.latestAlert;
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
  const cards=(modes:readonly string[])=>settings===null
    ? <div className="signal-source-panel">{loadError?<WorkspaceButton disabled={loading} busy={loading} onClick={()=>void load()}>Réessayer de charger les sources</WorkspaceButton>:<LoadingSkeleton label="Chargement des configurations…" rows={2}/>}</div>
    : <div className="source-settings-grid">{sourceCatalog.filter(source=>modes.includes(source.mode)).map(source=><SourceCard key={source.name} source={source} setting={settings.find(item=>item.source===source.name)} count={jobs.filter(job=>job.source===source.name).length} profile={profile} onSaveSearch={onSave} onSaved={onSourceSaved}/>)}</div>;
  return <div className="source-workspace signal-sources-workspace">
    <nav className="workspace-tabs" aria-label="Sections de Ma recherche">{sections.map(([id,label])=><button type="button" key={id} aria-pressed={section===id} aria-controls={"source-panel-"+id} onClick={()=>selectSection(id)}>{label}</button>)}</nav>
    <div id="source-panel-criteria" className="source-subpanel" hidden={section!=="criteria"}>
      <SearchCriteriaPanel profile={profile} jobs={jobs} onSave={onSave} onOpenJobgether={openJobgether}/>
      <div className="market-boundary-note"><span className="market-boundary-dot"/><p><strong>Les lieux annoncés servent au classement.</strong> La langue de l’annonce et les pays autorisés pour le télétravail restent à vérifier sur la page employeur.</p></div>
    </div>
    <div id="source-panel-channels" className="source-subpanel" hidden={section!=="channels"}>
      {settings?<SourceAddPanel sources={[...jobboardCatalog,...alertCatalog]} visible={name=>sourceVisible(name,allInitialSources)} adding={addingSource} error={addSourceError} onAdd={addSource}/>:null}
      <section className="signal-source-panel" aria-labelledby="source-settings-title"><WorkspacePanelHeader id="source-settings-title" title="Collecte automatique" actions={!demo?<WorkspaceButton variant="primary" busy={operation==="sync"} disabled={busy} onClick={()=>void sync()}>{operation!=="sync"?<RefreshCw size={14} aria-hidden/>:null}Actualiser mes flux</WorkspaceButton>:null}/><p className="signal-help">Jobgether utilise les postes de « Mes critères » sans compte ni clé. Les alertes email se créent sur les autres sites. Radar ne lit pas vos comptes de jobboards et ne collecte pas le contenu des sites à consulter.</p>{demo?<p className="signal-help">Dans la démo, vous pouvez modifier ce suivi et les liens web. L’ajout d’une alerte Collective et l’actualisation des flux externes sont désactivés.</p>:null}<WorkspaceFormError message={syncError}/><WorkspaceFormError message={loadError}/></section>
      {settings===null
        ? <div className="signal-source-panel">{loadError?<WorkspaceButton disabled={loading} busy={loading} onClick={()=>void load()}>Réessayer de charger les sources</WorkspaceButton>:<LoadingSkeleton label="Chargement des configurations…" rows={3}/>}</div>
        : <SourceList sources={[...jobboardCatalog,...alertCatalog].filter(source=>sourceVisible(source.name,allInitialSources))} settings={settings} jobs={jobs} profile={profile} onSaveSearch={onSave} onSaved={onSourceSaved} onRemove={source=>setRemovingSource(source)} onVisit={visitSource}/>}
      <WebDiscoveryPanel roles={searchPreferences(profile.searchPreferences).roles} settings={settings??[]} onSaved={onSourceSaved}/>
      {collectiveAlert?<section className="signal-source-panel" aria-labelledby="collective-latest-title"><WorkspacePanelHeader id="collective-latest-title" title="Alerte Collective à consulter"/><p className="signal-source-description">{collectiveAlert.label}</p><p className="signal-help">Signalée le {formatDate(collectiveAlert.notificationAt,"Indian/Mauritius",true)}. Ce lien mène à une liste de résultats ; chaque annonce doit être vérifiée avant de devenir une fiche Radar.</p><a href={collectiveAlert.url} target="_blank" rel="noopener noreferrer" className="secondary-button signal-source-link"><ExternalLink size={14} aria-hidden/>Voir les annonces sur Collective</a></section>:null}
      {!demo?<section className="signal-source-panel" aria-labelledby="collective-add-title"><WorkspacePanelHeader id="collective-add-title" title="Ajouter une alerte Collective"/><p className="signal-help">Copiez le lien « See jobs » de l’email. La recherche sera visible ici, sans créer d’offres fictives.</p><form className="signal-collective-form" onSubmit={event=>{event.preventDefault();void saveCollectiveAlert();}}><input type="url" required disabled={busy} aria-label="Lien See jobs de Collective" value={collectiveUrl} onChange={event=>setCollectiveUrl(event.target.value)} placeholder="https://app.collective.work/my-personal-space/jobs?..."/><WorkspaceButton type="submit" variant="primary" busy={operation==="alert"} disabled={busy||!collectiveUrl.trim()}><Save size={14} aria-hidden/>Enregistrer l’alerte</WorkspaceButton></form><WorkspaceFormError message={alertError}/></section>:null}
      <ExpandableSection className="source-research signal-source-research" title="Recherches couvertes"><div className="signal-source-tracks">{searchTracksFor(searchPreferences(profile.searchPreferences)).map(track=><section key={track.id}><h3>{track.label} <span className="quiet-tag">{trackKindLabels[track.kind]}</span></h3><p>{trackQuery(track)}</p></section>)}</div><p className="signal-help">Ces pistes viennent de vos critères. Modifiez-les dans « Mes critères », au groupe « Postes visés ».</p></ExpandableSection>
    </div>
    <div id="source-panel-outreach" className="source-subpanel" hidden={section!=="outreach"}>
      <section className="signal-source-panel" aria-labelledby="source-strategies-title"><WorkspacePanelHeader id="source-strategies-title" title="Pistes hors annonces"/><p className="signal-help">Pistes de travail, pas campagnes automatiques. Priorité aux organisations distribuées et aux recruteurs qui connaissent les missions produit. Toute prise de contact reste à relire et à envoyer volontairement.</p><div className="signal-source-strategies"><Strategy title="Entreprises ciblées" text="Constituer une liste de SaaS, fintech et acteurs publics/ESN compatibles avec votre expérience. Vérifier leurs pages carrières et pays autorisés, puis préparer une candidature spontanée centrée sur un problème concret de delivery."/><Strategy title="Réseau & communautés" text="Anciens collègues, agences, clients et communautés produit : demander une introduction à un Head of Product ou un recruteur, pas seulement “avez-vous une offre ?”. Repérer ateliers et rencontres où une conversation peut déboucher sur une recommandation."/><Strategy title="Recruteurs spécialisés" text="Présenter une disponibilité claire : PO/PM delivery, tarif à préciser selon la mission, remote prioritaire, présence exceptionnelle négociable. Demander quelles équipes acceptent déjà cette organisation, même sans annonce publiée."/></div><div className="signal-source-message"><h3>Message de mise en relation à adapter</h3><p>« Je cherche une mission PO/PM orientée delivery de produits métiers complexes. Dans cet exemple fictif, j’ai contribué au cadrage d’un produit SaaS. Connaissez-vous une équipe remote qui aurait besoin de structurer son backlog, sécuriser ses livraisons ou renforcer sa recette ? Je suis ouverte aux échanges, même si le besoin n’est pas encore publié. »</p></div></section>
      <section className="source-manual-heading" aria-labelledby="source-manual-title"><h2 id="source-manual-title">Ajouts volontaires</h2><p>Pour les annonces ou posts que vous choisissez d’ajouter vous-même.</p></section>
      {cards(["manual"])}
    </div>
    <SourceRemovalDialog source={removingSource} onClose={()=>setRemovingSource(null)} onRemoved={updated=>{onSourceSaved(updated);setRemovingSource(null);notify({message:`${updated.source} supprimé des sources suivies.`});}} focusAfterRemoval={()=>document.querySelector<HTMLElement>("#source-panel-channels .source-add-panel summary")?.focus()}/>
  </div>;
}
function Strategy({title,text}:{title:string;text:string}){return <section><h3>{title}</h3><p className="signal-help">{text}</p></section>;}
function SourceAddPanel({sources,visible,adding,error,onAdd}:{sources:typeof sourceCatalog[number][];visible:(name:string)=>boolean;adding:string|null;error:string;onAdd:(name:string)=>Promise<void>}){const available=sources.filter(source=>!visible(source.name));return <details className="source-add-panel"><summary><span className="source-add-trigger"><Plus size={18} aria-hidden/>Ajouter des sources</span></summary><div className="source-add-content"><p>Jobgether s’active dès son ajout, sans compte ni clé. Les alertes email se configurent sur leur site.</p><div className="source-add-options">{available.map(source=><button type="button" key={source.name} disabled={adding!==null} onClick={()=>void onAdd(source.name)}>{adding===source.name?"Ajout…":<><Plus size={14} aria-hidden/>{source.name}{source.mode==="api"?" · sans compte":null}</>}</button>)}</div>{available.length===0?<p>Toutes les sources proposées sont affichées.</p>:null}<WorkspaceFormError message={error}/></div></details>;}
