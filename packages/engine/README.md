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

`GameSettings` é `{ settlementName, timezone, vigilHourLocal, difficulty, timeScale }`: a dificuldade (`peasant`, `lord`, `ironKing`) e o ritmo ficam gravados no estado e não mudam durante o ano.

Além delas, o pacote exporta só os tipos, a lista `REJECTION_CODES`, `CURRENT_SCHEMA_VERSION` e a classe `StateMigrationError`. Um teste (`purity.test.ts`) falha se qualquer outra coisa vazar.

## O ciclo

```
advanceTo(estado, agora)  →  applyCommand(estado avançado, comando, agora)  →  deriveViewState(estado, agora)
```

1. **`advanceTo`** leva o estado até um instante de jogo, em milissegundos. Percorre a linha do tempo trecho a trecho: aplica a produção contínua até o próximo evento discreto (`nextEventAt`), processa os eventos daquele instante e repete. Devolve o estado novo e os eventos, cada um já com a frase da Crônica.
2. **`applyCommand`** é a única outra forma de mudar o estado. Exige o estado já avançado até o instante do comando (`state.lastProcessedAt === gameTimeMs`); violar isso lança erro, porque é falha de quem chamou. Uma recusa de regra nunca lança: devolve `{ ok: false, code, message }`, com a mensagem em português, e não altera nada. O chamador fica com o estado que saiu de `advanceTo` e pode persisti-lo mesmo na recusa.
3. **`deriveViewState`** calcula tudo que a interface exibe, com a explicação de cada número. Se receber um instante futuro, avança uma cópia antes de derivar. A visão fala em **tempo real**: no ritmo da partida (`state.settings.timeScale`, horas de jogo por hora real), os prazos saem em segundos reais, arredondados para cima (`depletesInSeconds` e `famine.secondsElapsed`, para baixo), e as taxas por hora, multiplicadas pelo ritmo, inclusive nos textos de explicação. `options.timeScale` só serve para ver o mesmo estado em outro ritmo (o simulador e os testes usam). O resto do motor continua em tempo de jogo ([ADR 0011](../../docs/decisions/0011-ritmo-3x-no-mvp.md)).

Antes de tudo isso, quem carrega um estado gravado passa por **`migrateState`** (ver "Versões do estado e migração").

Nenhuma função muta a entrada.

## Invariantes

- **Divisão de intervalo exata.** `advanceTo(t2)` dá o mesmo estado e os mesmos eventos que `advanceTo(t1)` seguido de `advanceTo(t2)`, para qualquer `t1` no meio, com igualdade estrita. É o que permite ao servidor calcular às 23:00 o que aconteceu às 20:00.
- **Só inteiros no estado**, com uma exceção: `settings.timeScale`, o ritmo, que pode ser 0,5. Ele não entra em conta contínua nenhuma: converte um prazo de tempo real em tempo de jogo no instante em que o prazo nasce, e tempo de jogo em tempo real na visão. Recursos ficam em milésimos. A produção acumula `taxa × ms` em `accumulators` e só a parte inteira de `acumulador / 3.600.000` vai para o estoque; o resto fica guardado para o próximo trecho. Nada é arredondado e descartado.
- **Recursos nunca negativos.** O instante em que a comida acaba é um evento da linha do tempo, calculado em inteiros; a fome começa exatamente nele.
- **Ordem fixa dentro do mesmo instante:** obras concluídas, aldeões que chegam, virada de ano, de estação e de dia, objetivos, e por fim a abertura ou o encerramento da fome.
- **Nenhum número de jogo aqui.** Custos, taxas, tempos e textos vêm de `@lotg/content`.
- **Valores derivados não são guardados:** capacidade habitacional, aldeões livres e taxas saem de funções puras.

A fome congela a fila de recrutamento e recusa ordens novas; a produção cai para 3/4. Ela termina no primeiro instante em que o saldo de comida, já com essa penalidade, volta a ser positivo, e a fila é retomada de onde parou.

## Versões do estado e migração

O `GameState` tem um número de versão, `schemaVersion`, e há estados gravados em produção. Um estado gravado só entra no motor por `migrateState`, que o leva da versão em que foi escrito até `CURRENT_SCHEMA_VERSION` (hoje, 2):

- É **pura**: não altera a entrada e, para a mesma entrada, devolve sempre o mesmo estado. O ritmo vem de fora (`context.timeScale`, que o servidor lê de `games.time_scale`), porque na versão 1 ele não estava no estado.
- É **sequencial**: os passos rodam em ordem (1 → 2 → 3 …). Cada passo confere, antes de mexer, a **forma exata** da versão de que parte, e o resultado final é conferido contra a forma da versão atual.
- É **idempotente**: um estado que já está na versão atual volta como veio, o mesmo objeto. Ele não é revalidado a cada leitura.
- **Recusa o que não conhece** com `StateMigrationError`: `reason: 'future'` para uma versão mais nova que a do motor (uma imagem antiga diante de um banco já migrado) e `'invalid'` para um JSON que não tem a forma da versão que declara. A mensagem cita o caminho do campo e o tipo encontrado, nunca o valor: ela vai para o log, e o estado tem o nome que o jogador deu ao feudo. Quem chamou não deve gravar nada por cima.

| Versão | Entrou com | O que mudou em relação à anterior |
|---|---|---|
| 1 | v0.1 | — |
| 2 | V2B-T1 | Sai `settings.capsEnabled`; entram `settings.difficulty` (`lord` na migração) e `settings.timeScale` (o ritmo da linha da partida); entra `migratedAtMs` |

**`migratedAtMs` é a fronteira da atualização** ([ADR 0013](../../docs/decisions/0013-regras-da-v0.2-tempo-ritmo-migracao-e-economia.md), decisão 4): o instante de jogo até onde uma versão anterior das regras simulou a partida. Nas partidas que já nasceram na versão atual, é `null`. O primeiro passo o grava (`lastProcessedAt` daquele momento) e os seguintes não o alteram. Uma regra nova que precise saber "desde quando eu valho" lê esse campo; nenhuma recalcula o que veio antes.

### Onde fica cada coisa

| Arquivo | Conteúdo |
|---|---|
| `src/migrations.ts` | `migrateState`, `CURRENT_SCHEMA_VERSION`, a lista de passos e a forma da versão atual |
| `src/migrations/shape.ts` | Guardas de forma escritas à mão (o motor não tem zod): `exactObject`, `listOf`, `recordOf`, `nullable`, `natural`, `oneOf`… |
| `src/migrations/v1.ts`, `v2.ts`, … | Um arquivo por versão: a forma exata do estado naquela versão e o passo que **sai** dela |
| `src/__fixtures__/state-v<N>-<cenário>.json` | Retratos do estado em cada versão, gravados pelo motor da época |

### Uma mecânica que muda o estado sobe a versão

A regra é: **um passo por versão, uma versão por tarefa que muda a forma do estado**. Campo novo, campo que sai, campo que muda de significado ou edifício novo em `buildings`: tudo isso é versão nova, mesmo que pareça pequeno. Sem o passo, a partida de quem já joga chega ao código novo sem o campo e quebra no meio de um `advanceTo`.

1. **Antes de tocar no tipo**, rode os testes: `fixtures.test.ts` mantém `__fixtures__/state-v<atual>-*.json` em dia com o motor, como goldens. São esses arquivos que vão virar a entrada do seu passo. Se a mecânica anterior deixou no estado algo que nenhum cenário de `fixtures.test.ts` exercita, acrescente um cenário **antes** de subir a versão.
2. Em `types.ts`, mude o `GameState` e suba o literal de `schemaVersion`; em `migrations.ts`, suba `CURRENT_SCHEMA_VERSION`. `createInitialState` passa a escrever a versão nova, com os valores iniciais da mecânica.
3. Escreva a forma nova em `migrations/v<N+1>.ts`, partindo dos campos da anterior (`{ ...stateV<N>Fields, … }`), e aponte `currentShape` para ela. Identificadores (edifícios, recursos) são **escritos no arquivo**, não importados de `@lotg/content`: a forma de uma versão antiga não acompanha o conteúdo, que cresce.
4. No arquivo da versão anterior (`migrations/v<N>.ts`), escreva o passo `v<N>ToV<N+1>`: `from`, uma frase em `summary`, `shape` (a forma da versão `N`) e `migrate`, que recebe um estado já conferido e devolve o da versão seguinte **sem alterar a entrada**. Os valores com que uma partida antiga entra na mecânica são decisão de regra: estão no ADR 0013, decisão 4 (moral 50, todos adaptados, experiência 0, planejadas manuais, primeira carta e Ameaça contadas a partir de `migratedAtMs`). Acrescente o passo ao fim de `migrationSteps`.
5. Rode `pnpm --filter @lotg/engine test -- migrations fixtures`. O teste dos retratos congelados vai falhar dizendo quais arquivos da versão `N` acabaram de ficar para trás e a impressão digital de cada um: copie para a tabela `FROZEN` de `migrations.test.ts`. Daí em diante esses arquivos não mudam nunca mais; se um teste de migração falhar, o defeito está no passo, não no retrato. Os retratos da versão nova são escritos na primeira execução (ou com `UPDATE_GOLDEN=1`).
6. Escreva o teste do seu passo em `migrations.test.ts` (um `describe('versão N → N+1')`): o que mudou, o que **não** mudou, e os valores iniciais. Os testes gerais já rodam sobre todos os retratos de todas as versões: migram, conferem que a entrada ficou intacta, que o resultado tem exatamente os campos de uma partida nova, que migrar duas vezes dá o mesmo estado, que o estado avança 30 dias e aceita ordens, e que a divisão de intervalo continua exata.
7. Acrescente a linha na tabela de versões acima e, se a regra de migração for nova, no GDD §15.4.

O servidor não precisa mudar: ele migra ao travar a partida e grava a versão nova na mesma escrita do avanço ([README do servidor](../server/README.md)).

## Como adicionar um evento

1. Acrescente o tipo em `EVENT_TYPES` e o modelo de frase em `chronicleTemplates`, em `packages/content/src/chronicle.ts`. O teste de conteúdo exige uma frase para cada tipo e só aceita os marcadores conhecidos.
2. No motor, chame `emit(events, draft, atMs, 'tipo', dados, marcadores)` no ponto em que o fato acontece.
3. Se o evento tem hora marcada, inclua o instante em `nextEventAt` (`timeline.ts`) e processe-o em `processEventsAt` (`advance.ts`), respeitando a ordem fixa.
4. Escreva o teste do instante exato e rode os testes de propriedade: eles pegam qualquer evento que dependa de como o intervalo foi dividido.

## Goldens

Os arquivos em `src/__golden__/` congelam o comportamento: o `ViewState` de três momentos, as frases da Crônica e um cenário roteirizado de 7 dias. Qualquer mudança de regra aparece no diff. Os retratos de estado da versão atual, em `src/__fixtures__/`, seguem a mesma regra enquanto a versão não sobe; os de versões anteriores estão congelados e têm a impressão digital conferida por teste.

```bash
pnpm --filter @lotg/engine test                  # compara com os goldens
UPDATE_GOLDEN=1 pnpm --filter @lotg/engine test  # regrava; confira o diff antes de commitar
pnpm --filter @lotg/engine test -- --coverage    # cobertura do motor
```

Mudar uma regra exige atualizar o golden correspondente e o GDD (GDD §18.3).

## O que ainda não existe

O estado carrega o campo `rng`, mas nenhuma regra sorteia nada, então ainda não há gerador de números aleatórios. Ele entra com a primeira mecânica que precisar dele (roadmap da v0.2, V2B-T2).

A dificuldade está no estado e ainda não muda nenhuma regra: os fatores dela chegam com o armazenamento, a fome com deserção e o Conselho.
