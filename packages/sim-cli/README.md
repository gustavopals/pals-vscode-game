# @lotg/sim-cli

Bots de playtest que jogam partidas inteiras em segundos, só com o motor (`@lotg/engine`), sem servidor nem navegador. É por aqui que os números de `@lotg/content` são conferidos e corrigidos (GDD §15.3).

São cinco modos: uma partida em processo (`--seed`), a matriz de balanceamento (`--matrix`), a medida de desempenho do motor (`--perf`), carga contra um servidor (`--remote`) e fumaça de concorrência contra um servidor (`--smoke`). Uma opção desconhecida ou de outro modo é recusada, e não ignorada.

## Uso

```bash
pnpm -s sim -- --seed pedra-alta-golden --days 7 --strategy economico --sessions-per-day 2 > semana.csv
pnpm -s sim -- --seed pedra-alta-golden --days 7 --time-scale 3 > semana-3x.csv
pnpm -s sim -- --seed pedra-alta-001 --game-year --time-scale 3 --strategy preguicoso --sessions-per-day 1 > ano-3x.csv
pnpm -s sim -- --matrix > matriz.csv 2> matriz.md
pnpm -s sim -- --matrix --difficulty ironKing > matriz-rei-de-ferro.csv 2> matriz-rei-de-ferro.md
pnpm -s sim -- --perf
```

| Opção | Padrão | Significado |
|---|---|---|
| `--seed` | obrigatória | Semente da partida |
| `--days` | `7` | Dias reais simulados; no ritmo Normal, 7 dias são um ano de jogo |
| `--game-year` | — | No lugar de `--days`: a partida dura um ano de jogo completo, o que dá 56 h reais no ritmo 3, 7 dias no 1 e 14 dias no 0,5. Recusado em um ritmo em que o ano não fecha em horas reais inteiras |
| `--strategy` | `economico` | Bot que joga as sessões: `economico` ou `preguicoso` |
| `--sessions-per-day` | `2` | Sessões por dia real, a intervalos iguais, a primeira na criação da partida. O bot econômico prepara o feudo para o tempo até a visita seguinte (12 h com 2 sessões, 6 h com 4) |
| `--time-scale` | `1` | Ritmo: horas de jogo por hora real. Qualquer número positivo (`3`, `0.5`) |
| `--difficulty` | `lord` | Dificuldade da partida: `peasant`, `lord` ou `ironKing`. Muda o limite do estoque e a deserção por fome |

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
| `economico` | `erguer a Paliçada`, `seguir os objetivos`, `erguer a Torre`, `obra mais barata`, `ampliar o estoque`, `planejar automáticas`, `recrutar`, `responder a carta`, `alocar por demanda`, `guardar lenha` | Quem cuida do feudo a cada visita, investe no povo o que sobra, reequilibra os ofícios e deixa o feudo arrumado para o tempo que vai passar fora |
| `preguicoso` | `erguer a Paliçada`, `seguir os objetivos`, `erguer a Torre`, `obra mais barata`, `ampliar o estoque`, `planejar automáticas`, `recrutar`, `responder a carta sem gastar`, `comida primeiro`, `ocupar os livres`, `guardar lenha` | Quem passa uma vez por dia e decide o mínimo (GDD §15.2) |

| Política | O que faz |
|---|---|
| `responder a carta` | Responde a toda carta do Conselho que está na mesa (`council.pending`), como quem investe no povo o que sobra. Entre as opções pagas que o feudo alcança (`locked` e `affordable`, como a tela mostra) e que cabem **com folga**, a mais cara; no empate, a primeira da carta. Cabe com folga a opção cujo custo, em cada recurso, está entrando (`resources[].perHour` positivo), cabe três vezes no estoque e não tira o material da próxima obra (a mais barata das que só esperam recurso ou fila), a comida da reserva do recrutamento nem a madeira que a lareira vai queimar (a conta da lenha da visão); com fome, a comida não vai para carta. Sem nenhuma, a primeira opção sem custo da carta, que no conteúdo é a que não arrisca. Se a resposta deixa entrar uma continuação, responde a ela também: o bot percorre as cadeias quando tem folga e nunca deixa uma carta expirar. Vem **depois** das obras e do recrutamento na lista: o que ele gasta com o Conselho é o que sobrou da visita. Ele decide pelo custo e pelo estoque; não lê a pista nem a consequência conhecida, que a visão traz só em texto (`effectsText`) |
| `responder a carta sem gastar` | A primeira opção sem custo de cada carta, sempre: a de quem decide o mínimo. Nunca paga e nunca deixa expirar; por isso também nunca abre uma cadeia que começa por uma opção paga |
| `recrutar` | Recruta quantos aldeões couberem na ordem, guardando uma reserva de comida. Com 20 aldeões ou mais, deixa uma cama vazia nas Habitações: com as casas cheias a moral cai (`morale.terms`), e a queda custa a todos os ofícios mais do que o último par de braços rende |
| `seguir os objetivos` | Para cada Objetivo do Senhor ativo (`objectives[]`, GDD §12.2), na ordem da visão, dá o passo que ele pede, lendo só `target` e `progress`: o bot não conhece objetivo nenhum pelo id. **Um ofício**: manda para lá os aldeões livres que faltam, se houver. **Um edifício**: inicia a obra se ela pode começar agora e não gasta a madeira da lareira; senão, deixa-a planejada como automática (salvo no teto), e ela começa sozinha quando o recurso, a fila ou o nível do Salão que falta chegarem. **A lista de planejadas**: se nenhuma obra da lista começa sozinha, planeja como automática a mais barata. O recrutamento, o Conselho e a estação ficam com `recrutar`, `responder a carta` e `guardar lenha`. É o que faz a Torre de Vigia, o primeiro depósito e a Paliçada saírem cedo: o primeiro nível da Torre começa no instante em que o Salão a libera |
| `erguer a Torre` | Ergue a Torre de Vigia e a melhora, uma obra por sessão, quando ela pode começar (o Salão a libera e há fila) e **há folga**: o custo cabe duas vezes em cada recurso que ela pede, e a madeira da lareira fica onde está. O edifício é o que a visão aponta (`threat.watchtower.building`); no último nível a Torre sai da lista de obras e a política não dá mais ordem. Vem antes de `obra mais barata`: depois dela, com uma fila só, a Torre quase nunca começaria; na frente, quem a segura é a folga. O bot não usa o que a Torre mostra |
| `erguer a Paliçada` | Ergue a Paliçada e a melhora quando a Ameaça **conhecida** diz que há risco: a visão mostra uma incursão a caminho (`threat.incoming`) ou diz que a próxima virada do dia pode marcar uma (`threat.raidChancePercent` acima de zero). Sem a Torre o bot não vê nada disso e não a ergue. Não pede folga (cada incursão que passa custa comida, madeira e feridos), mas não gasta a madeira da lareira. Se a obra não pode começar por falta de recurso ou de fila, deixa-a planejada como automática, uma vez (salvo se ela gastaria a lenha do inverno); presa ao Salão ou no teto, não dá ordem. Vem antes de todas as outras obras |
| `obra mais barata` | Inicia a melhoria mais barata entre as que podem começar agora, sem contar os depósitos (Celeiro e Armazém), que são de `ampliar o estoque`, a Torre de Vigia, que é de `erguer a Torre`, nem a Paliçada (o edifício que a visão aponta em `threat.defense.building`), que ainda não tem política: ver "A Paliçada", abaixo. Com o inverno à vista, não começa a obra que gastaria a madeira da lareira: a reserva é o que a visão diz que o inverno queima menos o que a Serraria repõe |
| `ampliar o estoque` | Constrói ou melhora o depósito que vale a obra agora, do mais urgente ao menos: o que trava uma obra cujo custo não cabe no limite (`EXCEEDS_STORAGE`), o que está cheio e perdendo produção (`resources[].full` e `wastingPerHour`) e o que enche em menos de 8 horas reais (`fullInSeconds`). O edifício de cada recurso vem de `resources[].storageBuilding`. Como vem depois de `obra mais barata` e a fila é uma só, o depósito fica com a sessão em que nenhuma outra obra pôde começar; não gasta a madeira da lareira |
| `planejar automáticas` | Planeja como automáticas ("iniciar quando houver recursos") as obras que a visita não iniciou, para elas começarem sozinhas quando houver fila e recurso: primeiro o depósito que `ampliar o estoque` queria, depois as outras, da mais barata à mais cara, que é a ordem em que o motor as tenta. Entram também as que esperam o Salão ou um depósito maior (começam quando destravar); ficam de fora a obra que chegou ao teto, os depósitos que ninguém pediu, a Torre de Vigia e a Paliçada (uma automática começaria sem olhar a folga). Uma obra que começa sozinha não pergunta pela lenha: enquanto a conta da visão diz que a lareira depende do estoque (o inverno queima mais do que a Serraria repõe), o bot desmarca as planejadas que gastam madeira (`setAutoStart`) e não planeja outras; quando a conta fecha, marca de novo |
| `alocar por demanda` | Reparte os aldeões sem trocar ninguém de ofício à toa. Na fazenda, quem alimenta o feudo (contando quem ainda está chegando e duas bocas de folga) e, enquanto há vaga nas Habitações e a despensa não está cheia, um lavrador a mais: é a sobra de comida que paga os recrutas. Um fazendeiro além da conta fica onde está. Nos materiais, cada edifício recebe primeiro o que pede para o ofício não perder o que aprendeu (`workers[].occupiedFrom` enquanto a experiência sobe; um trabalhador com ela no máximo) e o resto vai em proporção ao tempo que cada um levaria para cobrir o que as obras pedem. Quem está sem ofício vai para onde mais falta gente; quem já trabalha só troca de ofício quando a falta do destino levaria mais de duas adaptações (`workersRules.adaptationSeconds`) para ser coberta com os braços que ele já tem. **Ninguém fica produzindo para o chão**: em um recurso com limite de estoque só ficam os braços cuja produção tem para onde ir até a volta do jogador (o espaço do depósito, o que as obras da lista levam, o que o feudo come ou queima); quem sobra sai na hora e vai para o material que falta ou para o ouro, que não tem limite. A fazenda segue a mesma conta, sem nunca deixar menos do que o estoque para outra ausência inteira, e o bot confere a previsão de comida do painel depois da ordem |
| `comida primeiro` | Põe na fazenda os braços que faltam para a comida não cair, contando quem está chegando; nunca tira ninguém de lá. Sem livres, busca em quem tem mais gente |
| `ocupar os livres` | Manda todos os aldeões sem ofício, em uma ordem só, para o material que mais demoraria a cobrir o que falta às obras; se nada falta, para o ofício com menos gente |
| `guardar lenha` | Quando a conta da lenha da visão diz que falta madeira (no outono, `calendar.nextSeason.firewood`; no inverno, `winter.firewood`), manda para a Serraria os braços que cobrem a falta até a estação virar: primeiro os livres, depois quem está nos outros materiais; nunca tira ninguém da fazenda. Sem falta, não dá ordem |

Entre as sessões o mundo anda sozinho. Quem chega entre duas sessões fica sem ofício até a seguinte.

**O bot sabe quando volta.** Um jogador sabe de quanto em quanto tempo abre o jogo; o bot econômico recebe esse prazo de quem o monta (`botFor(strategy, sessionsPerDay)`, em `src/bots/index.ts`: 24 horas divididas pelas sessões do dia) e arruma o feudo para ele. Não é informação do jogo: é o hábito do perfil. `strategies.economico`, sem mais nada, é o de duas visitas por dia (12 h); o modo remoto usa esse. O preguiçoso decide o mínimo e não olha o relógio.

**Uma mecânica nova entra como uma política nova** (roadmap da v0.2, §0.5): escreva a política em `policies.ts`, com teste em `bots.test.ts`, e ponha-a na lista dos bots que devem usá-la. Não é preciso mexer no simulador nem nos outros bots. As estações (V2C-T1) trouxeram `guardar lenha`, o armazenamento (V2C-T2), `ampliar o estoque`, e a segunda fila com o início automático (V2C-T5), `planejar automáticas`. A troca de ofício (V2C-T3) não trouxe uma política nova: mudou `alocar por demanda`, que era quem trocava todo mundo de ofício a cada visita. A moral (V2C-T4) também não: mudou `recrutar`, que passou a deixar uma cama vazia (ver abaixo). O Conselho trouxe `responder a carta` (V2D-T1), que desde o primeiro lote de cartas (V2D-T2) paga as opções quando há folga, e `responder a carta sem gastar`, a do preguiçoso. A Ameaça (V2E-T1) trouxe `erguer a Torre`, e a incursão de lobos (V2E-T3), `erguer a Paliçada`; ela também mudou as políticas de alocação, que passaram a não contar com os feridos.

**As obras vêm antes do recrutamento** (desde V2C-T5). Até V2C-T2 o bot recrutava primeiro, e a comida gasta em aldeões escondia dele o aviso que o jogador vê ao chegar: "Despensa cheia: comida indo ao chão. Construa o Celeiro". Com a comida abaixo do limite e um aldeão a caminho, a visão não promete "cheio em", e `ampliar o estoque` nunca pedia o Celeiro: em sete dias no ritmo 3 o Armazém chegava ao nível 8 e o Celeiro ficava no 0. Enquanto o feudo crescia devagar isso não custava nada. Com as obras começando sozinhas ele cresce depressa, e o perfil Regular no ritmo 3 chegava ao terceiro inverno com 58 aldeões e a Despensa de 500: **6 horas reais de fome**. Olhando o painel antes de recrutar, o bot ergue o Celeiro e a fome some (a medição das duas ordens está em [docs/balance-v0.2.md](../../docs/balance-v0.2.md), seção 5.5).

**Trocar de ofício custa, e o bot econômico deixou de refazer a alocação a cada visita** (desde V2C-T3). Quem chega a um edifício rende metade por um dia de jogo, e um edifício vazio perde a experiência do ofício. Com a política antiga nas regras novas, o Regular do ritmo 3 trocava 53 trabalhadores de ofício em uma semana e o Dedicado, 194; com a nova, 5 e 26, e todos os ofícios dos materiais chegam à experiência máxima. O bot faz a conta dos fazendeiros com o que um lavrador rende adaptado (`perWorkerPerHour`): logo depois de uma troca a comida pode cair por um dia de jogo, até a adaptação terminar. O `preguicoso` não mudou: ele nunca tirou ninguém do lugar sem necessidade.

**O bot econômico planta para crescer** (desde V2C-T3). Até aqui ele vivia da folga de duas bocas e do arredondamento da conta dos fazendeiros, e quanto sobrava para recrutar era sorte. Com a experiência do ofício um lavrador passou a bastar onde eram dois, a sobra sumiu, e o perfil Dedicado no ritmo 0,5 caía de 22 para 15 aldeões: jogar mais vezes dava um feudo menor. Com um lavrador a mais enquanto há vaga, o mesmo perfil chega a 61, e o Regular do ritmo 1 vai de 45 a 68. Foi uma mudança de bot, medida à parte da mecânica em [docs/balance-v0.2.md](../../docs/balance-v0.2.md), seção 6.4, para o salto não ser lido como efeito da regra.

**A moral: uma cama vazia rende mais do que guardar a despensa** (desde V2C-T4). A moral dá dois motivos para o bot mudar de hábito: as casas cheias tiram 10 pontos (5% da produção de tudo) e a comida guardada para 24 h de jogo dá 10. Os dois foram medidos (as tabelas estão em [docs/balance-v0.2.md](../../docs/balance-v0.2.md), seção 7.3):

- **Deixar uma cama vazia** a partir de 20 aldeões custa um aldeão (74 no lugar de 75) e rende até 7% a mais de materiais por hora nos perfis que enchem as casas. Entrou em `recrutar`. Abaixo de 20 aldeões um par de braços vale mais do que os 5%, e o bot enche as casas.
- **Segurar o recrutamento para não gastar a reserva** custou caro: cada recruta passava a pedir 74 de comida no lugar de 50, e o perfil Regular do ritmo Tranquilo caía de 55 para 37 aldeões em uma semana. **Não entrou.** Pôr um lavrador a mais só para encher a despensa deu resultados mistos (melhor em duas células, pior em três) e também não entrou. A comida guardada vem sozinha quando o crescimento passa a ser limitado pelas casas, e é o que acontece no ritmo Rápido, onde a moral dos bots fica em 60 quase o tempo todo; nos ritmos lentos ela fica perto de 50.

Nenhum bot deixa a moral chegar a 25: nenhuma partida da matriz perde um aldeão, e o sorteio da moral nunca é usado nelas. O que a mecânica tira de quem abandona o feudo é medido à parte (seção 7.4 do mesmo documento).

**Ninguém produz para o chão** (desde V2C-T7). Até a rodada de balanceamento da Fase C o bot econômico repartia os braços pelo que as obras pediam sem olhar se o depósito comportava: no ritmo Rápido o perfil Regular perdia 70% da madeira que cortava, e a meta de desperdício do GDD §15.2 falhava em cinco das seis células. Era o bot jogando mal (o painel manda tirar gente do ofício que enche), e foi ele que mudou: `alocar por demanda` passou a limitar cada ofício ao que cabe na ausência. O desperdício do Regular caiu a 2% no ritmo Rápido e a zero nos outros, com a mesma população e o mesmo Salão, e o que ia ao chão virou ouro. O custo são mais trocas de ofício (até uma a cada dez trabalhadores por visita, que é o que o teste cobra). Quando o feudo não tem mais o que construir, o bot esvazia os ofícios que só encheriam o depósito e manda todos para a Mina. As medidas, e as variantes que não entraram, estão em [docs/balance-v0.2.md](../../docs/balance-v0.2.md), seção 9.2.

**O depósito, para os bots, é meio e não fim.** Estoque além do custo da próxima obra não compra nada: os bots erguem o depósito quando ele trava uma obra, quando está cheio e perdendo produção ou quando enche em menos de uma noite, e depois da obra mais barata. Até V2C-T2, com uma fila só e uma obra por visita, isso era raro (só o Dedicado chegava ao Armazém em uma semana); com as planejadas automáticas o depósito que não pôde começar na visita fica na lista e começa sozinho, e todos os perfis passam a ter Celeiro e Armazém. A produção que não cabe continua indo ao chão, e a matriz mede quanto. Uma primeira versão da política ampliava o depósito **antes** da obra mais barata; a cada visita havia um depósito enchendo, a fila ia para ele, e o Regular terminava a semana com o Salão um nível abaixo e nove aldeões a menos. A medição das duas ordens está em [docs/balance-v0.2.md](../../docs/balance-v0.2.md), seção 4.

**A lenha continua sem apertar nenhum bot**: nenhuma partida da matriz passa frio, em nenhuma dificuldade. Enquanto há obra a fazer, a Serraria repõe mais do que a lareira queima (no ritmo 3, 64 aldeões queimam 768 de madeira no inverno e a Serraria no nível 8 entrega várias vezes isso). Com as obras esgotadas o bot esvazia a Serraria, e a lareira passa a queimar do estoque: o Armazém cheio (5.100 em Senhor) cobre mais de três invernos de 74 aldeões, e `guardar lenha` devolve lenhadores quando a conta da visão diz que falta. `guardar lenha` é provada em `bots.test.ts` com feudos sem madeira, inclusive contra o motor, e `planejar automáticas`, com a conta da lenha apertada.

**A Paliçada: quando os vigias dizem que há risco** (desde V2E-T3). `erguer a Paliçada` é a política "Paliçada quando a Ameaça conhecida passa de 40" do roadmap, sem o número: o bot a ergue (e a melhora) quando a visão mostra uma incursão a caminho (`threat.incoming`) ou diz que a próxima virada do dia pode marcar uma (`threat.raidChancePercent` acima de zero). **Sem a Torre o bot não sabe de nada, como o jogador, e não a ergue.** Ao contrário da Torre, ela não pede folga: cada incursão que passa leva parte da comida e da madeira e fere gente. Sem recurso ou sem fila, a obra fica planejada como automática (salvo a que gastaria a madeira da lareira); presa ao Salão ou no teto, não há o que fazer. Ela vem **antes** de todas as obras: com uma fila só, a defesa passa na frente. Com isso a Paliçada deixou de contar como obra parada à toa, e o **fim das obras** passou a esperar por ela. O **pedido dos aldeões** ("A Promessa da Paliçada") continua sendo respondido com a primeira opção sem custo, que é explicar que não é hora: as duas continuações da cadeia nunca aparecem no simulador (`src/coverage.test.ts` guarda isso, para o dia em que um bot aprender a prometer).

**Quem os lobos feriram não é braço** (desde V2E-T3). As políticas de alocação contam os habitantes que podem trabalhar (`population.villagers` menos `population.injured`): o ferido come como os outros, mas uma ordem que contasse com ele seria recusada. Ele volta sozinho ao ofício que tinha, e a visita seguinte reequilibra o resto.

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
| `townHall` … `palisade` | Nível de cada edifício; `granary`, `warehouse`, `watchtower` e `palisade` começam em 0 (ainda não construídos) |
| `famine` | `1` se o feudo está com fome naquela hora |
| `cold` | `1` se o feudo passa frio naquela hora: é inverno e a madeira da lareira acabou. Fica entre as colunas das mecânicas, no fim da linha |
| `queue_idle` | `1` se ao menos uma obra poderia começar agora (o que exige uma fila livre: com a segunda fila aberta e vazia, uma obra em curso não desfaz a ociosidade): o feudo tinha o que construir e esperou a próxima visita |
| `planned_idle` | O mesmo, contando só as obras que o jogador deixou planejadas. O início automático (V2C-T5) zera esta coluna: uma planejada automática que pode começar não fica na lista |
| `commands_accepted`, `commands_refused` | Ordens aceitas e recusadas pelo motor, acumuladas desde a criação da partida |
| `refused_by_code` | As recusas por motivo, acumuladas: `HOUSING_FULL:1;QUEUE_BUSY:2`. Vazio sem recusas |

**Colunas das mecânicas.** O cabeçalho termina com as colunas das mecânicas da v0.2, em ordem fixa, para o formato não mudar a cada mecânica (`MECHANIC_COLUMNS`, em `src/report.ts`). As que ainda ninguém mede saem **vazias** (e não zero: zero seria uma medida) e formam `RESERVED_COLUMNS`; a tarefa de cada uma a acrescenta a `MEASURED_COLUMNS`, lendo da visão, e ela sai da lista das reservadas sem mudar de lugar. Com a incursão de lobos (V2E-T3) todas as colunas da v0.2 passaram a ser medidas, e `RESERVED_COLUMNS` está vazia.

| Coluna | Significado | Tarefa |
|---|---|---|
| `wasted_food`, `wasted_wood`, `wasted_stone` | **Medidas desde V2C-T2.** O que não coube no depósito, por recurso, em unidades e acumulado (o ouro não tem limite): o que os eventos `storageWasted` relataram mais o que a visão mostra como ainda não relatado (`wastedToday`). No CSV da matriz, o total da partida | V2C-T2 |
| `cold` | **Medida desde V2C-T1.** No CSV de uma partida, `1` se o feudo passa frio naquela hora; no da matriz, as horas de frio da partida | V2C-T1 |
| `morale` | **Medida desde V2C-T4.** No CSV de uma partida, a moral do feudo naquela hora, de 0 a 100; no da matriz, a menor moral da partida | V2C-T4 |
| `cards_seen`, `cards_answered`, `cards_expired` | **Medidas desde V2D-T1.** Cartas do Conselho que chegaram (por sorteio ou como continuação), que o bot respondeu e que expiraram sem resposta, contadas dos eventos e acumuladas; no CSV da matriz, o total da partida | V2D-T1 |
| `threat` | **Medida desde V2E-T1.** No CSV de uma partida, a Ameaça do feudo naquela hora, de 0 a 100, **lida do estado**: o simulador mede o mundo, e a visão só a mostra a quem tem a Torre de Vigia (o bot continua sem vê-la). No da matriz, a maior da partida | V2E-T1 |
| `wolf_losses` | **Medida desde V2E-T3.** A comida e a madeira que as incursões de lobos levaram, somadas, em unidades inteiras e acumuladas, dos eventos `raidSuffered` (`raided_<recurso>`); no CSV da matriz, o total da partida | V2E-T3 |
| `raids_suffered`, `raids_repelled`, `villagers_injured` | **Medidas desde V2E-T3.** Incursões sofridas, incursões repelidas e aldeões feridos, contados dos eventos e acumulados; no CSV da matriz, o total da partida | V2E-T3 |
| `objectives_done` | **Medida desde V2E-T4.** Objetivos do Senhor concluídos, como a visão os mostra, acumulados; no CSV da matriz, os da partida (e `objectives_done_hour`, entre as colunas de progresso, traz a hora real em que a sequência inteira ficou cumprida; vazia enquanto falta algum) | V2E-T4 |

O resumo, na saída de erro, traz:

```text
Semente pedra-alta-golden · estratégia economico · 7 dias · 2 sessões/dia · ritmo 3×
Partida: Senhor · Rápido: um ano em 56 horas
Motor 0.1.0 · estado v11 · conteúdo 10164e0ffb6b06e8
Políticas: erguer a Paliçada, seguir os objetivos, erguer a Torre, obra mais barata, ampliar o estoque, planejar automáticas, recrutar, responder a carta, alocar por demanda, guardar lenha
População: 72 de 75 vagas (mínima 7)
Níveis: townHall 7, farm 8, lumberMill 8, quarry 8, goldMine 8, housing 8, granary 7, warehouse 8, watchtower 2, palisade 2
Progresso: Salão Nv2 na hora 11, Salão Nv3 na hora 25, Salão Nv4 na hora 40, Celeiro na hora 15, Armazém na hora 26, Torre de Vigia na hora 20, Paliçada na hora 27 · 51 obras começaram sozinhas · as obras acabaram na hora 125: nada mais a construir
Objetivos: 10 de 10 concluídos, o último na hora 56
Estoque: food 3844, wood 3654, stone 4801, gold 150390
Fome: nenhuma
Frio: nenhum
Moral: 60 no fim, mínima 40 (2 h com o povo inquieto ou desesperado)
Conselho: 28 cartas (8 continuações) · 26 respondidas, 0 expiradas · 6 efeitos escondidos
Ameaça: 100 no fim (máxima 100) · Torre de Vigia Nv2, erguida na hora 20
Lobos: 9 incursões sofridas, 44 repelidas (50 anunciadas pela Torre) · levaram food 490, wood 77 · 14 feridos · Paliçada Nv2, erguida na hora 27
Fila ociosa: 72 h com obra que podia começar (0 h com obra planejada)
Sem o início automático (as mesmas planejadas, manuais): 168 h com obra que podia começar (168 h com obra planejada)
Aldeões sem ofício: 819 aldeão-horas (4,9 por hora)
Excedente parado: wood 3654, stone 4801, gold 150390
Desperdício: food 3067, wood 612, stone 0 (15 h com depósito cheio perdendo produção)
Da produção de cada recurso, foi ao chão: food 10%, wood 1%, stone 0%
Maior sequência desperdiçando, em horas de jogo: food 21, wood 6, stone 0 (meta do GDD §15.2 para 2 sessões por dia: até 8)
Comandos: 168 aceitos, 0 recusados
```

- A terceira linha **identifica o jogo medido**: versão do motor, versão do estado e `contentHash`, o mesmo de `GET /v1/version` (os dois saem de `contentHash`, em `@lotg/protocol`). Dois resumos só se comparam número a número quando essa linha é igual.
- **A linha "Sem o início automático"** é a partida de controle: a mesma semente e o mesmo bot, com as planejadas entrando como manuais (`simulate({ ..., manualPlans: true })`), como era antes de V2C-T5. O comando joga as duas e põe a fila ociosa de uma ao lado da da outra: é o que a mecânica mudou para aquele perfil de visita. O CSV é o da partida de verdade.
- **A linha do progresso** traz a hora real, desde a fundação, em que o Salão chegou aos níveis 2, 3 e 4 (o 4 abre a segunda fila de obras) e em que o Celeiro, o Armazém, a Torre de Vigia e a Paliçada ficaram de pé (`MILESTONES`, em `src/report.ts`); "não alcançado" quando a partida não chegou lá. Depois, quantas obras começaram sozinhas (as planejadas automáticas) e **quando as obras acabaram**: a primeira hora da sequência final em que o feudo não tem nada em obras e nada por fazer (tudo no teto, preso ao Salão que não sobe ou com o custo acima do que o depósito guarda). Um depósito que ninguém planejou e que não trava obra nenhuma não conta como obra por fazer. A linha da população diz também a menor que o feudo teve.
- **A linha dos objetivos** diz quantos Objetivos do Senhor o bot concluiu, de quantos a sequência tem, e a hora real em que concluiu o último (`Objetivos: 9 de 10 concluídos` quando falta algum). O último é o do inverno sem frio, que só cai na virada para a primavera: a partida de um ano de jogo o conclui na última hora.
- **A linha da moral** diz a do fim da partida e a menor que o feudo teve. Quando há o que contar, diz também as horas com o povo inquieto ou desesperado e quem a moral e a fome moveram: `Moral: 0 no fim, mínima 0 (58 h com o povo inquieto ou desesperado) · colonos 0, partidas 1, deserções 1`.
- **A linha da Ameaça** diz a do fim da partida e a maior que o feudo teve, lidas do estado, e a Torre de Vigia: o nível final e a hora em que foi erguida, ou `sem Torre de Vigia: o jogador nunca a viu`. Cada incursão a faz cair 10, mas ela sobe 15 nos três dias de jogo entre o sorteio e a chegada: toda partida de um ano de jogo passa pelos 100 e termina entre 90 e 100 ([docs/balance-v0.2.md](../../docs/balance-v0.2.md), seção 14).
- **A linha dos lobos** conta, dos eventos, as incursões sofridas e as repelidas, quantas a Torre anunciou antes, o que os lobos levaram de cada recurso (em unidades), os feridos, e a Paliçada: o nível final e a hora em que foi erguida, ou `sem Paliçada`. Sem incursão nenhuma: `Lobos: nenhuma incursão`.
- **Os três sinais de tédio** (roadmap, V2B-T4): a fila ociosa, os aldeões sem ofício e o excedente parado dizem que o jogo não pediu nada ao jogador. As horas são reais, uma amostra ao fim de cada hora. "Aldeão-horas" é a soma, hora a hora, dos aldeões sem ofício. O excedente parado é o estoque final de madeira, pedra e ouro, cada um por si e nunca somados; a comida fica de fora porque é consumida. Com os limites, o da madeira e o da pedra nunca passam do limite do depósito.
- **O desperdício** é o que a produção e os ganhos deixaram de pôr no estoque porque ele estava no limite, por recurso, na partida inteira; entre parênteses, as horas com ao menos um depósito cheio e perdendo produção. A linha seguinte diz **quanto da produção de cada recurso foi ao chão**, em por cento: o desperdício sobre a produção bruta do mesmo recurso, somada hora a hora (`workers[].grossPerHour` ao fim de cada hora: é uma aproximação). Cada recurso por si, nunca somados; sem produção, "não se aplica".
- **A maior sequência desperdiçando** é a medida da meta do GDD §15.2, como o ADR 0013 (decisão 17) a lê: "nenhum recurso desperdiçando no cap por mais de 8 h de jogo contínuas", no perfil Regular. Para cada recurso, é a maior sequência de horas reais seguidas em que o desperdício acumulado subiu (a coluna `wasted_<recurso>` do CSV: quem tem o CSV refaz a conta), **vezes o ritmo**: 55 horas reais no ritmo 3 são 165 horas de jogo. A hora conta inteira quando o acumulado sobe ao menos uma unidade dentro dela, então a medida arredonda para cima as pontas da sequência (até uma hora real em cada ponta: no ritmo 3, até 6 h de jogo) e não vê um desperdício menor que uma unidade por hora real. A meta e o perfil que ela cobra estão em `WASTE_STREAK_GOAL` (`src/report.ts`); a linha aparece em toda partida, e a meta vale para a de 2 sessões por dia.
- Um bot bem escrito não tem comando recusado; se tiver, os códigos vêm entre parênteses.

## Cobertura do Conselho

`src/coverage.ts` mede, a partir dos eventos e das linhas por hora de um conjunto de partidas, o que o catálogo de cartas entrega (roadmap da v0.2, V2D-T2.5): quantas cartas chegam por ano, de quantos modelos, em que estação e com o Salão em que nível, quantas audiências são puladas com a mesa cheia e se alguma ficou sem carta **por falta de assunto** (lugar na mesa e nenhuma carta elegível). `src/coverage.test.ts` joga um ano de jogo do perfil Regular nas 50 sementes da matriz, no ritmo Normal e no Rápido, e falha se alguma audiência ficar sem assunto, se uma carta do catálogo nunca aparecer ou se as cadeias deixarem de ser percorridas.

```bash
SHOW_COVERAGE=1 pnpm --filter @lotg/sim-cli test -- coverage   # imprime as tabelas
```

As tabelas desta medida estão em [docs/content-v0.2.md](../../docs/content-v0.2.md), seção 4. A elegibilidade em si (quantas cartas o sorteio tem ao alcance em cada estação e nível do Salão) é regra do motor e é medida lá (`packages/engine/src/council.coverage.test.ts`): o simulador só vê o que a partida mostrou.

## Matriz de balanceamento

```bash
pnpm -s sim -- --matrix > matriz.csv 2> matriz.md   # as 50 sementes, em Senhor; cerca de 23 s
pnpm -s sim -- --matrix --difficulty peasant > camponês.csv 2> camponês.md
pnpm -s sim -- --matrix --seeds 5 > /dev/null       # só as 5 primeiras: uma olhada rápida
```

A matriz do roadmap da v0.2 (§7.3) joga, na dificuldade pedida (o padrão é Senhor; a rodada completa são três comandos, um por dificuldade):

- **três perfis de visita** (GDD §15.2): Preguiçoso, 1 sessão por dia real, com o bot `preguicoso`; Regular, 2 sessões, com o `economico`; Dedicado, 4 sessões, com o `economico`;
- **cada ritmo que o jogo oferece** (`balance.paces`): hoje 3, 1 e 0,5;
- **50 sementes fixas**: `pedra-alta-001` a `pedra-alta-050`;
- **duas janelas, em tabelas separadas**, porque não têm o mesmo denominador: **7 dias reais** (em que o ritmo 3 atravessa três anos de jogo e o 0,5, meio ano) e **um ano de jogo** (56 h reais no ritmo 3, 7 dias no 1, 14 dias no 0,5). No ritmo 1 as duas são a mesma partida, jogada uma vez.

O CSV, na saída padrão, tem uma linha por partida (janela, ritmo, perfil, semente) com os valores finais, as medidas de progresso (`villagers_min`, `town_hall_2_hour` a `town_hall_4_hour`, `granary_hour`, `warehouse_hour`, `watchtower_hour`, `palisade_hour`, `exhausted_hour`, `auto_started`, `objectives_done_hour`, `villagers_lost`; vazio é "não chegou"), o desperdício de cada recurso (`waste_streak_<recurso>` em horas de jogo, `wasted_<recurso>_percent`) e as mesmas colunas das mecânicas (`cold`, aqui, são as horas de frio da partida, `wasted_*`, o desperdício total, `morale`, a menor moral da partida, `threat`, a maior Ameaça, e `wolf_losses`, `raids_suffered`, `raids_repelled` e `villagers_injured`, os totais das incursões, e `objectives_done`, os objetivos concluídos). As tabelas, na saída de erro, saem em Markdown, prontas para [docs/balance-v0.2.md](../../docs/balance-v0.2.md):

- a identificação da rodada;
- por janela, **as medidas** (o menor e o maior valor entre as sementes em cada célula, com a menor moral, as horas de moral baixa, os aldeões que foram embora, o desperdício de cada recurso e as horas com depósito cheio perdendo produção ao lado do excedente parado), **as faixas cobradas**, **o progresso** (a hora real do Salão nos níveis 2, 3 e 4, do Celeiro, do Armazém, da Torre de Vigia e da Paliçada, o fim das obras, as obras que começaram sozinhas, a menor população, os Objetivos do Senhor concluídos e a hora do último; "—" é "não chegou"), **o desperdício por recurso** (a parte da produção que foi ao chão e a maior sequência de cada um) e **os lobos** (as incursões sofridas e repelidas, as anunciadas pela Torre, os feridos, a comida e a madeira levadas e a Ameaça no fim);
- o veredito e a **meta de desperdício**: as células do perfil Regular, a maior sequência desperdiçando cada recurso em horas de jogo e se ela cabe nas 8 h da meta. A meta não é faixa: uma célula acima dela aparece como **acima** e não reprova a rodada;
- a linha de base no formato de `bands.ts`.

O comando sai com código 1 se alguma partida ficar fora da faixa. **As três dificuldades têm faixa** desde a rodada de balanceamento da Fase C (V2C-T7): `--difficulty peasant` e `--difficulty ironKing` conferem as partidas contra a linha de base da própria dificuldade.

**As sementes trabalham desde o Conselho (V2D-T1).** A moral só sorteia com 80 ou mais (o colono) ou com 25 ou menos (a partida), e os feudos dos bots vivem entre 35 e 60; até a Fase C, por isso, as 50 sementes davam a mesma partida. Com o Conselho, a carta que chega em cada audiência depende da semente, e as células passaram a ter faixa de verdade. Desde o primeiro lote de cartas (V2D-T2) o bot econômico paga as opções das cartas quando tem folga, e cada semente dá uma partida diferente: a população do Regular no ritmo Normal vai de 64 a 72. Um teste confere que as sementes divergem (`matrix.test.ts`).

### Faixas

`src/bands.ts` guarda a **linha de base medida** de cada célula, em cada dificuldade (tabela `MEASURED`), e a regra que faz dela uma faixa (`SLACK`):

| Grandeza | Faixa |
|---|---|
| População final | De 10% abaixo do menor a 10% acima do maior valor medido |
| Salão do Senhor | Pelo menos o menor nível medido |
| Horas de fome | No máximo o maior valor medido, com 5% de folga (hoje, zero em toda célula) |
| Horas de frio | No máximo o maior valor medido, com 5% de folga (hoje, zero em toda célula) |
| Moral mínima, horas de moral baixa, aldeões que foram embora | Medidos e relatados, sem faixa: com zero horas de fome e de frio, nenhuma partida chega à moral que leva gente embora |
| Excedente parado de madeira, de pedra e de ouro | No máximo o maior estoque final medido, com 5% de folga. Só tem teto: sobrar menos nunca é problema |
| Maior sequência desperdiçando um recurso (o pior da partida), em horas de jogo | No máximo o maior valor medido, com 5% de folga. É guarda de regressão, não a meta: a meta de 8 h do perfil Regular é conferida à parte (`wasteGoalCells`, em `src/matrix.ts`), e `balance.test.ts` guarda, célula a célula, quais a cumprem (as do ritmo Tranquilo) e quais passam dela e por quanto (as do ritmo Rápido e, desde V2D-T2, a do Normal, por uma semente em 50) |
| Ordens recusadas | Nenhuma |

`src/balance.test.ts` joga a cada `pnpm test` a matriz inteira de Senhor (750 partidas distintas) e as de Camponês e de Rei de Ferro com as 3 primeiras sementes (as 50 das outras duas rodam pelo comando). Desde o Conselho (V2D-T1) a semente muda a partida: a carta que chega primeiro depende dela, e a resposta do bot desloca um pouco o caminho de obras. Com as cartas do primeiro lote (18 em V2D-T2; 21 desde V2E-T2) e o bot econômico pagando as que cabem com folga, cada semente segue o seu caminho de obras, e as faixas ficaram mais largas. São cerca de 35 s, o arquivo mais lento da suíte de unidade. Ele falha se alguma partida sair da faixa, dizendo a célula, o problema com os dois números e em quantas sementes ele apareceu. Cobra também, em cada dificuldade, zero horas de fome e de frio, o caminho de compras até o Salão no nível 4, o Celeiro e o Armazém (em Senhor, no ritmo Rápido, três sementes deixam o Armazém para logo depois do ano de jogo) e, desde V2E-T4, **os dez Objetivos do Senhor concluídos em um ano de jogo** por toda semente do Regular e do Dedicado. A fila ociosa, os aldeões sem ofício, o fim das obras e a parte da produção perdida são medidos e relatados, sem faixa.

**Estes limites são o jogo como ele está, não metas aprovadas pelo autor** ([ADR 0013](../../docs/decisions/0013-regras-da-v0.2-tempo-ritmo-migracao-e-economia.md), decisão 5): servem de guarda de regressão até o autor apertá-los. Quando uma faixa falhar:

1. Se a mudança **não** pretendia mexer na economia, é uma regressão: ajuste os números em `@lotg/content`, nunca o bot.
2. Se a mudança é uma mecânica que muda a economia de propósito, a linha de base é regravada de propósito, como um golden: rode `pnpm -s sim -- --matrix` em cada dificuldade, confira o que mudou e por quê, copie o bloco "Linha de base medida nesta rodada" de cada uma para `MEASURED` e registre a rodada, com as tabelas, em `docs/balance-v0.2.md`. Nada regrava a linha de base sozinho.

A matriz já pesa na suíte. Se passar a incomodar, o primeiro corte é nas sementes de Senhor; a matriz completa continua saindo pelo comando.

## Desempenho do motor em ausências longas

```bash
pnpm -s sim -- --perf
```

Mede, no ritmo 3, quanto custa a volta de quem ficou fora 1, 7 e 30 dias reais: um `advanceTo` só, do instante da saída ao da volta (36 viradas de dia de jogo por dia real), e um `deriveViewState` no estado que ele deixa. São três feudos (`PERF_SCENARIOS`, em `src/perf.ts`): o recém-fundado sem ordem nenhuma, o de 2 dias reais e o de 7 dias reais do bot econômico. A tabela, em Markdown na saída padrão, traz a mediana e o pior tempo de 9 repetições (depois de duas de aquecimento), os eventos emitidos, o tamanho do estado e da visão em bytes de JSON e os habitantes na volta. É tempo de processo, sem banco nem rede: o que o servidor acrescenta é medido em `packages/server/test/long-absence.test.ts`. Os números registrados estão em [docs/balance-v0.2.md](../../docs/balance-v0.2.md), seção 9.7; o teste (`src/perf.test.ts`) confere só a forma, e nenhum tempo.

## Modo remoto: carga contra um servidor

```bash
pnpm -s sim -- --remote http://localhost:3000 --bots 50 --minutes 2 --poll-ms 2000
```

Cada bot cria uma conta anônima e uma partida e joga pela API com o `client-sdk`, como o app web: `GET /view` com `If-None-Match`, `GET /events?after=` e as ordens do bot (o econômico joga como quem volta em 12 horas, qualquer que seja o ciclo do teste). O relatório traz chamadas, p50, p95 e máximo por endpoint, e o comando sai com erro se houver respostas 5xx ou 429.

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
