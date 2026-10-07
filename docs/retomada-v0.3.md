# Retomada da v0.3: onde a execução parou

> Escrito em 2026-10-07, 11:10, quando a execução foi interrompida a pedido do autor (limite semanal de uso em 99%). Todos os subagentes foram encerrados. Este arquivo diz o que está pronto, o que ficou pela metade e a ordem para continuar. Apague-o quando a versão fechar.

## O que está onde

| O quê | Onde | Estado |
|---|---|---|
| Produção | `origin/main` = `7bff36b` (v0.2.0, estado 12, protocolo 2) | No ar. Nada da v0.3 foi publicado |
| Fases A a D da v0.3 | `main` local até `27fceb5` | Fechadas, revisadas e com o portão inteiro verde em 2026-10-06 |
| Fase E, objetivos 11 a 16, Retorno com a Guilda, versão `0.3.0`, documentos de fechamento | `main` local = `4db6de1` (196 commits à frente de `origin/main`) | Juntado, **sem o portão inteiro rodado neste commit** |
| Lote 2 do Conselho (V3F-T1), pela metade | branch `wip/v3f-t1-lote2` = `2352e39` | **Não verde, nenhum teste rodado**. Não juntar sem revisar |

O `main` local está com a árvore limpa. Estado do jogo na versão **24**; protocolo **3**.

## O que falta, na ordem

1. **Rodar o portão inteiro no `main` (`4db6de1`)**, um comando de cada vez: `pnpm verify`; `TEST_DATABASE_URL=postgres://lotg:lotg@localhost:5433/lotg_test pnpm test:integration`; `pnpm build`; `pnpm test:e2e`; `pnpm capture:landing && pnpm test:e2e:landing`. O que se sabe e o que não se sabe deste commit:
   - Os goldens e retratos dos objetivos 11 a 16 foram regravados em `4db6de1`, mas **os testes do simulador podem estar vermelhos**: o bot e a matriz esperavam dez objetivos (falhas vistas em `simulate.test.ts`, `bots.test.ts` e `matrix.test.ts` antes de `4db6de1`; não reconferido depois).
   - Os cenários em navegador passaram (131 de 131) em uma árvore separada, em um estado **anterior** à junção da versão `0.3.0` e dos goldens.
   - A árvore principal teve dois agentes escrevendo ao mesmo tempo por alguns minutos em 2026-10-07: nenhum resultado parcial desse dia vale como prova.
2. **Decidir o lote 2 do Conselho.** Duas saídas:
   - publicar a v0.3 sem ele (os cinco critérios do GDD §16.2 não dependem dele) e deixá-lo para uma v0.3.1; os Mestres Gil e Ximena, que só chegam por carta, ficam sem origem até lá;
   - ou retomar `wip/v3f-t1-lote2`. O que há nele: efeitos e requisitos novos em `packages/content/src/council.ts` e `packages/engine/src/council*.ts`, testes em `council.effects.test.ts`, e três arquivos de cartas começados (`cards/refugees.ts`, `cards/kingsCollector.ts`, `cards/guild.ts`). O pedido completo da tarefa está no roadmap (V3F-T1) e na §13.3.
3. **Fechar o Registro e os documentos** que ficaram para trás: as linhas V3E-T5, "V3E (integração)", V3F-T2, V3F-T3 e as da Fase G no §12 de [roadmap-v0.3.md](roadmap-v0.3.md); as caixas dessas tarefas; `CLAUDE.md` (estado 24, Fase E fechada, objetivos e Retorno); `packages/landing/README.md` (ainda lista Guilda, heróis e expedições como o que não existe); [acceptance-v0.3.md](acceptance-v0.3.md) (os nomes dos testes citados não foram reconferidos um a um).
4. **Revisão independente da Fase F** (V3F-T4), que não aconteceu: os objetivos 11 a 16 e o Retorno com a Guilda foram escritos no Sonnet e não foram revistos por ninguém.
5. **Publicar** (ato do autor; a sessão não tem permissão de `push`): backup manual do `lotg-db` imediatamente antes; conferir as três imagens (`pnpm docker:build`, `docker:build:web`, `docker:build:landing`); `git push origin main`. Para publicar só até a Fase D, que tem revisão e portão completos: `git push origin 27fceb5:main`.
6. **Do autor, sem data:** jogar as fases (roteiros em [pendencias-v0.3.md](pendencias-v0.3.md), seções 7 e 8, e [manual-test-v0.3.md](manual-test-v0.3.md)); ler o conteúdo, que é todo rascunho ([content-v0.3.md](content-v0.3.md)); o playtest ([playtest/convite-v0.3.md](playtest/convite-v0.3.md)); a tag `v0.3.0`.

## O que a versão sabidamente não cumpre

- **"Ouro com destino"** (pendência C-23, critério de fechamento do roadmap §8.3): o soldo por nível baixou o ouro parado em menos de 0,5%. Medição em [balance-v0.3.md](balance-v0.3.md), seção 14. Vira a primeira pergunta de [roadmap-v0.4.md](roadmap-v0.4.md).
- **Nenhuma pessoa jogou a v0.3**, e nenhuma partida de produção passou pela migração do estado 12 para o 24.
- A tabela do soldo por nível (2, 3, 4, 6, 8, 10, 12, 15, 18, 20) e as marcas de preço da Crônica (85% e 115%) foram propostas por agentes e não confirmadas pelo autor.

## Limpeza

Sobraram árvores de trabalho de agentes, todas já juntadas ou superadas: `.claude/worktrees/agent-*` (quatro) e uma em `/tmp/.../scratchpad/e2e-tree` (branch `e2e-fixes`). Remover com `git worktree remove <caminho>` e apagar os branches `worktree-agent-*` e `e2e-fixes`. O banco `lotg_test_e2e` no contêiner `lotg-db-test` também é descartável.

Em produção, `RATE_LIMIT_PER_MINUTE` do `lotg-api` foi de 60 para 600 em 2026-10-06, a pedido do autor.
