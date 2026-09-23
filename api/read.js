// GET /api/read?id=GAME -> {rz} — vé đọc bài: server ký mốc mở trang (HMAC).
// Client mở trang game là xin ngay 1 vé; lúc xin vé tải, server kiểm tra thời
// gian đã trôi qua có đủ read_secs của bài không. Stateless, không phụ thuộc IP.
const fs = require('fs');
const path = require('path');
const { check: rateCheck, ipOf } = require('./_rate');
const { mintReadNonce } = require('./_lock');

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
    if (!(await rateCheck({ ip: ipOf(req), route: 'read', limit: 30, windowS: 60 }))) {
      send(res, 429, { error: 'slow down' });
      return;
    }
    const id = String((req.query && req.query.id) || '').slice(0, 120);
    if (!/^[a-z0-9][a-z0-9\-]{0,119}$/i.test(id)) { send(res, 400, { error: 'id invalid' }); return; }
    const g = loadGames().find((x) => x && x.id === id);
    if (!g) { send(res, 404, { error: 'not found' }); return; }
    const rz = mintReadNonce(id);
    if (!rz) { send(res, 500, { error: 'error' }); return; }
    send(res, 200, { rz });
  } catch (e) { try { console.error('read error:', e && e.message); } catch {} send(res, 500, { error: 'error' }); }
};
