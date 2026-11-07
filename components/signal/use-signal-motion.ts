"use client";

import { useSyncExternalStore } from "react";

function reducedMotion() {
  return document.documentElement.dataset.motion === "reduced" || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
function subscribe(callback: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  const observer = new MutationObserver(callback);
  query.addEventListener("change", callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-motion"] });
  return () => { query.removeEventListener("change", callback); observer.disconnect(); };
}

/** Both the system preference and the optional Radar preference take priority. */
export function useSignalReducedMotion() {
  return useSyncExternalStore(subscribe, reducedMotion, () => true);
}
