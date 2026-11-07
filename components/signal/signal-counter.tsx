"use client";

import { useEffect, useRef } from "react";
import { signalCountAt } from "@/lib/signal-numbers";
import { useSignalReducedMotion } from "./use-signal-motion";

export function SignalCounter({ value, label, announce = false, animate = true }: { value: number; label: string; announce?: boolean; animate?: boolean }) {
  const node = useRef<HTMLSpanElement>(null);
  const previous = useRef(0);
  const reduced = useSignalReducedMotion();
  const number = Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
  useEffect(() => {
    const span = node.current;
    if (!span) return;
    const from = previous.current;
    previous.current = number;
    if (reduced || !animate) { span.textContent = number.toLocaleString("fr-FR"); return; }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      span.textContent = signalCountAt(from, number, now - start).toLocaleString("fr-FR");
      if (now - start < 600) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [number, reduced, animate]);
  return <div className="signal-number">
    <span ref={node} className="signal-counter-value" aria-hidden="true">{number.toLocaleString("fr-FR")}</span>
    <span className="signal-counter-label" aria-hidden="true">{label}</span>
    <span className="sr-only" aria-live={announce ? "polite" : undefined} aria-atomic="true">{number.toLocaleString("fr-FR")} {label}</span>
  </div>;
}
