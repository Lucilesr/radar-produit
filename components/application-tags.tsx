"use client";
import { requestError } from "@/lib/request-error";

import { useEffect, useRef, useState } from "react";
import { Dialog } from "radix-ui";
import { ArrowLeft, Check, Pencil, Plus, Tags, X } from "lucide-react";
import { WorkspaceButton, WorkspaceFormError } from "@/components/workspace-form";
import { tagColor, tagColors, tagsForJob, type ApplicationTag, type ApplicationTags } from "@/lib/application-tags";

const changedEvent = "radar-application-tags-changed";

export function TagBadge({ tag, onClick, selected = false }: { tag: ApplicationTag; onClick?: () => void; selected?: boolean }) {
  const color = tagColor(tag.color);
  const style = { backgroundColor: color?.value ?? "var(--muted)", color: color?.text ?? "var(--foreground)" };
  return onClick ? <button type="button" className="application-tag" style={style} aria-pressed={selected} onClick={onClick} title={`Filtrer par le tag ${tag.name}`}>{tag.name}</button>
    : <span className="application-tag" style={style}>{tag.name}</span>;
}

export function useApplicationTags() {
  const [state, setState] = useState<ApplicationTags>({ version: 0, tags: [] });
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  async function load() {
    try {
      const response = await fetch("/api/application-tags", { cache: "no-store", signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error();
      setState(await response.json() as ApplicationTags); setReady(true); setLoadError("");
    } catch { setLoadError("Tags indisponibles. Réessayez."); }
  }
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/application-tags", { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) })
      .then(async response => { if (!response.ok) throw new Error(); return await response.json() as ApplicationTags; })
      .then(result => { if (!controller.signal.aborted) { setState(result); setReady(true); setLoadError(""); } })
      .catch(() => { if (!controller.signal.aborted) setLoadError("Tags indisponibles. Réessayez."); });
    window.addEventListener(changedEvent, load);
    return () => { controller.abort(); window.removeEventListener(changedEvent, load); };
  }, []);
  async function change(input: Record<string, unknown>) {
    const response = await fetch("/api/application-tags", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...input, version: state.version }), signal: AbortSignal.timeout(15000) });
    const result = await response.json() as ApplicationTags & { error?: string };
    if (response.status === 409) setState({ version: result.version, tags: result.tags });
    if (!response.ok) throw new Error(result.error ?? "Tag non enregistré.");
    setState(result);
    window.dispatchEvent(new Event(changedEvent));
    return result;
  }
  return { ...state, ready, loadError, load, change };
}

export function ApplicationTagBadges({ jobId }: { jobId: string }) {
  const store = useApplicationTags();
  const assigned = tagsForJob(store.tags, jobId);
  return store.ready && assigned.length ? <div className="application-tags-current" aria-label="Tags de la candidature">{assigned.map(tag => <TagBadge key={tag.id} tag={tag}/>)}</div> : null;
}

export function ApplicationTagEditor({ jobId }: { jobId: string }) {
  const store = useApplicationTags();
  const [open, setOpen] = useState(false);
  const [screen, setScreen] = useState<"list" | "edit" | "delete">("list");
  const [editing, setEditing] = useState<ApplicationTag | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(tagColors[0].value);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const trigger = useRef<HTMLButtonElement>(null);
  function edit(tag: ApplicationTag | null) { setEditing(tag); setName(tag?.name ?? search.trim()); setColor(tag?.color ?? tagColors[0].value); setError(""); setScreen("edit"); }
  async function act(input: Record<string, unknown>, done?: () => void) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try { await store.change(input); done?.(); }
    catch (problem) { setError(requestError(problem, "Tag non enregistré.")); }
    finally { lock.current = false; setBusy(false); }
  }
  return <>
    <WorkspaceButton className="application-tag-trigger" ref={trigger} onClick={() => { setScreen("list"); setError(""); setOpen(true); }}><Pencil size={14} aria-hidden />Tag</WorkspaceButton>
    <Dialog.Root open={open} onOpenChange={value => { if (!busy) { setOpen(value); if (!value) setScreen("list"); } }}><Dialog.Portal><Dialog.Overlay className="application-move-overlay"/><Dialog.Content className="application-move-dialog application-tags-dialog" onCloseAutoFocus={event => { event.preventDefault(); trigger.current?.focus({ preventScroll: true }); }} onPointerDownOutside={event => { if (busy) event.preventDefault(); }} onEscapeKeyDown={event => { if (busy) event.preventDefault(); }}>
      <div className="application-tags-dialog-heading">{screen !== "list" ? <WorkspaceButton variant="quiet" aria-label="Retour aux tags" onClick={() => { setScreen("list"); setError(""); }} disabled={busy}><ArrowLeft size={18} aria-hidden/></WorkspaceButton> : <span/>}<Dialog.Title>{screen === "list" ? "Tags" : screen === "delete" ? "Supprimer le tag" : editing ? "Modifier le tag" : "Créer un tag"}</Dialog.Title><Dialog.Close asChild><WorkspaceButton variant="quiet" aria-label="Fermer" disabled={busy}><X size={18} aria-hidden/></WorkspaceButton></Dialog.Close></div>
      {screen === "list" ? <><Dialog.Description className="sr-only">Choisissez les tags de cette carte ou gérez vos tags. Saisissez un nom puis appuyez sur Entrée pour créer un tag.</Dialog.Description><label className="application-tags-search"><span className="sr-only">Rechercher un tag ou saisir son nom</span><input autoFocus maxLength={40} value={search} onChange={event => setSearch(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.nativeEvent.isComposing && search.trim() && store.ready && !busy) { event.preventDefault(); edit(null); } }} placeholder="Rechercher ou créer un tag…" /></label>
        {store.loadError ? <><WorkspaceFormError message={store.loadError}/><WorkspaceButton onClick={() => void store.load()}>Réessayer</WorkspaceButton></> : null}
        {store.ready ? <div className="application-tags-list">{store.tags.filter(tag => tag.name.toLocaleLowerCase("fr").includes(search.trim().toLocaleLowerCase("fr"))).map(tag => <div className="application-tags-row" key={tag.id}><label><input type="checkbox" checked={tag.jobIds.includes(jobId)} disabled={busy} onChange={() => void act({ action: "toggle", id: tag.id, jobId })}/><TagBadge tag={tag}/></label><WorkspaceButton variant="quiet" disabled={busy} aria-label={`Modifier le tag ${tag.name}`} onClick={() => edit(tag)}><Pencil size={16} aria-hidden/></WorkspaceButton></div>)}{!store.tags.length ? <p className="signal-help">Aucun tag créé pour le moment.</p> : null}{store.tags.length && !store.tags.some(tag => tag.name.toLocaleLowerCase("fr").includes(search.trim().toLocaleLowerCase("fr"))) ? <p className="signal-help">Aucun tag trouvé.</p> : null}</div> : null}
        <WorkspaceFormError message={error}/><WorkspaceButton className="application-tags-create" disabled={!store.ready || busy} onClick={() => edit(null)}><Plus size={16} aria-hidden/>Créer un tag</WorkspaceButton></>
      : screen === "edit" ? <><Dialog.Description className="sr-only">Choisissez le nom et la couleur du tag.</Dialog.Description><div className="application-tags-preview"><TagBadge tag={{ id: editing?.id ?? "preview", name: name.trim() || "Aperçu du tag", color, jobIds: [] }}/></div><label className="application-tags-name">Nom du tag<input autoFocus maxLength={40} value={name} disabled={busy} onChange={event => setName(event.target.value)} placeholder="Nom du tag" /></label><fieldset className="application-tags-colors"><legend>Couleur du tag</legend><div>{tagColors.map(option => <button type="button" key={option.value} disabled={busy} className="application-tag-color" style={{ backgroundColor: option.value, color: option.text }} aria-label={option.name} aria-pressed={color === option.value} onClick={() => setColor(option.value)}>{color === option.value ? <Check size={20} aria-hidden/> : null}</button>)}</div></fieldset><WorkspaceFormError message={error}/><div className="application-tags-actions">{editing ? <WorkspaceButton variant="danger" disabled={busy} onClick={() => { setScreen("delete"); setError(""); }}>Supprimer…</WorkspaceButton> : null}<WorkspaceButton variant="primary" busy={busy} disabled={!name.trim()} onClick={() => void act({ action: editing ? "update" : "create", id: editing?.id, name, color, jobId: editing ? undefined : jobId }, () => { setScreen("list"); setSearch(""); })}>Enregistrer</WorkspaceButton></div></>
      : <><Dialog.Description>Le tag « {editing?.name} » sera supprimé de toutes les cartes. Cette action ne peut pas être annulée.</Dialog.Description><WorkspaceFormError message={error}/><WorkspaceButton className="application-tags-delete" variant="danger" busy={busy} onClick={() => void act({ action: "delete", id: editing?.id }, () => setScreen("list"))}>Supprimer le tag</WorkspaceButton></>}
    </Dialog.Content></Dialog.Portal></Dialog.Root>
  </>;
}
