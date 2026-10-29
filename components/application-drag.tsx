"use client";

import { createContext, useContext, useId, useRef, useState, type ReactNode } from "react";
import { DndContext, DragOverlay, KeyboardSensor, MouseSensor, TouchSensor, pointerWithin, rectIntersection, useDndContext, useDraggable, useDroppable, useSensor, useSensors, type Announcements, type KeyboardCoordinateGetter } from "@dnd-kit/core";
import { Dialog } from "radix-ui";
import { ArrowRightLeft, GripVertical } from "lucide-react";
import { WorkspaceButton, WorkspaceFormError } from "@/components/workspace-form";
import { applicationColumn, applicationMove } from "@/lib/application-board";
import { defaultBoard, personalColumn, type PersonalColumn } from "@/lib/personal-board";
import type { JobRecord, JobStatus } from "@/lib/types";

const MoveApplicationContext = createContext<(id: string) => void>(() => undefined);

/** Arrow keys move one whole column, including across an internally scrolling board. */
const keyboardCoordinates = (destinations: string[]): KeyboardCoordinateGetter => (event, { currentCoordinates, context }) => {
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
    handle?.closest(".application-card")?.scrollIntoView({ block: "nearest", inline: "nearest" });
    (handle && !handle.hasAttribute("disabled") ? handle : document.getElementById("workspace-title"))?.focus({ preventScroll: true });
  });
}

export function ApplicationDrag({ jobs, busy, onStatus, children, columns = defaultBoard().columns }: { jobs: JobRecord[]; busy: string | null; onStatus: (job: JobRecord, status: JobStatus, columnId?: string) => Promise<boolean>; children: ReactNode; columns?: PersonalColumn[] }) {
  const columnName = (id: string) => columns.find(c => c.id === id)?.label ?? "l’étape précédente";
  const destinations = columns.filter(c => c.stage !== "other").map(c => c.id);
  const id = useId();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [choosingId, setChoosingId] = useState<string | null>(null);
  const [closingTarget, setClosingTarget] = useState("closed");
  const [closingId, setClosingId] = useState<string | null>(null);
  const [closure, setClosure] = useState<"rejected" | "withdrawn" | "">("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const locked = useRef(false), lastFocus = useRef<string | null>(null);
  const active = jobs.find(job => job.id === activeId), closing = jobs.find(job => job.id === closingId), choosing = jobs.find(job => job.id === choosingId);
  const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 8 } }), useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } }), useSensor(KeyboardSensor, {
    coordinateGetter: keyboardCoordinates(destinations), scrollBehavior: "auto", keyboardCodes: { start: ["Space", "Enter"], end: ["Space", "Enter"], cancel: ["Escape", "Tab"] },
  }));
  async function move(jobId: string, target: string, reason?: JobStatus) {
    if (busy || locked.current) return;
    const job = jobs.find(item => item.id === jobId);
    if (!job) { setMessage("Cette candidature n’est plus dans la vue. Aucun déplacement enregistré."); return; }
    lastFocus.current = jobId;
    const column = columns.find(c => c.id === target);
    if (!column || column.stage === "other") return;
    if (personalColumn(job, columns) === target) { setMessage("Étape conservée."); focusCard(jobId); return; }
    const plan = applicationMove(job, column.stage, reason);
    if (plan.kind === "confirm-close") { setChoosingId(null); setClosingId(jobId); setClosingTarget(target); setClosure(""); setError(""); return; }
    if (plan.kind !== "status" && plan.kind !== "none") { setMessage("Déplacement annulé. Étape conservée."); focusCard(jobId); return; }
    locked.current = true; setError(""); setMessage(`Enregistrement vers ${columnName(target)}…`);
    try {
      if (await onStatus(job, plan.kind === "status" ? plan.status : job.status, target)) { setChoosingId(null); setClosingId(null); setMessage(`Candidature déplacée vers ${columnName(target)}. Notes et entretiens conservés.`); }
      else { const problem = "Déplacement non confirmé. Le dernier statut confirmé reste affiché. Actualisez pour vérifier avant de réessayer."; setError(problem); setMessage(problem); }
    } catch { const problem = "Déplacement non confirmé. Actualisez pour vérifier ; vos notes et entretiens restent conservés."; setError(problem); setMessage(problem); }
    finally { locked.current = false; if (column.stage !== "closed") focusCard(jobId); }
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
    <p className="application-drag-help">Faites défiler les colonnes. Glissez une carte ou touchez « Déplacer » pour choisir sa destination : son statut se met à jour automatiquement.</p>
    <p className={message ? "application-drag-help" : "sr-only"} role="status">{message}</p>
    <MoveApplicationContext.Provider value={jobId => { if (!busy && !locked.current) { lastFocus.current = jobId; setError(""); setChoosingId(jobId); } }}>{children}</MoveApplicationContext.Provider>
    <DragOverlay dropAnimation={null} zIndex={90}>{active ? <div className="application-drag-preview" aria-hidden><strong>{active.title}</strong><p>{active.company || "Entreprise à confirmer"}</p></div> : null}</DragOverlay>
    <Dialog.Root open={!!closing || !!choosing} onOpenChange={open => { if (!open && !busy && !locked.current) { setChoosingId(null); setClosingId(null); setError(""); } }}>
      <Dialog.Portal><Dialog.Overlay className="application-move-overlay"/><Dialog.Content className="application-move-dialog" onEscapeKeyDown={event => { if (busy) event.preventDefault(); }} onPointerDownOutside={event => { if (busy) event.preventDefault(); }} onCloseAutoFocus={event => { event.preventDefault(); focusCard(lastFocus.current); }}>
        {choosing ? <>
          <Dialog.Title>Déplacer la candidature</Dialog.Title><Dialog.Description>Choisissez une colonne. Le statut sera mis à jour ; les notes et les entretiens sont conservés.</Dialog.Description>
          <p className="application-move-company">{choosing.title} · {choosing.company || "Entreprise à confirmer"}</p>
          <div className="application-move-destinations">{columns.filter(column => column.stage !== "other").map(column => <WorkspaceButton key={column.id} disabled={!!busy || personalColumn(choosing, columns) === column.id} onClick={() => void move(choosing.id, column.id)}>{column.label}{personalColumn(choosing, columns) === column.id ? " · actuelle" : ""}</WorkspaceButton>)}</div>
          <WorkspaceFormError message={error}/><div className="application-move-actions"><WorkspaceButton disabled={!!busy} onClick={() => setChoosingId(null)}>Annuler</WorkspaceButton></div>
        </> : <>
        <Dialog.Title>Clore cette candidature ?</Dialog.Title><Dialog.Description>Choisissez ce qui termine le processus. Les notes et les entretiens restent dans le dossier.</Dialog.Description>
        <p className="application-move-company">{closing?.title} · {closing?.company || "Entreprise à confirmer"}</p>
        <fieldset disabled={!!busy}><legend>Motif de clôture</legend>{([["rejected", "Refus reçu"], ["withdrawn", "J’arrête le processus"]] as const).map(([value, label]) => <label key={value}><input type="radio" name={`closure-${id}`} value={value} checked={closure === value} onChange={() => { setClosure(value); setError(""); }}/>{label}</label>)}</fieldset>
        <WorkspaceFormError message={error}/><div className="application-move-actions"><WorkspaceButton disabled={!!busy} onClick={() => { setClosingId(null); setError(""); }}>Annuler</WorkspaceButton><WorkspaceButton variant="danger" busy={!!busy} disabled={!closure} onClick={() => { if (closing && closure) void move(closing.id, closingTarget, closure); }}>{busy ? "Enregistrement…" : "Clore la candidature"}</WorkspaceButton></div>
        </>}
      </Dialog.Content></Dialog.Portal>
    </Dialog.Root>
  </DndContext>;
}

export function ApplicationDropColumn({ column, stage = column, busy, children }: { column: string; stage?: string; busy: boolean; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: column, disabled: busy || stage === "other" });
  const { active } = useDndContext();
  return <section ref={setNodeRef} className={`application-column is-${stage}${isOver ? " is-drop-over" : ""}${active && !busy && stage !== "other" ? " is-drop-ready" : ""}`} aria-labelledby={`application-column-${column}`}>{children}</section>;
}

export function DraggableApplicationCard({ job, busy, title, children, column }: { job: JobRecord; busy: boolean; title: ReactNode; children: ReactNode; column?: string }) {
  const chooseDestination = useContext(MoveApplicationContext);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({ id: job.id, disabled: busy, data: { column: column ?? applicationColumn(job) } });
  return <article ref={setNodeRef} className={`application-card${isDragging ? " is-dragging" : ""}`} aria-busy={busy}
    onMouseDown={event => { if (!(event.target as Element).closest("input,textarea,select,[contenteditable=true],[role=combobox],[data-no-drag]")) listeners?.onMouseDown?.(event); }}
    onTouchStart={event => { if (!(event.target as Element).closest("input,textarea,select,[contenteditable=true],[role=combobox],[data-no-drag]")) listeners?.onTouchStart?.(event); }}>
    <div className="application-card-heading">{title}<button ref={setActivatorNodeRef} {...attributes} onKeyDown={event => listeners?.onKeyDown?.(event)} id={`application-drag-${job.id}`} type="button" className="application-drag-handle" disabled={busy} aria-label={`Déplacer la candidature : ${job.title} · ${job.company || "Entreprise à confirmer"}`} aria-roledescription="carte déplaçable" title="Glisser vers une autre étape · Entrée puis flèches au clavier"><GripVertical size={17} aria-hidden/></button></div>
    {children}
    <button type="button" data-no-drag className="application-move-button" disabled={busy} aria-label={`Déplacer ${job.company || job.title} vers une colonne`} onClick={() => chooseDestination(job.id)}><ArrowRightLeft size={15} aria-hidden/>Déplacer</button>
  </article>;
}
