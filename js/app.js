import { $, $$, getJSON } from "./util.js";
import { S, onGain, levelOf, progressOf, PER_LEVEL } from "./store.js";
import { toast, flyPoints, confetti, modal, sfx, buzz } from "./fx.js";

const routes = {
  "": () => import("./pages/home.js"),
  post: () => import("./pages/post.js"),
  awards: () => import("./pages/awards.js"),
  reviews: () => import("./pages/reviews.js"),
  games: () => import("./pages/games.js"),
  quiz: () => import("./pages/quiz.js"),
  crossword: () => import("./pages/crossword.js"),
  survey: () => import("./pages/survey.js"),
  me: () => import("./pages/me.js"),
};
const tabOf = { "": "home", post: "home", awards: "awards", reviews: "reviews", games: "games", quiz: "games", crossword: "games", survey: "games", me: "me" };

export let site = { name: "Mill 次元放送局", levels: [] };
export function levelTitle(lv) {
  const L = site.levels;
  if (!L.length) return `Lv.${lv}`;
  if (lv < L.length) return L[lv];
  return `${L[L.length - 1]} ★${lv - L.length + 1}`;
}

/* ---------- 等級徽章 ---------- */
function paintChip() {
  $("#lvNum").textContent = levelOf(S.points);
  $("#lvPts").textContent = progressOf(S.points);
  $("#lvChip").style.setProperty("--p", (progressOf(S.points) / PER_LEVEL) * 100);
}

onGain(({ pts, reason, before, after }) => {
  flyPoints(pts);
  toast(`${reason} <span class="pts">+${pts}</span>`);
  setTimeout(paintChip, 900);
  document.dispatchEvent(new CustomEvent("points"));
  if (after > before) setTimeout(() => levelUp(after), 1100);
});

function levelUp(lv) {
  sfx.level();
  buzz([20, 40, 30]);
  confetti(90);
  modal(`<div class="lvup-label">LEVEL UP</div>
    <div class="lvup-num">Lv.${lv}</div>
    <h2>${levelTitle(lv)}</h2>
    <p>${S.points} 積分</p>
    <div class="actions"><button class="btn btn-primary" data-close>太棒了！</button></div>`, { burst: true });
}

/* ---------- 路由 ---------- */
const SKELETON = `<div class="skel" style="height:44px;margin:10px 0 16px;width:46%"></div>
  <div class="skel" style="aspect-ratio:16/11"></div>
  <div class="skel" style="height:96px;margin-top:16px"></div>
  <div class="skel" style="height:96px;margin-top:12px"></div>`;

let view = $("#view");
let cleanup = null;
let navByClick = false;
let token = 0;
const scrolls = new Map();

document.addEventListener("click", (e) => {
  const a = e.target.closest("a[href^='#']");
  if (!a) return;
  navByClick = true;
  if (a.getAttribute("href") === location.hash || (a.getAttribute("href") === "#/" && !location.hash.slice(2))) {
    scrollTo({ top: 0, behavior: "smooth" });
  }
});

async function render() {
  const my = ++token;
  scrolls.set(render.prev, scrollY);
  const hash = location.hash.replace(/^#\/?/, "");
  const [name, ...params] = hash.split("/").map(decodeURIComponent);
  const key = routes[name] ? name : "";
  $$(".tabbar a").forEach((a) => a.classList.toggle("active", a.dataset.tab === tabOf[key]));

  cleanup?.();
  cleanup = null;
  $("#modal-root").innerHTML = "";
  $$(".lightbox").forEach((x) => x.remove());
  document.body.style.overflow = "";
  let mod;
  try { mod = await routes[key](); } catch (err) { console.error(err); return; }
  if (my !== token) return;

  const fresh = view.cloneNode(false); // 換新容器，順便丟掉上一頁掛的事件
  fresh.classList.remove("enter");
  view.replaceWith(fresh);
  view = fresh;
  const target = view;
  const sk = setTimeout(() => {
    if (!target.childElementCount) target.innerHTML = SKELETON;
  }, 150);
  try {
    cleanup = (await mod.render(view, params, () => my === token)) || null;
  } catch (err) {
    console.error(err);
    view.innerHTML = `<div class="empty"><span class="big">🥲</span>載入失敗<div style="margin-top:14px"><button class="btn btn-sm" onclick="location.reload()">重新整理</button></div></div>`;
  }
  clearTimeout(sk);
  if (my !== token) return;
  void view.offsetWidth;
  view.classList.add("enter");
  const restore = !navByClick && scrolls.has(hash);
  scrollTo(0, restore ? scrolls.get(hash) : 0);
  navByClick = false;
  render.prev = hash;
}
render.prev = location.hash.replace(/^#\/?/, "");

addEventListener("hashchange", render);
addEventListener("scroll", () => $(".topbar").classList.toggle("scrolled", scrollY > 4), { passive: true });

(async () => {
  try {
    site = { ...site, ...(await getJSON("data/site.json")) };
    $("#brandName").textContent = site.name;
    document.title = site.name;
  } catch { /* 用預設值 */ }
  paintChip();
  render();
})();
