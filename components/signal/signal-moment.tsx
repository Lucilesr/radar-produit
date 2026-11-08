"use client";

import { useRef, type ReactNode } from "react";
import { Dialog } from "radix-ui";
import { X } from "lucide-react";
import { WorkspaceButton } from "@/components/workspace-form";

/** Radix keeps the focus trapped, Escape available and the page inert. */
export function SignalMoment({ open, onClose, title, description, children, actionLabel = "Terminer", onAction, className = "" }: { open: boolean; onClose: () => void; title: string; description?: string; children?: ReactNode; actionLabel?: string; onAction?: () => void; className?:string }) {
  const heading = useRef<HTMLHeadingElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  return <Dialog.Root open={open} onOpenChange={next => { if (!next) onClose(); }}>
    <Dialog.Portal>
      <Dialog.Overlay className="signal-moment-overlay"/>
      <Dialog.Content className={`signal-moment ${className}`} {...(!description ? { "aria-describedby": undefined } : {})} onOpenAutoFocus={event => { event.preventDefault(); opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; heading.current?.focus(); }} onCloseAutoFocus={event => { if (opener.current?.isConnected) { event.preventDefault(); opener.current.focus(); } }}>
        <Dialog.Close className="signal-moment-close" aria-label="Fermer"><X size={22} aria-hidden="true"/></Dialog.Close>
        <div className="signal-moment-body">
          <Dialog.Title ref={heading} tabIndex={-1}>{title}</Dialog.Title>
          {description ? <Dialog.Description>{description}</Dialog.Description> : null}
          {children}
          <WorkspaceButton variant="primary" className="signal-moment-action" onClick={onAction ?? onClose}>{actionLabel}</WorkspaceButton>
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
