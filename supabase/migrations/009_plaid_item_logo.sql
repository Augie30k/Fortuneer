-- Institution logo (data URI, fetched from Plaid at link time) shown on the
-- accounts page instead of a plain text badge, when available.
alter table public.plaid_items
  add column if not exists logo_url text;
