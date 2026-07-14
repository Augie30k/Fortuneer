-- Fortuneer core schema
-- Money convention follows Plaid: transaction.amount > 0 is money OUT, < 0 is money IN.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user, created by trigger
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  currency text not null default 'USD',
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profiles for users that signed up before this trigger existed
insert into public.profiles (id, email)
select id, email from auth.users
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- plaid_items: one row per connected institution login
-- ---------------------------------------------------------------------------
create table if not exists public.plaid_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id text not null unique,
  access_token text not null,
  institution_id text,
  institution_name text,
  sync_cursor text,
  status text not null default 'good',
  last_synced_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- accounts: Plaid-linked or manual
-- ---------------------------------------------------------------------------
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plaid_item_id uuid references public.plaid_items(id) on delete cascade,
  plaid_account_id text unique,
  name text not null,
  official_name text,
  mask text,
  type text not null check (type in ('depository','credit','loan','investment','other')),
  subtype text,
  balance numeric(15,2) not null default 0,
  available_balance numeric(15,2),
  currency text not null default 'USD',
  is_manual boolean not null default false,
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- categories: global defaults (user_id null) + user-defined
-- plaid_pfc maps Plaid personal_finance_category.primary onto our categories
-- ---------------------------------------------------------------------------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  icon text,
  color text,
  plaid_pfc text,
  is_income boolean not null default false,
  is_transfer boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists categories_global_pfc on public.categories (plaid_pfc) where user_id is null;

insert into public.categories (user_id, name, icon, color, plaid_pfc, is_income, is_transfer) values
  (null, 'Income',              'banknote',        '#34C759', 'INCOME',                    true,  false),
  (null, 'Transfer In',         'arrow-down-left', '#8E8E93', 'TRANSFER_IN',               false, true),
  (null, 'Transfer Out',        'arrow-up-right',  '#8E8E93', 'TRANSFER_OUT',              false, true),
  (null, 'Loan Payments',       'landmark',        '#5E5CE6', 'LOAN_PAYMENTS',             false, false),
  (null, 'Fees & Charges',      'receipt',         '#FF9500', 'BANK_FEES',                 false, false),
  (null, 'Entertainment',       'clapperboard',    '#BF5AF2', 'ENTERTAINMENT',             false, false),
  (null, 'Food & Dining',       'utensils',        '#FF9F0A', 'FOOD_AND_DRINK',            false, false),
  (null, 'Shopping',            'shopping-bag',    '#FF375F', 'GENERAL_MERCHANDISE',       false, false),
  (null, 'Home & Garden',       'house',           '#30B0C7', 'HOME_IMPROVEMENT',          false, false),
  (null, 'Medical',             'heart-pulse',     '#FF3B30', 'MEDICAL',                   false, false),
  (null, 'Personal Care',       'sparkles',        '#AF52DE', 'PERSONAL_CARE',             false, false),
  (null, 'Services',            'wrench',          '#64D2FF', 'GENERAL_SERVICES',          false, false),
  (null, 'Gov & Charity',       'hand-heart',      '#5856D6', 'GOVERNMENT_AND_NON_PROFIT', false, false),
  (null, 'Transportation',      'car-front',       '#007AFF', 'TRANSPORTATION',            false, false),
  (null, 'Travel',              'plane',           '#0A84FF', 'TRAVEL',                    false, false),
  (null, 'Bills & Utilities',   'plug-zap',        '#FFD60A', 'RENT_AND_UTILITIES',        false, false),
  (null, 'Other',               'circle-ellipsis', '#8E8E93', 'OTHER',                     false, false)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- transactions
-- ---------------------------------------------------------------------------
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  plaid_transaction_id text unique,
  amount numeric(15,2) not null,
  description text not null,
  merchant_name text,
  logo_url text,
  date date not null,
  pending boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists transactions_user_date on public.transactions (user_id, date desc);
create index if not exists transactions_account on public.transactions (account_id);
create index if not exists transactions_category on public.transactions (category_id);

-- ---------------------------------------------------------------------------
-- budgets: monthly amount per category
-- ---------------------------------------------------------------------------
create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  amount numeric(15,2) not null check (amount >= 0),
  created_at timestamptz not null default now(),
  unique (user_id, category_id)
);

-- ---------------------------------------------------------------------------
-- balance_snapshots: daily balance per account, for net-worth history
-- ---------------------------------------------------------------------------
create table if not exists public.balance_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  balance numeric(15,2) not null,
  date date not null default current_date,
  unique (account_id, date)
);

create index if not exists balance_snapshots_user_date on public.balance_snapshots (user_id, date);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.plaid_items enable row level security;
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.budgets enable row level security;
alter table public.balance_snapshots enable row level security;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "own plaid items" on public.plaid_items;
create policy "own plaid items" on public.plaid_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own accounts" on public.accounts;
create policy "own accounts" on public.accounts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "read global or own categories" on public.categories;
create policy "read global or own categories" on public.categories
  for select using (user_id is null or auth.uid() = user_id);

drop policy if exists "write own categories" on public.categories;
create policy "write own categories" on public.categories
  for insert with check (auth.uid() = user_id);

drop policy if exists "update own categories" on public.categories;
create policy "update own categories" on public.categories
  for update using (auth.uid() = user_id);

drop policy if exists "delete own categories" on public.categories;
create policy "delete own categories" on public.categories
  for delete using (auth.uid() = user_id);

drop policy if exists "own transactions" on public.transactions;
create policy "own transactions" on public.transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own budgets" on public.budgets;
create policy "own budgets" on public.budgets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own balance snapshots" on public.balance_snapshots;
create policy "own balance snapshots" on public.balance_snapshots
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
