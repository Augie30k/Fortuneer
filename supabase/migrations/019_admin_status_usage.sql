-- Admin hub support: user access status on profiles (signup approval flow)
-- and a usage_log table recording Groq token usage per Vera request.

-- Existing users predate the approval flow — grandfather them in as active;
-- anyone who signs up after this migration starts as pending.
alter table public.profiles
  add column if not exists status text not null default 'pending'
  check (status in ('pending', 'active', 'blocked'));

update public.profiles set status = 'active' where status = 'pending';

create table if not exists public.usage_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.usage_log enable row level security;

-- Users may only append their own rows; reads happen through the
-- service-role client in the admin hub, which bypasses RLS.
create policy "usage_log_insert_own" on public.usage_log
  for insert with check (auth.uid() = user_id);

create index if not exists usage_log_user_created
  on public.usage_log (user_id, created_at desc);
