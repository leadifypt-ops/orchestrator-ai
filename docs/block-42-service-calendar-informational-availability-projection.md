# Block 42 — Service Calendar & Informational Availability Projection

## Âmbito

O Block 42 constrói a camada de calendário operacional e a projeção informativa
de disponibilidade sobre a fundação do Block 41. Toda a configuração e toda a
leitura permanecem Business-scoped e restaurant-aware.

A disponibilidade calculada é exclusivamente um apoio à decisão humana. Não
existe confirmação, recusa, bloqueio, hold, waitlist, seating, otimização,
distribuição ou sugestão automática. Nenhum trigger ou RPC deste bloco altera
uma reserva.

Tal como registado no Block 41, não existe no workspace um ficheiro autónomo
chamado Documento Mestre ou DevLog. O alinhamento foi feito com a documentação
arquitetural versionada, o DevLog integral incorporado nos documentos dos
blocos anteriores e, em particular, com a fundação e os contratos do Block 41.
A entrada de DevLog deste bloco encontra-se no final deste documento.

## Service Calendar

### Calendário semanal por período

`service_period_calendar_settings` associa cada período de serviço a um
conjunto de dias ISO da semana, de segunda-feira (`1`) a domingo (`7`). A
configuração é independente por restaurante e mantém a cadeia verificável:

```text
Business -> Restaurant -> Service Period -> Weekly Calendar
```

Períodos existentes foram inicializados com os sete dias para preservar o
estado operacional anterior até revisão humana. Novos períodos recebem a mesma
configuração inicial através de um trigger de criação. Owners e managers podem
depois escolher explicitamente qualquer conjunto de dias, incluindo nenhum dia
regular de operação.

### Dias especiais e exceções pontuais

As exceções pontuais do Block 41 continuam a ser a fonte para uma data
específica. O vocabulário foi ampliado com `special_day`, que permite assinalar
uma operação excecional sem a interpretar como encerramento.

O calendário resolve:

- `closed`, `private_event` e `maintenance` como período informativamente
  encerrado;
- `reduced_hours` como período aberto com início/fim efetivos estruturados;
- `special_day` como abertura excecional, inclusive num dia normalmente
  encerrado;
- `other` como contexto operacional sem mudança automática de horário.

Uma exceção pontual específica do período tem precedência sobre uma exceção
pontual para todo o restaurante. Exceções pontuais têm precedência sobre regras
recorrentes.

### Exceções recorrentes

`recurring_availability_exceptions` suporta:

- um ou mais dias da semana;
- início obrigatório e fim de validade opcional;
- restaurante obrigatório e período de serviço opcional;
- encerramento, evento privado, manutenção, horário reduzido, dia especial ou
  contexto adicional;
- ativação/desativação governada sem delete.

Quando mais de uma regra recorrente coincide, uma regra específica do período
tem precedência sobre uma regra global do restaurante. Dentro da mesma
precedência, a regra criada mais recentemente é a corrente. A UI e a RPC
continuam a expor todas as regras para revisão humana.

## Availability Projection

`project_restaurant_availability_v1` produz uma linha por data operacional e
período ativo. O cálculo usa:

- dias regulares do calendário;
- períodos de serviço ativos;
- capacidade configurada no Block 41;
- reservas canónicas existentes;
- exceções pontuais e recorrentes;
- horários reduzidos efetivos;
- períodos que atravessam a meia-noite.

Reservas com estado `declined` ou `cancelled` são excluídas. Pedidos `pending`,
reservas `reviewing`, `confirmed` e registos `completed` permanecem visíveis no
histórico operacional. Esta inclusão não atribui validade ou confirmação ao
pedido; apenas apresenta os registos existentes.

Para cada período são devolvidos:

- capacidade configurada;
- capacidade operacional total;
- covers utilizados;
- covers restantes, nunca inferiores a zero;
- percentagem de ocupação, que pode ultrapassar 100%;
- número de reservas;
- reservas e covers fora do horário efetivo;
- limites simultâneos e por intervalo configurados no Block 41;
- contexto e origem da exceção aplicada;
- indicador informativo.

Os indicadores são:

- `available`: abaixo de 75%;
- `near_capacity`: de 75% até menos de 90%;
- `high_capacity`: de 90% até menos de 100%;
- `fully_occupied`: 100% ou mais;
- `closed`: período informativamente encerrado;
- `not_configured`: período aberto sem capacidade configurada.

Um horário reduzido altera a janela operacional efetiva e identifica reservas
fora dessa janela. A capacidade `max_covers` não é proporcionalmente reduzida,
porque o Block 41 não define uma relação autorizada entre duração e covers.
Inferir essa relação seria uma decisão operacional não fornecida pelo
restaurante.

Cada reserva é atribuída no máximo a um período por data operacional. Em caso
de períodos sobrepostos, a projeção usa uma ordem determinística — período
aberto, programado, início mais tardio e ID — para evitar dupla contagem. O
resultado sinaliza informação; não escolhe uma mesa nem um serviço para a
reserva.

## RPCs autenticadas

Foram criadas seis RPCs autenticadas:

- `save_service_period_calendar_v1`;
- `save_recurring_availability_exception_v1`;
- `get_restaurant_operational_calendar_v1`;
- `list_restaurant_availability_exceptions_v1`;
- `project_restaurant_availability_v1`;
- `get_restaurant_availability_daily_summary_v1`.

As quatro RPCs de leitura aceitam `business_id`, `restaurant_id` e intervalo de
datas. Todas repetem autenticação, membership e coerência restaurante/Business
dentro da base. O intervalo máximo das RPCs é 367 dias; a UI limita a vista
operacional a 32 dias.

As duas RPCs de escrita exigem owner ou manager e repetem a autorização do
Block 41. `staff` permanece read-only. `anon` não possui acesso às tabelas nem
às RPCs do Block 42.

## Business scope, Restaurant scope e RLS

As duas novas tabelas possuem:

- `business_id` e `restaurant_id` obrigatórios;
- FKs compostas para impedir associação cross-Business;
- RLS baseada em `is_business_member(business_id)`;
- grants autenticados exclusivamente de leitura;
- escritas apenas através das RPCs governadas;
- retenção por trigger, sem delete.

A página filtra explicitamente os restaurantes pelos Businesses das
memberships da sessão antes de apresentar o seletor. A fronteira decisiva
permanece nas RPCs e nas FKs/RLS, não na UI.

## Auditoria append-only

O journal `reservation_availability_audit_events` foi reutilizado e ampliado
com os tipos:

- `service_calendar`;
- `recurring_exception`.

Criações e alterações efetivas registam valores anteriores, valores novos,
ator e timestamp. Submissões sem alteração não criam ruído. Updates e deletes
do journal continuam rejeitados pelo trigger append-only do Block 41.

A inicialização dos calendários existentes foi registada com
`source = block_42_backfill`; a criação automática do calendário de um novo
período usa `source = service_period_default`.

## Dashboard Business

Foi adicionada a rota:

```text
/{locale}/business/availability/calendar
```

A navegação e o layout de Availability ligam diretamente à nova superfície. O
dashboard contém:

- filtro por restaurante e intervalo de datas;
- capacidade total, utilizada, restante e ocupação agregada;
- calendário diário com períodos abertos e exceções;
- projeção detalhada por período;
- reservas existentes e sinais de reservas fora do horário efetivo;
- capacidade global, simultânea e por intervalo;
- indicadores visuais informativos;
- configuração semanal por período;
- registo de datas especiais;
- criação e edição de exceções recorrentes;
- lista das ocorrências de exceção no intervalo.

Todas as mensagens da superfície repetem que a projeção não bloqueia nem
confirma reservas.

## Compatibilidade e ausência de automação

O Block 42 não alterou:

- estados ou mutations de `reservations`;
- `create_public_reservation_v1`;
- `create_public_reservation_v2`;
- slots do formulário público;
- confirmação manual;
- Guest Identity, recovery ou reconciliation;
- Leadify.

Não existe trigger de disponibilidade em `reservations`. Os RPCs públicos V1 e
V2 continuam presentes e executáveis por `anon` com as assinaturas anteriores.
As RPCs de períodos e capacidade do Block 41 continuam presentes e os testes
funcionais completos do Block 41 voltaram a passar.

## Artefactos

- Migration:
  `supabase/migrations/20260630000100_service_calendar_informational_availability_projection.sql`.
- Schema/RLS/grants:
  `supabase/validation/block-42-service-calendar-availability-projection-schema.sql`.
- Funcional rollback-only:
  `supabase/validation/block-42-service-calendar-availability-projection-rollback.sql`.
- Compatibilidade:
  `supabase/validation/block-42-reservation-compatibility.sql`.
- Tipos e helpers: `lib/availability-projection.ts`.
- Testes focados: `lib/availability-projection.test.ts` e
  `lib/availability.test.ts`.
- Dashboard e configuração:
  `app/[locale]/(app)/business/availability/calendar/`.

## Validação remota

Antes da aplicação:

- o histórico estava alinhado em 23/23;
- o dry-run selecionou exclusivamente `20260630000100`.

A migration foi aplicada pelo fluxo normal `supabase db push --linked`.

Depois da aplicação:

- schema, RLS, policies, grants, triggers e RPCs:
  `block_42_service_calendar_availability_projection_schema_valid`;
- funcional rollback-only:
  `block_42_service_calendar_availability_projection_valid`;
- compatibilidade de reservas:
  `block_42_reservation_compatibility_valid`;
- calendário semanal, normalização dos dias ISO e criação automática testados;
- dia especial sobre dia normalmente encerrado testado;
- exceção recorrente e horário reduzido testados;
- reservas fora do horário efetivo testadas;
- cálculo de total, utilizado, restante e percentagem testado;
- exclusão de reservas canceladas testada;
- períodos overnight testados;
- status de reservas preservado durante a projeção;
- `staff` denial, retenção, auditoria append-only e isolamento cross-Business
  testados;
- schema e rollback-only funcional do Block 41 repetidos com sucesso;
- RPCs públicos V1/V2 e RPCs de configuração do Block 41 confirmados;
- histórico final alinhado em 24/24;
- dry-run final: `Remote database is up to date`.

Ocorreram respostas transitórias `503` do login role durante a repetição final;
as mesmas operações foram repetidas pelo fluxo normal e concluíram com os
marcadores válidos acima.

## Validações aplicacionais

- TypeScript: passou.
- ESLint focado em toda a superfície Availability e helpers: passou.
- Testes focados: 7/7 passaram com `tsx`.
- `git diff --check`: passou.
- Build Next.js 16.2.1: passou e incluiu
  `/[locale]/business/availability/calendar`.
- Runtime de produção sem sessão: a rota nova devolveu `307` para `/pt/login`.
- Runtime público: `/pt/restaurants/feitoria/reserve` devolveu `200`.

A vista autenticada com dados reais não foi percorrida no browser por não
existir uma sessão Business disponível neste ambiente. Os dados, cálculos e
autorizações que a alimentam foram exercitados diretamente no projeto remoto
através das validações rollback-only.

## Descobertas e decisões

- Um calendário Business-scoped continua insuficiente num Business
  multi-restaurante; cada regra precisa de `restaurant_id` e, quando aplicável,
  `service_period_id` verificáveis.
- A data de um período overnight é a data operacional de início. Uma reserva à
  `01:00` do dia seguinte é corretamente atribuída ao serviço iniciado na data
  anterior.
- Horário reduzido e redução de capacidade são conceitos diferentes. Sem uma
  política explícita do restaurante, a projeção altera a janela e sinaliza
  conflitos, mas não inventa uma nova capacidade.
- Percentagens acima de 100% são operacionalmente úteis e não devem ser
  truncadas; continuam a ser um indicador, não um bloqueio.
- Excluir apenas `declined` e `cancelled` mantém pedidos ainda não confirmados
  visíveis sem os transformar em reservas garantidas.

## Limitações

- Não existe timezone configurável por restaurante; a projeção utiliza os
  campos locais `requested_date` e `requested_time` do contrato canónico.
- Os limites simultâneos e por intervalo são apresentados, mas este bloco não
  executa otimização nem distribuição temporal de seating.
- Áreas continuam sem capacidade própria e não existem mesas individuais.
- Períodos sobrepostos são resolvidos de forma determinística para evitar
  dupla contagem, mas devem ser revistos manualmente pelo restaurante.
- A capacidade não é proporcionalmente reduzida por um horário reduzido.
- Não existe hold, waitlist, garantia de cartão, seleção antecipada de menu,
  seating, sugestão ou confirmação automática.
- O formulário público mantém os horários validados atuais como pedidos, não
  como disponibilidade em tempo real.

## DevLog — Block 42

• Objetivo do bloco

Construir um calendário operacional Business/Restaurant-scoped e uma projeção
estritamente informativa de disponibilidade sobre a fundação do Block 41,
mantendo decisão e confirmação integralmente humanas.

• O que foi implementado

Foram criados calendário semanal por período, dias especiais, exceções
recorrentes com validade, resolução de horários reduzidos, seis RPCs
autenticadas, RLS, FKs compostas, retenção e auditoria append-only. O dashboard
mostra calendário, períodos, capacidade total/utilizada/restante, percentagem
ocupada, reservas existentes, exceções, conflitos de horário e indicadores
visuais, sem alterar qualquer reserva.

• Descobertas importantes

Períodos overnight exigem uma data operacional distinta da data civil da
reserva após a meia-noite. Horários reduzidos não autorizam inferir uma redução
proporcional de covers. Percentagens acima de 100% e pedidos ainda não
confirmados devem permanecer visíveis como contexto, nunca como decisões.

• Limitações

Não existe timezone por restaurante, capacidade por área/mesa, distribuição
por intervalos, seating, waitlist, garantia de cartão, menus antecipados ou
qualquer bloqueio/confirmação automática. A vista autenticada não foi
percorrida no browser por ausência de sessão, embora os dados e autorizações
tenham sido validados remotamente com fixtures rollback-only.

• Validações executadas

TypeScript, ESLint focado, `git diff --check`, build Next.js 16.2.1, testes
focados 7/7 e runtime de autenticação/página pública passaram. Migration
list/dry-run antes e depois, aplicação remota, schema/RLS/grants, rollback-only
funcional, compatibilidade dos RPCs públicos V1/V2, regressão completa do Block
41, histórico 24/24 e dry-run final passaram. Leadify não foi alterado.

• Estado final

Block 42 concluído. A Find Dining dispõe de calendário operacional e projeção
informativa multi-restaurante, autenticada, auditada e isolada por
Business/restaurante, sem promessa de mesa nem decisão automática.

• Próximo passo lógico

Block 43 — Operational Capacity Review & Manual Overrides: permitir que a
equipa registe revisões e ajustes manuais auditados sobre a projeção, mantendo
as reservas sob confirmação humana e sem introduzir seating, waitlist,
otimização, distribuição ou bloqueio automático.
