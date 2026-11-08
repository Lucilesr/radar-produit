"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {useDisplayTimeZone} from "@/components/use-display-time-zone";
import {useRadarClock} from "@/components/use-radar-clock";
import {monthDay,type MonthStoryData} from "@/lib/month-story";
export function useMonthStory(owner:string,active:boolean,month=""){
 const zone=useDisplayTimeZone(),clock=useRadarClock(),[state,setState]=useState<{owner:string;value:MonthStoryData|null;error:string;loading:boolean}>({owner,value:null,error:"",loading:true}),generation=useRef(0),controller=useRef<AbortController|null>(null);
 const effectiveZone=state.owner===owner?state.value?.story.timeZone??zone:zone,day=clock?monthDay(clock,effectiveZone):"";
 const refresh=useCallback(async()=>{const request=++generation.current;controller.current?.abort();controller.current=new AbortController();setState(current=>({owner,value:current.owner===owner?current.value:null,error:"",loading:true}));try{const params=new URLSearchParams({zone,...(month?{month}:{})}),r=await fetch(`/api/month-story?${params}`,{cache:"no-store",signal:AbortSignal.any([controller.current.signal,AbortSignal.timeout(15000)])});if(!r.ok)throw new Error();const value=await r.json() as MonthStoryData;if(request===generation.current)setState({owner,value,error:"",loading:false});return true;}catch{if(request===generation.current)setState(current=>({owner,value:current.owner===owner?current.value:null,error:"Votre mois ne peut pas être relu. Le dernier récit confirmé reste disponible.",loading:false}));return false;}},[owner,zone,month]);
 const cancel=useCallback(()=>{generation.current++;controller.current?.abort();},[]);
 useEffect(()=>{if(!active)return;const frame=requestAnimationFrame(()=>void refresh());return()=>{cancelAnimationFrame(frame);cancel();};},[active,day,refresh,cancel]);
 return {value:state.owner===owner?state.value:null,error:state.owner===owner?state.error:"",loading:state.owner!==owner||state.loading,refresh};
}
