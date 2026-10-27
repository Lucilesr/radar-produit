"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ExternalLink, Check, Bookmark, LoaderCircle, Trash2, Undo2, ShieldCheck } from "lucide-react";
import { ApplicationTrackingAction, OfferSourceBadge, OfferWorkspace, type WorkspaceView } from "@/components/offer-workspace";
import { WorkspaceState } from "@/components/workspace-ui";
import { HelpTooltip } from "@/components/help-tooltip";
import { selectionInView } from "@/lib/offer-trash-ui";
import { hasApplication, reviewState, type OpportunityView } from "@/lib/opportunity-views";
import { formatDate } from "@/lib/application-workflow";
import { formatEuro } from "@/lib/matching";
import type { CandidateProfile, JobRecord, JobStatus } from "@/lib/types";

const views: [OpportunityView,string][]=[["to_review","À examiner"],["selected","Ma sélection"],["all","Toutes"],["trash","Corbeille"]];
const remote={full_remote:"Full remote",exceptional:"Présence ponctuelle",hybrid:"Hybride",onsite:"Sur site",unknown:"Remote à confirmer"};
export function OpportunitiesWorkspace({jobs,counts,filter,onFilter,query,onClearSearch,activeId,view,onOpen,onClose,profile,onReview,onDelete,onDeleteMany,onRestore,onStatus,onNote,onChange,onApplication,onViewChange,trashBusy,currentJob}: {
  currentJob?:JobRecord|null; jobs:JobRecord[];counts:Record<OpportunityView,number>;filter:OpportunityView;onFilter:(view:OpportunityView)=>void;query:string;onClearSearch:()=>void;
  activeId?:string;view:WorkspaceView;onOpen:(job:JobRecord)=>void;onClose:()=>void;profile:CandidateProfile;
  onReview:(id:string,state:"to_review"|"selected")=>Promise<boolean>;onDelete:(job:JobRecord)=>void;onDeleteMany:(jobs:JobRecord[])=>void;onRestore:(job:JobRecord)=>void;
  onStatus:(id:string,status:JobStatus)=>Promise<boolean>;onNote:(id:string,note:string)=>Promise<boolean>;onChange:(job:JobRecord)=>void;onApplication:(job:JobRecord)=>void;
  onViewChange:(job:JobRecord,view:WorkspaceView)=>void;trashBusy:boolean;
}) {
  const [selection,setSelection]=useState<string[]>([]),[selecting,setSelecting]=useState(false),[reviewing,setReviewing]=useState(false),[error,setError]=useState("");
  const [retained,setRetained]=useState<{job:JobRecord;filter:OpportunityView;query:string;index:number}|null>(null);
  const kept=retained?.filter===filter&&retained.query===query?retained:null;
  const retainedJob=kept&&currentJob?.id===kept.job.id?currentJob:kept?.job;
  const displayJobs=[...jobs];
  if(kept&&!displayJobs.some(job=>job.id===kept.job.id))displayJobs.splice(Math.min(kept.index,displayJobs.length),0,retainedJob!);
  const selected=selectionInView(jobs,selection);
  const active=displayJobs.find(job=>job.id===activeId)||kept?.job||displayJobs[0];
  const heldOutside=!!kept&&!jobs.some(job=>job.id===kept.job.id);
  const viewHelp=filter==="selected"?"Votre choix : les offres que vous avez sélectionnées, avant de candidater.":filter==="good_matches"?"Filtre automatique : les offres proches de vos critères selon Radar, sélectionnées ou non. Certaines ont déjà une candidature.":filter==="trash"?"Les offres écartées restent restaurables.":filter==="all"?"Toutes vos opportunités, y compris celles avec une candidature.":"Les offres qu’il vous reste à examiner.";
  const currentScope=useRef({filter,query});
  useEffect(()=>{currentScope.current={filter,query};},[filter,query]);
  const viewIsCurrent=()=>currentScope.current.filter===filter&&currentScope.current.query===query;
  const [readingScope,setReadingScope]=useState({filter,query});
  if(readingScope.filter!==filter||readingScope.query!==query){setReadingScope({filter,query});setRetained(null);}
  function changeView(next:OpportunityView){setRetained(null);onFilter(next);setSelection([]);setSelecting(false);setError("");}
  function openListed(job:JobRecord){if(kept&&job.id!==kept.job.id)setRetained(null);onOpen(job);}

  const announcementUrl=active?.sourceUrl||active?.applicationUrl;
  const title=useRef<HTMLHeadingElement>(null);
  const opener=useRef<HTMLButtonElement|null>(null);
  const locked=useRef(false);
  useEffect(()=>{if(activeId){title.current?.focus({preventScroll:true});if(window.matchMedia("(max-width:760px)").matches)title.current?.scrollIntoView({block:"start"});}},[activeId]);
  function close(){onClose();requestAnimationFrame(()=>{const button=opener.current;(button?.isConnected && button.getClientRects().length?button:document.getElementById("workspace-title"))?.focus({preventScroll:true});});}
  async function review(){
    if(!active||locked.current)return;
    const current=active,next=reviewState(current)==="selected"?"to_review":"selected",index=displayJobs.findIndex(job=>job.id===current.id);
    locked.current=true;setReviewing(true);setError("");
    try{if(await onReview(current.id,next)){
      if(!viewIsCurrent())return;
      const updated={...current,reviewState:next} as JobRecord;
      if((filter==="to_review"&&next==="selected")||(filter==="selected"&&next==="to_review"))setRetained({job:updated,filter,query,index});else setRetained(null);
      onOpen(updated);
    }else setError("Votre choix n’a pas été enregistré. Réessayez ; le dernier choix confirmé est conservé.");}finally{locked.current=false;setReviewing(false);}
  }
  const emptyAction: ReactNode=query?<button className="secondary-button" onClick={onClearSearch}>Effacer la recherche</button>:filter!=="all"?<button className="secondary-button" onClick={()=>{changeView("all");requestAnimationFrame(()=>document.getElementById("workspace-title")?.focus());}}>Voir toutes les offres</button>:null;
  return <div className={"opportunities-workspace "+(activeId?"has-open-offer":"")}>
    <nav className="workspace-tabs" aria-label="Vues des opportunités">{views.map(([id,label])=><button type="button" key={id} aria-pressed={filter===id} onClick={()=>changeView(id)}>{label}<span>{counts[id]}</span></button>)}</nav>
    <div className="opportunities-toolbar"><div className="review-view-summary"><span className="workspace-caption">{jobs.length} offre{jobs.length>1?"s":""}{query?` · « ${query} »`:""}{heldOutside?" · dernière décision affichée":""}</span><HelpTooltip label="Vue des opportunités">{viewHelp}</HelpTooltip></div><div className="review-toolbar-actions"><button type="button" className="review-radar-filter" aria-pressed={filter==="good_matches"} onClick={()=>changeView(filter==="good_matches"?"to_review":"good_matches")}>Correspondances Radar <span>{counts.good_matches}</span></button>{jobs.length>0&&filter!=="trash"?<button type="button" className="secondary-button" aria-pressed={selecting} onClick={()=>{setRetained(null);setSelecting(!selecting);setSelection([]);}}>{selecting?"Terminer les actions groupées":"Actions groupées"}</button>:null}</div></div>
    {selecting?<div className="opportunities-batch" role="group" aria-label="Actions sur les offres cochées"><span role="status">{selected.length} offre{selected.length>1?"s":""} cochée{selected.length>1?"s":""}</span><button type="button" className="secondary-button" disabled={trashBusy} onClick={()=>setSelection(jobs.slice(0,50).map(job=>job.id))}>Cocher {jobs.length>50?"les 50 premières":"tout"}</button>{selected.length?<><button type="button" className="secondary-button" onClick={()=>setSelection([])}>Tout décocher</button><button type="button" className="secondary-button" disabled={trashBusy} onClick={()=>onDeleteMany(selected)}><Trash2 size={15} aria-hidden />Mettre à la corbeille</button></>:null}</div>:null}
    {error?<WorkspaceState error title="Choix non enregistré">{error}</WorkspaceState>:null}
    {!displayJobs.length?<WorkspaceState title={query?"Aucune offre ne correspond à cette recherche":filter==="trash"?"La corbeille est vide":filter==="to_review"?"Tout est examiné pour l’instant":filter==="selected"?"Votre sélection est encore vide":"Aucune offre dans cette vue"} action={emptyAction}>{query?"Effacez la recherche pour retrouver les offres de cette vue.":filter==="to_review"?"Retrouvez les offres sélectionnées dans Ma sélection.":filter==="trash"?"Les offres écartées pourront être restaurées ici.":"Ajoutez une annonce ou consultez une autre vue."}</WorkspaceState>:<div className="opportunities-split">
      <div className="opportunity-list" tabIndex={0} role="region" aria-label="Liste des opportunités">{displayJobs.map(job=><article key={job.id} className={"opportunity-list-row "+(active?.id===job.id?"is-current":"")}>
        {selecting?<label className="opportunity-check"><input type="checkbox" aria-label={"Cocher "+job.title+" · "+job.company} checked={selected.some(item=>item.id===job.id)} disabled={trashBusy||(selected.length>=50&&!selection.includes(job.id))} onChange={()=>setSelection(ids=>ids.includes(job.id)?ids.filter(id=>id!==job.id):[...selected.map(item=>item.id),job.id])}/><span className="sr-only">Cocher cette offre</span></label>:null}
        <button type="button" className="opportunity-open" aria-pressed={active?.id===job.id} onClick={event=>{opener.current=event.currentTarget;openListed(job);}}><strong>{job.title}</strong><span>{job.company||"Entreprise à confirmer"} · {job.contractType==="cdi"?"CDI":job.contractType==="freelance"?"Freelance":"Contrat à confirmer"}</span><span className="opportunity-conditions"><b>{job.dailyRate?`${formatEuro(job.dailyRate)} / jour`:job.annualSalary?`${formatEuro(job.annualSalary)} / an`:"Rémunération non communiquée"}</b><span>{remote[job.remoteMode]}</span></span><span className="opportunity-evidence"><span className={"workspace-badge "+(job.flags.length?"is-warning":"")}>{job.deletedAt?"En corbeille":job.flags.length?`${job.flags.length} point${job.flags.length>1?"s":""} à vérifier`:"Critères renseignés"}</span><small className="review-list-origin"><span>{job.source}</span>{!job.deletedAt&&reviewState(job)==="selected"?<span className="review-kept-label"><Check size={12}/>Sélectionnée</span>:null}</small></span></button>
      </article>)}</div>
      {active?<section tabIndex={0} className="opportunity-detail" aria-labelledby="opportunity-detail-title" key={active.id}>
        <button type="button" className="secondary-button opportunity-back" onClick={close}><ArrowLeft size={16} aria-hidden />Retour aux offres</button>
        <header className="opportunity-detail-header reading-detail-heading"><div className="reading-heading-text"><h2 id="opportunity-detail-title" ref={title} tabIndex={-1}>{active.title}</h2><div className="reading-company-line"><span>{active.company||"Entreprise à confirmer"}</span><OfferSourceBadge job={active}/></div></div>{!active.deletedAt?<ApplicationTrackingAction job={active} onStatus={async(id,status)=>{const saved=await onStatus(id,status);if(saved&&viewIsCurrent()){const updated={...active,status};setRetained({job:updated,filter,query,index:displayJobs.findIndex(job=>job.id===id)});onOpen(updated);}return saved;}} onOpenApplication={()=>onApplication(active)}/>:null}</header>
        <div className="opportunity-decision signal-opportunity-actions">
          <div className="opportunity-action-main">{hasApplication(active)&&!active.deletedAt?<span className="workspace-badge is-success">Candidature suivie</span>:active.deletedAt?<button type="button" className="secondary-button" disabled={trashBusy} onClick={()=>{onRestore(active);close();}}><Undo2 size={16}/>Restaurer l’offre</button>:<>
          {reviewState(active)!=="selected"?<button type="button" className="radar-add-button" aria-pressed="false" disabled={reviewing||trashBusy} onClick={review}>{reviewing?<LoaderCircle size={16} className="animate-spin"/>:<Bookmark size={16} aria-hidden/>}Sélectionner</button>:<button type="button" className="signal-selected-button" aria-pressed="true" title="Retirer de ma sélection" disabled={reviewing||trashBusy} onClick={review}><Check size={16} aria-hidden/>Sélectionnée</button>}
          </>}{announcementUrl?<a href={announcementUrl} target="_blank" rel="noopener noreferrer" className="secondary-button opportunity-source-link"><ExternalLink size={14} aria-hidden/>Voir l’annonce</a>:null}
          </div>
          {!active.deletedAt?<div className="opportunity-action-secondary"><button type="button" className="signal-quiet-button" disabled={reviewing||trashBusy} onClick={()=>{setRetained(null);onDelete(active);}}><Trash2 size={15}/>Écarter</button></div>:null}
        </div>
        {heldOutside?<p className="sr-only" role="status">{hasApplication(active)?"Candidature enregistrée. L’offre reste ouverte pendant votre lecture.":reviewState(active)==="selected"?"Offre sélectionnée. Elle reste ouverte pendant votre lecture.":"Offre remise à examiner. Elle reste ouverte pendant votre lecture."}</p>:null}
        <OfferWorkspace key={active.id} showApplicationAction={false} showAnnouncement={false} job={active} profile={profile} initialView={view} onViewChange={next=>onViewChange(active,next)} context="opportunity" onStatus={async(id,status)=>{const saved=await onStatus(id,status);if(saved&&viewIsCurrent()){const updated={...active,status};setRetained({job:updated,filter,query,index:displayJobs.findIndex(job=>job.id===id)});onOpen(updated);}return saved;}} onNote={onNote} onChange={updated=>{if(kept?.job.id===updated.id)setRetained({...kept,job:updated});onChange(updated);}} onOpenApplication={()=>onApplication(active)}/>
        {active.deletedAt?<p className="workspace-caption mt-5">Écartée le {formatDate(active.deletedAt)}. {active.dismissalNote||"Restauration possible, notes et entretiens conservés."}</p>:null}
        <OpportunityReadingNotes/>
      </section>:null}
    </div>}
    {!displayJobs.length?<OpportunityReadingNotes/>:null}
  </div>;
}

function OpportunityReadingNotes(){return <footer className="opportunity-reading-notes"><span><ShieldCheck size={13} aria-hidden/>Vos données restent privées.</span><span>Aucune candidature envoyée automatiquement.</span></footer>;}
