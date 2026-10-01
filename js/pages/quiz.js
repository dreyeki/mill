import { $, $$, esc, getJSON, shuffle, icon } from "../util.js";
import { S, improve } from "../store.js";
import { sfx, buzz, stars, confetti, lastTap } from "../fx.js";
import { starsOf } from "./games.js";

export async function render(view, [id]) {
  const all = await getJSON("data/quizzes.json");
  const quiz = all.find((q) => q.id === id);
  if (!quiz) { view.innerHTML = `<div class="empty"><span class="big">❔</span>找不到題目</div>`; return; }
  const total = quiz.questions.length;
  let order, qi, right, combo, timers = [];

  const later = (fn, ms) => timers.push(setTimeout(fn, ms));

  function start() {
    order = quiz.shuffle === false ? quiz.questions : shuffle(quiz.questions);
    qi = 0; right = 0; combo = 0;
    question();
  }

  function header() {
    return `<div class="quiz-top">
      <a class="btn btn-icon btn-sm" href="#/games/quiz" aria-label="離開">${icon.close}</a>
      <div class="qbar"><i style="--p:${(qi / total) * 100}%"></i></div>
      <span class="qcount">${qi + 1}/${total}</span>
    </div>`;
  }

  function question() {
    const q = order[qi];
    const opts = shuffle(q.options.map((t, k) => ({ t, ok: k === q.answer })));
    view.innerHTML = `${header()}
      <div style="position:relative">${combo >= 2 ? `<span class="combo">${combo} COMBO!</span>` : ""}</div>
      <section class="qcard card"><span class="qn">Q${qi + 1}</span><h2>${esc(q.q)}</h2></section>
      <div class="qopts">${opts.map((o, k) => `<button class="qopt" data-ok="${o.ok ? 1 : 0}"><span class="k">${"ABCD"[k]}</span><span>${esc(o.t)}</span></button>`).join("")}</div>
      <div class="after"></div>`;
    requestAnimationFrame(() => $(".qbar i", view)?.style.setProperty("--p", `${((qi + 1) / total) * 100}%`));

    $(".qopts", view).onclick = (e) => {
      const b = e.target.closest(".qopt");
      if (!b || $(".qopts", view).classList.contains("locked")) return;
      $(".qopts", view).classList.add("locked");
      const ok = b.dataset.ok === "1";
      $$(".qopt", view).forEach((x) => {
        if (x.dataset.ok === "1") x.classList.add("right");
        else if (x === b) x.classList.add("wrong");
        else x.classList.add("dim");
      });
      if (ok) {
        right++; combo++;
        sfx.good(); buzz(12);
        stars(lastTap.x, lastTap.y, 8);
      } else {
        combo = 0;
        sfx.bad(); buzz([30, 40, 30]);
      }
      $(".after", view).innerHTML = `${q.explain ? `<div class="explain">${ok ? "⭕ " : "❌ "}${esc(q.explain)}</div>` : ""}
        <button class="btn btn-primary btn-block next" style="margin-top:16px">${qi + 1 < total ? "下一題" : "看結果"}</button>`;
      const nx = $(".next", view);
      nx.animate([{ opacity: 0, transform: "translateY(10px)" }, { opacity: 1, transform: "none" }], { duration: 300, easing: "ease-out" });
      nx.onclick = () => { qi++; qi < total ? question() : result(); };
      if (!q.explain) later(() => nx.isConnected && nx.click(), 1100);
    };
  }

  function result() {
    const prev = S.best[`quiz:${quiz.id}`] || 0;
    const pct = right / total;
    const grade = pct === 1 ? "S" : pct >= 0.8 ? "A" : pct >= 0.6 ? "B" : pct >= 0.4 ? "C" : "D";
    view.innerHTML = `
      <section class="result card">
        <div class="grade">${grade}</div>
        <div class="score">${right} / ${total}</div>
        <div style="margin-top:6px">${[0, 1, 2].map((i) => `<span class="stars" style="font-size:30px"><span class="${i < starsOf(right, total) ? "on" : ""}">★</span></span>`).join("")}</div>
        <div class="gain-slot"></div>
        <div class="actions">
          <button class="btn retry">再玩一次</button>
          <a class="btn btn-primary" href="#/games/quiz">其他題組</a>
        </div>
      </section>`;
    $(".retry", view).onclick = start;
    later(() => {
      const r = $(".grade", view).getBoundingClientRect();
      if (pct >= 0.8) confetti(pct === 1 ? 100 : 50);
      stars(r.left + r.width / 2, r.top + r.height / 2, 12);
      const got = improve(`quiz:${quiz.id}`, right, `${quiz.title} 新紀錄`);
      const slot = $(".gain-slot", view);
      if (slot) slot.innerHTML = got ? `<span class="gain">+${got} 積分</span>` : prev ? `<span class="gain" style="background:#f1eef8">最佳 ${Math.max(prev, right)} / ${total}</span>` : "";
    }, 450);
  }

  start();
  return () => timers.forEach(clearTimeout);
}
