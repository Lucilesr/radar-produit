"use client";
import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import {useRadarContinuity,continuityView,saveAccountLot} from "@/components/use-radar-continuity";
import { buildDailyLot, type StoredLot } from "@/lib/daily-lot";
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

function parse(raw: string | null, jobs: readonly JobRecord[]): StoredLot | null {
  try {
    const value = JSON.parse(raw ?? "null") as StoredLot | null;
    if (!value || typeof value.day !== "string" || !Array.isArray(value.ids)) return null;
    const available = new Set(jobs.map(job => job.id));
    // An old browser-only lot must contain only existing offers before its first save.
    return { day: value.day, ids: value.ids.filter(id => available.has(id)), locked: value.locked === true };
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

/** Canonical lot in the account; the old browser snapshot is migrated once and kept as a reading fallback. */
export function useDailyLot(jobs:JobRecord[],ready:boolean,owner=""){
 const storageKey="radar:lot-du-jour:"+owner,remote=useRadarContinuity(owner,ready),pending=useRef<string|null>(null);
 const locks=useRef(new Map<string,Promise<boolean>>());
 const read=useCallback(()=>readRaw(storageKey),[storageKey]);
 const raw=useSyncExternalStore(subscribe,read,()=>undefined),now=useSyncExternalStore(subscribeClock,readClock,()=>0);
 const canonical=remote.state?.lot??null;
 const lot=useMemo(()=>!ready||raw===undefined||!now?null:buildDailyLot(jobs,canonical??parse(raw,jobs),now),[jobs,canonical,raw,now,ready]);
 const matches=!!lot&&canonical?.day===lot.day&&canonical.ids.join()===lot.ids.join()&&canonical.locked===lot.locked;
 useEffect(()=>{
  if(!ready||!owner||!lot||!remote.ready||remote.reading||remote.busy||remote.error||matches)return;
  const value={day:lot.day,ids:lot.ids,locked:lot.locked},signature=JSON.stringify(value);if(pending.current===signature)return;
  const frame=requestAnimationFrame(()=>{pending.current=signature;void saveAccountLot(owner,value).finally(()=>{pending.current=null;});});return()=>cancelAnimationFrame(frame);
 },[ready,owner,lot,remote.ready,remote.reading,remote.busy,remote.error,matches]);
 useEffect(()=>{if(canonical&&raw!==undefined&&JSON.stringify(canonical)!==raw)write(storageKey,canonical);},[canonical,raw,storageKey]);
 const lock=async()=>{
  const current=continuityView(owner).state?.lot;
  if(!lot||!current||current.day!==lot.day||current.ids.join()!==lot.ids.join())return false;
  if(!lot.ids.length||current.locked)return true;
  const key=lot.day+":"+lot.ids.join();
  const running=locks.current.get(key);
  if(running)return running;
  const saving=saveAccountLot(owner,{day:lot.day,ids:lot.ids,locked:true})
   .then(saved=>!!saved?.lot?.locked&&saved.lot.day===lot.day&&saved.lot.ids.join()===lot.ids.join())
   .finally(()=>locks.current.delete(key));
  locks.current.set(key,saving);
  return saving;
 };
 return {lot,lock,ready:matches,error:remote.error,reload:remote.reload};
}
