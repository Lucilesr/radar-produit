import type { Metadata } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import "./radar-theme.css";
import "./workspace.css";
import "./today-workspace.css";
import "./opportunities-workspace.css";
import "./profile-workspace.css";
import "./signal-tokens.css";
import "./signal-controls.css";
import "./signal-shell.css";
import "./signal-opportunities.css";
import "./signal-forms.css";
import "./signal-applications.css";
import "./signal-interviews.css";
import "./signal-experience-components.css";
import "./signal-profile.css";
import "./signal-documents.css";
import "./signal-sources.css";
import "./signal-today.css";
import "./signal-brief.css";
import "./signal-kanban.css";
import "./onboarding-tour.css";
import "./demo-notice.css";

export const metadata: Metadata = {
  title: "Radar Produit",
  description: "Votre espace privé de veille et de candidatures produit.",
  icons: {
    icon: "/favicon.svg?v=orbite-1",
    shortcut: "/favicon.svg?v=orbite-1",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const demo = !!(await cookies()).get("radar_demo_visitor")?.value;
  return (
    <html lang="fr">
      <body>{demo ? <div className="demo-notice"><span>Démo · données fictives isolées dans ce navigateur · aucune candidature réelle</span><a href="/demo?onboarding=1">Tester l’onboarding</a><a href="/demo">Recommencer</a><a href="/demo-exit">Quitter la démo</a></div> : null}{children}</body>
    </html>
  );
}
