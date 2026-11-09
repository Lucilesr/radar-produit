export const weekRhythms = [
  { value: "calm", label: "Tranquille · 2 engagements", emoji: "🌿", count: 2 },
  { value: "regular", label: "Régulier · 3 engagements", emoji: "👟", count: 3 },
  { value: "intense", label: "Intense · 4 engagements", emoji: "🚀", count: 4 },
] as const;
export const weekActions = [{value:"followup",label:"je relance"},{value:"care",label:"je coche ma check-list"},{value:"visit",label:"je visite"},{value:"write",label:"j’écris"},{value:"prepare",label:"je prépare"},{value:"review",label:"je fais le bilan"}] as const;
export type WeekAction = typeof weekActions[number]["value"];
export type WeekCommitment = {id:string;when:string;action:WeekAction;targetId?:string;targetType?:"job"|"source"|"story";label:string;doneAt?:string};
export type WeekPlan = {week:string;timeZone:string;rhythm:typeof weekRhythms[number]["value"];commitments:WeekCommitment[]};
export type WeekPlanState = {version:number;plan:WeekPlan|null;history:WeekPlan[]};
export function weekKey(date:Date|number=new Date(),timeZone="UTC"){
 const parts=new Intl.DateTimeFormat("en-CA",{timeZone,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(date);
 const part=(key:string)=>Number(parts.find(part=>part.type===key)?.value);
 const day=new Date(Date.UTC(part("year"),part("month")-1,part("day")));
 day.setUTCDate(day.getUTCDate()+4-(day.getUTCDay()||7));
 const year=day.getUTCFullYear(),start=new Date(Date.UTC(year,0,1));
 return `${year}-W${String(Math.ceil(((day.getTime()-start.getTime())/86400000+1)/7)).padStart(2,"0")}`;
}
export function validTimeZone(value:unknown):value is string{try{if(typeof value!=="string"||value.length>100)return false;new Intl.DateTimeFormat("fr",{timeZone:value}).format();return true;}catch{return false;}}
export function planHeld(plan:WeekPlan|null|undefined){return !!plan&&plan.commitments.length===(weekRhythms.find(r=>r.value===plan.rhythm)?.count??0)&&plan.commitments.every(item=>!!item.doneAt);}
export function validateWeekPlan(raw:unknown,now=new Date()):WeekPlan{
 if(!raw||typeof raw!=="object")throw new Error("Choisissez votre rythme et vos engagements.");
 const plan=raw as WeekPlan,rhythm=weekRhythms.find(r=>r.value===plan.rhythm);
 if(!validTimeZone(plan.timeZone)||plan.week!==weekKey(now,plan.timeZone)||!rhythm||!Array.isArray(plan.commitments)||plan.commitments.length!==rhythm.count)throw new Error("Le plan doit concerner cette semaine et contenir tous les engagements du rythme choisi.");
 const ids=new Set<string>();
 const commitments=plan.commitments.map(item=>{
  if(!item||typeof item.id!=="string"||!/^[\w-]{1,100}$/.test(item.id)||ids.has(item.id)||!weekActions.some(a=>a.value===item.action)||typeof item.label!=="string"||!item.label.trim()||item.label.length>300||typeof item.when!=="string"||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(item.when))throw new Error("Renseignez un horaire, une action et une cible pour chaque engagement.");
  ids.add(item.id);
  const date=new Date(item.when+":00Z");
  if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,16)!==item.when||weekKey(date,"UTC")!==plan.week)throw new Error("Choisissez une date valide dans la semaine du plan.");
  if(item.targetId!==undefined&&(typeof item.targetId!=="string"||item.targetId.length>200||!item.targetId))throw new Error("Cible invalide.");
  if(item.targetType!==undefined&&!["job","source","story"].includes(item.targetType))throw new Error("Cible invalide.");
  return {id:item.id,when:item.when,action:item.action,label:item.label.trim(),...(item.targetId?{targetId:item.targetId,targetType:item.targetType}:{} )};
 });
 return {week:plan.week,timeZone:plan.timeZone,rhythm:plan.rhythm,commitments};
}
export function carryDone(previous:WeekPlan|null,next:WeekPlan):WeekPlan{return {...next,commitments:next.commitments.map(item=>{const old=previous?.week===next.week?previous.commitments.find(old=>old.id===item.id):undefined;return old?.doneAt&&old.action===item.action&&old.targetId===item.targetId&&old.targetType===item.targetType&&old.label===item.label?{...item,doneAt:old.doneAt}:item;})};}
export function archivePlan(history:WeekPlan[],previous:WeekPlan|null,next:WeekPlan){return previous&&previous.week!==next.week?[...history.filter(plan=>plan.week!==previous.week),previous].sort((a,b)=>a.week.localeCompare(b.week)):history;}
export function commitmentOverdue(item:WeekCommitment,localNow:string){return !item.doneAt&&item.when<localNow;}
export function localDateTime(date=new Date()){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}T${String(date.getHours()).padStart(2,"0")}:${String(date.getMinutes()).padStart(2,"0")}`;}

export function localTimeInZone(date:Date|number,timeZone:string){const parts=new Intl.DateTimeFormat("en-CA",{timeZone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(date);const get=(key:string)=>parts.find(part=>part.type===key)?.value??"";return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;}
