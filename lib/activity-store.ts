import {env} from "cloudflare:workers";
import type {ActivityAction,ActivityData,ActivityEvent} from "./activity";
import {declareApplicationFollowup} from "./application-followup-store";
export {activityReceiptId} from "./activity";
import {activityCursor,activityReceiptId} from "./activity";
export const activityDb=()=>env.DB as D1Database;
export function activityPrepared(query:{toSQL:()=>{sql:string;params:unknown[]}}){const value=query.toSQL();return activityDb().prepare(value.sql).bind(...value.params);}
/** Gate SQL comes only from reviewed application code; every value stays bound. */
export function activityStatement(userId:string,event:{action:ActivityAction;objectType:string;objectId:string;createdAt:string;data?:ActivityData;id?:string},gate="1",args:unknown[]=[]){
 return activityDb().prepare(`INSERT INTO activity_events(id,user_id,action,object_type,object_id,created_at,data) SELECT ?,?,?,?,?,?,? WHERE (${gate}) ON CONFLICT(id) DO NOTHING RETURNING id`).bind(event.id??crypto.randomUUID(),userId,event.action,event.objectType,event.objectId,event.createdAt,JSON.stringify(event.data??{}),...args);
}
/** Batch offer decisions use one bounded SELECT, including all receipts in the same transaction. */
export function jobActivityStatement(userId:string,action:ActivityAction,ids:string[],createdAt:string,gate:string,args:unknown[]=[],decision:string|null=null){
 return activityDb().prepare(`INSERT INTO activity_events(id,user_id,action,object_type,object_id,created_at,data) SELECT lower(hex(randomblob(16))),?,?,'job',id,?,json_object('source',source,'status',status,'decision',?,'previousReviewState',review_state) FROM jobs WHERE user_id=? AND id IN (${ids.map(()=>"?").join(",")}) AND (${gate}) RETURNING id`).bind(userId,action,createdAt,decision,userId,...ids,...args);
}
export async function readActivity(userId:string,cursor?:string|null){
 const after=cursor?activityCursor(cursor):null;if(cursor&&!after)throw new Error("Page de journal invalide.");
 const scope=after?" AND (e.created_at<? OR(e.created_at=? AND e.id<?))":"";
 const rows=(await activityDb().prepare(`SELECT e.id,e.action,e.object_type AS objectType,e.object_id AS objectId,e.created_at AS createdAt,e.data,coalesce(j.title,ij.title,json_extract(x.data,'$.title'),'') AS label FROM activity_events e LEFT JOIN jobs j ON e.object_type='job' AND j.id=e.object_id AND j.user_id=e.user_id LEFT JOIN interviews i ON e.object_type='interview' AND i.id=e.object_id AND i.user_id=e.user_id LEFT JOIN jobs ij ON ij.id=i.job_id AND ij.user_id=e.user_id LEFT JOIN experience_items x ON e.object_type='experience' AND x.id=e.object_id AND x.user_id=e.user_id WHERE e.user_id=?${scope} ORDER BY e.created_at DESC,e.id DESC LIMIT 21`).bind(userId,...(after?[after[0],after[0],after[1]]:[])).all<Omit<ActivityEvent,"data">&{data:string}>()).results;
 const items=rows.slice(0,20).map(row=>({...row,data:JSON.parse(row.data) as ActivityData})),last=items.at(-1);
 return {items,cursor:rows.length>20&&last?btoa(JSON.stringify([last.createdAt,last.id])):null};
}

/** Only the two explicit declarations not already covered by a business write enter here. */
export async function declareActivity(userId:string,raw:unknown,now=new Date()){
 if(!raw||typeof raw!=="object"||Array.isArray(raw))throw new Error("Action invalide.");
 const command=raw as {action:string;objectId:string;stamp?:string;appliedFor?:string;startedAt?:string;minutes?:number};
 if(typeof command.objectId!=="string"||!command.objectId||command.objectId.length>100)throw new Error("Action invalide.");
 const createdAt=now.toISOString();
 if(command.action==="followup_done"&&command.objectId.startsWith("application:"))return declareApplicationFollowup(userId,command.objectId.slice(12),command.stamp,command.appliedFor,now);
 if(command.action==="followup_done"){
  const row=await activityDb().prepare("SELECT i.job_id,i.state,i.data,j.status,j.source FROM interviews i JOIN jobs j ON j.id=i.job_id AND j.user_id=i.user_id WHERE i.user_id=? AND i.id=?").bind(userId,command.objectId).first<{job_id:string;state:string;data:string;status:string;source:string}>();
  const at=row?JSON.parse(row.data).followUpAt:null;
  if(!row||row.state!=="reviewed"||["rejected","withdrawn","closed","offer"].includes(row.status)||typeof at!=="string"||at!==command.stamp||!Number.isFinite(Date.parse(at))||Date.parse(at)>now.getTime())throw new Error("Cette relance n’est plus à noter. Relisez la candidature.");
  const id=await activityReceiptId(userId,command.action,command.objectId,at);
  const gate="EXISTS(SELECT 1 FROM interviews i JOIN jobs j ON j.id=i.job_id AND j.user_id=i.user_id WHERE i.user_id=? AND i.id=? AND i.state='reviewed' AND json_extract(i.data,'$.followUpAt')=? AND j.status NOT IN('rejected','withdrawn','closed','offer'))";
  const event=activityStatement(userId,{id,action:"followup_done",objectType:"interview",objectId:command.objectId,createdAt,data:{dueAt:at,jobId:row.job_id,source:row.source}},gate,[userId,command.objectId,at]);
  const update=activityDb().prepare("UPDATE interviews SET data=json_set(data,'$.followUpDoneAt',(SELECT created_at FROM activity_events WHERE id=? AND user_id=?),'$.followUpDoneFor',?) WHERE user_id=? AND id=? AND json_extract(data,'$.followUpAt')=? AND coalesce(json_extract(data,'$.followUpDoneFor'),'')<>? AND EXISTS(SELECT 1 FROM activity_events WHERE id=? AND user_id=?)").bind(id,userId,at,userId,command.objectId,at,at,id,userId);
  await activityDb().batch([event,update]);
  const saved=await activityDb().prepare("SELECT created_at FROM activity_events WHERE user_id=? AND id=?").bind(userId,id).first<{created_at:string}>();
  if(!saved)throw new Error("La relance a changé. Relisez la candidature.");
  return {saved:true,id,doneAt:saved.created_at};
 }
 if(command.action==="session_ended"){
  const start=Date.parse(command.startedAt??"");
  if(!/^[0-9a-f-]{36}$/i.test(command.objectId)||!Number.isFinite(start)||start>now.getTime()+60000||now.getTime()-start>86400000||typeof command.minutes!=="number"||!Number.isInteger(command.minutes)||command.minutes<1||command.minutes>1440)throw new Error("Séance invalide ou périmée.");
  const id=await activityReceiptId(userId,command.action,command.objectId,command.objectId);
  await activityStatement(userId,{id,action:"session_ended",objectType:"session",objectId:command.objectId,createdAt,data:{startedAt:new Date(start).toISOString(),minutes:command.minutes}}).all();
  return {saved:true,id};
 }
 throw new Error("Cette action doit être confirmée par son écran.");
}
