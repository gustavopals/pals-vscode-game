# Decisões de arquitetura

O GDD define o contrato vigente; o roadmap divide sua implementação em tarefas. Os ADRs registram a motivação e as consequências das decisões. Uma decisão consolidada não significa que seu código já foi implementado.

| ADR | Decisão | Estado |
|---|---|---|
| [0001](0001-api-no-host-em-dev.md) | API no host em desenvolvimento | Consolidado em 2026-10-01 (F0-T3) |
| [0002](0002-objetivo-4-v01.md) | Recompensa do objetivo 4 na v0.1 | Consolidado em 2026-10-01 (F1-T1) |
| [0003](0003-codigo-do-reino-hmac.md) | Código do Reino com HMAC e chave independente | Consolidado em 2026-10-01; implementado em F2-T5 |
| [0004](0004-comandos-e-cache-http.md) | Recibos de comandos, avanço em recusas e cache HTTP | Consolidado em 2026-10-01; servidor implementado em F2-T6 (cliente em F3) |
| [0005](0005-sessoes-e-exclusao.md) | Histórico de refresh, revogação e exclusão em duas etapas | Consolidado em 2026-10-01; servidor implementado em F2-T4 e F2-T7 (cliente em F3) |
| [0006](0006-types-node.md) | `@types/node` e `@types/pg` como dependências de desenvolvimento | Aprovado pelo autor em 2026-10-01 (adotado antes, na Fase 2) |
| [0007](0007-cronica-sem-viradas-de-dia.md) | Crônica sem as viradas de dia | Aprovado pelo autor em 2026-10-01 e implementado (filtro em `chronicleRows`) |
| [0008](0008-cliente-web-com-aparencia-de-editor.md) | Cliente web com aparência de editor, em vez de extensão do VS Code | Decidido pelo autor em 2026-10-01; implementado em F3W-T1 a F3W-T10; os seis pontos confirmados em 2026-10-01 (ponto 2: o vínculo GitHub fica desligado na v0.1) |
| [0009](0009-implantacao-no-coolify.md) | Implantação no Coolify, em três recursos | Decidido pelo autor em 2026-10-01; implantado no mesmo dia (banco, API e app no ar); GDD e roadmap atualizados |
| [0010](0010-version-informa-o-que-esta-ligado.md) | `GET /version` informa o que o servidor tem ligado (`features.githubDevice`) | Aprovado pelo autor em 2026-10-01; implementado em F3W-T8 |
| [0011](0011-ritmo-3x-no-mvp.md) | Ritmo 3× no MVP, configurável no servidor (`GAME_TIME_SCALE`) | Decidido pelo autor em 2026-10-01; implementado no mesmo dia |
| [0012](0012-pagina-de-apresentacao.md) | Página de apresentação em domínio próprio (`@lotg/landing`, um quarto recurso no Coolify) | Decidido pelo autor em 2026-10-01; implementado no mesmo dia; oito pontos a confirmar |

Os ADRs 0003–0005 atendem aos pontos 1, 2 e 3 da revisão documental solicitados pelo usuário. Estão refletidos no GDD desde a versão 0.4 e no roadmap desde a 1.1 ([GAME_DESIGN.md](../../GAME_DESIGN.md), [MVP-ROADMAP.md](../../MVP-ROADMAP.md)). Não renumerar decisões existentes ao preencher os números reservados.

## Modelo para novas decisões

```markdown
# NNNN — Título

Data: AAAA-MM-DD
Estado: proposta | aprovada | consolidada | substituída por NNNN
Escopo: seções do GDD e tarefas do roadmap afetadas

## Contexto

Problema concreto e alternativas consideradas.

## Decisão

Contrato escolhido, limites e comportamento observável.

## Consequências e verificação

Custos, restrições e cenários que provam o contrato.
```
