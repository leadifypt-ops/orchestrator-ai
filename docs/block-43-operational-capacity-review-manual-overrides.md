# Block 43 — Operational Capacity Review & Manual Overrides

## Âmbito

O Block 43 acrescenta uma camada operacional Business/Restaurant-scoped sobre a projeção informativa do Block 42. A equipa pode rever a operação e registar decisões humanas temporárias por data e período. Nenhum override é consumido por criação, confirmação, alteração ou cancelamento de reservas.

## Implementação

`operational_capacity_overrides` guarda capacidade original e ajustada, data operacional, período, motivo, ator e timestamp. Só pode existir um override ativo por restaurante/data/período; uma revisão desativa o anterior sem o apagar. Capacidade zero representa uma decisão humana explícita de encerrar o período. Todos os overrides são temporários porque pertencem a uma única data operacional.

`operational_capacity_notes` guarda contexto temporário por data e, opcionalmente, período: equipa reduzida, evento privado, manutenção, cozinha parcial, sala indisponível ou outro. As notas aparecem junto da projeção.

Cinco RPCs autenticadas foram adicionadas:

- `save_operational_capacity_override_v1`;
- `end_operational_capacity_override_v1`;
- `save_operational_capacity_note_v1`;
- `end_operational_capacity_note_v1`;
- `project_operational_capacity_review_v1`.

As escritas repetem autenticação e autorização owner/manager na base. A leitura repete membership e coerência Business/restaurante. FKs compostas impedem referências cross-Business. As tabelas têm RLS, grants read-only para `authenticated`, nenhum acesso `anon` e triggers que impedem delete.

## Projeção e dashboard

A nova RPC envolve `project_restaurant_availability_v1`, sem a substituir. Devolve períodos ativos, horários efetivos/reduzidos, exceções, reservas existentes, covers, ocupação, capacidade original, capacidade ajustada, override ativo, motivo, autoria, timestamp e notas operacionais.

A rota `/{locale}/business/availability/review` apresenta filtros de restaurante/data, indicadores agregados, formulários governados e uma tabela por período. Overrides ativos recebem destaque visual. Capacidade zero é apenas contexto operacional: não cria trigger, hold, bloqueio, confirmação, recusa, movimento, cancelamento, seating ou waitlist.

## Auditoria append-only

O journal existente aceita `capacity_override` e `operational_note`. Cada criação, substituição ou encerramento regista ator, timestamp, motivo e valores anteriores/novos. O journal mantém o trigger append-only; overrides e notas não podem ser apagados.

## Artefactos

- Migration: `supabase/migrations/20260701000100_operational_capacity_review_manual_overrides.sql`.
- Schema: `supabase/validation/block-43-operational-capacity-review-schema.sql`.
- Rollback-only: `supabase/validation/block-43-operational-capacity-review-rollback.sql`.
- Tipos/testes: `lib/operational-capacity.ts` e `lib/operational-capacity.test.ts`.
- Dashboard: `app/[locale]/(app)/business/availability/review/`.

## Validação

TypeScript, ESLint focado, `git diff --check`, build Next.js 16.2.1 e testes focados/regressão (8/8) passaram. A migration remota foi isolada por dry-run e aplicada. O lint remoto não encontrou erros. O histórico remoto ficou alinhado em 25/25 e o dry-run final indicou base atualizada. Os scripts de schema e rollback-only foram criados; a execução SQL direta não ficou disponível neste ambiente porque o pooler ligado não expõe password, pelo que a validação funcional remota integral deve ser repetida num ambiente com credencial PostgreSQL. O Block 42 manteve TypeScript, testes e build íntegros. Leadify não foi alterado.

## DevLog — Block 43

• Objetivo do bloco

Adicionar revisão operacional e overrides temporários, manuais e auditados sobre a projeção de capacidade, mantendo todas as decisões exclusivamente humanas.

• O que foi implementado

Foram criadas duas entidades retidas, cinco RPCs autenticadas, RLS, FKs compostas, auditoria append-only e a página Operational Review. A equipa vê capacidade original/ajustada, reservas, ocupação, exceções, horários, períodos, motivo, autoria, timestamp e notas operacionais.

• Descobertas importantes

Compor uma nova projeção sobre o Block 42 preserva o contrato informativo existente e evita ligar overrides ao pipeline de reservas. Uma data operacional única torna todo override intrinsecamente temporário, inclusive em períodos overnight.

• Limitações

Sem timezone por restaurante, capacidade por área/mesa, seating, waitlist, otimização ou decisões automáticas. A execução remota direta dos scripts rollback-only requer password PostgreSQL não exposta pelo ambiente atual.

• Validações executadas

TypeScript, ESLint focado, `git diff --check`, build, 8/8 testes focados/regressão, migration list/dry-run, aplicação remota e lint remoto passaram. Block 42 e Leadify permaneceram íntegros.

• Estado final

Block 43 implementado e documentado, com migration aplicada. A única validação pendente é a execução SQL remota direta dos scripts rollback-only num ambiente com password PostgreSQL.

• Próximo passo lógico

Block 44 — revisão manual diária por serviço e histórico operacional consolidado, sem introduzir decisões automáticas.
