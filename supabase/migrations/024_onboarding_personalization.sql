-- First-login onboarding & personalization
-- New signups land on /welcome until onboarded_at is set. Existing users are
-- backfilled below so only genuinely new accounts see the flow.

alter table public.profiles
  add column if not exists preferred_name text,
  add column if not exists persona text,
  add column if not exists focus_areas text[] not null default '{}',
  add column if not exists onboarded_at timestamptz;

comment on column public.profiles.preferred_name is
  'What the app calls the user (greetings, sidebar) — distinct from full_name';
comment on column public.profiles.persona is
  'Primary reason chosen at onboarding: debt | saving | budgeting | overview | investing';
comment on column public.profiles.focus_areas is
  'Areas the user chose to put front and center: budgets, goals, recurring, investments, reports, projections';

update public.profiles set onboarded_at = now() where onboarded_at is null;
