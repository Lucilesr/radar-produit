"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, ArrowUpRight, CalendarDays, Check, ClipboardCheck, Columns3, List } from "lucide-react";
import { usePersonalBoard } from "@/components/use-personal-board";
import { ApplicationKanban } from "@/components/application-kanban";
import { RadarMark } from "@/components/radar-mark";
import { WorkspaceButton, WorkspacePanelHeader } from "@/components/workspace-form";
import { selectTriageActions } from "@/lib/triage";
import { hasApplication, inOpportunityView } from "@/lib/opportunity-views";
import { activeStatuses, applicationAge, formatDate, reviewDue, terminalStatuses } from "@/lib/application-workflow";
import { upcomingInterviews } from "@/lib/workspace-agenda";
import { StatusSelect, type WorkspaceView } from "@/components/offer-workspace";
import { WorkspaceState } from "@/components/workspace-ui";
import type { JobRecord, JobStatus } from "@/lib/types";

// Recalculate deadlines on entry and explicit data changes; keep the page stable while reading.
function useNow(jobs: JobRecord[]) { const [now,setNow]=useState(()=>Date.now()); useEffect(()=>setNow(Date.now()),[jobs]);return now; }
export function TodayWorkspace({ jobs, onTriage, onSelected, onAdd, onOpen }: {jobs:JobRecord[];onTriage:()=>void;onSelected:()=>void;onAdd:()=>void;onOpen:(job:JobRecord,view?:WorkspaceView)=>void}) {
  const now=useNow(jobs);
  const count=jobs.filter(job=>inOpportunityView(job,"to_review")).length;
  const selected=jobs.filter(job=>inOpportunityView(job,"selected")).length;
  const active=jobs.filter(job=>hasApplication(job)&&activeStatuses.includes(job.status)).length;
  const actions=selectTriageActions(jobs,now,4).filter(action=>action.kind!=="offer_check");
  const urgent=actions.find(action=>action.kind==="interview_review"||action.kind==="interview_date");
  const upcoming=upcomingInterviews(jobs,now).slice(0,3);
  const openAction=(action:typeof actions[number])=>onOpen(action.job,action.kind.startsWith("interview")?"interviews":hasApplication(action.job)?"application":"brief");
  return <div className="today-layout">
    <div className="today-main">
      <section className="today-focus" aria-label="Action prioritaire">
        <h2 className="today-focus-title">{urgent?urgent.title:count?`${count} opportunité${count>1?"s":""} à examiner`:selected?`${selected} offre${selected>1?"s":""} à préparer`:"Votre file d’offres est à jour"}</h2>
        <p className="workspace-caption">{urgent?urgent.detail:count?"Comparez les missions et les conditions, puis sélectionnez les offres qui vous intéressent.":selected?"Retrouvez les offres sélectionnées et préparez votre candidature.":"Ajoutez une annonce pour la retrouver dans votre radar."}</p>
        <WorkspaceButton variant="primary" onClick={()=>urgent?openAction(urgent):count?onTriage():selected?onSelected():onAdd()}>{urgent?"Ouvrir le suivi":count?"Examiner les offres":selected?"Préparer ma sélection":"Ajouter une offre"}<ArrowRight size={17} aria-hidden /></WorkspaceButton>
        <RadarMark className="today-logo-watermark" watermark/>
      </section>
      <section className="today-next" aria-labelledby="today-next-title"><WorkspacePanelHeader id="today-next-title" title="À faire ensuite"/>
        {actions.filter(action=>action!==urgent).slice(0,3).map(action=><button key={action.job.id} type="button" className="workspace-task" onClick={()=>openAction(action)}><span className="workspace-task-icon"><ClipboardCheck size={18} aria-hidden /></span><span><strong>{action.title}</strong><small>{action.detail}</small></span><ArrowUpRight size={17} aria-hidden /></button>)}
        {!actions.filter(action=>action!==urgent).length?<p className="workspace-caption">Aucune action supplémentaire en attente.</p>:null}
      </section>
      <div className="today-summary" role="group" aria-label="Résumé de votre recherche"><button type="button" onClick={onTriage}><strong>{count}</strong> à examiner</button><button type="button" onClick={onSelected}><strong>{selected}</strong> dans ma sélection</button><span><strong>{active}</strong> candidature{active>1?"s":""} active{active>1?"s":""}</span></div>
    </div>
    <aside className="today-agenda" aria-labelledby="today-agenda-title"><WorkspacePanelHeader id="today-agenda-title" title="Prochains entretiens" actions={<CalendarDays size={18} aria-hidden/>}/>
      {upcoming.length?upcoming.map(({job,event})=><button key={event.id} type="button" className="agenda-event" onClick={()=>onOpen(job,"interviews")}><span className="agenda-event-heading"><span className="workspace-caption">{formatDate(event.startAt,event.timeZone,true)} · {event.timeZone}</span><span className="workspace-badge is-success"><Check size={13} aria-hidden />Planifié</span></span><strong>{job.company || job.title}</strong><span>{event.label}</span></button>):<p className="workspace-caption">Aucun entretien planifié. Les rendez-vous ajoutés à une candidature apparaîtront ici.</p>}
    </aside>
  </div>;
}

export function ApplicationsWorkspace({jobs,onStatus,onOpen}:{jobs:JobRecord[];onStatus:(id:string,status:JobStatus,columnId?:string)=>Promise<boolean>;onOpen:(job:JobRecord,view?:WorkspaceView)=>void}) {
  const [scope,setScope]=useState("active"),[busy,setBusy]=useState<string|null>(null),[error,setError]=useState("");
  const [display,setDisplay]=useState<"list"|"board">("list");
  const statusLock=useRef(false);
  const personal=usePersonalBoard();
  const now=useNow(jobs);
  const items=jobs.filter(job=>scope==="active"?activeStatuses.includes(job.status):scope==="closed"?terminalStatuses.includes(job.status):true);
  async function changeStatus(job:JobRecord,status:JobStatus,columnId?:string){if(statusLock.current)return false;statusLock.current=true;setBusy(job.id);setError("");try{const saved=await onStatus(job.id,status,columnId);if(!saved)setError("Réessayez de modifier le statut. Le dernier statut confirmé reste affiché.");return saved;}catch{setError("Statut non confirmé. Actualisez pour vérifier avant de réessayer.");return false;}finally{statusLock.current=false;setBusy(null);requestAnimationFrame(()=>{if(document.activeElement!==document.body)return;const trigger=Array.from(document.getElementById(`application-status-${job.id}`)?.querySelectorAll<HTMLButtonElement>("button")??[]).find(element=>element.getClientRects().length);(trigger??document.getElementById("workspace-title"))?.focus();});}}
  return <div className="applications-workspace"><div className="applications-toolbar"><nav className="workspace-tabs" aria-label="Vues des candidatures">{[["active","En cours"],["closed","Closes / refus"],["all","Toutes"]].map(([id,label])=><button key={id} type="button" aria-pressed={scope===id} onClick={()=>setScope(id)}>{label}</button>)}</nav><div className="application-display-toggle" role="group" aria-label="Affichage des candidatures"><button type="button" aria-label="Afficher en tableau" aria-pressed={display==="list"} onClick={()=>setDisplay("list")}><List size={16} aria-hidden/>Tableau</button><button type="button" aria-label="Afficher en Kanban" aria-pressed={display==="board"} onClick={()=>{if(display!=="board")setScope("all");setDisplay("board");}}><Columns3 size={16} aria-hidden/>Kanban</button></div></div>
    {error?<WorkspaceState error title="Statut non enregistré">{error}</WorkspaceState>:null}
    {display==="board"&&!personal.ready?<WorkspaceState error={!!personal.error} title={personal.error?"Colonnes indisponibles":"Chargement des colonnes…"}>{personal.error}<WorkspaceButton onClick={()=>void personal.load()}>Réessayer</WorkspaceButton></WorkspaceState>:display==="board"?<ApplicationKanban board={personal.board} onColumn={personal.open} jobs={items} now={now} busy={busy} onStatus={changeStatus} onOpen={onOpen}/>:!items.length?<WorkspaceState title="Aucune candidature dans cette vue">Le bouton « J’ai postulé » d’une offre permet de commencer son suivi.</WorkspaceState>:<div className="applications-list"><div className="applications-heading" aria-hidden="true"><span>Offre</span><span>Date de candidature</span><span>Prochaine étape</span><span>Statut</span><span></span></div>{items.map(job=>{
      const due=job.interviews?.find(event=>reviewDue(event,now));
      const next=upcomingInterviews([job],now)[0]?.event;
      const age=applicationAge(job.appliedAt,now);
      return <article key={job.id} className="application-row" aria-busy={busy===job.id}>
        <div className="application-identity"><div><h2><button type="button" onClick={()=>onOpen(job,"application")}>{job.title}</button></h2><p>{job.company||"Entreprise à confirmer"}{job.deletedAt?" · Offre en corbeille, suivi conservé":""}</p></div></div>
        <div className="application-sent"><span className="application-cell-label">Date de candidature</span><span className={`application-age${age?` is-${age.tone}`:""}`}>{job.appliedAt?formatDate(job.appliedAt,"Indian/Mauritius"):"Date inconnue"}</span></div>
        <div className="application-next"><span className="application-cell-label">Prochaine étape</span><span className={"workspace-badge "+(due?"is-warning":next?"is-success":"")}>{terminalStatuses.includes(job.status)?"Candidature close":due?"Bilan à faire":next?"Entretien planifié":job.status==="interview"?"Entretien à suivre":"En attente de retour"}</span>{next?<p>{formatDate(next.startAt,next.timeZone,true)}<br/><small>{next.timeZone}</small></p>:null}</div>
        <div id={`application-status-${job.id}`} className="application-status"><span className="application-cell-label" aria-hidden="true">Statut</span><StatusSelect value={job.status} disabled={!!busy} label={"Statut · "+(job.company||job.title)} onChange={status=>void changeStatus(job,status)}/></div>
        <button type="button" className="secondary-button application-open" onClick={()=>onOpen(job,job.status==="offer"?"application":due||next||job.status==="interview"?"interviews":"application")}>{job.status==="offer"?"Ouvrir":due?"Faire le bilan":next?"Voir l’entretien":"Ouvrir"}<ArrowUpRight size={15} aria-hidden /></button>
      </article>;
    })}</div>}
    {personal.dialog}
  </div>;
}
