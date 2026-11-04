import { getChatGPTUser } from "@/app/chatgpt-auth";
import { ensureSameOrigin } from "@/lib/server";
import { syncAuthorizedFeeds } from "@/lib/source-store";
export async function POST(request: Request) { const user = await getChatGPTUser(); if (!user) return Response.json({ error: "Authentification requise" }, { status: 401 }); if (!ensureSameOrigin(request)) return Response.json({ error: "Origine non autorisée" }, { status: 403 }); try { return Response.json(await syncAuthorizedFeeds(user.userId)); } catch { return Response.json({ error: "Les flux n’ont pas pu être actualisés. Les offres existantes sont conservées." }, { status: 503 }); } }
