# Retratos do estado

Um arquivo por cenário e por versão do `GameState`: `state-v<versão>-<cenário>.json`. Cada um é o JSON de `games.state`, como o motor daquela versão o gravava.

- **Versão atual:** escritos e conferidos por `../fixtures.test.ts`, como goldens. Mudou uma regra, o diff aparece aqui; regravar é com `UPDATE_GOLDEN=1`.
- **Versões anteriores:** congelados. São a entrada dos testes de migração (`../migrations.test.ts`), que guardam a impressão digital de cada arquivo. **Não edite, não reformate, não regrave.** Se um teste de migração falhar, o defeito está no passo de migração.

| Cenário | O que tem |
|---|---|
| `fresh` | Feudo recém-criado, sem nenhuma ordem |
| `construction` | Obra em curso, duas obras planejadas, dois aldeões a caminho, acumuladores no meio de um trecho |
| `famine` | Fome aberta, com um aldeão na fila de recrutamento congelada |
| `cold` | A partir da versão 3: frio aberto desde a virada para o inverno, madeira em zero, sem fome, um aldeão a caminho |
| `objectives` | Os quatro primeiros objetivos concluídos |
| `week-scripted` | O cenário roteirizado de 7 dias (o golden do motor): ano 2, feudo renomeado |
| `week-bot-3x` | Só na versão 1: o bot econômico do simulador, 7 dias reais no ritmo 3 (ano 4, estoque alto) |
| `migrated-3x` | A partir da versão 2: o `week-bot-3x` da versão 1 migrado (Senhor, ritmo 3) e jogado por mais cinco dias de jogo. `migratedAtMs` numérico e bem anterior a `lastProcessedAt`; obra em curso, uma planejada, um recruta a caminho |
| `iron-king-half` | A partir da versão 2: Rei de Ferro no ritmo 0,5 (o único não inteiro), com obra, planejada e recruta, no meio de um trecho |
| `peasant-3x` | A partir da versão 2: Camponês no ritmo 3, nascido na versão (`migratedAtMs: null`) e já no ano 3 |

`cold` cobre o que as estações com efeito (V2C-T1) puseram no estado: o frio aberto, que o passo seguinte precisa encontrar. Os três últimos cobrem o que a fundação da v0.2 pôs no estado e que os passos seguintes leem: a fronteira, o ritmo e a dificuldade. `fixtures.test.ts` exige que os cenários tenham uma fronteira antiga, uma partida sem fronteira no ano 3, os ritmos 1, 3 e 0,5 e as três dificuldades.

Os retratos da versão 1 foram gerados com o motor da v0.1 (commit `9b1d3e8`, o mesmo motor da tag `v0.1.0`) antes de o tipo mudar. Nomes e sementes são de teste: nenhum veio de uma conta real.

Como acrescentar uma versão: [README do motor](../../README.md), "Versões do estado e migração".
