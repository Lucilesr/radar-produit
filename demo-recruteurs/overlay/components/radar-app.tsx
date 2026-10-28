"use client";

import { AutosaveOwner } from "@/components/autosave";
import { WorkspaceFeedbackProvider, useWorkspaceFeedback, type WorkspaceFeedback } from "@/components/workspace-feedback";
import { OfferForm } from "@/components/offer-form";
import { Textarea } from "@/components/ui/textarea";

import { lazy, Suspense, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CircleHelp, RefreshCw, ShieldCheck, ClipboardCheck, ExternalLink, LayoutDashboard, LoaderCircle, Mail, Plus, Search, Trash2, Undo2, UserRound, X } from "lucide-react";
import { applyTrashState } from "@/lib/offer-trash-ui";
import { sortOffersForTriage } from "@/lib/triage";
import { hasApplication, inOpportunityView, type OpportunityView } from "@/lib/opportunity-views";
import { PageHeader, PrivateLabel, WorkspaceBrand, WorkspaceBoundary, WorkspaceLoading, WorkspaceState, useRadarNavigation } from "@/components/workspace-ui";
import { TodayWorkspace, ApplicationsWorkspace } from "@/components/today-workspace";
import { OpportunitiesWorkspace } from "@/components/opportunities-workspace";
import { ChoiceSelect } from "@/components/choice-select";
import { OfferSourceBadge, OfferWorkspace, type WorkspaceView } from "@/components/offer-workspace";
import { activeStatuses, terminalStatuses } from "@/lib/application-workflow";
import { profileTemplate } from "@/lib/profile-template";
import { OnboardingTour } from "@/components/onboarding-tour";
import type { CandidateProfile, DismissalReason, JobRecord, JobStatus } from "@/lib/types";
import type { RadarInitialState } from "@/lib/radar-bootstrap";
import type { RadarRoute, ProfileSection } from "@/lib/radar-navigation";

const ProfileWorkspace = lazy(() => import("@/components/profile-workspace").then(module => ({default: module.ProfileWorkspace})));
const SourcePanel = lazy(() => import("@/components/source-panel").then(module => ({default: module.SourcePanel})));

type Tab = "dashboard" | "offers" | "pipeline" | "profile" | "sources";
type OfferFilter = OpportunityView;


const tabs: Array<{ id: Tab; label: string; mobileLabel: string; icon: typeof LayoutDashboard }> = [
  { id: "dashboard", label: "Aujourd’hui", mobileLabel: "Accueil", icon: LayoutDashboard },
  { id: "offers", label: "Opportunités", mobileLabel: "Offres", icon: Search },
  { id: "pipeline", label: "Candidatures", mobileLabel: "Suivi", icon: ClipboardCheck },
  { id: "profile", label: "Mon profil", mobileLabel: "Profil", icon: UserRound },
  { id: "sources", label: "Sources", mobileLabel: "Sources", icon: Mail },
];
const dismissalLabels: Record<DismissalReason, string> = { filled: "Poste pourvu", applications_closed: "Candidatures fermées", not_interested: "Je ne souhaite pas postuler", other: "Autre raison" };


type RadarAppProps = { ownerId?: string; userName: string; initialState?: RadarInitialState; initialRoute?: RadarRoute; initialProfileSection?: ProfileSection };
export function RadarApp(props: RadarAppProps) { return <AutosaveOwner owner={props.ownerId??""}><WorkspaceFeedbackProvider><RadarWorkspace {...props} /></WorkspaceFeedbackProvider></AutosaveOwner>; }
function RadarWorkspace({ ownerId, userName, initialState, initialRoute, initialProfileSection }: RadarAppProps) {
  const { route, navigate } = useRadarNavigation(initialRoute);
  const { tab, filter, query, view: workspaceView } = route;
  const previousTab = useRef(tab);
  useLayoutEffect(() => {
    if (previousTab.current === tab) return;
    previousTab.current = tab;
    const reset = () => {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      document.getElementById("workspace-title")?.focus({ preventScroll: true });
    };
    reset();
    const frame = requestAnimationFrame(reset);
    return () => cancelAnimationFrame(frame);
  }, [tab]);
  const setFilter = (filter: OfferFilter) => navigate({ filter, offer: undefined });
  const setQuery = (query: string) => navigate({ query, tab: "offers", offer: undefined }, route.tab === "offers" && !!route.query);
  const searchRef = useRef<HTMLInputElement>(null);
  const [allJobs, setJobs] = useState<JobRecord[]>(initialState?.jobs ?? []);
  useEffect(()=>{const saved=(event:Event)=>{const detail=(event as CustomEvent).detail;if(detail?.owner===ownerId&&typeof detail.id==="string"&&typeof detail.value==="string")setJobs(current=>current.map(job=>job.id===detail.id?{...job,candidateNote:detail.value}:job));};window.addEventListener("radar-note-saved",saved);return()=>window.removeEventListener("radar-note-saved",saved);},[ownerId]);
  const jobs = useMemo(() => allJobs.filter(job => !job.deletedAt), [allJobs]);
  const [deleteTarget, setDeleteTarget] = useState<JobRecord[]>([]);
  const [deleteReason, setDeleteReason] = useState<DismissalReason | "">("");
  const [deleteNote, setDeleteNote] = useState("");
  const [trashBusy, setTrashBusy] = useState<string | null>(null);
  const trashLock = useRef(false);
  const [trashError, setTrashError] = useState<string | null>(null);
  const [profile, setProfile] = useState<CandidateProfile>(initialState?.profile ?? profileTemplate);
  const [profileLoaded,setProfileLoaded] = useState(!!initialState && !initialState.errors.profile);
  const [loading, setLoading] = useState(!initialState);
  const [refreshing, setRefreshing] = useState(false);
  const [jobDialogOpen, setJobDialogOpen] = useState(false);
  const selectedJob = allJobs.find(job => job.id === route.offer) || null;
  const [loadErrors, setLoadErrors] = useState(initialState?.errors ?? { jobs: false, profile: false });
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [visited, setVisited] = useState({profile:false,sources:false});
  useEffect(()=>{if(tab==="profile"||tab==="sources")setVisited(current=>({...current,[tab]:true}));},[tab]);
  const openJob = (job: JobRecord, view: WorkspaceView = "offer") => navigate({ offer: job.id, view, ...(view === "interviews" || view === "application" ? {tab: "pipeline" as Tab} : {}) });
  const closeJob = () => navigate({ offer: undefined, view: "offer" });
  const notify = useWorkspaceFeedback();
  const setToast = (message: string | null, error = false, action?: WorkspaceFeedback["action"]) => { if (message) notify({message, tone: error ? "error" : "success", action}); };
  const initials = userName.split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join("").toUpperCase() || "RP";

  useEffect(() => {
    if (initialState && loadAttempt === 0) return;
    let active = true;
    async function load() {
      setLoading(true);
      const json = async <T,>(path: string): Promise<T> => { const response = await fetch(path, {cache: "no-store", signal: AbortSignal.timeout(15000)}); if (!response.ok) throw new Error("Chargement impossible"); return response.json() as Promise<T>; };
      const [jobResult, profileResult] = await Promise.allSettled([json<{jobs:JobRecord[]}>("/api/jobs?includeDeleted=true"), json<{profile:CandidateProfile|null}>("/api/profile")]);
      if (!active) return;
      if (jobResult.status === "fulfilled") setJobs(jobResult.value.jobs);
      if (profileResult.status === "fulfilled") { setProfile(profileResult.value.profile ?? profileTemplate);setProfileLoaded(true); }
      setLoadErrors({jobs:jobResult.status === "rejected",profile:profileResult.status === "rejected"});
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [loadAttempt, initialState]);

  const stats = useMemo(() => ({
    new: jobs.filter((job) => inOpportunityView(job, "to_review")).length,
    priority: jobs.filter((job) => inOpportunityView(job, "selected")).length,
    exceptions: jobs.filter((job) => job.matchTier === "exception" && !terminalStatuses.includes(job.status)).length,
    active: allJobs.filter((job) => hasApplication(job) && activeStatuses.includes(job.status)).length,
  }), [jobs, allJobs]);

  async function updateJob(id: string, changes: { status?: JobStatus; candidateNote?: string; reviewState?: "to_review" | "selected"; boardColumnId?: string; expectedStatus?: JobStatus; expectedBoardColumnId?: string|null }) {
    try {
      const response = await fetch(`/api/jobs/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(changes) });
      if (!response.ok) throw new Error("Mise à jour impossible");
      const { job } = (await response.json()) as { job: JobRecord };
      setJobs(current => current.map(item => item.id === id ? { ...job, candidateNote: changes.candidateNote === undefined ? item.candidateNote : job.candidateNote } : item));
      if (changes.candidateNote !== undefined) setProfile(current => ({ ...current, applicationNotes: { ...current.applicationNotes, [id]: job.candidateNote ?? "" } }));
      if (changes.candidateNote !== undefined) setToast("Note enregistrée dans votre espace privé.");
      else if (changes.reviewState) setToast(changes.reviewState === "selected" ? "Offre ajoutée à ma sélection." : "Offre remise à examiner.", false, {label: changes.reviewState === "selected" ? "Voir ma sélection" : "Voir les offres à examiner", onClick: () => navigate({tab:"offers",filter:changes.reviewState === "selected" ? "selected" : "to_review",offer:undefined})});
      else if (changes.status === "applied") setToast("Cette opportunité fait maintenant partie de vos candidatures.", false, {label:"Voir ma candidature",onClick:()=>navigate({tab:"pipeline",offer:id,view:"application"})});
      else setToast("Statut enregistré.");
      return true;
    } catch { setToast("La mise à jour n’a pas été enregistrée. Vos données restent inchangées.", true); return false; }
  }
  async function changeStatus(id: string, status: JobStatus, columnId?: string) { return updateJob(id, { status, ...(columnId ? {boardColumnId: columnId, expectedStatus: allJobs.find(job=>job.id===id)?.status,expectedBoardColumnId:allJobs.find(job=>job.id===id)?.boardColumnId??null} : {}) }); }
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
      setProfile(result.profile); setToast("Profil enregistré dans cette démo."); return true;
    } catch { setToast("Le profil n’a pas été enregistré. Vos modifications restent disponibles à l’écran.", true); return false; }
  }
  function onJobCreated(job: JobRecord, deduplicated?: boolean) {
    setJobs((current) => current.some((item) => item.id === job.id) ? current : [job, ...current]);
    setJobDialogOpen(false);
    setToast(job.deletedAt ? "Cette offre est déjà dans la corbeille. Restaurez-la depuis Opportunités → Corbeille si nécessaire." : deduplicated ? "Cette opportunité était déjà dans votre radar." : "Opportunité ajoutée et qualifiée.");
  }
  const searchedJobs = allJobs.filter(job => `${job.title} ${job.company} ${job.source}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const viewCounts = Object.fromEntries((["to_review", "selected", "good_matches", "trash"] as OfferFilter[]).map(view => [view, searchedJobs.filter(job => inOpportunityView(job, view)).length])) as Record<OfferFilter, number>;
  const shownJobs = filter === "to_review" ? sortOffersForTriage(searchedJobs) : searchedJobs.filter(job => inOpportunityView(job, filter));
  function selectTab(next: Tab) { navigate({ tab: next, offer: undefined }); }

  async function refreshOffers({silent=false}:{silent?:boolean}={}) {
    if (trashLock.current) return false;
    setRefreshing(true);
    try {
      const response = await fetch("/api/jobs?includeDeleted=true", { cache: "no-store" });
      if (!response.ok) throw new Error("Lecture impossible");
      const result = await response.json() as { jobs: JobRecord[] };
      setJobs(result.jobs);
      setLoadErrors(current => ({...current,jobs:false}));
      if(!silent)setToast("Votre radar est à jour.");return true;
    } catch { if(!silent)setToast("Actualisation impossible. Vos dernières données restent affichées.", true);return false; }
    finally { setRefreshing(false); }
  }

  const loadNotice = !loading && (loadErrors.jobs || loadErrors.profile) ? <WorkspaceState error title={loadErrors.jobs ? "Les offres n’ont pas pu être chargées" : "Votre profil n’a pas pu être chargé"} action={<button type="button" className="secondary-button" onClick={() => {setLoadAttempt(n => n+1);requestAnimationFrame(()=>document.getElementById("workspace-title")?.focus());}}>Réessayer</button>}>Vérifiez votre connexion puis réessayez. Vos données sont conservées.</WorkspaceState> : null;

  return <main className="radar-app text-foreground"><a inert={jobDialogOpen || deleteTarget.length>0 || (!!selectedJob && tab!=="offers")} href="#workspace-title" className="workspace-skip">Aller au contenu</a>
    <div className="radar-shell" inert={jobDialogOpen || deleteTarget.length>0 || (!!selectedJob && tab!=="offers")}>
      <aside className="radar-sidebar">
        <div className="flex items-center justify-between gap-4 lg:block">
          <WorkspaceBrand />
          <button onClick={() => setJobDialogOpen(true)} className="radar-add-button lg:mt-8 lg:w-full" aria-label="Ajouter une offre"><Plus size={17} /><span className="hidden sm:inline">Ajouter une offre</span></button>
        </div>
        <label className="radar-search"><Search size={16} /><input ref={searchRef} aria-label="Rechercher une offre" maxLength={200} placeholder="Rechercher une offre…" value={query} onChange={event => { setQuery(event.target.value); }} /></label>

        <nav aria-label="Navigation principale" className="radar-nav">{tabs.map(({ id, label, mobileLabel, icon: Icon }) => <button key={id} data-radar-guide={"nav-" + id} onClick={() => selectTab(id)} aria-current={tab === id ? "page" : undefined} className={tab === id ? "is-active" : ""}><Icon size={18} strokeWidth={1.7} /><span className="radar-nav-label">{label}</span><span className="radar-mobile-label">{mobileLabel}</span>{id === "offers" && stats.new > 0 ? <><span className="nav-count" aria-hidden="true">{stats.new}</span><span className="sr-only">{stats.new} à examiner</span></> : null}</button>)}</nav>
        <div className="radar-sidebar-bottom">
          <button type="button" className="radar-guide-launcher" onClick={() => window.dispatchEvent(new Event("radar:open-guide"))}><CircleHelp size={16} aria-hidden />Guide de prise en main</button>
          <div className="sidebar-account"><span className="avatar">{initials}</span><span className="min-w-0 text-left"><span className="block truncate text-xs font-semibold">{userName}</span><span className="sidebar-account-caption"><span>Profil fictif</span><PrivateLabel /></span></span></div>
        </div>
      </aside>
      <section className="radar-content">

        <div className="radar-page">
        {tab!=="pipeline"?<PageHeader title={tabs.find(item => item.id === tab)?.label || "Radar Produit"}><div className="page-tools"><span className="page-header-privacy"><PrivateLabel /></span><button type="button" onClick={() => void refreshOffers()} disabled={refreshing} className="secondary-button page-refresh-action" aria-label="Actualiser les offres"><RefreshCw size={15} className={refreshing ? "animate-spin" : ""} aria-hidden /><span className="page-refresh-label">Actualiser</span></button></div></PageHeader>:null}
        {tab!=="pipeline"&&loading ? <WorkspaceLoading /> : null}
        {tab!=="pipeline"?loadNotice:null}
        {!loading && !loadErrors.jobs && tab === "dashboard" ? <TodayWorkspace jobs={allJobs} onTriage={() => navigate({tab:"offers",filter:"to_review",query:"",offer:undefined})} onSelected={() => navigate({tab:"offers",filter:"selected",query:"",offer:undefined})} onAdd={()=>setJobDialogOpen(true)} onOpen={openJob} /> : null}
        {trashBusy ? <div role="status" className="sticky top-3 z-20 mb-4 flex items-center gap-2 rounded-2xl border bg-white p-4 text-sm shadow-sm"><LoaderCircle size={16} className="animate-spin" /> Liste mise à jour · enregistrement en cours…</div> : null}
        {trashError ? <div role="alert" className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">{trashError}<button className="ml-3 underline" onClick={() => { setTrashError(null); void refreshOffers(); }}>Actualiser pour vérifier</button></div> : null}
        {!loading && !loadErrors.jobs && tab === "offers" ? <OpportunitiesWorkspace currentJob={selectedJob} jobs={shownJobs} counts={viewCounts} filter={filter} onFilter={setFilter} query={query} onClearSearch={() => {setQuery("");requestAnimationFrame(()=>searchRef.current?.focus());}} activeId={route.offer} view={workspaceView} onOpen={openJob} onClose={closeJob} profile={profile} onReview={(id,state)=>updateJob(id,{reviewState:state})} onDelete={requestDelete} onDeleteMany={requestDeleteMany} onRestore={job=>void changeTrash([job],false)} onStatus={changeStatus} onNote={(id,candidateNote)=>updateJob(id,{candidateNote})} onChange={updated=>{setJobs(current=>current.map(job=>job.id===updated.id?updated:job));setToast("Offre mise à jour.");}} onApplication={job=>navigate({tab:"pipeline",offer:job.id,view:"application"})} onViewChange={(job,view)=>navigate({offer:job.id,view})} trashBusy={!!trashBusy||refreshing} /> : null}
        {tab === "pipeline" ? <ApplicationsWorkspace placeholder={loading?<WorkspaceLoading/>:loadErrors.jobs?loadNotice:undefined} notice={!loading&&!loadErrors.jobs?loadNotice:undefined} jobs={allJobs.filter(hasApplication)} onStatus={changeStatus} onOpen={openJob} /> : null}
        {profileLoaded && (tab === "profile" || visited.profile) ? <div hidden={tab!=="profile"}><WorkspaceBoundary><Suspense fallback={<WorkspaceLoading />}><ProfileWorkspace active={tab === "profile"} initialSection={initialProfileSection} profile={profile} onSave={saveProfile} onDocumentsLinked={links => setProfile(current => ({ ...current, ...links }))} /></Suspense></WorkspaceBoundary></div> : null}
        {(tab === "sources" || visited.sources) ? <div hidden={tab!=="sources"}><WorkspaceBoundary><Suspense fallback={<WorkspaceLoading />}><SourcePanel jobs={jobs} onSynced={()=>refreshOffers({silent:true})} /></Suspense></WorkspaceBoundary></div> : null}
        {tab !== "profile" && tab !== "offers" ? <footer className="radar-footer"><span><ShieldCheck size={12} /> Démo indépendante du site privé.</span></footer> : null}
        </div>
      </section>
    </div>
    {profileLoaded ? <OnboardingTour ownerId={ownerId ?? ""} profile={profile} /> : null}
    {jobDialogOpen ? <JobDialog onClose={() => setJobDialogOpen(false)} onCreated={onJobCreated} /> : null}
    {selectedJob && tab !== "offers" ? <Modal title={selectedJob.title} description={selectedJob.company || "Entreprise à confirmer"} headerActions={<>{(selectedJob.sourceUrl || selectedJob.applicationUrl) ? <a href={selectedJob.sourceUrl || selectedJob.applicationUrl} target="_blank" rel="noopener noreferrer" className="signal-quiet-button"><ExternalLink size={14} aria-hidden />Voir l’annonce</a> : null}{selectedJob.deletedAt ? <button type="button" className="signal-quiet-button" disabled={!!trashBusy || refreshing} onClick={() => void changeTrash([selectedJob], false)}><Undo2 size={15} aria-hidden />Restaurer</button> : null}</>} meta={<OfferSourceBadge job={selectedJob} />} onClose={closeJob}><OfferWorkspace key={selectedJob.id + ":" + tab} onViewChange={view => navigate({ view })} job={selectedJob} profile={profile} initialView={workspaceView} showAnnouncement={false} context={tab === "pipeline" || (tab === "dashboard" && hasApplication(selectedJob)) ? "application" : "opportunity"} onStatus={changeStatus} onNote={(id, candidateNote) => updateJob(id, { candidateNote })} onOpenApplication={() => navigate({ tab: "pipeline", offer: selectedJob.id, view: "application" })} onChange={(updated, message) => { setJobs(current => current.map(job => job.id === updated.id ? updated : job)); setToast(message ?? "Dossier enregistré."); }} /></Modal> : null}
    {deleteTarget.length ? <Modal title={`Mettre ${deleteTarget.length === 1 ? "cette offre" : `ces ${deleteTarget.length} offres`} à la corbeille ?`} description={deleteTarget.length > 1 ? "Choisissez une raison commune à toute la sélection." : "Choisissez pourquoi vous écartez cette offre."} onClose={() => setDeleteTarget([])}><div className="trash-dialog-content"><ul className="max-h-48 space-y-2 overflow-y-auto rounded-xl bg-background p-4 text-sm">{deleteTarget.map(job => <li key={job.id}><strong>{job.title}</strong> · {job.company}</li>)}</ul><div className="trash-dialog-fields"><ChoiceSelect label="Pourquoi ?" value={deleteReason} onChange={value => setDeleteReason(value as DismissalReason | "")} options={[{ value: "", label: "Choisir un motif" }, ...Object.entries(dismissalLabels).map(([value, label]) => ({ value, label }))]} /><label className="trash-dialog-note"><span>Précision <em>facultative</em></span><Textarea rows={2} maxLength={500} value={deleteNote} onChange={event => setDeleteNote(event.target.value)} placeholder="Une courte précision, si utile" /></label></div><p className="trash-dialog-help">L’offre reste restaurable. Si une candidature est déjà engagée, elle et ses rappels restent visibles dans Candidatures.</p><div className="trash-dialog-actions"><button className="secondary-button" onClick={() => setDeleteTarget([])}>Annuler</button><button disabled={!deleteReason || !!trashBusy || refreshing} className="signal-danger-button disabled:opacity-50" onClick={() => void changeTrash(deleteTarget, true, deleteReason as DismissalReason, deleteNote)}><Trash2 size={16} /> Mettre à la corbeille{deleteTarget.length > 1 ? ` (${deleteTarget.length})` : ""}</button></div></div></Modal> : null}
  </main>;
}

function JobDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (job: JobRecord, deduplicated?: boolean) => void }) {
  return <Modal title="Ajouter une opportunité" description="Complétez les faits de l’annonce." onClose={onClose}><OfferForm onCancel={onClose} onSave={async input=>{
    const response=await fetch("/api/jobs",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)});
    const result=await response.json() as {job?:JobRecord;deduplicated?:boolean;error?:string};
    if(!response.ok||!result.job)throw new Error(result.error??"Enregistrement non confirmé. Votre saisie est conservée.");
    onCreated(result.job,result.deduplicated);
  }}/></Modal>;
}

function Modal({ title, description, meta, headerActions, onClose, children }: { title: string; description: string; meta?: React.ReactNode; headerActions?: React.ReactNode; onClose: () => void; children: React.ReactNode }) {
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
      if (event.defaultPrevented || document.querySelector('[data-slot="drawer-content"][data-state="open"], [data-slot="select-content"][data-state="open"], [data-slot="popover-content"][data-state="open"]')) return;
      if (event.key === "Escape") { event.preventDefault(); onCloseRef.current(); }
      if (event.key !== "Tab") return;
      const elements = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex], [contenteditable="true"]') ?? []).concat(Array.from(document.querySelectorAll<HTMLElement>('.signal-toast button:not(:disabled)')))
        .filter(element => element.tabIndex >= 0 && element.getClientRects().length > 0 && getComputedStyle(element).visibility !== "hidden" && !element.closest('[inert], [hidden]'));
      const first = elements[0]; const last = elements.at(-1);
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current || document.activeElement === document.body)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialogRef.current || document.activeElement === document.body)) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("keydown", onKeyDown); document.body.style.overflow = previousOverflow; requestAnimationFrame(()=>(previousFocus?.isConnected && previousFocus.getClientRects().length ? previousFocus : document.getElementById("workspace-title"))?.focus({preventScroll:true})); };
  }, []);
  return <div data-testid="modal-backdrop" onClick={event => { if (event.target === event.currentTarget) onClose(); }} className="fixed inset-0 z-50 flex items-end justify-center bg-[#333333]/35 p-0 backdrop-blur-md sm:items-center sm:p-6"><div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined} className="workspace-dialog max-h-[92dvh] w-full max-w-3xl overflow-y-auto border bg-card p-5 shadow-2xl outline-none sm:p-7"><div className="signal-dialog-header"><div className="signal-dialog-heading"><h2 id={titleId}>{title}</h2><div className="signal-dialog-identity">{description ? <p id={descriptionId}>{description}</p> : null}{meta}</div></div><div className="signal-dialog-tools">{headerActions}<button type="button" onClick={onClose} className="signal-dialog-close" aria-label="Fermer"><X size={20} aria-hidden /></button></div></div>{children}</div></div>;
}
