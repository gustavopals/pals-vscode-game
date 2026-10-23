# Balanceamento da v0.4

Medições do simulador durante a v0.4 "Guerra e Cerco", no molde de [balance-v0.3.md](balance-v0.3.md). Cada seção diz a data, o commit, o `contentHash`, o Node e os comandos. As faixas da matriz estão em `packages/sim-cli/src/bands.ts` (`MEASURED`) e são guarda de regressão, não metas aprovadas pelo autor.

## 1. Linha de base: a v0.3 publicada (V4A-T1, 2026-10-16)

**Commit:** `dbe38ac` (o código é o mesmo de `c2cb21e`, que está no ar; depois dele, só documentos). **`contentHash`:** `3a006cc05fed0b0f`, o mesmo de `GET /v1/version` em produção. **Node:** 22.22.3. **Estado:** versão 24; protocolo 3.

### 1.1 Comandos

```bash
pnpm -s sim -- --matrix --difficulty lord > a1-lord.csv 2> a1-lord.md
pnpm -s sim -- --matrix --difficulty peasant > a1-peasant.csv 2> a1-peasant.md
pnpm -s sim -- --matrix --difficulty ironKing > a1-ironKing.csv 2> a1-ironKing.md
pnpm -s sim -- --matrix --profile ousado > a1-ousado.csv 2> a1-ousado.md
pnpm -s sim -- --matrix --profile especulador > a1-spec.csv 2> a1-spec.md
pnpm -s sim -- --perf
```

As saídas ficaram fora do repositório, como nas rodadas da v0.3.

### 1.2 As faixas

**As 3.600 partidas da rodada padrão (1.200 por dificuldade) ficaram dentro das faixas**, nas três dificuldades (as três matrizes saíram com código 0), e as do `ousado` e do `especulador` rodaram sem erro (são perfis sem faixa). Fome e frio em zero. **A arbitragem do especulador dá prejuízo** em todo ritmo (saldo por partida de −94, −9,6 e −0,5 de ouro no Rápido, no Normal e no Tranquilo): comprar no balcão para revender por caravana continua sem lucro.

A linha de base de cada célula é a de `MEASURED`, regravada na retomada da v0.3 ([balance-v0.3.md](balance-v0.3.md), seção 15). Nenhum número de conteúdo mudou desde então.

### 1.3 O ouro por fonte e por destino (Senhor, média por partida, 50 sementes)

É a régua da §13 do [roadmap](roadmap-v0.4.md) e da decisão 2 do [ADR 0019](decisions/0019-ferro-exercito-formacoes-e-combate-na-v0.4.md): os destinos novos da v0.4 (o ferro, o treino, o reparo, a Muralha) têm de aparecer nesta tabela.

**7 dias reais:**

| Ritmo | Perfil | Mina · balcão · caravanas · saque · prêmios e cartas | Soldo · Taverna · obras · recrutamento · compras · cartas e outros | Ouro parado no fim |
| --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso | 14.822 · 0 · 0 · 0 · 100 | 720 · 0 · 8.866 · 310 · 0 · 0 | 5.208 |
| Rápido 3× | Regular | 202.947 · 471 · 619 · 0 · 100 | 864 · 0 · 15.213 · 543 · 0 · 258 | 185.969 |
| Rápido 3× | Dedicado | 365.865 · 3.077 · 3.342 · 0 · 100 | 936 · 0 · 16.486 · 644 · 0 · 455 | 352.628 |
| Rápido 3× | Explorador | 259.331 · 1.014 · 769 · 211 · 106 | 4.868 · 1.056 · 17.169 · 588 · 0 · 296 | 236.003 |
| Normal 1× | Preguiçoso | 3.568 · 0 · 0 · 0 · 100 | 196 · 0 · 3.211 · 260 · 0 · 0 | 221 |
| Normal 1× | Regular | 25.136 · 239 · 27 · 0 · 100 | 282 · 0 · 9.637 · 566 · 0 · 147 | 14.790 |
| Normal 1× | Dedicado | 25.557 · 1.403 · 1.187 · 0 · 100 | 288 · 0 · 15.775 · 751 · 0 · 153 | 10.819 |
| Normal 1× | Explorador | 23.308 · 477 · 109 · 100 · 121 | 1.032 · 749 · 12.154 · 607 · 0 · 146 | 9.205 |
| Tranquilo 0,5× | Preguiçoso | 1.299 · 0 · 0 · 0 · 100 | 120 · 0 · 1.011 · 240 · 0 · 0 | 261 |
| Tranquilo 0,5× | Regular | 4.815 · 157 · 0 · 0 · 100 | 120 · 0 · 3.894 · 445 · 0 · 69 | 737 |
| Tranquilo 0,5× | Dedicado | 6.189 · 236 · 0 · 0 · 100 | 120 · 0 · 5.405 · 485 · 0 · 92 | 581 |
| Tranquilo 0,5× | Explorador | 5.242 · 139 · 0 · 36 · 135 | 200 · 364 · 3.985 · 444 · 0 · 68 | 667 |

**Um ano de jogo:**

| Ritmo | Perfil | Mina · balcão · caravanas · saque · prêmios e cartas | Soldo · Taverna · obras · recrutamento · compras · cartas e outros | Ouro parado no fim |
| --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso | 588 · 0 · 0 · 0 · 100 | 48 · 0 · 606 · 110 · 0 · 0 | 142 |
| Rápido 3× | Regular | 5.093 · 0 · 0 · 0 · 100 | 192 · 0 · 2.967 · 219 · 0 · 82 | 1.915 |
| Rápido 3× | Dedicado | 17.301 · 193 · 11 · 0 · 100 | 264 · 0 · 7.004 · 460 · 0 · 136 | 9.378 |
| Rápido 3× | Explorador | 5.471 · 0 · 0 · 21 · 100 | 293 · 312 · 3.063 · 233 · 0 · 79 | 1.750 |
| Normal 1× | Preguiçoso | 3.568 · 0 · 0 · 0 · 100 | 196 · 0 · 3.211 · 260 · 0 · 0 | 221 |
| Normal 1× | Regular | 25.136 · 239 · 27 · 0 · 100 | 282 · 0 · 9.637 · 566 · 0 · 147 | 14.790 |
| Normal 1× | Dedicado | 25.557 · 1.403 · 1.187 · 0 · 100 | 288 · 0 · 15.775 · 751 · 0 · 153 | 10.819 |
| Normal 1× | Explorador | 23.308 · 477 · 109 · 100 · 121 | 1.032 · 749 · 12.154 · 607 · 0 · 146 | 9.205 |
| Tranquilo 0,5× | Preguiçoso | 13.316 · 0 · 0 · 0 · 100 | 288 · 0 · 9.369 · 590 · 0 · 0 | 3.375 |
| Tranquilo 0,5× | Regular | 28.124 · 360 · 470 · 0 · 100 | 288 · 0 · 15.171 · 753 · 0 · 148 | 12.498 |
| Tranquilo 0,5× | Dedicado | 33.863 · 7.313 · 4.024 · 0 · 100 | 288 · 0 · 16.949 · 762 · 0 · 179 | 26.954 |
| Tranquilo 0,5× | Explorador | 30.460 · 639 · 564 · 439 · 136 | 1.437 · 789 · 16.985 · 730 · 0 · 142 | 11.942 |

O que a tabela diz: **a Mina de Ouro rende quase todo o ouro**, e **ninguém compra no balcão** (a coluna "compras" é zero em toda célula: os bots só vendem). O soldo e a Taverna somam de 0% a 3% do que a Mina rende. Na semana do Rápido, o Regular termina com 186 mil de ouro parado. É esse número que os sumidouros da v0.4 têm de mexer; se não mexerem, a decisão 2 volta ao autor com propostas antes da Fase D.

### 1.4 Desempenho

`pnpm -s sim -- --perf`, ritmo 3, Node 22.22.3, 9 repetições por medida. O pior caso é o feudo de 2 dias reais que fica 30 dias fora: **`advanceTo` de 34 ms na mediana e 40 ms no pior**, com 1.080 viradas de dia e 2.639 eventos. O estado fica entre 2,4 e 5,3 kB e a visão entre 20 e 33 kB (o feudo de 7 dias reais com 85 habitantes). `deriveViewState` leva de 1 a 1,7 ms. É a régua contra a qual a v0.4, com batalhas e cerco, será medida.

### 1.5 Limites desta medição

- **Ninguém jogou a v0.3.** A linha de base mede bots e regras.
- **A carga com 50 bots (`--remote`) não rodou**: o Docker não estava disponível nesta sessão, e a API de desenvolvimento precisa do banco.
- **A hora do primeiro herói por perfil** contra a meta "primeiro herói no dia 2" (V3G-T1.2) não foi tirada à parte: a coluna "Primeiro herói (h)" das tabelas da Guilda da matriz dá de 12 a 48 h reais, conforme o ritmo e o perfil. **No ritmo Normal o Regular recebe o primeiro herói entre as horas 24 e 36, no dia real 2**, como a meta do GDD §15.2 pede.

## 2. O ferro: o recurso e o ferro no Mercado (V4B-T1)

Tarefa V4B-T1 do [roadmap da v0.4](roadmap-v0.4.md), subtarefas 2 a 4 e 6 (o recurso, o estado 25, o Mercado e a visão). Medido antes da Mina Abandonada (V4B-T1.5): nesta rodada **nenhum bot acha ferro**, e o que muda é só o sorteio do Mercado.

| | |
|---|---|
| Data | 2026-10-16 |
| Commit | o da V4B-T1.2 a T1.4 e T1.6 (estado 25), sobre `ab86177` |
| Máquina | Linux 6.6 (WSL2), Node v22.22.3 (o do `.nvmrc`) |
| Sementes | 50 fixas: `pedra-alta-001` a `pedra-alta-050` |
| Dificuldade | Senhor (as de Camponês e de Rei de Ferro **não foram remedidas**) |

```bash
pnpm -s sim -- --matrix > m-lord.csv 2> m-lord.md
```

### O que mudou e por quê

O passeio do preço sorteia, a cada virada com o Mercado de pé, um passo por recurso no fluxo `market`, na ordem do conteúdo. Com o ferro em `MARKET_RESOURCE_IDS` a ordem passou a ser comida, madeira, pedra e **ferro**, e o fluxo anda quatro passos por virada em vez de três: **todo preço depois da primeira virada com o Mercado de pé é outro**, também o da comida, da madeira e da pedra. É a regra nova, e não um efeito do bot: as faixas que mudaram foram remedidas de propósito.

Das 24 células de Senhor, **14 mudaram, todas de perfil que negocia** (Regular, Dedicado e Explorador, que usam o `economico`); as quatro do Preguiçoso, que não ergue o Mercado, não mexeram. A mudança é pequena e só no excedente parado e, em duas, na população máxima do Explorador (77 → 76):

| Célula | Antes (V3G) | Depois (V4B-T1) |
|---|---|---|
| `week/3/regular` | `measured([75, 85], 8, 0, 0, 5200, 5138, 200244, 30)` | `measured([75, 85], 8, 0, 0, 5200, 5138, 200203, 30)` |
| `week/3/dedicado` | `measured([85, 85], 8, 0, 0, 4823, 5188, 368996, 15)` | `measured([85, 85], 8, 0, 0, 4542, 5188, 368901, 15)` |
| `week/3/explorador` | `measured([85, 85], 8, 0, 0, 4180, 5091, 280429, 30)` | `measured([85, 85], 8, 0, 0, 4180, 5091, 280398, 30)` |
| `week/1/regular` | `measured([65, 75], 7, 0, 0, 3981, 3930, 25973, 10)` | `measured([65, 75], 7, 0, 0, 4445, 3924, 25987, 10)` |
| `week/1/dedicado` | `measured([84, 85], 8, 0, 0, 5200, 5200, 14064, 5)` | `measured([84, 85], 8, 0, 0, 5200, 5200, 14348, 5)` |
| `week/1/explorador` | `measured([66, 77], 7, 0, 0, 5200, 4781, 17863, 9)` | `measured([66, 76], 7, 0, 0, 5200, 4781, 17850, 9)` |
| `week/0.5/dedicado` | `measured([54, 56], 5, 0, 0, 2172, 1226, 1269, 1)` | `measured([54, 56], 5, 0, 0, 2200, 1178, 1269, 1)` |
| `week/0.5/explorador` | `measured([44, 55], 5, 0, 0, 1162, 934, 911, 1.5)` | `measured([44, 55], 5, 0, 0, 1138, 934, 1235, 1.5)` |
| `year/1/regular` | `measured([65, 75], 7, 0, 0, 3981, 3930, 25973, 10)` | `measured([65, 75], 7, 0, 0, 4445, 3924, 25987, 10)` |
| `year/1/dedicado` | `measured([84, 85], 8, 0, 0, 5200, 5200, 14064, 5)` | `measured([84, 85], 8, 0, 0, 5200, 5200, 14348, 5)` |
| `year/1/explorador` | `measured([66, 77], 7, 0, 0, 5200, 4781, 17863, 9)` | `measured([66, 76], 7, 0, 0, 5200, 4781, 17850, 9)` |
| `year/0.5/regular` | `measured([84, 85], 8, 0, 0, 5200, 5200, 17935, 4.5)` | `measured([84, 85], 8, 0, 0, 5200, 5200, 16259, 4.5)` |
| `year/0.5/dedicado` | `measured([84, 85], 8, 0, 0, 5198, 5200, 34281, 2.5)` | `measured([84, 85], 8, 0, 0, 5198, 5197, 33481, 2.5)` |
| `year/0.5/explorador` | `measured([83, 85], 8, 0, 0, 5200, 5200, 23435, 5.5)` | `measured([83, 85], 8, 0, 0, 5200, 5200, 23410, 5.5)` |

Os campos de `measured` são: população (menor e maior), Salão, horas de fome, horas de frio, excedente parado de madeira, de pedra e de ouro, e a maior sequência desperdiçando. As maiores mudanças são o excedente de madeira do Regular no ritmo Normal (3.981 → 4.445, uma semente: `pedra-alta-045`) e o de ouro do Explorador no Tranquilo (911 → 1.235, uma semente: `pedra-alta-048`); nos dois casos o preço de um dia caiu do outro lado da regra de venda do bot. **O ouro parado não mudou de ordem de grandeza.**

**O que não foi medido nesta rodada:** as matrizes de Camponês e de Rei de Ferro, os perfis `ousado` e `especulador`, a tabela "Ouro por fonte e por destino" e o ano de jogo do Explorador. O teste de outra dificuldade da matriz roda com uma semente e confere a faixa dela.

### Com a Mina Abandonada (V4B-T1.5)

Mesma matriz, depois de a Mina entrar no catálogo e de a Floresta Antiga passar a revelá-la. Só as células do Explorador mudaram (o único perfil que manda expedição), e todas as partidas ficaram dentro das faixas antes da regravação:

| Célula | Antes da Mina | Com a Mina |
|---|---|---|
| `week/3/explorador` | `measured([85, 85], 8, 0, 0, 4180, 5091, 280398, 30)` | `measured([85, 85], 8, 0, 0, 4180, 5200, 277746, 30)` |
| `week/1/explorador` | `measured([66, 76], 7, 0, 0, 5200, 4781, 17850, 9)` | `measured([66, 76], 7, 0, 0, 4999, 4854, 18655, 9)` |
| `year/1/explorador` | `measured([66, 76], 7, 0, 0, 5200, 4781, 17850, 9)` | `measured([66, 76], 7, 0, 0, 4999, 4854, 18655, 9)` |
| `year/0.5/explorador` | `measured([83, 85], 8, 0, 0, 5200, 5200, 23410, 5.5)` | `measured([83, 85], 8, 0, 0, 5200, 5200, 20490, 5.5)` |

Os envios à Mina, por ritmo, em 50 partidas de 7 dias reais (envios · nós Sucesso Pleno/Sucesso/Revés/Desastre): **Rápido 139 · 74/111/54/1; Normal 56 · 27/50/31/0; Tranquilo 6 · 3/4/2/0.** No Rápido sai um Desastre em 139 envios. Nesta rodada o bot ainda não vendia o ferro que trazia; a tabela do Mercado do relatório ainda não tem a coluna do ferro.

### O Explorador vende o ferro (V4B-T1.8)

Mesma matriz, com o bot vendendo todo o ferro a cada visita com o Mercado de pé (até o Ferreiro o ferro não tem uso). Só as quatro células do Explorador mudaram, e só no ouro parado; antes da regravação uma partida saiu da faixa (`year/0.5/explorador`, ouro parado 21.549 contra o limite de 21.515, semente `pedra-alta-007`): é a venda do ferro, e a faixa foi remedida de propósito.

| Célula | Com a Mina | Vendendo o ferro |
|---|---|---|
| `week/3/explorador` | `measured([85, 85], 8, 0, 0, 4180, 5200, 277746, 30)` | `measured([85, 85], 8, 0, 0, 4180, 5200, 277964, 30)` |
| `week/1/explorador` | `measured([66, 76], 7, 0, 0, 4999, 4854, 18655, 9)` | `measured([66, 76], 7, 0, 0, 4999, 4854, 18990, 9)` |
| `year/1/explorador` | `measured([66, 76], 7, 0, 0, 4999, 4854, 18655, 9)` | `measured([66, 76], 7, 0, 0, 4999, 4854, 18990, 9)` |
| `year/0.5/explorador` | `measured([83, 85], 8, 0, 0, 5200, 5200, 20490, 5.5)` | `measured([83, 85], 8, 0, 0, 5200, 5200, 21549, 5.5)` |

**O ouro parado do Explorador subiu de 0,1% a 5%**: o ferro vendido vira ouro e não tem destino (é a §13 do roadmap, "o ouro sem destino"). Na semente `pedra-alta-001`, 7 dias reais no Rápido, o Explorador trouxe 31 de ferro da Mina e terminou com o estoque de ferro em zero.

### Camponês e Rei de Ferro (2026-10-19)

Rodadas no branch `v4b-t1-ferro`, com a T1.7 e a T1.8 juntas, no Node 22 (`pnpm -s sim -- --matrix --difficulty peasant` e `--difficulty ironKing`):

- **Camponês:** as 1.200 partidas **dentro das faixas** de antes (código 0). Nenhuma célula precisou ser remedida.
- **Rei de Ferro:** três partidas saíram da faixa por pouco: o Explorador da semana do Rápido, com 3.026 de madeira parada contra o limite de 2.919, e o Regular do Normal, com 23.340 de ouro parado contra 23.042, nas duas janelas. É o efeito da ordem nova do sorteio do Mercado (comida, madeira, pedra, ferro), como em Senhor: a regra mudou de propósito, e **14 das 24 células** de Rei de Ferro foram remedidas com a linha de base desta rodada. Fome e frio continuam em zero.

## 3. O Ferreiro e as armas (V4B-T2)

**O que mudou no conteúdo:** o edifício `smithy` (Salão Nv4; 200 de madeira, 200 de pedra e 150 de ouro, 20 min de jogo; até o nível 6) e `balance.smithy` (2 de ferro + 1 de madeira por arma; 6 min de jogo por arma, × 10 / (10 + nível − 1); lote de 1 a 10; cancelar devolve 80%). O custo de todo nível cabe no Armazém que o Salão daquele nível deixa erguer, nas três dificuldades (`packages/content/src/smithy.test.ts`).

**O que o simulador mede:** nada mudou nas faixas. O Ferreiro foi tirado da corrida das obras de todos os bots (`sideBuildings`) e a política `erguer o Ferreiro` só age depois do Quartel, que é da Fase C e ainda não existe: nenhuma partida simulada ergue o Ferreiro, nenhuma forja, e o ferro continua sendo todo vendido (`surplusOf` só o guarda com o Ferreiro de pé). Por isso nenhuma faixa foi remedida de propósito, e a matriz do `pnpm test` (3 perfis × 3 ritmos × 50 sementes em Senhor, mais o Explorador) continua dentro das mesmas faixas da V4B-T1, sem mudar uma. O CSV ganhou as colunas `smithy` (o nível, junto dos outros edifícios) e `weapons` (as armas forjadas), as duas em zero. Um teste (`packages/sim-cli/src/bots/ferreiro.test.ts`) confere que a semana do Explorador termina com o Ferreiro em 0 e zero armas, e que `forjar armas` põe o maior lote que o estoque paga quando o Ferreiro está de pé.

**O que ficou sem medir:** o ritmo da forja contra o ferro que a Mina rende (70 a 80 por viagem; um lote cheio de 10 armas pede 20 de ferro e 10 de madeira), que só tem sentido com o Quartel pedindo armas (Fase C). Registrado como pendência B-14.

## 4. Desgaste e reparo do equipamento (V4B-T3)

**O que mudou no conteúdo:** `itemRarities[].durability` (Comum 8, Incomum 10, Raro 14, Épico 20), `balance.equipment.wearPerExpedition` (1) e `balance.equipment.repair` (ferro por ponto 1, 1, 2, 2; 2 min de jogo por ponto).

**O que o simulador mede:** a matriz padrão (3 perfis × 3 ritmos × 50 sementes em Senhor, mais o Explorador) rodou dentro das mesmas faixas da V4B-T2, **sem remedir nenhuma**. O Explorador equipa itens e eles agora se gastam (um ponto por volta); como nenhum bot ergue o Ferreiro (B-14), os itens que chegam a 0 ficam sem bônus e sem reparo. Nas janelas medidas isso não tirou nenhuma partida da faixa. A rodada de Camponês e de Rei de Ferro não foi repetida nesta tarefa. Pendência B-26.

## 4. A medição da Fase B (V4B-T5.3, 2026-10-21)

**Commit:** o `main` com o ferro, o Ferreiro e o reparo (estado 27; `7cb91ec` e as correções da segunda passada da revisão, que só mexem em textos e na guarda do reparo). **Node:** 22.22.3.

```bash
pnpm -s sim -- --matrix --difficulty lord
pnpm -s sim -- --matrix --difficulty peasant
pnpm -s sim -- --matrix --difficulty ironKing
pnpm -s sim -- --matrix --profile especulador
```

- **Senhor e Camponês:** as 2.400 partidas dentro das faixas (código 0). Nenhuma célula mudou.
- **Rei de Ferro:** uma semente do Explorador no ano do Tranquilo passou 0,2% do limite do ouro parado (48.183 contra 48.065). É o desgaste: os itens gastos mudam o desfecho das expedições do Explorador, e a regra mudou de propósito. **Duas células do Explorador remedidas** (a semana do Rápido e o ano do Tranquilo); fome e frio continuam em zero.
- **O especulador** continua sem lucro na arbitragem (saldo de −8,6 de ouro por partida no Normal).

**O ouro sem destino (a §13 do roadmap e a decisão 2):** a Fase B **não deu destino ao ouro**. A coluna de compras do Mercado continua zero em toda célula: nenhum bot compra ferro, porque sem o Quartel as armas não servem para nada. O Regular da semana do Rápido termina com 185.949 de ouro parado (eram 185.969 na linha de base, seção 1.3). A única mudança é o Explorador, que vende o ferro da Mina e recebe um pouco mais no balcão. **O sumidouro de verdade é o treino de soldados, da Fase C**, e é depois dele que a decisão 2 manda medir de novo (V4C-T4.3).

## 5. O Quartel e os soldados (V4C-T1)

**O Quartel entra no conteúdo e no estado 28 sem mudar nenhuma faixa.** Nenhum bot o ergue: ele fica fora da corrida das obras (`sideBuildings` e `inTheRace`, em `sim-cli/src/bots/policies.ts`), como o Ferreiro ficou na V4B-T2, e a política `erguer o Ferreiro` segue inerte (agora lê `army.built`, e não a presença do Quartel na lista de obras, que passou a existir em toda partida). Com isso a rodada padrão joga as mesmas partidas de antes: o conteúdo novo (Quartel, unidades, `balance.army`) e o estado novo (`army` vazio) não entram em nenhuma conta contínua enquanto não há soldado.

- **Faixas:** na V4C-T1 nenhuma foi remedida; as da V4C-T1.8 estão na subseção seguinte.
- **O que a conta de comida muda hoje:** nada na matriz (nenhum soldado). Para quem treinar: 10 soldados comem 15 por hora de jogo, e `army.foodText` e o termo "consumo" da explicação da comida mostram isso na visão.
- **Alcançabilidade (pendência C-1, respondida em 2026-10-21):** com 250 de madeira no nível 1, o Quartel Nv7 e Nv8 custavam 4.194 e 6.710, e o teto alcançável era 7 em Camponês e Senhor e 6 em Rei de Ferro. Com a madeira-base em 150 (resposta do autor), o Nv8 custa 4.026 e cabe no Armazém no nível 8 (5.200) em Camponês e Senhor; em Rei de Ferro o teto é 7, porque o Armazém para no 7 (3.680).


### 5.1 O bot `militar` e a política mínima de guerra (V4C-T1.8, 2026-10-21)

**O que mudou nos bots (decisão 25 do ADR 0019):** `erguer o Quartel` e `treinar soldados` entraram no `economico` (Regular, Dedicado e Explorador, que herda a lista) e no `preguicoso`. O Quartel nível 1 sai quando o estoque paga o custo inteiro, o feudo não está com fome e há 12 aldeões; fica fora da corrida das obras (`sideBuildings`). O treino põe um lote de Lanceiros ou Arqueiros (o de que há menos), de no máximo um terço do que o estoque paga e do lote, e só com o exército abaixo de um quarto dos aldeões, a comida sem fome, o saldo da comida cobrindo o consumo dos soldados novos e seis horas reais dele em estoque além da reserva de comida. O bot `militar` (`--strategy militar`, `--matrix --profile militar`, sem faixa) é o `economico` mais o Ferreiro, a forja e os Espadachins; o Explorador **deixou de ter** `erguer o Ferreiro` e `forjar armas` (a V4B-T2.6 os pusera nele, inertes), de modo que continua vendendo o ferro da Mina. Colunas novas do CSV: `soldiers`, `soldiers_by_unit` (`spearman:3;archer:2`), `training_batches` (lotes começados) e `army_food` (comida dos soldados por hora real).

**Formação ativa e Plano ainda não existem** (V4C-T2 e V4D): a política só treina. O `militar` não compra ferro (as armas só vêm da Mina do Explorador, que ele não tem); por isso, nas partidas medidas, ele forja pouco ou nada e treina Lanceiros e Arqueiros como o econômico. Registrado como pendência para a V4C-T2.

**A medição** (50 sementes por célula, `pnpm -s sim -- --matrix --difficulty <d>`, Node 22.22.3):

- **Fome e frio continuam em zero em todas as 72 células.** O soldado come 1,5 por hora de jogo e a política respeita o saldo da comida.
- **A população cai**, porque o soldado sai da população (decisão 7): o que mais mudou foi o Dedicado da semana do Rápido, de 85 para 75 aldeões em Senhor, e o Regular, de 75-85 para 66-76. Foi o que tirou as partidas das faixas antigas (37 avisos em Senhor, 27 em Camponês, 29 em Rei de Ferro, quase todos de população).
- **Células remedidas de propósito, com a linha de base desta rodada:** Senhor 22 de 24, Camponês 22 de 24, Rei de Ferro 20 de 24. O antes e o depois de cada célula estão no commit da `bands.ts`.
- **O Salão ficou mais baixo em seis células** (Senhor: Explorador da semana do Tranquilo 5 para 4 e Preguiçoso do ano do Tranquilo 7 para 6; Camponês: Regular da semana do Rápido 8 para 7 e Explorador da semana do Tranquilo 5 para 4; Rei de Ferro: Explorador da semana do Tranquilo 5 para 4 e Dedicado do ano do Rápido 6 para 5): a madeira e a pedra do Quartel (150 e 150) e o treino disputam a fila e o estoque com o Salão. É o custo real da guerra e foi aceito na faixa; fica para a V4C-T4 decidir se o Quartel deve esperar mais.
- **O ouro parado caiu**: Regular da semana do Rápido em Senhor, de 200.203 para 174.894; Dedicado, de 368.901 para 317.417. É o sumidouro que a decisão 2 esperava, ainda pequeno (o treino gasta 10 a 15 de ouro por soldado).
- **Regressão medida e aceita pelo autor em 2026-10-22: a meta de desperdício do Regular** (8 h de jogo seguidas indo ao chão) piora 1 h nas duas células do Normal que já estavam fora dela: de 10 para 11 h na semana e no ano, em três das 50 sementes (018, 029 e 041; eram 023, 025 e 035). No Rápido, a semana fica em 30 h, e nas três sementes da suíte a comida vai menos ao chão (de 21 a 24 h para 9 a 21 h). Rever quando as formações (V4C-T2) mudarem o que o bot faz.
- **O Explorador** volta a encher os seis lugares da Taverna nas 50 sementes da semana e do ano do Normal (eram de cinco a seis), e na semana do Rápido e no ano do Tranquilo termina com seis em todas (eram de seis a sete); a causa exata não foi investigada.

**Não verificado:** a matriz do `militar` (`--profile militar`) não foi rodada nesta tarefa; a medição do exército no cerco é da Fase E.

## 6. A medição do ouro da Fase C (V4C-T4.3, 2026-10-23)

**Pergunta (decisão 2 do ADR 0019):** com o ferro, o Ferreiro e o treino de soldados, o ouro parado caiu? A tabela "Ouro por fonte e por destino" do simulador ganhou o destino **exército** (`goldOut.army`, o ouro de `trainingStarted`; antes caía em "outros"). Rodadas: `pnpm -s sim -- --matrix` (Senhor, 50 sementes, rodada padrão) e `pnpm -s sim -- --matrix --profile militar`, no branch `v4c-t4-ouro-exercito`.

**Resposta: não.** O treino é um destino desprezível do ouro, e o ouro parado continua onde estava.

| Janela e ritmo | Perfil | Mina (por partida) | Exército | Obras | Ouro parado no fim |
| --- | --- | ---: | ---: | ---: | ---: |
| 7 dias, Rápido 3× | Regular | 174.044 | 112 | 15.442 | 157.085 |
| 7 dias, Rápido 3× | Dedicado | 314.474 | 125 | 16.586 | 300.214 |
| 7 dias, Rápido 3× | Explorador | 216.158 | 115 | 17.298 | 193.124 |
| 7 dias, Rápido 3× | Militar | 162.068 | 110 | 19.197 | 141.445 |
| 7 dias, Normal 1× | Regular | 20.370 | 93 | 9.572 | 10.106 |
| 7 dias, Normal 1× | Dedicado | 17.666 | 125 | 15.254 | 2.235 |
| 7 dias, Tranquilo 0,5× | Regular | 4.718 | 26 | 3.943 | 582 |

- **O exército leva 0,06% do que a Mina dá na semana do Rápido.** A política mínima de guerra treina até um quarto dos aldeões e um lote por vez, e o Quartel do bot fica no nível 1 (10 soldados): são 10 a 15 de ouro por soldado. Mesmo o Quartel cheio no nível 8 (80 soldados) daria uns 1.200 de ouro, menos de 1% do parado.
- **O ouro parado é um problema do ritmo Rápido.** Na semana do Rápido passam três anos de jogo: as obras acabam (o Regular esgota a lista na hora 154) e a Mina continua. No Normal a sobra é de 2.000 a 10.000; no Tranquilo, de 500 a 700.
- **O `militar` gasta como o Regular**, porque não compra ferro: quase não forja, e treina Lanceiros e Arqueiros como o econômico.
- **O ferro também não mudou o quadro:** nenhum bot da rodada padrão compra ferro (balcão de 0 a 2.737 de ouro por partida, quase tudo comida e lenha).

**Resposta do autor (2026-10-23, pendência C-9):** nenhuma regra nova antes da Fase D; o ouro parado do Rápido vai para custos de ouro de fim de jogo na Muralha e na Fortaleza (Fase E), dimensionados por esta medida e medidos de novo. Nenhum número foi mudado.

## 7. Tamanho e custo (V4A-T1.8, 2026-10-23)

**Pergunta:** com o estado na versão 29 (Quartel, soldados, formações), quanto pesam o estado e a visão no pior caso de hoje, e o que mudou no custo do motor e da API contra a v0.3 (balance-v0.3.md, seção 10.6)? Medido em Node v22.22.3, linux x64, no branch `v4a-t1-8-custo` (a partir do `fe50f71`).

### 7.1 Estado e visão no pior caso

Roteiro descartável fora do repositório (helpers de `packages/engine/src/test-helpers.ts`; `guildHall` na Guilda Nv4, Mercado Nv4, Quartel Nv8, Ferreiro Nv3, Salão Nv6; 60 aldeões; ritmo 3; JSON em bytes UTF-8). Acrescentado um item por linha, na ordem:

| Situação | Estado | Visão | `state.army` | `view.army` | `state.guild` | `view.guild` |
|---|---:|---:|---:|---:|---:|---:|
| 6 heróis, 4 Mestres, Quartel Nv8, sem soldados | 4.385 | 42.421 | 134 | 6.150 | 1.742 | 8.991 |
| + 3 relatórios guardados | 6.466 | 46.447 | 134 | 6.150 | 3.590 | 12.279 |
| + exército cheio (80 soldados) | 6.471 | 43.687 | 139 | 3.177 | 3.590 | 12.281 |
| + 5 formações salvas | 7.904 | 50.247 | 1.558 | 9.737 | 3.590 | 12.281 |
| + Defesa ativa | 7.937 | 50.248 | 1.567 | 9.737 | 3.590 | 12.281 |
| + 3 expedições viajando | 8.952 | 50.760 | 1.567 | 9.788 | 4.579 | 12.835 |
| **+ 2 caravanas na estrada** | **9.201** | **51.341** | 1.567 | 9.788 | 4.579 | 12.835 |
| + 1 equipe parada na encruzilhada (as caravanas já tinham chegado) | 8.931 | 51.975 | 1.567 | 9.754 | 4.246 | 13.374 |

- **O pior caso de hoje é de 9,2 kB de estado e 52,0 kB de visão**, contra 6,1 a 6,7 kB e 26,6 a 28,8 kB da referência da v0.3: **+2,5 kB de estado (+37%) e +23 kB de visão (+80%)**. Longe do dimensionamento do GDD §14 (visão de 100 kB), mas já metade dele.
- **Nem todo o salto é da v0.4.** O roteiro de hoje também tem Mestres (4), Mercado Nv4 com caravanas, Quartel Nv8 e Ferreiro, que o da v0.3 não tinha: sem nenhum soldado nem formação, o feudo de seis heróis já pesa 42,4 kB de visão (a referência da v0.3 era 22,8 kB só com seis heróis; o Mercado, `view.market`, soma 3,5 kB, e os Mestres, 4,1 kB). **Não separei a parte da v0.3 que o roteiro antigo não tinha da parte da v0.4**; a parte da v0.4 que se mede é a do Exército.
- **O Exército custa até 9,8 kB de visão e 1,6 kB de estado** (cinco formações salvas): 134 bytes de estado e 6,2 kB de visão com o Quartel erguido e vazio (`army.offer`, com as opções de treino de cada unidade), 3,2 kB com 80 soldados e nenhum lote e 9,7 kB com as cinco formações (1,4 kB de estado e 6,6 kB de visão pelas cinco, isto é, cerca de 285 bytes de estado e 1,3 kB de visão por formação).
- **O soldado não pesa:** 80 soldados = 5 bytes de estado (contadores por unidade).
- **O teto de `perf.test.ts` (estado abaixo de 5.500 bytes) não cobre este caso** (o bot não monta formações): 9,2 kB passa dele. Como na v0.3, o teto vale para o que o simulador mede.
- **Cada recibo de comando guarda uma visão inteira:** a tabela `commands` cresce na mesma proporção (52 kB por ordem no pior caso, contra 28,8 kB na v0.3). **O volume real em produção continua sem medida**; é o ponto a vigiar se a visão crescer mais nas Fases D e E.

### 7.2 `pnpm -s sim -- --perf` (1, 7 e 30 dias reais fora, ritmo 3, 9 repetições)

Motor 0.3.0 · estado v29 · conteúdo `df9daeb3a6f6b0f0`:

| Feudo | Ausência (dias reais) | `advanceTo` (ms, mediana) | `advanceTo` (ms, pior) | `deriveViewState` (ms, mediana) | Estado (bytes) | Visão (bytes) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Feudo novo, sem nenhuma ordem | 1 | 2,4 | 6,1 | 0,9 | 2.697 | 26.050 |
| Feudo novo, sem nenhuma ordem | 7 | 9,2 | 12,5 | 1,0 | 3.494 | 27.630 |
| Feudo novo, sem nenhuma ordem | 30 | 20,1 | 22,5 | 0,8 | 3.554 | 27.671 |
| Feudo de 2 dias reais (bot econômico) | 1 | 2,5 | 3,4 | 1,7 | 4.623 | 33.028 |
| Feudo de 2 dias reais (bot econômico) | 7 | 8,9 | 12,2 | 1,1 | 4.690 | 33.821 |
| Feudo de 2 dias reais (bot econômico) | 30 | 33,4 | 38,4 | 1,0 | 4.935 | 33.537 |
| Feudo de 7 dias reais (bot econômico) | 1 | 1,8 | 2,2 | 1,1 | 5.517 | 37.721 |
| Feudo de 7 dias reais (bot econômico) | 7 | 8,6 | 10,8 | 1,3 | 5.397 | 37.027 |
| Feudo de 7 dias reais (bot econômico) | 30 | 54,6 | 78,4 | 2,1 | 5.627 | 39.041 |

- **Contra a v0.3 (seção 10.6, 30 dias fora):** `advanceTo` de 13,6 a 19,4 ms passou para **20,1 a 54,6 ms** (o feudo de 7 dias foi de 19,4 para 54,6, 2,8 vezes); `deriveViewState` ficou em 0,8 a 2,1 ms (era 0,4 a 0,7). O estado do bot econômico foi de 4.515 para **5.627 bytes** e a visão, de 21.214 para **39.041** (+84%). Uma volta de 30 dias reais continua abaixo de 80 ms no pior caso, mas **o custo cresceu**; a rodada da v0.3 foi na máquina quieta e em Node v24.15.0, esta em Node v22.22.3 (não é a mesma máquina nem o mesmo Node: a comparação do tempo é indicativa).
- **O teto de `perf.test.ts` passou** (5 testes). O bot econômico agora treina soldados (política mínima de guerra, V4C-T1.8), o que explica parte do estado maior; **a causa da alta do `advanceTo` do feudo de 7 dias não foi isolada** (o soldado come por hora e o treino entra na linha do tempo; não medi o motor sem o Quartel).

### 7.3 Carga com 50 bots (`--remote`, API de desenvolvimento, banco de dev)

`pnpm -s sim -- --remote http://localhost:3000 --bots 50 --minutes 2` (API de `pnpm dev:api`, banco de dev na 5432, estratégia `economico`, ciclo de 2 s; 44,4 s de duração, 220 ciclos, 150 comandos aceitos, 0 recusados):

| Endpoint | Chamadas | p50 (ms) | p95 (ms) | máx (ms) |
|---|---:|---:|---:|---:|
| GET /events | 220 | 12,2 | 27,9 | 85,6 |
| GET /view | 230 | 17,7 | 286,4 | 503,3 |
| POST /auth/anonymous | 50 | 5,9 | 50,5 | 204,9 |
| POST /commands | 150 | 58,2 | 84,8 | 99,4 |
| POST /games | 10 | 47,4 | 116,6 | 116,6 |

- **A carga não valeu para 50 bots: só 10 conseguiram conta.** O limite de contas anônimas devolveu `429` a 40 dos 50 (e `429` a 10 leituras de `GET /view`, "tente de novo em 1 hora"). Os números acima são de **10 jogadores efetivos**, 150 comandos, e não de 50. A regra do limite é de produção e não foi mudada; uma carga de 50 contas pede outra forma (outro IP por bot ou o limite relaxado no ambiente de teste), que **não** foi feita nesta tarefa.
- O p95 de `GET /view` (286 ms) é de poucas leituras com a API recém-subida e as conexões sendo abertas; o p50 de 17,7 ms é o que se pode ler. Os feudos dos bots são novos (poucos kB), por isso **a carga não exercita o pior caso de 52 kB** de 7.1.
- A rodada deixou 10 contas "Bot N" no banco de dev.

### 7.4 O que não foi medido

- A carga real de 50 contas (7.3).
- O `advanceTo` e o `deriveViewState` **no pior caso de 7.1**: o roteiro mediu só tamanhos.
- O motor sem o Quartel, para isolar o custo da v0.4 no `advanceTo` (7.2).
- O volume da tabela `commands` em produção.
