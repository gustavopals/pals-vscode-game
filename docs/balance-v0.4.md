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
