"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  RefreshCw,
  Sunrise,
  ShieldCheck,
  SlidersHorizontal,
  MapPin,
  BriefcaseBusiness,
  Check,
  ChevronRight,
  CircleAlert,
  ClipboardCheck,
  Copy,
  ExternalLink,
  FileText,
  Flame,
  LayoutDashboard,
  LoaderCircle,
  Mail,
  Plus,
  Search,
  Sparkles,
  Target,
  Trash2,
  Undo2,
  UserRound,
  X,
} from "lucide-react";
import { formatEuro } from "@/lib/matching";
import { applyTrashState, selectionInView } from "@/lib/offer-trash-ui";
import { selectTriageActions, sortOffersForTriage } from "@/lib/triage";
import { hasApplication, inOpportunityView, reviewState, type OpportunityView } from "@/lib/opportunity-views";
import { ExperienceLibrary } from "@/components/experience-library";
import { ProfileDocuments } from "@/components/profile-documents";
import { SourceLogo } from "@/components/source-logo";
import { PageHeader, PrivateLabel, WorkspaceBrand, WorkspaceLoading, WorkspaceState, useRadarNavigation } from "@/components/workspace-ui";
import { TodayWorkspace, ApplicationsWorkspace } from "@/components/today-workspace";
import { OpportunitiesWorkspace } from "@/components/opportunities-workspace";
import { ChoiceSelect } from "@/components/choice-select";
import type { DocumentLinks } from "@/lib/document-input";
import { OfferSourceBadge, OfferWorkspace, StatusSelect, type WorkspaceView } from "@/components/offer-workspace";
import { sourceNames } from "@/lib/source-catalog";
import { summarizeOfferDescription } from "@/lib/offer-summary";
import { SourcePanel } from "@/components/source-panel";
import { activeStatuses, terminalStatuses, formatDate, reviewDue, statusLabels } from "@/lib/application-workflow";
import { profileTemplate } from "@/lib/profile-template";
import type { CandidateProfile, DismissalReason, JobInput, JobRecord, JobStatus, MatchTier } from "@/lib/types";

type Tab = "dashboard" | "offers" | "pipeline" | "profile" | "sources";
type OfferFilter = OpportunityView;
type JobDraft = {
  title: string; company: string; contractType: JobInput["contractType"]; annualSalary: string; dailyRate: string;
  remoteMode: JobInput["remoteMode"]; onsiteCadence: string; language: JobInput["language"]; source: string; sourceUrl: string; applicationUrl: string; publishedAt: string; contentCoverage: NonNullable<JobInput["contentCoverage"]>; description: string;
};

const tabs: Array<{ id: Tab; label: string; mobileLabel: string; icon: typeof LayoutDashboard }> = [
  { id: "dashboard", label: "Aujourd’hui", mobileLabel: "Accueil", icon: LayoutDashboard },
  { id: "offers", label: "Opportunités", mobileLabel: "Offres", icon: Search },
  { id: "pipeline", label: "Candidatures", mobileLabel: "Suivi", icon: ClipboardCheck },
  { id: "profile", label: "Mon profil", mobileLabel: "Profil", icon: UserRound },
  { id: "sources", label: "Sources", mobileLabel: "Sources", icon: Mail },
];
const sources = [
  ["Collective", "Alertes PO/PM, remote et TJM/salaire", "À connecter"],
  ["LinkedIn Jobs", "Alertes emploi transférées", "À connecter"],
  ["Posts LinkedIn", "Lien ou texte collé manuellement", "Prêt"],
  ["Apec", "Alertes CDI produit", "À connecter"],
  ["Welcome to the Jungle", "Alertes produit France / Europe", "À connecter"],
  ["Malt", "Propositions freelance reçues par email", "À connecter"],
  ["Free-Work", "Alertes freelance", "À connecter"],
  ["We Work Remotely", "Périmètre US écarté ; mondial à vérifier", "Filtrage actif"],
] as const;
const tierCopy: Record<MatchTier, { label: string; className: string }> = {
  priority: { label: "Score élevé", className: "bg-rose-100 text-rose-800 ring-rose-200" },
  match: { label: "Potentiel", className: "bg-orange-100 text-orange-800 ring-orange-200" },
  exception: { label: "Points à vérifier", className: "bg-amber-50 text-amber-800 ring-amber-200" },
  excluded: { label: "Critères incompatibles", className: "bg-stone-100 text-stone-600 ring-stone-200" },
};
const dismissalLabels: Record<DismissalReason, string> = { filled: "Poste pourvu", applications_closed: "Candidatures fermées", not_interested: "Je ne souhaite pas postuler", other: "Autre raison" };
const emptyDraft = (): JobDraft => ({ title: "", company: "", contractType: "other", annualSalary: "", dailyRate: "", remoteMode: "unknown", onsiteCadence: "", language: "unknown", source: "Ajout manuel", sourceUrl: "", applicationUrl: "", publishedAt: "", contentCoverage: "unknown", description: "" });

export function RadarApp({ userName }: { userName: string }) {
  const { route, navigate } = useRadarNavigation();
  const { tab, filter, query, view: workspaceView } = route;
  const setFilter = (filter: OfferFilter) => navigate({ filter, offer: undefined });
  const setQuery = (query: string) => navigate({ query, tab: "offers", offer: undefined }, true);
  const [allJobs, setJobs] = useState<JobRecord[]>([]);
  const jobs = useMemo(() => allJobs.filter(job => !job.deletedAt), [allJobs]);
  const [deleteTarget, setDeleteTarget] = useState<JobRecord[]>([]);
  const [deleteReason, setDeleteReason] = useState<DismissalReason | "">("");
  const [deleteNote, setDeleteNote] = useState("");
  const [trashBusy, setTrashBusy] = useState<string | null>(null);
  const trashLock = useRef(false);
  const [trashError, setTrashError] = useState<string | null>(null);
  const [profile, setProfile] = useState<CandidateProfile>(profileTemplate);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [jobDialogOpen, setJobDialogOpen] = useState(false);
  const selectedJob = allJobs.find(job => job.id === route.offer) || null;
  const [loadErrors, setLoadErrors] = useState({ jobs: false, profile: false });
  const [loadAttempt, setLoadAttempt] = useState(0);
  const openJob = (job: JobRecord, view: WorkspaceView = "offer") => navigate({ offer: job.id, view, ...(view === "interviews" || view === "application" ? {tab: "pipeline" as Tab} : {}) });
  const closeJob = () => navigate({ offer: undefined, view: "offer" });
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      const json = async <T,>(path: string): Promise<T> => { const response = await fetch(path, {cache: "no-store", signal: AbortSignal.timeout(15000)}); if (!response.ok) throw new Error("Chargement impossible"); return response.json() as Promise<T>; };
      const [jobResult, profileResult] = await Promise.allSettled([json<{jobs:JobRecord[]}>("/api/jobs?includeDeleted=true"), json<{profile:CandidateProfile|null}>("/api/profile")]);
      if (!active) return;
      if (jobResult.status === "fulfilled") setJobs(jobResult.value.jobs);
      if (profileResult.status === "fulfilled" && profileResult.value.profile) setProfile(profileResult.value.profile);
      setLoadErrors({jobs:jobResult.status === "rejected",profile:profileResult.status === "rejected"});
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [loadAttempt]);

  const stats = useMemo(() => ({
    new: jobs.filter((job) => inOpportunityView(job, "to_review")).length,
    priority: jobs.filter((job) => inOpportunityView(job, "selected")).length,
    exceptions: jobs.filter((job) => job.matchTier === "exception" && !terminalStatuses.includes(job.status)).length,
    active: allJobs.filter((job) => hasApplication(job) && activeStatuses.includes(job.status)).length,
  }), [jobs, allJobs]);

  async function updateJob(id: string, changes: { status?: JobStatus; candidateNote?: string; reviewState?: "to_review" | "selected" }) {
    try {
      const response = await fetch(`/api/jobs/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(changes) });
      if (!response.ok) throw new Error("Mise à jour impossible");
      const { job } = (await response.json()) as { job: JobRecord };
      setJobs(current => current.map(item => item.id === id ? job : item));
      if (changes.candidateNote !== undefined) setProfile(current => ({ ...current, applicationNotes: { ...current.applicationNotes, [id]: job.candidateNote ?? "" } }));
      setToast(changes.candidateNote !== undefined ? "Note enregistrée dans votre espace privé." : changes.reviewState ? "Votre sélection est mise à jour." : "Statut enregistré.");
      return true;
    } catch { setToast("La mise à jour n’a pas été enregistrée. Vos données restent inchangées."); return false; }
  }
  async function changeStatus(id: string, status: JobStatus) { return updateJob(id, { status }); }
  function requestDelete(job: JobRecord) { requestDeleteMany([job]); }
  function requestDeleteMany(selection: JobRecord[]) { if (trashLock.current || refreshing) return; setTrashError(null); setDeleteReason(""); setDeleteNote(""); closeJob(); setDeleteTarget(selection); }
  async function changeTrash(selection: JobRecord[], deleted: boolean, reason?: DismissalReason, note?: string) {
    if (trashLock.current || refreshing || !selection.length) return;
    trashLock.current = true; setTrashBusy(selection[0].id); setTrashError(null); setDeleteTarget([]);
    const optimistic = selection.map(job => ({ id: job.id, deletedAt: deleted ? new Date().toISOString() : undefined }));
    setJobs(current => applyTrashState(current, optimistic));
    try {
      const response = await fetch("/api/jobs/trash", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: selection.map(job => job.id), deleted, reason, note }), signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw new Error("Enregistrement non confirmé");
      const { results } = await response.json() as { results: { id: string; deletedAt: string | null; dismissalReason?: DismissalReason; dismissalNote?: string }[] };
      const confirmed = new Set(results.map(item => item.id));
      const missing = selection.filter(job => !confirmed.has(job.id));
      setJobs(current => applyTrashState(current, [...results, ...missing]));
      if (missing.length) setTrashError(`${missing.length} offre(s) non confirmée(s), réaffichée(s). Actualisez la liste avant de réessayer.`);
      if (results.length) setToast(deleted ? `${results.length} ${results.length === 1 ? "offre supprimée" : "offres supprimées"}. Restauration possible dans Corbeille.` : `${results.length} ${results.length === 1 ? "offre restaurée" : "offres restaurées"}, avec les notes et entretiens.`);
    } catch {
      setJobs(current => applyTrashState(current, selection));
      setTrashError("Enregistrement non confirmé : les offres ont été réaffichées. Réessayez ou actualisez pour vérifier. Aucun contenu n’est effacé définitivement.");
    } finally { trashLock.current = false; setTrashBusy(null); }
  }
  async function saveProfile(next: CandidateProfile) {
    try {
      const response = await fetch("/api/profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });
      if (!response.ok) throw new Error("Enregistrement impossible");
      const result = await response.json() as { profile: CandidateProfile };
      setProfile(result.profile); setToast("Profil enregistré dans votre espace privé."); return true;
    } catch { setToast("Le profil n’a pas été enregistré. Vos modifications restent disponibles à l’écran."); return false; }
  }
  function onJobCreated(job: JobRecord, deduplicated?: boolean) {
    setJobs((current) => current.some((item) => item.id === job.id) ? current : [job, ...current]);
    setJobDialogOpen(false);
    setToast(job.deletedAt ? "Cette offre est déjà dans la corbeille. Restaurez-la depuis Opportunités → Corbeille si nécessaire." : deduplicated ? "Cette opportunité était déjà dans votre radar." : "Opportunité ajoutée et qualifiée.");
  }
  const searchedJobs = allJobs.filter(job => `${job.title} ${job.company} ${job.source}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const viewCounts = Object.fromEntries((["to_review", "selected", "good_matches", "all", "trash"] as OfferFilter[]).map(view => [view, searchedJobs.filter(job => inOpportunityView(job, view)).length])) as Record<OfferFilter, number>;
  const shownJobs = filter === "to_review" ? sortOffersForTriage(searchedJobs) : searchedJobs.filter(job => inOpportunityView(job, filter));
  function selectTab(next: Tab) { navigate({ tab: next, offer: undefined }); window.scrollTo(0, 0); requestAnimationFrame(() => document.getElementById("workspace-title")?.focus({preventScroll:true})); }

  async function refreshOffers() {
    if (trashLock.current) return;
    setRefreshing(true);
    try {
      const response = await fetch("/api/jobs?includeDeleted=true", { cache: "no-store" });
      if (!response.ok) throw new Error("Lecture impossible");
      const result = await response.json() as { jobs: JobRecord[] };
      setJobs(result.jobs);
      setLoadErrors(current => ({...current,jobs:false}));
      setToast("Votre radar est à jour.");
    } catch { setToast("Actualisation impossible. Vos dernières données restent affichées."); }
    finally { setRefreshing(false); }
  }

  return <main className="radar-app text-[#333333]"><a href="#workspace-title" className="workspace-skip">Aller au contenu</a>
    <div className="radar-shell">
      <aside className="radar-sidebar">
        <div className="flex items-center justify-between gap-4 lg:block">
          <WorkspaceBrand />
          <button onClick={() => setJobDialogOpen(true)} className="radar-add-button lg:mt-8 lg:w-full" aria-label="Ajouter une offre"><Plus size={17} /><span className="hidden sm:inline">Ajouter une offre</span></button>
        </div>
        <label className="radar-search"><Search size={16} /><input aria-label="Rechercher une offre" placeholder="Rechercher une offre…" value={query} onChange={event => { setQuery(event.target.value); }} /></label>

        <nav aria-label="Navigation principale" className="radar-nav">{tabs.map(({ id, label, mobileLabel, icon: Icon }) => <button key={id} onClick={() => selectTab(id)} aria-label={id === "offers" ? `${label} · ${stats.new} à examiner` : label} aria-current={tab === id ? "page" : undefined} className={tab === id ? "is-active" : ""}><Icon size={18} strokeWidth={1.7} /><span className="radar-nav-label">{label}</span><span className="radar-mobile-label">{mobileLabel}</span>{id === "offers" && stats.new > 0 ? <span className="nav-count" title="Offres à examiner">{stats.new}</span> : null}</button>)}</nav>
        <div className="radar-sidebar-bottom">

          <div className="sidebar-account"><span className="avatar">LS</span><span className="min-w-0 text-left"><span className="block truncate text-xs font-semibold">{userName}</span><span className="mt-1 block text-[10px] text-[#9a8596]">Espace personnel</span></span></div>
        </div>
      </aside>
      <section className="radar-content">
        <div className="radar-topbar"><PrivateLabel /><div className="flex items-center gap-3"><button onClick={() => void refreshOffers()} disabled={refreshing} className="refresh-button" aria-label="Actualiser les offres"><RefreshCw size={15} className={refreshing ? "animate-spin" : ""} /><span className="hidden sm:inline">Actualiser</span></button><span className="avatar avatar-small" aria-label="Compte personnel">LS</span></div></div>
        <div className="radar-page">
        <PageHeader title={tabs.find(item => item.id === tab)?.label || "Radar Produit"} />
        {loading ? <WorkspaceLoading /> : null}
        {!loading && (loadErrors.jobs || loadErrors.profile) ? <WorkspaceState error title={loadErrors.jobs ? "Les offres n’ont pas pu être chargées" : "Votre profil n’a pas pu être chargé"} action={<button type="button" className="secondary-button" onClick={() => setLoadAttempt(n => n+1)}>Réessayer</button>}>Vérifiez votre connexion puis réessayez. Vos données sont conservées.</WorkspaceState> : null}
        {!loading && !loadErrors.jobs && tab === "dashboard" ? <TodayWorkspace jobs={allJobs} onTriage={() => navigate({tab:"offers",filter:"to_review",query:"",offer:undefined})} onSelected={() => navigate({tab:"offers",filter:"selected",query:"",offer:undefined})} onAdd={()=>setJobDialogOpen(true)} onOpen={openJob} /> : null}
        {trashBusy ? <div role="status" className="sticky top-3 z-20 mb-4 flex items-center gap-2 rounded-2xl border bg-white p-4 text-sm shadow-sm"><LoaderCircle size={16} className="animate-spin" /> Liste mise à jour · enregistrement en cours…</div> : null}
        {trashError ? <div role="alert" className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">{trashError}<button className="ml-3 underline" onClick={() => { setTrashError(null); void refreshOffers(); }}>Actualiser pour vérifier</button></div> : null}
        {!loading && !loadErrors.jobs && tab === "offers" ? <OpportunitiesWorkspace jobs={shownJobs} counts={viewCounts} filter={filter} onFilter={setFilter} query={query} onClearSearch={() => setQuery("")} activeId={route.offer} view={workspaceView} onOpen={openJob} onClose={closeJob} profile={profile} onReview={(id,state)=>updateJob(id,{reviewState:state})} onDelete={requestDelete} onDeleteMany={requestDeleteMany} onRestore={job=>void changeTrash([job],false)} onStatus={changeStatus} onNote={(id,candidateNote)=>updateJob(id,{candidateNote})} onChange={updated=>setJobs(current=>current.map(job=>job.id===updated.id?updated:job))} onApplication={job=>navigate({tab:"pipeline",offer:job.id,view:"application"})} onViewChange={(job,view)=>navigate({offer:job.id,view})} trashBusy={!!trashBusy||refreshing} /> : null}
        {!loading && !loadErrors.jobs && tab === "pipeline" ? <ApplicationsWorkspace jobs={allJobs.filter(hasApplication)} onStatus={changeStatus} onOpen={openJob} /> : null}
        {!loading && !loadErrors.profile && tab === "profile" ? <Profile profile={profile} onSave={saveProfile} onDocumentsLinked={links => setProfile(current => ({ ...current, ...links }))} /> : null}
        {!loading && tab === "sources" ? <SourcePanel jobs={jobs} onSynced={refreshOffers} /> : null}
        <footer className="radar-footer"><span><ShieldCheck size={12} /> Vos données restent privées.</span><span>Aucune candidature envoyée automatiquement.</span></footer>
        </div>
      </section>
    </div>
    {jobDialogOpen ? <JobDialog onClose={() => setJobDialogOpen(false)} onCreated={onJobCreated} /> : null}
    {selectedJob && tab !== "offers" ? <Modal title={selectedJob.title} description={selectedJob.company || "Entreprise à confirmer"} meta={<OfferSourceBadge job={selectedJob} />} onClose={closeJob}><OfferWorkspace key={selectedJob.id+":"+tab} onViewChange={view=>navigate({view})} job={selectedJob} profile={profile} initialView={workspaceView} context={tab === "pipeline" || (tab === "dashboard" && hasApplication(selectedJob)) ? "application" : "opportunity"} onStatus={changeStatus} onNote={(id, candidateNote) => updateJob(id, { candidateNote })} onOpenApplication={() => navigate({tab:"pipeline",offer:selectedJob.id,view:"application"})} onChange={updated => { setJobs(current => current.map(job => job.id === updated.id ? updated : job)); setToast("Dossier enregistré."); }} /><div className="mt-6 border-t pt-4">{selectedJob.deletedAt ? <button className="secondary-button" onClick={() => void changeTrash([selectedJob], false)}><Undo2 size={16} /> Restaurer</button> : <button className="secondary-button text-red-800" onClick={() => requestDelete(selectedJob)}><Trash2 size={16} /> Corbeille</button>}</div></Modal> : null}
    {deleteTarget.length ? <Modal title={`Mettre ${deleteTarget.length === 1 ? "cette offre" : `ces ${deleteTarget.length} offres`} à la corbeille ?`} description="Choisissez une raison commune à toute la sélection." onClose={() => setDeleteTarget([])}><div className="trash-dialog-content"><ul className="max-h-48 space-y-2 overflow-y-auto rounded-xl bg-[#f5f6f8] p-4 text-sm">{deleteTarget.map(job => <li key={job.id}><strong>{job.title}</strong> · {job.company}</li>)}</ul><div className="trash-dialog-fields"><ChoiceSelect label="Pourquoi ?" value={deleteReason} onChange={value => setDeleteReason(value as DismissalReason | "")} options={[{ value: "", label: "Choisir un motif" }, ...Object.entries(dismissalLabels).map(([value, label]) => ({ value, label }))]} /><label className="trash-dialog-note"><span>Précision <em>facultative</em></span><textarea rows={2} maxLength={500} value={deleteNote} onChange={event => setDeleteNote(event.target.value)} placeholder="Une courte précision, si utile" /></label></div><p className="trash-dialog-help">L’offre reste restaurable. Si une candidature est déjà engagée, elle et ses rappels restent visibles dans Candidatures.</p><div className="trash-dialog-actions"><button className="secondary-button" onClick={() => setDeleteTarget([])}>Annuler</button><button disabled={!deleteReason || !!trashBusy || refreshing} className="secondary-button text-red-800 disabled:opacity-50" onClick={() => void changeTrash(deleteTarget, true, deleteReason as DismissalReason, deleteNote)}><Trash2 size={16} /> Corbeille{deleteTarget.length > 1 ? ` (${deleteTarget.length})` : ""}</button></div></div></Modal> : null}
    {toast ? <Toast message={toast} onClose={() => setToast(null)} /> : null}
  </main>;
}

function Profile({ profile, onSave, onDocumentsLinked }: { profile: CandidateProfile; onSave: (profile: CandidateProfile) => Promise<boolean>; onDocumentsLinked: (links: DocumentLinks) => void }) {
  const [draft, setDraft] = useState(profile);
  const [saving, setSaving] = useState(false);
  const [filesBusy, setFilesBusy] = useState(false);
  function linked(links: DocumentLinks) { setDraft(current => ({ ...current, ...links })); onDocumentsLinked(links); }
  return <div className="profile-page"><nav aria-label="Sections du profil" className="profile-jump-nav"><a href="#experience-title">Mon carnet d’expériences <span>Relire et valider</span></a><a href="#profile-settings">Mon profil <span>Présentation générale</span></a><a href="#profile-documents">Mes documents <span>Originaux privés</span></a></nav><ExperienceLibrary documentId={draft.detailedExperienceDocumentId} /><div className="profile-layout mt-8">
    <section className="glass-panel p-5 sm:p-7">
      <div className="flex items-start justify-between gap-4"><div><h2 id="profile-settings" className="text-sm font-bold">Profil de pertinence</h2><p className="mt-1 text-sm leading-6 text-[#535768]">Votre profil historique reste conservé. Son enregistrement ne vaut pas approbation des faits : validez-les dans le carnet pour leur réutilisation.</p></div><Sparkles className="text-[#6161ff]" /></div>
      <div className="mt-7 grid gap-5">
        <Field label="Titre ciblé"><input value={draft.headline} onChange={event => setDraft({ ...draft, headline: event.target.value })} /></Field>
        <Field label="Résumé professionnel"><textarea rows={4} value={draft.summary} onChange={event => setDraft({ ...draft, summary: event.target.value })} /></Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Localisation / disponibilité"><input value={draft.location} onChange={event => setDraft({ ...draft, location: event.target.value })} /></Field>
          <Field label="Lien LinkedIn"><input placeholder="https://linkedin.com/in/..." value={draft.linkedinUrl} onChange={event => setDraft({ ...draft, linkedinUrl: event.target.value })} /></Field>
        </div>
        <Field label="Compétences qui comptent pour vous"><textarea rows={3} value={draft.skills.join(", ")} onChange={event => setDraft({ ...draft, skills: event.target.value.split(",").map(item => item.trim()).filter(Boolean) })} /></Field>
      </div>
      <button disabled={saving || filesBusy} onClick={async () => { setSaving(true); try { await onSave(draft); } finally { setSaving(false); } }} className="radar-add-button mt-7">{saving ? <LoaderCircle className="animate-spin" size={16} /> : <Check size={16} />} Enregistrer le profil</button>
      {filesBusy ? <p className="mt-2 text-xs text-[#535768]">Le fichier est en cours d’enregistrement. Vos autres modifications restent à l’écran.</p> : null}
    </section>
    <aside id="profile-documents" className="profile-aside space-y-5">
      <ProfileDocuments links={draft} onLinked={linked} onBusyChange={setFilesBusy} />
      <section className="rounded-[24px] bg-[#e7ecff] p-5"><h2 className="text-xs font-bold uppercase tracking-[.14em] text-[#4b4bd1]">Résultats à valoriser</h2><div className="mt-4 space-y-3">{draft.achievements.map(achievement => <div key={achievement.label} className="border-b border-[#e8dacb] pb-3 last:border-0 last:pb-0"><p className="text-2xl font-semibold text-[#333333]">{achievement.label}</p><p className="mt-1 text-xs leading-5 text-[#535768]">{achievement.detail}</p></div>)}</div></section>
    </aside>
  </div></div>;
}
function JobDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (job: JobRecord, deduplicated?: boolean) => void }) {
  const [draft, setDraft] = useState<JobDraft>(emptyDraft); const [paste, setPaste] = useState(""); const [parsing, setParsing] = useState(false); const [saving, setSaving] = useState(false); const [error, setError] = useState<string | null>(null);
  function update<K extends keyof JobDraft>(key: K, value: JobDraft[K]) { setDraft((current) => ({ ...current, [key]: value })); }
  async function parsePaste() {
    setParsing(true); setError(null);
    try {
      const response = await fetch("/api/parse-offer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: paste, source: draft.source, sourceUrl: draft.sourceUrl }) });
      const result = await response.json() as { offer?: Partial<JobInput>; error?: string };
      if (!response.ok || !result.offer) throw new Error(result.error ?? "Impossible d’analyser ce contenu.");
      const offer = result.offer;
      setDraft(current => ({ ...current, ...offer, annualSalary: offer.annualSalary ? String(offer.annualSalary) : current.annualSalary, dailyRate: offer.dailyRate ? String(offer.dailyRate) : current.dailyRate, description: offer.description ?? current.description }));
    } catch (problem) { setError(problem instanceof Error && problem.message !== "Failed to fetch" ? problem.message : "Analyse indisponible. Réessayez sans perdre le texte collé."); }
    finally { setParsing(false); }
  }
  async function save() {
    setSaving(true); setError(null);
    try {
      const payload = { ...draft, annualSalary: draft.annualSalary ? Number(draft.annualSalary) : null, dailyRate: draft.dailyRate ? Number(draft.dailyRate) : null };
      const response = await fetch("/api/jobs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json() as { job?: JobRecord; deduplicated?: boolean; error?: string };
      if (!response.ok || !result.job) throw new Error(result.error ?? "Impossible d’ajouter cette offre.");
      onCreated(result.job, result.deduplicated);
    } catch (problem) { setError(problem instanceof Error && problem.message !== "Failed to fetch" ? problem.message : "Enregistrement indisponible. Vos champs restent prêts pour réessayer."); }
    finally { setSaving(false); }
  }
  return <Modal title="Ajouter une opportunité" description="Collez une alerte, un post LinkedIn ou complétez les champs. Les faits absents restent à confirmer." onClose={onClose}>
    <div className="space-y-5">
      <div className="rounded-2xl bg-[#fff2eb] p-4"><div className="flex items-center justify-between gap-3"><p className="text-sm font-bold">Analyser un texte</p><button disabled={!paste.trim() || parsing} onClick={() => void parsePaste()} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#333333] px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{parsing ? <LoaderCircle size={14} className="animate-spin" /> : <Sparkles size={14} />} Préremplir</button></div><textarea value={paste} onChange={event => setPaste(event.target.value)} className="mt-3 min-h-24" placeholder="Collez le contenu de l’alerte ou du post LinkedIn ici…" /></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Intitulé *"><input value={draft.title} onChange={event => update("title", event.target.value)} placeholder="Senior Product Manager" /></Field>
        <Field label="Entreprise"><input value={draft.company} onChange={event => update("company", event.target.value)} placeholder="Nom de l’entreprise" /></Field>
        <ChoiceSelect label="Type de contrat" value={draft.contractType} onChange={value => update("contractType", value)} options={[{value:"other",label:"À confirmer"},{value:"cdi",label:"CDI"},{value:"freelance",label:"Freelance"}]} />
        <ChoiceSelect label="Source" value={draft.source} onChange={value => update("source", value)} options={sourceNames.map(value => ({value,label:value}))} />
        <Field label="Salaire annuel brut (€)"><input inputMode="numeric" value={draft.annualSalary} onChange={event => update("annualSalary", event.target.value)} placeholder="55 000" /></Field>
        <Field label="TJM HT (€)"><input inputMode="numeric" value={draft.dailyRate} onChange={event => update("dailyRate", event.target.value)} placeholder="500" /></Field>
        <ChoiceSelect label="Remote" value={draft.remoteMode} onChange={value => update("remoteMode", value)} options={[{value:"unknown",label:"À confirmer"},{value:"full_remote",label:"Full remote"},{value:"exceptional",label:"Présence exceptionnelle"},{value:"hybrid",label:"Hybride / régulier"},{value:"onsite",label:"Sur site"}]} />
        <ChoiceSelect label="Langue" value={draft.language} onChange={value => update("language", value)} options={[{value:"unknown",label:"À confirmer"},{value:"fr",label:"Français"},{value:"professional_en",label:"Anglais professionnel"},{value:"advanced_en",label:"Anglais C1/C2"}]} />
      </div>
      <Field label="Présence annoncée (à confirmer)"><input value={draft.onsiteCadence} onChange={event => update("onsiteCadence", event.target.value)} placeholder="Ex. 1 jour sur site par semaine" /></Field>
      <Field label="Lien d’origine"><input value={draft.sourceUrl} onChange={event => update("sourceUrl", event.target.value)} placeholder="https://…" /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Date de publication confirmée"><input type="date" value={draft.publishedAt} onInput={event => update("publishedAt", event.currentTarget.value)} onChange={event => update("publishedAt", event.target.value)} /></Field>
        <Field label="Lien pour postuler (si différent)"><input type="url" value={draft.applicationUrl} onChange={event => update("applicationUrl", event.target.value)} /></Field>
        <ChoiceSelect label="Niveau de détail fourni" value={draft.contentCoverage} onChange={value => update("contentCoverage", value)} options={[{value:"unknown",label:"À confirmer"},{value:"full",label:"Description complète fournie"},{value:"summary",label:"Synthèse"},{value:"partial",label:"Notification partielle"}]} />
      </div>
      <Field label="Texte de l’offre"><textarea rows={5} value={draft.description} onChange={event => update("description", event.target.value)} placeholder="Conservez les éléments qui aideront à expliquer le score et préparer la candidature." /></Field>
      {error ? <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      <div className="flex flex-wrap justify-end gap-2"><button onClick={onClose} className="min-h-11 rounded-xl px-4 py-2.5 text-sm font-semibold text-[#535768]">Annuler</button><button disabled={saving || !draft.title.trim()} onClick={() => void save()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#6161ff] px-4 py-2.5 text-sm font-bold text-[#333333] disabled:opacity-50">{saving ? <LoaderCircle size={16} className="animate-spin" /> : <Check size={16} />} Qualifier l’offre</button></div>
    </div>
  </Modal>;
}

function Modal({ title, description, meta, onClose, children }: { title: string; description: string; meta?: React.ReactNode; onClose: () => void; children: React.ReactNode }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  const titleId = useId(); const descriptionId = useId();
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") { event.preventDefault(); onCloseRef.current(); }
      if (event.key !== "Tab") return;
      const elements = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]') ?? []);
      const first = elements[0]; const last = elements.at(-1);
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialogRef.current)) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("keydown", onKeyDown); document.body.style.overflow = previousOverflow; previousFocus?.focus(); };
  }, []);
  return <div data-testid="modal-backdrop" onClick={event => { if (event.target === event.currentTarget) onClose(); }} className="fixed inset-0 z-50 flex items-end justify-center bg-[#333333]/35 p-0 backdrop-blur-md sm:items-center sm:p-6"><div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-[28px] border border-white bg-[#ffffff]/95 p-5 shadow-2xl outline-none sm:rounded-[28px] sm:p-7"><div className="mb-5 flex items-start justify-between gap-4 border-b border-[#eee7ec] pb-4"><div className="min-w-0"><h2 id={titleId} className="text-xl font-semibold leading-snug text-[#333333]">{title}</h2><p id={descriptionId} className="mt-1 max-w-xl text-sm leading-6 text-[#535768]">{description}</p>{meta ? <div className="mt-2">{meta}</div> : null}</div><button onClick={onClose} className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl text-[#535768] hover:bg-[#f5f6f8]" aria-label="Fermer"><X size={20} /></button></div>{children}</div></div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-1.5 block text-xs font-bold text-[#535768]">{label}</span>{children}</label>; }
function Toast({ message, onClose }: { message: string; onClose: () => void }) { useEffect(() => { const timeout = window.setTimeout(onClose, 4300); return () => window.clearTimeout(timeout); }, [onClose]); return <div className="fixed bottom-5 left-1/2 z-[60] flex w-[min(470px,calc(100%-32px))] -translate-x-1/2 items-center justify-between gap-4 rounded-2xl bg-[#333333] px-4 py-3 text-sm text-white shadow-xl"><span>{message}</span><button onClick={onClose} className="text-white/70 hover:text-white"><X size={16} /></button></div>; }
function LoadingState() { return <div className="grid min-h-[45vh] place-items-center"><div className="text-center"><LoaderCircle className="mx-auto animate-spin text-[#6161ff]" size={26} /><p className="mt-3 text-sm text-[#535768]">Préparation de votre radar…</p></div></div>; }
function remoteCopy(mode: JobInput["remoteMode"]) { return { full_remote: "Full remote", exceptional: "Présence exceptionnelle", hybrid: "Hybride", onsite: "Sur site", unknown: "Remote à confirmer" }[mode]; }
function payCopy(job: JobRecord) { return job.contractType === "freelance" ? job.dailyRate ? `${formatEuro(job.dailyRate)} / jour` : "TJM à confirmer" : job.contractType === "cdi" ? job.annualSalary ? `${formatEuro(job.annualSalary)} brut/an` : "Salaire à confirmer" : "À confirmer"; }
