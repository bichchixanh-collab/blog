// api.js — mọi fetch đi qua đây: timeout + same-origin + fallback cache.
import { apiRoot } from './config.js';
import { cachedJson } from './utils.js';
async function withTimeout(p, ms = 8000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try { return await p(c.signal); } finally { clearTimeout(t); }
}
export async function getGames() {
  const root = apiRoot();
  const url = `${root}/data/games.json`;
  return withTimeout(async () => cachedJson(url), 8000);
}
export async function getStatsCounts() {
  try {
    const root = apiRoot();
    const r = await withTimeout((s) => fetch(`${root}/api/stats`, { cache: 'no-store', signal: s }));
    if (!r.ok) return null;
    const j = await r.json();
    return j.counts || null;
  } catch { return null; }
}
// Bản cũ gọi 30 request comments song song ở homepage — bỏ. Chỉ lấy summary khi cần.
export async function getCommentsSummary(gameId) {
  const root = apiRoot();
  const r = await fetch(`${root}/api/comments?game=${encodeURIComponent(gameId)}`, { cache: 'no-store' });
  if (!r.ok) throw new Error('comments ' + r.status);
  return r.json();
}
export async function getBanners() {
  const root = apiRoot();
  for (const u of [`${root}/api/banners`, `${root}/data/banners.json`]) {
    try {
      const r = await fetch(u, { cache: 'no-store' });
      if (!r.ok) continue;
      const j = await r.json();
      const names = (Array.isArray(j) ? j : j.files || []).filter((x) => /\.(png|jpe?g|gif|webp)$/i.test(x));
      if (names.length) return names.map((n) => `${root}/assets/banners/${encodeURIComponent(n.split('/').pop())}`);
    } catch {}
  }
  return [];
}
