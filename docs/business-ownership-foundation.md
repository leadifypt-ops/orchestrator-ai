# Business Ownership Foundation

## Objetivo

Este bloco introduz a fundação mínima de ownership para Business Operations:

```text
Business -> Business Members -> Restaurants -> Future Reservations
```

O pipeline público de reservas, o Marketplace e a página do Feitoria não foram
alterados. O formulário público continua sem persistência.

## Migration

A migration `20260618000100_business_ownership_foundation.sql` cria:

- `businesses`;
- `business_memberships`;
- `restaurants.business_id`;
- índices para memberships por utilizador e restaurantes por Business;
- trigger de manutenção de `businesses.updated_at`;
- função RLS `is_business_member(uuid)`;
- políticas de ownership;
- bootstrap idempotente do Business Feitoria e associação do restaurante com
  `slug = feitoria`.

### Businesses

`businesses` contém `id`, `name`, `slug`, `created_at` e `updated_at`. O slug é
obrigatório e único.

Um utilizador autenticado só consegue ler Businesses nos quais possui uma
membership.

### Business memberships

`business_memberships` liga um Business a `auth.users` e aceita os papéis
`owner`, `manager` e `staff`. O par `(business_id, user_id)` é único.

Um membro consegue ler as memberships dos seus Businesses. A migration não
abre criação ou alteração de memberships à aplicação; essa administração deve
continuar a ser feita por SQL/service role até existir um fluxo próprio com
regras por papel.

### Restaurants

`restaurants.business_id` referencia `businesses.id` com `ON DELETE RESTRICT`.
O campo permanece nullable durante a transição para não invalidar restaurantes
legados sem owner.

Membros autenticados só podem inserir, atualizar ou apagar restaurantes de um
Business ao qual pertencem. A listagem e as páginas Business também filtram
explicitamente pelos IDs das memberships da sessão.

A migration remove primeiro as policies preexistentes de `restaurants` e cria
o conjunto conhecido deste bloco. Isto evita que uma policy permissiva antiga,
combinada por OR pelo PostgreSQL, contorne as novas regras de escrita.

## Compatibilidade pública

Os perfis de `restaurants` já são lidos anonimamente pela página pública de
detalhe. Como ainda não existe um estado `published` nem uma view pública, a
migration preserva temporariamente leitura `select` para `anon` e
`authenticated`.

Esta política permite apenas leitura dos campos atuais. Escritas continuam
protegidas por membership. Num bloco futuro, a leitura pública deve migrar para
uma view/contrato de restaurantes publicados e a policy ampla deve ser
removida.

## Associação inicial do Feitoria

A migration cria o Business Feitoria e associa automaticamente o restaurante
com `slug = feitoria`. Ela não associa um utilizador, porque uma migration não
possui uma sessão humana confiável e não deve adivinhar `user_id`.

### Identificar o utilizador

No SQL Editor do Supabase, confirmar explicitamente o utilizador correto:

```sql
select id, email, created_at
from auth.users
order by created_at;
```

Não escolher um ID apenas por ser o primeiro resultado. Confirmar o email da
conta Business que deve gerir o Feitoria.

### Criar a membership owner

Substituir `<USER_UUID_CONFIRMADO>` pelo UUID confirmado e executar:

```sql
begin;

insert into public.business_memberships (business_id, user_id, role)
select business.id, '<USER_UUID_CONFIRMADO>'::uuid, 'owner'
from public.businesses business
where business.slug = 'feitoria'
on conflict (business_id, user_id)
do update set role = excluded.role;

commit;
```

Verificar a associação:

```sql
select
  business.name as business_name,
  membership.user_id,
  membership.role,
  restaurant.name as restaurant_name
from public.businesses business
join public.business_memberships membership
  on membership.business_id = business.id
left join public.restaurants restaurant
  on restaurant.business_id = business.id
where business.slug = 'feitoria';
```

## Aplicar a migration

O ficheiro que deve ser aplicado é:

```text
supabase/migrations/20260618000100_business_ownership_foundation.sql
```

### Supabase CLI local

Num ambiente com Supabase CLI e Docker/Podman disponíveis:

```powershell
npx supabase start
npx supabase migration up --local
```

Para confirmar que a migration ficou registada:

```powershell
npx supabase migration list --local
```

### Projeto Supabase ligado

Depois de confirmar o projeto de destino e autenticar o CLI:

```powershell
npx supabase link --project-ref <PROJECT_REF_CONFIRMADO>
npx supabase db push --linked
```

Não executar `db push` sem confirmar explicitamente o project ref. O bootstrap
da membership owner continua a exigir o UUID real, através do SQL documentado
acima.

### Aplicação direta com psql

Quando existir uma connection string confirmada para o destino:

```powershell
psql "$env:DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/20260618000100_business_ownership_foundation.sql
```

### Supabase SQL Editor

Como alternativa, abrir o ficheiro da migration, executar integralmente o seu
conteúdo no SQL Editor e só depois executar o bloco manual de membership owner.
Não executar apenas partes da migration, porque tabelas, função helper, RLS e
policies formam uma única fronteira de autorização.

## Verificação SQL

Depois da aplicação e da criação manual da membership, executar:

```sql
select to_regclass('public.businesses') as businesses,
       to_regclass('public.business_memberships') as business_memberships;

select column_name, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'restaurants'
  and column_name = 'business_id';

select tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('businesses', 'business_memberships', 'restaurants')
order by tablename, policyname;

select business.id, business.name, business.slug,
       restaurant.id as restaurant_id, restaurant.slug as restaurant_slug
from public.businesses business
left join public.restaurants restaurant
  on restaurant.business_id = business.id
where business.slug = 'feitoria';

select business.slug, membership.user_id, membership.role
from public.business_memberships membership
join public.businesses business on business.id = membership.business_id
where business.slug = 'feitoria';
```

O último resultado deve conter apenas UUIDs explicitamente confirmados. Um
resultado vazio significa que o Business e o restaurante podem estar ligados,
mas nenhum utilizador Business consegue ainda geri-los.

## Alterações na Business UI

- Business Restaurants carrega apenas restaurantes dos Businesses da sessão.
- Manage Restaurant exige que o restaurante pertença a uma dessas memberships.
- Business Experiences usa o mesmo filtro de ownership.
- Create Restaurant carrega os Businesses acessíveis, exige uma seleção e
  grava `business_id`.

Dashboard, Reservations, Guests e Channels continuam no modelo legado. As
rotas permanecem disponíveis e não foram reestruturadas neste bloco.

## Limitações

- Restaurantes legados sem `business_id` deixam de aparecer nas listas
  Business até serem associados manualmente.
- Todos os papéis de membership podem gerir restaurantes nesta fundação. A
  distinção de permissões entre owner, manager e staff fica para um bloco
  posterior.
- A aplicação ainda não administra Businesses ou memberships.
- A leitura pública de `restaurants` ainda não distingue published de draft.
- `leads` continua a representar reservas operacionais legadas por
  `leads.user_id`; não possui `restaurant_id`.
- Guests, perfis, notas e timeline ainda usam a ligação temporária à lead e as
  políticas anteriores.
- A migration não torna `restaurants.business_id` obrigatório enquanto houver
  dados legados por migrar.

## Reservation Schema V1

O próximo bloco de reservas deve criar uma entidade canónica com FK obrigatória
para `restaurants.id`, estado inicial controlado e integridade referencial para
guests, perfis, notas e timeline. A autorização Business deve ser derivada de:

```text
auth.uid()
  -> business_memberships.business_id
  -> restaurants.business_id
  -> reservation_requests.restaurant_id
```

Depois do backfill, as políticas temporárias globais de guests e dados
operacionais devem ser substituídas por policies que percorrem esta cadeia.

## Public Reservation Pipeline

O formulário público só deve persistir depois de existir Reservation Schema
V1. Um endpoint dedicado deverá:

1. validar o payload no servidor;
2. resolver o slug apenas para um restaurante publicado;
3. derivar `restaurant_id` e Business no servidor;
4. criar um pedido idempotente com estado `pending_review`;
5. aplicar rate limiting, anti-spam, consentimento e observabilidade;
6. nunca aceitar `business_id`, `owner_user_id` ou `automation_id` do browser
   como autoridade.

Até esse bloco, `/restaurants/feitoria/reserve` continua exclusivamente local e
não grava dados.

## Validação deste bloco

Foram executados com sucesso:

```powershell
npx tsc --noEmit
npx eslint 'app/[locale]/(app)/business/restaurants/page.tsx' 'app/[locale]/(app)/experiences/page.tsx' 'app/[locale]/(app)/restaurants/new/page.tsx' 'app/[locale]/(app)/restaurants/[slug]/manage/page.tsx'
npm run build
```

O build de produção compilou as rotas Business e públicas. A verificação em
browser confirmou:

- `/pt/business/restaurants` redireciona para `/pt/login` sem sessão;
- `/pt/business/dashboard` redireciona para `/pt/login` sem sessão;
- `/pt/restaurants` apresenta o catálogo;
- `/pt/restaurants/feitoria` apresenta o Feitoria;
- `/pt/restaurants/feitoria/reserve` apresenta o formulário simulado;
- não foram registados erros de consola nestas verificações.

Este ambiente não possui Supabase CLI, Docker/Podman ou `psql`; por isso a
migration não foi aplicada a uma base local nesta execução. Os comandos de
aplicação e verificação estão documentados acima. A ausência desse runtime não
altera o resultado das validações de TypeScript, ESLint, build e rotas.
