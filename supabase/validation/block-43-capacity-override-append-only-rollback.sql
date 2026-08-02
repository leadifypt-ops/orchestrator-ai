begin;
do $$
declare v_business uuid; v_user uuid; v_restaurant uuid; v_period uuid;
  v_override uuid; v_event uuid; v_date date := date '2099-07-02';
begin
  select membership.business_id,membership.user_id,restaurant.id
  into v_business,v_user,v_restaurant
  from public.business_memberships membership
  join public.restaurants restaurant on restaurant.business_id=membership.business_id
  order by membership.created_at limit 1;
  if v_business is null then raise exception 'Existing Business fixture required'; end if;
  update public.business_memberships set role='owner' where business_id=v_business and user_id=v_user;
  perform set_config('request.jwt.claim.sub',v_user::text,true);
  select period.id into v_period from public.business_service_periods period
    where period.business_id=v_business and period.restaurant_id=v_restaurant limit 1;
  if v_period is null then raise exception 'Existing service period fixture required'; end if;
  v_override := public.create_capacity_override(v_business,v_restaurant,v_period,v_date,
    'temporarily_reduce_capacity','Reduced staffing','Manager-only context',12);
  if not exists (select 1 from public.list_active_capacity_overrides(v_business,v_restaurant,v_date,v_date)
    where override_id=v_override and reduced_capacity=12) then raise exception 'Active override missing'; end if;
  v_event := public.remove_capacity_override(v_override,'Staffing restored','End of exception');
  if exists (select 1 from public.list_active_capacity_overrides(v_business,v_restaurant,v_date,v_date)
    where override_id=v_override) then raise exception 'Removed override remains active'; end if;
  if (select count(*) from public.get_capacity_override_history(v_business,v_restaurant,v_override)) <> 2 then
    raise exception 'History is not reconstructable';
  end if;
  begin update public.capacity_override_events set reason='mutated' where id=v_event;
    raise exception 'History was mutable'; exception when sqlstate '55000' then null; end;
  update public.business_memberships set role='staff' where business_id=v_business and user_id=v_user;
  begin perform public.create_capacity_override(v_business,v_restaurant,v_period,v_date,
    'operational_exception','Denied',null,null); raise exception 'Staff write succeeded';
    exception when sqlstate '42501' then null; end;
end $$;
rollback;
select 'block_43_capacity_override_append_only_valid' result;
