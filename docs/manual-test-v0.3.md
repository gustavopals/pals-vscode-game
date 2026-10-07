# Roteiro manual da v0.3

Um roteiro curto para o autor jogar a v0.3 "A Guilda" **em desenvolvimento**, jornada por jornada, com o que observar em cada uma e como adiantar o tempo. Cada observação vai para a coluna "Evidência manual" de [acceptance-v0.3.md](acceptance-v0.3.md), com data, navegador e ritmo; cada decisão de regra, texto ou carta que o jogo levantar vai para [pendencias-v0.3.md](pendencias-v0.3.md). É o roteiro da tarefa V3G-T2 do [roadmap da v0.3](roadmap-v0.3.md); no molde de [manual-test-v0.2.md](manual-test-v0.2.md).

> **Estado em 2026-10-07.** Ninguém executou este roteiro, **nem o autor jogou nenhuma fase da v0.3**. Os comandos abaixo foram montados a partir do código (`tests/e2e/server.ts`, `tests/e2e/09-guilda.spec.ts`, `tests/e2e/10-mercado.spec.ts`) e dos dois roteiros de 15 minutos que já existiam em [pendencias-v0.3.md](pendencias-v0.3.md) (seções 7 e 8, a Fase C e a Fase D) e **não foram rodados à mão** por quem escreveu. Se um passo não funcionar como está escrito, anote e corrija aqui. Todo o conteúdo narrativo (os 18 grafos de expedição, os relatórios, os candidatos da Taverna, os heróis com nome, as cartas) é **rascunho que o autor não leu** ([content-v0.3.md](content-v0.3.md)): ler em voz alta e reescrever faz parte do roteiro.

## Preparação

```bash
pnpm install
pnpm dev:up && pnpm secrets:gen
pnpm dev:api          # deixe rodando: http://localhost:3000/v1/health
pnpm dev:web          # em outro terminal: http://localhost:5173
curl -s localhost:3000/v1/version   # "protocol": 3
```

Abra `http://localhost:5173` numa janela anônima (ou perfil novo) para começar sem conta. Nas boas-vindas, escolha o ritmo **Rápido** (3×) e a dificuldade **Senhor**, que é a que deixa as jornadas caberem numa tarde; repita a jornada 5 em **Rei de Ferro** para ver a morte, e a 3 em **Camponês** para ver só o ferimento. Os tempos abaixo são os do Rápido; no Normal multiplique por 3, no Tranquilo por 6. As **exceções em tempo real**, iguais em qualquer ritmo, são: a espera da encruzilhada (**12 h reais**), os prazos do soldo em atraso (**12 h** para o Descontente, **24 h** para a primeira partida, **2 h** entre uma partida e outra) e a expiração da carta do Conselho (24 h).

| O que | Tempo de jogo | Tempo real no Rápido |
|---|---|---|
| Um dia de jogo (uma virada: moral, soldo cobrado, sorteios, preço do Mercado) | 2 h | 40 min |
| Carta da estrangeira ferida (13º dia de jogo, ano 1) | início do 13º dia | cerca de 8 h depois de fundar |
| Rotação da Taverna | 12 dias | 8 h |
| Ferimento leve; ferimento grave | 2 h; 12 h | 40 min; 4 h |
| Viagem da caravana a Porto do Rio | 4 h | 1 h 20 min |
| Espera na encruzilhada | — | **12 h** |
| Atraso do soldo: Descontente; primeira partida; cada partida seguinte | — | 12 h; 24 h; 2 h |
| Primavera, verão, outono | 24 dias cada | 16 h cada |
| Inverno | 12 dias | 8 h |
| Um ano | 84 dias | 56 h |
| Relatório de Retorno | — | 4 h sem abrir a página, ou com a aba fora de vista |

## Como adiantar o tempo

Em produção o mundo anda no tempo de verdade e **nada** abaixo vale lá: nunca mexa no banco de produção. Em desenvolvimento há dois jeitos, os mesmos do [roteiro da v0.2](manual-test-v0.2.md) (seção "Como adiantar o tempo"): **A**, recuar `created_at` e `last_processed_at` no banco de desenvolvimento com a API parada; e **B**, o servidor de teste de relógio adiantável. Este roteiro usa o B, porque só ele tem as rotas que dão heróis, itens, Mestres e cativos.

```bash
pnpm dev:up
# terminal 1: a API de teste na porta 3100, com o Rápido como padrão
GAME_TIME_SCALE=3 pnpm --filter @lotg/server exec tsx ../../tests/e2e/server.ts
# terminal 2: o app falando com ela
LOTG_API_URL=http://127.0.0.1:3100 pnpm dev:web
# terminal 3: os atalhos
API=http://127.0.0.1:3100
t() { curl -s -X POST $API/__test/$1 -H 'content-type: application/json' -d "${2:-{\}}"; echo; }
```

O servidor de teste usa o `db_test` e **o esvazia ao subir**: não o rode junto com `pnpm test:integration` nem `pnpm test:e2e`, e encerre-o antes deles. As rotas valem para todos os feudos do banco, e o relógio da página não anda junto: as contagens regressivas saltam na leitura seguinte (até 30 s) ou ao recarregar.

| Atalho | O que faz |
|---|---|
| `t advance '{"ms":3600000}'` | adianta o relógio do servidor (aqui, 1 hora real) |
| `t council-recess` · `t horde-quiet` | sem cartas por sorteio; sem lobos (nem os do roteiro). **Comece por estes dois** |
| `t council-deal '{"cardId":"woundedStranger"}'` | põe uma carta na mesa (aqui, a estrangeira ferida) |
| `t raise '{"building":"townHall","level":3}'` | põe um edifício no nível (`tavern`, `guild`, `market`, `watchtower`, `palisade`…) |
| `t stock '{"resource":"gold","amount":400}'` | põe o estoque de um recurso (`gold`, `food`, `wood`, `stone`) |
| `t hero '{"name":"Aldo"}'` · `t hero '{"name":"Brenna","classId":"archer"}'` | dá um herói ao feudo |
| `t crossroads '{"posture":"cautious"}'` | põe uma expedição parada na encruzilhada (prazo de 12 h por padrão) |
| `t item '{"defId":"huntingSpear"}'` | põe um item no arsenal |
| `t master '{"masterId":"odo"}'` | dá um Mestre (espera à porta até haver vaga) |
| `t captive '{"name":"Aldo"}'` | põe o herói livre em cativeiro |
| `t reveal '{"modelId":"ruins"}'` | revela um destino de expedição |
| `t threat '{"level":45}'` | põe a Ameaça em um valor |

### O Relatório de Retorno depois de um salto

O relatório depende do relógio do **navegador** (4 h desde a última leitura). Para vê-lo sem esperar, no console do navegador (F12), logo antes de recarregar:

```js
for (const key of Object.keys(localStorage).filter((k) => k.startsWith('lords.cache:'))) {
  const cache = JSON.parse(localStorage.getItem(key));
  cache.lastSeenAt -= 5 * 60 * 60 * 1000;
  localStorage.setItem(key, JSON.stringify(cache));
}
location.reload();
```

É um atalho de desenvolvimento: uma ausência de verdade (uma noite) é a prova que vale.

## Jornadas

### 1. A estrangeira e o primeiro herói (cerca de 10 minutos)

Funde um feudo novo (Senhor, Rápido); `t council-recess` e `t horde-quiet`. Critério 1 do GDD §16.2.

1. Abra a aba **Guilda** antes de qualquer herói: ela diz como o primeiro chega?
2. `t council-deal '{"cardId":"woundedStranger"}'` e abra o **Conselho**. Leia as duas opções ("Acolher" dá Edda, Guerreira Leal, agora; "Cuidar e deixar partir" dá +40 de ouro e Rolf, Arqueiro Prudente, um dia de jogo depois). A carta diz, antes do clique, quem vem e o que custa de soldo?
3. Responda "Cuidar e deixar partir" (Rolf não é Leal: só com ele as jornadas 4 e 8 mostram o Descontente e a partida). `t advance '{"ms":2460000}'` (41 minutos reais).
4. **Em produção a carta chega sozinha**, na audiência do 13º dia de jogo (cerca de 8 h reais no Rápido; a quem já passou dele, na primeira audiência com lugar). Se der para esperar, funde outro feudo e deixe 8 h correrem, sem `council-recess`: a carta sai na frente das sorteadas?

O que observar:

- ☐ Antes da resposta: quem vem, quando, e quanto custa de soldo.
- ☐ Depois: "chega em…" na aba e na árvore; ao chegar, aviso, linha na Crônica, "Heróis 1" no cabeçalho, o soldo na linha do ouro.
- ☐ O nome do herói fica na memória? (Pergunta 1 do playtest.)
- ☐ O aviso e a carta nas três dificuldades: Camponês e Senhor acolhem sozinhos se a carta expirar; Rei de Ferro cuida e deixa partir.

### 2. Taverna, Guilda e Mercado (cerca de 10 minutos)

1. A obra de verdade pede o Salão no nível 3. Atalho: `t raise '{"building":"townHall","level":3}'`, depois `t raise '{"building":"tavern","level":1}'`, `t raise '{"building":"guild","level":1}'` e `t raise '{"building":"market","level":1}'`. Antes de cada atalho, a aba diz o que falta para a obra e o que ela dá? (Sem atalho: com o Salão no 3, cada obra é feita pelo painel, com o custo à vista, e leva minutos no Rápido.)
2. `t stock '{"resource":"gold","amount":600}'` e o mesmo para `food`. Aba **Guilda**, painel da Taverna: dois candidatos, cada um com classe, traços, preço e soldo; "troca em…"; o limite de heróis (1 + nível da Taverna).
3. **Contratar** pelo painel. Clique duas vezes depressa: uma contratação e uma cobrança. Tente contratar o segundo candidato com o limite cheio: o motivo aparece?
4. **O festival**: custo, efeito e "um por estação". A moral ganha o termo "Taverna Nv1" na virada seguinte.
5. Dispense um herói pela paleta (F1, "dispensar"): a confirmação diz que não há devolução. Cancele.
6. `t advance '{"ms":28800000}'` (8 h reais): a Taverna trocou a lista; quem não foi contratado saiu.

O que observar:

- ☐ O preço e o soldo conferem com o que saiu do ouro (QA-05). O soldo do nível 1 é 2 por hora de jogo; ele cresce com o nível do herói, e a ficha diz quanto sobe no próximo.
- ☐ As frases dos traços dizem o que eles fazem **hoje**.
- ☐ Contratar e festejar sem confirmação: fez falta?

### 3. A Patrulha e o relatório (cerca de 10 minutos)

Com a Guilda no nível 1: `t hero '{"name":"Aldo"}'` e `t hero '{"name":"Brenna","classId":"archer"}'`. Critério 3.

1. Em "Expedições", monte a **Patrulha dos Arredores** só com Aldo, Postura **Equilibrada**, e envie. A tela diz, antes do envio, a duração, o risco em palavra, a régua da equipe ("Com folga", "No limite", "Arriscado") e o que cada Postura faz?
2. Olhe a árvore e a barra de status. `t advance '{"ms":900000}'` (15 minutos reais). Abra "Relatórios".
3. Leia o relatório inteiro: nó a nó, com ícone **e** palavra para o desfecho, quem se destacou, o que ensinou o revés (se houve), o saque e a experiência. A linha da Crônica leva ao relatório?
4. Repita com a **Floresta Antiga**, e leia um segundo relatório em voz alta (o teste do GDD §9.4: lê-se como uma crônica?).

O que observar:

- ☐ O relatório conta uma história, ou só uma lista? Perguntas 3 e 5 do playtest.
- ☐ O envio tem confirmação, e ela fez falta? Quantos cliques são necessários para enviar?
- ☐ O poder do herói sobe com a experiência, e a ficha diz por quê.

### 4. A encruzilhada e a Postura (cerca de 15 minutos)

Critério 2 e QA-06. Não tem como o Rápido parecer lento aqui: a espera é de **12 h reais**.

1. Mande **Aldo e Brenna** ao **Covil de Lobos**, Postura **Cautelosa**. `t advance '{"ms":1200000}'` (20 minutos reais): a equipe deve estar parada em uma encruzilhada. (Atalho: `t crossroads '{"posture":"cautious"}'` com o herói livre.)
2. O aviso "Encruzilhada em …", o selo da árvore e a barra de status dizem que há uma decisão pendente? A folha mostra o prazo ("a espera acaba em …"), o que a Postura fará e cada caminho com a pista e o requisito da opção bloqueada?
3. Escolha um caminho pela folha (ou pela paleta, "Escolher caminho"). O caminho muda o que o relatório conta?
4. Outra expedição: deixe **vencer o prazo**: `t advance '{"ms":43200000}'` (12 h reais). A Crônica diz que a Postura decidiu e o que escolheu; a decisão sai da lista de pendentes.
5. Abra o app em **duas abas** e escolha em uma: a outra vê a decisão sumir, e uma resposta atrasada é recusada com a frase do servidor.

O que observar:

- ☐ Dá para entender o que cada caminho arrisca sem tê-lo percorrido?
- ☐ O que você sentiu ao ver a Postura decidir por você: alívio, perda ou nada? Doze horas é o prazo que você quer?
- ☐ Pergunta 2 do playtest: o que escolheu e o que deixou para trás.

### 5. Desastre, ferimento, captura e Resgate (cerca de 10 minutos)

QA-08. É raro de acontecer ao acaso; use o atalho.

1. Aba Guilda, ficha de Aldo: ferido (leve ou grave) mostra "sara em…" e o herói volta sozinho.
2. `t captive '{"name":"Aldo"}'`: a ficha mostra o cativeiro, o soldo parado e **"Enviar o Resgate"**. Cativo **não** conta no limite de heróis: dá para contratar um substituto.
3. Envie o Resgate (destino que aparece só com um cativo). Na volta, Aldo está livre, sem dever o atraso.
4. Em **Rei de Ferro**, onde o nó marcado diz que o herói morre: a morte aparece com frase própria? Em **Camponês**, só o ferimento.

O que observar:

- ☐ "Camponês só fere; Senhor captura; Rei de Ferro mata" é o que a descrição da dificuldade, na criação, diz.
- ☐ O saque perdido no Desastre é dito.

### 6. O Covil de Lobos limpo (cerca de 5 minutos)

1. `t threat '{"level":45}'` e olhe o painel "Ameaça" (precisa da Torre de Vigia: `t raise '{"building":"watchtower","level":1}'`).
2. Mande uma equipe com folga ao **Covil de Lobos** e leve-a até o fim. Ao limpar: a Ameaça cai 30, o tile deixa de somar, e a Crônica diz.
3. A primavera, o verão e o inverno não sobem a Ameaça; **o outono, sim** (os lobos descem a serra). Na virada do ano os lobos voltam.

### 7. Equipar e o arsenal (cerca de 5 minutos)

1. `t item '{"defId":"huntingSpear"}'` e `t item '{"defId":"paddedJerkin"}'`. Abra o "Arsenal" e a ficha: arma, armadura e acessório.
2. Equipe a lança em Aldo e o gibão em Brenna. O poder sobe, e o texto diz por quê? "Equipar" desabilitado diz o motivo?

### 8. O ouro acaba e a volta (cerca de 10 minutos)

QA-04. Critério de diversão: desespero que não vem de uma noite de sono.

1. Deixe a Mina de Ouro sem ninguém e `t stock '{"resource":"gold","amount":0}'`. Barra de status, árvore, aba Guilda e, na aba **Hoje**, "Antes de partir". O atraso abre na hora, com aviso?
2. `t advance '{"ms":46800000}'` (13 h reais): os heróis que não são Leais ficam **Descontentes** (poder cai). `t advance '{"ms":43200000}'` (mais 12 h: 25 h de atraso): **parte o que chegou por último**; o seguinte, 2 h reais depois. Leal nunca parte.
3. Recarregue com o atalho do relatório: o Relatório de Retorno conta o atraso, o Descontente e quem partiu em "O que exigiu um preço"?
4. `t stock '{"resource":"gold","amount":300}'`: o atraso fecha com aviso de alívio. Se a aba disser que o atraso já devia um herói e ele parte na virada seguinte, é a regra confirmada em 2026-10-06 ("o que venceu é cobrado"): a frase explica?

### 9. O Mercado, a venda e a caravana (cerca de 15 minutos)

Critérios 4 e 5, QA-09 e QA-10. O Mercado nível 1 vende e compra; as caravanas pedem o nível 2.

1. `t raise '{"building":"market","level":2}'`; `t stock '{"resource":"wood","amount":900}'`. Aba **Mercado**: a tabela de preços (compra, venda, base, tendência em palavra e ícone, "Cabem mais N hoje").
2. **Vender o excedente**: o atalho "Vender até N" ao lado do depósito que enche; a negociação em duas etapas ("Revisar" e "Confirmar", com o total antes do clique). Venda até o volume do dia (200 por nível, por recurso): a recusa diz o que ainda cabe. `t advance '{"ms":2400000}'` (40 minutos reais, um dia de jogo): o volume e o preço mudam. Pergunta 4 do playtest: o que fez com o que sobrava?
3. **Comprar** madeira com o depósito quase cheio: recusada inteira, com o motivo.
4. **Caravana sem escolta**: envie 300 de madeira a Porto do Rio com a Torre no nível 0 (chance de emboscada de 10%, e a escolta a zera). A tela mostra o preço fixado no envio (+15% sobre o balcão), a viagem de 1 h 20 min reais e o risco **antes** de confirmar?
5. **Caravana com escolta** (um herói livre): o herói fica ocupado até a chegada. `t advance '{"ms":4800000}'` (80 minutos reais): a caravana chega, o ouro entra e o herói está solto.
6. Para ver uma emboscada, sem esperar o sorteio: os testes em navegador usam a semente `qa-10-32` ([10-mercado.spec.ts](../tests/e2e/10-mercado.spec.ts)); à mão, mande várias sem escolta e anote quantas foram emboscadas. A emboscada leva metade da carga, e a Crônica e o Retorno dizem.
7. **Um Mestre**: `t master '{"masterId":"odo"}'`. Aloque-o em um edifício produtivo: +15% imediato com a explicação; mudar de edifício custa um dia de jogo de adaptação sem o bônus.

O que observar:

- ☐ O total confere com `quantidade × preço de hoje`; o dia que vira com a conferência aberta pede a conferência de novo.
- ☐ A escolta é uma escolha, e não obrigação nem enfeite?
- ☐ O Mercado dá ouro ou só a sensação de trabalho? O que você fez com o ouro?

### 10. O retorno e "Antes de partir" (cerca de 10 minutos)

QA-13. Deixe uma expedição concluída, um herói ferido, uma caravana emboscada e uma encruzilhada esperando; use o atalho do relatório (seção "O Relatório de Retorno depois de um salto") e recarregue.

- ☐ Três blocos, "O feudo prosperou", "O que exigiu um preço" e "Você ainda pode decidir", sem omitir nem duplicar; cada custo com a próxima ação.
- ☐ Uma linha por expedição, com a marca da Postura; as vendas e as caravanas em "Recebido"; a encruzilhada pendente em "Você ainda pode decidir".
- ☐ "Antes de partir" sugere, em até cinco linhas: o excedente vendável, o herói livre com destino, a rotação da Taverna, o ouro que não paga o soldo.
- ☐ A aba deixada aberta e fora de vista por horas conta a ausência na volta.

### 11. Partida migrada da v0.2

**Em produção**, o feudo que você já jogava na v0.2 é a prova de verdade: ele passa por todos os passos do estado 12 até o atual na primeira leitura (ou no job de avanço) depois da publicação. Abra-o quando `GET /v1/version` responder `protocol: 3`, e anote: nada se perdeu; **nenhum soldo de antes da migração**; sem herói (a carta da estrangeira chega na primeira audiência com lugar, se o feudo já passou do 13º dia); o piso de população de 3 aldeões; a fome ou o atraso que a regra nova cobra. Quem estava com o jogo aberto vê "Recarregue a página" (`426`).

**Em desenvolvimento**, monte uma partida da v0.2 com um retrato congelado do motor (por exemplo `packages/engine/src/__fixtures__/state-v12-council.json` ou `state-v12-raid-announced.json`), como a jornada 2 do [roteiro da v0.2](manual-test-v0.2.md) faz com o retrato da v0.1: crie uma partida pelo app, pare a API, grave o retrato por cima com `schema_version = 12` e `created_at` no passado o bastante, e suba a API de novo.

- ☐ Nada se perdeu (estoques, níveis, aldeões, objetivos concluídos, cartas pendentes, continuações).
- ☐ Os objetivos 11 a 16 aparecem; os prêmios dos de 1 a 10 não se repetem.
- ☐ Nenhum evento da v0.3 antes da fronteira da migração.

### 12. Um ano e a virada seguinte, com equipe (56 h reais no Rápido)

Em saltos de uma estação (16, 16, 16 e 8 h), com uma sessão curta em cada uma, como quem volta duas vezes por dia; mande uma expedição por sessão, venda o excedente, responda às cartas.

- ☐ A equipe ocupada: sempre há um destino que vale a pena, ou o herói fica parado?
- ☐ O soldo é suportável para quem visita duas vezes por dia?
- ☐ O inverno com a equipe: a lenha, o frio, o soldo; o objetivo da virada.
- ☐ O ano 2: os lobos do Covil voltam; as cartas já vistas voltam a sair; o Mercado continua cotando.
- ☐ Nenhuma trava: sempre há uma obra, uma carta ou uma decisão a tomar, ou o jogo diz que não há.

## Só para olhos humanos

- ☐ **Diversão** (roadmap da v0.3, §8.3): as tensões e os alívios aparecem aos pares? Soldo e Mercado; expedição e Postura; Ameaça e Covil; escolta e caravana.
- ☐ **Peso da interface**: quantos cliques para enviar uma expedição e para vender? A sessão cabe em 2 a 10 minutos? A v0.3 trocou diversão por microgerenciamento?
- ☐ **Textos**: dificuldades (a frase nova sobre os heróis), candidatos, grafos, relatórios, cartas da estrangeira. Tom de crônica, frases curtas. Anote o que você reescreveria primeiro; tudo é rascunho.
- ☐ **Temas, teclado e 720 px**: as abas Guilda e Mercado, a folha da encruzilhada e a conferência da negociação nos três temas, só pelo teclado e em janela estreita (QA-15).
- ☐ **Firefox** (obrigatório): uma jornada curta (1 e 4), duas abas. **Safari, celular e leitor de tela** (desejáveis): registrar se foram usados.
- ☐ **No ritmo da produção**: repita a jornada 4 em **Normal** (`GAME_TIME_SCALE=1`) e **Tranquilo**: os prazos reais da encruzilhada e do soldo são os mesmos (QA-16).
