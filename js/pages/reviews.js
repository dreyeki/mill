import { $, $$, esc, getJSON, debounce, icon } from "../util.js";
import { S, save, gain } from "../store.js";
import { sheet, sfx } from "../fx.js";

const LV_COLOR = ["#b8b2d1", "#ffb84d", "#3fd1a8", "#5fbfff", "#a184ff", "#ff7eb6"];
const PAGE = 50;

const scoreText = (e) => e.score?.value != null ? e.score.value : e.range ? `${e.range[0]}~${e.range[1]}` : "—";
const scoreNum = (e) => e.score?.value ?? (e.range ? (e.range[0] + e.range[1]) / 2 : -1);
const tierClass = (k) => `tier tier-${esc(k)}`;

function card(e, col) {
  const read = S.read[`${col.id}:${e.title}`];
  return `<button class="rv card press${read ? " read" : ""}" data-k="${esc(e.title)}">
    <div>
      <span class="${tierClass(e.tierKey)}">${esc(e.tierKey || "—")}</span>
      <div class="rv-title" style="margin-top:6px">${esc(e.title)}</div>
    </div>
    <div class="rv-score">${scoreText(e)}${e.score?.label ? `<small>${esc(e.score.label)}</small>` : ""}</div>
    ${e.tags.length ? `<div class="rv-tags">${e.tags.slice(0, 4).map((t, i) => `<span class="tag ${["pink", "sky", "mint", ""][i % 4]}">${esc(t)}</span>`).join("")}</div>` : ""}
  </button>`;
}

function detail(e) {
  const lo = 70, hi = 100;
  const a = e.range ? Math.max(0, (e.range[0] - lo) / (hi - lo)) : null;
  const w = e.range ? Math.max(0.04, (Math.min(hi, e.range[1]) - Math.max(lo, e.range[0])) / (hi - lo)) : null;
  const raw = [e.head, ...e.lines].filter(Boolean).join("\n");
  return `
    <span class="${tierClass(e.tierKey)}">${esc(e.tierKey || "—")}</span>
    <h2>${esc(e.title)}</h2>
    ${e.score || e.range ? `<div class="rd-score">
      <div><div class="big">${scoreText(e)}</div><div class="lbl">${esc(e.score?.label || "")}</div></div>
      ${e.range ? `<div class="meter" title="${e.range[0]}~${e.range[1]}"><i style="--a:${a * 100}%;--w:${w * 100}%"></i></div>` : ""}
    </div>` : ""}
    ${e.tags.length ? `<div class="rv-tags" style="display:flex;flex-wrap:wrap;gap:6px">${e.tags.map((t, i) => `<span class="tag ${["pink", "sky", "mint", "", "lemon", "orange"][i % 6]}">${esc(t)}</span>`).join("")}</div>` : ""}
    ${e.marks.length ? `<div class="rd-marks">${e.marks.map((m) => `<div class="rd-mark">${esc(m)}</div>`).join("")}</div>` : ""}
    ${e.quotes.map((q) => `<div class="rd-quote">「${esc(q)}」</div>`).join("")}
    ${e.chars.length ? `<div class="rd-sub">CHARACTERS</div><div class="rd-chars">${e.chars.map((c, i) => `<span class="char" style="--lv:${LV_COLOR[c.lv] || LV_COLOR[0]};animation-delay:${i * 30}ms">${esc(c.name)}<b>Lv${c.lv}${esc(c.plus)}</b></span>`).join("")}</div>` : ""}
    ${raw ? `<div class="rd-sub">NOTE</div><div class="rd-lines">${esc(raw)}</div>` : ""}
    <div class="rd-sub" style="margin-top:20px">${esc(e.tier)}</div>`;
}

export async function render(view, [colParam]) {
  const data = await getJSON("data/reviews.json");
  const cols = data.collections;
  let ci = Math.max(0, cols.findIndex((c) => c.id === colParam));
  let tier = "全部", query = "", sortByScore = false;
  let io = null;

  view.innerHTML = `
  <h1 class="page-title" style="display:flex;align-items:center;justify-content:space-between"><span class="accent">推薦心得</span>
    <button class="btn btn-icon btn-sm legend" aria-label="評分說明">${icon.info}</button></h1>
  <div class="seg" role="tablist">${cols.map((c, i) => `<button role="tab" data-i="${i}" class="${i === ci ? "on" : ""}">${esc(c.name)}</button>`).join("")}<i class="seg-ind"></i></div>
  <div style="display:flex;gap:8px;margin-top:14px">
    <label class="search" style="flex:1">${icon.search}<input type="search" placeholder="書名、標籤、角色" aria-label="搜尋"></label>
    <button class="btn btn-icon sort" aria-label="依分數排序" aria-pressed="false" style="width:46px;min-height:46px;border-radius:14px">${icon.sort}</button>
  </div>
  <div class="chips tiers" style="margin-top:10px"></div>
  <div class="review-list"></div>`;

  const seg = $(".seg", view), ind = $(".seg-ind", view), list = $(".review-list", view);
  const moveInd = () => {
    const b = $$(".seg button", seg)[ci];
    ind.style.setProperty("--x", b.offsetLeft + "px");
    ind.style.setProperty("--w", b.offsetWidth + "px");
  };

  function paintChips() {
    const col = cols[ci];
    const counts = {};
    col.entries.forEach((e) => (counts[e.tierKey] = (counts[e.tierKey] || 0) + 1));
    const keys = [...new Set(col.entries.map((e) => e.tierKey))].filter(Boolean);
    $(".tiers", view).innerHTML = ["全部", ...keys].map((k) =>
      `<button class="chip${k === tier ? " on" : ""}" data-k="${esc(k)}">${esc(k)}<span class="n">${k === "全部" ? col.entries.length : counts[k]}</span></button>`).join("");
  }

  function paintList() {
    io?.disconnect();
    const col = cols[ci];
    const q = query.trim().toLowerCase();
    let rows = col.entries.filter((e) =>
      (tier === "全部" || e.tierKey === tier) &&
      (!q || (e.title + " " + e.tags.join(" ") + " " + e.chars.map((c) => c.name).join(" ") + " " + e.lines.join(" ")).toLowerCase().includes(q)));
    if (sortByScore) rows = rows.slice().sort((a, b) => scoreNum(b) - scoreNum(a));
    list.innerHTML = rows.length ? "" : `<div class="empty"><span class="big">📭</span>找不到相關心得</div>`;
    let shown = 0, lastTier = null;
    const more = () => {
      const chunk = rows.slice(shown, shown + PAGE);
      let html = "";
      chunk.forEach((e) => {
        if (!sortByScore && e.tier !== lastTier) {
          lastTier = e.tier;
          const n = rows.filter((x) => x.tier === e.tier).length;
          html += `<div class="tier-head"><span class="${tierClass(e.tierKey)}">${esc(e.tierKey)}</span><span>${esc(e.tier.slice(e.tierKey.length).replace(/^[\s-]+/, ""))}</span><span class="cnt">${n}</span></div>`;
        }
        html += card(e, col);
      });
      $(".sentinel", list)?.remove();
      list.insertAdjacentHTML("beforeend", html + (shown + PAGE < rows.length ? '<div class="sentinel" style="height:1px"></div>' : ""));
      shown += PAGE;
      const s = $(".sentinel", list);
      if (s) io.observe(s);
    };
    io = new IntersectionObserver((ents) => ents.some((x) => x.isIntersecting) && more(), { rootMargin: "600px" });
    more();
  }

  list.addEventListener("click", (ev) => {
    const b = ev.target.closest(".rv");
    if (!b) return;
    const col = cols[ci];
    const e = col.entries.find((x) => x.title === b.dataset.k);
    if (!e) return;
    sfx.pop();
    sheet(detail(e));
    const key = `${col.id}:${e.title}`;
    if (!S.read[key]) {
      S.read[key] = 1;
      save();
      setTimeout(() => b.classList.add("read"), 400);
      gain(`rv:${key}`, 1, "閱讀心得", { kind: "read", cap: 5 });
    }
  });

  seg.onclick = (e) => {
    const b = e.target.closest("button");
    if (!b || +b.dataset.i === ci) return;
    ci = +b.dataset.i;
    tier = "全部";
    $$(".seg button", seg).forEach((x) => x.classList.toggle("on", x === b));
    moveInd();
    history.replaceState(null, "", `#/reviews/${cols[ci].id}`);
    paintChips();
    paintList();
    list.animate([{ opacity: 0, transform: "translateY(10px)" }, { opacity: 1, transform: "none" }], { duration: 300, easing: "ease-out" });
  };
  $(".tiers", view).onclick = (e) => {
    const c = e.target.closest(".chip");
    if (!c) return;
    tier = c.dataset.k;
    $$(".tiers .chip", view).forEach((x) => x.classList.toggle("on", x === c));
    c.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
    paintList();
  };
  $(".search input", view).addEventListener("input", debounce((e) => { query = e.target.value; paintList(); }, 180));
  const sortBtn = $(".sort", view);
  sortBtn.onclick = () => {
    sortByScore = !sortByScore;
    sortBtn.setAttribute("aria-pressed", sortByScore);
    sortBtn.classList.toggle("btn-lemon", sortByScore);
    sortBtn.animate([{ transform: "rotate(0)" }, { transform: "rotate(180deg)" }], { duration: 400, easing: "cubic-bezier(.34,1.56,.64,1)" });
    paintList();
  };
  $(".legend", view).onclick = () => {
    const col = cols[ci];
    sheet(`<h2>${esc(col.title)}</h2>
      ${col.intro.length ? `<div class="rd-lines">${esc(col.intro.join("\n"))}</div>` : ""}
      ${col.glossary.length ? `<div class="rd-sub">GLOSSARY</div><div class="rd-lines">${esc(col.glossary.join("\n"))}</div>` : ""}
      <div class="rd-sub">TIERS</div><div class="rd-marks">${col.tiers.map((t) => `<div class="rd-mark">${esc(t.label)}</div>`).join("")}</div>`);
  };

  paintChips();
  paintList();
  requestAnimationFrame(moveInd);
  addEventListener("resize", moveInd);
  return () => { io?.disconnect(); removeEventListener("resize", moveInd); };
}
