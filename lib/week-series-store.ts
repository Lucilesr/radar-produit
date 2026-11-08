import {env} from "cloudflare:workers";
import {profileTemplate} from "./profile-template";
import {seriesSettings,weekSeries,shiftWeek,type WeekSeries} from "./week-series";
import {validTimeZone,planHeld} from "./week-plan";
const db=()=>env.DB as D1Database;
export class WeekSeriesConflict extends Error{constructor(public state:WeekSeries){super("Votre série a changé dans un autre onglet. Relisez-la avant de choisir votre pause.");}}
export async function readWeekSeries(userId:string,now=new Date(),zone="UTC"){const row=await db().prepare("SELECT data FROM profiles WHERE user_id=?").bind(userId).first<{data:string}>();return weekSeries(row?JSON.parse(row.data):{},now,zone);}
export async function writeWeekSeries(userId:string,raw:unknown,now=new Date()){
 if(!raw||typeof raw!=="object")throw new Error("Choix invalide.");const command=raw as {version:number;action:string;weeks?:number;timeZone?:string};
 if(!Number.isInteger(command.version)||command.version<0||!["pause","resume","welcome"].includes(command.action)||command.timeZone!==undefined&&!validTimeZone(command.timeZone))throw new Error("Choix invalide.");
 if(command.action==="pause"&&(typeof command.weeks!=="number"||!Number.isInteger(command.weeks)||command.weeks<1||command.weeks>4))throw new Error("Choisissez une pause de 1 à 4 semaines.");
 await db().prepare("INSERT INTO profiles(user_id,data) VALUES(?,?) ON CONFLICT(user_id) DO NOTHING").bind(userId,JSON.stringify(profileTemplate)).run();
 for(let attempt=0;attempt<3;attempt++){
  const row=await db().prepare("SELECT data FROM profiles WHERE user_id=?").bind(userId).first<{data:string}>();if(!row)throw new Error("Compte indisponible.");const profile=JSON.parse(row.data),state=weekSeries(profile,now,command.timeZone),settings=seriesSettings(profile,now,command.timeZone),next={...settings};
  if(command.action==="welcome"&&state.welcomeSeen)return state;
  if(command.action==="resume"&&!state.pauseStart)return state;
  if(command.version!==state.version)throw new WeekSeriesConflict(state);
  if(command.action==="welcome")next.welcomeWeek=state.week;
  if(command.action==="resume")next.pausedWeeks=settings.pausedWeeks.filter(w=>w<state.week);
  if(command.action==="pause"){
   if(state.pauseStart)throw new WeekSeriesConflict(state);
   const start=profile.weekPlan?.week===state.week&&planHeld(profile.weekPlan)?shiftWeek(state.week,1):state.week;
   next.pausedWeeks=[...settings.pausedWeeks.filter(w=>w<state.week),...Array.from({length:command.weeks!},(_,i)=>shiftWeek(start,i))];
  }
  next.version++;
  const result=await db().prepare("UPDATE profiles SET data=json_set(data,'$.weekSeries',json(?)),updated_at=? WHERE user_id=? AND data=? RETURNING user_id").bind(JSON.stringify(next),now.toISOString(),userId,row.data).all();
  if(result.results.length)return weekSeries({...profile,weekSeries:next},now,command.timeZone);
 }
 throw new WeekSeriesConflict(await readWeekSeries(userId,now,command.timeZone));
}
