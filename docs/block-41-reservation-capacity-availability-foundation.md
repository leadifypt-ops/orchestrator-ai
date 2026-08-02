# Block 41 — Reservation Capacity & Availability Management Foundation

## Âmbito

O Block 41 inicia o pilar de Reservation Capacity & Availability Management. Cria configuração operacional Business-scoped e restaurant-aware para períodos de serviço, capacidade, áreas e exceções. Estes dados são exclusivamente informativos: não bloqueiam, confirmam, recusam ou alteram reservas.

Não existe no workspace um ficheiro separado chamado Documento Mestre. O alinhamento foi feito com a arquitetura versionada — ownership, Reservation Core, public pipeline/form V2, route architecture e DevLog integral até ao Block 40 — e com a visão explícita fornecida para este bloco.

## Business Service Periods

`business_service_periods` representa janelas operacionais de cada restaurante:

- Business e restaurante obrigatórios e coerentes por FK composta;
- nome até 100 caracteres;
- hora de início e fim distintas;
- suporte para períodos que atravessam a meia-noite;
- estado ativo/inativo;
- autoria e timestamps.

O nome é único por restaurante, sem distinção de maiúsculas/minúsculas. Um período não publica inventário nem implica disponibilidade.

## Reservation Capacity

`reservation_capacity_settings` guarda uma configuração por período:

- capacidade máxima em covers;
- máximo de reservas simultâneas;
- duração configurável do intervalo;
- máximo de covers por intervalo.

Os limites simultâneo e por intervalo não podem exceder a capacidade máxima. Nenhum trigger, RPC ou alteração foi ligado à criação ou ao estado das reservas.

## Restaurant Areas

`restaurant_areas` cria a fundação para Sala Principal, Terraço, Bar, Private Dining e outras zonas operacionais:

- Business e restaurante obrigatórios;
- nome único por restaurante;
- estado ativo/inativo;
- sem mesas individuais, seating ou capacidade por área neste bloco.

## Availability Exceptions

`availability_exceptions` permite registar encerramento, evento privado, manutenção, horário reduzido e outras exceções documentadas.

Cada exceção possui data, restaurante, motivo, estado e período opcional. Um período nulo significa todos os períodos do dia. Horário reduzido exige início e fim estruturados e distintos. Existe apenas uma configuração corrente por restaurante/data/período; alterações são feitas sobre o registo existente e preservadas no journal.

## Governance, RLS e auditoria

- Apenas `owner` e `manager` podem criar ou alterar configuração.
- `staff` possui leitura Business-scoped, mas não pode escrever.
- Clientes autenticados têm apenas `select` nas cinco tabelas.
- `anon` não possui acesso às tabelas nem às RPCs.
- Escritas passam exclusivamente por quatro RPCs autenticadas.
- FKs compostas impedem associação de restaurantes e períodos cross-Business.
- `reservation_availability_audit_events` regista cada criação e alteração com valores anteriores, novos, ator e timestamp.
- O journal rejeita update/delete.
- As quatro entidades operacionais rejeitam delete; desativação é a alternativa governada.
- Submissões sem alteração não acrescentam eventos de auditoria.

RPCs:

- `save_business_service_period_v1`;
- `set_reservation_capacity_v1`;
- `save_restaurant_area_v1`;
- `save_availability_exception_v1`.

## Business Dashboard

Foram adicionadas as rotas:

- `/business/availability` — resumo operacional, readiness e alterações recentes;
- `/business/availability/service-periods`;
- `/business/availability/capacity`;
- `/business/availability/areas`;
- `/business/availability/exceptions`.

A navegação Business inclui uma entrada `Availability`. Os formulários suportam criação e edição, respeitam o papel corrente e repetem autenticação na Server Action antes da autorização decisiva na RPC.

## Compatibilidade e ausência de automação

O Block 41 não alterou:

- `reservations` ou respetivos estados;
- `create_public_reservation_v1` ou `create_public_reservation_v2`;
- formulário público e slots atuais;
- confirmação manual;
- Guest Identity, recovery ou reconciliation;
- Leadify.

Não foram implementados algoritmo de disponibilidade, bloqueio, auto confirmation, waitlist, seating, mesas, otimização, garantia de cartão ou seleção de menus.

## Artefactos

- Migration: `supabase/migrations/20260629000200_reservation_capacity_availability_foundation.sql`.
- Schema audit: `supabase/validation/block-41-reservation-capacity-availability-schema.sql`.
- Rollback-only: `supabase/validation/block-41-reservation-capacity-availability-rollback.sql`.
- Tipos e helpers: `lib/availability.ts`.
- Testes focados: `lib/availability.test.ts`.
- Dashboard e gestão: `app/[locale]/(app)/business/availability/`.

## Validação remota

Antes da aplicação, o histórico estava alinhado em 22/22 e o dry-run selecionou exclusivamente `20260629000200`. A migration foi aplicada pelo fluxo normal `supabase db push --linked`.

Depois da aplicação:

- schema/RLS/grants/triggers: `block_41_reservation_capacity_availability_schema_valid`;
- funcional rollback-only: `block_41_reservation_capacity_availability_valid`;
- criação e alteração das quatro entidades confirmadas;
- no-op sem audit noise confirmado;
- retenção e journal append-only confirmados;
- `staff` denial e isolamento cross-Business confirmados;
- histórico alinhado em 23/23;
- dry-run final: `Remote database is up to date`;
- rollback-only do Block 40 voltou a passar;
- RPCs públicos V1/V2 continuam presentes e executáveis por `anon`, sem alteração de contrato.

## Validações aplicacionais

- TypeScript: passou.
- ESLint focado: passou.
- `git diff --check`: passou.
- Testes focados: 4/4 passaram.
- Build Next.js 16.2.1: passou e incluiu as cinco novas rotas.
- A validação visual autenticada não foi executada: a política de segurança do browser rejeitou o acesso ao servidor isolado em `127.0.0.1:3101`. A restrição não foi contornada.

## Descobertas e decisões

- A configuração precisa de `restaurant_id` além de `business_id`, porque um Business pode operar vários restaurantes com horários e capacidade independentes.
- Um limite por intervalo exige que a duração do intervalo seja explícita; por isso `interval_minutes` faz parte da fundação.
- Horários reduzidos precisam de campos estruturados e não apenas texto livre.
- Período nulo numa exceção representa corretamente uma operação encerrada ou alterada durante todo o dia.

## Limitações

- Períodos ainda não possuem calendário semanal ou dias da semana.
- A capacidade não é consumida nem comparada automaticamente com reservas.
- Áreas não possuem mesas nem capacidade própria.
- Exceções não alteram o formulário público.
- Não existe disponibilidade calculada, hold, waitlist, seating ou confirmação automática.

## DevLog — Block 41

• Objetivo do bloco

Criar a fundação Business-scoped e restaurant-aware para períodos de serviço, capacidade, áreas e exceções operacionais, antes de qualquer decisão automática sobre reservas.

• O que foi implementado

Foram criadas quatro entidades operacionais, quatro RPCs governadas, RLS de membership, autorização owner/manager, journal append-only, retenção sem delete e cinco páginas Business para resumo e gestão. A capacidade inclui máximos globais, simultâneos e por intervalo configurável. Exceções suportam dia completo, período específico e horário reduzido estruturado.

• Descobertas importantes

Business scope isolado não é suficiente para operação multi-restaurante; a configuração precisa também de restaurant scope verificável. Limites por intervalo e horários reduzidos exigem dados estruturados para suportar projeções futuras sem reinterpretar texto livre.

• Limitações

Não existe calendário semanal, algoritmo de disponibilidade, consumo de capacidade, gestão de mesas, waitlist, seating, garantia de cartão, menus antecipados ou qualquer bloqueio/decisão automática. A validação visual ficou limitada pela política de segurança do browser e não foi contornada.

• Validações executadas

TypeScript, ESLint focado, `git diff --check`, build, testes focados 4/4, migration list/dry-run antes e depois, aplicação remota, schema audit, rollback-only funcional, regressão do Block 40 e verificação read-only dos RPCs públicos V1/V2 passaram. O histórico remoto ficou alinhado em 23/23. Leadify não foi alterado.

• Estado final

Block 41 concluído. A Find Dining dispõe agora de uma fundação operacional configurável, auditada e isolada por Business/restaurante, sem modificar a confirmação manual nem o comportamento das reservas.

• Próximo passo lógico

Block 42 — Service Calendar & Informational Availability Projection: associar períodos a dias de operação e projetar, em modo read-only, capacidade configurada versus pedidos/reservas existentes e exceções, sem bloquear pedidos, prometer mesa ou confirmar automaticamente.
