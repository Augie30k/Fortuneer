-- Distinguishes budget rows the server wrote automatically (to stop a
-- single-month edit from bleeding into future months) from rows a user set
-- on purpose. Auto rows can be safely reclaimed later if the user opts a
-- prior month into "apply to all upcoming months"; explicit rows never are.
alter table public.budgets
  add column if not exists auto_revert boolean not null default false;
