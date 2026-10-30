# Mapa de contexto — Novidades

Pedido direto do autor, fora do plano da v0.4. Base: `7cbdad1`, branch `novidades`.
Mapa conferido antes da implementação, em 2026-10-30.

## Arquivos a alterar

| Arquivo | Finalidade e mudança |
| --- | --- |
| `packages/web/src/news/` | Crônicas por versão e marca de leitura por conta |
| `packages/web/src/tabs/News.tsx` | Documento de leitura, datas e aviso de rascunho |
| `packages/web/src/app/router.ts`, `controller.ts` | Rota fechável, versão do servidor e leitura após o desenho |
| `packages/web/src/palette/commands.ts` | `lords.openNews` |
| `packages/web/src/ui/treeModel.ts`, `workbench/` | Menu da Conta, selo e montagem da aba |
| `packages/web/src/tabs/About.tsx`, `styles.css` | Acesso junto da Privacidade e apresentação com tokens existentes |
| `packages/web/README.md`, `docs/pendencias-v0.4.md`, `docs/roadmap-v0.4.md` | Uso, confirmação editorial e Registro |

## Dependências

| Arquivo | Relação |
| --- | --- |
| `services/browserStore.ts` | Leitura e escrita de `localStorage` já protegidas por `try/catch` |
| `services/tabSync.ts` | Atualização do selo quando outra aba lê as notícias |
| `app/controller.ts` | Fim da sessão limpa dados da conta, inclusive a marca de leitura |
| `theme/themes.css` | Tokens existentes de selo e texto, com contraste nos três temas |

## Testes

| Teste | Cobertura |
| --- | --- |
| `news/*.test.ts`, `tabs/news.test.tsx` | Publicação, isolamento por conta, falha do armazenamento e HTML |
| `app/router.test.ts`, `palette/palette.test.ts`, `ui/ui.test.ts`, `workbench/workbench.test.tsx` | Integração com contratos existentes |
| `tests/e2e/15-novidades.spec.ts` | Paleta, teclado, leitura persistida, temas e largura de 720 px |
| `bundle.test.ts`, `theme/theme.test.ts` | Conteúdo oculto fora do app, CSP e cores por tokens |

## Padrões de referência

| Arquivo | Padrão |
| --- | --- |
| `tabs/About.tsx` | Documento sem dependência de feudo e versão de `GET /v1/version` |
| `workbench/Tree.tsx`, `Workbench.tsx` | Foco e assinatura com `useLayoutEffect` |
| `account/linkReminder.ts` | Registro local por conta, sem regra do motor |
| `tests/e2e/05-teclado-e-temas.spec.ts`, `helpers.ts` | Paleta por teclado, contraste e transbordamento |

## Riscos conferidos

- Sem mudança de API, estado do jogo, banco ou dependência.
- A v0.4 é rascunho explícito; sua data é editorial, não de publicação.
- O selo considera somente notícias publicadas compatíveis com a versão do servidor.
- Sem números de regra, texto copiado do catálogo, importação de motor ou conteúdo.
- Verificação limitada pelo pedido: sem suíte geral, integração, matriz ou publicação.
