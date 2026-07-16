-- Persistent chat history for Vera, ChatGPT/Claude-style: conversations the
-- user can revisit, each holding its UI messages (parts stored as JSONB so
-- tool-call chips and undo buttons survive a reload).
create table if not exists public.vera_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New chat',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vera_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.vera_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  parts jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.vera_conversations enable row level security;
alter table public.vera_messages enable row level security;

create policy "vera_conversations_own" on public.vera_conversations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "vera_messages_own" on public.vera_messages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists vera_conversations_user_updated
  on public.vera_conversations (user_id, updated_at desc);
create index if not exists vera_messages_conversation
  on public.vera_messages (conversation_id, created_at);
