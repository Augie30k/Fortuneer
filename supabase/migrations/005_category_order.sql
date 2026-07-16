-- Category display order, plus default-data cleanup

-- Rename the shared "Home & Garden" default to "Rent" (still maps Plaid's
-- HOME_IMPROVEMENT personal_finance_category — closest available bucket).
update public.categories
  set name = 'Rent'
  where user_id is null and plaid_pfc = 'HOME_IMPROVEMENT';

-- Remove an accidental personal duplicate of the shared "Medical" category,
-- repointing anything that referenced it back onto the shared row first.
do $$
declare
  dup_id uuid;
  dup_user uuid;
  canonical_id uuid;
begin
  select id, user_id into dup_id, dup_user from public.categories
    where name = 'Medical' and user_id is not null
    limit 1;

  if dup_id is not null then
    select id into canonical_id from public.categories
      where name = 'Medical' and user_id is null
      limit 1;

    if canonical_id is not null then
      update public.transactions set category_id = canonical_id
        where category_id = dup_id and user_id = dup_user;
      update public.budgets set category_id = canonical_id
        where category_id = dup_id and user_id = dup_user;
      update public.rules set category_id = canonical_id
        where category_id = dup_id and user_id = dup_user;
    end if;

    delete from public.categories where id = dup_id;
  end if;
end $$;

-- Explicit per-category display order. Custom/forked categories default to
-- the back of the list (1000) until the user drags them somewhere.
alter table public.categories
  add column if not exists sort_order integer not null default 1000;

update public.categories set sort_order = 0  where user_id is null and name = 'Rent';
update public.categories set sort_order = 1  where user_id is null and name = 'Bills & Utilities';
update public.categories set sort_order = 2  where user_id is null and name = 'Food & Dining';
update public.categories set sort_order = 3  where user_id is null and name = 'Transportation';
update public.categories set sort_order = 4  where user_id is null and name = 'Medical';
update public.categories set sort_order = 10 where user_id is null and name = 'Entertainment';
update public.categories set sort_order = 11 where user_id is null and name = 'Shopping';
update public.categories set sort_order = 12 where user_id is null and name = 'Personal Care';
update public.categories set sort_order = 13 where user_id is null and name = 'Travel';
update public.categories set sort_order = 20 where user_id is null and name = 'Loan Payments';
update public.categories set sort_order = 21 where user_id is null and name = 'Fees & Charges';
update public.categories set sort_order = 22 where user_id is null and name = 'Transfer In';
update public.categories set sort_order = 23 where user_id is null and name = 'Transfer Out';
update public.categories set sort_order = 30 where user_id is null and name = 'Services';
update public.categories set sort_order = 31 where user_id is null and name = 'Gov & Charity';
update public.categories set sort_order = 32 where user_id is null and name = 'Other';
update public.categories set sort_order = 40 where user_id is null and name = 'Income';
