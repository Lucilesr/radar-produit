import {env} from "cloudflare:workers";
import {applicationFunnel,FUNNEL_DAYS} from "./application-funnel";
import type {ActivityEvent} from "./activity";
export async function readApplicationFunnel(userId:string,now=new Date()){
 const db=env.DB as D1Database,cutoff=new Date(now.getTime()-FUNNEL_DAYS*86400000).toISOString();
 const [events,first]=await Promise.all([db.prepare("SELECT id,action,object_type AS objectType,object_id AS objectId,created_at AS createdAt,data FROM activity_events WHERE user_id=? AND created_at>=? AND created_at<=? AND action IN('application_sent','application_cancelled','application_stage_changed','interview_scheduled','interview_noted','interview_cancelled') ORDER BY created_at,id").bind(userId,cutoff,now.toISOString()).all<Omit<ActivityEvent,"data">&{data:string}>(),db.prepare("SELECT min(created_at) AS firstAt FROM activity_events WHERE user_id=?").bind(userId).first<{firstAt:string|null}>()]);
 const rows=events.results.map(row=>{const data=JSON.parse(row.data);if(!data||typeof data!=="object"||Array.isArray(data))throw new Error("Événement illisible.");return {...row,data} as ActivityEvent;});
 return {...applicationFunnel(rows,now.getTime()),firstRecordedAt:first?.firstAt??null};
}
