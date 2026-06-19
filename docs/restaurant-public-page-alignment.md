# Restaurant Public Page Alignment

## Auditoria

A auditoria cobriu a homepage publica, o catalogo `/${locale}/restaurants`, a
pagina `/${locale}/restaurants/feitoria` e a protecao de
`/${locale}/business/restaurants`.

Foram identificados os seguintes desalinhamentos:

- linguagem diferente entre os CTAs da homepage e do catalogo;
- links `For Restaurants` ainda associados a ancoras ou login;
- Fifty Seconds combinava um CTA de detalhe com um estado futuro;
- Feitoria nao tinha navegacao publica comum nem footer;
- os botoes de reserva e menu de Feitoria aparentavam estar ativos, apesar de
  ainda nao existir esse fluxo.

## Ajustes realizados

- normalizacao dos CTAs publicos para `View Restaurant`,
  `Reserve Experience`, `Explore Restaurants` e `For Restaurants`;
- `For Restaurants` aponta para `/${locale}/business/dashboard`, mantendo a
  autenticacao Business existente;
- header e footer publicos alinhados no catalogo e em Feitoria;
- botoes `Reserve Experience` de Feitoria mantidos como estados desativados,
  acompanhados por uma mensagem `coming soon`;
- o antigo CTA `View Menus` foi substituido por `Explore Restaurants`;
- Fifty Seconds apresenta apenas `Coming soon`, sem link ou rota ficticia.

## Links publicos finais

- homepage: `/${locale}`;
- catalogo: `/${locale}/restaurants`;
- Feitoria: `/${locale}/restaurants/feitoria`;
- entrada Business: `/${locale}/business/dashboard`.

## Comportamento dos restaurantes

### Feitoria

Feitoria continua a usar a pagina publica existente, os dados atuais e os
assets locais. A query, o schema e o conteudo editorial nao foram alterados.
As reservas ainda nao executam qualquer acao.

### Fifty Seconds

Fifty Seconds continua como conteudo editorial estatico no catalogo. O card
nao possui link e comunica explicitamente que a pagina publica esta em
preparacao.

## Proximos passos

1. Criar um contrato publico para perfis publicados de restaurantes.
2. Publicar uma pagina editorial controlada para Fifty Seconds.
3. Definir o Reservation Core antes de ativar `Reserve Experience`.
4. Extrair a navegacao publica partilhada apenas quando houver mais superficies
   que justifiquem essa abstracao.
