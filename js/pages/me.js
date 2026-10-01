import { $, esc, getJSON } from "../util.js";
import { S, levelOf, progressOf, PER_LEVEL, setSetting, exportCode, importCode, reset } from "../store.js";
import { sheet, toast, confirmBox, sfx, confetti } from "../fx.js";
import { site, levelTitle } from "../app.js";

const ago = (t) => {
  const m = Math.round((Date.now() - t) / 6e4);
  if (m < 1) return "剛剛";
  if (m < 60) return `${m} 分鐘前`;
  if (m < 1440) return `${Math.round(m / 60)} 小時前`;
  return `${Math.round(m / 1440)} 天前`;
};

export async function render(view) {
  await getJSON("data/site.json").catch(() => null);
  const paint = () => {
    const lv = levelOf(S.points), prog = progressOf(S.points);
    const roadLen = Math.max(site.levels.length, lv + 2);
    const read = Object.keys(S.read).length;
    view.innerHTML = `
    <section class="me-card card">
      <div class="me-top">
        <div class="me-ring">
          <svg viewBox="0 0 110 110"><circle class="bg" cx="55" cy="55" r="46"/><circle class="fg" cx="55" cy="55" r="46" pathLength="100"/></svg>
          <div class="num"><small>LEVEL</small><b>${lv}</b></div>
        </div>
        <div>
          <div class="me-title">${esc(levelTitle(lv))}</div>
          <div class="me-pts">${S.points} PTS</div>
          <div class="me-next">Lv.${lv + 1} 還差 <b>${PER_LEVEL - prog}</b> 分</div>
        </div>
      </div>
      <div class="xp-bar"><i style="--p:0%"></i></div>
    </section>

    <div class="stat-row">
      <div class="stat card"><b>${S.checkin.streak || 0}</b><span>🔥 連續簽到</span></div>
      <div class="stat card"><b>${read}</b><span>📚 已讀心得</span></div>
      <div class="stat card"><b>${Object.keys(S.best).length + Object.keys(S.claimed).filter((k) => k.startsWith("cw:")).length}</b><span>🎮 遊戲紀錄</span></div>
    </div>

    <div class="sec-head"><h2 class="sec-title">稱號之路</h2></div>
    <section class="card" style="padding:10px 14px"><div class="road">
      ${Array.from({ length: roadLen }, (_, i) => `<div class="road-step ${i < lv ? "got" : i === lv ? "cur" : "locked"}">
        <span class="pin">${i < lv ? "✓" : i === lv ? "★" : ""}</span>
        <span class="lv">Lv.${i}</span><span>${i <= lv + 1 ? esc(levelTitle(i)) : "？？？"}</span>
      </div>`).join("")}
    </div></section>

    ${S.hist.length ? `<div class="sec-head"><h2 class="sec-title">積分紀錄</h2></div>
    <section class="card" style="padding:4px 14px"><div class="hist">
      ${S.hist.slice(0, 12).map((h) => `<div class="hist-row"><span>${esc(h.r)}<br><time>${ago(h.t)}</time></span><b>+${h.pts}</b></div>`).join("")}
    </div></section>` : ""}

    <div class="sec-head"><h2 class="sec-title">設定</h2></div>
    <section class="card" style="padding:2px 14px">
      <div class="set-row"><span>🔊 音效</span><button class="switch" role="switch" aria-checked="${!!S.settings.sound}" aria-label="音效"></button></div>
      <div class="set-row"><span>💾 備份進度</span><button class="btn btn-sm export">複製</button></div>
      <div class="set-row"><span>📥 還原進度</span><button class="btn btn-sm import">貼上</button></div>
      <div class="set-row"><span>🗑️ 重置</span><button class="btn btn-sm reset" style="color:var(--red)">重置</button></div>
    </section>`;

    requestAnimationFrame(() => requestAnimationFrame(() => {
      $(".me-ring .fg", view).style.strokeDashoffset = 100 - (prog / PER_LEVEL) * 100;
      $(".xp-bar i", view).style.setProperty("--p", (prog / PER_LEVEL) * 100 + "%");
    }));

    $(".switch", view).onclick = (e) => {
      const on = !S.settings.sound;
      setSetting("sound", on);
      e.currentTarget.setAttribute("aria-checked", on);
      sfx.good();
    };
    $(".export", view).onclick = async () => {
      const code = exportCode();
      try { await navigator.clipboard.writeText(code); toast("備份碼已複製 📋"); }
      catch { sheet(`<h2>備份碼</h2><textarea readonly style="width:100%;min-height:140px;border:2px solid var(--ink);border-radius:14px;padding:10px;font-size:12px">${esc(code)}</textarea>`); }
    };
    $(".import", view).onclick = () => {
      const sh = sheet(`<h2>還原進度</h2>
        <textarea class="code" placeholder="貼上備份碼" style="width:100%;min-height:140px;border:2px solid var(--ink);border-radius:14px;padding:10px;font-size:13px"></textarea>
        <button class="btn btn-primary btn-block go" style="margin-top:12px">還原</button>`);
      $(".go", sh.el).onclick = () => {
        try {
          importCode($(".code", sh.el).value);
          sh.close();
          toast("還原成功 ✨");
          confetti(40);
          setTimeout(() => location.reload(), 900);
        } catch { toast("備份碼好像不對喔"); }
      };
    };
    $(".reset", view).onclick = async () => {
      if (!(await confirmBox("確定要重置所有進度？", "重置"))) return;
      reset();
      location.reload();
    };
  };
  paint();
  const onPts = () => paint();
  document.addEventListener("points", onPts);
  return () => document.removeEventListener("points", onPts);
}
