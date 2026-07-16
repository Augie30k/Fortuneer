-- Reverts 011_goal_category_link.sql. Linking a goal directly to a spending
-- category (making it look like an expense against that category) was the
-- wrong model — goals now get their own dedicated "Goals" group on the
-- Budgets page instead, driven purely by goal_contributions.
alter table public.goals
  drop column if exists category_id;
