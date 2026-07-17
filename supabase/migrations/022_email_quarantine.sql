-- Email quarantine: addresses the admin has denied can be barred from ever
-- signing up again. The Hub's Users page manages the list; signup is blocked
-- both in the app (friendly pre-check via /api/auth/signup-allowed) and at
-- the database (trigger below), so a direct GoTrue call can't sneak past.

create table if not exists public.quarantined_emails (
  email text primary key,
  reason text,
  created_at timestamptz not null default now()
);

-- No policies: only the service-role admin client may read or write, so RLS
-- denies everyone else by default.
alter table public.quarantined_emails enable row level security;

create or replace function public.reject_quarantined_email()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if exists (
    select 1 from public.quarantined_emails q
    where lower(q.email) = lower(new.email)
  ) then
    raise exception 'This email address is not allowed to sign up';
  end if;
  return new;
end;
$$;

drop trigger if exists reject_quarantined_email on auth.users;
create trigger reject_quarantined_email
  before insert on auth.users
  for each row execute function public.reject_quarantined_email();
