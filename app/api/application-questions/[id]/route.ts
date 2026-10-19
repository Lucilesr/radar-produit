import { getChatGPTUser } from "@/app/chatgpt-auth";
import { ensureSameOrigin } from "@/lib/server";
import { applicationQuestionHistory, archiveApplicationQuestion, saveApplicationQuestion } from "@/lib/application-question-store";

const headers = { "Cache-Control": "private, no-store" };
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, context: Context) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Authentification requise" }, { status: 401, headers });
  try { return Response.json({ revisions: await applicationQuestionHistory(user.userId, (await context.params).id) }, { headers }); }
  catch { return Response.json({ error: "Question introuvable." }, { status: 404, headers }); }
}
export async function PATCH(request: Request, context: Context) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Authentification requise" }, { status: 401, headers });
  if (!ensureSameOrigin(request)) return Response.json({ error: "Origine non autorisée" }, { status: 403, headers });
  try {
    const raw = await request.text();
    if (raw.length > 15000) return Response.json({ error: "Contenu trop volumineux" }, { status: 413, headers });
    const body = JSON.parse(raw);
    const id = (await context.params).id;
    if (body.action === "archive") return Response.json({ result: await archiveApplicationQuestion(user.userId, id, { version: body.version, archived: true }) }, { headers });
    if (body.action === "restore") return Response.json({ result: await archiveApplicationQuestion(user.userId, id, { version: body.version, archived: false }) }, { headers });
    return Response.json({ question: await saveApplicationQuestion(user.userId, id, body) }, { headers });
  } catch (error) {
    return Response.json({ error: error instanceof Error && !error.message.startsWith("[") ? error.message : "Enregistrement impossible." }, { status: 400, headers });
  }
}
