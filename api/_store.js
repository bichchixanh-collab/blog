// api/_store.js — trừu tượng đếm lượt tải: ưu tiên Upstash Redis, gom batch rồi flush GitHub.
// Giải quyết: "mỗi lượt tải = 1 commit GitHub" không scale + conflict khi bấm đồng thời.
const { writeFile, readFile } = require('./_github');
const fs = require('fs'), path = require('path');
const memPending = new Map(); // id -> số lượt chờ flush
let flushing = false, lastFlush = 0;
const _fe = parseInt(process.env.STATS_FLUSH_MS || '', 10);
const FLUSH_EVERY = (Number.isFinite(_fe) && _fe >= 0) ? _fe : 60 * 1000;
function readBundled(f, fb) { try { return JSON.parse(fs.readFileSync(path.join(process.cwd(), f), 'utf-8')); } catch { return fb; } }
function timeoutSignal(ms) {
  try { if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) return AbortSignal.timeout(ms); } catch {}
  return undefined;
}
async function redisIncr(id) {
  const { UPSTASH_REDIS_REST_URL: url, UPSTASH_REDIS_REST_TOKEN: tk } = process.env;
  if (!url || !tk) return null;
  const r = await fetch(`${url}/incr/dl:${id}`, { headers: { Authorization: `Bearer ${tk}` }, signal: timeoutSignal(7000) });
  const j = await r.json().catch(() => ({}));
  return typeof j.result === 'number' ? j.result : null;
}
async function countDl(id) {
  // 1) Redis: xong ngay, không commit
  const v = await redisIncr(id).catch(() => null);
  if (v !== null) return v;
  // 2) Fallback: cộng dồn trong memory, flush 1 commit/phút thay vì 1 commit/lượt
  memPending.set(id, (memPending.get(id) || 0) + 1);
  // PHẢI await: serverless đóng băng ngay sau response, flush nền không await là mất số
  await maybeFlush();
  const base = readBundled('data/stats.json', {});
  const cur = (base[id] && base[id].dl) || 0;
  return cur + (memPending.get(id) || 0);
}
async function maybeFlush() {
  const now = Date.now();
  if (flushing || now - lastFlush < FLUSH_EVERY) return;
  if (!memPending.size) return;
  flushing = true;
  try {
    const snap = new Map(memPending);
    // Đọc bản live trước khi cộng dồn để nhiều instance flush cùng lúc không ghi đè mất số nhau
    let base = readBundled('data/stats.json', {});
    try { const live = await readFile({ file: 'data/stats.json' }); if (live && live.json) base = live.json; } catch {}
    let total = 0;
    for (const [id, n] of snap) {
      if (!base[id] || typeof base[id] !== 'object') base[id] = { dl: 0 };
      base[id].dl = (base[id].dl || 0) + n;
      total += n;
    }
    await writeFile({ file: 'data/stats.json', json: base, message: `[skip ci] stats: batch +${total} downloads` });
    for (const [id, n] of snap) {
      const cur = (memPending.get(id) || 0) - n;
      if (cur > 0) memPending.set(id, cur); else memPending.delete(id);
    }
    lastFlush = Date.now();
  } catch (e) { /* giữ pending, thử lại kỳ sau */ }
  flushing = false;
}
module.exports = { countDl };
