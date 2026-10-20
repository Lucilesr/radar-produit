"use client";
import { useState, type ReactNode } from "react";
import { CircleHelp } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
export function HelpTooltip({label,children}:{label:string;children:ReactNode}) {
  const [open,setOpen]=useState(false);
  return <TooltipProvider delayDuration={350}><Tooltip open={open} onOpenChange={setOpen}><TooltipTrigger asChild><button type="button" aria-label={`À propos de : ${label}`} className="help-tooltip-trigger" onClick={()=>setOpen(value=>!value)}><CircleHelp size={16} aria-hidden /></button></TooltipTrigger><TooltipContent sideOffset={6} className="help-tooltip-content">{children}</TooltipContent></Tooltip></TooltipProvider>;
}
