import { applicationColumn, applicationColumns, type ApplicationColumn } from "./application-board";
import type { JobRecord } from "./types";

export type PersonalColumn = { id: string; label: string; stage: ApplicationColumn };
export type PersonalBoard = { columns: PersonalColumn[]; version: number };
export const defaultBoard = (): PersonalBoard => ({ columns: applicationColumns.map(c => ({ ...c, stage: c.id })), version: 0 });

/** A manual lane never hides a later status change made elsewhere in Radar. */
export function personalColumn(job: JobRecord, columns: PersonalColumn[]) {
  const stage = applicationColumn(job);
  return columns.find(c => c.id === job.boardColumnId && c.stage === stage)?.id ?? stage;
}

export function editBoard(board: PersonalBoard, action: unknown): PersonalBoard {
  if (!action || typeof action !== "object") throw new Error("Colonne invalide.");
  const value = action as Record<string, unknown>;
  if (value.action === "delete" && typeof value.id === "string") {
    const column = board.columns.find(c => c.id === value.id);
    if (!column || !column.id.startsWith("custom-") || !board.columns.some(c => c.id === column.stage)) throw new Error("Seule une colonne créée par vous peut être supprimée.");
    return { columns: board.columns.filter(c => c.id !== column.id), version: board.version + 1 };
  }
  const label = typeof value.label === "string" ? value.label.trim() : "";
  if (!label || label.length > 60) throw new Error("Choisissez un nom de 1 à 60 caractères.");
  if (value.action === "rename" && typeof value.id === "string" && board.columns.some(c => c.id === value.id)) {
    return { columns: board.columns.map(c => c.id === value.id ? { ...c, label } : c), version: board.version + 1 };
  }
  if (value.action === "add" && ["sent", "interviews", "offer", "closed"].includes(String(value.stage))) {
    if (board.columns.length >= 40) throw new Error("Le tableau contient déjà 40 colonnes.");
    const stage = value.stage as ApplicationColumn;
    const columns = [...board.columns];
    const index = columns.reduce((last, c, i) => c.stage === stage ? i : last, -1);
    columns.splice(index + 1, 0, { id: `custom-${crypto.randomUUID()}`, label, stage });
    return { columns, version: board.version + 1 };
  }
  throw new Error("Modification de colonne invalide.");
}
