export type ContractType = "cdi" | "cdd" | "freelance" | "portage" | "part_time" | "other";
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
  announcedLocation?: string;
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
  /** Refresh the automatic sources when Radar opens, or only on demand. */
  refreshMode?: "on_open" | "manual";
};

export type Assessment = {
  score: number;
  tier: MatchTier;
  reasons: string[];
  flags: string[];
};

/** One search track: a named group of job titles Radar looks for on the sources. */
export type SearchTrack = {
  id: string;
  label: string;
  terms: string[];
  /** The account's own target, a wider net, or neighbouring titles. */
  kind: "core" | "broad" | "alternative";
};

export type SearchPreferences = {
  roles: string[];
  /** Search tracks of this account; without them, one track is derived from `roles`. */
  searchTracks?: SearchTrack[];
  includedLocations?: string[];
  excludedLocations?: string[];
  contracts: Array<"cdi" | "cdd" | "freelance" | "portage" | "part_time">;
  remote: "onsite" | "hybrid" | "exceptional" | "full_remote";
  /** Presence accepted for one contract; a contract absent here follows `remote`. */
  remoteByContract?: Partial<Record<"cdi" | "cdd" | "freelance" | "portage" | "part_time", "onsite" | "hybrid" | "exceptional" | "full_remote">>;
  minimumSalary: number;
  minimumDailyRate: number;
  /** Words that make an offer stand out, and words that rule it out. */
  boostKeywords?: string[];
  excludeKeywords?: string[];
  minimumMatchScore: number;
  /** 0 to 20: a known pay up to this % under the minimum stays visible as an exception. */
  payTolerancePercent?: number;
};
