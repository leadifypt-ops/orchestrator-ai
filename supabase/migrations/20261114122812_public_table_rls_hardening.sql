-- Find Dining security hardening proposal for Issue #6.
-- Generated from a dated UTC timestamp after Supabase CLI was unavailable
-- in the connected repository environment; verify naming with CLI before merge.
-- BLOCKED FROM PRODUCTION until reviewed and tested on an isolated database.
-- Does not modify data or any existing reservation/Stripe payment state.

begin;

-- 1. RLS defense-in-depth for four existing public tables.
alter table public.setup_requests enable row level security;
alter table public.plan_interest enable row level security;
alter table public.subscriptions enable row level security;
alter table public.restaurant_featured_dishes enable row level security;

-- 2. Remove inherited over-broad privileges from untrusted API roles.
-- Explicit service_role access is intentionally left intact for server routes
-- such as setup requests and Stripe's verified webhook.
revoke all privileges on table
  public.setup_requests,
  public.plan_interest,
  public.subscriptions,
  public.restaurant_featured_dishes
from anon, authenticated;

-- 3. Preserve exactly the reads the app currently uses:
-- signed-in user checks own plan; public restaurant pages read editorial dishes.
grant select on table public.subscriptions to authenticated;
grant select on table public.restaurant_featured_dishes to anon, authenticated;

-- 4. Narrow policies. No client-facing insert/update/delete policies are
-- intentionally present; privileged server operations use service_role.
drop policy if exists subscriptions_self_select on public.subscriptions;
create policy subscriptions_self_select
on public.subscriptions
for select
to authenticated
using (
  (select auth.uid()) is not null
  and user_id = (select auth.uid())
);

drop policy if exists restaurant_featured_dishes_public_select on public.restaurant_featured_dishes;
create policy restaurant_featured_dishes_public_select
on public.restaurant_featured_dishes
for select
to anon, authenticated
using (true);

-- setup_requests and plan_interest are backend-only until their consumer
-- contracts are reviewed. No anon/authenticated policies are added.
commit;
