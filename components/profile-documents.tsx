"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, Download, FileText, LoaderCircle, RefreshCw, Upload } from "lucide-react";
import { ChoiceSelect } from "@/components/choice-select";
import { validateDocumentMeta, type DocumentLinks, type DocumentSlot, type PrivateDocument } from "@/lib/document-input";

const slots: Array<{ id: DocumentSlot; label: string }> = [
  { id: "cvFrDocumentId", label: "CV français" }, { id: "cvEnDocumentId", label: "CV anglais" },
  { id: "detailedExperienceDocumentId", label: "Expériences détaillées" },
];

export function ProfileDocuments({ links, onLinked, onBusyChange }: { links: DocumentLinks; onLinked: (links: DocumentLinks) => void; onBusyChange: (busy: boolean) => void }) {
  const [files, setFiles] = useState<PrivateDocument[]>([]);
  const [busy, setBusy] = useState<DocumentSlot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  useEffect(() => { onBusyChange(!!busy); }, [busy, onBusyChange]);
  async function refresh() {
    setLoading(true);
    try {
      const response = await fetch("/api/documents", { cache: "no-store" });
      if (!response.ok) throw new Error("Impossible de lire vos fichiers. Vérifiez votre connexion et actualisez la liste.");
      const data = await response.json() as { documents: PrivateDocument[] }; setFiles(data.documents);
    } catch (problem) { setError(problem instanceof Error ? problem.message : "Lecture impossible."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void refresh(); }, []);
  async function upload(file: File, slot: DocumentSlot) {
    if (busy) return;
    setError(null); setSuccess(null);
    try {
      validateDocumentMeta(file.name, file.size); setBusy(slot);
      const form = new FormData(); form.set("file", file); form.set("slot", slot);
      const response = await fetch("/api/documents", { method: "POST", body: form });
      const data = await response.json() as { document?: PrivateDocument; links?: DocumentLinks; error?: string };
      if (!response.ok || !data.document || !data.links) throw new Error(data.error ?? "Enregistrement non confirmé. Actualisez la liste avant de réessayer.");
      setFiles(current => [data.document!, ...current.filter(item => item.id !== data.document!.id)]);
      onLinked(data.links); setSuccess(`${file.name} enregistré et rattaché à votre profil.`);
    } catch (problem) { setError(problem instanceof Error && problem.message !== "Failed to fetch" ? problem.message : "Import non confirmé. Vérifiez votre connexion et actualisez la liste avant de réessayer."); }
    finally { setBusy(null); }
  }
  async function link(id: string, slot: DocumentSlot) {
    if (!id || busy) return;
    setBusy(slot); setError(null); setSuccess(null);
    try {
      const response = await fetch(`/api/documents/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slot }) });
      const data = await response.json() as { links?: DocumentLinks; error?: string };
      if (!response.ok || !data.links) throw new Error(data.error ?? "Enregistrement non confirmé.");
      onLinked(data.links); setSuccess("Fichier existant rattaché au profil. Aucun nouvel exemplaire créé.");
    } catch (problem) { setError(problem instanceof Error ? problem.message : "Enregistrement non confirmé."); }
    finally { setBusy(null); }
  }
  return <section className="glass-panel p-5">
    <div className="flex items-start justify-between gap-3"><div><h2 className="text-sm font-bold">Documents privés</h2><p className="mt-1 text-xs leading-5 text-[#535768]">Déposez un fichier ou choisissez-le sur votre ordinateur. Le rattachement au profil est enregistré automatiquement.</p></div><button type="button" disabled={loading || !!busy} onClick={() => { setError(null); void refresh(); }} aria-label="Actualiser les fichiers" className="rounded-lg p-2 text-[#535768] disabled:opacity-40"><RefreshCw size={15} className={loading ? "animate-spin" : ""} /></button></div>
    <p className="mt-3 text-[11px] leading-5 text-[#535768]">PDF, DOC, DOCX, MD ou TXT · 8 Mo maximum · Un fichier par zone. Les versions précédentes restent conservées.</p>
    {error ? <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-xs leading-5 text-red-700">{error}</p> : null}
    {success ? <p role="status" className="mt-3 rounded-xl bg-[#e7ecff] p-3 text-xs leading-5 text-[#4b4bd1]">{success}</p> : null}
    <div className="mt-4 space-y-3">{slots.map(slot => <DocumentCard key={slot.id} slot={slot} document={files.find(file => file.id === links[slot.id])} linkedId={links[slot.id]} files={files} busy={busy} onUpload={upload} onLink={link} onError={message => { setError(message); setSuccess(null); }} />)}</div>
    {loading ? <p className="mt-3 text-xs text-[#535768]">Lecture de vos fichiers…</p> : null}
  </section>;
}

function DocumentCard({ slot, document, linkedId, files, busy, onUpload, onLink, onError }: {
  slot: { id: DocumentSlot; label: string }; document?: PrivateDocument; linkedId?: string; files: PrivateDocument[]; busy: DocumentSlot | null;
  onUpload: (file: File, slot: DocumentSlot) => Promise<void>; onLink: (id: string, slot: DocumentSlot) => Promise<void>; onError: (message: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null); const inputId = useId(); const [dragging, setDragging] = useState(false);
  return <div className={`rounded-2xl border p-3 transition-colors ${dragging ? "border-[#6161ff] bg-[#e7ecff]" : "border-[#d0d4e4] bg-white/60"}`}
    onDragOver={event => { event.preventDefault(); if (!busy) setDragging(true); }}
    onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }}
    onDrop={event => { event.preventDefault(); setDragging(false); if (busy) return; const list = event.dataTransfer.files; if (list.length !== 1) { onError("Déposez un seul fichier à la fois dans la zone choisie."); return; } void onUpload(list[0], slot.id); }}>
    <div className="flex items-center gap-2"><FileText size={15} className="shrink-0 text-[#6161ff]" /><p className="document-slot-title">{slot.label}</p>{document ? <Check size={14} className="ml-auto text-[#6161ff]" aria-label="Enregistré" /> : null}</div>
    <p className="mt-2 break-words text-[11px] leading-5 text-[#535768]">{document ? `${document.originalName} · ${(document.size / 1024 / 1024).toFixed(2)} Mo` : linkedId ? "Le fichier lié n’est pas visible dans la liste. Actualisez pour vérifier." : "Glissez votre fichier ici, ou utilisez le bouton ci-dessous."}</p>
    <input id={inputId} ref={input} type="file" className="hidden" aria-label={`Fichier pour ${slot.label}`} accept=".pdf,.doc,.docx,.md,.txt" disabled={!!busy} onChange={event => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (file) void onUpload(file, slot.id); }} />
    <div className="mt-3 flex flex-wrap items-center gap-3"><button type="button" disabled={!!busy} onClick={() => input.current?.click()} className="inline-flex items-center gap-1.5 rounded-lg bg-[#e7ecff] px-3 py-2 text-[11px] font-semibold text-[#4b4bd1] disabled:opacity-50">{busy === slot.id ? <LoaderCircle size={13} className="animate-spin" /> : <Upload size={13} />}{busy === slot.id ? "Enregistrement…" : document ? `Remplacer ${slot.label}` : `Importer ${slot.label}`}</button>{document ? <a href={`/api/documents/${document.id}`} className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#4b4bd1]"><Download size={13} /> Télécharger</a> : null}</div>
    {files.length ? <div className="mt-3"><ChoiceSelect label={`Utiliser un fichier déjà importé pour ${slot.label}`} value={linkedId && files.some(file => file.id === linkedId) ? linkedId : "__none__"} disabled={!!busy} onChange={id => { if (id !== "__none__") void onLink(id, slot.id); }} options={[{ value: "__none__", label: "Choisir un fichier existant…" }, ...files.map(file => ({ value: file.id, label: `${file.originalName}${file.createdAt ? ` · ${file.createdAt.slice(0, 10)}` : ""}` }))]} /></div> : null}
  </div>;
}
