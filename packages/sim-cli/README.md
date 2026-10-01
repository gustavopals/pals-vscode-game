# @lotg/sim-cli

Bots de playtest que jogam partidas inteiras em segundos, só com o motor (`@lotg/engine`), sem servidor nem navegador. É por aqui que os números de `@lotg/content` são conferidos e corrigidos (GDD §15.3).

São três modos: em processo (`--seed`), carga contra um servidor (`--remote`) e fumaça de concorrência contra um servidor (`--smoke`). Uma opção desconhecida ou de outro modo é recusada, e não ignorada.

## Uso

```bash
pnpm -s sim -- --seed pedra-alta-golden --days 7 --strategy economico --sessions-per-day 2 > semana.csv
pnpm -s sim -- --seed pedra-alta-golden --days 7 --time-scale 3 > semana-3x.csv
```

| Opção | Padrão | Significado |
|---|---|---|
| `--seed` | obrigatória | Semente da partida |
| `--days` | `7` | Dias reais simulados; no ritmo Normal, 7 dias são um ano de jogo |
| `--strategy` | `economico` | Bot que joga as sessões |
| `--sessions-per-day` | `2` | Sessões por dia real, a intervalos iguais, a primeira na criação da partida |
| `--time-scale` | `1` | Ritmo: horas de jogo por hora real. Qualquer número positivo (`3`, `0.5`) |

O CSV sai na saída padrão e o resumo na saída de erro; use `pnpm -s` para o pnpm não misturar o próprio cabeçalho ao CSV. A mesma semente e as mesmas opções produzem sempre o mesmo arquivo.

### Ritmo (`--time-scale`)

O servidor cria as partidas no ritmo 3 ([ADR 0011](../../docs/decisions/0011-ritmo-3x-no-mvp.md)); o padrão daqui continua sendo 1, o ritmo Normal em que o GDD e as faixas de balanceamento são definidos.

Com `--time-scale N`, o que é do jogador continua em tempo real e o que é do mundo anda `N` vezes mais rápido:

- `--days` e `--sessions-per-day` são dias reais e sessões por dia real. Entre duas sessões passam `N` vezes mais horas de jogo.
- O bot recebe a visão como o app a recebe: prazos em segundos reais e taxas por hora real (`deriveViewState` com `{ timeScale }`).
- O CSV continua com uma linha por hora real, e as colunas `*_per_hour` são por hora real. O calendário (`year`, `season`, `day_of_season`) é o de jogo: no ritmo 3, um dia de jogo dura 40 minutos reais.
- O resumo diz o ritmo na primeira linha, e as horas de fome são horas reais.

O ritmo não muda as regras: 3 dias no ritmo 3 com 3 sessões por dia terminam exatamente no mesmo estado de jogo que 9 dias no ritmo 1 com 1 sessão por dia, porque as sessões caem nos mesmos instantes de jogo. `src/timescale.test.ts` confere essa igualdade no estado, nos eventos e linha a linha.

## O bot econômico

A cada sessão, olhando só o `ViewState`, como um jogador:

1. recruta quantos aldeões couberem, guardando uma reserva de comida;
2. inicia a melhoria mais barata entre as que podem começar agora;
3. realoca os aldeões: fazendeiros o bastante para a comida fechar no positivo (contando quem ainda está chegando) e o resto nos materiais, em proporção ao tempo que cada um levaria para cobrir o que as obras pedem.

Entre as sessões o mundo anda sozinho. Quem chega entre duas sessões fica sem ofício até a seguinte.

## Como ler o CSV

Uma linha por hora real (168 linhas de dados em 7 dias), com o retrato do feudo ao fim daquela hora.

| Coluna | Significado |
|---|---|
| `hour`, `real_day` | Hora e dia reais desde a criação da partida |
| `year`, `season`, `day_of_season` | Calendário de jogo (um dia de jogo dura 2 h reais no ritmo 1 e 40 min no ritmo 3) |
| `food`, `wood`, `stone`, `gold` | Estoque em unidades inteiras |
| `*_per_hour` | Saldo líquido por hora real naquele instante; `food_per_hour` já desconta o consumo |
| `villagers`, `capacity` | População e vagas |
| `free` | Aldeões sem ofício: alto por muitas horas indica sessões espaçadas demais |
| `in_training` | Aldeões recrutados que ainda não chegaram |
| `townHall` … `housing` | Nível de cada edifício |
| `famine` | `1` se o feudo está com fome naquela hora |

O resumo traz o ritmo, população, níveis, estoque final, horas de fome e quantos comandos o motor aceitou e recusou. Um bot bem escrito não tem comando recusado.

## Faixas conferidas nos testes

`src/balance.test.ts` falha se, com o bot econômico:

- em 2 sessões por dia, no dia 7 a população sair de 20–40, o Salão ficar abaixo do nível 3 ou houver fome;
- em 1 sessão por dia, houver fome nas primeiras 24 h.

Quando uma faixa falhar, ajuste os números em `@lotg/content`, nunca o bot.

As faixas valem no ritmo 1. No ritmo 3 não há faixa definida: os testes só conferem que o ritmo não muda as regras.

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
