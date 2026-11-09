"use client";

import { useRef, useState } from "react";
import { Dialog } from "radix-ui";
import { Download, LogOut, Trash2, X } from "lucide-react";
import {ActivityJournal} from "@/components/activity-journal";
import { RadarPreferencesSettings } from "@/components/radar-preferences";
import type { RadarPreferences } from "@/lib/celebrations";
import { WorkspaceButton, WorkspaceFormError, WorkspaceFormSection } from "@/components/workspace-form";

/** Typed by the owner to confirm; the API checks the same word. */
const CONFIRMATION = "SUPPRIMER";

/** Where a demo visitor or a signed-in account leaves Radar. */
export function signOutTarget(demo: boolean, signOutPath: string) {
  return demo ? { action: "/demo-exit", method: "get" as const, label: "Quitter la démo" } : { action: signOutPath, method: "post" as const, label: "Se déconnecter" };
}

/** Browser-only conveniences (guide progress, drafts) keyed by this account. */
function forgetLocalState(ownerId: string) {
  try {
    for (const key of Object.keys(localStorage)) if (key.includes(ownerId)) localStorage.removeItem(key);
  } catch { /* Storage may be unavailable: nothing to clean. */ }
}

export function AccountSettings({ ownerId, userName, email, demo, signOutPath, preferences, onPreferences }: {preferences?:RadarPreferences;onPreferences:(preferences:RadarPreferences)=>void; ownerId: string; userName: string; email?: string; demo: boolean; signOutPath: string }) {
  const leave = signOutTarget(demo, signOutPath);
  const signOutForm = useRef<HTMLFormElement>(null);
  const deleteTrigger=useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [deleted, setDeleted] = useState(false);
  return <div className="account-settings">
    <RadarPreferencesSettings initial={preferences} onSaved={onPreferences}/>
    <ActivityJournal/>
    <WorkspaceFormSection headingLevel={2} title="Connexion" description={demo ? "Démo : données fictives, gardées dans ce navigateur." : "Connexion par votre compte ChatGPT. Vos données ne sont visibles que par vous."}>
      <div className="account-identity">
        <span className="avatar" aria-hidden>{userName.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase() || "RP"}</span>
        <div><strong>{userName}</strong>{email && email !== userName ? <span>{email}</span> : null}</div>
      </div>
      <div className="account-actions">
        <form ref={signOutForm} method={leave.method} action={leave.action}>
          <WorkspaceButton type="submit"><LogOut size={15} aria-hidden />{leave.label}</WorkspaceButton>
        </form>
      </div>
    </WorkspaceFormSection>
    {demo ? null : <>
      <WorkspaceFormSection headingLevel={2} title="Vos données" description="Téléchargez tout votre compte, fichiers originaux compris.">
        <div className="account-actions"><a className="secondary-button signal-form-button" href="/sauvegarde"><Download size={15} aria-hidden />Exporter mes données</a></div>
      </WorkspaceFormSection>
      <WorkspaceFormSection headingLevel={2} className="account-danger" descriptionInline title="Supprimer mon compte" description="Efface définitivement vos critères, sources, offres, candidatures, entretiens, notes, réponses, carnet d’expériences, journal d’activité et documents (CV compris). Votre compte ChatGPT n’est pas concerné.">
        {deleted ? <p role="status" className="account-deleted">Votre compte Radar a été supprimé. Déconnexion…</p> : <div className="account-actions"><WorkspaceButton ref={deleteTrigger} variant="danger" onClick={() => setOpen(true)}><Trash2 size={15} aria-hidden />Supprimer mon compte</WorkspaceButton></div>}
      </WorkspaceFormSection>
      <AccountDeletionDialog open={open} onReturnFocus={()=>deleteTrigger.current?.focus({preventScroll:true})} onClose={() => setOpen(false)} onDeleted={() => {
        setOpen(false); setDeleted(true); forgetLocalState(ownerId);
        // The account no longer exists: end the session too, then land on the sign-in page.
        setTimeout(() => signOutForm.current?.requestSubmit(), 1200);
      }} />
    </>}
  </div>;
}

function AccountDeletionDialog({ open, onClose, onDeleted, onReturnFocus }: { open: boolean; onClose: () => void; onDeleted: () => void; onReturnFocus:()=>void }) {
  const [typed, setTyped] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const locked = useRef(false);
  const cancel = useRef<HTMLButtonElement>(null);
  const confirmed = typed.trim() === CONFIRMATION;
  function close() { if (!locked.current) { setTyped(""); setError(""); onClose(); } }
  async function remove() {
    if (!confirmed || locked.current) return;
    locked.current = true; setBusy(true); setError("");
    try {
      const response = await fetch("/api/account", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmation: typed.trim() }), signal: AbortSignal.timeout(60000) });
      const data = await response.json().catch(() => ({})) as { deleted?: boolean; error?: string };
      if (!response.ok || !data.deleted) throw new Error(data.error ?? "Suppression non confirmée. Rechargez la page pour vérifier votre compte avant de réessayer.");
      onDeleted();
    } catch (problem) { setError(problem instanceof Error && !["TimeoutError","AbortError","TypeError"].includes(problem.name) ? problem.message : "Suppression non confirmée. Rechargez la page pour vérifier votre compte avant de réessayer."); }
    finally { locked.current = false; setBusy(false); }
  }
  return <Dialog.Root open={open} onOpenChange={next => { if (!next) close(); }}>
    <Dialog.Portal>
      <Dialog.Overlay data-testid="modal-backdrop" className="fixed inset-0 z-50" />
      <Dialog.Content className="workspace-dialog account-delete-dialog fixed left-1/2 top-1/2 z-50 max-h-[92dvh] -translate-x-1/2 -translate-y-1/2 overflow-y-auto shadow-2xl outline-none" onCloseAutoFocus={event=>{event.preventDefault();onReturnFocus();}} onOpenAutoFocus={event => { event.preventDefault(); cancel.current?.focus(); }} onEscapeKeyDown={event => { if (locked.current) event.preventDefault(); }} onPointerDownOutside={event => { if (locked.current) event.preventDefault(); }}>
        <div className="signal-dialog-header"><div className="signal-dialog-heading"><Dialog.Title>Supprimer définitivement votre compte ?</Dialog.Title></div><button type="button" className="signal-dialog-close" aria-label="Fermer" disabled={busy} onClick={close}><X size={20} aria-hidden /></button></div>
        <Dialog.Description className="signal-help">Toutes vos données Radar et vos documents seront effacés. Cette action ne peut pas être annulée. Pour garder une copie, exportez d’abord vos données depuis « Vos données ».</Dialog.Description>
        <form onSubmit={event => { event.preventDefault(); void remove(); }}>
          <label className="account-confirm-label" htmlFor="account-delete-confirmation">Saisissez <strong>{CONFIRMATION}</strong> pour confirmer</label>
          <input id="account-delete-confirmation" className="account-confirm-input" autoComplete="off" autoCapitalize="characters" spellCheck={false} value={typed} disabled={busy} onChange={event => { setTyped(event.target.value); setError(""); }} />
          <WorkspaceFormError message={error} />
          <div className="account-delete-actions">
            <WorkspaceButton ref={cancel} disabled={busy} onClick={close}>Annuler</WorkspaceButton>
            <WorkspaceButton type="submit" variant="danger" busy={busy} disabled={!confirmed}>{!busy ? <Trash2 size={15} aria-hidden /> : null}{busy ? "Suppression…" : "Supprimer définitivement"}</WorkspaceButton>
          </div>
        </form>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}

/** Compact sign-out control for the desktop sidebar; « Mon compte » covers smaller screens. */
export function SidebarSignOut({ demo, signOutPath }: { demo: boolean; signOutPath: string }) {
  const leave = signOutTarget(demo, signOutPath);
  return <form className="sidebar-signout" method={leave.method} action={leave.action}>
    <button type="submit" aria-label={leave.label} title={leave.label}><LogOut size={16} aria-hidden /></button>
  </form>;
}
