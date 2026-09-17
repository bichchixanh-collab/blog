// api/_lock.js — dùng chung cho khóa tải: vé HMAC, mã hóa URL, proof mở rộng.
// Không tài khoản nên stats local (phút online/like/phá đảo) chỉ tin ở mức
// "khóa mềm" như bingo line hiện tại; riêng bình luận duyệt được server đếm chéo.
// Cần LOCK_SECRET (Vercel env + local admin) để vé/URL mã hóa chống giả thật sự;
// thiếu secret vẫn chạy ở chế độ mềm (vé ký khóa mặc định, URL plaintext).
const crypto = require('crypto');

function lockSecret() {
  const s = process.env.LOCK_SECRET || '';
  return s.length >= 16 ? s : null;
}
function hkey(purpose) {
  const s = lockSecret();
  const raw = s ? `${s}|${purpose}` : `j2me-lock-fallback|${purpose}`;
  return crypto.createHash('sha256').update(raw, 'utf8').digest();
}
function b64uEncode(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64uDecode(str) {
  try {
    const b64 = String(str).replace(/-/g, '+').replace(/_/g, '/');
    return Buffer.from(b64, 'base64');
  } catch { return null; }
}
function stableGate(gate) {
  try { return JSON.stringify(gate || { type: 'none' }); } catch { return '{"type":"none"}'; }
}
function gateHash(gate) {
  return crypto.createHash('sha256').update(stableGate(gate), 'utf8').digest('hex').slice(0, 16);
}
// Vé tải: {v,id,res,day,exp,gh} + HMAC. Hết hạn 15 phút, ràng buộc đúng gate lúc cấp.
const TICKET_TTL_MS = 15 * 60 * 1000;
function mintTicket(id, res, gate, hard) {
  const now = Date.now();
  const day = new Date(now).toISOString().slice(0, 10);
  const payload = { v: 1, id: String(id).slice(0, 120), res: String(res).slice(0, 16), day, exp: now + TICKET_TTL_MS, gh: gateHash(gate), hard: hard ? 1 : 0 };
  const body = b64uEncode(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', hkey('ticket')).update(body, 'utf8').digest('hex');
  return { ticket: `${body}.${sig}`, exp: payload.exp };
}
function verifyTicket(ticket) {
  try {
    if (!ticket || typeof ticket !== 'string') return null;
    const parts = ticket.split('.');
    if (parts.length !== 2) return null;
    const [body, sig] = parts;
    const want = crypto.createHmac('sha256', hkey('ticket')).update(body, 'utf8').digest('hex');
    const a = Buffer.from(String(sig).toLowerCase(), 'utf8');
    const b = Buffer.from(want, 'utf8');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const raw = b64uDecode(body);
    if (!raw) return null;
    const o = JSON.parse(raw.toString('utf8'));
    if (!o || o.v !== 1 || !o.id || !o.res || typeof o.exp !== 'number') return null;
    if (Date.now() > o.exp) return null;
    return o;
  } catch { return null; }
}
// Giải mã URL file: định dạng ENC:<base64 iv12|cipher|tag16>, AES-256-GCM, AAD=game id.
// Trả về null nếu không phải ENC: hoặc giải mã thất bại.
function decryptUrl(stored, gameId) {
  try {
    if (!stored || typeof stored !== 'string' || !stored.startsWith('ENC:')) return null;
    const s = lockSecret();
    if (!s) return null;
    const key = crypto.createHash('sha256').update(s, 'utf8').digest();
    const blob = b64uDecode(stored.slice(4));
    if (!blob || blob.length < 12 + 16 + 1) return null;
    const iv = blob.subarray(0, 12);
    const tag = blob.subarray(blob.length - 16);
    const ct = blob.subarray(12, blob.length - 16);
    const dec = crypto.createDecipheriv('aes-256-gcm', key, iv);
    dec.setAAD(Buffer.from(String(gameId), 'utf8'));
    dec.setAuthTag(tag);
    const url = Buffer.concat([dec.update(ct), dec.final()]).toString('utf8');
    return /^https?:\/\//i.test(url) ? url : null;
  } catch { return null; }
}
// Lấy URL thật của 1 res: ưu tiên ENC:, rớt xuống plaintext (di trú dần).
function resolveJarUrl(jar, resName, gameId) {
  const all = jar && typeof jar === 'object' ? jar : {};
  const stored = all[resName] != null ? all[resName] : Object.values(all)[0];
  if (typeof stored !== 'string' || !stored || stored === '#') return null;
  if (stored.startsWith('ENC:')) return decryptUrl(stored, gameId);
  return /^https?:\/\//i.test(stored) ? stored : null;
}
// Kiểm tra proof client ký (tương thích proof cũ {id,day,lines} + proof mới có st).
// Trả về {ok, reason}.
// - serverStats != null: KHÓA CỨNG — dùng số server-side theo tài khoản, bỏ qua tự khai.
// - serverStats == null: khóa mềm (số local + đếm bình luận chéo theo tên).
async function checkProofExtended(p, id, gate, countApproved, serverStats, authed) {
  try {
    if (!p) return { ok: false, reason: 'missing proof' };
    const raw = b64uDecode(p);
    if (!raw) return { ok: false, reason: 'bad proof' };
    const o = JSON.parse(raw.toString('utf8'));
    if (!o || o.id !== id || typeof o.day !== 'string') return { ok: false, reason: 'bad proof' };
    const dayMs = Date.parse(`${o.day}T00:00:00Z`);
    if (Number.isNaN(dayMs)) return { ok: false, reason: 'bad proof' };
    if (Math.abs(Date.now() - dayMs) > 2 * 864e5) return { ok: false, reason: 'stale proof' };
    const type = gate && gate.type;
    // Chỉ bắt đăng nhập: chỉ pass khi caller đã xác thực token (authed), fail-closed
    if (type === 'login') return authed ? { ok: true, hard: true } : { ok: false, reason: 'login required' };
    if (serverStats) {
      // KHÓA CỨNG mọi loại gate khi có số server-side theo tài khoản
      if (type === 'bingo') {
        const need = Math.max(1, parseInt(gate.lines || 1, 10) || 1);
        if (!(serverStats.bingoLines >= need)) return { ok: false, reason: 'bingo lines' };
        return { ok: true, hard: true };
      }
      if (type === 'pet') {
        const need = Math.max(1, parseInt(gate.level || 3, 10) || 3);
        if (!(serverStats.petLv >= need)) return { ok: false, reason: 'pet level' };
        return { ok: true, hard: true };
      }
      if (type === 'badge') {
        if (!serverStats.badges) return { ok: false, reason: 'badge' };
        return { ok: true, hard: true };
      }
      if (type === 'xp') {
        const need = Math.max(1, parseInt(gate.xp || 100, 10) || 100);
        if (!(serverStats.xp >= need)) return { ok: false, reason: 'xp' };
        return { ok: true, hard: true };
      }
    }
    if (type === 'bingo') {
      const need = Math.max(1, parseInt(gate.lines || 1, 10) || 1);
      if (!(o.lines >= need)) return { ok: false, reason: 'bingo lines' };
    }
    if (type === 'stats') {
      const rq = (gate && gate.require) || {};
      if (serverStats) {
        if (rq.minutes != null && !(serverStats.min >= rq.minutes)) return { ok: false, reason: 'minutes' };
        if (rq.likes != null && !(serverStats.likes >= rq.likes)) return { ok: false, reason: 'likes' };
        if (rq.completed != null && !(serverStats.done >= rq.completed)) return { ok: false, reason: 'completed' };
        if (rq.comments != null && !(serverStats.approved >= rq.comments)) return { ok: false, reason: 'comments' };
        return { ok: true, hard: true };
      }
      const st = (o && o.st) || {};
      const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : -1);
      if (rq.minutes != null && !(num(st.min) >= rq.minutes)) return { ok: false, reason: 'minutes' };
      if (rq.likes != null && !(num(st.likes) >= rq.likes)) return { ok: false, reason: 'likes' };
      if (rq.completed != null && !(num(st.done) >= rq.completed)) return { ok: false, reason: 'completed' };
      if (rq.comments != null) {
        const names = Array.isArray(st.names) ? st.names.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 5) : [];
        if (!names.length) return { ok: false, reason: 'comments' };
        let n = -1;
        try { n = await countApproved(names); } catch { n = -1; }
        if (!(n >= rq.comments)) return { ok: false, reason: 'comments' };
      }
    }
    return { ok: true };
  } catch { return { ok: false, reason: 'bad proof' }; }
}
module.exports = { lockSecret, hkey, b64uEncode, b64uDecode, gateHash, stableGate, mintTicket, verifyTicket, decryptUrl, resolveJarUrl, checkProofExtended, TICKET_TTL_MS };
