import {getChatGPTUser} from "@/app/chatgpt-auth";
import {listApplicationLessons} from "@/lib/application-lesson-store";
export async function GET(request:Request){const user=await getChatGPTUser(),headers={"Cache-Control":"private, no-store"};if(!user)return Response.json({error:"Authentification requise"},{status:401,headers});try{return Response.json(await listApplicationLessons(user.userId,new URL(request.url).searchParams.get("cursor")),{headers});}catch{return Response.json({error:"Vos leçons ne peuvent pas être relues. Les bilans restent conservés."},{status:503,headers});}}
