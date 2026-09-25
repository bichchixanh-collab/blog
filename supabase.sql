-- supabase.sql — FILE SQL DUY NHẤT CỦA DỰ ÁN - chạy 1 lần trong Supabase Dashboard → SQL Editor
-- Copy toàn bộ file này → Run. Chạy lại an toàn (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).
-- Sau khi chạy, lấy 2 env cho Vercel: SUPABASE_JWT_SECRET (JWT Keys → Legacy JWT secret) và SUPABASE_SERVICE_KEY (API Keys → Secret sb_secret_...)

-- 1. user_stats: đếm cứng theo tài khoản (minutes, likes, completed, bingo, pet_xp)
create table if not exists public.user_stats (
  uid uuid primary key,
  minutes integer not null default 0,
  likes text[] not null default '{}',
  completed text[] not null default '{}',
  bingo jsonb not null default '{}',
  pet_xp integer not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.user_stats add column if not exists bingo jsonb not null default '{}';
alter table public.user_stats add column if not exists pet_xp integer not null default 0;
alter table public.user_stats enable row level security;
-- Không tạo policy → anon bị chặn, service_role bypass RLS (chỉ backend ghi)

-- 2. senpai: xp + data blob (pet, gacha badges) - bảng có sẵn, nếu chưa có thì tạo
create table if not exists public.senpai (
  user_id uuid primary key,
  xp integer not null default 0,
  data jsonb not null default '{}',
  updated_at timestamptz not null default now()
);
alter table public.senpai enable row level security;
-- RLS: không policy → chỉ service_role

-- 3. used_tickets: vé tải 1 lần chống replay 15 phút
create table if not exists public.used_tickets (
  jti text primary key,
  used_at timestamptz not null default now()
);
alter table public.used_tickets enable row level security;
create index if not exists idx_used_tickets_used_at on public.used_tickets (used_at);
-- Dọn tự động: chạy pg_cron hoặc Vercel Cron mỗi ngày
-- select cron.schedule('clean-used-tickets', '0 3 * * *', $$delete from public.used_tickets where used_at < now() - interval '1 day'$$);
-- Hoặc thủ công: delete from public.used_tickets where used_at < now() - interval '1 day';

-- 4. (Tùy chọn - cho comment Supabase LIMIT/OFFSET sau này, hiện vẫn dùng data/comments.json qua GitHub)
-- create table if not exists public.comments (
--   id text primary key,
--   game text not null,
--   name text not null,
--   stars integer not null default 0,
--   text text not null,
--   status text not null default 'pending',
--   parent_id text,
--   uid uuid,
--   created_at timestamptz not null default now()
-- );
-- alter table public.comments enable row level security;
-- create index if not exists idx_comments_game_status_created on public.comments (game, status, created_at desc);
