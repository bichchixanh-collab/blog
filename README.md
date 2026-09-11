# Java Game WAP Blog

Trang giới thiệu và cho tải game Java J2ME. Giao diện là HTML/CSS/JS thuần (không
build step). Trang chi tiết bài viết (`/game/<slug>.html`) được render qua
**Vercel Serverless Function** để trả đúng `<title>`, `meta description`,
`og:*`, JSON-LD cho từng game ngay từ HTML gốc — phục vụ SEO/chia sẻ mạng xã
hội chính xác cho từng bài, thay vì dùng chung 1 file tĩnh có meta hardcode.

## Cấu trúc project

```
.
├── index.html            # Trang chủ (tĩnh)
├── category.html         # Trang danh mục (tĩnh)
├── game.html              # Template trang chi tiết game: HTML/CSS/JS hiển thị,
│                           #   dùng làm nguồn cho cả local (XAMPP) lẫn Serverless Function
├── api/
│   └── game/
│       └── [slug].js     # Vercel Serverless Function: đọc games.json theo slug,
│                           #   thay phần <head> của game.html bằng meta đúng, trả HTML
├── script.js              # JS dùng chung cho index.html
├── style.css              # CSS toàn site
├── data/
│   └── games.json         # Dữ liệu game (tên, slug/id, mô tả, ảnh, link tải...)
├── vercel.json             # Rewrite /game/slug.html -> /api/game/slug + cache header
├── .htaccess               # Rewrite tương đương cho Apache/XAMPP khi test local
├── robots.txt
└── sitemap.xml
```

URL bài viết có dạng đẹp, tiếng Việt không dấu:
```
/game/kiem-linh-chu-tien-chi-chien.html
```

**Trên Vercel (production):** `vercel.json` rewrite URL này sang
`/api/game/kiem-linh-chu-tien-chi-chien`. Function trong `api/game/[slug].js`
đọc `data/games.json`, tìm đúng game theo slug, lấy `game.html` làm khung, thay
phần `<head>` (title/meta/OG/JSON-LD) bằng nội dung đúng cho game đó rồi trả về
HTML hoàn chỉnh. Phần `<body>` và toàn bộ JS hiển thị/tương tác giữ nguyên như
`game.html` gốc — chỉ có SEO ở `<head>` là được server tính sẵn theo từng slug.
Nếu slug không tồn tại trong `games.json`, function trả HTTP 404 thật (đúng
chuẩn cho Google, không lập lờ như trang tĩnh báo lỗi nhưng status vẫn 200).

**Trên local (XAMPP):** không chạy được Node.js function, nên `.htaccess` dùng
cách cũ đơn giản hơn: rewrite `/game/slug.html` thẳng về `/game.html?id=slug`.
Giao diện hiển thị giống hệt bản trên Vercel, chỉ khác là phần SEO ở `<head>`
sẽ không được render đúng theo slug khi xem bằng XAMPP (vẫn đọc `game.html`
gốc với `<head>` mặc định) — điều này không ảnh hưởng gì vì XAMPP chỉ dùng để
test giao diện/logic, không phải nơi Google/bot thật crawl.

## Test local bằng XAMPP

1. Copy toàn bộ thư mục này vào `C:\xampp\htdocs\blog` (hoặc thư mục con bất kỳ trong `htdocs`).
2. Bật `mod_rewrite`: mở `C:\xampp\apache\conf\httpd.conf`, bỏ dấu `#` ở dòng:
   ```
   LoadModule rewrite_module modules/mod_rewrite.so
   ```
3. Cho phép `.htaccess` hoạt động: trong cùng file, tìm khối `<Directory "C:/xampp/htdocs">` và sửa:
   ```
   AllowOverride All
   ```
4. Restart Apache trong XAMPP Control Panel.
5. Truy cập `http://localhost/blog/` để kiểm tra. File `.htaccess` đã có sẵn trong repo, không cần tạo thêm.

> Lưu ý: `vercel.json` **không có tác dụng trên XAMPP** — Apache chỉ đọc `.htaccess`. Ngược lại khi deploy thật lên Vercel, chỉ `vercel.json` được dùng, `.htaccess` bị bỏ qua. Cứ để cả hai file cùng tồn tại, không xung đột.

## Dọn repo Git cũ và đẩy toàn bộ code mới lên

Dùng khi bạn muốn **thay thế sạch** toàn bộ nội dung repo GitHub hiện tại bằng bộ code đã fix này (xoá lịch sử commit cũ, xoá file cũ không còn dùng).

### Cách A — Giữ lại repo cũ nhưng xoá sạch file, commit lại từ đầu (khuyến nghị)

Cách này giữ nguyên remote GitHub đã nối với Vercel (không cần cấu hình lại project trên Vercel), chỉ làm sạch nội dung.

```bash
# 1. Vào thư mục repo local đang clone từ GitHub
cd duong-dan-toi-repo-cu

# 2. Xoá sạch mọi thứ đang có trong working directory (giữ lại .git)
git rm -rf --cached .
find . -maxdepth 1 ! -name '.git' ! -name '.' -exec rm -rf {} +

# 3. Copy toàn bộ file trong bộ code mới (đã giải nén blog-fixed.zip) vào đây
# ví dụ trên Windows PowerShell:
#   Copy-Item -Path "C:\duong-dan-blog-fixed\*" -Destination . -Recurse -Force
# ví dụ trên macOS/Linux:
#   cp -r /duong-dan-blog-fixed/. .

# 4. Add toàn bộ file mới
git add -A

# 5. Commit
git commit -m "Rebuild: fix rewrite URL tieng Viet, lightbox anh, popup treo, don sach code cu"

# 6. Đẩy lên nhánh chính (ép ghi đè nếu lịch sử lệch)
git push origin main --force
```

### Cách B — Làm sạch luôn cả lịch sử commit (repo "tinh khôi")

Dùng khi muốn xoá luôn lịch sử commit cũ, bắt đầu lại từ 1 commit duy nhất.

```bash
# 1. Vào thư mục repo local
cd duong-dan-toi-repo-cu

# 2. Tạo nhánh mới không có lịch sử (orphan branch)
git checkout --orphan fresh-start

# 3. Xoá hết file cũ khỏi working directory
git rm -rf --cached .
find . -maxdepth 1 ! -name '.git' ! -name '.' -exec rm -rf {} +

# 4. Copy toàn bộ file bộ code mới vào đây (xem ví dụ lệnh copy ở Cách A, bước 3)

# 5. Add + commit
git add -A
git commit -m "Initial commit: java game wap blog (fixed)"

# 6. Xoá nhánh main cũ, đổi tên nhánh mới thành main
git branch -D main
git branch -m main

# 7. Ép đẩy lên GitHub, ghi đè toàn bộ lịch sử cũ trên remote
git push origin main --force
```

> ⚠️ `--force` sẽ xoá vĩnh viễn lịch sử commit cũ trên GitHub. Nếu không chắc, có thể backup repo cũ trước bằng cách tạo 1 bản clone riêng hoặc đổi tên nhánh cũ (`git branch backup-cu`) trước khi force push.

### Cách C — Repo hoàn toàn mới (không giữ gì từ repo cũ)

Nếu đơn giản là muốn bỏ hẳn repo cũ, tạo repo GitHub mới:

```bash
# 1. Tạo repo mới trên GitHub (qua giao diện web), không cần README/license mặc định

# 2. Vào thư mục chứa bộ code mới (đã giải nén blog-fixed.zip)
cd duong-dan-blog-fixed

# 3. Khởi tạo git
git init
git branch -M main

# 4. Add + commit
git add -A
git commit -m "Initial commit: java game wap blog (fixed)"

# 5. Gắn remote tới repo GitHub mới tạo
git remote add origin https://github.com/<username>/<ten-repo-moi>.git

# 6. Đẩy lên
git push -u origin main
```

Sau đó vào Vercel → New Project → Import repo mới này.

## Deploy lên Vercel

### Nếu project Vercel đã tồn tại (nối sẵn với repo GitHub)
Chỉ cần push code mới lên nhánh `main` (theo Cách A hoặc B ở trên) — Vercel sẽ tự động build & deploy lại, không cần thao tác gì thêm trên dashboard.

### Nếu tạo project Vercel mới
1. Vào [vercel.com](https://vercel.com) → **Add New → Project**.
2. Chọn repo GitHub vừa push code lên.
3. Ở bước cấu hình:
   - **Framework Preset**: chọn `Other`.
   - **Root Directory**: để mặc định (`.`) nếu code nằm ngay gốc repo.
   - **Build Command**: để trống.
   - **Output Directory**: để trống hoặc `.`.
   - Không cần cấu hình gì thêm cho `api/game/[slug].js` — Vercel tự nhận diện
     bất kỳ file `.js` nào trong thư mục `api/` là 1 Serverless Function.
4. Bấm **Deploy**.
5. Sau khi deploy xong, kiểm tra 2 việc:
   - Mở `https://<ten-project>.vercel.app/game/kiem-linh-chu-tien-chi-chien.html`
     phải ra đúng trang chi tiết game (không phải 404).
   - Xem "View Page Source" (Ctrl+U, **không phải** F12/Inspect — cần xem đúng
     HTML thô server trả về) và kiểm tra `<title>` đúng tên game, không còn là
     tiêu đề mặc định. Đây là cách xác nhận SEO đã hoạt động đúng: nếu
     "View Page Source" hiện đúng tên game ngay từ đầu (không cần đợi trang
     chạy xong), nghĩa là Serverless Function đã render đúng.

### Deploy bằng Vercel CLI (tuỳ chọn, không cần GitHub)

```bash
npm i -g vercel
cd duong-dan-blog-fixed
vercel --prod
```

## Giới hạn khi dùng Serverless Function (Vercel Free/Hobby plan)

- Miễn phí gồm 100 GB-Hours execution/tháng và 100 GB bandwidth/tháng — với
  quy mô blog game vừa phải, mức này thường dư dùng.
- Hobby plan chỉ dành cho mục đích cá nhân/phi thương mại theo điều khoản của
  Vercel. Nếu site có doanh thu đáng kể (ads, affiliate...), cần cân nhắc nâng
  cấp Pro.
- Có thể có độ trễ cold-start vài trăm ms cho request đầu tiên sau thời gian
  dài không có traffic — không ảnh hưởng SEO, chỉ ảnh hưởng nhẹ tốc độ tải lần
  đầu.
- Nếu vượt quota tháng, Vercel tạm dừng function tới kỳ hạn mức tiếp theo (cần
  theo dõi ở Vercel Dashboard → Usage nếu traffic tăng bất thường).

## Cập nhật dữ liệu game

Thêm/sửa game trong `data/games.json`. Trường `id` chính là slug dùng trong URL
(`/game/<id>.html`), nên đặt `id` không dấu, chữ thường, cách nhau bằng dấu `-`,
ví dụ: `"id": "vo-lam-truyen-ky"`. Không cần sửa `vercel.json` hay `.htaccess`
khi thêm game mới — rewrite dùng chung 1 pattern cho mọi slug.

--------------------------------
Xong. Lỗi đó không phải bug code — API bình luận/đếm tải đã deploy lên Vercel nhưng chưa có GITHUB_TOKEN nên không ghi được data/comments.json/data/stats.json, API trả 503 và web hiện đúng câu đó. Sửa như sau:

1. Tạo token GitHub (2 phút)

Vào GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token (classic).
Đặt tên ví dụ j2me-vercel-api, thời hạn nên để dài (hết hạn là tính năng lại dừng với đúng lỗi này — ghi chú lại ngày hết hạn).
Chỉ tick duy nhất scope repo, Generate rồi copy token (chỉ hiện 1 lần).
2. Gắn vào Vercel

Vercel Dashboard → project → Settings → Environment Variables → Add New: Key GITHUB_TOKEN, Value dán token, Environment tick Production (thêm Preview nếu bạn dùng) → Save.
Sang tab Deployments → Deploy mới nhất → ⋯ → Redeploy (đổi biến môi trường bắt buộc redeploy mới có tác dụng).
3. Kiểm tra

Mở https://J2ME.VERCEL.APP/api/comments?game=<id-game> — thấy JSON {avg, total, comments} là API sống.
Gửi thử 1 bình luận ngoài web → thấy báo "Đã gửi! Bình luận hiện sau khi admin duyệt."
Tôi đã thêm sẵn mục Duyệt bình luận trong admin.php: mở admin là thấy danh sách chờ duyệt, bấm Duyệt/Xóa (đọc/ghi thẳng lên GitHub bằng token trong config.php, có CSRF chống xóa nhầm).
Lưu ý thêm:

Đếm lượt tải dùng chung token này — chưa gắn thì số lượt tải vẫn hiện số tĩnh cũ, không lỗi gì.
Token này ghi được repo nên giữ kín như token đồng bộ bài; nếu lộ thì revoke và thay cả 2 chỗ (Vercel + config.php).
Chống spam hiện tại: bẫy bot ẩn, giới hạn 1 bình luận/5 phút/máy, 1 lượt tải/ngày/máy/game, nội dung giới hạn độ dài và bắt buộc duyệt tay — đủ cho web nhỏ; nếu sau này bị spam nhiều thì tính thêm.
