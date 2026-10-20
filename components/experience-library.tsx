"use client";

import { ExpandableSection, revealCollapsibleAncestors } from "@/components/expandable-section";

import { LoadingSkeleton } from "@/components/loading-skeleton";

import { Textarea } from "@/components/ui/textarea";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Check, FileClock, LoaderCircle, Plus, Undo2 } from "lucide-react";
import { structuredReview, nextReviewTarget, contextPassages, replaceContextPassage, replaceDocumentedField, reviewIssues, currentItems, detailHeading, emptyData, experienceHeading, isContextOnly, isSensitiveDetail, itemStatus, sectionType, type ExperienceItem, type ItemData, type ExperienceConflict, type ReviewIssue } from "@/lib/experience-domain";
import { extractDocument } from "@/lib/extract-document";
import { ChoiceSelect } from "@/components/choice-select";

type Document = { id: string; originalName: string; createdAt?: string };
type Library = { items: ExperienceItem[]; conflicts: ExperienceConflict[]; extractions: { id: string; documentId: string; status: string; issue: string }[]; reference?: { documentId: string; name: string; createdAt: string } | null };
type Revision = { version: number; snapshot: ExperienceItem; action: string; createdAt: string };
type Fields = Pick<ItemData, "title" | "organization" | "role" | "period" | "context" | "contribution" | "result" | "claimKey">;
type EditFields = Fields & Pick<ItemData, "reviewModel" | "reviewPoints">;
type Command = Record<string, unknown>;
type FocusTarget = ReviewIssue & { nonce: number };
class RequestError extends Error { constructor(message: string, public issues: ReviewIssue[] = []) { super(message); } }
const inputClass = "w-full rounded-xl border border-[#d0d4e4] bg-white/80 p-2 text-sm";
const fieldNames: Record<keyof Fields, string> = { title: "Titre", organization: "Entreprise", role: "Poste", period: "Période", context: "Contexte / détails documentés", contribution: "Ma contribution personnelle", result: "Résultats et limites documentés", claimKey: "Sujet comparable (facultatif)" };
const fieldsOnly = (data: ItemData): Fields => Object.fromEntries(Object.keys(fieldNames).map(k => [k, data[k as keyof Fields]])) as Fields;
const selectedVersions = (items: ExperienceItem[]) => items.map(({ id, version }) => ({ id, version }));

async function read<T = Library>(path: string, body?: unknown): Promise<T> {
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const r = await fetch(path, { ...(body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : { cache: "no-store" as const }), signal: controller.signal });
    const data = await r.json() as T & { error?: string; issues?: ReviewIssue[] };
    if (!r.ok) throw new RequestError(data.error || "Opération non confirmée.", data.issues);
    return data;
  } finally { clearTimeout(timeout); }
}

export function ExperienceLibrary({ documentId, onOpenDocuments }: { documentId?: string; onOpenDocuments?: () => void }) {
  const documentHistory = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<Library>({ items: [], conflicts: [], extractions: [] });
  const [docs, setDocs] = useState<Document[]>([]), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  const [error, setError] = useState(""), [notice, setNotice] = useState(""), [selected, setSelected] = useState<string[]>([]);
  const [filter, setFilter] = useState("active"), [search, setSearch] = useState(""), [adding, setAdding] = useState(false), [addingTo, setAddingTo] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"approved" | "rejected" | null>(null), [reason, setReason] = useState("hidden"), [duplicateOf, setDuplicateOf] = useState("");
  const [usage, setUsage] = useState({ applicationAllowed: false, publicProfileAllowed: false });
  const [consentPrompt,setConsentPrompt]=useState<{id:string;version:number;title:string}[]>([]);
  const [showConsentManager,setShowConsentManager]=useState(false);
  const consentDialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const dialog=consentDialog.current;if(!dialog)return;if(consentPrompt.length&&!dialog.open)dialog.showModal();else if(!consentPrompt.length&&dialog.open)dialog.close();},[consentPrompt]);
  const locked = useRef(false), pending = useRef<{ key: string; requestId: string } | null>(null);
  const reviewPanel = useRef<HTMLDivElement>(null);
  const [editing,setEditing]=useState<string[]>([]);
  const editingChanged=useCallback((id:string,open:boolean)=>setEditing(ids=>open?(ids.includes(id)?ids:[...ids,id]):ids.includes(id)?ids.filter(i=>i!==id):ids),[]);
  const [issues, setIssues] = useState<ReviewIssue[]>([]), [focusTarget, setFocusTarget] = useState<FocusTarget>();
  function correct(issue: ReviewIssue) { setFilter("active"); setSearch(""); setFocusTarget({ ...issue, nonce: Date.now() }); }
  const [navigation,setNavigation]=useState<{id:string|null;nonce:number}>();
  useEffect(()=>{
    if(!navigation||consentPrompt.length)return;
    const frame=requestAnimationFrame(()=>{
      if(navigation.id===null){document.getElementById("experience-title")?.focus({preventScroll:true});window.scrollTo({top:0,behavior:"smooth"});return;}
      const element=document.getElementById("review-"+navigation.id);
      revealCollapsibleAncestors(element);
      requestAnimationFrame(()=>{(element?.querySelector<HTMLElement>("[data-slot=collapsible-trigger]")??element)?.focus({preventScroll:true});element?.scrollIntoView({block:"start",behavior:"smooth"});});
    });
    return()=>cancelAnimationFrame(frame);
  },[navigation,consentPrompt.length]);

  useEffect(() => {
    let live = true;
    setLoading(true); setSelected([]); setConfirm(null);
    Promise.all([read("/api/experiences"), read<{ documents: Document[] }>("/api/documents")])
      .then(async ([s, d]) => {
        if (!live) return; setState(s); setDocs(d.documents);
        const reference = d.documents.find(doc => doc.id === s.reference?.documentId);
        // A new detailed document is enough: no second extraction chore.
        if (reference && !s.extractions.some(e => e.documentId === reference.id)) {
          setNotice("Lecture de la dernière version du document détaillé…");
          const r = await fetch("/api/documents/" + reference.id);
          if (!r.ok) throw new Error("Le dernier document est indisponible. L’historique est conservé.");
          const extraction = await extractDocument(reference.originalName, await r.arrayBuffer());
          const next = await read("/api/experiences", { action: "extract", extraction: { documentId: reference.id, ...extraction } });
          if (live) { setState(next); setNotice(extraction.status === "extracted" ? "Document chargé. Nouveaux éléments à relire." : extraction.issue); }
        }
      }).catch(e => { if (live) setError(e.message); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [documentId]);

  async function act(body: Command) {
    if (locked.current) return false;
    if (body.action === "review" && body.validation === "approved") {
      const ids = (body.selection as {id:string}[]).map(i => i.id);
      const found = state.items.filter(i => ids.includes(i.id)).flatMap(i=>reviewIssues({...i,data:structuredReview(i.data)}));
      setIssues(found);
      if (found.length) { setError("Validation non effectuée : corrigez les passages indiqués ci-dessous. Les limites réelles doivent rester documentées."); return false; }
    }
    locked.current = true; setBusy(true); setError(""); setNotice("");
    const retryable = ["create", "edit", "review", "restore", "usage", "applicationConsent"].includes(String(body.action));
    const key = JSON.stringify(body);
    if (retryable && pending.current?.key !== key) pending.current = { key, requestId: crypto.randomUUID() };
    const payload = retryable ? { ...body, requestId: pending.current!.requestId } : body;
    try {
      let next: Library;
      try { next = await read("/api/experiences", payload); }
      catch (e) {
        if (!retryable || !(e instanceof Error) || !["AbortError", "TypeError"].includes(e.name)) throw e;
        setNotice("Connexion interrompue : vérification de l’enregistrement, sans appliquer deux fois l’action…");
        next = await read("/api/experiences", payload);
      }
      setState(next); setSelected([]); setConfirm(null); pending.current = null;
      if(body.action==="review"&&body.validation==="approved"||body.action==="edit"&&body.validate){
        const ids=body.action==="edit"?[String(body.id)]:(body.selection as {id:string}[]).map(i=>i.id);
        setConsentPrompt(next.items.filter(i=>ids.includes(i.id)&&i.validation==="approved"&&sectionType(i)==="experience"&&!isSensitiveDetail(i)&&!i.applicationAllowed&&i.applicationConsent==="pending").map(i=>({id:i.id,version:i.version,title:detailHeading(i)})));
      }else if(body.action==="applicationConsent")setConsentPrompt([]);
      setIssues([]);
      if(body.action==="edit" && body.validate || body.action==="review" && body.validation==="approved"){
        const order=[...groups.flatMap(g=>[g,...childrenOf(g)]),...ungrouped].map(i=>i.id);
        const done=body.action==="edit"?[String(body.id)]:(body.selection as {id:string}[]).map(i=>i.id);
        setFilter("active");setSearch("");setNavigation({id:nextReviewTarget(next.items,order,done),nonce:Date.now()});
      }
      if(body.action === "restore") setFilter("proposed");
      setNotice(body.action === "create" && body.kind === "fact" ? "Exemple ajouté." : body.action === "applicationConsent" ? body.allowed ? "Autorisation enregistrée." : "Choix enregistré. Ces blocs ne seront pas utilisés pour les candidatures." : body.action === "edit" ? "Bloc enregistré et validé. Si son sens a changé, ses autorisations précédentes ont été retirées." : body.action === "restore" ? "Bloc restauré dans « À relire », sans autorisation d’usage automatique." : body.validation === "rejected" ? "Bloc masqué. Retrouvez-le dans « Masqués et doublons » pour le restaurer." : body.validation==="approved" ? "Contenu validé. Son autorisation peut être gérée ci-dessus." : "Modification enregistrée.");
      return true;
    } catch (e) {
      if (e instanceof RequestError) setIssues(e.issues);
      setError(e instanceof Error && !["AbortError", "TypeError"].includes(e.name) ? e.message : "Enregistrement non confirmé. Réessayez : la même opération ne sera pas appliquée deux fois.");
      return false;
    } finally { locked.current = false; setBusy(false); }
  }

  async function extract(doc: Document) {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError(""); setNotice("Lecture privée de " + doc.originalName + "…");
    try {
      const r = await fetch("/api/documents/" + doc.id); if (!r.ok) throw new Error("Original indisponible.");
      const extraction = await extractDocument(doc.originalName, await r.arrayBuffer());
      setState(await read("/api/experiences", { action: "extract", extraction: { documentId: doc.id, ...extraction } }));
      setNotice(extraction.status === "extracted" ? "Lecture terminée. Vos corrections et décisions précédentes sont conservées." : extraction.issue);
    } catch (e) { setError(e instanceof Error ? e.message : "Lecture non confirmée. Vous pouvez relancer sans doublon."); }
    finally { locked.current = false; setBusy(false); }
  }

  async function refresh() {
    if(locked.current) return;
    setError("");
    try { setState(await read("/api/experiences")); setSelected([]); setConfirm(null); pending.current=null; setNotice("Carnet actualisé. Aucune page à recharger."); }
    catch { setError("Lecture impossible pour le moment. Vous pouvez réessayer."); }
  }
  const errorMessage = error ? <div role="alert" className="experience-error"><p>{error}</p>{issues.length ? <ul className="mt-3 space-y-3">{issues.map((issue,n) => <li key={n}><strong>{issue.title}</strong> · {issue.field==="reviewPoints"?"Question à résoudre":fieldNames[issue.field]} : « {issue.quote} » <button type="button" className="underline" disabled={busy} onClick={() => correct(issue)}>Corriger ce passage</button></li>)}</ul> : <button type="button" className="ml-3 underline" disabled={busy} onClick={refresh}>Actualiser le carnet</button>}</div> : null;

  const active = currentItems(state.items, state.reference?.documentId).map(i=>({...i,data:structuredReview(i.data)}));
  const consentItems=active.filter(i=>i.validation==="approved"&&sectionType(i)==="experience"&&!isSensitiveDetail(i));
  const pendingConsent=consentItems.filter(i=>i.applicationConsent==="pending"&&!i.applicationAllowed);
  const deferredConsent=consentItems.filter(i=>i.applicationConsent==="declined"&&!i.applicationAllowed);
  const groups = active.filter(i => i.kind === "experience" && sectionType(i) !== "overview").sort((a,b)=>{
    const source=(i:ExperienceItem)=>i.data.provenance.find(p=>p.documentId===state.reference?.documentId);
    const left=source(a),right=source(b);
    return left&&right?(left.page||1)-(right.page||1)||(left.line||1)-(right.line||1):left?1:right?-1:0;
  });
  const ungrouped = active.filter(i => i.kind === "fact" && !i.parentId);
  const activeIds = new Set(active.map(i => i.id));
  const overviews = new Set(active.filter(i=>i.kind==="experience"&&sectionType(i)==="overview").map(i=>i.id));
  const historical = state.items.filter(i=>!activeIds.has(i.id)||sectionType(i)==="overview"||!!i.parentId&&overviews.has(i.parentId));
  const conflicts = state.conflicts.filter(c => activeIds.has(c.leftId) && activeIds.has(c.rightId));
  const chosen = active.filter(i => selected.includes(i.id));
  const selection = selectedVersions(chosen);
  const childrenOf = (g: ExperienceItem) => active.filter(i => i.parentId === g.id);
  const family = (g: ExperienceItem) => [g, ...childrenOf(g)];
  const eligible = (i: ExperienceItem) => i.validation !== "rejected";
  const toggle = (ids: string[]) => { setSelected(s => ids.every(id => s.includes(id)) ? s.filter(id => !ids.includes(id)) : [...new Set([...s, ...ids])]); setConfirm(null); };
  const prepare = (items: ExperienceItem[], action: "approved" | "rejected") => {
    if(action==="approved"){const found=items.flatMap(reviewIssues);setIssues(found);if(found.length){setError("Choisissez une réponse pour chaque question avant de valider.");correct(found[0]);return;}void act({action:"review",selection:selectedVersions(items),validation:"approved",confirmed:true});return;}
    setSelected(items.map(i=>i.id));setConfirm(action);setReason("hidden");setDuplicateOf("");setIssues([]);setError("");
  };
  const visible = (i: ExperienceItem) => (filter === "active" ? i.validation !== "rejected" : filter === "proposed" ? i.validation !== "rejected" && (i.validation === "proposed" || childrenOf(i).some(c => c.validation === "proposed")) : filter === "rejected" ? i.validation === "rejected" || childrenOf(i).some(c => c.validation === "rejected") : i.validation === filter) && (!search || (i.data.title + " " + i.data.organization + " " + i.data.context + " " + childrenOf(i).map(c => c.data.context).join(" ")).toLowerCase().includes(search.toLowerCase()));
  const hiddenCount = active.filter(i => i.validation === "rejected" && (i.kind === "experience" || !i.parentId || groups.some(g => g.id === i.parentId && g.validation !== "rejected"))).length;
  const duplicateTargets = active.filter(i => !selected.includes(i.id) && i.validation !== "rejected" && (chosen.some(s => s.kind === "experience") ? i.kind === "experience" && sectionType(i) === "experience" : i.kind === "fact"));

  function card(item: ExperienceItem) {
    const parentHidden=groups.some(g=>g.id===item.parentId&&g.validation==="rejected");
    return <DetailCard key={item.id} item={item} onEditing={editingChanged} focusTarget={focusTarget} experiences={groups} selected={selected.includes(item.id)} busy={busy || loading} onSelect={() => toggle([item.id])} onSave={act} onReview={parentHidden?undefined:action => prepare([item], action)} />;
  }
  function group(g: ExperienceItem) {
    if (!visible(g)) return null;
    const children = childrenOf(g).filter(i => filter === "rejected" ? g.validation === "rejected" || i.validation === "rejected" : i.validation !== "rejected"), context = children.filter(isContextOnly), details = children.filter(i => !isContextOnly(i));
    const heading = experienceHeading(g), hidden = g.validation === "rejected";
    return <ExpandableSection key={g.id} className={"experience-group "+(family(g).some(i=>i.validation==="proposed")?"needs-review":"")} title={<><span className="experience-group-heading"><strong>{heading.organization}</strong><span>{heading.role}</span><small>{heading.period}</small></span></>} status={<span className={"experience-status " + (hidden ? "is-hidden" : family(g).every(i=>i.validation!=="proposed") ? "is-approved" : "")}>{!hidden&&family(g).some(i=>i.validation==="proposed")?"À relire":itemStatus(g)}</span>}>

      <div className="experience-group-body">
        {g.data.context && g.data.context !== g.data.title ? <RichText text={g.data.context} /> : null}
        {context.map(c => <div className="experience-company-context" key={c.id}><RichText text={c.data.context.replace(/^###\s+Contexte\s*\n?/i, "")} />{c.validation === "rejected" && !hidden ? <button className="secondary-button mt-3" disabled={busy || loading} onClick={()=>act({action:"restore",selection:selectedVersions([c])})}>Restaurer le contexte</button> : null}</div>)}
        <div className="experience-actions">
          {hidden ? <button className="secondary-button" disabled={busy || loading} onClick={() => act({ action: "restore", selection: selectedVersions(family(g)) })}><Undo2 size={15} /> Restaurer cette expérience et ses détails</button> : <>
            <button className="radar-add-button" disabled={busy || loading || family(g).some(i=>editing.includes(i.id))} onClick={() => prepare(family(g).filter(eligible), "approved")}><Check size={15} /> Valider tout le contenu de cette expérience</button>
            <button className="secondary-button" disabled={busy || loading} onClick={() => prepare(family(g), "rejected")}>Masquer / signaler un doublon</button>
            <button className="secondary-button" disabled={busy || loading} onClick={() => toggle(family(g).filter(eligible).map(i => i.id))}>Sélectionner pour les droits d’usage</button>
          </>}
        </div>
        <ExpandableSection className="experience-metadata" title={<>Modifier l’entreprise, le poste, les dates ou le contexte · historique</>}><DetailCard item={g} onEditing={editingChanged} focusTarget={focusTarget} metadata experiences={groups} selected={selected.includes(g.id)} busy={busy || loading} onSelect={() => toggle([g.id])} onSave={act} />{context.map(c=><DetailCard key={c.id} item={c} onEditing={editingChanged} focusTarget={focusTarget} metadata experiences={groups} selected={selected.includes(c.id)} busy={busy || loading} onSelect={()=>toggle([c.id])} onSave={act}/>)}</ExpandableSection>
        <div className="experience-details-heading"><p>{sectionType(g) === "knowledge" ? "Détails documentés" : "Missions et réalisations"}</p><span>{details.length} bloc{details.length > 1 ? "s" : ""}</span>{!hidden && sectionType(g) === "experience" ? <button type="button" className="secondary-button" disabled={busy || loading} onClick={() => setAddingTo(addingTo === g.id ? null : g.id)}><Plus size={15} /> {addingTo === g.id ? "Annuler" : "Ajouter un exemple"}</button> : null}</div>
        {addingTo === g.id ? <InlineExampleForm key={g.id} parentId={g.id} busy={busy} onCancel={() => setAddingTo(null)} onSave={async body => { if (await act(body)) { setAddingTo(null); setFilter("active"); setSearch(""); } }} /> : null}
        {details.map(card)}
        {details.some(isSensitiveDetail) ? <p className="experience-help">Les questions sont séparées du récit. Répondez-y ou choisissez « Ne pas utiliser » avant de valider toute l’expérience.</p> : null}
        {!details.length ? <p className="text-sm text-[#535768]">Aucun détail documenté pour le moment. Vous pouvez compléter cette expérience.</p> : null}
      </div>
    </ExpandableSection>;
  }

  return <section className="experience-library glass-panel mt-6 p-5 sm:p-7" aria-labelledby="experience-title" aria-busy={busy || loading}>
    <div className="flex flex-wrap justify-between gap-4"><div><h2 id="experience-title" tabIndex={-1} className="text-lg font-bold">Mon carnet d’expériences</h2></div><button className="secondary-button" disabled={busy || loading} onClick={() => setAdding(!adding)}>{adding ? "Annuler" : "Ajouter au parcours"}</button></div>
    <div className="experience-reference"><FileClock size={20} /><div><strong>{state.reference ? "Document détaillé de référence" : "Document détaillé"}</strong><p>{state.reference?.name || "Aucun document importé."}</p><nav className="experience-document-links" aria-label="Document du carnet"><a href="?tab=profile&profile=documents#document-detailedExperienceDocumentId" onClick={event=>{if(onOpenDocuments&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&!event.altKey){event.preventDefault();onOpenDocuments();}}}>{state.reference ? "Remplacer le document" : "Importer un document"}</a><a href="#experience-document-history" onClick={event=>{if(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();if(documentHistory.current){revealCollapsibleAncestors(documentHistory.current);requestAnimationFrame(()=>{window.history.pushState(null,"","#experience-document-history");documentHistory.current?.scrollIntoView({block:"start"});documentHistory.current?.querySelector<HTMLElement>("[data-slot=collapsible-trigger]")?.focus({preventScroll:true});});}}}>Historique des documents</a></nav>{state.extractions.find(e=>e.documentId===state.reference?.documentId)?.status==="needs_conversion"?<p role="alert" className="experience-error">{state.extractions.find(e=>e.documentId===state.reference?.documentId)?.issue || "Ce document nécessite une conversion en texte lisible."} Les versions précédentes restent dans l’historique.</p>:null}</div></div>
    <div className="experience-counts my-4 flex flex-wrap gap-2 text-xs"><span className="quiet-tag">{groups.filter(g => g.validation !== "rejected" && sectionType(g) === "experience").length} expériences</span><span className="quiet-tag">{[...groups.filter(g=>g.validation!=="rejected").flatMap(family),...ungrouped].filter(i=>i.validation==="proposed").length} éléments à relire</span>{hiddenCount ? <button className="quiet-tag underline" onClick={() => { setFilter("rejected"); setSelected([]); setConfirm(null); }}>{hiddenCount} bloc{hiddenCount > 1 ? "s" : ""} masqué{hiddenCount > 1 ? "s" : ""} — restaurer</button> : null}</div>
    <section className="experience-consent-panel" aria-label="Utilisation de mon parcours"><div className="experience-consent-overview"><div className="experience-consent-copy"><strong>Utilisation de mon parcours</strong><p>{pendingConsent.length} bloc{pendingConsent.length>1?"s":""} validé{pendingConsent.length>1?"s":""} à autoriser · {deferredConsent.length} remis à plus tard · {consentItems.filter(i=>i.applicationAllowed).length} autorisé{consentItems.filter(i=>i.applicationAllowed).length>1?"s":""}.</p></div><button type="button" className="secondary-button" onClick={()=>setShowConsentManager(!showConsentManager)}>{showConsentManager?"Fermer les autorisations":"Gérer les autorisations"}</button></div>{showConsentManager?<div className="mt-4 space-y-2"><p className="text-xs">Choisissez les contenus utilisables dans vos candidatures.</p>{consentItems.map(i=><div key={i.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#d0d4e4] bg-white/80 p-3 text-xs"><span>{detailHeading(i)} · {i.applicationAllowed?"Autorisé":i.applicationConsent==="declined"?"Remis à plus tard":"À autoriser"}</span><button type="button" className="secondary-button" disabled={busy} onClick={()=>act({action:"applicationConsent",selection:[{id:i.id,version:i.version}],allowed:!i.applicationAllowed})}>{i.applicationAllowed?"Retirer l’autorisation":"Autoriser pour les candidatures"}</button></div>)}</div>:null}</section>
    <dialog ref={consentDialog} aria-label="Autoriser la personnalisation des candidatures" className="experience-consent-dialog" onCancel={e=>{e.preventDefault();if(!busy&&consentPrompt.length)void act({action:"applicationConsent",selection:consentPrompt.map(({id,version})=>({id,version})),allowed:false});}}>{consentPrompt.length?<><strong>Utiliser ce contenu pour vos candidatures ?</strong><p className="mt-2 text-sm">{consentPrompt.length} bloc{consentPrompt.length>1?"s viennent":" vient"} d’être validé{consentPrompt.length>1?"s":""}. Autoriser {consentPrompt.length>1?"leur":"son"} utilisation pour personnaliser vos candidatures ?</p><ul className="my-3 list-disc pl-5 text-xs">{consentPrompt.map(i=><li key={i.id}>{i.title}</li>)}</ul><div className="experience-actions"><button type="button" className="radar-add-button" disabled={busy} onClick={()=>act({action:"applicationConsent",selection:consentPrompt.map(({id,version})=>({id,version})),allowed:true})}>Autoriser la personnalisation</button><button type="button" className="secondary-button" disabled={busy} onClick={()=>act({action:"applicationConsent",selection:consentPrompt.map(({id,version})=>({id,version})),allowed:false})}>Pas maintenant</button></div>{errorMessage}</>:null}</dialog>
    {notice ? <p role="status" className="my-3 text-sm text-[#4b4bd1]">{notice}</p> : null}
    {!selection.length ? errorMessage : null}
    {loading ? <LoadingSkeleton label="Chargement de votre parcours…" /> : null}
    {adding ? <ManualForm experiences={groups.filter(g => g.validation !== "rejected")} busy={busy} onSave={async body => { if (await act(body)) setAdding(false); }} /> : null}
    <div className="experience-filters"><ChoiceSelect label="Afficher" value={filter} onChange={value=>{setFilter(value);setSelected([]);setConfirm(null);}} options={[{value:"active",label:"Mon parcours actuel"},{value:"proposed",label:"Expériences à relire"},{value:"approved",label:"Expériences validées"},{value:"rejected",label:"Masqués et doublons — restaurables"}]} /><label className="experience-search"><span>Rechercher</span><input className={inputClass} value={search} onChange={e => setSearch(e.target.value)} placeholder="Entreprise, mission, réalisation…" /></label></div>
    {selection.length ? <div ref={reviewPanel} className="experience-review-panel selection-dock" role="group" aria-label="Confirmer l’action sur la sélection">
      <p className="font-semibold">{chosen.filter(i => i.kind === "experience").length ? chosen.filter(i => i.kind === "experience").map(i => experienceHeading(i).organization).join(", ") + " · " : ""}{selection.length} bloc{selection.length > 1 ? "s" : ""} sélectionné{selection.length > 1 ? "s" : ""}</p>{selection.length>100?<p role="alert" className="experience-error">Sélectionnez au maximum 100 blocs par opération. Aucun contenu n’a été modifié.</p>:null}
      <div className="experience-actions"><button className="radar-add-button" disabled={busy || editing.length>0 || selection.length > 100} onClick={() => prepare(chosen, "approved")}>Valider le contenu</button><button className="secondary-button" disabled={busy || selection.length > 100} onClick={() => setConfirm("rejected")}>Masquer / doublon</button><button className="secondary-button" disabled={busy} onClick={() => { setSelected([]); setConfirm(null); setError(""); }}>Annuler la sélection</button></div>
      {confirm ? <div className="experience-confirm">
        <p>{confirm === "approved" ? "J’ai relu ces blocs, mes contributions et les limites mentionnées. Cette validation n’autorise aucun usage automatiquement." : "Ces blocs et les détails sélectionnés seront masqués, sans suppression du document ni de l’historique."}</p>
        {confirm === "rejected" ? <div className="mt-3 grid gap-3"><ChoiceSelect label="Pourquoi masquer ?" value={reason} onChange={value=>{setReason(value);setDuplicateOf("");}} options={[{value:"hidden",label:"Masquer dans la vue courante"},{value:"duplicate",label:"Doublon d’un autre bloc"}]} />{reason === "duplicate" ? <ChoiceSelect label="Bloc conservé" value={duplicateOf} onChange={setDuplicateOf} options={[{value:"",label:"Choisir le bloc conservé…"},...duplicateTargets.map(i=>({value:i.id,label:i.data.title}))]} /> : null}</div> : null}
        {errorMessage}
        <div className="experience-actions"><button disabled={busy || (confirm === "approved" && issues.length > 0) || selection.length > 100 || (confirm === "rejected" && reason === "duplicate" && !duplicateOf)} className="radar-add-button" onClick={() => act({ action: "review", selection, validation: confirm, confirmed: true, ...(confirm === "rejected" ? { reason, ...(reason === "duplicate" ? { duplicateOf } : {}) } : {}) })}>{busy ? <><LoaderCircle size={16} className="animate-spin" /> Enregistrement…</> : confirm === "approved" ? "Confirmer la validation" : reason === "duplicate" ? "Confirmer le doublon" : "Confirmer le masquage"}</button><button className="secondary-button" disabled={busy} onClick={() => setConfirm(null)}>Annuler</button></div>
      </div> : null}
      {!confirm ? errorMessage : null}
      <ExpandableSection  title={<>Choisir les droits d’usage des blocs sélectionnés</>}><div className="mt-3 flex flex-wrap gap-4 text-xs"><label><input type="checkbox" checked={usage.applicationAllowed} onChange={e => setUsage({ ...usage, applicationAllowed: e.target.checked })} /> Candidatures</label><label><input type="checkbox" checked={usage.publicProfileAllowed} onChange={e => setUsage({ ...usage, publicProfileAllowed: e.target.checked })} /> Profils publics</label><p>Les deux décochés = strictement privé. Seuls les contenus validés avec leur expérience peuvent être réutilisés.</p><button disabled={busy || selection.length > 100} className="secondary-button" onClick={() => act({ action: "usage", selection, permissions: usage })}>{busy ? "Enregistrement…" : "Enregistrer les droits"}</button></div></ExpandableSection>
    </div> : null}
    <div className="space-y-4">{groups.filter(g => sectionType(g) === "experience").map(group)}</div>
    {groups.some(g => sectionType(g) === "knowledge" && visible(g)) ? <ExpandableSection className="experience-secondary" title={<>Compétences, formation et langues</>}><div className="mt-4 space-y-4">{groups.filter(g => sectionType(g) === "knowledge").map(group)}</div></ExpandableSection> : null}
    {ungrouped.some(visible) ? <ExpandableSection className="experience-secondary" title={<>Compléments personnels non rattachés à une expérience</>}>{ungrouped.filter(visible).map(card)}</ExpandableSection> : null}
    {!groups.some(visible) && !loading ? <p className="my-6 text-sm text-[#535768]">Aucune expérience dans cette vue. Essayez « Mon parcours actuel » ou « Masqués et doublons ».</p> : null}
    <ExpandableSection ref={documentHistory} id="experience-document-history" className="experience-secondary" title={<>Historique des documents</>}>{docs.map(d => <div key={d.id} className="experience-document"><div><a className="text-sm underline" href={"/api/documents/" + d.id} target="_blank" rel="noreferrer">{d.originalName}</a><p className="text-xs">{d.id === state.reference?.documentId ? "Référence courante" : "Document secondaire / ancienne version — conservé"}{d.createdAt ? " · " + d.createdAt.slice(0, 10) : ""}</p></div>{d.id === state.reference?.documentId ? <button className="secondary-button" disabled={busy || loading} onClick={() => extract(d)}>Relire sans doublon</button> : null}</div>)}<ExpandableSection className="mt-4" title={<>Blocs des anciennes versions et résumés ({historical.length})</>}>{historical.map(i => <HistoricalItem key={i.id} item={i} />)}</ExpandableSection></ExpandableSection>
    {conflicts.length ? <ExpandableSection className="experience-secondary" title={<>Points à comparer dans la version courante ({conflicts.filter(c => c.state === "open").length} ouverts)</>}><p className="my-3 text-xs">Les CV et les anciennes versions ne sont pas des contradictions : le dernier document détaillé est prioritaire.</p>{conflicts.map(c => <ConflictCard key={c.id} conflict={c} items={active} busy={busy} onSave={act} />)}</ExpandableSection> : null}
  </section>;
}

function inline(text: string): ReactNode[] { return text.split(/(\*\*[^*]+\*\*)/g).map((part, n) => part.startsWith("**") ? <strong key={n}>{part.slice(2, -2)}</strong> : part); }
function RichText({ text }: { text: string }) {
  return <div className="experience-rich-text">{text.trim().split(/\n\s*\n/).map((paragraph, n) => {
    if (/^###\s/.test(paragraph)) return <p className="experience-passage-title" key={n}>{inline(paragraph.replace(/^###\s+/, ""))}</p>;
    if (paragraph.split("\n").every(line => /^\s*[-*]\s/.test(line))) return <ul key={n}>{paragraph.split("\n").map((line, i) => <li key={i}>{inline(line.replace(/^\s*[-*]\s+/, ""))}</li>)}</ul>;
    return <p key={n}>{inline(paragraph)}</p>;
  })}</div>;
}
function HistoricalItem({ item }: { item: ExperienceItem }) {
  const [revisions, setRevisions] = useState<Revision[]>([]), [error, setError] = useState("");
  return <ExpandableSection className="my-3 rounded-xl bg-white/60 p-3" title={<>{item.data.title} · {itemStatus(item)}</>}><RichText text={item.data.context} /><button className="secondary-button" onClick={async () => { try { setRevisions((await read<{ revisions: Revision[] }>("/api/experiences?history=" + encodeURIComponent(item.id))).revisions); } catch { setError("Historique indisponible. Réessayez."); } }}>Voir les versions</button>{error ? <p role="alert">{error}</p> : null}<History revisions={revisions} /></ExpandableSection>;
}
function DetailCard({ item, metadata, onEditing, focusTarget, experiences, selected, onSelect, busy, onSave, onReview }: { item: ExperienceItem; metadata?: boolean; onEditing?:(id:string,open:boolean)=>void; focusTarget?: FocusTarget; experiences: ExperienceItem[]; selected: boolean; onSelect: () => void; busy: boolean; onSave: (body: Command) => Promise<boolean>; onReview?: (action: "approved" | "rejected") => void }) {
  const [edit, setEdit] = useState(false), [parentId, setParentId] = useState(item.parentId || ""), [revisions, setRevisions] = useState<Revision[]>([]), [error, setError] = useState("");
  const root = useRef<HTMLDivElement>(null);
  useEffect(()=>{onEditing?.(item.id,edit);return()=>onEditing?.(item.id,false);},[edit,item.id,onEditing]);
  const [saved, setSaved] = useState(false);
  const target = focusTarget?.itemId === item.id ? focusTarget : undefined;
  useEffect(() => {
    if (!target) return;
    revealCollapsibleAncestors(root.current);
    setEdit(true);
  }, [target]);
  const title = detailHeading(item), heading = /^###\s+[^\n]+\n?/.exec(item.data.context)?.[0];
  const parent = experiences.find(i=>i.id===item.parentId);
  const body = heading ? item.data.context.slice(heading.length).trim() : item.data.context;
  return <ExpandableSection ref={root} defaultOpen={!!metadata} id={"review-"+item.id} tabIndex={-1} className={"experience-detail "+(item.validation==="proposed"?"needs-review":"")} title={<><span className="experience-example-title">{metadata ? "Informations de l’expérience" : title}</span></>} status={<span className={"experience-status "+(item.validation==="approved"?"is-approved":item.validation==="rejected"?"is-hidden":"")}>{itemStatus(item,parent)}</span>}>

    <div className="experience-example-body">
    <label className="experience-example-selection"><input aria-label={"Sélectionner pour les droits d’usage : " + title} type="checkbox" checked={selected} onChange={onSelect} disabled={busy || parent?.validation === "rejected" || item.validation === "rejected"} className="fact-checkbox" /> Sélectionner pour les droits d’usage</label>
    {!metadata ? <><RichText text={body === title ? "" : body} />{(item.data.reviewPoints||[]).filter(q=>q.decision==="confirmed").map(q=><p key={q.id} className="mt-3 text-sm">{q.answer}</p>)}{item.data.contribution && !body.includes(item.data.contribution) ? <p className="mt-3 text-sm"><b>Ma contribution :</b> {item.data.contribution}</p> : null}{item.data.result && !body.includes(item.data.result) ? <p className="mt-3 text-sm"><b>Résultat et limites :</b> {item.data.result}</p> : null}</> : null}<p className="mt-3 text-xs">{item.applicationAllowed ? "Usage candidature autorisé" : "Pas d’usage candidature"} · {item.publicProfileAllowed ? "Usage profil public autorisé" : "Pas d’usage public"}</p>
    {!edit && (item.data.reviewPoints||[]).some(q=>q.decision==="pending") ? <button className="review-question-summary" onClick={()=>setEdit(true)}>Répondre aux {(item.data.reviewPoints||[]).filter(q=>q.decision==="pending").length} question(s) en suspens</button>:null}
    <div className="experience-actions primary-review-actions">
      <button disabled={busy} className="secondary-button" onClick={()=>setEdit(!edit)}>{edit?"Annuler la modification":metadata?"Modifier les informations":"Modifier ce bloc"}</button>
      {onReview && item.validation!=="rejected" && !edit ? <button className="radar-add-button" disabled={busy} onClick={()=>onReview("approved")}>{item.validation==="approved"?"Validé · continuer":"Valider et continuer"}</button>:null}
    </div>
    <ExpandableSection className="experience-more" title={<>Historique, masquage et autres actions</>}><div className="experience-actions">
      {onReview && item.validation!=="rejected"?<button disabled={busy||edit} className="secondary-button" onClick={()=>onReview("rejected")}>Masquer ce bloc / doublon</button>:null}
      {onReview && item.validation==="rejected"?<button disabled={busy} className="secondary-button" onClick={()=>onSave({action:"restore",selection:selectedVersions([item])})}>Restaurer ce bloc</button>:null}
      <button className="secondary-button" disabled={busy} onClick={async()=>{setError("");try{setRevisions((await read<{revisions:Revision[]}>("/api/experiences?history="+encodeURIComponent(item.id))).revisions);}catch{setError("Historique indisponible. Réessayez.");}}}>Historique et source</button>
    </div></ExpandableSection>

    {edit ? <div>{item.kind === "fact" ? <ChoiceSelect label="Expérience concernée" value={parentId} onChange={setParentId} options={[{value:"",label:"Complément non rattaché"},...experiences.map(g=>({value:g.id,label:g.data.title}))]} /> : null}<ItemForm key={item.version} initial={item.data} item={item} focusTarget={target} busy={busy} onSubmit={async (data, permissions) => { setError(""); if (await onSave({ action: "edit", validate:true, id: item.id, version: item.version, data, permissions, ...(item.kind === "fact" ? { parentId: parentId || null } : {}) })) { setEdit(false); setSaved(true); } else setError("Correction non enregistrée. Votre saisie reste ici : consultez le message du carnet avant de réessayer."); }} /></div> : null}
    {saved && !edit ? <p role="status" className="mt-3 text-sm text-[#4b4bd1]">Correction enregistrée. {item.validation === "approved" ? "Ce bloc est validé." : "Votre correction reste à reprendre."} Aucun fichier ni profil externe modifié.</p> : null}
    {error ? <p role="alert" className="experience-error">{error}</p> : null}
    {revisions.length ? <ExpandableSection defaultOpen className="mt-3 text-xs" title={<>Source et versions conservées</>}>{item.data.provenance.map((p, n) => <div key={n} className="my-3 rounded-xl bg-[#f5f6f8] p-3"><p>{p.name}{p.page ? " · page " + p.page : ""}{p.line ? " · ligne " + p.line : ""}</p><blockquote className="mt-2 whitespace-pre-wrap break-words">{p.quote}</blockquote></div>)}<History revisions={revisions} /></ExpandableSection> : null}
    </div>
  </ExpandableSection>;
}
function History({ revisions }: { revisions: Revision[] }) { return <div>{revisions.map(r => <ExpandableSection key={r.version} className="my-2 border-t py-2 text-xs" title={<>Version {r.version} · {itemStatus(r.snapshot)} · {new Date(r.createdAt).toLocaleString("fr-FR")}</>}><RichText text={r.snapshot.data.context} /><p>Contribution : {r.snapshot.data.contribution || "Non documentée"}</p><p>Résultat : {r.snapshot.data.result || "Non documenté"}</p>{(r.snapshot.data.reviewPoints||[]).map(q=><div key={q.id} className="my-3"><p>Question privée : {q.question}</p><p>Décision : {q.decision==="confirmed"?"Confirmée":q.decision==="excluded"?"Non retenue":"En suspens"}</p>{q.decision==="confirmed"?<p>Précision retenue : {q.answer}</p>:null}</div>)}<p>{r.snapshot.applicationAllowed ? "Candidatures autorisées" : "Sans usage candidature"} · {r.snapshot.publicProfileAllowed ? "Profil public autorisé" : "Sans usage public"}</p></ExpandableSection>)}</div>; }
function ItemForm({ initial, item, focusTarget, busy, onSubmit }: { initial: ItemData; item?: ExperienceItem; focusTarget?: FocusTarget; busy: boolean; onSubmit: (data: EditFields, permissions: { applicationAllowed: boolean; publicProfileAllowed: boolean }) => void }) {
  const [data, setData] = useState(fieldsOnly(item?.kind === "experience" ? {...initial,...experienceHeading(item)} : initial));
  const [advanced,setAdvanced]=useState(false);
  const [points,setPoints]=useState(structuredReview(initial).reviewPoints || []);
  const form = useRef<HTMLFormElement>(null);
  const permissions = { applicationAllowed: item?.applicationAllowed ?? false, publicProfileAllowed: item?.publicProfileAllowed ?? false };
  const passages = contextPassages(data.context);
  const problems = item ? reviewIssues({...item, data:{...initial,...data,reviewModel:1,reviewPoints:points}}) : [];
  useEffect(() => {
    if (!focusTarget) return;
    if(focusTarget.field==="reviewPoints"){const input=form.current?.querySelectorAll<HTMLElement>("[data-review-point]")[focusTarget.start];const control=Array.from(input?.querySelectorAll<HTMLElement>("button")??[]).find(element=>element.getClientRects().length>0);(control??input)?.focus();input?.scrollIntoView({block:"center",behavior:"smooth"});return;}
    const inputs = Array.from(form.current?.querySelectorAll<HTMLTextAreaElement>("textarea[data-field]") || []);
    const input = inputs.find(el => el.dataset.field === focusTarget.field && (focusTarget.field !== "context" || (Number(el.dataset.start) <= focusTarget.start && Number(el.dataset.end) >= focusTarget.end)));
    if (input) { input.focus(); input.scrollIntoView({block:"center",behavior:"smooth"}); const offset=Number(input.dataset.start || 0); input.setSelectionRange(focusTarget.start-offset,focusTarget.end-offset); }
  }, [focusTarget]);
  const help: Partial<Record<keyof Fields,string>> = {
    context: "Le produit, la situation et les exemples décrits. Corrigez un passage sans réécrire les autres.",
    contribution: "Ce que vous avez personnellement fait, par opposition au travail de l’équipe. Facultatif si cela figure déjà dans les passages.",
    result: "Les effets observés, les chiffres vérifiés et leurs limites. Ne renseignez pas de résultat supposé. Facultatif si déjà décrit."
  };
  function issueText(field:keyof Fields,start=0,end=Infinity) {
    const matches=problems.filter(p=>p.field===field&&p.start>=start&&p.end<=end);
    return matches.length ? <span className="mt-2 block text-amber-900">À préciser avant validation : {matches.map(p=>"« "+p.quote+" »").join(", ")}. Conservez toute limite réelle ; ne la remplacez pas par une certitude inventée.</span> : null;
  }
  return <form ref={form} className="experience-edit-form my-4 grid gap-4 rounded-xl bg-[#f5f6f8] p-4 sm:grid-cols-2" onSubmit={e => { e.preventDefault(); onSubmit({...data,reviewModel:1,reviewPoints:points}, permissions); }}>
    <div className="sm:col-span-2 rounded-xl bg-white p-4 text-sm leading-6">
      <strong>Vous modifiez ce bloc du carnet, pas votre CV.</strong>
      <p>« Enregistrer et valider » confirme votre correction en une seule étape, puis vous amène au prochain bloc à relire. Les originaux, les autres blocs et vos profils externes restent inchangés.</p>
      <p>Seuls les contenus validés et autorisés peuvent être repris dans un brief de candidature. Si vous changez ce contenu, son autorisation précédente est retirée et vous pourrez la redonner après l’enregistrement.</p>
    </div>
    <fieldset className={"review-questions sm:col-span-2 "+(!points.length?"questions-empty":"")}>
      <legend>Questions à résoudre <span className="experience-status">{points.filter(q=>q.decision==="pending").length} en suspens</span></legend>
      <p className="text-xs leading-5">Ces questions sont distinctes de votre récit. Confirmez uniquement ce que vous savez ; une question non retenue reste privée.</p>
      {points.map((q,n)=><div key={q.id} className="review-question">
        <label className="block text-sm">Question {n+1}<Textarea aria-label={"Question "+(n+1)} disabled={busy} className={inputClass} value={q.question} maxLength={6000} onChange={e=>setPoints(points.map((p,i)=>i===n?{...p,question:e.target.value}:p))}/></label>
        <div data-review-point><ChoiceSelect label="Votre décision" disabled={busy} value={q.decision} onChange={value=>setPoints(points.map((p,i)=>i===n?{...p,decision:value as typeof p.decision}:p))} options={[{value:"pending",label:"Je dois encore vérifier"},{value:"confirmed",label:"Préciser et confirmer"},{value:"excluded",label:"Ne pas utiliser cette information"}]} /></div>
        {q.decision==="confirmed"?<label className="block text-sm">Ce que je confirme<Textarea required className={inputClass} disabled={busy} maxLength={4000} value={q.answer} onChange={e=>setPoints(points.map((p,i)=>i===n?{...p,answer:e.target.value}:p))} placeholder="Décrivez le fait confirmé et ses limites, avec vos mots."/></label>:q.decision==="excluded"?<p className="text-xs">Conservée uniquement dans votre historique privé ; non reprise dans les briefs.</p>:null}
      </div>)}
      <button type="button" className="secondary-button mt-3" disabled={busy} onClick={()=>setPoints([...points,{id:crypto.randomUUID(),question:"",decision:"pending",answer:""}])}>Ajouter une question à vérifier</button>
    </fieldset>
    {item?.kind==="fact"?<button type="button" className="text-left text-xs underline sm:col-span-2" onClick={()=>setAdvanced(!advanced)}>{advanced?"Masquer les informations secondaires":"Entreprise, période et classement — options"}</button>:null}
    {(Object.keys(fieldNames) as (keyof Fields)[]).filter(k => item?.kind === "experience" ? !["contribution", "result", "claimKey"].includes(k) : item?.kind!=="fact" || advanced || ["title","context","contribution","result"].includes(k)).map(k =>
      k === "context" ? <fieldset key={k} className="min-w-0 sm:col-span-2 space-y-3"><legend className="text-sm font-semibold">Contexte et exemples — modifier passage par passage</legend><p className="text-xs leading-5">{help.context} Un passage est une partie du même bloc : la validation porte sur le bloc entier.</p>
        {(passages.length ? passages : [{start:0,end:0,text:""}]).map((p,n) => <label key={n} className="block rounded-xl border border-[#d0d4e4] bg-white p-3 text-xs font-semibold">
          Passage {n+1}{p.text.startsWith("**") ? " · "+p.text.split("**")[1] : ""}
          <Textarea disabled={busy} aria-label={"Passage "+(n+1)+" du contexte"} data-field="context" data-start={p.start} data-end={p.end} className={inputClass} rows={Math.min(10,Math.max(3,Math.ceil(p.text.length/100)))} maxLength={6000-(data.context.length-p.text.length)} value={p.text} onChange={e => setData(fieldsOnly(replaceContextPassage({...initial,...data},p.start,p.end,e.target.value)))} />
          {issueText("context",p.start,p.end)}
        </label>)}
        <p className="text-xs leading-5">Si « Son rôle » ou « Le résultat » a été recopié à l’identique lors de l’import, sa copie ci-dessous est actualisée avec le passage. Une correction différente déjà saisie est conservée.</p>
      </fieldset> :
      <label key={k} className={"text-xs font-semibold "+(["contribution","result"].includes(k)?"sm:col-span-2":"")}>{fieldNames[k]}{help[k] ? <span className="my-2 block font-normal leading-5">{help[k]}</span> : null}
        {["contribution","result"].includes(k) ? <Textarea disabled={busy} data-field={k} className={inputClass} rows={3} maxLength={4000} value={data[k]} onChange={e=>setData(fieldsOnly(replaceDocumentedField({...initial,...data},k as "contribution" | "result",e.target.value)))} /> : <input disabled={busy} required={k==="title"} className={inputClass} maxLength={k==="period"?160:k==="organization"||k==="role"?200:180} value={data[k]} onChange={e=>setData({...data,[k]:e.target.value})} />}
        {issueText(k)}
      </label>)}
    <p className="text-xs sm:col-span-2">La validation confirme uniquement les éléments que vous retenez. Les questions non retenues restent dans l’historique privé et ne servent pas aux candidatures.</p>
    <button className="radar-add-button sm:col-span-2" disabled={busy || problems.length>0}>{busy ? "Enregistrement…" : item ? "Enregistrer et valider ce bloc" : "Ajouter au carnet"}</button>
  </form>;
}
function ManualForm({ experiences, busy, onSave }: { experiences: ExperienceItem[]; busy: boolean; onSave: (body: Command) => void }) {
  const [kind, setKind] = useState<"experience" | "fact">("experience"), [parentId, setParentId] = useState("");
  return <div className="experience-secondary"><p>Compléter mon parcours</p><ChoiceSelect label="Type" value={kind} onChange={value=>setKind(value as typeof kind)} options={[{value:"experience",label:"Expérience professionnelle"},{value:"fact",label:"Réalisation / connaissance"}]} />{kind === "fact" ? <ChoiceSelect label="Expérience concernée" value={parentId} onChange={setParentId} options={[{value:"",label:"Complément non rattaché"},...experiences.map(g=>({value:g.id,label:g.data.title}))]} /> : null}<ItemForm initial={emptyData()} busy={busy} onSubmit={data => onSave({ action: "create", id: crypto.randomUUID(), kind, parentId: kind === "fact" && parentId ? parentId : null, data })} /></div>;
}
function InlineExampleForm({ parentId, busy, onCancel, onSave }: { parentId: string; busy: boolean; onCancel: () => void; onSave: (body: Command) => Promise<void> }) {
  const [id] = useState(() => crypto.randomUUID());
  const [title, setTitle] = useState("");
  const [context, setContext] = useState("");
  const [contribution, setContribution] = useState("");
  const [result, setResult] = useState("");
  return <form className="experience-inline-example" onSubmit={e => { e.preventDefault(); void onSave({ action: "create", id, kind: "fact", parentId, data: { ...fieldsOnly(emptyData()), title: title.trim(), context: context.trim(), contribution: contribution.trim(), result: result.trim() } }); }}>
    <div><strong>Nouvel exemple</strong></div>
    <label>Titre de l’exemple<input className={inputClass} required maxLength={180} value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex. Authentification OAuth" /></label>
    <label>Contexte / ce qui a été fait<Textarea className={inputClass} required maxLength={6000} rows={3} value={context} onChange={e => setContext(e.target.value)} placeholder="Décrivez la situation et le travail réalisé…" /></label>
    <label>Ma contribution<Textarea className={inputClass} maxLength={4000} rows={2} value={contribution} onChange={e => setContribution(e.target.value)} placeholder="Votre rôle précis, sans déduction" /></label>
    <label>Résultats et limites<Textarea className={inputClass} maxLength={4000} rows={2} value={result} onChange={e => setResult(e.target.value)} placeholder="Résultat observé ou « non documenté »" /></label>
    <div className="experience-inline-example-actions"><button className="radar-add-button" disabled={busy || !title.trim() || !context.trim()}>{busy ? <><LoaderCircle size={15} className="animate-spin" /> Enregistrement…</> : "Ajouter l’exemple"}</button><button type="button" className="secondary-button" disabled={busy} onClick={onCancel}>Annuler</button></div>
  </form>;
}
function ConflictCard({ conflict, items, busy, onSave }: { conflict: ExperienceConflict; items: ExperienceItem[]; busy: boolean; onSave: (body: Command) => Promise<boolean> }) {
  const [choice, setChoice] = useState("both"), [note, setNote] = useState("");
  const pair = [items.find(i => i.id === conflict.leftId), items.find(i => i.id === conflict.rightId)];
  return <ExpandableSection className="my-3 rounded-xl border border-amber-200 p-4" title={<>{pair[0]?.data.organization || pair[0]?.data.title} · {conflict.state === "open" ? "À comparer" : "Comparaison terminée"}</>}><p className="my-3 text-sm">{conflict.reason}</p><div className="grid gap-3 sm:grid-cols-2">{pair.map((i, n) => <div key={n}><b className="text-xs">Version {n + 1} · {i?.data.title}</b><RichText text={i?.data.context || ""} /></div>)}</div>{conflict.state === "open" ? <form className="mt-4 space-y-3" onSubmit={e => { e.preventDefault(); onSave({ action: "resolve", id: conflict.id, resolution: choice, note }); }}><ChoiceSelect label="Décision" value={choice} onChange={setChoice} options={[{value:"both",label:"Conserver les deux (missions distinctes)"},{value:"left",label:"Conserver la version 1, masquer la version 2"},{value:"right",label:"Conserver la version 2, masquer la version 1"}]} /><label className="text-xs">Pourquoi ?<Textarea className={inputClass} minLength={5} maxLength={2000} required value={note} onChange={e => setNote(e.target.value)} /></label><button disabled={busy} className="secondary-button">Enregistrer la décision</button></form> : null}</ExpandableSection>;
}
