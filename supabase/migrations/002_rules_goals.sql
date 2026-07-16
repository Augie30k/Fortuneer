-- Rules engine + savings goals

-- ---------------------------------------------------------------------------
-- rules: auto-categorization by merchant/description match
-- ---------------------------------------------------------------------------
create table if not exists public.rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  matcher text not null,                     -- lowercase substring to match
  match_field text not null default 'merchant'
    check (match_field in ('merchant', 'description')),
  category_id uuid not null references public.categories(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists rules_user on public.rules (user_id);

-- ---------------------------------------------------------------------------
-- goals: savings goals with manual contributions
-- ---------------------------------------------------------------------------
create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  icon text,
  color text,
  target_amount numeric(15,2) not null check (target_amount > 0),
  saved_amount numeric(15,2) not null default 0 check (saved_amount >= 0),
  target_date date,
  created_at timestamptz not null default now()
);

create index if not exists goals_user on public.goals (user_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.rules enable row level security;
alter table public.goals enable row level security;

drop policy if exists "own rules" on public.rules;
create policy "own rules" on public.rules
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own goals" on public.goals;
create policy "own goals" on public.goals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
