// api/dl.js — gateway tải duy nhất. Chặn supply-chain: chỉ redirect host trong allowlist,
// validate id/res theo games.json, đếm server-side qua _store (không tin localStorage).
// Chống crack/soi source cho bài khóa:
//  - URL file (kể cả ENC:) chỉ giải ở server, không bao giờ lộ ra client.
//  - Luồng chính: go.html?ticket=... (vé HMAC 15 phút, ràng buộc đúng gate lúc cấp).
//  - Luồng cũ ?id=&res=&proof= vẫn chạy (tương thích), proof đã mở rộng kiểm tra stats.
const fs = require('fs'), path = require('path');
const { check, ipOf } = require('./_rate');
const { countDl } = require('./_store');
const { verifyTicket, gateHash, mintTicket, resolveJarUrl, checkProofExtended } = require('./_lock');
const { countApproved } = require('./comments');
const ALLOW_HOSTS = new Set(['sfile.co', 'drive.google.com', 'www.mediafire.com', 'mediafire.com', 'github.com', 'raw.githubusercontent.com', 'cdn.jsdelivr.net', (process.env.FILES_HOST || '').toLowerCase()].filter(Boolean));

function loadGames() {
  try { return JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'games.json'), 'utf-8')); } catch { return []; }
}
function siteOf(req) {
  return `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers['x-forwarded-host'] || req.headers.host}`;
}
// Game có gate yêu cầu proof: server kiểm đúng game + ngày tươi + bingo lines +
// số bình luận duyệt (đếm chéo DB) + phút online qua presence chain đã ký.
// Like/phá đảo vẫn là số local (khóa mềm); chỉ phút online là siết cứng cho cả khách.
async function checkProofLegacy(p, id, gate, req) {
  try {
    if (!p) return false;
    const { b64uDecode } = require('./_lock');
    const raw = b64uDecode(p);
    if (!raw) return false;
    const o = JSON.parse(raw.toString('utf8'));
    if (!o || o.id !== id || typeof o.day !== 'string') return false;
    const dayMs = Date.parse(o.day + 'T00:00:00Z');
    if (isNaN(dayMs)) return false;
    if (Math.abs(Date.now() - dayMs) > 2 * 864e5) return false;
    if (gate.type === 'bingo') {
      const need = Math.max(1, parseInt(gate.lines || 1, 10) || 1);
      if (!(o.lines >= need)) return false;
    }
    if (gate.type === 'stats') {
      const chk = await checkProofExtended(p, id, gate, countApproved, null, false, req ? ipOf(req) : '');
      if (!chk.ok) return false;
    }
    return true;
  } catch { return false; }
}
module.exports = async (req, res) => {
  const q = req.query || {};
  // --- Luồng vé (go.html): ?ticket=... ---
  if (q.ticket) {
    if (!await check({ ip: ipOf(req), route: 'dl', limit: 30, windowS: 60 })) { res.statusCode = 429; res.end('slow down'); return; }
    const t = verifyTicket(q.ticket);
    if (!t) { res.statusCode = 403; res.end('bad ticket'); return; }
    const games = loadGames();
    const g = games.find((x) => x && x.id === t.id);
    if (!g) { res.statusCode = 404; res.end('not found'); return; }
    const gate = (g.gate && g.gate.type && g.gate.type !== 'none') ? g.gate : null;
    if (gateHash(gate || { type: 'none' }) !== t.gh) {
      res.statusCode = 302;
      res.setHeader('Location', `${siteOf(req)}/game/${encodeURIComponent(t.id)}.html?locked=1`);
      res.end();
      return;
    }
    const resList = Array.isArray(g.res) ? g.res : [];
    if (resList.indexOf(t.res) < 0) { res.statusCode = 400; res.end('res invalid'); return; }
    await finishDl(req, res, g, t.res);
    return;
  }
  // --- Luồng cũ: ?id=&res=[&proof=] (giữ tương thích, vẫn kiểm khóa) ---
  const id = String((q.id || q.game) || '').slice(0, 120);
  const resName = String(q.res || '').slice(0, 16);
  if (!/^[a-z0-9][a-z0-9\-]{0,119}$/i.test(id)) { res.statusCode = 400; res.end('id invalid'); return; }
  if (!await check({ ip: ipOf(req), route: 'dl', limit: 30, windowS: 60 })) { res.statusCode = 429; res.end('slow down'); return; }
  if (!await check({ ip: ipOf(req), route: 'dl-day', limit: 300, windowS: 86400 })) { res.statusCode = 429; res.end('slow down'); return; }
  const games = loadGames();
  const g = games.find((x) => x && x.id === id);
  if (!g) { res.statusCode = 404; res.end('not found'); return; }
  const gate = (g.gate && g.gate.type && g.gate.type !== 'none') ? g.gate : null;
  // Luồng trực tiếp không mang token → bài bắt đăng nhập luôn chuyển về trang khóa
  if (gate && (gate.type === 'login' || gate.login)) {
    res.statusCode = 302;
    res.setHeader('Location', `${siteOf(req)}/game/${encodeURIComponent(id)}.html?locked=1`);
    res.end();
    return;
  }
  if (gate && !await checkProofLegacy(q.proof, id, gate, req)) {
    res.statusCode = 302;
    res.setHeader('Location', `${siteOf(req)}/game/${encodeURIComponent(id)}.html?locked=1`);
    res.end();
    return;
  }
  await finishDl(req, res, g, resName);
};
async function finishDl(req, res, g, resName) {
  const target = resolveJarUrl(g.jar, resName, g.id);
  if (!target) { res.statusCode = 404; res.end('no file'); return; }
  let host = '';
  try { host = new URL(target).hostname.toLowerCase(); } catch { res.statusCode = 500; res.end('bad url'); return; }
  if (!ALLOW_HOSTS.has(host)) {
    // Host lạ: không redirect thẳng, đưa qua trang cảnh báo go.html bằng vé mới
    // (vé giữ nguyên hiệu lực, không lộ URL).
    try {
      const gate = (g.gate && g.gate.type && g.gate.type !== 'none') ? g.gate : null;
      const t = mintTicket(g.id, resName, gate || { type: 'none' });
      res.statusCode = 302;
      res.setHeader('Location', `${siteOf(req)}/go.html?ticket=${encodeURIComponent(t.ticket)}`);
      res.end();
      return;
    } catch { res.statusCode = 500; res.end('error'); return; }
  }
  try { await countDl(g.id); } catch {}
  res.statusCode = 302;
  res.setHeader('Location', target);
  res.setHeader('Cache-Control', 'no-store');
  res.end();
}
