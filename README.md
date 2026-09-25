# J2ME WAP — Kho Game Java V2 (`blog-v2`)

WAP tải game Java J2ME (Nokia S40, Samsung, SE) giao diện Anime, chạy serverless trên **Vercel** + **Supabase** (auth + đếm cứng) + **GitHub** (lưu `data/*.json`). Đã harden toàn diện: ticket bind user/IP, JWT nbf/iat/iss/aud, CSRF/CORS, open-redirect, download host, one-time ticket, RLS.

> `admin.php` + `config.php` là tool local **không commit** (xem `HUONGDAN.md`).

## 1. Tính năng chính

### 1.1 Trang web (11 HTML)
| Trang | Mô tả |
|---|---|
| `index.html` | Trang chủ: Hot (top downloads), Mới (phân trang 3/trang), Việt Hóa grid, Thể loại 9 mục, Yêu thích (local), Thống kê tổng tải/top/bình luận, banner random `assets/banners/` |
| `game.html` + SSR `api/game/[slug].js` | Chi tiết game: SSR `shared/render.mjs` (khớp pixel client), SEO canonical/og/jsonLD, JAR giấu (chỉ qua vé), đọc bài 10s đếm realtime (1s tick, session per-tab), khóa tải modal live 1s |
| `category.html` | Lọc theo cat + search không dấu |
| `profile.html` | Hồ sơ: XP, streak, huy hiệu, seen/favs/done |
| `goc-senpai.html` | Góc Senpai: bingo tuần, pet, nhiệm vụ |
| `go.html` | Gateway ngoài: kiểm vé `api/meta`, hiện host tin cậy |
| `dang-nhap.html` | Supabase Auth (email/pass/magic) qua `assets/js/sb-auth.js` REST thuần |
| `lien-he.html`, `404.html`, `offline.html`, `trang-xep-hang.html` | Phụ |
| `sw.js` | Service Worker cache `j2me-v7`, offline fallback |
| `assets/js/game-read.js` | Đếm thời gian đọc bài per-article (sessionStorage, visible+focused, 1s) |
| `assets/i18n.js` | Đa ngôn ngữ VI/ID (180+ key), `I18N.T()` |

### 1.2 Hệ khóa tải
- `gate` trong `data/games.json`: `none` (mở) | `stats` (tích AND: `read`, `likes`, `completed`) | `xp` | `login` (+ `read_secs` mặc định 10s cho **mọi game**)
- Vé HMAC `v2` 15 phút: `{v,id,res,day,exp,gh,hard,jti,sub,iph}` + `HMAC-SHA256(LOCK_SECRET|ticket)`, bind `sub` (hash uid/cid) + `iph` (subnet /24, /64), `jti` one-time (Redis `SET NX EX 900` hoặc memory)
- Luồng: `game.html` → `__proof` (st.read/likes/done + presence) → `GET /api/ticket?proof=` → `mintTicket` → `go.html?ticket=` → `GET /api/dl?ticket=` → `verifyTicket` + `verifyTicketBinding` + `gateHash` + one-time → `302` tới host allowlist
- Link JAR `ENC:` AES-256-GCM (`iv12|cipher|tag`, AAD=gameId) giải chỉ ở server (`_lock:decryptUrl`), fallback plaintext chỉ `https://` exact

### 1.3 Presence & khóa cứng
- Khách: `POST /api/presence` mint chain `n` (+1 mỗi 50s, subnet+cid), verify qua `_lock:verifyPresence`
- Đã đăng nhập: `POST /api/ustats` heartbeat/like/complete/bingo/petxp → `user_stats` (service_role), GET `api/ustats` trả `minutes/likes/completed/bingoLines/petLv`
- `countApproved()` đếm bình luận duyệt theo `uid` hoặc `names`

### 1.4 Bình luận
- `POST /api/comments` (CSRF same-origin, Turnstile nếu có, honeypot): `pending` → admin duyệt → `approved`
- `GET /api/comments?game=&page=&limit=` (5/trang, replies kèm cha, sort `created_at desc`)
- Auto-duyệt `isAutoApprove()` + `checkComment` (URL/phone/email/banned/spam/lowQuality `>=12 ký tự, >=40% chữ, không chung chung` + OpenAI moderation nếu `ai_enabled`)
- ID `crypto.randomBytes(4).hex` (không `Math.random`)

### 1.5 Ví EXP & download giá
- `GET/POST /api/economy` (`cid` 24hex hoặc Bearer): `checkin` 5-10 + streak bonus, `chargeForDownload` trừ `dl_cost` (sở hữu miễn phí), `creditCommentBonus` (+5 khi duyệt, chống farm: bigram duplicate, 2/ngày)
- `data/economy.json` qua GitHub API (fine-grained Contents RW `data/stats.json` + `data/comments.json`)

### 1.6 Đếm tải
- `POST /api/stats` (CSRF block) → `_store:countDl` → Upstash Redis `INCR dl:id` hoặc batch memory 1 commit/phút `data/stats.json`
- `GET /api/stats` public

### 1.7 Bảo mật đã harden (audit 12 mục)
- JWT `verifySbToken` HS256 + ES256 JWKS: `nbf/iat/iss/aud/exp+30s` (`_sb:isValidClaims`)
- CSRF `originStatus` same-origin cho mọi `POST` (comments/economy/ustats/presence/user-data/stats)
- CORS `Access-Control-Allow-Origin:*` chỉ GET public, `X-Frame-Options:SAMEORIGIN`, `CSP: script-src 'self'` (+ `unsafe-inline` còn do inline, sẽ bỏ khi tách hết)
- `siteOf`/`siteUrl` whitelist `host` + `SITE_URL` + `*.vercel.app`, bỏ tin mù `x-forwarded-host`
- `ALLOW_HOSTS` strict `https:` + no userinfo + no fallback resName
- `used_tickets` one-time + cleanup `delete where used_at < now()-1d`
- Cookie `admin.php` `httponly samesite Lax`, guest `cid` 24hex (sẽ ký HttpOnly)

## 2. Cấu trúc repo
```
blog-v2/
  index.html, game.html, go.html, category.html, profile.html, ...
  api/_lib.js, _sb.js, _lock.js, _bingo.js, _rate.js, _store.js, _github.js
  api/ticket.js, dl.js, comments.js, stats.js, economy.js, ustats.js, presence.js, user-data.js, meta.js, banners.js, game/[slug].js
  data/games.json, comments.json, stats.json, economy.json, banners.json, notice.json
  assets/js/sb-auth.js, sb-config.js, sb-board.js, game-read.js, game-detail.js, ...
  assets/css/manga.css, style.min.css
  shared/render.mjs
  admin.php, config.php (local), supabase-gating.sql, vercel.json, sw.js
```

## 3. Env (Vercel → Settings → Environment Variables, Secret, Production, Redeploy)
| Biến | Bắt buộc | Lấy ở đâu |
|---|---|---|
| `GITHUB_TOKEN` | Có | fine-grained PAT `Contents RW` cho `bichchixanh-collab/blog` |
| `LOCK_SECRET` | Có | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` ≥16 |
| `SUPABASE_JWT_SECRET` | Có | Supabase → Settings → JWT Keys → Legacy JWT secret |
| `SUPABASE_SERVICE_KEY` | Có | Supabase → Settings → API Keys → Secret `sb_secret_...` |
| `SUPABASE_URL` | Tùy | Mặc định `https://pmotbltodyyilarnvtpn.supabase.co` |
| `SITE_URL` | Tùy | `https://j2me.vercel.app` |
| `FILES_HOST` | Tùy | thêm host tải riêng |
| `TURNSTILE_SECRET` | Chỉ khi gắn widget | Cloudflare Turnstile |
| `UPSTASH_REDIS_REST_URL/TOKEN` | Tùy | Upstash Console |

Chi tiết xem `HUONGDAN.md`.

## 4. Chạy local
```bash
# XAMPP: đặt blog-v2 dưới htdocs
# config.php mẫu trong HUONGDAN.md
npm run validate   # kiểm tra data/games.json
```

## 5. Vận hành
- Đăng bài: `admin.php` → nhập → `gate` → `Xem trước` → `Lưu & Đồng bộ` (backup 10 bản, sitemap)
- Đổi gate: vé cũ chết (`gateHash`), user bấm Tải lại
- Bình luận: admin duyệt, auto-duyệt sạch, AI nếu bật

## 6. Ý tưởng mở rộng miễn phí
Xem `YTUONGKHAC.md` (100% free, không tốn phí Vercel/Supabase/GitHub).
