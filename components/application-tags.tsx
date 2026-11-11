"use client";
import { requestError } from "@/lib/request-error";

import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Dialog } from "radix-ui";
import { ArrowLeft, Check, Pencil, Plus, X } from "lucide-react";
import { WorkspaceButton, WorkspaceFormError } from "@/components/workspace-form";
import { tagColor, tagColors, tagsForJob, type ApplicationTag, type ApplicationTags } from "@/lib/application-tags";

import { createSaveQueue } from "@/lib/save-queue";

type Assignment = { id: string; jobId: string; assigned: boolean };
const assignmentKey = ({ id, jobId }: Pick<Assignment, "id" | "jobId">) => JSON.stringify([id, jobId]);

async function writeTag(input: Record<string, unknown>, version: number) {
  const response = await fetch("/api/application-tags", {
    method: "PATCH", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...input, version }), signal: AbortSignal.timeout(15000),
  });
  const result = await response.json() as ApplicationTags & { error?: string };
  if (response.status === 409 && Array.isArray(result.tags)) return { kind: "conflict" as const, state: result };
  if (!response.ok) throw new Error(result.error ?? "Tag non enregistré.");
  return { kind: "saved" as const, state: result };
}

function tagQueue() {
  return createSaveQueue<ApplicationTags, Assignment>({
    initial: { version: 0, tags: [] },
    key: assignmentKey,
    version: state => state.version,
    apply: (state, { id, jobId, assigned }) => ({
      ...state, tags: state.tags.map(tag => tag.id !== id || tag.jobIds.includes(jobId) === assigned
        ? tag : { ...tag, jobIds: assigned ? [...tag.jobIds, jobId] : tag.jobIds.filter(job => job !== jobId) }),
    }),
    send(change, confirmed) {
      const tag = confirmed.tags.find(tag => tag.id === change.id);
      if (tag?.jobIds.includes(change.jobId) === change.assigned) return Promise.resolve({ kind: "saved", state: confirmed });
      return writeTag({ action: "toggle", id: change.id, jobId: change.jobId }, confirmed.version);
    },
  });
}

const TagsContext = createContext<{
  queue: ReturnType<typeof tagQueue>; ready: boolean; loadError: string; load: () => Promise<void>;
} | null>(null);

export function ApplicationTagsProvider({ children }: { children: ReactNode }) {
  const [queue] = useState(tagQueue);
  const [ready, setReady] = useState(false), [loadError, setLoadError] = useState("");
  const reading = useRef<Promise<void> | null>(null);
  const load = useCallback(() => {
    if (reading.current) return reading.current;
    const request = fetch("/api/application-tags", { cache: "no-store", signal: AbortSignal.timeout(15000) })
      .then(async response => {
        if (!response.ok) throw new Error();
        queue.accept(await response.json() as ApplicationTags);
        setReady(true);
        setLoadError("");
      })
      .catch(() => setLoadError("Tags indisponibles. Réessayez."))
      .finally(() => { reading.current = null; });
    reading.current = request;
    return request;
  }, [queue]);
  return <TagsContext.Provider value={{ queue, ready, loadError, load }}>{children}</TagsContext.Provider>;
}

export function TagBadge({ tag, onClick, selected = false }: { tag: ApplicationTag; onClick?: () => void; selected?: boolean }) {
  const color = tagColor(tag.color);
  const style = { backgroundColor: color?.value ?? "var(--muted)", color: color?.text ?? "var(--foreground)" };
  return onClick ? <button type="button" className="application-tag" style={style} aria-pressed={selected} onClick={onClick} title={`Filtrer par le tag ${tag.name}`}>{tag.name}</button>
    : <span className="application-tag" style={style}>{tag.name}</span>;
}

export function useApplicationTags() {
  const store = useContext(TagsContext);
  if (!store) throw new Error("ApplicationTagsProvider is required.");
  const { queue, ready, load, loadError } = store;
  const { visible, failed } = useSyncExternalStore(queue.subscribe, queue.getSnapshot, queue.getSnapshot);
  useEffect(() => { void load(); }, [load]);
  async function change(input: Record<string, unknown>) {
    const receipt = await writeTag(input, queue.getSnapshot().confirmed.version);
    queue.accept(receipt.state);
    if (receipt.kind === "conflict") throw new Error("Les tags ont changé dans un autre onglet. Réessayez.");
    return receipt.state;
  }
  return { ...visible, ready, loadError, load, change, queue, failed };
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
        {store.ready ? <div className="application-tags-list">{store.tags.filter(tag => tag.name.toLocaleLowerCase("fr").includes(search.trim().toLocaleLowerCase("fr"))).map(tag => <div className="application-tags-row" key={tag.id}><label><input type="checkbox" checked={tag.jobIds.includes(jobId)} disabled={busy} onChange={event => void store.queue.enqueue({ id: tag.id, jobId, assigned: event.target.checked })}/><TagBadge tag={tag}/></label><WorkspaceButton variant="quiet" disabled={busy} aria-label={`Modifier le tag ${tag.name}`} onClick={() => edit(tag)}><Pencil size={16} aria-hidden/></WorkspaceButton>{store.failed.some(change => change.id === tag.id && change.jobId === jobId) ? <div><WorkspaceFormError message={`Tag « ${tag.name} » non enregistré.`}/><WorkspaceButton onClick={() => void store.queue.retry(assignmentKey({ id: tag.id, jobId }))}>Réessayer</WorkspaceButton></div> : null}</div>)}{!store.tags.length ? <p className="signal-help">Aucun tag créé pour le moment.</p> : null}{store.tags.length && !store.tags.some(tag => tag.name.toLocaleLowerCase("fr").includes(search.trim().toLocaleLowerCase("fr"))) ? <p className="signal-help">Aucun tag trouvé.</p> : null}</div> : null}
        <WorkspaceFormError message={error}/><WorkspaceButton className="application-tags-create" disabled={!store.ready || busy} onClick={() => edit(null)}><Plus size={16} aria-hidden/>Créer un tag</WorkspaceButton></>
      : screen === "edit" ? <><Dialog.Description className="sr-only">Choisissez le nom et la couleur du tag.</Dialog.Description><div className="application-tags-preview"><TagBadge tag={{ id: editing?.id ?? "preview", name: name.trim() || "Aperçu du tag", color, jobIds: [] }}/></div><label className="application-tags-name">Nom du tag<input autoFocus maxLength={40} value={name} disabled={busy} onChange={event => setName(event.target.value)} placeholder="Nom du tag" /></label><fieldset className="application-tags-colors"><legend>Couleur du tag</legend><div>{tagColors.map(option => <button type="button" key={option.value} disabled={busy} className="application-tag-color" style={{ backgroundColor: option.value, color: option.text }} aria-label={option.name} aria-pressed={color === option.value} onClick={() => setColor(option.value)}>{color === option.value ? <Check size={20} aria-hidden/> : null}</button>)}</div></fieldset><WorkspaceFormError message={error}/><div className="application-tags-actions">{editing ? <WorkspaceButton variant="danger" disabled={busy} onClick={() => { setScreen("delete"); setError(""); }}>Supprimer…</WorkspaceButton> : null}<WorkspaceButton variant="primary" busy={busy} disabled={!name.trim()} onClick={() => void act({ action: editing ? "update" : "create", id: editing?.id, name, color, jobId: editing ? undefined : jobId }, () => { setScreen("list"); setSearch(""); })}>Enregistrer</WorkspaceButton></div></>
      : <><Dialog.Description>Le tag « {editing?.name} » sera supprimé de toutes les cartes. Cette action ne peut pas être annulée.</Dialog.Description><WorkspaceFormError message={error}/><WorkspaceButton className="application-tags-delete" variant="danger" busy={busy} onClick={() => void act({ action: "delete", id: editing?.id }, () => setScreen("list"))}>Supprimer le tag</WorkspaceButton></>}
    </Dialog.Content></Dialog.Portal></Dialog.Root>
  </>;
}
