"use client";
import { useEffect, useState } from "react";
import { ArrowRight, ArrowUpRight, CalendarDays, Check, ClipboardCheck, ScanLine } from "lucide-react";
import { selectTriageActions } from "@/lib/triage";
import { hasApplication, inOpportunityView } from "@/lib/opportunity-views";
import { activeStatuses, formatDate, reviewDue, terminalStatuses } from "@/lib/application-workflow";
import { upcomingInterviews } from "@/lib/workspace-agenda";
import { StatusSelect, type WorkspaceView } from "@/components/offer-workspace";
import { WorkspaceState } from "@/components/workspace-ui";
import type { JobRecord, JobStatus } from "@/lib/types";

function useNow() { const [now,setNow]=useState(Date.now()); useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),60000);return()=>clearInterval(timer);},[]);return now; }
export function TodayWorkspace({ jobs, onTriage, onSelected, onAdd, onOpen }: {jobs:JobRecord[];onTriage:()=>void;onSelected:()=>void;onAdd:()=>void;onOpen:(job:JobRecord,view?:WorkspaceView)=>void}) {
  const now=useNow();
  const count=jobs.filter(job=>inOpportunityView(job,"to_review")).length;
  const selected=jobs.filter(job=>inOpportunityView(job,"selected")).length;
  const active=jobs.filter(job=>hasApplication(job)&&activeStatuses.includes(job.status)).length;
  const actions=selectTriageActions(jobs,now,4).filter(action=>action.kind!=="offer_check");
  const urgent=actions.find(action=>action.kind==="interview_review"||action.kind==="interview_date");
  const upcoming=upcomingInterviews(jobs,now).slice(0,3);
  const openAction=(action:typeof actions[number])=>onOpen(action.job,action.kind.startsWith("interview")?"interviews":hasApplication(action.job)?"application":"brief");
  return <div className="today-layout">
    <div className="today-main">
      <section className="today-focus" aria-labelledby="today-action-title">
        <div className="workspace-section-heading"><h2 id="today-action-title">À faire maintenant</h2><ScanLine size={19} aria-hidden /></div>
        <p className="today-focus-title">{urgent?urgent.title:count?`${count} opportunité${count>1?"s":""} à examiner`:selected?`${selected} offre${selected>1?"s":""} à préparer`:"Votre file d’offres est à jour"}</p>
        <p className="workspace-caption">{urgent?urgent.detail:count?"Comparez les missions et les conditions, puis gardez les offres qui vous intéressent.":selected?"Retrouvez les offres gardées et préparez votre candidature.":"Ajoutez une annonce pour la retrouver dans votre radar."}</p>
        <button type="button" className="radar-add-button" onClick={()=>urgent?openAction(urgent):count?onTriage():selected?onSelected():onAdd()}>{urgent?"Ouvrir le suivi":count?"Examiner les offres":selected?"Préparer ma sélection":"Ajouter une offre"}<ArrowRight size={17} aria-hidden /></button>
        <span className="today-orbit" aria-hidden />
      </section>
      <section className="today-next" aria-labelledby="today-next-title"><div className="workspace-section-heading"><h2 id="today-next-title">À faire ensuite</h2></div>
        {actions.filter(action=>action!==urgent).slice(0,3).map(action=><button key={action.job.id} type="button" className="workspace-task" onClick={()=>openAction(action)}><span className="workspace-task-icon"><ClipboardCheck size={18} aria-hidden /></span><span><strong>{action.title}</strong><small>{action.detail}</small></span><ArrowUpRight size={17} aria-hidden /></button>)}
        {!actions.filter(action=>action!==urgent).length?<p className="workspace-caption">Aucune action supplémentaire en attente.</p>:null}
      </section>
      <div className="today-summary" aria-label="Résumé de votre recherche"><button type="button" onClick={onTriage}><strong>{count}</strong> à examiner</button><button type="button" onClick={onSelected}><strong>{selected}</strong> dans ma sélection</button><span><strong>{active}</strong> candidature{active>1?"s":""} active{active>1?"s":""}</span></div>
    </div>
    <aside className="today-agenda"><div className="workspace-section-heading"><h2>Prochains entretiens</h2><CalendarDays size={18} aria-hidden /></div>
      {upcoming.length?upcoming.map(({job,event})=><button key={event.id} type="button" className="agenda-event" onClick={()=>onOpen(job,"interviews")}><span className="workspace-caption">{formatDate(event.startAt,event.timeZone,true)} · {event.timeZone}</span><strong>{job.company || job.title}</strong><span>{event.label}</span><span className="workspace-badge is-success"><Check size={13} aria-hidden />Planifié</span></button>):<p className="workspace-caption">Aucun entretien planifié. Les rendez-vous ajoutés à une candidature apparaîtront ici.</p>}
    </aside>
  </div>;
}

export function ApplicationsWorkspace({jobs,onStatus,onOpen}:{jobs:JobRecord[];onStatus:(id:string,status:JobStatus)=>Promise<boolean>;onOpen:(job:JobRecord,view?:WorkspaceView)=>void}) {
  const [scope,setScope]=useState("active"),[busy,setBusy]=useState<string|null>(null),[error,setError]=useState("");
  const now=useNow();
  const items=jobs.filter(job=>scope==="active"?activeStatuses.includes(job.status):scope==="closed"?terminalStatuses.includes(job.status):true);
  return <div><nav className="workspace-tabs" aria-label="Vues des candidatures">{[["active","En cours"],["closed","Closes / refus"],["all","Toutes"]].map(([id,label])=><button key={id} type="button" aria-pressed={scope===id} onClick={()=>setScope(id)}>{label}</button>)}</nav>
    {error?<WorkspaceState error title="Statut non enregistré">{error}</WorkspaceState>:null}
    {!items.length?<WorkspaceState title="Aucune candidature dans cette vue">Le bouton « J’ai postulé » d’une offre permet de commencer son suivi.</WorkspaceState>:<div className="applications-list">{items.map(job=>{
      const due=job.interviews?.find(event=>reviewDue(event,now));
      const next=upcomingInterviews([job],now)[0]?.event;
      return <article key={job.id} className="application-row" aria-busy={busy===job.id}>
        <span className="workspace-monogram" aria-hidden>{(job.company||job.title).slice(0,1)}</span>
        <div className="application-identity"><h2><button type="button" onClick={()=>onOpen(job,"application")}>{job.title}</button></h2><p>{job.company||"Entreprise à confirmer"}{job.deletedAt?" · Offre en corbeille, suivi conservé":""}</p></div>
        <div className="application-next"><span className={"workspace-badge "+(due?"is-warning":next?"is-success":"")}>{terminalStatuses.includes(job.status)?"Candidature close":due?"Bilan à faire":next?"Entretien planifié":job.status==="interview"?"Date à renseigner":"En attente de suite"}</span>{next?<p>{formatDate(next.startAt,next.timeZone,true)}<br/><small>{next.timeZone}</small></p>:null}</div>
        <div className="application-status"><StatusSelect value={job.status} disabled={!!busy} label={"Statut · "+(job.company||job.title)} onChange={async status=>{setBusy(job.id);setError("");try{if(!await onStatus(job.id,status))setError("Réessayez de modifier le statut. Le dernier statut confirmé reste affiché.");}finally{setBusy(null);}}}/></div>
        <button type="button" className="secondary-button" onClick={()=>onOpen(job,due||next||job.status==="interview"?"interviews":"application")}>{due?"Faire le bilan":next?"Voir l’entretien":"Ouvrir le suivi"}<ArrowUpRight size={15} aria-hidden /></button>
      </article>;
    })}</div>}
  </div>;
}
