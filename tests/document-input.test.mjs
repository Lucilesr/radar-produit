import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../lib/document-input.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { validateDocumentMeta, validateDocumentBytes, downloadDisposition, publicDocument, documentLinks, isDocumentSlot } = await import("data:text/javascript;base64," + Buffer.from(compiled).toString("base64"));
function bytes(text) { return new TextEncoder().encode(text).buffer; }

test("formats, taille et fichier vide contrôlés", () => {
  assert.equal(validateDocumentMeta("CV.PDF", 1024), "pdf");
  assert.throws(() => validateDocumentMeta("vide.pdf", 0), /vide/);
  assert.throws(() => validateDocumentMeta("cv.pdf", 8 * 1024 * 1024 + 1), /8 Mo/);
  assert.throws(() => validateDocumentMeta("cv.exe", 10), /Format/);
});
test("contenu cohérent avec le format, indépendamment du MIME envoyé", () => {
  assert.equal(validateDocumentBytes("cv.pdf", bytes("%PDF-1.7\nfixture")), "application/pdf");
  assert.throws(() => validateDocumentBytes("cv.pdf", bytes("<html>Pas un PDF</html>")), /PDF valide/);
  assert.equal(validateDocumentBytes("expériences.md", bytes("# Réalisations\nTexte UTF-8")), "text/markdown; charset=utf-8");
  assert.throws(() => validateDocumentBytes("data.txt", new Uint8Array([255]).buffer), /UTF-8/);
});
test("noms Unicode téléchargeables sans injection d'en-tête", () => {
  const header = downloadDisposition('CV Camille fictif français\r\n".pdf');
  assert.doesNotMatch(header, /[\r\n]/);
  assert.match(header, /filename\*=UTF-8''/);
  assert.match(header, /fran%C3%A7ais/);
});
test("métadonnées sans clé de stockage ni identité interne", () => {
  const meta = publicDocument({ id: "fixture", originalName: "cv.pdf", contentType: "application/pdf", size: 10, userId: "private", objectKey: "private-key" });
  assert.equal(meta.objectKey, undefined); assert.equal(meta.userId, undefined);
  const links = documentLinks({ cvFrDocumentId: "a", cvEnDocumentId: "b", applicationNotes: { private: "secret" } });
  assert.equal(links.cvFrDocumentId, "a"); assert.equal(links.applicationNotes, undefined);
  assert.ok(isDocumentSlot("cvFrDocumentId")); assert.ok(!isDocumentSlot("userId"));
});
