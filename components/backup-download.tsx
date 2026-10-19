"use client";
import { useEffect, useState } from "react";
export function BackupDownload() {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  async function download() {
    if (busy) return;
    setBusy(true); setFailed(false); setMessage("Vérification des données et des fichiers originaux…");
    try {
      const response = await fetch("/api/backup", { cache: "no-store", credentials: "same-origin" });
      const data = await response.json() as { error?: string; manifest?: { complete?: boolean; tables: Record<string, { count: number }> }; files?: unknown[] };
      if (!response.ok) throw new Error(data.error || "Export non confirmé. Réessayez.");
      if (!data.manifest?.complete || !Array.isArray(data.files)) throw new Error("Export incomplet : téléchargement refusé.");
      const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: "application/json" }));
      const link = document.createElement("a"); link.href = url; link.download = "radar-sauvegarde-privee.json"; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      const counts = Object.values(data.manifest.tables) as Array<{ count: number }>;
      setMessage(`Sauvegarde complète préparée : ${counts.reduce((n, t) => n + t.count, 0)} enregistrements dans ${counts.length} tables et ${data.files.length} fichiers. Le téléchargement a été demandé à votre navigateur.`);
    } catch (error) { setFailed(true); setMessage(error instanceof Error ? error.message : "Téléchargement non confirmé. Réessayez."); }
    finally { setBusy(false); }
  }
  return <div>
    <button type="button" onClick={download} disabled={busy || !ready} style={{ padding: "14px 22px", background: "#a23e2d", color: "white", borderRadius: 16, border: 0, cursor: busy ? "wait" : "pointer", font: "inherit" }}>{!ready ? "Chargement…" : busy ? "Préparation en cours…" : "Télécharger ma sauvegarde complète"}</button>
    {message && <p role={failed ? "alert" : "status"}>{message}</p>}
  </div>;
}
