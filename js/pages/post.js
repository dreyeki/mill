import { $, $$, esc, getJSON, fmtDate, icon } from "../util.js";
import { S, save, gain, levelOf } from "../store.js";
import { md } from "../md.js";
import { lightbox, stars, sfx, toast, buzz } from "../fx.js";
import { isLocked, coverImg } from "./home.js";

const REACTS = [["❤️", "喜歡"], ["✨", "推推"], ["😭", "被刀"], ["🤣", "好笑"]];

export async function render(view, [id]) {
  const { posts } = await getJSON("data/posts.json");
  const i = posts.findIndex((p) => p.id === id);
  const p = posts[i];
  if (!p) {
    view.innerHTML = `<div class="empty"><span class="big">🫥</span>找不到這篇文章</div>`;
    return;
  }
  const locked = isLocked(p);
  const prev = posts[i - 1], next = posts[i + 1];
  S.react[p.id] ||= {};

  view.innerHTML = `
  <div class="read-progress"></div>
  <div class="article-hero">${coverImg(p)}<button class="back-btn" aria-label="返回">${icon.back}</button></div>
  <header class="article-head card">
    <span class="tag ${p.color || "pink"}">${esc(p.category || "公告")}</span>
    <h1>${esc(p.title)}</h1>
    <div class="meta"><time>${fmtDate(p.date)}</time>${p.minutes ? `<span>· ${p.minutes} 分鐘</span>` : ""}${(p.tags || []).map((t) => `<span class="tag sky">#${esc(t)}</span>`).join("")}</div>
  </header>
  ${locked
    ? `<div class="empty"><span class="big">🔒</span>Lv.${p.minLevel} 解鎖<br><small>目前 Lv.${levelOf(S.points)}</small><div style="margin-top:16px"><a class="btn btn-primary" href="#/">去賺積分</a></div></div>`
    : `<article class="prose">${md(p.body)}</article>
  <div class="article-foot card">
    <div class="react-row">${REACTS.map(([e, n]) => `<button class="react${S.react[p.id][e] ? " on" : ""}" data-e="${e}" aria-label="${n}" aria-pressed="${!!S.react[p.id][e]}"><span class="e">${e}</span></button>`).join("")}</div>
    <button class="btn btn-icon btn-sm share" aria-label="分享">${icon.share}</button>
  </div>`}
  <div class="sec-head"><h2 class="sec-title">${next ? "下一篇" : prev ? "上一篇" : ""}</h2></div>
  ${[next || prev].filter(Boolean).map((q) => `<a class="post-row card press" href="#/post/${encodeURIComponent(q.id)}">
    <div class="post-thumb">${coverImg(q)}</div>
    <div><span class="tag ${q.color || "pink"}">${esc(q.category || "")}</span><h3>${esc(q.title)}</h3></div></a>`).join("")}`;

  $(".back-btn", view).onclick = () => (history.length > 1 ? history.back() : (location.hash = "#/"));
  if (!S.seen[p.id]) { S.seen[p.id] = 1; save(); }
  if (locked) return;

  /* 圖片燈箱、暴雷、相簿計數 */
  view.addEventListener("click", (e) => {
    const img = e.target.closest(".prose figure img");
    if (img) return lightbox(img.src, img.alt);
    const sp = e.target.closest(".spoiler:not(.open)");
    if (sp) { sp.classList.add("open"); sfx.pop(); stars(e.clientX, e.clientY, 5); }
  });
  view.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.matches(".spoiler")) e.target.classList.add("open");
  });
  $$(".gallery", view).forEach((g) => {
    const track = $(".gallery-track", g), count = $(".gallery-count", g);
    const n = track.children.length;
    track.addEventListener("scroll", () => {
      const k = Math.round(track.scrollLeft / (track.children[0].offsetWidth + 12));
      count.textContent = `${Math.min(n, k + 1)} / ${n}`;
    }, { passive: true });
  });

  /* 反應 */
  view.addEventListener("click", (e) => {
    const b = e.target.closest(".react");
    if (!b) return;
    const em = b.dataset.e;
    const on = !S.react[p.id][em];
    S.react[p.id][em] = on;
    b.classList.toggle("on", on);
    b.setAttribute("aria-pressed", on);
    save();
    if (on) {
      sfx.pop(); buzz(8);
      stars(e.clientX, e.clientY, 7, [em]);
      gain(`react:${p.id}`, 1, "留下反應");
    }
  });

  $(".share", view).onclick = async () => {
    const url = location.href;
    try {
      if (navigator.share) await navigator.share({ title: p.title, url });
      else { await navigator.clipboard.writeText(url); toast("連結已複製 📋"); }
    } catch { /* 使用者取消 */ }
  };

  /* 視差封面 + 閱讀進度 + 讀完獎勵 */
  const heroImg = $(".article-hero img", view);
  const bar = $(".read-progress", view);
  const art = $(".prose", view);
  let ticking = false;
  const t0 = Date.now();
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      if (heroImg) heroImg.style.setProperty("--py", Math.min(scrollY * 0.35, 200));
      const r = art.getBoundingClientRect();
      const pct = Math.min(1, Math.max(0, (innerHeight - r.top) / (r.height + 40)));
      bar.style.width = pct * 100 + "%";
      if (pct > 0.92 && Date.now() - t0 > 8000) gain(`read:${p.id}`, 2, "讀完文章");
    });
  };
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();
  const late = setTimeout(onScroll, 8100);
  return () => { removeEventListener("scroll", onScroll); clearTimeout(late); };
}
