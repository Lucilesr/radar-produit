import { NextResponse } from "next/server";

export function GET(request: Request) {
  const url = new URL(request.url);
  const target = new URL("https://radar-produit-lucile.richbean3.chatgpt.site/demo");
  if (url.searchParams.get("onboarding") === "1") target.searchParams.set("onboarding", "1");
  return NextResponse.redirect(target);
}
