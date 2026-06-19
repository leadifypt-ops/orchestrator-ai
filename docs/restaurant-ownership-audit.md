# Restaurant Ownership Audit

## Objetivo e âmbito

Esta auditoria documenta o estado atual da relação:

`Restaurant -> Business User -> Reservations -> Guests -> Briefings`

Foram revistos os documentos de arquitetura indicados, as rotas Marketplace e
Business, as queries Supabase, as migrations versionadas e, em modo apenas de
leitura, o registo live de `restaurants` com `slug = feitoria`.

Nenhum código, migration ou schema foi alterado.

## Conclusão executiva

O sistema ainda não possui um modelo de ownership de restaurantes.

- `restaurants` não tem `user_id`, `owner_id`, `business_id` ou uma tabela de
  associação equivalente visível no código, nas migrations ou no registo live
  do Feitoria.
- As páginas Business exigem autenticação pelo layout, mas listam e resolvem
  restaurantes sem filtro explícito por utilizador ou Business.
- As reservas operacionais são registos da tabela legada `leads`. A sua
  pertença é direta ao utilizador autenticado por `leads.user_id`, não ao
  restaurante.
- Guests, perfis gastronómicos, notas e eventos usam o ID textual da lead como
  `reservation_id`, sem foreign key para uma reserva canónica.
- Service Briefing e Kitchen Briefing são projeções calculadas pela aplicação;
  não existem como entidades persistidas próprias.
- As políticas temporárias de guests, perfis, notas e timeline aceitam qualquer
  utilizador autenticado. Não existe isolamento por owner, Business ou
  restaurante.

Consequentemente, o formulário público não pode ser ligado com segurança ao
backoffice atual apenas através do slug ou de `leads.user_id`.

## 1. Como um restaurante está associado a um utilizador?

Atualmente, não está.

A criação em `app/[locale]/(app)/restaurants/new/page.tsx` insere atributos do
perfil em `restaurants`, mas não grava o utilizador autenticado. A listagem em
`app/[locale]/(app)/business/restaurants/page.tsx` faz `select(*)` sem filtro de
ownership. A página de gestão resolve o restaurante apenas por `slug`.

A migration `20260611124608_restaurant_visual_identity.sql` apenas acrescenta
campos editoriais e liga `restaurant_featured_dishes.restaurant_id` a
`restaurants.id`; não introduz ownership.

O layout autenticado prova apenas que existe uma sessão. Não prova que o
utilizador pertence ao restaurante pedido.

## 2. Como o sistema sabe quais restaurantes um utilizador pode gerir?

O código auditado não sabe.

O comportamento atual é:

1. `app/[locale]/(app)/layout.tsx` exige um utilizador autenticado.
2. A área Business consulta todos os restaurantes que a sessão conseguir ler.
3. A página de gestão procura qualquer restaurante pelo slug recebido.
4. Não existe verificação aplicacional de membership ou ownership.

As migrations versionadas não contêm políticas RLS para `restaurants`, pelo
que não é possível demonstrar no repositório uma restrição oculta ao nível da
base de dados. Mesmo que exista uma política criada fora das migrations, ela
não é uma fonte de verdade auditável nem resolve a ausência de uma relação de
ownership no modelo atual.

## 3. O Feitoria está associado a um owner específico?

Não.

O registo live do Feitoria contém apenas campos de identidade, conteúdo,
localização, imagem, chef e wine pairing. Não contém qualquer coluna de
utilizador, owner, Business, tenant, account ou organização.

O slug `feitoria` ativa conteúdo e assets especiais na página pública e ativa a
rota de reserva simulada. Essa condição editorial não constitui uma associação
de autorização.

Também não é possível inferir ownership a partir de `leads.user_id`: uma lead
pertence ao utilizador que a recebeu ou criou, mas não referencia o Feitoria nem
qualquer outro `restaurant_id`.

## Relações atuais

```text
restaurants
  |-- restaurant_featured_dishes.restaurant_id (FK)
  |-- sem relação com auth.users ou Business
  `-- sem relação com leads

auth.users.id
  `-- leads.user_id (reserva operacional legada)
        |-- reservation_guests.reservation_id (texto, sem FK)
        |     `-- guest_dietary_profiles.reservation_guest_id (FK)
        |-- reservation_internal_notes.reservation_id (texto, sem FK)
        `-- reservation_timeline_events.reservation_id (texto, sem FK)
```

O endpoint legado `api/public/leads` resolve uma `automation` e copia
`automation.user_id` para a lead. Ele não resolve um restaurante publicado nem
valida que a automation pertence ao restaurante apresentado no Marketplace.

## Reservations, Guests e Briefings

### Reservations

Dashboard, lista e detalhe tratam `leads` como pedidos de reserva. As queries
Business filtram as leads por `user_id = auth.user.id`, e a criação manual grava
esse mesmo ID. Esta é uma relação utilizador-reserva, não
Business-restaurante-reserva.

### Guests

`reservation_guests.reservation_id` guarda o ID da lead como texto. A migration
declara explicitamente que a ligação é temporária e evita uma FK enquanto não
existir `reservation_requests`.

`guest_dietary_profiles` tem uma FK correta para `reservation_guests`, mas herda
o problema de tenancy do guest e da reserva.

### Briefings

Não foram encontradas tabelas canónicas de Service Briefing ou Kitchen
Briefing. O dashboard e o detalhe agregam, em memória, alergias, intolerâncias,
restrições, dislikes, vinho, notas, ocasião e campos da lead.

`reservation_internal_notes` e `reservation_timeline_events` são dados
operacionais auxiliares. Ambos usam `reservation_id` textual, sem FK. O campo
`created_by` regista o autor, mas não concede nem prova ownership.

## Riscos encontrados

### Crítico: ausência de isolamento Business em dados sensíveis

As políticas RLS versionadas para `reservation_guests`,
`guest_dietary_profiles`, `reservation_internal_notes` e
`reservation_timeline_events` usam `using (true)` ou `with check (true)` para o
papel `authenticated`. Assim, a fronteira é “qualquer utilizador autenticado”,
não “membro autorizado do restaurante”.

O filtro de ownership aplicado primeiro à lead na página de detalhe reduz a
exposição nessa UI específica, mas não protege acessos diretos às tabelas. A
página Business de Guests também consulta guests sem os limitar às reservas do
utilizador atual.

### Alto: gestão de restaurantes sem autorização demonstrável

Autenticação e autorização estão confundidas. Uma sessão válida abre a
superfície Business, mas não existe relação que permita decidir que restaurante
pode ser listado, criado ou gerido por essa sessão.

### Alto: reserva sem restaurante

`leads.user_id` escolhe um operador, mas não preserva qual perfil público,
local, experiência ou restaurante recebeu o pedido. Isto impede routing,
auditoria e RLS corretos quando um utilizador gere vários restaurantes ou quando
vários utilizadores gerem o mesmo restaurante.

### Alto: endpoint público legado inadequado

`api/public/leads` usa service role, um segredo estático e uma automation como
roteador. Reutilizá-lo para o Marketplace permitiria que a identidade Business
fosse escolhida por um identificador técnico do cliente, sem contrato canónico
restaurante-reserva.

### Médio: integridade referencial temporária

Guests, notas e timeline aceitam qualquer `reservation_id` textual. Registos
órfãos, colisões e associações indevidas só podem ser prevenidos na aplicação.

## 4. Caminho seguro: Marketplace -> Reservation Request -> Business Reservations

O caminho seguro deve introduzir uma cadeia canónica e verificável. Esta é uma
recomendação arquitetural; não foi implementada nesta auditoria.

### A. Estabelecer a fronteira Business

Criar uma entidade Business estável e memberships com papéis explícitos, por
exemplo `owner`, `manager` e `staff`. Associar cada restaurante a um Business,
não diretamente a um único utilizador.

```text
auth.users -> business_memberships -> businesses -> restaurants
```

Isto suporta vários utilizadores por restaurante e vários restaurantes por
Business sem duplicar ownership em dados operacionais.

### B. Definir publicação separada de ownership

O endpoint público deve resolver apenas restaurantes publicados por um
identificador público imutável ou slug único. A resolução pública devolve o
`restaurant_id`; nunca deve aceitar `owner_user_id`, `business_id` ou
`automation_id` fornecidos pelo browser como autoridade.

### C. Criar uma reserva canónica

Um pedido público validado no servidor deve criar uma `reservation_request`
com, no mínimo:

- `id` gerado no servidor;
- `restaurant_id` obrigatório e com FK;
- estado inicial `pending_review`;
- contacto, slot pretendido e party size validados;
- origem Marketplace;
- chave de idempotência;
- timestamps e metadados mínimos de auditoria.

O `business_id` pode ser derivado através do restaurante. Se for materializado
na reserva para tenancy ou histórico, deve ser preenchido e validado no
servidor, nunca aceite cegamente do cliente.

### D. Persistir guest context de forma dependente da reserva

Guests devem referenciar a reserva canónica por FK. Perfis gastronómicos devem
continuar dependentes do guest, com consentimento, retenção e acesso definidos.
Dados de alergias exigem validação no servidor e confirmação humana; não devem
ser tratados como garantia automática de segurança alimentar.

### E. Derivar os briefings dentro da mesma tenancy

Service e Kitchen Briefing podem começar como projeções da reserva e do perfil,
desde que todas as queries partam de uma reserva já autorizada. Se forem
persistidos, devem ter FK para a reserva canónica e preservar autoria e
histórico.

### F. Aplicar RLS por membership

As políticas devem permitir acesso Business apenas quando o utilizador
autenticado possui membership ativo no Business proprietário do restaurante da
reserva. Guests, perfis, notas, timeline e briefings devem herdar essa decisão
por joins/FKs, sem políticas globais para `authenticated`.

### G. Expor um endpoint público dedicado

O fluxo recomendado é:

```text
Marketplace /restaurants/[slug]/reserve
  -> endpoint público dedicado
  -> validação + rate limit + anti-spam + idempotência
  -> resolve published restaurant no servidor
  -> cria reservation_request pending_review
  -> cria guest/profile consentidos na mesma transação
  -> Business Reservations lê por membership/RLS
  -> equipa revê, confirma e prepara briefings
```

O endpoint deve usar uma função transacional ou RPC com contrato restrito. Uma
service role, se necessária internamente, deve permanecer apenas no servidor e
não substituir validação, autorização de destino ou limites antiabuso.

## Critérios mínimos antes de ativar o envio público

1. Feitoria associado a um Business verificável.
2. Utilizadores Business associados por memberships e papéis.
3. Restaurante publicado resolvido no servidor, sem owner fornecido pelo
   cliente.
4. Reserva canónica com FK para `restaurants`.
5. Guests, perfis, notas, timeline e eventuais briefings com FKs para a cadeia
   canónica.
6. RLS testada com pelo menos dois Businesses, incluindo testes negativos de
   isolamento.
7. Endpoint público com validação, idempotência, rate limiting, anti-spam,
   consentimento e observabilidade.
8. Plano explícito de migração ou compatibilidade para as reservas legadas em
   `leads`.

## Respostas diretas

1. **Como um restaurante está associado a um utilizador?** Não está associado
   no modelo atual.
2. **Como o sistema sabe quais restaurantes um utilizador pode gerir?** Não
   sabe de forma demonstrável; apenas exige autenticação e depende do que a
   query sem filtro conseguir ler.
3. **O Feitoria está associado a um owner específico?** Não. O registo live não
   contém qualquer vínculo de ownership.
4. **Qual é o caminho seguro?** Introduzir Business + memberships, associar o
   restaurante ao Business, criar uma reserva canónica ligada ao restaurante
   num endpoint público dedicado e aplicar RLS por membership em toda a cadeia
   de guests e briefings.
