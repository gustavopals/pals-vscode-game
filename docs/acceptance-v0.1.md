# Aceitação da v0.1

Quadro dos 12 critérios de aceitação do GDD §16.1 ([GAME_DESIGN.md](../GAME_DESIGN.md)), para a tarefa F5-T1 do [roadmap](../MVP-ROADMAP.md). Para cada critério: a prova automática, o que foi conferido em produção, o veredito e o que ficou sem verificar. O passo a passo das provas manuais está em [manual-test-v0.1.md](manual-test-v0.1.md).

> **Estado em 2026-10-01: v0.1 fechada.** O autor jogou em produção, em dois navegadores, gostou e decidiu fechar o MVP; ele não avaliou os critérios um a um nem registrou evidência por critério. Os 12 critérios são dados como aceitos por essa decisão. As provas automáticas existem e a CI está verde no commit implantado. O que ninguém verificou está listado em "Fechamento" e, critério a critério, no quadro.

## Fechamento

**Decisão do autor (Gustavo Pals), em 2026-10-01:** fechar o MVP. Ele jogou a v0.1 em produção (`https://lords.palsincomehub.com`), disse que testou bem o jogo e gostou, e informou que testou em dois navegadores. Ele não disse quais navegadores (o roteiro pedia Chromium e Firefox) e não entregou evidência escrita por critério: este documento não sabe o que foi feito em cada um.

O que sustenta cada aprovação:

1. **Prova automática**: os testes citados no quadro, com a CI verde no commit implantado (abaixo).
2. **Conferências em produção já registradas**: ritmo 3× em partida nova, fumaça de concorrência 4 de 4, carga pequena de 5 bots por 2 minutos sem erro, app aberto em Chromium sem interface sem erro no console.
3. **Aceito pelo fechamento**: em 2026-10-01 o autor jogou em produção em dois navegadores, não relatou falha e decidiu fechar a v0.1, sem avaliar os critérios um a um e sem evidência escrita por critério. No quadro, "Aceito pelo fechamento" quer dizer exatamente isto.

O autor não relatou falha em nenhum critério: F5-T1.3 não gerou item P0.

**Divergência aceita do roadmap:** o playtest de 48 horas com 3 a 5 pessoas (F5-T2) **não foi feito**. Por decisão do autor, a v0.1 fecha com o playtest do próprio autor, e o playtest com outras pessoas passa a ser a primeira tarefa da v0.2 ([roadmap-v0.2.md](roadmap-v0.2.md)).

**Versão:** tag `v0.1.0` e release no GitHub, criadas depois deste registro: <https://github.com/gustavopals/pals-vscode-game/releases/tag/v0.1.0>. O commit que traz este registro (só documentação) é posterior a `d9e014b`; a CI dele não está anotada aqui.

### O que a v0.1 não verificou

- **Evidência por critério em produção.** A coluna "Manual" do roteiro não tem registro passo a passo: nem tempos medidos, nem textos copiados da tela, nem o que foi feito em cada navegador.
- **Quais navegadores.** Os testes automáticos rodam só em Chromium. O autor jogou em dois navegadores, sem dizer quais: Firefox não está confirmado. Safari e navegadores de celular não foram abertos.
- **Leitor de tela.** Ninguém usou. Os papéis e rótulos ARIA são conferidos por teste; a experiência de ouvi-los, não.
- **Reinício da API com a aba aberta (critério 7).** Ninguém reiniciou `lotg-api` com uma obra em andamento para conferir o fim da obra e a Crônica.
- **Fome depois de um período longo de tempo real (critério 6)** e **ausência de mais de 4 horas (critério 5)** em produção: sem registro.
- **Expurgo de sete dias em produção (critério 12).** As primeiras contas excluídas completam o prazo em 2026-10-08.
- **Código do Reino entre dois navegadores, modo sem conexão e exclusão com duas abas**, em produção: sem registro.
- **Playtest com outras pessoas.** Não realizado; passou para a v0.2.
- **GitHub real.** O vínculo está desligado e só foi testado com um GitHub simulado.
- **`pnpm test:e2e` contra a produção.** Não roda lá, por construção.
- **Carga em produção acima de 5 bots.** A medição com 50 bots é local ([perf-v0.1.md](perf-v0.1.md)).

## Decisões que alteram a leitura dos critérios

- **Critério 10 fecha pelo Código do Reino.** O critério diz "vincular ao GitHub **ou** usar o Código do Reino". Por decisão do autor (2026-10-01), o vínculo GitHub fica desligado na v0.1: o código do *device flow* continua no repositório, testado só com um GitHub simulado, e em produção `features.githubDevice` é `false` ([ADR 0008](decisions/0008-cliente-web-com-aparencia-de-editor.md), ponto 2; [ADR 0010](decisions/0010-version-informa-o-que-esta-ligado.md)). O GitHub real nunca foi exercitado e não entra na aceitação.
- **O ritmo 3× muda os tempos.** As partidas novas andam três vezes mais rápido que os números do GDD ([ADR 0011](decisions/0011-ritmo-3x-no-mvp.md)): "conclui no tempo configurado" (critério 4) quer dizer o tempo **real** que o app anuncia (a melhoria das Habitações leva 1 min 20 s, não 4 min), e a fome sem fazendeiros começa em 12 h reais, não em 36 (critério 6). As provas automáticas em navegador e os cenários de integração rodam no ritmo 1; a conversão para tempo real tem testes próprios no servidor (`packages/server/test/pace.test.ts`). As partidas criadas antes do ritmo 3× continuam no ritmo 1: as provas em produção usam uma partida nova.
- **Critério 7 pelo Coolify.** "Reiniciar o servidor" é reiniciar o recurso `lotg-api` no Coolify, e não `docker compose restart` ([ADR 0009](decisions/0009-implantacao-no-coolify.md)).
- **`pnpm test:e2e` não roda contra a produção.** Depende das rotas `/__test` e do relógio adiantável de `tests/e2e/server.ts`. A prova automática é a CI no commit implantado; a prova em produção é manual, mais a fumaça `pnpm -s sim -- --smoke <url>` (MVP-ROADMAP.md, F5-T1).

## Evidência geral

### CI (GitHub Actions)

Conferido com `gh run list` e `gh run view` em 2026-10-01.

| Commit | Jobs com sucesso | Execução |
|---|---|---|
| `42d9256` (F3W-T10) | `verify`, `integration`, `e2e`, `docker` | <https://github.com/gustavopals/pals-vscode-game/actions/runs/36898335032> |
| `d7029dd` | os mesmos quatro | <https://github.com/gustavopals/pals-vscode-game/actions/runs/36900339520> |
| `79fe1da` | os mesmos quatro | <https://github.com/gustavopals/pals-vscode-game/actions/runs/36901009585> |
| `1b4e6db` (inclui os ajustes de fechamento: ritmo 3×, Crônica sem viradas de dia, `housed` e `vacancies`, lembrete por tempo real) | os mesmos quatro | <https://github.com/gustavopals/pals-vscode-game/actions/runs/36905622257> |
| `d9e014b` (inclui o deploy automático e a página de apresentação) | `verify`, `integration`, `e2e`, `landing`, `docker` e `deploy` | <https://github.com/gustavopals/pals-vscode-game/actions/runs/36909632071> |

A execução do commit `c49dedf` foi cancelada (o push seguinte veio 40 segundos depois); a do commit seguinte, `bc807cd`, passou.

### O que está implantado

Consultas feitas em 2026-10-01, depois da execução de `d9e014b`, cujo job `deploy` implantou a API, o app e a página de apresentação:

```console
$ curl -s https://lords.palsincomehub.com/v1/version
{"server":"0.1.0","protocol":1,"contentHash":"a99e1d84b4b2090e","builtAt":"2026-10-01T18:51:45.235Z","features":{"githubDevice":false}}
```

O que isso prova: a API responde em HTTPS, o vínculo GitHub está desligado e a imagem foi construída depois do commit `d9e014b` (18:47 UTC). O que **não** prova: o SHA implantado, que a resposta não traz. Entre `1b4e6db` e `d9e014b` não há mudança no código do motor, do servidor nem do app (`git diff --name-only`): os commits tocam a CI, a documentação, a página de apresentação e o `deploy/Dockerfile`, em que as imagens `web` e `landing` passaram a sair de uma base comum.

Registros anteriores do mesmo dia:

- Às 17:58 UTC, antes do deploy dos ajustes, `/v1/health` respondia `{"status":"ok","db":"ok"}` e `/v1/version` informava `builtAt` 17:35:10Z: nessa hora o ritmo 3× ainda não estava em produção.
- Depois do deploy dos ajustes, `builtAt` passou a 18:29:52Z. O `last-modified` de `/` passou a 18:30:44 GMT e o pacote servido trazia os textos novos. Aberto em Chromium sem interface: boas-vindas com o texto novo, botão do GitHub oculto e nenhum erro no console.
- F4-T1: **Jogar agora** até Pedra Alta em Chromium, cabeçalhos e CSP; ensaios de restauração e de reversão em [deploy/README.md](../deploy/README.md).

### Conferências feitas em produção em 2026-10-01, depois do deploy dos ajustes

- **Ritmo 3× (ADR 0011)**: uma partida criada pela API veio com `timeScale: 3`; a visão trouxe o próximo dia em 2.400 s, a melhoria das Habitações em 80 s, um aldeão em 400 s e a explicação "consumo 5 × 3 = 15/h". A conta usada foi excluída em seguida (resposta 202).
- **Concorrência e idempotência (critério 7)**: `pnpm -s sim -- --smoke https://lords.palsincomehub.com` passou nas 4 verificações: 10 ordens em paralelo com estado coerente (7 aceitas, 3 recusadas pelo motor), reenvio com o mesmo recibo, `409 COMMAND_ID_CONFLICT` para o mesmo UUID com outro conteúdo e a mesma recusa no reenvio de uma ordem recusada. A conta criada foi excluída.
- **Carga pequena**: 5 bots por 2 minutos, ciclo de 5 s: 122 ciclos, 25 comandos aceitos, nenhum erro. p95 de 142 ms em `GET /view` e `GET /events` e de 174 ms em `POST /commands` (máximo de 453 ms, na criação de partida). As cinco contas "Bot N" foram excluídas pelos próprios bots.
- As sete contas criadas nessas conferências ficam bloqueadas e saem do banco no expurgo de sete dias (a partir de 2026-10-08). O expurgo em si não foi conferido.

### Suítes locais

Rodadas em 2026-10-01, na árvore com os ajustes de fechamento, antes do commit `8ac6b56` e antes de existir a página de apresentação:

- `pnpm verify` (lint, tipos e testes de unidade): 42 arquivos, 1.141 testes, todos passam.
- `pnpm test:integration` (API e PostgreSQL de teste): 11 arquivos, 305 testes, todos passam, inclusive `packages/server/test/pace.test.ts` (ritmo).
- `pnpm test:e2e` (Chromium, app compilado e API real, no ritmo 1): 48 testes, todos passam.

Isso prova o código, não a produção. As contagens de hoje são maiores (a página de apresentação trouxe testes próprios); a prova que vale para o commit implantado é a CI da tabela acima.

## Quadro

"Aceito pelo fechamento" = o autor jogou em produção em dois navegadores, não relatou falha e decidiu fechar a v0.1 em 2026-10-01; sem avaliação critério a critério e sem evidência escrita. As provas automáticas estão cobertas pelas execuções de CI da tabela acima.

| # | Critério (resumo) | Prova automática | Em produção | Veredito e o que ficou sem verificar |
|---|---|---|---|---|
| 1 | Abrir, **Jogar agora** e primeiro comando em menos de 30 s, sem instalar nada | `tests/e2e/01-entrada.spec.ts`: "\"Jogar agora\": dois campos, um clique, e o primeiro comando em menos de 30 s". `tests/server/scenarios.test.ts`: "conta, partida, seis comandos e a visão do feudo crescendo" | F4-T1: **Jogar agora** chegou a Pedra Alta em 2 s, em Chromium sem interface (sem o primeiro comando). Aceito pelo fechamento | **Aprovado.** Sem verificação registrada: o tempo cronometrado por uma pessoa, do endereço ao primeiro `+`, em cada navegador |
| 2 | Um trabalhador a mais na Serraria muda a taxa na hora e reduz os livres | `packages/engine/src/population.test.ts`: "um trabalhador a mais na Serraria muda a taxa na hora e reduz os livres". `tests/e2e/02-feudo.spec.ts`: "+ na Serraria pelo painel muda a taxa de madeira e reduz os livres em menos de 1 s" | Aceito pelo fechamento. A carga pequena e a fumaça alocaram aldeões pela API sem erro, mas não leram a taxa na tela | **Aprovado.** Sem verificação registrada: a taxa e os livres, antes e depois, lidos na tela em produção |
| 3 | Não alocar além da população nem gastar o que não existe; motivo visível | `population.test.ts`: "não aloca mais que a população". `packages/engine/src/construction.test.ts`: "recusa sem recursos e diz quanto falta". `02-feudo.spec.ts`: "recusas do servidor aparecem com o motivo em português" e "alocar pela paleta mostra a taxa resultante e barra o que passa da população" | Fumaça: 3 das 10 ordens em paralelo foram recusadas pelo motor, com estado coerente. Aceito pelo fechamento | **Aprovado.** Sem verificação registrada: as três frases de recusa (população, recursos, fila ocupada) copiadas da tela em produção |
| 4 | Melhoria desconta uma vez, ocupa a fila e conclui no tempo | `construction.test.ts`: "desconta o custo uma única vez, ocupa a fila e registra o fim". `02-feudo.spec.ts`: "uma melhoria desconta uma vez, ocupa a fila e termina sozinha no tempo certo" | Partida nova pela API: melhoria das Habitações anunciada em 80 s (ritmo 3×). Aceito pelo fechamento | **Aprovado.** Sem verificação registrada: o tempo medido até a conclusão em produção e os recursos antes e depois. A prova automática em navegador roda no ritmo 1; o ritmo 3× se apoia em `pace.test.ts` |
| 5 | Fechar por horas e reabrir mostra o intervalo simulado, sem duplicar; `advanceTo` por partes ≡ de uma vez | `packages/engine/src/economy.property.test.ts`: "advanceTo(t3) é idêntico a advanceTo(t2) seguido de advanceTo(t3)". `packages/server/test/games.test.ts`: "fechar por horas e reabrir mostra o intervalo simulado, sem duplicar progresso". `tests/e2e/03-retorno-e-conexao.spec.ts`: "depois de 5 horas: abre em Hoje, com o Relatório de Retorno e o que mudou" | Aceito pelo fechamento | **Aprovado.** Ninguém registrou uma ausência de mais de 4 h em produção com os recursos antes e depois: a aprovação se apoia nos testes automáticos (propriedade do motor, integração e navegador com relógio adiantado) |
| 6 | Escassez correta em longos períodos, com o instante na Crônica | `packages/engine/src/famine.test.ts`: "30 dias fora com consumo maior que a produção: a fome começa no instante previsto". `packages/engine/src/advance.test.ts`: "30 dias de uma vez produzem os mesmos eventos e o mesmo estado que 720 passos de 1 h". `tests/e2e/06-avisos-e-preferencias.spec.ts`: "a fome avisa mesmo no nível padrão, e toma a barra de status" | Partida nova pela API: explicação "consumo 5 × 3 = 15/h" (ritmo 3×). Aceito pelo fechamento | **Aprovado.** Ninguém verificou a fome em produção depois de um período longo de tempo real (12 h sem fazendeiros no ritmo 3×, ou dias de ausência): a aprovação se apoia nos testes de 30 dias do motor e no teste em navegador com relógio adiantado |
| 7 | Reinício não perde nem duplica; reenvio devolve o recibo; UUID conflitante recusado; avanço preservado em recusa; dois clientes não corrompem | `games.test.ts`: "(b) depois de reiniciar o servidor, o recibo continua valendo", "reenvio do mesmo commandId e payload devolve status e corpo originais com X-Lords-Replayed", "mesmo UUID com payload ou tipo diferente: 409 COMMAND_ID_CONFLICT sem alterar o recibo", "conclusão da obra e produção persistem; a recusa não desconta nada; eventos aparecem uma vez", "10 comandos em paralelo: cada um aplicado uma vez, seq 1..10, estado igual ao sequencial". `scenarios.test.ts`: "não perde nem duplica nada, e o mundo andou enquanto ele esteve fora" e "sessões distintas, comandos intercalados e visões sempre iguais" | Fumaça `sim --smoke`: 4 de 4 (10 ordens em paralelo, reenvio com o mesmo recibo, `409 COMMAND_ID_CONFLICT`, mesma recusa no reenvio). Aceito pelo fechamento | **Aprovado.** Ninguém reiniciou `lotg-api` no Coolify com uma obra em andamento e a aba aberta para conferir a hora do fim e a Crônica: essa parte se apoia nos testes de integração, que derrubam e sobem a API em processo. Os deploys do dia trocaram o contêiner da API várias vezes, sem essa observação |
| 8 | Todas as regras rodam em testes sem navegador nem servidor | `pnpm --filter @lotg/engine test`; `packages/engine/src/purity.test.ts`: "o motor só importa @lotg/content e os próprios módulos" | Não se aplica: o critério não depende da produção | **Aprovado**, pela CI (job `verify`) |
| 9 | Temas claro, escuro e alto contraste; navegável por teclado, inclusive a paleta | `tests/e2e/05-teclado-e-temas.spec.ts`: "escuro, claro e alto contraste: capturas, contraste e rótulos nas telas principais", "uma partida inteira dos objetivos 1 a 4 só com o teclado", "abas: setas trocam de aba; a paleta abre com F1 e Ctrl+K, filtra, e Esc devolve o foco" | App aberto em Chromium sem interface, sem erro no console. Aceito pelo fechamento | **Aprovado.** A prova automática é só em Chromium. Sem verificação registrada: os três temas e o jogo só pelo teclado em cada navegador. Ninguém usou leitor de tela |
| 10 | Código do Reino em outra máquina mostra o mesmo feudo em segundos (GitHub desligado na v0.1) | `tests/e2e/04-conta.spec.ts`: "gerar em um navegador e entrar em outro mostra o mesmo feudo". `scenarios.test.ts`: "o Código do Reino abre o mesmo feudo em outra máquina, em segundos". GitHub, só simulado: "vincular a conta e, em outro navegador, entrar com o mesmo GitHub mostra o mesmo feudo" | `features.githubDevice` é `false` em `/v1/version`. Aceito pelo fechamento | **Aprovado**, pelo Código do Reino. Sem verificação registrada: o código gerado em um navegador e usado em outro, em produção. O GitHub real nunca foi exercitado e não entra na aceitação |
| 11 | Sem conexão: último estado, explicação e volta sozinho | `03-retorno-e-conexao.spec.ts`: "mostra o último estado, explica, não envia nem guarda ordens e volta sozinho" e "abrir a página com o servidor fora mostra o estado guardado, com a explicação" | Aceito pelo fechamento | **Aprovado.** Sem verificação registrada: a rede desligada e religada em produção, com o texto do aviso e o tempo de volta |
| 12 | Excluir bloqueia na hora por todas as credenciais e limpa as abas; expurgo depois de sete dias | `04-conta.spec.ts`: "pede confirmação e o nome do feudo, explica os prazos, bloqueia na hora e limpa as abas". `packages/server/test/jobs.test.ts`: "nega o acesso na hora, mas os registros internos continuam no banco" e "antes de sete dias nada é removido; exatamente no prazo, some das sete tabelas". `scenarios.test.ts`: "bloqueia na hora por todas as credenciais e some do banco depois de sete dias" | As sete contas de teste excluídas pela API responderam 202. Aceito pelo fechamento | **Aprovado.** Sem verificação registrada: a exclusão com duas abas abertas e o Código do Reino recusado em seguida, em produção. Ninguém verificou o expurgo de sete dias em produção, e nem dava: as primeiras contas excluídas completam o prazo em 2026-10-08. Essa parte se apoia nos testes de integração (`jobs.test.ts`, `scenarios.test.ts`) |

## Pendências que atravessam o fechamento

Não bloquearam os critérios e continuam abertas.

1. **Critério 12:** conferir, a partir de 2026-10-08, que as contas de teste excluídas em 2026-10-01 saíram do banco (contagens de `deploy/analytics/ops.sql`).
2. **Playtest com outras pessoas:** primeira tarefa da v0.2.
3. **Fase 4, todas do autor:** destino S3 para os backups (F4-T2.4), `GITHUB_CLIENT_ID` e o OAuth App (F4-T3.5, com o vínculo desligado por decisão), cópia de `RECOVERY_CODE_SECRET` fora do Coolify (F4-T3.6), canal de notificação do Coolify (F4-T4.3) e a confirmação de que o e-mail de alerta do GitHub chega.
