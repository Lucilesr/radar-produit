"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {X} from "lucide-react";
import {WorkspaceButton,WorkspaceFormError,WorkspacePanelHeader} from "@/components/workspace-form";
import {useWorkspaceFeedback} from "@/components/workspace-feedback";
import {foldKeyword,maxDomainTerms,normalizeDomainTerms} from "@/lib/search-preferences";
import type {DomainProposal} from "@/lib/domain-suggestions";
type DomainState={terms:string[];proposals:DomainProposal[];eligibleCount:number;totalItems:number};
export function DomainTermsPanel({active,knownTerms,referenceKey,onSaved,onCarnet}:{active:boolean;knownTerms?:string[];referenceKey:string;onSaved:(terms:string[])=>void;onCarnet:()=>void}){
 const [data,setData]=useState<DomainState>({terms:normalizeDomainTerms(knownTerms),proposals:[],eligibleCount:0,totalItems:0});
 const [ready,setReady]=useState(false),[error,setError]=useState(""),[busy,setBusy]=useState<string|null>(null),[limit,setLimit]=useState(8);
 const lock=useRef(false),generation=useRef(0),mounted=useRef(true);
 const notify=useWorkspaceFeedback(),savedCallback=useRef(onSaved);
 useEffect(()=>{savedCallback.current=onSaved;},[onSaved]);
 const load=useCallback(async()=>{const request=++generation.current;setReady(false);setError("");setData(current=>({...current,proposals:[]}));try{const response=await fetch("/api/domain-terms",{cache:"no-store",signal:AbortSignal.timeout(15000)});const next=await response.json() as DomainState;if(!response.ok||!Array.isArray(next.terms)||!Array.isArray(next.proposals))throw new Error();if(mounted.current&&request===generation.current){setData(next);setReady(true);savedCallback.current(next.terms);}}catch{if(mounted.current&&request===generation.current)setError("Les termes du carnet n’ont pas pu être relus. Vos critères déjà confirmés sont conservés.");}},[]);
 useEffect(()=>{mounted.current=true;if(!active)return;const frame=requestAnimationFrame(()=>void load());const reread=()=>{if(!lock.current)void load();};window.addEventListener("radar:experiences-changed",reread);window.addEventListener("focus",reread);return()=>{cancelAnimationFrame(frame);generation.current++;window.removeEventListener("radar:experiences-changed",reread);window.removeEventListener("focus",reread);};},[active,referenceKey,load]);
 useEffect(()=>()=>{mounted.current=false;generation.current++;},[]);
 async function write(action:"confirm"|"remove",term:string,proposal?:DomainProposal){
  if(lock.current||!ready)return;lock.current=true;setBusy(foldKeyword(term));setError("");generation.current++;
  try{const response=await fetch("/api/domain-terms",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,term,...(proposal?{sourceId:proposal.sourceId,sourceVersion:proposal.sourceVersion}:{})}),signal:AbortSignal.timeout(15000)});const next=await response.json() as DomainState&{error?:string};
   if(!response.ok||!Array.isArray(next.terms)||!Array.isArray(next.proposals)){setReady(false);setData(current=>({...current,proposals:[]}));throw new Error(next.error??"Enregistrement non confirmé. Relisez les termes avant de réessayer.");}
   setData(next);onSaved(next.terms);notify({message:action==="remove"?`Terme retiré : ${term}.`:next.terms.some(value=>foldKeyword(value)===foldKeyword(term))?`Terme confirmé : ${term}.`:`${term} est déjà dans vos mots-clés manuels.`,tone:"success"});
  }catch(problem){setReady(false);setData(current=>({...current,proposals:[]}));const message=problem instanceof Error&&!['TimeoutError','AbortError','TypeError'].includes(problem.name)?problem.message:"Enregistrement non confirmé. Vos critères précédents restent conservés. Relisez les termes avant de réessayer.";setError(message);notify({message,tone:"error"});}
  finally{lock.current=false;setBusy(null);requestAnimationFrame(()=>{if(document.activeElement===document.body||!document.activeElement?.isConnected)document.getElementById("domain-terms-title")?.focus();});}
 }
 return <section className="domain-terms-panel" aria-labelledby="domain-terms-title" aria-busy={!!busy}>
  <WorkspacePanelHeader id="domain-terms-title" title="Termes de votre domaine"/>
  <p className="signal-help">Repérés dans vos expériences validées et autorisées pour les candidatures. Confirmez chaque terme qui vous représente : aucun n’est utilisé avant votre choix. Ce repérage n’est pas une affirmation de compétence.</p>
  <p role="status" className="signal-help">{data.terms.length} terme{data.terms.length>1?"s":""} confirmé{data.terms.length>1?"s":""} sur {maxDomainTerms}. Les mots-clés manuels identiques ne comptent pas deux fois.</p>
  {data.terms.length?<ul className="domain-confirmed" aria-label="Termes du domaine confirmés">{data.terms.map(term=><li key={foldKeyword(term)}><span>{term}</span><WorkspaceButton variant="quiet" aria-label={`Retirer le terme ${term}`} disabled={!ready||!!busy} busy={busy===foldKeyword(term)} onClick={()=>void write("remove",term)}><X size={16} aria-hidden/></WorkspaceButton></li>)}</ul>:null}
  {!ready&&!error?<p role="status">Lecture des expériences et des droits…</p>:null}<WorkspaceFormError message={error}/>{error?<WorkspaceButton disabled={!!busy} onClick={()=>void load()}>Relire les termes</WorkspaceButton>:null}
  {ready&&data.terms.length>=maxDomainTerms?<p className="signal-help">Vos quarante places sont remplies. Retirez un terme pour en confirmer un autre.</p>:null}
  {ready&&data.proposals.length?<><ul className="domain-proposals" aria-label="Termes à confirmer">{data.proposals.slice(0,limit).map(proposal=><li key={foldKeyword(proposal.term)}><div><strong>{proposal.term}</strong><p className="signal-help">Repéré dans « {proposal.sourceTitle} »</p><blockquote>{proposal.excerpt}</blockquote></div><WorkspaceButton aria-label={`Confirmer le terme ${proposal.term}`} disabled={!!busy||data.terms.length>=maxDomainTerms} busy={busy===foldKeyword(proposal.term)} onClick={()=>void write("confirm",proposal.term,proposal)}>Confirmer</WorkspaceButton></li>)}</ul>{data.proposals.length>limit?<WorkspaceButton disabled={!!busy} onClick={()=>setLimit(value=>value+8)}>Voir huit autres propositions</WorkspaceButton>:null}</>:null}
  {ready&&!data.proposals.length?<p className="signal-help">{!data.totalItems?"Votre carnet est encore vide. Ajoutez une expérience, relisez-la et choisissez ses droits d’usage.":!data.eligibleCount?"Aucun bloc du carnet courant n’est utilisable pour ces propositions. Validez les faits, choisissez leur droit de candidature et réglez les points en attente.":"Aucun autre terme du vocabulaire de repérage n’a été trouvé. Vos mots-clés manuels restent disponibles dans les critères."}</p>:null}
  <WorkspaceButton disabled={!!busy} onClick={onCarnet}>Ouvrir mon carnet</WorkspaceButton>
  <p className="signal-help">Les termes déjà confirmés sont des critères que vous pouvez retirer ici. Retirer l’autorisation d’une expérience arrête ses nouvelles propositions ; cela n’efface pas vos choix de critères. Aucun texte du carnet n’est envoyé à un service tiers.</p>
 </section>;
}
