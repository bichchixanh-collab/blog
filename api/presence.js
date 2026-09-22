// api/presence.js — đổi link presence chain cho khách (không cần đăng nhập).
// Client treo trang gọi mỗi 60s kèm token cũ; server ký link mới +1 phút nếu cách
// link trước ≥50s (thời gian lấy từ iat đã ký — client không bịa được).
// Gọi sớm hơn thì trả lại token cũ (idempotent) nên mở nhiều tab cũng không farm nhanh hơn.
// POST /api/presence {tok?} -> {tok, n} | {error}
const { check, ipOf } = require('./_rate');
const { mintPresence, readPresence } = require('./_lock');

function send(res, code, obj) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}
function readJsonBody(req) {
  return new Promise((resolve) => {
    try {
      const b = req.body;
      if (b && typeof b === 'object') return resolve(b);
      if (typeof b === 'string' && b) { try { return resolve(JSON.parse(b)); } catch { return resolve(null); } }
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
    if (req.method !== 'POST') { send(res, 405, { error: 'method not allowed' }); return; }
    // Nhịp chuẩn 60s/tab → 10 req/10 phút là đủ; 30 cho dư đa tab + jitter
    if (!await check({ ip: ipOf(req), route: 'presence', limit: 30, windowS: 600 })) { send(res, 429, { error: 'slow down' }); return; }
    const p = (await readJsonBody(req)) || {};
    const cid = typeof p.cid === 'string' ? p.cid.slice(0, 64) : '';
    const tok = mintPresence(typeof p.tok === 'string' ? p.tok.slice(0, 500) : '', ipOf(req), cid);
    if (!tok) { send(res, 500, { error: 'error' }); return; }
    const o = readPresence(tok) || { n: 0 };
    send(res, 200, { tok, n: o.n || 0 });
  } catch (e) { try { console.error('presence error:', e && e.message); } catch {} send(res, 500, { error: 'error' }); }
};
