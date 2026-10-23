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

## 2. Goldens de batalha escritos à mão (V4D-T1.1)

**Rascunho, não lido pelo autor.** Sete cenários do GDD §10.4 com a conta feita rodada a rodada, **antes** de uma linha do motor. Cada um vira um golden `packages/engine/src/__golden__/battle-<cenario>.md` na V4D-T1.3: o motor tem de reproduzir estas contas exatamente. As contas foram conferidas com um programa descartável de frações exatas que implementa **só** as convenções abaixo (não faz parte do repositório); a regra de jogo continua a do GDD e do ADR 0019.

### 2.0 Convenções da conta

Atributos das unidades: `packages/content/src/units.ts` (§10.2). Atributos dos inimigos: GDD §10.3. Todos os números são inteiros ou frações; **um arredondamento só, para baixo, no dano efetivo**.

- **Sorte fixada para a conta.** O motor sorteia um inteiro de 90 a 110 por esquadrão por rodada; para estes goldens a sorte é **fixada em 100 em todo ataque** (fator 100/100), para que a conta caiba à mão. O teste do motor injeta a sorte 100; a distribuição 90 a 110 é coberta pela propriedade (V4D-T1.7).
- **Ordem.** Em cada rodada, todos os esquadrões vivos **no começo da rodada** por iniciativa (maior primeiro); empate: defensor, depois ala (esquerda, centro, direita), depois linha (Frente, Retaguarda). Os ataques são **sequenciais**: as baixas valem na hora, o `n` do atacante é o de **quando ele age**, e quem foi destruído antes de agir não age.
- **Siglas.** `D` é o defensor (o jogador), `A` o atacante (a Horda); `E`, `C`, `D` (de direita) as alas e `F`, `B` (retaguarda, de *back*) as linhas; o rótulo é lado-ala+linha, por exemplo `A-EF` é a Frente da ala esquerda do atacante. Nos cenários só há Frente, salvo onde dito.
- **Conta de um ataque.** `bruto = atq × n × contra × aura × flanco × sorte/100` (frações exatas); `absorvido = def_alvo × n_alvo × 1/2`; `efetivo = piso(máx(bruto − absorvido, bruto × 1/5))`; `baixas = piso((efetivo + residual) / vida)`, limitada a `n_alvo`; o resto fica como residual do esquadrão (zero se o esquadrão morre).
- **Contra-ataque ×3/2** quando o arquétipo do atacante vence o do alvo (Espadachim > Lanceiro > Cavaleiro > Arqueiro > Espadachim); Lobo e Cavaleiro Negro são Cavaleiro, Saqueador é Espadachim, Esqueleto é Lanceiro; Lanceiro × Ogro também ×3/2 (§10.3).
- **Alvo.** A Frente da ala oposta; se vazia, a Retaguarda. Se a ala oposta não tem esquadrões (caída **ou nunca ocupada**), o ataque flanqueia ×5/4 o Centro e, não havendo, a ala esquerda e depois a direita (o Centro ataca a esquerda e depois a direita). O Lobo escolhe uma ala lateral.
- **Muralha.** Só em defesa, vida por ala (a vida por nível é a Fase E; aqui um valor dito em cada cenário). O corpo a corpo inimigo contra uma ala com a muralha de pé bate **inteiro** na muralha; o Ogro, metade (piso) na muralha e a outra metade nas tropas. A muralha não tem defesa; o excesso além da vida que resta se perde.
- **Moral.** Cada lado começa em 100; −10 por esquadrão destruído, −20 por ala que cai (a ala cai quando o último esquadrão dela morre; soma-se ao −10 do esquadrão); a debandada (moral ≤ 30) é conferida **no fim da rodada**. Comandantes e torres não entram nestes cenários.
- **Fim.** Lado sem esquadrões, debandada ou 12 rodadas; em defesa, 12 rodadas é "Resistiu".

### 2.1 Paliçada contra lobos

**Situação.** Primavera, defesa. D: ala E, Frente, 10 Lanceiros; ala D, Frente, 10 Lanceiros; Centro, Frente, 5 Escudeiros. A: ala E, 8 Lobos; ala D, 8 Lobos. A Paliçada vale como muralha de **60 de vida por ala** (premissa do cenário; ver D-2). Lobo: atq 7, def 2, vida 14, inic 6. Lanceiro: 6, 4, 20, inic 3. Escudeiro: 3, 9, 30, inic 2.

**Rodada 1**

- A-EF 8 Lobo → D-EF 10 Lanceiro: bruto = 7×8×100/100 = 56; à muralha (1): piso(56) = 56, muralha 60 → 4
- A-DF 8 Lobo → D-DF 10 Lanceiro: bruto = 7×8×100/100 = 56; à muralha (1): piso(56) = 56, muralha 60 → 4
- D-EF 10 Lanceiro → A-EF 8 Lobo: bruto = 6×10×3/2 (contra)×100/100 = 90; absorvido = 2×8×1/2 = 8; efetivo = máx(90 − 8, 90/5) = máx(82, 18), piso 82; baixas = piso((82 + 0)/14) = 5; restam 3, residual 12
- D-DF 10 Lanceiro → A-DF 8 Lobo: bruto = 6×10×3/2 (contra)×100/100 = 90; absorvido = 2×8×1/2 = 8; efetivo = máx(90 − 8, 90/5) = máx(82, 18), piso 82; baixas = piso((82 + 0)/14) = 5; restam 3, residual 12
- D-CF 5 Escudeiro → A-EF 3 Lobo: bruto = 3×5×5/4 (flanco)×100/100 = 75/4; absorvido = 2×3×1/2 = 3; efetivo = máx(75/4 − 3, 75/4/5) = máx(63/4, 15/4), piso 15; baixas = piso((15 + 12)/14) = 1; restam 2, residual 13

Fim da rodada 1: moral D 100, A 100; D-EF 10 (res 0), D-CF 5 (res 0), D-DF 10 (res 0), A-EF 2 (res 13), A-DF 3 (res 12); muralha {0: 4, 1: 60, 2: 4}

**Rodada 2**

- A-EF 2 Lobo → D-EF 10 Lanceiro: bruto = 7×2×100/100 = 14; à muralha (1): piso(14) = 14, muralha 4 → 0
- A-DF 3 Lobo → D-DF 10 Lanceiro: bruto = 7×3×100/100 = 21; à muralha (1): piso(21) = 21, muralha 4 → 0
- D-EF 10 Lanceiro → A-EF 2 Lobo: bruto = 6×10×3/2 (contra)×100/100 = 90; absorvido = 2×2×1/2 = 2; efetivo = máx(90 − 2, 90/5) = máx(88, 18), piso 88; baixas = piso((88 + 13)/14) = 2; restam 0, residual 0
  - A-EF destruído: moral A −10 → 90
  - ala E do lado A caiu: moral −20 → 70
- D-DF 10 Lanceiro → A-DF 3 Lobo: bruto = 6×10×3/2 (contra)×100/100 = 90; absorvido = 2×3×1/2 = 3; efetivo = máx(90 − 3, 90/5) = máx(87, 18), piso 87; baixas = piso((87 + 12)/14) = 3; restam 0, residual 0
  - A-DF destruído: moral A −10 → 60
  - ala D do lado A caiu: moral −20 → 40

**Resultado.** Os dois esquadrões de Lobos destruídos na rodada 2; **D não perde um soldado**; moral A 40, D 100. **Fatores decisivos:** (1) a Paliçada recebeu todos os golpes dos Lobos nas duas rodadas (56 de bruto por ala na primeira; na segunda, 14 e 21 contra os 4 de vida que restavam) e as tropas ficaram intactas; (2) os Lanceiros contra-atacaram a cavalaria (×3/2 em todo golpe), cinco Lobos por ala na primeira rodada; (3) os Escudeiros do Centro, sem inimigo à frente, flanquearam a ala esquerda (×5/4) e tiraram mais um Lobo.

### 2.2 Flanco

**Situação.** Sem muralha. D: ala E, 2 Espadachins; Centro, 8 Lanceiros; ala D, 8 Lanceiros. A: 8 Saqueadores na ala E, 6 no Centro, 6 na ala D. Espadachim: 8, 5, 24, inic 3. Saqueador: 6, 3, 18, inic 3 (Espadachim). A ala esquerda do jogador é fraca de propósito: quando ela cai, os Saqueadores de lá flanqueiam o Centro.

**Rodada 1**

- D-EF 2 Espadachim → A-EF 8 Saqueador: bruto = 8×2×100/100 = 16; absorvido = 3×8×1/2 = 12; efetivo = máx(16 − 12, 16/5) = máx(4, 16/5), piso 4; baixas = piso((4 + 0)/18) = 0; restam 8, residual 4
- D-CF 8 Lanceiro → A-CF 6 Saqueador: bruto = 6×8×100/100 = 48; absorvido = 3×6×1/2 = 9; efetivo = máx(48 − 9, 48/5) = máx(39, 48/5), piso 39; baixas = piso((39 + 0)/18) = 2; restam 4, residual 3
- D-DF 8 Lanceiro → A-DF 6 Saqueador: bruto = 6×8×100/100 = 48; absorvido = 3×6×1/2 = 9; efetivo = máx(48 − 9, 48/5) = máx(39, 48/5), piso 39; baixas = piso((39 + 0)/18) = 2; restam 4, residual 3
- A-EF 8 Saqueador → D-EF 2 Espadachim: bruto = 6×8×100/100 = 48; absorvido = 5×2×1/2 = 5; efetivo = máx(48 − 5, 48/5) = máx(43, 48/5), piso 43; baixas = piso((43 + 0)/24) = 1; restam 1, residual 19
- A-CF 4 Saqueador → D-CF 8 Lanceiro: bruto = 6×4×3/2 (contra)×100/100 = 36; absorvido = 4×8×1/2 = 16; efetivo = máx(36 − 16, 36/5) = máx(20, 36/5), piso 20; baixas = piso((20 + 0)/20) = 1; restam 7, residual 0
- A-DF 4 Saqueador → D-DF 8 Lanceiro: bruto = 6×4×3/2 (contra)×100/100 = 36; absorvido = 4×8×1/2 = 16; efetivo = máx(36 − 16, 36/5) = máx(20, 36/5), piso 20; baixas = piso((20 + 0)/20) = 1; restam 7, residual 0

Fim da rodada 1: moral D 100, A 100; D-EF 1 (res 19), D-CF 7 (res 0), D-DF 7 (res 0), A-EF 8 (res 4), A-CF 4 (res 3), A-DF 4 (res 3)

**Rodada 2**

- D-EF 1 Espadachim → A-EF 8 Saqueador: bruto = 8×1×100/100 = 8; absorvido = 3×8×1/2 = 12; efetivo = máx(8 − 12, 8/5) = máx(-4, 8/5), piso 1; baixas = piso((1 + 4)/18) = 0; restam 8, residual 5
- D-CF 7 Lanceiro → A-CF 4 Saqueador: bruto = 6×7×100/100 = 42; absorvido = 3×4×1/2 = 6; efetivo = máx(42 − 6, 42/5) = máx(36, 42/5), piso 36; baixas = piso((36 + 3)/18) = 2; restam 2, residual 3
- D-DF 7 Lanceiro → A-DF 4 Saqueador: bruto = 6×7×100/100 = 42; absorvido = 3×4×1/2 = 6; efetivo = máx(42 − 6, 42/5) = máx(36, 42/5), piso 36; baixas = piso((36 + 3)/18) = 2; restam 2, residual 3
- A-EF 8 Saqueador → D-EF 1 Espadachim: bruto = 6×8×100/100 = 48; absorvido = 5×1×1/2 = 5/2; efetivo = máx(48 − 5/2, 48/5) = máx(91/2, 48/5), piso 45; baixas = piso((45 + 19)/24) = 1; restam 0, residual 0
  - D-EF destruído: moral D −10 → 90
  - ala E do lado D caiu: moral −20 → 70
- A-CF 2 Saqueador → D-CF 7 Lanceiro: bruto = 6×2×3/2 (contra)×100/100 = 18; absorvido = 4×7×1/2 = 14; efetivo = máx(18 − 14, 18/5) = máx(4, 18/5), piso 4; baixas = piso((4 + 0)/20) = 0; restam 7, residual 4
- A-DF 2 Saqueador → D-DF 7 Lanceiro: bruto = 6×2×3/2 (contra)×100/100 = 18; absorvido = 4×7×1/2 = 14; efetivo = máx(18 − 14, 18/5) = máx(4, 18/5), piso 4; baixas = piso((4 + 0)/20) = 0; restam 7, residual 4

Fim da rodada 2: moral D 70, A 100; D-CF 7 (res 4), D-DF 7 (res 4), A-EF 8 (res 5), A-CF 2 (res 3), A-DF 2 (res 3)

**Rodada 3**

- D-CF 7 Lanceiro → A-CF 2 Saqueador: bruto = 6×7×100/100 = 42; absorvido = 3×2×1/2 = 3; efetivo = máx(42 − 3, 42/5) = máx(39, 42/5), piso 39; baixas = piso((39 + 3)/18) = 2; restam 0, residual 0
  - A-CF destruído: moral A −10 → 90
  - ala C do lado A caiu: moral −20 → 70
- D-DF 7 Lanceiro → A-DF 2 Saqueador: bruto = 6×7×100/100 = 42; absorvido = 3×2×1/2 = 3; efetivo = máx(42 − 3, 42/5) = máx(39, 42/5), piso 39; baixas = piso((39 + 3)/18) = 2; restam 0, residual 0
  - A-DF destruído: moral A −10 → 60
  - ala D do lado A caiu: moral −20 → 40
- A-EF 8 Saqueador → D-CF 7 Lanceiro: bruto = 6×8×3/2 (contra)×5/4 (flanco)×100/100 = 90; absorvido = 4×7×1/2 = 14; efetivo = máx(90 − 14, 90/5) = máx(76, 18), piso 76; baixas = piso((76 + 4)/20) = 4; restam 3, residual 0

Fim da rodada 3: moral D 70, A 40; D-CF 3 (res 0), D-DF 7 (res 4), A-EF 8 (res 5)

**Rodada 4**

- D-CF 3 Lanceiro → A-EF 8 Saqueador: bruto = 6×3×5/4 (flanco)×100/100 = 45/2; absorvido = 3×8×1/2 = 12; efetivo = máx(45/2 − 12, 45/2/5) = máx(21/2, 9/2), piso 10; baixas = piso((10 + 5)/18) = 0; restam 8, residual 15
- D-DF 7 Lanceiro → A-EF 8 Saqueador: bruto = 6×7×5/4 (flanco)×100/100 = 105/2; absorvido = 3×8×1/2 = 12; efetivo = máx(105/2 − 12, 105/2/5) = máx(81/2, 21/2), piso 40; baixas = piso((40 + 15)/18) = 3; restam 5, residual 1
- A-EF 5 Saqueador → D-CF 3 Lanceiro: bruto = 6×5×3/2 (contra)×5/4 (flanco)×100/100 = 225/4; absorvido = 4×3×1/2 = 6; efetivo = máx(225/4 − 6, 225/4/5) = máx(201/4, 45/4), piso 50; baixas = piso((50 + 0)/20) = 2; restam 1, residual 10

Fim da rodada 4: moral D 70, A 40; D-CF 1 (res 10), D-DF 7 (res 4), A-EF 5 (res 1)

**Rodada 5**

- D-CF 1 Lanceiro → A-EF 5 Saqueador: bruto = 6×1×5/4 (flanco)×100/100 = 15/2; absorvido = 3×5×1/2 = 15/2; efetivo = máx(15/2 − 15/2, 15/2/5) = máx(0, 3/2), piso 1; baixas = piso((1 + 1)/18) = 0; restam 5, residual 2
- D-DF 7 Lanceiro → A-EF 5 Saqueador: bruto = 6×7×5/4 (flanco)×100/100 = 105/2; absorvido = 3×5×1/2 = 15/2; efetivo = máx(105/2 − 15/2, 105/2/5) = máx(45, 21/2), piso 45; baixas = piso((45 + 2)/18) = 2; restam 3, residual 11
- A-EF 3 Saqueador → D-CF 1 Lanceiro: bruto = 6×3×3/2 (contra)×5/4 (flanco)×100/100 = 135/4; absorvido = 4×1×1/2 = 2; efetivo = máx(135/4 − 2, 135/4/5) = máx(127/4, 27/4), piso 31; baixas = piso((31 + 10)/20) = 1; restam 0, residual 0
  - D-CF destruído: moral D −10 → 60
  - ala C do lado D caiu: moral −20 → 40

Fim da rodada 5: moral D 40, A 40; D-DF 7 (res 4), A-EF 3 (res 11)

**Rodada 6**

- D-DF 7 Lanceiro → A-EF 3 Saqueador: bruto = 6×7×5/4 (flanco)×100/100 = 105/2; absorvido = 3×3×1/2 = 9/2; efetivo = máx(105/2 − 9/2, 105/2/5) = máx(48, 21/2), piso 48; baixas = piso((48 + 11)/18) = 3; restam 0, residual 0
  - A-EF destruído: moral A −10 → 30
  - ala E do lado A caiu: moral −20 → 10

**Resultado.** D vence na rodada 6 com 7 Lanceiros na ala D; perdeu a ala E (rodada 2) e o Centro (rodada 5); moral D 40, A 10. **Fatores decisivos:** (1) a ala esquerda caiu na rodada 2 e, na 3, os 8 Saqueadores flanquearam o Centro (×5/4 mais o contra-ataque ×3/2: 90 de bruto, 4 Lanceiros mortos de uma vez); (2) os Lanceiros da ala direita, venceram o duelo da ala (a Horda caiu a 2 Saqueadores no Centro e na ala D na rodada 2) e passaram a flanquear a ala esquerda inimiga (×5/4) na rodada 4; (3) os 2 Espadachins da ala fraca, contra 8 Saqueadores, perderam um por rodada (43 efetivos contra 24 de vida).

### 2.3 Contra-ataque

**Situação.** Sem muralha, só o Centro. D: 12 Lanceiros. A: 6 Cavaleiros Negros (atq 10, def 6, vida 30, inic 5). O Lanceiro contra-ataca o Cavaleiro (×3/2); o Cavaleiro Negro, de iniciativa maior, ataca primeiro e sem vantagem.

**Rodada 1**

- A-CF 6 Cavaleiro Negro → D-CF 12 Lanceiro: bruto = 10×6×100/100 = 60; absorvido = 4×12×1/2 = 24; efetivo = máx(60 − 24, 60/5) = máx(36, 12), piso 36; baixas = piso((36 + 0)/20) = 1; restam 11, residual 16
- D-CF 11 Lanceiro → A-CF 6 Cavaleiro Negro: bruto = 6×11×3/2 (contra)×100/100 = 99; absorvido = 6×6×1/2 = 18; efetivo = máx(99 − 18, 99/5) = máx(81, 99/5), piso 81; baixas = piso((81 + 0)/30) = 2; restam 4, residual 21

Fim da rodada 1: moral D 100, A 100; D-CF 11 (res 16), A-CF 4 (res 21)

**Rodada 2**

- A-CF 4 Cavaleiro Negro → D-CF 11 Lanceiro: bruto = 10×4×100/100 = 40; absorvido = 4×11×1/2 = 22; efetivo = máx(40 − 22, 40/5) = máx(18, 8), piso 18; baixas = piso((18 + 16)/20) = 1; restam 10, residual 14
- D-CF 10 Lanceiro → A-CF 4 Cavaleiro Negro: bruto = 6×10×3/2 (contra)×100/100 = 90; absorvido = 6×4×1/2 = 12; efetivo = máx(90 − 12, 90/5) = máx(78, 18), piso 78; baixas = piso((78 + 21)/30) = 3; restam 1, residual 9

Fim da rodada 2: moral D 100, A 100; D-CF 10 (res 14), A-CF 1 (res 9)

**Rodada 3**

- A-CF 1 Cavaleiro Negro → D-CF 10 Lanceiro: bruto = 10×1×100/100 = 10; absorvido = 4×10×1/2 = 20; efetivo = máx(10 − 20, 10/5) = máx(-10, 2), piso 2; baixas = piso((2 + 14)/20) = 0; restam 10, residual 16
- D-CF 10 Lanceiro → A-CF 1 Cavaleiro Negro: bruto = 6×10×3/2 (contra)×100/100 = 90; absorvido = 6×1×1/2 = 3; efetivo = máx(90 − 3, 90/5) = máx(87, 18), piso 87; baixas = piso((87 + 9)/30) = 1; restam 0, residual 0
  - A-CF destruído: moral A −10 → 90
  - ala C do lado A caiu: moral −20 → 70

**Resultado.** D vence na rodada 3 com 10 Lanceiros (perdeu 2); A destruído; moral A 70. **Fatores decisivos:** (1) o contra-ataque ×3/2 dos Lanceiros: 99 de bruto contra 60 do inimigo na primeira rodada; (2) a defesa 4 dos Lanceiros absorveu 24 dos 60 do inimigo, e a deles, 6, absorveu só 18 dos 99; (3) o residual guardado: 16 de dano que não matou ninguém na primeira rodada completou o segundo Lanceiro na segunda.

### 2.4 Ogro e muralha

**Situação.** Defesa, só o Centro, muralha de **100 de vida** (premissa). D: 6 Lanceiros. A: 1 Ogro (atq 14, def 6, vida 80, inic 1; metade do dano ignora a muralha; recebe ×3/2 de Lanceiros).

**Rodada 1**

- D-CF 6 Lanceiro → A-CF 1 Ogro: bruto = 6×6×3/2 (contra)×100/100 = 54; absorvido = 6×1×1/2 = 3; efetivo = máx(54 − 3, 54/5) = máx(51, 54/5), piso 51; baixas = piso((51 + 0)/80) = 0; restam 1, residual 51
- A-CF 1 Ogro → D-CF 6 Lanceiro: bruto = 14×1×100/100 = 14; à muralha (1/2): piso(7) = 7, muralha 100 → 93; às tropas 7; absorvido = 4×6×1/2 = 12; efetivo = máx(7 − 12, 7/5) = máx(-5, 7/5), piso 1; baixas = piso((1 + 0)/20) = 0; restam 6, residual 1

Fim da rodada 1: moral D 100, A 100; D-CF 6 (res 1), A-CF 1 (res 51); muralha {1: 93}

**Rodada 2**

- D-CF 6 Lanceiro → A-CF 1 Ogro: bruto = 6×6×3/2 (contra)×100/100 = 54; absorvido = 6×1×1/2 = 3; efetivo = máx(54 − 3, 54/5) = máx(51, 54/5), piso 51; baixas = piso((51 + 51)/80) = 1; restam 0, residual 0
  - A-CF destruído: moral A −10 → 90
  - ala C do lado A caiu: moral −20 → 70

**Resultado.** D vence na rodada 2 sem perder um Lanceiro; muralha 100 → 93; moral A 70. **Fatores decisivos:** (1) os Lanceiros contra-atacam o Ogro (×3/2): 51 efetivos por rodada contra 80 de vida; (2) a muralha recebeu a metade do golpe do Ogro (7 de 14) e a defesa 4 de seis Lanceiros engoliu o resto (absorvido 12 contra 7: sobra o mínimo de 1/5, que é 1); (3) a iniciativa 1 do Ogro: os Lanceiros bateram primeiro nas duas rodadas e o residual (51) completou a baixa do Ogro na segunda.

### 2.5 Debandada

**Situação.** Sem muralha. D: ala E, Frente 4 Lanceiros e Retaguarda 3 Arqueiros; Centro, Frente 10 Lanceiros; ala D, Frente 4 Lanceiros e Retaguarda 3 Arqueiros. A: 8 Cavaleiros Negros na ala E, 4 no Centro, 8 na ala D. Arqueiro: 7, 2, 16, inic 4, Retaguarda. Os Arqueiros atacam a Frente inimiga da ala (Leitura: ver D-3). O Cavaleiro vence o Arqueiro (×3/2).

**Rodada 1**

- A-EF 8 Cavaleiro Negro → D-EF 4 Lanceiro: bruto = 10×8×100/100 = 80; absorvido = 4×4×1/2 = 8; efetivo = máx(80 − 8, 80/5) = máx(72, 16), piso 72; baixas = piso((72 + 0)/20) = 3; restam 1, residual 12
- A-CF 4 Cavaleiro Negro → D-CF 10 Lanceiro: bruto = 10×4×100/100 = 40; absorvido = 4×10×1/2 = 20; efetivo = máx(40 − 20, 40/5) = máx(20, 8), piso 20; baixas = piso((20 + 0)/20) = 1; restam 9, residual 0
- A-DF 8 Cavaleiro Negro → D-DF 4 Lanceiro: bruto = 10×8×100/100 = 80; absorvido = 4×4×1/2 = 8; efetivo = máx(80 − 8, 80/5) = máx(72, 16), piso 72; baixas = piso((72 + 0)/20) = 3; restam 1, residual 12
- D-EB 3 Arqueiro → A-EF 8 Cavaleiro Negro: bruto = 7×3×100/100 = 21; absorvido = 6×8×1/2 = 24; efetivo = máx(21 − 24, 21/5) = máx(-3, 21/5), piso 4; baixas = piso((4 + 0)/30) = 0; restam 8, residual 4
- D-DB 3 Arqueiro → A-DF 8 Cavaleiro Negro: bruto = 7×3×100/100 = 21; absorvido = 6×8×1/2 = 24; efetivo = máx(21 − 24, 21/5) = máx(-3, 21/5), piso 4; baixas = piso((4 + 0)/30) = 0; restam 8, residual 4
- D-EF 1 Lanceiro → A-EF 8 Cavaleiro Negro: bruto = 6×1×3/2 (contra)×100/100 = 9; absorvido = 6×8×1/2 = 24; efetivo = máx(9 − 24, 9/5) = máx(-15, 9/5), piso 1; baixas = piso((1 + 4)/30) = 0; restam 8, residual 5
- D-CF 9 Lanceiro → A-CF 4 Cavaleiro Negro: bruto = 6×9×3/2 (contra)×100/100 = 81; absorvido = 6×4×1/2 = 12; efetivo = máx(81 − 12, 81/5) = máx(69, 81/5), piso 69; baixas = piso((69 + 0)/30) = 2; restam 2, residual 9
- D-DF 1 Lanceiro → A-DF 8 Cavaleiro Negro: bruto = 6×1×3/2 (contra)×100/100 = 9; absorvido = 6×8×1/2 = 24; efetivo = máx(9 − 24, 9/5) = máx(-15, 9/5), piso 1; baixas = piso((1 + 4)/30) = 0; restam 8, residual 5

Fim da rodada 1: moral D 100, A 100; D-EF 1 (res 12), D-EB 3 (res 0), D-CF 9 (res 0), D-DF 1 (res 12), D-DB 3 (res 0), A-EF 8 (res 5), A-CF 2 (res 9), A-DF 8 (res 5)

**Rodada 2**

- A-EF 8 Cavaleiro Negro → D-EF 1 Lanceiro: bruto = 10×8×100/100 = 80; absorvido = 4×1×1/2 = 2; efetivo = máx(80 − 2, 80/5) = máx(78, 16), piso 78; baixas = piso((78 + 12)/20) = 1; restam 0, residual 0
  - D-EF destruído: moral D −10 → 90
- A-CF 2 Cavaleiro Negro → D-CF 9 Lanceiro: bruto = 10×2×100/100 = 20; absorvido = 4×9×1/2 = 18; efetivo = máx(20 − 18, 20/5) = máx(2, 4), piso 4; baixas = piso((4 + 0)/20) = 0; restam 9, residual 4
- A-DF 8 Cavaleiro Negro → D-DF 1 Lanceiro: bruto = 10×8×100/100 = 80; absorvido = 4×1×1/2 = 2; efetivo = máx(80 − 2, 80/5) = máx(78, 16), piso 78; baixas = piso((78 + 12)/20) = 1; restam 0, residual 0
  - D-DF destruído: moral D −10 → 80
- D-EB 3 Arqueiro → A-EF 8 Cavaleiro Negro: bruto = 7×3×100/100 = 21; absorvido = 6×8×1/2 = 24; efetivo = máx(21 − 24, 21/5) = máx(-3, 21/5), piso 4; baixas = piso((4 + 5)/30) = 0; restam 8, residual 9
- D-DB 3 Arqueiro → A-DF 8 Cavaleiro Negro: bruto = 7×3×100/100 = 21; absorvido = 6×8×1/2 = 24; efetivo = máx(21 − 24, 21/5) = máx(-3, 21/5), piso 4; baixas = piso((4 + 5)/30) = 0; restam 8, residual 9
- D-CF 9 Lanceiro → A-CF 2 Cavaleiro Negro: bruto = 6×9×3/2 (contra)×100/100 = 81; absorvido = 6×2×1/2 = 6; efetivo = máx(81 − 6, 81/5) = máx(75, 81/5), piso 75; baixas = piso((75 + 9)/30) = 2; restam 0, residual 0
  - A-CF destruído: moral A −10 → 90
  - ala C do lado A caiu: moral −20 → 70

Fim da rodada 2: moral D 80, A 70; D-EB 3 (res 0), D-CF 9 (res 4), D-DB 3 (res 0), A-EF 8 (res 9), A-DF 8 (res 9)

**Rodada 3**

- A-EF 8 Cavaleiro Negro → D-EB 3 Arqueiro: bruto = 10×8×3/2 (contra)×100/100 = 120; absorvido = 2×3×1/2 = 3; efetivo = máx(120 − 3, 120/5) = máx(117, 24), piso 117; baixas = piso((117 + 0)/16) = 3; restam 0, residual 0
  - D-EB destruído: moral D −10 → 70
  - ala E do lado D caiu: moral −20 → 50
- A-DF 8 Cavaleiro Negro → D-DB 3 Arqueiro: bruto = 10×8×3/2 (contra)×100/100 = 120; absorvido = 2×3×1/2 = 3; efetivo = máx(120 − 3, 120/5) = máx(117, 24), piso 117; baixas = piso((117 + 0)/16) = 3; restam 0, residual 0
  - D-DB destruído: moral D −10 → 40
  - ala D do lado D caiu: moral −20 → 20
- D-CF 9 Lanceiro → A-EF 8 Cavaleiro Negro: bruto = 6×9×3/2 (contra)×5/4 (flanco)×100/100 = 405/4; absorvido = 6×8×1/2 = 24; efetivo = máx(405/4 − 24, 405/4/5) = máx(309/4, 81/4), piso 77; baixas = piso((77 + 9)/30) = 2; restam 6, residual 26

Fim da rodada 3: moral D = 20 ≤ 30: debandada.

**Resultado.** Debandada de D no fim da rodada 3 (moral 20), com 9 Lanceiros no Centro ainda de pé; A com 14 Cavaleiros Negros de 20 e moral 70. **Fatores decisivos:** (1) 4 Lanceiros contra 8 Cavaleiros Negros (72 efetivos por golpe contra 20 de vida): as Frentes laterais caíram na rodada 2 (−10 de moral cada) e, com as Retaguardas, as duas alas caíram na 3 (−30 cada); (2) a Retaguarda de Arqueiros ficou exposta na rodada 3 assim que a Frente caiu, e o Cavaleiro Negro contra-ataca o Arqueiro (×3/2: 117 de dano efetivo); (3) o Centro venceu o seu duelo, mas a moral é do lado, não da ala: 100 − 40 − 40 = 20 ≤ 30.

### 2.6 Doze rodadas, "Resistiu"

**Situação.** Sem muralha, só o Centro. D: 16 Escudeiros. A: 10 Cavaleiros Negros. Nenhum lado consegue acabar com o outro: o Escudeiro absorve bem (def 9) e bate pouco (atq 3), e o Cavaleiro Negro absorve bem (def 6).

**Rodada 1**

- A-CF 10 Cavaleiro Negro → D-CF 16 Escudeiro: bruto = 10×10×100/100 = 100; absorvido = 9×16×1/2 = 72; efetivo = máx(100 − 72, 100/5) = máx(28, 20), piso 28; baixas = piso((28 + 0)/30) = 0; restam 16, residual 28
- D-CF 16 Escudeiro → A-CF 10 Cavaleiro Negro: bruto = 3×16×100/100 = 48; absorvido = 6×10×1/2 = 30; efetivo = máx(48 − 30, 48/5) = máx(18, 48/5), piso 18; baixas = piso((18 + 0)/30) = 0; restam 10, residual 18

Fim da rodada 1: moral D 100, A 100; D-CF 16 (res 28), A-CF 10 (res 18)

**Rodada 2**

- A-CF 10 Cavaleiro Negro → D-CF 16 Escudeiro: bruto = 10×10×100/100 = 100; absorvido = 9×16×1/2 = 72; efetivo = máx(100 − 72, 100/5) = máx(28, 20), piso 28; baixas = piso((28 + 28)/30) = 1; restam 15, residual 26
- D-CF 15 Escudeiro → A-CF 10 Cavaleiro Negro: bruto = 3×15×100/100 = 45; absorvido = 6×10×1/2 = 30; efetivo = máx(45 − 30, 45/5) = máx(15, 9), piso 15; baixas = piso((15 + 18)/30) = 1; restam 9, residual 3

Fim da rodada 2: moral D 100, A 100; D-CF 15 (res 26), A-CF 9 (res 3)

**Rodada 3**

- A-CF 9 Cavaleiro Negro → D-CF 15 Escudeiro: bruto = 10×9×100/100 = 90; absorvido = 9×15×1/2 = 135/2; efetivo = máx(90 − 135/2, 90/5) = máx(45/2, 18), piso 22; baixas = piso((22 + 26)/30) = 1; restam 14, residual 18
- D-CF 14 Escudeiro → A-CF 9 Cavaleiro Negro: bruto = 3×14×100/100 = 42; absorvido = 6×9×1/2 = 27; efetivo = máx(42 − 27, 42/5) = máx(15, 42/5), piso 15; baixas = piso((15 + 3)/30) = 0; restam 9, residual 18

Fim da rodada 3: moral D 100, A 100; D-CF 14 (res 18), A-CF 9 (res 18)

**Rodada 4**

- A-CF 9 Cavaleiro Negro → D-CF 14 Escudeiro: bruto = 10×9×100/100 = 90; absorvido = 9×14×1/2 = 63; efetivo = máx(90 − 63, 90/5) = máx(27, 18), piso 27; baixas = piso((27 + 18)/30) = 1; restam 13, residual 15
- D-CF 13 Escudeiro → A-CF 9 Cavaleiro Negro: bruto = 3×13×100/100 = 39; absorvido = 6×9×1/2 = 27; efetivo = máx(39 − 27, 39/5) = máx(12, 39/5), piso 12; baixas = piso((12 + 18)/30) = 1; restam 8, residual 0

Fim da rodada 4: moral D 100, A 100; D-CF 13 (res 15), A-CF 8 (res 0)

**Rodada 5**

- A-CF 8 Cavaleiro Negro → D-CF 13 Escudeiro: bruto = 10×8×100/100 = 80; absorvido = 9×13×1/2 = 117/2; efetivo = máx(80 − 117/2, 80/5) = máx(43/2, 16), piso 21; baixas = piso((21 + 15)/30) = 1; restam 12, residual 6
- D-CF 12 Escudeiro → A-CF 8 Cavaleiro Negro: bruto = 3×12×100/100 = 36; absorvido = 6×8×1/2 = 24; efetivo = máx(36 − 24, 36/5) = máx(12, 36/5), piso 12; baixas = piso((12 + 0)/30) = 0; restam 8, residual 12

Fim da rodada 5: moral D 100, A 100; D-CF 12 (res 6), A-CF 8 (res 12)

**Rodada 6**

- A-CF 8 Cavaleiro Negro → D-CF 12 Escudeiro: bruto = 10×8×100/100 = 80; absorvido = 9×12×1/2 = 54; efetivo = máx(80 − 54, 80/5) = máx(26, 16), piso 26; baixas = piso((26 + 6)/30) = 1; restam 11, residual 2
- D-CF 11 Escudeiro → A-CF 8 Cavaleiro Negro: bruto = 3×11×100/100 = 33; absorvido = 6×8×1/2 = 24; efetivo = máx(33 − 24, 33/5) = máx(9, 33/5), piso 9; baixas = piso((9 + 12)/30) = 0; restam 8, residual 21

Fim da rodada 6: moral D 100, A 100; D-CF 11 (res 2), A-CF 8 (res 21)

**Rodada 7**

- A-CF 8 Cavaleiro Negro → D-CF 11 Escudeiro: bruto = 10×8×100/100 = 80; absorvido = 9×11×1/2 = 99/2; efetivo = máx(80 − 99/2, 80/5) = máx(61/2, 16), piso 30; baixas = piso((30 + 2)/30) = 1; restam 10, residual 2
- D-CF 10 Escudeiro → A-CF 8 Cavaleiro Negro: bruto = 3×10×100/100 = 30; absorvido = 6×8×1/2 = 24; efetivo = máx(30 − 24, 30/5) = máx(6, 6), piso 6; baixas = piso((6 + 21)/30) = 0; restam 8, residual 27

Fim da rodada 7: moral D 100, A 100; D-CF 10 (res 2), A-CF 8 (res 27)

**Rodada 8**

- A-CF 8 Cavaleiro Negro → D-CF 10 Escudeiro: bruto = 10×8×100/100 = 80; absorvido = 9×10×1/2 = 45; efetivo = máx(80 − 45, 80/5) = máx(35, 16), piso 35; baixas = piso((35 + 2)/30) = 1; restam 9, residual 7
- D-CF 9 Escudeiro → A-CF 8 Cavaleiro Negro: bruto = 3×9×100/100 = 27; absorvido = 6×8×1/2 = 24; efetivo = máx(27 − 24, 27/5) = máx(3, 27/5), piso 5; baixas = piso((5 + 27)/30) = 1; restam 7, residual 2

Fim da rodada 8: moral D 100, A 100; D-CF 9 (res 7), A-CF 7 (res 2)

**Rodada 9**

- A-CF 7 Cavaleiro Negro → D-CF 9 Escudeiro: bruto = 10×7×100/100 = 70; absorvido = 9×9×1/2 = 81/2; efetivo = máx(70 − 81/2, 70/5) = máx(59/2, 14), piso 29; baixas = piso((29 + 7)/30) = 1; restam 8, residual 6
- D-CF 8 Escudeiro → A-CF 7 Cavaleiro Negro: bruto = 3×8×100/100 = 24; absorvido = 6×7×1/2 = 21; efetivo = máx(24 − 21, 24/5) = máx(3, 24/5), piso 4; baixas = piso((4 + 2)/30) = 0; restam 7, residual 6

Fim da rodada 9: moral D 100, A 100; D-CF 8 (res 6), A-CF 7 (res 6)

**Rodada 10**

- A-CF 7 Cavaleiro Negro → D-CF 8 Escudeiro: bruto = 10×7×100/100 = 70; absorvido = 9×8×1/2 = 36; efetivo = máx(70 − 36, 70/5) = máx(34, 14), piso 34; baixas = piso((34 + 6)/30) = 1; restam 7, residual 10
- D-CF 7 Escudeiro → A-CF 7 Cavaleiro Negro: bruto = 3×7×100/100 = 21; absorvido = 6×7×1/2 = 21; efetivo = máx(21 − 21, 21/5) = máx(0, 21/5), piso 4; baixas = piso((4 + 6)/30) = 0; restam 7, residual 10

Fim da rodada 10: moral D 100, A 100; D-CF 7 (res 10), A-CF 7 (res 10)

**Rodada 11**

- A-CF 7 Cavaleiro Negro → D-CF 7 Escudeiro: bruto = 10×7×100/100 = 70; absorvido = 9×7×1/2 = 63/2; efetivo = máx(70 − 63/2, 70/5) = máx(77/2, 14), piso 38; baixas = piso((38 + 10)/30) = 1; restam 6, residual 18
- D-CF 6 Escudeiro → A-CF 7 Cavaleiro Negro: bruto = 3×6×100/100 = 18; absorvido = 6×7×1/2 = 21; efetivo = máx(18 − 21, 18/5) = máx(-3, 18/5), piso 3; baixas = piso((3 + 10)/30) = 0; restam 7, residual 13

Fim da rodada 11: moral D 100, A 100; D-CF 6 (res 18), A-CF 7 (res 13)

**Rodada 12**

- A-CF 7 Cavaleiro Negro → D-CF 6 Escudeiro: bruto = 10×7×100/100 = 70; absorvido = 9×6×1/2 = 27; efetivo = máx(70 − 27, 70/5) = máx(43, 14), piso 43; baixas = piso((43 + 18)/30) = 2; restam 4, residual 1
- D-CF 4 Escudeiro → A-CF 7 Cavaleiro Negro: bruto = 3×4×100/100 = 12; absorvido = 6×7×1/2 = 21; efetivo = máx(12 − 21, 12/5) = máx(-9, 12/5), piso 2; baixas = piso((2 + 13)/30) = 0; restam 7, residual 15

Fim da rodada 12: moral D 100, A 100; D-CF 4 (res 1), A-CF 7 (res 15)

**Resultado.** Fim das 12 rodadas, os dois lados de pé: D 4 Escudeiros, A 7 Cavaleiros Negros; em defesa é **"Resistiu"**, vitória do defensor; moral 100 e 100. **Fatores decisivos:** (1) a defesa 9 dos 16 Escudeiros engole 72 dos 100 de bruto do inimigo e passam 28 por rodada; (2) a defesa 6 dos Cavaleiros Negros engole 30 dos 48 dos Escudeiros e passam 18; (3) o residual: a rodada 1 não mata ninguém, e os 28 e os 18 ficam guardados e completam as baixas das rodadas seguintes.

### 2.7 Senhor da Guerra

**Situação.** Sem muralha. D: 10 Cavaleiros em cada ala (E, C, D). A: 10 Saqueadores na ala E, o Senhor da Guerra (atq 18, def 8, vida 200, inic 4) no Centro e 10 Saqueadores na ala D. A aura do chefe, **×5/4 para toda a Horda** (inclusive ele; ver D-4), vale desde a primeira rodada. Cavaleiro: 10, 6, 30, inic 5.

**Rodada 1**

- D-EF 10 Cavaleiro → A-EF 10 Saqueador: bruto = 10×10×100/100 = 100; absorvido = 3×10×1/2 = 15; efetivo = máx(100 − 15, 100/5) = máx(85, 20), piso 85; baixas = piso((85 + 0)/18) = 4; restam 6, residual 13
- D-CF 10 Cavaleiro → A-CF 1 Senhor da Guerra: bruto = 10×10×100/100 = 100; absorvido = 8×1×1/2 = 4; efetivo = máx(100 − 4, 100/5) = máx(96, 20), piso 96; baixas = piso((96 + 0)/200) = 0; restam 1, residual 96
- D-DF 10 Cavaleiro → A-DF 10 Saqueador: bruto = 10×10×100/100 = 100; absorvido = 3×10×1/2 = 15; efetivo = máx(100 − 15, 100/5) = máx(85, 20), piso 85; baixas = piso((85 + 0)/18) = 4; restam 6, residual 13
- A-CF 1 Senhor da Guerra → D-CF 10 Cavaleiro: bruto = 18×1×5/4 (aura)×100/100 = 45/2; absorvido = 6×10×1/2 = 30; efetivo = máx(45/2 − 30, 45/2/5) = máx(-15/2, 9/2), piso 4; baixas = piso((4 + 0)/30) = 0; restam 10, residual 4
- A-EF 6 Saqueador → D-EF 10 Cavaleiro: bruto = 6×6×5/4 (aura)×100/100 = 45; absorvido = 6×10×1/2 = 30; efetivo = máx(45 − 30, 45/5) = máx(15, 9), piso 15; baixas = piso((15 + 0)/30) = 0; restam 10, residual 15
- A-DF 6 Saqueador → D-DF 10 Cavaleiro: bruto = 6×6×5/4 (aura)×100/100 = 45; absorvido = 6×10×1/2 = 30; efetivo = máx(45 − 30, 45/5) = máx(15, 9), piso 15; baixas = piso((15 + 0)/30) = 0; restam 10, residual 15

Fim da rodada 1: moral D 100, A 100; D-EF 10 (res 15), D-CF 10 (res 4), D-DF 10 (res 15), A-EF 6 (res 13), A-CF 1 (res 96), A-DF 6 (res 13)

**Rodada 2**

- D-EF 10 Cavaleiro → A-EF 6 Saqueador: bruto = 10×10×100/100 = 100; absorvido = 3×6×1/2 = 9; efetivo = máx(100 − 9, 100/5) = máx(91, 20), piso 91; baixas = piso((91 + 13)/18) = 5; restam 1, residual 14
- D-CF 10 Cavaleiro → A-CF 1 Senhor da Guerra: bruto = 10×10×100/100 = 100; absorvido = 8×1×1/2 = 4; efetivo = máx(100 − 4, 100/5) = máx(96, 20), piso 96; baixas = piso((96 + 96)/200) = 0; restam 1, residual 192
- D-DF 10 Cavaleiro → A-DF 6 Saqueador: bruto = 10×10×100/100 = 100; absorvido = 3×6×1/2 = 9; efetivo = máx(100 − 9, 100/5) = máx(91, 20), piso 91; baixas = piso((91 + 13)/18) = 5; restam 1, residual 14
- A-CF 1 Senhor da Guerra → D-CF 10 Cavaleiro: bruto = 18×1×5/4 (aura)×100/100 = 45/2; absorvido = 6×10×1/2 = 30; efetivo = máx(45/2 − 30, 45/2/5) = máx(-15/2, 9/2), piso 4; baixas = piso((4 + 4)/30) = 0; restam 10, residual 8
- A-EF 1 Saqueador → D-EF 10 Cavaleiro: bruto = 6×1×5/4 (aura)×100/100 = 15/2; absorvido = 6×10×1/2 = 30; efetivo = máx(15/2 − 30, 15/2/5) = máx(-45/2, 3/2), piso 1; baixas = piso((1 + 15)/30) = 0; restam 10, residual 16
- A-DF 1 Saqueador → D-DF 10 Cavaleiro: bruto = 6×1×5/4 (aura)×100/100 = 15/2; absorvido = 6×10×1/2 = 30; efetivo = máx(15/2 − 30, 15/2/5) = máx(-45/2, 3/2), piso 1; baixas = piso((1 + 15)/30) = 0; restam 10, residual 16

Fim da rodada 2: moral D 100, A 100; D-EF 10 (res 16), D-CF 10 (res 8), D-DF 10 (res 16), A-EF 1 (res 14), A-CF 1 (res 192), A-DF 1 (res 14)

**Rodada 3**

- D-EF 10 Cavaleiro → A-EF 1 Saqueador: bruto = 10×10×100/100 = 100; absorvido = 3×1×1/2 = 3/2; efetivo = máx(100 − 3/2, 100/5) = máx(197/2, 20), piso 98; baixas = piso((98 + 14)/18) = 1; restam 0, residual 0
  - A-EF destruído: moral A −10 → 90
  - ala E do lado A caiu: moral −20 → 70
- D-CF 10 Cavaleiro → A-CF 1 Senhor da Guerra: bruto = 10×10×100/100 = 100; absorvido = 8×1×1/2 = 4; efetivo = máx(100 − 4, 100/5) = máx(96, 20), piso 96; baixas = piso((96 + 192)/200) = 1; restam 0, residual 0
  - A-CF destruído: moral A −10 → 60
  - ala C do lado A caiu: moral −20 → 40
  - o Senhor da Guerra caiu: a onda termina

**Resultado.** O Senhor da Guerra cai na rodada 3 e **encerra a onda** na hora: a Horda ainda tem 1 Saqueador (ala D); D não perdeu soldado nenhum. **Fatores decisivos:** (1) o chefe morre antes de a moral entrar: 96 efetivos por rodada (residual 96, 192) e a baixa na rodada 3, contra os 200 de vida; (2) a aura ×5/4 do chefe não bastou: 45 de bruto contra 30 absorvidos pela defesa 6 de dez Cavaleiros; (3) a iniciativa 5 dos Cavaleiros contra 4 e 3 faz D bater primeiro: a Horda cai de 10 para 6 e 1 Saqueador por ala, e o golpe do que sobra rende 15/2 de bruto, que o mínimo de 1/5 reduz a 1.

## 4. Lote 2 do Conselho: primeiro lote de cinco (para o autor)

**Lido pelo autor em 2026-10-23** (V4H-T1.3; decisão 23: as cartas são apresentadas em lotes de cinco). **Aprovadas como estão:** a cadeia "Os Refugiados" (4.1 a 4.3) e "Praga nos campos" (4.4). **Sai do lote:** "O aprendiz e o Mestre" (4.5), porque o Mestre ensinar o ofício ainda é mecânica proibida (CLAUDE.md, regra 6); a próxima carta da lista entra no lugar e volta ao autor no próximo lote. Nada disto está no código ainda. O ponto de partida foi o branch `wip/v3f-t1-lote2` (`2352e39`, `refugees.ts`), reescrito: a cadeia agora dá **Gil ou Ximena** conforme o que o jogador fez na primeira carta, e as flags e os números foram conferidos contra `balance.ts` e as cartas do lote 1.

**Por que estas cinco.** Formam a trilha "gente que chega e o que ela sabe fazer": a cadeia completa "Os Refugiados" (3 cartas), que dá origem aos Mestres Gil e Ximena, a "Praga nos campos" (a primeira carta com risco à vista e opção extra por classe) e "O aprendiz e o Mestre" (a primeira que só aparece com um Mestre no feudo). Juntas pedem os ganchos de motor mais baratos do lote: `addMaster`, `rollEffect`, `heroClass` (na opção e no alívio do risco), o requisito de carta `minMasters` e o efeito `craftExperience`.

**Convenções.** Dias são dias de jogo; o prazo de resposta é o de sempre (24 h reais). Ids de carta e de opção são estáveis e em inglês; os ids dos Mestres (`gil`, `ximena`) já existem em `masters.ts`. "Autoaplica" é a opção que o conselho aplica sozinho se o prazo passar (`autoResolve`). Tamanhos de efeito seguem as cartas do lote 1: moral de ±5 a ±10 por 2 a 4 dias, comida de 30 a 90, ouro de 30 a 120. As frases de prazo vencido só existem onde a opção é a que o conselho aplica sozinho.

### 4.1 Refugiados nos portões (`refugeesAtGates`, cadeia 1/3)

| Campo | Valor |
|---|---|
| Quando | Sorteada, peso 2. Dia de jogo 20 ou mais; primavera, verão ou outono. Sem as flags `refugees.open` e `refugees.settled`, e **não** depois de "Mais bocas à mesa" (`routine.moreMouths`) |
| Exclusão | Nunca com a cadeia aberta, e nunca depois de um Mestre ter chegado por ela (`refugees.settled`) |
| Texto | "Uma dúzia de famílias chegou pela estrada do sul, com carroças vazias e crianças no colo. Dizem que a enchente levou a aldeia delas. Pedem um canto para atravessar a estação, e a despensa do feudo terá de dar para todos." |

| Opção | Texto e efeitos | Hint | Autoaplica |
|---|---|---|---|
| `shelter` "Abrigar as famílias" | Pede 150 de comida em estoque; custo 60 de comida. Moral +5 por 2 dias; flags `refugees.open` e `refugees.sheltered`; a carta 2 chega em 3 dias | "Quem recebe teto na hora ruim lembra do feudo na hora boa." | |
| `provide` "Dar provisões para a estrada" | Custo 30 de comida. Flags `refugees.open` e `refugees.provisioned`; a carta 2 chega em 4 dias | "Eles seguem viagem de barriga cheia, e a estrada dá voltas." | |
| `refuse` "Fechar os portões" | Sem efeito | "Nada se gasta, e as famílias procuram outro feudo." | as três dificuldades |

Crônica (`shelter`): "No {dia}º dia {daEstacao}, o senhor de {feudo} abriu os portões aos refugiados da enchente. Houve palha nova nos celeiros e caldo para todos."
Crônica (`provide`): "No {dia}º dia {daEstacao}, o senhor de {feudo} mandou encher as carroças dos refugiados com pão e nabos. Eles seguiram para o norte ao amanhecer."
Crônica (`refuse`): "No {dia}º dia {daEstacao}, o senhor de {feudo} manteve os portões fechados. Os refugiados seguiram pela estrada sem olhar para trás." Prazo vencido: "No {dia}º dia {daEstacao}, sem palavra do senhor, os portões de {feudo} ficaram fechados. Os refugiados seguiram pela estrada sem olhar para trás."

**O motor precisará:** nada novo (`scheduleCard`, flags e custo existem; `routine.moreMouths` é do lote 1).

### 4.2 O retorno dos refugiados (`refugeesReturn`, cadeia 2/3)

| Campo | Valor |
|---|---|
| Quando | Só por continuação (peso 0), 3 ou 4 dias depois, conforme a escolha da carta 1 |
| Variante de texto por flag | `refugees.sheltered`: as famílias abrigadas voltam. `refugees.provisioned`: as que partiram com o pão voltam |
| Quem chega | **Sheltered: Gil**, carpinteiro de ribeira. **Provisioned: Ximena**, mineira dos veios fundos. A origem é só narrativa; o bônus vale em qualquer edifício |

Texto (sheltered): "As famílias que o feudo abrigou foram ver o que restava da aldeia e voltaram: não restava nada. Pedem para ficar de vez. Entre elas vem Gil, carpinteiro de ribeira, que promete pagar o teto com o ofício."
Texto (provisioned): "As famílias que partiram com o pão do feudo acharam as outras portas fechadas e voltaram. Pedem para ficar de vez. Entre elas vem Ximena, mineira dos veios fundos, que promete pagar o teto com o ofício."

| Opção | Texto e efeitos | Hint | Autoaplica |
|---|---|---|---|
| `welcome` "Acolher quem voltou" | Custo 40 de comida. **O Mestre chega** (Gil ou Ximena, pela variante; entra se houver vaga nas casas, espera à porta se não). Moral +5 por 2 dias; flags `refugees.welcomed` e `refugees.settled`; a carta 3 chega em 2 dias | "Um Mestre fica para sempre e precisa de uma casa com vaga." | |
| `lodge` "Emprestar o celeiro por umas noites" | Sem custo. Flag `refugees.passing`; a carta 3 chega em 2 dias. **Ninguém chega ainda** | "Ninguém é mandado embora hoje, e a decisão fica para depois." | Camponês e Senhor |
| `dismiss` "Mandar seguir viagem" | Moral −5 por 2 dias; +30 de madeira (a lenha das carroças); a cadeia se fecha (limpa `refugees.open`, `sheltered` e `provisioned`). **Nenhum Mestre** | "Eles deixam a lenha das carroças em paga, e o feudo os vê partir." | Rei de Ferro |

Crônica (`welcome`, sheltered): "No {dia}º dia {daEstacao}, o senhor de {feudo} acolheu de vez as famílias da enchente. O carpinteiro Gil já media as vigas do salão com o palmo."
Crônica (`welcome`, provisioned): "No {dia}º dia {daEstacao}, o senhor de {feudo} acolheu de vez as famílias da enchente. A mineira Ximena já espiava o chão do feudo, em busca de veio."
Crônica (`lodge`): "No {dia}º dia {daEstacao}, o senhor de {feudo} emprestou o celeiro às famílias da enchente por umas noites." Prazo vencido: "No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} emprestou o celeiro às famílias da enchente por umas noites."
Crônica (`dismiss`): "No {dia}º dia {daEstacao}, o senhor de {feudo} mandou as famílias da enchente seguirem viagem. Deixaram a lenha das carroças e levaram o ofício que traziam." Prazo vencido: "No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} mandou as famílias da enchente seguirem viagem. Deixaram a lenha das carroças e levaram o ofício que traziam."

**O motor precisará:** `addMaster { masterId }` (novo; chama `deliverMaster`, que já existe) e **uma forma de escolher o Mestre pela variante**: ou duas opções `welcome` por flag, ou `addMaster` com `masterIdByFlag`. É decisão de motor; o texto vale nas duas.

### 4.3 O ofício que eles trouxeram (`refugeesCraft`, cadeia 3/3)

| Campo | Valor |
|---|---|
| Quando | Só por continuação, 2 dias depois da carta 2 |
| Variantes de texto | Sem flag (`refugees.welcomed`): o Mestre já chegou e pede um lugar para trabalhar. `refugees.passing`: as noites emprestadas acabaram e o Mestre oferece ficar (Gil, se a carta 1 foi `shelter`; Ximena, se foi `provide`) |

Texto (`welcomed`): "As famílias da enchente já ajudam na lida, e o Mestre que chegou com elas pede o que um mestre pede: um lugar de verdade para trabalhar. Diz que um feudo com ofício e sem bancada perde metade do que faz. O conselho quer saber se a bancada sai."
Texto (`passing`): "As noites emprestadas acabaram, e as famílias da enchente arrumam as carroças. O mestre entre elas oferece ficar, se o feudo lhe der madeira para uma bancada. O conselho quer saber se a bancada sai."

| Opção | Texto e efeitos | Hint | Autoaplica |
|---|---|---|---|
| `workshop` "Erguer a bancada" | Custo 50 de madeira. **Com `passing`: o Mestre chega agora.** Com `welcomed` ele já está. Moral +10 por 2 dias; flag `refugees.settled`; limpa as flags transitórias | "Com a bancada o mestre fica, e quem veio com ele trabalha contente." | |
| `thank` "Agradecer e deixar como está" | Sem custo. Limpa as flags transitórias. Com `welcomed` o Mestre já ficou; com `passing` ninguém chega e a cadeia termina | "Nada se gasta: quem já ficou continua, e quem estava de passagem segue viagem." | Camponês e Senhor |
| `charge` "Cobrar a hospedagem" | +30 de ouro; moral −5 por 2 dias; limpa as flags transitórias. Mesmo efeito de `thank` sobre o Mestre | "As moedas entram, e o feudo comenta o preço de um teto." | Rei de Ferro |

Crônica (`workshop`): "No {dia}º dia {daEstacao}, o senhor de {feudo} mandou erguer a bancada do mestre da enchente. As famílias já não falam em partir."
Crônica (`thank`): "No {dia}º dia {daEstacao}, o senhor de {feudo} agradeceu a oferta do mestre e guardou a madeira para as obras." Prazo vencido: "No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} agradeceu a oferta do mestre e guardou a madeira para as obras."
Crônica (`charge`): "No {dia}º dia {daEstacao}, o senhor de {feudo} cobrou das famílias da enchente as noites de teto. Pagaram em moedas miúdas, sem dizer palavra." Prazo vencido: "No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} cobrou das famílias da enchente as noites de teto. Pagaram em moedas miúdas, sem dizer palavra."

**O motor precisará:** `addMaster` (o mesmo de 4.2) e texto variante por flag (existe). **Mudança em relação ao branch antigo:** lá o Mestre podia ser entregue nas duas cartas; aqui ele chega **uma só vez**: na carta 2 se acolhido, na 3 se emprestado.

### 4.4 Praga nos campos (`fieldBlight`, avulsa)

| Campo | Valor |
|---|---|
| Quando | Sorteada, peso 2, uma vez por ano. Verão, com mais de 200 de comida estocada |
| Texto | "As folhas do trigo amarelam de ponta a ponta, e o cheiro de mofo chega até o portão. Os velhos dizem que a praga se espalha rápido e que a hora de decidir é agora. A despensa depende da colheita." |

| Opção | Texto e efeitos | Hint | Autoaplica |
|---|---|---|---|
| `burn` "Queimar a plantação" | Perde 30% da comida estocada, na hora; moral −5 por 2 dias; sem efeito futuro | "A fumaça sobe cedo. O que resta fica a salvo." | Rei de Ferro |
| `pray` "Rezar e esperar" | **Risco à vista, sorteado na virada de dia seguinte** (nunca no comando): 1 chance em 2 de perder 50% da comida estocada; **com uma Clériga no feudo, 1 em 5**. Se a praga cede, moral +5 por 2 dias | "Fé não se mede em sacos. Uma Clériga costuma acalmar o campo." | Camponês e Senhor |
| `alchemist` "Pagar o alquimista" | Custo 120 de ouro. Nenhuma perda | "Ouro rende pó de cal e fé, nessa ordem." | |

Crônica (`burn`): "No {dia}º dia {daEstacao}, o senhor de {feudo} mandou queimar o trigo doente. A fumaça cobriu o vale até o meio-dia." Prazo vencido: "No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} mandou queimar o trigo doente. A fumaça cobriu o vale até o meio-dia."
Crônica (`alchemist`): "No {dia}º dia {daEstacao}, o senhor de {feudo} pagou ao alquimista para tratar os campos. O homem espalhou cal e disse palavras demoradas."
Crônica (`pray`, escolha): "No {dia}º dia {daEstacao}, o senhor de {feudo} mandou rezar nos campos e esperar." Prazo vencido: "No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} mandou rezar nos campos e esperar."
Crônica (desfecho ruim, na virada seguinte): "No {dia}º dia {daEstacao}, a praga levou metade do que {feudo} guardava nos celeiros."
Crônica (desfecho bom, na virada seguinte): "No {dia}º dia {daEstacao}, a praga cedeu sozinha. O povo de {feudo} diz que foi a reza."

**O motor precisará:** `rollEffect` (novo: a opção grava o risco, e o sorteio acontece na virada de dia seguinte, no fluxo `council`), um efeito de recurso **percentual** (hoje `resources` é em unidades; propor `resourcesPercent` calculado sobre o estoque no instante), `heroClass: 'cleric'` no alívio da chance (conta herói em expedição, não conta o capturado; decisão 19). `heroClass` como requisito de opção não é usado nesta carta.

### 4.5 O aprendiz e o Mestre (`masterApprentice`, avulsa) — **fora do lote, por decisão do autor (2026-10-23)**

| Campo | Valor |
|---|---|
| Quando | Sorteada, peso 2, uma vez por ano. Só com ao menos um Mestre no feudo (já trabalhando; não conta quem espera à porta) |
| Texto | "Um rapaz do feudo anda atrás do Mestre {mestre} desde o raiar do sol, com o avental torto e as mãos abertas. O Mestre diz que ensina, se o feudo suportar uma tarde de produção a menos. O rapaz promete que não erra mais de três vezes." |

| Opção | Texto e efeitos | Hint | Autoaplica |
|---|---|---|---|
| `teach` "Deixar o Mestre ensinar" | Custo 30 de ouro (a tarde parada). O edifício do Mestre ganha 20 pontos de experiência do ofício (o máximo é 100; hoje o ofício ganha 4 por dia). Moral +5 por 3 dias | "Ofício ensinado vale mais que a tarde que se perdeu." | |
| `keep` "Manter a produção" | Sem efeito | "O rapaz volta amanhã, e o Mestre também." | as três dificuldades |

Crônica (`teach`): "No {dia}º dia {daEstacao}, o Mestre {mestre} passou a tarde ensinando um rapaz de {feudo}. O aprendiz errou três vezes, como prometeu."
Crônica (`keep`): "No {dia}º dia {daEstacao}, o Mestre {mestre} seguiu no trabalho, e o rapaz foi mandado de volta ao campo." Prazo vencido: "No {dia}º dia {daEstacao}, sem palavra do senhor, o Mestre {mestre} seguiu no trabalho, e o rapaz voltou ao campo."

**O motor precisará:** requisito de carta `minMasters` (o branch antigo já tinha o tipo), a lacuna `{mestre}` no texto e na Crônica (o motor escolhe um dos Mestres que trabalham) e um efeito novo `craftExperience` sobre o edifício desse Mestre.

### 4.6 O que fica para os próximos lotes (3 cartas)

Ordem proposta: cada lote de cinco fecha uma ideia, e o último tem três. **O lote B (cartas 6 a 10) está na seção 5, aprovado. Os lotes C (cartas 11 a 15) e D (cartas 16 a 20) estão nas seções 6 e 7, para o autor ler.** Resta o lote E, abaixo. O "aprendiz e o Mestre" (4.5) volta à lista quando o Mestre puder ensinar o ofício.

**Lote E, o que sobra e a roteirizada (3).**

- 21. O curandeiro errante (avulsa): pagar pela cura de um herói ferido ou esperar. Pede `injuredHero`.
- 22. O mapa rasgado (avulsa): comprar meio mapa, que revela um destino mais cedo. Pede Guilda e `revealDestination`.
- 23. O mercador itinerante (roteirizada, dia 20 do ano 1): trocar excedente por ouro uma vez, a preço ruim, ou esperar ter o Mercado. Sai por `scripted`; prepara o Mercado.

A "Estrangeira ferida", roteirizada, já está no jogo desde a v0.3. Com as quatro aprovadas da seção 4, as cinco da seção 5, as dez das seções 6 e 7 e as 3 acima, são 22 das 23 do roadmap da v0.4 (as 24 da v0.3 menos ela); a 23ª é o aprendiz (4.5), que espera o Mestre poder ensinar.

## 5. Lote 2 do Conselho: segundo lote de cinco (para o autor)

**Lido e aprovado pelo autor em 2026-10-23, as cinco como estão** (decisão 23), inclusive o efeito de carta sobre o preço do Mercado (`marketPrice`, da V4H-T1) e a revelação de destino.

**Para leitura do autor** (V4H-T1.3; decisão 23). Nada disto está no código ainda. É o lote B da lista da 4.6: a cadeia "O Mercador Misterioso" (3 cartas) e as duas cartas que mexem no preço do Mercado ("Boicote dos mercadores" e "A caravana real"). **Nenhuma das quatro primeiras da lista foi pulada**, e a quinta é a próxima da lista (a 10, "A caravana real"), no lugar do aprendiz. Nenhuma depende de mecânica proibida pelo CLAUDE.md (regra 6): `marketPrice` (os efeitos de carta sobre o preço, `market.effects`) é justamente a mecânica da V4H-T1 que este lote pede, e `revealDestination` só liga uma entrada que o motor já tem (`map.discovered`, a mesma que a Patrulha e a Floresta Antiga usam para revelar as Ruínas e a Mina Abandonada). Se o autor não quiser que a V4H-T1 crie `market.effects`, as cartas 5.4 e 5.5 saem do lote, e a 5.1 perde só a alta de 20% nos preços (a opção `imprison` continuaria com ouro e moral).

**Por que estas cinco.** Fecham a ideia "o Mercado também tem política": um forasteiro que vende um mapa, a vingança ou a paz com os mercadores, e dois choques de preço que o jogador pode aproveitar ou aguentar. Pedem três ganchos de motor: `revealDestination`, `marketPrice` e dois requisitos pequenos (`undiscovered` na carta e na opção, e `flags` na opção).

**Convenções.** As da seção 4: dias de jogo, prazo de 24 h reais, ids estáveis em inglês, "Autoaplica" é o que o conselho faz se o prazo passar, tamanhos de efeito como os do lote 1 (moral de ±5 a ±10 por 2 a 4 dias, comida de 30 a 90, ouro de 30 a 120). Números conferidos contra `balance.ts`: o Mercado vai de Nv1 a Nv5; o passeio fica entre 60% e 160% da base, e a venda a 85%. `marketPrice` multiplica o preço **exibido** (compra e venda) sem alterar o passeio (GDD §5.9), de modo que a alta de preço não abre arbitragem (a venda a 85% da compra continua valendo). Flags da cadeia: `merchant.map`, `merchant.hostile`, `merchant.lead`, `merchant.sold`.

### 5.1 O Mercador Misterioso (`mysteriousMerchant`, cadeia 1/3)

| Campo | Valor |
|---|---|
| Quando | Sorteada, peso 2, uma vez por ano. Verão; Mercado Nv1 e Guilda Nv1; as Ruínas de Vel'Thar ainda não reveladas; sem as flags `merchant.map` e `merchant.hostile` |
| Texto | "Um forasteiro de capa verde armou banca à beira do Mercado sem pedir licença. Vende pouca coisa e promete muito: diz ter um mapa da serra, desenhado por alguém que voltou de lá. Os guardas olham para ele com desconfiança, e ele olha para a bolsa do senhor." |

| Opção | Texto e efeitos | Hint | Autoaplica |
|---|---|---|---|
| `buy` "Comprar o mapa" | Pede 80 de ouro em estoque; custo 80 de ouro. **Revela as Ruínas de Vel'Thar** como destino da Guilda. Flag `merchant.map`; a carta 2 chega em 4 dias | "O mapa é bom ou é desenho de bêbado, e o feudo só saberá depois." | |
| `imprison` "Prender o forasteiro" | +50 de ouro (o que ele carregava); moral −10 por 2 dias; **os preços do Mercado sobem 20% por 2 dias** (os quatro recursos). Flag `merchant.hostile`; a carta 2 chega em 3 dias | "A bolsa dele paga a cela, e os mercadores da estrada não esquecem." | Rei de Ferro |
| `refuse` "Mandar o homem embora" | Sem efeito | "Quem vende mapa a estranhos pode ter vendido o mesmo a outros." | Camponês e Senhor |

Crônica (`buy`): "No {dia}º dia {daEstacao}, o senhor de {feudo} comprou um mapa do forasteiro de capa verde. A tinta ainda cheirava a fumaça."
Crônica (`imprison`): "No {dia}º dia {daEstacao}, o senhor de {feudo} mandou prender o mercador de capa verde. Os preços da praça subiram no mesmo dia." Prazo vencido: "No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} mandou prender o mercador de capa verde. Os preços da praça subiram no mesmo dia."
Crônica (`refuse`): "No {dia}º dia {daEstacao}, o senhor de {feudo} mandou o mercador de capa verde embora. Ele dobrou a banca sem reclamar." Prazo vencido: "No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} mandou o mercador de capa verde embora. Ele dobrou a banca sem reclamar."

**O motor precisará:** `revealDestination { modelId }` (novo: acrescenta o modelo a `map.discovered`, como a recompensa `reveals` de uma expedição já faz), `marketPrice` (novo, em 5.6), requisito de carta `undiscovered` (novo: o destino ainda não está em `map.discovered`) e `buildings: { market: 1, guild: 1 }` (existe).

### 5.2 O que o mapa mostrava (`merchantLead`, cadeia 2/3)

| Campo | Valor |
|---|---|
| Quando | Só por continuação (peso 0), 4 dias depois de `buy` ou 3 dias depois de `imprison` |
| Variante de texto por flag | `merchant.map`: o mapa tem uma marca que ninguém entende. `merchant.hostile`: a resposta dos mercadores, depois da prisão |

Texto (`merchant.map`): "O mapa do forasteiro era verdadeiro, e mais: no canto dele há uma marca a carvão, um traço para além das Ruínas, e um homem do Mercado jura que já viu aquele traço num livro de contas. Seguir a marca dá trabalho. Vendê-la a quem a procura dá ouro."
Texto (`merchant.hostile`): "O mercador preso escapou na calada da noite e deixou para trás o livro de contas, com uma rota riscada a tinta. Os companheiros dele rondam o Mercado, calados. Seguir a rota dá trabalho. Vender o livro a quem o procura dá ouro."

| Opção | Texto e efeitos | Hint | Autoaplica |
|---|---|---|---|
| `follow` "Seguir a pista" | Custo 40 de comida (as provisões dos batedores); +90 de ouro. Moral +5 por 2 dias; flag `merchant.lead`; limpa `merchant.map`; a carta 3 chega em 3 dias | "A pista vale ouro e traz companhia." | |
| `sell` "Vender a informação" | +120 de ouro; moral −5 por 2 dias (o povo estranha vender o segredo do feudo); flag `merchant.sold`; limpa `merchant.map`; a carta 3 chega em 3 dias | "Mais moedas hoje, e um comprador que volta amanhã." | Rei de Ferro |
| `drop` "Deixar o assunto de lado" | Sem efeito; limpa `merchant.map`; **a cadeia termina aqui** (`merchant.hostile`, se houver, continua gravada) | "Nem toda pista precisa ser seguida." | Camponês e Senhor |

Crônica (`follow`): "No {dia}º dia {daEstacao}, o senhor de {feudo} mandou seguir a marca do mercador. Os batedores voltaram com lama até os joelhos e com uma história para contar."
Crônica (`sell`): "No {dia}º dia {daEstacao}, o senhor de {feudo} vendeu a pista do mercador a quem a procurava. O comprador pagou em moedas miúdas e saiu sem se despedir." Prazo vencido: "No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} vendeu a pista do mercador a quem a procurava. O comprador pagou em moedas miúdas e saiu sem se despedir."
Crônica (`drop`): "No {dia}º dia {daEstacao}, o senhor de {feudo} deixou a pista do mercador de lado. O mapa foi dobrado e guardado numa arca." Prazo vencido: "No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} deixou a pista do mercador de lado. O mapa foi dobrado e guardado numa arca."

**O motor precisará:** nada novo (continuação, texto por flag, custo e ouro existem). O efeito das opções é o mesmo nas duas variantes: só o texto muda.

### 5.3 A última oferta do mercador (`merchantFinalOffer`, cadeia 3/3)

| Campo | Valor |
|---|---|
| Quando | Só por continuação, 3 dias depois da carta 2 (`follow` ou `sell`) |
| Variante de texto por flag | `merchant.lead`: o dono do mapa volta. `merchant.sold`: o comprador volta |

Texto (`merchant.lead`): "A pista deu em um depósito de caravana esquecido, e o homem de capa verde reaparece na praça com um sorriso de quem sabia. Propõe fechar as contas: uma bolsa pelo que os batedores acharam, ou um último mapa em troca de um favor. O conselho quer saber o que o senhor responde."
Texto (`merchant.sold`): "O comprador da pista voltou à praça com a bolsa leve e a conversa mansa. Diz que a informação valia mais do que pagou, e que está disposto a compensar, de um modo ou de outro. O conselho quer saber o que o senhor responde."

| Opção | Texto e efeitos | Hint | Autoaplica |
|---|---|---|---|
| `profit` "Fechar com lucro" | +100 de ouro. Limpa `merchant.lead` e `merchant.sold`; a cadeia termina | "Dinheiro na mão e conta fechada." | as três dificuldades |
| `destination` "Pedir o último mapa" | Pede a Guilda Nv2 e a Mina Abandonada ainda não revelada; custo 50 de ouro. **Revela a Mina Abandonada** como destino. Limpa `merchant.lead` e `merchant.sold` | "A serra tem mais de um segredo, e este tem ferro." | |
| `peace` "Fazer as pazes com os mercadores" | **Só aparece com `merchant.hostile`.** Custo 60 de ouro; limpa `merchant.hostile`, `merchant.lead` e `merchant.sold` (o Boicote, 5.4, deixa de sair); moral +5 por 2 dias | "Um inimigo a menos pesa mais que uma bolsa." | |

Crônica (`profit`): "No {dia}º dia {daEstacao}, o senhor de {feudo} fechou as contas com o mercador de capa verde. Ele contou as moedas duas vezes, e nenhuma faltou." Prazo vencido: "No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} fechou as contas com o mercador de capa verde. Ele contou as moedas duas vezes, e nenhuma faltou."
Crônica (`destination`): "No {dia}º dia {daEstacao}, o senhor de {feudo} pediu ao mercador de capa verde o último mapa. Ele o desenhou ali mesmo, e a Mina Abandonada ficou no papel."
Crônica (`peace`): "No {dia}º dia {daEstacao}, o senhor de {feudo} fez as pazes com os mercadores da estrada. Brindou-se na praça, e os preços voltaram ao normal."

**O motor precisará:** `revealDestination` (o mesmo de 5.1), requisito de opção `undiscovered` e requisito de opção `flags` (novos: a opção só aparece ou só se destranca com a flag; hoje `CouncilOptionRequires` só tem `building` e `resources`).

### 5.4 Boicote dos mercadores (`merchantBoycott`, avulsa)

| Campo | Valor |
|---|---|
| Quando | Sorteada, peso 2, uma vez por ano. Outono ou inverno; Mercado Nv1; **só com a flag `merchant.hostile`** (a prisão de 5.1, sem as pazes de 5.3) |
| Texto | "Os mercadores da estrada não esqueceram o homem que o feudo prendeu. Mandaram dizer que as carroças deles passarão por outro caminho, e que o que ficar na praça será vendido mais caro. O Mercado de {feudo} começa a sentir o vazio das bancas." |

| Opção | Texto e efeitos | Hint | Autoaplica |
|---|---|---|---|
| `yield` "Ceder às exigências" | Custo 100 de ouro. Limpa `merchant.hostile`. Sem alta de preço | "O ouro compra a paz, e a memória dura mais que ele." | |
| `resist` "Resistir ao boicote" | **Os preços sobem 20% por 3 dias** (os quatro recursos). Moral +5 por 2 dias (o povo aplaude a teimosia); limpa `merchant.hostile` | "Os preços sobem uns dias, e o feudo mostra de que lado está." | as três dificuldades |
| `route` "Buscar outra rota" | Custo 60 de madeira (carroças e remos). **Os preços sobem 10% por 2 dias**; limpa `merchant.hostile` | "A estrada nova custa madeira e cura o rancor." | |

Crônica (`yield`): "No {dia}º dia {daEstacao}, o senhor de {feudo} pagou aos mercadores o preço da paz. As carroças voltaram à praça antes do fim da semana."
Crônica (`resist`): "No {dia}º dia {daEstacao}, o senhor de {feudo} recusou-se a ceder ao boicote dos mercadores. As bancas ficaram vazias, e o povo cantou na praça." Prazo vencido: "No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} recusou-se a ceder ao boicote dos mercadores. As bancas ficaram vazias, e o povo cantou na praça."
Crônica (`route`): "No {dia}º dia {daEstacao}, o senhor de {feudo} mandou abrir uma estrada nova para as carroças. Os mercadores a percorreram a contragosto."

**O motor precisará:** `marketPrice { resources, percent, durationDays }` (novo, em 5.6) e a flag `merchant.hostile` como requisito de carta (existe: `flags`).

### 5.5 A caravana real (`royalCaravan`, avulsa)

| Campo | Valor |
|---|---|
| Quando | Sorteada, peso 2, uma vez por ano. Verão ou outono; Mercado Nv1 |
| Texto | "Uma caravana com o estandarte do rei parou à porta do Mercado. Os cavalariços comem como lobos, e o intendente diz que a coroa compra o que o feudo tiver de sobra, e a bom preço, mas só enquanto a caravana estiver na praça. O inverno vem depois, e a despensa depende de quanto o senhor guardar." |

| Opção | Texto e efeitos | Hint | Autoaplica |
|---|---|---|---|
| `sellNow` "Vender à caravana agora" | **Os preços de comida, madeira e pedra sobem 25% por 1 dia** (o ferro fica de fora: a coroa não o compra). Vale o limite de volume do dia do Mercado | "Um dia de preço alto, e só um dia." | |
| `hospitality` "Dar hospitalidade à caravana" | Custo 40 de comida. **Os preços de comida, madeira e pedra sobem 10% por 3 dias**. Moral +5 por 2 dias | "A coroa lembra quem a recebeu à mesa: a alta dura mais, só que menor." | |
| `winter` "Guardar o excedente para o inverno" | Sem efeito | "O celeiro cheio vale mais quando a neve cai e a comida custa 30% a mais." | as três dificuldades |

Crônica (`sellNow`): "No {dia}º dia {daEstacao}, o senhor de {feudo} abriu o Mercado à caravana do rei. As bancas esvaziaram antes do pôr do sol."
Crônica (`hospitality`): "No {dia}º dia {daEstacao}, o senhor de {feudo} deu mesa à caravana do rei. O intendente elogiou o caldo e a sela dos cavalos."
Crônica (`winter`): "No {dia}º dia {daEstacao}, o senhor de {feudo} deixou a caravana do rei seguir viagem e guardou o excedente nos celeiros." Prazo vencido: "No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} deixou a caravana do rei seguir viagem e guardou o excedente nos celeiros."

**O motor precisará:** `marketPrice` (o mesmo de 5.4).

### 5.6 O que `marketPrice` precisa ser (decisão de motor, para a V4H-T1.2)

Proposta, a conferir com o autor só se ele discordar: o efeito grava em `market.effects` (estado 36 para 37, lista vazia) um fator por recurso e o fim em instante de jogo; `deriveViewState` e as contas de compra e venda usam o **preço exibido** = passeio × estação × os fatores vivos (cada um em fração `{ num, den }`, sem ponto flutuante); a venda segue a 85% do preço exibido de compra; os fatores de vários efeitos **se multiplicam**; o passeio não muda e o teto de 160% só vale para ele, não para o preço exibido (um boicote no inverno pode levar a comida acima de 160%: esperado). O sorteio do passeio e o `quoteDay` não mudam. A propriedade "nenhuma sequência de compra e venda no mesmo dia dá lucro" continua valendo, porque o fator multiplica compra e venda.


## 6. Lote 2 do Conselho: terceiro lote de cinco (para o autor)

**Lido e aprovado pelo autor em 2026-10-23, as cinco como estão** (decisão 23), com "A caçada do Lobo Branco" como expedição especial de três nós (e não o sorteio simples).

**Para leitura do autor** (V4H-T1.3; decisão 23). Nada disto está no código ainda. É o lote C da lista da 4.6: a cadeia "O Cobrador do Rei" (3 cartas) e as duas primeiras do "Lobo Branco" (2 de 3). **Nenhuma carta foi pulada**, mas **três ramos da lista foram trocados** porque dependiam de mecânica que a regra 6 do CLAUDE.md ainda proíbe:

- **A batalha** (carta 13: "batalha se o jogador recusou duas vezes"; e a ofensiva do Cobrador no GDD, Apêndice B, carta 6): a batalha é da Fase D da v0.4 e não existe no motor. No lugar entra uma **requisição de comida e madeira** (6.3). Quando a batalha existir, a opção `hold` da 6.3 é o lugar natural de um combate; isso é mudança de regra, com ADR.
- **O presságio** (carta 15: "oferecer carne dá presságio claro") e **o cerco** (carta 14: "ignorar dá lobos +30% no cerco"): os dois são de fases mais adiante da v0.4. No lugar, "oferecer carne" dá **moral** (6.5) e "ignorar" dá **perda de comida** (6.4).
- **A relíquia Osso de Lobo** (GDD, carta 5): é da v0.5; a caçada rende **ouro e comida**, não relíquia (6.5).

Nenhuma outra carta dependeu de mecânica proibida. O soldado como requisito de opção (`minSoldiers`) usa só o Exército que já existe (Quartel e treino, V4C-T1). A "expedição especial" da 6.5 é um modelo novo de expedição, não uma mecânica nova; está descrita ali, com o custo para o motor e uma saída mais barata, caso o autor prefira.

**Por que estas cinco.** Fecham a ideia "a coroa e a floresta cobram": o imposto que volta todo ano e vira ameaça se o jogador recusa (3 cartas) e o primeiro aviso de que o Covil limpo deixou um lobo para trás (2 cartas; o fim está no lote D). Pedem os ganchos de motor: `resourcesPercent` (já proposto em 4.4), `heroTrait` e `minSoldiers` como requisitos de opção, `clearedTiles` como requisito de carta e uma expedição liberada por carta (`unlockExpedition`).

**Convenções.** As da seção 4. Números conferidos contra `balance.ts`: o Quartel guarda 10 soldados por nível (`army.capPerLevel`), então "10 soldados" é um Quartel Nv1 cheio. Os tamanhos de efeito seguem o lote 1 (moral de ±5 a ±10 por 2 a 4 dias, comida de 30 a 90, ouro de 30 a 120). As perdas percentuais de ouro (7%, 15%, 20% e 30%) pesam mais que a de comida da "Praga nos campos" (30% da comida estocada) só onde a carta é a punição de uma recusa. Flags da cadeia do imposto: `tax.refused`, `tax.defied`, `tax.refusedTwice`. Flags do Lobo Branco: `whiteWolf.hunt`, `whiteWolf.offer`, `whiteWolf.ignored`.

### 6.1 Impostos do Rei (`kingsTax`, cadeia 1/3, recorrente)

| Campo | Valor |
|---|---|
| Quando | Sorteada, peso 2, **recorrente** (pode sair mais de uma vez no ano). Primavera ou outono; Salão Nv3; sem as flags `tax.refused`, `tax.defied` e `tax.refusedTwice` (a cadeia em curso segura a carta) |
| Texto | "Um arauto do rei parou ao pé da escadaria do Salão e leu o rolo em voz alta, devagar, para que ninguém dissesse que não ouviu. A coroa lembra que o feudo existe por mercê dela e que a mercê tem preço. O escrivão já tem a pena molhada." |

| Opção | Texto e efeitos | Hint | Autoaplica |
|---|---|---|---|
| `pay` "Pagar o imposto" | **Perde 15% do ouro estocado**, na hora. Sem efeito futuro | "O ouro sai inteiro, e o arauto vai embora satisfeito." | Camponês e Senhor |
| `negotiate` "Negociar com o arauto" | **Só com um herói Carismático livre no feudo** (traço `charismatic`). **Perde 7% do ouro estocado**, na hora | "Quem sabe falar paga menos que quem só sabe pagar." | |
| `refuse` "Recusar o imposto" | Sem custo. Moral +10 por 3 dias (o povo aplaude); flag `tax.refused`; **a carta 6.2 chega em 2 dias** | "O povo gosta da altivez. O rei não gosta de nada." | Rei de Ferro |

Crônica (`pay`): "No {dia}º dia {daEstacao}, o senhor de {feudo} pagou o imposto da coroa. O arauto contou as moedas em voz alta e partiu a cavalo." Prazo vencido: "No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} pagou o imposto da coroa. O arauto contou as moedas em voz alta e partiu a cavalo."
Crônica (`negotiate`): "No {dia}º dia {daEstacao}, {heroi} falou ao arauto do rei até o imposto encolher. O escrivão riscou um número e escreveu outro."
Crônica (`refuse`): "No {dia}º dia {daEstacao}, o senhor de {feudo} recusou o imposto da coroa. A praça aplaudiu, e o arauto não voltou a falar." Prazo vencido: "No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} recusou o imposto da coroa. A praça aplaudiu, e o arauto não voltou a falar."

**O motor precisará:** `resourcesPercent` (já proposto em 4.4: o ouro estocado é lido no instante da escolha, em fração `{ num, den }`), requisito de opção `heroTrait: 'charismatic'` (novo; hoje `CouncilOptionRequires` só tem `building` e `resources`, e o teste de conteúdo o recusa de propósito em `council.test.ts`) e a lacuna `{heroi}` na Crônica (o motor escolhe um herói Carismático livre e o grava com a escolha; a mesma lacuna das cartas 7.4 e 7.5). `buildings: { townHall: 3 }`, `seasons` e `notFlags` existem.

### 6.2 O Cobrador do Rei (`kingsCollector`, cadeia 2/3)

| Campo | Valor |
|---|---|
| Quando | Só por continuação (peso 0), 2 dias depois de `refuse` na 6.1 |
| Texto | "O arauto voltou com companhia: o cobrador do rei, um homem de rosto fechado, e quatro soldados de brasão na mão. Diz que a coroa não esquece quem a esquece e que a conta, agora, vem com multa. Os soldados olham o portão como quem avalia a madeira." |

| Opção | Texto e efeitos | Hint | Autoaplica |
|---|---|---|---|
| `fine` "Pagar a multa dobrada" | **Perde 30% do ouro estocado**, na hora; moral −5 por 2 dias; limpa `tax.refused`; **a cadeia termina** | "Paga-se o dobro do que se devia, e o assunto morre." | Camponês e Senhor |
| `soldiers` "Mostrar os soldados" | **Só com 10 soldados ou mais no Exército.** Sem custo. Moral +10 por 3 dias; limpa `tax.refused`; flag `tax.defied`; **a carta 6.3 chega em 4 dias** | "A fileira diante do portão pesa mais que a pena do escrivão." | |
| `refuse` "Mandar o cobrador embora" | Sem custo. Moral +5 por 2 dias; limpa `tax.refused`; flag `tax.refusedTwice`; **a carta 6.3 chega em 3 dias** | "Duas recusas seguidas, e a coroa perde a paciência." | Rei de Ferro |

Crônica (`fine`): "No {dia}º dia {daEstacao}, o senhor de {feudo} pagou a multa dobrada ao cobrador do rei. Os soldados contaram os sacos e não levaram um a mais." Prazo vencido: "No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} pagou a multa dobrada ao cobrador do rei. Os soldados contaram os sacos e não levaram um a mais."
Crônica (`soldiers`): "No {dia}º dia {daEstacao}, o senhor de {feudo} pôs os soldados em fila diante do cobrador do rei. Ele olhou para a fileira, depois para o escrivão, e baixou a voz."
Crônica (`refuse`): "No {dia}º dia {daEstacao}, o senhor de {feudo} mandou o cobrador do rei embora de mãos vazias. Os soldados dele não se mexeram, e isso pesou mais que qualquer ameaça." Prazo vencido: "No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} mandou o cobrador do rei embora de mãos vazias. Os soldados dele não se mexeram, e isso pesou mais que qualquer ameaça."

**O motor precisará:** `resourcesPercent` (o mesmo de 6.1) e o requisito de opção `minSoldiers` (novo: soma dos soldados treinados em `state.army`, sem o lote em treino; lê só o Exército que já existe). **Mudança em relação à lista:** a lista dá a esta carta "multa dobrada, negociar ou ceder parte" além do ramo de soldados; são quatro ramos e a carta só comporta três opções (o schema pede duas ou três). "Negociar" fica só na 6.1, e "ceder parte" virou a opção `hold` da 6.3.

### 6.3 A resposta da coroa (`kingsAnswer`, cadeia 3/3)

| Campo | Valor |
|---|---|
| Quando | Só por continuação, 4 dias depois de `soldiers` ou 3 dias depois de `refuse` na 6.2 |
| Variante de texto por flag | `tax.defied`: a coroa respeita a força. `tax.refusedTwice`: a coroa perdeu a paciência |

Texto (`tax.defied`): "A carta do rei chegou lacrada. O cobrador escreveu à corte que o feudo tem soldados em fileira e vontade de usá-los, e a corte, por ora, prefere conversa a guerra. A coroa propõe um acordo; o conselho quer saber qual."
Texto (`tax.refusedTwice`): "A carta do rei chegou lacrada, e o tom é de quem se cansou. Duas recusas pesaram mais que o ouro devido: a coroa manda dizer que cobrará o atraso, de um jeito ou de outro, e que os homens dela já sabem o caminho. O conselho quer saber o que o senhor responde."

| Opção | Texto e efeitos | Hint | Autoaplica |
|---|---|---|---|
| `tribute` "Pagar o tributo atrasado" | **Perde 20% do ouro estocado**; moral −5 por 2 dias; limpa `tax.defied` e `tax.refusedTwice`; a cadeia termina | "O rei esquece rápido o que recebe em dia." | Camponês e Senhor |
| `envoy` "Mandar um enviado à corte" | Custo 80 de ouro e 40 de comida (os presentes). Moral +5 por 2 dias; limpa as flags; a cadeia termina | "Cartas e presentes compram tempo, e tempo compra paz." | |
| `hold` "Manter a recusa" | **Perde 40 de comida e 40 de madeira** (a coroa requisita o que vê); moral +10 por 3 dias; limpa as flags; a cadeia termina | "O povo canta a teimosia, e a despensa paga a conta." | Rei de Ferro |

Crônica (`tribute`): "No {dia}º dia {daEstacao}, o senhor de {feudo} pagou o tributo atrasado. A carta do rei veio curta, e o selo não tinha cera demais." Prazo vencido: "No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} pagou o tributo atrasado. A carta do rei veio curta, e o selo não tinha cera demais."
Crônica (`envoy`): "No {dia}º dia {daEstacao}, o senhor de {feudo} mandou um enviado à corte com presentes e boas palavras. A coroa os aceitou, e o assunto foi arquivado."
Crônica (`hold`): "No {dia}º dia {daEstacao}, o senhor de {feudo} manteve a recusa. Os homens do rei levaram o que acharam nos celeiros e no pátio da serraria, e o povo cantou de portão fechado." Prazo vencido: "No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} manteve a recusa. Os homens do rei levaram o que acharam nos celeiros e no pátio da serraria, e o povo cantou de portão fechado."

**O motor precisará:** nada além dos itens das cartas anteriores: `resourcesPercent` e texto variante por flag (existe). O efeito das opções é o mesmo nas duas variantes: só o texto muda. **Troca em relação à lista:** sem batalha (ver o começo da seção).

### 6.4 Pegadas brancas (`whitePaws`, Lobo Branco 1/3)

| Campo | Valor |
|---|---|
| Quando | Sorteada, peso 2, uma vez por ano. Outono; **o Covil de Lobos já foi limpo** (`clearedTiles: ['wolfDen']`); sem as flags `whiteWolf.hunt`, `whiteWolf.offer` e `whiteWolf.ignored` |
| Texto | "Os caçadores acharam pegadas na neve cedo, pegadas largas, de um lobo maior que o maior que já se viu, e brancas ao redor, como se a terra tivesse dado à luz uma sombra clara. O Covil está limpo, mas a serra não esqueceu quem morava nele. O conselho quer saber o que o senhor responde." |

| Opção | Texto e efeitos | Hint | Autoaplica |
|---|---|---|---|
| `hunt` "Organizar a caçada" | Custo 40 de comida (as provisões dos caçadores). Flag `whiteWolf.hunt`; **a carta 6.5 chega em 3 dias** | "Atrás de um rastro assim vai gente, e volta nem sempre." | |
| `offer` "Deixar carne na orla do bosque" | Custo 80 de comida. Moral +5 por 2 dias; flag `whiteWolf.offer`; **a carta 6.5 chega em 3 dias** | "A fera come o que deixam, e quem a alimenta vira conhecido dela." | |
| `ignore` "Fingir que não viu" | **Perde 30 de comida** (o curral esvaziado, de um dia para o outro). Flag `whiteWolf.ignored`; **a carta 6.5 chega em 6 dias** | "O rastro some com a neve. O lobo, não." | as três dificuldades |

Crônica (`hunt`): "No {dia}º dia {daEstacao}, o senhor de {feudo} mandou os caçadores seguirem as pegadas brancas. Levaram sal, corda e pouca conversa."
Crônica (`offer`): "No {dia}º dia {daEstacao}, o senhor de {feudo} mandou deixar carne na orla do bosque. De manhã, a carne tinha sumido e a neve estava amassada em círculo."
Crônica (`ignore`): "No {dia}º dia {daEstacao}, o senhor de {feudo} fez de conta que não viu as pegadas brancas. Na noite seguinte, o curral amanheceu mais leve." Prazo vencido: "No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} fez de conta que não viu as pegadas brancas. Na noite seguinte, o curral amanheceu mais leve."

**O motor precisará:** requisito de carta `clearedTiles` (novo: o tile está desligado por um Covil limpo, estado que o motor já guarda desde a V3D-T2; a carta só lê). Custo, moral e `scheduleCard` existem. **Troca em relação à lista:** "ignorar" perde 30 de comida, não "lobos +30% no cerco" (sem cerco ainda).

### 6.5 O Lobo Branco (`whiteWolf`, Lobo Branco 2/3)

| Campo | Valor |
|---|---|
| Quando | Só por continuação, 3 dias depois de `hunt` ou `offer`, ou 6 dias depois de `ignore` na 6.4 |
| Variante de texto por flag | `whiteWolf.hunt`: os caçadores viram o lobo. `whiteWolf.offer`: o lobo come na orla. `whiteWolf.ignored`: o lobo desceu ao curral |

Texto (`whiteWolf.hunt`): "Os caçadores voltaram sem a fera e sem o rastro, mas com certeza: é um lobo só, branco como cinza fria, e vive onde o bosque fecha. Dizem que um grupo bem armado, com quem entenda de trilha, o alcança em dois dias. O conselho quer saber se a Guilda sai atrás dele."
Texto (`whiteWolf.offer`): "A carne some toda noite, e o lobo já deixa que o vejam: branco, calmo, sentado à beira da neve como um cão de guarda que ninguém contratou. Há quem diga que ele aprendeu o gosto do feudo. O conselho quer saber se a oferenda continua ou se a Guilda sai atrás dele."
Texto (`whiteWolf.ignored`): "O lobo desceu ao curral duas noites seguidas, e nenhuma cerca o deteve. A aldeia dorme de lanterna acesa. Há quem proponha alimentá-lo para amansar, e há quem queira vê-lo pendurado no portão. O conselho quer saber o que o senhor responde."

| Opção | Texto e efeitos | Hint | Autoaplica |
|---|---|---|---|
| `hunt` "Mandar a Guilda atrás dele" | **Só com a Guilda Nv1 e um herói livre.** Sem custo. **Libera a expedição especial "A caçada do Lobo Branco" (3 nós), disponível por 6 dias de jogo**; flag `whiteWolf.hunt`; **a carta 7.1 chega em 5 dias** | "A caçada é longa, e a recompensa é a pele, a honra e a quietude." | |
| `feed` "Manter a oferenda" | Custo 60 de comida. Moral +5 por 3 dias; flag `whiteWolf.offer`; **a carta 7.1 chega em 5 dias** | "Quem alimenta uma fera ganha tempo, e dívida." | |
| `withdraw` "Recolher os homens e as lanternas" | Sem efeito. Limpa `whiteWolf.hunt`, `whiteWolf.offer` e `whiteWolf.ignored`; **a cadeia termina aqui** | "Nem toda fera quer ser caçada." | as três dificuldades |

Crônica (`hunt`): "No {dia}º dia {daEstacao}, o senhor de {feudo} mandou a Guilda atrás do Lobo Branco. Partiram de madrugada, em fila, calados."
Crônica (`feed`): "No {dia}º dia {daEstacao}, o senhor de {feudo} mandou manter a carne na orla do bosque. O lobo veio comer à vista de todos."
Crônica (`withdraw`): "No {dia}º dia {daEstacao}, o senhor de {feudo} mandou recolher os homens e apagar as lanternas. O lobo se foi pela serra, e a aldeia dormiu." Prazo vencido: "No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} mandou recolher os homens e apagar as lanternas. O lobo se foi pela serra, e a aldeia dormiu."

**O motor precisará:** `unlockExpedition { modelId, forDays }` (novo: o modelo entra em `map.discovered` com prazo de `forDays` dias de jogo e some quando o prazo passa; hoje `discovered` só cresce) e um **modelo de expedição novo**, `whiteWolfHunt` (3 nós, dificuldade Média, provas de Rastreador e de Guerreiro, saque de ouro e comida, **sem relíquia**), com grafo e ficha a escrever na V4H-T1 e os ids fixados em teste (`STABLE_IDS`), como os demais. **Saída mais barata, se o autor preferir:** trocar a expedição por um `rollEffect` de 1 chance em 2 de ganhar 120 de ouro (a pele) e, na perda, ferimento leve a um herói; custa menos ao motor e à calibragem, mas perde a ideia de a Guilda sair atrás do lobo. **Troca em relação à lista:** sem presságio nem relíquia (ver o começo da seção); `feed` dá moral em lugar do presságio claro.

## 7. Lote 2 do Conselho: quarto lote de cinco (para o autor)

**Lido e aprovado pelo autor em 2026-10-23, as cinco como estão** (decisão 23).

**Para leitura do autor** (V4H-T1.3; decisão 23). Nada disto está no código ainda. É o lote D da lista da 4.6: o fim do "Lobo Branco" (a 16) e quatro cartas avulsas da Taverna e dos heróis (17 a 20). **Nenhuma carta foi pulada.** A única adaptação é a da 16, que na lista fecharia com o cerco da v0.4 (mecânica ainda proibida pela regra 6 do CLAUDE.md): o desfecho vira ouro, comida e moral. Os ganchos de motor novos pesam pouco: um requisito de carta (`heroPresent`, que exige herói livre no feudo e guarda o nome dele), um efeito sobre a Taverna (`tavernExtraOffer`) e o efeito `injureHero`, que usa o ferimento leve que já existe (`balance.raids.injuryMs`, 2 h de jogo). **Morte de herói não aparece em nenhuma carta**, e o ferimento é sempre leve.

**Convenções.** As da seção 4. Números conferidos contra `balance.ts`: a Taverna vai do Nv1 ao Nv5 e mostra 2, 2, 3, 3 e 3 candidatos; o festival custa 100 de comida e 50 de ouro e dá +15 de moral por 12 dias de jogo, de modo que as cartas desta seção, baratas e de moral pequena, **não substituem o festival**; o ferimento leve dura 2 h de jogo; o soldo vai de 2 a 20 de ouro por hora de jogo por herói (a dívida de 90 de ouro da 7.4 é um pouco menos que um dia de soldo do herói de nível 10 no ritmo Normal).

### 7.1 O que a floresta devolve (`forestReturns`, Lobo Branco 3/3)

| Campo | Valor |
|---|---|
| Quando | Só por continuação, 5 dias depois de `hunt` ou `feed` na 6.5 |
| Variante de texto por flag | `whiteWolf.hunt`: a pele e a história de quem caçou. `whiteWolf.offer`: o lobo some e deixa um presente |

Texto (`whiteWolf.hunt`): "Os caçadores da Guilda voltaram com a pele do Lobo Branco dobrada em dois e a história na ponta da língua, que cada um conta de um jeito. O bosque, dizem, ficou quieto depois do golpe, como quem acompanha um enterro. O conselho quer saber o que se faz com o que a floresta devolveu."
Texto (`whiteWolf.offer`): "O lobo parou de vir à orla uma manhã, e na seguinte havia, onde antes ficava a carne, uma pilha de ossos limpos e de couro de caça, como se o bosque quisesse acertar contas. O conselho quer saber o que se faz com o que a floresta devolveu."

| Opção | Texto e efeitos | Hint | Autoaplica |
|---|---|---|---|
| `claim` "Aceitar o que a floresta deixou" | +70 de ouro e +40 de comida (a pele, o couro e a caça). Moral +5 por 3 dias; limpa as flags do Lobo Branco; a cadeia termina | "O que o bosque devolve é do feudo, e o feudo agradece em silêncio." | as três dificuldades |
| `honor` "Honrar o lobo com uma pedra" | Custo 40 de pedra (o marco na orla). Moral +10 por 3 dias; limpa as flags; a cadeia termina | "Um marco na orla, e a serra fica em paz com quem a invadiu." | |
| `sell` "Vender a pele a um nobre" | +120 de ouro; moral −5 por 2 dias (o povo estranha vender o que o bosque deu); limpa as flags; a cadeia termina | "Mais ouro hoje, e menos orgulho amanhã." | |

Crônica (`claim`): "No {dia}º dia {daEstacao}, o senhor de {feudo} aceitou o que a floresta devolveu. A pele foi pendurada na parede do Salão, e a aldeia dormiu mais leve." Prazo vencido: "No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} aceitou o que a floresta devolveu. A pele foi pendurada na parede do Salão, e a aldeia dormiu mais leve."
Crônica (`honor`): "No {dia}º dia {daEstacao}, o senhor de {feudo} mandou erguer um marco de pedra na orla do bosque. Ninguém soube dizer ao certo para quê, e ninguém o derrubou."
Crônica (`sell`): "No {dia}º dia {daEstacao}, o senhor de {feudo} vendeu a pele do Lobo Branco a um nobre da estrada. O negócio foi fechado antes do almoço."

**O motor precisará:** nada novo (texto por flag, recursos, moral e flags existem). O efeito das opções é o mesmo nas duas variantes: só o texto muda. **Troca em relação à lista:** sem cerco (ver o começo da seção) e sem a lacuna do herói que caçou (a lista dizia "lembra quem caçou"; o relatório da expedição já guarda quem se destacou).

### 7.2 Um bardo na Taverna (`tavernBard`, avulsa)

| Campo | Valor |
|---|---|
| Quando | Sorteada, peso 2, uma vez por ano. Qualquer estação; Taverna Nv1 |
| Texto | "Um bardo de passagem pediu o canto da mesa grande da Taverna e começou a afinar o alaúde antes de ser convidado. Conhece as histórias de três reinos e promete incluir o feudo na quarta. Cobra pela canção, pela cama e pela fama. O taverneiro olha o chão e espera." |

| Opção | Texto e efeitos | Hint | Autoaplica |
|---|---|---|---|
| `pay` "Pagar pela canção" | Custo 40 de ouro. Moral +10 por 3 dias | "Uma noite de canto vale mais que a bolsa." | |
| `meal` "Dar mesa e cama" | Custo 30 de comida. Moral +5 por 2 dias | "Barriga cheia canta melhor, e paga com a voz." | |
| `dismiss` "Mandá-lo embora" | Sem efeito | "A Taverna fica quieta, e o bardo canta noutra praça." | as três dificuldades |

Crônica (`pay`): "No {dia}º dia {daEstacao}, o senhor de {feudo} pagou pela canção do bardo. A Taverna cantou o refrão até de madrugada."
Crônica (`meal`): "No {dia}º dia {daEstacao}, o senhor de {feudo} deu mesa e cama ao bardo de passagem. Ele agradeceu com duas estrofes e meia."
Crônica (`dismiss`): "No {dia}º dia {daEstacao}, o senhor de {feudo} mandou o bardo seguir caminho. A Taverna ficou quieta, e o alaúde partiu nas costas dele." Prazo vencido: "No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} mandou o bardo seguir caminho. A Taverna ficou quieta, e o alaúde partiu nas costas dele."

**O motor precisará:** nada novo (`buildings: { tavern: 1 }`, custo e moral existem).

### 7.3 Recrutador de passagem (`passingRecruiter`, avulsa)

| Campo | Valor |
|---|---|
| Quando | Sorteada, peso 2, uma vez por ano. Qualquer estação; Taverna Nv1 |
| Texto | "Um recrutador de capa gasta bateu à porta da Taverna e abriu a bolsa de couro sem rodeios. Conhece gente que procura trabalho de espada e que não pediria mal. Cobra a taxa de quem encontra, não de quem contrata, e diz que não volta tão cedo." |

| Opção | Texto e efeitos | Hint | Autoaplica |
|---|---|---|---|
| `pay` "Pagar a taxa do recrutador" | Custo 100 de ouro. **Na próxima rotação da Taverna ela mostra um candidato a mais** (um sorteio a mais no fluxo `tavern`, sem repetir o nome de quem já serve) | "O candidato extra sai da rotação seguinte, e a bolsa sai agora." | |
| `refuse` "Dispensar o recrutador" | Sem efeito | "A Taverna escolhe quem aparece por conta própria." | as três dificuldades |

Crônica (`pay`): "No {dia}º dia {daEstacao}, o senhor de {feudo} pagou a taxa do recrutador de passagem. Ele garantiu mais um nome na lista da Taverna e pegou a estrada."
Crônica (`refuse`): "No {dia}º dia {daEstacao}, o senhor de {feudo} dispensou o recrutador. Ele guardou a bolsa e foi bater a outra porta." Prazo vencido: "No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} dispensou o recrutador. Ele guardou a bolsa e foi bater a outra porta."

**O motor precisará:** `tavernExtraOffer` (novo, efeito de carta: grava um marcador em `guild.tavern` e a **próxima rotação** sorteia um candidato a mais, além do número do nível; o sorteio fica na rotação, dentro de `advanceTo`, e nunca na resposta da carta, para o invariante de divisão do intervalo valer; o marcador some quando a rotação passa). **O limite de contratação não muda**: o candidato extra é um a mais para o jogador contratar ou deixar.

### 7.4 A dívida de jogo (`gamblingDebt`, avulsa)

| Campo | Valor |
|---|---|
| Quando | Sorteada, peso 2, uma vez por ano. Qualquer estação; Taverna Nv1; **um herói livre no feudo** (`heroPresent`: no feudo e sem estar ferido, em expedição, capturado ou em escolta) |
| Texto | "Um cobrador de dados e baralhos bateu à porta com um papel dobrado na mão: {heroi}, dizem, perdeu na mesa mais do que o soldo de um mês e não tem como pagar. O homem não fala alto, mas não parece disposto a esperar. O conselho quer saber o que o senhor responde." |

| Opção | Texto e efeitos | Hint | Autoaplica |
|---|---|---|---|
| `cover` "Cobrir a dívida" | Custo 90 de ouro. Moral +5 por 2 dias (a equipe gosta de quem a defende) | "Uma dívida paga é lealdade comprada." | |
| `leave` "Deixá-lo resolver sozinho" | **Risco à vista, sorteado na virada de dia seguinte**: 1 chance em 2 de o herói voltar **ferido de leve** (2 h de jogo) e a moral cair 5 por 3 dias; se der certo, ele resolve sozinho e a moral sobe 5 por 2 dias | "Cada um sabe da própria mesa, e do próprio fim de noite." | as três dificuldades |

Crônica (`cover`): "No {dia}º dia {daEstacao}, o senhor de {feudo} cobriu a dívida de jogo de {heroi}. O cobrador contou as moedas duas vezes e se foi sem dizer o nome da taverna."
Crônica (`leave`, escolha): "No {dia}º dia {daEstacao}, o senhor de {feudo} deixou {heroi} se resolver com o cobrador." Prazo vencido: "No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} deixou {heroi} se resolver com o cobrador."
Crônica (desfecho ruim, na virada seguinte): "No {dia}º dia {daEstacao}, {heroi} voltou da conversa com o cobrador de olho roxo e costelas doloridas. A Taverna comentou por uma semana."
Crônica (desfecho bom, na virada seguinte): "No {dia}º dia {daEstacao}, {heroi} acertou as contas com o cobrador sem derramar sangue. Ninguém soube explicar como, e ninguém perguntou."

**O motor precisará:** requisito de carta `heroPresent` (novo: pelo menos um herói livre; o motor escolhe um na chegada da carta, pelo fluxo `council`, e grava o nome para a lacuna `{heroi}`; a carta nunca é sorteada sem herói livre); `rollEffect` (já proposto em 4.4); e o efeito `injureHero { heroId, kind: 'light' }` (novo: aplica o ferimento leve que já existe, 2 h de jogo, ao herói gravado; se ele já estiver ferido, em expedição ou capturado quando o risco se resolver, o ferimento não se aplica e a Crônica conta o desfecho bom). **Nunca mata e nunca captura.**

### 7.5 Duelo na praça (`squareDuel`, avulsa)

| Campo | Valor |
|---|---|
| Quando | Sorteada, peso 2, uma vez por ano. Primavera, verão ou outono; **dois heróis livres no feudo** (`heroPresent` com 2) |
| Texto | "{heroi} e {heroi2} trocaram palavras duras na Taverna, e a coisa foi parar na praça, onde se juntou a aldeia inteira com os braços cruzados. Ambos querem resolver com o aço. O capitão da guarda olha para o senhor, esperando uma palavra." |

| Opção | Texto e efeitos | Hint | Autoaplica |
|---|---|---|---|
| `allow` "Permitir o duelo" | Moral +10 por 2 dias (a aldeia gosta de espetáculo). **Risco à vista, sorteado na virada de dia seguinte**: 1 chance em 3 de um dos dois sair **ferido de leve** (2 h de jogo) | "O povo gosta de ver o aço, e o aço nem sempre sai limpo." | |
| `train` "Marcar um duelo de treino" | Custo 30 de ouro (as lanças de madeira). Moral +5 por 2 dias; nenhum risco | "Madeira no lugar de aço: a honra fica salva, e as costelas também." | |
| `forbid` "Proibir o duelo" | Moral −5 por 2 dias (a aldeia queria ver); nenhum risco | "A ordem do senhor vale mais que a honra dos dois, mesmo que ninguém goste." | as três dificuldades |

Crônica (`allow`): "No {dia}º dia {daEstacao}, o senhor de {feudo} permitiu o duelo entre {heroi} e {heroi2}. A praça lotou antes do meio-dia."
Crônica (`train`): "No {dia}º dia {daEstacao}, o senhor de {feudo} mandou {heroi} e {heroi2} duelarem com lanças de madeira. Ganhou quem apanhou menos, e a praça aplaudiu os dois."
Crônica (`forbid`): "No {dia}º dia {daEstacao}, o senhor de {feudo} proibiu o duelo na praça. A aldeia resmungou e foi para casa." Prazo vencido: "No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} proibiu o duelo na praça. A aldeia resmungou e foi para casa."
Crônica (desfecho ruim, na virada seguinte): "No {dia}º dia {daEstacao}, {heroiFerido} saiu do duelo na praça com um corte no braço, e a aldeia cantou o nome do outro."
Crônica (desfecho bom, na virada seguinte): "No {dia}º dia {daEstacao}, o duelo entre {heroi} e {heroi2} acabou em abraço e vinho. Ninguém saiu ferido."

**O motor precisará:** `heroPresent` com mínimo 2 e as lacunas `{heroi}`, `{heroi2}` e `{heroiFerido}` (novo; a última é o herói que o sorteio da virada seguinte escolheu entre os dois), `rollEffect` (o mesmo de 4.4 e 7.4) e `injureHero` (o mesmo de 7.4).

## 8. Lote 2 do Conselho: o lote E, as três últimas (para o autor)

**Lido e aprovado pelo autor em 2026-10-23, as cartas como estão** (decisão 23).

**Para leitura do autor** (V4H-T1.3; decisão 23). Nada disto está no código ainda. É o lote E da lista da 4.6: as três cartas que sobravam, uma delas roteirizada. Com elas, o lote 2 fica com 22 das 23 cartas; a 23ª, "O aprendiz e o Mestre" (4.5), espera o Mestre poder ensinar o ofício (regra 6 do CLAUDE.md). **Morte de herói não aparece em nenhuma carta.** Os ganchos de motor são pequenos: o requisito `injuredHero` e o efeito `healHero` (8.1), os já aprovados `revealDestination` e `undiscovered` da seção 5 (8.2) e nada novo na 8.3.

**Convenções.** As da seção 4: dias de jogo, prazo de 24 h reais, ids estáveis em inglês, "Autoaplica" é o que o conselho faz se o prazo passar, e a opção que o conselho aplica sozinho nunca tira recurso nem moral em Camponês e em Senhor. Tamanhos de efeito como os do lote 1 (ouro de 30 a 120, comida de 30 a 90).

### 8.1 O curandeiro errante (`wanderingHealer`, avulsa)

| Campo | Valor |
|---|---|
| Quando | Sorteada, peso 2, uma vez por ano. Qualquer estação; **um herói ferido no feudo** (`injuredHero`: `status: 'injured'`; o motor escolhe um na chegada da carta, pelo fluxo `council`, e grava o nome para a lacuna `{heroi}`) |
| Texto | "Um homem magro, de bolsa cheia de ervas e dedos manchados de verde, parou diante dos portões e perguntou, sem cumprimentar, quem era o ferido da casa. Já ouviu falar de {heroi}. Diz que cura numa noite o que o tempo cura em muitas, e cobra pela noite." |

| Opção | Texto e efeitos | Hint | Autoaplica |
|---|---|---|---|
| `pay` "Pagar pela cura" | Custo 60 de ouro. O ferimento de {heroi} fecha na hora | "A bolsa esvazia hoje, e a espada volta ao trabalho amanhã." | |
| `herbs` "Comprar só as ervas" | Custo 30 de comida (as ervas viram caldo). O ferimento de {heroi} **encurta pela metade** do que faltava | "Mais lento, mais barato, e a cozinha cheira a mato." | |
| `wait` "Deixar o tempo curar" | Sem efeito | "O ferimento sara sozinho, no passo dele." | as três dificuldades |

Crônica (`pay`): "No {dia}º dia {daEstacao}, o senhor de {feudo} pagou o curandeiro errante. {heroi} acordou sem febre e sem dor, e o homem das ervas sumiu na estrada."
Crônica (`herbs`): "No {dia}º dia {daEstacao}, o senhor de {feudo} comprou as ervas do curandeiro errante. O caldo fedia, e {heroi} jurou que melhorou por teimosia."
Crônica (`wait`): "No {dia}º dia {daEstacao}, o senhor de {feudo} dispensou o curandeiro errante. {heroi} continuou de cama, e o homem das ervas foi cobrar noutra porta." Prazo vencido: "No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} dispensou o curandeiro errante. {heroi} continuou de cama, e o homem das ervas foi cobrar noutra porta."

**O motor precisará:** requisito de carta `injuredHero` (novo, irmão do `heroPresent` de 7.4: pelo menos um herói `injured` no feudo, não capturado; a carta nunca é sorteada sem ele); efeito `healHero { heroId, mode: 'full' | 'half' }` (novo: `full` encerra o ferimento agora; `half` o encurta para metade do que faltava; o herói volta a `idle` pela mesma porta do herói que sara, sem sorteio). Se o herói sarou ou partiu antes da resposta, o efeito não se aplica e a Crônica diz que o curandeiro chegou tarde. **Nunca mata nem captura.**

### 8.2 O mapa rasgado (`tornMap`, avulsa)

| Campo | Valor |
|---|---|
| Quando | Sorteada, peso 1, uma vez por ano. Primavera, verão ou outono; Guilda Nv1; **ao menos um destino ainda não descoberto** (`undiscovered`, o requisito da seção 5) |
| Texto | "Um caçador de barba curta jogou sobre a mesa da Taverna a metade de um mapa, rasgado com cuidado, e disse que a outra metade ficou com um irmão de quem não gosta. O que há é uma trilha, três marcos e um X de tinta velha. Diz que quem tem coragem de seguir a trilha encontra o que o X promete." |

| Opção | Texto e efeitos | Hint | Autoaplica |
|---|---|---|---|
| `buy` "Comprar o meio mapa" | Custo 70 de ouro. **Revela o próximo destino ainda oculto** (`revealDestination`, o efeito da seção 5), na ordem em que o catálogo os descobre | "Setenta de ouro a menos, e a Guilda tem um destino a mais." | |
| `barter` "Pagar em provisões" | Custo 40 de comida e 20 de madeira (o pão e as tochas da trilha). **O mesmo efeito de `buy`**, a outro preço | "O caçador aceita o que tem na despensa, e a conversa é a mesma." | |
| `refuse` "Recusar o negócio" | Sem efeito | "Meio mapa é meia mentira." | as três dificuldades |

Crônica (`buy`): "No {dia}º dia {daEstacao}, o senhor de {feudo} comprou o meio mapa do caçador. A Guilda passou a noite em volta dele, traçando a trilha com o dedo."
Crônica (`barter`): "No {dia}º dia {daEstacao}, o senhor de {feudo} pagou o meio mapa em pão e tochas. O caçador saiu mastigando e sem olhar para trás."
Crônica (`refuse`): "No {dia}º dia {daEstacao}, o senhor de {feudo} recusou o meio mapa. O caçador dobrou o papel e o levou a outra mesa." Prazo vencido: "No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} recusou o meio mapa. O caçador dobrou o papel e o levou a outra mesa."

**O motor precisará:** `revealDestination` e `undiscovered` (os mesmos da seção 5, sem novidade); requisito de edifício `guild: 1` (existe). Se o autor achar que `barter` é só um preço diferente, a carta fica com duas opções.

### 8.3 O mercador itinerante (`itinerantMerchant`, roteirizada)

| Campo | Valor |
|---|---|
| Quando | **Roteirizada** (`scripted: { atGameDay: 20 }`, o molde da "Estrangeira ferida"): sai no sorteio da audiência, na frente das sorteadas, uma vez por partida; a partida que já passou do dia 20 a recebe na primeira audiência com lugar. Sem edifício nem estação |
| Texto | "Uma carroça coberta de lona remendada parou diante da praça, e o homem que desceu dela abriu as mãos sem pedir licença: tem boa conversa, lugar na estrada e bolsa para quem quiser vender hoje. Não é o Mercado, que o feudo ainda não tem, e ele sabe disso. Faz o preço de quem não volta." |

| Opção | Texto e efeitos | Hint | Autoaplica |
|---|---|---|---|
| `sellWood` "Vender madeira" | Custo 100 de madeira; +50 de ouro | "Um preço ruim hoje, para quem precisa de ouro hoje." | |
| `sellStone` "Vender pedra" | Custo 80 de pedra; +60 de ouro | "A pedra não anda sozinha, e a carroça sim." | |
| `wait` "Esperar ter o Mercado" | Sem efeito. Grava a flag `itinerant.heardOfMarket`, que só entra no texto das cartas do Mercado | "Quem espera pelo balcão certo vende melhor, e leva mais tempo." | as três dificuldades |

Crônica (`sellWood`): "No {dia}º dia {daEstacao}, o senhor de {feudo} vendeu madeira ao mercador itinerante. O preço foi ruim, e a carroça saiu mais pesada do que chegou."
Crônica (`sellStone`): "No {dia}º dia {daEstacao}, o senhor de {feudo} vendeu pedra ao mercador itinerante. A carroça rangeu sob o peso até a curva da estrada."
Crônica (`wait`): "No {dia}º dia {daEstacao}, o senhor de {feudo} deixou o mercador itinerante seguir viagem. Ele disse que o feudo ia precisar de um balcão, e foi embora sem insistir." Prazo vencido: "No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} deixou o mercador itinerante seguir viagem. Ele disse que o feudo ia precisar de um balcão, e foi embora sem insistir."

**O motor precisará:** nada novo (`scripted` e recursos existem). **Conta conferida contra `balance.ts`:** a madeira vale 1,2 de ouro e a pedra, 2,0 no balcão (`market.basePrice`), então 100 de madeira valeriam 120 de ouro e, na venda do Mercado a 85%, 102; a carta paga 50, menos de metade. A pedra: 80 valeriam 160 e a venda a 85% daria 136; a carta paga 60. É "preço ruim" de propósito, e o texto avisa. Prepara o Mercado (que pede o Salão no Nv3).

### 8.4 O que fica do lote 2

Com estas três, o lote 2 está inteiro nas seções 4 a 8, **exceto o aprendiz** (4.5), que volta quando o Mestre puder ensinar o ofício.

## 9. Lote 3 do Conselho: primeiro lote de cinco (para o autor)

**Lido e aprovado pelo autor em 2026-10-23, as cartas como estão** (decisão 23).

**Para leitura do autor** (V4H-T2; decisão 23: lotes de cinco). Nada disto está no código ainda. O lote 3 tem 15 cartas (roadmap, §16.3); este é o primeiro lote de cinco: a cadeia **"A Filha do Ferreiro"** (9.1 a 9.3, a quinta e última cadeia do GDD §7.1, adaptada à v0.4) e duas avulsas de guerra que só usam o que já existe: **"Mercenários de passagem"** (9.4: Quartel, soldados e armas) e **"Ferro de contrabando"** (9.5: ferro e Mercado). **Nenhuma carta pede batalha nem incursão nova.**

**Convenções.** As da seção 4, mais: **as armas** são o estoque `settlement.weapons` (a forja faz 1 por 6 min de jogo, com 2 de ferro e 1 de madeira por arma, lotes de até 10; só Espadachins e Cavaleiros gastam 1 cada); **o ferro** tem preço-base de 8,0 de ouro (`market.basePrice.iron` = 8000 milésimos, venda a 85%); o Quartel guarda 10 soldados por nível e o soldado come 1,5 por hora de jogo. Dois efeitos temporários novos, no molde do festival e dos de moral (valem em dias de jogo): `smithySpeed` e `smithyBatch`.

### 9.1 A Filha do Ferreiro (`smithsDaughter`, cadeia 1/3)

| Campo | Valor |
|---|---|
| Quando | Sorteada, peso 2, uma vez por ano. Verão; Ferreiro Nv1 (`buildings: { smithy: 1 }`). Sem as flags `smithsDaughter.learning` e `smithsDaughter.tradition` |
| Texto | "A filha do ferreiro, de quinze anos e braço de homem, pediu licença para ficar diante da forja a noite inteira, e o pai, que nunca deixou ninguém lá, olhou para o chão. Ela já sabe bater o ferro em frio. O que quer é aprender a temperá-lo. A aldeia espiou pela janela, e há quem ache que moça não é lugar para fornalha." |

| Opção | Texto e efeitos | Hint | Autoaplica |
|---|---|---|---|
| `teach` "Deixar a moça aprender" | Custo 40 de ferro (o primeiro lote dela). **A forja fica 20% mais rápida por 12 dias** (`smithySpeed` 6/5); moral −5 por 2 dias (os conservadores resmungam); flag `smithsDaughter.learning`; a carta 2 chega em 6 dias | "A moça aprende, a forja corre, e a aldeia fala." | |
| `tradition` "Manter a tradição" | Sem custo. Moral +5 por 3 dias (a aldeia gosta de ordem); flag `smithsDaughter.tradition`; a cadeia termina | "O ofício fica onde sempre esteve, e ninguém reclama." | as três dificuldades |

Crônica (`teach`): "No {dia}º dia {daEstacao}, o senhor de {feudo} deixou a filha do ferreiro aprender o ofício. A forja varou a noite, e as janelas da vizinhança ficaram acesas até tarde."
Crônica (`tradition`): "No {dia}º dia {daEstacao}, o senhor de {feudo} manteve a tradição da forja. A filha do ferreiro voltou à roca, e a aldeia dormiu em paz." Prazo vencido: "No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} manteve a tradição da forja. A filha do ferreiro voltou à roca, e a aldeia dormiu em paz."

**O motor precisará:** `smithySpeed` (novo, efeito de carta temporário no molde do festival: `{ type: 'smithySpeed', factor: { num: 6, den: 5 }, durationDays: 12 }`; entra na conta do tempo de cada arma como mais um fator, vale para cada arma que **começa** depois dele, e a visão explica o termo, "× 1,2 (a filha do ferreiro)"). `buildings`, flags e `scheduleCard` existem. **Troca em relação ao GDD:** o GDD dizia "Ferreiro +10% permanente"; o roadmap (§16.3) diz "por um prazo". Vale o do roadmap, para não mexer em `smithy.speedPerLevel`.

### 9.2 O segredo da têmpera (`temperingSecret`, cadeia 2/3)

| Campo | Valor |
|---|---|
| Quando | Só por continuação, 6 dias depois de `teach` na 9.1 (flag `smithsDaughter.learning`) |
| Texto | "A filha do ferreiro apareceu na porta do Salão com a cara suja de carvão e um sorriso que nenhum conselheiro soube ler. Descobriu, de tanto errar, que o ferro fica melhor quando esfria em óleo e não em água, e que o óleo certo dá mais peças por fornada. Falta só o ferro para a prova, e o pai fingia que não ouvia." |

| Opção | Texto e efeitos | Hint | Autoaplica |
|---|---|---|---|
| `pay` "Pagar o ferro da prova" | Custo 60 de ferro. **Cada lote da forja rende uma arma a mais por 15 dias** (`smithyBatch` +1, até o teto de 10 do lote); flag `smithsDaughter.tempered`; a carta 3 chega em 6 dias | "Um óleo novo, uma arma a mais por lote, e sessenta de ferro a menos." | |
| `keep` "Guardar o ferro" | Sem custo. Moral +5 por 2 dias (o ferreiro fica orgulhoso); limpa as flags da cadeia; a cadeia termina | "O ferro fica no depósito, e o segredo, na cabeça dela." | as três dificuldades |

Crônica (`pay`): "No {dia}º dia {daEstacao}, o senhor de {feudo} pagou o ferro da prova de têmpera. A filha do ferreiro encheu o barril de óleo e não dormiu em casa."
Crônica (`keep`): "No {dia}º dia {daEstacao}, o senhor de {feudo} guardou o ferro. A filha do ferreiro baixou os olhos, e o pai disse que ela ainda tinha muito para aprender." Prazo vencido: "No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} guardou o ferro. A filha do ferreiro baixou os olhos, e o pai disse que ela ainda tinha muito para aprender."

**O motor precisará:** `smithyBatch` (novo, efeito temporário: `{ type: 'smithyBatch', extra: 1, durationDays: 15 }`; o lote encomendado **depois** do efeito rende `quantidade + extra` armas pelo custo e pelo tempo de `quantidade`, sem passar do `smithy.batchMax` de 10; a ordem de forja não muda de contrato, e o motor soma o extra ao concluir). Texto por flag não precisa: só `teach` leva a esta carta.

### 9.3 A espada do Senhor (`lordsSword`, cadeia 3/3)

| Campo | Valor |
|---|---|
| Quando | Só por continuação, 6 dias depois de `pay` na 9.2 (flag `smithsDaughter.tempered`). Ferreiro Nv1 |
| Texto | "A filha do ferreiro pediu que o senhor viesse à forja e trouxe, enrolada num pano, a primeira lâmina inteira que fez sozinha. Tem o fio limpo e o peso certo, e o pai, ao lado, não disse nada, que é o seu jeito de dizer muito. Ela quer saber o que o feudo faz com o que ela forjou: uma lâmina que merece um nome, ou o ferro de dez outras." |

| Opção | Texto e efeitos | Hint | Autoaplica |
|---|---|---|---|
| `blade` "Ficar com a lâmina" | **Um item raro**, a Espada do Senhor, entra no arsenal (arma, raridade rara, a potência da Lâmina de Vel'Thar, 28/25; com o arsenal cheio vira ouro, como todo item); moral +5 por 2 dias; limpa as flags; a cadeia termina | "Uma espada com nome, que a Guilda disputa antes do jantar." | |
| `arms` "Fundir em armas para a tropa" | **+8 armas** no estoque, sem custo; moral +5 por 2 dias; limpa as flags; a cadeia termina | "O ferro volta a ser o que o Quartel gasta: espadas simples, em número." | as três dificuldades |

Crônica (`blade`): "No {dia}º dia {daEstacao}, o senhor de {feudo} ficou com a lâmina da filha do ferreiro. A espada ganhou nome antes do pôr do sol, e a forja ficou em silêncio por respeito."
Crônica (`arms`): "No {dia}º dia {daEstacao}, o senhor de {feudo} mandou fundir a lâmina em armas para a tropa. A filha do ferreiro empilhou as peças uma a uma, de cabeça erguida." Prazo vencido: "No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} mandou fundir a lâmina em armas para a tropa. A filha do ferreiro empilhou as peças uma a uma, de cabeça erguida."

**O motor precisará:** `addItem { itemId }` (novo, efeito de carta: entrega um item do catálogo pela porta que as expedições já usam, `nextId(draft, 'item')`, com o teto de 30 e a conversão em ouro; **um item novo**, `lordsSword`, na tabela de `items.ts`, com o id fixado em teste) e `addWeapons { amount }` (novo: soma ao estoque de armas, que não tem teto). Nenhum dos dois sorteia. **Troca em relação ao GDD:** "ela forja um item raro mais tarde" vira o item que o senhor recebe de uma vez. As 8 armas valem 16 de ferro e 8 de madeira, bem menos que o item (valor 120 de ouro): a tropa ganha em número, a Guilda em qualidade, e nenhuma opção domina.

### 9.4 Mercenários de passagem (`passingMercenaries`, avulsa)

| Campo | Valor |
|---|---|
| Quando | Sorteada, peso 2, uma vez por ano. Primavera, verão ou outono; **Quartel Nv1** e vaga no Quartel para 5 (`army.capPerLevel`, 10 por nível, menos os soldados que já há) |
| Texto | "Cinco homens de capa verde-escura e espadas de uso longo pararam diante dos portões, e o mais velho tirou o chapéu sem se curvar. Dizem que vêm de uma guerra que acabou na semana passada e que ainda não gastaram a paga. Aceitam servir, por ouro e por armas, a quem lhes der casa e comida. Não prometem ficar para sempre." |

| Opção | Texto e efeitos | Hint | Autoaplica |
|---|---|---|---|
| `hire` "Contratar os cinco" | Custo 120 de ouro e 5 armas. **+5 Espadachins** entram no Quartel, já treinados, e comem 1,5 de comida por hora cada, como todo soldado. Moral −5 por 2 dias (a aldeia teme homens de armas estranhos) | "Cinco espadas prontas hoje, sem esperar o treino." | |
| `train` "Pedir que treinem a tropa" | Custo 40 de comida. Moral +5 por 2 dias; **os lotes que já treinam no Quartel terminam em metade do tempo que falta** (`trainBoost`, uma vez); trancada sem fila de treino | "Eles não ficam, mas deixam os rapazes mais depressa de pé." | |
| `refuse` "Recusar" | Sem efeito | "O Quartel treina os dele, no passo dele." | as três dificuldades |

Crônica (`hire`): "No {dia}º dia {daEstacao}, o senhor de {feudo} contratou cinco mercenários de passagem. Eles entraram em fila no Quartel, de capa verde e queixo erguido."
Crônica (`train`): "No {dia}º dia {daEstacao}, o senhor de {feudo} pediu aos mercenários que treinassem a tropa. Eles ensinaram numa tarde o que o Quartel levaria uma semana, e seguiram viagem."
Crônica (`refuse`): "No {dia}º dia {daEstacao}, o senhor de {feudo} recusou os mercenários. Eles puseram os chapéus e tomaram a estrada do norte." Prazo vencido: "No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} recusou os mercenários. Eles puseram os chapéus e tomaram a estrada do norte."

**O motor precisará:** `addSoldiers { unit: 'swordsman', amount: 5 }` (novo, efeito de carta: soma ao `state.army` pela mesma porta da ordem de treino, sem fila nem custo de treino; não passa do teto do Quartel, e a opção fica trancada quando faltam as 5 vagas) e `trainBoost` (novo: corta à metade o tempo que falta dos lotes em treino, uma vez; sem fila, a opção fica trancada). **Troca em relação à lista:** a lista dizia "por um prazo"; aqui **os cinco ficam**, porque soldado temporário é mecânica que o Quartel não tem. Quando a Fase E ligar as incursões, esta opção pode virar batalha (os mercenários lutam na próxima incursão e partem), se o autor quiser.

### 9.5 Ferro de contrabando (`smuggledIron`, avulsa)

| Campo | Valor |
|---|---|
| Quando | Sorteada, peso 2, uma vez por ano. Qualquer estação; Mercado Nv1 |
| Texto | "Um carroceiro de olhos baixos esperou a feira acabar e chamou o senhor a um canto da praça. Tem sacos de ferro bom, diz, e preço que não cabe no balcão do Mercado, por razões que prefere não contar. O ferro é pesado e tem cheiro de terra úmida. Pode ser tudo o que ele diz, ou só pedra pintada." |

| Opção | Texto e efeitos | Hint | Autoaplica |
|---|---|---|---|
| `buy` "Comprar tudo, sem provar" | Custo 260 de ouro. **Risco à vista, sorteado na virada de dia seguinte**: 2 chances em 3 de chegarem **60 de ferro**; 1 em 3 de serem só pedra pintada: nada chega e a moral cai 5 por 2 dias | "Dois sacos em cada três valem, e o terceiro não vale nada." | |
| `half` "Comprar metade, provando o metal" | Custo 130 de ouro; pede o Ferreiro Nv1, que prova o metal na lima. **30 de ferro na hora, sem risco** | "Um ferreiro por perto vale um balcão inteiro." | |
| `refuse` "Mandar o carroceiro embora" | Sem efeito | "Ouro no cofre e ferro no ferreiro: o feudo dorme." | as três dificuldades |

Crônica (`buy`): "No {dia}º dia {daEstacao}, o senhor de {feudo} comprou ferro de um carroceiro sem provar o metal. Os sacos foram para o depósito sem ninguém abrir um."
Crônica (`half`): "No {dia}º dia {daEstacao}, o senhor de {feudo} comprou metade do ferro do carroceiro, depois de o ferreiro prová-lo na lima. O negócio fechou-se sem sorriso."
Crônica (`refuse`): "No {dia}º dia {daEstacao}, o senhor de {feudo} mandou o carroceiro embora. Ele resmungou do preço, de ninguém e do tempo." Prazo vencido: "No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} mandou o carroceiro embora. Ele resmungou do preço, de ninguém e do tempo."
Crônica (desfecho bom, na virada seguinte): "No {dia}º dia {daEstacao}, os sacos do carroceiro foram abertos, e o ferro era bom. O ferreiro assobiou baixo."
Crônica (desfecho ruim, na virada seguinte): "No {dia}º dia {daEstacao}, os sacos do carroceiro foram abertos, e havia só pedra pintada de preto. O carroceiro já estava a três feudos dali."

**O motor precisará:** `rollEffect` (já proposto em 4.4; aqui com chance de 2 em 3) e o requisito de edifício `smithy: 1` na opção (já existe como requisito de opção). **Conta conferida contra `balance.ts`:** o ferro vale 8,0 de ouro no balcão, então 60 de ferro valeriam 480. A `buy` paga 260 por um valor esperado de 40 de ferro (6,5 de ouro por unidade); a `half` paga 130 por 30 (cerca de 4,3 por unidade), sem risco. **Sem arbitragem:** vender o ferro de volta paga 85% de 8,0, ou 6,8 por unidade: 40 de ferro esperados rendem 272 contra 260 pagos (margem de 12, que o risco de perder tudo come), e os 30 da `half` rendem 204 contra 130, uma margem real, de propósito: **o Ferreiro faz diferença**. Se a margem da `half` incomodar, ela sobe para 150 de ouro.

### 9.6 As outras dez do lote 3 (lista proposta, uma linha cada)

**Atualização:** as dez foram escritas nas seções 10 (segundo lote de cinco) e 11 (terceiro lote de cinco); a lista abaixo fica como o roteiro de origem.

O que resta segue a lista do roadmap (§16.3), menos as cinco acima. **As quatro roteirizadas** entram nos lotes seguintes, na ordem em que o jogo as encontra. Cada uma indica a fase que liga a mecânica de que depende; a ficha só é escrita depois dela.

1. **O primeiro recruta** (roteirizada, quando o Salão chega ao Nv4 pela primeira vez): treinar o voluntário de graça como Lanceiro ou mandá-lo à Fazenda (+30 de comida). Usa só o Quartel; pode vir já no próximo lote.
2. **Os corvos do norte** (roteirizada, 1º dia de outono do ano 1): erguer a Torre de Vigia ao Nv3 com desconto de 25% ou ignorar o presságio (+5 de moral, "o povo prefere não saber"). Pede a Torre acima do Nv2 e os presságios.
3. **O desertor** (roteirizada, último dia de outono do ano 1): pagar 60 de ouro pela composição da próxima onda ou expulsá-lo (+5 de moral). Pede a Fortaleza da Horda.
4. **A véspera** (roteirizada, na noite anterior ao Cerco): festa (+10 de moral por 2 dias) ou vigília (milícia pronta sem custo de produção por uma noite). Pede o Cerco marcado.
5. **O capitão veterano** (avulsa): um herói Veterano com 20% de desconto na Taverna, ou recusar. Pede a Taverna Nv2 e o traço Veterano (já existe).
6. **A muralha rachada** (avulsa): reparar agora com 20% de desconto na pedra ou esperar. Pede a Muralha danificada (V4D).
7. **Saqueadores pedem passagem** (avulsa): pagar 40 de comida ou arriscar uma incursão fraca a mais. Pede o Acampamento de Saqueadores ativo.
8. **O espião da Horda** (avulsa): interrogar (um presságio) ou enforcar (+5 de moral). Pede a Fortaleza da Horda.
9. **Conselho de Guerra** (avulsa): um comandante Prudente abre a opção "ouvir", a prévia da próxima incursão de graça; as outras opções cobram ouro. Pede a Defesa ativa e um herói Prudente; **é a carta que usa as formações**.
10. **Depois da tempestade** (avulsa): luto (reparo com desconto) ou festa pelo cerco (moral). Pede o Rescaldo do Cerco.

**Cobertura.** Verão: 9.1; primavera, verão e outono: 9.4; qualquer estação: 9.5; 9.2 e 9.3 vêm por continuação. Mecânicas da v0.4 já cobertas neste lote: ferro (9.1, 9.2 e 9.5), armas (9.2 a 9.4), Ferreiro (9.1, 9.2 e 9.5) e Quartel e soldados (9.4). Formações, Muralha, Torre, presságios, Fortaleza e Cerco ficam para as dez acima.

## 10. Lote 3 do Conselho: segundo lote de cinco (para o autor)

**Lido e aprovado pelo autor em 2026-10-23** (decisão 23); as cartas marcadas com uma fase futura só entram com ela.

**Para leitura do autor** (V4H-T2; decisão 23: lotes de cinco). Nada disto está no código ainda. São as cinco primeiras das dez que a seção 9.6 deixou: **três roteirizadas** ("O primeiro recruta", "Os corvos do norte" e "O desertor"), uma avulsa de herói ("O capitão veterano") e uma de guerra ("O espião da Horda"). **Três delas dependem de mecânica de fase futura** e vêm marcadas "**entra só com a Fase X**": a ficha já está escrita com a mecânica, para o autor ler, mas a carta só entra no catálogo depois da fase (a Fase E liga a Torre Nv3+, a Fortaleza e os presságios; ADR 0020, decisões 16 e 18). As duas que não dependem de fase nenhuma são a 10.1 e a 10.4.

**Convenções.** As das seções 4 e 9, mais: **presságio** é a frase de Crônica que revela parte das ondas do cerco, com a clareza do nível da Torre (1: "muitas feras"; 3: tipo e ala; 5: composição exata; GDD §11.1); o efeito `omen { wave, clarity }` **entrega** um presságio sem sorteio, lido da versão atual da onda (ADR 0020, decisão 18: o presságio nunca mente sobre ela). Cada roteirizada tem `scripted` com um gatilho próprio, como a "Estrangeira ferida" (`atGameDay: 13`): sai no sorteio da audiência, na frente das sorteadas, uma vez por partida, e **pede lugar na mesa sem reservá-lo**.

### 10.1 O primeiro recruta (`firstRecruit`, roteirizada)

| Campo | Valor |
|---|---|
| Quando | **Roteirizada**, `scripted: { onHallLevel: 4 }` (gatilho novo): sai na primeira audiência com lugar depois de o Salão chegar ao Nv4 pela primeira vez, uma vez por partida; a partida que já passou do Nv4 a recebe na primeira audiência com lugar. Sem estação |
| Texto | "No dia em que o Salão ganhou o quarto andar e o Quartel pôde ser riscado no chão, um rapaz de ombros largos esperava no portão desde antes do sol. Não é herói, não é nobre e não tem arma. Quer aprender a segurar uma lança, e o pai dele, que lavra o campo ao lado, fingiu que não via." |

| Opção | Texto e efeitos | Hint | Autoaplica |
|---|---|---|---|
| `train` "Treiná-lo como Lanceiro" | Pede **Quartel Nv1 e vaga** (10 por nível, menos os soldados que já há). **+1 Lanceiro** entra no Quartel, já treinado, sem custo de treino (o lote custaria 30 de comida, 10 de ouro e 5 de madeira); ele sai da população e come 1,5 por hora, como todo soldado. Moral +5 por 2 dias (a aldeia se orgulha do primeiro) | "O primeiro soldado do feudo, de graça, pelo preço de um aldeão a menos." | |
| `farm` "Mandá-lo à Fazenda" | **+30 de comida**; moral +5 por 2 dias (o pai agradece) | "Um braço a mais na colheita, e um pai em paz." | as três dificuldades |

Crônica (`train`): "No {dia}º dia {daEstacao}, o senhor de {feudo} aceitou o primeiro recruta no Quartel. O rapaz recebeu uma lança mais alta do que ele e a segurou como quem segura um sonho."
Crônica (`farm`): "No {dia}º dia {daEstacao}, o senhor de {feudo} mandou o rapaz de volta à Fazenda. O pai trouxe pão ao Salão em sinal de gratidão." Prazo vencido: "No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} mandou o rapaz de volta à Fazenda. O pai trouxe pão ao Salão em sinal de gratidão."

**O motor precisará:** o gatilho `scripted.onHallLevel` (novo, ao lado de `atGameDay`; compara com o nível do Salão na hora do sorteio da audiência; sem passo de migração, como o `atGameDay`) e `addSoldiers { unit: 'spearman', amount: 1 }` (o mesmo efeito proposto em 9.4; não passa do teto do Quartel, e a opção fica trancada sem Quartel ou sem vaga). `resources` e `morale` existem. **Nenhuma fase futura**: só o Quartel (V4C-T1, já no `main`). **Conta conferida:** o custo evitado, 30 de comida, 10 de ouro e 5 de madeira (`units.ts`), é pequeno de propósito, e a `farm` rende 30 de comida; o que decide é ter ou não o Quartel e a vaga.

### 10.2 Os corvos do norte (`northernCrows`, roteirizada) — entra só com a Fase E

| Campo | Valor |
|---|---|
| Quando | **Roteirizada**, `scripted: { atSeasonStart: 'autumn', year: 1 }` (gatilho novo): sai na primeira audiência com lugar depois da virada que abre o outono do ano 1. Uma vez por partida |
| Texto | "Os corvos chegaram do norte numa nuvem e pousaram nas muralhas, nos telhados, até nas cruzes do cemitério. Não grasnavam. O guarda da torre diz que nunca viu bicho calado daquele jeito. Os mais velhos contam que, quando os corvos descem assim, a Horda vem atrás, e o povo, que ainda não ouviu a notícia direito, já olha para o alto." |

| Opção | Texto e efeitos | Hint | Autoaplica |
|---|---|---|---|
| `raise` "Erguer a Torre de Vigia ao Nv3" | Pede **Torre Nv2**. Inicia a obra do Nv3 com **25% de desconto** sobre o custo do nível (o custo é da V4E-T1); trancada sem os recursos ou sem a Torre no Nv2 | "Uma torre mais alta enxerga mais longe, e custa menos hoje do que custaria depois." | |
| `ask` "Consultar o eremita" | Custo 60 de ouro. **Um presságio de clareza 1** ("muitas feras") sobre as ondas do cerco, sem sorteio (`omen { clarity: 1 }`) | "Pouco se sabe, mas é mais do que antes." | |
| `ignore` "Não dar importância" | Moral +5 por 2 dias ("o povo prefere não saber") | "O que o povo não sabe, não o assusta." | as três dificuldades |

Crônica (`raise`): "No {dia}º dia {daEstacao}, os corvos do norte pousaram sobre {feudo}, e o senhor mandou erguer mais um andar na torre. Os pedreiros subiram ao amanhecer, e os corvos desceram um a um."
Crônica (`ask`): "No {dia}º dia {daEstacao}, o senhor de {feudo} mandou chamar o eremita por causa dos corvos. Ele olhou o céu um bom tempo e disse que vinham muitas feras."
Crônica (`ignore`): "No {dia}º dia {daEstacao}, o senhor de {feudo} não deu importância aos corvos. O povo agradeceu o sossego e fechou as janelas mais cedo." Prazo vencido: "No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} não deu importância aos corvos. O povo agradeceu o sossego e fechou as janelas mais cedo."

**O motor precisará (Fase E):** o gatilho `scripted.atSeasonStart` (novo); o **Nv3 da Torre de Vigia** (V4E-T1: hoje a Torre vai só ao Nv2); o efeito `startBuilding { building, level, discount }` (novo: inicia a obra pelo caminho de `startConstruction`, com o desconto sobre o custo); e `omen { wave?, clarity }` (novo, V4E-T3: grava o presságio na lista do Exército; sem `wave`, vale a onda que a Horda tem mais definida na versão atual). A `ask` não funciona sem os presságios. **Troca em relação à lista:** a lista tinha duas opções; a `ask` nasce porque, sem a Torre no Nv2, a primeira não pode existir, e a carta ficaria só com o "ignorar".

### 10.3 O desertor (`hordeDeserter`, roteirizada) — entra só com a Fase E

| Campo | Valor |
|---|---|
| Quando | **Roteirizada**, `scripted: { atSeasonEnd: 'autumn', year: 1 }` (gatilho novo): sai na primeira audiência com lugar a partir do **último dia do outono** do ano 1. Pede a Fortaleza da Horda de pé (ADR 0020, decisão 16). Uma vez por partida |
| Texto | "O homem chegou ao portão com um trapo amarrado no braço e uma marca de ferro quente no pescoço. Diz que marchava com a Horda até anteontem, que a comida lá é pior do que a nossa e que o Senhor da Guerra manda açoitar quem fala de casa. Fala depressa e olha para trás. O inverno bate à porta, e ele sabe o que vem com ele." |

| Opção | Texto e efeitos | Hint | Autoaplica |
|---|---|---|---|
| `buy` "Pagar pela composição de uma onda" | Custo 60 de ouro. **Um presságio de clareza 5** (a composição exata) da **onda 2** do cerco, lido da versão atual (`omen { wave: 2, clarity: 5 }`) | "Sessenta de ouro por saber exatamente o que vem na segunda noite." | |
| `question` "Interrogá-lo de graça" | Sem custo. **Um presságio de clareza 3** (o tipo e a ala) da onda 1; moral −5 por 2 dias (a aldeia não gosta do que ouve da sala do interrogatório) | "Ele fala por medo, e o que diz é só metade." | |
| `expel` "Expulsá-lo" | Sem custo. Moral +5 por 2 dias | "Um problema a menos, e uma pergunta sem resposta." | as três dificuldades |

Crônica (`buy`): "No {dia}º dia {daEstacao}, o senhor de {feudo} pagou ao desertor da Horda pela segunda onda do cerco. Ele contou tudo de olho no ouro e não olhou para trás ao sair."
Crônica (`question`): "No {dia}º dia {daEstacao}, o senhor de {feudo} interrogou o desertor da Horda. A sala ficou fechada até tarde, e a aldeia dormiu mal."
Crônica (`expel`): "No {dia}º dia {daEstacao}, o senhor de {feudo} expulsou o desertor da Horda. Ele tomou a estrada do sul sem uma palavra." Prazo vencido: "No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} expulsou o desertor da Horda. Ele tomou a estrada do sul sem uma palavra."

**O motor precisará (Fase E):** o gatilho `scripted.atSeasonEnd` (novo); a **Fortaleza da Horda** como tile de ameaça (V4E-T3), as **ondas geradas** na virada do outono (decisão 18) e `omen { wave, clarity }` com clareza 3 e 5. **Dúvida para o autor:** a Horda **regera** as ondas a cada formação nova até o inverno (decisão 18), e a carta sai no último dia do outono; um presságio dado aqui lê a versão daquele instante e pode ficar velho se o jogador mudar a Defesa ativa depois. A proposta é gravar a hora em que foi visto ("visto no último dia do outono") e deixar a tela dizer se ainda é a versão atual; o autor decide se prefere outra regra.

### 10.4 O capitão veterano (`veteranCaptain`, avulsa)

| Campo | Valor |
|---|---|
| Quando | Sorteada, peso 2, uma vez por ano. Qualquer estação; **Taverna Nv2** (`buildings: { tavern: 2 }`) e vaga na lista de heróis (`rosterCap`) |
| Texto | "Um homem de barba cinzenta e cicatriz de ponta a ponta no rosto entrou na Taverna e pagou a rodada com uma moeda de ouro de um rei que já morreu. Disse que lutou em onze cercos, que perdeu a conta dos feridos e que só quer uma cama e um posto onde não o chamem de velho. Quem o ouve conta que ele passou a noite sem sentar." |

| Opção | Texto e efeitos | Hint | Autoaplica |
|---|---|---|---|
| `hire` "Contratar o capitão" | Custo 240 de ouro (o Guerreiro Veterano da Taverna custa 300; aqui o desconto é de 20%). **Entra o herói nomeado Osbert, Guerreiro Veterano e Leal, nível 2**, pela mesma porta do herói de carta (`admitHero`); o soldo é o do nível 2 (3 de ouro por hora de jogo). Trancada sem vaga na lista | "Um veterano de casa pronta, mais barato do que no balcão." | |
| `feast` "Pagar-lhe a mesa e ouvir as histórias" | Custo 40 de comida. Moral +5 por 3 dias (as histórias correm a aldeia) | "Não é um herói que fica, mas é uma noite que o povo conta." | |
| `refuse` "Agradecer e deixá-lo seguir" | Sem efeito | "A Taverna tem outros hóspedes, e o ouro fica no cofre." | as três dificuldades |

Crônica (`hire`): "No {dia}º dia {daEstacao}, o senhor de {feudo} contratou o capitão Osbert. Ele pendurou a espada atrás da porta e perguntou onde ficava a pedra de amolar."
Crônica (`feast`): "No {dia}º dia {daEstacao}, o senhor de {feudo} pagou a mesa ao capitão veterano. Ele contou onze cercos até o galo cantar, e ninguém quis ir dormir."
Crônica (`refuse`): "No {dia}º dia {daEstacao}, o senhor de {feudo} deixou o capitão veterano seguir viagem. Ele tomou a estrada sem olhar para trás, que é o hábito de quem já se despediu muitas vezes." Prazo vencido: "No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} deixou o capitão veterano seguir viagem. Ele tomou a estrada sem olhar para trás, que é o hábito de quem já se despediu muitas vezes."

**O motor precisará:** nada novo no motor, só conteúdo: um herói nomeado a mais em `NAMED_HERO_IDS` (`osbert`, com `veteran` e `loyal`, nível 2, fixado em `council.test.ts`) e o efeito `addHero` existente (com o preço como custo da opção). O requisito de Taverna Nv2 e a vaga na lista (`rosterCap`) são requisitos de carta e de opção que já existem. **Nenhuma fase futura.** Usa o traço **Veterano** (nenhuma carta o usava) e o **Leal**. **Conta conferida:** 300 de ouro é o preço do `veteranWarrior` (`tavernCandidates`) e 240 é 80% dele; o soldo do nível 2 é 3 de ouro por hora (`wagePerHourByLevel`). A Taverna dá um herói sorteado, que depende da rotação; a carta dá um herói certo, de nome conhecido.

### 10.5 O espião da Horda (`hordeSpy`, avulsa) — entra só com a Fase E

| Campo | Valor |
|---|---|
| Quando | Sorteada, peso 2, uma vez por ano. **Outono**; Fortaleza da Horda de pé; Torre de Vigia Nv1 |
| Texto | "Os vigias prenderam um homem que dormia dentro de um celeiro, sem fogueira e sem arma, com uma pena de corvo atrás da orelha e um papel dobrado dentro da bota. Nega tudo, e depois pede água. A aldeia, que já viu muita coisa estranha este ano, quer enforcá-lo antes do jantar, e o capitão dos vigias quer ouvi-lo primeiro." |

| Opção | Texto e efeitos | Hint | Autoaplica |
|---|---|---|---|
| `interrogate` "Interrogá-lo" | Custo 30 de comida (os dias de cela). **Um presságio de clareza 3** (o tipo e a ala), sem sorteio (`omen { clarity: 3 }`); moral −5 por 2 dias | "Ele fala se tem fome, e o que diz vale a ração." | |
| `hang` "Enforcá-lo" | Sem custo. Moral +5 por 2 dias | "A aldeia dorme melhor, e o feudo sabe menos." | |
| `release` "Soltá-lo na estrada" | Sem efeito | "Ele leva de volta o que viu, e nada mais." | as três dificuldades |

Crônica (`interrogate`): "No {dia}º dia {daEstacao}, o senhor de {feudo} interrogou o espião da Horda. O papel dobrado na bota era um mapa, e o mapa tinha as portas do feudo marcadas com um corvo."
Crônica (`hang`): "No {dia}º dia {daEstacao}, o senhor de {feudo} mandou enforcar o espião da Horda. A aldeia assistiu em silêncio e voltou ao trabalho com a cabeça mais leve."
Crônica (`release`): "No {dia}º dia {daEstacao}, o senhor de {feudo} soltou o espião da Horda na estrada. Ele agradeceu duas vezes e não olhou para trás." Prazo vencido: "No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} soltou o espião da Horda na estrada. Ele agradeceu duas vezes e não olhou para trás."

**O motor precisará (Fase E):** a Fortaleza da Horda e os presságios (V4E-T3), com `omen { clarity }` (sem `wave`: vale a onda que a Horda tem mais definida na versão atual, sem sorteio no `applyCommand`). O requisito `tile` na carta (Fortaleza de pé) é novo; `morale` e `resources` existem. **Troca em relação à lista:** a lista dizia "interrogar (um presságio) ou enforcar (+5 de moral)"; entra a terceira opção, `release`, para a que o conselho aplica sozinho não punir quem falta (GDD §7.1).

### 10.6 Cobertura do segundo lote

Estações: 10.1 sem estação (gatilho do Salão), 10.2 e 10.3 no outono (roteirizadas), 10.4 em qualquer estação, 10.5 no outono. Mecânicas da v0.4 que este lote usa: Quartel e Lanceiros (10.1), Taverna e o traço Veterano (10.4) e, nas três da Fase E, a Torre Nv3, a Fortaleza e os presságios (10.2, 10.3 e 10.5). Roteirizadas com gatilho novo: `onHallLevel`, `atSeasonStart` e `atSeasonEnd`. Ficam as cinco da seção 11.

## 11. Lote 3 do Conselho: terceiro lote de cinco (para o autor)

**Lido e aprovado pelo autor em 2026-10-23** (decisão 23); as cartas marcadas com uma fase futura só entram com ela. A vigília de "A véspera" (11.5) segue a decisão 21: só adianta a convocação normal da milícia naquela noite (não produz, até 50% dos aldeões), dispensando o aviso da Torre.

**Para leitura do autor** (V4H-T2; decisão 23: lotes de cinco). Nada disto está no código ainda. São as cinco últimas do lote 3: **"Saqueadores pedem passagem"** e **"A muralha rachada"** (Fase E: o Acampamento e a Muralha), **"Conselho de Guerra"** (Fase E: a incursão completa; é a que usa as formações), **"Depois da tempestade"** (Fase G: o Rescaldo) e **"A véspera"** (roteirizada, Fase G: o Cerco marcado). **Todas as cinco são "entra só com a Fase X"**, e a ficha vem escrita com a mecânica para o autor ler. As convenções são as das seções 4, 9 e 10.

### 11.1 Saqueadores pedem passagem (`raidersAskPassage`, avulsa) — entra só com a Fase E

| Campo | Valor |
|---|---|
| Quando | Sorteada, peso 2, uma vez por ano. Primavera, verão ou outono; **Acampamento de Saqueadores ativo** (o tile nasce no 25º dia de jogo e some quando o jogador o ataca; ADR 0020, decisão 16); Torre de Vigia Nv1 |
| Texto | "Um cavaleiro de elmo sem plumas veio a pé até a ponte, deixou a espada no chão e levantou as duas mãos. Fala em nome do acampamento do outro lado da colina. Diz que os homens dele passam fome e que preferem comer a lutar, e que por uma carga de pão a estrada fica livre por um tempo. Pergunta, no fim, se o senhor aguenta a sua fome melhor do que eles aguentam a deles." |

| Opção | Texto e efeitos | Hint | Autoaplica |
|---|---|---|---|
| `pay` "Pagar a passagem" | Custo 40 de comida. **A Ameaça cai 10** (o acampamento se aquieta por um tempo); nenhuma incursão a mais | "Um saco de pão compra um pouco de sossego, e o sossego não dura." | |
| `risk` "Mandá-los embora" | Sem custo. **Uma incursão fraca de saqueadores é marcada** para 6 h de jogo depois (a antecedência de `raidLeadMs`) e vira batalha com a Defesa ativa; moral +5 por 2 dias (o povo gosta de quem não paga) | "Mais uma briga pequena, e a tropa treina com ela." | |
| `wait` "Deixá-lo esperar na ponte" | Sem efeito | "O cavaleiro espera, e o feudo pensa." | as três dificuldades |

Crônica (`pay`): "No {dia}º dia {daEstacao}, o senhor de {feudo} pagou a passagem aos saqueadores. A carroça de pão atravessou a ponte e voltou vazia."
Crônica (`risk`): "No {dia}º dia {daEstacao}, o senhor de {feudo} mandou os saqueadores embora. O cavaleiro pegou a espada do chão e disse que voltariam, e que não viriam de mãos abertas."
Crônica (`wait`): "No {dia}º dia {daEstacao}, o senhor de {feudo} deixou o cavaleiro dos saqueadores esperar na ponte. Ao fim da tarde, ele já tinha ido embora." Prazo vencido: "No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} deixou o cavaleiro dos saqueadores esperar na ponte. Ao fim da tarde, ele já tinha ido embora."

**O motor precisará (Fase E):** o Acampamento de Saqueadores como tile de ameaça (V4E-T2/T3: nasce no 25º dia, soma +2 por dia), o requisito `tile` na carta (o mesmo da 10.5), `threat { delta }` (efeito novo: soma ou tira Ameaça, entre 0 e 100) e `scheduleRaid { kind: 'weak', afterMs }` (efeito novo: marca uma incursão fraca de saqueadores no calendário, pela mesma porta das roteirizadas; se a composição precisar de sorteio, ele sai da virada de dia, nunca do `applyCommand`). **Conta conferida:** a incursão repelida tira 35 da Ameaça (`raidDrop`), então a `risk` também a baixa, com uma briga; a `pay` tira só 10, por 40 de comida.

### 11.2 A muralha rachada (`crackedWall`, avulsa) — entra só com a Fase E

| Campo | Valor |
|---|---|
| Quando | Sorteada, peso 2, uma vez por ano. Qualquer estação; **Muralha de Pedra (Paliçada Nv3 ou mais) com alguma ala abaixo da vida cheia** depois de uma batalha. Não sai com a Muralha nova nem sem batalha |
| Texto | "O pedreiro subiu na muralha com um prumo e um balde, desceu sem dizer nada e esperou o senhor chegar. Mostrou, no meio da ala, uma fenda do tamanho de um braço, escura por dentro, onde a pedra velha já tinha cedido ao martelo do último ataque. Diz que dá para remendar hoje por pouco, ou esperar, e deixar a pedra decidir sozinha quando cai." |

| Opção | Texto e efeitos | Hint | Autoaplica |
|---|---|---|---|
| `repair` "Reparar agora" | Repara **a muralha inteira** pelo caminho do reparo (15 min de jogo por 25% da vida de uma ala), com **20% de desconto** em pedra e em ouro sobre o reparo do nível (no Nv3, 225 de pedra e 225 de ouro viram 180 e 180). Trancada sem os recursos | "O reparo de sempre, mais barato, se for hoje." | |
| `patch` "Remendar o que dá" | Custo 60 de pedra. **A ala mais ferida recupera 25% da vida** na hora, sem a fila do reparo | "Um remendo de ponte: aguenta a primeira chuva." | |
| `wait` "Esperar" | Sem efeito | "A pedra aguenta até aguentar." | as três dificuldades |

Crônica (`repair`): "No {dia}º dia {daEstacao}, o senhor de {feudo} mandou reparar a muralha rachada. Os pedreiros trabalharam até o fim do dia, e o balde subiu e desceu cheio de argamassa."
Crônica (`patch`): "No {dia}º dia {daEstacao}, o senhor de {feudo} mandou remendar a fenda da muralha. O pedreiro bateu na pedra três vezes e disse que, por enquanto, estava firme."
Crônica (`wait`): "No {dia}º dia {daEstacao}, o senhor de {feudo} deixou a muralha rachada como estava. O pedreiro desceu da escada e olhou a fenda mais uma vez, sem esperança." Prazo vencido: "No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} deixou a muralha rachada como estava. O pedreiro desceu da escada e olhou a fenda mais uma vez, sem esperança."

**O motor precisará (Fase E):** a Muralha de Pedra com vida por ala e o reparo (V4E-T1: vida 60, 100, 200, 320, 500 e 800 do Nv1 ao Nv6; reparo com metade da pedra do nível e ouro igual à pedra, 15 min de jogo por 25% da vida de uma ala; ADR 0020), o requisito `wallDamaged` (novo, na carta) e `repairWall { discount }` e `healWall { fraction }` (efeitos novos, que usam a mesma conta do reparo, sem sorteio). **Troca em relação à lista:** a lista tinha duas opções; a `patch` entra para o jogador sem pedra e ouro para o reparo inteiro ter uma saída que não seja esperar.

### 11.3 Conselho de Guerra (`warCouncil`, avulsa) — entra só com a Fase E

| Campo | Valor |
|---|---|
| Quando | Sorteada, peso 2, uma vez por ano. Primavera, verão ou outono; **Defesa ativa** definida (V4C-T2) e uma **incursão marcada** no calendário (a que a Torre já avisa; V4E-T2). É a carta que usa as formações |
| Texto | "Os comandantes de ala pediram a mesa grande do Salão e espalharam sobre ela pedras, pinhas e pedaços de pão: cada coisa, um esquadrão. Brigam baixo sobre quem fica à frente e quem fica no flanco. O que fala menos, de braços cruzados, pede só um momento para escutar o que vem, antes de qualquer um mexer numa pinha. Falta saber a quem o senhor dá ouvidos." |

| Opção | Texto e efeitos | Hint | Autoaplica |
|---|---|---|---|
| `listen` "Ouvir o comandante prudente" | **Pede um comandante com o traço Prudente na Defesa ativa.** Sem custo. **A composição da próxima incursão** (tipos e quantidades por ala) é revelada de graça, como uma prévia (`revealRaid`) | "Quem pensa antes de agir conhece o inimigo antes de ele chegar." | |
| `hear` "Ouvir a todos" | Custo 50 de ouro (a ceia dos comandantes). A mesma prévia: **a composição da próxima incursão** | "A mesa fica cheia, a prévia também, e o cofre, mais leve." | |
| `leave` "Deixar que decidam sozinhos" | Sem efeito | "Os comandantes sabem o que fazem, e o senhor confia." | as três dificuldades |

Crônica (`listen`): "No {dia}º dia {daEstacao}, o senhor de {feudo} ouviu o comandante prudente no Conselho de Guerra. Ele moveu duas pinhas e disse, baixinho, o que vinha do norte."
Crônica (`hear`): "No {dia}º dia {daEstacao}, o senhor de {feudo} ouviu todos os comandantes no Conselho de Guerra. A ceia durou até tarde, e a pinha do meio mudou de lugar três vezes."
Crônica (`leave`): "No {dia}º dia {daEstacao}, o senhor de {feudo} deixou os comandantes decidirem sozinhos. A mesa grande ficou posta para ninguém." Prazo vencido: "No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} deixou os comandantes decidirem sozinhos. A mesa grande ficou posta para ninguém."

**O motor precisará (Fase E):** o requisito `commanderTrait: 'prudent'` na opção (novo: lê a Defesa ativa e o traço do comandante de cada ala; a opção fica trancada sem esse comandante) e o efeito `revealRaid` (novo, V4E-T2: grava na visão a composição da próxima incursão marcada, **sem sortear**, pelo mesmo caminho que a visão usa para a previsão). O traço **Prudente** nenhuma carta o usava. **Conta:** a `hear` cobra 50 de ouro, dentro do tamanho dos ouros das cartas já aprovadas (30 a 120); quem tem um comandante Prudente na Defesa ativa poupa o ouro.

### 11.4 Depois da tempestade (`afterTheStorm`, avulsa) — entra só com a Fase G

| Campo | Valor |
|---|---|
| Quando | Sorteada, peso 2, uma vez por ano. **Só no Rescaldo** (entre o fim do cerco e o fim do inverno; ADR 0020, decisão 22) |
| Texto | "O vento parou na manhã seguinte, e com ele o cheiro de fumaça. A aldeia saiu à rua devagar, como depois de um enterro. Os que ficaram contam os que não voltaram, e os que não voltaram vão ser contados de novo no verão. Falta decidir como o feudo vai chorar, ou se vai chorar de uma vez e cuidar do que sobrou." |

| Opção | Texto e efeitos | Hint | Autoaplica |
|---|---|---|---|
| `mourn` "Erguer um marco aos mortos" | Pede que **o cerco tenha deixado mortos** (flag do rescaldo). Custo 80 de pedra. Moral +10 por 3 dias | "Uma pedra com os nomes, e a aldeia olha o futuro de cabeça erguida." | |
| `feast` "Festejar o cerco vencido" | Pede **cerco vencido** (Vitória, Gloriosa ou não). Custo 100 de comida e 50 de ouro. Moral +10 por 2 dias, além do que o Rescaldo já dá | "Quem sobrevive tem o direito de comer à mesa cheia." | |
| `rebuild` "Pôr todos nas pedras" | Sem custo. **O desconto de reparo do Rescaldo sobe 10 pontos** (o número do Rescaldo é da V4G-T2); moral −5 por 2 dias (ninguém teve tempo de chorar) | "O luto fica para o verão, e o reparo, para hoje." | |
| `leave` "Deixar cada um com o seu luto" | Sem efeito | "A aldeia sabe o que fazer, e o senhor não se mete." | as três dificuldades |

Crônica (`mourn`): "No {dia}º dia {daEstacao}, o senhor de {feudo} mandou erguer um marco aos mortos do cerco. Os nomes foram riscados a ponta de faca, e a aldeia leu todos em voz alta."
Crônica (`feast`): "No {dia}º dia {daEstacao}, {feudo} festejou o cerco vencido. A mesa foi posta na praça, e até os cães comeram à vontade."
Crônica (`rebuild`): "No {dia}º dia {daEstacao}, o senhor de {feudo} pôs a aldeia inteira nos reparos. O luto ficou para o verão, e as pedras foram assentadas antes do meio-dia."
Crônica (`leave`): "No {dia}º dia {daEstacao}, o senhor de {feudo} deixou cada um com o seu luto. A aldeia andou em silêncio por três dias." Prazo vencido: "No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} deixou cada um com o seu luto. A aldeia andou em silêncio por três dias."

**O motor precisará (Fase G):** o Rescaldo (V4G-T2) como janela, as flags `siege.casualties` e `siege.won` gravadas ao fim do cerco (o motor as põe, a carta só as lê), o requisito de carta `phase: 'aftermath'` (novo) e `repairDiscount { points }` (efeito novo, que soma ao desconto de reparo do Rescaldo até o fim do inverno). `resources` e `morale` existem. **Troca em relação à lista:** a lista tinha duas opções ("luto ou festa"); entram a `rebuild` e a `leave`, e o luto passa a ser a `mourn`, para o jogador sem mortos ou sem vitória ter uma saída. O luto (−10 de moral por 1 dia com mortos) e a festa (+15 com Vitória Gloriosa) do próprio Rescaldo seguem automáticos; as opções da carta **somam** a eles, e o autor pode preferir o contrário.

### 11.5 A véspera (`siegeEve`, roteirizada) — entra só com a Fase G

| Campo | Valor |
|---|---|
| Quando | **Roteirizada**, `scripted: { beforeSiege: true }` (gatilho novo): sai na primeira audiência com lugar depois de o Cerco ficar **marcado** (GDD §4.3), uma vez por ano. Inverno |
| Texto | "A noite antes do cerco não parece uma noite. Há luz em todas as janelas, o ferreiro bate numa lâmina que já estava pronta e as crianças foram mandadas cedo para a cama sem que nenhuma dormisse. Alguém deixou uma fogueira acesa no meio da praça e ninguém foi apagá-la. A aldeia espera que o senhor diga o que fazer com a espera." |

| Opção | Texto e efeitos | Hint | Autoaplica |
|---|---|---|---|
| `feast` "Fazer uma festa" | Custo 60 de comida e 30 de ouro. Moral +10 por 2 dias | "Se for a última noite, que seja boa. Se não for, também." | |
| `vigil` "Passar a noite em vigília" | Sem custo. **A milícia fica pronta**: até 25% dos aldeões são convocados na véspera e **não deixam de produzir até a batalha começar** (a decisão 21 pede que ela pare de produzir ao ser convocada; aqui o corte começa só na batalha). Moral −5 por 1 dia (o povo não dorme) | "Todos de pé, e o trabalho não para até o primeiro corno." | |
| `rest` "Mandar o povo descansar" | Sem efeito | "O sono vale mais do que a preparação, na noite certa." | as três dificuldades |

Crônica (`feast`): "Na véspera do cerco, o senhor de {feudo} mandou pôr a mesa na praça. Bebeu-se à saúde de todos, vivos e mortos futuros, e a fogueira ficou acesa até o fim."
Crônica (`vigil`): "Na véspera do cerco, o senhor de {feudo} mandou fazer vigília. Os aldeões armados se alinharam nas muralhas e o ferro das lanças brilhou de noite."
Crônica (`rest`): "Na véspera do cerco, o senhor de {feudo} mandou o povo descansar. A aldeia dormiu mal, mas dormiu." Prazo vencido: "Na véspera do cerco, sem palavra do senhor, o conselho de {feudo} mandou o povo descansar. A aldeia dormiu mal, mas dormiu."

**O motor precisará (Fase G):** o gatilho `scripted.beforeSiege` (novo; V4G-T1/T2, a partir do Cerco marcado); **o prazo da carta limitado ao instante do Cerco** (o prazo de 24 h reais pode passar da hora da primeira onda: vale o menor entre as 24 h e o início do cerco, e a opção do conselho vale na hora); `militiaReady { fraction: 1/4 }` (efeito novo: convoca a milícia sem o corte de produção até o início da batalha; as regras de 3/2/12, ×5/4 e as baixas contra a população, com o piso de 3, são as da decisão 21). **Dúvida para o autor:** a decisão 21 limita a milícia a até 50% dos aldeões e só dentro da antecedência da Torre; o 25% da carta é proposta nova e não contradiz o limite, e a carta vale mesmo sem Torre (ela é o próprio aviso). A Crônica não usa `{dia}º dia`, porque a véspera não é um dia de calendário que o jogador conte.

### 11.6 Cobertura do lote 3 e as 60

Com as seções 9, 10 e 11, as 15 do lote 3 estão escritas: 9.1 a 9.5, 10.1 a 10.5 e 11.1 a 11.5. **Quatro roteirizadas**: 10.1, 10.2, 10.3 e 11.5. **Cadeia**: 9.1 a 9.3. **Fase de que cada uma depende:** sem fase futura, 9.1 a 9.5, 10.1 e 10.4; Fase E, 10.2, 10.3, 10.5, 11.1, 11.2 e 11.3; Fase G, 11.4 e 11.5. **Traços e mecânicas da v0.4 que o lote usa:** Veterano e Leal (10.4), Prudente (11.3), Torre Nv3 (10.2), Fortaleza e presságios (10.2, 10.3, 10.5), Acampamento (11.1), Muralha (11.2), formações (11.3), Rescaldo (11.4), Cerco e milícia (11.5). A sabotagem (Fase F) não entra em carta nenhuma do lote 3.
