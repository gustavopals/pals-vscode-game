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
| `storage` | A partir da versão 4: Rei de Ferro com o Celeiro erguido e cheio (720 de comida), o Armazém em obra, desperdício no total (`stats.wasted_*`) e no contador que a Crônica ainda não relatou (`settlement.wasted`) |
| `queues` | A partir da versão 5: o Salão no nível 4 com as duas filas ocupadas (a Serraria e a Mina de Ouro) e três planejadas na lista: a Serraria de novo, automática, esperando a obra anterior dela; as Habitações, manuais; e o Salão, automático, esperando recurso. No ritmo 3, no meio de um trecho |
| `crafts` | A partir da versão 6: outono, no meio de um dia de jogo, com um ofício em cada situação. A Fazenda (nível 3, experiência 40) com quatro lavradores, dois deles em uma coorte de adaptação; a Serraria dominada (experiência 100, com o ano em `craftMasteredYear`); a Pedreira no nível 3 com dois canteiros, um a menos do que o nível pede, e um deles em outra coorte, mais nova; a Mina de Ouro vazia, com experiência a perder |
| `morale` | A partir da versão 7: o feudo orgulhoso, no 6º dia do verão, no meio de um dia de jogo. A moral em 80, um efeito temporário ainda na lista (`moraleEffects`, +30 até a virada do 10º dia; o de −10, que venceu, já saiu), o fluxo `morale` do gerador com os quatro inteiros dele e um colono que chegou sozinho |
| `threat` | A partir da versão 9: a Torre de Vigia erguida a tempo de os vigias contarem a Ameaça passando dos 40, a obra do nível 2 em curso, a Ameaça em 45, o Covil de Lobos ativo e nenhuma incursão marcada (a partir da versão 11, a do roteiro do ano 1, ainda sem aviso). No meio de um dia de jogo, com cartas do Conselho na mesa |
| `palisade` | A partir da versão 10: o Salão no nível 3, a Paliçada prometida aos aldeões, erguida e mostrada no prazo (a flag da promessa cumprida e o efeito de moral dela), e a obra do nível 2 em curso. No meio de um dia de jogo, com uma carta do sorteio na mesa |
| `raid` | A partir da versão 11: os lobos do roteiro acabaram de passar por um feudo com Torre e sem Paliçada, com todos no ofício. Um lavrador ferido (com o edifício a que volta), o efeito de moral da incursão, a Ameaça já derrubada a 65 e a contagem em `stats.raids_suffered`. No meio do dia do ataque |
| `raid-announced` | A partir da versão 11: um feudo com Torre no nível 2 e Paliçada no nível 1, com uma incursão média que a Ameaça sorteou já anunciada pelos vigias (`announcedAtMs`), ainda por chegar. O fluxo `horde` do gerador já foi usado |
| `objectives` | Os quatro primeiros objetivos concluídos |
| `week-scripted` | O cenário roteirizado de 7 dias (o golden do motor): ano 2, feudo renomeado |
| `week-bot-3x` | Só na versão 1: o bot econômico do simulador, 7 dias reais no ritmo 3 (ano 4, estoque alto) |
| `migrated-3x` | A partir da versão 2: o `week-bot-3x` da versão 1 migrado (Senhor, ritmo 3) e jogado por mais cinco dias de jogo. `migratedAtMs` numérico e bem anterior a `lastProcessedAt`; obra em curso, uma planejada, um recruta a caminho |
| `iron-king-half` | A partir da versão 2: Rei de Ferro no ritmo 0,5 (o único não inteiro), com obra, planejada e recruta, no meio de um trecho |
| `peasant-3x` | A partir da versão 2: Camponês no ritmo 3, nascido na versão (`migratedAtMs: null`) e já no ano 3 |

`cold` cobre o que as estações com efeito (V2C-T1) puseram no estado: o frio aberto, que o passo seguinte precisa encontrar. `storage` cobre o que o armazenamento (V2C-T2) pôs: depósitos com nível, uma obra de depósito em curso e os dois contadores de desperdício. `queues` cobre o que a segunda fila e o início automático (V2C-T5) puseram: as duas posições de fila ocupadas e a marca `autoStart` nas planejadas, ligada e desligada. `crafts` cobre o que a troca de ofício e a experiência (V2C-T3) puseram: duas coortes em edifícios diferentes, a experiência em quatro valores e o ano de uma mestria. `threat` cobre o que a Ameaça (V2E-T1) pôs: a Ameaça longe do zero, a Torre de Vigia com nível e em obra; e `week-scripted`, a partir da versão 9, traz a Ameaça no máximo e a Torre no nível 2. Até a versão 10 as incursões marcadas (`horde.scheduledRaids`) ficam vazias em todos: nada as marcava. `raid` e `raid-announced` cobrem o que a incursão de lobos (V2E-T3) pôs: um ferido com edifício, o efeito de moral `raid`, uma incursão sorteada e já anunciada, o fluxo `horde` do gerador e as contagens em `stats`; e, a partir da versão 11, `fresh`, `construction`, `threat` e os outros retratos de antes do 16º dia de jogo trazem a incursão do roteiro marcada, e `week-scripted` traz dezessete incursões resolvidas, a Paliçada no nível 2 e a Ameaça em 90. `palisade` cobre o que a Paliçada (V2E-T2) pôs: o edifício com nível e em obra, e o que a cadeia de cartas dela deixa no Conselho; e `week-scripted`, a partir da versão 10, traz a Paliçada erguida depois de prometida. `morale` cobre o que a moral (V2C-T4) pôs: a moral longe da base, um efeito temporário na lista e o gerador já usado; e `famine`, a partir da versão 7, traz a moral no chão e a população que a fome longa já levou. Os três últimos cobrem o que a fundação da v0.2 pôs no estado e que os passos seguintes leem: a fronteira, o ritmo e a dificuldade. `fixtures.test.ts` exige que os cenários tenham uma fronteira antiga, uma partida sem fronteira no ano 3, os ritmos 1, 3 e 0,5 e as três dificuldades.

Os retratos da versão 1 foram gerados com o motor da v0.1 (commit `9b1d3e8`, o mesmo motor da tag `v0.1.0`) antes de o tipo mudar. Nomes e sementes são de teste: nenhum veio de uma conta real.

Como acrescentar uma versão: [README do motor](../../README.md), "Versões do estado e migração".
