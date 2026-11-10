import {env} from "cloudflare:workers";
import {profileTemplate} from "./profile-template";
import {activityStatement,activityReceiptId} from "./activity-store";
import {continuityLot,continuitySession,continuityState,type RadarContinuity} from "./radar-continuity";
const db=()=>env.DB as D1Database;
type Row={data:string};
export class ContinuityConflict extends Error{constructor(public state:RadarContinuity){super("Le point de reprise a changé dans un autre onglet ou appareil. Relisez l’état du compte avant de continuer.");}}
export async function readContinuity(userId:string,now=new Date()){const row=await db().prepare("SELECT data FROM profiles WHERE user_id=?").bind(userId).first<Row>();return continuityState(userId,row?JSON.parse(row.data):{},now);}
export async function writeContinuity(userId:string,raw:unknown,now=new Date()){
 if(!raw||typeof raw!=="object"||Array.isArray(raw))throw new Error("Point de reprise invalide.");
 const command=raw as {kind:string;owner:string;lot?:unknown;session?:unknown;version?:number;finish?:boolean;id?:string};
 if(command.owner!==userId)throw new Error("La connexion a changé. Rechargez votre espace.");
 if(!["lot","session"].includes(command.kind))throw new Error("Point de reprise invalide.");
 const lot=command.kind==="lot"?continuityLot(command.lot,now):null;
 const session=command.kind==="session"&&command.session!==null?continuitySession(command.session,now):null;
 if(command.kind==="lot"&&!lot||command.kind==="session"&&(command.session!==null&&!session||typeof command.version!=="number"||!Number.isInteger(command.version)||command.version<0))throw new Error("Point de reprise invalide ou périmé.");
 if(lot?.ids.length){const count=await db().prepare(`SELECT count(*) n FROM jobs WHERE user_id=? AND id IN (${lot.ids.map(()=>"?").join(",")})`).bind(userId,...lot.ids).first<{n:number}>();if(count?.n!==lot.ids.length)throw new Error("Le lot contient une offre indisponible. Relisez vos offres.");}
 await db().prepare("INSERT INTO profiles(user_id,data) VALUES(?,?) ON CONFLICT(user_id) DO NOTHING").bind(userId,JSON.stringify(profileTemplate)).run();
 for(let attempt=0;attempt<3;attempt++){
  const row=await db().prepare("SELECT data FROM profiles WHERE user_id=?").bind(userId).first<Row>();if(!row)throw new Error("Compte indisponible.");const state=continuityState(userId,JSON.parse(row.data),now),next={...state};
  let finish:{id:string;startedAt:number;minutes:number}|null=null;
  if(command.kind==="lot"){
   if(state.lot&&state.lot.day>lot!.day)throw new ContinuityConflict(state);
   if(state.lot?.day===lot!.day&&state.lot.locked&&state.lot.ids.length)return state;
   if(JSON.stringify(state.lot)===JSON.stringify(lot))return state;
   next.lot=lot;next.lotVersion++;
  }else{
   if(command.finish){
    if(typeof command.id!=="string"||!command.id)throw new ContinuityConflict(state);
    if(!state.session){const receipt=await activityReceiptId(userId,"session_ended",command.id,command.id);if(await db().prepare("SELECT id FROM activity_events WHERE id=? AND user_id=?").bind(receipt,userId).first())return state;throw new ContinuityConflict(state);}
    if(command.session!==null||state.session.id!==command.id)throw new ContinuityConflict(state);
    const duration=state.session.activeMs+(state.session.paused||state.session.resumedAt===null?0:Math.max(0,now.getTime()-state.session.resumedAt));
    finish={id:state.session.id,startedAt:state.session.startedAt,minutes:Math.min(1440,Math.max(1,Math.ceil(duration/60000)))};
   }
   if(JSON.stringify(state.session)===JSON.stringify(session)&&!finish)return state;
   if(command.version!==state.sessionVersion)throw new ContinuityConflict(state);
   if(state.session&&session&&(session.day<state.session.day||state.session.day===session.day&&state.session.id!==session.id))throw new ContinuityConflict(state);
   if(session&&!state.session){const receipt=await activityReceiptId(userId,"session_ended",session.id,session.id);if(await db().prepare("SELECT id FROM activity_events WHERE id=? AND user_id=?").bind(receipt,userId).first())throw new ContinuityConflict(state);}
   next.session=session;next.sessionVersion++;
  }
  const operations:D1PreparedStatement[]=[];
  if(finish)operations.push(activityStatement(userId,{id:await activityReceiptId(userId,"session_ended",finish.id,finish.id),action:"session_ended",objectType:"session",objectId:finish.id,createdAt:now.toISOString(),data:{startedAt:new Date(finish.startedAt).toISOString(),minutes:finish.minutes}},"EXISTS(SELECT 1 FROM profiles WHERE user_id=? AND data=?)",[userId,row.data]));
  const {ownerId:_,...stored}=next;
  operations.push(db().prepare("UPDATE profiles SET data=json_set(data,'$.radarContinuity',json(?)),updated_at=? WHERE user_id=? AND data=? RETURNING user_id").bind(JSON.stringify(stored),now.toISOString(),userId,row.data));
  const result=await db().batch(operations);
  if(result.at(-1)?.results.length)return next;
 }
 throw new ContinuityConflict(await readContinuity(userId,now));
}
