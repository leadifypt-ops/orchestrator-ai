# Guest Gastronomic Profile V1

## Objetivo de negocio

A Find Dining deve transportar contexto antes da chegada, nao apenas um pedido
de mesa. O Perfil Gastronomico V1 permite ao convidado preparar informacao que
podera ajudar cozinha e servico a personalizar a experiencia.

O perfil continua anonimo, opcional e local. Nao foi criado login, conta de
cliente, persistencia, schema ou migration.

## Campos adicionados

### Reservation Details

- nome;
- email;
- telefone;
- data pretendida;
- hora pretendida;
- numero de pessoas.

### Dietary Profile

- allergies;
- intolerances;
- dietary restrictions;
- food dislikes.

### Wine Preferences

- wine preferences.

### Experience Context

- indicador de ocasiao especial;
- notas adicionais.

Todos os campos gastronomicos e de contexto sao opcionais. O formulario inclui
a mensagem: `Help the restaurant personalise your experience before arrival.`

## Payload local

A submissao simulada prepara um objeto local com tres grupos:

- `reservation`, para contacto, data, hora e pessoas;
- `guestProfile`, para listas de alergias, intolerancias, restricoes, dislikes
  e preferencias de vinho;
- `experienceContext`, para ocasiao especial e notas adicionais.

Valores separados por virgulas nos campos alimentares sao normalizados em
listas. O payload permanece apenas em memoria e nao e enviado ou persistido.

## Fluxo futuro

Quando existir uma fronteira publica segura, o mesmo payload devera criar um
pedido associado ao restaurante publicado e separar contexto operacional de
texto livre.

## Integracao futura com o backoffice

- `Reservation`: contacto, data, hora, pessoas e estado pendente de revisao;
- `Guest Profile`: identidade do host e historico de preferencias consentidas;
- `Service Briefing`: ocasiao, vinho, dislikes e notas de hospitalidade;
- `Kitchen Briefing`: alergias, intolerancias e restricoes alimentares com
  destaque operacional e confirmacao humana.

## Limitacoes e proximos passos

1. Definir consentimento, retencao e edicao dos dados do convidado.
2. Validar alergias no servidor e exigir confirmacao direta do restaurante.
3. Persistir o perfil apenas depois da associacao restaurante -> Business.
4. Definir como preferencias recorrentes podem ser reutilizadas sem criar uma
   conta cliente neste momento.
