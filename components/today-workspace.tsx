"use client";
import {useRadarNextSteps} from "@/components/next-steps-context";
import {useDisplayTimeZone} from "@/components/use-display-time-zone";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowRight, ArrowUpRight, CalendarDays, ClipboardCheck, Columns3, List } from "lucide-react";
import { usePersonalBoard } from "@/components/use-personal-board";
import {ApplicationCareBadge} from "@/components/application-care";
import { ApplicationKanban } from "@/components/application-kanban";
import { RadarMark } from "@/components/radar-mark";
import { WorkspaceButton, WorkspacePanelHeader } from "@/components/workspace-form";
import { hasApplication, inOpportunityView } from "@/lib/opportunity-views";
import { activeStatuses, applicationAge, formatDate, reviewDue, terminalStatuses } from "@/lib/application-workflow";
import { upcomingInterviews } from "@/lib/workspace-agenda";
import { StatusSelect, type WorkspaceView } from "@/components/offer-workspace";
import { PageHeader, WorkspaceState } from "@/components/workspace-ui";
import type { JobRecord, JobStatus } from "@/lib/types";
import { type DailyLot } from "@/lib/daily-lot";
import { useRadarClock } from "@/components/use-radar-clock";

// Recalculate deadlines on entry and explicit data changes; keep the page stable while reading.
function useNow(jobs: JobRecord[]) { const [now,setNow]=useState(()=>Date.now()); useEffect(()=>setNow(Date.now()),[jobs]);return now; }
export function TodayWorkspace({jobs,onTriage,onSelected,onOpen,radarLine,sessionAction,sessionNotice,reach,weekPlan,insight,monthStory}: {monthStory?:ReactNode;insight?:ReactNode;weekPlan?:ReactNode;reach?:ReactNode;sessionAction?:{ready:boolean;minutes:number;available:boolean;resumable:boolean;onStart:()=>void};sessionNotice?:ReactNode;manualRefresh?:boolean;radarLine?:ReactNode;setupRequired?:boolean;onConfigureSearch?:()=>void;jobs:JobRecord[];lot?:DailyLot|null;sources?:{source:string;lastVisitedAt?:string;visitEveryDays?:number;remindInToday?:boolean;state?:string;selected?:boolean;health?:string}[];onTriage:()=>void;onSelected:()=>void;onAdd:()=>void;onOpen:(job:JobRecord,view?:WorkspaceView)=>void;onOpenSource?:(name:string)=>void}) {
  const now=useNow(jobs),clock=useRadarClock(),{queue,ready,onAction,stopped,onResume}=useRadarNextSteps();
  const first=queue[0],following=queue.slice(1,3),upcoming=upcomingInterviews(jobs,now).slice(0,3);
  const count=jobs.filter(job=>inOpportunityView(job,"to_review")).length,selected=jobs.filter(job=>inOpportunityView(job,"selected")).length,active=jobs.filter(job=>hasApplication(job)&&activeStatuses.includes(job.status)).length;
  return <div className="today-layout next-step-home"><div className="today-main">
    <section className="today-focus" aria-label="Prochaine étape">
      <p className="today-session-date">{clock?new Date(clock).toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"}):"Aujourd’hui"}</p>
      <h2 className="today-focus-title">{!ready?"Préparation de votre prochaine étape…":stopped?"C’est tout pour aujourd’hui. Le radar veille.":sessionAction?.resumable?"Votre séance vous attend":first?.label??"C’est tout pour aujourd’hui. Le radar veille."}</h2>
      {!stopped&&first&&ready?<p className="workspace-caption">{sessionAction?.resumable?"Reprenez à l’étape conservée.":first.minutes+" min environ · à votre rythme."}</p>:null}
      {!stopped&&(first||sessionAction?.resumable)?<WorkspaceButton variant="primary" disabled={!ready} onClick={sessionAction?.onStart}>{sessionAction?.resumable?"Reprendre la séance":"Commencer ma séance"}<ArrowRight size={17} aria-hidden/></WorkspaceButton>:stopped?<WorkspaceButton onClick={onResume}>Revoir les étapes</WorkspaceButton>:null}
      <RadarMark className="today-logo-watermark" watermark/>
    </section>
    {ready&&!stopped&&!sessionAction?.resumable&&following.length?<section className="today-next" aria-labelledby="today-next-title"><WorkspacePanelHeader id="today-next-title" title="Puis, si vous le souhaitez"/>{following.map(step=><WorkspaceButton key={step.id} variant="quiet" onClick={()=>onAction(step.action)}><ClipboardCheck size={16} aria-hidden/>{step.label} · {step.minutes} min</WorkspaceButton>)}</section>:null}
    {sessionNotice}
    {weekPlan}
    {radarLine}
    {reach?<details className="today-folded-info"><summary>Réglages du radar</summary>{reach}</details>:null}
    {insight?<details className="today-folded-info"><summary>Vos candidatures en perspective</summary>{insight}</details>:null}
    {monthStory?<details className="today-folded-info"><summary>Votre mois de recherche</summary>{monthStory}</details>:null}
    <details className="today-folded-info"><summary>Prochains entretiens ({upcoming.length})</summary>{upcoming.length?upcoming.map(({job,event})=><WorkspaceButton key={event.id} variant="quiet" onClick={()=>onOpen(job,"interviews")}><CalendarDays size={16} aria-hidden/>{job.company||job.title} · {formatDate(event.startAt,event.timeZone,true)}</WorkspaceButton>):<p className="workspace-caption">Aucun entretien planifié.</p>}</details>
    <div className="today-summary" role="group" aria-label="Résumé de votre recherche"><button type="button" onClick={onTriage}><strong>{count}</strong> à examiner</button><button type="button" onClick={onSelected}><strong>{selected}</strong> dans ma sélection</button><span><strong>{active}</strong> candidature{active>1?"s":""} active{active>1?"s":""}</span></div>
  </div></div>;
}

export function ApplicationsWorkspace({jobs,onStatus,onOpen,placeholder,notice,funnel}:{funnel?:ReactNode;placeholder?:ReactNode;notice?:ReactNode;jobs:JobRecord[];onStatus:(id:string,status:JobStatus,columnId?:string)=>Promise<boolean>;onOpen:(job:JobRecord,view?:WorkspaceView)=>void}) {
  const displayZone=useDisplayTimeZone();
  const [scope,setScope]=useState("active"),[busy,setBusy]=useState<string|null>(null),[error,setError]=useState("");
  const [display,setDisplay]=useState<"list"|"board"|"funnel">("list");
  const statusLock=useRef(false);
  const personal=usePersonalBoard(jobs);
  const now=useNow(jobs);
  const items=jobs.filter(job=>scope==="active"?activeStatuses.includes(job.status):scope==="closed"?terminalStatuses.includes(job.status):true);
  async function changeStatus(job:JobRecord,status:JobStatus,columnId?:string){if(statusLock.current)return false;statusLock.current=true;setBusy(job.id);setError("");try{const saved=await onStatus(job.id,status,columnId);if(!saved)setError("Réessayez de modifier le statut. Le dernier statut confirmé reste affiché.");return saved;}catch{setError("Statut non confirmé. Actualisez pour vérifier avant de réessayer.");return false;}finally{statusLock.current=false;setBusy(null);requestAnimationFrame(()=>{if(document.activeElement!==document.body)return;const trigger=Array.from(document.getElementById(`application-status-${job.id}`)?.querySelectorAll<HTMLButtonElement>("button")??[]).find(element=>element.getClientRects().length);(trigger??document.getElementById("workspace-title"))?.focus();});}}
  return <><PageHeader title="Candidatures"><div className="application-display-toggle" role="group" aria-label="Affichage des candidatures"><button type="button" aria-label="Afficher en tableau" aria-pressed={display==="list"} onClick={()=>setDisplay("list")}><List size={16} aria-hidden/>Tableau</button><button type="button" aria-label="Afficher en Kanban" aria-pressed={display==="board"} onClick={()=>{if(display!=="board")setScope("all");setDisplay("board");}}><Columns3 size={16} aria-hidden/>Kanban</button>{funnel?<button type="button" aria-pressed={display==="funnel"} onClick={()=>setDisplay("funnel")}>Entonnoir</button>:null}</div></PageHeader>
    {display==="funnel"?funnel:placeholder??<div className="applications-workspace">{notice}
    {display==="list"?<div className="applications-toolbar"><nav className="workspace-tabs" aria-label="Vues des candidatures">{[["active","En cours"],["closed","Closes"],["all","Toutes"]].map(([id,label])=><button key={id} type="button" aria-pressed={scope===id} onClick={()=>setScope(id)}>{label}</button>)}</nav></div>:null}
    {error?<WorkspaceState error title="Statut non enregistré">{error}</WorkspaceState>:null}
    {display==="board"&&!personal.ready?<WorkspaceState error={!!personal.error} title={personal.error?"Colonnes indisponibles":"Chargement des colonnes…"}>{personal.error}<WorkspaceButton onClick={()=>void personal.load()}>Réessayer</WorkspaceButton></WorkspaceState>:display==="board"?<ApplicationKanban board={personal.board} onColumn={personal.open} jobs={items} now={now} busy={busy} onStatus={changeStatus} onOpen={onOpen}/>:!items.length?<WorkspaceState title="Aucune candidature dans cette vue">Le bouton « J’ai postulé » d’une offre permet de commencer son suivi.</WorkspaceState>:<div className="applications-list"><div className="applications-heading" aria-hidden="true"><span>Poste</span><span>Envoyée le</span><span>Suite</span><span>Statut</span><span></span></div>{items.map(job=>{
      const followup=job.applicationFollowup?.eligible&&job.applicationFollowup.dueAt&&!job.applicationFollowup.doneAt&&Date.parse(job.applicationFollowup.dueAt)<=now;
      const due=job.interviews?.find(event=>reviewDue(event,now));
      const next=upcomingInterviews([job],now)[0]?.event;
      const age=applicationAge(job.appliedAt,now);
      return <article key={job.id} className="application-row" aria-busy={busy===job.id}>
        <div className="application-identity"><div><h2><button type="button" onClick={()=>onOpen(job,"application")}>{job.title}</button></h2><p>{job.company||"Entreprise à confirmer"}{job.deletedAt?" · Offre en corbeille, suivi conservé":""}</p><ApplicationCareBadge job={job}/><div className="application-inline-sent"><span>Envoyée le</span><span className={`application-age${age?` is-${age.tone}`:""}`}>{job.appliedAt?formatDate(job.appliedAt,displayZone):"Date inconnue"}</span></div></div></div>
        <div className="application-sent"><span className="application-cell-label">Envoyée le</span><span className={`application-age${age?` is-${age.tone}`:""}`}>{job.appliedAt?formatDate(job.appliedAt,displayZone):"Date inconnue"}</span></div>
        <div className="application-next"><span className="application-cell-label">Suite</span><span className={"workspace-badge "+(due?"is-warning":next?"is-success":"")}>{terminalStatuses.includes(job.status)?"Candidature close":due?"Bilan à faire":followup?"Relance à faire":next?"Entretien planifié":job.status==="interview"?"Entretien à suivre":"En attente de retour"}</span>{next?<p>{formatDate(next.startAt,next.timeZone,true)}<br/><small>{next.timeZone}</small></p>:null}</div>
        <div id={`application-status-${job.id}`} className="application-status"><span className="application-cell-label" aria-hidden="true">Statut</span><StatusSelect compact value={job.status} disabled={!!busy} label={"Statut · "+(job.company||job.title)} onChange={status=>void changeStatus(job,status)}/></div>
        <button type="button" className="secondary-button application-open" onClick={()=>onOpen(job,job.status==="offer"?"application":due||next||job.status==="interview"?"interviews":"application")}>{job.status==="offer"?"Ouvrir":due?"Faire le bilan":followup?"Faire la relance":next?"Voir l’entretien":"Ouvrir"}<ArrowUpRight size={15} aria-hidden /></button>
      </article>;
    })}</div>}
    {personal.dialog}
  </div>}
  </>;
}
