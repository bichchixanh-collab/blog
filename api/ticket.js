// api/ticket.js — cấp vé tải dùng 1 lần cho go.html.
// Client qua khóa local mới xin được vé (kèm proof); vé HMAC hết hạn 15 phút
// và ràng buộc đúng gate lúc cấp (admin đổi gate → vé cũ vô hiệu).
// GET /api/ticket?id=&res=&proof= -> {ticket, exp} | {error}
const fs = require('fs'), path = require('path');
const { check, ipOf } = require('./_rate');
const { mintTicket, checkProofExtended } = require('./_lock');
const { countApproved } = require('./comments');
const { bearerToken, verifySbToken, getUserStats, getSenpai } = require('./_sb');
const { chargeForDownload, costOf } = require('./economy');
const { countLinesMax, petLevel } = require('./_bingo');
// Gom số server-side theo tài khoản cho khóa CỨNG. null = hạ tầng lỗi (fail-closed).
async function resolveServerStats(uid) {
  try {
    const [st, sen] = await Promise.all([getUserStats(uid), getSenpai(uid)]);
    if (!st || !sen) return null;
    const appr = await countApproved([], uid);
    return {
      min: st.minutes,
      likes: st.likes.length,
      done: st.completed.length,
      approved: appr,
      bingoLines: countLinesMax(st.bingo, st.likes.length > 0),
      petLv: petLevel(st.pet_xp),
      badges: sen.badges.length > 0,
      xp: sen.xp,
    };
  } catch { return null; }
}

function send(res, code, obj) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}
function loadGames() {
  try { return JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'games.json'), 'utf-8')); } catch { return []; }
}
module.exports = async (req, res) => {
  try {
    if (req.method !== 'GET') { send(res, 405, { error: 'method not allowed' }); return; }
    if (!await check({ ip: ipOf(req), route: 'ticket', limit: 60, windowS: 60 })) { send(res, 429, { error: 'slow down' }); return; }
    const id = String((req.query && req.query.id) || '').slice(0, 120);
    const resName = String((req.query && req.query.res) || '').slice(0, 16);
    if (!/^[a-z0-9][a-z0-9\-]{0,119}$/i.test(id)) { send(res, 400, { error: 'id invalid' }); return; }
    const games = loadGames();
    const g = games.find((x) => x && x.id === id);
    if (!g) { send(res, 404, { error: 'not found' }); return; }
    const resList = Array.isArray(g.res) ? g.res : [];
    if (!resName || resList.indexOf(resName) < 0) { send(res, 400, { error: 'res invalid' }); return; }
    const gate = (g.gate && g.gate.type && g.gate.type !== 'none') ? g.gate : null;
    let hard = 0;
    if (gate) {
      const me = verifySbToken(bearerToken(req));
      // Chế độ bắt đăng nhập (type login hoặc cờ login): thiếu token là từ chối ngay
      if ((gate.type === 'login' || gate.login) && !me) { send(res, 403, { error: 'login required' }); return; }
      // Đã đăng nhập: KHÓA CỨNG theo số server-side (fail-closed nếu hạ tầng lỗi)
      let serverStats = null;
      if (me) {
        serverStats = await resolveServerStats(me.uid);
        if (!serverStats) { send(res, 503, { error: 'stats unavailable' }); return; }
      }
      const proof = req.query && req.query.proof;
      const chk = await checkProofExtended(proof, id, gate, countApproved, serverStats, !!me, ipOf(req));
      if (!chk.ok) { send(res, 403, { error: 'locked', reason: chk.reason, hard: serverStats ? 1 : 0 }); return; }
      hard = chk.hard ? 1 : 0;
    }
    // Ví EXP: trừ giá tải của bài (tải lại game đã sở hữu thì miễn phí).
    {
      const cost = costOf(g);
      if (cost > 0) {
        const mePay = verifySbToken(bearerToken(req));
        let cidPay = '';
        try {
          const raw = Buffer.from(String((req.query && req.query.proof) || '').replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
          const pj = JSON.parse(raw);
          if (pj && typeof pj.cid === 'string') cidPay = pj.cid.slice(0, 64);
        } catch (e) {}
        const pay = await chargeForDownload({ uid: mePay ? mePay.uid : null, cid: cidPay, gameId: id, cost });
        if (!pay.ok && pay.reason === 'low_exp') {
          send(res, 402, { error: 'low_exp', need: pay.need, bal: pay.bal });
          return;
        }
        if (!pay.ok) { send(res, 503, { error: 'economy unavailable' }); return; }
      }
    }
    const t = mintTicket(id, resName, gate || { type: 'none' }, hard);
    send(res, 200, { ticket: t.ticket, exp: t.exp, hard });
  } catch (e) { try { console.error('ticket error:', e && e.message); } catch {} send(res, 500, { error: 'error' }); }
};
