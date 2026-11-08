import {readSession,type RadarSession} from "./radar-session";
import type {StoredLot} from "./daily-lot";
export type RadarContinuity={ownerId:string;lot:StoredLot|null;lotVersion:number;session:RadarSession|null;sessionVersion:number};
export function continuityDay(value:unknown,now=new Date()):value is string{
 if(typeof value!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const date=Date.parse(value+"T12:00:00Z");return Number.isFinite(date)&&new Date(date).toISOString().slice(0,10)===value&&Math.abs(date-now.getTime())<=36*3600000;
}
export function continuityLot(value:unknown,now=new Date()):StoredLot|null{
 if(!value||typeof value!=="object"||Array.isArray(value))return null;const lot=value as StoredLot;
 if(!continuityDay(lot.day,now)||!Array.isArray(lot.ids)||lot.ids.length>20||lot.ids.some(id=>typeof id!=="string"||!id||id.length>100)||new Set(lot.ids).size!==lot.ids.length)return null;
 return {day:lot.day,ids:[...lot.ids],locked:lot.locked===true};
}
/** Pick only comfort metadata; no extra text from a client enters the account checkpoint. */
export function continuitySession(value:unknown,now=new Date()):RadarSession|null{
 if(!value||typeof value!=="object"||Array.isArray(value))return null;const candidate=value as RadarSession;
 if(!continuityDay(candidate.day,now))return null;
 const session=readSession(JSON.stringify(candidate),now.getTime(),candidate.day);if(!session)return null;
 return {id:session.id,day:session.day,startedAt:session.startedAt,activeMs:session.activeMs,resumedAt:session.resumedAt,steps:session.steps,current:session.current,initial:{decisions:session.initial.decisions,visits:session.initial.visits,approved:session.initial.approved,...(session.initial.care?{care:session.initial.care}:{})},sent:session.sent,paused:session.paused};
}
export function continuityState(userId:string,profile:Record<string,unknown>,now=new Date()):RadarContinuity{
 const saved=profile.radarContinuity as Partial<RadarContinuity>|undefined;
 const version=(value:unknown)=>Number.isInteger(value)&&Number(value)>=0?Number(value):0;
 return {ownerId:userId,lot:continuityLot(saved?.lot,now),lotVersion:version(saved?.lotVersion),session:continuitySession(saved?.session,now),sessionVersion:version(saved?.sessionVersion)};
}
