import type { CandidateProfile } from "./types";

// New accounts start with no professional facts. Existing saved profiles are unchanged.
export const profileTemplate: CandidateProfile = {
  headline: "",
  summary: "",
  location: "",
  languages: [],
  roleKeywords: [],
  skills: [],
  industries: [],
  achievements: [],
  evidence: [],
  linkedinUrl: "",
};
