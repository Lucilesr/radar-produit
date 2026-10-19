import { getChatGPTUser } from "@/app/chatgpt-auth";
import { ensureSameOrigin } from "@/lib/server";
import { createInterview, dueInterviews } from "@/lib/interview-store";
import { getOffer } from "@/lib/job-store";
export async function GET() { const user = await getChatGPTUser(); if (!user) return Response.json({ error: "Authentification requise" }, { status: 401 }); return Response.json({ due: await dueInterviews(user.userId) }, { headers: { "Cache-Control": "private, no-store" } }); }
export async function POST(request: Request) {
  const user = await getChatGPTUser(); if (!user) return Response.json({ error: "Authentification requise" }, { status: 401 });
  if (!ensureSameOrigin(request)) return Response.json({ error: "Origine non autorisée" }, { status: 403 });
  try { const text = await request.text(); if (text.length > 18000) return Response.json({ error: "Contenu trop volumineux" }, { status: 413 }); const interview = await createInterview(user.userId, JSON.parse(text)); return Response.json({ interview, job: await getOffer(user.userId, interview.jobId, true) }, { status: 201 }); }
  catch { return Response.json({ error: "Date, durée ou offre invalide. Vérifiez les champs avant de réessayer." }, { status: 400 }); }
}
