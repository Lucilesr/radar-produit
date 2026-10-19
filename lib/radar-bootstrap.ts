import type { CandidateProfile, JobRecord } from "./types";

export type RadarInitialState = {
  jobs: JobRecord[];
  profile: CandidateProfile | null;
  errors: {jobs: boolean; profile: boolean};
};

// Each reader receives the authenticated owner; partial outages keep the other
// section usable and use the same retry states as client-side refreshes.
export async function loadRadarState(userId: string, readers: {
  jobs: (userId: string) => Promise<JobRecord[]>;
  profile: (userId: string) => Promise<CandidateProfile | null>;
}): Promise<RadarInitialState> {
  const [jobs, profile] = await Promise.allSettled([readers.jobs(userId), readers.profile(userId)]);
  return {
    jobs: jobs.status === "fulfilled" ? jobs.value : [],
    profile: profile.status === "fulfilled" ? profile.value : null,
    errors: {jobs: jobs.status === "rejected", profile: profile.status === "rejected"},
  };
}
