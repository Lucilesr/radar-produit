import { getChatGPTUser } from "@/app/chatgpt-auth";
import { ensureSameOrigin } from "@/lib/server";
import { setOfferDeleted } from "@/lib/job-store";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Authentification requise" }, { status: 401 });
  if (!ensureSameOrigin(request)) return Response.json({ error: "Origine non autorisée" }, { status: 403 });
  try {
    const { id } = await context.params;
    const result = await setOfferDeleted(user.userId, id, false);
    return result ? Response.json(result) : Response.json({ error: "Offre introuvable" }, { status: 404 });
  } catch { return Response.json({ error: "Restauration non confirmée. Réessayez ou actualisez la liste." }, { status: 500 }); }
}
