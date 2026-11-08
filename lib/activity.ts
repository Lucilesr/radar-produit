/** Private product history, not external telemetry. Values are facts acknowledged by Radar. */
export type ActivityAction="lesson_validated"|"application_cared"|"offer_sorted"|"offer_restored"|"application_sent"|"application_cancelled"|"application_stage_changed"|"interview_scheduled"|"interview_noted"|"followup_done"|"story_validated"|"fact_validated"|"commitment_checked"|"commitment_unchecked"|"session_ended"|"offer_archived"|"search_role_added"|"search_role_removed"|"interview_cancelled";
export type ActivityData=Record<string,string|number|boolean|null>;
export type ActivityEvent={id:string;action:ActivityAction;objectType:string;objectId:string;createdAt:string;data:ActivityData;label?:string;company?:string};
export function activityLabel(action:string,data:ActivityData={}){
 if(action==="offer_sorted")return data.decision==="selected"?"Offre sélectionnée":data.decision==="later"?"Offre gardée pour plus tard":"Offre écartée";
 return ({lesson_validated:"Bilan après refus validé",application_cared:"Candidature soignée",offer_archived:"Offre archivée",search_role_added:"Poste ajouté à la recherche",search_role_removed:"Ajout de poste annulé",interview_cancelled:"Entretien annulé",offer_restored:"Offre restaurée",application_sent:"Candidature envoyée",application_cancelled:"Envoi de candidature annulé",application_stage_changed:"Étape de candidature modifiée",interview_scheduled:"Entretien programmé",interview_noted:"Bilan d’entretien noté",followup_done:"Relance faite",story_validated:"Histoire validée",fact_validated:"Bloc du carnet validé",commitment_checked:"Engagement coché",commitment_unchecked:"Engagement remis à faire",session_ended:"Séance terminée"} as Record<string,string>)[action]??"Action enregistrée";
}
/** Only a real transition gets a receipt; changing a board column alone is not a new application. */
export function jobActivity(before:{status:string;appliedAt?:string;reviewState?:string},after:{status:string;appliedAt?:string;reviewState?:string}):{action:ActivityAction;data:ActivityData}|null{
 if(!before.appliedAt&&after.appliedAt)return {action:"application_sent",data:{}};
 if(before.appliedAt&&!after.appliedAt)return {action:"application_cancelled",data:{}};
 if(before.reviewState!==after.reviewState&&["selected","later"].includes(after.reviewState??""))return {action:"offer_sorted",data:{decision:after.reviewState!}};
 if(before.reviewState!==after.reviewState&&after.reviewState==="reopened")return {action:"offer_restored",data:{}};
 if(before.status!==after.status)return {action:"application_stage_changed",data:{from:before.status,to:after.status}};
 return null;
}
export function activityCursor(value:unknown):[string,string]|null{
 if(typeof value!=="string"||!value||value.length>1000)return null;
 try{const parsed=JSON.parse(atob(value));return Array.isArray(parsed)&&parsed.length===2&&typeof parsed[0]==="string"&&Number.isFinite(Date.parse(parsed[0]))&&typeof parsed[1]==="string"&&parsed[1].length<=250?parsed as [string,string]:null;}catch{return null;}
}

export async function activityReceiptId(userId:string,action:string,objectId:string,stamp:string){return [...new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(JSON.stringify([userId,action,objectId,stamp]))))].map(byte=>byte.toString(16).padStart(2,"0")).join("");}
