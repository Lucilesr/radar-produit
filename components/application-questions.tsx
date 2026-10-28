"use client";

import {AutosaveStatus,useSavedForm} from "@/components/autosave";
import {useWorkspaceFeedback} from "@/components/workspace-feedback";
import {CharacterCounter} from "@/components/character-counter";
import {WorkspaceButton, WorkspaceFormError} from "@/components/workspace-form";
import { LoadingSkeleton } from "@/components/loading-skeleton";

import { Textarea } from "@/components/ui/textarea";
import { useEffect, useState } from "react";
import { Copy, Save, Plus } from "lucide-react";

type Question = { id: string; jobId: string; question: string; characterLimit: number | null; answer: string; version: number; archivedAt: string | null };
type Revision = { id: string; version: number; answer: string; createdAt: string; origin: string };

async function api<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(path, { method, headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined });
  const data = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(data.error || "Enregistrement non confirmé.");
  return data;
}
function limitValue(value: string): number | null {
  if (!value.trim()) return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > 10000) throw new Error("La limite doit être comprise entre 1 et 10 000 caractères.");
  return number;
}
export function ApplicationQuestions({ jobId, onSaved }: { jobId: string; onSaved?: () => void }) {
  const notify=useWorkspaceFeedback();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [newId, setNewId] = useState(() => crypto.randomUUID());
  const [newQuestion, setNewQuestion] = useState("");
  const [newLimit, setNewLimit] = useState("");
  const [busy, setBusy] = useState(false);
  const [showArchived, setShowArchived] = useState(false); const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    api<{ questions: Question[] }>(`/api/application-questions?jobId=${encodeURIComponent(jobId)}${showArchived ? "&includeArchived=1" : ""}`)
      .then(data => { if (active) { setQuestions(data.questions); setError(""); } })
      .catch(problem => { if (active) setError(problem instanceof Error ? problem.message : "Questions indisponibles."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [jobId, showArchived, refresh]);
  async function restore(item: Question) {
    setBusy(true); setError("");
    try { await api(`/api/application-questions/${encodeURIComponent(item.id)}`, "PATCH", { action: "restore", version: item.version }); setRefresh(value => value + 1); onSaved?.(); notify({message:"Question restaurée."}); }
    catch (problem) { setError(problem instanceof Error ? problem.message : "Restauration non confirmée."); }
    finally { setBusy(false); }
  }
  async function add() {
    setBusy(true); setError("");
    try {
      const result = await api<{ question: Question }>("/api/application-questions", "POST", {
        id: newId, jobId, question: newQuestion, characterLimit: limitValue(newLimit), answer: "",
      });
      setQuestions(previous => previous.some(item => item.id === result.question.id) ? previous : [...previous, result.question]);
      setNewQuestion(""); setNewLimit(""); setNewId(crypto.randomUUID()); setAdding(false); onSaved?.(); notify({message:"Question enregistrée."});
    } catch (problem) { setError(problem instanceof Error ? problem.message : "Question non enregistrée."); }
    finally { setBusy(false); }
  }
  return <section className="brief-questions" aria-label="Questions du recruteur">
    <div className="signal-section-heading"><div><h3>Questions du recruteur</h3><p className="signal-help">Préparez une réponse pour chaque question reçue.</p></div><div className="brief-question-tools"><WorkspaceButton variant="quiet" onClick={()=>setShowArchived(value=>!value)}>{showArchived?"Masquer les questions retirées":"Questions retirées"}</WorkspaceButton><WorkspaceButton onClick={()=>setAdding(true)} disabled={loading||adding||questions.filter(item=>!item.archivedAt).length>=30}><Plus size={14} aria-hidden/>Ajouter une question</WorkspaceButton></div></div>
    <WorkspaceFormError message={error}/>
    {loading?<LoadingSkeleton label="Chargement des questions…" rows={2}/>:null}
    {!loading&&!questions.length&&!adding?<p className="signal-help">Aucune question enregistrée pour cette offre.</p>:null}
    {questions.map((item,index)=>item.archivedAt?<div key={item.id} className="signal-archived-question"><span><strong>Question retirée :</strong> {item.question}</span><WorkspaceButton disabled={busy} onClick={()=>void restore(item)}>Restaurer</WorkspaceButton></div>:<QuestionEditor key={item.id} number={index+1} initial={item} onChange={updated=>{setQuestions(previous=>previous.map(q=>q.id===updated.id?updated:q));onSaved?.();}} onArchive={()=>{setRefresh(value=>value+1);onSaved?.();}}/>)}
    {adding?<div className="brief-question brief-question-new"><label className="signal-brief-field">Question reçue<Textarea rows={2} maxLength={2000} value={newQuestion} disabled={busy} onChange={event=>setNewQuestion(event.target.value)} placeholder="Collez la question exacte du recruteur."/></label><CharacterCounter count={0} value={newLimit} onChange={value=>{setNewLimit(value);setError("");}} label="Limite de caractères · Nouvelle réponse" disabled={busy}/><div className="brief-question-actions"><WorkspaceButton onClick={()=>setAdding(false)} disabled={busy}>Annuler</WorkspaceButton><WorkspaceButton variant="primary" busy={busy} disabled={!newQuestion.trim()} onClick={()=>void add()}>{!busy?<Save size={14} aria-hidden/>:null}Enregistrer la question</WorkspaceButton></div></div>:null}
  </section>;
}

function QuestionEditor({ initial, number, onChange, onArchive }: { initial: Question; number:number; onChange: (question: Question) => void; onArchive: () => void }) {
  const notify=useWorkspaceFeedback();
  const draft=useSavedForm(`answer:${initial.id}`,{question:initial.question,limit:initial.characterLimit?.toString()??"",answer:initial.answer});
  const {question,limit,answer}=draft.value;
  const change=(key:"question"|"limit"|"answer",value:string)=>draft.setValue(current=>({...current,[key]:value}));
  const setQuestion=(value:string)=>change("question",value),setLimit=(value:string)=>change("limit",value),setAnswer=(value:string)=>change("answer",value);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [copied, setCopied] = useState(false); const [confirmArchive, setConfirmArchive] = useState(false);
  const [history, setHistory] = useState<Revision[] | null>(null);
  const questionDirty = question !== initial.question || limit !== (initial.characterLimit?.toString() ?? "");
  const dirty = questionDirty || answer !== initial.answer;
  const count = Array.from(answer).length; const overLimit = Boolean(limit && count > Number(limit));
  async function save() {
    setBusy(true); setError("");
    try {
      const result = await api<{ question: Question }>(`/api/application-questions/${encodeURIComponent(initial.id)}`, "PATCH", {
        version: initial.version, question, characterLimit: limitValue(limit), answer,
      });
      draft.save.document.confirmedElsewhere("");onChange(result.question); setHistory(null); notify({message:"Brouillon enregistré. La version précédente reste dans l’historique."});
    } catch (problem) { setError(problem instanceof Error ? problem.message : "Brouillon non enregistré."); }
    finally { setBusy(false); }
  }
  async function archive() {
    setBusy(true); setError("");
    try { await api(`/api/application-questions/${encodeURIComponent(initial.id)}`, "PATCH", { action: "archive", version: initial.version }); onArchive(); notify({message:"Question retirée. Ses versions restent conservées."}); }
    catch (problem) { setError(problem instanceof Error ? problem.message : "Question non retirée."); }
    finally { setBusy(false); }
  }
  async function showHistory() {
    if (history) { setHistory(null); return; }
    try { const result = await api<{ revisions: Revision[] }>(`/api/application-questions/${encodeURIComponent(initial.id)}`); setHistory(result.revisions); }
    catch (problem) { setError(problem instanceof Error ? problem.message : "Historique indisponible."); }
  }
  return <article className="brief-question" aria-label={`Question ${number}`}>
    <div className="brief-question-heading"><h4>Question {number}</h4><div className="brief-question-tools"><button type="button" className="signal-text-action" aria-expanded={!!history} onClick={()=>void showHistory()}>{history?"Masquer les versions":"Voir les versions"}</button><button type="button" className="signal-text-action is-danger" disabled={busy||!draft.ready} onClick={()=>setConfirmArchive(true)}>Retirer la question</button></div></div>
    <label className="signal-brief-field"><span className="sr-only">Question</span><Textarea maxLength={2000} rows={2} value={question} disabled={busy||!draft.ready} onChange={event=>{setQuestion(event.target.value);}}/></label>
    <label className="signal-brief-field signal-answer-field">Ma réponse<Textarea maxLength={10000} rows={5} value={answer} disabled={busy||!draft.ready} aria-invalid={overLimit} onChange={event=>{setAnswer(event.target.value);setCopied(false);}} placeholder="Rédigez votre réponse ou collez celle préparée dans ChatGPT."/></label>
    <CharacterCounter count={count} value={limit} onChange={value=>{setLimit(value);setError("");}} label="Limite de caractères · Ma réponse" disabled={busy||!draft.ready}/>
    <AutosaveStatus save={draft.save} draft/>
    <WorkspaceFormError message={error}/>
    <div className="brief-question-actions"><span className="signal-save-hint">{dirty?"Modifications du prompt à confirmer.":""}</span><WorkspaceButton disabled={!answer||dirty||busy} title={dirty?"Enregistrez vos modifications avant de copier":undefined} onClick={async()=>{try{await navigator.clipboard.writeText(answer);setCopied(true);notify({message:"Réponse copiée."});}catch{setError("Copie impossible : sélectionnez le texte.");}}}><Copy size={14} aria-hidden/>{copied?"Réponse copiée":"Copier la réponse"}</WorkspaceButton><WorkspaceButton variant="primary" busy={busy} disabled={!draft.ready||!dirty||!question.trim()} onClick={()=>void save()}>{!busy?<Save size={14} aria-hidden/>:null}Mettre à jour la réponse</WorkspaceButton></div>
    {confirmArchive?<div className="signal-inline-confirm"><p>Retirer cette question ? Ses versions restent conservées.</p><div className="brief-question-tools"><WorkspaceButton onClick={()=>setConfirmArchive(false)} disabled={busy||!draft.ready}>Garder la question</WorkspaceButton><WorkspaceButton variant="danger" busy={busy} onClick={()=>void archive()}>Confirmer le retrait</WorkspaceButton></div></div>:null}
    {history?<div className="brief-question-history"><h4>Versions enregistrées</h4>{history.map(revision=><div key={revision.id}><span className="signal-help">Version {revision.version} · {new Date(revision.createdAt).toLocaleString("fr-FR")}</span><p>{revision.answer||"Réponse vide"}</p>{revision.answer&&revision.answer!==answer?<button type="button" className="signal-text-action" onClick={()=>{setAnswer(revision.answer);}}>Reprendre dans l’éditeur</button>:null}</div>)}</div>:null}
  </article>;
}
