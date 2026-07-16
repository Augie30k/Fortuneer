-- Category groups, budget ordering, and per-account Plaid exclusions

-- ---------------------------------------------------------------------------
-- categories: group_name for budget grouping
-- ---------------------------------------------------------------------------
alter table public.categories
  add column if not exists group_name text not null default 'Other';

update public.categories set group_name = 'Essentials'
  where user_id is null and plaid_pfc in
    ('RENT_AND_UTILITIES','FOOD_AND_DRINK','TRANSPORTATION','MEDICAL','HOME_IMPROVEMENT');

update public.categories set group_name = 'Lifestyle'
  where user_id is null and plaid_pfc in
    ('ENTERTAINMENT','GENERAL_MERCHANDISE','PERSONAL_CARE','TRAVEL');

update public.categories set group_name = 'Financial'
  where user_id is null and plaid_pfc in
    ('LOAN_PAYMENTS','BANK_FEES','TRANSFER_IN','TRANSFER_OUT');

update public.categories set group_name = 'Income'
  where user_id is null and plaid_pfc = 'INCOME';

-- ---------------------------------------------------------------------------
-- budgets: explicit user ordering (0 = unset, falls back to amount desc)
-- ---------------------------------------------------------------------------
alter table public.budgets
  add column if not exists sort_order integer not null default 0;

-- ---------------------------------------------------------------------------
-- excluded_plaid_accounts: user removed one account from a connection;
-- sync must not resurrect it
-- ---------------------------------------------------------------------------
create table if not exists public.excluded_plaid_accounts (
  user_id uuid not null references auth.users(id) on delete cascade,
  plaid_account_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, plaid_account_id)
);

alter table public.excluded_plaid_accounts enable row level security;

drop policy if exists "own exclusions" on public.excluded_plaid_accounts;
create policy "own exclusions" on public.excluded_plaid_accounts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
