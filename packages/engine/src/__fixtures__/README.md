# Retratos do estado

Um arquivo por cenário e por versão do `GameState`: `state-v<versão>-<cenário>.json`. Cada um é o JSON de `games.state`, como o motor daquela versão o gravava.

- **Versão atual:** escritos e conferidos por `../fixtures.test.ts`, como goldens. Mudou uma regra, o diff aparece aqui; regravar é com `UPDATE_GOLDEN=1`.
- **Versões anteriores:** congelados. São a entrada dos testes de migração (`../migrations.test.ts`), que guardam a impressão digital de cada arquivo. **Não edite, não reformate, não regrave.** Se um teste de migração falhar, o defeito está no passo de migração.

| Cenário | O que tem |
|---|---|
| `fresh` | Feudo recém-criado, sem nenhuma ordem |
| `construction` | Obra em curso, duas obras planejadas, dois aldeões a caminho, acumuladores no meio de um trecho |
| `famine` | Fome aberta, com um aldeão na fila de recrutamento congelada |
| `objectives` | Os quatro primeiros objetivos concluídos |
| `week-scripted` | O cenário roteirizado de 7 dias (o golden do motor): ano 2, feudo renomeado |
| `week-bot-3x` | Só na versão 1: o bot econômico do simulador, 7 dias reais no ritmo 3 (ano 4, estoque alto) |

Os retratos da versão 1 foram gerados com o motor da v0.1 (commit `9b1d3e8`, o mesmo motor da tag `v0.1.0`) antes de o tipo mudar. Nomes e sementes são de teste: nenhum veio de uma conta real.

Como acrescentar uma versão: [README do motor](../../README.md), "Versões do estado e migração".
