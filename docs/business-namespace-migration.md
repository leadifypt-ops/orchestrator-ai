# Business namespace migration

## Objetivo

O namespace `/business/*` identifica a superficie Business Operations sem
alterar a implementacao operacional existente. Nesta fase, as novas paginas
sao wrappers: cada uma reexporta a pagina legada correspondente.

As rotas usam o segmento de locale da aplicacao. Assim, `/business/dashboard`
representa `/${locale}/business/dashboard`, por exemplo
`/pt/business/dashboard`.

## Mapa de rotas

| Rota atual | Rota Business | Implementacao |
| --- | --- | --- |
| `/${locale}/dashboard` | `/${locale}/business/dashboard` | Wrapper da pagina atual |
| `/${locale}/restaurants` | `/${locale}/business/restaurants` | Wrapper da pagina atual |
| `/${locale}/reservations` | `/${locale}/business/reservations` | Wrapper da pagina atual |
| `/${locale}/guests` | `/${locale}/business/guests` | Wrapper da pagina atual |
| `/${locale}/experiences` | `/${locale}/business/experiences` | Wrapper da pagina atual |
| `/${locale}/channels` | `/${locale}/business/channels` | Wrapper da pagina atual |
| `/${locale}/settings` | `/${locale}/business/settings` | Wrapper da pagina atual |

As rotas atuais permanecem publicadas para compatibilidade. Os wrappers estao
no mesmo route group autenticado `(app)`, por isso continuam a usar o layout,
a autenticacao e a Sidebar existentes.

## Estrategia de migracao futura

1. Usar as rotas `/business/*` como destinos principais da navegacao Business.
2. Migrar gradualmente rotas filhas e links internos para `/business/*`, sem
   mover queries ou logica de negocio durante a transicao.
3. Depois de consumidores externos, bookmarks e links internos terem sido
   migrados, transformar as rotas antigas em redirects de compatibilidade.
4. Remover os aliases antigos apenas numa alteracao futura explicitamente
   dedicada a breaking changes.

## Dependencias do namespace antigo

Este bloco altera apenas os destinos principais da Sidebar. Continuam a usar o
namespace antigo:

- login e pagina de sucesso, que encaminham para `/${locale}/dashboard`;
- links e acoes do Dashboard para reservations, guests e restaurants;
- criacao e detalhe de reservations (`/reservations/new` e
  `/reservations/[id]`);
- criacao, gestao e links de restaurants (`/restaurants/new` e
  `/restaurants/[slug]/manage`);
- links de Guests e Experiences para reservations e restaurants;
- aliases legados de projects e leads, que redirecionam para rotas operacionais
  antigas;
- billing, que continua em `/${locale}/billing` e nao integra o escopo deste
  bloco.

A pagina publica `/${locale}/restaurants/[slug]`, a landing publica e as demais
superficies publicas nao fazem parte desta migracao e permanecem inalteradas.
