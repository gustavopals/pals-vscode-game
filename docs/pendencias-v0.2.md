# Pendências e dúvidas da v0.2

> **Para ler pela manhã.** Em 2026-10-01 o autor pediu a implementação da v0.2 inteira durante a madrugada, com as dúvidas anotadas aqui. Este documento lista o que foi decidido sem ele, o que só ele pode fazer e o que ficou sem verificação. O que foi implementado está em [relatorio-v0.2.md](relatorio-v0.2.md).

## 1. O mais importante

- **Nada foi publicado.** Todos os commits estão no `main` **local**. `git push` no `main` implanta em produção, então não foi feito. Antes de publicar: jogar em desenvolvimento, fazer o backup externo e copiar o `RECOVERY_CODE_SECRET` (item 3), e ensaiar a reversão.
- **As regras da v0.2 são as premissas recomendadas do roadmap (§8)**, registradas nos ADRs [0013](decisions/0013-regras-da-v0.2-tempo-ritmo-migracao-e-economia.md) e [0014](decisions/0014-conselho-e-ameaca-na-v0.2.md) como "aplicadas por delegação". Nenhuma foi respondida pelo autor. A seção 2 lista cada uma para confirmar ou trocar.
- **Para jogar:** `pnpm dev:up`, `pnpm dev:api`, `pnpm dev:web` e abrir `http://localhost:5173`.

## 2. Decisões aplicadas sem o autor (confirmar ou trocar)

| # | Decisão | O que foi aplicado | Onde |
|---|---|---|---|
| 1 | Tempos fora do ritmo Normal | Tudo em tempo de jogo, menos a expiração da carta: 24 h reais | ADR 0013 e 0014 |
| 2 | Ritmos oferecidos | Rápido 3× (recomendado), Normal 1×, Tranquilo 0,5×; o 2× do GDD saiu | ADR 0013 |
| 3 | Como chega à produção | Tudo no `main` local, sem `push`; sem branches de fase | ADR 0013 |
| 4 | Partidas da v0.1 | Migradas, com o estoque acima do cap preservado | ADR 0013 |
| 5 | Balanceamento do 3× | Nenhum número ajustado; faixas do simulador com os valores medidos | ADR 0013 |
| 6 | Mercado na v0.2 | Não entrou (v0.3) | roadmap §8 |
| 7 | Cartas | 21 cartas escritas pelo agente, **sem aprovação carta a carta** | ADR 0014 |
| 8 | Carta do herói | Ficou para a v0.3 | ADR 0014 |
| 9 | Opção automática por dificuldade | Marcada em cada carta, sempre sem custo | ADR 0014 |
| 10 | Lobos | Uivos no dia 10, incursão no dia 16 do ano 1; 10% e 1 ferido (leve), 15% e 2 feridos (média); incursões por Ameaça | ADR 0014 |
| 11 | Ameaça, Torre, Paliçada | Ameaça cai 10 em toda incursão; Torre e Paliçada até o nível 2 | ADR 0014 |
| 12 | Objetivos 5 a 10 | Torre, primeira carta, estoque, obra automática, Paliçada, inverno sem frio | ADR 0014 |
| 13 | Lenha, obras lentas, postos | Lenha 0,5 por habitante/h no inverno; frio ×0,8 e moral −20; obras ×1,5 e recrutamento ×0,8 fixados no início; sem limite de postos | ADR 0013 |
| 17 | Caps | `máx(500, edifício) × dificuldade`; ganho discreto cortado e contado | ADR 0013 |
| 18 | Filas e automações | Planejadas na ordem, pulando bloqueadas; cadência do Conselho ancorada | ADR 0013 e 0014 |
| 19 | Moral e recuperação | Fórmula diária; piso de 3 aldeões | ADR 0013 |
| 20 | Virada de ano | `seenThisYear` zera; o resto continua | ADR 0014 |
| 21 | IDEIA-01 a 07 | Todas entraram | ADR 0014 |

## 3. O que só o autor pode fazer

| Item | Por quê | Tarefa |
|---|---|---|
| Playtest de 48 h da v0.1 com 3 a 5 pessoas | Precisa de pessoas e de acesso ao banco de produção | V2A-T1 |
| Playtest da v0.2 | Idem, depois de publicar | V2F-T3 |
| Backup externo e cópia do `RECOVERY_CODE_SECRET` fora do Coolify | Sem acesso à produção; **fazer antes de a migração de estado chegar lá** | decisão 14 |
| Ensaio da reversão atravessando uma migração, em produção ou em banco descartável do Coolify | Idem | V2B-T1.6 |
| Jogar cada fase e aprovar | O roadmap pede o autor jogando antes da fase seguinte; não aconteceu | V2C-T7.5, V2D-T5.4, V2E-T5.3 |
| Aprovar as 21 cartas, uma a uma | Curadoria é do autor | V2D-T2 |
| `git push`, tag `v0.2.0` e release | Publicar é do autor | V2F-T4.5 |
| Os oito pontos do ADR 0012 e o vínculo GitHub | Já eram pendências | decisões 15 e 16 |

## 4. Dúvidas levantadas durante a implementação

_Preenchido ao longo da execução, por fase._

## 5. O que não foi verificado

_Preenchido ao longo da execução, por fase._
