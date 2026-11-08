import {applicationGroups} from "./application-groups";
import {terminalStatuses} from "./application-workflow";
import type {JobRecord} from "./types";
import type {PersonalColumn} from "./personal-board";
export function mobileFollowupDue(job:JobRecord,now:number){return !terminalStatuses.includes(job.status)&&job.applicationFollowup?.eligible===true&&!!job.applicationFollowup.dueAt&&!job.applicationFollowup.doneAt&&Date.parse(job.applicationFollowup.dueAt)<=now;}
/** Read-only urgency projection; every dossier appears once and personal labels survive. */
export function mobileApplicationGroups(jobs:JobRecord[],columns:PersonalColumn[],now:number){
 const unique=[...new Map(jobs.map(job=>[job.id,job])).values()];
 const due=unique.filter(job=>mobileFollowupDue(job,now));
 const dueIds=new Set(due.map(job=>job.id));
 const groups=applicationGroups(unique.filter(job=>!dueIds.has(job.id)),columns);
 const order=(stage:string)=>stage==="interviews"?0:stage==="sent"?1:stage==="offer"?2:3;
 return {due,active:groups.filter(group=>group.column.stage!=="closed"&&group.jobs.length).toSorted((a,b)=>order(a.column.stage)-order(b.column.stage)),closed:groups.filter(group=>group.column.stage==="closed"&&group.jobs.length)};
}
export function mobileCardWindow<T>(items:readonly T[],expanded=false){return {items:expanded?[...items]:items.slice(0,2),remaining:expanded?0:Math.max(0,items.length-2)};}
