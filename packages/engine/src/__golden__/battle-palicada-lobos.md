# Batalha: 2.1 Paliçada contra lobos

Sorte fixada em 100 (docs/content-v0.4.md, seção 2.0). Gravado com UPDATE_GOLDEN=1; o teste confere também, linha a linha, que a conta é a do documento.

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

**Desfecho.** victory (annihilation), vence D, em 2 rodadas.

**Relatório** (`battleReport.ts`, sem o registro por rodada):

```json
{
 "id": "battle-1",
 "foughtAtMs": 0,
 "formationId": null,
 "mode": "defense",
 "outcome": "victory",
 "ending": "annihilation",
 "rounds": 2,
 "decisive": [
  {
   "factor": "wallAbsorbed",
   "owner": "player",
   "amount": 120,
   "wing": null,
   "round": 1,
   "percent": 81
  },
  {
   "factor": "counter",
   "owner": "player",
   "amount": 120,
   "wing": null,
   "round": 1,
   "percent": null
  },
  {
   "factor": "flank",
   "owner": "player",
   "amount": 3,
   "wing": "center",
   "round": 1,
   "percent": null
  }
 ],
 "casualties": [
  {
   "owner": "player",
   "wing": "left",
   "line": "front",
   "unit": "spearman",
   "start": 10,
   "lost": 0
  },
  {
   "owner": "player",
   "wing": "center",
   "line": "front",
   "unit": "shieldbearer",
   "start": 5,
   "lost": 0
  },
  {
   "owner": "player",
   "wing": "right",
   "line": "front",
   "unit": "spearman",
   "start": 10,
   "lost": 0
  },
  {
   "owner": "horde",
   "wing": "left",
   "line": "front",
   "unit": "wolf",
   "start": 8,
   "lost": 8
  },
  {
   "owner": "horde",
   "wing": "right",
   "line": "front",
   "unit": "wolf",
   "start": 8,
   "lost": 8
  }
 ],
 "wall": [
  {
   "wing": "left",
   "start": 60,
   "end": 0
  },
  {
   "wing": "center",
   "start": 60,
   "end": 60
  },
  {
   "wing": "right",
   "start": 60,
   "end": 0
  }
 ],
 "commanders": []
}
```
