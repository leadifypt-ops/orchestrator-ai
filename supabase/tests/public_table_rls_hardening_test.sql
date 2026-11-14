-- Post-migration pgTAP checks — run only in disposable/local test DB.
-- Requires pgTAP extension in test environment. Supabase CLI: supabase test db
begin;

select plan(19);

select ok((select relrowsecurity from pg_class where oid='public.setup_requests'::regclass),'setup_requests RLS enabled');
select ok((select relrowsecurity from pg_class where oid='public.plan_interest'::regclass),'plan_interest RLS enabled');
select ok((select relrowsecurity from pg_class where oid='public.subscriptions'::regclass),'subscriptions RLS enabled');
select ok((select relrowsecurity from pg_class where oid='public.restaurant_featured_dishes'::regclass),'restaurant_featured_dishes RLS enabled');

select ok(not (has_table_privilege('anon','public.setup_requests','SELECT') or has_table_privilege('anon','public.setup_requests','INSERT') or has_table_privilege('anon','public.setup_requests','UPDATE') or has_table_privilege('anon','public.setup_requests','DELETE')),'anon cannot access setup_requests');
select ok(not (has_table_privilege('authenticated','public.setup_requests','SELECT') or has_table_privilege('authenticated','public.setup_requests','INSERT') or has_table_privilege('authenticated','public.setup_requests','UPDATE') or has_table_privilege('authenticated','public.setup_requests','DELETE')),'authenticated cannot directly access setup_requests');

select ok(not (has_table_privilege('anon','public.plan_interest','SELECT') or has_table_privilege('anon','public.plan_interest','INSERT') or has_table_privilege('anon','public.plan_interest','UPDATE') or has_table_privilege('anon','public.plan_interest','DELETE')),'anon cannot access plan_interest');
select ok(not (has_table_privilege('authenticated','public.plan_interest','SELECT') or has_table_privilege('authenticated','public.plan_interest','INSERT') or has_table_privilege('authenticated','public.plan_interest','UPDATE') or has_table_privilege('authenticated','public.plan_interest','DELETE')),'authenticated cannot directly access plan_interest');

select ok(not (has_table_privilege('anon','public.subscriptions','SELECT') or has_table_privilege('anon','public.subscriptions','INSERT') or has_table_privilege('anon','public.subscriptions','UPDATE') or has_table_privilege('anon','public.subscriptions','DELETE')),'anon cannot access subscriptions');
select ok(has_table_privilege('authenticated','public.subscriptions','SELECT'),'authenticated can read subscriptions');
select ok(not (has_table_privilege('authenticated','public.subscriptions','INSERT') or has_table_privilege('authenticated','public.subscriptions','UPDATE') or has_table_privilege('authenticated','public.subscriptions','DELETE')),'authenticated cannot mutate subscriptions');

select ok(has_table_privilege('anon','public.restaurant_featured_dishes','SELECT'),'anon can read public editorial dishes');
select ok(has_table_privilege('authenticated','public.restaurant_featured_dishes','SELECT'),'authenticated can read editorial dishes');
select ok(not (has_table_privilege('anon','public.restaurant_featured_dishes','INSERT') or has_table_privilege('anon','public.restaurant_featured_dishes','UPDATE') or has_table_privilege('anon','public.restaurant_featured_dishes','DELETE')),'anon cannot mutate dishes');
select ok(not (has_table_privilege('authenticated','public.restaurant_featured_dishes','INSERT') or has_table_privilege('authenticated','public.restaurant_featured_dishes','UPDATE') or has_table_privilege('authenticated','public.restaurant_featured_dishes','DELETE')),'authenticated cannot mutate dishes');

select ok(exists(select 1 from pg_policies where schemaname='public' and tablename='subscriptions' and policyname='subscriptions_self_select' and cmd='SELECT' and 'authenticated'=any(roles) and qual like '%auth.uid()%'),'subscription policy scopes reads to auth.uid');
select ok(exists(select 1 from pg_policies where schemaname='public' and tablename='restaurant_featured_dishes' and policyname='restaurant_featured_dishes_public_select' and cmd='SELECT' and 'anon'=any(roles)),'public editorial dish read policy exists');
select ok(not exists(select 1 from pg_policies where schemaname='public' and tablename in ('setup_requests','plan_interest') and cmd in ('INSERT','UPDATE','DELETE','ALL')),'lead tables have no client write policies');
select ok(has_table_privilege('service_role','public.subscriptions','UPDATE') and has_table_privilege('service_role','public.setup_requests','INSERT'),'service_role backend permissions intact');

select * from finish();
rollback;
