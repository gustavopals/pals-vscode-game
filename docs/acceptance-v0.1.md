# Aceitação da v0.1

Quadro dos 12 critérios de aceitação do GDD §16.1 ([GAME_DESIGN.md](../GAME_DESIGN.md)), para a tarefa F5-T1 do [roadmap](../MVP-ROADMAP.md). Para cada critério: a prova automática, a prova exigida em produção e a evidência que existe hoje. O passo a passo das provas manuais está em [manual-test-v0.1.md](manual-test-v0.1.md).

> **Estado em 2026-10-01.** As provas automáticas existem e a CI está verde no `main`. **Nenhum critério tem ainda a prova em produção registrada**: o autor jogou em produção, em Chromium, sem anotar evidência por critério. Nenhuma linha deste quadro está aprovada.

## Decisões que alteram a leitura dos critérios

- **Critério 10 fecha pelo Código do Reino.** O critério diz "vincular ao GitHub **ou** usar o Código do Reino". Por decisão do autor (2026-10-01), o vínculo GitHub fica desligado na v0.1: o código do *device flow* continua no repositório, testado só com um GitHub simulado, e em produção `features.githubDevice` é `false` ([ADR 0008](decisions/0008-cliente-web-com-aparencia-de-editor.md), ponto 2; [ADR 0010](decisions/0010-version-informa-o-que-esta-ligado.md)). O GitHub real nunca foi exercitado e não entra na aceitação.
- **O ritmo 3× muda os tempos.** As partidas novas andam três vezes mais rápido que os números do GDD ([ADR 0011](decisions/0011-ritmo-3x-no-mvp.md)): "conclui no tempo configurado" (critério 4) quer dizer o tempo **real** que o app anuncia (a melhoria das Habitações leva 1 min 20 s, não 4 min), e a fome sem fazendeiros começa em 12 h reais, não em 36 (critério 6). As provas automáticas em navegador e os cenários de integração rodam no ritmo 1; a conversão para tempo real tem testes próprios no servidor (`packages/server/test/pace.test.ts`). As partidas criadas antes do ritmo 3× continuam no ritmo 1: as provas em produção usam uma partida nova.
- **Critério 7 pelo Coolify.** "Reiniciar o servidor" é reiniciar o recurso `lotg-api` no Coolify, e não `docker compose restart` ([ADR 0009](decisions/0009-implantacao-no-coolify.md)).
- **`pnpm test:e2e` não roda contra a produção.** Depende das rotas `/__test` e do relógio adiantável de `tests/e2e/server.ts`. A prova automática é a CI no commit implantado; a prova em produção é manual, mais a fumaça `pnpm -s sim -- --smoke <url>` (MVP-ROADMAP.md, F5-T1).

## Evidência geral

### CI (GitHub Actions)

Conferido com `gh run list` e `gh run view` em 2026-10-01. Os quatro jobs (`verify`, `integration`, `e2e`, `docker`) terminaram com sucesso em:

| Commit | Execução |
|---|---|
| `42d9256` (F3W-T10) | <https://github.com/gustavopals/pals-vscode-game/actions/runs/36898335032> |
| `d7029dd` | <https://github.com/gustavopals/pals-vscode-game/actions/runs/36900339520> |
| `79fe1da` (último commit do `main`) | <https://github.com/gustavopals/pals-vscode-game/actions/runs/36901009585> |

Os ajustes de fechamento de 2026-10-01 (ritmo 3×, Crônica sem viradas de dia, `housed` e `vacancies`, lembrete por tempo real) **ainda não estavam commitados** quando este quadro foi escrito: a CI acima não os cobre.

- CI verde no commit `1b4e6db` (que inclui os ajustes de fechamento), em 2026-10-01: `verify`, `integration`, `e2e` e `docker`, todos com sucesso: <https://github.com/gustavopals/pals-vscode-game/actions/runs/36905622257>.
- **API implantada com os ajustes**: `/v1/version` em produção respondeu `builtAt` 2026-10-01T18:29:52Z, posterior ao commit.
- **App web ainda no build anterior** em 2026-10-01 às 18:35 UTC: `last-modified` de `/` é 17:35:17 GMT e o pacote servido ainda traz os textos antigos. ☐ por fazer (autor): implantar `lotg-web` e conferir de novo.

### Conferências feitas em produção em 2026-10-01, depois do deploy da API

- **Ritmo 3× (ADR 0011)**: uma partida criada pela API veio com `timeScale: 3`; a visão trouxe o próximo dia em 2.400 s, a melhoria das Habitações em 80 s, um aldeão em 400 s e a explicação "consumo 5 × 3 = 15/h". A conta usada foi excluída em seguida (resposta 202).
- **Concorrência e idempotência (critério 7)**: `pnpm -s sim -- --smoke https://lords.palsincomehub.com` passou nas 4 verificações: 10 ordens em paralelo com estado coerente (7 aceitas, 3 recusadas pelo motor), reenvio com o mesmo recibo, `409 COMMAND_ID_CONFLICT` para o mesmo UUID com outro conteúdo e a mesma recusa no reenvio de uma ordem recusada. A conta criada foi excluída.
- **Carga pequena**: 5 bots por 2 minutos, ciclo de 5 s: 122 ciclos, 25 comandos aceitos, nenhum erro. p95 de 142 ms em `GET /view` e `GET /events` e de 174 ms em `POST /commands` (máximo de 453 ms, na criação de partida). As cinco contas "Bot N" foram excluídas pelos próprios bots.
- As sete contas criadas nessas conferências ficam bloqueadas e saem do banco no expurgo de sete dias (2026-10-08).

### Suítes locais

Rodadas em 2026-10-01, na árvore com os ajustes de fechamento (ritmo 3×, Crônica sem viradas de dia e os demais), antes do commit:

- `pnpm verify` (lint, tipos e testes de unidade): 42 arquivos, 1.141 testes, todos passam.
- `pnpm test:integration` (API e PostgreSQL de teste): 11 arquivos, 305 testes, todos passam, inclusive `packages/server/test/pace.test.ts` (ritmo).
- `pnpm test:e2e` (Chromium, app compilado e API real, no ritmo 1): 48 testes, todos passam.

Isso prova o código, não a produção: no instante da consulta abaixo, a produção ainda rodava o build anterior aos ajustes.

- ☐ por fazer (autor): depois do deploy, conferir que `builtAt` em `/v1/version` é posterior ao commit dos ajustes.

### Produção

Consultas feitas em 2026-10-01 às 17:58 UTC:

```console
$ curl -s https://lords.palsincomehub.com/v1/health
{"status":"ok","db":"ok"}                                                    (HTTP 200)
$ curl -s https://lords.palsincomehub.com/v1/version
{"server":"0.1.0","protocol":1,"contentHash":"a99e1d84b4b2090e","builtAt":"2026-10-01T17:35:10.910Z","features":{"githubDevice":false}}   (HTTP 200)
$ curl -s -o /dev/null -w '%{http_code}' https://lords.palsincomehub.com/
200
```

O que isso prova: a API e o banco respondem em HTTPS, o app é servido e o vínculo GitHub está desligado. O que **não** prova: qual commit está implantado (a resposta não traz o SHA; `builtAt` é anterior ao commit `79fe1da` e aos ajustes de fechamento, então o ritmo 3× **não estava em produção** nessa hora).

Outras evidências já registradas: a conferência de F4-T1 (**Jogar agora** até Pedra Alta em Chromium, cabeçalhos e CSP) e os ensaios de restauração e de reversão, em [deploy/README.md](../deploy/README.md).

## Quadro

Legenda da evidência: **CI** = coberto pelas execuções da tabela acima; ☐ = por fazer.

| # | Critério (resumo) | Prova automática | Prova em produção exigida | Evidência |
|---|---|---|---|---|
| 1 | Abrir, **Jogar agora** e primeiro comando em menos de 30 s, sem instalar nada | `tests/e2e/01-entrada.spec.ts`: "\"Jogar agora\": dois campos, um clique, e o primeiro comando em menos de 30 s". `tests/server/scenarios.test.ts`: "conta, partida, seis comandos e a visão do feudo crescendo" | Cronometrar, em Chromium e em Firefox, do endereço digitado ao primeiro `+` | CI. F4-T1: Jogar agora chegou a Pedra Alta em 2 s em Chromium (sem o primeiro comando). ☐ por fazer (autor): os dois tempos medidos, com data e navegador |
| 2 | Um trabalhador a mais na Serraria muda a taxa na hora e reduz os livres | `packages/engine/src/population.test.ts`: "um trabalhador a mais na Serraria muda a taxa na hora e reduz os livres". `tests/e2e/02-feudo.spec.ts`: "+ na Serraria pelo painel muda a taxa de madeira e reduz os livres em menos de 1 s" | Fazer o mesmo em produção e ler a taxa por hora real e os livres | CI. ☐ por fazer (autor): taxa antes e depois, livres antes e depois |
| 3 | Não alocar além da população nem gastar o que não existe; motivo visível | `population.test.ts`: "não aloca mais que a população". `packages/engine/src/construction.test.ts`: "recusa sem recursos e diz quanto falta". `02-feudo.spec.ts`: "recusas do servidor aparecem com o motivo em português" e "alocar pela paleta mostra a taxa resultante e barra o que passa da população" | Provocar as três recusas (população, recursos, fila ocupada) e ler as frases | CI. ☐ por fazer (autor): as três frases, copiadas da tela |
| 4 | Melhoria desconta uma vez, ocupa a fila e conclui no tempo | `construction.test.ts`: "desconta o custo uma única vez, ocupa a fila e registra o fim". `02-feudo.spec.ts`: "uma melhoria desconta uma vez, ocupa a fila e termina sozinha no tempo certo" | Melhorar as Habitações em uma partida nova e cronometrar até a conclusão | CI (no ritmo 1). ☐ por fazer (autor): recursos antes e depois, tempo anunciado e tempo medido |
| 5 | Fechar por horas e reabrir mostra o intervalo simulado, sem duplicar; `advanceTo` por partes ≡ de uma vez | `packages/engine/src/economy.property.test.ts`: "advanceTo(t3) é idêntico a advanceTo(t2) seguido de advanceTo(t3)". `packages/server/test/games.test.ts`: "fechar por horas e reabrir mostra o intervalo simulado, sem duplicar progresso". `tests/e2e/03-retorno-e-conexao.spec.ts`: "depois de 5 horas: abre em Hoje, com o Relatório de Retorno e o que mudou" | Fechar a aba por mais de 4 h, reabrir, recarregar | CI. ☐ por fazer (autor): horário de saída e de volta, recursos nos dois momentos e depois de recarregar |
| 6 | Escassez correta em longos períodos, com o instante na Crônica | `packages/engine/src/famine.test.ts`: "30 dias fora com consumo maior que a produção: a fome começa no instante previsto". `packages/engine/src/advance.test.ts`: "30 dias de uma vez produzem os mesmos eventos e o mesmo estado que 720 passos de 1 h". `tests/e2e/06-avisos-e-preferencias.spec.ts`: "a fome avisa mesmo no nível padrão, e toma a barra de status" | Partida nova sem ninguém na Fazenda; voltar depois de 12 h | CI. ☐ por fazer (autor): a linha da Crônica com o início da fome e a hora real em que a partida foi criada |
| 7 | Reinício não perde nem duplica; reenvio devolve o recibo; UUID conflitante recusado; avanço preservado em recusa; dois clientes não corrompem | `games.test.ts`: "(b) depois de reiniciar o servidor, o recibo continua valendo", "reenvio do mesmo commandId e payload devolve status e corpo originais com X-Lords-Replayed", "mesmo UUID com payload ou tipo diferente: 409 COMMAND_ID_CONFLICT sem alterar o recibo", "conclusão da obra e produção persistem; a recusa não desconta nada; eventos aparecem uma vez", "10 comandos em paralelo: cada um aplicado uma vez, seq 1..10, estado igual ao sequencial". `scenarios.test.ts`: "não perde nem duplica nada, e o mundo andou enquanto ele esteve fora" e "sessões distintas, comandos intercalados e visões sempre iguais" | Reiniciar `lotg-api` no Coolify com uma obra em andamento e a aba aberta. Fumaça: `pnpm -s sim -- --smoke https://lords.palsincomehub.com` | CI. ☐ por fazer (autor): hora do reinício, hora anunciada e hora real do fim da obra, Crônica sem linha repetida. ☐ por fazer: saída da fumaça, com data |
| 8 | Todas as regras rodam em testes sem navegador nem servidor | `pnpm --filter @lotg/engine test`; `packages/engine/src/purity.test.ts`: "o motor só importa @lotg/content e os próprios módulos" | Nenhuma: o critério não depende da produção | CI (job `verify`) |
| 9 | Temas claro, escuro e alto contraste; navegável por teclado, inclusive a paleta | `tests/e2e/05-teclado-e-temas.spec.ts`: "escuro, claro e alto contraste: capturas, contraste e rótulos nas telas principais", "uma partida inteira dos objetivos 1 a 4 só com o teclado", "abas: setas trocam de aba; a paleta abre com F1 e Ctrl+K, filtra, e Esc devolve o foco" | Trocar os três temas e jogar cinco minutos só pelo teclado, em Chromium e em Firefox | CI (só Chromium). ☐ por fazer (autor): o que foi feito em cada navegador e o que destoou |
| 10 | Código do Reino em outra máquina mostra o mesmo feudo em segundos (GitHub desligado na v0.1) | `tests/e2e/04-conta.spec.ts`: "gerar em um navegador e entrar em outro mostra o mesmo feudo". `scenarios.test.ts`: "o Código do Reino abre o mesmo feudo em outra máquina, em segundos". GitHub, só simulado: "vincular a conta e, em outro navegador, entrar com o mesmo GitHub mostra o mesmo feudo" | Gerar o código em Chromium e entrar em Firefox | CI. Produção em 2026-10-01: `features.githubDevice` é `false`. ☐ por fazer (autor): nome do feudo e recursos vistos nos dois navegadores (nunca o código) |
| 11 | Sem conexão: último estado, explicação e volta sozinho | `03-retorno-e-conexao.spec.ts`: "mostra o último estado, explica, não envia nem guarda ordens e volta sozinho" e "abrir a página com o servidor fora mostra o estado guardado, com a explicação" | Desligar a rede por um minuto e religar | CI. ☐ por fazer (autor): o texto do aviso e quanto tempo levou para voltar |
| 12 | Excluir bloqueia na hora por todas as credenciais e limpa as abas; expurgo depois de sete dias | `04-conta.spec.ts`: "pede confirmação e o nome do feudo, explica os prazos, bloqueia na hora e limpa as abas". `packages/server/test/jobs.test.ts`: "nega o acesso na hora, mas os registros internos continuam no banco" e "antes de sete dias nada é removido; exatamente no prazo, some das sete tabelas". `scenarios.test.ts`: "bloqueia na hora por todas as credenciais e some do banco depois de sete dias" | Excluir uma conta de teste aberta em duas abas; tentar entrar com o Código do Reino dela | CI. ☐ por fazer (autor): data e hora da exclusão, as duas abas nas boas-vindas, o código recusado. O expurgo de sete dias em produção só pode ser conferido sete dias depois (contagens de `deploy/analytics/ops.sql`) |

## Pendências para fechar

1. Commitar os ajustes de fechamento, esperar a CI verde e fazer o deploy de `lotg-api` e de `lotg-web`; conferir `builtAt` em `/v1/version` e anotar o SHA.
2. Executar a coluna "Manual" de [manual-test-v0.1.md](manual-test-v0.1.md) em produção, em Chromium e em Firefox, em uma partida nova, e preencher a coluna "Evidência" acima.
3. Rodar a fumaça `pnpm -s sim -- --smoke https://lords.palsincomehub.com` e colar a saída.
4. Medir a carga pequena de F5-T1.2 (por exemplo `pnpm -s sim -- --remote https://lords.palsincomehub.com --bots 5 --minutes 2 --poll-ms 5000`), registrar o p95 e excluir as contas "Bot N" que ela cria.
5. Critério 12: voltar sete dias depois da exclusão de teste e conferir o expurgo.
6. Qualquer critério que falhar vira item P0 em F5-T3.

Pendências da Fase 4 que não bloqueiam os critérios, mas seguem abertas (todas do autor): cópia de `RECOVERY_CODE_SECRET` fora do Coolify, destino S3 para os backups, canal de notificação do Coolify e a confirmação de que o e-mail de alerta do GitHub chega.
