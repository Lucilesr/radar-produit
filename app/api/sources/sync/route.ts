import { getChatGPTUser } from "@/app/chatgpt-auth";
import { ensureSameOrigin } from "@/lib/server";
import { syncAuthorizedFeeds } from "@/lib/source-store";
import { cookies } from "next/headers";
import { syncDemoSources } from "@/lib/demo-scan";
import { demoScenario } from "@/lib/demo-scenarios";
import {demoScanSources} from "@/lib/demo-scan-plan";
import { automaticSources } from "@/lib/source-sync";
import { z } from "zod";

export async function POST(request: Request) {
  const user=await getChatGPTUser();
  if(!user)return Response.json({error:"Authentification requise"},{status:401});
  if(!ensureSameOrigin(request))return Response.json({error:"Origine non autorisée"},{status:403});
  let input;
  try{const raw=await request.text();if(raw.length>256)throw new Error();input=z.object({source:z.enum(user.userId.startsWith("demo:")?demoScanSources:automaticSources).optional(),retry:z.boolean().optional()}).strict().parse(raw?JSON.parse(raw):{});}
  catch{return Response.json({error:"Source de balayage invalide."},{status:400});}
  try{
    const result=user.userId.startsWith("demo:")
      ?await syncDemoSources(user.userId,demoScenario((await cookies()).get("radar_demo_mode")?.value),input.source,input.retry)
      :await syncAuthorizedFeeds(user.userId,input.source as typeof automaticSources[number]|undefined);
    return Response.json({...result,...(result.allFailed?{error:"Aucune source n’a pu être actualisée. Vos offres existantes sont conservées."}:{})},{status:result.allFailed?503:200,headers:{"Cache-Control":"private, no-store"}});
  }catch{return Response.json({error:"Les flux n’ont pas pu être actualisés. Vos offres existantes sont conservées."},{status:503});}
}
