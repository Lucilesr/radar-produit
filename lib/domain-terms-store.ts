import {env} from "cloudflare:workers";
import {library} from "./experience-store";
import {domainProposals,eligibleDomainItems} from "./domain-suggestions";
import {maxDomainTerms,normalizeDomainTerms,searchPreferences} from "./search-preferences";
import {foldTerm} from "./search-tracks";
import {profileTemplate} from "./profile-template";
const db=()=>env.DB as D1Database;
export class DomainTermConflict extends Error {}
export async function readDomainTerms(userId:string){const [row,state]=await Promise.all([db().prepare("SELECT data FROM profiles WHERE user_id=?").bind(userId).first<{data:string}>(),library(userId)]);const search=searchPreferences(row?JSON.parse(row.data).searchPreferences:undefined);return {terms:normalizeDomainTerms(search.domainTerms),proposals:domainProposals(state,search),eligibleCount:eligibleDomainItems(state).length,totalItems:state.items.length};}
export async function writeDomainTerm(userId:string,raw:unknown){
 if(!raw||typeof raw!=="object"||Array.isArray(raw))throw new Error("Choisissez un terme à confirmer ou à retirer.");const command=raw as {action?:string;term?:string;sourceId?:string;sourceVersion?:number};
 const term=normalizeDomainTerms([command.term])[0];if(!term||!['confirm','remove'].includes(command.action??""))throw new Error("Terme invalide.");
 if(command.action==="confirm"&&(typeof command.sourceId!=="string"||command.sourceId.length>250||!Number.isInteger(command.sourceVersion)||Number(command.sourceVersion)<1))throw new Error("Relisez la proposition avant de la confirmer.");
 await db().prepare("INSERT INTO profiles(user_id,data) VALUES(?,?) ON CONFLICT(user_id) DO NOTHING").bind(userId,JSON.stringify(profileTemplate)).run();
 for(let attempt=0;attempt<3;attempt++){
  const row=await db().prepare("SELECT data FROM profiles WHERE user_id=?").bind(userId).first<{data:string}>();if(!row)throw new Error("Critères indisponibles.");const search=searchPreferences(JSON.parse(row.data).searchPreferences),terms=normalizeDomainTerms(search.domainTerms),key=foldTerm(term);
  let next=terms.filter(value=>foldTerm(value)!==key),proof="",proofArgs:unknown[]=[];
  if(command.action==="confirm"){
   if(terms.some(value=>foldTerm(value)===key)||(search.boostKeywords??[]).some(value=>foldTerm(value)===key))return readDomainTerms(userId);
   if(terms.length>=maxDomainTerms)throw new Error("Quarante termes sont déjà confirmés. Retirez-en un avant d’en ajouter un autre.");
   const state=await library(userId),proposal=domainProposals(state,search).find(value=>foldTerm(value.term)===key&&value.sourceId===command.sourceId);
   if(!proposal||proposal.sourceVersion!==command.sourceVersion)throw new DomainTermConflict("L’expérience ou ses droits ont changé. Les propositions vont être relues ; aucun terme n’a été ajouté.");
   next=[...terms,proposal.term];
   // Consent/version and open conflicts are checked in the same write as the criterion.
   proof=" AND EXISTS(SELECT 1 FROM experience_items e WHERE e.user_id=? AND e.id=? AND e.version=? AND e.validation='approved' AND e.application_allowed=1 AND (e.parent_id IS NULL OR EXISTS(SELECT 1 FROM experience_items p WHERE p.user_id=e.user_id AND p.id=e.parent_id AND p.validation='approved' AND p.application_allowed=1 AND p.version=?)) AND NOT EXISTS(SELECT 1 FROM experience_conflicts c WHERE c.user_id=e.user_id AND c.state='open' AND (c.left_id IN(e.id,e.parent_id) OR c.right_id IN(e.id,e.parent_id))))";
   proofArgs=[userId,proposal.sourceId,proposal.sourceVersion,proposal.parentVersion??0];
  }else if(next.length===terms.length)return readDomainTerms(userId);
  const result=await db().prepare("UPDATE profiles SET data=json_set(data,'$.searchPreferences.domainTerms',json(?)),updated_at=? WHERE user_id=? AND data=?"+proof).bind(JSON.stringify(next),new Date().toISOString(),userId,row.data,...proofArgs).run();
  if(result.meta.changes)return readDomainTerms(userId);
 }
 throw new DomainTermConflict("Les critères ont changé pendant l’enregistrement. Relisez les propositions avant de réessayer.");
}
