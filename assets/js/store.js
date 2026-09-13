// store.js — gamification + favorites + streak, gom 3 bản copy rời rạc trước đây.
const K = { xp: 'j2me_xp', favs: 'j2me_favs', seen: 'j2me_seen', done: 'j2me_done', lite: 'j2me_lite' };
export const LEVELS = [[0, 'Tân thủ'], [30, 'Mới chơi'], [80, 'Game thủ'], [150, 'Cao thủ'], [300, 'Lão làng WAP'], [600, 'Huyền thoại WAP']];
function read(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } }
function write(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
export function getXp() { return read(K.xp, { xp: 0 }).xp || 0; }
export function addXp(n) { const o = read(K.xp, { xp: 0 }); o.xp = (o.xp || 0) + n; write(K.xp, o); }
export function levelOf(xp = getXp()) {
  let cur = LEVELS[0];
  for (const lv of LEVELS) if (xp >= lv[0]) cur = lv;
  const i = LEVELS.indexOf(cur);
  return { name: cur[1], cur: cur[0], next: i + 1 < LEVELS.length ? LEVELS[i + 1] : null };
}
// Quest hằng ngày: seen 3 / fav 1 / cmt 1 — mỗi cái +10, chống cộng dồn trong ngày.
export function questInc(kind) {
  const goals = { seen: 3, fav: 1, cmt: 1 };
  if (!(kind in goals)) return;
  try {
    const day = new Date().toISOString().slice(0, 10);
    const k = `j2me_q_${kind}_${day}`, dk = `j2me_qd_${kind}_${day}`;
    const v = +(localStorage.getItem(k) || 0) + 1;
    localStorage.setItem(k, String(v));
    if (v >= goals[kind] && !localStorage.getItem(dk)) { localStorage.setItem(dk, '1'); addXp(10); }
  } catch {}
}
export function markSeen(id) {
  try {
    const a = read(K.seen, []);
    if (!a.includes(id)) { a.push(id); write(K.seen, a.slice(-500)); addXp(5); questInc('seen'); }
  } catch {}
}
export function getFavs() { const a = read(K.favs, []); return Array.isArray(a) ? a : []; }
export function hasFav(id) { return getFavs().includes(id); }
export function toggleFav(id) {
  let a = getFavs();
  const had = a.includes(id);
  a = had ? a.filter((x) => x !== id) : [...a, id];
  write(K.favs, a.slice(0, 200));
  if (!had) { addXp(3); questInc('fav'); }
  return !had;
}
// Streak điểm danh hằng ngày — ý tưởng giữ chân mới (bản cũ chưa có).
export function checkin() {
  try {
    const day = new Date().toISOString().slice(0, 10);
    const last = localStorage.getItem('j2me_streak_last');
    let s = +(localStorage.getItem('j2me_streak') || 0);
    if (last === day) return { streak: s, added: false };
    const y = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
    s = last === y ? s + 1 : 1;
    localStorage.setItem('j2me_streak', String(s));
    localStorage.setItem('j2me_streak_last', day);
    addXp(Math.min(5 + s, 20));
    return { streak: s, added: true };
  } catch { return { streak: 0, added: false }; }
}
