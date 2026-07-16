-- Richer rule matching (Monarch-style If conditions): exact vs contains text
-- matching, plus an optional amount range. All conditions AND together.
alter table public.rules
  add column if not exists match_type text not null default 'contains'
    check (match_type in ('contains', 'exact')),
  add column if not exists amount_min numeric,
  add column if not exists amount_max numeric;
