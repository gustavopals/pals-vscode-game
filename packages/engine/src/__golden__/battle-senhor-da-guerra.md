# Batalha: 2.7 Senhor da Guerra

Sorte fixada em 100 (docs/content-v0.4.md, seção 2.0). Gravado com UPDATE_GOLDEN=1; o teste confere também, linha a linha, que a conta é a do documento.

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

**Desfecho.** victory (chiefFell), vence D, em 3 rodadas.

**Relatório** (`battleReport.ts`, sem o registro por rodada):

```json
{
 "id": "battle-1",
 "foughtAtMs": 0,
 "mode": "defense",
 "outcome": "victory",
 "ending": "chiefFell",
 "rounds": 3,
 "decisive": [
  {
   "factor": "aura",
   "owner": "horde",
   "amount": 28,
   "wing": null,
   "round": 1,
   "percent": null
  }
 ],
 "casualties": [
  {
   "owner": "player",
   "wing": "left",
   "line": "front",
   "unit": "knight",
   "start": 10,
   "lost": 0
  },
  {
   "owner": "player",
   "wing": "center",
   "line": "front",
   "unit": "knight",
   "start": 10,
   "lost": 0
  },
  {
   "owner": "player",
   "wing": "right",
   "line": "front",
   "unit": "knight",
   "start": 10,
   "lost": 0
  },
  {
   "owner": "horde",
   "wing": "left",
   "line": "front",
   "unit": "raider",
   "start": 10,
   "lost": 10
  },
  {
   "owner": "horde",
   "wing": "center",
   "line": "front",
   "unit": "warlord",
   "start": 1,
   "lost": 1
  },
  {
   "owner": "horde",
   "wing": "right",
   "line": "front",
   "unit": "raider",
   "start": 10,
   "lost": 9
  }
 ],
 "wall": [],
 "commanders": []
}
```
