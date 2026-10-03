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

## 11. O primeiro lote de cartas (V2D-T2)

Tarefa V2D-T2: o catálogo do Conselho passou de 5 para **18 cartas** (as duas cadeias que só pedem o que a v0.2 já tem e as 12 avulsas; a ficha de cada uma está em [content-v0.2.md](content-v0.2.md)), e o bot econômico passou a **pagar** as opções das cartas quando tem folga. As duas coisas mexem na economia de propósito: a linha de base de `packages/sim-cli/src/bands.ts` foi regravada, nas três dificuldades, com o que esta rodada mediu.

| | |
|---|---|
| Data | 2026-10-02 |
| Commit | o desta tarefa (`git log --grep "V2D-T2"`), feito sobre `08e14a2` |
| Identificação | Motor 0.1.0 · estado v8 · conteúdo aee14c5417faa5be |
| Dificuldades | Camponês (`peasant`), Senhor (`lord`) e Rei de Ferro (`ironKing`) |
| Sementes | 50 fixas: `pedra-alta-001` a `pedra-alta-050` |
| Ritmos | Rápido 3×, Normal 1× e Tranquilo 0,5× |
| Máquina | Apple M5, macOS 26.6.2, Node 24.19.0 |

### 11.1 O que entrou no jogo e nos bots

- **Cartas.** Dez cartas de uma vez por ano no sorteio (duas abrem cadeias de três) e quatro recorrentes, que garantem assunto em toda audiência: nenhuma das partidas medidas teve uma audiência com lugar na mesa e sem carta. As cartas dão e tiram recurso (de 15 a 150 unidades) e moral (de 5 a 20 pontos, por 1 a 4 dias de jogo); onze opções escondem um efeito que acontece dias depois. Em Camponês e em Senhor, a opção que o conselho aplica sozinho nunca tira nada.
- **Política `responder a carta` (bot econômico).** Deixou de escolher sempre a opção sem custo. Agora paga a opção **mais cara que cabe com folga**: o recurso está entrando (saldo por hora positivo), o estoque é ao menos o triplo do custo, e pagar não tira o material da próxima obra, a comida da reserva do recrutamento nem a madeira que a lareira vai queimar. Sem folga, fica com a primeira opção sem custo (a que não arrisca). Ela passou para **depois** das obras e do recrutamento na lista do bot: o que ele gasta com o Conselho é o que sobrou da visita.
- **Política `responder a carta sem gastar` (bot preguiçoso).** A primeira opção sem custo, sempre: quem decide o mínimo não investe em carta e nunca abre uma cadeia.
- **O bot ainda não lê a consequência.** Decide pelo custo e pelo estoque. Não distingue festa de conserto, não soma efeitos de propósito e não escolhe a opção que troca moral por recurso. A visão traz a consequência só em texto (`effectsText`).

Três versões da política foram medidas antes desta, e descartadas pelo que fizeram ao feudo do bot:

| Versão | O que fazia | O que a matriz mostrou |
|---|---|---|
| Pagar com um terço do estoque, antes das obras | A carta vinha primeiro na visita | O Preguiçoso do ritmo Tranquilo terminava a semana com 9 a 20 aldeões e o Salão no nível 2 (eram 14 e nível 4): a comida da carta era a de um recruta |
| O mesmo, depois das obras e do recrutamento | A carta só gasta o que sobra | O Preguiçoso do ritmo Normal ficava em 10 aldeões em 8 das 50 sementes: gastava o ouro com uma carta, não tinha ninguém na Mina, e sem ouro não recrutava mais |
| Só paga com recurso que está entrando | Saldo por hora positivo | O Preguiçoso ainda variava de 12 a 16 (Salão 2 em 10 sementes): o caminho de obras dele muda com qualquer gasto |

O Preguiçoso ficou com a política que não gasta, e voltou ao que media antes. O que as versões descartadas mostram do **jogo**, e não só do bot: um feudo pequeno, visitado uma vez por dia, que gasta o ouro e não tem ninguém na Mina **para de crescer** (o recrutamento custa ouro, e nada na tela obriga a ter um mineiro). Fica para o balanceamento da versão (V2F-T1).

### 11.2 Comando e saída

```bash
pnpm -s sim -- --matrix > matriz-senhor.csv 2> matriz-senhor.md
pnpm -s sim -- --matrix --difficulty peasant > matriz-campones.csv 2> matriz-campones.md
pnpm -s sim -- --matrix --difficulty ironKing > matriz-rei-de-ferro.csv 2> matriz-rei-de-ferro.md
```

900 linhas no CSV em cada dificuldade; cada rodada leva cerca de 28 s. Com a linha de base nova as três saem com código 0: todas as partidas dentro das faixas da própria dificuldade, nenhuma ordem recusada. Nenhuma partida passa fome nem frio, e nenhuma perde um aldeão. Abaixo, de cada dificuldade, a tabela principal de cada janela, a meta de desperdício e a linha de base.

#### Senhor: 7 dias reais

| Ritmo | Perfil | Anos de jogo | População | Salão | Fome (h) | Frio (h) | Moral mínima | Moral baixa (h) | Foram embora | Fila ociosa (h) | Sem ofício (aldeão-h) | Excedente de madeira | Excedente de pedra | Excedente de ouro | Desperdício de comida | Desperdício de madeira | Desperdício de pedra | Desperdiçando (h) | Maior sequência desperdiçando (h de jogo) | Recusas | Faixa |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso (1/dia, preguicoso) | 3 | 33 | 7 | 0 | 0 | 50 | 0 | 0 | 103 | 672 | 3.900 | 3.900 | 4.660 a 4.662 | 14.680 a 14.686 | 27.617 a 27.636 | 12.429 a 12.435 | 131 | 75 | 0 | dentro |
| Rápido 3× | Regular (2/dia, economico) | 3 | 72 a 74 | 7 | 0 | 0 | 50 | 0 | 0 | 91 a 111 | 804 a 828 | 2.778 a 5.100 | 4.128 a 5.100 | 153.214 a 165.682 | 1.107 a 4.456 | 1.212 a 12.355 | 0 a 570 | 20 a 42 | 18 a 30 | 0 | dentro |
| Rápido 3× | Dedicado (4/dia, economico) | 3 | 74 a 75 | 7 | 0 | 0 | 50 | 0 | 0 | 37 a 111 | 412 a 420 | 1.529 a 4.883 | 2.944 a 5.100 | 265.771 a 284.783 | 0 a 722 | 0 a 14.411 | 0 a 1.245 | 0 a 14 | 0 a 21 | 0 | dentro |
| Normal 1× | Preguiçoso (1/dia, preguicoso) | 1 | 30 a 33 | 6 | 0 | 0 | 50 | 0 | 0 | 61 a 83 | 594 a 664 | 692 a 1.242 | 161 a 720 | 775 a 1.645 | 0 a 338 | 1.147 a 2.359 | 0 | 23 a 44 | 6 a 11 | 0 | dentro |
| Normal 1× | Regular (2/dia, economico) | 1 | 64 a 72 | 7 | 0 | 0 | 40 a 50 | 0 a 2 | 0 | 37 a 91 | 685 a 776 | 50 a 5.071 | 64 a 5.009 | 1.270 a 23.001 | 0 a 76 | 0 a 11.081 | 0 a 1.022 | 0 a 23 | 0 a 10 | 0 | dentro |
| Normal 1× | Dedicado (4/dia, economico) | 1 | 74 a 75 | 7 | 0 | 0 | 40 a 50 | 0 a 2 | 0 | 56 a 110 | 392 a 399 | 360 a 5.098 | 2.901 a 5.100 | 27.649 a 39.797 | 0 a 82 | 0 a 1.410 | 0 a 380 | 0 a 5 | 0 a 3 | 0 | dentro |
| Tranquilo 0,5× | Preguiçoso (1/dia, preguicoso) | 0,5 | 14 | 4 | 0 | 0 | 50 | 0 | 0 | 52 a 55 | 212 | 70 a 74 | 188 a 190 | 231 a 232 | 0 | 144 | 0 | 7 | 3,5 a 4 | 0 | dentro |
| Tranquilo 0,5× | Regular (2/dia, economico) | 0,5 | 51 a 54 | 5 a 6 | 0 | 0 | 40 a 50 | 0 a 4 | 0 | 45 a 66 | 504 a 540 | 25 a 2.700 | 453 a 1.743 | 271 a 1.101 | 0 | 0 a 891 | 0 | 0 a 4 | 0 a 2 | 0 | dentro |
| Tranquilo 0,5× | Dedicado (4/dia, economico) | 0,5 | 58 a 64 | 6 | 0 | 0 | 50 | 0 | 0 | 65 a 80 | 292 a 323 | 24 a 1.750 | 5 a 974 | 59 a 948 | 0 | 0 a 106 | 0 | 0 a 1 | 0 a 1 | 0 | dentro |

#### Senhor: um ano de jogo

| Ritmo | Perfil | Horas reais | População | Salão | Fome (h) | Frio (h) | Moral mínima | Moral baixa (h) | Foram embora | Fila ociosa (h) | Sem ofício (aldeão-h) | Excedente de madeira | Excedente de pedra | Excedente de ouro | Desperdício de comida | Desperdício de madeira | Desperdício de pedra | Desperdiçando (h) | Maior sequência desperdiçando (h de jogo) | Recusas | Faixa |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso (1/dia, preguicoso) | 56 | 13 | 3 | 0 | 0 | 50 | 0 | 0 | 21 | 176 | 513 | 531 a 532 | 160 | 79 | 5.091 a 5.094 | 0 | 36 | 75 | 0 | dentro |
| Rápido 3× | Regular (2/dia, economico) | 56 | 27 a 29 | 5 | 0 | 0 | 50 | 0 | 0 | 11 a 16 | 244 a 267 | 11 a 784 | 684 a 1.332 | 2.262 a 2.851 | 1.053 a 1.304 | 0 | 0 a 93 | 12 a 15 | 18 a 24 | 0 | dentro |
| Rápido 3× | Dedicado (4/dia, economico) | 56 | 52 a 54 | 6 a 7 | 0 | 0 | 50 | 0 | 0 | 8 a 26 | 262 a 273 | 243 a 1.705 | 52 a 2.022 | 1.669 a 16.562 | 0 a 69 | 0 a 11.025 | 0 a 566 | 0 a 11 | 0 a 18 | 0 | dentro |
| Normal 1× | Preguiçoso (1/dia, preguicoso) | 168 | 30 a 33 | 6 | 0 | 0 | 50 | 0 | 0 | 61 a 83 | 594 a 664 | 692 a 1.242 | 161 a 720 | 775 a 1.645 | 0 a 338 | 1.147 a 2.359 | 0 | 23 a 44 | 6 a 11 | 0 | dentro |
| Normal 1× | Regular (2/dia, economico) | 168 | 64 a 72 | 7 | 0 | 0 | 40 a 50 | 0 a 2 | 0 | 37 a 91 | 685 a 776 | 50 a 5.071 | 64 a 5.009 | 1.270 a 23.001 | 0 a 76 | 0 a 11.081 | 0 a 1.022 | 0 a 23 | 0 a 10 | 0 | dentro |
| Normal 1× | Dedicado (4/dia, economico) | 168 | 74 a 75 | 7 | 0 | 0 | 40 a 50 | 0 a 2 | 0 | 56 a 110 | 392 a 399 | 360 a 5.098 | 2.901 a 5.100 | 27.649 a 39.797 | 0 a 82 | 0 a 1.410 | 0 a 380 | 0 a 5 | 0 a 3 | 0 | dentro |
| Tranquilo 0,5× | Preguiçoso (1/dia, preguicoso) | 336 | 23 | 6 | 0 | 0 | 50 | 0 | 0 | 184 a 187 | 425 | 1.029 a 1.033 | 1.279 a 1.281 | 977 a 978 | 0 | 340 a 342 | 0 | 9 | 3,5 a 4 | 0 | dentro |
| Tranquilo 0,5× | Regular (2/dia, economico) | 336 | 74 a 75 | 7 | 0 | 0 | 40 a 50 | 0 a 12 | 0 | 193 a 218 | 737 a 760 | 2.643 a 5.075 | 4.166 a 5.100 | 35.330 a 41.627 | 0 a 277 | 0 a 2.625 | 0 a 164 | 0 a 10 | 0 a 3 | 0 | dentro |
| Tranquilo 0,5× | Dedicado (4/dia, economico) | 336 | 74 a 75 | 7 | 0 | 0 | 50 | 0 | 0 | 146 a 237 | 353 a 376 | 410 a 5.096 | 307 a 5.100 | 35.398 a 50.117 | 0 a 80 | 0 a 1.921 | 0 a 35 | 0 a 6 | 0 a 3 | 0 | dentro |

#### Senhor: meta de desperdício

| Janela | Ritmo | Perfil | Comida (h de jogo) | Madeira (h de jogo) | Pedra (h de jogo) | Meta | Veredito |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 7 dias reais | Rápido 3× | Regular | 18 a 24 | 6 a 30 | 0 a 12 | ≤ 8 | **acima** |
| 7 dias reais | Normal 1× | Regular | 0 a 3 | 0 a 10 | 0 a 5 | ≤ 8 | **acima** |
| 7 dias reais | Tranquilo 0,5× | Regular | 0 | 0 a 2 | 0 | ≤ 8 | dentro |
| Um ano de jogo | Rápido 3× | Regular | 18 a 24 | 0 | 0 a 3 | ≤ 8 | **acima** |
| Um ano de jogo | Normal 1× | Regular | 0 a 3 | 0 a 10 | 0 a 5 | ≤ 8 | **acima** |
| Um ano de jogo | Tranquilo 0,5× | Regular | 0 a 2,5 | 0 a 3 | 0 a 1 | ≤ 8 | dentro |

#### Senhor: linha de base

```ts
  'week/3/preguicoso': measured([33, 33], 7, 0, 0, 3900, 3900, 4662, 75),
  'week/3/regular': measured([72, 74], 7, 0, 0, 5100, 5100, 165682, 30),
  'week/3/dedicado': measured([74, 75], 7, 0, 0, 4883, 5100, 284783, 21),
  'week/1/preguicoso': measured([30, 33], 6, 0, 0, 1242, 720, 1645, 11),
  'week/1/regular': measured([64, 72], 7, 0, 0, 5071, 5009, 23001, 10),
  'week/1/dedicado': measured([74, 75], 7, 0, 0, 5098, 5100, 39797, 3),
  'week/0.5/preguicoso': measured([14, 14], 4, 0, 0, 74, 190, 232, 4),
  'week/0.5/regular': measured([51, 54], 5, 0, 0, 2700, 1743, 1101, 2),
  'week/0.5/dedicado': measured([58, 64], 6, 0, 0, 1750, 974, 948, 1),
  'year/3/preguicoso': measured([13, 13], 3, 0, 0, 513, 532, 160, 75),
  'year/3/regular': measured([27, 29], 5, 0, 0, 784, 1332, 2851, 24),
  'year/3/dedicado': measured([52, 54], 6, 0, 0, 1705, 2022, 16562, 18),
  'year/1/preguicoso': measured([30, 33], 6, 0, 0, 1242, 720, 1645, 11),
  'year/1/regular': measured([64, 72], 7, 0, 0, 5071, 5009, 23001, 10),
  'year/1/dedicado': measured([74, 75], 7, 0, 0, 5098, 5100, 39797, 3),
  'year/0.5/preguicoso': measured([23, 23], 6, 0, 0, 1033, 1281, 978, 4),
  'year/0.5/regular': measured([74, 75], 7, 0, 0, 5075, 5100, 41627, 3),
  'year/0.5/dedicado': measured([74, 75], 7, 0, 0, 5096, 5100, 50117, 3),
```

#### Camponês: 7 dias reais

| Ritmo | Perfil | Anos de jogo | População | Salão | Fome (h) | Frio (h) | Moral mínima | Moral baixa (h) | Foram embora | Fila ociosa (h) | Sem ofício (aldeão-h) | Excedente de madeira | Excedente de pedra | Excedente de ouro | Desperdício de comida | Desperdício de madeira | Desperdício de pedra | Desperdiçando (h) | Maior sequência desperdiçando (h de jogo) | Recusas | Faixa |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso (1/dia, preguicoso) | 3 | 33 | 7 | 0 | 0 | 50 | 0 | 0 | 104 | 672 | 4.125 | 4.125 | 4.666 a 4.668 | 13.855 a 13.861 | 29.154 a 29.173 | 13.085 a 13.092 | 130 | 72 | 0 | dentro |
| Rápido 3× | Regular (2/dia, economico) | 3 | 72 a 75 | 8 | 0 | 0 | 50 | 0 | 0 | 90 a 120 | 804 a 839 | 4.827 a 6.375 | 5.817 a 6.375 | 128.538 a 148.046 | 207 a 3.478 | 727 a 29.953 | 0 a 5.635 | 10 a 33 | 12 a 33 | 0 | dentro |
| Rápido 3× | Dedicado (4/dia, economico) | 3 | 84 a 85 | 8 | 0 | 0 | 50 | 0 | 0 | 40 a 117 | 472 a 480 | 2.978 a 5.638 | 4.783 a 6.375 | 297.465 a 322.140 | 49 a 184 | 145 a 19.274 | 0 a 2.289 | 2 a 15 | 3 a 15 | 0 | dentro |
| Normal 1× | Preguiçoso (1/dia, preguicoso) | 1 | 30 a 33 | 6 | 0 | 0 | 50 | 0 | 0 | 81 a 84 | 594 a 664 | 729 a 1.175 | 174 a 589 | 795 a 1.750 | 108 a 168 | 922 a 2.034 | 0 | 23 a 34 | 6 a 9 | 0 | dentro |
| Normal 1× | Regular (2/dia, economico) | 1 | 64 a 71 | 7 a 8 | 0 | 0 | 40 a 50 | 0 a 2 | 0 | 61 a 90 | 685 a 765 | 43 a 5.054 | 216 a 4.886 | 15 a 18.782 | 0 a 122 | 0 a 4.881 | 0 a 231 | 0 a 9 | 0 a 6 | 0 | dentro |
| Normal 1× | Dedicado (4/dia, economico) | 1 | 84 | 8 | 0 | 0 | 40 a 50 | 0 a 2 | 0 | 82 a 110 | 447 a 453 | 4.743 a 6.375 | 5.478 a 6.375 | 15.995 a 23.455 | 0 a 57 | 0 a 4.004 | 0 a 33 | 0 a 4 | 0 a 3 | 0 | dentro |
| Tranquilo 0,5× | Preguiçoso (1/dia, preguicoso) | 0,5 | 14 | 4 | 0 | 0 | 50 | 0 | 0 | 55 a 58 | 212 | 211 a 215 | 181 a 183 | 237 a 238 | 0 | 19 | 0 | 1 | 1 | 0 | dentro |
| Tranquilo 0,5× | Regular (2/dia, economico) | 0,5 | 54 a 59 | 6 | 0 | 0 | 40 a 50 | 0 a 4 | 0 | 56 a 71 | 533 a 587 | 198 a 1.687 | 373 a 1.303 | 7 a 842 | 0 | 0 a 416 | 0 | 0 a 3 | 0 a 1,5 | 0 | dentro |
| Tranquilo 0,5× | Dedicado (4/dia, economico) | 0,5 | 58 a 64 | 6 | 0 | 0 | 50 | 0 | 0 | 70 a 79 | 292 a 322 | 125 a 2.255 | 320 a 1.558 | 460 a 1.516 | 0 | 0 | 0 | 0 | 0 | 0 | dentro |

#### Camponês: um ano de jogo

| Ritmo | Perfil | Horas reais | População | Salão | Fome (h) | Frio (h) | Moral mínima | Moral baixa (h) | Foram embora | Fila ociosa (h) | Sem ofício (aldeão-h) | Excedente de madeira | Excedente de pedra | Excedente de ouro | Desperdício de comida | Desperdício de madeira | Desperdício de pedra | Desperdiçando (h) | Maior sequência desperdiçando (h de jogo) | Recusas | Faixa |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso (1/dia, preguicoso) | 56 | 13 | 3 | 0 | 0 | 50 | 0 | 0 | 22 | 176 | 994 | 659 a 660 | 161 | 0 | 4.866 a 4.869 | 0 | 35 | 72 | 0 | dentro |
| Rápido 3× | Regular (2/dia, economico) | 56 | 27 a 29 | 5 | 0 | 0 | 50 | 0 | 0 | 10 a 19 | 244 a 267 | 2 a 1.543 | 162 a 1.650 | 301 a 2.403 | 169 a 844 | 0 | 0 | 4 a 10 | 12 a 18 | 0 | dentro |
| Rápido 3× | Dedicado (4/dia, economico) | 56 | 48 a 55 | 7 | 0 | 0 | 50 | 0 | 0 | 12 a 24 | 238 a 278 | 39 a 1.916 | 794 a 3.015 | 974 a 5.923 | 42 a 132 | 0 a 734 | 0 a 112 | 1 a 3 | 3 a 6 | 0 | dentro |
| Normal 1× | Preguiçoso (1/dia, preguicoso) | 168 | 30 a 33 | 6 | 0 | 0 | 50 | 0 | 0 | 81 a 84 | 594 a 664 | 729 a 1.175 | 174 a 589 | 795 a 1.750 | 108 a 168 | 922 a 2.034 | 0 | 23 a 34 | 6 a 9 | 0 | dentro |
| Normal 1× | Regular (2/dia, economico) | 168 | 64 a 71 | 7 a 8 | 0 | 0 | 40 a 50 | 0 a 2 | 0 | 61 a 90 | 685 a 765 | 43 a 5.054 | 216 a 4.886 | 15 a 18.782 | 0 a 122 | 0 a 4.881 | 0 a 231 | 0 a 9 | 0 a 6 | 0 | dentro |
| Normal 1× | Dedicado (4/dia, economico) | 168 | 84 | 8 | 0 | 0 | 40 a 50 | 0 a 2 | 0 | 82 a 110 | 447 a 453 | 4.743 a 6.375 | 5.478 a 6.375 | 15.995 a 23.455 | 0 a 57 | 0 a 4.004 | 0 a 33 | 0 a 4 | 0 a 3 | 0 | dentro |
| Tranquilo 0,5× | Preguiçoso (1/dia, preguicoso) | 336 | 23 | 6 | 0 | 0 | 50 | 0 | 0 | 192 a 197 | 425 | 691 a 695 | 1.756 a 1.758 | 1.001 a 1.003 | 0 | 19 | 0 | 1 | 1 | 0 | dentro |
| Tranquilo 0,5× | Regular (2/dia, economico) | 336 | 84 a 85 | 8 | 0 | 0 | 40 a 50 | 0 a 8 | 0 | 192 a 225 | 851 a 861 | 4.843 a 6.375 | 5.490 a 6.375 | 16.775 a 25.589 | 0 a 212 | 0 a 4.418 | 0 a 58 | 0 a 11 | 0 a 3,5 | 0 | dentro |
| Tranquilo 0,5× | Dedicado (4/dia, economico) | 336 | 84 a 85 | 8 | 0 | 0 | 50 | 0 | 0 | 218 a 232 | 403 a 421 | 3.652 a 6.375 | 5.494 a 6.375 | 27.984 a 36.126 | 0 a 10 | 0 a 2.341 | 0 a 38 | 0 a 5 | 0 a 2 | 0 | dentro |

#### Camponês: meta de desperdício

| Janela | Ritmo | Perfil | Comida (h de jogo) | Madeira (h de jogo) | Pedra (h de jogo) | Meta | Veredito |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 7 dias reais | Rápido 3× | Regular | 12 a 21 | 3 a 33 | 0 a 27 | ≤ 8 | **acima** |
| 7 dias reais | Normal 1× | Regular | 0 a 3 | 0 a 6 | 0 a 4 | ≤ 8 | dentro |
| 7 dias reais | Tranquilo 0,5× | Regular | 0 | 0 a 1,5 | 0 | ≤ 8 | dentro |
| Um ano de jogo | Rápido 3× | Regular | 12 a 18 | 0 | 0 | ≤ 8 | **acima** |
| Um ano de jogo | Normal 1× | Regular | 0 a 3 | 0 a 6 | 0 a 4 | ≤ 8 | dentro |
| Um ano de jogo | Tranquilo 0,5× | Regular | 0 a 2,5 | 0 a 3,5 | 0 a 0,5 | ≤ 8 | dentro |

#### Camponês: linha de base

```ts
  'week/3/preguicoso': measured([33, 33], 7, 0, 0, 4125, 4125, 4668, 72),
  'week/3/regular': measured([72, 75], 8, 0, 0, 6375, 6375, 148046, 33),
  'week/3/dedicado': measured([84, 85], 8, 0, 0, 5638, 6375, 322140, 15),
  'week/1/preguicoso': measured([30, 33], 6, 0, 0, 1175, 589, 1750, 9),
  'week/1/regular': measured([64, 71], 7, 0, 0, 5054, 4886, 18782, 6),
  'week/1/dedicado': measured([84, 84], 8, 0, 0, 6375, 6375, 23455, 3),
  'week/0.5/preguicoso': measured([14, 14], 4, 0, 0, 215, 183, 238, 1),
  'week/0.5/regular': measured([54, 59], 6, 0, 0, 1687, 1303, 842, 1.5),
  'week/0.5/dedicado': measured([58, 64], 6, 0, 0, 2255, 1558, 1516, 0),
  'year/3/preguicoso': measured([13, 13], 3, 0, 0, 994, 660, 161, 72),
  'year/3/regular': measured([27, 29], 5, 0, 0, 1543, 1650, 2403, 18),
  'year/3/dedicado': measured([48, 55], 7, 0, 0, 1916, 3015, 5923, 6),
  'year/1/preguicoso': measured([30, 33], 6, 0, 0, 1175, 589, 1750, 9),
  'year/1/regular': measured([64, 71], 7, 0, 0, 5054, 4886, 18782, 6),
  'year/1/dedicado': measured([84, 84], 8, 0, 0, 6375, 6375, 23455, 3),
  'year/0.5/preguicoso': measured([23, 23], 6, 0, 0, 695, 1758, 1003, 1),
  'year/0.5/regular': measured([84, 85], 8, 0, 0, 6375, 6375, 25589, 3.5),
  'year/0.5/dedicado': measured([84, 85], 8, 0, 0, 6375, 6375, 36126, 2),
```

#### Rei de Ferro: 7 dias reais

| Ritmo | Perfil | Anos de jogo | População | Salão | Fome (h) | Frio (h) | Moral mínima | Moral baixa (h) | Foram embora | Fila ociosa (h) | Sem ofício (aldeão-h) | Excedente de madeira | Excedente de pedra | Excedente de ouro | Desperdício de comida | Desperdício de madeira | Desperdício de pedra | Desperdiçando (h) | Maior sequência desperdiçando (h de jogo) | Recusas | Faixa |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso (1/dia, preguicoso) | 3 | 33 | 7 | 0 | 0 | 50 | 0 | 0 | 91 | 672 | 3.120 | 3.120 | 4.610 a 4.612 | 15.307 a 15.313 | 28.129 a 28.148 | 13.048 a 13.054 | 134 | 72 | 0 | dentro |
| Rápido 3× | Regular (2/dia, economico) | 3 | 72 a 75 | 7 | 0 | 0 | 50 | 0 | 0 | 26 a 87 | 804 a 839 | 1.228 a 2.736 | 2.657 a 3.590 | 156.332 a 168.623 | 2.729 a 7.632 | 1.776 a 2.814 | 0 a 253 | 30 a 41 | 24 a 30 | 0 | dentro |
| Rápido 3× | Dedicado (4/dia, economico) | 3 | 74 a 75 | 7 | 0 | 0 | 40 a 50 | 0 a 8 | 0 | 13 a 89 | 412 a 420 | 1.656 a 2.736 | 2.271 a 3.600 | 271.913 a 295.750 | 82 a 2.298 | 0 a 22.502 | 0 a 3.309 | 3 a 33 | 6 a 48 | 0 | dentro |
| Normal 1× | Preguiçoso (1/dia, preguicoso) | 1 | 30 a 33 | 5 a 6 | 0 | 0 | 50 | 0 | 0 | 56 a 58 | 594 a 664 | 356 a 1.680 | 395 a 936 | 1.591 a 1.677 | 103 a 183 | 1.327 a 2.915 | 37 a 208 | 33 a 43 | 9 a 12 | 0 | dentro |
| Normal 1× | Regular (2/dia, economico) | 1 | 64 a 70 | 7 | 0 | 0 | 40 a 50 | 0 a 2 | 0 | 28 a 61 | 685 a 756 | 380 a 3.600 | 27 a 3.557 | 6.388 a 18.939 | 0 a 232 | 0 a 5.716 | 0 a 874 | 0 a 11 | 0 a 8 | 0 | dentro |
| Normal 1× | Dedicado (4/dia, economico) | 1 | 74 a 75 | 7 | 0 | 0 | 40 a 50 | 0 a 2 | 0 | 26 a 99 | 391 a 401 | 733 a 3.600 | 2.170 a 3.600 | 37.039 a 44.281 | 0 a 266 | 0 a 1.154 | 0 a 73 | 0 a 6 | 0 a 3 | 0 | dentro |
| Tranquilo 0,5× | Preguiçoso (1/dia, preguicoso) | 0,5 | 14 | 4 | 0 | 0 | 50 | 0 | 0 | 52 a 53 | 213 | 329 a 333 | 264 a 266 | 226 a 227 | 0 | 244 | 0 | 10 a 11 | 4,5 | 0 | dentro |
| Tranquilo 0,5× | Regular (2/dia, economico) | 0,5 | 53 a 54 | 6 | 0 | 0 | 40 a 50 | 0 a 4 | 0 | 40 a 52 | 529 a 541 | 12 a 1.046 | 160 a 1.007 | 259 a 945 | 0 a 20 | 0 a 116 | 0 | 0 a 1 | 0 a 1 | 0 | dentro |
| Tranquilo 0,5× | Dedicado (4/dia, economico) | 0,5 | 58 a 64 | 6 | 0 | 0 | 50 | 0 | 0 | 49 a 74 | 293 a 319 | 164 a 1.862 | 13 a 833 | 25 a 554 | 0 | 0 a 101 | 0 | 0 a 2 | 0 a 1,5 | 0 | dentro |

#### Rei de Ferro: um ano de jogo

| Ritmo | Perfil | Horas reais | População | Salão | Fome (h) | Frio (h) | Moral mínima | Moral baixa (h) | Foram embora | Fila ociosa (h) | Sem ofício (aldeão-h) | Excedente de madeira | Excedente de pedra | Excedente de ouro | Desperdício de comida | Desperdício de madeira | Desperdício de pedra | Desperdiçando (h) | Maior sequência desperdiçando (h de jogo) | Recusas | Faixa |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso (1/dia, preguicoso) | 56 | 13 | 3 | 0 | 0 | 50 | 0 | 0 | 17 | 176 | 333 | 496 a 497 | 160 | 179 | 5.143 a 5.146 | 0 | 36 | 72 | 0 | dentro |
| Rápido 3× | Regular (2/dia, economico) | 56 | 27 a 29 | 5 | 0 | 0 | 50 | 0 | 0 | 8 a 11 | 244 a 263 | 216 a 421 | 408 a 941 | 936 a 1.058 | 2.202 a 2.480 | 0 | 0 | 21 a 24 | 24 a 30 | 0 | dentro |
| Rápido 3× | Dedicado (4/dia, economico) | 56 | 46 a 54 | 6 a 7 | 0 | 0 | 50 | 0 | 0 | 7 a 26 | 226 a 268 | 34 a 2.560 | 40 a 1.808 | 3.002 a 13.323 | 81 a 507 | 0 a 6.367 | 0 a 1.432 | 2 a 13 | 6 a 18 | 0 | dentro |
| Normal 1× | Preguiçoso (1/dia, preguicoso) | 168 | 30 a 33 | 5 a 6 | 0 | 0 | 50 | 0 | 0 | 56 a 58 | 594 a 664 | 356 a 1.680 | 395 a 936 | 1.591 a 1.677 | 103 a 183 | 1.327 a 2.915 | 37 a 208 | 33 a 43 | 9 a 12 | 0 | dentro |
| Normal 1× | Regular (2/dia, economico) | 168 | 64 a 70 | 7 | 0 | 0 | 40 a 50 | 0 a 2 | 0 | 28 a 61 | 685 a 756 | 380 a 3.600 | 27 a 3.557 | 6.388 a 18.939 | 0 a 232 | 0 a 5.716 | 0 a 874 | 0 a 11 | 0 a 8 | 0 | dentro |
| Normal 1× | Dedicado (4/dia, economico) | 168 | 74 a 75 | 7 | 0 | 0 | 40 a 50 | 0 a 2 | 0 | 26 a 99 | 391 a 401 | 733 a 3.600 | 2.170 a 3.600 | 37.039 a 44.281 | 0 a 266 | 0 a 1.154 | 0 a 73 | 0 a 6 | 0 a 3 | 0 | dentro |
| Tranquilo 0,5× | Preguiçoso (1/dia, preguicoso) | 336 | 23 | 6 | 0 | 0 | 50 | 0 | 0 | 187 a 188 | 426 | 880 | 775 a 777 | 957 a 959 | 0 | 1.054 a 1.059 | 0 | 23 a 24 | 5 | 0 | dentro |
| Tranquilo 0,5× | Regular (2/dia, economico) | 336 | 74 a 75 | 7 | 0 | 0 | 40 a 50 | 0 a 77 | 0 | 80 a 203 | 745 a 759 | 1.214 a 3.599 | 2.707 a 3.600 | 38.593 a 45.910 | 0 a 186 | 0 a 1.586 | 0 a 139 | 0 a 6 | 0 a 2,5 | 0 | dentro |
| Tranquilo 0,5× | Dedicado (4/dia, economico) | 336 | 74 a 75 | 7 | 0 | 0 | 50 | 0 | 0 | 111 a 208 | 351 a 376 | 16 a 3.600 | 1.579 a 3.600 | 41.909 a 53.438 | 0 a 148 | 0 a 2.175 | 0 a 36 | 0 a 9 | 0 a 3 | 0 | dentro |

#### Rei de Ferro: meta de desperdício

| Janela | Ritmo | Perfil | Comida (h de jogo) | Madeira (h de jogo) | Pedra (h de jogo) | Meta | Veredito |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 7 dias reais | Rápido 3× | Regular | 24 a 30 | 6 a 15 | 0 a 6 | ≤ 8 | **acima** |
| 7 dias reais | Normal 1× | Regular | 0 a 4 | 0 a 8 | 0 a 6 | ≤ 8 | dentro |
| 7 dias reais | Tranquilo 0,5× | Regular | 0 a 0,5 | 0 a 1 | 0 | ≤ 8 | dentro |
| Um ano de jogo | Rápido 3× | Regular | 24 a 30 | 0 | 0 | ≤ 8 | **acima** |
| Um ano de jogo | Normal 1× | Regular | 0 a 4 | 0 a 8 | 0 a 6 | ≤ 8 | dentro |
| Um ano de jogo | Tranquilo 0,5× | Regular | 0 a 2 | 0 a 2,5 | 0 a 0,5 | ≤ 8 | dentro |

#### Rei de Ferro: linha de base

```ts
  'week/3/preguicoso': measured([33, 33], 7, 0, 0, 3120, 3120, 4612, 72),
  'week/3/regular': measured([72, 75], 7, 0, 0, 2736, 3590, 168623, 30),
  'week/3/dedicado': measured([74, 75], 7, 0, 0, 2736, 3600, 295750, 48),
  'week/1/preguicoso': measured([30, 33], 5, 0, 0, 1680, 936, 1677, 12),
  'week/1/regular': measured([64, 70], 7, 0, 0, 3600, 3557, 18939, 8),
  'week/1/dedicado': measured([74, 75], 7, 0, 0, 3600, 3600, 44281, 3),
  'week/0.5/preguicoso': measured([14, 14], 4, 0, 0, 333, 266, 227, 4.5),
  'week/0.5/regular': measured([53, 54], 6, 0, 0, 1046, 1007, 945, 1),
  'week/0.5/dedicado': measured([58, 64], 6, 0, 0, 1862, 833, 554, 1.5),
  'year/3/preguicoso': measured([13, 13], 3, 0, 0, 333, 497, 160, 72),
  'year/3/regular': measured([27, 29], 5, 0, 0, 421, 941, 1058, 30),
  'year/3/dedicado': measured([46, 54], 6, 0, 0, 2560, 1808, 13323, 18),
  'year/1/preguicoso': measured([30, 33], 5, 0, 0, 1680, 936, 1677, 12),
  'year/1/regular': measured([64, 70], 7, 0, 0, 3600, 3557, 18939, 8),
  'year/1/dedicado': measured([74, 75], 7, 0, 0, 3600, 3600, 44281, 3),
  'year/0.5/preguicoso': measured([23, 23], 6, 0, 0, 880, 777, 959, 5),
  'year/0.5/regular': measured([74, 75], 7, 0, 0, 3599, 3600, 45910, 2.5),
  'year/0.5/dedicado': measured([74, 75], 7, 0, 0, 3600, 3600, 53438, 3),
```

### 11.3 As cartas, por célula

Contado dos eventos, nas 50 sementes de Senhor:

| Janela | Ritmo | Perfil | Cartas que chegaram | Respondidas | Expiradas |
|---|---|---|---|---|---|
| 7 dias reais | Rápido 3× | Preguiçoso | 14 | 12 | 0 |
| 7 dias reais | Rápido 3× | Regular | 28 | 26 | 0 |
| 7 dias reais | Rápido 3× | Dedicado | 56 a 57 | 54 a 55 | 0 |
| 7 dias reais | Normal 1× | Preguiçoso | 14 | 12 | 0 |
| 7 dias reais | Normal 1× | Regular | 21 a 23 | 19 a 21 | 0 |
| 7 dias reais | Normal 1× | Dedicado | 21 a 25 | 20 a 24 | 0 |
| 7 dias reais | Tranquilo 0,5× | Preguiçoso | 10 | 9 | 0 |
| 7 dias reais | Tranquilo 0,5× | Regular | 10 a 14 | 9 a 13 | 0 |
| 7 dias reais | Tranquilo 0,5× | Dedicado | 10 a 14 | 10 a 14 | 0 |
| Um ano de jogo | Rápido 3× | Preguiçoso | 6 | 4 | 0 |
| Um ano de jogo | Rápido 3× | Regular | 10 | 8 | 0 |
| Um ano de jogo | Rápido 3× | Dedicado | 19 a 20 | 18 | 0 |
| Um ano de jogo | Normal 1× | Preguiçoso | 14 | 12 | 0 |
| Um ano de jogo | Normal 1× | Regular | 21 a 23 | 19 a 21 | 0 |
| Um ano de jogo | Normal 1× | Dedicado | 21 a 25 | 20 a 24 | 0 |
| Um ano de jogo | Tranquilo 0,5× | Preguiçoso | 21 | 19 | 0 |
| Um ano de jogo | Tranquilo 0,5× | Regular | 21 a 25 | 20 a 24 | 0 |
| Um ano de jogo | Tranquilo 0,5× | Dedicado | 23 a 25 | 22 a 24 | 0 |

Nenhuma carta expira em partida nenhuma: os dois bots respondem a tudo o que encontram, e as visitas são mais frequentes que o prazo de 24 h reais. A diferença entre "chegaram" e "respondidas" são as cartas que estavam na mesa quando a partida acabou. No ritmo Rápido o Regular vê 10 cartas por ano de jogo (a mesa enche entre duas visitas e a maior parte das audiências é pulada); no Normal, de 21 a 23. A cobertura por estação e por carta está em [content-v0.2.md](content-v0.2.md), seção 4.

### 11.4 O que mudou em relação à seção 10, e por quê

- **Cada semente conta outra história.** Na seção 10 as 50 sementes davam de 1 a 4 partidas diferentes por célula. Agora, no perfil Regular, são 50 partidas diferentes em 50 sementes, em todo ritmo: a carta de cada audiência muda o que o bot gasta, e o caminho de obras dele é sensível a isso. As faixas ficaram mais largas (a população do Regular no ritmo Normal vai de 64 a 72; era 69 em todas).
- **O feudo do bot que investe não ficou menor.** Senhor, 7 dias reais: Regular 72 a 74 aldeões no ritmo Rápido (eram 72), 64 a 72 no Normal (69), 51 a 54 no Tranquilo (54); Dedicado 74 a 75, 74 a 75 e 58 a 64 (eram 74, 74 e 62). O Salão chega ao mesmo nível, menos no Tranquilo, em que o Regular fecha a semana no nível 5 em parte das sementes (era 6).
- **A moral passa de 60.** Sem cartas ela ia de 0 a 60. Em um ano de jogo do Regular no ritmo Normal, 40 das 50 sementes chegam a 80 ao menos uma vez, e 18 recebem ao menos um colono atraído pela fama do feudo (de 0 a 3 por partida). No ritmo Rápido, com duas visitas, 19 e 5; com quatro, 38 e 18. A medida está em [content-v0.2.md](content-v0.2.md), seção 5.
- **O desperdício de madeira do Regular subiu no ritmo Normal.** Era de 46 a 50 unidades na semana; agora vai de 0 a 4.182, e a 11.081 em uma semente. A produção cresce com a moral, os ganhos escondidos das cartas chegam entre duas visitas, e o bot continua repartindo os braços pela conta que fez na visita. Em quase todas as sementes é menos de 3% da madeira cortada.
- **A meta de desperdício no ritmo Normal: 49 de 50.** A meta do GDD §15.2 (com 2 sessões por dia, nenhum recurso passa de 8 h de jogo seguidas indo ao chão) era cumprida nas 50 sementes de Senhor no ritmo Normal. Agora uma (`pedra-alta-047`) chega a 10 h: o Armazém sai tarde, e no outono a política `guardar lenha` manda os lenhadores juntarem a lenha do inverno com o depósito cheio. Como a célula mede a pior semente, o ritmo Normal aparece "acima" na tabela da meta. Em Rei de Ferro o pior caso desceu de 9 h para 8 h (dentro). No ritmo Rápido a pior sequência do Regular passou de 18 h para 30 h de jogo em Senhor: a madeira, não mais a comida.
- **O ouro parado continua onde estava.** Regular no ritmo Rápido, 7 dias reais: até 165.682 em Senhor (156.656 na seção 10). As cartas gastam de 30 a 50 de ouro por vez: não são sumidouro para um feudo que junta dezenas de milhares.
- **O Preguiçoso quase não mudou**, porque não gasta com carta: Senhor, 7 dias reais, 33 aldeões no ritmo Rápido (33), 30 a 33 no Normal (33), 14 no Tranquilo (14). No ritmo Normal a ordem das cartas muda de um dia a virada em que a moral ganha +5 (o sino da primavera), e três aldeões de diferença aparecem entre as sementes.

### 11.5 Faixas

`MEASURED`, em `packages/sim-cli/src/bands.ts`, passou a ser a linha de base desta rodada, nas três dificuldades; a regra da folga não mudou (10% na população, 5% nos tetos). `balance.test.ts` guarda o que mudou de propósito: a população do Regular no ritmo Normal (57 a 80 com a folga), as células que passam da meta de desperdício (o ritmo Normal entrou na lista, com a semente que o põe lá) e a comparação da madeira sem uso com a v0.1, que passou a ser pela mediana das sementes.

O teste do bot que conferia "menos de uma troca de ofício a cada dez trabalhadores por visita" passou a cobrar uma a cada quatro: com o feudo crescendo mais depressa, o limite dos depósitos chega dentro da semana também no ritmo Normal, e o bot tira dos ofícios os braços que produziriam para o chão (e os devolve quando uma obra abre espaço). É o comportamento que a seção 9.2 descreve, mais cedo.

### 11.6 O que fica para o autor

- **Aprovar as cartas**, uma a uma ([content-v0.2.md](content-v0.2.md)).
- **Custos fixos.** Uma carta custa o mesmo para um feudo de 10 e de 70 aldeões. No fim do ano as opções pagas de moral são quase sempre a melhor conta; no começo, quase nunca. Custos proporcionais pedem um efeito novo no motor.
- **O feudo sem mineiro para de crescer** (11.1): é do jogo, não das cartas, e apareceu aqui.
- **A meta de desperdício no ritmo Normal** passou a ter uma semente fora, por causa do bot (`guardar lenha` com o depósito cheio). Aceitar como variação do bot ou ensinar a política a olhar o depósito: entra em V2F-T1.
- **No ritmo Rápido o Regular vê 10 cartas por ano**, e as do outono saem em poucas partidas. É consequência do limite de 2 cartas na mesa com o prazo de 24 h reais (ADR 0014, decisões 1 e 18).

### 11.7 Limites desta medição

- O bot paga pelo preço, não pela consequência: a matriz mede a economia com o Conselho ligado, não a qualidade dos dilemas.
- Nenhuma partida da matriz deixa uma carta expirar: a expiração, nas três dificuldades, é provada pelos testes do motor (`council.chains.test.ts`, o golden de 7 dias) e pela integração.
- As outras duas dificuldades jogam 3 sementes na suíte e 50 pelo comando; com as cartas, 3 sementes já não representam as 50. A linha de base de Camponês e de Rei de Ferro é a das 50.
- A cadeia "A Promessa da Paliçada" não está no jogo: entra em V2E-T2, e a rodada seguinte muda de novo (a ordem do catálogo faz parte do sorteio).

## 12. A Torre de Vigia e a Ameaça (V2E-T1)

Tarefa V2E-T1: entrou a **Torre de Vigia** (Salão Nv2; 120 de madeira, 120 de pedra e 50 de ouro; o nível 2 custa 192, 192 e 80), os bots ganharam a política **`erguer a Torre`**, e a **Ameaça** passou a subir a cada dia de jogo. A Ameaça ainda não custa nada a ninguém: o sorteio das incursões, a incursão roteirizada e a Paliçada são das tarefas seguintes (V2E-T2 e V2E-T3). O que mexe na economia nesta rodada é a Torre, um sumidouro de 290 a 754 unidades de material, e a visita que o bot gasta com ela. A linha de base de `packages/sim-cli/src/bands.ts` foi regravada, nas três dificuldades, com o que esta rodada mediu.

| | |
|---|---|
| Data | 2026-10-02 |
| Commit | o desta tarefa (`git log --grep "V2E-T1"`), feito sobre `7aa808a` |
| Identificação | Motor 0.1.0 · estado v9 · conteúdo 7ea35d6bd45c7cda |
| Dificuldades | Camponês (`peasant`), Senhor (`lord`) e Rei de Ferro (`ironKing`) |
| Sementes | 50 fixas: `pedra-alta-001` a `pedra-alta-050` |
| Ritmos | Rápido 3×, Normal 1× e Tranquilo 0,5× |
| Máquina | Apple M5, macOS 26.6.2, Node 24.19.0 |

### 12.1 O que entrou no jogo, nos bots e no simulador

- **A Ameaça.** De 0 a 100: +5 por dia de jogo com o Covil de Lobos ativo e +3 a mais em cada dia de outono. Chega a 40 no 8º dia de jogo e a 100 no 20º, e **fica lá**: nada a faz cair antes da incursão de lobos (V2E-T3). Toda partida da matriz termina com a Ameaça em 100.
- **A Torre de Vigia.** Mostra a Ameaça (sem ela a visão diz só "ninguém sabe o que ronda o feudo") e, nos dois níveis desta versão, dará o aviso de uma incursão com 1 h e com 2 h de jogo de antecedência. Não produz nada.
- **Política `erguer a Torre` (os dois bots).** Ergue a Torre e a melhora, uma obra por visita, quando ela pode começar e **o custo cabe duas vezes** em cada recurso que pede, sem gastar a madeira da lareira. Vem antes de `obra mais barata`. O bot não usa o que a Torre mostra: ergue-a porque é o que um jogador faria ao ler o painel, e para a matriz medir quanto ela custa.
- **A Torre fica fora da corrida das obras.** `obra mais barata` e `planejar automáticas` não a tocam, e ela não conta como obra por fazer (como os depósitos): só começa com folga.
- **O simulador passou a medir** a Ameaça de cada hora (coluna `threat`, lida do estado: a visão só a mostra com a Torre), a hora em que a Torre ficou de pé (marco `watchtower`, coluna `watchtower_hour`) e a linha "Ameaça" do resumo.

Duas ordens da política foram medidas, em Senhor:

| Ordem na lista do bot | Quando a Torre fica pronta (h reais, Regular) | O que a matriz mostrou |
|---|---|---|
| Depois de `obra mais barata` e de `ampliar o estoque` | Rápido 49 a 85; Normal 61 a 109; Tranquilo 97 em diante, e nem toda semente | Com uma fila só, a Torre só começava na visita em que nenhuma outra obra podia começar e, mesmo assim, o estoque pagava o dobro do custo. O Preguiçoso do ritmo Rápido não a erguia em 7 dias reais |
| **Antes de `obra mais barata`** (a que ficou) | Rápido 49 a 61; Normal 49 a 97; Tranquilo 97 a 157, em 48 das 50 sementes | Quem a segura é a folga. O Preguiçoso a ergue na hora 73 no ritmo Rápido e entre a 97 e a 121 no Normal |

### 12.2 Comando e saída

```bash
pnpm -s sim -- --matrix > matriz-senhor.csv 2> matriz-senhor.md
pnpm -s sim -- --matrix --difficulty peasant > matriz-campones.csv 2> matriz-campones.md
pnpm -s sim -- --matrix --difficulty ironKing > matriz-rei-de-ferro.csv 2> matriz-rei-de-ferro.md
```

900 linhas no CSV em cada dificuldade. Com a linha de base nova as três saem com código 0: todas as partidas dentro das faixas da própria dificuldade, nenhuma ordem recusada, nenhuma hora de fome nem de frio, ninguém vai embora.

#### Senhor: 7 dias reais

| Ritmo | Perfil | Anos de jogo | População | Salão | Fome (h) | Frio (h) | Moral mínima | Moral baixa (h) | Foram embora | Fila ociosa (h) | Sem ofício (aldeão-h) | Excedente de madeira | Excedente de pedra | Excedente de ouro | Desperdício de comida | Desperdício de madeira | Desperdício de pedra | Desperdiçando (h) | Maior sequência desperdiçando (h de jogo) | Recusas | Faixa |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso (1/dia, preguicoso) | 3 | 33 | 7 | 0 | 0 | 50 | 0 | 0 | 102 | 672 | 3.900 | 3.900 | 4.516 a 4.518 | 14.673 a 14.679 | 27.301 a 27.320 | 12.089 a 12.096 | 131 | 75 | 0 | dentro |
| Rápido 3× | Regular (2/dia, economico) | 3 | 72 a 74 | 7 | 0 | 0 | 50 | 0 | 0 | 86 a 133 | 804 a 828 | 2.778 a 5.100 | 4.318 a 5.100 | 152.265 a 164.535 | 1.158 a 4.504 | 492 a 12.756 | 0 a 1.362 | 19 a 42 | 18 a 30 | 0 | dentro |
| Rápido 3× | Dedicado (4/dia, economico) | 3 | 74 a 75 | 7 | 0 | 0 | 50 | 0 | 0 | 35 a 117 | 413 a 420 | 1.534 a 4.951 | 2.973 a 5.100 | 271.373 a 286.950 | 0 a 406 | 0 a 6.410 | 0 a 369 | 0 a 5 | 0 a 9 | 0 | dentro |
| Normal 1× | Preguiçoso (1/dia, preguicoso) | 1 | 30 a 33 | 5 a 6 | 0 | 0 | 50 | 0 | 0 | 79 a 83 | 594 a 664 | 559 a 2.100 | 589 a 905 | 1.577 a 1.585 | 0 a 258 | 1.147 a 2.678 | 0 | 23 a 42 | 6 a 11 | 0 | dentro |
| Normal 1× | Regular (2/dia, economico) | 1 | 65 a 72 | 7 | 0 | 0 | 40 a 50 | 0 a 2 | 0 | 45 a 89 | 698 a 776 | 85 a 4.559 | 365 a 4.541 | 1.617 a 16.804 | 0 a 76 | 0 a 7.953 | 0 a 606 | 0 a 21 | 0 a 10 | 0 | dentro |
| Normal 1× | Dedicado (4/dia, economico) | 1 | 74 a 75 | 7 | 0 | 0 | 40 a 50 | 0 a 2 | 0 | 67 a 111 | 392 a 400 | 87 a 5.081 | 2.906 a 5.100 | 27.758 a 39.810 | 0 a 80 | 0 a 1.872 | 0 a 74 | 0 a 5 | 0 a 3 | 0 | dentro |
| Tranquilo 0,5× | Preguiçoso (1/dia, preguicoso) | 0,5 | 14 | 4 | 0 | 0 | 50 | 0 | 0 | 54 a 56 | 212 | 70 a 74 | 188 a 190 | 231 a 232 | 0 | 144 | 0 | 7 | 3,5 a 4 | 0 | dentro |
| Tranquilo 0,5× | Regular (2/dia, economico) | 0,5 | 51 a 54 | 5 a 6 | 0 | 0 | 40 a 50 | 0 a 4 | 0 | 61 a 79 | 504 a 540 | 7 a 2.700 | 105 a 1.918 | 6 a 1.197 | 0 | 0 a 1.180 | 0 | 0 a 6 | 0 a 2,5 | 0 | dentro |
| Tranquilo 0,5× | Dedicado (4/dia, economico) | 0,5 | 59 a 64 | 6 | 0 | 0 | 50 | 0 | 0 | 66 a 86 | 296 a 320 | 7 a 2.189 | 14 a 1.226 | 2 a 770 | 0 | 0 a 19 | 0 | 0 | 0 a 0,5 | 0 | dentro |

#### Senhor: um ano de jogo

| Ritmo | Perfil | Horas reais | População | Salão | Fome (h) | Frio (h) | Moral mínima | Moral baixa (h) | Foram embora | Fila ociosa (h) | Sem ofício (aldeão-h) | Excedente de madeira | Excedente de pedra | Excedente de ouro | Desperdício de comida | Desperdício de madeira | Desperdício de pedra | Desperdiçando (h) | Maior sequência desperdiçando (h de jogo) | Recusas | Faixa |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso (1/dia, preguicoso) | 56 | 13 | 3 | 0 | 0 | 50 | 0 | 0 | 21 | 176 | 513 | 531 a 532 | 160 | 79 | 5.091 a 5.094 | 0 | 36 | 75 | 0 | dentro |
| Rápido 3× | Regular (2/dia, economico) | 56 | 27 a 29 | 5 | 0 | 0 | 50 | 0 | 0 | 26 a 31 | 244 a 267 | 219 a 712 | 548 a 1.418 | 1.827 a 2.851 | 1.047 a 1.302 | 0 | 0 a 113 | 11 a 15 | 18 a 24 | 0 | dentro |
| Rápido 3× | Dedicado (4/dia, economico) | 56 | 52 a 55 | 6 a 7 | 0 | 0 | 50 | 0 | 0 | 16 a 33 | 261 a 278 | 94 a 2.782 | 4 a 2.031 | 443 a 13.229 | 0 a 73 | 0 a 1.874 | 0 a 105 | 0 a 3 | 0 a 9 | 0 | dentro |
| Normal 1× | Preguiçoso (1/dia, preguicoso) | 168 | 30 a 33 | 5 a 6 | 0 | 0 | 50 | 0 | 0 | 79 a 83 | 594 a 664 | 559 a 2.100 | 589 a 905 | 1.577 a 1.585 | 0 a 258 | 1.147 a 2.678 | 0 | 23 a 42 | 6 a 11 | 0 | dentro |
| Normal 1× | Regular (2/dia, economico) | 168 | 65 a 72 | 7 | 0 | 0 | 40 a 50 | 0 a 2 | 0 | 45 a 89 | 698 a 776 | 85 a 4.559 | 365 a 4.541 | 1.617 a 16.804 | 0 a 76 | 0 a 7.953 | 0 a 606 | 0 a 21 | 0 a 10 | 0 | dentro |
| Normal 1× | Dedicado (4/dia, economico) | 168 | 74 a 75 | 7 | 0 | 0 | 40 a 50 | 0 a 2 | 0 | 67 a 111 | 392 a 400 | 87 a 5.081 | 2.906 a 5.100 | 27.758 a 39.810 | 0 a 80 | 0 a 1.872 | 0 a 74 | 0 a 5 | 0 a 3 | 0 | dentro |
| Tranquilo 0,5× | Preguiçoso (1/dia, preguicoso) | 336 | 22 | 5 | 0 | 0 | 50 | 0 | 0 | 206 a 208 | 401 | 2.896 a 2.897 | 1.020 a 1.022 | 2.269 a 2.270 | 0 | 785 a 790 | 0 | 18 | 3,5 a 4 | 0 | dentro |
| Tranquilo 0,5× | Regular (2/dia, economico) | 336 | 74 a 75 | 7 | 0 | 0 | 40 a 50 | 0 a 48 | 0 | 146 a 230 | 739 a 759 | 2.443 a 4.295 | 3.714 a 5.100 | 33.541 a 40.331 | 0 a 214 | 0 a 1.965 | 0 a 239 | 0 a 9 | 0 a 2,5 | 0 | dentro |
| Tranquilo 0,5× | Dedicado (4/dia, economico) | 336 | 74 a 75 | 7 | 0 | 0 | 50 | 0 | 0 | 154 a 238 | 351 a 375 | 19 a 5.092 | 304 a 5.094 | 32.100 a 48.041 | 0 a 78 | 0 a 2.190 | 0 a 86 | 0 a 7 | 0 a 3 | 0 | dentro |

#### Senhor: progresso em 7 dias reais

| Ritmo | Perfil | Salão Nv2 (h) | Salão Nv3 (h) | Salão Nv4 (h) | Celeiro (h) | Armazém (h) | Torre de Vigia (h) | Fim das obras (h) | Obras que começaram sozinhas | População mínima |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso | 29 | 54 | 76 | 33 | 31 | 73 | — | 41 | 7 |
| Rápido 3× | Regular | 11 | 22 | 35 a 36 | 25 | 26 | 49 a 61 | 112 a 124 | 45 a 47 | 7 |
| Rápido 3× | Dedicado | 10 | 18 a 20 | 24 a 27 | 13 a 14 | 19 a 25 | 19 a 43 | 62 a 118 | 47 a 53 | 7 |
| Normal 1× | Preguiçoso | 40 | 78 a 90 | 103 a 108 | 73 | 49 | 97 a 121 | — | 30 a 34 | 7 |
| Normal 1× | Regular | 27 a 28 | 45 a 53 | 63 a 70 | 31 a 35 | 39 a 74 | 49 a 97 | 162 a — | 45 a 53 | 7 |
| Normal 1× | Dedicado | 21 a 22 | 38 a 40 | 51 a 55 | 31 a 33 | 33 a 55 | 49 a 97 | 122 a 167 | 45 a 51 | 7 |
| Tranquilo 0,5× | Preguiçoso | 54 | 106 | 143 | — | 65 | — | — | 21 | 6 |
| Tranquilo 0,5× | Regular | 41 a 42 | 75 a 79 | 103 a 108 | 61 a 87 | 87 a 110 | 97 a — | — | 30 a 35 | 6 |
| Tranquilo 0,5× | Dedicado | 35 | 66 a 71 | 94 a 98 | 104 a — | 79 a 97 | 79 a 115 | — | 35 a 40 | 6 |

#### Senhor: progresso em um ano de jogo

| Ritmo | Perfil | Salão Nv2 (h) | Salão Nv3 (h) | Salão Nv4 (h) | Celeiro (h) | Armazém (h) | Torre de Vigia (h) | Fim das obras (h) | Obras que começaram sozinhas | População mínima |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso | 29 | 54 | — | 33 | 31 | — | — | 14 | 7 |
| Rápido 3× | Regular | 11 | 22 | 35 a 36 | 25 | 26 | 49 a — | — | 29 a 30 | 7 |
| Rápido 3× | Dedicado | 10 | 18 a 20 | 24 a 27 | 13 a 14 | 19 a 25 | 19 a 43 | — | 38 a 48 | 7 |
| Normal 1× | Preguiçoso | 40 | 78 a 90 | 103 a 108 | 73 | 49 | 97 a 121 | — | 30 a 34 | 7 |
| Normal 1× | Regular | 27 a 28 | 45 a 53 | 63 a 70 | 31 a 35 | 39 a 74 | 49 a 97 | 162 a — | 45 a 53 | 7 |
| Normal 1× | Dedicado | 21 a 22 | 38 a 40 | 51 a 55 | 31 a 33 | 33 a 55 | 49 a 97 | 122 a 167 | 45 a 51 | 7 |
| Tranquilo 0,5× | Preguiçoso | 54 | 106 | 143 | — | 65 | 193 | — | 29 | 6 |
| Tranquilo 0,5× | Regular | 41 a 42 | 75 a 79 | 103 a 108 | 61 a 87 | 87 a 110 | 97 a 169 | 248 a 327 | 44 a 49 | 6 |
| Tranquilo 0,5× | Dedicado | 35 | 66 a 71 | 94 a 98 | 104 a 187 | 79 a 97 | 79 a 115 | 273 a — | 45 a 51 | 6 |

#### Senhor: meta de desperdício

| Janela | Ritmo | Perfil | Comida (h de jogo) | Madeira (h de jogo) | Pedra (h de jogo) | Meta | Veredito |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 7 dias reais | Rápido 3× | Regular | 18 a 24 | 3 a 30 | 0 a 21 | ≤ 8 | **acima** |
| 7 dias reais | Normal 1× | Regular | 0 a 3 | 0 a 10 | 0 a 8 | ≤ 8 | **acima** |
| 7 dias reais | Tranquilo 0,5× | Regular | 0 | 0 a 2,5 | 0 | ≤ 8 | dentro |
| Um ano de jogo | Rápido 3× | Regular | 18 a 24 | 0 | 0 a 3 | ≤ 8 | **acima** |
| Um ano de jogo | Normal 1× | Regular | 0 a 3 | 0 a 10 | 0 a 8 | ≤ 8 | **acima** |
| Um ano de jogo | Tranquilo 0,5× | Regular | 0 a 2,5 | 0 a 2,5 | 0 a 1 | ≤ 8 | dentro |

#### Senhor: linha de base

```ts
  'week/3/preguicoso': measured([33, 33], 7, 0, 0, 3900, 3900, 4518, 75),
  'week/3/regular': measured([72, 74], 7, 0, 0, 5100, 5100, 164535, 30),
  'week/3/dedicado': measured([74, 75], 7, 0, 0, 4951, 5100, 286950, 9),
  'week/1/preguicoso': measured([30, 33], 5, 0, 0, 2100, 905, 1585, 11),
  'week/1/regular': measured([65, 72], 7, 0, 0, 4559, 4541, 16804, 10),
  'week/1/dedicado': measured([74, 75], 7, 0, 0, 5081, 5100, 39810, 3),
  'week/0.5/preguicoso': measured([14, 14], 4, 0, 0, 74, 190, 232, 4),
  'week/0.5/regular': measured([51, 54], 5, 0, 0, 2700, 1918, 1197, 2.5),
  'week/0.5/dedicado': measured([59, 64], 6, 0, 0, 2189, 1226, 770, 0.5),
  'year/3/preguicoso': measured([13, 13], 3, 0, 0, 513, 532, 160, 75),
  'year/3/regular': measured([27, 29], 5, 0, 0, 712, 1418, 2851, 24),
  'year/3/dedicado': measured([52, 55], 6, 0, 0, 2782, 2031, 13229, 9),
  'year/1/preguicoso': measured([30, 33], 5, 0, 0, 2100, 905, 1585, 11),
  'year/1/regular': measured([65, 72], 7, 0, 0, 4559, 4541, 16804, 10),
  'year/1/dedicado': measured([74, 75], 7, 0, 0, 5081, 5100, 39810, 3),
  'year/0.5/preguicoso': measured([22, 22], 5, 0, 0, 2897, 1022, 2270, 4),
  'year/0.5/regular': measured([74, 75], 7, 0, 0, 4295, 5100, 40331, 2.5),
  'year/0.5/dedicado': measured([74, 75], 7, 0, 0, 5092, 5094, 48041, 3),
```

#### Camponês: 7 dias reais

| Ritmo | Perfil | Anos de jogo | População | Salão | Fome (h) | Frio (h) | Moral mínima | Moral baixa (h) | Foram embora | Fila ociosa (h) | Sem ofício (aldeão-h) | Excedente de madeira | Excedente de pedra | Excedente de ouro | Desperdício de comida | Desperdício de madeira | Desperdício de pedra | Desperdiçando (h) | Maior sequência desperdiçando (h de jogo) | Recusas | Faixa |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso (1/dia, preguicoso) | 3 | 33 | 7 | 0 | 0 | 50 | 0 | 0 | 106 | 672 | 4.125 | 4.125 | 4.522 a 4.524 | 13.849 a 13.856 | 28.838 a 28.856 | 12.739 a 12.745 | 129 | 72 | 0 | dentro |
| Rápido 3× | Regular (2/dia, economico) | 3 | 72 a 75 | 8 | 0 | 0 | 50 | 0 | 0 | 122 a 133 | 804 a 839 | 5.231 a 6.188 | 6.079 a 6.375 | 127.971 a 149.121 | 207 a 3.467 | 2.264 a 30.303 | 0 a 5.316 | 13 a 33 | 12 a 33 | 0 | dentro |
| Rápido 3× | Dedicado (4/dia, economico) | 3 | 84 a 85 | 8 | 0 | 0 | 50 | 0 | 0 | 54 a 122 | 472 a 480 | 2.961 a 5.835 | 3.597 a 6.375 | 294.433 a 321.285 | 42 a 171 | 0 a 20.970 | 0 a 1.555 | 1 a 16 | 3 a 15 | 0 | dentro |
| Normal 1× | Preguiçoso (1/dia, preguicoso) | 1 | 30 a 33 | 6 | 0 | 0 | 50 | 0 | 0 | 84 a 95 | 594 a 664 | 558 a 597 | 58 a 469 | 629 a 1.700 | 102 a 168 | 922 a 3.123 | 0 | 23 a 38 | 6 a 10 | 0 | dentro |
| Normal 1× | Regular (2/dia, economico) | 1 | 62 a 71 | 7 a 8 | 0 | 0 | 40 a 50 | 0 a 2 | 0 | 65 a 99 | 664 a 767 | 112 a 5.625 | 146 a 4.892 | 15 a 12.903 | 0 | 0 a 3.785 | 0 a 178 | 0 a 8 | 0 a 7 | 0 | dentro |
| Normal 1× | Dedicado (4/dia, economico) | 1 | 84 | 8 | 0 | 0 | 40 a 50 | 0 a 2 | 0 | 88 a 110 | 448 a 454 | 4.742 a 6.375 | 5.601 a 6.375 | 11.492 a 20.707 | 0 | 0 a 2.740 | 0 a 30 | 0 a 4 | 0 a 4 | 0 | dentro |
| Tranquilo 0,5× | Preguiçoso (1/dia, preguicoso) | 0,5 | 14 | 4 | 0 | 0 | 50 | 0 | 0 | 56 a 59 | 212 | 211 a 215 | 181 a 183 | 237 a 238 | 0 | 19 | 0 | 1 | 1 | 0 | dentro |
| Tranquilo 0,5× | Regular (2/dia, economico) | 0,5 | 48 a 59 | 6 | 0 | 0 | 40 a 50 | 0 a 4 | 0 | 62 a 81 | 474 a 586 | 6 a 1.520 | 157 a 1.389 | 22 a 1.229 | 0 | 0 a 626 | 0 | 0 a 3 | 0 a 1,5 | 0 | dentro |
| Tranquilo 0,5× | Dedicado (4/dia, economico) | 0,5 | 58 a 64 | 6 | 0 | 0 | 50 | 0 | 0 | 75 a 86 | 292 a 322 | 25 a 1.656 | 308 a 1.234 | 290 a 1.262 | 0 | 0 | 0 | 0 | 0 | 0 | dentro |

#### Camponês: um ano de jogo

| Ritmo | Perfil | Horas reais | População | Salão | Fome (h) | Frio (h) | Moral mínima | Moral baixa (h) | Foram embora | Fila ociosa (h) | Sem ofício (aldeão-h) | Excedente de madeira | Excedente de pedra | Excedente de ouro | Desperdício de comida | Desperdício de madeira | Desperdício de pedra | Desperdiçando (h) | Maior sequência desperdiçando (h de jogo) | Recusas | Faixa |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso (1/dia, preguicoso) | 56 | 13 | 3 | 0 | 0 | 50 | 0 | 0 | 22 | 176 | 994 | 659 a 660 | 161 | 0 | 4.866 a 4.869 | 0 | 35 | 72 | 0 | dentro |
| Rápido 3× | Regular (2/dia, economico) | 56 | 27 a 29 | 5 | 0 | 0 | 50 | 0 | 0 | 27 a 31 | 244 a 267 | 149 a 1.508 | 991 a 1.518 | 1.097 a 2.188 | 169 a 844 | 0 | 0 | 4 a 10 | 12 a 18 | 0 | dentro |
| Rápido 3× | Dedicado (4/dia, economico) | 56 | 48 a 55 | 7 | 0 | 0 | 50 | 0 | 0 | 21 a 28 | 238 a 278 | 36 a 1.993 | 371 a 2.398 | 934 a 4.959 | 42 a 151 | 0 a 311 | 0 a 112 | 1 a 3 | 3 a 6 | 0 | dentro |
| Normal 1× | Preguiçoso (1/dia, preguicoso) | 168 | 30 a 33 | 6 | 0 | 0 | 50 | 0 | 0 | 84 a 95 | 594 a 664 | 558 a 597 | 58 a 469 | 629 a 1.700 | 102 a 168 | 922 a 3.123 | 0 | 23 a 38 | 6 a 10 | 0 | dentro |
| Normal 1× | Regular (2/dia, economico) | 168 | 62 a 71 | 7 a 8 | 0 | 0 | 40 a 50 | 0 a 2 | 0 | 65 a 99 | 664 a 767 | 112 a 5.625 | 146 a 4.892 | 15 a 12.903 | 0 | 0 a 3.785 | 0 a 178 | 0 a 8 | 0 a 7 | 0 | dentro |
| Normal 1× | Dedicado (4/dia, economico) | 168 | 84 | 8 | 0 | 0 | 40 a 50 | 0 a 2 | 0 | 88 a 110 | 448 a 454 | 4.742 a 6.375 | 5.601 a 6.375 | 11.492 a 20.707 | 0 | 0 a 2.740 | 0 a 30 | 0 a 4 | 0 a 4 | 0 | dentro |
| Tranquilo 0,5× | Preguiçoso (1/dia, preguicoso) | 336 | 23 | 6 | 0 | 0 | 50 | 0 | 0 | 187 a 192 | 425 | 265 | 929 a 931 | 846 a 848 | 0 | 766 a 771 | 0 | 12 a 13 | 4,5 a 5 | 0 | dentro |
| Tranquilo 0,5× | Regular (2/dia, economico) | 336 | 84 a 85 | 8 | 0 | 0 | 40 a 50 | 0 a 4 | 0 | 192 a 231 | 851 a 865 | 5.308 a 6.375 | 5.860 a 6.375 | 16.019 a 22.275 | 0 a 239 | 0 a 2.425 | 0 a 16 | 0 a 10 | 0 a 3 | 0 | dentro |
| Tranquilo 0,5× | Dedicado (4/dia, economico) | 336 | 84 a 85 | 8 | 0 | 0 | 50 | 0 | 0 | 219 a 240 | 395 a 422 | 3.654 a 6.363 | 5.495 a 6.375 | 26.867 a 34.141 | 0 | 0 a 535 | 0 a 39 | 0 a 5 | 0 a 2 | 0 | dentro |

#### Camponês: meta de desperdício

| Janela | Ritmo | Perfil | Comida (h de jogo) | Madeira (h de jogo) | Pedra (h de jogo) | Meta | Veredito |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 7 dias reais | Rápido 3× | Regular | 12 a 21 | 6 a 33 | 0 a 27 | ≤ 8 | **acima** |
| 7 dias reais | Normal 1× | Regular | 0 | 0 a 7 | 0 a 1 | ≤ 8 | dentro |
| 7 dias reais | Tranquilo 0,5× | Regular | 0 | 0 a 1,5 | 0 | ≤ 8 | dentro |
| Um ano de jogo | Rápido 3× | Regular | 12 a 18 | 0 | 0 | ≤ 8 | **acima** |
| Um ano de jogo | Normal 1× | Regular | 0 | 0 a 7 | 0 a 1 | ≤ 8 | dentro |
| Um ano de jogo | Tranquilo 0,5× | Regular | 0 a 3 | 0 a 3 | 0 a 0,5 | ≤ 8 | dentro |

#### Camponês: linha de base

```ts
  'week/3/preguicoso': measured([33, 33], 7, 0, 0, 4125, 4125, 4524, 72),
  'week/3/regular': measured([72, 75], 8, 0, 0, 6188, 6375, 149121, 33),
  'week/3/dedicado': measured([84, 85], 8, 0, 0, 5835, 6375, 321285, 15),
  'week/1/preguicoso': measured([30, 33], 6, 0, 0, 597, 469, 1700, 10),
  'week/1/regular': measured([62, 71], 7, 0, 0, 5625, 4892, 12903, 7),
  'week/1/dedicado': measured([84, 84], 8, 0, 0, 6375, 6375, 20707, 4),
  'week/0.5/preguicoso': measured([14, 14], 4, 0, 0, 215, 183, 238, 1),
  'week/0.5/regular': measured([48, 59], 6, 0, 0, 1520, 1389, 1229, 1.5),
  'week/0.5/dedicado': measured([58, 64], 6, 0, 0, 1656, 1234, 1262, 0),
  'year/3/preguicoso': measured([13, 13], 3, 0, 0, 994, 660, 161, 72),
  'year/3/regular': measured([27, 29], 5, 0, 0, 1508, 1518, 2188, 18),
  'year/3/dedicado': measured([48, 55], 7, 0, 0, 1993, 2398, 4959, 6),
  'year/1/preguicoso': measured([30, 33], 6, 0, 0, 597, 469, 1700, 10),
  'year/1/regular': measured([62, 71], 7, 0, 0, 5625, 4892, 12903, 7),
  'year/1/dedicado': measured([84, 84], 8, 0, 0, 6375, 6375, 20707, 4),
  'year/0.5/preguicoso': measured([23, 23], 6, 0, 0, 265, 931, 848, 5),
  'year/0.5/regular': measured([84, 85], 8, 0, 0, 6375, 6375, 22275, 3),
  'year/0.5/dedicado': measured([84, 85], 8, 0, 0, 6363, 6375, 34141, 2),
```

#### Rei de Ferro: 7 dias reais

| Ritmo | Perfil | Anos de jogo | População | Salão | Fome (h) | Frio (h) | Moral mínima | Moral baixa (h) | Foram embora | Fila ociosa (h) | Sem ofício (aldeão-h) | Excedente de madeira | Excedente de pedra | Excedente de ouro | Desperdício de comida | Desperdício de madeira | Desperdício de pedra | Desperdiçando (h) | Maior sequência desperdiçando (h de jogo) | Recusas | Faixa |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso (1/dia, preguicoso) | 3 | 33 | 7 | 0 | 0 | 50 | 0 | 0 | 96 | 672 | 3.120 | 3.120 | 4.465 a 4.467 | 15.300 a 15.306 | 27.791 a 27.810 | 12.699 a 12.705 | 134 | 72 | 0 | dentro |
| Rápido 3× | Regular (2/dia, economico) | 3 | 72 a 75 | 7 | 0 | 0 | 50 | 0 | 0 | 36 a 98 | 804 a 839 | 1.289 a 2.736 | 2.623 a 3.600 | 155.914 a 166.557 | 2.698 a 7.971 | 374 a 4.067 | 0 a 190 | 31 a 44 | 24 a 30 | 0 | dentro |
| Rápido 3× | Dedicado (4/dia, economico) | 3 | 74 a 75 | 7 | 0 | 0 | 40 a 50 | 0 a 1 | 0 | 15 a 76 | 412 a 420 | 2.471 a 2.712 | 3.407 a 3.600 | 267.194 a 293.821 | 81 a 1.519 | 0 a 20.907 | 0 a 3.452 | 4 a 24 | 6 a 18 | 0 | dentro |
| Normal 1× | Preguiçoso (1/dia, preguicoso) | 1 | 30 a 33 | 5 a 6 | 0 | 0 | 50 | 0 | 0 | 77 a 81 | 594 a 664 | 131 a 1.680 | 271 a 672 | 1.536 a 1.548 | 77 a 183 | 1.431 a 2.619 | 0 a 208 | 34 a 40 | 9 a 12 | 0 | dentro |
| Normal 1× | Regular (2/dia, economico) | 1 | 64 a 72 | 7 | 0 | 0 | 40 a 50 | 0 a 2 | 0 | 38 a 98 | 685 a 776 | 133 a 3.600 | 16 a 3.568 | 3.455 a 18.599 | 0 a 232 | 0 a 5.759 | 0 a 971 | 0 a 13 | 0 a 8 | 0 | dentro |
| Normal 1× | Dedicado (4/dia, economico) | 1 | 74 a 75 | 7 | 0 | 0 | 40 a 50 | 0 a 2 | 0 | 39 a 109 | 391 a 400 | 633 a 3.552 | 2.240 a 3.600 | 34.700 a 44.474 | 0 a 305 | 0 a 1.769 | 0 a 94 | 0 a 9 | 0 a 4 | 0 | dentro |
| Tranquilo 0,5× | Preguiçoso (1/dia, preguicoso) | 0,5 | 14 | 4 | 0 | 0 | 50 | 0 | 0 | 54 a 55 | 213 | 329 a 333 | 264 a 266 | 226 a 227 | 0 | 244 | 0 | 10 a 11 | 4,5 | 0 | dentro |
| Tranquilo 0,5× | Regular (2/dia, economico) | 0,5 | 47 a 54 | 6 | 0 | 0 | 40 a 50 | 0 a 4 | 0 | 52 a 73 | 463 a 541 | 1 a 1.246 | 146 a 1.240 | 83 a 832 | 0 a 21 | 0 a 380 | 0 | 0 a 1 | 0 a 1 | 0 | dentro |
| Tranquilo 0,5× | Dedicado (4/dia, economico) | 0,5 | 57 a 64 | 6 | 0 | 0 | 50 | 0 | 0 | 61 a 82 | 288 a 319 | 46 a 2.101 | 17 a 824 | 4 a 418 | 0 | 0 a 117 | 0 | 0 a 2 | 0 a 1,5 | 0 | dentro |

#### Rei de Ferro: um ano de jogo

| Ritmo | Perfil | Horas reais | População | Salão | Fome (h) | Frio (h) | Moral mínima | Moral baixa (h) | Foram embora | Fila ociosa (h) | Sem ofício (aldeão-h) | Excedente de madeira | Excedente de pedra | Excedente de ouro | Desperdício de comida | Desperdício de madeira | Desperdício de pedra | Desperdiçando (h) | Maior sequência desperdiçando (h de jogo) | Recusas | Faixa |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso (1/dia, preguicoso) | 56 | 13 | 3 | 0 | 0 | 50 | 0 | 0 | 20 | 176 | 333 | 496 a 497 | 160 | 179 | 5.143 a 5.146 | 0 | 36 | 72 | 0 | dentro |
| Rápido 3× | Regular (2/dia, economico) | 56 | 27 a 29 | 5 | 0 | 0 | 50 | 0 | 0 | 18 a 24 | 244 a 263 | 3 a 765 | 266 a 855 | 321 a 1.863 | 2.192 a 2.470 | 0 | 0 | 21 a 24 | 24 a 30 | 0 | dentro |
| Rápido 3× | Dedicado (4/dia, economico) | 56 | 48 a 54 | 6 a 7 | 0 | 0 | 50 | 0 | 0 | 8 a 29 | 238 a 268 | 34 a 2.640 | 84 a 2.081 | 33 a 12.703 | 81 a 367 | 0 a 5.982 | 0 a 1.562 | 2 a 12 | 6 a 18 | 0 | dentro |
| Normal 1× | Preguiçoso (1/dia, preguicoso) | 168 | 30 a 33 | 5 a 6 | 0 | 0 | 50 | 0 | 0 | 77 a 81 | 594 a 664 | 131 a 1.680 | 271 a 672 | 1.536 a 1.548 | 77 a 183 | 1.431 a 2.619 | 0 a 208 | 34 a 40 | 9 a 12 | 0 | dentro |
| Normal 1× | Regular (2/dia, economico) | 168 | 64 a 72 | 7 | 0 | 0 | 40 a 50 | 0 a 2 | 0 | 38 a 98 | 685 a 776 | 133 a 3.600 | 16 a 3.568 | 3.455 a 18.599 | 0 a 232 | 0 a 5.759 | 0 a 971 | 0 a 13 | 0 a 8 | 0 | dentro |
| Normal 1× | Dedicado (4/dia, economico) | 168 | 74 a 75 | 7 | 0 | 0 | 40 a 50 | 0 a 2 | 0 | 39 a 109 | 391 a 400 | 633 a 3.552 | 2.240 a 3.600 | 34.700 a 44.474 | 0 a 305 | 0 a 1.769 | 0 a 94 | 0 a 9 | 0 a 4 | 0 | dentro |
| Tranquilo 0,5× | Preguiçoso (1/dia, preguicoso) | 336 | 22 | 6 | 0 | 0 | 50 | 0 | 0 | 191 a 192 | 402 | 446 a 451 | 1.662 a 1.667 | 797 a 799 | 0 | 860 a 861 | 368 a 371 | 30 a 31 | 5 | 0 | dentro |
| Tranquilo 0,5× | Regular (2/dia, economico) | 336 | 74 a 75 | 7 | 0 | 0 | 40 a 50 | 0 a 77 | 0 | 135 a 222 | 745 a 754 | 82 a 3.500 | 2.214 a 3.579 | 38.395 a 45.176 | 0 a 264 | 0 a 1.930 | 0 a 44 | 0 a 13 | 0 a 2 | 0 | dentro |
| Tranquilo 0,5× | Dedicado (4/dia, economico) | 336 | 74 a 75 | 7 | 0 | 0 | 50 | 0 | 0 | 124 a 227 | 346 a 377 | 162 a 3.600 | 752 a 3.600 | 40.845 a 53.238 | 0 a 159 | 0 a 2.372 | 0 a 175 | 0 a 11 | 0 a 3 | 0 | dentro |

#### Rei de Ferro: meta de desperdício

| Janela | Ritmo | Perfil | Comida (h de jogo) | Madeira (h de jogo) | Pedra (h de jogo) | Meta | Veredito |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 7 dias reais | Rápido 3× | Regular | 24 a 30 | 6 a 15 | 0 a 6 | ≤ 8 | **acima** |
| 7 dias reais | Normal 1× | Regular | 0 a 4 | 0 a 8 | 0 a 5 | ≤ 8 | dentro |
| 7 dias reais | Tranquilo 0,5× | Regular | 0 a 0,5 | 0 a 1 | 0 | ≤ 8 | dentro |
| Um ano de jogo | Rápido 3× | Regular | 24 a 30 | 0 | 0 | ≤ 8 | **acima** |
| Um ano de jogo | Normal 1× | Regular | 0 a 4 | 0 a 8 | 0 a 5 | ≤ 8 | dentro |
| Um ano de jogo | Tranquilo 0,5× | Regular | 0 a 2 | 0 a 2 | 0 a 0,5 | ≤ 8 | dentro |

#### Rei de Ferro: linha de base

```ts
  'week/3/preguicoso': measured([33, 33], 7, 0, 0, 3120, 3120, 4467, 72),
  'week/3/regular': measured([72, 75], 7, 0, 0, 2736, 3600, 166557, 30),
  'week/3/dedicado': measured([74, 75], 7, 0, 0, 2712, 3600, 293821, 18),
  'week/1/preguicoso': measured([30, 33], 5, 0, 0, 1680, 672, 1548, 12),
  'week/1/regular': measured([64, 72], 7, 0, 0, 3600, 3568, 18599, 8),
  'week/1/dedicado': measured([74, 75], 7, 0, 0, 3552, 3600, 44474, 4),
  'week/0.5/preguicoso': measured([14, 14], 4, 0, 0, 333, 266, 227, 4.5),
  'week/0.5/regular': measured([47, 54], 6, 0, 0, 1246, 1240, 832, 1),
  'week/0.5/dedicado': measured([57, 64], 6, 0, 0, 2101, 824, 418, 1.5),
  'year/3/preguicoso': measured([13, 13], 3, 0, 0, 333, 497, 160, 72),
  'year/3/regular': measured([27, 29], 5, 0, 0, 765, 855, 1863, 30),
  'year/3/dedicado': measured([48, 54], 6, 0, 0, 2640, 2081, 12703, 18),
  'year/1/preguicoso': measured([30, 33], 5, 0, 0, 1680, 672, 1548, 12),
  'year/1/regular': measured([64, 72], 7, 0, 0, 3600, 3568, 18599, 8),
  'year/1/dedicado': measured([74, 75], 7, 0, 0, 3552, 3600, 44474, 4),
  'year/0.5/preguicoso': measured([22, 22], 6, 0, 0, 451, 1667, 799, 5),
  'year/0.5/regular': measured([74, 75], 7, 0, 0, 3500, 3579, 45176, 2),
  'year/0.5/dedicado': measured([74, 75], 7, 0, 0, 3600, 3600, 53238, 3),
```

### 12.3 O que mudou em relação à seção 11, e por quê

- **A Torre chega tarde para quem só a ergue com folga.** Senhor, Regular, em 7 dias reais: pronta entre as horas 49 e 61 no ritmo Rápido, 49 e 97 no Normal e, em 48 das 50 sementes, entre a 97 e a 157 no Tranquilo. O Preguiçoso a ergue na hora 73 no Rápido e entre a 97 e a 121 no Normal; no Tranquilo, só na hora 193 (fora dos 7 dias reais). No ano de jogo do ritmo Rápido (56 h reais) só 17 das 50 sementes do Regular de Senhor chegam a ela, e nenhuma do Preguiçoso. Em Camponês e em Rei de Ferro o Regular do ritmo Rápido a ergue mais cedo e em todas as sementes (hora 49 e hora 37); nos outros ritmos as horas são as de Senhor, com poucas horas de diferença.
- **A incursão roteirizada vem antes.** Ela é do início do 16º dia de jogo (30 h de jogo: 10 h reais no Rápido, 30 no Normal, 60 no Tranquilo). O Salão Nv2, que libera a Torre, sai na hora 11 no Rápido, na 27 ou 28 no Normal e na 41 ou 42 no Tranquilo, para o Regular. **Nenhum bot tem a Torre antes dos primeiros lobos, em nenhum ritmo**, e no Rápido nem o Salão Nv2 chega antes deles. Um jogador que corre para ela chega: `threat.test.ts` joga um feudo novo com as duas obras planejadas como automáticas (o Salão e a Torre), um lavrador, dois lenhadores e dois canteiros, e a Torre fica pronta no 8º dia de jogo, sem fome, a tempo de os vigias contarem a Ameaça chegando aos 40.
- **O Preguiçoso perde um nível do Salão.** Senhor, ritmo Normal: fecha a semana com o Salão entre os níveis 5 e 6 (era 6 em todas as sementes); no ano de jogo do Tranquilo, com 22 aldeões e o Salão no 5 (eram 23 e 6). Ele visita uma vez por dia, e a Torre leva 290 de material: é a única mudança entre as duas rodadas. Em Rei de Ferro, no Tranquilo, perde um aldeão (22; eram 23) e mantém o Salão; em Camponês não muda.
- **O Regular e o Dedicado quase não mudam.** Senhor, 7 dias reais: Regular 72 a 74 aldeões no Rápido (72 a 74), 65 a 72 no Normal (64 a 72), 51 a 54 no Tranquilo (51 a 54); Dedicado 74 a 75, 74 a 75 e 59 a 64 (58 a 64). O Salão chega ao mesmo nível. Em Camponês e em Rei de Ferro, no Tranquilo, a menor população do Regular entre as sementes cai de 54 para 48 e de 53 para 47; a maior não muda (59 e 54). A causa não foi investigada semente a semente.
- **O ouro parado mal se mexe.** Regular no ritmo Rápido, 7 dias reais: até 164.535 (165.682 na seção 11). A Torre leva 130 de ouro ao todo: não é sumidouro para um feudo que junta dezenas de milhares.
- **A sequência desperdiçando do Dedicado caiu** no ritmo Rápido, em Senhor: de 21 para 9 h de jogo na semana e de 18 para 9 no ano. No Regular ficou em 30. A causa não foi investigada: o caminho de obras do bot muda com qualquer gasto, como na seção 11.
- **A meta de desperdício no ritmo Normal: 47 de 50.** Eram 49. As três sementes fora (017, 034 e 046) têm de 9 a 10 h de jogo seguidas de madeira indo ao chão, todas com o Armazém pronto só da hora 61 em diante. É o mesmo caminho do bot descrito na seção 11.4; a Torre mudou em que sementes ele aparece. O teto da célula continua em 10 h.
- **O bot troca mais gente de ofício.** Na partida do teste do bot (`bots.test.ts`, uma semente, 14 visitas): no ritmo Normal, 122 trocas em 461 trabalhadores-visita (109 com a mesma lista de políticas sem `erguer a Torre`); no Rápido, 58 em 486 (44). São as trocas grandes de quando as obras rareiam, em visitas diferentes.

### 12.4 Faixas

`MEASURED`, em `packages/sim-cli/src/bands.ts`, passou a ser a linha de base desta rodada, nas três dificuldades; a regra da folga não mudou. `balance.test.ts` guarda o que mudou de propósito: a população do Regular no ritmo Normal (58 a 80 com a folga), as três sementes que passam da meta de desperdício e, em um teste novo, a hora em que cada perfil ergue a Torre. O marco `watchtower` ficou fora do teste dos desbloqueios da Fase C, que exige todo marco dentro de um ano de jogo: no ritmo Rápido o Regular não chega à Torre em 33 das 50 sementes.

O teste do bot que cobrava menos de uma troca de ofício a cada quatro trabalhadores por visita passou a cobrar três a cada dez.

### 12.5 O que fica para o autor

- **A Torre e os primeiros lobos.** A incursão do 16º dia chega antes da Torre para quem joga como o bot. Se a intenção é que o jogador atento receba o primeiro aviso, o objetivo 5 ("Construa a Torre de Vigia", V2E-T4) precisa aparecer cedo e convencer; se a intenção é que a primeira incursão seja sofrida no escuro e ensine, está como está. Entra em V2E-T3 e V2F-T1.
- **A folga do bot** (o dobro do custo em estoque) é uma escolha desta tarefa. Com menos folga a Torre sai mais cedo e custa mais ao Salão; a matriz mede as duas coisas.
- **A Ameaça chega a 100 no 20º dia de jogo** e fica lá até a incursão de lobos trazer a queda. Com +5 por dia e −10 por incursão, o equilíbrio de V2E-T3 fica perto do máximo: é assunto do balanceamento daquela tarefa.
- **O Preguiçoso paga a Torre com um nível do Salão.** Para quem visita uma vez por dia, a Torre é uma decisão de verdade.

### 12.6 Limites desta medição

- A matriz mede o custo da Torre, não o valor dela: nada ataca o feudo ainda, e o bot não usa o que ela mostra.
- A coluna `threat` é lida do estado: é o mundo, não o que o jogador vê. Sem Torre, o jogador não vê nada.
- As outras duas dificuldades jogam 3 sementes na suíte e 50 pelo comando; a linha de base de Camponês e de Rei de Ferro é a das 50.
- As três tarefas seguintes (a Paliçada, a incursão de lobos e os objetivos 5 a 10) mexem na economia de novo, e a cadeia "A Promessa da Paliçada" muda a ordem do sorteio das cartas: a linha de base desta seção dura até a próxima.

## 13. A Paliçada e a cadeia "A Promessa da Paliçada" (V2E-T2)

Tarefa V2E-T2: entrou a **Paliçada** (Salão Nv3; 200 de madeira e 50 de pedra; o nível 2 custa 320 e 80) e, no Conselho, as três cartas da cadeia **"A Promessa da Paliçada"**, com o pedido dos aldeões no sorteio de quem tem o Salão no nível 3. **Os bots ainda não erguem a Paliçada e nunca prometem**: a política dela entra com a incursão de lobos (V2E-T3), que é quando ela passa a render. O que mexe na economia nesta rodada é só o sorteio: uma carta a mais, de peso 3, na frente das avulsas, muda as cartas que cada semente tira do Salão Nv3 em diante, e com elas o caminho de obras do bot econômico. A linha de base de `packages/sim-cli/src/bands.ts` foi regravada, nas três dificuldades, com o que esta rodada mediu.

| | |
|---|---|
| Data | 2026-10-02 |
| Commit | o desta tarefa (`git log --grep "V2E-T2"`), feito sobre `ed84a24` |
| Identificação | Motor 0.1.0 · estado v10 · conteúdo 2f8434b06481af37 |
| Dificuldades | Camponês (`peasant`), Senhor (`lord`) e Rei de Ferro (`ironKing`) |
| Sementes | 50 fixas: `pedra-alta-001` a `pedra-alta-050` |
| Ritmos | Rápido 3×, Normal 1× e Tranquilo 0,5× |
| Máquina | Apple M5, macOS 26.6.2, Node 24.19.0 |

### 13.1 O que entrou no jogo, e o que os bots fazem com isso

- **A Paliçada.** Nasce no nível 0, pede o Salão no nível 3 e vai até o nível 2. Não produz nada, nada a danifica e ela não mexe na Ameaça: o nível 1 segura as incursões leves e corta pela metade o estrago de uma média; o nível 2 segura as duas. Nada marca incursões ainda (V2E-T3): nesta rodada ela só custaria.
- **Os bots a deixam de lado.** `obra mais barata` e `planejar automáticas` não a tocam (como a Torre e os depósitos que ninguém pediu), e ela não conta como obra por fazer: o "fim das obras" não espera por ela. Não há política "erguer a Paliçada": entra em V2E-T3, com a Ameaça conhecida acima de 40.
- **A cadeia de cartas.** "Os aldeões pedem uma cerca" entra no sorteio com o Salão no nível 3, em toda estação, uma vez por ano. A carta não tem opção paga (a de mostrar a obra fica trancada sem a Paliçada), e os bots ficam com a primeira opção sem custo: **explicar que não é hora**. As duas continuações nunca chegam em partida nenhuma da matriz. O que a cadeia faz por quem promete está nos testes do motor e da API, não aqui.
- **A fila ociosa passou a contar a Paliçada.** A medida é "há uma obra que podia começar agora". Do Salão Nv3 em diante a Paliçada é essa obra sempre que o estoque a paga, e os bots não a iniciam: a fila ociosa sobe em toda célula (tabelas abaixo) sem que o feudo esteja parado. A medida volta a dizer o que dizia quando o bot ganhar a política.

### 13.2 Comando e saída

```bash
pnpm -s sim -- --matrix > matriz-senhor.csv 2> matriz-senhor.md
pnpm -s sim -- --matrix --difficulty peasant > matriz-campones.csv 2> matriz-campones.md
pnpm -s sim -- --matrix --difficulty ironKing > matriz-rei-de-ferro.csv 2> matriz-rei-de-ferro.md
```

900 linhas no CSV em cada dificuldade. Com a linha de base nova as três saem com código 0: todas as partidas dentro das faixas da própria dificuldade, nenhuma ordem recusada, nenhuma hora de fome nem de frio, ninguém vai embora. Antes de regravar a linha de base, três células de Senhor saíam da faixa da seção 12 (a sequência desperdiçando do Dedicado no ritmo Rápido, nas duas janelas, e a madeira parada do Regular no ano do Tranquilo), quatro de Camponês e três de Rei de Ferro, todas por margens pequenas: são as partidas que tiraram outras cartas.

#### Senhor: 7 dias reais

| Ritmo | Perfil | Anos de jogo | População | Salão | Fome (h) | Frio (h) | Moral mínima | Moral baixa (h) | Foram embora | Fila ociosa (h) | Sem ofício (aldeão-h) | Excedente de madeira | Excedente de pedra | Excedente de ouro | Desperdício de comida | Desperdício de madeira | Desperdício de pedra | Desperdiçando (h) | Maior sequência desperdiçando (h de jogo) | Recusas | Faixa |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso (1/dia, preguicoso) | 3 | 33 | 7 | 0 | 0 | 50 | 0 | 0 | 121 | 672 | 3.900 | 3.900 | 4.516 a 4.518 | 14.673 a 14.679 | 27.301 a 27.320 | 12.089 a 12.096 | 131 | 75 | 0 | dentro |
| Rápido 3× | Regular (2/dia, economico) | 3 | 72 a 74 | 7 | 0 | 0 | 50 | 0 | 0 | 133 a 141 | 804 a 828 | 3.433 a 4.702 | 4.625 a 5.100 | 153.508 a 163.202 | 1.173 a 4.514 | 223 a 8.260 | 0 a 994 | 13 a 40 | 18 a 27 | 0 | dentro |
| Rápido 3× | Dedicado (4/dia, economico) | 3 | 74 a 75 | 7 | 0 | 0 | 50 | 0 | 0 | 136 a 149 | 412 a 420 | 1.466 a 4.257 | 2.953 a 5.100 | 268.544 a 286.161 | 0 a 666 | 0 a 5.622 | 0 a 799 | 0 a 7 | 0 a 15 | 0 | dentro |
| Normal 1× | Preguiçoso (1/dia, preguicoso) | 1 | 30 a 33 | 5 a 6 | 0 | 0 | 50 | 0 | 0 | 84 a 96 | 594 a 664 | 559 a 2.100 | 589 a 905 | 1.577 a 1.585 | 0 a 258 | 1.147 a 2.678 | 0 | 23 a 42 | 6 a 11 | 0 | dentro |
| Normal 1× | Regular (2/dia, economico) | 1 | 65 a 72 | 7 | 0 | 0 | 40 a 50 | 0 a 2 | 0 | 91 a 110 | 698 a 776 | 34 a 4.500 | 28 a 4.498 | 1.304 a 16.276 | 0 a 76 | 0 a 6.863 | 0 a 78 | 0 a 16 | 0 a 10 | 0 | dentro |
| Normal 1× | Dedicado (4/dia, economico) | 1 | 74 a 75 | 7 | 0 | 0 | 40 a 50 | 0 a 2 | 0 | 106 a 123 | 392 a 401 | 136 a 5.100 | 2.919 a 5.100 | 27.900 a 40.346 | 0 a 219 | 0 a 2.165 | 0 a 72 | 0 a 7 | 0 a 3 | 0 | dentro |
| Tranquilo 0,5× | Preguiçoso (1/dia, preguicoso) | 0,5 | 14 | 4 | 0 | 0 | 50 | 0 | 0 | 57 a 59 | 212 | 70 a 74 | 188 a 190 | 231 a 232 | 0 | 144 | 0 | 7 | 3,5 a 4 | 0 | dentro |
| Tranquilo 0,5× | Regular (2/dia, economico) | 0,5 | 50 a 54 | 5 a 6 | 0 | 0 | 40 a 50 | 0 a 4 | 0 | 65 a 79 | 495 a 539 | 32 a 2.700 | 184 a 1.820 | 43 a 985 | 0 | 0 a 879 | 0 | 0 a 5 | 0 a 2,5 | 0 | dentro |
| Tranquilo 0,5× | Dedicado (4/dia, economico) | 0,5 | 56 a 64 | 6 | 0 | 0 | 50 | 0 | 0 | 75 a 87 | 283 a 320 | 32 a 1.841 | 23 a 1.161 | 2 a 710 | 0 | 0 | 0 | 0 | 0 | 0 | dentro |

#### Senhor: um ano de jogo

| Ritmo | Perfil | Horas reais | População | Salão | Fome (h) | Frio (h) | Moral mínima | Moral baixa (h) | Foram embora | Fila ociosa (h) | Sem ofício (aldeão-h) | Excedente de madeira | Excedente de pedra | Excedente de ouro | Desperdício de comida | Desperdício de madeira | Desperdício de pedra | Desperdiçando (h) | Maior sequência desperdiçando (h de jogo) | Recusas | Faixa |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso (1/dia, preguicoso) | 56 | 13 | 3 | 0 | 0 | 50 | 0 | 0 | 21 | 176 | 513 | 531 a 532 | 160 | 79 | 5.091 a 5.094 | 0 | 36 | 75 | 0 | dentro |
| Rápido 3× | Regular (2/dia, economico) | 56 | 27 | 5 | 0 | 0 | 50 | 0 | 0 | 27 a 31 | 244 | 257 a 689 | 573 a 1.338 | 1.824 a 2.860 | 1.114 a 1.297 | 0 | 0 a 95 | 12 a 15 | 18 a 24 | 0 | dentro |
| Rápido 3× | Dedicado (4/dia, economico) | 56 | 52 a 54 | 6 a 7 | 0 | 0 | 50 | 0 | 0 | 25 a 37 | 262 a 273 | 114 a 2.817 | 81 a 2.342 | 468 a 14.273 | 0 a 42 | 0 a 4.612 | 0 a 799 | 0 a 5 | 0 a 15 | 0 | dentro |
| Normal 1× | Preguiçoso (1/dia, preguicoso) | 168 | 30 a 33 | 5 a 6 | 0 | 0 | 50 | 0 | 0 | 84 a 96 | 594 a 664 | 559 a 2.100 | 589 a 905 | 1.577 a 1.585 | 0 a 258 | 1.147 a 2.678 | 0 | 23 a 42 | 6 a 11 | 0 | dentro |
| Normal 1× | Regular (2/dia, economico) | 168 | 65 a 72 | 7 | 0 | 0 | 40 a 50 | 0 a 2 | 0 | 91 a 110 | 698 a 776 | 34 a 4.500 | 28 a 4.498 | 1.304 a 16.276 | 0 a 76 | 0 a 6.863 | 0 a 78 | 0 a 16 | 0 a 10 | 0 | dentro |
| Normal 1× | Dedicado (4/dia, economico) | 168 | 74 a 75 | 7 | 0 | 0 | 40 a 50 | 0 a 2 | 0 | 106 a 123 | 392 a 401 | 136 a 5.100 | 2.919 a 5.100 | 27.900 a 40.346 | 0 a 219 | 0 a 2.165 | 0 a 72 | 0 a 7 | 0 a 3 | 0 | dentro |
| Tranquilo 0,5× | Preguiçoso (1/dia, preguicoso) | 336 | 22 | 5 | 0 | 0 | 50 | 0 | 0 | 212 a 214 | 401 | 2.896 a 2.897 | 1.020 a 1.022 | 2.269 a 2.270 | 0 | 785 a 790 | 0 | 18 | 3,5 a 4 | 0 | dentro |
| Tranquilo 0,5× | Regular (2/dia, economico) | 336 | 74 a 75 | 7 | 0 | 0 | 40 a 50 | 0 a 4 | 0 | 228 a 241 | 740 a 760 | 1.479 a 4.887 | 3.737 a 5.099 | 35.096 a 40.290 | 0 a 315 | 0 a 1.691 | 0 a 328 | 0 a 11 | 0 a 2,5 | 0 | dentro |
| Tranquilo 0,5× | Dedicado (4/dia, economico) | 336 | 74 a 75 | 7 | 0 | 0 | 40 a 50 | 0 a 8 | 0 | 228 a 252 | 352 a 375 | 19 a 5.099 | 276 a 5.100 | 32.177 a 47.431 | 0 a 122 | 0 a 2.513 | 0 a 43 | 0 a 7 | 0 a 3 | 0 | dentro |

#### Senhor: progresso em 7 dias reais

| Ritmo | Perfil | Salão Nv2 (h) | Salão Nv3 (h) | Salão Nv4 (h) | Celeiro (h) | Armazém (h) | Torre de Vigia (h) | Fim das obras (h) | Obras que começaram sozinhas | População mínima |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso | 29 | 54 | 76 | 33 | 31 | 73 | — | 41 | 7 |
| Rápido 3× | Regular | 11 | 22 | 35 a 36 | 25 | 26 | 49 a 61 | 112 a 123 | 44 a 48 | 7 |
| Rápido 3× | Dedicado | 10 | 18 a 20 | 24 a 27 | 13 a 14 | 19 a 25 | 19 a 43 | 62 a 140 | 47 a 52 | 7 |
| Normal 1× | Preguiçoso | 40 | 78 a 90 | 103 a 108 | 73 | 49 | 97 a 121 | — | 30 a 34 | 7 |
| Normal 1× | Regular | 27 a 28 | 45 a 53 | 63 a 70 | 31 a 35 | 39 a 74 | 49 a 109 | 162 a — | 45 a 52 | 7 |
| Normal 1× | Dedicado | 21 a 22 | 38 a 40 | 51 a 55 | 31 a 33 | 33 a 55 | 49 a 85 | 122 a 167 | 44 a 51 | 7 |
| Tranquilo 0,5× | Preguiçoso | 54 | 106 | 143 | — | 65 | — | — | 21 | 6 |
| Tranquilo 0,5× | Regular | 41 a 42 | 75 a 79 | 103 a 108 | 61 a 87 | 87 a 110 | 97 a — | — | 29 a 36 | 6 |
| Tranquilo 0,5× | Dedicado | 35 | 66 a 71 | 93 a 98 | 127 a — | 79 a 98 | 79 a 109 | — | 35 a 39 | 6 |

#### Senhor: progresso em um ano de jogo

| Ritmo | Perfil | Salão Nv2 (h) | Salão Nv3 (h) | Salão Nv4 (h) | Celeiro (h) | Armazém (h) | Torre de Vigia (h) | Fim das obras (h) | Obras que começaram sozinhas | População mínima |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso | 29 | 54 | — | 33 | 31 | — | — | 14 | 7 |
| Rápido 3× | Regular | 11 | 22 | 35 a 36 | 25 | 26 | 49 a — | — | 29 a 30 | 7 |
| Rápido 3× | Dedicado | 10 | 18 a 20 | 24 a 27 | 13 a 14 | 19 a 25 | 19 a 43 | — | 38 a 46 | 7 |
| Normal 1× | Preguiçoso | 40 | 78 a 90 | 103 a 108 | 73 | 49 | 97 a 121 | — | 30 a 34 | 7 |
| Normal 1× | Regular | 27 a 28 | 45 a 53 | 63 a 70 | 31 a 35 | 39 a 74 | 49 a 109 | 162 a — | 45 a 52 | 7 |
| Normal 1× | Dedicado | 21 a 22 | 38 a 40 | 51 a 55 | 31 a 33 | 33 a 55 | 49 a 85 | 122 a 167 | 44 a 51 | 7 |
| Tranquilo 0,5× | Preguiçoso | 54 | 106 | 143 | — | 65 | 193 | — | 29 | 6 |
| Tranquilo 0,5× | Regular | 41 a 42 | 75 a 79 | 103 a 108 | 61 a 87 | 87 a 110 | 97 a 169 | 247 a 330 | 44 a 49 | 6 |
| Tranquilo 0,5× | Dedicado | 35 | 66 a 71 | 93 a 98 | 127 a 193 | 79 a 98 | 79 a 109 | 272 a — | 44 a 50 | 6 |

#### Senhor: meta de desperdício

| Janela | Ritmo | Perfil | Comida (h de jogo) | Madeira (h de jogo) | Pedra (h de jogo) | Meta | Veredito |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 7 dias reais | Rápido 3× | Regular | 18 a 24 | 3 a 27 | 0 a 15 | ≤ 8 | **acima** |
| 7 dias reais | Normal 1× | Regular | 0 a 3 | 0 a 10 | 0 a 2 | ≤ 8 | **acima** |
| 7 dias reais | Tranquilo 0,5× | Regular | 0 | 0 a 2,5 | 0 | ≤ 8 | dentro |
| Um ano de jogo | Rápido 3× | Regular | 18 a 24 | 0 | 0 a 3 | ≤ 8 | **acima** |
| Um ano de jogo | Normal 1× | Regular | 0 a 3 | 0 a 10 | 0 a 2 | ≤ 8 | **acima** |
| Um ano de jogo | Tranquilo 0,5× | Regular | 0 a 2,5 | 0 a 2,5 | 0 a 1,5 | ≤ 8 | dentro |

#### Senhor: linha de base

```ts
  'week/3/preguicoso': measured([33, 33], 7, 0, 0, 3900, 3900, 4518, 75),
  'week/3/regular': measured([72, 74], 7, 0, 0, 4702, 5100, 163202, 27),
  'week/3/dedicado': measured([74, 75], 7, 0, 0, 4257, 5100, 286161, 15),
  'week/1/preguicoso': measured([30, 33], 5, 0, 0, 2100, 905, 1585, 11),
  'week/1/regular': measured([65, 72], 7, 0, 0, 4500, 4498, 16276, 10),
  'week/1/dedicado': measured([74, 75], 7, 0, 0, 5100, 5100, 40346, 3),
  'week/0.5/preguicoso': measured([14, 14], 4, 0, 0, 74, 190, 232, 4),
  'week/0.5/regular': measured([50, 54], 5, 0, 0, 2700, 1820, 985, 2.5),
  'week/0.5/dedicado': measured([56, 64], 6, 0, 0, 1841, 1161, 710, 0),
  'year/3/preguicoso': measured([13, 13], 3, 0, 0, 513, 532, 160, 75),
  'year/3/regular': measured([27, 27], 5, 0, 0, 689, 1338, 2860, 24),
  'year/3/dedicado': measured([52, 54], 6, 0, 0, 2817, 2342, 14273, 15),
  'year/1/preguicoso': measured([30, 33], 5, 0, 0, 2100, 905, 1585, 11),
  'year/1/regular': measured([65, 72], 7, 0, 0, 4500, 4498, 16276, 10),
  'year/1/dedicado': measured([74, 75], 7, 0, 0, 5100, 5100, 40346, 3),
  'year/0.5/preguicoso': measured([22, 22], 5, 0, 0, 2897, 1022, 2270, 4),
  'year/0.5/regular': measured([74, 75], 7, 0, 0, 4887, 5099, 40290, 2.5),
  'year/0.5/dedicado': measured([74, 75], 7, 0, 0, 5099, 5100, 47431, 3),
```

#### Camponês: 7 dias reais

| Ritmo | Perfil | Anos de jogo | População | Salão | Fome (h) | Frio (h) | Moral mínima | Moral baixa (h) | Foram embora | Fila ociosa (h) | Sem ofício (aldeão-h) | Excedente de madeira | Excedente de pedra | Excedente de ouro | Desperdício de comida | Desperdício de madeira | Desperdício de pedra | Desperdiçando (h) | Maior sequência desperdiçando (h de jogo) | Recusas | Faixa |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso (1/dia, preguicoso) | 3 | 33 | 7 | 0 | 0 | 50 | 0 | 0 | 125 a 126 | 672 | 4.125 | 4.125 | 4.522 a 4.524 | 13.849 a 13.856 | 28.838 a 28.856 | 12.739 a 12.745 | 129 | 72 | 0 | dentro |
| Rápido 3× | Regular (2/dia, economico) | 3 | 72 a 75 | 8 | 0 | 0 | 50 | 0 | 0 | 133 a 142 | 804 a 839 | 4.944 a 6.204 | 6.167 a 6.375 | 128.179 a 152.661 | 223 a 3.423 | 1.705 a 27.793 | 0 a 6.914 | 11 a 33 | 12 a 30 | 0 | dentro |
| Rápido 3× | Dedicado (4/dia, economico) | 3 | 84 a 85 | 8 | 0 | 0 | 50 | 0 | 0 | 139 a 149 | 472 a 480 | 2.468 a 6.165 | 4.228 a 6.375 | 296.056 a 319.793 | 49 a 161 | 0 a 21.020 | 0 a 3.775 | 2 a 15 | 3 a 15 | 0 | dentro |
| Normal 1× | Preguiçoso (1/dia, preguicoso) | 1 | 30 a 33 | 6 | 0 | 0 | 50 | 0 | 0 | 95 a 98 | 594 a 664 | 558 a 597 | 58 a 469 | 629 a 1.700 | 102 a 168 | 922 a 3.123 | 0 | 23 a 38 | 6 a 10 | 0 | dentro |
| Normal 1× | Regular (2/dia, economico) | 1 | 56 a 72 | 7 a 8 | 0 | 0 | 40 a 50 | 0 a 2 | 0 | 94 a 108 | 596 a 776 | 35 a 4.915 | 339 a 4.944 | 231 a 13.686 | 0 a 103 | 0 a 3.869 | 0 | 0 a 7 | 0 a 6 | 0 | dentro |
| Normal 1× | Dedicado (4/dia, economico) | 1 | 84 | 8 | 0 | 0 | 40 a 50 | 0 a 2 | 0 | 107 a 123 | 446 a 452 | 5.223 a 6.375 | 5.840 a 6.375 | 11.806 a 21.732 | 0 a 57 | 0 a 2.618 | 0 a 46 | 0 a 4 | 0 a 4 | 0 | dentro |
| Tranquilo 0,5× | Preguiçoso (1/dia, preguicoso) | 0,5 | 14 | 4 | 0 | 0 | 50 | 0 | 0 | 61 a 64 | 212 | 211 a 215 | 181 a 183 | 237 a 238 | 0 | 19 | 0 | 1 | 1 | 0 | dentro |
| Tranquilo 0,5× | Regular (2/dia, economico) | 0,5 | 52 a 59 | 6 | 0 | 0 | 40 a 50 | 0 a 4 | 0 | 65 a 83 | 515 a 587 | 3 a 1.380 | 392 a 1.240 | 105 a 1.073 | 0 | 0 a 414 | 0 | 0 a 3 | 0 a 1,5 | 0 | dentro |
| Tranquilo 0,5× | Dedicado (4/dia, economico) | 0,5 | 56 a 64 | 6 | 0 | 0 | 50 | 0 | 0 | 75 a 87 | 283 a 321 | 48 a 1.398 | 285 a 1.175 | 333 a 1.168 | 0 | 0 | 0 | 0 | 0 | 0 | dentro |

#### Camponês: um ano de jogo

| Ritmo | Perfil | Horas reais | População | Salão | Fome (h) | Frio (h) | Moral mínima | Moral baixa (h) | Foram embora | Fila ociosa (h) | Sem ofício (aldeão-h) | Excedente de madeira | Excedente de pedra | Excedente de ouro | Desperdício de comida | Desperdício de madeira | Desperdício de pedra | Desperdiçando (h) | Maior sequência desperdiçando (h de jogo) | Recusas | Faixa |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso (1/dia, preguicoso) | 56 | 13 | 3 | 0 | 0 | 50 | 0 | 0 | 22 | 176 | 994 | 659 a 660 | 161 | 0 | 4.866 a 4.869 | 0 | 35 | 72 | 0 | dentro |
| Rápido 3× | Regular (2/dia, economico) | 56 | 27 | 5 | 0 | 0 | 50 | 0 | 0 | 27 a 32 | 244 | 111 a 1.504 | 1.006 a 1.544 | 1.104 a 2.172 | 169 a 844 | 0 | 0 | 4 a 10 | 12 a 18 | 0 | dentro |
| Rápido 3× | Dedicado (4/dia, economico) | 56 | 48 a 55 | 7 | 0 | 0 | 50 | 0 | 0 | 27 a 38 | 238 a 278 | 81 a 1.989 | 931 a 3.108 | 957 a 6.092 | 42 a 129 | 0 a 513 | 0 a 112 | 1 a 3 | 3 a 6 | 0 | dentro |
| Normal 1× | Preguiçoso (1/dia, preguicoso) | 168 | 30 a 33 | 6 | 0 | 0 | 50 | 0 | 0 | 95 a 98 | 594 a 664 | 558 a 597 | 58 a 469 | 629 a 1.700 | 102 a 168 | 922 a 3.123 | 0 | 23 a 38 | 6 a 10 | 0 | dentro |
| Normal 1× | Regular (2/dia, economico) | 168 | 56 a 72 | 7 a 8 | 0 | 0 | 40 a 50 | 0 a 2 | 0 | 94 a 108 | 596 a 776 | 35 a 4.915 | 339 a 4.944 | 231 a 13.686 | 0 a 103 | 0 a 3.869 | 0 | 0 a 7 | 0 a 6 | 0 | dentro |
| Normal 1× | Dedicado (4/dia, economico) | 168 | 84 | 8 | 0 | 0 | 40 a 50 | 0 a 2 | 0 | 107 a 123 | 446 a 452 | 5.223 a 6.375 | 5.840 a 6.375 | 11.806 a 21.732 | 0 a 57 | 0 a 2.618 | 0 a 46 | 0 a 4 | 0 a 4 | 0 | dentro |
| Tranquilo 0,5× | Preguiçoso (1/dia, preguicoso) | 336 | 23 | 6 | 0 | 0 | 50 | 0 | 0 | 196 a 201 | 425 | 265 | 929 a 931 | 846 a 848 | 0 | 766 a 771 | 0 | 12 a 13 | 4,5 a 5 | 0 | dentro |
| Tranquilo 0,5× | Regular (2/dia, economico) | 336 | 84 a 85 | 8 | 0 | 0 | 40 a 50 | 0 a 4 | 0 | 223 a 241 | 847 a 861 | 5.237 a 6.375 | 5.849 a 6.375 | 16.753 a 22.238 | 0 a 191 | 0 a 2.000 | 0 a 81 | 0 a 7 | 0 a 2,5 | 0 | dentro |
| Tranquilo 0,5× | Dedicado (4/dia, economico) | 336 | 84 a 85 | 8 | 0 | 0 | 50 | 0 | 0 | 232 a 248 | 398 a 423 | 3.719 a 6.375 | 5.497 a 6.375 | 27.154 a 33.867 | 0 a 25 | 0 a 646 | 0 a 59 | 0 a 4 | 0 a 2 | 0 | dentro |

#### Camponês: meta de desperdício

| Janela | Ritmo | Perfil | Comida (h de jogo) | Madeira (h de jogo) | Pedra (h de jogo) | Meta | Veredito |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 7 dias reais | Rápido 3× | Regular | 12 a 21 | 6 a 30 | 0 a 27 | ≤ 8 | **acima** |
| 7 dias reais | Normal 1× | Regular | 0 a 3 | 0 a 6 | 0 | ≤ 8 | dentro |
| 7 dias reais | Tranquilo 0,5× | Regular | 0 | 0 a 1,5 | 0 | ≤ 8 | dentro |
| Um ano de jogo | Rápido 3× | Regular | 12 a 18 | 0 | 0 | ≤ 8 | **acima** |
| Um ano de jogo | Normal 1× | Regular | 0 a 3 | 0 a 6 | 0 | ≤ 8 | dentro |
| Um ano de jogo | Tranquilo 0,5× | Regular | 0 a 2,5 | 0 a 2,5 | 0 a 0,5 | ≤ 8 | dentro |

#### Camponês: linha de base

```ts
  'week/3/preguicoso': measured([33, 33], 7, 0, 0, 4125, 4125, 4524, 72),
  'week/3/regular': measured([72, 75], 8, 0, 0, 6204, 6375, 152661, 30),
  'week/3/dedicado': measured([84, 85], 8, 0, 0, 6165, 6375, 319793, 15),
  'week/1/preguicoso': measured([30, 33], 6, 0, 0, 597, 469, 1700, 10),
  'week/1/regular': measured([56, 72], 7, 0, 0, 4915, 4944, 13686, 6),
  'week/1/dedicado': measured([84, 84], 8, 0, 0, 6375, 6375, 21732, 4),
  'week/0.5/preguicoso': measured([14, 14], 4, 0, 0, 215, 183, 238, 1),
  'week/0.5/regular': measured([52, 59], 6, 0, 0, 1380, 1240, 1073, 1.5),
  'week/0.5/dedicado': measured([56, 64], 6, 0, 0, 1398, 1175, 1168, 0),
  'year/3/preguicoso': measured([13, 13], 3, 0, 0, 994, 660, 161, 72),
  'year/3/regular': measured([27, 27], 5, 0, 0, 1504, 1544, 2172, 18),
  'year/3/dedicado': measured([48, 55], 7, 0, 0, 1989, 3108, 6092, 6),
  'year/1/preguicoso': measured([30, 33], 6, 0, 0, 597, 469, 1700, 10),
  'year/1/regular': measured([56, 72], 7, 0, 0, 4915, 4944, 13686, 6),
  'year/1/dedicado': measured([84, 84], 8, 0, 0, 6375, 6375, 21732, 4),
  'year/0.5/preguicoso': measured([23, 23], 6, 0, 0, 265, 931, 848, 5),
  'year/0.5/regular': measured([84, 85], 8, 0, 0, 6375, 6375, 22238, 2.5),
  'year/0.5/dedicado': measured([84, 85], 8, 0, 0, 6375, 6375, 33867, 2),
```

#### Rei de Ferro: 7 dias reais

| Ritmo | Perfil | Anos de jogo | População | Salão | Fome (h) | Frio (h) | Moral mínima | Moral baixa (h) | Foram embora | Fila ociosa (h) | Sem ofício (aldeão-h) | Excedente de madeira | Excedente de pedra | Excedente de ouro | Desperdício de comida | Desperdício de madeira | Desperdício de pedra | Desperdiçando (h) | Maior sequência desperdiçando (h de jogo) | Recusas | Faixa |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso (1/dia, preguicoso) | 3 | 33 | 7 | 0 | 0 | 50 | 0 | 0 | 120 | 672 | 3.120 | 3.120 | 4.465 a 4.467 | 15.300 a 15.306 | 27.791 a 27.810 | 12.699 a 12.705 | 134 | 72 | 0 | dentro |
| Rápido 3× | Regular (2/dia, economico) | 3 | 72 a 75 | 7 | 0 | 0 | 50 | 0 | 0 | 130 a 138 | 804 a 839 | 1.273 a 2.736 | 2.594 a 3.600 | 156.284 a 169.241 | 2.832 a 7.813 | 496 a 3.921 | 0 a 230 | 33 a 47 | 24 a 30 | 0 | dentro |
| Rápido 3× | Dedicado (4/dia, economico) | 3 | 74 a 75 | 7 | 0 | 0 | 40 a 50 | 0 a 6 | 0 | 135 a 147 | 412 a 420 | 1.427 a 2.738 | 2.447 a 3.600 | 269.796 a 294.587 | 81 a 2.562 | 0 a 14.915 | 0 a 2.690 | 4 a 21 | 6 a 15 | 0 | dentro |
| Normal 1× | Preguiçoso (1/dia, preguicoso) | 1 | 30 a 33 | 5 a 6 | 0 | 0 | 50 | 0 | 0 | 88 a 90 | 594 a 664 | 131 a 1.680 | 271 a 672 | 1.536 a 1.548 | 77 a 183 | 1.431 a 2.619 | 0 a 208 | 34 a 40 | 9 a 12 | 0 | dentro |
| Normal 1× | Regular (2/dia, economico) | 1 | 64 a 72 | 7 | 0 | 0 | 40 a 50 | 0 a 2 | 0 | 91 a 113 | 685 a 776 | 104 a 3.600 | 79 a 3.598 | 3.292 a 19.564 | 0 a 138 | 0 a 4.918 | 0 a 695 | 0 a 13 | 0 a 8 | 0 | dentro |
| Normal 1× | Dedicado (4/dia, economico) | 1 | 74 a 75 | 7 | 0 | 0 | 40 a 50 | 0 a 2 | 0 | 109 a 119 | 390 a 400 | 108 a 3.572 | 2.197 a 3.600 | 34.146 a 44.789 | 0 a 307 | 0 a 2.021 | 0 a 59 | 0 a 6 | 0 a 4 | 0 | dentro |
| Tranquilo 0,5× | Preguiçoso (1/dia, preguicoso) | 0,5 | 14 | 4 | 0 | 0 | 50 | 0 | 0 | 56 a 58 | 213 | 329 a 333 | 264 a 266 | 226 a 227 | 0 | 244 | 0 | 10 a 11 | 4,5 | 0 | dentro |
| Tranquilo 0,5× | Regular (2/dia, economico) | 0,5 | 47 a 54 | 6 | 0 | 0 | 40 a 50 | 0 a 4 | 0 | 67 a 78 | 463 a 541 | 0 a 1.306 | 114 a 1.231 | 36 a 795 | 0 a 32 | 0 a 291 | 0 | 0 a 2 | 0 a 1 | 0 | dentro |
| Tranquilo 0,5× | Dedicado (4/dia, economico) | 0,5 | 58 a 64 | 6 | 0 | 0 | 50 | 0 | 0 | 69 a 84 | 291 a 319 | 1 a 2.004 | 0 a 794 | 10 a 447 | 0 | 0 a 98 | 0 | 0 a 2 | 0 a 1,5 | 0 | dentro |

#### Rei de Ferro: um ano de jogo

| Ritmo | Perfil | Horas reais | População | Salão | Fome (h) | Frio (h) | Moral mínima | Moral baixa (h) | Foram embora | Fila ociosa (h) | Sem ofício (aldeão-h) | Excedente de madeira | Excedente de pedra | Excedente de ouro | Desperdício de comida | Desperdício de madeira | Desperdício de pedra | Desperdiçando (h) | Maior sequência desperdiçando (h de jogo) | Recusas | Faixa |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso (1/dia, preguicoso) | 56 | 13 | 3 | 0 | 0 | 50 | 0 | 0 | 20 | 176 | 333 | 496 a 497 | 160 | 179 | 5.143 a 5.146 | 0 | 36 | 72 | 0 | dentro |
| Rápido 3× | Regular (2/dia, economico) | 56 | 27 a 29 | 5 | 0 | 0 | 50 | 0 | 0 | 23 a 28 | 244 a 263 | 1 a 778 | 222 a 794 | 321 a 1.635 | 2.192 a 2.459 | 0 | 0 | 21 a 23 | 24 a 30 | 0 | dentro |
| Rápido 3× | Dedicado (4/dia, economico) | 56 | 47 a 54 | 6 a 7 | 0 | 0 | 50 | 0 | 0 | 25 a 35 | 248 a 268 | 5 a 2.584 | 94 a 2.111 | 588 a 12.727 | 81 a 449 | 0 a 3.966 | 0 a 1.536 | 3 a 13 | 6 a 15 | 0 | dentro |
| Normal 1× | Preguiçoso (1/dia, preguicoso) | 168 | 30 a 33 | 5 a 6 | 0 | 0 | 50 | 0 | 0 | 88 a 90 | 594 a 664 | 131 a 1.680 | 271 a 672 | 1.536 a 1.548 | 77 a 183 | 1.431 a 2.619 | 0 a 208 | 34 a 40 | 9 a 12 | 0 | dentro |
| Normal 1× | Regular (2/dia, economico) | 168 | 64 a 72 | 7 | 0 | 0 | 40 a 50 | 0 a 2 | 0 | 91 a 113 | 685 a 776 | 104 a 3.600 | 79 a 3.598 | 3.292 a 19.564 | 0 a 138 | 0 a 4.918 | 0 a 695 | 0 a 13 | 0 a 8 | 0 | dentro |
| Normal 1× | Dedicado (4/dia, economico) | 168 | 74 a 75 | 7 | 0 | 0 | 40 a 50 | 0 a 2 | 0 | 109 a 119 | 390 a 400 | 108 a 3.572 | 2.197 a 3.600 | 34.146 a 44.789 | 0 a 307 | 0 a 2.021 | 0 a 59 | 0 a 6 | 0 a 4 | 0 | dentro |
| Tranquilo 0,5× | Preguiçoso (1/dia, preguicoso) | 336 | 22 | 6 | 0 | 0 | 50 | 0 | 0 | 196 a 198 | 402 | 446 a 451 | 1.662 a 1.667 | 797 a 799 | 0 | 860 a 861 | 368 a 371 | 30 a 31 | 5 | 0 | dentro |
| Tranquilo 0,5× | Regular (2/dia, economico) | 336 | 74 a 75 | 7 | 0 | 0 | 40 a 50 | 0 a 93 | 0 | 227 a 241 | 745 a 759 | 571 a 3.594 | 2.240 a 3.600 | 38.484 a 45.478 | 0 a 136 | 0 a 1.878 | 0 a 100 | 0 a 7 | 0 a 2,5 | 0 | dentro |
| Tranquilo 0,5× | Dedicado (4/dia, economico) | 336 | 74 a 75 | 7 | 0 | 0 | 50 | 0 | 0 | 220 a 246 | 348 a 375 | 41 a 3.600 | 880 a 3.600 | 42.296 a 54.557 | 0 a 159 | 0 a 1.842 | 0 a 87 | 0 a 8 | 0 a 2,5 | 0 | dentro |

#### Rei de Ferro: meta de desperdício

| Janela | Ritmo | Perfil | Comida (h de jogo) | Madeira (h de jogo) | Pedra (h de jogo) | Meta | Veredito |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 7 dias reais | Rápido 3× | Regular | 24 a 30 | 6 a 15 | 0 a 6 | ≤ 8 | **acima** |
| 7 dias reais | Normal 1× | Regular | 0 a 4 | 0 a 8 | 0 a 4 | ≤ 8 | dentro |
| 7 dias reais | Tranquilo 0,5× | Regular | 0 a 1 | 0 a 1 | 0 | ≤ 8 | dentro |
| Um ano de jogo | Rápido 3× | Regular | 24 a 30 | 0 | 0 | ≤ 8 | **acima** |
| Um ano de jogo | Normal 1× | Regular | 0 a 4 | 0 a 8 | 0 a 4 | ≤ 8 | dentro |
| Um ano de jogo | Tranquilo 0,5× | Regular | 0 a 2 | 0 a 2,5 | 0 a 0,5 | ≤ 8 | dentro |

#### Rei de Ferro: linha de base

```ts
  'week/3/preguicoso': measured([33, 33], 7, 0, 0, 3120, 3120, 4467, 72),
  'week/3/regular': measured([72, 75], 7, 0, 0, 2736, 3600, 169241, 30),
  'week/3/dedicado': measured([74, 75], 7, 0, 0, 2738, 3600, 294587, 15),
  'week/1/preguicoso': measured([30, 33], 5, 0, 0, 1680, 672, 1548, 12),
  'week/1/regular': measured([64, 72], 7, 0, 0, 3600, 3598, 19564, 8),
  'week/1/dedicado': measured([74, 75], 7, 0, 0, 3572, 3600, 44789, 4),
  'week/0.5/preguicoso': measured([14, 14], 4, 0, 0, 333, 266, 227, 4.5),
  'week/0.5/regular': measured([47, 54], 6, 0, 0, 1306, 1231, 795, 1),
  'week/0.5/dedicado': measured([58, 64], 6, 0, 0, 2004, 794, 447, 1.5),
  'year/3/preguicoso': measured([13, 13], 3, 0, 0, 333, 497, 160, 72),
  'year/3/regular': measured([27, 29], 5, 0, 0, 778, 794, 1635, 30),
  'year/3/dedicado': measured([47, 54], 6, 0, 0, 2584, 2111, 12727, 15),
  'year/1/preguicoso': measured([30, 33], 5, 0, 0, 1680, 672, 1548, 12),
  'year/1/regular': measured([64, 72], 7, 0, 0, 3600, 3598, 19564, 8),
  'year/1/dedicado': measured([74, 75], 7, 0, 0, 3572, 3600, 44789, 4),
  'year/0.5/preguicoso': measured([22, 22], 6, 0, 0, 451, 1667, 799, 5),
  'year/0.5/regular': measured([74, 75], 7, 0, 0, 3594, 3600, 45478, 2.5),
  'year/0.5/dedicado': measured([74, 75], 7, 0, 0, 3600, 3600, 54557, 2.5),
```

### 13.3 O que mudou em relação à seção 12, e por quê

- **A população e o Salão não mudaram**, a não ser em uma semente. Senhor, 7 dias reais: Regular 72 a 74 aldeões no Rápido (72 a 74), 65 a 72 no Normal (65 a 72), 50 a 54 no Tranquilo (51 a 54); Dedicado 74 a 75, 74 a 75 e 56 a 64 (59 a 64). O Salão chega ao mesmo nível em toda célula. Em Camponês, no ritmo Normal, a menor população do Regular entre as sementes caiu de 62 para 56 (a semente 013; a seguinte tem 60, e a maior subiu de 71 para 72): ninguém foi embora nem passou fome, o feudo recrutou mais devagar com as cartas que tirou.
- **O Preguiçoso não mudou em nada**: ele responde a toda carta sem gastar, e a carta nova, respondida com "explicar", não mexe no feudo. As seis células dele, em cada dificuldade, têm a mesma linha de base da seção 12; só a fila ociosa mudou.
- **A fila ociosa subiu em toda célula**, pelo motivo da seção 13.1. Senhor, 7 dias reais: Preguiçoso 121 h no Rápido (102), 84 a 96 no Normal (79 a 83); Regular 133 a 141 no Rápido (86 a 133) e 91 a 110 no Normal (45 a 89); Dedicado 136 a 149 no Rápido (35 a 117) e 106 a 123 no Normal (67 a 111). Não é tédio novo: é a Paliçada por erguer.
- **A Torre de Vigia sai até 12 h mais tarde na semente mais lenta** do Regular no ritmo Normal: entre as horas 49 e 109 (49 e 97). O Dedicado melhorou: 49 a 85 (49 a 97) no Normal e 79 a 109 (79 a 115) no Tranquilo. Nas outras células as horas são as da seção 12.
- **A meta de desperdício no ritmo Normal: 45 de 50.** Eram 47. As cinco sementes fora (016, 017, 029, 033 e 047) têm de 9 a 10 h de jogo seguidas de madeira indo ao chão; quatro delas com o Armazém pronto só da hora 61 em diante. É o mesmo caminho do bot das seções 11.4 e 12.3, em outras sementes. O teto da célula continua em 10 h. No ritmo Rápido o pior caso do Regular caiu de 30 para 27 h, e o do Dedicado subiu de 9 para 15 h, de volta à ordem de grandeza da seção 11 (21 h): a causa não foi investigada semente a semente, como nas rodadas anteriores.
- **O ouro parado mal se mexe**: Regular no ritmo Rápido, 7 dias reais, até 163.202 (164.535).
- **As cartas.** O pedido da cerca aparece em todas as 50 partidas do ano no ritmo Normal e em 41 das 50 do Rápido; as outras cartas saem um pouco menos, e a moral chega a 80 em menos partidas do ritmo Rápido com duas visitas por dia (6 de 50; eram 19), porque o pedido ocupa uma das dez cartas do ano e o bot não tira moral dele ([content-v0.2.md](content-v0.2.md), seções 4 e 5).

### 13.4 Faixas

`MEASURED`, em `packages/sim-cli/src/bands.ts`, passou a ser a linha de base desta rodada, nas três dificuldades; a regra da folga não mudou. `balance.test.ts` guarda o que mudou: as cinco sementes que passam da meta de desperdício no ritmo Normal, o pior caso do Regular no ritmo Rápido (27 h) e a hora em que cada perfil ergue a Torre (até a 109 no Normal). `coverage.test.ts` guarda que as duas continuações da cadeia da Paliçada **não** aparecem em partida nenhuma: no dia em que um bot aprender a prometer, o teste avisa.

Dois testes que mediam o bot por um limiar foram afrouxados, com o motivo escrito neles: o que cobrava a fila ociosa do início automático abaixo da **metade** da partida de controle passou a cobrar abaixo de **dois terços** (a Paliçada por erguer conta nas duas), e o que cobrava uma ordem de iniciar o Armazém passou a aceitar a de planejá-lo como automático (com outras cartas, o bot quis o Armazém em uma visita em que ainda faltava material).

### 13.5 O que fica para o autor

- **A Paliçada custa 250 de material e, nesta rodada, não protege de nada**: o valor dela só existe com as incursões (V2E-T3). A pergunta de balanceamento é daquela tarefa: quanto vale 10% (ou 15%) da comida e da madeira, uma vez a cada tantas viradas, contra 250 a 650 de material e uma visita.
- **O pedido dos aldeões volta todo ano para quem só explica.** É o comportamento escrito (a carta só deixa de voltar com a promessa cumprida), e no simulador ele ocupa uma audiência por ano sem dar nada. Para um jogador é o lembrete anual de que a cerca falta; se parecer insistente no playtest, o remédio é o peso da carta (3) ou uma flag que a silencie por um ano.
- **O bot não percorre a cadeia.** Se o autor quiser medir o que a promessa faz à moral em 50 sementes, a política "prometer quando a Paliçada cabe no estoque" é pequena e pode entrar com a da Paliçada, em V2E-T3.

### 13.6 Limites desta medição

- A matriz mede o que as três cartas novas fazem ao sorteio, não a Paliçada: nenhum bot a ergue.
- A fila ociosa desta rodada não se compara com a das anteriores (seção 13.1).
- As outras duas dificuldades jogam 3 sementes na suíte e 50 pelo comando; a linha de base de Camponês e de Rei de Ferro é a das 50.
- As duas tarefas seguintes (a incursão de lobos, com a política da Paliçada, e os objetivos 5 a 10) mexem na economia de novo: a linha de base desta seção dura até a próxima.

## 14. A incursão de lobos e a política da Paliçada (V2E-T3)

Tarefa V2E-T3: entraram **as incursões**. Os uivos no início do 10º dia de jogo e os lobos do roteiro no início do 16º (leve), e, daí em diante, as incursões que a Ameaça sorteia a cada virada de dia (chance `Ameaça − 40`, em %; leve abaixo de 60, média a partir de 60; marcada para 6 h de jogo depois; uma por vez). Uma incursão sem defesa leva 10% (leve) ou 15% (média) da comida e da madeira e fere 1 ou 2 aldeões por um dia de jogo; com perdas, a moral leva −10 por dois dias. A Paliçada segura (ou corta pela metade) o que o nível dela alcança, e toda incursão derruba a Ameaça em 10. Os bots ganharam a política **`erguer a Paliçada`** e deixaram de contar com os feridos na alocação. É a primeira rodada em que o mundo tira alguma coisa do feudo sem o jogador errar.

| | |
|---|---|
| Data | 2026-10-02 |
| Commit | o desta tarefa (`git log --grep "V2E-T3"`), feito sobre `c6a67a5` |
| Identificação | Motor 0.1.0 · estado v11 · conteúdo d66e3b00127b316f |
| Dificuldades | Camponês (`peasant`), Senhor (`lord`) e Rei de Ferro (`ironKing`) |
| Sementes | 50 fixas: `pedra-alta-001` a `pedra-alta-050` |
| Ritmos | Rápido 3×, Normal 1× e Tranquilo 0,5× |
| Máquina | Apple M5, macOS 26.6.2, Node 24.19.0 |

### 14.1 O que entrou no jogo, nos bots e no simulador

- **As incursões**, como acima. A do roteiro nasce marcada com a partida, e enquanto ela está marcada a Ameaça não sorteia outra: a primeira de toda partida é a leve do 16º dia. Entre duas incursões passam ao menos quatro dias de jogo (8 h de jogo: 2 h 40 reais no Rápido, 8 h no Normal, 16 h no Tranquilo).
- **`erguer a Paliçada`** (os dois bots, na frente de todas as obras): ergue e melhora a Paliçada quando a visão mostra uma incursão a caminho ou diz que a próxima virada do dia pode marcar uma (`threat.raidChancePercent` acima de zero). **Sem a Torre o bot não sabe de nada e não a ergue**: a ordem é Torre (com folga), depois Paliçada (sem folga). Sem recurso ou fila, deixa a obra planejada como automática, salvo a que gastaria a lenha do inverno.
- **Os feridos não são braços**: `alocar por demanda` e `comida primeiro` contam os habitantes que podem trabalhar. Sem isso o bot mandava para a Fazenda quem estava de cama e recebia `NOT_ENOUGH_VILLAGERS`.
- **No simulador**: as colunas `wolf_losses` (a última das reservadas), `raids_suffered`, `raids_repelled` e `villagers_injured`; o marco `palisade_hour`; a linha "Lobos" do resumo; e a tabela "Lobos" da matriz, por janela (incursões sofridas e repelidas, as anunciadas pela Torre, os feridos, a comida e a madeira levadas, a Ameaça no fim).

### 14.2 Comando e saída

```bash
pnpm -s sim -- --matrix > matriz-senhor.csv 2> matriz-senhor.md
pnpm -s sim -- --matrix --difficulty peasant > matriz-campones.csv 2> matriz-campones.md
pnpm -s sim -- --matrix --difficulty ironKing > matriz-rei-de-ferro.csv 2> matriz-rei-de-ferro.md
pnpm -s sim -- --seed pedra-alta-golden --days 7 --strategy economico > semana.csv
```

900 linhas no CSV em cada dificuldade. Com a linha de base nova as três saem com código 0: todas as partidas dentro das faixas da própria dificuldade, **nenhuma ordem recusada, nenhuma hora de fome nem de frio, ninguém vai embora**. Antes de regravar a linha de base, várias células saíam da faixa da seção 13 (em Senhor, a população do Preguiçoso nos ritmos Rápido e Normal e o Salão do Regular no ritmo Normal, entre outras): é o que a mecânica faz de propósito.

O resumo de uma partida (Senhor, ritmo Normal, 2 sessões por dia):

```text
Semente pedra-alta-golden · estratégia economico · 7 dias · 2 sessões/dia · ritmo 1×
Partida: Senhor · Normal: um ano em 7 dias
Motor 0.1.0 · estado v11 · conteúdo d66e3b00127b316f
Políticas: erguer a Paliçada, erguer a Torre, obra mais barata, ampliar o estoque, planejar automáticas, recrutar, responder a carta, alocar por demanda, guardar lenha
População: 66 de 75 vagas (mínima 7)
Níveis: townHall 7, farm 8, lumberMill 8, quarry 7, goldMine 7, housing 8, granary 3, warehouse 6, watchtower 2, palisade 2
Progresso: Salão Nv2 na hora 27, Salão Nv3 na hora 46, Salão Nv4 na hora 68, Celeiro na hora 33, Armazém na hora 61, Torre de Vigia na hora 61, Paliçada na hora 73 · 44 obras começaram sozinhas · ainda há obra por fazer no fim
Estoque: food 1886, wood 1299, stone 1072, gold 11049
Fome: nenhuma
Frio: nenhum
Moral: 60 no fim, mínima 40 (12 h com o povo inquieto ou desesperado)
Conselho: 23 cartas (4 continuações) · 21 respondidas, 0 expiradas · 3 efeitos escondidos
Ameaça: 90 no fim (máxima 100) · Torre de Vigia Nv2, erguida na hora 61
Lobos: 7 incursões sofridas, 10 repelidas (13 anunciadas pela Torre) · levaram food 503, wood 196 · 12 feridos · Paliçada Nv2, erguida na hora 73
Fila ociosa: 82 h com obra que podia começar (0 h com obra planejada)
Sem o início automático (as mesmas planejadas, manuais): 165 h com obra que podia começar (165 h com obra planejada)
Aldeões sem ofício: 726 aldeão-horas (4,3 por hora)
Excedente parado: wood 1299, stone 1072, gold 11049
Desperdício: food 0, wood 1711, stone 14 (7 h com depósito cheio perdendo produção)
Da produção de cada recurso, foi ao chão: food 0%, wood 5%, stone 0%
Maior sequência desperdiçando, em horas de jogo: food 0, wood 6, stone 1 (meta do GDD §15.2 para 2 sessões por dia: até 8)
Comandos: 128 aceitos, 0 recusados
```

#### Senhor: 7 dias reais

| Ritmo | Perfil | Anos de jogo | População | Salão | Fome (h) | Frio (h) | Moral mínima | Moral baixa (h) | Foram embora | Fila ociosa (h) | Sem ofício (aldeão-h) | Excedente de madeira | Excedente de pedra | Excedente de ouro | Desperdício de comida | Desperdício de madeira | Desperdício de pedra | Desperdiçando (h) | Maior sequência desperdiçando (h de jogo) | Recusas | Faixa |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso (1/dia, preguicoso) | 3 | 26 a 33 | 6 a 7 | 0 | 0 | 40 | 11 a 18 | 0 | 90 a 116 | 552 a 779 | 2.159 a 3.900 | 2.536 a 3.900 | 4.309 a 16.184 | 8.116 a 12.917 | 6.388 a 32.609 | 0 a 14.067 | 97 a 117 | 63 a 132 | 0 | dentro |
| Rápido 3× | Regular (2/dia, economico) | 3 | 72 a 75 | 7 | 0 | 0 | 40 a 50 | 0 a 4 | 0 | 70 a 121 | 780 a 880 | 3.378 a 4.782 | 4.378 a 5.100 | 129.941 a 162.453 | 692 a 5.424 | 493 a 28.007 | 0 a 3.644 | 9 a 40 | 9 a 33 | 0 | dentro |
| Rápido 3× | Dedicado (4/dia, economico) | 3 | 74 a 75 | 7 | 0 | 0 | 40 a 50 | 0 a 8 | 0 | 33 a 138 | 402 a 453 | 2.206 a 4.901 | 2.816 a 5.100 | 265.301 a 284.556 | 0 a 625 | 0 a 12.624 | 0 a 503 | 0 a 16 | 0 a 18 | 0 | dentro |
| Normal 1× | Preguiçoso (1/dia, preguicoso) | 1 | 17 a 32 | 4 a 5 | 0 | 0 | 40 | 45 a 66 | 0 | 73 a 92 | 268 a 707 | 31 a 2.100 | 37 a 2.100 | 518 a 3.447 | 0 a 29 | 619 a 3.612 | 0 a 1.497 | 12 a 33 | 6 a 16 | 0 | dentro |
| Normal 1× | Regular (2/dia, economico) | 1 | 60 a 71 | 6 a 7 | 0 | 0 | 40 | 8 a 34 | 0 | 68 a 103 | 638 a 788 | 112 a 4.417 | 489 a 4.549 | 793 a 15.132 | 0 a 111 | 0 a 10.894 | 0 a 668 | 0 a 20 | 0 a 9 | 0 | dentro |
| Normal 1× | Dedicado (4/dia, economico) | 1 | 74 a 75 | 7 | 0 | 0 | 40 a 45 | 10 a 30 | 0 | 68 a 111 | 380 a 417 | 398 a 5.100 | 2.888 a 5.100 | 27.713 a 35.085 | 0 a 28 | 0 a 2.099 | 0 a 575 | 0 a 4 | 0 a 3 | 0 | dentro |
| Tranquilo 0,5× | Preguiçoso (1/dia, preguicoso) | 0,5 | 12 a 13 | 4 | 0 | 0 | 40 | 32 a 56 | 0 | 56 a 68 | 153 a 193 | 13 a 405 | 211 a 346 | 61 a 264 | 0 | 144 a 452 | 0 | 7 a 14 | 3,5 a 4 | 0 | dentro |
| Tranquilo 0,5× | Regular (2/dia, economico) | 0,5 | 48 a 54 | 5 a 6 | 0 | 0 | 40 | 28 a 60 | 0 | 56 a 82 | 477 a 568 | 49 a 2.700 | 38 a 1.557 | 1 a 1.704 | 0 | 0 a 1.156 | 0 | 0 a 5 | 0 a 3 | 0 | dentro |
| Tranquilo 0,5× | Dedicado (4/dia, economico) | 0,5 | 54 a 64 | 6 | 0 | 0 | 40 | 8 a 40 | 0 | 68 a 83 | 275 a 325 | 6 a 2.486 | 3 a 826 | 4 a 634 | 0 | 0 a 39 | 0 | 0 a 1 | 0 a 1 | 0 | dentro |

#### Senhor: um ano de jogo

| Ritmo | Perfil | Horas reais | População | Salão | Fome (h) | Frio (h) | Moral mínima | Moral baixa (h) | Foram embora | Fila ociosa (h) | Sem ofício (aldeão-h) | Excedente de madeira | Excedente de pedra | Excedente de ouro | Desperdício de comida | Desperdício de madeira | Desperdício de pedra | Desperdiçando (h) | Maior sequência desperdiçando (h de jogo) | Recusas | Faixa |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso (1/dia, preguicoso) | 56 | 13 | 2 a 3 | 0 | 0 | 40 | 10 a 16 | 0 | 0 a 23 | 135 a 207 | 219 a 891 | 14 a 868 | 20 a 160 | 0 | 3.626 a 4.887 | 0 | 24 a 36 | 60 a 132 | 0 | dentro |
| Rápido 3× | Regular (2/dia, economico) | 56 | 27 | 4 a 5 | 0 | 0 | 40 a 50 | 0 a 4 | 0 | 21 a 30 | 221 a 291 | 3 a 775 | 5 a 1.487 | 893 a 2.311 | 280 a 540 | 0 | 0 a 53 | 2 a 6 | 9 a 18 | 0 | dentro |
| Rápido 3× | Dedicado (4/dia, economico) | 56 | 51 a 54 | 6 a 7 | 0 | 0 | 40 a 50 | 0 a 8 | 0 | 18 a 34 | 245 a 297 | 1 a 2.848 | 29 a 1.956 | 175 a 12.053 | 0 a 110 | 0 a 9.250 | 0 a 487 | 0 a 12 | 0 a 18 | 0 | dentro |
| Normal 1× | Preguiçoso (1/dia, preguicoso) | 168 | 17 a 32 | 4 a 5 | 0 | 0 | 40 | 45 a 66 | 0 | 73 a 92 | 268 a 707 | 31 a 2.100 | 37 a 2.100 | 518 a 3.447 | 0 a 29 | 619 a 3.612 | 0 a 1.497 | 12 a 33 | 6 a 16 | 0 | dentro |
| Normal 1× | Regular (2/dia, economico) | 168 | 60 a 71 | 6 a 7 | 0 | 0 | 40 | 8 a 34 | 0 | 68 a 103 | 638 a 788 | 112 a 4.417 | 489 a 4.549 | 793 a 15.132 | 0 a 111 | 0 a 10.894 | 0 a 668 | 0 a 20 | 0 a 9 | 0 | dentro |
| Normal 1× | Dedicado (4/dia, economico) | 168 | 74 a 75 | 7 | 0 | 0 | 40 a 45 | 10 a 30 | 0 | 68 a 111 | 380 a 417 | 398 a 5.100 | 2.888 a 5.100 | 27.713 a 35.085 | 0 a 28 | 0 a 2.099 | 0 a 575 | 0 a 4 | 0 a 3 | 0 | dentro |
| Tranquilo 0,5× | Preguiçoso (1/dia, preguicoso) | 336 | 20 a 22 | 5 a 6 | 0 | 0 | 40 | 48 a 96 | 0 | 175 a 200 | 322 a 402 | 246 a 2.700 | 75 a 959 | 14 a 2.203 | 0 | 144 a 3.209 | 0 a 7 | 8 a 53 | 3,5 a 7,5 | 0 | dentro |
| Tranquilo 0,5× | Regular (2/dia, economico) | 336 | 74 a 75 | 7 | 0 | 0 | 40 | 28 a 60 | 0 | 202 a 237 | 717 a 795 | 3.061 a 5.100 | 4.508 a 5.100 | 32.335 a 38.821 | 0 a 196 | 0 a 3.328 | 0 a 67 | 0 a 12 | 0 a 3 | 0 | dentro |
| Tranquilo 0,5× | Dedicado (4/dia, economico) | 336 | 74 a 75 | 7 | 0 | 0 | 40 | 8 a 40 | 0 | 157 a 239 | 348 a 384 | 153 a 5.069 | 777 a 5.100 | 30.912 a 46.914 | 0 a 77 | 0 a 3.311 | 0 a 54 | 0 a 6 | 0 a 3,5 | 0 | dentro |

#### Senhor: progresso em 7 dias reais

| Ritmo | Perfil | Salão Nv2 (h) | Salão Nv3 (h) | Salão Nv4 (h) | Celeiro (h) | Armazém (h) | Torre de Vigia (h) | Paliçada (h) | Fim das obras (h) | Obras que começaram sozinhas | População mínima |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso | 29 a 55 | 54 a 90 | 76 a 120 | 34 a 73 | 32 a 58 | 73 a 97 | 97 a 121 | — | 37 a 42 | 7 |
| Rápido 3× | Regular | 11 | 22 a 23 | 39 a 42 | 25 a 26 | 25 a 27 | 37 | 49 a 50 | 113 a 151 | 46 a 50 | 7 |
| Rápido 3× | Dedicado | 10 | 19 a 21 | 26 a 28 | 14 a 15 | 19 a 25 | 19 a 37 | 25 a 43 | 74 a 129 | 48 a 53 | 7 |
| Normal 1× | Preguiçoso | 41 | 71 a 83 | 92 a 118 | 73 a — | 49 | 97 a — | 121 a — | — | 23 a 31 | 7 |
| Normal 1× | Regular | 27 a 28 | 45 a 48 | 63 a 69 | 31 a 35 | 39 a 74 | 61 a 109 | 73 a 121 | 162 a — | 39 a 53 | 7 |
| Normal 1× | Dedicado | 21 a 22 | 39 a 41 | 52 a 58 | 31 a 34 | 38 a 55 | 49 a 85 | 55 a 91 | 127 a 167 | 47 a 53 | 7 |
| Tranquilo 0,5× | Preguiçoso | 54 | 108 a 109 | 154 a 164 | — | 65 | 145 a — | — | — | 19 a 20 | 6 |
| Tranquilo 0,5× | Regular | 41 a 42 | 75 a 80 | 104 a 109 | 61 a — | 86 a 110 | 97 a 157 | 109 a — | — | 30 a 35 | 6 |
| Tranquilo 0,5× | Dedicado | 35 | 66 a 72 | 94 a 103 | 109 a — | 81 a 98 | 85 a 121 | 91 a 128 | — | 34 a 40 | 6 |

#### Senhor: progresso em um ano de jogo

| Ritmo | Perfil | Salão Nv2 (h) | Salão Nv3 (h) | Salão Nv4 (h) | Celeiro (h) | Armazém (h) | Torre de Vigia (h) | Paliçada (h) | Fim das obras (h) | Obras que começaram sozinhas | População mínima |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso | 29 a 55 | 54 a — | — | 34 a — | 32 a — | — | — | — | 6 a 13 | 7 |
| Rápido 3× | Regular | 11 | 22 a 23 | 39 a 42 | 25 a 26 | 25 a 27 | 37 | 49 a 50 | — | 26 a 30 | 7 |
| Rápido 3× | Dedicado | 10 | 19 a 21 | 26 a 28 | 14 a 15 | 19 a 25 | 19 a 37 | 25 a 43 | — | 37 a 46 | 7 |
| Normal 1× | Preguiçoso | 41 | 71 a 83 | 92 a 118 | 73 a — | 49 | 97 a — | 121 a — | — | 23 a 31 | 7 |
| Normal 1× | Regular | 27 a 28 | 45 a 48 | 63 a 69 | 31 a 35 | 39 a 74 | 61 a 109 | 73 a 121 | 162 a — | 39 a 53 | 7 |
| Normal 1× | Dedicado | 21 a 22 | 39 a 41 | 52 a 58 | 31 a 34 | 38 a 55 | 49 a 85 | 55 a 91 | 127 a 167 | 47 a 53 | 7 |
| Tranquilo 0,5× | Preguiçoso | 54 | 108 a 109 | 154 a 164 | — | 65 | 145 a 241 | 169 a 265 | — | 30 a 34 | 6 |
| Tranquilo 0,5× | Regular | 41 a 42 | 75 a 80 | 104 a 109 | 61 a 170 | 86 a 110 | 97 a 157 | 109 a 169 | 250 a 327 | 44 a 50 | 6 |
| Tranquilo 0,5× | Dedicado | 35 | 66 a 72 | 94 a 103 | 109 a 193 | 81 a 98 | 85 a 121 | 91 a 128 | 260 a — | 46 a 50 | 6 |

#### Senhor: lobos em 7 dias reais

| Ritmo | Perfil | Incursões sofridas | Incursões repelidas | Anunciadas pela Torre | Feridos | Comida levada | Madeira levada | Ameaça no fim |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso | 32 a 44 | 7 a 17 | 21 a 33 | 57 a 79 | 2.302 a 4.518 | 2.948 a 5.144 | 90 a 100 |
| Rápido 3× | Regular | 14 a 19 | 32 a 37 | 39 a 45 | 24 a 32 | 1.203 a 1.627 | 295 a 676 | 90 a 100 |
| Rápido 3× | Dedicado | 6 a 14 | 36 a 45 | 40 a 49 | 9 a 25 | 274 a 1.604 | 96 a 567 | 90 a 100 |
| Normal 1× | Preguiçoso | 13 a 17 | 0 a 2 | 0 a 8 | 22 a 33 | 210 a 740 | 502 a 1.855 | 90 a 100 |
| Normal 1× | Regular | 5 a 13 | 3 a 9 | 6 a 12 | 8 a 23 | 339 a 1.083 | 87 a 725 | 90 a 100 |
| Normal 1× | Dedicado | 3 a 8 | 7 a 12 | 8 a 14 | 4 a 14 | 103 a 299 | 35 a 487 | 90 a 100 |
| Tranquilo 0,5× | Preguiçoso | 4 a 7 | 0 | 0 a 2 | 7 a 13 | 63 a 112 | 156 a 375 | 90 a 100 |
| Tranquilo 0,5× | Regular | 4 a 7 | 0 a 3 | 0 a 5 | 6 a 13 | 100 a 293 | 34 a 628 | 90 a 100 |
| Tranquilo 0,5× | Dedicado | 2 a 5 | 1 a 5 | 2 a 6 | 2 a 8 | 30 a 114 | 8 a 214 | 90 a 100 |

#### Senhor: lobos em um ano de jogo

| Ritmo | Perfil | Incursões sofridas | Incursões repelidas | Anunciadas pela Torre | Feridos | Comida levada | Madeira levada | Ameaça no fim |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso | 13 a 17 | 0 | 0 | 25 a 33 | 388 a 500 | 997 a 1.587 | 90 a 100 |
| Rápido 3× | Regular | 13 a 17 | 0 | 4 a 8 | 23 a 30 | 1.121 a 1.498 | 248 a 525 | 90 a 100 |
| Rápido 3× | Dedicado | 6 a 14 | 2 a 8 | 6 a 13 | 9 a 25 | 274 a 1.604 | 96 a 567 | 90 a 100 |
| Normal 1× | Preguiçoso | 13 a 17 | 0 a 2 | 0 a 8 | 22 a 33 | 210 a 740 | 502 a 1.855 | 90 a 100 |
| Normal 1× | Regular | 5 a 13 | 3 a 9 | 6 a 12 | 8 a 23 | 339 a 1.083 | 87 a 725 | 90 a 100 |
| Normal 1× | Dedicado | 3 a 8 | 7 a 12 | 8 a 14 | 4 a 14 | 103 a 299 | 35 a 487 | 90 a 100 |
| Tranquilo 0,5× | Preguiçoso | 6 a 12 | 3 a 9 | 4 a 12 | 10 a 22 | 82 a 196 | 211 a 493 | 90 a 100 |
| Tranquilo 0,5× | Regular | 4 a 8 | 7 a 12 | 8 a 14 | 6 a 14 | 100 a 354 | 34 a 686 | 90 a 100 |
| Tranquilo 0,5× | Dedicado | 2 a 5 | 9 a 15 | 10 a 16 | 2 a 8 | 30 a 114 | 8 a 214 | 90 a 100 |

#### Senhor: meta de desperdício

| Janela | Ritmo | Perfil | Comida (h de jogo) | Madeira (h de jogo) | Pedra (h de jogo) | Meta | Veredito |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 7 dias reais | Rápido 3× | Regular | 9 a 21 | 3 a 33 | 0 a 27 | ≤ 8 | **acima** |
| 7 dias reais | Normal 1× | Regular | 0 a 2 | 0 a 9 | 0 a 5 | ≤ 8 | **acima** |
| 7 dias reais | Tranquilo 0,5× | Regular | 0 | 0 a 3 | 0 | ≤ 8 | dentro |
| Um ano de jogo | Rápido 3× | Regular | 9 a 18 | 0 | 0 a 3 | ≤ 8 | **acima** |
| Um ano de jogo | Normal 1× | Regular | 0 a 2 | 0 a 9 | 0 a 5 | ≤ 8 | **acima** |
| Um ano de jogo | Tranquilo 0,5× | Regular | 0 a 2,5 | 0 a 3 | 0 a 0,5 | ≤ 8 | dentro |

#### Senhor: linha de base

```ts
  'week/3/preguicoso': measured([26, 33], 6, 0, 0, 3900, 3900, 16184, 132),
  'week/3/regular': measured([72, 75], 7, 0, 0, 4782, 5100, 162453, 33),
  'week/3/dedicado': measured([74, 75], 7, 0, 0, 4901, 5100, 284556, 18),
  'week/1/preguicoso': measured([17, 32], 4, 0, 0, 2100, 2100, 3447, 16),
  'week/1/regular': measured([60, 71], 6, 0, 0, 4417, 4549, 15132, 9),
  'week/1/dedicado': measured([74, 75], 7, 0, 0, 5100, 5100, 35085, 3),
  'week/0.5/preguicoso': measured([12, 13], 4, 0, 0, 405, 346, 264, 4),
  'week/0.5/regular': measured([48, 54], 5, 0, 0, 2700, 1557, 1704, 3),
  'week/0.5/dedicado': measured([54, 64], 6, 0, 0, 2486, 826, 634, 1),
  'year/3/preguicoso': measured([13, 13], 2, 0, 0, 891, 868, 160, 132),
  'year/3/regular': measured([27, 27], 4, 0, 0, 775, 1487, 2311, 18),
  'year/3/dedicado': measured([51, 54], 6, 0, 0, 2848, 1956, 12053, 18),
  'year/1/preguicoso': measured([17, 32], 4, 0, 0, 2100, 2100, 3447, 16),
  'year/1/regular': measured([60, 71], 6, 0, 0, 4417, 4549, 15132, 9),
  'year/1/dedicado': measured([74, 75], 7, 0, 0, 5100, 5100, 35085, 3),
  'year/0.5/preguicoso': measured([20, 22], 5, 0, 0, 2700, 959, 2203, 7.5),
  'year/0.5/regular': measured([74, 75], 7, 0, 0, 5100, 5100, 38821, 3),
  'year/0.5/dedicado': measured([74, 75], 7, 0, 0, 5069, 5100, 46914, 3.5),
```

#### Camponês: 7 dias reais

| Ritmo | Perfil | Anos de jogo | População | Salão | Fome (h) | Frio (h) | Moral mínima | Moral baixa (h) | Foram embora | Fila ociosa (h) | Sem ofício (aldeão-h) | Excedente de madeira | Excedente de pedra | Excedente de ouro | Desperdício de comida | Desperdício de madeira | Desperdício de pedra | Desperdiçando (h) | Maior sequência desperdiçando (h de jogo) | Recusas | Faixa |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso (1/dia, preguicoso) | 3 | 26 a 33 | 6 a 7 | 0 | 0 | 40 | 11 a 18 | 0 | 92 a 118 | 552 a 779 | 2.525 a 4.125 | 2.939 a 4.125 | 4.360 a 16.113 | 6.659 a 11.896 | 5.969 a 31.217 | 406 a 14.706 | 92 a 111 | 63 a 129 | 0 | dentro |
| Rápido 3× | Regular (2/dia, economico) | 3 | 68 a 74 | 8 | 0 | 0 | 40 a 50 | 0 a 9 | 0 | 101 a 132 | 739 a 880 | 4.585 a 5.547 | 5.781 a 6.375 | 115.976 a 151.631 | 29 a 4.007 | 486 a 27.456 | 0 a 7.375 | 2 a 27 | 3 a 33 | 0 | dentro |
| Rápido 3× | Dedicado (4/dia, economico) | 3 | 84 a 85 | 8 | 0 | 0 | 40 | 2 a 9 | 0 | 48 a 115 | 460 a 507 | 2.878 a 5.954 | 4.211 a 6.375 | 282.815 a 313.483 | 0 a 231 | 0 a 27.206 | 0 a 3.529 | 1 a 13 | 3 a 15 | 0 | dentro |
| Normal 1× | Preguiçoso (1/dia, preguicoso) | 1 | 17 a 32 | 4 a 6 | 0 | 0 | 40 | 44 a 66 | 0 | 75 a 95 | 271 a 707 | 6 a 2.625 | 40 a 2.324 | 199 a 3.437 | 0 | 491 a 2.145 | 0 a 267 | 9 a 18 | 4 a 8 | 0 | dentro |
| Normal 1× | Regular (2/dia, economico) | 1 | 59 a 71 | 7 a 8 | 0 | 0 | 40 | 8 a 34 | 0 | 78 a 105 | 632 a 796 | 466 a 4.903 | 54 a 4.805 | 474 a 12.955 | 0 a 40 | 0 a 4.378 | 0 a 145 | 0 a 8 | 0 a 6 | 0 | dentro |
| Normal 1× | Dedicado (4/dia, economico) | 1 | 84 a 85 | 8 | 0 | 0 | 40 | 12 a 30 | 0 | 85 a 114 | 435 a 469 | 4.771 a 6.375 | 5.897 a 6.375 | 8.211 a 16.328 | 0 a 38 | 0 a 3.518 | 0 a 64 | 0 a 5 | 0 a 3 | 0 | dentro |
| Tranquilo 0,5× | Preguiçoso (1/dia, preguicoso) | 0,5 | 12 a 13 | 4 | 0 | 0 | 40 | 32 a 56 | 0 | 54 a 70 | 153 a 193 | 5 a 408 | 34 a 252 | 60 a 247 | 0 | 19 a 79 | 0 | 1 a 2 | 1 | 0 | dentro |
| Tranquilo 0,5× | Regular (2/dia, economico) | 0,5 | 48 a 54 | 5 a 6 | 0 | 0 | 40 | 20 a 60 | 0 | 65 a 82 | 469 a 579 | 77 a 1.377 | 39 a 837 | 72 a 921 | 0 | 0 a 914 | 0 | 0 a 4 | 0 a 2,5 | 0 | dentro |
| Tranquilo 0,5× | Dedicado (4/dia, economico) | 0,5 | 54 a 64 | 6 | 0 | 0 | 40 | 8 a 32 | 0 | 67 a 85 | 275 a 325 | 52 a 1.358 | 283 a 1.203 | 16 a 781 | 0 | 0 | 0 | 0 | 0 | 0 | dentro |

#### Camponês: um ano de jogo

| Ritmo | Perfil | Horas reais | População | Salão | Fome (h) | Frio (h) | Moral mínima | Moral baixa (h) | Foram embora | Fila ociosa (h) | Sem ofício (aldeão-h) | Excedente de madeira | Excedente de pedra | Excedente de ouro | Desperdício de comida | Desperdício de madeira | Desperdício de pedra | Desperdiçando (h) | Maior sequência desperdiçando (h de jogo) | Recusas | Faixa |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso (1/dia, preguicoso) | 56 | 13 | 2 a 3 | 0 | 0 | 40 | 10 a 16 | 0 | 0 a 24 | 135 a 207 | 409 a 1.070 | 14 a 868 | 20 a 160 | 0 | 3.088 a 4.524 | 0 | 20 a 33 | 57 a 129 | 0 | dentro |
| Rápido 3× | Regular (2/dia, economico) | 56 | 27 | 4 a 5 | 0 | 0 | 40 a 50 | 0 a 9 | 0 | 23 a 33 | 220 a 291 | 2 a 948 | 172 a 1.946 | 866 a 2.515 | 0 a 261 | 0 | 0 a 103 | 0 a 2 | 0 a 9 | 0 | dentro |
| Rápido 3× | Dedicado (4/dia, economico) | 56 | 47 a 54 | 6 a 7 | 0 | 0 | 40 | 2 a 9 | 0 | 21 a 37 | 221 a 284 | 14 a 3.079 | 26 a 2.304 | 89 a 10.286 | 0 a 121 | 0 a 2.097 | 0 | 0 a 4 | 0 a 9 | 0 | dentro |
| Normal 1× | Preguiçoso (1/dia, preguicoso) | 168 | 17 a 32 | 4 a 6 | 0 | 0 | 40 | 44 a 66 | 0 | 75 a 95 | 271 a 707 | 6 a 2.625 | 40 a 2.324 | 199 a 3.437 | 0 | 491 a 2.145 | 0 a 267 | 9 a 18 | 4 a 8 | 0 | dentro |
| Normal 1× | Regular (2/dia, economico) | 168 | 59 a 71 | 7 a 8 | 0 | 0 | 40 | 8 a 34 | 0 | 78 a 105 | 632 a 796 | 466 a 4.903 | 54 a 4.805 | 474 a 12.955 | 0 a 40 | 0 a 4.378 | 0 a 145 | 0 a 8 | 0 a 6 | 0 | dentro |
| Normal 1× | Dedicado (4/dia, economico) | 168 | 84 a 85 | 8 | 0 | 0 | 40 | 12 a 30 | 0 | 85 a 114 | 435 a 469 | 4.771 a 6.375 | 5.897 a 6.375 | 8.211 a 16.328 | 0 a 38 | 0 a 3.518 | 0 a 64 | 0 a 5 | 0 a 3 | 0 | dentro |
| Tranquilo 0,5× | Preguiçoso (1/dia, preguicoso) | 336 | 21 a 22 | 5 a 6 | 0 | 0 | 40 | 48 a 72 | 0 | 177 a 205 | 358 a 414 | 46 a 2.995 | 51 a 1.875 | 5 a 2.004 | 0 | 19 a 1.542 | 0 a 230 | 1 a 25 | 1 a 7 | 0 | dentro |
| Tranquilo 0,5× | Regular (2/dia, economico) | 336 | 84 | 8 | 0 | 0 | 40 | 20 a 80 | 0 | 202 a 237 | 826 a 901 | 5.598 a 6.375 | 5.938 a 6.375 | 10.883 a 19.251 | 0 a 182 | 0 a 2.559 | 0 a 48 | 0 a 11 | 0 a 3 | 0 | dentro |
| Tranquilo 0,5× | Dedicado (4/dia, economico) | 336 | 84 a 85 | 8 | 0 | 0 | 40 | 8 a 32 | 0 | 210 a 237 | 394 a 433 | 4.196 a 6.375 | 5.498 a 6.375 | 22.757 a 30.974 | 0 a 19 | 0 a 7.138 | 0 a 13 | 0 a 9 | 0 a 2,5 | 0 | dentro |

#### Camponês: lobos em 7 dias reais

| Ritmo | Perfil | Incursões sofridas | Incursões repelidas | Anunciadas pela Torre | Feridos | Comida levada | Madeira levada | Ameaça no fim |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso | 32 a 44 | 7 a 17 | 21 a 33 | 57 a 79 | 2.744 a 5.402 | 3.760 a 6.252 | 90 a 100 |
| Rápido 3× | Regular | 14 a 19 | 30 a 37 | 38 a 45 | 24 a 33 | 1.063 a 1.825 | 312 a 764 | 90 a 100 |
| Rápido 3× | Dedicado | 6 a 15 | 35 a 45 | 40 a 49 | 9 a 27 | 301 a 1.798 | 110 a 1.172 | 90 a 100 |
| Normal 1× | Preguiçoso | 11 a 17 | 0 a 3 | 0 a 8 | 19 a 33 | 210 a 813 | 664 a 1.811 | 90 a 100 |
| Normal 1× | Regular | 4 a 12 | 3 a 11 | 6 a 13 | 7 a 22 | 180 a 1.069 | 87 a 953 | 90 a 100 |
| Normal 1× | Dedicado | 3 a 8 | 8 a 13 | 9 a 14 | 4 a 14 | 103 a 316 | 25 a 411 | 90 a 100 |
| Tranquilo 0,5× | Preguiçoso | 4 a 7 | 0 | 0 a 2 | 7 a 13 | 61 a 113 | 184 a 466 | 90 a 100 |
| Tranquilo 0,5× | Regular | 3 a 7 | 0 a 3 | 0 a 5 | 5 a 13 | 90 a 330 | 34 a 388 | 90 a 100 |
| Tranquilo 0,5× | Dedicado | 2 a 4 | 1 a 5 | 2 a 6 | 2 a 7 | 30 a 110 | 8 a 214 | 90 a 100 |

#### Camponês: lobos em um ano de jogo

| Ritmo | Perfil | Incursões sofridas | Incursões repelidas | Anunciadas pela Torre | Feridos | Comida levada | Madeira levada | Ameaça no fim |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso | 13 a 17 | 0 | 0 | 25 a 33 | 388 a 500 | 1.253 a 2.022 | 90 a 100 |
| Rápido 3× | Regular | 13 a 17 | 0 | 3 a 8 | 23 a 30 | 972 a 1.584 | 287 a 540 | 90 a 100 |
| Rápido 3× | Dedicado | 6 a 15 | 1 a 8 | 5 a 13 | 9 a 27 | 301 a 1.798 | 110 a 1.172 | 90 a 100 |
| Normal 1× | Preguiçoso | 11 a 17 | 0 a 3 | 0 a 8 | 19 a 33 | 210 a 813 | 664 a 1.811 | 90 a 100 |
| Normal 1× | Regular | 4 a 12 | 3 a 11 | 6 a 13 | 7 a 22 | 180 a 1.069 | 87 a 953 | 90 a 100 |
| Normal 1× | Dedicado | 3 a 8 | 8 a 13 | 9 a 14 | 4 a 14 | 103 a 316 | 25 a 411 | 90 a 100 |
| Tranquilo 0,5× | Preguiçoso | 6 a 9 | 6 a 9 | 8 a 12 | 9 a 15 | 81 a 125 | 214 a 479 | 90 a 100 |
| Tranquilo 0,5× | Regular | 3 a 8 | 6 a 13 | 8 a 15 | 5 a 14 | 90 a 384 | 34 a 438 | 90 a 100 |
| Tranquilo 0,5× | Dedicado | 2 a 4 | 9 a 15 | 10 a 16 | 2 a 7 | 30 a 110 | 8 a 214 | 90 a 100 |

#### Camponês: meta de desperdício

| Janela | Ritmo | Perfil | Comida (h de jogo) | Madeira (h de jogo) | Pedra (h de jogo) | Meta | Veredito |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 7 dias reais | Rápido 3× | Regular | 3 a 21 | 3 a 33 | 0 a 24 | ≤ 8 | **acima** |
| 7 dias reais | Normal 1× | Regular | 0 a 1 | 0 a 6 | 0 a 2 | ≤ 8 | dentro |
| 7 dias reais | Tranquilo 0,5× | Regular | 0 | 0 a 2,5 | 0 | ≤ 8 | dentro |
| Um ano de jogo | Rápido 3× | Regular | 0 a 9 | 0 | 0 a 6 | ≤ 8 | **acima** |
| Um ano de jogo | Normal 1× | Regular | 0 a 1 | 0 a 6 | 0 a 2 | ≤ 8 | dentro |
| Um ano de jogo | Tranquilo 0,5× | Regular | 0 a 2 | 0 a 3 | 0 a 0,5 | ≤ 8 | dentro |

#### Camponês: linha de base

```ts
  'week/3/preguicoso': measured([26, 33], 6, 0, 0, 4125, 4125, 16113, 129),
  'week/3/regular': measured([68, 74], 8, 0, 0, 5547, 6375, 151631, 33),
  'week/3/dedicado': measured([84, 85], 8, 0, 0, 5954, 6375, 313483, 15),
  'week/1/preguicoso': measured([17, 32], 4, 0, 0, 2625, 2324, 3437, 8),
  'week/1/regular': measured([59, 71], 7, 0, 0, 4903, 4805, 12955, 6),
  'week/1/dedicado': measured([84, 85], 8, 0, 0, 6375, 6375, 16328, 3),
  'week/0.5/preguicoso': measured([12, 13], 4, 0, 0, 408, 252, 247, 1),
  'week/0.5/regular': measured([48, 54], 5, 0, 0, 1377, 837, 921, 2.5),
  'week/0.5/dedicado': measured([54, 64], 6, 0, 0, 1358, 1203, 781, 0),
  'year/3/preguicoso': measured([13, 13], 2, 0, 0, 1070, 868, 160, 129),
  'year/3/regular': measured([27, 27], 4, 0, 0, 948, 1946, 2515, 9),
  'year/3/dedicado': measured([47, 54], 6, 0, 0, 3079, 2304, 10286, 9),
  'year/1/preguicoso': measured([17, 32], 4, 0, 0, 2625, 2324, 3437, 8),
  'year/1/regular': measured([59, 71], 7, 0, 0, 4903, 4805, 12955, 6),
  'year/1/dedicado': measured([84, 85], 8, 0, 0, 6375, 6375, 16328, 3),
  'year/0.5/preguicoso': measured([21, 22], 5, 0, 0, 2995, 1875, 2004, 7),
  'year/0.5/regular': measured([84, 84], 8, 0, 0, 6375, 6375, 19251, 3),
  'year/0.5/dedicado': measured([84, 85], 8, 0, 0, 6375, 6375, 30974, 2.5),
```

#### Rei de Ferro: 7 dias reais

| Ritmo | Perfil | Anos de jogo | População | Salão | Fome (h) | Frio (h) | Moral mínima | Moral baixa (h) | Foram embora | Fila ociosa (h) | Sem ofício (aldeão-h) | Excedente de madeira | Excedente de pedra | Excedente de ouro | Desperdício de comida | Desperdício de madeira | Desperdício de pedra | Desperdiçando (h) | Maior sequência desperdiçando (h de jogo) | Recusas | Faixa |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso (1/dia, preguicoso) | 3 | 25 a 33 | 6 a 7 | 0 | 0 | 40 | 10 a 17 | 0 | 78 a 103 | 533 a 779 | 706 a 3.120 | 446 a 3.120 | 4.303 a 17.320 | 7.498 a 12.288 | 6.857 a 34.743 | 122 a 14.184 | 99 a 117 | 72 a 135 | 0 | dentro |
| Rápido 3× | Regular (2/dia, economico) | 3 | 72 a 74 | 7 | 0 | 0 | 40 a 50 | 0 a 5 | 0 | 48 a 119 | 781 a 871 | 1.342 a 2.736 | 2.634 a 3.600 | 130.821 a 162.297 | 1.561 a 8.017 | 131 a 34.934 | 0 a 7.610 | 19 a 55 | 15 a 33 | 0 | dentro |
| Rápido 3× | Dedicado (4/dia, economico) | 3 | 74 a 75 | 7 | 0 | 0 | 40 | 1 a 15 | 0 | 17 a 117 | 396 a 450 | 2.475 a 2.740 | 3.411 a 3.600 | 262.648 a 289.164 | 81 a 1.640 | 0 a 15.057 | 0 a 2.663 | 2 a 18 | 6 a 33 | 0 | dentro |
| Normal 1× | Preguiçoso (1/dia, preguicoso) | 1 | 17 a 32 | 4 a 5 | 0 | 0 | 40 | 47 a 66 | 0 | 68 a 88 | 253 a 707 | 3 a 1.680 | 7 a 1.434 | 492 a 3.552 | 0 | 821 a 2.801 | 0 a 874 | 17 a 32 | 9 | 0 | dentro |
| Normal 1× | Regular (2/dia, economico) | 1 | 64 a 70 | 7 | 0 | 0 | 40 | 10 a 36 | 0 | 47 a 97 | 662 a 796 | 68 a 3.600 | 1 a 3.592 | 2.464 a 17.032 | 0 a 109 | 0 a 5.969 | 0 a 1.092 | 0 a 11 | 0 a 9 | 0 | dentro |
| Normal 1× | Dedicado (4/dia, economico) | 1 | 74 a 75 | 7 | 0 | 0 | 40 | 14 a 32 | 0 | 42 a 111 | 378 a 416 | 559 a 3.599 | 2.190 a 3.600 | 31.647 a 40.413 | 0 a 290 | 0 a 1.584 | 0 a 148 | 0 a 7 | 0 a 3 | 0 | dentro |
| Tranquilo 0,5× | Preguiçoso (1/dia, preguicoso) | 0,5 | 12 a 13 | 4 | 0 | 0 | 40 | 32 a 56 | 0 | 52 a 63 | 153 a 197 | 50 a 323 | 93 a 355 | 59 a 248 | 0 | 244 a 715 | 0 | 10 a 19 | 4,5 a 5 | 0 | dentro |
| Tranquilo 0,5× | Regular (2/dia, economico) | 0,5 | 47 a 54 | 5 a 6 | 0 | 0 | 40 | 32 a 60 | 0 | 57 a 75 | 467 a 554 | 2 a 2.160 | 22 a 1.267 | 20 a 1.315 | 0 | 0 a 1.049 | 0 | 0 a 4 | 0 a 2,5 | 0 | dentro |
| Tranquilo 0,5× | Dedicado (4/dia, economico) | 0,5 | 54 a 64 | 6 | 0 | 0 | 40 | 12 a 40 | 0 | 58 a 82 | 272 a 321 | 11 a 1.464 | 1 a 802 | 62 a 505 | 0 | 0 a 87 | 0 | 0 a 2 | 0 a 1,5 | 0 | dentro |

#### Rei de Ferro: um ano de jogo

| Ritmo | Perfil | Horas reais | População | Salão | Fome (h) | Frio (h) | Moral mínima | Moral baixa (h) | Foram embora | Fila ociosa (h) | Sem ofício (aldeão-h) | Excedente de madeira | Excedente de pedra | Excedente de ouro | Desperdício de comida | Desperdício de madeira | Desperdício de pedra | Desperdiçando (h) | Maior sequência desperdiçando (h de jogo) | Recusas | Faixa |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso (1/dia, preguicoso) | 56 | 13 | 2 a 3 | 0 | 0 | 40 | 10 a 16 | 0 | 0 a 19 | 135 a 207 | 95 a 607 | 14 a 660 | 20 a 160 | 0 a 34 | 3.911 a 5.177 | 0 | 25 a 38 | 72 a 135 | 0 | dentro |
| Rápido 3× | Regular (2/dia, economico) | 56 | 27 a 29 | 4 a 5 | 0 | 0 | 40 a 50 | 0 a 5 | 0 | 22 a 32 | 221 a 291 | 4 a 799 | 11 a 1.348 | 1.227 a 2.236 | 974 a 1.389 | 0 | 0 a 405 | 9 a 14 | 12 a 27 | 0 | dentro |
| Rápido 3× | Dedicado (4/dia, economico) | 56 | 50 a 53 | 6 a 7 | 0 | 0 | 40 | 1 a 10 | 0 | 14 a 34 | 236 a 298 | 75 a 2.640 | 37 a 1.806 | 670 a 10.576 | 81 a 373 | 0 a 4.399 | 0 a 1.327 | 2 a 10 | 6 a 15 | 0 | dentro |
| Normal 1× | Preguiçoso (1/dia, preguicoso) | 168 | 17 a 32 | 4 a 5 | 0 | 0 | 40 | 47 a 66 | 0 | 68 a 88 | 253 a 707 | 3 a 1.680 | 7 a 1.434 | 492 a 3.552 | 0 | 821 a 2.801 | 0 a 874 | 17 a 32 | 9 | 0 | dentro |
| Normal 1× | Regular (2/dia, economico) | 168 | 64 a 70 | 7 | 0 | 0 | 40 | 10 a 36 | 0 | 47 a 97 | 662 a 796 | 68 a 3.600 | 1 a 3.592 | 2.464 a 17.032 | 0 a 109 | 0 a 5.969 | 0 a 1.092 | 0 a 11 | 0 a 9 | 0 | dentro |
| Normal 1× | Dedicado (4/dia, economico) | 168 | 74 a 75 | 7 | 0 | 0 | 40 | 14 a 32 | 0 | 42 a 111 | 378 a 416 | 559 a 3.599 | 2.190 a 3.600 | 31.647 a 40.413 | 0 a 290 | 0 a 1.584 | 0 a 148 | 0 a 7 | 0 a 3 | 0 | dentro |
| Tranquilo 0,5× | Preguiçoso (1/dia, preguicoso) | 336 | 20 a 22 | 5 a 6 | 0 | 0 | 40 | 48 a 112 | 0 | 170 a 197 | 334 a 398 | 9 a 2.160 | 2 a 1.680 | 0 a 2.081 | 0 | 244 a 2.092 | 0 a 215 | 10 a 41 | 4,5 a 8 | 0 | dentro |
| Tranquilo 0,5× | Regular (2/dia, economico) | 336 | 74 a 75 | 7 | 0 | 0 | 40 | 32 a 72 | 0 | 151 a 224 | 715 a 791 | 178 a 3.600 | 2.218 a 3.600 | 32.636 a 42.860 | 0 a 207 | 0 a 3.322 | 0 a 40 | 0 a 12 | 0 a 3,5 | 0 | dentro |
| Tranquilo 0,5× | Dedicado (4/dia, economico) | 336 | 74 a 75 | 7 | 0 | 0 | 40 | 12 a 40 | 0 | 125 a 231 | 351 a 378 | 150 a 3.600 | 1.099 a 3.600 | 38.779 a 51.693 | 0 a 134 | 0 a 1.751 | 0 a 42 | 0 a 9 | 0 a 2,5 | 0 | dentro |

#### Rei de Ferro: lobos em 7 dias reais

| Ritmo | Perfil | Incursões sofridas | Incursões repelidas | Anunciadas pela Torre | Feridos | Comida levada | Madeira levada | Ameaça no fim |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso | 32 a 44 | 7 a 17 | 21 a 33 | 57 a 79 | 2.796 a 5.266 | 2.826 a 3.963 | 90 a 100 |
| Rápido 3× | Regular | 14 a 23 | 26 a 37 | 34 a 45 | 24 a 41 | 1.209 a 2.713 | 262 a 1.259 | 90 a 100 |
| Rápido 3× | Dedicado | 6 a 16 | 36 a 45 | 39 a 49 | 10 a 29 | 347 a 1.762 | 107 a 749 | 90 a 100 |
| Normal 1× | Preguiçoso | 13 a 17 | 0 a 2 | 0 a 7 | 22 a 33 | 233 a 788 | 429 a 1.608 | 90 a 100 |
| Normal 1× | Regular | 5 a 11 | 3 a 10 | 6 a 13 | 8 a 20 | 274 a 1.099 | 80 a 729 | 90 a 100 |
| Normal 1× | Dedicado | 3 a 8 | 6 a 12 | 8 a 14 | 4 a 14 | 102 a 326 | 45 a 408 | 90 a 100 |
| Tranquilo 0,5× | Preguiçoso | 4 a 7 | 0 | 0 a 2 | 7 a 13 | 63 a 111 | 121 a 325 | 90 a 100 |
| Tranquilo 0,5× | Regular | 4 a 7 | 0 a 2 | 0 a 4 | 6 a 13 | 104 a 423 | 94 a 496 | 90 a 100 |
| Tranquilo 0,5× | Dedicado | 2 a 5 | 1 a 4 | 2 a 6 | 2 a 8 | 29 a 116 | 9 a 193 | 90 a 100 |

#### Rei de Ferro: lobos em um ano de jogo

| Ritmo | Perfil | Incursões sofridas | Incursões repelidas | Anunciadas pela Torre | Feridos | Comida levada | Madeira levada | Ameaça no fim |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso | 13 a 17 | 0 | 0 | 25 a 33 | 381 a 500 | 792 a 1.202 | 90 a 100 |
| Rápido 3× | Regular | 13 a 17 | 0 | 0 a 8 | 23 a 30 | 1.121 a 1.522 | 252 a 470 | 90 a 100 |
| Rápido 3× | Dedicado | 6 a 16 | 1 a 9 | 5 a 13 | 10 a 29 | 347 a 1.762 | 107 a 749 | 90 a 100 |
| Normal 1× | Preguiçoso | 13 a 17 | 0 a 2 | 0 a 7 | 22 a 33 | 233 a 788 | 429 a 1.608 | 90 a 100 |
| Normal 1× | Regular | 5 a 11 | 3 a 10 | 6 a 13 | 8 a 20 | 274 a 1.099 | 80 a 729 | 90 a 100 |
| Normal 1× | Dedicado | 3 a 8 | 6 a 12 | 8 a 14 | 4 a 14 | 102 a 326 | 45 a 408 | 90 a 100 |
| Tranquilo 0,5× | Preguiçoso | 6 a 15 | 0 a 9 | 3 a 12 | 9 a 27 | 82 a 235 | 123 a 851 | 90 a 100 |
| Tranquilo 0,5× | Regular | 4 a 9 | 6 a 11 | 8 a 13 | 6 a 16 | 104 a 480 | 94 a 631 | 90 a 100 |
| Tranquilo 0,5× | Dedicado | 2 a 5 | 9 a 14 | 10 a 16 | 2 a 8 | 29 a 116 | 9 a 193 | 90 a 100 |

#### Rei de Ferro: meta de desperdício

| Janela | Ritmo | Perfil | Comida (h de jogo) | Madeira (h de jogo) | Pedra (h de jogo) | Meta | Veredito |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 7 dias reais | Rápido 3× | Regular | 15 a 27 | 3 a 33 | 0 a 30 | ≤ 8 | **acima** |
| 7 dias reais | Normal 1× | Regular | 0 a 4 | 0 a 9 | 0 a 5 | ≤ 8 | **acima** |
| 7 dias reais | Tranquilo 0,5× | Regular | 0 | 0 a 2,5 | 0 | ≤ 8 | dentro |
| Um ano de jogo | Rápido 3× | Regular | 12 a 27 | 0 | 0 a 12 | ≤ 8 | **acima** |
| Um ano de jogo | Normal 1× | Regular | 0 a 4 | 0 a 9 | 0 a 5 | ≤ 8 | **acima** |
| Um ano de jogo | Tranquilo 0,5× | Regular | 0 a 2 | 0 a 3,5 | 0 a 0,5 | ≤ 8 | dentro |

#### Rei de Ferro: linha de base

```ts
  'week/3/preguicoso': measured([25, 33], 6, 0, 0, 3120, 3120, 17320, 135),
  'week/3/regular': measured([72, 74], 7, 0, 0, 2736, 3600, 162297, 33),
  'week/3/dedicado': measured([74, 75], 7, 0, 0, 2740, 3600, 289164, 33),
  'week/1/preguicoso': measured([17, 32], 4, 0, 0, 1680, 1434, 3552, 9),
  'week/1/regular': measured([64, 70], 7, 0, 0, 3600, 3592, 17032, 9),
  'week/1/dedicado': measured([74, 75], 7, 0, 0, 3599, 3600, 40413, 3),
  'week/0.5/preguicoso': measured([12, 13], 4, 0, 0, 323, 355, 248, 5),
  'week/0.5/regular': measured([47, 54], 5, 0, 0, 2160, 1267, 1315, 2.5),
  'week/0.5/dedicado': measured([54, 64], 6, 0, 0, 1464, 802, 505, 1.5),
  'year/3/preguicoso': measured([13, 13], 2, 0, 0, 607, 660, 160, 135),
  'year/3/regular': measured([27, 29], 4, 0, 0, 799, 1348, 2236, 27),
  'year/3/dedicado': measured([50, 53], 6, 0, 0, 2640, 1806, 10576, 15),
  'year/1/preguicoso': measured([17, 32], 4, 0, 0, 1680, 1434, 3552, 9),
  'year/1/regular': measured([64, 70], 7, 0, 0, 3600, 3592, 17032, 9),
  'year/1/dedicado': measured([74, 75], 7, 0, 0, 3599, 3600, 40413, 3),
  'year/0.5/preguicoso': measured([20, 22], 5, 0, 0, 2160, 1680, 2081, 8),
  'year/0.5/regular': measured([74, 75], 7, 0, 0, 3600, 3600, 42860, 3.5),
  'year/0.5/dedicado': measured([74, 75], 7, 0, 0, 3600, 3600, 51693, 2.5),
```

### 14.3 O que mudou em relação à seção 13, e por quê

- **Ninguém passa fome, ninguém passa frio e ninguém vai embora**, em nenhuma das 2.700 partidas. Os lobos tiram comida, madeira e braços por um dia, e nenhum perfil entra em espiral: a menor moral medida é 40, longe dos 25 em que alguém pode partir.
- **Quem mais paga é quem menos volta.** Senhor, 7 dias reais: o Preguiçoso termina com 26 a 33 aldeões no Rápido (33), 17 a 32 no Normal (30 a 33) e 12 a 13 no Tranquilo (14), e o Salão um nível abaixo em parte das sementes. O Regular, 72 a 75 no Rápido (72 a 74), 60 a 71 no Normal (65 a 72) e 48 a 54 no Tranquilo (50 a 54). O Dedicado quase não muda: 74 a 75, 74 a 75 e 54 a 64 (56 a 64). O Preguiçoso só ergue a Torre com folga, tarde (hora 97 em diante no Normal, e não em toda semente), e sem Torre não ergue a Paliçada: no ritmo Normal ele sofre de 13 a 17 incursões no ano e repele de 0 a 2.
- **A Paliçada sai uma visita depois da Torre.** Regular em Senhor: Torre na hora 37 e Paliçada na 49 ou 50 no Rápido; 61 a 109 e 73 a 121 no Normal; 97 a 157 e 109 a 169 no Tranquilo. Daí em diante o bot a leva ao nível 2 assim que a madeira e a pedra chegam, e as incursões passam a recuar: no ano do ritmo Normal o Regular sofre de 5 a 13 e repele de 3 a 9; o Dedicado sofre de 3 a 8 e repele de 7 a 12.
- **O que os lobos levam.** No ano do ritmo Normal, em Senhor: Regular 339 a 1.083 de comida e 87 a 725 de madeira, com 8 a 23 feridos; Dedicado 103 a 299 e 35 a 487, com 4 a 14; Preguiçoso 210 a 740 e 502 a 1.855, com 22 a 33. Para comparar: a Paliçada custa 250 de material no nível 1 e 400 no nível 2.
- **A moral baixa apareceu em todo perfil.** Regular no ritmo Normal: de 8 a 34 h com o povo inquieto (eram 0 a 2); Preguiçoso, de 45 a 66 h (0). É o termo de −10 por dois dias de jogo depois de cada incursão sofrida: moral 40, a faixa "Inquieto", com a produção × 0,95.
- **A fila ociosa caiu**, porque a Paliçada deixou de ser uma obra que ninguém inicia (seção 13.1). Senhor, 7 dias reais: Regular 70 a 121 h no Rápido (133 a 141) e 68 a 103 no Normal (91 a 110); Dedicado 33 a 138 (136 a 149) e 68 a 111 (106 a 123).
- **A Torre mudou de hora**: no Rápido o Regular a ergue na hora 37 em toda semente (49 a 61); no Normal a semente mais rápida atrasou de 49 para 61. A causa não foi investigada semente a semente: o estoque que os lobos levam e os feridos mudam o que cada visita encontra.
- **A meta de desperdício**: no ritmo Normal passaram a ser quatro sementes fora (007, 027, 037 e 046), com 9 h de jogo de madeira; o teto da célula caiu de 10 para 9 h. No Rápido o pior caso da semana subiu de 27 para 33 h, e o do ano caiu de 24 para 18. Em Rei de Ferro o ritmo Normal **saiu** da meta por uma semente (a 046, com 9 h de madeira; eram 8 h no pior caso); em Camponês continua dentro nas 50.
- **O ouro parado** quase não mudou no Regular (até 162.453 no Rápido; eram 163.202) e subiu no Preguiçoso do Rápido (até 16.184; eram 4.518), que faz menos obras.

### 14.4 A Ameaça não oscila em torno de um meio: sobe até o máximo

É a medida que o autor precisa ver antes de fechar a decisão 11 do [ADR 0014](decisions/0014-conselho-e-ameaca-na-v0.2.md). **Em todas as células, de todas as dificuldades, a Ameaça termina entre 90 e 100.**

A conta: uma incursão sorteada leva três dias de jogo para chegar, e na virada em que chega ainda está marcada (a virada vem antes da incursão), então a seguinte só é sorteada um dia depois. Um ciclo tem ao menos quatro viradas: a Ameaça sobe 20 (mais 3 por dia no outono) e cai 10. **Com −10 por incursão ela sobe em todo ciclo**, até o máximo, e fica lá. Consequências medidas:

- depois da do roteiro, **quase toda incursão é média** (a Ameaça já passou dos 60 quando os lobos do roteiro chegam, e não volta para baixo disso): o nível 1 da Paliçada nunca "segura" nada depois do 16º dia, só corta pela metade; quem resolve é o nível 2;
- com a Ameaça perto de 100 a chance é de 50% a 60% por virada, e um feudo sem Paliçada sofre **de 13 a 17 incursões por ano de jogo** (uma a cada 5 dias de jogo: 10 h reais no Normal, 3 h 20 no Rápido);
- quem tem a Paliçada no nível 2 lê na Crônica, no mesmo ritmo, "os lobos recuaram diante da paliçada".

Para o autor escolher, a mesma medida com outras quedas, sem mexer em mais nada (20 sementes, dois anos de jogo, um feudo que se alimenta e não é tocado, sem Paliçada; o número do conteúdo voltou a 10 depois da medida):

| Queda por incursão (`raidDrop`) | Incursões por ano de jogo | Leves | Médias | Ameaça média depois do 30º dia |
|---|---|---|---|---|
| **10 (ADR 0014, o que está no jogo)** | 16,5 | 3% | 97% | 97 |
| 20 | 15,4 | 3% | 97% | 91 |
| 30 | 13,3 | 8% | 92% | 78 |
| 40 | 10,8 | 20% | 80% | 66 |

A leitura do agente, para a sessão de balanceamento (V2F-T1): com a queda em 30 ou 40 a Ameaça oscila de verdade, as leves voltam a aparecer (e o nível 1 da Paliçada volta a valer por si), e o ritmo cai para uma incursão a cada 6 a 8 dias de jogo. O outro botão é o prazo (`raidLeadMs`): com menos dias entre o sorteio e a chegada, a Ameaça sobe menos por ciclo. **Nada disso foi mudado**: a queda de 10 é decisão do ADR.

### 14.5 Faixas

`MEASURED`, em `packages/sim-cli/src/bands.ts`, passou a ser a linha de base desta rodada, nas três dificuldades; a regra da folga não mudou. `balance.test.ts` guarda o que mudou: a hora em que cada perfil ergue a Torre e a Paliçada (a Paliçada sempre depois da Torre), as incursões do Regular no ano do ritmo Normal (5 a 13 sofridas, 3 a 9 repelidas, a Ameaça entre 90 e 100 no fim), a Ameaça no máximo em toda partida de um ano de jogo ou mais, as quatro sementes que passam da meta de desperdício no ritmo Normal, e que **toda** partida tem ao menos uma incursão, que ninguém repele sem Paliçada e que nenhuma partida tem fome, frio ou gente que vai embora. A faixa do Regular no ritmo Normal passou a 54 a 79 aldeões e Salão no nível 6 ou mais (eram 58 a 80 e nível 7).

### 14.6 O que fica para o autor

- **A queda de 10 por incursão** (seção 14.4): com ela a Ameaça não oscila, e quase toda incursão é média.
- **A frequência.** De 13 a 17 incursões por ano de jogo sem Paliçada é muito ou é o que dá vontade de erguê-la? No ritmo Rápido é uma a cada 3 h 20 reais. A regra do GDD §15.1 ("algo sempre acontece em menos de 8 h") está cumprida com folga; a pergunta é se é demais na Crônica (cada incursão sofrida são de 3 a 6 linhas: o alarme, para quem tem a Torre, o ataque, cada ferido e cada um que sara).
- **O jogador de uma visita por dia.** Ele termina a semana do ritmo Normal com 17 a 32 aldeões (eram 30 a 33), porque chega tarde à Torre e, sem ela, o bot não ergue a Paliçada. Um jogador de verdade lê "Uma paliçada os teria detido." na Crônica da primeira incursão e pode erguê-la sem Torre; o bot não lê a Crônica. A medida do Preguiçoso é, por isso, um teto do estrago, não uma previsão.
- **O bot não percorre "A Promessa da Paliçada"**: continua respondendo "não é hora", mesmo erguendo a obra pela Ameaça. A política "prometer quando a Paliçada cabe" continua sendo uma opção pequena (seção 13.5).

### 14.7 Limites desta medição

- O bot só ergue a Paliçada com a Torre: a matriz não mede o jogador que aprende com a primeira incursão.
- Os bots não usam o aviso: nenhum volta ao feudo por causa do alarme. A matriz mede a Paliçada, não a antecedência da Torre (essa está nos testes do motor e da API).
- As perdas somam comida e madeira em unidades; não há uma medida única de "quanto custou" que inclua os braços parados e a moral.
- A medida da seção 14.4 com outras quedas usou um feudo sem ordens e 20 sementes: serve para comparar as quedas entre si, não para prever uma partida jogada.
- As outras duas dificuldades jogam 3 sementes na suíte e 50 pelo comando; a linha de base de Camponês e de Rei de Ferro é a das 50.
- A tarefa seguinte (os objetivos 5 a 10) dá recompensas e mexe na economia de novo: a linha de base desta seção dura até a próxima.

## 15. Os Objetivos do Senhor da v0.2 (V2E-T4)

Tarefa V2E-T4: entraram **os objetivos 5 a 10** (GDD §12.2; [ADR 0014](decisions/0014-conselho-e-ameaca-na-v0.2.md), decisão 12): a Torre de Vigia (+40 pedra), a primeira carta respondida (+10 de moral por um dia de jogo), o Celeiro ou o Armazém (+60 madeira), uma obra marcada para começar sozinha (+30 ouro), a Paliçada (+100 madeira) e o inverno atravessado sem frio (+15 de moral por um dia de jogo). Nunca mais de três ativos; concluir um revela o seguinte. As recompensas mexem na economia, e **os bots passaram a seguir a lista**: é o que mais muda nesta rodada.

| | |
|---|---|
| Data | 2026-10-02 |
| Commit | o desta tarefa (`git log --grep "V2E-T4"`), feito sobre `b4bf6c1` |
| Identificação | Motor 0.1.0 · estado v11 · conteúdo 10164e0ffb6b06e8 |
| Dificuldades | Camponês (`peasant`), Senhor (`lord`) e Rei de Ferro (`ironKing`) |
| Sementes | 50 fixas: `pedra-alta-001` a `pedra-alta-050` |
| Ritmos | Rápido 3×, Normal 1× e Tranquilo 0,5× |
| Máquina | Apple M5, macOS 26.6.2, Node 24.19.0 |

### 15.1 O que entrou no jogo, nos bots e no simulador

- **Os seis objetivos**, como acima. A forma do estado não mudou (continua na versão 11): as condições novas leem o que já estava lá e três contadores novos em `stats` (`plansMarkedAuto`, `coldSpellsThisSeason`, `seasonsSurvived:<estação>`).
- **`seguir os objetivos`** (os dois bots, logo depois de `erguer a Paliçada`): para cada objetivo ativo, o bot dá o passo que a visão aponta em `objectives[].target`, sem conhecer objetivo nenhum pelo id. Um ofício: manda os livres que faltam. Um edifício: inicia a obra ou, se ela ainda não pode começar, deixa-a planejada como automática (ela começa sozinha quando o recurso, a fila ou o Salão chegarem). A lista de planejadas: marca uma obra como automática. O recrutamento, as cartas e a lenha continuam com as políticas que já os faziam.
- **`erguer a Torre`** continua com a regra da folga, e passou a valer, na prática, só para o nível 2: o nível 1 é do objetivo.
- **No simulador**: a coluna `objectives_done` nos dois CSVs, `objectives_done_hour` no da matriz, a linha "Objetivos" do resumo e duas colunas na tabela de progresso da matriz ("Objetivos concluídos" e "Último objetivo (h)").

### 15.2 Comando e saída

```bash
pnpm -s sim -- --matrix > matriz-senhor.csv 2> matriz-senhor.md
pnpm -s sim -- --matrix --difficulty peasant > matriz-campones.csv 2> matriz-campones.md
pnpm -s sim -- --matrix --difficulty ironKing > matriz-rei-de-ferro.csv 2> matriz-rei-de-ferro.md
pnpm -s sim -- --seed pedra-alta-golden --days 7 --strategy economico > semana.csv
```

900 linhas no CSV em cada dificuldade. Com a linha de base nova as três saem com código 0: todas as partidas dentro das faixas da própria dificuldade, **nenhuma ordem recusada, nenhuma hora de fome nem de frio, ninguém vai embora**. Antes de regravar a linha de base, boa parte das células saía da faixa da seção 14 (em Senhor, seis das nove da janela de 7 dias): os bots constroem em outra ordem.

O resumo de uma partida (Senhor, ritmo Normal, 2 sessões por dia):

```text
Semente pedra-alta-golden · estratégia economico · 7 dias · 2 sessões/dia · ritmo 1×
Partida: Senhor · Normal: um ano em 7 dias
Motor 0.1.0 · estado v11 · conteúdo 10164e0ffb6b06e8
Políticas: erguer a Paliçada, seguir os objetivos, erguer a Torre, obra mais barata, ampliar o estoque, planejar automáticas, recrutar, responder a carta, alocar por demanda, guardar lenha
População: 69 de 75 vagas (mínima 7)
Níveis: townHall 7, farm 8, lumberMill 8, quarry 8, goldMine 8, housing 8, granary 5, warehouse 8, watchtower 2, palisade 2
Progresso: Salão Nv2 na hora 27, Salão Nv3 na hora 52, Salão Nv4 na hora 69, Celeiro na hora 33, Armazém na hora 50, Torre de Vigia na hora 40, Paliçada na hora 54 · 52 obras começaram sozinhas · as obras acabaram na hora 164: nada mais a construir
Objetivos: 10 de 10 concluídos, o último na hora 168
Estoque: food 2567, wood 3416, stone 4500, gold 3574
Fome: nenhuma
Frio: nenhum
Moral: 60 no fim, mínima 40 (10 h com o povo inquieto ou desesperado)
Conselho: 22 cartas (2 continuações) · 20 respondidas, 0 expiradas · 4 efeitos escondidos
Ameaça: 90 no fim (máxima 100) · Torre de Vigia Nv2, erguida na hora 40
Lobos: 5 incursões sofridas, 12 repelidas (15 anunciadas pela Torre) · levaram food 269, wood 79 · 7 feridos · Paliçada Nv2, erguida na hora 54
Fila ociosa: 71 h com obra que podia começar (0 h com obra planejada)
Sem o início automático (as mesmas planejadas, manuais): 162 h com obra que podia começar (162 h com obra planejada)
Aldeões sem ofício: 731 aldeão-horas (4,4 por hora)
Excedente parado: wood 3416, stone 4500, gold 3574
Desperdício: food 17, wood 1410, stone 0 (3 h com depósito cheio perdendo produção)
Da produção de cada recurso, foi ao chão: food 0%, wood 3%, stone 0%
Maior sequência desperdiçando, em horas de jogo: food 1, wood 4, stone 0 (meta do GDD §15.2 para 2 sessões por dia: até 8)
Comandos: 138 aceitos, 0 recusados
```

#### Senhor: 7 dias reais

| Ritmo | Perfil | Anos de jogo | População | Salão | Fome (h) | Frio (h) | Moral mínima | Moral baixa (h) | Foram embora | Fila ociosa (h) | Sem ofício (aldeão-h) | Excedente de madeira | Excedente de pedra | Excedente de ouro | Desperdício de comida | Desperdício de madeira | Desperdício de pedra | Desperdiçando (h) | Maior sequência desperdiçando (h de jogo) | Recusas | Faixa |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso (1/dia, preguicoso) | 3 | 33 | 6 a 7 | 0 | 0 | 30 a 50 | 0 a 6 | 0 | 76 a 106 | 645 a 760 | 675 a 3.900 | 147 a 3.900 | 4.083 a 13.629 | 6.349 a 16.287 | 12.783 a 42.731 | 0 a 15.395 | 80 a 122 | 54 a 123 | 0 | dentro |
| Rápido 3× | Regular (2/dia, economico) | 3 | 70 a 75 | 7 | 0 | 0 | 40 a 50 | 0 a 4 | 0 | 53 a 108 | 767 a 844 | 1.983 a 4.260 | 2.536 a 5.085 | 122.231 a 159.412 | 0 a 4.603 | 110 a 30.234 | 0 a 7.245 | 4 a 38 | 6 a 33 | 0 | dentro |
| Rápido 3× | Dedicado (4/dia, economico) | 3 | 74 a 75 | 7 | 0 | 0 | 40 a 50 | 0 a 5 | 0 | 37 a 118 | 407 a 429 | 603 a 5.006 | 2.492 a 5.100 | 256.378 a 285.647 | 0 a 1.092 | 0 a 16.040 | 0 a 3.194 | 0 a 13 | 0 a 21 | 0 | dentro |
| Normal 1× | Preguiçoso (1/dia, preguicoso) | 1 | 16 a 28 | 2 a 5 | 0 | 0 | 50 | 0 | 0 | 57 a 109 | 280 a 624 | 1 a 1.887 | 879 a 2.700 | 6 a 828 | 348 a 1.142 | 204 a 248 | 661 a 4.435 | 33 a 96 | 7 a 58 | 0 | dentro |
| Normal 1× | Regular (2/dia, economico) | 1 | 60 a 71 | 7 | 0 | 0 | 40 a 50 | 0 a 14 | 0 | 45 a 79 | 644 a 777 | 256 a 4.430 | 164 a 4.522 | 410 a 21.095 | 0 a 103 | 0 a 4.799 | 0 a 100 | 0 a 12 | 0 a 8 | 0 | dentro |
| Normal 1× | Dedicado (4/dia, economico) | 1 | 74 a 75 | 7 | 0 | 0 | 40 a 45 | 6 a 14 | 0 | 50 a 98 | 390 a 410 | 314 a 5.100 | 2.880 a 5.100 | 24.974 a 34.670 | 0 a 30 | 0 a 3.091 | 0 a 634 | 0 a 6 | 0 a 3 | 0 | dentro |
| Tranquilo 0,5× | Preguiçoso (1/dia, preguicoso) | 0,5 | 24 a 25 | 3 a 4 | 0 | 0 | 40 | 12 a 45 | 0 | 85 a 90 | 404 a 478 | 268 a 1.500 | 1.128 a 1.583 | 1 a 264 | 0 | 392 a 836 | 542 a 929 | 23 a 30 | 5 a 6 | 0 | dentro |
| Tranquilo 0,5× | Regular (2/dia, economico) | 0,5 | 47 a 54 | 5 a 6 | 0 | 0 | 40 a 45 | 12 a 28 | 0 | 47 a 61 | 462 a 556 | 212 a 2.700 | 106 a 1.746 | 5 a 2.194 | 0 | 0 a 986 | 0 | 0 a 5 | 0 a 2,5 | 0 | dentro |
| Tranquilo 0,5× | Dedicado (4/dia, economico) | 0,5 | 56 a 64 | 6 | 0 | 0 | 40 a 45 | 4 a 24 | 0 | 49 a 67 | 275 a 315 | 3 a 2.719 | 66 a 1.116 | 30 a 573 | 0 | 0 a 24 | 0 | 0 a 1 | 0 a 1 | 0 | dentro |

#### Senhor: um ano de jogo

| Ritmo | Perfil | Horas reais | População | Salão | Fome (h) | Frio (h) | Moral mínima | Moral baixa (h) | Foram embora | Fila ociosa (h) | Sem ofício (aldeão-h) | Excedente de madeira | Excedente de pedra | Excedente de ouro | Desperdício de comida | Desperdício de madeira | Desperdício de pedra | Desperdiçando (h) | Maior sequência desperdiçando (h de jogo) | Recusas | Faixa |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso (1/dia, preguicoso) | 56 | 13 a 15 | 2 a 3 | 0 | 0 | 30 a 50 | 0 a 6 | 0 | 0 a 18 | 153 a 239 | 1 a 207 | 77 a 390 | 30 a 409 | 1.443 a 2.379 | 1.966 a 3.221 | 0 | 18 a 33 | 54 a 123 | 0 | dentro |
| Rápido 3× | Regular (2/dia, economico) | 56 | 24 a 30 | 4 a 5 | 0 | 0 | 40 a 50 | 0 a 4 | 0 | 12 a 25 | 196 a 272 | 23 a 774 | 116 a 707 | 648 a 6.538 | 0 a 789 | 0 a 713 | 0 a 415 | 0 a 6 | 0 a 15 | 0 | dentro |
| Rápido 3× | Dedicado (4/dia, economico) | 56 | 51 a 55 | 6 a 7 | 0 | 0 | 40 a 50 | 0 a 5 | 0 | 14 a 29 | 250 a 279 | 41 a 2.766 | 155 a 1.982 | 6.749 a 16.237 | 0 a 116 | 0 a 8.441 | 0 a 2.159 | 0 a 9 | 0 a 18 | 0 | dentro |
| Normal 1× | Preguiçoso (1/dia, preguicoso) | 168 | 16 a 28 | 2 a 5 | 0 | 0 | 50 | 0 | 0 | 57 a 109 | 280 a 624 | 1 a 1.887 | 879 a 2.700 | 6 a 828 | 348 a 1.142 | 204 a 248 | 661 a 4.435 | 33 a 96 | 7 a 58 | 0 | dentro |
| Normal 1× | Regular (2/dia, economico) | 168 | 60 a 71 | 7 | 0 | 0 | 40 a 50 | 0 a 14 | 0 | 45 a 79 | 644 a 777 | 256 a 4.430 | 164 a 4.522 | 410 a 21.095 | 0 a 103 | 0 a 4.799 | 0 a 100 | 0 a 12 | 0 a 8 | 0 | dentro |
| Normal 1× | Dedicado (4/dia, economico) | 168 | 74 a 75 | 7 | 0 | 0 | 40 a 45 | 6 a 14 | 0 | 50 a 98 | 390 a 410 | 314 a 5.100 | 2.880 a 5.100 | 24.974 a 34.670 | 0 a 30 | 0 a 3.091 | 0 a 634 | 0 a 6 | 0 a 3 | 0 | dentro |
| Tranquilo 0,5× | Preguiçoso (1/dia, preguicoso) | 336 | 52 a 60 | 6 a 7 | 0 | 0 | 40 | 12 a 48 | 0 | 193 a 240 | 1.085 a 1.254 | 179 a 4.500 | 272 a 1.730 | 1.100 a 6.452 | 0 | 3.076 a 8.990 | 736 a 1.211 | 46 a 67 | 5,5 a 8,5 | 0 | dentro |
| Tranquilo 0,5× | Regular (2/dia, economico) | 336 | 74 a 75 | 7 | 0 | 0 | 40 a 45 | 12 a 97 | 0 | 181 a 213 | 741 a 775 | 2.548 a 5.098 | 4.203 a 5.100 | 29.972 a 38.346 | 0 a 214 | 0 a 3.019 | 0 a 591 | 0 a 11 | 0 a 2,5 | 0 | dentro |
| Tranquilo 0,5× | Dedicado (4/dia, economico) | 336 | 74 a 75 | 7 | 0 | 0 | 40 a 45 | 4 a 24 | 0 | 138 a 223 | 344 a 375 | 114 a 5.094 | 870 a 5.100 | 30.691 a 46.592 | 0 a 54 | 0 a 3.016 | 0 a 24 | 0 a 6 | 0 a 3 | 0 | dentro |

#### Senhor: progresso em 7 dias reais

| Ritmo | Perfil | Salão Nv2 (h) | Salão Nv3 (h) | Salão Nv4 (h) | Celeiro (h) | Armazém (h) | Torre de Vigia (h) | Paliçada (h) | Fim das obras (h) | Obras que começaram sozinhas | População mínima | Objetivos concluídos | Último objetivo (h) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso | 29 a 52 | 53 a 79 | 77 a 102 | 31 a 54 | 33 a 55 | 50 a 75 | 54 a 79 | — | 38 a 46 | 7 | 10 | 56 a 79 |
| Rápido 3× | Regular | 11 | 24 a 28 | 35 a 42 | 15 a 16 | 25 a 57 | 20 | 26 a 29 | 114 a — | 46 a 52 | 7 | 10 | 56 |
| Rápido 3× | Dedicado | 10 | 19 a 21 | 26 a 28 | 14 a 16 | 25 a 32 | 13 a 14 | 20 a 21 | 74 a 129 | 49 a 54 | 7 | 10 | 56 |
| Normal 1× | Preguiçoso | 40 | 90 a — | 126 a — | 47 | 50 | 76 a 129 | 90 a — | — | 14 a 36 | 7 | 9 a 10 | 168 a — |
| Normal 1× | Regular | 27 a 28 | 46 a 53 | 65 a 72 | 32 a 37 | 39 a 74 | 32 a 43 | 49 a 54 | 162 a — | 43 a 53 | 7 | 10 | 168 |
| Normal 1× | Dedicado | 21 | 40 a 42 | 55 a 57 | 32 a 34 | 34 a 49 | 28 a 31 | 42 a 43 | 128 a 167 | 48 a 55 | 7 | 10 | 168 |
| Tranquilo 0,5× | Preguiçoso | 52 | 140 a 161 | 168 a — | 57 | 97 | 110 a 128 | 141 a 162 | — | 18 a 21 | 6 | 9 | — |
| Tranquilo 0,5× | Regular | 41 a 42 | 79 a 82 | 108 a 114 | 64 a 68 | 85 a 122 | 55 a 61 | 83 a 86 | — | 32 a 37 | 6 | 9 | — |
| Tranquilo 0,5× | Dedicado | 35 | 71 a 75 | 97 a 108 | 59 a 62 | 79 a 104 | 46 a 51 | 74 a 79 | — | 38 a 43 | 6 | 9 | — |

#### Senhor: progresso em um ano de jogo

| Ritmo | Perfil | Salão Nv2 (h) | Salão Nv3 (h) | Salão Nv4 (h) | Celeiro (h) | Armazém (h) | Torre de Vigia (h) | Paliçada (h) | Fim das obras (h) | Obras que começaram sozinhas | População mínima | Objetivos concluídos | Último objetivo (h) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso | 29 a 52 | 53 a — | — | 31 a 54 | 33 a 55 | 50 a — | 54 a — | — | 8 a 16 | 7 | 8 a 10 | 56 a — |
| Rápido 3× | Regular | 11 | 24 a 28 | 35 a 42 | 15 a 16 | 25 a — | 20 | 26 a 29 | — | 26 a 33 | 7 | 10 | 56 |
| Rápido 3× | Dedicado | 10 | 19 a 21 | 26 a 28 | 14 a 16 | 25 a 32 | 13 a 14 | 20 a 21 | — | 36 a 44 | 7 | 10 | 56 |
| Normal 1× | Preguiçoso | 40 | 90 a — | 126 a — | 47 | 50 | 76 a 129 | 90 a — | — | 14 a 36 | 7 | 9 a 10 | 168 a — |
| Normal 1× | Regular | 27 a 28 | 46 a 53 | 65 a 72 | 32 a 37 | 39 a 74 | 32 a 43 | 49 a 54 | 162 a — | 43 a 53 | 7 | 10 | 168 |
| Normal 1× | Dedicado | 21 | 40 a 42 | 55 a 57 | 32 a 34 | 34 a 49 | 28 a 31 | 42 a 43 | 128 a 167 | 48 a 55 | 7 | 10 | 168 |
| Tranquilo 0,5× | Preguiçoso | 52 | 140 a 161 | 168 a 198 | 57 | 97 | 110 a 128 | 141 a 162 | — | 39 a 43 | 6 | 10 | 336 |
| Tranquilo 0,5× | Regular | 41 a 42 | 79 a 82 | 108 a 114 | 64 a 68 | 85 a 122 | 55 a 61 | 83 a 86 | 247 a 328 | 47 a 53 | 6 | 10 | 336 |
| Tranquilo 0,5× | Dedicado | 35 | 71 a 75 | 97 a 108 | 59 a 62 | 79 a 104 | 46 a 51 | 74 a 79 | 248 a — | 49 a 54 | 6 | 10 | 336 |

#### Senhor: lobos em 7 dias reais

| Ritmo | Perfil | Incursões sofridas | Incursões repelidas | Anunciadas pela Torre | Feridos | Comida levada | Madeira levada | Ameaça no fim |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso | 17 a 29 | 21 a 33 | 29 a 41 | 29 a 51 | 1.554 a 2.722 | 1.049 a 2.183 | 90 a 100 |
| Rápido 3× | Regular | 7 a 11 | 39 a 45 | 43 a 51 | 10 a 17 | 327 a 656 | 68 a 186 | 90 a 100 |
| Rápido 3× | Dedicado | 4 a 6 | 42 a 49 | 45 a 53 | 5 a 9 | 120 a 355 | 12 a 88 | 90 a 100 |
| Normal 1× | Preguiçoso | 8 a 16 | 0 a 7 | 4 a 11 | 13 a 28 | 686 a 1.871 | 382 a 2.259 | 90 a 100 |
| Normal 1× | Regular | 3 a 5 | 9 a 13 | 12 a 17 | 3 a 7 | 88 a 291 | 20 a 133 | 90 a 100 |
| Normal 1× | Dedicado | 2 a 3 | 10 a 14 | 13 a 18 | 2 a 4 | 48 a 116 | 6 a 52 | 90 a 100 |
| Tranquilo 0,5× | Preguiçoso | 4 a 7 | 0 a 2 | 1 a 4 | 7 a 13 | 228 a 401 | 293 a 868 | 90 a 100 |
| Tranquilo 0,5× | Regular | 2 a 3 | 2 a 4 | 5 a 8 | 2 a 4 | 42 a 117 | 3 a 60 | 90 a 100 |
| Tranquilo 0,5× | Dedicado | 1 a 3 | 2 a 5 | 5 a 8 | 1 a 4 | 19 a 85 | 9 a 63 | 90 a 100 |

#### Senhor: lobos em um ano de jogo

| Ritmo | Perfil | Incursões sofridas | Incursões repelidas | Anunciadas pela Torre | Feridos | Comida levada | Madeira levada | Ameaça no fim |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso | 13 a 17 | 0 | 0 a 3 | 24 a 33 | 943 a 1.628 | 925 a 1.256 | 90 a 100 |
| Rápido 3× | Regular | 7 a 11 | 4 a 7 | 10 a 14 | 10 a 17 | 327 a 656 | 68 a 186 | 90 a 100 |
| Rápido 3× | Dedicado | 4 a 6 | 8 a 12 | 11 a 16 | 5 a 9 | 120 a 355 | 12 a 88 | 90 a 100 |
| Normal 1× | Preguiçoso | 8 a 16 | 0 a 7 | 4 a 11 | 13 a 28 | 686 a 1.871 | 382 a 2.259 | 90 a 100 |
| Normal 1× | Regular | 3 a 5 | 9 a 13 | 12 a 17 | 3 a 7 | 88 a 291 | 20 a 133 | 90 a 100 |
| Normal 1× | Dedicado | 2 a 3 | 10 a 14 | 13 a 18 | 2 a 4 | 48 a 116 | 6 a 52 | 90 a 100 |
| Tranquilo 0,5× | Preguiçoso | 4 a 7 | 8 a 12 | 10 a 14 | 7 a 13 | 228 a 401 | 293 a 868 | 90 a 100 |
| Tranquilo 0,5× | Regular | 2 a 3 | 10 a 14 | 13 a 18 | 2 a 4 | 42 a 117 | 3 a 60 | 90 a 100 |
| Tranquilo 0,5× | Dedicado | 1 a 3 | 11 a 15 | 13 a 18 | 1 a 4 | 19 a 85 | 9 a 63 | 90 a 100 |

#### Senhor: meta de desperdício

| Janela | Ritmo | Perfil | Comida (h de jogo) | Madeira (h de jogo) | Pedra (h de jogo) | Meta | Veredito |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 7 dias reais | Rápido 3× | Regular | 0 a 21 | 3 a 33 | 0 a 27 | ≤ 8 | **acima** |
| 7 dias reais | Normal 1× | Regular | 0 a 3 | 0 a 8 | 0 a 2 | ≤ 8 | dentro |
| 7 dias reais | Tranquilo 0,5× | Regular | 0 | 0 a 2,5 | 0 | ≤ 8 | dentro |
| Um ano de jogo | Rápido 3× | Regular | 0 a 15 | 0 a 6 | 0 a 15 | ≤ 8 | **acima** |
| Um ano de jogo | Normal 1× | Regular | 0 a 3 | 0 a 8 | 0 a 2 | ≤ 8 | dentro |
| Um ano de jogo | Tranquilo 0,5× | Regular | 0 a 2,5 | 0 a 2,5 | 0 a 1,5 | ≤ 8 | dentro |

#### Senhor: linha de base

```ts
  'week/3/preguicoso': measured([33, 33], 6, 0, 0, 3900, 3900, 13629, 123),
  'week/3/regular': measured([70, 75], 7, 0, 0, 4260, 5085, 159412, 33),
  'week/3/dedicado': measured([74, 75], 7, 0, 0, 5006, 5100, 285647, 21),
  'week/1/preguicoso': measured([16, 28], 2, 0, 0, 1887, 2700, 828, 58),
  'week/1/regular': measured([60, 71], 7, 0, 0, 4430, 4522, 21095, 8),
  'week/1/dedicado': measured([74, 75], 7, 0, 0, 5100, 5100, 34670, 3),
  'week/0.5/preguicoso': measured([24, 25], 3, 0, 0, 1500, 1583, 264, 6),
  'week/0.5/regular': measured([47, 54], 5, 0, 0, 2700, 1746, 2194, 2.5),
  'week/0.5/dedicado': measured([56, 64], 6, 0, 0, 2719, 1116, 573, 1),
  'year/3/preguicoso': measured([13, 15], 2, 0, 0, 207, 390, 409, 123),
  'year/3/regular': measured([24, 30], 4, 0, 0, 774, 707, 6538, 15),
  'year/3/dedicado': measured([51, 55], 6, 0, 0, 2766, 1982, 16237, 18),
  'year/1/preguicoso': measured([16, 28], 2, 0, 0, 1887, 2700, 828, 58),
  'year/1/regular': measured([60, 71], 7, 0, 0, 4430, 4522, 21095, 8),
  'year/1/dedicado': measured([74, 75], 7, 0, 0, 5100, 5100, 34670, 3),
  'year/0.5/preguicoso': measured([52, 60], 6, 0, 0, 4500, 1730, 6452, 8.5),
  'year/0.5/regular': measured([74, 75], 7, 0, 0, 5098, 5100, 38346, 2.5),
  'year/0.5/dedicado': measured([74, 75], 7, 0, 0, 5094, 5100, 46592, 3),
```

#### Camponês: 7 dias reais

| Ritmo | Perfil | Anos de jogo | População | Salão | Fome (h) | Frio (h) | Moral mínima | Moral baixa (h) | Foram embora | Fila ociosa (h) | Sem ofício (aldeão-h) | Excedente de madeira | Excedente de pedra | Excedente de ouro | Desperdício de comida | Desperdício de madeira | Desperdício de pedra | Desperdiçando (h) | Maior sequência desperdiçando (h de jogo) | Recusas | Faixa |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso (1/dia, preguicoso) | 3 | 33 | 6 a 7 | 0 | 0 | 40 a 50 | 0 a 3 | 0 | 83 a 115 | 645 a 760 | 4.125 | 264 a 4.125 | 4.082 a 13.733 | 4.972 a 15.103 | 13.523 a 43.790 | 416 a 14.766 | 74 a 114 | 48 a 120 | 0 | dentro |
| Rápido 3× | Regular (2/dia, economico) | 3 | 70 a 75 | 8 | 0 | 0 | 40 a 50 | 0 a 4 | 0 | 79 a 127 | 767 a 855 | 2.174 a 5.511 | 4.035 a 6.375 | 127.103 a 153.009 | 0 a 4.688 | 446 a 15.008 | 0 a 4.638 | 3 a 18 | 3 a 30 | 0 | dentro |
| Rápido 3× | Dedicado (4/dia, economico) | 3 | 84 a 85 | 8 | 0 | 0 | 40 | 2 a 7 | 0 | 34 a 121 | 466 a 487 | 300 a 5.676 | 3.134 a 6.375 | 279.885 a 317.868 | 0 a 216 | 73 a 22.545 | 0 a 2.471 | 2 a 14 | 3 a 18 | 0 | dentro |
| Normal 1× | Preguiçoso (1/dia, preguicoso) | 1 | 16 a 28 | 2 a 5 | 0 | 0 | 50 | 0 | 0 | 67 a 111 | 280 a 624 | 22 a 2.286 | 1.360 a 3.375 | 13 a 836 | 192 a 849 | 70 a 114 | 393 a 3.910 | 21 a 79 | 8 a 46 | 0 | dentro |
| Normal 1× | Regular (2/dia, economico) | 1 | 61 a 72 | 7 a 8 | 0 | 0 | 40 a 50 | 0 a 14 | 0 | 57 a 91 | 659 a 783 | 70 a 5.625 | 225 a 4.725 | 175 a 13.406 | 0 a 42 | 0 a 7.690 | 0 a 294 | 0 a 13 | 0 a 7 | 0 | dentro |
| Normal 1× | Dedicado (4/dia, economico) | 1 | 84 | 8 | 0 | 0 | 40 a 45 | 6 a 14 | 0 | 79 a 101 | 446 a 465 | 4.704 a 6.375 | 5.952 a 6.375 | 8.447 a 16.572 | 0 a 131 | 0 a 3.368 | 0 a 60 | 0 a 5 | 0 a 4 | 0 | dentro |
| Tranquilo 0,5× | Preguiçoso (1/dia, preguicoso) | 0,5 | 24 a 25 | 3 a 4 | 0 | 0 | 40 | 12 a 45 | 0 | 83 a 90 | 404 a 478 | 12 a 1.260 | 1.298 a 1.885 | 1 a 265 | 0 | 219 a 592 | 275 a 554 | 12 a 21 | 3 a 4,5 | 0 | dentro |
| Tranquilo 0,5× | Regular (2/dia, economico) | 0,5 | 47 a 54 | 5 a 6 | 0 | 0 | 40 a 45 | 12 a 28 | 0 | 48 a 58 | 462 a 556 | 1 a 2.625 | 168 a 1.073 | 0 a 954 | 0 | 0 a 823 | 0 | 0 a 3 | 0 a 2 | 0 | dentro |
| Tranquilo 0,5× | Dedicado (4/dia, economico) | 0,5 | 56 a 64 | 6 | 0 | 0 | 40 a 45 | 4 a 24 | 0 | 52 a 67 | 277 a 320 | 4 a 1.350 | 338 a 1.193 | 25 a 720 | 0 | 0 | 0 | 0 | 0 | 0 | dentro |

#### Camponês: um ano de jogo

| Ritmo | Perfil | Horas reais | População | Salão | Fome (h) | Frio (h) | Moral mínima | Moral baixa (h) | Foram embora | Fila ociosa (h) | Sem ofício (aldeão-h) | Excedente de madeira | Excedente de pedra | Excedente de ouro | Desperdício de comida | Desperdício de madeira | Desperdício de pedra | Desperdiçando (h) | Maior sequência desperdiçando (h de jogo) | Recusas | Faixa |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso (1/dia, preguicoso) | 56 | 13 a 15 | 2 a 3 | 0 | 0 | 40 a 50 | 0 a 3 | 0 | 1 a 21 | 153 a 239 | 5 a 321 | 98 a 475 | 30 a 404 | 936 a 2.065 | 1.468 a 2.900 | 0 | 14 a 29 | 33 a 120 | 0 | dentro |
| Rápido 3× | Regular (2/dia, economico) | 56 | 24 a 30 | 4 a 5 | 0 | 0 | 40 a 50 | 0 a 4 | 0 | 15 a 26 | 196 a 272 | 28 a 773 | 157 a 1.224 | 710 a 5.339 | 0 a 455 | 0 a 32 | 0 a 169 | 0 a 4 | 0 a 15 | 0 | dentro |
| Rápido 3× | Dedicado (4/dia, economico) | 56 | 50 a 54 | 6 a 7 | 0 | 0 | 40 | 2 a 7 | 0 | 17 a 30 | 249 a 270 | 59 a 2.463 | 75 a 2.720 | 313 a 13.565 | 0 a 84 | 0 a 6.524 | 0 a 27 | 1 a 7 | 3 a 18 | 0 | dentro |
| Normal 1× | Preguiçoso (1/dia, preguicoso) | 168 | 16 a 28 | 2 a 5 | 0 | 0 | 50 | 0 | 0 | 67 a 111 | 280 a 624 | 22 a 2.286 | 1.360 a 3.375 | 13 a 836 | 192 a 849 | 70 a 114 | 393 a 3.910 | 21 a 79 | 8 a 46 | 0 | dentro |
| Normal 1× | Regular (2/dia, economico) | 168 | 61 a 72 | 7 a 8 | 0 | 0 | 40 a 50 | 0 a 14 | 0 | 57 a 91 | 659 a 783 | 70 a 5.625 | 225 a 4.725 | 175 a 13.406 | 0 a 42 | 0 a 7.690 | 0 a 294 | 0 a 13 | 0 a 7 | 0 | dentro |
| Normal 1× | Dedicado (4/dia, economico) | 168 | 84 | 8 | 0 | 0 | 40 a 45 | 6 a 14 | 0 | 79 a 101 | 446 a 465 | 4.704 a 6.375 | 5.952 a 6.375 | 8.447 a 16.572 | 0 a 131 | 0 a 3.368 | 0 a 60 | 0 a 5 | 0 a 4 | 0 | dentro |
| Tranquilo 0,5× | Preguiçoso (1/dia, preguicoso) | 336 | 53 a 60 | 7 | 0 | 0 | 40 | 12 a 48 | 0 | 208 a 227 | 1.113 a 1.254 | 17 a 2.241 | 105 a 938 | 583 a 3.343 | 0 | 1.291 a 6.573 | 278 a 838 | 17 a 48 | 3,5 a 8 | 0 | dentro |
| Tranquilo 0,5× | Regular (2/dia, economico) | 336 | 84 a 85 | 8 | 0 | 0 | 40 a 45 | 12 a 28 | 0 | 181 a 208 | 850 a 874 | 5.317 a 6.374 | 5.862 a 6.375 | 11.093 a 18.989 | 0 a 208 | 0 a 2.226 | 0 a 60 | 0 a 9 | 0 a 3 | 0 | dentro |
| Tranquilo 0,5× | Dedicado (4/dia, economico) | 336 | 84 a 85 | 8 | 0 | 0 | 40 a 45 | 4 a 24 | 0 | 191 a 214 | 390 a 423 | 4.011 a 6.375 | 5.486 a 6.375 | 23.209 a 32.328 | 0 | 0 a 1.596 | 0 a 36 | 0 a 5 | 0 a 2 | 0 | dentro |

#### Camponês: progresso em 7 dias reais

| Ritmo | Perfil | Salão Nv2 (h) | Salão Nv3 (h) | Salão Nv4 (h) | Celeiro (h) | Armazém (h) | Torre de Vigia (h) | Paliçada (h) | Fim das obras (h) | Obras que começaram sozinhas | População mínima | Objetivos concluídos | Último objetivo (h) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso | 29 a 52 | 52 a 79 | 78 a 101 | 31 a 54 | 33 a 55 | 49 a 75 | 52 a 79 | — | 38 a 45 | 7 | 10 | 56 a 79 |
| Rápido 3× | Regular | 11 | 24 a 26 | 33 a 42 | 15 a 16 | 26 a 49 | 20 | 26 a 27 | 122 a 168 | 50 a 55 | 7 | 10 | 56 |
| Rápido 3× | Dedicado | 10 a 12 | 18 a 19 | 24 a 27 | 14 a 16 | 25 a 31 | 15 a 17 | 19 a 20 | 71 a 102 | 54 a 59 | 7 | 10 | 56 |
| Normal 1× | Preguiçoso | 40 | 90 a — | 117 a — | 47 | 50 | 76 a 129 | 90 a — | — | 13 a 34 | 7 | 9 a 10 | 168 a — |
| Normal 1× | Regular | 27 a 28 | 46 a 52 | 64 a 71 | 32 a 37 | 39 a 74 | 32 a 43 | 49 a 53 | — | 45 a 53 | 7 | 10 | 168 |
| Normal 1× | Dedicado | 21 | 40 a 42 | 55 a 57 | 32 a 34 | 38 a 49 | 28 a 31 | 42 a 43 | 145 a 164 | 54 a 58 | 7 | 10 | 168 |
| Tranquilo 0,5× | Preguiçoso | 52 | 140 a 161 | 168 a — | 57 | 97 | 110 a 128 | 141 a 162 | — | 18 a 22 | 6 | 9 | — |
| Tranquilo 0,5× | Regular | 41 a 42 | 79 a 82 | 108 a 113 | 64 a 68 | 98 a 122 | 55 a 61 | 83 a 86 | — | 33 a 37 | 6 | 9 | — |
| Tranquilo 0,5× | Dedicado | 35 | 71 a 75 | 97 a 103 | 59 a 62 | 97 a 104 | 46 a 51 | 74 a 79 | — | 38 a 41 | 6 | 9 | — |

#### Camponês: progresso em um ano de jogo

| Ritmo | Perfil | Salão Nv2 (h) | Salão Nv3 (h) | Salão Nv4 (h) | Celeiro (h) | Armazém (h) | Torre de Vigia (h) | Paliçada (h) | Fim das obras (h) | Obras que começaram sozinhas | População mínima | Objetivos concluídos | Último objetivo (h) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso | 29 a 52 | 52 a — | — | 31 a 54 | 33 a 55 | 49 a — | 52 a — | — | 8 a 17 | 7 | 8 a 10 | 56 a — |
| Rápido 3× | Regular | 11 | 24 a 26 | 33 a 42 | 15 a 16 | 26 a 49 | 20 | 26 a 27 | — | 26 a 32 | 7 | 10 | 56 |
| Rápido 3× | Dedicado | 10 a 12 | 18 a 19 | 24 a 27 | 14 a 16 | 25 a 31 | 15 a 17 | 19 a 20 | — | 36 a 48 | 7 | 10 | 56 |
| Normal 1× | Preguiçoso | 40 | 90 a — | 117 a — | 47 | 50 | 76 a 129 | 90 a — | — | 13 a 34 | 7 | 9 a 10 | 168 a — |
| Normal 1× | Regular | 27 a 28 | 46 a 52 | 64 a 71 | 32 a 37 | 39 a 74 | 32 a 43 | 49 a 53 | — | 45 a 53 | 7 | 10 | 168 |
| Normal 1× | Dedicado | 21 | 40 a 42 | 55 a 57 | 32 a 34 | 38 a 49 | 28 a 31 | 42 a 43 | 145 a 164 | 54 a 58 | 7 | 10 | 168 |
| Tranquilo 0,5× | Preguiçoso | 52 | 140 a 161 | 168 a 184 | 57 | 97 | 110 a 128 | 141 a 162 | — | 41 a 44 | 6 | 10 | 336 |
| Tranquilo 0,5× | Regular | 41 a 42 | 79 a 82 | 108 a 113 | 64 a 68 | 98 a 122 | 55 a 61 | 83 a 86 | 287 a 327 | 53 a 58 | 6 | 10 | 336 |
| Tranquilo 0,5× | Dedicado | 35 | 71 a 75 | 97 a 103 | 59 a 62 | 97 a 104 | 46 a 51 | 74 a 79 | 272 a 334 | 55 a 60 | 6 | 10 | 336 |

#### Camponês: lobos em 7 dias reais

| Ritmo | Perfil | Incursões sofridas | Incursões repelidas | Anunciadas pela Torre | Feridos | Comida levada | Madeira levada | Ameaça no fim |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso | 17 a 29 | 21 a 33 | 29 a 41 | 28 a 51 | 1.869 a 3.347 | 1.388 a 2.739 | 90 a 100 |
| Rápido 3× | Regular | 7 a 10 | 39 a 45 | 43 a 51 | 10 a 16 | 327 a 638 | 69 a 199 | 90 a 100 |
| Rápido 3× | Dedicado | 4 a 6 | 42 a 49 | 44 a 52 | 5 a 9 | 158 a 296 | 36 a 124 | 90 a 100 |
| Normal 1× | Preguiçoso | 8 a 16 | 0 a 7 | 4 a 11 | 13 a 28 | 786 a 2.009 | 536 a 2.415 | 90 a 100 |
| Normal 1× | Regular | 3 a 5 | 9 a 13 | 12 a 17 | 3 a 7 | 129 a 281 | 13 a 133 | 90 a 100 |
| Normal 1× | Dedicado | 2 a 3 | 10 a 14 | 13 a 18 | 2 a 4 | 48 a 116 | 6 a 52 | 90 a 100 |
| Tranquilo 0,5× | Preguiçoso | 4 a 7 | 0 a 2 | 1 a 4 | 7 a 13 | 228 a 401 | 359 a 1.008 | 90 a 100 |
| Tranquilo 0,5× | Regular | 2 a 3 | 2 a 4 | 5 a 8 | 2 a 4 | 42 a 117 | 3 a 60 | 90 a 100 |
| Tranquilo 0,5× | Dedicado | 1 a 3 | 2 a 5 | 5 a 8 | 1 a 4 | 19 a 85 | 9 a 63 | 90 a 100 |

#### Camponês: lobos em um ano de jogo

| Ritmo | Perfil | Incursões sofridas | Incursões repelidas | Anunciadas pela Torre | Feridos | Comida levada | Madeira levada | Ameaça no fim |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso | 13 a 17 | 0 | 0 a 3 | 24 a 32 | 1.188 a 1.942 | 1.182 a 1.634 | 90 a 100 |
| Rápido 3× | Regular | 7 a 10 | 4 a 8 | 10 a 14 | 10 a 16 | 327 a 638 | 69 a 199 | 90 a 100 |
| Rápido 3× | Dedicado | 4 a 6 | 8 a 12 | 11 a 15 | 5 a 9 | 158 a 296 | 36 a 124 | 90 a 100 |
| Normal 1× | Preguiçoso | 8 a 16 | 0 a 7 | 4 a 11 | 13 a 28 | 786 a 2.009 | 536 a 2.415 | 90 a 100 |
| Normal 1× | Regular | 3 a 5 | 9 a 13 | 12 a 17 | 3 a 7 | 129 a 281 | 13 a 133 | 90 a 100 |
| Normal 1× | Dedicado | 2 a 3 | 10 a 14 | 13 a 18 | 2 a 4 | 48 a 116 | 6 a 52 | 90 a 100 |
| Tranquilo 0,5× | Preguiçoso | 4 a 7 | 8 a 12 | 10 a 14 | 7 a 13 | 228 a 401 | 359 a 1.008 | 90 a 100 |
| Tranquilo 0,5× | Regular | 2 a 3 | 10 a 14 | 13 a 18 | 2 a 4 | 42 a 117 | 3 a 60 | 90 a 100 |
| Tranquilo 0,5× | Dedicado | 1 a 3 | 11 a 15 | 13 a 18 | 1 a 4 | 19 a 85 | 9 a 63 | 90 a 100 |

#### Camponês: meta de desperdício

| Janela | Ritmo | Perfil | Comida (h de jogo) | Madeira (h de jogo) | Pedra (h de jogo) | Meta | Veredito |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 7 dias reais | Rápido 3× | Regular | 0 a 21 | 3 a 30 | 0 a 24 | ≤ 8 | **acima** |
| 7 dias reais | Normal 1× | Regular | 0 a 1 | 0 a 7 | 0 a 2 | ≤ 8 | dentro |
| 7 dias reais | Tranquilo 0,5× | Regular | 0 | 0 a 2 | 0 | ≤ 8 | dentro |
| Um ano de jogo | Rápido 3× | Regular | 0 a 15 | 0 a 3 | 0 a 6 | ≤ 8 | **acima** |
| Um ano de jogo | Normal 1× | Regular | 0 a 1 | 0 a 7 | 0 a 2 | ≤ 8 | dentro |
| Um ano de jogo | Tranquilo 0,5× | Regular | 0 a 2,5 | 0 a 3 | 0 a 0,5 | ≤ 8 | dentro |

#### Camponês: linha de base

```ts
  'week/3/preguicoso': measured([33, 33], 6, 0, 0, 4125, 4125, 13733, 120),
  'week/3/regular': measured([70, 75], 8, 0, 0, 5511, 6375, 153009, 30),
  'week/3/dedicado': measured([84, 85], 8, 0, 0, 5676, 6375, 317868, 18),
  'week/1/preguicoso': measured([16, 28], 2, 0, 0, 2286, 3375, 836, 46),
  'week/1/regular': measured([61, 72], 7, 0, 0, 5625, 4725, 13406, 7),
  'week/1/dedicado': measured([84, 84], 8, 0, 0, 6375, 6375, 16572, 4),
  'week/0.5/preguicoso': measured([24, 25], 3, 0, 0, 1260, 1885, 265, 4.5),
  'week/0.5/regular': measured([47, 54], 5, 0, 0, 2625, 1073, 954, 2),
  'week/0.5/dedicado': measured([56, 64], 6, 0, 0, 1350, 1193, 720, 0),
  'year/3/preguicoso': measured([13, 15], 2, 0, 0, 321, 475, 404, 120),
  'year/3/regular': measured([24, 30], 4, 0, 0, 773, 1224, 5339, 15),
  'year/3/dedicado': measured([50, 54], 6, 0, 0, 2463, 2720, 13565, 18),
  'year/1/preguicoso': measured([16, 28], 2, 0, 0, 2286, 3375, 836, 46),
  'year/1/regular': measured([61, 72], 7, 0, 0, 5625, 4725, 13406, 7),
  'year/1/dedicado': measured([84, 84], 8, 0, 0, 6375, 6375, 16572, 4),
  'year/0.5/preguicoso': measured([53, 60], 7, 0, 0, 2241, 938, 3343, 8),
  'year/0.5/regular': measured([84, 85], 8, 0, 0, 6374, 6375, 18989, 3),
  'year/0.5/dedicado': measured([84, 85], 8, 0, 0, 6375, 6375, 32328, 2),
```

#### Rei de Ferro: 7 dias reais

| Ritmo | Perfil | Anos de jogo | População | Salão | Fome (h) | Frio (h) | Moral mínima | Moral baixa (h) | Foram embora | Fila ociosa (h) | Sem ofício (aldeão-h) | Excedente de madeira | Excedente de pedra | Excedente de ouro | Desperdício de comida | Desperdício de madeira | Desperdício de pedra | Desperdiçando (h) | Maior sequência desperdiçando (h de jogo) | Recusas | Faixa |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso (1/dia, preguicoso) | 3 | 33 | 6 a 7 | 0 | 0 | 30 a 50 | 0 a 6 | 0 | 69 a 101 | 645 a 760 | 2.640 a 3.120 | 894 a 3.120 | 4.045 a 13.665 | 7.500 a 17.202 | 13.689 a 44.987 | 368 a 16.081 | 93 a 129 | 60 a 126 | 0 | dentro |
| Rápido 3× | Regular (2/dia, economico) | 3 | 64 a 75 | 7 | 0 | 0 | 40 a 50 | 0 a 4 | 0 | 28 a 86 | 708 a 844 | 973 a 2.736 | 2.063 a 3.600 | 111.220 a 161.809 | 985 a 7.876 | 0 a 32.545 | 0 a 12.240 | 8 a 62 | 9 a 60 | 0 | dentro |
| Rápido 3× | Dedicado (4/dia, economico) | 3 | 74 a 75 | 7 | 0 | 0 | 40 | 1 a 6 | 0 | 17 a 62 | 406 a 426 | 2.434 a 2.724 | 3.416 a 3.600 | 264.300 a 289.815 | 81 a 2.561 | 87 a 21.935 | 0 a 2.746 | 4 a 24 | 6 a 42 | 0 | dentro |
| Normal 1× | Preguiçoso (1/dia, preguicoso) | 1 | 16 a 28 | 2 a 5 | 0 | 0 | 50 | 0 | 0 | 47 a 88 | 280 a 624 | 3 a 1.902 | 568 a 2.160 | 4 a 525 | 467 a 1.218 | 307 a 554 | 1.073 a 4.647 | 48 a 103 | 11 a 45 | 0 | dentro |
| Normal 1× | Regular (2/dia, economico) | 1 | 61 a 70 | 6 a 7 | 0 | 0 | 40 | 2 a 18 | 0 | 30 a 74 | 644 a 755 | 145 a 3.600 | 5 a 3.467 | 2.956 a 22.696 | 0 a 154 | 0 a 5.826 | 0 a 748 | 0 a 13 | 0 a 9 | 0 | dentro |
| Normal 1× | Dedicado (4/dia, economico) | 1 | 74 a 75 | 7 | 0 | 0 | 40 a 45 | 6 a 14 | 0 | 35 a 95 | 390 a 406 | 342 a 3.561 | 2.225 a 3.600 | 32.273 a 40.017 | 0 a 270 | 0 a 1.129 | 0 a 40 | 0 a 6 | 0 a 3 | 0 | dentro |
| Tranquilo 0,5× | Preguiçoso (1/dia, preguicoso) | 0,5 | 24 a 25 | 3 a 4 | 0 | 0 | 40 | 12 a 45 | 0 | 75 a 81 | 404 a 478 | 23 a 1.680 | 1.017 a 1.680 | 14 a 264 | 0 | 0 a 590 | 459 a 758 | 12 a 23 | 5 a 10 | 0 | dentro |
| Tranquilo 0,5× | Regular (2/dia, economico) | 0,5 | 49 a 54 | 5 a 6 | 0 | 0 | 40 | 12 a 28 | 0 | 38 a 55 | 480 a 554 | 84 a 792 | 55 a 416 | 10 a 450 | 0 | 0 a 253 | 0 | 0 a 1 | 0 a 1 | 0 | dentro |
| Tranquilo 0,5× | Dedicado (4/dia, economico) | 0,5 | 58 a 64 | 6 | 0 | 0 | 40 a 45 | 4 a 24 | 0 | 46 a 57 | 284 a 315 | 46 a 1.329 | 0 a 595 | 36 a 488 | 0 | 0 | 0 | 0 | 0 | 0 | dentro |

#### Rei de Ferro: um ano de jogo

| Ritmo | Perfil | Horas reais | População | Salão | Fome (h) | Frio (h) | Moral mínima | Moral baixa (h) | Foram embora | Fila ociosa (h) | Sem ofício (aldeão-h) | Excedente de madeira | Excedente de pedra | Excedente de ouro | Desperdício de comida | Desperdício de madeira | Desperdício de pedra | Desperdiçando (h) | Maior sequência desperdiçando (h de jogo) | Recusas | Faixa |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso (1/dia, preguicoso) | 56 | 13 a 15 | 2 a 3 | 0 | 0 | 30 a 50 | 0 a 6 | 0 | 0 a 17 | 153 a 239 | 1 a 268 | 77 a 477 | 30 a 506 | 1.867 a 2.626 | 2.368 a 3.470 | 0 a 24 | 25 a 37 | 60 a 126 | 0 | dentro |
| Rápido 3× | Regular (2/dia, economico) | 56 | 24 a 30 | 4 a 5 | 0 | 0 | 40 a 50 | 0 a 4 | 0 | 13 a 23 | 195 a 272 | 2 a 540 | 63 a 722 | 1.530 a 6.381 | 0 a 387 | 0 a 507 | 0 a 366 | 0 a 5 | 0 a 18 | 0 | dentro |
| Rápido 3× | Dedicado (4/dia, economico) | 56 | 49 a 54 | 5 a 7 | 0 | 0 | 40 | 1 a 6 | 0 | 11 a 27 | 238 a 274 | 9 a 1.564 | 21 a 1.607 | 4.141 a 15.218 | 81 a 419 | 0 a 6.462 | 0 a 1.464 | 2 a 12 | 6 a 18 | 0 | dentro |
| Normal 1× | Preguiçoso (1/dia, preguicoso) | 168 | 16 a 28 | 2 a 5 | 0 | 0 | 50 | 0 | 0 | 47 a 88 | 280 a 624 | 3 a 1.902 | 568 a 2.160 | 4 a 525 | 467 a 1.218 | 307 a 554 | 1.073 a 4.647 | 48 a 103 | 11 a 45 | 0 | dentro |
| Normal 1× | Regular (2/dia, economico) | 168 | 61 a 70 | 6 a 7 | 0 | 0 | 40 | 2 a 18 | 0 | 30 a 74 | 644 a 755 | 145 a 3.600 | 5 a 3.467 | 2.956 a 22.696 | 0 a 154 | 0 a 5.826 | 0 a 748 | 0 a 13 | 0 a 9 | 0 | dentro |
| Normal 1× | Dedicado (4/dia, economico) | 168 | 74 a 75 | 7 | 0 | 0 | 40 a 45 | 6 a 14 | 0 | 35 a 95 | 390 a 406 | 342 a 3.561 | 2.225 a 3.600 | 32.273 a 40.017 | 0 a 270 | 0 a 1.129 | 0 a 40 | 0 a 6 | 0 a 3 | 0 | dentro |
| Tranquilo 0,5× | Preguiçoso (1/dia, preguicoso) | 336 | 55 a 60 | 6 a 7 | 0 | 0 | 40 | 12 a 48 | 0 | 181 a 229 | 1.145 a 1.254 | 144 a 3.600 | 645 a 1.874 | 676 a 6.573 | 0 | 3.076 a 12.248 | 459 a 970 | 34 a 63 | 5 a 10 | 0 | dentro |
| Tranquilo 0,5× | Regular (2/dia, economico) | 336 | 74 a 75 | 7 | 0 | 0 | 40 | 12 a 28 | 0 | 130 a 208 | 741 a 773 | 932 a 3.600 | 2.682 a 3.600 | 36.757 a 42.842 | 0 a 165 | 0 a 2.458 | 0 a 48 | 0 a 12 | 0 a 3 | 0 | dentro |
| Tranquilo 0,5× | Dedicado (4/dia, economico) | 336 | 74 a 75 | 7 | 0 | 0 | 40 a 45 | 4 a 24 | 0 | 105 a 212 | 345 a 377 | 199 a 3.600 | 1.406 a 3.600 | 40.991 a 51.050 | 0 a 147 | 0 a 1.471 | 0 a 46 | 0 a 5 | 0 a 2 | 0 | dentro |

#### Rei de Ferro: progresso em 7 dias reais

| Ritmo | Perfil | Salão Nv2 (h) | Salão Nv3 (h) | Salão Nv4 (h) | Celeiro (h) | Armazém (h) | Torre de Vigia (h) | Paliçada (h) | Fim das obras (h) | Obras que começaram sozinhas | População mínima | Objetivos concluídos | Último objetivo (h) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso | 29 a 52 | 54 a 79 | 78 a 103 | 31 a 54 | 33 a 56 | 50 a 74 | 56 a 80 | — | 38 a 47 | 7 | 10 | 56 a 80 |
| Rápido 3× | Regular | 11 | 24 a 28 | 40 a 53 | 15 a 16 | 26 a 39 | 20 | 27 a 29 | 111 a — | 46 a 54 | 7 | 10 | 56 |
| Rápido 3× | Dedicado | 10 a 12 | 20 a 21 | 26 a 32 | 14 a 15 | 17 a 26 | 13 a 17 | 20 a 22 | 64 a 116 | 48 a 54 | 7 | 10 | 56 |
| Normal 1× | Preguiçoso | 40 | 90 a — | 128 a — | 50 | 47 | 76 a 129 | 90 a — | — | 14 a 36 | 7 | 9 a 10 | 168 a — |
| Normal 1× | Regular | 27 a 28 | 46 a 54 | 65 a 78 | 32 a 37 | 39 a 62 | 32 a 43 | 49 a 56 | 156 a — | 43 a 53 | 7 | 10 | 168 |
| Normal 1× | Dedicado | 21 | 40 a 45 | 55 a 58 | 29 a 32 | 43 | 28 a 30 | 42 a 46 | 122 a 164 | 49 a 55 | 7 | 10 | 168 |
| Tranquilo 0,5× | Preguiçoso | 52 | 140 a 161 | 168 a — | 57 | 63 | 110 a 128 | 141 a 162 | — | 19 a 22 | 6 | 9 | — |
| Tranquilo 0,5× | Regular | 41 a 42 | 80 a 82 | 109 a 114 | 64 a 68 | 75 a 89 | 55 a 61 | 83 a 89 | — | 34 a 37 | 6 | 9 | — |
| Tranquilo 0,5× | Dedicado | 35 | 71 a 75 | 98 a 108 | 59 a 62 | 73 a 82 | 46 a 51 | 75 a 79 | — | 39 a 42 | 6 | 9 | — |

#### Rei de Ferro: progresso em um ano de jogo

| Ritmo | Perfil | Salão Nv2 (h) | Salão Nv3 (h) | Salão Nv4 (h) | Celeiro (h) | Armazém (h) | Torre de Vigia (h) | Paliçada (h) | Fim das obras (h) | Obras que começaram sozinhas | População mínima | Objetivos concluídos | Último objetivo (h) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso | 29 a 52 | 54 a — | — | 31 a 54 | 33 a 56 | 50 a — | 56 a — | — | 8 a 15 | 7 | 8 a 10 | 56 a — |
| Rápido 3× | Regular | 11 | 24 a 28 | 40 a 53 | 15 a 16 | 26 a 39 | 20 | 27 a 29 | — | 25 a 33 | 7 | 10 | 56 |
| Rápido 3× | Dedicado | 10 a 12 | 20 a 21 | 26 a 32 | 14 a 15 | 17 a 26 | 13 a 17 | 20 a 22 | — | 36 a 47 | 7 | 10 | 56 |
| Normal 1× | Preguiçoso | 40 | 90 a — | 128 a — | 50 | 47 | 76 a 129 | 90 a — | — | 14 a 36 | 7 | 9 a 10 | 168 a — |
| Normal 1× | Regular | 27 a 28 | 46 a 54 | 65 a 78 | 32 a 37 | 39 a 62 | 32 a 43 | 49 a 56 | 156 a — | 43 a 53 | 7 | 10 | 168 |
| Normal 1× | Dedicado | 21 | 40 a 45 | 55 a 58 | 29 a 32 | 43 | 28 a 30 | 42 a 46 | 122 a 164 | 49 a 55 | 7 | 10 | 168 |
| Tranquilo 0,5× | Preguiçoso | 52 | 140 a 161 | 168 a 202 | 57 | 63 | 110 a 128 | 141 a 162 | — | 40 a 44 | 6 | 10 | 336 |
| Tranquilo 0,5× | Regular | 41 a 42 | 80 a 82 | 109 a 114 | 64 a 68 | 75 a 89 | 55 a 61 | 83 a 89 | 235 a 327 | 48 a 52 | 6 | 10 | 336 |
| Tranquilo 0,5× | Dedicado | 35 | 71 a 75 | 98 a 108 | 59 a 62 | 73 a 82 | 46 a 51 | 75 a 79 | 230 a — | 49 a 53 | 6 | 10 | 336 |

#### Rei de Ferro: lobos em 7 dias reais

| Ritmo | Perfil | Incursões sofridas | Incursões repelidas | Anunciadas pela Torre | Feridos | Comida levada | Madeira levada | Ameaça no fim |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso | 17 a 29 | 21 a 33 | 29 a 41 | 29 a 51 | 1.296 a 2.210 | 859 a 1.742 | 90 a 100 |
| Rápido 3× | Regular | 8 a 13 | 37 a 44 | 43 a 51 | 12 a 19 | 395 a 826 | 71 a 219 | 90 a 100 |
| Rápido 3× | Dedicado | 4 a 7 | 41 a 49 | 44 a 52 | 6 a 11 | 148 a 342 | 33 a 108 | 90 a 100 |
| Normal 1× | Preguiçoso | 8 a 16 | 0 a 6 | 4 a 11 | 13 a 28 | 608 a 1.756 | 299 a 1.862 | 90 a 100 |
| Normal 1× | Regular | 3 a 5 | 9 a 13 | 12 a 17 | 3 a 8 | 101 a 306 | 13 a 122 | 90 a 100 |
| Normal 1× | Dedicado | 2 a 3 | 10 a 14 | 13 a 18 | 2 a 4 | 46 a 152 | 10 a 77 | 90 a 100 |
| Tranquilo 0,5× | Preguiçoso | 4 a 7 | 0 a 2 | 1 a 4 | 7 a 13 | 228 a 401 | 328 a 956 | 90 a 100 |
| Tranquilo 0,5× | Regular | 2 a 3 | 2 a 5 | 5 a 8 | 2 a 4 | 42 a 116 | 13 a 51 | 90 a 100 |
| Tranquilo 0,5× | Dedicado | 1 a 3 | 2 a 5 | 5 a 8 | 1 a 4 | 19 a 85 | 9 a 60 | 90 a 100 |

#### Rei de Ferro: lobos em um ano de jogo

| Ritmo | Perfil | Incursões sofridas | Incursões repelidas | Anunciadas pela Torre | Feridos | Comida levada | Madeira levada | Ameaça no fim |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso | 13 a 17 | 0 | 0 a 3 | 25 a 33 | 748 a 1.346 | 740 a 1.000 | 90 a 100 |
| Rápido 3× | Regular | 8 a 13 | 2 a 7 | 10 a 14 | 12 a 19 | 395 a 826 | 71 a 219 | 90 a 100 |
| Rápido 3× | Dedicado | 4 a 7 | 7 a 11 | 11 a 15 | 6 a 11 | 148 a 342 | 33 a 108 | 90 a 100 |
| Normal 1× | Preguiçoso | 8 a 16 | 0 a 6 | 4 a 11 | 13 a 28 | 608 a 1.756 | 299 a 1.862 | 90 a 100 |
| Normal 1× | Regular | 3 a 5 | 9 a 13 | 12 a 17 | 3 a 8 | 101 a 306 | 13 a 122 | 90 a 100 |
| Normal 1× | Dedicado | 2 a 3 | 10 a 14 | 13 a 18 | 2 a 4 | 46 a 152 | 10 a 77 | 90 a 100 |
| Tranquilo 0,5× | Preguiçoso | 4 a 7 | 8 a 12 | 10 a 14 | 7 a 13 | 228 a 401 | 328 a 956 | 90 a 100 |
| Tranquilo 0,5× | Regular | 2 a 3 | 10 a 14 | 13 a 18 | 2 a 4 | 42 a 116 | 13 a 51 | 90 a 100 |
| Tranquilo 0,5× | Dedicado | 1 a 3 | 11 a 15 | 13 a 18 | 1 a 4 | 19 a 85 | 9 a 60 | 90 a 100 |

#### Rei de Ferro: meta de desperdício

| Janela | Ritmo | Perfil | Comida (h de jogo) | Madeira (h de jogo) | Pedra (h de jogo) | Meta | Veredito |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 7 dias reais | Rápido 3× | Regular | 9 a 60 | 0 a 33 | 0 a 27 | ≤ 8 | **acima** |
| 7 dias reais | Normal 1× | Regular | 0 a 5 | 0 a 9 | 0 a 4 | ≤ 8 | **acima** |
| 7 dias reais | Tranquilo 0,5× | Regular | 0 | 0 a 1 | 0 | ≤ 8 | dentro |
| Um ano de jogo | Rápido 3× | Regular | 0 a 12 | 0 a 9 | 0 a 18 | ≤ 8 | **acima** |
| Um ano de jogo | Normal 1× | Regular | 0 a 5 | 0 a 9 | 0 a 4 | ≤ 8 | **acima** |
| Um ano de jogo | Tranquilo 0,5× | Regular | 0 a 2 | 0 a 3 | 0 a 0,5 | ≤ 8 | dentro |

#### Rei de Ferro: linha de base

```ts
  'week/3/preguicoso': measured([33, 33], 6, 0, 0, 3120, 3120, 13665, 126),
  'week/3/regular': measured([64, 75], 7, 0, 0, 2736, 3600, 161809, 60),
  'week/3/dedicado': measured([74, 75], 7, 0, 0, 2724, 3600, 289815, 42),
  'week/1/preguicoso': measured([16, 28], 2, 0, 0, 1902, 2160, 525, 45),
  'week/1/regular': measured([61, 70], 6, 0, 0, 3600, 3467, 22696, 9),
  'week/1/dedicado': measured([74, 75], 7, 0, 0, 3561, 3600, 40017, 3),
  'week/0.5/preguicoso': measured([24, 25], 3, 0, 0, 1680, 1680, 264, 10),
  'week/0.5/regular': measured([49, 54], 5, 0, 0, 792, 416, 450, 1),
  'week/0.5/dedicado': measured([58, 64], 6, 0, 0, 1329, 595, 488, 0),
  'year/3/preguicoso': measured([13, 15], 2, 0, 0, 268, 477, 506, 126),
  'year/3/regular': measured([24, 30], 4, 0, 0, 540, 722, 6381, 18),
  'year/3/dedicado': measured([49, 54], 5, 0, 0, 1564, 1607, 15218, 18),
  'year/1/preguicoso': measured([16, 28], 2, 0, 0, 1902, 2160, 525, 45),
  'year/1/regular': measured([61, 70], 6, 0, 0, 3600, 3467, 22696, 9),
  'year/1/dedicado': measured([74, 75], 7, 0, 0, 3561, 3600, 40017, 3),
  'year/0.5/preguicoso': measured([55, 60], 6, 0, 0, 3600, 1874, 6573, 10),
  'year/0.5/regular': measured([74, 75], 7, 0, 0, 3600, 3600, 42842, 3),
  'year/0.5/dedicado': measured([74, 75], 7, 0, 0, 3600, 3600, 51050, 2),
```

### 15.3 O que mudou em relação à seção 14, e por quê

- **O bot percorre a sequência inteira.** Em um ano de jogo, o Regular e o Dedicado concluem os dez objetivos em todas as sementes, nos três ritmos e nas três dificuldades; o último é sempre o do inverno, na virada para a primavera (a hora 56 no Rápido, 168 no Normal, 336 no Tranquilo). O Preguiçoso conclui os dez no Tranquilo; no Normal, 49 das 50 sementes (uma fica sem a Paliçada); no Rápido, 18 concluem os dez, 25 ficam com nove e 7 com oito (o Salão não chega ao nível 3 dentro das 56 h, e sem ele não há Paliçada).
- **A defesa chega cedo, e é o que mais muda.** Regular em Senhor, um ano de jogo: a Torre fica pronta entre as horas 32 e 43 no ritmo Normal (eram 61 a 109), na hora 20 no Rápido (37) e entre a 55 e a 61 no Tranquilo (97 a 157); a Paliçada, entre a 49 e a 54 no Normal (73 a 121), a 26 e a 29 no Rápido (49 a 50) e a 83 e a 86 no Tranquilo (109 a 169). A Torre começa no instante em que o Salão a libera, porque já estava planejada.
- **Os lobos levam muito menos de quem segue a lista.** Regular, ano do ritmo Normal, em Senhor: de 3 a 5 incursões sofridas e de 9 a 13 repelidas (eram 5 a 13 e 3 a 9); de 3 a 7 feridos (8 a 23); de 88 a 291 de comida e de 20 a 133 de madeira levadas (339 a 1.083 e 87 a 725). No Rápido, de 7 a 11 sofridas e de 4 a 7 repelidas no ano (eram 13 a 17 e nenhuma). O Dedicado: 2 a 3 sofridas no Normal (3 a 8).
- **A moral baixa encolheu.** Regular no ritmo Normal: de 0 a 14 h com o povo inquieto (eram 8 a 34); Preguiçoso, nenhuma (eram 45 a 66). Menos incursões sofridas, menos termos de −10. A moral também passa da base em dois dias por partida, pelos prêmios de +10 e de +15.
- **O Salão do Regular voltou ao nível 7 em toda semente** no ritmo Normal (era 6 a 7), com a mesma população (60 a 71). No Rápido a população do Regular ficou entre 70 e 75 (72 a 75).
- **A meta de desperdício é cumprida no ritmo Normal pelas 50 sementes**, em Senhor: o pior caso é de 8 h de jogo de madeira (eram 9 h, em quatro sementes). O primeiro depósito sai cedo, porque o objetivo o pede. No Rápido a semana continua em 33 h e o ano caiu de 18 para 15. Em Camponês o Normal continua dentro (7 h); em Rei de Ferro continua fora por 1 h (9 h de madeira), e a semana do Rápido piorou: até 60 h de comida indo ao chão (eram 27).
- **O Celeiro no Tranquilo.** O Preguiçoso nunca o erguia nesse ritmo. Com o objetivo, ele o ergue na hora 57 e termina o ano de jogo com 52 a 60 aldeões e o Salão no nível 6 ou 7 (eram 20 a 22 e nível 5 ou 6). A leitura do agente é que, sem o Celeiro, a comida parava no limite do Pátio e segurava o recrutamento; isso não foi conferido semente a semente. O Regular e o Dedicado também o erguem mais cedo (hora 64 a 68 e 59 a 62; eram 61 a 170 e 109 a 193).
- **O Armazém no Rápido.** Com o objetivo cumprido pelo Celeiro, o segundo depósito fica para quando o estoque aperta: em Senhor, 3 das 50 sementes do Regular fecham o ano de jogo (56 h) sem o Armazém, e todas o têm até a hora 57.
- **A cadeia "O Celeiro Comum" no Rápido** é aberta em 19 das 50 sementes (eram 20 ou mais): a folga do começo vai para a Torre e para o depósito.

### 15.4 O jogador de uma visita por dia, no ritmo Normal, ficou mais devagar

É a medida que piorou, e a causa é conhecida. Preguiçoso, Senhor, um ano de jogo no ritmo Normal: **o Salão termina no nível 4 em 30 sementes, no 3 em 11, no 5 em 8 e no 2 em uma** (eram 48 no nível 5 e 2 no nível 4); a população, entre 16 e 28 (17 a 32); e a pedra chega a ficar 58 h de jogo seguidas indo ao chão (16).

O que acontece, lido hora a hora na semente `pedra-alta-040`: o Preguiçoso manda quem está sem ofício "todo mundo junto, para o material que mais falta às obras", e nunca mexe em quem já trabalha. Com a Torre e o depósito dos objetivos na lista, o que mais falta passa a ser a pedra; os livres da terceira visita (hora 48) vão para a Pedreira, **ninguém vai para a Mina de Ouro** (o saldo do ouro é zero da fundação até a hora 120), e o ouro acaba na hora 49. A Torre pede 50 de ouro e o Salão no nível 3 pede 180: as duas obras ficam esperando um ouro que ninguém minera, até a visita da hora 120 pôr gente na Mina (a Torre só fica pronta na hora 129, e o Salão não sai do nível 2).

Não é uma regra do jogo que trava: é a alocação de uma só vez do bot. Mas a pergunta é de quem joga: **um objetivo que custa ouro (a Torre) aparece antes de o jogador ter motivo para pôr alguém na Mina**. O objetivo diz "Faltam 50 ouro." em `missing`, e a tela tem como dizer isso; o bot não lê a frase. Em troca, o mesmo Preguiçoso sofre menos (de 8 a 16 incursões no ano, eram 13 a 17), repele até 7 (eram até 2) e não tem mais hora nenhuma de moral baixa.

### 15.5 Faixas

`MEASURED`, em `packages/sim-cli/src/bands.ts`, passou a ser a linha de base desta rodada, nas três dificuldades; a regra da folga não mudou. `balance.test.ts` guarda o que mudou: os dez objetivos concluídos em um ano de jogo por toda semente do Regular e do Dedicado, nas três dificuldades (e quantos o Preguiçoso conclui em cada ritmo); a hora em que cada perfil ergue a Torre e a Paliçada; as incursões do Regular no ano do ritmo Normal (3 a 5 sofridas, 9 a 13 repelidas); a meta de desperdício cumprida nos ritmos Normal e Tranquilo, sem semente nenhuma fora no Normal; e o Armazém que três sementes do Rápido deixam para depois do ano. A faixa do Regular no ritmo Normal voltou a pedir o Salão no nível 7 (era 6); a do Preguiçoso no ritmo Normal caiu para o Salão no nível 2 e 16 a 28 aldeões (eram nível 4 e 17 a 32), e o teto da sequência desperdiçando dela subiu de 16 para 58 h.

### 15.6 O que fica para o autor

- **O ouro da Torre** (seção 15.4). Três saídas, nenhuma aplicada: trocar o prêmio do objetivo 4 ou do 5 por ouro; tirar o ouro do custo do nível 1 da Torre; ou deixar como está e confiar na frase "Faltam 50 ouro." do objetivo. É decisão de conteúdo (ADR 0014, decisão 12, fixa +40 pedra).
- **Os prêmios em madeira no limite do Pátio.** O objetivo do depósito dá +60 madeira e o da Paliçada, +100: quem está com o Pátio cheio (500) perde parte do prêmio, contada na Crônica ("Faltou lugar no depósito, e foi ao chão: 50 de madeira."). É a regra do GDD §5.5, e ensina o limite; a pergunta é se o prêmio da Paliçada devia caber sempre.
- **O objetivo do inverno demora um ano de jogo.** É o último, e quem cumpre os outros nove no segundo dia fica com um só objetivo na tela até a primavera (7 dias reais no ritmo Normal, 14 no Tranquilo). Depois dele a lista acaba: os objetivos sazonais e anuais do GDD §12.2 são de versões seguintes.
- **A ordem dos prêmios de moral.** +10 e +15 por um dia de jogo são 40 minutos no ritmo Rápido: o jogador que não está olhando não os vê. A Crônica conta; o painel da moral mostra o termo enquanto ele vale.

### 15.7 Limites desta medição

- Os dois bots seguem os objetivos sempre: a matriz não mede mais o jogador que os ignora. A seção 14 é essa medida.
- O Preguiçoso só mostra o problema do ouro porque não mexe em quem já trabalha; um jogador de verdade põe alguém na Mina. A medida dele é um teto do atraso, não uma previsão.
- O bot não lê `objectives[].missing`: só `target` e `progress`.
- As outras duas dificuldades jogam 3 sementes na suíte e 50 pelo comando; a linha de base de Camponês e de Rei de Ferro é a das 50.
- Nenhum número de jogo foi mexido por causa desta rodada.

## 16. As correções das cartas da revisão das Fases D e E (V2DE)

A revisão independente das Fases D e E achou duas cartas com números a corrigir. Esta seção registra a rodada da matriz depois de cada uma, como o comentário de `MEASURED`, em `packages/sim-cli/src/bands.ts`, pede. Nenhum número de `balance.ts` mudou: só os efeitos das cartas, em `packages/content/src/cards/`.

| | |
|---|---|
| Data | 2026-10-02 |
| Commit | os desta seção (`git log --grep "V2DE: corrige"`, na branch `web-track`), feitos sobre `e693e3d` |
| Identificação | Motor 0.1.0 · estado v11 · conteúdo `3cf7000da6b0c55e` (16.1) e `32e60cd2b32b10bb` (16.2) |
| Dificuldades | Camponês, Senhor e Rei de Ferro |
| Sementes | 50 fixas: `pedra-alta-001` a `pedra-alta-050` |
| Máquina | Apple M5, macOS 26.6.2, Node 24.19.0 |

O comando é o da seção 15.2, nas três dificuldades.

### 16.1 Os pilares de pedra da Ponte dão +5 de moral por 3 dias (achado 13)

O inventário (docs/content-v0.2.md, seção 5) dava a Ponte como caminho até os 80 de moral, e um teste somava no papel as vigas da primeira carta com a festa da última; entre as duas há a carta do meio, e no motor o máximo era 75. "Assentar pilares de pedra" passou a dar +5 de moral por 3 dias, além do grão escondido: respondida logo, ela ainda conta na virada em que a festa do desfecho começa, e o feudo passa um dia em 80.

O bot paga os pilares quando a pedra sobra, e por isso a economia dele muda um pouco. Em Senhor, 228 das 900 partidas da matriz mudaram em algum número; nenhuma ganhou fome, frio, recusa nem quem vá embora.

- **População:** 25 partidas terminam com outra população, quase todas com um a cinco aldeões a mais (os colonos dos dias em 80); a faixa de cada célula não mudou. Duas perderam um nível do Salão (Tranquilo, semana, Regular, semente 001: 6 para 5; Rápido, ano, Regular, semente 015: 5 para 4), dentro da faixa.
- **O Armazém no Rápido:** duas sementes do Regular fecham o ano de jogo sem ele (eram três; a 013 passou a erguê-lo na hora 56).
- **A meta de desperdício no Rápido, ano de jogo:** a pior sequência voltou a 18 h de jogo (era 15), de comida, na semente 025: a fazenda rende mais e a Despensa enche antes. A meta já não era cumprida no Rápido (seção 15).
- **Faixas:** com a linha de base da seção 15, quatro células saíam da faixa por uma semente: em Senhor, a sequência de 18 h acima; em Camponês, o ouro parado do Regular no ritmo Normal (18.112, o limite era 14.077) e do Dedicado no Tranquilo; em Rei de Ferro, o ouro parado do Dedicado no ritmo Normal (42.128 para 42.018). `MEASURED` passou a ser a linha de base desta rodada, nas três dificuldades, com a mesma regra de folga; os números fixados em `balance.test.ts`, `bands.test.ts` e `matrix.test.ts` foram atualizados com o porquê.

### 16.2 A Paliçada erguida, mostrada aos aldeões, dá +20 de moral (achado 12)

Com a cerca de pé, "Prometer a paliçada" rendia mais que "Mostrar a paliçada erguida" em tudo: +10 por 3 dias e, na cobrança, +15 por 3, contra +10 por 3. E o pedido chega quase sempre a quem já ergueu a cerca (23 de 24 chegadas na revisão). Mostrar passou a dar +20 por 3 dias: leva aos 80 na hora; prometer e mostrar no prazo rende mais dias acima da base, mas nunca passa de 75. Desfazer a promessa passou a durar 4 dias (−10), um a mais que a promessa: prometer e desfazer deixou de ser um adiantamento de moral sem custo. Os números que o GDD §7.1 dá à cadeia (+10, +15, +5, −10 e −15) não mudaram. Identificação: conteúdo `32e60cd2b32b10bb`.

Os bots mostram a obra quando ela existe (é a primeira opção sem custo que eles alcançam), e por isso esta é a mudança que mais mexe na matriz: em Senhor, 680 das 900 partidas mudam em algum número (688 em Camponês, 667 em Rei de Ferro), quase sempre pelo sorteio que passa a correr diferente depois dos três dias em 80.

- **População:** em Senhor, 188 partidas terminam com outra população; 155 com mais gente (de um a oito aldeões: os colonos dos dias em 80), 33 com menos (até nove, pelo caminho que o sorteio tomou). A faixa do Regular no ritmo Normal foi de 60 a 71 para 57 a 72 aldeões, e o Salão continua no nível 7.
- **Nada piorou no que as faixas cobram de duro:** nenhuma hora de fome nem de frio, nenhuma recusa, ninguém vai embora; a moral mínima de cada célula não mudou.
- **Faixas:** com a linha de base de 16.1, saíam da faixa, por uma ou duas sementes, os excedentes parados de algumas células (mais gente, mais produção) e, em Rei de Ferro, a semana do Tranquilo do Regular, por duas sementes (001 e 023: no fim da semana, o estoque juntado para a obra seguinte ainda estava parado; na 001 o Salão ficou um nível abaixo, no 5, dentro da faixa). `MEASURED` passou a ser a linha de base desta rodada nas três dificuldades, e os números fixados nos testes do simulador foram atualizados (o teto do preguiçoso no teste dos bots passou de 75 para 80: ele também mostra a obra).

### 16.3 Com quem roda as matrizes depois

A tarefa que mexe na Ameaça (balance.ts e GDD §8.2) roda ao mesmo tempo em outra trilha e também regrava `MEASURED`. As duas linhas de base não se somam: depois de juntar as trilhas, a matriz precisa rodar de novo nas três dificuldades, sobre o conteúdo das duas.
