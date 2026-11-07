import {env} from "cloudflare:workers";
import {profileTemplate} from "./profile-template";
import {celebrationDecision,normalizeCelebrationState,preferencePatch,type RadarPreferences,type ProgressEvent} from "./celebrations";
import {planHeld,type WeekPlan} from "./week-plan";
const db=()=>env.DB as D1Database;
export async function readPreferences(userId:string):Promise<RadarPreferences>{const row=await db().prepare("SELECT data FROM profiles WHERE user_id=?").bind(userId).first<{data:string}>();return row?JSON.parse(row.data).preferences??{}:{};}
async function ensureProfile(userId:string){await db().prepare("INSERT INTO profiles(user_id,data) VALUES(?,?) ON CONFLICT(user_id) DO NOTHING").bind(userId,JSON.stringify(profileTemplate)).run();}
export async function writePreferences(userId:string,raw:unknown){const patch=preferencePatch(raw);await ensureProfile(userId);await db().prepare("UPDATE profiles SET data=json_set(data,'$.preferences',json_patch(coalesce(json_extract(data,'$.preferences'),'{}'),json(?))),updated_at=? WHERE user_id=?").bind(JSON.stringify(patch),new Date().toISOString(),userId).run();return readPreferences(userId);}
async function confirmedProgress(userId:string,event:ProgressEvent,profile:Record<string,unknown>){
 if(event.kind==="week_held"){const plan=profile.weekPlan as WeekPlan|null;return plan?.week===event.objectId&&event.stamp===plan.week&&planHeld(plan);}
 if(event.kind==="application_sent"){const row=await db().prepare("SELECT applied_at,status FROM jobs WHERE user_id=? AND id=?").bind(userId,event.objectId).first<{applied_at:string|null;status:string}>();return !!row?.applied_at&&row.applied_at===event.stamp&&!["rejected","withdrawn","closed"].includes(row.status);}
 const interview=await db().prepare("SELECT i.state,i.data,i.updated_at,j.status FROM interviews i JOIN jobs j ON j.id=i.job_id AND j.user_id=i.user_id WHERE i.user_id=? AND i.id=?").bind(userId,event.objectId).first<{state:string;data:string;updated_at:string;status:string}>();
 if(!interview||interview.state!=="reviewed"||["rejected","withdrawn","closed"].includes(interview.status))return false;
 const data=JSON.parse(interview.data);
 return event.kind==="followup_done"?data.followUpAt===event.stamp:interview.updated_at===event.stamp&&data.outcome!=="rejected"&&[data.summary,data.strengths,data.weaknesses].some(value=>typeof value==="string"&&value.trim());
}
/** The CAS covers the account quota and receipt together, including two devices. */
export async function claimCelebration(userId:string,event:ProgressEvent,now=Date.now(),draw=Math.random()){
 await ensureProfile(userId);
 for(let attempt=0;attempt<3;attempt++){
  const row=await db().prepare("SELECT data FROM profiles WHERE user_id=?").bind(userId).first<{data:string}>();if(!row)return {accepted:false};const profile=JSON.parse(row.data);
  if(!await confirmedProgress(userId,event,profile))return {accepted:false};
  const state=normalizeCelebrationState(profile.celebrationState,now),decision=celebrationDecision(event,state,profile.preferences??{},now,draw);
  if(decision.duplicate)return {accepted:false};
  const result=await db().prepare("UPDATE profiles SET data=json_set(data,'$.celebrationState',json(?)) WHERE user_id=? AND data=?").bind(JSON.stringify(decision.state),userId,row.data).run();
  if(result.meta.changes)return {accepted:decision.accepted,phrase:decision.accepted?Math.floor(Math.random()*4):undefined};
 }
 return {accepted:false};
}
