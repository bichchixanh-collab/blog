// api/_rate.js — rate-limit dùng Upstash Redis làm nguồn sự thật (bền qua cold-start).
// Không có Upstash: fallback memory CHỈ dùng khi thật sự không cấu hình (dev/local),
// và log cảnh báo mỗi cold-start để lỗi cấu hình prod không bị im lặng.
// Lỗi mạng/timeout gọi Upstash: fail-closed có giới hạn (KHÔNG tự cho qua vô hạn) —
// coi như "không rõ trạng thái" nên áp một trần cứng thấp thay vì bỏ qua rate-limit.
const mem = new Map();
let upstash = null;
try {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    upstash = { url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN };
  }
} catch {}
if (!upstash) {
  // In ra mỗi lần cold-start — nếu thấy dòng này trong log prod thì rate-limit
  // đang KHÔNG bền, cần bật UPSTASH_REDIS_REST_URL/TOKEN ngay.
  try { console.warn('[rate-limit] UPSTASH chưa cấu hình — dùng memory fallback, KHÔNG bền qua cold-start.'); } catch {}
}

function timeoutSignal(ms) {
  try { if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) return AbortSignal.timeout(ms); } catch {}
  return undefined;
}

async function upstashIncr(key, windowS) {
  const r = await fetch(`${upstash.url}/pipeline`, {
    method: 'POST', signal: timeoutSignal(3000),
    headers: { Authorization: `Bearer ${upstash.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([['INCR', key], ['EXPIRE', key, windowS]]),
  });
  if (!r.ok) throw new Error('upstash http ' + r.status);
  const j = await r.json();
  if (!Array.isArray(j) || typeof j[0]?.result !== 'number') throw new Error('upstash bad response');
  return j[0].result;
}

function memCheck(key, limit, windowMs) {
  const now = Date.now();
  let arr = mem.get(key) || [];
  arr = arr.filter((t) => now - t < windowMs);
  if (arr.length >= limit) { mem.set(key, arr); return false; }
  arr.push(now);
  if (mem.size > 3000) mem.clear();
  mem.set(key, arr);
  return true;
}

async function check({ ip, route, limit, windowS }) {
  const key = `rl:${route}:${ip}`;

  if (upstash) {
    try {
      const n = await upstashIncr(key, windowS);
      return n <= limit;
    } catch (e) {
      // Upstash lỗi tạm thời (timeout/5xx): KHÔNG cho qua vô hạn — fail-closed
      // bằng một trần cứng, thấp hơn nhiều so với limit gốc, trong bộ nhớ cục bộ.
      // Vẫn chặn được burst trong lúc Upstash gián đoạn, không mở toang endpoint.
      try { console.error('[rate-limit] Upstash lỗi, fallback trần cứng:', e && e.message); } catch {}
      const HARD_CAP = Math.max(1, Math.ceil(limit / 3));
      return memCheck('degraded|' + key, HARD_CAP, windowS * 1000);
    }
  }

  // Không cấu hình Upstash: memory fallback bình thường (đủ cho dev/local;
  // KHÔNG khuyến nghị cho prod nhiều instance/cold-start — xem warning ở trên).
  return memCheck(key, limit, windowS * 1000);
}

function ipOf(req) {
  const f = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || '';
  return String(f).split(',')[0].trim() || (req.socket && req.socket.remoteAddress) || 'unknown';
}

module.exports = { check, ipOf, usingUpstash: () => !!upstash };
