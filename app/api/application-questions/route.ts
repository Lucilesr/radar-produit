import { getChatGPTUser } from "@/app/chatgpt-auth";
import { ensureSameOrigin } from "@/lib/server";
import { createApplicationQuestion, listApplicationQuestions } from "@/lib/application-question-store";

const headers = { "Cache-Control": "private, no-store" };
export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Authentification requise" }, { status: 401, headers });
  try {
    const jobId = new URL(request.url).searchParams.get("jobId") ?? "";
    if (!jobId || jobId.length > 100) throw new Error("Offre requise.");
    const includeArchived = new URL(request.url).searchParams.get("includeArchived") === "1";
    return Response.json({ questions: await listApplicationQuestions(user.userId, jobId, includeArchived) }, { headers });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Questions indisponibles." }, { status: 400, headers });
  }
}
export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Authentification requise" }, { status: 401, headers });
  if (!ensureSameOrigin(request)) return Response.json({ error: "Origine non autorisée" }, { status: 403, headers });
  try {
    const raw = await request.text();
    if (raw.length > 15000) return Response.json({ error: "Contenu trop volumineux" }, { status: 413, headers });
    return Response.json({ question: await createApplicationQuestion(user.userId, JSON.parse(raw)) }, { status: 201, headers });
  } catch (error) {
    return Response.json({ error: error instanceof Error && !error.message.startsWith("[") ? error.message : "Vérifiez la question." }, { status: 400, headers });
  }
}
