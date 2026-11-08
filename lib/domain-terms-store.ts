import {env} from "cloudflare:workers";
import {library} from "./experience-store";
import {domainProposals,eligibleDomainItems,type DomainProposal} from "./domain-suggestions";
import {confirmedDomainTerms,ignoredDomainTerms} from "./domain-term-actions";
import {maxDomainTerms,normalizeDomainTerms,searchPreferences} from "./search-preferences";
import {foldTerm} from "./search-tracks";
import {profileTemplate} from "./profile-template";
const db=()=>env.DB as D1Database;
export class DomainTermConflict extends Error {}
export async function readDomainTerms(userId:string){const [row,state]=await Promise.all([db().prepare("SELECT data FROM profiles WHERE user_id=?").bind(userId).first<{data:string}>(),library(userId)]);const profile=row?JSON.parse(row.data):{},search=searchPreferences(profile.searchPreferences),ignored=ignoredDomainTerms(profile.ignoredDomainTerms);return {terms:normalizeDomainTerms(search.domainTerms),ignoredTerms:ignored,proposals:domainProposals(state,search,ignored),eligibleCount:eligibleDomainItems(state).length,totalItems:state.items.length};}
export async function writeDomainTerm(userId:string,raw:unknown){
 if(!raw||typeof raw!=="object"||Array.isArray(raw))throw new Error("Choisissez un terme.");
 const command=raw as {action?:string;term?:string;sourceId?:string;sourceVersion?:number;proposals?:DomainProposal[]};
 const action=command.action,term=normalizeDomainTerms([command.term])[0];
 if(!['confirm','confirmMany','remove','ignore','restore'].includes(action??'')||(action!=='confirmMany'&&!term))throw new Error("Terme invalide.");
 const requested=action==='confirmMany'?command.proposals:action==='confirm'?[command]:[];
 if(!Array.isArray(requested)||requested.length>80||(action==='confirmMany'&&!requested.length)||requested.some(p=>!p||typeof p.term!=='string'||typeof p.sourceId!=='string'||p.sourceId.length>250||!Number.isInteger(p.sourceVersion)||Number(p.sourceVersion)<1))throw new Error("Relisez les propositions avant de les confirmer.");
 if(action==='ignore'&&!ignoredDomainTerms([term]).length)throw new Error('Ce terme ne fait pas partie des propositions.');
 await db().prepare("INSERT INTO profiles(user_id,data) VALUES(?,?) ON CONFLICT(user_id) DO NOTHING").bind(userId,JSON.stringify(profileTemplate)).run();
 for(let attempt=0;attempt<3;attempt++){
  const row=await db().prepare("SELECT data FROM profiles WHERE user_id=?").bind(userId).first<{data:string}>();if(!row)throw new Error("Critères indisponibles.");
  const profile=JSON.parse(row.data),search=searchPreferences(profile.searchPreferences),terms=normalizeDomainTerms(search.domainTerms),ignored=ignoredDomainTerms(profile.ignoredDomainTerms),key=foldTerm(term??'');
  let next=terms,nextIgnored=ignored,proof='';const proofArgs:unknown[]=[];
  if(action==='confirm'||action==='confirmMany'){
   const state=await library(userId),available=domainProposals(state,search,ignored),accepted:DomainProposal[]=[];
   for(const wanted of requested){
    const wantedKey=foldTerm(wanted.term!);
    if(terms.some(value=>foldTerm(value)===wantedKey)||(search.boostKeywords??[]).some(value=>foldTerm(value)===wantedKey))continue;
    if(terms.length>=maxDomainTerms)throw new Error('Quarante termes sont déjà confirmés. Retirez-en un avant d’en ajouter un autre.');
    const proposal=available.find(value=>foldTerm(value.term)===wantedKey&&value.sourceId===wanted.sourceId);
    if(!proposal||proposal.sourceVersion!==wanted.sourceVersion)throw new DomainTermConflict('L’expérience, ses droits ou vos choix ont changé. Relisez les propositions ; aucun terme n’a été ajouté.');
    if(!accepted.some(value=>foldTerm(value.term)===wantedKey))accepted.push(proposal);
   }
   if(!accepted.length)return readDomainTerms(userId);
   next=confirmedDomainTerms(terms,accepted);
   for(const proposal of accepted){
    // All source consents and versions are checked in the same atomic profile write.
    proof+=" AND EXISTS(SELECT 1 FROM experience_items e WHERE e.user_id=? AND e.id=? AND e.version=? AND e.validation='approved' AND e.application_allowed=1 AND (e.parent_id IS NULL OR EXISTS(SELECT 1 FROM experience_items p WHERE p.user_id=e.user_id AND p.id=e.parent_id AND p.validation='approved' AND p.application_allowed=1 AND p.version=?)) AND NOT EXISTS(SELECT 1 FROM experience_conflicts c WHERE c.user_id=e.user_id AND c.state='open' AND (c.left_id IN(e.id,e.parent_id) OR c.right_id IN(e.id,e.parent_id))))";
    proofArgs.push(userId,proposal.sourceId,proposal.sourceVersion,proposal.parentVersion??0);
   }
  }else if(action==='remove')next=terms.filter(value=>foldTerm(value)!==key);
  else if(action==='ignore')nextIgnored=ignoredDomainTerms([...ignored,term]);
  else nextIgnored=ignored.filter(value=>foldTerm(value)!==key);
  if(JSON.stringify(next)===JSON.stringify(terms)&&JSON.stringify(nextIgnored)===JSON.stringify(ignored))return readDomainTerms(userId);
  const result=await db().prepare("UPDATE profiles SET data=json_set(data,'$.searchPreferences.domainTerms',json(?),'$.ignoredDomainTerms',json(?)),updated_at=? WHERE user_id=? AND data=?"+proof).bind(JSON.stringify(next),JSON.stringify(nextIgnored),new Date().toISOString(),userId,row.data,...proofArgs).run();
  if(result.meta.changes)return readDomainTerms(userId);
 }
 throw new DomainTermConflict("Les critères ont changé pendant l’enregistrement. Relisez avant de réessayer.");
}
