"use client";
import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { buildDailyLot, type DailyLot, type StoredLot } from "@/lib/daily-lot";
import type { JobRecord } from "@/lib/types";

const listeners = new Set<() => void>();
// Raw stored value: a string keeps the snapshot stable between renders.
const memory = new Map<string, string | null>();

function readRaw(key: string) {
  if (memory.has(key)) return memory.get(key)!;
  let raw: string | null;
  try { raw = window.localStorage.getItem(key); } catch { raw = null; }
  memory.set(key, raw);
  return raw;
}

function parse(raw: string | null): StoredLot | null {
  try {
    const value = JSON.parse(raw ?? "null") as StoredLot | null;
    return value && typeof value.day === "string" && Array.isArray(value.ids) ? { day: value.day, ids: value.ids.filter(id => typeof id === "string"), locked: value.locked === true } : null;
  } catch { return null; }
}

function write(key: string, value: StoredLot) {
  const raw = JSON.stringify(value);
  memory.set(key, raw);
  try { window.localStorage.setItem(key, raw); } catch { /* The lot stays in memory for this visit. */ }
  listeners.forEach(listener => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => { if (!event.key || event.key.startsWith("radar:lot-du-jour")) { memory.clear(); listener(); } };
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
export function useDailyLot(jobs: JobRecord[], ready: boolean, owner = "") {
  const storageKey = "radar:lot-du-jour:" + owner;
  // `undefined` until hydration: no lot yet, so a stored lot is never replaced by a fresh one.
  const read = useCallback(() => readRaw(storageKey), [storageKey]);
  const raw = useSyncExternalStore(subscribe, read, () => undefined);
  const now = useSyncExternalStore(subscribeClock, readClock, () => 0);
  const lot = useMemo(() => !ready || raw === undefined || !now ? null : buildDailyLot(jobs, parse(raw), now), [jobs, raw, now, ready]);
  useEffect(() => {
    if (!lot) return;
    const stored = parse(raw ?? null);
    if (stored?.day !== lot.day || stored.ids.join() !== lot.ids.join() || stored.locked !== lot.locked) write(storageKey, { day: lot.day, ids: lot.ids, locked: lot.locked });
  }, [lot, raw, storageKey]);
  // Capture the displayed batch before the first request can change the input pool.
  const lock = () => { if (lot) write(storageKey, { day: lot.day, ids: lot.ids, locked: true }); };
  return { lot, lock };
}
