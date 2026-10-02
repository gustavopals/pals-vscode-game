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
```

Os testes de unidade rodam em Node, sem DOM: funções puras e HTML gerado com `preact-render-to-string`. Tudo o que depende de um navegador (foco, teclado, `localStorage` entre abas, CSP, contraste) é provado em `tests/e2e/`, com o app compilado. `src/test-helpers.ts` tem uma API `/v1` de mentira em memória (`fakeApi`), um controlador pronto (`makeController`) e diálogos respondidos por roteiro (`scriptedDialogs`).

O `ViewState` de exemplo dos testes é o golden do motor, importado por caminho relativo (`../../engine/src/__golden__/view-seed-pedra-alta.json`).

## Estrutura

| Pasta | O que tem |
|---|---|
| `src/app/` | `controller.ts`: o estado do app em um lugar só (conta, partida, abas, avisos), sem nada do navegador. `dialogs.ts` e `DialogHost.tsx`: diálogos acessíveis (confirmação, campo com validação, lista de escolha, informação). `router.ts`: abas e `#/feudo` |
| `src/account/` | Conta neste navegador, Código do Reino, vínculo GitHub (*device flow*), lembrete "Proteja seu reino" depois de 48 horas reais (`linkReminder.ts`) |
| `src/game/` | `gameSession.ts`: ciclo de 30 s (2 min em segundo plano), cache para o modo sem conexão, envio de ordens, Relatório de Retorno |
| `src/notifications/` | `policy.ts` decide o que avisar (no máximo 3 por hora); `Toasts.tsx` desenha; `browserNotifications.ts` é a opção do navegador |
| `src/palette/` | `commands.ts`: todos os comandos, o único lugar que conversa com o jogador por diálogos. `CommandPalette.tsx`: a paleta (`F1` ou `Ctrl+K`) e as listas de escolha |
| `src/services/` | `browserStore.ts` (`localStorage` com prefixo `lords.`, tolerante a falha), `sessionLock.ts` (Web Locks na renovação da sessão), `tabSync.ts` (evento `storage`), `visibility.ts`, `preferences.ts` |
| `src/workbench/` | A bancada: `ActivityBar`, `SideBar`, `Tree` (padrão ARIA, `treeNav.ts`), `EditorTabs`, `StatusBar` |
| `src/tabs/` | Conteúdo das abas: Feudo, Hoje, Crônica, Preferências, Sobre |
| `src/components/` | Os painéis do feudo (recursos, trabalhadores, construções, recrutamento, objetivos) e as boas-vindas |
| `src/ui/` | Árvore e barra de status como dados (`treeModel.ts`, `format.ts`) |
| `src/theme/` | `themes.css`: o **único** arquivo com cores. Os três temas são valores para as variáveis `--vscode-*` que o resto do CSS usa |

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
