# @lotg/sim-cli

Bots de playtest que jogam partidas inteiras em segundos, só com o motor (`@lotg/engine`), sem servidor nem navegador. É por aqui que os números de `@lotg/content` são conferidos e corrigidos (GDD §15.3).

São quatro modos: uma partida em processo (`--seed`), a matriz de balanceamento (`--matrix`), carga contra um servidor (`--remote`) e fumaça de concorrência contra um servidor (`--smoke`). Uma opção desconhecida ou de outro modo é recusada, e não ignorada.

## Uso

```bash
pnpm -s sim -- --seed pedra-alta-golden --days 7 --strategy economico --sessions-per-day 2 > semana.csv
pnpm -s sim -- --seed pedra-alta-golden --days 7 --time-scale 3 > semana-3x.csv
pnpm -s sim -- --seed pedra-alta-001 --game-year --time-scale 3 --strategy preguicoso --sessions-per-day 1 > ano-3x.csv
pnpm -s sim -- --matrix > matriz.csv 2> matriz.md
```

| Opção | Padrão | Significado |
|---|---|---|
| `--seed` | obrigatória | Semente da partida |
| `--days` | `7` | Dias reais simulados; no ritmo Normal, 7 dias são um ano de jogo |
| `--game-year` | — | No lugar de `--days`: a partida dura um ano de jogo completo, o que dá 56 h reais no ritmo 3, 7 dias no 1 e 14 dias no 0,5. Recusado em um ritmo em que o ano não fecha em horas reais inteiras |
| `--strategy` | `economico` | Bot que joga as sessões: `economico` ou `preguicoso` |
| `--sessions-per-day` | `2` | Sessões por dia real, a intervalos iguais, a primeira na criação da partida |
| `--time-scale` | `1` | Ritmo: horas de jogo por hora real. Qualquer número positivo (`3`, `0.5`) |
| `--difficulty` | `lord` | Dificuldade da partida: `peasant`, `lord` ou `ironKing`. Fica gravada no estado; os fatores dela passam a valer com as mecânicas da v0.2 |

O CSV sai na saída padrão e o resumo na saída de erro; use `pnpm -s` para o pnpm não misturar o próprio cabeçalho ao CSV. A mesma semente e as mesmas opções produzem sempre o mesmo arquivo.

### Ritmo (`--time-scale`)

O jogo recomenda o ritmo 3 ([ADR 0011](../../docs/decisions/0011-ritmo-3x-no-mvp.md) e [0013](../../docs/decisions/0013-regras-da-v0.2-tempo-ritmo-migracao-e-economia.md), decisão 2); o padrão daqui continua sendo 1, o ritmo Normal em que o GDD é escrito. As faixas de balanceamento existem para cada ritmo que o jogo oferece (veja "Matriz de balanceamento").

Com `--time-scale N`, o que é do jogador continua em tempo real e o que é do mundo anda `N` vezes mais rápido:

- `--days` e `--sessions-per-day` são dias reais e sessões por dia real. Entre duas sessões passam `N` vezes mais horas de jogo.
- O bot recebe a visão como o app a recebe: prazos em segundos reais e taxas por hora real (`deriveViewState` com `{ timeScale }`).
- O CSV continua com uma linha por hora real, e as colunas `*_per_hour` são por hora real. O calendário (`year`, `season`, `day_of_season`) é o de jogo: no ritmo 3, um dia de jogo dura 40 minutos reais.
- O resumo diz o ritmo na primeira linha, e todas as horas dele são horas reais. A segunda linha diz a partida como o jogo a mostra ao jogador, lida do `ViewState`: `Partida: Senhor · Rápido: um ano em 56 horas` (um ritmo que o jogo não oferece sai como `Ritmo 2×: um ano em 3 dias e 12 horas`).

O ritmo não muda as regras: as mesmas ordens, nos mesmos instantes de jogo, dão o mesmo feudo em qualquer ritmo. `src/timescale.test.ts` joga 3 dias no ritmo 3 com 3 sessões por dia, repete as mesmas ordens em 9 dias no ritmo 1 com 1 sessão por dia (as sessões caem nos mesmos instantes de jogo) e confere a igualdade no estado, nos eventos e linha a linha, com obras que começam sozinhas no caminho. A partida do ritmo 1 repete as ordens em vez de perguntar de novo ao bot porque o bot decide em tempo real: `ampliar o estoque` olha o depósito que "enche em menos de 8 horas reais", que no ritmo 3 são 24 horas de jogo.

## Os bots

Um bot joga uma sessão: recebe a visão e uma função para dar ordens, `(view, act)`, e nada mais. Ele é uma **lista de políticas** (`src/bots/policies.ts`), aplicadas em ordem a cada sessão; cada política olha a visão que a anterior deixou, dá as ordens que achar e devolve a visão resultante.

| Bot | Políticas, na ordem | Quem ele imita |
|---|---|---|
| `economico` | `obra mais barata`, `ampliar o estoque`, `planejar automáticas`, `recrutar`, `alocar por demanda`, `guardar lenha` | Quem cuida do feudo a cada visita e reequilibra todos os ofícios |
| `preguicoso` | `obra mais barata`, `ampliar o estoque`, `planejar automáticas`, `recrutar`, `comida primeiro`, `ocupar os livres`, `guardar lenha` | Quem passa uma vez por dia e decide o mínimo (GDD §15.2) |

| Política | O que faz |
|---|---|
| `recrutar` | Recruta quantos aldeões couberem na ordem, guardando uma reserva de comida |
| `obra mais barata` | Inicia a melhoria mais barata entre as que podem começar agora, sem contar os depósitos (Celeiro e Armazém), que são de `ampliar o estoque`. Com o inverno à vista, não começa a obra que gastaria a madeira da lareira: a reserva é o que a visão diz que o inverno queima menos o que a Serraria repõe |
| `ampliar o estoque` | Constrói ou melhora o depósito que vale a obra agora, do mais urgente ao menos: o que trava uma obra cujo custo não cabe no limite (`EXCEEDS_STORAGE`), o que está cheio e perdendo produção (`resources[].full` e `wastingPerHour`) e o que enche em menos de 8 horas reais (`fullInSeconds`). O edifício de cada recurso vem de `resources[].storageBuilding`. Como vem depois de `obra mais barata` e a fila é uma só, o depósito fica com a sessão em que nenhuma outra obra pôde começar; não gasta a madeira da lareira |
| `planejar automáticas` | Planeja como automáticas ("iniciar quando houver recursos") as obras que a visita não iniciou, para elas começarem sozinhas quando houver fila e recurso: primeiro o depósito que `ampliar o estoque` queria, depois as outras, da mais barata à mais cara, que é a ordem em que o motor as tenta. Entram também as que esperam o Salão ou um depósito maior (começam quando destravar); ficam de fora a obra que chegou ao teto e os depósitos que ninguém pediu. Uma obra que começa sozinha não pergunta pela lenha: enquanto a conta da visão diz que a lareira depende do estoque (o inverno queima mais do que a Serraria repõe), o bot desmarca as planejadas que gastam madeira (`setAutoStart`) e não planeja outras; quando a conta fecha, marca de novo |
| `alocar por demanda` | Reparte os aldeões sem trocar ninguém de ofício à toa. Na fazenda, quem alimenta o feudo (contando quem ainda está chegando e duas bocas de folga) e, enquanto há vaga nas Habitações e a despensa não está cheia, um lavrador a mais: é a sobra de comida que paga os recrutas. Um fazendeiro além da conta fica onde está. Nos materiais, cada edifício recebe primeiro o que pede para contar como ocupado (`workers[].occupiedFrom`: é o que faz a experiência do ofício subir) e o resto vai em proporção ao tempo que cada um levaria para cobrir o que as obras pedem. Quem está sem ofício vai para onde mais falta gente; quem já trabalha só troca de ofício quando a falta do destino levaria mais de duas adaptações (`workersRules.adaptationSeconds`) para ser coberta com os braços que ele já tem, e quem cede braços continua ocupado |
| `comida primeiro` | Põe na fazenda os braços que faltam para a comida não cair, contando quem está chegando; nunca tira ninguém de lá. Sem livres, busca em quem tem mais gente |
| `ocupar os livres` | Manda todos os aldeões sem ofício, em uma ordem só, para o material que mais demoraria a cobrir o que falta às obras; se nada falta, para o ofício com menos gente |
| `guardar lenha` | Quando a conta da lenha da visão diz que falta madeira (no outono, `calendar.nextSeason.firewood`; no inverno, `winter.firewood`), manda para a Serraria os braços que cobrem a falta até a estação virar: primeiro os livres, depois quem está nos outros materiais; nunca tira ninguém da fazenda. Sem falta, não dá ordem |

Entre as sessões o mundo anda sozinho. Quem chega entre duas sessões fica sem ofício até a seguinte.

**Uma mecânica nova entra como uma política nova** (roadmap da v0.2, §0.5): escreva a política em `policies.ts`, com teste em `bots.test.ts`, e ponha-a na lista dos bots que devem usá-la. Não é preciso mexer no simulador nem nos outros bots. As estações (V2C-T1) trouxeram `guardar lenha`, o armazenamento (V2C-T2), `ampliar o estoque`, e a segunda fila com o início automático (V2C-T5), `planejar automáticas`. A troca de ofício (V2C-T3) não trouxe uma política nova: mudou `alocar por demanda`, que era quem trocava todo mundo de ofício a cada visita; as tarefas seguintes preveem "responder à carta do Conselho" e "erguer a Paliçada quando a Ameaça é conhecida".

**As obras vêm antes do recrutamento** (desde V2C-T5). Até V2C-T2 o bot recrutava primeiro, e a comida gasta em aldeões escondia dele o aviso que o jogador vê ao chegar: "Despensa cheia: comida indo ao chão. Construa o Celeiro". Com a comida abaixo do limite e um aldeão a caminho, a visão não promete "cheio em", e `ampliar o estoque` nunca pedia o Celeiro: em sete dias no ritmo 3 o Armazém chegava ao nível 8 e o Celeiro ficava no 0. Enquanto o feudo crescia devagar isso não custava nada. Com as obras começando sozinhas ele cresce depressa, e o perfil Regular no ritmo 3 chegava ao terceiro inverno com 58 aldeões e a Despensa de 500: **6 horas reais de fome**. Olhando o painel antes de recrutar, o bot ergue o Celeiro e a fome some (a medição das duas ordens está em [docs/balance-v0.2.md](../../docs/balance-v0.2.md), seção 5.5).

**Trocar de ofício custa, e o bot econômico deixou de refazer a alocação a cada visita** (desde V2C-T3). Quem chega a um edifício rende metade por um dia de jogo, e um edifício vazio perde a experiência do ofício. Com a política antiga nas regras novas, o Regular do ritmo 3 trocava 53 trabalhadores de ofício em uma semana e o Dedicado, 194; com a nova, 5 e 26, e todos os ofícios dos materiais chegam à experiência máxima. O bot faz a conta dos fazendeiros com o que um lavrador rende adaptado (`perWorkerPerHour`): logo depois de uma troca a comida pode cair por um dia de jogo, até a adaptação terminar. O `preguicoso` não mudou: ele nunca tirou ninguém do lugar sem necessidade.

**O bot econômico planta para crescer** (desde V2C-T3). Até aqui ele vivia da folga de duas bocas e do arredondamento da conta dos fazendeiros, e quanto sobrava para recrutar era sorte. Com a experiência do ofício um lavrador passou a bastar onde eram dois, a sobra sumiu, e o perfil Dedicado no ritmo 0,5 caía de 22 para 15 aldeões: jogar mais vezes dava um feudo menor. Com um lavrador a mais enquanto há vaga, o mesmo perfil chega a 61, e o Regular do ritmo 1 vai de 45 a 68. Foi uma mudança de bot, medida à parte da mecânica em [docs/balance-v0.2.md](../../docs/balance-v0.2.md), seção 6.4, para o salto não ser lido como efeito da regra.

**O depósito, para os bots, é meio e não fim.** Estoque além do custo da próxima obra não compra nada: os bots erguem o depósito quando ele trava uma obra, quando está cheio e perdendo produção ou quando enche em menos de uma noite, e depois da obra mais barata. Até V2C-T2, com uma fila só e uma obra por visita, isso era raro (só o Dedicado chegava ao Armazém em uma semana); com as planejadas automáticas o depósito que não pôde começar na visita fica na lista e começa sozinho, e todos os perfis passam a ter Celeiro e Armazém. A produção que não cabe continua indo ao chão, e a matriz mede quanto. Uma primeira versão da política ampliava o depósito **antes** da obra mais barata; a cada visita havia um depósito enchendo, a fila ia para ele, e o Regular terminava a semana com o Salão um nível abaixo e nove aldeões a menos. A medição das duas ordens está em [docs/balance-v0.2.md](../../docs/balance-v0.2.md), seção 4.

**A lenha continua sem apertar nenhum bot**: em toda partida da matriz a Serraria repõe mais do que a lareira queima (no ritmo 3, 64 aldeões queimam 768 de madeira no inverno e a Serraria no nível 8 entrega várias vezes isso), e nenhuma delas passa frio. `guardar lenha` é provada em `bots.test.ts` com feudos sem madeira, inclusive contra o motor, e `planejar automáticas`, com a conta da lenha apertada.

**Bot honesto.** Uma política só conhece o `ViewState`: nunca o `GameState`, flags, o gerador de sorteios nem `@lotg/content`; um teste recusa esses imports em `src/bots/` (dos pacotes do jogo, só os tipos de `@lotg/engine`). O que um trabalhador rende vem de `workers[].perWorkerPerHour`, e o que o feudo come é o que a fazenda rende menos o saldo da comida. Assim um fator de fome, de estação, de moral ou de dificuldade chega ao bot como chega ao jogador, e um efeito que a visão esconde (o de uma carta, a composição de uma incursão) fica escondido dele também. Até a correção da revisão da Fase B, `alocar por demanda` lia a taxa por trabalhador e o consumo por aldeão direto do conteúdo, e por isso não via a fazenda rendendo menos na fome: com oito bocas, deixava um fazendeiro só e a fome não acabava. A troca não mudou nenhum número medido: o CSV e o resumo de 20 partidas do `economico` (ritmos 1, 3, 0,5, 2 e 10 × 1, 2, 4 e 8 sessões por dia, 14 dias) e a matriz inteira saíram idênticos.

## Como ler o CSV

Uma linha por hora real (168 linhas de dados em 7 dias), com o retrato do feudo ao fim daquela hora.

| Coluna | Significado |
|---|---|
| `hour`, `real_day` | Hora e dia reais desde a criação da partida |
| `year`, `season`, `day_of_season` | Calendário de jogo (um dia de jogo dura 2 h reais no ritmo 1 e 40 min no ritmo 3) |
| `food`, `wood`, `stone`, `gold` | Estoque em unidades inteiras |
| `*_per_hour` | Saldo líquido por hora real naquele instante; `food_per_hour` já desconta o consumo |
| `villagers`, `capacity` | População e vagas |
| `free` | Aldeões sem ofício naquela hora: alto por muitas horas indica sessões espaçadas demais |
| `in_training` | Aldeões recrutados que ainda não chegaram |
| `townHall` … `warehouse` | Nível de cada edifício; `granary` e `warehouse` começam em 0 (ainda não construídos) |
| `famine` | `1` se o feudo está com fome naquela hora |
| `cold` | `1` se o feudo passa frio naquela hora: é inverno e a madeira da lareira acabou. Fica entre as colunas das mecânicas, no fim da linha |
| `queue_idle` | `1` se ao menos uma obra poderia começar agora (o que exige uma fila livre: com a segunda fila aberta e vazia, uma obra em curso não desfaz a ociosidade): o feudo tinha o que construir e esperou a próxima visita |
| `planned_idle` | O mesmo, contando só as obras que o jogador deixou planejadas. O início automático (V2C-T5) zera esta coluna: uma planejada automática que pode começar não fica na lista |
| `commands_accepted`, `commands_refused` | Ordens aceitas e recusadas pelo motor, acumuladas desde a criação da partida |
| `refused_by_code` | As recusas por motivo, acumuladas: `HOUSING_FULL:1;QUEUE_BUSY:2`. Vazio sem recusas |

**Colunas das mecânicas.** O cabeçalho termina com as colunas das mecânicas da v0.2, em ordem fixa, para o formato não mudar a cada mecânica (`MECHANIC_COLUMNS`, em `src/report.ts`). As que ainda ninguém mede saem **vazias** (e não zero: zero seria uma medida) e formam `RESERVED_COLUMNS`; a tarefa de cada uma a acrescenta a `MEASURED_COLUMNS`, lendo da visão, e ela sai da lista das reservadas sem mudar de lugar.

| Coluna | Significado | Tarefa |
|---|---|---|
| `wasted_food`, `wasted_wood`, `wasted_stone` | **Medidas desde V2C-T2.** O que não coube no depósito, por recurso, em unidades e acumulado (o ouro não tem limite): o que os eventos `storageWasted` relataram mais o que a visão mostra como ainda não relatado (`wastedToday`). No CSV da matriz, o total da partida | V2C-T2 |
| `cold` | **Medida desde V2C-T1.** No CSV de uma partida, `1` se o feudo passa frio naquela hora; no da matriz, as horas de frio da partida | V2C-T1 |
| `morale` | Moral do feudo, de 0 a 100 | V2C-T4 |
| `cards_seen`, `cards_answered`, `cards_expired` | Cartas do Conselho recebidas, respondidas e expiradas, acumuladas | V2D-T1 |
| `wolf_losses` | Perdas em incursões de lobos, acumuladas | V2E-T3 |

O resumo, na saída de erro, traz:

```text
Semente pedra-alta-golden · estratégia economico · 7 dias · 2 sessões/dia · ritmo 3×
Partida: Senhor · Rápido: um ano em 56 horas
Motor 0.1.0 · estado v6 · conteúdo 438b14e769ef8bf7
Políticas: obra mais barata, ampliar o estoque, planejar automáticas, recrutar, alocar por demanda, guardar lenha
População: 72 de 75 vagas
Níveis: townHall 7, farm 8, lumberMill 8, quarry 8, goldMine 8, housing 8, granary 8, warehouse 8
Estoque: food 4570, wood 5100, stone 5100, gold 37781
Fome: nenhuma
Frio: nenhum
Fila ociosa: 30 h com obra que podia começar (0 h com obra planejada)
Sem o início automático (as mesmas planejadas, manuais): 168 h com obra que podia começar (168 h com obra planejada)
Aldeões sem ofício: 804 aldeão-horas (4,8 por hora)
Excedente parado: wood 5100, stone 5100, gold 37781
Desperdício: food 20830, wood 105299, stone 49710 (114 h com depósito cheio perdendo produção)
Comandos: 120 aceitos, 0 recusados
Sem medida até as Fases C a E: moral, cartas do Conselho, perdas por lobos
```

- A terceira linha **identifica o jogo medido**: versão do motor, versão do estado e `contentHash`, o mesmo de `GET /v1/version` (os dois saem de `contentHash`, em `@lotg/protocol`). Dois resumos só se comparam número a número quando essa linha é igual.
- **A linha "Sem o início automático"** é a partida de controle: a mesma semente e o mesmo bot, com as planejadas entrando como manuais (`simulate({ ..., manualPlans: true })`), como era antes de V2C-T5. O comando joga as duas e põe a fila ociosa de uma ao lado da da outra: é o que a mecânica mudou para aquele perfil de visita. O CSV é o da partida de verdade.
- **Os três sinais de tédio** (roadmap, V2B-T4): a fila ociosa, os aldeões sem ofício e o excedente parado dizem que o jogo não pediu nada ao jogador. As horas são reais, uma amostra ao fim de cada hora. "Aldeão-horas" é a soma, hora a hora, dos aldeões sem ofício. O excedente parado é o estoque final de madeira, pedra e ouro, cada um por si e nunca somados; a comida fica de fora porque é consumida. Com os limites, o da madeira e o da pedra nunca passam do limite do depósito.
- **O desperdício** é o que a produção e os ganhos deixaram de pôr no estoque porque ele estava no limite, por recurso, na partida inteira; entre parênteses, as horas com ao menos um depósito cheio e perdendo produção. É a medida que o GDD §15.2 pede ("nenhum recurso desperdiçando no cap por mais de 8 h de jogo contínuas"), ainda sem faixa.
- Um bot bem escrito não tem comando recusado; se tiver, os códigos vêm entre parênteses.

## Matriz de balanceamento

```bash
pnpm -s sim -- --matrix > matriz.csv 2> matriz.md   # as 50 sementes; cerca de 11 s
pnpm -s sim -- --matrix --seeds 5 > /dev/null       # só as 5 primeiras: uma olhada rápida
```

A matriz do roadmap da v0.2 (§7.3) joga, na dificuldade Senhor:

- **três perfis de visita** (GDD §15.2): Preguiçoso, 1 sessão por dia real, com o bot `preguicoso`; Regular, 2 sessões, com o `economico`; Dedicado, 4 sessões, com o `economico`;
- **cada ritmo que o jogo oferece** (`balance.paces`): hoje 3, 1 e 0,5;
- **50 sementes fixas**: `pedra-alta-001` a `pedra-alta-050`;
- **duas janelas, em tabelas separadas**, porque não têm o mesmo denominador: **7 dias reais** (em que o ritmo 3 atravessa três anos de jogo e o 0,5, meio ano) e **um ano de jogo** (56 h reais no ritmo 3, 7 dias no 1, 14 dias no 0,5). No ritmo 1 as duas são a mesma partida, jogada uma vez.

O CSV, na saída padrão, tem uma linha por partida (janela, ritmo, perfil, semente) com os valores finais e as mesmas colunas das mecânicas (`cold`, aqui, são as horas de frio da partida, e `wasted_*`, o desperdício total). As tabelas, na saída de erro, saem em Markdown, prontas para [docs/balance-v0.2.md](../../docs/balance-v0.2.md): a identificação da rodada, o menor e o maior valor entre as sementes em cada célula (com o desperdício de cada recurso e as horas com depósito cheio perdendo produção ao lado do excedente parado), as faixas cobradas e o veredito. O comando sai com código 1 se alguma partida ficar fora da faixa. Com `--difficulty peasant` ou `ironKing` a rodada é jogada e medida, mas não há faixa: a dificuldade já muda o limite de estoque (V2C-T2), e as faixas das outras duas ficam para a rodada de balanceamento (V2C-T7).

Enquanto nenhuma regra sorteia nada, as 50 sementes dão o mesmo resultado; a lista passa a trabalhar com a moral e o Conselho, e um teste avisa quando isso acontecer.

### Faixas

`src/bands.ts` guarda a **linha de base medida** de cada célula (tabela `MEASURED`) e a regra que faz dela uma faixa (`SLACK`):

| Grandeza | Faixa |
|---|---|
| População final | De 10% abaixo do menor a 10% acima do maior valor medido |
| Salão do Senhor | Pelo menos o menor nível medido |
| Horas de fome | No máximo o maior valor medido, com 5% de folga (hoje, zero em toda célula) |
| Horas de frio | No máximo o maior valor medido, com 5% de folga (hoje, zero em toda célula) |
| Excedente parado de madeira, de pedra e de ouro | No máximo o maior estoque final medido, com 5% de folga. Só tem teto: sobrar menos nunca é problema |
| Ordens recusadas | Nenhuma |

`src/balance.test.ts` joga a matriz inteira a cada `pnpm test` (750 partidas distintas, cerca de 15 s desde a troca de ofício: os feudos ficaram maiores e a visão projeta o que o ofício muda nas previsões) e falha se alguma sair da faixa, dizendo a célula, o problema com os dois números e em quantas sementes ele apareceu. A fila ociosa e os aldeões sem ofício são medidos e relatados, mas ainda não têm faixa.

**Estes limites são o jogo como ele está, não metas aprovadas pelo autor** ([ADR 0013](../../docs/decisions/0013-regras-da-v0.2-tempo-ritmo-migracao-e-economia.md), decisão 5): servem de guarda de regressão até o autor apertá-los. Quando uma faixa falhar:

1. Se a mudança **não** pretendia mexer na economia, é uma regressão: ajuste os números em `@lotg/content`, nunca o bot.
2. Se a mudança é uma mecânica que muda a economia de propósito, a linha de base é regravada de propósito, como um golden: rode `pnpm -s sim -- --matrix`, confira o que mudou e por quê, copie o bloco "Linha de base medida nesta rodada" para `MEASURED` e registre a rodada, com as tabelas, em `docs/balance-v0.2.md`. Nada regrava a linha de base sozinho.

Se a matriz passar a pesar na suíte (mais de uns 20 s no `pnpm test`), deixe no teste um subconjunto das sementes e rode a matriz completa pelo comando.

## Modo remoto: carga contra um servidor

```bash
pnpm -s sim -- --remote http://localhost:3000 --bots 50 --minutes 2 --poll-ms 2000
```

Cada bot cria uma conta anônima e uma partida e joga pela API com o `client-sdk`, como o app web: `GET /view` com `If-None-Match`, `GET /events?after=` e as ordens do bot. O relatório traz chamadas, p50, p95 e máximo por endpoint, e o comando sai com erro se houver respostas 5xx ou 429.

| Opção | Padrão | Significado |
|---|---|---|
| `--remote` | — | URL do servidor, sem o `/v1` |
| `--bots` | `50` | Jogadores simultâneos |
| `--minutes` | `2` | Duração |
| `--poll-ms` | `2000` | Intervalo do ciclo de cada bot (o app web usa 30.000) |

Com os limites de taxa reais (60 requisições por minuto por sessão, 10 contas por hora por IP), use poucos bots e `--poll-ms 5000` ou mais. Para um teste de carga, suba a API com `RATE_LIMIT_PER_MINUTE` e `ACCOUNT_CREATE_PER_HOUR_PER_IP` altos. Os resultados registrados estão em [docs/perf-v0.1.md](../../docs/perf-v0.1.md).

O modo remoto joga pelo `@lotg/client-sdk`, o mesmo cliente HTTP que o app web usa.

## Fumaça de concorrência contra um servidor

```bash
pnpm -s sim -- --smoke http://localhost:3000
pnpm -s sim -- --smoke http://localhost:3000 --keep
```

**Este modo escreve no servidor: cria uma conta anônima ("Bot de fumaça", nome que as consultas de playtest já ignoram) e uma partida, e no fim exclui a conta que criou.** A exclusão é a mesma do jogador (`DELETE /v1/me`): a conta é bloqueada na hora e o servidor remove os dados depois do prazo de `purgeAfter` (sete dias). Com `--keep` a conta não é excluída e continua no servidor; o relatório traz o id dela. A criação conta no limite de contas por hora por IP.

Com o `client-sdk`, o modo confere quatro garantias do caminho de um comando (GDD §14.5):

1. **Ordens em paralelo.** Dez ordens `setWorkers` diferentes, enviadas ao mesmo tempo, que juntas pedem mais gente do que o feudo tem. Cada uma precisa ser aceita ou recusada pelo motor; nenhuma resposta nem a visão final podem ter mais alocados do que aldeões; cada ordem aceita devolve uma `stateVersion` diferente; e a visão final tem, em cada edifício, o número da última ordem aceita para ele (pela ordem das `stateVersion`).
2. **Reenvio.** A mesma ordem, com o mesmo `commandId` e o mesmo payload, devolve o mesmo corpo e vem marcada com `X-Lords-Replayed`.
3. **Conflito.** O mesmo `commandId` com outro payload recebe `409 COMMAND_ID_CONFLICT` e não muda o estado.
4. **Recusa reenviada.** Uma ordem recusada pelo motor (`422 GAME_RULE`), reenviada, devolve a mesma recusa, marcada como reenvio.

O relatório sai na saída padrão, uma linha por verificação, e diz o que foi feito com a conta. O comando sai com código 1 se alguma verificação falhar, se a conta ou a partida não puderem ser criadas ou se a exclusão falhar (nesse caso o relatório avisa que a conta ficou no servidor). Uma verificação que falha não impede as outras nem a exclusão.

```text
Fumaça de concorrência em http://localhost:3000
Conta 79e8a480-… · partida 096e10e3-…
[ok]     10 ordens setWorkers diferentes em paralelo: 6 aceitas e 4 recusadas pelo motor; 5 de 5 aldeões alocados, como na última ordem aceita de cada edifício
[ok]     a mesma ordem reenviada devolve o mesmo recibo: mesmo corpo (stateVersion 12) e marca de reenvio
[ok]     o mesmo commandId com outro payload recebe 409: 409 COMMAND_ID_CONFLICT, sem efeito no estado
[ok]     uma recusa do motor reenviada devolve a mesma recusa: 422 NOT_ENOUGH_VILLAGERS nas duas vezes, com o mesmo corpo
Conta excluída; o servidor remove os dados depois de 2026-10-08T18:01:04.877Z.
Resultado: 4 de 4 verificações passaram.
```

O que foi verificado: `src/smoke.test.ts` roda o modo contra um servidor de mentira feito sobre o motor, correto e com dez defeitos diferentes, distribuídos pelas quatro garantias, e confere que cada defeito é apontado; em 2026-10-01 o modo passou contra a API local (`tsx src/main.ts`, PostgreSQL de teste, `GAME_TIME_SCALE=3`), com e sem `--keep`. O que não foi verificado: o modo nunca foi rodado contra a produção. O paralelismo é o de dez requisições simultâneas de um processo só; ele não substitui o teste de carga do modo remoto.
