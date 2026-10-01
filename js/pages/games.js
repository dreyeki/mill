import { $, $$, esc, getJSON } from "../util.js";
import { S } from "../store.js";

export const starsOf = (best, total) => (!best ? 0 : best >= total ? 3 : best >= total * 0.6 ? 2 : 1);
const starHTML = (n) => `<span class="stars" aria-label="${n} 星">${[0, 1, 2].map((i) => `<span class="${i < n ? "on" : ""}">★</span>`).join("")}</span>`;

export async function render(view, [tab]) {
  const [quizzes, crosswords] = await Promise.all([getJSON("data/quizzes.json"), getJSON("data/crosswords.json")]);
  let ti = tab === "crossword" ? 1 : 0;

  view.innerHTML = `
  <h1 class="page-title"><span class="accent">小遊戲</span></h1>
  <div class="seg" role="tablist"><button role="tab" class="${ti ? "" : "on"}">選擇題</button><button role="tab" class="${ti ? "on" : ""}">填字遊戲</button><i class="seg-ind"></i></div>
  <div class="game-grid" style="margin-top:16px"></div>`;

  const seg = $(".seg", view), ind = $(".seg-ind", view), grid = $(".game-grid", view);
  const moveInd = () => {
    const b = $$(".seg button", seg)[ti];
    ind.style.setProperty("--x", b.offsetLeft + "px");
    ind.style.setProperty("--w", b.offsetWidth + "px");
  };
  const paint = () => {
    grid.innerHTML = ti === 0
      ? quizzes.map((q) => {
        const best = S.best[`quiz:${q.id}`] || 0;
        return `<a class="game-card card press" href="#/quiz/${q.id}">
          <span class="game-ico" style="--c:${q.color || "var(--sky-l)"}">${esc(q.icon || "❓")}</span>
          <div><h3>${esc(q.title)}</h3><div class="meta"><span class="tag sky">${q.questions.length} 題</span>${best ? `<span class="tag mint">最佳 ${best}/${q.questions.length}</span>` : ""}</div></div>
          ${starHTML(starsOf(best, q.questions.length))}
        </a>`;
      }).join("")
      : crosswords.map((c) => {
        const done = S.claimed[`cw:${c.id}`];
        return `<a class="game-card card press" href="#/crossword/${c.id}">
          <span class="game-ico" style="--c:${c.color || "var(--mint-l)"}">${esc(c.icon || "🔠")}</span>
          <div><h3>${esc(c.title)}</h3><div class="meta"><span class="tag mint">${c.words.length} 詞</span><span class="tag">${c.rows}×${c.cols}</span></div></div>
          ${done ? '<span class="done-stamp">CLEAR</span>' : '<span class="stars">›</span>'}
        </a>`;
      }).join("");
    $$(".game-card", grid).forEach((c, i) => c.animate([{ opacity: 0, transform: "translateY(14px)" }, { opacity: 1, transform: "none" }], { duration: 380, delay: i * 50, easing: "cubic-bezier(.22,.8,.25,1)", fill: "backwards" }));
  };
  seg.onclick = (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    const i = $$(".seg button", seg).indexOf(b);
    if (i === ti) return;
    ti = i;
    $$(".seg button", seg).forEach((x) => x.classList.toggle("on", x === b));
    moveInd();
    history.replaceState(null, "", `#/games/${ti ? "crossword" : "quiz"}`);
    paint();
  };
  paint();
  requestAnimationFrame(moveInd);
  addEventListener("resize", moveInd);
  return () => removeEventListener("resize", moveInd);
}
