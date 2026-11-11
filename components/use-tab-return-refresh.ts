"use client";

import {useEffect,useEffectEvent} from "react";
import {createTabReturnRefresh} from "@/lib/tab-return-refresh";

const refreshes = createTabReturnRefresh(() => performance.now());
const onVisibilityChange = () => refreshes.visibilityChanged(document.hidden);
let subscribers = 0;

export function useTabReturnRefresh(key: string, read: () => void, enabled = true) {
  const refresh = useEffectEvent(read);
  useEffect(() => {
    if (!enabled || !key) return;
    const unsubscribe = refreshes.subscribe(key, () => refresh());
    if (subscribers++ === 0) {
      onVisibilityChange();
      document.addEventListener("visibilitychange", onVisibilityChange);
    }
    return () => {
      unsubscribe();
      if (--subscribers === 0) {
        document.removeEventListener("visibilitychange", onVisibilityChange);
        refreshes.visibilityChanged(false);
      }
    };
  }, [key, enabled]);
}
