"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowRight, Check, CircleAlert, Info, X } from "lucide-react";

export type WorkspaceFeedback = {
  message: string;
  tone?: "success" | "info" | "error" | "milestone" | "celebration";
  action?: { label: string; onClick: () => void };
  secondaryAction?: { label: string; onClick: () => void };
};

const FeedbackContext = createContext<((feedback: WorkspaceFeedback) => void) | null>(null);
const encouragementBlocked=()=>!!document.querySelector('[role="dialog"]')||!!document.activeElement?.matches('input,textarea,[contenteditable="true"]');

export function WorkspaceFeedbackProvider({ children }: { children: ReactNode }) {
  const [feedback, setFeedback] = useState<(WorkspaceFeedback & { id: number }) | null>(null);
  const serial = useRef(0);
  const current=useRef<WorkspaceFeedback|null>(null),pending=useRef<WorkspaceFeedback|null>(null);
  const notify = useCallback((next: WorkspaceFeedback) => {
    if(next.tone==="celebration"&&(current.current||encouragementBlocked())){if(current.current?.tone!=="error")pending.current=next;return;}
    if(next.tone==="error")pending.current=null;
    current.current=next;
    setFeedback({ ...next, id: ++serial.current });
  }, []);
  const promote=useCallback(()=>{if(current.current||!pending.current||encouragementBlocked())return;const next=pending.current;pending.current=null;current.current=next;setFeedback({...next,id:++serial.current});},[]);
  const close=useCallback(()=>{current.current=null;setFeedback(null);requestAnimationFrame(promote);},[promote]);
  useEffect(()=>{let frame=0;const schedule=()=>{if(!pending.current)return;cancelAnimationFrame(frame);frame=requestAnimationFrame(promote);};const observer=new MutationObserver(schedule);observer.observe(document.body,{childList:true,subtree:true});document.addEventListener("focusout",schedule);return()=>{observer.disconnect();document.removeEventListener("focusout",schedule);cancelAnimationFrame(frame);};},[promote]);
  useEffect(()=>{const disable=()=>{pending.current=null;if(current.current?.tone==="celebration"){current.current=null;setFeedback(null);}};window.addEventListener("radar:celebrations-cancel",disable);return()=>window.removeEventListener("radar:celebrations-cancel",disable);},[]);
  return <FeedbackContext.Provider value={notify}>{children}{feedback ? <WorkspaceToast key={feedback.id} {...feedback} onAction={()=>{pending.current=null;}} onClose={close} /> : null}</FeedbackContext.Provider>;
}

export function useWorkspaceFeedback() {
  const notify = useContext(FeedbackContext);
  if (!notify) throw new Error("WorkspaceFeedbackProvider is required.");
  return notify;
}

/** One notification shape; errors persist, other tones pause while being read. */
export function WorkspaceToast({ message, tone = "success", action, secondaryAction, onClose,onAction }: WorkspaceFeedback & { onClose: () => void;onAction?:()=>void }) {
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
      <div className="signal-toast-actions">{[action,secondaryAction].map((item,index)=>item?<button key={index} type="button" className="signal-toast-link" onClick={() => { onAction?.();onClose(); item.onClick(); }}>{item.label}<ArrowRight size={12} aria-hidden /></button>:null)}</div>
    </div>
    <button type="button" className="signal-toast-close" onClick={onClose} aria-label="Fermer la notification"><X size={16} aria-hidden /></button>
  </div>;
}
