import { requireChatGPTUser } from "./chatgpt-auth";
import { RadarApp } from "@/components/radar-app";
import { listOffers } from "@/lib/job-store";
import { readCandidateProfile } from "@/lib/profile-store";
import { loadRadarState } from "@/lib/radar-bootstrap";
import { readRadarRoute, readProfileSection } from "@/lib/radar-navigation";
import { ensureOnboardingDemo } from "@/lib/onboarding-demo";
import { ensureRecruiterDemo } from "@/lib/recruiter-demo";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export default async function Home({searchParams}: {searchParams: Promise<Record<string, string | string[] | undefined>>}) {
  const user = await requireChatGPTUser("/");
  if (user.userId.startsWith("demo:")) await ensureRecruiterDemo(user.userId, (await cookies()).get("radar_demo_mode")?.value === "onboarding");
  else await ensureOnboardingDemo(user.userId).catch(() => undefined);
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams ?? {})) {
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) search.append(key, item);
  }
  const initialState = await loadRadarState(user.userId, {
    jobs: owner => listOffers(owner, undefined, true), profile: readCandidateProfile,
  });
  return <RadarApp ownerId={user.userId} userName={user.fullName ?? user.displayName} initialState={initialState} initialRoute={readRadarRoute(search.toString())} initialProfileSection={readProfileSection(search.get("profile"))} />;
}
