-- Block 48 schema/RLS validation. Run after applying 20260706000300_pre_service_briefing_handoff.sql.
do $$
begin
 if to_regclass('public.pre_service_briefings') is null then raise exception 'missing pre_service_briefings'; end if;
 if to_regclass('public.pre_service_briefing_notes') is null then raise exception 'missing pre_service_briefing_notes'; end if;
 if to_regclass('public.pre_service_briefing_reviewed_items') is null then raise exception 'missing pre_service_briefing_reviewed_items'; end if;
 if to_regclass('public.pre_service_briefing_handoffs') is null then raise exception 'missing pre_service_briefing_handoffs'; end if;
 if to_regclass('public.pre_service_briefing_events') is null then raise exception 'missing pre_service_briefing_events'; end if;
 if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='pre_service_briefings' and c.relrowsecurity) then raise exception 'briefings RLS disabled'; end if;
 if has_table_privilege('anon','public.pre_service_briefings','select') then raise exception 'anon can select briefings'; end if;
 if has_table_privilege('authenticated','public.pre_service_briefing_events','insert') then raise exception 'authenticated can insert events directly'; end if;
 if not has_function_privilege('authenticated','public.create_pre_service_briefing(uuid,date,uuid)','execute') then raise exception 'authenticated missing create RPC'; end if;
 if has_function_privilege('anon','public.get_pre_service_briefing(uuid)','execute') then raise exception 'anon can execute briefing detail RPC'; end if;
 if not exists(select 1 from pg_trigger where tgname='pre_service_briefing_events_append_only') then raise exception 'events append-only trigger missing'; end if;
 if not exists(select 1 from pg_trigger where tgname='pre_service_briefing_events_append_only' and tgenabled='O') then raise exception 'events append-only trigger disabled'; end if;
end $$;
select 'block_48_pre_service_briefing_schema_valid' as result;
