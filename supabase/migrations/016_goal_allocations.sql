-- Lets a goal's monthly "budgeted" figure be set explicitly (like a regular
-- category's budget amount) instead of always relying on the auto-computed
-- pace-to-target-date. Effective-dated the same way budgets are: a row
-- applies from its month forward until a later row supersedes it, so
-- "every month" (perpetual) just works without needing a row per month.
create table if not exists public.goal_allocations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid not null references public.goals(id) on delete cascade,
  amount numeric(15,2) not null check (amount >= 0),
  month date not null,
  auto_revert boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, goal_id, month)
);

alter table public.goal_allocations enable row level security;

create policy "goal_allocations_own" on public.goal_allocations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists goal_allocations_effective_lookup
  on public.goal_allocations (user_id, goal_id, month desc);
