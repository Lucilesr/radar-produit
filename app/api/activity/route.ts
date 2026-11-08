import {getChatGPTUser} from "@/app/chatgpt-auth";
import {ensureSameOrigin} from "@/lib/server";
import {declareActivity,readActivity} from "@/lib/activity-store";
import {ActivityQueryError} from "@/lib/activity-presentation";
const headers={"Cache-Control":"private, no-store"};
export async function GET(request:Request){const user=await getChatGPTUser();if(!user)return Response.json({error:"Authentification requise"},{status:401,headers});try{const params=new URL(request.url).searchParams;return Response.json(await readActivity(user.userId,params.get("cursor"),{filter:params.get("filter"),zone:params.get("zone")}),{headers});}catch(error){return Response.json({error:error instanceof ActivityQueryError?error.message:"Le journal n’a pas pu être relu. Vos autres données restent accessibles."},{status:error instanceof ActivityQueryError?400:503,headers});}}

export async function POST(request:Request){const user=await getChatGPTUser();if(!user)return Response.json({error:"Authentification requise"},{status:401,headers});if(!ensureSameOrigin(request))return Response.json({error:"Origine non autorisée"},{status:403,headers});try{const text=await request.text();if(text.length>2000)return Response.json({error:"Action trop volumineuse"},{status:413,headers});return Response.json(await declareActivity(user.userId,JSON.parse(text)),{headers});}catch{return Response.json({error:"Action non confirmée. Relisez la candidature ou réessayez la fin de séance."},{status:409,headers});}}
