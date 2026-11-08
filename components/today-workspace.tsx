"use client";
import {useRadarNextSteps} from "@/components/next-steps-context";
import {useDisplayTimeZone} from "@/components/use-display-time-zone";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowRight, ArrowUpRight, Columns3, List } from "lucide-react";
import { usePersonalBoard } from "@/components/use-personal-board";
import {ApplicationCareBadge} from "@/components/application-care";
import { useIsMobile } from "@/hooks/use-mobile";
import { ApplicationMobileList } from "@/components/application-mobile-list";
import { ApplicationKanban } from "@/components/application-kanban";
import {HelpTooltip} from "@/components/help-tooltip";
import { WorkspaceButton, WorkspacePanelHeader } from "@/components/workspace-form";
import {upcomingInterviews} from "@/lib/workspace-agenda";
import { applicationAge, formatDate, reviewDue, terminalStatuses } from "@/lib/application-workflow";
import { StatusSelect, type WorkspaceView } from "@/components/offer-workspace";
import { PageHeader, WorkspaceState } from "@/components/workspace-ui";
import type { JobRecord, JobStatus } from "@/lib/types";
import {todayStepLabel} from "@/lib/today-presentation";
import type {DailyLot} from "@/lib/daily-lot";
import {Skeleton} from "@/components/ui/skeleton";
import { useRadarClock } from "@/components/use-radar-clock";

// Recalculate deadlines on entry and explicit data changes; keep the page stable while reading.
function useNow(jobs: JobRecord[]) { const [now,setNow]=useState(()=>Date.now()); useEffect(()=>setNow(Date.now()),[jobs]);return now; }
export function TodayPageHeader({name,account,estimate=true}:{name:string;account:ReactNode;estimate?:boolean}){
 const clock=useRadarClock(),{queue,ready,stopped}=useRadarNextSteps();
 const minutes=queue.slice(0,3).reduce((total,step)=>total+step.minutes,0);
 const firstName=name.trim().split(/\s+/)[0];
 return <header className="workspace-page-header today-page-header"><div><p className="today-date">{clock?new Date(clock).toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"}):"Aujourd’hui"}</p><h1 id="workspace-title" tabIndex={-1}>Bonjour{firstName?" "+firstName:""}</h1></div>{estimate&&ready&&!stopped&&minutes?<p className="today-duration">Séance du jour : environ {minutes} minutes</p>:null}<div className="today-mobile-account">{account}</div></header>;
}
export function TodaySkeleton(){
 return <div className="today-aligned today-skeleton" role="status" aria-label="Chargement de votre journée…"><span className="sr-only">Chargement de votre journée…</span><div className="today-skeleton-focus" aria-hidden><Skeleton className="h-4 w-36"/><Skeleton className="h-16 w-full"/><Skeleton className="h-12 w-56"/></div><div className="today-skeleton-lower" aria-hidden>{[0,1].map(i=><div key={i}><Skeleton className="h-6 w-40"/><Skeleton className="h-4 w-full"/><Skeleton className="h-12 w-full"/></div>)}</div></div>;
}
export function TodayWorkspace({radarLine,sessionAction,sessionNotice,weekPlan,insight,monthStory,lot,newAccount=false,onSetup,onScan,roleChosen=false}:{radarLine:ReactNode;weekPlan?:ReactNode;insight?:ReactNode;monthStory?:ReactNode;lot?:DailyLot|null;newAccount?:boolean;roleChosen?:boolean;onSetup?:(section:"criteria"|"sources")=>void;onScan?:()=>void;sessionNotice?:ReactNode;sessionAction:{resumable:boolean;onStart:()=>void}}){
 const {queue,ready,onAction,stopped}=useRadarNextSteps();
 const mobile=useIsMobile();
 const first=queue[0],following=queue.slice(1,3),finished=ready&&(stopped||!first&&!sessionAction.resumable);
 if(newAccount)return <section className="today-setup" aria-labelledby="today-setup-title"><h2 id="today-setup-title">Réglez votre radar en 3 étapes</h2><ol><li><span>1</span><WorkspaceButton variant="quiet" onClick={()=>onSetup?.("criteria")}>Le poste que vous cherchez</WorkspaceButton></li><li><span>2</span><WorkspaceButton variant="quiet" onClick={()=>onSetup?.("sources")}>Trois sources</WorkspaceButton></li><li><span>3</span><WorkspaceButton variant="primary" disabled={!roleChosen} onClick={onScan}>Premier balayage</WorkspaceButton></li></ol><p className="signal-help">Commencez par le poste que vous cherchez.</p></section>;
 if(!ready&&!queue.length)return <TodaySkeleton/>;
 return <div className="today-layout next-step-home today-three-blocks today-aligned"><div className="today-main">
  <section className={`today-focus${finished?" is-finished":""}`} aria-label="Votre séance" aria-busy={!ready}>
   {!finished?<p className="today-session-date">Prochaine étape<span className="today-mobile-estimate">{first?` · ${first.minutes} min`:""}</span></p>:null}
   <h2 className="today-focus-title">{finished?"C’est tout pour aujourd’hui.":sessionAction.resumable?"Votre séance vous attend":first?todayStepLabel(first,lot):"Préparation de votre prochaine étape…"}</h2>
   <p className="workspace-caption">{finished?"Le radar veille. Revenez demain, ou parcourez la réserve si l’envie vous prend.":sessionAction.resumable?"Reprenez à l’étape conservée.":first?`Environ ${first.minutes} minutes.${first.kind==="triage"?" Le reste attend en réserve, sans compter.":" À votre rythme."}`:""}</p>
   {!finished&&(first||sessionAction.resumable)?<WorkspaceButton variant="primary" disabled={!ready} onClick={sessionAction.onStart}>{sessionAction.resumable?"Reprendre la séance":first?.kind==="interview"?"Préparer":"Commencer ma séance"}<ArrowRight size={18} aria-hidden/></WorkspaceButton>:null}
   {ready&&!finished&&!sessionAction.resumable&&following.length?<div className="today-following" aria-labelledby="today-next-title"><h3 id="today-next-title">Ensuite :</h3>{following.map(step=><WorkspaceButton key={step.id} variant="quiet" onClick={()=>onAction(step.action)}><span>{step.label}</span><span className="today-step-time">{step.minutes} min<span className="today-mobile-chevron" aria-hidden> ›</span></span></WorkspaceButton>)}</div>:null}
   {sessionNotice?<div className="today-session-notice">{sessionNotice}</div>:null}
  </section>
  {weekPlan??<section className="week-plan-card" aria-labelledby="today-week-title"><WorkspacePanelHeader id="today-week-title" title="Votre semaine"/><p className="signal-help">Votre semaine apparaîtra quand le compte sera relu.</p></section>}
  <section className="today-radar" aria-labelledby="today-radar-title"><h2 id="today-radar-title">Le radar</h2>{radarLine}{insight?<details className="today-radar-insight" open={!mobile}><summary>Tendance sur 90 jours</summary>{insight}</details>:null}{monthStory}</section>
 </div></div>;
}

export function ApplicationsWorkspace({lessonsActive=false,onLessons,onMainView,lessons,contextualPrompt,jobs,onStatus,onOpen,placeholder,notice,funnel}:{lessonsActive?:boolean;onLessons?:()=>void;onMainView?:()=>void;lessons?:ReactNode;contextualPrompt?:ReactNode;funnel?:ReactNode;placeholder?:ReactNode;notice?:ReactNode;jobs:JobRecord[];onStatus:(id:string,status:JobStatus,columnId?:string)=>Promise<boolean>;onOpen:(job:JobRecord,view?:WorkspaceView)=>void}) {
  const displayZone=useDisplayTimeZone();
  const [scope,setScope]=useState("active"),[busy,setBusy]=useState<string|null>(null),[error,setError]=useState("");
  const [display,setDisplay]=useState<"list"|"board"|"funnel">("list");
  const mobile=useIsMobile();
  const shownDisplay=lessonsActive?"lessons":mobile&&display==="board"?"list":display;
  const statusLock=useRef(false);
  const personal=usePersonalBoard(jobs);
  const now=useNow(jobs);
  const items=jobs.filter(job=>scope==="active"?!terminalStatuses.includes(job.status):scope==="closed"?terminalStatuses.includes(job.status):true);
  async function changeStatus(job:JobRecord,status:JobStatus,columnId?:string){if(statusLock.current)return false;statusLock.current=true;setBusy(job.id);setError("");try{const saved=await onStatus(job.id,status,columnId);if(!saved)setError("Réessayez de modifier le statut. Le dernier statut confirmé reste affiché.");return saved;}catch{setError("Statut non confirmé. Actualisez pour vérifier avant de réessayer.");return false;}finally{statusLock.current=false;setBusy(null);requestAnimationFrame(()=>{if(document.activeElement!==document.body)return;const trigger=Array.from(document.getElementById(`application-status-${job.id}`)?.querySelectorAll<HTMLButtonElement>("button")??[]).find(element=>element.getClientRects().length);(trigger??document.getElementById("workspace-title"))?.focus();});}}
  return <><PageHeader title="Candidatures"><div className="application-display-toggle" role="group" aria-label="Affichage des candidatures"><button type="button" aria-label={mobile?"Afficher la liste par étape":"Afficher en tableau"} aria-pressed={shownDisplay==="list"} onClick={()=>{setDisplay("list");onMainView?.();}}><List size={16} aria-hidden/>{mobile?"Liste":"Tableau"}</button>{!mobile?<button type="button" aria-label="Afficher en Kanban" aria-pressed={shownDisplay==="board"} onClick={()=>{if(shownDisplay!=="board")setScope("all");setDisplay("board");onMainView?.();}}><Columns3 size={16} aria-hidden/>Kanban</button>:null}{funnel?<button type="button" aria-pressed={shownDisplay==="funnel"} onClick={()=>{setDisplay("funnel");onMainView?.();}}>Entonnoir</button>:null}{lessons?<button type="button" aria-pressed={shownDisplay==="lessons"} onClick={onLessons}>Mes leçons</button>:null}</div></PageHeader>
    {shownDisplay==="lessons"?lessons:shownDisplay==="funnel"?funnel:placeholder??<div className="applications-workspace">{notice}{contextualPrompt}
    {shownDisplay==="list"?<div className="applications-toolbar"><nav className="workspace-tabs" aria-label="Vues des candidatures">{[["active","En cours"],["closed","Closes"],["all","Toutes"]].map(([id,label])=><button key={id} type="button" aria-pressed={scope===id} onClick={()=>setScope(id)}>{label}</button>)}</nav></div>:null}
    {error&&!mobile?<WorkspaceState error title="Statut non enregistré">{error}</WorkspaceState>:null}
    {(shownDisplay==="board"||mobile)&&!personal.ready?<WorkspaceState error={!!personal.error} title={personal.error?"Colonnes indisponibles":"Chargement des colonnes…"}>{personal.error}<WorkspaceButton onClick={()=>void personal.load()}>Réessayer</WorkspaceButton></WorkspaceState>:shownDisplay==="board"?<ApplicationKanban board={personal.board} onColumn={personal.open} jobs={items} now={now} busy={busy} onStatus={changeStatus} onOpen={onOpen}/>:!items.length?<WorkspaceState title="Aucune candidature dans cette vue">Le bouton « J’ai postulé » d’une offre permet de commencer son suivi.</WorkspaceState>:mobile?<ApplicationMobileList scope={scope} jobs={items} board={personal.board} now={now} busy={busy} onStatus={changeStatus} onOpen={onOpen} onColumn={personal.open}/>:<div className="applications-list"><div className="applications-heading" aria-hidden="true"><span>Poste</span><span>Envoyée le</span><span>Suite</span><span>Statut</span><span></span></div>{items.map(job=>{
      const followup=job.applicationFollowup?.eligible&&job.applicationFollowup.dueAt&&!job.applicationFollowup.doneAt&&Date.parse(job.applicationFollowup.dueAt)<=now;
      const due=job.interviews?.find(event=>reviewDue(event,now));
      const next=upcomingInterviews([job],now)[0]?.event;
      const age=applicationAge(job.appliedAt,now);
      return <article key={job.id} className="application-row" aria-busy={busy===job.id}>
        <div className="application-identity"><div><h2><button type="button" onClick={()=>onOpen(job,"application")}>{job.title}</button></h2><p>{job.company||"Entreprise à confirmer"}{job.deletedAt?" · Offre en corbeille, suivi conservé":""}</p><ApplicationCareBadge job={job}/><div className="application-inline-sent"><span>Envoyée le</span><span className={`application-age${age?` is-${age.tone}`:""}`}>{job.appliedAt?formatDate(job.appliedAt,displayZone):"Date inconnue"}</span></div></div></div>
        <div className="application-sent"><span className="application-cell-label">Envoyée le</span><span className={`application-age${age?` is-${age.tone}`:""}`}>{job.appliedAt?formatDate(job.appliedAt,displayZone):"Date inconnue"}</span></div>
        <div className="application-next"><span className="application-cell-label">Suite</span><span className={"workspace-badge "+(due?"is-warning":next?"is-success":"")}>{terminalStatuses.includes(job.status)?"Candidature close":job.status==="offer"?"Proposition reçue":due?"Bilan à faire":followup?"Relance à faire":next?"Entretien planifié":job.status==="interview"?"Entretien à suivre":"En attente de retour"}</span>{next?<p>{formatDate(next.startAt,next.timeZone,true)}<br/><small>{next.timeZone}</small></p>:null}</div>
        <div id={`application-status-${job.id}`} className="application-status"><span className="application-cell-label" aria-hidden="true">Statut</span><StatusSelect compact value={job.status} disabled={!!busy} label={"Statut · "+(job.company||job.title)} onChange={status=>void changeStatus(job,status)}/></div>
        <button type="button" className="secondary-button application-open" onClick={()=>onOpen(job,job.status==="offer"?"application":due||next||job.status==="interview"?"interviews":"application")}>{job.status==="offer"?"Ouvrir":due?"Faire le bilan":followup?"Faire la relance":next?"Voir l’entretien":"Ouvrir"}<ArrowUpRight size={15} aria-hidden /></button>
      </article>;
    })}</div>}
    {personal.dialog}
  </div>}
  </>;
}
