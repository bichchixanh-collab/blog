// utils.js — escape + normalize + cache chung. Mọi render phải qua esc().
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}
export function normVn(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
}
export function linkify(s) {
  return esc(s).replace(/(https?:\/\/[^\s<>"']+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
}
// Client cache 5 phút để không fetch ?Date.now() mỗi lần (lỗi perf bản cũ).
const mem = new Map();
export async function cachedJson(url, ttlMs = 5 * 60 * 1000) {
  const now = Date.now();
  const hit = mem.get(url);
  if (hit && now - hit.at < ttlMs) return hit.data;
  const r = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error('fetch ' + r.status);
  const data = await r.json();
  mem.set(url, { at: now, data });
  return data;
}
export function shuffle(a) {
  const arr = [...a];
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr;
}
