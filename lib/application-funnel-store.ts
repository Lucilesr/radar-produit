import {env} from "cloudflare:workers";
import {applicationFunnel,FUNNEL_DAYS} from "./application-funnel";
import type {ActivityEvent} from "./activity";
export async function readApplicationFunnel(userId:string,now=new Date()){
 const db=env.DB as D1Database,cutoff=new Date(now.getTime()-FUNNEL_DAYS*86400000).toISOString();
 const [events,first,datedApplications]=await Promise.all([
  db.prepare("SELECT id,action,object_type AS objectType,object_id AS objectId,created_at AS createdAt,data FROM activity_events WHERE user_id=? AND created_at>=? AND created_at<=? AND action IN('application_sent','application_cancelled','application_stage_changed','interview_scheduled','interview_noted','interview_cancelled') ORDER BY created_at,id").bind(userId,cutoff,now.toISOString()).all<Omit<ActivityEvent,"data">&{data:string}>(),
  db.prepare("SELECT min(created_at) AS firstAt FROM activity_events WHERE user_id=?").bind(userId).first<{firstAt:string|null}>(),
  db.prepare("SELECT j.id,j.source,strftime('%Y-%m-%dT%H:%M:%fZ',j.applied_at) AS appliedAt, (j.status IN('interview','next_step') OR EXISTS(SELECT 1 FROM interviews i WHERE i.job_id=j.id AND i.user_id=j.user_id AND i.state<>'cancelled')) AS hasInterview FROM jobs j WHERE j.user_id=? AND julianday(j.applied_at) BETWEEN julianday(?) AND julianday(?)").bind(userId,cutoff,now.toISOString()).all<{id:string;source:string;appliedAt:string;hasInterview:number}>(),
 ]);
 const rows=events.results.map(row=>{const data=JSON.parse(row.data);if(!data||typeof data!=="object"||Array.isArray(data))throw new Error("Événement illisible.");return {...row,data} as ActivityEvent;});
 // Older applications can have a confirmed send date but no journal entry.
 const lastRecordedSend=new Map<string,string>();
 for(const row of rows)if(row.action==="application_sent"&&row.objectType==="job")lastRecordedSend.set(row.objectId,row.createdAt);
 for(const job of datedApplications.results){
  const recorded=lastRecordedSend.get(job.id);
  if(recorded&&Date.parse(recorded)>=Date.parse(job.appliedAt))continue;
  rows.push({id:"dated-application:"+job.id,action:"application_sent",objectType:"job",objectId:job.id,createdAt:job.appliedAt,data:{source:job.source,legacyInterview:job.hasInterview===1}});
 }
 return {...applicationFunnel(rows,now.getTime()),firstRecordedAt:first?.firstAt??null};
}
