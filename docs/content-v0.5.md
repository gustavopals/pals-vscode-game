# Conteúdo da v0.5 — Capela e relíquias

## Expedições lendárias (V5B-T3; ADR 0022, D-6/D-7)

Os dois modelos novos abrem já no Ano 1, sem descoberta, com Capela erguida e
Guilda dos Aventureiros Nv4. Pedem de dois a três heróis Nv2+, sem classe obrigatória.
Risco médio, três horas de jogo fora do verão e da espera da encruzilhada.
Cada modelo tem três variantes, com dificuldades vizinhas e lugares diferentes.

Grafo: chegada com prova → encruzilhada → guardião ousado / guardião equilibrado /
retorno cauteloso. Cada trecho dura 60 min. A chegada favorece Arqueiro (perícia ×1,
dificuldade 89/90/91, 90 XP, Desastre fere). O caminho equilibrado exige Guerreiro,
usa pesos padrão (dificuldade 89/90/91, 120 XP, Desastre fere); o ousado favorece
Mago (vontade ×1,5, dificuldade 139/140/141, 150 XP, Desastre captura). O retorno
é seguro. As pistas distinguem o tesouro maior e o risco de captura do caminho
ousado, a guarda menor que exige Guerreiro e o recuo com o que já foi juntado.
O que há além da encruzilhada permanece oculto até a escolha.

| Modelo | Variantes A / B / C | Recursos da chegada | Ouro do guardião equilibrado / ousado | Ordem fixa das relíquias |
| --- | --- | --- | --- | --- |
| `ancestralVault` — Câmara dos Ancestrais | ponte caída / escadaria dos reis / pátio das colunas | 20–30 pedra | 80–100 / 140–180 | Chifre dos Ancestrais → Olho do Vigia → Selo do Rei Antigo → Pedra de Sal |
| `hermitsRefuge` — Refúgio do Eremita | trilha das raízes / encosta das brumas / passagem dos sinos | 20–30 madeira | 80–100 / 140–180 | Coração de Carvalho → Lâmpada do Eremita → Manto do Inverno |

Cada guardião é o último nó com prova de seu caminho. No Sucesso ou Sucesso pleno,
concede a primeira relíquia da lista do modelo que o feudo ainda não possui,
mesmo guardada fora da Capela. A concessão é imediata, não sorteia, não ocupa o
arsenal e não se perde por cobiça. Não vem no Revés, no Desastre ou no recuo.
Se a lista já estiver completa, o consolo é **100 de ouro**, acrescentado ao saque
do nó: fixo nos dois Sucessos, sem bônus nem perda por Ganancioso; entra no depósito
na volta e respeita sua capacidade. O saque comum conserva suas regras.

## O Lobo Branco

`whiteWolfHunt` já é uma expedição especial aberta pela carta do Conselho,
com três variantes lineares. O nó `whiteWolf` não tinha recompensa direta;
a pele continua paga uma vez pela carta `forestReturns`. Agora esse último nó
com prova concede **Osso de Lobo** no Sucesso ou Sucesso pleno, sem exigir Capela,
sem sorteio adicional. Se o feudo já o possui, vale o mesmo consolo de 100 de ouro.
Ids, duração, provas, variantes, janela da carta e pagamentos anteriores ficam
preservados. Os textos completos dos desfechos estão nos arquivos `missions/`;
o catálogo golden percorre os ramos e registra a leitura do relatório.

## Santuário no mapa (V5E-T4; ADR 0022, D-6)

O hexágono fixo `0,4` (`terrain: 'sanctuary'`) entrega uma relíquia uma única vez por
partida quando passa ao estado **Explorado** (`mapTurn.ts`, guardado por `stats.sanctuaryClaimed`).
Sem sorteio, percorre `sanctuaryReward.from` na ordem canônica de `RELIC_IDS`
(`ancestralHorn` → `oakHeart` → `watchersEye` → `ancientKingsSeal` → `wolfBone` →
`hermitsLamp` → `saltStone` → `wintersCloak`) e chama `grantRelic` para a primeira que o
feudo ainda não possui, emitindo `sanctuaryExplored` e `relicFound`. Se o feudo já tiver
todas as oito relíquias, credita **100 de ouro** (`sanctuaryReward.consolationGold`, fixo)
e emite `sanctuaryExplored` com `sanctuaryConsolationTemplate`.

## Cenários de mapa — Serra do Ferro (V5E-T4; ADR 0022, D-18)

Definidos em `packages/content/src/map.ts` (`mapScenarios`, `SCENARIO_IDS`):

| Cenário (`id`) | Nome | Legado exigido na conta | Floresta | Colinas | Campos | Lago | Pântano | Ruínas | Veio de Ferro | Santuário |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `standard` | Terras do Feudo (recomendado) | 0 | 30 | 22 | 28 | 8 | 6 | 4 | 2 | 0 |
| `ironRidge` | Serra do Ferro | 200 | 20 | 40 | 16 | 4 | 4 | 4 | 12 | 0 |

Os pesos somam 100 e aplicam-se somente aos hexágonos livres; todos os hexágonos fixos
(sede, destinos, tiles de ameaça e o Santuário único em `0,4`) mantêm terreno e posição.
O custo em Legado é verificado pelo servidor contra a soma de `legacy_ledger.points` da
conta em `POST /games` (desbloqueio permanente; não desconta pontos).
