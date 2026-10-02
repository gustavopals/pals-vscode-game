# Balanceamento da v0.2

Medições do simulador (`@lotg/sim-cli`) ao longo da v0.2, na ordem em que foram feitas. Cada rodada traz data, commit, comandos e a saída como veio, para a seguinte poder ser comparada com ela. As faixas que a CI cobra nasceram na tarefa V2B-T4 do [roadmap](roadmap-v0.2.md) e estão na seção 2. Cada mecânica que muda a economia de propósito regrava a linha de base e registra a rodada aqui (as estações, na seção 3; o armazenamento, na seção 4, com a auditoria de alcançabilidade; a segunda fila e o início automático, na seção 5); as rodadas de balanceamento entram em V2C-T7 e V2F-T1.

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

## 3. Estações com efeito (V2C-T1)

Tarefa V2C-T1. É a primeira mecânica da v0.2 que **muda a economia de propósito**: a produção passa a levar o fator da estação, o recrutamento ordenado na primavera leva 16 minutos de jogo em vez de 20, as obras iniciadas no inverno demoram × 1,5 e o inverno queima lenha. Os números são os da tabela do GDD §4.1; nenhum outro número de conteúdo mudou. A linha de base da seção 2 deixou de valer e foi regravada, como um golden.

| | |
|---|---|
| Data | 2026-10-02 |
| Commit | o da tarefa V2C-T1 (`git log --grep V2C-T1`) |
| Identificação | Motor 0.1.0 · estado v3 · conteúdo 4a7d2ccbede2ae2c |
| Dificuldade | Senhor (`lord`) |
| Sementes | 50 fixas: `pedra-alta-001` a `pedra-alta-050` |
| Ritmos | Rápido 3×, Normal 1× e Tranquilo 0,5× |
| Máquina | Apple M5, Node 24.19.0 |

### 3.1 Perfis

Os mesmos da seção 2.1, com uma política a mais em cada bot e uma mudança em outra:

| Perfil | Sessões por dia real | Bot | Políticas do bot, na ordem |
|---|---:|---|---|
| Preguiçoso | 1 | `preguicoso` | recrutar, obra mais barata, comida primeiro, ocupar os livres, guardar lenha |
| Regular | 2 | `economico` | recrutar, obra mais barata, alocar por demanda, guardar lenha |
| Dedicado | 4 | `economico` | recrutar, obra mais barata, alocar por demanda, guardar lenha |

`guardar lenha` manda braços para a Serraria quando a conta da lenha da visão diz que falta madeira; `obra mais barata` deixa de começar a obra que gastaria a madeira da lareira. **Nenhuma das duas mudou uma partida sequer desta rodada**: a matriz jogada com as duas desligadas dá o mesmo CSV, byte a byte. Sem limite de estoque, os bots chegam ao inverno com milhares de unidades de madeira e a conta nunca diz que falta. Tudo o que mudou em relação à seção 2 vem das regras, não dos bots.

### 3.2 Comando e saída

```bash
pnpm -s sim -- --matrix > matriz.csv 2> matriz.md
```

São 900 linhas no CSV e 750 partidas distintas, como antes; a rodada leva cerca de 4 s. As tabelas ganharam a coluna **Frio (h)**: horas reais com o feudo passando frio, uma amostra ao fim de cada hora, como a fome. No CSV ela é a coluna `cold`, que deixou de sair vazia.

#### Tabela 1: 7 dias reais

| Ritmo | Perfil | Anos de jogo | População | Salão | Fome (h) | Frio (h) | Fila ociosa (h) | Sem ofício (aldeão-h) | Excedente de madeira | Excedente de pedra | Excedente de ouro | Recusas | Faixa |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso (1/dia, preguicoso) | 3 | 20 | 2 | 0 | 0 | 168 | 360 | 17.434 | 7.523 | 4.970 | 0 | dentro |
| Rápido 3× | Regular (2/dia, economico) | 3 | 35 | 3 | 0 | 0 | 168 | 360 | 39.064 | 16.155 | 6.972 | 0 | dentro |
| Rápido 3× | Dedicado (4/dia, economico) | 3 | 55 | 5 | 0 | 0 | 168 | 300 | 81.313 | 33.418 | 12.478 | 0 | dentro |
| Normal 1× | Preguiçoso (1/dia, preguicoso) | 1 | 20 | 2 | 0 | 0 | 168 | 357 | 5.370 | 2.242 | 2.073 | 0 | dentro |
| Normal 1× | Regular (2/dia, economico) | 1 | 34 | 3 | 0 | 0 | 168 | 344 | 9.735 | 4.196 | 1.808 | 0 | dentro |
| Normal 1× | Dedicado (4/dia, economico) | 1 | 40 | 5 | 0 | 0 | 168 | 210 | 8.864 | 3.846 | 1.954 | 0 | dentro |
| Tranquilo 0,5× | Preguiçoso (1/dia, preguicoso) | 0,5 | 12 | 2 | 0 | 0 | 168 | 165 | 2.650 | 1.160 | 770 | 0 | dentro |
| Tranquilo 0,5× | Regular (2/dia, economico) | 0,5 | 18 | 3 | 0 | 0 | 168 | 153 | 2.150 | 949 | 552 | 0 | dentro |
| Tranquilo 0,5× | Dedicado (4/dia, economico) | 0,5 | 20 | 4 | 0 | 0 | 79 | 89 | 783 | 460 | 345 | 0 | dentro |

Faixas cobradas:

| Ritmo | Perfil | População | Salão | Fome (h) | Frio (h) | Excedente de madeira | Excedente de pedra | Excedente de ouro | Recusas |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso | 18 a 22 | ≥ 2 | ≤ 0 | ≤ 0 | ≤ 18.306 | ≤ 7.900 | ≤ 5.219 | 0 |
| Rápido 3× | Regular | 31 a 39 | ≥ 3 | ≤ 0 | ≤ 0 | ≤ 41.018 | ≤ 16.963 | ≤ 7.321 | 0 |
| Rápido 3× | Dedicado | 49 a 61 | ≥ 5 | ≤ 0 | ≤ 0 | ≤ 85.379 | ≤ 35.089 | ≤ 13.102 | 0 |
| Normal 1× | Preguiçoso | 18 a 22 | ≥ 2 | ≤ 0 | ≤ 0 | ≤ 5.639 | ≤ 2.355 | ≤ 2.177 | 0 |
| Normal 1× | Regular | 30 a 38 | ≥ 3 | ≤ 0 | ≤ 0 | ≤ 10.222 | ≤ 4.406 | ≤ 1.899 | 0 |
| Normal 1× | Dedicado | 36 a 44 | ≥ 5 | ≤ 0 | ≤ 0 | ≤ 9.308 | ≤ 4.039 | ≤ 2.052 | 0 |
| Tranquilo 0,5× | Preguiçoso | 10 a 14 | ≥ 2 | ≤ 0 | ≤ 0 | ≤ 2.783 | ≤ 1.218 | ≤ 809 | 0 |
| Tranquilo 0,5× | Regular | 16 a 20 | ≥ 3 | ≤ 0 | ≤ 0 | ≤ 2.258 | ≤ 997 | ≤ 580 | 0 |
| Tranquilo 0,5× | Dedicado | 18 a 22 | ≥ 4 | ≤ 0 | ≤ 0 | ≤ 823 | ≤ 483 | ≤ 363 | 0 |

#### Tabela 2: um ano de jogo

| Ritmo | Perfil | Horas reais | População | Salão | Fome (h) | Frio (h) | Fila ociosa (h) | Sem ofício (aldeão-h) | Excedente de madeira | Excedente de pedra | Excedente de ouro | Recusas | Faixa |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso (1/dia, preguicoso) | 56 | 15 | 1 | 0 | 0 | 56 | 192 | 5.286 | 469 | 418 | 0 | dentro |
| Rápido 3× | Regular (2/dia, economico) | 56 | 15 | 1 | 0 | 0 | 56 | 120 | 5.748 | 1.545 | 1.669 | 0 | dentro |
| Rápido 3× | Dedicado (4/dia, economico) | 56 | 25 | 2 | 0 | 0 | 56 | 120 | 8.420 | 2.807 | 1.591 | 0 | dentro |
| Normal 1× | Preguiçoso (1/dia, preguicoso) | 168 | 20 | 2 | 0 | 0 | 168 | 357 | 5.370 | 2.242 | 2.073 | 0 | dentro |
| Normal 1× | Regular (2/dia, economico) | 168 | 34 | 3 | 0 | 0 | 168 | 344 | 9.735 | 4.196 | 1.808 | 0 | dentro |
| Normal 1× | Dedicado (4/dia, economico) | 168 | 40 | 5 | 0 | 0 | 168 | 210 | 8.864 | 3.846 | 1.954 | 0 | dentro |
| Tranquilo 0,5× | Preguiçoso (1/dia, preguicoso) | 336 | 16 | 3 | 0 | 0 | 336 | 261 | 4.915 | 3.104 | 2.100 | 0 | dentro |
| Tranquilo 0,5× | Regular (2/dia, economico) | 336 | 40 | 5 | 0 | 0 | 331 | 409 | 8.864 | 3.846 | 1.954 | 0 | dentro |
| Tranquilo 0,5× | Dedicado (4/dia, economico) | 336 | 46 | 7 | 0 | 0 | 129 | 243 | 820 | 1.130 | 398 | 0 | dentro |

Faixas cobradas:

| Ritmo | Perfil | População | Salão | Fome (h) | Frio (h) | Excedente de madeira | Excedente de pedra | Excedente de ouro | Recusas |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso | 13 a 17 | ≥ 1 | ≤ 0 | ≤ 0 | ≤ 5.551 | ≤ 493 | ≤ 439 | 0 |
| Rápido 3× | Regular | 13 a 17 | ≥ 1 | ≤ 0 | ≤ 0 | ≤ 6.036 | ≤ 1.623 | ≤ 1.753 | 0 |
| Rápido 3× | Dedicado | 22 a 28 | ≥ 2 | ≤ 0 | ≤ 0 | ≤ 8.841 | ≤ 2.948 | ≤ 1.671 | 0 |
| Normal 1× | Preguiçoso | 18 a 22 | ≥ 2 | ≤ 0 | ≤ 0 | ≤ 5.639 | ≤ 2.355 | ≤ 2.177 | 0 |
| Normal 1× | Regular | 30 a 38 | ≥ 3 | ≤ 0 | ≤ 0 | ≤ 10.222 | ≤ 4.406 | ≤ 1.899 | 0 |
| Normal 1× | Dedicado | 36 a 44 | ≥ 5 | ≤ 0 | ≤ 0 | ≤ 9.308 | ≤ 4.039 | ≤ 2.052 | 0 |
| Tranquilo 0,5× | Preguiçoso | 14 a 18 | ≥ 3 | ≤ 0 | ≤ 0 | ≤ 5.161 | ≤ 3.260 | ≤ 2.205 | 0 |
| Tranquilo 0,5× | Regular | 36 a 44 | ≥ 5 | ≤ 0 | ≤ 0 | ≤ 9.308 | ≤ 4.039 | ≤ 2.052 | 0 |
| Tranquilo 0,5× | Dedicado | 41 a 51 | ≥ 7 | ≤ 0 | ≤ 0 | ≤ 861 | ≤ 1.187 | ≤ 418 | 0 |

Todas as 900 partidas ficam dentro das faixas novas, e nenhum bot teve ordem recusada.

### 3.3 O que mudou em relação à seção 2, e por quê

População final, Salão e excedentes, antes (seção 2) e depois (esta rodada), nos 7 dias reais:

| Ritmo | Perfil | População | Salão | Madeira parada | Pedra parada | Ouro parado |
|---|---|---|---|---|---|---|
| Rápido 3× | Preguiçoso | 20 → 20 | 2 → 2 | 17.803 → 17.434 | 9.142 → 7.523 | 6.450 → 4.970 |
| Rápido 3× | Regular | 35 → 35 | 3 → 3 | 40.872 → 39.064 | 16.118 → 16.155 | 6.626 → 6.972 |
| Rápido 3× | Dedicado | 55 → 55 | 5 → 5 | 83.001 → 81.313 | 33.786 → 33.418 | 12.151 → 12.478 |
| Normal 1× | Preguiçoso | 12 → 20 | 2 → 2 | 5.515 → 5.370 | 1.846 → 2.242 | 1.921 → 2.073 |
| Normal 1× | Regular | 26 → 34 | 3 → 3 | 10.017 → 9.735 | 4.190 → 4.196 | 1.637 → 1.808 |
| Normal 1× | Dedicado | 17 → 40 | 5 → 5 | 2.068 → 8.864 | 1.145 → 3.846 | 676 → 1.954 |
| Tranquilo 0,5× | Preguiçoso | 11 → 12 | 2 → 2 | 2.443 → 2.650 | 814 → 1.160 | 674 → 770 |
| Tranquilo 0,5× | Regular | 12 → 18 | 3 → 3 | 1.609 → 2.150 | 710 → 949 | 409 → 552 |
| Tranquilo 0,5× | Dedicado | 14 → 20 | 4 → 4 | 470 → 783 | 316 → 460 | 182 → 345 |

- **A comida sobra mais, e o feudo cresce mais.** Toda partida nasce na primavera, com a Fazenda rendendo × 1,2, e o outono rende × 1,3. O bot `economico` põe na Fazenda só os braços que alimentam o feudo com duas bocas de folga; com cada fazendeiro rendendo mais, sobram braços para os materiais e comida para recrutar. No ritmo 1 o Regular passa de 26 para 34 aldeões e o Dedicado, de 17 para 40. É a mudança grande desta rodada, e ela vem do fator da primavera e do outono, não do recrutamento mais rápido (16 minutos em vez de 20 não mudam quantas ordens cabem em uma visita).
- **A meta do GDD §15.2 para o Regular (30 a 40 aldeões no dia 7) passa a ser atingida no ritmo 1**: 34. Na seção 2 a medida era 26.
- **O inverno custa comida, e ninguém passa fome.** Com × 0,4 na Fazenda, o saldo de comida do Regular no ritmo 3 chega a ficar negativo no inverno (até −47 por hora real, na semente `pedra-alta-golden`) e volta na primavera; o estoque acumulado no outono cobre. Fome continua zero em toda célula.
- **Ninguém passa frio.** A lenha de um inverno inteiro são 12 de madeira por habitante (0,5 por hora de jogo × 24 horas de jogo): 420 para os 35 aldeões do Regular, contra dezenas de milhares em estoque. Um lenhador no nível 1 rende 6,4 por hora de jogo no inverno, a lenha de quase 13 habitantes. **Enquanto não houver limite de estoque, a lenha não é uma decisão para quem tem alguém na Serraria.** Com o cap inicial de 500 (V2C-T2) ela passa a pesar: um feudo de 35 aldeões queima 420 no inverno, quase o cap inteiro. É a pergunta de balanceamento que esta tarefa deixa para V2C-T7.
- **Os excedentes continuam enormes** e a fila continua ociosa em quase todas as horas: são os sinais que os caps (V2C-T2) e o início automático (V2C-T5) atacam. O excedente de madeira cai um pouco no ritmo 3 (a lenha e o inverno a × 0,8) e sobe nas células em que o feudo cresceu.

### 3.4 Faixas

As faixas saem das medidas pela mesma regra da seção 2.3, com uma grandeza a mais:

| Grandeza | Faixa | Folga |
|---|---|---|
| Horas de frio | no máximo o maior valor medido | 5% (hoje a medida é zero em toda célula, e o limite também) |

`MEASURED`, em `packages/sim-cli/src/bands.ts`, traz a linha de base desta rodada. "Sem frio" passa a ser cobrado de todo bot em toda célula: quando os caps tornarem a lenha apertada, uma hora de frio em qualquer partida derruba o teste, e a tarefa decide se é regressão ou se é a mecânica trabalhando.

### 3.5 Limites desta medição

- **O frio não aparece na matriz.** A mecânica está provada nos testes do motor (`cold.test.ts`, as propriedades de divisão de intervalo, o golden da Crônica do inverno) e no teste de integração do servidor no ritmo 3, mas nenhum bot a encontra jogando. Não há, portanto, medida de quanto o frio custa a um feudo de verdade.
- **O bot não planeja o inverno pela comida.** Ele reage: realoca fazendeiros a cada visita conforme o que a Fazenda rende naquela hora. Com uma visita por dia real no ritmo 3 (um dia real são 36 dias de jogo), a visita pode cair no outono e a seguinte só na primavera; o estoque sem limite cobre a diferença. Com caps, é aí que a fome de inverno pode aparecer.
- As faixas continuam sendo o jogo de hoje, com folga, e não metas (seção 2.5).

## 4. Armazenamento: Celeiro, Armazém e limites (V2C-T2)

Tarefa V2C-T2. O estoque de comida, madeira e pedra passa a ter limite: 500 de cada no começo, 900 com o Celeiro (comida) ou o Armazém (madeira e pedra) no nível 1 e mais 600 por nível, vezes o fator da dificuldade (× 1,25 em Camponês, × 0,8 em Rei de Ferro). O que não cabe é desperdício contado. O ouro continua sem limite. Os números são os do GDD §5.5 e do [ADR 0013](decisions/0013-regras-da-v0.2-tempo-ritmo-migracao-e-economia.md), decisão 17; **nenhum outro número de conteúdo mudou**, e a recompensa do objetivo 4 deixou de ser +50 de ouro e voltou a ser o desbloqueio ([ADR 0002](decisions/0002-objetivo-4-v01.md)).

| | |
|---|---|
| Data | 2026-10-02 |
| Commit | o da tarefa V2C-T2 (`git log --grep V2C-T2`) |
| Identificação | Motor 0.1.0 · estado v4 · conteúdo cf22b9000fd9f485 |
| Dificuldade | Senhor (`lord`) na matriz; as outras duas na seção 4.6, sem faixa |
| Sementes | 50 fixas: `pedra-alta-001` a `pedra-alta-050` |
| Ritmos | Rápido 3×, Normal 1× e Tranquilo 0,5× |
| Máquina | Apple M5, Node 22.22.2 |

### 4.1 Auditoria de alcançabilidade (V2C-T2.5)

A pergunta: com o limite de cada dificuldade, **o custo de cada obra cabe no depósito que existe antes dela?** Só a madeira e a pedra importam: nenhuma obra custa comida, e o ouro não tem limite. Uma obra cujo custo passa do limite é recusada com `EXCEEDS_STORAGE` ("A obra pede 875 de madeira e o Pátio só guarda 500: construa o Armazém primeiro"), a menos que o estoque herdado de uma partida migrada já a pague.

Limite de madeira e de pedra por nível do Armazém:

| Dificuldade | Sem Armazém | Nv1 | Nv2 | Nv3 | Nv4 | Nv5 | Nv6 | Nv7 | Nv8 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Camponês (× 1,25) | 625 | 1.125 | 1.875 | 2.625 | 3.375 | 4.125 | 4.875 | 5.625 | 6.375 |
| Senhor (× 1) | 500 | 900 | 1.500 | 2.100 | 2.700 | 3.300 | 3.900 | 4.500 | 5.100 |
| Rei de Ferro (× 0,8) | 400 | 720 | 1.200 | 1.680 | 2.160 | 2.640 | 3.120 | 3.600 | 4.080 |

**O caminho até o Salão no nível 4 e os depósitos no nível 2** (o que a tarefa pede). A coluna de cada dificuldade diz o nível do Armazém que a obra exige: 0 é "cabe no limite inicial".

| Obra | Custo (madeira / pedra / ouro) | Camponês | Senhor | Rei de Ferro |
|---|---|:-:|:-:|:-:|
| Salão 1 → 2 | 150 / 100 / 100 | 0 | 0 | 0 |
| Salão 2 → 3 | 270 / 180 / 180 | 0 | 0 | 0 |
| Salão 3 → 4 | 486 / 324 / 324 | 0 | 0 | **1** |
| Celeiro 0 → 1 | 160 / 80 | 0 | 0 | 0 |
| Celeiro 1 → 2 | 256 / 128 | 0 | 0 | 0 |
| Armazém 0 → 1 | 160 / 80 | 0 | 0 | 0 |
| Armazém 1 → 2 | 256 / 128 | 0 | 0 | 0 |

**Não há trava nesse caminho.** Em Rei de Ferro o Salão 3 → 4 pede 486 de madeira e o limite inicial é 400: é preciso erguer o Armazém antes (160 de madeira e 80 de pedra, que cabem nos 400), e ele passa a guardar 720. É uma dependência, não um beco: o jogo diz o que fazer na recusa e na lista de obras. Em Senhor os 486 cabem nos 500 por 14 unidades.

**Nível do Armazém que cada obra exige em Senhor, do começo ao nível máximo.** Cada item é "custo em madeira / nível do Armazém"; X é "não cabe em nível nenhum".

| Edifício | Obras |
|---|---|
| Salão do Senhor | 1→2: 150/0 · 2→3: 270/0 · 3→4: 486/0 · 4→5: 875/1 · 5→6: 1.575/3 · 6→7: 2.834/5 · **7→8: 5.102/X** |
| Fazenda, Habitações | 1→2: 80/0 · 2→3: 128/0 · 3→4: 205/0 · 4→5: 328/0 · 5→6: 524/1 · 6→7: 839/1 · 7→8: 1.342/2 · 8→9: 2.147/4 · 9→10: 3.436/6 |
| Serraria | 1→2: 100/0 · 2→3: 160/0 · 3→4: 256/0 · 4→5: 410/0 · 5→6: 655/1 · 6→7: 1.049/2 · 7→8: 1.678/3 · 8→9: 2.684/4 · 9→10: 4.295/7 |
| Pedreira, Mina de Ouro | 1→2: 120/0 · 2→3: 192/0 · 3→4: 307/0 · 4→5: 492/0 · 5→6: 786/1 · 6→7: 1.258/2 · 7→8: 2.013/3 · 8→9: 3.221/5 · **9→10: 5.154/X** |
| Celeiro, Armazém | 0→1: 160/0 · 1→2: 256/0 · 2→3: 410/0 · 3→4: 655/1 · 4→5: 1.049/2 · 5→6: 1.678/3 · 6→7: 2.684/4 · 7→8: 4.295/7 |

**Travas encontradas, todas além do Salão no nível 7** (nenhum número foi mudado; vão ao autor):

| Dificuldade | O que não cabe | Por quê |
|---|---|---|
| Senhor | Salão 7 → 8 | Custa 5.102 de madeira; o Armazém no nível máximo guarda 5.100. **Faltam 2 unidades** |
| Senhor | Pedreira 9 → 10 e Mina de Ouro 9 → 10 | Custam 5.154 de madeira; o máximo é 5.100 |
| Rei de Ferro | Armazém 7 → 8 e Celeiro 7 → 8 | Custam 4.295 de madeira; o Armazém no nível 7 guarda 3.600. O Armazém para no nível 7 |
| Rei de Ferro | Salão 7 → 8, Serraria 9 → 10, Pedreira 9 → 10 e Mina de Ouro 9 → 10 | Custam de 4.295 a 5.154; o limite alcançável é 3.600 |
| Camponês | nada | Tudo cabe |

Em Senhor e em Rei de Ferro **o Salão não chega ao nível 8**, e com ele os edifícios presos ao "Salão mais um" param no nível 8. Nenhum bot da matriz chega perto (o melhor termina um ano no nível 6), e a recusa diz "não há como juntar tanto" quando o próprio depósito é a obra que não cabe. É um defeito de balanceamento de fim de jogo, não da v0.2 jogável; a lista está congelada em um teste do motor (`storage.test.ts`, "alcançabilidade") para que mexer em custo ou em capacidade a mude de propósito.

### 4.2 Perfis

Os mesmos da seção 3.1, com uma política a mais em cada bot e uma mudança em outra:

| Perfil | Sessões por dia real | Bot | Políticas do bot, na ordem |
|---|---:|---|---|
| Preguiçoso | 1 | `preguicoso` | recrutar, obra mais barata, ampliar o estoque, comida primeiro, ocupar os livres, guardar lenha |
| Regular | 2 | `economico` | recrutar, obra mais barata, ampliar o estoque, alocar por demanda, guardar lenha |
| Dedicado | 4 | `economico` | recrutar, obra mais barata, ampliar o estoque, alocar por demanda, guardar lenha |

`ampliar o estoque` constrói ou melhora o depósito que vale a obra agora: o que trava uma obra cujo custo não cabe, o que está cheio e perdendo produção e o que enche em menos de 8 horas reais. `obra mais barata` deixou de contar os depósitos entre as obras baratas: eles são um meio, e quem decide é a política nova. Como a fila é uma só e `ampliar o estoque` vem depois, o depósito fica com a visita em que nenhuma outra obra pôde começar (seção 4.5).

### 4.3 Comando e saída

```bash
pnpm -s sim -- --matrix > matriz.csv 2> matriz.md
```

900 linhas no CSV e 750 partidas distintas, como antes; a rodada leva cerca de 5 s. As tabelas ganharam quatro colunas: o **desperdício** de comida, de madeira e de pedra (o que não coube no depósito na partida inteira, em unidades) e **Desperdiçando (h)**, as horas reais com ao menos um depósito cheio e perdendo produção. No CSV são as colunas `wasted_food`, `wasted_wood` e `wasted_stone`, que deixaram de sair vazias.

#### Tabela 1: 7 dias reais

| Ritmo | Perfil | Anos de jogo | População | Salão | Fome (h) | Frio (h) | Fila ociosa (h) | Sem ofício (aldeão-h) | Excedente de madeira | Excedente de pedra | Excedente de ouro | Desperdício de comida | Desperdício de madeira | Desperdício de pedra | Desperdiçando (h) | Recusas | Faixa |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso (1/dia, preguicoso) | 3 | 20 | 2 | 0 | 0 | 168 | 360 | 500 | 500 | 4.920 | 12.273 | 16.934 | 7.023 | 163 | 0 | dentro |
| Rápido 3× | Regular (2/dia, economico) | 3 | 35 | 3 | 0 | 0 | 168 | 360 | 500 | 500 | 1.169 | 4.580 | 63.197 | 8.075 | 160 | 0 | dentro |
| Rápido 3× | Dedicado (4/dia, economico) | 3 | 55 | 5 | 0 | 0 | 168 | 300 | 900 | 900 | 1.732 | 3.445 | 110.303 | 25.556 | 160 | 0 | dentro |
| Normal 1× | Preguiçoso (1/dia, preguicoso) | 1 | 20 | 2 | 0 | 0 | 168 | 357 | 500 | 500 | 2.023 | 732 | 4.870 | 1.742 | 148 | 0 | dentro |
| Normal 1× | Regular (2/dia, economico) | 1 | 34 | 3 | 0 | 0 | 168 | 344 | 500 | 500 | 425 | 0 | 15.384 | 1.585 | 136 | 0 | dentro |
| Normal 1× | Dedicado (4/dia, economico) | 1 | 40 | 5 | 0 | 0 | 168 | 210 | 900 | 900 | 836 | 0 | 12.299 | 2.040 | 109 | 0 | dentro |
| Tranquilo 0,5× | Preguiçoso (1/dia, preguicoso) | 0,5 | 12 | 2 | 0 | 0 | 168 | 165 | 500 | 500 | 720 | 0 | 2.150 | 660 | 113 | 0 | dentro |
| Tranquilo 0,5× | Regular (2/dia, economico) | 0,5 | 18 | 3 | 0 | 0 | 167 | 153 | 500 | 500 | 189 | 0 | 2.817 | 153 | 83 | 0 | dentro |
| Tranquilo 0,5× | Dedicado (4/dia, economico) | 0,5 | 22 | 4 | 0 | 0 | 130 | 101 | 1.143 | 646 | 123 | 0 | 0 | 0 | 0 | 0 | dentro |

Faixas cobradas:

| Ritmo | Perfil | População | Salão | Fome (h) | Frio (h) | Excedente de madeira | Excedente de pedra | Excedente de ouro | Recusas |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso | 18 a 22 | ≥ 2 | ≤ 0 | ≤ 0 | ≤ 525 | ≤ 525 | ≤ 5.166 | 0 |
| Rápido 3× | Regular | 31 a 39 | ≥ 3 | ≤ 0 | ≤ 0 | ≤ 525 | ≤ 525 | ≤ 1.228 | 0 |
| Rápido 3× | Dedicado | 49 a 61 | ≥ 5 | ≤ 0 | ≤ 0 | ≤ 945 | ≤ 945 | ≤ 1.819 | 0 |
| Normal 1× | Preguiçoso | 18 a 22 | ≥ 2 | ≤ 0 | ≤ 0 | ≤ 525 | ≤ 525 | ≤ 2.125 | 0 |
| Normal 1× | Regular | 30 a 38 | ≥ 3 | ≤ 0 | ≤ 0 | ≤ 525 | ≤ 525 | ≤ 447 | 0 |
| Normal 1× | Dedicado | 36 a 44 | ≥ 5 | ≤ 0 | ≤ 0 | ≤ 945 | ≤ 945 | ≤ 878 | 0 |
| Tranquilo 0,5× | Preguiçoso | 10 a 14 | ≥ 2 | ≤ 0 | ≤ 0 | ≤ 525 | ≤ 525 | ≤ 756 | 0 |
| Tranquilo 0,5× | Regular | 16 a 20 | ≥ 3 | ≤ 0 | ≤ 0 | ≤ 525 | ≤ 525 | ≤ 199 | 0 |
| Tranquilo 0,5× | Dedicado | 19 a 25 | ≥ 4 | ≤ 0 | ≤ 0 | ≤ 1.201 | ≤ 679 | ≤ 130 | 0 |

#### Tabela 2: um ano de jogo

| Ritmo | Perfil | Horas reais | População | Salão | Fome (h) | Frio (h) | Fila ociosa (h) | Sem ofício (aldeão-h) | Excedente de madeira | Excedente de pedra | Excedente de ouro | Desperdício de comida | Desperdício de madeira | Desperdício de pedra | Desperdiçando (h) | Recusas | Faixa |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso (1/dia, preguicoso) | 56 | 15 | 1 | 0 | 0 | 56 | 192 | 500 | 469 | 418 | 897 | 4.786 | 0 | 51 | 0 | dentro |
| Rápido 3× | Regular (2/dia, economico) | 56 | 15 | 1 | 0 | 0 | 56 | 120 | 500 | 420 | 397 | 1.026 | 9.273 | 502 | 48 | 0 | dentro |
| Rápido 3× | Dedicado (4/dia, economico) | 56 | 25 | 2 | 0 | 0 | 56 | 120 | 500 | 500 | 317 | 84 | 12.984 | 862 | 48 | 0 | dentro |
| Normal 1× | Preguiçoso (1/dia, preguicoso) | 168 | 20 | 2 | 0 | 0 | 168 | 357 | 500 | 500 | 2.023 | 732 | 4.870 | 1.742 | 148 | 0 | dentro |
| Normal 1× | Regular (2/dia, economico) | 168 | 34 | 3 | 0 | 0 | 168 | 344 | 500 | 500 | 425 | 0 | 15.384 | 1.585 | 136 | 0 | dentro |
| Normal 1× | Dedicado (4/dia, economico) | 168 | 40 | 5 | 0 | 0 | 168 | 210 | 900 | 900 | 836 | 0 | 12.299 | 2.040 | 109 | 0 | dentro |
| Tranquilo 0,5× | Preguiçoso (1/dia, preguicoso) | 336 | 16 | 3 | 0 | 0 | 336 | 261 | 500 | 500 | 2.050 | 0 | 4.764 | 2.385 | 257 | 0 | dentro |
| Tranquilo 0,5× | Regular (2/dia, economico) | 336 | 40 | 5 | 0 | 0 | 328 | 408 | 900 | 900 | 836 | 0 | 12.299 | 2.040 | 207 | 0 | dentro |
| Tranquilo 0,5× | Dedicado (4/dia, economico) | 336 | 44 | 6 | 0 | 0 | 282 | 232 | 3.244 | 2.137 | 1.235 | 0 | 0 | 0 | 0 | 0 | dentro |

Faixas cobradas:

| Ritmo | Perfil | População | Salão | Fome (h) | Frio (h) | Excedente de madeira | Excedente de pedra | Excedente de ouro | Recusas |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso | 13 a 17 | ≥ 1 | ≤ 0 | ≤ 0 | ≤ 525 | ≤ 493 | ≤ 439 | 0 |
| Rápido 3× | Regular | 13 a 17 | ≥ 1 | ≤ 0 | ≤ 0 | ≤ 525 | ≤ 441 | ≤ 417 | 0 |
| Rápido 3× | Dedicado | 22 a 28 | ≥ 2 | ≤ 0 | ≤ 0 | ≤ 525 | ≤ 525 | ≤ 333 | 0 |
| Normal 1× | Preguiçoso | 18 a 22 | ≥ 2 | ≤ 0 | ≤ 0 | ≤ 525 | ≤ 525 | ≤ 2.125 | 0 |
| Normal 1× | Regular | 30 a 38 | ≥ 3 | ≤ 0 | ≤ 0 | ≤ 525 | ≤ 525 | ≤ 447 | 0 |
| Normal 1× | Dedicado | 36 a 44 | ≥ 5 | ≤ 0 | ≤ 0 | ≤ 945 | ≤ 945 | ≤ 878 | 0 |
| Tranquilo 0,5× | Preguiçoso | 14 a 18 | ≥ 3 | ≤ 0 | ≤ 0 | ≤ 525 | ≤ 525 | ≤ 2.153 | 0 |
| Tranquilo 0,5× | Regular | 36 a 44 | ≥ 5 | ≤ 0 | ≤ 0 | ≤ 945 | ≤ 945 | ≤ 878 | 0 |
| Tranquilo 0,5× | Dedicado | 39 a 49 | ≥ 6 | ≤ 0 | ≤ 0 | ≤ 3.407 | ≤ 2.244 | ≤ 1.297 | 0 |

Todas as 900 partidas ficam dentro das faixas novas, e nenhum bot teve ordem recusada.

### 4.4 O que mudou em relação à seção 3, e por quê

População final, Salão e madeira, antes (seção 3) e depois (esta rodada), nos 7 dias reais. "Madeira parada" é o estoque final; "madeira perdida", o desperdício da semana.

| Ritmo | Perfil | População | Salão | Madeira parada | Madeira perdida |
|---|---|---|---|---|---|
| Rápido 3× | Preguiçoso | 20 → 20 | 2 → 2 | 17.434 → 500 | 16.934 |
| Rápido 3× | Regular | 35 → 35 | 3 → 3 | 39.064 → 500 | 63.197 |
| Rápido 3× | Dedicado | 55 → 55 | 5 → 5 | 81.313 → 900 | 110.303 |
| Normal 1× | Preguiçoso | 20 → 20 | 2 → 2 | 5.370 → 500 | 4.870 |
| Normal 1× | Regular | 34 → 34 | 3 → 3 | 9.735 → 500 | 15.384 |
| Normal 1× | Dedicado | 40 → 40 | 5 → 5 | 8.864 → 900 | 12.299 |
| Tranquilo 0,5× | Preguiçoso | 12 → 12 | 2 → 2 | 2.650 → 500 | 2.150 |
| Tranquilo 0,5× | Regular | 18 → 18 | 3 → 3 | 2.150 → 500 | 2.817 |
| Tranquilo 0,5× | Dedicado | 20 → 22 | 4 → 4 | 783 → 1.143 | 0 |

- **O excedente parado virou desperdício, e o feudo anda no mesmo passo.** População e Salão são os da seção 3 em quase toda célula. A madeira que antes se empilhava sem uso agora para no limite, e o que passa dele vai ao chão: no Regular do ritmo 3, 63 mil unidades em uma semana, mais do que as 39 mil que ficavam paradas, porque o bot continua alocando lenhadores (a alocação por demanda reparte os braços pelos materiais sem olhar se o depósito está cheio).
- **Nenhuma obra dos bots ficou sem madeira.** Com uma fila só e uma obra por visita, o estoque só precisa pagar a próxima obra, e até o Salão no nível 4 tudo cabe nos 500 de Senhor (seção 4.1). O Dedicado é o único que esbarra no limite em uma semana: o Salão 4 → 5 pede 875 de madeira, ele ergue o Armazém (900) e segue até o nível 5.
- **Os depósitos cheios são a regra, não a exceção.** No ritmo 1 o Regular passa 136 das 168 horas com ao menos um depósito perdendo produção; no ritmo 3, 160. Só o Dedicado do ritmo 0,5, que gasta o que produz, não perde nada. A meta do GDD §15.2 ("nenhum recurso desperdiçando no cap por mais de 8 h de jogo contínuas", perfil Regular) **está longe de ser atingida**: é a pergunta de balanceamento que esta tarefa deixa para V2C-T7, junto com a segunda fila e o início automático (V2C-T5), que dão ao estoque onde ser gasto.
- **Ninguém passa frio nem fome.** O inverno de 35 aldeões queima 420 de madeira e o Pátio guarda 500; a Serraria repõe. A lenha passou a caber justa no limite, mas a conta ainda fecha sozinha.
- **O ouro parado caiu** (no Regular do ritmo 3, de 6.972 para 1.169), e não por limite, que o ouro não tem. A alocação por demanda reparte os braços pelo que falta às obras: com a madeira e a pedra limitadas, sempre falta para a soma das obras e os braços vão para elas; antes, com milhares em estoque, nada faltava e um em cada seis braços ia para a Mina. O objetivo 4 também deixou de pagar 50 de ouro.
- **O ano de jogo no ritmo 0,5 perdeu um nível de Salão no Dedicado** (7 → 6) e dois aldeões (46 → 44): com 4 visitas por dia em 14 dias reais ele chega aonde o limite pesa. O Salão 6 → 7 pede 2.834 de madeira, e antes disso o Armazém tem de subir até o nível 5.

### 4.5 A ordem da política de depósito

Uma primeira versão punha `ampliar o estoque` **antes** de `obra mais barata` e deixava os depósitos entre as obras baratas. Medida com as mesmas regras, 7 dias reais:

| Ritmo | Perfil e ordem | População | Salão | Depósitos ao fim | Madeira perdida |
|---|---|---|---|---|---|
| Rápido 3× | Regular, depósito primeiro | 25 | 2 | Celeiro Nv2, Armazém Nv3 | 50.544 |
| Rápido 3× | Regular, obra primeiro (a adotada) | 35 | 3 | nenhum | 63.197 |
| Normal 1× | Regular, depósito primeiro | 25 | 2 | Celeiro Nv1, Armazém Nv3 | 10.544 |
| Normal 1× | Regular, obra primeiro (a adotada) | 34 | 3 | nenhum | 15.384 |
| Normal 1× | Dedicado, depósito primeiro | 35 | 4 | não anotado | 9.863 |
| Normal 1× | Dedicado, obra primeiro (a adotada) | 40 | 5 | Armazém Nv1 | 12.299 |

Com o depósito primeiro, a cada visita há um estoque enchendo, a fila vai para ele, e o Regular perde um nível de Salão e cerca de dez aldeões para desperdiçar de um quinto a um terço a menos. **Com uma fila só, ampliar o depósito custa uma visita e não compra progresso**: o estoque a mais não tem onde ser gasto antes da visita seguinte. A ordem adotada mantém o progresso e usa o depósito quando ele destrava uma obra ou quando sobra a visita.

Isso é uma medida do bot, mas também diz algo do jogo: **hoje o limite não muda a decisão de quem joga pelo progresso**, só o que ele vê sumir. A escolha "ampliar ou gastar" que a mecânica quer criar (roadmap, V2C-T2, "Diversão") passa a pesar quando houver o que fazer com o estoque guardado: a segunda fila e o início automático (V2C-T5), as cartas que cobram recursos (Fase D) e as incursões (Fase E).

### 4.6 As outras dificuldades (uma semente, sem faixa)

`pnpm -s sim -- --matrix --seeds 1 --difficulty ironKing` e `--difficulty peasant`. 7 dias reais, perfil Regular:

| Dificuldade | Ritmo | População | Salão | Madeira parada | Madeira perdida | Desperdiçando (h) | Recusas |
|---|---|---|---|---|---|---|---|
| Camponês | Rápido 3× | 35 | 3 | 625 | 68.201 | 157 | 0 |
| Camponês | Normal 1× | 34 | 3 | 625 | 16.413 | 131 | 0 |
| Senhor | Rápido 3× | 35 | 3 | 500 | 63.197 | 160 | 0 |
| Senhor | Normal 1× | 34 | 3 | 500 | 15.384 | 136 | 0 |
| Rei de Ferro | Rápido 3× | 35 | 3 | 400 | 59.133 | 162 | 0 |
| Rei de Ferro | Normal 1× | 32 | 3 | 400 | 14.453 | 139 | 0 |

A dificuldade passou a mudar o jogo, e pouco: o Regular de Rei de Ferro termina o ritmo 1 com 32 aldeões em vez de 34. Sem fome, sem frio e sem ordem recusada em nenhuma das 36 células das duas rodadas. As faixas das outras dificuldades ficam para V2C-T7.

### 4.7 Faixas

As faixas saem das medidas pela regra da seção 2.3. `MEASURED`, em `packages/sim-cli/src/bands.ts`, traz a linha de base desta rodada. O teto do **excedente parado** de madeira e de pedra caiu para o limite do depósito com 5% de folga (525 onde ninguém ergue o Armazém): deixou de ser um sinal e virou uma garantia da regra. O desperdício e as horas desperdiçando são medidos e relatados, e **não têm faixa** ainda: o limite deles é decisão de balanceamento (V2C-T7).

### 4.8 Limites desta medição

- **O bot não reage ao depósito cheio na alocação.** `alocar por demanda` e `ocupar os livres` continuam mandando braços para o material que vai ao chão. Um jogador os mandaria para o ouro, que não tem limite, ou para a comida. O desperdício medido é, por isso, um teto do que um jogador perderia, não uma estimativa.
- **Os bots quase não usam o Celeiro.** A comida do bot econômico fica perto do equilíbrio (duas bocas de folga), e a Despensa de 500 basta. No ritmo 3 a comida enche e se perde (4.580 na semana do Regular), e mesmo assim nenhuma visita sobra para o Celeiro.
- **A Crônica não está na medida.** O fecho diário do desperdício não entra nela ([ADR 0015](decisions/0015-cronica-sem-o-fecho-diario-do-desperdicio.md)); o que entra é uma linha por episódio de depósito cheio, e nenhum número aqui diz se ela é demais.
- **A comparação da seção 4.5 foi medida com uma semente**, durante a tarefa, antes de a ordem adotada ser a do código; os números da ordem descartada não se repetem com o código de hoje sem trocar a ordem das políticas à mão.
- As faixas continuam sendo o jogo de hoje, com folga, e não metas (seção 2.5).

## 5. Segunda fila e início automático das planejadas (V2C-T5)

Tarefa V2C-T5. O Salão no nível 4 abre uma segunda fila de obras, e uma obra planejada pode ser marcada "iniciar quando houver recursos": o motor a inicia sozinho, na ordem da lista e pulando as que não podem começar, no instante exato em que a fila e o estoque permitem (GDD §6.3; [ADR 0013](decisions/0013-regras-da-v0.2-tempo-ritmo-migracao-e-economia.md), decisão 18). Os dois números novos são `construction.queues: 2` e `secondQueueTownHallLevel: 4`; **nenhum custo, taxa, prazo ou limite mudou**.

| | |
|---|---|
| Data | 2026-10-02 |
| Commit | o da tarefa V2C-T5 (`git log --grep V2C-T5`) |
| Identificação | Motor 0.1.0 · estado v5 · conteúdo 525e602065de69c7 |
| Dificuldade | Senhor (`lord`) na matriz; as outras duas na seção 5.6, sem faixa |
| Sementes | 50 fixas: `pedra-alta-001` a `pedra-alta-050` |
| Ritmos | Rápido 3×, Normal 1× e Tranquilo 0,5× |
| Máquina | Apple M5, Node 24.19.0 |

### 5.1 Perfis

Os mesmos das seções anteriores, com uma política a mais em cada bot e o recrutamento depois das obras:

| Perfil | Sessões por dia real | Bot | Políticas do bot, na ordem |
|---|---:|---|---|
| Preguiçoso | 1 | `preguicoso` | obra mais barata, ampliar o estoque, planejar automáticas, recrutar, comida primeiro, ocupar os livres, guardar lenha |
| Regular | 2 | `economico` | obra mais barata, ampliar o estoque, planejar automáticas, recrutar, alocar por demanda, guardar lenha |
| Dedicado | 4 | `economico` | obra mais barata, ampliar o estoque, planejar automáticas, recrutar, alocar por demanda, guardar lenha |

`planejar automáticas` deixa na lista, como automáticas, as obras que a visita não iniciou: primeiro o depósito que `ampliar o estoque` queria e não pôde começar, depois as outras, da mais barata à mais cara. Entram também as que esperam o Salão ou um depósito maior; elas começam quando destravar. Enquanto a conta da lenha da visão diz que a lareira depende do estoque, o bot não deixa automática nenhuma obra que gaste madeira (nesta rodada isso não aconteceu em nenhuma partida: a Serraria sempre repõe mais do que o inverno queima). O jogo aceita uma planejada por edifício, então a lista tem no máximo oito.

### 5.2 Comando e saída

```bash
pnpm -s sim -- --matrix > matriz.csv 2> matriz.md
```

900 linhas no CSV e 750 partidas distintas, como antes; a rodada leva cerca de 7 s (as partidas ficaram mais longas em ordens e em eventos).

#### Tabela 1: 7 dias reais

| Ritmo | Perfil | Anos de jogo | População | Salão | Fome (h) | Frio (h) | Fila ociosa (h) | Sem ofício (aldeão-h) | Excedente de madeira | Excedente de pedra | Excedente de ouro | Desperdício de comida | Desperdício de madeira | Desperdício de pedra | Desperdiçando (h) | Recusas | Faixa |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso (1/dia, preguicoso) | 3 | 33 | 6 | 0 | 0 | 91 | 672 | 3.300 | 1.023 | 3.738 | 7.787 | 35.340 | 410 | 112 | 0 | dentro |
| Rápido 3× | Regular (2/dia, economico) | 3 | 64 | 7 | 0 | 0 | 123 | 708 | 5.100 | 5.100 | 9.409 | 2.719 | 90.447 | 20.890 | 87 | 0 | dentro |
| Rápido 3× | Dedicado (4/dia, economico) | 3 | 75 | 7 | 0 | 0 | 114 | 420 | 5.100 | 5.100 | 27.444 | 512 | 142.729 | 62.386 | 88 | 0 | dentro |
| Normal 1× | Preguiçoso (1/dia, preguicoso) | 1 | 30 | 5 | 0 | 0 | 35 | 594 | 594 | 1.482 | 2.068 | 0 | 587 | 0 | 16 | 0 | dentro |
| Normal 1× | Regular (2/dia, economico) | 1 | 45 | 6 | 0 | 0 | 100 | 474 | 501 | 1.106 | 874 | 0 | 455 | 0 | 3 | 0 | dentro |
| Normal 1× | Dedicado (4/dia, economico) | 1 | 45 | 6 | 0 | 0 | 103 | 240 | 2.056 | 1.581 | 1.595 | 0 | 0 | 0 | 0 | 0 | dentro |
| Tranquilo 0,5× | Preguiçoso (1/dia, preguicoso) | 0,5 | 13 | 4 | 0 | 0 | 67 | 189 | 21 | 500 | 70 | 0 | 57 | 0 | 3 | 0 | dentro |
| Tranquilo 0,5× | Regular (2/dia, economico) | 0,5 | 22 | 4 | 0 | 0 | 65 | 199 | 417 | 338 | 149 | 0 | 61 | 0 | 3 | 0 | dentro |
| Tranquilo 0,5× | Dedicado (4/dia, economico) | 0,5 | 22 | 4 | 0 | 0 | 73 | 101 | 327 | 571 | 134 | 0 | 0 | 0 | 0 | 0 | dentro |

Faixas cobradas:

| Ritmo | Perfil | População | Salão | Fome (h) | Frio (h) | Excedente de madeira | Excedente de pedra | Excedente de ouro | Recusas |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso | 29 a 37 | ≥ 6 | ≤ 0 | ≤ 0 | ≤ 3.465 | ≤ 1.075 | ≤ 3.925 | 0 |
| Rápido 3× | Regular | 57 a 71 | ≥ 7 | ≤ 0 | ≤ 0 | ≤ 5.355 | ≤ 5.355 | ≤ 9.880 | 0 |
| Rápido 3× | Dedicado | 67 a 83 | ≥ 7 | ≤ 0 | ≤ 0 | ≤ 5.355 | ≤ 5.355 | ≤ 28.817 | 0 |
| Normal 1× | Preguiçoso | 27 a 33 | ≥ 5 | ≤ 0 | ≤ 0 | ≤ 624 | ≤ 1.557 | ≤ 2.172 | 0 |
| Normal 1× | Regular | 40 a 50 | ≥ 6 | ≤ 0 | ≤ 0 | ≤ 527 | ≤ 1.162 | ≤ 918 | 0 |
| Normal 1× | Dedicado | 40 a 50 | ≥ 6 | ≤ 0 | ≤ 0 | ≤ 2.159 | ≤ 1.661 | ≤ 1.675 | 0 |
| Tranquilo 0,5× | Preguiçoso | 11 a 15 | ≥ 4 | ≤ 0 | ≤ 0 | ≤ 23 | ≤ 525 | ≤ 74 | 0 |
| Tranquilo 0,5× | Regular | 19 a 25 | ≥ 4 | ≤ 0 | ≤ 0 | ≤ 438 | ≤ 355 | ≤ 157 | 0 |
| Tranquilo 0,5× | Dedicado | 19 a 25 | ≥ 4 | ≤ 0 | ≤ 0 | ≤ 344 | ≤ 600 | ≤ 141 | 0 |

#### Tabela 2: um ano de jogo

| Ritmo | Perfil | Horas reais | População | Salão | Fome (h) | Frio (h) | Fila ociosa (h) | Sem ofício (aldeão-h) | Excedente de madeira | Excedente de pedra | Excedente de ouro | Desperdício de comida | Desperdício de madeira | Desperdício de pedra | Desperdiçando (h) | Recusas | Faixa |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso (1/dia, preguicoso) | 56 | 13 | 3 | 0 | 0 | 21 | 176 | 456 | 356 | 130 | 55 | 3.470 | 0 | 34 | 0 | dentro |
| Rápido 3× | Regular (2/dia, economico) | 56 | 19 | 5 | 0 | 0 | 29 | 168 | 245 | 336 | 630 | 530 | 1.042 | 14 | 16 | 0 | dentro |
| Rápido 3× | Dedicado (4/dia, economico) | 56 | 34 | 5 | 0 | 0 | 22 | 154 | 1.334 | 863 | 500 | 0 | 738 | 0 | 4 | 0 | dentro |
| Normal 1× | Preguiçoso (1/dia, preguicoso) | 168 | 30 | 5 | 0 | 0 | 35 | 594 | 594 | 1.482 | 2.068 | 0 | 587 | 0 | 16 | 0 | dentro |
| Normal 1× | Regular (2/dia, economico) | 168 | 45 | 6 | 0 | 0 | 100 | 474 | 501 | 1.106 | 874 | 0 | 455 | 0 | 3 | 0 | dentro |
| Normal 1× | Dedicado (4/dia, economico) | 168 | 45 | 6 | 0 | 0 | 103 | 240 | 2.056 | 1.581 | 1.595 | 0 | 0 | 0 | 0 | 0 | dentro |
| Tranquilo 0,5× | Preguiçoso (1/dia, preguicoso) | 336 | 22 | 5 | 0 | 0 | 195 | 403 | 1.709 | 911 | 1.173 | 0 | 57 | 41 | 6 | 0 | dentro |
| Tranquilo 0,5× | Regular (2/dia, economico) | 336 | 46 | 6 | 0 | 0 | 217 | 477 | 2.315 | 1.690 | 1.675 | 0 | 96 | 0 | 4 | 0 | dentro |
| Tranquilo 0,5× | Dedicado (4/dia, economico) | 336 | 45 | 6 | 0 | 0 | 226 | 237 | 3.232 | 2.224 | 1.692 | 0 | 759 | 0 | 5 | 0 | dentro |

Faixas cobradas:

| Ritmo | Perfil | População | Salão | Fome (h) | Frio (h) | Excedente de madeira | Excedente de pedra | Excedente de ouro | Recusas |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso | 11 a 15 | ≥ 3 | ≤ 0 | ≤ 0 | ≤ 479 | ≤ 374 | ≤ 137 | 0 |
| Rápido 3× | Regular | 17 a 21 | ≥ 5 | ≤ 0 | ≤ 0 | ≤ 258 | ≤ 353 | ≤ 662 | 0 |
| Rápido 3× | Dedicado | 30 a 38 | ≥ 5 | ≤ 0 | ≤ 0 | ≤ 1.401 | ≤ 907 | ≤ 525 | 0 |
| Normal 1× | Preguiçoso | 27 a 33 | ≥ 5 | ≤ 0 | ≤ 0 | ≤ 624 | ≤ 1.557 | ≤ 2.172 | 0 |
| Normal 1× | Regular | 40 a 50 | ≥ 6 | ≤ 0 | ≤ 0 | ≤ 527 | ≤ 1.162 | ≤ 918 | 0 |
| Normal 1× | Dedicado | 40 a 50 | ≥ 6 | ≤ 0 | ≤ 0 | ≤ 2.159 | ≤ 1.661 | ≤ 1.675 | 0 |
| Tranquilo 0,5× | Preguiçoso | 19 a 25 | ≥ 5 | ≤ 0 | ≤ 0 | ≤ 1.795 | ≤ 957 | ≤ 1.232 | 0 |
| Tranquilo 0,5× | Regular | 41 a 51 | ≥ 6 | ≤ 0 | ≤ 0 | ≤ 2.431 | ≤ 1.775 | ≤ 1.759 | 0 |
| Tranquilo 0,5× | Dedicado | 40 a 50 | ≥ 6 | ≤ 0 | ≤ 0 | ≤ 3.394 | ≤ 2.336 | ≤ 1.777 | 0 |

Todas as 900 partidas ficam dentro das faixas novas, e nenhum bot teve ordem recusada. Nenhuma passa fome nem frio.

### 5.3 A fila ociosa, antes e depois

É o que a tarefa pede medir (roadmap, V2C-T5, "Diversão"): o jogador de uma visita por dia. As três colunas do meio são a mesma semente (`pedra-alta-001`), 7 dias reais: a seção 4 (antes da tarefa), a **partida de controle** (o bot de hoje, com as mesmas planejadas entrando como **manuais**: `simulate({ ..., manualPlans: true })`) e a partida de hoje. As horas são reais, de 168.

| Ritmo | Perfil | Fila ociosa na seção 4 | Controle: fila ociosa (com planejada que podia começar) | Hoje: fila ociosa (com planejada que podia começar) | Salão (controle → hoje) | População (controle → hoje) | Horas com depósito perdendo produção (controle → hoje) |
|---|---|---:|---:|---:|---|---|---|
| Rápido 3× | Preguiçoso | 168 | 168 (168) | 91 (0) | 2 → 6 | 20 → 33 | 163 → 112 |
| Rápido 3× | Regular | 168 | 168 (168) | 123 (0) | 3 → 7 | 35 → 64 | 160 → 87 |
| Rápido 3× | Dedicado | 168 | 168 (168) | 114 (0) | 5 → 7 | 55 → 75 | 153 → 88 |
| Normal 1× | Preguiçoso | 168 | 168 (168) | 35 (0) | 2 → 5 | 20 → 30 | 148 → 16 |
| Normal 1× | Regular | 168 | 168 (168) | 100 (0) | 3 → 6 | 34 → 45 | 136 → 3 |
| Normal 1× | Dedicado | 168 | 167 (166) | 103 (0) | 5 → 6 | 40 → 45 | 67 → 0 |
| Tranquilo 0,5× | Preguiçoso | 168 | 168 (168) | 67 (0) | 2 → 4 | 12 → 13 | 113 → 3 |
| Tranquilo 0,5× | Regular | 167 | 167 (167) | 65 (0) | 3 → 4 | 18 → 22 | 83 → 3 |
| Tranquilo 0,5× | Dedicado | 130 | 130 (89) | 73 (0) | 4 → 4 | 22 → 22 | 0 → 0 |

O resumo de uma partida (`pnpm -s sim -- --seed …`) passou a trazer essa comparação em duas linhas, jogando a partida de controle junto:

```text
Fila ociosa: 35 h com obra que podia começar (0 h com obra planejada)
Sem o início automático (as mesmas planejadas, manuais): 168 h com obra que podia começar (168 h com obra planejada)
```

- **A fila com planejada que podia começar caiu a zero em todas as células.** É a medida do roadmap ("a fila ociosa com planejadas viáveis deve cair para perto de zero no perfil de 1 visita por dia"): uma planejada automática que pode começar não fica na lista. Com as mesmas planejadas manuais, a fila fica parada com obra planejada e paga a semana inteira.
- **A fila ociosa com qualquer obra cai, mas não a zero**: de 168 para 35 horas no Preguiçoso do ritmo Normal, 67 no Tranquilo e 91 no Rápido. O que sobra é obra que podia começar e **não estava na lista**. O jogo aceita uma planejada por edifício: depois que a planejada de um edifício começa, o nível seguinte dele só entra na lista na próxima visita. No ritmo 3 passam 72 horas de jogo entre duas visitas do Preguiçoso, e as oito planejadas se esgotam nas primeiras horas. Também contam como "obra que podia começar" os depósitos que o bot não quer (o Celeiro com a comida longe do limite).
- **O feudo anda muito mais**: o Preguiçoso sai do Salão 2 para o 5 no ritmo Normal e do 2 para o 6 no Rápido, e as horas com depósito perdendo produção caem de 148 para 16 no ritmo Normal. É o alívio que a mecânica promete a quem joga uma vez por dia.

### 5.4 O que mudou em relação à seção 4, e por quê

População final, Salão e desperdício de madeira, antes (seção 4) e depois (esta rodada), nos 7 dias reais:

| Ritmo | Perfil | População | Salão | Madeira perdida | Depósito perdendo produção (h) |
|---|---|---|---|---|---|
| Rápido 3× | Preguiçoso | 20 → 33 | 2 → 6 | 16.934 → 35.340 | 163 → 112 |
| Rápido 3× | Regular | 35 → 64 | 3 → 7 | 63.197 → 90.447 | 160 → 87 |
| Rápido 3× | Dedicado | 55 → 75 | 5 → 7 | 110.303 → 142.729 | 160 → 88 |
| Normal 1× | Preguiçoso | 20 → 30 | 2 → 5 | 4.870 → 587 | 148 → 16 |
| Normal 1× | Regular | 34 → 45 | 3 → 6 | 15.384 → 455 | 136 → 3 |
| Normal 1× | Dedicado | 40 → 45 | 5 → 6 | 12.299 → 0 | 109 → 0 |
| Tranquilo 0,5× | Preguiçoso | 12 → 13 | 2 → 4 | 2.150 → 57 | 113 → 3 |
| Tranquilo 0,5× | Regular | 18 → 22 | 3 → 4 | 2.817 → 61 | 83 → 3 |
| Tranquilo 0,5× | Dedicado | 22 → 22 | 4 → 4 | 0 → 0 | 0 → 0 |

- **O estoque passou a ter onde ser gasto.** Era a pergunta que a seção 4 deixou: com uma fila só e uma obra por visita, o limite não mudava a decisão de ninguém, só o que se via sumir. Com as planejadas automáticas a produção vira obra entre as visitas: nos ritmos Normal e Tranquilo o desperdício de madeira praticamente acaba (15.384 → 455 no Regular do ritmo 1), e as horas com depósito perdendo produção caem de 136 para 3. **A meta do GDD §15.2 ("nenhum recurso desperdiçando no cap por mais de 8 h de jogo contínuas", perfil Regular) fica ao alcance no ritmo Normal**; a medida em horas contínuas ainda não existe no simulador.
- **No ritmo Rápido o desperdício continua alto, e por outro motivo: o feudo acaba.** Em sete dias reais (três anos de jogo) o Regular e o Dedicado chegam ao **Salão no nível 7**, que é o teto alcançável em Senhor (o Salão 7 → 8 pede 5.102 de madeira e o Armazém no nível máximo guarda 5.100: seção 4.1), com os outros edifícios no nível 8 e o Armazém no 8. Daí em diante não há obra que gaste a produção: 5.100 de madeira e de pedra parados, de 9 a 27 mil de ouro, e 90 a 143 mil de madeira no chão. **No ritmo recomendado, um jogador de duas visitas por dia que use as planejadas automáticas esgota a árvore de edifícios da v0.2 em menos de uma semana.** É a observação mais importante desta rodada, e é de balanceamento: vai ao autor em V2C-T7 (custos, o teto do Salão, ou o que mais gaste ouro e madeira no fim: as cartas da Fase D e a Paliçada da Fase E).
- **A meta de população do GDD §15.2 foi ultrapassada.** "População 30–40 no dia 7 (Regular)", no ritmo Normal: a medida era 34 e passou a **45**, com o Salão no nível 6 em vez do 3. O teste que guardava a faixa da v0.1 (20 a 40, Salão no nível 3) em `balance.test.ts` passou a guardar o que foi medido, com o desvio escrito. Nenhum número de conteúdo foi mexido por causa disso.
- **Todos os perfis passaram a ter Celeiro e Armazém.** Com a fila única o depósito "custava uma visita" (seção 4.5); agora o depósito que não pôde começar na visita fica na lista e começa sozinho.
- **Ninguém passa frio.** A lareira de 64 aldeões queima 768 de madeira por inverno e a Serraria no nível 8 repõe várias vezes isso; a guarda da lenha de `planejar automáticas` não chegou a desmarcar nenhuma obra.
- **O ano de jogo no ritmo Rápido** (56 horas reais): o Regular sai do Salão 1 para o 5 e de 15 para 19 aldeões; o Dedicado, do 2 para o 5 e de 25 para 34.

### 5.5 A ordem das políticas: as obras antes do recrutamento

Até a seção 4 os dois bots recrutavam **antes** de olhar as obras. Com o início automático essa ordem passou a custar caro, e a rodada mediu as duas (semente `pedra-alta-001`, 7 dias reais, bot econômico):

| Ritmo | Sessões por dia | Ordem | População | Salão | Fome (h) | Celeiro | Armazém | Comida perdida |
|---|---:|---|---:|---:|---:|---:|---:|---:|
| Rápido 3× | 2 | recrutar primeiro | 58 | 7 | **6** | 0 | 8 | 6.186 |
| Rápido 3× | 2 | obras primeiro (a adotada) | 64 | 7 | 0 | 6 | 8 | 2.719 |
| Rápido 3× | 4 | recrutar primeiro | 75 | 7 | 0 | 5 | 8 | 2.526 |
| Rápido 3× | 4 | obras primeiro (a adotada) | 75 | 7 | 0 | 8 | 8 | 512 |
| Normal 1× | 2 | recrutar primeiro | 45 | 6 | 0 | 0 | 5 | 0 |
| Normal 1× | 2 | obras primeiro (a adotada) | 45 | 6 | 0 | 1 | 5 | 0 |
| Tranquilo 0,5× | 2 | recrutar primeiro | 22 | 4 | 0 | 0 | 2 | 0 |
| Tranquilo 0,5× | 2 | obras primeiro (a adotada) | 22 | 4 | 0 | 0 | 2 | 0 |

Recrutando primeiro, o bot gastava a comida em aldeões antes de olhar o painel, e com a comida abaixo do limite e um aldeão a caminho a visão não promete "cheio em": `ampliar o estoque` nunca pedia o Celeiro. Em sete dias no ritmo 3 o Armazém chegava ao nível 8 e o Celeiro ficava no 0, com 6 mil de comida no chão. Enquanto o feudo crescia devagar (35 aldeões na seção 4) a Despensa de 500 bastava para o inverno. Com as obras começando sozinhas o Regular chega ao terceiro inverno com 58 aldeões: a Fazenda rende × 0,4, o feudo come 58 por hora de jogo, e os 500 acabam no 5º dia do inverno. **Seis horas reais de fome**, na célula em que a faixa cobra zero.

A correção foi no bot, e esta seção existe para ela não passar despercebida: a regra da casa é "quando uma faixa falha sem que a mudança fosse a intenção, o ajuste é nos números, nunca no bot". Aqui o que falhava era o bot não fazer o que o painel manda ("Despensa cheia: comida indo ao chão. Construa o Celeiro ou gaste comida."): olhando o painel **antes** de recrutar, ele ergue o Celeiro e a fome some. Nenhum número de conteúdo mudou. O que a medição diz do jogo continua valendo e vai ao autor: **no ritmo Rápido o inverno inteiro cabe entre duas visitas de quem joga duas vezes por dia, e um feudo de 60 aldeões sem Celeiro passa fome nele**. Um jogador vê a virada de estação anunciada ("A produção de comida passa de × 1,3 para × 0,4"), mas a visão ainda não faz a conta da comida do inverno como faz a da lenha.

### 5.6 As outras dificuldades (uma semente, sem faixa)

`pnpm -s sim -- --matrix --seeds 1 --difficulty ironKing` e `--difficulty peasant`. 7 dias reais:

| Dificuldade | Ritmo | Perfil | População | Salão | Fome (h) | Frio (h) | Fila ociosa (h) | Recusas |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Camponês | Rápido 3× | Preguiçoso | 33 | 7 | 0 | 0 | 89 | 0 |
| Camponês | Rápido 3× | Regular | 64 | **8** | 0 | 0 | 118 | 0 |
| Camponês | Rápido 3× | Dedicado | 85 | **8** | 0 | 0 | 134 | 0 |
| Camponês | Normal 1× | Regular | 44 | 6 | 0 | 0 | 87 | 0 |
| Camponês | Tranquilo 0,5× | Preguiçoso | 12 | 2 | 0 | 0 | 96 | 0 |
| Rei de Ferro | Rápido 3× | Preguiçoso | 33 | 6 | 0 | 0 | 79 | 0 |
| Rei de Ferro | Rápido 3× | Regular | 66 | 7 | 0 | 0 | 72 | 0 |
| Rei de Ferro | Rápido 3× | Dedicado | 75 | 7 | 0 | 0 | 90 | 0 |
| Rei de Ferro | Normal 1× | Regular | 44 | 6 | 0 | 0 | 77 | 0 |
| Rei de Ferro | Tranquilo 0,5× | Preguiçoso | 13 | 3 | 0 | 0 | 65 | 0 |

Sem fome, sem frio e sem ordem recusada em nenhuma das 36 células das duas rodadas, e nenhuma hora de fila ociosa com obra planejada. Em Camponês, onde tudo cabe no Armazém, o Regular e o Dedicado do ritmo Rápido chegam ao **Salão no nível 8, o máximo do jogo**, em sete dias. O Preguiçoso de Camponês no ritmo Tranquilo fica para trás (Salão 2): a política `ocupar os livres` mandou todos para a Pedreira e deixou o ouro parado, com a lista dizendo "espera 44 de ouro, mas o estoque de ouro não está subindo: mande aldeões para a Mina de Ouro". É limite do bot, que não lê a espera das planejadas, não do jogo.

### 5.7 Faixas

As faixas saem das medidas pela regra da seção 2.3. `MEASURED`, em `packages/sim-cli/src/bands.ts`, traz a linha de base desta rodada. A fila ociosa, os aldeões sem ofício, o desperdício e as horas desperdiçando são medidos e relatados, e **continuam sem faixa**: o limite deles é decisão de balanceamento (V2C-T7).

### 5.8 Limites desta medição

- **O bot planeja tudo o que pode.** Um jogador talvez marque duas ou três obras, e não as oito; a medida é o teto do que a mecânica entrega, não uma estimativa de como as pessoas vão usá-la. É o playtest (V2C-T7) que diz isso.
- **A partida de controle não é o bot da seção 4**: é o bot de hoje (obras antes do recrutamento) com as planejadas manuais. A coluna "seção 4" da tabela 5.3 é a medida publicada antes da tarefa.
- **A fila ociosa conta qualquer obra que podia começar**, inclusive os depósitos que o bot não quer e o que sobra depois que o feudo chega ao teto no ritmo Rápido. Ela não distingue "o jogo não tinha o que pedir" de "o jogador não estava lá".
- **O bot continua sem reagir ao depósito cheio na alocação** (seção 4.8) e não lê a espera das planejadas: `ocupar os livres` e `alocar por demanda` repartem os braços pelo que falta às obras **disponíveis**, não pelo que a lista diz que espera.
- **As comparações das seções 5.3 e 5.5 foram medidas com uma semente.** Enquanto nenhuma regra sorteia nada, as 50 sementes dão o mesmo resultado; a ordem "recrutar primeiro" da seção 5.5 não está no código, e para repeti-la é preciso trocar a ordem das políticas à mão (`simulate({ ..., bot })`).
- As faixas continuam sendo o jogo de hoje, com folga, e não metas (seção 2.5).

## 6. Troca de ofício e experiência do ofício (V2C-T3)

Tarefa V2C-T3. Quem troca de ofício rende metade por um dia de jogo, e cada edifício produtivo acumula experiência: +4 a cada virada de dia com ao menos um trabalhador por nível, −8 com o edifício vazio, até 100, que valem +30% de produção (GDD §5.3 e §5.4; [ADR 0013](decisions/0013-regras-da-v0.2-tempo-ritmo-migracao-e-economia.md), decisões 1, 13 e 13a). Os números novos são os de `balance.craft`; **nenhum custo, taxa base, prazo de obra ou limite mudou**.

| | |
|---|---|
| Data | 2026-10-02 |
| Commit | o da tarefa V2C-T3 (`git log --grep V2C-T3`) |
| Identificação | Motor 0.1.0 · estado v6 · conteúdo 438b14e769ef8bf7 |
| Dificuldade | Senhor (`lord`) |
| Sementes | 50 fixas: `pedra-alta-001` a `pedra-alta-050` |
| Ritmos | Rápido 3×, Normal 1× e Tranquilo 0,5× |
| Máquina | Apple M5, Node 24.19.0 |

### 6.1 Perfis e o que mudou no bot

Os mesmos três perfis e as mesmas listas de políticas da seção 5.1. A política que mudou é `alocar por demanda`, do bot `economico` (perfis Regular e Dedicado); o `preguicoso` não mudou. Foram **duas mudanças**, e esta rodada mede cada uma para elas não se confundirem:

1. **Não trocar todo mundo de ofício a cada visita** (é o que a tarefa pede do bot). Até aqui a política refazia a alocação inteira a cada sessão. Agora quem está sem ofício vai para onde mais falta gente; entre os materiais, alguém só troca de ofício quando a falta do destino levaria mais de duas adaptações para ser coberta com os braços que ele já tem; quem cede braços continua ocupado (fica com o que o nível do edifício pede); e cada material recebe primeiro o que precisa para contar como ocupado. Tudo lido da visão: `workersRules.adaptationSeconds`, `workers[].occupiedFrom`, `grossPerHour`.
2. **Plantar para crescer.** Com vaga nas Habitações, a fazenda fica com um lavrador a mais do que a conta de alimentar pede (menos quando a despensa está cheia e a comida vai ao chão). Sem isso o bot vivia da folga de duas bocas e do arredondamento da conta, e o crescimento dependia de quantos lavradores o arredondamento dava: com a experiência do ofício um lavrador passou a bastar onde eram dois, e a sobra de comida sumiu (seção 6.4).

### 6.2 Comando e saída

```bash
pnpm -s sim -- --matrix > matriz.csv 2> matriz.md
```

900 linhas no CSV e 750 partidas distintas, como antes; a rodada leva cerca de 11 s (os feudos ficaram maiores, e a visão projeta o que o ofício muda nas previsões).

#### Tabela 1: 7 dias reais

| Ritmo | Perfil | Anos de jogo | População | Salão | Fome (h) | Frio (h) | Fila ociosa (h) | Sem ofício (aldeão-h) | Excedente de madeira | Excedente de pedra | Excedente de ouro | Desperdício de comida | Desperdício de madeira | Desperdício de pedra | Desperdiçando (h) | Recusas | Faixa |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso (1/dia, preguicoso) | 3 | 33 | 7 | 0 | 0 | 98 | 672 | 3.900 | 3.900 | 4.147 | 13.318 | 24.786 | 11.083 | 128 | 0 | dentro |
| Rápido 3× | Regular (2/dia, economico) | 3 | 72 | 7 | 0 | 0 | 30 | 804 | 5.100 | 5.100 | 37.781 | 20.830 | 105.299 | 49.710 | 114 | 0 | dentro |
| Rápido 3× | Dedicado (4/dia, economico) | 3 | 75 | 7 | 0 | 0 | 20 | 420 | 5.100 | 5.100 | 60.781 | 9.185 | 232.942 | 102.377 | 112 | 0 | dentro |
| Normal 1× | Preguiçoso (1/dia, preguicoso) | 1 | 33 | 6 | 0 | 0 | 56 | 664 | 176 | 529 | 1.419 | 0 | 1.092 | 0 | 22 | 0 | dentro |
| Normal 1× | Regular (2/dia, economico) | 1 | 68 | 7 | 0 | 0 | 48 | 734 | 4.500 | 1.280 | 2.087 | 0 | 5.008 | 190 | 16 | 0 | dentro |
| Normal 1× | Dedicado (4/dia, economico) | 1 | 75 | 7 | 0 | 0 | 105 | 401 | 5.100 | 5.100 | 9.018 | 0 | 33.760 | 11.966 | 46 | 0 | dentro |
| Tranquilo 0,5× | Preguiçoso (1/dia, preguicoso) | 0,5 | 14 | 4 | 0 | 0 | 52 | 212 | 56 | 183 | 230 | 0 | 140 | 0 | 6 | 0 | dentro |
| Tranquilo 0,5× | Regular (2/dia, economico) | 0,5 | 55 | 6 | 0 | 0 | 61 | 550 | 277 | 837 | 165 | 0 | 231 | 67 | 2 | 0 | dentro |
| Tranquilo 0,5× | Dedicado (4/dia, economico) | 0,5 | 61 | 6 | 0 | 0 | 77 | 306 | 838 | 922 | 212 | 0 | 0 | 0 | 0 | 0 | dentro |

Faixas cobradas:

| Ritmo | Perfil | População | Salão | Fome (h) | Frio (h) | Excedente de madeira | Excedente de pedra | Excedente de ouro | Recusas |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso | 29 a 37 | ≥ 7 | ≤ 0 | ≤ 0 | ≤ 4.095 | ≤ 4.095 | ≤ 4.355 | 0 |
| Rápido 3× | Regular | 64 a 80 | ≥ 7 | ≤ 0 | ≤ 0 | ≤ 5.355 | ≤ 5.355 | ≤ 39.671 | 0 |
| Rápido 3× | Dedicado | 67 a 83 | ≥ 7 | ≤ 0 | ≤ 0 | ≤ 5.355 | ≤ 5.355 | ≤ 63.821 | 0 |
| Normal 1× | Preguiçoso | 29 a 37 | ≥ 6 | ≤ 0 | ≤ 0 | ≤ 185 | ≤ 556 | ≤ 1.490 | 0 |
| Normal 1× | Regular | 61 a 75 | ≥ 7 | ≤ 0 | ≤ 0 | ≤ 4.725 | ≤ 1.344 | ≤ 2.192 | 0 |
| Normal 1× | Dedicado | 67 a 83 | ≥ 7 | ≤ 0 | ≤ 0 | ≤ 5.355 | ≤ 5.355 | ≤ 9.469 | 0 |
| Tranquilo 0,5× | Preguiçoso | 12 a 16 | ≥ 4 | ≤ 0 | ≤ 0 | ≤ 59 | ≤ 193 | ≤ 242 | 0 |
| Tranquilo 0,5× | Regular | 49 a 61 | ≥ 6 | ≤ 0 | ≤ 0 | ≤ 291 | ≤ 879 | ≤ 174 | 0 |
| Tranquilo 0,5× | Dedicado | 54 a 68 | ≥ 6 | ≤ 0 | ≤ 0 | ≤ 880 | ≤ 969 | ≤ 223 | 0 |

#### Tabela 2: um ano de jogo

| Ritmo | Perfil | Horas reais | População | Salão | Fome (h) | Frio (h) | Fila ociosa (h) | Sem ofício (aldeão-h) | Excedente de madeira | Excedente de pedra | Excedente de ouro | Desperdício de comida | Desperdício de madeira | Desperdício de pedra | Desperdiçando (h) | Recusas | Faixa |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso (1/dia, preguicoso) | 56 | 13 | 3 | 0 | 0 | 20 | 176 | 458 | 461 | 139 | 40 | 4.781 | 0 | 35 | 0 | dentro |
| Rápido 3× | Regular (2/dia, economico) | 56 | 27 | 5 | 0 | 0 | 11 | 244 | 66 | 645 | 627 | 3.004 | 879 | 0 | 24 | 0 | dentro |
| Rápido 3× | Dedicado (4/dia, economico) | 56 | 52 | 7 | 0 | 0 | 15 | 262 | 1.157 | 519 | 1.022 | 687 | 1.088 | 46 | 9 | 0 | dentro |
| Normal 1× | Preguiçoso (1/dia, preguicoso) | 168 | 33 | 6 | 0 | 0 | 56 | 664 | 176 | 529 | 1.419 | 0 | 1.092 | 0 | 22 | 0 | dentro |
| Normal 1× | Regular (2/dia, economico) | 168 | 68 | 7 | 0 | 0 | 48 | 734 | 4.500 | 1.280 | 2.087 | 0 | 5.008 | 190 | 16 | 0 | dentro |
| Normal 1× | Dedicado (4/dia, economico) | 168 | 75 | 7 | 0 | 0 | 105 | 401 | 5.100 | 5.100 | 9.018 | 0 | 33.760 | 11.966 | 46 | 0 | dentro |
| Tranquilo 0,5× | Preguiçoso (1/dia, preguicoso) | 336 | 23 | 6 | 0 | 0 | 188 | 425 | 1.018 | 1.273 | 975 | 0 | 332 | 0 | 8 | 0 | dentro |
| Tranquilo 0,5× | Regular (2/dia, economico) | 336 | 75 | 7 | 0 | 0 | 221 | 762 | 5.100 | 5.100 | 9.169 | 0 | 37.705 | 9.748 | 95 | 0 | dentro |
| Tranquilo 0,5× | Dedicado (4/dia, economico) | 336 | 75 | 7 | 0 | 0 | 238 | 374 | 5.100 | 5.100 | 5.923 | 0 | 41.591 | 15.927 | 103 | 0 | dentro |

Faixas cobradas:

| Ritmo | Perfil | População | Salão | Fome (h) | Frio (h) | Excedente de madeira | Excedente de pedra | Excedente de ouro | Recusas |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso | 11 a 15 | ≥ 3 | ≤ 0 | ≤ 0 | ≤ 481 | ≤ 485 | ≤ 146 | 0 |
| Rápido 3× | Regular | 24 a 30 | ≥ 5 | ≤ 0 | ≤ 0 | ≤ 70 | ≤ 678 | ≤ 659 | 0 |
| Rápido 3× | Dedicado | 46 a 58 | ≥ 7 | ≤ 0 | ≤ 0 | ≤ 1.215 | ≤ 545 | ≤ 1.074 | 0 |
| Normal 1× | Preguiçoso | 29 a 37 | ≥ 6 | ≤ 0 | ≤ 0 | ≤ 185 | ≤ 556 | ≤ 1.490 | 0 |
| Normal 1× | Regular | 61 a 75 | ≥ 7 | ≤ 0 | ≤ 0 | ≤ 4.725 | ≤ 1.344 | ≤ 2.192 | 0 |
| Normal 1× | Dedicado | 67 a 83 | ≥ 7 | ≤ 0 | ≤ 0 | ≤ 5.355 | ≤ 5.355 | ≤ 9.469 | 0 |
| Tranquilo 0,5× | Preguiçoso | 20 a 26 | ≥ 6 | ≤ 0 | ≤ 0 | ≤ 1.069 | ≤ 1.337 | ≤ 1.024 | 0 |
| Tranquilo 0,5× | Regular | 67 a 83 | ≥ 7 | ≤ 0 | ≤ 0 | ≤ 5.355 | ≤ 5.355 | ≤ 9.628 | 0 |
| Tranquilo 0,5× | Dedicado | 67 a 83 | ≥ 7 | ≤ 0 | ≤ 0 | ≤ 5.355 | ≤ 5.355 | ≤ 6.220 | 0 |

Todas as 900 partidas ficam dentro das faixas novas, e nenhum bot teve ordem recusada. Nenhuma passa fome nem frio.

### 6.3 Trocar menos de ofício: a política antiga contra a nova, nas regras novas

Semente `pedra-alta-001`, 7 dias reais, bot econômico com a alocação antiga (refaz tudo a cada visita) e com a nova (as duas mudanças da seção 6.1). "Trocas" são os trabalhadores que chegaram a um edifício vindos de outro, somados nas visitas da semana; "braços-visita" é a soma da população em cada visita, para dar a medida.

| Ritmo | Sessões por dia | Alocação | População | Salão | Trocas de ofício | Braços-visita | Experiência final (Fazenda / Serraria / Pedreira / Mina) | Ouro parado |
|---|---:|---|---:|---:|---:|---:|---|---:|
| Rápido 3× | 2 | antiga | 66 | 7 | 53 | 432 | 0 / 100 / 100 / 100 | 18.592 |
| Rápido 3× | 2 | nova | 72 | 7 | **5** | 486 | 100 / 100 / 100 / 100 | 37.781 |
| Rápido 3× | 4 | antiga | 75 | 7 | 194 | 1.381 | 72 / 100 / 100 / 100 | 36.852 |
| Rápido 3× | 4 | nova | 75 | 7 | **26** | 1.533 | 84 / 100 / 100 / 100 | 60.781 |
| Normal 1× | 2 | antiga | 46 | 6 | 70 | 296 | 0 / 100 / 100 / 76 | 1.719 |
| Normal 1× | 2 | nova | 68 | 7 | **27** | 446 | 92 / 100 / 100 / 100 | 2.087 |
| Normal 1× | 4 | antiga | 47 | 7 | 42 | 644 | 0 / 100 / 100 / 100 | 547 |
| Normal 1× | 4 | nova | 75 | 7 | 42 | 1.340 | 84 / 100 / 100 / 100 | 9.018 |
| Tranquilo 0,5× | 2 | antiga | 22 | 4 | 4 | 165 | 0 / 100 / 100 / 100 | 391 |
| Tranquilo 0,5× | 2 | nova | 55 | 6 | 13 | 351 | 88 / 100 / 100 / 100 | 165 |
| Tranquilo 0,5× | 4 | antiga | 15 | 4 | 17 | 319 | 0 / 100 / 100 / 84 | 305 |
| Tranquilo 0,5× | 4 | nova | 61 | 6 | 19 | 793 | 76 / 100 / 100 / 100 | 212 |

- **No ritmo Rápido as trocas caem a um décimo** (53 → 5 com duas visitas por dia, 194 → 26 com quatro), com o feudo maior. Nos outros ritmos o feudo novo é duas a quatro vezes maior e troca o mesmo tanto ou menos por braço.
- **A experiência chega a 100 em todos os ofícios dos materiais em qualquer perfil**: 25 dias de jogo ocupados bastam, e são 17 horas reais no ritmo Rápido, 50 no Normal e 100 no Tranquilo. O teto é alcançado cedo; a Fazenda é a exceção, porque sobe de nível e passa a pedir mais lavradores do que o feudo precisa para comer.

### 6.4 O que mudou em relação à seção 5, e por quê

População e Salão ao fim dos 7 dias reais: a seção 5, esta rodada só com a mecânica e a primeira mudança do bot (trocar menos de ofício), e esta rodada inteira (com o lavrador a mais):

| Ritmo | Perfil | Seção 5 | Só a mecânica e "trocar menos" | Com "plantar para crescer" (a linha de base) |
|---|---|---|---|---|
| Rápido 3× | Preguiçoso | 33 · Salão 6 | 33 · Salão 7 | 33 · Salão 7 |
| Rápido 3× | Regular | 64 · Salão 7 | 70 · Salão 7 | 72 · Salão 7 |
| Rápido 3× | Dedicado | 75 · Salão 7 | 75 · Salão 7 | 75 · Salão 7 |
| Normal 1× | Preguiçoso | 30 · Salão 5 | 33 · Salão 6 | 33 · Salão 6 |
| Normal 1× | Regular | 45 · Salão 6 | 46 · Salão 7 | **68 · Salão 7** |
| Normal 1× | Dedicado | 45 · Salão 6 | 48 · Salão 7 | **75 · Salão 7** |
| Tranquilo 0,5× | Preguiçoso | 13 · Salão 4 | 14 · Salão 4 | 14 · Salão 4 |
| Tranquilo 0,5× | Regular | 22 · Salão 4 | 22 · Salão 4 | **55 · Salão 6** |
| Tranquilo 0,5× | Dedicado | 22 · Salão 4 | **15** · Salão 4 | **61 · Salão 6** |

- **A mecânica, sozinha, acelera pouco e para todos**: um nível de Salão a mais em quatro células, de zero a seis aldeões a mais. O que se perde na adaptação (metade da produção de quem chega, por um dia de jogo) é menos do que os +30% da mestria devolvem em uma semana. O Preguiçoso, que nunca trocou ninguém de ofício à toa, só ganha.
- **O perfil Dedicado no ritmo Tranquilo caía de 22 para 15 aldeões só com a mecânica**, e no ano de jogo de 45 para 23. Não era o jogo: era o bot. Com a Fazenda rendendo mais, um lavrador passou a bastar onde eram dois, a sobra de comida ficou só nas duas bocas de folga (+1,5 de comida por hora real) e o recrutamento, que custa 50 de comida, passou a acontecer uma vez a cada sete visitas. Jogando mais vezes, o bot crescia menos: um sinal falso, que mandaria o balanceamento procurar um defeito onde ele não está.
- **Com o lavrador a mais, o bot econômico cresce muito mais em todos os ritmos lentos**: de 45 para 68 aldeões no Regular do ritmo Normal, de 22 para 55 no Tranquilo. **É a mudança do bot, e não a mecânica, que explica esse salto**, e ele diz uma coisa do jogo que as rodadas anteriores escondiam: **a comida é a moeda do crescimento, e quem planta para recrutar enche as Habitações**. No ritmo Normal o Dedicado chega a 75 aldeões (o teto das Habitações e do Salão no nível 7) em uma semana, e no Tranquilo o Regular e o Dedicado chegam lá no ano de jogo. A meta do GDD §15.2 ("população 30–40 no dia 7", Regular, ritmo Normal) fica ainda mais para trás: 68. Vai ao autor em V2C-T7, junto com o teto do Salão (seção 5.4).
- **O ouro parado dobra no ritmo Rápido** (9 mil → 38 mil no Regular, 27 mil → 61 mil no Dedicado): o bot agora mantém a Mina ocupada para a experiência não se perder, a Mina dominada rende 30% a mais e o ouro não tem onde ser gasto depois que o feudo chega ao teto. Era um sinal de tédio; ficou maior. As cartas do Conselho (Fase D) e a Paliçada (Fase E) são os gastos previstos.
- **A madeira e a pedra no chão crescem no ritmo Rápido** (90 mil → 105 mil de madeira no Regular; 143 mil → 233 mil no Dedicado), pelo mesmo motivo: produção 30% maior, sem obra que a gaste depois do Salão 7.
- **Ninguém passa fome nem frio**, em nenhuma célula.

### 6.5 Faixas

As faixas saem das medidas pela regra da seção 2.3. `MEASURED`, em `packages/sim-cli/src/bands.ts`, traz a linha de base desta rodada (a coluna da direita da seção 6.4). A fila ociosa, os aldeões sem ofício, o desperdício e as horas desperdiçando continuam medidos e sem faixa.

### 6.6 Limites desta medição

- **A linha de base mistura a mecânica e uma mudança do bot.** A coluna do meio da seção 6.4 separa as duas, mas foi medida uma vez, antes de a segunda mudança entrar no código: para repeti-la é preciso tirar o lavrador a mais de `alocarPorDemanda` à mão. O mesmo vale para a "alocação antiga" da seção 6.3.
- **O bot ocupa todo ofício, precise dele ou não**: põe na Mina os trabalhadores que o nível dela pede mesmo com o ouro sobrando. Um jogador talvez deixe a Mina com menos gente; o ouro parado desta rodada é o teto.
- **O bot não usa a experiência para escolher onde pôr os braços** (não prefere o ofício dominado) e não segura uma troca até a virada do dia. Ele só evita a troca que não se paga.
- **A experiência chega ao teto cedo em todo perfil**, então a matriz quase não mede a escolha "especializar ou espalhar": mede o custo de trocar. Se os +30% em 25 dias de jogo são muito ou pouco é pergunta para o playtest e para V2C-T7.
- **As comparações das seções 6.3 e 6.4 (coluna do meio) foram medidas com uma semente ou antes do código final**; enquanto nenhuma regra sorteia nada, as 50 sementes dão o mesmo resultado.
- As faixas continuam sendo o jogo de hoje, com folga, e não metas (seção 2.5).

## 7. Moral (V2C-T4)

Tarefa V2C-T4. A moral vai de 0 a 100, é recalculada na virada de cada dia de jogo e entra na produção como `(150 + moral) / 200`: 50 mais 10 com comida guardada para 24 h de jogo, menos 20 com fome (e 2 por dia inteiro de fome), menos 10 com as casas cheias, menos 20 com frio. Com 80 ou mais, 20% de chance de um colono chegar por virada; com 25 ou menos, 20% de um aldeão partir; depois de 12 h de jogo de fome, um aldeão deserta por virada (não em Camponês), nunca abaixo de 3 (GDD §5.6 e §5.7; [ADR 0013](decisions/0013-regras-da-v0.2-tempo-ritmo-migracao-e-economia.md), decisões 1, 19 e 19a). Os números novos são os de `balance.morale`; **nenhum custo, taxa base, prazo de obra ou limite mudou**.

| | |
|---|---|
| Data | 2026-10-02 |
| Commit | o da tarefa V2C-T4 (`git log --grep V2C-T4`) |
| Identificação | Motor 0.1.0 · estado v7 · conteúdo 3acde0478685be9d |
| Dificuldade | Senhor (`lord`) |
| Sementes | 50 fixas: `pedra-alta-001` a `pedra-alta-050` |
| Ritmos | Rápido 3×, Normal 1× e Tranquilo 0,5× |
| Máquina | Apple M5, Node 24.19.0 |

### 7.1 Perfis e o que mudou no bot

Os mesmos três perfis e as mesmas listas de políticas da seção 5.1. Mudou uma política, `recrutar`, dos dois bots: **com 20 aldeões ou mais, ela deixa uma cama vazia nas Habitações.** Com as casas cheias a moral perde 10 pontos, que são 5% da produção de todos os ofícios; em um feudo desse tamanho isso custa mais do que o último par de braços rende. Abaixo de 20 aldeões o bot continua enchendo as casas. A seção 7.3 mede essa mudança à parte da mecânica, e mede as duas que **não** entraram.

O simulador passou a medir a moral: a coluna `morale` do CSV (a moral de cada hora; no CSV da matriz, a menor da partida) e, nas tabelas, "Moral mínima", "Moral baixa (h)" (as horas com o povo inquieto ou desesperado) e "Foram embora" (os aldeões que partiram ou desertaram).

### 7.2 Comando e saída

```bash
pnpm -s sim -- --matrix > matriz.csv 2> matriz.md
```

900 linhas no CSV e 750 partidas distintas, como antes; a rodada leva cerca de 12 s.

#### Tabela 1: 7 dias reais

| Ritmo | Perfil | Anos de jogo | População | Salão | Fome (h) | Frio (h) | Moral mínima | Moral baixa (h) | Foram embora | Fila ociosa (h) | Sem ofício (aldeão-h) | Excedente de madeira | Excedente de pedra | Excedente de ouro | Desperdício de comida | Desperdício de madeira | Desperdício de pedra | Desperdiçando (h) | Recusas | Faixa |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso (1/dia, preguicoso) | 3 | 33 | 7 | 0 | 0 | 50 | 0 | 0 | 103 | 672 | 3.900 | 3.900 | 4.660 | 14.680 | 27.617 | 12.429 | 131 | 0 | dentro |
| Rápido 3× | Regular (2/dia, economico) | 3 | 72 | 7 | 0 | 0 | 50 | 0 | 0 | 40 | 804 | 5.100 | 5.100 | 37.628 | 22.682 | 135.052 | 44.655 | 120 | 0 | dentro |
| Rápido 3× | Dedicado (4/dia, economico) | 3 | 74 | 7 | 0 | 0 | 50 | 0 | 0 | 14 | 414 | 5.100 | 5.100 | 64.707 | 8.799 | 242.145 | 108.902 | 116 | 0 | dentro |
| Normal 1× | Preguiçoso (1/dia, preguicoso) | 1 | 33 | 6 | 0 | 0 | 50 | 0 | 0 | 62 | 664 | 692 | 713 | 1.637 | 0 | 1.147 | 0 | 23 | 0 | dentro |
| Normal 1× | Regular (2/dia, economico) | 1 | 66 | 7 | 0 | 0 | 40 | 2 | 0 | 59 | 711 | 4.500 | 4.106 | 2.000 | 199 | 8.879 | 0 | 20 | 0 | dentro |
| Normal 1× | Dedicado (4/dia, economico) | 1 | 74 | 7 | 0 | 0 | 40 | 2 | 0 | 69 | 393 | 5.100 | 5.100 | 5.716 | 0 | 30.744 | 5.472 | 40 | 0 | dentro |
| Tranquilo 0,5× | Preguiçoso (1/dia, preguicoso) | 0,5 | 14 | 4 | 0 | 0 | 50 | 0 | 0 | 55 | 212 | 70 | 188 | 231 | 0 | 144 | 0 | 7 | 0 | dentro |
| Tranquilo 0,5× | Regular (2/dia, economico) | 0,5 | 54 | 6 | 0 | 0 | 40 | 4 | 0 | 61 | 534 | 753 | 952 | 652 | 0 | 1.111 | 42 | 5 | 0 | dentro |
| Tranquilo 0,5× | Dedicado (4/dia, economico) | 0,5 | 61 | 6 | 0 | 0 | 50 | 0 | 0 | 78 | 305 | 813 | 920 | 180 | 0 | 0 | 0 | 0 | 0 | dentro |

Faixas cobradas:

| Ritmo | Perfil | População | Salão | Fome (h) | Frio (h) | Excedente de madeira | Excedente de pedra | Excedente de ouro | Recusas |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso | 29 a 37 | ≥ 7 | ≤ 0 | ≤ 0 | ≤ 4.095 | ≤ 4.095 | ≤ 4.893 | 0 |
| Rápido 3× | Regular | 64 a 80 | ≥ 7 | ≤ 0 | ≤ 0 | ≤ 5.355 | ≤ 5.355 | ≤ 39.510 | 0 |
| Rápido 3× | Dedicado | 66 a 82 | ≥ 7 | ≤ 0 | ≤ 0 | ≤ 5.355 | ≤ 5.355 | ≤ 67.943 | 0 |
| Normal 1× | Preguiçoso | 29 a 37 | ≥ 6 | ≤ 0 | ≤ 0 | ≤ 727 | ≤ 749 | ≤ 1.719 | 0 |
| Normal 1× | Regular | 59 a 73 | ≥ 7 | ≤ 0 | ≤ 0 | ≤ 4.725 | ≤ 4.312 | ≤ 2.100 | 0 |
| Normal 1× | Dedicado | 66 a 82 | ≥ 7 | ≤ 0 | ≤ 0 | ≤ 5.355 | ≤ 5.355 | ≤ 6.002 | 0 |
| Tranquilo 0,5× | Preguiçoso | 12 a 16 | ≥ 4 | ≤ 0 | ≤ 0 | ≤ 74 | ≤ 198 | ≤ 243 | 0 |
| Tranquilo 0,5× | Regular | 48 a 60 | ≥ 6 | ≤ 0 | ≤ 0 | ≤ 791 | ≤ 1.000 | ≤ 685 | 0 |
| Tranquilo 0,5× | Dedicado | 54 a 68 | ≥ 6 | ≤ 0 | ≤ 0 | ≤ 854 | ≤ 966 | ≤ 189 | 0 |

#### Tabela 2: um ano de jogo

| Ritmo | Perfil | Horas reais | População | Salão | Fome (h) | Frio (h) | Moral mínima | Moral baixa (h) | Foram embora | Fila ociosa (h) | Sem ofício (aldeão-h) | Excedente de madeira | Excedente de pedra | Excedente de ouro | Desperdício de comida | Desperdício de madeira | Desperdício de pedra | Desperdiçando (h) | Recusas | Faixa |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso (1/dia, preguicoso) | 56 | 13 | 3 | 0 | 0 | 50 | 0 | 0 | 21 | 176 | 513 | 531 | 160 | 79 | 5.091 | 0 | 36 | 0 | dentro |
| Rápido 3× | Regular (2/dia, economico) | 56 | 27 | 5 | 0 | 0 | 50 | 0 | 0 | 13 | 244 | 780 | 1.234 | 1.155 | 1.642 | 1.534 | 43 | 20 | 0 | dentro |
| Rápido 3× | Dedicado (4/dia, economico) | 56 | 52 | 7 | 0 | 0 | 50 | 0 | 0 | 13 | 262 | 815 | 1.672 | 477 | 1.059 | 1.566 | 0 | 12 | 0 | dentro |
| Normal 1× | Preguiçoso (1/dia, preguicoso) | 168 | 33 | 6 | 0 | 0 | 50 | 0 | 0 | 62 | 664 | 692 | 713 | 1.637 | 0 | 1.147 | 0 | 23 | 0 | dentro |
| Normal 1× | Regular (2/dia, economico) | 168 | 66 | 7 | 0 | 0 | 40 | 2 | 0 | 59 | 711 | 4.500 | 4.106 | 2.000 | 199 | 8.879 | 0 | 20 | 0 | dentro |
| Normal 1× | Dedicado (4/dia, economico) | 168 | 74 | 7 | 0 | 0 | 40 | 2 | 0 | 69 | 393 | 5.100 | 5.100 | 5.716 | 0 | 30.744 | 5.472 | 40 | 0 | dentro |
| Tranquilo 0,5× | Preguiçoso (1/dia, preguicoso) | 336 | 23 | 6 | 0 | 0 | 50 | 0 | 0 | 187 | 425 | 1.029 | 1.279 | 977 | 0 | 340 | 0 | 9 | 0 | dentro |
| Tranquilo 0,5× | Regular (2/dia, economico) | 336 | 74 | 7 | 0 | 0 | 40 | 4 | 0 | 158 | 746 | 5.100 | 5.100 | 5.772 | 291 | 32.127 | 4.741 | 82 | 0 | dentro |
| Tranquilo 0,5× | Dedicado (4/dia, economico) | 336 | 74 | 7 | 0 | 0 | 50 | 0 | 0 | 217 | 367 | 5.100 | 4.525 | 8.053 | 122 | 36.574 | 6.489 | 91 | 0 | dentro |

Faixas cobradas:

| Ritmo | Perfil | População | Salão | Fome (h) | Frio (h) | Excedente de madeira | Excedente de pedra | Excedente de ouro | Recusas |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso | 11 a 15 | ≥ 3 | ≤ 0 | ≤ 0 | ≤ 539 | ≤ 558 | ≤ 168 | 0 |
| Rápido 3× | Regular | 24 a 30 | ≥ 5 | ≤ 0 | ≤ 0 | ≤ 819 | ≤ 1.296 | ≤ 1.213 | 0 |
| Rápido 3× | Dedicado | 46 a 58 | ≥ 7 | ≤ 0 | ≤ 0 | ≤ 856 | ≤ 1.756 | ≤ 501 | 0 |
| Normal 1× | Preguiçoso | 29 a 37 | ≥ 6 | ≤ 0 | ≤ 0 | ≤ 727 | ≤ 749 | ≤ 1.719 | 0 |
| Normal 1× | Regular | 59 a 73 | ≥ 7 | ≤ 0 | ≤ 0 | ≤ 4.725 | ≤ 4.312 | ≤ 2.100 | 0 |
| Normal 1× | Dedicado | 66 a 82 | ≥ 7 | ≤ 0 | ≤ 0 | ≤ 5.355 | ≤ 5.355 | ≤ 6.002 | 0 |
| Tranquilo 0,5× | Preguiçoso | 20 a 26 | ≥ 6 | ≤ 0 | ≤ 0 | ≤ 1.081 | ≤ 1.343 | ≤ 1.026 | 0 |
| Tranquilo 0,5× | Regular | 66 a 82 | ≥ 7 | ≤ 0 | ≤ 0 | ≤ 5.355 | ≤ 5.355 | ≤ 6.061 | 0 |
| Tranquilo 0,5× | Dedicado | 66 a 82 | ≥ 7 | ≤ 0 | ≤ 0 | ≤ 5.355 | ≤ 4.752 | ≤ 8.456 | 0 |

Todas as 900 partidas ficam dentro das faixas novas, e nenhum bot teve ordem recusada. Nenhuma passa fome nem frio, e **nenhuma perde um aldeão**: a menor moral de toda a matriz é 40 (as casas cheias sem a comida guardada), longe dos 25 em que alguém parte.

### 7.3 O bot diante da moral: o que entrou e o que foi medido e não entrou

Três sementes por linha (`pedra-alta-001` a `003`, iguais entre si: nenhuma destas partidas chega a sortear). "Moral" é a média das amostras de cada hora; "Materiais por hora" é a média, hora a hora, do saldo de madeira, pedra e ouro somados, por hora real: é só um termômetro de quanto o feudo produz, não uma grandeza do jogo.

**A cama vazia (entrou).** O `recrutar` de antes contra o de agora:

| Janela | Ritmo | Perfil | População (antes → agora) | Moral média | Materiais por hora |
|---|---|---|---|---|---|
| 7 dias | Rápido 3× | Dedicado | 75 → 74 | 55 → 60 | 2.923 → 3.017 (+3%) |
| 7 dias | Normal 1× | Dedicado | 75 → 74 | 46 → 53 | 750 → 789 (+5%) |
| 7 dias | Tranquilo 0,5× | Regular | 55 → 54 | 50 → 50 | 154 → 158 (+3%) |
| Ano | Tranquilo 0,5× | Regular | 75 → 74 | 46 → 53 | 371 → 395 (+6%) |
| Ano | Tranquilo 0,5× | Dedicado | 75 → 74 | 48 → 53 | 390 → 418 (+7%) |

Nas outras doze células o feudo não chega a encher as casas com 20 aldeões ou mais, e nada muda. Onde muda, um aldeão a menos compra de 3% a 7% de produção.

**Guardar a despensa no recrutamento (não entrou).** A variante: o recrutamento só gasta a comida que sobra depois da reserva de 24 h de jogo, já contando as bocas novas (quando a reserva cabe no depósito).

| Janela | Ritmo | Perfil | População (sem → com a reserva) | Salão |
|---|---|---|---|---|
| 7 dias | Rápido 3× | Regular | 72 → 68 | 7 → 7 |
| 7 dias | Normal 1× | Preguiçoso | 33 → **18** | 6 → 5 |
| 7 dias | Tranquilo 0,5× | Regular | 55 → **37** | 6 → 5 |
| 7 dias | Tranquilo 0,5× | Dedicado | 61 → **38** | 6 → 5 |
| Ano | Rápido 3× | Dedicado | 52 → 47 | 7 → 6 |
| Ano | Tranquilo 0,5× | Preguiçoso | 23 → 17 | 6 → 4 |

A reserva pede 24 de comida por habitante, e cada recruta custa 50: com ela, cada aldeão novo passa a pedir 74. Os 5% de produção que a moral devolve não pagam o crescimento perdido. Guardar a reserva só com 20 aldeões ou mais ainda custa (Regular do Tranquilo: 54 → 40 aldeões em 7 dias). As variantes mais brandas (guardar só a reserva que já está feita, ou só quando os recrutas a mais não chegam a 5% da população) ficam iguais à cama vazia em quinze das dezessete células medidas e um pouco piores em duas (Regular do ritmo Normal: 491 → 479 de materiais por hora).

**Um lavrador a mais para encher a despensa (não entrou).** Com 20 aldeões ou mais e a reserva por fazer, a alocação punha um lavrador além da conta:

| Janela | Ritmo | Perfil | Materiais por hora (sem → com) | População |
|---|---|---|---|---|
| 7 dias | Normal 1× | Dedicado | 789 → 758 | 74 → 74 |
| 7 dias | Tranquilo 0,5× | Regular | 158 → 153 | 54 → 54 |
| 7 dias | Tranquilo 0,5× | Dedicado | 184 → 187 | 61 → 64 |
| Ano | Tranquilo 0,5× | Regular | 395 → 391 | 74 → 74 |
| Ano | Tranquilo 0,5× | Dedicado | 418 → 427 | 74 → 74 |

Melhor em duas células, pior em três, por pouco nos dois sentidos: não justifica uma política a mais.

**O que isso diz do jogo.** A comida guardada é o termo da moral que o jogador controla de graça só quando o feudo para de crescer: enquanto há cama vazia, a comida rende mais como recruta do que como bônus. No ritmo Rápido os bots chegam ao teto das casas cedo e vivem com a moral em 60; nos ritmos lentos vivem em 50. É uma escolha de verdade (crescer agora ou produzir 5% a mais), e a tela mostra os dois lados: quanto falta para a reserva e o que ela vale.

### 7.4 O feudo abandonado

A mecânica quase não aparece na matriz, porque os bots cuidam da comida. Ela é para quem não cuida. Uma partida nova em que ninguém dá ordem nenhuma (`simulate({ ..., bot: async () => {} })`), semente `pedra-alta-001`, em horas reais desde a criação:

| Dificuldade | Ritmo | A fome começa | Inquieto | Desesperado | Primeiro a ir embora | No piso (3 aldeões) |
|---|---|---|---|---|---|---|
| Senhor | Rápido 3× | 12 h | 12 h 40 | 14 h | 16 h (deserção) | 16 h 40 |
| Senhor | Normal 1× | 36 h | 38 h | 42 h | 48 h (deserção) | 50 h |
| Senhor | Tranquilo 0,5× | 72 h | 76 h | 84 h | 96 h (deserção) | 100 h |
| Camponês | Rápido 3× | 12 h | 12 h 40 | 14 h | 28 h (partida, por sorteio) | 29 h 20 |
| Camponês | Normal 1× | 36 h | 38 h | 42 h | 84 h (partida, por sorteio) | 88 h |
| Camponês | Tranquilo 0,5× | 72 h | 76 h | 84 h | 168 h (partida, por sorteio) | 176 h |

- **É aqui que a semente passa a mudar a partida.** Nas 50 sementes, no ritmo Rápido e em Senhor, os dois aldeões que o feudo novo pode perder saem assim: em 16 sementes os dois desertam; em 26, um parte (pela moral baixa) e um deserta; em 8, os dois partem antes de a deserção começar. O resultado é o mesmo (três aldeões); o caminho muda.
- **O feudo novo perde no máximo dois aldeões**, porque nasce com cinco e o piso é três. Um feudo de 22 aldeões deixado sem lavradores perde 19, entre deserções e partidas, em 32 horas de jogo: no ritmo Rápido, pouco menos de 11 horas reais. **A deserção é rápida para quem dorme com o feudo faminto**: a fome que começa quando o jogador sai leva 4 horas reais de carência no ritmo Rápido e, daí em diante, um aldeão a cada 40 minutos. É a regra do GDD §5.6, ao pé da letra; se é dura demais para o ritmo recomendado, a decisão é do autor (a dúvida vai no relatório desta tarefa, para as pendências da v0.2).
- **Sempre há caminho de volta.** No piso, com fome, frio e a moral em zero, dois lavradores e um lenhador tiram o feudo da fome e do frio em um dia de jogo (o teste "feudo empobrecido", em `packages/engine/src/morale.test.ts`, joga a sequência em Senhor e em Rei de Ferro; um teste de conteúdo confere que três lavradores adaptados sempre rendem mais do que três bocas comem). Nenhum estado sem saída foi encontrado.

### 7.5 O que mudou em relação à seção 6, e por quê

População e Salão ao fim dos 7 dias reais: a seção 6, esta rodada só com a mecânica (o bot de antes) e esta rodada inteira (com a cama vazia):

| Ritmo | Perfil | Seção 6 | Só a mecânica | Com a cama vazia (a linha de base) |
|---|---|---|---|---|
| Rápido 3× | Preguiçoso | 33 · Salão 7 | 33 · Salão 7 | 33 · Salão 7 |
| Rápido 3× | Regular | 72 · Salão 7 | 72 · Salão 7 | 72 · Salão 7 |
| Rápido 3× | Dedicado | 75 · Salão 7 | 75 · Salão 7 | 74 · Salão 7 |
| Normal 1× | Preguiçoso | 33 · Salão 6 | 33 · Salão 6 | 33 · Salão 6 |
| Normal 1× | Regular | 68 · Salão 7 | 66 · Salão 7 | 66 · Salão 7 |
| Normal 1× | Dedicado | 75 · Salão 7 | 75 · Salão 7 | 74 · Salão 7 |
| Tranquilo 0,5× | Preguiçoso | 14 · Salão 4 | 14 · Salão 4 | 14 · Salão 4 |
| Tranquilo 0,5× | Regular | 55 · Salão 6 | 55 · Salão 6 | 54 · Salão 6 |
| Tranquilo 0,5× | Dedicado | 61 · Salão 6 | 61 · Salão 6 | 61 · Salão 6 |

- **A população quase não muda.** A moral põe de −5% a +5% na produção de quem joga razoavelmente (40 a 60), e o crescimento é limitado pelas casas e pela comida, não pelos materiais. O Regular do ritmo Normal termina com 66 no lugar de 68: os 5% a mais mudam o instante de cada obra, e a semana fecha dois recrutas antes.
- **O excedente parado cresce onde o feudo ainda não bateu no teto do depósito**, porque a produção é maior e não há mais em que gastá-la: a pedra parada do Regular no ritmo Normal vai de 1.280 para 4.106, a madeira do Regular no Tranquilo de 277 para 753, o ouro do Dedicado no Rápido de 60.781 para 64.707. É o mesmo sinal de tédio das rodadas anteriores (falta em que gastar), um pouco maior. As cartas do Conselho (Fase D) e a Paliçada (Fase E) são os gastos previstos.
- **A fila ociosa sobe no ritmo Rápido** (30 h → 40 h no Regular): com 5% a mais de produção o feudo chega ao Salão 7 e aos edifícios no nível máximo antes, e sobra semana sem obra possível.
- **Ninguém passa fome nem frio, e ninguém perde gente**, em nenhuma célula. A "Moral baixa" de 2 a 4 horas em quatro células é o povo inquieto com as casas cheias e a despensa gasta em recrutas: 40, sem risco de partida.
- **Sem os ajustes temporários a moral não passa de 60.** A faixa Orgulhoso (75 ou mais) e o colono atraído pela fama (80 ou mais) só existem com os +10 e +15 dos objetivos 6 e 10 (V2E-T4) e com as cartas do Conselho (V2D-T1). Até lá, nenhuma partida, de bot ou de gente, sorteia a chegada de um colono.

### 7.6 As outras dificuldades (uma semente, sem faixa)

`pnpm -s sim -- --matrix --seeds 1 --difficulty peasant` e `--difficulty ironKing`. 7 dias reais, perfil Regular:

| Dificuldade | Ritmo | População | Salão | Moral mínima | Moral baixa (h) | Foram embora | Recusas |
|---|---|---|---|---|---|---|---|
| Camponês | Rápido 3× | 72 | 8 | 50 | 0 | 0 | 0 |
| Camponês | Normal 1× | 68 | 7 | 40 | 2 | 0 | 0 |
| Camponês | Tranquilo 0,5× | 54 | 6 | 40 | 4 | 0 | 0 |
| Senhor | Rápido 3× | 72 | 7 | 50 | 0 | 0 | 0 |
| Senhor | Normal 1× | 66 | 7 | 40 | 2 | 0 | 0 |
| Senhor | Tranquilo 0,5× | 54 | 6 | 40 | 4 | 0 | 0 |
| Rei de Ferro | Rápido 3× | 72 | 7 | 50 | 0 | 0 | 0 |
| Rei de Ferro | Normal 1× | 69 | 7 | 40 | 2 | 0 | 0 |
| Rei de Ferro | Tranquilo 0,5× | 54 | 6 | 40 | 4 | 0 | 0 |

A deserção por fome, a linha da dificuldade que esta tarefa liga, não aparece: nenhum bot passa fome. A diferença entre Camponês e as outras está na seção 7.4.

### 7.7 Faixas

As faixas saem das medidas pela regra da seção 2.3. `MEASURED`, em `packages/sim-cli/src/bands.ts`, traz a linha de base desta rodada (a coluna da direita da seção 7.5). A moral mínima, as horas de moral baixa e os aldeões que foram embora são medidos e relatados, sem faixa: com zero horas de fome e de frio cobradas, nenhuma partida chega à moral que leva gente embora. A fila ociosa, os aldeões sem ofício, o desperdício e as horas desperdiçando continuam medidos e sem faixa.

### 7.8 Limites desta medição

- **A matriz não exercita a parte dura da mecânica.** Nenhum bot deixa a moral cair a 25, então a partida, a deserção e o piso só são medidos na seção 7.4, com um feudo sem ordens. Não há um perfil "jogador que some dois dias e volta": é o que o playtest (V2A-T1) e a rodada de balanceamento (V2C-T7) precisam olhar.
- **A chegada de colonos não é medida**: sem cartas nem objetivos novos a moral não chega a 80.
- **As 50 sementes continuam dando o mesmo resultado na matriz**: a moral só sorteia com 80 ou mais ou com 25 ou menos. A lista de sementes passa a trabalhar com o Conselho (V2D-T1).
- **As comparações da seção 7.3 foram medidas com três sementes e com variantes do bot que não estão no código** (um `recrutar` e uma alocação de teste, por `simulate({ ..., bot })`); só a cama vazia ficou. "Materiais por hora" soma três recursos de valor diferente: serve para comparar a mesma partida com e sem uma política, não para comparar perfis.
- **O limite de 20 aldeões da cama vazia é do bot**, não do jogo: é onde um par de braços (5% de um feudo de 20) empata com os 10 pontos de moral. Um jogador pode preferir outra conta.
- As faixas continuam sendo o jogo de hoje, com folga, e não metas (seção 2.5).
