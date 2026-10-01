import { $, $$, esc, getJSON, fmtDate, icon } from "../util.js";
import { S, save, gain } from "../store.js";
import { sfx, buzz, confetti, stars, toast } from "../fx.js";

function listView(view, surveys) {
  view.innerHTML = `
  <h1 class="page-title"><span class="accent">調查問卷</span></h1>
  <div class="game-grid">${surveys.map((s) => {
    const done = S.survey[s.id];
    return `<a class="game-card card press" href="#/survey/${s.id}">
      <span class="game-ico" style="--c:${s.color || "var(--violet-l)"}">${esc(s.icon || "📝")}</span>
      <div><h3>${esc(s.title)}</h3><div class="meta"><span class="tag">${s.questions.length} 題</span>${s.deadline ? `<span class="tag orange">至 ${esc(s.deadline)}</span>` : ""}</div></div>
      ${done ? '<span class="done-stamp">DONE</span>' : '<span class="tag pink">+5</span>'}
    </a>`;
  }).join("")}</div>`;
}

function qHTML(q, i, val) {
  const req = q.required ? '<span class="req">*</span>' : "";
  let inner = "";
  if (q.type === "single" || q.type === "multi") {
    const t = q.type === "single" ? "radio" : "checkbox";
    const vals = [].concat(val ?? []);
    inner = `<div class="sv-opts">${q.options.map((o) => `<label class="sv-opt"><input type="${t}" name="${esc(q.id)}" value="${esc(o)}"${vals.includes(o) ? " checked" : ""}><span>${esc(o)}</span></label>`).join("")}</div>`;
  } else if (q.type === "rating") {
    const n = q.max || 5;
    inner = `<div class="sv-rate" data-q="${esc(q.id)}">${Array.from({ length: n }, (_, k) => `<button type="button" data-v="${k + 1}" class="${val >= k + 1 ? "on" : ""}" aria-label="${k + 1} 分">${esc(q.icon || "⭐")}</button>`).join("")}</div>`;
  } else if (q.type === "scale") {
    const n = q.max || 5;
    inner = `<div class="sv-scale" style="--n:${n}" data-q="${esc(q.id)}">${Array.from({ length: n }, (_, k) => `<button type="button" data-v="${k + 1}" class="${val == k + 1 ? "on" : ""}">${k + 1}</button>`).join("")}</div>
      ${q.labels ? `<div class="sv-scale-lbl"><span>${esc(q.labels[0])}</span><span>${esc(q.labels[1])}</span></div>` : ""}`;
  } else {
    inner = `<textarea name="${esc(q.id)}" placeholder="${esc(q.placeholder || "")}" maxlength="${q.maxlength || 500}">${esc(val || "")}</textarea>`;
  }
  return `<section class="sv-q card${val != null && val !== "" && !(Array.isArray(val) && !val.length) ? " answered" : ""}" data-id="${esc(q.id)}">
    <h3><span class="no">${i + 1}</span><span>${esc(q.q)}${req}</span></h3>${inner}</section>`;
}

export async function render(view, [id]) {
  const surveys = await getJSON("data/surveys.json");
  if (!id) return listView(view, surveys);
  const sv = surveys.find((s) => s.id === id);
  if (!sv) { view.innerHTML = `<div class="empty"><span class="big">📭</span>找不到問卷</div>`; return; }

  const prev = S.survey[sv.id];
  const ans = { ...(prev?.answers || {}) };
  const isAnswered = (q) => { const v = ans[q.id]; return v != null && v !== "" && !(Array.isArray(v) && !v.length); };

  view.innerHTML = `
  <div class="quiz-top">
    <a class="btn btn-icon btn-sm" href="#/survey" aria-label="返回">${icon.back.replace("<svg", '<svg style="fill:none;stroke:currentColor;stroke-width:2.6"')}</a>
    <h1 style="flex:1;margin:0;font-size:18px;font-weight:900">${esc(sv.title)}</h1>
  </div>
  ${sv.cover ? `<img src="${esc(sv.cover)}" alt="" style="width:100%;border-radius:18px;border:2.5px solid var(--ink);margin-bottom:14px">` : ""}
  ${prev ? `<div class="explain" style="margin:0 0 14px">✓ ${fmtDate(new Date(prev.t).toISOString().slice(0, 10))}</div>` : ""}
  <div class="sv-progress"><div class="qbar"><i></i></div><span class="qcount"></span></div>
  <form class="sv-form" novalidate>
    ${sv.questions.map((q, i) => qHTML(q, i, ans[q.id])).join("")}
    <button class="btn btn-primary btn-block" type="submit" style="min-height:54px;font-size:17px">${prev ? "更新回答" : "送出"}</button>
  </form>`;

  const form = $(".sv-form", view);
  const progress = () => {
    const n = sv.questions.filter(isAnswered).length;
    $(".sv-progress .qbar i", view).style.setProperty("--p", (n / sv.questions.length) * 100 + "%");
    $(".sv-progress .qcount", view).textContent = `${n}/${sv.questions.length}`;
    sv.questions.forEach((q) => form.querySelector(`[data-id="${CSS.escape(q.id)}"]`).classList.toggle("answered", isAnswered(q)));
  };

  form.addEventListener("change", (e) => {
    const t = e.target;
    if (!t.name) return;
    const q = sv.questions.find((x) => x.id === t.name);
    if (q.type === "multi") ans[q.id] = $$(`input[name="${CSS.escape(q.id)}"]:checked`, form).map((x) => x.value);
    else ans[q.id] = t.value;
    if (t.type === "radio" || t.type === "checkbox") { sfx.pop(); buzz(6); }
    progress();
  });
  form.addEventListener("input", (e) => {
    if (e.target.tagName === "TEXTAREA") { ans[e.target.name] = e.target.value.trim(); progress(); }
  });
  form.addEventListener("click", (e) => {
    const b = e.target.closest(".sv-rate button, .sv-scale button");
    if (!b) return;
    const box = b.parentElement;
    const v = +b.dataset.v;
    ans[box.dataset.q] = v;
    $$("button", box).forEach((x) => x.classList.toggle("on", box.classList.contains("sv-rate") ? +x.dataset.v <= v : x === b));
    sfx.pop(); buzz(6);
    if (box.classList.contains("sv-rate")) stars(e.clientX, e.clientY, 4, [b.textContent]);
    progress();
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const miss = sv.questions.find((q) => q.required && !isAnswered(q));
    if (miss) {
      const el = form.querySelector(`[data-id="${CSS.escape(miss.id)}"]`);
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.remove("need"); void el.offsetWidth; el.classList.add("need");
      setTimeout(() => el.classList.remove("need"), 1200);
      sfx.bad(); buzz([20, 30, 20]);
      return;
    }
    const btn = $("button[type=submit]", form);
    btn.disabled = true;
    if (sv.submit?.url) {
      const body = new URLSearchParams();
      for (const q of sv.questions) {
        const entry = sv.submit.fields?.[q.id];
        if (!entry || !isAnswered(q)) continue;
        [].concat(ans[q.id]).forEach((v) => body.append(entry, v));
      }
      try { await fetch(sv.submit.url, { method: "POST", mode: "no-cors", body }); }
      catch { toast("網路好像怪怪的，回答先存在本機"); }
    }
    S.survey[sv.id] = { answers: ans, t: Date.now() };
    save();
    confetti(70);
    sfx.good();
    view.innerHTML = `<section class="result card">
      <div class="grade" style="font-size:64px">THX!</div>
      <div class="score">${esc(sv.thanks || "謝謝你的回答")}</div>
      <div class="gain-slot"></div>
      <div class="actions"><a class="btn" href="#/survey">其他問卷</a><a class="btn btn-primary" href="#/">回首頁</a></div>
    </section>`;
    scrollTo({ top: 0 });
    setTimeout(() => {
      const r = $(".grade", view)?.getBoundingClientRect();
      if (r) stars(r.left + r.width / 2, r.top + r.height / 2, 12);
      const got = gain(`survey:${sv.id}`, 5, "填寫問卷");
      if (got) $(".gain-slot", view).innerHTML = `<span class="gain">+${got} 積分</span>`;
    }, 400);
  });

  progress();
}
