import { getChatGPTUser } from "@/app/chatgpt-auth";
import { ensureSameOrigin } from "@/lib/server";
import { listOffers, purgeExpiredTrash, saveOffer } from "@/lib/job-store";

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Authentification requise" }, { status: 401 });

  if(user.userId.startsWith("demo:")&&request.headers.get("cookie")?.split(";").some(cookie=>cookie.trim()==="radar_demo_mode=today-loading"))await new Promise(resolve=>setTimeout(resolve,4000));
  try {
    // Keep offer reads available if the maintenance query fails.
    await purgeExpiredTrash(user.userId).catch(error => console.error("Trash cleanup failed:", String(error)));
    return Response.json({ jobs: await listOffers(user.userId, undefined, new URL(request.url).searchParams.get("includeDeleted") === "true") });
  } catch (error) {
    return Response.json({ error: messageFor(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Authentification requise" }, { status: 401 });
  if (!ensureSameOrigin(request)) return Response.json({ error: "Origine non autorisée" }, { status: 403 });

  try {
    const result = await saveOffer(user.userId, await request.json());
    return Response.json(result, { status: result.deduplicated ? 200 : 201 });
  } catch (error) {
    return Response.json({ error: messageFor(error) }, { status: 400 });
  }
}

function messageFor(error: unknown) {
  const message = error instanceof Error ? error.message : "Erreur inattendue";
  if (message.includes("no such table")) {
    return "La base est en cours d’initialisation. Réessayez après le déploiement de la migration.";
  }
  return message;
}
