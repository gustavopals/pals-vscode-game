# Histórico das orientações do repositório

Esta memória separa decisões antigas das regras atuais de [CLAUDE.md](../CLAUDE.md).
A V5A-T1 partiu de `f86972e5a192a2a854f6fdee27231d239bb278e9`: 258 linhas,
55.591 bytes. Os números de linha do apêndice se referem a essa revisão.
Os trechos arquivados abaixo descrevem o que o arquivo dizia; não atestam o estado
atual da produção nem reabrem decisões. O texto vigente e o roadmap v0.5 prevalecem.

## Conferido na V5A-T1 — 2026-11-17

- `packages/engine/src/migrations.ts`: estado 42; `packages/protocol/src/index.ts`: protocolo 4.
- `package.json` da raiz e dos oito pacotes, constantes públicas do motor, conteúdo, protocolo, API, SDK, app e sim: 0.4.0.
- `CHANGELOG.md`: publicação da v0.4.0 em 2026-11-17, commit `333df054`. Não foi consultada a API em produção nesta tarefa.
- `packages/web/src/news/entries.ts`: entrada 0.4.0 ainda `draft`, com data editorial 2026-11-11. Não foi promovida por esta tarefa de documentação.
- O roadmap §3 diz que o CLAUDE anterior informava estado 38/protocolo 3; na revisão de partida ele já informava 42/4. O topo do plano ainda diz “Nada aqui está aprovado”, mas as respostas de §4 aprovam D-1 e aceitam as recomendações D-2…D-31. Vale a resposta datada.
- `test:fast`, `test:guards`, `test:changed`, `verify:fast` e `test:matrix` ainda não constavam no `package.json` lido; pertencem à V5A-T2. Não foram implementados aqui.
- O caminho da landing no roadmap §2.5 é `packages/landing/src/index.html`; o arquivo real é `packages/landing/index.html`. A V5A-T1 não alterou a landing.
- `engine/src/index.ts` e `purity.test.ts` também incluem `ENGINE_VERSION`, omitido na lista anterior do CLAUDE/README.
- A ordem do README do motor em “Invariantes” omite reparo/forja/treino, Cerco, expiração da caçada, milícia/Reconstrução e retorno sem destino. A ordem completa foi mantida resumida no CLAUDE e conferida em `engine/src/advance.ts`; o README não foi usado para apagar esses passos.
- `warCouncil.ts` já usa fluxos próprios da prévia, sem tocar `state.rng` (`purity.test.ts`, ADR 0019). “Só advanceTo sorteia” se refere aos sorteios do estado; essa exceção isolada não mudou.
- O resumo antigo de sorteios da linha 226 omitia cobiça/item/Mestre; a linha 219 e `expeditionTurn.ts` já traziam a ordem completa. `caravanTurn.ts` só sorteia chegada sem escolta quando há risco (`atRisk > 0`). O CLAUDE atual explicita a condição.
- R1 foi conferida em `raids.ts`; R2/R3 em `units.ts`, `population.ts`, `army.ts` e na guarda `migrations/v42.ts`. Morte fora de Rei de Ferro só entra na futura Fase C com Votos, conforme D-16.

## Decisões substituídas

O ritual antigo exigia `pnpm verify` em toda tarefa, integração inteira para servidor,
e2e inteiro para app, matriz para motor/conteúdo e espera por plano em tarefas M/L
(com exceção já concedida na v0.3). D-1 aprovou o regime rápido: foco e sentinelas no
agente, portão pesado na CI, matriz por fase. A exigência de resultado de verificação,
registro do que ficou sem prova, atualização de documentos e revisão de goldens permanece.

A regra antiga era uma versão de estado por tarefa que muda forma. D-4 aceita uma
por fase publicada: 43/B, 44/C, 45/E, 46/F; D e G não pedem versão de estado.
Passo, guarda, retrato, fronteira e ausência de sorteio/evento continuam obrigatórios.
A receita antiga do README do motor descreve a técnica; sua cadência foi substituída.

Em 2026-10-05, “push em versão estável” foi interpretado como publicação no fim de
fase. A resposta de 2026-10-06 do ADR 0017 passou o push ao autor; agentes faziam
commits locais. D-3 da v0.5 permite push em `v5-*` e PR rascunho, sem implantar.
Publicar exige autorização do autor para a fase, SHA verde exato e backup manual
quando sobe estado; nunca publicação implícita. A V5A-T1 tem restrição própria:
só commit local, sem push, sem mudar main ou outros worktrees.

## Pendências herdadas

O CLAUDE anterior deixou com o autor: cópia externa de `RECOVERY_CODE_SECRET`,
backups fora do servidor, avisos operacionais, confirmações editoriais do ADR 0012,
ensaio de restauração/reversão (ato 23), evidência manual, tag/release e playtest
externo. A reescrita não afirma que algum desses atos ocorreu. O fechamento de
versões anteriores sem toda a evidência humana não substitui o aceite da v0.4.
Fontes: [deploy](../deploy/README.md), [aceite](acceptance-v0.4.md),
[roteiro manual](manual-test-v0.4.md), [relatório](relatorio-v0.4.md).
O autor ainda precisa tratar a entrada editorial `draft` de Novidades.

## Portas e testes

A orientação anterior registra API de teste na porta 3100 e preview do app compilado
na 4173, um worker Playwright e rotas `/__test` só no servidor de teste.
Conferência: `playwright.config.ts` e `tests/e2e/server.ts`. A regra atual continua:
não disputar `db_test` entre e2e, integração e capturas; banco separado se houver paralelo.

## Comandos anteriores

O bloco antigo incluía instalação, dev, SQL, testes completos, cobertura, build das
três imagens, capturas, smoke e muitos exemplos do sim. Os comandos continuam nos
`package.json` e nos READMEs, mas os exemplos redundantes saíram do guia principal:

- O sim usa dias/sessões reais mesmo com `--time-scale`; aceita `--game-year`, dificuldade, perfis, perf, carga remota e smoke. O perfil explorador somou Taverna/festival/Guilda/expedições ao econômico; desde V3E-T1 o econômico também ergue Mercado, vende excedente e compra lenha. O especulador testa arbitragem com prejuízo. Fonte: [README do sim](../packages/sim-cli/README.md).
- A linha antiga da matriz dizia “3 perfis”, mas o próprio bloco já listava quatro na rodada padrão: preguicoso, regular, dedicado e explorador. Não repetir a contagem antiga como fato atual; matriz fica na CI/fechamento de fase.
- `UPDATE_GOLDEN=1` era mostrado para o pacote inteiro. Agora só no arquivo da tarefa; cobertura/carga não viram rotina de cada mudança.
- `GAME_TIME_SCALE=3 pnpm test:e2e 03-retorno-e-conexao -g "ritmo"`, instalação de Chromium e imagens Docker estão nos READMEs específicos. Filtro de integração continua sem `--`.
- O compose de dev tem `--profile full` para testar a imagem e `--profile tools` para pgweb em 8081; API normal no host, sem compartilhar `node_modules`. Conferido em `deploy/docker-compose.dev.yml`.

## Memória anterior

Os trechos abaixo preservam o histórico que estava misturado às regras: versões,
datas, decisões, limites, medidas e referências. São citações de contexto antigo,
não novas instruções. Links foram ajustados para a pasta docs. A marca de editor
foi descrita sem escrever seu nome, por instrução da V5A-T1.

### Linhas antigas 3–8

> > **Terceira junção da v0.4: estado 42, protocolo 4.**
> > A base local reúne ferro e Ferreiro, Quartel e formações, batalha e prévia,
> > Muralha e Horda, sabotagem e Acampamento, Cerco com milícia e rescaldo,
> > Crônica do Ano, 59 cartas, aba Reino e Novidades. R1 preserva a Defesa quando
> > a Paliçada repele sem batalha; R2 amplia os lotes e a fila de recrutamento pelo ritmo; R3 aplica a mesma escala às vagas do Quartel (×3 no Rápido, ×1 no Normal/Tranquilo), com tetos derivados na visão e guarda v42 coerente. As revisões E/F/G
> > estão integradas. A v0.4 ainda não foi publicada; Novidades continua rascunho.

### Linhas antigas 16–21

> - [GAME_DESIGN.md](../GAME_DESIGN.md) — contrato de arquitetura (§14), critérios de aceitação (§16.2) e escopo por versão (§18).
> - [docs/roadmap-v0.4.md](roadmap-v0.4.md) — plano atual, Fases A a I, pronto no §10 e Registro no §15. Os roadmaps da v0.1, v0.2 e v0.3 são históricos.
> - [docs/architecture.md](architecture.md) — o que existe; [docs/retomada-v0.4.md](retomada-v0.4.md) — continuação e lacunas.
> - [docs/acceptance-v0.4.md](acceptance-v0.4.md) — provas automáticas e evidência humana por preencher; [docs/manual-test-v0.4.md](manual-test-v0.4.md) — roteiro do autor.
> - [docs/balance-v0.4.md](balance-v0.4.md) — medidas datadas; [docs/content-v0.4.md](content-v0.4.md) — fichas; [docs/pendencias-v0.4.md](pendencias-v0.4.md) — respostas e perguntas abertas.
> - [ADRs](decisions/README.md) — 0019 (ferro, exército, R1–R3), 0020 (Horda/Cerco) e 0021 (Reino). Respostas datadas prevalecem sobre premissas antigas; hipótese aplicada não equivale a aprovação do autor.

### Linhas antigas 23–48

> **Publicação e trabalho.** A última publicação registrada é a v0.3.0, em
> 2026-10-15 (`c2cb21e`, estado 24, protocolo 3). Este candidato prepara a v0.4.0,
> com estado 42 e protocolo 4. A raiz, os oito pacotes e suas constantes públicas estão em 0.4.0. Antes de
> atribuir uma versão à produção, conferir `server`, `protocol` e `builtAt` em
> `GET /v1/version`.
>
> As trilhas trabalham em worktrees; o coordenador reúne o candidato em
> `v4-juncao3`. O `main` local só recebe o fast-forward depois do portão completo
> verde. O resultado do portão, o SHA candidato e o fast-forward local ficam registrados em `docs/retomada-v0.4.md`. D2 aceita o Regular em Senhor Normal em 92% (meta 65–80%), Tranquilo 78%, com ajuste fino no playtest/v0.5. **O push é do autor**, após backup manual do banco e registro do
> SHA de retorno: push no `main` com CI verde implanta automaticamente. A primeira
> publicação da v0.4 salta do estado 24 ao 42 e do protocolo 3 ao 4; o app aberto
> recebe 426. Procedimento e reversão com backup em [deploy/README.md](../deploy/README.md).
>
> O ensaio de restauração/reversão (ato 23), a evidência manual, a tag/release e o
> playtest externo continuam com o autor. Versões anteriores fecharam sem toda a
> evidência humana; isso não preenche o aceite da v0.4. O plano de cada tarefa fica
> escrito e a execução autorizada segue sem esperar aprovação de rotina.
>
> O jogo está no Coolify ([ADR 0009](decisions/0009-implantacao-no-coolify.md)),
> com banco, API, app e página de apresentação em domínio próprio ([ADR 0012](decisions/0012-pagina-de-apresentacao.md)).
> Continuam pendentes do autor: cópia externa de `RECOVERY_CODE_SECRET`, destino
> externo de backups, notificações operacionais e as confirmações editoriais do ADR 0012.
> **O vínculo GitHub continua desligado**: o device flow existe, testado com GitHub
> simulado; não ligá-lo nem removê-lo sem pedido. A produção usa o Código do Reino.
> Os ADRs 0006–0008, 0010–0011 e 0016 registram as dependências, marca, notificações,
> ritmo, licença MIT e respostas da v0.2; os ADRs 0017/0018, as regras herdadas da Guilda.

### Linhas antigas 107–107

> - Os projetos do Vitest ficam em `vitest.config.ts` (`test.projects`: `unit` e `integration`), não em `vitest.workspace.ts`: o Vitest 5 removeu o arquivo de workspace. Sem `TEST_DATABASE_URL`, o projeto `integration` não inclui nenhum arquivo e passa vazio.

### Linhas antigas 111–114

> - `@types/node` e `@types/pg` foram adotados na Fase 2 e aprovados depois ([ADR 0006](decisions/0006-types-node.md)); `engine`, `content` e `protocol` continuam com `types: []`.
> - A Crônica não traz as viradas de dia ([ADR 0007](decisions/0007-cronica-sem-viradas-de-dia.md)) nem o fecho diário do desperdício ([ADR 0015](decisions/0015-cronica-sem-o-fecho-diario-do-desperdicio.md)): nem, desde a V3D-T3, o nó de expedição que deu certo (pendência D-32 da v0.3; o que terminou em Revés ou Desastre sai como `expeditionNodeFailed` e é linha da Crônica): `chronicleRows` filtra `CHRONICLE_HIDDEN_EVENT_TYPES` (`dayStarted`, `storageWasted` e `expeditionNodeResolved`, em `@lotg/protocol`) em `GET /chronicle` e `/chronicle.md`, e o app usa a mesma lista no que mostra como Crônica (`game/returnReport.ts`). `GET /events` continua trazendo tudo.
> - **Ritmo e dificuldade** ([ADR 0011](decisions/0011-ritmo-3x-no-mvp.md); [ADR 0013](decisions/0013-regras-da-v0.2-tempo-ritmo-migracao-e-economia.md), decisões 2 e 2a): o jogador escolhe na criação (`POST /games` com `difficulty` e `timeScale`; os ritmos oferecidos são 3, 1 e 0,5, vindos de `balance.paces`) e a escolha fica gravada na linha e em `state.settings`, imutável. `GAME_TIME_SCALE` (padrão 3, de 0,5 a 10) é só o ritmo de quem não escolhe. O motor continua em tempo de jogo; `deriveViewState(state, gameTimeMs, { timeScale })` devolve prazos em segundos reais e taxas por hora real, inclusive nos textos de explicação. A visão é sempre em tempo real: o app não converte nada. As constantes de **tempo real** do motor são o prazo de resposta de uma carta do Conselho (`council.expiryRealMs`), a carência, o passo e a janela de retomada da deserção por fome (`morale.famineDesertionAfterRealMs`, `famineDesertionEveryRealMs`, `famineResumeWithinRealMs`) a antecedência do aviso da Torre (`threat.watchtowerLevels[].warningRealMs`) os quatro prazos do soldo em atraso (`heroes.arrears.discontentAfterRealMs`, `leaveAfterRealMs`, `leaveEveryRealMs`, `resumeWithinRealMs`; ADR 0017, decisão 3) e a espera da encruzilhada de uma expedição (`expeditions.crossroadsWaitRealMs`, convertida quando a equipe chega; ADR 0017, decisão 1); todas são convertidas com `settings.timeScale` por `realToGameMs` (`units.ts`), e nada mais no motor conta tempo real (ADR 0016). O soldo em si (`heroes.wagePerHour`) é tempo de jogo. Os testes de integração e em navegador rodam com `GAME_TIME_SCALE=1` (`packages/server/test/helpers/app.ts`), porque foram escritos nos tempos de jogo do GDD; o golden do motor também é no ritmo 1.
> - **Sorteios e lobos nos testes.** Toda partida nova tem os lobos do roteiro marcados, cartas do Conselho por sorteio e, no 13º dia de jogo, a carta da estrangeira, que dá um herói (e, com ele, soldo saindo do ouro). Nos testes de integração, quem conta eventos ou estoques de outra mecânica chama `quietHorde(server, gameId)`, e quem conta heróis, soldo ou ouro sem querer a carta, `councilRecess(server, gameId)`. No motor, `councilWithoutNews` e `councilScenario(…, true)` deixam a roteirizada como já saída. Nos testes em navegador o conselho fica **em recesso** (o que segura também a roteirizada: ela só sai em audiência) e a Horda **calada** por padrão (`/__test/council-recess`, `/__test/horde-quiet`, chamados por `tests/e2e/helpers.ts`); os cenários do Conselho chamam `world.conveneCouncil()` (o servidor de teste aceita `seed` em `POST /games`, por `allowGameSeed`) e os da incursão, `world.wolvesRoam()`. `/__test/council-deal` põe uma carta escolhida na mesa e `/__test/raise` põe um edifício no nível pedido (a Taverna posta assim ganha os candidatos na leitura seguinte) e `/__test/stock` põe o estoque de um recurso em um valor. Para as expedições: `/__test/hero` põe um herói no feudo, com o nome que o teste escolhe (os cenários das expedições não dependem de quem a Taverna sorteou: um nome de candidato dentro de uma frase já quebrou um teste em uma semente em sete), `/__test/item` põe um item no arsenal e `/__test/crossroads` põe o primeiro herói livre na encruzilhada da primeira variante da Floresta Antiga, com a Postura e o prazo pedidos; a expedição enviada pela tela tem variante que depende da semente, e o teste lê do servidor o que a tela tem de mostrar. Nos testes do motor, `tavernSite` e `tavernScenario` (`test-helpers.ts`) dão o canteiro e a Taverna recém-inaugurada pelo caminho do jogo; nos de integração, `tavernSite(server, gameId)` deixa a partida pronta para a obra. Nos testes em navegador a semente da partida é sorteada (fora dos cenários do Conselho): os candidatos da Taverna mudam a cada rodada, e um localizador pelo **texto** do nome de um herói pode achar outra linha (o preço com desconto diz "menos 20% por <nome>, Carismático"); ache a linha pelo nome sozinho (`getByText(nome, { exact: true })`) ou pelo botão.

### Linhas antigas 119–120

> - TypeScript está fixado em 6.x porque o `typescript-eslint` ainda não aceita o 7.
> - O build da imagem usa a raiz do repositório como contexto; o ignore é `deploy/Dockerfile.dockerignore`. `runtime` é o último alvo do `Dockerfile` de propósito (é o que sai sem `--target`); os alvos `web` e `landing` saem da base `static`, que é `debian:bookworm-slim` com o binário do Caddy copiado da imagem oficial, que é Alpine. O esbuild empacota o servidor inteiro, com as dependências, em `dist/main.js`: a imagem não tem `node_modules`. Uma dependência nova com binário nativo ou arquivos lidos em tempo de execução precisa ser tratada em `packages/server/esbuild.mjs`.

### Linhas antigas 151–151

> 6. **Não antecipar mecânicas de versões futuras**, nem só a estrutura. A v0.3 está publicada; a base local da v0.4 (estado 42, protocolo 4) já tem ferro, Mina Abandonada, Ferreiro, forja de armas, desgaste e reparo; Quartel, cinco unidades, treino, dispensa, formações salvas, Defesa ativa e comandantes; batalha e Conselho de Guerra; Muralha por ala, reparo prioritário, Baluarte e Torre Nv3+; incursões, Horda que aprende, presságios, sabotagem da Fortaleza e ataque ao Acampamento; Hora da Vigília, Plano, três ondas, decisões, reparo de emergência, milícia, resultados e rescaldo/Primavera da Reconstrução; Crônica do Ano com pontuação, Feitos e download; **59 cartas**, incluindo lotes 2/3 e Lobo Branco com caçada temporária; objetivos 17 a 21, Retorno e Antes de partir com guerra; **aba Reino** (ouro/estatísticas e saída do ranking, ADR 0021) e **Novidades** (v0.4 rascunho). As telas de milícia, prévia por onda e Crônica anual existem. **R1:** Paliçada que segura resolve sem batalha, baixas, dano à muralha, aprendizado ou relatório; Cerco sempre luta. **R2:** tetos de treino e recrutamento, com a fila, crescem pelo ritmo, em inteiros e nunca abaixo da base (0,5/1: base; 3: triplo); R3 escala também as vagas do Quartel pela mesma regra; custo e tempo por unidade não mudam. A base herdada inclui estações, moral, Conselho, heróis/soldo, Taverna, expedições, equipamento, Mercado, caravanas e Mestres. **Ainda não existem:** prévia ofensiva do Acampamento, vínculo persistido de relatório por onda e detalhamento das perdas da Queda na visão (G-23); dispensar/ensinar com Mestre, compra ou segundo destino de caravana, venda de item; mapa gráfico, postos avançados, Capela, relíquias/plantas, Veio de Ferro, Legado, Votos, Temporadas e mercado entre jogadores. Morte de herói fora de Rei de Ferro continua proibida. Não criar campos futuros vazios nem impedir a evolução prevista no GDD.

### Linhas antigas 166–166

> - **Protocolo 4.** `PROTOCOL_VERSION` é 4 desde o Cerco (V4G-T2): `pendingDecisions` é uma união fechada por `kind`, com carta, encruzilhada (`crossroads`) e decisão entre ondas (`siegeWave`). O 3 foi o das expedições; o 2, do Conselho. O SDK manda `X-Lords-Protocol` e o servidor responde `426 UPGRADE_REQUIRED` ("Recarregue a página") a outro número. O cache do app leva o protocolo na marca (`CACHE_VERSION`): a visão guardada pelo app anterior é descartada, e o cursor dos eventos fica. O `ViewState` cresce por adição, e adição **não** sobe o protocolo; só o que o app antigo não consegue ler sobe. As rotas continuam em `/v1`.

### Linhas antigas 198–199

> - **Só diz do jogo o que o jogo diz de si.** `src/page.test.ts` confere as linhas da Crônica citadas contra `@lotg/content` e barra as formas mais comuns de promessa de duração de dia ou ano (ADR 0011), as viradas de dia (ADR 0007), preço, multijogador, GitHub e o nome "marca de editor vedada pelo ADR 0008"; o que a expressão regular não pega continua proibido. Nenhum número de regra no texto; o que ainda não existe só aparece no parágrafo "No horizonte", sem data. Quando uma versão do jogo entrega o que estava lá, a frase sai do horizonte na mesma publicação (em 2026-10-05 saíram as estações com efeito e o Conselho).
> - As pinturas são **arte conceitual gerada por IA** e levam essa legenda; a página abre com uma **captura real do jogo**. As capturas saem de `pnpm capture:landing` (API no ritmo de produção), que **só roda à mão**: nada avisa que uma captura ficou velha. O roteiro falha se a disposição da aba Feudo mudar, e então o texto alternativo e a legenda da captura precisam ser relidos (a página refeita em 2026-11-17, o almanaque das quatro estações, não prende rótulos à captura). A captura do Cerco é só o painel, porque a partida das capturas está na Primavera. As capturas mostram os ícones do app (Codicons, CC BY 4.0), e a página dá o crédito no rodapé.

### Linhas antigas 211–211

> - **Exclusão.** Bloqueio imediato, revogação de todas as sessões, limpeza do código de recuperação e arquivamento das partidas em transação; resposta 202 com `deletedAt`/`purgeAfter`. Primeiro job a partir de sete dias remove dependentes em cascata; backups seguem retenção de 14 dias desde a geração. Logout, exclusão e sessão revogada limpam tokens e cache local. Não prometer remoção física imediata nem oferecer desfazer exclusão. Os dados da v0.2 vivem em `games.state` e `game_events`, e saem no mesmo expurgo.

### Linhas antigas 225–227

> - **Versões do estado.** Uma versão por tarefa que muda a forma do `GameState`, um passo por versão em `migrations/` (forma exata da versão de que parte, identificadores escritos no arquivo, nada importado de `@lotg/content`), retratos congelados em `__fixtures__/` com impressão digital. Todo prazo que um passo cria conta de `context.boundaryMs` (a fronteira **daquele** passo), nunca de `state.migratedAtMs`. Um passo não emite eventos. Sem o passo, a partida de quem já joga quebra no primeiro `advanceTo`.
> - **Sorteios** (`random.ts`): xoshiro128\*\* com fluxos nomeados em `state.rng`: os fixos (`morale`, `council`, `horde`, desde o estado 16, `tavern`, e, desde o 21, `market`, que só nasce na primeira virada de dia com o Mercado de pé; um fluxo novo para cada assunto novo) e, desde o estado 13, os **de entidade** (`expedition:expedition-<n>`, `caravan:caravan-<n>`), um por entidade viva, com o tipo igual à família e `n` de 1 ao contador de `state.ids`, apagados com `dropStream` quando a entidade termina (o da expedição, na volta, como último passo dela no instante; o da caravana nasce no sorteio da chegada e é apagado no mesmo instante, e por isso nunca chega a ser gravado). A guarda de forma confere `rng` contra `ids` e exige, desde o estado 17, que todo fluxo `expedition:<id>` seja de uma expedição em curso e, desde o 22, que todo fluxo `caravan:<id>` seja de uma caravana na estrada. Dentro de um nó a ordem dos sorteios é fixa: a sorte, depois (com a V3D-T2) quem sofre o desfecho, depois as quantidades do saque na ordem dos recursos. Só `advanceTo` sorteia, dentro de um instante marcado da linha do tempo; nunca `applyCommand`, `deriveViewState`, `nextEventAt`, a criação ou a migração. Só se sorteia o que pode acontecer. O estado do gerador nunca sai na visão. Trocar o algoritmo é mudar regra (`RNG_VERSION`, vetores, migração).
> - **Identidades** (`ids.ts`): `nextId(draft, tipo)` devolve `<tipo>-<n>` de um contador em `state.ids` que só sobe; nunca relógio, UUID ou sorteio. Só uma ordem aceita e um evento da linha do tempo criam entidades; `deriveViewState`, `nextEventAt`, a criação e a migração nunca, e o objeto `ids` não sai na visão (os identificadores que a visão mostra, como `hero-3` e `offer-7`, deixam inferir quantos já foram criados: é inofensivo, e não é segredo). Uma ordem pode criar uma entidade, mas não sorteia: contratar na Taverna cria o herói de um candidato que a rotação já tinha sorteado. Há os tipos `hero` (criado só por `arrivals.ts`), `offer` (a oferta de um candidato, criada só por `tavernTurn.ts`), `expedition` (criada só por `expeditionOrders.ts`, na ordem de envio, que não sorteia: a variante do grafo sai de um hash da semente e do modelo mais o número de envios, `hash.ts`), `item` (o item achado no fim de um nó, `expeditionTurn.ts`) `caravan` (criada só por `caravanOrders.ts`, na ordem de envio, que também não sorteia) e `master` (criado só por `masterTurn.ts`, na chegada; a ordem `assignMaster` não cria nada, e Mestre nenhum tem fluxo de sorteio).

### Linhas antigas 229–232

> - **Cartas.** Os ids de carta e de opção publicados são fixados em `packages/content/src/council.test.ts`: mudar um pede passo de migração. Toda carta nova muda o sorteio de todas as sementes (goldens, retratos, `COUNCIL_SCENARIO_SEED`): o README do motor, "Uma carta nova", tem a receita. Os ids dos heróis com nome (`NAMED_HERO_IDS`) também ficam gravados no estado (`guild.arriving`) e estão fixados no mesmo teste.
> - **Expedições.** Os ids de modelo, de nó e de opção publicados são fixados em `packages/content/src/expeditions.test.ts` (`STABLE_IDS`): uma expedição em curso guarda `modelId`, `variant` (a posição na lista), `nodeId` e o `optionId` de cada escolha, e mudar um deles pede passo de migração (acrescentar é livre; a expedição cujo nó o conteúdo deixar de ter volta para casa). Uma dificuldade, um peso ou uma recompensa que muda aparece no golden da calibragem (`__golden__/expedition-calibration.md`), e uma frase, no dos relatórios (`expedition-catalog.json`). A frase de um desfecho diz quem se destacou em `{heroi}`, vale para herói e heroína e não afirma o dano (quem sofre é sorteado). O README do motor, "Uma expedição nova", tem a receita.
> - **A carta roteirizada** ("Estrangeira ferida", `scripted: { atGameDay: 13 }`): sai no sorteio da audiência, na frente das sorteadas, uma vez por partida, e **pede lugar na mesa sem reservá-lo**: com as duas cartas pendentes espera a audiência seguinte. `atGameDay` é um piso: a partida que já passou do dia a recebe na primeira audiência com lugar, sem passo de migração que a agende. Só `arrivals.ts` cria herói (`promiseHero`, `settleHeroArrivals` e `admitHero`, a porta também do herói contratado); o teto da lista (`rosterCap`) faz a recompensa esperar, nunca se perder.
> - **Taverna** (`tavern.ts`, as contas; `tavernTurn.ts`, a rotação e o fim do festival; `tavernOrders.ts`, as ordens; `tavernView.ts`): a rotação é **ancorada** na inauguração e tem instante próprio em `nextEventAt` (quase nunca é virada de dia); o sorteio é sem reposição dentro de uma lista e não repete o nome de quem já serve; o número de candidatos é o do nível no instante da troca; a rotação de um instante resolve antes da ordem daquele instante (`OFFER_GONE`). O festival é um efeito temporário de moral (`id: 'festival'`), um por estação, e acaba em uma virada de dia, sem instante próprio. Os ids dos modelos de candidato (`TAVERN_CANDIDATE_IDS`) ficam gravados no estado (`guild.tavernOffers[].templateId`), e a ordem deles e a dos nomes (`heroNames`) fazem parte do sorteio: mexer nelas muda quem toda Taverna oferece.

### Linhas antigas 238–239

> - `main` sempre verde (`pnpm verify`). Tarefas de tamanho `L` em branch (`f1-t5-construcoes`) com merge ao final; na v0.4, trilhas em worktrees e integração pelo coordenador, um commit por assunto.
> - Commits: `F1-T3: resumo no imperativo` (na v0.2, `V2C-T2: …`; na v0.3, `V3B-T1: …`; na v0.4, `V4B-T1: …`; correções de revisão, `V2C: corrige …` e `V3B: corrige …`, um commit por defeito). Nunca logar tokens, códigos de recuperação ou segredos.

### Linhas antigas 243–248

> Uma tarefa do roadmap por sessão; a ordem das fases é obrigatória. Para tarefas `M` e `L`, apresentar o plano e esperar aprovação antes de codar (na v0.3, por pedido do autor, o plano fica escrito e a execução segue sem a espera).
>
> 1. Rodar os comandos da seção "Verificação" da tarefa e `pnpm verify` (mais `pnpm test:integration` se tocar o servidor, `pnpm test:e2e` se tocar o app web, `pnpm test:e2e:landing` se tocar a página de apresentação; se tocar o motor ou o conteúdo, a matriz já roda no `pnpm test`, e uma faixa que falha é regressão a corrigir nos números, nunca no bot) e mostrar a saída. Confira o `pnpm verify` pelo código de saída: `| tail` esconde a falha de um pacote. Se a mudança tocar a aba Feudo, a barra de status ou o modo discreto do app, rodar também `pnpm capture:landing` e refazer as três imagens e o `og.png` da página (packages/landing/README.md). Sem saída de teste, não há tarefa concluída.
> 2. Marcar as caixas da tarefa no roadmap da versão e preencher a linha no Registro de Execução (§9 do MVP-ROADMAP.md, §11 do roadmap da v0.2, §12 do roadmap da v0.3), com o que foi verificado **e o que não foi**. Procurar o que a tarefa tornou falso em `CLAUDE.md`, nos READMEs e em `docs/`.
> 3. Desvios do GDD → `docs/decisions/NNNN-titulo.md`, aguardando aprovação.
> 4. Um commit por tarefa (ou por subtarefa em tarefas `L`).

### Linhas antigas 254–254

> - Publicar ou implantar sem o autor pedir. O jogo está em produção no Coolify ([ADR 0009](decisions/0009-implantacao-no-coolify.md)) e **todo `push` no `main` com o CI verde é implantado sozinho** pelo job `deploy` de `.github/workflows/ci.yml`: dar `push` no `main` é publicar. Na v0.3, desde 2026-10-06 (ADR 0017, "Respostas de 2026-10-06"), **quem dá o `push` é o autor**: o agente faz commits locais, e ao fechar o candidato avisa o autor, responsável pelo backup manual do banco antes de todo `push` que sobe a versão do estado. A autorização de 2026-10-05 ("`push` em versão estável", lida como todo fim de fase) não vale mais como estava.

## Conferência da V5A-T1

Cada linha cobre um parágrafo, regra ou bloco da revisão antiga; títulos e linhas
vazias só estruturavam o texto. Nenhuma regra vigente foi descartada por economia.
“Removida porque falsa” vale só para a afirmação indicada; seu contexto fica acima.

Destinos: **C** = [CLAUDE.md novo](../CLAUDE.md); **H** = este histórico;
**E** = [README do motor](../packages/engine/README.md);
**S** = [README do servidor](../packages/server/README.md);
**A** = [README do app](../packages/web/README.md);
**L** = [README da landing](../packages/landing/README.md);
**D** = [deploy/README.md](../deploy/README.md). As seções citadas foram lidas antes
de condensar a regra; onde faltava detalhe, ele ficou no CLAUDE. Referências a
“Publicação e trabalho” identificam o parágrafo em §O que é.

| Linhas antigas / regra ou parágrafo | Onde ficou |
| --- | --- |
| 3–8: Abertura/candidato | C abertura; H §Memória anterior (publicada; Novidades ainda draft). |
| 12–14: O que é | C §O que é. |
| 16: GDD | C §O que é. |
| 17: Plano v0.4 atual | C §O que é; H §Memória anterior. Removida porque falsa: plano atual é v0.5. |
| 18: Arquitetura/retomada | C §O que é; H §Memória anterior (retomada histórica). |
| 19: Aceite/roteiro v0.4 | H §Memória anterior; C §O que é (aceite humano). |
| 20: Balanceamento/conteúdo/pendências v0.4 | H §Memória anterior. |
| 21: ADRs e autoridade de respostas | C regra 7; H §Memória anterior. |
| 23–27: Publicação e trabalho | C §Publicação e trabalho; H §Memória anterior. Candidato removido porque falso (CHANGELOG). |
| 29–34: Worktrees/junção/D2/push/salto | C §Regime rápido/§Nunca; D §Atualizar e reverter; H §Memória anterior. |
| 36–39: Atos do autor/plano sem espera | C §Regime rápido; H §Pendências herdadas/§Memória anterior. |
| 41–44: Coolify/domínios/pendências | C §O que é; H §Pendências herdadas; D §Operação. |
| 45–46: GitHub desligado/Código do Reino | C §O que é; S §Vínculo GitHub pelo navegador. |
| 47–48: ADRs herdados | H §Memória anterior; C §O que é (índice dos ADRs). |
| 50: Ler por seção | C §O que é. |
| 54: Ambiente/Linux | C §Comandos. |
| 56–103: Bloco de comandos | C §Comandos/§Regime rápido; H §Comandos anteriores. Exemplos redundantes do sim condensados. |
| 105: Guia dos detalhes de execução | C §Comandos; READMEs indicados. |
| 107: Projetos Vitest/integração vazia | C §Comandos; H §Memória anterior (Vitest 5). |
| 108: Pacotes como fonte/build | C §Pacotes. |
| 109: Goldens explícitos/intencionais | C §Regime rápido; E §Goldens. |
| 110: Integração/reset/relógio/token/bancos | C §Comandos; S §Testes. |
| 111: Tipos Node/pg e types vazio | C §Pacotes; H §Memória anterior (aprovação). |
| 112: Filtro da Crônica | C §Contratos; H §Memória anterior (ADRs/V3D-T3). |
| 113: Ritmo/dificuldade/tempo real | C §Motor; S §Dificuldade e ritmo das partidas; H §Memória anterior. |
| 114: Sorteios/lobos/helpers/localizadores | C §Comandos; A §Testar/§As expedições; H §Memória anterior (incidente). |
| 115: Testes web/Node/golden relativo | C §Comandos; A §Testar. |
| 116: E2e/API/build/um worker/db_test | C §Comandos; A §Testar (build/API); H §Portas e testes. |
| 117: Saltos de tempo/espera | C §Comandos; A §Testar. |
| 118: CSP em dev/build | C §Comandos; A §O que é próprio do navegador. |
| 119: TypeScript 6/compatibilidade | C §Comandos (ambiente); H §Memória anterior (motivo histórico, sem afirmar suporte externo atual). |
| 120: Docker/Caddy/esbuild/nativas | C §Servidor; S §Build e imagem; H §Memória anterior (bases). |
| 121: Migrações SQL/lock 727 | C §Servidor; S §Migrações. |
| 122: API host/node_modules/perfis | C §Comandos; H §Comandos anteriores (perfis full/tools); D §Instalação atual. |
| 123: Banco dev/env/segredo independente | C §Comandos/§Contratos/§Nunca; D §Operação. |
| 127–138: Oito pacotes e papéis | C §Pacotes. |
| 140: Direção/imports/bundle/landing | C §Pacotes. |
| 144: Motor decide/servidor/app | C §Regras de arquitetura. |
| 146: Regra 1: Regra no motor/números no conteúdo | C regra 1. |
| 147: Regra 2: Autoridade/relógio/névoa | C regra 2. |
| 148: Regra 3: Milésimos/segmentos | C regra 3. |
| 149: Regra 4: Comandos/idempotência | C regra 4. |
| 150: Regra 5: Dependências/crypto/ADR | C regra 5. |
| 151: Regra 6: Escopo existente/futuro/R1–R3 | C regra 6; E §O que ainda não existe/§A incursão-batalha; C §Motor (R2/R3); H §Memória anterior. |
| 152: Regra 7: Decisões do autor/GDD | C regra 7; H §Decisões substituídas (D-1…D-31). |
| 153: Regra 8: Regra nova/golden/GDD | C regra 8. |
| 157: Guia do servidor | C §Servidor; S (seções indicadas). |
| 159: Schemas/AppContext/clock | C §Servidor. |
| 160: lockGame/persistState/versão/eventos | C §Servidor; S §Contratos que valem a pena ter em mente. |
| 161: Commit antes do erro | C §Servidor/§Contratos; S §Contratos que valem a pena ter em mente. |
| 162: Forma/regra/faixas/ritmo | C §Servidor; S §Dificuldade e ritmo das partidas. |
| 163: Igualdade de tipos | C §Servidor/§Regime rápido. |
| 164: Estado cru/migração/guardas | C §Servidor; S §Migração do estado. |
| 165: Catálogo público/ETag/sem fatores | C §Servidor; S §GET /v1/catalog. |
| 166: Protocolo/426/cache/adição | C §Servidor/§Cliente; S §O que tem versão; A §Cache e versões; H §Memória anterior. |
| 170: Guia do app | C §Cliente; A (seções indicadas). |
| 172: SDK/refresh/rede/erro | C §Cliente (SDK). |
| 173: Controller/navegador/módulos puros | C §Cliente; A §Estrutura/§O que é próprio do navegador. |
| 174: Mercado/caravana/quoteDay/total | C §Cliente; A §O Mercado, as caravanas e os Mestres. |
| 175: Paleta/runCommand/Actions/sem rede | C §Cliente; A §Estrutura. |
| 176: prepare/UUID/alvo/intenção/trava | C §Cliente; A §Ordens e “Tentar de novo”. |
| 177: Guilda/expedições/travas/diálogo/dispensa | C §Cliente; A §A Guilda e a Taverna/§As expedições. |
| 178: Resposta de carta única | C §Cliente. |
| 179: Árvore navega/rowActions | C §Cliente. |
| 180: Ausência/Hoje/retorno/Antes de partir | C §Cliente; A §Relatório de Retorno em três blocos e “Sua escolha voltou”. |
| 181: Polling/prazos/zero | C §Cliente; A §As expedições (Leitura antecipada). |
| 182: Cache/marca/schema/VIEW_FORMAT | C §Cliente; A §Cache e versões. |
| 183: Lembrete 48 h reais | C §Cliente. |
| 184: Sem números de regra no cliente | C regras 1/8 e §Cliente. |
| 185: Fila de mudança de conta | C §Cliente. |
| 186: localStorage/limpeza/abas | C §Cliente; A §O que é próprio do navegador. |
| 187: Lock do refresh | C §Cliente; A §O que é próprio do navegador. |
| 188: CSP/sem embutidos/classes | C §Cliente; A §O que é próprio do navegador. |
| 189: Cores/variáveis/3 temas/4,5:1 | C §Cliente; A §Estrutura. |
| 190: Foco/teclado/useLayoutEffect | C §Cliente (guia); A §O que é próprio do navegador. |
| 191: start antes do render | C §Cliente (guia); A §O que é próprio do navegador. |
| 195: Guia/ADR da landing | C §Página de apresentação; L (seções indicadas). |
| 197: Estática/origem/armazenamento/API | C §Página de apresentação. |
| 198: Promessas/citações/horizonte | C §Página de apresentação; L §O que a página pode dizer; H §Memória anterior (2026-10-05). |
| 199: Arte/capturas/legendas/Cerco/créditos | C §Página de apresentação; L §Capturas do jogo/§O que a página pode dizer; H §Memória anterior (2026-11-17). |
| 200: CSP/cores/contraste/terceiros | C §Página de apresentação; L §O que a página pode dizer/§Testar. |
| 201: URLs no build | C §Página de apresentação; L §Rodar. |
| 202: Título diferente/monitor | C §Página de apresentação; L §Limites conhecidos. |
| 206: Avanço preguiçoso/recibo/job | C §Contratos; S §Contratos que valem a pena ter em mente. |
| 207: Transação/recibo/replay/conflito | C §Contratos; S §Contratos que valem a pena ter em mente. |
| 208: JSONB/replay/fronteiras/eventos | C §Contratos; E §Versões do estado e migração. |
| 209: Polling/ETag/concorrência/cache | C §Contratos/§Cliente; S §Contratos que valem a pena ter em mente. |
| 210: Sessões/recuperação/HMAC | C §Contratos. |
| 211: Exclusão/expurgo/backups/limpeza | C §Contratos/§Cliente; D §Backup e restauração; H §Memória anterior (dados v0.2). |
| 215: API pública/receitas | C §Motor; E §API pública/receitas. Lista corrigida: também exporta ENGINE_VERSION. |
| 217: Pureza/clonagem/sem mutação | C §Motor; E §O ciclo/§Invariantes. |
| 218: nextEventAt/todos os prazos/Mestre | C §Motor (guia/ciclo/ordem); E §O ciclo/§Mestres/§Como adicionar um evento. |
| 219: Ordem no mesmo instante/calendário/nó | C §Motor (ordem/sorteios); E §Invariantes/§Expedições/§Caravanas. |
| 220: Inteiros/restos/frações/timeScale | C §Motor; E §Invariantes. |
| 221: Divisão exata/estado/eventos/RNG | C §Motor; E §Invariantes. |
| 222: Comando avançado/recusa/repouso | C §Motor; E §O ciclo/§Invariantes. |
| 223: Emissão/Crônica fora do estado | C regra 8 e §Contratos/§Motor; E §Como adicionar um evento. |
| 224: Deriváveis não persistidos | C §Motor (guia/ciclo); E §Invariantes. |
| 225: Versão/passo/guarda/retrato/fronteira | C §Motor; E §Versões do estado e migração; H §Decisões substituídas (D-4). |
| 226: Sorteios/fluxos/vida/algoritmo | C §Motor; E §Sorteios; H §Memória anterior (versões/ordem antiga incompleta). |
| 227: nextId/módulos/contador/hash | C §Motor; E §Identidades. |
| 228: Névoa/expedições/previsões | C regra 2 e §Motor; E §Conselho do Feudo/§Taverna/§Expedições. |
| 229: Ids cartas/heróis/novas sementes | C §Motor (receitas); E §Uma carta nova/§Conselho do Feudo. |
| 230: Ids expedição/migração/goldens/texto | C §Motor (receitas); E §Uma expedição nova. |
| 231: Carta roteirizada/porta/teto | C §Motor (receitas); E §A carta roteirizada/§Heróis e soldo. |
| 232: Taverna/rotação/festival/ordem | C §Motor (receitas); E §Taverna. |
| 236: Português/narrativa/inglês | C §Convenções. |
| 237: Local dos testes/testes primeiro | C §Convenções. |
| 238: main/branches/worktrees/commits | C §Convenções/§Regime rápido; H §Memória anterior. |
| 239: Prefixos/um defeito/segredos | C §Convenções; H §Memória anterior (prefixos antigos). |
| 243: Uma tarefa/fases/plano/aprovação | C §Regime rápido; H §Decisões substituídas. |
| 245: Verify/suítes/matriz/capturas/saída | C §Regime rápido/§Página de apresentação; L §Capturas do jogo; H §Decisões substituídas. |
| 246: Registro/verificado/não/docs falsas | C §Regime rápido; H §Memória anterior (registros antigos). |
| 247: Desvios do GDD | C regra 7. |
| 248: Commit por tarefa/subtarefa | C §Convenções/§Regime rápido; H §Decisões substituídas. |
| 252: Nunca: down -v | C §Nunca. |
| 253: Nunca: segredos/RECOVERY_CODE_SECRET | C §Nunca. |
| 254: Nunca: publicar/push/backup/autor | C §Nunca/§Regime rápido; D §Atualizar e reverter; H §Memória anterior/§Decisões substituídas. |
| 255: Nunca: reversão sem backup/v0.1.0 | C §Nunca; D §Reverter depois de uma migração de estado. |
| 256: Nunca: marca do editor | C §Nunca (mesmo alcance, nome omitido por instrução da tarefa). |
| 257: Nunca: mesclar contas | C §Nunca. |
| 258: Nunca: Alpine | C §Nunca. |
