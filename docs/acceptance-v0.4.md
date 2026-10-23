# Aceitação da v0.4 (parcial, até a Fase D)

Quadro dos seis critérios de aceitação do GDD §16.2 ([GAME_DESIGN.md](../GAME_DESIGN.md)) e dos cenários integrados QA-19 a QA-34 do [roadmap da v0.4](roadmap-v0.4.md) (§10.1 e §10.2), tarefa V4I-T2. Para cada linha: a prova automática que existe hoje, a que falta (com a tarefa do roadmap que a entrega) e a evidência manual, **que o autor preenche durante o teste** (lição 7 do roadmap da v0.2). O passo a passo para jogar o que já existe está em [manual-test-v0.4.md](manual-test-v0.4.md).

> **Estado em 2026-10-23: nada foi aceito, e este documento é parcial.** Foi escrito no `main` em `c849bd8` (estado 31, protocolo 3), com a Fase D feita até a T2 (motor de batalha, comandantes e a ordem `simulateBattle`) e a Fase E apenas começada (as contas puras da Muralha, sem ligação ao estado). **Não existem** incursão com batalha, Muralha acima do Nv2, Torre acima do Nv2, presságios, a Horda que aprende, Fortaleza, sabotagem, Acampamento, Cerco, milícia, Queda nem Crônica do Ano. Por isso a maior parte das linhas diz "falta" e aponta a tarefa que a entrega; elas serão preenchidas quando essas tarefas fecharem (a V4I-T2 só fecha no fim da versão). **Ninguém jogou nenhuma fase da v0.4**: a coluna de evidência manual está vazia em todas as linhas, **de propósito**, e cada célula traz "por preencher". Aceitar um critério é do autor.

## Como ler e como preencher

**Prova automática.** Arquivo e nome do teste, conferidos com `grep` nos arquivos do `main` em `c849bd8` (2026-10-23); o nome é a string do `describe`, `it` ou `test`; `$name` e `%s` são parâmetros de `it.each`. Os testes de `packages/*/src` rodam em `pnpm test`; os de `packages/server/test/` e `tests/server/`, em `pnpm test:integration` (com `TEST_DATABASE_URL`); os de `tests/e2e/`, em `pnpm test:e2e`. **Este documento não rodou nenhuma suíte**: o portão de cada fase está no Registro do roadmap (§15) e as medições em [balance-v0.4.md](balance-v0.4.md). Onde escrevo "sem prova automática encontrada", procurei em `packages/*/src`, `packages/server/test`, `tests/server` e `tests/e2e` e não achei; pode existir uma prova que o `grep` não alcançou.

**Código, desenvolvimento e produção não provam a mesma coisa.** Cada observação diz onde foi feita:

- **código**: a prova automática acima, no commit indicado;
- **desenvolvimento**: `pnpm dev:api` + `pnpm dev:web`, ou o servidor de teste com relógio adiantável (`tests/e2e/server.ts`, rotas `/__test`, que existem só ali);
- **produção**: `https://lords.palsincomehub.com`. **Nada da v0.4 está no ar** (decisão 26 do ADR 0019: a primeira publicação é a do fim da Fase E); confira `protocol` e `builtAt` em `GET /v1/version`.

**Evidência manual.** Uma linha por observação, com data e hora; onde (código, desenvolvimento ou produção); o que estava no ar (o commit, ou `builtAt` e `protocol`); navegador e versão; ritmo e dificuldade; conta (nova ou migrada da v0.3); o que se viu, com o texto copiado da tela quando for um texto, e se passou; quem viu. Enquanto a célula disser "por preencher", nada foi visto por uma pessoa.

## Os seis critérios do GDD §16.2

### Critério 1: uma formação salva defende offline

- **Prova automática hoje (só a parte da formação, sem a defesa).** `packages/engine/src/formations.test.ts` ("marca a Defesa ativa, troca, desmarca; marcar a mesma de novo não emite nada", "dispensado, sai de todas as formações, inclusive da ativa"); `packages/server/test/formations.test.ts`: "salva, sobrevive a recarregar, ativa e não deixa apagar a Defesa ativa"; `tests/e2e/13-formacoes.spec.ts`: "montar e salvar só pelo teclado: a ordem nasce em Salvar, e a ativa vira a Defesa". **Sem prova automática encontrada** de uma incursão resolvida contra a Defesa ativa, e menos ainda com 30 dias fora.
- **O que falta.** A incursão passa pela batalha e usa a Defesa ativa (V4E-T2); o cenário de 30 dias fora com incursão no meio, a integração e o navegador com relógio controlado (V4E-T2, V4E-T4).
- **Evidência manual:** por preencher: data, navegador, quem.

### Critério 2: a prévia e a batalha real usam o mesmo código (golden)

- **Prova automática hoje.** `packages/engine/src/warCouncil.test.ts`: "critério 2: inimigo conhecido e a semente da batalha real dão o relatório da batalha real", "o agregado confere com as simulações, em inteiros, e se repete", "golden: o agregado de uma composição conhecida", "não toca o estado: a função nem o recebe, e o gerador do estado sai como entrou". `packages/engine/src/warCouncilOrders.test.ts`: "não sorteia no fluxo do estado nem cria entidade", "repetir dá o mesmo resultado, e a nova substitui a anterior (uma por vez)". `packages/engine/src/battle.test.ts`: "os sete cenários escritos à mão (docs/content-v0.4.md, seção 2)" (`$section: o motor reproduz a conta do documento`; `$section: desfecho e golden`).
- **O que falta.** A prévia contra a incursão que a Horda realmente manda só existe quando a incursão passar pela batalha (V4E-T2). Em navegador, nada: o botão "Simular" e o bloco do Conselho de Guerra são da V4D-T4 (hoje só a ordem existe, pelo protocolo). Sem prova de integração encontrada da ordem `simulateBattle` pelo servidor.
- **Evidência manual:** por preencher: data, navegador, quem.

### Critério 3: a Horda altera a composição em resposta à última formação

- **Prova automática hoje.** Nenhuma. `packages/engine/src/hordeTurn.ts` é a Horda da v0.2 (a Ameaça e o sorteio da incursão); não há memória da formação no estado.
- **O que falta.** A memória da formação e a resposta da Horda: a mesma memória e semente dão a mesma composição, e a formação de arqueiros traz mais lobos e cavalaria (V4E-T3).
- **Evidência manual:** por preencher: data, navegador, quem.

### Critério 4: o cerco ocorre na Hora da Vigília com 3 ondas, 60 min reais entre elas, e Plano de Batalha

- **Prova automática hoje.** Nenhuma. Não existem o cerco, a Hora da Vigília no estado nem o Plano de Batalha.
- **O que falta.** O cerco, as três ondas e o Plano, nos três ritmos e três fusos, com a integração e o navegador (V4G-T1, V4G-T2, V4G-T4).
- **Evidência manual:** por preencher: data, navegador, quem.

### Critério 5: a Crônica do Ano é gerada e exportável em Markdown

- **Prova automática hoje.** Nenhuma. A Crônica Markdown atual (`GET /v1/games/:id/chronicle.md`) é a dos eventos; a do Ano não existe.
- **O que falta.** O golden do Markdown, a integração do endpoint e o download em navegador (V4G-T3, V4G-T4).
- **Evidência manual:** por preencher: data, navegador, quem.

### Critério 6: o perfil Regular do `sim-cli` fica em 65 a 80% de Vitória

- **Prova automática hoje.** Nenhuma. Não há Vitória medida, porque não há cerco. O que existe é a faixa de população do Regular com a política mínima de guerra (`packages/sim-cli/src/bands.test.ts`, comentário "Regular, 7 dias reais, ritmo 3, em Senhor, com a política mínima de guerra (V4C-T1.8)") e a leitura do bot `militar` na linha de comando (`packages/sim-cli/src/cli.test.ts`). Isso **não é** o critério.
- **O que falta.** O `balance.test.ts` com a faixa de Vitória como meta (V4G-T2.10 e V4I-T1; a política mínima de guerra, V4C-T1.8, já está feita).
- **Evidência manual:** por preencher: data, navegador, quem.

**Resumo dos critérios:** 1 de 6 tem prova automática hoje (o 2); 1 tem prova só da parte que não é a defesa (o 1); 4 não têm nenhuma (3, 4, 5 e 6).

## Cenários integrados (roadmap §10.2)

Os QA-01 a QA-18 da v0.3 **não podem regredir** ([acceptance-v0.3.md](acceptance-v0.3.md)); em especial QA-01 e QA-02, QA-03 (a ordem no mesmo instante, agora com batalha, forja, treino e cerco), QA-14, QA-17 e QA-18. Este documento não rodou a regressão deles; ela vale pelo `pnpm verify` de cada fase.

### QA-19: carregar uma partida da v0.3 (estado 24)

Expedição, encruzilhada, cativo, caravana, Mestre à porta, estoque no cap, incursão marcada e anunciada, no outono e no inverno. Resultado esperado: migrada uma vez por passo; nada perdido nem pago de novo; ninguém ganha ferro, arma, soldado nem muralha; a Fortaleza e o cerco contam da fronteira; a incursão marcada resolve com a composição-base.

- **Prova automática hoje (parcial).** `packages/engine/src/migrations.test.ts`: um bloco por passo, de "versão 24 → 25 (V4B-T1: o ferro)" a "versão 30 → 31 (V4D-T2.2: a prévia do Conselho de Guerra)", cada um com "o passo não altera a entrada e não depende do ritmo" e, sobre os retratos congelados da versão de partida (`__fixtures__/state-v24-*.json`: expedição, encruzilhada, cativo, caravana, `master-waiting`, `warehouse-full`, `raid-announced`, `raid`), "`$name`: só acrescenta o ferro, em zero no feudo e na base no Mercado; o resto, o gerador e os contadores ficam como estavam"; e o bloco geral `describe.each(fixtures)`: "migra para a versão atual sem alterar a entrada", "preserva tudo o que o jogador tem", "avança 30 dias reais e aceita ordens", "a divisão de intervalo continua exata sobre o estado migrado".
- **O que falta.** "Ninguém ganha ferro, arma, soldado nem muralha" está provado passo a passo, não por um teste só de 24 até a atual. Sem prova automática encontrada de: o outono e o inverno como cenário; a incursão marcada resolvendo com a composição-base (V4E-T2); a Fortaleza e o cerco contando da fronteira (V4F, V4G-T2); a partida gravada nas versões 24 a 31 passando pelo servidor (`packages/server/test/games-migration.test.ts` tem os blocos só até a versão 22). Toda tarefa que sobe a versão acrescenta o seu.
- **Evidência manual:** por preencher: data, navegador, quem.

### QA-20: nenhum ciclo de ferro, arma ou soldado dá lucro

Comprar ferro e vender no mesmo dia; forjar e dispensar; treinar e dispensar; comprar para forjar e revender.

- **Prova automática hoje.** `packages/engine/src/market.property.test.ts`: "nenhuma sequência de compra e venda no mesmo dia dá lucro (critério 4; QA-09)" (a lista de recursos inclui o ferro); `packages/engine/src/smithy.test.ts`: "não há caminho de volta: nenhuma ordem troca arma por ferro, madeira ou ouro, e forjar nunca dá lucro" (cobre comprar para forjar e revender); `packages/engine/src/army.property.test.ts`: "não há ciclo lucrativo: treinar e dispensar nunca devolve recurso, arma nem gente".
- **O que falta.** A medição do perfil `especulador` com o ferro, que o roadmap cita ao lado da propriedade, é rodada do simulador, não teste (ver [balance-v0.4.md](balance-v0.4.md)). Armas não se vendem (ADR 0019).
- **Evidência manual:** por preencher: data, navegador, quem.

### QA-21: a ordem no mesmo instante

Forja, reparo, treino e obra terminando no mesmo instante que uma virada, uma incursão e uma caravana.

- **Prova automática hoje (parcial, cada um sozinho).** `smithy.test.ts`: "o fim do lote é um instante da linha do tempo: um milissegundo antes não há arma, no instante há", "cortar o tempo em qualquer instante dá o mesmo estado, os mesmos eventos e o mesmo gerador, com o lote terminando no meio e em qualquer ritmo"; `repair.test.ts`: "o fim do reparo é um instante da linha do tempo…", "cortar o tempo … com o reparo terminando no meio"; `army.test.ts`: "o fim do treino é um instante da linha do tempo…"; `army.property.test.ts`: "cortar o tempo em qualquer instante não muda estado, eventos nem gerador, com treino e fome no caminho"; `battle.property.test.ts`: "no jogo, a batalha é função da entrada e do fluxo: instantânea, não depende de quando nem de quantas vezes o tempo foi cortado".
- **O que falta.** Sem prova automática encontrada do instante com forja, reparo, treino, obra, virada, incursão e caravana juntos, nem da ordem documentada (roadmap §0.7) com batalha, forja e treino em `advance.test.ts`. As partes vieram com V4B-T2, V4B-T3 e V4C-T1; a junção com a incursão é da V4E-T2.
- **Evidência manual:** por preencher: data, navegador, quem.

### QA-22: soldados e população

Soldados com as casas cheias, com fome aberta, com o piso de 3; dispensar durante o treino.

- **Prova automática hoje (parcial).** `army.test.ts`: "o piso de 3 aldeões protege: a ordem que o quebraria é recusada, e o lote que o piso encolhe termina com os que couberam", "o lote que o piso encolhe em parte emite soldiersTrained e trainingShortfall", "o soldado come 1,5 por hora de jogo, contra 1 do aldeão", "o soldado não deserta: a fome longa tira aldeões, nunca soldados", "dispensar devolve aldeões sem ofício e não devolve o custo"; `army.property.test.ts`: "a comida nunca fica negativa e os habitantes nunca passam das casas, com ordens no meio do caminho".
- **O que falta.** Sem prova automática encontrada de dispensar enquanto o lote ainda treina, nem das casas cheias como cenário nomeado (a propriedade as cobre em geral).
- **Evidência manual:** por preencher: data, navegador, quem.

### QA-23: o comandante

Comandante que parte em expedição, escolta, é dispensado, ferido ou capturado; duas abas salvando a mesma formação.

- **Prova automática hoje (parcial).** `formations.test.ts`: "o herói em expedição, em escolta, ferido ou capturado não pode ser nomeado", "sendExpedition recusa com HERO_BUSY e a frase própria, e quem não comanda parte", "o comandante da ativa não escolta caravana", "dispensado, sai de todas as formações, inclusive da ativa", "capturado em uma expedição, sai do comando e quem voltou continua nele", "desmarcar a Defesa ativa, ou trocá-la, devolve o herói à expedição"; `tests/e2e/13-formacoes.spec.ts`: "apagar pede confirmação, e o comandante da Defesa ativa não parte".
- **O que falta.** Sem prova automática encontrada de duas abas salvando a mesma formação (a revisão da Fase C aceitou o caso: [reviews/v0.4-fase-c.md](reviews/v0.4-fase-c.md)) e do comandante ferido ou morto por uma batalha com a formação ativa (`applyBattleOutcome` tem teste em `battleOutcome.test.ts`, mas nenhuma incursão o chama: V4E-T2).
- **Evidência manual:** por preencher: data, navegador, quem.

### QA-24: batalhas com a conta à mão

Sete cenários; dois esquadrões com a mesma iniciativa; muralha em 0; Ogro; mortos-vivos; 12 rodadas.

- **Prova automática hoje (parcial).** `battle.test.ts`: "os sete cenários escritos à mão (docs/content-v0.4.md, seção 2)" (`$section: o motor reproduz a conta do documento` e `$section: desfecho e golden`; o Ogro em "2.4 Ogro e muralha", as 12 rodadas em "2.6"), "o Mago bate em área a cada 3 rodadas, em dobro contra os mortos-vivos", "em ataque, as 12 rodadas fazem o atacante recuar, e a muralha e as torres não contam", "recusa sorte fora do intervalo e posto fora da forma"; `battle.property.test.ts`: "termina em até 12 rodadas, as baixas nunca passam dos efetivos, e o relatório cabe no estado" (inteiros), "o relatório é função da entrada e da sorte…". O empate de iniciativa aparece como comentário no teste "o arqueiro da Horda mira a Retaguarda por cima da Frente, e o Escudeiro toma metade (D-3)" (o defensor age antes).
- **O que falta.** Sem prova automática encontrada que nomeie o desempate de dois esquadrões com a mesma iniciativa como caso próprio, nem a muralha em 0 (a vida da Muralha ligada ao estado é da V4E-T1.3 em diante; hoje só as contas puras em `wall.test.ts`).
- **Evidência manual:** por preencher: data, navegador, quem.

### QA-25: a prévia

Prévia com inimigo conhecido; prévia com `?`; 200 simulações; `state.rng` antes e depois.

- **Prova automática hoje.** `warCouncil.test.ts`: "critério 2: inimigo conhecido e a semente da batalha real dão o relatório da batalha real", "o desconhecido é preenchido com a composição-base da estação, sem sair da linha", "as sementes dependem da semente da partida, da formação e do que se sabe", "não toca o estado: a função nem o recebe, e o gerador do estado sai como entrou", "custo: 200 simulações de uma formação cheia contra a onda mais pesada" (o limite de 50 ms); `warCouncilOrders.test.ts`: "a visão traz os percentuais, o risco em uma frase e o inimigo com ?", "a prévia sobrevive ao avanço do tempo, sem alterar o gerador do estado".
- **O que falta.** A prévia em navegador (V4D-T4). O custo em máquina lenta é medição, não teste.
- **Evidência manual:** por preencher: data, navegador, quem.

### QA-26: os lobos do dia 16 diante da batalha

Contra Paliçada Nv1, Nv2 e nenhuma; média contra formação ativa; forte sem formação.

- **Prova automática hoje.** Nenhuma. `threat.raids.test.ts` e `palisade.test.ts` provam a incursão da v0.2, sem batalha; nenhuma incursão chama `applyBattleOutcome`.
- **O que falta.** A incursão passando pela batalha, a Paliçada como muralha, o desfecho da v0.2 preservado (V4E-T2).
- **Evidência manual:** por preencher: data, navegador, quem.

### QA-27: o reparo da muralha

Reparo com prioridade durante obra; reparo durante batalha; dois `repairWall`.

- **Prova automática hoje (só a conta).** `packages/engine/src/wall.test.ts`: "a pedra do nível: base no 1, base × 1,6 no 2 e a tabela da Muralha dali em diante", "reparar tudo custa metade da pedra do nível e ouro igual à pedra", "é proporcional ao que falta, arredondado para cima: 25% de uma ala leva um quarto de hora"; `packages/content/src/wall.test.ts`: "o reparo: metade da pedra, ouro igual à pedra, 15 min por 25%".
- **O que falta.** A ordem `repairWall`, a vida no estado e a prioridade sobre a obra (V4E-T1, as tarefas seguintes à T1.3).
- **Evidência manual:** por preencher: data, navegador, quem.

### QA-28 a QA-33: sem prova automática, porque a mecânica não existe

| ID    | Cenário (resumo)                                                                                                        | O que falta (tarefa)                                          | Evidência manual                     |
| ----- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------ |
| QA-28 | Formação-isca no ensaio e outra no cerco; a mesma memória e semente duas vezes                                          | A Horda que responde à última formação (V4E-T3)               | por preencher: data, navegador, quem |
| QA-29 | Presságio por nível da Torre; o que o presságio diz contra a onda gerada (só existe a conta da Torre Nv3+, em `packages/content/src/wall.test.ts`, sem ligação ao estado) | Os presságios, que nunca mentem contra a onda gerada (V4E-T3) | por preencher: data, navegador, quem |
| QA-30 | Três sabotagens, a quarta, o Desastre, a Fortaleza que some com a equipe lá                                             | A Fortaleza e a sabotagem (V4F-T1)                            | por preencher: data, navegador, quem |
| QA-31 | Ataque ao Acampamento com incursão no meio; o tile que volta no ano                                                     | O Acampamento de Saqueadores e a batalha ofensiva (V4F-T2)    | por preencher: data, navegador, quem |
| QA-32 | O cerco inteiro com o jogador fora 30 dias; a decisão entre ondas; duas abas; três ritmos e três fusos; migração no inverno com a Vigília passada (`packages/server/test/long-absence.test.ts` prova a ausência longa da v0.2, sem cerco) | O cerco, o Plano e a Hora da Vigília (V4G-T1, V4G-T2)         | por preencher: data, navegador, quem |
| QA-33 | Milícia convocada duas vezes; a Queda com 3 aldeões; a Primavera da Reconstrução nas obras (o piso de 3 aldeões só tem prova para o treino, em `army.test.ts`) | A milícia, a Queda e a Primavera da Reconstrução (V4G-T2)     | por preencher: data, navegador, quem |

### QA-34: versões, protocolo e reversão

API nova com app e cache antigos (protocolo 3); recibo antigo; imagem anterior diante do estado novo.

- **Prova automática hoje (parcial, só o que vale para qualquer versão).** `packages/server/test/games-migration.test.ts`: bloco "recibos da versão anterior" ("o reenvio devolve o corpo original, sem migrar, avançar nem reescrever o recibo", "depois de migrada a partida, o recibo antigo continua valendo e o UUID continua preso à ordem"), bloco "estado que este servidor não sabe ler" ("versão mais nova: leitura e ordem respondem 500 sem gravar por cima"); `packages/server/test/expeditions.test.ts`: "o cliente do protocolo 2 recebe 426 com o aviso de recarregar, em leitura e em ordem; o do 3 é atendido"; `packages/web/src/game/gameSession.test.ts`: "o cache do app do protocolo 2 é descartado pela marca, e o cursor dos eventos fica (QA-14)".
- **O que falta.** O protocolo ainda é 3 (`packages/protocol/src/index.ts`): o 426 para o app do protocolo 3 só existe quando o protocolo subir para 4 (V4G-T2), junto do ensaio de reversão da imagem anterior (V4I-T2, ato do autor; o ensaio de reversão continua por fazer).
- **Evidência manual:** por preencher: data, navegador, quem.

**Resumo dos cenários (16):** 2 têm prova automática do que a versão tem hoje (QA-20 e QA-25); 7 têm prova parcial (QA-19, 21, 22, 23, 24, 27 e 34); 7 não têm nenhuma, porque a mecânica ainda não existe (QA-26, 28, 29, 30, 31, 32 e 33).

## Jornadas a jogar (o que já existe)

O roteiro passo a passo é o de [manual-test-v0.4.md](manual-test-v0.4.md). A coluna de evidência está vazia de propósito.

| Jornada                                                         | O que olhar                                                                                                                           | Prova automática que ajuda (não substitui)                                                                                                                                                   | Evidência manual                     |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| O ferro: Mercado, Mina Abandonada e desgaste                    | O ferro a 8,00 no Mercado e fora da caravana; a Mina revelada pela Floresta Antiga; o item gasto sem bônus                            | `tests/e2e/10-mercado.spec.ts` ("o ferro no Mercado (V4B-T4.2)"); `iron.property.test.ts`; `repair.test.ts`; `smithy.test.ts`                                                                | por preencher: data, navegador, quem |
| O Ferreiro, a forja e o reparo                                  | Forjar em duas etapas, cancelar, reparar; a forja ocupada recusa um lote novo; "Antes de partir" lembra a forja parada                | `tests/e2e/11-ferreiro.spec.ts` (forjar, cancelar, reparar, ritmo Rápido, três temas, 720 px, modo leitura)                                                                                  | por preencher: data, navegador, quem |
| O Quartel e o treino                                            | A aba Exército depois do Mercado; custo e prazo da conferência; os soldados saem dos aldeões; cancelar e dispensar                    | `tests/e2e/12-exercito.spec.ts`; `army.test.ts`                                                                                                                                              | por preencher: data, navegador, quem |
| A formação, a Defesa ativa e o comandante                       | Seis postos pelo teclado; o comandante da Defesa ativa não parte; o aviso "Sem Defesa ativa"                                          | `tests/e2e/13-formacoes.spec.ts`; `formations.test.ts`; `packages/server/test/formations.test.ts`                                                                                            | por preencher: data, navegador, quem |
| A prévia do Conselho de Guerra (só pela ordem `simulateBattle`) | Vitória, Gloriosa, Derrota, o risco e as perdas; a ordem repetida substitui a anterior; "prévia desatualizada" quando a formação muda | `warCouncil.test.ts`; `warCouncilOrders.test.ts`. **Sem tela ainda** (V4D-T4); sem prova de integração encontrada da ordem pelo servidor                                                     | por preencher: data, navegador, quem |
| Conta migrada da v0.3 (estado 24 até o atual), aberta no dia seguinte | Nada perdido nem pago de novo; nenhum ferro, arma ou soldado de graça; o cache antigo descartado e o cursor mantido           | `migrations.test.ts` (passos 24 a 31); `gameSession.test.ts`. Sem prova encontrada da partida gravada na 24 a 31 pelo servidor                                                               | por preencher: data, navegador, quem |
| Cada ritmo: Rápido (3×), Normal (1×) e Tranquilo (0,5×)         | O prazo do lote de forja e de treino na tela contra a API, em horas de relógio                                                        | `tests/e2e/11-ferreiro.spec.ts` ("ritmo Rápido: …"); o Normal e o Tranquilo só no motor                                                                                                      | por preencher: data, navegador, quem |

### Navegador e versão

Chromium é o dos testes automáticos. Firefox é obrigatório à mão; Safari, celular e leitor de tela são registrados como verificados ou não. **Nenhuma linha foi preenchida.**

| Navegador                           | Versão        | Sistema       | Verificado?                                                                  | Jornadas e QA vistos                                | Quem e quando |
| ----------------------------------- | ------------- | ------------- | ---------------------------------------------------------------------------- | --------------------------------------------------- | ------------- |
| Chromium (Playwright, automatizado) | por preencher | por preencher | por preencher: confirmar a versão do `pnpm exec playwright install chromium` | os testes de `tests/e2e/` (`11` a `13` são da v0.4) | por preencher |
| Chromium / Chrome (à mão)           | por preencher | por preencher | não                                                                          | por preencher                                       | por preencher |
| Firefox (obrigatório à mão)         | por preencher | por preencher | não                                                                          | por preencher                                       | por preencher |
| Safari                              | por preencher | por preencher | não                                                                          | por preencher                                       | por preencher |
| Celular (navegador e aparelho)      | por preencher | por preencher | não                                                                          | por preencher                                       | por preencher |
| Leitor de tela (qual)               | por preencher | por preencher | não                                                                          | por preencher                                       | por preencher |

## O que a v0.4 não verificou (até a Fase D)

- **Ninguém jogou.** Nem o autor nem outra pessoa jogou a Fase B, a C nem a D; as fases fecharam por escolha dele, sem jogar. Os roteiros de 15 minutos das Fases B e C estão em [pendencias-v0.4.md](pendencias-v0.4.md), seções 7 e 8.
- **O conteúdo narrativo e os números da guerra são rascunho que o autor não leu por inteiro**: as fichas das unidades, os sete cenários de batalha, os oito inimigos e as frases da Crônica de batalha ([content-v0.4.md](content-v0.4.md)).
- **Nenhuma partida real passou pela migração 24 até a atual.** A produção está na versão 24 do estado (v0.3.0, protocolo 3); os sete passos novos só rodaram sobre retratos congelados em `packages/engine/src/__fixtures__/`. A publicação que sobe a versão exige o backup manual do banco antes (decisão 26 do ADR 0019).
- **O ensaio de reversão nunca foi feito**: nem a imagem anterior diante de um estado novo, nem a restauração do backup. A imagem da `v0.1.0` continua proibida como destino de reversão.
- **Navegadores.** Só Chromium automatizado; Firefox, Safari, celular e leitor de tela nunca foram usados nesta versão.
- **O balanceamento de fechamento (V4I-T1)** não existe: [balance-v0.4.md](balance-v0.4.md) tem a linha de base e as medições das Fases B e C. A medição de Vitória do Regular (critério 6) é da V4G-T2.10 e da V4I-T1.
- **A prévia sem tela.** A ordem `simulateBattle` existe no motor e no protocolo, mas o app não tem botão nem comando de paleta para ela (V4D-T4).
- **A CI do commit final não foi conferida**: este documento não rodou nenhuma suíte.
