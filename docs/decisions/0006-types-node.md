# 0006 — `@types/node` e `@types/pg` como dependências de desenvolvimento

Data: 2026-10-01\
Estado: aprovada pelo autor em 2026-10-01 (tinha sido adotada na Fase 2 sem aprovação explícita; ver "Como foi adotada")\
Escopo: roadmap §1.6; F1-T10, F2-T2 em diante, F3-T2

## Contexto

A lista de bibliotecas permitidas (roadmap §1.6) inclui `@types/vscode`, mas não `@types/node`. Sem ele, o TypeScript não conhece `process`, `console`, `Buffer` nem os módulos `node:*`.

Na Fase 1 só o `sim-cli` precisa do ambiente Node, e precisa de pouco: argumentos e saída padrão. Para não instalar uma dependência fora da lista, `packages/sim-cli/src/node-env.d.ts` declara à mão essas quatro propriedades de `process`. Isso não se sustenta na Fase 2: o servidor usa `node:crypto`, `Buffer`, sinais do processo e temporizadores, e os tipos do `pg` e do Fastify já dependem dos tipos do Node.

## Decisão

Permitir `@types/node` (linha 22, a mesma do runtime) como dependência de desenvolvimento dos pacotes que rodam em Node: `server`, `sim-cli`, `client-sdk` e `extension`. Pelo mesmo motivo, permitir `@types/pg` no `server`: o `pg` não traz os próprios tipos. `engine`, `content` e `protocol` continuam sem ele e com `types: []`, para que o compilador também recuse APIs do Node nesses pacotes.

## Como foi adotada

A proposta ficou aguardando aprovação ao fim da Fase 1. O pedido seguinte foi implementar a Fase 2, sem resposta direta a este ADR. Como o servidor não compila sem os tipos do Node, a Fase 2 foi implementada com `@types/node` e `@types/pg`, e `packages/sim-cli/src/node-env.d.ts` foi removido. Se a decisão for outra, a reversão é trocar as duas dependências por declarações manuais; nenhum código de produção depende delas.

O autor aprovou a decisão em 2026-10-01, como está.

## Consequências e verificação

É um pacote só de tipos: não entra na imagem de produção nem no `.vsix`. Sem a aprovação, a alternativa é manter declarações manuais do ambiente em cada pacote, o que cresce e envelhece mal a partir de F2-T2.
