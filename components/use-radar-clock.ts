"use client";
import { useSyncExternalStore } from "react";

let current = 0;
const listeners = new Set<() => void>();
const read = () => current || (current = Date.now());
export function refreshRadarClock() { current = Date.now(); listeners.forEach(listener=>listener()); }
function subscribe(listener: () => void) {
  listeners.add(listener);
  const timer = window.setInterval(refreshRadarClock, 60000);
  document.addEventListener("visibilitychange", refreshRadarClock);
  return () => { listeners.delete(listener); window.clearInterval(timer); document.removeEventListener("visibilitychange", refreshRadarClock); };
}
/** Refresh date-sensitive UI on the next minute and when returning to the tab. */
export function useRadarClock() { return useSyncExternalStore(subscribe, read, () => 0); }
