# Retomada da v0.3: onde a execução está

> Escrito em 2026-10-07, quando a execução foi interrompida, e **reescrito em 2026-10-15**, depois da retomada. Apague-o quando a versão fechar (a tag `v0.3.0`).

## O que está onde

| O quê | Onde | Estado |
|---|---|---|
| Produção | `origin/main` = `7bff36b` (v0.2.0, estado 12, protocolo 2) | No ar. Nada da v0.3 foi publicado |
| A v0.3 inteira, menos o lote 2 do Conselho | `main` local | **Pronta para publicar**: o portão inteiro verde no commit candidato `3cb6e01` em 2026-10-15 (Registro do [roadmap](roadmap-v0.3.md), §12, linha "Retomada"); depois dele, só documentos |
| Lote 2 do Conselho (V3F-T1), pela metade | branch `wip/v3f-t1-lote2` = `2352e39` | **Fora da v0.3.0** (pendência F-3). Não verde, nenhum teste rodado. Não juntar sem revisar |

Estado do jogo na versão **24**; protocolo **3**.

## O que a retomada fez (2026-10-15)

1. Rodou o portão no `4db6de1`: 24 testes vermelhos (22 do simulador, que esperavam dez objetivos; 1 de integração; 1 em navegador). Todos corrigidos; a matriz foi remedida nas três dificuldades ([balance-v0.3.md](balance-v0.3.md), seção 15).
2. Deixou o lote 2 fora da v0.3.0 (F-3): as 24 cartas pedem a aprovação do autor em lotes de cinco.
3. Fez a revisão independente da Fase F (V3F-T4) sobre os objetivos e o Retorno: seis achados corrigidos, três registrados (F-4 a F-6).
4. Fechou os documentos: o Registro de V3E-T5 a V3G-T5, as caixas, `CLAUDE.md`, o quadro de aceitação (nomes de teste reconferidos), o README da página, `docs/architecture.md` reescrito para a v0.3 e a nota de publicação em `deploy/README.md`.
5. Rodou o portão inteiro no commit candidato e construiu as três imagens.

## O que falta, e é do autor

1. **Publicar:**
   - Disparar o backup manual do `lotg-db` (aba "Backups" no Coolify), esperar terminar e anotar o nome do arquivo.
   - Rodar `git push origin main`: o CI testa e implanta sozinho.
   - Depois, conferir `GET /v1/version` (`protocol` 3), esperar pouco mais de uma hora e conferir `schema_version = 24` ([deploy/README.md](../deploy/README.md), "A primeira publicação da v0.3").
   - Publicar só até a Fase D continua possível: `git push origin 27fceb5:main`.
2. **Responder às pendências novas:** F-1 a F-6 ([pendencias-v0.3.md](pendencias-v0.3.md), "Fase F").
3. **Sem data:**
   - jogar as fases (roteiros em [pendencias-v0.3.md](pendencias-v0.3.md), seções 7 e 8, e [manual-test-v0.3.md](manual-test-v0.3.md));
   - ler o conteúdo, que é todo rascunho ([content-v0.3.md](content-v0.3.md));
   - fazer o playtest ([playtest/convite-v0.3.md](playtest/convite-v0.3.md));
   - preencher a evidência manual de [acceptance-v0.3.md](acceptance-v0.3.md);
   - criar a tag `v0.3.0`;
   - fazer o ato 23 (backup fora do servidor, cópia do `RECOVERY_CODE_SECRET`, ensaio de reversão).

## O que a versão sabidamente não cumpre

- **"Ouro com destino"** (pendência C-23, critério do roadmap §8.3): o soldo por nível baixou o ouro parado em menos de 0,5%, e os objetivos não o mexeram (seção 15). Vira a primeira pergunta de [roadmap-v0.4.md](roadmap-v0.4.md).
- **Nenhuma pessoa jogou a v0.3**, e nenhuma partida de produção passou pela migração do estado 12 para o 24.
- O lote 2 do Conselho (45 das 60 cartas previstas) e os Mestres Gil e Ximena, que só chegam por carta.
- Decisões dos agentes ainda não confirmadas pelo autor:
  - a tabela do soldo por nível (2, 3, 4, 6, 8, 10, 12, 15, 18, 20);
  - as marcas de preço da Crônica (85% e 115%);
  - o objetivo 12, que manda erguer a Guilda (F-1).

## Limpeza

Sobraram árvores de trabalho de agentes, todas já juntadas ou superadas:

- `.claude/worktrees/agent-*` (quatro);
- uma em `/tmp/.../scratchpad/e2e-tree` (branch `e2e-fixes`);
- a cópia de comparação da retomada, no scratchpad da sessão de 2026-10-15 (`antes`, destacada em `4e6ea0c`).

Para remover: `git worktree remove <caminho>` (ou `git worktree prune` para as que sumiram), depois apagar os branches `worktree-agent-*` e `e2e-fixes`. O banco `lotg_test_e2e` no contêiner `lotg-db-test` também é descartável.

Em produção, `RATE_LIMIT_PER_MINUTE` do `lotg-api` foi de 60 para 600 em 2026-10-06, a pedido do autor.
