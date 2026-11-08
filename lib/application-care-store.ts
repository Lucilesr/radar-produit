import {env} from "cloudflare:workers";
import {activityReceiptId,activityStatement} from "./activity-store";
import {applicationMetadataRow} from "./application-metadata-store";
import {readCare,careChecks,careCount,careValue,type CareField,type ApplicationCare} from "./application-care";
const db=()=>env.DB as D1Database;
const keyFor=(id:string)=>`application:care:${id}`;
async function owned(userId:string,id:string){return await db().prepare("SELECT id,source FROM jobs WHERE user_id=? AND id=?").bind(userId,id).first<{id:string;source:string}>();}
export class CareConflict extends Error{constructor(public current:ApplicationCare){super("Ces repères ont changé dans un autre onglet. Relisez-les avant de réessayer.");}}
export async function readApplicationCare(userId:string,id:string){if(!await owned(userId,id))return null;const row=await applicationMetadataRow(userId,keyFor(id));return readCare(row?.value,row?.version??0);}
export async function writeApplicationCare(userId:string,id:string,raw:unknown,now=new Date()){
 const job=await owned(userId,id);if(!job)return null;
 if(!raw||typeof raw!=="object"||Array.isArray(raw))throw new Error("Repère invalide.");const command=raw as {version:number;field:CareField;checked:boolean};
 if(!Number.isInteger(command.version)||command.version<0||!careChecks.some(item=>item.id===command.field)||typeof command.checked!=="boolean")throw new Error("Repère invalide.");
 const key=keyFor(id),row=await applicationMetadataRow(userId,key),before=readCare(row?.value,row?.version??0);
 if(before[command.field]===command.checked)return before;
 if(command.version!==before.version)throw new CareConflict(before);
 const next={...before,[command.field]:command.checked,version:before.version+1},value=careValue(next),at=now.toISOString();
 const statement=db().prepare("INSERT INTO workspace_writes(user_id,key,version,value,created_at) SELECT ?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM workspace_writes WHERE user_id=? AND key=? AND version>?) AND EXISTS(SELECT 1 FROM jobs WHERE user_id=? AND id=?) ON CONFLICT(user_id,key,version) DO NOTHING RETURNING version").bind(userId,key,next.version,value,at,userId,key,before.version,userId,id);
 const operations=[statement];
 if(careCount(before)<3&&careCount(next)>=3)operations.push(activityStatement(userId,{id:await activityReceiptId(userId,"application_cared",id,String(next.version)),action:"application_cared",objectType:"job",objectId:id,createdAt:at,data:{score:careCount(next),source:job.source}},"EXISTS(SELECT 1 FROM workspace_writes WHERE user_id=? AND key=? AND version=? AND value=? AND created_at=?)",[userId,key,next.version,value,at]));
 const result=await db().batch(operations);if(result[0].results.length)return next;
 const latest=await readApplicationCare(userId,id);if(!latest)return null;if(latest[command.field]===command.checked)return latest;throw new CareConflict(latest);
}
