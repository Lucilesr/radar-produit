import {env} from "cloudflare:workers";
import {activityReceiptId,activityStatement} from "./activity-store";
import {applicationMetadataRow,applicationMetadataStatement} from "./application-metadata-store";
import {lessonFields,lessonHasContent,sameLesson,readLesson,lessonCursor,type ApplicationLesson} from "./application-lesson";
const db=()=>env.DB as D1Database,keyFor=(id:string)=>`application:lesson:${id}`;
type Owned={id:string;status:string;source:string;applied_at:string|null;created_at:string;title:string;company:string};
async function owned(userId:string,id:string){return db().prepare("SELECT id,status,source,applied_at,created_at,title,company FROM jobs WHERE user_id=? AND id=?").bind(userId,id).first<Owned>();}
export class LessonConflict extends Error{constructor(public current:ApplicationLesson){super("Ce bilan a changé. Comparez les versions avant de valider votre saisie conservée.");}}
export async function readApplicationLesson(userId:string,id:string){const job=await owned(userId,id);if(!job)return null;const row=await applicationMetadataRow(userId,keyFor(id));return {lesson:readLesson(row?.value,row?.version??0),eligible:job.status==="rejected"};}
export async function writeApplicationLesson(userId:string,id:string,raw:unknown,now=new Date()){
 const job=await owned(userId,id);if(!job)return null;if(job.status!=="rejected")throw new Error("Ce bilan se propose après un refus. Relisez le statut de la candidature.");
 const fields=lessonFields(raw),version=(raw as {version:number}).version;if(!Number.isSafeInteger(version)||version<0||!lessonHasContent(fields))throw new Error("Écrivez ce qui vous est utile dans au moins un champ. Le bilan reste facultatif.");
 const key=keyFor(id),row=await applicationMetadataRow(userId,key),before=readLesson(row?.value,row?.version??0),cycle=job.applied_at??job.created_at;
 if(before.validatedAt&&before.appliedFor===cycle&&sameLesson(before,fields))return {lesson:before,progressStamp:before.progressStamp};
 if(version!==before.version)throw new LessonConflict(before);
 const at=now.toISOString(),receipt=await activityReceiptId(userId,"lesson_validated",id,cycle),previous=await db().prepare("SELECT created_at FROM activity_events WHERE user_id=? AND id=?").bind(userId,receipt).first<{created_at:string}>();
 const next:ApplicationLesson={...fields,version:before.version+1,validatedAt:at,appliedFor:cycle,progressStamp:previous?.created_at??at,jobTitle:job.title,company:job.company},value=JSON.stringify(next);
 const gate="EXISTS(SELECT 1 FROM jobs WHERE user_id=? AND id=? AND status='rejected' AND applied_at IS ?)";
 const write=applicationMetadataStatement(userId,id,key,before.version,value,at,gate,[userId,id,job.applied_at]);
 const event=activityStatement(userId,{id:receipt,action:"lesson_validated",objectType:"job",objectId:id,createdAt:at,data:{source:job.source,appliedFor:cycle}},"EXISTS(SELECT 1 FROM workspace_writes WHERE user_id=? AND key=? AND version=? AND value=? AND created_at=?)",[userId,key,next.version,value,at]);
 const result=await db().batch([write,event]);if(result[0].results.length)return {lesson:next,progressStamp:next.progressStamp};
 const current=await readApplicationLesson(userId,id);if(!current)return null;if(current.eligible&&current.lesson.appliedFor===cycle&&sameLesson(current.lesson,fields))return {lesson:current.lesson,progressStamp:current.lesson.progressStamp};throw new LessonConflict(current.lesson);
}
export async function listApplicationLessons(userId:string,cursor:string|null){
 const after=lessonCursor(cursor),scope=after?" AND(w.created_at<? OR(w.created_at=? AND w.key<?))":"";
 const rows=(await db().prepare(`SELECT w.key,w.value,w.version,w.created_at,j.id AS jobId,j.title,j.company FROM workspace_writes w LEFT JOIN jobs j ON j.user_id=w.user_id AND j.id=substr(w.key,20) WHERE w.user_id=? AND w.key LIKE 'application:lesson:%' AND NOT EXISTS(SELECT 1 FROM workspace_writes n WHERE n.user_id=w.user_id AND n.key=w.key AND n.version>w.version)${scope} ORDER BY w.created_at DESC,w.key DESC LIMIT 21`).bind(userId,...(after?[after[0],after[0],after[1]]:[])).all<{key:string;value:string;version:number;created_at:string;jobId:string|null;title:string|null;company:string|null}>()).results;
 const items=rows.slice(0,20).map(row=>{const lesson=readLesson(row.value,row.version);return {id:row.key.slice(19),lesson,jobId:row.jobId,title:row.title??lesson.jobTitle??"Candidature conservée",company:row.company??lesson.company??""};}),last=rows[19];return {items,cursor:rows.length>20&&last?btoa(JSON.stringify([last.created_at,last.key])):null};
}
