import { getChatGPTUser } from "@/app/chatgpt-auth";
import { parseOfferText } from "@/lib/offer-parser";
import { ensureSameOrigin } from "@/lib/server";

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Authentification requise" }, { status: 401 });
  if (!ensureSameOrigin(request)) return Response.json({ error: "Origine non autorisée" }, { status: 403 });
  try {
    const body = (await request.json()) as { text?: unknown; source?: unknown; sourceUrl?: unknown };
    const text = typeof body.text === "string" ? body.text : "";
    if (text.trim().length < 20) return Response.json({ error: "Ajoutez le contenu de l’alerte ou du post." }, { status: 400 });
    return Response.json({ offer: parseOfferText(text, typeof body.source === "string" ? body.source : "Ajout manuel", typeof body.sourceUrl === "string" ? body.sourceUrl : undefined) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Erreur inattendue" }, { status: 400 });
  }
}
