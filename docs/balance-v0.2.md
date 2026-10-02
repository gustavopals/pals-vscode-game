# Balanceamento da v0.2

Medições do simulador (`@lotg/sim-cli`) ao longo da v0.2, na ordem em que foram feitas. Cada rodada traz data, commit, comandos e a saída como veio, para a seguinte poder ser comparada com ela. As faixas que a CI cobra nasceram na tarefa V2B-T4 do [roadmap](roadmap-v0.2.md) e estão na seção 2. Cada mecânica que muda a economia de propósito regrava a linha de base e registra a rodada aqui (as estações, na seção 3; o armazenamento, na seção 4, com a auditoria de alcançabilidade; a segunda fila e o início automático, na seção 5; a troca de ofício, na 6; a moral, na 7; a medida da meta de desperdício, na 8). A **rodada de balanceamento da Fase C** (V2C-T7) é a seção 9: as três dificuldades, o veredito da meta de desperdício, o caminho de compras, o desempenho e o que fica para o autor. A do fechamento da versão entra em V2F-T1.

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

## 8. A meta de desperdício, medida (correção da revisão da Fase C)

A revisão independente da Fase C apontou que a meta do GDD §15.2, como o [ADR 0013](decisions/0013-regras-da-v0.2-tempo-ritmo-migracao-e-economia.md) (decisão 17) a lê, não era medida nem cobrada: "nenhum recurso desperdiçando no cap por mais de 8 h de jogo contínuas", no perfil Regular. O simulador contava só as horas reais com algum depósito cheio (`Desperdiçando (h)`), sem recurso e sem sequência. Esta seção registra a medida que passou a existir e o que ela diz. **Nenhum número do conteúdo, nenhuma regra e nenhum bot mudaram**: a identificação é a da seção 7, e todas as outras colunas da matriz saíram idênticas às dela.

| | |
|---|---|
| Data | 2026-10-02 |
| Commit | o da correção (`git log --grep "meta de desperdício"`) |
| Identificação | Motor 0.1.0 · estado v7 · conteúdo 3acde0478685be9d |
| Dificuldade | Senhor (`lord`) |
| Sementes | 50 fixas: `pedra-alta-001` a `pedra-alta-050` |
| Ritmos | Rápido 3×, Normal 1× e Tranquilo 0,5× |
| Máquina | Apple M5, Node 24.19.0 |

### 8.1 A medida

**A maior sequência desperdiçando um recurso, em horas de jogo** (`wasteStreakGameHours`, em `packages/sim-cli/src/report.ts`): para cada recurso com limite (comida, madeira, pedra), a maior sequência de horas reais seguidas em que o desperdício acumulado subiu (a coluna `wasted_<recurso>` do CSV de uma partida), vezes o ritmo. Quem tem o CSV refaz a conta.

- O resumo de uma partida ganhou a linha `Maior sequência desperdiçando, em horas de jogo: food 36, wood 165, stone 144 (meta do GDD §15.2 para 2 sessões por dia: até 8)`.
- A matriz ganhou a coluna **"Maior sequência desperdiçando (h de jogo)"** (a do pior recurso de cada partida), a coluna `waste_streak_game_hours` no CSV e a seção **"Meta de desperdício"**, com as células do perfil Regular, recurso a recurso, e o veredito.
- A meta e o perfil que ela cobra são `WASTE_STREAK_GOAL` (2 sessões por dia, 8 h de jogo): uma meta de balanceamento, que nada no motor conhece.

**Resolução.** A amostra é de uma hora real, e a hora conta inteira quando o acumulado sobe ao menos uma unidade dentro dela. A medida arredonda para cima as pontas de cada sequência (até uma hora real em cada ponta: 6 h de jogo no ritmo 3, 2 h no ritmo 1, 1 h no 0,5) e não vê um desperdício menor que uma unidade por hora real. No ritmo 3, portanto, uma sequência medida de 9 h de jogo pode ser de pouco mais de 3 h de fato; uma de 165 h não deixa dúvida.

### 8.2 Comando e saída

```bash
pnpm -s sim -- --matrix > matriz.csv 2> matriz.md
pnpm -s sim -- --seed pedra-alta-001 --days 7 --strategy economico --sessions-per-day 2 --time-scale 3 > semana.csv
```

A meta, como a rodada a escreve:

| Janela | Ritmo | Perfil | Comida (h de jogo) | Madeira (h de jogo) | Pedra (h de jogo) | Meta | Veredito |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 7 dias reais | Rápido 3× | Regular | 36 | 165 | 144 | ≤ 8 | **acima** |
| 7 dias reais | Normal 1× | Regular | 4 | 9 | 0 | ≤ 8 | **acima** |
| 7 dias reais | Tranquilo 0,5× | Regular | 0 | 1,5 | 0,5 | ≤ 8 | dentro |
| Um ano de jogo | Rápido 3× | Regular | 18 | 9 | 3 | ≤ 8 | **acima** |
| Um ano de jogo | Normal 1× | Regular | 4 | 9 | 0 | ≤ 8 | **acima** |
| Um ano de jogo | Tranquilo 0,5× | Regular | 8,5 | 16 | 10,5 | ≤ 8 | **acima** |

A coluna nova da matriz, em todos os perfis (a do pior recurso; as 50 sementes dão o mesmo valor), ao lado do desperdício da partida:

| Janela | Ritmo | Perfil | Desperdício de comida | Desperdício de madeira | Desperdício de pedra | Desperdiçando (h reais) | Maior sequência desperdiçando (h de jogo) |
|---|---|---|---|---|---|---|---|
| 7 dias reais | Rápido 3× | Preguiçoso | 14.680 | 27.617 | 12.429 | 131 | 75 |
| 7 dias reais | Rápido 3× | Regular | 22.682 | 135.052 | 44.655 | 120 | 165 |
| 7 dias reais | Rápido 3× | Dedicado | 8.799 | 242.145 | 108.902 | 116 | 294 |
| 7 dias reais | Normal 1× | Preguiçoso | 0 | 1.147 | 0 | 23 | 6 |
| 7 dias reais | Normal 1× | Regular | 199 | 8.879 | 0 | 20 | 9 |
| 7 dias reais | Normal 1× | Dedicado | 0 | 30.744 | 5.472 | 40 | 27 |
| 7 dias reais | Tranquilo 0,5× | Preguiçoso | 0 | 144 | 0 | 7 | 3,5 |
| 7 dias reais | Tranquilo 0,5× | Regular | 0 | 1.111 | 42 | 5 | 1,5 |
| 7 dias reais | Tranquilo 0,5× | Dedicado | 0 | 0 | 0 | 0 | 0 |
| Um ano de jogo | Rápido 3× | Preguiçoso | 79 | 5.091 | 0 | 36 | 75 |
| Um ano de jogo | Rápido 3× | Regular | 1.642 | 1.534 | 43 | 20 | 18 |
| Um ano de jogo | Rápido 3× | Dedicado | 1.059 | 1.566 | 0 | 12 | 9 |
| Um ano de jogo | Normal 1× | Preguiçoso | 0 | 1.147 | 0 | 23 | 6 |
| Um ano de jogo | Normal 1× | Regular | 199 | 8.879 | 0 | 20 | 9 |
| Um ano de jogo | Normal 1× | Dedicado | 0 | 30.744 | 5.472 | 40 | 27 |
| Um ano de jogo | Tranquilo 0,5× | Preguiçoso | 0 | 340 | 0 | 9 | 3,5 |
| Um ano de jogo | Tranquilo 0,5× | Regular | 291 | 32.127 | 4.741 | 82 | 16 |
| Um ano de jogo | Tranquilo 0,5× | Dedicado | 122 | 36.574 | 6.489 | 91 | 19 |

### 8.3 O que a medida diz

- **O perfil Regular passa da meta em cinco das seis células.** Só a semana do ritmo Tranquilo fica dentro, e ela é meio ano de jogo: no ano inteiro do mesmo ritmo a madeira vai ao chão por 16 h de jogo seguidas.
- **No ritmo Rápido, o recomendado, o desvio é de outra ordem de grandeza: 165 h de jogo seguidas de madeira, 144 de pedra e 36 de comida** nos sete dias reais. A causa não é o depósito, e é a que a seção 5.4 já apontava: o feudo acaba. A última obra do Regular termina na hora real 113 (Salão no nível 7, tudo o mais no 8, que é o teto alcançável em Senhor); dali até a hora 168 não há onde gastar, e a madeira vai ao chão nas 55 horas reais que restam, sem parar (165 h de jogo), e a pedra nas últimas 48. Ao todo são 120 das 168 horas com depósito cheio, e o ouro parado chega a 37.628.
- **No primeiro ano do ritmo Rápido (56 h reais) o pior recurso é a comida, 18 h de jogo**, e a madeira fica em 9: aqui a medida está dentro da margem da própria resolução (6 h de jogo).
- **No ritmo Normal a madeira passa da meta por uma hora: 9 h de jogo seguidas**, entre duas visitas (12 h). É o caso em que um ajuste pequeno resolve: um nível de Armazém mais cedo, ou o bot mandando os braços para o ouro quando a madeira enche (seção 4.8: o bot não reage ao depósito cheio na alocação).
- **Jogar mais vezes não reduz a sequência**: o Dedicado tem 27 h no ritmo 1 e 294 h no ritmo 3, porque chega mais cedo ao teto. A meta do GDD só fala do Regular.

### 8.4 Faixas, e o que fica para o autor

- **A sequência ganhou faixa em toda célula**, pela regra da seção 2.3: o maior valor medido com 5% de folga (`wasteStreakMax`; a coluna nova de `MEASURED`, em `packages/sim-cli/src/bands.ts`). É guarda de regressão: uma mudança que piore a sequência de qualquer perfil reprova a rodada.
- **A meta não virou faixa.** Cobrar 8 h hoje reprovaria cinco células, e trazê-las para dentro pede mexer em números do conteúdo (mais níveis ou um sumidouro para o que sobra no ritmo Rápido, capacidade ou custo dos depósitos no Normal), que é decisão de balanceamento do autor (ADR 0013, decisão 5: nenhum número foi ajustado antes das mecânicas; V2C-T7.2 e V2F-T1). `balance.test.ts` guarda, célula a célula, quais passam da meta e por quanto: quando uma delas entrar, o teste cai e a lista encolhe de propósito.
- **O "pronto quando" de V2C-T7 ("o bot Regular satisfaz a faixa de desperdício") não está cumprido.** O que há é a medida, que a tarefa não tinha.

### 8.5 Limites desta medição

- A resolução é a da seção 8.1: uma hora real por amostra. Uma medida exata, em milissegundos de jogo, pediria ao motor guardar o instante em que cada episódio de depósito cheio começa e termina; hoje ele só conta o total do dia.
- A medida é do bot. O `economico` não troca de ofício quando um depósito enche; um jogador trocaria, e a sequência dele seria menor.
- As 50 sementes continuam dando o mesmo resultado (seção 7.8).

## 9. Rodada de balanceamento da Fase C (V2C-T7)

Tarefa V2C-T7 (subtarefas 2, 3 e 4): a matriz do simulador nas **três dificuldades**, a meta de desperdício do GDD §15.2, o caminho de compras até os desbloqueios da fase e o desempenho do motor em ausências longas. **Nenhum número do conteúdo mudou** (a identificação é a mesma das seções 7 e 8). Mudaram o bot econômico, que deixou de produzir para o chão (seção 9.2), o que o simulador mede (seção 9.1) e uma frase da visão (seção 9.5). O que esta rodada deixa para o autor decidir está na seção 9.8.

| | |
|---|---|
| Data | 2026-10-02 |
| Commit | o desta tarefa (`git log --grep "V2C-T7: rodada"`), feito sobre `d14398c` |
| Identificação | Motor 0.1.0 · estado v7 · conteúdo 3acde0478685be9d |
| Dificuldades | Camponês (`peasant`), Senhor (`lord`) e Rei de Ferro (`ironKing`) |
| Sementes | 50 fixas: `pedra-alta-001` a `pedra-alta-050` |
| Ritmos | Rápido 3×, Normal 1× e Tranquilo 0,5× |
| Máquina | Apple M5 (10 núcleos, 16 GB), macOS 26.6.2, Node 24.19.0 |

### 9.1 O que o simulador passou a medir

O roadmap (V2C-T7.2 e §7.3) pede desperdício por recurso em quantidade e em horas contínuas, fila ociosa, horas de frio e de fome, deserções, população mínima e a hora do Salão nos níveis 2, 3 e 4, do Celeiro e do Armazém. O que faltava entrou no resumo de uma partida, no CSV da matriz e em duas tabelas novas por janela:

- **Progresso.** A hora real, desde a fundação, em que o Salão chega aos níveis 2, 3 e 4 e em que o Celeiro e o Armazém ficam de pé (`MILESTONES`, em `packages/sim-cli/src/report.ts`); "—" é "não chegou na partida". **Fim das obras** é a hora em que o feudo fica sem nada em obras e sem nada por fazer, até o fim da partida: tudo no teto, preso ao Salão que não sobe ou com o custo acima do que o depósito guarda. Um depósito que ninguém planejou e que não trava obra nenhuma não conta como obra por fazer. Vêm junto as **obras que começaram sozinhas** (as planejadas automáticas) e a **menor população** da partida.
- **Desperdício por recurso.** A **parte da produção que foi ao chão**, em por cento: o desperdício da partida sobre a produção bruta do mesmo recurso, somada hora a hora. Cada recurso por si, nunca somados; sem produção, "—". E a **maior sequência desperdiçando** de cada recurso, em horas de jogo (até a seção 8 a matriz só trazia a do pior).
- **As três dificuldades têm faixa.** `MEASURED`, em `packages/sim-cli/src/bands.ts`, guarda uma linha de base por dificuldade, e `pnpm -s sim -- --matrix --difficulty peasant` (ou `ironKing`) passa a conferir as faixas dela.
- **`pnpm -s sim -- --perf`** mede o motor na volta de ausências longas (seção 9.7).

As horas são reais e amostradas ao fim de cada hora. A produção bruta da "parte perdida" é a de `workers[].grossPerHour` no fim de cada hora, uma aproximação: serve para dizer "2%" contra "70%", não para a segunda casa.

### 9.2 O bot econômico deixou de produzir para o chão

As seções 4.8, 5.8 e 8.5 repetiam o mesmo limite: "o bot não reage ao depósito cheio na alocação". Ele mandava braços para o material que já não cabia, e um jogador não faria isso: o painel diz "ponha parte dos lavradores em outro ofício". A regra da casa é ajustar os números quando o jogo falha e o bot quando é ele que joga mal. Aqui era o bot, e foi ele que mudou, na política `alocar por demanda`:

- **O bot arruma o feudo para as horas que vai passar fora.** Um jogador sabe quando volta, e o bot passou a saber também: 12 horas reais para o Regular (2 visitas por dia), 6 para o Dedicado (`botFor`, em `packages/sim-cli/src/bots/index.ts`). Não é informação do jogo: é o hábito de quem joga.
- **Em um recurso com limite só ficam os braços cuja produção tem para onde ir até a volta**: o espaço que resta no depósito, o que as obras da lista ainda vão levar (cada obra uma vez, incluindo as que esperam o Salão enquanto ele pode subir) e o que sai sozinho (as bocas, a lareira). Quem sobra sai na hora e vai para o material que falta ou, se nada falta, para o ouro, que não tem limite.
- **A fazenda segue a mesma regra, com cautela.** Ficam os lavradores cuja colheita cabe na despensa durante a ausência, em dois trechos quando a estação vira no meio dela (a visão diz o saldo da comida depois da virada). A conta nunca deixa menos do que o estoque para outra ausência inteira, e depois da ordem o bot confere o painel: se a previsão da estação que vem diz que a comida não chega à volta, devolve os lavradores.
- **Cada ofício guarda o que aprendeu.** Enquanto a experiência sobe, fica o que o edifício pede para contar como ocupado; com ela no máximo, basta um trabalhador. Quando o feudo não tem mais o que construir, nenhum: a experiência já não compra nada.
- **O depósito que ninguém pediu não entra na conta do que falta.** O Celeiro sem uso à vista não é motivo para juntar madeira.

O que ficou igual: a ordem das políticas, o preguiçoso inteiro (ele decide o mínimo e não tira ninguém do lugar) e `ampliar o estoque`, que continua olhando 8 horas reais à frente, o prazo que o próprio jogo usa no aviso "cheio em menos de 8 h".

**O que a mudança fez**, perfil Regular, 7 dias reais, Senhor (antes: seções 7 e 8):

| Ritmo | População | Salão | Madeira no chão | Pedra no chão | Comida no chão | Horas com depósito perdendo produção | Maior sequência (h de jogo) | Ouro parado |
|---|---|---|---|---|---|---|---|---|
| Rápido 3× | 72 → 72 | 7 → 7 | 135.052 → 1.181 | 44.655 → 391 | 22.682 → 1.494 | 120 → 20 | 165 → 18 | 37.628 → 156.690 |
| Normal 1× | 66 → 69 | 7 → 7 | 8.879 → 49 | 0 → 0 | 199 → 0 | 20 → 0 | 9 → 1 | 2.000 → 8.708 |
| Tranquilo 0,5× | 54 → 54 | 6 → 6 | 1.111 → 6 | 42 → 0 | 0 → 0 | 5 → 0 | 1,5 → 0,5 | 652 → 1.156 |

- **O desperdício quase acaba, e o feudo anda igual ou um pouco mais.** No ritmo Rápido o Regular perdia 70% da madeira que cortava e 62% da pedra; perde 2% de cada. A população e o Salão não caem em nenhuma célula do Regular; o Salão no nível 4 (a segunda fila) chega na hora 36 no ritmo Rápido (era 38), na 64 no Normal (igual) e na 104 no Tranquilo (era 107).
- **O que ia ao chão virou ouro.** É a leitura honesta do "ouro parado": 156 mil no ritmo Rápido. O bot não tem onde gastá-lo, e isso é do jogo, não dele (seção 9.6).
- **O Dedicado do ritmo Rápido perde um nível de Salão no primeiro ano** (56 h reais): 6 no lugar de 7, com a mesma população (52). O Armazém dele fica de pé na hora 25, e não na 19: antes a madeira transbordava e `ampliar o estoque` o erguia cedo; sem transbordo, o depósito só sobe quando trava uma obra, e o Salão 7 pede o Armazém no nível 5. Em 7 dias reais ele chega ao mesmo Salão 7, com 74 aldeões.
- **A fila ociosa do Regular sobe no ritmo Rápido** (40 h → 110 h). Das 110 horas, 55 são depois do fim das obras: é o Celeiro, que parou no nível 6 quando a comida deixou de transbordar, e que continua "podendo começar" sem o bot querer. As outras 55 não foram abertas uma a uma.
- **As trocas de ofício sobem, e ficam abaixo de uma a cada dez trabalhadores por visita** no perfil Regular (o teste de `bots.test.ts` cobra isso). Na medida da seção 6.3 (trabalhadores que chegam a um edifício vindos de outro, somados nas visitas da semana; semente `pedra-alta-001`):

  | Ritmo | Sessões por dia | Trocas antes (seção 6.3) | Trocas agora | Agora, por trabalhador presente |
  |---|---:|---:|---:|---:|
  | Rápido 3× | 2 | 5 | 42 | 8,6% |
  | Rápido 3× | 4 | 26 | 102 | 6,7% |
  | Normal 1× | 2 | 27 | 43 | 9,5% |
  | Normal 1× | 4 | 42 | 153 | 11,5% |
  | Tranquilo 0,5× | 2 | 13 | 23 | 6,4% |

  Antes o bot quase não mexia em ninguém, e pagava com a produção de quem ficava no ofício cheio. Uma adaptação custa meio rendimento por um dia de jogo; o depósito cheio custa o rendimento inteiro. A coluna "antes" é de antes da moral (V2C-T4), e a contagem de agora foi feita por um contador de fora do simulador que não ficou no código.

**O que foi medido e não entrou.** Dar peso a cada ofício pelo que falta **até o limite do depósito** (e não pela soma do que as obras pedem) parecia a correção natural, e foi a primeira tentativa. Com ela o Regular do ritmo Normal trocava 99 trabalhadores de ofício na semana (21%), chegava ao Salão 4 três horas depois (hora 67) e ainda perdia 1.468 de madeira: o que falta "até o limite" muda a cada compra, e o bot ia e voltava. Ficou o peso de sempre, com o limite por cima. Contar o depósito que ninguém pediu entre as obras também dobra as trocas (20% no mesmo perfil) sem ganho.

Também não entrou **ler na lista das planejadas o motivo que a fila ocupada esconde**. Com as filas ocupadas no instante em que o bot aloca (ele acabou de iniciar uma obra), a lista de obras diz só "os pedreiros estão ocupados" para todas, e o bot conta como gasto de madeira até as que na verdade esperam o Salão. A lista das planejadas diz o motivo de verdade ("espera o Salão chegar ao nível 8"). Usá-la melhora Camponês e piora as outras duas dificuldades, sempre no ritmo Rápido e em 7 dias reais: em Camponês a madeira no chão do Regular cai de 26.006 para 11.420; em Senhor sobe de 1.181 para 3.750, e as obras acabam 11 horas depois; em Rei de Ferro, a do Dedicado sobe de 4.722 para 10.861. O resultado é sensível demais ao instante de cada compra para a mudança valer o código. É um limite do bot que continua, e é a causa do que sobra em Camponês (seção 9.3).

### 9.3 Comando e saída

```bash
pnpm -s sim -- --matrix > matriz-senhor.csv 2> matriz-senhor.md
pnpm -s sim -- --matrix --difficulty peasant > matriz-campones.csv 2> matriz-campones.md
pnpm -s sim -- --matrix --difficulty ironKing > matriz-rei-de-ferro.csv 2> matriz-rei-de-ferro.md
```

900 linhas no CSV e 750 partidas distintas em cada dificuldade (2.250 ao todo); cada rodada leva cerca de 23 s. As três saem com código 0: todas as partidas dentro das faixas da própria dificuldade, nenhuma ordem recusada. **Nenhuma partida passa fome nem frio, e nenhuma perde um aldeão**, em nenhuma dificuldade: a menor moral é 40. As 50 sementes continuam dando o mesmo resultado em toda célula das três rodadas (nenhum bot chega à moral que sorteia).

#### Senhor, tabela 1: 7 dias reais

| Ritmo | Perfil | Anos de jogo | População | Salão | Fome (h) | Frio (h) | Moral mínima | Moral baixa (h) | Foram embora | Fila ociosa (h) | Sem ofício (aldeão-h) | Excedente de madeira | Excedente de pedra | Excedente de ouro | Desperdício de comida | Desperdício de madeira | Desperdício de pedra | Desperdiçando (h) | Maior sequência desperdiçando (h de jogo) | Recusas | Faixa |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso (1/dia, preguicoso) | 3 | 33 | 7 | 0 | 0 | 50 | 0 | 0 | 103 | 672 | 3.900 | 3.900 | 4.660 | 14.680 | 27.617 | 12.429 | 131 | 75 | 0 | dentro |
| Rápido 3× | Regular (2/dia, economico) | 3 | 72 | 7 | 0 | 0 | 50 | 0 | 0 | 110 | 804 | 4.236 | 5.100 | 156.690 | 1.494 | 1.181 | 391 | 20 | 18 | 0 | dentro |
| Rápido 3× | Dedicado (4/dia, economico) | 3 | 74 | 7 | 0 | 0 | 50 | 0 | 0 | 45 | 414 | 4.212 | 5.020 | 276.963 | 0 | 269 | 20 | 1 | 3 | 0 | dentro |
| Normal 1× | Preguiçoso (1/dia, preguicoso) | 1 | 33 | 6 | 0 | 0 | 50 | 0 | 0 | 62 | 664 | 692 | 713 | 1.637 | 0 | 1.147 | 0 | 23 | 6 | 0 | dentro |
| Normal 1× | Regular (2/dia, economico) | 1 | 69 | 7 | 0 | 0 | 40 | 2 | 0 | 53 | 745 | 3.741 | 3.663 | 8.708 | 0 | 49 | 0 | 0 | 1 | 0 | dentro |
| Normal 1× | Dedicado (4/dia, economico) | 1 | 74 | 7 | 0 | 0 | 40 | 2 | 0 | 90 | 393 | 4.097 | 5.039 | 33.685 | 0 | 77 | 0 | 0 | 1 | 0 | dentro |
| Tranquilo 0,5× | Preguiçoso (1/dia, preguicoso) | 0,5 | 14 | 4 | 0 | 0 | 50 | 0 | 0 | 55 | 212 | 70 | 188 | 231 | 0 | 144 | 0 | 7 | 3,5 | 0 | dentro |
| Tranquilo 0,5× | Regular (2/dia, economico) | 0,5 | 54 | 6 | 0 | 0 | 40 | 4 | 0 | 46 | 534 | 589 | 1.726 | 1.156 | 0 | 6 | 0 | 0 | 0,5 | 0 | dentro |
| Tranquilo 0,5× | Dedicado (4/dia, economico) | 0,5 | 62 | 6 | 0 | 0 | 50 | 0 | 0 | 72 | 313 | 230 | 56 | 152 | 0 | 13 | 0 | 0 | 0,5 | 0 | dentro |

Faixas cobradas:

| Ritmo | Perfil | População | Salão | Fome (h) | Frio (h) | Excedente de madeira | Excedente de pedra | Excedente de ouro | Maior sequência desperdiçando (h de jogo) | Recusas |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso | 29 a 37 | ≥ 7 | ≤ 0 | ≤ 0 | ≤ 4.095 | ≤ 4.095 | ≤ 4.893 | ≤ 79 | 0 |
| Rápido 3× | Regular | 64 a 80 | ≥ 7 | ≤ 0 | ≤ 0 | ≤ 4.448 | ≤ 5.355 | ≤ 164.525 | ≤ 19 | 0 |
| Rápido 3× | Dedicado | 66 a 82 | ≥ 7 | ≤ 0 | ≤ 0 | ≤ 4.423 | ≤ 5.271 | ≤ 290.812 | ≤ 4 | 0 |
| Normal 1× | Preguiçoso | 29 a 37 | ≥ 6 | ≤ 0 | ≤ 0 | ≤ 727 | ≤ 749 | ≤ 1.719 | ≤ 7 | 0 |
| Normal 1× | Regular | 62 a 76 | ≥ 7 | ≤ 0 | ≤ 0 | ≤ 3.929 | ≤ 3.847 | ≤ 9.144 | ≤ 2 | 0 |
| Normal 1× | Dedicado | 66 a 82 | ≥ 7 | ≤ 0 | ≤ 0 | ≤ 4.302 | ≤ 5.291 | ≤ 35.370 | ≤ 2 | 0 |
| Tranquilo 0,5× | Preguiçoso | 12 a 16 | ≥ 4 | ≤ 0 | ≤ 0 | ≤ 74 | ≤ 198 | ≤ 243 | ≤ 4 | 0 |
| Tranquilo 0,5× | Regular | 48 a 60 | ≥ 6 | ≤ 0 | ≤ 0 | ≤ 619 | ≤ 1.813 | ≤ 1.214 | ≤ 1 | 0 |
| Tranquilo 0,5× | Dedicado | 55 a 69 | ≥ 6 | ≤ 0 | ≤ 0 | ≤ 242 | ≤ 59 | ≤ 160 | ≤ 1 | 0 |

Progresso (horas reais desde a fundação):

| Ritmo | Perfil | Salão Nv2 (h) | Salão Nv3 (h) | Salão Nv4 (h) | Celeiro (h) | Armazém (h) | Fim das obras (h) | Obras que começaram sozinhas | População mínima |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso | 29 | 54 | 76 | 33 | 31 | — | 39 | 7 |
| Rápido 3× | Regular | 11 | 22 | 36 | 25 | 26 | 113 | 46 | 7 |
| Rápido 3× | Dedicado | 10 | 19 | 27 | 14 | 25 | 75 | 49 | 7 |
| Normal 1× | Preguiçoso | 40 | 78 | 103 | 73 | 49 | — | 34 | 7 |
| Normal 1× | Regular | 27 | 47 | 64 | 33 | 61 | — | 47 | 7 |
| Normal 1× | Dedicado | 21 | 39 | 52 | 31 | 55 | 134 | 45 | 7 |
| Tranquilo 0,5× | Preguiçoso | 54 | 106 | 143 | — | 65 | — | 21 | 6 |
| Tranquilo 0,5× | Regular | 42 | 75 | 104 | 85 | 87 | — | 33 | 6 |
| Tranquilo 0,5× | Dedicado | 35 | 68 | 93 | — | 98 | — | 37 | 6 |

Desperdício por recurso:

| Ritmo | Perfil | Comida perdida (% da produção) | Madeira perdida (% da produção) | Pedra perdida (% da produção) | Comida (h de jogo) | Madeira (h de jogo) | Pedra (h de jogo) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso | 51% | 46% | 44% | 63 | 75 | 48 |
| Rápido 3× | Regular | 5% | 2% | 2% | 18 | 9 | 12 |
| Rápido 3× | Dedicado | 0% | 0% | 0% | 0 | 3 | 3 |
| Normal 1× | Preguiçoso | 0% | 7% | 0% | 0 | 6 | 0 |
| Normal 1× | Regular | 0% | 0% | 0% | 0 | 1 | 0 |
| Normal 1× | Dedicado | 0% | 0% | 0% | 0 | 1 | 0 |
| Tranquilo 0,5× | Preguiçoso | 0% | 3% | 0% | 0 | 3,5 | 0 |
| Tranquilo 0,5× | Regular | 0% | 0% | 0% | 0 | 0,5 | 0 |
| Tranquilo 0,5× | Dedicado | 0% | 0% | 0% | 0 | 0,5 | 0 |

#### Senhor, tabela 2: um ano de jogo

| Ritmo | Perfil | Horas reais | População | Salão | Fome (h) | Frio (h) | Moral mínima | Moral baixa (h) | Foram embora | Fila ociosa (h) | Sem ofício (aldeão-h) | Excedente de madeira | Excedente de pedra | Excedente de ouro | Desperdício de comida | Desperdício de madeira | Desperdício de pedra | Desperdiçando (h) | Maior sequência desperdiçando (h de jogo) | Recusas | Faixa |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso (1/dia, preguicoso) | 56 | 13 | 3 | 0 | 0 | 50 | 0 | 0 | 21 | 176 | 513 | 531 | 160 | 79 | 5.091 | 0 | 36 | 75 | 0 | dentro |
| Rápido 3× | Regular (2/dia, economico) | 56 | 27 | 5 | 0 | 0 | 50 | 0 | 0 | 16 | 244 | 624 | 1.198 | 2.364 | 1.202 | 0 | 0 | 13 | 18 | 0 | dentro |
| Rápido 3× | Dedicado (4/dia, economico) | 56 | 52 | 6 | 0 | 0 | 50 | 0 | 0 | 16 | 262 | 889 | 1.427 | 11.896 | 0 | 0 | 20 | 0 | 3 | 0 | dentro |
| Normal 1× | Preguiçoso (1/dia, preguicoso) | 168 | 33 | 6 | 0 | 0 | 50 | 0 | 0 | 62 | 664 | 692 | 713 | 1.637 | 0 | 1.147 | 0 | 23 | 6 | 0 | dentro |
| Normal 1× | Regular (2/dia, economico) | 168 | 69 | 7 | 0 | 0 | 40 | 2 | 0 | 53 | 745 | 3.741 | 3.663 | 8.708 | 0 | 49 | 0 | 0 | 1 | 0 | dentro |
| Normal 1× | Dedicado (4/dia, economico) | 168 | 74 | 7 | 0 | 0 | 40 | 2 | 0 | 90 | 393 | 4.097 | 5.039 | 33.685 | 0 | 77 | 0 | 0 | 1 | 0 | dentro |
| Tranquilo 0,5× | Preguiçoso (1/dia, preguicoso) | 336 | 23 | 6 | 0 | 0 | 50 | 0 | 0 | 187 | 425 | 1.029 | 1.279 | 977 | 0 | 340 | 0 | 9 | 3,5 | 0 | dentro |
| Tranquilo 0,5× | Regular (2/dia, economico) | 336 | 74 | 7 | 0 | 0 | 40 | 4 | 0 | 191 | 746 | 4.063 | 5.050 | 39.449 | 134 | 6 | 0 | 4 | 2 | 0 | dentro |
| Tranquilo 0,5× | Dedicado (4/dia, economico) | 336 | 74 | 7 | 0 | 0 | 50 | 0 | 0 | 226 | 370 | 3.108 | 3.709 | 43.687 | 0 | 383 | 0 | 1 | 1 | 0 | dentro |

Faixas cobradas:

| Ritmo | Perfil | População | Salão | Fome (h) | Frio (h) | Excedente de madeira | Excedente de pedra | Excedente de ouro | Maior sequência desperdiçando (h de jogo) | Recusas |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso | 11 a 15 | ≥ 3 | ≤ 0 | ≤ 0 | ≤ 539 | ≤ 558 | ≤ 168 | ≤ 79 | 0 |
| Rápido 3× | Regular | 24 a 30 | ≥ 5 | ≤ 0 | ≤ 0 | ≤ 656 | ≤ 1.258 | ≤ 2.483 | ≤ 19 | 0 |
| Rápido 3× | Dedicado | 46 a 58 | ≥ 6 | ≤ 0 | ≤ 0 | ≤ 934 | ≤ 1.499 | ≤ 12.491 | ≤ 4 | 0 |
| Normal 1× | Preguiçoso | 29 a 37 | ≥ 6 | ≤ 0 | ≤ 0 | ≤ 727 | ≤ 749 | ≤ 1.719 | ≤ 7 | 0 |
| Normal 1× | Regular | 62 a 76 | ≥ 7 | ≤ 0 | ≤ 0 | ≤ 3.929 | ≤ 3.847 | ≤ 9.144 | ≤ 2 | 0 |
| Normal 1× | Dedicado | 66 a 82 | ≥ 7 | ≤ 0 | ≤ 0 | ≤ 4.302 | ≤ 5.291 | ≤ 35.370 | ≤ 2 | 0 |
| Tranquilo 0,5× | Preguiçoso | 20 a 26 | ≥ 6 | ≤ 0 | ≤ 0 | ≤ 1.081 | ≤ 1.343 | ≤ 1.026 | ≤ 4 | 0 |
| Tranquilo 0,5× | Regular | 66 a 82 | ≥ 7 | ≤ 0 | ≤ 0 | ≤ 4.267 | ≤ 5.303 | ≤ 41.422 | ≤ 3 | 0 |
| Tranquilo 0,5× | Dedicado | 66 a 82 | ≥ 7 | ≤ 0 | ≤ 0 | ≤ 3.264 | ≤ 3.895 | ≤ 45.872 | ≤ 2 | 0 |

Progresso (horas reais desde a fundação):

| Ritmo | Perfil | Salão Nv2 (h) | Salão Nv3 (h) | Salão Nv4 (h) | Celeiro (h) | Armazém (h) | Fim das obras (h) | Obras que começaram sozinhas | População mínima |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso | 29 | 54 | — | 33 | 31 | — | 14 | 7 |
| Rápido 3× | Regular | 11 | 22 | 36 | 25 | 26 | — | 29 | 7 |
| Rápido 3× | Dedicado | 10 | 19 | 27 | 14 | 25 | — | 39 | 7 |
| Normal 1× | Preguiçoso | 40 | 78 | 103 | 73 | 49 | — | 34 | 7 |
| Normal 1× | Regular | 27 | 47 | 64 | 33 | 61 | — | 47 | 7 |
| Normal 1× | Dedicado | 21 | 39 | 52 | 31 | 55 | 134 | 45 | 7 |
| Tranquilo 0,5× | Preguiçoso | 54 | 106 | 143 | — | 65 | — | 34 | 6 |
| Tranquilo 0,5× | Regular | 42 | 75 | 104 | 85 | 87 | 249 | 48 | 6 |
| Tranquilo 0,5× | Dedicado | 35 | 68 | 93 | 181 | 98 | 304 | 46 | 6 |

Desperdício por recurso:

| Ritmo | Perfil | Comida perdida (% da produção) | Madeira perdida (% da produção) | Pedra perdida (% da produção) | Comida (h de jogo) | Madeira (h de jogo) | Pedra (h de jogo) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso | 3% | 62% | 0% | 15 | 75 | 0 |
| Rápido 3× | Regular | 20% | 0% | 0% | 18 | 0 | 0 |
| Rápido 3× | Dedicado | 0% | 0% | 0% | 0 | 0 | 3 |
| Normal 1× | Preguiçoso | 0% | 7% | 0% | 0 | 6 | 0 |
| Normal 1× | Regular | 0% | 0% | 0% | 0 | 1 | 0 |
| Normal 1× | Dedicado | 0% | 0% | 0% | 0 | 1 | 0 |
| Tranquilo 0,5× | Preguiçoso | 0% | 2% | 0% | 0 | 3,5 | 0 |
| Tranquilo 0,5× | Regular | 1% | 0% | 0% | 2 | 0,5 | 0 |
| Tranquilo 0,5× | Dedicado | 0% | 1% | 0% | 0 | 1 | 0 |

#### Camponês, tabela 1: 7 dias reais

| Ritmo | Perfil | Anos de jogo | População | Salão | Fome (h) | Frio (h) | Moral mínima | Moral baixa (h) | Foram embora | Fila ociosa (h) | Sem ofício (aldeão-h) | Excedente de madeira | Excedente de pedra | Excedente de ouro | Desperdício de comida | Desperdício de madeira | Desperdício de pedra | Desperdiçando (h) | Maior sequência desperdiçando (h de jogo) | Recusas | Faixa |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso (1/dia, preguicoso) | 3 | 33 | 7 | 0 | 0 | 50 | 0 | 0 | 104 | 672 | 4.125 | 4.125 | 4.666 | 13.855 | 29.154 | 13.085 | 130 | 72 | 0 | dentro |
| Rápido 3× | Regular (2/dia, economico) | 3 | 72 | 8 | 0 | 0 | 50 | 0 | 0 | 120 | 804 | 5.511 | 6.111 | 127.764 | 453 | 26.006 | 3.347 | 27 | 30 | 0 | dentro |
| Rápido 3× | Dedicado (4/dia, economico) | 3 | 84 | 8 | 0 | 0 | 50 | 0 | 0 | 61 | 474 | 5.316 | 6.168 | 304.802 | 81 | 777 | 0 | 2 | 6 | 0 | dentro |
| Normal 1× | Preguiçoso (1/dia, preguicoso) | 1 | 33 | 6 | 0 | 0 | 50 | 0 | 0 | 81 | 664 | 729 | 587 | 1.749 | 167 | 922 | 0 | 23 | 6 | 0 | dentro |
| Normal 1× | Regular (2/dia, economico) | 1 | 68 | 7 | 0 | 0 | 40 | 2 | 0 | 68 | 734 | 4.018 | 2.125 | 12.251 | 0 | 0 | 0 | 0 | 0 | 0 | dentro |
| Normal 1× | Dedicado (4/dia, economico) | 1 | 84 | 8 | 0 | 0 | 40 | 2 | 0 | 101 | 449 | 5.221 | 5.908 | 18.505 | 0 | 0 | 0 | 0 | 0 | 0 | dentro |
| Tranquilo 0,5× | Preguiçoso (1/dia, preguicoso) | 0,5 | 14 | 4 | 0 | 0 | 50 | 0 | 0 | 58 | 212 | 211 | 181 | 237 | 0 | 19 | 0 | 1 | 1 | 0 | dentro |
| Tranquilo 0,5× | Regular (2/dia, economico) | 0,5 | 54 | 6 | 0 | 0 | 40 | 4 | 0 | 68 | 534 | 1.065 | 460 | 271 | 0 | 0 | 0 | 0 | 0 | 0 | dentro |
| Tranquilo 0,5× | Dedicado (4/dia, economico) | 0,5 | 62 | 6 | 0 | 0 | 50 | 0 | 0 | 69 | 313 | 327 | 452 | 537 | 0 | 0 | 0 | 0 | 0 | 0 | dentro |

Progresso (horas reais desde a fundação):

| Ritmo | Perfil | Salão Nv2 (h) | Salão Nv3 (h) | Salão Nv4 (h) | Celeiro (h) | Armazém (h) | Fim das obras (h) | Obras que começaram sozinhas | População mínima |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso | 29 | 54 | 77 | 33 | 31 | — | 38 | 7 |
| Rápido 3× | Regular | 11 | 22 | 36 | 25 | 26 | 128 | 49 | 7 |
| Rápido 3× | Dedicado | 11 | 19 | 25 | 14 | 19 | 76 | 54 | 7 |
| Normal 1× | Preguiçoso | 40 | 78 | 103 | 97 | 49 | — | 33 | 7 |
| Normal 1× | Regular | 27 | 47 | 62 | 39 | 37 | — | 46 | 7 |
| Normal 1× | Dedicado | 21 | 39 | 52 | 31 | 55 | 164 | 52 | 7 |
| Tranquilo 0,5× | Preguiçoso | 54 | 106 | 143 | — | 65 | — | 21 | 6 |
| Tranquilo 0,5× | Regular | 42 | 75 | 102 | 157 | 109 | — | 33 | 6 |
| Tranquilo 0,5× | Dedicado | 35 | 68 | 93 | — | 98 | — | 37 | 6 |

#### Camponês, tabela 2: um ano de jogo

| Ritmo | Perfil | Horas reais | População | Salão | Fome (h) | Frio (h) | Moral mínima | Moral baixa (h) | Foram embora | Fila ociosa (h) | Sem ofício (aldeão-h) | Excedente de madeira | Excedente de pedra | Excedente de ouro | Desperdício de comida | Desperdício de madeira | Desperdício de pedra | Desperdiçando (h) | Maior sequência desperdiçando (h de jogo) | Recusas | Faixa |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso (1/dia, preguicoso) | 56 | 13 | 3 | 0 | 0 | 50 | 0 | 0 | 22 | 176 | 994 | 659 | 161 | 0 | 4.866 | 0 | 35 | 72 | 0 | dentro |
| Rápido 3× | Regular (2/dia, economico) | 56 | 27 | 5 | 0 | 0 | 50 | 0 | 0 | 18 | 244 | 1.429 | 1.155 | 1.185 | 184 | 0 | 0 | 4 | 12 | 0 | dentro |
| Rápido 3× | Dedicado (4/dia, economico) | 56 | 50 | 7 | 0 | 0 | 50 | 0 | 0 | 16 | 250 | 574 | 80 | 1.239 | 81 | 0 | 0 | 1 | 3 | 0 | dentro |
| Normal 1× | Preguiçoso (1/dia, preguicoso) | 168 | 33 | 6 | 0 | 0 | 50 | 0 | 0 | 81 | 664 | 729 | 587 | 1.749 | 167 | 922 | 0 | 23 | 6 | 0 | dentro |
| Normal 1× | Regular (2/dia, economico) | 168 | 68 | 7 | 0 | 0 | 40 | 2 | 0 | 68 | 734 | 4.018 | 2.125 | 12.251 | 0 | 0 | 0 | 0 | 0 | 0 | dentro |
| Normal 1× | Dedicado (4/dia, economico) | 168 | 84 | 8 | 0 | 0 | 40 | 2 | 0 | 101 | 449 | 5.221 | 5.908 | 18.505 | 0 | 0 | 0 | 0 | 0 | 0 | dentro |
| Tranquilo 0,5× | Preguiçoso (1/dia, preguicoso) | 336 | 23 | 6 | 0 | 0 | 50 | 0 | 0 | 197 | 425 | 691 | 1.756 | 1.001 | 0 | 19 | 0 | 1 | 1 | 0 | dentro |
| Tranquilo 0,5× | Regular (2/dia, economico) | 336 | 84 | 8 | 0 | 0 | 40 | 4 | 0 | 221 | 852 | 6.347 | 6.298 | 17.012 | 0 | 0 | 0 | 0 | 0 | 0 | dentro |
| Tranquilo 0,5× | Dedicado (4/dia, economico) | 336 | 84 | 8 | 0 | 0 | 50 | 0 | 0 | 218 | 416 | 5.583 | 5.811 | 27.646 | 0 | 23 | 0 | 1 | 0,5 | 0 | dentro |

Progresso (horas reais desde a fundação):

| Ritmo | Perfil | Salão Nv2 (h) | Salão Nv3 (h) | Salão Nv4 (h) | Celeiro (h) | Armazém (h) | Fim das obras (h) | Obras que começaram sozinhas | População mínima |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso | 29 | 54 | — | 33 | 31 | — | 13 | 7 |
| Rápido 3× | Regular | 11 | 22 | 36 | 25 | 26 | — | 29 | 7 |
| Rápido 3× | Dedicado | 11 | 19 | 25 | 14 | 19 | — | 44 | 7 |
| Normal 1× | Preguiçoso | 40 | 78 | 103 | 97 | 49 | — | 33 | 7 |
| Normal 1× | Regular | 27 | 47 | 62 | 39 | 37 | — | 46 | 7 |
| Normal 1× | Dedicado | 21 | 39 | 52 | 31 | 55 | 164 | 52 | 7 |
| Tranquilo 0,5× | Preguiçoso | 54 | 106 | 143 | — | 65 | — | 32 | 6 |
| Tranquilo 0,5× | Regular | 42 | 75 | 102 | 157 | 109 | 287 | 51 | 6 |
| Tranquilo 0,5× | Dedicado | 35 | 68 | 93 | 187 | 98 | 309 | 53 | 6 |

#### Rei de Ferro, tabela 1: 7 dias reais

| Ritmo | Perfil | Anos de jogo | População | Salão | Fome (h) | Frio (h) | Moral mínima | Moral baixa (h) | Foram embora | Fila ociosa (h) | Sem ofício (aldeão-h) | Excedente de madeira | Excedente de pedra | Excedente de ouro | Desperdício de comida | Desperdício de madeira | Desperdício de pedra | Desperdiçando (h) | Maior sequência desperdiçando (h de jogo) | Recusas | Faixa |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso (1/dia, preguicoso) | 3 | 33 | 7 | 0 | 0 | 50 | 0 | 0 | 91 | 672 | 3.120 | 3.120 | 4.610 | 15.307 | 28.129 | 13.048 | 134 | 72 | 0 | dentro |
| Rápido 3× | Regular (2/dia, economico) | 3 | 72 | 7 | 0 | 0 | 50 | 0 | 0 | 80 | 804 | 2.048 | 3.380 | 157.176 | 5.353 | 1.989 | 118 | 34 | 24 | 0 | dentro |
| Rápido 3× | Dedicado (4/dia, economico) | 3 | 74 | 7 | 0 | 0 | 50 | 0 | 0 | 19 | 414 | 2.499 | 3.573 | 280.419 | 109 | 4.722 | 38 | 8 | 12 | 0 | dentro |
| Normal 1× | Preguiçoso (1/dia, preguicoso) | 1 | 33 | 6 | 0 | 0 | 50 | 0 | 0 | 56 | 664 | 356 | 395 | 1.591 | 181 | 1.327 | 207 | 33 | 9 | 0 | dentro |
| Normal 1× | Regular (2/dia, economico) | 1 | 64 | 7 | 0 | 0 | 40 | 2 | 0 | 45 | 687 | 638 | 338 | 16.836 | 0 | 0 | 0 | 0 | 0 | 0 | dentro |
| Normal 1× | Dedicado (4/dia, economico) | 1 | 74 | 7 | 0 | 0 | 40 | 2 | 0 | 31 | 393 | 2.675 | 3.566 | 39.467 | 0 | 0 | 0 | 0 | 0 | 0 | dentro |
| Tranquilo 0,5× | Preguiçoso (1/dia, preguicoso) | 0,5 | 14 | 4 | 0 | 0 | 50 | 0 | 0 | 53 | 213 | 329 | 264 | 226 | 0 | 244 | 0 | 10 | 4,5 | 0 | dentro |
| Tranquilo 0,5× | Regular (2/dia, economico) | 0,5 | 54 | 6 | 0 | 0 | 40 | 4 | 0 | 47 | 534 | 512 | 519 | 465 | 0 | 0 | 0 | 0 | 0 | 0 | dentro |
| Tranquilo 0,5× | Dedicado (4/dia, economico) | 0,5 | 57 | 6 | 0 | 0 | 50 | 0 | 0 | 69 | 288 | 621 | 577 | 149 | 0 | 0 | 0 | 0 | 0 | 0 | dentro |

Progresso (horas reais desde a fundação):

| Ritmo | Perfil | Salão Nv2 (h) | Salão Nv3 (h) | Salão Nv4 (h) | Celeiro (h) | Armazém (h) | Fim das obras (h) | Obras que começaram sozinhas | População mínima |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso | 29 | 54 | 77 | 33 | 32 | — | 39 | 7 |
| Rápido 3× | Regular | 11 | 23 | 39 | 25 | 15 | 104 | 46 | 7 |
| Rápido 3× | Dedicado | 10 | 20 | 25 | 14 | 25 | 84 | 49 | 7 |
| Normal 1× | Preguiçoso | 40 | 78 | 103 | 73 | 49 | — | 35 | 7 |
| Normal 1× | Regular | 27 | 46 | 64 | 33 | 49 | — | 42 | 7 |
| Normal 1× | Dedicado | 21 | 41 | 54 | 29 | 38 | 124 | 51 | 7 |
| Tranquilo 0,5× | Preguiçoso | 54 | 106 | 144 | — | 65 | — | 21 | 6 |
| Tranquilo 0,5× | Regular | 42 | 78 | 105 | 62 | 85 | — | 35 | 6 |
| Tranquilo 0,5× | Dedicado | 35 | 68 | 95 | 151 | 74 | — | 37 | 6 |

#### Rei de Ferro, tabela 2: um ano de jogo

| Ritmo | Perfil | Horas reais | População | Salão | Fome (h) | Frio (h) | Moral mínima | Moral baixa (h) | Foram embora | Fila ociosa (h) | Sem ofício (aldeão-h) | Excedente de madeira | Excedente de pedra | Excedente de ouro | Desperdício de comida | Desperdício de madeira | Desperdício de pedra | Desperdiçando (h) | Maior sequência desperdiçando (h de jogo) | Recusas | Faixa |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso (1/dia, preguicoso) | 56 | 13 | 3 | 0 | 0 | 50 | 0 | 0 | 17 | 176 | 333 | 496 | 160 | 179 | 5.143 | 0 | 36 | 72 | 0 | dentro |
| Rápido 3× | Regular (2/dia, economico) | 56 | 27 | 5 | 0 | 0 | 50 | 0 | 0 | 8 | 244 | 133 | 636 | 1.053 | 2.358 | 0 | 0 | 21 | 24 | 0 | dentro |
| Rápido 3× | Dedicado (4/dia, economico) | 56 | 51 | 6 | 0 | 0 | 50 | 0 | 0 | 11 | 256 | 474 | 80 | 11.142 | 109 | 2.074 | 38 | 6 | 12 | 0 | dentro |
| Normal 1× | Preguiçoso (1/dia, preguicoso) | 168 | 33 | 6 | 0 | 0 | 50 | 0 | 0 | 56 | 664 | 356 | 395 | 1.591 | 181 | 1.327 | 207 | 33 | 9 | 0 | dentro |
| Normal 1× | Regular (2/dia, economico) | 168 | 64 | 7 | 0 | 0 | 40 | 2 | 0 | 45 | 687 | 638 | 338 | 16.836 | 0 | 0 | 0 | 0 | 0 | 0 | dentro |
| Normal 1× | Dedicado (4/dia, economico) | 168 | 74 | 7 | 0 | 0 | 40 | 2 | 0 | 31 | 393 | 2.675 | 3.566 | 39.467 | 0 | 0 | 0 | 0 | 0 | 0 | dentro |
| Tranquilo 0,5× | Preguiçoso (1/dia, preguicoso) | 336 | 23 | 6 | 0 | 0 | 50 | 0 | 0 | 188 | 426 | 880 | 775 | 957 | 0 | 1.054 | 0 | 23 | 5 | 0 | dentro |
| Tranquilo 0,5× | Regular (2/dia, economico) | 336 | 74 | 7 | 0 | 0 | 40 | 4 | 0 | 198 | 746 | 2.592 | 3.269 | 42.720 | 0 | 0 | 0 | 0 | 0 | 0 | dentro |
| Tranquilo 0,5× | Dedicado (4/dia, economico) | 336 | 74 | 7 | 0 | 0 | 50 | 0 | 0 | 214 | 371 | 113 | 2.157 | 49.131 | 0 | 0 | 0 | 0 | 0 | 0 | dentro |

Progresso (horas reais desde a fundação):

| Ritmo | Perfil | Salão Nv2 (h) | Salão Nv3 (h) | Salão Nv4 (h) | Celeiro (h) | Armazém (h) | Fim das obras (h) | Obras que começaram sozinhas | População mínima |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso | 29 | 54 | — | 33 | 32 | — | 14 | 7 |
| Rápido 3× | Regular | 11 | 23 | 39 | 25 | 15 | — | 31 | 7 |
| Rápido 3× | Dedicado | 10 | 20 | 25 | 14 | 25 | — | 39 | 7 |
| Normal 1× | Preguiçoso | 40 | 78 | 103 | 73 | 49 | — | 35 | 7 |
| Normal 1× | Regular | 27 | 46 | 64 | 33 | 49 | — | 42 | 7 |
| Normal 1× | Dedicado | 21 | 41 | 54 | 29 | 38 | 124 | 51 | 7 |
| Tranquilo 0,5× | Preguiçoso | 54 | 106 | 144 | — | 65 | — | 34 | 6 |
| Tranquilo 0,5× | Regular | 42 | 78 | 105 | 62 | 85 | 302 | 46 | 6 |
| Tranquilo 0,5× | Dedicado | 35 | 68 | 95 | 151 | 74 | 328 | 46 | 6 |

As faixas e o desperdício por recurso das outras duas dificuldades saem do mesmo comando; as linhas de base estão em `MEASURED`.

**O que as tabelas dizem.**

- **As obras acabam dentro da primeira semana em quase todo perfil que joga duas vezes por dia ou mais.** Em Senhor, no ritmo Rápido, o Regular fica sem nada a construir na hora real 113 (o quinto dia) e o Dedicado, na 75 (o quarto). No ritmo Normal o Dedicado acaba na hora 134; o Regular termina a semana com o Salão no nível 7 e uma obra só por fazer, o Armazém do nível 8, que não destrava nada (seção 9.5). No Tranquilo, o Regular acaba no 11º dia (hora 249) e o Dedicado, no 13º. Daí em diante o jogo não pede nada: a fila ociosa e o ouro parado são essa espera.
- **A dificuldade muda pouco o caminho e muda o teto.** Camponês chega ao Salão 8 e a 84 aldeões (Dedicado); Senhor e Rei de Ferro param no Salão 7 e em 74. As horas do Salão 2, 3 e 4 diferem em poucas horas entre as três.
- **O Preguiçoso (1 visita por dia) continua perdendo muito no ritmo Rápido**: 46% da madeira e 51% da comida que produz, com sequências de 63 a 75 h de jogo. É o bot que não tira ninguém do lugar, no ritmo em que um dia real são 36 dias de jogo. A meta do GDD não fala dele.
- **Em Camponês o Regular do ritmo Rápido ainda perde 27% da madeira** (13.832 de uma vez entre as horas 87 e 96). Na visita da hora 84 o Salão 8 pede 5.102 de madeira, o Armazém guarda 4.125, e os cinco edifícios do nível 9 esperam o Salão; o bot inicia o Armazém, as duas filas ficam ocupadas, a lista passa a dizer "os pedreiros estão ocupados" para tudo, e ele põe 18 lenhadores para juntar a madeira de obras que não vão começar nas 12 horas seguintes. É o limite de leitura do bot descrito na seção 9.2, não a regra do jogo.

### 9.4 A meta de desperdício (GDD §15.2; ADR 0013, decisão 17)

"Nenhum recurso desperdiçando no cap por mais de 8 h de jogo contínuas para o perfil Regular." O título da §15.2 diz para quem as metas valem: ritmo Normal, dificuldade Senhor.

| Janela | Ritmo | Perfil | Comida (h de jogo) | Madeira (h de jogo) | Pedra (h de jogo) | Meta | Veredito |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 7 dias reais | Rápido 3× | Regular | 18 | 9 | 12 | ≤ 8 | **acima** |
| 7 dias reais | Normal 1× | Regular | 0 | 1 | 0 | ≤ 8 | dentro |
| 7 dias reais | Tranquilo 0,5× | Regular | 0 | 0,5 | 0 | ≤ 8 | dentro |
| Um ano de jogo | Rápido 3× | Regular | 18 | 0 | 0 | ≤ 8 | **acima** |
| Um ano de jogo | Normal 1× | Regular | 0 | 1 | 0 | ≤ 8 | dentro |
| Um ano de jogo | Tranquilo 0,5× | Regular | 2 | 0,5 | 0 | ≤ 8 | dentro |

| Dificuldade | Ritmo Normal | Ritmo Tranquilo | Ritmo Rápido (7 dias reais: comida, madeira, pedra) |
|---|---|---|---|
| Camponês | dentro (0, 0, 0) | dentro | **acima**: 12, 30, 21 |
| Senhor | dentro (0, 1, 0) | dentro (até 2) | **acima**: 18, 9, 12 |
| Rei de Ferro | dentro (0, 0, 0) | dentro | **acima**: 24, 9, 3 |

- **No ritmo Normal, em Senhor, que é a célula que o GDD nomeia, a meta é cumprida**: nenhuma comida ao chão, a madeira por 1 h de jogo, nenhuma pedra. Era 9 h de madeira. O mesmo vale em Camponês e em Rei de Ferro.
- **No ritmo Tranquilo é cumprida**, nas duas janelas e nas três dificuldades (o máximo é 2 h de jogo de comida, no ano de Senhor).
- **No ritmo Rápido não é cumprida**, em nenhuma dificuldade. Em Senhor o desvio caiu de 165 h de jogo para 18, e deixou de ser "o feudo acabou": é a comida que enche a despensa entre duas visitas.

**Os extremos do ritmo Rápido, em Senhor** (iguais nas 50 sementes; horas reais desde a fundação, visitas a cada 12 h):

| Recurso | Quando | Sequência | Foi ao chão | Onde estava o feudo |
|---|---|---|---|---|
| Comida | horas 19 a 24 | 18 h de jogo | 309 | Verão do ano 1, Despensa de 500 (sem Celeiro ainda), 12 aldeões |
| Comida | horas 31 a 36 | 18 h de jogo | 736 | Verão do ano 1, Celeiro Nv1 (900), 17 aldeões |
| Pedra | horas 153 a 156 | 12 h de jogo | 391 | Outono do ano 3, Armazém Nv8 (5.100), obras já acabadas |
| Madeira | horas 154 a 156 | 9 h de jogo | 381 | idem |
| Comida | horas 118 a 120 | 9 h de jogo | 292 | Primavera do ano 3, Celeiro Nv4, 52 aldeões |

Todas terminam em uma visita: o depósito enche nas últimas horas da ausência e o bot chega e arruma. **Por que acontece:**

1. **No ritmo Rápido, 8 h de jogo são 2 h 40 reais, e a ausência do Regular são 12 h reais (36 h de jogo, 18 dias de jogo).** Para cumprir a meta, quem sai precisa deixar todo depósito a mais de 9 h 20 de encher, com as taxas que **vão valer** nessas 12 horas. O bot faz a conta com as taxas que vê ao sair. Nas primeiras 36 horas reais elas mudam depressa depois que ele sai: a Fazenda sobe de nível sozinha (as planejadas automáticas), a experiência do ofício cresce a cada virada de dia, os recrutas chegam. Com a Despensa de 500 e o Celeiro de 900, uma hora real de diferença na conta já são 60 a 120 de comida.
2. **A medida arredonda para cima**: cada hora real com ao menos uma unidade perdida conta inteira, e no ritmo Rápido uma hora real são 3 h de jogo. Uma sequência medida de 9 h pode ser de pouco mais de 3 h de fato (seção 8.1). As de 18 h não cabem nessa margem.
3. **O aviso do jogo olha 8 horas reais**: "Antes de partir" e a barra de status avisam do depósito que enche em menos de 8 h. Quem volta em 12 h pode sair com o painel limpo e encontrar comida no chão.

**Em Senhor, não é mais um problema de bot.** Ele já prepara as 12 horas inteiras, com a previsão de estação que a visão dá; o que sobra é o que o painel não tem como prever. (Em Camponês uma parte ainda é dele: as 30 h de madeira da seção 9.3.) E não é um problema que um número pequeno do conteúdo resolva sem mudar outra coisa: é a relação entre a meta, escrita em horas de jogo, e um ritmo em que a ausência normal vale 36 delas. As saídas, nenhuma aplicada, estão na seção 9.8.

### 9.5 Caminho de compras e níveis anunciados que ninguém alcança (V2C-T7.3)

**Há caminho até os desbloqueios da fase em toda dificuldade.** O Celeiro e o Armazém (Salão no nível 2) e a segunda fila de obras (Salão no nível 4) são alcançados pelo perfil Regular em todo ritmo, dentro de um ano de jogo, só com ordens que o motor aceita (zero recusas). Horas reais, perfil Regular:

| Dificuldade | Ritmo | Salão Nv2 | Salão Nv3 | Salão Nv4 (segunda fila) | Celeiro | Armazém |
|---|---|---|---|---|---|---|
| Camponês | Rápido 3× | 11 | 22 | 36 | 25 | 26 |
| Camponês | Normal 1× | 27 | 47 | 62 | 39 | 37 |
| Camponês | Tranquilo 0,5× | 42 | 75 | 102 | 157 | 109 |
| Senhor | Rápido 3× | 11 | 22 | 36 | 25 | 26 |
| Senhor | Normal 1× | 27 | 47 | 64 | 33 | 61 |
| Senhor | Tranquilo 0,5× | 42 | 75 | 104 | 85 | 87 |
| Rei de Ferro | Rápido 3× | 11 | 23 | 39 | 25 | 15 |
| Rei de Ferro | Normal 1× | 27 | 46 | 64 | 33 | 49 |
| Rei de Ferro | Tranquilo 0,5× | 42 | 78 | 105 | 62 | 85 |

Em Rei de Ferro o Armazém vem antes (hora 15 no ritmo Rápido): o Salão 3 → 4 pede 486 de madeira e o Pátio guarda 400, e a recusa diz o que fazer (seção 4.1). `balance.test.ts` cobra esse caminho em cada dificuldade.

**O teto de cada edifício.** Um teste novo do motor (`storage.test.ts`, "o teto de cada edifício em cada dificuldade") parte do feudo novo, com os depósitos sempre cheios e ouro de sobra, e inicia toda obra que o próprio `upgradeQuote` deixa começar. É o caminho mais favorável que existe:

| Edifício | Nível máximo do catálogo (GDD §6.1) | Camponês | Senhor | Rei de Ferro |
|---|---:|---:|---:|---:|
| Salão do Senhor | 8 | 8 | **7** | **7** |
| Fazenda, Serraria, Pedreira, Mina de Ouro, Habitações | 10 | **9** | **8** | **8** |
| Celeiro, Armazém | 8 | 8 | 8 | **7** |

**Anunciado e inalcançável**, por causa:

| O quê | Onde | Por quê |
|---|---|---|
| Nível 10 da Fazenda, da Serraria, da Pedreira, da Mina e das Habitações | nas três dificuldades | A regra "nunca passa do nível do Salão mais um" e o Salão com máximo 8 dão 9. O nível 10 do catálogo não existe para ninguém |
| Salão no nível 8 | Senhor | A obra pede 5.102 de madeira e o Armazém no nível máximo guarda 5.100. **Faltam 2 unidades** |
| Nível 9 dos mesmos cinco edifícios | Senhor e Rei de Ferro | Presos ao Salão, que para no 7 |
| Salão no nível 8 | Rei de Ferro | Pede 5.102; o Armazém alcançável (nível 7) guarda 3.600 |
| Celeiro e Armazém no nível 8 | Rei de Ferro | A obra pede 4.295 de madeira e o Armazém no nível 7 guarda 3.600 |

Nenhum desses níveis é desbloqueio da Fase C, e nenhum número foi mexido. Mas não é mais "fim de jogo distante", como a seção 4.1 dizia: **o Regular chega a esse teto no quinto dia do ritmo recomendado**.

**A armadilha das 2 unidades.** Em Senhor, com o Armazém no nível 7 (4.500), a obra do Salão diz: "A obra pede 5.102 de madeira e o Armazém só guarda 4.500: amplie o Armazém primeiro". O jogador (e o bot) obedece, paga 4.295 de madeira e 2.147 de pedra pelo nível 8, e a frase passa a ser: "…só guarda 5.100: não há como juntar tanto". O jogo manda fazer uma obra cara que não resolve.

**Uma frase corrigida no motor.** Com as obras esgotadas e o Armazém cheio, o painel dizia "Armazém cheio: … de madeira indo ao chão. Gaste madeira.", e nenhum botão gasta madeira nesse ponto. É o mesmo defeito que a revisão da fase corrigiu para a comida. Agora, quando nenhuma obra que leve o material ainda pode vir a começar (`upgradeStillPossible`, em `packages/engine/src/construction.ts`), a frase diz o que resta fazer: "Ponha parte dos lenhadores em outro ofício." E não manda ampliar um depósito que não tem como crescer (o Armazém de Rei de Ferro no nível 7). Nenhuma regra mudou; o golden não mudou (nenhum cenário dele chega a esse ponto); o GDD §5.5 ganhou a frase.

### 9.6 O que mudou em relação à linha de base da v0.1

A régua é a seção 2: o jogo da v0.1, sem nenhuma mecânica, com o bot daquela época. Perfil Regular, 7 dias reais, Senhor:

| Ritmo | População | Salão | Madeira parada | Madeira no chão | Pedra parada | Ouro parado | Fila ociosa (h) |
|---|---|---|---|---|---|---|---|
| Rápido 3× | 35 → 72 | 3 → 7 | 40.872 → 4.236 | (sem limite) → 1.181 | 16.118 → 5.100 | 6.626 → 156.690 | 168 → 110 |
| Normal 1× | 26 → 69 | 3 → 7 | 10.017 → 3.741 | (sem limite) → 49 | 4.190 → 3.663 | 1.637 → 8.708 | 168 → 53 |
| Tranquilo 0,5× | 12 → 54 | 3 → 6 | 1.609 → 589 | (sem limite) → 6 | 710 → 1.726 | 409 → 1.156 | 168 → 46 |

- **O excedente parado de madeira caiu em todo ritmo**, que era o sinal que a v0.1 deixou ("10.000 de madeira parada no 1×, 40.872 no 3×"): de 40.872 para 4.236 no ritmo Rápido e de 10.017 para 3.741 no Normal. Somando o que foi ao chão, a madeira sem uso continua muito menor (5.417 contra 40.872). `balance.test.ts` cobra as duas contas.
- **O feudo é outro**: o dobro de gente no ritmo Rápido, quase o triplo no Normal, e o Salão no nível 7 onde era 3. As obras começam sozinhas (46 a 47 por semana no Regular dos ritmos Rápido e Normal) e a fila deixou de passar a semana inteira parada com obra possível.
- **A pedra parada caiu nos ritmos Rápido e Normal e subiu no Tranquilo** (710 → 1.726), sempre dentro do que o Armazém guarda: lá o feudo cresceu quatro vezes e ainda está construindo.
- **O ouro parado subiu muito, e é o sinal que ficou.** O ouro não tem limite; quando nada pede madeira nem pedra, é para a Mina que os braços vão. 156 mil em uma semana no ritmo Rápido é o jogo dizendo que não tem em que gastar. As cartas do Conselho (Fase D), a Torre e a Paliçada (Fase E) são os gastos previstos; nenhum deles é grande perto disso.

### 9.7 Desempenho (V2C-T7.4)

A pergunta de `docs/perf-v0.1.md` que ficou sem resposta: quanto custa um `advanceTo` depois de dias sem acesso? No ritmo 3 são 36 viradas de dia de jogo por dia real, cada uma com experiência do ofício, moral, sorteios e fecho do desperdício.

```bash
pnpm -s sim -- --perf
```

Motor 0.1.0 · estado v7 · conteúdo 3acde0478685be9d · ritmo 3× · Node v24.19.0 · darwin arm64 (Apple M5) · 9 repetições por medida, depois de duas de aquecimento. Um `advanceTo` só, do instante da saída ao da volta, e um `deriveViewState` no estado da volta; tempo de processo, sem banco nem rede.

| Feudo | Ausência (dias reais) | Viradas de dia de jogo | `advanceTo` (ms, mediana) | `advanceTo` (ms, pior) | `deriveViewState` (ms, mediana) | Eventos emitidos | Estado (bytes) | Visão (bytes) | Habitantes na volta |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Feudo novo, sem nenhuma ordem | 1 | 36 | 0,3 | 3,5 | 0,1 | 42 | 1.145 | 10.440 | 3 |
| Feudo novo, sem nenhuma ordem | 7 | 252 | 0,8 | 1,2 | 0,1 | 272 | 1.155 | 10.698 | 3 |
| Feudo novo, sem nenhuma ordem | 30 | 1.080 | 3,1 | 3,4 | 0,1 | 1.167 | 1.170 | 11.783 | 3 |
| Feudo de 2 dias reais (bot econômico, 2 visitas por dia) | 1 | 36 | 0,2 | 0,3 | 0,1 | 74 | 1.502 | 10.629 | 22 |
| Feudo de 2 dias reais (bot econômico, 2 visitas por dia) | 7 | 252 | 1,2 | 1,3 | 0,1 | 520 | 1.509 | 11.201 | 22 |
| Feudo de 2 dias reais (bot econômico, 2 visitas por dia) | 30 | 1.080 | 5,2 | 6,6 | 0,1 | 2.235 | 1.512 | 11.048 | 22 |
| Feudo de 7 dias reais (bot econômico, 2 visitas por dia) | 1 | 36 | 0,2 | 0,2 | 0,1 | 62 | 1.843 | 13.198 | 72 |
| Feudo de 7 dias reais (bot econômico, 2 visitas por dia) | 7 | 252 | 1,3 | 1,8 | 0,1 | 462 | 1.845 | 13.196 | 72 |
| Feudo de 7 dias reais (bot econômico, 2 visitas por dia) | 30 | 1.080 | 5,6 | 6,3 | 0,1 | 2.020 | 1.851 | 14.741 | 72 |

**O servidor, no pior caso.** Em produção o job `advance-stale-games` avança a partida a cada hora, e a volta encontra pouco por fazer. O pior caso é o servidor que ficou parado: a primeira leitura atravessa a ausência inteira em uma transação e grava todos os eventos dela. Um teste de integração novo mede isso (`packages/server/test/long-absence.test.ts`: API em memória, PostgreSQL 16 em Docker na mesma máquina, ritmo 3, um feudo com cinco aldeões trabalhando e três obras planejadas). Três rodadas:

| Ausência | `GET /view` da volta | Eventos gravados | Corpo da resposta | `GET /events` até o fim (páginas de 500) |
|---|---|---|---|---|
| 1 dia real | 6,5 a 9,0 ms | 80 | 10.417 bytes | 1 página, 3,5 a 3,7 ms |
| 7 dias reais | 17,9 a 18,2 ms | 527 | 10.557 bytes | 2 páginas, 6,2 a 7,7 ms |
| 29 dias reais | 50,5 a 55,0 ms | 2.157 | 10.499 bytes | 5 páginas, 16,7 a 17,9 ms |

29 dias é a ausência mais longa que volta sem novo login: a sessão vale 30. O teste cobra só um teto folgado (5 s) e que a ausência inteira caiba em um incremento de `stateVersion`.

**Comparação com a v0.1** (`docs/perf-v0.1.md`, medida em outra máquina, um Intel Core i7-12700T: os tempos não se comparam número a número; os tamanhos, sim):

| | v0.1 | Hoje |
|---|---|---|
| `advanceTo` de uma ausência longa | não medido | 0,2 ms (1 dia), 1,3 ms (7 dias), 5,6 ms (30 dias) no feudo de 72 aldeões |
| `GET /view`, leitura comum | p50 4,7 ms, p95 7,8 ms (50 bots, Intel) | não medido de novo nesta tarefa |
| `GET /view` na volta de 29 dias, de uma vez | não medido | 50 a 55 ms (M5), quase tudo gravação de 2.157 eventos |
| Estado (`games.state`), JSON | 756 bytes no feudo novo, cerca de 1.040 depois de uma semana (retratos `state-v1-*.json`) | 1.063 no feudo novo (`state-v7-fresh.json`), 1.500 a 1.850 nos feudos de bot |
| `ViewState`, JSON | 4.604 a 5.028 bytes (golden da tag `v0.1.0`) | 9.801 a 12.788 no golden de hoje; 13.198 a 14.741 no feudo de 72 aldeões |

- **O motor não é o gargalo.** Trinta dias reais no ritmo 3 (1.080 viradas de dia) custam menos de 6 ms. A meta local de `/view` (p95 abaixo de 50 ms) tem folga de uma ordem de grandeza para o avanço.
- **O que cresce com a ausência são os eventos**: de 40 a 75 por dia real no ritmo 3 (74 no feudo do meio do jogo), 2 mil em um mês. No pior caso eles entram em uma transação só, e é isso que leva a leitura da volta a 50 ms. O app os busca em páginas de 100 (o padrão de `GET /events`): 22 chamadas para um mês, dentro do limite de 60 requisições por minuto da sessão, mas não de graça.
- **A visão dobrou de tamanho, e o recibo de cada ordem guarda uma.** A v0.1 mediu 3,4 kB por linha de `commands`, quase tudo o `ViewState` do corpo da resposta, e projetou 37 MB por ano para quem dá 30 ordens por dia. Com a visão de 2 a 3 vezes maior, a mesma conta dá de 75 a 110 MB por jogador por ano. **O volume real da tabela não foi medido de novo**: é a conta da v0.1 escalada pelo tamanho do JSON, e o PostgreSQL comprime o que guarda. Continua sendo "o primeiro lugar a olhar se o banco crescer" (ADR 0004).

### 9.8 O que fica para o autor

Nenhum destes ajustes foi aplicado. São as perguntas que a rodada levanta, com o número mais simples que as responderia.

1. **Em Senhor, o Salão no nível 8 falta por 2 de madeira (5.102 contra 5.100), e com ele os níveis 9.** O ajuste mais simples: a capacidade do Celeiro e do Armazém no nível 1 passa de 900 para 1.000. O Armazém no nível 8 passa a guardar 5.200 em Senhor, o Salão 8 cabe, e Senhor ganha o mesmo teto de Camponês (Salão 8, os outros no 9). Muda o GDD §5.5, a decisão 17 do ADR 0013, o golden e a linha de base. Não foi simulado. Em Rei de Ferro não basta (o Armazém continuaria parando no nível 7); é para decidir se o teto mais baixo ali é intenção.
2. **O nível 10 da Fazenda, da Serraria, da Pedreira, da Mina e das Habitações não é alcançável em nenhuma dificuldade**: Salão 8 mais um dá 9. Ou o catálogo passa a dizer "Nv máx 9" para esses cinco, ou o Salão vai a 9. A primeira saída não muda o jogo de ninguém.
3. **A armadilha do Armazém 8 em Senhor** (seção 9.5) some com o ajuste 1. Sem ele, a frase da recusa do Salão deveria dizer "não há como juntar tanto" já com o Armazém no nível 7, em vez de mandar ampliá-lo.
4. **A meta de 8 h no ritmo Rápido.** Em horas de jogo ela pede a quem joga duas vezes por dia que nada encha nas primeiras 9 h 20 da ausência, e nem o bot que prepara as 12 horas consegue (18 h de jogo de comida, que são 6 h reais). Três saídas: (a) ler a meta em **horas reais** nos ritmos que não são o Normal (8 h reais são 24 h de jogo no Rápido): em Senhor todas as células do Regular ficam dentro, sem mexer em número nenhum; (b) dizer que a meta vale só no ritmo Normal, como o título da §15.2 já diz; (c) mexer no jogo: Despensa e Pátio maiores no começo (os 500 iniciais são o que transborda nas primeiras 36 horas), ou o aviso "Antes de partir" olhando 12 h em vez de 8. A recomendação é a (a), que é a mesma leitura que o jogo já faz dos prazos do jogador (o aviso de "cheio em" é em horas reais).
5. **As obras acabam no quinto dia do ritmo recomendado** (hora 113 para o Regular, 75 para o Dedicado, em Senhor), e o ouro se empilha sem uso. É a observação da seção 5.4, agora com data. As Fases D e E acrescentam dois edifícios, cada um até o nível 2 (a Torre de Vigia e a Paliçada), e as cartas; não mudam a ordem de grandeza. O que resolveria é do autor: custos que cresçam mais, o teto do Salão, ou um destino para o ouro.
6. **A fila de recrutamento (5 aldeões) limita o crescimento no ritmo Rápido a 10 por dia real para quem joga duas vezes por dia.** O Regular passa dias com 30 a 38 vagas nas Habitações e comida de sobra, sem poder chamar mais gente: no quarto dia tem 37 aldeões em 75 vagas. Não é defeito, mas é o que mais segura o perfil no ritmo recomendado.
7. **As metas de população e de Salão do GDD §15.2** ("população 30–40 no dia 7") estão superadas desde a seção 5: o Regular do ritmo Normal chega a 69 aldeões e ao Salão 7. Ou a meta sobe, ou os custos.

### 9.9 Faixas

`MEASURED` traz a linha de base desta rodada para as três dificuldades, pela regra da seção 2.3 (10% na população, 5% nos tetos). O que mudou em relação à seção 8, em Senhor: a população do Regular no ritmo Normal (66 → 69) e do Dedicado no Tranquilo (61 → 62); o Salão mínimo do Dedicado no ano do ritmo Rápido (7 → 6); o teto de ouro parado, que sobe em toda célula do bot econômico (o do Regular no ritmo Rápido vai de 39.510 para 164.525); e o teto da sequência desperdiçando, que **cai** em toda célula do econômico (174 → 19 no Regular do ritmo Rápido, 10 → 2 no Normal). A guarda ficou mais apertada onde importa.

`balance.test.ts` joga a matriz de Senhor com as 50 sementes e as de Camponês e Rei de Ferro com as 3 primeiras (as sementes ainda dão a mesma partida, e as 50 das três triplicariam o tempo da suíte; as 50 rodam pelo comando). Ele guarda a meta de desperdício célula a célula: as quatro que entraram não podem sair caladas, e as duas do ritmo Rápido não podem piorar caladas. Cobra também o caminho de compras de cada dificuldade e a queda da madeira parada em relação à v0.1.

A fila ociosa, os aldeões sem ofício, a parte da produção perdida, o fim das obras e as horas dos marcos são medidos e relatados, sem faixa.

### 9.10 Limites desta medição

- **A medida é de um bot.** Ele faz a conta da ausência com as taxas do painel, a cada visita, sem errar e sem esquecer. Um jogador de verdade perde mais do que ele e menos do que o bot das seções 4 a 8. O playtest (V2A-T1) é que diz onde as pessoas ficam.
- **O "fim das obras" depende do que o bot considera obra.** O Celeiro e o Armazém além do que alguma obra pede não contam; um jogador que queira o depósito no nível máximo tem mais uma ou duas obras pela frente, e nenhuma destrava nada.
- **A parte da produção perdida é uma aproximação** (seção 9.1), e o desperdício inclui o corte de ganhos discretos (recompensas, devoluções), que não é produção.
- **A sequência desperdiçando tem a resolução da seção 8.1**: uma hora real por amostra, arredondada para cima nas pontas.
- **As trocas de ofício foram contadas com uma semente** e com um contador de fora do simulador (as chegadas a cada edifício em cada visita, menos quem estava sem ofício); as variantes que não entraram (seção 9.2) não estão no código.
- **O desempenho foi medido em uma máquina só, um Apple M5**, e o servidor, com a API em memória e o banco na mesma máquina, sem rede. O teste de carga da v0.1 (`--remote`, 50 bots) **não foi repetido**: o p50 e o p95 de `/view` e de `/commands` com a visão de hoje não foram medidos. O volume da tabela `commands` também não.
- **Nenhum ajuste da seção 9.8 foi simulado.** As contas dos tetos são de papel (custo contra capacidade); o efeito na matriz só se sabe rodando.
- **As 50 sementes continuam dando o mesmo resultado** nas três dificuldades.
- As faixas continuam sendo o jogo de hoje, com folga, e não metas (seção 2.5).

## 10. O Conselho do Feudo (V2D-T1)

Tarefa V2D-T1: o motor do Conselho (sorteio, expiração, continuações, efeitos e a resposta do jogador) e as cinco primeiras cartas: a cadeia "O Celeiro Comum" e duas avulsas. É a primeira mecânica que os bots alcançam e que **sorteia**: a carta de cada audiência depende da semente, e as 50 sementes da matriz deixaram de dar a mesma partida. A linha de base de `packages/sim-cli/src/bands.ts` foi regravada de propósito, nas três dificuldades, com o que esta rodada mediu.

| | |
|---|---|
| Data | 2026-10-02 |
| Commit | o desta tarefa (`git log --grep "V2D-T1"`), feito sobre `b2667de` |
| Identificação | Motor 0.1.0 · estado v8 · conteúdo eaeb187eb982c4b4 |
| Dificuldades | Camponês (`peasant`), Senhor (`lord`) e Rei de Ferro (`ironKing`) |
| Sementes | 50 fixas: `pedra-alta-001` a `pedra-alta-050` |
| Ritmos | Rápido 3×, Normal 1× e Tranquilo 0,5× |
| Máquina | Apple M5, macOS 26.6.2, Node 24.19.0 |

### 10.1 O que entrou no jogo e no bot

- **Cartas.** Um sorteio a cada 4 dias de jogo, no máximo 2 na mesa, 24 h reais para responder. O catálogo tem três cartas sorteáveis: "O poço entulhado" e "A refeição dos pedreiros" (sem requisito) e "Tábuas para as reservas" (com o Celeiro erguido), cada uma no máximo uma vez por ano de jogo. As outras duas só chegam como continuação da cadeia.
- **Política `responder a carta`**, a primeira das listas dos dois bots: a opção mais barata que o feudo alcança e pode pagar; no empate, a primeira da carta. Como toda carta tem uma opção sem custo, o bot nunca gasta com o Conselho e **nenhuma carta expira** em partida nenhuma. Na prática ele manda o povo cavar o poço (−5 de moral por 1 dia de jogo), reparte o pão com os pedreiros (sem efeito) e conserva as reservas (a cadeia nunca começa).
- **O simulador mede o Conselho**: as colunas `cards_seen`, `cards_answered` e `cards_expired` dos dois CSVs e a linha "Conselho:" do resumo de uma partida.

### 10.2 Comando e saída

```bash
pnpm -s sim -- --matrix > matriz-senhor.csv 2> matriz-senhor.md
pnpm -s sim -- --matrix --difficulty peasant > matriz-campones.csv 2> matriz-campones.md
pnpm -s sim -- --matrix --difficulty ironKing > matriz-rei-de-ferro.csv 2> matriz-rei-de-ferro.md
```

900 linhas no CSV em cada dificuldade; cada rodada leva cerca de 25 s (eram 23). Com a linha de base nova as três saem com código 0: todas as partidas dentro das faixas da própria dificuldade, nenhuma ordem recusada. Nenhuma partida passa fome nem frio, e nenhuma perde um aldeão. Abaixo, de cada dificuldade, a tabela principal de cada janela, a meta de desperdício e a linha de base; as tabelas de progresso e de desperdício por recurso saem do mesmo comando.

#### Senhor: 7 dias reais

| Ritmo | Perfil | Anos de jogo | População | Salão | Fome (h) | Frio (h) | Moral mínima | Moral baixa (h) | Foram embora | Fila ociosa (h) | Sem ofício (aldeão-h) | Excedente de madeira | Excedente de pedra | Excedente de ouro | Desperdício de comida | Desperdício de madeira | Desperdício de pedra | Desperdiçando (h) | Maior sequência desperdiçando (h de jogo) | Recusas | Faixa |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso (1/dia, preguicoso) | 3 | 33 | 7 | 0 | 0 | 50 | 0 | 0 | 102 a 103 | 672 | 3.900 | 3.900 | 4.657 | 14.669 a 14.672 | 27.594 a 27.601 | 12.418 a 12.421 | 131 | 75 | 0 | dentro |
| Rápido 3× | Regular (2/dia, economico) | 3 | 72 | 7 | 0 | 0 | 45 | 1 | 0 | 110 | 804 | 4.236 | 5.100 | 156.651 a 156.656 | 1.489 | 1.159 a 1.166 | 378 a 384 | 20 | 18 | 0 | dentro |
| Rápido 3× | Dedicado (4/dia, economico) | 3 | 74 | 7 | 0 | 0 | 45 | 1 | 0 | 45 | 414 | 4.212 | 5.026 a 5.027 | 276.898 a 276.913 | 0 | 171 a 194 | 20 | 1 | 3 | 0 | dentro |
| Normal 1× | Preguiçoso (1/dia, preguicoso) | 1 | 33 | 6 | 0 | 0 | 45 | 2 | 0 | 61 | 664 | 692 | 711 | 1.637 | 0 | 1.138 | 0 | 22 | 6 | 0 | dentro |
| Normal 1× | Regular (2/dia, economico) | 1 | 69 | 7 | 0 | 0 | 35 a 40 | 2 a 4 | 0 | 53 a 54 | 745 | 3.737 a 3.739 | 3.661 a 3.662 | 8.707 | 0 | 46 a 50 | 0 | 0 | 1 | 0 | dentro |
| Normal 1× | Dedicado (4/dia, economico) | 1 | 74 | 7 | 0 | 0 | 35 a 40 | 2 a 4 | 0 | 91 | 393 | 4.178 a 4.180 | 5.013 a 5.014 | 33.588 | 0 | 76 | 0 | 0 | 1 | 0 | dentro |
| Tranquilo 0,5× | Preguiçoso (1/dia, preguicoso) | 0,5 | 14 | 4 | 0 | 0 | 45 | 4 | 0 | 54 a 55 | 212 | 67 a 68 | 187 | 230 | 0 | 143 a 144 | 0 | 6 a 7 | 3,5 | 0 | dentro |
| Tranquilo 0,5× | Regular (2/dia, economico) | 0,5 | 54 | 6 | 0 | 0 | 35 a 40 | 4 a 8 | 0 | 46 a 47 | 534 | 587 a 588 | 1.725 | 1.155 a 1.156 | 0 | 4 | 0 | 0 | 0,5 | 0 | dentro |
| Tranquilo 0,5× | Dedicado (4/dia, economico) | 0,5 | 62 | 6 | 0 | 0 | 45 | 4 | 0 | 75 a 76 | 313 | 236 a 237 | 49 a 50 | 153 | 0 | 0 | 0 | 0 | 0 | 0 | dentro |

#### Senhor: um ano de jogo

| Ritmo | Perfil | Horas reais | População | Salão | Fome (h) | Frio (h) | Moral mínima | Moral baixa (h) | Foram embora | Fila ociosa (h) | Sem ofício (aldeão-h) | Excedente de madeira | Excedente de pedra | Excedente de ouro | Desperdício de comida | Desperdício de madeira | Desperdício de pedra | Desperdiçando (h) | Maior sequência desperdiçando (h de jogo) | Recusas | Faixa |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso (1/dia, preguicoso) | 56 | 13 | 3 | 0 | 0 | 50 | 0 | 0 | 21 | 176 | 513 | 530 | 160 | 79 | 5.088 | 0 | 36 | 75 | 0 | dentro |
| Rápido 3× | Regular (2/dia, economico) | 56 | 27 | 5 | 0 | 0 | 45 | 1 | 0 | 17 | 244 | 622 | 1.197 | 2.364 | 1.200 | 0 | 0 | 13 | 18 | 0 | dentro |
| Rápido 3× | Dedicado (4/dia, economico) | 56 | 52 | 6 | 0 | 0 | 45 | 1 | 0 | 16 | 262 | 886 | 1.426 | 11.895 | 0 | 0 | 20 | 0 | 3 | 0 | dentro |
| Normal 1× | Preguiçoso (1/dia, preguicoso) | 168 | 33 | 6 | 0 | 0 | 45 | 2 | 0 | 61 | 664 | 692 | 711 | 1.637 | 0 | 1.138 | 0 | 22 | 6 | 0 | dentro |
| Normal 1× | Regular (2/dia, economico) | 168 | 69 | 7 | 0 | 0 | 35 a 40 | 2 a 4 | 0 | 53 a 54 | 745 | 3.737 a 3.739 | 3.661 a 3.662 | 8.707 | 0 | 46 a 50 | 0 | 0 | 1 | 0 | dentro |
| Normal 1× | Dedicado (4/dia, economico) | 168 | 74 | 7 | 0 | 0 | 35 a 40 | 2 a 4 | 0 | 91 | 393 | 4.178 a 4.180 | 5.013 a 5.014 | 33.588 | 0 | 76 | 0 | 0 | 1 | 0 | dentro |
| Tranquilo 0,5× | Preguiçoso (1/dia, preguicoso) | 336 | 23 | 6 | 0 | 0 | 45 | 4 | 0 | 188 | 425 | 1.026 a 1.027 | 1.278 | 976 | 0 | 339 | 0 | 8 a 9 | 3,5 | 0 | dentro |
| Tranquilo 0,5× | Regular (2/dia, economico) | 336 | 74 | 7 | 0 | 0 | 35 a 40 | 4 a 8 | 0 | 189 a 190 | 746 | 4.090 a 4.092 | 5.078 | 39.445 | 131 a 132 | 4 | 0 | 3 | 1,5 | 0 | dentro |
| Tranquilo 0,5× | Dedicado (4/dia, economico) | 336 | 74 | 7 | 0 | 0 | 45 | 4 | 0 | 229 a 230 | 370 | 3.093 a 3.094 | 3.688 a 3.737 | 43.645 a 43.689 | 0 | 387 a 388 | 0 | 1 a 2 | 1 | 0 | dentro |

#### Senhor: meta de desperdício (perfil Regular)

| Janela | Ritmo | Perfil | Comida (h de jogo) | Madeira (h de jogo) | Pedra (h de jogo) | Meta | Veredito |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 7 dias reais | Rápido 3× | Regular | 18 | 9 | 12 | ≤ 8 | **acima** |
| 7 dias reais | Normal 1× | Regular | 0 | 1 | 0 | ≤ 8 | dentro |
| 7 dias reais | Tranquilo 0,5× | Regular | 0 | 0,5 | 0 | ≤ 8 | dentro |
| Um ano de jogo | Rápido 3× | Regular | 18 | 0 | 0 | ≤ 8 | **acima** |
| Um ano de jogo | Normal 1× | Regular | 0 | 1 | 0 | ≤ 8 | dentro |
| Um ano de jogo | Tranquilo 0,5× | Regular | 1,5 | 0,5 | 0 | ≤ 8 | dentro |

#### Senhor: linha de base medida

```ts
  'week/3/preguicoso': measured([33, 33], 7, 0, 0, 3900, 3900, 4657, 75),
  'week/3/regular': measured([72, 72], 7, 0, 0, 4236, 5100, 156656, 18),
  'week/3/dedicado': measured([74, 74], 7, 0, 0, 4212, 5027, 276913, 3),
  'week/1/preguicoso': measured([33, 33], 6, 0, 0, 692, 711, 1637, 6),
  'week/1/regular': measured([69, 69], 7, 0, 0, 3739, 3662, 8707, 1),
  'week/1/dedicado': measured([74, 74], 7, 0, 0, 4180, 5014, 33588, 1),
  'week/0.5/preguicoso': measured([14, 14], 4, 0, 0, 68, 187, 230, 3.5),
  'week/0.5/regular': measured([54, 54], 6, 0, 0, 588, 1725, 1156, 0.5),
  'week/0.5/dedicado': measured([62, 62], 6, 0, 0, 237, 50, 153, 0),
  'year/3/preguicoso': measured([13, 13], 3, 0, 0, 513, 530, 160, 75),
  'year/3/regular': measured([27, 27], 5, 0, 0, 622, 1197, 2364, 18),
  'year/3/dedicado': measured([52, 52], 6, 0, 0, 886, 1426, 11895, 3),
  'year/1/preguicoso': measured([33, 33], 6, 0, 0, 692, 711, 1637, 6),
  'year/1/regular': measured([69, 69], 7, 0, 0, 3739, 3662, 8707, 1),
  'year/1/dedicado': measured([74, 74], 7, 0, 0, 4180, 5014, 33588, 1),
  'year/0.5/preguicoso': measured([23, 23], 6, 0, 0, 1027, 1278, 976, 3.5),
  'year/0.5/regular': measured([74, 74], 7, 0, 0, 4092, 5078, 39445, 1.5),
  'year/0.5/dedicado': measured([74, 74], 7, 0, 0, 3094, 3737, 43689, 1),
```

#### Camponês: 7 dias reais

| Ritmo | Perfil | Anos de jogo | População | Salão | Fome (h) | Frio (h) | Moral mínima | Moral baixa (h) | Foram embora | Fila ociosa (h) | Sem ofício (aldeão-h) | Excedente de madeira | Excedente de pedra | Excedente de ouro | Desperdício de comida | Desperdício de madeira | Desperdício de pedra | Desperdiçando (h) | Maior sequência desperdiçando (h de jogo) | Recusas | Faixa |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso (1/dia, preguicoso) | 3 | 33 | 7 | 0 | 0 | 50 | 0 | 0 | 104 | 672 | 4.125 | 4.125 | 4.663 a 4.664 | 13.844 a 13.847 | 29.132 a 29.138 | 13.074 a 13.077 | 129 a 130 | 72 | 0 | dentro |
| Rápido 3× | Regular (2/dia, economico) | 3 | 72 | 8 | 0 | 0 | 45 | 1 | 0 | 119 a 120 | 804 | 5.511 | 6.098 a 6.110 | 127.721 a 127.744 | 451 | 25.975 a 25.990 | 3.339 a 3.340 | 27 | 30 | 0 | dentro |
| Rápido 3× | Dedicado (4/dia, economico) | 3 | 84 | 8 | 0 | 0 | 50 | 0 | 0 | 62 | 474 | 5.295 a 5.299 | 6.149 a 6.153 | 304.862 a 304.872 | 79 | 532 a 568 | 0 | 2 | 6 | 0 | dentro |
| Normal 1× | Preguiçoso (1/dia, preguicoso) | 1 | 33 | 6 | 0 | 0 | 45 | 2 | 0 | 80 | 664 | 729 | 585 | 1.749 | 164 | 913 | 0 | 23 | 6 | 0 | dentro |
| Normal 1× | Regular (2/dia, economico) | 1 | 68 | 7 | 0 | 0 | 35 a 40 | 2 a 4 | 0 | 74 | 734 | 2.901 a 2.902 | 4.113 a 4.114 | 9.514 a 9.515 | 0 | 3.256 a 3.260 | 0 | 5 | 4 | 0 | dentro |
| Normal 1× | Dedicado (4/dia, economico) | 1 | 84 | 8 | 0 | 0 | 35 a 40 | 2 a 4 | 0 | 98 a 99 | 449 | 5.215 a 5.216 | 5.906 | 18.503 a 18.504 | 0 | 0 | 0 | 0 | 0 | 0 | dentro |
| Tranquilo 0,5× | Preguiçoso (1/dia, preguicoso) | 0,5 | 14 | 4 | 0 | 0 | 45 | 4 | 0 | 58 | 212 | 208 a 209 | 180 | 236 | 0 | 18 a 19 | 0 | 1 | 1 | 0 | dentro |
| Tranquilo 0,5× | Regular (2/dia, economico) | 0,5 | 54 | 6 | 0 | 0 | 35 a 40 | 4 a 8 | 0 | 68 a 69 | 534 | 716 a 1.061 | 389 a 459 | 270 a 644 | 0 | 0 | 0 | 0 | 0 | 0 | dentro |
| Tranquilo 0,5× | Dedicado (4/dia, economico) | 0,5 | 62 | 6 | 0 | 0 | 45 | 4 | 0 | 73 | 313 | 359 a 360 | 427 a 428 | 527 a 528 | 0 | 0 | 0 | 0 | 0 | 0 | dentro |

#### Camponês: um ano de jogo

| Ritmo | Perfil | Horas reais | População | Salão | Fome (h) | Frio (h) | Moral mínima | Moral baixa (h) | Foram embora | Fila ociosa (h) | Sem ofício (aldeão-h) | Excedente de madeira | Excedente de pedra | Excedente de ouro | Desperdício de comida | Desperdício de madeira | Desperdício de pedra | Desperdiçando (h) | Maior sequência desperdiçando (h de jogo) | Recusas | Faixa |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso (1/dia, preguicoso) | 56 | 13 | 3 | 0 | 0 | 50 | 0 | 0 | 22 | 176 | 994 | 658 | 161 | 0 | 4.863 | 0 | 35 | 72 | 0 | dentro |
| Rápido 3× | Regular (2/dia, economico) | 56 | 27 | 5 | 0 | 0 | 45 | 1 | 0 | 18 | 244 | 1.427 | 1.154 | 1.184 | 183 | 0 | 0 | 4 | 12 | 0 | dentro |
| Rápido 3× | Dedicado (4/dia, economico) | 56 | 50 | 7 | 0 | 0 | 50 | 0 | 0 | 17 | 250 | 1.233 | 866 | 1.821 | 79 | 0 | 0 | 1 | 3 | 0 | dentro |
| Normal 1× | Preguiçoso (1/dia, preguicoso) | 168 | 33 | 6 | 0 | 0 | 45 | 2 | 0 | 80 | 664 | 729 | 585 | 1.749 | 164 | 913 | 0 | 23 | 6 | 0 | dentro |
| Normal 1× | Regular (2/dia, economico) | 168 | 68 | 7 | 0 | 0 | 35 a 40 | 2 a 4 | 0 | 74 | 734 | 2.901 a 2.902 | 4.113 a 4.114 | 9.514 a 9.515 | 0 | 3.256 a 3.260 | 0 | 5 | 4 | 0 | dentro |
| Normal 1× | Dedicado (4/dia, economico) | 168 | 84 | 8 | 0 | 0 | 35 a 40 | 2 a 4 | 0 | 98 a 99 | 449 | 5.215 a 5.216 | 5.906 | 18.503 a 18.504 | 0 | 0 | 0 | 0 | 0 | 0 | dentro |
| Tranquilo 0,5× | Preguiçoso (1/dia, preguicoso) | 336 | 23 | 6 | 0 | 0 | 45 | 4 | 0 | 191 a 192 | 425 | 535 a 536 | 685 a 686 | 1.001 | 0 | 18 a 19 | 0 | 1 | 1 | 0 | dentro |
| Tranquilo 0,5× | Regular (2/dia, economico) | 336 | 84 | 8 | 0 | 0 | 35 a 40 | 4 a 8 | 0 | 220 a 221 | 852 | 6.243 a 6.330 | 6.326 a 6.375 | 17.206 a 18.504 | 0 a 12 | 0 | 0 a 5 | 1 | 0,5 | 0 | dentro |
| Tranquilo 0,5× | Dedicado (4/dia, economico) | 336 | 84 | 8 | 0 | 0 | 45 | 4 | 0 | 224 | 416 | 5.588 a 5.590 | 5.837 a 5.838 | 27.638 | 0 | 0 | 0 | 0 | 0 | 0 | dentro |

#### Camponês: meta de desperdício (perfil Regular)

| Janela | Ritmo | Perfil | Comida (h de jogo) | Madeira (h de jogo) | Pedra (h de jogo) | Meta | Veredito |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 7 dias reais | Rápido 3× | Regular | 12 | 30 | 21 | ≤ 8 | **acima** |
| 7 dias reais | Normal 1× | Regular | 0 | 4 | 0 | ≤ 8 | dentro |
| 7 dias reais | Tranquilo 0,5× | Regular | 0 | 0 | 0 | ≤ 8 | dentro |
| Um ano de jogo | Rápido 3× | Regular | 12 | 0 | 0 | ≤ 8 | **acima** |
| Um ano de jogo | Normal 1× | Regular | 0 | 4 | 0 | ≤ 8 | dentro |
| Um ano de jogo | Tranquilo 0,5× | Regular | 0 a 0,5 | 0 | 0 a 0,5 | ≤ 8 | dentro |

#### Camponês: linha de base medida

```ts
  'week/3/preguicoso': measured([33, 33], 7, 0, 0, 4125, 4125, 4664, 72),
  'week/3/regular': measured([72, 72], 8, 0, 0, 5511, 6110, 127744, 30),
  'week/3/dedicado': measured([84, 84], 8, 0, 0, 5299, 6153, 304872, 6),
  'week/1/preguicoso': measured([33, 33], 6, 0, 0, 729, 585, 1749, 6),
  'week/1/regular': measured([68, 68], 7, 0, 0, 2902, 4114, 9515, 4),
  'week/1/dedicado': measured([84, 84], 8, 0, 0, 5216, 5906, 18504, 0),
  'week/0.5/preguicoso': measured([14, 14], 4, 0, 0, 209, 180, 236, 1),
  'week/0.5/regular': measured([54, 54], 6, 0, 0, 1061, 459, 644, 0),
  'week/0.5/dedicado': measured([62, 62], 6, 0, 0, 360, 428, 528, 0),
  'year/3/preguicoso': measured([13, 13], 3, 0, 0, 994, 658, 161, 72),
  'year/3/regular': measured([27, 27], 5, 0, 0, 1427, 1154, 1184, 12),
  'year/3/dedicado': measured([50, 50], 7, 0, 0, 1233, 866, 1821, 3),
  'year/1/preguicoso': measured([33, 33], 6, 0, 0, 729, 585, 1749, 6),
  'year/1/regular': measured([68, 68], 7, 0, 0, 2902, 4114, 9515, 4),
  'year/1/dedicado': measured([84, 84], 8, 0, 0, 5216, 5906, 18504, 0),
  'year/0.5/preguicoso': measured([23, 23], 6, 0, 0, 536, 686, 1001, 1),
  'year/0.5/regular': measured([84, 84], 8, 0, 0, 6330, 6375, 18504, 0.5),
  'year/0.5/dedicado': measured([84, 84], 8, 0, 0, 5590, 5838, 27638, 0),
```

#### Rei de Ferro: 7 dias reais

| Ritmo | Perfil | Anos de jogo | População | Salão | Fome (h) | Frio (h) | Moral mínima | Moral baixa (h) | Foram embora | Fila ociosa (h) | Sem ofício (aldeão-h) | Excedente de madeira | Excedente de pedra | Excedente de ouro | Desperdício de comida | Desperdício de madeira | Desperdício de pedra | Desperdiçando (h) | Maior sequência desperdiçando (h de jogo) | Recusas | Faixa |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso (1/dia, preguicoso) | 3 | 33 | 7 | 0 | 0 | 45 | 1 | 0 | 90 a 91 | 672 | 3.120 | 3.120 | 4.607 | 15.296 a 15.298 | 28.106 a 28.113 | 13.037 a 13.040 | 133 a 134 | 72 | 0 | dentro |
| Rápido 3× | Regular (2/dia, economico) | 3 | 72 | 7 | 0 | 0 | 45 | 1 | 0 | 80 a 81 | 804 | 2.047 a 2.048 | 3.379 a 3.380 | 157.126 a 157.140 | 5.344 a 5.346 | 1.973 a 1.985 | 111 a 116 | 34 | 24 | 0 | dentro |
| Rápido 3× | Dedicado (4/dia, economico) | 3 | 74 | 7 | 0 | 0 | 45 | 1 | 0 | 28 a 29 | 414 | 2.618 a 2.628 | 3.539 a 3.600 | 280.410 a 281.676 | 108 | 2.047 a 4.590 | 38 | 7 a 10 | 12 | 0 | dentro |
| Normal 1× | Preguiçoso (1/dia, preguicoso) | 1 | 33 | 6 | 0 | 0 | 45 | 2 | 0 | 55 | 664 | 355 | 395 | 1.591 | 179 | 1.318 | 205 | 33 | 9 | 0 | dentro |
| Normal 1× | Regular (2/dia, economico) | 1 | 64 | 7 | 0 | 0 | 35 a 40 | 2 a 4 | 0 | 45 a 59 | 687 | 636 a 802 | 337 a 1.229 | 16.835 a 17.011 | 0 | 0 a 5.655 | 0 a 492 | 0 a 9 | 0 a 9 | 0 | dentro |
| Normal 1× | Dedicado (4/dia, economico) | 1 | 74 | 7 | 0 | 0 | 35 a 40 | 2 a 4 | 0 | 30 | 393 | 2.670 a 2.671 | 3.564 a 3.565 | 39.466 a 39.467 | 0 | 0 | 0 | 0 | 0 | 0 | dentro |
| Tranquilo 0,5× | Preguiçoso (1/dia, preguicoso) | 0,5 | 14 | 4 | 0 | 0 | 45 | 4 | 0 | 53 | 213 | 326 a 327 | 263 | 226 | 0 | 243 a 244 | 0 | 10 | 4,5 | 0 | dentro |
| Tranquilo 0,5× | Regular (2/dia, economico) | 0,5 | 54 | 6 | 0 | 0 | 35 a 40 | 4 a 8 | 0 | 47 | 534 | 507 a 508 | 517 | 464 | 0 | 0 | 0 | 0 | 0 | 0 | dentro |
| Tranquilo 0,5× | Dedicado (4/dia, economico) | 0,5 | 57 | 6 | 0 | 0 | 45 | 4 | 0 | 67 | 288 | 616 a 618 | 575 | 147 a 148 | 0 | 0 | 0 | 0 | 0 | 0 | dentro |

#### Rei de Ferro: um ano de jogo

| Ritmo | Perfil | Horas reais | População | Salão | Fome (h) | Frio (h) | Moral mínima | Moral baixa (h) | Foram embora | Fila ociosa (h) | Sem ofício (aldeão-h) | Excedente de madeira | Excedente de pedra | Excedente de ouro | Desperdício de comida | Desperdício de madeira | Desperdício de pedra | Desperdiçando (h) | Maior sequência desperdiçando (h de jogo) | Recusas | Faixa |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso (1/dia, preguicoso) | 56 | 13 | 3 | 0 | 0 | 45 | 1 | 0 | 17 | 176 | 333 | 495 | 160 | 179 | 5.140 | 0 | 36 | 72 | 0 | dentro |
| Rápido 3× | Regular (2/dia, economico) | 56 | 27 | 5 | 0 | 0 | 45 | 1 | 0 | 8 | 244 | 131 | 635 | 1.052 | 2.356 | 0 | 0 | 21 | 24 | 0 | dentro |
| Rápido 3× | Dedicado (4/dia, economico) | 56 | 51 | 6 | 0 | 0 | 45 | 1 | 0 | 21 | 256 | 498 | 109 | 11.210 | 108 | 2.047 | 38 | 7 | 12 | 0 | dentro |
| Normal 1× | Preguiçoso (1/dia, preguicoso) | 168 | 33 | 6 | 0 | 0 | 45 | 2 | 0 | 55 | 664 | 355 | 395 | 1.591 | 179 | 1.318 | 205 | 33 | 9 | 0 | dentro |
| Normal 1× | Regular (2/dia, economico) | 168 | 64 | 7 | 0 | 0 | 35 a 40 | 2 a 4 | 0 | 45 a 59 | 687 | 636 a 802 | 337 a 1.229 | 16.835 a 17.011 | 0 | 0 a 5.655 | 0 a 492 | 0 a 9 | 0 a 9 | 0 | dentro |
| Normal 1× | Dedicado (4/dia, economico) | 168 | 74 | 7 | 0 | 0 | 35 a 40 | 2 a 4 | 0 | 30 | 393 | 2.670 a 2.671 | 3.564 a 3.565 | 39.466 a 39.467 | 0 | 0 | 0 | 0 | 0 | 0 | dentro |
| Tranquilo 0,5× | Preguiçoso (1/dia, preguicoso) | 336 | 23 | 6 | 0 | 0 | 45 | 4 | 0 | 187 | 426 | 880 | 774 | 957 | 0 | 1.050 a 1.051 | 0 | 23 | 5 | 0 | dentro |
| Tranquilo 0,5× | Regular (2/dia, economico) | 336 | 74 | 7 | 0 | 0 | 35 a 40 | 4 a 8 | 0 | 198 | 746 | 2.302 a 2.303 | 3.267 a 3.268 | 42.952 a 42.953 | 0 | 0 | 0 | 0 | 0 | 0 | dentro |
| Tranquilo 0,5× | Dedicado (4/dia, economico) | 336 | 74 | 7 | 0 | 0 | 45 | 4 | 0 | 213 | 371 | 108 a 109 | 2.154 a 2.155 | 49.129 a 49.130 | 0 | 0 | 0 | 0 | 0 | 0 | dentro |

#### Rei de Ferro: meta de desperdício (perfil Regular)

| Janela | Ritmo | Perfil | Comida (h de jogo) | Madeira (h de jogo) | Pedra (h de jogo) | Meta | Veredito |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 7 dias reais | Rápido 3× | Regular | 24 | 9 | 3 | ≤ 8 | **acima** |
| 7 dias reais | Normal 1× | Regular | 0 | 0 a 9 | 0 a 3 | ≤ 8 | **acima** |
| 7 dias reais | Tranquilo 0,5× | Regular | 0 | 0 | 0 | ≤ 8 | dentro |
| Um ano de jogo | Rápido 3× | Regular | 24 | 0 | 0 | ≤ 8 | **acima** |
| Um ano de jogo | Normal 1× | Regular | 0 | 0 a 9 | 0 a 3 | ≤ 8 | **acima** |
| Um ano de jogo | Tranquilo 0,5× | Regular | 0 | 0 | 0 | ≤ 8 | dentro |

#### Rei de Ferro: linha de base medida

```ts
  'week/3/preguicoso': measured([33, 33], 7, 0, 0, 3120, 3120, 4607, 72),
  'week/3/regular': measured([72, 72], 7, 0, 0, 2048, 3380, 157140, 24),
  'week/3/dedicado': measured([74, 74], 7, 0, 0, 2628, 3600, 281676, 12),
  'week/1/preguicoso': measured([33, 33], 6, 0, 0, 355, 395, 1591, 9),
  'week/1/regular': measured([64, 64], 7, 0, 0, 802, 1229, 17011, 9),
  'week/1/dedicado': measured([74, 74], 7, 0, 0, 2671, 3565, 39467, 0),
  'week/0.5/preguicoso': measured([14, 14], 4, 0, 0, 327, 263, 226, 4.5),
  'week/0.5/regular': measured([54, 54], 6, 0, 0, 508, 517, 464, 0),
  'week/0.5/dedicado': measured([57, 57], 6, 0, 0, 618, 575, 148, 0),
  'year/3/preguicoso': measured([13, 13], 3, 0, 0, 333, 495, 160, 72),
  'year/3/regular': measured([27, 27], 5, 0, 0, 131, 635, 1052, 24),
  'year/3/dedicado': measured([51, 51], 6, 0, 0, 498, 109, 11210, 12),
  'year/1/preguicoso': measured([33, 33], 6, 0, 0, 355, 395, 1591, 9),
  'year/1/regular': measured([64, 64], 7, 0, 0, 802, 1229, 17011, 9),
  'year/1/dedicado': measured([74, 74], 7, 0, 0, 2671, 3565, 39467, 0),
  'year/0.5/preguicoso': measured([23, 23], 6, 0, 0, 880, 774, 957, 5),
  'year/0.5/regular': measured([74, 74], 7, 0, 0, 2303, 3268, 42953, 0),
  'year/0.5/dedicado': measured([74, 74], 7, 0, 0, 109, 2155, 49130, 0),
```

### 10.3 As cartas, por célula

Contado dos eventos, nas 50 sementes de Senhor (as outras dificuldades diferem em uma carta, em duas células do ritmo Tranquilo):

| Janela | Ritmo | Cartas que chegaram | Respondidas | Expiradas | Partidas diferentes entre as 50 sementes |
|---|---|---|---|---|---|
| 7 dias reais | Rápido 3× (3 anos de jogo) | 10 | 9 | 0 | 2 a 4 |
| 7 dias reais | Normal 1× (1 ano) | 4 | 3 | 0 | 1 a 2 |
| 7 dias reais | Tranquilo 0,5× (meio ano) | 2 a 3 | 2 a 3 | 0 | 2 |
| Um ano de jogo | os três | 3 a 4 | 2 a 3 | 0 | 1 a 2 |

A que fica sem resposta é sempre a da virada do ano, que chega na última hora da partida. **Três ou quatro cartas por ano de jogo é pouco**: depois das duas avulsas e das tábuas, o Conselho passa o resto do ano sem assunto (a visão diz isso ao jogador, em vez de prometer carta). É o que V2D-T2 resolve, com as outras dezesseis cartas do primeiro lote.

### 10.4 O que mudou em relação à seção 9, e por quê

- **A semente passou a mudar a partida.** Não pelo peso das cartas, que é pequeno, mas porque o caminho do bot é sensível: a ordem em que o poço e a refeição chegam muda de um dia de jogo a virada em que a moral cai 5 pontos, a produção daquele dia cai 2,5%, e uma obra que fecharia o custo antes de uma visita passa a fechar depois dela. A maioria das células varia em poucas unidades ("3.737 a 3.739" de madeira); algumas bifurcam.
- **Senhor: quase nada.** Os tetos medidos mudaram em unidades (o ouro parado do Regular no ritmo Rápido foi de 156.690 para 156.656). A moral mínima caiu de 40 para 35 em metade das sementes no ritmo Normal: o poço cavado em cima das casas cheias.
- **Camponês: o caminho do Regular no ritmo Normal é outro, nas 50 sementes.** Ele termina com 4.114 de pedra parada (eram 2.125), 2.902 de madeira (eram 4.018) e 9.515 de ouro (eram 12.251), e passa 4 h de jogo com a madeira no limite (eram 0; a meta é 8). No ano de jogo do Dedicado no ritmo Rápido, madeira, pedra e ouro parados sobem (1.233, 866 e 1.821, contra 574, 80 e 1.239). O feudo é o mesmo em população e em nível do Salão: muda o que estava no depósito na hora em que a partida acabou.
- **Rei de Ferro: o ritmo Normal passa da meta de desperdício em metade das sementes.** Com o Armazém 20% menor, o caminho deslocado deixa a madeira 9 h de jogo seguidas no limite (a meta do GDD §15.2 é 8) e 1.229 de pedra parada (eram 338). Antes do Conselho as 50 sementes ficavam em 0 h. Não é uma carta que desperdiça: nenhuma carta mexe na madeira dessas partidas. É a fragilidade do caminho do bot econômico em Rei de Ferro, que a variação entre sementes pôs à vista.

### 10.5 Faixas

`MEASURED`, em `packages/sim-cli/src/bands.ts`, passou a ser a linha de base desta rodada, nas três dificuldades; a regra da folga não mudou (10% na população, 5% nos tetos). `balance.test.ts` guarda, por dificuldade, quais células do Regular cumprem a meta de desperdício: em Senhor e Camponês, as dos ritmos Normal e Tranquilo, como antes; **em Rei de Ferro, o ritmo Normal saiu da lista**, e o teste diz por quê.

### 10.6 O que fica para o autor

- **A meta de desperdício em Rei de Ferro, no ritmo Normal** (9 h contra 8, em metade das sementes): aceitar como variação do bot, ou apertar o que a causa (o Armazém de Rei de Ferro, ou a política de alocação do bot). Entra na pauta do balanceamento da versão (V2F-T1).
- **O bot escolhe sempre a opção sem custo**, e por isso nunca percorre a cadeia nem paga uma carta. As faixas medem a economia com o Conselho quase neutro. Uma política que pese custo e consequência só faz sentido com o catálogo fechado (V2D-T2), e vai mexer nestas medidas de novo.

### 10.7 Limites desta medição

- Cinco cartas, três delas sorteáveis: as medidas de cobertura (quantas cartas elegíveis por estação e por nível do Salão) são de V2D-T2.5.
- Nenhuma partida da matriz deixa uma carta expirar nem escolhe uma opção com efeito escondido: a expiração, os efeitos escondidos e as continuações são provados pelos testes do motor (`council.test.ts`, `council.property.test.ts`, o golden de 7 dias) e pela integração (`packages/server/test/council.test.ts`), não pelo simulador.
- O prazo de resposta é de tempo real: a regra "as mesmas ordens nos mesmos instantes de jogo dão o mesmo feudo em qualquer ritmo" só vale enquanto nenhuma carta expira. Os testes que a conferem (`timescale.test.ts`, `pace.test.ts`) respondem às cartas nos dois ritmos.
