"use client";
import {useCallback,useEffect,useRef,useSyncExternalStore} from "react";
import {useRadarContinuity,continuityView,saveAccountSession,pauseAccountOnExit} from "@/components/use-radar-continuity";
import {readSession,pauseSession,type RadarSession} from "@/lib/radar-session";
const memory=new Map<string,string|null>(),listeners=new Set<()=>void>();
function subscribe(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};}
function read(key:string){if(memory.has(key))return memory.get(key)!;let raw:string|null=null;for(const storage of ["sessionStorage","localStorage"] as const)try{raw=window[storage].getItem(key);if(raw)break;}catch{/* Memory remains usable. */}try{const saved=JSON.parse(raw??"null");if(saved&&typeof saved==="object")raw=JSON.stringify({...saved,paused:true,resumedAt:null});}catch{/* The parser below rejects it. */}memory.set(key,raw);return raw;}
function write(key:string,value:RadarSession|null){const next=value?JSON.stringify(value):null;memory.set(key,next);for(const storage of ["sessionStorage","localStorage"] as const)try{if(next)window[storage].setItem(key,next);else window[storage].removeItem(key);}catch{/* Optional recovery only. */}listeners.forEach(listener=>listener());}
export function useRadarSession(owner:string,now:number){
 const key=`radar:seance:${owner}`,remote=useRadarContinuity(owner),migrating=useRef(false),snapshot=useCallback(()=>read(key),[key]);
 const raw=useSyncExternalStore(subscribe,snapshot,()=>null);
 const canonical=remote.state?.session??null,parsed=readSession(canonical?JSON.stringify(canonical):null,now);
 const active=!!parsed&&!parsed.paused&&remote.activeVersion===remote.state?.sessionVersion;
 const session=parsed&&!active?{...parsed,paused:true,resumedAt:null}:parsed;
 useEffect(()=>{
  if(!owner||!now||!remote.ready||remote.reading||remote.busy||remote.error||remote.state?.sessionVersion!==0||canonical||migrating.current)return;
  const previous=readSession(raw,now);if(!previous)return;
  const frame=requestAnimationFrame(()=>{migrating.current=true;void saveAccountSession(owner,{...previous,paused:true,resumedAt:null},0).finally(()=>{migrating.current=false;});});return()=>cancelAnimationFrame(frame);
 },[owner,now,remote.ready,remote.reading,remote.busy,remote.error,remote.state?.sessionVersion,canonical,raw]);
 useEffect(()=>{if(remote.ready&&(canonical||remote.state!.sessionVersion>0)){const next=canonical?JSON.stringify(canonical):null;if(raw!==next)write(key,canonical);}},[remote.ready,remote.state,canonical,raw,key]);
 useEffect(()=>{const hide=()=>{const view=continuityView(owner),value=readSession(view.state?.session?JSON.stringify(view.state.session):null,Date.now());if(value&&!value.paused&&view.activeVersion===view.state?.sessionVersion){const paused=pauseSession(value,Date.now());write(key,paused);if(!view.busy)pauseAccountOnExit(owner,paused,view.state!.sessionVersion);}};window.addEventListener("pagehide",hide);return()=>window.removeEventListener("pagehide",hide);},[key,owner]);
 async function save(value:RadarSession|null,finish=false){if(!remote.state)return false;const saved=await saveAccountSession(owner,value,remote.state.sessionVersion,finish?session?.id:undefined);if(!saved)return false;write(key,saved.session);return true;}
 return {session,save,getCurrent:()=>session,ready:remote.ready&&!remote.reading&&!remote.error,busy:remote.busy>0,error:remote.error,reload:remote.reload};
}
