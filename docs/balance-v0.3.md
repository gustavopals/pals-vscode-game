# Balanceamento da v0.3

Medições do simulador (`@lotg/sim-cli`) ao longo da v0.3, na ordem em que foram feitas, no formato de [balance-v0.2.md](balance-v0.2.md): cada rodada traz data, commit, comandos e a saída, para a seguinte poder ser comparada com ela. A seção 1 é a régua: o jogo como a v0.2 fechou, antes de qualquer mecânica da Guilda. As faixas que a CI cobra continuam em `packages/sim-cli/src/bands.ts`, e a história delas, em balance-v0.2.md (seções 2 a 20).

Nenhum número deste documento é promessa ao jogador ([ADR 0011](decisions/0011-ritmo-3x-no-mvp.md)): são medidas de um bot, não a duração de nada na tela.

## 1. Linha de base da v0.2 fechada

Tarefa V3A-T1 (subtarefas 7 e 8) do [roadmap da v0.3](roadmap-v0.3.md). É o jogo como a v0.2 fechou, com a Fase G inteira e o lançamento da `v0.2.0`, **sem nenhuma mecânica da v0.3 e sem nenhum número de jogo alterado**. Tudo o que a Guilda mudar na economia se compara com isto, e em primeiro lugar o **ouro parado** (seção 1.3): é o número que a v0.3 promete baixar (pendência C-5 da v0.2; [ADR 0016](decisions/0016-respostas-do-autor-as-pendencias-da-v0.2.md)).

| | |
|---|---|
| Data | 2026-10-05 |
| Commit | `7bff36b` (`main` igual a `origin/main`): é o `6788c41`, o fim da Fase G da v0.2, mais a revisão do roadmap da v0.3 e o lançamento da `v0.2.0` (versão dos pacotes) |
| Identificação | Motor 0.2.0 · estado v12 · conteúdo `cea08e6e14163458` (o mesmo `contentHash` que a produção responde em `GET /v1/version`) |
| Dificuldades | Camponês, Senhor e Rei de Ferro |
| Sementes | 50 fixas: `pedra-alta-001` a `pedra-alta-050` |
| Perfis | Preguiçoso (1 visita por dia, bot `preguicoso`), Regular (2, `economico`) e Dedicado (4, `economico`), nos ritmos Rápido 3×, Normal 1× e Tranquilo 0,5× |
| Máquina | Intel Core i7-12700T, Linux 6.6 (WSL2), **Node v24.15.0** (o `.nvmrc` pede o 22; a medição não foi repetida nele) |
| Portão no mesmo commit | `pnpm verify`: 94 arquivos, 5.162 testes e 1 falha esperada (`it.fails`), 181 s; integração: 23 arquivos, 468 testes; `pnpm build`; navegador: 95; página de apresentação: 37 e 7 pulados. Todos com código de saída 0, iguais ao portão final da Fase G |

### 1.1 Comandos

O CSV vai para a saída padrão; o relatório (ou o resumo), para a saída de erro.

```bash
pnpm -s sim -- --matrix --difficulty lord     > matriz-lord.csv     2> matriz-lord.md
pnpm -s sim -- --matrix --difficulty peasant  > matriz-peasant.csv  2> matriz-peasant.md
pnpm -s sim -- --matrix --difficulty ironKing > matriz-ironKing.csv 2> matriz-ironKing.md
pnpm -s sim -- --seed pedra-alta-001 --game-year --time-scale 3 --sessions-per-day 2 > regular-3x.csv
pnpm -s sim -- --seed pedra-alta-001 --game-year --time-scale 3 --strategy preguicoso --sessions-per-day 1 > preguicoso-3x.csv
pnpm -s sim -- --perf
```

Os seis saíram com código 0. **As três matrizes ficaram inteiras dentro das faixas**: 2.700 partidas (900 por dificuldade), nenhuma célula "fora". Os arquivos de saída não estão no repositório; o que este documento traz deles é o resumo das seções seguintes.

### 1.2 A matriz, nas três dificuldades

Menor e maior valor entre as 50 sementes (um número só quando são iguais), no formato das seções 18.2 e 20.2 de balance-v0.2.md, com duas colunas a mais (as horas reais da janela e a fila ociosa). "Parado" é o estoque no fim da janela; "Fila ociosa" são as horas reais com obra que podia começar; "Pior sequência" é a maior sequência de horas de jogo seguidas com um depósito cheio perdendo produção. **Nenhuma célula tem hora de fome nem de frio, nenhuma partida perde gente e nenhum bot dá ordem recusada**, nas três dificuldades (conferido no CSV, partida a partida). No ritmo Normal as duas janelas são a mesma partida, e as linhas se repetem.

**Senhor**

| Janela | Ritmo | Perfil | Horas reais | População | Salão | Madeira parada | Pedra parada | Ouro parado | Fila ociosa (h) | Pior sequência (h de jogo) |
|---|---|---|---:|---|---|---|---|---|---|---|
| 7 dias | Rápido 3× | Preguiçoso | 168 | 36 a 38 | 7 | 3.400 | 3.400 | 3.925 a 7.497 | 95 a 108 | 60 a 72 |
| 7 dias | Rápido 3× | Regular | 168 | 72 a 75 | 8 | 91 a 5.200 | 95 a 5.200 | 113.566 a 148.487 | 62 a 107 | 3 a 33 |
| 7 dias | Rápido 3× | Dedicado | 168 | 84 a 85 | 8 | 3.005 a 4.225 | 4.198 a 5.200 | 284.168 a 324.539 | 27 a 110 | 3 a 15 |
| 7 dias | Normal 1× | Preguiçoso | 168 | 31 a 33 | 5 | 34 a 1.136 | 2.075 a 2.647 | 1.034 a 1.139 | 38 a 78 | 14 a 16 |
| 7 dias | Normal 1× | Regular | 168 | 64 a 73 | 7 | 253 a 4.512 | 132 a 4.637 | 2.348 a 23.641 | 49 a 86 | 0 a 9 |
| 7 dias | Normal 1× | Dedicado | 168 | 84 | 8 | 1.972 a 5.200 | 2.855 a 5.200 | 2.587 a 21.575 | 54 a 103 | 1 a 5 |
| 7 dias | Tranquilo 0,5× | Preguiçoso | 168 | 20 | 3 | 872 a 1.071 | 1.561 a 1.576 | 26 a 30 | 85 a 87 | 5,5 |
| 7 dias | Tranquilo 0,5× | Regular | 168 | 50 a 54 | 6 | 50 a 1.037 | 162 a 1.254 | 38 a 1.044 | 51 a 61 | 0 a 1 |
| 7 dias | Tranquilo 0,5× | Dedicado | 168 | 60 a 65 | 6 | 23 a 1.781 | 7 a 1.173 | 53 a 940 | 53 a 67 | 0 a 1 |
| Ano de jogo | Rápido 3× | Preguiçoso | 56 | 16 | 3 | 83 a 194 | 387 a 517 | 51 a 304 | 16 a 20 | 54 a 63 |
| Ano de jogo | Rápido 3× | Regular | 56 | 27 a 30 | 5 | 21 a 783 | 145 a 1.114 | 1.870 a 3.052 | 18 a 23 | 0 a 9 |
| Ano de jogo | Rápido 3× | Dedicado | 56 | 51 a 55 | 6 a 7 | 54 a 1.650 | 14 a 2.091 | 1.130 a 12.964 | 18 a 33 | 0 a 15 |
| Ano de jogo | Normal 1× | Preguiçoso | 168 | 31 a 33 | 5 | 34 a 1.136 | 2.075 a 2.647 | 1.034 a 1.139 | 38 a 78 | 14 a 16 |
| Ano de jogo | Normal 1× | Regular | 168 | 64 a 73 | 7 | 253 a 4.512 | 132 a 4.637 | 2.348 a 23.641 | 49 a 86 | 0 a 9 |
| Ano de jogo | Normal 1× | Dedicado | 168 | 84 | 8 | 1.972 a 5.200 | 2.855 a 5.200 | 2.587 a 21.575 | 54 a 103 | 1 a 5 |
| Ano de jogo | Tranquilo 0,5× | Preguiçoso | 336 | 52 a 56 | 6 a 7 | 863 a 4.185 | 395 a 1.855 | 160 a 3.936 | 196 a 205 | 5,5 a 7 |
| Ano de jogo | Tranquilo 0,5× | Regular | 336 | 84 | 8 | 4.024 a 5.200 | 4.619 a 5.200 | 13.128 a 22.535 | 155 a 210 | 0 a 3 |
| Ano de jogo | Tranquilo 0,5× | Dedicado | 336 | 84 a 85 | 8 | 607 a 5.200 | 3.039 a 5.200 | 23.713 a 32.471 | 152 a 215 | 0 a 4 |

**Camponês**

| Janela | Ritmo | Perfil | Horas reais | População | Salão | Madeira parada | Pedra parada | Ouro parado | Fila ociosa (h) | Pior sequência (h de jogo) |
|---|---|---|---:|---|---|---|---|---|---|---|
| 7 dias | Rápido 3× | Preguiçoso | 168 | 36 a 38 | 7 | 4.250 | 4.250 | 3.960 a 7.524 | 102 a 113 | 60 a 63 |
| 7 dias | Rápido 3× | Regular | 168 | 72 a 76 | 8 | 2.631 a 5.636 | 3.676 a 6.500 | 132.557 a 152.495 | 88 a 122 | 3 a 33 |
| 7 dias | Rápido 3× | Dedicado | 168 | 84 a 85 | 8 | 2.666 a 5.520 | 4.347 a 6.500 | 296.216 a 323.662 | 46 a 106 | 3 a 15 |
| 7 dias | Normal 1× | Preguiçoso | 168 | 31 a 33 | 5 | 0 a 1.435 | 1.749 a 3.056 | 62 a 1.165 | 41 a 84 | 13 |
| 7 dias | Normal 1× | Regular | 168 | 62 a 72 | 7 a 8 | 81 a 5.029 | 217 a 4.985 | 188 a 18.058 | 64 a 92 | 0 a 8 |
| 7 dias | Normal 1× | Dedicado | 168 | 84 a 85 | 8 | 4.923 a 6.500 | 5.838 a 6.500 | 12.284 a 20.225 | 79 a 102 | 0 a 3 |
| 7 dias | Tranquilo 0,5× | Preguiçoso | 168 | 20 | 3 | 1.463 a 1.727 | 2.052 a 2.067 | 26 a 30 | 86 a 88 | 3 |
| 7 dias | Tranquilo 0,5× | Regular | 168 | 50 a 54 | 6 | 34 a 1.008 | 278 a 1.125 | 158 a 935 | 51 a 62 | 0 |
| 7 dias | Tranquilo 0,5× | Dedicado | 168 | 58 a 65 | 6 | 8 a 1.491 | 333 a 1.227 | 76 a 1.237 | 56 a 70 | 0 a 1 |
| Ano de jogo | Rápido 3× | Preguiçoso | 56 | 16 | 3 | 69 a 363 | 387 a 517 | 51 a 202 | 17 a 22 | 51 a 60 |
| Ano de jogo | Rápido 3× | Regular | 56 | 27 a 30 | 5 | 0 a 641 | 321 a 1.104 | 1.778 a 3.560 | 18 a 24 | 0 a 6 |
| Ano de jogo | Rápido 3× | Dedicado | 56 | 50 a 55 | 6 a 7 | 110 a 1.915 | 1.057 a 3.307 | 1.274 a 13.816 | 15 a 26 | 0 a 9 |
| Ano de jogo | Normal 1× | Preguiçoso | 168 | 31 a 33 | 5 | 0 a 1.435 | 1.749 a 3.056 | 62 a 1.165 | 41 a 84 | 13 |
| Ano de jogo | Normal 1× | Regular | 168 | 62 a 72 | 7 a 8 | 81 a 5.029 | 217 a 4.985 | 188 a 18.058 | 64 a 92 | 0 a 8 |
| Ano de jogo | Normal 1× | Dedicado | 168 | 84 a 85 | 8 | 4.923 a 6.500 | 5.838 a 6.500 | 12.284 a 20.225 | 79 a 102 | 0 a 3 |
| Ano de jogo | Tranquilo 0,5× | Preguiçoso | 336 | 52 a 56 | 7 | 18 a 1.549 | 77 a 685 | 527 a 2.004 | 197 a 223 | 4 a 8 |
| Ano de jogo | Tranquilo 0,5× | Regular | 336 | 84 a 85 | 8 | 5.376 a 6.500 | 5.960 a 6.500 | 12.046 a 21.275 | 187 a 215 | 0 a 3 |
| Ano de jogo | Tranquilo 0,5× | Dedicado | 336 | 84 a 85 | 8 | 4.326 a 6.500 | 5.622 a 6.500 | 26.509 a 33.840 | 196 a 222 | 0 a 2,5 |

**Rei de Ferro**

| Janela | Ritmo | Perfil | Horas reais | População | Salão | Madeira parada | Pedra parada | Ouro parado | Fila ociosa (h) | Pior sequência (h de jogo) |
|---|---|---|---:|---|---|---|---|---|---|---|
| 7 dias | Rápido 3× | Preguiçoso | 168 | 36 a 38 | 7 | 3.200 | 3.200 | 3.942 a 7.536 | 88 a 101 | 63 a 75 |
| 7 dias | Rápido 3× | Regular | 168 | 72 a 75 | 7 | 1.896 a 2.804 | 2.770 a 3.680 | 148.435 a 165.302 | 24 a 95 | 9 a 24 |
| 7 dias | Rápido 3× | Dedicado | 168 | 74 a 75 | 7 | 2.034 a 2.837 | 3.482 a 3.680 | 266.497 a 294.121 | 19 a 88 | 9 a 45 |
| 7 dias | Normal 1× | Preguiçoso | 168 | 31 a 34 | 5 | 18 a 1.281 | 1.360 a 2.104 | 964 a 1.255 | 43 a 64 | 14 a 18 |
| 7 dias | Normal 1× | Regular | 168 | 64 a 71 | 6 a 7 | 6 a 3.680 | 27 a 3.680 | 3.057 a 19.717 | 28 a 72 | 0 a 5 |
| 7 dias | Normal 1× | Dedicado | 168 | 74 a 75 | 7 | 14 a 3.680 | 2.275 a 3.680 | 35.003 a 43.766 | 36 a 103 | 0 a 3 |
| 7 dias | Tranquilo 0,5× | Preguiçoso | 168 | 20 | 3 | 11 a 145 | 924 a 940 | 26 a 30 | 76 a 78 | 11 a 11,5 |
| 7 dias | Tranquilo 0,5× | Regular | 168 | 49 a 54 | 6 | 7 a 1.098 | 93 a 887 | 45 a 730 | 42 a 54 | 0 a 1 |
| 7 dias | Tranquilo 0,5× | Dedicado | 168 | 58 a 64 | 6 | 4 a 1.709 | 80 a 768 | 59 a 763 | 49 a 61 | 0 |
| Ano de jogo | Rápido 3× | Preguiçoso | 56 | 16 | 2 a 3 | 1 a 268 | 333 a 529 | 153 a 474 | 14 a 16 | 60 a 66 |
| Ano de jogo | Rápido 3× | Regular | 56 | 27 a 30 | 4 a 5 | 80 a 588 | 125 a 660 | 2.538 a 6.322 | 12 a 20 | 0 a 6 |
| Ano de jogo | Rápido 3× | Dedicado | 56 | 50 a 55 | 6 a 7 | 105 a 1.274 | 48 a 1.646 | 4.357 a 14.091 | 12 a 30 | 6 a 18 |
| Ano de jogo | Normal 1× | Preguiçoso | 168 | 31 a 34 | 5 | 18 a 1.281 | 1.360 a 2.104 | 964 a 1.255 | 43 a 64 | 14 a 18 |
| Ano de jogo | Normal 1× | Regular | 168 | 64 a 71 | 6 a 7 | 6 a 3.680 | 27 a 3.680 | 3.057 a 19.717 | 28 a 72 | 0 a 5 |
| Ano de jogo | Normal 1× | Dedicado | 168 | 74 a 75 | 7 | 14 a 3.680 | 2.275 a 3.680 | 35.003 a 43.766 | 36 a 103 | 0 a 3 |
| Ano de jogo | Tranquilo 0,5× | Preguiçoso | 336 | 48 a 53 | 6 | 637 a 3.200 | 594 a 1.956 | 828 a 5.802 | 167 a 217 | 11 a 11,5 |
| Ano de jogo | Tranquilo 0,5× | Regular | 336 | 74 a 75 | 7 | 814 a 3.672 | 2.298 a 3.680 | 40.471 a 44.215 | 179 a 211 | 0 a 3 |
| Ano de jogo | Tranquilo 0,5× | Dedicado | 336 | 74 a 75 | 7 | 103 a 3.680 | 995 a 3.680 | 40.826 a 53.059 | 107 a 214 | 0 a 3 |


**A meta de desperdício** (GDD §15.2, na leitura do ADR 0013, decisão 17), em Senhor, como a matriz a imprime. É uma meta, não uma faixa:

| Janela | Ritmo | Perfil | Comida (h de jogo) | Madeira (h de jogo) | Pedra (h de jogo) | Meta | Veredito |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 7 dias reais | Rápido 3× | Regular | 0 a 21 | 3 a 33 | 0 a 27 | ≤ 8 | **acima** |
| 7 dias reais | Normal 1× | Regular | 0 a 4 | 0 a 9 | 0 a 4 | ≤ 8 | **acima** |
| 7 dias reais | Tranquilo 0,5× | Regular | 0 | 0 a 1 | 0 | ≤ 8 | dentro |
| Um ano de jogo | Rápido 3× | Regular | 0 | 0 a 3 | 0 a 9 | ≤ 8 | **acima** |
| Um ano de jogo | Normal 1× | Regular | 0 a 4 | 0 a 9 | 0 a 4 | ≤ 8 | **acima** |
| Um ano de jogo | Tranquilo 0,5× | Regular | 0 a 2,5 | 0 a 3 | 0 a 1,5 | ≤ 8 | dentro |

#### Confere com a seção 20 de balance-v0.2.md?

**Confere.** A matriz é a mesma da última medição da v0.2, feita depois das cartas reescritas (V2G-T4), apesar de o `contentHash` ter mudado desde então (`701a1bbdee9d23f7` → `cea08e6e14163458`: as descrições das dificuldades e textos, que não chegam aos bots) e de o estado ter passado da versão 11 para a 12 (a deserção por fome em tempo real, que a matriz não mede: nenhum bot passa fome). O que foi conferido:

- **As 54 linhas "Linha de base medida nesta rodada"** que cada relatório imprime no fim (18 por dificuldade: população, Salão, fome, frio, madeira, pedra e ouro parados, pior sequência) são **iguais, número a número**, à tabela `MEASURED` de `packages/sim-cli/src/bands.ts`, que a seção 20.4 declara ser a linha de base daquela rodada e que não mudou desde o commit `070c7e5` (V2G-T4).
- **Células lidas contra o lado "depois" da tabela 20.2**, uma a uma: Senhor, 7 dias, Rápido, Dedicado (ouro 324.539); Senhor, Normal, Regular (pedra 4.637, ouro 23.641, população 64 a 73); Senhor, 7 dias, Tranquilo, Regular (pedra 1.254, ouro 1.044); Senhor, ano, Rápido, Dedicado (madeira 1.650, pedra 2.091, ouro 12.964, sequência 15); Senhor, ano, Tranquilo, Dedicado (ouro 32.471, sequência 4); Camponês, 7 dias, Rápido, Dedicado (ouro 323.662); Camponês, Normal, Regular (62 a 72 aldeões, ouro 18.058); Rei de Ferro, 7 dias, Rápido, Dedicado (ouro 294.121); Rei de Ferro, ano, Rápido, Dedicado (ouro 14.091, sequência 18); Rei de Ferro, ano, Tranquilo, Dedicado (ouro 53.059).
- **Não conferido:** as colunas que a seção 20 não traz (fila ociosa, desperdício por recurso, lobos, marcos de progresso) não têm medição anterior publicada com que comparar, fora as faixas; e os CSVs não foram comparados linha a linha com os da rodada da V2G-T4, que não foram guardados.

### 1.3 O ouro parado: o número que a v0.3 promete baixar

Ouro em estoque no fim da janela, em unidades, nas 50 sementes de cada célula: menor, mediana e maior. O ouro não tem limite de depósito na v0.2 e não tem destino depois que as obras acabam: tudo o que a mina rende além das obras e das cartas fica aqui. "7 dias" são 168 horas reais em todo ritmo (três anos de jogo no Rápido, um no Normal, meio no Tranquilo); "Ano de jogo" são 56 horas reais no Rápido, 168 no Normal e 336 no Tranquilo. No Normal as duas janelas são a mesma partida.

| Ritmo | Perfil | Dificuldade | 7 dias: menor | 7 dias: mediana | 7 dias: maior | Ano de jogo: menor | Ano de jogo: mediana | Ano de jogo: maior |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Rápido 3× | Preguiçoso | Senhor | 3.925 | 7.482 | 7.497 | 51 | 299 | 304 |
| Rápido 3× | Preguiçoso | Camponês | 3.960 | 7.511 | 7.524 | 51 | 198 | 202 |
| Rápido 3× | Preguiçoso | Rei de Ferro | 3.942 | 7.508 | 7.536 | 153 | 292 | 474 |
| Rápido 3× | Regular | Senhor | 113.566 | 128.436 | 148.487 | 1.870 | 2.176 | 3.052 |
| Rápido 3× | Regular | Camponês | 132.557 | 143.029 | 152.495 | 1.778 | 2.362 | 3.560 |
| Rápido 3× | Regular | Rei de Ferro | 148.435 | 154.854 | 165.302 | 2.538 | 2.928 | 6.322 |
| Rápido 3× | Dedicado | Senhor | 284.168 | 309.332 | 324.539 | 1.130 | 8.225 | 12.964 |
| Rápido 3× | Dedicado | Camponês | 296.216 | 309.405 | 323.662 | 1.274 | 3.414 | 13.816 |
| Rápido 3× | Dedicado | Rei de Ferro | 266.497 | 278.635 | 294.121 | 4.357 | 10.554 | 14.091 |
| Normal 1× | Preguiçoso | Senhor | 1.034 | 1.066 | 1.139 | 1.034 | 1.066 | 1.139 |
| Normal 1× | Preguiçoso | Camponês | 62 | 1.072 | 1.165 | 62 | 1.072 | 1.165 |
| Normal 1× | Preguiçoso | Rei de Ferro | 964 | 1.000 | 1.255 | 964 | 1.000 | 1.255 |
| Normal 1× | Regular | Senhor | 2.348 | 8.967 | 23.641 | 2.348 | 8.967 | 23.641 |
| Normal 1× | Regular | Camponês | 188 | 3.378 | 18.058 | 188 | 3.378 | 18.058 |
| Normal 1× | Regular | Rei de Ferro | 3.057 | 10.880 | 19.717 | 3.057 | 10.880 | 19.717 |
| Normal 1× | Dedicado | Senhor | 2.587 | 13.399 | 21.575 | 2.587 | 13.399 | 21.575 |
| Normal 1× | Dedicado | Camponês | 12.284 | 15.898 | 20.225 | 12.284 | 15.898 | 20.225 |
| Normal 1× | Dedicado | Rei de Ferro | 35.003 | 38.728 | 43.766 | 35.003 | 38.728 | 43.766 |
| Tranquilo 0,5× | Preguiçoso | Senhor | 26 | 30 | 30 | 160 | 2.714 | 3.936 |
| Tranquilo 0,5× | Preguiçoso | Camponês | 26 | 30 | 30 | 527 | 774 | 2.004 |
| Tranquilo 0,5× | Preguiçoso | Rei de Ferro | 26 | 30 | 30 | 828 | 3.948 | 5.802 |
| Tranquilo 0,5× | Regular | Senhor | 38 | 518 | 1.044 | 13.128 | 17.646 | 22.535 |
| Tranquilo 0,5× | Regular | Camponês | 158 | 492 | 935 | 12.046 | 18.462 | 21.275 |
| Tranquilo 0,5× | Regular | Rei de Ferro | 45 | 279 | 730 | 40.471 | 42.786 | 44.215 |
| Tranquilo 0,5× | Dedicado | Senhor | 53 | 244 | 940 | 23.713 | 28.208 | 32.471 |
| Tranquilo 0,5× | Dedicado | Camponês | 76 | 560 | 1.237 | 26.509 | 29.288 | 33.840 |
| Tranquilo 0,5× | Dedicado | Rei de Ferro | 59 | 265 | 763 | 40.826 | 47.260 | 53.059 |


O que se lê:

- **O ouro empilha onde as obras acabam.** No Rápido, o Regular termina a semana com 114 a 148 mil de ouro em Senhor e o Dedicado, com 284 a 325 mil: são três anos de jogo, e o feudo fica sem o que construir por volta do meio da semana (a matriz dá "Fim das obras" entre as horas 81 e 135 para o Dedicado; no Regular, a partir da hora 142 nas sementes em que as obras acabam). No primeiro ano de jogo o mesmo Regular tem 1,9 a 3,1 mil.
- **A escala é o tempo de jogo, não a dificuldade.** As três dificuldades ficam na mesma ordem de grandeza em cada célula. Rei de Ferro guarda **mais** ouro no Dedicado do Normal (35 a 44 mil, contra 2,6 a 21,6 mil em Senhor) e no Regular e no Dedicado do ano do Tranquilo (40 a 53 mil, contra 13 a 32 mil). A explicação provável é o teto mais baixo dos edifícios (seção 18.1 de balance-v0.2.md), que acaba com as obras mais cedo; ela não foi conferida partida a partida.
- **O Preguiçoso quase não acumula no primeiro ano do Rápido** (51 a 474). Na semana do Rápido ele chega a 7,5 mil, e a mediana fica colada no maior valor.
- **O que a v0.3 tem de mostrar** (roadmap, §8.3, "Ouro com destino"): estas mesmas células medidas de novo com soldo, Taverna e Mercado (V3C-T5, V3E-T5.2, V3G-T1). A comparação honesta é célula a célula e no ano de jogo, onde o jogador de verdade está; a semana do Rápido mede também o fim do conteúdo.

### 1.4 Duas partidas de exemplo

Semente `pedra-alta-001`, Senhor, ritmo Rápido, um ano de jogo (56 horas reais). O resumo como veio na saída de erro.

**Regular** (bot `economico`, 2 sessões por dia):

```
Semente pedra-alta-001 · estratégia economico · 56 horas reais · 2 sessões/dia · ritmo 3×
Partida: Senhor · Rápido: um ano em 56 horas
Motor 0.2.0 · estado v12 · conteúdo cea08e6e14163458
Políticas: erguer a Paliçada, seguir os objetivos, erguer a Torre, obra mais barata, ampliar o estoque, planejar automáticas, recrutar, responder a carta, alocar por demanda, guardar lenha
População: 27 de 55 vagas (mínima 7)
Níveis: townHall 5, farm 6, lumberMill 6, quarry 6, goldMine 5, housing 6, granary 3, warehouse 2, watchtower 2, palisade 2
Progresso: Salão Nv2 na hora 11, Salão Nv3 na hora 24, Salão Nv4 na hora 34, Celeiro na hora 15, Armazém na hora 37, Torre de Vigia na hora 20, Paliçada na hora 25 · 31 obras começaram sozinhas · ainda há obra por fazer no fim
Objetivos: 10 de 10 concluídos, o último na hora 56
Estoque: food 1069, wood 229, stone 836, gold 2203
Fome: nenhuma
Frio: nenhum
Moral: 60 no fim, mínima 50
Conselho: 10 cartas (1 continuação) · 8 respondidas, 0 expiradas · 0 efeitos escondidos
Ameaça: 70 no fim (máxima 81) · Torre de Vigia Nv2, erguida na hora 20
Lobos: 1 incursões sofridas, 4 repelidas (5 anunciadas pela Torre) · levaram food 30, wood 25 · 1 feridos · Paliçada Nv2, erguida na hora 25
Fila ociosa: 20 h com obra que podia começar (0 h com obra planejada)
Sem o início automático (as mesmas planejadas, manuais): 56 h com obra que podia começar (56 h com obra planejada)
Aldeões sem ofício: 243 aldeão-horas (4,3 por hora)
Excedente parado: wood 229, stone 836, gold 2203
Desperdício: food 0, wood 16, stone 0 (1 h com depósito cheio perdendo produção)
Da produção de cada recurso, foi ao chão: food 0%, wood 0%, stone 0%
Maior sequência desperdiçando, em horas de jogo: food 0, wood 3, stone 0 (meta do GDD §15.2 para 2 sessões por dia: até 8)
Comandos: 70 aceitos, 0 recusados
```

**Preguiçoso** (bot `preguicoso`, 1 sessão por dia):

```
Semente pedra-alta-001 · estratégia preguicoso · 56 horas reais · 1 sessões/dia · ritmo 3×
Partida: Senhor · Rápido: um ano em 56 horas
Motor 0.2.0 · estado v12 · conteúdo cea08e6e14163458
Políticas: erguer a Paliçada, seguir os objetivos, erguer a Torre, obra mais barata, ampliar o estoque, planejar automáticas, recrutar, responder a carta sem gastar, comida primeiro, ocupar os livres, guardar lenha
População: 16 de 35 vagas (mínima 7)
Níveis: townHall 3, farm 3, lumberMill 3, quarry 3, goldMine 3, housing 4, granary 2, warehouse 1, watchtower 1, palisade 1
Progresso: Salão Nv2 na hora 29, Salão Nv3 na hora 53, Salão Nv4 não alcançado, Celeiro na hora 31, Armazém na hora 33, Torre de Vigia na hora 50, Paliçada na hora 54 · 16 obras começaram sozinhas · ainda há obra por fazer no fim
Objetivos: 10 de 10 concluídos, o último na hora 56
Estoque: food 836, wood 119, stone 390, gold 300
Fome: nenhuma
Frio: nenhum
Moral: 60 no fim, mínima 50
Conselho: 6 cartas · 4 respondidas, 0 expiradas · 0 efeitos escondidos
Ameaça: 70 no fim (máxima 81) · Torre de Vigia Nv1, erguida na hora 50
Lobos: 5 incursões sofridas, 0 repelidas (1 anunciadas pela Torre) · levaram food 421, wood 339 · 6 feridos · Paliçada Nv1, erguida na hora 54
Fila ociosa: 16 h com obra que podia começar (0 h com obra planejada)
Sem o início automático (as mesmas planejadas, manuais): 56 h com obra que podia começar (56 h com obra planejada)
Aldeões sem ofício: 196 aldeão-horas (3,5 por hora)
Excedente parado: wood 119, stone 390, gold 300
Desperdício: food 2803, wood 2902, stone 0 (32 h com depósito cheio perdendo produção)
Da produção de cada recurso, foi ao chão: food 45%, wood 47%, stone 0%
Maior sequência desperdiçando, em horas de jogo: food 54, wood 63, stone 0 (meta do GDD §15.2 para 2 sessões por dia: até 8)
Comandos: 31 aceitos, 0 recusados
```

O Regular fecha o ano com 2.203 de ouro e 836 de pedra parados, 20 horas reais de fila ociosa e 243 aldeão-horas sem ofício. O Preguiçoso fecha com 300 de ouro, perde 45% da comida e 47% da madeira para o depósito cheio, sofre cinco incursões e não chega ao Salão Nv4: é o perfil a quem o Mercado promete uma saída para o que vai ao chão.

### 1.5 Tamanho do estado e da visão, e custo do avanço

A régua do contrato "estado de tamanho limitado" (roadmap, §0.7). Motor 0.2.0 · estado v12 · conteúdo `cea08e6e14163458` · ritmo 3× · Node v24.15.0 · linux x64 · 9 repetições por medida. Cada linha é um `advanceTo` só, do instante em que o jogador saiu ao da volta, seguido de um `deriveViewState`; tempo de processo, sem banco nem rede; estado e visão são o JSON que o servidor grava e responde.

| Feudo | Ausência (dias reais) | Viradas de dia de jogo | `advanceTo` (ms, mediana) | `advanceTo` (ms, pior) | `deriveViewState` (ms, mediana) | Eventos emitidos | Estado (bytes) | Visão (bytes) | Habitantes na volta |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Feudo novo, sem nenhuma ordem | 1 | 36 | 1,2 | 1,9 | 0,5 | 47 | 1.954 | 15.724 | 4 |
| Feudo novo, sem nenhuma ordem | 7 | 252 | 3,7 | 4,6 | 0,6 | 372 | 2.424 | 15.895 | 3 |
| Feudo novo, sem nenhuma ordem | 30 | 1.080 | 14,5 | 15,7 | 0,5 | 1.577 | 2.462 | 15.510 | 3 |
| Feudo de 2 dias reais (bot econômico, 2 visitas por dia) | 1 | 36 | 0,8 | 1,1 | 0,6 | 89 | 3.015 | 17.818 | 22 |
| Feudo de 2 dias reais (bot econômico, 2 visitas por dia) | 7 | 252 | 4,7 | 6,3 | 0,5 | 626 | 3.168 | 18.519 | 10 |
| Feudo de 2 dias reais (bot econômico, 2 visitas por dia) | 30 | 1.080 | 16,7 | 24,9 | 0,3 | 2.637 | 3.370 | 18.428 | 10 |
| Feudo de 7 dias reais (bot econômico, 2 visitas por dia) | 1 | 36 | 0,6 | 0,8 | 0,3 | 86 | 3.516 | 17.100 | 72 |
| Feudo de 7 dias reais (bot econômico, 2 visitas por dia) | 7 | 252 | 3,7 | 4,4 | 0,3 | 614 | 3.340 | 16.891 | 72 |
| Feudo de 7 dias reais (bot econômico, 2 visitas por dia) | 30 | 1.080 | 15,2 | 16,6 | 0,4 | 2.627 | 3.520 | 17.403 | 72 |

- **Os bytes são exatos; os tempos, indicativos.** A medição rodou com outro processo de testes na mesma máquina. O que se pode dizer dos tempos é a ordem de grandeza: 30 dias reais fora, no ritmo 3 (1.080 viradas de dia), custam de 15 a 25 ms de `advanceTo`.
- **O estado da v0.2 fechada tem de 2 a 3,5 kB** (1.954 bytes no feudo novo; 3.340 a 3.520 no feudo de 72 aldeões) e **a visão, de 15,5 a 18,5 kB**. Na rodada da Fase C da v0.2 (seção 9.7 de balance-v0.2.md, estado v7) eram 1,1 a 1,9 kB e 10,4 a 14,7 kB: o Conselho, a Ameaça, as incursões e a fome dobraram o estado e somaram cerca de 4 kB à visão.
- **O cenário mais perto de "um ano de jogo no ritmo 3"** que `--perf` mede é o feudo de 2 dias reais (48 horas; o ano são 56): 3,0 a 3,4 kB de estado e 17,8 a 18,5 kB de visão. O feudo de 7 dias reais são três anos de jogo. Não houve medida exatamente na hora 56.
- **Cada recibo de comando guarda uma visão inteira** ([perf-v0.1.md](perf-v0.1.md)). Com a visão em 17 a 18 kB, a tabela `commands` cresce na mesma proporção; o volume real em produção não foi medido.
- **Para a v0.3:** heróis, ofertas, expedições, relatórios, itens, caravanas e Mestres entram no estado e na visão, cada lista com teto vindo do conteúdo. Estas duas colunas são medidas de novo ao fim de cada fase, com o mesmo comando.

### 1.6 Limites desta medição

- **Node 24, e não o 22 do `.nvmrc`.** O motor é determinístico e a matriz é igual à tabela `MEASURED` gravada no Node 22, o que mostra que a versão do Node não mudou nenhum resultado de jogo; os tempos da seção 1.5 são do 24.
- **Os tempos de `advanceTo` foram medidos com a máquina ocupada** por outra suíte de testes. Não servem para comparar com a seção 9.7 de balance-v0.2.md (outra máquina, um Apple M5) nem para acusar uma regressão de poucos milissegundos.
- **Uma rodada só**, sem repetição. As saídas não foram guardadas no repositório.
- **A matriz não mede o que nenhum bot vive:** fome, frio, deserção, moral abaixo de 40 por um dia só (a amostra é por hora real). Os números da Fase G que mexem nisso (a deserção em tempo real, a fome que reabre) continuam sem medida de simulador.
- **O ouro parado é o de bots que não têm onde gastá-lo.** Um jogador de verdade pode gastar de outro jeito (as cartas com custo, por exemplo, que o Preguiçoso nunca paga). Não há dado de produção: `deploy/analytics/ops.sql` nunca rodou lá, e o agente não tem acesso ao banco.
- **A dispersão por semente não foi olhada** além do menor, da mediana e do maior do ouro. Fica para a seção 2.
- **Não houve playtest estruturado.** Nada aqui diz se o ouro parado incomoda quem joga; o que há é a decisão do autor de deixar a pendência C-5 para esta versão.
- **Ninguém leu as partidas hora a hora**: os números são os do fim de cada janela.

## 2. Dispersão por semente (V3B-T2)

Tarefa V3B-T2 do [roadmap da v0.3](roadmap-v0.3.md). A Fase B não acrescenta mecânica: dá identidade às entidades e sorteio por entidade (V3B-T1, estado 13) e prepara o simulador (o bot `explorador`, as colunas reservadas da Guilda). Esta seção registra duas coisas: **que nenhum número medido mudou** em relação à seção 1 e **quanto as 50 sementes de uma célula divergem entre si**, que é a régua para ler as rodadas das Fases C a E (uma diferença menor que a dispersão de uma célula não é efeito de mecânica nenhuma).

| | |
|---|---|
| Data | 2026-10-05 |
| Commit | árvore de trabalho da tarefa V3B-T2, sobre o `190f72c` (V3B-T1) |
| Identificação | Motor 0.2.0 · estado v13 · conteúdo `cea08e6e14163458` (o mesmo da seção 1: nenhum número de conteúdo mudou) |
| Dificuldades, sementes, perfis | Os da seção 1 |
| Máquina | A da seção 1, **Node v24.15.0** |

### 2.1 Comandos

```bash
pnpm -s sim -- --matrix --difficulty lord     > matriz-lord.csv     2> matriz-lord.md
pnpm -s sim -- --matrix --difficulty peasant  > matriz-peasant.csv  2> matriz-peasant.md
pnpm -s sim -- --matrix --difficulty ironKing > matriz-ironKing.csv 2> matriz-ironKing.md
pnpm -s sim -- --matrix --profile explorador  > matriz-explorador.csv 2> matriz-explorador.md
pnpm -s sim -- --seed pedra-alta-001 --game-year --time-scale 3 --strategy explorador > explorador-3x.csv
```

Os cinco saíram com código 0. As três matrizes ficaram inteiras dentro das faixas (2.700 partidas). Os arquivos de saída não estão no repositório.

### 2.2 Nenhum número medido mudou

- **Contra o commit da seção 1.** O `7bff36b` foi extraído para uma pasta à parte (`git archive`), com as dependências do `pnpm-lock.yaml`, e jogou as mesmas três matrizes. As **56 colunas** que o CSV da matriz tinha são idênticas, célula a célula e semente a semente, nas **2.700 linhas** (900 por dificuldade). O mesmo vale para as 47 colunas do CSV hora a hora das duas partidas de exemplo da seção 1.4 (`pedra-alta-001`, um ano de jogo no ritmo 3: Regular e Preguiçoso, 56 linhas cada). O que mudou no arquivo foram só as 19 colunas novas, no fim, todas vazias.
- **Contra `MEASURED`.** O bloco "Linha de base medida nesta rodada" de cada um dos três relatórios é igual, linha a linha, à tabela `MEASURED` de `packages/sim-cli/src/bands.ts` (18 células por dificuldade).
- **O que fica cobrando isso.** Para Senhor, com as 50 sementes, um teste novo de `balance.test.ts` compara a medida de cada célula com `MEASURED` **sem folga** (as faixas aceitam 5% ou 10%). Para Camponês e Rei de Ferro a suíte joga 3 sementes contra as faixas, como antes; a igualdade exata das 50 foi conferida à mão nesta rodada, pelos comandos acima.
- **O explorador.** O CSV e o resumo de `--strategy explorador` são iguais aos de `--strategy economico` (o resumo difere só no nome da estratégia). A matriz do perfil explorador (300 partidas, sem faixa) mede o mesmo que as células do Regular. Por isso o perfil **não entrou na rodada padrão**: seria a célula do Regular repetida, e a matriz do `pnpm test` cresceria um terço sem informação nova. Ele entra em `PROFILES`, com faixa própria, na tarefa que lhe der a primeira política que o econômico não tem.

### 2.3 A matriz já mostra o menor e o maior valor

Cada célula do relatório traz o menor e o maior valor entre as 50 sementes (um número só quando são iguais) desde V2B-T4: `CellMeasure` guarda um `Range` por medida, e as tabelas da seção 1.2 já estão nesse formato. A tarefa não mudou o relatório; o que faltava era dizer quanto as sementes divergem, e é a tabela abaixo.

### 2.4 Dispersão medida, em Senhor

"Partidas distintas" é quantas das 50 sementes de uma célula terminam com uma linha diferente no CSV da matriz (todas as colunas, menos a semente). Entre parênteses, quantos valores diferentes a coluna assume. As outras colunas são o menor e o maior valor; a mediana do ouro mostra para que lado a célula pende. "Lobos levaram" soma comida e madeira; "Moral mínima" e "Ameaça máxima" são a menor e a maior de cada partida.

| Janela | Ritmo | Perfil | Partidas distintas | População | Ouro parado | Mediana do ouro | Valores de ouro | Cartas recebidas | Incursões sofridas | Incursões repelidas | Lobos levaram | Moral mínima | Ameaça máxima |
|---|---|---|---:|---|---|---:|---:|---|---|---|---|---|---|
| 7 dias | Rápido 3× | Preguiçoso | 50 | 36 a 38 (3) | 3.925 a 7.497 | 7.482 | 28 | 14 | 5 a 6 | 13 a 15 | 761 a 1.270 | 50 | 78 a 100 |
| 7 dias | Rápido 3× | Regular | 50 | 72 a 75 (4) | 113.566 a 148.487 | 128.436 | 50 | 28 | 1 a 2 | 17 a 19 | 55 a 187 | 50 | 78 a 100 |
| 7 dias | Rápido 3× | Dedicado | 50 | 84 a 85 (2) | 284.168 a 324.539 | 309.332 | 50 | 56 a 57 | 1 | 17 a 19 | 32 a 44 | 40 a 50 | 78 a 100 |
| 7 dias | Normal 1× | Preguiçoso | 49 | 31 a 33 (3) | 1.034 a 1.139 | 1.065 | 27 | 14 | 1 a 3 | 2 a 5 | 94 a 424 | 50 | 71 a 100 |
| 7 dias | Normal 1× | Regular | 50 | 64 a 73 (10) | 2.348 a 23.641 | 8.967 | 50 | 21 a 23 | 1 | 4 a 5 | 28 a 47 | 40 a 50 | 71 a 100 |
| 7 dias | Normal 1× | Dedicado | 50 | 84 (1) | 2.587 a 21.575 | 13.399 | 50 | 23 a 25 | 1 | 4 a 5 | 32 a 55 | 40 a 45 | 71 a 100 |
| 7 dias | Tranquilo 0,5× | Preguiçoso | 14 | 20 (1) | 26 a 30 | 30 | 3 | 10 | 1 a 2 | 0 a 1 | 47 a 350 | 50 | 46 a 54 |
| 7 dias | Tranquilo 0,5× | Regular | 50 | 50 a 54 (5) | 38 a 1.044 | 518 | 48 | 10 a 14 | 1 | 0 a 1 | 32 a 55 | 40 a 45 | 46 a 54 |
| 7 dias | Tranquilo 0,5× | Dedicado | 50 | 60 a 65 (6) | 53 a 940 | 244 | 48 | 10 a 14 | 1 | 0 a 1 | 18 a 38 | 40 a 45 | 46 a 54 |
| Ano de jogo | Rápido 3× | Preguiçoso | 50 | 16 (1) | 51 a 304 | 299 | 11 | 6 | 5 a 6 | 0 a 1 | 761 a 1.270 | 50 | 66 a 100 |
| Ano de jogo | Rápido 3× | Regular | 50 | 27 a 30 (4) | 1.870 a 3.052 | 2.176 | 48 | 10 | 1 a 2 | 3 a 5 | 55 a 187 | 50 | 66 a 100 |
| Ano de jogo | Rápido 3× | Dedicado | 50 | 51 a 55 (5) | 1.130 a 12.964 | 8.225 | 50 | 19 a 20 | 1 | 4 a 5 | 32 a 44 | 40 a 50 | 66 a 100 |
| Ano de jogo | Normal 1× | Preguiçoso | 49 | 31 a 33 (3) | 1.034 a 1.139 | 1.065 | 27 | 14 | 1 a 3 | 2 a 5 | 94 a 424 | 50 | 71 a 100 |
| Ano de jogo | Normal 1× | Regular | 50 | 64 a 73 (10) | 2.348 a 23.641 | 8.967 | 50 | 21 a 23 | 1 | 4 a 5 | 28 a 47 | 40 a 50 | 71 a 100 |
| Ano de jogo | Normal 1× | Dedicado | 50 | 84 (1) | 2.587 a 21.575 | 13.399 | 50 | 23 a 25 | 1 | 4 a 5 | 32 a 55 | 40 a 45 | 71 a 100 |
| Ano de jogo | Tranquilo 0,5× | Preguiçoso | 48 | 52 a 56 (5) | 160 a 3.936 | 2.714 | 22 | 21 | 1 a 2 | 3 a 5 | 47 a 350 | 50 | 71 a 100 |
| Ano de jogo | Tranquilo 0,5× | Regular | 50 | 84 (1) | 13.128 a 22.535 | 17.645 | 50 | 21 a 25 | 1 | 4 a 5 | 32 a 55 | 40 a 45 | 71 a 100 |
| Ano de jogo | Tranquilo 0,5× | Dedicado | 50 | 84 a 85 (2) | 23.713 a 32.471 | 28.208 | 50 | 21 a 25 | 1 | 4 a 5 | 18 a 38 | 40 a 45 | 71 a 100 |

No ritmo Normal as duas janelas são a mesma partida (seção 1.2), e as linhas se repetem.

O que a tabela diz:

- **As sementes trabalham.** Em 14 das 18 células de Senhor as 50 partidas são todas diferentes; em três, 48 ou 49. Camponês repete esses números (14 células com 50; as outras com 14, 48, 49 e 49) e Rei de Ferro tem 16 células com 50 (as outras, 14 e 47). A exceção nas três dificuldades é a semana do Preguiçoso no ritmo Tranquilo, com **14 desfechos em 50**: em meio ano de jogo, com uma visita por dia, quase nada do que sorteia chega a pesar.
- **Varia em toda célula:** o ouro e a comida no fim, a fila ociosa, os aldeão-horas sem ofício, a madeira desperdiçada, a maior Ameaça, as incursões repelidas e o que os lobos levaram.
- **Não varia em nenhuma:** fome, frio, gente que foi embora, a menor população, ordens recusadas, cartas expiradas, objetivos concluídos e a hora do último. São as medidas que continuam podendo ser cobradas com um número só.
- **O ouro parado é a medida mais larga**, e é a que a v0.3 promete baixar (seção 1.3). No Regular do ritmo Normal ele vai de 2.348 a 23.641, dez vezes, com a mediana em 8.967; no Dedicado do ritmo Rápido em 7 dias, de 284.168 a 324.539, uma amplitude de 14% do menor valor. **Uma queda do ouro depois do soldo ou do Mercado só é efeito da mecânica se a célula inteira descer**: comparar o menor, a mediana e o maior, nunca uma semente só nem só o teto que `MEASURED` guarda.
- **A população mexe pouco:** no máximo 4 aldeões entre as sementes, fora o Regular do ritmo Normal (64 a 73, dez valores) e o Dedicado do Tranquilo em 7 dias (60 a 65).

### 2.5 Limites desta medição

- A mediana e a contagem de valores distintos saíram de uma conta avulsa sobre o CSV da matriz; o relatório do simulador continua trazendo só o menor e o maior. Se as Fases C a E precisarem da mediana em toda rodada, ela entra em `CellMeasure` na tarefa que precisar.
- A tabela é de Senhor. De Camponês e Rei de Ferro ficou só a contagem de partidas distintas por célula.
- Node v24.15.0, como a seção 1; não repetida no 22 do `.nvmrc`.
- As colunas reservadas da Guilda estão vazias: não há nada delas a medir até as Fases C a E.

## 3. A estrangeira ferida e o primeiro soldo (V3C-T3)

Tarefa V3C-T3 do [roadmap da v0.3](roadmap-v0.3.md). É a primeira rodada em que **todo feudo tem um herói**: a carta roteirizada "Estrangeira ferida" chega a toda partida e entrega um, e o soldo dele passa a sair do ouro. Duas coisas mudam a economia ao mesmo tempo, e a rodada não as separa: **o soldo** (2 de ouro por hora de jogo) e **o sorteio**, porque a carta ocupa uma audiência do Conselho sem gastar o gerador, e daí em diante cada semente tira outras cartas e segue outro caminho de obras. A linha de base (`MEASURED`, em `packages/sim-cli/src/bands.ts`) foi regravada de propósito, nas três dificuldades.

| | |
|---|---|
| Data | 2026-10-05 |
| Commit | A árvore da tarefa V3C-T3, no `main` local; os commits estão na linha V3C-T3 do [roadmap, §12](roadmap-v0.3.md) |
| Identificação | Motor 0.2.0 · estado v15 · conteúdo `4c57c0f6ab502d2b` na rodada; o conteúdo que foi para o commit é o `c81a0678db8ca834`, que difere em três frases da carta (o irmão de Edda) e em nenhum número: `balance.test.ts` confere a cada `pnpm test`, com o conteúdo do commit, que as 50 sementes de Senhor medem exatamente o que está aqui |
| Dificuldades | Camponês, Senhor e Rei de Ferro, 50 sementes cada (`pedra-alta-001` a `pedra-alta-050`) |
| Perfis | Preguiçoso (1 visita por dia), Regular (2) e Dedicado (4), nos ritmos Rápido 3×, Normal 1× e Tranquilo 0,5× |
| Máquina | A da seção 1, Node v24.15.0 |

### 3.1 Comandos

```bash
pnpm -s sim -- --matrix > matriz-senhor.csv 2> matriz-senhor.md
pnpm -s sim -- --matrix --difficulty peasant > matriz-campones.csv 2> matriz-campones.md
pnpm -s sim -- --matrix --difficulty ironKing > matriz-rei.csv 2> matriz-rei.md
```

Antes de a linha de base ser regravada os três comandos saíram com código 1 (partidas fora das faixas antigas); depois, `pnpm test` joga a matriz de Senhor inteira e as outras duas com 3 sementes, dentro das faixas novas. Os números da guilda (seção 3.3) vêm de `Summary.guild`, que o simulador passou a calcular dos eventos de cada partida; as quatro colunas da Guilda no CSV continuam reservadas até V3C-T5.

### 3.2 O que os bots fazem com a carta

Os dois bots leem só a visão. O `economico` paga a opção mais cara que cabe com folga e, sem nenhuma, fica com a primeira sem custo; o `preguicoso` responde sempre com a primeira sem custo. Na carta da estrangeira nenhuma opção custa, e a primeira é **"Acolher"**: **toda partida da matriz termina com Edda**, que é Leal. **Nenhum bot escolhe "Cuidar e deixar partir"**, em nenhuma dificuldade: o arqueiro, que não é Leal, o ouro da estrangeira e a chegada adiada **não passam pelo simulador**. Em Rei de Ferro é a opção que o conselho aplica sozinho, mas nenhum bot deixa a carta expirar.

### 3.3 O primeiro herói e o soldo, por célula

Iguais nas três dificuldades, nas 50 sementes de cada célula:

| Ritmo | Perfil | A carta é do 13º dia (hora real) | Hora real do primeiro herói | Heróis no fim | Horas reais com soldo em atraso | Heróis que partiram |
|---|---|---:|---:|---:|---:|---:|
| Rápido 3× | Dedicado | 8 | 12 | 1 | 0 | 0 |
| Rápido 3× | Regular | 8 | 24 | 1 | 0 | 0 |
| Rápido 3× | Preguiçoso | 8 | **48** | 1 | 0 | 0 |
| Normal 1× | Dedicado | 24 | 24 | 1 | 0 | 0 |
| Normal 1× | Regular | 24 | 24 a 36 | 1 | 0 | 0 |
| Normal 1× | Preguiçoso | 24 | **48** | 1 | **21, em toda semente** | 0 |
| Tranquilo 0,5× | os três | 48 | 48 | 1 | 0 | 0 |

O que se lê:

- **Todo feudo recebe o herói, em todo perfil, ritmo e dificuldade.** É o critério 1 do GDD §16.2 visto de fora. Um teste em `balance.test.ts` confere as horas e as contagens acima a cada `pnpm test`.
- **O Preguiçoso recebe o herói um dia real depois dos outros, no Rápido e no Normal.** A carta pede lugar na mesa e não o reserva: quem só passa pelo feudo uma vez por dia encontra na primeira visita as cartas dos dias 5 e 9 ocupando os dois lugares, e a estrangeira só chega na audiência seguinte à visita. No Rápido isso é a hora 48, e não a 24. Quem **nunca** aparece espera mais: com as duas cartas na mesa até o prazo, a estrangeira chega na audiência do 21º dia no ritmo Normal e do 45º no Rápido, e o conselho a acolhe 24 h reais depois (64 h e 53 h reais desde a fundação). Reservar lugar para a roteirizada resolveria e é mudança de regra do Conselho: está com o autor (pendência C-13).
- **PIOROU: o Preguiçoso do ritmo Normal soma 21 h reais com o soldo em atraso, em toda semente e em toda dificuldade.** Ele não põe ninguém na Mina a tempo de pagar. Com Edda não acontece nada além de o ouro ficar em zero nesse tempo: ela é Leal, não fica Descontente e não parte. **Nenhum herói partiu em nenhuma partida da matriz**, e é por isso, não porque o soldo esteja folgado. Com um herói que não fosse Leal, 21 h passam das 12 h reais do Descontente e ficam a 3 h das 24 h em que o primeiro parte; isso é conta dos prazos sobre a medida, **não foi medido**: nenhum bot escolhe o arqueiro.
- **O soldo de um herói não aparece no ouro parado de quem tem ouro** (seção 3.4): são 2 por hora de jogo contra milhares por dia.

### 3.4 O ouro parado, antes e depois

Ouro em estoque no fim da janela, nas 50 sementes de cada célula: menor / mediana / maior. "Antes" é a seção 1.3.

| Ritmo | Perfil | Dificuldade | 7 dias, antes: menor / mediana / maior | 7 dias, depois | Ano de jogo, antes | Ano de jogo, depois |
|---|---|---|---|---|---|---|
| Rápido 3× | Preguiçoso | Senhor | 3.925 / 7.482 / 7.497 | 3.201 / 6.761 / 6.778 | 51 / 299 / 304 | 3 / 251 / 256 |
| Rápido 3× | Preguiçoso | Camponês | 3.960 / 7.511 / 7.524 | 3.236 / 6.792 / 6.804 | 51 / 198 / 202 | 3 / 149 / 154 |
| Rápido 3× | Preguiçoso | Rei de Ferro | 3.942 / 7.508 / 7.536 | 3.221 / 6.803 / 6.816 | 153 / 292 / 474 | 105 / 245 / 426 |
| Rápido 3× | Regular | Senhor | 113.566 / 128.436 / 148.487 | 112.443 / 134.350 / 150.285 | 1.870 / 2.176 / 3.052 | 1.889 / 1.986 / 2.979 |
| Rápido 3× | Regular | Camponês | 132.557 / 143.029 / 152.495 | 133.086 / 141.238 / 150.960 | 1.778 / 2.362 / 3.560 | 1.903 / 2.279 / 3.392 |
| Rápido 3× | Regular | Rei de Ferro | 148.435 / 154.854 / 165.302 | 147.857 / 152.694 / 165.720 | 2.538 / 2.928 / 6.322 | 2.363 / 2.738 / 6.215 |
| Rápido 3× | Dedicado | Senhor | 284.168 / 309.332 / 324.539 | 281.219 / 308.791 / 319.751 | 1.130 / 8.225 / 12.964 | 1.193 / 8.691 / 12.515 |
| Rápido 3× | Dedicado | Camponês | 296.216 / 309.405 / 323.662 | 293.365 / 308.602 / 320.468 | 1.274 / 3.414 / 13.816 | 543 / 2.546 / 14.378 |
| Rápido 3× | Dedicado | Rei de Ferro | 266.497 / 278.635 / 294.121 | 263.262 / 278.334 / 290.931 | 4.357 / 10.554 / 14.091 | 4.579 / 10.172 / 14.072 |
| Normal 1× | Preguiçoso | Senhor | 1.034 / 1.066 / 1.139 | 831 / 861 / 982 | 1.034 / 1.066 / 1.139 | 831 / 861 / 982 |
| Normal 1× | Preguiçoso | Camponês | 62 / 1.072 / 1.165 | 832 / 880 / 961 | 62 / 1.072 / 1.165 | 832 / 880 / 961 |
| Normal 1× | Preguiçoso | Rei de Ferro | 964 / 1.000 / 1.255 | 774 / 808 / 1.025 | 964 / 1.000 / 1.255 | 774 / 808 / 1.025 |
| Normal 1× | Regular | Senhor | 2.348 / 8.967 / 23.641 | 1.761 / 7.510 / 19.777 | 2.348 / 8.967 / 23.641 | 1.761 / 7.510 / 19.777 |
| Normal 1× | Regular | Camponês | 188 / 3.378 / 18.058 | 297 / 4.234 / 19.614 | 188 / 3.378 / 18.058 | 297 / 4.234 / 19.614 |
| Normal 1× | Regular | Rei de Ferro | 3.057 / 10.880 / 19.717 | 1.201 / 8.824 / 19.471 | 3.057 / 10.880 / 19.717 | 1.201 / 8.824 / 19.471 |
| Normal 1× | Dedicado | Senhor | 2.587 / 13.399 / 21.575 | 5.293 / 12.533 / 18.559 | 2.587 / 13.399 / 21.575 | 5.293 / 12.533 / 18.559 |
| Normal 1× | Dedicado | Camponês | 12.284 / 15.898 / 20.225 | 11.220 / 14.672 / 20.127 | 12.284 / 15.898 / 20.225 | 11.220 / 14.672 / 20.127 |
| Normal 1× | Dedicado | Rei de Ferro | 35.003 / 38.728 / 43.766 | 33.762 / 37.839 / 43.599 | 35.003 / 38.728 / 43.766 | 33.762 / 37.839 / 43.599 |
| Tranquilo 0,5× | Preguiçoso | Senhor | 26 / 30 / 30 | 65 / 98 / 99 | 160 / 2.714 / 3.936 | 4.552 / 4.607 / 4.634 |
| Tranquilo 0,5× | Preguiçoso | Camponês | 26 / 30 / 30 | 268 / 282 / 283 | 527 / 774 / 2.004 | 4.457 / 4.522 / 6.250 |
| Tranquilo 0,5× | Preguiçoso | Rei de Ferro | 26 / 30 / 30 | 50 / 51 / 84 | 828 / 3.948 / 5.802 | 57 / 705 / 4.587 |
| Tranquilo 0,5× | Regular | Senhor | 38 / 518 / 1.044 | 4 / 177 / 1.104 | 13.128 / 17.646 / 22.535 | 8.096 / 16.904 / 21.490 |
| Tranquilo 0,5× | Regular | Camponês | 158 / 492 / 935 | 19 / 280 / 1.104 | 12.046 / 18.462 / 21.275 | 15.031 / 18.354 / 20.062 |
| Tranquilo 0,5× | Regular | Rei de Ferro | 45 / 279 / 730 | 14 / 419 / 1.113 | 40.471 / 42.786 / 44.215 | 37.237 / 41.698 / 43.597 |
| Tranquilo 0,5× | Dedicado | Senhor | 53 / 244 / 940 | 3 / 168 / 897 | 23.713 / 28.208 / 32.471 | 21.667 / 27.838 / 31.643 |
| Tranquilo 0,5× | Dedicado | Camponês | 76 / 560 / 1.237 | 42 / 470 / 1.101 | 26.509 / 29.288 / 33.840 | 25.127 / 27.968 / 33.509 |
| Tranquilo 0,5× | Dedicado | Rei de Ferro | 59 / 265 / 763 | 13 / 224 / 588 | 40.826 / 47.260 / 53.059 | 40.647 / 47.314 / 52.092 |

- **Onde o ouro sobra, o herói não o baixa.** No Dedicado do Rápido a mediana da semana vai de 309 mil para 309 mil; no Regular **sobe** (128 mil → 134 mil), pelo caminho de obras que o sorteio novo deu a cada semente. A diferença fica dentro da dispersão da célula (seção 2): **não é efeito do soldo**. O "ouro com destino" que a v0.3 promete continua por vir, com a Taverna e o Mercado.
- **No Normal o ouro desce um pouco em quase toda célula** (Regular de Senhor: mediana de 8.967 para 7.510; Preguiçoso: de 1.066 para 861). É a ordem de grandeza do soldo de um herói em um ano de jogo (2 × 168 h = 336), somada ao sorteio.
- **O Preguiçoso do Tranquilo foi o que mais mudou, e para melhor**, o que pede leitura: ver a seção 3.5.

### 3.5 As faixas, antes e depois

**Senhor** (antes → depois; só o que mudou aparece com seta):

| Janela | Ritmo | Perfil | População | Salão (mín.) | Madeira parada (máx.) | Pedra parada (máx.) | Ouro parado (máx.) | Maior sequência desperdiçando (h de jogo) |
|---|---|---|---|---|---|---|---|---|
| 7 dias | Rápido 3× | Preguiçoso | 36 a 38 → **36 a 39** | 7 | 3.400 | 3.400 | 7.497 → **6.778** | 72 → **75** |
| 7 dias | Rápido 3× | Regular | 72 a 75 → **72 a 76** | 8 | 5.200 → **4.324** | 5.200 | 148.487 → **150.285** | 33 |
| 7 dias | Rápido 3× | Dedicado | 84 a 85 | 8 | 4.225 → **5.013** | 5.200 | 324.539 → **319.751** | 15 → **18** |
| 7 dias | Normal 1× | Preguiçoso | 31 a 33 → **31 a 34** | 5 | 1.136 → **1.799** | 2.647 → **2.640** | 1.139 → **982** | 16 |
| 7 dias | Normal 1× | Regular | 64 a 73 | 7 | 4.512 → **4.600** | 4.637 → **4.592** | 23.641 → **19.777** | 9 → **8** |
| 7 dias | Normal 1× | Dedicado | 84 → **84 a 85** | 8 | 5.200 | 5.200 | 21.575 → **18.559** | 5 → **4** |
| 7 dias | Tranquilo 0,5× | Preguiçoso | 20 → **29** | 3 → **4** | 1.071 → **339** | 1.576 → **1.599** | 30 → **99** | 5,5 → **8** |
| 7 dias | Tranquilo 0,5× | Regular | 50 a 54 | 6 | 1.037 → **1.492** | 1.254 → **987** | 1.044 → **1.104** | 1 → **1,5** |
| 7 dias | Tranquilo 0,5× | Dedicado | 60 a 65 → **56 a 64** | 6 | 1.781 → **1.884** | 1.173 → **829** | 940 → **897** | 1 → **0,5** |
| Ano de jogo | Rápido 3× | Preguiçoso | 16 | 3 | 194 | 517 → **516** | 304 → **256** | 63 |
| Ano de jogo | Rápido 3× | Regular | 27 a 30 | 5 | 783 → **772** | 1.114 → **930** | 3.052 → **2.979** | 9 → **6** |
| Ano de jogo | Rápido 3× | Dedicado | 51 a 55 → **51 a 56** | 6 | 1.650 → **2.793** | 2.091 → **2.049** | 12.964 → **12.515** | 15 → **18** |
| Ano de jogo | Tranquilo 0,5× | Preguiçoso | 52 a 56 → **62 a 63** | 6 → **7** | 4.185 → **1.293** | 1.855 → **221** | 3.936 → **4.634** | 7 → **8** |
| Ano de jogo | Tranquilo 0,5× | Regular | 84 → **84 a 85** | 8 | 5.200 | 5.200 | 22.535 → **21.490** | 3 |
| Ano de jogo | Tranquilo 0,5× | Dedicado | 84 a 85 → **84** | 8 | 5.200 → **5.188** | 5.200 | 32.471 → **31.643** | 4 → **3** |


**Camponês** (antes → depois; só o que mudou aparece com seta):

| Janela | Ritmo | Perfil | População | Salão (mín.) | Madeira parada (máx.) | Pedra parada (máx.) | Ouro parado (máx.) | Maior sequência desperdiçando (h de jogo) |
|---|---|---|---|---|---|---|---|---|
| 7 dias | Rápido 3× | Preguiçoso | 36 a 38 → **36 a 39** | 7 | 4.250 | 4.250 | 7.524 → **6.804** | 63 |
| 7 dias | Rápido 3× | Regular | 72 a 76 | 8 | 5.636 → **5.634** | 6.500 | 152.495 → **150.960** | 33 |
| 7 dias | Rápido 3× | Dedicado | 84 a 85 | 8 | 5.520 → **6.052** | 6.500 | 323.662 → **320.468** | 15 |
| 7 dias | Normal 1× | Preguiçoso | 31 a 33 → **31 a 34** | 5 | 1.435 → **1.922** | 3.056 → **3.098** | 1.165 → **961** | 13 |
| 7 dias | Normal 1× | Regular | 62 a 72 → **61 a 72** | 7 | 5.029 → **5.026** | 4.985 → **4.990** | 18.058 → **19.614** | 8 → **7** |
| 7 dias | Normal 1× | Dedicado | 84 a 85 | 8 | 6.500 | 6.500 | 20.225 → **20.127** | 3 → **4** |
| 7 dias | Tranquilo 0,5× | Preguiçoso | 20 → **25 a 27** | 3 | 1.727 → **1.861** | 2.067 → **2.000** | 30 → **283** | 3 → **4,5** |
| 7 dias | Tranquilo 0,5× | Regular | 50 a 54 | 6 | 1.008 → **1.029** | 1.125 → **1.038** | 935 → **1.104** | 0 → **1** |
| 7 dias | Tranquilo 0,5× | Dedicado | 58 a 65 → **57 a 64** | 6 | 1.491 → **1.406** | 1.227 → **1.201** | 1.237 → **1.101** | 1 → **0,5** |
| Ano de jogo | Rápido 3× | Preguiçoso | 16 | 3 | 363 | 517 → **516** | 202 → **154** | 60 |
| Ano de jogo | Rápido 3× | Regular | 27 a 30 | 5 | 641 → **578** | 1.104 → **1.112** | 3.560 → **3.392** | 6 |
| Ano de jogo | Rápido 3× | Dedicado | 50 a 55 → **52 a 55** | 6 | 1.915 → **2.011** | 3.307 → **2.585** | 13.816 → **14.378** | 9 → **12** |
| Ano de jogo | Tranquilo 0,5× | Preguiçoso | 52 a 56 → **60 a 62** | 7 | 1.549 → **2.281** | 685 → **827** | 2.004 → **6.250** | 8 → **5,5** |
| Ano de jogo | Tranquilo 0,5× | Regular | 84 a 85 | 8 | 6.500 | 6.500 | 21.275 → **20.062** | 3 |
| Ano de jogo | Tranquilo 0,5× | Dedicado | 84 a 85 | 8 | 6.500 | 6.500 | 33.840 → **33.509** | 2,5 → **2** |


**Rei de Ferro** (antes → depois; só o que mudou aparece com seta):

| Janela | Ritmo | Perfil | População | Salão (mín.) | Madeira parada (máx.) | Pedra parada (máx.) | Ouro parado (máx.) | Maior sequência desperdiçando (h de jogo) |
|---|---|---|---|---|---|---|---|---|
| 7 dias | Rápido 3× | Preguiçoso | 36 a 38 | 7 | 3.200 | 3.200 | 7.536 → **6.816** | 75 |
| 7 dias | Rápido 3× | Regular | 72 a 75 | 7 | 2.804 | 3.680 → **3.674** | 165.302 → **165.720** | 24 |
| 7 dias | Rápido 3× | Dedicado | 74 a 75 | 7 | 2.837 → **2.792** | 3.680 | 294.121 → **290.931** | 45 → **36** |
| 7 dias | Normal 1× | Preguiçoso | 31 a 34 | 5 | 1.281 → **1.760** | 2.104 → **2.124** | 1.255 → **1.025** | 18 → **19** |
| 7 dias | Normal 1× | Regular | 64 a 71 → **59 a 72** | 6 | 3.680 → **3.662** | 3.680 | 19.717 → **19.471** | 5 → **8** |
| 7 dias | Normal 1× | Dedicado | 74 a 75 | 7 | 3.680 | 3.680 | 43.766 → **43.599** | 3 |
| 7 dias | Tranquilo 0,5× | Preguiçoso | 20 → **29** | 3 → **4** | 145 → **142** | 940 → **1.253** | 30 → **84** | 11,5 → **8,5** |
| 7 dias | Tranquilo 0,5× | Regular | 49 a 54 | 6 → **5** | 1.098 → **1.680** | 887 → **1.046** | 730 → **1.113** | 1 |
| 7 dias | Tranquilo 0,5× | Dedicado | 58 a 64 → **57 a 64** | 6 | 1.709 → **1.440** | 768 → **766** | 763 → **588** | 0 → **1** |
| Ano de jogo | Rápido 3× | Preguiçoso | 16 | 2 | 268 | 529 → **517** | 474 → **426** | 66 |
| Ano de jogo | Rápido 3× | Regular | 27 a 30 | 4 | 588 | 660 → **602** | 6.322 → **6.215** | 6 |
| Ano de jogo | Rápido 3× | Dedicado | 50 a 55 → **48 a 55** | 6 | 1.274 → **1.569** | 1.646 → **1.650** | 14.091 → **14.072** | 18 |
| Ano de jogo | Tranquilo 0,5× | Preguiçoso | 48 a 53 → **59 a 62** | 6 → **7** | 3.200 → **1.691** | 1.956 → **1.345** | 5.802 → **4.587** | 11,5 → **8,5** |
| Ano de jogo | Tranquilo 0,5× | Regular | 74 a 75 | 7 | 3.672 → **3.680** | 3.680 | 44.215 → **43.597** | 3 |
| Ano de jogo | Tranquilo 0,5× | Dedicado | 74 a 75 | 7 | 3.680 | 3.680 | 53.059 → **52.092** | 3 → **2** |

No ritmo Normal as duas janelas são a mesma partida, e a linha do ano foi omitida.

**O que piorou, como piora:**

- **Rei de Ferro, Regular, Normal:** a menor população cai de 64 para 59, e a maior sequência desperdiçando sobe de 5 para 8 h de jogo.
- **Rei de Ferro, Regular, semana do Tranquilo:** o menor nível do Salão cai de 6 para 5.
- **Senhor, Dedicado, semana do Tranquilo:** a menor população cai de 60 para 56. No Dedicado do ano do Rápido de Rei de Ferro, de 50 para 48. Em outras três células ela cai um aldeão (Camponês: Regular do Normal e Dedicado da semana do Tranquilo; Rei de Ferro: Dedicado da semana do Tranquilo).
- **Maior sequência desperdiçando:** sobe no Preguiçoso (Senhor, Rápido, 72 → 75 h; Tranquilo, 5,5 → 8 h e 7 → 8 h), no Dedicado do Rápido de Senhor (15 → 18 h, na semana e no ano), no Dedicado do ano do Rápido de Camponês (9 → 12 h) e no Preguiçoso do Normal de Rei de Ferro (18 → 19 h). Em mais cinco células sobe até 1,5 h (estão nas tabelas).
- **O soldo em atraso do Preguiçoso no Normal** (seção 3.3), que as faixas não medem.

**O que melhorou, e por quê não é mérito da regra:**

- **O Preguiçoso do Tranquilo termina com muito mais gente:** em Senhor, 20 → 29 aldeões na semana (Salão 3 → 4) e 52 a 56 → 62 a 63 no ano (Salão 6 → 7); em Rei de Ferro, 20 → 29 e 48 a 53 → 59 a 62; em Camponês, 20 → 25 a 27 e 52 a 56 → 60 a 62. Na semente 001 de Senhor, hora a hora: o herói chega na hora 48; na 72 o saldo do ouro aparece negativo (−1 por hora) pela primeira vez, e o bot, que manda os aldeões sem ofício para onde falta, passa a mandá-los para a Mina. O ouro por hora vai de zero a 7 na hora 96 (era zero até a 120), a Torre de Vigia sai na hora 80 em vez da 137, e o feudo termina a semana com 7 mineiros em vez de 3. **O soldo ensinou o bot a minerar.** É efeito da política do bot diante de um saldo negativo, não uma regra que ajude o jogador: um jogador de verdade no mesmo feudo pode não reagir assim.
- **A meta de desperdício do Regular** (8 h de jogo seguidas; ADR 0013, decisão 17) passa a ser cumprida no Normal por todas as 50 sementes (o pior caso cai de 9 para 8 h; a seção 20 de balance-v0.2.md tinha uma semente acima) e no ano do Rápido (9 → 6 h). Só a semana do Rápido continua acima, nas mesmas 33 h. É o caminho de obras de cada semente, que o sorteio mudou; nenhum número de armazenamento foi tocado.

### 3.6 Limites desta medição

- **Nenhum bot escolhe o arqueiro.** O herói que pode ficar Descontente e partir, o ouro e a moral da opção, e a chegada um dia de jogo depois só estão provados no motor (`stranger.test.ts`, `stranger.property.test.ts`), não no simulador. Um perfil que escolha "Cuidar e deixar partir" e um que fique sem ouro de propósito são de V3C-T5.
- **Um herói só.** Quantos heróis cada perfil sustenta é pergunta da Taverna (V3C-T2 e V3C-T5).
- **O efeito do soldo e o do sorteio não foram separados.** Separá-los pede rodar a matriz com a carta e sem o soldo, o que nenhuma regra do jogo faz.
- `--perf`, o tamanho do estado e da visão com herói, e a cobertura do Conselho em 50 sementes (`SHOW_COVERAGE=1`) não foram remedidos: o teste da cobertura passa sem mudança de número.
- Node v24.15.0, como as seções 1 e 2.

## 4. A Taverna: candidatos, contratação, moral e festival (V3C-T2)

Tarefa V3C-T2 do [roadmap da v0.3](roadmap-v0.3.md). É a primeira rodada com a **Taverna** e a primeira em que um bot **contrata**. Três coisas mudam a economia, e a rodada separa a terceira das outras duas:

1. **A obra da Taverna entrou na lista de construções de todo feudo.** Os três bots a erguem e a melhoram sem política nova: `obra mais barata` a escolhe quando ela é a mais barata, como faz com a Fazenda. São cinco obras a mais na fila, que disputam madeira, pedra e ouro com o Salão.
2. **A Taverna soma moral sem prazo**: +5 por nível, +25 no nível 5. Um feudo com comida guardada passa a 85, e acima de 80 cada virada de dia pode trazer um colono.
3. **O bot `explorador` contrata e dá festival**; o `economico` e o `preguicoso`, não. O perfil **Explorador** (2 visitas por dia, como o Regular) entrou na rodada padrão da matriz, com faixa própria: a célula dele ao lado da do Regular é o que a contratação muda.

A linha de base (`MEASURED`, em `packages/sim-cli/src/bands.ts`) foi regravada de propósito, nas três dificuldades, com as 24 células de cada uma (eram 18).

| | |
|---|---|
| Data | 2026-10-05 |
| Commit | A árvore da tarefa V3C-T2, no `main` local; os commits estão na linha V3C-T2 do [roadmap, §12](roadmap-v0.3.md) |
| Identificação | Motor 0.2.0 · estado v16 · conteúdo `13c1be459b007c6a` |
| Dificuldades | Camponês, Senhor e Rei de Ferro, 50 sementes cada (`pedra-alta-001` a `pedra-alta-050`) |
| Perfis | Preguiçoso (1 visita por dia, bot `preguicoso`), Regular (2, `economico`), Dedicado (4, `economico`) e **Explorador** (2, `explorador`), nos ritmos Rápido 3×, Normal 1× e Tranquilo 0,5× |
| Máquina | A da seção 1, Node v24.15.0 |

### 4.1 Comandos

```bash
pnpm -s sim -- --matrix > matriz-senhor.csv 2> matriz-senhor.md
pnpm -s sim -- --matrix --difficulty peasant > matriz-campones.csv 2> matriz-campones.md
pnpm -s sim -- --matrix --difficulty ironKing > matriz-rei.csv 2> matriz-rei.md
pnpm -s sim -- --perf
```

Antes de a linha de base ser regravada os três primeiros saíram com código 1 (partidas fora das faixas da seção 3); depois, `pnpm test` joga a matriz de Senhor inteira e as outras duas com 3 sementes, dentro das faixas novas. Cada matriz leva de 2 a 3 minutos com os quatro perfis (a de Senhor levava 1 min 53 s com três). O relatório ganhou a tabela **Guilda** em cada janela, tirada de `Summary.guild`; no CSV, `heroes`, `wage_arrears_hours` e `heroes_departed` passaram a ser medidas (`wages_paid` continua reservada: o jogo não conta o soldo pago em lugar nenhum).

### 4.2 O que os bots fazem com a Taverna

Todos leem só a visão.

- **A obra.** Nenhum bot tem política para a Taverna: ela é um edifício da lista, e `obra mais barata` a ergue e a melhora nos três. Em Senhor, o Regular a tem pronta entre as horas reais 25 e 27 no Rápido, 51 e 59 no Normal e 88 e 97 no Tranquilo, sempre uma ou duas visitas depois do Salão no nível 3; o Dedicado, entre a 19 e a 23, a 44 e a 49 e a 78 e a 89; o Preguiçoso, entre a 55 e a 59, a 91 e a 95 e na 150. No primeiro ano do Rápido o Preguiçoso nem sempre chega a ela.
- **Contratar** (`contratar`, só no `explorador`): enquanto o ouro pagar o preço do candidato **e** 24 horas reais de soldo da equipe inteira, já com ele, na ordem da lista, só o que a visão diz que pode. Não olha classe nem traço, e não dispensa. Nenhuma ordem saiu para ser recusada em partida nenhuma.
- **Festival** (`dar festival`, só no `explorador`): um por estação, quando o estoque paga três vezes o custo.
- **O `preguicoso` nunca contrata e nunca dá festival** (registrado, V3C-T2.7); o `economico` também não. Os dois medem o jogador que tem a Taverna e não a usa.

### 4.3 A Guilda, por célula

**Senhor, 7 dias reais:**

| Ritmo | Perfil | Heróis no fim | Contratados | Partiram sem soldo | Soldo em atraso (h) | Primeiro herói (h) | Taverna (nível) | Taverna pronta (h) | Festivais | Excedente de ouro |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso | 1 | 0 | 0 | 0 | 48 | 5 | 55 a 59 | 0 | 2.074 a 5.918 |
| Rápido 3× | Regular | 1 | 0 | 0 | 0 | 24 | 5 | 25 a 27 | 0 | 159.093 a 211.754 |
| Rápido 3× | Dedicado | 1 | 0 | 0 | 0 | 12 | 5 | 19 a 23 | 0 | 319.205 a 366.691 |
| Rápido 3× | Explorador | 6 | 5 | 0 | 0 | 24 | 5 | 25 a 27 | 8 a 9 | 172.009 a 239.360 |
| Normal 1× | Preguiçoso | 1 | 0 | 0 | 21 | 48 | 4 | 91 a 95 | 0 | 3 a 268 |
| Normal 1× | Regular | 1 | 0 | 0 | 0 | 24 a 36 | 5 | 51 a 59 | 0 | 8.283 a 23.840 |
| Normal 1× | Dedicado | 1 | 0 | 0 | 0 | 24 | 5 | 44 a 49 | 0 | 4.399 a 19.802 |
| Normal 1× | Explorador | 6 | 5 | 0 | 0 | 24 a 36 | 5 | 51 a 59 | 2 a 3 | 6.593 a 26.449 |
| Tranquilo 0,5× | Preguiçoso | 1 | 0 | 0 | 0 | 48 | 1 | 150 | 0 | 120 a 154 |
| Tranquilo 0,5× | Regular | 1 | 0 | 0 | 0 | 48 | 4 a 5 | 88 a 97 | 0 | 6 a 1.233 |
| Tranquilo 0,5× | Dedicado | 1 | 0 | 0 | 0 | 48 | 5 | 78 a 89 | 0 | 68 a 745 |
| Tranquilo 0,5× | Explorador | 3 a 5 | 2 a 4 | 0 | 0 | 48 | 4 | 88 a 97 | 0 a 1 | 260 a 1.206 |

**Senhor, um ano de jogo:**

| Ritmo | Perfil | Heróis no fim | Contratados | Partiram sem soldo | Soldo em atraso (h) | Primeiro herói (h) | Taverna (nível) | Taverna pronta (h) | Festivais | Excedente de ouro |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Preguiçoso | 1 | 0 | 0 | 0 | 48 | 0 a 1 | 55 a — | 0 | 3 a 253 |
| Rápido 3× | Regular | 1 | 0 | 0 | 0 | 24 | 3 | 25 a 27 | 0 | 1.859 a 3.000 |
| Rápido 3× | Dedicado | 1 | 0 | 0 | 0 | 12 | 5 | 19 a 23 | 0 | 332 a 13.499 |
| Rápido 3× | Explorador | 3 | 2 | 0 | 0 | 24 | 3 | 25 a 27 | 1 a 2 | 1.349 a 2.718 |
| Normal 1× | Preguiçoso | 1 | 0 | 0 | 21 | 48 | 4 | 91 a 95 | 0 | 3 a 268 |
| Normal 1× | Regular | 1 | 0 | 0 | 0 | 24 a 36 | 5 | 51 a 59 | 0 | 8.283 a 23.840 |
| Normal 1× | Dedicado | 1 | 0 | 0 | 0 | 24 | 5 | 44 a 49 | 0 | 4.399 a 19.802 |
| Normal 1× | Explorador | 6 | 5 | 0 | 0 | 24 a 36 | 5 | 51 a 59 | 2 a 3 | 6.593 a 26.449 |
| Tranquilo 0,5× | Preguiçoso | 1 | 0 | 0 | 0 | 48 | 5 | 150 | 0 | 3.190 a 10.670 |
| Tranquilo 0,5× | Regular | 1 | 0 | 0 | 0 | 48 | 5 | 88 a 97 | 0 | 11.000 a 20.021 |
| Tranquilo 0,5× | Dedicado | 1 | 0 | 0 | 0 | 48 | 5 | 78 a 89 | 0 | 26.232 a 32.859 |
| Tranquilo 0,5× | Explorador | 6 | 5 | 0 | 0 | 48 | 5 | 88 a 97 | 2 a 3 | 11.281 a 23.668 |

- **Ninguém perde herói**, em perfil, ritmo ou dificuldade nenhuma (72 células, 50 sementes cada): zero heróis que partem e zero dispensados. **O Preguiçoso não perdeu herói.** Ele só tem Edda, que é Leal; a pergunta do ADR 0017 ("o perfil Preguiçoso não perde herói por uma noite fora") continua **sem resposta medida** para um herói que não é Leal, porque nenhum bot chega a ter um e ficar sem ouro (seção 4.7).
- **O soldo em atraso** só aparece onde já aparecia: 21 h reais no Preguiçoso do ritmo Normal, em toda semente, nas três dificuldades, com Edda. **O Explorador nunca atrasa o soldo**: a política guarda um dia de soldo no cofre antes de contratar.
- **O Explorador enche a Taverna.** Onde a partida chega à Taverna no nível 5, ele termina com os seis heróis (cinco contratados e Edda): na semana do Rápido e do Normal e no ano do Normal e do Tranquilo, em toda semente de Senhor. No ano do Rápido (56 h reais) a Taverna fica no nível 3 e ele termina com três; na semana do Tranquilo, com três a cinco. Em Camponês, no Normal, uma parte das sementes termina com cinco; em Rei de Ferro, na semana do Tranquilo, com dois a cinco.
- **Festivais:** oito ou nove na semana do Rápido (três anos de jogo, doze estações), dois ou três no Normal e no ano do Tranquilo, um ou dois no ano do Rápido, nenhum ou um na semana do Tranquilo.
- **"Primeiro herói"** é o da carta em todo perfil: a Taverna fica pronta depois dela.

### 4.4 O ouro parado: contratar não o gasta

É o número que a v0.3 promete baixar (seção 1.3). **A Taverna sozinha o fez subir, e a contratação não o trouxe de volta.**

| Célula (Senhor) | Antes (seção 3) | Regular, com a Taverna | Explorador, que contrata |
|---|---:|---:|---:|
| 7 dias, Rápido 3× | 150.285 | 211.754 | 239.360 |
| 7 dias, Normal 1× | 19.777 | 23.840 | 26.449 |
| 7 dias, Tranquilo 0,5× | 1.104 | 1.233 | 1.206 |
| Ano de jogo, Rápido 3× | 2.979 | 3.000 | 2.718 |
| Ano de jogo, Tranquilo 0,5× | 21.490 | 20.021 | 23.668 |

- **Por que subiu.** A moral da Taverna rende mais em todo ofício (o fator da moral na produção vai de 1,05, com a moral em 60, a 1,175, com ela em 85) e traz colonos: o Regular da semana do Rápido termina com 75 a 85 aldeões (eram 72 a 76), e com as obras esgotadas o bot manda todo mundo para a Mina. Na semente 001, no fim da semana, são 66 mineiros rendendo 2.780 de ouro por hora real.
- **Por que contratar não resolve.** Cinco heróis custam de 80 a 300 de ouro cada um, uma vez, e 6 de ouro por hora real de soldo cada um no Rápido: na mesma semente, o soldo dos seis heróis é de 36 por hora contra 2.508 da Mina. Em uma semana são cerca de 4 mil de ouro de soldo, 644 de contratação e 450 de festivais, contra 200 mil parados. **A Taverna é um sumidouro de ouro duas ordens de grandeza menor do que a Mina do fim de jogo.** O que pode gastar o ouro, pelo plano, são as expedições e o Mercado (Fases D e E).
- **O Explorador termina a semana do Rápido com mais ouro parado do que o Regular** em parte das sementes (o máximo é 239 mil contra 212 mil): os festivais somam +15 de moral em nove das doze estações, e a moral rende ouro.

### 4.5 As faixas, antes e depois

**Senhor** (antes → depois; só o que mudou aparece com seta; o Explorador é novo e não tem "antes"):

| Janela | Ritmo | Perfil | População | Salão (mín.) | Madeira parada (máx.) | Pedra parada (máx.) | Ouro parado (máx.) | Maior sequência desperdiçando (h de jogo) |
|---|---|---|---|---|---|---|---|---|
| 7 dias | Rápido 3× | Preguiçoso | 36 a 39 → **41 a 60** | 7 | 3.400 | 3.400 | 6.778 → **5.918** | 75 |
| 7 dias | Rápido 3× | Regular | 72 a 76 → **75 a 85** | 8 → **7** | 4.324 → **3.889** | 5.200 | 150.285 → **211.754** | 33 → **36** |
| 7 dias | Rápido 3× | Dedicado | 84 a 85 → **85** | 8 | 5.013 → **4.225** | 5.200 | 319.751 → **366.691** | 18 → **42** |
| 7 dias | Rápido 3× | Explorador | 75 a 85 | 7 | 5.200 | 5.200 | 239.360 | 33 |
| 7 dias | Normal 1× | Preguiçoso | 31 a 34 → **31 a 35** | 5 | 1.799 → **1.068** | 2.640 → **2.270** | 982 → **268** | 16 → **28** |
| 7 dias | Normal 1× | Regular | 64 a 73 → **64 a 75** | 7 | 4.600 → **4.036** | 4.592 → **4.541** | 19.777 → **23.840** | 8 → **10** |
| 7 dias | Normal 1× | Dedicado | 84 a 85 | 8 | 5.200 | 5.200 | 18.559 → **19.802** | 4 → **3** |
| 7 dias | Normal 1× | Explorador | 64 a 75 | 7 | 4.409 | 4.529 | 26.449 | 9 |
| 7 dias | Tranquilo 0,5× | Preguiçoso | 29 | 4 | 339 → **116** | 1.599 → **1.225** | 99 → **154** | 8 |
| 7 dias | Tranquilo 0,5× | Regular | 50 a 54 → **45 a 54** | 6 → **5** | 1.492 → **1.641** | 987 → **1.133** | 1.104 → **1.233** | 1,5 |
| 7 dias | Tranquilo 0,5× | Dedicado | 56 a 64 → **54 a 59** | 6 | 1.884 → **1.075** | 829 → **694** | 897 → **745** | 0,5 → **1** |
| 7 dias | Tranquilo 0,5× | Explorador | 49 a 54 | 5 | 1.087 | 756 | 1.206 | 2 |
| Ano de jogo | Rápido 3× | Preguiçoso | 16 | 3 | 194 → **177** | 516 | 256 → **253** | 63 |
| Ano de jogo | Rápido 3× | Regular | 27 a 30 | 5 | 772 → **778** | 930 → **805** | 2.979 → **3.000** | 6 → **9** |
| Ano de jogo | Rápido 3× | Dedicado | 51 a 56 → **51 a 63** | 6 | 2.793 → **1.770** | 2.049 → **2.006** | 12.515 → **13.499** | 18 |
| Ano de jogo | Rápido 3× | Explorador | 27 a 35 | 5 | 783 | 854 | 2.718 | 9 |
| Ano de jogo | Normal 1× | Preguiçoso | 31 a 34 → **31 a 35** | 5 | 1.799 → **1.068** | 2.640 → **2.270** | 982 → **268** | 16 → **28** |
| Ano de jogo | Normal 1× | Regular | 64 a 73 → **64 a 75** | 7 | 4.600 → **4.036** | 4.592 → **4.541** | 19.777 → **23.840** | 8 → **10** |
| Ano de jogo | Normal 1× | Dedicado | 84 a 85 | 8 | 5.200 | 5.200 | 18.559 → **19.802** | 4 → **3** |
| Ano de jogo | Normal 1× | Explorador | 64 a 75 | 7 | 4.409 | 4.529 | 26.449 | 9 |
| Ano de jogo | Tranquilo 0,5× | Preguiçoso | 62 a 63 → **59 a 66** | 7 → **6** | 1.293 → **4.600** | 221 → **2.278** | 4.634 → **10.670** | 8 |
| Ano de jogo | Tranquilo 0,5× | Regular | 84 a 85 | 8 | 5.200 | 5.200 | 21.490 → **20.021** | 3 → **5,5** |
| Ano de jogo | Tranquilo 0,5× | Dedicado | 84 → **84 a 85** | 8 | 5.188 → **5.200** | 5.200 | 31.643 → **32.859** | 3 → **5,5** |
| Ano de jogo | Tranquilo 0,5× | Explorador | 84 a 85 | 8 | 5.200 | 5.200 | 23.668 | 5 |

**Camponês** (antes → depois; só o que mudou aparece com seta; o Explorador é novo e não tem "antes"):

| Janela | Ritmo | Perfil | População | Salão (mín.) | Madeira parada (máx.) | Pedra parada (máx.) | Ouro parado (máx.) | Maior sequência desperdiçando (h de jogo) |
|---|---|---|---|---|---|---|---|---|
| 7 dias | Rápido 3× | Preguiçoso | 36 a 39 → **41 a 60** | 7 | 4.250 | 4.250 | 6.804 → **5.954** | 63 |
| 7 dias | Rápido 3× | Regular | 72 a 76 → **84 a 85** | 8 | 5.634 → **6.500** | 6.500 | 150.960 → **229.537** | 33 |
| 7 dias | Rápido 3× | Dedicado | 84 a 85 → **85** | 8 | 6.052 → **5.752** | 6.500 | 320.468 → **378.434** | 15 → **30** |
| 7 dias | Rápido 3× | Explorador | 85 | 8 | 5.480 | 6.500 | 250.116 | 33 |
| 7 dias | Normal 1× | Preguiçoso | 31 a 34 → **31 a 35** | 5 | 1.922 → **1.273** | 3.098 → **2.825** | 961 → **262** | 13 → **18** |
| 7 dias | Normal 1× | Regular | 61 a 72 → **65 a 77** | 7 | 5.026 → **4.999** | 4.990 → **5.740** | 19.614 → **23.083** | 7 → **8** |
| 7 dias | Normal 1× | Dedicado | 84 a 85 | 8 | 6.500 | 6.500 | 20.127 → **21.901** | 4 |
| 7 dias | Normal 1× | Explorador | 65 a 76 | 7 | 5.074 | 5.525 | 25.376 | 10 |
| 7 dias | Tranquilo 0,5× | Preguiçoso | 25 a 27 | 3 | 1.861 → **1.704** | 2.000 | 283 → **167** | 4,5 |
| 7 dias | Tranquilo 0,5× | Regular | 50 a 54 → **45 a 54** | 6 → **5** | 1.029 → **1.555** | 1.038 → **989** | 1.104 → **1.283** | 1 |
| 7 dias | Tranquilo 0,5× | Dedicado | 57 a 64 → **54 a 60** | 6 | 1.406 → **1.032** | 1.201 → **742** | 1.101 → **838** | 0,5 |
| 7 dias | Tranquilo 0,5× | Explorador | 45 a 54 | 5 | 1.139 | 859 | 1.222 | 1,5 |
| Ano de jogo | Rápido 3× | Preguiçoso | 16 | 3 | 363 | 516 | 154 → **150** | 60 |
| Ano de jogo | Rápido 3× | Regular | 27 a 30 → **22 a 29** | 5 | 578 → **781** | 1.112 → **1.076** | 3.392 → **2.836** | 6 → **3** |
| Ano de jogo | Rápido 3× | Dedicado | 52 a 55 → **53 a 64** | 6 | 2.011 → **1.905** | 2.585 → **3.616** | 14.378 → **14.831** | 12 → **9** |
| Ano de jogo | Rápido 3× | Explorador | 22 a 35 | 5 | 784 | 1.179 | 2.468 | 3 |
| Ano de jogo | Normal 1× | Preguiçoso | 31 a 34 → **31 a 35** | 5 | 1.922 → **1.273** | 3.098 → **2.825** | 961 → **262** | 13 → **18** |
| Ano de jogo | Normal 1× | Regular | 61 a 72 → **65 a 77** | 7 | 5.026 → **4.999** | 4.990 → **5.740** | 19.614 → **23.083** | 7 → **8** |
| Ano de jogo | Normal 1× | Dedicado | 84 a 85 | 8 | 6.500 | 6.500 | 20.127 → **21.901** | 4 |
| Ano de jogo | Normal 1× | Explorador | 65 a 76 | 7 | 5.074 | 5.525 | 25.376 | 10 |
| Ano de jogo | Tranquilo 0,5× | Preguiçoso | 60 a 62 | 7 | 2.281 → **1.149** | 827 → **1.233** | 6.250 → **5.517** | 5,5 → **8,5** |
| Ano de jogo | Tranquilo 0,5× | Regular | 84 a 85 | 8 | 6.500 | 6.500 | 20.062 → **19.800** | 3 → **4** |
| Ano de jogo | Tranquilo 0,5× | Dedicado | 84 a 85 | 8 | 6.500 → **6.499** | 6.500 | 33.509 → **35.524** | 2 |
| Ano de jogo | Tranquilo 0,5× | Explorador | 84 a 85 | 8 | 6.500 | 6.500 | 26.109 | 3,5 |

**Rei de Ferro** (antes → depois; só o que mudou aparece com seta; o Explorador é novo e não tem "antes"):

| Janela | Ritmo | Perfil | População | Salão (mín.) | Madeira parada (máx.) | Pedra parada (máx.) | Ouro parado (máx.) | Maior sequência desperdiçando (h de jogo) |
|---|---|---|---|---|---|---|---|---|
| 7 dias | Rápido 3× | Preguiçoso | 36 a 38 → **41 a 60** | 7 | 3.200 | 3.200 | 6.816 → **5.951** | 75 → **114** |
| 7 dias | Rápido 3× | Regular | 72 a 75 → **75** | 7 | 2.804 → **2.780** | 3.674 → **3.680** | 165.720 → **228.153** | 24 → **72** |
| 7 dias | Rápido 3× | Dedicado | 74 a 75 → **75** | 7 | 2.792 → **3.423** | 3.680 | 290.931 → **332.386** | 36 → **33** |
| 7 dias | Rápido 3× | Explorador | 75 | 7 | 2.780 | 3.680 | 247.030 | 69 |
| 7 dias | Normal 1× | Preguiçoso | 31 a 34 → **28 a 32** | 5 → **4** | 1.760 → **677** | 2.124 → **1.845** | 1.025 → **1.384** | 19 → **21** |
| 7 dias | Normal 1× | Regular | 59 a 72 → **64 a 73** | 6 → **7** | 3.662 → **3.680** | 3.680 → **2.782** | 19.471 → **22.940** | 8 → **9** |
| 7 dias | Normal 1× | Dedicado | 74 a 75 | 7 | 3.680 → **3.672** | 3.680 | 43.599 → **44.570** | 3 |
| 7 dias | Normal 1× | Explorador | 65 a 74 | 7 | 3.200 | 2.790 | 24.403 | 8 |
| 7 dias | Tranquilo 0,5× | Preguiçoso | 29 → **27** | 4 → **3** | 142 → **1.280** | 1.253 → **1.280** | 84 → **102** | 8,5 |
| 7 dias | Tranquilo 0,5× | Regular | 49 a 54 → **44 a 54** | 5 | 1.680 → **1.052** | 1.046 → **925** | 1.113 → **1.033** | 1 → **3** |
| 7 dias | Tranquilo 0,5× | Dedicado | 57 a 64 → **54 a 59** | 6 → **5** | 1.440 → **2.625** | 766 → **1.011** | 588 → **1.335** | 1 → **0** |
| 7 dias | Tranquilo 0,5× | Explorador | 47 a 54 | 5 | 1.368 | 865 | 960 | 1,5 |
| Ano de jogo | Rápido 3× | Preguiçoso | 16 | 2 | 268 | 517 | 426 | 66 |
| Ano de jogo | Rápido 3× | Regular | 27 a 30 | 4 → **5** | 588 → **632** | 602 → **589** | 6.215 → **2.753** | 6 |
| Ano de jogo | Rápido 3× | Dedicado | 48 a 55 → **52 a 61** | 6 | 1.569 → **1.571** | 1.650 → **1.795** | 14.072 → **16.222** | 18 → **12** |
| Ano de jogo | Rápido 3× | Explorador | 29 a 35 | 5 | 607 | 591 | 3.106 | 6 |
| Ano de jogo | Normal 1× | Preguiçoso | 31 a 34 → **28 a 32** | 5 → **4** | 1.760 → **677** | 2.124 → **1.845** | 1.025 → **1.384** | 19 → **21** |
| Ano de jogo | Normal 1× | Regular | 59 a 72 → **64 a 73** | 6 → **7** | 3.662 → **3.680** | 3.680 → **2.782** | 19.471 → **22.940** | 8 → **9** |
| Ano de jogo | Normal 1× | Dedicado | 74 a 75 | 7 | 3.680 → **3.672** | 3.680 | 43.599 → **44.570** | 3 |
| Ano de jogo | Normal 1× | Explorador | 65 a 74 | 7 | 3.200 | 2.790 | 24.403 | 8 |
| Ano de jogo | Tranquilo 0,5× | Preguiçoso | 59 a 62 → **62 a 64** | 7 → **6** | 1.691 → **1.220** | 1.345 → **470** | 4.587 → **6.456** | 8,5 |
| Ano de jogo | Tranquilo 0,5× | Regular | 74 a 75 | 7 | 3.680 | 3.680 | 43.597 → **43.982** | 3 |
| Ano de jogo | Tranquilo 0,5× | Dedicado | 74 a 75 → **75** | 7 | 3.680 → **3.647** | 3.680 | 52.092 → **55.609** | 2 → **2,5** |
| Ano de jogo | Tranquilo 0,5× | Explorador | 74 a 75 | 7 | 3.680 | 3.680 | 49.473 | 4 |

**O que piorou**, do mais grave para o menos. Nenhum número além dos da Taverna foi mexido, e os bots Regular, Dedicado e Preguiçoso não foram tocados:

- **O Salão sobe mais devagar em três células de Senhor.** No Regular da semana do Tranquilo ele termina no nível 5 nas 50 sementes (era 6); no Preguiçoso do ano do Tranquilo, no nível 6 em 38 das 50 (era 7); no Regular da semana do Rápido, no nível 7 em 4 das 50 (era 8). As cinco obras da Taverna somam 2.846 de madeira, 949 de pedra e 1.897 de ouro, e `obra mais barata` as põe na frente do Salão quando são as mais baratas. É o bot escolhendo pelo preço; um jogador que queira o Salão primeiro o terá. Em Camponês e em Rei de Ferro o padrão é o mesmo.
- **A meta de desperdício do Regular** (8 h de jogo seguidas; ADR 0013, decisão 17) **volta a ser descumprida em três células**: no ritmo Normal, uma das 50 sementes (021) tem 10 h seguidas de madeira indo ao chão; no ano do Rápido, duas (012 e 018) têm 9 h; e a semana do Rápido sobe de 33 para 36 h. Na seção 3 só a semana do Rápido passava. Mais gente produz mais antes de os depósitos crescerem, e as obras da Taverna entram na fila na frente das do Armazém.
- **O desperdício do Dedicado na semana do Rápido** mais que dobra: a maior sequência vai de 18 para 42 h de jogo.
- **O Preguiçoso do ritmo Normal** passa de 16 para 28 h seguidas desperdiçando (pedra), e o do ano do Tranquilo termina com o Armazém cheio (4.600 de madeira parada, eram 1.293) à espera da pedra do Salão.
- **O ouro parado** sobe nas células de fim de jogo (seção 4.4).

**O que melhorou:** a população. O Preguiçoso da semana do Rápido termina com 41 a 60 aldeões (eram 36 a 39), e o Regular, com 75 a 85. Não há fome, frio nem aldeão que parte em célula nenhuma, como antes.

### 4.6 As premissas do ADR 0017 que a rodada devia validar

O ADR pede que estas voltem ao autor "como pergunta pontual, com o número medido" se o resultado for ruim.

| Premissa | Resultado |
|---|---|
| O Preguiçoso não perde herói por uma noite fora, em nenhum ritmo | **Não medida.** Ninguém perde herói, mas o único herói do Preguiçoso é Leal (seção 4.3) |
| O jogador de duas visitas vê cada lista da Taverna ao menos uma vez | **Não vale no ritmo Rápido, por conta, e a rodada não a mede.** A lista troca a cada 12 dias de jogo: 24 h reais no Normal, 48 h no Tranquilo e **8 h no Rápido**. Quem visita de 12 em 12 horas vê duas de cada três listas no Rápido; quem visita uma vez por dia, uma de cada três. O simulador não conta listas vistas. Vai ao autor (pendências, C-21) |
| Quantos heróis o perfil Dedicado sustenta | **Não medida no Dedicado**, que joga com o bot `economico` e não contrata. O Explorador, com 2 visitas, sustenta os seis lugares da Taverna no nível 5 sem atrasar o soldo, nos três ritmos |
| Moral com e sem Taverna | A Taverna no nível 5 soma 25. Na semente 001 da semana do Rápido, a moral do Regular nas horas 24, 48, 96 e 168 é 60, 70, 85 e 75 (o 75 é com as casas cheias); antes da Taverna o teto sem carta era 60. A matriz mede a moral **mínima** de cada partida (50 no Rápido e no Normal, 40 no Tranquilo, como antes), não a média |

### 4.7 Tamanho do estado e da visão, e custo do avanço

`pnpm -s sim -- --perf`, no mesmo formato da seção 1.5 (Motor 0.2.0 · estado v16 · conteúdo `13c1be459b007c6a` · ritmo 3× · Node v24.15.0 · linux x64 · 9 repetições por medida):

| Feudo | Ausência (dias reais) | Viradas de dia de jogo | `advanceTo` (ms, mediana) | `advanceTo` (ms, pior) | `deriveViewState` (ms, mediana) | Eventos emitidos | Estado (bytes) | Visão (bytes) | Habitantes na volta |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Feudo novo, sem nenhuma ordem | 1 | 36 | 1,2 | 2,2 | 0,5 | 47 | 2.145 | 16.879 | 4 |
| Feudo novo, sem nenhuma ordem | 7 | 252 | 4,8 | 8,2 | 0,5 | 374 | 2.836 | 17.772 | 3 |
| Feudo novo, sem nenhuma ordem | 30 | 1.080 | 14 | 15,9 | 0,5 | 1.579 | 2.896 | 17.593 | 3 |
| Feudo de 2 dias reais (bot econômico, 2 visitas por dia) | 1 | 36 | 0,9 | 1,4 | 0,7 | 87 | 3.794 | 19.777 | 22 |
| Feudo de 2 dias reais (bot econômico, 2 visitas por dia) | 7 | 252 | 4,7 | 5,4 | 0,6 | 609 | 3.861 | 20.510 | 22 |
| Feudo de 2 dias reais (bot econômico, 2 visitas por dia) | 30 | 1.080 | 19,3 | 28,5 | 0,5 | 2.641 | 4.107 | 20.474 | 9 |
| Feudo de 7 dias reais (bot econômico, 2 visitas por dia) | 1 | 36 | 0,8 | 1 | 0,3 | 61 | 4.364 | 20.039 | 79 |
| Feudo de 7 dias reais (bot econômico, 2 visitas por dia) | 7 | 252 | 3,9 | 4,5 | 0,3 | 575 | 4.057 | 18.689 | 85 |
| Feudo de 7 dias reais (bot econômico, 2 visitas por dia) | 30 | 1.080 | 16,9 | 19,8 | 0,6 | 2.740 | 4.338 | 19.102 | 64 |

- **O estado foi de 2,0 a 3,5 kB (seção 1.5) para 2,1 a 4,4 kB**, e a visão, de 15,5 a 18,5 kB para 16,9 a 20,5 kB. São os feudos do bot `economico`: um herói, a Taverna erguida e três candidatos na mesa. A linha de base somava as Fases B e C inteiras; não foi medida a parte de cada tarefa.
- **Com seis heróis** (o Explorador no fim da semana do Rápido, semente 001): **5.069 bytes de estado e 22.408 de visão**; o Regular da mesma semente, com um herói, 4.381 e 22.411. O teto do teste de desempenho subiu de 4.000 para 5.500 bytes de estado (`perf.test.ts`).
- Os tempos são indicativos, como na seção 1.5: outro processo de testes rodava na máquina.

### 4.8 Limites desta medição

- **Nenhum herói que não é Leal ficou sem soldo.** O Descontente e a partida por soldo de um herói contratado só estão provados no motor (`wages.test.ts`), não no simulador. Um perfil que contrate sem guardar o soldo, ou que fique sem ouro de propósito, é de V3C-T5.
- **O Dedicado e o Preguiçoso não contratam.** Quantos heróis sustenta quem visita quatro vezes por dia, e o que acontece a quem contrata e some por uma semana, não foram medidos.
- **A política de contratar não escolhe.** Ela pega o primeiro candidato que cabe no cofre: a matriz não mede o valor de um traço nem de uma classe (não há o que eles façam antes da Fase D).
- **Listas vistas por visita** não são contadas (seção 4.6).
- **O efeito da obra, o da moral e o do sorteio não foram separados entre si**: o Regular e o Explorador separam só a contratação. Rodar a matriz com a Taverna sem a moral dela não é regra do jogo.
- **Camponês e Rei de Ferro** rodaram com as 50 sementes para regravar a linha de base; a cada `pnpm test`, só Senhor confere as 50, e as outras duas, 3.
- A cobertura do Conselho em 50 sementes (`SHOW_COVERAGE=1`) não foi remedida: o teste dela passa sem mudança de número.
- Node v24.15.0, como as seções 1 a 3.

## 5. Fase C fechada (V3C-T5)

Tarefa V3C-T5 do [roadmap da v0.3](roadmap-v0.3.md), subtarefas 5.2 e 5.3. É a rodada da fase inteira (heróis, soldo e atraso, a carta da estrangeira, a Taverna e a aba Guilda), **depois dos trinta commits de correção das duas revisões independentes** (`4e363ef` a `ad43df6`). Não muda regra, bot nem faixa: mede.

| | |
|---|---|
| Data | 2026-10-06 |
| Commit | `316a836` (o `ad43df6`, último commit de código e de correção, mais o registro das respostas do autor) |
| Identificação | Motor 0.2.0 · estado v16 · conteúdo `ddd52de8b881eaa1` (era `13c1be459b007c6a` na seção 4: as correções mexeram em frases e tiraram `festival.perSeason`) |
| Dificuldades | Camponês, Senhor e Rei de Ferro, 50 sementes cada (`pedra-alta-001` a `pedra-alta-050`) |
| Perfis | Preguiçoso (1 visita por dia), Regular (2), Dedicado (4) e Explorador (2, o bot que contrata), nos ritmos Rápido 3×, Normal 1× e Tranquilo 0,5×: 24 células por dificuldade, 3.600 partidas |
| Máquina | A da seção 1, Node v24.15.0 (não o 22 do `.nvmrc`) |

### 5.1 Comandos

```bash
pnpm -s sim -- --matrix --difficulty peasant > peasant.csv 2> peasant.md
pnpm -s sim -- --matrix --difficulty lord > lord.csv 2> lord.md
pnpm -s sim -- --matrix --difficulty ironKing > ironKing.csv 2> ironKing.md
pnpm -s sim -- --matrix --profile explorador > explorador-lord.csv 2> explorador-lord.md
pnpm -s sim -- --perf
```

Os cinco saíram com código 0; as quatro matrizes, com "Todas as partidas dentro das faixas". As saídas não ficaram no repositório. Três roteiros descartáveis, fora do repositório, usaram o simulador como biblioteca (`simulate`, com a opção `bot` que ele já tem para medir variações): a hora do primeiro herói semente a semente, o Preguiçoso com um herói que não é Leal (seção 5.4) e os bytes com seis heróis (seção 5.6). **Nenhum arquivo do simulador mudou.**

### 5.2 As correções da revisão não mexeram em número nenhum da matriz

- **A linha de base das três dificuldades é igual a `MEASURED`**, linha a linha (24 células em cada uma, comparadas por roteiro com `packages/sim-cli/src/bands.ts`). As tabelas "Guilda" de Senhor são as da seção 4.3, número a número.
- **`--matrix --profile explorador` devolve as mesmas 300 partidas** que o perfil Explorador da rodada padrão de Senhor (os dois CSVs comparados com `diff`): desde a V3C-T2 o perfil está na rodada padrão, e a opção só serve para rodá-lo sozinho.
- O motivo é o que a seção 6 de [pendencias-v0.3.md](pendencias-v0.3.md) já dizia: nenhum bot passa 12 h reais com fome nem com um herói que não é Leal em atraso, e as regras que a revisão corrigiu (a cobrança do que venceu, o Descontente na retomada, os prazos de quem chega a um atraso velho) não são alcançadas por nenhuma partida da matriz.

### 5.3 A Guilda, por perfil e ritmo, em Senhor

Menor / mediana / maior das 50 sementes (um número só quando são iguais). "Primeiro herói" é a hora real, desde a fundação, em que o feudo passa a ter um herói; "7 d" são 168 horas reais.

| Ritmo | Perfil | Primeiro herói (h real) | Heróis no fim, 7 d | Heróis no fim, ano de jogo | Soldo em atraso (h reais) | Heróis que partiram |
|---|---|---:|---:|---:|---:|---:|
| Rápido 3× | Preguiçoso | 48 | 1 | 1 | 0 | 0 |
| Rápido 3× | Regular | 24 | 1 | 1 | 0 | 0 |
| Rápido 3× | Dedicado | 12 | 1 | 1 | 0 | 0 |
| Rápido 3× | Explorador | 24 | 6 | 3 | 0 | 0 |
| Normal 1× | Preguiçoso | 48 | 1 | 1 | **21** | 0 |
| Normal 1× | Regular | 24 / 24 / 36 | 1 | 1 | 0 | 0 |
| Normal 1× | Dedicado | 24 | 1 | 1 | 0 | 0 |
| Normal 1× | Explorador | 24 / 24 / 36 | 6 | 6 | 0 | 0 |
| Tranquilo 0,5× | Preguiçoso | 48 | 1 | 1 | 0 | 0 |
| Tranquilo 0,5× | Regular | 48 | 1 | 1 | 0 | 0 |
| Tranquilo 0,5× | Dedicado | 48 | 1 | 1 | 0 | 0 |
| Tranquilo 0,5× | Explorador | 48 | 3 / 5 / 5 | 6 | 0 | 0 |

- **Camponês e Rei de Ferro dão a mesma tabela**, com duas diferenças no Explorador: em Camponês, no Normal, ele termina com 5 / 6 / 6 heróis; em Rei de Ferro, na semana do Tranquilo, com 2 / 5 / 5. A hora do primeiro herói, o atraso e as partidas são iguais nas três dificuldades (36 células, 50 sementes cada).
- **Nenhum herói partiu em nenhuma das 3.600 partidas**, e nenhum foi dispensado.
- **O único atraso é o do Preguiçoso no ritmo Normal: 21 h reais, em toda semente, nas três dificuldades**, como na seção 3.3. O herói dele é Edda, que é Leal: não fica Descontente e não parte.
- **O Explorador nunca atrasa**: a política dele guarda um dia de soldo antes de contratar.

**A meta "primeiro herói no dia 2" (GDD §15.2), medida.** O dia real 2 do ritmo Normal começa na hora 24, que é o início do 13º dia de jogo, o da carta.

| Perfil, no ritmo Normal | Hora real do primeiro herói | Dia real | Veredito |
|---|---:|---|---|
| Dedicado (4 visitas) | 24 em toda semente | no primeiro instante do dia 2 | cumpre |
| Regular e Explorador (2 visitas) | 24 na mediana; 36 na pior semente | dia 2 | cumpre |
| Preguiçoso (1 visita) | 48 em toda semente | no primeiro instante do dia 3 | **não cumpre, por uma visita** |

Nos outros ritmos a carta é a mesma, do 13º dia de jogo: hora 8 no Rápido, onde o herói chega nas horas 12, 24 e 48 conforme o perfil (quem não esvaziou a mesa antes da hora 8 só recebe a carta na audiência seguinte à visita, e a responde na visita depois dessa), e hora 48 no Tranquilo, onde todos a recebem e respondem na visita dessa hora. O atraso do Preguiçoso tem a causa que a seção 3.3 descreve: a carta pede lugar na mesa e não o reserva, e quem visita uma vez por dia encontra a mesa ocupada (pendência C-13, com o autor).

### 5.4 O Preguiçoso perde herói só por ter ficado fora uma noite?

**Na rodada padrão a pergunta continua sem medida**: o Preguiçoso só tem Edda, que é Leal. Para medi-la sem mudar o bot padrão nem as faixas, um roteiro descartável jogou o Preguiçoso com **uma política trocada**: à carta da estrangeira ele responde "Cuidar e deixar partir", e recebe Rolf, Arqueiro Prudente, que **não é Leal**. Uma segunda variante acrescenta uma contratação **sem folga** (contrata todo candidato que o cofre paga, sem guardar soldo nenhum): é quem contrata e some. 50 sementes × 3 ritmos × 3 dificuldades × as duas janelas (no Normal as duas são a mesma partida): 750 partidas por variante, 1.500 ao todo; os números foram iguais nas três dificuldades.

| Variante | Ritmo | Heróis no fim (7 d / ano) | Contratados (7 d / ano) | Maior atraso seguido (h reais) | Ficaram Descontentes | **Partiram** |
|---|---|---:|---:|---:|---:|---:|
| Com Rolf | Rápido 3× | 1 / 1 | — | 0 | 0 | **0** |
| Com Rolf | Normal 1× | 1 | — | 0 | 0 | **0** |
| Com Rolf | Tranquilo 0,5× | 1 / 1 | — | **18** | 1, em toda semente | **0** |
| Com Rolf, contratando sem folga | Rápido 3× | 5 / 1 | 4 / 0 | 0 | 0 | **0** |
| Com Rolf, contratando sem folga | Normal 1× | 3 a 4 | 2 a 3 | 0 | 0 | **0** |
| Com Rolf, contratando sem folga | Tranquilo 0,5× | 1 / 6 | 0 / 5 | **18** | 1, em toda semente | **0** |

- **Resposta medida: não.** Em 1.500 partidas com um herói que pode partir, o jogador de uma visita por dia **não perdeu herói nenhuma vez**, em ritmo e dificuldade nenhuma, nem contratando sem guardar soldo.
- **Mas ele vê o herói Descontente, no Tranquilo, em toda semente.** O atraso de Rolf dura 18 h reais seguidas: passa das 12 h reais do Descontente e fica a **6 h** das 24 h em que o primeiro herói parte. É uma noite fora que custa um dia de poder reduzido, e não um herói.
- **A margem é a visita, não o ouro.** Na semente 001 do Tranquilo, o bot gasta o ouro em uma obra na visita da hora 72, o atraso abre na hora 78, Rolf fica Descontente na virada da hora 92 e o atraso fecha na visita da hora 96, quando o bot põe gente na Mina. Um atraso de quem volta todo dia e acode o ouro não chega às 24 h, porque abre depois de uma visita e fecha na seguinte. Quem pula **uma** visita com o cofre vazio (48 h fora) passa das 24 h e perde um herói, e mais um a cada 2 h reais: é a regra da decisão 3, que o autor escolheu em tempo real justamente para que uma noite não custasse um herói. Isso é conta dos prazos; **o bot que pula visitas não existe e não foi medido**.
- **Com Rolf, o Normal não atrasa** (com Edda atrasa 21 h, da hora 51 à visita da hora 72): a opção "Cuidar" dá 40 de ouro e Rolf chega um dia de jogo depois, e na semente 001 esse ouro dura até a visita seguinte, com 2 de sobra. Conferido nessa semente só.
- **A premissa do ADR 0017 ("o perfil Preguiçoso não perde herói por uma noite fora em nenhum ritmo") fica validada nesta medida**, com a ressalva do Descontente no Tranquilo. Não volta ao autor como pergunta; fica registrada.

**O que a medida não cobre, e como cobrir:** (a) a variante não está no repositório: para ela valer a cada `pnpm test`, o caminho é um bot `preguicoso` com a opção da carta como parâmetro e uma célula sem faixa de ouro, só com "partiram = 0" (mudança do simulador, fora desta tarefa); (b) um jogador que falta um dia inteiro (uma política "pula a visita N"); (c) o atraso com heróis fora do feudo, que só existe na Fase D.

### 5.5 O ouro parado: não caiu

É o número que a v0.3 promete baixar (seção 1.3; roadmap, §8.3, "Ouro com destino"; pendência C-23). **Com a Fase C inteira, o ouro parado não caiu: subiu em quase toda célula de quem joga duas ou quatro vezes por dia.** Senhor, ouro em estoque no fim da janela, menor / mediana / maior das 50 sementes; "antes" é a linha de base da v0.2 fechada (seção 1.3).

| Ritmo | Perfil | 7 dias: antes | 7 dias: agora | Ano de jogo: antes | Ano de jogo: agora |
|---|---|---:|---:|---:|---:|
| Rápido 3× | Preguiçoso | 3.925 / 7.482 / 7.497 | 2.074 / 5.894 / 5.918 | 51 / 299 / 304 | 3 / 134 / 253 |
| Rápido 3× | Regular | 113.566 / 128.436 / 148.487 | **159.093 / 178.253 / 211.754** | 1.870 / 2.176 / 3.052 | 1.859 / 2.067 / 3.000 |
| Rápido 3× | Dedicado | 284.168 / 309.332 / 324.539 | **319.205 / 357.744 / 366.691** | 1.130 / 8.225 / 12.964 | 332 / 8.427 / 13.499 |
| Rápido 3× | Explorador | (o Regular, acima) | **172.009 / 197.030 / 239.360** | (o Regular) | 1.349 / 1.753 / 2.718 |
| Normal 1× | Preguiçoso | 1.034 / 1.066 / 1.139 | 3 / 165 / 268 | a mesma partida | a mesma partida |
| Normal 1× | Regular | 2.348 / 8.967 / 23.641 | **8.283 / 16.845 / 23.840** | a mesma partida | a mesma partida |
| Normal 1× | Dedicado | 2.587 / 13.399 / 21.575 | 4.399 / 16.404 / 19.802 | a mesma partida | a mesma partida |
| Normal 1× | Explorador | (o Regular) | **6.593 / 16.930 / 26.449** | a mesma partida | a mesma partida |
| Tranquilo 0,5× | Preguiçoso | 26 / 30 / 30 | 120 / 153 / 154 | 160 / 2.714 / 3.936 | 3.190 / 6.194 / 10.670 |
| Tranquilo 0,5× | Regular | 38 / 518 / 1.044 | 6 / 890 / 1.233 | 13.128 / 17.646 / 22.535 | 11.000 / 14.976 / 20.021 |
| Tranquilo 0,5× | Dedicado | 53 / 244 / 940 | 68 / 521 / 745 | 23.713 / 28.208 / 32.471 | 26.232 / 29.578 / 32.859 |
| Tranquilo 0,5× | Explorador | (o Regular) | 260 / 907 / 1.206 | (o Regular) | 11.281 / 16.858 / 23.668 |

- **Não caiu.** Na semana do Rápido a mediana do Regular foi de 128 mil para 178 mil (+39%) e a do Dedicado, de 309 mil para 358 mil (+16%); no Normal a do Regular quase dobrou (9,0 mil para 16,8 mil). O Explorador, que contrata cinco heróis e dá festival, termina com **mais** ouro do que o Regular na semana do Rápido (197 mil na mediana) e igual a ele no Normal.
- **Onde caiu, e por quê não conta.** No Preguiçoso do Rápido e do Normal (no Normal, de 1.066 para 165): ele quase não põe gente na Mina, e o soldo de um herói é parte grande de um ouro pequeno; é o mesmo perfil que passa 21 h em atraso. No ano de jogo do Rápido o Regular ficou igual (2,2 mil para 2,1 mil) e o Explorador, um pouco abaixo (1,8 mil). No ano do Tranquilo o Regular caiu 15% na mediana, e o Preguiçoso e o Dedicado subiram. Nenhuma dessas diferenças é a queda que a versão promete.
- **Por que não cai: o soldo é ordens de grandeza menor do que a Mina no fim da semana.** Um herói custa 2 de ouro por hora de jogo (6 por hora real no Rápido); seis heróis, 36 por hora real. Na semente 001 da semana do Rápido a Mina rende cerca de 2.500 por hora real no fim (seção 4.4): o soldo da equipe cheia é 1,4% disso. Em uma semana são perto de 4 mil de ouro de soldo, 644 de contratação e 450 de festivais, contra 200 mil parados.
- **Por que sobe:** a Taverna soma até 25 de moral, a moral rende mais em todo ofício e traz colonos, e com as obras esgotadas o bot manda todos para a Mina (seção 4.4). A Fase C deu ao ouro um destino pequeno e uma fonte maior.
- **É o que as Fases D e E têm de resolver** (pendência C-23): as expedições (equipamento, Resgate, o que a Guilda-edifício custar) e o Mercado, onde o ouro compra o que falta. Se ao fim da Fase E estas células não caírem em relação à seção 1.3, a promessa da versão não está cumprida, e a pergunta volta ao autor com estes números (V3E-T5.2, V3G-T1).

### 5.6 Desempenho, tamanho do estado e da visão, e o teto da Taverna

`pnpm -s sim -- --perf`, com a máquina quieta (nenhuma outra suíte rodando), no formato das seções 1.5 e 4.7 (Motor 0.2.0 · estado v16 · conteúdo `ddd52de8b881eaa1` · ritmo 3× · Node v24.15.0 · linux x64 · 9 repetições por medida):

| Feudo | Ausência (dias reais) | Viradas de dia de jogo | `advanceTo` (ms, mediana) | `advanceTo` (ms, pior) | `deriveViewState` (ms, mediana) | Eventos emitidos | Estado (bytes) | Visão (bytes) | Habitantes na volta |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Feudo novo, sem nenhuma ordem | 1 | 36 | 1,3 | 4 | 0,5 | 47 | 2.145 | 17.245 | 4 |
| Feudo novo, sem nenhuma ordem | 7 | 252 | 5,8 | 10,9 | 0,6 | 374 | 2.836 | 18.172 | 3 |
| Feudo novo, sem nenhuma ordem | 30 | 1.080 | 14,1 | 15,8 | 0,5 | 1.579 | 2.896 | 17.993 | 3 |
| Feudo de 2 dias reais (bot econômico, 2 visitas por dia) | 1 | 36 | 0,9 | 1,3 | 0,6 | 87 | 3.794 | 20.161 | 22 |
| Feudo de 2 dias reais (bot econômico, 2 visitas por dia) | 7 | 252 | 4,7 | 4,9 | 0,6 | 609 | 3.861 | 20.894 | 22 |
| Feudo de 2 dias reais (bot econômico, 2 visitas por dia) | 30 | 1.080 | 17,5 | 34,3 | 0,4 | 2.641 | 4.107 | 20.858 | 9 |
| Feudo de 7 dias reais (bot econômico, 2 visitas por dia) | 1 | 36 | 0,8 | 1,3 | 0,4 | 61 | 4.364 | 20.423 | 79 |
| Feudo de 7 dias reais (bot econômico, 2 visitas por dia) | 7 | 252 | 3,4 | 4,8 | 0,3 | 575 | 4.057 | 19.073 | 85 |
| Feudo de 7 dias reais (bot econômico, 2 visitas por dia) | 30 | 1.080 | 16,1 | 16,9 | 0,5 | 2.740 | 4.338 | 19.486 | 64 |

**Contra a linha de base da v0.2 fechada (seção 1.5):**

| Medida | Linha de base (estado v12) | Fase C fechada (estado v16) | Diferença |
|---|---:|---:|---|
| Estado, feudo novo, 1 dia fora | 1.954 | 2.145 | +191 bytes |
| Estado, o maior dos nove cenários | 3.520 | 4.364 | +844 bytes (+24%) |
| Visão, feudo novo, 1 dia fora | 15.724 | 17.245 | +1.521 bytes |
| Visão, a maior dos nove cenários | 18.519 | 20.894 | +2.375 bytes (+13%) |
| `advanceTo`, 30 dias reais fora (1.080 viradas), mediana | 14,5 a 16,7 ms | 14,1 a 17,5 ms | sem diferença que se meça |
| `advanceTo`, 30 dias reais fora, pior das 9 repetições | 15,7 a 24,9 ms | 15,8 a 34,3 ms | uma repetição de 34 ms no feudo de 2 dias; as outras duas, 15,8 e 16,9 |
| `deriveViewState`, mediana | 0,3 a 0,6 ms | 0,3 a 0,6 ms | igual |

- **Contra a seção 4.7 (a Taverna, antes da interface e das correções): o estado é idêntico, byte a byte, nos nove cenários; a visão cresceu de 366 a 400 bytes em cada um.** O que entrou na visão entre as duas medidas foram as frases `guild.text` e `guild.dismissText` (V3C-T4) e os campos `wage.afterArrivals` e `wage.lingering` (as correções da revisão); a parte de cada um não foi separada. Nenhuma correção mudou a forma do estado.
- **Os tempos continuam indicativos**: uma rodada só, nove repetições. A ordem de grandeza é a da linha de base: 30 dias reais fora, no ritmo 3, custam de 14 a 18 ms de `advanceTo`.

**Com seis heróis e a Taverna cheia.** Roteiro descartável: as 50 sementes do Explorador em Senhor, semana do Rápido. **Todas terminam com 6 heróis, a Taverna no nível 5 e 3 candidatos na mesa**, que é o teto do que a Fase C põe no estado (o limite de contratação é 6; a lista de heróis aceita até 12 por recompensa de carta, o que hoje nenhuma partida alcança: só há dois heróis com nome).

| Feudo no fim da semana do Rápido (50 sementes) | Estado (bytes): menor / mediana / maior | Visão (bytes): menor / mediana / maior | `state.guild` | `view.guild` | `view.tavern` |
|---|---:|---:|---:|---:|---:|
| Explorador: 6 heróis, Taverna Nv5, 3 candidatos | 4.844 / 5.092 / **5.480** | 20.541 / 22.322 / **25.475** | 1.395 a 1.443 | 2.499 a 2.902 | 1.446 a 1.806 |
| Regular: 1 herói, Taverna Nv5, 3 candidatos | 4.030 / 4.229 / 4.640 | 18.582 / 19.169 / 23.275 | 591 a 607 | 818 | 1.211 a 1.476 |
| Linha de base da v0.2 (seção 1.5, feudo de 7 dias) | 3.340 a 3.520 | 16.891 a 17.403 | — | — | — |

- **Cinco heróis a mais custam cerca de 860 bytes de estado e 3,2 kB de visão** (as medianas). Dentro da guilda são perto de 163 bytes por herói em `state.guild` e 360 em `view.guild`; o resto da diferença da visão está fora da guilda (a moral, o ouro, os estoques de um feudo que joga diferente) e não foi separado. A semente 001 dá 5.069 bytes de estado (igual à seção 4.7) e 22.792 de visão (eram 22.408).
- **O estado com a equipe cheia fica em 4,8 a 5,5 kB, contra 3,3 a 3,5 kB do feudo de 7 dias da linha de base (+56% no maior caso); a visão, em 20,5 a 25,5 kB, contra 16,9 a 17,4 kB (+46% no maior caso).** Longe do dimensionamento do GDD §14 (uma visão de 100 kB). Cada recibo de comando guarda uma visão inteira: a tabela `commands` cresce na mesma proporção, e o volume em produção continua sem medida.
- **O teto do teste de desempenho** (`packages/sim-cli/src/perf.test.ts`: estado abaixo de 5.500 bytes) vale para os cenários de `--perf`, que jogam com o bot econômico (o maior dos nove: 4.364). O maior estado com seis heróis medido aqui, 5.480, **ficaria a 20 bytes dele**: quando a Fase D acrescentar expedições e inventário, o teto sobe de propósito, com a medida ao lado.

**O teto da Taverna (roadmap, §0.5, "nível alcançável").** Confirmado por teste de conteúdo existente, que roda em todo `pnpm test`: `packages/content/src/content.test.ts`, "cada nível vendido da Taverna cabe no depósito nas três dificuldades, com o Armazém que o Salão daquele nível deixa erguer". Ele calcula o custo de cada um dos cinco níveis com a mesma conta do motor e o compara com o que o Armazém guarda, em Camponês, Senhor e Rei de Ferro, com o Armazém no nível que o Salão exigido por aquela obra deixa erguer; o ouro não tem depósito. Na matriz de Senhor, a Taverna chega ao nível 5 nos quatro perfis na semana do Rápido (seção 4.3).

### 5.7 Limites desta medição

- **A resposta sobre o Preguiçoso vem de um roteiro descartável**, que não está no repositório e não roda no `pnpm test`: uma mudança futura na carta, no soldo ou no bot pode desfazê-la sem ninguém ver (seção 5.4, "como cobrir").
- **Ninguém perdeu herói em partida nenhuma**, padrão ou variante: a partida por soldo, a cobrança do que venceu com o atraso fechado (C-47) e os prazos de quem chega a um atraso velho (C-50) continuam provados só nos testes do motor.
- **Nenhum bot passa fome por 12 h reais**: a correção da deserção por fome (C-48), que muda partidas vivas da v0.2, não é exercitada pela matriz.
- **O Dedicado não contrata** (joga com o bot `economico`): quantos heróis sustenta quem visita quatro vezes por dia continua sem medida. Listas da Taverna vistas por visita, também (seção 4.6; pendência C-21).
- **A hora do primeiro herói, semente a semente, e os bytes com seis heróis** também saíram de roteiros descartáveis; a faixa de horas (menor e maior) está no relatório da matriz e confere com eles.
- A meta de desperdício do Regular continua "acima" no Rápido e no Normal (seção 4.5; pendência C-22): nada mudou.
- `SHOW_COVERAGE=1` (a cobertura do Conselho) não foi remedida. Uma rodada só de `--perf`. Node v24.15.0.

## 6. O motor das expedições (V3D-T1)

Tarefa V3D-T1 do [roadmap da v0.3](roadmap-v0.3.md). A Guilda dos Aventureiros, o envio, o percurso, a encruzilhada e a volta, com **dois grafos provisórios** (a Patrulha dos Arredores e a Floresta Antiga). O que se mede aqui é a máquina com uma política mínima: os números de saque e de dificuldade são de teste, e o catálogo de V3D-T3 vai trocá-los.

| | |
|---|---|
| Data | 2026-10-06 |
| Identificação | Motor 0.2.0 · estado v17 · conteúdo `90513f13225b2e4c` (era `ddd52de8b881eaa1` na seção 5) |
| Dificuldades | Camponês, Senhor e Rei de Ferro, 50 sementes cada (`pedra-alta-001` a `pedra-alta-050`) |
| Perfis | Preguiçoso (1 visita por dia), Regular (2), Dedicado (4) e Explorador (2), nos ritmos Rápido 3×, Normal 1× e Tranquilo 0,5×: 24 células por dificuldade, 3.600 partidas |
| Máquina | A da seção 1, Node v24.15.0 (não o 22 do `.nvmrc`) |

### 6.1 Comandos

```bash
pnpm -s sim -- --matrix --difficulty peasant > peasant.csv 2> peasant.md
pnpm -s sim -- --matrix --difficulty lord > lord.csv 2> lord.md
pnpm -s sim -- --matrix --difficulty ironKing > ironKing.csv 2> ironKing.md
```

As três rodaram **antes** de `MEASURED` ser atualizada e saíram com código 1, só com células do Explorador fora da faixa (o excedente parado, por poucas unidades); com a tabela nova, a prova de que nenhuma partida sai da faixa é `balance.test.ts`, no `pnpm test`. As saídas não ficaram no repositório. As médias das tabelas abaixo saíram de um roteiro descartável sobre os três CSVs.

### 6.2 O que os bots fazem com a Guilda

- **O `economico` e o `preguicoso` não a erguem.** A obra dela fica fora da corrida das obras (`sideBuildings`) e da conta do que juntar (`inTheRace`), como a Torre e a Paliçada: a quem não envia expedições ela não serve de nada. **As 18 células dos perfis Preguiçoso, Regular e Dedicado das três dificuldades ficaram iguais a `MEASURED`, linha a linha**: a tarefa não mexeu na economia de quem não usa a Guilda.
- **O `explorador`** ganhou três políticas: `erguer a Guilda` (quando tem um herói; antes de `obra mais barata`), `escolher o caminho` (a opção que a Postura tomaria) e `enviar expedições` (o primeiro destino aberto, com a menor equipe, na Postura Equilibrada). Na prática ele ergue a Guilda no nível 1, envia **uma Patrulha por visita**, sempre com o herói que chegou primeiro, e nunca passa disso: a Patrulha volta antes da visita seguinte, então os lugares nunca estão ocupados quando a política pergunta se vale melhorar a Guilda, e a Floresta Antiga, o segundo destino da lista, nunca é escolhida. **Nenhuma partida da matriz encontra uma encruzilhada** (pendência D-11).
- Nenhuma ordem do explorador é recusada (`explorador.test.ts`).

### 6.3 As expedições do Explorador, por célula

Média das 50 sementes; entre parênteses, a menor e a maior. Os desfechos são dos nós com dificuldade (um por Patrulha). "Herói-horas paradas" é uma amostra ao fim de cada hora real (pendência D-15).

| Dificuldade | Janela | Ritmo | Enviadas | Sucesso Pleno | Sucesso | Revés | Desastre | Heróis no fim | Herói-horas paradas |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|
| Senhor | 7 dias | Rápido 3× | 9,0 (9 a 10) | 7,1 | 2,0 | 0 | 0 | 6,0 | 672 |
| Senhor | 7 dias | Normal 1× | 5,8 (4 a 7) | 4,6 | 1,3 | 0 | 0 | 6,0 | 452 |
| Senhor | 7 dias | Tranquilo 0,5× | 3,5 (0 a 4) | 2,6 | 0,8 | 0 | 0 | 4,2 | 212 |
| Senhor | 1 ano | Rápido 3× | 0,0 (0 a 1) | 0 | 0 | 0 | 0 | 3,0 | 49 |
| Senhor | 1 ano | Normal 1× | 5,8 (4 a 7) | 4,6 | 1,3 | 0 | 0 | 6,0 | 452 |
| Senhor | 1 ano | Tranquilo 0,5× | 17,5 (14 a 18) | 13,3 | 4,1 | 0 | 0 | 6,0 | 1.185 |
| Camponês | 7 dias | Rápido 3× | 9,3 (7 a 10) | 7,2 | 2,0 | 0 | 0 | 6,0 | 671 |
| Camponês | 7 dias | Normal 1× | 5,8 (2 a 8) | 4,5 | 1,3 | 0 | 0 | 6,0 | 450 |
| Camponês | 7 dias | Tranquilo 0,5× | 3,4 (2 a 4) | 2,6 | 0,8 | 0 | 0 | 4,3 | 217 |
| Camponês | 1 ano | Rápido 3× | 0,5 (0 a 1) | 0,4 | 0,1 | 0 | 0 | 3,0 | 48 |
| Camponês | 1 ano | Tranquilo 0,5× | 17,4 (16 a 18) | 13,3 | 4,1 | 0 | 0 | 6,0 | 1.191 |
| Rei de Ferro | 7 dias | Rápido 3× | 9,3 (8 a 10) | 7,3 | 2,0 | 0 | 0 | 6,0 | 684 |
| Rei de Ferro | 7 dias | Normal 1× | 5,9 (3 a 7) | 4,6 | 1,3 | 0 | 0 | 6,0 | 457 |
| Rei de Ferro | 7 dias | Tranquilo 0,5× | 1,9 (0 a 4) | 1,5 | 0,4 | 0 | 0 | 4,1 | 210 |
| Rei de Ferro | 1 ano | Rápido 3× | 0,3 (0 a 1) | 0,2 | 0,1 | 0 | 0 | 3,0 | 60 |
| Rei de Ferro | 1 ano | Tranquilo 0,5× | 15,7 (12 a 18) | 12,1 | 3,6 | 0 | 0 | 6,0 | 1.184 |

(O ano no ritmo Normal é a mesma partida dos 7 dias.)

- **A Guilda chega tarde.** Em 7 dias no Rápido (14 visitas) saem 9 Patrulhas: a Guilda fica pronta por volta da quinta visita. **No ano do Rápido (56 horas reais, 4 ou 5 visitas) quase ninguém envia nada**: é o jogador de duas visitas no ritmo mais rápido que menos usa a mecânica central da versão.
- **Nenhum Revés e nenhum Desastre**: a Patrulha, com dificuldade em volta de 30, é o que o ADR 0017 pedia para o primeiro herói (ao menos Sucesso em mais de 9 de 10 sementes: aqui, em todas). É também o que a faz não ensinar nada sobre risco; os desfechos ruins só aparecem com o catálogo.
- **A equipe continua parada.** Com seis heróis e uma Patrulha de um herói por visita, cinco ficam no feudo recebendo soldo: as herói-horas paradas quase não caem em relação a não ter Guilda. O que as baixa é a segunda equipe (a Guilda no nível 2) e destinos mais longos.
- **Soldo em atraso: zero horas em todas as células**, e nenhum herói partiu.

### 6.4 As faixas do Explorador, antes e depois

Colunas: população (menor e maior), Salão, horas de fome, horas de frio, madeira, pedra e ouro parados, e a maior sequência desperdiçando. Só as 18 células do Explorador mudaram.

| Dificuldade | Célula | Antes (seção 4) | Depois |
|---|---|---|---|
| Senhor | week/3 | [75, 85], 7, 0, 0, 5200, 5200, 239360, 33 | [75, 85], 8, 0, 0, 4180, 5200, 239152, 33 |
| Senhor | week/1 e year/1 | [64, 75], 7, 0, 0, 4409, 4529, 26449, 9 | [65, 75], 7, 0, 0, 3957, 4156, 25501, 9 |
| Senhor | week/0.5 | [49, 54], 5, 0, 0, 1087, 756, 1206, 2 | [44, 52], 5, 0, 0, 1137, 865, 1083, 1.5 |
| Senhor | year/3 | [27, 35], 5, 0, 0, 783, 854, 2718, 9 | [25, 35], 5, 0, 0, 694, 898, 1995, 3 |
| Senhor | year/0.5 | [84, 85], 8, 0, 0, 5200, 5200, 23668, 5 | [84, 85], 8, 0, 0, 5200, 5200, 22354, 4.5 |
| Camponês | week/3 | [85, 85], 8, 0, 0, 5480, 6500, 250116, 33 | [85, 85], 8, 0, 0, 5480, 6500, 251529, 33 |
| Camponês | week/1 e year/1 | [65, 76], 7, 0, 0, 5074, 5525, 25376, 10 | [63, 77], 7, 0, 0, 4898, 5750, 21652, 10 |
| Camponês | week/0.5 | [45, 54], 5, 0, 0, 1139, 859, 1222, 1.5 | [48, 52], 5, 0, 0, 1160, 851, 1086, 1 |
| Camponês | year/3 | [22, 35], 5, 0, 0, 784, 1179, 2468, 3 | [22, 35], 5, 0, 0, 817, 1407, 2468, 3 |
| Camponês | year/0.5 | [84, 85], 8, 0, 0, 6500, 6500, 26109, 3.5 | [84, 85], 8, 0, 0, 6500, 6500, 24803, 4 |
| Rei de Ferro | week/3 | [75, 75], 7, 0, 0, 2780, 3680, 247030, 69 | [75, 75], 7, 0, 0, 2780, 3680, 245992, 69 |
| Rei de Ferro | week/1 e year/1 | [65, 74], 7, 0, 0, 3200, 2790, 24403, 8 | [64, 75], 7, 0, 0, 3537, 3654, 24869, 9 |
| Rei de Ferro | week/0.5 | [47, 54], 5, 0, 0, 1368, 865, 960, 1.5 | [45, 54], 5, 0, 0, 1343, 920, 1118, 1 |
| Rei de Ferro | year/3 | [29, 35], 5, 0, 0, 607, 591, 3106, 6 | [29, 35], 5, 0, 0, 741, 590, 2560, 6 |
| Rei de Ferro | year/0.5 | [74, 75], 7, 0, 0, 3680, 3680, 49473, 4 | [74, 75], 7, 0, 0, 3680, 3680, 47569, 3.5 |

- **A Guilda é uma obra a mais na fila** (600 de material no nível 1): o que muda nas células do Explorador é a ordem das obras, e com ela a população e o material parado, para um lado e para o outro. Nenhuma célula ganhou fome, frio ou um Salão mais baixo; em Senhor, no Rápido de 7 dias, o Salão mínimo subiu de 7 para 8.
- **O ouro parado não caiu**, e não era para cair com esta tarefa: a Guilda custa 200 de ouro uma vez, e cada Patrulha **traz** de 12 a 28. No Rápido de 7 dias o Explorador de Senhor termina com 239.152 de ouro parado (239.360 antes). É o mesmo retrato das seções 4.4 e 5.5: quem gasta ouro, nesta versão, é o Mercado (Fase E) e, talvez, o catálogo de V3D-T3, se alguma expedição custar o que o ADR 0018 (decisão 15) diz que não custa.

### 6.5 Limites desta medição

- **Os grafos são provisórios**: nenhum número daqui diz como as expedições de verdade se comportam. A Floresta Antiga e a encruzilhada não aparecem em partida nenhuma da matriz.
- **A parcela das encruzilhadas decididas pelo jogador**, que a aprovação em bloco do ADR 0018 pedia ao simulador, **não foi medida**: é zero de zero. Fica para V3D-T3 e V3D-T5, com um bot que vá a destinos com encruzilhada.
- `--perf` e os bytes do estado e da visão com expedições em curso **não foram medidos** nesta tarefa (a seção 5.6 é a última medição); o estado ganhou até três expedições de até oito registros e três relatórios, com teto na guarda.
- As três matrizes rodaram uma vez cada, antes da atualização de `MEASURED`; depois dela, quem confere as 3.600 partidas é o `pnpm test`.

## 7. Os desfechos (V3D-T2)

Rodada de 2026-10-06, com o estado na versão 18: ferimento, captura, experiência, itens, destinos por descoberta e o Covil limpo no motor, e o Explorador com as políticas novas (o destino mais difícil que a equipe passa com folga, equipar o melhor item, não enviar ferido, melhorar a Guilda). **Só o bot do Explorador mudou**: as células dos outros três perfis são as da seção 4, linha a linha, e quem as confere é o `pnpm test`.

### 7.1 Comandos

```bash
for d in lord peasant ironKing; do
  pnpm -s sim -- --matrix --profile explorador --difficulty $d > matriz-$d.csv 2> matriz-$d.md
done
pnpm -s sim -- --seed pedra-alta-001 --days 7 --time-scale 3 --strategy explorador > semana.csv
```

A medição da seção 7.3 saiu de um roteiro avulso sobre `simulate` (não ficou no repositório): um ano de jogo (168 h de jogo), 30 sementes (`pedra-alta-001` a `030`), duas visitas por dia, o `explorador` contra o `economico`, nos três ritmos e nas três dificuldades (540 partidas). A Ameaça é lida do estado, hora real a hora real; as incursões, os envios e os desfechos, dos eventos.

### 7.2 As faixas do Explorador, antes e depois

Colunas: população (menor e maior), Salão, horas de fome, horas de frio, madeira, pedra e ouro parados, e a maior sequência desperdiçando um recurso, em horas de jogo. "Antes" é a seção 6.4.

| Dificuldade | Célula | Antes (V3D-T1) | Depois (V3D-T2) |
|---|---|---|---|
| Senhor | week/3 | [75, 85], 8, 0, 0, 4180, 5200, 239152, 33 | [85, 85], 8, 0, 0, 4180, 5200, 236783, **54** |
| Senhor | week/1 e year/1 | [65, 75], 7, 0, 0, 3957, 4156, 25501, 9 | [**59**, 75], 7, 0, 0, 4600, 4588, 24543, 10 |
| Senhor | week/0.5 | [44, 52], 5, 0, 0, 1137, 865, 1083, 1.5 | [44, 52], 5, 0, 0, 1137, 921, 1083, 1.5 |
| Senhor | year/3 | [25, 35], 5, 0, 0, 694, 898, 1995, 3 | [25, 35], 5, 0, 0, 694, 898, 2064, 3 |
| Senhor | year/0.5 | [84, 85], 8, 0, 0, 5200, 5200, 22354, 4.5 | [84, 85], 8, 0, 0, 5200, 5200, 16346, 5 |
| Camponês | week/3 | [85, 85], 8, 0, 0, 5480, 6500, 251529, 33 | [85, 85], 8, 0, 0, 5480, 6500, 234242, 33 |
| Camponês | week/1 e year/1 | [63, 77], 7, 0, 0, 4898, 5750, 21652, 10 | [**59**, 76], 7, 0, 0, 5750, 5000, 19239, 9 |
| Camponês | week/0.5 | [48, 52], 5, 0, 0, 1160, 851, 1086, 1 | [**44**, 52], 5, 0, 0, 1114, 832, 1066, 1 |
| Camponês | year/3 | [22, 35], 5, 0, 0, 817, 1407, 2468, 3 | igual |
| Camponês | year/0.5 | [84, 85], 8, 0, 0, 6500, 6500, 24803, 4 | [84, 85], 8, 0, 0, 6500, 6500, 16672, 3.5 |
| Rei de Ferro | week/3 | [75, 75], 7, 0, 0, 2780, 3680, 245992, 69 | [75, 75], 7, 0, 0, 2780, 3680, 243650, 69 |
| Rei de Ferro | week/1 e year/1 | [64, 75], 7, 0, 0, 3537, 3654, 24869, 9 | [64, 75], 7, 0, 0, 3680, 3680, 24074, 9 |
| Rei de Ferro | week/0.5 | [45, 54], 5, 0, 0, 1343, 920, 1118, 1 | [44, 54], 5, 0, 0, 1343, 920, 1181, 1 |
| Rei de Ferro | year/3 | [29, 35], 5, 0, 0, 741, 590, 2560, 6 | [29, 35], 5, 0, 0, 649, 587, 2560, 6 |
| Rei de Ferro | year/0.5 | [74, 75], 7, 0, 0, 3680, 3680, 47569, 3.5 | [75, 75], 7, 0, 0, 3680, 3680, 44193, 3.5 |

**O que piorou, e por quê.** A Guilda deixou de ser uma obra só: o Explorador agora a leva até o nível 4 (480/160/320, 768/256/512 e 1.229/410/819 de material), e essas três obras disputam a fila com o Armazém e com as Habitações.

- **A menor população caiu no Normal** (de 65 para 59 em Senhor, de 63 para 59 em Camponês) e no Tranquilo de Camponês (de 48 para 44): na pior semente, as Habitações esperam a Guilda.
- **A maior sequência desperdiçando subiu no Rápido de 7 dias, em Senhor, de 33 para 54 horas de jogo**: é pedra indo ao chão enquanto a fila está com a Guilda. Nas outras células ficou igual ou caiu.
- **O ouro parado caiu pouco**, e onde caiu mais foi no ano do Tranquilo (de 22.354 para 16.346 em Senhor): são as obras da Guilda. No Rápido de 7 dias ele continua em 236.783: o retrato das seções 4.4, 5.5 e 6.4 não mudou, e não era esta tarefa que o mudaria.
- **Os heróis no fim, na pior semente, caíram um** (o teste `balance.test.ts` os fixa): no Normal, de 5 a 6 para **4** a 6; na semana do Tranquilo, de 3 a 5 para **2** a 5. A rota do Explorador passou da Patrulha (ouro) para a Floresta (madeira), o ouro em saque caiu, e o cofre paga um contrato a menos.
- **Uma partida de um ano terminou com a Ameaça em 90** (Senhor, Tranquilo, semente 047; o teste "a Ameaça não satura" pedia menos de 80 e passou a aceitar essa uma, com o motivo escrito). O Explorador limpou o Covil no verão (a Ameaça caiu a 16), o outono somou 3 por dia e **nenhum dos 16 sorteios de incursão saiu** (a chance vai de 3% a 48%: menos de 1% de acontecer), e ela chegou ao inverno em 88, onde ficou até a virada do ano. Das 250 partidas de um ano ou mais do Explorador em Senhor, é a única acima de 80; a seguinte termina em 79. **Não é o catálogo: é a regra da pendência D-24** (com o Covil limpo, só uma incursão no outono faz a Ameaça cair), que mudou de semente azarada porque a hora em que o Covil é limpo mudou.
- Nenhuma célula ganhou fome, frio nem um Salão mais baixo.

### 7.3 O ano do Explorador e o do Regular, lado a lado

Um ano de jogo, 30 sementes, médias por partida. "Ameaça" é a média da estação (primavera/verão/outono/inverno), o valor no fim do ano e o maior fim de ano das 30.

| Dificuldade | Ritmo | Perfil | Ameaça P/V/O/I | Fim (máx.) | Incursões no ano (P/V/O/I) | Envios | Reveses | Desastres | Feridos | Cativos | Níveis | Itens | Covil limpo (1ª vez) |
|---|---:|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| Senhor | 3 | Explorador | 12/37/61/52 | 47 (70) | 5,5 (1,0/0,6/2,6/1,3) | 0,1 | 0,0 | 0 | 0,0 | 0 | 0,0 | 0,0 | 2 de 30 (dia 73) |
| Senhor | 3 | Regular | 12/37/61/54 | 49 (70) | 5,6 (1,0/0,6/2,6/1,3) | 0 | 0 | 0 | 0 | 0 | 0 | 0 | nunca |
| Senhor | 1 | Explorador | 12/36/41/41 | 42 (75) | **3,2** (1,0/0,6/1,2/0,4) | 10,4 | 1,5 | 0 | 1,5 | 0 | 1,2 | 0,0 | 30 de 30 (dia 53) |
| Senhor | 1 | Regular | 12/37/60/55 | 49 (70) | 5,6 (1,0/0,6/2,6/1,3) | 0 | 0 | 0 | 0 | 0 | 0 | 0 | nunca |
| Senhor | 0,5 | Explorador | 12/15/36/43 | 43 (74) | **2,1** (1,0/0,0/0,7/0,3) | 39,1 | 3,9 | 0 | 3,9 | 0 | 3,6 | 0,3 | 30 de 30 (dia 34) |
| Senhor | 0,5 | Regular | 12/37/60/55 | 49 (70) | 5,6 (1,0/0,6/2,6/1,3) | 0 | 0 | 0 | 0 | 0 | 0 | 0 | nunca |
| Camponês | 3 | Explorador | 12/37/61/40 | 37 (70) | 5,3 (1,0/0,6/2,6/1,1) | 0,5 | 0,1 | 0 | 0,1 | 0 | 0,0 | 0,0 | 12 de 30 (dia 73) |
| Camponês | 1 | Explorador | 12/37/41/41 | 42 (75) | 3,3 (1,0/0,6/1,3/0,3) | 9,9 | 1,1 | 0 | 1,1 | 0 | 0,8 | 0,0 | 30 de 30 (dia 54) |
| Camponês | 0,5 | Explorador | 12/16/36/42 | 43 (74) | 2,1 (1,0/0,0/0,8/0,3) | 39,5 | 4,0 | 0 | 4,0 | 0 | 3,5 | 0,2 | 30 de 30 (dia 35) |
| Rei de Ferro | 3 | Explorador | 12/37/61/46 | 42 (70) | 5,4 (1,0/0,6/2,6/1,2) | 0,3 | 0,1 | 0 | 0,1 | 0 | 0,0 | 0,0 | 7 de 30 (dia 73) |
| Rei de Ferro | 1 | Explorador | 12/37/40/40 | 40 (75) | 3,2 (1,0/0,6/1,2/0,4) | 10,4 | 1,6 | 0 | 1,6 | 0 | 0,8 | 0,0 | 30 de 30 (dia 52) |
| Rei de Ferro | 0,5 | Explorador | 12/26/40/43 | 43 (74) | 2,5 (1,0/0,2/0,8/0,5) | 37,6 | 4,0 | 0 | 4,0 | 0 | 3,8 | 0,4 | 30 de 30 (dia 40) |

O Regular de Camponês e de Rei de Ferro mede o mesmo que o de Senhor (12/37/60/55, 5,6 incursões, nenhum envio), e ficou fora da tabela.

### 7.4 O Covil limpo: a validação que a decisão 14 pedia

A pergunta do ADR 0018: **limpar o Covil na primavera deixa o feudo sem incursão nenhuma até o outono?**

- **Sim.** Depois de o Covil ser limpo, nenhuma das 270 partidas do Explorador teve incursão na primavera, e no verão só as que já estavam marcadas quando a equipe venceu a toca (0,1 por partida, só em Rei de Ferro no Tranquilo). **No outono elas voltam**: 0,7 a 0,8 por ano, contra 2,6 de quem não limpou; e no inverno chegam 0,3 a 0,5, as que o outono marcou nos últimos dias.
- **Quando o jogador chega lá:** no Tranquilo, no dia 34 a 40 de jogo (verão) em todas as sementes; no Normal, no dia 52 a 54 (o começo do outono); **no Rápido quase nunca dentro do primeiro ano** (2, 12 e 7 de 30 sementes, no dia 73, já no inverno), porque a Guilda só fica de pé depois de 50 horas reais.
- **O ano inteiro:** as incursões caem de 5,6 para 2,1 (Tranquilo) ou 3,2 (Normal). A Ameaça média do outono cai de 60 para 36 a 41, e a do inverno, de 55 para 40 a 43. **Ela não satura**: o maior fim de ano das 30 sementes é 74 ou 75 (era 70 para quem não limpa).
- **A primeira medição desta tarefa deu outra resposta, e a regra mudou por causa dela.** Com o motor só sorteando incursão com um tile ativo (como na v0.2), o Covil limpo dava nenhuma incursão até a virada do ano, e o outono somava 3 por dia sem nada que fizesse a Ameaça cair: ela chegava ao inverno em 79 a 85 de média e ao fim do ano em 100, e o teste "a Ameaça não satura" da matriz falhou. A regra que entrou (**no outono os lobos descem a serra, com o Covil limpo ou não**: `threat.seasonEnemy`) é a que faz valer a frase do ADR. Foi decisão do agente ([pendencias-v0.3.md](pendencias-v0.3.md), D-24), **confirmada pelo autor em 2026-10-06** ("Manter os lobos do outono").

### 7.5 Capturas por ano: zero, e o que isso quer dizer

**Nenhum herói foi capturado, nem morreu, em nenhuma das 270 partidas do Explorador**, e nenhum nó terminou em Desastre. Não é a regra que está errada: é o bot, que só manda uma equipe a um destino mais duro quando o poder dela cobre a maior dificuldade à vista, e com isso a pior sorte dá Revés. A captura só está marcada no Resgate e nas Ruínas de Vel'Thar, e as Ruínas pedem dois heróis de nível 2 com mais de 88 de poder: em um ano, com 10 a 40 Patrulhas, a equipe sobe 1 a 4 níveis no total, e o bot não chega lá.

- A validação do ADR 0018, "capturas por ano no perfil Regular", **fica sem resposta do simulador**. Pede um bot que arrisque (enviar com o poder abaixo da dificuldade), ou gente jogando. É de V3D-T3, com o catálogo, e de V3D-T5.
- O que foi medido dos desfechos é o Revés: 1,1 a 1,6 feridos leves por ano no Normal e 4 no Tranquilo, sempre na toca do Covil ou na Patrulha de um herói fraco.
- **Itens:** 0,2 a 0,4 por ano no Tranquilo, zero no resto. O bot não vai à Floresta Antiga (o primeiro trecho dela não tem prova) nem às Ruínas, que são os dois lugares onde há item.

### 7.6 Limites desta medição

- **Os cinco grafos são provisórios**, e três deles foram escritos para os desfechos acontecerem em teste: nenhum número daqui diz como as expedições de verdade se comportam.
- A matriz inteira (os quatro perfis, 3.600 partidas) **não foi rodada**: só a do Explorador, uma vez por dificuldade, antes da atualização de `MEASURED`. As células dos outros perfis não mudaram de regra que os alcance, **com uma exceção que a matriz não mede**: nenhum deles limpa o Covil.
- A seção 7.3 é de 30 sementes, não de 50, e de um perfil de duas visitas por dia.
- `--perf` e os bytes do estado e da visão com itens, feridos e cativos **não foram medidos**. O estado ganhou até 30 itens no arsenal, três por herói e os campos novos em até oito registros por expedição, tudo com teto na guarda.
- A parcela das encruzilhadas decididas pelo jogador continua zero de zero (seção 6.5).

## 8. O catálogo de expedições e o relatório (V3D-T3)

Rodada de 2026-10-06, com o estado na versão 19: os seis modelos do catálogo, três variantes cada (dezoito grafos, com encruzilhada em quinze), o relatório nó a nó, e o Explorador com as duas políticas novas (**enviar a expedição de maior recompensa que a equipe passa com folga**, e **responder a metade das encruzilhadas e deixar a outra metade para a Postura**). **Só o bot do Explorador e o conteúdo das expedições mudaram**: as células dos outros três perfis são as da seção 4, linha a linha, e quem as confere é o `pnpm test`.

### 8.1 Comandos

```bash
pnpm --filter @lotg/engine test -- calibration     # a calibragem, exata; as tabelas ficam em __golden__/expedition-calibration.md
for d in lord peasant ironKing; do
  pnpm -s sim -- --matrix --profile explorador --difficulty $d > matriz-$d.csv 2> matriz-$d.md
done
pnpm -s sim -- --seed pedra-alta-001 --game-year --time-scale 3 --strategy explorador 2>&1 >/dev/null | grep -i expedi
```

As seções 8.3 e 8.4 saíram de dois roteiros avulsos sobre `simulate` (não ficaram no repositório): um ano de jogo do `explorador`, em Senhor, nos três ritmos; a 8.4 com 20 sementes (`pedra-alta-001` a `020`) e uma, duas e quatro visitas por dia, **antes** (o commit da V3D-T2, `7b4f6d5`) e **depois**; a 8.3 com 50 sementes e duas visitas por dia.

### 8.2 A calibragem: a distribuição exata dos desfechos, por modelo e equipe

A sorte de cada nó é um inteiro de 85 a 115, e a conta do desfecho é toda em inteiros: o teste **enumera as 31 sortes de cada nó, sem amostrar**, e multiplica os nós de um caminho (independentes, com a equipe inteira em todos). "Passa" é nenhuma prova abaixo do Sucesso; "Revés" é o pior desfecho do caminho ter sido um Revés; "Desastre", ao menos um. A coluna de cada Postura é o caminho que ela toma sem resposta do jogador (se a opção marcada pede uma classe ou um traço que a equipe não tem, vale o da Cautelosa), na média das três variantes. **"Passar" inclui recuar**: a Cautelosa que volta da encruzilhada passou tudo o que enfrentou, e não trouxe o que a jornada foi buscar.

| Modelo | Risco | Equipe | Cautelosa: passa | Equilibrada: passa / Revés / Desastre | Ousada: passa / Revés / Desastre | Captura (Equilibrada / Ousada) |
|---|---|---|---:|---|---|---|
| Patrulha dos Arredores | Baixo | Fraca: Clérigo Nv1 | 51% | 51% / 49% / 0% | 51% / 49% / 0% | 0% / 0% |
| Patrulha dos Arredores | Baixo | Mínima: Guerreiro Nv1 | 99% | 99% / 1% / 0% | 99% / 1% / 0% | 0% / 0% |
| Patrulha dos Arredores | Baixo | Com folga: Guerreiro Nv3 | 100% | 100% / 0% / 0% | 100% / 0% / 0% | 0% / 0% |
| Floresta Antiga | Baixo a médio | Fraca: Clérigo Nv1 | 100% | 34% / 62% / 3% | 100% / 0% / 0% | 0% / 0% |
| Floresta Antiga | Baixo a médio | Mínima: Guerreiro Nv1 | 100% | 76% / 24% / 0% | 33% / 46% / 20% | 0% / 0% |
| Floresta Antiga | Baixo a médio | Com folga: Guerreiro + Arqueiro Nv3 | 100% | 100% / 0% / 0% | 100% / 0% / 0% | 0% / 0% |
| Covil dos Lobos | Médio | Fraca: Clérigo + Clérigo Nv1 | 52% | 19% / 77% / 3% | 6% / 59% / 34% | 0% / 0% |
| Covil dos Lobos | Médio | Mínima: Guerreiro + Arqueiro Nv1 | 89% | 45% / 55% / 0% | 17% / 83% / 0% | 0% / 0% |
| Covil dos Lobos | Médio | Com folga: Guerreiro + Arqueiro Nv3 | 100% | 94% / 6% / 0% | 63% / 37% / 0% | 0% / 0% |
| Resgate | Alto | Fraca: Clérigo + Clérigo Nv1 | 8% | 0% / 100% / 0% | 7% / 71% / 22% | 0% / 22% |
| Resgate | Alto | Mínima: Guerreiro + Arqueiro Nv1 | 65% | 47% / 53% / 0% | 22% / 74% / 4% | 0% / 4% |
| Resgate | Alto | Com folga: Guerreiro + Arqueiro Nv3 | 100% | 100% / 0% / 0% | 53% / 47% / 0% | 0% / 0% |
| Ruínas de Vel'Thar | Médio | Fraca: Clérigo + Clérigo Nv2 | 82% | 34% / 59% / 6% | 35% / 56% / 10% | 6% / 10% |
| Ruínas de Vel'Thar | Médio | Mínima: Guerreiro + Arqueiro Nv2 | 100% | 18% / 82% / 0% | 38% / 62% / 0% | 0% / 0% |
| Ruínas de Vel'Thar | Médio | Com folga: Guerreiro + Arqueiro + Mago Nv4 | 100% | 100% / 0% / 0% | 100% / 0% / 0% | 0% / 0% |
| Pântano Nebuloso | Alto | Fraca: Mago + Clérigo + Clérigo Nv1 | 59% | 6% / 94% / 0% | 16% / 69% / 15% | 0% / 15% |
| Pântano Nebuloso | Alto | Mínima: Mago + Guerreiro + Arqueiro Nv1 | 80% | 20% / 80% / 0% | 53% / 44% / 2% | 0% / 2% |
| Pântano Nebuloso | Alto | Com folga: Mago + Guerreiro + Arqueiro Nv3 | 100% | 78% / 22% / 0% | 74% / 26% / 0% | 0% / 0% |

As equipes: a **mínima** é o menor número de heróis, no menor nível, com as classes exigidas e o resto na ordem Guerreiro, Arqueiro, Mago, Clérigo (a do ADR 0017); a **fraca** troca por Clérigos quem o modelo não exige; a **com folga** é o maior número de heróis, dois níveis acima. Sem traço e sem item. Nó a nó e opção a opção, as tabelas estão no golden e nas fichas de [content-v0.3.md](content-v0.3.md), seção 6.

**O que a calibragem mudou nos números, e por quê:**

- **Patrulha (Baixo).** As três variantes pedem coisas diferentes: 36 com os pesos de sempre, 40 com perícia ×1, 42 com vontade ×1 (eram 30, 28 e 32, quase iguais). **Um Guerreiro de nível 1 passa em 99%** (o ADR 0017 pedia mais de nove em dez), um Arqueiro em 72%, um Mago em 76% e **um Clérigo em 51%**; nenhuma classe chega ao Desastre. Com 30 em todas, a mínima nunca falhava.
- **Floresta (Baixo a médio).** A mínima (um Guerreiro) passa em 76% pelo riacho. A mata fechada (55 e 58) é de dupla: sozinho, o Guerreiro nunca passa de Revés ali, e é onde a Postura Ousada dá Desastre a quem foi só (20%).
- **Covil (Médio).** A dupla de nível 1 passa em 45% pelo caminho do meio, e com dois níveis a mais, em 94%. O Desastre só aparece para a dupla fraca (3%) ou no caminho ousado (34%).
- **Resgate (Alto).** A dupla de nível 1 traz o cativo em 47% pelo caminho do meio e em 65% pelo seguro; **pelo ousado, deixa alguém lá em 4%** (a dupla fraca, em 22%). É o único modelo em que os três caminhos cumprem a jornada.
- **Ruínas (Médio).** A pendência A-6 dizia que, com o guardião em 90, ninguém era capturado. Ficaram **92, 116 e 112** (um guardião de braço, um de vontade, um de perícia), fora da faixa "50 a 90" do ADR 0017: a dupla de referência (Guerreiro e Arqueiro de nível 2) chega ao guardião sempre e **sai com Revés em 82%**, sem captura; uma dupla sem a classe que o guardião pede é capturada em 6% a 10%; três de nível 4 passam sempre. **O modelo é para três**: é o que a ficha diz, e o que o relatório ensina ("faltou força").
- **Pântano (Alto).** Três de nível 1 com um Mago passam em 20%; dois níveis acima, em 78%. O caminho ousado captura (2% para a mínima, 15% para a fraca).

**Limite da conta:** quem é capturado ou morre no meio do caminho deixa de contar no poder dos nós seguintes, e a tabela não vê isso (a equipe é a que partiu). Os traços (o Corajoso na Ousada, o Prudente na Cautelosa) e os itens ficam de fora.

### 8.3 Cobertura: quantos destinos a Guilda conhece e quantos o Explorador envia

Um ano de jogo, 50 sementes, Senhor, duas visitas por dia. Por estação: o nível da Guilda no fim dela, os destinos conhecidos no fim dela (os três de sempre com a Guilda de pé, mais as Ruínas reveladas, o Pântano revelado com a Guilda no nível 3 e o Resgate com um cativo), os destinos diferentes enviados dentro da estação e, por destino, quantas das 50 partidas o enviaram.

| Ritmo | Estação | Guilda (nível: partidas) | Destinos conhecidos (média; mín–máx) | Destinos enviados na estação (média; mín–máx) | Envios | Quais (partidas que enviaram) |
|---:|---|---|---|---|---:|---|
| 3 | Primavera | Nv0: 50 | 0,0; 0–0 | 0,0; 0–0 | 0,0 | — |
| 3 | Verão | Nv0: 50 | 0,0; 0–0 | 0,0; 0–0 | 0,0 | — |
| 3 | Outono | Nv0: 48, Nv1: 2 | 0,1; 0–3 | 0,0; 0–0 | 0,0 | — |
| 3 | Inverno | Nv1: 50 | 3,0; 3–3 | 0,0; 0–1 | 0,0 | Floresta 2 |
| 1 | Primavera | Nv0: 50 | 0,0; 0–0 | 0,0; 0–0 | 0,0 | — |
| 1 | Verão | Nv0: 10, Nv1: 37, Nv2: 3 | 2,4; 0–4 | 0,1; 0–1 | 0,1 | Patrulha 2, Floresta 2, Covil 2 |
| 1 | Outono | Nv1: 1, Nv2: 4, Nv3: 30, Nv4: 15 | 3,2; 3–4 | 2,0; 1–3 | 5,7 | Covil 39, Floresta 49, Patrulha 11 |
| 1 | Inverno | Nv3: 2, Nv4: 48 | 3,3; 3–5 | 1,1; 1–3 | 4,9 | Floresta 50, Ruínas 3, Covil 3, Patrulha 1 |
| 0,5 | Primavera | Nv0: 50 | 0,0; 0–0 | 0,0; 0–0 | 0,0 | — |
| 0,5 | Verão | Nv1: 10, Nv2: 9, Nv3: 31 | 3,3; 3–5 | 2,3; 1–4 | 6,7 | Covil 45, Floresta 50, Patrulha 15, Ruínas 5 |
| 0,5 | Outono | Nv4: 50 | 3,6; 3–5 | 1,9; 1–5 | 20,0 | Floresta 50, Ruínas 15, Patrulha 14, Pântano 8, Covil 6 |
| 0,5 | Inverno | Nv4: 50 | 3,6; 3–5 | 1,5; 1–3 | 11,0 | Floresta 39, Ruínas 15, Patrulha 15, Pântano 8 |

- **No Rápido a Guilda só fica de pé no inverno** (era o que a seção 7 já media): o catálogo não é jogado no primeiro ano.
- **A Floresta Antiga é o destino de quase todo envio.** Com dois heróis no feudo o bot a prefere à Patrulha (é a de maior recompensa que a equipe completa "passa com folga"), e a Patrulha só sai quando há um herói só: em 1 a 15 das 50 partidas, conforme a estação.
- **Como a Patrulha sai pouco, as Ruínas quase não entram na rota** (enviadas em 3 de 50 partidas no Normal e em 15 de 50 no Tranquilo), e o Pântano, em 8 de 50, só no Tranquilo. O catálogo inteiro só é visto por quem joga devagar ou patrulha de propósito. **É a leitura do bot, e é um aviso**: se o jogador fizer como ele, metade do catálogo fica escondida atrás de uma jornada que rende pouco.
- **Nenhuma partida viu o Resgate**: ninguém foi capturado (seção 8.5).

### 8.4 O ano do Explorador, antes e depois

Médias por partida, 20 sementes, Senhor. "P/S/R/D" são os nós com prova que terminaram em Sucesso Pleno, Sucesso, Revés e Desastre.

**Antes (V3D-T2: cinco grafos provisórios, só a Floresta com encruzilhada, e o bot respondendo a toda encruzilhada com a opção da Postura):**

| Ritmo | Visitas/dia | Heróis | Envios | Patrulha (P/S/R/D) | Floresta | Covil | Resgate | Ruínas | Pântano | Enc, jogador | Enc, Postura | Herói-horas paradas | Feridos | Cativos | Resgatados | Itens | Níveis | Covil limpo | Ouro em saque | Ouro parado |
|---:|---:|---:|---:|---|---|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 3 | 1 | 2,0 | 0,0 | 0,0 (0,0/0,0/0,0/0,0) | 0,0 (0,0/0,0/0,0/0,0) | 0,0 (0,0/0,0/0,0/0,0) | 0,0 (0,0/0,0/0,0/0,0) | 0,0 (0,0/0,0/0,0/0,0) | 0,0 (0,0/0,0/0,0/0,0) | 0,0 | 0,0 | 16,0 | 0,0 | 0,0 | 0,0 | 0,0 | 0,0 | 0,0 | 0,0 | 608,4 |
| 3 | 2 | 3,0 | 0,1 | 0,0 (0,0/0,0/0,0/0,0) | 0,0 (0,0/0,0/0,0/0,0) | 0,1 (0,1/0,1/0,0/0,0) | 0,0 (0,0/0,0/0,0/0,0) | 0,0 (0,0/0,0/0,0/0,0) | 0,0 (0,0/0,0/0,0/0,0) | 0,0 | 0,0 | 49,2 | 0,0 | 0,0 | 0,0 | 0,0 | 0,0 | 0,1 | 7,9 | 1575,4 |
| 3 | 4 | 5,3 | 5,3 | 4,0 (1,3/2,2/0,6/0,0) | 0,0 (0,0/0,0/0,0/0,0) | 1,2 (1,1/1,1/0,3/0,0) | 0,0 (0,0/0,0/0,0/0,0) | 0,0 (0,0/0,0/0,0/0,0) | 0,0 (0,0/0,0/0,0/0,0) | 0,0 | 0,0 | 99,6 | 0,8 | 0,0 | 0,0 | 0,0 | 0,7 | 0,9 | 163,6 | 3163,6 |
| 1 | 1 | 3,8 | 1,4 | 0,6 (0,5/0,1/0,0/0,0) | 0,0 (0,0/0,0/0,0/0,0) | 0,8 (0,8/0,8/0,1/0,0) | 0,0 (0,0/0,0/0,0/0,0) | 0,0 (0,0/0,0/0,0/0,0) | 0,0 (0,0/0,0/0,0/0,0) | 0,0 | 0,0 | 206,0 | 0,1 | 0,0 | 0,0 | 0,0 | 0,0 | 0,7 | 74,9 | 1145,3 |
| 1 | 2 | 6,0 | 10,4 | 8,9 (2,5/5,3/1,1/0,0) | 0,0 (0,0/0,0/0,0/0,0) | 1,4 (1,4/1,1/0,3/0,0) | 0,0 (0,0/0,0/0,0/0,0) | 0,1 (0,1/0,0/0,1/0,0) | 0,0 (0,0/0,0/0,0/0,0) | 0,0 | 0,0 | 424,1 | 1,5 | 0,0 | 0,0 | 0,0 | 1,1 | 1,0 | 284,6 | 9593,0 |
| 1 | 4 | 6,0 | 36,9 | 35,0 (13,4/18,6/3,0/0,0) | 0,0 (0,0/0,0/0,0/0,0) | 1,3 (1,4/1,1/0,1/0,0) | 0,0 (0,0/0,0/0,0/0,0) | 0,7 (1,3/0,6/0,1/0,0) | 0,0 (0,0/0,0/0,0/0,0) | 0,0 | 0,0 | 557,0 | 3,1 | 0,0 | 0,0 | 0,3 | 3,6 | 1,0 | 937,1 | 12268,9 |
| 0,5 | 1 | 6,0 | 10,8 | 9,3 (3,0/5,4/0,9/0,0) | 0,0 (0,0/0,0/0,0/0,0) | 1,4 (1,4/0,9/0,3/0,0) | 0,0 (0,0/0,0/0,0/0,0) | 0,1 (0,2/0,1/0,1/0,0) | 0,0 (0,0/0,0/0,0/0,0) | 0,0 | 0,0 | 923,3 | 1,3 | 0,0 | 0,0 | 0,0 | 1,0 | 1,0 | 292,9 | 9071,5 |
| 0,5 | 2 | 6,0 | 39,4 | 37,6 (14,2/19,9/3,5/0,0) | 0,0 (0,0/0,0/0,0/0,0) | 1,1 (1,1/1,0/0,1/0,0) | 0,0 (0,0/0,0/0,0/0,0) | 0,6 (1,2/0,5/0,0/0,0) | 0,0 (0,0/0,0/0,0/0,0) | 0,0 | 0,0 | 1173,8 | 3,7 | 0,0 | 0,0 | 0,5 | 3,6 | 1,0 | 946,5 | 11010,7 |
| 0,5 | 4 | 6,0 | 94,8 | 83,3 (37,0/42,5/3,8/0,0) | 0,0 (0,0/0,0/0,0/0,0) | 1,2 (1,3/0,9/0,2/0,0) | 0,0 (0,0/0,0/0,0/0,0) | 10,3 (25,9/4,2/0,8/0,0) | 0,0 (0,0/0,0/0,0/0,0) | 0,0 | 0,0 | 1174,9 | 4,8 | 0,0 | 0,0 | 4,2 | 9,8 | 1,0 | 3217,2 | 26279,5 |

**Depois (V3D-T3):**

| Ritmo | Visitas/dia | Heróis | Envios | Patrulha (P/S/R/D) | Floresta | Covil | Resgate | Ruínas | Pântano | Enc, jogador | Enc, Postura | Herói-horas paradas | Feridos | Cativos | Resgatados | Itens | Níveis | Covil limpo | Ouro em saque | Ouro parado |
|---:|---:|---:|---:|---|---|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 3 | 1 | 2,0 | 0,0 | 0,0 (0,0/0,0/0,0/0,0) | 0,0 (0,0/0,0/0,0/0,0) | 0,0 (0,0/0,0/0,0/0,0) | 0,0 (0,0/0,0/0,0/0,0) | 0,0 (0,0/0,0/0,0/0,0) | 0,0 (0,0/0,0/0,0/0,0) | 0,0 | 0,0 | 16,0 | 0,0 | 0,0 | 0,0 | 0,0 | 0,0 | 0,0 | 0,0 | 608,4 |
| 3 | 2 | 3,0 | 0,1 | 0,0 (0,0/0,0/0,0/0,0) | 0,1 (0,1/0,0/0,0/0,0) | 0,0 (0,0/0,0/0,0/0,0) | 0,0 (0,0/0,0/0,0/0,0) | 0,0 (0,0/0,0/0,0/0,0) | 0,0 (0,0/0,0/0,0/0,0) | 0,0 | 0,1 | 48,0 | 0,0 | 0,0 | 0,0 | 0,0 | 0,0 | 0,0 | 0,0 | 1567,5 |
| 3 | 4 | 5,3 | 3,1 | 0,5 (0,2/0,3/0,0/0,0) | 1,6 (0,8/0,1/0,0/0,0) | 1,1 (0,3/1,1/0,5/0,0) | 0,0 (0,0/0,0/0,0/0,0) | 0,0 (0,0/0,0/0,0/0,0) | 0,0 (0,0/0,0/0,0/0,0) | 1,1 | 0,9 | 73,0 | 0,5 | 0,0 | 0,0 | 0,0 | 0,2 | 0,3 | 57,1 | 3137,8 |
| 1 | 1 | 3,8 | 1,4 | 0,4 (0,1/0,3/0,0/0,0) | 0,5 (0,3/0,0/0,0/0,0) | 0,6 (0,1/1,0/0,1/0,0) | 0,0 (0,0/0,0/0,0/0,0) | 0,0 (0,0/0,0/0,0/0,0) | 0,0 (0,0/0,0/0,0/0,0) | 0,0 | 1,0 | 194,5 | 0,1 | 0,0 | 0,0 | 0,0 | 0,0 | 0,5 | 30,2 | 1102,3 |
| 1 | 2 | 6,0 | 10,3 | 0,5 (0,1/0,3/0,0/0,0) | 8,8 (6,0/0,0/0,0/0,0) | 1,1 (0,3/1,8/0,3/0,0) | 0,0 (0,0/0,0/0,0/0,0) | 0,0 (0,0/0,0/0,0/0,0) | 0,0 (0,0/0,0/0,0/0,0) | 0,0 | 9,9 | 303,7 | 0,3 | 0,0 | 0,0 | 0,0 | 1,8 | 0,8 | 52,0 | 7921,6 |
| 1 | 4 | 6,0 | 19,6 | 1,1 (0,3/0,8/0,1/0,0) | 15,7 (8,9/0,1/0,0/0,0) | 2,3 (0,7/2,9/0,9/0,0) | 0,0 (0,0/0,0/0,0/0,0) | 0,6 (0,4/0,4/0,1/0,0) | 0,0 (0,0/0,0/0,0/0,0) | 8,7 | 8,3 | 334,3 | 1,1 | 0,0 | 0,0 | 0,7 | 4,0 | 0,9 | 224,3 | 11641,1 |
| 0,5 | 1 | 6,0 | 10,7 | 0,3 (0,1/0,3/0,0/0,0) | 8,9 (6,0/0,0/0,0/0,0) | 1,3 (0,5/1,9/0,3/0,0) | 0,0 (0,0/0,0/0,0/0,0) | 0,1 (0,2/0,0/0,1/0,0) | 0,0 (0,0/0,0/0,0/0,0) | 0,0 | 10,3 | 778,0 | 0,3 | 0,0 | 0,0 | 0,1 | 2,3 | 0,9 | 67,8 | 8780,9 |
| 0,5 | 2 | 6,0 | 37,4 | 2,6 (1,4/1,1/0,1/0,0) | 27,8 (18,6/0,0/0,0/0,0) | 1,4 (0,3/2,0/0,3/0,0) | 0,0 (0,0/0,0/0,0/0,0) | 4,5 (6,8/2,1/0,6/0,0) | 1,1 (0,8/2,5/0,3/0,0) | 0,0 | 34,8 | 584,3 | 1,3 | 0,0 | 0,0 | 4,0 | 9,4 | 1,0 | 712,3 | 11367,4 |
| 0,5 | 4 | 6,0 | 49,0 | 9,7 (6,5/2,4/0,8/0,0) | 24,4 (14,8/0,1/0,0/0,0) | 1,9 (0,3/2,9/0,6/0,0) | 0,0 (0,0/0,0/0,0/0,0) | 9,9 (15,3/4,1/1,3/0,0) | 3,2 (5,3/3,9/0,6/0,0) | 19,8 | 19,0 | 527,6 | 3,3 | 0,0 | 0,0 | 11,2 | 13,8 | 1,0 | 1971,0 | 24386,5 |

- **Encruzilhadas: com uma ou duas visitas por dia, o jogador não decide nenhuma.** A equipe chega à encruzilhada menos de uma hora real depois da visita em que partiu, e o prazo é de 6 h reais: quando o bot volta, 12 ou 24 h depois, a Postura já decidiu. Com quatro visitas por dia (uma a cada 6 h), ele chega a tempo e responde às que quer, que são metade (1,1 de 2,0; 8,7 de 17,0; 19,8 de 38,8). **É a validação que o ADR 0018 pedia para a decisão 11**, e a resposta é: no perfil de duas visitas, a parcela das encruzilhadas decididas pelo jogador é zero. A escolha que conta, para esse jogador, é a Postura no envio.
- **Envios.** Iguais no Normal de duas visitas (10,3 contra 10,4) e menores com quatro visitas (19,6 contra 36,9; 49,0 contra 94,8): a equipe que espera a Postura fica até 6 h reais parada, e antes o bot respondia na hora.
- **Para onde.** Antes, a Patrulha era quase tudo (8,9 de 10,4); agora é a Floresta (8,8 de 10,3), e o Covil continua sendo limpo quase uma vez por ano (0,8, contra 1,0).
- **Desfechos.** O Revés ficou mais raro (o bot só sai com folga); **nenhum Desastre e nenhuma captura**, antes e depois.
- **Herói-horas paradas caíram** (424 → 304 no Normal de duas visitas; 1.174 → 584 no Tranquilo de duas): as jornadas são mais longas, e a espera na encruzilhada conta como jornada.
- **Ouro em saque caiu** (285 → 52 no Normal de duas visitas): a Floresta rende madeira. **O ouro parado quase não mudou** (9.593 → 7.922 no Normal de duas visitas; 26.280 → 24.387 no Tranquilo de quatro), contra a linha de base da seção 4.4: não eram as expedições que o gastariam.
- **Itens e níveis subiram onde há visitas** (no Tranquilo de quatro visitas, 4,2 → 11,2 itens e 9,8 → 13,8 níveis por ano): as Ruínas e o Pântano entraram na rota.

### 8.5 Capturas e Resgates por ano: zero, de novo

**Nenhum herói foi capturado em nenhuma das 330 partidas desta medição (180 da seção 8.4 e 150 da 8.3), nem nas 900 da matriz**, e por isso nenhum Resgate foi enviado. O bot continua cauteloso por construção: só chama de folga o poder com que nem a pior sorte tira o Sucesso do primeiro trecho, e envia com a Postura Equilibrada. A calibragem (seção 8.2) diz onde a captura mora: no caminho ousado do Resgate e do Pântano e nos guardiões das Ruínas para quem vai sem a classe certa. **A pergunta do ADR 0018, "capturas por ano no perfil Regular", continua sem resposta do simulador**: pede um bot que ouse (a Postura Ousada, ou enviar "justa"), ou gente jogando. Fica para V3D-T5.

### 8.6 As faixas do Explorador, antes e depois

Colunas: população (menor e maior), Salão, horas de fome, horas de frio, madeira, pedra e ouro parados, e a maior sequência desperdiçando um recurso, em horas de jogo. "Antes" é a seção 7.2.

| Dificuldade | Célula | Antes (V3D-T2) | Depois (V3D-T3) |
|---|---|---|---|
| Senhor | week/3 | [85, 85], 8, 0, 0, 4180, 5200, 236783, 54 | [**83**, 85], 8, 0, 0, 4432, 5200, 232893, 51 |
| Senhor | week/1 e year/1 | [59, 75], 7, 0, 0, 4600, 4588, 24543, 10 | [**66**, 75], 7, 0, 0, 4668, 4600, 25548, 10 |
| Senhor | week/0.5 | [44, 52], 5, 0, 0, 1137, 921, 1083, 1.5 | [44, 52], 5, 0, 0, 1166, 863, 1086, 1.5 |
| Senhor | year/3 | [25, 35], 5, 0, 0, 694, 898, 2064, 3 | [25, 35], 5, 0, 0, 694, 898, 1978, 3 |
| Senhor | year/0.5 | [84, 85], 8, 0, 0, 5200, 5200, 16346, 5 | [84, 85], 8, 0, 0, 5200, 5200, 16032, **7** |
| Camponês | week/3 | [85, 85], 8, 0, 0, 5480, 6500, 234242, 33 | [85, 85], 8, 0, 0, 5715, 6500, 233873, 33 |
| Camponês | week/1 e year/1 | [59, 76], 7, 0, 0, 5750, 5000, 19239, 9 | [60, **81**], 7, 0, 0, 5750, 5019, 18219, 9 |
| Camponês | week/0.5 | [44, 52], 5, 0, 0, 1114, 832, 1066, 1 | [44, 52], 5, 0, 0, 1356, 940, 1089, 1.5 |
| Camponês | year/3 | [22, 35], 5, 0, 0, 817, 1407, 2468, 3 | igual |
| Camponês | year/0.5 | [84, 85], 8, 0, 0, 6500, 6500, 16672, 3.5 | [84, 85], 8, 0, 0, 6500, 6500, 17733, 3.5 |
| Rei de Ferro | week/3 | [75, 75], 7, 0, 0, 2780, 3680, 243650, 69 | [75, 75], 7, 0, 0, 3042, 3680, 239731, 66 |
| Rei de Ferro | week/1 e year/1 | [64, 75], 7, 0, 0, 3680, 3680, 24074, 9 | [64, 75], 7, 0, 0, 3680, 3618, 24113, 9 |
| Rei de Ferro | week/0.5 | [44, 54], 5, 0, 0, 1343, 920, 1181, 1 | [44, 54], 5, 0, 0, 1397, 910, 1120, 1 |
| Rei de Ferro | year/3 | [29, 35], 5, 0, 0, 649, 587, 2560, 6 | igual |
| Rei de Ferro | year/0.5 | [75, 75], 7, 0, 0, 3680, 3680, 44193, 3.5 | [**74**, 75], 7, 0, 0, 3680, 3680, 43976, 3 |

**O que mudou, e por quê.** As expedições rendem pouco perto da produção do feudo, e as células mexeram pouco.

- **A menor população subiu no Normal de Senhor** (de 59 para 66): a Floresta traz madeira no outono e no inverno, e a pior semente deixou de atrasar as Habitações.
- **A maior sequência desperdiçando subiu no ano do Tranquilo de Senhor, de 5 para 7 horas de jogo**: é madeira da Floresta chegando com o depósito cheio. Continua dentro da meta de 8 h do GDD §15.2.
- **A menor população caiu no Rápido de 7 dias em Senhor** (de 85 para 83) **e no ano do Tranquilo em Rei de Ferro** (de 75 para 74): uma semente em cada, com a obra da Guilda na frente das Habitações.
- **O ouro parado continua onde estava** (232.893 no Rápido de 7 dias): o retrato das seções 4.4, 5.5, 6.4 e 7.2 não mudou.
- Nenhuma célula ganhou fome, frio nem um Salão mais baixo. As duas células de Camponês e de Rei de Ferro no ano do Rápido não mudaram em nada: nelas a Guilda fica de pé tarde demais para haver expedição.

### 8.7 Limites desta medição

- **A calibragem é exata, mas é de equipes de referência sem traço e sem item**, e trata os nós como independentes com a equipe inteira. Ninguém jogou os grafos.
- **O bot não lê as pistas.** Escolhe pela ordem das opções na tela (da mais ambiciosa à mais segura) e pelo ferimento de alguém da equipe. "Para que equipe cada opção é razoável" é uma conta do teste, não uma medição de jogo.
- A matriz inteira (os quatro perfis, 3.600 partidas) **não foi rodada**: só a do Explorador, uma vez por dificuldade (900 partidas), antes da atualização de `MEASURED`; o `pnpm test` roda as outras e confere as faixas.
- As seções 8.3 e 8.4 são de Senhor só; a 8.4, de 20 sementes.
- `--perf` e os bytes do estado e da visão **não foram medidos** nesta tarefa. O registro do percurso ganhou dois campos pequenos; a visão de cada destino ganhou `fit` e um número por herói que pode partir; o relatório ganhou um passo e duas frases.
- A parcela das encruzilhadas decididas pelo jogador é a de um bot que quer responder a metade delas: com um jogador que quer responder a todas, os números de quatro visitas dobram, e os de uma e duas visitas continuam zero.

## 9. Revisão da Fase D (V3D-T5)

Rodada de 2026-10-06, com o estado na versão 20 e o `contentHash` `b4e14e2cb8d28c44`: o que as duas revisões independentes da Fase D mudaram no conteúdo e no bot, e as respostas com número às perguntas de V3D-T5.3. As decisões do agente estão em [pendencias-v0.3.md](pendencias-v0.3.md), "Fase D: correções da revisão independente" (D-54 a D-72). **Nada aqui foi lido pelo autor.**

### 9.1 Comandos

```bash
pnpm --filter @lotg/engine test -- calibration     # a calibragem, exata, agora nas três Posturas; quatro tabelas em __golden__/expedition-calibration.md
for d in lord peasant ironKing; do
  pnpm -s sim -- --matrix --profile explorador --difficulty $d > matriz-$d.csv 2> matriz-$d.md
done
pnpm -s sim -- --expeditions --difficulty lord > estudo-lord.md          # 10 sementes, 7 dias reais, 1, 2, 4 e 6 visitas por dia
pnpm -s sim -- --expeditions --difficulty ironKing > estudo-ironKing.md
pnpm -s sim -- --seed pedra-alta-001 --game-year --time-scale 3 --strategy explorador 2>&1 >/dev/null | grep Guilda
```

O modo `--expeditions`, o bot `ousado` e a visita extra da encruzilhada entraram nesta rodada (seção 9.7). As fichas de [content-v0.3.md](content-v0.3.md), seção 6, foram regeradas do conteúdo e do golden da calibragem por um roteiro avulso, que não ficou no repositório.

### 9.2 Os rótulos de risco, nas três Posturas

A revisão editorial achou que os rótulos não ordenavam o risco (a equipe mínima passava nas Ruínas, "Médio", em 18%, e no Resgate, "Alto", em 47%) e que a calibragem só media a Equilibrada. **O que cada rótulo promete agora**, e o teste confere (`expeditions.calibration.test.ts`), para a equipe mínima:

| Rótulo | Na Equilibrada, a mínima passa | Desastre | Captura |
|---|---|---|---|
| Baixo | em 9 de cada 10 ou mais, em qualquer Postura | nunca, nem para a equipe fraca, em Postura nenhuma | nunca |
| Baixo a médio | em 6 de cada 10 ou mais | nunca na Cautelosa nem na Equilibrada; na Ousada existe e não passa de 15% | nunca |
| Médio | em pelo menos um quarto e em não mais de dois terços (o Revés é comum) | até 10% na Equilibrada; possível para quem vai fraco ou ousa | nunca na Cautelosa |
| Alto | em menos de um quarto | possível | **acontece**: na Ousada para a mínima; também na Equilibrada para quem vai mais fraco do que ela |

E os rótulos ordenam: na Equilibrada, a mínima passa mais em todo destino de um rótulo do que em qualquer destino do rótulo seguinte.

A distribuição exata, depois da recalibragem (as 31 sortes de cada nó, enumeradas; "passa" é nenhuma prova abaixo do Sucesso):

| Patrulha dos Arredores | Baixo | Fraca: Clérigo Nv1 | 51% | 51% / 49% / 0% | 51% / 49% / 0% | 0% / 0% |
| Patrulha dos Arredores | Baixo | Mínima: Guerreiro Nv1 | 99% | 99% / 1% / 0% | 99% / 1% / 0% | 0% / 0% |
| Patrulha dos Arredores | Baixo | Com folga: Guerreiro Nv3 | 100% | 100% / 0% / 0% | 100% / 0% / 0% | 0% / 0% |
| Floresta Antiga | Baixo a médio | Fraca: Clérigo Nv1 | 100% | 34% / 62% / 3% | 100% / 0% / 0% | 0% / 0% |
| Floresta Antiga | Baixo a médio | Mínima: Guerreiro Nv1 | 100% | 76% / 24% / 0% | 33% / 59% / 8% | 0% / 0% |
| Floresta Antiga | Baixo a médio | Com folga: Guerreiro + Arqueiro Nv3 | 100% | 100% / 0% / 0% | 100% / 0% / 0% | 0% / 0% |
| Covil de Lobos | Médio | Fraca: Clérigo + Clérigo Nv1 | 52% | 19% / 77% / 3% | 6% / 59% / 34% | 0% / 0% |
| Covil de Lobos | Médio | Mínima: Guerreiro + Arqueiro Nv1 | 89% | 45% / 55% / 0% | 8% / 92% / 0% | 0% / 0% |
| Covil de Lobos | Médio | Com folga: Guerreiro + Arqueiro Nv3 | 100% | 94% / 6% / 0% | 56% / 44% / 0% | 0% / 0% |
| Resgate | Alto | Fraca: Clérigo + Clérigo Nv1 | 7% | 0% / 84% / 16% | 7% / 71% / 22% | 16% / 22% |
| Resgate | Alto | Mínima: Guerreiro + Arqueiro Nv1 | 57% | 24% / 76% / 0% | 19% / 77% / 4% | 0% / 4% |
| Resgate | Alto | Com folga: Guerreiro + Arqueiro Nv3 | 100% | 83% / 17% / 0% | 53% / 47% / 0% | 0% / 0% |
| Ruínas de Vel'Thar | Médio | Fraca: Clérigo + Clérigo Nv2 | 82% | 34% / 64% / 1% | 35% / 59% / 6% | 1% / 6% |
| Ruínas de Vel'Thar | Médio | Mínima: Guerreiro + Arqueiro Nv2 | 100% | 29% / 71% / 0% | 41% / 59% / 0% | 0% / 0% |
| Ruínas de Vel'Thar | Médio | Com folga: Guerreiro + Arqueiro + Mago Nv4 | 100% | 100% / 0% / 0% | 100% / 0% / 0% | 0% / 0% |
| Pântano Nebuloso | Alto | Fraca: Mago + Clérigo + Clérigo Nv1 | 59% | 6% / 92% / 2% | 16% / 69% / 15% | 2% / 15% |
| Pântano Nebuloso | Alto | Mínima: Mago + Guerreiro + Arqueiro Nv1 | 80% | 20% / 80% / 0% | 53% / 44% / 2% | 0% / 2% |
| Pântano Nebuloso | Alto | Com folga: Mago + Guerreiro + Arqueiro Nv3 | 100% | 76% / 24% / 0% | 74% / 26% / 0% | 0% / 0% |

## Cada prova, para as três equipes

**O que mudou para caber na régua** (antes → depois):

| Destino | Nó | O que mudou |
|---|---|---|
| Patrulha | as três variantes | ouro: 15 a 25, 12 a 22 e 18 a 28 → **1 a 3, 1 a 2 e 2 a 3**; experiência: 12 → **2** |
| Floresta Antiga | O javali da mata fechada; Os lenhadores sem senhor | dificuldade 55 → **52**; 58 → **54** (o Guerreiro sozinho na Ousada: Desastre em 20% → 8%) |
| Covil de Lobos B | A matilha sob o penedo | perícia ×1,5 → **×1** (flechar do alto deixou de ser mais seguro e mais rico do que fechar uma boca) |
| Ruínas | O guardião de pedra; A sentinela sem rosto | 92 → **89**; 112 → **105** (a mínima: 18% → 29%). O guardião da cripta fica em 116: abaixo disso nenhuma dupla de nível 2 é capturada |
| Resgate | A trilha dos captores; As cordas no escuro; A parede dos fundos; A noite sem fogo; Os cavalos soltos | 90 → **96**; 96 → **102**; 104 → **114**; 78 → **80**; 106 → **114** (a mínima: 47% → 24%; a equipe fraca passa a poder ser capturada na Equilibrada) |
| Pântano | O afogado que anda | 120 → **122** (a equipe fraca passa a poder ser capturada na Equilibrada); os três nós do meio rendem 10 de ouro a mais |

**Um limite da regra dos desfechos** (ADR 0017, decisão 7), que a régua respeita: no mesmo nó, quem pode chegar ao Desastre nunca chega ao Sucesso. O Desastre pede menos de 70% da dificuldade com a pior sorte (poder abaixo de 82% da dificuldade); o Sucesso, 100% com a melhor (poder a partir de 87%). As duas faixas não se cruzam. Por isso a equipe mínima só é capturada em um nó que ela nunca vence, e "captura na Equilibrada para a mínima" pediria um caminho da Equilibrada em que ela nunca passa. A régua do "Alto" promete o que a regra permite; mexer nos limiares é decisão do autor (pendência D-66).

**A Patrulha por hora de herói** (revisão, B10). O que cada destino rende em média, na Equilibrada, por hora de jogo de cada herói que vai (recursos somados; a experiência é a de cada herói):

| Modelo | Duração | Equipe | Recursos por hora de herói | Experiência por hora, de cada herói |
|---|---:|---|---:|---:|
| Patrulha dos Arredores | 15 min | Mínima: Guerreiro Nv1 | 8,3 | 8,3 |
| Patrulha dos Arredores | 15 min | Com folga: Guerreiro Nv3 | 9,3 | 9,3 |
| Floresta Antiga | 60 min | Mínima: Guerreiro Nv1 | 59,3 | 12,1 |
| Floresta Antiga | 60 min | Com folga: Guerreiro + Arqueiro Nv3 | 37,5 | 18,3 |
| Covil de Lobos | 120 min | Mínima: Guerreiro + Arqueiro Nv1 | 8,6 | 29,4 |
| Covil de Lobos | 120 min | Com folga: Guerreiro + Arqueiro Nv3 | 10,9 | 36,9 |
| Resgate | 120 min | Mínima: Guerreiro + Arqueiro Nv1 | 4,5 | 27,8 |
| Resgate | 120 min | Com folga: Guerreiro + Arqueiro Nv3 | 6,1 | 36,7 |
| Ruínas de Vel'Thar | 180 min | Mínima: Guerreiro + Arqueiro Nv2 | 33,3 | 30,3 |
| Ruínas de Vel'Thar | 180 min | Com folga: Guerreiro + Arqueiro + Mago Nv4 | 33,6 | 45,1 |
| Pântano Nebuloso | 300 min | Mínima: Mago + Guerreiro + Arqueiro Nv1 | 8,6 | 30,5 |
| Pântano Nebuloso | 300 min | Com folga: Mago + Guerreiro + Arqueiro Nv3 | 11,3 | 38,7 |

A Patrulha fica abaixo de todos os outros em recurso e em experiência, e o teste cobra isso (o Resgate fica de fora da comparação de recursos: o que ele rende é quem volta). A margem sobre o Covil e o Pântano é pequena de propósito: os dois rendem pouco ouro porque o que dão é a Ameaça que cai e o item épico.

### 9.3 Quantas encruzilhadas o jogador decide, por visitas por dia

**A pergunta de V3D-T5.3.** Em Senhor, 10 sementes, 7 dias reais por partida, com o explorador que responde a **toda** encruzilhada que encontra na visita (a parte que fica para a Postura é a que venceu, 6 h reais depois de a equipe parar, antes de ele voltar):

| Ritmo | Bot | Visitas | Anos de jogo | Expedições | Encruzilhadas: jogador ÷ todas | Visitas extras | Herói ocioso (herói-h por partida) | Heróis no fim | Ouro no fim |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Explorador (responde a tudo) | 1 visita por dia | 3 | 50 | 0 de 50 (0%) | 0 | 418 | 6 | 63414 a 88666 |
| Rápido 3× | Explorador (responde a tudo) | 2 visitas por dia | 3 | 234 | 0 de 234 (0%) | 0 | 391 | 6 | 177163 a 212073 |
| Rápido 3× | Explorador (responde a tudo) | 2 visitas e a do aviso | 3 | 1569 | 1554 de 1554 (100%) | 1080 | 388 | 6 | 294734 a 300526 |
| Rápido 3× | Explorador (responde a tudo) | 4 visitas por dia | 3 | 320 | 255 de 255 (100%) | 0 | 424 | 6 | 342165 a 365890 |
| Rápido 3× | Explorador (responde a tudo) | 6 visitas por dia | 3 | 481 | 416 de 416 (100%) | 0 | 426 | 6 | 403363 a 419358 |
| Normal 1× | Explorador (responde a tudo) | 1 visita por dia | 1 | 24 | 0 de 18 (0%) | 0 | 193 | 2 a 5 | 96 a 1818 |
| Normal 1× | Explorador (responde a tudo) | 2 visitas por dia | 1 | 110 | 0 de 103 (0%) | 0 | 303 | 5 a 6 | 2615 a 14875 |
| Normal 1× | Explorador (responde a tudo) | 2 visitas e a do aviso | 1 | 136 | 119 de 119 (100%) | 65 | 417 | 6 | 1099 a 15530 |
| Normal 1× | Explorador (responde a tudo) | 4 visitas por dia | 1 | 194 | 174 de 174 (100%) | 0 | 334 | 6 | 7927 a 12868 |
| Normal 1× | Explorador (responde a tudo) | 6 visitas por dia | 1 | 358 | 285 de 285 (100%) | 0 | 323 | 6 | 8865 a 21124 |
| Tranquilo 0,5× | Explorador (responde a tudo) | 1 visita por dia | 0,5 | 3 | 0 de 3 (0%) | 0 | 144 | 1 a 3 | 85 a 640 |
| Tranquilo 0,5× | Explorador (responde a tudo) | 2 visitas por dia | 0,5 | 41 | 0 de 32 (0%) | 0 | 140 | 2 a 4 | 276 a 1024 |
| Tranquilo 0,5× | Explorador (responde a tudo) | 2 visitas e a do aviso | 0,5 | 48 | 35 de 35 (100%) | 34 | 176 | 3 a 5 | 545 a 877 |
| Tranquilo 0,5× | Explorador (responde a tudo) | 4 visitas por dia | 0,5 | 80 | 64 de 64 (100%) | 0 | 181 | 4 a 5 | 141 a 1034 |
| Tranquilo 0,5× | Explorador (responde a tudo) | 6 visitas por dia | 0,5 | 159 | 114 de 114 (100%) | 0 | 188 | 4 a 6 | 438 a 993 |

O que se lê:

- **Com 1 ou 2 visitas por dia o jogador não decide encruzilhada nenhuma, nos três ritmos.** A equipe chega à encruzilhada minutos depois de partir (15 a 60 minutos de jogo), e o prazo vence 6 h reais depois; quem volta em 12 h ou 24 h encontra a Postura decidida.
- **Com 4 ou 6 visitas por dia decide todas.** Com as visitas de 6 em 6 horas, a seguinte cai sempre dentro do prazo.
- **Com 2 visitas e a do aviso, decide todas**: o jogador que volta quando a equipe para (uma visita a mais ao fim da hora em que a encruzilhada aparece) nunca perde o prazo. No Rápido isso são 108 visitas extras por partida em 7 dias, mais do que as 14 do dia a dia: é outro jogador.
- Na matriz padrão o Explorador joga metade das sementes com a visita extra e responde a metade das encruzilhadas, por desenho do bot: decide 51% a 58% nas partidas com a visita e 0% nas outras (seção 9.6).

**(Resposta do autor, 2026-10-06: a janela passou a 12 h; o antes e o depois estão na seção 10.3.)** **A janela de 6 h está errada?** Os números dizem que ela é **exatamente a fronteira entre o perfil de 2 visitas por dia e os outros**: abaixo de 4 visitas por dia a encruzilhada é, na prática, a Postura escolhida no envio; de 4 em diante, ou atendendo o aviso, é uma decisão do jogador. O critério do roadmap ("se quase toda encruzilhada cair na Postura no perfil de 2 visitas, a janela está errada: vai ao autor") **é atendido: todas caem na Postura**. Para o perfil de 2 visitas decidir, a janela teria de passar das 12 h reais. A decisão é do autor (pendência D-71); o conteúdo não foi mexido.

### 9.4 Capturas, mortes e Resgates por ano

O explorador nunca viu um Desastre, porque só envia com folga. O bot `ousado` (envia entre o risco e a folga, alterna as três Posturas, patrulha até revelar um caminho, manda o Resgate) é o que deveria ver. Em Senhor, 10 sementes por linha, 7 dias reais:

| Ritmo | Bot | Visitas | Nós com prova: P/S/R/D | Feridos | Cativos | Mortos | Resgatados | Equipes perdidas | Covil limpo | Capturas por ano | Resgates por ano | Mortes por ano |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Ousado | 1 visita por dia | 7/29/18/1 | 19 | 0 | 0 | 0 | 0 | 5 | 0 | 0 | 0 |
| Rápido 3× | Ousado | 2 visitas por dia | 76/146/70/4 | 72 | 1 | 0 | 1 | 0 | 10 | 0 | 0 | 0 |
| Rápido 3× | Ousado | 2 visitas e a do aviso | 1197/341/155/6 | 152 | 0 | 0 | 0 | 0 | 16 | 0 | 0 | 0 |
| Rápido 3× | Ousado | 4 visitas por dia | 82/169/96/2 | 96 | 0 | 0 | 0 | 0 | 25 | 0 | 0 | 0 |
| Rápido 3× | Ousado | 6 visitas por dia | 182/229/117/2 | 119 | 0 | 0 | 0 | 0 | 20 | 0 | 0 | 0 |
| Normal 1× | Ousado | 1 visita por dia | 9/18/6/0 | 6 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 |
| Normal 1× | Ousado | 2 visitas por dia | 21/56/38/1 | 38 | 0 | 0 | 0 | 0 | 7 | 0 | 0 | 0 |
| Normal 1× | Ousado | 2 visitas e a do aviso | 25/66/29/1 | 30 | 0 | 0 | 0 | 0 | 9 | 0 | 0 | 0 |
| Normal 1× | Ousado | 4 visitas por dia | 21/75/39/2 | 41 | 0 | 0 | 0 | 0 | 10 | 0 | 0 | 0 |
| Normal 1× | Ousado | 6 visitas por dia | 39/122/60/3 | 61 | 0 | 0 | 0 | 0 | 10 | 0 | 0 | 0 |
| Tranquilo 0,5× | Ousado | 1 visita por dia | 1/2/0/0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Tranquilo 0,5× | Ousado | 2 visitas por dia | 8/31/9/0 | 9 | 0 | 0 | 0 | 0 | 5 | 0 | 0 | 0 |
| Tranquilo 0,5× | Ousado | 2 visitas e a do aviso | 7/31/7/1 | 8 | 0 | 0 | 0 | 0 | 9 | 0 | 0 | 0 |
| Tranquilo 0,5× | Ousado | 4 visitas por dia | 7/41/18/2 | 19 | 0 | 0 | 0 | 0 | 9 | 0 | 0 | 0 |
| Tranquilo 0,5× | Ousado | 6 visitas por dia | 16/62/37/2 | 39 | 0 | 0 | 0 | 0 | 10 | 0 | 0 | 0 |

Em Rei de Ferro, as mesmas linhas:

| Ritmo | Bot | Visitas | Nós com prova: P/S/R/D | Feridos | Cativos | Mortos | Resgatados | Equipes perdidas | Covil limpo | Capturas por ano | Resgates por ano | Mortes por ano |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Ousado | 1 visita por dia | 8/25/14/0 | 14 | 0 | 0 | 0 | 0 | 3 | 0 | 0 | 0 |
| Rápido 3× | Ousado | 2 visitas por dia | 36/107/54/3 | 57 | 0 | 0 | 0 | 0 | 14 | 0 | 0 | 0 |
| Rápido 3× | Ousado | 2 visitas e a do aviso | 450/269/131/5 | 132 | 0 | 0 | 0 | 0 | 20 | 0 | 0 | 0 |
| Rápido 3× | Ousado | 4 visitas por dia | 66/185/112/3 | 112 | 0 | 1 | 0 | 0 | 21 | 0 | 0 | 0 |
| Rápido 3× | Ousado | 6 visitas por dia | 197/236/110/4 | 111 | 0 | 1 | 0 | 0 | 20 | 0 | 0 | 0 |
| Normal 1× | Ousado | 1 visita por dia | 2/8/1/0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Normal 1× | Ousado | 2 visitas por dia | 23/64/40/0 | 38 | 0 | 0 | 0 | 0 | 7 | 0 | 0 | 0 |
| Normal 1× | Ousado | 2 visitas e a do aviso | 18/74/52/1 | 47 | 0 | 0 | 0 | 0 | 9 | 0 | 0 | 0 |
| Normal 1× | Ousado | 4 visitas por dia | 9/63/32/2 | 34 | 0 | 0 | 0 | 0 | 10 | 0 | 0 | 0 |
| Normal 1× | Ousado | 6 visitas por dia | 116/156/55/3 | 55 | 0 | 0 | 0 | 0 | 9 | 0 | 0 | 0 |
| Tranquilo 0,5× | Ousado | 1 visita por dia | 1/2/0/0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Tranquilo 0,5× | Ousado | 2 visitas por dia | 7/19/8/0 | 8 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 |
| Tranquilo 0,5× | Ousado | 2 visitas e a do aviso | 6/26/6/0 | 6 | 0 | 0 | 0 | 0 | 5 | 0 | 0 | 0 |
| Tranquilo 0,5× | Ousado | 4 visitas por dia | 10/43/16/0 | 14 | 0 | 0 | 0 | 0 | 10 | 0 | 0 | 0 |
| Tranquilo 0,5× | Ousado | 6 visitas por dia | 15/65/40/3 | 42 | 0 | 0 | 0 | 0 | 9 | 0 | 0 | 0 |

O que se lê:

- **Mesmo arriscando, quase ninguém é capturado**: um cativo e um resgatado em 150 partidas do ousado em Senhor; nenhum cativo e duas mortes em Rei de Ferro. "Por ano" arredonda para zero em toda linha.
- **O Desastre é raro** (de 0 a 6 por linha, em dezenas a centenas de nós com prova), e o Revés é o desfecho ruim de verdade: de um quinto a um terço dos nós do ousado nas cadências do dia a dia (na linha da visita extra do Rápido, 9%).
- O motivo é o limite da seção 9.2: o ousado não manda equipe abaixo do risco do **primeiro** trecho, e nos nós que capturam (os chefes e os cativeiros) quem pode ser capturado é quem não tem chance de passar. A captura fica para a equipe fraca demais para o destino, que um jogador prudente não manda.
- **Em Rei de Ferro o herói morre onde em Senhor seria capturado**: as duas mortes são isso. Nenhuma equipe inteira se perdeu.

### 9.5 Desfechos por destino

Os envios do ousado e os desfechos dos nós com prova (Sucesso Pleno / Sucesso / Revés / Desastre), em Senhor:

| Ritmo | Bot | Visitas | Patrulha dos Arredores: envios · P/S/R/D | Floresta Antiga: envios · P/S/R/D | Covil de Lobos: envios · P/S/R/D | Resgate: envios · P/S/R/D | Ruínas de Vel'Thar: envios · P/S/R/D | Pântano Nebuloso: envios · P/S/R/D |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rápido 3× | Ousado | 1 visita por dia | 16 · 1/9/6/0 | 18 · 0/2/4/1 | 16 · 6/18/8/0 | — | — | — |
| Rápido 3× | Ousado | 2 visitas por dia | 12 · 1/9/2/0 | 82 · 0/9/22/0 | 55 · 26/49/20/2 | 1 · 1/1/0/0 | 40 · 17/26/20/2 | 35 · 31/52/6/0 |
| Rápido 3× | Ousado | 2 visitas e a do aviso | 12 · 1/9/2/0 | 648 · 50/120/91/6 | 35 · 15/42/13/0 | — | 464 · 599/133/42/0 | 234 · 532/37/7/0 |
| Rápido 3× | Ousado | 4 visitas por dia | 10 · 2/8/0/0 | 136 · 1/23/27/2 | 49 · 26/54/18/0 | — | 94 · 31/75/50/0 | 14 · 22/9/1/0 |
| Rápido 3× | Ousado | 6 visitas por dia | 12 · 2/7/3/0 | 265 · 1/50/55/1 | 39 · 10/52/15/1 | — | 95 · 64/69/35/0 | 63 · 105/51/9/0 |
| Normal 1× | Ousado | 1 visita por dia | 10 · 2/8/0/0 | 2 · 0/0/1/0 | 12 · 7/10/5/0 | — | — | — |
| Normal 1× | Ousado | 2 visitas por dia | 12 · 2/8/2/0 | 48 · 0/4/15/0 | 34 · 14/32/12/1 | — | 13 · 4/10/9/0 | 2 · 1/2/0/0 |
| Normal 1× | Ousado | 2 visitas e a do aviso | 12 · 2/8/2/0 | 100 · 0/24/22/1 | 15 · 7/21/2/0 | — | 9 · 4/9/2/0 | 7 · 12/4/1/0 |
| Normal 1× | Ousado | 4 visitas por dia | 12 · 2/8/2/0 | 160 · 3/34/32/2 | 15 · 9/20/1/0 | — | 9 · 4/7/2/0 | 4 · 3/6/2/0 |
| Normal 1× | Ousado | 6 visitas por dia | 10 · 2/8/0/0 | 272 · 3/66/48/3 | 15 · 5/21/4/0 | — | 17 · 11/13/7/0 | 14 · 18/14/1/0 |
| Tranquilo 0,5× | Ousado | 1 visita por dia | 3 · 1/2/0/0 | — | — | — | — | — |
| Tranquilo 0,5× | Ousado | 2 visitas por dia | 10 · 2/8/0/0 | 7 · 0/2/1/0 | 20 · 6/21/8/0 | — | — | — |
| Tranquilo 0,5× | Ousado | 2 visitas e a do aviso | 10 · 2/8/0/0 | 23 · 0/3/4/1 | 14 · 5/20/3/0 | — | — | — |
| Tranquilo 0,5× | Ousado | 4 visitas por dia | 13 · 1/9/3/0 | 52 · 0/5/8/2 | 16 · 6/21/4/0 | — | 6 · 0/5/3/0 | 1 · 0/1/0/0 |
| Tranquilo 0,5× | Ousado | 6 visitas por dia | 11 · 1/9/1/0 | 106 · 0/22/27/2 | 19 · 10/24/4/0 | — | 13 · 5/7/5/0 | — |

- **O ousado chega às Ruínas e ao Pântano** com 2 visitas por dia no Rápido e no Normal (no Tranquilo, que em 7 dias é meio ano de jogo, só com 4 ou mais). O explorador só chega às Ruínas com a visita do aviso ou com 4 visitas ou mais: a Patrulha, que as revela, é o destino que rende menos, e ele vai sempre ao de maior recompensa que passa com folga.
- **A Floresta é onde o ousado mais sofre Revés** (0/9/22/0 no Rápido com 2 visitas): ele vai com a menor equipe que serve, e a pista da mata fechada avisa que é serviço para mais de um. A causa não foi medida à parte.
- **O Resgate aconteceu uma vez**, e deu certo.

### 9.6 O Explorador na matriz: as faixas, antes e depois, e o ouro parado

A rodada padrão, 50 sementes por célula. **Só as células do Explorador mudaram**; as dos outros perfis não envolvem expedições. Em Senhor (população, Salão, excedente de madeira, pedra e ouro, e a maior sequência desperdiçando, em horas de jogo):

| Célula | Antes (seção 8) | Depois |
|---|---|---|
| `week/3/explorador` | 83 a 85 · Salão 8 · 4.432 · 5.200 · 232.893 · 51 | 85 · Salão 8 · 4.420 · 5.200 · **286.522** · 39 |
| `week/1/explorador` e `year/1/explorador` | 66 a 75 · Salão 7 · 4.668 · 4.600 · 25.548 · 10 | 66 a 77 · Salão 7 · 5.200 · 5.200 · **19.874** · 9 |
| `week/0.5/explorador` | 44 a 52 · Salão 5 · 1.166 · 863 · 1.086 · 1,5 | 45 a 54 · Salão 5 · 794 · 897 · 1.219 · 1,5 |
| `year/3/explorador` | 25 a 35 · Salão 5 · 694 · 898 · 1.978 · 3 | 23 a 37 · Salão 5 · 722 · 1.011 · **3.075** · 3 |
| `year/0.5/explorador` | 84 a 85 · Salão 8 · 5.200 · 5.200 · 16.032 · 7 | 84 a 85 · Salão 8 · 5.200 · 5.200 · **20.652** · 5,5 |

Nenhuma hora de fome nem de frio, em nenhuma dificuldade. As linhas de Camponês e de Rei de Ferro estão em `packages/sim-cli/src/bands.ts`.

Duas medidas de `balance.test.ts` mudaram com o bot: **o Explorador enche os seis lugares de herói nas 50 sementes do Normal** (eram de 4 a 6), e **a partida que terminava o ano com a Ameaça em 90 termina em 92** (a mesma: Senhor, Tranquilo, semente 047, com o Covil limpo no ano; é o caso da pendência D-24, e por que são dois pontos a mais não foi investigado). Continua sendo a única de um ano ou mais que termina em 80 ou acima.

**As expedições do Explorador**, somadas nas 50 sementes de cada célula, em Senhor:

| Janela | Ritmo | Expedições | Encruzilhadas: jogador ÷ todas | Com a visita extra | Só as sessões do dia | Covil limpo | Herói ocioso (herói-h) |
|---|---|---:|---|---|---|---:|---:|
| 7 dias reais | Rápido 3× | 1.240 | 336 de 1.240 (27%) | 336 de 654 (51%) | 0 de 586 (0%) | 104 | 22.637 |
| 7 dias reais | Normal 1× | 643 | 174 de 604 (29%) | 174 de 337 (52%) | 0 de 267 (0%) | 42 | 17.049 |
| 7 dias reais | Tranquilo 0,5× | 210 | 54 de 168 (32%) | 54 de 93 (58%) | 0 de 75 (0%) | 22 | 8.486 |
| Um ano de jogo | Rápido 3× | 50 | 25 de 50 (50%) | 25 de 25 (100%) | 0 de 25 (0%) | 12 | 2.050 |
| Um ano de jogo | Tranquilo 0,5× | 1.996 | 455 de 1.739 (26%) | 455 de 917 (50%) | 0 de 822 (0%) | 50 | 33.288 |

Nenhum cativo, nenhum morto, nenhuma equipe perdida: o Explorador só envia com folga.

**O ano do Rápido** (revisão, M-R1): 50 expedições em 50 partidas, **uma por partida**. O ano dura 56 h reais, cinco visitas; na semente 001 o herói da carta chega na hora 25, e a Guilda fica pronta na hora 37, entre a quarta e a quinta visita. O bot passou a erguer a Guilda na frente das outras obras, com o herói ainda a caminho, e a deixá-la planejada mesmo presa ao Salão; antes disso, na mesma semente e com o catálogo recalibrado, o ano fechava sem expedição nenhuma. A faixa `year/3/explorador` continua medindo um ano com uma expedição: é o que o perfil de 2 visitas por dia alcança no Rápido.

**O ouro parado, contra a linha de base da seção 1.3** (ouro em estoque no fim da janela, em Senhor: menor, mediana e maior das 50 sementes):

| Janela | Ritmo | Regular da v0.2 (seção 1.3) | Explorador agora |
|---|---|---|---|
| 7 dias reais | Rápido 3× | 113.566 · 128.436 · 148.487 | 177.163 · **238.908** · 286.522 |
| Um ano de jogo | Rápido 3× | 1.870 · 2.176 · 3.052 | 1.321 · **1.715** · 3.075 |
| 7 dias reais e um ano | Normal 1× | 2.348 · 8.967 · 23.641 | 801 · **9.434** · 19.874 |
| 7 dias reais | Tranquilo 0,5× | 38 · 518 · 1.044 | 355 · **713** · 1.219 |
| Um ano de jogo | Tranquilo 0,5× | 13.128 · 17.646 · 22.535 | 5.251 · **14.177** · 20.652 |

**O ouro parado não caiu.** No primeiro ano de jogo ele fica onde estava (um quinto a menos no Rápido e no Tranquilo, o mesmo no Normal); na semana do Rápido, três anos de jogo, quase dobra: seis heróis custam 12 de ouro por hora de jogo, as expedições trazem ouro, e o feudo continua sem ter onde gastá-lo depois que as obras acabam. É o que as seções 4.4 e 5.5 já diziam; o destino do ouro é o Mercado (Fase E).

### 9.7 O que entrou no simulador

Só bot e relatório; nenhuma regra do jogo mudou por causa disto.

- **A visita extra da encruzilhada** (`crossroadsVisit`): além das sessões do dia, o bot joga uma sessão ao fim da hora real em que uma equipe para em uma encruzilhada, uma por encruzilhada, lendo `pendingDecisions`. No perfil Explorador da matriz vale para **metade das sementes** (as de número ímpar na lista).
- **As tabelas de expedições no `.md` da matriz**: por célula, as somas das sementes (expedições, encruzilhadas com e sem a visita extra, feridos, cativos, mortos, resgatados, Covil limpo, equipes perdidas, herói ocioso) e, por destino, os envios e os desfechos.
- **O bot `ousado`**, com o perfil `ousado` da matriz (`--profile ousado`), fora da rodada padrão e sem faixa.
- **O modo `--expeditions`**: as cadências de 1, 2, 4 e 6 visitas por dia, e 2 mais a do aviso, com o explorador que responde a tudo e com o ousado.
- **O explorador** ergue a Guilda na frente das outras obras (e de novo depois de responder às cartas), com herói no feudo ou prometido, e monta a equipe com o que a visão passou a dizer (`eligibleHeroIds`, `canSend`, `suggestedTeam`).

### 9.8 Limites desta medição

- O estudo tem **10 sementes por linha** e só Senhor e Rei de Ferro. Com 150 partidas do ousado por dificuldade, "um cativo" não é uma taxa: é a ordem de grandeza.
- **A visita extra é um jogador ideal**: volta em até uma hora, toda vez. Um jogador de verdade atende parte dos avisos.
- O bot responde às encruzilhadas com uma regra fixa (o caminho do meio, às vezes o ambicioso), sem pesar a pista: os desfechos por destino medem o grafo com esse bot, não a melhor escolha.
- A calibragem continua tratando os nós como independentes, com a equipe inteira em todos, sem traço e sem item; a régua dos rótulos e a do rendimento por hora são do agente.
- Camponês não foi rodado no estudo; a matriz dos outros três perfis não foi rodada à parte (o `pnpm test` a confere contra as faixas).
- `--perf` e os bytes do estado e da visão com os campos novos não foram medidos nesta rodada.

## 10. Fase D fechada (V3D-T5.3 e T5.4)

Rodada de 2026-10-06, com o estado na versão 20, `crossroadsWaitRealMs` em **12 h reais** (resposta do autor, terceira rodada do dia: pendência D-71) e o `contentHash` `1ee9d576039d3adf`. Responde às subtarefas T5.3 (as encruzilhadas, os desfechos, o ouro parado) e T5.4 (desempenho, tamanhos e o teto da Guilda), depois da mudança de 6 h para 12 h. **Nada aqui foi lido pelo autor.** As faixas do Explorador foram remedidas de propósito, e as dos outros perfis não mexeram.

### 10.1 Comandos

```bash
for d in lord peasant ironKing; do
  pnpm -s sim -- --matrix --difficulty $d > matriz-$d.csv 2> matriz-$d.md      # 1.200 partidas cada, 3 perfis de visita e o Explorador
done
pnpm -s sim -- --matrix --profile explorador --difficulty lord > explorador-lord.csv 2> explorador-lord.md
pnpm -s sim -- --expeditions --difficulty lord > estudo-lord.md                  # 10 sementes, 7 dias reais, 1, 2, 4 e 6 visitas por dia
pnpm -s sim -- --expeditions --difficulty ironKing > estudo-ironKing.md
pnpm -s sim -- --perf > perf.md                                                  # com a máquina quieta
```

As saídas desta rodada ficaram no diretório descartável da sessão; o que vale está nas tabelas abaixo e na linha de base de `packages/sim-cli/src/bands.ts`.

### 10.2 As faixas: só o Explorador mexeu

**Os perfis que não usam a Guilda (Preguiçoso, Regular e Dedicado) não mudaram em nenhuma das 54 células** (18 por dificuldade, de 24): a linha de base é idêntica, valor a valor, nas três dificuldades, conferida célula a célula contra `MEASURED`. Mudaram **as células do Explorador**, que é o único perfil que ergue a Guilda e envia: as cinco que mudam em cada dificuldade (`week/3`, `week/1`, `week/0.5`, `year/1` e `year/0.5`; `year/3` não mudou). `week/1` e `year/1` são a mesma partida no ritmo 1. A linha de base foi regravada de propósito (`MEASURED`, seguindo o README do simulador), e a matriz saiu com **código 1 antes** em Senhor (excedente de madeira acima do limite em duas sementes do Explorador) e em Rei de Ferro (a maior sequência desperdiçando comida e madeira acima do limite), e **0 em Camponês** (os valores mexeram, mas dentro da folga das faixas velhas); **depois de regravar**, a suíte do simulador passa (`pnpm --filter @lotg/sim-cli test`, 13 arquivos, 331 testes).

Em Senhor (população, Salão, madeira, pedra e ouro parados, maior sequência desperdiçando em horas de jogo):

| Célula | Antes (6 h) | Depois (12 h) |
|---|---|---|
| `week/3/explorador` | 85 · Salão 8 · 4.420 · 5.200 · 286.522 · 39 | 85 · Salão 8 · 4.211 · 5.200 · 282.613 · 33 |
| `week/1/explorador` e `year/1/explorador` | 66 a 77 · Salão 7 · 5.200 · 5.200 · 19.874 · 9 | 65 a 77 · Salão 7 · 5.200 · 4.600 · 20.806 · 10 |
| `week/0.5/explorador` | 45 a 54 · Salão 5 · 794 · 897 · 1.219 · 1,5 | 45 a 54 · Salão 5 · **1.159** · 910 · 1.216 · 1,5 |
| `year/0.5/explorador` | 84 a 85 · Salão 8 · 5.200 · 5.200 · 20.652 · 5,5 | 84 a 85 · Salão 8 · 5.200 · 5.200 · 19.032 · 5,5 |

Em Camponês e em Rei de Ferro as mesmas cinco células mexem, na mesma ordem de grandeza e nem sempre na mesma direção (a linha inteira está em `bands.ts`); em Rei de Ferro, `week/3` passa a 69 h seguidas desperdiçando (eram 63) e `year/0.5` a 6 (eram 3). Nenhuma hora de fome nem de frio, em nenhuma célula, em nenhuma dificuldade. **A mudança vem de uma só causa**: a equipe espera na encruzilhada até o dobro, então cada expedição ocupa o lugar por mais tempo e o cofre recebe o saque mais tarde. Uma medida de `balance.test.ts` mudou com ela: **o Explorador do Normal termina a semana com cinco ou seis heróis** (eram sempre seis), em alguma das 50 sementes; a causa exata não foi investigada.

### 10.3 Quantas encruzilhadas o jogador decide, por visitas por dia

A pergunta de V3D-T5.3, de novo, depois da mudança. Em Senhor, 10 sementes, 7 dias reais, o Explorador que responde a **toda** encruzilhada que encontra na visita; "decididas pelo jogador ÷ todas" (as duas contagens são as que o bot encontrou em cada linha). **Antes** é a seção 9.3 (6 h); **depois**, esta rodada (12 h):

| Ritmo | Visitas por dia | Antes (6 h) | Depois (12 h) |
|---|---|---|---|
| Rápido 3× | 1 | 0 de 50 (0%) | **0 de 50 (0%)** |
| Rápido 3× | 2 | 0 de 234 (0%) | **114 de 114 (100%)** |
| Rápido 3× | 4 | 255 de 255 (100%) | 255 de 255 (100%) |
| Rápido 3× | 6 | 416 de 416 (100%) | 416 de 416 (100%) |
| Normal 1× | 1 | 0 de 18 (0%) | **0 de 18 (0%)** |
| Normal 1× | 2 | 0 de 103 (0%) | **42 de 42 (100%)** |
| Normal 1× | 4 | 174 de 174 (100%) | 174 de 174 (100%) |
| Normal 1× | 6 | 285 de 285 (100%) | 285 de 285 (100%) |
| Tranquilo 0,5× | 1 | 0 de 3 (0%) | **0 de 3 (0%)** |
| Tranquilo 0,5× | 2 | 0 de 32 (0%) | **14 de 14 (100%)** |
| Tranquilo 0,5× | 4 | 64 de 64 (100%) | 64 de 64 (100%) |
| Tranquilo 0,5× | 6 | 114 de 114 (100%) | 114 de 114 (100%) |

O que se lê, **com todas as letras**:

- **Quem visita duas vezes por dia passa a decidir todas** (de 0% a 100% nos três ritmos). **Quem visita uma vez por dia continua sem decidir nenhuma**: uma visita a cada 24 h contra uma espera de 12 h. O pedido do autor (a janela de 6 h deixava de fora quem visita 1 ou 2 vezes por dia) é atendido para o de duas visitas; o de uma visita só passaria a decidir com uma janela de 24 h ou mais, que ninguém propôs.
- **O 100% das duas visitas é a borda**: as duas visitas do bot são de 12 em 12 h exatas, e a equipe chega à encruzilhada minutos depois de uma visita, então a visita seguinte cai sempre antes do prazo (que vence 12 h depois da chegada). Um jogador de verdade, com duas visitas irregulares (de manhã e à noite, 14 h e 10 h), perderia a encruzilhada de uma equipe que parou logo depois de uma visita de 10 h e foi deixada para a visita seguinte, 14 h depois, e decide menos que 100%. **Isso não foi medido**: o simulador só tem a cadência exata.
- **O custo aparece nos envios**: com duas visitas por dia, o Rápido passa de 234 a 120 expedições em 7 dias, o Normal de 110 a 59 e o Tranquilo de 41 a 24, porque a equipe que espera a visita seguinte, em vez de a Postura decidir às 6 h, volta um dia depois e só é enviada de novo na visita seguinte a isso. Herói ocioso, em herói-hora por partida, quase não mexe (Rápido 391 a 384, Normal 303 a 300, Tranquilo 140 a 153) e **o ouro no fim fica na mesma ordem de grandeza** (Rápido, duas visitas: 177 a 212 mil antes, 169 a 212 mil depois).
- **Na matriz padrão** (50 sementes, metade com a visita extra, o resto só com as sessões do dia, em Senhor), a parte decidida pelo jogador sobe: Rápido de 27% (336 de 1.240) a **53% (479 de 904)**, Normal de 29% a **57% (229 de 403)** e Tranquilo de 32% a **68% (63 de 92)**; **nas partidas sem a visita extra, de 0% a 50% (143 de 286), 55% e 71%**. Em Rei de Ferro, 54%, 58% e 79%.

### 10.4 Desfechos, capturas, Resgates e mortes (o bot `ousado`)

Em Senhor e em Rei de Ferro, 10 sementes por linha, 7 dias reais, as quinze linhas do bot `ousado` (cinco cadências em cada um dos três ritmos), somadas:

| Dificuldade | Nós com prova: Pleno / Sucesso / Revés / Desastre | Feridos | Cativos | Mortos | Resgatados | Equipes perdidas | Covil limpo |
|---|---|---:|---:|---:|---:|---:|---:|
| Senhor (6 h, seção 9.4) | (por linha) | — | 1 | 0 | 1 | 0 | — |
| **Senhor (12 h)** | 1.623 / 1.304 / 626 / 24 | 633 | **0** | **0** | **0** | 0 | 153 |
| Rei de Ferro (6 h, seção 9.4) | (por linha) | — | 0 | 2 | 0 | 0 | — |
| **Rei de Ferro (12 h)** | 922 / 1.265 / 616 / 22 | 616 | **0** | **2** | **0** | 0 | 140 |

- **Capturas, Resgates e mortes continuam em zero ou quase**: nenhum cativo e nenhum Resgate nas 150 partidas do `ousado` em Senhor desta rodada (na anterior, um e um) e duas mortes em Rei de Ferro (como antes). Nenhuma equipe inteira se perdeu. O motivo é o da seção 9.4: o bot não manda equipe abaixo do risco do primeiro trecho, e os nós que capturam (chefes e cativeiros) só capturam quem não tinha chance; o Desastre é raro (de 22 a 24 nós em mais de 3.500 com prova). **Não se mede aqui o que acontece a quem manda equipe fraca de propósito.**
- **O Explorador (o bot prudente, 15 linhas, as mesmas cadências)**: 1.661 / 601 / 149 / 3 em Senhor e 1.616 / 611 / 166 / 0 em Rei de Ferro, sem cativo, morto, resgatado nem equipe perdida; o Covil de Lobos foi limpo 144 e 141 vezes.
- **Por destino** (estudo de Senhor): com uma e duas visitas por dia o Explorador só envia a Floresta Antiga e o Covil de Lobos (e, às vezes, a Patrulha); **as Ruínas e o Pântano só aparecem com quatro ou mais visitas por dia**, como na seção 9.5. A tabela por destino não é reproduzida aqui.

### 10.5 Herói ocioso e ouro parado

**Herói ocioso** (herói-hora por partida, Senhor, estudo `--expeditions`, Explorador que responde a tudo, em Rápido, Normal e Tranquilo): com uma visita por dia, 358, 171 e 140 (antes 418, 193 e 144); com duas, 384, 300 e 153 (antes 391, 303 e 140); com quatro e com seis, igual ao da seção 9.3 (424 e 426; 334 e 323; 181 e 188). Mudar a janela não criou ociosidade nova.

**O ouro parado, contra a linha de base da seção 1.3** (ouro em estoque no fim da janela, em Senhor, as 50 sementes: menor, mediana e maior). **O ouro parado NÃO caiu de forma que se meça como vitória**; o que mexe é pequeno e vai nas duas direções:

| Janela e ritmo | Regular da v0.2 (seção 1.3) | Regular agora (soldo e carta, sem Guilda) | Explorador agora (12 h) |
|---|---|---|---|
| 7 dias, Rápido | 113.566 · 128.436 · 148.487 | 159.093 · 177.665 · 211.754 | 169.768 · **243.978** · 282.613 |
| Ano de jogo, Rápido | 1.870 · 2.176 · 3.052 | 1.859 · 2.065 · 3.000 | 1.285 · **1.689** · 3.075 |
| 7 dias e ano, Normal | 2.348 · 8.967 · 23.641 | 8.283 · 16.708 · 23.840 | 862 · **9.324** · 20.806 |
| 7 dias, Tranquilo | 38 · 518 · 1.044 | 6 · 882 · 1.233 | 29 · **701** · 1.216 |
| Ano de jogo, Tranquilo | 13.128 · 17.646 · 22.535 | 11.000 · 14.838 · 20.021 | 5.891 · **11.962** · 19.032 |

- **No ano de jogo, que é onde o jogador de verdade está, o Explorador termina com menos que o Regular da v0.2: a mediana cai 22% no Rápido (2.176 a 1.689) e 32% no Tranquilo (17.646 a 11.962), e fica igual no Normal (8.967 a 9.324); o maior valor não cai (3.052 a 3.075 no Rápido).** Quem duas visitas por dia joga um ano com a Guilda ainda termina com de 1,3 a 3,1 mil de ouro sem destino no Rápido (a promessa a baixar era de 1,9 a 3,1 mil).
- **Na semana do Rápido, três anos de jogo, subiu**: a mediana vai de 128 mil a 244 mil (+90%), como nas seções 5.5 e 9.6, porque seis heróis custam 12 de ouro por hora e as expedições trazem ouro, e depois das obras o feudo continua sem onde gastá-lo.
- **A mudança de 6 h para 12 h moveu o ouro pouco**: o maior valor do Explorador na semana do Rápido foi de 286.522 a 282.613 (−1%). **Quem decide o que fazer com o ouro é o Mercado (Fase E), e a resposta do autor de 2026-10-06 (C-23) é medir após a Fase E e então decidir**: a V3E-T5.2 leva propostas concretas antes de V3G-T1.

### 10.6 Desempenho e tamanhos (V3D-T5.4)

`pnpm -s sim -- --perf`, com a máquina quieta (nenhum outro processo de teste ou de matriz rodando), Motor 0.2.0 · estado v20 · conteúdo `1ee9d576039d3adf` · ritmo 3× · Node v24.15.0 · linux x64 · 9 repetições por medida:

| Feudo | Ausência (dias reais) | `advanceTo` (ms, mediana) | `advanceTo` (ms, pior) | `deriveViewState` (ms, mediana) | Estado (bytes) | Visão (bytes) |
| --- | --- | --- | --- | --- | --- | --- |
| Feudo novo, sem nenhuma ordem | 1 | 1,2 | 1,4 | 0,5 | 2.216 | 18.605 |
| Feudo novo, sem nenhuma ordem | 30 | 13,6 | 15,8 | 0,5 | 3.073 | 19.865 |
| Feudo de 2 dias reais (bot econômico) | 7 | 4,5 | 4,7 | 0,5 | 4.038 | 22.650 |
| Feudo de 2 dias reais (bot econômico) | 30 | 16,7 | 25,1 | 0,4 | 4.284 | 22.531 |
| Feudo de 7 dias reais (bot econômico) | 7 | 4,9 | 7,4 | 0,4 | 4.234 | 20.774 |
| Feudo de 7 dias reais (bot econômico) | 30 | 19,4 | 19,9 | 0,7 | **4.515** | 21.214 |

(As nove linhas completas, com os eventos e os habitantes, estão no formato das seções 1.5 e 5.6 e foram vistas; aqui só as que contam.) **Contra a seção 5.6 (Fase C fechada): `advanceTo` de 30 dias reais fora, 13,6 a 19,4 ms (eram 14,1 a 17,5), sem diferença que se meça; o estado do bot econômico, o maior dos nove cenários, 4.515 bytes (eram 4.364: +151); a visão, no maior, 22.650 (eram 20.894: +1.756).** O teto de `perf.test.ts` (estado abaixo de 5.500 bytes) vale para esses cenários e continua com folga.

**Com seis heróis, três expedições em curso e três relatórios guardados** (roteiro descartável de teste do motor, Guilda no nível 4, Senhor, ritmo 3; JSON do estado e da visão em bytes UTF-8):

| Situação | Estado | Visão | `state.guild` | `view.guild` |
|---|---:|---:|---:|---:|
| 6 heróis, nenhuma expedição | 3.352 | 22.844 | 1.692 | 7.987 |
| 6 heróis, 3 relatórios guardados, nada em curso | 5.144 | 26.345 | 3.381 | 11.340 |
| **+ 3 expedições em curso (viajando)** | **6.133** | **26.622** | 4.340 | 11.617 |
| + 3 em curso, com uma ou duas paradas na encruzilhada (20 min depois) | **6.692** | **28.827** | 4.732 | 13.597 |

- **O maior caso medido é de 6,7 kB de estado e 28,8 kB de visão.** Contra a linha de base da v0.2 (seção 1.5: 3,3 a 3,5 kB e 16,9 a 17,4 kB) é o dobro do estado e +66% da visão; contra a seção 5.6 (Taverna cheia, seis heróis: 5,5 e 25,5 kB), +1,2 kB e +3,4 kB. **Longe do dimensionamento do GDD §14 (visão de 100 kB)**, e cada recibo de comando guarda uma visão inteira: a tabela `commands` cresce na mesma proporção (28,8 kB por ordem contra 17 a 18 kB da v0.2), e o volume real em produção continua sem medida.
- **Os três relatórios guardados pesam 1,8 kB de estado e 3,5 kB de visão** (cerca de 600 bytes e 1,2 kB por relatório); cada expedição em curso viajando, cerca de 330 bytes de estado e 90 de visão, e a equipe parada na encruzilhada acrescenta uma folha de caminhos à visão (mais 2,2 kB na medida com duas paradas).
- **O teto de `perf.test.ts` não cobre este caso** (o bot econômico não manda expedição): um jogador com a Guilda cheia passa de 5.500 bytes de estado. O teto fica como está e vale para o que o simulador mede; o limite real do estado é o dos tetos de lista do conteúdo (`reportsKept`, `slotsByGuildLevel`, `rosterCap`, o arsenal de 30).

**O teto da Guilda (roadmap, §0.5, "nível alcançável").** Confirmado por teste de conteúdo que roda em todo `pnpm test`: `packages/content/src/expeditions.test.ts`, "cada nível vendido da Guilda cabe no depósito nas três dificuldades, com o Armazém que o Salão daquele nível deixa erguer" (passa nesta rodada, com o prazo da encruzilhada em 12 h, que não entra na conta). Nenhum custo de nível da Guilda fica acima do depósito de Camponês, Senhor ou Rei de Ferro.

### 10.7 Limites desta medição

- **Dez sementes por linha** nos estudos de expedição e só Senhor e Rei de Ferro (Camponês entrou só na matriz padrão). "Um cativo" ou "duas mortes" não são taxas.
- **A cadência de duas visitas é exata (12 h), e é por isso que dá 100%.** A pergunta "quanto decide um jogador de duas visitas irregulares" não tem medida; a conta mostra que decide menos que isso, e que o de uma visita por dia não decide.
- **O custo de a equipe esperar mais** aparece nos envios (a metade com duas visitas) e nas células do Explorador; **ninguém jogou** a diferença, e se a espera de 12 h é boa para o jogador de duas visitas, que agora decide, mas envia menos, é pergunta que só o autor responde jogando.
- **O Explorador é prudente e o `ousado` não chega a ser imprudente**: nenhum dos dois mostra captura nem morte em número que importe, e a regra dos desfechos continua a limitar o que se mede (D-66).
- **A seção 9.3 dizia que, para o perfil de 2 visitas decidir, a janela teria de "passar das 12 h".** Com 12 h exatas e duas visitas exatamente de 12 em 12 h, ele já decide todas: a visita seguinte cai sempre antes do prazo, que nasce depois da visita que enviou a equipe. A previsão estava certa na direção e errada na borda; é um efeito da cadência exata do bot, não uma propriedade do jogo.
- Os tempos de `--perf` são de uma rodada, nove repetições, indicativos.
- A matriz do Camponês saiu **dentro das faixas** só depois de regravar as cinco células do Explorador; as 24 células de cada dificuldade foram conferidas, e as dos perfis sem Guilda, comparadas uma a uma com a linha de base antiga, e são idênticas.

## 11. Rodadas seguintes das Fases E a G

*Reservada. Cada fase que muda a economia registra aqui a sua rodada (V3E-T5, V3F-T4, V3G-T1), comparada com as seções 1 e 3 a 10.*
