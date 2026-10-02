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
| `src/game/` | `gameSession.ts`: ciclo de 30 s (2 min em segundo plano), cache para o modo sem conexão (com marca de versão), envio de ordens, Relatório de Retorno. `newGame.ts`: as opções de nova partida (dificuldade e ritmo) como dados, a escolha que vale e as linhas que a tela mostra |
| `src/notifications/` | `policy.ts` decide o que avisar (no máximo 3 por hora); `Toasts.tsx` desenha; `browserNotifications.ts` é a opção do navegador |
| `src/palette/` | `commands.ts`: todos os comandos, o único lugar que conversa com o jogador por diálogos. `CommandPalette.tsx`: a paleta (`F1` ou `Ctrl+K`) e as listas de escolha, que podem abrir com um item já marcado (`selected`) |
| `src/services/` | `browserStore.ts` (`localStorage` com prefixo `lords.`, tolerante a falha), `sessionLock.ts` (Web Locks na renovação da sessão), `tabSync.ts` (evento `storage`), `visibility.ts`, `preferences.ts` |
| `src/workbench/` | A bancada: `ActivityBar`, `SideBar`, `Tree` (padrão ARIA, `treeNav.ts`), `EditorTabs`, `StatusBar` |
| `src/tabs/` | Conteúdo das abas: Feudo, Hoje, Crônica, Preferências (com a dificuldade e o ritmo do feudo, só para leitura), Sobre |
| `src/components/` | Os painéis do feudo (recursos, trabalhadores, construções, recrutamento, objetivos), os avisos do painel (`Banners.tsx`: sem ligação, fome, frio e a conta da lenha) e as boas-vindas, com os dois grupos de opções de nova partida |
| `src/ui/` | Árvore e barra de status como dados (`treeModel.ts`, `format.ts`) |
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
- **Prazos da estação**: `durationNote` das obras aparece uma vez acima da lista de disponíveis, uma vez na lista da paleta e na explicação de cada obra na árvore; o do recrutamento, ao lado do prazo, no painel e na paleta.
- **A explicação de um número** (`.explained`) fica por cima dos avisos do canto. O aviso de frio ou de fome não some sozinho, e antes cobria a ponta da explicação em telas estreitas.
- Os prazos aproximados ("acaba em 14 h", "Inverno em 4 h", "frio há 50 min") não descem com o relógio local: o cabeçalho, a tabela e a árvore mostram o mesmo número, que muda a cada leitura do servidor.

## Cache e versões

O cache de cada partida (`lords.cache:<servidor>:<conta>:<partida>`) guarda `version`, que é `CACHE_VERSION` de `game/gameSession.ts`: o protocolo e o formato da visão (`VIEW_FORMAT`). Ao abrir, a visão só é exibida se a marca for a desta versão **e** a visão passar no `ViewStateSchema`; senão ela é descartada, e o cursor dos eventos e o instante da última visita são mantidos. Sem o cursor, a partida inteira voltaria como novidade. Com o instante, quem volta 4 h ou mais depois de uma atualização do jogo é tratado como em qualquer ausência longa: abre na aba Hoje, os eventos da ausência não viram avisos avulsos, e o Relatório de Retorno sai sem a tabela de estoques (não há visão antiga a comparar), dizendo por quê. A primeira leitura do servidor grava por cima. Suba `VIEW_FORMAT` quando um campo do `ViewState` mudar de sentido sem mudar de forma; mudança de forma o schema já pega, e mudança de protocolo muda a marca sozinha.

## O que é próprio do navegador

- **Credenciais e cache** ficam no `localStorage` (chaves `lords.*`). O que as protege é a política de conteúdo de `index.html`: só arquivos da própria origem, nenhum script ou estilo embutido. Por isso não há `style="…"` em componente nenhum. No servidor de desenvolvimento a política é afrouxada para o Vite injetar estilos (`vite.config.ts`).
- **Várias abas** dividem o mesmo refresh token, que só vale uma vez. A renovação acontece dentro de `navigator.locks.request('lords.refresh')`; a aba que recebe o lock espera a gravação da outra chegar (`storageSettle`) e relê os tokens antes de decidir renovar. Sair, excluir ou perder a sessão em uma aba leva todas às boas-vindas.
- **Atalhos**: `Ctrl+Shift+P` e `Ctrl+P` são do navegador. A paleta abre com `F1` e `Ctrl+K`.
- **Nada chega com a aba fechada.** Com ela em segundo plano, o título conta as novidades; notificações do navegador só se o jogador ligar nas preferências, e a permissão só é pedida nessa hora.
- **Estado restaurado antes do primeiro desenho** (`main.tsx`): quem recarrega a página vê o feudo direto do cache, sem passar pelas boas-vindas.
- **A bancada ouve desde o primeiro desenho.** `useController` e o `DialogHost` assinam as mudanças com `useLayoutEffect`. Com `useEffect` a assinatura só existiria depois do próximo quadro, e o que mudasse nesse intervalo (a resposta de `/version`, um `F1` logo ao abrir a página) não redesenharia nada: a paleta ficava aberta sem aparecer e o texto digitado caía no campo das boas-vindas.

## Limites conhecidos

- O vínculo GitHub só foi exercitado com um GitHub simulado. O fluxo real depende de um OAuth App com *device flow* e do `GITHUB_CLIENT_ID` no servidor; sem ele o app esconde os botões. Na v0.1 o vínculo fica desligado em produção, por decisão do autor ([ADR 0010](../../docs/decisions/0010-version-informa-o-que-esta-ligado.md)).
- Testado só em Chromium. Firefox e Safari não foram abertos.
- A espera de `storageSettle` é uma proteção contra a leitura atrasada do `localStorage` entre processos do navegador; a corrida em si não foi reproduzida nos testes.
- Nome e ícone são provisórios. O texto de privacidade foi aprovado pelo autor em 2026-10-01.
