// api/_lib.js — dùng chung cho mọi API: CORS same-origin, rate-limit, validate.
function clientIp(req) {
  const f = (req.headers && (req.headers['x-forwarded-for'] || req.headers['x-real-ip'])) || '';
  return String(f).split(',')[0].trim() || (req.socket && req.socket.remoteAddress) || 'unknown';
}
const RATE = new Map();
function hitRate(ip, route, limit, windowMs) {
  const now = Date.now(), key = ip + '|' + route;
  let arr = RATE.get(key) || [];
  arr = arr.filter((t) => now - t < windowMs);
  if (arr.length >= limit) { RATE.set(key, arr); return false; }
  arr.push(now);
  if (RATE.size > 3000) RATE.clear();
  RATE.set(key, arr);
  return true;
}
// Trả về 'same' | 'cross' | 'unverified' (không có Origin/Referer) thay vì true/false.
// KHÔNG coi 'unverified' là hợp lệ mặc định — browser thật luôn gửi Origin cho
// POST cross-site, nên thiếu Origin ở request ghi dữ liệu là dấu hiệu đáng ngờ
// (curl/script) nhiều hơn là "client cũ hợp lệ". Caller tự quyết định xử lý
// 'unverified' thế nào (thường: rate-limit chặt hơn, không chặn cứng để tránh
// false-positive với số ít client WAP/app cũ thật sự không gửi header này).
function originStatus(req) {
  if (req.method === 'GET') return 'same';
  const origin = req.headers.origin || req.headers.referer || '';
  const host = req.headers.host || '';
  if (!origin) return 'unverified';
  try {
    const h = new URL(origin).host;
    return (h === String(host).split(':')[0] || h.endsWith('.vercel.app')) ? 'same' : 'cross';
  } catch { return 'cross'; }
}
// Giữ tên cũ để tương thích ngược, nhưng giờ CHẶN cả 'cross' lẫn không xác định
// được rõ ràng là same-origin — chỉ 'same' mới qua bằng true.
function sameOrigin(req) { return originStatus(req) === 'same'; }
function send(res, code, obj, maxAge = 30) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', `public, max-age=${maxAge}, must-revalidate`);
  if (code === 200 && res.reqMethod === 'GET') res.setHeader('Access-Control-Allow-Origin', '*');
  res.end(JSON.stringify(obj));
}
function isValidId(id) { return /^[a-z0-9][a-z0-9\-]{0,119}$/i.test(String(id || '')); }
module.exports = { clientIp, hitRate, sameOrigin, originStatus, send, isValidId };
