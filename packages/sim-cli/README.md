# @lotg/sim-cli

Bots de playtest que jogam partidas inteiras em segundos, só com o motor (`@lotg/engine`), sem servidor nem VS Code. É por aqui que os números de `@lotg/content` são conferidos e corrigidos (GDD §15.3).

## Uso

```bash
pnpm -s sim -- --seed pedra-alta-golden --days 7 --strategy economico --sessions-per-day 2 > semana.csv
```

| Opção | Padrão | Significado |
|---|---|---|
| `--seed` | obrigatória | Semente da partida |
| `--days` | `7` | Dias reais simulados; no ritmo Normal, 7 dias são um ano de jogo |
| `--strategy` | `economico` | Bot que joga as sessões |
| `--sessions-per-day` | `2` | Sessões por dia real, a intervalos iguais, a primeira na criação da partida |

O CSV sai na saída padrão e o resumo na saída de erro; use `pnpm -s` para o pnpm não misturar o próprio cabeçalho ao CSV. A mesma semente e as mesmas opções produzem sempre o mesmo arquivo.

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
| `year`, `season`, `day_of_season` | Calendário de jogo (um dia de jogo dura 2 h reais) |
| `food`, `wood`, `stone`, `gold` | Estoque em unidades inteiras |
| `*_per_hour` | Saldo líquido por hora naquele instante; `food_per_hour` já desconta o consumo |
| `villagers`, `capacity` | População e vagas |
| `free` | Aldeões sem ofício: alto por muitas horas indica sessões espaçadas demais |
| `in_training` | Aldeões recrutados que ainda não chegaram |
| `townHall` … `housing` | Nível de cada edifício |
| `famine` | `1` se o feudo está com fome naquela hora |

O resumo traz população, níveis, estoque final, horas de fome e quantos comandos o motor aceitou e recusou. Um bot bem escrito não tem comando recusado.

## Faixas conferidas nos testes

`src/balance.test.ts` falha se, com o bot econômico:

- em 2 sessões por dia, no dia 7 a população sair de 20–40, o Salão ficar abaixo do nível 3 ou houver fome;
- em 1 sessão por dia, houver fome nas primeiras 24 h.

Quando uma faixa falhar, ajuste os números em `@lotg/content`, nunca o bot.

## Modo remoto: carga contra um servidor

```bash
pnpm -s sim -- --remote http://localhost:3000 --bots 50 --minutes 2 --poll-ms 2000
```

Cada bot cria uma conta anônima e uma partida e joga pela API com o `client-sdk`, como a extensão: `GET /view` com `If-None-Match`, `GET /events?after=` e as ordens do bot. O relatório traz chamadas, p50, p95 e máximo por endpoint, e o comando sai com erro se houver respostas 5xx ou 429.

| Opção | Padrão | Significado |
|---|---|---|
| `--remote` | — | URL do servidor, sem o `/v1` |
| `--bots` | `50` | Jogadores simultâneos |
| `--minutes` | `2` | Duração |
| `--poll-ms` | `2000` | Intervalo do ciclo de cada bot (a extensão usa 30.000) |

Com os limites de taxa reais (60 requisições por minuto por sessão, 10 contas por hora por IP), use poucos bots e `--poll-ms 5000` ou mais. Para um teste de carga, suba a API com `RATE_LIMIT_PER_MINUTE` e `ACCOUNT_CREATE_PER_HOUR_PER_IP` altos. Os resultados registrados estão em [docs/perf-v0.1.md](../../docs/perf-v0.1.md).

O modo remoto joga pelo `@lotg/client-sdk`, o mesmo cliente HTTP que a extensão usa.
