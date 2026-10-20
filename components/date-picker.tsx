"use client";
import { useId, useState } from "react";
import { format } from "date-fns";
import { fr } from "react-day-picker/locale";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { calendarDateValue, readCalendarDate } from "@/lib/calendar-date";

export function DatePicker({label,value,onChange,disabled=false}:{label:string;value:string;onChange:(value:string)=>void;disabled?:boolean}) {
  const id=useId(), valueId=useId(); const [open,setOpen]=useState(false);
  const date=readCalendarDate(value);
  return <div className="date-field"><p id={id} className="form-control-label">{label}</p><Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild><Button type="button" variant="outline" disabled={disabled} aria-labelledby={`${id} ${valueId}`} data-empty={!date} className="date-picker-trigger w-full justify-between text-left font-normal"><span id={valueId}>{date?format(date,"PPP",{locale:fr}):"Choisir une date"}</span><ChevronDown size={16} aria-hidden /></Button></PopoverTrigger><PopoverContent align="start" sideOffset={8} className="date-picker-popover w-auto p-0" aria-label={label}><Calendar mode="single" locale={fr} selected={date} defaultMonth={date} onSelect={next=>{onChange(next?calendarDateValue(next):"");setOpen(false);}} autoFocus className="[--cell-size:2.25rem]"/><div className="date-picker-actions"><button type="button" onClick={()=>{onChange("");setOpen(false);}} className="secondary-button">Effacer</button><button type="button" onClick={()=>setOpen(false)} className="secondary-button">Fermer</button></div></PopoverContent></Popover></div>;
}
export function DateTimePicker({label,value,onChange,disabled=false}:{label:string;value:string;onChange:(value:string)=>void;disabled?:boolean}) {
  const date=value.slice(0,10),time=value.slice(11,16);
  return <div className="date-time-field"><DatePicker label={label} value={date} disabled={disabled} onChange={next=>onChange(next?`${next}T${time||"09:00"}`:"")}/><label className="time-field"><span className="form-control-label">Heure</span><input type="time" aria-label={`Heure — ${label}`} disabled={disabled||!date} value={time} onChange={event=>onChange(event.target.value&&date?`${date}T${event.target.value}`:"")}/></label></div>;
}
