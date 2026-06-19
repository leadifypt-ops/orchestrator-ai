# Business Reservations Canonical Read V1

## Objetivo

Business Reservations passa a suportar leitura da tabela canónica
`reservations` sem remover o fluxo legado em `leads`.

As superfícies preparadas são:

- `/${locale}/business/reservations`;
- `/${locale}/business/reservations/[id]`.

O formulário público, Marketplace, criação manual e dashboard não foram
migrados neste bloco.

## Dual-read da lista

A página de Reservations executa duas leituras independentes:

1. `reservations`, protegida pela RLS de membership;
2. `leads`, filtrada pelo `user_id` autenticado como antes.

Os resultados são normalizados no view model atual com o discriminante:

```text
recordType = canonical | legacy
```

O board apresenta os dois conjuntos ordenados por `created_at` e identifica
visualmente cada registo como `Canonical` ou `Legacy`.

Se a migration canónica ainda não estiver aplicada, a query de `reservations`
não fornece rows e o board continua a apresentar `leads`. Esta compatibilidade
é necessária porque o ambiente auditado ainda não possui as migrations 24B/24C
aplicadas.

## Mapeamento de campos

As reservas canónicas são adaptadas para a UI atual desta forma:

| Canonical | View model atual |
| --- | --- |
| `guest_name` | `name` |
| `guest_email` | `email` |
| `guest_phone` | `phone` |
| `special_request` | `message` |
| `restaurants.name` | `service` / `restaurant_name` |
| `restaurants.slug` | `restaurant` |
| `source` | `source` |
| `requested_date` | `requested_date` |
| `requested_time` | `requested_time` |
| `party_size` | `party_size` |
| `occasion` | `occasion` |

O embed do restaurante usa explicitamente a FK
`reservations_restaurant_id_fkey`, porque o schema também possui a FK composta
de consistência Restaurant/Business.

## Status

O board mantém os estados legacy e acrescenta o seguinte mapeamento:

| Status canónico | Estado visual |
| --- | --- |
| `pending` | New request |
| `reviewing` | Awaiting confirmation |
| `confirmed` | Confirmed |
| `declined` | Declined |
| `cancelled` | Cancelled |
| `completed` | Service completed |

As métricas aceitam os dois vocabulários. `pending` entra em new requests,
`reviewing` em awaiting confirmation, `confirmed` em confirmed e
`declined`/`cancelled` na métrica operacional de risco/cancelamento existente.

## Mutations de status

O seletor e `/api/leads/update-status` continuam disponíveis apenas para
registos `legacy`.

Reservas canónicas são read-only nesta V1. Isto evita:

- enviar um UUID canónico para um endpoint que atualiza `leads`;
- gravar eventos canónicos através das policies temporárias da timeline;
- introduzir um contrato de write antes do bloco de criação/manual write.

## Reservation Detail

O detalhe resolve o ID nesta ordem:

1. procura em `reservations`, com autorização RLS por membership;
2. se não encontrar, procura em `leads` por `id + user_id`;
3. se nenhum contrato devolver dados autorizados, responde not found.

Uma reserva canónica apresenta:

- guest name, email e phone;
- data, hora e party size;
- status e source;
- ocasião e special request;
- restaurante;
- timestamps.

Foi criado um wrapper para
`/${locale}/business/reservations/[id]`. A rota legacy continua publicada e
reutiliza o mesmo detalhe.

## Guests, perfil, notas e timeline

Para registos legacy, as queries continuam a usar `reservation_id`.

Para registos canónicos, as queries usam `canonical_reservation_id` em:

- `reservation_guests`;
- `reservation_internal_notes`;
- `reservation_timeline_events`.

O perfil gastronómico continua relacionado através de
`reservation_guests.id`.

O detalhe canónico pode ler estes dados, mas não apresenta ações de escrita.
Os componentes existentes de edição de perfil e notas são renderizados apenas
para legacy. Este limite permanece até as policies dessas tabelas serem
substituídas por RLS derivada da reserva e da membership.

## O que continua em leads

- criação manual em `/${locale}/reservations/new`;
- updates de status legacy;
- criação legacy de guest profile, timeline e notes;
- Business Dashboard e métricas de serviço;
- automações e canais históricos;
- detalhe de reservas legacy via fallback.

`leads` não foi alterada nem removida.

## Estratégia de fallback

O fallback é feito por fonte, não por transformação destrutiva:

- lista: canonical e legacy são mostradas em conjunto;
- detalhe: canonical tem precedência para o ID e legacy é fallback;
- writes: apenas legacy mantém os handlers atuais;
- ausência do schema canónico não bloqueia o board legacy.

Não existe ainda mapping entre uma lead importada e a reserva canónica
correspondente. Se o mesmo pedido existir nas duas tabelas, poderá aparecer
duplicado. O bloco de backfill deve criar uma referência idempotente antes de
migrar dados reais.

## Riscos e limitações

- canonical status ainda não pode ser alterado pela UI;
- guests, notes e timeline canónicos são read-only;
- o dashboard continua a mostrar apenas legacy leads;
- a criação manual continua a gerar apenas leads;
- métricas agregadas podem incluir duplicados se houver importação sem mapping;
- colisão do mesmo UUID nas duas fontes é improvável, mas o detalhe dá
  precedência ao registo canónico autorizado;
- erros da leitura canónica são tolerados para compatibilidade enquanto a
  migration não está aplicada; observabilidade explícita deve ser adicionada
  quando canonical se tornar a fonte principal.

## Próximo passo: canonical write

O próximo bloco Business deve:

1. criar um fluxo manual que escolha um restaurante autorizado;
2. derivar `business_id` desse restaurante;
3. inserir diretamente em `reservations` com source `manual`;
4. criar timeline canónica com RLS por membership;
5. disponibilizar update de status canónico num handler dedicado;
6. migrar o dashboard para dual-read ou canonical-first;
7. manter legacy apenas durante uma janela de compatibilidade explícita.

O pipeline público continua fora deste escopo e sem persistência.

## Validação deste bloco

Foram executados com sucesso:

```powershell
npx tsc --noEmit
npx eslint 'app/[locale]/(app)/reservations/page.tsx' 'app/[locale]/(app)/reservations/reservations-board.tsx' 'app/[locale]/(app)/reservations/[id]/page.tsx' 'app/[locale]/(app)/business/reservations/[id]/page.tsx'
npm run build
```

O build confirmou a compilação de:

- `/${locale}/business/reservations`;
- `/${locale}/business/reservations/[id]`;
- `/${locale}/business/dashboard`;
- `/${locale}/restaurants/[slug]/reserve`.

O artefacto de produção foi verificado numa porta isolada:

- `/pt/business/reservations` redirecionou para login sem sessão;
- `/pt/business/reservations/[id]` redirecionou para login sem sessão;
- `/pt/business/dashboard` redirecionou para login sem sessão;
- `/pt/restaurants/feitoria/reserve` manteve o formulário simulado;
- não foram registados erros de consola;
- a rota pública continua sem chamadas de persistência.

Não foi possível validar uma row canónica real porque as migrations ainda não
estão aplicadas neste ambiente e não existe uma sessão Business/membership de
teste disponível. O estado autenticado vazio e o detalhe canónico com dados
reais devem ser confirmados após aplicar a cadeia de migrations e criar uma
membership explicitamente autorizada.
