"use client";
import {useDisplayTimeZone} from "@/components/use-display-time-zone";
import {weekKey} from "@/lib/week-plan";
import {useRadarNextSteps} from "@/components/next-steps-context";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { usePersonalBoard } from "@/components/use-personal-board";
import { useIsMobile } from "@/hooks/use-mobile";
import { ApplicationMobileList } from "@/components/application-mobile-list";
import { ApplicationKanban } from "@/components/application-kanban";
import { WorkspaceButton, WorkspacePanelHeader } from "@/components/workspace-form";
import {upcomingInterviews} from "@/lib/workspace-agenda";
import { terminalStatuses } from "@/lib/application-workflow";
import { type WorkspaceView } from "@/components/offer-workspace";
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

export function ApplicationsWorkspace({lessonsActive=false,onLessons,onMainView,onOffers,onReport,lessons,refusal,jobs,preparedJobs=[],onStatus,onOpen,placeholder,notice,funnel}:{lessonsActive?:boolean;onLessons?:()=>void;onMainView?:()=>void;onOffers?:(selection?:boolean)=>void;onReport?:(job:JobRecord)=>void;lessons?:ReactNode;refusal?:ReactNode;funnel?:ReactNode;placeholder?:ReactNode;notice?:ReactNode;jobs:JobRecord[];preparedJobs?:JobRecord[];onStatus:(id:string,status:JobStatus,columnId?:string)=>Promise<boolean>;onOpen:(job:JobRecord,view?:WorkspaceView)=>void}) {
  const [busy,setBusy]=useState<string|null>(null),[error,setError]=useState(""),[errorJob,setErrorJob]=useState<string|null>(null);
  const zone=useDisplayTimeZone();
  const mobile=useIsMobile(),personal=usePersonalBoard(jobs),now=useNow(jobs);
  const {queue,ready,onAction}=useRadarNextSteps();
  const next=queue.find(step=>["interview","followups","care"].includes(step.kind));
  const active=jobs.filter(job=>!terminalStatuses.includes(job.status));
  const followups=active.filter(job=>job.applicationFollowup?.eligible&&job.applicationFollowup.dueAt&&!job.applicationFollowup.doneAt&&Date.parse(job.applicationFollowup.dueAt)<=now).length;
  const interviews=upcomingInterviews(active,now).filter(({event})=>weekKey(Date.parse(event.startAt),zone)===weekKey(now,zone)).length;
  const statusLock=useRef(false);
  async function changeStatus(job:JobRecord,status:JobStatus,columnId?:string){if(statusLock.current)return false;statusLock.current=true;setBusy(job.id);setErrorJob(job.id);setError("");try{const saved=await onStatus(job.id,status,columnId);if(!saved)setError("Le déplacement n’est pas confirmé. Le dernier statut confirmé reste affiché.");return saved;}catch{setError("Statut non confirmé. Actualisez pour vérifier avant de réessayer.");return false;}finally{statusLock.current=false;setBusy(null);requestAnimationFrame(()=>{if(document.activeElement!==document.body)return;document.getElementById("workspace-title")?.focus({preventScroll:true});});}}
  const lessonLink=<a href="?tab=pipeline&section=lessons" className="application-lessons-link" onClick={event=>{event.preventDefault();onLessons?.();}}>Mes leçons</a>;
  if(lessonsActive)return <div className="applications-aligned"><a href="?tab=pipeline" className="application-return" onClick={event=>{event.preventDefault();onMainView?.();}}>← Candidatures</a><PageHeader title="Mes leçons"/>{lessons}</div>;
  return <div className="applications-aligned"><PageHeader title="Candidatures"><WorkspaceButton className="application-add-candidate" aria-label="Ajouter depuis une offre" onClick={()=>onOffers?.(true)}><span className="application-add-label">Ajouter depuis une offre</span><span className="application-add-icon" aria-hidden>+</span></WorkspaceButton></PageHeader>
    {!placeholder?<p className="application-overview">{active.length} en cours · {followups} relance{followups!==1?"s":""} à faire · {interviews} entretien{interviews!==1?"s":""} cette semaine</p>:null}
    {placeholder??<div className="applications-workspace">{notice}
      {refusal??(ready&&next?<section className="application-next-step" aria-labelledby="application-next-title"><div><p>Prochaine étape</p><h2 id="application-next-title">{next.label}</h2><span className="application-next-help">{next.minutes} minutes, à votre rythme.</span></div><WorkspaceButton variant="primary" onClick={()=>onAction(next.action)}>{next.kind==="interview"?"Préparer":next.kind==="followups"?"Relancer":"Préparer la candidature"}<span className="application-next-mobile-duration"> · {next.minutes} min</span></WorkspaceButton></section>:null)}
      {funnel}
      {error&&preparedJobs.some(job=>job.id===errorJob)?<WorkspaceState error title="Déplacement non enregistré">{error}</WorkspaceState>:null}
      {!personal.ready?<WorkspaceState error={!!personal.error} title={personal.error?"Colonnes indisponibles":"Chargement des colonnes…"}>{personal.error}{personal.error?<WorkspaceButton onClick={()=>void personal.load()}>Réessayer</WorkspaceButton>:null}</WorkspaceState>:!jobs.length&&!preparedJobs.length?<WorkspaceState title="Votre suivi commence ici">Sélectionnez une offre pour préparer votre candidature.<WorkspaceButton variant="primary" onClick={()=>onOffers?.()}>Voir mon lot du jour</WorkspaceButton></WorkspaceState>:mobile?<ApplicationMobileList jobs={jobs} preparedJobs={preparedJobs} board={personal.board} now={now} busy={busy} onStatus={changeStatus} onOpen={onOpen} onReport={onReport} onColumn={personal.open}/>:<ApplicationKanban board={personal.board} onColumn={personal.open} onColumnMove={(id,target)=>void personal.move(id,target)} onColumnDelete={personal.openDelete} columnNotice={personal.notice} jobs={jobs} preparedJobs={preparedJobs} now={now} busy={busy} onStatus={changeStatus} onOpen={onOpen}/>}
      {lessonLink}{personal.dialog}
    </div>}
  </div>;
}
