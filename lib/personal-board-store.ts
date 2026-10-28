import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { applicationBoards } from "@/db/schema";
import { defaultBoard, editBoard, type PersonalBoard } from "./personal-board";

export async function readBoard(userId: string): Promise<PersonalBoard> {
  const [row] = await getDb().select().from(applicationBoards).where(eq(applicationBoards.userId, userId)).limit(1);
  return row ? { columns: JSON.parse(row.data), version: row.version } : defaultBoard();
}

export async function changeBoard(userId: string, action: unknown, version: unknown) {
  const db = getDb(), current = await readBoard(userId);
  if (version !== current.version) return null;
  const next = editBoard(current, action);
  const values = { data: JSON.stringify(next.columns), version: next.version };
  const rows = current.version === 0
    ? await db.insert(applicationBoards).values({ userId, ...values }).onConflictDoNothing().returning()
    : await db.update(applicationBoards).set(values).where(and(eq(applicationBoards.userId, userId), eq(applicationBoards.version, current.version))).returning();
  return rows.length ? next : null;
}
