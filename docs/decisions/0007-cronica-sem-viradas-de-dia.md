# 0007 — Crônica sem as viradas de dia

Data: 2026-10-01\
Estado: proposta (aguardando aprovação)\
Escopo: GDD §11.4, §13.2 e Apêndice E; roadmap F1-T2, F2-T6.6, F3-T5 e F3-T7

## Contexto

O roadmap pede que a virada de dia de jogo emita um evento (F1-T2.4) e que `GET /chronicle.md` traga "uma linha por evento" (F2-T6.6). A implementação segue os dois ao pé da letra. O resultado é que cada ano de jogo põe 84 linhas "Amanhece o Nº dia da Primavera em Pedra Alta." na Crônica, uma a cada duas horas reais. Em uma semana comum de jogo elas são a maior parte do texto e escondem o que o jogador quer reler: obras, chegadas, fome, objetivos.

O GDD descreve a Crônica como a recompensa emocional do ano ("precisa ser bom de ler", §9.4; narrativa gerada a partir do log, §11.4) e a TreeView mostra a última linha dela (§13.2). Com as viradas de dia, essa última linha quase sempre será um amanhecer.

## Decisão proposta

Manter o evento `dayStarted` (ele continua saindo em `GET /events`, serve ao Relatório de Retorno e prova que o mundo andou), mas deixá-lo fora das duas leituras da Crônica: `GET /chronicle` e `GET /chronicle.md`. Viradas de estação e de ano continuam na Crônica.

O filtro fica no servidor, em `chronicleRows` (`packages/server/src/games/repository.ts`), como escolha de apresentação. Nenhuma regra do motor muda.

## Consequências e verificação

O roadmap F2-T6.6 passaria a dizer "uma linha por evento, exceto as viradas de dia". O teste "GET /chronicle.md tem uma linha por evento da partida", em `packages/server/test/games.test.ts`, foi escrito a partir do texto atual e precisa acompanhar a mudança.

Uma primeira versão do servidor já aplicava esse filtro por conta própria; ele foi removido para a implementação seguir a documentação enquanto esta proposta não é aprovada.
