"use client";

import { ArrowUpRight, CalendarDays } from "lucide-react";
import { ApplicationDrag, ApplicationDropColumn, DraggableApplicationCard } from "@/components/application-drag";
import { StatusSelect, type WorkspaceView } from "@/components/offer-workspace";
import { applicationAge, formatDate, reviewDue, statusLabels, terminalStatuses } from "@/lib/application-workflow";
import { applicationColumn, applicationColumns, applicationDestination, applicationInterviewStep } from "@/lib/application-board";
import type { JobRecord, JobStatus } from "@/lib/types";

export function ApplicationKanban({ jobs, now, busy, onStatus, onOpen }: { jobs: JobRecord[]; now: number; busy: string | null; onStatus: (job: JobRecord, status: JobStatus) => Promise<boolean>; onOpen: (job: JobRecord, view?: WorkspaceView) => void }) {
  const columns = applicationColumns.filter(column => column.id !== "other" || jobs.some(job => applicationColumn(job) === "other"));
  return <ApplicationDrag jobs={jobs} busy={busy} onStatus={onStatus}><div className="application-board" role="region" aria-label="Kanban des candidatures, défilement horizontal" tabIndex={0}>
    {columns.map(column => {
      const items = jobs.filter(job => applicationColumn(job) === column.id);
      return <ApplicationDropColumn key={column.id} column={column.id} busy={!!busy}>
        <header className="application-column-heading"><h2 id={`application-column-${column.id}`}>{column.label}</h2><span className="workspace-badge" aria-label={`${items.length} candidature${items.length === 1 ? "" : "s"}`}>{items.length}</span></header>
        <div className="application-column-cards">{items.length ? items.map(job => {
          const age = applicationAge(job.appliedAt, now);
          const step = applicationInterviewStep(job, now);
          const interview = column.id === "interviews";
          const due = !terminalStatuses.includes(job.status) && job.interviews?.some(event => reviewDue(event, now));
          return <DraggableApplicationCard key={job.id} job={job} busy={!!busy} title={<h3><button type="button" aria-label={`Ouvrir la candidature : ${job.title} · ${job.company || "Entreprise à confirmer"}`} onClick={() => onOpen(job, applicationDestination(job, now))}>{job.title}<ArrowUpRight size={15} aria-hidden/></button></h3>}>
            <p className="application-card-company">{job.company || "Entreprise à confirmer"}</p>
            {job.deletedAt ? <p className="signal-help">Offre en corbeille · suivi conservé</p> : null}
            <div className="application-card-date"><span>Envoyée le</span><span className={`application-age${age ? ` is-${age.tone}` : ""}`}>{job.appliedAt ? formatDate(job.appliedAt, "Indian/Mauritius") : "Date inconnue"}</span></div>
            {interview ? <div className="application-card-step">
              <span className="application-card-round">{step.rank ? `${step.rank === 1 ? "1er" : `${step.rank}e`} entretien` : "Entretien à dater"}</span>
              {due ? <span className="workspace-badge is-warning">Bilan à faire</span> : null}
              {step.next ? <p><CalendarDays size={14} aria-hidden/><span>{formatDate(step.next.startAt, step.next.timeZone, true)}<small>{step.next.timeZone}</small></span></p> : <p className="signal-help">{step.current?.state === "reviewed" ? "Entretien effectué · suite à suivre" : step.current ? "Rendez-vous terminé" : "Ajoutez le prochain rendez-vous dans le dossier."}</p>}
            </div> : column.id === "closed" || column.id === "other" ? <p className="application-card-outcome">{statusLabels[job.status]}</p> : null}
            <div id={`application-status-${job.id}`} className="application-card-status"><StatusSelect value={job.status} disabled={!!busy} label={`Statut · ${job.company || job.title}`} onChange={status => void onStatus(job, status)}/></div>
          </DraggableApplicationCard>;
        }) : <p className="application-column-empty">Aucune candidature</p>}</div>
      </ApplicationDropColumn>;
    })}
  </div></ApplicationDrag>;
}
