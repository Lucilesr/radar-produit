import { getChatGPTUser } from "@/app/chatgpt-auth";
import { ensureSameOrigin } from "@/lib/server";
import { syncAuthorizedFeed } from "@/lib/source-store";
export async function POST(request: Request) { const user = await getChatGPTUser(); if (!user) return Response.json({ error: "Authentification requise" }, { status: 401 }); if (!ensureSameOrigin(request)) return Response.json({ error: "Origine non autorisée" }, { status: 403 }); try { return Response.json(await syncAuthorizedFeed(user.userId)); } catch { return Response.json({ error: "Le flux n’a pas pu être actualisé. Les offres existantes sont conservées." }, { status: 503 }); } }
