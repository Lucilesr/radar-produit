"use client";
import {useTabReturnRefresh} from "@/components/use-tab-return-refresh";
import {createContext,useCallback,useContext,useEffect,useRef,useState,useSyncExternalStore,type ReactNode} from "react";
import {DateTimePicker} from "@/components/date-picker";
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from "@/components/ui/dialog";
import {WorkspaceButton,WorkspaceFormError,WorkspaceFormSection} from "@/components/workspace-form";
import {useDisplayTimeZone} from "@/components/use-display-time-zone";
import {applicationFollowup,latestFollowup,type ApplicationFollowup as Followup,type FollowupEntry} from "@/lib/application-followup";
import {formatDate,zonedInput,fromZonedInput} from "@/lib/application-workflow";
import {confirmActivity} from "@/lib/activity-client";
import {confirmedProgress} from "@/lib/progress-event";
import {createSaveQueue} from "@/lib/save-queue";
import {sessionWrite} from "@/lib/session-write";
import type {JobRecord} from "@/lib/types";
type FollowupCommand = Pick<FollowupEntry, "id" | "at" | "appliedFor">;
type FollowupReceipt = { command: FollowupCommand; doneAt: string; followup?: Followup };
const followupKey = (command: FollowupCommand) => JSON.stringify([command.id, command.at, command.appliedFor]);
function followupQueue() {
  return createSaveQueue<{ pending: string[]; receipt?: FollowupReceipt }, FollowupCommand>({
    initial: { pending: [] },
    key: followupKey,
    apply: (state, command) => ({ ...state, pending: [...state.pending, followupKey(command)] }),
    onBusyChange: busy => sessionWrite("followup-done", busy),
    async send(command) {
      const saved = await confirmActivity({ action: "followup_done", objectId: command.id, stamp: command.at, ...(command.appliedFor ? { appliedFor: command.appliedFor } : {}) });
      return { kind: "saved", state: { pending: [], receipt: { command, doneAt: saved.doneAt ?? new Date().toISOString(), followup: saved.followup } } };
    },
  });
}
const FollowupQueueContext = createContext<ReturnType<typeof followupQueue> | null>(null);

export function FollowupActionsProvider({ children }: { children: ReactNode }) {
  const [queue] = useState(followupQueue);
  useEffect(() => queue.subscribeSaved(({ receipt }) => {
    if (!receipt) return;
    const { command, doneAt, followup } = receipt;
    window.dispatchEvent(new CustomEvent("radar:followup-done", { detail: { id: command.id, at: command.at, doneAt, followup } }));
    confirmedProgress({ kind: "followup_done", objectId: command.id, stamp: command.at });
  }), [queue]);
  return <FollowupQueueContext.Provider value={queue}>{children}</FollowupQueueContext.Provider>;
}

export function FollowupDoneButton({ entry, onSaved, focusTargetId, disabled = false }: {
  disabled?: boolean; entry: FollowupEntry; onSaved?: (followup?: Followup) => void; focusTargetId?: string;
}) {
  const context = useContext(FollowupQueueContext);
  if (!context) throw new Error("FollowupActionsProvider is required.");
  const queue = context;
  const { visible, failed } = useSyncExternalStore(queue.subscribe, queue.getSnapshot, queue.getSnapshot);
  const id = followupKey(entry), status = useRef<HTMLSpanElement>(null), retry = useRef<HTMLButtonElement>(null);
  const pending = visible.pending.includes(id);
  const failure = failed.some(command => followupKey(command) === id);
  useEffect(() => queue.subscribeSaved(({ receipt }) => {
    if (!receipt || followupKey(receipt.command) !== id) return;
    onSaved?.(receipt.followup);
    requestAnimationFrame(() => {
      if (document.activeElement === document.body && focusTargetId) document.getElementById(focusTargetId)?.focus({ preventScroll: true });
    });
  }), [queue, id, onSaved, focusTargetId]);
  function done() {
    const command = { id: entry.id, at: entry.at, appliedFor: entry.appliedFor };
    void queue.enqueue(command).then(saved => {
      if (!saved) requestAnimationFrame(() => {
        if (document.activeElement === document.body) retry.current?.focus({ preventScroll: true });
      });
    });
    requestAnimationFrame(() => {
      if (document.activeElement === document.body) status.current?.focus({ preventScroll: true });
    });
  }
  return <div className="followup-confirm">
    {pending ? <span ref={status} tabIndex={-1} role="status">Relance notée · confirmation en cours</span>
      : <WorkspaceButton ref={retry} variant="primary" disabled={disabled} onClick={done}>{failure ? "Réessayer" : "J’ai fait cette relance"}</WorkspaceButton>}
    {failure ? <WorkspaceFormError message="La relance n’est pas confirmée."/> : null}
  </div>;
}
export function ApplicationFollowupCard({job,onInterviews,initialEditor=false,onEditorClosed}:{job:JobRecord;onInterviews:()=>void;initialEditor?:boolean;onEditorClosed?:()=>void}){
 const [value,setValue]=useState<Followup|undefined>(job.applicationFollowup??applicationFollowup(job)),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(""),[editor,setEditor]=useState(initialEditor);
 const current=useRef(value),lock=useRef(false),live=useRef(true),generation=useRef(0),retry=useRef<HTMLButtonElement>(null),editTrigger=useRef<HTMLButtonElement>(null),zone=useDisplayTimeZone(),id=`application-followup-${job.id}`;
 const interviews=(job.interviews??[]).map(event=>`${event.id}:${event.state}`).join();
 const accept=useCallback((next:Followup|undefined,notify=true)=>{current.current=latestFollowup(current.current,next);setValue(current.current);if(notify&&next)window.dispatchEvent(new CustomEvent("radar:application-followup",{detail:{id:job.id,followup:next}}));},[job.id]);
 const load=useCallback(async({focus=false,silent=false}:{focus?:boolean;silent?:boolean}={})=>{const request=++generation.current;if(!silent)setError("");try{const r=await fetch(`/api/application-followup/${job.id}`,{cache:"no-store",signal:AbortSignal.timeout(15000)});const body=await r.json() as {followup:Followup|null};if(!r.ok||body.followup&&!Number.isInteger(body.followup.version))throw new Error();if(live.current&&request===generation.current){const next=body.followup??undefined,previous=current.current;
    if(!silent||next&&(!previous||next.appliedFor===previous.appliedFor&&next.version>previous.version||Date.parse(next.appliedFor)>Date.parse(previous.appliedFor)))accept(next);
    setReady(true);if(focus)requestAnimationFrame(()=>document.getElementById(id)?.focus());}}catch{if(live.current&&request===generation.current){if(!silent)setError("La relance ne peut pas être relue. Le dernier rappel confirmé reste affiché.");if(focus)requestAnimationFrame(()=>retry.current?.focus());}}},[job.id,job.status,job.appliedAt,interviews,accept,id]);
 useEffect(()=>{live.current=true;const frame=requestAnimationFrame(()=>void load());return()=>{live.current=false;generation.current++;cancelAnimationFrame(frame);};},[load]);
 useTabReturnRefresh(`followup:${job.id}`,()=>void load({silent:ready}));
 async function schedule(dueAt:string|null,version:number,appliedFor:string):Promise<{ok:boolean;current?:Followup|null;error?:string}>{if(lock.current)return {ok:false,error:"Un choix est déjà en cours."};lock.current=true;setBusy(true);setError("");const key=crypto.randomUUID();sessionWrite(key,true);generation.current++;
  try{const r=await fetch(`/api/application-followup/${job.id}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"schedule",version,appliedFor,dueAt}),signal:AbortSignal.timeout(15000)});const body=await r.json() as {followup?:Followup|null;error?:string};if(!r.ok){if(Object.hasOwn(body,"followup"))accept(body.followup??undefined);return {ok:false,current:body.followup,error:body.error??"Date non confirmée."};}accept(body.followup??undefined);setReady(true);return {ok:true};}
  catch{return {ok:false,error:"Choix non confirmé. La date saisie reste disponible ; aucun message n’est envoyé."};}
  finally{sessionWrite(key,false);lock.current=false;setBusy(false);}
 }
 async function remove(){if(!value)return;const result=await schedule(null,value.version,value.appliedFor);if(!result.ok){setError(result.error??"Choix non confirmé.");requestAnimationFrame(()=>retry.current?.focus());}else requestAnimationFrame(()=>editTrigger.current?.focus());}
 const entry=value?.dueAt?{id:`application:${job.id}`,kind:"application" as const,job,at:value.dueAt,appliedFor:value.appliedFor}:null;
 return <div id={id} className="application-followup" tabIndex={-1} role="region" aria-label="Relance de cette candidature" aria-busy={busy||!ready&&!error}><WorkspaceFormSection title="Votre relance" description="Radar propose une relance 7 jours après l’envoi.">
 {!ready&&!error?<p role="status">Lecture du rappel…</p>:null}
 <div className="application-followup-row">{value?.doneAt?<p role="status">Relance notée faite le {formatDate(value.doneAt,zone,true)}.</p>:value?.eligible&&value.dueAt?<p>{value.proposed?"Date proposée à J+7":"Rappel choisi"} : <strong>{formatDate(value.dueAt,zone,true)}</strong> · {zone}</p>:value?.eligible?<p>Aucun rappel prévu pour cette candidature.</p>:job.interviews?.some(event=>event.state!=="cancelled")?<p>Un entretien a commencé : ses relances se règlent dans Entretiens.</p>:!job.appliedAt?<p>La date d’envoi n’est pas connue. Radar ne peut pas calculer J+7.</p>:<p>Cette étape de candidature n’a pas de rappel de relance.</p>}
 {value?.eligible?<div className="application-followup-actions">{entry&&!value.doneAt?<FollowupDoneButton entry={entry} disabled={!ready||busy} focusTargetId={id} onSaved={next=>{if(next)accept(next,false);}}/>:null}<WorkspaceButton ref={editTrigger} disabled={!ready||busy} onClick={()=>setEditor(true)}>{value.doneAt?"Prévoir une autre relance":value.dueAt?"Modifier la date":"Prévoir une relance"}</WorkspaceButton>{value.dueAt&&!value.doneAt?<WorkspaceButton disabled={!ready||busy} onClick={()=>void remove()}>Retirer le rappel</WorkspaceButton>:null}</div>:job.interviews?.some(event=>event.state!=="cancelled")?<WorkspaceButton onClick={onInterviews}>Ouvrir les entretiens</WorkspaceButton>:null}</div>
 <WorkspaceFormError message={error}/>{error?<WorkspaceButton ref={retry} disabled={busy} onClick={()=>void load({focus:true})}>Relire la relance</WorkspaceButton>:null}
 {editor&&value?.eligible&&ready?<FollowupDateEditor key={`followup-editor:${job.id}`} value={value} zone={zone} busy={busy} onSave={schedule} onClose={()=>{setEditor(false);onEditorClosed?.();requestAnimationFrame(()=>editTrigger.current?.focus());}}/>:null}
 </WorkspaceFormSection></div>;
}
function FollowupDateEditor({value,zone,busy,onSave,onClose}:{value:Followup;zone:string;busy:boolean;onSave:(dueAt:string|null,version:number,appliedFor:string)=>Promise<{ok:boolean;current?:Followup|null;error?:string}>;onClose:()=>void}){
 const [when,setWhen]=useState(()=>zonedInput(value.doneAt?new Date(Math.max(Date.parse(value.appliedFor)+14*86400000,Date.now()+7*86400000)).toISOString():value.dueAt??new Date(Date.now()+7*86400000).toISOString(),zone)),[error,setError]=useState(""),[remote,setRemote]=useState<Followup|null|undefined>(undefined);const heading=useRef<HTMLHeadingElement>(null),feedback=useRef<HTMLDivElement>(null),[base]=useState(()=>({version:value.version,appliedFor:value.appliedFor}));
 function showError(message:string){setError(message);requestAnimationFrame(()=>feedback.current?.focus());}
 async function save(version=base.version){try{setError("");const result=await onSave(fromZonedInput(when,zone),version,base.appliedFor);if(result.ok)onClose();else{showError(result.error??"Date non confirmée.");setRemote(result.current);}}catch(problem){showError(problem instanceof Error?problem.message:"Date invalide.");}}
 return <Dialog open onOpenChange={open=>{if(!open&&!busy)onClose();}}><DialogContent className="followup-date-dialog" showCloseButton={false} onOpenAutoFocus={event=>{event.preventDefault();heading.current?.focus();}} onCloseAutoFocus={event=>event.preventDefault()}><DialogHeader><DialogTitle ref={heading} tabIndex={-1}>Choisir ma date de relance</DialogTitle><DialogDescription>Un rappel privé dans Radar. Modifiez la date puis cliquez sur Terminé pour l’enregistrer.</DialogDescription></DialogHeader><DateTimePicker disabled={busy} label="Quand relancer" value={when} onChange={setWhen}/><p className="signal-help">Horaires affichés dans {zone}.</p>{error?<div ref={feedback} tabIndex={-1} className="followup-date-feedback"><WorkspaceFormError message={error}/></div>:null}{remote!==undefined?<div className="followup-date-conflict"><p>Dernier rappel du compte : {remote?.dueAt?formatDate(remote.dueAt,zone,true):"aucune date"}{remote?.doneAt?" · relance déjà faite":""}.</p><p>Comparez cette date avec votre saisie conservée ci-dessus.</p>{remote?.eligible?<WorkspaceButton disabled={busy} onClick={()=>void save(remote.version)}>Enregistrer après comparaison</WorkspaceButton>:<p>Cette candidature n’est plus en attente de cette relance.</p>}</div>:null}<div className="signal-save-actions"><WorkspaceButton disabled={busy} onClick={onClose}>Annuler</WorkspaceButton><WorkspaceButton variant="primary" busy={busy} disabled={!when||remote!==undefined} onClick={()=>void save()}>Terminé</WorkspaceButton></div></DialogContent></Dialog>;
}
