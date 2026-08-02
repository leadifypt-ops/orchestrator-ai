# FIND DINE — DOCUMENTO MESTRE

**Versão 2.0**

## 1. Identificação do documento

Este documento é a fonte canónica de produto para o projeto Find Dining / Find Dine após a conclusão do Block 48. Substitui o enquadramento histórico da versão 1.2 sem apagar decisões estratégicas anteriores: cada decisão é reclassificada conforme o estado real do repositório, das migrations aplicadas, das validações e dos DevLogs versionados.

Data de referência técnica: Blocks 28–48 preservados em Git, branch `main`, remoto `origin/main`, histórico Supabase local/remoto alinhado em 33/33, última migration aplicada `20260706000300_pre_service_briefing_handoff.sql`.

## 2. Visão do produto

Find Dining é uma plataforma premium para restaurantes Michelin e Michelin Recommended. O produto combina uma experiência de descoberta e reserva para guests com uma camada operacional para restaurantes que precisam preparar melhor o serviço, preservar contexto gastronómico reutilizável e reduzir incerteza antes da chegada do guest.

A visão permanece: melhorar a experiência antes da reserva, tornar a operação mais eficiente, consolidar contexto gastronómico e ajudar equipas de sala, cozinha e gestão a preparar um serviço personalizado.

## 3. Princípio fundamental

Find Dining não é apenas software de restaurante. É um marketplace premium para restaurantes Michelin e Michelin Recommended, suportado por um sistema operacional que ajuda restaurantes a prestar serviço mais personalizado através de contexto de guests, reservas, notas internas, comunicações humanas, briefings e handoffs.

## 4. Problemas reais observados

1. Reservas de manhã podem não chegar com visibilidade imediata à cozinha ou à equipa certa.
2. Informação de alergias, restrições e preferências pode ficar fragmentada entre reserva, guest, notas e comunicação.
3. Alterações tardias de guests criam incerteza operacional.
4. A capacidade operacional pode ser excedida sem contexto suficiente para decisão humana.

A solução atual já mitiga estes problemas com reservas canónicas, perfis alimentares, guest identities, histórico, notas internas, timeline, reconciliação, capacidade informativa, confirmação pública, guest updates, review humana e briefings pré-serviço. Ainda não existe automação de decisões, envio externo, seating, waitlist inteligente ou atualização automática de CRM/perfis.

## 5. Arquitetura da plataforma

A arquitetura de produto mantém quatro áreas:

1. **Guest Marketplace** — parcialmente implementado. Existem páginas públicas de restaurante/reserva, fluxo público de pedido de reserva, confirmação pública por token e recolha limitada de preferências/notas. A experiência completa de conta guest, marketplace premium, perfil autónomo e discovery avançado ainda não está completa.
2. **Business Operations** — área mais avançada. Inclui dashboard operacional, reservas canónicas, decisões manuais, guest profiles, data quality, recovery, reconciliação, SLA, capacidade, comunicações, guest updates e briefings.
3. **Restaurant Onboarding** — parcialmente implementado. Existem estruturas para restaurants, visual identity, service periods, capacidade, áreas e exceções, mas não há produto completo de onboarding guiado.
4. **Find Dining Admin** — não evidenciado como produto completo no estado atual. Administração interna e governação existem por dados, migrations e RLS, mas uma superfície Admin dedicada não está implementada como pilar completo.

## 6. Estado atual do produto

O projeto já não está apenas em arquitetura ou planeamento. Após o Block 48, Find Dining possui uma base operacional real e validada remotamente:

- arquitetura Business-scoped e Restaurant-scoped;
- memberships e roles owner/manager/staff;
- reservas canónicas e fluxo público de pedido;
- guest identities, perfis consolidados e histórico;
- perfis alimentares por guest/reserva;
- notas internas e timeline;
- merge, recovery, provenance e reconciliação;
- governação SLA configurável por Business;
- service periods, capacidade, áreas e exceções;
- datas operacionais e períodos overnight;
- projeção informativa de disponibilidade;
- overrides manuais e notas operacionais;
- aceitação/rejeição manual de reservas;
- drafts de comunicação e lifecycle humano;
- tokens públicos de confirmação;
- preferências/notas submetidas por guests;
- review humana de guest updates;
- briefings pré-serviço e handoffs com acknowledgements.

O produto ainda não entrega o marketplace completo, guest accounts completas, onboarding final, admin completo, pagamentos, card guarantee, waitlist, seating, floor plan, envio WhatsApp/email/SMS por provider ou automações de decisão.

## 7. Estado técnico confirmado

- Aplicação em Next.js.
- Backend de dados e autenticação em Supabase.
- RLS habilitado nas principais tabelas operacionais novas.
- RPCs autenticadas e security-definer para mutations sensíveis.
- Padrões append-only para auditoria e timeline.
- Migrations remotas alinhadas em 33/33.
- Última migration aplicada: `20260706000300_pre_service_briefing_handoff.sql`.
- Blocks 28–48 preservados em Git e enviados para `origin/main`.
- Não existe provider externo ativo para envio automático de comunicações.
- Decisões de reserva, comunicações, guest updates, briefings e handoffs permanecem humanos.

## 8. MVP

O MVP histórico incluía conta guest, perfil gastronómico, discovery, página de restaurante, reservas, menus, alergias, observações, dashboard de restaurante, aceitação/rejeição, gestão operacional e living briefing.

O MVP real implementado até ao Block 48 cobre principalmente a camada operacional e parte do fluxo público: página pública e pedido de reserva; dados gastronómicos/alimentares no pedido e por guest; gestão Business de reservas; decisão manual; capacidade e disponibilidade informativa; comunicações internas; confirmação pública por token; review humana de atualizações de guests; pre-service briefing e handoff.

Conta guest completa, marketplace discovery premium, menus antecipados, pagamento/card guarantee e automações externas permanecem fora do MVP implementado.

## 9. Funcionalidades implementadas

| Funcionalidade | Status | Evidência | Notas |
|---|---|---|---|
| Business memberships e roles | Implemented | Migrations/RLS e uso nas RPCs Blocks 40–48 | Roles owner/manager/staff controlam permissões. |
| Reservas canónicas | Implemented | Fluxo público e rotas internas de reservations | Novas reservas permanecem pendentes até decisão humana. |
| Public reservation flow | Implemented | RPCs públicas V1/V2 e rota pública | Slots são pedidos, não disponibilidade garantida. |
| Guest identities e perfis consolidados | Implemented | Blocks 28–32 | Inclui histórico e gestão de qualidade. |
| Dietary profiles | Implemented | Migration gastronómica e integrações Blocks 28–48 | Usado como contexto; não atualizado automaticamente por guest submissions. |
| Internal notes e timeline | Implemented | Blocos de reservas, comunicação, guest updates e briefings | Timeline recebe eventos operacionais. |
| Merge, recovery, provenance | Implemented | Blocks 30–35 | Recovery governado e auditável. |
| Business-wide reconciliation queue | Implemented | Blocks 36–40 | Inclui ownership, SLA e policies configuráveis. |
| SLA governance | Implemented | Block 40 | Informativo; sem auto assignment/escalation/closure. |
| Service periods e capacidade | Implemented | Block 41 | Configuração operacional; não bloqueia reservas. |
| Calendário operacional e projeção | Implemented | Block 42 | Read-only/informativo, com períodos overnight. |
| Manual overrides | Implemented | Block 43 | Contexto temporário auditado; sem consumo automático por reservas. |
| Manual reservation decisions | Implemented | Block 44 | Accept/reject/return to pending via RPCs humanas. |
| Guest communication drafts | Implemented | Block 45 | Draft/ready/marked_sent/cancelled; `marked_sent` é afirmação humana. |
| Public confirmation tokens | Implemented | Block 46 | Token opaco, hash digest, expiry, revogação. |
| Guest preferences and notes submissions | Implemented | Block 46 | Append-only, pending review, sem mutação automática. |
| Guest update review | Implemented | Block 47 | Accept/dismiss/convert to note/draft, sempre humano. |
| Pre-service briefings | Implemented | Block 48 | Assembly read-only, lifecycle manual e auditável. |
| Staff handoffs and acknowledgements | Implemented | Block 48 | Handoffs e acknowledgements autenticados e append-only. |

## 10. Funcionalidades parcialmente implementadas

| Funcionalidade | Status | Evidência | Notas |
|---|---|---|---|
| Guest Marketplace account experience | Partially implemented | Public restaurant/reservation/confirmation routes | Conta guest completa não está implementada. |
| Gastronomic profile | Partially implemented | Dietary profiles e guest data no pedido | Existe contexto alimentar, mas não um perfil autónomo completo de marketplace. |
| Favourite grape varieties / wine preferences | Partially implemented | Campos de wine preferences em fluxo público/dietary profile | Preferências podem ser recolhidas como texto; variedades favoritas estruturadas não estão completas. |
| Allergy and intolerance cards | Partially implemented | Dietary profiles e guest-facing notes | Existem dados e contexto; cartões de produto dedicados não estão evidenciados como experiência completa. |
| Immersive restaurant page | Partially implemented | Páginas públicas e visual identity inicial | Conteúdo premium completo ainda é roadmap. |
| Restaurant colours and identity | Partially implemented | Migration de visual identity | Base existe; onboarding/editor completo não está finalizado. |
| Chef story, team, wine cellar | Partially implemented | Direção histórica e estruturas parciais de página | Não há evidência de experiência completa governada. |
| Restaurant onboarding | Partially implemented | Restaurants, visual identity, service periods, capacidade | Produto dedicado de onboarding não está completo. |
| Operational reporting | Partially implemented | Reconciliation reporting e capacity summaries | Reporting operacional existe; analytics avançado geral ainda é futuro. |

## 11. Funcionalidades aprovadas ainda não implementadas

| Funcionalidade | Status | Evidência | Notas |
|---|---|---|---|
| WhatsApp integration | Approved — not implemented | Block 45 lista `whatsapp` como canal, mas sem provider | Não há envio externo automático. |
| Up to three configurable recipients | Approved — not implemented | Baseline histórico; Block 48 tem handoff targets | Não existe configuração de até três destinatários de briefing. |
| Configurable briefing schedule | Approved — not implemented | Baseline histórico; Block 48 cria briefings manualmente | Não há agendamento automático ativo. |
| Automatic reservation/modification/cancellation updates | Approved — not implemented | Baseline histórico; DevLogs 45–48 negam automação | Pode ser roadmap, mas não comportamento atual. |
| Advance menu selection | Approved — not implemented | Baseline histórico | Sem implementação evidenciada. |
| Wine pairing selection | Approved — not implemented | Visual identity contém conteúdo de wine pairing | Seleção pelo guest antes da visita não está implementada. |
| Card guarantee | Approved — not implemented | Baseline histórico e limitações Blocks 41–46 | Sem pagamento ou garantia. |
| Waitlist | Approved — not implemented | Baseline histórico; DevLogs indicam ausência | Nenhum Smart Waitlist ou waitlist operacional ativo. |

## 12. Funcionalidades futuras

| Funcionalidade | Status | Evidência | Notas |
|---|---|---|---|
| Guest invitations to create gastronomic profile | Future | Lista histórica de futuro | Não implementado. |
| Smart Waitlist | Future | Lista histórica e limitações atuais | Depende de capacidade/seating/decisões futuras. |
| Separate departmental briefings | Future | Block 48 handoffs suportam equipas, mas não briefings departamentais separados | Possível evolução do briefing. |
| Intelligent floor plan | Future | Não há floor plan/seating | Fora do estado atual. |
| Mobile applications | Future | Sem evidência no repo | Fora do estado atual. |
| Advanced analytics | Future | Reporting atual é operacional limitado | Analytics amplo ainda futuro. |
| Find Dining Admin completo | Future | Não há produto Admin completo | Necessita definição. |

## 13. Arquitetura operacional atual

A arquitetura operacional atual é orientada por Business, Restaurant, membership e scope explícito. As superfícies internas usam Server Actions e RPCs Supabase para repetir autenticação e autorização na base de dados. As rotas públicas são estreitas e expõem apenas contratos seguros.

Fluxo operacional típico:

1. Guest envia pedido de reserva público.
2. Reserva canónica nasce pendente.
3. Equipa consulta histórico, perfil, capacidade e contexto.
4. Equipa aceita ou rejeita manualmente.
5. Equipa prepara comunicação como draft, marca ready ou marked_sent manualmente.
6. Equipa pode gerar token público de confirmação.
7. Guest pode submeter preferências/notas limitadas.
8. Equipa revê updates humanos antes de qualquer ação operacional.
9. Equipa cria briefing pré-serviço e handoffs humanos.

## 14. Princípios de controlo humano

- Decisões de reserva são humanas.
- Comunicações são preparadas por humanos e apenas marcadas como enviadas por humanos.
- Submissões de guests exigem review humana.
- Briefings, handoffs, acknowledgements e fecho são humanos.
- Nenhuma submissão pública altera automaticamente CRM, reserva, guest identity, reservation guest ou dietary profile.
- Nenhum provider externo envia mensagens automaticamente no estado atual.
- Disponibilidade e capacidade são contexto informativo, não promessa de mesa.

## 15. Segurança, RLS e auditoria

O produto usa RLS, memberships, grants restritivos e RPCs security-definer. Tabelas críticas expõem leitura scoped e bloqueiam mutation direta. Journals append-only preservam eventos de decisões, comunicações, guest updates, capacidade, reconciliação e briefings. Algumas proteções podem ocorrer por grants/RLS antes de triggers append-only, o que é considerado proteção válida quando impede update/delete direto.

## 16. Estado por grandes pilares

| Pilar | Estado | Resumo |
|---|---|---|
| Guest Marketplace | Parcial | Pedido público e confirmação por token existem; conta/discovery completo não. |
| Business Operations | Avançado | Reservas, guests, reconciliação, capacidade, comunicação, guest updates e briefings implementados. |
| Restaurant Onboarding | Parcial | Dados e configuração existem; fluxo de onboarding completo não. |
| Find Dining Admin | Inicial/Futuro | Não há produto Admin dedicado completo. |
| Automação externa | Não implementado | Sem provider send, auto updates, auto decision ou auto mutation. |

## 17. Limitações atuais

- Sem conta guest completa.
- Sem marketplace/discovery premium completo.
- Sem payment/card guarantee.
- Sem waitlist ou Smart Waitlist.
- Sem seating, floor plan ou mesas individuais.
- Sem envio externo automático por WhatsApp, SMS ou email.
- Sem seleção antecipada estruturada de menus e wine pairing.
- Sem scheduling automático de briefings.
- Sem múltiplos destinatários configuráveis como produto fechado.
- Sem timezone configurável por restaurante documentado nos blocks de disponibilidade.
- Sem automação de decisões, CRM ou guest profiles.

## 18. Decisões tomadas

- Business scope e Restaurant scope são obrigatórios para operação multi-restaurante.
- Capacidade e disponibilidade são informativas até decisão explícita futura.
- Estados de reserva avançam por decisão humana auditada.
- Comunicação operacional não equivale a envio por provider.
- Guest submissions são append-only e aguardam review.
- Briefings são snapshots/contexto operacional humano, não motor de automação.
- Histórico e auditoria valem mais do que edição destrutiva.

## 19. Regras do projeto

1. Conversa não é fonte de verdade.
2. O Documento Mestre é a fonte de verdade de produto.
3. O repositório, migrations aplicadas, validações e DevLogs são fontes operacionais de verdade.
4. Cada bloco deve documentar o que foi concluído, o que ficou limitado e o próximo passo lógico.
5. Funcionalidade aprovada não deve ser reinventada; deve ser reconciliada com este documento.
6. Antes de mudar decisões de produto, consultar este Documento Mestre e os DevLogs relevantes.
7. Não representar roadmap como comportamento implementado.

## 20. Próximo passo de produto

O próximo bloco de implementação deve ser definido apenas depois de uma análise de gaps contra esta Versão 2.0. O DevLog do Block 48 sugere como candidato uma consolidação de reporting/operational follow-up sobre briefings fechados e handoffs pendentes, mas isso não é uma instrução aprovada para iniciar Block 49.

## 21. Fontes de verdade do projeto

Ordem de autoridade atual:

1. Implementação no repositório.
2. Migrations aplicadas e alinhamento remoto Supabase.
3. DevLogs versionados por bloco em `docs/`.
4. Scripts de validação e resultados finais documentados.
5. Este Documento Mestre v2.0 para decisões de produto.
6. Documento Mestre v1.2 como baseline histórico reclassificado, não como estado técnico atual.
