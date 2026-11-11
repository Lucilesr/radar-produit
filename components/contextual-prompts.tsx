"use client";
import {useTabReturnRefresh} from "@/components/use-tab-return-refresh";
import {createContext,useCallback,useContext,useEffect,useRef,useState,type ReactNode} from "react";
import {WorkspaceButton,WorkspaceFormError} from "@/components/workspace-form";
import {HelpTooltip} from "@/components/help-tooltip";
import {useRadarNextSteps} from "@/components/next-steps-context";
import {nextContextualStep,type ContextualStep} from "@/lib/next-steps";
import {promptVisible,readPromptState,type PromptState} from "@/lib/contextual-prompts";
import {searchPreferences} from "@/lib/search-preferences";
import {requestError} from "@/lib/request-error";
import {sessionWrite} from "@/lib/session-write";
import type {CandidateProfile,JobRecord,SearchPreferences} from "@/lib/types";
import type {DailyLot} from "@/lib/daily-lot";
import type {SourceSetting} from "@/components/source-card";
import type {InterviewTheme} from "@/lib/radar-reach";
type Command={action:"later";key:string}|{action:"level";level:"confirmed"|"senior"|"lead"|"any"};
type Controller={state:PromptState;now:number;ready:boolean;busy:boolean;error:string;load:()=>Promise<void>;write:(command:Command)=>Promise<boolean>};
const Context=createContext<Controller>({state:{later:{}},now:0,ready:false,busy:false,error:"",load:async()=>{},write:async()=>false});
export function ContextualPromptsProvider({owner,now,onState,children}:{owner:string;now:number;onState:(state:PromptState,search?:SearchPreferences)=>void;children:ReactNode}){
 const [state,setState]=useState<PromptState>({later:{}}),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const confirmed=useRef<PromptState>({later:{}}),generation=useRef(0),lock=useRef(false),live=useRef(true),accept=useRef(onState);useEffect(()=>{accept.current=onState;},[onState]);
 const load=useCallback(async(silent=false)=>{if(lock.current)return;const request=++generation.current;if(!silent)setError("");try{const r=await fetch("/api/contextual-prompts",{cache:"no-store",signal:AbortSignal.timeout(15000)});if(!r.ok)throw new Error();const data=await r.json() as {state:PromptState};if(live.current&&generation.current===request){
   const previous=confirmed.current;
   const newer=Object.entries(data.state.later).filter(([key,until])=>until>(previous.later[key]??""));
   if(!silent||newer.length){
    const next=silent?{later:{...previous.later,...Object.fromEntries(newer)}}:data.state;
    confirmed.current=next;setState(next);accept.current(next);
   }
   setReady(true);
  }}catch{if(live.current&&generation.current===request&&!silent)setError("Vos propositions ne peuvent pas être relues. Vos choix restent conservés.");}},[]);
 useEffect(()=>{live.current=true;const frame=requestAnimationFrame(()=>void load());return()=>{live.current=false;generation.current++;cancelAnimationFrame(frame);};},[owner,load]);
 useTabReturnRefresh(`prompts:${owner}`,()=>void load(ready),!!owner);
 async function write(command:Command){if(lock.current)return false;lock.current=true;generation.current++;setBusy(true);setError("");const key=crypto.randomUUID();sessionWrite(key,true);
  try{const r=await fetch("/api/contextual-prompts",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(command),signal:AbortSignal.timeout(15000)});const data=await r.json() as {state?:PromptState;searchPreferences?:SearchPreferences;error?:string};if(!r.ok||!data.state)throw new Error(data.error??"Choix non confirmé. Réessayez quand la connexion revient.");confirmed.current=data.state;setState(data.state);setReady(true);accept.current(data.state,command.action==="level"?data.searchPreferences:undefined);requestAnimationFrame(()=>{if(document.activeElement===document.body)document.getElementById("workspace-title")?.focus({preventScroll:true});});return true;
  }catch(problem){setError(requestError(problem,"Choix non confirmé. Réessayez quand la connexion revient."));return false;}finally{sessionWrite(key,false);lock.current=false;setBusy(false);}
 }
 return <Context.Provider value={{state:readPromptState(state,now),now,ready,busy,error,load,write}}>{children}</Context.Provider>;
}
export function useContextualPrompts(){return useContext(Context);}
export function PromptReadError(){const controller=useContextualPrompts();return controller.error&&!controller.ready?<div className="contextual-prompt"><WorkspaceFormError message={controller.error}/><WorkspaceButton onClick={()=>void controller.load()}>Relire les propositions</WorkspaceButton></div>:null;}
export function ContextualPromptCard({step}:{step:ContextualStep|null}){
 const controller=useContextualPrompts(),{onAction}=useRadarNextSteps();
 if(!controller.ready)return <PromptReadError/>;
 if(!step||!promptVisible(controller.state,step.key,controller.now))return null;
 return <section className="contextual-prompt" aria-label={step.label} aria-busy={controller.busy}><div className="contextual-prompt-heading"><strong>{step.label}</strong><HelpTooltip label="Proposition au bon moment">« Plus tard » masque cette proposition pendant 7 jours.</HelpTooltip></div><div className="contextual-prompt-actions">{step.kind==="level"?<div className="contextual-level-choices" role="group" aria-label="Choisir le niveau visé">{([{value:"confirmed",label:"Confirmé"},{value:"senior",label:"Senior"},{value:"lead",label:"Lead"},{value:"any",label:"Peu importe"}] as const).map(choice=><WorkspaceButton key={choice.value} disabled={controller.busy} onClick={()=>void controller.write({action:"level",level:choice.value})}>{choice.label}</WorkspaceButton>)}</div>:step.action?<WorkspaceButton disabled={controller.busy} onClick={()=>onAction(step.action!)}>{step.kind==="interview"?"Ouvrir mon carnet":step.kind==="lesson"?"En faire une histoire":"Voir cette source"}</WorkspaceButton>:null}<WorkspaceButton variant="quiet" disabled={controller.busy} onClick={()=>void controller.write({action:"later",key:step.key})}>Plus tard</WorkspaceButton></div><WorkspaceFormError message={controller.error}/></section>;
}
export function OfferContextPrompt({lot,profile,sources}:{lot:DailyLot|null|undefined;profile:CandidateProfile;sources:SourceSetting[]}){
 const controller=useContextualPrompts(),{queue}=useRadarNextSteps(),search=searchPreferences(profile.searchPreferences);
 const step=nextContextualStep({context:"offers",now:controller.now,prompts:controller.state,queue,lot,sources,levelSet:!!search.targetLevel||!!search.targetLevelAny});
 return <ContextualPromptCard step={step}/>;
}
export function InterviewContextPrompt({jobs,doneThemes=[]}:{jobs:JobRecord[];doneThemes?:InterviewTheme[]}){const controller=useContextualPrompts();return <ContextualPromptCard step={nextContextualStep({context:"interviews",now:controller.now,prompts:controller.state,jobs,doneThemes})}/>;}
export function LessonStoryPrompt({jobId}:{jobId:string}){const controller=useContextualPrompts();return <ContextualPromptCard step={nextContextualStep({context:"lesson",now:controller.now,prompts:controller.state,objectId:jobId})}/>;}
