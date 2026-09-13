// app.js v2.1 — giữ UI kawaii gốc, chỉ thay ruột: gateway dl, cache, site động.
import { CATS, apiRoot } from './config.js';
import { esc, normVn, shuffle } from './utils.js';
import { getGames, getStatsCounts, getBanners } from './api.js';
import { hasFav, toggleFav, checkin } from './store.js';
const $ = (s, r = document) => r.querySelector(s);

// Markup Y HỆT bản gốc (game-item/dl-btn/game-thumb) để UI không đổi
function card(g, eager = false) {
  const hot = g.hot ? '<span style="background:#ff4d8d;color:#fff;font-size:8px;padding:2px 4px;border-radius:8px">HOT</span>' : '';
  const vi = g.vi ? '<span style="background:#0a9c4a;color:#fff;font-size:8px;padding:2px 4px;border-radius:8px">VIỆT HÓA</span>' : '';
  const load = eager ? 'loading="eager" fetchpriority="high"' : 'loading="lazy" decoding="async"';
  const root = apiRoot();
  return `<div class="game-item" data-name="${esc(normVn((g.name || '') + ' ' + (g.cat || '')))}" style="display:flex;gap:10px;align-items:center;padding:8px 0;border-bottom:1px dashed #ffd0e8">`
    + `<img src="${esc(g.thumb)}" class="game-thumb" width="48" height="48" ${load} alt="${esc(g.name)}" style="width:48px;height:48px;border-radius:10px;border:1.5px solid #ffd0e8;object-fit:cover;flex-shrink:0">`
    + `<div style="flex:1"><h3 style="font-size:12px"><a href="${esc(root)}/game/${esc(g.id)}.html">${esc(g.name)}</a> ${hot} ${vi}</h3>`
    + `<div class="game-meta" style="font-size:10px;color:#8a6a7a">${esc(g.cat || '')} • ${esc(g.size || '')}</div></div>`
    + `<div style="display:grid;gap:4px;justify-items:center"><a href="${esc(root)}/game/${esc(g.id)}.html" class="dl-btn" style="display:inline-flex;background:linear-gradient(180deg,#ff8ec7,#ff4d8d);color:#fff;padding:8px 16px;border-radius:24px;font-weight:800;font-size:11px;border:2px solid #fff;text-decoration:none">⬇ JAR</a>`
    + `<button data-fav="${esc(g.id)}" title="Yêu thích" style="background:none;border:none;color:#ff4d8d;font-size:15px;cursor:pointer">${hasFav(g.id) ? '♥' : '♡'}</button></div></div>`;
}
function gridItem(g) {
  const root = apiRoot();
  return `<a href="${esc(root)}/game/${esc(g.id)}.html" class="grid-item" style="background:#fff;border:1.5px solid #ffd0e8;border-radius:10px;padding:6px;text-align:center;text-decoration:none"><img src="${esc(g.thumb)}" width="48" height="48" loading="lazy" decoding="async" alt="${esc(g.name)}" style="width:48px;height:48px;border-radius:8px;margin:0 auto;object-fit:cover"><span style="font-size:10px;font-weight:700;display:block;color:#4a2a3a">${esc(String(g.name || '').split('[')[0].slice(0, 14))}</span><small style="font-size:9px;color:#8a6a7a">${esc((g.res || [])[0] || '')}</small></a>`;
}
async function init() {
  const tick = () => { const el = $('#clock'); if (el) el.textContent = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }); };
  tick(); setInterval(tick, 30000);
  try {
    const { streak, added } = checkin();
    const sb = $('#streakBox');
    if (sb && streak) { sb.hidden = false; sb.style.display = ''; sb.textContent = `🔥 Điểm danh ${streak} ngày liên tiếp${added ? ' (+XP)' : ''}`; }
  } catch {}
  try {
    const imgs = await getBanners();
    if (imgs.length) { const im = $('#wapBannerImg'); if (im) im.src = imgs[Math.floor(Math.random() * imgs.length)]; }
  } catch {}
  let games = [];
  try { games = await getGames(); } catch { $('#hotList').innerHTML = '<p>Không tải được danh sách game.</p>'; return; }
  if (!games.length) return;
  try {
    const counts = await getStatsCounts();
    if (counts) games.forEach((g) => { if (counts[g.id] != null) g.downloads = counts[g.id]; });
  } catch {}
  const byDl = [...games].sort((a, b) => (b.downloads || 0) - (a.downloads || 0));
  $('#hotList').innerHTML = byDl.slice(0, 3).map((g, i) => card(g, i < 2)).join('');
  $('#newList').innerHTML = games.slice(0, 4).map((g) => card(g)).join('');
  const vh = games.filter((g) => g.vi);
  $('#viethoaGrid').innerHTML = (vh.length ? vh.slice(0, 6) : games.slice(0, 6)).map(gridItem).join('');
  const ex = $('#extraList'); if (ex) ex.innerHTML = games.slice(3, 6).map((g) => card(g)).join('');
  const ex2 = $('#extraGrid2'); if (ex2) ex2.innerHTML = games.slice(6, 9).map(gridItem).join('');
  const rnd = $('#randomList'); if (rnd) rnd.innerHTML = shuffle(games).slice(0, 3).map((g) => card(g)).join('');
  const counts = {};
  games.forEach((g) => { counts[g.cat] = (counts[g.cat] || 0) + 1; if (g.vi) counts['Việt Hóa'] = (counts['Việt Hóa'] || 0) + 1; });
  const cg = $('#catGridIndex');
  if (cg) cg.innerHTML = CATS.map((c) => `<a href="${esc(apiRoot())}/category.html?cat=${encodeURIComponent(c.id)}" style="background:#fff;border:1.5px solid #ffd0e8;border-radius:10px;padding:8px;text-align:center;text-decoration:none"><div style="font-size:18px">${c.icon}</div><b style="font-size:10px;color:#4a2a3a">${esc(c.id)}</b><br><small style="color:#8a6a7a">${counts[c.id] || 0}</small></a>`).join('');
  const total = games.reduce((s, g) => s + (g.downloads || 0), 0);
  const box = $('#statsBox');
  if (box && total > 0) { box.style.display = ''; box.innerHTML = `Tổng lượt tải: <b>${total.toLocaleString('vi-VN')}</b> • Top: <b>${esc(String(byDl[0].name || '').slice(0, 20))}</b>`; }
  bindSearch(games); bindFilter(); renderFavs(games);
}
function renderFavs(games) {
  const ids = (() => { try { return JSON.parse(localStorage.getItem('j2me_favs') || '[]'); } catch { return []; } })();
  const byId = Object.fromEntries(games.map((g) => [g.id, g]));
  const items = ids.map((id) => byId[id]).filter(Boolean);
  const sec = $('#favSection');
  if (!sec) return;
  if (!items.length) { sec.style.display = 'none'; return; }
  sec.style.display = '';
  $('#favGrid').innerHTML = items.map(gridItem).join('');
}
function bindSearch(games) {
  const input = $('#searchInput'), box = $('#suggestBox');
  if (!input) return;
  const show = () => {
    const q = normVn(input.value.trim());
    document.querySelectorAll('.game-item').forEach((el) => { el.style.display = !q || (el.dataset.name || '').includes(q) ? 'flex' : 'none'; });
    if (!box) return;
    if (q.length < 1) { box.classList.remove('open'); box.innerHTML = ''; box.style.display = 'none'; return; }
    const hits = games.filter((g) => normVn((g.name || '') + ' ' + (g.cat || '')).includes(q)).slice(0, 6);
    if (!hits.length) { box.classList.remove('open'); box.style.display = 'none'; return; }
    const root = apiRoot();
    box.innerHTML = hits.map((g) => `<a href="${esc(root)}/game/${esc(g.id)}.html" style="display:flex;gap:8px;align-items:center;padding:7px 10px;text-decoration:none;border-bottom:1px dashed #ffd0e8"><span style="font-size:12px;font-weight:700;color:#4a2a3a">${esc(g.name)}</span><small style="margin-left:auto;color:#8a6a7a">${esc(g.cat || '')}</small></a>`).join('');
    box.classList.add('open'); box.style.display = '';
  };
  input.addEventListener('input', show);
  input.addEventListener('blur', () => setTimeout(() => { if (box) box.style.display = 'none'; }, 150));
}
function bindFilter() {
  document.querySelectorAll('.res-btn').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll('.res-btn').forEach((x) => x.classList.remove('active'));
    b.classList.add('active');
    const res = b.dataset.res || b.dataset.resBtn;
    document.querySelectorAll('.game-item').forEach((el) => { el.style.display = res === 'all' || el.textContent.includes(res) ? 'flex' : 'none'; });
  }));
}
document.addEventListener('click', (e) => {
  const b = e.target?.closest?.('[data-fav]');
  if (!b) return;
  e.preventDefault();
  toggleFav(b.getAttribute('data-fav'));
  const on = hasFav(b.getAttribute('data-fav'));
  document.querySelectorAll(`[data-fav="${CSS.escape(b.getAttribute('data-fav'))}"]`).forEach((x) => { x.textContent = on ? '♥' : '♡'; });
});
// modal gốc giữ nguyên hành vi
(() => {
  const modal = document.getElementById('dlModal');
  if (!modal) return;
  const close = () => { modal.classList.add('hidden'); modal.style.display = 'none'; document.body.style.overflow = ''; };
  modal.classList.add('hidden'); modal.style.display = 'none';
  document.getElementById('modalClose')?.addEventListener('click', close);
  document.getElementById('modalCancel')?.addEventListener('click', close);
})();
init();
