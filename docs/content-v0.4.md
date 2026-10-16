# Lords of the Guild — Conteúdo da v0.4

> **Rascunho, não lido pelo autor.** Escrito por agente de código durante a V4B-T1 (2026-10-16). Os números são premissas da tarefa (ADR 0019, decisão 3, e a linha da Mina Abandonada no GDD §9.3), e as frases são do agente. Uma frase ou um número que o autor trocar é mudança de conteúdo, golden e GDD no mesmo commit.

## 1. Mina Abandonada (`abandonedMine`, V4B-T1)

**Rascunho, não lido pelo autor.** O arquivo é `packages/content/src/missions/abandonedMine.ts`.

| Campo | Valor |
|---|---|
| Requisitos | Guilda dos Aventureiros Nv2 (ADR 0019); equipe de 2 heróis, com um Guerreiro (GDD §9.3); nível mínimo 1 |
| Descoberta | `access: discovered`. Revelada pela **Floresta Antiga**: o último nó com prova de cada caminho da Floresta (nas três variantes) revela a Mina do Sucesso em diante, ou no Revés com um Rastreador. A Patrulha continua revelando só as Ruínas (pendência B-8) |
| Risco | Médio |
| Duração anunciada | 240 min de jogo, 4 h (GDD §9.3): descida 60, prova 60, veio 60, subida 60 |
| Lugar na lista | Entre as Ruínas de Vel'Thar e o Pântano Nebuloso (a lista vai do que rende menos ao que rende mais; pendência B-9) |
| Recompensas | Pedra na descida (10 a 20) e na primeira prova (20 a 30); **ferro só no último nó com prova**: 70 a 80 no veio fundo (caminho ousado), 40 a 50 no veio lateral (caminho equilibrado). É o único destino que rende ferro |
| Desastre | Na primeira prova e no veio lateral, ferimento; **no veio fundo, captura** (o que a dificuldade faz: ferimento grave em Camponês, captura em Senhor, morte em Rei de Ferro) |

O grafo, igual nas três variantes (os ids de nó e de opção estão fixados em `STABLE_IDS`):

```
descent (travel, 60 min, pedra) → shaft (prova, 60 min, pedra) → galleries (encruzilhada)
   ├─ opção deepVein    (Ousada)      → nó lowerVein: prova, 60 min, ferro 70–80, captura → home (60 min)
   ├─ opção sideGallery (Equilibrada) → nó sideDrift: prova, 60 min, ferro 40–50, ferimento → home
   └─ opção climbOut    (Cautelosa)   → home
```

| Variante | Primeira prova (`shaft`) | Encruzilhada | Veio fundo (`lowerVein`) | Veio lateral (`sideDrift`) |
|---|---|---|---|---|
| 0 | "O poço escorado": perícia, Arqueiro, 78 | "Duas galerias" | "O que mora no veio fundo": Guerreiro, 96 | "A galeria escorada": Guerreiro, 84 |
| 1 | "Os ratos da rampa": Guerreiro, 80 | "A água no fundo" | "A galeria alagada": vontade, Mago, 102 | "Os degraus de rocha": perícia, Arqueiro, 82; **a opção pede um Arqueiro** |
| 2 | "O acampamento dos mineiros": vontade, Mago, 76 | "O mapa riscado" | "O veio da cruz": Guerreiro, 97 | "A porta de tábuas": Guerreiro, 86 |

As provas que um Guerreiro favorece não têm lição: toda equipe da Mina leva um Guerreiro, e o teste do catálogo só aceita lição de uma classe que pode faltar. As dificuldades foram ajustadas até a calibragem passar (cada opção com risco é a melhor para alguma equipe de referência e não para outra, e o caminho da Cautelosa é a escolha de alguma); as tabelas estão em `packages/engine/src/__golden__/expedition-calibration.md`, e as frases de cada desfecho, no arquivo do modelo e no golden do catálogo (`expedition-catalog.json`).
