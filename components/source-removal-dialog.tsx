"use client";
import { requestError } from "@/lib/request-error";

import { useRef, useState } from "react";
import { Dialog } from "radix-ui";
import { Trash2, X } from "lucide-react";
import { WorkspaceButton, WorkspaceFormError } from "@/components/workspace-form";
import type { SourceSetting } from "@/components/source-card";
import type { sourceCatalog } from "@/lib/source-catalog";

export function SourceRemovalDialog({ source, onClose, onRemoved, focusAfterRemoval, focusAfterCancel }: {
  source: typeof sourceCatalog[number] | null;
  onClose: () => void;
  onRemoved: (setting: SourceSetting) => void;
  focusAfterRemoval: () => void;
  focusAfterCancel?: () => void;
}) {
  const [busy,setBusy]=useState(false),[error,setError]=useState("");
  const locked=useRef(false),removed=useRef(false);
  const cancel=useRef<HTMLButtonElement>(null);
  function close(){if(!locked.current){setError("");onClose();}}
  async function remove(){
    if(!source||locked.current)return;
    locked.current=true;setBusy(true);setError("");
    try {
      const response=await fetch("/api/sources",{signal:AbortSignal.timeout(15000),method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({source:source.name,confirmed:true})});
      const data=await response.json() as {source?:SourceSetting;error?:string};
      if(!response.ok||!data.source)throw new Error(data.error??"Suppression non confirmée. Réessayez.");
      removed.current=true;onRemoved(data.source);
    } catch(problem){setError(requestError(problem, "Suppression non confirmée. Réessayez."));}
    finally {locked.current=false;setBusy(false);}
  }
  return <Dialog.Root open={source!==null} onOpenChange={open=>{if(!open)close();}}>
    <Dialog.Portal>
      <Dialog.Overlay data-testid="modal-backdrop" className="fixed inset-0 z-50"/>
      <Dialog.Content className="workspace-dialog signal-source-remove-dialog fixed left-1/2 top-1/2 z-50 max-h-[92dvh] -translate-x-1/2 -translate-y-1/2 overflow-y-auto shadow-2xl outline-none" onOpenAutoFocus={event=>{event.preventDefault();cancel.current?.focus();}} onCloseAutoFocus={event=>{if(removed.current){event.preventDefault();removed.current=false;focusAfterRemoval();}else if(focusAfterCancel){event.preventDefault();focusAfterCancel();}}} onEscapeKeyDown={event=>{if(locked.current)event.preventDefault();}} onPointerDownOutside={event=>{if(locked.current)event.preventDefault();}}>
        <div className="signal-dialog-header"><div className="signal-dialog-heading"><Dialog.Title>Supprimer {source?.name} ?</Dialog.Title></div><button type="button" className="signal-dialog-close" aria-label="Fermer" disabled={busy} onClick={close}><X size={20} aria-hidden/></button></div>
        <Dialog.Description className="signal-help">Cette carte sera retirée de vos sources suivies. Vos offres déjà enregistrées et vos réglages sont conservés. Vous pourrez réajouter cette source via « Ajouter des sources ».</Dialog.Description>
        {source?.mode==="rss"?<p className="signal-help">Le flux ne sera plus actualisé tant que vous ne l’aurez pas réajouté.</p>:source?.mode==="email"?<p className="signal-help">Pour arrêter les emails, désactivez aussi l’alerte sur le site d’origine.</p>:null}
        <WorkspaceFormError message={error}/>
        <div className="signal-source-remove-actions"><WorkspaceButton ref={cancel} disabled={busy} onClick={close}>Annuler</WorkspaceButton><WorkspaceButton variant="danger" busy={busy} onClick={()=>void remove()}>{!busy?<Trash2 size={15} aria-hidden/>:null}{busy?"Suppression…":"Supprimer la carte"}</WorkspaceButton></div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
