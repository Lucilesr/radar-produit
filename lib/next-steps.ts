import {dueFollowups} from "./application-followup";
import {careCount} from "./application-care";
import {hasApplication,reviewState} from "./opportunity-views";
import {upcomingInterviews} from "./workspace-agenda";
import {interviewThemes,type InterviewTheme,type ReachAction,type ReachSource} from "./radar-reach";
import {validTimeZone,weekKey,type WeekPlan} from "./week-plan";
import type {JobRecord} from "./types";
import {detectLevel} from "./seniority";
import {promptVisible,type PromptState} from "./contextual-prompts";

export type NextStepKind="interview"|"followups"|"triage"|"plan"|"care"|"setting"|"sources";
export type NextStepAction=
 |{type:"story";theme:InterviewTheme;jobId:string}
 |{type:"followups";jobId:string;view:"application"|"interviews"}
 |{type:"triage"}
 |{type:"plan"}
 |{type:"care";jobId:string}
 |{type:"setting";setting:ReachAction}
 |{type:"source";source:string};
export type NextStep={id:string;kind:NextStepKind;label:string;minutes:number;action:NextStepAction};
export type NextStepSource=ReachSource&{remindInToday?:boolean};
export type NextStepInput={
 now:number;timeZone:string;jobs:readonly JobRecord[];lotRemaining:number;plan?:WeekPlan|null;
 reach:{next:ReachAction|null;doneThemes:readonly InterviewTheme[]}|null;
 sources:readonly NextStepSource[];modeOf:(name:string)=>string|undefined;confirmedFollowups?:readonly string[];prompts?:PromptState;
};
/** One identity for the same work, even when it also improves a radar setting. */
export function nextStepActionKey(action:NextStepAction){
 if(action.type==="source")return "source:"+action.source;
 if(action.type==="story")return "story:"+action.theme;
 if(action.type==="care"||action.type==="followups")return action.type+":"+action.jobId;
 if(action.type==="setting"){
  if(action.setting.kind==="visit"&&action.setting.target)return "source:"+action.setting.target;
  if(action.setting.kind==="story"&&action.setting.target)return "story:"+action.setting.target;
  return "setting:"+action.setting.kind;
 }
 return action.type;
}
/** Explicit clock and calendar, no storage, network or mutation of the account. */
export function nextSteps(input:NextStepInput):NextStep[]{
 const {now,reach}=input;if(!Number.isFinite(now)||now<=0)return [];
 const jobs=[...new Map(input.jobs.map(job=>[job.id,job])).values()];
 const out:NextStep[]=[],seen=new Set<string>();
 const add=(step:NextStep)=>{const key=nextStepActionKey(step.action);if(!seen.has(key)){seen.add(key);out.push(step);}};
 const imminent=upcomingInterviews(jobs,now).find(({event})=>Number.isFinite(Date.parse(event.startAt))&&Date.parse(event.startAt)<=now+48*3600000&&promptVisible(input.prompts,"interview:"+event.id,now));
 if(imminent){
  const theme=interviewThemes.find(item=>!reach?.doneThemes.includes(item.id))??interviewThemes[0];
  add({id:"interview:"+imminent.event.id,kind:"interview",label:"Préparer une histoire pour votre entretien chez "+(imminent.job.company||imminent.job.title),minutes:5,action:{type:"story",theme:theme.id,jobId:imminent.job.id}});
 }
 const due=dueFollowups(jobs,now,input.confirmedFollowups??[]);
 if(due.length)add({id:"followups",kind:"followups",label:"Relancer "+(due[0].job.company||due[0].job.title)+(due.length>1?` et ${due.length-1} autre${due.length>2?"s":""}`:""),minutes:3*due.length,action:{type:"followups",jobId:due[0].job.id,view:due[0].kind==="interview"?"interviews":"application"}});
 const remaining=Math.max(0,Math.min(20,Math.floor(input.lotRemaining)));
 if(Number.isFinite(remaining)&&remaining)add({id:"daily-lot",kind:"triage",label:"Trier votre lot du jour",minutes:remaining,action:{type:"triage"}});
 const zone=validTimeZone(input.timeZone)?input.timeZone:"UTC";
 // Monday starts a new plan; a plan already confirmed for that week is done.
 if(!input.plan||input.plan.week!==weekKey(now,zone))add({id:"week-plan",kind:"plan",label:"Poser votre plan de la semaine",minutes:5,action:{type:"plan"}});
 const care=jobs.filter(job=>!job.deletedAt&&!hasApplication(job)&&!job.appliedAt&&reviewState(job)==="selected"&&careCount(job.applicationCare)<3&&!["rejected","withdrawn","closed","offer"].includes(job.status))
  .sort((a,b)=>(b.fit??0)-(a.fit??0)||a.id.localeCompare(b.id))[0];
 if(care)add({id:"care:"+care.id,kind:"care",label:"Compléter la check-list chez "+(care.company||care.title),minutes:5,action:{type:"care",jobId:care.id}});
 if(reach?.next&&(reach.next.kind!=="level"||promptVisible(input.prompts,"level",now))&&(reach.next.kind!=="visit"||!reach.next.target||promptVisible(input.prompts,"source:"+reach.next.target,now)))add({id:"setting:"+reach.next.kind,kind:"setting",label:reach.next.label,minutes:reach.next.minutes,action:{type:"setting",setting:{...reach.next}}});
 const source=[...new Map(input.sources.map(item=>[item.source,item])).values()].filter(item=>item.selected!==false&&item.state!=="paused"&&item.remindInToday!==false&&promptVisible(input.prompts,"source:"+item.source,now)&&["web","research","email"].includes(input.modeOf(item.source)??"")&&(!Number.isFinite(Date.parse(item.lastVisitedAt??""))||now-Date.parse(item.lastVisitedAt!)>=7*86400000))
  .sort((a,b)=>(Date.parse(a.lastVisitedAt??"")||0)-(Date.parse(b.lastVisitedAt??"")||0)||a.source.localeCompare(b.source,"fr"))[0];
 if(source&&promptVisible(input.prompts,"source:"+source.source,now))add({id:"source:"+source.source,kind:"sources",label:"Faire le tour de "+source.source,minutes:3,action:{type:"source",source:source.source}});
 return out;
}

export type ContextualStep={key:string;kind:"level"|"interview"|"source"|"lesson"|"terms";label:string;action?:NextStepAction};
/** Context decides where the P4 work is offered, never a separate task ranking. */
export function nextContextualStep(input:{context:"offers"|"interviews"|"lesson"|"terms";now:number;prompts?:PromptState;queue?:readonly NextStep[];jobs?:readonly JobRecord[];levelSet?:boolean;lot?:{size:number;remaining:readonly JobRecord[]}|null;sources?:readonly NextStepSource[];modeOf?:(name:string)=>string|undefined;objectId?:string;doneThemes?:readonly InterviewTheme[]}):ContextualStep|null{
 const {now,prompts}=input;if(!Number.isFinite(now)||now<=0)return null;
 const visible=(step:ContextualStep)=>promptVisible(prompts,step.key,now)?step:null;
 if(input.context==="terms"&&input.objectId)return visible({key:"terms:"+input.objectId,kind:"terms",label:"Termes repérés dans votre carnet"});
 if(input.context==="lesson"&&input.objectId)return visible({key:"lesson:"+input.objectId,kind:"lesson",label:"En faire une histoire ?",action:{type:"story",theme:"prioriser",jobId:input.objectId}});
 if(input.context==="interviews"){
  const planned=upcomingInterviews([...(input.jobs??[])],now).find(({event})=>promptVisible(prompts,"interview:"+event.id,now));
  if(!planned)return null;
  const theme=interviewThemes.find(item=>!input.doneThemes?.includes(item.id))??interviewThemes[0];
  return {key:"interview:"+planned.event.id,kind:"interview",label:"Préparez l’histoire qui va avec · 5 min",action:{type:"story",theme:theme.id,jobId:planned.job.id}};
 }
 if(input.context==="offers"&&input.lot?.size){
  const senior=input.lot.remaining.some(job=>["senior","lead"].includes(detectLevel(job.title,job.description)?.level??""));
  if(senior&&!input.levelSet&&promptVisible(prompts,"level",now))return {key:"level",kind:"level",label:"Quel niveau visez-vous ?"};
  if(!input.lot.remaining.length){
   const source=(input.queue??[]).find(step=>step.action.type==="source"||step.action.type==="setting"&&step.action.setting.kind==="visit"&&step.action.setting.target);
   const name=source?.action.type==="source"?source.action.source:source?.action.type==="setting"?source.action.setting.target:undefined;
   if(!name)return null;
   const setting=input.sources?.find(item=>item.source===name),last=Date.parse(setting?.lastVisitedAt??"");
   const detail=Number.isFinite(last)?Math.floor((now-last)/86400000)+" jours sans visite":"jamais visitée";
   return visible({key:"source:"+name,kind:"source",label:"Faites le tour de "+name+" · "+detail,action:{type:"source",source:name}});
  }
 }
 return null;
}
