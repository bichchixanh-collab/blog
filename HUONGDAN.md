# Hướng dẫn setup từ đầu — Vercel + Supabase + GitHub

> Dành cho người mới clone `bichchixanh-collab/blog` nhánh `main`, thư mục `blog-v2`.

## 0. Yêu cầu
- Node ≥18, Git, XAMPP (PHP ≥8), tài khoản GitHub/Vercel/Supabase (free).

## 1. GitHub: tạo fine-grained PAT
1. `github.com/settings/personal-access-tokens/fine-grained` → `Generate new token`
2. Chọn repo `bichchixanh-collab/blog`, `Repository permissions: Contents = Read and write`
3. Copy `github_pat_...` (chỉ hiện 1 lần). Classic `ghp_...` không dùng nữa.

## 2. Supabase: tạo project + chạy SQL
1. `supabase.com` → New project `j2me-wap` (region SG), đợi 2 phút
2. **SQL Editor** → New query → dán toàn bộ `supabase-gating.sql` → Run:
```sql
-- user_stats (đếm cứng), used_tickets (one-time), RLS enable, index
create table if not exists public.user_stats (
  uid uuid primary key, minutes integer not null default 0,
  likes text[] not null default '{}', completed text[] not null default '{}',
  bingo jsonb not null default '{}', pet_xp integer not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.user_stats add column if not exists bingo jsonb not null default '{}';
alter table public.user_stats add column if not exists pet_xp integer not null default 0;
alter table public.user_stats enable row level security;
create table if not exists public.used_tickets (jti text primary key, used_at timestamptz not null default now());
alter table public.used_tickets enable row level security;
create index if not exists idx_used_tickets_used_at on public.used_tickets (used_at);
do $$ begin if exists (select 1 from information_schema.tables where table_schema='public' and table_name='senpai') then execute 'alter table public.senpai enable row level security'; end if; end $$;
```
Chạy lại an toàn (`IF NOT EXISTS`). **Cron dọn** (tuỳ): `delete from public.used_tickets where used_at < now() - interval '1 day';` (pg_cron hoặc Vercel Cron).
3. **Settings → API Keys** → copy `Secret` `sb_secret_...` (làm `SUPABASE_SERVICE_KEY`), **Settings → JWT Keys → Legacy JWT secret → Reveal** (làm `SUPABASE_JWT_SECRET`), **Settings → General → Project URL** (làm `SUPABASE_URL` nếu cần).
4. Auth mặc định đã bật email/pass + magic link qua `dang-nhap.html`, không cần cấu hình thêm. Supabase free pause sau 7 ngày không request (request đầu chậm 10-30s).

## 3. Vercel: import + env
1. `vercel.com` → Add New Project → Import `bichchixanh-collab/blog` → Root Directory `blog-v2` (nếu repo có nhiều thư mục)
2. **Settings → Environment Variables** → Add (Type Secret, Env Production):
```
GITHUB_TOKEN=github_pat_...
LOCK_SECRET=<random 32 hex, vd node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
SUPABASE_JWT_SECRET=<Legacy JWT secret>
SUPABASE_SERVICE_KEY=sb_secret_...
GITHUB_REPO=bichchixanh-collab/blog (tùy)
GITHUB_BRANCH=main (tùy)
SITE_URL=https://j2me.vercel.app (tùy)
```
3. **Deployments → ⋯ → Redeploy** (env chỉ có tác dụng sau deploy).
4. Domain `j2me.vercel.app` tự cấp, thêm custom domain nếu muốn.

## 4. Local admin (XAMPP)
1. Đặt `blog-v2` vào `C:\xampp\htdocs\blog\` (hoặc copy ra `htdocs`)
2. Tạo `blog-v2/config.php` (KHÔNG commit):
```php
<?php
return [
  'GITHUB_TOKEN' => 'github_pat_...', // giống Vercel
  'GITHUB_REPO'  => 'bichchixanh-collab/blog',
  'GITHUB_BRANCH'=> 'main',
  'GITHUB_PATH'  => 'data/games.json',
  'LOCK_SECRET'  => '...GIONG HET Vercel...',
  'ADMIN_USER' => 'admin',
  'ADMIN_PASS' => 'hash_tu_php_password_hash', // php -r "echo password_hash('MATKHAU', PASSWORD_DEFAULT), PHP_EOL;"
];
```
3. Mở `http://localhost/blog/blog-v2/admin.php` → đăng nhập → đăng bài. `LOCK_SECRET` khớp Vercel thì link `ENC:` mới giải được.

## 5. Kiểm tra
- `http://localhost/blog/blog-v2/game/tam-quoc-truyen-ky-lu-bo-truyen.html` → đọc 10s đếm `0/10 → 10/10`, bấm Tải → vé → `go.html` → redirect host allowlist
- `POST /api/comments` → pending, admin duyệt
- Đăng nhập `dang-nhap.html` → `api/ustats` heartbeat 60s

## 6. Sự cố
| Lỗi | Sửa |
|---|---|
| `401 Bad credentials` admin | `GITHUB_TOKEN` sai/hết hạn → tạo lại fine-grained |
| `503 stats unavailable` | thiếu `SUPABASE_SERVICE_KEY` hoặc project pause |
| `403 locked read/likes` | chưa đủ điều kiện gate |
| Push rejected | `git fetch origin && git rebase origin/main && git push` |
