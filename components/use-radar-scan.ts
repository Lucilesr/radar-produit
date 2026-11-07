"use client";
import { useEffect, useRef, useState } from "react";
import { requestError } from "@/lib/request-error";
import { mergeScan, readScanSummary, type AutomaticSource, type ScanSummary } from "@/lib/source-sync";
import type { JobRecord } from "@/lib/types";
import type { SourceSetting } from "@/components/source-card";

export function useRadarScan({ onOffers, onSources }: { onOffers: (jobs: JobRecord[]) => void; onSources: (sources: SourceSetting[]) => void }) {
  const [busy,setBusy]=useState(false),[error,setError]=useState("");
  const [result,setResult]=useState<ScanSummary|null>(null);
  const saved=useRef<ScanSummary|null>(null),controller=useRef<AbortController|null>(null);
  const pending=useRef<Promise<boolean>|null>(null);
  useEffect(()=>()=>controller.current?.abort(),[]);
  function run(source?:AutomaticSource):Promise<boolean>{
    if(pending.current)return pending.current;
    const abort=new AbortController();controller.current=abort;
    const overall=AbortSignal.any([abort.signal,AbortSignal.timeout(60000)]);
    setBusy(true);setError("");
    const execute=async()=>{
      try{
        const response=await fetch("/api/sources/sync",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(source?{source}:{}),signal:AbortSignal.any([overall,AbortSignal.timeout(45000)])});
        const data:unknown=await response.json();
        const serverError=data&&typeof data==="object"&&"error" in data&&typeof data.error==="string"?data.error:undefined;
        const summary=readScanSummary(data);
        if(!summary)throw new Error(serverError??"Réponse de balayage non reconnue. Réessayez ; vos offres restent conservées.");
        saved.current=source?mergeScan(saved.current,summary):summary;
        setResult(saved.current);
        const read=async<T,>(path:string):Promise<T>=>{const response=await fetch(path,{cache:"no-store",signal:AbortSignal.any([overall,AbortSignal.timeout(15000)])});if(!response.ok)throw new Error();return response.json() as Promise<T>;};
        const [jobs,sources]=await Promise.allSettled([read<{jobs:JobRecord[]}>("/api/jobs?includeDeleted=true"),read<{sources:SourceSetting[]}>("/api/sources")]);
        if(jobs.status==="fulfilled"&&Array.isArray(jobs.value.jobs))onOffers(jobs.value.jobs);
        if(sources.status==="fulfilled"&&Array.isArray(sources.value.sources))onSources(sources.value.sources);
        if(jobs.status==="rejected"||sources.status==="rejected")throw new Error("Le balayage a répondu, mais l’affichage n’a pas pu être entièrement relu. Vos dernières données restent disponibles ; réessayez.");
        if(!response.ok||saved.current.allFailed){setError(serverError??"Aucune source n’a pu être actualisée. Vos offres existantes sont conservées.");return false;}
        return true;
      }catch(problem){setError(problem instanceof SyntaxError?"Réponse de balayage non reconnue. Réessayez ; vos offres restent conservées.":requestError(problem,"Actualisation non confirmée. Réessayez ; vos offres restent conservées.").replace("Votre saisie est conservée.","Vos offres restent disponibles."));return false;}
      finally{setBusy(false);pending.current=null;controller.current=null;}
    };
    pending.current=execute();return pending.current;
  }
  return {busy,error,result,run};
}
