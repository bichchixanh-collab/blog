// api/ustats.js — đếm server-side cho khóa tải CỨNG (chỉ người đã đăng nhập).
// Client gửi EVENT kèm Bearer access_token (không gửi số tự khai):
//   heartbeat (+1 phút nếu cách lần trước ≥50s) | like/unlike/complete/uncomplete {id}
//   bingo {week, ids[]} (hợp nhất ô đã đánh) | petxp {exp} (max-merge)
// GET  /api/ustats            -> {uid, minutes, likes, completed, bingoLines, petLv}
// POST /api/ustats {t, ...}   -> {ok, minutes, likes, completed}
const { check, ipOf } = require('./_rate');
const { bearerToken, verifySbTokenAsync, getUserStats, eventUserStats } = require('./_sb');
const { countLinesMax, petLevel } = require('./_bingo');
const { originStatus } = require('./_lib');

function send(res, code, obj) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}
function counts(st) {
  return {
    minutes: st.minutes,
    likes: st.likes.length,
    completed: st.completed.length,
    bingoLines: countLinesMax(st.bingo, st.likes.length > 0),
    petLv: petLevel(st.pet_xp),
  };
}
function readJsonBody(req) {
  return new Promise((resolve) => {
    try {
      const b = req.body;
      if (b && typeof b === 'object') return resolve(b);
      if (typeof b === 'string' && b) { try { return resolve(JSON.parse(b)); } catch {} return resolve(null); }
    } catch {}
    let raw = '';
    try {
      req.on('data', (c) => { raw += c; });
      req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : null); } catch { resolve(null); } });
    } catch { resolve(null); }
  });
}
module.exports = async (req, res) => {
  try {
    if (req.method === 'POST' && originStatus(req) !== 'same') { send(res, 403, { error: 'cross-origin denied' }); return; }
    const me = await verifySbTokenAsync(bearerToken(req));
    if (!me) { send(res, 401, { error: 'login required' }); return; }
    if (req.method === 'GET') {
      if (!await check({ ip: ipOf(req), route: 'ustats-get', limit: 60, windowS: 60 })) { send(res, 429, { error: 'slow down' }); return; }
      const st = await getUserStats(me.uid);
      if (!st) { send(res, 503, { error: 'stats unavailable' }); return; }
      send(res, 200, Object.assign({ uid: me.uid, bingo: st.bingo, petExp: st.pet_xp }, counts(st)));
      return;
    }
    if (req.method === 'POST') {
      if (!await check({ ip: ipOf(req), route: 'ustats-post', limit: 120, windowS: 60 })) { send(res, 429, { error: 'slow down' }); return; }
      const p = (await readJsonBody(req)) || {};
      const t = String(p.t || '');
      if (['heartbeat', 'like', 'unlike', 'complete', 'uncomplete', 'bingo', 'petxp'].indexOf(t) < 0) { send(res, 400, { error: 'bad event' }); return; }
      const st = await eventUserStats(me.uid, { t, id: p.id, week: p.week, ids: p.ids, exp: p.exp });
      if (!st) { send(res, 503, { error: 'stats unavailable' }); return; }
      send(res, 200, Object.assign({ ok: true }, counts(st)));
      return;
    }
    send(res, 405, { error: 'method not allowed' });
  } catch (e) { try { console.error('ustats error:', e && e.message); } catch {} send(res, 500, { error: 'error' }); }
};
