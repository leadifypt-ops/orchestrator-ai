# Reservation Canonical Schema V1

## Objetivo

Este bloco cria a entidade canónica `reservations` e a liga à fundação de
ownership Business:

```text
businesses
  -> business_memberships
  -> restaurants
  -> reservations
  -> reservation_guests
  -> guest_dietary_profiles
  -> notes / timeline
```

O formulário público, Marketplace e a UI Business Reservations não foram
ligados a esta tabela. `leads` permanece intacta e continua a suportar o fluxo
operacional legado.

## Migration

O ficheiro deste bloco é:

```text
supabase/migrations/20260618000200_reservation_canonical_schema_v1.sql
```

A migration pressupõe que as migrations anteriores foram aplicadas por ordem,
incluindo:

- `20260617000100_gastronomic_profile_v1.sql`;
- `20260617000200_reservation_notes_timeline.sql`;
- `20260618000100_business_ownership_foundation.sql`.

No projeto remoto auditado, as tabelas de guests, perfil, notas e timeline ainda
não estavam aplicadas. A cadeia completa deve ser executada; aplicar apenas a
migration deste bloco falhará por dependências ausentes.

## Tabela reservations

`reservations` contém:

- `id` UUID;
- `business_id` obrigatório;
- `restaurant_id` obrigatório;
- nome, email e telefone do guest;
- data e hora pedidas;
- party size positivo;
- status e source controlados;
- ocasião e pedido especial;
- timestamps de criação e atualização.

Uma FK composta entre `(restaurant_id, business_id)` e `restaurants` impede que
uma reserva seja associada a um Business diferente do Business owner do
restaurante.

O trigger `reservations_set_updated_at` mantém `updated_at` nas alterações.

## Status

Os estados aceites são:

- `pending`;
- `reviewing`;
- `confirmed`;
- `declined`;
- `cancelled`;
- `completed`.

O estado inicial é `pending`.

## Source

As origens aceites são:

- `manual`;
- `public_request`;
- `imported_legacy`.

O valor inicial é `manual`. A presença de `public_request` no check não abre
inserts públicos; apenas reserva o valor para o pipeline futuro.

## RLS e grants

`reservations` tem RLS ativa.

- membros autenticados podem ler reservas dos seus Businesses;
- membros autenticados podem criar reservas nos seus Businesses;
- a FK composta garante que o restaurante pertence ao Business declarado;
- membros autenticados podem atualizar apenas reservas dos seus Businesses;
- ownership, source, IDs e timestamps não estão nos grants de update;
- a aplicação não recebe permissão de delete nesta V1;
- `anon` não possui grant nem policy de insert ou select.

A autorização usa `is_business_member(business_id)`, criada pela fundação de
ownership.

## Compatibilidade com leads

A UI atual continua a:

- listar `leads` filtradas por `user_id`;
- criar reservas manuais em `leads`;
- abrir detalhe por `leads.id`;
- calcular métricas com os status legados;
- criar guests, notas e timeline usando o ID textual da lead.

Não existe dual-read. Misturar `leads` e `reservations` agora produziria
métricas e estados ambíguos e esconderia falhas de migração.

## Guests e perfil gastronómico

`reservation_guests` mantém `reservation_id text` para IDs de `leads` e recebe
`canonical_reservation_id uuid` opcional com FK para `reservations.id`.

Pelo menos uma das duas referências é obrigatória. Isto permite:

- rows legadas: `reservation_id` preenchido;
- rows canónicas futuras: `canonical_reservation_id` preenchido;
- uma fase de backfill: ambas preenchidas temporariamente.

`guest_dietary_profiles` não precisa de uma nova coluna: a FK existente para
`reservation_guests.id` herda a associação canónica através do guest.

As policies temporárias existentes destas tabelas continuam amplas para o papel
`authenticated`. Dados dependentes de reservas canónicas não devem ser ativados
até essas policies serem substituídas por regras derivadas de membership.

## Notes e timeline

`reservation_internal_notes` e `reservation_timeline_events` seguem a mesma
ponte de compatibilidade:

- `reservation_id text` permanece para `leads.id`;
- `canonical_reservation_id uuid` referencia `reservations.id`;
- pelo menos uma referência deve existir;
- índices foram criados para a FK canónica.

As queries e componentes existentes não foram alterados neste bloco.

## Plano de migração de legacy leads

Uma migração futura deve ser explícita e idempotente:

1. definir quais `leads` representam realmente reservas;
2. resolver cada lead para `business_id` e `restaurant_id` confirmados;
3. mapear status legados para os seis status canónicos;
4. criar `reservations` com source `imported_legacy`;
5. guardar uma tabela de mapping ou coluna de referência para impedir
   duplicação de backfill;
6. preencher `canonical_reservation_id` em guests, notas e timeline;
7. validar contagens e casos órfãos;
8. trocar Business Reservations para a tabela canónica;
9. só depois endurecer RLS dependente e retirar a ligação textual.

`leads` não deve ser apagada durante esta migração.

## Public Reservation Pipeline

O pipeline público continua desativado. O próximo bloco só poderá abrir criação
pública através de um endpoint servidor dedicado que:

1. resolva um restaurante publicado;
2. derive `business_id` do restaurante;
3. valide, limite e torne o pedido idempotente;
4. insira `status = pending` e `source = public_request`;
5. nunca conceda insert direto a `anon`;
6. crie guest e perfil apenas depois de RLS própria estar pronta.

`/restaurants/feitoria/reserve` continua sem persistência.

## Aplicação

Com Supabase local disponível:

```powershell
npx supabase start
npx supabase migration up --local
npx supabase migration list --local
```

Num projeto previamente confirmado e ligado:

```powershell
npx supabase link --project-ref <PROJECT_REF_CONFIRMADO>
npx supabase db push --linked
```

Não aplicar apenas este ficheiro se as migrations dependentes ainda não
existirem no destino.

## Verificação SQL

```sql
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'reservations'
order by ordinal_position;

select conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid = 'public.reservations'::regclass
order by conname;

select policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'reservations'
order by policyname;

select table_name, column_name, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'reservation_guests',
    'reservation_internal_notes',
    'reservation_timeline_events'
  )
  and column_name in ('reservation_id', 'canonical_reservation_id')
order by table_name, column_name;
```

## Limitações e próximos passos

- a UI Business ainda usa `leads`;
- não há backfill ou mapping de legacy IDs;
- dependent-table RLS ainda não está pronta para dados canónicos;
- não existe insert público;
- não existe verificação de disponibilidade;
- não existe fluxo de confirmação ou notificação canónico;
- o próximo bloco deve escolher entre migrar primeiro a UI Business ou criar um
  pipeline servidor controlado, sem abrir acesso direto ao browser.

## Validação deste bloco

Foram executados com sucesso:

```powershell
npx tsc --noEmit
npx eslint 'app/[locale]/(app)/reservations/page.tsx' 'app/[locale]/(app)/reservations/new/page.tsx' 'app/[locale]/(app)/reservations/[id]/page.tsx' 'app/[locale]/(app)/reservations/reservations-board.tsx' 'app/[locale]/restaurants/[slug]/reserve/page.tsx' 'app/[locale]/restaurants/[slug]/reserve/reservation-request-form.tsx'
npm run build
```

O artefacto de produção foi iniciado numa porta isolada e confirmou:

- `/pt/business/reservations` redireciona para `/pt/login` sem sessão;
- `/pt/business/restaurants` redireciona para `/pt/login` sem sessão;
- `/pt/restaurants` apresenta o catálogo;
- `/pt/restaurants/feitoria/reserve` apresenta o formulário simulado;
- não foram registados erros de consola;
- a rota pública de reserva não contém chamadas de persistência.

Este ambiente continua sem Supabase CLI, Docker/Podman ou `psql`. A migration
foi criada e documentada, mas não aplicada localmente. Isto não bloqueou as
validações de TypeScript, ESLint, build e rotas, conforme definido para este
bloco.
