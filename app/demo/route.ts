import { NextResponse } from "next/server";

/** A stable shareable URL creates a fresh, isolated fictional account. */
export function GET(request: Request) {
  const url = new URL(request.url);
  const response = NextResponse.redirect(new URL("/", url.origin));
  const options = { httpOnly: true, secure: url.protocol === "https:", sameSite: "lax" as const, path: "/", maxAge: 60 * 60 * 24 * 30 };
  response.cookies.set("radar_demo_visitor", crypto.randomUUID(), options);
  response.cookies.set("radar_demo_mode", url.searchParams.get("onboarding") === "1" ? "onboarding" : "full", options);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
