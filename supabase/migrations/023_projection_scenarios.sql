-- Saved projection scenarios (Projections page): baseline assumptions plus
-- life events, stored as JSON. The simulation itself runs client-side on
-- both platforms via lib/projection-math.ts, so rows only hold inputs.

create table if not exists public.projection_scenarios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'My trajectory',
  assumptions jsonb not null,
  events jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.projection_scenarios enable row level security;

create policy "projection_scenarios_select_own" on public.projection_scenarios
  for select using (auth.uid() = user_id);
create policy "projection_scenarios_insert_own" on public.projection_scenarios
  for insert with check (auth.uid() = user_id);
create policy "projection_scenarios_update_own" on public.projection_scenarios
  for update using (auth.uid() = user_id);
create policy "projection_scenarios_delete_own" on public.projection_scenarios
  for delete using (auth.uid() = user_id);

create index if not exists projection_scenarios_user_updated
  on public.projection_scenarios (user_id, updated_at desc);
