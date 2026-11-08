"use client";
import {createContext,useContext,type ReactNode} from "react";
import type {NextStep,NextStepAction,NextStepKind} from "@/lib/next-steps";
type NextStepsState={queue:NextStep[];ready:boolean;stopped:boolean;onResume:()=>void;activeKind:NextStepKind|"validation"|null;onAction:(action:NextStepAction)=>void};
const Context=createContext<NextStepsState>({queue:[],ready:false,stopped:false,onResume:()=>{},activeKind:null,onAction:()=>{}});
export function NextStepsProvider({children,...state}:NextStepsState&{children:ReactNode}){return <Context.Provider value={state}>{children}</Context.Provider>;}
export function useRadarNextSteps(){return useContext(Context);}
