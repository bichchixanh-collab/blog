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

## 7. Bắt buộc trên tinh thần tự nguyện — ép tương tác nhưng thấy tự nguyện (100% free)

> Mục tiêu: vẫn phải tương tác mới tải được, nhưng người xem cảm giác *mình muốn* chứ không bị ép. Dùng tâm lý game: tiến độ, quà, lựa chọn, tò mò, thuộc về. Toàn bộ chỉ JS + localStorage + GitHub JSON, không tốn phí.

- **Ảo giác lựa chọn:** Hiện 3 cách mở khóa *tự chọn 1*: “Đọc 10s / Thích 1 game / Xem 1 ảnh” — thực chất đều là tương tác, nhưng được chọn nên thấy tự nguyện. Code: `localStorage j2me_choice`, không cần DB.
- **Thanh EXP không phải khóa:** Đổi chữ “Yêu cầu 10s” thành “Bạn đang ở 70% để nhận quà tải — đọc thêm 3s nữa là đủ” + progress bar EXP như game. Cảm giác cày level, không bị chặn.
- **Rương kho báu:** Sau khi đọc đủ 10s, nút Tải biến thành rương rung `🎁` — bấm mở ra link tải + hiệu ứng confetti Canvas (free). Cảm giác *nhận thưởng* thay vì *vượt rào*.
- **Pet đói cho ăn:** Senpai pet ở góc kêu “Đói quá Senpai ơi~” — cho ăn bằng cách cuộn đọc/like, pet no bụng thì đưa link tải “Cảm ơn Senpai!” — tạo tình cảm, không ép.
- **Sương mù bản đồ:** Mô tả game ban đầu làm mờ `filter:blur(4px)` phần cuối, cuộn + đọc 10s thì sương tan dần (IntersectionObserver + `sessionStorage`). Tò mò tự kéo để xem, không thấy khóa.
- **Câu đố 1 câu:** Trích 1 chi tiết trong mô tả (vd “Game này bao nhiêu MB?”) → 2 đáp án → trả lời đúng mở tải. Cảm giác kiểm tra hiểu biết, không spam comment. Đáp án lưu trong `data/games.json` (`quiz:{q,a}`).
- **Góp cho cộng đồng:** Hiện “Cộng đồng đã góp 127 lượt thích, còn thiếu 1 của bạn để mở kho báu chung”. Con số thật từ `localStorage + /api/stats` (free), tạo cảm giác thuộc về.
- **Quà hẹn giờ tự nhiên:** “Quà tải sẽ gói xong trong 10s, trong lúc chờ ngắm ảnh demo nhé!” — chờ tự nhiên, không đếm ngược khóa.
- **Gacha 1 lượt free:** Sau tương tác được quay `assets/js/gacha.js` (đã có) — tải là phần thưởng phụ sau khi quay, không phải điều kiện chính.
- **Khám phá vết nứt:** Giấu 1 icon `✦` trong bài, tìm thấy + bấm → +3s đọc miễn phí — cảm giác thám hiểm tự nguyện.

> Tất cả chỉ thêm `sessionStorage` + `setInterval` + CSS, không gọi API tốn quota. Người xem làm vì *muốn* (quà, tò mò, pet) chứ không vì *bị bắt*.

## 8. Không nên làm (tốn phí)
- Tránh: Algolia/Meilisearch hosted, Resend email trả phí, Vercel Analytics pro, Supabase vector/edge trả phí. Thay bằng GitHub JSON + localStorage + Turnstile free như trên.

Mỗi ý tưởng trên chỉ thêm 1 file `api/*.js` hoặc `assets/js/*.js` + 1 JSON trong `data/`, không vượt quota Hobby.
