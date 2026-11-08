import {getDb} from "@/db";
import {activityEvents,interviews,jobs,workspaceWrites} from "@/db/schema";
import {assessJob,createFingerprint} from "./matching";
import {normalizeJobInput} from "./server";
import {fromZonedInput} from "./application-workflow";
import {monthDay,shiftMonth} from "./month-story";
import {weekKey,type WeekPlan} from "./week-plan";
import {weekMonday} from "./week-series";
function dates(now:Date,zone:string){const month=shiftMonth(monthDay(now,zone).slice(0,7),-1);return (day:number,hour=12)=>fromZonedInput(`${month}-${String(day).padStart(2,"0")}T${String(hour).padStart(2,"0")}:00`,zone);}
export function demoMonthPlans(now=new Date(),zone="Europe/Paris"):WeekPlan[]{const at=dates(now,zone);return [8,15].map(day=>{const week=weekKey(new Date(at(day)),zone),monday=weekMonday(week)!,date=monday.toISOString().slice(0,10),done=new Date(monday.getTime()+3*86400000).toISOString();return {week,timeZone:zone,rhythm:"calm",commitments:[{id:`${week}-care`,when:date+"T10:00",action:"care",label:"Soigner un dossier entièrement fictif",doneAt:done},{id:`${week}-review`,when:date+"T11:00",action:"review",label:"Relire un bilan entièrement fictif",doneAt:done}]};});}
/** Only called after ensureRecruiterDemo's empty-workspace guard. */
export async function seedMonthStoryFacts(userId:string,now=new Date(),zone="Europe/Paris"){
 if(!userId.startsWith("demo:"))throw new Error("Données fictives uniquement.");const db=getDb(),at=dates(now,zone),source="Récit fictif";
 for(let index=0;index<12;index++){
  const title=index===0?"Product Owner senior · Plateforme de services et d’accompagnement des entreprises, parcours entièrement fictif pour vérifier les intitulés longs dans le récit mensuel de recherche":`Product Owner · Tri mensuel fictif ${index+1}`,input=normalizeJobInput({title,company:index===0?"Atelier du récit · entreprise entièrement fictive":`Atelier mensuel fictif ${index+1}`,source,contractType:"cdi",remoteMode:"full_remote",language:"fr",salaryMin:62000,salaryMax:70000,description:"Annonce entièrement fictive de Product Owner senior. Pilotage de services B2B, découverte, priorisation et mesure des résultats. Aucun recrutement réel."}),assessment=assessJob(input),id=crypto.randomUUID(),decision=index===0?"selected":"later",createdAt=at(10+index);
  await db.insert(jobs).values({id,userId,fingerprint:createFingerprint(input),...input,status:"new",reviewState:decision,createdAt,updatedAt:createdAt,matchScore:assessment.score,matchTier:assessment.tier,reasons:JSON.stringify(assessment.reasons),flags:JSON.stringify(assessment.flags)});
  await db.insert(activityEvents).values({id:crypto.randomUUID(),userId,action:"offer_sorted",objectType:"job",objectId:id,createdAt,data:{decision,source,fictional:true}});
 }
 for(let index=0;index<3;index++){
  const input=normalizeJobInput({title:`Product Manager · Préparation mensuelle fictive ${index+1}`,company:`Équipe mensuelle fictive ${index+1}`,source,contractType:"cdi",remoteMode:"full_remote",language:"fr",annualSalary:68000,description:"Candidature entièrement fictive pour le récit du mois, sans entreprise ni recrutement réels."}),assessment=assessJob(input),id=crypto.randomUUID(),appliedAt=at(8+index),careAt=at(11+index);
  await db.insert(jobs).values({id,userId,fingerprint:createFingerprint(input),...input,status:index<2?"interview":"awaiting_response",reviewState:"selected",appliedAt,createdAt:appliedAt,updatedAt:careAt,matchScore:assessment.score,matchTier:assessment.tier,reasons:JSON.stringify(assessment.reasons),flags:JSON.stringify(assessment.flags)});
  await db.insert(activityEvents).values({id:crypto.randomUUID(),userId,action:"application_sent",objectType:"job",objectId:id,createdAt:appliedAt,data:{source,fictional:true}});
  await db.insert(workspaceWrites).values({userId,key:`application:care:${id}`,version:1,value:JSON.stringify({cv:true,message:true,contact:false,questions:true}),createdAt:careAt});
  await db.insert(activityEvents).values({id:crypto.randomUUID(),userId,action:"application_cared",objectType:"job",objectId:id,createdAt:careAt,data:{score:3,source,fictional:true}});
  if(index<2){const meeting=crypto.randomUUID(),startAt=at(15+index*3,10),endAt=new Date(Date.parse(startAt)+3600000).toISOString(),notedAt=at(16+index*3);
   await db.insert(interviews).values({id:meeting,userId,jobId:id,label:"Échange mensuel entièrement fictif",startAt,endAt,timeZone:zone,format:"video",state:"reviewed",data:JSON.stringify({summary:"Bilan d’échange fictif pour le récit du mois.",outcome:"waiting"}),updatedAt:notedAt});
   for(const [action,createdAt] of [["interview_scheduled",at(12+index*3)],["interview_noted",notedAt]])await db.insert(activityEvents).values({id:crypto.randomUUID(),userId,action,objectType:"interview",objectId:meeting,createdAt,data:{jobId:id,source,startAt,endAt,outcome:"waiting",fictional:true}});
  }
 }
}
