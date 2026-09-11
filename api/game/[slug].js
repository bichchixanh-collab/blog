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

function loadRating(slug) {
  try {
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
