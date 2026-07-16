-- Investment holdings + APY auto-accrual for manual accounts

-- ---------------------------------------------------------------------------
-- holdings: investment positions per account (synced from Plaid)
-- ---------------------------------------------------------------------------
create table if not exists public.holdings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  security_id text not null,
  name text,
  ticker text,
  type text,
  quantity numeric(20,8) not null default 0,
  price numeric(15,4),
  value numeric(15,2) not null default 0,
  cost_basis numeric(15,2),
  currency text not null default 'USD',
  updated_at timestamptz not null default now(),
  unique (account_id, security_id)
);

create index if not exists holdings_user on public.holdings (user_id);

alter table public.holdings enable row level security;

drop policy if exists "own holdings" on public.holdings;
create policy "own holdings" on public.holdings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- accounts: APY auto-accrual settings (manual accounts only, e.g. HYSA or loans)
-- ---------------------------------------------------------------------------
alter table public.accounts
  add column if not exists apy numeric(6,3) not null default 0 check (apy >= 0),
  add column if not exists compound_frequency text not null default 'monthly'
    check (compound_frequency in ('daily','weekly','monthly','yearly')),
  add column if not exists last_accrued_at timestamptz not null default now();
