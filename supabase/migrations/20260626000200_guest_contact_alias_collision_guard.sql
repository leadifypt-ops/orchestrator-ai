-- Block 31 follow-up: canonical contacts must not take an alias owned by another identity.

create or replace function public.guard_guest_contact_alias_collisions_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(nullif(trim(new.email), ''));
  v_phone text := public.normalize_guest_phone_v1(new.phone);
begin
  if v_email is not null and exists (
    select 1
    from public.guest_contact_aliases alias
    where alias.business_id = new.business_id
      and alias.contact_type = 'email'
      and alias.normalized_value = v_email
      and alias.guest_identity_id <> new.id
  ) then
    raise exception 'Email belongs to a preserved guest contact alias'
      using errcode = '23505';
  end if;

  if v_phone is not null and exists (
    select 1
    from public.guest_contact_aliases alias
    where alias.business_id = new.business_id
      and alias.contact_type = 'phone'
      and alias.normalized_value = v_phone
      and alias.guest_identity_id <> new.id
  ) then
    raise exception 'Phone belongs to a preserved guest contact alias'
      using errcode = '23505';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_guest_contact_alias_collisions_v1()
  from public, anon, authenticated;

drop trigger if exists guest_identities_guard_contact_alias_collisions
  on public.guest_identities;
create trigger guest_identities_guard_contact_alias_collisions
before insert or update of email, phone on public.guest_identities
for each row execute function public.guard_guest_contact_alias_collisions_v1();

notify pgrst, 'reload schema';
