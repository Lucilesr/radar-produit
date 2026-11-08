"use client";
import { useEffect, useRef } from "react";
import { SignalCounter } from "@/components/signal/signal-counter";
import { SignalProgress } from "@/components/signal/signal-progress";
import { SignalRadar } from "@/components/signal/signal-radar";
import { HelpTooltip } from "@/components/help-tooltip";
import { WorkspaceButton, WorkspaceFormError } from "@/components/workspace-form";
import { sourceCatalog } from "@/lib/source-catalog";
import { scanBar, scanPlan, scanSourceGroups, scanSourceStatus, sortedScanReadings, visitUrl, type ScanSourceProgress } from "@/lib/scan-presentation";
import { automaticSources, type AutomaticSource, type ScanSummary } from "@/lib/source-sync";
import { lastRefreshAt, refreshedAgo } from "@/lib/refresh-schedule";
import type { SourceSetting } from "@/components/source-card";

function visitLabel(at:string|undefined,now:number){const time=Date.parse(at??"");if(!Number.isFinite(time))return "jamais visitée";const days=Math.max(0,Math.floor((now-time)/86400000));return days===0?"aujourd’hui":days===1?"hier":`${days} jours`;}

export function ScanWorkspace({busy,error,result,progress,newIds,sources,sourcesKnown,knownCount,toReviewCount,simulated,now,onRun,onOffers,onSource}:{busy:boolean;error:string;result:ScanSummary|null;progress:ScanSourceProgress[];newIds:string[];sources:SourceSetting[];sourcesKnown:boolean;knownCount:number;toReviewCount:number;simulated:boolean;now:number;onRun:(source?:AutomaticSource)=>void;onOffers:(source?:string)=>void;onSource:(source:string)=>void}){
  const heading=useRef<HTMLHeadingElement>(null),wasBusy=useRef(busy);
  useEffect(()=>{document.getElementById("workspace-title")?.focus();},[]);
  useEffect(()=>{if(wasBusy.current&&!busy&&document.activeElement===document.body)heading.current?.focus();wasBusy.current=busy;},[busy]);
  const groups=scanSourceGroups(sourceCatalog,sources),rows=sortedScanReadings(result?.sources??[]);
  const statuses=progress.length?progress:scanPlan(sources),active=statuses.filter(item=>item.state!=="paused");
  const completed=active.filter(item=>item.state!=="waiting"&&item.state!=="running").length;
  const echoes=[...new Set(result?.sources.flatMap(source=>source.matchedIds)??[])];
  const newMatching=echoes.filter(id=>newIds.includes(id)).length;
  const moment=busy||!error&&newMatching>0;
  const max=Math.max(0,...rows.map(row=>row.total));
  const title=busy?`Balayage de ${active.length} source${active.length!==1?"s":""}…`:error?"Le balayage n’a pas abouti.":result?.inactive?"Vos sources sont au repos":newMatching?`${newMatching} nouvelle${newMatching!==1?"s":""} offre${newMatching!==1?"s":""} pour vous`:result?`Rien de nouveau depuis ${new Date(result.at).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})}`:"Prêt pour le premier balayage";
  function offersLink(source:string){return <a href={`?tab=offers&source=${encodeURIComponent(source)}`} className="scan-source-offers" aria-label={`Voir les offres de ${source}`} onClick={event=>{event.preventDefault();onOffers(source);}}><span className="scan-desktop-label">Voir ses offres</span><span className="scan-mobile-label">Voir</span></a>;}
  function visits(items:typeof groups.visits){return <ul className="scan-visits-list">{items.map(source=>{const setting=sources.find(item=>item.source===source.name),url=visitUrl(source,sources);return <li key={source.name}><span>{source.name} · {visitLabel(setting?.lastVisitedAt,now)}</span>{url?<a href={url} target="_blank" rel="noopener noreferrer" aria-label={`Visiter ${source.name}`}>Visiter <span aria-hidden>›</span></a>:<WorkspaceButton variant="quiet" aria-label={`Configurer le lien de ${source.name}`} onClick={()=>onSource(source.name)}>Configurer</WorkspaceButton>}</li>;})}</ul>;}
  return <div className="scan-workspace">
    <section className={`scan-echo${moment?" is-moment":" is-quiet"}`} aria-labelledby="scan-title" data-state={busy?"running":error?"error":newMatching?"new":"quiet"}>
      <div className="scan-radar-figure"><SignalRadar size={moment?200:96} scanning={busy} echoes={echoes} newIds={newIds}/></div>
      <div className="scan-echo-content">
        <p className="scan-eyebrow">{busy?"Balayage en cours":error?"Balayage à reprendre":result?.partialFailure?"Balayage terminé en partie":result?"Balayage terminé":"Votre radar"}</p>
        <h2 id="scan-title" ref={heading} tabIndex={-1}>{title}</h2>
        {!busy&&result&&!error?<p className="scan-echo-caption">Balayage terminé · {echoes.length} offre{echoes.length!==1?"s collent":" colle"} à vos critères</p>:null}
        {busy?<div className="scan-live-progress"><p>{completed} source{completed!==1?"s":""} sur {active.length}</p><SignalProgress value={completed} max={active.length} label="Sources balayées" tone="energy"/></div>:null}
        <ul className={`scan-live-statuses${busy?"":" sr-only"}`}>{active.map(item=><li key={item.source}><span aria-live="polite" aria-atomic="true">{item.source} · {scanSourceStatus(item.state)}</span></li>)}</ul>
        {!busy&&moment&&result?<div className="scan-counters"><SignalCounter value={result.total} label={result.total===1?"parcourue":"parcourues"}/><div className="scan-counter-match"><SignalCounter value={result.matching} label="pour vous"/></div><SignalCounter value={result.imported} label={result.imported===1?"nouvelle":"nouvelles"}/></div>:null}
        {!busy&&!moment&&!error?<p className="scan-quiet-summary">{result?.inactive?"Activez une source ou visitez vos sites suivis.":result?`${result.total} offres parcourues · ${toReviewCount} offres à examiner.`:`${knownCount} offres connues. ${sourcesKnown?"Actualisez vos sources pour lire leur bilan.":"Lecture des sources…"}`}</p>:null}
        {error?<p className="scan-error-message" role="alert">Vos offres restent conservées. Réessayez le balayage.</p>:null}
        {!busy?<div className="scan-actions">{error?<WorkspaceButton variant="primary" onClick={()=>onRun()}>Réessayer</WorkspaceButton>:result?.inactive?<WorkspaceButton variant="primary" onClick={()=>onSource("We Work Remotely")}>Choisir une source</WorkspaceButton>:<WorkspaceButton variant="primary" onClick={()=>onOffers()}>Voir mon lot du jour</WorkspaceButton>}{result&&!error&&moment?<HelpTooltip label={`${result.deduplicated} doublons fusionnés`}>Les {result.deduplicated} doublons déjà connus n’ajoutent pas de nouvelle fiche. Les lectures récentes en cache ne sont pas recomptées.</HelpTooltip>:null}</div>:null}
      </div>
    </section>
    {result?.partialFailure&&!busy?<p className="scan-partial-notice">Une source n’a pas répondu. Les autres résultats sont enregistrés.</p>:null}
    <section className="scan-sources" aria-labelledby="scan-sources-title">
      <div className="scan-sources-heading"><h2 id="scan-sources-title"><span className="scan-desktop-label">Ce que chaque source a donné</span><span className="scan-mobile-label">Par source</span></h2><p className="scan-bar-legend"><span>pour vous</span><span>parcourues</span></p></div>
      {rows.length?<ul className="scan-readings">{rows.map(source=>{const bar=scanBar(source,max);return <li className="scan-source-row" key={source.source} data-state={source.state}>
        <strong>{source.source}</strong>
        {source.state==="error"?<><p className="scan-source-error">N’a pas répondu.{source.retryAt?<span> Nouvel essai : {new Date(source.retryAt).toLocaleString("fr-FR")}</span>:null}</p><WorkspaceButton disabled={busy||Date.parse(source.retryAt??"")>now} aria-label={`Réessayer ${source.source}`} onClick={()=>onRun(source.source as AutomaticSource)}>Réessayer<span className="scan-desktop-label"> {source.source}</span></WorkspaceButton></>:<>
          <div className="scan-source-bar" aria-hidden="true"><span style={{width:`${bar.width}%`}}><span style={{width:`${bar.matching}%`}}/></span></div>
          <p className="scan-source-figures">{source.state==="cached"?<span>Lecture récente conservée</span>:<><span>{source.total} parcourue{source.total!==1?"s":""}</span> · <strong>{source.matchedIds.length} pour vous</strong> · <span>{source.imported} nouvelle{source.imported!==1?"s":""}</span></>}</p>{offersLink(source.source)}
        </>}
      </li>;})}</ul>:<p className="signal-help">{busy?"Les sources terminées apparaissent ici au fur et à mesure.":"Aucune lecture confirmée pour ce balayage."}</p>}
      {groups.paused.length?<details className="scan-fold"><summary>{groups.paused.length} sources en pause <span aria-hidden>▸</span></summary><ul>{groups.paused.map(source=><li key={source.name}>{source.name}<span>En pause ou non activée</span></li>)}</ul></details>:null}
    </section>
    {groups.visits.length?<section className="scan-visits" aria-labelledby="scan-visits-title"><h2 id="scan-visits-title">À visiter</h2>{visits(groups.visits)}{groups.otherVisits.length?<details className="scan-fold"><summary>+ {groups.otherVisits.length} autres</summary>{visits(groups.otherVisits)}</details>:null}</section>:null}
    {simulated?<p className="scan-simulation">Balayage fictif · aucun flux externe contacté.</p>:null}
  </div>;
}

export function ScanStatusLine({sources,busy,hasResult,onOpen,compact=false,newOffers,pendingOffers,error=""}:{sources:SourceSetting[];busy:boolean;hasResult:boolean;onOpen:()=>void;compact?:boolean;newOffers?:number;pendingOffers?:number;error?:string}){
  const readings=sources.filter(source=>(automaticSources as readonly string[]).includes(source.source)&&source.lastSyncedAt);
  const count=readings.reduce((total,source)=>total+(Number.isFinite(source.lastCount)?source.lastCount??0:0),0);
  if(compact)return <div className="scan-status-line is-embedded" role="group" aria-label="Dernières lectures du radar" aria-busy={busy}><SignalRadar size={40} scanning={busy}/><div><p>{busy?"Balayage en cours…":refreshedAgo(lastRefreshAt(readings))}</p><p className="scan-new-offers">{newOffers!==undefined?newOffers+" nouvelle"+(newOffers!==1?"s":"")+" offre"+(newOffers!==1?"s":"")+" au dernier balayage":pendingOffers!==undefined?pendingOffers+" offre"+(pendingOffers!==1?"s":"")+" à examiner":"Offres à relire"}</p></div><WorkspaceButton disabled={busy} onClick={onOpen}>{hasResult?"Voir le bilan":"Actualiser"}</WorkspaceButton><WorkspaceFormError message={error}/></div>;
  return <section className="scan-status-line" aria-label="Dernières lectures du radar"><SignalRadar size={48} scanning={busy}/><div><p>{busy?"Balayage en cours…":refreshedAgo(lastRefreshAt(readings))}</p>{readings.length?<p className="signal-help">{count} offres lors des dernières lectures · {readings.length} source{readings.length>1?"s":""} automatique{readings.length>1?"s":""}</p>:<p className="signal-help">Vos sources à visiter restent accessibles dans Mon radar → Où chercher.</p>}</div><WorkspaceButton disabled={busy} onClick={onOpen}>{hasResult?"Voir le bilan":"Actualiser"}</WorkspaceButton></section>;
}
