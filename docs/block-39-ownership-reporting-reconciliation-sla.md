# Block 39 — Ownership Reporting & Reconciliation Queue SLA

## Âmbito

O Block 39 acrescenta reporting operacional à Business-wide Reconciliation Queue sem introduzir decisões automáticas. A atribuição, revisão, recuperação e conclusão continuam exclusivamente sob controlo humano.

## Ownership reporting

- Resumo agregado dos casos visíveis segundo os filtros ativos.
- Contagem de casos atribuídos e não atribuídos.
- Distribuição por responsável com totais de pendentes, em revisão, concluídos e abertos acima do SLA.
- Filtro por responsável, incluindo casos sem responsável.
- Reutilização da RPC `list_reconciliation_assignees_v1` e do `assigned_to` já existentes.

## Ageing

- Idade do caso calculada desde `created_at`.
- Tempo desde a última atualização calculado desde `updated_at`.
- Destaque visual informativo para casos próximos do SLA e acima do SLA.
- Datas completas mantidas no atributo `title` das células para consulta sem perder a leitura operacional compacta.

## SLA informativo

Os limites são constantes aplicacionais deliberadamente não automáticas:

- Prioridade alta: 24 horas.
- Prioridade média: 72 horas.
- Prioridade baixa: 120 horas.
- Próximo do SLA: a partir de 75% do limite.
- SLA ultrapassado: acima de 100% do limite.

Para casos abertos, o tempo decorre entre a criação e o momento da leitura. Para casos concluídos, o cálculo termina no evento append-only mais recente de mudança para `completed`; `updated_at` é apenas fallback defensivo. Isto evita que uma alteração posterior distorça o resultado histórico.

O SLA nunca atribui, recupera, fecha ou escala casos.

## Dados, segurança e arquitetura

- Não foi criada migration nem alterado o schema.
- As leituras continuam submetidas ao Business scope e às políticas RLS existentes.
- O histórico de conclusão é lido de `reconciliation_queue_audit_events`.
- Nenhuma mutation, RPC de escrita ou automação foi adicionada.
- A fila preserva o limite operacional existente de 500 registos.
- Leadify não foi alterado.

## Implementação

- `lib/reconciliation-reporting.ts`: cálculo puro de tempos, classificação SLA, formatação de duração e agregação de ownership.
- `app/[locale]/(app)/business/reconciliation/reconciliation-reporting.tsx`: dashboard, tabela de ownership, indicadores e células de ageing/SLA.
- `app/[locale]/(app)/business/reconciliation/page.tsx`: leitura do audit journal, filtro por responsável e integração do reporting na fila existente.
- `lib/reconciliation-reporting.test.ts`: cobertura focada dos limites SLA, conclusão append-only, ownership e formatação.

## Riscos e limitações

- Os limites SLA são configuração aplicacional fixa; não existe ainda política configurável por Business.
- O SLA de um caso concluído usa a prioridade atual do caso, porque ainda não existe snapshot imutável da política/prioridade no momento da conclusão.
- As métricas refletem os registos carregados pela fila e os filtros ativos, mantendo o limite existente de 500 casos.
- Não foi executada validação remota de migration porque o bloco não contém alterações de base de dados.
- A validação runtime confirmou a fronteira de autenticação e ausência de erros de consola; sem uma sessão autenticada disponível, a renderização com dados reais não foi exercitada no browser.

## DevLog — Block 39

• Objetivo do bloco

Adicionar visibilidade operacional de ownership, ageing e SLA à Business-wide Reconciliation Queue, preservando recovery governado e assignment humano explícito.

• O que foi implementado

Foi adicionado um dashboard read-only com métricas agregadas, distribuição por responsável, estados pendente/em revisão/concluído, casos sem responsável, ageing, última atividade, SLA informativo e filtros por responsável e estado. O cálculo de conclusão reutiliza o audit journal append-only e nenhuma ação automática foi introduzida.

• Descobertas importantes

O evento append-only de transição para `completed` é a referência mais segura para medir o SLA final, porque `updated_at` pode mudar depois da conclusão. O modelo atual permite implementar todo o reporting sem migration e sem contornar RLS.

• Limitações

Os limites SLA são fixos na aplicação, as métricas respeitam o limite atual de 500 casos carregados e não existe snapshot histórico da prioridade/política SLA. O reporting é estritamente informativo.

• Validações executadas

TypeScript, ESLint focado, `git diff --check`, build de produção e testes focados da lógica de reporting passaram. A rota foi validada em runtime: redirecionou corretamente para `/pt/login` sem erros de consola; a vista autenticada não foi exercitada por ausência de sessão. Não existiu migration para validar remotamente. Foi confirmado que Leadify não foi alterado e que nenhuma mutation ou automação foi adicionada.

• Estado final

Block 39 concluído: a fila dispõe de ownership reporting, ageing e monitorização SLA, mantendo Business scope, RLS, auditoria append-only e controlo humano integral.

• Próximo passo lógico

Block 40 — Business-configurable SLA Policy Governance: definir políticas SLA por Business com permissões explícitas, validação e auditoria append-only, mantendo-as informativas e sem auto assignment, auto recovery, auto close ou auto escalation.
