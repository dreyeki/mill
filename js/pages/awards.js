import { $, $$, esc, getJSON, debounce, icon } from "../util.js";
import { S, gain } from "../store.js";
import { sfx, stars, confetti, buzz, countUp } from "../fx.js";

const GROUPS = [
  { key: "動畫", ico: "🎬", c: "var(--pink-l)", match: ["動畫", "動畫電影", "短動畫", "單篇動畫"] },
  { key: "遊戲", ico: "🎮", c: "var(--sky-l)", match: ["遊戲", "TRPG"] },
  { key: "小說", ico: "📖", c: "var(--violet-l)", match: ["小說"] },
  { key: "漫畫", ico: "🖋️", c: "var(--mint-l)", match: ["漫畫"] },
  { key: "VTuber", ico: "🎙️", c: "var(--orange-l)", match: ["VTuber", "Vsinger", "虛擬歌姬", "虛擬音聲名"] },
  { key: "影劇", ico: "🎞️", c: "var(--lemon-l)", match: ["影劇", "電影"] },
];
const CAT_COLOR = { 動畫: "pink", 遊戲: "sky", 小說: "", 漫畫: "mint", VTuber: "orange", 影劇: "lemon" };
const groupOf = (cat) => GROUPS.find((g) => g.match.includes(cat))?.key || cat;
const normWork = (w) => w.toLowerCase().replace(/^bangdream/, "").replace(/\s/g, "");

function deriveAwards(year, prevYear) {
  const E = year.entries;
  const out = [];
  if (E[0]) out.push({ ico: "👑", cat: "年度第一", c: "linear-gradient(135deg,var(--gold-1),var(--gold-2))", e: E[0] });
  const used = new Set([E[0]?.name]);
  for (const g of GROUPS) {
    const e = E.find((x) => !used.has(x.name) && x.cats.some((c) => g.match.includes(c)));
    if (e) { used.add(e.name); out.push({ ico: g.ico, cat: `最佳${g.key}${g.key === "VTuber" ? "" : "角色"}`, c: g.c, e }); }
  }
  const tally = new Map();
  E.forEach((e) => e.works.slice(0, 1).forEach((w) => {
    const k = normWork(w);
    const t = tally.get(k) || { w, n: 0, best: e.rank, names: [] };
    t.n++; t.names.push(e.name); t.best = Math.min(t.best, e.rank);
    tally.set(k, t);
  }));
  const top = [...tally.values()].sort((a, b) => b.n - a.n || a.best - b.best)[0];
  if (top && top.n > 1) out.push({ ico: "📚", cat: "最多上榜作品", c: "var(--violet-l)", work: top.w, n: top.n, e: E.find((x) => x.rank === top.best) });
  if (prevYear) {
    const prevNames = new Map(prevYear.entries.map((e) => [e.name, e.rank]));
    const ever = E.find((e) => prevNames.has(e.name));
    if (ever) out.push({ ico: "🔁", cat: "人氣常青", c: "var(--mint-l)", e: ever, prev: prevNames.get(ever.name) });
  }
  return out;
}

const rowHTML = (e) => `<div class="rank-row card${e.rank <= 10 ? " top10" : ""}" id="r-${e.rank}-${esc(e.name)}" data-rank="${e.rank}">
  <div class="rank-no"><small>TOP</small>${e.rank}</div>
  <div style="min-width:0">
    <div class="rank-name">${esc(e.name)}</div>
    <div class="rank-sub">
      ${e.works.map((w) => `<span class="rank-work">#${esc(w)}</span>`).join("")}
      ${[...new Set(e.cats.map(groupOf))].map((c) => `<span class="tag ${CAT_COLOR[c] ?? ""}">${esc(c)}</span>`).join("")}
      ${e.notes.map((n) => `<span class="tag lemon">${esc(n)}</span>`).join("")}
    </div>
  </div>
</div>`;

export async function render(view, [yearParam]) {
  const [data, custom] = await Promise.all([getJSON("data/rankings.json"), getJSON("data/awards.json").catch(() => [])]);
  const years = data.years;
  let yi = Math.max(0, years.findIndex((y) => String(y.year) === yearParam));
  let filter = "全部", query = "";

  view.innerHTML = `
  <h1 class="page-title"><span class="accent">次元排名</span></h1>
  <div class="seg" role="tablist">${years.map((y, i) => `<button role="tab" data-i="${i}" class="${i === yi ? "on" : ""}">${y.year}</button>`).join("")}<i class="seg-ind"></i></div>
  <div class="year-body"></div>`;

  const seg = $(".seg", view), ind = $(".seg-ind", view), body = $(".year-body", view);
  const moveInd = () => {
    const b = $$(".seg button", seg)[yi];
    ind.style.setProperty("--x", b.offsetLeft + "px");
    ind.style.setProperty("--w", b.offsetWidth + "px");
  };

  function paint() {
    const Y = years[yi];
    const awards = deriveAwards(Y, years[yi + 1]);
    const customYear = custom.filter((c) => String(c.year) === String(Y.year));
    const podium = [Y.entries[1], Y.entries[0], Y.entries[2]].filter(Boolean);
    const counts = {};
    Y.entries.forEach((e) => new Set(e.cats.map(groupOf)).forEach((c) => (counts[c] = (counts[c] || 0) + 1)));
    const chips = ["全部", ...GROUPS.map((g) => g.key).filter((k) => counts[k])];

    body.innerHTML = `
    <section class="year-hero">
      <div class="year-big">${Y.year}</div>
      <div class="year-label">TOP <span data-count="${Y.entries.length}">0</span></div>
      <div class="podium">${podium.map((e) => {
        const id = `reveal:${Y.year}:${e.rank}`;
        const open = !!S.claimed[id];
        return `<div class="pod"><div class="pod-card${open ? " flip" : ""}" data-id="${id}" data-rank="${e.rank}" role="button" tabindex="0" aria-label="揭曉第 ${e.rank} 名">
          <div class="pod-face pod-front">?<small>TAP</small></div>
          <div class="pod-face pod-back">${e.rank === 1 ? '<div class="crown">👑</div>' : ""}<div class="nm">${esc(e.name)}</div><div class="wk">${esc(e.works[0] || "")}</div></div>
        </div><div class="pod-base">${e.rank}</div></div>`;
      }).join("")}</div>
    </section>

    <div class="sec-head"><h2 class="sec-title">年度獎項</h2></div>
    <div class="award-strip">${awards.map((a) => `<button class="award card press" style="--c:${a.c}" data-rank="${a.e.rank}" data-name="${esc(a.e.name)}">
      <span class="award-ico">${a.ico}</span>
      <span class="award-cat">${a.cat}</span>
      <span class="award-win">${esc(a.work ? a.work : a.e.name)}</span>
      <span class="award-work">${a.work ? `${a.n} 位角色上榜` : a.prev ? `Top${a.prev} → Top${a.e.rank}` : `Top${a.e.rank} · ${esc(a.e.works[0] || "")}`}</span>
    </button>`).join("")}</div>

    ${customYear.map((c) => `<div class="sec-head"><h2 class="sec-title">${esc(c.title)}</h2></div>
    <div class="award-strip">${(c.items || []).map((a) => `<div class="award card" style="--c:var(--pink-l)">
      <span class="award-ico">${esc(a.icon || "🏅")}</span><span class="award-cat">${esc(a.award)}</span>
      <span class="award-win">${esc(a.winner)}</span><span class="award-work">${esc(a.work || a.note || "")}</span></div>`).join("")}</div>`).join("")}

    <div class="sec-head"><h2 class="sec-title">完整榜單</h2></div>
    <label class="search">${icon.search}<input type="search" placeholder="搜尋角色或作品" value="${esc(query)}" aria-label="搜尋"></label>
    <div class="chips" style="margin-top:10px">${chips.map((c) => `<button class="chip${c === filter ? " on" : ""}" data-c="${esc(c)}">${esc(c)}${c !== "全部" ? `<span class="n">${counts[c]}</span>` : ""}</button>`).join("")}</div>
    <div class="rank-list"></div>`;

    countUp(body);
    const list = $(".rank-list", body);
    const paintList = () => {
      const q = query.trim().toLowerCase();
      const rows = Y.entries.filter((e) =>
        (filter === "全部" || e.cats.some((c) => groupOf(c) === filter)) &&
        (!q || (e.name + e.works.join(" ")).toLowerCase().includes(q)));
      list.innerHTML = rows.length ? rows.map(rowHTML).join("") : `<div class="empty"><span class="big">🔍</span>沒有符合的角色</div>`;
    };
    paintList();

    $(".search input", body).addEventListener("input", debounce((e) => { query = e.target.value; paintList(); }, 150));
    $(".chips", body).onclick = (e) => {
      const c = e.target.closest(".chip");
      if (!c) return;
      filter = c.dataset.c;
      $$(".chip", body).forEach((x) => x.classList.toggle("on", x === c));
      c.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
      paintList();
    };

    $(".podium", body).addEventListener("click", (e) => {
      const card = e.target.closest(".pod-card:not(.flip)");
      if (!card) return;
      card.classList.add("flip");
      sfx.flip(); buzz(10);
      const r = card.getBoundingClientRect();
      setTimeout(() => {
        stars(r.left + r.width / 2, r.top + r.height / 2, 10);
        if (card.dataset.rank === "1") confetti(50);
      }, 350);
      gain(card.dataset.id, 1, `揭曉 Top${card.dataset.rank}`);
    });
    $(".podium", body).addEventListener("keydown", (e) => { if (e.key === "Enter") e.target.click(); });

    $$(".award[data-rank]", body).forEach((a) => (a.onclick = () => {
      if (filter !== "全部" || query) {
        filter = "全部"; query = "";
        $(".search input", body).value = "";
        $$(".chip", body).forEach((x) => x.classList.toggle("on", x.dataset.c === "全部"));
        paintList();
      }
      const row = list.querySelector(`[data-rank="${a.dataset.rank}"]`);
      if (!row) return;
      row.scrollIntoView({ behavior: "smooth", block: "center" });
      row.classList.remove("hit"); void row.offsetWidth; row.classList.add("hit");
    }));

    gain(`year:${Y.year}`, 1, `瀏覽 ${Y.year} 次元排名`);
  }

  seg.onclick = (e) => {
    const b = e.target.closest("button");
    if (!b || +b.dataset.i === yi) return;
    yi = +b.dataset.i;
    $$(".seg button", seg).forEach((x) => x.classList.toggle("on", x === b));
    moveInd();
    history.replaceState(null, "", `#/awards/${years[yi].year}`);
    filter = "全部"; query = "";
    body.animate([{ opacity: 0, transform: "translateX(12px)" }, { opacity: 1, transform: "none" }], { duration: 320, easing: "ease-out" });
    paint();
  };

  paint();
  requestAnimationFrame(moveInd);
  const onResize = () => moveInd();
  addEventListener("resize", onResize);
  return () => removeEventListener("resize", onResize);
}
