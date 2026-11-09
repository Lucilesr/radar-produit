"use client";
import { useRef, useState, type MouseEvent, type PointerEvent, type ReactNode } from "react";
import { CircleHelp } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
/* The help opens on hover or focus. Activating the button (click, tap, Enter or Space)
   keeps it open; a second activation closes it until the pointer leaves or focus moves.
   Escape, leaving the button or pressing elsewhere also close it.
   Radix would otherwise close the help on pointer down and on click. */
export function HelpTooltip({label,children}:{label:string;children:ReactNode}) {
  const [open,setOpen]=useState(false);
  const pinned=useRef(false),dismissed=useRef(false),trigger=useRef<HTMLButtonElement>(null);
  function change(next:boolean){if(next&&dismissed.current)return;if(!next)pinned.current=false;setOpen(next);}
  function activate(event:MouseEvent<HTMLButtonElement>){event.preventDefault();if(open&&pinned.current){pinned.current=false;dismissed.current=true;setOpen(false);return;}dismissed.current=false;pinned.current=true;setOpen(true);}
  function press(event:PointerEvent<HTMLButtonElement>){event.preventDefault();event.currentTarget.focus({preventScroll:true});}
  function reset(){dismissed.current=false;}
  return <TooltipProvider delayDuration={350}><Tooltip open={open} onOpenChange={change}><TooltipTrigger asChild onClick={activate} onPointerDown={press} onPointerLeave={reset} onBlur={reset}><button ref={trigger} type="button" aria-label={`À propos de : ${label}`} className="help-tooltip-trigger"><CircleHelp size={16} aria-hidden /></button></TooltipTrigger><TooltipContent sideOffset={6} collisionPadding={16} className="help-tooltip-content" onPointerDownOutside={event=>{if(trigger.current?.contains(event.target as Node))event.preventDefault();}}>{children}</TooltipContent></Tooltip></TooltipProvider>;
}
