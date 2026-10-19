"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowUpRight, Check, LoaderCircle, Trash2, Undo2 } from "lucide-react";
import { OfferSourceBadge, OfferWorkspace, type WorkspaceView } from "@/components/offer-workspace";
import { WorkspaceState } from "@/components/workspace-ui";
import { selectionInView } from "@/lib/offer-trash-ui";
import { hasApplication, reviewState, type OpportunityView } from "@/lib/opportunity-views";
import { formatDate } from "@/lib/application-workflow";
import { formatEuro } from "@/lib/matching";
import type { CandidateProfile, JobRecord, JobStatus } from "@/lib/types";

const views: [OpportunityView,string][]=[["to_review","À examiner"],["selected","Ma sélection"],["good_matches","Bons matchs"],["all","Toutes"],["trash","Corbeille"]];
const remote={full_remote:"Full remote",exceptional:"Présence ponctuelle",hybrid:"Hybride",onsite:"Sur site",unknown:"Remote à confirmer"};
export function OpportunitiesWorkspace({jobs,counts,filter,onFilter,query,onClearSearch,activeId,view,onOpen,onClose,profile,onReview,onDelete,onDeleteMany,onRestore,onStatus,onNote,onChange,onApplication,onViewChange,trashBusy}: {
  jobs:JobRecord[];counts:Record<OpportunityView,number>;filter:OpportunityView;onFilter:(view:OpportunityView)=>void;query:string;onClearSearch:()=>void;
  activeId?:string;view:WorkspaceView;onOpen:(job:JobRecord)=>void;onClose:()=>void;profile:CandidateProfile;
  onReview:(id:string,state:"to_review"|"selected")=>Promise<boolean>;onDelete:(job:JobRecord)=>void;onDeleteMany:(jobs:JobRecord[])=>void;onRestore:(job:JobRecord)=>void;
  onStatus:(id:string,status:JobStatus)=>Promise<boolean>;onNote:(id:string,note:string)=>Promise<boolean>;onChange:(job:JobRecord)=>void;onApplication:(job:JobRecord)=>void;
  onViewChange:(job:JobRecord,view:WorkspaceView)=>void;trashBusy:boolean;
}) {
  const [selection,setSelection]=useState<string[]>([]),[selecting,setSelecting]=useState(false),[reviewing,setReviewing]=useState(false),[error,setError]=useState("");
  const selected=selectionInView(jobs,selection);
  const active=jobs.find(job=>job.id===activeId)||jobs[0];
  const title=useRef<HTMLHeadingElement>(null);
  const opener=useRef<HTMLButtonElement|null>(null);
  const locked=useRef(false);
  useEffect(()=>{if(activeId){title.current?.focus({preventScroll:true});if(window.matchMedia("(max-width:760px)").matches)title.current?.scrollIntoView({block:"start"});}},[activeId]);
  function close(){onClose();requestAnimationFrame(()=>{const button=opener.current;(button?.isConnected && button.getClientRects().length?button:document.getElementById("workspace-title"))?.focus({preventScroll:true});});}
  async function review(){if(!active||locked.current)return;locked.current=true;setReviewing(true);setError("");try{if(await onReview(active.id,reviewState(active)==="selected"?"to_review":"selected")){onClose();requestAnimationFrame(()=>{const heading=title.current;(heading?.getClientRects().length?heading:document.getElementById("workspace-title"))?.focus({preventScroll:true});});}else setError("Votre choix n’a pas été enregistré. Réessayez ; le dernier choix confirmé est conservé.");}finally{locked.current=false;setReviewing(false);}}
  const emptyAction: ReactNode=query?<button className="secondary-button" onClick={onClearSearch}>Effacer la recherche</button>:filter!=="all"?<button className="secondary-button" onClick={()=>onFilter("all")}>Voir toutes les offres</button>:null;
  return <div className={"opportunities-workspace "+(activeId?"has-open-offer":"")}>
    <nav className="workspace-tabs" aria-label="Vues des opportunités">{views.map(([id,label])=><button type="button" key={id} aria-pressed={filter===id} onClick={()=>{onFilter(id);setSelection([]);setSelecting(false);setError("");}}>{label}<span>{counts[id]}</span></button>)}</nav>
    <div className="opportunities-toolbar"><span className="workspace-caption">{jobs.length} offre{jobs.length>1?"s":""}{query?` · « ${query} »`:""}</span>{jobs.length>0&&filter!=="trash"?<button type="button" className="secondary-button" aria-pressed={selecting} onClick={()=>{setSelecting(!selecting);setSelection([]);}}>{selecting?"Terminer la sélection":"Sélectionner plusieurs"}</button>:null}</div>
    {selecting?<div className="opportunities-batch" aria-label="Actions sur la sélection"><span role="status">{selected.length} sélectionnée{selected.length>1?"s":""}</span><button type="button" className="secondary-button" disabled={trashBusy} onClick={()=>setSelection(jobs.slice(0,50).map(job=>job.id))}>Sélectionner {jobs.length>50?"les 50 premières":"tout"}</button>{selected.length?<><button type="button" className="secondary-button" onClick={()=>setSelection([])}>Désélectionner</button><button type="button" className="secondary-button" disabled={trashBusy} onClick={()=>onDeleteMany(selected)}><Trash2 size={15} aria-hidden />Mettre à la corbeille</button></>:null}</div>:null}
    {error?<WorkspaceState error title="Choix non enregistré">{error}</WorkspaceState>:null}
    {!jobs.length?<WorkspaceState title={query?"Aucune offre ne correspond à cette recherche":filter==="trash"?"La corbeille est vide":filter==="to_review"?"Tout est examiné pour l’instant":filter==="selected"?"Votre sélection est encore vide":"Aucune offre dans cette vue"} action={emptyAction}>{query?"Effacez la recherche pour retrouver les offres de cette vue.":filter==="to_review"?"Retrouvez les offres gardées dans Ma sélection.":filter==="trash"?"Les offres rangées pourront être restaurées ici.":"Ajoutez une annonce ou consultez une autre vue."}</WorkspaceState>:<div className="opportunities-split">
      <div className="opportunity-list" aria-label="Liste des opportunités">{jobs.map(job=><article key={job.id} className={"opportunity-list-row "+(active?.id===job.id?"is-current":"")}>
        {selecting?<label className="opportunity-check"><input type="checkbox" aria-label={"Sélectionner "+job.title+" · "+job.company} checked={selected.some(item=>item.id===job.id)} disabled={trashBusy||(selected.length>=50&&!selection.includes(job.id))} onChange={()=>setSelection(ids=>ids.includes(job.id)?ids.filter(id=>id!==job.id):[...selected.map(item=>item.id),job.id])}/><span className="sr-only">Sélectionner cette offre</span></label>:null}
        <button type="button" className="opportunity-open" aria-pressed={active?.id===job.id} onClick={event=>{opener.current=event.currentTarget;onOpen(job);}}><strong>{job.title}</strong><span>{job.company||"Entreprise à confirmer"} · {job.contractType==="cdi"?"CDI":job.contractType==="freelance"?"Freelance":"Contrat à confirmer"}</span><span className="opportunity-conditions"><b>{job.dailyRate?`${formatEuro(job.dailyRate)} / jour`:job.annualSalary?`${formatEuro(job.annualSalary)} / an`:"Rémunération non communiquée"}</b><span>{remote[job.remoteMode]}</span></span><span className="opportunity-evidence"><span className={"workspace-badge "+(job.flags.length?"is-warning":"")}>{job.deletedAt?"En corbeille":job.flags.length?`${job.flags.length} point${job.flags.length>1?"s":""} à vérifier`:"Critères renseignés"}</span><small>{job.source}</small></span></button>
      </article>)}</div>
      {active?<section className="opportunity-detail" aria-labelledby="opportunity-detail-title" key={active.id}>
        <button type="button" className="secondary-button opportunity-back" onClick={close}><ArrowLeft size={16} aria-hidden />Retour aux offres</button>
        <header className="opportunity-detail-header"><span className="workspace-monogram" aria-hidden>{(active.company||active.title).slice(0,1)}</span><h2 id="opportunity-detail-title" ref={title} tabIndex={-1}>{active.title}</h2><p>{active.company||"Entreprise à confirmer"}</p><OfferSourceBadge job={active}/></header>
        <div className="opportunity-decision">{hasApplication(active)&&!active.deletedAt?<span className="workspace-badge is-success">Candidature suivie dans Candidatures</span>:active.deletedAt?<button type="button" className="secondary-button" disabled={trashBusy} onClick={()=>{onRestore(active);close();}}><Undo2 size={16} aria-hidden />Restaurer l’offre</button>:<><button type="button" className="radar-add-button" disabled={reviewing||trashBusy} onClick={review}>{reviewing?<LoaderCircle size={16} className="animate-spin" aria-hidden />:<Check size={16} aria-hidden />}{reviewState(active)==="selected"?"Remettre à examiner":"Garder l’offre"}</button><button type="button" className="secondary-button" disabled={reviewing||trashBusy} onClick={()=>onDelete(active)}><Trash2 size={15} aria-hidden />Ranger</button></>}</div>
        <OfferWorkspace key={active.id} job={active} profile={profile} initialView={view} onViewChange={next=>onViewChange(active,next)} context="opportunity" onStatus={onStatus} onNote={onNote} onChange={onChange} onOpenApplication={()=>onApplication(active)}/>
        {active.deletedAt?<p className="workspace-caption mt-5">Rangée le {formatDate(active.deletedAt)}. {active.dismissalNote||"Restauration possible, notes et entretiens conservés."}</p>:null}
      </section>:null}
    </div>}
  </div>;
}
