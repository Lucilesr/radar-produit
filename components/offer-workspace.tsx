"use client";
import { SignalMoment } from "@/components/signal/signal-moment";
import { detectLevel, levelLabels } from "@/lib/seniority";
import { formatPayRangeShort } from "@/lib/pay-range";
import {ApplicationLessonCard} from "@/components/application-lesson";
import {ApplicationFollowupCard} from "@/components/application-followup";
import { requestError } from "@/lib/request-error";
import { briefExperiencePreview, type briefSummary } from "@/lib/candidate-brief";

import { AutosaveStatus, NoteHistory, useAutosave, useDraftPreload, useSavedForm } from "@/components/autosave";
import { sourceNames } from "@/lib/source-catalog";
import { OfferForm } from "@/components/offer-form";
import { countryLabel } from "@/lib/countries";
import { confirmedProgress, cancelEncouragement } from "@/lib/progress-event";
import { DateTimePicker } from "@/components/date-picker";
import { HelpTooltip } from "@/components/help-tooltip";
import { useWorkspaceFeedback } from "@/components/workspace-feedback";
import { NoteEditor, NoteText } from "@/components/note-editor";
import { WorkspaceButton, WorkspaceFormError, WorkspaceFormSection, WorkspaceSaveActions, useWorkspaceEditorFocus } from "@/components/workspace-form";
import { useEffect, useId, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { Tabs } from "radix-ui";
import { CalendarDays, CalendarPlus, CheckCircle2, ChevronDown, ChevronUp, CircleAlert, CircleHelp, Copy, ExternalLink, LoaderCircle, Pencil, Undo2 } from "lucide-react";
import { ChoiceSelect, type ChoiceOption } from "@/components/choice-select";
import { SourceLogo } from "@/components/source-logo";
import {useRadarClock} from "@/components/use-radar-clock";
import {ApplicationCare} from "@/components/application-care";
import { ApplicationQuestions } from "@/components/application-questions";
import { ApplicationTagBadges } from "@/components/application-tags";
import { formatDate, fromZonedInput, reviewDue, statusLabels, zonedInput } from "@/lib/application-workflow";
import { formatPay } from "@/lib/pay-range";
import { fitLabels, isGoodFind, isMysteryOffer, revealMessage } from "@/lib/fit";
import { hasApplication, workspaceSections } from "@/lib/opportunity-views";
import type { RadarRoute } from "@/lib/radar-navigation";
import type { CandidateProfile, InterviewRecord, JobRecord, JobStatus } from "@/lib/types";

export type WorkspaceView = RadarRoute["view"];

type OfferEditControl = {
  active: boolean;
  onClose: () => void;
  trigger: RefObject<HTMLButtonElement | null>;
  actionBar: HTMLElement | null;
};
const statusGroup: Record<JobStatus, string> = {
  new: "À examiner", watchlist: "À examiner", shortlist: "À examiner", prepare: "Candidature", ready: "Candidature", applied: "Candidature",
  interview: "Échanges", awaiting_response: "Échanges", next_step: "Échanges", offer: "Échanges",
  rejected: "Clôture", withdrawn: "Clôture", closed: "Clôture",
};
const legacyStatuses: JobStatus[] = ["new", "watchlist", "shortlist", "prepare", "closed"];
const statusOptions: ChoiceOption<JobStatus>[] = (Object.entries(statusLabels) as [JobStatus, string][])
  .filter(([value]) => !legacyStatuses.includes(value))
  .map(([value, label]) => ({ value, label: value === "interview" ? "Entretiens en cours" : label, group: statusGroup[value] }));
export function StatusSelect({ value, onChange, label = "Statut de candidature", disabled = false, compact = false }: { value: JobStatus; onChange: (status: JobStatus) => void; label?: string; disabled?: boolean; compact?: boolean }) {
  return <ChoiceSelect displayValue={compact ? ({applied:"Envoyée",interview:"Entretiens",awaiting_response:"Attente de retour",next_step:"Prochaine étape",offer:"Offre reçue",rejected:"Refus",withdrawn:"Arrêt du processus"} as Partial<Record<JobStatus,string>>)[value] : undefined} disabled={disabled} label={label} value={value} onChange={onChange} options={legacyStatuses.includes(value) ? [{ value, label: statusLabels[value], group: "Statut actuel" }, ...statusOptions] : statusOptions} />;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-xs font-semibold text-muted-foreground"><span className="mb-1.5 block">{label}</span>{children}</label>; }
async function requestJob(path: string, method: string, value: unknown) {
  const response = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(value), signal: AbortSignal.timeout(15000) });
  const data = await response.json() as { job?: JobRecord; error?: string };
  if (!response.ok || !data.job) throw new Error(data.error ?? "Enregistrement non confirmé."); return data.job;
}
function coverageLabel(job: JobRecord) {
  return job.contentCoverage === "full" ? "Description complète fournie" : job.contentCoverage === "partial" || /fiche détaillée non incluse|ne contient pas la fiche|fiche détaillée.*confirmer/i.test(job.description ?? "") ? "Notification partielle" : job.contentCoverage === "summary" ? "Synthèse disponible" : "Détails à confirmer";
}
export function OfferSourceBadge({ job }: { job: JobRecord }) {
  const manual=job.source==="Ajout manuel";
  return <span className="review-source" aria-label={manual?"Source : saisie manuelle":`Source : ${job.source}`}>
    {!manual?<SourceLogo name={job.source} compact/>:null}<span>{manual?"Saisie manuelle":job.source}</span>
  </span>;
}
function ConditionRow({ label, value }: { label: string; value?: string | null }) {
  return <div className="review-condition-row">
    <dt>{label}</dt>
    <dd>{value ?? <span className="workspace-badge is-warning">À compléter</span>}</dd>
  </div>;
}

export function ApplicationTrackingAction({job,onStatus,onOpenApplication,disabled=false}:{job:JobRecord;disabled?:boolean;onStatus:(id:string,status:JobStatus)=>Promise<boolean>;onOpenApplication:()=>void}){
  const [starting,setStarting]=useState(false);
  return <button type="button" className="secondary-button reading-application-action" disabled={starting||disabled} aria-busy={starting} onClick={async()=>{if(hasApplication(job)){onOpenApplication();return;}setStarting(true);try{await onStatus(job.id,"applied");}finally{setStarting(false);}}}>{starting?<LoaderCircle size={14} className="animate-spin" aria-hidden/>:null}{hasApplication(job)?"Voir dans Candidatures":"J’ai postulé"}</button>;
}

export function OfferWorkspace({ job, profile, initialView, context, onChange, onStatus, onNote, onOpenApplication, onOpenCarnet, onCancelApplication, onViewChange, showApplicationAction = true, showAnnouncement = true, editControl,compactApplication=false,startFollowupEdit=false }: {
  compactApplication?:boolean;startFollowupEdit?:boolean;
  editControl?: OfferEditControl;
  showApplicationAction?: boolean;
  showAnnouncement?: boolean;
  onViewChange?: (view: WorkspaceView) => void;
  onOpenCarnet: () => void;
  job: JobRecord; profile: CandidateProfile; initialView: WorkspaceView; context: "opportunity" | "application"; onChange: (job: JobRecord, message?: string) => void;
  onStatus: (id: string, status: JobStatus) => Promise<boolean>; onNote: (id: string, note: string) => Promise<boolean>; onOpenApplication: () => void; onCancelApplication?: () => Promise<boolean>;
}) {
  const editTrigger=useRef<HTMLButtonElement>(null);
  const dossierNow=useRadarClock()??0;
  const [followupIntent,setFollowupIntent]=useState(startFollowupEdit);
  const notify=useWorkspaceFeedback();
  const mystery=isMysteryOffer(job);
  const [view, updateView] = useState<WorkspaceView>(initialView);
  const setView = (next: WorkspaceView) => { updateView(next); onViewChange?.(next); };
  useEffect(()=>updateView(initialView),[initialView]);
  const [localEditing, setLocalEditing] = useState(false);
  const editing = editControl?.active ?? localEditing;
  const [revealed,setRevealed]=useState<JobRecord|null>(null);

  function finishEditing() {
    if (editControl) editControl.onClose();
    else setLocalEditing(false);
    requestAnimationFrame(() => {
      const trigger = (editControl?.trigger ?? editTrigger).current;
      if (!trigger || (editControl?.actionBar && !editControl.actionBar.contains(trigger))) return;
      trigger.focus({ preventScroll: true });
      trigger.scrollIntoView({ block: "nearest" });
    });
  }
  const noteSave=useAutosave(`note:${job.id}`,job.candidateNote??"",2000);
  const note=noteSave.value,setNote=noteSave.setValue;
  const [statusBusy,setStatusBusy] = useState(false);
  const noteEditorRef = useRef<HTMLDivElement>(null);
  const coverage = coverageLabel(job);
  const sourceUrl = job.sourceUrl;
  const applyUrl = job.applicationUrl && job.applicationUrl !== sourceUrl ? job.applicationUrl : !sourceUrl ? job.applicationUrl : undefined;
  const labels: Record<WorkspaceView, string> = { offer: "L’offre", conditions: "Conditions et dates", application: "Ma candidature", interviews: `Entretiens (${job.interviews?.length ?? 0})`, brief: "Préparer / brief" };
  const tabs = workspaceSections(context);
  const activeView = (context === "opportunity" && editing) || !tabs.some(tab => tab === view) ? "offer" : view;
  useDraftPreload((context === "opportunity" || activeView === "offer") && !job.deletedAt ? `offer:${job.id}` : "");
  useEffect(() => { if (activeView !== "application" || job.status !== "offer") return; const frame = requestAnimationFrame(() => { noteEditorRef.current?.focus({preventScroll:true}); noteEditorRef.current?.scrollIntoView({block:"center"}); }); return () => cancelAnimationFrame(frame); }, [activeView,job.id,job.status]);
  const announcement = showAnnouncement ? <div className="signal-external-link">{sourceUrl || applyUrl ? <a href={sourceUrl || applyUrl} target="_blank" rel="noopener noreferrer" className="secondary-button"><ExternalLink size={14} aria-hidden />Voir l’annonce</a> : <span className="offer-link-missing">Lien de l’annonce à renseigner</span>}</div> : null;
  const editor = <OfferEditor job={job} actionBar={editControl?.actionBar} onSaved={updated => { onChange(updated); finishEditing(); if (mystery && !isMysteryOffer(updated)) { if(context==="opportunity"&&isGoodFind(updated))setRevealed(updated); else notify({ message: revealMessage(updated) }); } }} onCancel={finishEditing} />;
  if(context==="opportunity")return <div className="signal-offer-workspace aligned-offer-workspace">
    <AlignedOfferFacts job={job}/>
    <Tabs.Root className="aligned-offer-tabs" value={activeView} onValueChange={id=>setView(id as WorkspaceView)} activationMode="manual">
      <div className="signal-offer-nav">
        <Tabs.List aria-label="Sections de l’offre" className="signal-workspace-tabs">{tabs.map(id=><Tabs.Trigger value={id} key={id} disabled={editing&&id!=="offer"}>{labels[id]}</Tabs.Trigger>)}</Tabs.List>
      </div>
      <Tabs.Content value="offer">{editing ? editor : <AlignedOfferRead job={job} />}</Tabs.Content>
      <Tabs.Content value="conditions"><AlignedOfferConditions job={job} /></Tabs.Content>
      <Tabs.Content value="brief" className="space-y-5"><ApplicationCare key={`care:${job.id}`} job={job}/><PrivateBrief key={job.id} jobId={job.id} onOpenCarnet={onOpenCarnet}/></Tabs.Content>
    </Tabs.Root>
    {!editControl && !editing && !job.deletedAt ? <div className="experience-actions" role="group" aria-label="Actions sur cette offre">
      {showApplicationAction ? <ApplicationTrackingAction job={job} onStatus={onStatus} onOpenApplication={onOpenApplication} /> : null}
      <WorkspaceButton ref={editTrigger} aria-label="Modifier l’annonce" onClick={() => { setView("offer"); setLocalEditing(true); }}><Pencil size={16} aria-hidden />Modifier</WorkspaceButton>
    </div> : null}
    <SignalMoment className="aligned-offer-moment" open={!!revealed} onClose={()=>setRevealed(null)} title="Bonne pioche" description={revealed?`Cette offre colle à vos critères · ${revealed.fit} sur 100`:undefined} actionLabel="Voir la fiche"/>
  </div>;
  return <div className="signal-offer-workspace space-y-5">
    {announcement}
    <div className="signal-application-nav"><nav aria-label="Sections de la candidature" className="signal-workspace-tabs">{tabs.map(id=><button type="button" key={id} onClick={()=>setView(id)} aria-current={activeView===id?"page":undefined}>{labels[id]}</button>)}</nav></div>
    <ApplicationTagBadges jobId={job.id}/>
    {activeView==="offer"&&!editing?<>
      <section aria-label="Informations clés de l’offre" className="review-conditions">
        <h3>Conditions de l’offre</h3>
        <dl className="review-criteria-grid">
          <ConditionRow label="Contrat" value={job.contractType === "cdi" ? "CDI" : job.contractType === "cdd" ? "CDD" : job.contractType === "freelance" ? "Freelance" : job.contractType === "portage" ? "Portage salarial" : job.contractType === "part_time" ? "Temps partagé" : "À confirmer"}/>
          <ConditionRow label="Rémunération" value={(job.dailyRate != null || job.dailyRateMin != null || job.dailyRateMax != null ? formatPay(job.dailyRateMin, job.dailyRateMax, job.dailyRate, "HT/jour") : formatPay(job.salaryMin, job.salaryMax, job.annualSalary, "brut/an")) ?? "Non communiquée"}/>
          <ConditionRow label="Mode de travail" value={{ full_remote: "Full remote", exceptional: "Présence exceptionnelle", hybrid: "Hybride", onsite: "Sur site", unknown: "À confirmer" }[job.remoteMode]}/>
          <ConditionRow label="Lieu annoncé" value={job.announcedLocation || "À confirmer"}/>
          <ConditionRow label="Présence sur site" value={[job.onsiteDaysPerWeek!=null?`${job.onsiteDaysPerWeek} j/semaine sur site`:"",job.onsiteDaysPerMonth!=null?`${job.onsiteDaysPerMonth} j/mois sur site`:"",job.onsiteCadence].filter(Boolean).join(" · ")||"À confirmer"}/>
          <ConditionRow label="Pays autorisé en télétravail" value={countryLabel(job.remoteCountry)}/>
          <ConditionRow label="Langue" value={{fr:"Français",en:"Anglais",professional_en:"Anglais professionnel",advanced_en:"Anglais avancé",unknown:"À confirmer"}[job.language]}/>
        </dl>

      </section>
      {mystery ? <section className="offer-mystery" aria-labelledby={`mystery-${job.id}`}>
        <div><h3 id={`mystery-${job.id}`} className="offer-section-title">Fiche mystère</h3>
        <p>Cette offre vise votre poste, mais la source n’en donne qu’un aperçu. Collez l’annonce complète : Radar révèle alors son adéquation.</p></div>
        <div className="offer-mystery-actions">{sourceUrl ? <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="secondary-button"><ExternalLink size={14} aria-hidden />Ouvrir l’annonce</a> : null}
        <WorkspaceButton variant="primary" onClick={() => setLocalEditing(true)}>Coller l’annonce</WorkspaceButton></div>
      </section> : <FitSummary job={job} />}
      <div className="grid gap-3 sm:grid-cols-2"><Signals title={"Pourquoi c’est pertinent"} items={job.reasons} tone="positive" /><Signals title="Points à vérifier" items={job.flags} tone="caution" /></div>
      <section className="reading-description"><div className="reading-description-heading"><div><h3 className="offer-section-title">Description, missions et exigences</h3><p className="review-coverage">{coverage}</p></div>{!job.deletedAt ? <button ref={editTrigger} onClick={() => setLocalEditing(true)} className="secondary-button"><Pencil size={13} /> Compléter / corriger</button> : null}</div><p className="offer-description-read">{job.description || "Aucune description fournie. Ajoutez le contenu de l’annonce ou d’une alerte autorisée."}</p>{coverage !== "Description complète fournie" ? <p className="mt-2 text-xs leading-5 text-muted-foreground">{coverage} : les informations absentes restent à confirmer.{!job.deletedAt ? " Vous pouvez coller une description complète ici, sans recréer une fiche." : " Restaurez l’offre pour compléter sa description."}</p> : null}</section>
      <section className="review-offer-dates" aria-label="Dates de l’offre">
        <h3 className="review-dates-heading">Dates de l’offre</h3>
        <dl className="review-dates"><ConditionRow label="Publication" value={formatDate(job.publishedAt)}/><ConditionRow label="Ajout au Radar" value={formatDate(job.createdAt)}/>{job.notificationAt?<ConditionRow label="Notification source" value={formatDate(job.notificationAt)}/>:null}</dl>
      {!job.publishedAt ? <div className="inline-help"><span>Date de publication non précisée</span><HelpTooltip label="Date de publication">Date de mise en ligne de l’annonce.</HelpTooltip></div> : null}
      </section>
    </> : null}
    {activeView==="offer"&&editing?editor:null}
    {compactApplication&&(activeView==="application"||activeView==="brief")?<section className="application-mobile-dossier-next" aria-label="Prochaine action"><h3>Prochaine action</h3><p>{job.applicationFollowup?.eligible&&job.applicationFollowup.dueAt&&!job.applicationFollowup.doneAt&&Date.parse(job.applicationFollowup.dueAt)<=dossierNow?`Relancer ${job.company||job.title}`:job.status==="interview"?`Préparer le prochain échange avec ${job.company||job.title}`:job.status==="rejected"?"Un bilan, si cela vous aide":"Préparer la suite de cette candidature"}</p><WorkspaceButton variant="quiet" onClick={()=>{const followup=document.getElementById(`application-followup-${job.id}`);const check=document.querySelector<HTMLButtonElement>('.application-care button[role=checkbox][data-state=unchecked]');(job.applicationFollowup?.eligible?followup:check??document.querySelector<HTMLElement>('.application-care'))?.focus();}}>Voir la prochaine action</WorkspaceButton></section>:null}
    {activeView==="brief"||activeView==="application"?<ApplicationCare key={`care:${job.id}`} job={job}/>:null}
    {compactApplication&&activeView==="application"?<WorkspaceFormSection className="application-mobile-dossier-dates" title="Dates"><p>{job.appliedAt?`Envoyée le ${formatDate(job.appliedAt)}`:"Envoi non déclaré"}</p>{(job.interviews??[]).filter(event=>event.state==="planned"&&Date.parse(event.startAt)>=dossierNow).toSorted((a,b)=>Date.parse(a.startAt)-Date.parse(b.startAt)).slice(0,1).map(event=><p key={event.id}>Prochain entretien : {formatDate(event.startAt,event.timeZone,true)}</p>)}</WorkspaceFormSection>:null}
    {activeView === "application" ? <div className="signal-application-form">
      <ApplicationLessonCard key={`lesson:${job.id}`} job={job}/>
      <ApplicationFollowupCard key={`followup:${job.id}:${job.appliedAt??"unknown"}`} job={job} onInterviews={()=>setView("interviews")} initialEditor={followupIntent} onEditorClosed={()=>setFollowupIntent(false)}/>
      <WorkspaceFormSection title="Suivi de candidature" actions={<WorkspaceButton disabled={statusBusy} onClick={() => setView("interviews")}><CalendarDays size={15} aria-hidden />Voir les entretiens</WorkspaceButton>}>
        <div className="signal-status-field" aria-busy={statusBusy}><StatusSelect label={compactApplication?"Changer d’étape":"Statut de candidature"} value={job.status} disabled={statusBusy} onChange={async status => { setStatusBusy(true); try { await onStatus(job.id, status); } finally { setStatusBusy(false); } }} />{job.status === "applied" && !job.interviews?.length && onCancelApplication ? <button type="button" className="signal-quiet-button" disabled={statusBusy} onClick={async()=>{setStatusBusy(true);try{await onCancelApplication();}finally{setStatusBusy(false);}}}><Undo2 size={14} aria-hidden />Annuler « J’ai postulé »</button> : null}</div>
      </WorkspaceFormSection>
      <WorkspaceFormSection title="Notes privées de candidature">
        <NoteEditor inputRef={noteEditorRef} label="Notes privées de candidature" rows={4} disabled={!noteSave.ready} maxLength={2000} value={note} onChange={setNote} placeholder="Vos échanges, vos conditions proposées, les points encore à confirmer…" />
        <AutosaveStatus save={noteSave}/><NoteHistory jobId={job.id}/>
      </WorkspaceFormSection>
    </div> : null}
    {activeView==="interviews"&&job.status==="rejected"?<ApplicationLessonCard key={`lesson-interviews:${job.id}`} job={job}/>:null}
    {activeView === "interviews" ? <InterviewManager job={job} onChange={onChange} /> : null}
    {activeView === "brief" ? <PrivateBrief key={job.id} jobId={job.id} onOpenCarnet={onOpenCarnet} /> : null}
  </div>;
}
function AlignedOfferFacts({ job }: { job: JobRecord }) {
  const level = detectLevel(job.title, job.description ?? "");
  const hasDailyRate = job.dailyRate != null || job.dailyRateMin != null || job.dailyRateMax != null;
  const pay = hasDailyRate
    ? formatPayRangeShort(job.dailyRateMin ?? job.dailyRate, job.dailyRateMax ?? job.dailyRate, "daily")
      ?? formatPay(job.dailyRateMin, job.dailyRateMax, job.dailyRate, "HT/jour")
    : formatPayRangeShort(job.salaryMin ?? job.annualSalary, job.salaryMax ?? job.annualSalary, "annual")
      ?? formatPay(job.salaryMin, job.salaryMax, job.annualSalary, "brut/an");
  const presence = { full_remote: "Full remote", exceptional: "Présence ponctuelle", hybrid: "Hybride", onsite: "Sur site", unknown: undefined };
  const contracts = { cdi: "CDI", cdd: "CDD", freelance: "Freelance", portage: "Portage salarial", part_time: "Temps partagé", other: undefined, unknown: undefined };

  return <dl className="aligned-offer-facts" aria-label="Informations clés de l’offre">
    <ConditionRow label="Rémunération" value={pay} />
    <ConditionRow label="Présence" value={presence[job.remoteMode]} />
    <ConditionRow label="Contrat" value={contracts[job.contractType]} />
    <ConditionRow label="Niveau" value={level ? levelLabels[level.level] : undefined} />
  </dl>;
}

function AlignedOfferRead({ job }: { job: JobRecord }) {
  const mystery = isMysteryOffer(job);
  const url = job.sourceUrl || job.applicationUrl;
  const description = job.description?.trim();
  const incomplete = !description || (job.missing ? job.missing.includes("description complète") : job.contentCoverage === "partial" || job.contentCoverage === "summary");
  const descriptionId = useId();
  const descriptionRef = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflow, setOverflow] = useState(false);

  useLayoutEffect(() => {
    const paragraph = descriptionRef.current;
    if (!paragraph || expanded) return;
    const measure = () => setOverflow(paragraph.scrollHeight > paragraph.clientHeight + 1);
    const observer = new ResizeObserver(measure);
    measure();
    observer.observe(paragraph);
    return () => observer.disconnect();
  }, [description, expanded]);

  return <div className="aligned-offer-read">
    {!mystery?<section className="aligned-offer-reasons"><h3>Pourquoi elle remonte</h3><ul className="aligned-offer-positives" data-fit-scored={!!visibleFit(job)}>{job.reasons.slice(0,4).map((reason,i)=><li key={i}><CheckCircle2 size={16} aria-hidden/>{reason}</li>)}</ul>{job.flags.length?<ul className="aligned-offer-warnings" aria-label="Points à vérifier">{job.flags.map((flag,i)=><li key={i}><CircleHelp size={16} aria-hidden/>{flag}</li>)}</ul>:null}</section>:null}
    <section className="aligned-offer-description">
      <div className="aligned-offer-description-heading">
        <h3>L’annonce</h3>
        {url ? <a className="signal-quiet-button" href={url} target="_blank" rel="noopener noreferrer" aria-label="Ouvrir l’annonce dans un nouvel onglet">Ouvrir<ExternalLink size={14} aria-hidden /></a> : null}
      </div>
      {mystery ? <p className="offer-mystery aligned-offer-mystery"><strong>Fiche mystère</strong> · Complétez-la pour révéler son adéquation.</p>
        : incomplete ? <span className="workspace-badge is-warning">Description à compléter</span> : null}
      {description ? <p id={descriptionId} ref={descriptionRef} className="offer-description-read aligned-offer-description-text" data-expanded={expanded}>{description}</p> : null}
      {description && (overflow || expanded) ? <WorkspaceButton variant="quiet" aria-expanded={expanded} aria-controls={descriptionId} onClick={() => setExpanded(value => !value)}>
        {expanded ? "Lire moins" : "Lire plus"}{expanded ? <ChevronUp size={14} aria-hidden /> : <ChevronDown size={14} aria-hidden />}
      </WorkspaceButton> : null}
    </section>
  </div>;
}

function AlignedOfferConditions({ job }: { job: JobRecord }) {
  const presence = [
    job.onsiteDaysPerWeek != null ? `${job.onsiteDaysPerWeek} j/semaine` : "",
    job.onsiteDaysPerMonth != null ? `${job.onsiteDaysPerMonth} j/mois` : "",
    job.onsiteCadence,
  ].filter(Boolean).join(" · ");
  const language = { fr: "Français", en: "Anglais", professional_en: "Anglais professionnel", advanced_en: "Anglais avancé", unknown: undefined };

  return <dl className="review-criteria-grid aligned-offer-conditions">
    <ConditionRow label="Lieu annoncé" value={job.announcedLocation || undefined} />
    <ConditionRow label="Présence sur site" value={presence || (job.remoteMode === "full_remote" ? "Full remote" : undefined)} />
    <ConditionRow label="Pays autorisé" value={job.remoteCountry ? countryLabel(job.remoteCountry) : undefined} />
    <ConditionRow label="Langue" value={language[job.language]} />
    <ConditionRow label="Publication" value={job.publishedAt ? formatDate(job.publishedAt) : undefined} />
    <ConditionRow label="Ajout au Radar" value={formatDate(job.createdAt)} />
    {job.notificationAt ? <ConditionRow label="Notification source" value={formatDate(job.notificationAt)} /> : null}
  </dl>;
}
function visibleFit({ fit, fitLabel }: Pick<JobRecord, "fit" | "fitLabel">) {
  return fit != null && fitLabel ? { score: fit, label: fitLabel } : null;
}

export function OfferFitCard({ job }: { job: JobRecord }) {
  if (isMysteryOffer(job)) return null;
  const fit = visibleFit(job);
  return <div className="aligned-offer-fit" data-fit={fit?.label}>
    {fit ? <strong aria-hidden>{fit.score}<small> / 100</small></strong> : null}
    <FitBadge job={job} />
    {fit && job.confidence === "high" ? <span>Confiance élevée</span> : null}
  </div>;
}
type BriefResponse = { brief: string; factCount: number; summary: ReturnType<typeof briefSummary> };

function PromptSummary({ factCount, summary, onOpenCarnet }: Pick<BriefResponse, "factCount" | "summary"> & { onOpenCarnet: () => void }) {
  const { offer, experiences, questionCount } = summary;
  const { visible, moreLabel } = briefExperiencePreview(experiences);
  return <div className="signal-prompt-summary">
    <div>
      <h4>Ce que ChatGPT va préparer</h4>
      <ul className="signal-prompt-deliverables">
        <li>Les ajustements du CV, fondés sur vos expériences</li>
        <li>Un message court</li>
        <li>Les réponses aux questions du recruteur, dans leur limite de caractères</li>
        <li>Une checklist de validation avant envoi</li>
      </ul>
    </div>
    <div>
      <h4>Sur quoi il s’appuie</h4>
      <dl>
        <dt>Offre</dt><dd>{offer.title} chez {offer.company || "une entreprise à confirmer"}</dd>
        <dt>Expériences</dt>
        <dd>{factCount === 0 ? <div className="signal-prompt-warning">
          <p role="alert"><CircleAlert size={16} aria-hidden />Aucune expérience autorisée pour les candidatures : le prompt ne pourra pas s’appuyer sur votre parcours.</p>
          <a href="?tab=radar&amp;section=carnet" className="signal-quiet-button" onClick={event => {
            if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            onOpenCarnet();
          }}>Ouvrir mon carnet</a>
        </div> : visible.length ? <ul className="signal-prompt-experiences">
          {visible.map(({ title, company, period }, index) => <li key={index}>{[title, company, period].filter(Boolean).join(" · ")}</li>)}
          {moreLabel ? <li className="signal-help">{moreLabel}</li> : null}
        </ul> : "Faits autorisés sans expérience associée"}</dd>
        <dt>Questions</dt><dd>{questionCount ? `${questionCount} question${questionCount > 1 ? "s" : ""} du recruteur` : "Aucune question enregistrée"}</dd>
      </dl>
    </div>
  </div>;
}

function PrivateBrief({ jobId, onOpenCarnet }: { jobId: string; onOpenCarnet: () => void }) {
  const notify=useWorkspaceFeedback();
  const [result, setResult] = useState<BriefResponse | null>(null);
  const [language, setLanguage] = useState<"fr" | "en">("fr");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const brief = result?.brief ?? "";
  useEffect(() => {
    let active = true;
    setResult(null); setError(""); setCopied(false); setLoading(true);
    fetch("/api/brief", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jobId, language }), signal: AbortSignal.timeout(15000) })
      .then(async response => {
        const data = await response.json() as BriefResponse & { error?: string };
        if (!response.ok) throw new Error(data.error ?? "Prompt indisponible.");
        if (active) setResult(data);
      })
      .catch(problem => { if (active) setError(requestError(problem, "Prompt indisponible.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [jobId, language, refresh]);
  async function copyPrompt(){try{await navigator.clipboard.writeText(brief);setCopied(true);notify({message:"Prompt copié. Collez-le dans ChatGPT."});}catch{setError("Copie impossible : sélectionnez le texte.");notify({message:"Copie impossible : sélectionnez le texte.",tone:"error"});}}
  return <div className="signal-brief">
    <section className="signal-prompt-section" aria-label="Prompt ChatGPT">
      <h3>Prompt ChatGPT</h3>
      {!loading && result ? <PromptSummary factCount={result.factCount} summary={result.summary} onOpenCarnet={onOpenCarnet} /> : null}
      <div className="signal-prompt-actions">
        <div className="signal-brief-language"><ChoiceSelect label="Langue des réponses" value={language} onChange={setLanguage} options={[{value:"fr",label:"Français"},{value:"en",label:"Anglais professionnel simple"}]}/></div>
        <WorkspaceButton variant="primary" disabled={loading||!brief} onClick={()=>void copyPrompt()}><Copy size={14} aria-hidden/>{copied?"Prompt copié":"Copier le prompt"}</WorkspaceButton>
      </div>
      {loading?<p className="signal-help" role="status">Chargement du prompt…</p>:null}<WorkspaceFormError message={error}/>{error?<WorkspaceButton onClick={()=>setRefresh(value=>value+1)}>Réessayer</WorkspaceButton>:null}
      {!loading&&brief?<details className="signal-prompt-preview"><summary>Voir le texte complet</summary><pre>{brief}</pre></details>:null}
      {!loading&&!brief&&!error?<p className="signal-help">Aucun prompt disponible pour cette offre.</p>:null}
    </section>
    <ApplicationQuestions jobId={jobId} onSaved={()=>setRefresh(value=>value+1)}/>
  </div>;
}

export function FitBadge({ job }: { job: Pick<JobRecord, "fit" | "fitLabel" | "confidence" | "conditions" | "fitParts" | "deletedAt"> }) {
  if (isMysteryOffer(job)) return <span className="workspace-badge offer-fit-badge" data-fit="mystery" title="Bon poste, fiche trop courte : complétez-la pour révéler son adéquation.">Fiche mystère</span>;
  const fit = visibleFit(job);
  if (fit) {
    const label = fitLabels[fit.label];
    return <span className="workspace-badge offer-fit-badge is-scored" data-fit={fit.label} role="group" aria-label={`Adéquation ${fit.score} sur 100, ${label.toLocaleLowerCase("fr")}`}>
      <span aria-hidden="true"><b>{fit.score}</b> · {label}</span>
    </span>;
  }
  return <span className="workspace-badge offer-fit-badge" data-fit="incomplete" title="Complétez la fiche pour voir son adéquation.">Fiche incomplète</span>;
}

function FitSummary({ job }: { job: JobRecord }) {
  if (job.fit === undefined) return null;
  const missing = job.missing ?? [];
  return <p className="offer-fit"><FitBadge job={job} />
    {missing.length ? <span className="offer-fit-detail">{job.fitLabel ? "Inconnu" : "À compléter"} : {missing.join(", ")}</span> : <span className="offer-fit-detail">Fiche complète</span>}
  </p>;
}

function Signals({ title, items, tone }: { title: string; items: string[]; tone: "positive" | "caution" }) {
  const Icon = tone === "positive" ? CheckCircle2 : CircleHelp;
  return <section className={`offer-signal offer-signal--${tone}`}><h3 className="offer-section-title"><Icon size={17} aria-hidden="true" />{title}</h3><ul>{items.length ? items.map(item => <li key={item}>{item}</li>) : <li>Aucun signal confirmé à ce stade.</li>}</ul></section>;
}

function OfferEditor({ job, onSaved, onCancel, actionBar }: { job: JobRecord; actionBar?: HTMLElement|null; onSaved: (job: JobRecord) => void; onCancel: () => void }) {
  return <OfferForm draftKey={`offer:${job.id}`} actionBar={actionBar} job={job} onCancel={onCancel} onSave={async input=>{const {source,...facts}=input;onSaved(await requestJob(`/api/jobs/${job.id}`,"PUT",sourceNames.includes(source)?input:facts));}}/>;
}

function InterviewManager({ job, onChange }: { job: JobRecord; onChange: (job: JobRecord, message?:string) => void }) {
  const notify=useWorkspaceFeedback();
  const writeLock=useRef(false);
  const [editor, setEditor] = useState<InterviewRecord | "new" | null>(null); const [review, setReview] = useState<InterviewRecord | null>(null); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now()); useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(timer); }, []);
  async function cancel(event: InterviewRecord) { if(writeLock.current)return;writeLock.current=true;setBusy(true); setError(""); try { onChange(await requestJob(`/api/interviews/${event.id}`, "PATCH", { action: "cancel" }),"Entretien annulé."); } catch { setError("Annulation non enregistrée."); notify({message:"L’entretien n’a pas été annulé.",tone:"error"}); } finally { writeLock.current=false;setBusy(false); } }
  if (editor) return <InterviewEditor jobId={job.id} interview={editor === "new" ? undefined : editor} onSaved={updated => { onChange(updated,editor==="new"?"Entretien enregistré.":"Rendez-vous mis à jour."); setEditor(null); }} onCancel={() => setEditor(null)} />;
  if (review) return <InterviewReview interview={review} onSaved={updated => { onChange(updated,"Bilan enregistré et statut mis à jour."); setReview(null); }} onCancel={() => setReview(null)} />;
  return <WorkspaceFormSection className="signal-interviews" title="Votre parcours d’entretien" description="Planifiez vos rendez-vous et conservez un bilan après chaque échange." actions={<WorkspaceButton variant="primary" disabled={busy} onClick={()=>setEditor("new")}><CalendarPlus size={15} aria-hidden/>Ajouter un entretien</WorkspaceButton>}>
    {!job.interviews?.length?<div className="signal-empty"><CalendarDays size={22} aria-hidden/><p>Aucun entretien enregistré.</p><p className="signal-help">S’il a déjà eu lieu, renseignez sa date passée puis complétez le bilan.</p></div>:null}
    <div className="signal-interview-list">{(job.interviews??[]).map(event=><section key={event.id} className="signal-interview-card" aria-label={event.label}>
      <div className="signal-section-heading"><h4>{event.label}</h4><span className={`signal-state-badge is-${event.state==='cancelled'?'neutral':event.state==='reviewed'?'complete':reviewDue(event,now)?'warning':'neutral'}`}>{event.state==='cancelled'?'Annulé':event.state==='reviewed'?'Bilan enregistré':reviewDue(event,now)?'Bilan à faire':'Prévu'}</span></div>
      <p className="signal-event-meta"><CalendarDays size={14} aria-hidden/>{formatDate(event.startAt,event.timeZone,true)} · {event.timeZone} · {Math.round((Date.parse(event.endAt)-Date.parse(event.startAt))/60000)} min · {{video:'Visio',phone:'Téléphone',onsite:'Sur site',other:'Autre'}[event.format]}</p>
      {event.state==='reviewed'?<div className="signal-saved-summary"><div><span className="signal-detail-label">Suite choisie</span><p>{{waiting:'En attente de retour',next_step:'Prochaine étape',rejected:'Refus',withdrawn:'Retirée',offer:'Proposition reçue'}[event.outcome??'waiting']}</p></div><div><span className="signal-detail-label">À retenir</span><NoteText value={event.summary||'Aucune note renseignée.'}/></div>{event.strengths||event.weaknesses?<div className="signal-two-columns">{event.strengths?<div><span className="signal-detail-label">Ce qui s’est bien passé</span><NoteText value={event.strengths}/></div>:null}{event.weaknesses?<div><span className="signal-detail-label">À travailler</span><NoteText value={event.weaknesses}/></div>:null}</div>:null}{event.nextAction?<div><span className="signal-detail-label">Prochaine action</span><p>{event.nextAction}</p></div>:null}{event.followUpAt?<p className="signal-help">Relance envisagée : {formatDate(event.followUpAt,event.timeZone,true)}</p>:null}</div>:null}
      <div className="signal-card-actions">{event.state!=='cancelled'&&(reviewDue(event,now)||event.state==='reviewed')?<WorkspaceButton variant={event.state==='reviewed'?'secondary':'primary'} disabled={busy} onClick={()=>setReview(event)}><Pencil size={14} aria-hidden/>{event.state==='reviewed'?'Modifier le bilan':'Faire le bilan'}</WorkspaceButton>:null}{event.state==='planned'?<><WorkspaceButton disabled={busy} onClick={()=>setEditor(event)}>Modifier la date</WorkspaceButton><WorkspaceButton className="signal-cancel-interview" variant="quiet" busy={busy} onClick={()=>void cancel(event)}>Annuler l’entretien</WorkspaceButton></>:null}</div>
    </section>)}</div>
    <p className="signal-help">Le bilan sera proposé après l’entretien.</p><WorkspaceFormError message={error}/>
  </WorkspaceFormSection>;
}
function InterviewEditor({ jobId, interview, onSaved, onCancel }: { jobId: string; interview?: InterviewRecord; onSaved: (job: JobRecord) => void; onCancel: () => void }) {
  const editorTitle=useWorkspaceEditorFocus();
  const notify=useWorkspaceFeedback();
  const writeLock=useRef(false);
  const [requestId] = useState(() => crypto.randomUUID());
  const draft=useSavedForm(`schedule:${interview?.id??jobId}`,{requestId,label:interview?.label??"Entretien",zone:interview?.timeZone??"Europe/Paris",start:interview?zonedInput(interview.startAt,interview.timeZone):"",duration:interview?Math.round((Date.parse(interview.endAt)-Date.parse(interview.startAt))/60000):60,format:interview?.format??"video",interviewId:interview?.id??""});
  const recovered=draft.value.interviewId===(interview?.id??"");
  const {label,zone,start,duration,format}=recovered?draft.value:{label:interview?.label??"Entretien",zone:interview?.timeZone??"Europe/Paris",start:interview?zonedInput(interview.startAt,interview.timeZone):"",duration:60,format:interview?.format??"video"};
  const change=<K extends keyof typeof draft.value>(key:K,value:typeof draft.value[K])=>draft.setValue(current=>({...current,...(!recovered?{requestId,label,zone,start,duration,format,interviewId:interview?.id??""}:{}),[key]:value}));
  const setLabel=(value:string)=>change("label",value),setZone=(value:string)=>change("zone",value),setStart=(value:string)=>change("start",value),setDuration=(value:number)=>change("duration",value),setFormat=(value:typeof format)=>change("format",value);
  const [busy,setBusy]=useState(false),[error,setError]=useState("");
  async function save() { if(writeLock.current)return;writeLock.current=true;setBusy(true); setError(""); try { const startAt = fromZonedInput(start, zone); const fields = { label, startAt, endAt: new Date(Date.parse(startAt) + duration * 60000).toISOString(), timeZone: zone, format }; const updated=await requestJob(interview ? `/api/interviews/${interview.id}` : "/api/interviews", interview ? "PATCH" : "POST", interview ? { action: "schedule", ...fields } : { id: draft.value.requestId, jobId, ...fields }); draft.save.document.confirmedElsewhere("");onSaved(updated); } catch (problem) { const message=requestError(problem, "Enregistrement non confirmé.");setError(message);notify({message,tone:"error"}); } finally { writeLock.current=false;setBusy(false); } }
  return <div className="signal-form-editor">
    <AutosaveStatus save={draft.save} draft/>
    <div className="signal-section-heading"><div><h3 ref={editorTitle} tabIndex={-1}>{interview ? "Modifier le rendez-vous" : "Planifier ou dater un entretien"}</h3><p className="signal-help">La date et l’heure sont celles du fuseau choisi.</p></div></div>
    <Field label="Étape / interlocuteur"><input disabled={busy||!draft.ready} value={label} maxLength={180} onChange={event => setLabel(event.target.value)} placeholder="Ex. Atlas · exemple fictif · entretien métier" /></Field>
    <div className="grid gap-4 sm:grid-cols-2">
      <DateTimePicker disabled={busy||!draft.ready} label="Date de l’entretien" value={start} onChange={setStart} />
      <ChoiceSelect disabled={busy||!draft.ready} label="Fuseau horaire du rendez-vous" value={zone} onChange={setZone} options={[{value:"Europe/Paris",label:"Paris"},{value:"Indian/Mauritius",label:"Maurice"},{value:"UTC",label:"UTC"}]} />
      <Field label="Durée estimée (minutes)"><input disabled={busy||!draft.ready} type="number" min={1} max={480} value={duration} onChange={event => setDuration(Number(event.target.value))} /></Field>
      <ChoiceSelect disabled={busy||!draft.ready} label="Format" value={format} onChange={setFormat} options={[{value:"video",label:"Visio"},{value:"phone",label:"Téléphone"},{value:"onsite",label:"Sur site"},{value:"other",label:"Autre"}]} />
    </div>
    <div className="inline-help"><span>Rappel après l’entretien</span></div>
    <WorkspaceFormError message={error}/>
    <WorkspaceSaveActions cancelLabel="Retour" label="Enregistrer l’entretien" busy={busy} disabled={!draft.ready||!start||!label.trim()||!Number.isFinite(duration)||duration<1||duration>480} hint="Aucun événement créé dans un calendrier externe." onSave={()=>void save()} onCancel={onCancel} sticky/>
  </div>;
}
function InterviewReview({ interview, onSaved, onCancel }: { interview: InterviewRecord; onSaved: (job: JobRecord) => void; onCancel: () => void }) {
  const editorTitle=useWorkspaceEditorFocus();
  const notify=useWorkspaceFeedback();
  const writeLock=useRef(false);
  const draft=useSavedForm(`review:${interview.id}`,{outcome:interview.outcome??"waiting",summary:interview.summary??"",strengths:interview.strengths??"",weaknesses:interview.weaknesses??"",nextAction:interview.nextAction??"",followUp:interview.followUpAt?zonedInput(interview.followUpAt,interview.timeZone):""});
  const {outcome,summary,strengths,weaknesses,nextAction,followUp}=draft.value;
  const change=<K extends keyof typeof draft.value>(key:K,value:typeof draft.value[K])=>draft.setValue(current=>({...current,[key]:value}));
  const setOutcome=(value:typeof outcome)=>change("outcome",value),setSummary=(value:string)=>change("summary",value),setStrengths=(value:string)=>change("strengths",value),setWeaknesses=(value:string)=>change("weaknesses",value),setNextAction=(value:string)=>change("nextAction",value),setFollowUp=(value:string)=>change("followUp",value);
  const [busy,setBusy]=useState(false),[error,setError]=useState("");
  async function save() { if(writeLock.current)return;writeLock.current=true;setBusy(true); setError(""); try { const updated=await requestJob(`/api/interviews/${interview.id}`, "PATCH", { action: "review", outcome, summary, strengths, weaknesses, nextAction, followUpAt: followUp ? fromZonedInput(followUp, interview.timeZone) : "" });draft.save.document.confirmedElsewhere("");onSaved(updated);if(outcome==="rejected"||outcome==="withdrawn")cancelEncouragement();const saved=updated.interviews?.find(event=>event.id===interview.id);if(saved?.updatedAt&&outcome!=="rejected"&&[summary,strengths,weaknesses].some(value=>value.trim())&&(interview.state!=="reviewed"||![interview.summary,interview.strengths,interview.weaknesses].some(value=>value?.trim())))confirmedProgress({kind:"interview_review",objectId:interview.id,stamp:saved.updatedAt}); } catch (problem) { const message=requestError(problem, "Enregistrement non confirmé.");setError(message);notify({message,tone:"error"}); } finally { writeLock.current=false;setBusy(false); } }
  return <div className="signal-form-editor signal-interview-review">
    <AutosaveStatus save={draft.save} draft/>
    <div className="signal-section-heading"><div><h3 ref={editorTitle} tabIndex={-1}>Bilan d’entretien</h3><p className="signal-help">{interview.label} · {formatDate(interview.startAt,interview.timeZone,true)} · Bilan privé</p></div></div>
    <div className="signal-note-field"><h4 className="signal-field-title">Ce qui a été dit / à retenir</h4><NoteEditor disabled={busy||!draft.ready} label="Ce qui a été dit / à retenir" rows={4} maxLength={5000} value={summary} onChange={setSummary} placeholder="Les sujets abordés, les attentes et les informations à retenir…"/></div>
    <div className="signal-two-columns"><div className="signal-note-field"><h4 className="signal-field-title">Ce qui s’est bien passé</h4><NoteEditor disabled={busy||!draft.ready} label="Ce qui s’est bien passé" rows={3} maxLength={3000} value={strengths} onChange={setStrengths} placeholder="Les échanges réussis et vos points forts…"/></div><div className="signal-note-field"><h4 className="signal-field-title">Ce qui a été moins bien / à travailler</h4><NoteEditor disabled={busy||!draft.ready} label="Ce qui a été moins bien / à travailler" rows={3} maxLength={3000} value={weaknesses} onChange={setWeaknesses} placeholder="Les points à clarifier ou à préparer pour la suite…"/></div></div>
    <section className="signal-follow-up" aria-label="Suite de candidature"><h4>Suite de candidature</h4><div className="signal-two-columns"><ChoiceSelect disabled={busy||!draft.ready} label="Quelle est la suite ?" value={outcome} onChange={setOutcome} options={[{value:"waiting",label:"En attente de retour"},{value:"next_step",label:"Prochaine étape"},{value:"rejected",label:"Refus"},{value:"withdrawn",label:"Je ne souhaite pas poursuivre"},{value:"offer",label:"Proposition reçue"}]}/><DateTimePicker disabled={busy||!draft.ready} label={`Relance (${interview.timeZone})`} value={followUp} onChange={setFollowUp}/></div><Field label="Prochaine action"><input disabled={busy||!draft.ready} maxLength={2000} value={nextAction} onChange={event=>setNextAction(event.target.value)} placeholder="Ex. attendre le retour, préparer un cas pratique…"/></Field><p className="signal-help">Le texte se sauvegarde automatiquement. Terminer le bilan confirme aussi la suite de candidature. Aucune relance au recruteur n’est envoyée automatiquement.</p></section>
    <WorkspaceFormError message={error}/>
    <WorkspaceSaveActions cancelLabel="Retour" label="Terminer le bilan" disabled={!draft.ready||summary.length>5000||strengths.length>3000||weaknesses.length>3000||nextAction.length>2000} busy={busy} hint="Texte enregistré automatiquement · confirmez la suite pour terminer le bilan." onSave={()=>void save()} onCancel={onCancel} sticky/>
  </div>;
}
