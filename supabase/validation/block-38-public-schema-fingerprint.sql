with
columns_fingerprint as (
  select md5(coalesce(string_agg(
    concat_ws('|', table_name, ordinal_position, column_name, data_type,
      udt_name, is_nullable, column_default),
    E'\n' order by table_name, ordinal_position
  ), '')) as value
  from information_schema.columns
  where table_schema = 'public'
),
constraints_fingerprint as (
  select md5(coalesce(string_agg(
    concat_ws('|', relation.relname, constraint_row.conname,
      constraint_row.contype, pg_get_constraintdef(constraint_row.oid, true)),
    E'\n' order by relation.relname, constraint_row.conname
  ), '')) as value
  from pg_constraint constraint_row
  join pg_class relation on relation.oid = constraint_row.conrelid
  join pg_namespace namespace_row on namespace_row.oid = relation.relnamespace
  where namespace_row.nspname = 'public'
),
indexes_fingerprint as (
  select md5(coalesce(string_agg(
    concat_ws('|', tablename, indexname, indexdef),
    E'\n' order by tablename, indexname
  ), '')) as value
  from pg_indexes
  where schemaname = 'public'
),
functions_fingerprint as (
  select md5(coalesce(string_agg(
    pg_get_functiondef(procedure_row.oid),
    E'\n' order by procedure_row.oid::regprocedure::text
  ), '')) as value
  from pg_proc procedure_row
  join pg_namespace namespace_row on namespace_row.oid = procedure_row.pronamespace
  where namespace_row.nspname = 'public'
),
triggers_fingerprint as (
  select md5(coalesce(string_agg(
    concat_ws('|', relation.relname, trigger_row.tgname,
      pg_get_triggerdef(trigger_row.oid, true)),
    E'\n' order by relation.relname, trigger_row.tgname
  ), '')) as value
  from pg_trigger trigger_row
  join pg_class relation on relation.oid = trigger_row.tgrelid
  join pg_namespace namespace_row on namespace_row.oid = relation.relnamespace
  where namespace_row.nspname = 'public'
    and not trigger_row.tgisinternal
),
policies_fingerprint as (
  select md5(coalesce(string_agg(
    concat_ws('|', tablename, policyname, permissive, roles::text, cmd,
      coalesce(qual, ''), coalesce(with_check, '')),
    E'\n' order by tablename, policyname
  ), '')) as value
  from pg_policies
  where schemaname = 'public'
),
rls_fingerprint as (
  select md5(coalesce(string_agg(
    concat_ws('|', relation.relname, relation.relrowsecurity,
      relation.relforcerowsecurity),
    E'\n' order by relation.relname
  ), '')) as value
  from pg_class relation
  join pg_namespace namespace_row on namespace_row.oid = relation.relnamespace
  where namespace_row.nspname = 'public'
    and relation.relkind in ('r', 'p')
),
table_grants_fingerprint as (
  select md5(coalesce(string_agg(
    concat_ws('|', table_name, grantee, privilege_type, is_grantable),
    E'\n' order by table_name, grantee, privilege_type
  ), '')) as value
  from information_schema.role_table_grants
  where table_schema = 'public'
    and grantee in ('anon', 'authenticated')
),
routine_grants_fingerprint as (
  select md5(coalesce(string_agg(
    concat_ws('|', routine_name, specific_name, grantee, privilege_type,
      is_grantable),
    E'\n' order by routine_name, specific_name, grantee, privilege_type
  ), '')) as value
  from information_schema.role_routine_grants
  where routine_schema = 'public'
    and grantee in ('anon', 'authenticated')
)
select jsonb_build_object(
  'columns', columns_fingerprint.value,
  'constraints', constraints_fingerprint.value,
  'indexes', indexes_fingerprint.value,
  'functions', functions_fingerprint.value,
  'triggers', triggers_fingerprint.value,
  'policies', policies_fingerprint.value,
  'rls', rls_fingerprint.value,
  'table_grants', table_grants_fingerprint.value,
  'routine_grants', routine_grants_fingerprint.value
) as public_schema_fingerprint
from columns_fingerprint,
  constraints_fingerprint,
  indexes_fingerprint,
  functions_fingerprint,
  triggers_fingerprint,
  policies_fingerprint,
  rls_fingerprint,
  table_grants_fingerprint,
  routine_grants_fingerprint;
