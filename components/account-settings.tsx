"use client";

import { LogOut } from "lucide-react";
import { WorkspaceButton, WorkspaceFormSection } from "@/components/workspace-form";

/** Where a demo visitor or a signed-in account leaves Radar. */
export function signOutTarget(demo: boolean, signOutPath: string) {
  return demo ? { action: "/demo-exit", method: "get" as const, label: "Quitter la démo" } : { action: signOutPath, method: "post" as const, label: "Se déconnecter" };
}

export function AccountSettings({ userName, email, demo, signOutPath }: { userName: string; email?: string; demo: boolean; signOutPath: string }) {
  const leave = signOutTarget(demo, signOutPath);
  return <div className="account-settings">
    <WorkspaceFormSection title="Connexion" description={demo ? "Vous utilisez la démo : les données sont fictives et isolées dans ce navigateur." : "Radar vous identifie avec votre compte ChatGPT. Vos données ne sont visibles que par vous."}>
      <div className="account-identity">
        <span className="avatar" aria-hidden>{userName.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase() || "RP"}</span>
        <div><strong>{userName}</strong>{email && email !== userName ? <span>{email}</span> : null}</div>
      </div>
      <div className="account-actions">
        <form method={leave.method} action={leave.action}>
          <WorkspaceButton type="submit"><LogOut size={15} aria-hidden />{leave.label}</WorkspaceButton>
        </form>
      </div>
    </WorkspaceFormSection>
  </div>;
}

/** Compact sign-out control for the desktop sidebar; « Mon compte » covers smaller screens. */
export function SidebarSignOut({ demo, signOutPath }: { demo: boolean; signOutPath: string }) {
  const leave = signOutTarget(demo, signOutPath);
  return <form className="sidebar-signout" method={leave.method} action={leave.action}>
    <button type="submit" aria-label={leave.label} title={leave.label}><LogOut size={16} aria-hidden /></button>
  </form>;
}
