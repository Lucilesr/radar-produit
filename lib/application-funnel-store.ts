import { env } from "cloudflare:workers";
import { applicationFunnel, type FunnelInterview, type FunnelJob } from "./application-funnel";
import type { ActivityEvent } from "./activity";

export async function readApplicationFunnel(userId: string, now = new Date()) {
  const db = env.DB as D1Database;
  const [events, jobs, interviews] = await db.batch([
    db.prepare(`SELECT id, action, object_type AS objectType, object_id AS objectId, created_at AS createdAt, data
      FROM activity_events WHERE user_id = ? AND julianday(created_at) <= julianday(?)
      AND action IN ('application_sent','application_cancelled','application_stage_changed','interview_scheduled','interview_noted','interview_cancelled')`)
      .bind(userId, now.toISOString()),
    db.prepare(`SELECT id, source, source_url AS sourceUrl, application_url AS applicationUrl, status,
        strftime('%Y-%m-%dT%H:%M:%fZ', applied_at) AS appliedAt
      FROM jobs WHERE user_id = ?`).bind(userId),
    db.prepare(`SELECT id, job_id AS jobId, state, start_at AS startAt,
        strftime('%Y-%m-%dT%H:%M:%fZ', created_at) AS createdAt,
        strftime('%Y-%m-%dT%H:%M:%fZ', updated_at) AS updatedAt,
        CASE WHEN json_valid(data) THEN json_extract(data, '$.outcome') END AS outcome
      FROM interviews WHERE user_id = ? AND julianday(created_at) <= julianday(?)`).bind(userId, now.toISOString()),
  ]);
  const rows = (events.results as (Omit<ActivityEvent, "data"> & { data: string })[]).map(row => {
    const data = JSON.parse(row.data);
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Événement illisible.");
    return { ...row, data } as ActivityEvent;
  });
  return applicationFunnel(rows, now.getTime(), jobs.results as FunnelJob[], interviews.results as FunnelInterview[]);
}
