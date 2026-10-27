"use client";

import { useId } from "react";
import { Pencil } from "lucide-react";

/** The same optional limit, edited where the answer count is read. */
export function CharacterCounter({ count, value, onChange, label, disabled = false }: { count: number; value: string; onChange: (value: string) => void; label: string; disabled?: boolean }) {
  const id = useId();
  const number = Number(value);
  const invalid = !!value && (!Number.isInteger(number) || number < 1 || number > 10000);
  const over = !!value && !invalid && count > number;
  return <div className="signal-counter-wrap"><div className={`signal-counter${over || invalid ? " is-warning" : ""}`}>
    <output aria-label="Nombre de caractères de la réponse">{count.toLocaleString("fr-FR")}</output><span aria-hidden>/</span>
    <label className="signal-limit-control"><span className="sr-only">{label}</span><input aria-describedby={id} aria-invalid={invalid} type="number" inputMode="numeric" min={1} max={10000} step={1} value={value} onChange={event => onChange(event.target.value)} disabled={disabled} placeholder="Sans limite"/><Pencil size={12} aria-hidden/></label><span>caractères</span>
  </div><span id={id} className={over || invalid ? "signal-counter-message" : "sr-only"} aria-live="polite">{invalid ? "Choisissez une limite de 1 à 10 000 caractères." : over ? "Limite dépassée." : "Modifiez la limite dans le compteur. Laissez vide pour ne pas fixer de limite."}</span></div>;
}
