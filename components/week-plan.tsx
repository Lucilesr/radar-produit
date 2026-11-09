"use client";
import {useCallback,useEffect,useId,useMemo,useRef,useState} from "react";
import {Check,X} from "lucide-react";
import {useRadarNextSteps} from "@/components/next-steps-context";
import {useIsMobile} from "@/hooks/use-mobile";
import {ChoiceSelect} from "@/components/choice-select";
import {DateTimePicker} from "@/components/date-picker";
import {Dialog,DialogContent,DialogTitle,DialogDescription} from "@/components/ui/dialog";
import {useSavedForm,AutosaveStatus} from "@/components/autosave";
import {SignalMoment} from "@/components/signal/signal-moment";
import {WorkspaceButton,WorkspaceFormError} from "@/components/workspace-form";
import {weekKey,weekRhythms,weekActions,weekActionDescription,planHeld,commitmentOverdue,localDateTime,localTimeInZone,type WeekPlan,type WeekPlanState,type WeekCommitment} from "@/lib/week-plan";
import {useWeekSeries,WeekSeriesControls,SeriesSummary} from "@/components/week-series";
import {weekMonday} from "@/lib/week-series";
import {confirmedProgress} from "@/lib/progress-event";
import {sessionWrite} from "@/lib/session-write";
import {interviewThemes} from "@/lib/radar-reach";
import type {CandidateProfile,JobRecord} from "@/lib/types";
export type WeekTarget={id:string;type:"job"|"source"|"story";label:string};
type PlanCommand={version:number;plan?:WeekPlan;id?:string;done?:boolean};
export function WeekPlanCard({owner,profile,jobs,sources,allowMoment,onState,onOverlay,onTarget,requestOpen=false,onRequestConsumed}:{requestOpen?:boolean;onRequestConsumed:()=>void;owner:string;profile:CandidateProfile;jobs:JobRecord[];sources:{source:string;selected?:boolean;state?:string}[];allowMoment:boolean;onState:(state:WeekPlanState)=>void;onOverlay:(open:boolean)=>void;onTarget:(target:WeekTarget,action:WeekCommitment["action"])=>void}){
 const {queue,onAction:onNextAction}=useRadarNextSteps();
 const mobile=useIsMobile();
 const [state,setState]=useState<WeekPlanState>({version:profile.weekPlanRevision??0,plan:profile.weekPlan??null,history:profile.weekPlans??[]});
 const [ready,setReady]=useState(false),[error,setError]=useState(""),[busy,setBusy]=useState(false),[editor,setEditor]=useState(false),[moment,setMoment]=useState<"week"|"held"|null>(null),[clock,setClock]=useState(0),[pauseOpen,setPauseOpen]=useState(false);
 const lock=useRef(false),live=useRef(true),heldSeen=useRef(false);
 const deviceZone=clock?Intl.DateTimeFormat().resolvedOptions().timeZone:"UTC";
 const series=useWeekSeries(owner,state.version,deviceZone,!!clock),welcomeSeen=useRef<string|null>(null);
 const zone=series.state?.timeZone??deviceZone,week=clock?weekKey(clock,zone):"";
 const plan=state.plan?.week===week?state.plan:null,planBusy=busy||series.busy;
 const current=useRef(state);
 const accept=useCallback((next:WeekPlanState)=>{if(next.version<current.current.version)return;current.current=next;setState(next);onState(next);},[onState]);
 const load=useCallback(async()=>{setError("");setReady(false);try{const r=await fetch("/api/week-plan",{cache:"no-store",signal:AbortSignal.timeout(15000)});const data=await r.json() as WeekPlanState;if(!r.ok||!Number.isInteger(data.version)||!Array.isArray(data.history))throw new Error();if(live.current){accept(data);setReady(true);}}catch{if(live.current)setError("Votre plan ne peut pas être relu. Les actions affichées sont la dernière version connue.");}},[accept]);
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
   else if(action.type==="interview"){kind="prepare";type="job";id=action.jobId;}
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
  }catch{return {ok:false,error:"Enregistrement non confirmé. Votre brouillon et les actions déjà confirmées restent conservés."};}
  finally{sessionWrite(key,false);lock.current=false;setBusy(false);}
 }
 const completed=plan?.commitments.filter(item=>item.doneAt).length??0;
 const localNow=clock?localTimeInZone(clock,plan?.timeZone??zone):"";
 function markWelcome(){if(moment==="week")void series.write("welcome");}
 function edit(){markWelcome();setMoment(null);setEditor(true);}
 function closeMoment(){markWelcome();setMoment(null);requestAnimationFrame(()=>document.getElementById("week-plan-title")?.focus());}
 function commitments(items:WeekCommitment[]){return <ul className="week-commitments">{items.map(item=><li key={item.id} className={item.doneAt?"is-done":""}><div className="week-commitment-main"><button id={`week-check-${item.id}`} type="button" role="checkbox" aria-checked={!!item.doneAt} aria-label={`Action réalisée : ${weekActionDescription(item)}`} className="week-check" disabled={!ready||planBusy} onClick={()=>{void write({version:state.version,id:item.id,done:!item.doneAt}).then(result=>{if(!result.ok)setError(result.error??"Enregistrement non confirmé.");requestAnimationFrame(()=>{if(document.activeElement!==document.body)return;const check=document.getElementById(`week-check-${item.id}`);(check?.getClientRects().length?check:document.getElementById("week-plan-title"))?.focus();});});}}>{item.doneAt?<Check size={18} aria-hidden/>:null}</button><div className="week-commitment-label"><span>{new Date(item.when).toLocaleString("fr-FR",{weekday:"long",hour:"2-digit",minute:"2-digit"})} · {weekActionDescription(item)}</span></div></div></li>)}</ul>;}
 return <section className={`week-plan-card${planHeld(plan)?" is-held":""}`} aria-labelledby="week-plan-title" aria-busy={planBusy}>
  <div className="week-compact-heading"><h2 id="week-plan-title" tabIndex={-1}>Votre semaine</h2>{series.state?<strong className="week-series-badge">{series.state.streak} semaine{series.state.streak!==1?"s":""} tenue{series.state.streak!==1?"s":""}</strong>:null}</div>
  {ready&&plan?.commitments.length?<p className="week-compact-overview" role="status">{completed} action{completed!==1?"s réalisées":" réalisée"} sur {plan.commitments.length}{planHeld(plan)?" · semaine tenue":""}</p>:null}
  {!clock||!ready&&!error?<p role="status">Lecture du plan de la semaine…</p>:null}
  <WorkspaceFormError message={error}/>{error?<WorkspaceButton disabled={planBusy} onClick={()=>void load()}>Relire le plan</WorkspaceButton>:null}
  {plan?.commitments.length?<>{commitments(plan.commitments.filter(item=>!item.doneAt))}{completed?<details className="week-completed" open={!mobile}><summary>✓ {completed} action{completed!==1?"s réalisées":" réalisée"} <span aria-hidden>▸</span></summary>{commitments(plan.commitments.filter(item=>item.doneAt))}</details>:null}</>:clock&&ready?<div className="week-no-plan"><p>{plan?"Aucune action planifiée cette semaine":"Nouvelle semaine, page blanche"}</p><WorkspaceButton disabled={planBusy} onClick={edit}>Planifier mes actions · 3 min</WorkspaceButton></div>:null}
  <details className="week-settings"><summary>Réglages de la semaine <span aria-hidden>▸</span></summary>{plan?.commitments.length?<WorkspaceButton disabled={!ready||planBusy} onClick={edit}>Modifier le plan</WorkspaceButton>:null}<WeekSeriesControls compact series={series} onOverlay={setPauseOpen}/>{plan?.commitments.length?<ul>{plan.commitments.filter(item=>!item.doneAt).map(item=><li key={item.id}><span>{weekActionDescription(item)}{commitmentOverdue(item,localNow)?" · À replanifier":""}</span><div>{item.targetId&&targets.some(t=>t.id===item.targetId&&t.type===item.targetType)?<WorkspaceButton disabled={planBusy} onClick={()=>onTarget({id:item.targetId!,type:item.targetType!,label:item.targetLabel??item.label},item.action)}>Ouvrir</WorkspaceButton>:null}<WorkspaceButton disabled={!ready||planBusy} onClick={edit}>Déplacer</WorkspaceButton></div></li>)}</ul>:null}</details>
  <SignalMoment open={!!moment&&!editor} onClose={closeMoment} title={moment==="held"?"Semaine tenue":series.state?.streak?"Nouvelle semaine":"Nouvelle semaine, page blanche"} description={moment==="held"?"Toutes les actions de votre plan sont cochées. Vous avez avancé à votre rythme.":"Choisissez un rythme qui vous convient. Vous pouvez aussi revenir plus tard."} actionLabel={moment==="held"?"Continuer":queue[0]?.label??"Revenir à Radar"} onAction={moment==="held"?closeMoment:()=>{if(queue[0]?.kind==="plan")edit();else{markWelcome();setMoment(null);if(queue[0])onNextAction(queue[0].action);}}}>{series.state?<SeriesSummary state={series.state}/>:null}{moment==="week"?<WorkspaceButton onClick={closeMoment}>Plus tard</WorkspaceButton>:null}</SignalMoment>
  {editor&&week?<WeekPlanEditor key={week} state={state} week={week} zone={zone} targets={targets} suggestions={suggestions} busy={planBusy} onSave={write} onClose={()=>setEditor(false)}/>:null}
 </section>;
}

/* "2026-W46" becomes "semaine du 9 novembre"; the ISO key stays the fallback. */
function weekLabel(week:string){const monday=weekMonday(week);return monday?`semaine du ${new Intl.DateTimeFormat("fr-FR",{day:"numeric",month:"long",timeZone:"UTC"}).format(monday)}`:week;}

type DraftAction=WeekCommitment&{edited?:true};
type DraftPlan=Omit<WeekPlan,"commitments">&{commitments:DraftAction[]};
function emptyAction():DraftAction{return {id:crypto.randomUUID(),when:localDateTime(),action:"prepare",label:""};}
function startedAction(item:DraftAction){return !!(item.edited||item.label.trim()||item.targetId||item.action!=="prepare");}
function fillActionSlots(plan:DraftPlan):DraftPlan{
 const count=weekRhythms.find(rhythm=>rhythm.value===plan.rhythm)!.count;
 return {...plan,commitments:Array.from({length:count},(_,index)=>plan.commitments[index]??emptyAction())};
}

function WeekPlanEditor({state,week,zone,targets,suggestions,busy,onSave,onClose}:{state:WeekPlanState;week:string;zone:string;targets:WeekTarget[];suggestions:Array<{action:WeekCommitment["action"];target:WeekTarget}>;busy:boolean;onSave:(command:PlanCommand)=>Promise<{ok:boolean;state?:WeekPlanState;error?:string}>;onClose:()=>void}){
 const [initial]=useState(()=>({version:state.version,plan:fillActionSlots(state.plan?.week===week?{...state.plan,commitments:state.plan.commitments.map(item=>({...item,edited:true}))}:{week,timeZone:zone,rhythm:"regular",commitments:[]})}));
 const draft=useSavedForm(`week-plan:${week}`,initial),[error,setError]=useState(""),[remote,setRemote]=useState<WeekPlanState|null>(null);
 const heading=useRef<HTMLHeadingElement>(null),opener=useRef<HTMLElement|null>(null);
 const actionId=useId();
 function separateTarget(item:DraftAction):DraftAction{
  if(!item.targetId||item.targetLabel!==undefined)return item;
  const target=targets.find(candidate=>candidate.id===item.targetId&&candidate.type===item.targetType);
  return target?{...item,targetLabel:target.label,label:item.label===target.label?"":item.label}:item;
 }
 const plan={...draft.value.plan,commitments:draft.value.plan.commitments.map(separateTarget)};
 const started=plan.commitments.filter(startedAction);
 const emptyIndex=plan.commitments.findIndex(item=>!startedAction(item));
 const availableSuggestions=emptyIndex<0?[]:suggestions.filter(({action,target})=>!started.some(item=>item.action===action&&item.targetType===target.type&&item.targetId===target.id));
 const canSave=draft.ready&&!busy&&(started.length>0||state.plan?.week===week&&!!state.plan.commitments.length)&&started.every(item=>item.when);

 function focusAction(index:number){requestAnimationFrame(()=>document.getElementById(`${actionId}-${index}`)?.focus());}
 function update(id:string,change:Partial<WeekCommitment>){draft.setValue(value=>({...value,plan:{...value.plan,commitments:value.plan.commitments.map(item=>item.id===id?{...separateTarget(item),...change,edited:true}:item)}}));}
 function clear(id:string,index:number){
  draft.setValue(value=>({...value,plan:{...value.plan,commitments:value.plan.commitments.map(item=>item.id===id?emptyAction():item)}}));
  focusAction(index);
 }
 function rhythm(value:WeekPlan["rhythm"]){
  draft.setValue(old=>({...old,plan:fillActionSlots({...old.plan,rhythm:value,commitments:[...started,...old.plan.commitments.filter(item=>!startedAction(item))]})}));
 }
 function suggest(action:WeekCommitment["action"],target:WeekTarget){
  update(plan.commitments[emptyIndex].id,{action,targetId:target.id,targetType:target.type,targetLabel:target.label});
  focusAction(emptyIndex);
 }
 async function save(version=draft.value.version){
  if(!canSave)return;
  setError("");
  const result=await onSave({version,plan:{...plan,commitments:started.map(({edited,...item})=>item)}});
  if(result.ok){draft.save.document.confirmedElsewhere("");onClose();}else{setError(result.error??"Enregistrement non confirmé.");setRemote(result.state??null);}
 }
 return <Dialog open onOpenChange={open=>{if(!open&&!busy)onClose();}}><DialogContent className="week-plan-editor" showCloseButton={false} onOpenAutoFocus={event=>{event.preventDefault();opener.current=document.activeElement instanceof HTMLElement?document.activeElement:null;heading.current?.focus();}} onCloseAutoFocus={event=>{event.preventDefault();const target=opener.current?.isConnected&&opener.current!==document.body&&opener.current.getClientRects().length?opener.current:document.getElementById("week-plan-title");requestAnimationFrame(()=>target?.focus());}}><div className="week-plan-head"><DialogTitle ref={heading} tabIndex={-1}>Mon plan · {weekLabel(week)}</DialogTitle><WorkspaceButton className="week-plan-close" aria-label="Fermer" variant="quiet" disabled={busy} onClick={onClose}><X size={20} aria-hidden/></WorkspaceButton></div><DialogDescription className="week-plan-description">C’est parti pour planifier votre semaine !<br/>Quand ? Quelle action ? Pour quelle offre ? Écrivons cela ensemble !</DialogDescription>
 <form onSubmit={event=>{event.preventDefault();void save();}}><div className="week-plan-rhythm"><ChoiceSelect label="Mon rythme" disabled={busy||!draft.ready} value={plan.rhythm} options={weekRhythms} onChange={rhythm}/></div>
 {availableSuggestions.length?<div className="week-suggestions"><p>Suggestions du radar · choisissez-en une pour préremplir une action</p>{availableSuggestions.map(({action,target})=><WorkspaceButton key={`${action}:${target.type}:${target.id}`} disabled={busy||!draft.ready} onClick={()=>suggest(action,target)}>{weekActions.find(a=>a.value===action)?.label} · {target.label}</WorkspaceButton>)}</div>:null}
 {plan.commitments.map((item,index)=>{
  const targetField=item.action==="visit"?{type:"source",label:"Source"}:item.action==="write"?{type:"story",label:"Histoire"}:{type:"job",label:"Offre"};
  const chosenTarget=targets.find(target=>target.id===item.targetId&&target.type===item.targetType);
  const available=targets.filter(target=>target.type===targetField.type||target===chosenTarget);
  return <fieldset key={item.id} disabled={busy||!draft.ready}>
   <legend>Action {index+1}</legend>
   <DateTimePicker label="Jour" value={item.when} onChange={when=>update(item.id,{when})}/>
   <ChoiceSelect label="Action" value={item.action} options={weekActions} onChange={action=>update(item.id,{action,targetId:undefined,targetType:undefined,targetLabel:undefined})}/>
   <div className="week-action-target">
    <ChoiceSelect searchable label={targetField.label} value={item.targetId?`${item.targetType}:${item.targetId}`:"personal"}
     displayValue={chosenTarget?undefined:item.targetLabel}
     options={[{value:"personal",label:"Une action personnelle"},...available.map(target=>({value:`${target.type}:${target.id}`,label:target.label}))]}
     onChange={value=>{const target=available.find(candidate=>`${candidate.type}:${candidate.id}`===value);update(item.id,{targetId:target?.id,targetType:target?.type,targetLabel:target?.label});}}/>
   </div>
   <div className="week-action-entry">
    <label><span className="form-control-label">Précision</span><input id={`${actionId}-${index}`} maxLength={300} value={item.label} onChange={event=>update(item.id,{label:event.target.value})} placeholder="Ex. : relancer Marie par mail"/></label>
    {startedAction(item)?<WorkspaceButton variant="quiet" aria-label={`Vider l’action ${index+1}`} onClick={()=>clear(item.id,index)}>Vider</WorkspaceButton>:null}
   </div>
  </fieldset>;
 })}
 <AutosaveStatus save={draft.save} draft/><WorkspaceFormError message={error}/>{remote?<details><summary>Comparer au plan enregistré</summary>{remote.plan?.commitments.length?<ul>{remote.plan.commitments.map(item=><li key={item.id}>{item.when.replace("T"," à ")} · {weekActionDescription(item)}{item.doneAt?" · réalisée":""}</li>)}</ul>:<p>Aucun plan enregistré.</p>}<p>Votre brouillon reste au-dessus. Modifier la précision, le type ou la cible d’une action déjà réalisée retire sa coche.</p><WorkspaceButton disabled={!canSave} onClick={()=>void save(remote.version)}>Enregistrer mon plan après comparaison</WorkspaceButton></details>:null}<div className="signal-save-actions"><WorkspaceButton disabled={busy} onClick={onClose}>Reprendre plus tard</WorkspaceButton><WorkspaceButton type="submit" variant="primary" busy={busy} disabled={!canSave}>Enregistrer mon plan</WorkspaceButton></div></form>
 </DialogContent></Dialog>;
}
