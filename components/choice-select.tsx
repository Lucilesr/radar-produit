"use client";

import { useId, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import {
  Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle, DrawerTrigger,
} from "@/components/ui/drawer";
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export type ChoiceOption<T extends string> = { value: T; label: string; group?: string };

export function ChoiceSelect<T extends string>({ label, value, options, onChange, disabled = false }: {
  label: string; value: T; options: readonly ChoiceOption<T>[];
  onChange: (value: T) => void; disabled?: boolean;
}) {
  const labelId = useId();
  const desktopValueId = useId();
  const mobileValueId = useId();
  const [open, setOpen] = useState(false);
  const selected = options.find(option => option.value === value)?.label ?? "Choisir";
  const groups = [...new Set(options.map(option => option.group ?? ""))];
  function choose(next: T) { onChange(next); setOpen(false); }
  function desktopOptions(group: string) {
    return options.filter(option => (option.group ?? "") === group).map(option => <SelectItem key={option.value} value={option.value} className="min-h-10 rounded-lg px-3 py-2 text-sm text-[#333333] focus:bg-[#e7ecff] focus:text-[#4b4bd1]">{option.label}</SelectItem>);
  }

  return <div className="min-w-0">
    <p id={labelId} className="mb-1.5 text-xs font-semibold text-[#535768]">{label}</p>
    <div className="hidden sm:block">
      <Select value={value} onValueChange={next => onChange(next as T)} disabled={disabled}>
        <SelectTrigger aria-labelledby={`${labelId} ${desktopValueId}`} className="h-11 w-full rounded-xl border-[#d0d4e4] bg-white px-3 text-left text-sm text-[#333333] shadow-none focus-visible:ring-[#e7ecff]">
          <SelectValue id={desktopValueId} placeholder="Choisir" />
        </SelectTrigger>
        <SelectContent aria-label={label} position="popper" side="bottom" sideOffset={6} align="end" className="z-[80] max-h-[min(44vh,320px)] min-w-[var(--radix-select-trigger-width)] rounded-2xl border-[#d0d4e4] bg-[#ffffff] p-1 shadow-xl">
          {groups.map(group => group ? <SelectGroup key={group}>
            <SelectLabel className="px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-[#686b7b]">{group}</SelectLabel>
            {desktopOptions(group)}
          </SelectGroup> : desktopOptions(""))}
        </SelectContent>
      </Select>
    </div>
    <div className="sm:hidden">
      <Drawer open={open} onOpenChange={setOpen} autoFocus>
        <DrawerTrigger asChild><button type="button" disabled={disabled} aria-labelledby={`${labelId} ${mobileValueId}`} className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-[#d0d4e4] bg-white px-3 text-left text-sm font-medium text-[#333333] shadow-sm disabled:opacity-50">
          <span id={mobileValueId} className="min-w-0 truncate">{selected}</span><ChevronDown size={17} className="shrink-0 text-[#535768]" />
        </button></DrawerTrigger>
        <DrawerContent className="z-[80] rounded-t-[26px] border-[#d0d4e4] bg-[#ffffff] shadow-2xl">
          <DrawerHeader className="border-b border-[#d0d4e4] px-5 pb-3 text-left">
            <DrawerTitle className="text-left text-base text-[#333333]">{label}</DrawerTitle>
            <DrawerDescription className="text-left text-xs text-[#535768]">Touchez une option pour la sélectionner.</DrawerDescription>
          </DrawerHeader>
          <div className="max-h-[min(55dvh,420px)] overflow-y-auto overscroll-contain px-3 pb-2 pt-2">
            {groups.map(group => <div key={group || "all"}>
              {group ? <p className="px-3 pb-1 pt-3 text-[11px] font-bold uppercase tracking-wide text-[#686b7b]">{group}</p> : null}
              {options.filter(option => (option.group ?? "") === group).map(option => <button type="button" key={option.value} onClick={() => choose(option.value)} aria-current={option.value === value ? "true" : undefined} className={`mb-1 flex min-h-12 w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-left text-sm ${option.value === value ? "bg-[#e7ecff] font-semibold text-[#4b4bd1]" : "bg-white text-[#333333]"}`}>
                <span>{option.label}</span>{option.value === value ? <Check size={17} className="shrink-0" /> : null}
              </button>)}
            </div>)}
          </div>
          <div className="border-t border-[#d0d4e4] px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-2">
            <button type="button" onClick={() => setOpen(false)} className="min-h-11 w-full rounded-xl border border-[#d0d4e4] bg-white px-4 text-sm font-semibold text-[#535768]">Fermer sans changer</button>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  </div>;
}
