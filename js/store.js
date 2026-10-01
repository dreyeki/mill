// 免登入積分系統：資料只存在訪客自己的瀏覽器（localStorage）
import { today } from "./util.js";

const KEY = "mill.progress.v1";
export const PER_LEVEL = 10;
export const START_POINTS = 7;

function fresh() {
  return {
    points: START_POINTS,
    claimed: {},
    best: {},
    daily: {},
    checkin: { last: "", streak: 0, total: 0 },
    hist: [],
    read: {},
    seen: {},
    react: {},
    survey: {},
    settings: { sound: false },
    since: today(),
  };
}

let memoryOnly = false;
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && typeof s.points === "number") return { ...fresh(), ...s };
    }
  } catch { memoryOnly = true; }
  return fresh();
}

export const S = load();

export function save() {
  if (memoryOnly) return;
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { memoryOnly = true; }
}

// 清掉過期的每日上限紀錄
for (const d of Object.keys(S.daily)) if (d !== today()) delete S.daily[d];

export const levelOf = (p) => Math.floor(p / PER_LEVEL);
export const progressOf = (p) => p % PER_LEVEL;

const subs = new Set();
export const onGain = (fn) => (subs.add(fn), () => subs.delete(fn));

function add(pts, reason) {
  if (pts <= 0) return 0;
  const before = levelOf(S.points);
  S.points += pts;
  S.hist.unshift({ t: Date.now(), pts, r: reason });
  if (S.hist.length > 40) S.hist.length = 40;
  save();
  const after = levelOf(S.points);
  subs.forEach((fn) => fn({ pts, reason, before, after }));
  return pts;
}

/** 一次性獎勵：同一個 id 只會給一次。daily = { kind, cap } 時另有每日上限。 */
export function gain(id, pts, reason, daily) {
  if (id && S.claimed[id]) return 0;
  if (daily) {
    const d = (S.daily[today()] ||= {});
    const used = d[daily.kind] || 0;
    if (used >= daily.cap) return 0;
    pts = Math.min(pts, daily.cap - used);
    d[daily.kind] = used + pts;
  }
  if (id) S.claimed[id] = 1;
  return add(pts, reason);
}

/** 刷新個人最佳：只補發超過舊紀錄的差額 */
export function improve(key, score, reason) {
  const prev = S.best[key] || 0;
  if (score <= prev) return 0;
  S.best[key] = score;
  return add(score - prev, reason);
}

export function canCheckin() { return S.checkin.last !== today(); }

export function checkin() {
  if (!canCheckin()) return 0;
  const y = new Date(); y.setDate(y.getDate() - 1);
  const c = S.checkin;
  c.streak = c.last === today(y) ? c.streak + 1 : 1;
  c.last = today();
  c.total = (c.total || 0) + 1;
  const bonus = c.streak % 7 === 0 ? 5 : 0;
  return add(2 + bonus, bonus ? `連續簽到 ${c.streak} 天` : "每日簽到");
}

export function setSetting(k, v) { S.settings[k] = v; save(); }

export function exportCode() {
  return btoa(unescape(encodeURIComponent(JSON.stringify(S))));
}

export function importCode(code) {
  const data = JSON.parse(decodeURIComponent(escape(atob(code.trim()))));
  if (typeof data.points !== "number") throw new Error("bad");
  Object.keys(S).forEach((k) => delete S[k]);
  Object.assign(S, fresh(), data);
  save();
}

export function reset() {
  Object.keys(S).forEach((k) => delete S[k]);
  Object.assign(S, fresh());
  save();
}
