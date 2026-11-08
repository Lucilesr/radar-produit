"use client";
import { useEffect, useRef, useState } from "react";
import { requestError } from "@/lib/request-error";
import { mergeScan, readScanSummary, summarizeScan, type ScanSummary, type SourceReading } from "@/lib/source-sync";
import { scanPlan, scanSources, type ScanSourceProgress } from "@/lib/scan-presentation";
import type { JobRecord } from "@/lib/types";
import {lastRefreshAt} from "@/lib/refresh-schedule";
import type { SourceSetting } from "@/components/source-card";

export function useRadarScan({ onOffers, onSources, knownJobs, sources, sourcesKnown, simulated=false }: {
  onOffers: (jobs: JobRecord[]) => void; onSources: (sources: SourceSetting[]) => void;
  knownJobs: readonly JobRecord[]; sources: SourceSetting[]; sourcesKnown: boolean; simulated?:boolean;
}) {
  const [busy,setBusy]=useState(false),[error,setError]=useState(""),[quiet,setQuiet]=useState(false);
  const [result,setResult]=useState<ScanSummary|null>(null),[progress,setProgress]=useState<ScanSourceProgress[]>([]);
  const [previousAt,setPreviousAt]=useState<string|undefined>();
  const [newIds,setNewIds]=useState<string[]>([]);
  const saved=useRef<ScanSummary|null>(null),controller=useRef<AbortController|null>(null);
  const pending=useRef<Promise<boolean>|null>(null),baseline=useRef(new Set<string>());
  useEffect(()=>()=>controller.current?.abort(),[]);
  function run(source?:string,silent=false):Promise<boolean>{
    if(pending.current)return pending.current;
    const abort=new AbortController();controller.current=abort;
    const overall=AbortSignal.any([abort.signal,AbortSignal.timeout(60000)]);
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
        if(saved.current?.allFailed){setError("Le balayage n’a pas abouti. Vos offres restent conservées.");return false;}
        return true;
      }catch(problem){if(!abort.signal.aborted)setError(requestError(problem,"Le balayage n’a pas abouti. Vos offres restent conservées.").replace("Votre saisie est conservée.","Vos offres restent disponibles."));return false;}
      finally{if(!abort.signal.aborted)setBusy(false);pending.current=null;controller.current=null;}
    };
    pending.current=execute();return pending.current;
  }
  return {busy,error,result,progress,newIds,quiet,previousAt,run};
}
