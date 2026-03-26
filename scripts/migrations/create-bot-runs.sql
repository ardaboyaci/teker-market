-- bot_runs tablosu migration
-- Supabase SQL Editor'de çalıştır

create table if not exists public.bot_runs (
    id              uuid primary key default gen_random_uuid(),
    bot_name        text not null,
    started_at      timestamptz not null default now(),
    finished_at     timestamptz,
    status          text not null default 'running' check (status in ('running', 'completed', 'failed')),
    processed_count integer not null default 0,
    error_count     integer not null default 0,
    metadata        jsonb default '{}'::jsonb
);

-- Index: son çalışmaları hızlı bul
create index if not exists idx_bot_runs_bot_name_started on public.bot_runs (bot_name, started_at desc);

-- RLS: sadece service role erişebilir
alter table public.bot_runs enable row level security;

create policy "service_role_all" on public.bot_runs
    for all using (auth.role() = 'service_role');
