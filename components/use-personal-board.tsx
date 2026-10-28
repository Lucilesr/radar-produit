"use client";
import { useEffect, useRef, useState } from "react";
import { Dialog } from "radix-ui";
import { defaultBoard, type PersonalBoard, type PersonalColumn } from "@/lib/personal-board";
import { ChoiceSelect } from "@/components/choice-select";
import { WorkspaceButton, WorkspaceFormError } from "@/components/workspace-form";

export function usePersonalBoard() {
  const [board, setBoard] = useState<PersonalBoard>(defaultBoard);
  const [ready, setReady] = useState(false), [error, setError] = useState("");
  const [editor, setEditor] = useState<PersonalColumn | "new" | null>(null);
  const [label, setLabel] = useState(""), [stage, setStage] = useState("interviews"), [saving, setSaving] = useState(false);
  const lock = useRef(false);
  async function load() {
    setError("");
    try {
      const response = await fetch("/api/application-board", { cache: "no-store" });
      if (!response.ok) throw new Error();
      setBoard(((await response.json()) as {board:PersonalBoard}).board); setReady(true);
    } catch { setError("Impossible de charger les colonnes. Réessayez avant de modifier le tableau."); }
  }
  useEffect(() => { void load(); }, []);
  function open(column?: PersonalColumn) { setEditor(column ?? "new"); setLabel(column?.label ?? ""); setStage(column?.stage ?? "interviews"); setError(""); }
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
  const dialog = <Dialog.Root open={!!editor} onOpenChange={open => { if (!open && !saving) setEditor(null); }}><Dialog.Portal><Dialog.Overlay className="application-move-overlay"/><Dialog.Content className="application-move-dialog" onPointerDownOutside={event => { if(saving) event.preventDefault(); }} onEscapeKeyDown={event => { if(saving) event.preventDefault(); }}>
    <Dialog.Title>{editor === "new" ? "Ajouter une colonne" : "Renommer la colonne"}</Dialog.Title><Dialog.Description>Vos candidatures, notes et entretiens restent conservés.</Dialog.Description>
    <form className="board-column-form" onSubmit={event=>{event.preventDefault();void save();}}>
      <label>Nom de la colonne<input autoFocus value={label} maxLength={60} disabled={saving} onChange={event=>setLabel(event.target.value)} placeholder="Ex. Échange RH"/></label>
      {editor === "new" ? <ChoiceSelect label="Étape de candidature associée" value={stage} onChange={setStage} disabled={saving} options={defaultBoard().columns.filter(c=>c.stage!=="other").map(c=>({value:c.stage,label:c.label}))}/> : null}
      <WorkspaceFormError message={error}/><div className="application-move-actions"><WorkspaceButton disabled={saving} onClick={()=>setEditor(null)}>Annuler</WorkspaceButton><WorkspaceButton variant="primary" busy={saving} disabled={!label.trim()} onClick={()=>void save()}>Enregistrer</WorkspaceButton></div>
    </form>
  </Dialog.Content></Dialog.Portal></Dialog.Root>;
  return { board, ready, error, load, open, dialog };
}
