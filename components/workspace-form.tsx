"use client";

import { useId, type ComponentProps, type ReactNode } from "react";
import { CircleAlert, LoaderCircle, Save } from "lucide-react";

export function WorkspaceButton({ variant = "secondary", busy = false, disabled, children, className = "", ...props }: ComponentProps<"button"> & { variant?: "primary" | "secondary" | "quiet" | "danger"; busy?: boolean }) {
  const classes = { primary: "radar-add-button", secondary: "secondary-button", quiet: "signal-quiet-button", danger: "signal-danger-button" };
  return <button type="button" {...props} disabled={disabled || busy} aria-busy={busy || undefined} className={`${classes[variant]} signal-form-button ${className}`}>{busy ? <LoaderCircle size={15} className="animate-spin" aria-hidden /> : null}{children}</button>;
}
export function WorkspaceFormSection({ title, description, actions, children, className = "" }: { title: string; description?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  const id = useId();
  return <section aria-labelledby={id} className={`signal-form-section ${className}`}><div className="signal-section-heading"><div><h3 id={id}>{title}</h3>{description ? <p className="signal-help">{description}</p> : null}</div>{actions}</div>{children}</section>;
}
export function WorkspaceSaveActions({ label, onSave, onCancel, busy = false, disabled = false, hint, sticky = false }: { label: string; onSave: () => void; onCancel?: () => void; busy?: boolean; disabled?: boolean; hint?: string; sticky?: boolean }) {
  return <div className={`signal-save-actions${sticky ? " is-sticky" : ""}`}>{hint ? <span className="signal-save-hint">{busy ? "Enregistrement en cours…" : hint}</span> : null}<div className="signal-save-buttons">{onCancel ? <WorkspaceButton disabled={busy} onClick={onCancel}>Annuler</WorkspaceButton> : null}<WorkspaceButton variant="primary" busy={busy} disabled={disabled} onClick={onSave}>{!busy ? <Save size={15} aria-hidden /> : null}{busy ? "Enregistrement…" : label}</WorkspaceButton></div></div>;
}
export function WorkspaceFormError({ message }: { message: string }) {
  return message ? <p role="alert" className="signal-form-error"><CircleAlert size={16} aria-hidden />{message}</p> : null;
}
