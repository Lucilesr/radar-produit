"use client";
import {useEffect,useState} from "react";
const seen=new Map<string,number>();
export function useReachMilestone(owner:string,stage:number,ready:boolean){
  const [reached,setReached]=useState<number|null>(null);
  useEffect(()=>{
    if(!ready){const frame=requestAnimationFrame(()=>setReached(null));return()=>cancelAnimationFrame(frame);}
    const key=`radar:portee-palier:${owner}`;
    let previous=seen.get(key);
    if(previous===undefined)try{const raw=window.localStorage.getItem(key);if(raw!==null&&/^[0-3]$/.test(raw))previous=Number(raw);}catch{/* Keep comfort in memory. */}
    seen.set(key,Math.max(previous??stage,stage));
    try{window.localStorage.setItem(key,String(seen.get(key)));}catch{/* No account data depends on it. */}
    if(previous===undefined||stage<=previous){const frame=requestAnimationFrame(()=>setReached(null));return()=>cancelAnimationFrame(frame);}
    const frame=requestAnimationFrame(()=>setReached(stage));
    const timer=window.setTimeout(()=>setReached(null),1800);
    return()=>{cancelAnimationFrame(frame);window.clearTimeout(timer);};
  },[owner,stage,ready]);
  return reached;
}
