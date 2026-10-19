import type { Metadata } from "next";
import "./globals.css";
import "./radar-theme.css";

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
