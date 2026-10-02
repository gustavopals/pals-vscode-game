# Balanceamento da v0.2

Medições do simulador (`@lotg/sim-cli`) ao longo da v0.2, na ordem em que foram feitas. Cada rodada traz data, commit, comandos e a saída como veio, para a seguinte poder ser comparada com ela. As faixas que a CI cobra nasceram na tarefa V2B-T4 do [roadmap](roadmap-v0.2.md) e estão na seção 2; as rodadas depois das mecânicas entram em V2C-T7 e V2F-T1.

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

## 2. Matriz por ritmo, antes das mecânicas (V2B-T4)

Tarefa V2B-T4. É a primeira rodada da **matriz de balanceamento** (roadmap §7.3) e a origem das faixas que a CI passou a cobrar. O jogo ainda é o da seção 1: **nenhum número de conteúdo foi alterado** ([ADR 0013](decisions/0013-regras-da-v0.2-tempo-ritmo-migracao-e-economia.md), decisão 5).

| | |
|---|---|
| Data | 2026-10-01 |
| Commit | o da tarefa V2B-T4 (`git log --grep V2B-T4`) |
| Identificação | Motor 0.1.0 · estado v2 · conteúdo dac513145ad9399e (o `contentHash` é o de `GET /v1/version`; mudou desde a seção 1 porque V2B-T3 acrescentou dificuldades e ritmos ao conteúdo, sem mudar regra) |
| Dificuldade | Senhor (`lord`); as outras entram quando tiverem efeito (V2C-T2) |
| Sementes | 50 fixas: `pedra-alta-001` a `pedra-alta-050` |
| Ritmos | os três de `balance.paces`: Rápido 3×, Normal 1× e Tranquilo 0,5× |
| Máquina | Apple M5, Node 24.19.0 |

### 2.1 Perfis

Os perfis de visita do GDD §15.2. As sessões são a intervalos iguais de tempo real, a primeira na criação da partida.

| Perfil | Sessões por dia real | Bot | Políticas do bot, na ordem |
|---|---:|---|---|
| Preguiçoso | 1 | `preguicoso` | recrutar, obra mais barata, comida primeiro, ocupar os livres |
| Regular | 2 | `economico` | recrutar, obra mais barata, alocar por demanda |
| Dedicado | 4 | `economico` | recrutar, obra mais barata, alocar por demanda |

O bot `preguicoso` nasceu nesta tarefa. O `economico` foi reescrito como lista de políticas **sem mudar de comportamento**: para a semente `pedra-alta-golden`, nos três ritmos e com 1, 2 e 4 sessões por dia, as 24 colunas que o CSV já tinha saem idênticas, byte a byte, às de antes da mudança, e o estado final e a sequência de eventos têm o mesmo SHA-256 (18 combinações conferidas). A linha "Regular" do ritmo 1 e do ritmo 3 repete a seção 1.

### 2.2 Comando e saída

```bash
pnpm -s sim -- --matrix > matriz.csv 2> matriz.md
```

São 900 linhas no CSV e 750 partidas distintas (no ritmo 1, 7 dias reais são um ano de jogo: a mesma partida serve às duas tabelas). A rodada inteira leva cerca de 3 s; dentro do `pnpm test`, cerca de 2 s, e a suíte de unidade continua em menos de 5 s. Por isso **a matriz inteira roda na CI**, e não um subconjunto.

As duas tabelas **não se comparam entre si**: têm denominadores diferentes. Na primeira todos jogam 7 dias reais, e o ritmo decide quanto mundo passa (três anos de jogo no 3×, meio ano no 0,5×). Na segunda todos atravessam um ano de jogo, e o ritmo decide quantas visitas cabem nele (56 h reais no 3×, 14 dias no 0,5×).

Cada célula traz o menor e o maior valor entre as 50 sementes; quando são iguais, um número só. **Hoje são sempre iguais:** nenhuma regra sorteia nada, então a semente não muda a partida. A lista de sementes passa a trabalhar quando a moral (V2C-T4) e o Conselho (V2D-T1) sortearem.

Unidades: população em aldeões; Salão em nível; fome, fila ociosa e horas em **horas reais**, uma amostra ao fim de cada hora; "sem ofício" em aldeão-horas (a soma, hora a hora, dos aldeões sem ofício); excedente em unidades do recurso, o estoque ao fim da janela, **cada recurso por si**.

#### Tabela 1: 7 dias reais

| Ritmo | Perfil | Anos de jogo | População | Salão | Fome (h) | Fila ociosa (h) | Sem ofício (aldeão-h) | Excedente de madeira | Excedente de pedra | Excedente de ouro | Recusas | Faixa |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso (1/dia, preguicoso) | 3 | 20 | 2 | 0 | 168 | 360 | 17.803 | 9.142 | 6.450 | 0 | dentro |
| Rápido 3× | Regular (2/dia, economico) | 3 | 35 | 3 | 0 | 168 | 360 | 40.872 | 16.118 | 6.626 | 0 | dentro |
| Rápido 3× | Dedicado (4/dia, economico) | 3 | 55 | 5 | 0 | 168 | 300 | 83.001 | 33.786 | 12.151 | 0 | dentro |
| Normal 1× | Preguiçoso (1/dia, preguicoso) | 1 | 12 | 2 | 0 | 168 | 168 | 5.515 | 1.846 | 1.921 | 0 | dentro |
| Normal 1× | Regular (2/dia, economico) | 1 | 26 | 3 | 0 | 168 | 252 | 10.017 | 4.190 | 1.637 | 0 | dentro |
| Normal 1× | Dedicado (4/dia, economico) | 1 | 17 | 5 | 0 | 168 | 72 | 2.068 | 1.145 | 676 | 0 | dentro |
| Tranquilo 0,5× | Preguiçoso (1/dia, preguicoso) | 0,5 | 11 | 2 | 0 | 168 | 143 | 2.443 | 814 | 674 | 0 | dentro |
| Tranquilo 0,5× | Regular (2/dia, economico) | 0,5 | 12 | 3 | 0 | 168 | 83 | 1.609 | 710 | 409 | 0 | dentro |
| Tranquilo 0,5× | Dedicado (4/dia, economico) | 0,5 | 14 | 4 | 0 | 65 | 53 | 470 | 316 | 182 | 0 | dentro |

Faixas cobradas:

| Ritmo | Perfil | População | Salão | Fome (h) | Excedente de madeira | Excedente de pedra | Excedente de ouro | Recusas |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso | 18 a 22 | ≥ 2 | ≤ 0 | ≤ 18.694 | ≤ 9.600 | ≤ 6.773 | 0 |
| Rápido 3× | Regular | 31 a 39 | ≥ 3 | ≤ 0 | ≤ 42.916 | ≤ 16.924 | ≤ 6.958 | 0 |
| Rápido 3× | Dedicado | 49 a 61 | ≥ 5 | ≤ 0 | ≤ 87.152 | ≤ 35.476 | ≤ 12.759 | 0 |
| Normal 1× | Preguiçoso | 10 a 14 | ≥ 2 | ≤ 0 | ≤ 5.791 | ≤ 1.939 | ≤ 2.018 | 0 |
| Normal 1× | Regular | 23 a 29 | ≥ 3 | ≤ 0 | ≤ 10.518 | ≤ 4.400 | ≤ 1.719 | 0 |
| Normal 1× | Dedicado | 15 a 19 | ≥ 5 | ≤ 0 | ≤ 2.172 | ≤ 1.203 | ≤ 710 | 0 |
| Tranquilo 0,5× | Preguiçoso | 9 a 13 | ≥ 2 | ≤ 0 | ≤ 2.566 | ≤ 855 | ≤ 708 | 0 |
| Tranquilo 0,5× | Regular | 10 a 14 | ≥ 3 | ≤ 0 | ≤ 1.690 | ≤ 746 | ≤ 430 | 0 |
| Tranquilo 0,5× | Dedicado | 12 a 16 | ≥ 4 | ≤ 0 | ≤ 494 | ≤ 332 | ≤ 192 | 0 |

#### Tabela 2: um ano de jogo

| Ritmo | Perfil | Horas reais | População | Salão | Fome (h) | Fila ociosa (h) | Sem ofício (aldeão-h) | Excedente de madeira | Excedente de pedra | Excedente de ouro | Recusas | Faixa |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso (1/dia, preguicoso) | 56 | 15 | 1 | 0 | 56 | 176 | 5.419 | 475 | 514 | 0 | dentro |
| Rápido 3× | Regular (2/dia, economico) | 56 | 15 | 1 | 0 | 56 | 120 | 6.274 | 1.571 | 1.338 | 0 | dentro |
| Rápido 3× | Dedicado (4/dia, economico) | 56 | 25 | 2 | 0 | 56 | 120 | 8.758 | 2.989 | 1.493 | 0 | dentro |
| Normal 1× | Preguiçoso (1/dia, preguicoso) | 168 | 12 | 2 | 0 | 168 | 168 | 5.515 | 1.846 | 1.921 | 0 | dentro |
| Normal 1× | Regular (2/dia, economico) | 168 | 26 | 3 | 0 | 168 | 252 | 10.017 | 4.190 | 1.637 | 0 | dentro |
| Normal 1× | Dedicado (4/dia, economico) | 168 | 17 | 5 | 0 | 168 | 72 | 2.068 | 1.145 | 676 | 0 | dentro |
| Tranquilo 0,5× | Preguiçoso (1/dia, preguicoso) | 336 | 14 | 3 | 0 | 336 | 215 | 4.777 | 2.487 | 1.843 | 0 | dentro |
| Tranquilo 0,5× | Regular (2/dia, economico) | 336 | 17 | 5 | 0 | 334 | 143 | 2.068 | 1.145 | 676 | 0 | dentro |
| Tranquilo 0,5× | Dedicado (4/dia, economico) | 336 | 18 | 6 | 0 | 110 | 77 | 457 | 322 | 366 | 0 | dentro |

Faixas cobradas:

| Ritmo | Perfil | População | Salão | Fome (h) | Excedente de madeira | Excedente de pedra | Excedente de ouro | Recusas |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso | 13 a 17 | ≥ 1 | ≤ 0 | ≤ 5.690 | ≤ 499 | ≤ 540 | 0 |
| Rápido 3× | Regular | 13 a 17 | ≥ 1 | ≤ 0 | ≤ 6.588 | ≤ 1.650 | ≤ 1.405 | 0 |
| Rápido 3× | Dedicado | 22 a 28 | ≥ 2 | ≤ 0 | ≤ 9.196 | ≤ 3.139 | ≤ 1.568 | 0 |
| Normal 1× | Preguiçoso | 10 a 14 | ≥ 2 | ≤ 0 | ≤ 5.791 | ≤ 1.939 | ≤ 2.018 | 0 |
| Normal 1× | Regular | 23 a 29 | ≥ 3 | ≤ 0 | ≤ 10.518 | ≤ 4.400 | ≤ 1.719 | 0 |
| Normal 1× | Dedicado | 15 a 19 | ≥ 5 | ≤ 0 | ≤ 2.172 | ≤ 1.203 | ≤ 710 | 0 |
| Tranquilo 0,5× | Preguiçoso | 12 a 16 | ≥ 3 | ≤ 0 | ≤ 5.016 | ≤ 2.612 | ≤ 1.936 | 0 |
| Tranquilo 0,5× | Regular | 15 a 19 | ≥ 5 | ≤ 0 | ≤ 2.172 | ≤ 1.203 | ≤ 710 | 0 |
| Tranquilo 0,5× | Dedicado | 16 a 20 | ≥ 6 | ≤ 0 | ≤ 480 | ≤ 339 | ≤ 385 | 0 |

Todas as 900 partidas ficam dentro das faixas, e nenhum bot teve ordem recusada.

### 2.3 Como as faixas saem das medidas

O autor não definiu limites. As faixas são **o valor medido com uma folga pequena e explícita** (`SLACK`, em `packages/sim-cli/src/bands.ts`), e servem de guarda de regressão até ele apertá-las:

| Grandeza | Faixa | Folga |
|---|---|---|
| População final | do menor ao maior valor medido | 10% para cada lado, arredondando para fora |
| Salão do Senhor | pelo menos o menor nível medido | nenhuma |
| Horas de fome | no máximo o maior valor medido | 5% (hoje a medida é zero em toda célula, e o limite também) |
| **Excedente parado** de madeira, de pedra e de ouro | no máximo o maior estoque final medido | 5%, arredondando para cima. Só tem teto |
| Ordens recusadas pelo motor | nenhuma | nenhuma |

As faixas da v0.1 (população de 20 a 40, Salão Nv3 ou mais, sem fome com 2 sessões por dia) valiam só no ritmo 1 e com uma semente. A faixa medida do Regular no ritmo 1 (23 a 29, Nv3, sem fome) cabe dentro dela, e as mesmas três grandezas passam a ser cobradas em cada ritmo. "Sem fome com 2 sessões por dia" vale nos três ritmos e nas duas janelas.

`packages/sim-cli/src/balance.test.ts` joga a matriz a cada `pnpm test` e **falha se o excedente parado de qualquer material passar do limite** em qualquer célula, dizendo a célula, a semente e os dois números. O limite só tem teto: quando os caps (V2C-T2) fizerem sobrar menos, o teste continua verde e o autor pode baixar o limite.

A fila ociosa e os aldeões sem ofício são medidos e relatados, mas **não têm faixa** ainda.

### 2.4 O que a matriz diz

- **A fila de obras está ociosa quase o tempo todo.** Em 15 das 18 células a fila está livre, com obra que cabe no estoque, em todas as horas amostradas. As obras dos níveis que os bots alcançam duram de minutos a cerca de uma hora de jogo, e depois disso o feudo espera a próxima visita com o que construir e com o que pagar. Só o Dedicado e o Regular no 0,5× chegam a ver a fila ocupada. É o sinal mais forte desta rodada, e é o que a segunda fila e o início automático (V2C-T5) atacam.
- **O excedente parado cresce com o ritmo.** Em 7 dias reais, o Regular termina com 1.609 de madeira no 0,5×, 10.017 no 1× e 40.872 no 3×. O Dedicado no 3× passa de 83 mil. É o que os caps (V2C-T2) atacam.
- **Em um ano de jogo, o ritmo rápido rende menos feudo.** No 3× o ano dura 56 h reais: cabem 3 visitas do Preguiçoso e 5 do Regular, e os dois terminam o ano com o Salão no nível 1. No 0,5× o mesmo ano tem 14 dias e o Regular chega ao nível 5. Com uma fila só, o progresso é contado em visitas.
- **Mais visitas não dão mais gente no ritmo 1.** O Dedicado termina com 17 aldeões em 55 vagas e o Salão no nível 5; o Regular, com 26 em 35 e o Salão no nível 3. Isso diz mais do bot do que do jogo: `alocar por demanda` deixa a comida fechando em cerca de +2 por hora de jogo, e cada recruta custa 50 de comida. É um limite do bot econômico, não uma regra.
- **A meta do GDD §15.2 para o Regular (população de 30 a 40 no dia 7) não é atingida no ritmo 1**: a medida é 26. Já era assim na v0.1, cuja faixa de teste era 20 a 40.
- **Sem fome em célula nenhuma**, inclusive com uma visita por dia.

### 2.5 Limites desta medição

- **As faixas não são metas.** São o jogo de hoje, com folga. Uma mecânica que muda a economia de propósito vai sair delas, e a tarefa regrava a linha de base de propósito, como um golden: `pnpm -s sim -- --matrix`, conferir o que mudou, copiar o bloco "Linha de base medida nesta rodada" para `MEASURED` e registrar a rodada aqui.
- **Os bots não são jogadores.** Eles nunca planejam obras (a coluna de fila ociosa com obra planejada é zero em toda célula) e o econômico não persegue população. A linha de base de pessoas é o playtest.
- **Só a dificuldade Senhor.** `--matrix --difficulty ironKing` joga e mede, sem faixa.
- **Colunas reservadas.** Desperdício por recurso, horas de frio, moral, cartas vistas, respondidas e expiradas, e perdas por lobos já têm cabeçalho nos dois CSVs e saem vazias até as Fases C a E.
- O "excedente parado" é o estoque ao fim da janela. Depois dos caps, a medida útil passa a ser o desperdício (ADR 0013, decisão 17), e esta vira um teto que o próprio cap garante.
