-- Support questions and feature requests sent from users to the admin hub.

create table if not exists public.support_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('support', 'feature')),
  subject text not null,
  message text not null,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now()
);

alter table public.support_requests enable row level security;

-- Users create and read their own requests; only the admin hub
-- (service role, bypasses RLS) updates status.
create policy "support_requests_select_own" on public.support_requests
  for select using (auth.uid() = user_id);
create policy "support_requests_insert_own" on public.support_requests
  for insert with check (auth.uid() = user_id);

create index if not exists support_requests_status_created
  on public.support_requests (status, created_at desc);
