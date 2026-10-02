# Pendências e dúvidas da v0.2

> **Para ler pela manhã.** Em 2026-10-01 o autor pediu a implementação da v0.2 inteira durante a madrugada, com as dúvidas anotadas aqui. Este documento lista o que foi decidido sem ele, o que só ele pode fazer e o que ficou sem verificação. O que foi implementado está em [relatorio-v0.2.md](relatorio-v0.2.md).

## 1. O mais importante

- **Nada foi publicado.** Todos os commits estão no `main` **local**. `git push` no `main` implanta em produção, então não foi feito. Antes de publicar: jogar em desenvolvimento, fazer o backup externo e copiar o `RECOVERY_CODE_SECRET` (item 3), e ensaiar a reversão.
- **A primeira publicação vai em dois passos, não em um `push` só.** A produção roda a `v0.1.0`, que não confere a versão do estado. Durante a troca de contêiner ela ainda atende partidas que a imagem nova já migrou, e depois da troca ela é a única imagem de reversão guardada. Com um `push` só, o estado iria direto para uma versão com regras novas e a `v0.1.0` gravaria por cima dele com as regras antigas, sem aviso. O caminho seguro: publicar primeiro só a Fase B (estado na versão 2, que não muda regra), esperar a migração terminar e só então publicar o resto. Os comandos estão em [deploy/README.md](../deploy/README.md), "A primeira publicação da v0.2 vai em dois passos". O plano original (§0.8 do roadmap) tinha essa proteção de graça, porque a Fase B iria para a produção sozinha; a decisão 3 a tirou.
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

_Preenchido ao longo da execução, por fase._
