# Roadmap da v0.5 — "Mundo e Legado"

> **Versão 0.2 do plano** (2026-11-17), revisada contra o código do `main` (`b7640394`; estado
> **42**, protocolo **4**, v0.4.0 publicada). **Nada aqui está aprovado**: o autor responde à §4.
> Regras: GDD §8.1, §11.5, §11.6, §6 (Capela, Posto Avançado), Apêndice D (relíquias); critérios
> no GDD §16.2. "Proposta" marca nome ou símbolo que **ainda não existe** no código.

## 0. Princípios

A v0.4 levou um mês, e a maior parte foi portão, remedição de faixas e registro, não mecânica
(`pnpm verify` ~32 min; portão completo ~1h30). Pedido do autor: **entregar rápido** e **divertir**.

1. **Jogador primeiro.** Toda fase termina em algo que se vê e se usa, e é publicada.
2. **O agente roda o que tocou; a CI roda o resto**, em branch, antes de publicar (§2).
3. **Matriz só no fechamento de fase.** Os bots só aprendem as mecânicas novas na Fase H: as
   faixas do Ano 1 não devem se mexer antes disso, e faixa que se mexe é regressão.
4. **Uma linha por tarefa** no Registro (§11). Sem relatório por fase.
5. **Escopo mínimo que diverte.** O que o GDD pede a mais vai para a v0.6, por decisão (§4).

## 1. O que o jogador sente

> "Quero jogar o Ano 2 de outro jeito."

- Ergue a **Capela** e escolhe quais **relíquias** ficam nos poucos espaços dela.
- Chega ao **Ano 2** e ele é outro: Horda maior, **Trolls**, **Votos** que valem mais pontos.
- Vê a **semente**, desafia um amigo com ela e acumula **Legado** na conta.
- Abre a aba **Mapa**: hexágonos, névoa, o Covil e a Fortaleza no lugar, **postos avançados**.
- Toda segunda entra na **Temporada**: a mesma prova para todos e um ranking da semana.

## 2. Regime rápido

### 2.1 O ciclo de uma tarefa (minutos)

| Passo | Comando | Quando |
| --- | --- | --- |
| Tipos | `pnpm typecheck` | Sempre: pega protocolo ≠ motor (igualdade de tipos). |
| Foco | `pnpm --filter @lotg/<pacote> test -- <nome>` | Os arquivos da lista "Testes" da tarefa. |
| Sentinelas | `pnpm test:guards` | Antes de cada commit que toca motor, conteúdo ou protocolo. |
| Tela | `pnpm test:e2e <arquivo>` | Só o cenário novo ou alterado. |
| Formato | `pnpm exec prettier --check <arquivos>` e `pnpm exec eslint <arquivos>` | Antes do commit. |

- `nice -n 19` e `--maxWorkers=2` continuam. Uma suíte pesada por vez.
- Golden: `UPDATE_GOLDEN=1` **só no arquivo da tarefa**; o diff é lido e explicado na mensagem
  do commit. Golden de outra mecânica que muda sem a tarefa pedir é defeito, não regravação.
- **Não** rodar localmente: `pnpm verify`, a matriz, a integração inteira, o e2e inteiro.

### 2.2 Sentinelas: o que o teste focado não vê

`pnpm test:guards` roda só os arquivos que amarram um pacote ao outro:

| Sentinela | Protege |
| --- | --- |
| `engine`: `purity`, `fixtures`, `migrations`, `state`, `view` | API pública, retratos, cadeia de migração, golden da visão (que o app importa). |
| `content`: `content`, `council`, `expeditions` | Schemas e ids publicados (cartas, modelos, nós). |
| `protocol`: `protocol` | Schemas do `ViewState` e dos comandos. |
| `web`: `bundle`, `tabs` | Nenhum número ou frase do conteúdo no navegador; as abas renderizam o golden. |
| `landing`: `page` | A página só diz o que o jogo diz (o "horizonte" muda a cada publicação). |

`packages/engine/src/migrations.test.ts` **não** entra nas sentinelas: leva ~20 min (§2.4).
Roda na CI (`test:matrix`) e localmente só quando a tarefa muda a forma do estado (§2.3).
O tempo de `test:guards` fica no Registro (§11).

Complemento antes do `push` do branch: `pnpm test:changed` (`vitest run --project
unit --changed main`, sem os arquivos pesados da §2.4). Como os pacotes são consumidos como
fonte, o grafo de importação atravessa os pacotes.

### 2.3 "Toquei X, rodo Y"

| Tocou | Roda |
| --- | --- |
| `packages/content` | foco + sentinelas + o teste do motor da mecânica. |
| `packages/engine` (regra) | foco + sentinelas. |
| `packages/engine` (forma do estado) | acima + `fixtures`, `migrations` (~20 min) e o teste do passo novo. |
| `packages/protocol` | `typecheck` + sentinelas. |
| `packages/server` | `TEST_DATABASE_URL=… pnpm test:integration <nome>` (**sem** `--`). |
| `packages/web` | o teste da aba ou do módulo + `bundle` + um e2e. |
| Número de balanceamento | acima + `pnpm test:matrix` **na CI**, não local. |

### 2.4 A CI como portão pesado

Conferido em `.github/workflows/ci.yml`: roda em `push` no `main` e em **todo `pull_request`**;
o job `deploy` já tem `if: push && refs/heads/main`. Logo:

- **Não é preciso mudar gatilho**: o agente dá `push` no branch `v5-<fase>` e abre **PR
  rascunho** (`gh pr create --draft`); a CI inteira roda sem implantar. `gh pr checks --watch`.
- **Portão no `ci.yml` (V5A-T2):**
  1. O job `verify` roda `pnpm verify:fast`; o job `matrix` roda
     `pnpm test:matrix`, em paralelo. `deploy.needs` inclui `matrix`.
  2. No `matrix`, em PR, rodar só quando o diff toca `packages/{engine,content,sim-cli}`
     (um passo com `git diff --name-only` contra a base do PR; sem action de terceiros).
     O checkout busca o histórico completo. Sem mudança nesses pacotes, só os passos da
     matriz são pulados; o job termina verde. No `main` roda sempre.
- **Scripts no `package.json`:** `test:fast` (unit sem os arquivos pesados da tabela
  abaixo), `test:matrix` (só eles), `test:guards`, `test:changed`,
  `verify:fast` (`lint && typecheck && test:fast`). **`pnpm test` e `pnpm verify` continuam
  completos**: é o que o `main` exige.

**Medição local de 2026-11-17 (V5A-T2):** uma execução de
`nice -n 19 pnpm exec vitest run --project unit --maxWorkers=2 --reporter=verbose`,
com saída em log: **1631,62 s** no relógio, **250 arquivos** (Node 24.15.0, Vitest 5.0.3).
O `verbose` desta versão omite o total por arquivo. Os tempos abaixo vieram de
`TestModule.diagnostic()` da mesma execução, capturado ao fim por um observador de relatório.
Somam ambiente, preparação, coleta e testes. A coleta inclui as simulações no topo dos
arquivos; somar apenas os tempos das asserções esconderia quase todo o custo de `balance`
e `coverage`. Os tempos por arquivo se sobrepõem, pois há dois workers.

Os **quatro arquivos acima de 60 s** concentram **87,2%** da soma dos tempos por arquivo
e formam `test:matrix`.
Todos os demais ficaram abaixo de 38 s. `perf` e `siege-report` continuam em `test:fast`.
A tabela inclui todos os 21 arquivos do `sim-cli` e os demais unit acima de 30 s.

| Arquivo | Segundos | Script |
| --- | ---: | --- |
| `packages/sim-cli/src/balance.test.ts` | 1377,110 | `test:matrix` |
| `packages/engine/src/migrations.test.ts` | 1199,806 | `test:matrix` |
| `packages/sim-cli/src/matrix.test.ts` | 142,912 | `test:matrix` |
| `packages/sim-cli/src/coverage.test.ts` | 94,687 | `test:matrix` |
| `packages/engine/src/random.property.test.ts` | 37,480 | `test:fast` |
| `packages/engine/src/ids.test.ts` | 33,428 | `test:fast` |
| `packages/sim-cli/src/bots/bots.test.ts` | 17,417 | `test:fast` |
| `packages/sim-cli/src/simulate.test.ts` | 9,704 | `test:fast` |
| `packages/sim-cli/src/bots/militar.test.ts` | 9,693 | `test:fast` |
| `packages/sim-cli/src/timescale.test.ts` | 6,772 | `test:fast` |
| `packages/sim-cli/src/bots/explorador.test.ts` | 6,753 | `test:fast` |
| `packages/sim-cli/src/bots/mercado.test.ts` | 6,728 | `test:fast` |
| `packages/sim-cli/src/perf.test.ts` | 3,525 | `test:fast` |
| `packages/sim-cli/src/siege-report.test.ts` | 3,109 | `test:fast` |
| `packages/sim-cli/src/bots/ferreiro.test.ts` | 3,049 | `test:fast` |
| `packages/sim-cli/src/bots/ferro.test.ts` | 2,505 | `test:fast` |
| `packages/sim-cli/src/difficulty.test.ts` | 2,160 | `test:fast` |
| `packages/sim-cli/src/smoke.test.ts` | 1,228 | `test:fast` |
| `packages/sim-cli/src/bots/cerco.test.ts` | 0,713 | `test:fast` |
| `packages/sim-cli/src/report.test.ts` | 0,560 | `test:fast` |
| `packages/sim-cli/src/bots/finta.test.ts` | 0,527 | `test:fast` |
| `packages/sim-cli/src/bots/mestres.test.ts` | 0,350 | `test:fast` |
| `packages/sim-cli/src/cli.test.ts` | 0,349 | `test:fast` |
| `packages/sim-cli/src/bands.test.ts` | 0,294 | `test:fast` |

**Partição conferida com `vitest list --project unit --maxWorkers=2 --filesOnly --json`,**
usando os mesmos argumentos de cada script (trocando `run` por `list`): `test` = **250**,
`test:fast` = **246**, `test:matrix` = **4**. União = **250**; ausentes = **0**;
extras = **0**; interseção = **0**. `test:changed` usa as mesmas exclusões de `test:fast`.
`test:guards` seleciona exatamente as **12 sentinelas** da §2.2; nenhum equivalente foi
necessário. `pnpm test` e `pnpm verify` mantêm os comandos originais, sem exclusões.

**Falha observada na medição completa:** 249 arquivos passaram e um falhou:
`packages/engine/src/palisade.test.ts:514`, propriedade de divisão de intervalo,
semente `-863285096`. A igualdade entre os avanços passou; a asserção do nível final
da Paliçada recebeu 1 e esperava 2. O arquivo e o motor não foram alterados.
Esse teste permanece em `test:fast`. Resultado detalhado e limites da validação na §11.

### 2.5 Publicar por fase sem `main` vermelho

1. Branch `v5-<fase>` rebaseado no `main`; PR rascunho com a CI **verde naquele SHA**.
2. Sessão principal revisa o diff e as capturas (artefato `e2e` da CI).
3. Backup manual do banco (sempre que a versão do estado sobe); SHA de retorno anotado.
4. Com a autorização do autor para a fase: `git push origin <sha-verde>:main` (avanço rápido,
   **o mesmo SHA testado**; nunca um merge novo). A CI do `main` roda de novo e só então implanta.
5. Conferir `GET /v1/version` e uma linha no Registro.

- Se a CI do `main` falhar, nada é implantado; corrige-se no branch e repete-se.
- `main` local só anda por avanço rápido de um SHA verde. Sem commits de fase direto nele.
- Landing: tirar do "No horizonte" (`packages/landing/src/index.html`) o que a fase entregou,
  **na mesma publicação**.

### 2.6 Trilhas paralelas

- **Uma trilha de estado por vez.** Só um branch mexe em `GameState`/migrações; as junções da
  v0.4 custaram retratos regravados. Em paralelo só o que não muda a forma: tela, servidor,
  landing, conteúdo de texto.
- Versões do estado **reservadas** (§5.1). Ninguém pega número fora da tabela.

### 2.7 O que não muda

- Motor decide, servidor orquestra, app exibe; números só em `content`; app sem conta de regra.
- Toda forma nova do `GameState` tem passo de migração, retrato e guarda de forma.
- Só `advanceTo` sorteia; criação, migração, ordem e visão **nunca**. `nextId` para entidades.
- Névoa no servidor (agora também no mapa e na semente da Temporada).
- CSP: sem `style="…"`; cores só em `theme/themes.css`; nenhuma dependência nova sem ADR.
- `push` no `main` é publicar: só com o autor autorizando a fase.

### 2.8 Agentes

Ordem do repositório: Codex → Gemini Argon → outros do agy → Claude por último. A sessão
principal coordena, revisa todo diff externo e as capturas, e recusa código ruim ou tela feia.

## 3. Ponto de partida (conferido no código)

| Assunto | O que existe | O que falta |
| --- | --- | --- |
| Tiles | `map.tiles: Record<id, { type, threatActive }>`, só os **de ameaça** (`TILE_TYPE_IDS`: `wolfDen`, `raiderCamp`, `hordeFortress`; cada tipo exige `enemy`). Na visão: `threat.tiles[]` (`id`, `label`, `active`). | Coordenadas, terrenos e névoa: **não existem**. O mapa não é "só interface". |
| Destinos | `map.discovered: string[]` (ids de modelo) e `map.expeditionUnlocks`. Nove modelos em `EXPEDITION_MODEL_IDS`. | Posição de cada destino. |
| Semente | `state.seed` (raiz do estado) e coluna `games.seed`; sorteada no servidor (`randomBytes`). `POST /games` só aceita `seed` com `allowGameSeed` (**só em teste**). | **Não sai no `ViewState`** nem pode ser escolhida em produção. |
| Ano 2 | O feudo continua; `siegeWaveYearFactor` já dá 1/3, 2/3 e 1 (Anos 1, 2, 3+); Primavera da Reconstrução. | O termo `1 + 0,10 × anos anteriores` e `votos` da fórmula (GDD §11.2). |
| Memória da Horda | `horde.lastFormationSeen`; `resetHordeYear` **zera** tudo na virada. | Lembrar o ano anterior pede campo novo. |
| Fim do ano | `endYear` (`yearEnd.ts`): `stats.yearScore`, `yearFeats`, `yearsEnded`; evento `yearEnded` (`score`, `feats`, `siegeResult`); seis Feitos (`feats.ts`); `GET /games/:id/years/:year/chronicle.md`. | Legado (nada na conta). |
| Ranking | Aba Reino (`tabs/Kingdom.tsx`), `GET /v1/stats`, `accounts.ranking_listed` (ADR 0021). | Ranking por Temporada. |
| Partidas | `games.status` `active`/`archived`; índice único `games_one_active_per_account`; `POST /games` com `replaceActive` arquiva a atual. `/v1/stats` assume uma ativa por conta. | Segunda partida ativa. |
| Itens | `ITEM_RARITY_IDS`: quatro raridades; sem Lendário. | Relíquias. |
| Combate | Moral de batalha (`rules.morale.start`, aura do comandante); astúcia por dificuldade (`cunning`: 3/10, 1/2, 4/5); `heroCapture: 'death'`. | Trolls. |
| Ferro | `accumulators` tem `iron`, mas nada o produz de forma contínua. | Taxa contínua (Veio de Ferro). |
| Impostos | **Não existem** como mecânica: só as cartas `kingsTax` e `kingsCollector`. | Leitura do "Selo do Rei Antigo" (D-10). |
| Ritmo | Padrão 3× ("um ano em 56 horas"); 1× é 168 h. | Ritmo da Temporada (D-16). |
| `CLAUDE.md` | 258 linhas, **55 KB**; ainda diz estado 38 e protocolo 3. | Enxugar e corrigir (V5A-T1). |

## 4. Decisões do autor

Responder em um lote antes da Fase B. **Sem resposta, a fase que depende dela não começa**
(regra 7 do `CLAUDE.md`), salvo se o autor aprovar "vale a recomendada" na D-1.

> **Respostas do autor (2026-11-17):** a **D-1 está aprovada** (regime rápido e "sem resposta
> vale a recomendada"), e **as decisões D-2 a D-31 valem com a recomendação** da tabela. Mudar
> alguma depois é mudança de regra: conteúdo, golden e GDD no mesmo commit. Registrado no
> [ADR 0022](decisions/0022-regras-da-v0.5.md) e em [pendencias-v0.5.md](pendencias-v0.5.md)
> (V5A-T3).

| # | Pergunta | Recomendação |
| --- | --- | --- |
| D-1 | Regime rápido (§2) e "sem resposta vale a recomendada". | Aprovar os dois. |
| D-2 | Ordem das fases. | **Capela → Ano 2 → Sementes e Legado → Mapa → Postos → Temporadas.** No ritmo padrão quem começou na v0.4 chega ao Ano 2 em 56 h: é o que falta primeiro. O mapa é a fase mais cara e nada antes depende dele. |
| D-3 | Agente dá `push` em branch `v5-*` e abre PR rascunho (não publica)? | Sim. `push` no `main` continua só com autorização por fase. |
| D-4 | **Uma versão do estado por fase publicada**, em vez de uma por tarefa. | Sim: forma intermediária nunca chega à produção; retratos só no fechamento da fase. |
| D-5 | Relíquias: as oito do GDD; espaços = nível da Capela (até 3). | Aprovar. |
| D-6 | De onde vêm as relíquias. | Duas **expedições lendárias em modelos novos** (não variante nova: muda o ciclo de variantes de quem já joga), relíquia certa no Sucesso, em ordem fixa, sem sorteio; `whiteWolfHunt` dá o Osso de Lobo (GDD, Apêndice B); o Santuário entra com o mapa. |
| D-7 | Expedição lendária já no Ano 1? (GDD: "Ano 2+") | Sim, pedindo Capela e Guilda Nv4: a relíquia chega antes do primeiro Cerco. |
| D-8 | Trocar relíquia de lugar. | Livre, mas **vale na próxima virada de dia**: trocar por estação vira decisão, sem truque de minuto. |
| D-9 | Relíquias com contrapartida (GDD §17.2, em aberto)? | Não na v0.5. |
| D-10 | "Selo do Rei Antigo (impostos −50%)": não há impostos. | Metade do ouro pedido pelas cartas da Coroa (`kingsTax`, `kingsCollector`). |
| D-11 | Termo "+10 × relíquias de moral" (GDD §5.7): nenhuma das oito é de moral. | Tirar o termo do GDD; a Capela já dá +5. |
| D-12 | Plantas (blueprints, GDD §9.2). | Fora da v0.5. |
| D-13 | Ano N: `1 + 0,10 × anos anteriores` sobre o fator que já existe. | Aprovar (Ano 2 = 2/3 × 11/10). |
| D-14 | Memória entre anos (GDD §17.2: 50%). | 50%, só no primeiro plano de ondas do ano. |
| D-15 | Inimigo novo. | Só **Trolls**; Necromante na v0.6. |
| D-16 | Votos: quais. | **Quatro**: Sem muralhas, Horda astuta, Comida escassa, Heróis mortais. "Inverno longo" mexe no calendário (base do Cerco e da Vigília): v0.6. Voto que a dificuldade já impõe (astúcia e morte em Rei de Ferro) não é oferecido. |
| D-17 | Votos: quando. | Do fim do Cerco até **24 h reais** depois da virada do ano (um dia de jogo são 40 min no ritmo 3×). Sem resposta, nenhum Voto. Também na criação de uma partida nova. |
| D-18 | Legado na v0.5. | **Mínimo**: pontos na conta (pontuação + Feitos, × Votos), à vista na aba Reino. Único gasto: o cenário **Serra do Ferro**, depois do mapa. Votos são livres ("Votos mais fortes" não é do GDD). Classes, unidades e estilos de Crônica: v0.6. |
| D-19 | Semente escolhida em produção e visível. | Sim (GDD §11.5). Quem lê o código pode prever sorteios: aceito na partida pessoal. |
| D-20 | Mapa: SVG à mão, aba "Mapa", raio 3 → 5; árvore e listas continuam. | Aprovar. |
| D-21 | Névoa: GDD §8.1 diz quatro estados, §16.2 diz três. | Quatro; corrigir o §16.2. |
| D-22 | Partidas em andamento ganham o mapa? | Sim: a grade sai de `state.seed` por conta, sem sorteio; o que já foi descoberto fica Explorado. |
| D-23 | Posto Avançado: custo do GDD (250 madeira, 150 pedra, 100 ouro, 45 min), até 3, Salão Nv5. | Aprovar; obra com prazo próprio, fora da fila de obras. |
| D-24 | Posto atacado. | Sem sorteio: a incursão que **rompe** a defesa danifica o posto mais distante; reparo em madeira e pedra. Sem guarnição. |
| D-25 | Temporada e partida pessoal. | Duas ativas: a pessoal e uma da Temporada, com seletor. A da Temporada é arquivada ao fechar o ranking. |
| D-26 | Temporada: ritmo, dificuldade, fuso. | **3×, Senhor**, iguais para todos; segunda 00:00 de Brasília, mostrado na tela. Quem entra até terça fecha o ano até sexta; ranking publicado no domingo 23:59. |
| D-27 | Semente da Temporada. | Escondida até o ranking fechar (evita prever a prova). |
| D-28 | Ranking da Temporada e leitura de Crônicas. | Pontuação do Ano 1; nome do feudo, com a saída do ADR 0021. Ler só a Crônica do Ano fechada de quem está listado. |
| D-29 | Moderar nomes de feudo (GDD §17.2). | Não na v0.5; registrar na pendência da política de privacidade. |
| D-30 | Conteúdo narrativo. | Agente escreve; autor lê por amostra em cada publicação. |
| D-31 | Ideias da §8. | Escolher quais entram. |

## 5. Contratos transversais

### 5.1 Versões do estado (com a D-4)

| Fase | Versão | Forma nova (nomes propostos) |
| --- | --- | --- |
| B | 43 | `buildings.chapel`; `settlement.relics`. |
| C | 44 | `vows`; `horde.previousYearFormation`. |
| D | — | Nenhuma (visão, servidor e dado novo em `yearEnded`). |
| E | 45 | `map.hexes`, `map.radius`. |
| F | 46 | `map.outposts`; `ids.outpost`. |
| G | — | Nenhuma (tabelas do servidor). |

Sem a D-4: uma versão por tarefa, na mesma ordem. Receita: README do motor, "Uma mecânica que
muda o estado sobe a versão". O passo não importa `@lotg/content`, não sorteia e não emite evento.

### 5.2 Regras que evitam retrabalho

- **Sorteio novo só onde algo novo pode acontecer** (sem Capela, sem posto, Ano 1): os goldens
  e a matriz do Ano 1 ficam como estão. Golden do Ano 1 que muda é defeito.
- **Protocolo continua 4**: tudo entra por adição. Não criar `kind` novo em `pendingDecisions`
  (sobe o protocolo): Votos e ofertas saem em campos próprios da visão.
- Ids novos publicados entram nos testes de ids do conteúdo no mesmo commit.
- Toda mecânica: dados em `content`, recusa legível, evento na Crônica, explicação na visão, teste.
- Prazo novo que muda a tela ao vencer entra em `nextPollMs` (`game/gameSession.ts`).
- e2e novos a partir de `17-…` (01 a 16 existem).

## 6. Fases e tarefas

Tamanho: **P** (sessão curta), **M** (uma sessão), **G** (duas ou mais). Commits `V5B-T1: …`.
Fechamento de toda fase que publica: §2.5.

### Fase A — Terreno (P)

| Tarefa | Arquivos | Pronto quando |
| --- | --- | --- |
| **V5A-T1** `CLAUDE.md` enxuto (P) | `CLAUDE.md`, novo `docs/historico.md` | Abaixo de ~20 KB; estado 42 e protocolo 4; regra 6 reescrita para a v0.5; toda regra de "Regras de arquitetura", "Motor", "Servidor", "Cliente" e "Nunca" conferida item a item; regime da §2 no lugar do ritual antigo. |
| **V5A-T2** Portão rápido (P) | `package.json`, `.github/workflows/ci.yml`, `docs/roadmap-v0.5.md` | Scripts da §2.4 existem; lista dos pesados medida e escrita; `verify:fast` < 10 min local (medir); PR rascunho roda a CI sem `deploy`; `pnpm verify` continua completo. |
| **V5A-T3** Decisões (P) | novo `docs/decisions/0022-regras-da-v0.5.md`, novo `docs/pendencias-v0.5.md`, `GAME_DESIGN.md` | Respostas da §4 registradas; GDD corrigido onde a resposta muda regra (D-11, D-21). |

### Fase B — Capela e relíquias (M) · estado 43 · publica

| Tarefa | Arquivos principais | Estado, ordens, visão (propostas) | Testes | Pronto quando |
| --- | --- | --- | --- | --- |
| **V5B-T1** Capela (M) | `content`: `ids.ts`, `buildings.ts`, `balance.ts`, `schemas.ts`; `engine`: `construction.ts`, `morale.ts`, `outcomes.ts`, `migrations/v43.ts` | `buildings.chapel` (Salão Nv5; 200 madeira, 300 pedra, 200 ouro; até Nv3). +5 de moral (termo com explicação). Cura 25% mais rápida: fator aplicado **quando o ferimento é marcado** (`injury.untilMs`), sem recontar os em curso. | `construction`, `morale`, `outcomes`, `migrations`, `fixtures` | Capela erguida muda a moral e o prazo de um ferimento novo; partida v42 migra. |
| **V5B-T2** Relíquias (M) | `content`: novo `relics.ts`, `chronicle.ts`; `engine`: novos `relics.ts`, `relicOrders.ts`, `relicsView.ts`; pontos de efeito em `economy.ts`, `storage.ts`, `cold.ts`, `expeditionOrders.ts`, `battle.ts`, `raidArmy.ts`, omens, cartas da Coroa; `protocol`: `commands.ts`, `view.ts` | `settlement.relics: { defId, placed, effectiveFromMs }[]`. Ordens `placeRelic`/`removeRelic { relicId }`. Recusas `CHAPEL_REQUIRED`, `RELIC_NOT_FOUND`, `NO_RELIC_SLOT`. Eventos `relicFound`, `relicPlaced`, `relicRemoved`. Visão `relics { slots, items[] }` com o texto do efeito e o motivo do bloqueio. | novo `relics.test.ts`: **um teste por efeito**, com e sem a relíquia; `commands`; `protocol` | Os oito efeitos medidos; o termo aparece na explicação de cada conta; sem relíquia, nenhum golden muda. |
| **V5B-T3** Expedições lendárias (M) | `content`: `ids.ts`, `expeditions.ts`; `engine`: `expeditionTurn.ts`, `expeditionReport.ts` | Dois modelos novos (ids a propor), três variantes cada; recompensa `relic` no último nó com prova, **sem sorteio** (a próxima da lista do modelo que o feudo não tem). `whiteWolfHunt` passa a dar o Osso de Lobo (conferir a recompensa atual). | `expeditions.catalog`, `expeditions.calibration` (golden cresce), `content/expeditions` (ids) | Sucesso entrega a relíquia; névoa da expedição intacta; goldens antigos sem diff além das linhas novas. |
| **V5B-T4** Tela (M) | `web`: novo `components/RelicsPanel.tsx`, `tabs/Guild.tsx`, `ui/treeModel.ts`, `palette/commands.ts`, `app/controller.ts`, `game/returnReport.ts` | Comandos `lords.placeRelic`, `lords.removeRelic` pelo molde de `guildOrder` (trava `relic:<id>`). | teste do painel com `preact-render-to-string`; `bundle`; `17-capela.spec.ts` | Colocar e retirar pela tela, pela árvore e pela paleta; "vale a partir de…" à vista. |

### Fase C — O Ano 2 de outro jeito (M/G) · estado 44 · publica

| Tarefa | Arquivos principais | Estado, ordens, visão (propostas) | Testes | Pronto quando |
| --- | --- | --- | --- | --- |
| **V5C-T1** Escala e memória (M) | `content/horde.ts`; `engine`: `hordePlan.ts`, `hordeTurn.ts`, `migrations/v44.ts` | Fator `1 + 0,10 × (ano − 1)` depois do fator do ano. `horde.previousYearFormation` gravada em `resetHordeYear`, com o peso da D-14. | `hordeMind`, `siege.waves`, `siege.year-boundary` | Ano 1 idêntico (golden do Cerco sem diff); Ano 2 em Senhor com os números escritos no teste. |
| **V5C-T2** Trolls (M) | `content`: `ids.ts` (unidades inimigas), `enemies.ts`, `horde.ts`, `omens.ts`; `engine`: `battle.ts`, `warCouncil.ts` | Unidade `troll` (lenta, muita vida, fraca contra lanceiros) na mistura das ondas **só do Ano 2 em diante**; presságio próprio. | `battle`, `warCouncil` (prévia = batalha), `content/enemies`, `content/omens` | Prévia e batalha iguais com Trolls; nenhum Troll no Ano 1. |
| **V5C-T3** Votos (M) | `content`: novo `vows.ts`; `engine`: novos `vows.ts`, `vowOrders.ts`, `vowsView.ts`; efeitos em `economy.ts`, `wall.ts`/`battle.ts`, `hordeMind.ts`, `outcomes.ts`, `yearEnd.ts`; `protocol` | `vows: { year, taken: VowId[], closesAtMs }`. Ordem `takeVows { vows }`, uma vez por ano, na janela da D-17 (tempo real, por `realToGameMs`; o fim é instante de `nextEventAt`). Recusas `VOWS_CLOSED`, `VOW_UNAVAILABLE`. `yearEnded` ganha `vows` e `legacy` (**opcionais** no schema: eventos antigos não têm). Visão `vows { offer[], taken[], closesInSeconds }`. | novo `vows.test.ts`: um teste por Voto e o bônus; `yearEnd`; `advance` (ordem do instante) | Cada Voto muda só o que diz; pontos de Legado do ano saem no evento; sem Votos, `yearEnded` igual ao de hoje. |
| **V5C-T4** Tela (M) | `web`: novo `components/VowsPanel.tsx`, `components/YearChronicle.tsx`, `tabs/Today.tsx`, `game/beforeLeaving.ts`, `palette/commands.ts` | `lords.takeVows`, conferência em duas etapas (escolha irreversível no ano). | teste do painel; `18-ano-2.spec.ts` (servidor de teste adianta o relógio até a virada) | Escolha dos Votos aparece no rescaldo e em "Você ainda pode decidir"; Trolls na prévia. |

### Fase D — Sementes e Legado (P/M) · sem versão de estado · publica

| Tarefa | Arquivos principais | Entrega | Testes | Pronto quando |
| --- | --- | --- | --- | --- |
| **V5D-T1** Semente visível e escolhida (P) | `engine/view.ts`, `protocol/view.ts` e `api.ts`, `server`: `config.ts`, `games/service.ts`; `web`: `tabs/Settings.tsx`, `components/Welcome.tsx`, `app/router.ts` | `seed` na visão; `POST /games` aceita `seed` em produção (validada como hoje); "Nova partida com esta semente" e link `#/nova?seed=…` (proposta). | `view`, integração `games`, um e2e | Duas partidas com a mesma semente e ritmo: mesmas cartas elegíveis e mesma Horda base (teste de motor). |
| **V5D-T2** Legado na conta (M) | `server`: `db/schema.ts` (tabela `legacy_ledger`, proposta: `account_id`, `game_id`, `year`, `points`, único por partida e ano), `games/repository.ts` (`persistState` credita ao gravar `yearEnded`), `stats/service.ts`, `routes/stats.ts`; `deploy/migrations` via `db:generate`; `client-sdk`; `web/tabs/Kingdom.tsx` | O motor calcula; o servidor **só soma**. Crédito na mesma transação do evento, idempotente pelo índice único. Total na resposta de `/v1/stats` (bloco do jogador). | integração `stats`/`legacy`; `kingdom.test.tsx` | Fechar um ano credita uma vez; reenvio e job de avanço não duplicam; conta excluída some no expurgo. |

### Fase E — O mapa (G) · estado 45 · publica

| Tarefa | Arquivos principais | Estado e visão (propostas) | Testes | Pronto quando |
| --- | --- | --- | --- | --- |
| **V5E-T1** Grade no motor (G) | `content`: `ids.ts` (`TERRAIN_IDS`: floresta, colinas, campos, lago, pântano, ruínas, veio de ferro, santuário), novo `map.ts`; `engine`: novos `hexmap.ts` (geração e vizinhança), `mapView.ts`; `state.ts`, `hash.ts`, `migrations/v45.ts`; `protocol/view.ts` | `map.hexes: Record<"q,r", { terrain, fog, site? }>` com os 91 hexágonos do raio 5; `map.radius`. `site` aponta para a chave de `map.tiles` ou para um modelo de expedição. **Geração por conta sobre `state.seed`** (`hash.ts`), nunca pelo gerador: vale na criação e na migração. `map.tiles` e `tileTypes` não mudam. Fortaleza na borda norte. Visão `map.hexes[]`: Desconhecido só com coordenada; Avistado com o tipo; Explorado com detalhes e ações. | novo `hexmap.test.ts`: mesma semente → mesmo mapa; v42 migrada = partida nova da mesma semente (grade); **névoa** (duas partidas que diferem só no Desconhecido dão a mesma visão); `fixtures`, `migrations` | O passo de migração traz o gerador **congelado** no arquivo e um teste o compara ao do motor. |
| **V5E-T2** Revelação (M) | `engine`: `construction.ts` (Torre), `expeditionTurn.ts`, novo `mapTurn.ts`; `content/chronicle.ts` | A névoa **só avança** e é gravada (a Queda derruba a Torre, não o que já se viu). Torre concluída avista um anel; Patrulha explora o vizinho mais próximo (ordem fixa, **sem sorteio**); expedição explora o hexágono do destino; Rastreador, um a mais. Evento `mapRevealed`. | `hexmap`, `expeditions` (ordem dos sorteios do nó **inalterada**) | Goldens de expedição sem diff de sorteio; névoa nunca regride (propriedade). |
| **V5E-T3** Aba Mapa (G) | `web`: novos `tabs/Map.tsx`, `components/HexMap.tsx`, `ui/hexmap.ts` (axial → pontos do SVG), `workbench/hexNav.ts`; `app/router.ts` (`#/mapa`), `theme/themes.css`, `ui/treeModel.ts` | SVG com atributos (sem `style`), cor por classe e variável de tema, ícones Codicons, foco único com setas, ficha do hexágono ao lado com as ações que **já existem** (`lords.sendExpedition`, campanha, sabotagem). | `ui/hexmap.test.ts`; contraste nos três temas; `19-mapa.spec.ts` (teclado, ação pelo mapa, largura de celular) | Capturas dos três temas e do celular aprovadas pela sessão principal; `pnpm capture:landing` refeito. |
| **V5E-T4** Santuário e Serra do Ferro (P) | `content/map.ts`, `relics.ts`; `server/games/service.ts`; `web/components/Welcome.tsx` | Santuário explorado entrega uma relíquia (uma vez). Cenário `ironRidge` (proposta): parâmetros do gerador, escolhido na criação; o servidor confere o Legado da conta (D-18). | `hexmap`, integração `games` | Sem o Legado, a criação recusa com frase legível. |

### Fase F — Postos avançados (M) · estado 46 · publica

| Tarefa | Arquivos principais | Estado, ordens, visão (propostas) | Testes | Pronto quando |
| --- | --- | --- | --- | --- |
| **V5F-T1** Reivindicar e produzir (M) | `content`: `balance.ts` (`outposts`), `map.ts`; `engine`: novos `outposts.ts`, `outpostOrders.ts`; `economy.ts`, `timeline.ts`, `advance.ts`, `ids.ts`, `migrations/v46.ts`; `protocol` | `map.outposts: { id, hex, status: 'building' \| 'active' \| 'damaged', readyAtMs }[]`; id de `nextId(draft, 'outpost')`. Ordem `claimOutpost { hex }` (hexágono Explorado de tipo que produz, Salão Nv5, até 3, custo da D-23). Fim da obra é instante de `nextEventAt`, com lugar escolhido em `processEventsAt`. Veio: 3 ferro/h contínuos (respeita o cap do Armazém); os outros, fator 23/20 em `productionFactors`, com termo na explicação. Recusas `HEX_NOT_EXPLORED`, `OUTPOST_LIMIT`, `NOT_CLAIMABLE`. | novo `outposts.test.ts`; `advance` (instante exato); propriedade de divisão de intervalo com posto | Posto produz (critério do GDD); invariante de `advanceTo` exato com ferro contínuo. |
| **V5F-T2** Posto sob ataque (P) | `engine`: `battleTurn.ts`/`raids.ts`, `outpostOrders.ts` | Regra da D-24; ordem `repairOutpost { outpostId }`; eventos `outpostDamaged`, `outpostRepaired`. | `outposts`, `raids.battle` | Sem posto, nenhuma incursão muda (goldens sem diff). |
| **V5F-T3** Tela (P) | `web`: `components/HexMap.tsx`, `ui/treeModel.ts`, `notifications/policy.ts`, `game/returnReport.ts` | `lords.claimOutpost`, `lords.repairOutpost`; aviso de posto danificado; linha no Relatório de Retorno. | `20-postos.spec.ts` | Reivindicar e reparar pelo mapa e pela paleta. |

### Fase G — Temporadas (G) · sem versão de estado · publica

| Tarefa | Arquivos principais | Entrega (propostas) | Testes | Pronto quando |
| --- | --- | --- | --- | --- |
| **V5G-T1** Temporada no servidor (G) | `server`: `db/schema.ts` (tabela `seasons`; `games.season_id` nulo; o índice único vira dois parciais: pessoal e por Temporada), novo `seasons/service.ts`, `routes/seasons.ts`, `games/service.ts`, `stats/service.ts` (só partidas pessoais), `jobs/` (arquivar ao fechar); `deploy/migrations`; `protocol/api.ts`; `client-sdk` | `GET /v1/seasons/current` **abre a Temporada da semana se faltar** (sob `pg_advisory_lock`; sem agendador novo). `POST /v1/seasons/current/join` cria a partida com a semente, o ritmo e a dificuldade da linha. Sempre `ctx.clock()`. A semente não sai antes do fecho (D-27). | integração `seasons`: abre uma vez com chamadas simultâneas; entrada recusada depois de terça; pessoal e Temporada convivem; `ACTIVE_GAME_EXISTS` continua valendo em cada trilho; exclusão de conta | Critério do GDD: abre na segunda, aceita até terça. |
| **V5G-T2** Ranking e Crônicas (M) | `server`: `seasons/service.ts`, `games/chronicleMarkdown.ts`; `web/tabs/Kingdom.tsx` | `GET /v1/leaderboard?season=`: pontuação do `yearEnded` do Ano 1, resultado do Cerco, Feitos; nome do feudo; respeita `ranking_listed`; publicado no fecho. `GET /v1/seasons/:id/chronicles/:posição` (proposta): só Crônica do Ano fechada, de quem está listado, para quem está na mesma Temporada. | integração `leaderboard`: empate, saída do ranking, nenhum identificador na resposta | Critério do GDD: ranking publicado ao fim da semana. |
| **V5G-T3** Tela (M) | `web`: `app/controller.ts` (partida corrente entre duas), `components/Header.tsx` ou barra de status (seletor), `tabs/Kingdom.tsx`, `tabs/Today.tsx`, cache por partida (`cacheKey` já separa) | Seletor "Meu feudo / Temporada", cartão com contagem regressiva, ranking e leitura de Crônica. Ordem preparada em um feudo não vale no outro (`StaleOrderError` já cobre). | testes do controller; `21-temporada.spec.ts` | Trocar de partida não mistura avisos, cache nem retentativas. |

### Fase H — Fechamento (M)

- **V5H-T1 Bots e matriz.** Os perfis aprendem Capela, relíquias, Votos e postos; matriz
  completa uma vez; `MEASURED` remedida pelo procedimento de `bands.ts`; `docs/balance-v0.5.md`.
- **V5H-T2 Revisão independente só do risco:** migração do mapa, névoa do mapa, Temporada no
  servidor, crédito de Legado.
- **V5H-T3 Entrega:** GDD (versão nova, §16.2), `docs/architecture.md`, READMEs, CHANGELOG,
  roteiro de 15 min para o autor, landing sem "horizonte" vencido. Tag e release são do autor.

## 7. Ordem e dependências

```
A ─► B Capela ─► C Ano 2 ─► D Sementes+Legado ─► E Mapa ─► F Postos ─► G Temporadas ─► H
        (telas e servidor em paralelo; uma trilha de estado por vez)
```

- **Seis publicações** (B a G). B, C e D não dependem do mapa.
- D depende de C (`legacy` no `yearEnded`). F depende de E. E-T4 depende de D-T2 e de B.
- G depende de D (semente escolhida na criação) e ganha com C (Votos na criação).
- Paralelo seguro: V5D-T2 e V5G-T1 (servidor) enquanto a trilha de estado está em C ou E; a
  aba Mapa (V5E-T3) contra um `ViewState` de exemplo assim que a V5E-T1 fixar a visão.

**Cortes se o prazo apertar** (do menos doloroso ao mais): Serra do Ferro (V5E-T4) → leitura da
Crônica alheia (parte da V5G-T2) → posto sob ataque (V5F-T2) → raio 5 (ficar no 3) → memória
entre anos (parte da V5C-T1).

## 8. Ideias de diversão (sugestões; fora do escopo até a D-31)

| # | Ideia | Custo | Por que diverte |
| --- | --- | --- | --- |
| 1 | **Pontuação do ano ao vivo**: a conta de `endYear` exposta na visão ("se o ano fechasse hoje: N pontos; falta M para o próximo Feito"), na aba Hoje e no Reino. | P (motor + visão) | Dá meta à semana inteira, não só ao último dia; é o que o ranking vai comparar. |
| 2 | **"Copiar resultado do ano"**: texto curto para colar em conversa (pontos, Cerco, Feitos, Votos) com o link da semente. | P (app, depois da V5D-T1) | Convite pronto: "tenta fazer melhor na mesma semente". Sem servidor novo. |
| 3 | **Feito "Cartógrafo"** (GDD, Apêndice E) e "N de 37 explorados" na aba Mapa. | P (depois da Fase E) | Explorar ganha fim e recompensa. |
| 4 | **Batizar o posto avançado**: nome dado pelo jogador, usado na Crônica e no mapa. | P (validação `isStorableText` já existe) | Apego: a perda de "Vigia do Corvo" dói mais que a do "posto 2". Atenção: aparece na Crônica que outros leem (D-28, D-29). |
| 5 | **Oferenda no Santuário**: uma vez por ano, uma de três bênçãos fixas para o ano. | M | Mais uma decisão anual com cara própria, ao lado dos Votos. |

## 9. Riscos

| Risco | Redução |
| --- | --- |
| Migração do mapa quebra partidas vivas | Gerador congelado no passo; teste "migrada = nova da mesma semente"; retrato anônimo da produção; backup. |
| Teste focado deixa outro pacote quebrado | Sentinelas (§2.2), `test:changed` antes do `push`, CI inteira no PR, publicação só de SHA verde. |
| Faixas da matriz se mexem no meio da versão | Bots só mudam na Fase H; sorteio novo só onde há mecânica nova (§5.2). |
| Duas partidas ativas quebram suposições do servidor e do app | V5G-T1 lista os pontos (`stats`, `service`, job, expurgo); revisão independente; índices parciais testados. |
| Semente visível permite prever sorteios | Aceito na partida pessoal (D-19); escondida na Temporada (D-27); ranking "por honra". |
| Mapa feio ou pesado no celular | SVG simples, sem animação contínua; capturas revisadas antes de publicar. |
| Publicações frequentes com estado novo | Uma versão por fase (D-4), backup e SHA de retorno em cada uma. |
| `CLAUDE.md` enxuto perde regra | Conferência item a item na V5A-T1; a história vai para `docs/historico.md`, não some. |

## 10. Fora da v0.5

Academia, Feitos completos, som, auditoria de acessibilidade, inglês (v0.6); Necromante, o Voto
"Inverno longo", plantas, classes, unidades e estilos de Crônica pelo Legado, os cenários Vale
das Brumas e Costa Salgada, guarnição de posto, Caçada ao Dragão (v0.6, por D-12, D-15, D-16,
D-18); qualquer interação entre feudos além do ranking e da leitura de Crônicas (v1.0).

## 11. Registro de execução

Uma linha por tarefa: o que foi verificado **e o que não foi**.

| Tarefa | Data | Commit | Agente | Verificado / não verificado |
| --- | --- | --- | --- | --- |
| V5A-T1 | 2026-11-17 | `79565c13` | Codex | CLAUDE reduzido de 55.591 para 19.974 bytes; 122 itens conferidos e histórico preservado em `docs/historico.md`. Estado 42, protocolo 4, versões 0.4.0 e publicação conferidos no código/CHANGELOG; referências locais e `pnpm typecheck` (Node 22) passaram. Prettier passou, mas `.md` é ignorado pela configuração do projeto. Não rodados verify, matriz, integração/e2e, CI ou capturas (só documentação/regime rápido); sem consulta à produção, aprovação humana, push ou publicação. |
| V5A-T2 | 2026-11-17 | `2103e6a3` | Codex | Unit completo medido uma vez: 1631,62 s; 249/250 arquivos passaram, falha da Paliçada registrada na §2.4. `nice -n 19 pnpm verify:fast`: **229,77 s (3 min 49,77 s)**, lint, tipos e 246 arquivos passaram; meta < 10 min atendida. `nice -n 19 pnpm test:guards`: **1094,15 s (18 min 14,15 s)**, 12 arquivos e 14.246 testes passaram; mantém `migrations` pesado. Partição por `vitest list --filesOnly --json`: 246 + 4 = 250, sem ausentes, extras ou interseção; 12 sentinelas exatas; `test:changed` listou 0 arquivos neste diff. YAML e diff do CI conferidos em 10 cenários locais, incluindo exclusão e mudança de pasta; demais jobs e gatilhos preservados. `test` e `verify` mantêm os comandos originais. Prettier nos arquivos tocados passou (Markdown ignorado pela configuração). Não rodados: `pnpm verify`, matriz em separado, integração/e2e completos e CI remota/PR/deploy, conforme regime rápido e pedido de não fazer push. `CLAUDE.md` e código de jogo intactos. **Revisão (Claude):** `migrations` saiu das sentinelas (`test:guards` 18 min → **6,6 s**, 11 arquivos, 876 testes); a falha da Paliçada era do teste (a Queda do Cerco baixa a Paliçada; a asserção exigia igualdade) e foi corrigida para "nunca sobe"; a semente `-863285096` passa. |
| V5A-T3 | 2026-11-17 | `cd416f0b` | Gemini Argon | **Revisão (Claude):** SHA da v0.4.0 corrigido para `333df054` e "multiplicado pela dificuldade" (inventado) tirado do Legado no GDD. **Verificado:** `docs/decisions/0022-regras-da-v0.5.md` criado (D-1 a D-31) e listado em `docs/decisions/README.md`; `docs/pendencias-v0.5.md` criado (D-31, D-29, F-5, G-23, G-25, ato 23, playtest e ADR 0012); `GAME_DESIGN.md` corrigido onde as decisões mudam regra ou fecham questão em aberto (§5.7, §9.2, §9.3, §11.5, §11.6, §16.2, §17.2 e Apêndice D); `prettier --check` nos cinco arquivos tocados. **Não verificado:** suítes de testes, `typecheck`, `eslint`, build e e2e (mudança restrita a documentação). |
| V5B-T1 | 2026-11-18 | `6b4e300e` | Codex | Capela (Salão Nv5, custo 200/300/200, 30 min, até Nv3), termo +5 de moral e cura de heróis ×3/4 ao marcar; forma/guarda/passo 42→43 e retratos novos, v42 congelada. `pnpm typecheck`, foco (389 testes/9 arquivos), fixtures (65 testes), `test:guards` (878 testes/11 arquivos, 4,70 s), migrations (13.818 testes, 1.076,37 s), Prettier e ESLint passaram em Node 22. Goldens e retratos antigos sem alteração; a visão compara o contrato anterior por projeção da adição da Capela. Primeira execução longa interrompida para corrigir projeções históricas; execução completa final verde. Não rodados verify, matriz, integração/e2e completos, CI remota ou capturas; sem push/publicação. |
| V5B-T2 | 2026-11-18 | `45f429d8` | Codex | Oito ids fixos e efeitos medidos com/sem relíquia; concessão interna sem ordem de jogador; ordens/recusas/Crônica; ativação na virada seguinte, retirada imediata, espaços e visão em segundos reais. A mesma v43 recebe `relics: []`: 64 retratos ajustados só com o campo vazio e um novo ativo/pendente/guardado; v42/anteriores e todos os goldens intactos. Protocolo 4 aditivo, igualdade de tipos e leitura de visão antiga com bloco vazio. `pnpm typecheck`, foco (346 testes/7 arquivos, incluindo fixtures), efeitos/previsões finais (97 aprovados e 1 falha esperada já existente), `test:guards` (879 testes/11 arquivos, 5,46 s), migrations (13.825 testes, 1.184,80 s), Prettier e ESLint passaram em Node 22. `test:changed` rodou **uma vez** (233 arquivos; inicialmente 453 falhas em 39 arquivos): corrigidos contratos históricos, compatibilidade das visões antigas, coluna/hash do simulador, colisão do id público chapel com chave de nó e adoção acidental da Capela pelas políticas genéricas; os **39 arquivos foram revalidados: 1.360 testes passaram**. Bots seguem sem política da mecânica até H; sem recalibrar faixas. Não rodados verify, matriz, integração/e2e completos, CI remota ou capturas; sem fonte de relíquia (T3), tela (T4), push ou publicação. |
| V5B-T3 | 2026-11-18 | `cb94eec9` | Codex | Dois modelos novos (`ancestralVault`, `hermitsRefuge`), três variantes cada e ids em `STABLE_IDS`; abertos no Ano 1 com Capela e Guilda Nv4, recusas e requisitos na visão. Última prova concede via `grantRelic` a primeira ausente da lista fixa; lista completa rende 100 de ouro de consolo, sem sorteio nem cobiça. `whiteWolfHunt` já era expedição aberta por carta: Osso de Lobo no nó da fera, pele ainda paga por `forestReturns`. `relicFound`, notas/resumo do relatório, listas disjuntas, equipes simultâneas, divisão de intervalo e visão inteira igual ao mudar só o outro lado da encruzilhada conferidos. Forma v43 e protocolo 4 preservados; achado usa `log.found`. Catálogo/textos agora entram no hash; apresentação lista os onze destinos. `pnpm typecheck`, foco com `nice -n 19`/`--maxWorkers=2` (1.178 testes/13 arquivos), catálogo/lendárias finais (458 testes/2 arquivos, 45 de lendárias), `test:guards` (935 testes/11 arquivos, 5,02 s), Prettier e ESLint passaram em Node 22. `UPDATE_GOLDEN=1` só nos dois arquivos da tarefa, em comandos separados: calibragem +46 linhas e catálogo +192, zero removidas; nove entradas antigas idênticas, relato integral do Osso aditivo, demais goldens/fixtures intactos. Não rodados verify, matriz, migrações completas (sem forma nova), integração/e2e, CI remota ou capturas; sem aceite narrativo humano, push ou publicação. `packages/web/**`, `tests/e2e/**`, main e outros worktrees intactos. |
| V5B-T4 | 2026-11-18 | `c8444f37` | Gemini Argon (revisão: Claude) | **Verificado:** `RelicsPanel.tsx` na aba da Guilda (ao lado do Arsenal, como espólio permanente de expedições e sem sobrecarregar a aba do Feudo) e helpers em `ui/relics.ts`; comandos `lords.placeRelic` e `lords.removeRelic` pelo molde de `guildOrder` (intenção e trava `relic:<id>`, releitura da visão após diálogo na paleta, `rowActions` Colocar/Retirar na árvore); Relatório de Retorno (`returnReport.ts`) citando `relicFound` e relíquia que passou a valer; prazo `effectiveInSeconds` em `guildDeadlines` (`nextPollMs`); rota `/__test/relic` (via `grantRelic` do motor) em `tests/e2e/server.ts`, `world.relic`/`world.raise('chapel')` em `tests/e2e/helpers.ts` e `tests/e2e/17-capela.spec.ts` (1 teste e2e aprovado, com capturas nos 3 temas salvas e revisadas em `/tmp/claude-1000/v5b-t4-capturas/`); `pnpm typecheck`, `relics.test.tsx` (6 testes com `preact-render-to-string`), foco web (7 arquivos/363 testes incluindo `bundle.test.ts`), `test:guards` (11 arquivos/879 testes), Prettier e ESLint nos arquivos tocados. Nenhum arquivo de `packages/content`, `packages/engine` ou `packages/protocol` tocado. **Não verificado:** `pnpm verify`, matriz, suíte de integração completa, suíte de e2e completa, CI remota, push e publicação. |
| V5B-CI | 2026-11-18 | `c1529197` (integração), `f8d39bdd` (teclado), este commit (bots) | Codex | **Causas/correções:** expectativas históricas sem `chapel: 0`/`relics: []` e catálogos sem as lendárias trancadas; percurso de teclado parava aos 60 Tabs antes da barra de status (limite 80, mesmas exigências de foco); Ousado contava as lendárias como caminhos descobertos e pulava a Patrulha. As duas políticas de envio ignoram `ancestralVault`/`hermitsRefuge` na seleção e na contagem até H, com oito regressões comparando as mesmas ordens da visão anterior, com/sem descoberta e lendárias abertas/trancadas. Motor, servidor, regras, faixas, goldens e retratos intactos. **Verificado (Node 22):** integração com `TEST_DATABASE_URL=postgres://lotg:lotg@localhost:5433/lotg_test`, um arquivo por vez e filtro sem `--`: `games-migration` 106, `expeditions` 7, `outcomes` 5 e `palisade` 9 aprovados; `pnpm test:e2e 05-teclado` 11 e `pnpm test:e2e 17-capela` 1 aprovado, após integração e separados; Vitest unit com `nice -n 19`/`--maxWorkers=2`: `bots` 229 testes/10 arquivos e `matrix.test.ts` 24 testes (139,17 s); `pnpm typecheck`, Prettier/ESLint nos tocados e `nice -n 19 pnpm verify:fast` (252 s: lint, tipos, 253 arquivos, 7.529 aprovados e 1 falha esperada já existente). **Não verificado:** integração/e2e completos, demais pesados de `test:matrix`, CI remota ou capturas manuais; sem push/publicação. |
| V5C-T1 | 2026-11-19 | `5737b808` | Codex | **Verificado:** escala racional com pisos ano → crescimento → dificuldade; Senhor Ano 2 = 28/44/58 + chefe (59 na terceira); memória anterior com 50% só no primeiro plano, corrente com peso inteiro; passo/guarda 43→44, 65 retratos v43 congelados por impressão digital e 66 retratos v44 (incluindo memória anterior). Tipos, foco de Horda/Cerco e projeções históricas (222 testes/19 arquivos), passo/guarda (3 testes), fixtures, sentinelas (936 testes/11 arquivos, 8,64 s), migrações completas (14.287 testes, 1.377,92 s), integrações games-migration (106) e siege (8), Prettier e ESLint passaram em Node 22. Goldens intactos; nos retratos correspondentes do Ano 1, só versão e campo novo; peasant-3x já está no Ano 3 e seu Cerco do Ano 2 passa de 18/28/38 para 19/30/41. Uma execução filtrada de migrações foi interrompida para dar lugar à execução completa. **Não verificado:** test:changed, matriz e verify:fast (reservados ao fechamento das três tarefas), e2e, CI remota, capturas e publicação. Sem push ou alteração de main/outros worktrees. |
| V5C-T2 | 2026-11-19 | `0bcb04bd` | Codex | **Verificado:** id troll acrescentado ao fim da lista publicada; 12 ataque, 4 defesa, 120 vida, iniciativa 1, dano de Lanceiros ×3/2; mistura da segunda onda só no Ano 2+ (40/15/25/20), presságio próprio, prévia conhecida igual à batalha real e amostra pela mistura pública, sem memória oculta. Hash público passa a incluir atributos inimigos. Estado 44 compartilhado: guarda/releitura de Troll e presságio, sem alterar guardas antigas. Tipos, foco (382 testes/27 arquivos), guarda/Trolls finais (10/2), hash (2), fixtures (68 testes), sentinelas (937/11, 9,96 s), migrações completas (14.294 testes, 1.290,68 s), Prettier e ESLint passaram em Node 22. UPDATE_GOLDEN=1 só em fixtures.test.ts: retrato novo trolls; único retrato existente alterado, peasant-3x, troca dois tipos na segunda onda do Ano 2, sem mudar contagens. Ano 1, todos os goldens e retratos v43/anteriores intactos; bots sem política nova. **Não verificado:** matriz, test:changed e verify:fast (no fechamento de T3), integração/e2e completos, CI remota e capturas; sem aceite narrativo humano, push ou publicação. |
| V5C-T3 | 2026-11-19 | `edbc214b` | Codex + Gemini Argon | **Verificado:** quatro Votos (`noWalls`, `cunningHorde`, `scarceFood`, `mortalHeroes`) com oferta filtrada por dificuldade (exclui `cunningHorde` e `mortalHeroes` em Rei de Ferro), janela de 24 h reais (`realToGameMs`) na criação e do fim do Cerco até 24 h reais após a virada (`nextEventAt`), ordem `takeVows { vows }` única por ano de destino, recusas `VOWS_CLOSED`/`VOW_UNAVAILABLE`, evento `vowsTaken`, efeitos restritos a cada Voto, `yearEnded` com `vows` e `legacy` opcionais (omitidos sem Votos ativos), visão aditiva `vows { offer, taken, closesInSeconds }` no protocolo 4 e antecipação de polling em `GameSession`. Estado 44 completado com `vows` no passo 43→44 e 69 retratos v44 (`vows-active`, `vows-next-year`). `pnpm typecheck`, foco (19 arquivos/478 testes), `test:guards` (11 arquivos/939 testes, 9,34 s), `migrations.test.ts` (14.308 testes, 1.229,84 s), integrações uma a uma (`games-migration` 106, `siege` 9, `chronicleYear` 7, `raids` 17, `threat` 6 após acrescentar `previousYearFormation: null` ao objeto esperado, `palisade` 9, `games-vigil` 2, `formations` 2, `outcomes` 5), `test:changed` (241 arquivos, 7.161 aprovados e 1 falha esperada já existente, 224,21 s), `matrix.test.ts` (24 testes, 169,61 s; desvios restritos à célula `week/3/regular` que atravessa três anos, com o Ano 1 intacto), `verify:fast` (lint, tipos e 258 arquivos/7.578 aprovados e 1 falha esperada, 227,51 s), Prettier e ESLint. Goldens do Ano 1 com diff restrito ao acréscimo de forma (`vows`, `previousYearFormation` e `schemaVersion: 44`). **Não verificado:** demais pesados de `test:matrix` (`balance`, `coverage`), integração/e2e completos, tela de Votos (V5C-T4), CI remota, capturas, push e publicação. **V5C-CI (2026-11-19, este commit):** `pace.test.ts` corrigido para conferir `vows.taken`, `vows.closesInSeconds` (prazo real de 24 h, D-17) e `vows.offer` em `expectSameWorld` com o resto da visão e todos os eventos idênticos entre 1× e 3×; verificados em Node 22 `pnpm typecheck`, `test:guards` (11/939, 4,86 s), integrações `pace` (33/33, 4,72 s) e `games-migration` (106/106, 6,13 s), `matrix.test.ts` (24/24, 160,36 s), `verify:fast` (lint, tipos, 259 arquivos/7.586 aprovados + 1 falha esperada, 280,93 s), Prettier e ESLint. `balance.test.ts` rodado completo (2.028,95 s, 11 aprovados / 10 falhas) e comparado ao `main` (`642b842e`): **Ano 1 100% idêntico** (4 células `year/3/*` nas 50 sementes de Senhor sem folga; 81 partidas de Ano 1 bit-a-bit iguais ao `main`; `nextVowCloseAt` inócuo em 0,5×/0,7×/1×/3×/7×); todas as 10 falhas ficam exclusivamente nas células multi-ano `week/3/*` (3 anos de jogo), com divergência só a partir do Outono do Ano 2 por V5C-T1/T2 — `bands.ts` e `balance.test.ts` mantidos intactos aguardando decisão sobre `week/3/*`. **Não verificado:** `coverage.test.ts`, `migrations.test.ts` (sem mudança de forma), integração/e2e completos, CI remota e publicação. |
| V5C-T4 | 2026-11-19 | `:/^V5C-T4:` (este commit) | Gemini Argon + Gemini 4 Neon | **Verificado:** novo `VowsPanel.tsx` e helpers `ui/vows.ts` (nome, descrição, bônus de Legado e prazo `"fecha em …"` vindos da visão, seleção livre inclusive nenhum Voto, conferência em duas etapas com aviso de irreversibilidade, uma ação por estado, CSP sem `style="…"` e só `--vscode-*`, ícone próprio `flag` distinto do frio); ordem `lords.takeVows` no molde de `guildOrder` (`prepare`, intenção e trava `vows`, validação da oferta na retentativa, releitura após diálogo na paleta); painel no rescaldo do Cerco (`SiegePanel.tsx`), na aba Hoje enquanto a janela está aberta (e resumo fechado após confirmar), em `"Você ainda pode decidir"` (`beforeLeaving.ts` / `returnReport.ts`, sem duplicação em `"Antes de partir"`) e na aba Exército no ano corrente para os Votos ativos (sem inflar o cabeçalho fixo); `YearChronicle.tsx` exibindo Votos e pontos de Legado de `yearEnded` com preservação de `yearEvents` e `vowLabels` no `Controller` além das 20 linhas da Crônica recente; `WarCouncilPanel.tsx` (`BattlePreview`) e `FormationEditor.tsx` exibindo `knownEnemy` (incluindo `"Troll"` vindo da visão); `closesInSeconds` confirmado em `nextPollMs` (`gameSession.ts`). `pnpm typecheck`, foco web (14 arquivos/593 testes incluindo `vows.test.tsx` com 8 testes em `preact-render-to-string`, `palette.test.ts` e `bundle.test.ts`), suíte web completa (68 arquivos/2.229 testes), `test:guards` (11 arquivos/939 testes, 4,82 s), `nice -n 19 pnpm verify:fast` (lint, tipos, 259 arquivos, 7.586 aprovados e 1 falha esperada já existente, 208,69 s), Prettier e ESLint nos tocados; e2e um de cada vez com `pnpm dev:up`: `18-ano-2` (1 aprovado, 4,3 s, sem rota `/__test` nova, com 6 capturas revisadas nos 3 temas em `/tmp/claude-1000/v5c-t4-capturas`), `17-capela` (1 aprovado, 1,4 s) e `05-teclado` (11 aprovados, 24,9 s). Nenhum arquivo de `content`, `engine`, `protocol`, `server` ou `tests/e2e/server.ts` tocado. **Não verificado:** `pnpm verify` completo, `test:matrix`, suítes de integração e e2e completas, CI remota, aceite humano, push e publicação. |
| V5C (matriz) | 2026-11-19 | este commit | Codex | **Verificado** em Node 22.22.3. Remedição de `week/3/*` com 50 sementes por perfil nas três dificuldades após as mudanças do Ano 2 (D-13/D-14/D-15). As 600 partidas ficaram dentro das faixas, com zero ordens recusadas. O diff de `bands.ts` contra `642b842e` contém nove linhas de `week/3/*`. Os três Preguiçosos repetiram os valores anteriores. A folga de 5% nos tetos e 10% na população foi preservada. [Medição antes e depois](balance-v0.5.md). `balance.test.ts` 21/21 (1.722,09 s), `matrix.test.ts` 24/24 (162,05 s), `coverage.test.ts` 10/10 (188,24 s), `bands.test.ts` 10/10, `pnpm typecheck`, Prettier e ESLint nos tocados. `nice -n 19 pnpm verify:fast` passou em 259 arquivos, com 7.586 testes aprovados e 1 falha esperada (375,34 s no relógio). **Fora da verificação local** ficaram a CI remota e as suítes de migrações, integração e e2e. Commit local em `v5-c`. |
| V5D-T1 | 2026-11-19 | este commit | Gemini 4 Neon | **Verificado:** `seed` opcional por adição em `ViewState` e `ViewStateSchema` (protocolo 4 e estado 44 intactos), `GameSeedSchema` aparado/validado em `CreateGameRequestSchema`; `allowGameSeed` removido de `config.ts` e `POST /games` aceitando `seed` em produção sem expor semente de partidas alheias; no app: semente à vista em Preferências (`Settings.tsx`) com link `#/nova?seed=…` e botão `"Nova partida com esta semente"`, `router.ts` (`formatNewGameHash`/`parseHashTarget`) e `Welcome.tsx` abrindo com a semente preenchida (e em `lords.newGame` com partida ativa). Golden `view-seed-pedra-alta.json` atualizado com `UPDATE_GOLDEN=1` só em `view.test.ts` (+35 linhas de `"seed"`, 0 removidas). Teste de motor em `view.test.ts` provando mesmas cartas elegíveis (`seenThisYear`/`cardDrawn`) e mesma Horda base (`wavePlan`, `scheduledRaids`, `omens`) para mesma semente e ritmo; `pnpm typecheck`, foco (engine `view.test.ts`, protocol `protocol.test.ts` 152, server `config.test.ts` 6, web 6 arquivos/415 testes incluindo `bundle.test.ts`), `test:guards` (11 arquivos/943 testes, 7,05 s), integração `packages/server/test/games.test.ts` (117 testes, 9,81 s, incluindo `NODE_ENV=production` e isolamento de terceiros), e2e `19-semente.spec.ts` (1 aprovado, 1,1 s) e `01-entrada.spec.ts` (`sem conta|só com o teclado`, 2 aprovados), Prettier/ESLint nos tocados e `nice -n 19 pnpm verify:fast` (lint, tipos, 259 arquivos/7.594 aprovados + 1 falha esperada, 240,44 s). Nenhum arquivo da tarefa paralela (`db/**`, `migrations/**`, `stats/**`, `routes/stats.ts`, `Kingdom.tsx`) tocado. **Não verificado:** `pnpm verify` completo, `test:matrix`, suítes completas de integração/e2e, capturas visuais manuais, CI remota, push e publicação. |
