"use client";
import {useRef} from "react";
import {CircleHelp,LogOut,Settings} from "lucide-react";
import {DropdownMenu,DropdownMenuContent,DropdownMenuItem,DropdownMenuLabel,DropdownMenuSeparator,DropdownMenuTrigger} from "@/components/ui/dropdown-menu";
import {signOutTarget} from "@/components/account-settings";
export function RadarAccountMenu({name,initials,demo,signOutPath,onAccount,compact=false}:{name:string;initials:string;demo:boolean;signOutPath:string;onAccount:()=>void;compact?:boolean}){
 const form=useRef<HTMLFormElement>(null),leave=signOutTarget(demo,signOutPath);
 return <div className={compact?"radar-account-mobile":"sidebar-account"}><DropdownMenu><DropdownMenuTrigger asChild><button type="button" className="radar-account-trigger" aria-label="Ouvrir le menu de mon compte"><span className="avatar" aria-hidden>{initials}</span>{!compact?<span className="radar-account-name"><strong>{name}</strong><span>Espace personnel · Privé</span></span>:null}</button></DropdownMenuTrigger><DropdownMenuContent className="radar-account-menu" align="end" sideOffset={8} collisionPadding={12}><DropdownMenuLabel>{name}</DropdownMenuLabel><DropdownMenuSeparator/><DropdownMenuItem onSelect={onAccount}><Settings size={16} aria-hidden/>Mon compte</DropdownMenuItem><DropdownMenuItem onSelect={()=>window.dispatchEvent(new Event("radar:open-guide"))}><CircleHelp size={16} aria-hidden/>Guide de prise en main</DropdownMenuItem><DropdownMenuSeparator/><DropdownMenuItem onSelect={()=>form.current?.requestSubmit()}><LogOut size={16} aria-hidden/>{leave.label}</DropdownMenuItem></DropdownMenuContent></DropdownMenu><form ref={form} method={leave.method} action={leave.action} hidden/></div>;
}
