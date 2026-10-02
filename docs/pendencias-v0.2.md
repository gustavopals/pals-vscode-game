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

_Preenchido ao longo da execução, por fase._

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

_Preenchido ao longo da execução, por fase._
