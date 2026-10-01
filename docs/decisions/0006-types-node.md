# 0006 — `@types/node` como dependência de desenvolvimento

Data: 2026-10-01\
Estado: proposta (aguardando aprovação)\
Escopo: roadmap §1.6; F1-T10, F2-T2 em diante, F3-T2

## Contexto

A lista de bibliotecas permitidas (roadmap §1.6) inclui `@types/vscode`, mas não `@types/node`. Sem ele, o TypeScript não conhece `process`, `console`, `Buffer` nem os módulos `node:*`.

Na Fase 1 só o `sim-cli` precisa do ambiente Node, e precisa de pouco: argumentos e saída padrão. Para não instalar uma dependência fora da lista, `packages/sim-cli/src/node-env.d.ts` declara à mão essas quatro propriedades de `process`. Isso não se sustenta na Fase 2: o servidor usa `node:crypto`, `Buffer`, sinais do processo e temporizadores, e os tipos do `pg` e do Fastify já dependem dos tipos do Node.

## Decisão proposta

Permitir `@types/node` (linha 22, a mesma do runtime) como dependência de desenvolvimento dos pacotes que rodam em Node: `server`, `sim-cli`, `client-sdk` e `extension`. `engine`, `content` e `protocol` continuam sem ele e com `types: []`, para que o compilador também recuse APIs do Node nesses pacotes.

Ao aprovar, remover `packages/sim-cli/src/node-env.d.ts`.

## Consequências e verificação

É um pacote só de tipos: não entra na imagem de produção nem no `.vsix`. Sem a aprovação, a alternativa é manter declarações manuais do ambiente em cada pacote, o que cresce e envelhece mal a partir de F2-T2.
