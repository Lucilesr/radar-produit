import {getChatGPTUser} from "@/app/chatgpt-auth";
import {ensureSameOrigin} from "@/lib/server";
import {readPreferences,writePreferences} from "@/lib/preferences-store";
export async function GET(){const user=await getChatGPTUser();if(!user)return Response.json({error:"Authentification requise"},{status:401});try{return Response.json({preferences:await readPreferences(user.userId)});}catch{return Response.json({error:"Réglages indisponibles. Réessayez."},{status:500});}}
export async function PATCH(request:Request){const user=await getChatGPTUser();if(!user)return Response.json({error:"Authentification requise"},{status:401});if(!ensureSameOrigin(request))return Response.json({error:"Origine non autorisée"},{status:403});try{return Response.json({preferences:await writePreferences(user.userId,await request.json())});}catch(error){return Response.json({error:error instanceof Error?error.message:"Réglages non enregistrés."},{status:400});}}
