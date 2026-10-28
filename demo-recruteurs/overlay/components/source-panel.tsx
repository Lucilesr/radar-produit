"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, RefreshCw, Save } from "lucide-react";
import { ExpandableSection } from "@/components/experience-section";
import { HelpTooltip } from "@/components/help-tooltip";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { WorkspaceButton, WorkspaceFormError, WorkspacePanelHeader } from "@/components/workspace-form";
import { useWorkspaceFeedback } from "@/components/workspace-feedback";
import { SourceCard, type SourceSetting } from "@/components/source-card";
import { WebDiscoveryPanel } from "@/components/web-discovery-panel";
import { sourceCatalog, searchTracks } from "@/lib/source-catalog";
import { formatDate } from "@/lib/application-workflow";
import type { JobRecord } from "@/lib/types";

export function SourcePanel({jobs,onSynced}:{jobs:JobRecord[];onSynced:()=>Promise<boolean>}) {
  const demoReadOnly=true;
  const notify=useWorkspaceFeedback();
  const [settings,setSettings]=useState<SourceSetting[]|null>(null),[group,setGroup]=useState("all");
  const [loading,setLoading]=useState(true),[loadError,setLoadError]=useState("");
  const [operation,setOperation]=useState<"sync"|"alert"|null>(null);
  const [syncError,setSyncError]=useState(""),[alertError,setAlertError]=useState("");
  const [collectiveUrl,setCollectiveUrl]=useState("");
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
      const data=await response.json() as {error?:string;paused?:boolean;cached?:boolean;imported?:number;deduplicated?:number};
      if(!response.ok)throw new Error(data.error??"Actualisation non confirmée.");
      const [sourcesRead,jobsRead]=await Promise.all([load(),onSynced()]);
      if(!sourcesRead||!jobsRead)throw new Error("Le flux a répondu, mais les données affichées n’ont pas toutes pu être actualisées. Vos dernières données sont conservées.");
      notify({message:data.paused?"Le flux est en pause.":data.cached?"Ce flux a déjà été vérifié récemment.":`${data.imported} nouvelles fiches et ${data.deduplicated} fiches déjà présentes. Aucun doublon créé.`,tone:data.paused||data.cached?"info":"success"});
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
  const collectiveAlert=settings?.find(item=>item.source==="Collective")?.latestAlert;
  return <div className="source-workspace signal-sources-workspace">
    <div className="market-boundary-note"><span className="market-boundary-dot"/><p><strong>Recherche sans filtre de pays.</strong> La langue de l’annonce et les pays autorisés pour le télétravail restent à vérifier sur la page employeur.</p></div>
    {collectiveAlert?<section className="signal-source-panel" aria-labelledby="collective-latest-title"><WorkspacePanelHeader id="collective-latest-title" title="Alerte Collective à consulter"/><p className="signal-source-description">{collectiveAlert.label}</p><p className="signal-help">Signalée le {formatDate(collectiveAlert.notificationAt,"Indian/Mauritius",true)}. Ce lien mène à une liste de résultats ; chaque annonce doit être vérifiée avant de devenir une fiche Radar.</p><a href={collectiveAlert.url} target="_blank" rel="noopener noreferrer" className="secondary-button signal-source-link"><ExternalLink size={14} aria-hidden/>Voir les annonces sur Collective</a></section>:null}
    {!demoReadOnly?<section className="signal-source-panel" aria-labelledby="collective-add-title"><WorkspacePanelHeader id="collective-add-title" title="Ajouter une alerte Collective"/><p className="signal-help">Copiez le lien « See jobs » de l’email. La recherche sera visible ici, sans créer d’offres fictives.</p><form className="signal-collective-form" onSubmit={event=>{event.preventDefault();void saveCollectiveAlert();}}><input type="url" required disabled={busy} aria-label="Lien See jobs de Collective" value={collectiveUrl} onChange={event=>setCollectiveUrl(event.target.value)} placeholder="https://app.collective.work/my-personal-space/jobs?..."/><WorkspaceButton type="submit" variant="primary" busy={operation==="alert"} disabled={busy||!collectiveUrl.trim()}><Save size={14} aria-hidden/>Enregistrer l’alerte</WorkspaceButton></form><WorkspaceFormError message={alertError}/></section>:<section className="signal-source-panel"><p className="signal-help">Les connexions et imports externes sont désactivés dans cette démo publique. Les sources affichées servent à illustrer la configuration.</p></section>}
    <section className="signal-source-panel" aria-labelledby="source-settings-title"><WorkspacePanelHeader id="source-settings-title" title="Configuration de la veille" actions={<WorkspaceButton variant="primary" busy={operation==="sync"} disabled={busy||demoReadOnly} onClick={()=>void sync()}>{operation!=="sync"?<RefreshCw size={14} aria-hidden/>:null}{demoReadOnly?"Flux désactivé en démo":"Actualiser le flux remote autorisé"}</WorkspaceButton>}/><div className="inline-help"><span>Choisissez les sources à suivre.</span><HelpTooltip label="Qualification des sources">Radar qualifie le contrat, la rémunération et le remote. Les informations absentes restent à confirmer. Une source n’est connectée qu’après activation.</HelpTooltip></div><WorkspaceFormError message={syncError}/><WorkspaceFormError message={loadError}/><ExpandableSection className="source-research signal-source-research" title="Recherches couvertes"><div className="signal-source-tracks">{searchTracks.map(track=><section key={track.label}><h3>{track.label}</h3><p>{track.query}</p><p className="signal-help">{track.detail}</p></section>)}</div></ExpandableSection></section>
    <nav aria-label="Vues des sources" className="workspace-tabs">{[["all","Toutes les sources"],["web","Recherche web"],["email","Alertes email"],["rss","Flux autorisés"],["research","À qualifier"],["manual","Ajouts volontaires"]].map(([id,name])=><button type="button" key={id} aria-pressed={group===id} onClick={()=>setGroup(id)}>{name}</button>)}</nav>
    {group==="all"||group==="web"?<WebDiscoveryPanel/>:null}
    {settings===null?<div className="signal-source-panel">{loadError?<WorkspaceButton disabled={loading} busy={loading} onClick={()=>void load()}>Réessayer de charger les sources</WorkspaceButton>:<LoadingSkeleton label="Chargement des configurations…" rows={2}/>}</div>:<div className="source-settings-grid">{sourceCatalog.map(source=><SourceCard key={source.name} hidden={group!=="all"&&source.mode!==group} source={source} setting={settings.find(item=>item.source===source.name)} count={jobs.filter(job=>job.source===source.name).length} onSaved={updated=>setSettings(current=>[updated,...(current??[]).filter(item=>item.source!==updated.source)])}/>)}</div>}
    <section className="signal-source-panel" aria-labelledby="source-strategies-title"><WorkspacePanelHeader id="source-strategies-title" title="Pistes hors annonces"/><p className="signal-help">Pistes de travail, pas campagnes automatiques. Priorité aux organisations distribuées et aux recruteurs qui connaissent les missions produit. Toute prise de contact reste à relire et à envoyer volontairement.</p><div className="signal-source-strategies"><Strategy title="Entreprises ciblées" text="Constituer une liste de SaaS, fintech et acteurs publics/ESN compatibles avec votre expérience. Vérifier leurs pages carrières et pays autorisés, puis préparer une candidature spontanée centrée sur un problème concret de delivery."/><Strategy title="Réseau & communautés" text="Anciens collègues, agences, clients et communautés produit : demander une introduction à un Head of Product ou un recruteur, pas seulement “avez-vous une offre ?”. Repérer ateliers et rencontres où une conversation peut déboucher sur une recommandation."/><Strategy title="Recruteurs spécialisés" text="Présenter une disponibilité claire : PO/PM delivery, tarif à préciser selon la mission, remote prioritaire, présence exceptionnelle négociable. Demander quelles équipes acceptent déjà cette organisation, même sans annonce publiée."/></div><div className="signal-source-message"><h3>Message de mise en relation à adapter</h3><p>« Je cherche une mission PO/PM orientée delivery de produits métiers complexes. Dans cet exemple fictif, j’ai contribué au cadrage d’un produit SaaS. Connaissez-vous une équipe remote qui aurait besoin de structurer son backlog, sécuriser ses livraisons ou renforcer sa recette ? Je suis ouverte aux échanges, même si le besoin n’est pas encore publié. »</p></div></section>
  </div>;
}
function Strategy({title,text}:{title:string;text:string}){return <section><h3>{title}</h3><p className="signal-help">{text}</p></section>;}
