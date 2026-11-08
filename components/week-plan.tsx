"use client";
import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {Check,X} from "lucide-react";
import {useRadarNextSteps} from "@/components/next-steps-context";
import {ChoiceSelect} from "@/components/choice-select";
import {DateTimePicker} from "@/components/date-picker";
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from "@/components/ui/dialog";
import {useSavedForm,AutosaveStatus} from "@/components/autosave";
import {SignalMoment} from "@/components/signal/signal-moment";
import {SignalProgress} from "@/components/signal/signal-progress";
import {WorkspaceButton,WorkspaceFormError,WorkspacePanelHeader} from "@/components/workspace-form";
import {weekKey,weekRhythms,weekActions,planHeld,commitmentOverdue,localDateTime,localTimeInZone,type WeekPlan,type WeekPlanState,type WeekCommitment} from "@/lib/week-plan";
import {useWeekSeries,WeekSeriesControls,SeriesSummary} from "@/components/week-series";
import {confirmedProgress} from "@/lib/progress-event";
import {sessionWrite} from "@/lib/session-write";
import {interviewThemes} from "@/lib/radar-reach";
import type {CandidateProfile,JobRecord} from "@/lib/types";
export type WeekTarget={id:string;type:"job"|"source"|"story";label:string};
type PlanCommand={version:number;plan?:WeekPlan;id?:string;done?:boolean};
export function WeekPlanCard({owner,profile,jobs,sources,allowMoment,onState,onOverlay,onTarget,requestOpen=false,onRequestConsumed}:{requestOpen?:boolean;onRequestConsumed:()=>void;owner:string;profile:CandidateProfile;jobs:JobRecord[];sources:{source:string;selected?:boolean;state?:string}[];allowMoment:boolean;onState:(state:WeekPlanState)=>void;onOverlay:(open:boolean)=>void;onTarget:(target:WeekTarget,action:WeekCommitment["action"])=>void}){
 const {queue,onAction:onNextAction}=useRadarNextSteps();
 const [state,setState]=useState<WeekPlanState>({version:profile.weekPlanRevision??0,plan:profile.weekPlan??null,history:profile.weekPlans??[]});
 const [ready,setReady]=useState(false),[error,setError]=useState(""),[busy,setBusy]=useState(false),[editor,setEditor]=useState(false),[moment,setMoment]=useState<"week"|"held"|null>(null),[clock,setClock]=useState(0),[pauseOpen,setPauseOpen]=useState(false);
 const lock=useRef(false),live=useRef(true),heldSeen=useRef(false);
 const deviceZone=clock?Intl.DateTimeFormat().resolvedOptions().timeZone:"UTC";
 const series=useWeekSeries(owner,state.version,deviceZone,!!clock),welcomeSeen=useRef<string|null>(null);
 const zone=series.state?.timeZone??deviceZone,week=clock?weekKey(clock,zone):"";
 const plan=state.plan?.week===week?state.plan:null,planBusy=busy||series.busy;
 const current=useRef(state);
 const accept=useCallback((next:WeekPlanState)=>{if(next.version<current.current.version)return;current.current=next;setState(next);onState(next);},[onState]);
 const load=useCallback(async()=>{setError("");setReady(false);try{const r=await fetch("/api/week-plan",{cache:"no-store",signal:AbortSignal.timeout(15000)});const data=await r.json() as WeekPlanState;if(!r.ok||!Number.isInteger(data.version)||!Array.isArray(data.history))throw new Error();if(live.current){accept(data);setReady(true);}}catch{if(live.current)setError("Votre plan ne peut pas être relu. Les engagements affichés sont la dernière version connue.");}},[accept]);
 useEffect(()=>{live.current=true;const frame=requestAnimationFrame(()=>{setClock(Date.now());void load();});const refresh=()=>{if(!lock.current){setClock(Date.now());void load();}};window.addEventListener("focus",refresh);const timer=window.setInterval(()=>setClock(Date.now()),60000);return()=>{live.current=false;cancelAnimationFrame(frame);window.removeEventListener("focus",refresh);window.clearInterval(timer);};},[load]);
 useEffect(()=>{onOverlay(editor||pauseOpen||!!moment);return()=>onOverlay(false);},[editor,pauseOpen,moment,onOverlay]);
 useEffect(()=>{
  if(!ready||!series.ready||!week||!allowMoment||requestOpen||editor||pauseOpen||moment||series.state?.welcomeSeen||welcomeSeen.current===week)return;
  const check=()=>{if(document.querySelector('[role="dialog"],.onboarding-tour'))return;welcomeSeen.current=week;setMoment("week");};
  const frame=requestAnimationFrame(check),observer=new MutationObserver(check);observer.observe(document.body,{childList:true,subtree:true});return()=>{cancelAnimationFrame(frame);observer.disconnect();};
 },[ready,series.ready,series.state?.welcomeSeen,week,owner,allowMoment,requestOpen,editor,pauseOpen,moment]);
 const targets=useMemo<WeekTarget[]>(()=>[...jobs.filter(job=>!job.deletedAt).map(job=>({id:job.id,type:"job" as const,label:`${job.company||"Entreprise à confirmer"} · ${job.title}`.slice(0,300)})),...sources.filter(source=>source.selected!==false&&source.state!=="paused").map(source=>({id:source.source,type:"source" as const,label:source.source})),...interviewThemes.map(theme=>({id:theme.id,type:"story" as const,label:theme.label}))],[jobs,sources]);
 const suggestions=useMemo(()=>{
  const out:Array<{action:WeekCommitment["action"];target:WeekTarget}>=[];
  for(const step of queue){
   const action=step.action;
   let kind:WeekCommitment["action"]|null=null,type:WeekTarget["type"]|null=null,id:string|undefined;
   if(action.type==="story"){kind="prepare";type="story";id=action.theme;}
   else if(action.type==="followups"){kind="followup";type="job";id=action.jobId;}
   else if(action.type==="care"){kind="care";type="job";id=action.jobId;}
   else if(action.type==="source"){kind="visit";type="source";id=action.source;}
   else if(action.type==="setting"&&action.setting.kind==="story"){kind="write";type="story";id=action.setting.target;}
   else if(action.type==="setting"&&action.setting.kind==="visit"){kind="visit";type="source";id=action.setting.target;}
   const target=targets.find(item=>item.id===id&&item.type===type);
   if(kind&&target&&!out.some(item=>item.action===kind&&item.target.type===type&&item.target.id===id))out.push({action:kind,target});
   if(out.length===3)break;
  }
  return out;
 },[queue,targets]);
 useEffect(()=>{
  if(!requestOpen||!ready||planBusy)return;
  const frame=requestAnimationFrame(()=>{setMoment(null);setEditor(true);onRequestConsumed();});
  return()=>cancelAnimationFrame(frame);
 },[requestOpen,ready,planBusy,onRequestConsumed]);
 async function write(command:PlanCommand):Promise<{ok:boolean;state?:WeekPlanState;error?:string}>{
  if(lock.current||series.busy)return {ok:false,error:"Un enregistrement est déjà en cours."};lock.current=true;setBusy(true);setError("");const key=crypto.randomUUID();sessionWrite(key,true);
  try{const response=await fetch("/api/week-plan",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(command),signal:AbortSignal.timeout(15000)});const data=await response.json() as WeekPlanState&{state?:WeekPlanState;error?:string};
   if(!response.ok){if(data.state)accept(data.state);return {ok:false,state:data.state,error:data.error??"Enregistrement non confirmé. Votre brouillon reste conservé."};}
   const wasHeld=planHeld(current.current.plan);accept(data);await series.load();
   if(!wasHeld&&planHeld(data.plan)){confirmedProgress({kind:"week_held",objectId:data.plan!.week,stamp:data.plan!.week});if(!heldSeen.current){heldSeen.current=true;setMoment("held");}}
   return {ok:true,state:data};
  }catch{return {ok:false,error:"Enregistrement non confirmé. Votre brouillon et les engagements déjà confirmés restent conservés."};}
  finally{sessionWrite(key,false);lock.current=false;setBusy(false);}
 }
 const completed=plan?.commitments.filter(item=>item.doneAt).length??0;
 const localNow=clock?localTimeInZone(clock,plan?.timeZone??zone):"";
 function markWelcome(){if(moment==="week")void series.write("welcome");}
 function edit(){markWelcome();setMoment(null);setEditor(true);}
 function closeMoment(){markWelcome();setMoment(null);requestAnimationFrame(()=>document.getElementById("week-plan-title")?.focus());}
 return <section className={`week-plan-card${planHeld(plan)?" is-held":""}`} aria-labelledby="week-plan-title" aria-busy={planBusy}>
  <WorkspacePanelHeader id="week-plan-title" title="Votre semaine" actions={plan?<WorkspaceButton disabled={!ready||planBusy} onClick={edit}>Modifier le plan</WorkspaceButton>:undefined}/>
  <WeekSeriesControls series={series} onOverlay={setPauseOpen}/>
  {!clock||!ready&&!error?<p role="status">Lecture du plan de la semaine…</p>:null}
  <WorkspaceFormError message={error}/>{error?<WorkspaceButton disabled={planBusy} onClick={()=>void load()}>Relire le plan</WorkspaceButton>:null}
  {plan?<details className="week-plan-details" open={!planHeld(plan)}><summary>{planHeld(plan)?"✓ Semaine tenue":"Vos engagements"}</summary><p role="status">{completed} engagement{completed>1?"s":""} tenu{completed>1?"s":""} sur {plan.commitments.length}{planHeld(plan)?" · Semaine tenue":""}</p><SignalProgress value={completed} max={plan.commitments.length} label="Engagements tenus cette semaine"/><ul className="week-commitments">{plan.commitments.map(item=><li key={item.id}><div className="week-commitment-main"><button type="button" role="checkbox" aria-checked={!!item.doneAt} aria-label={`Engagement tenu : ${item.label}`} className="week-check" disabled={!ready||planBusy} onClick={event=>{const trigger=event.currentTarget;void write({version:state.version,id:item.id,done:!item.doneAt}).then(result=>{if(!result.ok)setError(result.error??"Enregistrement non confirmé.");if(!planHeld(result.state?.plan))requestAnimationFrame(()=>{if(document.activeElement===document.body&&trigger.isConnected)trigger.focus();});});}}>{item.doneAt?<Check size={20} aria-hidden/>:null}</button><div><strong>{weekActions.find(action=>action.value===item.action)?.label} · {item.label}</strong><p>{new Date(item.when).toLocaleString("fr-FR",{weekday:"short",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}{commitmentOverdue(item,localNow)?" · À replanifier":""}</p><div className="week-commitment-actions">{item.targetId&&targets.some(t=>t.id===item.targetId&&t.type===item.targetType)?<WorkspaceButton disabled={planBusy} onClick={()=>onTarget({id:item.targetId!,type:item.targetType!,label:item.label},item.action)}>Ouvrir</WorkspaceButton>:null}{!item.doneAt?<WorkspaceButton disabled={!ready||planBusy} onClick={edit}>Déplacer</WorkspaceButton>:null}</div></div></div></li>)}</ul></details>:clock&&ready?<p>Deux à quatre engagements, à votre rythme.</p>:null}
  <SignalMoment open={!!moment&&!editor} onClose={closeMoment} title={moment==="held"?"Semaine tenue":series.state?.streak?"Nouvelle semaine":"Nouvelle semaine, page blanche"} description={moment==="held"?"Tous les engagements de votre plan sont cochés. Vous avez avancé à votre rythme.":"Choisissez un rythme qui vous convient. Vous pouvez aussi revenir plus tard."} actionLabel={moment==="held"?"Continuer":queue[0]?.label??"Revenir à Radar"} onAction={moment==="held"?closeMoment:()=>{if(queue[0]?.kind==="plan")edit();else{markWelcome();setMoment(null);if(queue[0])onNextAction(queue[0].action);}}}>{series.state?<SeriesSummary state={series.state}/>:null}{moment==="week"?<WorkspaceButton onClick={closeMoment}>Plus tard</WorkspaceButton>:null}</SignalMoment>
  {editor&&week?<WeekPlanEditor key={week} state={state} week={week} zone={zone} targets={targets} suggestions={suggestions} busy={planBusy} onSave={write} onClose={()=>setEditor(false)}/>:null}
 </section>;
}

function WeekPlanEditor({state,week,zone,targets,suggestions,busy,onSave,onClose}:{state:WeekPlanState;week:string;zone:string;targets:WeekTarget[];suggestions:Array<{action:WeekCommitment["action"];target:WeekTarget}>;busy:boolean;onSave:(command:PlanCommand)=>Promise<{ok:boolean;state?:WeekPlanState;error?:string}>;onClose:()=>void}){
 const [initial]=useState<{version:number;plan:WeekPlan}>(()=>({version:state.version,plan:state.plan?.week===week?state.plan:{week,timeZone:zone,rhythm:"regular" as const,commitments:Array.from({length:3},()=>({id:crypto.randomUUID(),when:localDateTime(),action:"prepare" as const,label:""}))}}));
 const draft=useSavedForm(`week-plan:${week}`,initial),[error,setError]=useState(""),[remote,setRemote]=useState<WeekPlanState|null>(null);
 const heading=useRef<HTMLHeadingElement>(null),opener=useRef<HTMLElement|null>(null);
 const plan=draft.value.plan;
 function update(id:string,change:Partial<WeekCommitment>){draft.setValue(value=>({...value,plan:{...value.plan,commitments:value.plan.commitments.map(item=>item.id===id?{...item,...change}:item)}}));}
 function rhythm(value:WeekPlan["rhythm"]){const count=weekRhythms.find(r=>r.value===value)!.count;draft.setValue(old=>({...old,plan:{...old.plan,rhythm:value,commitments:Array.from({length:count},(_,i)=>old.plan.commitments[i]??{id:crypto.randomUUID(),when:localDateTime(),action:"prepare",label:""})}}));}
 function suggest(action:WeekCommitment["action"],target:WeekTarget){const empty=plan.commitments.find(item=>!item.label.trim());if(empty)update(empty.id,{action,targetId:target.id,targetType:target.type,label:target.label});}
 async function save(version=draft.value.version){setError("");const result=await onSave({version,plan});if(result.ok){draft.save.document.confirmedElsewhere("");onClose();}else{setError(result.error??"Enregistrement non confirmé.");setRemote(result.state??null);}}
 return <Dialog open onOpenChange={open=>{if(!open&&!busy)onClose();}}><DialogContent className="week-plan-editor" showCloseButton={false} onOpenAutoFocus={event=>{event.preventDefault();opener.current=document.activeElement instanceof HTMLElement?document.activeElement:null;heading.current?.focus();}} onCloseAutoFocus={event=>{event.preventDefault();const target=opener.current?.isConnected&&opener.current!==document.body&&opener.current.getClientRects().length?opener.current:document.getElementById("week-plan-title");requestAnimationFrame(()=>target?.focus());}}><DialogHeader><DialogTitle ref={heading} tabIndex={-1}>Mon plan · {week}</DialogTitle><DialogDescription>Quand, quelle action, pour quoi. Les cases se cochent après l’action, sans envoi automatique.</DialogDescription></DialogHeader><WorkspaceButton className="absolute top-2 right-2" aria-label="Fermer" variant="quiet" disabled={busy} onClick={onClose}><X size={20} aria-hidden/></WorkspaceButton>
 <form onSubmit={event=>{event.preventDefault();void save();}}><ChoiceSelect label="Mon rythme" disabled={busy||!draft.ready} value={plan.rhythm} options={weekRhythms} onChange={rhythm}/><p className="signal-help">Horaires du plan · {plan.timeZone}. Les engagements restent dans cette semaine.</p>
 {suggestions.length?<div className="week-suggestions"><p>{suggestions.length} piste{suggestions.length>1?"s":""} depuis votre radar · touchez pour remplir une place vide</p>{suggestions.map(({action,target},index)=><WorkspaceButton key={index} disabled={busy||!draft.ready||plan.commitments.every(item=>item.label.trim())} onClick={()=>suggest(action,target)}>{weekActions.find(a=>a.value===action)?.label} · {target.label}</WorkspaceButton>)}</div>:null}
 {plan.commitments.map((item,index)=>{const available=targets.filter(t=>item.action==="visit"?t.type==="source":item.action==="write"?t.type==="story":t.type==="job");return <fieldset key={item.id} disabled={busy||!draft.ready}><legend>Engagement {index+1}</legend><DateTimePicker label={`Quand · engagement ${index+1}`} value={item.when} onChange={when=>update(item.id,{when})}/><ChoiceSelect label={`Je · engagement ${index+1}`} value={item.action} options={weekActions} onChange={action=>update(item.id,{action,targetId:undefined,targetType:undefined,label:""})}/><ChoiceSelect searchable label={`Pour · engagement ${index+1}`} value={item.targetId?`${item.targetType}:${item.targetId}`:"personal"} options={[{value:"personal",label:"Un engagement personnel"},...available.map(target=>({value:`${target.type}:${target.id}`,label:target.label}))]} onChange={value=>{const target=available.find(t=>`${t.type}:${t.id}`===value);update(item.id,{targetId:target?.id,targetType:target?.type,label:target?.label??""});}}/><label>Mon engagement<input required maxLength={300} value={item.label} onChange={event=>update(item.id,{label:event.target.value})} placeholder="Une action concrète, à votre mesure"/></label></fieldset>;})}
 <AutosaveStatus save={draft.save} draft/><WorkspaceFormError message={error}/>{remote?<details><summary>Comparer au plan enregistré</summary>{remote.plan?<ul>{remote.plan.commitments.map(item=><li key={item.id}>{item.when.replace("T"," à ")} · {item.label}{item.doneAt?" · tenu":""}</li>)}</ul>:<p>Aucun plan enregistré.</p>}<p>Votre brouillon reste au-dessus. Modifier la cible ou l’action d’un engagement déjà tenu retire sa coche.</p><WorkspaceButton disabled={busy||!draft.ready} onClick={()=>void save(remote.version)}>Enregistrer mon plan après comparaison</WorkspaceButton></details>:null}<div className="signal-save-actions"><WorkspaceButton disabled={busy} onClick={onClose}>Reprendre plus tard</WorkspaceButton><WorkspaceButton type="submit" variant="primary" busy={busy} disabled={!draft.ready||plan.commitments.some(item=>!item.label.trim()||!item.when)}>Enregistrer mon plan</WorkspaceButton></div></form>
 </DialogContent></Dialog>;
}
