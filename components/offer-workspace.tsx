"use client";
import { useEffect, useState } from "react";
import { Banknote, BriefcaseBusiness, CalendarDays, CalendarPlus, Check, CheckCircle2, CircleHelp, Clock3, Copy, ExternalLink, Globe2, Languages, LoaderCircle, MapPin, Pencil, type LucideIcon } from "lucide-react";
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
  .map(([value, label]) => ({ value, label, group: statusGroup[value] }));
export function StatusSelect({ value, onChange, label = "Statut de candidature", disabled = false }: { value: JobStatus; onChange: (status: JobStatus) => void; label?: string; disabled?: boolean }) {
  return <ChoiceSelect disabled={disabled} label={label} value={value} onChange={onChange} options={legacyStatuses.includes(value) ? [{ value, label: statusLabels[value], group: "Statut actuel" }, ...statusOptions] : statusOptions} />;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-xs font-semibold text-[#535768]"><span className="mb-1.5 block">{label}</span>{children}</label>; }
async function requestJob(path: string, method: string, value: unknown) {
  const response = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) });
  const data = await response.json() as { job?: JobRecord; error?: string };
  if (!response.ok || !data.job) throw new Error(data.error ?? "Enregistrement non confirmé."); return data.job;
}
function coverageLabel(job: JobRecord) {
  return job.contentCoverage === "full" ? "Description complète fournie" : job.contentCoverage === "partial" || /fiche détaillée non incluse|ne contient pas la fiche|fiche détaillée.*confirmer/i.test(job.description ?? "") ? "Notification partielle" : job.contentCoverage === "summary" ? "Synthèse disponible" : "Détails à confirmer";
}
export function OfferSourceBadge({ job }: { job: JobRecord }) {
  return <span className="offer-source-badge source-credit"><SourceLogo name={job.source} compact /><span>{job.source}</span><span className="offer-source-separator" aria-hidden="true" /><span>{coverageLabel(job)}</span></span>;
}
export function OfferWorkspace({ job, profile, initialView, context, onChange, onStatus, onNote, onOpenApplication, onViewChange }: {
  onViewChange?: (view: WorkspaceView) => void;
  job: JobRecord; profile: CandidateProfile; initialView: WorkspaceView; context: "opportunity" | "application"; onChange: (job: JobRecord) => void;
  onStatus: (id: string, status: JobStatus) => Promise<boolean>; onNote: (id: string, note: string) => Promise<boolean>; onOpenApplication: () => void;
}) {
  const [view, updateView] = useState<WorkspaceView>(initialView);
  const setView = (next: WorkspaceView) => { updateView(next); onViewChange?.(next); };
  useEffect(()=>updateView(initialView),[initialView]); const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(job.candidateNote ?? ""); const [busy, setBusy] = useState(false); const [copied, setCopied] = useState(false);
  const [startingApplication, setStartingApplication] = useState(false);
  useEffect(() => setNote(job.candidateNote ?? ""), [job.id, job.candidateNote]);
  const coverage = coverageLabel(job);
  const sourceUrl = job.sourceUrl;
  const applyUrl = job.applicationUrl && job.applicationUrl !== sourceUrl ? job.applicationUrl : !sourceUrl ? job.applicationUrl : undefined;
  const labels: Record<WorkspaceView, string> = { offer: "L’offre", application: "Ma candidature", interviews: `Entretiens (${job.interviews?.length ?? 0})`, brief: "Préparer / brief" };
  const tabs = workspaceSections(context);
  const activeView = context === "opportunity" && (view === "application" || view === "interviews") ? "offer" : view;
  return <div className="space-y-5">
    <div className="flex flex-wrap justify-end gap-2">{sourceUrl ? <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="secondary-button"><ExternalLink size={14} /> Voir l’annonce</a> : null}{applyUrl ? <a href={applyUrl} target="_blank" rel="noopener noreferrer" className="radar-add-button"><ExternalLink size={14} /> Postuler</a> : null}{!sourceUrl && !applyUrl ? <span className="offer-link-missing">Lien de candidature à renseigner</span> : null}</div>
    <nav aria-label={context === "opportunity" ? "Sections de l’opportunité" : "Sections de la candidature"} className="grid grid-cols-2 gap-1 rounded-xl bg-[#f5f6f8] p-1 sm:flex sm:overflow-x-auto">{tabs.map(id => <button key={id} onClick={() => setView(id)} aria-current={activeView === id ? "page" : undefined} className={`min-h-11 rounded-lg px-3 py-2 text-xs font-semibold sm:shrink-0 ${activeView === id ? "bg-white text-[#4b4bd1] shadow-sm" : "text-[#535768]"}`}>{labels[id]}</button>)}</nav>
    {context === "opportunity" && !job.deletedAt ? <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#eadce2] bg-[#fff8f5] p-3 sm:p-4"><p className="max-w-md text-xs leading-5 text-[#535768]">{hasApplication(job) ? "Cette offre a déjà un suivi de candidature. Retrouvez-y les échanges et entretiens." : "Vous avez envoyé votre candidature ? Démarrez son suivi ici. Radar n’envoie rien à votre place."}</p><button type="button" className="secondary-button shrink-0" disabled={startingApplication} onClick={async () => { if (hasApplication(job)) { onOpenApplication(); return; } setStartingApplication(true); try { if (await onStatus(job.id, "applied")) onOpenApplication(); } finally { setStartingApplication(false); } }}>{startingApplication ? <LoaderCircle size={14} className="animate-spin" /> : null}{hasApplication(job) ? "Voir dans Candidatures" : "J’ai postulé"}</button></div> : null}
    {activeView === "offer" && !editing ? <>
      <section aria-label="Informations clés de l’offre" className="offer-facts">
        <div className="offer-facts-primary">
          <KeyFact icon={BriefcaseBusiness} tone="violet" label="Contrat" value={job.contractType === "cdi" ? "CDI" : job.contractType === "freelance" ? "Freelance" : "À confirmer"} unknown={job.contractType !== "cdi" && job.contractType !== "freelance"} />
          <KeyFact icon={Banknote} tone="coral" label="Rémunération" value={job.dailyRate ? `${formatEuro(job.dailyRate)} HT/jour` : job.annualSalary ? `${formatEuro(job.annualSalary)} brut/an` : "Non communiquée"} unknown={!job.dailyRate && !job.annualSalary} />
          <KeyFact icon={Globe2} tone="teal" label="Travail annoncé" value={{ full_remote: "Full remote", exceptional: "Présence exceptionnelle", hybrid: "Hybride", onsite: "Sur site", unknown: "À confirmer" }[job.remoteMode]} unknown={job.remoteMode === "unknown"} />
        </div>
        <div className="offer-facts-secondary">
          <MetaFact icon={MapPin} label="Présence / pays" value={job.onsiteCadence || "Fréquence et pays autorisés à confirmer"} />
          <MetaFact icon={Languages} label="Langue" value={{ fr: "Français", en: "Anglais", professional_en: "Anglais professionnel", advanced_en: "Anglais avancé", unknown: "À confirmer" }[job.language]} />
          <MetaFact icon={CalendarDays} label="Publication" value={formatDate(job.publishedAt)} />
          <MetaFact icon={Clock3} label="Ajout au Radar" value={formatDate(job.createdAt)} />
          {job.notificationAt ? <MetaFact icon={Clock3} label="Notification source" value={formatDate(job.notificationAt)} /> : null}
        </div>
      </section>
      {!job.publishedAt ? <p className="rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900">La source ne donne pas de date de publication confirmée. La date d’import ou de notification ne la remplace pas.</p> : null}
      <div className="grid gap-3 sm:grid-cols-2"><Signals title="Pourquoi c’est pertinent" items={job.reasons} tone="positive" /><Signals title="Points à vérifier" items={job.flags} tone="caution" /></div>
      <section><div className="mb-3 flex items-center justify-between gap-3"><p className="offer-section-title">Description, missions et exigences</p>{!job.deletedAt ? <button onClick={() => setEditing(true)} className="secondary-button"><Pencil size={13} /> Compléter / corriger</button> : null}</div><p className="whitespace-pre-wrap break-words rounded-2xl bg-[#fffaf8] p-4 text-sm leading-7 text-[#535768]">{job.description || "Aucune description fournie. Ajoutez le contenu de l’annonce ou d’une alerte autorisée."}</p>{coverage !== "Description complète fournie" ? <p className="mt-2 text-xs leading-5 text-[#535768]">{coverage} : les informations absentes restent à confirmer.{!job.deletedAt ? " Vous pouvez coller une description complète ici, sans recréer une fiche." : " Restaurez l’offre pour compléter sa description."}</p> : null}</section>
    </> : null}
    {activeView === "offer" && editing ? <OfferEditor job={job} onSaved={updated => { onChange(updated); setEditing(false); }} onCancel={() => setEditing(false)} /> : null}
    {context === "application" && activeView === "application" ? <><StatusSelect value={job.status} onChange={status => onStatus(job.id, status)} /><div className="rounded-2xl bg-[#fff2eb] p-4"><Field label="Notes privées de candidature"><textarea rows={5} maxLength={2000} value={note} onChange={event => setNote(event.target.value)} placeholder="Vos échanges, vos conditions proposées, les points encore à confirmer…" /></Field><p className="mt-2 text-xs leading-5 text-[#535768]">Ces notes restent distinctes de l’annonce. Une proposition n’est pas un accord du recruteur.</p><button disabled={busy || note === (job.candidateNote ?? "")} onClick={async () => { setBusy(true); try { await onNote(job.id, note); } finally { setBusy(false); } }} className="radar-add-button mt-3 disabled:opacity-40">{busy ? <LoaderCircle size={14} className="animate-spin" /> : <Check size={14} />} Enregistrer la note</button></div><button onClick={() => setView("interviews")} className="secondary-button"><CalendarPlus size={14} /> Planifier un entretien ou faire le bilan</button></> : null}
    {context === "application" && activeView === "interviews" ? <InterviewManager job={job} onChange={onChange} /> : null}
    {activeView === "brief" ? <PrivateBrief key={job.id} jobId={job.id} /> : null}
  </div>;
}
function PrivateBrief({ jobId }: { jobId: string }) {
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
        if (!response.ok) throw new Error(data.error ?? "Brief indisponible.");
        if (active) setBrief(data.brief);
      })
      .catch(problem => { if (active) setError(problem instanceof Error ? problem.message : "Brief indisponible."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [jobId, language, refresh]);
  return <div className="space-y-4">
    <label className="block text-xs">Langue des réponses<select value={language} onChange={event => setLanguage(event.target.value as "fr" | "en")}><option value="fr">Français</option><option value="en">Anglais professionnel simple</option></select></label>
    <ApplicationQuestions jobId={jobId} language={language} onSaved={() => setRefresh(value => value + 1)} />
    <div className="space-y-3">
      <p className="offer-section-title">Brief à utiliser dans ChatGPT</p>
      <p className="text-xs leading-5 text-[#535768]">Le brief reprend l’annonce, vos questions enregistrées et seulement les faits approuvés et autorisés. Notes privées, entretiens, sources brutes et profil historique sont exclus. Copiez-le dans votre compte ChatGPT si vous souhaitez préparer des réponses ; aucune IA payante n’est appelée par Radar.</p>
      {loading ? <div role="status" aria-label="Chargement du brief" className="min-h-44 space-y-3 rounded-2xl border border-[#e8dfe5] bg-[#fffaf8] p-5">
        <span className="sr-only">Chargement du brief en cours</span>
        <div aria-hidden="true" className="h-4 w-2/3 animate-pulse rounded-full bg-[#e9dce3]" />
        <div aria-hidden="true" className="h-3 w-full animate-pulse rounded-full bg-[#eee4e9]" />
        <div aria-hidden="true" className="h-3 w-5/6 animate-pulse rounded-full bg-[#eee4e9]" />
        <div aria-hidden="true" className="h-3 w-3/4 animate-pulse rounded-full bg-[#eee4e9]" />
      </div> : null}
      {error ? <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
      {!loading && brief ? <>
        <pre className="max-h-[50vh] overflow-auto whitespace-pre-wrap rounded-2xl bg-[#333333] p-4 text-xs leading-6 text-white">{brief}</pre>
        <button onClick={async () => { try { await navigator.clipboard.writeText(brief); setCopied(true); } catch { setError("Copie impossible : sélectionnez le texte."); } }} className="radar-add-button"><Copy size={14} />{copied ? "Brief copié" : "Copier le brief"}</button>
      </> : null}
      {!loading && !brief && !error ? <p className="text-sm text-[#535768]">Aucun brief disponible pour cette offre.</p> : null}
    </div>
  </div>;
}
function Info({ label, value }: { label: string; value: string }) { return <div><p className="text-[11px] text-[#535768]">{label}</p><p className="mt-1 text-sm font-semibold leading-5">{value}</p></div>; }
function KeyFact({ icon: Icon, tone, label, value, unknown = false }: { icon: LucideIcon; tone: "violet" | "coral" | "teal"; label: string; value: string; unknown?: boolean }) {
  return <div className={`offer-key-fact offer-key-fact--${tone}${unknown ? " is-unknown" : ""}`}><div className="offer-key-fact-heading"><span className="offer-key-fact-icon"><Icon size={17} aria-hidden="true" /></span><span>{label}</span></div><strong>{value}</strong></div>;
}
function MetaFact({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return <div className="offer-meta-fact"><Icon size={16} aria-hidden="true" /><div><span>{label}</span><strong>{value}</strong></div></div>;
}
function Signals({ title, items, tone }: { title: string; items: string[]; tone: "positive" | "caution" }) {
  const Icon = tone === "positive" ? CheckCircle2 : CircleHelp;
  return <section className={`offer-signal offer-signal--${tone}`}><p className="offer-section-title"><Icon size={17} aria-hidden="true" />{title}</p><ul>{items.length ? items.map(item => <li key={item}>{item}</li>) : <li>Aucun signal confirmé à ce stade.</li>}</ul></section>;
}

function OfferEditor({ job, onSaved, onCancel }: { job: JobRecord; onSaved: (job: JobRecord) => void; onCancel: () => void }) {
  const [description, setDescription] = useState(job.description ?? ""); const [publishedAt, setPublishedAt] = useState(job.publishedAt?.slice(0, 10) ?? "");
  const [coverage, setCoverage] = useState(job.contentCoverage ?? "unknown"); const [applicationUrl, setApplicationUrl] = useState(job.applicationUrl ?? "");
  const [sourceUrl, setSourceUrl] = useState(job.sourceUrl ?? ""); const [onsiteCadence, setOnsiteCadence] = useState(job.onsiteCadence ?? "");
  const [salary, setSalary] = useState(job.annualSalary?.toString() ?? ""); const [rate, setRate] = useState(job.dailyRate?.toString() ?? "");
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function save() { setBusy(true); setError(""); try { const updated = await requestJob(`/api/jobs/${job.id}`, "PUT", { description, publishedAt, contentCoverage: coverage, ...(sourceUrl ? { sourceUrl } : {}), applicationUrl, onsiteCadence, annualSalary: salary ? Number(salary) : null, dailyRate: rate ? Number(rate) : null }); onSaved(updated); } catch (problem) { setError(problem instanceof Error ? problem.message : "Enregistrement non confirmé."); } finally { setBusy(false); } }
  return <div className="space-y-4">
    <p className="text-xs leading-5 text-[#535768]">Enregistrez les faits de l’annonce, pas vos conditions négociées. Vos statuts, notes et entretiens sont conservés.</p>
    <Field label="Description de l’offre"><textarea rows={10} maxLength={12000} value={description} onChange={event => setDescription(event.target.value)} /></Field>
    <div className="grid gap-4 sm:grid-cols-2">
      <ChoiceSelect label="Niveau de détail fourni" value={coverage} onChange={setCoverage} options={[{value:"full",label:"Description complète fournie"},{value:"summary",label:"Synthèse"},{value:"partial",label:"Notification partielle"},{value:"unknown",label:"À confirmer"}]} />
      <Field label="Date réelle de publication (si confirmée)"><input type="date" value={publishedAt} onInput={event => setPublishedAt(event.currentTarget.value)} onChange={event => setPublishedAt(event.target.value)} /></Field>
      <Field label="Lien de l’offre"><input type="url" value={sourceUrl} onChange={event => setSourceUrl(event.target.value)} /></Field>
      <Field label="Lien pour postuler (si différent)"><input type="url" value={applicationUrl} onChange={event => setApplicationUrl(event.target.value)} /></Field>
      <Field label="Salaire annuel brut annoncé (€)"><input inputMode="numeric" value={salary} onChange={event => setSalary(event.target.value)} /></Field>
      <Field label="TJM HT annoncé (€)"><input inputMode="numeric" value={rate} onChange={event => setRate(event.target.value)} /></Field>
    </div>
    <Field label="Présence annoncée et pays autorisés"><input value={onsiteCadence} onChange={event => setOnsiteCadence(event.target.value)} /></Field>
    {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
    <div className="flex flex-wrap gap-3"><button disabled={busy} onClick={() => void save()} className="radar-add-button">{busy ? <LoaderCircle size={14} className="animate-spin" /> : <Check size={14} />} Enregistrer l’offre</button><button disabled={busy} onClick={onCancel} className="secondary-button">Annuler</button></div>
  </div>;
}

function InterviewManager({ job, onChange }: { job: JobRecord; onChange: (job: JobRecord) => void }) {
  const [editor, setEditor] = useState<InterviewRecord | "new" | null>(null); const [review, setReview] = useState<InterviewRecord | null>(null); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now()); useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(timer); }, []);
  async function cancel(event: InterviewRecord) { setBusy(true); setError(""); try { onChange(await requestJob(`/api/interviews/${event.id}`, "PATCH", { action: "cancel" })); } catch { setError("Annulation non enregistrée."); } finally { setBusy(false); } }
  if (editor) return <InterviewEditor jobId={job.id} interview={editor === "new" ? undefined : editor} onSaved={updated => { onChange(updated); setEditor(null); }} onCancel={() => setEditor(null)} />;
  if (review) return <InterviewReview interview={review} onSaved={updated => { onChange(updated); setReview(null); }} onCancel={() => setReview(null)} />;
  return <div className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm font-semibold">Votre parcours d’entretien</p><button onClick={() => setEditor("new")} className="radar-add-button"><CalendarPlus size={15} /> Ajouter un entretien</button></div><p className="text-xs leading-5 text-[#535768]">Choisissez la date et le fuseau du rendez-vous. Une fois terminé, un bilan sera proposé dans Radar ; un rappel externe nécessite une automatisation configurée séparément.</p>{!(job.interviews?.length) ? <p className="rounded-2xl border border-dashed border-[#e8d7df] p-5 text-sm text-[#535768]">Aucune date enregistrée. Si l’entretien a déjà eu lieu, vous pouvez renseigner sa date passée puis faire le bilan.</p> : null}{(job.interviews ?? []).map(event => <section key={event.id} className="rounded-2xl border border-[#d0d4e4] bg-white p-4"><div className="flex flex-wrap justify-between gap-2"><p className="text-sm font-semibold">{event.label}</p><span className="quiet-tag">{event.state === "cancelled" ? "Annulé" : event.state === "reviewed" ? "Bilan enregistré" : reviewDue(event, now) ? "Passé · bilan à faire" : "Prévu"}</span></div><p className="mt-2 text-xs leading-5 text-[#535768]">{formatDate(event.startAt, event.timeZone, true)} · {event.timeZone} · {Math.round((Date.parse(event.endAt) - Date.parse(event.startAt)) / 60000)} min · {{ video: "Visio", phone: "Téléphone", onsite: "Sur site", other: "Autre" }[event.format]}</p>{event.state === "reviewed" ? <div className="mt-3 space-y-2 text-xs leading-5"><Info label="Suite choisie" value={{ waiting: "En attente de retour", next_step: "Prochaine étape", rejected: "Refus", withdrawn: "Retirée", offer: "Proposition reçue" }[event.outcome ?? "waiting"]} /><p className="whitespace-pre-wrap">{event.summary}</p>{event.strengths ? <p className="whitespace-pre-wrap"><strong>Ce qui s’est bien passé :</strong> {event.strengths}</p> : null}{event.weaknesses ? <p className="whitespace-pre-wrap"><strong>À améliorer :</strong> {event.weaknesses}</p> : null}{event.nextAction ? <p><strong>Prochaine action :</strong> {event.nextAction}</p> : null}{event.followUpAt ? <p>Relance envisagée : {formatDate(event.followUpAt, event.timeZone, true)}</p> : null}</div> : null}<div className="mt-3 flex flex-wrap gap-2">{event.state !== "cancelled" && (reviewDue(event, now) || event.state === "reviewed") ? <button onClick={() => setReview(event)} className="radar-add-button">{event.state === "reviewed" ? "Modifier le bilan" : "Comment s’est passé l’entretien ?"}</button> : null}{event.state === "planned" ? <><button onClick={() => setEditor(event)} className="secondary-button">Modifier la date</button><button disabled={busy} onClick={() => void cancel(event)} className="secondary-button">Annuler l’entretien</button></> : null}</div></section>)}{error ? <p role="alert" className="text-red-700">{error}</p> : null}</div>;
}
function InterviewEditor({ jobId, interview, onSaved, onCancel }: { jobId: string; interview?: InterviewRecord; onSaved: (job: JobRecord) => void; onCancel: () => void }) {
  const [requestId] = useState(() => crypto.randomUUID()); const [label, setLabel] = useState(interview?.label ?? "Entretien");
  const [zone, setZone] = useState(interview?.timeZone ?? "Europe/Paris"); const [start, setStart] = useState(interview ? zonedInput(interview.startAt, interview.timeZone) : "");
  const [duration, setDuration] = useState(interview ? Math.round((Date.parse(interview.endAt) - Date.parse(interview.startAt)) / 60000) : 60); const [format, setFormat] = useState(interview?.format ?? "video"); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function save() { setBusy(true); setError(""); try { const startAt = fromZonedInput(start, zone); const fields = { label, startAt, endAt: new Date(Date.parse(startAt) + duration * 60000).toISOString(), timeZone: zone, format }; onSaved(await requestJob(interview ? `/api/interviews/${interview.id}` : "/api/interviews", interview ? "PATCH" : "POST", interview ? { action: "schedule", ...fields } : { id: requestId, jobId, ...fields })); } catch (problem) { setError(problem instanceof Error ? problem.message : "Enregistrement non confirmé."); } finally { setBusy(false); } }
  return <div className="space-y-4">
    <p className="text-sm font-semibold">{interview ? "Modifier le rendez-vous" : "Planifier ou dater un entretien"}</p>
    <Field label="Étape / interlocuteur"><input value={label} maxLength={180} onChange={event => setLabel(event.target.value)} placeholder="Ex. Atlas · exemple fictif · entretien métier" /></Field>
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Date et heure de l’entretien"><input type="datetime-local" value={start} onInput={event => setStart(event.currentTarget.value)} onChange={event => setStart(event.target.value)} /></Field>
      <ChoiceSelect label="Fuseau horaire du rendez-vous" value={zone} onChange={setZone} options={[{value:"Europe/Paris",label:"Paris"},{value:"Indian/Mauritius",label:"Maurice"},{value:"UTC",label:"UTC"}]} />
      <Field label="Durée estimée (minutes)"><input type="number" min={1} max={480} value={duration} onChange={event => setDuration(Number(event.target.value))} /></Field>
      <ChoiceSelect label="Format" value={format} onChange={setFormat} options={[{value:"video",label:"Visio"},{value:"phone",label:"Téléphone"},{value:"onsite",label:"Sur site"},{value:"other",label:"Autre"}]} />
    </div>
    <p className="text-xs leading-5 text-[#535768]">Le rappel intervient après l’heure de fin estimée, pas au début du rendez-vous. Aucun événement n’est créé dans un calendrier externe.</p>
    {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
    <div className="flex flex-wrap gap-3"><button disabled={busy || !start || !label.trim()} onClick={() => void save()} className="radar-add-button disabled:opacity-40">{busy ? <LoaderCircle size={14} className="animate-spin" /> : <Check size={14} />} Enregistrer l’entretien</button><button disabled={busy} onClick={onCancel} className="secondary-button">Annuler</button></div>
  </div>;
}
function InterviewReview({ interview, onSaved, onCancel }: { interview: InterviewRecord; onSaved: (job: JobRecord) => void; onCancel: () => void }) {
  const [outcome, setOutcome] = useState(interview.outcome ?? "waiting"); const [summary, setSummary] = useState(interview.summary ?? ""); const [strengths, setStrengths] = useState(interview.strengths ?? ""); const [weaknesses, setWeaknesses] = useState(interview.weaknesses ?? ""); const [nextAction, setNextAction] = useState(interview.nextAction ?? ""); const [followUp, setFollowUp] = useState(interview.followUpAt ? zonedInput(interview.followUpAt, interview.timeZone) : ""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function save() { setBusy(true); setError(""); try { onSaved(await requestJob(`/api/interviews/${interview.id}`, "PATCH", { action: "review", outcome, summary, strengths, weaknesses, nextAction, followUpAt: followUp ? fromZonedInput(followUp, interview.timeZone) : "" })); } catch (problem) { setError(problem instanceof Error ? problem.message : "Enregistrement non confirmé."); } finally { setBusy(false); } }
  return <div className="space-y-4">
    <p className="text-sm font-semibold">Bilan privé · {interview.label}</p>
    <ChoiceSelect label="Quelle est la suite ?" value={outcome} onChange={setOutcome} options={[{value:"waiting",label:"En attente de retour"},{value:"next_step",label:"Prochaine étape"},{value:"rejected",label:"Refus"},{value:"withdrawn",label:"Je ne souhaite pas poursuivre"},{value:"offer",label:"Proposition reçue"}]} />
    <Field label="Ce qui a été dit / à retenir"><textarea rows={5} maxLength={5000} value={summary} onChange={event => setSummary(event.target.value)} /></Field>
    <div className="grid gap-4 sm:grid-cols-2"><Field label="Ce qui s’est bien passé"><textarea rows={3} maxLength={3000} value={strengths} onChange={event => setStrengths(event.target.value)} /></Field><Field label="Ce qui a été moins bien / à travailler"><textarea rows={3} maxLength={3000} value={weaknesses} onChange={event => setWeaknesses(event.target.value)} /></Field></div>
    <Field label="Prochaine action"><input maxLength={2000} value={nextAction} onChange={event => setNextAction(event.target.value)} placeholder="Ex. attendre le retour, préparer un cas pratique…" /></Field>
    <Field label={`Date envisagée pour relancer (${interview.timeZone})`}><input type="datetime-local" value={followUp} onInput={event => setFollowUp(event.currentTarget.value)} onChange={event => setFollowUp(event.target.value)} /></Field>
    <p className="text-xs leading-5 text-[#535768]">Votre choix met à jour le statut de candidature. Le bilan reste privé ; aucune relance au recruteur n’est envoyée automatiquement.</p>
    {error ? <p role="alert" className="text-red-700">{error}</p> : null}
    <div className="flex flex-wrap gap-3"><button disabled={busy} onClick={() => void save()} className="radar-add-button">{busy ? <LoaderCircle size={14} className="animate-spin" /> : <Check size={14} />} Enregistrer le bilan et le statut</button><button disabled={busy} onClick={onCancel} className="secondary-button">Annuler</button></div>
  </div>;
}
