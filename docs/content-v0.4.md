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

Fim da rodada 1: moral D 100, A 100; D-EF 10 (res 0), D-DF 10 (res 0), D-CF 5 (res 0), A-EF 2 (res 13), A-DF 3 (res 12); muralha {0: 4, 1: 60, 2: 4}

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

### 4.6 O que fica para os próximos lotes (13 cartas)

Ordem proposta: cada lote de cinco fecha uma ideia, e o último tem três. **O lote B (cartas 6 a 10) saiu: está na seção 5, para o autor ler.** Os lotes seguintes mantêm as letras C, D e E. O "aprendiz e o Mestre" (4.5) volta à lista quando o Mestre puder ensinar o ofício.

**Lote C, "O Cobrador do Rei" e o início do Lobo Branco (5).**

- 11. Impostos do Rei (cadeia 1/3, recorrente, Salão Nv3): pagar, negociar (Carismático) ou recusar. Pede `heroTrait`.
- 12. O Cobrador do Rei (cadeia 2/3): multa dobrada, negociar ou ceder parte, com o ramo de soldados da v0.4 (sem adaptação).
- 13. A resposta da coroa (cadeia 3/3): desfecho por ramo, com batalha se o jogador recusou duas vezes.
- 14. Pegadas brancas (Lobo Branco 1/3, outono, depois do Covil limpo): caçar, oferecer carne ou ignorar. Pede `clearedTiles`.
- 15. O Lobo Branco (Lobo Branco 2/3): a caçada como expedição especial, ou a oferenda que se repete, com presságio da v0.4.

**Lote D, o fim do Lobo Branco e a vida na Guilda (5).**

- 16. O que a floresta devolve (Lobo Branco 3/3): desfecho que lembra quem caçou, com cerco da v0.4.
- 17. Um bardo na Taverna (avulsa): pagar pela canção (moral) ou mandá-lo embora. Pede Taverna.
- 18. Recrutador de passagem (avulsa): pagar por um candidato a mais nesta rotação. Pede Taverna e um efeito sobre a rotação.
- 19. A dívida de jogo (avulsa): cobrir a dívida de um herói ou deixá-lo resolver. Pede `heroPresent`.
- 20. Duelo na praça (avulsa): permitir (moral, risco de ferimento leve) ou proibir. Pede `heroPresent` e `rollEffect`.

**Lote E, o que sobra e a roteirizada (3).**

- 21. O curandeiro errante (avulsa): pagar pela cura de um herói ferido ou esperar. Pede `injuredHero`.
- 22. O mapa rasgado (avulsa): comprar meio mapa, que revela um destino mais cedo. Pede Guilda e `revealDestination`.
- 23. O mercador itinerante (roteirizada, dia 20 do ano 1): trocar excedente por ouro uma vez, a preço ruim, ou esperar ter o Mercado. Sai por `scripted`; prepara o Mercado.

A "Estrangeira ferida", roteirizada, já está no jogo desde a v0.3. Com as quatro aprovadas da seção 4, as cinco da seção 5 e as 13 acima, são 22 das 23 do roadmap da v0.4 (as 24 da v0.3 menos ela); a 23ª é o aprendiz (4.5), que espera o Mestre poder ensinar.

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

