// api/dl.js — gateway tải duy nhất. Chặn supply-chain: chỉ redirect host trong allowlist,
// validate id/res theo games.json, đếm server-side qua _store (không tin localStorage).
// Chống crack/soi source cho bài khóa:
//  - URL file (kể cả ENC:) chỉ giải ở server, không bao giờ lộ ra client.
//  - Luồng chính: go.html?ticket=... (vé HMAC 15 phút, ràng buộc đúng gate lúc cấp).
//  - Luồng cũ ?id=&res=&proof= vẫn chạy (tương thích), proof đã mở rộng kiểm tra stats.
const fs = require('fs'), path = require('path');
const { check, ipOf } = require('./_rate');
const { countDl } = require('./_store');
const { verifyTicket, verifyTicketBinding, gateHash, mintTicket, resolveJarUrl, checkProofExtended } = require('./_lock');
const { countApproved } = require('./comments');
const ALLOW_HOSTS = new Set(['sfile.mobi', 'sfile.co', 'drive.google.com', 'www.mediafire.com', 'mediafire.com', 'github.com', 'raw.githubusercontent.com', 'cdn.jsdelivr.net', (process.env.FILES_HOST || '').toLowerCase()].filter(Boolean));
// One-time ticket: Supabase used_tickets (atomic INSERT, PK=jti).
// INSERT 201 = lần đầu; 409 = vé đã dùng (replay) -> chặn.
// Memory Map chỉ là pre-filter giảm query DB (true-positive), không thay thế DB
// vì serverless mỗi instance memory riêng. Lỗi hạ tầng -> fail-open (cho qua,
// ghi log) để không chặn lượt tải thật khi DB gián đoạn.
const crypto = require('crypto');
const usedTicketsMem = new Map();
async function isTicketUsed(jti) {
  if (!jti) return false;
  if (usedTicketsMem.has(jti)) return true;
  try {
    const { sbFetch } = require('./_sb');
    const ins = await sbFetch('/rest/v1/used_tickets', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ jti: String(jti).slice(0, 128) }),
    });
    if (ins.status === 201 || ins.status === 200 || ins.status === 204) {
      usedTicketsMem.set(jti, Date.now());
      if (usedTicketsMem.size > 5000) usedTicketsMem.clear();
      return false;
    }
    if (ins.status === 409) {
      usedTicketsMem.set(jti, Date.now());
      return true;
    }
    try { console.error('[dl] used_tickets insert status', ins.status); } catch {}
    return false;
  } catch (e) {
    try { console.error('[dl] used_tickets error', e && e.message); } catch {}
    return false;
  }
}

function loadGames() {
  try { return JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'games.json'), 'utf-8')); } catch { return []; }
}
function escH(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}
// Trang lỗi đẹp kiểu WAP (chỉ dùng style="" để qua được CSP, không <style>/<script>)
function errPage(res, code, title, msg, gameId) {
  const back = gameId ? `/game/${encodeURIComponent(gameId)}.html` : '/index.html';
  const html = '<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<meta name="robots" content="noindex"><title>' + escH(title) + ' — J2ME</title></head>'
    + '<body style="margin:0;padding:12px;background:#e8f4fd;font-family:system-ui,sans-serif;color:#1a3a5c;min-height:100vh;box-sizing:border-box">'
    + '<div style="max-width:420px;margin:0 auto;background:#fff;border:2px solid #4da6ff;border-radius:16px;overflow:hidden;box-shadow:0 6px 20px rgba(0,102,204,.18)">'
    + '<div style="background:linear-gradient(135deg,#4da6ff,#0066cc);color:#fff;text-align:center;padding:14px;font-weight:800">J2ME.VERCEL.APP</div>'
    + '<div style="padding:22px 16px;text-align:center">'
    + '<div style="font-size:48px">🔒</div>'
    + '<h2 style="font-size:15px;color:#0066cc;margin:10px 0 6px">' + escH(title) + '</h2>'
    + '<p style="font-size:12px;color:#4a7a9a;line-height:1.7">' + escH(msg) + '</p>'
    + '<a href="' + back + '" style="display:inline-block;margin-top:12px;background:linear-gradient(180deg,#4da6ff,#0066cc);color:#fff;padding:9px 22px;border-radius:24px;font-weight:800;font-size:12px;text-decoration:none;border:2px solid #fff;box-shadow:0 4px 0 #004499">‹ Về trang game lấy vé mới</a>'
    + '</div>'
    + '<div style="background:#1a3a5c;color:#b8d8f8;text-align:center;padding:10px;font-size:11px">© J2ME.VERCEL.APP</div>'
    + '</div></body></html>';
  res.statusCode = code;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(html);
}
function siteOf(req) {
  // Whitelist host to prevent X-Forwarded-Host poison (open redirect)
  const rawHost = String(req.headers.host || '').split(':')[0].toLowerCase();
  const fwd = String(req.headers['x-forwarded-host'] || '').split(',')[0].trim().split(':')[0].toLowerCase();
  let host = rawHost;
  if (fwd) {
    const allowed = (() => {
      try {
        if (process.env.SITE_URL) return new URL(process.env.SITE_URL).host.toLowerCase();
      } catch {}
      return '';
    })();
    if (fwd === rawHost || fwd === allowed || fwd.endsWith('.vercel.app')) host = fwd;
    // otherwise ignore fwd to avoid evil.com
  }
  const proto = (String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() || 'https').toLowerCase();
  const safeProto = proto === 'http' ? 'http' : 'https';
  return `${safeProto}://${host}`;
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
    if (!await check({ ip: ipOf(req), route: 'dl', limit: 30, windowS: 60 })) { errPage(res, 429, 'Bấm nhanh quá', 'Bạn thao tác quá nhanh, chờ khoảng 1 phút rồi thử lại nhé.', null); return; }
    const t = verifyTicket(q.ticket);
    if (!t) { errPage(res, 403, 'Vé không hợp lệ', 'Vé tải sai định dạng hoặc đã hết hạn (mỗi vé chỉ sống 15 phút). Về trang game bấm Tải để lấy vé mới.', null); return; }
    // One-time: v2 dùng jti, v1 legacy dùng sha256(ticket) làm khóa
    try {
      const tkey = (t.v === 2 && t.jti) ? String(t.jti) : ('v1-' + crypto.createHash('sha256').update(String(q.ticket), 'utf8').digest('hex').slice(0, 32));
      if (await isTicketUsed(tkey)) { errPage(res, 403, 'Vé đã được dùng', 'Mỗi vé chỉ tải được 1 lần duy nhất. Vé này đã có người (hoặc máy khác) dùng rồi — về trang game bấm Tải để lấy vé mới.', t.id); return; }
    } catch { errPage(res, 403, 'Vé đã được dùng', 'Mỗi vé chỉ tải được 1 lần duy nhất. Về trang game bấm Tải để lấy vé mới.', t.id); return; }
    // Binding check: IP subnet / sub hash
    const bind = verifyTicketBinding(t, req);
    if (!bind.ok) { errPage(res, 403, 'Vé gắn với máy khác', 'Vé này được cấp cho máy/mạng khác (' + (bind.reason || 'không khớp') + '). Hãy bấm nút Tải lại trên chính máy này để lấy vé mới.', t.id); return; }
    const games = loadGames();
    const g = games.find((x) => x && x.id === t.id);
    if (!g) { errPage(res, 404, 'Không tìm thấy game', 'Game này có thể đã bị xóa hoặc đổi tên.', null); return; }
    const gate = (g.gate && g.gate.type && g.gate.type !== 'none') ? g.gate : null;
    if (gateHash(gate || { type: 'none' }) !== t.gh) {
      res.statusCode = 302;
      res.setHeader('Location', `${siteOf(req)}/game/${encodeURIComponent(t.id)}.html?locked=1`);
      res.end();
      return;
    }
    const resList = Array.isArray(g.res) ? g.res : [];
    if (resList.indexOf(t.res) < 0) { errPage(res, 400, 'Bản tải không hợp lệ', 'Phiên bản bạn chọn không còn tồn tại.', t.id); return; }
    await finishDl(req, res, g, t.res);
    return;
  }
  // --- Luồng cũ: ?id=&res=[&proof=] (giữ tương thích, vẫn kiểm khóa) ---
  const id = String((q.id || q.game) || '').slice(0, 120);
  const resName = String(q.res || '').slice(0, 16);
  if (!/^[a-z0-9][a-z0-9\-]{0,119}$/i.test(id)) { errPage(res, 400, 'Link không hợp lệ', 'Địa chỉ tải sai định dạng.', null); return; }
  if (!await check({ ip: ipOf(req), route: 'dl', limit: 30, windowS: 60 })) { errPage(res, 429, 'Bấm nhanh quá', 'Bạn thao tác quá nhanh, chờ khoảng 1 phút rồi thử lại nhé.', id); return; }
  if (!await check({ ip: ipOf(req), route: 'dl-day', limit: 300, windowS: 86400 })) { errPage(res, 429, 'Hết lượt trong ngày', 'Máy này đã tải quá nhiều hôm nay, mai quay lại nhé.', id); return; }
  const games = loadGames();
  const g = games.find((x) => x && x.id === id);
  if (!g) { errPage(res, 404, 'Không tìm thấy game', 'Game này có thể đã bị xóa hoặc đổi tên.', null); return; }
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
  if (!target) { errPage(res, 404, 'Chưa có link', 'Bản này chưa có link tải, admin đang cập nhật.', g.id); return; }
  let host = '', urlObj = null;
  try { urlObj = new URL(target); host = urlObj.hostname.toLowerCase(); } catch { errPage(res, 500, 'Lỗi link tải', 'Link tải bị lỗi, hãy báo admin kiểm tra lại.', g.id); return; }
  // Strict validation: https only, no credentials, exact host match
  if (urlObj.protocol !== 'https:') { errPage(res, 500, 'Lỗi link tải', 'Link tải không an toàn, hãy báo admin kiểm tra lại.', g.id); return; }
  if (urlObj.username || urlObj.password) { errPage(res, 500, 'Lỗi link tải', 'Link tải bị lỗi, hãy báo admin kiểm tra lại.', g.id); return; }
  // No fallback to first entry if resName mismatch — must be exact
  if (g.jar && typeof g.jar === 'object' && g.jar[resName] == null) { errPage(res, 400, 'Bản tải không hợp lệ', 'Phiên bản bạn chọn không còn tồn tại.', g.id); return; }
  if (!ALLOW_HOSTS.has(host)) {
    // Host lạ: không redirect thẳng, đưa qua trang cảnh báo go.html bằng vé mới
    // (vé giữ nguyên hiệu lực, không lộ URL).
    try {
      let gate2 = (g.gate && g.gate.type && g.gate.type !== 'none') ? g.gate : null;
      if (!gate2) gate2 = { type: 'stats', require: { read: Math.max(1, Math.min(3600, parseInt(g.read_secs,10)||10)) } };
      const cid = String(req.headers['x-guest-cid'] || (req.query && req.query.cid) || '').slice(0,64);
      const t = mintTicket(g.id, resName, gate2, 0, { ip: ipOf(req), cid });
      res.statusCode = 302;
      res.setHeader('Location', `${siteOf(req)}/go.html?ticket=${encodeURIComponent(t.ticket)}`);
      res.end();
      return;
    } catch { errPage(res, 500, 'Lỗi hệ thống', 'Có lỗi xảy ra, thử lại sau ít phút nhé.', g.id); return; }
  }
  try { await countDl(g.id); } catch {}
  res.statusCode = 302;
  res.setHeader('Location', target);
  res.setHeader('Cache-Control', 'no-store');
  res.end();
}
