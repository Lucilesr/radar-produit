"use client";
import {useEffect,useRef,useState} from "react";
import {confirmActivity} from "@/lib/activity-client";
import {sessionWrite} from "@/lib/session-write";
import {confirmedProgress} from "@/lib/progress-event";
import {useRadarSession} from "@/components/use-radar-session";
import {refreshRadarClock} from "@/components/use-radar-clock";
import {sessionDay,sessionSnapshot,sessionFollowups,sessionProgress,pauseSession,type RadarSession,type SessionStep,type SessionProgress,type SessionSource} from "@/lib/radar-session";
import {careCount} from "@/lib/application-care";
import type {NextStep,NextStepAction} from "@/lib/next-steps";
import type {DailyLot} from "@/lib/daily-lot";
import type {JobRecord} from "@/lib/types";
import type {ExperienceItem} from "@/lib/experience-domain";
import type {Library} from "@/components/experience-library";

function measureDemoStep(owner:string){
  if(!owner.startsWith("demo:")||new URLSearchParams(window.location.search).get("mesure-seance")!=="1")return;
  const start=performance.now();
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    document.querySelector(".session-detail-advance, .radar-session-strip")?.setAttribute("data-demo-step-ms",String(Math.round(performance.now()-start)));
  }));
}

export function useSessionJourney({owner,jobs,sources,initialLibrary,now,onNavigate,onAction,getNextSteps,ready,onFollowupSaved}:{getNextSteps:(facts:ExperienceItem[],confirmed:readonly string[],complete:boolean)=>NextStep[];onAction:(action:NextStepAction)=>void;onFollowupSaved:(id:string,at:string,doneAt:string,followup?:import("@/lib/application-followup").ApplicationFollowup)=>void;owner:string;jobs:JobRecord[];lot:DailyLot|null;sources:SessionSource[];initialLibrary?:Library;now:number;ready:boolean;onNavigate:(step:SessionStep,target?:string)=>void}){
  const {session,save,checkpoint,getCurrent,hasCheckpoint,checkpointPending,checkpointFailed,retryCheckpoint,ready:continuityReady,busy:continuityBusy,error:continuityError,reload}=useRadarSession(owner,now);
  const [facts,setFacts]=useState<ExperienceItem[]>(initialLibrary?.items??[]),[factsError,setFactsError]=useState("");
  const [factsLoaded,setFactsLoaded]=useState(!!initialLibrary);
  const [error,setError]=useState("");
  const actionLock=useRef(false);
  const [finishing,setFinishing]=useState(false);
  const [finished,setFinished]=useState<SessionProgress|null>(null),[stoppedOn,setStoppedOn]=useState<string|null>(null);
  useEffect(()=>{const frame=requestAnimationFrame(()=>{try{setStoppedOn(window.sessionStorage.getItem("radar:session-ended:"+owner));}catch{/* Optional comfort only. */}});return()=>cancelAnimationFrame(frame);},[owner]);
  function resumeActions(){setStoppedOn(null);try{window.sessionStorage.removeItem("radar:session-ended:"+owner);}catch{/* The current view remains usable. */}}
  const [writing,setWriting]=useState(false),pending=useRef(new Set<string>());
  const waiters=useRef(new Set<()=>void>());
  function afterWrites(){
    if(!pending.current.size)return Promise.resolve();
    return new Promise<void>(resolve=>waiters.current.add(resolve));
  }
  const reads=useRef<Promise<ExperienceItem[]|null>|null>(null);
  function readFacts(){
    if(reads.current)return reads.current;
    const read=async()=>{try{const response=await fetch("/api/experiences",{cache:"no-store",signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error();const body=await response.json() as Library;if(!Array.isArray(body.items))throw new Error();const next=body.items;setFacts(next);setFactsError("");return next;}catch{setFactsError("Le carnet n’a pas pu être relu. Réessayez pour inclure ses blocs dans la séance.");return null;}finally{setFactsLoaded(true);reads.current=null;}};
    reads.current=read();return reads.current;
  }
  useEffect(()=>{void readFacts();const changed=(event:Event)=>{const items=(event as CustomEvent<{items?:ExperienceItem[]}>).detail?.items;if(items){setFacts(items);setFactsError("");}else void readFacts();};window.addEventListener("radar:experiences-changed",changed);return()=>window.removeEventListener("radar:experiences-changed",changed);},[owner]);
  useEffect(()=>{const changed=(event:Event)=>{const {key,busy}=(event as CustomEvent<{key:string;busy:boolean}>).detail;if(busy)pending.current.add(key);else pending.current.delete(key);setWriting(pending.current.size>0);if(!pending.current.size){waiters.current.forEach(resolve=>resolve());waiters.current.clear();}};window.addEventListener("radar:session-write",changed);return()=>window.removeEventListener("radar:session-write",changed);},[owner]);
  const careState=Object.fromEntries(jobs.filter(job=>careCount(job.applicationCare)>0).map(job=>[job.id,careCount(job.applicationCare)]));
  const sent=session?.sent??[];
  const due=sessionFollowups(jobs,now,sent),queue=getNextSteps(facts,sent,!factsError);
  const steps:SessionStep[]=queue.map(step=>step.kind),minutes=queue[0]?.minutes??0;
  const visits=sources.filter(source=>queue.some(step=>step.action.type==="source"&&step.action.source===source.source||step.action.type==="setting"&&step.action.setting.kind==="visit"&&step.action.setting.target===source.source));
  function available(step:SessionStep){return queue.some(item=>item.kind===step)||step==="validation"&&facts.some(fact=>fact.validation==="proposed");}
  function nextIndex(value:RadarSession,from:number){return value.steps.findIndex((step,index)=>index>=from&&available(step));}
  function open(value:RadarSession){const step=value.steps[value.current],next=queue.find(item=>item.kind===step);
    if(next){onAction(next.action);return;}
    onNavigate(step,step==="followups"?sessionFollowups(jobs,now,value.sent)[0]?.job.id:step==="sources"?visits[0]?.source:undefined);
  }
  function showCheckpoint(value:RadarSession){
    setError("");
    void checkpoint(value,afterWrites);
    open(value);
  }
  async function start(){
    if(!ready||!continuityReady||!factsLoaded||!now||actionLock.current)return;
    measureDemoStep(owner);
    const startedAt=refreshRadarClock();
    const previous=getCurrent();
    if(previous){const index=nextIndex(previous,previous.current);if(index<0){await finish();return;}const resumed={...previous,current:index,paused:false,resumedAt:previous.paused?startedAt:previous.resumedAt};showCheckpoint(resumed);return;}
    if(!steps.length)return;
    const value:RadarSession={id:crypto.randomUUID(),day:sessionDay(startedAt),startedAt,activeMs:0,resumedAt:startedAt,steps,current:0,initial:sessionSnapshot(jobs,sources,facts,careState),sent:[],paused:false};showCheckpoint(value);
  }
  async function finish(){if(!session||pending.current.size||actionLock.current||continuityBusy||hasCheckpoint())return;actionLock.current=true;setFinishing(true);const key=crypto.randomUUID();sessionWrite(key,true);setError("");const location=window.location.href;const result=sessionProgress(session,jobs,sources,facts,refreshRadarClock(),careState);
    try{if(!await save(null,true))throw new Error();const stopped=owner+":"+sessionDay(refreshRadarClock());setStoppedOn(stopped);try{window.sessionStorage.setItem("radar:session-ended:"+owner,stopped);}catch{/* Optional comfort only. */}if(window.location.href!==location)return;onNavigate("triage","home");if(result.total)setFinished(result);else requestAnimationFrame(()=>document.getElementById("workspace-title")?.focus());}
    catch{setError("La fin de séance n’est pas confirmée. Votre séance est conservée ; réessayez Terminer pour relire son résultat.");}
    finally{actionLock.current=false;setFinishing(false);sessionWrite(key,false);}
  }
  async function next(){
    const current=getCurrent();
    if(!current||finishing)return;
    measureDemoStep(owner);
    refreshRadarClock();
    const index=nextIndex(current,current.current+1);
    if(index<0){await finish();return;}
    const control=document.activeElement;
    showCheckpoint({...current,current:index});
    if(control?.hasAttribute("data-session-next"))requestAnimationFrame(()=>{
      if(control.isConnected||document.activeElement!==document.body&&document.activeElement?.id!=="workspace-title")return;
      const next=[...document.querySelectorAll<HTMLButtonElement>("[data-session-next]")].find(button=>button.getClientRects().length&&!button.disabled);
      next?.focus({preventScroll:true});
    });
  }
  async function pause(){
    const current=getCurrent();
    if(!current||pending.current.size||actionLock.current||continuityBusy||hasCheckpoint())return;
    setError("");
    if(await checkpoint(pauseSession(current,refreshRadarClock()),afterWrites,false)){
      onNavigate("triage","home");
      requestAnimationFrame(()=>document.getElementById("workspace-title")?.focus());
    }
  }
  async function confirmFollowup(id:string){const entry=due.find(entry=>entry.id===id);if(!session||!entry||session.sent.includes(id)||actionLock.current||pending.current.size||hasCheckpoint())return;actionLock.current=true;const key=crypto.randomUUID();sessionWrite(key,true);setError("");
    try{const saved=await confirmActivity({action:"followup_done",objectId:id,stamp:entry.at,...(entry.appliedFor?{appliedFor:entry.appliedFor}:{})});onFollowupSaved(id,entry.at,saved.doneAt??new Date().toISOString(),saved.followup);confirmedProgress({kind:"followup_done",objectId:id,stamp:entry.at});if(!await save({...session,sent:[...session.sent,id]}))setError("La relance est enregistrée. Relisez le point de reprise avant de poursuivre la séance.");}
    catch{setError("La relance n’est pas confirmée. Réessayez J’ai fait cette relance pour relire son résultat ; aucun message n’est envoyé par Radar.");}
    finally{actionLock.current=false;sessionWrite(key,false);requestAnimationFrame(()=>{if(document.activeElement===document.body)document.getElementById("session-followups-title")?.focus();});}
  }
  function closeFinish(){setFinished(null);requestAnimationFrame(()=>document.getElementById("workspace-title")?.focus());}
  const tomorrow=sessionFollowups(jobs,now+86400000,sent).filter(entry=>Date.parse(entry.at)>now).length;
  return {error:error||continuityError,reload:async()=>{setError("");await reload();},writing:writing||continuityBusy||checkpointPending||checkpointFailed,checkpointPending,checkpointFailed,retryCheckpoint,finishing,hasNext:!!session&&nextIndex(session,session.current+1)>=0,ready:ready&&continuityReady&&factsLoaded&&!!now,session,steps,queue,stopped:!session&&stoppedOn===owner+":"+sessionDay(now),resumeActions,minutes,due,visits,facts,factsError,retryFacts:readFacts,start,next,finish,pause,open:()=>{if(session){if(available(session.steps[session.current]))open(session);else void next();}},openStep:(step:NextStep)=>onAction(step.action),finished,closeFinish,confirmFollowup,tomorrow};
}
