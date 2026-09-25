# Ý tưởng khác nên thêm — 100% miễn phí (không tốn phí Vercel/Supabase/GitHub)

> Nguyên tắc: chỉ dùng free tier có sẵn (Vercel Hobby 1M invocations, Supabase 500MB/5GB egress, GitHub API 5k/h, Upstash free, Cloudflare Turnstile free). Không thêm dịch vụ trả phí.

## 1. Chất lượng cộng đồng (không tốn phí)
- **Cấp độ comment:** hiện chỉ `isLowQuality` (12 ký tự, 40% chữ), nâng lên tính điểm `0-100` (độ dài + số từ + bigram) → hiện badge `Chất`/`Sơ sài` trước khi gửi, nhưng vẫn cho gửi (không chặn, chỉ gắn nhãn để admin ưu tiên duyệt).
- **Báo cáo bình luận:** nút `⚑ Báo xấu` → `POST /api/report` ghi `data/reports.json` qua GitHub (như comments), admin duyệt/xóa.
- **Thả cảm xúc:** `👍 👎 ❤️` per comment (localStorage + `data/reactions.json`), không cần login.

## 2. Khóa tải thân thiện hơn (giữ free)
- **Đọc bài thay phút online:** đã làm `read 10s` mặc định; mở rộng thành `scroll 50% + 10s` (IntersectionObserver free, không tốn API).
- **Nhiệm vụ hàng ngày miễn phí:** `xem 3 game / thích 1 / đọc 1` → +10 XP (đã có `qInc` local, không tốn DB).
- **Mời bạn:** link `?ref=<uid>` → +5 XP khi bạn mới tải 1 game (chỉ local + `data/referrals.json`, không cần DB).

## 3. SEO & PWA (free)
- **RSS/JSON Feed:** `api/feed.js` đọc `data/games.json` trả `application/rss+xml` (Vercel serverless, cache 1h), submit Google/Bing.
- **Tự tạo OG image:** `api/og.js?game=id` dùng Canvas (node `canvas` free) vẽ thumb + tên game, cache `public, max-age=86400`.
- **PWA offline đọc:** `sw.js` đã cache `j2me-v7`, mở rộng precache `data/games.json` + `data/comments.json` (đã có).

## 4. Kiểm duyệt & an toàn (free)
- **Turnstile free:** Cloudflare Turnstile (100% free, không CAPTCHA) gắn vào `POST /api/comments` khi nào cần, env `TURNSTILE_SECRET` đã sẵn.
- **Rate-limit Upstash free:** `UPSTASH_REDIS_REST` free 10k/ngày, dùng cho `comments` + `ticket` burst, fallback memory khi thiếu.

## 5. Thống kê & gamification (free)
- **Bảng xếp hạng local + server:** `trang-xep-hang.html` đã có XP, thêm `top đọc nhiều` từ `localStorage j2me_read_*` (không tốn DB).
- **Streak điểm danh:** đã có `economy: streak`, thêm thông báo push local (Notification API free, không cần FCM).
- **Huy hiệu free:** “Đọc 10 bài”, “Thích 20”, “Tải 5” (đã có `pf_b*` badge, chỉ thêm điều kiện).

## 6. Kỹ thuật tách JS & CSP (free)
- **Tách inline `game.html` (~60KB) thành `assets/js/game-core.js`** → bỏ `unsafe-inline` trong `vercel.json` CSP `script-src 'self'` (đã demo `game-read.js`), giảm XSS, cache riêng.

## 7. Không nên làm (tốn phí)
- Tránh: Algolia/Meilisearch hosted, Resend email trả phí, Vercel Analytics pro, Supabase vector/edge trả phí. Thay bằng GitHub JSON + localStorage + Turnstile free như trên.

Mỗi ý tưởng trên chỉ thêm 1 file `api/*.js` hoặc `assets/js/*.js` + 1 JSON trong `data/`, không vượt quota Hobby.
