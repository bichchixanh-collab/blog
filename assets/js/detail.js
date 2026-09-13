// assets/js/detail.js — dùng __GAME_DATA__ do server nhúng, KHÔNG fetch games.json lại.
// Fix double-fetch: chỉ fetch khi không có embedded (truy cập trực tiếp file tĩnh).
import { apiRoot } from './config.js';
import { esc, linkify } from './utils.js';
import { markSeen, toggleFav, hasFav } from './store.js';
const $ = (s, r = document) => r.querySelector(s);
function embedded() {
  try { const t = document.getElementById('__GAME_DATA__'); return t ? JSON.parse(t.textContent) : null; } catch { return null; }
}
async function loadGame(id) {
  const em = embedded();
  if (em && em.id === id) return em;
  const r = await fetch(`${apiRoot()}/data/games.json`, { headers: { Accept: 'application/json' } });
  const arr = await r.json();
  return arr.find((g) => g.id === id) || null;
}
function getId() {
  const q = new URLSearchParams(location.search).get('id');
  if (q) return q.replace(/\.html$/, '');
  const m = location.pathname.match(/\/game\/([^\/]+?)(?:\.html)?$/);
  return m ? decodeURIComponent(m[1]) : null;
}
async function init() {
  const id = getId();
  if (!id) return;
  const g = await loadGame(id);
  if (!g) { document.body.innerHTML = '<p>Không tìm thấy game. <a href="index.html">Về trang chủ</a></p>'; return; }
  markSeen(id);
  document.title = `${g.name} - Tải Game Java | J2ME`;
  $('#bcName') && ($('#bcName').textContent = g.name);
  // render head/dl/body — markup khớp server vì cùng logic shared/render.mjs (port 1-1)
  $('#dHead').innerHTML = `<img src="${esc(g.thumb)}" width="84" height="84" alt="${esc(g.name)}"><div><h2>${esc(g.name)}</h2><div class="meta">${esc(g.cat || '')} • ${esc(g.size || '')}</div></div>`;
  $('#dDl').innerHTML = (g.res || []).map((r) => `<div class="dl-option"><b>${esc(r)}</b><br><a class="btn" href="${esc(apiRoot())}/api/dl?id=${encodeURIComponent(g.id)}&res=${encodeURIComponent(r)}">⬇ Tải JAR</a></div>`).join('');
  $('#dBody').innerHTML = `<p>${linkify(g.desc || '')}</p>`;
  $('#favBtn')?.addEventListener('click', (e) => { toggleFav(id); e.target.textContent = hasFav(id) ? '♥ Đã thích' : '♡ Thích'; });
}
init();
