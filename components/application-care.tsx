"use client";
import {useCallback,useEffect,useId,useRef,useState} from "react";
import {useRadarNextSteps} from "@/components/next-steps-context";
import {Checkbox} from "@/components/ui/checkbox";
import {WorkspaceButton,WorkspaceFormError,WorkspaceFormSection} from "@/components/workspace-form";
import {SignalProgress} from "@/components/signal/signal-progress";
import {careChecks,careCount,careSummary,emptyCare,type ApplicationCare as Care,type CareField} from "@/lib/application-care";
import {sessionWrite} from "@/lib/session-write";
import type {JobRecord} from "@/lib/types";
export function ApplicationCareBadge({job}:{job:Pick<JobRecord,'applicationCare'>}){const count=careCount(job.applicationCare);return <span className={`application-care-badge${count>=3?" is-careful":""}`}>{careSummary(job.applicationCare)}</span>;}
export function ApplicationCarePreview({job}:{job:JobRecord}){const count=careCount(job.applicationCare);return <div className="application-card-care"><div aria-hidden>{careChecks.map((item,index)=><span key={item.id} data-done={index<count||undefined}/>)}</div><ApplicationCareBadge job={job}/></div>;}
export function ApplicationCare({job}:{job:JobRecord}){
 const {queue,activeKind}=useRadarNextSteps(),suggested=queue.find(step=>step.kind==="care"&&step.action.type==="care"&&step.action.jobId===job.id);
 const currentStep=!!suggested&&(queue[0]?.id===suggested.id||activeKind==="care");
 const [care,setCare]=useState<Care>(job.applicationCare??emptyCare()),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const current=useRef(care),lock=useRef(false),live=useRef(true),generation=useRef(0),prefix=useId(),retry=useRef<HTMLButtonElement>(null);
 const accept=useCallback((next:Care)=>{if(next.version<current.current.version)return;current.current=next;setCare(next);window.dispatchEvent(new CustomEvent("radar:application-care",{detail:{id:job.id,care:next}}));},[job.id]);
 const load=useCallback(async(focus=false)=>{const request=++generation.current;setError("");setReady(false);try{const r=await fetch(`/api/application-care/${job.id}`,{cache:"no-store",signal:AbortSignal.timeout(15000)});const result=await r.json() as {care:Care};if(!r.ok||!Number.isInteger(result.care?.version))throw new Error();if(live.current&&request===generation.current){accept(result.care);setReady(true);if(focus)requestAnimationFrame(()=>document.getElementById(`${prefix}-${careChecks.find(item=>!result.care[item.id])?.id??"cv"}`)?.focus());}}catch{if(live.current&&request===generation.current){setError("Les repères de cette candidature ne peuvent pas être relus. Les derniers choix confirmés restent affichés.");if(focus)requestAnimationFrame(()=>retry.current?.focus());}}},[job.id,accept,prefix]);
 useEffect(()=>{live.current=true;const frame=requestAnimationFrame(()=>void load());const focus=()=>{if(!lock.current)void load();};window.addEventListener("focus",focus);return()=>{live.current=false;generation.current++;cancelAnimationFrame(frame);window.removeEventListener("focus",focus);};},[load]);
 async function save(field:CareField,checked:boolean){if(lock.current||!ready)return;lock.current=true;setBusy(true);setError("");const trigger=document.getElementById(`${prefix}-${field}`);let failed=false;const key=crypto.randomUUID();sessionWrite(key,true);generation.current++;
  try{const r=await fetch(`/api/application-care/${job.id}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({field,checked,version:current.current.version}),signal:AbortSignal.timeout(15000)});const result=await r.json() as {care?:Care;error?:string};if(!r.ok){if(result.care)accept(result.care);throw new Error(result.error);}if(!result.care)throw new Error();accept(result.care);setReady(true);window.dispatchEvent(new Event("radar:activity-changed"));}
  catch(problem){failed=true;setReady(false);setError(problem instanceof Error&&problem.message&&!['TypeError','AbortError','TimeoutError'].includes(problem.name)?problem.message:"Choix non confirmé. Relisez les repères avant de réessayer.");}
  finally{sessionWrite(key,false);lock.current=false;setBusy(false);requestAnimationFrame(()=>{if(document.activeElement===document.body){if(failed)retry.current?.focus();else if(trigger?.isConnected)trigger.focus();}});}
 }
 useEffect(()=>{
  if(!ready||!currentStep)return;
  const frame=requestAnimationFrame(()=>{
   if(document.activeElement!==document.body&&document.activeElement?.getAttribute("role")!=="dialog"&&!["H1","H2","H3"].includes(document.activeElement?.tagName??""))return;
   const field=careChecks.find(item=>!care[item.id]);if(field)document.getElementById(prefix+"-"+field.id)?.focus();
  });
  return()=>cancelAnimationFrame(frame);
 },[ready,currentStep,care,prefix]);
 const count=careCount(care);
 return <div className="application-care" aria-busy={busy||!ready&&!error}><WorkspaceFormSection title="Check-list d’envoi" description="Facultatif." descriptionInline><p className="application-care-summary" role="status">{careSummary(care,false)}</p><SignalProgress value={count} max={4} label="Check-list d’envoi"/>
 <fieldset disabled={!ready||busy}><legend className="sr-only">Points de la check-list d’envoi</legend>{careChecks.map(item=><label key={item.id} htmlFor={`${prefix}-${item.id}`} className="application-care-check"><Checkbox id={`${prefix}-${item.id}`} className="radar-preference-toggle" checked={care[item.id]} onCheckedChange={checked=>void save(item.id,checked===true)}/><span><strong>{item.label}</strong><small>{item.detail}</small></span></label>)}</fieldset>
 <p className="signal-help" role="status">{busy?"Enregistrement du choix…":!ready&&!error?"Lecture de la check-list…":""}</p><WorkspaceFormError message={error}/>{error?<WorkspaceButton ref={retry} disabled={busy} onClick={()=>void load(true)}>Relire la check-list</WorkspaceButton>:null}</WorkspaceFormSection></div>;
}
