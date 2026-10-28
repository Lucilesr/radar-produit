"use client";
import { createContext, useContext, type ReactNode } from "react";

const DemoMode = createContext(false);
export function DemoModeProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) { return <DemoMode.Provider value={enabled}>{children}</DemoMode.Provider>; }
export function useDemoMode() { return useContext(DemoMode); }
