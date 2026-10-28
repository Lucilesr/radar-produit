export async function POST() {
  return Response.json({ error: "La synchronisation externe est désactivée dans cette démo publique." }, { status: 403 });
}
