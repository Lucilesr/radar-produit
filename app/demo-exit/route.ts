import { NextResponse } from "next/server";

export function GET(request: Request) {
  const url = new URL(request.url);
  const response = NextResponse.redirect(new URL("/", url.origin));
  response.cookies.delete("radar_demo_visitor");
  response.cookies.delete("radar_demo_mode");
  response.headers.set("Cache-Control", "no-store");
  return response;
}
