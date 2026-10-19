import { and,eq } from "drizzle-orm";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { jobs } from "@/db/schema";
import { ensureSameOrigin } from "@/lib/server";
import { approvedFacts } from "@/lib/experience-store";
import { briefOffer,createCandidateBrief } from "@/lib/candidate-brief";
import { listApplicationQuestions } from "@/lib/application-question-store";
export async function POST(request:Request){
  const headers={"Cache-Control":"private, no-store"};
  const user=await getChatGPTUser();if(!user)return Response.json({error:"Authentification requise"},{status:401,headers});
  if(!ensureSameOrigin(request))return Response.json({error:"Origine non autorisée"},{status:403,headers});
  try{
    const body=await request.json() as {jobId?:unknown;language?:unknown};
    if(typeof body.jobId!=="string")throw new Error("Offre requise");
    const [row]=await getDb().select({id:jobs.id,title:jobs.title,company:jobs.company,contractType:jobs.contractType,annualSalary:jobs.annualSalary,dailyRate:jobs.dailyRate,remoteMode:jobs.remoteMode,onsiteCadence:jobs.onsiteCadence,language:jobs.language,description:jobs.description,sourceUrl:jobs.sourceUrl,applicationUrl:jobs.applicationUrl}).from(jobs).where(and(eq(jobs.id,body.jobId),eq(jobs.userId,user.userId))).limit(1);
    if(!row)return Response.json({error:"Offre introuvable"},{status:404,headers});
    const [facts,questions]=await Promise.all([approvedFacts(user.userId,"application"),listApplicationQuestions(user.userId,body.jobId)]);
    const context={offer:briefOffer(row as Parameters<typeof briefOffer>[0]),facts,questions:questions.map(({question,characterLimit})=>({question,characterLimit}))};
    const language=body.language==="en"||(!body.language&&row.language!=="fr"&&row.language!=="unknown")?"en":"fr";
    return Response.json({brief:createCandidateBrief(context,language),factCount:facts.length},{headers});
  }catch{return Response.json({error:"Préparation impossible : aucune donnée privée n’a été envoyée."},{status:400,headers});}
}
