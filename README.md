# J2ME WAP — Kho game Java (`blog-v2/`)

Web tải game Java J2ME giao diện WAP anime: 11 trang HTML + API serverless (Vercel) + Supabase (auth/đếm) + GitHub (lưu data). Chi tiết hệ khóa tải xem `HUONG-DAN-KHOA-TAI.md`.

---

## 1. Bản đồ repo

| Đường dẫn | Vai trò |
|---|---|
| `index.html`, `game.html`, `category.html`, `profile.html`, `goc-senpai.html`, `go.html`, `offline.html`, `404.html`, `dang-nhap.html`, `lien-he.html`, `trang-xep-hang.html` | 11 trang web (HTML + inline JS/CSS) |
| `api/*.js` | Serverless functions Vercel (`dl`, `ticket`, `meta`, `ustats`, `comments`, `stats`, `banners`, `game/[slug]`, `_lock`, `_sb`, `_bingo`, `_lib`, `_rate`, `_store`, `_github`) |
| `data/games.json` | Database game (admin ghi, web đọc) |
| `data/comments.json`, `data/stats.json` | Bình luận + lượt tải (đồng bộ qua GitHub API) |
| `assets/js/` (`app.js`, `senpai.js`, `sb-auth.js`, `sb-sync.js`, ...) | JS client |
| `assets/css/manga.css`, `style.min.css` | Giao diện |
| `admin.php` + `config.php` | **Tool local, KHÔNG commit** — đăng bài, duyệt comment, mã hóa link |
| `supabase-gating.sql` | Migration bảng `user_stats` (chạy 1 lần) |
| `HUONG-DAN-KHOA-TAI.md` | Hướng dẫn chi tiết hệ khóa tải |
| `sw.js` | Service Worker (cache `j2me-v6`) |

Quy ước: `game.html` render client + SSR qua `shared/render.mjs` (sửa giao diện phải sửa cả 2 cho khớp pixel).

---

## 2. GitHub — repo `bichchixanh-collab/blog`, nhánh `main`

- Push thẳng `main` (không PR trong workflow này). Vercel tự deploy mỗi push (1–2 phút).
- Có commit **tự động** chạy nền: `update games`, `update sitemap`, `comments: ...`, `stats: ...` (do admin/sync đẩy). Push bị `rejected` là bình thường → `git fetch origin` → `git rebase origin/main` (sạch vì khác file) → push lại. **Không force-push.**
- File local KHÔNG commit: `admin.php`, `config.php`, `deploy_file.py`, `assets/css/main.min.css`.
- `deploy_file.py` là script phá repo cũ (xóa + force-push) — repo đã ổn định, **đừng chạy**.
- Sau deploy web mới: **Ctrl+F5** 1 lần (xả SW/cache cũ).

---

## 3. Vercel — project `blog` (team `bichchixanh-collab`), domain `j2me.vercel.app`

Đường dẫn: Dashboard → project `blog` → **Settings → Environments** → bảng **Environment Variables**.

- Type luôn chọn **Secret** cho các biến dưới (trừ khi ghi rõ).
- Cột Environments tick **Production** (web live chạy Production).
- Thêm/sửa biến xong **bắt buộc Redeploy** (tab Deployments → ⋯ → Redeploy), biến mới chỉ có tác dụng sau deploy.

### 3.1. Bảng biến môi trường (đủ 12)

| Biến | Mức | Lấy ở đâu | Thiếu thì sao |
|---|---|---|---|
| `GITHUB_TOKEN` | Cần | GitHub → Settings → Developer settings → Personal access tokens → token có quyền `repo` | Bình luận không gửi được (503), đếm tải chỉ memory, sitemap/admin không đồng bộ GitHub |
| `LOCK_SECRET` | Cần (khóa) | Tự tạo: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` (≥16 ký tự) | Vé tải + mã hóa link rớt về chế độ mềm |
| `SUPABASE_JWT_SECRET` | Cần (khóa cứng) | Supabase → Settings → **JWT Keys** → *Legacy JWT secret* → Reveal | Không xác thực được đăng nhập → chỉ khóa mềm |
| `SUPABASE_SERVICE_KEY` | Cần (khóa cứng) | Supabase → Settings → **API Keys** → *Secret keys* (`sb_secret_...`, đừng lấy `sb_publishable_`) | Server không đọc/ghi `user_stats` → khóa cứng lỗi 503 |
| `GITHUB_REPO` / `GITHUB_BRANCH` | Tùy chọn | Mặc định code đã có (`bichchixanh-collab/blog`, `main`) | Không cần set |
| `SUPABASE_URL` | Tùy chọn | Mặc định code đã có URL public project | Không cần set |
| `SITE_URL` | Tùy chọn | Domain chính, vd `https://j2me.vercel.app` | Tự lấy từ host request |
| `FILES_HOST` | Tùy chọn | Host file riêng nếu có (thêm vào allowlist tải) | Chỉ tải được từ drive/mediafire/github/jsdelivr |
| `TURNSTILE_SECRET` | ⚠️ Tùy chọn | Cloudflare Turnstile dashboard | **Chỉ set khi đã gắn widget captcha vào form** — web hiện chưa có widget, set vào là 100% bình luận lỗi captcha |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Tùy chọn | Upstash Console | Không có thì đếm tải bằng memory + gom batch 1 commit/phút |

### 3.2. Quota cần biết (Hobby)
- Functions: **1M invocations + 4 CPU-giờ/tháng**. Mỗi lượt tải = 3 calls (ticket+meta+dl, mỗi cái vài chục ms); heartbeat = 60 calls/giờ/user đã login. Web nhỏ thì dư; chạm ~70% thì giãn heartbeat hoặc gộp `meta` vào `ticket`.
- Supabase Free: **unlimited API requests**, DB 500MB, egress 5GB — heartbeat/like thoải mái. Lưu ý: project pause sau 1 tuần không hoạt động (request đầu chậm 10–30s).
- GitHub API: vé tải **không tốn call nào** (HMAC + đọc file local).

---

## 4. Supabase — project `j2me-wap`

Vào https://supabase.com → project → làm lần lượt:

1. **Chạy SQL 1 lần**: **SQL Editor** → New query → dán toàn bộ `supabase-gating.sql` → Run → Success. Tạo bảng `public.user_stats(uid, minutes, likes, completed, bingo, pet_xp, updated_at)`, RLS bật, không policy (chỉ `service_role` chạm được). Chạy lại an toàn (`IF NOT EXISTS`).
2. **Lấy keys** (xem bảng mục 3.1): **Settings → API Keys** (secret `sb_secret_...`), **Settings → JWT Keys → Legacy JWT secret** (Reveal).
3. Auth (email/pass/link ma thuật) dùng sẵn qua `dang-nhap.html` — không cần cấu hình thêm.

---

## 5. Admin local (`admin.php` + `config.php`)

`admin.php` chạy local (XAMPP/hop `j2me.alwaysdata.net` của bạn), **không commit**. Cần `config.php` cùng thư mục (mẫu đúng cú pháp — trong `return [...]` dùng `=>`):

```php
<?php
// File local - KHÔNG commit lên GitHub
return [
    'GITHUB_TOKEN' => 'ghp_...',          // token repo (thu hồi ngay nếu từng lộ)
    'GITHUB_REPO'  => 'bichchixanh-collab/blog',
    'GITHUB_BRANCH'=> 'main',
    'GITHUB_PATH'  => 'data/games.json',
    'LOCK_SECRET'  => '...GIỐNG HỆT Vercel...',  // khác nhau là Vercel không giải mã được
    'ADMIN_USER' => 'admin',
    'ADMIN_PASS' => '...hash...',          // tạo bằng: php -r "echo password_hash('MAT_KHAU_MOI', PASSWORD_DEFAULT), PHP_EOL;"
];
```

Luồng đăng bài: nhập game → mục **🔒 Khóa tải** chọn loại + tick điều kiện + số → **👁 Xem trước** thử modal → **💾 Lưu & Đồng bộ** (ghi `data/games.json` + backup + push GitHub + sitemap). Link file **tự mã hóa `ENC:`** khi lưu nếu có `LOCK_SECRET` (dòng trạng thái trong form báo xanh/đỏ). Bài cũ còn plaintext: bấm **🔐 Mã hóa link cũ** ở danh sách game.
Duyệt bình luận trong admin (pending → approved). Backup tự giữ 10 bản (`data/backups`), có nút Khôi phục.

---

## 6. Vận hành hàng ngày

- **Đăng bài khóa**: admin → loại khóa → tick điều kiện → lưu. Muốn ép login: chọn `Bắt đăng nhập` hoặc tick `🔐 Bắt buộc đăng nhập`.
- **Đổi điều kiện bài đã đăng**: sửa gate → **vé cũ chết ngay** (ràng buộc `gateHash`), user bấm Tải lại là có vé mới — đúng thiết kế.
- **Kiểm tra khóa cứng**: đăng nhập web → Góc Senpai cày → mở game khóa → modal hiện **🔒 Theo tài khoản** + checklist ✓/✗.
- ** comment không lên số**: xem dòng nhỏ trong popup (ghi đang tính theo tên nào/tài khoản nào), Ctrl+F5, đợi duyệt (pending không tính).

## 7. Xử lý sự cố nhanh

| Hiện tượng | Cách xử |
|---|---|
| `403 locked (minutes/likes/...)` | Chưa đủ chỉ số — cày thêm theo checklist |
| `403 login required` | Bài bắt đăng nhập (`dang-nhap.html`) |
| `503 stats unavailable` | Supabase ngủ/lỗi hoặc thiếu service key — đợi 30s thử lại |
| Vé hết hạn ở `go.html` | Vé 15 phút — về trang game bấm Tải lại |
| Admin báo đỏ mã hóa | Thiếu `LOCK_SECRET` local (env hoặc `config.php`) |
| Web hiện code cũ sau deploy | Ctrl+F5 (SW `j2me-v6` tự purge cache cũ) |
| Push rejected | Remote có commit auto → `fetch` + `rebase origin/main` + push lại |
| Bình luận 403 toàn bộ | Kiểm tra có lỡ set `TURNSTILE_SECRET` mà chưa gắn widget không |

Chi tiết khóa tải (schema `gate`, luồng vé, mã hóa, test đã chạy): xem **`HUONG-DAN-KHOA-TAI.md`**.
