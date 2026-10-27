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

export function ChoiceSelect<T extends string>({ label, value, options, onChange, disabled = false, searchable = false }: {
  label: string; value: T; options: readonly ChoiceOption<T>[];
  onChange: (value: T) => void; disabled?: boolean; searchable?: boolean;
}) {
  const labelId = useId();
  const desktopValueId = useId();
  const mobileValueId = useId();
  const [open, setOpen] = useState(false);
  const [search,setSearch]=useState("");
  function changeOpen(next:boolean) { if(next)setSearch("");setOpen(next); }
  const fold=(text:string)=>text.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  const mobileOptions=options.filter(option=>!search||fold(option.label).includes(fold(search)));
  const selected = options.find(option => option.value === value)?.label ?? "Choisir";
  const groups = [...new Set(options.map(option => option.group ?? ""))];
  function choose(next: T) { onChange(next); setOpen(false); }
  function desktopOptions(group: string) {
    return options.filter(option => (option.group ?? "") === group).map(option => <SelectItem key={option.value} value={"option:"+option.value} className="min-h-10 rounded-lg pl-3 pr-9 py-2 text-sm text-foreground focus:bg-accent focus:text-primary">{option.label}</SelectItem>);
  }

  return <div className="choice-select min-w-0">
    <p id={labelId} className="mb-1.5 text-xs font-semibold text-muted-foreground">{label}</p>
    <div className="hidden sm:block">
      <Select value={"option:"+value} onValueChange={next => onChange(next.slice(7) as T)} disabled={disabled}>
        <SelectTrigger aria-labelledby={`${labelId} ${desktopValueId}`} className="choice-select-trigger h-11 w-full rounded-xl border-border bg-white px-3 text-left text-sm text-foreground shadow-none focus-visible:ring-ring">
          <SelectValue id={desktopValueId} placeholder="Choisir" />
        </SelectTrigger>
        <SelectContent aria-label={label} position="popper" side="bottom" sideOffset={6} align="start" className="choice-select-menu z-[80] max-h-[min(70dvh,460px,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] rounded-2xl border-border bg-card p-1 shadow-xl">
          {groups.map(group => group ? <SelectGroup key={group}>
            <SelectLabel className="px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{group}</SelectLabel>
            {desktopOptions(group)}
          </SelectGroup> : desktopOptions(""))}
        </SelectContent>
      </Select>
    </div>
    <div className="sm:hidden">
      <Drawer open={open} onOpenChange={changeOpen} autoFocus>
        <DrawerTrigger asChild><button type="button" disabled={disabled} aria-labelledby={`${labelId} ${mobileValueId}`} className="choice-select-trigger flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-border bg-white px-3 text-left text-sm font-normal text-foreground shadow-sm disabled:opacity-50">
          <span id={mobileValueId} className="min-w-0 truncate">{selected}</span><ChevronDown size={17} className="shrink-0 text-muted-foreground" />
        </button></DrawerTrigger>
        <DrawerContent className="z-[80] rounded-t-[26px] border-border bg-card shadow-2xl">
          <DrawerHeader className="border-b border-border px-5 pb-3 text-left">
            <DrawerTitle className="text-left text-base text-foreground">{label}</DrawerTitle>
            <DrawerDescription className="text-left text-xs text-muted-foreground">Touchez une option pour la sélectionner.</DrawerDescription>
          </DrawerHeader>
          {searchable?<label className="px-4 pt-3"><span className="sr-only">Rechercher dans {label}</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher un pays…" /></label>:null}
          <div className="max-h-[min(55dvh,420px)] overflow-y-auto overscroll-contain px-3 pb-2 pt-2">
            {groups.map(group => <div key={group || "all"}>
              {group ? <p className="px-3 pb-1 pt-3 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{group}</p> : null}
              {mobileOptions.filter(option => (option.group ?? "") === group).map(option => <button type="button" key={option.value} onClick={() => choose(option.value)} aria-current={option.value === value ? "true" : undefined} className={`mb-1 flex min-h-12 w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-left text-sm ${option.value === value ? "bg-accent font-semibold text-primary" : "bg-white text-foreground"}`}>
                <span>{option.label}</span>{option.value === value ? <Check size={17} className="shrink-0" /> : null}
              </button>)}
            </div>)}
          </div>
          {!mobileOptions.length?<p role="status" className="p-4 text-sm">Aucun résultat.</p>:null}
          <div className="border-t border-border px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-2">
            <button type="button" onClick={() => setOpen(false)} className="min-h-11 w-full rounded-xl border border-border bg-white px-4 text-sm font-semibold text-muted-foreground">Fermer sans changer</button>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  </div>;
}
