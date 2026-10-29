# V4G-T2 · Mapa de contexto e plano de execução

Escopo autorizado em 2026-10-29: T2.1–T2.6 no motor/conteúdo, estado **39 → 40**.
Protocolo 3, servidor, SDK, app e simulador ficam fora desta trilha.

| Arquivos | Papel e alteração |
| --- | --- |
| `engine/src/types.ts`, `state.ts`, `migrations.ts`, `migrations/v39.ts`, `migrations/v40.ts` | Estado do cerco, milícia e reconstrução; migração sem sorteio/prazo |
| `content/src/balance.ts`, `schemas.ts`, `units.ts`, `chronicle.ts`, `siege.ts` | Números, validação, unidade temporária e frases |
| `engine/src/hordePlan.ts`, `hordeTurn.ts` | Composição preparada como fonte; sincronização sem rerrolagem |
| `engine/src/siege.ts`, `siegeTurn.ts`, `siegeOrders.ts` | Contas, eventos e ordens do cerco |
| `engine/src/advance.ts`, `timeline.ts` | Marcação na virada e ondas como instantes próprios |
| `engine/src/battle.ts`, `battleReport.ts`, `battleReportView.ts`, `raids.ts` | Batalhas existentes; milícia temporária e baixas |
| `engine/src/population.ts`, `construction.ts`, `planned.ts`, `wallRepair.ts` | Braços convocados, Queda, custos de reconstrução e reparo |
| `engine/src/view.ts`, `types.ts` | Contrato interno `siegeWave`; exposição pública reservada à T2.7 |
| `engine/src/*.siege.test.ts`, `siege*.test.ts`, `fixtures.test.ts` | Golden antes do motor, migração/guarda, instantes, ordens e efeitos |

Referências conferidas: `fightBattle`/`buildBattleReport`/`applyBattleOutcome`, `buildDefender`,
`vigilAt`, `watchtowerWarningMs`, `releaseExcessWorkers`, migração da campanha e retratos congelados.
A igualdade dos tipos públicos com o protocolo foi identificada: as novas ordens/decisão terão
contratos internos próprios até a T2.7. A unidade temporária não entra no catálogo de treino.

Plano, revisto por leitura das dependências: fixar golden de referência usando as batalhas
existentes; depois seis commits, na ordem estado, ondas, linha do tempo/Plano, resultado/Queda,
milícia, rescaldo. Conferir os diffs de goldens e conservar todos os retratos v39.

Riscos: migração de estado necessária; mudança futura de API na T2.7; sem migração SQL nem
configuração. Escolhas não respondidas serão numeradas como propostas nas pendências.
Verificação restrita pelo autor: typecheck, lint e testes focados, todos os testes com nice 19 e
até dois workers. Suítes completas, matriz, integração, navegador e perf ficam com o coordenador.
