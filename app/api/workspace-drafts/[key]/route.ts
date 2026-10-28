import { getChatGPTUser } from "@/app/chatgpt-auth";
import { ensureSameOrigin } from "@/lib/server";
import { ownsWorkspaceKey, readWorkspaceWrite, saveWorkspaceWrite, workspaceHistory } from "@/lib/workspace-write-store";
type Context = {params:Promise<{key:string}>};
export async function GET(request:Request,context:Context) {
  const user=await getChatGPTUser();if(!user)return Response.json({error:"Authentification requise"},{status:401});
  const {key}=await context.params;
  try {
    if(!await ownsWorkspaceKey(user.userId,key))return Response.json({error:"Dossier introuvable"},{status:404});
    if(new URL(request.url).searchParams.has("history"))return Response.json({history:await workspaceHistory(user.userId,key)});
    return Response.json(await readWorkspaceWrite(user.userId,key));
  } catch {return Response.json({error:"Chargement indisponible. Votre brouillon local est conservé."},{status:503});}
}
export async function PUT(request:Request,context:Context) {
  const user=await getChatGPTUser();if(!user)return Response.json({error:"Authentification requise"},{status:401});
  if(!ensureSameOrigin(request))return Response.json({error:"Origine non autorisée"},{status:403});
  const {key}=await context.params;
  try {
    if(!await ownsWorkspaceKey(user.userId,key))return Response.json({error:"Dossier introuvable"},{status:404});
    const raw=await request.text();if(raw.length>70000)return Response.json({error:"Texte trop long"},{status:413});
    const body=JSON.parse(raw),limit=key.startsWith("note:")?2000:30000;
    if(typeof body.value!=="string"||body.value.length>limit||typeof body.base!=="string"||!Number.isSafeInteger(body.version)||body.version<0)return Response.json({error:"Texte ou version invalide"},{status:400});
    const result=await saveWorkspaceWrite(user.userId,key,body.value,body.version,body.base);
    return result?Response.json(result):Response.json({error:"Ce texte a changé dans un autre onglet. Les deux versions sont conservées.",current:await readWorkspaceWrite(user.userId,key)},{status:409});
  } catch {return Response.json({error:"Enregistrement non confirmé. Votre saisie est conservée."},{status:503});}
}
