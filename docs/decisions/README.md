# Decisões de arquitetura

O GDD define o contrato vigente; o roadmap divide sua implementação em tarefas. Os ADRs registram a motivação e as consequências das decisões. Uma decisão consolidada não significa que seu código já foi implementado.

| ADR | Decisão | Estado |
|---|---|---|
| 0001 | API no host em desenvolvimento | Reservado para F0-T3 |
| 0002 | Recompensa do objetivo 4 na v0.1 | Reservado para F1-T1 |
| [0003](0003-codigo-do-reino-hmac.md) | Código do Reino com HMAC e chave independente | Consolidado em 2026-10-01; implementação pendente |
| [0004](0004-comandos-e-cache-http.md) | Recibos de comandos, avanço em recusas e cache HTTP | Consolidado em 2026-10-01; implementação pendente |
| [0005](0005-sessoes-e-exclusao.md) | Histórico de refresh, revogação e exclusão em duas etapas | Consolidado em 2026-10-01; implementação pendente |

Os ADRs 0003–0005 atendem aos pontos 1, 2 e 3 da revisão documental solicitados pelo usuário. Estão refletidos no [GDD 0.4](../../GAME_DESIGN.md) e no [roadmap 1.1](../../MVP-ROADMAP.md). Não renumerar decisões existentes ao preencher os números reservados.

## Modelo para novas decisões

```markdown
# NNNN — Título

Data: AAAA-MM-DD
Estado: proposta | consolidada | substituída por NNNN
Escopo: seções do GDD e tarefas do roadmap afetadas

## Contexto

Problema concreto e alternativas consideradas.

## Decisão

Contrato escolhido, limites e comportamento observável.

## Consequências e verificação

Custos, restrições e cenários que provam o contrato.
```
