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
