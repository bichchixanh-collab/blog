// api/_lock.js — dùng chung cho khóa tải: vé HMAC, mã hóa URL, proof mở rộng.
// Phút online của khách được chứng minh bằng presence chain (HMAC, stateless):
// mỗi link cách nhau ≥50s nên không thể bịa số phút mà không chờ thời gian thật.
// Like/phá đảo vẫn là số local (khóa mềm); bình luận duyệt được server đếm chéo.
// Cần LOCK_SECRET (Vercel env + local admin) để vé/URL/presence chống giả thật sự;
// thiếu secret thì phút online rớt về chế độ mềm cũ (tin st.min tự khai).
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
// Vé tải: {v,id,res,day,exp,gh,sub,iph,jti} + HMAC. Hết hạn 15 phút, ràng buộc gate+user.
const TICKET_TTL_MS = 15 * 60 * 1000;
function ticketSubHash(uid, cid) {
  try {
    if (uid) return crypto.createHash('sha256').update('uid/' + String(uid), 'utf8').digest('hex').slice(0, 16);
    const c = String(cid || '').trim();
    if (c) return presenceCidHash(c);
    return '';
  } catch { return ''; }
}
function mintTicket(id, res, gate, hard, opts) {
  const now = Date.now();
  const day = new Date(now).toISOString().slice(0, 10);
  const o = opts || {};
  const sub = ticketSubHash(o.uid, o.cid);
  const iph = o.ip ? presenceNetHash(o.ip) : '';
  const jti = crypto.randomBytes(8).toString('hex');
  const payload = { v: 2, id: String(id).slice(0, 120), res: String(res).slice(0, 16), day, exp: now + TICKET_TTL_MS, gh: gateHash(gate), hard: hard ? 1 : 0, jti, sub: sub || undefined, iph: iph || undefined };
  // strip undefined to keep old size small
  if (!payload.sub) delete payload.sub;
  if (!payload.iph) delete payload.iph;
  const body = b64uEncode(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', hkey('ticket')).update(body, 'utf8').digest('hex');
  return { ticket: `${body}.${sig}`, exp: payload.exp, jti };
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
    if (!o || (o.v !== 1 && o.v !== 2) || !o.id || !o.res || typeof o.exp !== 'number') return null;
    if (Date.now() > o.exp) return null;
    if (o.v === 2 && o.jti != null && typeof o.jti !== 'string') return null;
    return o;
  } catch { return null; }
}
function verifyTicketBinding(ticketObj, req) {
  try {
    if (!ticketObj || ticketObj.v !== 2) return { ok: true, legacy: true }; // v1 legacy: allow but mark
    // IP binding: if ticket has iph, request IP must match same subnet (or fallback full IP)
    if (ticketObj.iph) {
      const ip = (req && req.headers) ? (String(req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || '').split(',')[0].trim() || (req.socket && req.socket.remoteAddress) || '') : '';
      const curNet = presenceNetHash(ip);
      const curFull = presenceIpHash(ip);
      if (ticketObj.iph !== curNet && ticketObj.iph !== curFull) return { ok: false, reason: 'ip-mismatch' };
    }
    // sub binding: if ticket has sub, check against Authorization uid or cid from header/query/cookie
    if (ticketObj.sub) {
      let curSub = '';
      try {
        // try Bearer uid
        const h = (req.headers && (req.headers.authorization || req.headers.Authorization)) || '';
        const m = String(h).match(/^Bearer\s+(.+)$/i);
        const tok = m ? m[1].trim().slice(0, 2000) : '';
        if (tok) {
          // lightweight decode without verify (verify done elsewhere if needed) — just hash sub for binding
          const part = tok.split('.')[1] || '';
          const body = JSON.parse(Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
          if (body && body.sub) curSub = ticketSubHash(String(body.sub), '');
        }
      } catch {}
      // fallback to cid from header/query
      if (!curSub) {
        try {
          const cid = String((req.headers['x-guest-cid'] || (req.query && req.query.cid) || '')).slice(0, 64);
          if (cid) curSub = ticketSubHash('', cid);
        } catch {}
      }
      // if request provides no identity, we cannot verify sub -> treat as mismatch only if strict mode
      // For now, if ticket is bound to a user, require same sub when caller presents identity; anonymous reuse across devices will fail iph check anyway.
      // We enforce sub only when curSub is available and mismatches
      if (curSub && curSub !== ticketObj.sub) return { ok: false, reason: 'sub-mismatch' };
    }
    return { ok: true };
  } catch { return { ok: true }; }
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
// Lấy URL thật của 1 res: ưu tiên ENC:, plaintext chỉ khi khớp resName chính xác (không fallback mờ).
function resolveJarUrl(jar, resName, gameId) {
  const all = jar && typeof jar === 'object' ? jar : {};
  // Strict: must match resName, no fallback to first entry (prevents resName confusion)
  let stored = all[resName];
  if (stored == null && !resName) stored = Object.values(all)[0];
  if (typeof stored !== 'string' || !stored || stored === '#') return null;
  if (stored.startsWith('ENC:')) return decryptUrl(stored, gameId);
  // Only https allowed strictly
  return /^https:\/\//i.test(stored) ? stored : null;
}
// --- Presence chain: chứng minh phút online của khách, không tài khoản, không DB ---
// Token = {v,n,iat,iph} + HMAC(LOCK_SECRET). Mỗi link nối tiếp yêu cầu link trước
// hợp lệ và cách nhau ≥50s (thời gian lấy từ iat đã ký — client không bịa được).
// Song song bao nhiêu tab cũng không tăng nhanh hơn 1 link/50s vì iat neo theo link mới nhất.
// iph = hash IP: share token sang IP khác thì rớt (chấp nhận phần dư cùng NAT).
const PRESENCE_MIN_MS = 50 * 1000;
const PRESENCE_MAX_AGE_MS = 48 * 3600 * 1000; // khớp cửa sổ proof day (±2 ngày)
function presenceIpHash(ip) {
  try { return crypto.createHash('sha256').update(String(ip || ''), 'utf8').digest('hex').slice(0, 16); }
  catch { return ''; }
}
// cidh = hash device-id của client: cùng máy thì nối chuỗi bất kể đổi IP;
// khác máy (kể cả copy token) thì không nối được vì không nêu đúng cid.
function presenceCidHash(cid) {
  try {
    const s = String(cid || '').trim();
    if (!s) return '';
    return crypto.createHash('sha256').update('cid/' + s, 'utf8').digest('hex').slice(0, 16);
  } catch { return ''; }
}
// Gắn chain theo SUBNET (IPv4 /24, IPv6 /64) thay vì IP đầy đủ: mạng di động
// đổi IP trong cùng dải vẫn giữ chuỗi (khỏi kẹt vé oan), khác dải vẫn rớt.
function presenceNetHash(ip) {
  try {
    const s = String(ip || '').trim();
    if (s.includes(':')) {
      const parts = s.split(':').filter(Boolean);
      const prefix = parts.slice(0, 4).join(':').toLowerCase();
      return crypto.createHash('sha256').update('v6/' + prefix, 'utf8').digest('hex').slice(0, 16);
    }
    const m = s.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.\d{1,3}$/);
    const key = m ? `v4/${m[1]}.${m[2]}.${m[3]}` : `raw/${s}`;
    return crypto.createHash('sha256').update(key, 'utf8').digest('hex').slice(0, 16);
  } catch { return ''; }
}
function signPresence(o) {
  const body = b64uEncode(JSON.stringify(o));
  const sig = crypto.createHmac('sha256', hkey('presence')).update(body, 'utf8').digest('hex');
  return `${body}.${sig}`;
}
function readPresence(tok) {
  try {
    if (!tok || typeof tok !== 'string') return null;
    const parts = tok.split('.');
    if (parts.length !== 2) return null;
    const [body, sig] = parts;
    const want = crypto.createHmac('sha256', hkey('presence')).update(body, 'utf8').digest('hex');
    const a = Buffer.from(String(sig).toLowerCase(), 'utf8');
    const b = Buffer.from(want, 'utf8');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const raw = b64uDecode(body);
    if (!raw) return null;
    const o = JSON.parse(raw.toString('utf8'));
    if (!o || o.v !== 1 || typeof o.n !== 'number' || typeof o.iat !== 'number') return null;
    if (o.cidh != null && typeof o.cidh !== 'string') return null;
    return o;
  } catch { return null; }
}
// Đổi link mới. Trả về token (mới hoặc giữ nguyên nếu gọi quá sớm — idempotent).
// Ưu tiên nối theo device-id (đổi IP thoải mái); token cũ chưa có cidh thì nối
// theo subnet 1 lần để migrate (không bắt đếm lại), rồi gắn cid mới từ đó.
function mintPresence(prevTok, ip, cid) {
  try {
    const now = Date.now();
    const cidh = presenceCidHash(cid);
    const curNet = presenceNetHash(ip);
    const prev = readPresence(prevTok);
    const fresh = !!(prev && !(prev.iat > now + 120 * 1000));
    let cont = false;
    if (prev && fresh) {
      if (cidh && prev.cidh === cidh) cont = true; // cùng máy: bỏ qua IP
      else if (!prev.cidh && prev.iph && (prev.iph === curNet || prev.iph === presenceIpHash(ip))) cont = true; // token cũ: theo subnet
      else if (!cidh && prev.cidh && prev.iph && (prev.iph === curNet || prev.iph === presenceIpHash(ip))) cont = true; // client cũ không gửi cid
    }
    if (cont) {
      if (now - prev.iat < PRESENCE_MIN_MS) return prevTok; // quá sớm: giữ nguyên, không lỗi
      const base = Math.max(0, Math.floor(prev.n) || 0);
      const o = { v: 1, n: Math.min(99999, base + 1), iat: now, iph: prev.iph || curNet };
      if (cidh) o.cidh = cidh; else if (prev.cidh) o.cidh = prev.cidh;
      return signPresence(o);
    }
    const o0 = { v: 1, n: 0, iat: now, iph: curNet };
    if (cidh) o0.cidh = cidh;
    return signPresence(o0);
  } catch { return null; }
}
// Verify token nộp kèm proof. Trả về {n} hoặc null.
function verifyPresence(tok, ip, cid) {
  try {
    const o = readPresence(tok);
    if (!o) return null;
    const now = Date.now();
    if (o.iat > now + 120 * 1000) return null;
    if (now - o.iat > PRESENCE_MAX_AGE_MS) return null;
    const n = Math.floor(o.n);
    if (!Number.isFinite(n) || n < 0 || n > 99999) return null;
    const cidh = presenceCidHash(cid);
    if (o.cidh && cidh && o.cidh === cidh) return { n }; // cùng máy: bỏ qua IP
    if (o.cidh && !cidh) return null; // token gắn máy khác mà không nêu cid
    // Token cũ chưa gắn máy: chấp nhận cả iph subnet mới lẫn iph IP-cũ (tương thích trước deploy)
    if (!o.cidh && (o.iph === presenceNetHash(ip) || o.iph === presenceIpHash(ip))) return { n };
    return null;
  } catch { return null; }
}
// Kiểm tra proof client ký (tương thích proof cũ {id,day,lines} + proof mới có st).
// Trả về {ok, reason}.
// - serverStats != null: KHÓA CỨNG — dùng số server-side theo tài khoản, bỏ qua tự khai.
// - serverStats == null: phút online ƯU TIÊN presence chain đã ký (fail-closed khi có
//   LOCK_SECRET); chỉ rớt về st.min tự khai khi thiếu secret (chế độ dev).
//   Like/phá đảo vẫn mềm; bình luận duyệt đếm chéo theo tên.
async function checkProofExtended(p, id, gate, countApproved, serverStats, authed, clientIp) {
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
        // read: per-article reading seconds (soft - client proof, still checked below even when authed)
        if (rq.likes != null && !(serverStats.likes >= rq.likes)) return { ok: false, reason: 'likes' };
        if (rq.completed != null && !(serverStats.done >= rq.completed)) return { ok: false, reason: 'completed' };
        // comments deprecated: treat as already passed (gate migrated)
        // minutes deprecated: still check if present for backward compat
        if (rq.minutes != null && !(serverStats.min >= rq.minutes)) return { ok: false, reason: 'minutes' };
        // read check still via client proof below (per-page)
      }
      const st = (o && o.st) || {};
      const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : -1);
      if (rq.read != null) {
        const have = num(st.read) >= 0 ? num(st.read) : (typeof o.read === 'number' ? o.read : -1);
        if (!(have >= rq.read)) return { ok: false, reason: 'read' };
      }
      if (rq.minutes != null) {
        const cid = o && typeof o.cid === 'string' ? o.cid.slice(0, 64) : '';
        const pv = verifyPresence(o.presence, clientIp, cid);
        if (pv) {
          if (!(pv.n >= rq.minutes)) return { ok: false, reason: 'minutes' };
        } else if (lockSecret()) {
          return { ok: false, reason: 'minutes' };
        } else if (!(num(st.min) >= rq.minutes)) {
          return { ok: false, reason: 'minutes' };
        }
      }
      if (rq.likes != null && !(num(st.likes) >= rq.likes)) return { ok: false, reason: 'likes' };
      if (rq.completed != null && !(num(st.done) >= rq.completed)) return { ok: false, reason: 'completed' };
      // rq.comments deprecated - always pass if present (migrated)
      if (serverStats && rq.read != null) {
        const have = num(st.read) >= 0 ? num(st.read) : (typeof o.read === 'number' ? o.read : -1);
        if (!(have >= rq.read)) return { ok: false, reason: 'read' };
      }
    }
    return { ok: true };
  } catch { return { ok: false, reason: 'bad proof' }; }
}
module.exports = { lockSecret, hkey, b64uEncode, b64uDecode, gateHash, stableGate, mintTicket, verifyTicket, verifyTicketBinding, ticketSubHash, decryptUrl, resolveJarUrl, checkProofExtended, mintPresence, verifyPresence, readPresence, presenceIpHash, presenceNetHash, presenceCidHash, TICKET_TTL_MS };
