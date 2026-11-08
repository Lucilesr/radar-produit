import {env} from "cloudflare:workers";
import {z} from "zod";
import {applicationMetadataRow,applicationMetadataStatement} from "./application-metadata-store";
import {applicationFollowup,followupValue,type ApplicationFollowup} from "./application-followup";
import {activityReceiptId} from "./activity";
import type {JobStatus} from "./types";
const db=()=>env.DB as D1Database,keyFor=(id:string)=>`application:followup:${id}`;
const commandSchema=z.discriminatedUnion("action",[z.object({action:z.literal("schedule"),version:z.number().int().min(0),appliedFor:z.string().max(100),dueAt:z.union([z.string().datetime({offset:true}),z.null()])}).strict(),z.object({action:z.literal("done"),version:z.number().int().min(0),appliedFor:z.string().max(100),dueAt:z.string().datetime({offset:true})}).strict()]);
async function owned(userId:string,id:string){const row=await db().prepare("SELECT j.status,j.applied_at,j.source,EXISTS(SELECT 1 FROM interviews i WHERE i.user_id=j.user_id AND i.job_id=j.id AND i.state<>'cancelled') AS has_interview FROM jobs j WHERE j.user_id=? AND j.id=?").bind(userId,id).first<{status:JobStatus;applied_at:string|null;source:string;has_interview:number}>();return row?{status:row.status,appliedAt:row.applied_at??undefined,source:row.source,interviews:row.has_interview?[{state:"planned"}]:[]}:null;}
export class FollowupConflict extends Error{constructor(public current:ApplicationFollowup|null){super("Cette relance a changé. Relisez la candidature avant de réessayer.");}}
export async function readApplicationFollowup(userId:string,id:string){const job=await owned(userId,id);if(!job)return null;const row=await applicationMetadataRow(userId,keyFor(id));return {followup:applicationFollowup(job,row?.value,row?.version??0)??null};}
export async function writeApplicationFollowup(userId:string,id:string,raw:unknown,now=new Date()){
 const job=await owned(userId,id);if(!job)return null;const command=commandSchema.parse(raw),key=keyFor(id),row=await applicationMetadataRow(userId,key),before=applicationFollowup(job,row?.value,row?.version??0);
 if(!before?.eligible||before.appliedFor!==command.appliedFor)throw new FollowupConflict(before??null);
 const dueAt=command.dueAt===null?null:new Date(command.dueAt).toISOString();
 if(command.action==="done"&&(!before.dueAt||before.dueAt!==dueAt))throw new FollowupConflict(before);
 if(command.action==="done"&&before.doneAt)return {followup:before};
 if(command.action==="schedule"&&!before.proposed&&before.dueAt===dueAt)return {followup:before};
 if(command.version!==before.version)throw new FollowupConflict(before);
 const at=now.toISOString(),receipt=dueAt?await activityReceiptId(userId,"followup_done",id,`${before.appliedFor}|${dueAt}`):null;
 const previous=receipt?await db().prepare("SELECT created_at FROM activity_events WHERE user_id=? AND id=?").bind(userId,receipt).first<{created_at:string}>():null;
 const next:ApplicationFollowup={...before,dueAt,proposed:false,version:before.version+1,doneAt:previous?.created_at??(command.action==="done"?at:undefined)},value=followupValue(next);
 const gate="EXISTS(SELECT 1 FROM jobs j WHERE j.user_id=? AND j.id=? AND j.applied_at=? AND j.status IN('applied','awaiting_response') AND NOT EXISTS(SELECT 1 FROM interviews i WHERE i.user_id=j.user_id AND i.job_id=j.id AND i.state<>'cancelled'))";
 const operations=[applicationMetadataStatement(userId,id,key,before.version,value,at,gate,[userId,id,before.appliedFor])];
 if(command.action==="done"){
  operations.push(db().prepare("INSERT INTO activity_events(id,user_id,action,object_type,object_id,created_at,data) SELECT ?,?,'followup_done','job',?,?,? WHERE EXISTS(SELECT 1 FROM workspace_writes WHERE user_id=? AND key=? AND version=? AND value=? AND created_at=?) ON CONFLICT(id) DO NOTHING RETURNING id").bind(receipt,userId,id,at,JSON.stringify({kind:"application",source:job.source,jobId:id,dueAt,appliedFor:before.appliedFor}),userId,key,next.version,value,at));
 }
 const results=await db().batch(operations);if(results[0].results.length)return {followup:next};
 const latest=await readApplicationFollowup(userId,id);if(latest?.followup?.appliedFor===before.appliedFor&&latest.followup.dueAt===dueAt&&(command.action==="schedule"||latest.followup.doneAt))return latest;throw new FollowupConflict(latest?.followup??null);
}
export async function declareApplicationFollowup(userId:string,id:string,stamp:unknown,appliedFor:unknown,now=new Date()){
 const current=await readApplicationFollowup(userId,id);if(!current?.followup||typeof stamp!=="string"||typeof appliedFor!=="string")throw new FollowupConflict(current?.followup??null);
 const saved=await writeApplicationFollowup(userId,id,{action:"done",version:current.followup.version,dueAt:stamp,appliedFor},now);if(!saved?.followup?.doneAt)throw new FollowupConflict(saved?.followup??null);
 return {saved:true,id:await activityReceiptId(userId,"followup_done",id,`${saved.followup.appliedFor}|${saved.followup.dueAt}`),doneAt:saved.followup.doneAt,followup:saved.followup};
}
