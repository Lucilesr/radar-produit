"use client";

import { LoadingSkeleton } from "@/components/loading-skeleton";

import { useEffect, useId, useRef, useState } from "react";
import { Check, Download, FileText, LoaderCircle, RefreshCw, Upload } from "lucide-react";
import { useWorkspaceFeedback } from "@/components/workspace-feedback";
import { WorkspaceButton, WorkspacePanelHeader } from "@/components/workspace-form";
import { ChoiceSelect } from "@/components/choice-select";
import { validateDocumentMeta, type DocumentLinks, type DocumentSlot, type PrivateDocument } from "@/lib/document-input";

const slots: Array<{ id: DocumentSlot; label: string }> = [
  { id: "cvFrDocumentId", label: "CV français" }, { id: "cvEnDocumentId", label: "CV anglais" },
  { id: "detailedExperienceDocumentId", label: "Expériences détaillées" },
];

export function ProfileDocuments({ links, onLinked, onBusyChange }: { links: DocumentLinks; onLinked: (links: DocumentLinks) => void; onBusyChange: (busy: boolean) => void }) {
  const feedback=useWorkspaceFeedback();
  const [files, setFiles] = useState<PrivateDocument[]>([]);
  const [busy, setBusy] = useState<DocumentSlot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const writeLock=useRef(false);
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
    if (writeLock.current) return;
    setError(null); writeLock.current=true;
    try {
      validateDocumentMeta(file.name, file.size); setBusy(slot);
      const form = new FormData(); form.set("file", file); form.set("slot", slot);
      const response = await fetch("/api/documents", { method: "POST", body: form });
      const data = await response.json() as { document?: PrivateDocument; links?: DocumentLinks; error?: string };
      if (!response.ok || !data.document || !data.links) throw new Error(data.error ?? "Enregistrement non confirmé. Actualisez la liste avant de réessayer.");
      setFiles(current => [data.document!, ...current.filter(item => item.id !== data.document!.id)]);
      onLinked(data.links); feedback({message:`${file.name} enregistré et rattaché à votre profil.`});
    } catch (problem) { setError(problem instanceof Error && problem.message !== "Failed to fetch" ? problem.message : "Import non confirmé. Vérifiez votre connexion et actualisez la liste avant de réessayer."); }
    finally { writeLock.current=false;setBusy(null); }
  }
  async function link(id: string, slot: DocumentSlot) {
    if (!id || writeLock.current) return;
    writeLock.current=true;setBusy(slot); setError(null);
    try {
      const response = await fetch(`/api/documents/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slot }) });
      const data = await response.json() as { links?: DocumentLinks; error?: string };
      if (!response.ok || !data.links) throw new Error(data.error ?? "Enregistrement non confirmé.");
      onLinked(data.links); feedback({message:"Fichier rattaché au profil."});
    } catch (problem) { setError(problem instanceof Error ? problem.message : "Enregistrement non confirmé."); }
    finally { writeLock.current=false;setBusy(null); }
  }
  return <section className="profile-documents" aria-labelledby="profile-documents-title">
    <div data-radar-guide-slot />
    <WorkspacePanelHeader id="profile-documents-title" title="Documents privés" className="profile-documents-heading" actions={<WorkspaceButton disabled={loading||!!busy} onClick={()=>{setError(null);void refresh();}} aria-label="Actualiser les fichiers"><RefreshCw size={15} className={loading?"animate-spin":""} aria-hidden/>Actualiser</WorkspaceButton>}/>
    <p className="profile-document-intro">Importez votre CV français ou anglais pour préparer le carnet d’expériences. Vous pourrez relire et corriger les éléments extraits. Le document détaillé reste prioritaire si vous en ajoutez un.</p>
    <p className="profile-document-formats">PDF, DOC, DOCX, MD ou TXT · 8 Mo max. · Versions précédentes conservées.</p>
    {error?<p role="alert" className="experience-error">{error}</p>:null}
    <div className="profile-document-list">{slots.map(slot=><DocumentCard key={slot.id} slot={slot} document={files.find(file=>file.id===links[slot.id])} linkedId={links[slot.id]} files={files} busy={busy} onUpload={upload} onLink={link} onError={message=>setError(message)}/>)}</div>
    {loading?<LoadingSkeleton label="Lecture de vos fichiers…" rows={2}/>:null}
  </section>;
}

function DocumentCard({ slot, document, linkedId, files, busy, onUpload, onLink, onError }: {
  slot: { id: DocumentSlot; label: string }; document?: PrivateDocument; linkedId?: string; files: PrivateDocument[]; busy: DocumentSlot | null;
  onUpload: (file: File, slot: DocumentSlot) => Promise<void>; onLink: (id: string, slot: DocumentSlot) => Promise<void>; onError: (message: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null); const inputId = useId(); const [dragging, setDragging] = useState(false);
  return <div id={"document-"+slot.id} tabIndex={-1} className={`profile-document-row${dragging?" is-dragging":""}`}
    onDragOver={event => { event.preventDefault(); if (!busy) setDragging(true); }}
    onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }}
    onDrop={event => { event.preventDefault(); setDragging(false); if (busy) return; const list = event.dataTransfer.files; if (list.length !== 1) { onError("Déposez un seul fichier à la fois dans la zone choisie."); return; } void onUpload(list[0], slot.id); }}>
    <FileText className="profile-document-icon" size={20} aria-hidden/>
    <div className="profile-document-information"><div className="profile-document-title"><h3>{slot.label}</h3>{document?<span className="profile-document-status"><Check size={12} aria-hidden/>Enregistré</span>:null}</div><p className="profile-document-filename">{document?document.originalName:linkedId?"Fichier lié indisponible. Actualisez la liste.":"Aucun fichier. Glissez-le ici ou importez-le."}</p>{document?<p className="profile-document-size">{(document.size/1024/1024).toFixed(2)} Mo</p>:null}
    {files.length?<details className="profile-document-existing"><summary>Choisir un fichier existant</summary><div className="profile-document-picker"><ChoiceSelect label={`Fichier pour ${slot.label}`} value={linkedId&&files.some(file=>file.id===linkedId)?linkedId:"__none__"} disabled={!!busy} onChange={id=>{if(id!=="__none__")void onLink(id,slot.id);}} options={[{value:"__none__",label:"Choisir…"},...files.map(file=>({value:file.id,label:`${file.originalName}${file.createdAt?` · ${file.createdAt.slice(0,10)}`:""}`}))]}/></div></details>:null}
    </div>
    <input id={inputId} ref={input} type="file" className="hidden" aria-label={`Fichier pour ${slot.label}`} accept=".pdf,.doc,.docx,.md,.txt" disabled={!!busy} onChange={event=>{const file=event.currentTarget.files?.[0];event.currentTarget.value="";if(file)void onUpload(file,slot.id);}}/>
    <div className="profile-document-actions"><WorkspaceButton disabled={!!busy} onClick={()=>input.current?.click()} aria-label={document?`Remplacer ${slot.label}`:`Importer ${slot.label}`}>{busy===slot.id?<LoaderCircle size={14} className="animate-spin" aria-hidden/>:<Upload size={14} aria-hidden/>}{busy===slot.id?"Enregistrement…":document?"Remplacer":"Importer"}</WorkspaceButton>{document?<a href={`/api/documents/${document.id}`} className="profile-document-download"><Download size={14} aria-hidden/>Télécharger</a>:null}</div>
  </div>;
}
