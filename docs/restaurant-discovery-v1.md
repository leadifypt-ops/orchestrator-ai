# Restaurant Discovery V1

## Objetivo

Criar o primeiro catalogo publico premium da Find Dining, separado da gestao
operacional de restaurantes e sem introduzir dependencias de base de dados.

## Rota

A descoberta publica esta disponivel em `/${locale}/restaurants`, por exemplo
`/pt/restaurants`.

A gestao de restaurantes continua em
`/${locale}/business/restaurants`. A implementacao de gestao foi preservada e
deixou de ocupar a rota publica.

## Estrutura visual

- header publico com regresso a homepage e acesso ao login;
- hero editorial com introducao ao catalogo;
- pesquisa local por restaurante, cidade ou chef;
- filtros locais por estatuto Michelin e cidade;
- cards premium, responsivos e mobile-first;
- estado vazio para pesquisas sem resultados;
- footer publico.

## Dados usados

Esta versao nao executa queries Supabase. Usa um conjunto estatico e local com:

- Feitoria, com imagem existente e link para a pagina publica atual;
- Fifty Seconds, apresentado como perfil editorial ainda nao publicado.

Nao foram alterados schema, migrations, RLS ou autenticacao.

## Conteudo temporariamente estatico

Os dados dos cards, opcoes de filtro e disponibilidade dos perfis sao estaticos
nesta primeira versao. O CTA de Fifty Seconds indica `Coming soon` para evitar
uma navegacao para uma pagina ainda inexistente.

## Proximos passos

1. Definir um contrato de leitura publica para restaurantes publicados.
2. Ligar pesquisa e filtros a esse catalogo publico.
3. Adicionar imagens e paginas editoriais dos restantes restaurantes.
4. Introduzir cidades, cozinhas, experiencias e ordenacao como filtros.
5. Adicionar estados de loading e paginacao quando o catalogo crescer.
