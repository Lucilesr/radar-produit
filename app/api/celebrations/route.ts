import {getChatGPTUser} from "@/app/chatgpt-auth";
import {cookies} from "next/headers";
import {ensureSameOrigin} from "@/lib/server";
import {claimCelebration} from "@/lib/preferences-store";
import {progressEvent,celebrationDraw} from "@/lib/celebrations";
export async function POST(request:Request){const user=await getChatGPTUser();if(!user)return Response.json({error:"Authentification requise"},{status:401});if(!ensureSameOrigin(request))return Response.json({error:"Origine non autorisée"},{status:403});try{const event=progressEvent(await request.json());if(!event)return Response.json({error:"Action invalide."},{status:400});const mode=(await cookies()).get("radar_demo_mode")?.value;return Response.json(await claimCelebration(user.userId,event,Date.now(),celebrationDraw(user.userId,mode,Math.random())));}catch{return Response.json({accepted:false});}}
