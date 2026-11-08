import {getChatGPTUser} from "@/app/chatgpt-auth";
import {readApplicationFunnel} from "@/lib/application-funnel-store";
export async function GET(){const user=await getChatGPTUser(),headers={"Cache-Control":"private, no-store"};if(!user)return Response.json({error:"Authentification requise"},{status:401,headers});try{return Response.json({funnel:await readApplicationFunnel(user.userId)},{headers});}catch{return Response.json({error:"Votre entonnoir ne peut pas être relu. Vos candidatures restent conservées."},{status:503,headers});}}
