"use client";
import { useSyncExternalStore } from "react";

const read = () => Math.floor(Date.now() / 60000) * 60000;
function subscribe(listener: () => void) {
  const timer = window.setInterval(listener, 60000);
  document.addEventListener("visibilitychange", listener);
  return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", listener); };
}
/** Refresh date-sensitive UI on the next minute and when returning to the tab. */
export function useRadarClock() { return useSyncExternalStore(subscribe, read, () => 0); }
