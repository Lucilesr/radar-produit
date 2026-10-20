import { getChatGPTUser } from "@/app/chatgpt-auth";
import { ensureSameOrigin } from "@/lib/server";
import { previewEmployerOffer } from "@/lib/employer-offer";

export async function POST(request: Request) {
  if (!await getChatGPTUser()) return Response.json({ error: "Authentification requise" }, { status: 401 });
  if (!ensureSameOrigin(request)) return Response.json({ error: "Origine non autorisée" }, { status: 403 });
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > 2048) return Response.json({ error: "Requête trop volumineuse" }, { status: 413 });
    const input: unknown = JSON.parse(raw);
    if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).some(key => key !== "url") || typeof (input as { url?: unknown }).url !== "string")
      return Response.json({ error: "Ajoutez le lien d’une offre Greenhouse ou Ashby." }, { status: 400 });
    const offer = await previewEmployerOffer((input as { url: string }).url);
    return Response.json({ offer }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const message = error instanceof Error && /^(Lien|Seuls|La fiche|La réponse|Cette fiche)/.test(error.message) ? error.message : "Lecture de l’offre non confirmée. Vérifiez le lien et réessayez.";
    return Response.json({ error: message }, { status: 400 });
  }
}
