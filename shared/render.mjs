// shared/render.mjs — SINGLE SOURCE cho detail/related (server SSR + client hydration).
// Markup COPY Y HỆT game.html client (inline spans, dl-btn, dl-option, shot-grid...)
// để first-paint (server) và hydration (client) khớp pixel. Đổi giao diện phải
// đổi cả 2 → hãy sửa ở đây rồi port sang game.html, hoặc ngược lại.
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}
export function linkify(s) {
  return esc(s).replace(/(https?:\/\/[^\s<>"']+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
}
export function hotSpan() {
  return '<span style="background:#ff4d8d;color:#fff;font-size:8px;padding:2px 5px;border-radius:8px">HOT</span>';
}
export function viSpan() {
  return '<span style="background:#0a9c4a;color:#fff;font-size:8px;padding:2px 5px;border-radius:8px">VIỆT HÓA</span>';
}
export function badges(g) {
  return `${g.hot ? hotSpan() : ''} ${g.vi ? viSpan() : ''}`;
}
export function dateStrOf(g) {
  try {
    if (g.created_at) {
      const d = new Date(g.created_at);
      if (!isNaN(d)) return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
  } catch {}
  return '';
}
// Khớp game.html renderDetail (dòng head.innerHTML), trừ hàng Lượt tải (client tự thêm sau khi fetch stats).
export function detailHead(g, siteUrl) {
  const res = Array.isArray(g.res) ? g.res : [];
  const ds = dateStrOf(g);
  const catHref = siteUrl
    ? `${siteUrl}/category.html?cat=${encodeURIComponent(g.cat || '')}`
    : `category.html?cat=${encodeURIComponent(g.cat || '')}`;
  return `<img src="${esc(g.thumb)}" alt="${esc(g.name)} thumb" width="84" height="84" decoding="async" fetchpriority="high"><div><h2>${esc(g.name)} ${badges(g)}</h2>`
    + `<table class="info-table"><tr><th>Thể loại</th><td><a href="${esc(catHref)}" style="color:#ff4d8d">${esc(g.cat)}</a></td></tr>`
    + `<tr><th>Dung lượng</th><td>${esc(g.size)}</td></tr>`
    + `<tr><th>Màn hình</th><td>${res.map((r) => `<span class="res-tag">${esc(r)}</span>`).join(' ')}</td></tr>`
    + (ds ? `<tr><th>Ngày đăng</th><td>${ds}</td></tr>` : '') + `</table></div>`;
}
// Khớp game.html (dl-grid innerHTML) nhưng href đi qua gateway /api/dl để kiểm soát
// supply-chain + đếm server-side. Client game.html cũng dùng gateway (đã vá).
export function dlHref(g, r, apiRoot = '') {
  return `${apiRoot}/api/dl?id=${encodeURIComponent(g.id)}&res=${encodeURIComponent(r)}`;
}
export function detailDl(g, apiRoot = '') {
  return (Array.isArray(g.res) ? g.res : []).map((r) =>
    `<div class="dl-option"><b>${esc(r)}</b><br><small style="color:#8a6a7a;font-size:10px">${esc(g.size)} • ${String(r).includes('240') ? 'QVGA' : 'QCIF'}</small><br>`
    + `<a href="${esc(dlHref(g, r, apiRoot))}" class="dl-btn" data-dl-btn="1" data-name="${esc(g.name)}" data-res="${esc(r)}">⬇ Tải JAR</a></div>`
  ).join('');
}
// Khớp game.html (body-text innerHTML) từng ký tự.
export function detailBody(g) {
  const shots = Array.isArray(g.shots) ? g.shots : [];
  const cls = shots.length === 1 ? ' count-1' : shots.length === 2 ? ' count-2' : '';
  const shotsHtml = shots.length
    ? `<div class="shot-grid${cls}">${shots.map((s, i) => `<img src="${esc(s)}" alt="Ảnh demo ${i + 1}" width="240" height="320" loading="lazy" decoding="async" data-idx="${i}" class="shot-img" style="cursor:pointer">`).join('')}</div>`
    : '<p class="note">Chưa có ảnh demo cho game này.</p>';
  return `<h3>📝 Giới thiệu</h3><p>${linkify(g.desc || '')}</p><h3>🖼️ Hình ảnh</h3>${shotsHtml}`
    + `<h3>⚙️ Yêu cầu</h3><p style="font-size:11px">• MIDP 2.0 • Màn hình ${esc((g.res || []).join(', '))} • Trống ≥${esc(g.size)} • Opera Mini</p>`;
}
export function related(games, g, n = 6) {
  const all = games.filter((x) => x && x.id !== g.id);
  const same = all.filter((x) => x.cat && g.cat && x.cat === g.cat);
  const rest = all.filter((x) => !(x.cat && g.cat && x.cat === g.cat));
  return same.concat(rest).slice(0, n);
}
// Khớp game.html (relatedGrid innerHTML). gameHrefBase='' → href tương đối như client.
export function relatedHtml(games, g, gameHrefBase = '') {
  return related(games, g).map((x) =>
    `<a href="${esc(gameHrefBase)}/game/${esc(x.id)}.html" style="background:#fff;border:1.5px solid #ffd0e8;border-radius:10px;padding:6px;text-align:center;text-decoration:none">`
    + `<img src="${esc(x.thumb)}" width="48" height="48" loading="lazy" decoding="async" alt="${esc(x.name)}" style="width:48px;height:48px;border-radius:8px;margin:0 auto;object-fit:cover">`
    + `<span style="font-size:10px;font-weight:700;display:block;color:#4a2a3a">${esc(String(x.name || '').split('[')[0].slice(0, 14))}</span>`
    + `<small style="font-size:9px;color:#8a6a7a">${esc(((x.res || [])[0] || ''))}</small></a>`
  ).join('');
}
