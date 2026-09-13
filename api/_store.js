// api/_store.js — trừu tượng đếm lượt tải: ưu tiên Upstash Redis, gom batch rồi flush GitHub.
// Giải quyết: "mỗi lượt tải = 1 commit GitHub" không scale + conflict khi bấm đồng thời.
const { writeFile } = require('./_github');
const fs = require('fs'), path = require('path');
const memPending = new Map(); // id -> số lượt chờ flush
let flushing = false, lastFlush = 0;
const FLUSH_EVERY = 60 * 1000;
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
  maybeFlush();
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
    const base = readBundled('data/stats.json', {});
    for (const [id, n] of memPending) {
      if (!base[id] || typeof base[id] !== 'object') base[id] = { dl: 0 };
      base[id].dl = (base[id].dl || 0) + n;
    }
    await writeFile({ file: 'data/stats.json', json: base, message: `[skip ci] stats: batch +${[...memPending.values()].reduce((a, b) => a + b, 0)} downloads` });
    memPending.clear(); lastFlush = Date.now();
  } catch (e) { /* giữ pending, thử lại kỳ sau */ }
  flushing = false;
}
module.exports = { countDl };
