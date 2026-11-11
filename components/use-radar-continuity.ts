"use client";
import {useCallback,useEffect,useMemo,useSyncExternalStore} from "react";
import type {RadarContinuity} from "@/lib/radar-continuity";
import type {StoredLot} from "@/lib/daily-lot";
import type {RadarSession} from "@/lib/radar-session";
type View={ready:boolean;reading:boolean;busy:number;error:string;state:RadarContinuity|null;activeVersion:number|null};
type Entry={view:View;snapshot:string;listeners:Set<()=>void>;read:Promise<RadarContinuity|null>|null};
const empty:View={ready:false,reading:false,busy:0,error:"",state:null,activeVersion:null},serverSnapshot=JSON.stringify(empty),entries=new Map<string,Entry>();
function entry(owner:string){let found=entries.get(owner);if(!found){found={view:{...empty},snapshot:serverSnapshot,listeners:new Set(),read:null};entries.set(owner,found);}return found;}
function publish(owner:string){const current=entry(owner);current.snapshot=JSON.stringify(current.view);current.listeners.forEach(listener=>listener());}
function merge(owner:string,state:RadarContinuity){
 if(state?.ownerId!==owner||!Number.isInteger(state.lotVersion)||!Number.isInteger(state.sessionVersion))throw new Error("La connexion a changé. Rechargez votre espace.");
 const current=entry(owner),old=current.view.state;
 current.view.state=old?{ownerId:owner,lot:state.lotVersion>=old.lotVersion?state.lot:old.lot,lotVersion:Math.max(old.lotVersion,state.lotVersion),session:state.sessionVersion>=old.sessionVersion?state.session:old.session,sessionVersion:Math.max(old.sessionVersion,state.sessionVersion)}:state;
 current.view.ready=true;
}
export function continuityView(owner:string){return entry(owner).view;}
export function waitForContinuityWrites(owner:string){
 const current=entry(owner);
 if(!current.view.busy)return Promise.resolve();
 return new Promise<void>(resolve=>{
  const idle=()=>{if(!current.view.busy){current.listeners.delete(idle);resolve();}};
  current.listeners.add(idle);
 });
}
export async function reloadContinuity(owner:string,force=true):Promise<RadarContinuity|null>{
 if(!owner)return null;const current=entry(owner);if(current.read)return current.read;if(!force&&current.view.ready)return current.view.state;
 current.view.reading=true;current.view.error="";publish(owner);
 current.read=(async()=>{try{const response=await fetch("/api/radar-continuity",{cache:"no-store",headers:{"X-Radar-Owner":owner},signal:AbortSignal.timeout(15000)});const result=await response.json() as {state:RadarContinuity;error?:string};if(!response.ok)throw new Error(result.error);merge(owner,result.state);return current.view.state;}catch{current.view.error="Les repères du compte n’ont pas pu être relus. Vos décisions restent conservées ; réessayez avant de reprendre le tri ou la séance.";return null;}finally{current.view.reading=false;current.read=null;publish(owner);}})();return current.read;
}
async function write(owner:string,body:Record<string,unknown>,activate?:boolean,onConflict?:()=>void){
 const current=entry(owner);if(!current.view.ready&&!await reloadContinuity(owner,false))return null;
 current.view.busy++;current.view.error="";publish(owner);
 try{const response=await fetch("/api/radar-continuity",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...body,owner}),signal:AbortSignal.timeout(15000)});const result=await response.json() as {state?:RadarContinuity;error?:string};
  if(!response.ok){if(result.state)merge(owner,result.state);if(response.status===409)onConflict?.();throw new Error(result.error??"Point de reprise non confirmé.");}
  if(!result.state)throw new Error();if(activate!==undefined)current.view.activeVersion=activate?result.state.sessionVersion:null;merge(owner,result.state);publish(owner);
  if(body.kind==="session"&&current.view.state!.sessionVersion>result.state.sessionVersion){onConflict?.();throw new Error("La séance a avancé sur un autre appareil. Relisez le point de reprise.");}
  return result.state;
 }catch(problem){current.view.error=problem instanceof Error&&!['TypeError','AbortError','TimeoutError'].includes(problem.name)&&problem.message?problem.message:"Point de reprise non confirmé. Relisez l’état du compte avant de réessayer.";return null;}
 finally{current.view.busy--;publish(owner);}
}
export const saveAccountLot=(owner:string,lot:StoredLot)=>write(owner,{kind:"lot",lot});
export const saveAccountSession=(owner:string,session:RadarSession|null,version:number,finishId?:string,onConflict?:()=>void)=>write(owner,{kind:"session",session,version,...(finishId?{finish:true,id:finishId}:{})},!!session&&!session.paused,onConflict);
/** Best effort on leaving; a stale checkpoint can never overwrite a newer version. */
export function pauseAccountOnExit(owner:string,session:RadarSession,version:number){const body=JSON.stringify({kind:"session",session,version,owner});if(new TextEncoder().encode(body).length<60000)navigator.sendBeacon("/api/radar-continuity",new Blob([body],{type:"application/json"}));}
export function useRadarContinuity(owner:string,enabled=true){
 const subscribe=useCallback((listener:()=>void)=>{const current=entry(owner);current.listeners.add(listener);return()=>current.listeners.delete(listener);},[owner]);
 const snapshot=useCallback(()=>entry(owner).snapshot,[owner]);const raw=useSyncExternalStore(subscribe,snapshot,()=>serverSnapshot);
 const view=useMemo(()=>JSON.parse(raw) as View,[raw]);
 useEffect(()=>{if(!enabled||!owner)return;const frame=requestAnimationFrame(()=>void reloadContinuity(owner,false));const focus=()=>{if(!entry(owner).view.busy)void reloadContinuity(owner);};window.addEventListener("focus",focus);return()=>{cancelAnimationFrame(frame);window.removeEventListener("focus",focus);};},[owner,enabled]);
 return {...view,reload:()=>reloadContinuity(owner)};
}
