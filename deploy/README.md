# Implantação e operação

O jogo roda em um servidor com [Coolify](https://coolify.io), em três recursos ([ADR 0009](../docs/decisions/0009-implantacao-no-coolify.md)). O app e a API dividem o mesmo domínio: não há CORS.

| Recurso      | O que é                                                    | Rota pública          |
| ------------ | ---------------------------------------------------------- | --------------------- |
| `lotg-db`    | PostgreSQL 16, volume persistente, sem porta publicada     | nenhuma               |
| `lotg-api`   | `deploy/Dockerfile`, alvo `runtime`, porta 3000            | `https://<domínio>/v1` |
| `lotg-web`   | `deploy/Dockerfile`, alvo `web` (Caddy servindo o app), 80 | `https://<domínio>`   |

O proxy do Coolify (Traefik) emite o certificado, redireciona HTTP para HTTPS e separa as rotas pelo caminho. A API aplica as migrações de `deploy/migrations` ao subir.

Arquivos desta pasta:

- `Dockerfile` e `Dockerfile.dockerignore`: as duas imagens. O contexto de build é a raiz do repositório.
- `web.Caddyfile`: o servidor de arquivos da imagem `web` e os cabeçalhos de segurança do app.
- `migrations/`: SQL gerado pelo drizzle-kit.
- `ensaio-restauracao.yml`: o serviço que ensaia a restauração de um backup.
- `analytics/ops.sql`: consultas de operação.
- `docker-compose.dev.yml` e `.env.example`: desenvolvimento local.

## Instalação atual

| Item                 | Valor                                                             |
| -------------------- | ----------------------------------------------------------------- |
| Endereço do jogo     | `https://lords.palsincomehub.com`                                 |
| Painel do Coolify    | `https://app.palsincomehub.com` (Coolify 4.3)                     |
| Projeto e ambiente   | "Lords of the Guild", `production`                                |
| Servidor             | `localhost` (o mesmo em que o Coolify roda)                       |
| Origem do código     | `https://github.com/gustavopals/pals-vscode-game`, branch `main` |
| No ar desde          | 2026-10-01                                                        |

## Implantar do zero

Os dez passos, para refazer a instalação em outro servidor com Coolify.

1. **DNS.** Um registro A do domínio para o IP do servidor.
2. **Projeto.** Criar o projeto e usar o ambiente `production`.
3. **Banco.** Novo recurso PostgreSQL, imagem `postgres:16`, usuário e banco `lotg`, senha gerada, **sem** "Make it publicly available". Iniciar e copiar a URL interna.
4. **API.** Novo recurso a partir do repositório público, branch `main`, build pack "Dockerfile", diretório base `/`, Dockerfile em `/deploy/Dockerfile`, alvo de build `runtime`, porta `3000`, domínio `https://<domínio>/v1`.
5. **Rota da API.** Em "Advanced", desligar **Strip Prefixes**: a API espera receber `/v1/...` inteiro. Desligar também o **health check do Coolify**: ele precisa de `curl` ou `wget` dentro da imagem, que não tem nenhum dos dois. Fica valendo o `HEALTHCHECK` do `Dockerfile`.
6. **Variáveis da API.** As da seção "Produção" de [`.env.example`](.env.example). `GAME_TIME_SCALE`, o ritmo das partidas novas (ADR 0011), não está nessa lista e não precisa ser definida: sem ela vale o padrão 3. Aceita de 0,5 a 10 e não muda as partidas que já existem. `JWT_SECRET` e `RECOVERY_CODE_SECRET` saem de duas execuções de `openssl rand -base64 48`.
7. **Cópia da chave de recuperação.** Guardar `RECOVERY_CODE_SECRET` fora do Coolify, junto aos segredos operacionais. Nunca gerar outra para um ambiente que já emitiu Códigos do Reino: todos deixariam de valer.
8. **App.** Outro recurso do mesmo repositório, alvo de build `web`, porta `80`, domínio `https://<domínio>`, sem variáveis e com o health check do Coolify desligado.
9. **Deploy e conferência.** Fazer o deploy dos dois e conferir:

   ```bash
   curl -s https://<domínio>/v1/health && curl -s https://<domínio>/v1/version
   ```

   Abrir o domínio em um navegador limpo, clicar em **Jogar agora** e ver Pedra Alta.

10. **Backup e avisos.** Agendar o backup do banco (seção "Backup e restauração") e ligar um canal de notificação do Coolify (seção "Operação").

Pela API do Coolify (`/api/v1`), o alvo de build só é aceito em um `PATCH` depois da criação, e a remoção de prefixo é o campo `is_stripprefix_enabled`.

O vínculo com o GitHub fica desligado enquanto `GITHUB_CLIENT_ID` estiver vazio. Para ligar: registrar um OAuth App no GitHub com "Device Flow" habilitado, pôr o identificador na variável e fazer o deploy da API. `GET /v1/version` passa a responder `features.githubDevice: true`.

## Atualizar e reverter

**Atualizar.** Com o `main` verde, fazer o deploy de `lotg-api` e de `lotg-web` (botão "Deploy", API ou MCP do Coolify). Não há webhook: nada é implantado sozinho a cada `push`. A troca é por substituição do contêiner depois que o novo passa no health check; conferir `GET /v1/version` (`builtAt` muda).

Quando a mudança toca o protocolo, implantar a API antes do app.

**Reverter.** Na aplicação, aba "Rollback", escolher a imagem do deploy anterior; ou, pela API:

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  https://app.palsincomehub.com/api/v1/applications/<uuid>/rollback -d '{"commit":"<sha do deploy anterior>"}'
```

O Coolify guarda as duas últimas imagens de cada aplicação, com o SHA do commit como tag (`GET /applications/<uuid>/rollback-images`). Reverter não desfaz migrações.

**Regra das migrações.** Toda migração precisa funcionar com a versão anterior da API: primeiro expandir (coluna ou tabela nova, sem remover nada), publicar, e só em uma versão seguinte contrair. É isso que deixa a reversão segura.

### Ensaios de reversão

| Data       | O que foi feito                                                                                                    | Tempo | Resultado |
| ---------- | ------------------------------------------------------------------------------------------------------------------ | ----- | --------- |
| 2026-10-01 | `lotg-api` de `42d9256` para a imagem de `1ef9545` pela API de rollback; `/v1/version` voltou a responder sem `features` | 38 s  | sem erro em `/v1/health` durante a troca; contas e partidas intactas |
| 2026-10-01 | Volta para `42d9256` por um deploy normal (a imagem já existia)                                                    | 20 s  | `features.githubDevice` de volta em `/v1/version` |

Os dois commits usam a mesma migração (`0000_init`); a reversão ainda não foi ensaiada atravessando uma migração.

## Backup e restauração

**Backup.** Agendado no Coolify, na página do `lotg-db`, aba "Backups": `pg_dump` em formato custom todo dia às 03:00 UTC, retenção de 14 dias. Os arquivos ficam no servidor, em `/data/coolify/backups/databases/<time>/lotg-db-<uuid>/`. Falha de backup gera aviso pelos canais de notificação do Coolify.

Os backups estão **no mesmo disco do banco**. Para sobreviver à perda do servidor, cadastrar um armazenamento S3 no Coolify e marcá-lo no agendamento.

**Restaurar em produção.** Parar `lotg-api`; na página do `lotg-db`, "Import Backup", apontar o arquivo `.dmp` do servidor e usar o comando `pg_restore --clean --if-exists --no-owner -U lotg -d lotg`; iniciar `lotg-api`; conferir `/v1/health` e as contagens de `analytics/ops.sql`. A variável `RECOVERY_CODE_SECRET` precisa ser a mesma de quando o backup foi feito.

**Ensaiar.** O ensaio usa um banco descartável e nunca toca o de produção:

1. Criar o ambiente `ensaio` no projeto e, nele, um PostgreSQL 16 `lotg-db-ensaio` (usuário e banco `lotg`).
2. Criar no mesmo ambiente um recurso "Docker Compose" com [`ensaio-restauracao.yml`](ensaio-restauracao.yml) e definir `TARGET_URL` com a URL interna do banco de ensaio.
3. Iniciar o serviço e ler os logs do contêiner `restore`: as linhas `ENSAIO` mostram as contagens depois de restaurar, depois de apagar uma conta e depois de restaurar de novo.
4. Apagar o serviço e o banco de ensaio.

### Ensaios de restauração

| Data       | Backup                                        | Resultado |
| ---------- | --------------------------------------------- | --------- |
| 2026-10-01 | `pg-dump-lotg-1790875348.dmp` (20.683 bytes) | restaurado: 2 contas, 2 partidas; uma conta apagada: 1 e 1; restaurado de novo: 2 e 2; saída com código 0 |

O ensaio foi feito com as 2 contas que existiam em produção, não com as 3 que o roteiro original pedia.

## Operação

**Saúde.** `GET /v1/health` responde `{"status":"ok","db":"ok"}`. O workflow [`health.yml`](../.github/workflows/health.yml) consulta a API e o app de fora do servidor a cada 5 a 15 minutos; quando falha, o GitHub avisa por e-mail quem tem as notificações de Actions ligadas no repositório.

**Avisos do Coolify.** Em "Notifications", ligar um canal (e-mail, Telegram, Discord…). Já estão marcados para avisar: falha de deploy, falha de backup, contêiner que reinicia em excesso, servidor inalcançável e disco acima de 80% (conferido todo dia às 23:00 UTC). Sem um canal ligado, nenhum desses avisos sai.

**Disco.** O Coolify limpa imagens e contêineres sem uso todo dia à meia-noite UTC.

**Logs.** Na página de cada recurso, aba "Logs". A API escreve JSON (pino), uma linha por requisição; tokens e códigos nunca são registrados.

**`psql`.** Na página do `lotg-db`, aba "Terminal":

```bash
psql -U lotg lotg
```

As consultas de [`analytics/ops.sql`](analytics/ops.sql) dão contas por dia, jogadores ativos, partidas por situação, atraso do job de avanço, comandos por hora (aceitos e recusados) e tamanho do banco. O fim do arquivo traz as métricas do playtest (F5-T2.2): sessões por dia, comandos por sessão, tempo até o primeiro comando e retorno no dia 2. Como as leituras não ficam gravadas, uma sessão ali é uma sequência de comandos da mesma partida sem intervalo maior que 30 minutos; as contas de bot ficam de fora e há uma linha comentada para tirar a conta do autor. Todas são agregadas.

**Segredos.** Ficam só no Coolify. Trocar `JWT_SECRET` derruba as sessões abertas e nada mais. Trocar `PUBLIC_URL` também: ela é o emissor dos tokens. `RECOVERY_CODE_SECRET` não se troca.

**Teste de alerta.** Parar `lotg-api` por alguns minutos deve fazer o workflow de saúde falhar e o GitHub enviar o e-mail; ao iniciar de novo, a execução seguinte volta a passar.

| Data       | O que foi feito                                                                 | Resultado |
| ---------- | ------------------------------------------------------------------------------- | --------- |
| 2026-10-01 | `lotg-api` parada por cerca de 2 minutos (17:36 a 17:38 UTC), com o workflow disparado à mão antes, durante e depois | passou, falhou (`/v1/health` respondeu 404, vindo do app) e passou de novo; a chegada do e-mail do GitHub não foi conferida |
