"use client";

import { useLayoutEffect, useId, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

const revealEvent = "radar:reveal-collapsible";

/** Open every enclosing section before focusing a review item or document history. */
export function revealCollapsibleAncestors(element: HTMLElement | null) {
  let node = element;
  while (node) {
    if (node.matches("[data-slot=collapsible]")) node.dispatchEvent(new Event(revealEvent));
    node = node.parentElement;
  }
}

type Props = Omit<ComponentProps<typeof Collapsible>, "title" | "open" | "onOpenChange"> & {
  title: ReactNode;
  status?: ReactNode;
  plain?: boolean;
  headerActions?:ReactNode;
};

export function ExpandableSection({ title, status, headerActions, children, className, defaultOpen = false, plain = false, ref, ...props }: Props) {
  const [isOpen, setIsOpen] = useState(defaultOpen || plain);
  const root = useRef<HTMLDivElement | null>(null);
  const titleId = useId();

  useLayoutEffect(() => {
    const element = root.current;
    const reveal = () => setIsOpen(true);
    element?.addEventListener(revealEvent, reveal);
    return () => element?.removeEventListener(revealEvent, reveal);
  }, []);

  return (
    <Collapsible {...props} ref={node => {
      root.current = node;
      if (typeof ref === "function") return ref(node);
      if (ref) ref.current = node;
    }} open={isOpen} onOpenChange={setIsOpen} className={cn("radar-collapsible library-section flex min-w-0 flex-col gap-2", plain && "library-section-plain", className)}>
      {!plain ? <div className="radar-collapsible-heading library-section-heading">
        <CollapsibleTrigger asChild>
          <Button type="button" variant="ghost" size="icon" className="library-section-toggle size-8" aria-describedby={titleId}>
            <ChevronRight aria-hidden="true" className={isOpen?"is-open":""}/>
            <span className="sr-only">{isOpen ? "Masquer les détails" : "Afficher les détails"}</span>
          </Button>
        </CollapsibleTrigger>
        <div id={titleId} className="library-section-title min-w-0 flex-1 text-sm font-semibold">{title}</div>
        {status ? <div className="library-section-status">{status}</div> : null}
        {headerActions?<div className="library-section-actions">{headerActions}</div>:null}
      </div> : null}
      {/* Keep editors mounted so folding a section preserves pending input and review navigation. */}
      <CollapsibleContent forceMount hidden={!isOpen} className="radar-collapsible-content flex min-w-0 flex-col gap-2">{children}</CollapsibleContent>
    </Collapsible>
  );
}
