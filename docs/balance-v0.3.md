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

## 5. Rodadas seguintes das Fases C a G

*Reservada. Cada fase que muda a economia registra aqui a sua rodada (V3C-T5, V3D-T5, V3E-T5, V3F-T4, V3G-T1), comparada com as seções 1, 3 e 4.*
