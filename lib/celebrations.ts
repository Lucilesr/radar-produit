export const progressKinds=["application_sent","followup_done","interview_review","week_held","lesson_saved"] as const;
export type ProgressKind=typeof progressKinds[number];
export type ProgressEvent={kind:ProgressKind;objectId:string;stamp:string};
export type RadarPreferences={reducedMotion?:boolean;celebrations?:boolean;triageShortcuts?:boolean};
export type CelebrationState={lastAt:number;seen:Array<{id:string;at:number}>};
export const celebrationPhrases=["Un pas concret pour votre recherche.","Vous avez fait avancer les choses.","Ce soin apporté à votre recherche compte.","Une action de plus, à votre rythme."] as const;
export function celebrationDraw(userId:string,mode:string|undefined,draw:number){return userId.startsWith("demo:")&&mode==="celebrations"?0:draw;}
export function progressEvent(value:unknown):ProgressEvent|null{if(!value||typeof value!=="object")return null;const event=value as ProgressEvent;return progressKinds.includes(event.kind)&&typeof event.objectId==="string"&&event.objectId.length>0&&event.objectId.length<=100&&typeof event.stamp==="string"&&event.stamp.length>0&&event.stamp.length<=80?{kind:event.kind,objectId:event.objectId,stamp:event.stamp}:null;}
export function celebrationId(event:ProgressEvent){return `${event.kind}:${event.objectId}:${event.stamp}`;}
export function normalizeCelebrationState(raw:unknown,now:number):CelebrationState{const state=raw&&typeof raw==="object"?raw as CelebrationState:null;return {lastAt:typeof state?.lastAt==="number"&&Number.isFinite(state.lastAt)?state.lastAt:0,seen:Array.isArray(state?.seen)?state.seen.filter(item=>typeof item?.id==="string"&&item.id.length<=220&&Number.isFinite(item.at)&&item.at>=now-7*86400000).slice(-499):[]};}
export function celebrationDecision(event:ProgressEvent,state:CelebrationState,preferences:RadarPreferences,now:number,draw:number){
 const id=celebrationId(event),seen=state.seen.some(item=>item.id===id);
 const accepted=!seen&&preferences.celebrations!==false&&!preferences.reducedMotion&&Number.isFinite(draw)&&draw>=0&&draw<1/3&&(!state.lastAt||now-state.lastAt>=3600000);
 return {accepted,duplicate:seen,state:seen?state:{lastAt:accepted?now:state.lastAt,seen:[...state.seen,{id,at:now}].slice(-500)}};
}
export function preferencePatch(raw:unknown):RadarPreferences{if(!raw||typeof raw!=="object"||Array.isArray(raw))throw new Error("Choisissez un réglage valide.");const entries=Object.entries(raw);if(!entries.length||entries.some(([key,value])=>!["reducedMotion","celebrations","triageShortcuts"].includes(key)||typeof value!=="boolean"))throw new Error("Choisissez un réglage valide.");return Object.fromEntries(entries);}
