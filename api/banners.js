// /api/banners.js
// Vercel Serverless Function: quét toàn bộ ảnh trong /assets/banners và trả về JSON.
// Cứ file .png .jpg (.jpeg/.gif/.webp) là tự động random, không cần đặt tên đúng, không giới hạn số lượng.
// Endpoint: GET /api/banners
// Trả về DANH SÁCH TÊN FILE: ["banner1.png", ...] (không kèm đường dẫn),
// để frontend tự dựng URL theo đúng subfolder (localhost/blog hay domain root đều đúng).

const fs = require('fs');
const path = require('path');

module.exports = async (req, res) => {
  try {
    const dir = path.join(process.cwd(), 'assets', 'banners');
    let files = [];
    if (fs.existsSync(dir)) {
      const all = fs
        .readdirSync(dir, { withFileTypes: true })
        .filter((d) => d.isFile())
        .map((d) => d.name)
        .filter((name) => /\.(png|jpe?g|gif|webp)$/i.test(name));
      const webpBase = new Set(all.filter((n) => /\.webp$/i.test(n)).map((n) => n.replace(/\.webp$/i, '').toLowerCase()));
      files = all
        .filter((name) => {
          // Bỏ .png/.jpg khi đã có bản .webp cùng tên (tránh trùng random)
          if (webpBase.has(name.replace(/\.(png|jpe?g)$/i, '').toLowerCase()) && !/\.webp$/i.test(name)) return false;
          return true;
        })
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=60, must-revalidate');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.end(JSON.stringify(files));
  } catch (err) {
    try { console.error('banners api error:', err && err.message); } catch (e) {}
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'Lỗi hệ thống, thử lại sau.' }));
  }
};
