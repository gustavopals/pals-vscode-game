# Balanceamento da v0.4

Medições do simulador (`@lotg/sim-cli`) ao longo da v0.4, no formato de [balance-v0.3.md](balance-v0.3.md). A seção 1 (a linha de base da V4A-T1) não foi feita nesta árvore e fica para quem fizer a V4A-T1.

Nenhum número deste documento é promessa ao jogador ([ADR 0011](decisions/0011-ritmo-3x-no-mvp.md)): são medidas de um bot, não a duração de nada na tela.

## V4B-T1. O ferro: o recurso e o ferro no Mercado

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
