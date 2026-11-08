"use client";
import {useSyncExternalStore} from "react";
const subscribe=()=>()=>{},snapshot=()=>Intl.DateTimeFormat().resolvedOptions().timeZone||"UTC",server=()=>"UTC";
/** Stable SSR, then the device's zone; no personal location hard coded. */
export function useDisplayTimeZone(){return useSyncExternalStore(subscribe,snapshot,server);}
