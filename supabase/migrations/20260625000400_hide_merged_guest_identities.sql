-- Block 30: merged identities are retained for audit but hidden from CRM reads.

drop policy if exists "Members can read guest identities"
  on public.guest_identities;
create policy "Members can read guest identities"
  on public.guest_identities
  for select
  to authenticated
  using (
    merged_into_identity_id is null
    and public.is_business_member(business_id)
  );

notify pgrst, 'reload schema';
