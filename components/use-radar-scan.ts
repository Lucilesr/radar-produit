"use client";
import { useEffect, useRef, useState } from "react";
import { requestError } from "@/lib/request-error";
import { mergeScan, readScanSummary, summarizeScan, type ScanSummary, type SourceReading } from "@/lib/source-sync";
import { scanPlan, scanSources, type ScanSourceProgress } from "@/lib/scan-presentation";
import type { JobRecord } from "@/lib/types";
import {readScanSession,scanSessionKey} from "@/lib/scan-session";
import {lastRefreshAt} from "@/lib/refresh-schedule";
import type { SourceSetting } from "@/components/source-card";

export function useRadarScan({ owner, onOffers, onSources, knownJobs, sources, sourcesKnown, simulated=false }: {
  owner:string;onOffers: (jobs: JobRecord[]) => void; onSources: (sources: SourceSetting[]) => void;
  knownJobs: readonly JobRecord[]; sources: SourceSetting[]; sourcesKnown: boolean; simulated?:boolean;
}) {
  const [confirmedResult,setConfirmedResult]=useState<ScanSummary|null>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState(""),[quiet,setQuiet]=useState(false);
  const [result,setResult]=useState<ScanSummary|null>(null),[progress,setProgress]=useState<ScanSourceProgress[]>([]);
  const [previousAt,setPreviousAt]=useState<string|undefined>();
  const [newIds,setNewIds]=useState<string[]>([]);
  const saved=useRef<ScanSummary|null>(null),controller=useRef<AbortController|null>(null);
  const pending=useRef<Promise<boolean>|null>(null),baseline=useRef(new Set<string>()),known=useRef(knownJobs);
  useEffect(()=>{known.current=knownJobs;},[knownJobs]);
  useEffect(()=>()=>controller.current?.abort(),[]);
  useEffect(()=>{if(!owner)return;const frame=requestAnimationFrame(()=>{try{const previous=readScanSession(sessionStorage.getItem(scanSessionKey(owner)));if(previous&&!pending.current){saved.current=previous.result;baseline.current=new Set(known.current.map(job=>job.id).filter(id=>!previous.newIds.includes(id)));setResult(previous.result);setConfirmedResult(previous.result);setProgress(previous.result.sources.map(({source,state})=>({source,state})));setPreviousAt(previous.previousAt);setNewIds(previous.newIds);}}catch{/* Session storage is optional. */}});return()=>cancelAnimationFrame(frame);},[owner]);
  function run(source?:string,silent=false):Promise<boolean>{
    if(pending.current)return pending.current;
    const abort=new AbortController();controller.current=abort;
    const overall=AbortSignal.any([abort.signal,AbortSignal.timeout(simulated?180000:60000)]);
    setBusy(true);setError("");setQuiet(silent);
    if(!source){saved.current=null;baseline.current=new Set(knownJobs.map(job=>job.id));setResult(null);setNewIds([]);}
    else if(!saved.current)baseline.current=new Set(knownJobs.map(job=>job.id));
    const execute=async()=>{
      try{
        const read=async<T,>(path:string):Promise<T>=>{const response=await fetch(path,{cache:"no-store",signal:AbortSignal.any([overall,AbortSignal.timeout(15000)])});if(!response.ok)throw new Error();return response.json() as Promise<T>;};
        const settings=sourcesKnown?sources:(await read<{sources:SourceSetting[]}>("/api/sources")).sources;
        if(!Array.isArray(settings))throw new Error("Vos sources n’ont pas pu être relues. Réessayez.");
        if(!source)setPreviousAt(lastRefreshAt(settings));
        const plan=scanPlan(settings,simulated);
        setProgress(current=>source?plan.map(item=>item.source===source?{...item,state:"waiting"}:current.find(previous=>previous.source===item.source)??item):plan);
        const paused:SourceReading[]=source?[]:plan.filter(item=>item.state==="paused").map(item=>({source:item.source,state:"paused",ok:true,total:0,imported:0,deduplicated:0,matchedIds:[]}));
        if(!source){saved.current=summarizeScan(paused,new Date().toISOString());setResult(saved.current);}
        const names=source?[source]:plan.filter(item=>item.state!=="paused").map(item=>item.source);
        await scanSources(names,async name=>{
          const response=await fetch("/api/sources/sync",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({source:name,retry:!!source}),signal:AbortSignal.any([overall,AbortSignal.timeout(45000)])});
          const data:unknown=await response.json(),summary=readScanSummary(data);
          const reading=summary?.sources.find(item=>item.source===name);
          if(!reading)throw new Error("Réponse de balayage non reconnue.");
          return reading;
        },(name,state,reading)=>{
          if(abort.signal.aborted)return;
          setProgress(current=>current.map(item=>item.source===name?{source:name,state}:item));
          if(reading){saved.current=mergeScan(saved.current,summarizeScan([reading],new Date().toISOString()));setResult(saved.current);setNewIds([...new Set(saved.current.sources.flatMap(item=>item.matchedIds))].filter(id=>!baseline.current.has(id)));}
        },overall);
        const [jobs,reloadedSources]=await Promise.allSettled([read<{jobs:JobRecord[]}>("/api/jobs?includeDeleted=true"),read<{sources:SourceSetting[]}>("/api/sources")]);
        if(abort.signal.aborted)return false;
        if(jobs.status==="fulfilled"&&Array.isArray(jobs.value.jobs))onOffers(jobs.value.jobs);
        if(reloadedSources.status==="fulfilled"&&Array.isArray(reloadedSources.value.sources))onSources(reloadedSources.value.sources);
        if(jobs.status==="rejected"||reloadedSources.status==="rejected")throw new Error("Le bilan est conservé, mais l’affichage n’a pas pu être entièrement relu. Réessayez.");
        if(saved.current)setConfirmedResult(saved.current);
        if(saved.current&&owner){try{sessionStorage.setItem(scanSessionKey(owner),JSON.stringify({result:saved.current,previousAt:source?previousAt:lastRefreshAt(settings),newIds:[...new Set(saved.current.sources.flatMap(item=>item.matchedIds))].filter(id=>!baseline.current.has(id))}));}catch{/* The confirmed result remains in memory. */}}
        if(saved.current?.allFailed){setError("Le balayage n’a pas abouti. Vos offres restent conservées.");return false;}
        return true;
      }catch(problem){if(!abort.signal.aborted)setError(requestError(problem,"Le balayage n’a pas abouti. Vos offres restent conservées.").replace("Votre saisie est conservée.","Vos offres restent disponibles."));return false;}
      finally{if(!abort.signal.aborted)setBusy(false);pending.current=null;controller.current=null;}
    };
    pending.current=execute();return pending.current;
  }
  return {busy,error,result,confirmedResult,progress,newIds,quiet,previousAt,run};
}
