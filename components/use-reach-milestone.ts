"use client";
import {useEffect,useState} from "react";
import {useWorkspaceFeedback} from "@/components/workspace-feedback";
import {reachStages} from "@/lib/radar-reach";
const seen=new Map<string,number>();
function highest(key:string){let value=seen.get(key);try{const raw=window.localStorage.getItem(key);if(raw!==null&&/^[0-3]$/.test(raw))value=Math.max(value??0,Number(raw));}catch{/* Memory stays usable. */}return value;}
function remember(key:string,value:number){seen.set(key,value);try{window.localStorage.setItem(key,String(value));}catch{/* No account data depends on it. */}}
export function useReachMilestone(owner:string,stage:number,ready:boolean){
  const [reached,setReached]=useState<number|null>(null);
  const notify=useWorkspaceFeedback();
  useEffect(()=>{
    if(!ready){const frame=requestAnimationFrame(()=>setReached(null));return()=>cancelAnimationFrame(frame);}
    const key=`radar:portee-palier:${owner}`;
    const previous=highest(key);
    if(previous===undefined||stage<=previous){remember(key,Math.max(previous??stage,stage));const frame=requestAnimationFrame(()=>setReached(null));return()=>cancelAnimationFrame(frame);}
    let timer:number|undefined;
    const frame=requestAnimationFrame(()=>{const latest=highest(key);if(latest!==undefined&&stage<=latest){setReached(null);return;}remember(key,stage);setReached(stage);notify({message:`Palier atteint : ${reachStages[stage].label}`,tone:"milestone"});timer=window.setTimeout(()=>setReached(null),1800);});
    return()=>{cancelAnimationFrame(frame);if(timer!==undefined)window.clearTimeout(timer);};
  },[owner,stage,ready,notify]);
  return reached;
}
