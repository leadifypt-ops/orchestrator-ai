do $$
begin
 if to_regclass('public.reservation_guest_submission_reviews') is null then raise exception 'Guest update review table missing'; end if;
 if not(select relrowsecurity from pg_class where oid='public.reservation_guest_submission_reviews'::regclass) then raise exception 'Guest update review RLS missing'; end if;
 if has_table_privilege('anon','public.reservation_guest_submission_reviews','select')
  or has_table_privilege('authenticated','public.reservation_guest_submission_reviews','insert')
  or has_table_privilege('authenticated','public.reservation_guest_submission_reviews','update')
  or has_table_privilege('authenticated','public.reservation_guest_submission_reviews','delete') then raise exception 'Review grants exceed read-only contract'; end if;
 if has_function_privilege('anon','public.list_guest_update_reviews(uuid,uuid,date,text,text)','execute')
  or has_function_privilege('anon','public.review_guest_submission(uuid,text,text)','execute')
  or not has_function_privilege('authenticated','public.list_guest_update_reviews(uuid,uuid,date,text,text)','execute')
  or not has_function_privilege('authenticated','public.review_guest_submission(uuid,text,text)','execute') then raise exception 'Review RPC grants incorrect'; end if;
 if not exists(select 1 from pg_trigger where tgrelid='public.reservation_guest_submission_reviews'::regclass and tgname='reservation_guest_submission_reviews_append_only' and not tgisinternal) then raise exception 'Review append-only trigger missing'; end if;
end $$;
select 'block_47_guest_update_review_schema_valid' result;
