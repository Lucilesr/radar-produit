import { getChatGPTUser } from "@/app/chatgpt-auth";
import { ensureSameOrigin } from "@/lib/server";
import { recordCollectiveAlert } from "@/lib/source-store";

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Authentification requise" }, { status: 401 });
  if (!ensureSameOrigin(request)) return Response.json({ error: "Origine non autorisée" }, { status: 403 });
  if (user.userId.startsWith("demo:")) return Response.json({ error: "Les alertes externes sont désactivées dans la démo." }, { status: 403 });
  try {
    const input = await request.json() as { url?: string };
    if (!input || Object.keys(input).some(key => key !== "url")) throw new Error("Champs invalides");
    const source = await recordCollectiveAlert(user.userId, {
      url: input.url,
      notificationAt: new Date().toISOString(),
      label: "Offres signalées par une alerte Collective",
    });
    return Response.json({ source });
  } catch {
    return Response.json({ error: "Lien Collective invalide. Copiez le lien « See jobs » de l'email." }, { status: 400 });
  }
}
