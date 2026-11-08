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
  /** Announced pay range; `annualSalary` and `dailyRate` keep its midpoint for compatibility. */
  salaryMin?: number | null;
  salaryMax?: number | null;
  dailyRateMin?: number | null;
  dailyRateMax?: number | null;
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

export type JobRecord = JobInput & ScoreV2 & {
  id: string;
  signals?: string[];
  deletedAt?: string;
  /** `reopened`: explicitly returned to examine; `later`: kept outside the daily lot. */
  reviewState?: "to_review" | "selected" | "later" | "reopened";
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
  applicationCare?: import("./application-care").ApplicationCare;
  applicationFollowup?: import("./application-followup").ApplicationFollowup;
  boardColumnId?: string;
  interviews?: InterviewRecord[];
  updatedAt?: string;
};

export type InterviewRecord = {
  id: string; jobId: string; label: string; startAt: string; endAt: string; timeZone: string;
  format: "video" | "phone" | "onsite" | "other"; state: "planned" | "reviewed" | "cancelled";
  outcome?: "waiting" | "next_step" | "rejected" | "withdrawn" | "offer";
  summary?: string; strengths?: string; weaknesses?: string; nextAction?: string; followUpAt?: string; followUpDoneAt?:string; followUpDoneFor?:string;
  remindedAt?: string; updatedAt?: string;
};

export type CandidateProfile = {
  weekSeries?: import("./week-series").SeriesSettings;
  weekPlan?: import("./week-plan").WeekPlan | null;
  weekPlans?: import("./week-plan").WeekPlan[];
  weekPlanRevision?: number;
  triageDismissals?: Record<string, string>;
  preferences?: { reducedMotion?: boolean; celebrations?: boolean; triageShortcuts?: boolean };
  searchPreferences?: SearchPreferences;
  ignoredDomainTerms?: string[];
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
  /** Level or pay hints, also listed in `flags` so they show as points to check. */
  signals?: string[];
} & ScoreV2;

/** Score v2: a conditions filter, then the job's own fit and how much of the offer is known. */
export type ScoreV2 = {
  conditions?: "pass" | "check" | "excluded";
  /** 0–100 on the known parts only; null when nothing comparable is known. */
  fit?: number | null;
  fitParts?: { role?: number; level?: number; pay?: number; domain?: number };
  confidence?: "high" | "medium" | "low";
  /** Facts still unknown, for « Fiche incomplète ». */
  missing?: string[];
  fitLabel?: "very_close" | "close" | "to_weigh" | "far";
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
  /** Role suggestions dismissed by this account; at most 30. */
  dismissedRoleSuggestions?: string[];
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
  /** Individually confirmed from approved experiences allowed for applications. */
  domainTerms?: string[];
  excludeKeywords?: string[];
  /** Explicitly confirmed source exclusions; selections/applications remain accessible. */
  excludeSources?: string[];
  minimumMatchScore: number;
  /** 0 to 20: a known pay up to this % under the minimum stays visible as an exception. */
  payTolerancePercent?: number;
  /** Seniority the account aims for; unset means offers are not compared on level. */
  targetLevel?: "junior" | "confirmed" | "senior" | "lead" | "head";
  /** An offer one level above the target is not flagged. */
  acceptLevelAbove?: boolean;
};
