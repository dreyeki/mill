import { $, $$, esc, getJSON, fmtDate } from "../util.js";
import { S, levelOf, canCheckin, checkin } from "../store.js";
import { stars, buzz } from "../fx.js";

export const isLocked = (p) => (p.minLevel || 0) > levelOf(S.points);

export function coverImg(p, cls = "") {
  return p.cover
    ? `<img class="${cls}" src="${esc(p.cover)}" alt="" loading="lazy" decoding="async">`
    : `<div class="cover-art ${cls}" style="background:linear-gradient(135deg,var(--pink-l),var(--sky-l))"></div>`;
}

function heroCard(p, i) {
  const locked = isLocked(p);
  const fresh = !S.seen[p.id];
  return `<a class="hero-card${i === 0 ? " is-active" : ""}" href="#/post/${encodeURIComponent(p.id)}" data-i="${i}">
    ${coverImg(p)}
    <div class="hero-meta">
      <span class="hero-badge${fresh && !locked ? " new" : ""}">${esc(p.category || "頭條")}</span>
      <h2 class="hero-title">${esc(p.title)}</h2>
      ${p.subtitle ? `<p class="hero-sub">${esc(p.subtitle)}</p>` : ""}
    </div>
    ${locked ? `<div class="lock-veil"><span class="lock-ico">🔒</span>Lv.${p.minLevel}</div>` : ""}
    <i class="hero-timer"></i>
  </a>`;
}

function postRow(p) {
  return `<a class="post-row card press" href="#/post/${encodeURIComponent(p.id)}">
    <div class="post-thumb">${coverImg(p)}</div>
    <div style="min-width:0">
      <span class="tag ${p.color || "pink"}">${esc(p.category || "公告")}</span>
      <h3>${isLocked(p) ? "🔒 " : ""}${esc(p.title)}</h3>
      <div class="meta">${!S.seen[p.id] ? '<i class="dot-unread"></i>' : ""}<time>${fmtDate(p.date)}</time>${p.minutes ? `<span>· ${p.minutes} 分鐘</span>` : ""}</div>
    </div>
  </a>`;
}

const PORTALS = [
  { href: "#/awards", ico: "🏆", name: "個人獎項", c: "var(--lemon-l)", count: (s) => `${s.rankings} 位上榜` },
  { href: "#/reviews", ico: "📚", name: "推薦心得", c: "var(--pink-l)", count: (s) => `${s.reviews} 篇` },
  { href: "#/games/quiz", ico: "❓", name: "選擇題", c: "var(--sky-l)", count: (s) => `${s.quizzes} 套` },
  { href: "#/games/crossword", ico: "🔠", name: "填字遊戲", c: "var(--mint-l)", count: (s) => `${s.crosswords} 盤` },
  { href: "#/survey", ico: "📝", name: "調查問卷", c: "var(--violet-l)", count: (s) => `${s.surveys} 份`, dot: (s) => s.surveyOpen },
  { href: "#/me", ico: "⭐", name: "我的等級", c: "var(--orange-l)", count: () => `Lv.${levelOf(S.points)} · ${S.points} 分` },
];

export async function render(view, _params, alive) {
  const [posts, summary, quizzes, crosswords, surveys] = await Promise.all([
    getJSON("data/posts.json"), getJSON("data/summary.json"),
    getJSON("data/quizzes.json"), getJSON("data/crosswords.json"), getJSON("data/surveys.json"),
  ]);
  if (!alive()) return;
  const list = posts.posts;
  const heads = list.filter((p) => p.headline).slice(0, 6);
  const hero = heads.length ? heads : list.slice(0, 5);
  const stats = {
    rankings: summary.rankings, reviews: summary.reviews,
    quizzes: quizzes.length, crosswords: crosswords.length, surveys: surveys.length,
    surveyOpen: surveys.some((s) => !S.survey[s.id]),
  };
  const now = new Date();
  const WEEK = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

  view.innerHTML = `
  <section class="today">
    <div class="today-date"><b>${now.getMonth() + 1}.${String(now.getDate()).padStart(2, "0")}</b><span>${WEEK[now.getDay()]}</span></div>
    <div class="today-streak" aria-label="連續簽到天數"><span class="flame${S.checkin.streak ? " lit" : ""}">🔥</span><b class="streak-n">${S.checkin.streak || 0}</b></div>
    <button class="checkin${canCheckin() ? "" : " done"}">${canCheckin() ? "簽到 +2" : "已簽到 ✓"}</button>
  </section>

  <section class="hero" aria-label="頭條">
    <div class="hero-track">${hero.map(heroCard).join("")}</div>
    ${hero.length > 1 ? `<div class="hero-dots">${hero.map((_, i) => `<button aria-label="第 ${i + 1} 則" class="${i ? "" : "on"}"></button>`).join("")}</div>` : ""}
  </section>

  ${list.length > 1 ? `<div class="ticker"><span class="ticker-label">快訊</span><div class="ticker-viewport"><div class="ticker-run">${[0, 1].map(() => list.slice(0, 6).map((p) => `<a href="#/post/${encodeURIComponent(p.id)}">${esc(p.title)}</a>`).join("")).join("")}</div></div></div>` : ""}

  <div class="sec-head"><h2 class="sec-title">入口</h2></div>
  <section class="portals">
    ${PORTALS.map((p) => `<a class="portal" href="${p.href}" style="--c:${p.c}">
      <span class="portal-ico" aria-hidden="true">${p.ico}</span>
      <div>
        <p class="portal-name">${p.name}</p>
        <span class="portal-count">${p.count(stats)}</span>
      </div>
      <span class="portal-deco" aria-hidden="true">${p.ico}</span>
      ${p.dot?.(stats) ? '<i class="pill-new"></i>' : ""}
    </a>`).join("")}
  </section>

  <div class="sec-head"><h2 class="sec-title">最新</h2></div>
  <section class="post-list">${list.map(postRow).join("")}</section>`;

  /* 簽到 */
  const ck = $(".checkin", view);
  ck.onclick = (e) => {
    if (!canCheckin()) { ck.animate([{ transform: "rotate(0)" }, { transform: "rotate(-8deg)" }, { transform: "rotate(8deg)" }, { transform: "rotate(0)" }], { duration: 360 }); return; }
    checkin();
    buzz(15);
    stars(e.clientX, e.clientY, 10, ["🔥", "✦", "★"]);
    ck.classList.add("done");
    ck.textContent = "已簽到 ✓";
    $(".flame", view).classList.add("lit", "burst");
    $(".streak-n", view).textContent = S.checkin.streak;
  };

  /* 頭條輪播 */
  const track = $(".hero-track", view);
  const cards = $$(".hero-card", view);
  const dots = $$(".hero-dots button", view);
  let cur = 0, timer = null;
  const DUR = 6000;
  const setActive = (i) => {
    cur = i;
    cards.forEach((c, k) => c.classList.toggle("is-active", k === i));
    dots.forEach((d, k) => d.classList.toggle("on", k === i));
    cards.forEach((c) => { const t = $(".hero-timer", c); t.classList.remove("run"); });
    if (timer) { const t = $(".hero-timer", cards[i]); void t.offsetWidth; t.style.setProperty("--dur", DUR + "ms"); t.classList.add("run"); }
  };
  const go = (i) => track.scrollTo({ left: cards[i].offsetLeft - 16, behavior: "smooth" });
  const io = new IntersectionObserver((ents) => {
    ents.forEach((en) => { if (en.isIntersecting && en.intersectionRatio > 0.6) setActive(+en.target.dataset.i); });
  }, { root: track, threshold: [0.6] });
  cards.forEach((c) => io.observe(c));
  dots.forEach((d, i) => (d.onclick = () => go(i)));
  const play = () => {
    if (cards.length < 2) return;
    clearInterval(timer);
    timer = setInterval(() => go((cur + 1) % cards.length), DUR);
    setActive(cur);
  };
  const pause = () => { clearInterval(timer); timer = null; setActive(cur); };
  track.addEventListener("touchstart", pause, { passive: true });
  track.addEventListener("touchend", () => setTimeout(play, 2500), { passive: true });
  play();

  /* 入口點擊果凍 */
  view.addEventListener("pointerdown", (e) => {
    const p = e.target.closest(".portal");
    if (p) { p.classList.remove("tap"); void p.offsetWidth; p.classList.add("tap"); }
  });

  /* 跑馬燈速度依長度 */
  const run = $(".ticker-run", view);
  if (run) run.style.setProperty("--t", Math.max(18, run.scrollWidth / 60) + "s");

  return () => { clearInterval(timer); io.disconnect(); };
}
