# Batalha: 2.4 Ogro e muralha

Sorte fixada em 100 (docs/content-v0.4.md, seção 2.0). Gravado com UPDATE_GOLDEN=1; o teste confere também, linha a linha, que a conta é a do documento.

**Rodada 1**

- D-CF 6 Lanceiro → A-CF 1 Ogro: bruto = 6×6×3/2 (contra)×100/100 = 54; absorvido = 6×1×1/2 = 3; efetivo = máx(54 − 3, 54/5) = máx(51, 54/5), piso 51; baixas = piso((51 + 0)/80) = 0; restam 1, residual 51
- A-CF 1 Ogro → D-CF 6 Lanceiro: bruto = 14×1×100/100 = 14; à muralha (1/2): piso(7) = 7, muralha 100 → 93; às tropas 7; absorvido = 4×6×1/2 = 12; efetivo = máx(7 − 12, 7/5) = máx(-5, 7/5), piso 1; baixas = piso((1 + 0)/20) = 0; restam 6, residual 1

Fim da rodada 1: moral D 100, A 100; D-CF 6 (res 1), A-CF 1 (res 51); muralha {1: 93}

**Rodada 2**

- D-CF 6 Lanceiro → A-CF 1 Ogro: bruto = 6×6×3/2 (contra)×100/100 = 54; absorvido = 6×1×1/2 = 3; efetivo = máx(54 − 3, 54/5) = máx(51, 54/5), piso 51; baixas = piso((51 + 51)/80) = 1; restam 0, residual 0
  - A-CF destruído: moral A −10 → 90
  - ala C do lado A caiu: moral −20 → 70

**Desfecho.** victory (annihilation), vence D, em 2 rodadas.

**Relatório** (`battleReport.ts`, sem o registro por rodada):

```json
{
 "id": "battle-1",
 "foughtAtMs": 0,
 "mode": "defense",
 "outcome": "victory",
 "ending": "annihilation",
 "rounds": 2,
 "decisive": [
  {
   "factor": "counter",
   "owner": "player",
   "amount": 36,
   "wing": "center",
   "round": 1,
   "percent": null
  },
  {
   "factor": "wallAbsorbed",
   "owner": "player",
   "amount": 7,
   "wing": "center",
   "round": 1,
   "percent": 50
  }
 ],
 "casualties": [
  {
   "owner": "player",
   "wing": "center",
   "line": "front",
   "unit": "spearman",
   "start": 6,
   "lost": 0
  },
  {
   "owner": "horde",
   "wing": "center",
   "line": "front",
   "unit": "ogre",
   "start": 1,
   "lost": 1
  }
 ],
 "wall": [
  {
   "wing": "center",
   "start": 100,
   "end": 93
  }
 ],
 "commanders": []
}
```
