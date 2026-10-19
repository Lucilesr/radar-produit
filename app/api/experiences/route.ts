import { getChatGPTUser } from "@/app/chatgpt-auth";
import { ensureSameOrigin } from "@/lib/server";
import { history, importExtraction, library, mutateLibrary } from "@/lib/experience-store";
import { ReviewBlockedError } from "@/lib/experience-domain";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store"};
export async function GET(request:Request){
  const user=await getChatGPTUser();if(!user)return Response.json({error:"Authentification requise"},{status:401,headers});
  try{const id=new URL(request.url).searchParams.get("history");return Response.json(id?{revisions:await history(user.userId,id)}:await library(user.userId),{headers});}
  catch{return Response.json({error:"Lecture du carnet impossible."},{status:503,headers});}
}
export async function POST(request:Request){
  const user=await getChatGPTUser();if(!user)return Response.json({error:"Authentification requise"},{status:401,headers});
  if(!ensureSameOrigin(request))return Response.json({error:"Origine non autorisée"},{status:403,headers});
  try{
    const raw=await request.text();if(new TextEncoder().encode(raw).length>1200000)return Response.json({error:"Requête trop volumineuse"},{status:413,headers});
    const body=JSON.parse(raw);
    return Response.json(body.action==="extract"?await importExtraction(user.userId,body.extraction):await mutateLibrary(user.userId,body),{headers});
  }catch(error){
    if(error instanceof ReviewBlockedError)return Response.json({error:error.message,issues:error.issues},{status:409,headers});
    const message=error instanceof Error&&!/SQL|D1|constraint|Zod|\[\s*\{/i.test(error.message)?error.message:"Écriture non confirmée ou version périmée. Rechargez le carnet avant de réessayer.";
    return Response.json({error:message},{status:409,headers});
  }
}
