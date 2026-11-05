"use client";

import { CalendarDays, Pencil, Plus } from "lucide-react";
import { ApplicationDrag, ApplicationDropColumn, DraggableApplicationCard } from "@/components/application-drag";
import { TagBadge, useApplicationTags } from "@/components/application-tags";
import { ChoiceSelect } from "@/components/choice-select";
import type { WorkspaceView } from "@/components/offer-workspace";
import { applicationAge, formatDate, reviewDue, statusLabels, terminalStatuses } from "@/lib/application-workflow";
import { applicationColumn, applicationDestination, applicationInterviewStep } from "@/lib/application-board";
import { defaultBoard, personalColumn, type PersonalBoard, type PersonalColumn } from "@/lib/personal-board";
import type { JobRecord, JobStatus } from "@/lib/types";
import { tagsForJob } from "@/lib/application-tags";
import { useEffect, useState } from "react";

export function ApplicationKanban({ jobs, now, busy, onStatus, onOpen, board = defaultBoard(), onColumn }: { jobs: JobRecord[]; now: number; busy: string | null; onStatus: (job: JobRecord, status: JobStatus, columnId?: string) => Promise<boolean>; onOpen: (job: JobRecord, view?: WorkspaceView) => void; board?: PersonalBoard; onColumn?: (column?: PersonalColumn) => void }) {
  const tagStore = useApplicationTags();
  const [tagFilter, setTagFilter] = useState("");
  useEffect(() => { if (tagStore.ready && tagFilter && !tagStore.tags.some(tag => tag.id === tagFilter)) setTagFilter(""); }, [tagFilter, tagStore.ready, tagStore.tags]);
  const selectedTag = tagStore.tags.find(tag => tag.id === tagFilter);
  const visibleJobs = selectedTag ? jobs.filter(job => selectedTag.jobIds.includes(job.id)) : jobs;
  const columns = board.columns.filter(column => column.stage !== "other" || jobs.some(job => applicationColumn(job) === "other"));
  return <ApplicationDrag columns={columns} jobs={jobs} busy={busy} onStatus={onStatus}><div className="application-tags-filter"><ChoiceSelect label="Filtrer par tag" value={tagFilter} onChange={setTagFilter} disabled={!tagStore.ready} options={[{ value: "", label: "Tous les tags" }, ...tagStore.tags.map(tag => ({ value: tag.id, label: tag.name }))]}/>{tagFilter ? <button type="button" className="signal-quiet-button" onClick={() => setTagFilter("")}>Effacer le filtre</button> : null}{tagStore.loadError ? <span role="alert" className="signal-form-error">{tagStore.loadError}</span> : null}</div><div className="application-board" role="region" aria-label="Kanban des candidatures, défilement horizontal" tabIndex={0}>
    {columns.map(column => {
      const items = visibleJobs.filter(job => personalColumn(job, columns) === column.id);
      return <ApplicationDropColumn key={column.id} column={column.id} stage={column.stage} busy={!!busy}>
        <header className="application-column-heading"><h2 id={`application-column-${column.id}`}>{column.label}</h2>{onColumn ? <button type="button" className="board-column-edit" aria-label={`Modifier la colonne ${column.label}`} disabled={!!busy} onClick={()=>onColumn(column)}><Pencil size={14} aria-hidden/></button> : null}<span className="workspace-badge" aria-label={`${items.length} candidature${items.length === 1 ? "" : "s"}`}>{items.length}</span></header>
        <div className="application-column-cards">{items.length ? items.map(job => {
          const age = applicationAge(job.appliedAt, now);
          const step = applicationInterviewStep(job, now);
          const interview = column.stage === "interviews";
          const due = !terminalStatuses.includes(job.status) && job.interviews?.some(event => reviewDue(event, now));
          return <DraggableApplicationCard key={job.id} job={job} column={column.id} busy={!!busy} title={<h3><button type="button" aria-label={`Ouvrir la candidature : ${job.title} · ${job.company || "Entreprise à confirmer"}`} onClick={() => onOpen(job, applicationDestination(job, now))}><span className="application-card-title-text">{job.title}</span></button></h3>}>
            <p className="application-card-company">{job.company || "Entreprise à confirmer"}</p>
            {tagsForJob(tagStore.tags, job.id).length ? <div className="application-card-tags">{tagsForJob(tagStore.tags, job.id).map(tag => <TagBadge key={tag.id} tag={tag} selected={tagFilter === tag.id} onClick={() => setTagFilter(current => current === tag.id ? "" : tag.id)}/>)}</div> : null}
            {job.deletedAt ? <p className="signal-help">Offre en corbeille · suivi conservé</p> : null}
            <div className="application-card-date"><span>Envoyée le</span><span className={`application-age${age ? ` is-${age.tone}` : ""}`}>{job.appliedAt ? formatDate(job.appliedAt, "Indian/Mauritius") : "Date inconnue"}</span></div>
            {interview ? <div className="application-card-step">
              <span className="application-card-round">{step.rank ? `${step.rank === 1 ? "1er" : `${step.rank}e`} entretien` : "Entretien à dater"}</span>
              {due ? <span className="workspace-badge is-warning">Bilan à faire</span> : null}
              {step.next ? <p><CalendarDays size={14} aria-hidden/><span>{formatDate(step.next.startAt, step.next.timeZone, true)}<small>{step.next.timeZone}</small></span></p> : <p className="signal-help">{step.current?.state === "reviewed" ? "Entretien effectué · suite à suivre" : step.current ? "Rendez-vous terminé" : "Ajoutez le prochain rendez-vous dans le dossier."}</p>}
            </div> : column.stage === "closed" || column.stage === "other" ? <p className="application-card-outcome">{statusLabels[job.status]}</p> : null}
          </DraggableApplicationCard>;
        }) : <p className="application-column-empty">Aucune candidature</p>}</div>
      </ApplicationDropColumn>;
    })}
    {onColumn ? <button type="button" className="board-add-column" disabled={!!busy} onClick={()=>onColumn()}><Plus size={17} aria-hidden/>Ajouter une colonne</button> : null}
  </div></ApplicationDrag>;
}
