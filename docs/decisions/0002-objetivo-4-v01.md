# 0002 — Recompensa do objetivo 4 na v0.1

Data: 2026-10-01\
Estado: consolidada (decisão registrada no roadmap, F1-T1.3)\
Escopo: GDD §12.2 e §16.1; roadmap F1-T1 e F1-T8

## Contexto

O GDD §12.2 dá ao objetivo 4 ("Alcance Salão Nv2") a recompensa "desbloqueio: Celeiro, Armazém, Torre de Vigia". Esses três edifícios só entram no jogo na v0.2 (GDD §6.1), e a v0.1 não pode antecipá-los, nem como estrutura (roadmap §0.1). Sem ajuste, o quarto objetivo da v0.1 ficaria sem recompensa visível.

## Decisão

Na v0.1, o objetivo 4 recompensa **+50 ouro**. O dado vive em `packages/content/src/objectives.ts`, como os demais objetivos.

Na v0.2, quando Celeiro, Armazém e Torre de Vigia existirem, a recompensa volta a ser o desbloqueio descrito no GDD. Como o gate por nível do Salão já libera os edifícios por si só, a troca é uma alteração de conteúdo, sem mudança no motor.

## Consequências e verificação

As recompensas dos objetivos 1 a 4 somam +20 ouro, +30 madeira, +40 comida e +50 ouro. O teste de conteúdo fixa esses valores e o cenário roteirizado de F1-T8 confere que os quatro objetivos são concluídos com essas recompensas.
