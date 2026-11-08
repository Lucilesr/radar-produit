"use client";
import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import type {JobRecord} from "@/lib/types";
import type {ApplicationFunnel} from "@/lib/application-funnel";
export function useApplicationFunnel(owner:string,active:boolean,jobs:JobRecord[]){
 const [state,setState]=useState<{owner:string;value:ApplicationFunnel|null;error:string;loading:boolean}>({owner,value:null,error:"",loading:true}),generation=useRef(0),controller=useRef<AbortController|null>(null);
 const revision=useMemo(()=>jobs.map(job=>`${job.id}:${job.status}:${job.appliedAt??""}:${(job.interviews??[]).map(event=>`${event.id}:${event.state}:${event.updatedAt}`).join(",")}`).join("|"),[jobs]);
 const refresh=useCallback(async()=>{const request=++generation.current;controller.current?.abort();controller.current=new AbortController();setState(current=>({owner,value:current.owner===owner?current.value:null,error:"",loading:true}));try{const r=await fetch("/api/application-funnel",{cache:"no-store",signal:AbortSignal.any([controller.current.signal,AbortSignal.timeout(15000)])});if(!r.ok)throw new Error();const data=await r.json() as {funnel:ApplicationFunnel};if(request===generation.current)setState({owner,value:data.funnel,error:"",loading:false});return true;}catch{if(request===generation.current)setState(current=>({owner,value:current.owner===owner?current.value:null,error:"L’entonnoir ne peut pas être relu. Les derniers chiffres confirmés restent affichés.",loading:false}));return false;}},[owner]);
 useEffect(()=>{if(!active)return;const frame=requestAnimationFrame(()=>void refresh());return()=>{cancelAnimationFrame(frame);generation.current++;controller.current?.abort();};},[active,revision,refresh]);
 return {value:state.owner===owner?state.value:null,error:state.owner===owner?state.error:"",loading:state.owner!==owner||state.loading,refresh};
}
