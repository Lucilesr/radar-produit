"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ExternalLink, Check, Bookmark, LoaderCircle, Trash2, Undo2, ShieldCheck, Clock3, Archive } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ApplicationTrackingAction, FitBadge, OfferSourceBadge, OfferWorkspace, type WorkspaceView } from "@/components/offer-workspace";
import { WorkspaceState } from "@/components/workspace-ui";
import { HelpTooltip } from "@/components/help-tooltip";
import { selectionInView } from "@/lib/offer-trash-ui";
import { ARCHIVE_AFTER_DAYS, hasApplication, isArchived, reviewState, sortOpportunitiesByDate, type OpportunityView } from "@/lib/opportunity-views";
import { groupReserve, type ReserveGroupId } from "@/lib/reserve";
import { formatDate } from "@/lib/application-workflow";
import { formatEuro } from "@/lib/matching";
import { formatPayRangeShort } from "@/lib/pay-range";
import { pinMysteryOffers } from "@/lib/fit";
import { lotHeadline, type DailyLot } from "@/lib/daily-lot";
import type { CandidateProfile, JobRecord, JobStatus } from "@/lib/types";

const views: [OpportunityView,string][]=[["to_review","À examiner"],["selected","Ma sélection"],["trash","Corbeille"]];
const remote={full_remote:"Full remote",exceptional:"Présence ponctuelle",hybrid:"Hybride",onsite:"Sur site",unknown:"Remote à confirmer"};
export function OpportunitiesWorkspace({lot,jobs,counts,filter,onFilter,query,onClearSearch,activeId,view,onOpen,onClose,profile,onReview,onDelete,onDeleteMany,onRestore,onStatus,onNote,onChange,onApplication,onViewChange,trashBusy,currentJob}: {
  lot?:DailyLot|null; currentJob?:JobRecord|null; jobs:JobRecord[];counts:Record<OpportunityView,number>;filter:OpportunityView;onFilter:(view:OpportunityView)=>void;query:string;onClearSearch:()=>void;
  activeId?:string;view:WorkspaceView;onOpen:(job:JobRecord)=>void;onClose:()=>void;profile:CandidateProfile;
  onReview:(id:string,state:"to_review"|"selected"|"later")=>Promise<boolean>;onDelete:(job:JobRecord,next?:JobRecord)=>void;onDeleteMany:(jobs:JobRecord[])=>void;onRestore:(job:JobRecord)=>void;
  onStatus:(id:string,status:JobStatus)=>Promise<boolean>;onNote:(id:string,note:string)=>Promise<boolean>;onChange:(job:JobRecord)=>void;onApplication:(job:JobRecord)=>void;
  onViewChange:(job:JobRecord,view:WorkspaceView)=>void;trashBusy:boolean;
}) {
  const [selection,setSelection]=useState<string[]>([]),[selecting,setSelecting]=useState(false),[reviewingIds,setReviewingIds]=useState<string[]>([]),[error,setError]=useState("");
  const [dateOrder,setDateOrder]=useState<"newest"|"oldest">("newest");
  // Score v2 S4: up to five mystery offers lead « À examiner », whatever the chosen order.
  // Tri Q1: « À examiner » opens on the lot of the day; « Toutes les offres » keeps the full list.
  const [allOffers,setAllOffers]=useState(false);
  const lotShown=filter==="to_review"&&!query&&!!lot&&(lot.size>0||counts.to_review>0||counts.archived>0);
  const inLot=lotShown&&lot!.size>0&&!allOffers;
  // Tri Q1b: outside the lot, « À examiner » is the reserve, sorted into groups decided in one go.
  const inReserve=lotShown&&!inLot;
  const [reserveGroupId,setReserveGroupId]=useState<ReserveGroupId|null>(null);
  const [groupsNow]=useState(()=>Date.now());
  const reserveJobs=inReserve?jobs.filter(job=>!lot!.remaining.some(item=>item.id===job.id)):[];
  const groups=inReserve?groupReserve(reserveJobs,groupsNow):[];
  const shownGroup=groups.find(group=>group.id===reserveGroupId);
  const listed=inReserve?(shownGroup?.jobs??reserveJobs):jobs;
  const orderedJobs=inLot?lot!.remaining:filter==="to_review"?pinMysteryOffers(sortOpportunitiesByDate(listed,filter,dateOrder)):sortOpportunitiesByDate(listed,filter,dateOrder);
  const [retained,setRetained]=useState<{job:JobRecord;filter:OpportunityView;query:string;index:number}|null>(null);
  const kept=retained?.filter===filter&&retained.query===query?retained:null;
  const retainedJob=kept&&currentJob?.id===kept.job.id?currentJob:kept?.job;
  const displayJobs=[...orderedJobs];
  if(kept&&!displayJobs.some(job=>job.id===kept.job.id))displayJobs.splice(Math.min(kept.index,displayJobs.length),0,retainedJob!);
  const selected=selectionInView(orderedJobs,selection);
  const active=displayJobs.find(job=>job.id===activeId)||kept?.job||displayJobs[0];
  const heldOutside=!!kept&&!jobs.some(job=>job.id===kept.job.id);
  const viewHelp=filter==="archived"?`Annonces publiées il y a au moins ${ARCHIVE_AFTER_DAYS} jours ; date d’ajout utilisée si la publication est inconnue. Une remise à examiner vous redonne ${ARCHIVE_AFTER_DAYS} jours.`:inReserve?"La réserve : les offres hors du lot du jour et celles gardées pour plus tard.":inLot?"Lot du jour : les offres les mieux classées, vingt au plus, dont cinq fiches mystère au plus. Il ne se remplit pas pendant que vous triez.":filter==="selected"?"Votre choix : les offres que vous avez sélectionnées, avant de candidater.":filter==="good_matches"?"Filtre automatique : les offres proches de vos critères selon Radar, sélectionnées ou non.":filter==="trash"?"Les offres restent restaurables pendant 10 jours. Après ce délai, elles sont supprimées définitivement à la prochaine ouverture du radar.":"Les offres qu’il vous reste à examiner.";
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
  const pendingReviews=useRef(new Set<string>());
  const reviewing=!!active&&reviewingIds.includes(active.id);
  useEffect(()=>{if(activeId){title.current?.focus({preventScroll:true});if(window.matchMedia("(max-width:760px)").matches)title.current?.closest(".opportunity-detail")?.scrollIntoView({block:"start"});}},[activeId]);
  function close(){onClose();requestAnimationFrame(()=>{const button=opener.current;(button?.isConnected && button.getClientRects().length?button:document.getElementById("workspace-title"))?.focus({preventScroll:true});});}
  async function review(decision?:"to_review"|"selected"|"later"){
    if(!active||pendingReviews.current.has(active.id))return;
    const current=active,next=decision??(reviewState(current)==="selected"?"to_review":"selected");
    pendingReviews.current.add(current.id);setReviewingIds(ids=>[...ids,current.id]);setError("");
    setRetained(null);onClose();
    requestAnimationFrame(()=>{(document.querySelector<HTMLElement>(".opportunity-list .opportunity-open")||document.getElementById("workspace-title"))?.focus({preventScroll:true});});
    try{if(!await onReview(current.id,next) && viewIsCurrent())setError("Votre choix n’a pas été enregistré. L’offre est revenue dans sa liste.");}finally{pendingReviews.current.delete(current.id);setReviewingIds(ids=>ids.filter(id=>id!==current.id));}
  }
  const emptyAction: ReactNode=query?<button className="secondary-button" onClick={onClearSearch}>Effacer la recherche</button>:filter!=="to_review"?<button className="secondary-button" onClick={()=>{changeView("to_review");requestAnimationFrame(()=>document.getElementById("workspace-title")?.focus());}}>Voir les offres à examiner</button>:null;
  return <div className={"opportunities-workspace "+(activeId?"has-open-offer":"")}>
    <div className="opportunities-controls">
    <nav className="workspace-tabs" aria-label="Vues des opportunités">{views.map(([id,label])=><span className="opportunity-tab" key={id}><button type="button" aria-pressed={filter===id} onClick={()=>changeView(id)}>{label}<span>{counts[id]}</span></button>{id==="trash"?<HelpTooltip label="Corbeille">Les offres restent restaurables pendant 10 jours. Après ce délai, elles sont supprimées définitivement à la prochaine ouverture du radar.</HelpTooltip>:null}</span>)}</nav>
    {lotShown&&lot!.size>0?<DailyLotBanner lot={lot!} total={counts.to_review} inLot={inLot} onToggle={()=>{setRetained(null);setSelection([]);setReserveGroupId(null);setAllOffers(inLot);}}/>:null}
    {inReserve?<ReserveGroups groups={groups} shown={reserveGroupId} total={reserveJobs.length} archived={counts.archived??0} busy={trashBusy} onShow={id=>{setRetained(null);setSelection([]);setReserveGroupId(id);}} onDiscard={group=>{setRetained(null);setReserveGroupId(null);onDeleteMany(group.slice(0,50));}} onArchives={()=>changeView("archived")}/>:null}
    {filter==="archived"?<div className="reserve-archive-head"><p><Archive size={16} aria-hidden/>Annonces de plus de {ARCHIVE_AFTER_DAYS} jours. Elles restent consultables et peuvent être remises à examiner.</p><button type="button" className="secondary-button" onClick={()=>changeView("to_review")}><ArrowLeft size={15} aria-hidden/>Retour à « À examiner »</button></div>:null}
    <div className="opportunities-toolbar">
      <div className="review-view-summary">
        {inLot?<span className="daily-lot-order">Classées par adéquation</span>:<Select value={dateOrder} onValueChange={value=>{setDateOrder(value as "newest"|"oldest");setRetained(null);}}><SelectTrigger className="opportunity-date-order" aria-label={filter==="trash"?"Trier par date d’écartement":"Trier par date de mapping"}><span className="opportunity-date-order-label">Trier :</span><SelectValue /></SelectTrigger><SelectContent position="popper" side="bottom" sideOffset={6} align="start" className="opportunity-date-order-menu"><SelectItem value="newest">Du plus récent au plus ancien</SelectItem><SelectItem value="oldest">Du plus ancien au plus récent</SelectItem></SelectContent></Select>}
        {filter!=="trash"?<HelpTooltip label="Vue des opportunités">{viewHelp}</HelpTooltip>:null}
      </div>
      <div className="review-toolbar-actions"><button type="button" className="review-radar-filter" aria-pressed={filter==="good_matches"} onClick={()=>changeView(filter==="good_matches"?"to_review":"good_matches")}>Correspondances Radar <span>{counts.good_matches}</span></button>{orderedJobs.length>0&&filter!=="trash"?<button type="button" className="secondary-button" aria-pressed={selecting} onClick={()=>{setRetained(null);setSelecting(!selecting);setSelection([]);}}>{selecting?"Terminer les actions groupées":"Actions groupées"}</button>:null}</div>
    </div>
    {selecting&&orderedJobs.length?<div className="opportunities-batch" role="group" aria-label="Actions sur les offres cochées"><span role="status">{selected.length} offre{selected.length>1?"s":""} cochée{selected.length>1?"s":""}</span><button type="button" className="secondary-button" disabled={trashBusy} onClick={()=>setSelection(orderedJobs.slice(0,50).map(job=>job.id))}>Cocher {jobs.length>50?"les 50 premières":"tout"}</button>{selected.length?<><button type="button" className="secondary-button" onClick={()=>setSelection([])}>Tout décocher</button><button type="button" className="secondary-button" disabled={trashBusy} onClick={()=>onDeleteMany(selected)}><Trash2 size={15} aria-hidden />Mettre à la corbeille</button></>:null}</div>:null}
    {error?<WorkspaceState error title="Choix non enregistré">{error}</WorkspaceState>:null}
    </div>
    {!displayJobs.length&&inLot?null:!displayJobs.length?<WorkspaceState title={query?"Aucune offre ne correspond à cette recherche":filter==="archived"?"Aucune offre archivée":filter==="trash"?"La corbeille est vide":filter==="to_review"?"Tout est examiné pour l’instant":filter==="selected"?"Votre sélection est encore vide":"Aucune offre dans cette vue"} action={emptyAction}>{query?"Effacez la recherche pour retrouver les offres de cette vue.":filter==="to_review"?"Retrouvez les offres sélectionnées dans Ma sélection.":filter==="archived"?`Les annonces de plus de ${ARCHIVE_AFTER_DAYS} jours arriveront ici.`:filter==="trash"?"Les offres écartées pourront être restaurées ici.":"Ajoutez une annonce ou consultez une autre vue."}</WorkspaceState>:<div className="opportunities-split">
      <div className="opportunity-list" tabIndex={0} role="region" aria-label="Liste des opportunités">{displayJobs.map(job=><article key={job.id} className={"opportunity-list-row "+(active?.id===job.id?"is-current":"")}>
        {selecting?<label className="opportunity-check"><input type="checkbox" aria-label={"Cocher "+job.title+" · "+job.company} checked={selected.some(item=>item.id===job.id)} disabled={trashBusy||(selected.length>=50&&!selection.includes(job.id))} onChange={()=>setSelection(ids=>ids.includes(job.id)?ids.filter(id=>id!==job.id):[...selected.map(item=>item.id),job.id])}/><span className="sr-only">Cocher cette offre</span></label>:null}
        <button type="button" className="opportunity-open" aria-pressed={active?.id===job.id} onClick={event=>{opener.current=event.currentTarget;openListed(job);}}><strong>{job.title}</strong><span>{job.company||"Entreprise à confirmer"} · {job.contractType==="cdi"?"CDI":job.contractType==="cdd"?"CDD":job.contractType==="freelance"?"Freelance":job.contractType==="portage"?"Portage salarial":job.contractType==="part_time"?"Temps partagé":"Contrat à confirmer"}</span><span className="opportunity-conditions"><b>{job.dailyRate?formatPayRangeShort(job.dailyRateMin,job.dailyRateMax,"daily")??`${formatEuro(job.dailyRate)} / jour`:job.annualSalary?formatPayRangeShort(job.salaryMin,job.salaryMax,"annual")??`${formatEuro(job.annualSalary)} / an`:"Rémunération non communiquée"}</b><span>{remote[job.remoteMode]}</span></span><span className="opportunity-evidence">{!job.deletedAt?<FitBadge job={job}/>:null}<span className={"workspace-badge "+(job.flags.length?"is-warning":"")}>{job.deletedAt?"En corbeille":job.flags.length?`${job.flags.length} point${job.flags.length>1?"s":""} à vérifier`:"Critères renseignés"}</span>{!job.deletedAt&&job.flags.some(flag=>flag.startsWith("Sous votre minimum"))?<span className="workspace-badge is-warning">Sous votre minimum</span>:null}<small className="review-list-origin"><span>{job.source}</span>{!job.deletedAt&&reviewState(job)==="selected"?<span className="review-kept-label"><Check size={12}/>Sélectionnée</span>:null}</small></span></button>
      </article>)}</div>
      {active?<section tabIndex={0} className="opportunity-detail" aria-labelledby="opportunity-detail-title" key={active.id}>
        <button type="button" className="secondary-button opportunity-back" onClick={close}><ArrowLeft size={16} aria-hidden />Retour aux offres</button>
        <header className="opportunity-detail-header reading-detail-heading"><div className="reading-heading-text"><h2 id="opportunity-detail-title" ref={title} tabIndex={-1}>{active.title}</h2><div className="reading-company-line"><span>{active.company||"Entreprise à confirmer"}</span><OfferSourceBadge job={active}/></div></div>{!active.deletedAt?<ApplicationTrackingAction job={active} onStatus={async(id,status)=>{const saved=await onStatus(id,status);if(saved&&viewIsCurrent()){const updated={...active,status};setRetained({job:updated,filter,query,index:displayJobs.findIndex(job=>job.id===id)});onOpen(updated);}return saved;}} onOpenApplication={()=>onApplication(active)}/>:null}</header>
        <div className="opportunity-decision signal-opportunity-actions">
          <div className="opportunity-action-main">{hasApplication(active)&&!active.deletedAt?<span className="workspace-badge is-success">Candidature suivie</span>:active.deletedAt?<button type="button" className="secondary-button" disabled={trashBusy} onClick={()=>{onRestore(active);close();}}><Undo2 size={16}/>Restaurer l’offre</button>:<>
          {reviewState(active)!=="selected"?<button type="button" className="radar-add-button" aria-pressed="false" disabled={reviewing||trashBusy} onClick={()=>void review()}>{reviewing?<LoaderCircle size={16} className="animate-spin"/>:<Bookmark size={16} aria-hidden/>}Sélectionner</button>:<button type="button" className="signal-selected-button" aria-pressed="true" title="Retirer de ma sélection" disabled={reviewing||trashBusy} onClick={()=>void review()}><Check size={16} aria-hidden/>Sélectionnée</button>}
          {isArchived(active)?<button type="button" className="secondary-button" disabled={reviewing||trashBusy} onClick={()=>void review("to_review")}><Undo2 size={15} aria-hidden/>Remettre à examiner</button>
            :reviewState(active)==="to_review"?<button type="button" className="secondary-button opportunity-later" disabled={reviewing||trashBusy} onClick={()=>void review("later")}><Clock3 size={15} aria-hidden/>Plus tard</button>
            :reviewState(active)==="later"?<span className="workspace-badge opportunity-later-badge"><Clock3 size={13} aria-hidden/>Gardée pour plus tard</span>:null}
          </>}{announcementUrl?<a href={announcementUrl} target="_blank" rel="noopener noreferrer" className="secondary-button opportunity-source-link"><ExternalLink size={14} aria-hidden/>Voir l’annonce</a>:null}
          </div>
          {!active.deletedAt?<div className="opportunity-action-secondary"><button type="button" className="signal-quiet-button" disabled={reviewing||trashBusy} onClick={()=>{const index=displayJobs.findIndex(job=>job.id===active.id);setRetained(null);onDelete(active,displayJobs[index+1]??displayJobs[index-1]);}}><Trash2 size={15}/>Écarter</button></div>:null}
        </div>
        {heldOutside?<p className="sr-only" role="status">{hasApplication(active)?"Candidature enregistrée. L’offre reste ouverte pendant votre lecture.":reviewState(active)==="selected"?"Offre sélectionnée. Elle reste ouverte pendant votre lecture.":reviewState(active)==="later"?"Offre gardée pour plus tard, dans la réserve.":"Offre remise à examiner. Elle reste ouverte pendant votre lecture."}</p>:null}
        <OfferWorkspace key={active.id} showApplicationAction={false} showAnnouncement={false} job={active} profile={profile} initialView={view} onViewChange={next=>onViewChange(active,next)} context="opportunity" onStatus={async(id,status)=>{const saved=await onStatus(id,status);if(saved&&viewIsCurrent()){const updated={...active,status};setRetained({job:updated,filter,query,index:displayJobs.findIndex(job=>job.id===id)});onOpen(updated);}return saved;}} onNote={onNote} onChange={updated=>{if(kept?.job.id===updated.id)setRetained({...kept,job:updated});onChange(updated);}} onOpenApplication={()=>onApplication(active)}/>
        {active.deletedAt?<p className="workspace-caption mt-5">Écartée le {formatDate(active.deletedAt)}. {active.dismissalNote||"Restauration possible, notes et entretiens conservés."}</p>:null}
        <OpportunityReadingNotes/>
      </section>:null}
    </div>}
    {!displayJobs.length?<OpportunityReadingNotes/>:null}
  </div>;
}

function ReserveGroups({groups,shown,total,archived,busy,onShow,onDiscard,onArchives}:{groups:ReturnType<typeof groupReserve>;shown:ReserveGroupId|null;total:number;archived:number;busy:boolean;onShow:(id:ReserveGroupId|null)=>void;onDiscard:(jobs:JobRecord[])=>void;onArchives:()=>void}){
  const [confirming,setConfirming]=useState<ReserveGroupId|null>(null);
  return <section className="reserve" aria-labelledby="reserve-title">
    <div className="reserve-head"><h3 id="reserve-title">La réserve <span>{total} offre{total>1?"s":""}</span></h3>
      <p>Rangée par groupes : une décision suffit pour tout un groupe. Les annonces publiées il y a au moins {ARCHIVE_AFTER_DAYS} jours partent aux archives. Une remise à examiner ou « Plus tard » vous redonne {ARCHIVE_AFTER_DAYS} jours.</p></div>
    <ul className="reserve-groups">{groups.map(group=>{const count=group.jobs.length,discard=Math.min(count,50);return <li key={group.id} className={"reserve-group"+(shown===group.id?" is-shown":"")}>
      <div className="reserve-group-text"><strong>{group.label}</strong><span className="reserve-group-count">{count}</span><small>{group.help}</small></div>
      {confirming===group.id?<div className="reserve-group-actions" role="group" aria-label={`Confirmer : ${group.label}`}>
        <button type="button" className="signal-danger-button" disabled={busy} onClick={()=>{setConfirming(null);onDiscard(group.jobs);}}><Trash2 size={14} aria-hidden/>{count>50?"Écarter les 50 premières":discard>1?`Écarter ces ${discard} offres`:"Écarter cette offre"}</button>
        <button type="button" className="signal-quiet-button" onClick={()=>setConfirming(null)}>Annuler</button></div>
      :<div className="reserve-group-actions">
        <button type="button" className="secondary-button" aria-pressed={shown===group.id} onClick={()=>onShow(shown===group.id?null:group.id)}>{shown===group.id?"Voir toute la réserve":"Voir le groupe"}</button>
        <button type="button" className="signal-quiet-button" disabled={busy} onClick={()=>setConfirming(group.id)}><Trash2 size={14} aria-hidden/>Écarter le groupe</button></div>}
    </li>;})}</ul>
    {archived?<button type="button" className="reserve-archives" onClick={onArchives}><Archive size={15} aria-hidden/>Archives ({archived})</button>:null}
  </section>;
}

function DailyLotBanner({lot,total,inLot,onToggle}:{lot:DailyLot;total:number;inLot:boolean;onToggle:()=>void}){
  const left=lot.remaining.length,done=!left;
  const others=lot.waiting;
  const caption=done
    ?`Vous avez trié les ${lot.size} offres du jour.${others?` ${others} autre${others>1?"s":""} attend${others>1?"ent":""}, sans urgence.`:""}`
    :lot.triaged?`${lot.triaged} triée${lot.triaged>1?"s":""} sur ${lot.size} · les mieux classées des ${total} à examiner`:`Les ${lot.size} mieux classées des ${total} à examiner. Le lot ne se remplit pas pendant que vous triez.`;
  return <section className={"daily-lot"+(done?" is-done":"")} aria-label="Lot du jour">
    <div className="daily-lot-text">
      <p className="daily-lot-headline" aria-live="polite"><strong>{lotHeadline(lot)}</strong>{left&&lot.triaged?<span> dans votre lot du jour</span>:null}</p>
      <p className="daily-lot-caption">{caption}</p>
      <div className="daily-lot-bar" role="progressbar" aria-label="Avancement du lot du jour" aria-valuemin={0} aria-valuemax={lot.size} aria-valuenow={lot.triaged} aria-valuetext={`${lot.triaged} sur ${lot.size}`}><span style={{width:`${lot.size?Math.round(lot.triaged/lot.size*100):0}%`}}/></div>
    </div>
    {inLot?(others?<button type="button" className="secondary-button daily-lot-switch" onClick={onToggle}>{done?"Continuer avec la réserve":`Voir la réserve (${others})`}</button>:null)
      :<button type="button" className="secondary-button daily-lot-switch" onClick={onToggle}>Revenir au lot du jour</button>}
  </section>;
}

function OpportunityReadingNotes(){return <footer className="opportunity-reading-notes"><span><ShieldCheck size={13} aria-hidden/>Vos données restent privées.</span><span>Aucune candidature envoyée automatiquement.</span></footer>;}
