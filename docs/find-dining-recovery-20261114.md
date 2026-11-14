# Find Dining — recuperação de trabalho local (2026-11-14)

## Âmbito e estado inicial

Repositório: `leadifypt-ops/orchestrator-ai`, origin HTTPS confirmado.
Branch de recuperação: `recovery/find-dining-block49-20261114`.
URL de destino: https://github.com/leadifypt-ops/orchestrator-ai/tree/recovery/find-dining-block49-20261114

Antes de qualquer alteração foram inspecionados status, branches, histórico e remotos.
`main` e `origin/main` apontavam para `8f62bf3a1ee40123f9078cc8bcad077493610ce3`;
a consulta ao GitHub e o fetch confirmaram este mesmo estado. Não havia commits
locais exclusivos, outras branches locais, stashes ou outros worktrees. Havia
seis ficheiros modificados e três untracked, todos do Block 49.

Foram consultados AGENTS.md, o Documento Mestre, o DevLog consolidado 39–48,
o DevLog 48 e o DevLog 49, além do inventário dos restantes documentos.
Nenhum código de aplicação ou SQL foi reescrito durante a recuperação.

## Commit recuperado e diferenças exatas contra origin/main

`827c7c32f1953e951ff90641f879881ca0380a7f` —
`chore(find-dining): recover unpublished Block 49 work`.

Este commit preserva os nove ficheiros encontrados, com 1264 linhas adicionadas
e 99 removidas segundo Git:

| Estado | Ficheiro | Adições / remoções |
|---|---|---|
| M | `app/[locale]/(app)/business/restaurants/page.tsx` | 63 / 2 |
| M | `app/[locale]/restaurants/[slug]/page.tsx` | 10 / 3 |
| M | `app/[locale]/restaurants/[slug]/reserve/page.tsx` | 45 / 16 |
| M | `app/[locale]/restaurants/[slug]/reserve/reservation-request-form.tsx` | 119 / 60 |
| M | `app/api/public/reservations/route.ts` | 49 / 8 |
| A | `docs/block-49-public-reservation-enablement-integration.md` | 103 / 0 |
| M | `docs/find-dine-master-v2.md` | 15 / 10 |
| A | `supabase/migrations/20260707000100_public_reservation_enablement_v3.sql` | 516 / 0 |
| A | `supabase/migrations/20260707000200_public_reservation_slots_capacity_fix.sql` | 344 / 0 |

O segundo commit, `docs(find-dining): record Block 49 recovery audit`, acrescenta
apenas este relatório. A sua identidade exata pode ser obtida com
`git log --format=fuller origin/main..recovery/find-dining-block49-20261114`.

No momento da auditoria, origin/main tinha 33 ficheiros de migration; a recuperação
tem 35. As únicas migrations ausentes em origin/main são as duas acima.
Os DevLogs individuais até ao Block 48 e o consolidado 39–48 já estavam no remoto.
O DevLog 49 e as atualizações do Mestre relativas ao Block 49 estavam apenas locais.
Depois da publicação, estes conteúdos ficam disponíveis na branch de recuperação;
continuam ausentes de main, deliberadamente.

## Outra linha de trabalho já publicada

O fetch encontrou `origin/chore/find-dining-agent-handoff-v1`, em
`f6a7bd6d3315172e891d3e373a57a78d5e1ab17f`, com sete commits além de main:

- `973afba` — docs(find-dining): add permanent coding-agent rules
- `f26a371` — docs(find-dining): add agent handoff and rollout plan
- `745b63b` — ci(find-dining): add read-only PR typecheck
- `ac1e337` — ci(find-dining): add opt-in read-only Codex PR review
- `0c73ed8` — ci(find-dining): prepare gated Codex issue-to-draft-PR pipeline
- `e34753d` — ci(find-dining): dispatch typecheck for bot-generated draft PR
- `f6a7bd6` — docs(find-dining): record CI failure and gated Codex activation checklist

Essa branch contém alterações a AGENTS.md, três workflows em `.github/workflows/`
e `docs/find-dining-agent-handoff-v1.md`. Já está preservada no GitHub e não contém
o Block 49. Não foi integrada, modificada ou sobrescrita. A recuperação parte de
main e não inclui essas alterações independentes.

## Revisão antes do commit e preservação local

Revisão de alterações e pesquisa de padrões de chaves privadas, tokens GitHub,
Supabase e API, JWTs, connection strings, atribuições de passwords/segredos,
emails e telefones: não foram encontradas credenciais ou dados de clientes nos
nove ficheiros selecionados. Os dois contactos detetados são placeholders de UI
(`you@example.com` e um telefone de exemplo). Referências a variáveis de ambiente
são código e não valores de credenciais. Esta é uma revisão dirigida, não uma
certificação de todo o histórico preexistente.

Foram adicionados ao índice apenas caminhos explícitos. `.env.local`, `.next/`,
`node_modules/`, `next-env.d.ts`, `tsconfig.tsbuildinfo`, `supabase/.temp/` e `tmp/`
ficaram ignorados, presentes no disco e fora dos commits. `tmp/` contém imagens
de leitura de PDFs históricos. Nenhum ficheiro foi apagado. Git normaliza os
finais de linha segundo a configuração existente; não houve reformatação manual.

## Validações desta recuperação

- `git diff --check` e `git diff --cached --check`: passaram.
- `node node_modules/typescript/bin/tsc --noEmit --incremental false`: passou.
- ESLint dos cinco ficheiros de aplicação: zero erros, nove avisos de `<img>`.
- Não foi repetido build nem foram criadas reservas para testes.

O projeto Supabase ligado foi identificado pela CLI como Orchestra-AI / production.
Foram tentados exclusivamente os comandos solicitados:

- `npx --yes supabase@3.1.0 migration list --linked`
- `npx --yes supabase@3.1.0 db push --remote --dry-run`

Ambos falharam antes de devolver resultados de migrations, com
`DbConfigLoginRoleStatusError`, HTTP 544 e timeout ao inicializar a ligação.
A CLI indicou que `--linked` está deprecated; o dry-run usou `--remote`.
Não foram aplicadas migrations nem executadas consultas de escrita de dados.
O alinhamento remoto 35/35 e a aplicação das duas migrations são afirmações do
DevLog histórico, não confirmações obtidas nesta sessão.

## Estado do Block 49 e inconsistências documentais

O Block 49 existe como implementação local recuperada: enablement e timezone por
restaurante, readiness, disponibilidade pública, submissão V3 e integração UI/API.
O DevLog histórico regista implementação concluída e validações anteriores,
incluindo a limitação dos testes de concorrência e a falta de configuração de
serviço/calendário/capacidade de Feitoria naquele momento.

O Mestre recuperado afirma que Blocks 28–49 já estavam publicados em origin/main.
Essa afirmação era incorreta para o estado Git observado. Foi preservada na cópia
original para não reescrever trabalho existente; este relatório corrige o estado
de publicação. O Mestre também conserva referências antigas à ausência de timezone
e à escolha do Block 49, apesar de descrever a implementação desse bloco. Requer
reconciliação editorial posterior. Os DevLogs 39–48 descrevem momentos históricos.

## Próximo passo recomendado

Rever a recuperação por comparação com main e voltar a executar migration list
e dry-run quando a ligação Supabase estiver disponível. Confirmar o estado real
da base de dados antes de qualquer decisão de integração. Reconciliar depois a
documentação e a branch independente de handoff através de revisão explícita.
Não iniciar Block 50, merge, deploy ou aplicação de migrations nesta recuperação.

Main permanece em `8f62bf3a1ee40123f9078cc8bcad077493610ce3`. Não foram usados reset,
clean, rebase, force push ou operações de eliminação de trabalho.
