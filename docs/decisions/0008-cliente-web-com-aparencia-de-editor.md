# 0008 — Cliente web com aparência de editor, em vez de extensão do VS Code

Data: 2026-10-01\
Estado: decidida pelo autor (mudança de plataforma); os seis pontos da seção "Pontos a confirmar" foram confirmados pelo autor em 2026-10-01, o ponto 2 com a observação de que o vínculo GitHub fica desligado na v0.1\
Escopo: GDD §1, §13, §14.1, §14.2, §14.5, §14.7, §14.10, §14.12–14.14, §16.1, §17 e §18; roadmap §1, Fase 3, Fase 4 e Fase 5

## Contexto

Até a Fase 3, o cliente do jogo era uma extensão do VS Code: TreeView, Status Bar, comandos da paleta e um WebviewPanel em Preact. A extensão foi implementada e testada por automação, mas nunca aberta em um editor real.

O autor decidiu mudar a plataforma: o jogo passa a ser jogado **no navegador**, em uma página com a **aparência de um editor de código**, e não como extensão de verdade. O que se quer manter é a fantasia do pilar 5 (uma interface discreta, com cara de ferramenta de trabalho), sem exigir que o jogador use o VS Code nem instale nada.

## Decisão

1. **O cliente é um app web** (`packages/web`), uma página única servida pelo mesmo domínio da API. Abrir o endereço e clicar em **Jogar agora** substitui "instalar a extensão".
2. **A interface imita a bancada de um editor**: barra de atividades, barra lateral com árvore, área central com abas, barra de status, paleta de comandos e notificações no canto. Os temas (escuro, claro e alto contraste) são do próprio app.
3. **O servidor, o motor, o conteúdo, o protocolo e o `client-sdk` não mudam de papel.** O servidor continua autoritativo; o cliente continua só exibindo o `ViewState`. Os contratos dos ADRs 0003 a 0005 valem como estão.
4. **A extensão sai do plano.** Os pacotes `packages/extension` e `packages/webview` são removidos depois que o que há de reaproveitável neles for migrado para `packages/web` (tarefa F3W-T1). O histórico do Git preserva a implementação.
5. **Nada do editor real é usado**: nem API, nem `SecretStorage`, nem o provedor de autenticação do VS Code, nem Marketplace.

### O que se reaproveita

| Já existe | Destino |
|---|---|
| `@lotg/client-sdk` | Usado como está: só depende de `fetch` |
| `account/accountService.ts`, `account/githubLink.ts`, `account/recoveryCode.ts`, `account/linkReminder.ts` | Migram para `packages/web`; já não conhecem o VS Code |
| `game/gameSession.ts`, `game/connection.ts`, `game/returnReport.ts` | Migram; "painel visível" passa a ser "aba do navegador visível" |
| `notifications/policy.ts` | Migra sem mudança |
| `ui/treeModel.ts`, `ui/format.ts` | Migram; a árvore e a barra de status já são calculadas como dados |
| Componentes Preact da Webview (`Welcome`, `Today`, `ResourcesTable`, `WorkersPanel`, `ConstructionsPanel`, …) e `state.ts` | Viram o conteúdo das abas do app |
| `styles.css`, só com variáveis `--vscode-*` | Continua valendo: o app define essas mesmas variáveis nos seus temas |
| Lógica de `controller.ts` e `commands/*.ts` | Reescrita sem `vscode`: os diálogos (QuickPick, InputBox, mensagens) passam a ser componentes do app |
| Testes dos módulos puros e os de ponta a ponta contra o servidor | Migram; o "editor de mentira" dá lugar a um navegador de verdade |

### O que muda no contrato com o servidor

- **Hospedagem na mesma origem.** O Caddy serve os arquivos estáticos do app em `/` e encaminha `/v1` para a API. Não há CORS. Em desenvolvimento, o servidor do app encaminha `/v1` para `localhost:3000`.
- **GitHub.** Sem o provedor de autenticação do VS Code, o cliente precisa obter o token do GitHub por conta própria. Proposta: *device flow* do GitHub, com duas rotas novas no servidor que só repassam a chamada (o endpoint do GitHub não aceita chamadas do navegador). Isso exige um identificador público de aplicativo (`GITHUB_CLIENT_ID`), mas continua sem nenhum segredo de OAuth no servidor. A rota `POST /auth/github { githubAccessToken }` continua igual.
- **Cabeçalho `X-Lords-Client`** passa a ser `web/<versão>`.

Nada mais muda na API `/v1`.

## Pontos a confirmar

> **Confirmados pelo autor em 2026-10-01**, os seis, na opção da coluna "Recomendação adotada no plano". Sobre o ponto 2: o *device flow* é o desenho aprovado e o código continua no repositório, testado só com um GitHub simulado; na v0.1 o vínculo GitHub fica **desligado** em produção (sem `GITHUB_CLIENT_ID`), e o critério de aceitação 10 fecha pelo Código do Reino.

São escolhas que a mudança de plataforma obriga a fazer. O plano revisado adota a opção recomendada em cada uma; trocar qualquer uma delas é uma alteração localizada.

| # | Questão | Recomendação adotada no plano | Alternativa |
|---|---|---|---|
| 1 | Onde ficam os tokens no navegador | `localStorage`, com política de conteúdo (CSP) estrita no app e nenhum script de terceiros. O servidor não muda | Refresh token em cookie `HttpOnly` definido pelo servidor: resiste melhor a XSS, mas muda o contrato de `/auth/*` (novo ADR) e exige proteção contra CSRF |
| 2 | Vínculo com o GitHub | *Device flow*, com `GITHUB_CLIENT_ID` e sem segredo. O jogador copia um código e o confirma em `github.com/login/device`. **Depende de você registrar um OAuth App no GitHub** | Deixar o GitHub fora da v0.1 e usar só o Código do Reino; ou fluxo web clássico, que exige guardar um `client_secret` no servidor |
| 3 | Destino da extensão | Remover `packages/extension` e `packages/webview` depois da migração | Manter a extensão como segundo cliente: dobra o custo de toda mudança de interface |
| 4 | Notificações | Avisos dentro do app e contador no título da aba. Notificações do navegador só se o jogador ligar. Nada chega com a aba fechada na v0.1 | Service worker com push: precisa de infraestrutura de envio e de consentimento; fica para depois da v0.1 |
| 5 | Novas dependências | `vite` e `@preact/preset-vite` (servidor de desenvolvimento e build do app), `@vscode/codicons` (ícones, licença CC BY 4.0) e `@playwright/test` (testes em navegador real) | Só `esbuild`, sem servidor de desenvolvimento com proxy; ícones desenhados à mão; sem teste em navegador real |
| 6 | Marca | O app tem a aparência de um editor de código, mas não usa o nome, o logotipo nem a marca "Visual Studio Code" na interface | — |

## Consequências e verificação

**Ganhos.** Não há instalação: o critério "do clique ao primeiro comando em menos de 30 segundos" fica mais fácil. O jogo deixa de depender de o jogador usar o VS Code. E, pela primeira vez, o cliente pode ser testado de verdade por automação: um navegador sem interface roda nos testes e na CI, o que a extensão não permitia.

**Perdas.** O jogo deixa de viver dentro da ferramenta de trabalho: é uma aba a mais, e não um painel ao lado do código. A barra de status e as notificações só existem enquanto a aba está aberta. O login do GitHub deixa de ser um clique.

**Riscos novos.**

- *Tokens ao alcance de scripts da página.* Mitigação: CSP sem `unsafe-inline` nem origens externas, nenhuma dependência carregada de CDN, nomes de jogadores sempre exibidos como texto. Rever o ponto 1 antes de qualquer conteúdo gerado por jogadores (ranking, Crônicas compartilhadas, na v0.5).
- *Várias abas na mesma conta.* Elas dividem o mesmo refresh token. O app usa a Web Locks API para que só uma aba renove a sessão por vez, o que fecha a corrida que restava entre janelas do VS Code.
- *Atalhos de teclado.* O navegador reserva vários atalhos de editor (`Ctrl+Shift+P`, `Ctrl+P`, `Ctrl+W`). A paleta de comandos abre com `F1` e `Ctrl+K`.

**Trabalho descartado.** A cola com o VS Code (`extension.ts`, `controller.ts`, `commands/*.ts`, `ui/treeProvider.ts`, `ui/statusBar.ts`, `ui/panel.ts`, `notifier.ts`), o manifesto, o empacotamento `.vsix`, o editor de mentira dos testes e o roteiro manual escrito para o VS Code.

**Verificação.** As tarefas F3W-T1 a F3W-T10 do roadmap substituem F3-T2 a F3-T10. Os critérios de aceitação da v0.1 (GDD §16.1) foram reescritos para o navegador, e F3W-T10 os confere em um navegador real.
