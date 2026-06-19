-- Business ownership foundation.
-- Public restaurant reads remain available for Marketplace compatibility;
-- authenticated writes are scoped to business membership.

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_memberships (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'staff' check (role in ('owner', 'manager', 'staff')),
  created_at timestamptz not null default now(),
  unique (business_id, user_id)
);

alter table public.restaurants
  add column if not exists business_id uuid references public.businesses(id) on delete restrict;

create index if not exists business_memberships_user_id_idx
  on public.business_memberships (user_id);

create index if not exists restaurants_business_id_idx
  on public.restaurants (business_id);

create or replace function public.set_business_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists businesses_set_updated_at on public.businesses;
create trigger businesses_set_updated_at
before update on public.businesses
for each row execute function public.set_business_updated_at();

create or replace function public.is_business_member(target_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.business_memberships membership
    where membership.business_id = target_business_id
      and membership.user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_business_member(uuid) from public;
grant execute on function public.is_business_member(uuid) to authenticated;

alter table public.businesses enable row level security;
alter table public.business_memberships enable row level security;
alter table public.restaurants enable row level security;

grant select on public.businesses to authenticated;
grant select on public.business_memberships to authenticated;
grant select on public.restaurants to anon, authenticated;
grant insert, update, delete on public.restaurants to authenticated;

drop policy if exists "Members can read their businesses" on public.businesses;
create policy "Members can read their businesses"
  on public.businesses
  for select
  to authenticated
  using (public.is_business_member(id));

drop policy if exists "Members can read memberships in their businesses"
  on public.business_memberships;
create policy "Members can read memberships in their businesses"
  on public.business_memberships
  for select
  to authenticated
  using (public.is_business_member(business_id));

-- Restaurant profile data is already consumed by anonymous Marketplace pages.
-- Publication-specific access should replace this policy in a later block.
do $$
declare
  existing_policy record;
begin
  for existing_policy in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'restaurants'
  loop
    execute format(
      'drop policy %I on public.restaurants',
      existing_policy.policyname
    );
  end loop;
end;
$$;

create policy "Public can read restaurant profiles"
  on public.restaurants
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Members can create restaurants" on public.restaurants;
create policy "Members can create restaurants"
  on public.restaurants
  for insert
  to authenticated
  with check (
    business_id is not null
    and public.is_business_member(business_id)
  );

drop policy if exists "Members can update restaurants" on public.restaurants;
create policy "Members can update restaurants"
  on public.restaurants
  for update
  to authenticated
  using (public.is_business_member(business_id))
  with check (
    business_id is not null
    and public.is_business_member(business_id)
  );

drop policy if exists "Members can delete restaurants" on public.restaurants;
create policy "Members can delete restaurants"
  on public.restaurants
  for delete
  to authenticated
  using (public.is_business_member(business_id));

-- This seed creates ownership entities without guessing an auth user.
insert into public.businesses (name, slug)
values ('Feitoria', 'feitoria')
on conflict (slug) do update set name = excluded.name;

update public.restaurants restaurant
set business_id = business.id
from public.businesses business
where restaurant.slug = 'feitoria'
  and business.slug = 'feitoria'
  and restaurant.business_id is null;
