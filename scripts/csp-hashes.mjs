// scripts/csp-hashes.mjs — tái tạo CSP hashes cho vercel.json.
// QUAN TRỌNG: Vercel serve file với LF, còn máy Windows checkout CRLF.
// Mọi hash PHẢI tính trên bytes đã chuẩn hóa \r\n -> \n.
// Chạy sau MỖI lần sửa <script>/<style> inline: node scripts/csp-hashes.mjs
import fs from 'node:fs';
import crypto from 'node:crypto';
const sha = (s) => "'sha256-" + crypto.createHash('sha256').update(s, 'utf8').digest('base64') + "'";
const norm = (s) => s.replace(/\r\n/g, '\n');
const scriptHashes = new Set(), styleHashes = new Set();
for (const f of fs.readdirSync('.').filter((f) => f.endsWith('.html'))) {
  const s = norm(fs.readFileSync(f, 'utf8'));
  for (const m of s.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)) {
    if (/application\/ld\+json/.test(m[0])) continue;
    scriptHashes.add(sha(m[1]));
  }
  for (const m of s.matchAll(/<style>([\s\S]*?)<\/style>/g)) styleHashes.add(sha(m[1]));
}
try {
  const i18n = norm(fs.readFileSync('assets/i18n.js', 'utf8'));
  const m = i18n.match(/\.textContent='(@keyframes[\s\S]*?)';/);
  if (m) styleHashes.add(sha(m[1]));
} catch {}
scriptHashes.add(sha("this.style.display='none'"));
const v = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
const csp =
  "default-src 'self'; img-src 'self' data: https:; font-src 'self' https://fonts.gstatic.com; style-src 'self' https://fonts.googleapis.com " +
  [...styleHashes].join(' ') +
  "; style-src-attr 'unsafe-inline'; script-src 'self' 'unsafe-hashes' " +
  [...scriptHashes].join(' ') +
  '; connect-src ' + "'self' https://pmotbltodyyilarnvtpn.supabase.co https://api.imgbb.com https://api.qrserver.com; frame-ancestors 'self'; base-uri 'self'; form-action 'self'; object-src 'none'";
v.headers[0].headers.find((h) => h.key === 'Content-Security-Policy').value = csp;
fs.writeFileSync('vercel.json', JSON.stringify(v, null, 2) + '\n');
console.log('scripts:', scriptHashes.size, 'styles:', styleHashes.size);