import type {JobRecord} from "./types";
export type ApplicationFollowup={appliedFor:string;dueAt:string|null;doneAt?:string;proposed:boolean;eligible:boolean;version:number};
type FollowupJob=Pick<JobRecord,'status'|'appliedAt'>&{interviews?:readonly {state:string}[]};
export function followupEligible(job:FollowupJob){return !!job.appliedAt&&["applied","awaiting_response"].includes(job.status)&&!job.interviews?.some(event=>event.state!=="cancelled");}
export function applicationFollowup(job:FollowupJob,raw?:unknown,version=0):ApplicationFollowup|undefined{
 if(!job.appliedAt||!Number.isFinite(Date.parse(job.appliedAt)))return undefined;
 let value=raw;try{if(typeof value==="string")value=JSON.parse(value);}catch{value=null;}const stored=value&&typeof value==="object"?value as Record<string,unknown>:{};
 const valid=stored.appliedFor===job.appliedAt&&(stored.dueAt===null||typeof stored.dueAt==="string"&&Number.isFinite(Date.parse(stored.dueAt)));
 return {appliedFor:job.appliedAt,dueAt:valid?stored.dueAt as string|null:new Date(Date.parse(job.appliedAt)+7*86400000).toISOString(),...(valid&&stored.dueAt&&typeof stored.doneAt==="string"&&Number.isFinite(Date.parse(stored.doneAt))?{doneAt:stored.doneAt}:{}),proposed:!valid,eligible:followupEligible(job),version};
}
export const followupValue=(value:ApplicationFollowup)=>JSON.stringify({appliedFor:value.appliedFor,dueAt:value.dueAt,...(value.doneAt?{doneAt:value.doneAt}:{})});
export const latestFollowup=(before:ApplicationFollowup|undefined,after:ApplicationFollowup|undefined)=>!after?undefined:before?.appliedFor!==after.appliedFor||after.version>=(before?.version??0)?after:before;
export type FollowupEntry={id:string;kind:"application"|"interview";job:JobRecord;at:string;appliedFor?:string};
export function dueFollowups(jobs:readonly JobRecord[],now:number,sent:readonly string[]=[]):FollowupEntry[]{
 const entries:FollowupEntry[]=[];
 for(const job of jobs){if(["rejected","withdrawn","closed","offer"].includes(job.status))continue;
  const followup=applicationFollowup(job,job.applicationFollowup,job.applicationFollowup?.version??0),id=`application:${job.id}`;
  if(followup?.eligible&&followup.dueAt&&!followup.doneAt&&Date.parse(followup.dueAt)<=now&&!sent.includes(id))entries.push({id,kind:"application",job,at:followup.dueAt,appliedFor:followup.appliedFor});
  for(const event of job.interviews??[])if(event.state==="reviewed"&&event.followUpAt&&!(event.followUpDoneAt&&event.followUpDoneFor===event.followUpAt)&&Date.parse(event.followUpAt)<=now&&!sent.includes(event.id))entries.push({id:event.id,kind:"interview",job,at:event.followUpAt});
 }
 return entries.sort((a,b)=>a.at.localeCompare(b.at)||a.id.localeCompare(b.id));
}
export function confirmedSessionFollowups(jobs:readonly JobRecord[],startedAt:number){const ids=new Set<string>();for(const job of jobs){if(job.applicationFollowup?.doneAt&&Date.parse(job.applicationFollowup.doneAt)>=startedAt)ids.add(`application:${job.id}`);for(const event of job.interviews??[])if(event.followUpDoneAt&&Date.parse(event.followUpDoneAt)>=startedAt)ids.add(event.id);}return ids;}
