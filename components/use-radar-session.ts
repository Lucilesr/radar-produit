"use client";
import {useCallback,useEffect,useSyncExternalStore} from "react";
import {readSession,pauseSession,type RadarSession} from "@/lib/radar-session";
const memory=new Map<string,string|null>(),listeners=new Set<()=>void>();
function subscribe(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};}
function read(key:string){if(memory.has(key))return memory.get(key)!;let raw:string|null=null;for(const storage of ["sessionStorage","localStorage"] as const)try{raw=window[storage].getItem(key);if(raw)break;}catch{/* Memory remains usable. */}try{const saved=JSON.parse(raw??"null");if(saved&&typeof saved==="object")raw=JSON.stringify({...saved,paused:true,resumedAt:null});}catch{/* The parser below rejects it. */}memory.set(key,raw);return raw;}
function write(key:string,value:RadarSession|null){const next=value?JSON.stringify(value):null;memory.set(key,next);for(const storage of ["sessionStorage","localStorage"] as const)try{if(next)window[storage].setItem(key,next);else window[storage].removeItem(key);}catch{/* Optional recovery only. */}listeners.forEach(listener=>listener());}
export function useRadarSession(owner:string,now:number){
  const key=`radar:seance:${owner}`,snapshot=useCallback(()=>read(key),[key]);
  const raw=useSyncExternalStore(subscribe,snapshot,()=>null);
  const session=readSession(raw,now);
  useEffect(()=>{const hide=()=>{const value=readSession(read(key),Date.now());if(value&&!value.paused)write(key,pauseSession(value,Date.now()));};window.addEventListener("pagehide",hide);return()=>window.removeEventListener("pagehide",hide);},[key]);
  function save(value:RadarSession|null){write(key,value);}
  return {session,save,getCurrent:()=>readSession(read(key),Date.now())};
}
