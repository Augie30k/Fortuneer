-- Audit log of every mutation Vera (the AI assistant) makes on a user's
-- behalf. Each row stores enough prior state to revert the change, powering
-- one-click undo in the chat. Vera has no delete tools; undo of a creation
-- is the only way an agent action removes data.
create table if not exists public.agent_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tool text not null,
  description text not null,
  undo jsonb not null,
  undone boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.agent_actions enable row level security;

create policy "agent_actions_select_own" on public.agent_actions
  for select using (auth.uid() = user_id);
create policy "agent_actions_insert_own" on public.agent_actions
  for insert with check (auth.uid() = user_id);
create policy "agent_actions_update_own" on public.agent_actions
  for update using (auth.uid() = user_id);

create index if not exists agent_actions_user_created
  on public.agent_actions (user_id, created_at desc);
