# 0009 — Implantação no Coolify, em três recursos

Data: 2026-10-01\
Estado: decidido pelo autor em 2026-10-01 (plataforma, domínio e arquitetura); GDD e roadmap ainda não atualizados\
Escopo: GDD §14.13, §14.14 e §18.4; roadmap §1.1, §1.2, §1.3, F3W-T9.4 e F4-T1 a F4-T5

## Contexto

A Fase 4 foi escrita para um VPS limpo com Docker Compose: um contêiner do Caddy termina o TLS, serve o app e encaminha `/v1` para a API; o backup é um `pg_dump` pelo cron do host; atualizar e reverter são comandos de `docker compose` e `docker tag`.

O autor passou a ter um servidor com [Coolify](https://coolify.io) 4.3 (`app.palsincomehub.com`), que já traz proxy com TLS automático (Traefik), deploy a partir do Git, backup agendado de banco, histórico de deploys com reversão e painel de logs e saúde. Rodar o compose do roadmap dentro dele duplicaria o proxy e deixaria de fora o que a plataforma faz sozinha.

Alternativas consideradas:

1. **Três recursos do Coolify** (adotada): banco gerenciado, aplicação da API e aplicação do app web.
2. **Um recurso "Docker Compose"** com `caddy`, `api` e `db`, como em F4-T1, com o Traefik só terminando o TLS. Fica mais perto do GDD e continua portável para um VPS sem Coolify, mas o backup segue por script e cron e nada sobe antes de o compose e o alvo `web` existirem.

## Decisão

O destino de produção da v0.1 é o Coolify, no domínio `lords.palsincomehub.com`, com três recursos no projeto "Lords of the Guild", ambiente `production`:

| Recurso | Origem | Rota pública |
|---|---|---|
| `lotg-db` | PostgreSQL 16 gerenciado, volume persistente, **sem porta publicada** | nenhuma |
| `lotg-api` | repositório Git, `deploy/Dockerfile`, alvo `runtime`, porta 3000 | `https://lords.palsincomehub.com/v1` |
| `lotg-web` (a criar depois de F3W-T9) | repositório Git, `deploy/Dockerfile`, alvo `web`, porta 80 | `https://lords.palsincomehub.com` |

Contratos que não mudam: app e API na mesma origem, sem CORS; HTTPS obrigatório; a API aplica as migrações no arranque; `JWT_SECRET` e `RECOVERY_CODE_SECRET` independentes, o segundo preservado para sempre; banco inacessível de fora.

O que muda em relação ao GDD §14.13:

- **Borda.** O Traefik do Coolify termina o TLS e separa as rotas pelo caminho. Na aplicação da API, a remoção do prefixo fica **desligada** (`is_stripprefix_enabled=false`): a API recebe `/v1/...` inteiro. `TRUST_PROXY=true`, porque há um proxy à frente.
- **Caddy.** Deixa de ser a borda e passa a ser só o servidor de arquivos dentro da imagem `web`, em HTTP na porta 80: `index.html` para rotas desconhecidas, cache longo para arquivos com hash, `Content-Security-Policy`, `X-Content-Type-Options` e `Referrer-Policy`. Ele não encaminha `/v1` e não emite certificado. O `Strict-Transport-Security` das respostas da API, se desejado, vira rótulo do Traefik.
- **Saúde.** A verificação de saúde do Coolify fica desligada na API: ela exige `curl` ou `wget` dentro da imagem, que não tem nenhum dos dois. Vale o `HEALTHCHECK` do `Dockerfile`, que usa `node`; o Coolify lê o estado que o Docker informa.
- **Variáveis.** Ficam no Coolify, por aplicação; não existe `deploy/.env` em produção. `DATABASE_URL` é o endereço interno do banco. `POSTGRES_PASSWORD`, `PUBLIC_HOST` e `API_IMAGE_TAG` deixam de existir.
- **Backup.** Agendamento do Coolify: `pg_dump` diário às 03:00 UTC, retenção de 14 dias, no disco do próprio servidor. Substitui `backup.sh` e a linha de cron.
- **Atualização e reversão.** Atualizar é um novo deploy do `main`; reverter é o "rollback" do Coolify para a imagem do deploy anterior (ele guarda as duas últimas). A regra de migrações compatíveis com a versão anterior continua valendo.

## Consequências e verificação

Estado em 2026-10-01: `lotg-db` e `lotg-api` criados e no ar a partir do commit `1ef9545`; `GET https://lords.palsincomehub.com/v1/health` responde `{"status":"ok","db":"ok"}` e o primeiro backup manual terminou com sucesso. `/` responde 503 até existir a aplicação `lotg-web`.

Pendências que esta decisão cria:

- **GDD §14.13 e §18.4** descrevem o compose com Caddy; precisam passar a descrever esta instalação (ou apresentá-la ao lado da instalação de referência em VPS, se ela for mantida para quem hospeda por conta própria).
- **Roadmap.** F4-T1 troca `docker-compose.yml` e o Caddy de borda por um `Caddyfile` só de arquivos estáticos e pela descrição dos três recursos em `deploy/README.md`; F4-T2 vira "agendamento e ensaio de restauração pelo Coolify"; F4-T3 já está em parte cumprida (falta o app e o `GITHUB_CLIENT_ID`); F4-T5 passa a ensaiar o rollback do Coolify. F3W-T9.4 deve escrever o alvo `web` sem `reverse_proxy` e **antes** do alvo `runtime` no `Dockerfile`, ou a API precisa continuar com o alvo fixado (já está).
- **Backup fora do servidor.** Os arquivos ficam no mesmo disco do banco: perder o servidor é perder os dois. Falta um destino S3 no Coolify. Enquanto não houver, a promessa de retenção de 14 dias do GDD §14.7 vale só para falhas que não levem o disco.
- **Segredos.** `JWT_SECRET`, `RECOVERY_CODE_SECRET` e a senha do banco foram gerados na criação e só existem no Coolify. Uma cópia de `RECOVERY_CODE_SECRET` precisa ser guardada fora dele: sem ela, restaurar o banco em outro lugar invalida todos os Códigos do Reino.
- **Deploy automático.** O repositório entra como público, sem webhook: cada atualização é disparada à mão (painel, API ou MCP). Um GitHub App no Coolify permitiria deploy a cada `push` no `main`; fica como escolha do autor.
- **Servidor único.** Coolify, banco, API e app dividem a mesma máquina, hoje também usada para testes. O dimensionamento do GDD (2 vCPU, 2 a 4 GB) continua sendo o piso.

Cenários que provam o contrato: `/v1/health` e `/v1/version` em HTTPS; depois de `lotg-web`, abrir o domínio em navegador limpo, **Jogar agora** e ver Pedra Alta; restaurar um backup em um banco de ensaio e conferir as contagens; publicar uma mudança trivial e revertê-la pelo Coolify em menos de dois minutos.
