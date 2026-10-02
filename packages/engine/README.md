# @lotg/engine

O motor de Lords of the Guild: funções puras e determinísticas que decidem tudo o que acontece no feudo. Roda igual no servidor (a verdade), no `sim-cli` (balanceamento) e nos testes. Não conhece banco, rede, relógio do sistema nem navegador.

## API pública

```ts
createInitialState(seed: string, settings: GameSettings): GameState
migrateState(stored: unknown, context: { timeScale: number }): GameState
nextEventAt(state: GameState): number | null
advanceTo(state: GameState, gameTimeMs: number): { state: GameState; events: GameEvent[] }
applyCommand(state: GameState, command: Command, gameTimeMs: number): CommandResult
deriveViewState(state: GameState, gameTimeMs: number, options?: { timeScale?: number }): ViewState
```

`GameSettings` é `{ settlementName, timezone, vigilHourLocal, difficulty, timeScale }`: a dificuldade (`peasant`, `lord`, `ironKing`) e o ritmo ficam gravados no estado e não mudam durante o ano. A visão os devolve prontos para exibir, em `settlement`: `difficulty`, `difficultyLabel` ("Senhor") e `paceLabel` ("Rápido: um ano em 56 horas").

Além delas, o pacote exporta só os tipos (entre eles `FirewoodView`, a conta da lenha que a visão traz), a lista `REJECTION_CODES`, `CURRENT_SCHEMA_VERSION` e a classe `StateMigrationError`. Um teste (`purity.test.ts`) falha se qualquer outra coisa vazar.

## O ciclo

```
advanceTo(estado, agora)  →  applyCommand(estado avançado, comando, agora)  →  deriveViewState(estado, agora)
```

1. **`advanceTo`** leva o estado até um instante de jogo, em milissegundos. Percorre a linha do tempo trecho a trecho: aplica a produção contínua até o próximo evento discreto (`nextEventAt`), processa os eventos daquele instante e repete. Devolve o estado novo e os eventos, cada um já com a frase da Crônica. Antes de o tempo andar, acomoda fome e frio no instante em que o estado está: em um estado em repouso isso não muda nada; em um que acabou de ser migrado, é onde uma regra nova abre o que tem de abrir, na fronteira (ver "Estações, lenha e frio").
2. **`applyCommand`** é a única outra forma de mudar o estado. Exige o estado já avançado até o instante do comando (`state.lastProcessedAt === gameTimeMs`); violar isso lança erro, porque é falha de quem chamou. Uma recusa de regra nunca lança: devolve `{ ok: false, code, message }`, com a mensagem em português, e não altera nada. O chamador fica com o estado que saiu de `advanceTo` e pode persisti-lo mesmo na recusa.
3. **`deriveViewState`** calcula tudo que a interface exibe, com a explicação de cada número. Se receber um instante futuro, avança uma cópia antes de derivar. A visão fala em **tempo real**: no ritmo da partida (`state.settings.timeScale`, horas de jogo por hora real), os prazos saem em segundos reais, arredondados para cima (`depletesInSeconds` e `famine.secondsElapsed`, para baixo), e as taxas por hora, multiplicadas pelo ritmo, inclusive nos textos de explicação. `options.timeScale` só serve para ver o mesmo estado em outro ritmo (o simulador e os testes usam). O resto do motor continua em tempo de jogo ([ADR 0011](../../docs/decisions/0011-ritmo-3x-no-mvp.md)).

   `settlement.paceLabel` acompanha o ritmo em que a visão foi escrita (`src/pace.ts`). Para um ritmo de `balance.paces`, é o rótulo e a descrição do conteúdo. Para qualquer outro (uma partida da v0.1 criada com outro `GAME_TIME_SCALE`), é um rótulo calculado, sem o nome de nenhum dos oferecidos: "Ritmo 7×: um ano em 1 dia", pela conta ano de jogo ÷ ritmo, com "cerca de" quando a frase arredonda. Um teste confere que essa conta dá, para cada ritmo oferecido, a frase que o conteúdo escreve.

Antes de tudo isso, quem carrega um estado gravado passa por **`migrateState`** (ver "Versões do estado e migração").

Nenhuma função muta a entrada.

## Invariantes

- **Divisão de intervalo exata.** `advanceTo(t2)` dá o mesmo estado e os mesmos eventos que `advanceTo(t1)` seguido de `advanceTo(t2)`, para qualquer `t1` no meio, com igualdade estrita. O estado inclui o do gerador de sorteios: avançar de uma vez ou em dez pedaços sorteia igual. É o que permite ao servidor calcular às 23:00 o que aconteceu às 20:00.
- **Só inteiros no estado**, com uma exceção: `settings.timeScale`, o ritmo, que pode ser 0,5. Ele não entra em conta contínua nenhuma: converte um prazo de tempo real em tempo de jogo no instante em que o prazo nasce, e tempo de jogo em tempo real na visão. Recursos ficam em milésimos. A produção acumula `taxa × ms` em `accumulators` e só a parte inteira de `acumulador / 3.600.000` vai para o estoque; o resto fica guardado para o próximo trecho. Nada é arredondado e descartado.
- **Recursos nunca negativos.** O instante em que a comida acaba é um evento da linha do tempo, calculado em inteiros; a fome começa exatamente nele. O mesmo vale para a madeira que a lareira queima no inverno: no instante em que ela acaba começa o frio.
- **Ordem fixa dentro do mesmo instante** (`processEventsAt`, em `advance.ts`): obras concluídas, aldeões que chegam, virada de ano, de estação e de dia, objetivos, e por fim fome e frio, nessa ordem (`settleScarcity`). Todo comando termina no mesmo acerto de fome e frio.
- **Estado em repouso.** Depois de um instante processado ou de um comando, nem a fome nem o frio têm mais o que abrir ou fechar, e por isso `nextEventAt` é sempre depois de agora: nenhum instante é processado duas vezes.
- **A produção é uma conta só.** `productionRate` multiplica os fatores de `productionFactors` (nível, estação, fome, frio) em frações e arredonda para baixo uma vez, no fim. A visão escreve um termo da explicação para cada fator da mesma lista. Um fator novo (moral, mestria, adaptação) entra na lista e aparece nos dois lugares.
- **Nenhum número de jogo aqui.** Custos, taxas, tempos e textos vêm de `@lotg/content`.
- **Valores derivados não são guardados:** capacidade habitacional, aldeões livres e taxas saem de funções puras.

A fome congela a fila de recrutamento e recusa ordens novas; a produção cai para 3/4. Ela termina no primeiro instante em que o saldo de comida, já com essa penalidade, volta a ser positivo, e a fila é retomada de onde parou.

## Estações, lenha e frio

Os números são os de `balance.calendar.seasons[].effects` e `balance.winter` (GDD §4.1; [ADR 0013](../../docs/decisions/0013-regras-da-v0.2-tempo-ritmo-migracao-e-economia.md), decisões 13 e 13a). O motor não conhece o nome de estação nenhuma: lê os efeitos da que está em vigor em `lastProcessedAt`.

- **Produção.** O fator da estação é um dos fatores de `productionFactors` e vale a partir do instante exato da virada: toda virada de dia já é um evento da linha do tempo, então nenhum trecho atravessa uma estação.
- **Prazos.** O fator de duração é aplicado quando o prazo nasce e fica gravado em `finishesAtMs`: uma obra iniciada no inverno (`upgradeDurationAt`) e um recrutamento ordenado na primavera (`recruitmentDurationMs`, para a ordem inteira). Nada é recalculado na virada. Na obra, o fator entra antes do teto de 8 h.
- **Lenha.** `firewoodRate` é a madeira queimada por hora de jogo (`firewoodPerVillagerPerHour` × habitantes) e entra no saldo da madeira em `netRates`, como o consumo entra no da comida. `woodRunsOutIn` é o instante em que ela acaba, um candidato de `nextEventAt`.
- **Frio** (`settlement.cold = { sinceMs }`, em `cold.ts`). Abre quando a madeira não cobre nem mais um milissegundo de lenha; o estoque e o resto são zerados, e dali em diante a madeira não fica negativa (`applyContinuous` não mexe nela enquanto o saldo não for positivo). A produção de todos os edifícios leva o fator `balance.winter.cold.productionMultiplier`. Fecha no primeiro instante de evento ou de comando em que `woodCoversFirewood` é verdade (saldo positivo já com a penalidade, ou estoque positivo que cobre ao menos um instante) e sempre que a estação em vigor não queima lenha: a virada para a primavera. `coldEnded` leva em `data.reason` o porquê (`firewood` ou `thaw`) e em `data.sinceMs` o começo.
- **Fome e frio juntos** (`settleScarcity`, em `scarcity.ts`). Cada um mexe na taxa do outro: a fome corta a madeira que a Serraria entrega, o frio corta a comida da Fazenda. Os dois são conferidos em ordem fixa, fome e depois frio, e de novo até nada mudar. Como as duas penalidades só tiram produção (um teste de conteúdo garante), começar um só pode fazer o outro começar, e terminar um só pode fazer o outro terminar: o par nunca volta a um estado em que já esteve, e a conferência acaba em no máximo três mudanças. A Crônica registra a mudança que sobra entre o começo e o fim do instante; se um dos dois terminou e recomeçou no meio da conferência, ele simplesmente continua, com a data em que começou. A condição que encerra o frio é o contrário exato da que o abre, então a lenha que volta e acaba de novo dá sempre dois instantes diferentes.
- **Na visão** (`seasonView.ts`): `calendar.seasonEffects`, `calendar.nextSeason` (com `changes` e, quando a próxima estação queima lenha, a conta `firewood`), `winter` (a lareira, a conta do que falta até a primavera e o frio), `durationNote` nas obras e no recrutamento, e a lenha na explicação e no `depletesInSeconds` da madeira. Taxas por hora real e prazos em segundos reais, como o resto.

## Sorteios

O motor sorteia com um gerador próprio, com semente, em `src/random.ts`. `Math.random` é barrado pelo lint e por `purity.test.ts`.

- **Algoritmo:** xoshiro128\*\*, com estado de quatro inteiros sem sinal de 32 bits. Só operações inteiras (`Math.imul`, deslocamentos, `>>> 0`); nenhum sorteio passa por um número entre 0 e 1.
- **Fluxos nomeados:** cada assunto tem o próprio fluxo, com o estado em `state.rng[nome]`. Os da v0.2 são `council` (cartas do Conselho), `morale` (chegadas e partidas) e `horde` (incursões por Ameaça), em `RNG_STREAMS`. Sortear em um não desloca os outros: mexer na ordem ou na quantidade de sorteios da moral não muda as cartas de ninguém.
- **Semente do fluxo:** FNV-1a de 32 bits sobre os bytes UTF-8 de `seed + ':' + nome`, expandido por SplitMix32 nos quatro inteiros iniciais. O fluxo **nasce na primeira vez em que é usado**: uma partida nova, ou uma que veio da v0.1, tem `rng: {}` até o primeiro sorteio, e por isso o gerador não mudou a forma do estado nem subiu `schemaVersion`.
- **É estado como qualquer outro:** JSON puro, gravado com a partida. Salvar e recarregar continua a mesma sequência; a mesma semente com as mesmas ordens nos mesmos instantes dá os mesmos sorteios.

A API é interna ao pacote (não sai em `index.ts`) e altera o rascunho que recebe:

```ts
nextInt(draft, stream, maxExclusive): number          // inteiro em [0, maxExclusive), até 2^32
chance(draft, stream, { num, den }): boolean          // acontece com chance num/den
pickWeighted(draft, stream, items): T | null          // items: { weight: number, … }[]
```

- `nextInt` não tem viés: os valores de 32 bits que sobram depois do último múltiplo de `maxExclusive` são descartados e o sorteio se repete (rejeição).
- `chance` compara um inteiro sorteado em `[0, den)` com `num`. `num` zero nunca acontece e `num >= den` acontece sempre.
- `pickWeighted` usa pesos inteiros a partir de zero; item de peso zero nunca sai. Lista vazia ou só de pesos zero devolve `null`, sem lançar. A **ordem da lista faz parte do sorteio**: passe sempre na ordem do conteúdo.
- **Quanto cada chamada gasta:** toda chamada que devolve um valor gasta o fluxo, mesmo quando só havia um resultado possível (chance de 0% ou de 100%, um item só). `pickWeighted` que devolve `null` não gasta nada. Quem não quer sortear uma certeza não chama.
- Limite, chance ou peso inválido (negativo, quebrado, `NaN`) lança erro antes de tocar no estado: é defeito de conteúdo ou de código, não uma recusa de regra. Um fluxo gravado que não tem quatro inteiros de 32 bits também lança, em vez de recomeçar da semente e repetir sorteios já feitos.

**Quem sorteia e quem não.** Só `advanceTo`, em eventos com hora marcada na linha do tempo (`nextEventAt`). `deriveViewState`, `nextEventAt`, `applyCommand` (aceite ou recusa), `createInitialState` e `migrateState` nunca sorteiam: consultar a tela a cada 30 segundos não rerrola nada, e um recibo reenviado nem chega ao motor. O estado do gerador nunca sai no `ViewState`. `purity.test.ts` barra a importação de `random.ts` nesses módulos.

**Trocar o algoritmo é mudar uma regra.** `RNG_VERSION` marca a versão; os vetores de `random.test.ts` (as saídas da implementação de referência do xoshiro128\*\*, os vetores publicados do FNV-1a e as primeiras saídas de cada fluxo da semente `pedra-alta`) congelam o comportamento. Mudar o gerador, o hash ou a redução a um intervalo muda o futuro de toda partida em andamento: sobe a versão, regrava os vetores de propósito e passa por um passo de migração.

A divisão de intervalo com sorteios é provada em `random.property.test.ts` com um cenário sintético (`advanceWithDailyDraws`, em `test-helpers.ts`): o laço de `advanceTo` de verdade (`advanceWith`, em `advance.ts`) com uma virada de dia que sorteia nos três fluxos e mexe no estoque. Nenhuma regra do jogo usa esse evento; cada mecânica que sorteia repete a prova com os próprios.

## Versões do estado e migração

O `GameState` tem um número de versão, `schemaVersion`, e há estados gravados em produção. Um estado gravado só entra no motor por `migrateState`, que o leva da versão em que foi escrito até `CURRENT_SCHEMA_VERSION` (hoje, 3):

- É **pura**: não altera a entrada e, para a mesma entrada, devolve sempre o mesmo estado. O ritmo vem de fora (`context.timeScale`, que o servidor lê de `games.time_scale`), porque na versão 1 ele não estava no estado.
- É **sequencial**: os passos rodam em ordem (1 → 2 → 3 …). Cada passo confere, antes de mexer, a **forma exata** da versão de que parte, e o resultado final é conferido contra a forma da versão atual.
- É **idempotente**: um estado que já está na versão atual volta como veio, o mesmo objeto.
- **Confere toda leitura**, inclusive a de um estado que já diz ser da versão atual: o número da versão não é salvo-conduto. Um campo a menos viraria `NaN` no primeiro avanço e `null` no banco; a conferência custa cerca de 1,5 µs no estado do cenário de 7 dias.
- **Recusa o que não conhece** com `StateMigrationError`: `reason: 'future'` para uma versão mais nova que a do motor (uma imagem antiga diante de um banco já migrado) e `'invalid'` para um JSON que não tem a forma da versão que declara, seja ela antiga ou a atual. A mensagem cita o caminho do campo e o tipo encontrado, nunca o valor: ela vai para o log, e o estado tem o nome que o jogador deu ao feudo. Quem chamou não deve gravar nada por cima.

| Versão | Entrou com | O que mudou em relação à anterior |
|---|---|---|
| 1 | v0.1 | — |
| 2 | V2B-T1 | Sai `settings.capsEnabled`; entram `settings.difficulty` (`lord` na migração) e `settings.timeScale` (o ritmo da linha da partida); entra `migratedAtMs` |
| 3 | V2C-T1 | Entra `settlement.cold`, `null` na migração. Nenhum prazo em curso muda; as taxas levam o fator da estação a partir da fronteira. Uma partida encontrada no inverno e sem madeira abre o frio no primeiro avanço, no instante da fronteira |

**`migratedAtMs` é a fronteira da atualização mais recente** ([ADR 0013](../../docs/decisions/0013-regras-da-v0.2-tempo-ritmo-migracao-e-economia.md), decisão 4): o instante de jogo em que a última migração encontrou a partida, isto é, até onde uma versão anterior das regras a simulou. Nas partidas que nasceram na versão atual, é `null`.

**A fronteira é de cada passo, não da primeira migração.** A v0.2 chega à produção em mais de uma publicação, e cada uma migra as partidas em um instante diferente; uma partida criada entre duas publicações nasce com `null` e, mesmo assim, é antiga para a mecânica seguinte. Por isso:

- `migrateWith` entrega a cada passo a **fronteira dele** (`context.boundaryMs`: o `lastProcessedAt` da partida quando o passo rodou) e grava esse valor em `migratedAtMs` no que o passo devolve. Um passo não precisa, nem consegue, deixar valendo a fronteira antiga.
- Todo prazo que um passo cria conta de `boundaryMs`: `nextDrawAtMs = boundaryMs + intervalo`, por exemplo. **Nunca** de `state.migratedAtMs`, que naquele momento ainda é a fronteira de uma migração anterior (semanas no passado: a ausência inteira seria recalculada com uma regra que não existia) ou `null`.
- O que o passo decide com a fronteira fica gravado no campo que ele criou (o prazo da primeira carta, a incursão roteirizada que já passou e não acontece). Uma regra em `advanceTo` lê esses campos, não `migratedAtMs`: o valor muda na migração seguinte.
- Quando vários passos rodam na mesma leitura (uma partida que pulou publicações), todos veem o mesmo instante.

`migrations.test.ts` prova isso com um passo sintético (`describe('a fronteira é de cada passo')`) e confere, em todo retrato de versão anterior, que a fronteira é o `lastProcessedAt` do retrato e que nada fica marcado para antes dela.

**Um passo não emite eventos.** A migração só muda a forma. Quando a regra nova tem algo a abrir no estado que encontrou (o frio de uma partida parada no inverno sem madeira), quem abre é o primeiro `advanceTo`, que acomoda fome e frio no instante da fronteira antes de o tempo andar e põe a linha na Crônica. O passo `v2ToV3` é o exemplo, e `migrations.test.ts` prova que a virada de dia daquele instante não se repete.

**Limite conhecido: refazer a história de uma partida migrada.** O instante de cada migração depende de quando a partida foi gravada pela última vez antes da publicação, e isso não se deduz da semente nem dos comandos. O estado guarda só a fronteira mais recente. Enquanto nenhum passo criar prazo nem mudar regra (é o caso da versão 2), "estado inicial + semente + comandos" refaz qualquer partida. A versão 3 já muda regra: as taxas levam o fator da estação a partir da fronteira. Daí em diante, refazer uma partida migrada exige também o estado gravado em cada fronteira (um backup). Partidas que nasceram na versão atual não têm esse limite.

### Onde fica cada coisa

| Arquivo | Conteúdo |
|---|---|
| `src/migrations.ts` | `migrateState`, `CURRENT_SCHEMA_VERSION`, a lista de passos, a forma da versão atual e `migrateWith` (o laço, com a cadeia de passos por parâmetro: é ele que entrega e grava a fronteira de cada passo) |
| `src/migrations/shape.ts` | Guardas de forma escritas à mão (o motor não tem zod): `exactObject`, `listOf`, `recordOf`, `nullable`, `natural`, `oneOf`… |
| `src/migrations/v1.ts`, `v2.ts`, … | Um arquivo por versão: a forma exata do estado naquela versão e o passo que **sai** dela |
| `src/__fixtures__/state-v<N>-<cenário>.json` | Retratos do estado em cada versão, gravados pelo motor da época |

### Uma mecânica que muda o estado sobe a versão

A regra é: **um passo por versão, uma versão por tarefa que muda a forma do estado**. Campo novo, campo que sai, campo que muda de significado ou edifício novo em `buildings`: tudo isso é versão nova, mesmo que pareça pequeno. Sem o passo, a partida de quem já joga chega ao código novo sem o campo e quebra no meio de um `advanceTo`.

1. **Antes de tocar no tipo**, rode os testes: `fixtures.test.ts` mantém `__fixtures__/state-v<atual>-*.json` em dia com o motor, como goldens. São esses arquivos que vão virar a entrada do seu passo. Se a mecânica anterior deixou no estado algo que nenhum cenário de `fixtures.test.ts` exercita, acrescente um cenário **antes** de subir a versão.
2. Em `types.ts`, mude o `GameState` e suba o literal de `schemaVersion`; em `migrations.ts`, suba `CURRENT_SCHEMA_VERSION`. `createInitialState` passa a escrever a versão nova, com os valores iniciais da mecânica.
3. Escreva a forma nova em `migrations/v<N+1>.ts`, partindo dos campos da anterior (`{ ...stateV<N>Fields, … }`), e aponte `currentShape` para ela. Identificadores (edifícios, recursos) são **escritos no arquivo**, não importados de `@lotg/content`: a forma de uma versão antiga não acompanha o conteúdo, que cresce.
4. No arquivo da versão anterior (`migrations/v<N>.ts`), escreva o passo `v<N>ToV<N+1>`: `from`, uma frase em `summary`, `shape` (a forma da versão `N`) e `migrate`, que recebe um estado já conferido e devolve o da versão seguinte **sem alterar a entrada**. Os valores com que uma partida antiga entra na mecânica são decisão de regra: estão no ADR 0013, decisão 4 (moral 50, todos adaptados, experiência 0, planejadas manuais, primeira carta e Ameaça contadas a partir da fronteira). **Prazos contam de `context.boundaryMs`**, a fronteira do seu passo, e não do `migratedAtMs` que veio no estado; não escreva `migratedAtMs` nem mexa em `lastProcessedAt`. Acrescente o passo ao fim de `migrationSteps`.
5. Rode `pnpm --filter @lotg/engine test -- migrations fixtures`. O teste dos retratos congelados vai falhar dizendo quais arquivos da versão `N` acabaram de ficar para trás e a impressão digital de cada um: copie para a tabela `FROZEN` de `migrations.test.ts`. Daí em diante esses arquivos não mudam nunca mais; se um teste de migração falhar, o defeito está no passo, não no retrato. Os retratos da versão nova são escritos na primeira execução (ou com `UPDATE_GOLDEN=1`).
6. Escreva o teste do seu passo em `migrations.test.ts` (um `describe('versão N → N+1')`): o que mudou, o que **não** mudou, e os valores iniciais. Se o passo cria prazo, teste-o sobre uma partida com `migratedAtMs: null` e `lastProcessedAt` adiantado e sobre uma partida com `migratedAtMs` bem anterior a `lastProcessedAt`: o prazo fica depois de `lastProcessedAt` nas duas, e `advanceTo(lastProcessedAt + 1)` não emite evento nenhum da mecânica nova. Os testes gerais já rodam sobre todos os retratos de todas as versões: migram, conferem que a entrada ficou intacta, que o resultado tem exatamente os campos de uma partida nova, que migrar duas vezes dá o mesmo estado, que o estado avança 30 dias e aceita ordens, e que a divisão de intervalo continua exata.
7. Acrescente a linha na tabela de versões acima e, se a regra de migração for nova, no GDD §15.4.

O servidor não precisa mudar: ele migra ao travar a partida e grava a versão nova na mesma escrita do avanço ([README do servidor](../server/README.md)).

## Como adicionar um evento

1. Acrescente o tipo em `EVENT_TYPES` e o modelo de frase em `chronicleTemplates`, em `packages/content/src/chronicle.ts`. O teste de conteúdo exige uma frase para cada tipo e só aceita os marcadores conhecidos.
2. No motor, chame `emit(events, draft, atMs, 'tipo', dados, marcadores)` no ponto em que o fato acontece.
3. Se o evento tem hora marcada, inclua o instante em `nextEventAt` (`timeline.ts`) e processe-o em `processEventsAt` (`advance.ts`), respeitando a ordem fixa.
4. Se o evento sorteia, use `nextInt`, `chance` ou `pickWeighted` de `random.ts`, no fluxo do assunto, **dentro** do processamento do instante marcado, nunca em um comando, na visão ou em `nextEventAt`. O instante do sorteio tem de vir do estado (uma virada de dia, um `nextDrawAtMs`), não de quando alguém consultou.
5. Escreva o teste do instante exato e rode os testes de propriedade: eles pegam qualquer evento que dependa de como o intervalo foi dividido.

## Goldens

Os arquivos em `src/__golden__/` congelam o comportamento: o `ViewState` de cinco momentos (três da primavera, o outono de quem ainda não guardou lenha e o inverno com frio), as frases da Crônica dos objetivos e de um inverno, e um cenário roteirizado de 7 dias. Qualquer mudança de regra aparece no diff. Os retratos de estado da versão atual, em `src/__fixtures__/`, seguem a mesma regra enquanto a versão não sobe; os de versões anteriores estão congelados e têm a impressão digital conferida por teste.

```bash
pnpm --filter @lotg/engine test                  # compara com os goldens
UPDATE_GOLDEN=1 pnpm --filter @lotg/engine test  # regrava; confira o diff antes de commitar
pnpm --filter @lotg/engine test -- --coverage    # cobertura do motor
```

Mudar uma regra exige atualizar o golden correspondente e o GDD (GDD §18.3).

## O que ainda não existe

O gerador de sorteios existe (ver "Sorteios"), mas nenhuma regra o usa ainda: os fluxos `council`, `morale` e `horde` ganham o primeiro sorteio com o Conselho, a moral e as incursões por Ameaça (roadmap da v0.2, V2D-T1, V2C-T4 e V2E-T3). Até lá, `rng` continua vazio em toda partida.

O cenário roteirizado de 7 dias atravessa o inverno com milhares de unidades de madeira, porque ainda não há limite de estoque: o frio fica congelado no golden da Crônica do inverno (`chronicle-winter.txt`) e nos testes de `cold.test.ts`, e entra no roteiro quando os caps (V2C-T2) tornarem a lenha apertada.

A dificuldade está no estado e aparece na visão, mas ainda não muda nenhuma regra. Os fatores já estão em `balance.difficulties` (`storageCapacity`, `famineDesertion`) e passam a valer com o armazenamento (V2C-T2) e a deserção por fome (V2C-T4); a opção automática do Conselho é marcada em cada carta (V2D-T1).
