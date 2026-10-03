# Roteiro manual da v0.2

Um roteiro curto para o autor jogar a v0.2 "Estações e Conselho" **em desenvolvimento**, jornada por jornada, com o que observar em cada uma e como adiantar o tempo. Cada observação vai para a coluna "Evidência manual" de [acceptance-v0.2.md](acceptance-v0.2.md), com data, navegador e ritmo; cada decisão de regra, texto ou carta que o jogo levantar vai para [pendencias-v0.2.md](pendencias-v0.2.md).

> **Estado em 2026-10-02.** Ninguém executou este roteiro. Os comandos de banco e do servidor de teste abaixo foram montados a partir do código (`tests/e2e/server.ts`, `packages/server/src/games/repository.ts`, `packages/web/src/game/gameSession.ts`) e **não foram rodados** por quem escreveu: outros trabalhos usavam o `db_test` e o banco de desenvolvimento na mesma hora. Se um passo não funcionar como está escrito, anote e corrija aqui.

## Preparação

```bash
pnpm install
pnpm dev:up && pnpm secrets:gen
pnpm dev:api          # deixe rodando: http://localhost:3000/v1/health
pnpm dev:web          # em outro terminal: http://localhost:5173
curl -s localhost:3000/v1/version   # "protocol": 2
```

Abra `http://localhost:5173` numa janela anônima (ou perfil novo) para começar sem conta. Nas boas-vindas, escolha o ritmo **Rápido**: é o recomendado e o que deixa as jornadas caberem numa tarde. Os tempos abaixo são os do Rápido (3×); no Normal multiplique por 3, no Tranquilo por 6. A expiração da carta é a exceção: 24 h reais em qualquer ritmo.

| O que | Tempo de jogo | Tempo real no Rápido |
|---|---|---|
| Um dia de jogo (uma virada: moral, ofício, sorteios) | 2 h | 40 min |
| Troca de ofício (adaptação) | 1 dia | 40 min |
| Primeira audiência do Conselho, e cada uma depois | 4 dias | 2 h 40 min |
| Continuação de uma cadeia (as do lote 1) | 2 dias | 1 h 20 min |
| Prazo para responder a uma carta | — | 24 h |
| Uivos (ano 1) | início do 10º dia | 6 h depois de fundar |
| Lobos do roteiro (ano 1) | início do 16º dia | 10 h depois de fundar |
| Primavera, verão, outono | 24 dias cada | 16 h cada |
| Inverno | 12 dias | 8 h |
| Um ano | 84 dias | 56 h |
| Relatório de Retorno | — | 4 h sem abrir a página, ou com a aba fora de vista |

## Como adiantar o tempo

Em produção o mundo anda no tempo de verdade e **nada** abaixo vale lá: nunca mexa no banco de produção. Em desenvolvimento há dois jeitos.

### A. No banco de desenvolvimento

Recua o instante de criação das partidas: o servidor calcula o tempo de jogo como `(agora − created_at) × ritmo`, então `N` horas a menos em `created_at` são `N` horas reais a mais para o feudo (no Rápido, `3 × N` horas de jogo). Com a API **parada** (Ctrl+C no terminal do `pnpm dev:api`):

```bash
pnpm db:psql -c "update games set created_at = created_at - interval '16 hours', last_processed_at = last_processed_at - interval '16 hours' where status = 'active'"
pnpm dev:api          # ao subir, o job de avanço já leva as partidas até agora
```

A aba aberta mostra o salto na leitura seguinte (até 30 s) ou ao recarregar. As linhas antigas da Crônica ficam com a hora em que aconteceram; as novas, com a hora calculada pelo `created_at` novo.

### B. Com o servidor de teste, de relógio adiantável

É a API de verdade que os testes em navegador usam (`tests/e2e/server.ts`), com rotas `/__test` para adiantar o relógio, pôr uma carta na mesa e erguer um edifício. Ela usa o `db_test` e **o esvazia ao subir**: não a rode junto com `pnpm test:integration` ou `pnpm test:e2e`, e encerre-a antes de rodá-los (o Playwright reaproveita o que encontrar na porta 3100). Ela tem um GitHub de mentira ligado, então os botões do GitHub aparecem.

```bash
pnpm dev:up
# terminal 1: a API de teste na porta 3100, com o Rápido como padrão
GAME_TIME_SCALE=3 pnpm --filter @lotg/server exec tsx ../../tests/e2e/server.ts
# terminal 2: o app falando com ela
LOTG_API_URL=http://127.0.0.1:3100 pnpm dev:web
```

```bash
API=http://127.0.0.1:3100
curl -s -X POST $API/__test/advance -H 'content-type: application/json' -d '{"ms": 3600000}'          # 1 hora real
curl -s -X POST $API/__test/council-deal -H 'content-type: application/json' -d '{"cardId": "thawBridgePlea"}'   # uma carta na mesa
curl -s -X POST $API/__test/raise -H 'content-type: application/json' -d '{"building": "palisade", "level": 1}'  # um edifício no nível
curl -s -X POST $API/__test/horde-quiet      # sem lobos (nem os do roteiro)
curl -s -X POST $API/__test/council-recess   # sem cartas por sorteio
```

As rotas valem para todos os feudos do banco. O relógio da página não anda junto: as contagens regressivas saltam na leitura seguinte.

### O Relatório de Retorno depois de um salto

O relatório depende do relógio do **navegador** (4 h desde a última leitura), e nenhum dos dois jeitos o adianta. Para vê-lo sem esperar, no console do navegador (F12), logo antes de recarregar:

```js
for (const key of Object.keys(localStorage).filter((k) => k.startsWith('lords.cache:'))) {
  const cache = JSON.parse(localStorage.getItem(key));
  cache.lastSeenAt -= 5 * 60 * 60 * 1000;
  localStorage.setItem(key, JSON.stringify(cache));
}
location.reload();
```

É um atalho de desenvolvimento: ele diz ao app que a última leitura foi cinco horas atrás. Uma ausência de verdade (uma noite) é a prova que vale.

## Jornadas

### 1. Conta nova (cerca de 20 minutos, sem saltos)

1. Boas-vindas: dois grupos, dificuldade e ritmo, cada opção com uma frase e o recomendado marcado. Escolha **Senhor** e **Rápido** e clique em **Jogar agora**.
2. Preferências: a dificuldade e o ritmo do feudo, só para leitura.
3. Objetivos 1 a 3 no painel, na árvore e na aba Hoje, cada um com o botão que leva até lá.
4. Ponha **+1 na Serraria** pelo painel. Antes do clique, a linha diz o custo da troca ("+1 aqui: … agora, … depois de …"). Depois, "em adaptação" com o prazo de 40 min; no fim dele, a taxa sobe sozinha.
5. Recrute; o painel e o cabeçalho dizem quanto falta para o próximo aldeão.
6. Aba Hoje, "Antes de partir": resolva cada item pelo botão dele, até "O feudo está preparado para a sua ausência."
7. "Nova partida…" (paleta ou Preferências): pergunta dificuldade e ritmo e pede confirmação para arquivar. Cancele.

O que observar:

- ☐ As frases de dificuldade e de ritmo dizem o que muda de verdade (pendência B-3). **Critério 6.**
- ☐ O custo da troca aparece antes do clique, e a produção volta ao normal na hora anunciada. **Critério 5.**
- ☐ Os prazos da tela batem com o relógio da parede (QA-15).
- ☐ A barra de status e o título da aba dizem o mais urgente.

### 2. Partida migrada

**Em produção**, o feudo que você jogou na v0.1 é a prova de verdade: ele foi migrado na primeira leitura ou pelo job de avanço depois de cada publicação. Abra-o (sem mexer em nada do servidor) quando `GET /v1/version` responder `protocol: 2`. Na primeira volta depois da atualização, o relatório sai sem a comparação dos estoques, com a frase "O jogo foi atualizado desde a sua última visita…" (pendência B-11).

**Em desenvolvimento**, um feudo da v0.1 se monta com um retrato congelado do motor da v0.1 (`state-v1-objectives.json`: os quatro objetivos concluídos, cerca de 6 h de jogo). Crie uma partida pelo app (Senhor, Rápido), pare a API e grave o retrato por cima dela:

```bash
pnpm db:psql -c "select id, state->'settlement'->>'name' as feudo, time_scale, schema_version from games where status = 'active' order by created_at desc limit 3"
GAME=<id da partida>
{ printf "update games set schema_version = 1, created_at = now() - interval '3 hours', state = \$v1\$"
  cat packages/engine/src/__fixtures__/state-v1-objectives.json
  printf "\$v1\$::jsonb where id = '%s';\n" "$GAME"
} | docker compose -f deploy/docker-compose.dev.yml exec -T db psql -U lotg -d lotg -v ON_ERROR_STOP=1
pnpm dev:api
```

`created_at` precisa ficar no passado o bastante para o tempo de jogo de agora passar do retrato (6 h de jogo: 3 h no Rápido, 7 h no Normal); senão o feudo fica parado até o relógio alcançá-lo. A Crônica mistura as linhas da partida que você criou com as do retrato: é efeito do atalho.

O que observar (QA-01):

- ☐ Nada se perdeu: estoques, níveis, aldeões e os quatro objetivos concluídos.
- ☐ Os objetivos 5 a 7 aparecem (Torre de Vigia, primeira carta, depósito), sem prêmio repetido.
- ☐ Nenhuma carta na hora: a aba Conselho diz quando vem a primeira (4 dias de jogo depois da fronteira).
- ☐ A moral começa em 50 e muda na primeira virada de dia.
- ☐ Celeiro, Armazém e Torre de Vigia na lista de obras.
- ☐ A Crônica não ganha linhas inventadas no instante da migração.
- ☐ Os uivos e os lobos do roteiro chegam, porque o retrato ainda não passou do 16º dia.

### 3. Uma estação (16 h reais no Rápido; dá para fazer em saltos)

1. Jogue até o Salão Nv2 (os objetivos levam até lá) e construa o **Celeiro**.
2. Deixe uma obra planejada com "Iniciar quando houver recursos" marcado.
3. Encha um depósito: o painel mostra o limite, "cheio em" com o alerta e a obra do depósito ao lado; cheio, diz o que vai ao chão.
4. Salte até uma hora antes do verão (cerca de 15 h no Rápido, contadas da fundação): o aviso "Verão à vista: chega em …" com o que muda. Salte mais uma hora: o aviso da virada e o cabeçalho com os efeitos da estação.
5. Antes do salto, feche a aba (ou use o atalho do relatório): na volta, o Relatório em três blocos, a obra que começou sozinha e o que foi ao chão.
6. Repita até o outono: a conta da lenha aparece na aba Feudo e em "Antes de partir"; no inverno, a lareira queima madeira e, sem ela, vem o frio (aviso, barra de status, moral).

O que observar:

- ☐ O estoque para no limite e "cheio em" aparece com a saída ao lado. **Critério 1.**
- ☐ A obra automática começou sozinha na ausência, e o relatório contou (QA-06).
- ☐ O aviso de estação chega uma hora antes e na virada, uma vez cada.
- ☐ A conta da lenha diz quanto falta e o que fazer, antes de o inverno chegar.
- ☐ O relatório separa o que prosperou, o que custou (com a próxima ação) e o que ainda dá para decidir (QA-11).

### 4. Uma carta e uma cadeia (cerca de 3 h reais no Rápido, ou minutos no servidor de teste)

1. A primeira audiência vem 2 h 40 min depois de fundar: o aviso "Nova carta do Conselho: …", a aba Conselho, a linha na árvore, a aba Hoje e a barra de status.
2. Responda: cada opção mostra o custo, a consequência conhecida, a pista e o que a tranca. Depois da resposta, a frase da Crônica aparece por alguns segundos. Clique duas vezes depressa: paga uma vez só.
3. Abra o jogo em duas abas e responda numa: a carta some da outra, e uma resposta dada nela depois é recusada com a frase do servidor (QA-08).
4. Deixe outra carta expirar: 24 h reais (salte 25 h). A Crônica diz o que o conselho decidiu, com a opção marcada para a dificuldade, que não custa nada. **Critério 2.**
5. Uma cadeia: "A Ponte do Degelo" pede só primavera ou verão; "O Celeiro Comum" pede o Celeiro; "A Promessa da Paliçada", o Salão Nv3. Se ela não sair no sorteio, no servidor de teste: `curl -s -X POST $API/__test/council-deal -H 'content-type: application/json' -d '{"cardId": "thawBridgePlea"}'`. Responda às três cartas, com 1 h 20 min entre elas no Rápido. **Critério 3.**

O que observar:

- ☐ A continuação lembra a escolha anterior no texto, e a aba Crônica mostra "Sua escolha voltou" sob a linha dela, levando à escolha citada.
- ☐ Cada opção parece a melhor em algum momento (roadmap §0.2: "sem opção dominante"). Anote a carta que não passou nisso.
- ☐ O prazo de 24 h é suficiente para quem joga uma ou duas vezes por dia.
- ☐ As cartas que você leu: anote título e opinião para a aprovação carta a carta ([content-v0.2.md](content-v0.2.md)).

### 5. A primeira incursão (10 h reais no Rápido)

1. Funde um feudo novo e não construa defesa. Feche a aba e salte 10 h (os uivos vêm às 6 h, os lobos às 10 h).
2. Na volta, o Relatório: em "O que exigiu um preço", o que os lobos levaram, quem se feriu e o que os teria detido. Os feridos aparecem no cabeçalho e nos ofícios e voltam sozinhos ao trabalho um dia de jogo depois. **Critério 4.**
3. Outro feudo, com a **Torre de Vigia** de pé antes das 10 h (no servidor de teste, `/__test/raise` com `watchtower`; jogando, a Torre pede o Salão Nv2 e costuma chegar depois dos lobos do roteiro, e então o alarme aparece na incursão seguinte, a que a Ameaça sorteia): o alarme vem antes, na barra de status, na árvore e no painel "Ameaça", que passa a mostrar o número, de onde ele vem e para onde vai.
4. Outro, com a **Paliçada** no nível 1 (no servidor de teste: `/__test/raise` com `palisade`): os lobos recuam, e o relatório conta em "O feudo prosperou".

O que observar (QA-10):

- ☐ Sem a Torre, o jogo não mostra a Ameaça nem a incursão antes de ela chegar.
- ☐ A frase da incursão diz o que teria evitado a perda, e há uma ação possível.
- ☐ Nada obriga a voltar: o feudo se refaz sozinho depois do ataque.

### 6. Um ano e a virada seguinte (56 h reais no Rápido)

Em saltos de uma estação (16, 16, 16 e 8 h no Rápido), jogando uma sessão curta em cada uma, como quem volta duas vezes por dia.

O que observar (QA-12):

- ☐ O inverno: a lareira, a conta da lenha, e o frio só se faltar madeira.
- ☐ O objetivo 10 (atravessar um inverno sem frio) se cumpre na virada para a primavera, se não houve frio.
- ☐ O ano 2: as cartas já vistas voltam a sair, as cadeias e as promessas em aberto continuam, os lobos do roteiro não voltam.
- ☐ Com a Torre: a Ameaça sobe e cai, ou só sobe? (O balanceamento dela estava em revisão em 2026-10-02; anote o que viu.)
- ☐ Depois de um salto grande, o relatório continua legível: quantas linhas, o que sobrou.
- ☐ Nenhuma trava: sempre há uma obra, uma carta ou uma decisão a tomar, ou o jogo diz que não há.

## Só para olhos humanos

- ☐ **Diversão** (roadmap §0.2): as três tensões e os três alívios aparecem aos pares? Estoque que enche e Celeiro; carta com prazo e escolha que volta; lobos e Torre e Paliçada.
- ☐ **Peso da interface**: preparar uma ausência leva quantos cliques? A sessão cabe em 2 a 10 minutos?
- ☐ **Textos**: dificuldades e ritmos, "Antes de partir", avisos, recusas, cartas. Tom de crônica, frases curtas.
- ☐ **Temas, teclado e 720 px**: a aba Conselho, a carta e o painel "Ameaça" nos três temas, só pelo teclado e em janela estreita.
- ☐ **Firefox** (obrigatório): uma jornada curta, duas abas, uma carta. **Safari, celular e leitor de tela** (desejáveis): registrar se foram usados.
- ☐ **A aba que fica aberta à vista a noite toda**: não recebe o relatório, só os avisos e a Crônica de cada acontecimento. É aceitável?
