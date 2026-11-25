# CLAUDE.md

> **v0.4.0 publicada em 2026-11-17: estado 42, protocolo 4.**
> Plano atual: [roadmap da v0.5](docs/roadmap-v0.5.md), “Mundo e Legado”.

## O que é

**Lords of the Guild**: jogo medieval assíncrono no navegador, aparência de editor;
motor determinístico TypeScript, servidor Fastify/PostgreSQL autoritativo, app web.

- [GDD](GAME_DESIGN.md): arquitetura (§14), aceite (§16.2), escopo (§18).
- [Roadmap v0.5](docs/roadmap-v0.5.md): regime (§2), decisões (§4), contratos (§5), tarefas (§6), registro (§11).
- [Arquitetura](docs/architecture.md), [ADRs](docs/decisions/README.md), [histórico/conferência](docs/historico.md). Planos anteriores são históricos; leia as seções da tarefa.

**Publicação e trabalho.** A v0.4.0 está publicada (CHANGELOG, `333df054`).
Raiz, oito pacotes e constantes públicas: 0.4.0; Fases A–E publicadas com estado 45. Fase F em desenvolvimento com `CURRENT_SCHEMA_VERSION = 46`
(`engine/src/migrations.ts`), `PROTOCOL_VERSION = 4` (`protocol/src/index.ts`).
Confira `server`, `protocol` e `builtAt` em `/v1/version` para identificar produção.
Novidades registra 0.4.0 como publicada em 2026-11-17.

Coolify e domínio próprio: ADRs 0009/0012 e [deploy/README.md](deploy/README.md).
GitHub permanece desligado, testado só com simulado: não ligar/remover sem pedido;
produção usa Código do Reino. [Pendências herdadas](docs/historico.md#pendências-herdadas);
automação não aprova aceite humano.

## Comandos

Node 22 (`nvm use`), pnpm 9/Corepack, Compose v2; Linux, nunca `/mnt/c`.
API no host; `node_modules` separado do contêiner. Dev: `lotg/lotg`,
portas só `127.0.0.1`; [variáveis](deploy/.env.example), segredos independentes/preservados.

```bash
pnpm install
pnpm dev:up                    # db:5432 e db_test:5433; espera saúde
pnpm secrets:gen               # só gera os segredos vazios de deploy/.env
pnpm dev:api                   # host:3000; aplica migrações
pnpm dev:web                   # :5173; /v1 repassado (LOTG_API_URL)
pnpm dev:landing               # :5174; dispensa API
pnpm db:migrate
pnpm dev:down                  # mantém os volumes
pnpm db:psql -c 'select 1'
pnpm --filter @lotg/server db:generate --name <nome>
pnpm typecheck
nice -n 19 pnpm --filter @lotg/engine test -- construction --maxWorkers=2
TEST_DATABASE_URL=postgres://lotg:lotg@localhost:5433/lotg_test nice -n 19 pnpm test:integration games --maxWorkers=2
pnpm test:e2e 04-conta -g "duas abas"
pnpm exec prettier --check <arquivos>
pnpm exec eslint <arquivos-de-codigo>
pnpm build
pnpm capture:landing           # manual; usa db_test
scripts/landing-smoke.sh <url>
pnpm -s sim -- --seed pedra-alta-golden --days 7 --time-scale 3 > semana.csv
pnpm -s sim -- --smoke <url>    # cria conta e a exclui; --keep preserva
```

Portão rápido (§2): `test:guards` (sentinelas, segundos), `test:fast` (unit sem os
pesados), `test:changed` (antes do push), `verify:fast` (lint + tipos + fast, ~4 min) e
`test:matrix` (os quatro pesados, ~25 min: `balance`, `migrations`, `matrix`, `coverage`; CI).
`test`/`verify` seguem completos.
Mais comandos nos READMEs dos pacotes e de deploy.

Testes: [servidor §Testes](packages/server/README.md#testes) (banco/reset/relógio,
renovar após 15 min) e [app §Testar](packages/web/README.md#testar) (Node/golden,
`world.passTime` até repouso, build para CSP).
Vitest: `unit`/`integration` em `vitest.config.ts`; sem banco configurado passa vazio.
Não disputar `db_test` entre integração/e2e/capturas; paralelo só com bancos separados.
Isole Horda/Conselho (`quietHorde`, `councilRecess`; motor: `councilWithoutNews`,
`councilScenario(…, true)`). Expedições: `/__test/hero`, `/item`, `/crossroads`, visão
real; nomes sorteados exigem texto exato ou botão. `tavernSite`/`tavernScenario`: Taverna.

## Pacotes

Oito pacotes `@lotg/`: `engine` (motor puro), `content` (dados/zod), `protocol`
(contratos `/v1`), `server` (API/persistência/jobs), `client-sdk` (HTTP), `sim-cli`
(bots/faixas), `web` (Preact/Vite) e `landing` (estática).
Fonte via `exports`/Bundler; build só implantável.

ESLint barra Node/Fastify/pg/Drizzle em engine/content/protocol, exceto testes;
esses três usam `types: []`. Servidor/app nunca dependem um do outro. App não
importa motor/servidor/Node nem, fora dos testes, content/`contentHash`.
`bundle.test.ts` barra números/frases/flags/efeitos escondidos no navegador.
Landing sem pacotes do jogo; testes podem conferir conteúdo.

## Regras de arquitetura

**Servidor orquestra, motor decide, app exibe.**

1. Regra só em `engine`; números e textos de jogo só em `content`; app exibe `ViewState`.
2. Servidor autoritativo e relógio: cliente manda comandos, nunca estado, timestamps ou resultados. Névoa aplicada no servidor.
3. Recursos em milésimos inteiros; avanço por segmentos, com divisão de intervalo exata (Motor).
4. Ação do jogador: comando validado, idempotente por `commandId`.
5. Bibliotecas permitidas: TypeScript, esbuild, Vitest, fast-check, zod, Preact, Fastify e plugins oficiais `@fastify/*`, `pg`, Drizzle, `jose`, `pino`, `tsx`, Vite, `@preact/preset-vite`, `@vscode/codicons`, `@playwright/test`, ESLint e Prettier (ADR 0008). Hash/HMAC com `node:crypto` só no servidor; não instalar `argon2`. Qualquer outra dependência exige ADR aprovado.
6. **Não antecipar mecânicas nem estruturas vazias.** Base v0.4: economia/Conselho, Guilda/expedições, Mercado/Mestres, ferro/exército/Horda/Cerco, Crônica anual/Reino/Novidades. A tela de Votos permite escolher os desafios do ano e a aba Reino mostra o Legado da conta. O mapa gráfico está publicado. A Fase F já permite reivindicar postos no motor e produzir ferro continuamente no Veio de Ferro. **Ainda não existem:** plantas, Temporadas e mercado entre jogadores; outras lacunas da base estão no README do motor, “O que ainda não existe”. v0.5 por fase: B Capela/relíquias; C Ano 2/Trolls/Votos; D sementes/Legado; E mapa; F postos; G Temporadas. Plantas ficam fora (§10). Só implementar a fase da tarefa, sem bloquear evolução do GDD. Fora de Rei de Ferro, morte de herói só com o Voto Heróis mortais (Fase C).
7. Desvio do GDD: ADR em `docs/decisions/`, aprovação do autor. D-1 aprovada; D-2…D-31 valem com recomendação (§4), sem nova espera ou escolha inventada. Hospedagem/OAuth App/nome/ícone/privacidade são do autor. Resposta datada prevalece; hipótese não é aprovação.
8. Mudança de regra atualiza golden e GDD. Mecânica nova traz dados em `content`, recusa legível, evento na Crônica, explicação na visão e teste.

### Servidor

Seguir [README](packages/server/README.md), “Contratos que valem a pena ter em mente”,
“Migração do estado”, “Cuidados que já custaram um defeito”, “Migrações” e “Build e
imagem”: lock por conta, `persistState` uma vez, commit antes do erro como valor,
estado sempre migrado/validado, nunca cru; versão futura/inválida não sobrescreve.

Rotas zod → serviços com `AppContext`;
jogo/expiração/exclusão usam `ctx.clock()`. Protocolo valida forma,
motor regra/faixa (`422 GAME_RULE`); schema sem `balance`, ritmo no servidor
(`OfferedGameRequestSchema`). Tipos `Command`/`ViewState`/recusas iguais aos do motor.
Catálogo público: só opções de criação, com ETag; sem fatores de regra.

Protocolo 4: decisões fechadas por `kind` (carta/`crossroads`/`siegeWave`), cabeçalho
`X-Lords-Protocol`, diferente recebe 426. Adição não sobe protocolo; incompatibilidade
sobe; rotas `/v1`. Docker: contexto raiz, `deploy/Dockerfile.dockerignore`, `runtime`
último alvo, estáticos Debian/Caddy. Esbuild leva dependências no bundle; nativa ou
arquivo de execução exige `server/esbuild.mjs`. SQL via drizzle-kit em
`deploy/migrations`, lock 727 no arranque, expandir antes de contrair.

### Contratos

Seguir [servidor §Contratos que valem a pena ter em mente](packages/server/README.md#contratos-que-valem-a-pena-ter-em-mente)
e §O que tem versão: autenticar/propriedade/lock antes de avançar; replay antes do
avanço, recibo original e conflito de UUID; recusa confirma avanço antes do 422,
falha inesperada desfaz. Transação grava estado/eventos/recibo completo
(`request_hash`, status, corpo); recibos duram com a partida. Job após 1 h sem
persistência, sem timer por partida.

- Estado inteiro JSONB, sem patches; `schemaVersion` espelhado na coluna. Replay = estado inicial + semente + comandos; migrado exige também cada fronteira. Estado não é SQL. Motor emite; tabelas guardam eventos/Crônica.
- Polling 30 s à vista/2 min oculto, `/view` e `/events?after=`. ETag fraco SHA-256 de `{ view, stateVersion }`, muda sem escrita. Versão decimal string, cabeçalho só aviso, sem `If-Match`. Replay busca atuais sem repetir eventos; sem fila local.
- Sessão/família por máquina, 30 dias absolutos, histórico em `refresh_tokens`; reuso revoga com commit antes do 401. Auth sem cache positivo. Recuperação HMAC-SHA256 com segredo independente (ADRs 0003/0005).
- Exclusão transacional: bloqueio/revogação/limpeza do código/arquivamento; 202 com `deletedAt`/`purgeAfter`; job a partir de sete dias expurga estado/eventos/dependentes. Backup: 14 dias desde geração. Não prometer remoção física imediata nem desfazer.
- Crônica: API/Markdown/app usam `CHRONICLE_HIDDEN_EVENT_TYPES` (`dayStarted`, `storageWasted`, `expeditionNodeResolved`); falha de nó aparece. `/events` conserva tudo.

### Cliente

Seguir [README do app](packages/web/README.md), seções: “Estrutura” e “O que é próprio
do navegador” (controlador puro, navegador, restauro, foco); “Ordens e ‘Tentar de novo’”
(mesmo UUID, alvo, intenção, trava); “A Guilda e a Taverna” e “As expedições” (caminho
único, montagem, travas, releitura após diálogo, dispensa); “O Mercado, as caravanas e
os Mestres” (duas etapas/`quoteDay`/`PRICE_CHANGED`); “Relatório de Retorno em três
blocos e ‘Sua escolha voltou’” (ausência ≥4 h, inclusive aba oculta; Hoje, sem avisos
avulsos; só visão/eventos); “Cache e versões” (schema/marca/`VIEW_FORMAT`/cursor).

- Conta por `enqueue`; comandos/diálogos em `palette/commands.ts`, entradas por `runCommand`. Abas com `Actions` (`order`, `run`, `playNow`), sem rede. Árvore navega/`rowActions` age. Conselho por `answerCard`/`prepare`.
- Prazo que muda tela antecipa polling em `nextPollMs`; zero duradouro é estado. Única conta de regra no app: quantidade × preço de hoje (`ui/market.ts`); demais números/textos vêm da visão, completada no motor.
- Lembrete: 48 h reais desde primeira visão da conta no navegador; `{ since, shown }` em `lords.linkReminder:<accountId>` por `maybeRemindToLink`; sem ritmo/calendário.
- `localStorage`: prefixo `lords.`. Sair/excluir/perder sessão limpa tokens/cache em todas as abas. Refresh sob `navigator.locks.request('lords.refresh')`: token vale uma vez.
- CSP `default-src 'self'`: sem estilo/script embutido; indentação por classe. Cores só em `theme/themes.css`; demais CSS só `--vscode-*`. Três temas completos, contraste ≥4,5:1.

SDK: `createClient({ baseUrl, tokenStore, clientVersion, fetch, refreshLock })`.
No 401, uma renovação por vez, relendo tokens; revogação/refresh recusado limpa
tokens e chama `onUnauthenticated`. Não repetir rotação em falha de rede;
leitura/comando repete com mesmo UUID. `GameRuleClientError.details` traz estado avançado.

### Página de apresentação

Regras completas no [README da landing](packages/landing/README.md), “O que a página
pode dizer”, “Capturas do jogo” e “Limites conhecidos”: estática, domínio/origem/
armazenamento próprios, sem Preact/pacotes do jogo/API; só dizer o que o jogo diz,
sem número de regra, promessa de duração/preço/multijogador/GitHub/marca de editor.
Teste não pegar não autoriza. Futuro só “No horizonte”, sem data; retire o entregue
na mesma publicação. Abertura com captura real; pintura com legenda de IA e crédito
Codicons. Capturas manuais no ritmo de produção; mudou Feudo/status/modo discreto,
refaça imagens afetadas/`og.png` e releia legendas/textos alternativos.

CSP `default-src 'none'`: sem estilo/script embutido, terceiros ou medição de audiência.
Cores só em `src/styles/tokens.css`, contraste testado. URLs por `%GAME_URL%`/`%SITE_URL%`
(`src/site.ts`, `LOTG_GAME_URL`/`LOTG_LANDING_URL`), nunca fixas no HTML.
Título da aba deve diferir do jogo para o monitor distingui-los.

### Motor

[README](packages/engine/README.md): “O ciclo”, “Invariantes”, “Sorteios”, “Identidades”,
“Versões do estado e migração”, “Uma carta nova”, “Uma expedição nova”, “Como adicionar
um evento”, “A carta roteirizada” e “Taverna”. Essas regras continuam obrigatórias.

- API: README §API pública e `ENGINE_VERSION`; `purity.test.ts` confere. Pureza, clonagem, próximos instantes e repouso seguem “O ciclo”/“Invariantes” do README. Sem relógio, `Math.random` ou I/O.
- **Ordem fixa**, conferida em `advance.ts` (README ainda omite passos da guerra): reparo da muralha → obras → postos avançados → forja → recrutas → treino → aldeões curados → Mestres à porta → heróis curados → expiração de preço/caçada → calendário → Mestres à porta outra vez → Conselho (expirações/efeitos/continuações) → heróis prometidos → adaptação → incursões → Cerco → fim de milícia/Reconstrução → Taverna → retorno sem destino → expedições → campanha → caravanas → planejadas/objetivos → fome/frio/soldo → `announceFilled`. Calendário: desperdício → fecho anual → ano novo (reinicia Conselho/Horda, restaura lobos antes da Ameaça, Queda abre Reconstrução) → estação → amanhecer → experiência → moral/sorteios/deserção → cobrança do soldo → Mercado → Conselho → Ameaça. Não é ordem de imports. Evento novo tem lugar escolhido, teste e justificativa no README. Cobranças preservam janela de retomada (`famineLedgerAt`, `wageLedgerAt`).
- Invariantes do README: milésimos/restos em `accumulators`, fatores `{ num, den }`, única fração `settings.timeScale` fora de conta contínua. Divisão exata em estado/eventos/gerador: `advanceTo(t2)` ≡ `advanceTo(t1)` seguido de `advanceTo(t2)`.
- Comando exige estado avançado (mau uso lança, regra recusa sem lançar); repouso após comando/evento e antes de avançar migrado. `settlePlanned`/`settleScarcity`, emissão e deriváveis seguem o README.
- Forma nova: passo/guarda exatos, retratos congelados com impressão digital. Na v0.5, D-4/roadmap §5.1 substitui cadência por tarefa: **uma versão por fase publicada**, B=43, C=44, E=45, F=46. Uma trilha de estado por vez; respeitar reservas. Passo sem `content`, sorteio, id ou evento; prazo de `context.boundaryMs`, nunca `state.migratedAtMs`.
- **Sorteios do estado** (README §Sorteios): `xoshiro128**`, fluxos fixos por assunto e por entidade viva, família/tipo/contador válidos. Só `advanceTo` em evento marcado sorteia o possível; nunca ordem/criação/migração/visão/`nextEventAt`. `dropStream` por último, sem ressuscitar fluxo; caravana só o cria na chegada sem escolta/com risco, apaga ali. Nó: sorte → vítima → cobiça → quantidades por recurso → item → Mestre (Sucesso/elegível). Saque antes do ouro, entidades por id. Gerador fora da visão; troca de algoritmo/hash/redução exige `RNG_VERSION`, vetores e migração.
- **Ids** (README §Identidades): `nextId`, contador só cresce; sem relógio/UUID/sorteio. Só ordem aceita/evento cria; criação/migração/visão/`nextEventAt` não. Contadores ocultos, ids visíveis inofensivos. Preserve módulos por entidade e hash da variante.
- **Névoa:** ocultar flags/efeitos/continuações, gerador, Ameaça/incursões sem Torre, modelos/futuro da Taverna. Expedição só alcançado e, antes do envio, até primeira encruzilhada; ocultar outro lado/destinos/variante/chaves/sorte/fluxo. Provar visão igual se só oculto difere. Previsão não sorteia nem antecipa incursão; cópia da moral desliga Taverna/expedições. Mapa/semente de Temporada preservam névoa conforme fase.
- Receitas do README: ids publicados estáveis (mudança pede migração), calibragem/catálogo, `{heroi}`, roteirizada e Taverna. R1: Paliçada segura sem batalha; Cerco luta. R2/R3: lotes/fila de recrutamento, treino e vagas do Quartel escalam pelo ritmo, nunca abaixo da base; custo/tempo unitários iguais.
- Ritmo/dificuldade imutáveis; ofertas em `balance.paces`; `GAME_TIME_SCALE` só padrão (3; 0,5–10). Motor em tempo de jogo, visão em segundos/taxas reais; app não converte. Prazos reais de Conselho, deserção/janela de fome, Torre, quatro do atraso do soldo e encruzilhada usam `realToGameMs`; soldo por hora de jogo. Integração/e2e e golden base: ritmo 1.

## Convenções

Português do Brasil, frases curtas; narrativa medieval, código em inglês.
Testes ao lado (`*.test.ts`/`*.test.tsx`), goldens `__golden__`, integração
`tests/server`/`server/test`, e2e `tests/e2e/*.spec.ts`. Regra/contrato: testes primeiro.

`main` sempre verde, sem commit direto de fase. Worktree/branch próprio `v5-*`;
um commit por assunto: `V5A-T1: resumo no imperativo` (ajuste tarefa/fase), com
`Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
Nunca registrar tokens, códigos de recuperação ou segredos em logs.

## Regime rápido da v0.5

Vale o [roadmap §2](docs/roadmap-v0.5.md#2-regime-rápido), aprovado na D-1.

1. Uma tarefa por sessão, plano escrito, sem espera de rotina; fases/dependências obrigatórias. `pnpm typecheck` sempre.
2. Foco com `nice -n 19`/`--maxWorkers=2` em todo Vitest; uma suíte pesada por vez. `UPDATE_GOLDEN=1` só no arquivo da tarefa; ler/explicar diff no commit. Golden alheio alterado é defeito. Bots só mudam na H, nunca para esconder regressão.
3. Prettier nos tocados, ESLint se código; formatar só tocados. Roadmap §11: data/commit/agente, verificado **e não verificado**. Corrigir documentos falsos; não inventar aprovação humana.

| Toquei | Rodo além de tipos/formato |
| --- | --- |
| Conteúdo | Foco + `test:guards` + motor da mecânica. |
| Motor/regra | Foco + `test:guards`. |
| Forma do estado | Acima + `fixtures`, `migrations` (~20 min, fora das sentinelas), teste do passo. |
| Protocolo | `test:guards`. |
| Servidor | Integração focada, com banco e filtro **sem** `--`. |
| App | Teste da aba/módulo + `bundle` + e2e alterado. |
| Landing | `page`/estilos + cenário de tela alterado; capturas quando afetadas. |
| Balanceamento | Acima + `test:matrix` **na CI**. |

`test:guards` (§2.2); antes de push, `test:changed`. **Localmente não rodar verify, matriz,
integração/e2e inteiros**, salvo medição exigida. CI é portão pesado. Conferir saída sem `| tail`; conclusão exige resultado.

Publicação (§2.5): `v5-<fase>` rebaseado, PR **rascunho**, CI verde **naquele SHA**,
revisão principal/capturas. D-3 permite push de branch/PR, respeitando restrições da tarefa.
Autor autoriza a fase; backup manual se sobe estado, SHA de retorno anotado. Promover
**mesmo SHA verde**, avanço rápido, sem merge novo; CI do `main` repete antes de
implantar. Falhou, corrigir no branch. Conferir `/v1/version`/registro. `main` local
só avança rápido para SHA verde. A sessão principal revisa diffs externos/capturas.

## Nunca

- Rodar `docker compose down -v` fora de dev: apaga volumes do banco.
- Commitar `.env`/segredos ou regenerar `RECOVERY_CODE_SECRET` de ambiente que emitiu códigos.
- Publicar/implantar sem pedido do autor. **Push no `main` com CI verde publica automaticamente no Coolify** (`deploy` em `.github/workflows/ci.yml`). Só com autorização do autor para a fase; backup manual antes de todo push que sobe o estado e SHA de retorno anotado. Push de branch/PR segue D-3 e restrições da tarefa.
- Voltar imagem da API para antes de migração de estado sem restaurar backup; usar `v0.1.0` como reversão (ela não confere versão e sobrescreve). Ver deploy §Reverter depois de uma migração de estado.
- Usar nome, logotipo ou marca do editor na interface (ADR 0008, ponto 6).
- Mesclar estados de contas.
- Usar Alpine como base: bases `node:22-bookworm-slim` e `debian:bookworm-slim`.
