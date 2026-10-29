"use client";

import { ExpandableSection, revealCollapsibleAncestors } from "./experience-section";

import { LoadingSkeleton } from "@/components/loading-skeleton";

import { Textarea } from "@/components/ui/textarea";
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Check, CircleHelp, Pencil, SlidersHorizontal, X, LoaderCircle, Plus, Undo2 } from "lucide-react";
import { structuredReview, nextReviewTarget, contextPassages, replaceDocumentedField, reviewIssues, currentItems, detailHeading, emptyData, experienceHeading, isContextOnly, isSensitiveDetail, itemStatus, sectionType, type ExperienceItem, type ItemData, type ExperienceConflict, type ReviewIssue } from "@/lib/experience-domain";
import { extractDocument } from "@/lib/extract-document";
import { useWorkspaceFeedback } from "@/components/workspace-feedback";
import { WorkspaceButton, WorkspacePanelHeader } from "@/components/workspace-form";
import { ExampleEditor, ExampleSummary } from "@/components/experience-example";
import {exampleValues} from "@/lib/experience-fields";
import { ChoiceSelect } from "@/components/choice-select";

type Document = { id: string; originalName: string; createdAt?: string };
type Library = { items: ExperienceItem[]; conflicts: ExperienceConflict[]; extractions: { id: string; documentId: string; status: string; issue: string }[]; reference?: { documentId: string; name: string; createdAt: string } | null };
type Revision = { version: number; snapshot: ExperienceItem; action: string; createdAt: string };
type Fields = Pick<ItemData, "title" | "organization" | "role" | "period" | "context" | "contribution" | "result" | "claimKey">;
type EditFields = Fields & Pick<ItemData, "reviewModel" | "reviewPoints">;
type Command = Record<string, unknown>;
type RightsKey = "applicationAllowed" | "publicProfileAllowed";
type FocusTarget = ReviewIssue & { nonce: number };
class RequestError extends Error { constructor(message: string, public issues: ReviewIssue[] = []) { super(message); } }
const inputClass = "w-full rounded-xl border border-border bg-white/80 p-2 text-sm";
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
  const feedback=useWorkspaceFeedback();
  const [rightsDraft,setRightsDraft]=useState<Record<string,{applicationAllowed:boolean;publicProfileAllowed:boolean}>>({});
  const [rightsSaving,setRightsSaving]=useState(false);
  const rightsLock=useRef(false);
  const rightsDialog=useRef<HTMLDialogElement>(null), hideDialog=useRef<HTMLDialogElement>(null);
  const cancelHide=()=>{if(busy)return;setConfirm(null);setSelected([]);setError("");};
  const [consentPrompt,setConsentPrompt]=useState<{id:string;version:number;title:string}[]>([]);
  const [showConsentManager,setShowConsentManager]=useState(false);
  useEffect(()=>{const dialog=rightsDialog.current;if(!dialog)return;if(showConsentManager&&!dialog.open)dialog.showModal();else if(!showConsentManager&&dialog.open)dialog.close();},[showConsentManager]);
  useEffect(()=>{const dialog=hideDialog.current;if(!dialog)return;if(confirm==="rejected"&&!dialog.open)dialog.showModal();else if(confirm!=="rejected"&&dialog.open)dialog.close();},[confirm]);
  const consentDialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const dialog=consentDialog.current;if(!dialog)return;if(consentPrompt.length&&!dialog.open)dialog.showModal();else if(!consentPrompt.length&&dialog.open)dialog.close();},[consentPrompt]);
  const locked = useRef(false), pending = useRef<{ key: string; requestId: string; approvalId?:string } | null>(null);
  const [editing,setEditing]=useState<string[]>([]);
  const [experienceEditRequest,setExperienceEditRequest]=useState<{id:string;nonce:number}>();
  const editingChanged=useCallback((id:string,open:boolean)=>setEditing(ids=>open?(ids.includes(id)?ids:[...ids,id]):ids.includes(id)?ids.filter(i=>i!==id):ids),[]);
  const [issues, setIssues] = useState<ReviewIssue[]>([]), [focusTarget, setFocusTarget] = useState<FocusTarget>();
  function correct(issue: ReviewIssue) { setFilter("active"); setSearch(""); setFocusTarget({ ...issue, nonce: Date.now() }); }
  const navigationNonce=useRef(0);
  const [navigation,setNavigation]=useState<{id:string|null;nonce:number}>();
  useEffect(()=>{
    if(!navigation||consentPrompt.length)return;
    const frame=requestAnimationFrame(()=>{
      if(navigation.id===null){document.getElementById("experience-title")?.focus({preventScroll:true});window.scrollTo({top:0,behavior:"smooth"});return;}
      const element=document.getElementById("experience-"+navigation.id)??document.getElementById("review-"+navigation.id);
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
        // A new reference document is enough: no second extraction chore.
        if (reference && !s.extractions.some(e => e.documentId === reference.id)) {
          setNotice("Lecture du document de référence…");
          const r = await fetch("/api/documents/" + reference.id);
          if (!r.ok) throw new Error("Le dernier document est indisponible. L’historique est conservé.");
          const extraction = await extractDocument(reference.originalName, await r.arrayBuffer());
          const next = await read("/api/experiences", { action: "extract", extraction: { documentId: reference.id, ...extraction } });
          if (live) { setState(next); setNotice(extraction.status === "extracted" ? "Document chargé. Nouveaux éléments à relire." : extraction.issue); }
        }
      }).catch(e => { if (live) setError(e.message); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [documentId]);

  async function act(body: Command, approveCreation=false, quiet=false) {
    if (locked.current) return false;
    // A creation may have succeeded while its follow-up approval failed.
    // Reuse the saved item/version when the draft is corrected and retried.
    const created=approveCreation&&body.action==="create"?state.items.find(item=>item.id===body.id):undefined;
    if(created){body={action:"edit",validate:true,id:created.id,version:created.version,data:body.data,permissions:{applicationAllowed:created.applicationAllowed,publicProfileAllowed:created.publicProfileAllowed}};approveCreation=false;}
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
      if(approveCreation&&body.action==="create"){
        setState(next);
        const created=next.items.find(item=>item.id===body.id);
        if(!created)throw new Error("Le contenu créé est introuvable. Actualisez les expériences.");
        const approval={action:"review",selection:[{id:created.id,version:created.version}],validation:"approved",confirmed:true,requestId:pending.current!.approvalId??(pending.current!.approvalId=crypto.randomUUID())};
        try{next=await read("/api/experiences",approval);}catch(problem){
          if(!(problem instanceof Error)||!["AbortError","TypeError"].includes(problem.name))throw problem;
          next=await read("/api/experiences",approval);
        }
      }
      setState(next); setSelected([]); setConfirm(null); pending.current = null;
      window.dispatchEvent(new Event("radar:experiences-changed"));
      if(body.action==="review"&&body.validation==="approved"){
        const ids=(body.selection as {id:string}[]).map(i=>i.id);
        setConsentPrompt(next.items.filter(i=>ids.includes(i.id)&&i.validation==="approved"&&sectionType(i)==="experience"&&!isSensitiveDetail(i)&&!i.applicationAllowed&&i.applicationConsent==="pending").map(i=>({id:i.id,version:i.version,title:detailHeading(i)})));
      }else if(body.action==="applicationConsent")setConsentPrompt([]);
      setIssues([]);
      if(approveCreation&&body.action==="create"||body.action==="edit"&&body.validate){
        setFilter("active");setSearch("");setNavigation({id:String(body.id),nonce:++navigationNonce.current});
      }else if(body.action==="review"&&body.validation==="approved"){
        const order=[...groups.flatMap(g=>[g,...childrenOf(g)]),...ungrouped].map(i=>i.id);
        const done=(body.selection as {id:string}[]).map(i=>i.id);
        setFilter("active");setSearch("");setNavigation({id:nextReviewTarget(next.items,order,done),nonce:++navigationNonce.current});
      }
      if(body.action === "restore") setFilter("proposed");
      setNotice("");
      if(!quiet)feedback({message:body.action==="create"?body.kind==="fact"?"Réalisation enregistrée.":"Expérience enregistrée.":body.action==="applicationConsent"?body.allowed?"Autorisation enregistrée.":"Contenu gardé privé.":body.action==="edit"?"Contenu enregistré.":body.action==="restore"?"Contenu restauré. À relire avant utilisation.":body.validation==="rejected"?"Contenu masqué.":body.validation==="approved"?"Contenu validé.":"Modification enregistrée."});
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
    try { setState(await read("/api/experiences")); setSelected([]); setConfirm(null); pending.current=null; setNotice("Expériences actualisées. Aucune page à recharger."); }
    catch { setError("Lecture impossible pour le moment. Vous pouvez réessayer."); }
  }
  const errorMessage = error ? <div role="alert" className="experience-error"><p>{error}</p>{issues.length ? <ul className="mt-3 space-y-3">{issues.map((issue,n) => <li key={n}><strong>{issue.title}</strong> · {issue.field==="reviewPoints"?"Question à résoudre":fieldNames[issue.field]} : « {issue.quote} » <button type="button" className="underline" disabled={busy} onClick={() => correct(issue)}>Corriger ce passage</button></li>)}</ul> : <button type="button" className="ml-3 underline" disabled={busy} onClick={refresh}>Actualiser les expériences</button>}</div> : null;

  const active = currentItems(state.items, state.reference?.documentId).map(i=>({...i,data:structuredReview(i.data)}));
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
  const toggle = (ids: string[]) => { setSelected(s => ids.every(id => s.includes(id)) ? s.filter(id => !ids.includes(id)) : [...new Set([...s, ...ids])]); setConfirm(null); };
  const prepare = (items: ExperienceItem[], action: "approved" | "rejected") => {
    if(action==="approved"){const found=items.flatMap(reviewIssues);setIssues(found);if(found.length){setError("Choisissez une réponse pour chaque question avant de valider.");correct(found[0]);return;}void act({action:"review",selection:selectedVersions(items),validation:"approved",confirmed:true});return;}
    setSelected(items.map(i=>i.id));setConfirm(action);setReason("hidden");setDuplicateOf("");setIssues([]);setError("");
  };
  const visible = (i: ExperienceItem) => (filter === "active" ? i.validation !== "rejected" : filter === "proposed" ? i.validation !== "rejected" && (i.validation === "proposed" || childrenOf(i).some(c => c.validation === "proposed")) : filter === "rejected" ? i.validation === "rejected" || childrenOf(i).some(c => c.validation === "rejected") : i.validation === filter) && (!search || (i.data.title + " " + i.data.organization + " " + i.data.context + " " + childrenOf(i).map(c => c.data.context).join(" ")).toLowerCase().includes(search.toLowerCase()));
  const hiddenCount = active.filter(i => i.validation === "rejected" && (i.kind === "experience" || !i.parentId || groups.some(g => g.id === i.parentId && g.validation !== "rejected"))).length;
  const duplicateTargets = active.filter(i => !selected.includes(i.id) && i.validation !== "rejected" && (chosen.some(s => s.kind === "experience") ? i.kind === "experience" && sectionType(i) === "experience" : i.kind === "fact"));

  const rightsValue=(item:ExperienceItem,draft=rightsDraft)=>draft[item.id]??{applicationAllowed:item.applicationAllowed,publicProfileAllowed:item.publicProfileAllowed};
  function changeRight(item:ExperienceItem,key:RightsKey,checked:boolean){
    setRightsDraft(draft=>{
      const next={...draft};
      const set=(target:ExperienceItem,value:boolean)=>{next[target.id]={...rightsValue(target,next),[key]:value};};
      if(item.kind==="experience"){
        for(const member of family(item).filter(i=>i.validation!=="rejected"))if(!checked||member.validation==="approved")set(member,checked);
      }else{
        set(item,checked);
        const parent=groups.find(g=>g.id===item.parentId);
        if(parent?.validation==="approved"){
          if(checked)set(parent,true);
          else if(!childrenOf(parent).some(i=>i.validation==="approved"&&rightsValue(i,next)[key]))set(parent,false);
        }
      }
      return next;
    });
  }
  function rightsRow(item:ExperienceItem,organization:string){
    const value=rightsValue(item);
    const disabled=rightsSaving||busy||item.validation!=="approved";
    const grouped=item.kind==="experience";
    const members=grouped?family(item).filter(i=>i.validation==="approved"):[item];
    const rowTitle=grouped&&sectionType(item)==="experience"?"Toute l’expérience":detailHeading(item);
    return <div className={`library-rights-row ${grouped?"is-parent":"is-example"}`} key={item.id}><span className="library-rights-label">{rowTitle}{item.validation!=="approved"?<small>À valider</small>:null}</span>{([['applicationAllowed','Candidatures'],['publicProfileAllowed','Présentation pro']] as const).map(([key,label])=>{
      const all=members.length>0&&members.every(i=>rightsValue(i)[key]);
      const partial=grouped&&members.some(i=>rightsValue(i)[key])&&!all;
      return <label className="library-permission" key={key}><RightsCheckbox disabled={disabled} checked={grouped?all:value[key]} mixed={partial} label={`${label} · ${organization} · ${rowTitle}`} onChange={checked=>changeRight(item,key,checked)}/><span>{label}</span></label>;
    })}</div>;
  }
  async function saveRights(){
    if(rightsLock.current)return;
    rightsLock.current=true;
    setRightsSaving(true);
    try{
      const changes=active.filter(i=>rightsDraft[i.id]&&(rightsDraft[i.id].applicationAllowed!==i.applicationAllowed||rightsDraft[i.id].publicProfileAllowed!==i.publicProfileAllowed));
      for(const item of changes)if(!await act({action:"usage",selection:selectedVersions([item]),permissions:rightsDraft[item.id]},false,true))return;
      setRightsDraft({});setShowConsentManager(false);setNotice("");feedback({message:"Droits d’usage enregistrés."});
    }finally{rightsLock.current=false;setRightsSaving(false);}
  }
  const editorLocked=(id:string)=>busy||loading||adding||addingTo!==null||editing.some(other=>other!==id);
  function card(item: ExperienceItem) {
    const parentHidden=groups.some(g=>g.id===item.parentId&&g.validation==="rejected");
    return <DetailCard key={item.id} item={item} onEditing={editingChanged} focusTarget={focusTarget} experiences={groups} selected={selected.includes(item.id)} busy={editorLocked(item.id)} onSelect={() => toggle([item.id])} onSave={act} onReview={parentHidden?undefined:action => prepare([item], action)} />;
  }
  function group(g: ExperienceItem) {
    if (!visible(g)) return null;
    const children = childrenOf(g).filter(i => filter === "rejected" ? g.validation === "rejected" || i.validation === "rejected" : i.validation !== "rejected"), context = children.filter(isContextOnly), details = children.filter(i => !isContextOnly(i));
    const heading = experienceHeading(g), hidden = g.validation === "rejected";
    return <ExpandableSection key={g.id} id={"experience-"+g.id} tabIndex={-1} headerActions={<button type="button" className="library-experience-pencil" aria-label={`Modifier l’expérience chez ${heading.organization}`} title="Modifier l’expérience" disabled={hidden||editorLocked(g.id)||editing.length>0} onClick={()=>setExperienceEditRequest({id:g.id,nonce:++navigationNonce.current})}><Pencil size={15} aria-hidden/></button>} className={"experience-group "+(family(g).some(i=>i.validation==="proposed")?"needs-review":"")} title={<><h3 className="experience-group-heading"><strong>{heading.organization}</strong><span>{heading.role}</span><small>{heading.period}</small></h3></>} status={<span className={"experience-status " + (hidden ? "is-hidden" : family(g).every(i=>i.validation!=="proposed") ? "is-approved" : "")}>{!hidden&&family(g).some(i=>i.validation==="proposed")?"À relire":itemStatus(g)}</span>}>

      <div className="experience-group-body">
        {!editing.includes(g.id) && g.data.context && g.data.context !== g.data.title ? <RichText text={g.data.context} /> : null}
        {context.map(c => <div className="experience-company-context" key={c.id}><RichText text={c.data.context.replace(/^###\s+Contexte\s*\n?/i, "")} />{c.validation === "rejected" && !hidden ? <button className="secondary-button mt-3" disabled={busy || loading} onClick={()=>act({action:"restore",selection:selectedVersions([c])})}>Restaurer le contexte</button> : null}</div>)}
        <DetailCard item={g} metadata editRequest={experienceEditRequest} onEditing={editingChanged} focusTarget={focusTarget} experiences={groups} selected={selected.includes(g.id)} busy={editorLocked(g.id)} onSelect={() => toggle([g.id])} onSave={act}
          actions={hidden?<WorkspaceButton disabled={busy||loading} onClick={()=>act({action:"restore",selection:selectedVersions(family(g))})}><Undo2 size={15}/>Restaurer</WorkspaceButton>:null}
          onHide={hidden?undefined:()=>prepare(family(g),"rejected")}/>
        {context.map(c=><DetailCard key={c.id} item={c} onEditing={editingChanged} focusTarget={focusTarget} metadata experiences={groups} selected={selected.includes(c.id)} busy={editorLocked(c.id)} onSelect={()=>toggle([c.id])} onSave={act}/>)}
        <div className="experience-details-heading"><p>{sectionType(g) === "knowledge" ? "Détails documentés" : "Missions et réalisations"}</p><span>{details.length?`${details.length} ${sectionType(g)==="knowledge"?"élément":"réalisation"}${details.length>1?"s":""}`:""}</span>{!hidden && addingTo!==g.id && sectionType(g) === "experience" ? <button type="button" className="secondary-button" disabled={busy||loading||adding||addingTo!==null||editing.length>0} onClick={() => setAddingTo(g.id)}><Plus size={15} /> Ajouter une réalisation</button> : null}</div>
        {addingTo === g.id ? <InlineExampleForm key={g.id} parentId={g.id} busy={busy} onCancel={() => setAddingTo(null)} onSave={async body => { if (await act(body,true)) { setAddingTo(null); setFilter("active"); setSearch(""); } }} /> : null}
        {details.map(card)}
        {!details.length ? <p className="text-sm text-muted-foreground">Ajoutez une réalisation pour illustrer cette expérience.</p> : null}
      </div>
    </ExpandableSection>;
  }

  const reviewCount=[...groups.filter(g=>g.validation!=="rejected").flatMap(family),...ungrouped].filter(i=>i.validation==="proposed").length;
  return <section className="experience-library glass-panel mt-6 p-5 sm:p-7" aria-labelledby="experience-title" aria-busy={busy || loading}>
    <div data-radar-guide-slot />
    <WorkspacePanelHeader id="experience-title" title="Mes expériences" className="experience-library-heading library-heading-simple" hint={<LibraryHint label="D’où viennent ces informations ?">Les expériences proposées peuvent venir de vos documents. Vous pouvez les corriger, les compléter ou en ajouter à la main.</LibraryHint>} actions={<><WorkspaceButton aria-haspopup="dialog" disabled={busy||loading||adding||addingTo!==null||editing.length>0} onClick={()=>{setRightsDraft({});setError("");setShowConsentManager(true);}}><SlidersHorizontal size={15} aria-hidden/>Droits d’usage</WorkspaceButton>{!adding?<WorkspaceButton variant="primary" disabled={busy||loading||addingTo!==null||editing.length>0} onClick={()=>setAdding(true)}><Plus size={15} aria-hidden/>Ajouter une expérience</WorkspaceButton>:null}</>}/>

    <p className="workspace-caption mt-3">Rassemblez vos expériences et réalisations vérifiables pour préparer des candidatures et votre présentation professionnelle. Relisez et validez chaque fait, puis choisissez dans Droits d’usage ceux que Radar peut réutiliser. Rien n’est publié ni envoyé automatiquement.</p>

    {state.extractions.find(e=>e.documentId===state.reference?.documentId)?.status==="needs_conversion"?<p role="alert" className="experience-error">{state.extractions.find(e=>e.documentId===state.reference?.documentId)?.issue||"Ce document nécessite une conversion en texte lisible."}</p>:null}
    <dialog ref={rightsDialog} aria-labelledby="library-rights-title" className="signal-library-dialog library-rights-dialog" onCancel={event=>{event.preventDefault();if(!rightsSaving&&!busy){setShowConsentManager(false);setRightsDraft({});}}}>
      <header className="library-dialog-heading"><div><h2 id="library-rights-title">Droits d’usage</h2><p>Choisissez où chaque contenu peut être utilisé. Sans autorisation, il reste privé.</p></div><button type="button" className="library-close" aria-label="Fermer les droits d’usage" disabled={rightsSaving||busy} onClick={()=>{setShowConsentManager(false);setRightsDraft({});}}><X size={19}/></button></header>
      <div className="library-dialog-body"><div className="library-rights-columns"><span>Contenu</span><span className="library-column-title">Candidatures<LibraryHint label="Usage dans les candidatures">Inclut les contenus sélectionnés dans les prompts de candidature. Cocher une expérience sélectionne ses contenus validés ; vous pouvez ensuite décocher des exemples.</LibraryHint></span><span className="library-column-title">Présentation pro<LibraryHint label="Usage dans une présentation professionnelle">Permet de réutiliser les contenus sélectionnés dans une présentation professionnelle à partager, par exemple une bio LinkedIn. Cette case ne publie rien. La sélection par expérience fonctionne comme pour les candidatures.</LibraryHint></span></div>{groups.filter(g=>g.validation!=="rejected").map(g=><section className="library-rights-group" key={g.id} aria-label={experienceHeading(g).organization}><h3>{experienceHeading(g).organization}<span>{experienceHeading(g).role}</span></h3>{rightsRow(g,experienceHeading(g).organization)}{childrenOf(g).some(i=>i.validation!=="rejected")?<div className="library-rights-examples">{childrenOf(g).filter(i=>i.validation!=="rejected").map(i=>rightsRow(i,experienceHeading(g).organization))}</div>:null}</section>)}{ungrouped.filter(i=>i.validation!=="rejected").map(i=>rightsRow(i,"Complément personnel"))}{!active.length?<p>Aucun contenu enregistré.</p>:null}{errorMessage}</div>
      <footer className="library-dialog-actions"><button type="button" className="secondary-button signal-form-button" disabled={rightsSaving||busy} onClick={()=>{setShowConsentManager(false);setRightsDraft({});}}>Annuler</button><button type="button" className="radar-add-button signal-form-button" disabled={rightsSaving||busy||!Object.keys(rightsDraft).some(id=>{const i=active.find(i=>i.id===id),d=rightsDraft[id];return i&&(i.applicationAllowed!==d.applicationAllowed||i.publicProfileAllowed!==d.publicProfileAllowed);})} onClick={()=>void saveRights()}>{rightsSaving?"Enregistrement…":"Enregistrer"}</button></footer>
    </dialog>
    <dialog ref={hideDialog} aria-labelledby="library-hide-title" className="signal-library-dialog library-hide-dialog" onCancel={event=>{event.preventDefault();cancelHide();}}>
      <header className="library-dialog-heading"><div><h2 id="library-hide-title">{reason==="duplicate"?"Signaler un doublon":chosen.some(i=>i.kind==="experience")?"Masquer cette expérience ?":"Masquer ce contenu ?"}</h2><p>Le contenu reste restaurable depuis la vue « Masqués ».</p></div><button type="button" className="library-close" aria-label="Fermer la confirmation" disabled={busy} onClick={cancelHide}><X size={19}/></button></header>
      <div className="library-dialog-body"><div className="library-hide-target"><strong>{chosen.find(i=>i.kind==="experience")?experienceHeading(chosen.find(i=>i.kind==="experience")!).organization:chosen[0]?detailHeading(chosen[0]):"Contenu sélectionné"}</strong><span>{chosen.some(i=>i.kind==="experience")?`L’expérience et ${chosen.filter(i=>i.kind!=="experience").length} contenu${chosen.filter(i=>i.kind!=="experience").length>1?"s":""}`:`${chosen.length} contenu${chosen.length>1?"s":""}`}</span><details><summary>Voir les contenus concernés</summary><ul>{chosen.map(i=><li key={i.id}>{detailHeading(i)}</li>)}</ul></details></div>
      <fieldset className="library-hide-reasons"><legend>Action</legend><label><input type="radio" name="hide-reason" value="hidden" checked={reason==="hidden"} disabled={busy} onChange={()=>{setReason("hidden");setDuplicateOf("");}}/><span>Masquer</span></label><label><input type="radio" name="hide-reason" value="duplicate" checked={reason==="duplicate"} disabled={busy} onChange={()=>{setReason("duplicate");setDuplicateOf("");}}/><span>Signaler un doublon</span></label></fieldset>
      {reason==="duplicate"?<><label className="library-duplicate-field">Contenu à conserver<select aria-label="Contenu à conserver" disabled={busy} value={duplicateOf} onChange={event=>setDuplicateOf(event.target.value)}><option value="">Choisir…</option>{duplicateTargets.map(i=><option key={i.id} value={i.id}>{i.kind==="experience"?`${experienceHeading(i).organization} · ${experienceHeading(i).role}`:detailHeading(i)}</option>)}</select></label>{!duplicateTargets.length?<p className="review-help">Aucun autre contenu compatible. Vous pouvez simplement masquer celui-ci.</p>:null}</>:null}{selection.length>100?<p role="alert">Sélectionnez au maximum 100 contenus.</p>:null}{errorMessage}</div>
      <footer className="library-dialog-actions"><button type="button" className="secondary-button signal-form-button" disabled={busy} onClick={cancelHide}>Annuler</button><button type="button" className="signal-danger-button signal-form-button" disabled={busy||selection.length>100||!selection.length||(reason==="duplicate"&&!duplicateOf)} onClick={async()=>{if(await act({action:"review",selection,validation:"rejected",confirmed:true,reason,...(reason==="duplicate"?{duplicateOf}:{})},false,true)){setNotice("");feedback({message:reason==="duplicate"?"Doublon masqué.":"Contenu masqué.",action:{label:"Voir les contenus masqués",onClick:()=>setFilter("rejected")}});}}}>{busy?"Enregistrement…":reason==="duplicate"?"Masquer le doublon":"Masquer"}</button></footer>
    </dialog>
    <dialog ref={consentDialog} aria-label="Autoriser la personnalisation des candidatures" className="experience-consent-dialog" onCancel={e=>{e.preventDefault();if(!busy&&consentPrompt.length)void act({action:"applicationConsent",selection:consentPrompt.map(({id,version})=>({id,version})),allowed:false});}}>{consentPrompt.length?<><strong>Utiliser ce contenu pour vos candidatures ?</strong><p className="mt-2 text-sm">{consentPrompt.length} bloc{consentPrompt.length>1?"s viennent":" vient"} d’être validé{consentPrompt.length>1?"s":""}. Autoriser {consentPrompt.length>1?"leur":"son"} utilisation pour personnaliser vos candidatures ?</p><ul className="my-3 list-disc pl-5 text-xs">{consentPrompt.map(i=><li key={i.id}>{i.title}</li>)}</ul><div className="experience-actions"><button type="button" className="radar-add-button" disabled={busy} onClick={()=>act({action:"applicationConsent",selection:consentPrompt.map(({id,version})=>({id,version})),allowed:true})}>Autoriser la personnalisation</button><button type="button" className="secondary-button" disabled={busy} onClick={()=>act({action:"applicationConsent",selection:consentPrompt.map(({id,version})=>({id,version})),allowed:false})}>Pas maintenant</button></div>{errorMessage}</>:null}</dialog>
    {notice ? <p role="status" className="my-3 text-sm text-primary">{notice}</p> : null}
    {!selection.length ? errorMessage : null}
    {loading ? <LoadingSkeleton label="Chargement de votre parcours…" /> : null}
    {adding ? <ManualForm busy={busy} onCancel={()=>setAdding(false)} onSave={async body => { if (await act(body,true)) setAdding(false); }} /> : null}
    <div className="experience-filters"><ChoiceSelect label="Afficher" value={filter} onChange={value=>{setFilter(value);setSelected([]);setConfirm(null);}} options={[{value:"active",label:"Tout le parcours"},{value:"proposed",label:`À relire${reviewCount?` (${reviewCount})`:""}`},{value:"approved",label:"Validés"},{value:"rejected",label:`Masqués${hiddenCount?` (${hiddenCount})`:""}`}]} /><label className="experience-search"><span>Rechercher</span><input className={inputClass} value={search} onChange={e => setSearch(e.target.value)} placeholder="Entreprise, mission, réalisation…" /></label></div>
    <div className="space-y-4">{groups.filter(g => sectionType(g) === "experience").map(group)}</div>
    {groups.some(g => sectionType(g) === "knowledge" && visible(g)) ? <ExpandableSection className="experience-secondary" title={<>Compétences, formation et langues</>}><div className="mt-4 space-y-4">{groups.filter(g => sectionType(g) === "knowledge").map(group)}</div></ExpandableSection> : null}
    {ungrouped.some(visible) ? <ExpandableSection className="experience-secondary" title={<>Compléments personnels non rattachés à une expérience</>}>{ungrouped.filter(visible).map(card)}</ExpandableSection> : null}
    {!groups.some(visible) && !loading ? <p className="my-6 text-sm text-muted-foreground">Aucune expérience dans cette vue. Essayez « Tout le parcours » ou « Masqués ».</p> : null}
    <ExpandableSection ref={documentHistory} id="experience-document-history" className="experience-secondary" title={<>Historique des documents</>}>{docs.map(d => <div key={d.id} className="experience-document"><div><a className="text-sm underline" href={"/api/documents/" + d.id} target="_blank" rel="noreferrer">{d.originalName}</a><p className="text-xs">{d.id === state.reference?.documentId ? "Référence courante" : "Document secondaire / ancienne version — conservé"}{d.createdAt ? " · " + d.createdAt.slice(0, 10) : ""}</p></div>{d.id === state.reference?.documentId ? <button className="secondary-button" disabled={busy || loading} onClick={() => extract(d)}>Relire sans doublon</button> : null}</div>)}<ExpandableSection className="mt-4" title={<>Blocs des anciennes versions et résumés ({historical.length})</>}>{historical.map(i => <HistoricalItem key={i.id} item={i} />)}</ExpandableSection></ExpandableSection>
    {conflicts.length ? <ExpandableSection className="experience-secondary" title={<>Points à comparer dans la version courante ({conflicts.filter(c => c.state === "open").length} ouverts)</>}><p className="my-3 text-xs">Les CV et les anciennes versions ne sont pas des contradictions : le dernier document détaillé est prioritaire.</p>{conflicts.map(c => <ConflictCard key={c.id} conflict={c} items={active} busy={busy} onSave={act} />)}</ExpandableSection> : null}
  </section>;
}

function RightsCheckbox({checked,mixed,disabled,label,onChange}:{checked:boolean;mixed:boolean;disabled:boolean;label:string;onChange:(checked:boolean)=>void}){
  const input=useRef<HTMLInputElement>(null);
  useEffect(()=>{if(input.current)input.current.indeterminate=mixed;},[mixed]);
  return <input ref={input} type="checkbox" checked={checked} disabled={disabled} aria-checked={mixed?"mixed":checked} aria-label={label} title={mixed?"Sélection partielle":undefined} onChange={event=>onChange(event.target.checked)}/>;
}

function LibraryHint({label,children}:{label:string;children:ReactNode}){
  const id=useId(),[open,setOpen]=useState(false);
  return <span className="library-hint" onMouseEnter={()=>setOpen(true)} onMouseLeave={event=>{if(!event.currentTarget.contains(document.activeElement))setOpen(false);}} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))setOpen(false);}}><button type="button" className="help-tooltip-trigger library-hint-trigger" aria-label={`À propos de : ${label}`} aria-describedby={open?id:undefined} onFocus={()=>setOpen(true)} onClick={()=>setOpen(true)} onKeyDown={event=>{if(event.key==="Escape"&&open){event.preventDefault();event.stopPropagation();setOpen(false);}}}><CircleHelp size={14} aria-hidden/></button>{open?<span id={id} role="tooltip" className="library-hint-content">{children}</span>:null}</span>;
}

function inline(text: string): ReactNode[] { return text.split(/(\*\*[^*]+\*\*)/g).map((part, n) => part.startsWith("**") ? <strong key={n}>{part.slice(2, -2)}</strong> : part); }
function RichText({ text }: { text: string }) {
  return <div className="experience-rich-text">{text.trim().split(/\n\s*\n/).map((paragraph, n) => {
    if (/^###\s/.test(paragraph)) { const [heading,...body]=paragraph.split("\n"); return <div key={n}><p className="experience-passage-title">{inline(heading.replace(/^###\s+/, ""))}</p>{body.length?<RichText text={body.join("\n")}/>:null}</div>; }
    if (paragraph.split("\n").every(line => /^\s*[-*]\s/.test(line))) return <ul key={n}>{paragraph.split("\n").map((line, i) => <li key={i}>{inline(line.replace(/^\s*[-*]\s+/, ""))}</li>)}</ul>;
    return <p key={n}>{inline(paragraph)}</p>;
  })}</div>;
}
function HistoricalItem({ item }: { item: ExperienceItem }) {
  const [revisions, setRevisions] = useState<Revision[]>([]), [error, setError] = useState("");
  return <ExpandableSection className="my-3 rounded-xl bg-white/60 p-3" title={<>{item.data.title}</>} status={<span className="experience-status">{itemStatus(item)}</span>}><RichText text={item.data.context} /><button className="secondary-button" onClick={async () => { try { setRevisions((await read<{ revisions: Revision[] }>("/api/experiences?history=" + encodeURIComponent(item.id))).revisions); } catch { setError("Historique indisponible. Réessayez."); } }}>Voir les versions</button>{error ? <p role="alert">{error}</p> : null}<History revisions={revisions} /></ExpandableSection>;
}
function DetailCard({ item, metadata, editRequest, actions, onHide, onEditing, focusTarget, experiences, selected, onSelect, busy, onSave, onReview }: { item: ExperienceItem; metadata?: boolean; editRequest?:{id:string;nonce:number}; actions?: ReactNode; onHide?:()=>void; onEditing?:(id:string,open:boolean)=>void; focusTarget?: FocusTarget; experiences: ExperienceItem[]; selected: boolean; onSelect: () => void; busy: boolean; onSave: (body: Command) => Promise<boolean>; onReview?: (action: "approved" | "rejected") => void }) {
  const [edit, setEdit] = useState(false), [parentId, setParentId] = useState(item.parentId || ""), [revisions, setRevisions] = useState<Revision[]>([]), [error, setError] = useState("");
  const root = useRef<HTMLDivElement>(null);
  useEffect(()=>{onEditing?.(item.id,edit);return()=>onEditing?.(item.id,false);},[edit,item.id,onEditing]);
  const [historyVisible,setHistoryVisible]=useState(false),[historyLoading,setHistoryLoading]=useState(false);
  useEffect(()=>{if(editRequest?.id!==item.id)return;const frame=requestAnimationFrame(()=>{revealCollapsibleAncestors(root.current);setEdit(true);});return()=>cancelAnimationFrame(frame);},[editRequest,item.id]);
  const target = focusTarget?.itemId === item.id ? focusTarget : undefined;
  useEffect(() => {
    if (!target) return;
    revealCollapsibleAncestors(root.current);
    setEdit(true);
  }, [target]);
  const title = detailHeading(item), heading = /^###\s+[^\n]+\n?/.exec(item.data.context)?.[0];
  const parent = experiences.find(i=>i.id===item.parentId);
  const body = heading ? item.data.context.slice(heading.length).trim() : item.data.context;
  return <ExpandableSection ref={root} plain={!!metadata&&item.kind==="experience"} headerActions={!(metadata&&item.kind==="experience")?<button type="button" className="library-experience-pencil" aria-label={metadata?"Modifier le contexte":`Modifier la réalisation « ${title} »`} title={metadata?"Modifier le contexte":"Modifier la réalisation"} disabled={busy||edit||item.validation==="rejected"||parent?.validation==="rejected"} onClick={()=>{revealCollapsibleAncestors(root.current);setEdit(true);}}><Pencil size={15} aria-hidden/></button>:undefined} id={"review-"+item.id} tabIndex={-1} className={"experience-detail "+(item.validation==="proposed"?"needs-review":"")+(metadata&&item.kind==="experience"&&!edit&&!historyVisible&&!actions?" library-parent-idle":"")} title={<><h4 className="experience-example-title">{metadata ? item.kind==="experience"?"Détails de l’expérience":"Contexte de l’entreprise" : title}</h4></>} status={<span className={"experience-status "+(item.validation==="approved"?"is-approved":item.validation==="rejected"?"is-hidden":"")}>{itemStatus(item,parent)}</span>}>

    <div className="experience-example-body">

    {!metadata&&!edit ? <>{item.kind==="fact"?<ExampleSummary data={item.data} renderText={text=><RichText text={text}/>}/>:<RichText text={body===title?"":body}/>} {(item.data.reviewPoints||[]).filter(q=>q.decision==="confirmed").map(q=><p key={q.id} className="mt-3 text-sm">{q.answer}</p>)}</>:null}
    {!edit && (item.data.reviewPoints||[]).some(q=>q.decision==="pending") ? <button className="review-question-summary" onClick={()=>setEdit(true)}>Répondre aux {(item.data.reviewPoints||[]).filter(q=>q.decision==="pending").length} question(s) en suspens</button>:null}
    {!edit&&(actions||onReview&&item.validation==="rejected")?<div className="experience-actions library-content-actions library-simple-actions">{actions}{!actions&&onReview&&item.validation==="rejected"?<WorkspaceButton disabled={busy} onClick={()=>void onSave({action:"restore",selection:selectedVersions([item])})}>Restaurer</WorkspaceButton>:null}</div>:null}

    {historyLoading?<p role="status" className="review-help">Lecture des versions…</p>:null}

    {edit ? <div><ItemForm key={item.version} initial={item.data} item={item} focusTarget={target} busy={busy} onCancel={()=>setEdit(false)} advancedContent={dirty=><>{item.kind==="fact"?<ChoiceSelect label="Expérience concernée" value={parentId} onChange={setParentId} options={[{value:"",label:"Complément non rattaché"},...experiences.map(g=>({value:g.id,label:g.data.title}))]}/>:null}<div className="library-management-actions">{onHide||onReview&&item.validation!=="rejected"?<WorkspaceButton disabled={busy||dirty||parentId!==(item.parentId||"")} onClick={()=>{if(onHide)onHide();else onReview?.("rejected");}}>Masquer</WorkspaceButton>:null}{onReview&&item.validation==="rejected"?<WorkspaceButton disabled={busy} onClick={()=>void onSave({action:"restore",selection:selectedVersions([item])})}>Restaurer</WorkspaceButton>:null}<WorkspaceButton disabled={busy||historyLoading} onClick={async()=>{setError("");setHistoryLoading(true);try{setRevisions((await read<{revisions:Revision[]}>("/api/experiences?history="+encodeURIComponent(item.id))).revisions);setHistoryVisible(true);}catch{setError("Historique indisponible. Réessayez.");}finally{setHistoryLoading(false);}}}>Versions et origine</WorkspaceButton></div></>} onSubmit={async(data,permissions)=>{setError("");if(await onSave({action:"edit",validate:true,id:item.id,version:item.version,data,permissions,...(item.kind==="fact"?{parentId:parentId||null}:{})})){setEdit(false);}else setError("Correction non enregistrée. Votre saisie reste ici : consultez le message affiché dans Mes expériences avant de réessayer.");}}/></div>:null}

    {error ? <p role="alert" className="experience-error">{error}</p> : null}
    {historyVisible?<section className="library-content-history" aria-label="Versions et origine"><div className="signal-section-heading"><h4>Versions et origine</h4><WorkspaceButton variant="quiet" aria-label="Fermer les versions et l’origine" onClick={()=>setHistoryVisible(false)}><X size={15}/></WorkspaceButton></div><p className="review-help">Le fichier d’origine et les versions enregistrées de ce contenu.</p>{item.data.provenance.map((p,n)=><div key={n} className="library-origin"><p>{p.name}{p.page?" · page "+p.page:""}{p.line?" · ligne "+p.line:""}</p><blockquote>{p.quote}</blockquote></div>)}{!item.data.provenance.length?<p className="review-help">Aucun extrait de fichier associé.</p>:null}<History revisions={revisions}/>{!revisions.length?<p className="review-help">Aucune version enregistrée disponible.</p>:null}</section>:null}

    </div>
  </ExpandableSection>;
}
function History({ revisions }: { revisions: Revision[] }) { return <div>{revisions.map(r => <ExpandableSection key={r.version} className="my-2 border-t py-2 text-xs" title={<>Version {r.version} · {new Date(r.createdAt).toLocaleString("fr-FR")}</>} status={<span className="experience-status">{itemStatus(r.snapshot)}</span>}><RichText text={r.snapshot.data.context} /><p>Contribution : {r.snapshot.data.contribution || "Non documentée"}</p><p>Résultat : {r.snapshot.data.result || "Non documenté"}</p>{(r.snapshot.data.reviewPoints||[]).map(q=><div key={q.id} className="my-3"><p>Question privée : {q.question}</p><p>Décision : {q.decision==="confirmed"?"Confirmée":q.decision==="excluded"?"Non retenue":"En suspens"}</p>{q.decision==="confirmed"?<p>Précision retenue : {q.answer}</p>:null}</div>)}<p>{r.snapshot.applicationAllowed ? "Candidatures autorisées" : "Sans usage candidature"} · {r.snapshot.publicProfileAllowed ? "Présentation pro autorisée" : "Sans usage présentation pro"}</p></ExpandableSection>)}</div>; }
function ItemForm({ initial, item, example=false, focusTarget, busy, onSubmit, onCancel, advancedContent }: { initial: ItemData; item?: ExperienceItem; example?:boolean; onCancel?:()=>void; advancedContent?:ReactNode|((dirty:boolean)=>ReactNode); focusTarget?: FocusTarget; busy: boolean; onSubmit: (data: EditFields, permissions: { applicationAllowed: boolean; publicProfileAllowed: boolean }) => void }) {
  const [data, setData] = useState(fieldsOnly(item?.kind === "experience" ? {...initial,...experienceHeading(item)} : initial));
  const [advanced,setAdvanced]=useState(false);
  const [points,setPoints]=useState(structuredReview(initial).reviewPoints || []);
  const form = useRef<HTMLFormElement>(null);
  useEffect(()=>{if(!focusTarget)form.current?.querySelector<HTMLInputElement>("input:not([type=hidden])")?.focus();},[]);
  const permissions = { applicationAllowed: item?.applicationAllowed ?? false, publicProfileAllowed: item?.publicProfileAllowed ?? false };
  const isExample=example||item?.kind==="fact";
  const isExperience=!isExample;
  const contextHeading=/^###\s+[^\r\n]+(?:\r?\n)?/.exec(data.context)?.[0]??"";
  const generatedTitle=([data.organization,data.role].filter(Boolean).join(" — ")+(data.period?` (${data.period})`:"")||data.title).slice(0,180);
  const problems = item ? reviewIssues({...item, data:{...initial,...data,reviewModel:1,reviewPoints:points}}) : [];
  useEffect(() => {
    if (!focusTarget) return;
    if(focusTarget.field==="reviewPoints"){const input=form.current?.querySelectorAll<HTMLElement>("[data-review-point]")[focusTarget.start];const control=Array.from(input?.querySelectorAll<HTMLElement>("button")??[]).find(element=>element.getClientRects().length>0);(control??input)?.focus();input?.scrollIntoView({block:"center",behavior:"smooth"});return;}
    const inputs = Array.from(form.current?.querySelectorAll<HTMLTextAreaElement>("textarea[data-field]") || []);
    const input = inputs.find(el => focusTarget.field === "context" && el.dataset.contextRanges ? JSON.parse(el.dataset.contextRanges).some(([start,end]:number[])=>start<=focusTarget.start&&end>=focusTarget.end) : el.dataset.field === focusTarget.field && (focusTarget.field !== "context" || (Number(el.dataset.start) <= focusTarget.start && Number(el.dataset.end) >= focusTarget.end)));
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
  return <form ref={form} className="experience-edit-form my-4 grid gap-4 rounded-xl bg-background p-4 sm:grid-cols-2" onSubmit={e => { e.preventDefault(); onSubmit({...data,...(isExperience?{title:generatedTitle}:{}),reviewModel:1,reviewPoints:points}, permissions); }}>
    {!isExperience?<p className="library-edit-intro sm:col-span-2">{item?"Complétez les faits utiles pour vos candidatures. L’enregistrement valide ce contenu.":"Quelques faits concrets suffisent pour commencer."}</p>:null}
    {points.length?<fieldset className="review-questions sm:col-span-2">
      <legend>Points à confirmer <span className="experience-status">{points.filter(q=>q.decision==="pending").length} en suspens</span></legend>
      <p className="text-xs leading-5">Confirmez les faits connus ou choisissez « Ne pas utiliser cette information ».</p>
      {points.map((q,n)=><div key={q.id} className="review-question">
        <label className="block text-sm">Question {n+1}<Textarea aria-label={"Question "+(n+1)} disabled={busy} className={inputClass} value={q.question} maxLength={6000} onChange={e=>setPoints(points.map((p,i)=>i===n?{...p,question:e.target.value}:p))}/></label>
        <div data-review-point><ChoiceSelect label="Votre décision" disabled={busy} value={q.decision} onChange={value=>setPoints(points.map((p,i)=>i===n?{...p,decision:value as typeof p.decision}:p))} options={[{value:"pending",label:"Je dois encore vérifier"},{value:"confirmed",label:"Préciser et confirmer"},{value:"excluded",label:"Ne pas utiliser cette information"}]} /></div>
        {q.decision==="confirmed"?<label className="block text-sm">Ce que je confirme<Textarea required className={inputClass} disabled={busy} maxLength={4000} value={q.answer} onChange={e=>setPoints(points.map((p,i)=>i===n?{...p,answer:e.target.value}:p))} placeholder="Décrivez le fait confirmé et ses limites, avec vos mots."/></label>:q.decision==="excluded"?<p className="text-xs">Conservée uniquement dans votre historique privé ; non reprise dans les briefs.</p>:null}
      </div>)}
    </fieldset>:null}
    {(Object.keys(fieldNames) as (keyof Fields)[]).filter(k => item?.kind === "experience" ? !["contribution", "result", "claimKey"].includes(k) : item?.kind!=="fact" || advanced || ["title","context","contribution","result"].includes(k)).filter(k=>(!isExperience||!["title","contribution","result","claimKey"].includes(k))&&(!isExample||!["context","contribution","result"].includes(k))).filter(k=>!isExample||k==="title"||!!item&&advanced).map(k =>
      k === "context" ? <label key={k} className="library-example-field sm:col-span-2"><span>Présentation de l’entreprise et des produits{!item?" · obligatoire":""}</span><Textarea required={!item} disabled={busy} aria-label="Présentation de l’entreprise et des produits" data-field="context" data-start={contextHeading.length} data-end={data.context.length} rows={5} maxLength={6000-contextHeading.length} value={data.context.slice(contextHeading.length).trimStart()} onChange={event=>setData({...data,context:contextHeading+event.target.value})} placeholder="Présentez brièvement l’activité de l’entreprise, ses produits ou services et les publics auxquels ils s’adressent."/>{issueText("context")}</label> :
      <label key={k} className={"text-xs font-semibold "+(["contribution","result"].includes(k)?"sm:col-span-2":"")}>{isExample&&k==="title"?"Titre de la réalisation":fieldNames[k]}{(isExperience?k==="organization":k==="title")?<span className="profile-required">Obligatoire</span>:null}{help[k] ? <span className="my-2 block font-normal leading-5">{help[k]}</span> : null}
        {["contribution","result"].includes(k) ? <Textarea disabled={busy} data-field={k} className={inputClass} rows={3} maxLength={4000} value={data[k]} onChange={e=>setData(fieldsOnly(replaceDocumentedField({...initial,...data},k as "contribution" | "result",e.target.value)))} /> : <input disabled={busy} required={isExperience?k==="organization":k==="title"} className={inputClass} maxLength={k==="period"?160:k==="organization"||k==="role"?200:180} value={data[k]} placeholder={k==="title"?"Ex. Refonte de l’espace client":k==="organization"?"Nom de l’entreprise":k==="role"?"Ex. Product Manager":k==="period"?"Ex. 2022–2026":undefined} onChange={e=>setData({...data,[k]:e.target.value})} />}
        {issueText(k)}
      </label>)}
    {isExample?<ExampleEditor requiredDescription={!item} data={{...initial,...data}} disabled={busy} onChange={next=>setData(fieldsOnly(next))}/>:null}
    {!isExperience&&item?<button type="button" className="library-advanced-toggle sm:col-span-2" aria-expanded={advanced} onClick={()=>setAdvanced(!advanced)}>{advanced?"Fermer les options avancées":"Options avancées"}</button>:null}
    {!isExperience&&item&&advanced?<div className="library-review-options sm:col-span-2">{typeof advancedContent==="function"?advancedContent(JSON.stringify(data)!==JSON.stringify(fieldsOnly(item?.kind==="experience"?{...initial,...experienceHeading(item)}:initial))||JSON.stringify(points)!==JSON.stringify(structuredReview(initial).reviewPoints||[])):advancedContent}<p className="review-help">Pour une information incertaine que vous souhaitez confirmer avant de l’utiliser.</p><WorkspaceButton disabled={busy} onClick={()=>setPoints([...points,{id:crypto.randomUUID(),question:"",decision:"pending",answer:""}])}>Ajouter un point à confirmer</WorkspaceButton></div>:null}
    {isExperience&&item&&advancedContent?<details className="library-review-options sm:col-span-2"><summary>Gestion de l’expérience</summary>{typeof advancedContent==="function"?advancedContent(JSON.stringify(data)!==JSON.stringify(fieldsOnly({...initial,...experienceHeading(item)}))||JSON.stringify(points)!==JSON.stringify(structuredReview(initial).reviewPoints||[])):advancedContent}</details>:null}
    <div className="library-editor-actions sm:col-span-2">{onCancel?<WorkspaceButton disabled={busy} onClick={onCancel}>Annuler</WorkspaceButton>:null}<WorkspaceButton type="submit" variant="primary" busy={busy} disabled={problems.length>0||(!item&&(isExperience?!data.organization.trim()||!data.context.trim():!data.title.trim()||!exampleValues({...initial,...data}).description.trim()))}>{busy?"Enregistrement…":"Enregistrer"}</WorkspaceButton></div>
  </form>;
}
function ManualForm({busy,onSave,onCancel}:{busy:boolean;onSave:(body:Command)=>void;onCancel:()=>void}){
 const [id]=useState(()=>crypto.randomUUID());
 return <section className="library-create-panel" aria-label="Nouvelle expérience"><h3>Nouvelle expérience</h3><ItemForm initial={emptyData()} busy={busy} onCancel={onCancel} onSubmit={data=>onSave({action:"create",id,kind:"experience",parentId:null,data})}/></section>;
}
function InlineExampleForm({parentId,busy,onCancel,onSave}:{parentId:string;busy:boolean;onCancel:()=>void;onSave:(body:Command)=>Promise<void>}){
 const [id]=useState(()=>crypto.randomUUID());
 return <section className="library-create-panel library-new-realisation" aria-label="Nouvelle réalisation"><h4>Nouvelle réalisation</h4><ItemForm initial={emptyData()} example busy={busy} onCancel={onCancel} onSubmit={data=>void onSave({action:"create",id,kind:"fact",parentId,data})}/></section>;
}

function ConflictCard({ conflict, items, busy, onSave }: { conflict: ExperienceConflict; items: ExperienceItem[]; busy: boolean; onSave: (body: Command) => Promise<boolean> }) {
  const [choice, setChoice] = useState("both"), [note, setNote] = useState("");
  const pair = [items.find(i => i.id === conflict.leftId), items.find(i => i.id === conflict.rightId)];
  return <ExpandableSection className="my-3 rounded-xl border border-amber-200 p-4" title={<>{pair[0]?.data.organization || pair[0]?.data.title} · {conflict.state === "open" ? "À comparer" : "Comparaison terminée"}</>}><p className="my-3 text-sm">{conflict.reason}</p><div className="grid gap-3 sm:grid-cols-2">{pair.map((i, n) => <div key={n}><b className="text-xs">Version {n + 1} · {i?.data.title}</b><RichText text={i?.data.context || ""} /></div>)}</div>{conflict.state === "open" ? <form className="mt-4 space-y-3" onSubmit={e => { e.preventDefault(); onSave({ action: "resolve", id: conflict.id, resolution: choice, note }); }}><ChoiceSelect label="Décision" value={choice} onChange={setChoice} options={[{value:"both",label:"Conserver les deux (missions distinctes)"},{value:"left",label:"Conserver la version 1, masquer la version 2"},{value:"right",label:"Conserver la version 2, masquer la version 1"}]} /><label className="text-xs">Pourquoi ?<Textarea className={inputClass} minLength={5} maxLength={2000} required value={note} onChange={e => setNote(e.target.value)} /></label><button disabled={busy} className="secondary-button">Enregistrer la décision</button></form> : null}</ExpandableSection>;
}
