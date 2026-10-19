import { getChatGPTUser } from "@/app/chatgpt-auth";
import { listAnswerProposals } from "@/lib/application-proposal-store";

const headers = { "Cache-Control": "private, no-store" };
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Authentification requise" }, { status: 401, headers });
  try { return Response.json({ proposals: await listAnswerProposals(user.userId, (await context.params).id) }, { headers }); }
  catch { return Response.json({ error: "Question introuvable." }, { status: 404, headers }); }
}
