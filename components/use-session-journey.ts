"use client";
import {useEffect,useRef,useState} from "react";
import {confirmActivity} from "@/lib/activity-client";
import {sessionWrite} from "@/lib/session-write";
import {confirmedProgress} from "@/lib/progress-event";
import {useRadarSession} from "@/components/use-radar-session";
import {refreshRadarClock} from "@/components/use-radar-clock";
import {sessionDay,sessionSnapshot,sessionSteps,sessionVisits,sessionFollowups,sessionEstimate,sessionProgress,pauseSession,type RadarSession,type SessionStep,type SessionProgress,type SessionSource} from "@/lib/radar-session";
import {sourceCatalog} from "@/lib/source-catalog";
import type {DailyLot} from "@/lib/daily-lot";
import type {JobRecord} from "@/lib/types";
import type {ExperienceItem} from "@/lib/experience-domain";
import type {Library} from "@/components/experience-library";

export function useSessionJourney({owner,jobs,lot,sources,initialLibrary,now,onNavigate,ready,onFollowupSaved}:{onFollowupSaved:(id:string,at:string,doneAt:string)=>void;owner:string;jobs:JobRecord[];lot:DailyLot|null;sources:SessionSource[];initialLibrary?:Library;now:number;ready:boolean;onNavigate:(step:SessionStep,target?:string)=>void}){
  const {session,save,getCurrent,ready:continuityReady,busy:continuityBusy,error:continuityError,reload}=useRadarSession(owner,now);
  const [facts,setFacts]=useState<ExperienceItem[]>(initialLibrary?.items??[]),[factsError,setFactsError]=useState("");
  const [factsLoaded,setFactsLoaded]=useState(!!initialLibrary);
  const [error,setError]=useState("");
  const actionLock=useRef(false);
  const [finished,setFinished]=useState<SessionProgress|null>(null);
  const [writing,setWriting]=useState(false),pending=useRef(new Set<string>());
  const reads=useRef<Promise<ExperienceItem[]|null>|null>(null);
  function readFacts(){
    if(reads.current)return reads.current;
    const read=async()=>{try{const response=await fetch("/api/experiences",{cache:"no-store",signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error();const body=await response.json() as Library;if(!Array.isArray(body.items))throw new Error();const next=body.items;setFacts(next);setFactsError("");return next;}catch{setFactsError("Le carnet n’a pas pu être relu. Réessayez pour inclure ses blocs dans la séance.");return null;}finally{setFactsLoaded(true);reads.current=null;}};
    reads.current=read();return reads.current;
  }
  useEffect(()=>{void readFacts();const changed=(event:Event)=>{const items=(event as CustomEvent<{items?:ExperienceItem[]}>).detail?.items;if(items){setFacts(items);setFactsError("");}else void readFacts();};window.addEventListener("radar:experiences-changed",changed);return()=>window.removeEventListener("radar:experiences-changed",changed);},[owner]);
  useEffect(()=>{const changed=(event:Event)=>{const {key,busy}=(event as CustomEvent<{key:string;busy:boolean}>).detail;if(busy)pending.current.add(key);else pending.current.delete(key);setWriting(pending.current.size>0);};window.addEventListener("radar:session-write",changed);return()=>window.removeEventListener("radar:session-write",changed);},[owner]);
  const sent=session?.sent??[];
  const due=sessionFollowups(jobs,now,sent),visits=sessionVisits(sources,name=>sourceCatalog.find(source=>source.name===name)?.mode,now);
  const steps=sessionSteps(lot?.remaining.length??0,due.length,visits.length,facts);
  const minutes=sessionEstimate(lot?.remaining.length??0,due.length,visits.length);
  function open(value:RadarSession){const step=value.steps[value.current];onNavigate(step,step==="followups"?sessionFollowups(jobs,now,value.sent)[0]?.job.id:step==="sources"?visits[0]?.source:undefined);}
  async function checkpoint(value:RadarSession,after:()=>void){
    if(actionLock.current||pending.current.size||continuityBusy)return;
    actionLock.current=true;const key=crypto.randomUUID();sessionWrite(key,true);setError("");
    try{if(!await save(value))throw new Error();after();}
    catch{setError("Le point de reprise n’est pas confirmé. Relisez la séance avant de continuer.");}
    finally{actionLock.current=false;sessionWrite(key,false);}
  }
  async function start(){
    if(!ready||!continuityReady||!factsLoaded||!now)return;
    refreshRadarClock();
    const previous=getCurrent();
    if(previous){const resumed={...previous,paused:false,resumedAt:previous.paused?Date.now():previous.resumedAt};await checkpoint(resumed,()=>open(resumed));return;}
    if(!steps.length)return;
    const startedAt=Date.now();const value:RadarSession={id:crypto.randomUUID(),day:sessionDay(startedAt),startedAt,activeMs:0,resumedAt:startedAt,steps,current:0,initial:sessionSnapshot(jobs,sources,facts),sent:[],paused:false};await checkpoint(value,()=>open(value));
  }
  async function finish(){if(!session||pending.current.size||actionLock.current||continuityBusy)return;actionLock.current=true;const key=crypto.randomUUID();sessionWrite(key,true);setError("");const location=window.location.href;const result=sessionProgress(session,jobs,sources,facts,Date.now());
    try{if(!await save(null,true))throw new Error();if(window.location.href!==location)return;onNavigate("triage","home");if(result.total)setFinished(result);else requestAnimationFrame(()=>document.getElementById("workspace-title")?.focus());}
    catch{setError("La fin de séance n’est pas confirmée. Votre séance est conservée ; réessayez Terminer pour relire son résultat.");}
    finally{actionLock.current=false;sessionWrite(key,false);}
  }
  async function next(){if(!session||pending.current.size)return;refreshRadarClock();if(session.current===session.steps.length-1){await finish();return;}const value={...session,current:session.current+1};await checkpoint(value,()=>open(value));}
  async function pause(){if(!session||pending.current.size)return;await checkpoint(pauseSession(session,Date.now()),()=>{onNavigate("triage","home");requestAnimationFrame(()=>document.getElementById("workspace-title")?.focus());});}
  async function confirmFollowup(id:string){const entry=due.find(entry=>entry.id===id);if(!session||!entry||session.sent.includes(id)||actionLock.current||pending.current.size)return;actionLock.current=true;const key=crypto.randomUUID();sessionWrite(key,true);setError("");
    try{const saved=await confirmActivity({action:"followup_done",objectId:id,stamp:entry.at});onFollowupSaved(id,entry.at,saved.doneAt??new Date().toISOString());confirmedProgress({kind:"followup_done",objectId:id,stamp:entry.at});if(!await save({...session,sent:[...session.sent,id]}))setError("La relance est enregistrée. Relisez le point de reprise avant de poursuivre la séance.");}
    catch{setError("La relance n’est pas confirmée. Réessayez J’ai fait cette relance pour relire son résultat ; aucun message n’est envoyé par Radar.");}
    finally{actionLock.current=false;sessionWrite(key,false);}
  }
  function closeFinish(){setFinished(null);requestAnimationFrame(()=>document.getElementById("workspace-title")?.focus());}
  const tomorrow=sessionFollowups(jobs,now+86400000,sent).filter(entry=>Date.parse(entry.at)>now).length;
  return {error:error||continuityError,reload:async()=>{setError("");await reload();},writing:writing||continuityBusy,ready:ready&&continuityReady&&!continuityBusy&&factsLoaded&&!!now,session,steps,minutes,due,visits,facts,factsError,retryFacts:readFacts,start,next,finish,pause,open:()=>session&&open(session),finished,closeFinish,confirmFollowup,tomorrow};
}
