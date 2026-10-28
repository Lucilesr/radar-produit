import { getChatGPTUser } from "@/app/chatgpt-auth";
import { ensureSameOrigin } from "@/lib/server";
import { readBoard, changeBoard } from "@/lib/personal-board-store";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Authentification requise" }, { status: 401 });
  try { return Response.json({ board: await readBoard(user.userId) }); }
  catch { return Response.json({ error: "Tableau indisponible. Réessayez." }, { status: 503 }); }
}
export async function PATCH(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Authentification requise" }, { status: 401 });
  if (!ensureSameOrigin(request)) return Response.json({ error: "Origine non autorisée" }, { status: 403 });
  try {
    const raw = await request.text();
    if (raw.length > 2000) return Response.json({ error: "Requête trop longue" }, { status: 413 });
    const body = JSON.parse(raw);
    const board = await changeBoard(user.userId, body, body.version);
    return board ? Response.json({ board }) : Response.json({ error: "Le tableau a changé dans un autre onglet. Rechargez les colonnes puis réessayez.", board: await readBoard(user.userId) }, { status: 409 });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Modification non enregistrée." }, { status: 400 }); }
}
