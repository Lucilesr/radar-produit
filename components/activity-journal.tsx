"use client";
import {useCallback,useEffect,useLayoutEffect,useRef,useState} from "react";
import {ChevronRight} from "lucide-react";
import type {ActivityEvent} from "@/lib/activity";
import {activityDayKey,activityDayLabel,activityFilters,isCurrentActivityWeek,groupActivityDays,journalActionLabel,journalTime,mergeActivity,type ActivityFilter} from "@/lib/activity-presentation";
import {WorkspaceButton,WorkspaceFormError} from "@/components/workspace-form";
import {HelpTooltip} from "@/components/help-tooltip";
import {useDisplayTimeZone} from "@/components/use-display-time-zone";
import {useRadarClock} from "@/components/use-radar-clock";
type Page={items:ActivityEvent[];cursor:string|null;continuedDay:string|null;weekCount:number|null;weekStart:string|null;timeZone:string;filter:ActivityFilter};
type Read={filter:ActivityFilter;append?:boolean;cursor?:string|null};
type FocusIntent={kind:"filter"|"append"|"error";filter:ActivityFilter;first?:ActivityEvent;timeZone?:string};
export function ActivityJournal(){
 const [page,setPage]=useState<Page>({items:[],cursor:null,continuedDay:null,weekCount:null,weekStart:null,timeZone:"UTC",filter:"all"}),[loading,setLoading]=useState(true),[error,setError]=useState(""),[dirty,setDirty]=useState(false);
 const detail=useRef<HTMLDetailsElement>(null),alive=useRef(true),lock=useRef(false),generation=useRef(0),revision=useRef(0),pageRef=useRef(page),lastRead=useRef<Read>({filter:"all"}),controller=useRef<AbortController|null>(null);
 const focusIntent=useRef<FocusIntent|null>(null);
 const displayZone=useDisplayTimeZone(),zone=useRef(displayZone),clock=useRadarClock();
 useEffect(()=>{zone.current=displayZone;},[displayZone]);
 const load=useCallback(async(request:Read={filter:pageRef.current.filter},focus=false)=>{
  if(lock.current)return;lock.current=true;lastRead.current=request;const current=++generation.current,atRevision=revision.current,previous=pageRef.current;
  setLoading(true);setError("");const abort=new AbortController();controller.current=abort;
  try{const params=new URLSearchParams({filter:request.filter,zone:zone.current});if(request.cursor)params.set("cursor",request.cursor);
   const response=await fetch("/api/activity?"+params,{cache:"no-store",signal:AbortSignal.any([abort.signal,AbortSignal.timeout(15000)])}),result=await response.json() as Page;
   if(!response.ok||!Array.isArray(result.items)||typeof result.weekCount!=="number"||!Number.isSafeInteger(result.weekCount)||result.weekCount<0||typeof result.timeZone!=="string"||typeof result.weekStart!=="string"||activityDayKey(result.weekStart,result.timeZone)==="unknown"||result.filter!==request.filter)throw new Error();
   if(!alive.current||current!==generation.current)return;
   const next={...result,items:request.append?mergeActivity(previous.items,result.items):result.items};if(focus){const known=new Set(previous.items.map(item=>item.id));focusIntent.current={kind:request.append?"append":"filter",filter:request.filter,first:result.items.find(item=>!known.has(item.id)),timeZone:result.timeZone};}pageRef.current=next;setPage(next);if(!request.append&&atRevision===revision.current)setDirty(false);

  }catch{if(alive.current&&current===generation.current){if(focus)focusIntent.current={kind:"error",filter:request.filter};setError("Lecture non confirmée. Les dernières actions chargées sont conservées.");}}
  finally{if(current===generation.current){lock.current=false;if(alive.current)setLoading(false);}}
 },[]);
 useLayoutEffect(()=>{
  if(loading||!focusIntent.current)return;const intent=focusIntent.current;
  const frame=requestAnimationFrame(()=>{
   if(focusIntent.current!==intent)return;focusIntent.current=null;
   if(document.activeElement!==document.body&&document.activeElement?.isConnected)return;
   let target:HTMLElement|null=null;
   if(detail.current?.open){
    if(intent.kind==="error")target=document.getElementById("activity-retry");
    else if(intent.kind==="filter")target=document.getElementById("activity-filter-"+intent.filter);
    else if(intent.first){const day=document.getElementById("activity-day-"+activityDayKey(intent.first.createdAt,intent.timeZone??page.timeZone)) as HTMLDetailsElement|null,summary=day?.querySelector<HTMLElement>("summary")??null;target=day?.open?document.getElementById("activity-event-"+intent.first.id)??summary:summary;}
   }
   (target??document.getElementById("activity-summary"))?.focus();
  });
  return()=>cancelAnimationFrame(frame);
 },[page,error,loading]);
 useEffect(()=>{alive.current=true;const frame=requestAnimationFrame(()=>void load());const refresh=()=>{revision.current++;if(!detail.current?.open&&!lock.current)void load({filter:pageRef.current.filter});else setDirty(true);};window.addEventListener("radar:activity-changed",refresh);return()=>{alive.current=false;generation.current++;lock.current=false;controller.current?.abort();cancelAnimationFrame(frame);window.removeEventListener("radar:activity-changed",refresh);};},[load]);
 const groups=groupActivityDays(page.items,page.timeZone),now=new Date(clock),count=page.weekCount,currentWeek=isCurrentActivityWeek(page.weekStart,now,page.timeZone);
 return <details ref={detail} id="activity-journal" className="activity-journal" aria-busy={loading}>
  <summary id="activity-summary"><h2><ChevronRight size={18} aria-hidden/><span>Journal d’activité</span><span className="activity-week-count">{count===null?(error?"À relire":"Lecture…"):`${count.toLocaleString("fr-FR")} action${count===1?"":"s"} ${currentWeek?"cette semaine":"dans la dernière semaine relue"}`}{dirty||count!==null&&!currentWeek?" · à actualiser":""}</span></h2></summary>
  <div className="activity-body"><div className="activity-toolbar"><div className="workspace-tabs activity-filters" role="group" aria-label="Filtrer le journal">{activityFilters.map(filter=><button key={filter.id} id={"activity-filter-"+filter.id} type="button" aria-pressed={page.filter===filter.id} disabled={loading} onClick={()=>{if(page.filter!==filter.id)void load({filter:filter.id},true);}}>{filter.label}</button>)}</div><div className="activity-tools"><HelpTooltip label="Journal d’activité">Vos actions confirmées, jour par jour, depuis l’activation du journal.</HelpTooltip><WorkspaceButton variant="quiet" disabled={loading} onClick={()=>void load({filter:page.filter},true)}>Actualiser le journal</WorkspaceButton></div></div>
  <p className="activity-read-count" role="status">{loading?"Lecture du journal…":`${page.items.length} action${page.items.length===1?"":"s"} chargé${page.items.length===1?"e":"es"} · ${page.timeZone}`}</p>
  <WorkspaceFormError message={error}/>{error?<WorkspaceButton id="activity-retry" disabled={loading} onClick={()=>void load(lastRead.current,true)}>Réessayer la lecture</WorkspaceButton>:null}
  {!loading&&!error&&!page.items.length?<p className="signal-help">{page.filter==="all"?"Votre journal commence ici.":"Aucune action dans ce filtre."}</p>:null}
  {groups.map(group=><details key={group.day} id={"activity-day-"+group.day} className="activity-day"><summary><ChevronRight size={16} aria-hidden/><span><strong>{activityDayLabel(group.day,now,page.timeZone)}</strong><span> · {group.summary}{page.cursor&&page.continuedDay===group.day?" · suite à charger":""}</span></span></summary><ol className="activity-day-entries" aria-label={"Actions du "+activityDayLabel(group.day,now,page.timeZone)}>{group.items.map(event=><li id={"activity-event-"+event.id} key={event.id} tabIndex={-1}><time dateTime={event.createdAt}>{journalTime(event.createdAt,page.timeZone)}</time><span><strong>{journalActionLabel(event)}</strong>{event.label?<> · {event.label}{event.company?", "+event.company:""}</>:null}</span></li>)}</ol></details>)}
  {page.cursor?<WorkspaceButton className="activity-more" disabled={loading} onClick={()=>void load({filter:page.filter,append:true,cursor:page.cursor},true)}>{loading?"Lecture…":"Afficher 20 de plus"}</WorkspaceButton>:null}
 </div></details>;
}
