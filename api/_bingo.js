// api/_bingo.js — port y hệt logic Bingo client (game.html __bboard/__blines,
// senpai.js bingoBoard) để server tự tính số line cho khóa CỨNG.
// Pool 12 id + FNV-1a + PRNG + 8 line patterns phải KHỚP client từng bit.
// Lưu ý múi giờ: __bw dùng giờ local; server UTC có thể lệch tuần khách VN
// trong cửa sổ ~7h/tuần (CN 17:00–24:00 UTC) → countLinesMax kiểm max 3 tuần kề.
const IDS = ['open_vi', 'spin', 'feed', 'play', 'adv', 'win', 'fav', 'share', 'comment', 'mail', 'battle', 'theme'];
const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
function isoWeek(d) {
  d = d || new Date();
  var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  var day = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - day + 3);
  var f = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  var fd = (f.getUTCDay() + 6) % 7;
  f.setUTCDate(f.getUTCDate() - fd + 3);
  var w = 1 + Math.round((t - f) / 6048e5);
  return t.getUTCFullYear() + '-W' + ('0' + w).slice(-2);
}
function fnv(s) {
  var h = 2166136261;
  for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function board(weekStr) {
  var seed = fnv(weekStr), pool = IDS.slice(), out = [];
  var rnd = function () { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; var t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  while (out.length < 9 && pool.length) out.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
  return out;
}
function shiftWeek(weekStr, delta) {
  try {
    const m = /^(\d{4})-W(\d{2})$/.exec(weekStr);
    if (!m) return weekStr;
    // Thứ 4 của tuần ISO + delta tuần -> tính lại key
    const y = +m[1];
    const jan4 = new Date(Date.UTC(y, 0, 4));
    const fday = (jan4.getUTCDay() + 6) % 7;
    const thu = new Date(jan4);
    thu.setUTCDate(jan4.getUTCDate() - fday + 3 + (+m[2] - 1) * 7 + delta * 7);
    return isoWeek(new Date(thu.getUTCFullYear(), thu.getUTCMonth(), thu.getUTCDate()));
  } catch { return weekStr; }
}
// doneMap: {weekKey: {actionId:1}} (đúng shape j2me_bingo_prog). hasFav: true nếu có like.
// Trả về max lines trong 3 tuần kề (chống lệch múi giờ server UTC vs máy khách).
function countLinesMax(doneMap, hasFav) {
  const w0 = isoWeek(new Date());
  const weeks = [shiftWeek(w0, -1), w0, shiftWeek(w0, 1)];
  let best = 0;
  for (const w of weeks) {
    const b = board(w);
    const p = (doneMap && doneMap[w]) || {};
    const done = (id) => (p[id] ? true : (id === 'fav' ? !!hasFav : false));
    let n = 0;
    for (const L of LINES) if (done(b[L[0]]) && done(b[L[1]]) && done(b[L[2]])) n++;
    if (n > best) best = n;
  }
  return best;
}
function petLevel(petXp) { return Math.floor(Math.max(0, parseInt(petXp, 10) || 0) / 100); }
module.exports = { IDS, LINES, isoWeek, board, shiftWeek, countLinesMax, petLevel };
