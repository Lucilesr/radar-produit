"use client";

import { AutosaveStatus, NoteHistory, useAutosave, useSavedForm } from "@/components/autosave";
import { sourceNames } from "@/lib/source-catalog";
import { OfferForm } from "@/components/offer-form";
import { countryLabel } from "@/lib/countries";
import { DateTimePicker } from "@/components/date-picker";
import { HelpTooltip } from "@/components/help-tooltip";
import { useWorkspaceFeedback } from "@/components/workspace-feedback";
import { NoteEditor, NoteText } from "@/components/note-editor";
import { WorkspaceButton, WorkspaceFormError, WorkspaceFormSection, WorkspaceSaveActions, useWorkspaceEditorFocus } from "@/components/workspace-form";
import { useEffect, useRef, useState } from "react";
import { CalendarDays, CalendarPlus, CheckCircle2, CircleHelp, Copy, ExternalLink, LoaderCircle, Pencil } from "lucide-react";
import { ChoiceSelect, type ChoiceOption } from "@/components/choice-select";
import { SourceLogo } from "@/components/source-logo";
import { ApplicationQuestions } from "@/components/application-questions";
import { formatDate, fromZonedInput, reviewDue, statusLabels, zonedInput } from "@/lib/application-workflow";
import { formatEuro } from "@/lib/matching";
import { hasApplication, workspaceSections } from "@/lib/opportunity-views";
import type { CandidateProfile, InterviewRecord, JobRecord, JobStatus } from "@/lib/types";

export type WorkspaceView = "offer" | "application" | "interviews" | "brief";
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
  const response = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) });
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
function ConditionRow({label,value}:{label:string;value:string}){return <div className="review-condition-row"><dt>{label}</dt><dd>{value}</dd></div>;}

export function ApplicationTrackingAction({job,onStatus,onOpenApplication}:{job:JobRecord;onStatus:(id:string,status:JobStatus)=>Promise<boolean>;onOpenApplication:()=>void}){
  const [starting,setStarting]=useState(false);
  return <button type="button" className="secondary-button reading-application-action" disabled={starting} aria-busy={starting} onClick={async()=>{if(hasApplication(job)){onOpenApplication();return;}setStarting(true);try{await onStatus(job.id,"applied");}finally{setStarting(false);}}}>{starting?<LoaderCircle size={14} className="animate-spin" aria-hidden/>:null}{hasApplication(job)?"Voir dans Candidatures":"J’ai postulé"}</button>;
}

export function OfferWorkspace({ job, profile, initialView, context, onChange, onStatus, onNote, onOpenApplication, onViewChange, showApplicationAction = true, showAnnouncement = true }: {
  showApplicationAction?: boolean;
  showAnnouncement?: boolean;
  onViewChange?: (view: WorkspaceView) => void;
  job: JobRecord; profile: CandidateProfile; initialView: WorkspaceView; context: "opportunity" | "application"; onChange: (job: JobRecord, message?: string) => void;
  onStatus: (id: string, status: JobStatus) => Promise<boolean>; onNote: (id: string, note: string) => Promise<boolean>; onOpenApplication: () => void;
}) {
  const editTrigger=useRef<HTMLButtonElement>(null);
  const finishEditing=()=>{setEditing(false);requestAnimationFrame(()=>{editTrigger.current?.focus({preventScroll:true});editTrigger.current?.scrollIntoView({block:"nearest"});});};
  const [view, updateView] = useState<WorkspaceView>(initialView);
  const setView = (next: WorkspaceView) => { updateView(next); onViewChange?.(next); };
  useEffect(()=>updateView(initialView),[initialView]); const [editing, setEditing] = useState(false);
  const noteSave=useAutosave(`note:${job.id}`,job.candidateNote??"",2000);
  const note=noteSave.value,setNote=noteSave.setValue;
  const [statusBusy,setStatusBusy] = useState(false);
  const noteEditorRef = useRef<HTMLDivElement>(null);
  const coverage = coverageLabel(job);
  const sourceUrl = job.sourceUrl;
  const applyUrl = job.applicationUrl && job.applicationUrl !== sourceUrl ? job.applicationUrl : !sourceUrl ? job.applicationUrl : undefined;
  const labels: Record<WorkspaceView, string> = { offer: "L’offre", application: "Ma candidature", interviews: `Entretiens (${job.interviews?.length ?? 0})`, brief: "Préparer / brief" };
  const tabs = workspaceSections(context);
  const activeView = context === "opportunity" && (view === "application" || view === "interviews") ? "offer" : view;
  useEffect(() => { if (activeView !== "application" || job.status !== "offer") return; const frame = requestAnimationFrame(() => { noteEditorRef.current?.focus({preventScroll:true}); noteEditorRef.current?.scrollIntoView({block:"center"}); }); return () => cancelAnimationFrame(frame); }, [activeView,job.id,job.status]);
  return <div className="signal-offer-workspace space-y-5">
    {showAnnouncement ? <div className="signal-external-link">{sourceUrl || applyUrl ? <a href={sourceUrl || applyUrl} target="_blank" rel="noopener noreferrer" className="secondary-button"><ExternalLink size={14} aria-hidden />Voir l’annonce</a> : <span className="offer-link-missing">Lien de l’annonce à renseigner</span>}</div> : null}
    <div className={context === "opportunity" ? "signal-offer-nav" : "signal-application-nav"}>
      <nav aria-label={context === "opportunity" ? "Sections de l’opportunité" : "Sections de la candidature"} className="signal-workspace-tabs">{tabs.map(id => <button type="button" key={id} onClick={() => setView(id)} aria-current={activeView === id ? "page" : undefined}>{labels[id]}</button>)}</nav>
      {context === "opportunity" && !job.deletedAt && showApplicationAction ? <ApplicationTrackingAction job={job} onStatus={onStatus} onOpenApplication={onOpenApplication} /> : null}
    </div>
    {activeView === "offer" && !editing ? <>
      <section aria-label="Informations clés de l’offre" className="review-conditions">
        <h3>Conditions de l’offre</h3>
        <dl className="review-criteria-grid">
          <ConditionRow label="Contrat" value={job.contractType === "cdi" ? "CDI" : job.contractType === "cdd" ? "CDD" : job.contractType === "freelance" ? "Freelance" : "À confirmer"}/>
          <ConditionRow label="Rémunération" value={job.dailyRate ? `${formatEuro(job.dailyRate)} HT/jour` : job.annualSalary ? `${formatEuro(job.annualSalary)} brut/an` : "Non communiquée"}/>
          <ConditionRow label="Mode de travail" value={{ full_remote: "Full remote", exceptional: "Présence exceptionnelle", hybrid: "Hybride", onsite: "Sur site", unknown: "À confirmer" }[job.remoteMode]}/>
          <ConditionRow label="Présence sur site" value={[job.onsiteDaysPerWeek!=null?`${job.onsiteDaysPerWeek} j/semaine sur site`:"",job.onsiteDaysPerMonth!=null?`${job.onsiteDaysPerMonth} j/mois sur site`:"",job.onsiteCadence].filter(Boolean).join(" · ")||"À confirmer"}/>
          <ConditionRow label="Pays autorisé en télétravail" value={countryLabel(job.remoteCountry)}/>
          <ConditionRow label="Langue" value={{fr:"Français",en:"Anglais",professional_en:"Anglais professionnel",advanced_en:"Anglais avancé",unknown:"À confirmer"}[job.language]}/>
        </dl>

      </section>
      <div className="grid gap-3 sm:grid-cols-2"><Signals title="Pourquoi c’est pertinent" items={job.reasons} tone="positive" /><Signals title="Points à vérifier" items={job.flags} tone="caution" /></div>
      <section className="reading-description"><div className="reading-description-heading"><div><h3 className="offer-section-title">Description, missions et exigences</h3><p className="review-coverage">{coverage}</p></div>{!job.deletedAt ? <button ref={editTrigger} onClick={() => setEditing(true)} className="secondary-button"><Pencil size={13} /> Compléter / corriger</button> : null}</div><p className="offer-description-read">{job.description || "Aucune description fournie. Ajoutez le contenu de l’annonce ou d’une alerte autorisée."}</p>{coverage !== "Description complète fournie" ? <p className="mt-2 text-xs leading-5 text-muted-foreground">{coverage} : les informations absentes restent à confirmer.{!job.deletedAt ? " Vous pouvez coller une description complète ici, sans recréer une fiche." : " Restaurez l’offre pour compléter sa description."}</p> : null}</section>
      <section className="review-offer-dates" aria-label="Dates de l’offre">
        <h3 className="review-dates-heading">Dates de l’offre</h3>
        <dl className="review-dates"><ConditionRow label="Publication" value={formatDate(job.publishedAt)}/><ConditionRow label="Ajout au Radar" value={formatDate(job.createdAt)}/>{job.notificationAt?<ConditionRow label="Notification source" value={formatDate(job.notificationAt)}/>:null}</dl>
      {!job.publishedAt ? <div className="inline-help"><span>Date de publication non précisée</span><HelpTooltip label="Date de publication">La date d’import ou de notification ne remplace pas la date réelle de publication.</HelpTooltip></div> : null}
      </section>
    </> : null}
    {activeView === "offer" && editing ? <OfferEditor job={job} onSaved={updated => { onChange(updated); finishEditing(); }} onCancel={finishEditing} /> : null}
    {context === "application" && activeView === "application" ? <div className="signal-application-form">
      <WorkspaceFormSection title="Suivi de candidature" actions={<WorkspaceButton disabled={statusBusy} onClick={() => setView("interviews")}><CalendarDays size={15} aria-hidden />Voir les entretiens</WorkspaceButton>}>
        <div className="signal-status-field" aria-busy={statusBusy}><StatusSelect value={job.status} disabled={statusBusy} onChange={async status => { setStatusBusy(true); try { await onStatus(job.id, status); } finally { setStatusBusy(false); } }} /></div>
      </WorkspaceFormSection>
      <WorkspaceFormSection title="Notes privées de candidature">
        <NoteEditor inputRef={noteEditorRef} label="Notes privées de candidature" rows={4} disabled={!noteSave.ready} maxLength={2000} value={note} onChange={setNote} placeholder="Vos échanges, vos conditions proposées, les points encore à confirmer…" />
        <AutosaveStatus save={noteSave}/><NoteHistory jobId={job.id}/>
      </WorkspaceFormSection>
    </div> : null}
    {context === "application" && activeView === "interviews" ? <InterviewManager job={job} onChange={onChange} /> : null}
    {activeView === "brief" ? <PrivateBrief key={job.id} jobId={job.id} /> : null}
  </div>;
}
function PrivateBrief({ jobId }: { jobId: string }) {
  const notify=useWorkspaceFeedback();
  const [brief, setBrief] = useState("");
  const [language, setLanguage] = useState<"fr" | "en">("fr");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    setBrief(""); setError(""); setCopied(false); setLoading(true);
    fetch("/api/brief", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jobId, language }) })
      .then(async response => {
        const data = await response.json() as { error?: string; brief: string };
        if (!response.ok) throw new Error(data.error ?? "Prompt indisponible.");
        if (active) setBrief(data.brief);
      })
      .catch(problem => { if (active) setError(problem instanceof Error ? problem.message : "Prompt indisponible."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [jobId, language, refresh]);
  async function copyPrompt(){try{await navigator.clipboard.writeText(brief);setCopied(true);notify({message:"Prompt copié. Collez-le dans ChatGPT."});}catch{setError("Copie impossible : sélectionnez le texte.");notify({message:"Copie impossible : sélectionnez le texte.",tone:"error"});}}
  return <div className="signal-brief">
    <section className="signal-prompt-section" aria-label="Prompt ChatGPT"><div className="signal-prompt-heading"><div><div className="inline-help"><h3>Prompt ChatGPT</h3><HelpTooltip label="Contenu du prompt">Vos notes privées, entretiens, sources brutes et ancien profil ne sont pas inclus.</HelpTooltip></div><p className="signal-help">Annonce, parcours validé et questions. Copiez dans ChatGPT, puis collez la réponse ci-dessous.</p></div><div className="signal-prompt-actions"><div className="signal-brief-language"><ChoiceSelect label="Langue des réponses" value={language} onChange={value=>setLanguage(value as "fr"|"en")} options={[{value:"fr",label:"Français"},{value:"en",label:"Anglais professionnel simple"}]}/></div><WorkspaceButton variant="primary" disabled={loading||!brief} onClick={()=>void copyPrompt()}><Copy size={14} aria-hidden/>{copied?"Prompt copié":"Copier le prompt"}</WorkspaceButton></div></div>
      {loading?<p className="signal-help" role="status">Chargement du prompt…</p>:null}<WorkspaceFormError message={error}/>
      {!loading&&brief?<details className="signal-prompt-preview"><summary>Voir le contenu du prompt</summary><pre>{brief}</pre></details>:null}
      {!loading&&!brief&&!error?<p className="signal-help">Aucun prompt disponible pour cette offre.</p>:null}
    </section>
    <ApplicationQuestions jobId={jobId} onSaved={()=>setRefresh(value=>value+1)}/>
  </div>;
}

function Signals({ title, items, tone }: { title: string; items: string[]; tone: "positive" | "caution" }) {
  const Icon = tone === "positive" ? CheckCircle2 : CircleHelp;
  return <section className={`offer-signal offer-signal--${tone}`}><h3 className="offer-section-title"><Icon size={17} aria-hidden="true" />{title}</h3><ul>{items.length ? items.map(item => <li key={item}>{item}</li>) : <li>Aucun signal confirmé à ce stade.</li>}</ul></section>;
}

function OfferEditor({ job, onSaved, onCancel }: { job: JobRecord; onSaved: (job: JobRecord) => void; onCancel: () => void }) {
  return <OfferForm draftKey={`offer:${job.id}`} job={job} onCancel={onCancel} onSave={async input=>{const {source,...facts}=input;onSaved(await requestJob(`/api/jobs/${job.id}`,"PUT",sourceNames.includes(source)?input:facts));}}/>;
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
    <p className="signal-help">Le bilan est proposé dans Radar après l’entretien. Un rappel externe nécessite une automatisation configurée séparément.</p><WorkspaceFormError message={error}/>
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
  async function save() { if(writeLock.current)return;writeLock.current=true;setBusy(true); setError(""); try { const startAt = fromZonedInput(start, zone); const fields = { label, startAt, endAt: new Date(Date.parse(startAt) + duration * 60000).toISOString(), timeZone: zone, format }; const updated=await requestJob(interview ? `/api/interviews/${interview.id}` : "/api/interviews", interview ? "PATCH" : "POST", interview ? { action: "schedule", ...fields } : { id: draft.value.requestId, jobId, ...fields }); draft.save.document.confirmedElsewhere("");onSaved(updated); } catch (problem) { const message=problem instanceof Error ? problem.message : "Enregistrement non confirmé.";setError(message);notify({message,tone:"error"}); } finally { writeLock.current=false;setBusy(false); } }
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
    <div className="inline-help"><span>Rappel après l’entretien</span><HelpTooltip label="Rappel d’entretien">Le rappel intervient après l’heure de fin estimée. Aucun événement n’est créé dans un calendrier externe.</HelpTooltip></div>
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
  async function save() { if(writeLock.current)return;writeLock.current=true;setBusy(true); setError(""); try { const updated=await requestJob(`/api/interviews/${interview.id}`, "PATCH", { action: "review", outcome, summary, strengths, weaknesses, nextAction, followUpAt: followUp ? fromZonedInput(followUp, interview.timeZone) : "" });draft.save.document.confirmedElsewhere("");onSaved(updated); } catch (problem) { const message=problem instanceof Error ? problem.message : "Enregistrement non confirmé.";setError(message);notify({message,tone:"error"}); } finally { writeLock.current=false;setBusy(false); } }
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
