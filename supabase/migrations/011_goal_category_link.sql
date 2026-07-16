-- Link a savings goal to a budget category so the budgets page can show the
-- monthly pace a goal needs, right where spending is planned.
alter table public.goals
  add column if not exists category_id uuid references public.categories(id) on delete set null;
