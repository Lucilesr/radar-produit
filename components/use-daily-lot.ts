"use client";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { buildDailyLot, type DailyLot, type StoredLot } from "@/lib/daily-lot";
import type { JobRecord } from "@/lib/types";

const storageKey = "radar:lot-du-jour";
const listeners = new Set<() => void>();
// Raw stored value: a string keeps the snapshot stable between renders.
let memory: string | null | undefined;

function readRaw() {
  if (memory !== undefined) return memory;
  try { memory = window.localStorage.getItem(storageKey); } catch { memory = null; }
  return memory;
}

function parse(raw: string | null): StoredLot | null {
  try {
    const value = JSON.parse(raw ?? "null") as StoredLot | null;
    return value && typeof value.day === "string" && Array.isArray(value.ids) ? { day: value.day, ids: value.ids.filter(id => typeof id === "string") } : null;
  } catch { return null; }
}

function write(value: StoredLot) {
  memory = JSON.stringify(value);
  try { window.localStorage.setItem(storageKey, memory); } catch { /* The lot stays in memory for this visit. */ }
  listeners.forEach(listener => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => { if (event.key === storageKey) { memory = undefined; listener(); } };
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(listener); window.removeEventListener("storage", onStorage); };
}

// A coarse clock (five minutes) read as an external store: a tab left open overnight starts a new lot.
const clockStep = 5 * 60 * 1000;
function subscribeClock(listener: () => void) { const timer = window.setInterval(listener, 60 * 1000); return () => window.clearInterval(timer); }
const readClock = () => Math.floor(Date.now() / clockStep) * clockStep;

/**
 * Lot of the day, kept in this browser so a reload does not reshuffle it. Without storage the
 * lot is simply chosen again: it is a reading aid, never the only copy of a decision.
 */
export function useDailyLot(jobs: JobRecord[], ready: boolean): DailyLot | null {
  // `undefined` until hydration: no lot yet, so a stored lot is never replaced by a fresh one.
  const raw = useSyncExternalStore(subscribe, readRaw, () => undefined);
  const now = useSyncExternalStore(subscribeClock, readClock, () => 0);
  const lot = useMemo(() => !ready || raw === undefined || !now ? null : buildDailyLot(jobs, parse(raw), now), [jobs, raw, now, ready]);
  useEffect(() => {
    if (!lot) return;
    const stored = parse(raw ?? null);
    if (stored?.day !== lot.day || stored.ids.join() !== lot.ids.join()) write({ day: lot.day, ids: lot.ids });
  }, [lot, raw]);
  return lot;
}
