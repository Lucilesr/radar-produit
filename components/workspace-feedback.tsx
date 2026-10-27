"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, CircleAlert, Info, X } from "lucide-react";

export type WorkspaceFeedback = {
  message: string;
  tone?: "success" | "info" | "error";
  action?: { label: string; onClick: () => void };
};

/** One notification shape; errors persist, other tones pause while being read. */
export function WorkspaceToast({ message, tone = "success", action, onClose }: WorkspaceFeedback & { onClose: () => void }) {
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused || tone === "error") return;
    const timer = window.setTimeout(() => close.current(), 7000);
    return () => window.clearTimeout(timer);
  }, [message, paused, tone]);
  const Icon = tone === "error" ? CircleAlert : tone === "info" ? Info : Check;
  return <div className={`workspace-toast signal-toast is-${tone}`}
    onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
    onFocusCapture={() => setPaused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false); }}>
    <span className="signal-toast-icon" aria-hidden><Icon size={15} /></span>
    <div className="signal-toast-copy"><p role={tone === "error" ? "alert" : "status"}>{message}</p>
      {action ? <button type="button" className="signal-toast-link" onClick={() => { onClose(); action.onClick(); }}>{action.label}<ArrowRight size={12} aria-hidden /></button> : null}
    </div>
    <button type="button" className="signal-toast-close" onClick={onClose} aria-label="Fermer la notification"><X size={16} aria-hidden /></button>
  </div>;
}
