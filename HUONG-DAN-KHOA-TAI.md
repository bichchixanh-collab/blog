# HƯỚNG DẪN KHÓA TẢI GAME (J2ME.VERCEL.APP)

Tài liệu đầy đủ cho hệ thống điều kiện tải + chống crack link. Code trong `blog-v2/`.

---

## 1. Tổng quan: 2 chế độ khóa

| | 🔒 Khóa mềm (khách) | 🔒 Khóa cứng (đã đăng nhập) |
|---|---|---|
| Ai | Không cần tài khoản | Phải đăng nhập ở `dang-nhap.html` |
| Số liệu | localStorage trên máy (sửa devtools được) | Server đếm theo `uid` Supabase (sửa máy vô ích) |
| Bình luận | Đếm theo tên đã dùng | Đếm chính xác theo tài khoản |
| Vé tải | Vẫn cần vé + proof | Vé `hard:1`, kiểm fail-closed |

Quy tắc chung: **mọi nút Tải đều đi qua `go.html` bằng vé server** (`/api/ticket` → `go.html?ticket=` → `/api/dl?ticket=` → 302 file). Không vé hợp lệ thì không tải được bài khóa, dù biết URL API.

---

## 2. Các loại khóa (`gate` trong `data/games.json`)

| `type` | Ý nghĩa | Tham số |
|---|---|---|
| `none` | Mở tự do | — |
| `xp` | Đủ tổng XP | `xp` |
| `stats` | **Khóa theo chỉ số, tích nhiều điều kiện (AND)** | `require:{minutes,likes,completed,comments}` — chỉ field nào admin tick mới áp dụng |
| `login` | **Bắt đăng nhập** (không cần chỉ số gì thêm) | — |

Cờ dùng chung cho mọi loại (trừ `none`): `"login":1` = **bắt buộc đăng nhập** (khách bị chặn ngay ở modal, dù đủ chỉ số local).

Ví dụ:
```json
"gate": { "type": "stats", "login": 1, "require": { "minutes": 30, "likes": 5, "completed": 3, "comments": 3 } }
"gate": { "type": "login" }
```

4 chỉ số stats lấy ở đâu:
- **minutes**: heartbeat 60s/tab đang mở (local `j2me_online_ms` + server `user_stats.minutes` nếu đã login).
- **likes**: nút Thích/♥ (`j2me_favs` + server khi login).
- **completed**: nút "Phá đảo?" (`j2me_done` + server khi login).
- **comments**: bình luận **đã duyệt** — khách đếm theo tên đã dùng, thành viên đếm theo tài khoản.

---

## 3. Đăng bài khóa (admin.php, chạy local)

1. Mở `admin.php` → đăng nhập admin.
2. Mục **🔒 Khóa tải** → chọn loại ở dropdown:
   - `Khóa theo chỉ số` → tick từng điều kiện (⏱/👍/🏆/💬) + nhập số. Tích nhiều = phải đủ TẤT CẢ.
   - `Bắt đăng nhập` → chỉ cần tài khoản, không cần chỉ số.
   - Muốn vừa chỉ số vừa bắt login: tick thêm **🔐 Bắt buộc đăng nhập**.
3. Nhập link file như thường — link **tự mã hóa AES-256-GCM** (`ENC:`) khi lưu (nếu đã cấu hình `LOCK_SECRET`, xem mục 4).
4. **👁 Xem trước** để thử modal khóa, **💾 Lưu & Đồng bộ** để đăng.
5. Bài cũ còn link plaintext: bấm **🔐 Mã hóa link cũ** ở danh sách game (mã hóa hàng loạt, giữ nguyên link đã `ENC:`).

> Chú ý `Xem trước`: bài preview chưa có trong DB nên nút Tải báo lỗi vé — đúng thiết kế, chỉ test giao diện modal.

---

## 4. Thiết lập bắt buộc (làm 1 lần)

### 4.1. Supabase (cho khóa cứng)

1. Supabase Dashboard → **SQL Editor** → dán toàn bộ `blog-v2/supabase-gating.sql` → Run.
   - Tạo bảng `public.user_stats(uid, minutes, likes, completed, bingo, pet_xp, updated_at)`.
   - RLS bật, **không policy** → chỉ `service_role` (server) đọc/ghi.
   - Chạy lại file này an toàn (có `IF NOT EXISTS`).
2. Vercel → Project **Settings → Environment Variables** → thêm:
   - `SUPABASE_JWT_SECRET` = JWT Secret (Supabase → Settings → API). Dùng để verify chữ ký đăng nhập.
   - `SUPABASE_SERVICE_KEY` = `service_role` key (**giữ kín tuyệt đối**). Dùng để đọc/ghi `user_stats` + đọc bảng `senpai` (xp, huy hiệu).
   - Redeploy sau khi thêm.

### 4.2. `LOCK_SECRET` (vé tải + mã hóa link)

- Vercel env `LOCK_SECRET`: chuỗi ngẫu nhiên **≥16 ký tự**.
- Local (máy chạy `admin.php`): set env `LOCK_SECRET` **cùng giá trị**, hoặc thêm vào `config.php` (file local, không commit):
  ```php
  $config['LOCK_SECRET'] = '...giá trị giống Vercel...';
  ```
- `admin.php` hiện trạng thái ngay dưới mục khóa tải: xanh = đã bật, đỏ = link lưu plaintext.
- **Thiếu secret** = mọi thứ vẫn chạy ở chế độ mềm, vé ký khóa mặc định.

---

## 5. Luồng kỹ thuật (để debug)

```
[trang game] bấm Tải
  → modal: kiểm tra local (khóa mềm) / hiện checklist ✓/✗ từng điều kiện
  → bấm xác nhận → GET /api/ticket?id&res&proof (+ Authorization nếu login)
      → server: game tồn tại? gate? (login? stats? xp?)
      → đủ → {ticket} (HMAC, hết hạn 15 phút, ràng buộc đúng gate lúc cấp)
  → chuyển go.html?ticket=
      → GET /api/meta?ticket= → {tên game, hostname (KHÔNG có URL), gate}
      → kiểm tra lại checklist → nút "Mở link" = /api/dl?ticket=
  → /api/dl verify vé → giải mã URL (ENC:) → host allowlist? → 302 file
      (host lạ → cấp vé mới về lại go.html cảnh báo)
```

Điểm chống crack:
- View-source trang game: `__GAME_DATA__` **đã strip `jar`**; `go.html` chỉ biết hostname.
- `games.json` public: bài mới/sửa có link `ENC:` (AES-GCM, AAD=id game) — đọc được cũng không mở được.
- Sửa gate sau khi cấp vé → `gateHash` lệch → vé chết.
- Vé hết hạn 15 phút, HMAC timing-safe, rate-limit 30–120 req/phút/IP theo route.

---

## 6. Giới hạn trung thực (đọc kỹ)

1. **Khách = khóa mềm**: số local sửa devtools được. Muốn cứng 100% → bật cờ `login` (bắt đăng nhập).
2. **Tên bình luận của khách** ké được (không tài khoản thì không có danh tính thật). Thành viên thì đếm theo `uid`, hết ké.
3. **Heartbeat farm**: user treo tab vẫn +phút (đúng định nghĩa "online"). Server chặn gọi dồn (<50s/lần).
4. **Supabase Free pause** sau 1 tuần không hoạt động → request đầu chậm 10–30s; user cứng có thể thấy `503 stats unavailable` 1 lần rồi thử lại là qua.
5. **Vercel Hobby**: mỗi lượt tải = 3 invocations (ticket+meta+dl, mỗi cái vài chục ms) trong quota 1M/tháng; heartbeat 60/user-giờ. Supabase Free: unlimited API requests. Không chạm GitHub (vé không ghi commit nào).
6. Đổi `LOCK_SECRET`/`SUPABASE_*` → vé cũ chết hàng loạt là **đúng thiết kế**, user bấm Tải lại là có vé mới.

---

## 7. Xử lý sự cố

| Hiện tượng | Nguyên nhân likely | Cách xử |
|---|---|---|
| `403 locked (minutes/likes/...)` | Chưa đủ chỉ số | Xem checklist trong modal, cày thêm |
| `403 login required` | Bài bắt đăng nhập | Đăng nhập ở `dang-nhap.html` |
| `503 stats unavailable` | Supabase ngủ/lỗi | Đợi 30s thử lại; kiểm tra env service key |
| `Vé hết hạn` ở go.html | Vé quá 15 phút | Về trang game bấm Tải lại |
| Admin báo đỏ "CHƯA mã hóa" | Thiếu `LOCK_SECRET` local | Set env hoặc `config.php` |
| Vẫn thấy code cũ sau deploy | SW/HTTP cache | Ctrl+F5; SW đã bump `j2me-v8` tự purge |
| Test nhanh server | — | `node --check api/*.js` trước mọi commit |

File liên quan: `api/_lock.js`, `api/_sb.js`, `api/ustats.js`, `api/ticket.js`, `api/meta.js`, `api/dl.js`, `api/comments.js`, `api/game/[slug].js`, `shared/render.mjs`, `game.html`, `go.html`, `index.html`, `category.html`, `profile.html`, `admin.php`, `supabase-gating.sql`.
