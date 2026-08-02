do $$
begin
  if to_regprocedure(
    'public.create_public_reservation_v1(text,text,text,text,date,time without time zone,integer,text,text,text[],text[],text[],text[],text,text)'
  ) is null or not has_function_privilege(
    'anon',
    'public.create_public_reservation_v1(text,text,text,text,date,time without time zone,integer,text,text,text[],text[],text[],text[],text,text)',
    'execute'
  ) then
    raise exception 'Public reservation V1 contract changed';
  end if;

  if to_regprocedure(
    'public.create_public_reservation_v2(text,text,text,text,date,time without time zone,integer,text,text,text,jsonb)'
  ) is null or not has_function_privilege(
    'anon',
    'public.create_public_reservation_v2(text,text,text,text,date,time without time zone,integer,text,text,text,jsonb)',
    'execute'
  ) then
    raise exception 'Public reservation V2 contract changed';
  end if;

  if to_regprocedure(
    'public.save_business_service_period_v1(uuid,uuid,text,time without time zone,time without time zone,boolean,uuid)'
  ) is null or to_regprocedure(
    'public.set_reservation_capacity_v1(uuid,integer,integer,integer,integer)'
  ) is null then
    raise exception 'Block 41 configuration RPC contract changed';
  end if;

  if exists (
    select 1 from pg_trigger trigger_row
    where trigger_row.tgrelid = 'public.reservations'::regclass
      and not trigger_row.tgisinternal
      and trigger_row.tgname like '%availability%'
  ) then
    raise exception 'Availability introduced a reservation-decision trigger';
  end if;
end;
$$;

select 'block_42_reservation_compatibility_valid' as result;
