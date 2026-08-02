# Block 40 — Business-configurable SLA Policy Governance

## Âmbito

O Block 40 permite configurar limites SLA informativos por Business para a Reconciliation Queue. A alteração é governada, Business-scoped e integralmente auditada. Nenhuma política atribui, escala, recupera, fecha ou altera automaticamente trabalho operacional.

## SLA Policy

Cada Business possui uma política corrente em `reconciliation_sla_policies` com três limites inteiros entre 1 e 720 horas:

- prioridade alta;
- prioridade média;
- prioridade baixa.

A migration inicializa os Businesses existentes com os valores do Block 39 — 24h, 72h e 120h — e instala um trigger que atribui os mesmos defaults, com auditoria, a futuros Businesses.

## Governance e auditoria

- Apenas memberships com papel `owner` ou `manager` podem alterar a política.
- `staff` mantém leitura Business-scoped, mas não pode configurar.
- A escrita é exposta exclusivamente pela RPC `set_reconciliation_sla_policy_v1`.
- `anon` não possui acesso às tabelas nem à RPC.
- Clientes `authenticated` têm apenas `select` nas tabelas; não têm `insert`, `update` ou `delete` direto.
- Cada alteração efetiva acrescenta um evento a `reconciliation_sla_policy_audit_events` com valores anteriores, valores novos, ator e timestamp.
- Submissões sem alteração não acrescentam ruído ao journal.
- Updates e deletes do journal são rejeitados por trigger.
- A política corrente não pode ser apagada.

## Business scope e RLS

As duas tabelas usam RLS baseada em `is_business_member(business_id)`. A RPC volta a resolver o papel do utilizador autenticado junto da fonte de dados. A UI apenas reflete essa autorização; não é a fronteira decisiva.

A validação rollback-only confirmou leitura do próprio Business e negação cross-Business.

## Reporting temporal

O dashboard utiliza a política corrente do Business para casos abertos. Isto permite recalcular imediatamente ageing e estados `within`, `near` e `over SLA` quando um owner ou manager muda os limites.

Para preservar métricas históricas:

- a conclusão continua a ser determinada pelo evento append-only `status_changed` para `completed`;
- a prioridade usada é a última prioridade auditada até ao instante da conclusão;
- a política usada é a última versão auditada até ao instante da conclusão;
- alterações posteriores de prioridade ou política não reclassificam casos já concluídos;
- conclusões anteriores à existência do histórico do Block 40 mantêm os defaults do Block 39.

O limiar `near SLA` permanece informativo e fixo em 75% do limite configurado.

## UI

A Reconciliation Queue apresenta:

- configuração por Business para High, Medium e Low;
- estado read-only para membros sem papel autorizado;
- feedback da Server Action e da RPC;
- histórico append-only visível por Business;
- resumo das políticas ativas no dashboard;
- identificação de cálculos históricos nos casos concluídos.

## Artefactos

- Migration: `supabase/migrations/20260629000100_business_configurable_sla_policy_governance.sql`.
- Schema validation: `supabase/validation/block-40-business-configurable-sla-policy-schema.sql`.
- Rollback-only: `supabase/validation/block-40-business-configurable-sla-policy-governance-rollback.sql`.
- Policy model: `lib/reconciliation-sla-policy.ts`.
- Focused tests: `lib/reconciliation-sla-policy.test.ts` e `lib/reconciliation-reporting.test.ts`.
- Governance UI: `app/[locale]/(app)/business/reconciliation/sla-policy-governance.tsx`.

## Validação remota

Antes da aplicação, `supabase migration list --linked` confirmou 21/21 migrations alinhadas e o dry-run selecionou exclusivamente `20260629000100`.

A migration foi aplicada pelo fluxo normal `supabase db push --linked`. Depois da aplicação:

- o rollback-only devolveu `block_40_business_configurable_sla_policy_governance_valid`;
- a inspeção de schema/RLS/grants devolveu `block_40_business_configurable_sla_policy_schema_valid`;
- o histórico ficou alinhado em 22/22;
- o dry-run final devolveu `Remote database is up to date`;
- os rollback-only regressivos dos Blocks 35, 36 e 37 voltaram a passar.

## Riscos e limitações

- O limiar de aproximação permanece fixo em 75%; apenas as horas por prioridade são Business-configurable.
- O reporting continua limitado aos 500 casos carregados pela fila.
- Eventos concluídos anteriores ao primeiro snapshot de política usam deliberadamente os defaults do Block 39.
- A política é informativa e não implementa auto assignment, auto escalation, auto recovery, auto close ou qualquer decisão automática.

## Encerramento da linha Governance/Reconciliation

A linha pode ser considerada funcionalmente encerrada. O percurso cobre decisão humana explícita, provenance, recovery governado, revisão pós-recovery, fila Business-wide, routing idempotente, ownership, ageing, SLA e política configurável com RLS e histórico append-only. Novos blocos nesta linha só devem nascer de evidência operacional concreta, requisitos regulatórios adicionais ou necessidades de escala; não existe uma lacuna funcional obrigatória que justifique continuar a sequência por inércia.

O próximo grande pilar é **Reservation Capacity & Availability Management**. A documentação atual continua a declarar que os horários públicos são pedidos e não disponibilidade real. O novo pilar deve começar por uma fundação Business-scoped de períodos de serviço, capacidade, áreas/mesas e exceções, antes de qualquer confirmação automática ou promessa de slot ao guest.

## DevLog — Block 40

• Objetivo do bloco

Permitir políticas SLA configuráveis por Business na Reconciliation Queue, com permissões explícitas, RLS, auditoria append-only e reporting temporal, mantendo o SLA estritamente informativo.

• O que foi implementado

Foi criada uma política corrente por Business para prioridades alta, média e baixa, uma RPC exclusiva para owners/managers, um journal imutável, defaults auditados para Businesses existentes e futuros, UI de configuração e histórico, e reporting que usa a política ativa nos casos abertos e a política/prioridade vigentes na conclusão nos casos históricos.

• Descobertas importantes

Preservar apenas a versão da política não é suficiente: a prioridade também pode mudar depois da conclusão. A reconstrução conjunta dos dois journals append-only mantém a classificação histórica estável sem alterar a state machine da fila nem criar snapshots destrutivos.

• Limitações

O limiar `near SLA` permanece em 75%, a fila mantém o limite de 500 casos e conclusões anteriores ao primeiro snapshot usam os defaults do Block 39. Não existe qualquer automação de assignment, escalation, recovery ou closure.

• Validações executadas

Migration list e dry-run antes da aplicação, aplicação remota pelo fluxo normal, schema/RLS/grants remoto, rollback-only do Block 40, histórico 22/22 e dry-run final passaram. Os regressivos rollback-only dos Blocks 35–37 passaram. TypeScript, ESLint focado, testes focados, `git diff --check`, build e validação runtime foram executados no fecho do bloco. Leadify não foi alterado.

• Estado final

Block 40 concluído. As políticas SLA são Business-configurable, autorizadas, auditadas e historicamente estáveis, sem qualquer decisão automática. A linha Governance/Reconciliation fica encerrada no seu scope atual.

• Próximo passo lógico

Iniciar o novo pilar Reservation Capacity & Availability Management, começando por uma fundação Business-scoped de períodos de serviço, capacidade, áreas/mesas e exceções, sem confirmação automática e sem alterar os contratos validados de reservas existentes.
