# Pendências e dúvidas da v0.2

> **Para ler primeiro.** Em 2026-10-01 o autor pediu a implementação da v0.2 inteira durante a madrugada, com as dúvidas anotadas aqui. Este documento lista o que foi decidido sem ele, o que só ele pode fazer e o que ficou sem verificação. O que foi implementado está em [relatorio-v0.2.md](relatorio-v0.2.md).

## 1. O mais importante

- **A publicação está sendo feita por fase, a pedido do autor.** Em 2026-10-02 de manhã o autor autorizou o `push` no `main` ("ninguém está usando o ambiente do Coolify ainda"). Cada fase é enviada quando fecha com o portão completo verde; todo `push` no `main` com a CI verde é implantado sozinho. O backup externo e a cópia do `RECOVERY_CODE_SECRET` fora do Coolify **continuam por fazer** (item 3): só o autor tem acesso.
- **A primeira publicação foi em dois passos**, como [deploy/README.md](../deploy/README.md) pede (a imagem da `v0.1.0` não confere a versão do estado). Passo 1: até o fim da Fase B (`1051008`, estado na versão 2), enviado às 12:01 e implantado às 12:04 de 2026-10-02 (15:04 UTC em `/v1/version`), com `/v1/health` ok. Passo 2: a Fase C. O primeiro envio (`d9957d7`) parou na CI por um teste do motor que estourou o limite de 5 s na máquina da CI; o limite subiu para 30 s (`vitest.config.ts`) e o envio foi refeito. Não houve a espera de uma hora entre os passos que o README recomenda: a produção não tinha jogadores. O ensaio de reversão com imagens continua sem ser feito.
- **As regras da v0.2 são as premissas recomendadas do roadmap (§8)**, registradas nos ADRs [0013](decisions/0013-regras-da-v0.2-tempo-ritmo-migracao-e-economia.md) e [0014](decisions/0014-conselho-e-ameaca-na-v0.2.md) como "aplicadas por delegação". Nenhuma foi respondida pelo autor. A seção 2 lista cada uma para confirmar ou trocar.
- **Para jogar:** `pnpm dev:up`, `pnpm dev:api`, `pnpm dev:web` e abrir `http://localhost:5173`.

## 2. Decisões aplicadas sem o autor (confirmar ou trocar)

| # | Decisão | O que foi aplicado | Onde |
|---|---|---|---|
| 1 | Tempos fora do ritmo Normal | Tudo em tempo de jogo, menos a expiração da carta: 24 h reais | ADR 0013 e 0014 |
| 2 | Ritmos oferecidos | Rápido 3× (recomendado), Normal 1×, Tranquilo 0,5×; o 2× do GDD saiu | ADR 0013 |
| 3 | Como chega à produção | Tudo no `main` local, sem `push`; sem branches de fase | ADR 0013 |
| 4 | Partidas da v0.1 | Migradas, com o estoque acima do cap preservado | ADR 0013 |
| 5 | Balanceamento do 3× | Nenhum número ajustado; faixas do simulador com os valores medidos | ADR 0013 |
| 6 | Mercado na v0.2 | Não entrou (v0.3) | roadmap §8 |
| 7 | Cartas | 21 cartas escritas pelo agente, **sem aprovação carta a carta** | ADR 0014 |
| 8 | Carta do herói | Ficou para a v0.3 | ADR 0014 |
| 9 | Opção automática por dificuldade | Marcada em cada carta, sempre sem custo | ADR 0014 |
| 10 | Lobos | Uivos no dia 10, incursão no dia 16 do ano 1; 10% e 1 ferido (leve), 15% e 2 feridos (média); incursões por Ameaça | ADR 0014 |
| 11 | Ameaça, Torre, Paliçada | Ameaça cai 10 em toda incursão; Torre e Paliçada até o nível 2 | ADR 0014 |
| 12 | Objetivos 5 a 10 | Torre, primeira carta, estoque, obra automática, Paliçada, inverno sem frio | ADR 0014 |
| 13 | Lenha, obras lentas, postos | Lenha 0,5 por habitante/h no inverno; frio ×0,8 e moral −20; obras ×1,5 e recrutamento ×0,8 fixados no início; sem limite de postos | ADR 0013 |
| 17 | Caps | `máx(500, edifício) × dificuldade`; ganho discreto cortado e contado | ADR 0013 |
| 18 | Filas e automações | Planejadas na ordem, pulando bloqueadas; cadência do Conselho ancorada | ADR 0013 e 0014 |
| 19 | Moral e recuperação | Fórmula diária; piso de 3 aldeões | ADR 0013 |
| 20 | Virada de ano | `seenThisYear` zera; o resto continua | ADR 0014 |
| 21 | IDEIA-01 a 07 | Todas entraram | ADR 0014 |

## 3. O que só o autor pode fazer

| Item | Por quê | Tarefa |
|---|---|---|
| Playtest de 48 h da v0.1 com 3 a 5 pessoas | Precisa de pessoas e de acesso ao banco de produção | V2A-T1 |
| Playtest da v0.2 | Idem, depois de publicar | V2F-T3 |
| Backup externo e cópia do `RECOVERY_CODE_SECRET` fora do Coolify | Sem acesso à produção; **fazer antes de a migração de estado chegar lá** | decisão 14 |
| Ensaio da reversão atravessando uma migração, em produção ou em banco descartável do Coolify, incluindo a janela da troca de contêiner e os dois passos da primeira publicação | Idem | V2B-T1.6 |
| Jogar cada fase e aprovar | O roadmap pede o autor jogando antes da fase seguinte; não aconteceu | V2C-T7.5, V2D-T5.4, V2E-T5.3 |
| Aprovar as 21 cartas, uma a uma | Curadoria é do autor | V2D-T2 |
| `git push` **em dois passos** (primeiro só a Fase B, depois o resto), tag `v0.2.0` e release | Publicar é do autor; em um passo só, a imagem da `v0.1.0` grava por cima de partidas já migradas (deploy/README.md) | V2F-T4.5 |
| Os oito pontos do ADR 0012 e o vínculo GitHub | Já eram pendências | decisões 15 e 16 |

## 4. Dúvidas levantadas durante a implementação

### Fases A e B: fundação

Estado ao escrever: o último commit da Fase B é `e3d478e`; `origin/main` continua em `bbb8052`, ou seja, nada foi publicado. Os itens vão do mais importante para o menos.

**B-1. A primeira publicação vai em dois passos (primeiro só a Fase B) ou em um `push` só, com a API parada?**
- Enquanto isso: nada foi publicado. O caminho em dois passos está escrito e é o recomendado. O caminho de um `push` só (parar `lotg-api` antes e não usar a aba "Rollback") também está escrito, mas não foi ensaiado.
- Onde: `deploy/README.md`, "A primeira publicação da v0.2 vai em dois passos"; commit `a453b62`.
- Se decidir diferente: com um `push` só e a API no ar, a imagem da `v0.1.0` grava por cima de partidas já migradas, com as regras antigas e sem aviso.
- Ato do autor antes do passo 1: rodar em produção `select schema_version, status, count(*) from games group by 1, 2` e, se possível, passar um dump de `games.state` pelo `migrateState` (não há comando pronto para isso). A guarda da versão 1 é exata: um estado de produção com forma inesperada passa a responder 500, sem ser regravado.

**B-2. Na restauração de um backup, o procedimento deve guardar e reimportar as sessões?**
- Enquanto isso: o servidor não mudou. O README passou a dizer a perda com todas as letras: quem abriu o jogo depois do backup perde a sessão, e a conta anônima sem Código do Reino anterior ao backup perde o feudo. Entraram três passos novos (anotar as contas excluídas depois do backup, refazer a exclusão por SQL, avisar os jogadores). Reimportar `sessions` e `refresh_tokens` ficou descrito como "possível, ainda não adotado".
- Onde: `deploy/README.md`, "O que a restauração custa a quem joga"; `packages/server/test/restore.test.ts`; commit `5fdb675`.
- Se adotar: mexe no contrato de sessão do ADR 0005 e pede um ensaio com `pg_dump` e `pg_restore` de verdade. Se não adotar: restaurar um backup continua sendo o último recurso, porque tira do jogo quase todo jogador ativo.
- Confirmar também o texto dos três passos novos. Sem o segundo, uma restauração desfaz exclusões de conta (critério de aceitação 12).

**B-3. As frases de dificuldade e de ritmo ficam como estão?**
- Enquanto isso: valem as frases definitivas, escritas pelo agente. Elas falam de Celeiro, Armazém, deserção e Conselho, que só existem a partir das Fases C e D. No passo 1 da publicação (B-1) a Fase B vai sozinha para a produção: nesse intervalo as boas-vindas prometem o que ainda não existe, e as três dificuldades jogam igual.
- Dificuldades: Camponês, "O Celeiro e o Armazém guardam 25% a mais, ninguém deserta por fome e o Conselho, sem resposta sua, escolhe o melhor caminho."; Senhor, "O feudo como foi pensado: a fome longa faz aldeões desertarem e o Conselho, sem resposta sua, decide com cautela."; Rei de Ferro, "O Celeiro e o Armazém guardam 20% a menos, a fome longa faz aldeões desertarem e o Conselho, sem resposta sua, escolhe o pior caminho."
- Ritmos: Rápido, "Para quem volta várias vezes ao dia e quer ver o inverno ainda nesta semana."; Normal, "Uma semana, um ano: para quem passa pelo feudo duas ou três vezes por dia."; Tranquilo, "Para quem abre o jogo uma vez por dia: o feudo anda devagar e espera por você."
- Onde: `packages/content/src/balance.ts` (`difficulties.*.description`, `paces.*.hint`); chegam à tela por `GET /v1/catalog`.
- Se decidir diferente: é troca de texto no conteúdo. As saídas são aceitar a promessa durante o intervalo entre os dois passos, pôr no passo 1 a ressalva "chegam em breve" que a V2B-T3.5 previa, ou reescrever o tom.

**B-4. Cada passo de migração deve regravar a fronteira (`migratedAtMs`) com o instante em que encontrou a partida?**
- Enquanto isso: sim. O contrato antigo ("o primeiro passo grava e os seguintes não alteram") foi trocado: cada passo recebe `context.boundaryMs` e a fronteira guardada é sempre a da migração mais recente. É a leitura do agente da decisão 4 do ADR 0013. Na versão 2 nada muda no estado gravado.
- Onde: `packages/engine/src/migrations.ts`, `packages/engine/src/migrations/step.ts`, `packages/engine/README.md`; commit `b686d72`.
- Se decidir diferente: os prazos das Fases C a E (primeira carta, Ameaça, frio) contariam de uma fronteira antiga ou nula, e uma partida migrada receberia carta na hora ou sorteios atrasados da ausência inteira.
- Pergunta ligada: guardar no estado o histórico das fronteiras (uma por versão)? Hoje só fica a mais recente. Sem o histórico, refazer por replay uma partida migrada vai exigir o estado gravado em cada fronteira (um backup). Guardar muda a forma do `GameState` e o Apêndice B do roadmap.

**B-5. Uma partida com estado fora da forma deve ficar fora do ar (500) até alguém consertar à mão?**
- Enquanto isso: sim. `loadGame` confere a forma também na versão atual e recusa a partida cujo ritmo no estado difere do da linha; `persistState` recusa gravar um estado fora da forma (`assertStorable`). Custo medido: 1,5 µs por conferência.
- Onde: `packages/server/src/games/repository.ts`, `packages/engine/src/migrations.ts`; commit `6e1fd38`.
- Se decidir diferente: sem as guardas, um defeito de regra grava `null` por cima do último estado bom, sem aviso. Com elas, a linha fica intacta e a partida para.
- Ficou de fora: só o ritmo é comparado entre a linha e o estado; a dificuldade (`games.difficulty` contra `state.settings.difficulty`) não é. Uma partida arquivada com estado corrompido passa a responder 500 também na Crônica.

**B-6. A versão do estado sobe em toda tarefa que muda a forma dele, ou uma vez por fase?**
- Enquanto isso: uma versão por tarefa, um passo de migração por versão. A v0.2 deve terminar perto da versão 8 a 10.
- Onde: `packages/engine/README.md` (receita em 7 passos), `packages/engine/src/migrations/`, `docs/roadmap-v0.2.md` (Apêndice B.1).
- Se decidir diferente: agrupar por fase dá menos passos e menos retratos. Vale dizer cedo: as fases seguintes já trabalham com a regra atual.

**B-7. Que limites o autor quer por ritmo no simulador?**
- Enquanto isso: as faixas são os valores medidos com folga (10% na população, 5% nos tetos), não metas. Cobram população, Salão mínimo, horas de fome, zero ordens recusadas e um teto de excedente parado (estoque final de madeira, de pedra e de ouro; a comida ficou de fora). Fila ociosa e aldeões sem ofício são medidos, sem faixa.
- Números para decidir: no perfil Regular, em 7 dias reais, o teto de madeira parada é 42.916 no 3×, 10.518 no 1× e 1.690 no 0,5×. A fila de obras fica ociosa em 100% das horas amostradas em 15 das 18 células. No ritmo 1 o Regular chega a 26 aldeões no dia 7, contra a meta de 30 a 40 do GDD §15.2 (já era assim na v0.1).
- Onde: `packages/sim-cli/src/bands.ts` (`MEASURED`, `SLACK`), `docs/balance-v0.2.md` §2.
- Se decidir diferente: trocam-se os números em `bands.ts`. O "Pronto quando" da V2B-T4.4 (faixa aprovada por ritmo) só fecha com a resposta.
- Perguntas menores do mesmo tema: faixas mais largas durante as Fases C a E? Uma política de recrutamento melhor no bot fica para a V2F-T1 (o Dedicado no 1× termina com 17 aldeões, menos que o Regular)? O perfil de 1 sessão por dia usa o bot `preguicoso` e os de 2 e 4 usam o `economico`: escolha do agente.

**B-8. Importa que um jogador consiga prever cartas e incursões?**
- Enquanto isso: cada fluxo de sorteio nasce de um hash de 32 bits da semente (FNV-1a mais SplitMix32). O algoritmo e o conteúdo são públicos; com alguns sorteios observados dá para testar as 2^32 sementes fora do jogo. Outra escolha do agente: todo sorteio gasta o fluxo, mesmo em certeza (0%, 100%, item único).
- Onde: `packages/engine/src/random.ts` (`seedStream`).
- Se decidir diferente: semear as quatro palavras do gerador com hashes independentes e regravar os vetores de `random.test.ts`. A troca é de graça só enquanto nenhuma partida tiver fluxo gravado; depois do primeiro sorteio em produção vira mudança de regra (`RNG_VERSION` e passo de migração). A semente visível ao jogador (GDD §11.5, v0.5) torna a pergunta mais séria.

**B-9. As leituras do GDD feitas pelo agente estão certas?**
- Ofício: edifício com algum trabalhador, mas menos que `nível`, na virada do dia. O ADR 0013 define "ocupado" e o GDD mantém "−8 por dia vazio"; o caso do meio não está decidido em lugar nenhum. Leitura natural: nem +4 nem −8. (GDD §5.4)
- Frio e moral: o −20 entra só no recálculo da virada seguinte, não no instante em que o frio abre. (GDD §5.7; ADR 0013, decisões 13 e 19)
- Protocolo 2: as rotas continuam em `/v1`, com a versão no cabeçalho `X-Lords-Protocol`. O GDD dizia que mudanças incompatíveis iriam para `/v2`. (GDD §14.5)
- Objetivos antigos que saíram da sequência: herói, Patrulha e Ruínas em [v0.3]; Salão Nv4, soldados, formação, simulação e incursão repelida em [v0.4]. (GDD §12.2)
- Festival: "24 h de jogo" (1 dia real no ritmo Normal), marcado [v0.3]. (GDD §5.7)
- Onde: `GAME_DESIGN.md` (versão 0.7); commit `9b1d3e8`.
- Se decidir diferente: muda o GDD e, nos dois primeiros, a regra da Fase C com o golden dela.

**B-10. O desenho das boas-vindas e de "Nova partida" está aprovado?**
- Enquanto isso: dificuldades na ordem do catálogo (Camponês, Senhor, Rei de Ferro; o GDD §13.9 desenha Senhor primeiro). "(recomendado)" também em Senhor (o GDD só marca o ritmo). Boas-vindas com largura máxima de 720 px em vez de 440 (em 480 px os grupos empilham e "Jogar agora" exige rolar). "Nova partida" pergunta dificuldade e ritmo antes da confirmação de arquivar. Botão "Nova partida…" nas Preferências, que o roadmap não pedia. O `POST /games` leva a escolha que a tela mostrava, mesmo sem o jogador mexer.
- Onde: `packages/web/src/components/Welcome.tsx`, `packages/web/src/palette/commands.ts`, `packages/web/src/tabs/Settings.tsx`.
- Se decidir diferente: ajustes só no app; nenhum toca regra de jogo.

**B-11. O Relatório de Retorno pode sair sem a tabela de estoques na primeira visita depois de cada atualização?**
- Enquanto isso: sim. O cache de outra versão é descartado, o relatório sai com as contagens e as frases da ausência, e uma frase nova explica: "O jogo foi atualizado desde a sua última visita. Desta vez o relatório não compara os estoques: conta só o que aconteceu enquanto você esteve fora." A frase é do agente.
- Onde: `packages/web/src/game/gameSession.ts`, `packages/web/src/game/returnReport.ts`, `packages/web/src/components/Today.tsx`; commit `090bccf`.
- Se decidir diferente: ler da visão antiga só os estoques, para manter a comparação. Pesa na decisão: toda fase de C a E muda a forma do `ViewState`, então isso acontece a cada publicação.

**B-12. O servidor deve recusar um `GAME_TIME_SCALE` que não seja um dos ritmos oferecidos?**
- Enquanto isso: a configuração aceita qualquer valor de 0,5 a 10. Com 7, `GET /catalog` anuncia o padrão 3, mas `POST /games` sem `timeScale` cria a partida no ritmo 7, com o rótulo calculado "Ritmo 7×: um ano em 1 dia".
- Onde: `packages/server/src/games/service.ts`, `packages/server/test/pace.test.ts`, `packages/engine/src/pace.ts`.
- Se decidir diferente: restringir a variável aos ritmos do conteúdo. Sem efeito enquanto a produção rodar sem a variável (padrão 3).

**B-13. O convite do playtest pode ser enviado como está?**
- Enquanto isso: a mensagem está pronta, com três campos por preencher (fim das 48 horas, canal para avisar de defeitos, assinatura). O tom é informal ("Oi!"). Ela traz a frase "o feudo desta rodada pode não ser mantido depois", cautela do agente; como o ADR 0013 manda migrar preservando tudo, a frase pode sair. A página de apresentação ficou fora da mensagem (ADR 0012 não confirmado).
- Onde: `docs/playtest/convite-v0.1.md`.
- Se decidir diferente: editar o texto. As caixas V2A-T1.5 e T1.6 estão marcadas no roadmap, com nota, embora o envio não tenha acontecido; é só desmarcar se preferir.

**B-14. A aba Conta deve mostrar o identificador da conta? E o filtro do playtest deve cortar também os comandos pela janela?**
- Enquanto isso: o app não mostra o identificador em tela nenhuma (o comentário antigo de `ops.sql` dizia que mostrava). O cabeçalho do arquivo ensina a achá-lo no Local Storage (`lords.account:self`, campo `accountId`) ou por consulta pelo nome. A janela do filtro vale só para a criação da conta. O filtro entra por três linhas `\set`; no Coolify, sem elas, a consulta falha com erro de sintaxe.
- Onde: `deploy/analytics/ops.sql`, `docs/playtest/relatorio-modelo.md` (seção 3.0).
- Se decidir diferente: uma tarefa pequena no app (aba Conta) e uma mudança nas quatro consultas de playtest.

**B-15. O ritmo 0,5 pode ficar dentro do `GameState`, que só deveria ter inteiros?**
- Enquanto isso: sim. `settings.timeScale` é o único número não inteiro do estado, como pede o Apêndice B.1 do roadmap. Ele não entra em conta contínua. A exceção está escrita no README do motor.
- Onde: `packages/engine/README.md`, `packages/engine/src/types.ts`.
- Se decidir diferente: o ritmo teria de ser guardado de outra forma, o que muda a forma do estado (versão nova e passo de migração).

**Para saber (não pede decisão)**

- **Há uma API de desenvolvimento em modo watch na porta 3000.** É um `pnpm dev:api` iniciado às 20:21 de 2026-10-01, antes da sessão; nenhum agente a encerrou. Ela reinicia a cada mudança em `packages/server` e aplica sozinha as migrações no banco de desenvolvimento. As três partidas desse banco já estão na versão 2 do estado.
- **O banco de desenvolvimento ficou com três contas "Bot 1" a "Bot 3"** e 15 comandos do simulador. Estava vazio antes.
- **O contêiner `lotg-db-test` tem dois bancos a mais:** `lotg_e2e` (os testes de navegador da madrugada usaram esse, e não o `lotg_test`) e `lotg_review` (deixado por um revisor).
- **Sobraram a branch `web-track` e a árvore de trabalho `web-lane`** (na pasta temporária da sessão), as duas em `e3d478e`. São locais.
- **`pnpm test:integration -- games` roda a suíte inteira.** O certo é `pnpm test:integration games`, sem `--`. Corrigido no README do servidor e no roadmap da v0.2; `CLAUDE.md` e `MVP-ROADMAP.md` ainda trazem a forma antiga.
- **`CLAUDE.md` ficou desatualizado** (arquivo reservado, ninguém editou): cita o GDD v0.6 (é 0.7); a API pública do motor não lista `migrateState`, `CURRENT_SCHEMA_VERSION` e `StateMigrationError`; diz que "ainda não existe gerador" (existe `random.ts`, sem regra que o use); diz que toda partida nova nasce com `GAME_TIME_SCALE` (agora é só o padrão); não menciona `GET /v1/catalog`.
- **No roadmap, a V2B-T5 continua sem marca** e sem linha no Registro (§11), embora a revisão independente tenha sido feita. A frase da V2D-T1.2, `nextDrawAtMs = migratedAtMs + intervalo`, deve ser lida como `context.boundaryMs + intervalo` (ver B-4).
- **O protocolo continua em 1 na Fase B.** `ENGINE_VERSION` e `SERVER_VERSION` continuam `'0.1.0'`; ficam para a tarefa de release.
- **O schema de `POST /games` no protocolo aceita qualquer `timeScale` positivo;** quem confere contra os ritmos oferecidos é o servidor (`400 VALIDATION`, como antes). Foi o jeito de tirar os números do jogo do pacote do app.
- **As 50 sementes da matriz dão hoje o mesmo resultado,** porque nenhuma regra sorteia. A matriz ainda não diz nada sobre variação entre sementes.
- **O bot econômico mudou por dentro, não por fora:** lê tudo da visão, e a folga virou "duas bocas a mais" em vez de "2 de comida por hora de jogo". As medidas saíram idênticas; com os fatores da Fase C o arredondamento da visão pode custar um fazendeiro a mais ou a menos.
- **"Nova partida" sem rede fica cerca de 1,5 s sem nada na tela** antes do primeiro diálogo. A trava impede o fluxo em dobro; falta um sinal de espera.
- **O Prettier não confere Markdown neste repositório** (`*.md` está no `.prettierignore`): `pnpm lint` verde não diz nada sobre os documentos.

### Fase C: economia sazonal

Estado ao escrever: o último commit da Fase C é `4faa40e`. O autor não jogou a fase (V2C-T7.5) e não aprovou nenhuma regra, número ou texto dela. Nenhum número do conteúdo foi ajustado depois das mecânicas: as propostas abaixo não foram aplicadas nem simuladas. `origin/main` está em `1051008`: o registro local do Git mostra um `push` às 12:01 de 2026-10-02 que levou as Fases A e B. Os 35 commits da Fase C (de `642dc9a` a `4faa40e`) estão só no `main` local. Quem escreveu esta seção não sabe quem fez o `push` nem se a implantação terminou; a frase "nada foi publicado" da seção 1 precisa ser conferida. Os itens vão do mais importante para o menos.

**C-1. O Salão no nível 8 fica fora de alcance em Senhor por 2 de madeira: a capacidade dos depósitos sobe, ou o teto mais baixo é intenção?**
- Enquanto isso: nenhum número mudou. Em Senhor a obra do Salão 7 → 8 pede 5.102 de madeira e o Armazém no nível máximo guarda 5.100. O Salão para no 7 e a Fazenda, a Serraria, a Pedreira, a Mina e as Habitações param no 8. Em Rei de Ferro o Celeiro e o Armazém param no nível 7 (a obra do 8 pede 4.295 e o Armazém guarda 3.600), e o Salão também para no 7. Só Camponês chega ao Salão 8. O nível 10 dos cinco edifícios não existe para ninguém: a regra "Salão mais um", com o Salão no máximo 8, dá 9.
- Armadilha em Senhor: com o Armazém no nível 7, a recusa do Salão manda "amplie o Armazém primeiro". O jogador paga 4.295 de madeira e 2.147 de pedra e continuam faltando 2.
- Proposta da rodada do simulador (não aplicada, não simulada): capacidade do Celeiro e do Armazém no nível 1 de 900 para 1.000. O Armazém Nv8 passa a guardar 5.200 em Senhor e o Salão 8 cabe. Não resolve Rei de Ferro.
- Onde: `packages/content/src/balance.ts` (`storage`), `packages/content/src/buildings.ts`; `docs/balance-v0.2.md` §4.1, §9.5 e §9.8; teste "o teto de cada edifício em cada dificuldade" em `packages/engine/src/storage.test.ts`; commit `4faa40e`.
- Se decidir diferente: mudar a capacidade mexe no GDD §5.5, na decisão 17 do ADR 0013, no golden e na linha de base do simulador. Se o teto ficar como está, o catálogo deve deixar de anunciar o nível 10, e a recusa do Salão deve dizer "não há como juntar tanto" já com o Armazém no nível 7.

**C-2. A deserção por fome fica em Senhor como o GDD §5.6 escreve, mesmo no ritmo Rápido?**
- Enquanto isso: sim. Depois de 12 h de jogo de fome contínua, um aldeão deserta por dia de jogo, até o piso de 3. No ritmo Rápido são 4 h reais de carência e depois um aldeão a cada 40 min. Um feudo de 22 aldeões deixado sem lavradores cai a 3 em 32 h de jogo (cerca de 11 h reais). Camponês não tem deserção, mas perde gente pelo sorteio da moral baixa.
- O conflito: a regra 5 do GDD §15.1 diz que faltar nunca destrói nada fora de Rei de Ferro.
- Onde: `packages/content/src/balance.ts` (`morale.famineDesertionAfterMs`, `morale.populationFloor`), `packages/engine/src/moraleTurn.ts`; `docs/balance-v0.2.md` §7.4; ADR 0013, decisão 19; commit `ef6ff0d`.
- Se decidir diferente: alongar a carência ou tirar a deserção de Senhor é troca de número no conteúdo, com golden e GDD §5.6 e §12.1. Nenhum bot da matriz passa fome, então a matriz não mede o efeito de nenhuma das saídas.
- Perguntas menores: quem deserta sai do edifício com mais gente, primeiro quem ainda se adapta (na recuperação costuma ser o lavrador recém-posto na Fazenda): prefere que saia primeiro quem não está na Fazenda? O colono pode chegar durante a fome (o GDD só exige vaga), embora a tela da fome diga "ninguém se junta ao feudo": bloquear?

**C-3. A fome de antes da atualização conta para a deserção, ou a contagem começa na fronteira da migração?**
- Enquanto isso: conta desde quando começou. Uma partida com fome há mais de 12 h de jogo perde o primeiro aldeão na primeira virada de dia depois da atualização (até 40 min reais no ritmo Rápido), e depois um por virada até o piso de 3. A moral nasce em 50 e, na primeira virada, leva −20 da fome e −2 por dia de fome anterior. Há teste que afirma isso; a escolha não está no ADR 0013.
- Outros efeitos na fronteira, para confirmar: partida com estoque muito acima do limite (o bot da v0.1 no ritmo 3 tinha 40 mil de madeira) não recebe produção até gastar, e o desperdício é relatado todo dia de jogo, sem linha de "encheu"; partida migrada no inverno sem madeira abre o frio no instante da fronteira; feudo com as casas cheias e sem comida guardada ganha a linha "o povo anda inquieto"; quem não concluiu o objetivo 4 deixa de ganhar os 50 de ouro.
- Onde: `packages/engine/src/migrations/v6.ts` (passo 6 → 7), `packages/engine/src/migrations.test.ts`, `packages/engine/README.md`; roadmap §0.7 ("Fronteira da atualização"); ADR 0013, decisão 4.
- Se decidir diferente: contar da fronteira dá ao jogador 12 h de jogo para reagir depois da publicação (4 h reais no ritmo Rápido). Pede um campo novo no estado com o início da contagem (versão nova e passo de migração).

**C-4. Quando a fome acaba, e quando o prazo da deserção recomeça?**
- Furo conhecido, não corrigido (a revisão adiou por ser decisão de regra): mandar todos para a Fazenda e de volta, em duas ordens seguidas, fecha e reabre a fome. O prazo de 12 h da deserção e o −2 por dia de fome recomeçam do zero, sem ninguém ter comido. Com aldeões sem ofício a manobra não custa nada. Medido em 40 h de jogo com 10 aldeões: sem a manobra, 5 deserções e 3 aldeões no fim; com ela a cada 10 h, nenhuma deserção e 7 aldeões. A Crônica registra "A fome acabou." e "A fome começou." no mesmo instante. Não ficou teste no repositório para o caso.
- Enquanto isso: vale o GDD §5.6 ao pé da letra ("a fome que acaba e recomeça conta o prazo do zero") e a regra da v0.1 (a fome termina com saldo positivo).
- Leitura aplicada em uma correção vizinha, para confirmar: a fome também termina quando o estoque volta a cobrir o consumo (uma recompensa ou uma carta de comida), como o frio com a madeira. Antes, a comida recebida durante a fome ficava parada e a deserção continuava com a despensa cheia. A frase foi escrita no GDD §5.6 pelo agente. Consequência: a fome que reabre quando essa comida acaba conta do zero (+300 de comida para 10 bocas dão 30 h de jogo sem fome).
- Onde: `packages/engine/src/famine.ts`, `packages/engine/src/economy.ts` (`foodCoversConsumption`), `packages/engine/src/morale.ts`; commit `f4c324b`.
- Se decidir diferente: sugestão do agente para o furo: a fome que reabre menos de um dia de jogo depois de acabar continua a mesma fome. Pede guardar no estado quando a última fome acabou (campo novo, migração). As alternativas mais simples ainda se contornam (a fome só acabar com comida no estoque; manter o prazo só dentro do mesmo dia de jogo).

**C-5. As obras acabam no quinto dia do ritmo recomendado: sobem os custos, sobe o teto do Salão ou o ouro ganha um destino?**
- Enquanto isso: nada mudou. Em Senhor, o perfil Regular (2 visitas por dia) fica sem obra possível na hora real 113 do ritmo Rápido. O Dedicado (4 visitas) chega lá na hora 75 no Rápido e na 134 no Normal; o Regular do Tranquilo, no 11º dia. Depois disso o ouro se empilha: 156.690 em uma semana no Rápido para o Regular, 276.963 para o Dedicado. A Torre e a Paliçada da Fase E, cada uma até o nível 2, não mudam a ordem de grandeza.
- Metas do GDD §15.2 superadas: "população 30–40 no dia 7 (Regular)" mede 69 aldeões e Salão 7 no ritmo Normal (na v0.1 eram 26 aldeões e Salão 3). Parte do salto vem de mudanças no bot (C-13). A meta sobe ou os custos sobem?
- A fila de recrutamento (5 aldeões) limita o Regular do ritmo Rápido a 10 aldeões por dia real: no quarto dia ele tem 37 aldeões em 75 vagas, com comida de sobra. É intenção?
- A experiência do ofício chega a 100 em 25 dias de jogo ocupados (17 h reais no ritmo Rápido). A Mina dominada rende 30% a mais sem haver onde gastar.
- Onde: `docs/balance-v0.2.md` §9.3, §9.5, §9.6 e §9.8; `packages/content/src/buildings.ts` (custos e níveis máximos), `packages/content/src/balance.ts` (`recruitment`, `craft`).
- Se decidir diferente: toda saída é número de conteúdo, com golden, GDD e linha de base regravados. Nenhuma foi simulada.

**C-6. A meta "nenhum recurso desperdiçando por mais de 8 h de jogo" vale no ritmo Rápido? Em que relógio?**
- Enquanto isso: a meta é medida em toda partida e não é cobrada como faixa. No perfil Regular, em Senhor, ela é cumprida no ritmo Normal (1 h de jogo de madeira) e no Tranquilo (até 2 h). No Rápido não: 18 h de jogo de comida, que são 6 h reais, nas horas reais 19 a 24 e 31 a 36. Antes da rodada eram 165 h de jogo de madeira; a queda veio de mudar o bot, não o jogo (C-13). Em Camponês e em Rei de Ferro o Rápido também passa da meta (até 30 e até 24 h de jogo).
- Por quê: no Rápido, 8 h de jogo são 2 h 40 reais, e a ausência do Regular vale 36 h de jogo.
- Recomendação da rodada (não aplicada): ler a meta em horas reais fora do ritmo Normal. Em Senhor todas as células do Regular ficam dentro, sem mexer em número. Alternativas: dizer que a meta só vale no Normal (o título da §15.2 já diz "ritmo Normal, dificuldade Senhor"), ou aumentar os 500 iniciais da Despensa e do Pátio.
- Pergunta ligada: "Antes de partir" e a barra de status avisam do depósito que enche em menos de 8 h reais. Quem volta em 12 h sai com o painel limpo e encontra comida no chão. O aviso deveria olhar 12 h? O limiar está no app (`FULL_SOON_SECONDS`), como escolha de apresentação.
- Onde: `packages/sim-cli/src/report.ts` (`WASTE_STREAK_GOAL`), `packages/sim-cli/src/balance.test.ts`, `packages/web/src/ui/format.ts`; `docs/balance-v0.2.md` §8 e §9.4; ADR 0013, decisão 17; commits `52d1c2f` e `4faa40e`.
- Se decidir diferente: a meta vira faixa cobrada em `packages/sim-cli/src/bands.ts`. O "Pronto quando" da V2C-T7 ("o bot Regular satisfaz a faixa de desperdício") só fecha com a resposta. A medida tem resolução de uma hora real: no Rápido pode contar até 6 h de jogo a mais.

**C-7. A obra planejada automática pode gastar a madeira que o inverno vai queimar?**
- Enquanto isso: pode. O motor inicia a automática sem olhar a lareira. A revisão achou o caso em que a tela dizia "o estoque e a Serraria dão conta" e "o feudo está preparado", a obra começava sozinha e o frio abria na ausência (produção × 0,8 e moral −20). Foi corrigida só a tela: a conta da lenha desconta o que as automáticas vão levar e cita a obra ("...a obra planejada da Fazenda leva 80 quando começar sozinha: faltam 70 de madeira. Mande gente para a Serraria ou desligue o início automático."), e "Antes de partir" ganha o item da lenha.
- Onde: `packages/engine/src/planned.ts`, `packages/engine/src/seasonView.ts` (`FirewoodView.reserved`), `packages/web/src/game/beforeLeaving.ts`; commit `206b711`.
- Se decidir diferente: a automática respeitar a reserva de lenha é regra nova. Pede ADR, GDD §6.3 e golden.

**C-8. Dois defeitos conhecidos das previsões ficaram sem correção: entram antes da Fase D ou no fechamento (V2F-T1)?**
- A conta da lenha soma o inverno inteiro e não olha a ordem dos acontecimentos. Com estoque quase zero e moral baixa que só sobe na virada seguinte, ela diz "dão conta" e o frio abre na hora. Exemplo: 10 habitantes, 1 lenhador, madeira 0 e moral 0 no primeiro instante do inverno.
- No inverno, quando a lenha acaba antes da comida, o "acaba em" da comida vem vazio: a projeção para na primeira escassez. Exemplo confirmado: 10 habitantes, ninguém na Fazenda, 50 de comida e 10 de madeira. A tela mostra comida −10/h sem prazo; o frio abre em 2 h e a fome em 5 h. "Antes de partir" mostra só o item da lenha.
- Enquanto isso: os dois casos estão só nos relatos de quem corrigiu os achados da revisão. Não há teste que os marque.
- Onde: `packages/engine/src/seasonView.ts`, `packages/engine/src/craftProjection.ts`.
- Se decidir corrigir: a mudança é larga, porque a mesma projeção serve a todas as previsões ("cheio em", espera das planejadas, lenha, comida). A da lenha pede trocar a soma por uma projeção trecho a trecho.

**C-9. O fecho diário do desperdício fica mesmo fora da Crônica (ADR 0015)?**
- Enquanto isso: sim. O ADR 0015 foi escrito e aplicado por um agente durante a V2C-T2, sem o autor. O evento `storageWasted` continua em `GET /events` e alimenta o Relatório de Retorno; não é linha de `GET /chronicle` nem de `/chronicle.md`, como `dayStarted`. Sem isso eram 49 linhas "foi ao chão" contra 60 de todo o resto no cenário de 7 dias, e até 36 por dia real no ritmo Rápido.
- Decisões ligadas, também do agente: "o depósito encheu" (`storageFilled`) sai uma vez por episódio, e gastar e encher de novo é outra linha (17 linhas no cenário de 7 dias); o fecho diário conta unidades inteiras, a fração passa ao dia seguinte, e um dia com menos de uma unidade perdida não gera evento.
- Onde: `docs/decisions/0015-cronica-sem-o-fecho-diario-do-desperdicio.md`; `CHRONICLE_HIDDEN_EVENT_TYPES` em `packages/protocol`; `packages/server/src/games/repository.ts` (`chronicleRows`); `packages/server/test/storage.test.ts`; commit `0a97310`.
- Se decidir diferente: tirar `storageWasted` da lista devolve uma linha por dia de jogo com depósito cheio. Para o "encheu", a alternativa é uma folga antes de anunciar de novo. A tabela da seção 2 deste documento ainda não tem a linha do ADR 0015.

**C-10. As leituras da moral feitas pelo agente estão certas?**
- "A comida cobre 24 h" foi lida como estoque contra consumo: o estoque de agora paga 24 h de jogo das bocas de agora, sem contar a produção. São 120 de comida para 5 habitantes e 720 para 30, que só cabem com o Celeiro.
- Sem efeitos temporários a moral vai de 0 a 60. A faixa Orgulhoso (75 ou mais) e o colono (80 ou mais) ficam inalcançáveis até as cartas (Fase D) e os objetivos 6 e 10 (Fase E).
- Casas cheias (−10) é o estado normal de um feudo que cresce: sem a comida guardada a moral fica em 40 e a Crônica diz "o povo anda inquieto" cedo.
- O frio aberto não conta na virada para a primavera, porque ele sempre termina nela. Para a fome não há exceção igual: a que abre ou acaba em cima de uma virada só entra ou sai da conta na virada seguinte.
- Os efeitos temporários ficam em `settlement.moraleEffects` (o roadmap previa `council.effects`), contam em exatamente N viradas, e gravar o mesmo `id` troca em vez de somar.
- A tela explica a conta da próxima virada, não a moral de agora. Se o que derrubou a moral já passou, nada diz por que ela está baixa (dúvida da revisão, sem correção). Saídas: guardar no estado os termos da última virada (campo novo) ou uma frase genérica.
- Enquanto isso: vale tudo o que está acima.
- Onde: `packages/content/src/balance.ts` (`morale`), `packages/engine/src/morale.ts`, `moraleTurn.ts` e `moraleView.ts`; GDD §5.7; ADR 0013, decisão 19; commit `ef6ff0d`.
- Se decidir diferente: cada ponto é conteúdo ou regra do motor, com golden e GDD no mesmo commit.

**C-11. As leituras das estações, da lenha e do frio estão certas?**
- Obra iniciada no inverno: o fator × 1,5 entra antes do teto de 8 h. Hoje o teto não age em nenhuma obra (a maior dá 5 h 7 min no inverno); a leitura só vai pesar em níveis altos de edifícios futuros.
- Peso da lenha: 0,5 de madeira por habitante por hora de jogo dá 12 por habitante por inverno, e um lenhador de nível 1 cobre quase 13 habitantes. Com o limite inicial de 500, 35 aldeões queimam 420. Nenhum bot da matriz passa frio. O número é o do ADR 0013; ninguém mediu se a lenha pesa o bastante para ser uma decisão.
- O frio termina com estoque que cobre ao menos um instante de lenha (o contrário exato da condição que o abre), ou com saldo positivo, e sempre na primavera.
- O recrutamento × 0,8 da primavera vale para a ordem inteira, mesmo com aldeões chegando depois da virada.
- Toda partida nasce na primavera, então o começo do jogo mudou: comida × 1,2 e recrutas de 16 em 16 min.
- A lenha está no conteúdo como fração (1/2), não como 0,5, para a conta ficar em inteiros.
- Enquanto isso: vale tudo o que está acima.
- Onde: `packages/content/src/balance.ts` (`calendar.seasons[].effects`, `winter.cold`), `packages/engine/src/cold.ts`, `scarcity.ts` e `construction.ts`; GDD §4.1; ADR 0013, decisão 13; commit `642dc9a`.
- Se decidir diferente: muda o conteúdo ou a regra, o golden (`chronicle-winter.txt` entre eles) e o GDD.

**C-12. As leituras da troca de ofício estão certas?**
- Quem nunca teve ofício também se adapta: o aldeão sem ofício ou recém-recrutado rende metade por um dia de jogo. A primeira ordem de uma partida nova já mostra "em adaptação".
- Tirar um veterano e repor no mesmo instante custa um dia de adaptação: o motor não lembra de onde ele veio. O "+" mostra o custo antes do clique; o "−" não avisa nada (dúvida da revisão, sem correção).
- Edifício com gente, mas menos do que o nível pede: a experiência não sobe nem cai (é a leitura de B-9, agora no código). Efeito: a Fazenda costuma ficar com gente de menos quando sobe de nível e raramente ganha experiência.
- Em feudos pequenos os quatro ofícios chegam à mestria no mesmo dia: quatro linhas "dominaram o ofício" no mesmo instante.
- Campo a mais no estado, fora do Apêndice B: `settlement.craftMasteredYear`, para o "uma vez por ano".
- Enquanto isso: vale tudo o que está acima.
- Onde: `packages/content/src/balance.ts` (`craft`), `packages/engine/src/craft.ts`, `packages/web/src/components/WorkersPanel.tsx`; GDD §5.4; commit `cfb5434`.
- Se decidir diferente: só a troca entre ofícios custar, ou uma tolerância para desfazer o engano, é regra nova no motor (golden e GDD). O aviso no "−" é só texto.

**C-13. O bot do simulador mudou em quatro tarefas: as mudanças ficam?**
- A regra da casa diz que o ajuste é nos números, nunca no bot. As mudanças, todas medidas em `docs/balance-v0.2.md`:
  - V2C-T5: obras antes de recrutar. Com a ordem antiga o Regular do ritmo Rápido nunca erguia o Celeiro e passava 6 h reais de fome no terceiro inverno.
  - V2C-T3: troca menos de ofício e ganhou "plantar para crescer" (um lavrador a mais enquanto há vaga). O Regular do ritmo Normal foi de 45 para 68 aldeões em 7 dias.
  - V2C-T4: deixa uma cama vazia a partir de 20 aldeões. "Manter a despensa cobrindo 24 h", pedida na tarefa, foi medida e não entrou: derrubava o Regular do Tranquilo de 55 para 37 aldeões.
  - V2C-T7: sabe de quanto em quanto tempo o perfil volta (12 h com 2 visitas, 6 h com 4) e deixou de produzir para depósito cheio. Madeira no chão do Regular no Rápido: de 135.052 para 1.181, com a mesma população. As trocas de ofício sobem (Regular no Rápido: de 5 para 42 na semana). Com as obras esgotadas, ele esvazia a Serraria e a Pedreira e manda todos para a Mina.
- Enquanto isso: as faixas foram regravadas a cada mudança e agora existem nas três dificuldades. São valores medidos com folga, não metas aprovadas (B-7 continua valendo). O Dedicado do ritmo Rápido perdeu um nível de Salão no primeiro ano (7 → 6), e a faixa foi rebaixada para isso.
- Onde: `packages/sim-cli/src/bots/policies.ts`, `packages/sim-cli/src/bots/index.ts` (`botFor`), `packages/sim-cli/src/bands.ts`; `docs/balance-v0.2.md` §5.5, §6.4, §7.3 e §9.2.
- Se decidir diferente: reverter uma política muda a linha de base e as conclusões de C-5 e C-6, que saíram deste bot.

**C-14. As regras e a forma das ordens das obras planejadas estão certas?**
- `planConstruction` e `setAutoStart` ganharam `targetLevel` opcional e a recusa nova `STALE_LEVEL`, para duas abas com a tela atrasada não pagarem o nível seguinte sem o jogador pedir. O revisor disse que mudar a forma da ordem era decisão do autor; foi aplicado por ser adição opcional. `startConstruction` continua sem o nível: a aba velha que clica "Melhorar" depois de a obra da outra aba terminar paga o nível seguinte (comportamento da v0.1). Estender?
- Uma planejada por edifício e nenhum comando para reordenar a lista. Por isso a fila ociosa de quem joga uma vez por dia não chega a zero (em 7 dias reais: de 168 h para 35 no Normal, 67 no Tranquilo e 91 no Rápido). Permitir mais níveis planejados ou reordenar?
- Cancelar uma obra não mexe na planejada do nível seguinte: ela fica esperando o jogador iniciar a obra de novo.
- Planejar como automática com recurso e fila disponíveis inicia e paga na hora. Vale também para marcar "Iniciar quando houver recursos" em uma manual que já pode começar. Na paleta, o que vem marcado nunca gasta na hora; o botão "Planejar" do painel cria sempre manual.
- A segunda fila abre no Salão Nv4. Com a fila ocupada antes disso a recusa é `QUEUE_LOCKED`; `QUEUE_BUSY` ficou para as duas filas ocupadas.
- Enquanto isso: vale tudo o que está acima.
- Onde: `packages/protocol/src/commands.ts`, `packages/engine/src/construction.ts`, `packages/engine/src/planned.ts`, `packages/web/src/palette/commands.ts`; GDD §6.3; ADR 0013, decisão 18; commits `edd3b04`, `192207c` e `5c82a67`.
- Se decidir diferente: `targetLevel` obrigatório pede subir a versão do protocolo. Mais de uma planejada por edifício muda a forma do estado (versão nova e migração).

**C-15. O app pode calcular a prévia da alocação, que repete uma regra do motor?**
- Enquanto isso: sim. `previewAllocation` aplica no app a ordem de saída das levas em adaptação (saem primeiro as mais novas), para mostrar a taxa antes de confirmar. Hoje bate com o servidor (a revisão conferiu no ritmo 3, de 0 a 8 trabalhadores). Se a regra mudar no motor, a prévia passa a mentir sem que teste ou typecheck acuse: o lint impede o app de importar o motor, inclusive nos testes.
- Também ficaram no app, sem número de regra: "Ponha aldeões na Serraria." no aviso de frio; as causas do relatório ("a moral estava baixa", "a fome durou demais", "a moral alta atrai gente"); os limiares de apresentação, em tempo real, de 8 h ("cheio em"), 24 h ("Antes de partir") e 1 h (aviso de estação).
- Onde: `packages/web/src/ui/workers.ts`, `packages/web/src/ui/morale.ts`, `packages/web/src/components/Banners.tsx`, `packages/web/src/game/beforeLeaving.ts`, `packages/web/src/ui/format.ts`.
- Se decidir diferente: o motor manda a taxa pronta por contagem e as frases, e o app só repassa. São campos novos no `ViewState`.

**C-16. O Relatório de Retorno está contando do jeito que o autor quer?**
- "Produção" mostra o que o feudo rendeu, já descontado o consumo, e "Perdido" sai com sinal negativo, para a conta fechar na linha. A parte de uma recompensa ou devolução cortada pelo limite entra em "Recebido" e sai em "Perdido". "Perdido" pode mostrar fração (−35,2), enquanto o fecho diário conta unidades inteiras.
- Se a aba fecha entre a leitura da visão e a dos eventos, o "Antes" é a última visão coerente com o cursor, que pode não ser a que a tela mostrava na saída. Nada é contado duas vezes, mas uma ordem dada nesse intervalo aparece como gasto da ausência.
- O relatório não tem linha própria para o frio nem diz quanto ele durou (o roadmap §0.2 fala em "se faltou lenha e por quanto tempo"), e não tem contador de obras que começaram sozinhas.
- Na primeira volta depois de uma atualização do jogo o relatório sai sem as linhas de estoque (B-11) e, por isso, sem o desperdício daquela ausência.
- "Aldeões que chegaram" virou "Recrutas que chegaram", para não confundir com os colonos.
- Enquanto isso: vale tudo o que está acima.
- Onde: `packages/web/src/game/returnReport.ts`, `packages/web/src/game/gameSession.ts` (`GameCache.behind`), `packages/web/src/components/Today.tsx`; commits `c762177`, `9f92e3a` e `3d4f948`.
- Se decidir diferente: campos novos em `ReturnReportSchema` (`packages/protocol`). A conta exata do "Antes" pede o servidor mandar o cursor de eventos em toda resposta de visão, que é mudança de protocolo.

**C-17. Os textos novos do jogo estão aprovados?**
- Enquanto isso: valem os textos abaixo, todos escritos por agentes.
- Nomes: "Despensa" (comida) e "Pátio" (madeira e pedra), o lugar do recurso antes do Celeiro e do Armazém.
- Objetivo 4: a recompensa passou a ser "desbloqueia o Celeiro e o Armazém", no lugar dos 50 de ouro.
- Crônica: "com as reservas cheias, os pedreiros começaram sozinhos a erguer...". A obra começa quando o estoque cobre o custo, não quando o depósito enche; a revisão sugeriu "juntado o que faltava". "As lareiras voltaram a arder" e "o gelo cedeu" (fim do frio). "Faltou lugar no depósito, e foi ao chão: 35,2 de comida." (recompensa cortada). Na virada para a primavera, "os resmungos cessaram" sai antes de "o gelo cedeu": efeito antes da causa, pela ordem fixa do instante.
- Recusas: "Os pedreiros já estão ocupados com outra obra. A segunda fila abre com o Salão do Senhor Nv4."; "Os pedreiros já estão ocupados: não há fila de obras livre."; "A obra pede 875 de madeira e o Pátio só guarda 500: construa o Armazém primeiro."; "Essa ordem ficou para trás: a obra das Habitações agora é a do nível 3. Confira a lista e peça de novo."
- Avisos: "Os lavradores ainda se adaptam: em 2 h rendem inteiro, a comida volta a sobrar e a fome acaba. Não é preciso mexer neles."; "recrute aldeões ou ponha parte dos lavradores em outro ofício" (Despensa cheia); "Ponha parte dos lenhadores em outro ofício." (Armazém cheio com as obras esgotadas); a previsão de comida da estação seguinte ("Com a gente de agora na Fazenda, o saldo de comida no Inverno será de −18,46/h...").
- Concordância errada que vem da v0.1, não corrigida: "As Habitações já está em obras." e "As Habitações não está na lista de obras planejadas.". Os testes novos fixam a primeira frase como está.
- Onde: `packages/content/src/chronicle.ts`, `packages/content/src/balance.ts` (`storage`), `packages/content/src/objectives.ts`, `packages/engine/src/rejections.ts`, `packages/engine/src/storageView.ts`, `scarcityView.ts` e `seasonView.ts`.
- Se decidir diferente: é troca de texto. As frases da Crônica e das recusas estão em goldens e testes, que mudam junto.

**C-18. Os avisos e o desenho das telas novas estão aprovados?**
- Enquanto isso: vale o desenho abaixo, escolhido pelos agentes onde o roadmap e o GDD não diziam.
- Avisos no nível padrão ("Essenciais"): frio que começa, gente que parte ou deserta e toda queda de faixa da moral são alarmes, inclusive de Orgulhoso para Contente. O fim da fome, o fim do frio e a subida de faixa chegam como alívio (na v0.1 o fim da fome não avisava). A virada de estação também avisa. Só no nível "Todas": depósito cheio, edifício erguido, ofício dominado, obra que começou sozinha e colono que chegou.
- Aviso de estação uma hora antes, com hora de relógio ("Inverno à vista: chega em 59 min, às 21:40"): é a primeira hora de relógio que o app mostra. O título da aba do navegador repete o assunto da barra de status, inclusive a obra com prazo.
- Cabeçalho da aba Feudo: ganhou as linhas da estação, da lareira e da moral. Depois da revisão, só fica preso no topo em janela grande (a partir de 1200×580 ou 900×650, ou de 600 a 720 de largura com 650 de altura); fora disso rola com o conteúdo. Os avisos fixos do canto ainda cobrem cerca de metade da aba em 480 px de largura.
- Tabela de recursos com Estoque e Cap em colunas separadas (o roadmap pedia "412 / 1.500" em uma célula). Listas "Melhorar" e "Construir" no lugar de "Disponíveis". O botão do aviso de depósito inicia a obra direto, sem confirmação. Botão "Iniciar agora" na planejada manual que já pode começar.
- Painel "Moral" entre Trabalhadores e Recrutar. Painel de trabalhadores com duas ou três linhas por edifício. Linhas novas na árvore: "Lareira", "Moral", grupo "Planejadas" e, na linha "Hoje", "N a preparar".
- Fome e frio juntos viram uma linha só na barra de status. O ícone do frio é a chama (`flame`): os Codicons não têm floco de neve. `star-full` serve à faixa Orgulhoso e ao ofício dominado.
- "Antes de partir": até cinco itens, na ordem comida, lenha, depósitos, obras e aldeões livres. A conta da lenha também fica à vista na aba Feudo durante o outono e o inverno.
- Onde: `packages/web/src/notifications/policy.ts`, `packages/web/src/game/beforeLeaving.ts`, `packages/web/src/styles.css` e, em `packages/web/src/components/`, `Header.tsx`, `Today.tsx`, `ResourcesTable.tsx`, `ConstructionsPanel.tsx`, `WorkersPanel.tsx` e `Panels.tsx`.
- Se decidir diferente: ajustes só no app, sem tocar regra de jogo. A exceção é avisar só das faixas ruins da moral, que pede um campo novo no evento.

**Para saber (não pede decisão)**

- **O estado do jogo foi da versão 2 à 7 na fase**, um passo de migração por tarefa: frio (3), limites (4), filas (5), ofício (6), moral (7). A moral é a primeira regra que sorteia (colono e partida).
- **O protocolo continua em 1.** O `ViewState` cresceu só por adição. O app novo manda `autoStart` e `targetLevel`: contra uma API antiga, planejar e marcar respondem 400. A API tem de ir ao ar antes do app, ou junto.
- **A visão ficou de 2 a 3 vezes maior** (10 a 15 kB, contra 4,6 a 5,0 kB na v0.1), e cada recibo de ordem guarda uma. A conta da v0.1 escalada dá de 75 a 110 MB por jogador por ano na tabela `commands`; é estimativa, o volume não foi medido. Uma ordem dada como primeiro contato depois de 30 dias no ritmo Rápido leva cerca de 2.200 eventos (363 kB) na resposta e no recibo. Vale medir antes de publicar (ADR 0004).
- **O motor não é o gargalo:** `advanceTo` de 30 dias reais no ritmo Rápido leva 5,6 ms; o `GET /view` da volta de 29 dias, de 50 a 55 ms. Comando novo: `pnpm -s sim -- --perf`.
- **As 50 sementes continuam dando o mesmo resultado na matriz:** nenhum bot chega à moral que sorteia. A semente só muda a partida no feudo abandonado.
- **A Torre de Vigia não entrou na Fase C** (fica para V2E-T1). As caixas V2C-T2.1 e T2.6 foram marcadas mesmo assim, com nota; a V2C-T6.5 foi marcada sem `pnpm capture:landing`.
- **No roadmap, as caixas de V2C-T7 e a linha dela no Registro (§11) estavam em branco ao escrever,** embora T7.1 a T7.4 tenham sido feitas. T7.5 (o autor joga) continua aberta. O Apêndice B ainda não lista `targetLevel`, `STALE_LEVEL`, `calendar.nextSeason.food`, `calendar.nextFirewoodSeason`, `FirewoodView.gathered` e `reserved`, `famine.endsInSeconds`, `winter.cold.endsInSeconds` nem `lost_<recurso>`.
- **`CLAUDE.md` ficou mais desatualizado** (arquivo reservado): estado na versão 7; `settleFamine` virou `settleScarcity` e `settlePlanned`; a ordem do mesmo instante ganhou fim de adaptação, planejadas e frio; "nenhuma regra sorteia" deixou de valer; a moral está na lista de campos proibidos no estado; o app lê o servidor antes dos 30 s quando uma obra, uma espera ou uma adaptação termina; não cita `--perf`, as faixas por dificuldade nem `botFor`.
- **As frases de dificuldade continuam citando o Conselho,** que só chega na Fase D (ver B-3). A revisão da Fase C levantou a dúvida de novo.
- **O contêiner `lotg-db-test` ganhou mais um banco,** `lotg_review_srv`, deixado por um revisor, além de `lotg_e2e` e `lotg_review`.
- **Aviso de processo:** `pnpm -s typecheck | tail` esconde as falhas dos pacotes. Um erro de tipo passou assim e foi corrigido antes de qualquer relato; o certo é conferir `pnpm verify` pelo código de saída.
- **Incidente sem efeito na V2C-T2:** um heredoc de shell sem aspas executou trechos entre crases do texto que ia ser gravado (um `git log` e uma rodada do simulador, só leitura). Nenhum arquivo foi criado.
- **O teste `packages/engine/src/scarcityText.test.ts` é o primeiro do motor a trocar números do conteúdo com `vi.mock`,** para provar que o percentual da fome e do frio sai de `@lotg/content`.
- **Ao redimensionar a janela cruzando os 720 px,** a aba perde a posição de rolagem. Pequeno, visto e não corrigido.

### Fases D e E: Conselho e ameaça

Estado ao escrever: o último commit das duas fases é `b1b892a`. O registro local do Git mostra um `push` às 20:04 de 2026-10-02 que levou o `origin/main` até ele: as Fases D e E foram com o primeiro lote de correções da revisão. Quem escreveu esta seção não conferiu a CI desse envio nem se a implantação terminou. Ao escrever, dois agentes trabalhavam no segundo lote de correções (o reequilíbrio da Ameaça; defeitos do app e das cartas): os commits deles vêm depois de `b1b892a` e só aparecem aqui como decisão a confirmar. O autor não jogou nenhuma das duas fases (V2D-T5.4, V2E-T5.3) e não aprovou nenhuma carta, regra, número ou texto delas. As decisões 7 a 12, 18, 20 e 21 da tabela da seção 2 são as que estas fases aplicaram; os itens abaixo contam o que os agentes acrescentaram a elas e o que a revisão deixou em aberto. Vão do mais importante para o menos.

**DE-1. O reequilíbrio da Ameaça, feito por agentes depois da revisão, fica?**
- O que a revisão mediu com os números do ADR 0014 (+5 por dia de jogo pelo Covil de Lobos, +3 por dia no outono, −10 por incursão, chance de `Ameaça − 40` % por virada, incursão média a partir de 60): a Ameaça sobe a 90 a 100 e fica. Depois da incursão do roteiro, quase toda incursão é média (em 20 sementes e 2 anos sem ordens, nenhuma leve em cerca de 620). A Paliçada Nv1 não segura nada depois da do roteiro. Sem Paliçada são cerca de 16 incursões por ano de jogo. Em uma semana real no ritmo Rápido, o bot econômico da semente `pedra-alta-001` teve 54 incursões (10 sofridas, 44 repelidas). A revisão estimou cerca de 7 incursões por dia real no Rápido, cada uma com dois avisos para quem tem a Torre. Isso contraria o "pronto quando" de V2E-T3 ("a Ameaça oscila em vez de só subir").
- Enquanto isso: por delegação do autor ("fechar logo, com funcionalidades boas e divertidas"), um agente está trocando esses números agora. A meta que recebeu: a Ameaça oscilar numa faixa média (por exemplo de 40 a 70), a maioria das incursões ser leve, as médias virem sobretudo com o outono, e o ritmo Rápido não passar de 2 a 3 incursões por dia real. Ao escrever, os números escolhidos e a medição ainda não estavam no `main`. Vão para o ADR 0014 (decisões 10 e 11, com "aguarda confirmação do autor"), o GDD §8.2 e uma seção nova de `docs/balance-v0.2.md`. O mesmo lote corrige a linha dos 70 que saía duas vezes (dias 15 e 17), a previsão do painel que ignorava a incursão à vista ("vai de 70 para 75" e a virada entregava 65) e o teste que dizia provar a oscilação e passava com a Ameaça no teto. As medidas antigas com outras quedas estão em `docs/balance-v0.2.md` §14.4 (−20: 15,4 incursões por ano e Ameaça média 91; −30: 13,3 e 78; −40: 10,8 e 66, com 20% de leves).
- Continua com o autor depois do lote: (a) a Paliçada pede o Salão Nv3. Com os números antigos, entre a primeira incursão e o Salão Nv3 vinham de 1 a 5 incursões médias, sempre com o mesmo conselho ("Uma paliçada os teria detido."), e a frase não diz o que tranca a obra. O lote mede quantas chegam antes do Salão Nv3; carência depois da incursão do roteiro, outro portão ou um objetivo de Salão Nv3 são saídas sugeridas pelo revisor. (b) Uma partida migrada depois do 16º dia de jogo (no ritmo Rápido, toda partida com mais de 10 h reais, como as do autor) não ouve os uivos nem recebe a incursão leve do roteiro. Com os números antigos, a primeira incursão dela era média em cerca de 73% dos casos. Forçar a primeira leve, com uivos, ou deixar? Para jogar V2E-T5.3, use uma partida nova.
- Onde: `packages/content/src/balance.ts` (`threat`, `raids`), `packages/engine/src/threat.ts`, `hordeTurn.ts`, `threatView.ts`, `threat.raids.test.ts` e `migrations/v10.ts`; `docs/balance-v0.2.md` §14; ADR 0014, decisões 10 e 11 e "A Ameaça não oscila em torno de um meio"; roadmap, linha V2E-T3 do Registro (§11).
- Se decidir diferente: voltar aos números do ADR, ou escolher outros, é troca de conteúdo, com golden, GDD §8.2 e linha de base do simulador regravados. As linhas 10 e 11 da tabela da seção 2 deste documento mudam junto.

**DE-2. As 21 cartas entram como estão? A aprovação carta a carta não aconteceu.**
- Enquanto isso: as 21 estão no jogo como rascunho aprovável, com uma ficha por carta em `docs/content-v0.2.md`. Ficaram sem marca V2D-T2.2 (aprovar em lotes de cinco), V2D-T3.1 (ver a primeira carta antes da tela completa) e V2D-T2.7 (congelar o conteúdo): o hash mudou depois do inventário (`2f8434b06481af37` no inventário, `10164e0ffb6b06e8` na integração), e o segundo lote mexe em três cartas agora. O agente de integração leu que o congelamento de verdade é o do dia do playtest.
- Regras editoriais escolhidas pelo agente, para confirmar: a ordem das opções (as pagas, a de Senhor, a de Rei de Ferro); quatro cartas recorrentes (a refeição dos pedreiros, a serraria, a vigília, os viajantes) que não se repetem em seguida por uma ronda de flags `routine.*`, sem regra nova no motor; continuação em 2 dias de jogo e moral das cadeias por 3 dias (o roadmap §12.2 dava 3 e 1); "cavar" o poço sem custo de moral; custos fixos de 15 a 150, então no fim do ano pagar por moral quase sempre compensa e no começo quase nunca; o inverno sem carta própria.
- Temas escritos sem o efeito que pediam, porque a lista de efeitos do ADR 0014 é fechada: "Mais bocas à mesa" não dá aldeão, "A mesa dos aprendizes" não dá experiência do ofício, "Um teto antes do frio" não é promessa com prazo, "Lenha ainda úmida" não pune quem não age.
- No ritmo Rápido com 2 visitas por dia o jogador vê cerca de 10 cartas por ano, e as do outono saem pouco ("A colheita de todos" em 18 de 50 sementes). É o limite de duas na mesa somado ao prazo de 24 h reais. Uma carta de estação pode ser respondida na estação seguinte: 24 h reais são 36 dias de jogo no Rápido.
- Onde: `packages/content/src/cards/` (`commonGranary.ts`, `thawBridge.ts`, `palisadePromise.ts`, `standalone.ts`); as regras editoriais em `packages/content/src/council.test.ts`; `docs/content-v0.2.md` §2, §4.3 e §6; ADR 0014, decisão 7 e "Detalhes fechados na curadoria".
- Se decidir diferente: texto, números, pesos e requisitos são conteúdo, com goldens regravados. Os ids não (DE-5). Efeito novo (aldeão, experiência, custo proporcional ao estoque) é regra no motor e pede ADR.

**DE-3. A revisão editorial achou sete problemas de texto e de conta nas cartas que ficaram sem correção: entram antes do playtest?**
- Na primavera a opção dura vale mais que a neutra: "Mandar voltar ao trabalho" na refeição dos pedreiros (+15 pedra), "Deixar para depois" no poço (+20 pedra) e "Mandar todos ao campo" na notícia da primavera (+25 comida) ganham da opção sem custo em quase todo feudo dessa fase, porque −5 de moral por 2 dias custa de 2 a 18 unidades a um feudo pequeno. "Ceder a pedra" do poço custa 30 de pedra e rende cerca de 6. E o ausente de Rei de Ferro termina mais rico que o de Senhor (+34 de pedra com as duas cartas da primavera expiradas do dia 4 ao 20), contra a frase "escolhe o pior caminho" (DE-4).
- "Um teto antes do frio" diz que duas famílias dormem no palheiro e a tela mostra vagas: o feudo tinha de 3 a 23 vagas livres em 16 de 16 chegadas medidas. A opção paga fala em "duas chaminés novas" e as vagas não mudam.
- "Vigília entre vizinhos" promete o que só a Torre e a Paliçada dão: a pista diz que a fogueira afasta "o que mais rondar" e a Crônica diz "nada chegou perto dos currais". A carta sai desde o dia 4; a incursão do roteiro chega no 16º "sem que ninguém os visse vir". A frase "Quem vela de noite boceja no trabalho de dia" anuncia um custo que nenhuma opção cobra.
- As pistas da promessa da Paliçada dizem "cobra em quatro" e "mais quatro dias", sem dizer que são dias de jogo (no Rápido, 2 h 40 reais), e repetem um número de regra que nenhum teste amarra. Se o segundo lote não as trocou, continuam assim.
- "Tábuas para as reservas" e "A notícia da primavera" saem com o feudo em fome, comida 0 e moral 20 (o roadmap §12.2 dava a primeira como "sem fome").
- Na Ponte do Degelo, a pinguela é levada pelo riacho de novo a cada ano em que o senhor adia ou larga a obra; e "Largar a obra" devolve 30 de madeira a quem pagou carpinteiros em ouro.
- No Celeiro Comum, guardar e repartir levam ao mesmo desfecho com os mesmos números, mas a pista de "Partilhar a comida" ("Quem come junto costuma lembrar") promete reciprocidade. Essa é a cadeia que V2D-T5.4 pede ao autor para jogar.
- Enquanto isso: nada mudou. O revisor deixou, para cada uma, reescrita e número sugeridos, sem aplicar nem testar. O segundo lote corrige outras três (a "primeira carroça" da Ponte, a opção dominante da Promessa da Paliçada e a Ponte que não chegava a 80 de moral).
- Onde: `packages/content/src/cards/standalone.ts` (`masonsMeal`, `collapsedWell`, `springNews`, `roofBeforeCold`, `neighborsWatch`), `palisadePromise.ts`, `commonGranary.ts`, `thawBridge.ts`.
- Se decidir corrigir: quase tudo é troca de texto ou de número, com golden. A faixa de moral já é requisito de carta (o caso da fome). Dois desfechos para o Celeiro levam o lote a 22 modelos. Custo e ganho proporcionais ao feudo seriam efeito novo no motor.

**DE-4. Camponês e Senhor decidem igual em todas as cartas, e as boas-vindas prometem o contrário: muda o texto ou mudam as cartas?**
- Enquanto isso: em Camponês e em Senhor, a opção que o conselho aplica sozinho nunca tira recurso nem moral (regra "quem falta não é punido", decidida pelo agente a partir do GDD §15.1, item 5). Por isso as duas dificuldades decidem igual nas 21 cartas, e um teste de conteúdo exige essa igualdade. As descrições mostradas na criação da partida dizem outra coisa: Camponês "escolhe o melhor caminho", Senhor "decide com cautela", Rei de Ferro "escolhe o pior caminho". "Melhor caminho" também não descreve "Explicar o atraso" em "A palavra do senhor", a segunda cobrança da Paliçada (−15 por 3 dias quando a obra não existe).
- Acréscimo à decisão 9, feito em V2E-T2: a marca `autoResolveIfUnlocked`. Com a Paliçada de pé, as três cartas da cadeia dela resolvem "Mostrar a paliçada" sozinhas, nas três dificuldades, e o ausente ganha a moral inteira (+15; +10 no pedido; +5 na segunda cobrança). Sem isso, quem prometia, erguia a obra e faltava levava −15 e uma Crônica falsa. Confirmar a regra e o ganho.
- Onde: `packages/content/src/balance.ts` (`difficulties.*.description`), `packages/content/src/council.test.ts`, `packages/engine/src/council.ts` (`defaultOption`); ADR 0014, decisão 9 e "Detalhes fechados na implementação da Paliçada"; ver também B-3.
- Se decidir diferente: reescrever as descrições é troca de texto (B-3 já pergunta o tom). Cartas em que Camponês e Senhor divergem desfazem a regra "quem falta não é punido". Tirar `autoResolveIfUnlocked` volta a cobrar quem cumpriu.

**DE-5. Uma carta ou opção renomeada depois de publicada deve ter regra própria, ou basta escrever a migração à mão?**
- Enquanto isso: o motor trata a carta que o catálogo já não tem como carta que saiu, sem efeito e sem linha (ADR 0014). O primeiro lote corrigiu o lugar invisível que ela ocupava na mesa (`01f6635`) e passou a fixar por teste todos os pares carta e opção publicados. Ficou sem correção, por ser regra nova: renomear a opção de um efeito escondido já pago tira do jogador o ganho, sem linha na Crônica nem no Relatório; renomear a continuação de uma cadeia deixa a flag `<cadeia>.open` gravada para sempre, e a primeira carta nunca mais sai. A revisão reproduziu os dois casos com o catálogo editado. Com as fases publicadas, isso vale para a produção na primeira curadoria que mexer num id (DE-2).
- Onde: `packages/engine/src/council.ts` (`applyDelayedEffects`, `deliverContinuations`), `packages/content/src/council.test.ts`; ADR 0014, "Carta que o catálogo já não tem"; `docs/content-v0.2.md` §6, item 11.
- Se decidir diferente: uma linha na Crônica (ou a devolução do custo) e a cadeia que se fecha sozinha são regra do motor, com golden e ADR. Mantida a regra atual, toda troca de id pede antes um passo de migração do estado (versão nova).

**DE-6. O aviso da Torre deve ser em tempo real? E a primeira incursão deve ser sofrida sem Torre?**
- Enquanto isso: o aviso é tempo de jogo, 1 h no Nv1 e 2 h no Nv2: no ritmo Rápido são 20 e 40 min reais, e só alcança quem está com a aba aberta (não há aviso fora da página). Na simulação da revisão (2 visitas por dia, 4 dias reais no Rápido) quase nenhuma das 27 a 29 incursões anunciadas foi vista a tempo; o que a Torre entrega a quem está fora é o número da Ameaça e o relato. A obra da Paliçada (6 min 40 s reais no Rápido) cabe na janela de quem está presente. A expiração das cartas, ao contrário, é tempo real (decisão 1).
- Nenhum bot tem a Torre antes da incursão do roteiro (16º dia: 30 h de jogo; 10 h reais no Rápido). Com os objetivos, o Regular do ritmo Normal ergue a Torre entre as horas 32 e 43; um jogador focado chega lá no 8º dia de jogo. O GDD §12.3 diz que a primeira derrota custa pouco e ensina. O autor confirma que ela vem no escuro?
- O que a Torre vende como informação (dúvidas da lente da névoa, medidas com os números antigos): o tamanho que o Nv2 promete já se deduz no Nv1, pela regra que o painel imprime e pelo número da virada do sorteio (31 acertos em 31 alarmes); com a Ameaça presa acima de 60, era sempre "uma matilha grande". A incursão do roteiro desmente a regra impressa (é pequena com a Ameaça em 60), e o evento dela sai com `raidId: "wolvesYear1"`, que diz a quem lê a rede que é a do roteiro. Nada disso muda desfecho, e o reequilíbrio (DE-1) muda o peso desses pontos.
- Onde: `packages/content/src/balance.ts` (`threat.watchtowerLevels`), `packages/engine/src/threatView.ts` (`raidRisk`), `raids.ts` (`raidId`), `hordeTurn.ts`; ADR 0014, decisões 1 e 11.
- Se decidir diferente: aviso em tempo real é um número novo no conteúdo convertido pelo ritmo, como a expiração das cartas, com golden e a matriz QA-10 nos três ritmos. Id opaco no evento e uma frase de regra que não afirme o tamanho são mudanças pequenas no motor.

**DE-7. Depois de uma incursão, o botão pode mandar construir a Torre quando o que faltou foi a Paliçada? E as leituras da Paliçada estão certas?**
- Risco da revisão, sem correção: `defenseCommand` oferece a Paliçada só quando a obra dela pode começar agora; travada pelo Salão ou por recurso, oferece a Torre. Sob "Uma paliçada os teria detido." aparece "Construir Torre de Vigia" (ou "Melhorar"), ordem imediata que não muda ataque nenhum. Quando falta madeira à Paliçada, gasta justo a madeira que faltava: com o Salão Nv3 e 150 de madeira, a Paliçada está a 50 de madeira; a Torre leva 120 e a Paliçada fica a 170. Travada pelo Salão, o passo que resolve não é oferecido. É o botão do Relatório e do item de "Antes de partir", e os testes fixam o comportamento. Sugestão do revisor: "Ver a defesa" (o painel, onde está o motivo) ou "Melhorar Salão do Senhor" quando essa obra pode começar.
- Leituras do agente de V2E-T2, para confirmar: "metade" (`palisadeBreach`) vale para a perda e para os feridos (média contra o Nv1: 7,5% e 1 ferido); a Paliçada Nv1 corta o estrago, mas não evita o −10 de moral nem a linha de incursão sofrida; a frase da defesa fala de "ataques leves" e "médios" e os vigias de "matilha pequena" e "grande", para não dizer "lobos" a quem não tem Torre (um vocabulário só?); quem sempre responde "Explicar que não é hora" recebe o pedido da cerca todo ano (peso 3, nenhuma flag), e baixar o peso é o remédio se cansar.
- Onde: `packages/web/src/game/beforeLeaving.ts` (`defenseCommand`), `game/returnReport.ts` e os testes deles; `packages/content/src/balance.ts` (`palisadeLevels`, `palisadeBreach`), `packages/engine/src/threat.ts` (`palisadeAgainst`), `packages/content/src/cards/palisadePromise.ts`; ADR 0014, "Detalhes fechados na implementação da Paliçada".
- Se decidir diferente: o botão é só app. A fração, as frases e o peso da carta são conteúdo, com golden.

**DE-8. O ouro da Torre no objetivo 5 e os prêmios dos objetivos 5 a 10 ficam como estão?**
- Enquanto isso: o objetivo 5 pede a Torre (50 de ouro) antes de o jogador ter motivo para pôr gente na Mina. O bot Preguiçoso, que nunca realoca, fica sem ouro para o Salão 3 (180): em Senhor, ritmo Normal, um ano de jogo, o Salão termina no nível 4 em 30 sementes, no 3 em 11, no 5 em 8 e no 2 em uma (antes eram 48 no nível 5), e até 58 h de jogo de pedra vão ao chão (eram 16). Saídas do agente: ouro no prêmio do objetivo 4 ou 5, a Torre Nv1 sem ouro, ou confiar na frase "Faltam 50 ouro.".
- Também: os prêmios de madeira (+60 e +100) podem ser cortados pelo Pátio de 500, com a perda contada; o objetivo 10 (inverno sem frio) leva um ano de jogo, e quem cumpre os outros cedo fica com um só na tela até a primavera, e depois a lista acaba; uma carta respondida antes de o objetivo 6 aparecer conta; o prêmio de moral dura até a segunda virada (a tela mostra "por mais 2 h 47 min" ao lado de "1 dia de jogo (2 h)"); os dois bots seguem os objetivos, então a matriz deixou de medir quem os ignora (a seção 14 de `docs/balance-v0.2.md` fica como essa medida).
- Desenho do app: os cumpridos ficam recolhidos em "Cumpridos (N)" (o GDD §13.3 desenha ☑ ao lado dos em aberto); quando só falta a ordem, o app escreve "Só falta a sua ordem." ou "Pode começar agora: <custo> · <prazo>." (o GDD §12.2 diz que nada aparece); o botão de um objetivo de obra ordena sem confirmação; objetivo cumprido continua fora do nível padrão de avisos, como na v0.1; o progresso "(0/1)" deixou de aparecer nos que se cumprem de uma vez.
- Onde: `packages/content/src/objectives.ts`, `packages/engine/src/objectives.ts`, `objectivesView.ts` e `seasonWatch.ts`; `packages/web/src/ui/objectives.ts` e `components/ObjectivesPanel.tsx`; ADR 0014, decisão 12; `docs/balance-v0.2.md` §15.
- Se decidir diferente: prêmios e custos são conteúdo, com golden e linha de base. O desenho é só app.

**DE-9. A carta que expira deve liberar o lugar para o sorteio do mesmo instante?**
- Enquanto isso: não. O sorteio roda antes da expiração (a ordem do ADR 0013). Nos ritmos Normal e Rápido o prazo de 24 h reais é múltiplo exato da cadência (12 e 36 dias de jogo), então toda carta sem resposta expira em cima de uma audiência, que encontra a mesa cheia e é pulada. Para quem não responde: no Normal, 2 cartas a cada 4 audiências em vez de 2 a cada 3 (cerca de 25% menos); no Rápido, 2 a cada 10 em vez de 2 a cada 9; no Tranquilo não acontece. Medido em 104 dias de jogo sem resposta: 14 cartas no Normal, 6 no Rápido, 26 no Tranquilo.
- Outras leituras do agente de V2D-T1, para confirmar: o sorteio é na virada do dia, depois da moral; a partida migrada tem a primeira audiência na primeira virada a partir de fronteira + 4 dias (até um dia de jogo a mais que o ADR: 40 min reais no Rápido); o efeito escondido acontece sempre N viradas depois (no mínimo uma), nunca no instante da escolha; `CARD_EXPIRED` vale só para cartas expiradas no ano de jogo corrente, e depois da virada do ano a mesma resposta recebe `CARD_NOT_PENDING`; `minDay` conta desde a fundação, não desde o começo do ano; "as mesmas ordens nos mesmos instantes de jogo dão o mesmo feudo em qualquer ritmo" deixa de valer quando uma carta expira. Observação de um revisor, sem correção: uma carta de uma vez por ano que atravessa a virada do ano na mesa pode ser sorteada de novo logo depois de resolvida.
- Onde: `packages/engine/src/advance.ts`, `councilTurn.ts` e `council.ts`; o teste "o sorteio do mesmo instante ainda vê a carta que expira" em `council.test.ts`; ADR 0014, decisões 1 e 18 e "Detalhes fechados na implementação do motor do Conselho".
- Se decidir diferente: inverter a ordem é regra do motor, com golden e a propriedade de divisão de intervalo rodada de novo.

**DE-10. As leituras da Ameaça e das incursões feitas pelos agentes estão certas?**
- A Ameaça sobe na virada do dia, depois do Conselho, com ou sem Torre. O +3 do outono conta os dias de outono que passam, para a tela dizer "+3/dia: outono" enquanto é outono.
- `threatRose` só existe para quem tem a Torre naquela virada; quem a ergue depois de a marca passar não recebe a linha atrasada. Sem Torre, os tiles também ficam fora da visão: o jogador não sabe que há um Covil de Lobos.
- A incursão do roteiro nasce marcada com a partida e, enquanto está marcada, nenhuma outra é sorteada: a primeira de toda partida nova é a leve do 16º dia.
- Quem se fere: primeiro quem está sem ofício. O ferido guarda o ofício e volta a ele sozinho ao sarar, já adaptado (o Apêndice B previa só `untilMs`). A recuperação vem antes do calendário no mesmo instante (o roadmap §0.7 punha os feridos no fim), para o ofício não perder experiência.
- O termo de moral da incursão tem um `id` só: uma segunda incursão renova o prazo, não soma outro −10. Só entra com perda.
- Nenhuma previsão da visão conta com uma incursão marcada, para não vazar pela névoa: o "acaba em" da comida é o de quem não é atacado.
- A Crônica arredonda a perda a uma casa decimal; os valores exatos vão em `raided_food` e `raided_wood` (prefixo novo, porque `lost_` já era o ganho cortado pelo depósito).
- Volume: uma incursão sofrida gera de 3 a 6 linhas na Crônica (alarme, ataque, cada ferido, cada um que sara). Juntar os feridos em uma linha é uma opção.
- Enquanto isso: vale tudo o que está acima.
- Onde: `packages/engine/src/threat.ts`, `raids.ts`, `hordeTurn.ts` e `threatView.ts`; `packages/content/src/chronicle.ts` (`raidTemplates`, `injuryTemplates`); ADR 0014, "Detalhes fechados" de V2E-T1 e V2E-T3; GDD §8.2 e §14.11.
- Se decidir diferente: cada ponto é regra do motor ou frase do conteúdo, com golden e GDD.

**DE-11. O `426` continua decidido só por `X-Lords-Protocol`, por igualdade exata?**
- Enquanto isso: sim. Com `X-Lords-Protocol: 1`, as 13 rotas testadas pela revisão respondem `426` antes da autenticação e sem efeito: o refresh token não é consumido e nenhum recibo é gravado. O app publicado manda o cabeçalho em toda chamada, então a aba antiga fica protegida. Sem o cabeçalho a requisição é atendida (de propósito, pelo monitor de saúde), e `X-Lords-Client` não é lido. Cabeçalho vazio ou `3` também recebem "Há uma versão nova do jogo. Recarregue a página.": um app mais novo que a API (o app no ar antes da API, ou a reversão só da API) recebe uma instrução que não resolve.
- Onde: `packages/server/src/plugins/errors.ts`, `packages/protocol/src/index.ts` (`PROTOCOL_VERSION`), `packages/server/test/council.test.ts`; ADR 0014, "Compatibilidade" e a linha "Qual cabeçalho diz o protocolo"; roadmap §0.7 e V2D-T1.8.
- Se decidir diferente: confirmar o mecanismo pede só corrigir o roadmap e a seção "Compatibilidade" do ADR, que ainda falam em comparar `X-Lords-Client` com uma versão mínima. Uma mensagem própria para o protocolo maior que o do servidor é mudança pequena no servidor.

**DE-12. A ordem da barra de status e os níveis de aviso das Fases D e E estão certos?**
- Barra de status e título: as decisões pendentes passam na frente da fome e do frio (a ordem do roadmap, V2C-T6). Com cartas a cada 8 h (2 h 40 no Rápido) e 24 h de prazo, quem não responde na hora tem decisão pendente quase sempre: "Fome em Pedra Alta", com o destaque de alarme, deixa de aparecer na barra e no título, que fica "(1) Pedra Alta". A revisão pergunta se a carta só deve passar na frente com o prazo curto. A incursão à vista ("Lobos em 16 min") passa na frente de tudo, menos da falta de ligação, sem destaque de alarme: o app não sabe se a Paliçada vai segurar (daria com um campo estruturado em `threat.incoming`).
- Níveis: no padrão ("Essenciais") avisam a carta nova, a marca da Ameaça (sem tom de alarme), os uivos (prenúncio), o alarme e o ataque sofrido (alarme) e o ataque repelido (alívio, também para quem não tem Torre). Só em "Todas": carta expirada e efeito escondido. Não avisam: carta respondida, ferido e recuperação.
- Escolhas do primeiro lote: seguir qualquer aviso do jogo ("Ver", "Decidir") recolhe todos os avisos do jogo à vista, não só os do mesmo assunto (a alternativa é uma pilha compacta); um relato novo dos vigias toma o lugar do anterior; o aviso de carta nova diz até que hora ela espera ("por 23 h, até amanhã às 08:20"; o tom "até as", sem crase, é para confirmar). "Antes de partir" ganhou o item da Ameaça (com a Torre, chance acima de zero e a Paliçada abaixo do teto), mas a chance citada é só a da próxima virada; uma frase sobre a ausência inteira pede previsão no motor.
- Onde: `packages/web/src/ui/format.ts` (`statusTopic`), `notifications/policy.ts`, `app/controller.ts`, `game/beforeLeaving.ts`, `ui/council.ts`; GDD §13.5; commits `b2f4ae1`, `1a9f3f9` e `b1b892a`.
- Se decidir diferente: ajustes só no app. A exceção é o destaque só para o ataque que passa, que pede campo novo na visão.

**DE-13. O desenho da aba Conselho está aprovado?**
- Enquanto isso: vale o desenho escolhido pelo agente de V2D-T3. A aba é fixa (sempre à vista com um feudo aberto, com o número de cartas), não uma aba que abre e fecha como a Crônica. Clicar numa opção responde na hora, sem confirmação; a decisão é irreversível e o custo fica logo abaixo do botão. "Decidir", no aviso e na aba Hoje, leva à aba; só a árvore e a paleta abrem a lista de opções, e com uma carta só a paleta pula a lista de cartas. O prazo arredonda para baixo: uma carta recém-chegada mostra "expira em 23 h". O destaque de "expira logo" usa 8 h de relógio, o limiar de "cheio em". Título e texto da carta usam letra com serifa do sistema (Georgia e afins), a primeira fonte diferente da interface. Depois de responder, a frase da Crônica da escolha aparece por alguns segundos. A carta nova não entra no contador de novidades, só no de decisões.
- Onde: `packages/web/src/tabs/Council.tsx`, `components/CouncilCard.tsx`, `ui/council.ts`, `palette/commands.ts`.
- Se decidir diferente: só app. O segundo lote corrige "Nada ainda" em "O que o conselho registrou" e as linhas cortadas da árvore.

**DE-14. O Relatório de Retorno em três blocos conta a ausência do jeito que o autor quer?**
- Enquanto isso: a ausência sai em "O feudo prosperou", "O que exigiu um preço" e "Você ainda pode decidir", cada item com botão, e "A Crônica da ausência" fica recolhida. Escolhas dos agentes: o item ganhou `topic`, `severity` e `action.label` além do Apêndice B; com o relatório à vista, a seção "Decisões pendentes" some e as cartas ficam no bloco; a linha de contagens e a linha solta de desperdício saíram; ordens dadas em outro navegador, viradas de estação e de ano, cartas que chegaram e marcas da Ameaça ficam só na Crônica da ausência (uma virada de estação muda as taxas do feudo inteiro); a carta expirada vai sempre para "preço", mesmo quando a opção automática deu algo; a aba que ficou fora de vista por 4 h ou mais recebe um aviso com "Ver", sem trocar de aba sozinha; "Sua escolha voltou" aparece só na Crônica, porque a visão não diz quem decidiu a carta anterior, e "A decisão do conselho voltou" é frase nova do servidor; a coluna "Levado" só aparece quando houve saque (a alternativa é somar a "Perdido"); só "Ver a defesa" leva ao painel, e os outros "Ver…" abrem a aba Feudo no topo; os blocos não têm limite de linhas; a linha única de vários objetivos usa a recompensa nominal, não o que coube no depósito.
- Onde: `packages/web/src/game/returnReport.ts`, `components/Today.tsx`, `tabs/Chronicle.tsx`, `tabs/markdown.ts`; `packages/server/src/games/chronicleMarkdown.ts`; `packages/protocol/src/report.ts` (`ReturnReport.blocks`); commits `4c70926`, `aadf88a` e `5911c3d`.
- Se decidir diferente: quase tudo é só app. "Sua escolha voltou" no relatório pede que `followsFrom` diga quem decidiu (campo novo na visão).

**DE-15. A ordem da aba Feudo e o lugar da Ameaça estão certos?**
- Risco da revisão, sem correção: no feudo recém-fundado a coluna direita é Construções (com Celeiro, Armazém, Torre e Paliçada trancados), depois o painel da Ameaça (que repete Torre e Paliçada, com o mesmo cadeado e dois botões desabilitados), e só então Objetivos e Crônica. Em 1280×800 o título "Objetivos" fica a 1.437 px do topo, com 739 px úteis; em 720×800, com a árvore recolhida, a 1.867 px de 2.357. O jogador novo em tela estreita rola duas telas e meia até o primeiro objetivo.
- Escolhas dos agentes: a Ameaça não entrou no cabeçalho como número (o GDD §13.3 desenha "Ameaça 42" ali) nem tem aviso no alto das abas, como a fome e o frio; o painel fica depois de Construções, abaixo da dobra em 1280×800; com a Torre ele mostra vigias, defesa e Torre, nessa ordem; a linha "Ameaça" da árvore ganhou um botão (a Torre; com ela, a Paliçada); a árvore ganhou o grupo "Objetivos", aberto, como último filho do feudo (até quatro linhas a mais; o GDD §13.2 não lista objetivos na árvore); os feridos aparecem no cabeçalho ("Feridos N (o próximo sara em …)") com o ícone `pulse`.
- Onde: `packages/web/src/tabs/Fief.tsx`, `components/ThreatPanel.tsx`, `components/Header.tsx`, `ui/threat.ts`, `ui/treeModel.ts`; GDD §13.2 e §13.3.
- Se decidir diferente: só app. Mexer na aba Feudo pede `pnpm capture:landing`, e as capturas já estão velhas desde a Fase C.

**DE-16. Os textos novos das Fases D e E estão aprovados?**
- Enquanto isso: valem os textos abaixo, todos escritos por agentes (as cartas estão em DE-2 e DE-3).
- Painel da Ameaça (`raidRisk`), em língua de sistema segundo a revisão: "…tem 55% de chance de marcar uma incursão (a chance é o que a Ameaça passa de 40, em %)…". "Marcar" é o verbo do estado, não do mundo, e "Se não houver outra a caminho" é a única pista de que pode já haver uma que os vigias não viram. O painel deve explicar a fórmula ou contar o que os vigias sabem? O revisor deixou uma reescrita com os mesmos números; os números podem mudar com DE-1.
- Névoa e tetos: "Sem uma Torre de Vigia, ninguém sabe o que ronda o feudo."; "Os níveis seguintes chegam em versões futuras do jogo." (Torre); "A Muralha de Pedra chega em uma versão futura." (Paliçada).
- Paliçada: "Paliçada Nv1: segura ataques leves, sem perda nem ferido; os médios passam, mas com metade do estrago." (o roadmap sugeria "os médios ainda custam metade") e as frases de `incoming.defenseText`.
- Objetivos: os porquês do 6 ("Quem se cala deixa o conselho decidir em seu lugar."), do 8, do 9 e do 10; o título do 7 ("Construa o Celeiro ou o Armazém"); os rótulos de moral "O Senhor ouviu o Conselho" e "Inverno sem frio".
- Conselho e protocolo: "A decisão do conselho voltou" (continuação de uma carta expirada); "Há uma versão nova do jogo. Recarregue a página." (o `426`); as notas da mesa ("O conselho não tem assunto novo para o feudo como ele está…"); as recusas novas (`CARD_NOT_PENDING`, `CARD_EXPIRED`, `INVALID_OPTION`, `OPTION_LOCKED`).
- Onde: `packages/content/src/chronicle.ts`, `objectives.ts` e `balance.ts`; `packages/engine/src/threatView.ts`, `councilView.ts` e `rejections.ts`; `packages/server/src/games/chronicleMarkdown.ts` e `plugins/errors.ts`.
- Se decidir diferente: é troca de texto. As frases estão em goldens e testes, que mudam junto.

**DE-17. As políticas novas do bot e os testes afrouxados nestas fases ficam?**
- Políticas novas: "responder a carta" paga a opção mais cara que cabe com folga (3 vezes o custo, sem tirar da próxima obra, da reserva de comida nem da lenha) e vem depois das obras e do recrutamento; o Preguiçoso ganhou "responder a carta sem gastar"; "erguer a Torre" quando o custo cabe duas vezes no estoque, antes das outras obras; "erguer a Paliçada" com incursão à vista ou chance acima de zero (portanto só com a Torre); "seguir os objetivos", nos dois bots. O bot nunca promete na cadeia da Paliçada e não lê a consequência das cartas.
- Testes afrouxados, com o motivo escrito neles: trocas de ofício por visita (menos de uma a cada dez trabalhadores, depois a cada quatro, depois três a cada dez); a fila ociosa do início automático (de "menos da metade" para "menos de dois terços" da partida de controle); a cadeia do Celeiro no Rápido (de 20 para 15 sementes; mediu 19); o Armazém no ano do Rápido em Senhor (3 de 50 sementes ficam sem ele até a hora 57); a cobertura aceita as duas continuações da Paliçada com zero aparições.
- Achados de balanceamento que ficaram para V2F-T1: um feudo pequeno que gasta o ouro e não tem ninguém na Mina para de crescer, porque o recrutamento custa ouro; em Rei de Ferro, no Rápido, a semana chegou a 60 h de jogo de comida indo ao chão (eram 27); a menor moral do Preguiçoso no Rápido caiu de 40 para 30 em Senhor; duas variações da matriz não foram investigadas (em V2E-T1, a menor população do Regular no Tranquilo caiu de 54 para 48 em Camponês e de 53 para 47 em Rei de Ferro).
- Enquanto isso: a linha de base das faixas foi regravada em cada tarefa, nas três dificuldades. São valores medidos com folga, não metas (B-7 e C-13 continuam valendo).
- Onde: `packages/sim-cli/src/bots/policies.ts`, `bots/index.ts`, `bands.ts`, `balance.test.ts`, `coverage.test.ts`; `docs/balance-v0.2.md` §10 a §15.
- Se decidir diferente: reverter uma política muda a linha de base e as medidas de DE-1 e DE-8, que saíram deste bot.

**DE-18. Os testes em navegador podem rodar com o Conselho em recesso e a Horda calada por padrão?**
- Enquanto isso: sim. O servidor de teste adia o sorteio do Conselho (`/__test/council-recess`) e marca a incursão para daqui a mil anos (`/__test/horde-quiet`) em toda partida. Só os cenários que chamam `world.conveneCouncil()` e `world.wolvesRoam()` (em `07-conselho.spec.ts` e `08-ameaca.spec.ts`) têm cartas e lobos. Torre, Paliçada e Salão são postos no nível direto no estado (`/__test/raise`) nos cenários das incursões e dos objetivos. Sem o isolamento, todo cenário com mais de 8 h de jogo dependia de qual carta a semente tirava. Ficou também um teste permanente com rede lenta artificial (cerca de 1,7 s), que guarda a correção do `world.passTime` (`831c761`).
- Onde: `tests/e2e/server.ts`, `tests/e2e/helpers.ts`, `07-conselho.spec.ts`, `08-ameaca.spec.ts`; `packages/web/README.md`, "O tempo nos testes em navegador".
- Se decidir diferente: semente fixa em toda a suíte, com as expectativas reescritas para as cartas e os lobos de cada cenário.

**Para saber (não pede decisão)**

- **O estado do jogo foi da versão 7 à 11 nas duas fases:** Conselho (8), Torre, Ameaça e tiles (9), Paliçada (10), feridos (11). Os objetivos 5 a 10 não subiram a versão: a memória deles fica em `stats` (`plansMarkedAuto`, `coldSpellsThisSeason`, `seasonsSurvived:<estação>`), e os retratos da versão 11 foram regravados como goldens, não congelados.
- **O protocolo subiu para 2.** O `ViewState` ganhou `council`, `pendingDecisions`, `threat` (forma fechada por `known`, que recusa o número sem Torre), os feridos e `objectives[].missing` e `target`; o `ReturnReport` ganhou `blocks` e `raided`. O cache do app de outra versão é descartado.
- **Com o Conselho, as 50 sementes da matriz passaram a dar resultados diferentes.** Era a ressalva das Fases B e C.
- **O hash do conteúdo mudou a cada tarefa:** `aee14c5417faa5be` (V2D-T2), `2f8434b06481af37` (V2E-T2, o que o inventário cita), `d66e3b00127b316f` (V2E-T3), `10164e0ffb6b06e8` (integração). O segundo lote muda de novo.
- **O registro do roadmap ficou atrás da publicação:** a linha "V2DE (integração)" do Registro (§11) e o rodapé "Próximo passo" dizem que as Fases D e E estão só no `main` local; o `push` das 20:04 tornou isso falso.
- **No roadmap continuam sem marca** V2D-T2.2, T2.7 e T3.1, e V2D-T5 e V2E-T5 inteiras. As caixas de V2C-T7 e a linha de V2F-T5 continuam como a Fase C deixou.
- **GDD e código divergem em três frases** (dúvida da revisão, só texto): §8.2 data a marca dos 40 no 8º dia (o jogo diz 9º) e fala em "sem incursão nenhuma", que não existe em partida nova; §6.2 esquece a Paliçada entre os edifícios que nascem no nível 0; §12.3 lista "a carta roteirizada do dia 2" sem etiqueta de versão, e o ADR 0014 a deixou para a v0.3. O segundo lote reescreve a §8.2.
- **`docs/architecture.md` foi editado na integração:** quatro linhas que a v0.2 tornou falsas, entre elas o limite do Relatório para a aba que fica aberta. O título do documento continua "Arquitetura da v0.1".
- **`CLAUDE.md` ficou mais desatualizado** (arquivo reservado): estado na versão 11, protocolo 2, o Conselho, a Ameaça e as incursões na ordem do mesmo instante, a moral e o Conselho sorteiam, as rotas `/__test` novas, o conselho em recesso e a Horda calada nos testes em navegador, e `world.passTime` agora espera sozinho as chamadas em voo.
- **O conteúdo escondido não chega ao navegador, e agora isso é vigiado:** desde `069417d` o lint barra no app `@lotg/content` e `contentHash`, e `bundle.test.ts` procura no pacote compilado as flags, as frases dos efeitos escondidos e as chaves das regras. Antes, só o tree-shaking segurava.
- **A falha intermitente do portão de V2D-T4 era do teste, não do app:** `world.passTime` dava o ciclo por terminado com uma leitura pedida antes do salto. Corrigido em `831c761`, sem mudar código de produção.
- **Defeito visto de passagem, sem correção:** mudar o tamanho da janela enquanto se digita nas boas-vindas remonta o formulário e apaga o nome digitado.
- **Por leitura, sem reproduzir (herança da v0.1):** uma falha na leitura dos eventos logo depois de a visão chegar, seguida de recarga, pode perder o Relatório, porque `lastSeenAt` já foi gravado.
- **Um teste de navegador não confere o que o nome diz:** em `07-conselho.spec.ts`, "em 720 px… as opções descem uma embaixo da outra"; em 720 px as três opções continuam lado a lado (legíveis).
- **O contêiner `lotg-db-test` ganhou mais um banco,** `lotg_review2`, deixado por um revisor (além de `lotg_e2e`, `lotg_review` e `lotg_review_srv`). `lotg_review_proto2` foi criado e removido.
- **Branches e árvores locais:** `web-track` e `docs-track`, e as árvores `web-lane` e `docs-lane` na pasta temporária da sessão.

## 5. O que não foi verificado

### Fases A e B

Do mais arriscado para o menos.

1. **Reversão com duas imagens em banco descartável (V2B-T1.6).** Não foi feita. O procedimento de `deploy/README.md`, a janela da troca de contêiner e a publicação em dois passos saíram da leitura do código, dos testes de integração e de uma prova com o motor da `v0.1.0`. Motivo: sem acesso ao Coolify, e nenhum ensaio com imagens Docker foi montado.
2. **Nenhum estado de produção passou pela migração.** Só os retratos gerados pelo motor da v0.1 e as três partidas do banco de desenvolvimento. A guarda da versão 1 é exata: qualquer variação imprevista vira 500 para aquela partida. Motivo: sem acesso ao banco de produção.
3. **Restauração com `pg_dump` e `pg_restore` de verdade.** O que o README diz sobre sessões, os três passos novos e a reimportação das sessões foi provado só com cópias de tabelas no banco de teste. Os passos não foram ensaiados no ambiente `ensaio`.
4. **O caminho de um `push` só.** Não se sabe se um deploy do Coolify com a aplicação parada sobe o contêiner novo sem religar o antigo.
5. **O servidor inteiro da `v0.1.0` diante de um estado da versão 2.** Só o motor foi rodado. A afirmação de que o servidor antigo regrava o número de versão que leu vem da leitura do código da tag.
6. **App e API em versões diferentes durante a implantação.** App novo contra API ainda na v0.1: as boas-vindas caem limpas, mas as Preferências mostrariam os rótulos de dificuldade e ritmo vazios ou "undefined"; não há teste. App da v0.1 contra o servidor novo: não foi exercitado, só lido e coberto pelo teste de criação sem os campos novos.
7. **Só Chromium.** Firefox e Safari não foram abertos (em especial o seletor `:has()` do negrito e as setas nos rádios). Leitor de tela não foi usado. A suíte não rodou com `CI=1`.
8. **Ritmo da produção no navegador.** A suíte inteira só rodou com o servidor de teste no ritmo 1. No ritmo 3 rodaram os dois cenários "ritmo". O catálogo com `GAME_TIME_SCALE=3` só tem teste de unidade. Normal e Tranquilo não têm cenário de prazos.
9. **Correções da revisão no app sem cenário de navegador.** A volta depois de uma atualização e a trava de "Nova partida" têm só teste de unidade. Também não foram reproduzidos: o salto de layout quando o catálogo chega depois do primeiro desenho (um clique em "Jogar agora" pode cair em um rádio), duas abas em versões diferentes do app dividindo o cache, e o cache HTTP de `/catalog` em navegador de verdade.
10. **Migração em lote sob carga.** O orçamento de 20 s do job com muitas partidas não foi medido. A migração concorrente foi conferida por leitura do código, não com duas réplicas.
11. **Sorteios de verdade.** Nenhuma regra sorteia ainda. A divisão de intervalo com sorteios foi provada com um evento de teste. O teste "deriveViewState não sorteia" passa hoje porque não há o que sortear e terá de ser reescrito com a primeira mecânica. O SplitMix32 não foi comparado com vetor de fonte externa.
12. **Consultas de playtest em produção.** `deploy/analytics/ops.sql` nunca rodou no banco de produção. O ensaio foi no banco de desenvolvimento, com horários sintéticos em transação desfeita. O caminho para achar o identificador da conta foi lido no código, não aberto em navegador.
13. **`pnpm capture:landing` e `pnpm test:e2e:landing` não foram rodados.** As boas-vindas ficaram mais largas e o roteiro de captura passa por elas. O roteiro foi lido, não executado, porque regrava as imagens.
14. **Simulador contra servidor.** `--remote` com o bot `preguicoso` e `--smoke` não foram rodados. A fila ociosa é amostrada ao fim de cada hora real: obras de minutos não aparecem como fila ocupada.
15. **Textos e documentos que ninguém além do agente leu.** O convite do playtest, as frases de dificuldade e de ritmo, a frase nova da aba Hoje. Os documentos em Markdown não foram vistos em um visualizador. O Registro do roadmap foi conferido contra o código por amostra, não linha a linha.

### Fase C

Do mais arriscado para o menos.

1. **Ninguém jogou a fase.** A V2C-T7.5 (o autor joga) não aconteceu, e o agente de integração não abriu o jogo em navegador para olhar as telas. Tudo se apoia nas suítes automáticas e em bots. Se marcar obras automáticas, ler "Antes de partir" e entender o painel de moral é claro e gostoso, ninguém viu.
2. **Nenhum estado de produção passou pelas migrações 3 a 7.** Só os retratos do motor e linhas gravadas no banco de teste. As partidas do banco de desenvolvimento migram na próxima leitura, e isso não foi conferido. Os efeitos na fronteira (C-3) nunca foram vistos em uma partida de verdade.
3. **App e API em versões diferentes.** Uma aba antiga diante do servidor novo não foi exercitada: pelo código, em produção o app não valida as respostas (`validateResponses` só vale em desenvolvimento), então deve ler a visão nova sem erro. O app novo contra uma API antiga recebe 400 ao planejar e ao marcar; não há teste.
4. **Fome, frio e gente indo embora não aparecem na matriz do simulador.** Em 2.250 partidas, nenhum bot passa fome nem frio nem perde um aldeão. A política `guardar lenha` só está provada em teste. Não há medida de quanto a deserção ou o frio custam a um feudo jogado por uma pessoa. O colono e a faixa Orgulhoso só existem em testes com efeitos gravados à mão.
5. **O furo da fome (C-4) e os dois defeitos das previsões (C-8) não têm teste.** Foram reproduzidos com testes temporários, apagados depois.
6. **Nenhum ajuste de número proposto foi simulado.** As contas de teto (C-1) são custo contra capacidade, no papel. O efeito na matriz só se sabe rodando.
7. **Carga, volume e concorrência.** O teste de carga da v0.1 (`--remote`, 50 bots) não foi repetido: p50 e p95 de `/view` e `/commands` com a visão de hoje não foram medidos. O volume da tabela `commands` é estimativa. `--smoke` não foi rodado. O jogo aleatório da revisão pela API foi sequencial: as ordens novas não foram testadas em corrida. Ausências maiores que 27 dias de relógio ficaram de fora.
8. **Cenários sem navegador de verdade.** As duas filas abertas (Salão Nv4) contra o servidor real; a recusa `EXCEEDS_STORAGE`; o estoque herdado acima do limite; fome e frio ao mesmo tempo; o frio que termina pela primavera; várias levas em adaptação no mesmo edifício; os avisos de colono, de obra que começou sozinha e de "decisões pendentes". Têm teste de motor, de servidor ou sem DOM, mas não de tela.
9. **Ritmo da produção no navegador.** A suíte inteira roda com o servidor de teste no ritmo 1. No ritmo 3 rodaram os três cenários "ritmo" e o cenário novo "fim do verão". O aviso de estação no ritmo Rápido e o ritmo Tranquilo na tela não foram exercitados.
10. **Só Chromium, sem leitor de tela.** Firefox e Safari não foram abertos (o cabeçalho usa `:has()`; a caixa de seleção das planejadas depende de `preventDefault` no clique). O tema escuro não foi olhado em captura no inverno e no frio. No alto contraste, a caixa marcada das planejadas aparece só como um tique, sem o quadrado. O teste de contraste não inclui a lista de planejadas.
11. **Os goldens grandes não foram lidos linha a linha.** `scenario-7-days.json` e `view-seed-pedra-alta.json` mudaram milhares de linhas por commit, e o roteiro do cenário mudou nos mesmos commits que as regras (T2, T5, T3 e T4). O "conferido linha a linha" do roadmap vale para as Crônicas (`chronicle-objectives.txt`, `chronicle-winter.txt`), não para esses dois.
12. **O que a revisão independente não fez.** Os quatro revisores não rodaram `pnpm verify` nem as suítes inteiras (por instrução): o verde do `main` vem do portão, não deles. Não revisaram `docs/balance-v0.2.md`. Não abriram o frio em navegador nem conferiram a árvore lateral em largura de computador.
13. **Tudo rodou em Node 24.19.0 e em uma máquina só (Apple M5).** O repositório pede o Node 22 (`.nvmrc`), que é o da CI. Nada da fase passou pela CI. Os tempos de desempenho não se comparam com os da v0.1, medidos em outra máquina.
14. **`pnpm capture:landing` não foi rodado em nenhuma tarefa,** por instrução. As três capturas e o `og.png` da página de apresentação mostram a aba Feudo de antes da Fase C. Ficou para V2F-T4.2. `pnpm test:e2e:landing` rodou só na integração (37 passaram, 7 pulados).
15. **Medidas que não se repetem e casos de borda do app.** Várias comparações de política do bot foram feitas com uma ou três sementes e com código que não ficou no repositório; as trocas de ofício foram contadas por um script de fora; das 110 h de fila ociosa do Regular no ritmo Rápido, só 55 foram explicadas. No app, por leitura e sem reprodução: duas abas com o aviso de estação podem sobrescrever a marca `seasonWarned` uma da outra; um relatório lido horas depois mistura a moral antiga com o conselho da visão atual; eventos criados por outra aba entre a leitura da visão e a dos eventos ficam fora do relatório seguinte.

### Fases D e E

Do mais arriscado para o menos.

1. **Ninguém jogou as fases.** V2D-T5.4 (o autor joga "O Celeiro Comum") e V2E-T5.3 (os caminhos preparado, despreparado e ausente) não aconteceram, nem V2D-T3.1 (o autor ver a primeira carta antes da tela completa). Os agentes olharam capturas, e um revisor percorreu 39 h de jogo no navegador de testes, com saltos de relógio. Se as cartas, os lobos e os objetivos divertem, ou se as incursões cansam, ninguém sabe.
2. **A revisão foi enxuta.** Sete revisores, um por lente, levantaram 35 achados. Só o primeiro lote de correções está completo (cinco achados, um deles em parte). O segundo lote (o reequilíbrio da Ameaça e cinco defeitos do app e das cartas) estava em andamento ao escrever, e quem escreve não viu o portão dele. Os outros 18 achados, riscos e dúvidas, foram adiados a pedido do autor, para fechar logo. Os revisores não rodaram `pnpm verify` nem as suítes inteiras (por instrução), e as reproduções deles eram testes temporários, apagados depois: só os achados corrigidos viraram teste. As medidas da revisão são de Senhor; Camponês, Rei de Ferro e o ritmo Tranquilo ficaram de fora.
3. **A rodada do simulador com cartas (V2D-T5.3) não foi feita.** Ela pedia perfis de 1 e 2 visitas por dia em cada ritmo, contando cartas vistas, respondidas, expiradas e bloqueadas pela mesa cheia, e cadeias iniciadas e concluídas. A matriz roda com o Conselho ligado, mas o bot responde sempre e nunca deixa expirar, nunca promete na cadeia da Paliçada ("O prazo da paliçada" e "A palavra do senhor" aparecem zero vezes em 100 partidas) e não lê a consequência das cartas. A cobertura não foi medida no Tranquilo nem com 1 visita por dia. Expiração, efeito escondido e cadeias são provados só por testes do motor, pela integração e pelo golden.
4. **Os números novos da Ameaça (DE-1) não passaram por revisão.** Quem os escolhe é o mesmo agente que os mede, com bots. Nenhum revisor os viu e nenhuma pessoa jogou com eles.
5. **Nenhum estado de produção passou pelas migrações 8 a 11.** Só os retratos do motor e linhas gravadas no banco de teste; as partidas do banco de desenvolvimento não foram conferidas. Com o `push` das 20:04, a produção migra na próxima leitura de cada partida, e ninguém olhou o resultado. A partida migrada depois do 16º dia não recebe uivos nem a incursão do roteiro (DE-1). Se a primeira leitura de uma partida migrada cair no mesmo milissegundo em que o estado parou, a lista de objetivos vem sem ativos até a leitura seguinte (segundo o agente, não acontece em produção).
6. **App e API em versões diferentes.** A aba do protocolo 1 diante do servidor novo só foi vista pelo teste do `426` e por cabeçalho injetado; a troca real de imagens, a janela do deploy e a reversão só da API não foram ensaiadas. O app novo diante de uma API antiga recebe "Recarregue a página", que não resolve (DE-11). As imagens Docker não foram construídas na integração.
7. **Cenários sem navegador de verdade.** Os testes em navegador rodam com o Conselho em recesso e a Horda calada (DE-18). Nos cenários de incursão e de objetivos, Torre, Paliçada e Salão Nv3 são postos direto no estado, não construídos pela tela. Só em teste sem DOM: incursões sorteadas e médias, a Torre Nv2 com o tamanho à vista, a Paliçada em obras durante o aviso, a Ameaça no máximo, a continuação com `followsFrom` fora do cenário "três blocos", e a partida migrada aberta na tela.
8. **Ritmo da produção no navegador.** A suíte roda no ritmo 1. No ritmo 3 rodaram os quatro cenários "ritmo" de `03-retorno-e-conexao`. O "(40 min)" dos prêmios de moral, o painel da Ameaça e os prazos das cartas no Rápido foram conferidos só sem DOM, com o golden.
9. **Só Chromium, sem leitor de tela.** Firefox e Safari não foram abertos (o `<details>` do Relatório e dos objetivos, o foco em `<li tabindex=-1>` na Crônica, a letra com serifa da carta). Rótulos, `aria-describedby` e regiões vivas foram conferidos no HTML e pelo Playwright. O descarte real de uma aba em segundo plano pelo navegador foi simulado com `visibilitychange`.
10. **Falhas intermitentes.** O portão de V2D-T4 falhou uma vez (a corrida do `world.passTime`, corrigida em `831c761`). Um revisor viu o cenário "sem Torre e sem Paliçada…" de `08-ameaca.spec.ts` falhar na primeira execução do arquivo e passar nas cinco seguintes; não guardou a mensagem nem achou a causa (pode ter sido disputa das portas e do banco `lotg_e2e` com outra sessão de revisão).
11. **Os goldens mudaram junto com o roteiro.** O roteiro do cenário de 7 dias mudou nos mesmos commits que as regras: a Torre às 25 h (V2E-T1), o portão fechado aos viajantes e a promessa da Paliçada (V2E-T2), a Paliçada Nv2 na hora 97 e as ordens de socorro antecipadas (V2E-T3). Os agentes dizem ter lido os diffs, mas o golden não separa mudança de regra de mudança de roteiro.
12. **Carga e volume.** Nenhum relato das Fases D e E mede de novo o tamanho da visão, que ganhou o Conselho, a Ameaça e os objetivos, nem o volume da tabela `commands`, onde cada recibo guarda uma visão. `--remote` e `--smoke` não rodaram com as políticas novas.
13. **Node 24.19.0, uma máquina e a CI.** Tudo rodou em Node 24.19.0; o repositório pede o 22 (`.nvmrc`), que é o da CI. A CI só pode ter rodado no `push` das 20:04, e quem escreve não conferiu o resultado nem se a implantação terminou.
14. **`pnpm capture:landing` não rodou.** A página de apresentação mostra a bancada de antes das Fases C, D e E: sem a aba Conselho, a Ameaça, os feridos e os objetivos. `pnpm test:e2e:landing` rodou na integração (37 passaram, 7 pulados).
15. **Medidas que não se repetem e casos de borda.** Medidas em uma semente só (a cadência das incursões na revisão do app; o travamento do Preguiçoso, lido em `pedra-alta-040`) ou em 12 a 20 sementes, com o simulador amostrando o estado ao fim de cada hora real (a "chegada" de uma carta pode estar até uma hora adiantada). Não exercitados: ausência de vários dias com dezenas de itens nos blocos do Relatório; a virada do ano com carta pendente pela API (`CARD_EXPIRED` virando `CARD_NOT_PENDING`); uma partida da versão 7 recebendo `answerCard` como primeira requisição; o frio que abre e fecha no mesmo instante contra o objetivo 10; o Conselho em ritmos fracionários pela API (o motor testou de 0,5 a 10; a API, 1 e 3).
