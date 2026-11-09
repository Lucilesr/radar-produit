import {fromZonedInput} from "./application-workflow";
import {planHeld,validTimeZone,type WeekPlan} from "./week-plan";
import type {ActivityEvent} from "./activity";
export type MonthGem={id:string;title:string;company:string};
export type MonthStory={month:string;label:string;timeZone:string;start:string;end:string;sorted:number;cared:number;interviews:number;weeks:number;gem:MonthGem|null;firstKnownAt:string|null;partial:boolean};
export type MonthStoryData={story:MonthStory;months:Array<{value:string;label:string}>;homeVisible:boolean;simulatedDate:string|null};
export function isMonth(value:unknown):value is string{return typeof value==="string"&&/^\d{4}-(0[1-9]|1[0-2])$/.test(value)&&Number(value.slice(0,4))>=1970;}
export function monthLabel(month:string){if(!isMonth(month))throw new Error("Mois invalide.");return new Intl.DateTimeFormat("fr-FR",{month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(`${month}-15T12:00:00Z`));}
export function monthStoryTitle(label:string){return `Votre mois ${/^[aâàéèêëeéiîïoôöuûüy]/i.test(label)?"d’":"de "}${label}`;}
export function monthDay(date:Date|number,zone="UTC"){const parts=new Intl.DateTimeFormat("en-CA",{timeZone:zone,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(date),get=(key:string)=>parts.find(part=>part.type===key)!.value;return `${get("year")}-${get("month")}-${get("day")}`;}
export function shiftMonth(month:string,offset:number){if(!isMonth(month))throw new Error("Mois invalide.");return new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5))-1+offset,15)).toISOString().slice(0,7);}
export function monthWindow(month:string,zone="UTC"){if(!isMonth(month)||!validTimeZone(zone))throw new Error("Mois ou fuseau invalide.");return {start:fromZonedInput(`${month}-01T00:00`,zone),end:fromZonedInput(`${shiftMonth(month,1)}-01T00:00`,zone)};}
/** The demonstration moves only this story's calendar, never the rest of Radar. */
export function monthStoryClock(userId:string,mode:string|undefined,now=new Date(),zone="UTC"){return userId.startsWith("demo:")&&mode==="month-story"?new Date(fromZonedInput(`${monthDay(now,zone).slice(0,7)}-01T12:00`,zone)):now;}
export function storyHomeVisible(now:Date,zone="UTC"){return Number(monthDay(now,zone).slice(8))<=7;}
function periodEvents(events:ActivityEvent[],start:string,end:string){const a=Date.parse(start),b=Date.parse(end),seen=new Set<string>();return events.filter(event=>{const at=Date.parse(event.createdAt);if(seen.has(event.id)||!Number.isFinite(at)||at<a||at>=b)return false;seen.add(event.id);return true;}).sort((x,y)=>Date.parse(x.createdAt)-Date.parse(y.createdAt)||x.id.localeCompare(y.id));}
/** A restoration within the month cancels the preceding sort for this recap. */
export function monthDecisions(events:ActivityEvent[],start:string,end:string){const latest=new Map<string,ActivityEvent>();for(const event of periodEvents(events,start,end))if(event.objectType==="job"&&["offer_sorted","offer_restored"].includes(event.action))latest.set(event.objectId,event);return [...latest.values()].filter(event=>event.action==="offer_sorted");}
export function heldPlanDates(plans:WeekPlan[]){const byWeek=new Map<string,WeekPlan>();for(const plan of plans)if(plan&&typeof plan.week==="string")byWeek.set(plan.week,plan);return [...byWeek.values()].filter(plan=>Array.isArray(plan.commitments)&&planHeld(plan)&&plan.commitments.every(item=>typeof item.doneAt==="string"&&Number.isFinite(Date.parse(item.doneAt)))).map(plan=>({week:plan.week,at:new Date(Math.max(...plan.commitments.map(item=>Date.parse(item.doneAt!)))).toISOString()}));}
export function buildMonthStory(month:string,zone:string,events:ActivityEvent[],plans:WeekPlan[],firstKnownAt:string|null,gem:MonthGem|null=null):MonthStory{
 const {start,end}=monthWindow(month,zone),rows=periodEvents(events,start,end),dates=heldPlanDates(plans),a=Date.parse(start),b=Date.parse(end);
 return {month,label:monthLabel(month),timeZone:zone,start,end,sorted:monthDecisions(rows,start,end).length,cared:new Set(rows.filter(event=>event.action==="application_cared"&&event.objectType==="job"&&typeof event.data.score==="number"&&event.data.score>=3).map(event=>event.objectId)).size,interviews:new Set(rows.filter(event=>event.action==="interview_noted"&&event.objectType==="interview").map(event=>event.objectId)).size,weeks:dates.filter(date=>Date.parse(date.at)>=a&&Date.parse(date.at)<b).length,gem,firstKnownAt,partial:!firstKnownAt||!Number.isFinite(Date.parse(firstKnownAt))||Date.parse(firstKnownAt)>a};
}
export function availableStoryMonths(firstKnownAt:string|null,latest:string,zone="UTC"){let first=firstKnownAt&&Number.isFinite(Date.parse(firstKnownAt))?monthDay(new Date(firstKnownAt),zone).slice(0,7):latest;if(!isMonth(first)||first>latest)first=latest;const months=[];for(let month=latest;month>=first;month=shiftMonth(month,-1)){months.push({value:month,label:monthLabel(month)});if(month==="1970-01")break;}return months;}
export function monthStoryCards(story:MonthStory){return [
 {title:"Offres triées",value:story.sorted,detail:story.sorted?"Des décisions prises pour faire de la place à ce qui vous convient.":"Aucun tri enregistré sur cette période. Vous avancez à votre rythme."},
 {title:"Check-lists d’envoi",value:story.cared,detail:"Candidatures avec au moins 3 points cochés sur 4, envoyées ou non. Une offre compte une fois."},
 {title:"Entretiens",value:story.interviews,detail:"Échanges dont vous avez noté le bilan pendant ce mois. Plusieurs notes du même entretien comptent une fois."},
 {title:"Semaines tenues",value:story.weeks,detail:"Plans dont tous les engagements ont été cochés sur cette période. Vous choisissez votre rythme."},
 {title:"Votre pépite du mois",value:null,detail:story.gem?"Une offre sélectionnée ce mois-ci, toujours accessible dans votre Radar.":"Pas de pépite sélectionnée pour ce mois. La prochaine peut encore arriver."},
 ];}
