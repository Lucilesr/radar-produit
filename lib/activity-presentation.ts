import {activityLabel,type ActivityEvent} from "./activity";
import {fromZonedInput} from "./application-workflow";
import {validTimeZone} from "./week-plan";
export const activityFilters=[{id:"all",label:"Tout"},{id:"tri",label:"Tri"},{id:"applications",label:"Candidatures"},{id:"profile",label:"Profil"},{id:"week",label:"Semaine"}] as const;
export type ActivityFilter=typeof activityFilters[number]["id"];
export const activityFilterActions={
 tri:["offer_sorted","offer_restored","offer_archived"],
 applications:["application_sent","application_cancelled","application_stage_changed","application_cared","interview_scheduled","interview_noted","interview_cancelled","followup_done","lesson_validated"],
 profile:["story_validated","fact_validated","search_role_added","search_role_removed"],
 week:["commitment_checked","commitment_unchecked","session_ended"],
} as const;
export class ActivityQueryError extends Error {}
export function readActivityFilter(raw:unknown):ActivityFilter{if(raw==null||raw==="")return "all";if(activityFilters.some(filter=>filter.id===raw))return raw as ActivityFilter;throw new ActivityQueryError("Filtre de journal invalide.");}
export function activityDayKey(value:string|Date|number,zone:string){const date=new Date(value);if(!Number.isFinite(date.getTime())||!validTimeZone(zone))return "unknown";const parts=new Intl.DateTimeFormat("en-CA",{timeZone:zone,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(date);const get=(key:string)=>parts.find(part=>part.type===key)?.value??"";return `${get("year")}-${get("month")}-${get("day")}`;}
export function activityWeekStart(now:Date,zone:string){if(!validTimeZone(zone)||!Number.isFinite(now.getTime()))throw new ActivityQueryError("Calendrier du journal invalide.");const day=new Date(activityDayKey(now,zone)+"T12:00:00Z");day.setUTCDate(day.getUTCDate()-(day.getUTCDay()+6)%7);return fromZonedInput(day.toISOString().slice(0,10)+"T00:00",zone);}
export function isCurrentActivityWeek(start:string|null,now:Date,zone:string){return !!start&&validTimeZone(zone)&&Number.isFinite(now.getTime())&&activityWeekStart(now,zone)===start;}
export function activityDayLabel(day:string,now:Date,zone:string){const today=activityDayKey(now,zone);if(day==="unknown")return "Date à relire";if(day===today)return "Aujourd’hui";const previous=new Date(today+"T12:00:00Z");previous.setUTCDate(previous.getUTCDate()-1);if(day===previous.toISOString().slice(0,10))return "Hier";return new Date(day+"T12:00:00Z").toLocaleDateString("fr-FR",{timeZone:"UTC",weekday:"long",day:"numeric",month:"long",...(day.slice(0,4)===today.slice(0,4)?{}:{year:"numeric"})});}
export function journalActionLabel(event:ActivityEvent){return event.action==="offer_sorted"?(event.data.decision==="selected"?"Sélectionnée":event.data.decision==="later"?"Plus tard":"Écartée"):activityLabel(event.action,event.data);}
export function journalTime(value:string,zone:string){const date=new Date(value);return Number.isFinite(date.getTime())?date.toLocaleTimeString("fr-FR",{timeZone:zone,hour:"2-digit",minute:"2-digit",hourCycle:"h23"}):"—";}
export function mergeActivity(items:ActivityEvent[],more:ActivityEvent[]){return [...new Map([...items,...more].map(item=>[item.id,item])).values()];}
export function activityDaySummary(items:ActivityEvent[]){
 const definitions=[["offer_sorted","offre triée","offres triées",true],["application_sent","candidature envoyée","candidatures envoyées",false],["followup_done","relance","relances",false],["interview_noted","entretien noté","entretiens notés",true],["story_validated","histoire","histoires",true],["fact_validated","bloc validé","blocs validés",true],["commitment_checked","engagement coché","engagements cochés",true],["session_ended","séance terminée","séances terminées",false]] as const;
 const unique=mergeActivity([],items),buckets=definitions.map(([action,one,many,perObject])=>{const found=unique.filter(item=>item.action===action);return {count:perObject?new Set(found.map(item=>item.objectId)).size:found.length,one,many};}).filter(bucket=>bucket.count);
 const other=unique.filter(item=>!definitions.some(([action])=>action===item.action)).length;
 const labels=buckets.slice(0,3).map(bucket=>`${bucket.count} ${bucket.count===1?bucket.one:bucket.many}`),remaining=other+buckets.slice(3).reduce((sum,bucket)=>sum+bucket.count,0);
 if(remaining)labels.push(`${remaining} autre${remaining===1?"":"s"} action${remaining===1?"":"s"}`);
 return labels.join(" · ")||"Aucune action";
}
export function groupActivityDays(items:ActivityEvent[],zone:string){
 const groups=new Map<string,ActivityEvent[]>();for(const item of mergeActivity([],items)){const key=activityDayKey(item.createdAt,zone);const group=groups.get(key);if(group)group.push(item);else groups.set(key,[item]);}
 return [...groups].sort(([a],[b])=>b.localeCompare(a)).map(([day,entries])=>({day,items:[...entries].sort((a,b)=>(Date.parse(b.createdAt)-Date.parse(a.createdAt)||b.id.localeCompare(a.id))),summary:activityDaySummary(entries)}));
}
