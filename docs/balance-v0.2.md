# Balanceamento da v0.2

Medições do simulador (`@lotg/sim-cli`) ao longo da v0.2, na ordem em que foram feitas. Cada rodada traz data, commit, comandos e a saída como veio, para a seguinte poder ser comparada com ela. As faixas que a CI cobra entram na tarefa V2B-T4 do [roadmap](roadmap-v0.2.md); as rodadas depois das mecânicas, em V2C-T7 e V2F-T1.

Nenhum número deste documento é promessa ao jogador ([ADR 0011](decisions/0011-ritmo-3x-no-mvp.md)): são medidas de um bot, não a duração de nada na tela.

## 1. Linha de base da v0.1 (antes das mecânicas)

Tarefa V2A-T2.2. É o jogo como fechou na v0.1, sem nenhuma mecânica da v0.2 e **sem nenhum número de jogo alterado**. Serve de régua: tudo o que a Fase C mudar na economia se compara com isto.

| | |
|---|---|
| Data | 2026-10-01 |
| Commit | `242296b` (o motor e o conteúdo são os da tag `v0.1.0`; `contentHash` `a99e1d84b4b2090e` em `GET /v1/version`) |
| Semente | `pedra-alta-golden` |
| Bot | `economico`, 2 sessões por dia real, 7 dias reais |
| Máquina | Apple M5, Node 22.22.2 (a saída é idêntica, byte a byte, no Node 24.19.0: o motor é determinístico) |

### 1.1 Comandos e saída

O CSV (uma linha por hora real) vai para a saída padrão; o resumo, para a saída de erro. Os dias e as sessões do simulador são sempre de tempo real, em qualquer ritmo.

```bash
pnpm -s sim -- --seed pedra-alta-golden --days 7 --sessions-per-day 2 --time-scale 1 > /dev/null
```

```
Semente pedra-alta-golden · estratégia economico · 7 dias · 2 sessões/dia · ritmo 1×
População: 26 de 35 vagas
Níveis: townHall 3, farm 4, lumberMill 3, quarry 3, goldMine 3, housing 4
Estoque: food 162, wood 10017, stone 4190, gold 1637
Fome: nenhuma
Comandos: 55 aceitos, 0 recusados
```

```bash
pnpm -s sim -- --seed pedra-alta-golden --days 7 --sessions-per-day 2 --time-scale 3 > /dev/null
```

```
Semente pedra-alta-golden · estratégia economico · 7 dias · 2 sessões/dia · ritmo 3×
População: 35 de 35 vagas
Níveis: townHall 3, farm 4, lumberMill 3, quarry 3, goldMine 3, housing 4
Estoque: food 2813, wood 40872, stone 16118, gold 6626
Fome: nenhuma
Comandos: 47 aceitos, 0 recusados
```

### 1.2 Comparação com a tabela do roadmap

A tabela de V2A-T2.2 foi medida em 2026-10-01, antes desta rodada. **Os dois ritmos repetem a tabela, número por número.**

| Ritmo | População | Salão | Comandos aceitos | Madeira parada | Pedra parada | Ouro parado | Igual ao roadmap? |
|---|---|---|---:|---:|---:|---:|---|
| 1× | 26 de 35 | Nv3 | 55 | 10.017 | 4.190 | 1.637 | Sim |
| 3× | 35 de 35 | Nv3 | 47 | 40.872 | 16.118 | 6.626 | Sim |

A comida não está na tabela do roadmap: 162 no 1× e 2.813 no 3×, sem fome em nenhum dos dois.

### 1.3 Dia a dia

Fim de cada dia real (linhas das horas 24, 48, … 168 do CSV). Níveis na ordem Salão do Senhor / Fazenda / Serraria / Pedreira / Mina de Ouro / Habitações. Estoques em unidades inteiras.

**Ritmo 1×**

| Dia real | Calendário do jogo | População | Níveis | Comida | Madeira | Pedra | Ouro |
|---:|---|---|---|---:|---:|---:|---:|
| 1 | ano 1, primavera, dia 13 | 8 de 15 | 1/2/1/1/1/2 | 155 | 566 | 285 | 180 |
| 2 | ano 1, verão, dia 1 | 10 de 15 | 1/2/2/2/1/2 | 115 | 1.036 | 810 | 178 |
| 3 | ano 1, verão, dia 13 | 14 de 20 | 2/2/2/2/2/2 | 194 | 1.803 | 630 | 567 |
| 4 | ano 1, outono, dia 1 | 18 de 25 | 2/3/2/2/2/3 | 211 | 3.044 | 1.246 | 694 |
| 5 | ano 1, outono, dia 13 | 22 de 25 | 2/3/3/3/2/3 | 170 | 5.110 | 2.029 | 951 |
| 6 | ano 1, inverno, dia 1 | 25 de 30 | 3/3/3/3/3/3 | 105 | 7.470 | 2.897 | 1.211 |
| 7 | ano 2, primavera, dia 1 | 26 de 35 | 3/4/3/3/3/4 | 162 | 10.017 | 4.190 | 1.637 |

**Ritmo 3×**

| Dia real | Calendário do jogo | População | Níveis | Comida | Madeira | Pedra | Ouro |
|---:|---|---|---|---:|---:|---:|---:|
| 1 | ano 1, verão, dia 13 | 9 de 15 | 1/2/1/1/1/2 | 669 | 854 | 1.125 | 190 |
| 2 | ano 1, inverno, dia 1 | 15 de 15 | 1/2/2/2/1/2 | 1.059 | 4.781 | 1.075 | 1.108 |
| 3 | ano 2, verão, dia 1 | 15 de 20 | 2/2/2/2/2/2 | 1.707 | 9.349 | 2.623 | 1.748 |
| 4 | ano 2, outono, dia 13 | 25 de 25 | 2/3/2/2/2/3 | 1.972 | 14.277 | 4.751 | 2.448 |
| 5 | ano 3, primavera, dia 13 | 25 de 25 | 2/3/3/3/2/3 | 2.188 | 22.793 | 8.413 | 3.783 |
| 6 | ano 3, outono, dia 1 | 25 de 30 | 3/3/3/3/3/3 | 2.404 | 31.202 | 12.137 | 5.215 |
| 7 | ano 4, primavera, dia 1 | 35 de 35 | 3/4/3/3/3/4 | 2.813 | 40.872 | 16.118 | 6.626 |

### 1.4 O que a linha de base diz

- **Os níveis dos edifícios são idênticos nos dois ritmos, dia real a dia real.** A coluna "Níveis" das duas tabelas é a mesma, do dia 1 ao dia 7, e nos dois a última melhoria sai na hora 157. O mundo anda três vezes mais no 3× (três anos de jogo contra um), mas o feudo sobe no mesmo passo: com uma fila só, cada visita inicia uma obra, e o progresso é limitado pelo número de visitas, não pelos recursos.
- **O excedente cresce com o ritmo.** Ao fim da semana ficam paradas cerca de quatro vezes mais madeira, pedra e ouro no 3× do que no 1×. A madeira passa de 10 mil no 1× e de 40 mil no 3×, sem nada em que gastar.
- **No 3× as casas enchem.** A população encosta nas vagas na hora 37 e termina a semana em 35 de 35; no 1× ela nunca encosta (26 de 35). O bot dá menos ordens no 3× (47 contra 55).
- **Sem fome nos dois ritmos**, com duas sessões por dia. No 1× a comida fecha a semana baixa (162); no 3×, folgada (2.813).

Nada disso foi corrigido aqui. A decisão 5 do roadmap está respondida no [ADR 0013](decisions/0013-regras-da-v0.2-tempo-ritmo-migracao-e-economia.md): nenhum número é ajustado antes das mecânicas; o excedente parado é atacado pelos caps de armazenamento (V2C-T2) e pela segunda fila com início automático (V2C-T5), e as faixas do simulador passam a existir por ritmo (V2B-T4), com os valores desta seção como ponto de partida. As rodadas seguintes deste documento devem mostrar a coluna "Níveis" do 3× se afastando da do 1× e o excedente caindo.

### 1.5 Limites desta medição

- Uma semente, um bot, um perfil de visita (2 sessões por dia). O GDD §15.3 pede 50 sementes por perfil; isso é de V2B-T4.
- O bot econômico não é um jogador: ele nunca deixa de dar a ordem que pode dar. A linha de base de **pessoas** é o playtest (V2A-T1), que ainda não aconteceu.
- O teste de faixas da CI (`packages/sim-cli/src/balance.test.ts`) cobre hoje só o ritmo 1: população de 20 a 40, Salão Nv3 ou mais e nenhuma fome. O 3× passaria nas mesmas faixas (35, Nv3, sem fome), mas nenhum teste acusa o excedente.
