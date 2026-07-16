-- Effective-dated budgets: a budget set for a category applies from that
-- month forward until a newer row for the same category supersedes it —
-- so setting an amount once "just works" for all upcoming months, while
-- still allowing a future month to be given a different amount later.

alter table public.budgets
  add column if not exists month date not null default date_trunc('month', now())::date;

-- Backfill: existing single-amount rows become effective from their
-- creation month forward (their original semantics, unchanged in effect).
update public.budgets
  set month = date_trunc('month', created_at)::date
  where month = date_trunc('month', now())::date;

alter table public.budgets drop constraint if exists budgets_user_id_category_id_key;
alter table public.budgets add constraint budgets_user_category_month_key unique (user_id, category_id, month);

create index if not exists budgets_effective_lookup on public.budgets (user_id, category_id, month desc);
