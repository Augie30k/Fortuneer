-- Terms & Conditions acceptance tracking.
-- Users must accept the current terms version before using the app: the
-- proxy redirects any profile whose terms_version doesn't match the version
-- in lib/terms.ts to /terms/accept. Existing users are intentionally NOT
-- backfilled — they're prompted to accept on their next visit.

alter table public.profiles
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists terms_version text;

comment on column public.profiles.terms_accepted_at is
  'When the user last accepted the Terms & Conditions';
comment on column public.profiles.terms_version is
  'Terms version accepted — must match lib/terms.ts TERMS_VERSION to use the app';

-- New signups accept the terms via a required checkbox on the signup form,
-- which stamps the acceptance into auth user metadata; copy it onto the
-- profile row at creation so they don't hit the accept gate again.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, terms_accepted_at, terms_version)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data->>'terms_accepted_at', '')::timestamptz,
    nullif(new.raw_user_meta_data->>'terms_version', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
