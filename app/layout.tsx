import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: "Radar Produit",
  description: "Votre espace privé de veille et de candidatures produit.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
