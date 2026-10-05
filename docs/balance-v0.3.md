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

*Reservada. A tarefa V3B-T2 do roadmap prepara o simulador para a Guilda; esta seção recebe o que ela medir. Nada foi medido ainda.*

## 3. Rodadas das Fases C a G

*Reservada. Cada fase que muda a economia registra aqui a sua rodada (V3C-T5, V3D-T5, V3E-T5, V3F-T4, V3G-T1), comparada com a seção 1. Nada foi medido ainda.*
