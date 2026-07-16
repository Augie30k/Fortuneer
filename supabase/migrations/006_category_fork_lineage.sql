-- Track which global category a personal fork replaces, so the category
-- list can hide the now-superseded global row instead of showing both.

alter table public.categories
  add column if not exists forked_from uuid references public.categories(id) on delete set null;
