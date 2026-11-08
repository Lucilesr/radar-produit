import {dueFollowups,confirmedSessionFollowups} from "./application-followup";
import type { JobRecord } from "./types";

export type SessionStep = "triage" | "followups" | "sources" | "validation";
export const sessionLabels: Record<SessionStep,string> = {triage:"Trier le lot",followups:"Relancer",sources:"Visiter une source",validation:"Valider un bloc"};
export type SessionSource = {source:string;selected?:boolean;state?:string;lastVisitedAt?:string};
export type SessionFact = {id:string;validation:string;parentId?:string|null};
export type SessionSnapshot = {decisions:Record<string,string>;visits:Record<string,string>;approved:string[]};
export type RadarSession = {id:string;day:string;startedAt:number;activeMs:number;resumedAt:number|null;steps:SessionStep[];current:number;initial:SessionSnapshot;sent:string[];paused:boolean};
export type SessionProgress = {sorted:number;followups:number;visited:number;validated:number;total:number;minutes:number;gemId?:string};
export function sessionDay(now:number){const d=new Date(now);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;}
function decision(job:JobRecord){return job.deletedAt?"discarded":job.reviewState==="later"?"later":job.reviewState==="selected"||["shortlist","prepare","ready","applied","interview","awaiting_response","next_step","offer","rejected","withdrawn"].includes(job.status)?"selected":"pending";}
export function sessionSnapshot(jobs:readonly JobRecord[],sources:readonly SessionSource[],facts:readonly SessionFact[]):SessionSnapshot {
  return {decisions:Object.fromEntries(jobs.map(job=>[job.id,decision(job)])),visits:Object.fromEntries(sources.map(source=>[source.source,source.lastVisitedAt??""])),approved:facts.filter(fact=>fact.validation==="approved"&&(!fact.parentId||facts.find(parent=>parent.id===fact.parentId)?.validation!=="rejected")).map(fact=>fact.id)};
}
export function sessionVisits(sources:readonly SessionSource[],modeOf:(source:string)=>string|undefined,now:number){return sources.filter(source=>source.selected!==false&&source.state!=="paused"&&["web","research","email"].includes(modeOf(source.source)??"")&&(!Number.isFinite(Date.parse(source.lastVisitedAt??""))||now-Date.parse(source.lastVisitedAt!)>5*86400000));}
/** Shared reminders, with no automatic sending. */
export const sessionFollowups=dueFollowups;
export function sessionSteps(lotSize:number,due:number,visits:number,facts:readonly SessionFact[]):SessionStep[]{return [...(lotSize?["triage" as const]:[]),...(due?["followups" as const]:[]),...(visits?["sources" as const]:[]),...(facts.some(fact=>fact.validation==="proposed"&&(!fact.parentId||facts.find(parent=>parent.id===fact.parentId)?.validation!=="rejected"))?["validation" as const]:[])];}
export function sessionEstimate(lotSize:number,due:number,visits:number){return lotSize+3*(due+Math.min(1,visits));}
export function sessionProgress(session:RadarSession,jobs:readonly JobRecord[],sources:readonly SessionSource[],facts:readonly SessionFact[],now:number):SessionProgress {
  const after=sessionSnapshot(jobs,sources,facts),before=session.initial;
  const changed=jobs.filter(job=>(before.decisions[job.id]!==undefined||Date.parse(job.createdAt??"")>=session.startedAt)&&before.decisions[job.id]!==after.decisions[job.id]&&after.decisions[job.id]!=="pending");
  const visited=Object.entries(after.visits).filter(([name,at])=>at!==before.visits[name]&&Date.parse(at)>=session.startedAt).length;
  const validated=after.approved.filter(id=>!before.approved.includes(id)).length;
  const gem=changed.filter(job=>!job.deletedAt&&decision(job)==="selected"&&["very_close","close"].includes(job.fitLabel??"")&&job.fit!=null).sort((a,b)=>(b.fit??0)-(a.fit??0)||a.id.localeCompare(b.id))[0];
  const confirmed=confirmedSessionFollowups(jobs,session.startedAt);for(const id of session.sent)confirmed.add(id);const followups=confirmed.size,sorted=changed.length;
  return {sorted,followups,visited,validated,total:sorted+followups+visited+validated,minutes:Math.max(1,Math.ceil((session.activeMs+(session.paused||session.resumedAt===null?0:Math.max(0,now-session.resumedAt)))/60000)),...(gem?{gemId:gem.id}:{})};
}
/** No offer descriptions or private notes enter comfort storage. Reject stale or malformed state. */
export function readSession(raw:string|null,now:number,expectedDay=sessionDay(now)):RadarSession|null {
  try{const value=JSON.parse(raw??"null") as RadarSession|null;
    const strings=(a:unknown,max=2000):a is string[]=>Array.isArray(a)&&a.length<=max&&a.every(x=>typeof x==="string"&&x.length<=200);
    const map=(a:unknown)=>!!a&&typeof a==="object"&&!Array.isArray(a)&&Object.keys(a).length<=10000&&Object.entries(a).every(([k,v])=>k.length<=200&&typeof v==="string"&&v.length<=100);
    if(!value||typeof value.id!=="string"||value.id.length>100||value.day!==expectedDay||!Number.isFinite(value.startedAt)||value.startedAt>now+60000||now-value.startedAt>86400000||!Number.isFinite(value.activeMs)||value.activeMs<0||value.activeMs>86400000||(value.resumedAt!==null&&(!Number.isFinite(value.resumedAt)||value.resumedAt<value.startedAt||value.resumedAt>now+60000))||!strings(value.steps,4)||!value.steps.length||new Set(value.steps).size!==value.steps.length||value.steps.some(step=>!Object.hasOwn(sessionLabels,step))||!Number.isInteger(value.current)||value.current<0||value.current>=value.steps.length||!strings(value.sent)||typeof value.paused!=="boolean"||!value.initial||!strings(value.initial.approved)||!map(value.initial.decisions)||!map(value.initial.visits))return null;
    return value;
  }catch{return null;}
}
export function pauseSession(value:RadarSession,now:number):RadarSession{return {...value,paused:true,activeMs:Math.min(86400000,value.activeMs+(value.paused||value.resumedAt===null?0:Math.max(0,now-value.resumedAt))),resumedAt:null};}
