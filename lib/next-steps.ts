import {dueFollowups} from "./application-followup";
import {careCount} from "./application-care";
import {hasApplication,reviewState} from "./opportunity-views";
import {upcomingInterviews} from "./workspace-agenda";
import {interviewThemes,type InterviewTheme,type ReachAction,type ReachSource} from "./radar-reach";
import {validTimeZone,weekKey,type WeekPlan} from "./week-plan";
import type {JobRecord} from "./types";

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
 sources:readonly NextStepSource[];modeOf:(name:string)=>string|undefined;confirmedFollowups?:readonly string[];
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
 const imminent=upcomingInterviews(jobs,now).find(({event})=>Number.isFinite(Date.parse(event.startAt))&&Date.parse(event.startAt)<=now+48*3600000);
 if(imminent){
  const theme=interviewThemes.find(item=>!reach?.doneThemes.includes(item.id))??interviewThemes[0];
  add({id:"interview:"+imminent.event.id,kind:"interview",label:"Préparer une histoire pour votre entretien",minutes:5,action:{type:"story",theme:theme.id,jobId:imminent.job.id}});
 }
 const due=dueFollowups(jobs,now,input.confirmedFollowups??[]);
 if(due.length)add({id:"followups",kind:"followups",label:due.length===1?"Faire cette relance":"Faire "+due.length+" relances",minutes:3*due.length,action:{type:"followups",jobId:due[0].job.id,view:due[0].kind==="interview"?"interviews":"application"}});
 const remaining=Math.max(0,Math.min(20,Math.floor(input.lotRemaining)));
 if(Number.isFinite(remaining)&&remaining)add({id:"daily-lot",kind:"triage",label:"Trier votre lot du jour",minutes:remaining,action:{type:"triage"}});
 const zone=validTimeZone(input.timeZone)?input.timeZone:"UTC";
 // Monday starts a new plan; a plan already confirmed for that week is done.
 if(!input.plan||input.plan.week!==weekKey(now,zone))add({id:"week-plan",kind:"plan",label:"Poser votre plan de la semaine",minutes:5,action:{type:"plan"}});
 const care=jobs.filter(job=>!job.deletedAt&&!hasApplication(job)&&!job.appliedAt&&reviewState(job)==="selected"&&careCount(job.applicationCare)<3&&!["rejected","withdrawn","closed","offer"].includes(job.status))
  .sort((a,b)=>(b.fit??0)-(a.fit??0)||a.id.localeCompare(b.id))[0];
 if(care)add({id:"care:"+care.id,kind:"care",label:"Soigner une candidature de votre sélection",minutes:5,action:{type:"care",jobId:care.id}});
 if(reach?.next)add({id:"setting:"+reach.next.kind,kind:"setting",label:reach.next.label,minutes:reach.next.minutes,action:{type:"setting",setting:{...reach.next}}});
 const source=[...new Map(input.sources.map(item=>[item.source,item])).values()].filter(item=>item.selected!==false&&item.state!=="paused"&&item.remindInToday!==false&&["web","research","email"].includes(input.modeOf(item.source)??"")&&(!Number.isFinite(Date.parse(item.lastVisitedAt??""))||now-Date.parse(item.lastVisitedAt!)>=7*86400000))
  .sort((a,b)=>(Date.parse(a.lastVisitedAt??"")||0)-(Date.parse(b.lastVisitedAt??"")||0)||a.source.localeCompare(b.source,"fr"))[0];
 if(source)add({id:"source:"+source.source,kind:"sources",label:"Faire le tour de "+source.source,minutes:3,action:{type:"source",source:source.source}});
 return out;
}
