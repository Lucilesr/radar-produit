import {env} from "cloudflare:workers";
import {archivePlan,carryDone,validateWeekPlan,weekKey,type WeekPlanState,type WeekPlan} from "./week-plan";
import {profileTemplate} from "./profile-template";
const db=()=>env.DB as D1Database;
type Row={data:string};
export function weekPlanState(raw:string|null|undefined):WeekPlanState{const data=raw?JSON.parse(raw):{};return {version:Number.isInteger(data.weekPlanRevision)?data.weekPlanRevision:0,plan:data.weekPlan??null,history:Array.isArray(data.weekPlans)?data.weekPlans:[]};}
export async function readWeekPlan(userId:string){const row=await db().prepare("SELECT data FROM profiles WHERE user_id=?").bind(userId).first<Row>();return weekPlanState(row?.data);}
export class WeekPlanConflict extends Error {constructor(public state:WeekPlanState){super("Le plan a changé dans un autre onglet. Votre brouillon est conservé ; relisez le plan enregistré avant de réessayer.");}}
export async function writeWeekPlan(userId:string,command:{version:number;plan?:unknown;id?:string;done?:boolean},now=new Date()){
 if(!command||typeof command!=="object"||!Number.isInteger(command.version)||command.version<0)throw new Error("Version du plan invalide.");
 await db().prepare("INSERT INTO profiles(user_id,data,updated_at) VALUES(?,?,?) ON CONFLICT(user_id) DO NOTHING").bind(userId,JSON.stringify(profileTemplate),now.toISOString()).run();
 const row=await db().prepare("SELECT data FROM profiles WHERE user_id=?").bind(userId).first<Row>();
 if(!row)throw new Error("Le plan n’a pas pu être relu.");
 const state=weekPlanState(row.data);let plan:WeekPlan,history=state.history;
 if(command.plan!==undefined){plan=carryDone(state.plan,validateWeekPlan(command.plan,now));history=archivePlan(history,state.plan,plan);if(JSON.stringify(plan)===JSON.stringify(state.plan))return state;}
 else {if(!state.plan||state.plan.week!==weekKey(now,state.plan.timeZone)||typeof command.done!=="boolean"||!state.plan.commitments.some(item=>item.id===command.id))throw new Error("Cet engagement n’appartient pas au plan de cette semaine.");
  if((state.plan.commitments.find(item=>item.id===command.id)?.doneAt!==undefined)===command.done)return state;
  plan={...state.plan,commitments:state.plan.commitments.map(item=>item.id===command.id?{...item,doneAt:command.done?now.toISOString():undefined}:item)};
 }
 if(command.version!==state.version)throw new WeekPlanConflict(state);
 const result=await db().prepare("UPDATE profiles SET data=json_set(data,'$.weekPlan',json(?),'$.weekPlans',json(?),'$.weekPlanRevision',?),updated_at=? WHERE user_id=? AND data=?").bind(JSON.stringify(plan),JSON.stringify(history),state.version+1,now.toISOString(),userId,row.data).run();
 if(!result.meta.changes)throw new WeekPlanConflict(await readWeekPlan(userId));
 return {version:state.version+1,plan,history};
}
