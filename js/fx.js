// 微互動：漣漪、飛行積分、彩帶、吐司、抽屜、彈窗、燈箱、音效
import { $, el, esc, reduceMotion } from "./util.js";
import { S } from "./store.js";

/* ---------- 指標位置（積分從點擊處飛出） ---------- */
export const lastTap = { x: innerWidth / 2, y: innerHeight / 2 };
addEventListener("pointerdown", (e) => { lastTap.x = e.clientX; lastTap.y = e.clientY; }, { passive: true, capture: true });

/* ---------- 漣漪 ---------- */
addEventListener("pointerdown", (e) => {
  const b = e.target.closest(".btn, .qopt, .portal");
  if (!b || reduceMotion()) return;
  const r = b.getBoundingClientRect();
  const s = Math.max(r.width, r.height);
  const dot = document.createElement("span");
  dot.className = "ripple";
  dot.style.cssText = `width:${s}px;height:${s}px;left:${e.clientX - r.left - s / 2}px;top:${e.clientY - r.top - s / 2}px`;
  b.appendChild(dot);
  setTimeout(() => dot.remove(), 650);
}, { passive: true });

/* ---------- 音效（預設關閉） ---------- */
let ctx;
function tone(freqs, { dur = 0.09, type = "sine", gap = 0.07, vol = 0.07 } = {}) {
  if (!S.settings.sound) return;
  try {
    ctx ||= new (window.AudioContext || window.webkitAudioContext)();
    const t0 = ctx.currentTime;
    freqs.forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f, t0 + i * gap);
      g.gain.setValueAtTime(0.0001, t0 + i * gap);
      g.gain.exponentialRampToValueAtTime(vol, t0 + i * gap + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * gap + dur);
      o.connect(g).connect(ctx.destination);
      o.start(t0 + i * gap);
      o.stop(t0 + i * gap + dur + 0.02);
    });
  } catch { /* 靜音也沒關係 */ }
}
export const sfx = {
  pop: () => tone([660, 990], { dur: 0.07, gap: 0.04 }),
  coin: () => tone([988, 1319], { dur: 0.12, type: "square", vol: 0.035 }),
  good: () => tone([523, 659, 784], { dur: 0.12, type: "triangle" }),
  bad: () => tone([220, 175], { dur: 0.16, type: "sawtooth", vol: 0.03, gap: 0.1 }),
  level: () => tone([523, 659, 784, 1047, 1319], { dur: 0.16, type: "triangle", gap: 0.09 }),
  flip: () => tone([440, 880], { dur: 0.06, gap: 0.03, vol: 0.04 }),
};

export const buzz = (p = 12) => { try { navigator.vibrate?.(p); } catch { /* 不支援 */ } };

/* ---------- 吐司 ---------- */
export function toast(html, ms = 2200) {
  const layer = $("#toast-layer");
  const t = el(`<div class="toast">${html}</div>`);
  layer.appendChild(t);
  while (layer.children.length > 3) layer.firstElementChild.remove();
  setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 320); }, ms);
}

/* ---------- 飛行積分 ---------- */
export function flyPoints(pts, from = lastTap) {
  const target = $("#lvChip");
  if (!target) return;
  const tr = target.getBoundingClientRect();
  const tx = tr.left + 18, ty = tr.top + 18;
  const chip = el(`<div class="fx-pts">+${pts}</div>`);
  document.body.appendChild(chip);
  const sx = from.x - 24, sy = from.y - 20;
  if (reduceMotion()) { chip.remove(); bumpChip(); return; }
  const anim = chip.animate([
    { transform: `translate(${sx}px, ${sy}px) scale(.4)`, opacity: 0 },
    { transform: `translate(${sx}px, ${sy - 46}px) scale(1.15)`, opacity: 1, offset: 0.28 },
    { transform: `translate(${sx}px, ${sy - 40}px) scale(1)`, opacity: 1, offset: 0.42 },
    { transform: `translate(${tx - 20}px, ${ty - 14}px) scale(.35)`, opacity: 0.6 },
  ], { duration: 1000, easing: "cubic-bezier(.5,0,.3,1)" });
  anim.onfinish = () => { chip.remove(); bumpChip(); sfx.coin(); };
  stars(from.x, from.y, 6);
}

function bumpChip() {
  const c = $("#lvChip");
  c.classList.remove("bump");
  void c.offsetWidth;
  c.classList.add("bump");
}

export function stars(x, y, n = 8, glyphs = ["✦", "✧", "★", "♪"]) {
  if (reduceMotion()) return;
  const colors = ["var(--pink)", "var(--lemon)", "var(--sky)", "var(--violet)", "var(--mint)"];
  for (let i = 0; i < n; i++) {
    const s = el(`<span class="fx-star">${glyphs[i % glyphs.length]}</span>`);
    s.style.color = colors[i % colors.length];
    $("#fx-layer").appendChild(s);
    const a = (Math.PI * 2 * i) / n + Math.random() * 0.6;
    const d = 40 + Math.random() * 50;
    s.animate([
      { transform: `translate(${x}px, ${y}px) scale(.3) rotate(0)`, opacity: 1 },
      { transform: `translate(${x + Math.cos(a) * d}px, ${y + Math.sin(a) * d}px) scale(1.1) rotate(180deg)`, opacity: 0 },
    ], { duration: 700 + Math.random() * 300, easing: "cubic-bezier(.2,.8,.3,1)" }).onfinish = () => s.remove();
  }
}

/* ---------- 彩帶 ---------- */
export function confetti(n = 70) {
  if (reduceMotion()) return;
  const colors = ["#ff7eb6", "#ffd23f", "#5fbfff", "#a184ff", "#3fd1a8", "#ff9b54"];
  const layer = $("#fx-layer");
  for (let i = 0; i < n; i++) {
    const c = document.createElement("i");
    c.className = "confetti";
    c.style.left = Math.random() * 100 + "vw";
    c.style.background = colors[i % colors.length];
    if (i % 3 === 0) c.style.borderRadius = "50%";
    layer.appendChild(c);
    const drift = (Math.random() - 0.5) * 220;
    const rot = Math.random() * 900 - 450;
    c.animate([
      { transform: `translate(0, 0) rotate(0)` },
      { transform: `translate(${drift}px, ${innerHeight + 40}px) rotate(${rot}deg)` },
    ], { duration: 1800 + Math.random() * 1600, delay: Math.random() * 300, easing: "cubic-bezier(.25,.6,.4,1)" }).onfinish = () => c.remove();
  }
}

/* ---------- 抽屜（可下滑關閉） ---------- */
export function sheet(innerHTML, { onClose } = {}) {
  const wrap = el(`<div class="sheet-wrap" role="dialog" aria-modal="true">
    <div class="sheet-backdrop"></div>
    <div class="sheet"><div class="sheet-grip"></div><div class="sheet-body">${innerHTML}</div></div>
  </div>`);
  $("#modal-root").appendChild(wrap);
  document.body.style.overflow = "hidden";
  const sh = $(".sheet", wrap), body = $(".sheet-body", wrap);
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    sh.style.transform = "";
    sh.classList.add("closing");
    wrap.classList.add("closing");
    document.body.style.overflow = "";
    removeEventListener("keydown", onKey);
    setTimeout(() => { wrap.remove(); onClose?.(); }, 300);
  };
  const onKey = (e) => e.key === "Escape" && close();
  addEventListener("keydown", onKey);
  $(".sheet-backdrop", wrap).onclick = close;

  // 下滑關閉
  let y0 = null, dy = 0;
  const start = (e) => {
    if (body.scrollTop > 0 && !e.target.closest(".sheet-grip")) return;
    y0 = e.touches[0].clientY; dy = 0;
    sh.style.transition = "none";
  };
  const move = (e) => {
    if (y0 == null) return;
    dy = Math.max(0, e.touches[0].clientY - y0);
    if (dy > 0) { sh.style.transform = `translateY(${dy}px)`; if (e.cancelable) e.preventDefault(); }
  };
  const end = () => {
    if (y0 == null) return;
    sh.style.transition = "transform .35s var(--spring)";
    if (dy > 110) close(); else sh.style.transform = "";
    y0 = null;
  };
  sh.addEventListener("touchstart", start, { passive: true });
  sh.addEventListener("touchmove", move, { passive: false });
  sh.addEventListener("touchend", end);
  $(".sheet-grip", wrap).onclick = close;
  return { el: body, close };
}

/* ---------- 彈窗 ---------- */
export function modal(innerHTML, { burst = false } = {}) {
  const wrap = el(`<div class="modal-wrap" role="dialog" aria-modal="true">
    <div class="modal-backdrop"></div>
    <div class="modal card">${burst ? '<div class="lvup-burst"></div>' : ""}${innerHTML}</div>
  </div>`);
  $("#modal-root").appendChild(wrap);
  const close = () => {
    wrap.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200 }).onfinish = () => wrap.remove();
  };
  $(".modal-backdrop", wrap).onclick = close;
  wrap.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) close(); });
  return { el: $(".modal", wrap), close };
}

export function confirmBox(title, okText = "確定") {
  return new Promise((res) => {
    const m = modal(`<h2>${esc(title)}</h2><div class="actions" style="margin-top:16px">
      <button class="btn" data-close data-v="0">取消</button>
      <button class="btn btn-primary" data-close data-v="1">${esc(okText)}</button></div>`);
    m.el.addEventListener("click", (e) => {
      const b = e.target.closest("[data-v]");
      if (b) res(b.dataset.v === "1");
    });
  });
}

/* ---------- 燈箱 ---------- */
export function lightbox(src, cap = "") {
  const lb = el(`<div class="lightbox"><img src="${esc(src)}" alt="${esc(cap)}">${cap ? `<div class="cap">${esc(cap)}</div>` : ""}</div>`);
  document.body.appendChild(lb);
  const img = $("img", lb);
  let zoom = false;
  img.onclick = (e) => {
    e.stopPropagation();
    zoom = !zoom;
    img.style.transform = zoom ? "scale(1.8)" : "";
  };
  lb.onclick = () => lb.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180 }).onfinish = () => lb.remove();
}
