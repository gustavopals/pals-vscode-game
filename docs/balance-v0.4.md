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
