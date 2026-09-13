// /api/game/[slug].js v2 — SSR trang chi tiết, dùng shared/render.mjs (khớp pixel client).
// Fix bản v2 cũ: import sai depth (../../../), chèn trùng <title>, related dùng class lạ.
const fs = require('fs');
const path = require('path');

async function loadShared() { return await import('../../shared/render.mjs'); }

function loadGames() {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'games.json'), 'utf-8'));
}
function loadTemplate() {
  return fs.readFileSync(path.join(process.cwd(), 'game.html'), 'utf-8');
}
function loadRating(slug) {
  try {
    const list = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'comments.json'), 'utf-8'));
    if (!Array.isArray(list)) return null;
    const rows = list.filter((c) => c && c.game === slug && c.status === 'approved' && !c.parentId);
    if (!rows.length) return null;
    return { avg: Math.round((rows.reduce((s, c) => s + (c.stars | 0), 0) / rows.length) * 10) / 10, total: rows.length };
  } catch { return null; }
}

module.exports = async (req, res) => {
  try {
    const slug = String((req.query && req.query.slug) || '').slice(0, 120);
    if (!/^[a-z0-9][a-z0-9\-]{0,119}$/i.test(slug)) { res.statusCode = 400; res.end('slug invalid'); return; }
    const games = loadGames();
    const game = games.find((g) => g && g.id === slug);
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const siteUrl = (process.env.SITE_URL || `${proto}://${host}`).replace(/\/$/, '');
    if (!game) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(`<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"><meta name="robots" content="noindex"><title>Không tìm thấy game</title></head><body style="font-family:system-ui;text-align:center;padding:40px"><h2>Không tìm thấy game này!</h2><p><a href="${siteUrl}/index.html">‹ Về trang chủ</a></p></body></html>`);
      return;
    }
    const R = await loadShared();
    let html = loadTemplate();

    // --- HEAD: THAY THẾ (không chèn thêm) từng thẻ đã có trong template ---
    const pageUrl = `${siteUrl}/game/${slug}.html`;
    const resList = Array.isArray(game.res) ? game.res.join(', ') : '';
    const shortDesc = R.esc(String(game.desc || '').slice(0, 150).trim());
    const title = `${R.esc(game.name)}${game.vi ? ' [Việt Hóa]' : ''} - Tải Game Java ${R.esc(resList)} | J2ME`;
    const desc = R.esc(`Tải ${game.name}${game.vi ? ' Việt Hóa' : ''} cho Java J2ME. Hỗ trợ ${resList}. Dung lượng ${game.size || ''}. ${String(game.desc || '').slice(0, 120)}`.slice(0, 300));
    const thumb = /^https?:\/\//.test(game.thumb || '') ? game.thumb : `${siteUrl}/${String(game.thumb || '').replace(/^\/+/, '')}`;
    html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`);
    html = html.replace(/(<meta name="description" content=")[\s\S]*?(">)/, `$1${desc}$2`);
    html = html.replace(/(<link rel="canonical" href=")[\s\S]*?(">)/, `$1${pageUrl}$2`);
    html = html.replace(/(<meta property="og:title" content=")[\s\S]*?(">)/, `$1${R.esc(game.name)} - Game Java$2`);
    html = html.replace(/(<meta property="og:description" content=")[\s\S]*?(">)/, `$1${desc}$2`);
    html = html.replace(/(<meta property="og:image" content=")[\s\S]*?(">)/, `$1${R.esc(thumb)}$2`);
    html = html.replace(/(<meta property="og:url" content=")[\s\S]*?(">)/, `$1${pageUrl}$2`);
    const jsonLd = { '@context': 'https://schema.org', '@type': 'VideoGame', name: game.name, operatingSystem: 'Java J2ME', fileSize: game.size || '', genre: game.cat || '' };
    const rating = loadRating(slug);
    if (rating) jsonLd.aggregateRating = { '@type': 'AggregateRating', ratingValue: rating.avg, reviewCount: rating.total };
    html = html.replace(/(<script type="application\/ld\+json">)[\s\S]*?(<\/script>)/, `$1${JSON.stringify(jsonLd)}$2`);

    // --- BODY slots: render y hệt client + nhúng data để client khỏi fetch lại ---
    const set = (tag, inner) => { html = html.replace(new RegExp(`(<!--SLOT:${tag}-->)[\\s\\S]*?(<!--\\/SLOT:${tag}-->)`), `$1${inner}$2`); };
    set('HEAD', R.detailHead(game, siteUrl));
    set('DL', R.detailDl(game, ''));
    const dataTag = `<script id="__GAME_DATA__" type="application/json">${JSON.stringify(game).replace(/</g, '\\u003c')}</script>`;
    set('BODY', R.detailBody(game) + dataTag);
    set('REL', R.relatedHtml(games, game, siteUrl));
    html = html.replace(/(<b id="bcName">)[\s\S]*?(<\/b>)/, `$1${R.esc(game.name)}$2`);
    html = html.replace('<div id="relatedBox" class="kawaii-i" style="display:none">', '<div id="relatedBox" class="kawaii-i">');

    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
    res.end(html);
  } catch (e) { try { console.error('game slug error:', e && e.message); } catch {} res.statusCode = 500; res.end('error'); }
};
