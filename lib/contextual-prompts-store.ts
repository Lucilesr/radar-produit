import {env} from "cloudflare:workers";
import {profileTemplate} from "./profile-template";
import {postponePrompt,readPromptState} from "./contextual-prompts";
import {searchPreferences} from "./search-preferences";
const db=()=>env.DB as D1Database;
export class PromptConflict extends Error {}
export async function readContextualPrompts(userId:string){const row=await db().prepare("SELECT data FROM profiles WHERE user_id=?").bind(userId).first<{data:string}>();const profile=row?JSON.parse(row.data):profileTemplate;return {state:readPromptState(profile.contextualPrompts,Date.now()),searchPreferences:searchPreferences(profile.searchPreferences)};}
export async function writeContextualPrompt(userId:string,raw:unknown){
 if(!raw||typeof raw!=="object"||Array.isArray(raw))throw new Error("Proposition invalide.");
 const command=raw as {action?:string;key?:unknown;level?:unknown};
 if(command.action!=="later"&&command.action!=="level")throw new Error("Action invalide.");
 if(command.action==="level"&&!["confirmed","senior","lead","any"].includes(String(command.level)))throw new Error("Choisissez un niveau.");
 await db().prepare("INSERT INTO profiles(user_id,data) VALUES(?,?) ON CONFLICT(user_id) DO NOTHING").bind(userId,JSON.stringify(profileTemplate)).run();
 for(let attempt=0;attempt<3;attempt++){
  const row=await db().prepare("SELECT data FROM profiles WHERE user_id=?").bind(userId).first<{data:string}>();if(!row)throw new Error("Compte indisponible.");
  const profile=JSON.parse(row.data),now=Date.now(),search=searchPreferences(profile.searchPreferences);
  const state=command.action==="later"?postponePrompt(profile.contextualPrompts,command.key,now):readPromptState(profile.contextualPrompts,now);
  if(command.action==="level"&&(search.targetLevel||search.targetLevelAny))throw new PromptConflict("Le niveau a déjà changé. Relisez vos critères avant de le modifier.");
  const next=command.action==="level"?{...search,targetLevel:command.level==="any"?undefined:command.level,targetLevelAny:command.level==="any"?true:undefined,acceptLevelAbove:undefined}:search;
  const result=await db().prepare("UPDATE profiles SET data=json_set(data,'$.contextualPrompts',json(?),'$.searchPreferences',json(?)),updated_at=? WHERE user_id=? AND data=?").bind(JSON.stringify(state),JSON.stringify(next),new Date(now).toISOString(),userId,row.data).run();
  if(result.meta.changes)return readContextualPrompts(userId);
 }
 throw new PromptConflict("Vos choix ont changé. Relisez avant de réessayer.");
}
