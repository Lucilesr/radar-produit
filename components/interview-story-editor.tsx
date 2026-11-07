"use client";
import {useRef,useState} from "react";
import {X} from "lucide-react";
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from "@/components/ui/dialog";
import {Textarea} from "@/components/ui/textarea";
import {useSavedForm,AutosaveStatus} from "@/components/autosave";
import {WorkspaceButton,WorkspaceFormError} from "@/components/workspace-form";
import {interviewThemes,type InterviewTheme} from "@/lib/radar-reach";
import {sessionWrite} from "@/lib/session-write";
import {requestError} from "@/lib/request-error";
import type {Library} from "@/components/experience-library";
import type {ExperienceItem} from "@/lib/experience-domain";

/** A new private story uses the same proposed → approved path as the carnet. */
export function InterviewStoryEditor({themeId,existing,onClose,onCarnet}:{themeId:InterviewTheme;existing?:ExperienceItem;onClose:()=>void;onCarnet:()=>void}){
 const theme=interviewThemes.find(theme=>theme.id===themeId)!;
 const [initial]=useState(()=>({id:existing?.id??crypto.randomUUID(),context:existing?.data.context??"",contribution:existing?.data.contribution??"",result:existing?.data.result??""}));
 const baseVersion=useRef(existing?.version??0);
 const draft=useSavedForm(`story:${themeId}`,initial);
 const [busy,setBusy]=useState(false),[error,setError]=useState("");
 const [remote,setRemote]=useState<ExperienceItem|null>(null);
 const lock=useRef(false),pending=useRef<{key:string;id:string}|null>(null),title=useRef<HTMLHeadingElement>(null);
 const opener=useRef<HTMLElement|null>(null),navigating=useRef(false);
 function close(){if(!lock.current)onClose();}
 async function read(body?:Record<string,unknown>):Promise<Library>{
  let payload=body;
  if(body){const key=JSON.stringify(body);if(pending.current?.key!==key)pending.current={key,id:crypto.randomUUID()};payload={...body,requestId:pending.current.id};}
  const response=await fetch("/api/experiences",{cache:"no-store",signal:AbortSignal.timeout(15000),...(payload?{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)}:{})});
  const data=await response.json() as Library&{error?:string};
  if(!response.ok||!Array.isArray(data.items))throw new Error(data.error??"Enregistrement du récit non confirmé. Votre brouillon reste conservé.");
  window.dispatchEvent(new CustomEvent("radar:experiences-changed",{detail:{items:data.items}}));
  return data;
 }
 async function save(comparedVersion?:number){
  if(lock.current||!draft.ready)return;
  lock.current=true;setBusy(true);setError("");setRemote(null);const writeKey=crypto.randomUUID();sessionWrite(writeKey,true);
  try{
   let state=await read(),item=state.items.find(item=>item.id===draft.value.id);
   const data={title:item?.data.title??theme.label,organization:item?.data.organization??"",role:item?.data.role??"",period:item?.data.period??"",context:draft.value.context,contribution:draft.value.contribution,result:draft.value.result,claimKey:`interview-story:${themeId}`,reviewModel:item?.data.reviewModel??1 as const,reviewPoints:item?.data.reviewPoints??[]};
   const same=item&&item.data.context===data.context&&item.data.contribution===data.contribution&&item.data.result===data.result&&item.data.claimKey===data.claimKey;
   if(item&&!same){
    const allowed=comparedVersion??baseVersion.current;
    if(item.validation==="rejected"||item.validation==="superseded"||(item.version!==allowed&&!(allowed===0&&item.version===1&&item.validation==="proposed"))){setRemote(item);throw new Error("Ce bloc a évolué dans le carnet. Comparez les versions ; votre brouillon reste conservé.");}
    state=await read({action:"edit",id:item.id,version:item.version,data,permissions:{applicationAllowed:item.applicationAllowed,publicProfileAllowed:item.publicProfileAllowed},validate:true});
   }else if(!item)state=await read({action:"create",id:draft.value.id,kind:"fact",parentId:null,data});
   item=state.items.find(item=>item.id===draft.value.id);
   if(!item)throw new Error("Le récit créé n’a pas pu être relu. Votre brouillon reste conservé.");
   if(item.validation!=="approved")state=await read({action:"review",selection:[{id:item.id,version:item.version}],validation:"approved",confirmed:true});
   if(state.items.find(item=>item.id===draft.value.id)?.validation!=="approved")throw new Error("La validation du récit n’a pas pu être confirmée. Votre brouillon reste conservé.");
   draft.save.document.confirmedElsewhere("");onClose();
  }catch(problem){setError(requestError(problem,"Validation non confirmée. Votre brouillon reste conservé."));}
  finally{sessionWrite(writeKey,false);lock.current=false;setBusy(false);}
 }
 const valid=draft.ready&&[draft.value.context,draft.value.contribution,draft.value.result].every(value=>value.trim());
 return <Dialog open onOpenChange={open=>{if(!open)close();}}><DialogContent className="reach-story-dialog" showCloseButton={false} onOpenAutoFocus={event=>{event.preventDefault();opener.current=document.activeElement instanceof HTMLElement?document.activeElement:null;title.current?.focus();}} onCloseAutoFocus={event=>{event.preventDefault();if(navigating.current)return;[opener.current,document.getElementById("reach-title"),document.getElementById("workspace-title")].find(element=>element?.isConnected&&element.getClientRects().length)?.focus();}}><DialogHeader><DialogTitle ref={title} tabIndex={-1}>{theme.label}</DialogTitle><DialogDescription>{theme.prompt}</DialogDescription></DialogHeader><WorkspaceButton className="absolute right-2 top-2" variant="quiet" aria-label="Fermer" disabled={busy} onClick={close}><X size={20} aria-hidden/></WorkspaceButton>
  <form onSubmit={event=>{event.preventDefault();if(valid)void save();}}><label>Le contexte<Textarea required disabled={busy||!draft.ready} rows={4} maxLength={6000} value={draft.value.context} onChange={event=>draft.setValue(value=>({...value,context:event.target.value}))}/></label><label>Ma contribution personnelle<Textarea required disabled={busy||!draft.ready} rows={3} maxLength={4000} value={draft.value.contribution} onChange={event=>draft.setValue(value=>({...value,contribution:event.target.value}))}/></label><label>Les effets observés et les limites<Textarea required disabled={busy||!draft.ready} rows={3} maxLength={4000} value={draft.value.result} onChange={event=>draft.setValue(value=>({...value,result:event.target.value}))}/></label>
  <p className="signal-help">Restez fidèle aux faits. Un résultat encore à mesurer peut être indiqué comme tel. {existing?"Après modification, la réutilisation est suspendue jusqu’à un nouveau choix des droits d’usage dans le carnet.":"Ce nouveau récit reste privé ; son usage en candidature ou sur un profil public se choisit séparément dans le carnet."}</p><AutosaveStatus save={draft.save} draft/><WorkspaceFormError message={error}/>{remote?<details className="reach-story-comparison"><summary>Comparer au récit enregistré</summary><h3>Le contexte enregistré</h3><p>{remote.data.context}</p><h3>La contribution enregistrée</h3><p>{remote.data.contribution}</p><h3>Les effets enregistrés</h3><p>{remote.data.result}</p><p>Votre brouillon reste dans les champs au-dessus. Les versions précédentes du récit restent dans le carnet.</p>{!["rejected","superseded"].includes(remote.validation)?<WorkspaceButton disabled={busy||!valid} onClick={()=>void save(remote.version)}>Enregistrer ce brouillon après comparaison</WorkspaceButton>:null}</details>:null}<div className="signal-save-actions"><WorkspaceButton disabled={busy} onClick={close}>Reprendre plus tard</WorkspaceButton><WorkspaceButton type="submit" variant="primary" busy={busy} disabled={!valid}>{existing?"Valider les changements":"Valider cette histoire"}</WorkspaceButton></div>{existing||error?<WorkspaceButton disabled={busy} onClick={()=>{navigating.current=true;onCarnet();}}>Ouvrir le carnet</WorkspaceButton>:null}</form>
 </DialogContent></Dialog>;
}
