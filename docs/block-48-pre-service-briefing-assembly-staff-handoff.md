# Block 48 — Pre-Service Briefing Assembly & Staff Handoff

## Objetivo do bloco

Criar uma fundação operacional, autenticada e business/restaurant-scoped para reunir contexto pré-serviço e permitir handoffs humanos entre sala, cozinha, gestão e outras equipas. O briefing é informativo: não aceita/rejeita reservas, não confirma alterações, não envia comunicações e não altera CRM, guest identities ou perfis alimentares automaticamente.

## Estado inicial encontrado

Blocks 45, 46 e 47 estavam concluídos e aplicados remotamente. O alignment remoto antes do Block 48 estava 32/32 e a migration local `20260706000300_pre_service_briefing_handoff.sql` existia apenas localmente. A primeira versão parcial cobria apenas snapshots prepared/handed_off; foi expandida no mesmo ficheiro, sem criar migration substituta.

## O que foi implementado

- Modelo remoto de briefing explícito com lifecycle humano: `draft`, `prepared`, `handed_off`, `acknowledged`, `closed`.
- Tabelas append-only/auditáveis para notas, itens revistos, handoffs e eventos.
- Assembly read-only via `assemble_pre_service_briefing`, reutilizando `project_operational_capacity_review_v1` para data operacional e períodos overnight.
- RPCs autenticadas e scoped para criar briefing, preparar, adicionar nota, marcar item revisto, criar handoff, reconhecer handoff, fechar, listar e obter detalhe.
- UI autenticada em `/business/briefings` e `/business/briefings/[id]` com filtros, queue, detalhe, métricas, reservas, dietary, guest updates, comunicações, notas, handoffs e auditoria.
- Sidebar com entrada “Briefings”.
- Validações SQL de schema/RLS e comportamento rollback-only.

## Migration final

`supabase/migrations/20260706000300_pre_service_briefing_handoff.sql`

A migration foi aplicada remotamente com sucesso e o histórico remoto final ficou alinhado em 33/33.

## Tabelas, constraints, índices e segurança

Tabelas criadas:

- `pre_service_briefings`
- `pre_service_briefing_notes`
- `pre_service_briefing_reviewed_items`
- `pre_service_briefing_handoffs`
- `pre_service_briefing_events`

Segurança e auditoria:

- RLS habilitado nas novas tabelas.
- `anon` e `authenticated` sem mutação direta nas tabelas.
- `authenticated` recebe apenas `select` governado por policies de membership owner/manager/staff.
- Mutations passam por RPCs security definer com validação de autenticação, membership, business scope, restaurant scope, service period scope e estado atual.
- Eventos, notas, reviewed items e handoffs são append-only por trigger.
- `pre_service_briefing_events_append_only` é validado como existente e habilitado.

## RPCs

- `assemble_pre_service_briefing(uuid,date,uuid)`
- `create_pre_service_briefing(uuid,date,uuid)`
- `prepare_pre_service_briefing(uuid)`
- `add_pre_service_briefing_note(uuid,text,uuid)`
- `mark_pre_service_briefing_item_reviewed(uuid,text,text,uuid,text)`
- `create_pre_service_briefing_handoff(uuid,text,uuid,text)`
- `acknowledge_pre_service_briefing_handoff(uuid,text)`
- `close_pre_service_briefing(uuid,text)`
- `list_pre_service_briefings(uuid,uuid,date,uuid,text)`
- `get_pre_service_briefing(uuid)`

## Integrações reutilizadas

- Service periods/capacity/operational date projection dos Blocks 41–43.
- Manual reservation states do Block 44.
- Communications dos Blocks 45–46.
- Guest update review do Block 47.
- Reservation guests, dietary profiles, internal notes, timeline, memberships, businesses e restaurants existentes.

## Validações executadas

Locais:

- `npx tsc --noEmit` — passou.
- ESLint focado para `app/[locale]/(app)/business/briefings` e `components/Sidebar.tsx` — passou.
- `npm run build` — primeiro bloqueado pelo fetch de Google Fonts em rede restrita; passou após execução com rede aprovada.
- `git diff --check` — passou.
- Busca Leadify nos ficheiros Block 48 tocados — sem referências.

Remotas:

- `npx supabase migration list --linked` — confirmou `20260706000300` no histórico remoto e alignment 33/33.
- `npx supabase db push --linked --dry-run` — passou antes da aplicação e listou apenas a migration Block 48.
- `npx supabase db push --linked` — aplicou apenas `20260706000300_pre_service_briefing_handoff.sql`.
- `npx supabase db lint --linked --level warning` — passou, sem schema errors.
- `supabase/validation/block-48-pre-service-briefing-schema.sql` — passou com `block_48_pre_service_briefing_schema_valid`.
- `supabase/validation/block-48-pre-service-briefing-behavior.sql` — passou com contexto autenticado; a asserção append-only aceita `42501` por grants/RLS ou `55000` por trigger, e falha se update direto suceder.
- Validação remota rollback-only adicional — passou com `block_48_remote_lifecycle_validation_valid`.

A validação remota adicional confirmou:

- criação explícita de briefing;
- data operacional e período overnight;
- reservas `accepted` incluídas;
- reservas `pending` e `rejected` excluídas;
- preparação manual;
- handoff manual;
- acknowledgement manual;
- fecho manual;
- transições inválidas rejeitadas;
- eventos append-only;
- actor identity registada pelo `auth.uid()`;
- business isolation;
- restaurant/service-period isolation;
- guest update pendente aparece apenas como pendente/requer revisão;
- guest update aceite aparece como contexto revisto;
- guest update dismissed não aparece como instrução ativa;
- comunicação draft não conta como enviada;
- comunicação cancelled não aparece como ativa;
- ausência de mutação automática em reservas, CRM, guest identities, reservation guests e dietary profiles.

Runtime/browser:

- `/pt/business/briefings` carregou autenticado com filtros, CTA explícito e empty state; console sem erros.
- Briefing detail route carregou autenticada para briefing de validação `bbe9dead-db08-49a9-884e-26a0c1c6ed70`; console sem erros.
- UI action `Prepare briefing` funcionou e registou evento.
- UI handoff, acknowledgement e close foram persistidos; a detail route final mostrou `closed` e eventos `briefing_created`, `briefing_prepared`, `handoff_created`, `handoff_acknowledged`, `briefing_closed`.
- Queue filtrada por `2026-12-31&status=closed` mostrou o briefing fechado; console sem erros.

## Descobertas importantes

- O teste inicial de append-only era demasiado estreito: em runtime autenticado, grants/RLS podem negar `UPDATE` com `42501` antes do trigger append-only produzir `55000`. O script foi corrigido para aceitar ambos como proteção válida e continuar a falhar se o update direto suceder.
- O Block 48 não precisa de alteração de schema para este comportamento; a negação por grants/RLS é mais restritiva e desejável.
- A submissão “Create / open briefing” via browser control não navegou durante a validação, mas a rota de detalhe, server action de prepare e lifecycle persistido foram validados. O briefing de validação foi criado via RPC autenticada e fechado.

## Limitações e risco residual

- A validação browser exercitou um briefing sem reservas reais na UI. A cobertura com reservas, guest updates, comunicação e overnight foi feita remotamente via SQL rollback-only.
- O briefing de validação fechado `bbe9dead-db08-49a9-884e-26a0c1c6ed70` permanece como histórico auditável, sem mutar reservas/CRM/perfis.
- O ESLint global continua fora do scope por erros preexistentes documentados em blocos anteriores.

## Confirmações de escopo

- Nenhuma decisão operacional foi automatizada.
- Nenhuma comunicação foi enviada automaticamente.
- Nenhuma reserva, CRM, guest identity ou guest profile foi alterado automaticamente pelo Block 48.
- O Block 46 synthetic reservation não foi apagado.
- Leadify não foi alterado.
- Block 49 não foi iniciado.

## Estado final

Block 48 concluído e aplicado remotamente. Migration alignment final: 33/33.

## Próximo passo lógico

Definir o Block 49 apenas após nova instrução de produto, provavelmente focado em consolidar reporting/operational follow-up sobre briefings fechados e handoffs pendentes, sem automatizar decisões ou comunicações.
