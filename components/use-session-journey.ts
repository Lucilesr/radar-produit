"use client";
import {useEffect,useRef,useState} from "react";
import {confirmedProgress} from "@/lib/progress-event";
import {useRadarSession} from "@/components/use-radar-session";
import {refreshRadarClock} from "@/components/use-radar-clock";
import {sessionDay,sessionSnapshot,sessionSteps,sessionVisits,sessionFollowups,sessionEstimate,sessionProgress,pauseSession,type RadarSession,type SessionStep,type SessionProgress,type SessionSource} from "@/lib/radar-session";
import {sourceCatalog} from "@/lib/source-catalog";
import type {DailyLot} from "@/lib/daily-lot";
import type {JobRecord} from "@/lib/types";
import type {ExperienceItem} from "@/lib/experience-domain";
import type {Library} from "@/components/experience-library";

export function useSessionJourney({owner,jobs,lot,sources,initialLibrary,now,onNavigate,ready}:{owner:string;jobs:JobRecord[];lot:DailyLot|null;sources:SessionSource[];initialLibrary?:Library;now:number;ready:boolean;onNavigate:(step:SessionStep,target?:string)=>void}){
  const {session,save,getCurrent}=useRadarSession(owner,now);
  const [facts,setFacts]=useState<ExperienceItem[]>(initialLibrary?.items??[]),[factsError,setFactsError]=useState("");
  const [factsLoaded,setFactsLoaded]=useState(!!initialLibrary);
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
  function start(){
    if(!ready||!factsLoaded||!now)return;
    refreshRadarClock();
    const previous=getCurrent();
    if(previous){const resumed={...previous,paused:false,resumedAt:previous.paused?Date.now():previous.resumedAt};save(resumed);open(resumed);return;}
    if(!steps.length)return;
    const startedAt=Date.now();const value:RadarSession={id:crypto.randomUUID(),day:sessionDay(startedAt),startedAt,activeMs:0,resumedAt:startedAt,steps,current:0,initial:sessionSnapshot(jobs,sources,facts),sent:[],paused:false};save(value);open(value);
  }
  function finish(){if(!session||pending.current.size)return;const result=sessionProgress(session,jobs,sources,facts,Date.now());save(null);onNavigate("triage","home");if(result.total)setFinished(result);else requestAnimationFrame(()=>document.getElementById("workspace-title")?.focus());}
  function next(){if(!session||pending.current.size)return;refreshRadarClock();if(session.current===session.steps.length-1){finish();return;}const value={...session,current:session.current+1};save(value);open(value);}
  function pause(){if(!session||pending.current.size)return;save(pauseSession(session,Date.now()));onNavigate("triage","home");requestAnimationFrame(()=>document.getElementById("workspace-title")?.focus());}
  function confirmFollowup(id:string){const entry=due.find(entry=>entry.id===id);if(session&&entry&&!session.sent.includes(id)){save({...session,sent:[...session.sent,id]});confirmedProgress({kind:"followup_done",objectId:id,stamp:entry.at});}}
  function closeFinish(){setFinished(null);requestAnimationFrame(()=>document.getElementById("workspace-title")?.focus());}
  const tomorrow=sessionFollowups(jobs,now+86400000,sent).filter(entry=>Date.parse(entry.at)>now).length;
  return {writing,ready:ready&&factsLoaded&&!!now,session,steps,minutes,due,visits,facts,factsError,retryFacts:readFacts,start,next,finish,pause,open:()=>session&&open(session),finished,closeFinish,confirmFollowup,tomorrow};
}
