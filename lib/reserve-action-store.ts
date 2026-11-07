import {env} from "cloudflare:workers";
import {ARCHIVE_AFTER_DAYS,hasApplication} from "./opportunity-views";
import {neighboringRole} from "./reserve";
import type {JobRecord} from "./types";
const db=()=>env.DB as D1Database;
type Snapshot={id:string;status:string;appliedAt:string|null;reviewState:string|null;updatedAt:string;deletedAt:string|null;dismissalReason:string|null;dismissalNote:string|null};
type Receipt={action:"discard"|"archive"|"keep"|"role";before:Snapshot[];after:Snapshot[];role?:string;rolesBefore?:string[];rolesAfter?:string[];removed:number;createdAt:string;writeToken:string};
export type ReserveAction="discard"|"archive"|"keep"|"role"|"undo";
export class ReserveConflict extends Error{constructor(){super("Ce groupe a changé. Actualisez la réserve avant de réessayer ; aucun autre choix n’a été remplacé.");}}
const fields={status:"status",appliedAt:"applied_at",reviewState:"review_state",updatedAt:"updated_at",deletedAt:"deleted_at",dismissalReason:"dismissal_reason",dismissalNote:"dismissal_note"};
function matches(){return Object.entries(fields).map(([key,column])=>`j.${column} IS json_extract(s.value,'$.${key}')`).join(" AND ");}
const jobGate=`(SELECT count(*) FROM json_each(?) s JOIN jobs j ON j.id=json_extract(s.value,'$.id') WHERE j.user_id=? AND ${matches()})=?`;
const roleGate="EXISTS(SELECT 1 FROM profiles WHERE user_id=? AND coalesce(json_extract(data,'$.searchPreferences.roles'),'[]')=json(?))";
const receiptKey=(id:string)=>`reserve-action:${id}`;
function summary(id:string,r:Receipt,undone=false){return {id,action:r.action,count:r.before.length,removed:r.removed,role:r.role,undone};}
export async function reserveAction(userId:string,raw:unknown,now=new Date()){
 if(!raw||typeof raw!=="object"||Array.isArray(raw))throw new Error("Choix de groupe invalide.");
 const command=raw as {id:string;action:ReserveAction;ids?:string[];role?:string};
 if(!/^[0-9a-f-]{36}$/i.test(command.id)||!["discard","archive","keep","role","undo"].includes(command.action))throw new Error("Choix de groupe invalide.");
 const key=receiptKey(command.id),stored=await db().prepare("SELECT value,version FROM workspace_writes WHERE user_id=? AND key=? ORDER BY version DESC LIMIT 1").bind(userId,key).first<{value:string;version:number}>();
 if(command.action==="undo"){
  if(!stored)throw new ReserveConflict();
  const receipt=JSON.parse(stored.value) as Receipt;
  if(stored.version===2)return summary(command.id,receipt,true);
  await commit(userId,key,receipt,now,true);
  return summary(command.id,receipt,true);
 }
 if(stored)return summary(command.id,JSON.parse(stored.value),stored.version===2);
 if(!Array.isArray(command.ids)||!command.ids.length||command.ids.length>50||new Set(command.ids).size!==command.ids.length||command.ids.some(id=>typeof id!=="string"||!id||id.length>100))throw new Error("Choisissez de 1 à 50 offres.");
 const rows=(await db().prepare(`SELECT j.*,EXISTS(SELECT 1 FROM interviews i WHERE i.user_id=j.user_id AND i.job_id=j.id) AS has_interview FROM jobs j WHERE user_id=? AND id IN (${command.ids.map(()=>"?").join(",")})`).bind(userId,...command.ids).all<Record<string,string|number|null>>()).results;
 if(rows.length!==command.ids.length||rows.some(row=>row.deleted_at||row.applied_at||row.has_interview||hasApplication({status:row.status} as JobRecord)||!["new","watchlist","shortlist","prepare","ready","closed"].includes(String(row.status))))throw new ReserveConflict();
 if(rows.some(row=>["selected"].includes(String(row.review_state))||["shortlist","prepare","ready"].includes(String(row.status))))throw new ReserveConflict();
 const before=rows.map(row=>Object.fromEntries([["id",row.id],...Object.entries(fields).map(([key,column])=>[key,row[column]])]) as Snapshot);
 const createdAt=now.toISOString();let rolesBefore:string[]|undefined,rolesAfter:string[]|undefined;
 if(command.action==="archive"&&rows.some(row=>{const date=Date.parse(String(row.published_at||row.created_at));return !Number.isFinite(date)||now.getTime()-date<ARCHIVE_AFTER_DAYS*864e5;}))throw new Error("Seules les annonces anciennes peuvent être archivées par ce groupe.");
 if(command.action==="role"){
  const profile=await db().prepare("SELECT data FROM profiles WHERE user_id=?").bind(userId).first<{data:string}>();if(!profile)throw new ReserveConflict();
  rolesBefore=JSON.parse(profile.data).searchPreferences?.roles??[];
  const role=neighboringRole(rows.map(row=>({title:String(row.title)})),rolesBefore!);
  if(!role||command.role!==role||rolesBefore!.length>=12)throw new ReserveConflict();
  rolesAfter=[...rolesBefore!,role];
 }
 const after=before.map(row=>command.action==="role"?row:{...row,updatedAt:createdAt,...(command.action==="discard"?{deletedAt:createdAt,dismissalReason:"not_interested"}: {reviewState:command.action==="keep"?"later":"to_review"})});
 const receipt:Receipt={action:command.action,before,after,writeToken:crypto.randomUUID(),removed:command.action==="archive"||command.action==="discard"?before.length:0,createdAt,...(rolesAfter?{role:command.role,rolesBefore,rolesAfter}:{})};
 await commit(userId,key,receipt,now,false);
 return summary(command.id,receipt);
}
async function commit(userId:string,key:string,r:Receipt,now:Date,undo:boolean){
 const expected=undo?r.after:r.before,target=undo?r.before:r.after,version=undo?2:1,original=JSON.stringify(r),payload=undo?JSON.stringify({...r,undoToken:crypto.randomUUID()}):original;
 const gates=[jobGate],args:unknown[]=[JSON.stringify(expected),userId,expected.length];
 if(r.action==="role"){gates.push(roleGate);args.push(userId,JSON.stringify(undo?r.rolesAfter:r.rolesBefore));}
 if(undo){gates.push("EXISTS(SELECT 1 FROM workspace_writes WHERE user_id=? AND key=? AND version=1 AND value=?)");args.push(userId,key,original);}
 const insert=db().prepare(`INSERT INTO workspace_writes(user_id,key,version,value,created_at) SELECT ?,?,?,?,? WHERE ${gates.join(" AND ")} ON CONFLICT DO NOTHING`).bind(userId,key,version,payload,now.toISOString(),...args);
 const marker="EXISTS(SELECT 1 FROM workspace_writes WHERE user_id=? AND key=? AND version=? AND value=?)";
 const markerArgs=[userId,key,version,payload];
 const operations=[insert];
 if(r.action==="role")operations.push(db().prepare(`UPDATE profiles SET data=json_set(data,'$.searchPreferences.roles',json(?)),updated_at=? WHERE user_id=? AND ${marker}`).bind(JSON.stringify(undo?r.rolesBefore:r.rolesAfter),now.toISOString(),userId,...markerArgs));
 else operations.push(db().prepare(`UPDATE jobs SET ${["reviewState","updatedAt","deletedAt","dismissalReason","dismissalNote"].map(key=>`${fields[key as keyof typeof fields]}=(SELECT json_extract(s.value,'$.${key}') FROM json_each(?) s WHERE json_extract(s.value,'$.id')=jobs.id)`).join(",")} WHERE user_id=? AND id IN(SELECT json_extract(value,'$.id') FROM json_each(?)) AND ${marker}`).bind(...Array(5).fill(JSON.stringify(target)),userId,JSON.stringify(target),...markerArgs));
 const result=await db().batch(operations);
 if(!result[0].meta.changes)throw new ReserveConflict();
}
