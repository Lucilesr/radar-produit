import { requireChatGPTUser } from "./chatgpt-auth";
import { RadarApp } from "@/components/radar-app";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await requireChatGPTUser("/");
  return <RadarApp userName={user.fullName ?? user.displayName} />;
}
