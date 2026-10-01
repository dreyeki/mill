import { $, $$, esc, getJSON, icon } from "../util.js";
import { S, save, gain } from "../store.js";
import { sfx, buzz, confetti, stars } from "../fx.js";

export async function render(view, [id]) {
  const all = await getJSON("data/crosswords.json");
  const P = all.find((c) => c.id === id);
  if (!P) { view.innerHTML = `<div class="empty"><span class="big">🔠</span>找不到這盤填字</div>`; return; }

  /* ---------- 建立格子 ---------- */
  const key = (r, c) => `${r},${c}`;
  const sol = {};
  const words = P.words.map((w, wi) => {
    const chars = Array.from(w.answer);
    const cells = chars.map((ch, k) => {
      const r = w.row + (w.dir === "down" ? k : 0), c = w.col + (w.dir === "across" ? k : 0);
      sol[key(r, c)] = ch;
      return key(r, c);
    });
    return { ...w, wi, chars, cells };
  });
  const starts = [...new Set(words.map((w) => key(w.row, w.col)))].sort((a, b) => {
    const [ar, ac] = a.split(",").map(Number), [br, bc] = b.split(",").map(Number);
    return ar - br || ac - bc;
  });
  words.forEach((w) => (w.no = starts.indexOf(key(w.row, w.col)) + 1));
  const ordered = [...words].sort((a, b) => (a.dir === b.dir ? a.no - b.no : a.dir === "across" ? -1 : 1));

  S.cw ||= {};
  const st = (S.cw[P.id] ||= { cells: {}, hints: 0 });
  const already = !!S.claimed[`cw:${P.id}`];
  let cur = ordered[0], focusCell = cur.cells[0];

  const dirName = (w) => (w.dir === "across" ? "橫" : "直");
  const wordOk = (w) => w.cells.every((k) => st.cells[k] === sol[k]);
  const allOk = () => Object.keys(sol).every((k) => st.cells[k] === sol[k]);

  view.innerHTML = `
  <div class="quiz-top">
    <a class="btn btn-icon btn-sm" href="#/games/crossword" aria-label="離開">${icon.close}</a>
    <h1 style="flex:1;margin:0;font-size:18px;font-weight:900">${esc(P.title)}</h1>
    <span class="qcount solved-n"></span>
  </div>
  <div class="cw-wrap"><div class="cw-grid" style="grid-template-columns:repeat(${P.cols},1fr)">
    ${Array.from({ length: P.rows * P.cols }, (_, i) => {
      const r = Math.floor(i / P.cols), c = i % P.cols, k = key(r, c);
      if (!sol[k]) return `<div class="cw-cell void"></div>`;
      const n = starts.indexOf(k);
      return `<div class="cw-cell" data-k="${k}" style="--i:${i}">${n >= 0 ? `<span class="no">${n + 1}</span>` : ""}<span class="ch"></span></div>`;
    }).join("")}
  </div></div>
  <section class="cw-panel card">
    <div class="cw-clue"><span class="tag pink"></span><span class="clue-text"></span></div>
    <form class="cw-input" autocomplete="off">
      <input type="text" enterkeyhint="done" aria-label="答案">
      <button class="btn btn-primary" type="submit">填入</button>
    </form>
    <div class="cw-tools">
      <button class="btn btn-sm prev" type="button" aria-label="上一題">‹</button>
      <button class="btn btn-sm hint" type="button">💡 提示</button>
      <button class="btn btn-sm clear" type="button">清除</button>
      <button class="btn btn-sm next" type="button" aria-label="下一題">›</button>
    </div>
  </section>
  <div class="cw-list">${ordered.map((w) => `<button class="cw-li" data-wi="${w.wi}"><b>${dirName(w)}${w.no}</b><span>${esc(w.clue)}</span></button>`).join("")}</div>`;

  const grid = $(".cw-grid", view), input = $(".cw-input input", view);
  const cellEl = (k) => grid.querySelector(`[data-k="${k}"]`);

  function paint() {
    $$(".cw-cell[data-k]", grid).forEach((el) => {
      const k = el.dataset.k;
      $(".ch", el).textContent = st.cells[k] || "";
      el.classList.toggle("in-word", cur.cells.includes(k));
      el.classList.toggle("focus", k === focusCell);
    });
    $(".cw-clue .tag", view).textContent = `${dirName(cur)} ${cur.no}`;
    $(".clue-text", view).textContent = cur.clue;
    input.maxLength = cur.chars.length;
    input.placeholder = "○".repeat(cur.chars.length);
    const filled = cur.cells.map((k) => st.cells[k] || "");
    input.value = filled.every(Boolean) ? filled.join("") : "";
    $$(".cw-li", view).forEach((li) => {
      const w = words[+li.dataset.wi];
      li.classList.toggle("on", w === cur);
      li.classList.toggle("solved", wordOk(w));
    });
    $(".solved-n", view).textContent = `${words.filter(wordOk).length}/${words.length}`;
  }

  function select(w, cell) {
    cur = w;
    focusCell = cell || w.cells.find((k) => !st.cells[k]) || w.cells[0];
    paint();
  }

  grid.addEventListener("click", (e) => {
    const el = e.target.closest(".cw-cell[data-k]");
    if (!el) return;
    const k = el.dataset.k;
    const owners = words.filter((w) => w.cells.includes(k));
    let w;
    if (owners.includes(cur) && k === focusCell && owners.length > 1) w = owners.find((x) => x !== cur);
    else w = owners.includes(cur) ? cur : owners[0];
    sfx.pop();
    select(w, k);
    input.focus({ preventScroll: true });
  });

  function fill(chars) {
    chars.forEach((ch, i) => {
      const k = cur.cells[i];
      if (!k || !ch) return;
      if (st.cells[k] !== ch) {
        st.cells[k] = ch;
        const el = cellEl(k);
        setTimeout(() => { el.classList.remove("fill"); void el.offsetWidth; el.classList.add("fill"); }, i * 60);
      }
    });
    save();
    paint();
    const full = cur.cells.every((k) => st.cells[k]);
    if (!full) return;
    if (wordOk(cur)) {
      sfx.good(); buzz(10);
      cur.cells.forEach((k, i) => setTimeout(() => {
        const el = cellEl(k);
        el.classList.add("ok");
        if (i === cur.cells.length - 1) {
          const r = el.getBoundingClientRect();
          stars(r.left + r.width / 2, r.top + r.height / 2, 6);
        }
      }, i * 60));
      setTimeout(() => cur.cells.forEach((k) => cellEl(k).classList.remove("ok")), 1200);
      if (allOk()) return setTimeout(solved, 500);
      const nextW = ordered.slice(ordered.indexOf(cur) + 1).concat(ordered).find((w) => !wordOk(w));
      if (nextW) setTimeout(() => select(nextW), 650);
    } else {
      sfx.bad(); buzz([20, 30, 20]);
      cur.cells.forEach((k) => {
        if (st.cells[k] === sol[k]) return;
        const el = cellEl(k);
        el.classList.remove("bad"); void el.offsetWidth; el.classList.add("bad");
        setTimeout(() => el.classList.remove("bad"), 900);
      });
    }
  }

  $(".cw-input", view).addEventListener("submit", (e) => {
    e.preventDefault();
    const chars = Array.from(input.value.replace(/\s/g, "")).slice(0, cur.chars.length);
    if (chars.length) fill(chars);
  });

  $(".hint", view).onclick = () => {
    const k = cur.cells.find((x) => st.cells[x] !== sol[x]);
    if (!k) return;
    st.hints++;
    cellEl(k).classList.add("hinted");
    focusCell = k;
    fill(cur.cells.map((x) => (x === k ? sol[x] : st.cells[x] || "")));
  };
  $(".clear", view).onclick = () => {
    cur.cells.forEach((k) => {
      const shared = words.some((w) => w !== cur && w.cells.includes(k) && wordOk(w));
      if (!shared) delete st.cells[k];
    });
    save(); paint();
  };
  const step = (d) => select(ordered[(ordered.indexOf(cur) + d + ordered.length) % ordered.length]);
  $(".prev", view).onclick = () => step(-1);
  $(".next", view).onclick = () => step(1);
  $(".cw-list", view).onclick = (e) => {
    const li = e.target.closest(".cw-li");
    if (!li) return;
    select(words[+li.dataset.wi]);
    $(".cw-panel", view).scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  function solved(quiet = false) {
    grid.classList.add("solved");
    if (!quiet) { sfx.level(); buzz([20, 40, 20]); confetti(90); }
    const pts = Math.max(2, 6 - st.hints);
    if (!already) gain(`cw:${P.id}`, pts, `完成「${P.title}」`);
    const panel = $(".cw-panel", view);
    panel.innerHTML = `<div style="text-align:center;padding:6px 0"><div style="font-size:34px">🎉</div><div style="font-weight:900;font-size:18px">CLEAR!</div>
      <div style="display:flex;gap:10px;justify-content:center;margin-top:12px">
      <button class="btn btn-sm again">重玩</button><a class="btn btn-sm btn-primary" href="#/games/crossword">其他填字</a></div></div>`;
    if (!quiet) panel.animate([{ transform: "scale(.9)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 400, easing: "cubic-bezier(.34,1.56,.64,1)" });
    $(".again", panel).onclick = () => { S.cw[P.id] = { cells: {}, hints: 0 }; save(); render(view, [id]); };
  }

  // 恢復已完成的格子顏色
  Object.keys(st.cells).forEach((k) => { if (!sol[k]) delete st.cells[k]; });
  paint();
  if (allOk()) solved(true);
}
