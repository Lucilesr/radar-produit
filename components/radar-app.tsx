"use client";

import { AutosaveOwner } from "@/components/autosave";
import { WorkspaceFeedbackProvider, useWorkspaceFeedback, type WorkspaceFeedback } from "@/components/workspace-feedback";
import { sessionWrite } from "@/lib/session-write";
import { OfferForm } from "@/components/offer-form";
import { WorkspaceButton } from "@/components/workspace-form";
// Keep profile UI in the initial module graph: an already-open tab must not
// request a removed, versioned profile chunk after a deployment.
import { ProfileWorkspace } from "@/components/profile-workspace";

import { lazy, Suspense, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CircleHelp, RefreshCw, ShieldCheck, ClipboardCheck, ExternalLink, LayoutDashboard, Plus, Search, SlidersHorizontal, Trash2, Undo2, UserRound, X } from "lucide-react";
import { applyTrashState } from "@/lib/offer-trash-ui";
import { sortOffersForTriage } from "@/lib/triage";
import { demoFriday, fridayRescue } from "@/lib/friday-rescue";
import { hasApplication, inOpportunityView, reviewState, type OpportunityView } from "@/lib/opportunity-views";
import { PageHeader, PrivateLabel, WorkspaceBrand, WorkspaceBoundary, WorkspaceLoading, WorkspaceState, useRadarNavigation } from "@/components/workspace-ui";
import { TodayWorkspace, ApplicationsWorkspace } from "@/components/today-workspace";
import { useDailyLot } from "@/components/use-daily-lot";
import { useRadarClock, refreshRadarClock } from "@/components/use-radar-clock";
import { OpportunitiesWorkspace } from "@/components/opportunities-workspace";
import { useRadarScan } from "@/components/use-radar-scan";
import { useSessionJourney } from "@/components/use-session-journey";
import { SessionStrip, SessionFinish } from "@/components/radar-session";
import { ScanWorkspace, ScanStatusLine } from "@/components/scan-workspace";
import { mergeSourceSettings, type AutomaticSource } from "@/lib/source-sync";
import { lastRefreshAt, refreshMode, shouldRefreshOnOpen } from "@/lib/refresh-schedule";
import type { SourceSetting } from "@/components/source-card";
import { TriageLearning } from "@/components/triage-learning";
import { OfferSourceBadge, OfferWorkspace, type WorkspaceView } from "@/components/offer-workspace";
import { ApplicationTagEditor } from "@/components/application-tags";
import { activeStatuses, terminalStatuses } from "@/lib/application-workflow";
import { profileTemplate } from "@/lib/profile-template";
import { hasSearchedRole, searchPreferences } from "@/lib/search-preferences";
import { OnboardingTour } from "@/components/onboarding-tour";
import { SidebarSignOut } from "@/components/account-settings";
import { DemoModeProvider } from "@/components/demo-mode";
import type { CandidateProfile, DismissalReason, JobRecord, JobStatus } from "@/lib/types";
import type { RadarInitialState } from "@/lib/radar-bootstrap";
import type { Library } from "@/components/experience-library";
import type { RadarRoute, ProfileSection } from "@/lib/radar-navigation";

const SourcePanel = lazy(() => import("@/components/source-panel").then(module => ({default: module.SourcePanel})));

type Tab = "dashboard" | "offers" | "pipeline" | "profile" | "sources";
type OfferFilter = OpportunityView;


const tabs: Array<{ id: Tab; label: string; mobileLabel: string; icon: typeof LayoutDashboard }> = [
  { id: "dashboard", label: "Aujourd’hui", mobileLabel: "Accueil", icon: LayoutDashboard },
  { id: "offers", label: "Opportunités", mobileLabel: "Offres", icon: Search },
  { id: "pipeline", label: "Candidatures", mobileLabel: "Suivi", icon: ClipboardCheck },
  { id: "profile", label: "Mon profil", mobileLabel: "Profil", icon: UserRound },
  { id: "sources", label: "Ma recherche", mobileLabel: "Recherche", icon: SlidersHorizontal },
];


type RadarAppProps = { ownerId?: string; userName: string; userEmail?: string; signOutPath?: string; initialState?: RadarInitialState; initialRoute?: RadarRoute; initialProfileSection?: ProfileSection; initialExperienceLibrary?: Library; fridayDemo?:boolean };
export function RadarApp(props: RadarAppProps) { return <DemoModeProvider enabled={!!props.ownerId?.startsWith("demo:")}><AutosaveOwner owner={props.ownerId??""}><WorkspaceFeedbackProvider><RadarWorkspace {...props} /></WorkspaceFeedbackProvider></AutosaveOwner></DemoModeProvider>; }
function RadarWorkspace({ ownerId, userName, userEmail, signOutPath = "/signout-with-chatgpt?return_to=%2F", initialState, initialRoute, initialProfileSection, initialExperienceLibrary, fridayDemo=false }: RadarAppProps) {
  const { route, navigate } = useRadarNavigation(initialRoute);
  const { tab, filter, query, view: workspaceView } = route;
  const previousTab = useRef(tab);
  const routeNow = useRef(route);
  useEffect(()=>{routeNow.current=route;},[route]);
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
  const setQuery = (query: string) => {setScanOpen(false);navigate({ query, tab: "offers", offer: undefined }, route.tab === "offers" && !!route.query);};
  const searchRef = useRef<HTMLInputElement>(null);
  const [allJobs, setJobs] = useState<JobRecord[]>(initialState?.jobs ?? []);
  const rescueClock = useRadarClock();
  const rescueOffers = useMemo(() => rescueClock ? fridayRescue(allJobs, fridayDemo && ownerId?.startsWith("demo:") ? demoFriday(new Date(rescueClock)) : new Date(rescueClock)) : [], [allJobs, rescueClock, fridayDemo, ownerId]);
  useEffect(()=>{const saved=(event:Event)=>{const detail=(event as CustomEvent).detail;if(detail?.owner===ownerId&&typeof detail.id==="string"&&typeof detail.value==="string")setJobs(current=>current.map(job=>job.id===detail.id?{...job,candidateNote:detail.value}:job));};window.addEventListener("radar-note-saved",saved);return()=>window.removeEventListener("radar-note-saved",saved);},[ownerId]);
  const jobs = useMemo(() => allJobs.filter(job => !job.deletedAt), [allJobs]);
  const [trashBusy, setTrashBusy] = useState<string | null>(null);
  const trashLock = useRef(false);
  const [trashError, setTrashError] = useState<string | null>(null);
  const [profile, setProfile] = useState<CandidateProfile>(initialState?.profile ?? profileTemplate);
  const [profileLoaded,setProfileLoaded] = useState(!!initialState && !initialState.errors.profile);
  const [loading, setLoading] = useState(!initialState);
  const [sourceHeaderTarget,setSourceHeaderTarget] = useState<HTMLDivElement|null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [jobDialogOpen, setJobDialogOpen] = useState(false);
  const [jobDialogUrl, setJobDialogUrl] = useState("");
  // Read once for the « Sources à consulter » reminder; Ma recherche keeps its own copy.
  const [loadErrors, setLoadErrors] = useState(initialState?.errors ?? { jobs: false, profile: false });
  const [sourceSettings, setSourceSettings] = useState<SourceSetting[]>([]);
  const [sourcesLoaded,setSourcesLoaded]=useState(false);
  const [sourcesError,setSourcesError]=useState(false),[sourcesAttempt,setSourcesAttempt]=useState(0);
  const [scanOpen,setScanOpen]=useState(false);
  const scanOpener=useRef<HTMLElement|null>(null),autoScanned=useRef(false);
  const acceptSources=useCallback((incoming:SourceSetting[])=>{setSourceSettings(current=>mergeSourceSettings(current,incoming));setSourcesLoaded(true);setSourcesError(false);},[setSourceSettings,setSourcesLoaded,setSourcesError]);
  const acceptOffers=useCallback((incoming:JobRecord[])=>{setJobs(incoming);setLoadErrors(current=>({...current,jobs:false}));refreshRadarClock();},[setJobs,setLoadErrors]);
  const scan=useRadarScan({onOffers:acceptOffers,onSources:acceptSources});
  useEffect(()=>{document.documentElement.dataset.motion=profile.preferences?.reducedMotion?"reduced":"full";return()=>{delete document.documentElement.dataset.motion;};},[profile.preferences?.reducedMotion]);
  const selectedJob = allJobs.find(job => job.id === route.offer) || null;
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [visited, setVisited] = useState({profile:false,sources:false});
  useEffect(()=>{if(tab==="profile"||tab==="sources")setVisited(current=>({...current,[tab]:true}));},[tab]);
  // The reminder needs the sources; Ma recherche loads and writes its own copy.
  useEffect(()=>{let alive=true;fetch("/api/sources",{signal:AbortSignal.timeout(15000),cache:"no-store"}).then(async response=>{if(!response.ok)throw new Error();const data=await response.json() as {sources:typeof sourceSettings};if(!Array.isArray(data.sources))throw new Error();if(alive)acceptSources(data.sources);}).catch(()=>{if(alive){setSourcesError(true);setSourcesLoaded(true);}});return()=>{alive=false;};},[acceptSources,sourcesAttempt]);
  /** Opens « Ma recherche » on one source, which reads these parameters when it appears. */
  const openSource = (name: string) => {
    setScanOpen(false);
    const url = new URL(window.location.href);
    url.searchParams.set("sources", "channels");
    url.searchParams.set("source", name);
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    navigate({ tab: "sources" });
  };
  const openJob = (job: JobRecord, view: WorkspaceView = "offer") => navigate({ offer: job.id, view, ...(view === "interviews" || view === "application" ? {tab: "pipeline" as Tab} : {}) });
  const closeJob = () => navigate({ offer: undefined, view: "offer" });
  const notify = useWorkspaceFeedback();
  const setToast = (message: string | null, error = false, action?: WorkspaceFeedback["action"]) => { if (message) notify({message, tone: error ? "error" : "success", action}); };
  const roleChosen = hasSearchedRole(searchPreferences(profile.searchPreferences));
  function closeScan(){setScanOpen(false);requestAnimationFrame(()=>{const previous=scanOpener.current;(previous?.isConnected&&previous.getClientRects().length?previous:document.getElementById("workspace-title"))?.focus({preventScroll:true});});}
  async function runScan(source?:AutomaticSource,quiet=false){
    if(trashLock.current)return false;
    if(!roleChosen){navigate({tab:"sources",offer:undefined});setToast("Choisissez d’abord le poste que vous cherchez dans Ma recherche.",true);return false;}
    autoScanned.current=true;
    if(!quiet){scanOpener.current=document.activeElement instanceof HTMLElement?document.activeElement:null;setScanOpen(true);}
    const saved=await scan.run(source);
    if(quiet&&!saved)setToast("Actualisation non confirmée. Consultez Ma recherche pour réessayer ; vos offres restent conservées.",true);
    return saved;
  }
  useEffect(()=>{
    if(!profileLoaded||!sourcesLoaded||sourcesError||!roleChosen||ownerId?.startsWith("demo:")||autoScanned.current)return;
    if(shouldRefreshOnOpen(refreshMode(profile.refreshMode),lastRefreshAt(sourceSettings)))void runScan(undefined,true);
  },[profileLoaded,sourcesLoaded,sourcesError,roleChosen,ownerId,profile.refreshMode,sourceSettings,runScan]);
  useEffect(()=>{if(!scanOpen)return;const key=(event:KeyboardEvent)=>{if(event.key==="Escape"&&!document.querySelector('[role="dialog"]'))closeScan();};window.addEventListener("keydown",key);return()=>window.removeEventListener("keydown",key);},[scanOpen]);

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

  async function updateJob(id: string, changes: { status?: JobStatus; candidateNote?: string; reviewState?: "to_review" | "selected" | "later"; boardColumnId?: string; expectedStatus?: JobStatus; expectedBoardColumnId?: string|null }) {
    const writeKey=crypto.randomUUID();sessionWrite(writeKey,true);
    const previousJob = allJobs.find(job => job.id === id);
    if (changes.reviewState || changes.status === "applied") lockDailyLot();
    try {
      const response = await fetch(`/api/jobs/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(changes), signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error("Mise à jour impossible");
      const { job } = (await response.json()) as { job: JobRecord };
      refreshRadarClock();
      setJobs(current => current.map(item => item.id === id ? changes.reviewState ? { ...item, reviewState: job.reviewState, updatedAt: job.updatedAt ?? item.updatedAt } : { ...job, candidateNote: changes.candidateNote === undefined ? item.candidateNote : job.candidateNote } : item));
      if (changes.candidateNote !== undefined) setProfile(current => ({ ...current, applicationNotes: { ...current.applicationNotes, [id]: job.candidateNote ?? "" } }));
      if (changes.candidateNote !== undefined) setToast("Note enregistrée dans votre espace privé.");
      else if (changes.reviewState === "later") setToast("Offre gardée pour plus tard, dans la réserve.");
      else if (changes.reviewState) setToast(changes.reviewState === "selected" ? "Offre ajoutée à ma sélection." : "Offre remise à examiner.", false, {label: changes.reviewState === "selected" ? "Voir ma sélection" : "Voir les offres à examiner", onClick: () => navigate({tab:"offers",filter:changes.reviewState === "selected" ? "selected" : "to_review",offer:undefined})});
      else if (changes.status === "applied") setToast("Cette opportunité fait maintenant partie de vos candidatures.", false, {label:"Annuler",onClick:()=>void cancelApplication(id,previousJob&&reviewState(previousJob)==="selected"?"selected":"to_review")});
      else setToast("Statut enregistré.");
      return true;
    } catch {
      setToast("La mise à jour n’a pas été enregistrée. Vos données restent inchangées.", true); return false;
    } finally {sessionWrite(writeKey,false);}
  }
  async function changeStatus(id: string, status: JobStatus, columnId?: string) { return updateJob(id, { status, ...(columnId ? {boardColumnId: columnId, expectedStatus: allJobs.find(job=>job.id===id)?.status,expectedBoardColumnId:allJobs.find(job=>job.id===id)?.boardColumnId??null} : {}) }); }
  async function cancelApplication(id: string, fromToast?: "selected"|"to_review") {
    const job=allJobs.find(item=>item.id===id);
    if (!fromToast && (!job || job.status!=="applied" || job.interviews?.length)) return false;
    const destination=fromToast??(job&&reviewState(job)==="selected"?"selected":"to_review");
    const saved=await updateJob(id,{status:destination==="selected"?"shortlist":"new",expectedStatus:"applied"});
    if(saved){navigate({tab:"offers",filter:destination,offer:undefined,view:"offer"});setToast("Candidature annulée. L’offre est revenue dans sa liste.");}
    return saved;
  }
  async function requestDelete(job: JobRecord, next?: JobRecord) {
    if (trashLock.current || refreshing) return;
    lockDailyLot();
    const before=route;
    if (await changeTrash([job], true) && routeNow.current.tab===before.tab && routeNow.current.filter===before.filter && routeNow.current.offer===before.offer && routeNow.current.query===before.query) navigate({offer:next?.id,view:"offer"});
  }
  function requestDeleteMany(selection: JobRecord[]) { if (trashLock.current || refreshing) return; closeJob(); void changeTrash(selection, true); }
  async function changeTrash(selection: JobRecord[], deleted: boolean) {
    if (trashLock.current || refreshing || !selection.length) return false;
    trashLock.current = true; setTrashBusy(selection[0].id); setTrashError(null);
    if (deleted) lockDailyLot();
    try {
      const response = await fetch("/api/jobs/trash", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: selection.map(job => job.id), deleted }), signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw new Error("Enregistrement non confirmé");
      const { results } = await response.json() as { results: { id: string; deletedAt: string | null; dismissalReason?: DismissalReason; dismissalNote?: string }[] };
      const confirmed = new Set(results.map(item => item.id));
      refreshRadarClock();
      const missing = selection.filter(job => !confirmed.has(job.id));
      setJobs(current => applyTrashState(current, results));
      if (missing.length) setTrashError(`${missing.length} offre(s) non confirmée(s), restée(s) dans leur liste. Actualisez avant de réessayer.`);
      if (results.length) setToast(deleted ? `${results.length} ${results.length === 1 ? "offre supprimée" : "offres supprimées"}. Restauration possible dans Corbeille.` : `${results.length} ${results.length === 1 ? "offre restaurée" : "offres restaurées"}, avec les notes et entretiens.`);
      return !missing.length;
    } catch {
      setTrashError("Enregistrement non confirmé : les offres restent affichées. Réessayez ou actualisez pour vérifier. Aucun contenu n’est effacé définitivement.");
      return false;
    } finally { trashLock.current = false; setTrashBusy(null); }
  }
  async function saveProfile(next: CandidateProfile) {
    try {
      const response = await fetch("/api/profile", {signal:AbortSignal.timeout(15000), method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });
      if (!response.ok) throw new Error("Enregistrement impossible");
      const result = await response.json() as { profile: CandidateProfile };
      refreshRadarClock();
      setProfile(result.profile); setToast("Profil enregistré dans votre espace privé."); return true;
    } catch { setToast("Le profil n’a pas été enregistré. Vos modifications restent disponibles à l’écran.", true); return false; }
  }
  async function saveSearch(next: CandidateProfile) {
    const saved = await saveProfile(next);
    if (!saved) return false;
    await refreshOffers({silent:true});
    return true;
  }
  function onJobCreated(job: JobRecord, deduplicated?: boolean) {
    setJobs((current) => current.some((item) => item.id === job.id) ? current : [job, ...current]);
    setJobDialogOpen(false);
    setToast(job.deletedAt ? "Cette offre est déjà dans la corbeille. Restaurez-la depuis Opportunités → Corbeille si nécessaire." : deduplicated ? "Cette opportunité était déjà dans votre radar." : "Opportunité ajoutée et qualifiée.");
  }
  const { lot: dailyLot, lock: lockDailyLot } = useDailyLot(allJobs, !loading && !loadErrors.jobs, ownerId);
  const journey=useSessionJourney({ready:sourcesLoaded&&!loading&&!loadErrors.jobs,owner:ownerId??"",jobs:allJobs,lot:dailyLot,sources:sourceSettings,initialLibrary:initialExperienceLibrary,now:rescueClock,onNavigate:(step,target)=>{
    setScanOpen(false);
    if(target==="home"){navigate({tab:"dashboard",offer:undefined});return;}
    if(step==="triage")navigate({tab:"offers",filter:"to_review",query:"",offer:undefined});
    else if(step==="followups")navigate({tab:"pipeline",offer:undefined,view:"application"});
    else if(step==="sources"){if(target)openSource(target);else navigate({tab:"sources",offer:undefined});}
    else {navigate({tab:"profile",offer:undefined});const url=new URL(window.location.href);url.searchParams.set("profile","experiences");window.history.replaceState(null,"",url);window.dispatchEvent(new PopStateEvent("popstate"));requestAnimationFrame(()=>document.getElementById("experience-title")?.focus());}
  }});
  const searchedJobs = allJobs.filter(job => `${job.title} ${job.company} ${job.source}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const viewCounts = Object.fromEntries((["to_review", "selected", "good_matches", "trash", "archived"] as OfferFilter[]).map(view => [view, searchedJobs.filter(job => inOpportunityView(job, view)).length])) as Record<OfferFilter, number>;
  const shownJobs = filter === "to_review" ? sortOffersForTriage(searchedJobs) : searchedJobs.filter(job => inOpportunityView(job, filter));
  function selectTab(next: Tab) { setScanOpen(false);navigate({ tab: next, offer: undefined }); }

  async function refreshOffers({silent=false}:{silent?:boolean}={}) {
    if (trashLock.current) return false;
    setRefreshing(true);
    try {
      const response = await fetch("/api/jobs?includeDeleted=true", {signal:AbortSignal.timeout(15000), cache: "no-store" });
      if (!response.ok) throw new Error("Lecture impossible");
      const result = await response.json() as { jobs: JobRecord[] };
      setJobs(result.jobs);
      const currentRoute=routeNow.current;
      if(currentRoute.tab==="offers"&&currentRoute.offer&&!result.jobs.some(job=>job.id===currentRoute.offer&&inOpportunityView(job,currentRoute.filter))){navigate({offer:undefined,view:"offer"});requestAnimationFrame(()=>document.getElementById("workspace-title")?.focus());}
      setLoadErrors(current => ({...current,jobs:false}));
      if(!silent)setToast("Votre radar est à jour.");return true;
    } catch { if(!silent)setToast("Actualisation impossible. Vos dernières données restent affichées.", true);return false; }
    finally { setRefreshing(false); }
  }

  const loadNotice = !loading && (loadErrors.jobs || loadErrors.profile) ? <WorkspaceState error title={loadErrors.jobs ? "Les offres n’ont pas pu être chargées" : "Votre profil n’a pas pu être chargé"} action={<button type="button" className="secondary-button" onClick={() => {setLoadAttempt(n => n+1);requestAnimationFrame(()=>document.getElementById("workspace-title")?.focus());}}>Réessayer</button>}>Vérifiez votre connexion puis réessayez. Vos données sont conservées.</WorkspaceState> : null;

  return <main className="radar-app text-foreground"><a inert={jobDialogOpen || (!!selectedJob && tab!=="offers")} href="#workspace-title" className="workspace-skip">Aller au contenu</a>
    <div className="radar-shell" inert={jobDialogOpen || (!!selectedJob && tab!=="offers")}>
      <aside className="radar-sidebar">
        <div className="flex items-center justify-between gap-4 lg:block">
          <button type="button" className="radar-home-link" aria-label="Radar — revenir à Aujourd’hui" onClick={() => selectTab("dashboard")}><WorkspaceBrand /></button>
          <div className="radar-header-actions"><button type="button" className="radar-mobile-guide-launcher secondary-button" aria-label="Guide de prise en main" onClick={() => window.dispatchEvent(new Event("radar:open-guide"))}><CircleHelp size={18} aria-hidden/></button>
          <button onClick={() => setJobDialogOpen(true)} className="radar-add-button lg:mt-8 lg:w-full" aria-label="Ajouter une offre"><Plus size={17} /><span className="hidden sm:inline">Ajouter une offre</span></button>
          </div>
        </div>
        <label className="radar-search"><Search size={16} /><input ref={searchRef} aria-label="Rechercher une offre" maxLength={200} placeholder="Rechercher une offre…" value={query} onChange={event => { setQuery(event.target.value); }} /></label>

        <nav aria-label="Navigation principale" className="radar-nav">{tabs.map(({ id, label, mobileLabel, icon: Icon }) => <button key={id} data-radar-guide={"nav-" + id} onClick={() => selectTab(id)} aria-current={tab === id ? "page" : undefined} className={tab === id ? "is-active" : ""}><Icon size={18} strokeWidth={1.7} /><span className="radar-nav-label">{label}</span><span className="radar-mobile-label">{mobileLabel}</span>{id === "offers" && (roleChosen || !profileLoaded) && stats.new > 0 ? <><span className="nav-count" aria-hidden="true">{stats.new}</span><span className="sr-only">{stats.new} à examiner</span></> : null}</button>)}</nav>
        <div className="radar-sidebar-bottom">
          <button type="button" className="radar-guide-launcher" onClick={() => window.dispatchEvent(new Event("radar:open-guide"))}><CircleHelp size={16} aria-hidden />Guide de prise en main</button>
          <div className="sidebar-account"><span className="avatar">{initials}</span><span className="min-w-0 text-left"><span className="block truncate text-xs font-semibold">{userName}</span><span className="sidebar-account-caption"><span>Espace personnel</span><PrivateLabel /></span></span><SidebarSignOut demo={!!ownerId?.startsWith("demo:")} signOutPath={signOutPath} /></div>
        </div>
      </aside>
      <section className="radar-content">

        <div className="radar-page">
        {journey.session&&!journey.session.paused?<SessionStrip session={journey.session} onOpen={journey.open} onNext={journey.next} onQuit={journey.finish} onPause={journey.pause} busy={!!trashBusy||refreshing||journey.writing}/>:null}
        {journey.session&&!journey.session.paused&&journey.session.steps[journey.session.current]==="followups"?<section className="radar-session-strip" aria-label="Relances de la séance"><h2>Les relances arrivées à échéance</h2><p className="signal-help">Radar n’envoie aucun message. Après votre envoi, confirmez-le pour le bilan de cette séance.</p>{journey.due.map(entry=><div className="radar-session-actions" key={entry.id}><span>{entry.job.company||entry.job.title}</span><WorkspaceButton onClick={()=>openJob(entry.job,"application")}>Ouvrir la candidature</WorkspaceButton><WorkspaceButton onClick={()=>journey.confirmFollowup(entry.id)}>J’ai fait cette relance</WorkspaceButton></div>)}{!journey.due.length?<p>Les relances de cette étape sont faites.</p>:null}</section>:null}
        {scanOpen||tab!=="pipeline"?<PageHeader title={scanOpen?"Balayage":tabs.find(item => item.id === tab)?.label || "Radar Produit"}><div className="page-tools"><span className="page-header-privacy"><PrivateLabel /></span>{tab==="sources"&&!scanOpen?<div id="source-refresh-header" ref={setSourceHeaderTarget}/>:<button type="button" onClick={() => void runScan()} disabled={refreshing||scan.busy||!roleChosen} aria-busy={scan.busy||undefined} className="secondary-button page-refresh-action" aria-label="Actualiser les offres"><RefreshCw size={15} className={scan.busy ? "animate-spin" : ""} aria-hidden /><span className="page-refresh-label">Actualiser</span></button>}</div></PageHeader>:null}
        {scanOpen?<ScanWorkspace sourcesKnown={sourcesLoaded&&!sourcesError} busy={scan.busy} error={scan.error} result={scan.result} sources={sourceSettings} knownCount={jobs.length} toReviewCount={viewCounts.to_review} simulated={!!ownerId?.startsWith("demo:")} now={rescueClock} onRun={source=>void runScan(source)} onClose={closeScan} onOffers={()=>{setScanOpen(false);navigate({tab:"offers",filter:"to_review",query:"",offer:undefined});requestAnimationFrame(()=>document.getElementById("workspace-title")?.focus());}} onSource={openSource}/>:null}
        <div hidden={scanOpen}>
        {tab!=="pipeline"&&loading ? <WorkspaceLoading /> : null}
        {tab!=="pipeline"?loadNotice:null}
        {!loading && !loadErrors.jobs && tab === "dashboard" ? <TodayWorkspace sessionAction={{ready:journey.ready,minutes:journey.minutes,available:journey.steps.length>0,resumable:!!journey.session,onStart:journey.start}} sessionNotice={<>{sourcesError?<WorkspaceState error title="Sources indisponibles">Leurs visites ne sont pas incluses ; les offres déjà chargées restent utilisables.<WorkspaceButton onClick={()=>{setSourcesLoaded(false);setSourcesAttempt(value=>value+1);}}>Réessayer</WorkspaceButton></WorkspaceState>:null}{journey.factsError?<WorkspaceState error title="Carnet indisponible">{journey.factsError}<button className="secondary-button" onClick={()=>void journey.retryFacts()}>Réessayer</button></WorkspaceState>:null}</>} manualRefresh={profile.refreshMode==="manual"} radarLine={<ScanStatusLine sources={sourceSettings} busy={scan.busy} hasResult={!!scan.result} onOpen={()=>{if(scan.result){scanOpener.current=document.activeElement instanceof HTMLElement?document.activeElement:null;setScanOpen(true);}else void runScan();}}/>} setupRequired={profileLoaded&&!roleChosen} onConfigureSearch={()=>navigate({tab:"sources",offer:undefined})} jobs={allJobs} lot={dailyLot} sources={sourceSettings} onOpenSource={openSource} onTriage={() => navigate({tab:"offers",filter:"to_review",query:"",offer:undefined})} onSelected={() => navigate({tab:"offers",filter:"selected",query:"",offer:undefined})} onAdd={()=>setJobDialogOpen(true)} onOpen={openJob} /> : null}
        {trashError ? <div role="alert" className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">{trashError}<button className="ml-3 underline" onClick={() => { setTrashError(null); void refreshOffers(); }}>Actualiser pour vérifier</button></div> : null}
        {!loading && !loadErrors.jobs && tab === "offers" && profileLoaded && !roleChosen ? <WorkspaceState title="Quel poste cherchez-vous ?" action={<button type="button" className="secondary-button" onClick={() => navigate({ tab: "sources" })}>Choisir mon poste</button>}>Radar classe les offres selon le poste que vous visez. Indiquez-le dans Ma recherche pour voir vos opportunités.</WorkspaceState> : null}
        {!loading && !loadErrors.jobs && tab === "offers" && filter === "to_review" && !query && roleChosen ? <TriageLearning jobs={allJobs} profile={profile} now={rescueClock} onSaveProfile={saveProfile} onSaveSearch={saveSearch}/> : null}
        {!loading && !loadErrors.jobs && tab === "offers" && (!profileLoaded || roleChosen) ? <OpportunitiesWorkspace enabled={!scanOpen} onReload={()=>refreshOffers({silent:true})} rescueOffers={rescueOffers} currentJob={selectedJob} jobs={shownJobs} lot={dailyLot} counts={viewCounts} filter={filter} onFilter={setFilter} query={query} onClearSearch={() => {setQuery("");requestAnimationFrame(()=>searchRef.current?.focus());}} activeId={route.offer} view={workspaceView} onOpen={openJob} onClose={closeJob} profile={profile} onReview={(id,state)=>updateJob(id,{reviewState:state})} onDelete={requestDelete} onDeleteMany={requestDeleteMany} onRestore={job=>changeTrash([job],false)} onStatus={changeStatus} onNote={(id,candidateNote)=>updateJob(id,{candidateNote})} onChange={updated=>{setJobs(current=>current.map(job=>job.id===updated.id?updated:job));setToast("Offre mise à jour.");}} onApplication={job=>navigate({tab:"pipeline",offer:job.id,view:"application"})} onViewChange={(job,view)=>navigate({offer:job.id,view})} trashBusy={!!trashBusy||refreshing||scan.busy} /> : null}
        {tab === "pipeline" ? <ApplicationsWorkspace placeholder={loading?<WorkspaceLoading/>:loadErrors.jobs?loadNotice:undefined} notice={!loading&&!loadErrors.jobs?loadNotice:undefined} jobs={allJobs.filter(hasApplication)} onStatus={changeStatus} onOpen={openJob} /> : null}
        {profileLoaded && (tab === "profile" || visited.profile) ? <div hidden={tab!=="profile"}><WorkspaceBoundary><Suspense fallback={<WorkspaceLoading />}><ProfileWorkspace account={{ ownerId: ownerId ?? "", userName, email: userEmail, demo: !!ownerId?.startsWith("demo:"), signOutPath }} active={tab === "profile"} initialSection={initialProfileSection} initialExperienceLibrary={initialExperienceLibrary} profile={profile} onDocumentsLinked={links => setProfile(current => ({ ...current, ...links }))} /></Suspense></WorkspaceBoundary></div> : null}
        {profileLoaded && (tab === "sources" || visited.sources) ? <div hidden={tab!=="sources"}><WorkspaceBoundary><Suspense fallback={<WorkspaceLoading />}><SourcePanel sessionWriting={journey.writing} onQuitSession={journey.session&&!journey.session.paused?journey.finish:undefined} headerTarget={sourceHeaderTarget} active={tab==="sources"} jobs={jobs} profile={profile} onSave={saveSearch} onSync={quiet=>runScan(undefined,quiet)} syncBusy={scan.busy} syncError={scan.error} syncedSettings={sourceSettings} onSettingsChanged={acceptSources} onAddOffer={url=>{setJobDialogUrl(url);setJobDialogOpen(true);}} /></Suspense></WorkspaceBoundary></div> : null}
        {tab !== "profile" && tab !== "offers" ? <footer className="radar-footer"><span><ShieldCheck size={12} /> Vos données restent privées.</span></footer> : null}
        </div>
        </div>
      </section>
    </div>
    {profileLoaded&&!scanOpen&&!(journey.session&&!journey.session.paused) ? <OnboardingTour ownerId={ownerId ?? ""} profile={profile} activeTab={tab} onNavigate={selectTab} initialHasFact={initialExperienceLibrary?.items.some(item => item.validation === "approved")} /> : null}
    <SessionFinish result={journey.finished} gem={allJobs.find(job=>job.id===journey.finished?.gemId)} tomorrow={journey.tomorrow} onClose={journey.closeFinish} onGem={()=>{const gem=allJobs.find(job=>job.id===journey.finished?.gemId);journey.closeFinish();if(gem)navigate({tab:"offers",filter:"selected",offer:gem.id,view:"offer"});}}/>
    {jobDialogOpen ? <JobDialog initialUrl={jobDialogUrl} onClose={() => { setJobDialogOpen(false); setJobDialogUrl(""); }} onCreated={onJobCreated} /> : null}
    {selectedJob && tab !== "offers" ? <Modal title={selectedJob.title} description={selectedJob.company || "Entreprise à confirmer"} headerActions={<>{journey.session&&!journey.session.paused?<WorkspaceButton className="session-dialog-exit" disabled={journey.writing} onClick={journey.finish}>Quitter la séance</WorkspaceButton>:null}{(selectedJob.sourceUrl || selectedJob.applicationUrl) ? <a href={selectedJob.sourceUrl || selectedJob.applicationUrl} target="_blank" rel="noopener noreferrer" className="signal-quiet-button"><ExternalLink size={14} aria-hidden />Voir l’annonce</a> : null}{selectedJob.deletedAt ? <button type="button" className="signal-quiet-button" disabled={!!trashBusy || refreshing} onClick={() => void changeTrash([selectedJob], false)}><Undo2 size={15} aria-hidden />Restaurer</button> : null}{tab === "pipeline" || (tab === "dashboard" && hasApplication(selectedJob)) ? <ApplicationTagEditor key={selectedJob.id} jobId={selectedJob.id}/> : null}</>} meta={<OfferSourceBadge job={selectedJob} />} onClose={closeJob}><OfferWorkspace key={selectedJob.id + ":" + tab} onViewChange={view => navigate({ view })} job={selectedJob} profile={profile} initialView={workspaceView} showAnnouncement={false} context={tab === "pipeline" || (tab === "dashboard" && hasApplication(selectedJob)) ? "application" : "opportunity"} onStatus={changeStatus} onNote={(id, candidateNote) => updateJob(id, { candidateNote })} onOpenApplication={() => navigate({ tab: "pipeline", offer: selectedJob.id, view: "application" })} onCancelApplication={() => cancelApplication(selectedJob.id)} onChange={(updated, message) => { setJobs(current => current.map(job => job.id === updated.id ? updated : job)); setToast(message ?? "Dossier enregistré."); }} /></Modal> : null}
  </main>;
}

function JobDialog({ initialUrl = "", onClose, onCreated }: { initialUrl?: string; onClose: () => void; onCreated: (job: JobRecord, deduplicated?: boolean) => void }) {
  return <Modal title="Ajouter une opportunité" description="Complétez les faits de l’annonce." onClose={onClose}><OfferForm draftKey={initialUrl?`offer-from-source`:""} job={initialUrl?{title:"",contractType:"other",remoteMode:"unknown",language:"fr",source:"Autre",sourceUrl:initialUrl}:undefined} onCancel={onClose} onSave={async input=>{
    const response=await fetch("/api/jobs",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(input),signal:AbortSignal.timeout(15000)});
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
