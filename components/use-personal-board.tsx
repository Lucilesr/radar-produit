"use client";
import { useEffect, useRef, useState } from "react";
import { Dialog } from "radix-ui";
import { defaultBoard, personalColumn, type PersonalBoard, type PersonalColumn } from "@/lib/personal-board";
import { ChoiceSelect } from "@/components/choice-select";
import { WorkspaceButton, WorkspaceFormError } from "@/components/workspace-form";
import type { JobRecord } from "@/lib/types";

export function usePersonalBoard(jobs: JobRecord[] = []) {
  const [board, setBoard] = useState<PersonalBoard>(defaultBoard);
  const [ready, setReady] = useState(false), [error, setError] = useState("");
  const [editor, setEditor] = useState<PersonalColumn | "new" | null>(null);
  const [label, setLabel] = useState(""), [stage, setStage] = useState("interviews"), [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const lock = useRef(false);
  async function load() {
    try {
      const response = await fetch("/api/application-board", { cache: "no-store" });
      if (!response.ok) throw new Error();
      setBoard(((await response.json()) as {board:PersonalBoard}).board); setReady(true); setError("");
    } catch { setError("Impossible de charger les colonnes. Réessayez avant de modifier le tableau."); }
  }
  useEffect(() => {
    const controller=new AbortController();
    fetch("/api/application-board",{cache:"no-store",signal:controller.signal})
      .then(async response=>{if(!response.ok)throw new Error();return await response.json() as {board:PersonalBoard};})
      .then(result=>{if(!controller.signal.aborted){setBoard(result.board);setReady(true);setError("");}})
      .catch(()=>{if(!controller.signal.aborted)setError("Impossible de charger les colonnes. Réessayez avant de modifier le tableau.");});
    return ()=>controller.abort();
  }, []);
  function open(column?: PersonalColumn) { setEditor(column ?? "new"); setLabel(column?.label ?? ""); setStage(column?.stage ?? "interviews"); setConfirmDelete(false); setError(""); }
  async function save() {
    if (lock.current || !editor) return;
    lock.current = true; setSaving(true); setError("");
    try {
      const response = await fetch("/api/application-board", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: editor === "new" ? "add" : "rename", id: editor === "new" ? undefined : editor.id, label, stage, version: board.version }) });
      const result = await response.json() as {board?:PersonalBoard;error?:string};
      if (result.board) setBoard(result.board);
      if (!response.ok) throw new Error(result.error ?? "Colonne non enregistrée. Votre saisie est conservée.");
      setEditor(null);
    } catch (problem) { setError(problem instanceof Error ? problem.message : "Colonne non enregistrée."); }
    finally { lock.current = false; setSaving(false); }
  }
  async function remove() {
    if (lock.current || !editor || editor === "new" || !editor.id.startsWith("custom-")) return;
    lock.current = true; setSaving(true); setError("");
    try {
      const response = await fetch("/api/application-board", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", id: editor.id, version: board.version }) });
      const result = await response.json() as {board?:PersonalBoard;error?:string};
      if (result.board) setBoard(result.board);
      if (!response.ok) throw new Error(result.error ?? "Colonne non supprimée. Réessayez.");
      setEditor(null); setConfirmDelete(false);
    } catch (problem) { setError(problem instanceof Error ? problem.message : "Colonne non supprimée."); }
    finally { lock.current = false; setSaving(false); }
  }
  const custom = editor !== null && editor !== "new" && editor.id.startsWith("custom-");
  const affected = custom ? jobs.filter(job => personalColumn(job, board.columns) === editor.id).length : 0;
  const fallback = custom ? board.columns.find(column => column.id === editor.stage)?.label ?? "son étape d’origine" : "";
  const dialog = <Dialog.Root open={!!editor} onOpenChange={open => { if (!open && !saving) setEditor(null); }}><Dialog.Portal><Dialog.Overlay className="application-move-overlay"/><Dialog.Content className="application-move-dialog" onPointerDownOutside={event => { if(saving) event.preventDefault(); }} onEscapeKeyDown={event => { if(saving) event.preventDefault(); }}>
    <Dialog.Title>{confirmDelete ? "Supprimer cette colonne ?" : editor === "new" ? "Ajouter une colonne" : "Modifier la colonne"}</Dialog.Title><Dialog.Description>{confirmDelete ? `${affected} candidature${affected === 1 ? "" : "s"} rejoindr${affected === 1 ? "a" : "ont"} « ${fallback} ». Les dossiers, notes et entretiens restent conservés.` : "Vos candidatures, notes et entretiens restent conservés."}</Dialog.Description>
    {confirmDelete ? <div className="board-column-form"><WorkspaceFormError message={error}/><div className="application-move-actions"><WorkspaceButton disabled={saving} onClick={()=>{setConfirmDelete(false);setError("");}}>Garder la colonne</WorkspaceButton><WorkspaceButton variant="danger" busy={saving} onClick={()=>void remove()}>Supprimer la colonne</WorkspaceButton></div></div> : <form className="board-column-form" onSubmit={event=>{event.preventDefault();void save();}}>
      <label>Nom de la colonne<input autoFocus value={label} maxLength={60} disabled={saving} onChange={event=>setLabel(event.target.value)} placeholder="Ex. Échange RH"/></label>
      {editor === "new" ? <ChoiceSelect label="Étape de candidature associée" value={stage} onChange={setStage} disabled={saving} options={defaultBoard().columns.filter(c=>c.stage!=="other").map(c=>({value:c.stage,label:c.label}))}/> : null}
      <WorkspaceFormError message={error}/><div className="application-move-actions">{custom ? <WorkspaceButton variant="danger" disabled={saving} onClick={()=>{setConfirmDelete(true);setError("");}}>Supprimer</WorkspaceButton> : null}<WorkspaceButton disabled={saving} onClick={()=>setEditor(null)}>Annuler</WorkspaceButton><WorkspaceButton variant="primary" busy={saving} disabled={!label.trim()} onClick={()=>void save()}>Enregistrer</WorkspaceButton></div>
    </form>}
  </Dialog.Content></Dialog.Portal></Dialog.Root>;
  return { board, ready, error, load, open, dialog };
}
