import { getChatGPTUser } from "@/app/chatgpt-auth";
import { ensureSameOrigin } from "@/lib/server";
import { setOffersDeleted } from "@/lib/job-store";
import { z } from "zod";

const schema = z.object({ ids: z.array(z.string().min(1).max(100)).min(1).max(50), deleted: z.boolean(), reason: z.enum(["filled", "applications_closed", "not_interested", "other"]).optional(), note: z.string().max(500).optional() }).strict().refine(value => !value.deleted || !!value.reason);
export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Authentification requise" }, { status: 401 });
  if (!ensureSameOrigin(request)) return Response.json({ error: "Origine non autorisée" }, { status: 403 });
  let input;
  try {
    const raw = await request.text();
    if (raw.length > 8000) return Response.json({ error: "Sélection trop volumineuse" }, { status: 413 });
    input = schema.parse(JSON.parse(raw));
  } catch { return Response.json({ error: "Sélection invalide : choisissez de 1 à 50 offres." }, { status: 400 }); }
  const start = performance.now();
  try {
    const results = await setOffersDeleted(user.userId, input.ids, input.deleted, input.reason, input.note);
    return Response.json({ results }, { headers: { "Cache-Control": "private, no-store", "Server-Timing": `db;dur=${(performance.now() - start).toFixed(1)}` } });
  } catch { return Response.json({ error: "Enregistrement non confirmé. Réessayez ou actualisez pour vérifier." }, { status: 500 }); }
}
