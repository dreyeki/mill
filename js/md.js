// 迷你 Markdown：支援 Obsidian 常用語法
// ## 標題、**粗體**、*斜體*、==螢光==、~~刪除~~、`code`、[連結](url)、![說明](圖片)
// > 引言、- 清單、---、||暴雷||；連續兩張以上圖片自動變成可滑動相簿
import { esc } from "./util.js";

function inline(s) {
  const kept = [];
  s = s.replace(/\\([*_=|~`\[\]()!#>-])/g, (_, c) => `\u0000${kept.push(c) - 1}\u0000`);
  return esc(s)
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, a, src) => `<img src="${src}" alt="${a}" loading="lazy">`)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, href) => {
      const ext = /^https?:/.test(href);
      return `<a href="${href}"${ext ? ' target="_blank" rel="noopener"' : ""}>${t}</a>`;
    })
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\|\|(.+?)\|\|/g, '<span class="spoiler" role="button" tabindex="0">$1</span>')
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\s][^*]*?)\*/g, "$1<em>$2</em>")
    .replace(/==(.+?)==/g, "<mark>$1</mark>")
    .replace(/~~(.+?)~~/g, "<del>$1</del>")
    .replace(/\u0000(\d+)\u0000/g, (_, i) => esc(kept[i]));
}

const IMG_LINE = /^!\[([^\]]*)\]\(([^)\s]+)\)$/;

function figure(line) {
  const [, alt, src] = line.match(IMG_LINE);
  return `<figure><img src="${esc(src)}" alt="${esc(alt)}" loading="lazy">${alt ? `<figcaption>${esc(alt)}</figcaption>` : ""}</figure>`;
}

export function md(src = "") {
  const blocks = String(src).replace(/\r/g, "").split(/\n{2,}/);
  return blocks.map((b) => {
    const lines = b.split("\n").map((l) => l.trimEnd()).filter(Boolean);
    if (!lines.length) return "";
    const first = lines[0];
    if (lines.every((l) => IMG_LINE.test(l.trim()))) {
      if (lines.length === 1) return figure(lines[0].trim());
      return `<div class="gallery"><div class="gallery-track">${lines.map((l) => figure(l.trim())).join("")}</div><div class="gallery-count">1 / ${lines.length}</div></div>`;
    }
    if (/^---+$/.test(first)) return "<hr>";
    if (/^###\s/.test(first)) return `<h3>${inline(first.slice(4))}</h3>` + (lines.length > 1 ? `<p>${lines.slice(1).map(inline).join("<br>")}</p>` : "");
    if (/^##?\s/.test(first)) return `<h2>${inline(first.replace(/^##?\s/, ""))}</h2>` + (lines.length > 1 ? `<p>${lines.slice(1).map(inline).join("<br>")}</p>` : "");
    if (lines.every((l) => /^>\s?/.test(l))) return `<blockquote>${lines.map((l) => inline(l.replace(/^>\s?/, ""))).join("<br>")}</blockquote>`;
    if (lines.every((l) => /^[-*]\s/.test(l))) return `<ul>${lines.map((l) => `<li>${inline(l.slice(2))}</li>`).join("")}</ul>`;
    return `<p>${lines.map(inline).join("<br>")}</p>`;
  }).join("\n");
}

export function readMinutes(src = "") {
  return Math.max(1, Math.round(String(src).replace(/\s/g, "").length / 450));
}
