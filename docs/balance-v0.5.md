# Balanceamento da v0.5

## 2026-11-19 · Semana do Rápido após a Fase C

Sete dias reais a 3× cobrem três anos de jogo. A partir do Ano 2, as ondas
crescem 10% por ano anterior, a Horda usa a memória da última formação do ano
anterior no primeiro plano de ondas e a segunda onda pode trazer Trolls.
O primeiro desvio observado em relação a `642b842e` foi no presságio das ondas
no outono do Ano 2. [ADR 0022, D-13 a D-15](decisions/0022-regras-da-v0.5.md).

A rodada usou `runMatrix({ difficulty, timeScales: [3] })` e guardou a janela
`week` da saída de `formatMatrix`, com os quatro perfis padrão e as 50 sementes
fixas `pedra-alta-001` a `pedra-alta-050`. São 600 partidas de 168 h reais,
200 por dificuldade, em Node 22.22.3, motor 0.4.0, estado 44 e conteúdo
`ccbe256a2b38cf38`. A medição segue o
[fechamento da v0.4, §23.1](balance-v0.4.md#231-base-método-e-regressões).

Cada linha registra os valores brutos de `MEASURED` antes e depois. Na ordem da
tabela, a população é a faixa final, o Salão é o menor nível final, fome e frio
são os máximos em horas reais, os estoques são os máximos finais em unidades
(madeira, pedra e ouro) e o desperdício é a maior sequência em horas de jogo.

| Dificuldade | Perfil em `week/3/*` | Antes (`642b842e`) | Depois (Fase C) |
| --- | --- | --- | --- |
| Camponês | Preguiçoso | `[28, 39], 4, 0, 0, 4250, 4250, 15495, 66` | `[28, 39], 4, 0, 0, 4250, 4250, 15495, 66` |
| Camponês | Regular | `[5, 32], 4, 8, 8, 4568, 5748, 25364, 54` | `[6, 26], 5, 8, 8, 3810, 4198, 30491, 57` |
| Camponês | Dedicado | `[3, 6], 5, 0, 6, 6131, 2956, 37602, 15` | `[3, 9], 4, 0, 6, 5949, 3146, 37440, 15` |
| Camponês | Explorador | `[3, 22], 4, 8, 14, 3241, 4660, 21126, 54` | `[4, 28], 4, 8, 9, 2803, 5750, 21136, 54` |
| Senhor | Preguiçoso | `[17, 35], 2, 0, 0, 3400, 3400, 10885, 126` | `[17, 35], 2, 0, 0, 3400, 3400, 10885, 126` |
| Senhor | Regular | `[6, 55], 5, 13, 10, 3288, 4000, 34496, 69` | `[5, 53], 4, 9, 14, 3043, 5200, 36325, 42` |
| Senhor | Dedicado | `[3, 12], 5, 0, 6, 4856, 3764, 52843, 21` | `[3, 17], 5, 0, 9, 4929, 4968, 46980, 24` |
| Senhor | Explorador | `[5, 35], 4, 13, 9, 4000, 4600, 17595, 69` | `[4, 24], 4, 13, 9, 4194, 4000, 24048, 51` |
| Rei de Ferro | Preguiçoso | `[16, 44], 2, 10, 0, 3200, 3200, 24932, 126` | `[16, 44], 2, 10, 0, 3200, 3200, 24932, 126` |
| Rei de Ferro | Regular | `[5, 33], 4, 8, 7, 3680, 3680, 31659, 63` | `[6, 34], 4, 8, 7, 2325, 3229, 46108, 63` |
| Rei de Ferro | Dedicado | `[5, 24], 5, 2, 4, 3340, 3624, 67526, 15` | `[5, 30], 5, 2, 5, 3509, 3663, 84446, 30` |
| Rei de Ferro | Explorador | `[6, 33], 4, 9, 7, 3400, 3680, 35374, 63` | `[5, 34], 4, 12, 7, 3330, 3446, 32757, 63` |

As faixas antigas reprovavam 7 partidas em Camponês, 12 em Senhor e 8 em Rei
de Ferro. As 600 partidas ficaram dentro das novas faixas, com zero ordens
recusadas. As três linhas do Preguiçoso coincidiram com a medição anterior.
A folga continua em 10% na população e 5% nos tetos, com o Salão no mínimo medido.

Em Senhor, o Regular da semana do Rápido passa de 13 para 9 h de fome,
de 10 para 14 h de frio e de 69 para 42 h de jogo seguidas desperdiçando
um recurso. Continua acima da meta de 8 h. A contagem de partidas com
Ameaça final de 80 ou mais nessa janela segue em 12 de 200, conferida
contra `642b842e` com as mesmas sementes.
