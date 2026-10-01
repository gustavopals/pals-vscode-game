# @lotg/engine

O motor de Lords of the Guild: funções puras e determinísticas que decidem tudo o que acontece no feudo. Roda igual no servidor (a verdade), no `sim-cli` (balanceamento) e nos testes. Não conhece banco, rede, relógio do sistema nem VS Code.

## API pública

```ts
createInitialState(seed: string, settings: GameSettings): GameState
nextEventAt(state: GameState): number | null
advanceTo(state: GameState, gameTimeMs: number): { state: GameState; events: GameEvent[] }
applyCommand(state: GameState, command: Command, gameTimeMs: number): CommandResult
deriveViewState(state: GameState, gameTimeMs: number): ViewState
```

Além delas, o pacote exporta só os tipos e a lista `REJECTION_CODES`. Um teste (`purity.test.ts`) falha se qualquer outra coisa vazar.

## O ciclo

```
advanceTo(estado, agora)  →  applyCommand(estado avançado, comando, agora)  →  deriveViewState(estado, agora)
```

1. **`advanceTo`** leva o estado até um instante de jogo, em milissegundos. Percorre a linha do tempo trecho a trecho: aplica a produção contínua até o próximo evento discreto (`nextEventAt`), processa os eventos daquele instante e repete. Devolve o estado novo e os eventos, cada um já com a frase da Crônica.
2. **`applyCommand`** é a única outra forma de mudar o estado. Exige o estado já avançado até o instante do comando (`state.lastProcessedAt === gameTimeMs`); violar isso lança erro, porque é falha de quem chamou. Uma recusa de regra nunca lança: devolve `{ ok: false, code, message }`, com a mensagem em português, e não altera nada. O chamador fica com o estado que saiu de `advanceTo` e pode persisti-lo mesmo na recusa.
3. **`deriveViewState`** calcula tudo que a interface exibe, com a explicação de cada número. Se receber um instante futuro, avança uma cópia antes de derivar.

Nenhuma função muta a entrada.

## Invariantes

- **Divisão de intervalo exata.** `advanceTo(t2)` dá o mesmo estado e os mesmos eventos que `advanceTo(t1)` seguido de `advanceTo(t2)`, para qualquer `t1` no meio, com igualdade estrita. É o que permite ao servidor calcular às 23:00 o que aconteceu às 20:00.
- **Só inteiros no estado.** Recursos ficam em milésimos. A produção acumula `taxa × ms` em `accumulators` e só a parte inteira de `acumulador / 3.600.000` vai para o estoque; o resto fica guardado para o próximo trecho. Nada é arredondado e descartado.
- **Recursos nunca negativos.** O instante em que a comida acaba é um evento da linha do tempo, calculado em inteiros; a fome começa exatamente nele.
- **Ordem fixa dentro do mesmo instante:** obras concluídas, aldeões que chegam, virada de ano, de estação e de dia, objetivos, e por fim a abertura ou o encerramento da fome.
- **Nenhum número de jogo aqui.** Custos, taxas, tempos e textos vêm de `@lotg/content`.
- **Valores derivados não são guardados:** capacidade habitacional, aldeões livres e taxas saem de funções puras.

A fome congela a fila de recrutamento e recusa ordens novas; a produção cai para 3/4. Ela termina no primeiro instante em que o saldo de comida, já com essa penalidade, volta a ser positivo, e a fila é retomada de onde parou.

## Como adicionar um evento

1. Acrescente o tipo em `EVENT_TYPES` e o modelo de frase em `chronicleTemplates`, em `packages/content/src/chronicle.ts`. O teste de conteúdo exige uma frase para cada tipo e só aceita os marcadores conhecidos.
2. No motor, chame `emit(events, draft, atMs, 'tipo', dados, marcadores)` no ponto em que o fato acontece.
3. Se o evento tem hora marcada, inclua o instante em `nextEventAt` (`timeline.ts`) e processe-o em `processEventsAt` (`advance.ts`), respeitando a ordem fixa.
4. Escreva o teste do instante exato e rode os testes de propriedade: eles pegam qualquer evento que dependa de como o intervalo foi dividido.

## Goldens

Os arquivos em `src/__golden__/` congelam o comportamento: o `ViewState` de três momentos, as frases da Crônica e um cenário roteirizado de 7 dias. Qualquer mudança de regra aparece no diff.

```bash
pnpm --filter @lotg/engine test                  # compara com os goldens
UPDATE_GOLDEN=1 pnpm --filter @lotg/engine test  # regrava; confira o diff antes de commitar
pnpm --filter @lotg/engine test -- --coverage    # cobertura do motor
```

Mudar uma regra exige atualizar o golden correspondente e o GDD (GDD §18.3).

## O que a v0.1 não tem

O estado carrega o campo `rng`, mas nenhuma regra da v0.1 sorteia nada, então ainda não há gerador de números aleatórios. Ele entra com a primeira mecânica que precisar dele (cartas do Conselho, na v0.2).
