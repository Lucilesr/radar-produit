import { chatGPTSignOutPath, requireChatGPTUser } from "./chatgpt-auth";
import { RadarApp } from "@/components/radar-app";
import { listOffers, purgeExpiredTrash } from "@/lib/job-store";
import { readCandidateProfile } from "@/lib/profile-store";
import { loadRadarState } from "@/lib/radar-bootstrap";
import { library as readExperienceLibrary } from "@/lib/experience-store";
import { readRadarRoute, profileSectionForRoute } from "@/lib/radar-navigation";
import { ensureOnboardingDemo } from "@/lib/onboarding-demo";
import { ensureRecruiterDemo } from "@/lib/recruiter-demo";
import { syncDemoSources } from "@/lib/demo-scan";
import { demoAutoScan } from "@/lib/demo-scenarios";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export default async function Home({searchParams}: {searchParams: Promise<Record<string, string | string[] | undefined>>}) {
  const user = await requireChatGPTUser("/");
  const demoMode = user.userId.startsWith("demo:") ? (await cookies()).get("radar_demo_mode")?.value : undefined;
  if (user.userId.startsWith("demo:")) {
    const fresh=await ensureRecruiterDemo(user.userId,{monthStoryDemo:demoMode==="month-story",funnelDemo:demoMode==="funnel",emptyProfile:demoMode==="onboarding",fridayDemo:demoMode==="friday",triageDemo:demoMode==="triage",scanDemo:demoMode?.startsWith("scan"),reducedMotion:demoMode==="scan-reduced"||demoMode==="weeks-reduced",weekScenario:demoMode?.startsWith("weeks-")?demoMode:undefined,sessionDemo:demoMode==="session",sessionEmpty:demoMode==="session-empty"});
    if(fresh&&demoMode==="scan-empty")await syncDemoSources(user.userId,"scan");
  }
  else await ensureOnboardingDemo(user.userId).catch(() => undefined);
  // Cleanup is maintenance: a failure must not take down the entire workspace.
  await purgeExpiredTrash(user.userId).catch(error => console.error("Trash cleanup failed:", String(error)));
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams ?? {})) {
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) search.append(key, item);
  }
  const initialRoute = readRadarRoute(search.toString());
  const initialProfileSection = profileSectionForRoute(initialRoute);
  const [initialState, initialExperienceLibrary] = await Promise.all([
    loadRadarState(user.userId, { jobs: owner => listOffers(owner, undefined, true), profile: readCandidateProfile }),
    initialRoute.tab === "radar" && (initialProfileSection === "experiences" || initialProfileSection === "stories") ? readExperienceLibrary(user.userId).catch(() => undefined) : Promise.resolve(undefined),
  ]);
  return <RadarApp autoScanDemo={demoAutoScan(demoMode)} fridayDemo={demoMode === "friday"} ownerId={user.userId} userName={user.fullName ?? user.displayName} userEmail={user.email} signOutPath={chatGPTSignOutPath("/")} initialState={initialState} initialRoute={initialRoute} initialProfileSection={initialProfileSection} initialExperienceLibrary={initialExperienceLibrary} />;
}
