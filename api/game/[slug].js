// /api/game/[slug].js
// Vercel Serverless Function (Node.js runtime).
// Nhận request /game/<slug>.html (đã được rewrite trong vercel.json trỏ về đây),
// đọc data/games.json để lấy đúng thông tin game theo slug, sau đó lấy nguyên
// file game.html tĩnh và THAY THẾ phần <head> (title, meta description, keywords,
// canonical, og:*, JSON-LD) bằng nội dung đúng cho game đó, rồi trả HTML hoàn
// chỉnh về cho trình duyệt / bot.
//
// Phần <body> và toàn bộ JS phía dưới được giữ nguyên y hệt game.html gốc,
// nên hành vi hiển thị, popup, lightbox... không đổi — chỉ có phần SEO ở
// <head> là được server render sẵn, đúng cho từng bài viết ngay từ HTML gốc
// (không cần chờ JS chạy), giúp Google/Facebook/Zalo bot đọc đúng ngay lần đầu.

const fs = require('fs');
const path = require('path');

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/[\r\n]+/g, ' ')
    .trim();
}

function loadGames() {
  const jsonPath = path.join(process.cwd(), 'data', 'games.json');
  const raw = fs.readFileSync(jsonPath, 'utf-8');
  return JSON.parse(raw);
}

function loadTemplate() {
  const templatePath = path.join(process.cwd(), 'game.html');
  return fs.readFileSync(templatePath, 'utf-8');
}

// Render sẵn các vùng body của game.html (giữa cặp marker <!--SLOT:X-->...<!--/SLOT:X-->).
// Markup sao chép đúng bản client để hydration khớp, không lệch giao diện.
function fillSlots(html, { game, slug, siteUrl, games }) {
  const e = escapeHtml;
  const resArr = Array.isArray(game.res) ? game.res : [];
  const shots = Array.isArray(game.shots) ? game.shots : [];
  let dateStr = '';
  try {
    if (game.created_at) {
      const d = new Date(game.created_at);
      if (!isNaN(d)) dateStr = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
  } catch (err) {}
  const hot = game.hot
    ? '<span style="background:#ff4d8d;color:#fff;font-size:8px;padding:2px 5px;border-radius:8px">HOT</span>'
    : '';
  const vi = game.vi
    ? '<span style="background:#0a9c4a;color:#fff;font-size:8px;padding:2px 5px;border-radius:8px">VIỆT HÓA</span>'
    : '';

  const head =
    `<img src="${e(game.thumb)}" alt="${e(game.name)} thumb" width="84" height="84" decoding="async" fetchpriority="high"><div><h2>${e(game.name)} ${hot} ${vi}</h2>` +
    `<table class="info-table"><tr><th>Thể loại</th><td><a href="/category.html?cat=${encodeURIComponent(game.cat || '')}" style="color:#ff4d8d">${e(game.cat)}</a></td></tr>` +
    `<tr><th>Dung lượng</th><td>${e(game.size)}</td></tr>` +
    `<tr><th>Màn hình</th><td>${resArr.map((r) => `<span class="res-tag">${e(r)}</span>`).join(' ')}</td></tr>` +
    (dateStr ? `<tr><th>Ngày đăng</th><td>${dateStr}</td></tr>` : '') +
    `</table></div>`;

  const dl = resArr
    .map(
      (r) =>
        `<div class="dl-option"><b>${e(r)}</b><br><small style="color:#8a6a7a;font-size:10px">${e(game.size)} • ${String(r).includes('240') ? 'QVGA' : 'QCIF'}</small><br>` +
        `<a href="${e((game.jar || {})[r] || '#')}" class="dl-btn" data-dl-btn="1" data-name="${e(game.name)}" data-res="${e(r)}">⬇ Tải JAR</a></div>`
    )
    .join('');

  const shotCls = shots.length === 1 ? ' count-1' : shots.length === 2 ? ' count-2' : '';
  const shotsHtml = shots.length
    ? `<div class="shot-grid${shotCls}">${shots
        .map(
          (s, i) =>
            `<img src="${e(s)}" alt="Ảnh demo ${i + 1}" width="240" height="320" loading="lazy" decoding="async" data-idx="${i}" class="shot-img" style="cursor:pointer">`
        )
        .join('')}</div>`
    : '<p class="note">Chưa có ảnh demo cho game này.</p>';
  // Mô tả: escape + giữ xuống dòng (CSS pre-line) + link hóa URL (khớp client linkify)
  const desc = e(game.desc || '')
    .replace(/(https?:\/\/[^\s<>"']+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
  const body =
    `<h3 style="color:#059669">📝 Giới thiệu</h3><p>${desc}</p><h3>🖼️ Hình ảnh</h3>${shotsHtml}` +
    `<h3>⚙️ Yêu cầu</h3><p style="font-size:11px">• MIDP 2.0 • Màn hình ${e(resArr.join(', '))} • Trống ≥${e(game.size)} • Opera Mini</p>`;

  const all = Object.values(games || {}).filter((x) => x && x.id !== game.id);
  const same = all.filter((x) => x.cat && game.cat && x.cat === game.cat);
  const rest = all.filter((x) => !(x.cat && game.cat && x.cat === game.cat));
  const rel = same
    .concat(rest)
    .slice(0, 6)
    .map(
      (x) =>
        `<a href="/game/${e(x.id)}.html" style="background:#fff;border:1.5px solid #ffd0e8;border-radius:10px;padding:6px;text-align:center;text-decoration:none">` +
        `<img src="${e(x.thumb)}" width="48" height="48" loading="lazy" decoding="async" alt="${e(x.name)}" style="width:48px;height:48px;border-radius:8px;margin:0 auto;object-fit:cover">` +
        `<span style="font-size:10px;font-weight:700;display:block;color:#4a2a3a">${e(String(x.name || '').split('[')[0].slice(0, 14))}</span>` +
        `<small style="font-size:9px;color:#8a6a7a">${e(((x.res || [])[0] || ''))}</small></a>`
    )
    .join('');

  const set = (tag, inner) => {
    const re = new RegExp(`(<!--SLOT:${tag}-->)[\\s\\S]*?(<!--\\/SLOT:${tag}-->)`);
    if (re.test(html)) html = html.replace(re, `$1${inner}$2`);
  };
  set('HEAD', head);
  set('DL', dl);
  set('BODY', body);
  set('REL', rel);
  html = html.replace(/(<b id="bcName">)[\s\S]*?(<\/b>)/, `$1${e(game.name)}$2`);
  if (rel) {
    html = html.replace(
      '<div id="relatedBox" class="kawaii-i" style="display:none">',
      '<div id="relatedBox" class="kawaii-i">'
    );
  }
  return html;
}

function loadRating(slug) {  try {
    const raw = fs.readFileSync(path.join(process.cwd(), 'data', 'comments.json'), 'utf-8');
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return null;
    const rows = list.filter((c) => c && c.game === slug && c.status === 'approved' && !c.parentId);
    if (!rows.length) return null;
    const total = rows.length;
    const avg = Math.round((rows.reduce((s, c) => s + (c.stars | 0), 0) / total) * 10) / 10;
    return { avg, total };
  } catch (e) {
    return null;
  }
}

function buildHead({ game, slug, siteUrl }) {
  const name = escapeHtml(game.name);
  const cat = escapeHtml(game.cat || '');
  const size = escapeHtml(game.size || '');
  const resList = Array.isArray(game.res) ? game.res.join(', ') : '';
  const shortDesc = escapeHtml(
    (game.desc || '').slice(0, 150).trim()
  );
  const thumbUrl = /^https?:\/\//.test(game.thumb || '')
    ? game.thumb
    : `${siteUrl}/${(game.thumb || '').replace(/^\/+/, '')}`;
  const pageUrl = `${siteUrl}/game/${slug}.html`;
  const title = `${name}${game.vi ? ' [Việt Hóa]' : ''} - Tải Game Java ${resList} | JAVA.WAP.SH`;
  const description = `Tải ${name}${game.vi ? ' Việt Hóa' : ''} cho Java J2ME. Hỗ trợ ${resList}. Dung lượng ${size}. ${shortDesc}`.slice(0, 300);
  const keywords = `${name.toLowerCase()} java, tải ${name.toLowerCase()} jar, game java ${resList}, java wap anime`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'VideoGame',
    name: game.name,
    operatingSystem: 'Java J2ME',
    fileSize: size,
    genre: cat,
  };
  const rating = loadRating(slug);
  if (rating) {
    jsonLd.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: rating.avg,
      reviewCount: rating.total,
    };
  }
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: `${siteUrl}/index.html` },
      {
        '@type': 'ListItem',
        position: 2,
        name: game.cat || 'Game Java',
        item: `${siteUrl}/category.html?cat=${encodeURIComponent(game.cat || '')}`,
      },
      { '@type': 'ListItem', position: 3, name: game.name },
    ],
  };

  return `<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<meta name="keywords" content="${escapeHtml(keywords)}">
<meta name="robots" content="index, follow, max-image-preview:large">
<link rel="canonical" href="${pageUrl}">
<meta property="og:title" content="${escapeHtml(name)} - Game Java Anime">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:image" content="${thumbUrl}">
<meta property="og:url" content="${pageUrl}">
<meta property="og:type" content="article">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
<script type="application/ld+json">${JSON.stringify(breadcrumbLd)}</script>`;
}

module.exports = async (req, res) => {
  try {
    const { slug } = req.query;

    if (!slug) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end('Thiếu slug');
      return;
    }

    const games = loadGames();
    const game = games.find((g) => g.id === slug);

    const proto = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const siteUrl = `${proto}://${host}`;

    let html = loadTemplate();

    if (!game) {
      // Không tìm thấy game: vẫn trả 404 đúng chuẩn HTTP cho bot/SEO,
      // đồng thời hiển thị trang "Không tìm thấy" thân thiện cho người dùng.
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(`<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Không tìm thấy game - JAVA.WAP.SH</title>
<meta name="robots" content="noindex">
</head>
<body style="font-family:system-ui;text-align:center;padding:40px">
<h2>Không tìm thấy game này!</h2>
<p><a href="/index.html">‹ Về trang chủ</a></p>
</body>
</html>`);
      return;
    }

    // Thay phần <head> mặc định (hardcode) bằng meta đúng cho slug hiện tại.
    // Regex khớp toàn bộ khối từ <title> tới hết thẻ JSON-LD đầu tiên trong head,
    // đúng với cấu trúc cố định của game.html.
    const headBlockRegex = /<title>[\s\S]*?<script type="application\/ld\+json">[\s\S]*?<\/script>/;
    const newHead = buildHead({ game, slug, siteUrl });

    if (headBlockRegex.test(html)) {
      html = html.replace(headBlockRegex, newHead);
    } else {
      // Phòng trường hợp template đổi cấu trúc: chèn thêm ngay trước </head>
      html = html.replace('</head>', `${newHead}\n</head>`);
    }

    // Render sẵn nội dung body (chi tiết, nút tải, mô tả, demo, liên quan) để
    // người dùng thấy đúng game ngay, không chờ JS; JS client render lại y hệt.
    // Chế độ ?preview=1 dùng dữ liệu sessionStorage nên bỏ qua bước này.
    if (!(req.query && req.query.preview === '1')) {
      html = fillSlots(html, { game, slug, siteUrl, games });
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    res.end(html);
  } catch (err) {
    try { console.error('game slug api error:', err && err.message); } catch (e) {}
    res.statusCode = 500;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('Lỗi hệ thống, thử lại sau.');
  }
};
