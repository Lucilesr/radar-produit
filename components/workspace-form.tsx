"use client";

import { useEffect, useId, useRef, type ComponentProps, type ReactNode } from "react";
import { CircleAlert, LoaderCircle, Save } from "lucide-react";
import { HelpTooltip } from "@/components/help-tooltip";

export function WorkspaceButton({ variant = "secondary", busy = false, disabled, children, className = "", ...props }: ComponentProps<"button"> & { variant?: "primary" | "secondary" | "quiet" | "danger"; busy?: boolean }) {
  const classes = { primary: "radar-add-button", secondary: "secondary-button", quiet: "signal-quiet-button", danger: "signal-danger-button" };
  return <button type="button" {...props} disabled={disabled || busy} aria-busy={busy || undefined} className={`${classes[variant]} signal-form-button ${className}`}>{busy ? <LoaderCircle size={15} className="animate-spin" aria-hidden /> : null}{children}</button>;
}
export function WorkspaceFormSection({ headingLevel=3,title, description, descriptionInline = false, actions, children, className = "" }: { headingLevel?:2|3;title: string; description?: string; descriptionInline?: boolean; actions?: ReactNode; children: ReactNode; className?: string }) {
  const id = useId(),Heading=headingLevel===2?"h2":"h3";
  return <section aria-labelledby={id} className={`signal-form-section ${className}`}><div className="signal-section-heading"><div><div className="signal-section-title-help"><Heading id={id}>{title}</Heading>{description && !descriptionInline ? <HelpTooltip label={title}>{description}</HelpTooltip> : null}</div>{description && descriptionInline ? <p className="signal-help">{description}</p> : null}</div>{actions}</div>{children}</section>;
}
export function WorkspaceSaveActions({ label, onSave, onCancel, busy = false, disabled = false, hint, sticky = false, cancelLabel = "Annuler" }: { label: string; onSave: () => void; onCancel?: () => void; busy?: boolean; disabled?: boolean; hint?: string; sticky?: boolean; cancelLabel?:string }) {
  return <div className={`signal-save-actions${sticky ? " is-sticky" : ""}`}>{hint ? <span className="signal-save-hint">{busy ? "Enregistrement en cours…" : hint}</span> : null}<div className="signal-save-buttons">{onCancel ? <WorkspaceButton disabled={busy} onClick={onCancel}>{cancelLabel}</WorkspaceButton> : null}<WorkspaceButton variant="primary" busy={busy} disabled={disabled} onClick={onSave}>{!busy ? <Save size={15} aria-hidden /> : null}{busy ? "Enregistrement…" : label}</WorkspaceButton></div></div>;
}
export function WorkspaceFormError({ message }: { message: string }) {
  return message ? <p role="alert" className="signal-form-error"><CircleAlert size={16} aria-hidden />{message}</p> : null;
}

export function WorkspacePanelHeader({ id, title, hint, actions, className = "" }: { id: string; title: ReactNode; hint?: ReactNode; actions?: ReactNode; className?: string }) {
  return <header className={`signal-panel-header ${className}`}><div className="signal-panel-title"><h2 id={id} tabIndex={-1}>{title}</h2>{hint}</div>{actions ? <div className="signal-panel-actions">{actions}</div> : null}</header>;
}

/** A form opened from a long interview list starts at its heading. */
export function useWorkspaceEditorFocus() {
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    title.current?.closest<HTMLElement>('[role="dialog"]')?.scrollTo({ top: 0 });
    title.current?.focus({ preventScroll: true });
  }, []);
  return title;
}
