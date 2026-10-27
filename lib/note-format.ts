/** Small, explicit text format for private notes. API payloads remain strings. */
const escapeHtml = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");

function inline(value: string) {
  return escapeHtml(value)
    .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|\W)_([^_\n]+)_(?=\W|$)/g, "$1<em>$2</em>");
}

/** Only our paragraph/list/emphasis tags can be generated; HTML input is text. */
export function noteToHtml(value: string): string {
  let html = "", list = "";
  const closeList = () => { if (list) { html += `</${list}>`; list = ""; } };
  for (const line of value.replaceAll("\r\n", "\n").split("\n")) {
    const bullet = line.match(/^[-*] (.*)$/), numbered = line.match(/^\d+\. (.*)$/);
    if (bullet || numbered) {
      const tag = bullet ? "ul" : "ol";
      if (tag !== list) { closeList(); html += `<${tag}>`; list = tag; }
      html += `<li>${inline((bullet || numbered)![1]) || "<br>"}</li>`;
    } else {
      closeList(); html += `<p>${inline(line) || "<br>"}</p>`;
    }
  }
  closeList();
  return html;
}

type NoteNode = { nodeType: number; nodeName: string; textContent: string | null; childNodes: ArrayLike<NoteNode> };

/** Serialize editable DOM through an allowlist; no HTML is sent to the API. */
export function noteFromDom(root: NoteNode): string {
  const walk = (node: NoteNode): string => {
    if (node.nodeType === 3) return node.textContent || "";
    const tag = node.nodeName.toUpperCase();
    if (["SCRIPT", "STYLE", "IMG", "IFRAME", "OBJECT"].includes(tag)) return "";
    const inner = Array.from(node.childNodes).map(walk).join("");
    switch (tag) {
      case "STRONG": case "B": return inner.trim() ? `**${inner}**` : inner;
      case "EM": case "I": return inner.trim() ? `_${inner}_` : inner;
      case "BR": return "\n";
      case "UL": case "OL": return Array.from(node.childNodes).filter(child => child.nodeName.toUpperCase() === "LI")
        .map((child, index) => `${tag === "UL" ? "-" : index + 1 + "."} ${Array.from(child.childNodes).map(walk).join("").replace(/\n+$/g, "")}`).join("\n") + "\n";
      case "P": case "DIV": return inner === "\n" ? "\n" : inner + "\n";
      default: return inner;
    }
  };
  return Array.from(root.childNodes).map(walk).join("").replace(/\n+$/g, "");
}
