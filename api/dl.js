// api/dl.js — gateway tải duy nhất. Chặn supply-chain: chỉ redirect host trong allowlist,
// validate id/res theo games.json, đếm server-side qua _store (không tin localStorage).
const fs = require('fs'), path = require('path');
const { check, ipOf } = require('./_rate');
const { countDl } = require('./_store');
const ALLOW_HOSTS = new Set(['drive.google.com', 'www.mediafire.com', 'mediafire.com', 'github.com', 'raw.githubusercontent.com', 'cdn.jsdelivr.net', (process.env.FILES_HOST || '').toLowerCase()].filter(Boolean));
// Khóa mềm: game có gate yêu cầu proof (client tự ký khi local đủ điều kiện).
// Không tài khoản nên server chỉ kiểm tra được: đúng game + ngày tươi + đủ line (bingo).
// Đủ chặn link copy tay/share thiếu proof — kẻ đọc code vẫn giả được, đã ghi rõ trong docs.
function checkProof(p, id, gate) {
  try {
    if (!p) return false;
    const json = Buffer.from(String(p).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    const o = JSON.parse(json);
    if (!o || o.id !== id || typeof o.day !== 'string') return false;
    const dayMs = Date.parse(o.day + 'T00:00:00Z');
    if (isNaN(dayMs)) return false;
    if (Math.abs(Date.now() - dayMs) > 2 * 864e5) return false;
    if (gate.type === 'bingo') {
      const need = Math.max(1, parseInt(gate.lines || 1, 10) || 1);
      if (!(o.lines >= need)) return false;
    }
    return true;
  } catch { return false; }
}
module.exports = async (req, res) => {
  const id = String((req.query && (req.query.id || req.query.game)) || '').slice(0, 120);
  const resName = String((req.query && req.query.res) || '').slice(0, 16);
  if (!/^[a-z0-9][a-z0-9\-]{0,119}$/i.test(id)) { res.statusCode = 400; res.end('id invalid'); return; }
  if (!await check({ ip: ipOf(req), route: 'dl', limit: 30, windowS: 60 })) { res.statusCode = 429; res.end('slow down'); return; }
  if (!await check({ ip: ipOf(req), route: 'dl-day', limit: 300, windowS: 86400 })) { res.statusCode = 429; res.end('slow down'); return; }
  let games = [];
  try { games = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'games.json'), 'utf-8')); } catch {}
  const g = games.find((x) => x && x.id === id);
  if (!g) { res.statusCode = 404; res.end('not found'); return; }
  const gate = (g.gate && g.gate.type && g.gate.type !== 'none') ? g.gate : null;
  if (gate && !checkProof(req.query && req.query.proof, id, gate)) {
    const site = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers['x-forwarded-host'] || req.headers.host}`;
    res.statusCode = 302;
    res.setHeader('Location', `${site}/game/${encodeURIComponent(id)}.html?locked=1`);
    res.end();
    return;
  }
  const target = (g.jar || {})[resName] || Object.values(g.jar || {})[0];
  if (!target) { res.statusCode = 404; res.end('no file'); return; }
  let host = '';
  try { host = new URL(target).hostname.toLowerCase(); } catch { res.statusCode = 500; res.end('bad url'); return; }
  if (!ALLOW_HOSTS.has(host)) {
    // Host lạ: không redirect thẳng, đưa qua trang cảnh báo /go.html để user xác nhận.
    const site = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers['x-forwarded-host'] || req.headers.host}`;
    res.statusCode = 302;
    res.setHeader('Location', `${site}/go.html?id=${encodeURIComponent(id)}&res=${encodeURIComponent(resName)}`);
    res.end();
    return;
  }
  try { await countDl(id); } catch {}
  res.statusCode = 302;
  res.setHeader('Location', target);
  res.setHeader('Cache-Control', 'no-store');
  res.end();
};
