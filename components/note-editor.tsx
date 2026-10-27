"use client";

import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { Bold, Italic, List, ListOrdered, Redo2, RemoveFormatting, Undo2 } from "lucide-react";
import { noteFromDom, noteToHtml } from "@/lib/note-format";

export function NoteText({ value, className = "" }: { value: string; className?: string }) {
  return <div className={`signal-note-read ${className}`} dangerouslySetInnerHTML={{ __html: noteToHtml(value) }} />;
}

export function NoteEditor({ value, onChange, label, disabled = false, maxLength, rows = 4, placeholder = "Votre texte…", inputRef }: {
  value: string; onChange: (value: string) => void; label: string; disabled?: boolean;
  maxLength: number; rows?: number; placeholder?: string; inputRef?: RefObject<HTMLDivElement | null>;
}) {
  const root = useRef<HTMLDivElement>(null), range = useRef<Range | null>(null), last = useRef(value);
  const help = useId(), [formats, setFormats] = useState({ bold: false, italic: false, bullets: false, numbers: false });
  const [initial] = useState(() => ({ __html: noteToHtml(value) }));
  const tooLong = value.length > maxLength;

  useEffect(() => {
    if (value !== last.current && root.current) {
      root.current.innerHTML = noteToHtml(value);
      last.current = value;
    }
  }, [value]);

  function remember() {
    const selection = window.getSelection();
    if (!selection?.rangeCount || !root.current?.contains(selection.anchorNode)) return;
    range.current = selection.getRangeAt(0).cloneRange();
    setFormats({ bold: document.queryCommandState("bold"), italic: document.queryCommandState("italic"), bullets: document.queryCommandState("insertUnorderedList"), numbers: document.queryCommandState("insertOrderedList") });
  }
  function publish() {
    if (!root.current) return;
    const next = noteFromDom(root.current);
    last.current = next;
    onChange(next);
    remember();
  }
  function restoreSelection() {
    root.current?.focus();
    if (range.current && root.current?.contains(range.current.commonAncestorContainer)) {
      const selection = window.getSelection();
      selection?.removeAllRanges(); selection?.addRange(range.current);
    }
  }
  function command(name: string, text?: string) {
    if (disabled) return;
    restoreSelection();
    // Native editing commands preserve the browser's text selection and undo stack.
    document.execCommand(name, false, text);
    publish();
  }
  const controls = [
    { label: "Gras", command: "bold", Icon: Bold, pressed: formats.bold },
    { label: "Italique", command: "italic", Icon: Italic, pressed: formats.italic },
    { label: "Liste à puces", command: "insertUnorderedList", Icon: List, pressed: formats.bullets },
    { label: "Liste numérotée", command: "insertOrderedList", Icon: ListOrdered, pressed: formats.numbers },
    { label: "Annuler la saisie", command: "undo", Icon: Undo2 },
    { label: "Rétablir la saisie", command: "redo", Icon: Redo2 },
    { label: "Retirer la mise en forme", command: "removeFormat", Icon: RemoveFormatting },
  ];
  return <div className="signal-note-editor" data-disabled={disabled || undefined}>
    <div className="signal-note-toolbar" role="group" aria-label={`Mise en forme · ${label}`}>
      {controls.map(control => <button type="button" key={control.command} title={control.label} aria-label={`${control.label} · ${label}`} aria-pressed={control.pressed} disabled={disabled}
        onMouseDown={event => event.preventDefault()} onClick={() => command(control.command)}><control.Icon size={16} aria-hidden /></button>)}
    </div>
    <div ref={node => { root.current = node; if (inputRef) inputRef.current = node; }}
      className="signal-note-input" role="textbox" aria-label={label} aria-placeholder={placeholder} aria-multiline="true" aria-describedby={help} aria-invalid={tooLong} aria-disabled={disabled} data-empty={!value || undefined}
      tabIndex={disabled ? -1 : 0} contentEditable={!disabled} suppressContentEditableWarning data-placeholder={placeholder}
      style={{ minHeight: rows * 25 + 24 }} dangerouslySetInnerHTML={initial}
      onInput={publish} onKeyUp={remember} onMouseUp={remember} onBlur={remember}
      onPaste={event => { event.preventDefault(); command("insertText", event.clipboardData.getData("text/plain")); }}
      onDrop={event => { event.preventDefault(); command("insertText", event.dataTransfer.getData("text/plain")); }} />
    <div id={help} className="signal-note-meta"><span role={tooLong ? "alert" : undefined}>{tooLong ? `Limite de ${maxLength.toLocaleString("fr-FR")} caractères dépassée. Raccourcissez le texte avant d’enregistrer.` : "Gras, italique et listes · Ctrl / ⌘ B ou I"}</span><span>{value.length.toLocaleString("fr-FR")} / {maxLength.toLocaleString("fr-FR")}</span></div>
  </div>;
}
