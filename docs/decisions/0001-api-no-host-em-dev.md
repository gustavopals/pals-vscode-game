# 0001 — API no host em desenvolvimento

Data: 2026-10-01\
Estado: consolidada\
Escopo: GDD §14.13; roadmap §1.1, F0-T4, F2-T2 e F2-T9

## Contexto

O banco roda em Docker em todos os ambientes. Para a API havia duas opções no desenvolvimento: dentro de um contêiner, com o código do host montado por bind mount, ou direto no host. Com bind mount, o `node_modules` instalado no host passa a ser lido por outro sistema dentro do contêiner; a recarga a cada alteração e o depurador também atravessam a fronteira do contêiner, mais lenta no WSL2.

## Decisão

- Em desenvolvimento, a API roda **no host** com `pnpm dev:api` (`tsx watch`), ligada aos bancos `db` (5432) e `db_test` (5433) do `deploy/docker-compose.dev.yml`.
- `node_modules` nunca é compartilhado entre host e contêiner: a imagem instala as próprias dependências a partir do lockfile.
- A imagem de produção é exercitada localmente pelo perfil `full` do compose de dev (`docker compose -f deploy/docker-compose.dev.yml --profile full up -d`) e pelo job `docker` da CI.
- Build e runtime usam a mesma base, `node:22-bookworm-slim`. Alpine não é usado.
- O alvo `dev` do `Dockerfile` existe como opção, não como caminho padrão.

## Consequências e verificação

O desenvolvedor precisa de Node 22 e pnpm 9 no host (`.nvmrc` e `packageManager` fixam as versões). Diferenças entre o host e a imagem só aparecem no perfil `full` e na CI, por isso F2-T9 valida a API em contêiner antes de qualquer implantação.

A motivação original incluía o módulo nativo `argon2`, que quebraria com um `node_modules` compartilhado entre bases diferentes. O [ADR 0003](0003-codigo-do-reino-hmac.md) removeu o Argon2 da v0.1; a decisão se mantém pelos motivos acima.

F0-T4 comprova que os dois bancos sobem saudáveis e que a imagem constrói. F2-T2 comprova `pnpm dev:api` contra o `db` em Docker; F2-T9, a API saudável no perfil `full`.
