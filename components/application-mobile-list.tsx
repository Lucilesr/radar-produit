"use client";

import { useId, useRef, useState } from "react";
import { Dialog } from "radix-ui";
import { ArrowUpRight, ChevronDown, Pencil, Plus } from "lucide-react";
import { ApplicationCareBadge } from "@/components/application-care";
import { ChoiceSelect } from "@/components/choice-select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { WorkspaceButton, WorkspaceFormError } from "@/components/workspace-form";
import { useDisplayTimeZone } from "@/components/use-display-time-zone";
import type { WorkspaceView } from "@/components/offer-workspace";
import { applicationGroups } from "@/lib/application-groups";
import { applicationDestination, applicationInterviewStep, applicationMove } from "@/lib/application-board";
import { applicationAge, formatDate, reviewDue, statusLabels, terminalStatuses } from "@/lib/application-workflow";
import { personalColumn, type PersonalBoard, type PersonalColumn } from "@/lib/personal-board";
import type { JobRecord, JobStatus } from "@/lib/types";

export function ApplicationMobileList({ jobs, board, busy, now, onStatus, onOpen, onColumn, scope }: {
  jobs: JobRecord[]; board: PersonalBoard; busy: string | null; now: number; scope: string;
  onStatus: (job: JobRecord, status: JobStatus, columnId?: string) => Promise<boolean>;
  onOpen: (job: JobRecord, view?: WorkspaceView) => void; onColumn: (column?: PersonalColumn) => void;
}) {
  const zone = useDisplayTimeZone(), id = useId();
  const [closing, setClosing] = useState<{ job: JobRecord; target: string } | null>(null);
  const [reason, setReason] = useState<"rejected" | "withdrawn" | "">("");
  const [message, setMessage] = useState(""), [error, setError] = useState("");
  const lock = useRef(false), lastJob = useRef<string | null>(null), lastGroup = useRef<string | null>(null);
  const groups = applicationGroups(jobs, board.columns);
  const columns = groups.map(group => group.column);
  function returnFocus() {
    requestAnimationFrame(() => {
      const trigger = lastJob.current ? document.getElementById(`application-mobile-${lastJob.current}`) : null;
      const groupTrigger = lastGroup.current ? document.getElementById(`application-mobile-group-${lastGroup.current}`) : null;
      (trigger?.getClientRects().length ? trigger : groupTrigger ?? document.getElementById("workspace-title"))?.focus();
    });
  }
  async function move(job: JobRecord, target: string, closure?: JobStatus) {
    if (busy || lock.current) return;
    const column = columns.find(item => item.id === target);
    if (!column || column.stage === "other" || personalColumn(job, columns) === target) return;
    lastJob.current = job.id; lastGroup.current = target;
    const plan = applicationMove(job, column.stage, closure);
    if (plan.kind === "confirm-close") { setClosing({ job, target }); setReason(""); setError(""); return; }
    if (plan.kind !== "status" && plan.kind !== "none") return;
    lock.current = true; setError(""); setMessage(`Enregistrement vers ${column.label}…`);
    try {
      const saved = await onStatus(job, plan.kind === "status" ? plan.status : job.status, target);
      if (saved) { setClosing(null); setMessage(`Candidature déplacée vers ${column.label}.`); }
      else { setError("Déplacement non confirmé. Le dernier statut confirmé reste affiché."); setMessage(""); }
    } catch { setError("Déplacement non confirmé. Actualisez pour vérifier avant de réessayer."); setMessage(""); }
    finally { lock.current = false; if (column.stage !== "closed") returnFocus(); }
  }
  return <div className="application-mobile-list">
    <div className="application-mobile-summary"><p>{jobs.length} candidature{jobs.length === 1 ? "" : "s"}</p><WorkspaceButton variant="quiet" disabled={!!busy} onClick={() => onColumn()}><Plus size={16} aria-hidden/>Ajouter une étape</WorkspaceButton></div>
    <p className="sr-only" role="status">{message}</p><WorkspaceFormError message={closing ? "" : error}/>
    {groups.filter(group => scope === "closed" ? group.column.stage === "closed" : scope === "active" ? group.column.stage !== "closed" : true).map(({ column, jobs: items }) => <Collapsible key={column.id} defaultOpen className={`application-mobile-group is-${column.stage}`}>
      <div className="application-mobile-group-heading"><h2><CollapsibleTrigger id={`application-mobile-group-${column.id}`} className="signal-quiet-button"><span>{column.label}</span><span className="workspace-badge" aria-label={`${items.length} candidature${items.length === 1 ? "" : "s"}`}>{items.length}</span><ChevronDown size={16} aria-hidden/></CollapsibleTrigger></h2><button type="button" className="board-column-edit" disabled={!!busy} aria-label={`Modifier la colonne ${column.label}`} onClick={() => onColumn(column)}><Pencil size={16} aria-hidden/></button></div>
      <CollapsibleContent className="application-mobile-cards">
        {items.map(job => {
          const closed = terminalStatuses.includes(job.status);
          const step = applicationInterviewStep(job, now), age = applicationAge(job.appliedAt, now);
          const due = !closed && job.interviews?.some(event => reviewDue(event, now));
          const followup = !closed && job.applicationFollowup?.eligible && job.applicationFollowup.dueAt && !job.applicationFollowup.doneAt && Date.parse(job.applicationFollowup.dueAt) <= now;
          const next = !closed && step.next;
          const label = job.status === "offer" ? "Ouvrir" : due ? "Faire le bilan" : followup ? "Faire la relance" : next ? "Voir l’entretien" : "Ouvrir";
          return <article key={job.id} className="application-mobile-card" aria-busy={busy === job.id}>
            <h3>{job.title}</h3><p className="application-card-company">{job.company || "Entreprise à confirmer"}</p><ApplicationCareBadge job={job}/>
            {job.deletedAt ? <p className="signal-help">Offre en corbeille · suivi conservé</p> : null}
            <p className="application-mobile-sent">Envoyée le <span className={`application-age${age ? ` is-${age.tone}` : ""}`}>{job.appliedAt ? formatDate(job.appliedAt, zone) : "Date inconnue"}</span></p>
            <span className={`workspace-badge${due || followup ? " is-warning" : ""}`}>{closed ? statusLabels[job.status] : job.status === "offer" ? "Proposition reçue" : due ? "Bilan à faire" : followup ? "Relance à faire" : next ? "Entretien planifié" : job.status === "interview" ? "Entretien à suivre" : "En attente de retour"}</span>
            {next ? <p className="signal-help">{formatDate(next.startAt, next.timeZone, true)} · {next.timeZone}</p> : null}
            <ChoiceSelect label={`Étape · ${job.company || job.title}`} value={personalColumn(job, columns)} disabled={!!busy} options={columns.filter(item => item.stage !== "other" || item.id === personalColumn(job, columns)).map(item => ({ value: item.id, label: item.label }))} onChange={target => void move(job, target)}/>
            <WorkspaceButton id={`application-mobile-${job.id}`} variant="primary" onClick={() => onOpen(job, applicationDestination(job, now))} aria-label={`${label} · ${job.company || job.title}`}>{label}<ArrowUpRight size={16} aria-hidden/></WorkspaceButton>
          </article>;
        })}
      </CollapsibleContent>
    </Collapsible>)}
    <Dialog.Root open={!!closing} onOpenChange={open => { if (!open && !busy && !lock.current) setClosing(null); }}><Dialog.Portal><Dialog.Overlay className="application-move-overlay"/><Dialog.Content className="application-move-dialog" onEscapeKeyDown={event => { if (busy) event.preventDefault(); }} onPointerDownOutside={event => { if (busy) event.preventDefault(); }} onCloseAutoFocus={event => { event.preventDefault(); returnFocus(); }}>
      <Dialog.Title>Clore cette candidature ?</Dialog.Title><Dialog.Description>Choisissez ce qui termine le processus. Les notes et les entretiens restent dans le dossier.</Dialog.Description>
      <p className="application-move-company">{closing?.job.title} · {closing?.job.company || "Entreprise à confirmer"}</p>
      <fieldset disabled={!!busy}><legend>Motif de clôture</legend>{([["rejected", "Refus reçu"], ["withdrawn", "J’arrête le processus"]] as const).map(([value, label]) => <label key={value}><input type="radio" name={`closure-${id}`} checked={reason === value} onChange={() => { setReason(value); setError(""); }}/>{label}</label>)}</fieldset>
      <WorkspaceFormError message={error}/><div className="application-move-actions"><WorkspaceButton disabled={!!busy} onClick={() => setClosing(null)}>Annuler</WorkspaceButton><WorkspaceButton variant="danger" busy={!!busy} disabled={!reason} onClick={() => { if (closing && reason) void move(closing.job, closing.target, reason); }}>Clore la candidature</WorkspaceButton></div>
    </Dialog.Content></Dialog.Portal></Dialog.Root>
  </div>;
}
