# Plano da Fase C — Codex, 2026-11-19

Escopo autorizado: V5C-T1 → T2 → T3, um commit por tarefa, somente no branch
`v5-c`. Sem push, publicação ou alteração de outro worktree.

## Mapa de contexto (revisado antes da implementação)

| Arquivos | Responsabilidade e mudança |
| --- | --- |
| `content/src/horde.ts`, `engine/src/hordeMind.ts`, `hordePlan.ts` | Escala anual racional e memória anterior com metade do peso somente na primeira preparação. |
| `engine/src/types.ts`, `state.ts`, `migrations.ts`, `migrations/v44.ts` | Estado 44 da fase, passo 43→44 puro, guarda exata, memória e depois Votos. Guardas históricas congeladas. |
| `engine/src/fixtures.test.ts`, `migrations.test.ts` | Retratos novos e impressões digitais dos v43 congelados; projeções históricas explícitas. |
| `content/src/ids.ts`, `enemies.ts`, `omens.ts`, `horde.ts` | Troll: estatísticas, fraqueza, presságio e mistura a partir do Ano 2. |
| `engine/src/battle.ts`, `warCouncil.ts` | Resolução compartilhada com a prévia; preservar névoa e sorteios do Ano 1. |
| `content/src/vows.ts`, `engine/src/vows.ts`, `vowOrders.ts`, `vowsView.ts` | Catálogo, janela real, seleção anual e visão. |
| `engine/src/commands.ts`, `timeline.ts`, `advance.ts`, `yearEnd.ts` | Ordem, prazo no calendário, fecho e Legado opcional. |
| `engine/src/economy.ts`, muralha, `outcomes.ts`, combate | Aplicar somente os efeitos declarados por Voto. |
| `protocol/src/commands.ts`, `view.ts`, eventos | Adições compatíveis no protocolo 4, sem novo `pendingDecisions.kind`. |
| `web/src/game/gameSession.ts` | Antecipar polling quando a janela de Votos fechar. Tela fica para T4. |

Dependências: servidor persiste estado/eventos e valida o protocolo; simulador usa
as mesmas regras. Políticas dos bots permanecem sem adotar mecânicas novas até H.
Referências: relíquias (ordens/visão), guardas v42/v43 (projeções), fecho anual,
`botDestinations` (exclusão das políticas).

## Sequência e validação

1. T1: testes de escala/memória, implementação, retratos v44 e guarda; tipos,
   foco de Horda/Cerco, fixtures, migrations uma vez ao final, sentinelas,
   formato/lint, documentação e commit.
2. T2: testes de Troll/presságio/prévia, implementação, ids estáveis; tipos,
   foco, goldens intactos do Ano 1, fixtures/migrations se a guarda mudar,
   sentinelas, formato/lint, documentação e commit.
3. T3: testes de cada Voto, janela/recusas/ordem temporal/Legado; implementação
   aditiva, retratos da mesma v44; tipos, foco, fixtures, migrations uma vez ao
   final, sentinelas, formato/lint e commit.
4. Fechamento sequencial: `test:changed`; integração `games-migration` e arquivos
   Cerco/Horda existentes com db_test; `matrix.test.ts`; `verify:fast`.

Riscos: limites históricos de ondas (105), estados montados à mão nos testes,
regras de morte em todos os caminhos de combate, conservação de sorteios/bytes
dos goldens do Ano 1. Sem migração SQL ou configuração nova. Criação de partida:
oferecer Votos pela visão inicial e ordem existente se possível, sem mudar
`POST /games`. Bônus e mistura de Trolls serão fixados no conteúdo e no GDD.

T1 concluída: foco, tipos, guarda, retratos, sentinelas e 14.287 testes de
migração aprovados; integrações games-migration e siege aprovadas. Goldens
intactos; a escala anual aparece apenas no Cerco do Ano 2 do retrato peasant-3x.

T2 concluída: Trolls, presságio, prévia/combate e persistência conferidos.
14.294 testes de migrações, tipos, foco e sentinelas aprovados. Só o retrato
existente do Cerco do Ano 2 mudou de composição; Ano 1 e goldens intactos.
