import { chatGPTSignOutPath, requireChatGPTUser } from "./chatgpt-auth";
import { RadarApp } from "@/components/radar-app";
import { listOffers, purgeExpiredTrash } from "@/lib/job-store";
import { readCandidateProfile } from "@/lib/profile-store";
import { loadRadarState } from "@/lib/radar-bootstrap";
import { library as readExperienceLibrary } from "@/lib/experience-store";
import { readRadarRoute, readProfileSection } from "@/lib/radar-navigation";
import { ensureOnboardingDemo } from "@/lib/onboarding-demo";
import { ensureRecruiterDemo } from "@/lib/recruiter-demo";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export default async function Home({searchParams}: {searchParams: Promise<Record<string, string | string[] | undefined>>}) {
  const user = await requireChatGPTUser("/");
  const demoMode = user.userId.startsWith("demo:") ? (await cookies()).get("radar_demo_mode")?.value : undefined;
  if (user.userId.startsWith("demo:")) await ensureRecruiterDemo(user.userId, demoMode === "onboarding", demoMode === "friday");
  else await ensureOnboardingDemo(user.userId).catch(() => undefined);
  // Cleanup is maintenance: a failure must not take down the entire workspace.
  await purgeExpiredTrash(user.userId).catch(error => console.error("Trash cleanup failed:", String(error)));
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams ?? {})) {
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) search.append(key, item);
  }
  const initialRoute = readRadarRoute(search.toString());
  const initialProfileSection = readProfileSection(search.get("profile"));
  const [initialState, initialExperienceLibrary] = await Promise.all([
    loadRadarState(user.userId, { jobs: owner => listOffers(owner, undefined, true), profile: readCandidateProfile }),
    initialRoute.tab === "profile" && initialProfileSection === "experiences" ? readExperienceLibrary(user.userId).catch(() => undefined) : Promise.resolve(undefined),
  ]);
  return <RadarApp fridayDemo={demoMode === "friday"} ownerId={user.userId} userName={user.fullName ?? user.displayName} userEmail={user.email} signOutPath={chatGPTSignOutPath("/")} initialState={initialState} initialRoute={initialRoute} initialProfileSection={initialProfileSection} initialExperienceLibrary={initialExperienceLibrary} />;
}
