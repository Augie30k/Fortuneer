-- Admin Hub v2: per-user Vera block, global kill switches (per frontend
-- type), AI usage broken out by frontend, and a persisted event log for
-- the admin hub's Overview/Logs pages.

alter table public.profiles
  add column if not exists vera_blocked boolean not null default false;

alter table public.usage_log
  add column if not exists client text not null default 'web'
  check (client in ('web', 'mobile'));

-- Global kill switches. Each row is one on/off control; the admin hub's
-- Controls page renders one per (control, frontend type). Read by proxy.ts
-- (anon key) and the mobile app (direct Supabase read) at request/launch
-- time, so it needs to be publicly readable; only the service-role admin
-- client (which bypasses RLS) may write.
create table if not exists public.admin_flags (
  key text primary key,
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.admin_flags enable row level security;

create policy "admin_flags_select_all" on public.admin_flags
  for select using (true);

insert into public.admin_flags (key, enabled) values
  ('app_disabled_web', false),
  ('app_disabled_mobile', false),
  ('vera_disabled_web', false),
  ('vera_disabled_mobile', false)
on conflict (key) do nothing;

-- Server-side event log for the admin hub's Overview/Logs pages. Only ever
-- written/read via the service-role client (lib/admin-log.ts, admin hub
-- pages) — no policies, so RLS denies everyone else by default.
create table if not exists public.admin_events (
  id uuid primary key default gen_random_uuid(),
  level text not null check (level in ('info', 'warn', 'error')),
  source text not null,
  message text not null,
  context jsonb,
  created_at timestamptz not null default now()
);

alter table public.admin_events enable row level security;

create index if not exists admin_events_created_at
  on public.admin_events (created_at desc);
