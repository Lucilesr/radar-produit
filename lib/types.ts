export type ContractType = "cdi" | "freelance" | "other";
export type RemoteMode = "full_remote" | "exceptional" | "hybrid" | "onsite" | "unknown";
export type OfferLanguage = "fr" | "en" | "professional_en" | "advanced_en" | "unknown";
export type JobStatus = "new" | "watchlist" | "shortlist" | "prepare" | "ready" | "applied" | "interview" | "awaiting_response" | "next_step" | "offer" | "rejected" | "withdrawn" | "closed";
export type MatchTier = "priority" | "match" | "exception" | "excluded";
export type DismissalReason = "filled" | "applications_closed" | "not_interested" | "other";

export type JobInput = {
  title: string;
  company?: string;
  contractType: ContractType;
  annualSalary?: number | null;
  dailyRate?: number | null;
  remoteMode: RemoteMode;
  onsiteCadence?: string;
  onsiteDaysPerWeek?: number | null;
  onsiteDaysPerMonth?: number | null;
  remoteCountry?: string;
  language: OfferLanguage;
  source: string;
  sourceUrl?: string;
  contact?: string;
  description?: string;
  publishedAt?: string;
  applicationUrl?: string;
  contentCoverage?: "full" | "summary" | "partial" | "unknown";
  notificationAt?: string;
};

export type JobRecord = JobInput & {
  id: string;
  deletedAt?: string;
  reviewState?: "to_review" | "selected";
  dismissalReason?: DismissalReason;
  dismissalNote?: string;
  dismissalEvidence?: string;
  status: JobStatus;
  appliedAt?: string;
  matchScore: number;
  matchTier: MatchTier;
  reasons: string[];
  flags: string[];
  createdAt?: string;
  candidateNote?: string;
  boardColumnId?: string;
  interviews?: InterviewRecord[];
  updatedAt?: string;
};

export type InterviewRecord = {
  id: string; jobId: string; label: string; startAt: string; endAt: string; timeZone: string;
  format: "video" | "phone" | "onsite" | "other"; state: "planned" | "reviewed" | "cancelled";
  outcome?: "waiting" | "next_step" | "rejected" | "withdrawn" | "offer";
  summary?: string; strengths?: string; weaknesses?: string; nextAction?: string; followUpAt?: string;
  remindedAt?: string; updatedAt?: string;
};

export type CandidateProfile = {
  searchPreferences?: SearchPreferences;
  headline: string;
  summary: string;
  location: string;
  languages: string[];
  roleKeywords: string[];
  skills: string[];
  industries: string[];
  achievements: Array<{ label: string; detail: string }>;
  evidence: Array<{ title: string; context: string; strengths: string[] }>;
  linkedinUrl: string;
  cvFrDocumentId?: string;
  cvEnDocumentId?: string;
  detailedExperienceDocumentId?: string;
  applicationNotes?: Record<string, string>;
};

export type Assessment = {
  score: number;
  tier: MatchTier;
  reasons: string[];
  flags: string[];
};

export type SearchPreferences = {
  roles: string[];
  contracts: Array<"cdi" | "freelance">;
  remote: "full_remote" | "occasional" | "light_hybrid";
  minimumSalary: number;
  minimumDailyRate: number;
};
