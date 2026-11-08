"use client";
import { useEffect, useRef } from "react";
import { ArrowLeft, ArrowRight, RefreshCw } from "lucide-react";
import { SignalCounter } from "@/components/signal/signal-counter";
import { SignalRadar } from "@/components/signal/signal-radar";
import { WorkspaceButton, WorkspaceFormError } from "@/components/workspace-form";
import { sourceCatalog } from "@/lib/source-catalog";
import { isSourceVisible } from "@/lib/source-visibility";
import { automaticSources, type AutomaticSource, type ScanSummary } from "@/lib/source-sync";
import { lastRefreshAt, refreshedAgo } from "@/lib/refresh-schedule";
import type { SourceSetting } from "@/components/source-card";

const plural=(n:number,one:string,many:string)=>n===1?one:many;
const defaults=new Set(["Collective","Apec","Free-Work","We Work Remotely","LinkedIn Jobs","Welcome to the Jungle","Wellfound","Himalayas"]);
function visitLabel(at:string|undefined,now:number){const time=Date.parse(at??"");if(!Number.isFinite(time))return "pas encore visitée";const days=Math.max(0,Math.floor((now-time)/86400000));return days===0?"visitée aujourd’hui":days===1?"dernière visite hier":`dernière visite il y a ${days} jours`;}

export function ScanWorkspace({busy,error,result,sources,sourcesKnown,knownCount,toReviewCount,simulated,now,onRun,onClose,onOffers,onSource}:{busy:boolean;error:string;result:ScanSummary|null;sources:SourceSetting[];sourcesKnown:boolean;knownCount:number;toReviewCount:number;simulated:boolean;now:number;onRun:(source?:AutomaticSource)=>void;onClose:()=>void;onOffers:()=>void;onSource:(source:string)=>void}){
  const heading=useRef<HTMLHeadingElement>(null);
  const wasBusy=useRef(busy);
  useEffect(()=>{heading.current?.focus();},[]);
  useEffect(()=>{if(wasBusy.current&&!busy&&document.activeElement===document.body)heading.current?.focus();wasBusy.current=busy;},[busy]);
  const manual=sourceCatalog.filter(source=>source.mode!=="api"&&source.mode!=="rss"&&source.mode!=="manual"&&isSourceVisible(source.name,sources,defaults));
  const activeCount=automaticSources.filter(name=>{const setting=sources.find(source=>source.source===name);return name==="We Work Remotely"?setting?.selected!==false&&setting?.state!=="paused":setting?.selected===true&&setting.state!=="paused";}).length;
  return <div className="scan-workspace">
    <WorkspaceButton variant="quiet" onClick={onClose}><ArrowLeft size={15} aria-hidden/>Revenir à mon radar</WorkspaceButton>
    {simulated?<p className="signal-help">Balayage fictif : aucun flux externe n’est contacté.</p>:null}
    <section className="scan-echo" aria-labelledby="scan-title" aria-busy={busy}>
      <SignalRadar size={160} scanning={busy} blip={!busy&&!!result?.imported}/>
      <div className="scan-echo-content">
        <p className="scan-eyebrow">{busy?"Balayage en cours":error?"Balayage à reprendre":result?.inactive?"Vos sources sont au repos":result?.partialFailure?"Balayage terminé en partie":"Balayage terminé"}</p>
        <h2 id="scan-title" ref={heading} tabIndex={-1}>{busy?(result?"Reprise du balayage…":!sourcesKnown?"Balayage de vos sources automatiques…":`Balayage de ${activeCount} source${activeCount!==1?"s":""} automatique${activeCount!==1?"s":""}…`):result?.inactive?"Aucune source automatique active":result&&!result.imported&&!error?(result.partialFailure?"Rien de neuf dans les sources lues":"Rien de neuf pour le moment"):error?"Vos offres restent conservées":"Un nouvel écho dans votre recherche"}</h2>
        <p className="scan-status" role="status" aria-live="polite">{busy?"Vous pouvez revenir à votre radar pendant l’actualisation.":result?`${result.total} ${plural(result.total,"offre parcourue","offres parcourues")} · ${result.matching} selon vos critères · ${result.imported} ${plural(result.imported,"nouvelle","nouvelles")} · ${result.deduplicated} ${plural(result.deduplicated,"doublon déjà présent","doublons déjà présents")}.`:"Réessayez l’actualisation ou consultez vos offres déjà connues."}</p>
        {!busy&&result&&!result.imported?<p>{knownCount} offre{knownCount!==1?"s":""} déjà connue{knownCount!==1?"s":""}. {result.sources.some(source=>source.state==="cached")&&result.sources.every(source=>source.state==="cached"||source.state==="paused")?"Les lectures récentes sont conservées en cache ; aucun nouveau parcours n’a été effectué.":result.inactive?"Choisissez une source automatique ou visitez vos sources manuelles.":"Les doublons n’ajoutent pas de nouvelles fiches."}</p>:null}
        {result?.partialFailure&&!busy?<p className="scan-partial-notice">Une source est indisponible. Les autres résultats sont conservés.</p>:null}
        {result?<div className="scan-counters">
          <SignalCounter value={result.total} label={plural(result.total,"offre parcourue","offres parcourues")}/>
          <div className="scan-counter-match"><SignalCounter value={result.matching} label="selon vos critères"/></div>
          <SignalCounter value={result.imported} label={plural(result.imported,"nouvelle offre","nouvelles offres")}/>
          <SignalCounter value={result.deduplicated} label={plural(result.deduplicated,"doublon déjà présent","doublons déjà présents")}/>
        </div>:null}
        {!busy?<div className="scan-actions"><WorkspaceButton variant="primary" onClick={onOffers}>{toReviewCount===0?"Voir mes offres":toReviewCount===1?"Voir l’offre à examiner":`Voir les ${toReviewCount} offres à examiner`}<ArrowRight size={16} aria-hidden/></WorkspaceButton>{result?.inactive?<WorkspaceButton onClick={()=>onSource("We Work Remotely")}>Choisir une source automatique</WorkspaceButton>:error?<WorkspaceButton onClick={()=>onRun()}><RefreshCw size={15} aria-hidden/>Réessayer</WorkspaceButton>:null}</div>:null}
      </div>
    </section>
    <WorkspaceFormError message={error}/>
    <section className="scan-sources" aria-labelledby="scan-sources-title">
      <h3 id="scan-sources-title">Ce que chaque source a donné</h3>
      {result?.sources.length?<ul>{result.sources.map(source=><li key={source.source} data-state={source.state}>
        <div><strong>{source.source}</strong><p>{source.state==="error"?source.error??"Lecture non confirmée.":source.state==="paused"?"En pause ou non activée":source.state==="cached"?`Lecture récente conservée en cache${source.lastSyncedAt?` · ${refreshedAgo(source.lastSyncedAt,now)}`:""}`:`${source.total} ${plural(source.total,"parcourue","parcourues")} · ${source.matchedIds.length} selon vos critères · ${source.imported} ${plural(source.imported,"nouvelle","nouvelles")} · ${source.deduplicated} ${plural(source.deduplicated,"doublon","doublons")}`}</p></div>
        {source.state==="error"?<div>{source.retryAt?<p>Prochain essai possible : {new Date(source.retryAt).toLocaleString("fr-FR")}</p>:null}<WorkspaceButton disabled={busy||Date.parse(source.retryAt??"")>now} onClick={()=>onRun(source.source as AutomaticSource)}>Réessayer {source.source}</WorkspaceButton></div>:null}
      </li>)}</ul>:<p className="signal-help">{busy?"Les résultats apparaîtront à la fin de chaque lecture.":"Aucune lecture confirmée pour ce balayage."}</p>}
      {manual.length?<><h4>Sources à visiter</h4><ul>{manual.map(source=>{const setting=sources.find(item=>item.source===source.name);return <li key={source.name}><div><strong>{source.name}</strong><p>À visiter · {visitLabel(setting?.lastVisitedAt,now)}</p></div><WorkspaceButton onClick={()=>onSource(source.name)}>Voir la source {source.name}</WorkspaceButton></li>;})}</ul></>:null}
    </section>
  </div>;
}

export function ScanStatusLine({sources,busy,hasResult,onOpen,compact=false,newOffers,pendingOffers,error=""}:{sources:SourceSetting[];busy:boolean;hasResult:boolean;onOpen:()=>void;compact?:boolean;newOffers?:number;pendingOffers?:number;error?:string}){
  const readings=sources.filter(source=>(automaticSources as readonly string[]).includes(source.source)&&source.lastSyncedAt);
  const count=readings.reduce((total,source)=>total+(Number.isFinite(source.lastCount)?source.lastCount??0:0),0);
  if(compact)return <div className="scan-status-line is-embedded" role="group" aria-label="Dernières lectures du radar" aria-busy={busy}><SignalRadar size={40} scanning={busy}/><div><p>{busy?"Balayage en cours…":refreshedAgo(lastRefreshAt(readings))}</p><p className="scan-new-offers">{newOffers!==undefined?newOffers+" nouvelle"+(newOffers!==1?"s":"")+" offre"+(newOffers!==1?"s":"")+" au dernier balayage":pendingOffers!==undefined?pendingOffers+" offre"+(pendingOffers!==1?"s":"")+" à examiner":"Offres à relire"}</p></div><WorkspaceButton disabled={busy} onClick={onOpen}>{hasResult?"Voir le bilan":"Actualiser"}</WorkspaceButton><WorkspaceFormError message={error}/></div>;
  return <section className="scan-status-line" aria-label="Dernières lectures du radar"><SignalRadar size={48} scanning={busy}/><div><p>{busy?"Balayage en cours…":refreshedAgo(lastRefreshAt(readings))}</p>{readings.length?<p className="signal-help">{count} offres lors des dernières lectures · {readings.length} source{readings.length>1?"s":""} automatique{readings.length>1?"s":""}</p>:<p className="signal-help">Vos sources à visiter restent accessibles dans Ma recherche.</p>}</div><WorkspaceButton disabled={busy} onClick={onOpen}>{hasResult?"Voir le bilan":"Actualiser"}</WorkspaceButton></section>;
}
