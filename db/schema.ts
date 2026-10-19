import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const profiles = sqliteTable("profiles", {
  userId: text("user_id").primaryKey(),
  data: text("data").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const jobs = sqliteTable(
  "jobs",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    fingerprint: text("fingerprint").notNull(),
    title: text("title").notNull(),
    company: text("company").notNull().default("Entreprise non précisée"),
    contractType: text("contract_type").notNull().default("other"),
    annualSalary: integer("annual_salary"),
    dailyRate: integer("daily_rate"),
    remoteMode: text("remote_mode").notNull().default("unknown"),
    onsiteCadence: text("onsite_cadence"),
    language: text("language").notNull().default("unknown"),
    source: text("source").notNull().default("manual"),
    sourceUrl: text("source_url"),
    contact: text("contact"),
    description: text("description").notNull().default(""),
    publishedAt: text("published_at"),
    applicationUrl: text("application_url"),
    contentCoverage: text("content_coverage").notNull().default("unknown"),
    notificationAt: text("notification_at"),
    status: text("status").notNull().default("new"),
    reviewState: text("review_state"),
    deletedAt: text("deleted_at"),
    dismissalReason: text("dismissal_reason"),
    dismissalNote: text("dismissal_note"),
    dismissalEvidence: text("dismissal_evidence"),
    matchScore: integer("match_score").notNull().default(0),
    matchTier: text("match_tier").notNull().default("exception"),
    reasons: text("reasons").notNull().default("[]"),
    flags: text("flags").notNull().default("[]"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("jobs_user_fingerprint_unique").on(table.userId, table.fingerprint),
  ],
);

export const documents = sqliteTable("documents", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  originalName: text("original_name").notNull(),
  objectKey: text("object_key").notNull(),
  contentType: text("content_type").notNull(),
  size: integer("size").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const interviews = sqliteTable("interviews", {
  id: text("id").primaryKey(), userId: text("user_id").notNull(), jobId: text("job_id").notNull(),
  label: text("label").notNull(), startAt: text("start_at").notNull(), endAt: text("end_at").notNull(), timeZone: text("time_zone").notNull(),
  format: text("format").notNull().default("video"), state: text("state").notNull().default("planned"),
  data: text("data").notNull().default("{}"), remindedAt: text("reminded_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`), updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const sourceSettings = sqliteTable("source_settings", {
  id: text("id").primaryKey(), userId: text("user_id").notNull(), source: text("source").notNull(),
  data: text("data").notNull().default("{}"), updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, table => [uniqueIndex("source_settings_user_source_unique").on(table.userId, table.source)]);

// Lot 1: additive only. Original documents/profile and business history are untouched.
export const experienceItems = sqliteTable("experience_items", {
  id: text("id").primaryKey(), userId: text("user_id").notNull(),
  kind: text("kind").notNull(), parentId: text("parent_id"),
  data: text("data").notNull(), validation: text("validation").notNull().default("proposed"),
  applicationAllowed: integer("application_allowed", { mode: "boolean" }).notNull().default(false),
  applicationConsent: text("application_consent").notNull().default("pending"),
  publicProfileAllowed: integer("public_profile_allowed", { mode: "boolean" }).notNull().default(false),
  version: integer("version").notNull().default(1), importKey: text("import_key"),
  createdAt: text("created_at").notNull(), updatedAt: text("updated_at").notNull(),
}, t => [uniqueIndex("experience_import_unique").on(t.userId, t.importKey)]);
export const experienceRevisions = sqliteTable("experience_revisions", {
  id: text("id").primaryKey(), userId: text("user_id").notNull(), itemId: text("item_id").notNull(),
  version: integer("version").notNull(), snapshot: text("snapshot").notNull(), action: text("action").notNull(), createdAt: text("created_at").notNull(),
}, t => [uniqueIndex("experience_revision_unique").on(t.userId, t.itemId, t.version)]);
export const documentExtractions = sqliteTable("document_extractions", {
  id: text("id").primaryKey(), userId: text("user_id").notNull(), documentId: text("document_id").notNull(),
  digest: text("digest").notNull(), status: text("status").notNull(), data: text("data").notNull(), createdAt: text("created_at").notNull(),
}, t => [uniqueIndex("document_extraction_unique").on(t.userId, t.documentId, t.digest)]);
export const experienceConflicts = sqliteTable("experience_conflicts", {
  id: text("id").primaryKey(), userId: text("user_id").notNull(), leftId: text("left_id").notNull(), rightId: text("right_id").notNull(),
  reason: text("reason").notNull(), state: text("state").notNull().default("open"), resolution: text("resolution"),
  createdAt: text("created_at").notNull(), resolvedAt: text("resolved_at"),
}, t => [uniqueIndex("experience_conflict_pair_unique").on(t.userId, t.leftId, t.rightId)]);

// Recruiter questions and answer drafts belong to one account and one offer.
export const applicationQuestions = sqliteTable("application_questions", {
  id: text("id").primaryKey(), userId: text("user_id").notNull(), jobId: text("job_id").notNull(),
  question: text("question").notNull(), characterLimit: integer("character_limit"),
  answer: text("answer").notNull().default(""), version: integer("version").notNull().default(1),
  archivedAt: text("archived_at"), createdAt: text("created_at").notNull(), updatedAt: text("updated_at").notNull(),
}, t => [index("application_questions_user_job_active_idx").on(t.userId, t.jobId, t.archivedAt)]);
export const applicationAnswerRevisions = sqliteTable("application_answer_revisions", {
  id: text("id").primaryKey(), userId: text("user_id").notNull(), questionId: text("question_id").notNull(),
  version: integer("version").notNull(), question: text("question").notNull(),
  characterLimit: integer("character_limit"), answer: text("answer").notNull(),
  origin: text("origin").notNull().default("manual"), createdAt: text("created_at").notNull(),
}, t => [uniqueIndex("application_answer_revision_unique").on(t.userId, t.questionId, t.version)]);

// ChatGPT suggestions are alternatives, never replacements for the editable answer.
export const applicationAnswerProposals = sqliteTable("application_answer_proposals", {
  id: text("id").primaryKey(), userId: text("user_id").notNull(), jobId: text("job_id").notNull(),
  questionId: text("question_id").notNull(), questionText: text("question_text").notNull(),
  characterLimit: integer("character_limit"), answer: text("answer").notNull(),
  language: text("language").notNull(), contextDigest: text("context_digest").notNull(),
  createdAt: text("created_at").notNull(),
}, t => [index("application_proposals_user_question_idx").on(t.userId, t.questionId, t.createdAt)]);
