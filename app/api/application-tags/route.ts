import { getChatGPTUser } from "@/app/chatgpt-auth";
import { ensureSameOrigin } from "@/lib/server";
import { changeApplicationTags, readApplicationTags } from "@/lib/application-tag-store";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Authentification requise" }, { status: 401 });
  try { return Response.json(await readApplicationTags(user.userId)); }
  catch { return Response.json({ error: "Tags indisponibles. Réessayez." }, { status: 503 }); }
}

export async function PATCH(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Authentification requise" }, { status: 401 });
  if (!ensureSameOrigin(request)) return Response.json({ error: "Origine non autorisée" }, { status: 403 });
  try {
    const raw = await request.text();
    if (raw.length > 1000) return Response.json({ error: "Requête trop longue." }, { status: 413 });
    const input = JSON.parse(raw) as Record<string, unknown>;
    const result = await changeApplicationTags(user.userId, input);
    return result ? Response.json(result) : Response.json({ error: "Les tags ont changé dans un autre onglet. Réessayez.", ...(await readApplicationTags(user.userId)) }, { status: 409 });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Tag non enregistré." }, { status: 400 }); }
}
