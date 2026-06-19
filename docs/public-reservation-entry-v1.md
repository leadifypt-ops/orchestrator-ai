# Public Reservation Entry V1

## Rota criada

A primeira entrada publica de reserva esta disponivel em:

`/${locale}/restaurants/feitoria/reserve`

A estrutura usa o segmento dinamico
`/${locale}/restaurants/[slug]/reserve`, mas nesta V1 apenas o slug `feitoria`
esta habilitado. Outros slugs devolvem not found para evitar fluxos publicos
nao controlados.

## Campos do formulario

- nome;
- email;
- telefone;
- data pretendida;
- hora pretendida;
- numero de pessoas;
- ocasiao especial;
- mensagem ou pedido especial;
- alergias gerais, opcional;
- preferencias alimentares gerais, opcional.

## Persistencia

Esta V1 usa simulacao local e nao grava dados.

O fluxo manual atual cria registos em `leads` associados ao `user_id` do
operador autenticado e pode criar timeline e perfil gastronomico sob politicas
autenticadas. Ainda nao existe uma associacao publica segura entre o slug do
restaurante e a conta Business proprietaria.

O endpoint legado `api/public/leads` depende de service role, segredo estatico
e automacoes. Nao foi reutilizado porque nao oferece a fronteira de seguranca
ou o contrato de reserva necessarios para o Marketplace.

Ao submeter, o formulario valida os campos obrigatorios e apresenta um estado
local que declara explicitamente que o pedido nao foi enviado, persistido ou
confirmado.

## Limitacoes da V1

- nao existe persistencia;
- nao existe verificacao de disponibilidade;
- nao existe confirmacao automatica;
- nao existe pagamento;
- nao existe notificacao ao restaurante ou ao convidado;
- os dados opcionais nao criam ainda um perfil gastronomico.

## Integracao futura com o backoffice

Uma futura entrada persistente deve resolver o restaurante publicado para uma
entidade Business autorizada e criar um pedido idempotente, validado no
servidor. Esse pedido devera alimentar:

- `Reservations`, como pedido novo pendente de revisao;
- `Gastronomic Profile`, com alergias e preferencias separadas do texto livre;
- `Service Briefing`, com ocasiao, contexto do convidado e pedidos de servico;
- `Kitchen Briefing`, com alergias e restricoes que exigem preparacao segura.

## Proximos passos

1. Definir a associacao publica restaurante -> Business owner.
2. Criar um endpoint publico dedicado com validacao, rate limiting e protecao
   anti-spam.
3. Definir o contrato de dados do pedido sem expor service role ao cliente.
4. Ligar o pedido ao backoffice com estado inicial `new` ou `pending_review`.
5. Ativar notificacoes e confirmacao manual pelo restaurante.
