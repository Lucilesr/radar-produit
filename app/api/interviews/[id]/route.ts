import { getChatGPTUser } from "@/app/chatgpt-auth";
import { ensureSameOrigin } from "@/lib/server";
import { updateInterview } from "@/lib/interview-store";
import { getOffer } from "@/lib/job-store";
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getChatGPTUser(); if (!user) return Response.json({ error: "Authentification requise" }, { status: 401 });
  if (!ensureSameOrigin(request)) return Response.json({ error: "Origine non autorisée" }, { status: 403 });
  try { const { id } = await context.params; const raw = await request.text(); if (raw.length > 18000) return Response.json({ error: "Compte rendu trop long" }, { status: 413 }); const interview = await updateInterview(user.userId, id, JSON.parse(raw)); return Response.json({ interview, job: await getOffer(user.userId, interview.jobId, true) }); }
  catch (error) { return Response.json({ error: error instanceof Error && !error.message.startsWith("[") ? error.message : "Vérifiez la date et les champs du bilan." }, { status: 400 }); }
}
