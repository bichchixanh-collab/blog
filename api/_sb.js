// api/_sb.js — Supabase phía server cho khóa tải CỨNG (người đã đăng nhập).
// - verifySbToken: kiểm HS256 JWT bằng SUPABASE_JWT_SECRET -> {uid,email} | null.
//   Sai chữ ký/hết hạn/thiếu secret đều null → caller rớt về khóa mềm (khách).
// - Service-role REST (SUPABASE_SERVICE_KEY, không bao giờ lộ client) đọc/ghi
//   bảng public.user_stats (xem supabase-gating.sql).
const crypto = require('crypto');
const { isoWeek } = require('./_bingo');

const SB_URL = (process.env.SUPABASE_URL || 'https://pmotbltodyyilarnvtpn.supabase.co').replace(/\/$/, '');
function jwtSecret() {
  const s = String(process.env.SUPABASE_JWT_SECRET || '').trim();
  return s.length >= 16 ? s : null;
}
function serviceKey() {
  const s = String(process.env.SUPABASE_SERVICE_KEY || '').trim();
  return s.length >= 20 ? s : null;
}
function b64uJson(part) {
  try {
    return JSON.parse(Buffer.from(String(part).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
  } catch { return null; }
}
function bearerToken(req) {
  try {
    const h = (req.headers && (req.headers.authorization || req.headers.Authorization)) || '';
    const m = String(h).match(/^Bearer\s+(.+)$/i);
    return m ? m[1].trim().slice(0, 2000) : '';
  } catch { return ''; }
}
function verifySbToken(token) {
  try {
    const s = jwtSecret();
    if (!s || !token || typeof token !== 'string') return null;
    const p = token.split('.');
    if (p.length !== 3) return null;
    const h = p[0], b = p[1], sig = p[2];
    const head = b64uJson(h);
    if (!head || String(head.alg || '').toUpperCase() !== 'HS256') return null;
    const want = crypto.createHmac('sha256', s).update(`${h}.${b}`, 'utf8').digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const a = Buffer.from(sig, 'utf8'), c = Buffer.from(want, 'utf8');
    if (a.length !== c.length || !crypto.timingSafeEqual(a, c)) return null;
    const body = b64uJson(b);
    if (!body || !body.sub) return null;
    if (typeof body.exp === 'number' && Date.now() / 1000 > body.exp + 30) return null;
    return { uid: String(body.sub), email: body.email || '' };
  } catch { return null; }
}
// Bản async: thử HS256 trước (nhanh, sync), rớt mới thử ES256 qua JWKS của
// Supabase (project mới ký ES256 — không cần thêm lib, dùng crypto có sẵn).
let _jwksCache = { at: 0, keys: null };
// Chẩn đoán lần verify gần nhất (không chứa secret/token — an toàn trả về client khi cần).
let _lastDbg = {};
function dbgSet(o) { try { _lastDbg = o || {}; } catch (e) {} }
function getLastAuthDbg() { try { return Object.assign({}, _lastDbg); } catch (e) { return {}; } }
async function getJwks() {
  const now = Date.now();
  if (_jwksCache.keys && _jwksCache.keys.length && now - _jwksCache.at < 10 * 60 * 1000) return _jwksCache.keys;
  let sig;
  try { sig = (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) ? AbortSignal.timeout(8000) : undefined; } catch (e) { sig = undefined; }
  const r = await fetch(`${SB_URL}/auth/v1/.well-known/jwks.json`, sig ? { signal: sig } : {});
  if (!r.ok) throw new Error(`jwks ${r.status}`);
  const j = await r.json().catch(() => null);
  const keys = (j && Array.isArray(j.keys)) ? j.keys.filter((k) => k && k.kty === 'EC' && typeof k.x === 'string' && typeof k.y === 'string') : [];
  if (!keys.length) throw new Error('jwks empty');
  _jwksCache = { at: now, keys };
  return keys;
}
function b64ToBuf(u) {
  try { return Buffer.from(String(u || '').replace(/-/g, '+').replace(/_/g, '/'), 'base64'); }
  catch (e) { return null; }
}
async function verifyEs256(h, b, sig, head) {
  try {
    let keys = [];
    try { keys = await getJwks(); }
    catch (e) { dbgSet({ step: 'jwks-fetch-fail' }); return false; }
    if (!keys.length) { dbgSet({ step: 'jwks-empty' }); return false; }
    const kid = head && head.kid;
    const data = Buffer.from(`${h}.${b}`, 'utf8');
    const sigBuf = b64ToBuf(sig);
    if (!sigBuf) { dbgSet({ step: 'bad-sig-enc' }); return false; }
    // Lọc theo kid; nếu kid lạ (vừa xoay khóa) thì thử hết để tự phục hồi.
    let list = kid ? keys.filter((k) => k && k.kid === kid) : keys;
    if (!list.length) { dbgSet({ step: 'unknown-kid', kid: kid || '', nkeys: keys.length }); list = keys; }
    for (const k of list) {
      try {
        if (!k || k.kty !== 'EC') continue;
        // Chỉ đưa 4 trường chuẩn cho createPublicKey (bỏ alg/use/key_ops/ext/kid).
        // Chữ ký JWS là raw R||S nên verify phải dùng dsaEncoding ieee-p1363
        // (mặc định của Node là DER — để mặc định là rớt hết token ES256 thật).
        const pub = crypto.createPublicKey({ key: { kty: 'EC', crv: k.crv, x: k.x, y: k.y }, format: 'jwk' });
        if (crypto.verify('sha256', data, { key: pub, dsaEncoding: 'ieee-p1363' }, sigBuf)) return true;
      } catch (e) {}
    }
    dbgSet({ step: 'bad-sig', kid: kid || '', nkeys: keys.length });
  } catch (e) { dbgSet({ step: 'exception' }); }
  return false;
}
async function verifySbTokenAsync(token) {
  try {
    const fast = verifySbToken(token);
    if (fast) { dbgSet({ step: 'hs256-ok' }); return fast; }
    if (!token || typeof token !== 'string') { dbgSet({ step: 'no-token' }); return null; }
    const p = token.split('.');
    if (p.length !== 3) { dbgSet({ step: 'bad-shape' }); return null; }
    const head = b64uJson(p[0]);
    if (!head || String(head.alg || '').toUpperCase() !== 'ES256') { dbgSet({ step: 'alg-unsupported', alg: (head && head.alg) || '' }); return null; }
    const ok = await verifyEs256(p[0], p[1], p[2], head);
    if (!ok) return null; // verifyEs256 đã ghi dbg chi tiết (jwks-fail / unknown-kid / bad-sig)
    const body = b64uJson(p[1]);
    if (!body || !body.sub) { dbgSet({ step: 'no-sub' }); return null; }
    if (typeof body.exp === 'number' && Date.now() / 1000 > body.exp + 30) { dbgSet({ step: 'expired' }); return null; }
    dbgSet({ step: 'es256-ok', kid: head.kid || '' });
    return { uid: String(body.sub), email: body.email || '' };
  } catch { dbgSet({ step: 'exception' }); return null; }
}
async function sbFetch(path, opts) {
  const key = serviceKey();
  if (!key) throw new Error('no service key');
  const r = await fetch(`${SB_URL}${path}`, Object.assign({
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
  }, opts || {}));
  const text = await r.text().catch(() => '');
  let j = null;
  try { j = text ? JSON.parse(text) : null; } catch { j = null; }
  return { status: r.status, json: j };
}
function cleanStats(row) {
  const bingo = (row && row.bingo && typeof row.bingo === 'object' && !Array.isArray(row.bingo)) ? row.bingo : {};
  const cleanBingo = {};
  for (const w of Object.keys(bingo).slice(0, 12)) {
    if (!/^\d{4}-W\d{2}$/.test(w)) continue;
    const cell = bingo[w];
    if (cell && typeof cell === 'object') {
      cleanBingo[w] = {};
      for (const k of Object.keys(cell).slice(0, 24)) {
        if (/^[a-z0-9_]{1,24}$/i.test(k)) cleanBingo[w][k] = 1;
      }
    }
  }
  return {
    minutes: Math.max(0, parseInt((row && row.minutes) || 0, 10) || 0),
    likes: Array.isArray(row && row.likes) ? row.likes.filter((x) => typeof x === 'string').slice(0, 500) : [],
    completed: Array.isArray(row && row.completed) ? row.completed.filter((x) => typeof x === 'string').slice(0, 500) : [],
    bingo: cleanBingo,
    pet_xp: Math.max(0, parseInt((row && row.pet_xp) || 0, 10) || 0),
    updated_at: (row && row.updated_at) || null,
  };
}
// Đọc bảng senpai có sẵn (xp + data blob) để kiểm cứng gate xp/badge.
async function getSenpai(uid) {
  try {
    const r = await sbFetch(`/rest/v1/senpai?user_id=eq.${encodeURIComponent(uid)}&select=xp,data`);
    if (r.status === 200 && Array.isArray(r.json) && r.json.length) {
      const row = r.json[0] || {};
      const data = (row.data && typeof row.data === 'object') ? row.data : {};
      const badges = (data.gacha && Array.isArray(data.gacha.badges)) ? data.gacha.badges.filter((x) => typeof x === 'string') : [];
      return { xp: Math.max(0, parseInt(row.xp, 10) || 0), badges };
    }
    if (r.status === 200 || r.status === 404 || r.status === 406) return { xp: 0, badges: [] };
    return null;
  } catch { return null; }
}
// Đọc stats của uid. Thiếu hàng -> zeros. Lỗi hạ tầng -> null (caller rớt mềm).
async function getUserStats(uid) {
  try {
    const r = await sbFetch(`/rest/v1/user_stats?uid=eq.${encodeURIComponent(uid)}&select=minutes,likes,completed,updated_at`);
    if (r.status === 200 && Array.isArray(r.json) && r.json.length) return cleanStats(r.json[0]);
    if (r.status === 200 || r.status === 404 || r.status === 406) return cleanStats(null);
    return null;
  } catch { return null; }
}
// Ghi event. Heartbeat chỉ +1 phút nếu lần ghi trước cách ≥50s (chống farm).
// Trả về stats mới, hoặc null khi lỗi.
async function eventUserStats(uid, ev) {
  try {
    const cur = await getUserStats(uid);
    if (!cur) return null;
    const now = new Date().toISOString();
    let { minutes, likes, completed, bingo, pet_xp } = cur;
    const t = ev && ev.t;
    if (t === 'heartbeat') {
      const last = Date.parse(cur.updated_at || '') || 0;
      if (Date.now() - last < 50000) return cur; // quá nhanh, giữ nguyên
      minutes += 1;
    } else if (t === 'like' || t === 'unlike' || t === 'complete' || t === 'uncomplete') {
      const id = String((ev && ev.id) || '').slice(0, 120);
      if (!/^[a-z0-9][a-z0-9\-]{0,119}$/i.test(id)) return cur;
      const arr = (t === 'like' || t === 'unlike') ? likes : completed;
      const at = arr.indexOf(id);
      if ((t === 'like' || t === 'complete') && at < 0) arr.push(id);
      if ((t === 'unlike' || t === 'uncomplete') && at >= 0) arr.splice(at, 1);
      if (t === 'like' || t === 'unlike') likes = arr.slice(-500); else completed = arr.slice(-500);
    } else if (t === 'bingo') {
      // Hợp nhất ô bingo đã đánh (idempotent): {week:{actionId:1}}.
      // Thiếu week hợp lệ thì dùng tuần hiện tại (server UTC, xem _bingo).
      let w = String((ev && ev.week) || '').slice(0, 8);
      if (!/^\d{4}-W\d{2}$/.test(w)) w = isoWeek(new Date());
      const ids = Array.isArray(ev && ev.ids) ? ev.ids : ((ev && ev.id) ? [ev.id] : []);
      if (!/^\d{4}-W\d{2}$/.test(w)) return cur;
      const set = Object.assign({}, bingo[w] || {});
      for (const raw of ids.slice(0, 24)) {
        const k = String(raw || '');
        if (/^[a-z0-9_]{1,24}$/i.test(k)) set[k] = 1;
      }
      bingo = Object.assign({}, bingo, { [w]: set });
    } else if (t === 'petxp') {
      // EXP pet chỉ tăng (max-merge, chống ghi đè ngược)
      const v = Math.max(0, Math.min(10000000, parseInt(ev && ev.exp, 10) || 0));
      if (v > pet_xp) pet_xp = v;
    } else {
      return cur;
    }
    const body = { uid, minutes, likes, completed, bingo, pet_xp, updated_at: now };
    const r = await sbFetch('/rest/v1/user_stats?on_conflict=uid', {
      method: 'POST',
      headers: { apikey: serviceKey(), Authorization: `Bearer ${serviceKey()}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify(body),
    });
    if (r.status === 200 || r.status === 201 || r.status === 204) return { minutes, likes, completed, bingo, pet_xp, updated_at: now };
    return null;
  } catch { return null; }
}
module.exports = { SB_URL, jwtSecret, serviceKey, bearerToken, verifySbToken, verifySbTokenAsync, getLastAuthDbg, getUserStats, getSenpai, eventUserStats };
