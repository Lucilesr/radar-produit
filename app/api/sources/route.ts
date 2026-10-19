import { getChatGPTUser } from "@/app/chatgpt-auth";
import { ensureSameOrigin } from "@/lib/server";
import { listSourceSettings, userSourceSetting } from "@/lib/source-store";
export async function GET() { const user = await getChatGPTUser(); if (!user) return Response.json({ error: "Authentification requise" }, { status: 401 }); return Response.json({ sources: await listSourceSettings(user.userId) }, { headers: { "Cache-Control": "private, no-store" } }); }
export async function POST(request: Request) { const user = await getChatGPTUser(); if (!user) return Response.json({ error: "Authentification requise" }, { status: 401 }); if (!ensureSameOrigin(request)) return Response.json({ error: "Origine non autorisée" }, { status: 403 }); try { return Response.json({ source: await userSourceSetting(user.userId, await request.json()) }); } catch { return Response.json({ error: "Configuration non enregistrée. Vérifiez les champs." }, { status: 400 }); } }
