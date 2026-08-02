# DevLog — Block 43

## Objetivo do bloco

Adicionar revisão operacional informativa e overrides manuais por serviço, preservando controlo humano integral e sem alterar automaticamente reservas.

## O que foi implementado

Foi adicionada a migration corretiva `20260702000100_capacity_override_append_only_contract.sql` com o journal `capacity_override_events`, os tipos Allow Over Capacity, Force Operational Review, Temporarily Reduce Capacity e Operational Exception, motivo obrigatório, notas internas opcionais, ator e timestamp. As RPCs autenticadas `create_capacity_override()`, `remove_capacity_override()`, `get_capacity_override_history()` e `list_active_capacity_overrides()` validam membership/role e scope Business/Restaurant/Service. A remoção cria um novo evento; nenhum evento pode ser atualizado ou apagado.

## Descobertas importantes

O rascunho inicial do Block 43 guardava estado mutável e não expunha o contrato nominal pedido. A correção foi aditiva para preservar compatibilidade e quaisquer registos existentes: o estado ativo passa a ser derivado dos eventos `created` e `removed`.

## Limitações

A interface existente continua ligada às RPCs legadas do primeiro rascunho. O sandbox Windows desta execução permitiu criar novos ficheiros, mas recusou alterações a ficheiros existentes; por isso, os quatro RPCs canónicos e o histórico ainda não estão ligados ao dashboard.

## Validações executadas

TypeScript e ESLint focado passaram. O build Next.js 16.2.1 passou. A migration foi aplicada ao projeto Supabase ligado, o lint remoto não encontrou erros e o histórico local/remoto ficou alinhado em 26/26. Foram adicionados scripts transacionais de schema, RPC, auditoria, RLS e rollback-only; a execução SQL direta desses scripts requer uma credencial PostgreSQL não exposta pelo pooler atual.

## Estado final

Contrato de base de dados append-only aplicado e validado remotamente. Integração do dashboard pendente devido ao bloqueio local de edição descrito acima.

## Próximo passo lógico

Block 44 — Reservation Acceptance & Manual Decision Workflow
