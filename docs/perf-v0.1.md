# Desempenho da API — v0.1

Primeira medição da API `/v1`, feita com o `sim-cli` em modo remoto (MVP-ROADMAP.md F2-T8). A meta local é p95 abaixo de 50 ms em `/view` e abaixo de 80 ms em `/commands` com 50 bots.

## Como reproduzir

```bash
pnpm dev:up
# API no host, com os limites de taxa abertos para o teste de carga:
RATE_LIMIT_PER_MINUTE=1000000 ACCOUNT_CREATE_PER_HOUR_PER_IP=1000000 LOG_LEVEL=warn pnpm dev:api
# em outro terminal:
pnpm -s sim -- --remote http://localhost:3000 --bots 50 --minutes 2 --poll-ms 2000
```

Cada bot cria conta e partida e repete um ciclo: `GET /view` com `If-None-Match`, `GET /events?after=` e as ordens do bot econômico. O cliente real faz um ciclo a cada 30 s; aqui o ciclo é de 2 s, quinze vezes mais carga por jogador. Os bots começam espalhados ao longo do ciclo, como clientes reais.

## Resultado

**Data:** 2026-10-01 · **Máquina:** Intel Core i7-12700T, 18 núcleos lógicos e 9 GB de RAM no WSL2 · API no host (Node 22.22, `tsx`), PostgreSQL 16 em Docker.

50 bots, 2 minutos, ciclo de 2 s: 3.004 ciclos, 250 comandos aceitos, nenhum erro.

| Endpoint | Chamadas | p50 (ms) | p95 (ms) | máx (ms) |
|---|---:|---:|---:|---:|
| `GET /view` | 3.004 | 4,7 | **7,8** | 18,4 |
| `GET /events` | 3.004 | 3,8 | 5,4 | 12,4 |
| `POST /commands` | 250 | 7,6 | **14,1** | 37,0 |
| `POST /games` | 50 | 6,1 | 16,4 | 25,4 |
| `POST /auth/anonymous` | 50 | 4,7 | 17,5 | 47,1 |

As duas metas foram atingidas com folga: `/view` em 7,8 ms (meta 50) e `/commands` em 14,1 ms (meta 80).

## O que a medição não diz

- **Rajadas sincronizadas ficam acima da meta.** Na primeira versão do teste os 50 bots disparavam no mesmo instante a cada ciclo. Nesse cenário o p95 foi de 81,6 ms em `/view` e 147,4 ms em `/commands`: as requisições chegam todas juntas e esperam na fila de um único processo Node. Clientes reais não fazem polling em fase, mas um evento que todos esperam no mesmo horário (o cerco, na v0.4) pode aproximar esse padrão. O job de avanço existe para espalhar essa carga (GDD §14.9).
- **Partidas jovens.** Em dois minutos nenhuma partida acumula história; o custo de `advanceTo` depois de dias sem acesso não foi medido aqui. Foi medido na v0.2, com o tamanho do estado e da visão: [balance-v0.2.md](balance-v0.2.md), seção 9.7.
- **Uma máquina só.** Banco e API dividem o mesmo hardware, sem rede entre cliente e servidor.
- **Contêiner.** Com a API em Docker (perfil `full`), 10 bots e os limites de taxa reais, o p50 ficou igual, mas as primeiras requisições depois da subida foram lentas (p95 de 256 ms em `/view`, em 121 chamadas). Parece aquecimento do processo; não investiguei.

## Volume dos recibos

O ADR 0004 pede medir o volume de `commands` antes de pensar em compactação. Depois dos testes acima, 805 comandos ocupavam 2.760 kB, cerca de 3,4 kB por comando, quase tudo o `ViewState` guardado no corpo da resposta. Um jogador que dê 30 ordens por dia gera em torno de 100 kB por dia, ou 37 MB por ano. Cabe folgado no VPS de referência para algumas centenas de jogadores, mas é o primeiro lugar a olhar se o banco crescer.
