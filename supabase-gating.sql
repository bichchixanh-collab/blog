-- supabase-gating.sql — chạy 1 lần trong Supabase Dashboard → SQL Editor (dự án J2ME).
-- Bảng đếm server-side cho khóa tải CỨNG (chỉ service_role đọc/ghi; RLS chặn anon).
-- Cần 2 env trên Vercel: SUPABASE_JWT_SECRET (= JWT Secret trong Settings → API)
-- và SUPABASE_SERVICE_KEY (= service_role key, GIỮ KÍN, không để lộ client).
create table if not exists public.user_stats (
  uid uuid primary key,
  minutes integer not null default 0,
  likes text[] not null default '{}',
  completed text[] not null default '{}',
  bingo jsonb not null default '{}',
  pet_xp integer not null default 0,
  updated_at timestamptz not null default now()
);
-- Nâng cấp DB đã tạo bản cũ (chạy lại file này an toàn):
alter table public.user_stats add column if not exists bingo jsonb not null default '{}';
alter table public.user_stats add column if not exists pet_xp integer not null default 0;
alter table public.user_stats enable row level security;
-- Không tạo policy nào: anon/postgrest bị chặn hết, service_role bypass RLS.

-- Vé tải 1 lần: chống replay trong 15 phút, dọn tự động
create table if not exists public.used_tickets (
  jti text primary key,
  used_at timestamptz not null default now()
);
alter table public.used_tickets enable row level security;
-- RLS chặn anon, chỉ service_role ghi/đọc
-- Index cho cleanup
create index if not exists idx_used_tickets_used_at on public.used_tickets (used_at);
-- Cron dọn: chạy trong Supabase pg_cron hoặc Vercel Cron gọi DELETE
-- delete from public.used_tickets where used_at < now() - interval '1 day';

-- Khóa senpai nếu chưa có RLS (an toàn chạy lại)
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='senpai') then
    execute 'alter table public.senpai enable row level security';
  end if;
end $$;
