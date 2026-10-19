"use client";
import type { ExtractionPage } from "./experience-domain";

export async function extractDocument(name: string, buffer: ArrayBuffer): Promise<{ pages: ExtractionPage[]; status: "extracted" | "needs_conversion"; issue: string; digest: string }> {
  const digest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", buffer))].map(b => b.toString(16).padStart(2, "0")).join("");
  const ext = name.split(".").pop()?.toLowerCase(); let pages: ExtractionPage[] = []; let issue = "";
  try {
    if (ext === "pdf") {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = "/vendor/pdf.worker.min.mjs";
      const task = pdfjs.getDocument({ data: buffer.slice(0), useSystemFonts: true });
      const pdf = await task.promise;
      try {
        if (pdf.numPages > 80) throw new Error("Document de plus de 80 pages : convertir en texte par sections.");
        for (let n = 1; n <= pdf.numPages; n++) {
          const page = await pdf.getPage(n); const content = await page.getTextContent(); let text = ""; let lastY: number | undefined;
          for (const item of content.items) if ("str" in item) {
            const y = item.transform[5];
            if (lastY !== undefined && Math.abs(y - lastY) > 3 && !text.endsWith("\n")) text += "\n";
            text += item.str + (item.hasEOL ? "\n" : " "); lastY = y;
          }
          pages.push({ page: n, text: text.trim() });
        }
      } finally { await task.destroy(); }
      if (pages.some(p => p.text.replace(/\s/g, "").length < 20)) issue = "Au moins une page est illisible ou scannée. Une conversion/OCR est nécessaire ; extraction partielle conservée, aucune proposition automatique.";
    } else if (ext === "docx") {
      const mammoth = await import("mammoth/mammoth.browser");
      const result = await mammoth.extractRawText({ arrayBuffer: buffer }); pages = [{ page: 1, text: result.value }];
    } else if (ext === "md" || ext === "txt") { pages = [{ page: 1, text: new TextDecoder("utf-8", { fatal: true }).decode(buffer) }]; }
    else issue = "Format non extractible ici. Convertir le document en DOCX, PDF texte ou TXT (l’original est conservé).";
    if (!issue && pages.every(p => p.text.trim().length < 20)) issue = "Aucun texte exploitable. Document vide ou scanné : conversion/OCR nécessaire.";
    if (pages.reduce((n, p) => n + p.text.length, 0) > 200000) { pages = []; issue = "Texte supérieur à 200 000 caractères : convertir en sections plus petites. Aucun texte tronqué."; }
  } catch (error) { pages = []; issue = error instanceof Error ? `Extraction impossible : ${error.message}. Conversion nécessaire.` : "Extraction impossible. Conversion nécessaire."; }
  return { digest, pages, status: issue ? "needs_conversion" : "extracted", issue };
}
