# Block 44 — Reservation Acceptance & Manual Decision Workflow

## Âmbito

O Block 44 adiciona decisões manuais explícitas às reservas canónicas. Toda reserva nova continua a nascer com `pending`, apresentado como Pending Review. Apenas owners, managers e staff autenticado do Business proprietário podem aceitar, rejeitar ou devolver a pending. Nenhum caminho automático, notificação ou comunicação foi introduzido.

## Contrato

`reservation_decision_events` é um journal append-only Business/Restaurant-scoped com estado anterior/novo, motivo, notas, ator e timestamp. O estado atual permanece em `reservations.status`; o grant direto da coluna `status` foi removido para tornar as RPCs auditadas o único caminho de decisão.

As RPCs públicas autenticadas são `accept_reservation()`, `reject_reservation()`, `return_reservation_to_pending()` e `list_pending_reservations()`. Duplicados, transições inválidas, acesso cross-Business e utilizadores sem membership são rejeitados na base.

## Interface

`/{locale}/business/reservations/decisions` apresenta a fila Pending Review por Business/Restaurant. A rota de decisão reutiliza integralmente o detalhe existente da reserva e acrescenta controlos de confirmação, contexto operacional de calendário/capacidade/overrides e o journal de decisões. Os eventos também são inseridos na timeline existente.

## DevLog — Block 44

### Objetivo do bloco

Implementar aceitação, rejeição e retorno a Pending Review exclusivamente manuais, com autorização e auditoria completa.

### O que foi implementado

Foram implementadas quatro RPCs autenticadas, journal append-only, RLS, proteção contra bypass da coluna de status, fila Pending Review, página de decisão, diálogos de confirmação, badges e integração automática com a timeline existente. O detalhe reutiliza os componentes de identidade, histórico, dieta, convidados e notas, acrescentando contexto de capacidade, calendário, período e overrides.

### Descobertas importantes

Separar estado atual mutável de journal imutável preserva consultas operacionais simples sem sacrificar reconstrução histórica. Revogar apenas o update da coluna `status` mantém compatibilidade com as restantes edições da reserva.

### Limitações

Estados legados `confirmed` e `declined` continuam legíveis por compatibilidade, mas não entram automaticamente no novo workflow. Não existem notificações, confirmação ao cliente, waitlist, seating, scoring ou decisões automáticas. Os scripts SQL transacionais de RPC/RLS/auditoria foram criados, mas a execução direta requer credencial PostgreSQL não exposta pelo pooler ligado.

### Validações executadas

Migration aplicada, remote schema lint, alinhamento 28/28, TypeScript, ESLint, production build e runtime autenticado da fila, detalhe e diálogo de confirmação. Foram criados scripts rollback-only para RPCs, transições, duplicados, autorização, RLS e auditoria.

### Estado final

Block 44 implementado com decisão exclusivamente humana e histórico integralmente auditável.

### Próximo passo lógico

Block 45 — Reservation Confirmation & Guest Communication Foundation
