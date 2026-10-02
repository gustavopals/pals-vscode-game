# @lotg/web

O cliente do jogo: um app web com aparência de editor de código (barra de atividades, árvore lateral, abas, barra de status, paleta de comandos e avisos no canto). Decisão e motivos no [ADR 0008](../../docs/decisions/0008-cliente-web-com-aparencia-de-editor.md).

O app **só exibe**. Toda regra e toda conta vêm do servidor, dentro do `ViewState`; importar `@lotg/engine` aqui é barrado pelo lint. Não usa o nome, o logotipo nem nada do Visual Studio Code: só os Codicons (CC BY 4.0), empacotados junto.

## Rodar

```bash
pnpm dev:up && pnpm dev:api    # banco e API em http://localhost:3000
pnpm dev:web                   # http://localhost:5173, com /v1 repassado para a API
```

`LOTG_API_URL` troca o destino do repasse (padrão `http://localhost:3000`). Em produção não há repasse dentro do app: ele e a API ficam na mesma origem, e quem separa `/v1` é o proxy da plataforma ([ADR 0009](../../docs/decisions/0009-implantacao-no-coolify.md)).

```bash
pnpm --filter @lotg/web build   # packages/web/dist, com hash no nome dos arquivos
pnpm docker:build:web           # imagem com o Caddy servindo o dist na porta 80
```

## Testar

```bash
pnpm --filter @lotg/web test                # testes de unidade (sem navegador)
pnpm --filter @lotg/web test -- controller  # só os arquivos com "controller" no nome
pnpm dev:up && pnpm test:e2e                # Chromium de verdade, API de verdade, db_test
pnpm test:e2e 04-conta -g "duas abas"       # um arquivo, um teste
GAME_TIME_SCALE=3 pnpm test:e2e 03-retorno-e-conexao -g "ritmo"   # o ritmo Rápido com o servidor de teste como o da produção
```

Os testes de unidade rodam em Node, sem DOM: funções puras e HTML gerado com `preact-render-to-string`. Tudo o que depende de um navegador (foco, teclado, `localStorage` entre abas, CSP, contraste) é provado em `tests/e2e/`, com o app compilado. `src/test-helpers.ts` tem uma API `/v1` de mentira em memória (`fakeApi`), um controlador pronto (`makeController`) e diálogos respondidos por roteiro (`scriptedDialogs`).

Os testes em navegador rodam com o servidor de teste no ritmo Normal, o dos tempos do GDD. Os cenários "no ritmo da produção" de `tests/e2e/03-retorno-e-conexao.spec.ts` fundam o feudo no ritmo Rápido pelas boas-vindas e rodam com a suíte: conferem que os prazos e as taxas na tela são os que a API entregou e que a obra termina na hora anunciada. `GAME_TIME_SCALE=3` sobe o servidor de teste com o padrão da produção (o Rápido já vem marcado); assim só esses cenários valem, e um servidor de teste que tenha ficado de pé na porta 3100 precisa ser encerrado antes, porque o Playwright reaproveita o que encontra.

O `ViewState` de exemplo dos testes é o golden do motor, importado por caminho relativo (`../../engine/src/__golden__/view-seed-pedra-alta.json`).

`src/bundle.test.ts` compila o app de verdade (em memória, sem gravar `dist`) e confere que o JavaScript servido não leva número nem frase de `@lotg/content`: do conteúdo só entram as listas de identificadores que os schemas do protocolo usam. O que mantém o resto de fora é o descarte de código sem uso do build, e basta um módulo de `@lotg/protocol` que o app carrega ler `balance` em tempo de execução para a tabela inteira ir junto. Conteúdo novo que não pode chegar ao jogador antes da hora (efeitos de cartas, composição de incursões) fica coberto pelo mesmo teste, desde que seja exportado por `@lotg/content`.

## Estrutura

| Pasta | O que tem |
|---|---|
| `src/app/` | `controller.ts`: o estado do app em um lugar só (conta, partida, abas, avisos), sem nada do navegador. `dialogs.ts` e `DialogHost.tsx`: diálogos acessíveis (confirmação, campo com validação, lista de escolha, informação). `router.ts`: abas e `#/feudo` |
| `src/account/` | Conta neste navegador, Código do Reino, vínculo GitHub (*device flow*), lembrete "Proteja seu reino" depois de 48 horas reais (`linkReminder.ts`) |
| `src/game/` | `gameSession.ts`: ciclo de 30 s (2 min em segundo plano), cache para o modo sem conexão (com marca de versão), envio de ordens, Relatório de Retorno. `newGame.ts`: as opções de nova partida (dificuldade e ritmo) como dados, a escolha que vale e as linhas que a tela mostra. `beforeLeaving.ts`: o que preparar antes de sair, em até cinco itens, cada um com o comando que resolve |
| `src/notifications/` | `policy.ts` decide o que avisar (no máximo 3 por hora) e monta o aviso de estação; `Toasts.tsx` desenha; `browserNotifications.ts` é a opção do navegador |
| `src/palette/` | `commands.ts`: todos os comandos, o único lugar que conversa com o jogador por diálogos. `CommandPalette.tsx`: a paleta (`F1` ou `Ctrl+K`) e as listas de escolha, que podem abrir com um item já marcado (`selected`) |
| `src/services/` | `browserStore.ts` (`localStorage` com prefixo `lords.`, tolerante a falha), `sessionLock.ts` (Web Locks na renovação da sessão), `tabSync.ts` (evento `storage`), `visibility.ts`, `preferences.ts` |
| `src/workbench/` | A bancada: `ActivityBar`, `SideBar`, `Tree` (padrão ARIA, `treeNav.ts`), `EditorTabs`, `StatusBar` |
| `src/tabs/` | Conteúdo das abas: Feudo, Hoje, Crônica, Preferências (com a dificuldade e o ritmo do feudo, só para leitura), Sobre |
| `src/components/` | Os painéis do feudo (recursos com os avisos de depósito, trabalhadores com a troca de ofício e a experiência, moral termo a termo, construções com as filas e as planejadas, recrutamento, objetivos), os avisos do painel (`Banners.tsx`: sem ligação, fome com o que ela faz ao povo, frio e a conta da lenha) e as boas-vindas, com os dois grupos de opções de nova partida |
| `src/ui/` | Árvore e barra de status como dados (`treeModel.ts`, `format.ts`); a troca de ofício e a experiência como texto (`workers.ts`); a moral como texto e ícone (`morale.ts`) |
| `src/theme/` | `themes.css`: o **único** arquivo com cores. Os três temas são valores para as variáveis `--vscode-*` que o resto do CSS usa |

## Dificuldade e ritmo (GDD §13.9)

- **As opções vêm do servidor.** `controller.loadCatalog()` lê `GET /v1/catalog` (sem sessão) e guarda `newGame` em `controller.catalog`: rótulos, frases, a marca de recomendado e `defaults`, que é o que vem marcado. O app não escreve rótulo, frase nem número de regra, e marca por `defaults`, não por `recommended` (o servidor de teste roda no ritmo Normal). A resposta é sempre conferida com `CatalogResponseSchema`, também em produção.
- **Só é lido quando a tela usa:** boas-vindas, Preferências e o comando "Nova partida". Quem tem feudo e não passa por aí nunca o pede.
- **Sem catálogo, nada quebra.** Sem ligação, ou com um servidor de uma versão anterior (404), as boas-vindas ficam como na v0.1, "Nova partida" não pergunta nada, e o corpo de `POST /games` vai sem `difficulty` nem `timeScale`: valem os padrões do servidor. Com catálogo, o corpo leva o que a tela mostrava marcado.
- **"Nova partida" espera o catálogo antes do primeiro diálogo, e roda um fluxo por vez.** Nessa espera não há diálogo na tela para barrar um segundo acionamento; o comando tem uma trava (`startingNewGame`, em `palette/commands.ts`) e relê a conta depois da espera. Sem a trava, dois fluxos se intercalavam na fila de diálogos e o segundo feudo fundado arquivava o primeiro.
- **"Jogar agora" continua a um clique.** As opções já vêm marcadas e escolher é opcional; o botão não espera o catálogo. Cada grupo é um `radiogroup` de botões de rádio nativos: uma parada do `Tab`, setas para trocar. O nome de cada opção é a linha curta; a frase é a descrição (`aria-describedby`), sempre à vista.
- **"Nova partida"** pergunta os dois em listas de escolha com o padrão já marcado (`Enter`, `Enter`), antes da confirmação, que repete a escolha ao lado do aviso de que o feudo atual é arquivado.
- **Nas Preferências**, "Dificuldade: … · Ritmo: … (não mudam durante o ano)" vem de `settlement.difficultyLabel` e `settlement.paceLabel` do `ViewState`; a frase do que a dificuldade muda vem do catálogo, pelo `settlement.difficulty`.

## Estações, lenha e frio (GDD §4.1)

Tudo vem pronto no `ViewState`; o app não escreve fator, taxa nem prazo.

- **O que a estação muda** fica à vista no cabeçalho (`calendar.seasonEffects`) e na explicação do item do feudo na árvore. O fator de cada taxa já vem dentro do `breakdown` ("× 1,3 (outono)", "× 0,8 (frio)", "−9/h (lenha de 18 habitantes)"), que a tabela de recursos, o painel de trabalhadores e a árvore mostram como sempre mostraram.
- **A conta da lenha** (`components/Banners.tsx`, `FirewoodNote`) aparece sem ninguém pedir: no outono é `calendar.nextSeason.firewood` (o inverno inteiro, visto de antes: quanto guardar); no inverno é `winter.firewood` (o que falta até a estação virar). Com `missing` maior que zero ganha o destaque de aviso. É `role="note"`, não região viva: os números mudam a cada leitura.
- **No inverno** o cabeçalho e a árvore ganham a linha da Lareira: `winter.firewoodPerHour` e, se a lenha não chega até a primavera, em quanto tempo a madeira acaba.
- **"Acaba em"** passa por `runsOutIn` (`ui/format.ts`). É o `depletesInSeconds` da visão, menos em um caso: a madeira do inverno com `winter.firewood.missing` igual a zero. Aquele prazo é o estoque pela taxa de agora e não olha o calendário; a lareira apaga na virada da estação, e anunciar "acaba em 4 dias" a um dia da primavera seria alarme falso. Se o motor passar a devolver `null` nesse caso, a função vira só um repasse.
- **O frio** (`winter.cold`) tem ícone (`flame`) e texto próprios em todo lugar, para não se confundir com a fome: aviso no painel (`ColdBanner`, nas abas Feudo e Hoje), "· frio" e a Lareira na árvore, e a barra de status (`$(flame) Frio em …`; com fome ao mesmo tempo, `Fome e frio em …`, e a explicação traz os dois textos). O destaque de cor é o mesmo da fome; quem distingue é o ícone e o texto.
- **Avisos** (`notifications/policy.ts`): `coldStarted` e `famineStarted` são alarmes (tom de aviso, passam na frente); `coldEnded` e `famineEnded` são o alívio deles e chegam no mesmo nível "Essenciais", com tom de informação. Com pouco espaço: alarmes, alívios, o resto. O texto é a frase da Crônica que veio no evento.
- **Prazos da estação**: `durationNote` das obras aparece uma vez acima das listas "Melhorar" e "Construir", uma vez na lista da paleta e na explicação de cada obra na árvore; o do recrutamento, ao lado do prazo, no painel e na paleta.
- **A explicação de um número** (`.explained`) fica por cima dos avisos do canto. O aviso de frio ou de fome não some sozinho, e antes cobria a ponta da explicação em telas estreitas.
- Os prazos aproximados ("acaba em 14 h", "Inverno em 4 h", "frio há 50 min") não descem com o relógio local: o cabeçalho, a tabela e a árvore mostram o mesmo número, que muda a cada leitura do servidor.

## Armazenamento: limite, "cheio em" e desperdício (GDD §5.5)

O limite, a previsão, o que se perde e a frase do que fazer vêm prontos em `resources[]` do `ViewState`. O app não conhece capacidade, fator de dificuldade nem regra de corte.

- **Tabela de recursos** (`components/ResourcesTable.tsx`): as colunas Estoque e Cap do GDD §13.3; o limite é um número com explicação (`capExplanation`: "Despensa: 500 iniciais", "Celeiro Nv2: 1.500"). A tendência diz, nesta ordem: "acaba em", "cheio: a produção está se perdendo", "cheio", "cheio em 6 h", "crescendo", "caindo", "em falta", "estável". "Crescendo" sem previsão de encher e "cheio" acima do limite levam a frase do servidor como explicação (`fullNote`).
- **O destaque de "cheio em"** é ícone e texto, abaixo de 8 horas (`FULL_SOON_SECONDS`, em `ui/format.ts`). É escolha de apresentação, não regra: o tamanho de uma ausência comum (GDD §2.3). O prazo já vem em horas de relógio.
- **A saída ao lado** (`StorageNotes`, abaixo da tabela): cada depósito cheio, ou a menos de 8 h de encher, ganha um aviso com a frase, o custo, o prazo e o efeito da obra (`constructions.available[].effect`) e o botão "Construir Celeiro" ou "Ampliar Armazém", que chama `lords.build` com o `storageBuilding` do recurso. A madeira e a pedra dividem o Armazém: um aviso, um botão. Bloqueada, a obra deixa o botão desabilitado, com o motivo; com a obra do depósito em andamento, o botão some. Não é região viva nem `role="note"`.
- **Árvore** (`ui/treeModel.ts`): "655/900 (+55/h)" em cada recurso. Com o depósito cheio e perdendo, ou a menos de 8 h de encher, o alerta toma o lugar da taxa ("655/900 ⚠ cheio em 4 h", "900/900 ⚠ cheio, perde 55/h") e se repete na linha "Recursos". A previsão distante fica só na tabela: a barra lateral é estreita.
- **Construir e melhorar** (`ConstructionsPanel.tsx`): uma obra com `fromLevel` 0 é um edifício que ainda não existe. Ela fica na lista "Construir", o botão diz "Construir" e o nome nunca fala em "Nv0" (`upgradeName`: "Construir: Celeiro" na árvore, na paleta e nas planejadas). As outras ficam em "Melhorar". O que a obra muda aparece abaixo do custo.
- **Cancelar uma obra** diz o que volta e o que se perderia (`refundSentence`, com `refund[].amount` e `lost`), no painel, na árvore e na confirmação.
- **Relatório de Retorno** (`game/returnReport.ts`, `components/Today.tsx`): a tabela abre a conta de cada recurso, `antes + produção − gasto + recebido − perdido = agora`. Gasto, recebido e perdido são somas dos totais que os eventos trazem em `data` (`spent_*`, `gained_*`, `wasted_*`). O perdido soma os fechos diários (`storageWasted`) e a diferença do contador `wastedToday` entre a visão guardada e a de agora, e por isso aparece mesmo sem virada de dia na ausência. A coluna Produção mostra o que o feudo rendeu, descontado o consumo: `produced` (o que entrou no estoque, como o protocolo define) mais o perdido. Abaixo da tabela, uma linha só com o total que foi ao chão e o botão "Ver os depósitos". Os fechos diários não entram na lista de frases.
- **Crônica recente**: `isChronicleEvent` usa `CHRONICLE_HIDDEN_EVENT_TYPES` do protocolo (viradas de dia e fechos do desperdício ficam fora).
- **Avisos**: `storageFilled` e `buildingFounded` avisam no nível "Todas"; nenhum dos dois é alarme.
- **Sem a visão guardada** (cache de outra versão do app), o relatório não tem linhas de estoque e, por isso, não tem a linha de desperdício daquela ausência.

## Filas de obras e planejadas automáticas (GDD §6.3)

As filas, a marca de cada planejada, o que ela espera e o prazo vêm prontos em `constructions` do `ViewState`. O app não conhece o nível que abre a segunda fila, a ordem em que o motor tenta as planejadas nem a conta do prazo.

- **Uma linha por fila aberta** (`components/ConstructionsPanel.tsx`, `QueueRow`), a partir de `constructions.queues`: a obra em curso, com contagem regressiva, progresso, "Cancelar" e o que o cancelamento devolve, ou "Os pedreiros estão livres.". Com duas filas abertas cada linha leva o número da sua ("Fila 1", "Fila 2"), e cada "Cancelar" tem o nome da obra (`aria-label`). `constructions.active` continua na visão, mas nada no app depende dele: quem quer "a obra" usa `busyQueues` ou `soonestConstruction` (`ui/format.ts`).
- **A fila que ainda não abriu** aparece com o motivo, que é `constructions.queuesNote`, e um cadeado ao lado do texto; nunca como botão desabilitado. A mesma frase é a explicação da linha "Construções" na árvore. Com a fila ocupada, cada obra disponível mostra a recusa do servidor (`QUEUE_LOCKED`), que também diz o que abre a segunda.
- **Planejadas**, em uma lista ordenada (a ordem é a em que as automáticas são tentadas), com uma frase que diz isso. Cada uma tem o orçamento, o prazo da obra, a marca **"Iniciar quando houver recursos"**, a linha de espera e "Tirar da lista". A manual que já pode começar (`waiting` nula) diz "Pode começar agora." e ganha o botão "Iniciar agora".
- **A marca é uma caixa de seleção que só muda quando o servidor confirma.** O clique manda `setAutoStart` e cancela a troca local (`preventDefault`): a caixa mostra `planned[].autoStart`, nunca um palpite. Uma recusa (`NOT_PLANNED`, a obra começou nesse meio) deixa a caixa como estava e vira aviso.
- **A linha de espera** é `planWaiting` (`ui/format.ts`): `waiting.text` e, quando `etaSeconds` não é nulo, ": em " mais a duração. O prazo desce com o relógio da página, como a contagem das filas; o painel põe maiúscula e ponto, a árvore usa a frase como veio.
- **A leitura seguinte acontece quando a espera acaba.** `nextPollMs` (`game/gameSession.ts`) olha o prazo de cada fila e o `etaSeconds` de cada planejada: a obra que começa sozinha aparece na hora, sem esperar os 30 s do ciclo.
- **Árvore** (`ui/treeModel.ts`): uma linha por obra em curso (`active:<edifício>`), o grupo "Planejadas" ("2 automáticas, 1 manual") com uma linha por planejada ("Serraria → Nv3", "automática · espera 30 de madeira: em 1 h 15 min"), e as obras disponíveis. A linha "Construções" resume: as obras em curso, a fila que sobra e quantas planejadas há. O botão da linha da planejada troca a marca ("Iniciar sozinha" ou "Esperar ordem"); o da obra em curso cancela aquela obra.
- **Barra de status**: a obra que termina primeiro, esteja em que fila estiver, e "+1 obra" quando há outra.
- **Paleta** (`palette/commands.ts`): "Planejar obras" pergunta, depois da obra, se ela começa sozinha. Para a obra que ainda não pode começar, "Iniciar quando houver recursos" já vem marcada (`Enter`, `Enter`). Se a obra já pode começar, a opção avisa que ela começa agora mesmo, e o que vem marcado é "Só deixar na lista": o padrão nunca gasta. "Planejadas: ligar ou desligar o início automático" lista as planejadas com o que o clique faz e o que cada uma espera. "Cancelar a obra em andamento", com duas em curso, pergunta qual.
- **Crônica, avisos e relatório**: `constructionAutoStarted` é linha da Crônica; avisa no nível "Todas", como o fim de uma obra (a obra que o próprio jogador ordena não avisa); e no Relatório de Retorno entra na lista do que ler, com o custo somado ao gasto de cada recurso pelos `spent_*` do evento.

## Troca de ofício e experiência (GDD §5.3 e §5.4)

As regras em frase, o prazo da adaptação, o que rende um trabalhador adaptado e um recém-chegado, as levas em adaptação, a experiência de cada ofício e o porquê da tendência vêm prontos em `workersRules` e `workers[]` do `ViewState`. O app não conhece a fração da adaptação, o ganho diário de experiência nem o bônus da mestria. As frases e as contas de apresentação ficam em `ui/workers.ts`.

- **O custo da troca fica à vista antes de qualquer clique**, sem diálogo no "+" e no "−". No painel (`components/WorkersPanel.tsx`): as duas frases do servidor (`adaptationText` e `removalText`) abaixo do título, e em cada edifício "+1 aqui: +4/h agora, +8/h depois de 2 h" (`nextWorkerGain`: `perNewWorkerPerHour`, `perWorkerPerHour` e `workersRules.adaptationSeconds`). O botão "+" aponta para essa frase (`aria-describedby`). Na árvore, a mesma frase vai na dica do "+" (`TreeNode.actionHints`, `actionTitle` em `workbench/Tree.tsx`) e na explicação da linha.
- **Quem se adapta**: "2 em adaptação por mais 38:00, rendendo 10,2/h cada", uma parte por leva quando há mais de uma (`adaptationLine`, a partir de `adaptingCohorts`). A contagem desce com o relógio da página. A árvore e a lista da paleta dizem só "2 em adaptação". A conta da taxa (`breakdown`) já traz a adaptação e a mestria, e é mostrada como sempre foi.
- **A leitura seguinte acontece quando a primeira leva termina** (`nextPollMs`, em `game/gameSession.ts`): o fim da adaptação não gera evento, e sem isso a taxa só subiria na tela no ciclo seguinte.
- **Experiência**: "Experiência 40/100, subindo · +12% de produção" e uma barra (`<progress>`, com rótulo), ou "Ofício dominado · +30% de produção" no fim da barra (`workersRules.experienceMax`). A tendência é dita por palavra; a seta só acompanha. A explicação do número é `experienceNote` (o porquê deste edifício) seguida de `workersRules.experienceText` (a regra).
- **Quando a experiência pede uma ação** (`experienceNeedsAttention`: está caindo, ou parou com gente trabalhando e a barra por encher), a frase do servidor sai da explicação e fica à vista na linha, com ícone de aviso. O edifício vazio que nunca teve ofício não tem o que perder e não ganha aviso. Na árvore, o edifício que perde o ofício diz "⚠ o ofício se perde".
- **Lista "Alocar trabalhadores"** (`palette/commands.ts`): o campo de busca mostra os livres e `adaptationText`; cada edifício, quantos trabalham, quanto rendem, quem se adapta e o "+1". No campo do número, a frase muda a cada tecla (`allocationMessage`): "+2: 81,5/h agora, 122,3/h depois da adaptação (2 h)", seguida da regra da chegada ou, ao tirar de onde há gente em adaptação, da regra da saída.
- **A prévia é do app** (`previewAllocation`): soma as duas taxas da visão e, ao tirar, desconta primeiro das levas mais novas, como `removalText` diz. Quem decide é o servidor; se a ordem de saída mudar no motor, a prévia precisa mudar junto (o teste em navegador da troca de ofício tira um trabalhador de um edifício com gente adaptada e em adaptação e confere a prévia com a taxa que o servidor devolve).
- **Avisos e Crônica**: `craftMastered` é linha da Crônica e avisa no nível "Todas", com uma estrela (`star-full`). O fim da adaptação não avisa.
- **Cache**: `workersRules` e os campos novos de `workers[]` são obrigatórios no schema; a visão guardada pela versão anterior é descartada sem mexer em `VIEW_FORMAT`.

## Moral (GDD §5.6 e §5.7)

O número, a faixa, o fator na produção, a conta termo a termo, o que a próxima virada do dia vai fazer, o conselho e o que as viradas fazem com o povo vêm prontos em `morale` do `ViewState`. O app não conhece os limites das faixas, o peso de termo nenhum, as chances de alguém chegar ou partir nem o piso de população. As frases de ligação e as escolhas de apresentação ficam em `ui/morale.ts`.

- **A moral só muda na virada do dia, e a tela separa as duas coisas.** `value`, `bandLabel` e `text` dizem o que ela vale e faz agora; `terms` e `breakdown` são a conta que a **próxima** virada vai fazer e somam `next.value`. Por isso a lista de termos tem o total com a faixa de `next` ("= 40 Inquieto, na próxima virada do dia"), e nunca é apresentada como a explicação do número de agora.
- **Cabeçalho** (`components/Header.tsx`, nas abas Feudo e Hoje): "Moral 60 (Contente): produção × 1,05", com o ícone da faixa e, quando a virada vai mudá-la, "· na virada do dia, cai para 40 (Inquieto)". A queda leva seta para baixo, verbo e o tom de aviso; a subida, seta para cima, sem alarme. O que a moral faz com a produção é o resto da frase `text` (`moraleEffect`); se a frase mudar de forma, o cabeçalho fica só com o número e a faixa. A explicação do número (`moraleExplanation`) junta `text`, `nextText`, a conta com o prazo ("daqui a 30 min") e `advice`.
- **Um ícone por faixa** (`moraleIcon`): `thumbsdown`, `comment-discussion`, `smiley` e `star-full`, do pior para o melhor. O nome da faixa está sempre ao lado: nada é dito só pelo ícone nem só pela cor. Nenhum deles é o da fome nem o do frio. O ícone ganha o tom de aviso quando a moral está tirando produção (`multiplierPercent` menor que 100).
- **Painel "Moral"** (`components/Panels.tsx`, entre Trabalhadores e Recrutar): a frase de agora; `nextText` com a contagem regressiva de `nextUpdateInSeconds`; a lista de termos (o primeiro, a base, sem sinal; os outros com "+" ou "−" no texto) e o total, que se explica pelo `breakdown` (é onde aparece "a moral não desce de 0"); os efeitos passageiros com o que falta para acabarem; o conselho; a frase da comida guardada (`foodReserve.text`, omitida quando o conselho já é ela); e `notes`.
- **O conselho** (`advice`) leva o sinal de aviso quando algo pesa na conta (há termo negativo) e a lâmpada quando é só o caminho para um bônus. É decisão de apresentação: o texto é sempre o do servidor.
- **Na fome, um segundo aviso** logo abaixo do de fome (`FamineBanner`, em `components/Banners.tsx`) traz `morale.notes`: em quanto tempo alguém deserta, a chance de alguém partir, o piso que segura os últimos. A perda é anunciada antes de acontecer. É `role="note"`, não região viva: o prazo muda a cada leitura.
- **Recrutar** mostra `recruitment.moraleNote` abaixo do custo e antes dos botões, e a lista da paleta o repete no texto do campo.
- **Árvore** (`ui/treeModel.ts`): a linha "Moral", a última do feudo antes da Lareira, com "60 (Contente) · ⚠ cai para 40 (Inquieto)". A explicação é a do cabeçalho, uma frase por linha, mais as `notes`. O clique só navega.
- **Avisos** (`notifications/policy.ts`): `villagerLeft`, `villagerDeserted` e a mudança de faixa **para pior** são alarmes (nível "Essenciais", tom de aviso); a mudança para melhor é o alívio deles (mesmo nível, tom de informação); `villagerArrived` é boa notícia e avisa em "Todos", como a chegada de um recrutado. O sentido da mudança sai de `data.morale` e `data.previousMorale` do evento (`moraleBandDirection`): o app não compara faixas. O ícone da mudança de faixa é o da faixa nova; quem parte ou deserta sai com `sign-out`, e o colono, com `person-add`.
- **Relatório de Retorno** (`game/returnReport.ts`, `components/Today.tsx`): `counts.settlersArrived`, `villagersLeft` e `villagersDeserted` contam os eventos da ausência, e `morale` guarda a de agora e a da visão guardada. A tela diz "Moral 16 (Desesperado): caiu de 28 (Inquieto).", quem chegou sozinho e quem se foi, cada frase com o porquê, e, quando houve perda, a moral caiu ou algo ainda pesa nela, o conselho da visão de agora com o botão "Ver a moral". A linha das contagens passou a dizer "Recrutas que chegaram", para não se confundir com os colonos.
- **A explicação de um número do cabeçalho passa por cima dos avisos do canto.** O cabeçalho é fixo e tem a própria pilha; enquanto uma explicação dele está à vista (`:has(.explained:hover)` ou `:focus`), ele sobe acima dos avisos e continua abaixo dos diálogos.
- **Cache**: `morale` e `recruitment.moraleNote` são obrigatórios no schema; a visão guardada pela versão anterior é descartada sem mexer em `VIEW_FORMAT`, e o relatório dessa primeira volta sai sem a moral de antes.

## "Antes de partir", o aviso de estação e a prioridade da barra (GDD §2.3 e §13.5)

Nenhuma regra nova: tudo sai de prazos, taxas e estoques que o `ViewState` já traz. Os limiares abaixo (um dia, oito horas, uma hora) são escolhas de apresentação, em horas de relógio, como o destaque de "cheio em"; o app não converte tempo de jogo.

- **`beforeLeaving(view)`** (`game/beforeLeaving.ts`, função pura) devolve até cinco itens `{ id, severity, text, command }`, nesta ordem: a comida (fome em andamento, ou `depletesInSeconds` da comida abaixo de 24 h), a lenha (frio em andamento; no inverno, a madeira com prazo para acabar; antes dele, `calendar.nextSeason` a menos de 24 h com `firewood.missing` maior que zero), um item por depósito cheio e perdendo ou a menos de 8 h de encher (a madeira e a pedra dividem o Armazém: um item), as obras que não começam sozinhas e os aldeões livres. Abaixo de 8 h, o que acaba é `danger`; o resto é `warning`; obras e aldeões livres são `info`.
- **Todo item tem um comando**, com o rótulo do botão: `lords.allocateWorkers` com o edifício que produz o recurso ("Alocar na Fazenda", "Alocar na Serraria"), `lords.build` com o depósito ("Construir Celeiro", "Ampliar Armazém"), `lords.planConstruction`, `lords.toggleAutoStart`. Quando a obra do depósito está travada ou já em curso, o botão é "Ver os depósitos" e leva ao feudo, onde o aviso do depósito tem o custo e o motivo.
- **Quanto falta de lenha é a conta do servidor** (`firewood.missing`), que já desconta o que a Serraria repõe. O app não divide o estoque pela taxa.
- **A lista é honesta nos dois sentidos.** Com a obra do depósito em curso e pronta antes de ele encher, o item some: não há mais o que fazer. Uma planejada automática que espera algo que chega (recurso, fila, outra obra) é o feudo preparado; uma que espera o que esperar não resolve (`waiting.etaSeconds` nulo: não cabe no depósito, falta o Salão) vira item, com a frase do servidor. Com as filas ocupadas, a obra que termina em menos de 8 h sem nada depois também é dita.
- **Na aba Hoje** (`components/Today.tsx`, `BeforeLeaving`): abaixo do Relatório de Retorno, ou no topo quando não há relatório. Uma linha por item, com o botão ao lado (abaixo, em tela estreita). A urgência tem ícone e uma palavra para leitores de tela ("Urgente", "Atenção", "Sugestão"); a cor só reforça. Sem itens: "O feudo está preparado para a sua ausência." Sem ligação, os botões que dão ordens ficam desabilitados; o que só navega continua.
- **Na árvore**, a linha "Hoje em …" diz quantos itens esperam ("2 a preparar"; "⚠ 3 a preparar" quando algum é mais que sugestão; "pronto para a ausência" sem nenhum), e a explicação os lista: quem está no feudo sabe que há o que ver na aba Hoje. As novidades e a falta de ligação passam na frente.
- **Aviso de estação, uma hora antes** (`seasonAhead`, em `notifications/policy.ts`): quando `calendar.nextSeason.secondsUntil` chega a uma hora, "Inverno à vista: chega em 59 min, às 21:40." e, em lista, as frases de `nextSeason.changes`. Se a estação que vem queima lenha e a conta não fecha, entra a frase da conta (`firewood.text`) e o aviso ganha o tom de alerta. Não prevê sorteio nem promete nada: só repete a visão. "Ver" leva à aba Hoje, onde "Antes de partir" diz o que preparar.
- **A hora do relógio** é o prazo somado ao relógio do navegador, no fuso dele: o aviso fica na tela até ser dispensado, e "em 59 min" envelhece; a hora, não.
- **É um aviso por virada.** A marca (`"1:winter"`) fica em `seasonWarned`, junto do cache da partida (`GameSession.markSeasonWarned`): recarregar a página não o repete, e sair da conta a apaga com o resto. Só uma visão lida do servidor nesta abertura conta (`GameSession.live`): a guardada pode ter horas. Segue a política dos outros avisos (`decideNotice`): nada no nível silencioso e no modo discreto, contador durante o "Silenciar 2h" e quando as três da hora já saíram.
- **Na virada**, o evento `seasonChanged` avisa no nível "Essenciais", sem tom de alarme, com o ícone do calendário e as mesmas frases. Depois da virada a visão já fala da estação seguinte; por isso o controlador guarda as frases de cada estação enquanto ela é a próxima (`seasonChanges`). Sem elas (página aberta depois da virada), o aviso diz `calendar.seasonEffects`. A virada para uma estação que já passou (um salto longo com a aba ao fundo traz duas) não vira aviso. O aviso de uma hora antes, se ainda estiver à vista, sai de cena.
- **As frases que detalham um aviso** são `Toast.details`, desenhadas como lista abaixo do texto; a notificação do navegador as leva na mesma linha.
- **Barra de status** (`statusBar`, em `ui/format.ts`): sem ligação > decisões pendentes (`pendingDecisions.length`; o clique leva à aba Hoje) > fome e frio > depósito cheio e perdendo, ou a menos de 8 h de encher (`$(archive) Madeira: cheio em 3 h`; o clique leva ao feudo) > obra > comida por hora. Só a fome e o frio têm o destaque de aviso. Com mais de um depósito em alerta, a linha fala do que mais perde (ou do que enche primeiro) e a explicação, de todos.
- **Título da aba do navegador** (`documentTitle`): o contador de novidades, o mesmo assunto da barra e o nome do feudo ("(1) Habitações Nv2 · 00:04 · Pedra Alta · Lords of the Guild"). Sem ligação fica só o nome: o estado guardado pode estar velho. Com a aba ao fundo o relógio da página não anda, e o prazo do título é o da última leitura (a cada 2 min).
- **O modo discreto** continua só com o contador, na barra e no título.

## Cache e versões

O cache de cada partida (`lords.cache:<servidor>:<conta>:<partida>`) guarda `version`, que é `CACHE_VERSION` de `game/gameSession.ts`: o protocolo e o formato da visão (`VIEW_FORMAT`). Ao abrir, a visão só é exibida se a marca for a desta versão **e** a visão passar no `ViewStateSchema`; senão ela é descartada, e o cursor dos eventos e o instante da última visita são mantidos. Sem o cursor, a partida inteira voltaria como novidade. Com o instante, quem volta 4 h ou mais depois de uma atualização do jogo é tratado como em qualquer ausência longa: abre na aba Hoje, os eventos da ausência não viram avisos avulsos, e o Relatório de Retorno sai sem a tabela de estoques (não há visão antiga a comparar), dizendo por quê. A primeira leitura do servidor grava por cima. Suba `VIEW_FORMAT` quando um campo do `ViewState` mudar de sentido sem mudar de forma; mudança de forma o schema já pega, e mudança de protocolo muda a marca sozinha. Foi o caso das filas de obras e das planejadas automáticas (V2C-T5): os campos novos são obrigatórios no schema, e a visão guardada pela versão anterior é descartada sem mexer em `VIEW_FORMAT`.

## O que é próprio do navegador

- **Credenciais e cache** ficam no `localStorage` (chaves `lords.*`). O que as protege é a política de conteúdo de `index.html`: só arquivos da própria origem, nenhum script ou estilo embutido. Por isso não há `style="…"` em componente nenhum. No servidor de desenvolvimento a política é afrouxada para o Vite injetar estilos (`vite.config.ts`).
- **Várias abas** dividem o mesmo refresh token, que só vale uma vez. A renovação acontece dentro de `navigator.locks.request('lords.refresh')`; a aba que recebe o lock espera a gravação da outra chegar (`storageSettle`) e relê os tokens antes de decidir renovar. Sair, excluir ou perder a sessão em uma aba leva todas às boas-vindas.
- **Atalhos**: `Ctrl+Shift+P` e `Ctrl+P` são do navegador. A paleta abre com `F1` e `Ctrl+K`.
- **Nada chega com a aba fechada.** Com ela em segundo plano, o título conta as novidades e repete o assunto da barra de status; notificações do navegador só se o jogador ligar nas preferências, e a permissão só é pedida nessa hora.
- **Estado restaurado antes do primeiro desenho** (`main.tsx`): quem recarrega a página vê o feudo direto do cache, sem passar pelas boas-vindas.
- **A bancada ouve desde o primeiro desenho.** `useController` e o `DialogHost` assinam as mudanças com `useLayoutEffect`. Com `useEffect` a assinatura só existiria depois do próximo quadro, e o que mudasse nesse intervalo (a resposta de `/version`, um `F1` logo ao abrir a página) não redesenharia nada: a paleta ficava aberta sem aparecer e o texto digitado caía no campo das boas-vindas.

## Limites conhecidos

- O vínculo GitHub só foi exercitado com um GitHub simulado. O fluxo real depende de um OAuth App com *device flow* e do `GITHUB_CLIENT_ID` no servidor; sem ele o app esconde os botões. Na v0.1 o vínculo fica desligado em produção, por decisão do autor ([ADR 0010](../../docs/decisions/0010-version-informa-o-que-esta-ligado.md)).
- Testado só em Chromium. Firefox e Safari não foram abertos.
- A espera de `storageSettle` é uma proteção contra a leitura atrasada do `localStorage` entre processos do navegador; a corrida em si não foi reproduzida nos testes.
- Nome e ícone são provisórios. O texto de privacidade foi aprovado pelo autor em 2026-10-01.
