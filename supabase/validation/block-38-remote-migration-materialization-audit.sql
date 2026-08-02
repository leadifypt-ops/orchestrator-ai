begin;

create temporary table block_38_migration_checks (
  version text primary key,
  materialized boolean not null,
  evidence text not null
) on commit drop;

insert into block_38_migration_checks (version, materialized, evidence)
values
  (
    '20260611124608',
    to_regclass('public.restaurant_featured_dishes') is not null
      and (select count(*) = 4 from information_schema.columns
        where table_schema = 'public' and table_name = 'restaurants'
          and column_name in (
            'chef_image_url', 'wine_pairing_title',
            'wine_pairing_description', 'wine_pairing_image_url'
          )),
    'restaurant visual columns and featured dishes table'
  ),
  (
    '20260617000100',
    to_regclass('public.reservation_guests') is not null
      and to_regclass('public.guest_dietary_profiles') is not null
      and (select relrowsecurity from pg_class
        where oid = 'public.reservation_guests'::regclass)
      and (select relrowsecurity from pg_class
        where oid = 'public.guest_dietary_profiles'::regclass),
    'gastronomic profile tables with RLS'
  ),
  (
    '20260617000200',
    to_regclass('public.reservation_internal_notes') is not null
      and to_regclass('public.reservation_timeline_events') is not null
      and (select relrowsecurity from pg_class
        where oid = 'public.reservation_internal_notes'::regclass)
      and (select relrowsecurity from pg_class
        where oid = 'public.reservation_timeline_events'::regclass),
    'reservation notes and timeline tables with RLS'
  ),
  (
    '20260618000100',
    to_regclass('public.businesses') is not null
      and to_regclass('public.business_memberships') is not null
      and exists (select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'restaurants'
          and column_name = 'business_id')
      and to_regprocedure('public.is_business_member(uuid)') is not null,
    'Business ownership tables, restaurant scope, and membership helper'
  ),
  (
    '20260618000200',
    to_regclass('public.reservations') is not null
      and (select count(*) = 3 from information_schema.columns
        where table_schema = 'public'
          and column_name = 'canonical_reservation_id'
          and table_name in (
            'reservation_guests', 'reservation_internal_notes',
            'reservation_timeline_events'
          ))
      and exists (select 1 from pg_constraint
        where conrelid = 'public.reservations'::regclass
          and conname = 'reservations_restaurant_business_fk'),
    'canonical reservations and compatibility references'
  ),
  (
    '20260618000300',
    to_regprocedure(
      'public.create_manual_reservation_v1(uuid,text,text,text,date,time without time zone,integer,text,text,text,text[],text[],text[],text[],text,text)'
    ) is not null
      and has_function_privilege(
        'authenticated',
        'public.create_manual_reservation_v1(uuid,text,text,text,date,time without time zone,integer,text,text,text,text[],text[],text[],text[],text,text)',
        'execute'
      ),
    'authenticated canonical manual reservation RPC'
  ),
  (
    '20260618000400',
    to_regprocedure(
      'public.create_public_reservation_v1(text,text,text,text,date,time without time zone,integer,text,text,text[],text[],text[],text[],text,text)'
    ) is not null
      and has_function_privilege(
        'anon',
        'public.create_public_reservation_v1(text,text,text,text,date,time without time zone,integer,text,text,text[],text[],text[],text[],text,text)',
        'execute'
      ),
    'narrow anonymous public reservation V1 RPC'
  ),
  (
    '20260621000100',
    to_regprocedure(
      'public.create_public_reservation_v2(text,text,text,text,date,time without time zone,integer,text,text,text,jsonb)'
    ) is not null
      and has_function_privilege(
        'anon',
        'public.create_public_reservation_v2(text,text,text,text,date,time without time zone,integer,text,text,text,jsonb)',
        'execute'
      ),
    'public reservation V2 guest profiles RPC'
  ),
  (
    '20260621000200',
    to_regclass('public.guest_identities') is not null
      and (select count(*) = 2 from information_schema.columns
        where table_schema = 'public' and column_name = 'guest_identity_id'
          and table_name in ('reservations', 'reservation_guests'))
      and exists (select 1 from pg_trigger
        where tgrelid = 'public.reservations'::regclass
          and tgname = 'reservations_assign_guest_identity' and not tgisinternal)
      and exists (select 1 from pg_trigger
        where tgrelid = 'public.reservation_guests'::regclass
          and tgname = 'reservation_guests_assign_identity' and not tgisinternal),
    'Business-scoped identity table, links, and assignment triggers'
  ),
  (
    '20260625000100',
    to_regclass('public.guest_crm_profiles') is not null
      and to_regclass('public.guest_crm_audit_events') is not null
      and (select count(*) = 2 from information_schema.columns
        where table_schema = 'public' and table_name = 'reservation_guests'
          and column_name in ('email', 'phone'))
      and to_regprocedure(
        'public.update_guest_crm_profile_v1(uuid,text,text,text,text,text)'
      ) is not null,
    'CRM overlays, immutable audit foundation, and controlled correction RPC'
  ),
  (
    '20260625000200',
    to_regprocedure(
      'public.update_reservation_guest_contact_v1(uuid,text,text,text)'
    ) is not null
      and has_function_privilege(
        'authenticated',
        'public.update_reservation_guest_contact_v1(uuid,text,text,text)',
        'execute'
      ),
    'controlled companion contact update RPC'
  ),
  (
    '20260625000300',
    (select count(*) = 3 from information_schema.columns
      where table_schema = 'public' and table_name = 'guest_identities'
        and column_name in ('merged_into_identity_id', 'merged_at', 'merged_by'))
      and (select count(*) = 6 from information_schema.columns
        where table_schema = 'public' and table_name = 'guest_crm_audit_events'
          and column_name in (
            'source_identity_id', 'target_identity_id',
            'reservations_reassigned', 'profiles_reassigned',
            'conflicts', 'decision'
          ))
      and to_regprocedure(
        'public.merge_guest_identities_v1(uuid,uuid,text)'
      ) is not null,
    'merge state, merge audit payload, and governed merge RPC'
  ),
  (
    '20260625000400',
    exists (select 1 from pg_policies
      where schemaname = 'public' and tablename = 'guest_identities'
        and policyname = 'Members can read guest identities'
        and qual ilike '%merged_into_identity_id%'),
    'merged identities excluded by the Business read policy'
  ),
  (
    '20260626000100',
    to_regclass('public.guest_contact_aliases') is not null
      and exists (select 1 from pg_trigger
        where tgrelid = 'public.guest_identities'::regclass
          and tgname = 'guest_identities_preserve_merged_contacts'
          and not tgisinternal)
      and pg_get_functiondef(
        'public.resolve_guest_identity_v1(uuid,text,text,text,timestamptz)'::regprocedure
      ) ilike '%guest_contact_aliases%',
    'contact aliases, preservation trigger, and alias-aware resolver'
  ),
  (
    '20260626000200',
    to_regprocedure(
      'public.guard_guest_contact_alias_collisions_v1()'
    ) is not null
      and exists (select 1 from pg_trigger
        where tgrelid = 'public.guest_identities'::regclass
          and tgname = 'guest_identities_guard_contact_alias_collisions'
          and not tgisinternal),
    'canonical contact collision guard and trigger'
  ),
  (
    '20260626000300',
    to_regclass('public.guest_merge_recovery_events') is not null
      and to_regprocedure(
        'public.record_guest_merge_recovery_preview_v1(uuid,text)'
      ) is not null
      and (select relrowsecurity from pg_class
        where oid = 'public.guest_merge_recovery_events'::regclass),
    'governed recovery review events, RPC, and RLS'
  ),
  (
    '20260627000100',
    to_regclass('public.guest_merge_provenance_records') is not null
      and pg_get_functiondef(
        'public.merge_guest_identities_v1(uuid,uuid,text)'::regprocedure
      ) ilike '%guest_merge_provenance_records%'
      and (select relrowsecurity from pg_class
        where oid = 'public.guest_merge_provenance_records'::regclass),
    'per-record provenance and provenance-writing merge RPC'
  ),
  (
    '20260627000200',
    to_regclass('public.guest_merge_recovery_execution_events') is not null
      and to_regprocedure('public.recover_guest_merge_v1(uuid,text)') is not null
      and (select relrowsecurity from pg_class
        where oid = 'public.guest_merge_recovery_execution_events'::regclass),
    'provenance-backed recovery execution audit, RPC, and RLS'
  ),
  (
    '20260627000300',
    to_regclass('public.guest_merge_reconciliation_reviews') is not null
      and exists (select 1 from pg_trigger
        where tgrelid = 'public.guest_merge_recovery_execution_events'::regclass
          and tgname = 'guest_merge_recovery_execution_create_review'
          and not tgisinternal)
      and exists (select 1 from pg_trigger
        where tgrelid = 'public.guest_merge_reconciliation_reviews'::regclass
          and tgname = 'guest_merge_reconciliation_prevent_mutation'
          and not tgisinternal),
    'post-recovery checklist creation and immutable review events'
  ),
  (
    '20260627000400',
    to_regclass('public.reconciliation_queue_items') is not null
      and to_regclass('public.reconciliation_queue_audit_events') is not null
      and to_regprocedure(
        'public.create_reconciliation_queue_item_v1(uuid,text,text,text,uuid,uuid,uuid,uuid,uuid,uuid,uuid)'
      ) is not null
      and to_regprocedure(
        'public.update_reconciliation_queue_status_v1(uuid,text)'
      ) is not null
      and (select relrowsecurity from pg_class
        where oid = 'public.reconciliation_queue_items'::regclass),
    'Business reconciliation queue, append-only audit, RPCs, and RLS'
  ),
  (
    '20260628000100',
    (select count(*) = 2 from information_schema.columns
      where table_schema = 'public' and table_name = 'reconciliation_queue_items'
        and column_name in (
          'recovery_execution_event_id', 'reconciliation_review_id'
        ))
      and exists (select 1 from pg_indexes
        where schemaname = 'public'
          and tablename = 'reconciliation_queue_items'
          and indexname = 'reconciliation_queue_recovery_execution_unique_idx')
      and exists (select 1 from pg_trigger
        where tgrelid = 'public.guest_merge_reconciliation_reviews'::regclass
          and tgname = 'guest_merge_reconciliation_route_follow_up'
          and not tgisinternal)
      and not has_function_privilege(
        'authenticated',
        'public.route_recovery_follow_up_to_queue_v1()',
        'execute'
      ),
    'idempotent, non-callable automatic recovery follow-up routing'
  );

do $$
declare
  v_missing text;
begin
  select string_agg(version || ' (' || evidence || ')', ', ' order by version)
  into v_missing
  from block_38_migration_checks
  where not materialized;

  if v_missing is not null then
    raise exception 'Unproven migration materialization: %', v_missing;
  end if;
end;
$$;

select version, materialized, evidence
from block_38_migration_checks
order by version;

rollback;

select 'block_38_remote_migration_materialization_audit_valid' as result;
