// scripts/validate.mjs — node scripts/validate.mjs : bắt link supply-chain + thumb hết hạn trước khi deploy.
import fs from 'node:fs';
const games = JSON.parse(fs.readFileSync('data/games.json', 'utf-8'));
const ALLOW_HOSTS = ['drive.google.com', 'www.mediafire.com', 'mediafire.com', 'github.com', 'raw.githubusercontent.com', 'cdn.jsdelivr.net'];
let bad = 0;
for (const g of games) {
  if (!/^[a-z0-9][a-z0-9\-]{0,119}$/i.test(g.id)) { console.error('BAD id', g.id); bad++; }
  for (const u of [...(g.shots || []), g.thumb]) {
    if (/fbcdn\.net|scontent\./.test(u)) { console.error('EXPIRING thumb', g.id, u.slice(0, 80)); bad++; }
    if (/picsum\.photos/.test(u)) { console.error('PLACEHOLDER remote', g.id); bad++; }
  }
  for (const [res, u] of Object.entries(g.jar || {})) {
    if (/drive,google,com/.test(u)) { console.error('TYPO comma url', g.id, u); bad++; }
    try { const h = new URL(u).hostname; if (!ALLOW_HOSTS.includes(h)) console.warn('WARN host ngoài allowlist:', g.id, h); }
    catch { console.error('BAD url', g.id, u); bad++; }
  }
}
console.log(bad ? `FAIL: ${bad} lỗi` : 'OK: games.json sạch');
process.exit(bad ? 1 : 0);
