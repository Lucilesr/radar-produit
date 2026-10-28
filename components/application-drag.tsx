"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import { DndContext, DragOverlay, KeyboardSensor, MouseSensor, TouchSensor, pointerWithin, rectIntersection, useDndContext, useDraggable, useDroppable, useSensor, useSensors, type Announcements, type KeyboardCoordinateGetter } from "@dnd-kit/core";
import { Dialog } from "radix-ui";
import { GripVertical } from "lucide-react";
import { WorkspaceButton, WorkspaceFormError } from "@/components/workspace-form";
import { applicationColumn, applicationColumns, applicationMove, type ApplicationColumn } from "@/lib/application-board";
import type { JobRecord, JobStatus } from "@/lib/types";

const columnName = (id: string) => applicationColumns.find(column => column.id === id)?.label ?? "l’étape précédente";
const destinations = applicationColumns.filter(column => column.id !== "other").map(column => column.id);

/** Arrow keys move one whole column, including across an internally scrolling board. */
const keyboardCoordinates: KeyboardCoordinateGetter = (event, { currentCoordinates, context }) => {
  if (["ArrowUp", "ArrowDown"].includes(event.code)) { event.preventDefault(); return; }
  if (!["ArrowLeft", "ArrowRight"].includes(event.code)) return;
  event.preventDefault();
  const source = String(context.over?.id ?? context.active?.data.current?.column ?? "");
  const found = destinations.findIndex(id => id === source);
  const step = event.code === "ArrowRight" ? 1 : -1;
  if (found < 0 && step > 0) return;
  const index = found < 0 ? destinations.length : found;
  const nextIndex = Math.max(0, Math.min(destinations.length - 1, index + step));
  const rect = context.droppableRects.get(destinations[nextIndex]);
  const current = context.collisionRect;
  if (!rect || !current) return;
  return { x: currentCoordinates.x + rect.left + rect.width / 2 - current.left - current.width / 2,
    y: currentCoordinates.y + rect.top + Math.min(rect.height / 2, 90) - current.top - current.height / 2 };
};

function focusCard(id: string | null) {
  requestAnimationFrame(() => {
    const handle = id ? document.getElementById(`application-drag-${id}`) : null;
    (handle && !handle.hasAttribute("disabled") ? handle : document.getElementById("workspace-title"))?.focus({ preventScroll: true });
  });
}

export function ApplicationDrag({ jobs, busy, onStatus, children }: { jobs: JobRecord[]; busy: string | null; onStatus: (job: JobRecord, status: JobStatus) => Promise<boolean>; children: ReactNode }) {
  const id = useId();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [closure, setClosure] = useState<"rejected" | "withdrawn" | "">("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const locked = useRef(false), lastFocus = useRef<string | null>(null);
  const active = jobs.find(job => job.id === activeId), closing = jobs.find(job => job.id === closingId);
  const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 8 } }), useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } }), useSensor(KeyboardSensor, {
    coordinateGetter: keyboardCoordinates, scrollBehavior: "auto", keyboardCodes: { start: ["Space", "Enter"], end: ["Space", "Enter"], cancel: ["Escape", "Tab"] },
  }));
  async function move(jobId: string, target: string, reason?: JobStatus) {
    if (busy || locked.current) return;
    const job = jobs.find(item => item.id === jobId);
    if (!job) { setMessage("Cette candidature n’est plus dans la vue. Aucun déplacement enregistré."); return; }
    lastFocus.current = jobId;
    const plan = applicationMove(job, target, reason);
    if (plan.kind === "confirm-close") { setClosingId(jobId); setClosure(""); setError(""); return; }
    if (plan.kind !== "status") { setMessage(plan.kind === "none" ? "Étape conservée." : "Déplacement annulé. Étape conservée."); focusCard(jobId); return; }
    locked.current = true; setError(""); setMessage(`Enregistrement vers ${columnName(target)}…`);
    try {
      if (await onStatus(job, plan.status)) { setClosingId(null); setMessage(`Candidature déplacée vers ${columnName(target)}. Notes et entretiens conservés.`); }
      else { const problem = "Déplacement non confirmé. Le dernier statut confirmé reste affiché. Actualisez pour vérifier avant de réessayer."; setError(problem); setMessage(problem); }
    } catch { const problem = "Déplacement non confirmé. Actualisez pour vérifier ; vos notes et entretiens restent conservés."; setError(problem); setMessage(problem); }
    finally { locked.current = false; if (target !== "closed") focusCard(jobId); }
  }
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Candidature ${jobs.find(job => job.id === active.id)?.company || ""} saisie. Choisissez une étape.`,
    onDragOver: ({ over }) => over ? `Destination : ${columnName(String(over.id))}.` : "Hors d’une étape. Relâcher annulera le déplacement.",
    onDragEnd: ({ over }) => over ? `Carte relâchée sur ${columnName(String(over.id))}.` : "Déplacement annulé.",
    onDragCancel: () => "Déplacement annulé. Étape conservée.",
  };
  return <DndContext id={id} sensors={sensors} collisionDetection={args => args.pointerCoordinates ? pointerWithin(args) : rectIntersection(args)}
    accessibility={{ announcements, screenReaderInstructions: { draggable: "Appuyez sur Entrée ou Espace pour saisir la carte. Utilisez les flèches gauche et droite pour choisir l’étape, puis Entrée ou Espace pour déposer. Échap ou Tab annule." } }}
    onDragStart={({ active }) => { setActiveId(String(active.id)); setMessage(""); }}
    onDragCancel={({ active }) => { setActiveId(null); setMessage("Déplacement annulé. Étape conservée."); focusCard(String(active.id)); }}
    onDragEnd={({ active, over }) => { setActiveId(null); if (over) void move(String(active.id), String(over.id)); else { setMessage("Déplacement annulé. Étape conservée."); focusCard(String(active.id)); } }}>
    <p className="application-drag-help">Glissez une carte pour changer d’étape. Sur mobile, maintenez-la un instant.</p>
    <p className="sr-only" role="status">{message}</p>
    {children}
    <DragOverlay dropAnimation={null} zIndex={90}>{active ? <div className="application-drag-preview" aria-hidden><strong>{active.title}</strong><p>{active.company || "Entreprise à confirmer"}</p></div> : null}</DragOverlay>
    <Dialog.Root open={!!closing} onOpenChange={open => { if (!open && !busy && !locked.current) { setClosingId(null); setError(""); } }}>
      <Dialog.Portal><Dialog.Overlay className="application-move-overlay"/><Dialog.Content className="application-move-dialog" onEscapeKeyDown={event => { if (busy) event.preventDefault(); }} onPointerDownOutside={event => { if (busy) event.preventDefault(); }} onCloseAutoFocus={event => { event.preventDefault(); focusCard(lastFocus.current); }}>
        <Dialog.Title>Clore cette candidature ?</Dialog.Title><Dialog.Description>Choisissez ce qui termine le processus. Les notes et les entretiens restent dans le dossier.</Dialog.Description>
        <p className="application-move-company">{closing?.title} · {closing?.company || "Entreprise à confirmer"}</p>
        <fieldset disabled={!!busy}><legend>Motif de clôture</legend>{([["rejected", "Refus reçu"], ["withdrawn", "J’arrête le processus"]] as const).map(([value, label]) => <label key={value}><input type="radio" name={`closure-${id}`} value={value} checked={closure === value} onChange={() => { setClosure(value); setError(""); }}/>{label}</label>)}</fieldset>
        <WorkspaceFormError message={error}/><div className="application-move-actions"><WorkspaceButton disabled={!!busy} onClick={() => { setClosingId(null); setError(""); }}>Annuler</WorkspaceButton><WorkspaceButton variant="danger" busy={!!busy} disabled={!closure} onClick={() => { if (closing && closure) void move(closing.id, "closed", closure); }}>{busy ? "Enregistrement…" : "Clore la candidature"}</WorkspaceButton></div>
      </Dialog.Content></Dialog.Portal>
    </Dialog.Root>
  </DndContext>;
}

export function ApplicationDropColumn({ column, busy, children }: { column: ApplicationColumn; busy: boolean; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: column, disabled: busy || column === "other" });
  const { active } = useDndContext();
  return <section ref={setNodeRef} className={`application-column is-${column}${isOver ? " is-drop-over" : ""}${active && !busy && column !== "other" ? " is-drop-ready" : ""}`} aria-labelledby={`application-column-${column}`}>{children}</section>;
}

export function DraggableApplicationCard({ job, busy, title, children }: { job: JobRecord; busy: boolean; title: ReactNode; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({ id: job.id, disabled: busy, data: { column: applicationColumn(job) } });
  return <article ref={setNodeRef} className={`application-card${isDragging ? " is-dragging" : ""}`} aria-busy={busy}
    onMouseDown={event => { if (!(event.target as Element).closest("input,textarea,select,[contenteditable=true],[role=combobox],[data-no-drag]")) listeners?.onMouseDown?.(event); }}
    onTouchStart={event => { if (!(event.target as Element).closest("input,textarea,select,[contenteditable=true],[role=combobox],[data-no-drag]")) listeners?.onTouchStart?.(event); }}>
    <div className="application-card-heading">{title}<button ref={setActivatorNodeRef} {...attributes} onKeyDown={event => listeners?.onKeyDown?.(event)} id={`application-drag-${job.id}`} type="button" className="application-drag-handle" disabled={busy} aria-label={`Déplacer la candidature : ${job.title} · ${job.company || "Entreprise à confirmer"}`} aria-roledescription="carte déplaçable" title="Glisser vers une autre étape · Entrée puis flèches au clavier"><GripVertical size={17} aria-hidden/></button></div>
    {children}
  </article>;
}
