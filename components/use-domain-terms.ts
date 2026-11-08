"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
import type {DomainProposal} from '@/lib/domain-suggestions';
import {normalizeDomainTerms} from '@/lib/search-preferences';
import {useWorkspaceFeedback} from '@/components/workspace-feedback';
export type DomainState={terms:string[];ignoredTerms:string[];proposals:DomainProposal[];eligibleCount:number;totalItems:number};
export type DomainCommand={action:'confirm'|'confirmMany'|'remove'|'ignore'|'restore';term?:string;sourceId?:string;sourceVersion?:number;proposals?:DomainProposal[]};
export function useDomainTerms(active:boolean,referenceKey:string,onSaved?:(terms:string[])=>void,knownTerms?:string[]){
 const [data,setData]=useState<DomainState>({terms:normalizeDomainTerms(knownTerms),ignoredTerms:[],proposals:[],eligibleCount:0,totalItems:0});
 const [ready,setReady]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const lock=useRef(false),generation=useRef(0),mounted=useRef(true),saved=useRef(onSaved),notify=useWorkspaceFeedback();
 useEffect(()=>{saved.current=onSaved;},[onSaved]);
 const load=useCallback(async()=>{
  const request=++generation.current;setReady(false);setError('');setData(current=>({...current,proposals:[]}));
  try{const response=await fetch('/api/domain-terms',{cache:'no-store',signal:AbortSignal.timeout(15000)}),next=await response.json() as DomainState;
   if(!response.ok||!Array.isArray(next.terms)||!Array.isArray(next.proposals)||!Array.isArray(next.ignoredTerms))throw new Error();
   if(mounted.current&&request===generation.current){setData(next);setReady(true);saved.current?.(next.terms);}
  }catch{if(mounted.current&&request===generation.current)setError('Termes indisponibles. Vos choix confirmés sont conservés.');}
 },[]);
 useEffect(()=>{mounted.current=true;if(!active)return;const frame=requestAnimationFrame(()=>void load()),reread=()=>{if(!lock.current)void load();};window.addEventListener('radar:experiences-changed',reread);window.addEventListener('radar:domain-terms-changed',reread);window.addEventListener('focus',reread);return()=>{cancelAnimationFrame(frame);generation.current++;window.removeEventListener('radar:experiences-changed',reread);window.removeEventListener('radar:domain-terms-changed',reread);window.removeEventListener('focus',reread);};},[active,referenceKey,load]);
 useEffect(()=>()=>{mounted.current=false;generation.current++;},[]);
 async function write(command:DomainCommand){
  if(lock.current||!ready)return false;lock.current=true;setBusy(true);setError('');generation.current++;
  try{const response=await fetch('/api/domain-terms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(command),signal:AbortSignal.timeout(15000)}),next=await response.json() as DomainState&{error?:string};
   if(!response.ok||!Array.isArray(next.terms)||!Array.isArray(next.proposals)||!Array.isArray(next.ignoredTerms))throw new Error(next.error??'Enregistrement non confirmé. Relisez les termes.');
   if(!mounted.current)return false;setData(next);saved.current?.(next.terms);window.dispatchEvent(new Event('radar:domain-terms-changed'));
   notify({message:command.action==='ignore'?'Terme ignoré.':command.action==='restore'?'Terme restauré.':command.action==='remove'?'Terme retiré.':'Termes confirmés.',tone:'success'});return true;
  }catch(problem){if(mounted.current){setReady(false);setData(current=>({...current,proposals:[]}));setError(problem instanceof Error&&!['TimeoutError','AbortError','TypeError'].includes(problem.name)?problem.message:'Enregistrement non confirmé. Relisez les termes avant de réessayer.');}return false;}
  finally{lock.current=false;if(mounted.current)setBusy(false);}
 }
 return {data,ready,error,busy,load,write};
}
export type DomainController=ReturnType<typeof useDomainTerms>;
