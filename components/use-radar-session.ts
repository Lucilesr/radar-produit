"use client";
import {useCallback,useEffect,useRef,useState,useSyncExternalStore} from "react";
import {useRadarContinuity,continuityView,saveAccountSession,pauseAccountOnExit,reloadContinuity,waitForContinuityWrites} from "@/components/use-radar-continuity";
import {readSession,pauseSession,type RadarSession} from "@/lib/radar-session";
import {createSaveQueue} from "@/lib/save-queue";
type Checkpoint={id:string;owner:string;session:RadarSession;optimistic:boolean;before:()=>Promise<void>;version:number};
const memory=new Map<string,string|null>(),listeners=new Set<()=>void>();
function subscribe(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};}
function read(key:string){if(memory.has(key))return memory.get(key)!;let raw:string|null=null;for(const storage of ["sessionStorage","localStorage"] as const)try{raw=window[storage].getItem(key);if(raw)break;}catch{/* Memory remains usable. */}try{const saved=JSON.parse(raw??"null");if(saved&&typeof saved==="object")raw=JSON.stringify({...saved,paused:true,resumedAt:null});}catch{/* The parser below rejects it. */}memory.set(key,raw);return raw;}
function write(key:string,value:RadarSession|null){const next=value?JSON.stringify(value):null;memory.set(key,next);for(const storage of ["sessionStorage","localStorage"] as const)try{if(next)window[storage].setItem(key,next);else window[storage].removeItem(key);}catch{/* Optional recovery only. */}listeners.forEach(listener=>listener());}
export function useRadarSession(owner:string,now:number){
 const key=`radar:seance:${owner}`,remote=useRadarContinuity(owner),migrating=useRef(false),snapshot=useCallback(()=>read(key),[key]);
 const raw=useSyncExternalStore(subscribe,snapshot,()=>null);
 const canonical=remote.state?.session??null,parsed=readSession(canonical?JSON.stringify(canonical):null,now);
 const active=!!parsed&&!parsed.paused&&remote.activeVersion===remote.state?.sessionVersion;
 const canonicalSession=parsed&&!active?{...parsed,paused:true,resumedAt:null}:parsed;
 const [conflictNotice,setConflictNotice]=useState("");
 const [checkpoints]=useState(()=>createSaveQueue<Checkpoint|null,Checkpoint>({
  initial:null,key:change=>change.id,apply:(state,change)=>change.optimistic?change:state,
  pauseOnFailure:true,
  async send(change,previous){
   await change.before();
   await waitForContinuityWrites(change.owner);
   const view=continuityView(change.owner);
   let version=previous?.owner===change.owner?Math.max(previous.version,change.version):change.version;
   const sameActiveSession=view.state?.session?.id===change.session.id&&view.activeVersion===view.state?.sessionVersion;
   if(sameActiveSession&&view.state)version=Math.max(version,view.state.sessionVersion);
   let conflict=false;
   if(view.state?.sessionVersion!==version){
    await reloadContinuity(change.owner);
    setConflictNotice("La séance a avancé sur un autre appareil. Le point de reprise du compte a été relu.");
    return {kind:"reset",state:null};
   }
   const session=sameActiveSession?{...change.session,sent:[...new Set([...change.session.sent,...(view.state?.session?.sent??[])])]}:change.session;
   const saved=await saveAccountSession(change.owner,session,version,undefined,()=>{conflict=true;});
   if(conflict)return {kind:"reset",state:null};
   if(!saved)throw new Error("Point de reprise non confirmé");
   write(`radar:seance:${change.owner}`,saved.session);
   return {kind:"saved",state:{...change,version:saved.sessionVersion}};
  },
 }));
 const checkpointState=useSyncExternalStore(checkpoints.subscribe,checkpoints.getSnapshot,checkpoints.getSnapshot);
 function viewSession(state:typeof checkpointState){
  const intent=state.queued.at(-1)??state.sending??state.failed[0];
  if(intent?.owner===owner&&state.visible?.owner===owner)return state.visible.session;
  return canonicalSession;
 }
 const session=viewSession(checkpointState);
 useEffect(()=>{
  if(!owner||!now||!remote.ready||remote.reading||remote.busy||remote.error||remote.state?.sessionVersion!==0||canonical||migrating.current)return;
  const previous=readSession(raw,now);if(!previous)return;
  const frame=requestAnimationFrame(()=>{migrating.current=true;void saveAccountSession(owner,{...previous,paused:true,resumedAt:null},0).finally(()=>{migrating.current=false;});});return()=>cancelAnimationFrame(frame);
 },[owner,now,remote.ready,remote.reading,remote.busy,remote.error,remote.state?.sessionVersion,canonical,raw]);
 useEffect(()=>{if(remote.ready&&(canonical||remote.state!.sessionVersion>0)){const next=canonical?JSON.stringify(canonical):null;if(raw!==next)write(key,canonical);}},[remote.ready,remote.state,canonical,raw,key]);
 useEffect(()=>{const hide=()=>{const view=continuityView(owner),value=readSession(view.state?.session?JSON.stringify(view.state.session):null,Date.now());if(value&&!value.paused&&view.activeVersion===view.state?.sessionVersion){const paused=pauseSession(value,Date.now());write(key,paused);if(!view.busy)pauseAccountOnExit(owner,paused,view.state!.sessionVersion);}};window.addEventListener("pagehide",hide);return()=>window.removeEventListener("pagehide",hide);},[key,owner]);
 async function save(value:RadarSession|null,finish=false){const view=continuityView(owner);if(!view.state)return false;const saved=await saveAccountSession(owner,value,view.state.sessionVersion,finish?session?.id:undefined);if(!saved)return false;write(key,saved.session);return true;}
 function checkpoint(value:RadarSession,before:()=>Promise<void>,optimistic=true){
  const version=continuityView(owner).state?.sessionVersion;
  if(version===undefined)return Promise.resolve(false);
  setConflictNotice("");
  return checkpoints.enqueue({id:crypto.randomUUID(),owner,session:value,before,version,optimistic});
 }
 const failed=checkpointState.failed.find(change=>change.owner===owner);
 return {session,save,checkpoint,getCurrent:()=>viewSession(checkpoints.getSnapshot()),hasCheckpoint:()=>{const state=checkpoints.getSnapshot();return !!(state.sending||state.queued.length||state.failed.length);},checkpointPending:checkpointState.sending?.owner===owner,checkpointFailed:!!failed,retryCheckpoint:()=>{if(failed)void checkpoints.retry(failed.id);},ready:remote.ready,busy:remote.busy>0,error:failed?"":conflictNotice||remote.error,reload:()=>{setConflictNotice("");return remote.reload();}};
}
