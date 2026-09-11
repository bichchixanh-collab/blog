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
      files = fs
        .readdirSync(dir, { withFileTypes: true })
        .filter((d) => d.isFile())
        .map((d) => d.name)
        .filter((name) => /\.(png|jpe?g|gif|webp)$/i.test(name))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=60, must-revalidate');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.end(JSON.stringify(files));
  } catch (err) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: err.message }));
  }
};
