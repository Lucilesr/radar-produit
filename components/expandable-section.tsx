"use client";

import { useLayoutEffect, useId, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { ChevronsUpDown } from "lucide-react";
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
};

export function ExpandableSection({ title, status, children, className, defaultOpen = false, ref, ...props }: Props) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
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
    }} open={isOpen} onOpenChange={setIsOpen} className={cn("radar-collapsible flex min-w-0 flex-col gap-2", className)}>
      <div className="radar-collapsible-heading flex items-center justify-between gap-4 px-4">
        <div id={titleId} className="min-w-0 flex-1 text-sm font-semibold">{title}</div>
        <CollapsibleTrigger asChild>
          <Button type="button" variant="ghost" size="icon" className="size-8" aria-describedby={titleId}>
            <ChevronsUpDown aria-hidden="true" />
            <span className="sr-only">{isOpen ? "Masquer les détails" : "Afficher les détails"}</span>
          </Button>
        </CollapsibleTrigger>
      </div>
      {status ? <div className="radar-collapsible-status flex items-center justify-between gap-4 rounded-md border px-4 py-2 text-sm"><span className="text-muted-foreground">Statut</span>{status}</div> : null}
      {/* Keep editors mounted so folding a section preserves pending input and review navigation. */}
      <CollapsibleContent forceMount hidden={!isOpen} className="radar-collapsible-content flex min-w-0 flex-col gap-2">{children}</CollapsibleContent>
    </Collapsible>
  );
}
