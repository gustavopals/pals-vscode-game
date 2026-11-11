# Relatório da v0.4 — candidata Guerra e Cerco

**2026-11-11, trilha V4I-T4**, base `075b8f0` da terceira junção. Estado **42**,
protocolo **4**, catálogo de **59 cartas**. Este é o relatório documental do
candidato, sem publicação: não encerra o balanceamento, o portão ou o aceite humano.
A última publicação registrada é a v0.3.0 (estado 24, protocolo 3).

## O que existe

| Área | Entrega |
|---|---|
| Fundação e economia | Migrações por versão; ferro no Armazém/Mercado e na Mina Abandonada; Ferreiro, forja de armas e reparo/desgaste de equipamento |
| Exército e batalha | Quartel, cinco unidades, treino/dispensa, formações salvas, Defesa ativa, comandantes e auras; resolvedor único para prévia/batalha, relatórios com fatores e rodadas |
| Defesa e Horda | Muralha por ala, reparo, Baluarte e Torre Nv3+; incursões, memória da última formação efetiva, presságios, Fortaleza e Acampamento |
| Sabotagem e campanha | Jornada de três heróis à Fortaleza; redução/alerta das ondas; ataque ao Acampamento com tropas reservadas, batalha, saque e retorno |
| Cerco e rescaldo | Vigília civil, Plano por onda, três ondas, decisão/troca/reparo de emergência, milícia e prévia por onda na interface; Vitória, Gloriosa, Queda, rescaldo e Reconstrução |
| Ano e conteúdo | Fecho anual, pontuação e seis Feitos; seleção e download da Crônica do Ano; 59 cartas, Lobo Branco e caçada temporária; objetivos 17 a 21, Retorno e Antes de partir com guerra |
| Reino e Novidades | Totais e ranking de ouro com saída por conta (ADR 0021, SQL `0001_ranking_listed`); histórico editorial com selo por conta/entre abas, v0.4 ainda rascunho |

**R1/R2:** a Paliçada que segura repele sem batalha, baixas, dano, relatório ou
aprendizado; ondas do Cerco sempre lutam. Os lotes de treino e recrutamento crescem
pelo ritmo, com fila compatível, sem ampliar vagas do Quartel nem alterar custo e
tempo por unidade. As respostas de regra estão no
[ADR 0019](decisions/0019-ferro-exercito-formacoes-e-combate-na-v0.4.md).

As revisões [E](reviews/v0.4-fase-e.md), [F](reviews/v0.4-fase-f.md) e
[G](reviews/v0.4-fase-g.md) corrigiram prévia de incursão revelada, retorno de
sabotagem com Fortaleza removida, persistência de milícia e limite anual das ondas.
As contagens históricas e seus limites permanecem nos relatórios e no
[Registro](roadmap-v0.4.md). Não foram reexecutadas nesta trilha.

## Documentação e versão preparadas

CLAUDE, [arquitetura](architecture.md), [aceitação](acceptance-v0.4.md), retomada,
READMEs do motor/servidor/app/landing e [changelog](../CHANGELOG.md) descrevem o
produto atual, com provas R1/R2 e revisões E/F/G por critério. A landing retira a
guerra/Cerco do horizonte e apresenta ferro, defesa e rescaldo; capturas permanecem
com a trilha responsável. Novidades mantém `draft`, com redação de 2026-11-11;
a publicação exige conferir escopo, data real e então promover a entrada.

Raiz, **sete pacotes** e constantes públicas (motor, API, app, conteúdo, protocolo
e SDK) estão em **0.4.0**. `packages/sim-cli` foi reservado à outra trilha e não
foi editado: o coordenador deve alinhar `package.json`, `SIM_CLI_VERSION` em
`src/index.ts` e `clientVersion` em `src/remote.ts`, ainda em 0.3.0.

## Verificações desta trilha

Node v22.22.3, comandos com `nice -n 19`, Vitest com `--maxWorkers=2`.

| Comando | Resultado |
|---|---|
| `pnpm --filter @lotg/server test -- --maxWorkers=2 src/app.test.ts` | **10/10**, um arquivo, saída **0**; HTTP em memória, incluindo versão, protocolo e builtAt |
| `pnpm --filter @lotg/web test -- --maxWorkers=2 src/news/ src/app/news.test.ts src/tabs/news.test.tsx` | **27/27**, quatro arquivos, saída **0**; rascunho, histórico e leitura |
| `pnpm --filter @lotg/landing test -- --maxWorkers=2` | **90/90**, quatro arquivos, saída **0** |
| `pnpm lint` | saída **0**; Markdown é ignorado pelo Prettier e foi revisado por leitura |
| `pnpm typecheck` | oito pacotes, saída **0** |

São **127 testes distintos em nove arquivos**. A primeira rodada da landing teve
89 aprovados/uma falha porque a edição retirara nomes de edifícios citados no teste;
os nomes foram preservados no texto e a rodada final passou sem afrouxar o contrato.
**304 links locais sem destinos ausentes**, colunas das tabelas de aceitação e
`git diff --check` conferidos; detalhes no Registro V4I-T4.

**Não executados:** matriz, simulador, `verify` inteiro, integração, e2e, build,
imagens Docker, capturas, perf/carga, produção ou teste manual. A expectativa de
versão de `server/test/smoke.test.ts` foi atualizada sem executar essa integração.
Nenhum golden, retrato congelado, número ou regra de jogo foi alterado.

## O que impede declarar a versão pronta

O critério 6 ainda exige remedição/metas do Regular, comparação do ouro e extremos
pela trilha responsável; consultar [balance-v0.4.md](balance-v0.4.md), sem inferir
meta atingida de faixas observadas. Faltam o portão completo no SHA integrado,
CI, três imagens e capturas atualizadas. Os relatos parciais não os substituem.

G-23 mantém ausentes a atribuição persistente de relatório por onda e os detalhes
das perdas da Queda na visão; a prévia ofensiva do Acampamento também falta. G-25
é hipótese aplicada de calendário, ainda para confirmação do autor. As perguntas
e o conteúdo não lido estão em [pendencias-v0.4.md](pendencias-v0.4.md) e
[content-v0.4.md](content-v0.4.md).

A [aceitação](acceptance-v0.4.md) mantém a evidência manual vazia. O autor joga o
[roteiro](manual-test-v0.4.md), registra navegadores/celular/leitor de tela e faz o
playtest externo. Não houve playtest nesta entrega. O autor também faz backup
manual com SHA de retorno, ensaio de restauração/reversão (ato 23), push e conferências
pós-publicação, tag/release. O procedimento de [deploy](../deploy/README.md) cobre
o salto 24 → 42, protocolo 3 → 4/426 e SQL `0001_ranking_listed`; nada disso foi
executado pela trilha documental. Main local não foi movido, sem push ou publicação.
