"use client";
import {useEffect,useRef} from "react";
import {useWorkspaceFeedback} from "@/components/workspace-feedback";
import {celebrationPhrases,progressEvent,type RadarPreferences} from "@/lib/celebrations";
export function ProgressCelebrations({preferences}:{preferences?:RadarPreferences}){
 const notify=useWorkspaceFeedback(),current=useRef(preferences);
 useEffect(()=>{current.current=preferences;if(preferences?.reducedMotion||preferences?.celebrations===false)window.dispatchEvent(new Event("radar:celebrations-cancel"));},[preferences]);
 useEffect(()=>{
  let alive=true,generation=0;const handled=new Set<string>();const cancel=()=>{generation++;};
  const enabled=()=>!current.current?.reducedMotion&&current.current?.celebrations!==false&&!window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const celebrate=async(raw:Event)=>{
   const event=progressEvent((raw as CustomEvent).detail);if(!event||!enabled())return;
   const id=JSON.stringify(event);if(handled.has(id))return;handled.add(id);if(handled.size>500)handled.delete(handled.values().next().value!);const requestedGeneration=generation;
   try{const response=await fetch("/api/celebrations",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(event),signal:AbortSignal.timeout(15000)});if(!response.ok)return;const data=await response.json() as {accepted?:boolean;phrase?:number};if(!alive||generation!==requestedGeneration||!data.accepted||!enabled())return;notify({message:celebrationPhrases[data.phrase??0]??celebrationPhrases[0],tone:"celebration"});}catch{/* An optional encouragement never changes the confirmed action. */}
  };
  window.addEventListener("radar:progress-confirmed",celebrate);window.addEventListener("radar:celebrations-cancel",cancel);return()=>{alive=false;window.removeEventListener("radar:progress-confirmed",celebrate);window.removeEventListener("radar:celebrations-cancel",cancel);};
 },[notify]);
 return null;
}
