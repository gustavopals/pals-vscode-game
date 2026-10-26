# Batalha: 2.3 Contra-ataque

Sorte fixada em 100 (docs/content-v0.4.md, seção 2.0). Gravado com UPDATE_GOLDEN=1; o teste confere também, linha a linha, que a conta é a do documento.

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

**Desfecho.** victory (annihilation), vence D, em 3 rodadas.

**Relatório** (`battleReport.ts`, sem o registro por rodada):

```json
{
 "id": "battle-1",
 "foughtAtMs": 0,
 "formationId": null,
 "mode": "defense",
 "outcome": "victory",
 "ending": "annihilation",
 "rounds": 3,
 "decisive": [
  {
   "factor": "counter",
   "owner": "player",
   "amount": 93,
   "wing": "center",
   "round": 1,
   "percent": null
  }
 ],
 "casualties": [
  {
   "owner": "player",
   "wing": "center",
   "line": "front",
   "unit": "spearman",
   "start": 12,
   "lost": 2
  },
  {
   "owner": "horde",
   "wing": "center",
   "line": "front",
   "unit": "blackKnight",
   "start": 6,
   "lost": 6
  }
 ],
 "wall": [],
 "commanders": []
}
```
