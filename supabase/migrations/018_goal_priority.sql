-- Explicit goal display/fill order, drag-to-reorder via the Budgets page's
-- "Prioritize" mode. Lower priority renders first and claims auto-save room
-- first; ties (including every goal before this migration ever runs) fall
-- back to created_at ascending. New goals default to the very back
-- (INT_MAX) so they never render or claim ahead of existing goals until the
-- user drags them somewhere.
alter table public.goals
  add column if not exists priority integer not null default 2147483647;

with ranked as (
  select id, row_number() over (partition by user_id order by created_at asc) as rn
  from public.goals
)
update public.goals g
set priority = ranked.rn
from ranked
where g.id = ranked.id;
