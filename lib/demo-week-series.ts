import {weekKey,type WeekPlan} from "./week-plan";
import {shiftWeek,weekMonday,type SeriesSettings} from "./week-series";
/** Fictional account initialization only, never called for an existing workspace. */
export function demoWeekSeries(scenario:string|undefined,now=new Date()):{weekPlans:WeekPlan[];weekPlan:WeekPlan;weekSeries:SeriesSettings}|null{
 if(!scenario||!["weeks-held","weeks-joker","weeks-reset","weeks-pause","weeks-reduced"].includes(scenario))return null;
 const week=weekKey(now,"Europe/Paris"),offset=scenario==="weeks-joker"?-5:scenario==="weeks-reset"||scenario==="weeks-pause"?-6:-4;
 const plan=(key:string,complete:boolean):WeekPlan=>{const date=weekMonday(key)!.toISOString().slice(0,10);return {week:key,timeZone:"Europe/Paris",rhythm:"calm",commitments:[{id:`${key}-review`,when:date+"T10:00",action:"review",label:"Relire un dossier entièrement fictif",doneAt:now.toISOString()},{id:`${key}-write`,when:date+"T11:00",action:"write",label:"Écrire une histoire entièrement fictive",...(complete?{doneAt:now.toISOString()}:{})}]};};
 return {weekPlans:Array.from({length:4},(_,i)=>plan(shiftWeek(week,offset+i),true)),weekPlan:plan(week,false),weekSeries:{version:0,startedWeek:shiftWeek(week,offset),timeZone:"Europe/Paris",pausedWeeks:scenario==="weeks-pause"?[-2,-1,0,1].map(i=>shiftWeek(week,i)):[]}};
}
