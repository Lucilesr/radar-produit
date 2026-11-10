"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, Check, Bookmark, LoaderCircle, Trash2, Undo2, ShieldCheck, Archive } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ApplicationTrackingAction, OfferFitCard, FitBadge, OfferSourceBadge, OfferWorkspace, type WorkspaceView } from "@/components/offer-workspace";
import {WorkspaceFormError} from "@/components/workspace-form";
import { WorkspaceState } from "@/components/workspace-ui";
import { HelpTooltip } from "@/components/help-tooltip";
import { selectionInView } from "@/lib/offer-trash-ui";
import { ARCHIVE_AFTER_DAYS, archiveReferenceTime, hasApplication, isArchived, reviewState, sortOpportunitiesByDate, type OpportunityView } from "@/lib/opportunity-views";
import { groupReserve, neighboringRole, type ReserveGroupId } from "@/lib/reserve";
import { formatDate } from "@/lib/application-workflow";
import { formatEuro } from "@/lib/matching";
import { formatPayRangeShort } from "@/lib/pay-range";
import { isMysteryOffer, pinMysteryOffers, putMysteryOffersLast } from "@/lib/fit";
import { lotHeadline, type DailyLot } from "@/lib/daily-lot";
import { SignalProgress } from "@/components/signal/signal-progress";
import { FridayRescue } from "@/components/friday-rescue";
import { triageShortcut } from "@/lib/triage-learning";
import type { CandidateProfile, JobRecord, JobStatus } from "@/lib/types";

const views: [OpportunityView,string][]=[["to_review","À examiner"],["selected","Ma sélection"]];
const retiredViews = [["archived","Archives"],["trash","Corbeille"]] as const;
const remote={full_remote:"Full remote",exceptional:"Présence ponctuelle",hybrid:"Hybride",onsite:"Sur site",unknown:"Remote à confirmer"};
export function OpportunitiesWorkspace({source,onClearSource,contextualPrompt,tools,enabled=true,onReload,onReserveChanged,lot,jobs,rescueOffers=[],counts,filter,onFilter,query,onClearSearch,activeId,view,onOpen,onClose,profile,onReview,onDelete,onDeleteMany,onRestore,onStatus,onNote,onChange,onApplication,onViewChange,trashBusy,currentJob}: {
  source?:string;onClearSource?:()=>void;enabled?:boolean;onReload?:()=>Promise<boolean>;onReserveChanged:(roleChanged:boolean)=>Promise<boolean>;rescueOffers?:JobRecord[];
  tools?:ReactNode;contextualPrompt?:ReactNode;lot?:DailyLot|null; currentJob?:JobRecord|null; jobs:JobRecord[];counts:Record<OpportunityView,number>;filter:OpportunityView;onFilter:(view:OpportunityView)=>void;query:string;onClearSearch:()=>void;
  activeId?:string;view:WorkspaceView;onOpen:(job:JobRecord)=>void;onClose:()=>void;profile:CandidateProfile;
  onReview:(id:string,state:"to_review"|"selected"|"later")=>Promise<boolean>;onDelete:(job:JobRecord,next?:JobRecord)=>void;onDeleteMany:(jobs:JobRecord[])=>void;onRestore:(job:JobRecord)=>Promise<boolean>;
  onStatus:(id:string,status:JobStatus)=>Promise<boolean>;onNote:(id:string,note:string)=>Promise<boolean>;onChange:(job:JobRecord)=>void;onApplication:(job:JobRecord)=>void;
  onViewChange:(job:JobRecord,view:WorkspaceView)=>void;trashBusy:boolean;
}) {
  const [selection,setSelection]=useState<string[]>([]),[selecting,setSelecting]=useState(false),[reviewingIds,setReviewingIds]=useState<string[]>([]),[error,setError]=useState<{jobId:string;message:string}|null>(null);
  const selectionAction=useRef<HTMLButtonElement>(null);
  const [editing,setEditing]=useState(false);
  const [applyingId,setApplyingId]=useState<string|null>(null);
  const [dateOrder,setDateOrder]=useState<"newest"|"oldest">("newest");
  // Score v2 S4: up to five mystery offers lead « À examiner », whatever the chosen order.
  // Tri Q1: « À examiner » opens on the lot of the day; « Toutes les offres » keeps the full list.
  const [allOffers,setAllOffers]=useState(false);
  const lotShown=filter==="to_review"&&!query&&!!lot&&(allOffers||lot.size>0||counts.to_review>0||counts.archived>0||rescueOffers.length>0);
  const inLot=lotShown&&lot!.size>0&&!allOffers;
  // Tri Q1b: outside the lot, « À examiner » is the reserve, sorted into groups decided in one go.
  const inReserve=lotShown&&!inLot;
  const [reserveGroupId,setReserveGroupId]=useState<ReserveGroupId|null>(null);
  const [groupsNow]=useState(()=>Date.now());
  const reserveJobs=inReserve?jobs.filter(job=>!lot!.remaining.some(item=>item.id===job.id)):[];
  const groups=inReserve?groupReserve(reserveJobs,groupsNow):[];
  const shownGroup=groups.find(group=>group.id===reserveGroupId);
  const listed=inReserve?(shownGroup?.jobs??reserveJobs):jobs;
  const sortedJobs=inLot?lot!.remaining:sortOpportunitiesByDate(listed,filter,dateOrder);
  const orderedJobs=filter==="selected"?putMysteryOffersLast(sortedJobs):filter==="to_review"?pinMysteryOffers(sortedJobs):sortedJobs;
  const [retained,setRetained]=useState<{job:JobRecord;filter:OpportunityView;query:string;index:number}|null>(null);
  const kept=retained?.filter===filter&&retained.query===query?retained:null;
  const retainedJob=kept?(orderedJobs.find(job=>job.id===kept.job.id)??(currentJob?.id===kept.job.id?currentJob:kept.job)):undefined;
  const displayJobs=[...orderedJobs];
  if(kept&&!displayJobs.some(job=>job.id===kept.job.id))displayJobs.splice(Math.min(kept.index,displayJobs.length),0,retainedJob!);
  const selected=selectionInView(orderedJobs,selection);
  const active=displayJobs.find(job=>job.id===activeId)??retainedJob??displayJobs[0];
  const heldOutside=!!kept&&!jobs.some(job=>job.id===kept.job.id);
  const retiredView=filter==="archived"||filter==="trash";
  const viewHelp=inReserve?"Le reste de vos offres, consultable à tout moment.":filter==="selected"?"Votre sélection à traiter.":filter==="good_matches"?"Offres proches de vos critères, selon Radar.":"Les offres qu’il vous reste à examiner.";
  const currentScope=useRef({filter,query,activeId});
  useEffect(()=>{currentScope.current={filter,query,activeId};},[filter,query,activeId]);
  const viewIsCurrent=()=>currentScope.current.filter===filter&&currentScope.current.query===query&&currentScope.current.activeId===activeId;
  const [readingScope,setReadingScope]=useState({filter,query});
  if(readingScope.filter!==filter||readingScope.query!==query){setReadingScope({filter,query});setRetained(null);}
  function changeView(next:OpportunityView){setRetained(null);onFilter(next);setSelection([]);setSelecting(false);setError(null);}
  function openListed(job:JobRecord){if(kept&&job.id!==kept.job.id)setRetained(null);onOpen(job);}

  const readingPane=useRef<HTMLDivElement>(null);
  const hasReadingPane=displayJobs.length>0;
  useEffect(()=>{
    const pane=readingPane.current, viewport=pane?.closest<HTMLElement>(".radar-app");
    if(!pane||!viewport)return;
    const columns=window.matchMedia("(min-width:761px)");
    let frame=0;
    const update=()=>{
      if(frame)return;
      frame=requestAnimationFrame(()=>{
        frame=0;
        const height=columns.matches?`${viewport.clientHeight}px`:"";
        const offset=pane.getBoundingClientRect().top-viewport.getBoundingClientRect().top;
        const pinned=String(columns.matches&&offset<=1);
        if(pane.style.getPropertyValue("--opportunity-reading-height")!==height){if(height)pane.style.setProperty("--opportunity-reading-height",height);else pane.style.removeProperty("--opportunity-reading-height");}
        if(columns.matches)pane.style.setProperty("--opportunity-reading-offset",`${Math.max(0,offset)}px`);
        else pane.style.removeProperty("--opportunity-reading-offset");
        if(pane.dataset.readingPinned!==pinned)pane.dataset.readingPinned=pinned;
      });
    };
    const resize=new ResizeObserver(update);
    resize.observe(viewport);resize.observe(pane.parentElement!);
    viewport.addEventListener("scroll",update,{passive:true});
    window.addEventListener("resize",update);
    update();
    return()=>{resize.disconnect();cancelAnimationFrame(frame);viewport.removeEventListener("scroll",update);window.removeEventListener("resize",update);};
  },[hasReadingPane]);

  const title=useRef<HTMLHeadingElement>(null);
  const opener=useRef<HTMLButtonElement|null>(null);
  const pendingReviews=useRef(new Set<string>());
  const reviewing=!!active&&reviewingIds.includes(active.id);
  const archived=!!active&&isArchived(active);
  const applied=!!active&&hasApplication(active);
  const selectedOffer=!!active&&reviewState(active)==="selected";
  const actionsBusy=reviewing||trashBusy||applyingId===active?.id;
  useEffect(()=>{
    if(!activeId||document.activeElement?.closest(".aligned-offer-tabs [role=tablist]"))return;
    title.current?.focus({preventScroll:true});
    if(window.matchMedia("(max-width:760px)").matches)title.current?.closest(".opportunity-detail")?.scrollIntoView({block:"start"});
    else readingPane.current?.scrollIntoView({block:"start"});
  },[activeId]);
  function close(){onClose();requestAnimationFrame(()=>{const button=opener.current;(button?.isConnected && button.getClientRects().length?button:document.getElementById("workspace-title"))?.focus({preventScroll:true});});}
  async function review(decision?:"to_review"|"selected"|"later"){
    if(!active||actionsBusy||pendingReviews.current.has(active.id))return;
    const current=active,next=decision??(reviewState(current)==="selected"?"to_review":"selected");
    pendingReviews.current.add(current.id);setReviewingIds(ids=>[...ids,current.id]);setError(null);
    const index=displayJobs.findIndex(job=>job.id===current.id),following=displayJobs[index+1]??displayJobs[index-1];
    try{
      const saved=await onReview(current.id,next);
      if(viewIsCurrent()){
        if(!saved){requestAnimationFrame(()=>selectionAction.current?.focus());setError({jobId:current.id,message:"Votre choix n’a pas été enregistré. L’offre reste à sa place."});}
        else {setRetained(null);if(following)onOpen(following);else close();}
      }
    }catch{if(viewIsCurrent()){setError({jobId:current.id,message:"Votre choix n’a pas été enregistré. L’offre reste à sa place."});requestAnimationFrame(()=>selectionAction.current?.focus());}}
    finally{pendingReviews.current.delete(current.id);setReviewingIds(ids=>ids.filter(id=>id!==current.id));}
  }
  useEffect(()=>{
    const handle=(event:KeyboardEvent)=>{
      const target=event.target instanceof Element?event.target:null;
      const action=triageShortcut(event.key,{open:enabled&&!!activeId&&!!active&&!active.deletedAt&&!hasApplication(active),editing:editing||!!target?.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="combobox"],[role="textbox"],[role="dialog"],[role="alertdialog"],[role="listbox"],[role="menu"]'),disabled:profile.preferences?.triageShortcuts===false||actionsBusy,modifier:event.altKey||event.metaKey||event.ctrlKey,repeat:event.repeat});
      if(!action||event.defaultPrevented||!active||(action==="later"&&archived))return;
      event.preventDefault();
      if(action==="discard"){const index=displayJobs.findIndex(job=>job.id===active.id);onDelete(active,displayJobs[index+1]??displayJobs[index-1]);}
      else void review(action==="selected"?undefined:action);
    };
    window.addEventListener("keydown",handle);
    return()=>window.removeEventListener("keydown",handle);
  },[editing,enabled,activeId,active,profile.preferences?.triageShortcuts,actionsBusy,archived,displayJobs,onDelete,review]);
  const emptyAction: ReactNode=query?<button className="secondary-button" onClick={onClearSearch}>Effacer la recherche</button>:filter!=="to_review"?<button className="secondary-button" onClick={()=>{changeView("to_review");requestAnimationFrame(()=>document.getElementById("workspace-title")?.focus());}}>Voir les offres à examiner</button>:null;
  return <div className={"opportunities-workspace "+(activeId?"has-open-offer":"")}>
    <div className="opportunities-controls">
    {tools}
    {source?<div className="scan-source-filter"><span>Source : <strong>{source}</strong></span><button type="button" className="secondary-button" onClick={onClearSource}>Effacer le filtre de source</button></div>:null}
    <nav className="workspace-tabs" aria-label="Vues des offres">
      {views.map(([id,label])=><span className="opportunity-tab" key={id}><button type="button" aria-pressed={filter===id} onClick={()=>changeView(id)}>{label}<span>{counts[id]}</span></button></span>)}
      <span className="opportunity-tab"><button type="button" aria-pressed={retiredView} onClick={()=>{if(!retiredView)changeView("archived");}}>Archives et corbeille<span>{counts.archived+counts.trash}</span></button></span>
    </nav>
    {retiredView?<div>
      <nav className="signal-workspace-tabs" aria-label="Archives et corbeille">
        {retiredViews.map(([id,label])=><button type="button" key={id} aria-current={filter===id?"page":undefined} onClick={()=>changeView(id)}>{label} · {counts[id]}</button>)}
      </nav>
      <p className="signal-help">{filter==="archived"?`Les offres sorties du tri après ${ARCHIVE_AFTER_DAYS} jours peuvent être remises à examiner.`:"Les offres que vous avez écartées peuvent être restaurées pendant 10 jours."}</p>
    </div>:null}
    {lotShown&&lot!.size>0?<DailyLotBanner lot={lot!} hasRescue={rescueOffers.length>0} inLot={inLot} onToggle={()=>{setRetained(null);setSelection([]);setReserveGroupId(null);setAllOffers(inLot);onClose();requestAnimationFrame(()=>document.getElementById(inLot?"reserve-title":"workspace-title")?.focus());}}/>:null}
    {filter==="to_review"&&!query&&!activeId?contextualPrompt:null}
    {inReserve&&rescueOffers.length>0?<FridayRescue offers={rescueOffers} busy={trashBusy} onRestore={onRestore}/>:null}
    {inReserve?<ReserveGroups groups={groups} shown={reserveGroupId} total={reserveJobs.length} busy={trashBusy} onShow={id=>{setRetained(null);setSelection([]);setReserveGroupId(id);onClose();requestAnimationFrame(()=>document.getElementById("reserve-title")?.focus());}} roles={profile.searchPreferences?.roles??[]} onChanged={async roleChanged=>{setRetained(null);setSelection([]);return onReserveChanged(roleChanged);}}/>:null}
    <div className="opportunities-toolbar">
      {!inLot?<div className="review-view-summary">
        <Select value={dateOrder} onValueChange={value=>{setDateOrder(value as "newest"|"oldest");setRetained(null);}}><SelectTrigger className="opportunity-date-order" aria-label={filter==="trash"?"Trier par date d’écartement":"Trier par date de mapping"}><span className="opportunity-date-order-label">Trier :</span><SelectValue /></SelectTrigger><SelectContent position="popper" side="bottom" sideOffset={6} align="start" className="opportunity-date-order-menu"><SelectItem value="newest">Du plus récent au plus ancien</SelectItem><SelectItem value="oldest">Du plus ancien au plus récent</SelectItem></SelectContent></Select>
        {!retiredView?<HelpTooltip label="Vue des offres">{viewHelp}</HelpTooltip>:null}
      </div>:null}
      <div className="review-toolbar-actions"><button type="button" className="review-radar-filter" aria-pressed={filter==="good_matches"} onClick={()=>changeView(filter==="good_matches"?"to_review":"good_matches")}>Correspondances Radar <span>{counts.good_matches}</span></button>{orderedJobs.length>0&&filter!=="trash"?<button type="button" className="secondary-button" aria-pressed={selecting} onClick={()=>{setRetained(null);setSelecting(!selecting);setSelection([]);}}>{selecting?"Terminer les actions groupées":"Actions groupées"}</button>:null}</div>
    </div>
    {selecting&&orderedJobs.length?<div className="opportunities-batch" role="group" aria-label="Actions sur les offres cochées"><span role="status">{selected.length} offre{selected.length>1?"s":""} cochée{selected.length>1?"s":""}</span><button type="button" className="secondary-button" disabled={trashBusy} onClick={()=>setSelection(orderedJobs.slice(0,50).map(job=>job.id))}>Cocher {jobs.length>50?"les 50 premières":"tout"}</button>{selected.length?<><button type="button" className="secondary-button" onClick={()=>setSelection([])}>Tout décocher</button><button type="button" className="secondary-button" disabled={trashBusy} onClick={()=>onDeleteMany(selected)}><Trash2 size={15} aria-hidden />Mettre à la corbeille</button></>:null}</div>:null}
    </div>
    {!displayJobs.length&&inLot?null:!displayJobs.length?<WorkspaceState title={query?"Aucune offre ne correspond à cette recherche":filter==="archived"?"Aucune offre archivée":filter==="trash"?"La corbeille est vide":inReserve?"Aucune offre dans la réserve":filter==="to_review"?"Tout est examiné pour l’instant":filter==="selected"?"Votre sélection est encore vide":"Aucune offre dans cette vue"} action={emptyAction}>{query?"Effacez la recherche pour retrouver les offres de cette vue.":inReserve?"Votre lot du jour reste accessible au-dessus. Les offres gardées pour plus tard apparaîtront ici.":filter==="to_review"?"Retrouvez les offres sélectionnées dans Ma sélection.":filter==="archived"?`Les annonces de plus de ${ARCHIVE_AFTER_DAYS} jours arriveront ici.`:filter==="trash"?"Les offres écartées pourront être restaurées ici.":"Ajoutez une annonce ou consultez une autre vue."}</WorkspaceState>:<div className="opportunities-split" ref={readingPane}>
      <div className="opportunity-list" tabIndex={0} role="region" aria-label="Liste des offres">{displayJobs.map(job=><article key={job.id} className={"opportunity-list-row "+(active?.id===job.id?"is-current":"")}>
        {selecting?<label className="opportunity-check"><input type="checkbox" aria-label={"Cocher "+job.title+" · "+job.company} checked={selected.some(item=>item.id===job.id)} disabled={trashBusy||(selected.length>=50&&!selection.includes(job.id))} onChange={()=>setSelection(ids=>ids.includes(job.id)?ids.filter(id=>id!==job.id):[...selected.map(item=>item.id),job.id])}/><span className="sr-only">Cocher cette offre</span></label>:null}
        <button type="button" className="opportunity-open" aria-pressed={active?.id===job.id} onClick={event=>{opener.current=event.currentTarget;openListed(job);}}><strong>{job.title}</strong><span>{job.company||"Entreprise à confirmer"} · {job.contractType==="cdi"?"CDI":job.contractType==="cdd"?"CDD":job.contractType==="freelance"?"Freelance":job.contractType==="portage"?"Portage salarial":job.contractType==="part_time"?"Temps partagé":"Contrat à confirmer"}</span><span className="opportunity-conditions"><b>{job.dailyRate?formatPayRangeShort(job.dailyRateMin,job.dailyRateMax,"daily")??`${formatEuro(job.dailyRate)} / jour`:job.annualSalary?formatPayRangeShort(job.salaryMin,job.salaryMax,"annual")??`${formatEuro(job.annualSalary)} / an`:"Rémunération non communiquée"}</b><span>{remote[job.remoteMode]}</span></span><span className="opportunity-evidence">{!job.deletedAt?<FitBadge job={job}/>:null}<span className={"workspace-badge "+(job.flags.length?"is-warning":"")}>{job.deletedAt?"En corbeille":job.flags.length?`${job.flags.length} point${job.flags.length>1?"s":""} à vérifier`:"Critères renseignés"}</span>{!job.deletedAt&&job.flags.some(flag=>flag.startsWith("Sous votre minimum"))?<span className="workspace-badge is-warning">Sous votre minimum</span>:null}<small className="review-list-origin"><span>{job.source}</span>{!job.deletedAt&&reviewState(job)==="selected"?<span className="review-kept-label"><Check size={12}/>Sélectionnée</span>:null}</small></span></button>
      </article>)}</div>
      {active?<section tabIndex={0} className="opportunity-detail" aria-labelledby="opportunity-detail-title" key={active.id}>
        <div className="aligned-offer-reading-content" tabIndex={0} role="region" aria-label="Contenu de la fiche">
        <div className="aligned-offer-mobile-header"><button type="button" className="signal-quiet-button opportunity-back" onClick={close}><ArrowLeft size={16} aria-hidden />{inLot?"Lot du jour":"Offres"}</button>{inLot?<div><span>{lotHeadline(lot!)}</span><SignalProgress value={lot!.triaged} max={lot!.size} label="Avancement du lot du jour" tone="neutral"/></div>:null}</div>
        {archived?<div className="aligned-offer-archive">
          <span><Archive size={16} aria-hidden/>Archivée le {formatDate(new Date(archiveReferenceTime(active)+ARCHIVE_AFTER_DAYS*86400000).toISOString())}.</span>
          <button type="button" className="secondary-button" disabled={actionsBusy||editing} onClick={()=>void review("to_review")}>Remettre à examiner</button>
        </div>:null}
        {active.deletedAt?<div className="aligned-offer-archive">
          <span>Écartée le {formatDate(active.deletedAt)}. Restaurez l’offre pour agir.</span>
          <button type="button" className="secondary-button" disabled={actionsBusy||editing} onClick={async()=>{if(await onRestore(active))close();}}><Undo2 size={16} aria-hidden/>Restaurer l’offre</button>
        </div>:null}
        <header className="opportunity-detail-header reading-detail-heading"><div className="reading-heading-text"><div className="reading-company-line"><span>{active.company||"Entreprise à confirmer"}</span><OfferSourceBadge job={active}/>{active.publishedAt?<span>Publiée le {formatDate(active.publishedAt)}</span>:null}</div><h2 id="opportunity-detail-title" ref={title} tabIndex={-1}>{active.title}</h2></div><OfferFitCard job={active}/></header>
        {error&&error.jobId===active.id?<WorkspaceState error title="Choix non enregistré" action={onReload?<button type="button" className="secondary-button" disabled={trashBusy} onClick={()=>void onReload()}>Relire les offres pour vérifier</button>:undefined}>{error.message}</WorkspaceState>:null}
        {heldOutside?<p className="sr-only" role="status">{hasApplication(active)?"Candidature enregistrée. L’offre reste ouverte pendant votre lecture.":reviewState(active)==="selected"?"Offre sélectionnée. Elle reste ouverte pendant votre lecture.":reviewState(active)==="later"?"Offre gardée pour plus tard, dans la réserve.":"Offre remise à examiner. Elle reste ouverte pendant votre lecture."}</p>:null}
        {active.deletedAt&&active.dismissalNote?<p className="workspace-caption">{active.dismissalNote}</p>:null}
        <OfferWorkspace key={active.id} onEditingChange={setEditing} showApplicationAction={false} showAnnouncement={false} job={active} profile={profile} initialView={view} onViewChange={next=>onViewChange(active,next)} context="opportunity" onStatus={onStatus} onNote={onNote} onChange={updated=>{if(kept?.job.id===updated.id)setRetained({...kept,job:updated});onChange(updated);}} onOpenApplication={()=>onApplication(active)}/>
        <OpportunityReadingNotes/>
        </div>
        <div role="group" aria-label="Actions sur cette offre" className="opportunity-decision signal-opportunity-actions">
          <button ref={selectionAction} type="button" className={selectedOffer?"signal-selected-button":"radar-add-button"} aria-pressed={selectedOffer} disabled={!!active.deletedAt||applied||actionsBusy||editing} onClick={()=>void review()}>
            {reviewing?<LoaderCircle size={16} className="animate-spin" aria-hidden/>:<Bookmark size={16} aria-hidden/>}{selectedOffer?"Sélectionnée":"Sélectionner"}{profile.preferences?.triageShortcuts!==false&&!active.deletedAt&&!applied?<kbd>S</kbd>:null}
          </button>
          <button type="button" className="secondary-button" disabled={!!active.deletedAt||applied||actionsBusy||editing} onClick={()=>{const index=displayJobs.findIndex(job=>job.id===active.id);setRetained(null);onDelete(active,displayJobs[index+1]??displayJobs[index-1]);}}>
            <Trash2 size={16} aria-hidden/>{active.deletedAt?"Écartée":"Écarter"}{profile.preferences?.triageShortcuts!==false&&!active.deletedAt&&!applied?<kbd>X</kbd>:null}
          </button>
          <ApplicationTrackingAction job={active} disabled={actionsBusy||editing||!!active.deletedAt&&!applied} onStatus={async(id,status)=>{
            setApplyingId(id);
            try{
              const saved=await onStatus(id,status);
              if(saved&&viewIsCurrent()){
                const updated={...active,status};
                setRetained({job:updated,filter,query,index:displayJobs.findIndex(job=>job.id===id)});
                onOpen(updated);
              }
              return saved;
            }finally{setApplyingId(null);}
          }} onOpenApplication={()=>onApplication(active)}/>
        </div>
      </section>:null}
    </div>}
    {!displayJobs.length?<OpportunityReadingNotes/>:null}
  </div>;
}

type ReserveReceipt={id:string;action:string;count:number;removed:number;undone:boolean};
function ReserveGroups({groups,shown,total,busy,roles,onShow,onChanged}:{groups:ReturnType<typeof groupReserve>;shown:ReserveGroupId|null;total:number;busy:boolean;roles:string[];onShow:(id:ReserveGroupId|null)=>void;onChanged:(roleChanged:boolean)=>Promise<boolean>}){
  const [confirming,setConfirming]=useState<{id:ReserveGroupId;action:"discard"|"archive"}|null>(null),[working,setWorking]=useState(false),[error,setError]=useState("");
  const [initialGroups]=useState(groups.length),[done,setDone]=useState<ReserveGroupId[]>([]),[removed,setRemoved]=useState(0),[recent,setRecent]=useState<{receipt:ReserveReceipt;group:ReserveGroupId;alreadyDone:boolean}|null>(null);
  const lock=useRef(false),pending=useRef<{signature:string;id:string}|null>(null);
  const disabled=busy||working;
  async function decide(action:"discard"|"archive"|"keep"|"role"|"undo",group?:typeof groups[number],role?:string){
    if(lock.current||busy)return;lock.current=true;setWorking(true);setError("");
    const ids=group?.jobs.slice(0,50).map(job=>job.id),signature=JSON.stringify({action,ids,role});
    const id=action==="undo"?recent?.receipt.id:pending.current?.signature===signature?pending.current.id:crypto.randomUUID();
    if(!id){lock.current=false;setWorking(false);return;}pending.current={signature,id};
    try{
      const response=await fetch("/api/reserve-actions",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,action,ids,role}),signal:AbortSignal.timeout(20000)});
      const result=await response.json() as ReserveReceipt&{error?:string};if(!response.ok)throw new Error(result.error??"Choix non confirmé. Actualisez la réserve avant de réessayer.");
      pending.current=null;setConfirming(null);
      if(action==="undo"&&recent){setRemoved(value=>Math.max(0,value-recent.receipt.removed));if(!recent.alreadyDone)setDone(value=>value.filter(id=>id!==recent.group));setRecent(null);}
      else if(group&&!result.undone){setRecent({receipt:result,group:group.id,alreadyDone:done.includes(group.id)});setDone(value=>value.includes(group.id)?value:[...value,group.id]);setRemoved(value=>value+result.removed);}
      if(!await onChanged(result.action==="role"))setError("Votre choix est enregistré, mais la liste n’a pas pu être relue. Actualisez avant une autre décision.");
    }catch(problem){setError(problem instanceof Error&&!['TimeoutError','AbortError','TypeError'].includes(problem.name)?problem.message:"Réponse non reçue. Réessayez le même choix ou actualisez pour vérifier ; aucun contenu n’est effacé définitivement.");}
    finally{lock.current=false;setWorking(false);requestAnimationFrame(()=>{if(document.activeElement===document.body||!document.activeElement?.isConnected)document.getElementById("reserve-title")?.focus();});}
  }
  return <section className="reserve" aria-labelledby="reserve-title" aria-busy={working}>
    <div className="reserve-head"><h3 id="reserve-title" tabIndex={-1}>La réserve <span>{total} offre{total>1?"s":""}</span></h3>
      <details className="reserve-help"><summary>Comment fonctionne la réserve ?</summary><p>Rangée par groupes : choisissez une action pour un groupe. Les annonces publiées il y a au moins {ARCHIVE_AFTER_DAYS} jours partent aux archives. Une remise à examiner ou « Plus tard » vous redonne {ARCHIVE_AFTER_DAYS} jours.</p></details></div>
    <p className="reserve-progress" role="status">{done.length} groupe{done.length>1?"s":""} rangé{done.length>1?"s":""} sur {Math.max(initialGroups,done.length)} · {removed} offre{removed>1?"s":""} en moins dans la réserve</p>
    {recent?<div className="reserve-undo"><span>{recent.receipt.action==="keep"?`${recent.receipt.count} offre${recent.receipt.count>1?"s":""} gardée${recent.receipt.count>1?"s":""} pour plus tard.`:recent.receipt.action==="role"?"Poste ajouté à vos critères.":`${recent.receipt.count} offre${recent.receipt.count>1?"s":""} ${recent.receipt.action==="archive"?"archivée":"écartée"}${recent.receipt.count>1?"s":""}.`}</span><button type="button" className="secondary-button" disabled={disabled} onClick={()=>void decide("undo")}>Annuler le dernier rangement</button></div>:null}
    {error?<div><WorkspaceFormError message={error}/><button type="button" className="secondary-button" disabled={disabled} onClick={()=>void onChanged(recent?.receipt.action==="role").then(ok=>{if(ok){setError("");pending.current=null;setRecent(null);setDone([]);setRemoved(0);}})}>Actualiser la réserve</button></div>:null}
    <ul className="reserve-groups">{groups.map(group=>{const count=group.jobs.length,batch=Math.min(count,50),role=roles.length<12&&["far","other"].includes(group.id)?neighboringRole(group.jobs,roles):null;return <li key={group.id} className={"reserve-group"+(shown===group.id?" is-shown":"")}>
      <div className="reserve-group-text"><strong>{group.label}</strong><span className="reserve-group-count">{count}</span><small>{group.help}{count>50?" Une décision porte sur les 50 premières offres.":""}</small></div>
      {confirming?.id===group.id?<div className="reserve-group-actions" role="group" aria-label={`Confirmer : ${group.label}`}>
        <button type="button" className={confirming.action==="discard"?"signal-danger-button":"secondary-button"} disabled={disabled} onClick={()=>void decide(confirming.action,group)}>{confirming.action==="discard"?<Trash2 size={14} aria-hidden/>:<Archive size={14} aria-hidden/>}{confirming.action==="archive"?(batch>1?`Archiver ces ${batch} offres`:"Archiver cette offre"):count>50?"Écarter les 50 premières":batch>1?`Écarter ces ${batch} offres`:"Écarter cette offre"}</button>
        <button type="button" className="signal-quiet-button" disabled={disabled} onClick={()=>setConfirming(null)}>Annuler</button></div>
      :<div className="reserve-group-actions">
        <button type="button" className="secondary-button" disabled={disabled} aria-pressed={shown===group.id} onClick={()=>onShow(shown===group.id?null:group.id)}>{shown===group.id?"Voir toute la réserve":"Voir le groupe"}</button>
        {group.id==="old"?<button type="button" className="secondary-button" disabled={disabled} onClick={()=>setConfirming({id:group.id,action:"archive"})}>{batch>1?`Archiver les ${batch}`:"Archiver l’offre"}</button>:group.id==="pay"?<button type="button" className="secondary-button" disabled={disabled} onClick={()=>void decide("keep",group)}>Garder en réserve</button>:role?<button type="button" className="secondary-button" disabled={disabled} onClick={()=>void decide("role",group,role)}>+ Viser {role}</button>:null}
        <button type="button" className="signal-quiet-button" disabled={disabled} onClick={()=>setConfirming({id:group.id,action:"discard"})}><Trash2 size={14} aria-hidden/>Écarter le groupe</button></div>}
    </li>;})}</ul>
  </section>;
}

function DailyLotBanner({lot,inLot,hasRescue=false,onToggle}:{lot:DailyLot;inLot:boolean;hasRescue?:boolean;onToggle:()=>void}){
  const left=lot.remaining.length,done=!left;
  const others=lot.waiting;
  const caption=done
    ?others?`${others} offre${others>1?"s":""} attend${others>1?"ent":""} en réserve, sans urgence.`:"Votre lot du jour est terminé."
    :lot.triaged?`${lot.triaged} triée${lot.triaged>1?"s":""} sur ${lot.size}`:"Le lot ne se remplit pas pendant le tri.";
  return <section className={"daily-lot"+(done?" is-done":"")} aria-label="Lot du jour">
    <div className="daily-lot-text">
      <p className="daily-lot-headline" aria-live="polite"><strong>{lotHeadline(lot)}</strong>{left&&lot.triaged?<span> dans votre lot du jour</span>:null}</p>
      <p className="daily-lot-caption">{caption}</p>
      <SignalProgress className="daily-lot-bar" value={lot.triaged} max={lot.size} label="Avancement du lot du jour" tone={done?"finished":"neutral"}/>
    </div>
    {inLot?(others||hasRescue?<button type="button" className="secondary-button daily-lot-switch" onClick={onToggle}>{done?"Voir la réserve, sans urgence":others?`Voir la réserve (${others})`:"Voir la réserve"}</button>:null)
      :<button type="button" className="secondary-button daily-lot-switch" onClick={onToggle}>Revenir au lot du jour</button>}
  </section>;
}

function OpportunityReadingNotes(){return <footer className="opportunity-reading-notes"><span><ShieldCheck size={13} aria-hidden/>Vos données restent privées.</span><span>Aucune candidature envoyée automatiquement.</span></footer>;}
