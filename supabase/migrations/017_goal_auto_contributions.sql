-- Marks goal_contributions rows created by the month-end auto-save
-- crystallization job (lib/goal-autosave.ts): a fixed-plan goal
-- automatically claims room from that month's leftover regular budget
-- once the real month elapses. The month it belongs to lets the lazy
-- catch-up job (run on every GET /api/goals) stay idempotent — a month
-- already crystallized for a goal is never reprocessed.
alter table public.goal_contributions
  add column if not exists auto_for_month date;

create unique index if not exists goal_contributions_auto_unique
  on public.goal_contributions (goal_id, auto_for_month)
  where auto_for_month is not null;
