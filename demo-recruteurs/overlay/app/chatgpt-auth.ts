import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export type ChatGPTUser = {
  userId: string;
  displayName: string;
  email: string;
  fullName: string | null;
};

export async function getChatGPTUser(): Promise<ChatGPTUser | null> {
  const visitorId = (await cookies()).get("radar_demo_visitor")?.value;
  if (!visitorId || !/^[a-f0-9-]{36}$/.test(visitorId)) return null;
  return { userId: `demo:${visitorId}`, displayName: "Camille", email: "camille@example.invalid", fullName: "Camille" };
}

export async function requireChatGPTUser(
  _returnTo: string,
): Promise<ChatGPTUser> {
  const user = await getChatGPTUser();
  if (user) return user;
  redirect("/demo-session");
}
