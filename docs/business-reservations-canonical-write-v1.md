# Business Reservations Canonical Write V1

## Objetivo

A criação manual de reservas Business passa a escrever na tabela canónica
`reservations`, mantendo o dual-read e todos os registos legacy em `leads`.

As rotas Business são:

- `/${locale}/business/reservations`;
- `/${locale}/business/reservations/new`;
- `/${locale}/business/reservations/[id]`.

O Marketplace e `/restaurants/feitoria/reserve` permanecem sem persistência.

## Migration

Este bloco acrescenta:

```text
supabase/migrations/20260618000300_business_reservations_canonical_write_v1.sql
```

A migration cria a função transacional:

```text
create_manual_reservation_v1
```

A função é `security invoker`, não recebe `business_id` do browser e só tem
grant de execução para `authenticated`. `public` e `anon` não podem executá-la.

## Business e Restaurant ownership

O formulário carrega as memberships do utilizador autenticado e lista apenas
restaurantes cujo `business_id` pertence a essas memberships.

- com um restaurante, ele fica selecionado por defeito;
- com vários restaurantes, o utilizador escolhe no dropdown;
- sem membership ou restaurante, o formulário apresenta um estado vazio e
  bloqueia submit.

O browser envia apenas `restaurant_id`. A RPC volta a resolver o restaurante e
exige `is_business_member(restaurant.business_id)`. O `business_id` gravado na
reserva é derivado na base de dados.

Uma seleção manipulada no browser não permite criar uma reserva fora do
Business autorizado.

## Mutation servidor

O Client Component invoca a Server Action `createManualReservation`. A action:

1. valida novamente a sessão com `supabase.auth.getUser()`;
2. valida guest, restaurante e party size;
3. chama a RPC com a sessão autenticada;
4. devolve apenas o ID canónico ou uma mensagem de erro;
5. redireciona para o detalhe Business canónico após sucesso.

A autorização decisiva permanece junto da fonte de dados, dentro da RPC e da
RLS, não apenas no dropdown.

## Escrita atómica

Numa única transação PostgreSQL, a RPC cria:

1. `reservations`;
2. `reservation_timeline_events` com `canonical_reservation_id`;
3. opcionalmente `reservation_guests`;
4. opcionalmente `guest_dietary_profiles`;
5. um segundo evento quando o perfil gastronómico é criado.

Se qualquer insert falhar, toda a função falha e a transação é revertida. Isto
evita os estados parciais possíveis no fluxo Client Component anterior.

## Reservation

A reserva canónica recebe:

- `business_id` derivado do restaurante;
- `restaurant_id` selecionado;
- `guest_name`, `guest_email` e `guest_phone`;
- `requested_date` e `requested_time`;
- `party_size`;
- `occasion`;
- `special_request` a partir das notas iniciais;
- `status = pending`;
- `source = manual`.

## Timeline

Toda reserva criada recebe:

```text
event_type = reservation_created
event_label = Reservation request created
canonical_reservation_id = reservations.id
created_by = auth.uid()
```

A descrição inclui o guest, o slot quando fornecido e `source: manual`.

Quando existe perfil gastronómico, é também criado:

```text
event_type = gastronomic_profile_added
```

## Guests e perfil gastronómico

Se qualquer campo do perfil estiver preenchido, a RPC cria o host em
`reservation_guests` usando apenas `canonical_reservation_id`, sem depender de
`leads.id`.

`guest_dietary_profiles` continua relacionado pelo ID do guest e recebe:

- allergies;
- intolerances;
- dietary restrictions;
- dislikes;
- wine preferences;
- notes.

O detalhe canónico já lê estes dados. A edição posterior continua read-only
enquanto as policies dependentes não forem migradas para membership.

## Compatibilidade legacy

- `leads` não foi alterada ou apagada;
- o board mantém dual-read;
- reservas legacy continuam visíveis e editáveis pelo fluxo antigo;
- o detalhe mantém fallback para `leads`;
- status updates legacy continuam em `/api/leads/update-status`;
- dashboard e automações continuam a usar leads;
- não foi executado backfill.

Novas criações manuais não fazem fallback silencioso para `leads`. Se a RPC ou
o schema não estiver aplicado, o formulário mostra um erro de deployment. Isto
evita gravar a reserva na fonte errada sem o utilizador saber.

## Aplicação das migrations

Esta migration depende de toda a cadeia anterior. Num ambiente local com
runtime Supabase:

```powershell
npx supabase start
npx supabase migration up --local
npx supabase migration list --local
```

Num projeto remoto previamente confirmado:

```powershell
npx supabase link --project-ref <PROJECT_REF_CONFIRMADO>
npx supabase db push --linked
```

Sem a migration, o estado vazio e a autenticação continuam seguros, mas a
criação real devolve uma mensagem a pedir a aplicação do schema canónico.

## Verificação SQL

Confirmar o grant da RPC:

```sql
select
  routine_name,
  security_type,
  routine_definition is not null as has_definition
from information_schema.routines
where routine_schema = 'public'
  and routine_name = 'create_manual_reservation_v1';

select has_function_privilege(
  'anon',
  'public.create_manual_reservation_v1(uuid,text,text,text,date,time without time zone,integer,text,text,text,text[],text[],text[],text[],text,text)',
  'execute'
) as anon_can_execute;

select has_function_privilege(
  'authenticated',
  'public.create_manual_reservation_v1(uuid,text,text,text,date,time without time zone,integer,text,text,text,text[],text[],text[],text[],text,text)',
  'execute'
) as authenticated_can_execute;
```

O resultado esperado é `anon_can_execute = false` e
`authenticated_can_execute = true`.

Depois de uma criação manual autorizada:

```sql
select id, business_id, restaurant_id, guest_name, status, source
from public.reservations
order by created_at desc
limit 5;

select canonical_reservation_id, event_type, event_description, created_by
from public.reservation_timeline_events
where canonical_reservation_id is not null
order by created_at desc
limit 10;
```

## Limitações e próximos passos

- canonical status continua read-only no board;
- dashboard ainda lê apenas leads;
- edição canónica de guests e notes ainda está desativada;
- não existe mapping/backfill de leads;
- o formulário manual não guarda um campo separado de contact channel porque o
  schema canónico V1 não possui essa coluna;
- o pipeline público permanece fechado;
- o próximo bloco deve endurecer RLS de guests/timeline/notes e criar mutations
  canónicas de status e edição antes de ligar o Marketplace.

## Validação deste bloco

Foram executados com sucesso:

```powershell
npx tsc --noEmit
npx eslint 'app/[locale]/(app)/reservations/new/page.tsx' 'app/[locale]/(app)/reservations/new/actions.ts' 'app/[locale]/(app)/reservations/reservations-board.tsx' 'app/[locale]/(app)/business/reservations/new/page.tsx'
npm run build
```

Também foi confirmado por pesquisa que:

- a criação manual já não escreve em `leads`;
- `/restaurants/feitoria/reserve` continua sem chamadas de persistência.

O artefacto de produção foi validado numa porta isolada:

- `/pt/business/reservations` redirecionou para login sem sessão;
- `/pt/business/reservations/new` redirecionou para login sem sessão;
- `/pt/business/reservations/[id]` redirecionou para login sem sessão;
- `/pt/restaurants/feitoria/reserve` manteve o formulário simulado;
- não foram registados erros de consola.

A transação real não foi executada porque as migrations canónicas ainda não
estão aplicadas neste ambiente e não existe uma sessão Business/membership de
teste. Depois da aplicação, o teste deve confirmar em conjunto a reserva,
timeline e perfil opcional, pois a RPC é atómica.
