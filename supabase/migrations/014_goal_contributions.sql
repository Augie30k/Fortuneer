-- Per-contribution history for goals (goals.saved_amount stays a running
-- total). Lets the Budgets page know how much went toward a linked goal
-- *this month* specifically, so it can deduct that from the category's
-- remaining budget — without ever touching the transactions table, since a
-- goal contribution is savings, not spending, and must stay invisible to
-- Reports/dashboard spend totals.
create table if not exists public.goal_contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid not null references public.goals(id) on delete cascade,
  amount numeric not null,
  created_at timestamptz not null default now()
);

alter table public.goal_contributions enable row level security;

create policy "goal_contributions_own" on public.goal_contributions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists goal_contributions_goal_created
  on public.goal_contributions (goal_id, created_at);
