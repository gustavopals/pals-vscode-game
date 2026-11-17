# Retomada em 2026-11-16 — fechamento 4 e portão do candidato

Worktree `codex-juncao3`, branch `v4-juncao3`, recebido em `26e97af4`.
Estado **42**, protocolo **4**, versão **0.4.0**, conteúdo **`5e98bf9410ddcd98`**.
Revisados `942b9b65`, `fa5137da` e `26e97af4`: sem discordância; cenários coerentes
com G-25, R2/R3 e R1, cobertos pela unidade integral. **Nenhuma regra, número de
conteúdo, política do bot ou retrato congelado alterado neste fechamento.**

- **`c8ad5e1b` — soldo:** 1.472 registros remedidos, zero heróis partindo e zero
  recusas. Camponês Explorador/003: **9,6 h**; nas 50 sementes da semana,
  **19/50** com atraso, máximo **14,4 h**. Rei de Ferro/002: **8,1 h** na semana /
  **4,1 h** no ano. Comparação isolada anterior a R3 confirma menos civis na Mina
  pelo treino ampliado. Os seis atrasos da amostra estão enumerados, sem folga geral.
- **`11820770` — Armazém:** Camponês Regular/001 termina em **60,926 h**, além das
  56 h do ano (antes de R3: 48,083 h). Treino de 28 lanceiros e Taverna Nv3 na
  visita de 48 h gastam os recursos. Nas 50 sementes, **21/50** adiam além do
  primeiro ano; todas concluem na semana. Exceção da amostra explícita, mínimo
  **49 h** nas três sementes; o mínimo **37 h** é das 50. Mesma família de disputa
  de recursos/prioridades do Salão Senhor/016 e /042, também repetidos antes de R3.
- **`49898d2f` — Ameaça:** **88/1.000 finais ≥80**, **37 ≥90**, máxima **100**.
  Os 135 eram da segunda junção, antes do Cerco. Seu encerramento retira a
  Fortaleza; R1 altera a observação das formações. Medida acumulada da junção,
  sem atribuir o delta somente a R3 nem mudar taxas/tolerância.
- Integração: **`3319a22f`** confere tetos/oferta e aviso de moral de R2/R3;
  **`cb4341e8`** converte os prazos do rescaldo; **`5fc39e86`** cobra a incursão
  repelida sem batalha na migração v15. Focados: **33/33** e **106/106**, saída 0.
- Navegador: **`733ba144`** exige os três comandos exatos da Crônica na paleta;
  **`a0a029a7`** espera 0.4.0 em Sobre. **`f8b6fd95`** renova as capturas e o
  `og.png`, com conversão sem perda e inspeção das quatro capturas, da imagem
  social e das páginas completas em computador/celular.

**Preparação concluída, uma suíte pesada por vez:**

| Etapa | Saída e contagem |
|---|---|
| `verify-2`, base `49898d2f` | **0**, lint/typecheck 0; **250 arquivos / 20.687 aprovados / uma falha esperada**, 1.913,65 s |
| `integration-2`, base `5fc39e86` | **0**, **600/600 em 32 arquivos**, 59,45 s |
| `build-1` e `e2e-2` | **0 / 0**; **191/191** no navegador, 4,5 min |
| Captura e prévia refeita | **0 / 0**, **2/2** e **1/1**; quatro comparações de pixels em zero |
| `landing-1` | **0**, **39 aprovados / 7 ignorados pelo roteiro**, 13,1 s |
| `perf-1` | **0**; pior avanço **83,9 ms**, máximos **27.353/75.664 bytes** de estado/visão |

Falhas anteriores preservadas no registro: `verify-1` saiu **1 antes dos testes**
por repasse do parâmetro; `integration-1`, **596/600 (1)**; `e2e-1`, **189/191 (1)**.
A primeira confirmação em `9c6117a3` saiu **2 no typecheck, antes dos testes**:
o helper de rescaldo ainda não tratava o campo ausente permitido pelo protocolo.
Guarda corrigida neste adendo, preservando `undefined`/`null`; typecheck do
servidor **0** e ritmo focado **33/33 (0)**. Portão integral reiniciado após o
commit da correção. Causas e correções em [balance-v0.4.md](balance-v0.4.md), §§23.6–23.10.
A falha esperada preexistente é a previsão da Serraria quando a fome abre no
caminho (`seasonView.test.ts`); continua documentada, não corrigida nesta rodada.

**Portão final:** repetir a sequência completa **no commit deste registro**,
com nice 19, `pnpm verify -- --maxWorkers=2` e integração com `--maxWorkers=2`.
O SHA exato, cada saída dessa reexecução e o resultado do fast-forward local
ficam no resumo externo, evitando criar outro SHA só para registrar o próprio
SHA. Logs e medidas em `/tmp/lotg-fecho4/` (`*-final.{log,sha,exit,start,end}`).
Resumo atualizado durante a execução:
`/tmp/claude-1000/-opt-pals-vscode-game/220c2719-684e-4dfc-93f2-404687422251/scratchpad/codex/fecho4-final.md`.
O avanço de `main` é autorizado **somente após todas as saídas finais verdes** e
checkout limpo salvo `.claude/prompt-codex-v0.4.md`. **Sem push ou publicação.**

**Respondido em 2026-11-17 (D3 e D4, em [pendencias-v0.4.md](pendencias-v0.4.md)): o autor aceitou os dois desvios como estão.** Pergunta original: aceitar os **38%** do Regular Senhor Rápido no primeiro Cerco como
novo desvio ou ajustar? Recomendação já medida: avaliar **2/7 só no ano 1 do
Rápido** (76% vitória / 26% Gloriosa no ensaio), sem aplicação neste candidato.
D2 continua aceitando Normal **92%** e Tranquilo **78%**. Decidir também a
escassez/perdas da semana do Rápido (pergunta recebida: **fome até 14 h / perda de
5 aldeões**), aceitar como desvio ou ajustar. A remedição atual de Senhor registra
até **13 h** de fome e **três saídas civis por feudo**, sem contar nessas saídas
as baixas da milícia/Queda. Não confundir as medidas nem o portão com aceite.

**Não verificado/executado neste fechamento:** Ousado/Especulador, carga de 50
bots, todos os extremos manuais, novo cronômetro do estresse sintético de
102.407/161.694 bytes, Firefox, Safari, aparelho físico ou leitor de tela.
Roteiro/evidência humana, backup/SHA de retorno, ensaio de restauração/reversão,
push, conferência de versão/migração em produção, tag/release e playtest seguem
com o autor. V4I-T1, critério 6 e aceitação humana não estão declarados completos.

## Histórico: fechamento de 2026-11-13

Worktree `codex-juncao3`, branch `v4-juncao3`, base recebida `86cad3c2`.
O commit `e5c64593` concluiu os dois testes pendentes de R3: **67 testes em dois
arquivos, saída 0**, com nice 19 e Vitest com dois workers. Estado **42**,
protocolo **4**, versão **0.4.0**, conteúdo **`5e98bf9410ddcd98`**.

**Medição concluída:** três matrizes completas sequenciais, 1.200 registros por
dificuldade, saídas originais **1** contra as faixas antigas. Camponês teve
710 registros fora, Senhor 738 e Rei de Ferro 568; **zero recusas**. As 72 linhas
`MEASURED` foram regravadas sem ampliar `SLACK`; conferência dos 3.600 registros dos CSVs:
**zero violações com as novas faixas**. Não equivale a meta de vitória cumprida.
Detalhes, ouro por fonte/destino e custos em [balance-v0.4.md](balance-v0.4.md), §23.

**Decisão do autor (2026-11-17, D3): aceito como desvio.** Regular Senhor Rápido **19/50 (38%)**.
D2 permanece confirmado: Normal **92%**, Tranquilo **78%**. Ensaios isolados de
50 sementes: fator de ondas **2/7 → 76% Vitória / 26% Gloriosa**, recomendado para
nova avaliação apenas no primeiro ano do Rápido; 4/15 → 80% / 74%, 1/4 → 82% / 74%,
1/5 → 86% / 84%. **Nenhum número alterado no candidato.** O fator anual atual é
global; outros ritmos, dificuldades e anos não foram medidos com as hipóteses.
As duas perdas de aldeões, fome de até 5 h e frio de até 7 h persistem nos ensaios.
O aceite de D2 não aprova automaticamente os 38% do Rápido.

**Ponto exato:** expectativas do simulador em ajuste pelas causas medidas. A primeira suíte de sim-cli sem `balance.test.ts` terminou com **377/399**
aprovados e **22 falhas**; a rodada dirigida seguinte, **218/220** e duas falhas
de contagens antigas, já corrigidas. A suíte ainda não está declarada verde;
o próximo passo é `verify` inteiro neste candidato, com dois workers. Faltam `verify` inteiro (inclui a matriz de Senhor em 50 sementes),
integração, build/e2e, captura e inspeção/conversão da landing, e2e landing e perf.
Main local ainda não movido; sem push, publicação, backup ou ensaio.

Artefatos e roteiros fora do repositório em
`/tmp/claude-1000/-opt-pals-vscode-game/220c2719-684e-4dfc-93f2-404687422251/scratchpad/`:
`matriz/r3-*` e `codex/fecho3-final.md`. O maior cenário de tamanho já montado e
validado na guarda v42 tem **102.407 bytes de estado / 161.694 de visão**, com
12 heróis equipados, 30 itens, cinco formações, três expedições, duas caravanas,
seis presságios, encruzilhada, duas cartas e três relatórios de 12 rodadas.
É estresse sintético, não teto absoluto nem partida comum; tempos finais pendentes.

Continuar uma suíte pesada por vez, nice 19, Vitest com dois workers, corrigindo
pela causa. Registrar contagens no §15 do roadmap e aqui. Só fazer fast-forward
local do main após o portão inteiro verde no último commit, sem push. O autor faz
roteiro/evidência humana, decisão dos desvios, backup/SHA de retorno, ensaio de
restauração/reversão, push, conferência de versão/migração, tag/release e playtest.
Ousado/Especulador, carga de 50 bots e todos os extremos manuais não foram refeitos.

## Histórico documental anterior

### Retomada em 2026-11-11 — documentação V4I-T4

Trilha `v4i-t4-docs`, a partir de `075b8f0`: CLAUDE, arquitetura, deploy, aceitação,
READMEs e landing atualizados para estado **42**, protocolo **4**, **59 cartas**,
R1/R2 e revisões E/F/G. Versão **0.4.0** na raiz, oito pacotes e constantes públicas, incluindo `ENGINE_VERSION`, API, app e sim-cli (também clientes remotos/smoke, alinhados na integração). Novidades
permanece rascunho; data de redação 2026-11-11. Main local não movido, sem push.

A verificação desta trilha é somente focada, lint e typecheck; contagens e limites
na linha V4I-T4 do Registro do roadmap. Não há matriz, verify inteiro, integração,
e2e, build ou captura nesta entrega. As capturas da landing são da outra trilha.
Changelog e relatório estão em rascunho; falta consolidar medição/portão do coordenador.

Milícia, prévia por onda e seleção/download anual **já existem no app**. A revisão
de tela de 2026-11-09 registra 14/14 cenários `13-cerco` e 12 PNGs; não reexecutados
aqui. R1 preserva a guarda quando a Paliçada segura sem batalha; R2 escala lotes e
fila pelo ritmo; R3 (D1 de 2026-11-11) amplia também as vagas pela mesma escala. D2 aceita o desvio do Regular em Senhor Normal (92%, meta 65–80%) e Tranquilo 78%, com ajuste fino no playtest/v0.5. Permanecem a prévia ofensiva do
Acampamento (F-5), G-23 (vínculo de relatório por onda e perdas da Queda) e G-25
(hipótese do calendário).
O critério 6 e a aceitação humana não foram concluídos por esta documentação.

Os blocos datados abaixo são históricos: preservam as amostras e o ponto de
investigação da trilha de medição. O coordenador atualiza os resultados ao integrar,
sem usar a amostra curta como matriz final. O autor faz roteiro, backup/SHA de
retorno e ensaio, push, conferências de versão/migração, tag/release e playtest.

## Histórico: retomada em 2026-11-10 — R1, R2 e amostra do Cerco

No `v4-juncao3`, o WIP `82360fd` preserva a medição antiga. As regras e o bot foram juntados nos commits `7ebde70` e `5c7d1e8`; o teste histórico foi ajustado em `e8f3c64`. A guarda v42 valida o lote diretamente, sem importar `units` ou depender da mensagem da v41; as guardas v28 a v41 continuam rejeitando lote acima de 10. Testes focados: ritmo 21, Paliçada 75, bot do Cerco 31, todos verdes; `pnpm typecheck` verde. A revisão das trilhas ainda deve ser concluída.

Amostra com cinco sementes, ano de jogo: Regular em Senhor, Rápido 0/5, Normal 5/5, Tranquilo 4/5; Dedicado em Senhor, 4/5, 5/5, 5/5; Regular em Camponês, 0/5, 5/5, 5/5. Os três comandos saíram 1 por violarem as faixas anteriores; CSVs e relatórios em `/tmp/lotg-v04-medicao/`. O Rápido do Regular ganhou 1–2 ondas em cada semente. Antes das matrizes completas, investigar a causa do 0/5, inclusive vagas do Quartel e o tamanho efetivo do treino e da formação; ainda não há conclusão ou proposta medida. Não atualizar MEASURED com esta amostra. Não houve publicação ou push.

## Histórico: retomada da v0.4 — 2026-11-06

**Ponto de continuação:** terceira junção local `v4-juncao3`, base **`ccbaa5c`**
(“integre as ondas por ano e o preparo dos bots”), antes do fechamento documental.
Esta trilha trabalha em **`v4-docs`**, sem integração ao `main`, push ou publicação.
Estado **42**, protocolo **4**, catálogo de **59 cartas**; pacotes e motor ainda
se identificam como **0.3.0**. Conferir `git status`, o SHA do candidato e os
registros ao retomar; versões documentais não comprovam o que está em produção.

## O que está pronto na terceira junção

A junção de 2026-11-03 reuniu inicialmente o estado 41/protocolo 4. A base `ccbaa5c`
contém também o Lobo Branco, as revisões e o preparo dos bots de 2026-11-04, além
das ondas por ano. Não confundir o retrato inicial da junção com a base atual.

| Área | O que existe nesta base |
|---|---|
| Ferro e Ferreiro | Ferro no Armazém/Mercado e na Mina Abandonada; forja de armas, desgaste e reparo de item na mesma fila; interface no Feudo |
| Exército | Quartel, cinco unidades, treino/dispensa, formações salvas, comandantes e Defesa ativa offline; editor por teclado |
| Batalha e prévia | Motor único, sete contas à mão/goldens, relatórios e efeitos nos comandantes; Conselho de Guerra comum e prévia por onda na tela, motor/protocolo |
| Muralha e incursões | Vida por ala, reparo com prioridade sobre obras, Torre Nv3+; R1 posterior preserva a Defesa quando a Paliçada segura sem batalha |
| Horda | Memória da última formação efetiva, astúcia, presságios com névoa, Acampamento e Fortaleza; preparação/regeneração das ondas e congelamento no inverno |
| Sabotagem e campanha | Sabotagem com três heróis, até três tentativas anuais, reduções/alerta; ataque ao Acampamento com reserva de tropas, batalha, retorno, saque e restauração anual do tile; telas e conferências |
| Vigília e Cerco | Preferência de hora/fuso; Plano por onda, três ondas com intervalo de 60 min reais, decisão entre ondas, troca, reparo de emergência, milícia no motor/visão e app, resultado, Queda e rescaldo/Reconstrução |
| Ondas por ano | Base ×1/3 no ano 1, ×2/3 no ano 2 e ×1 no ano 3+, antes da dificuldade; postos fixos preservados e redução sem zerar postos |
| Ano e Feitos | `yearEnded`, pontuação e seis Feitos anuais; endpoint autenticado `GET /v1/games/:id/years/:year/chronicle.md`, sem mistura de anos |
| Conselho e objetivos | Cartas dos lotes 2/3 e três cartas do Lobo Branco; caçada temporária no estado 42, uma equipe por vez e janela encerrada na vitória/expiração; objetivos 17 a 21; Retorno e Antes de partir com guerra |
| Reino | Estatísticas e ranking de ouro pelo estado gravado, saída nas Preferências, ADR 0021; SQL `0001_ranking_listed`, SDK e aba Reino |
| Novidades | Aba editorial, selo de leitura por conta/entre abas; entrada v0.4 ainda como rascunho |
| Simulador | Preparo militar dos perfis, Plano, milícia pela oferta pública, contabilidade do Cerco e prévia de onda no Militar; faixas medidas continuam distintas de metas |

A descrição das regras, da ordem no mesmo instante, dos relógios, dos sorteios e
dos limites está em [architecture.md](architecture.md). Não recalcular prazos já
marcados, não alterar retratos `FROZEN` e não usar um golden divergente como motivo
para regravá-lo sem `UPDATE_GOLDEN=1` e leitura do diff.

## Evidência e lacunas que permanecem

- [balance-v0.4.md](balance-v0.4.md), “Terceira junção”, revisões de 2026-11-04 e
  seção 21, conserva as verificações focadas, correções de cenários e medições.
  Saída verde de um subconjunto não é portão completo. Na base lida, §21.4 descreve
  a remedição com bots preparados, sem consolidar os resultados finais; ondas
  alteradas depois também precisam ser identificadas na medição usada.
- [acceptance-v0.4.md](acceptance-v0.4.md) relaciona os seis critérios, QA-19 a
  QA-34 e os nove itens de “pronto” à prova existente, com limites explícitos.
  **A evidência manual continua por preencher pelo autor.**
- Complemento V4G-T4 em `v4g-t4-fim` (2026-11-09, base `879f0cc`): o app tem
  milícia com conferência e prévia por onda; o SDK/aba Crônica têm seleção/download anual.
  A visão acrescenta termos/quantidade ativa/alvo da milícia e resumo/prazos do rescaldo.
  Estado 42 e protocolo 4 preservados. **Ainda faltam** prévia ofensiva do Acampamento,
  vínculo persistente de relatório por onda e discriminação das perdas da Queda na visão
  (G-23); somente acrescentar campos derivados não recupera dados ausentes do estado.
  Milícia/Markdown anual em navegador passaram nos 14 cenários de 2026-11-09, incluindo três temas/720 px;
  as verificações focadas e seus limites estão no Registro V4G-T4 do roadmap.
- **Decisão do autor de 2026-11-09: a v0.4 fecha com 59 cartas** (a 60ª prevista inicialmente seria `"O aprendiz e o Mestre"`, proibida pelo autor). Cobertura dirigida de cadeias
  não demonstra que todas saem espontaneamente em 50 sementes (em `coverage.test.ts`, a medição anterior (§22) abria 47 das 59 cartas; R1–R3 (§23) abre 48 no ano Normal, com Duelo na praça em uma semente. As 11 restantes exigem promessa, hostilidade, Covil limpo, herói ferido, Ferreiro no verão ou rescaldo, cobertas nos testes de contrato do motor). Conteúdo não lido
  e perguntas de regra continuam em [content-v0.4.md](content-v0.4.md) e
  [pendencias-v0.4.md](pendencias-v0.4.md).
- O critério de **65–80% de Vitória do Regular não está provado**: `MEASURED`
  protege regressão observada, sem impor essa meta. A Fase I continua necessária
  para a aceitação final, mesmo que o autor autorize uma publicação intermediária.

Não usar o antigo ponto “começar V4D-T1.3” deste arquivo: batalha, Horda e Cerco já
existem. O histórico da retomada de outubro está nos commits anteriores do arquivo.

## O que falta para publicar

Esta trilha não autoriza publicação. O coordenador integra as entregas e registra
o candidato; o **autor faz o push**. A lista abaixo organiza os atos já previstos
no roadmap e em [deploy/README.md](../deploy/README.md), sem substituir o procedimento.

1. **Consolidar o candidato.** Integrar/revisar as trilhas, registrar SHA, estado 42,
   protocolo 4 e hash de conteúdo. Conferir pendências, correções e o escopo da
   publicação. Para a release 0.4.0, continuam previstos em V4I-T4 versões dos
   oito pacotes/`ENGINE_VERSION`, changelog, relatório, capturas e página de
   apresentação; não promovê-los a feitos por constarem nesta retomada.
2. **Fechar o portão nesse SHA.** `verify`, integração, build, navegador e landing,
   mais a remedição aplicável, com código de saída/contagens e leitura das falhas.
   Registrar em balance/roadmap; se entrar correção, identificar o novo candidato.
   Antes de começar, conferir processos e combinar o banco compartilhado. Tudo
   com `nice -n 19`, Vitest `--maxWorkers=2`, uma suíte pesada por vez; não rodar
   integração e Playwright ao mesmo tempo. **Não executar esse portão na trilha docs.**
3. **Preparar operação e backup.** Conferir as três imagens e a migração SQL
   `0001_ranking_listed`; fazer backup manual imediatamente antes da publicação
   que sobe estado/protocolo, registrar arquivo e SHA de retorno. Seguir o
   procedimento de restauração/reversão. Imagem antiga diante do estado novo
   não é reversão: precisa do backup correspondente.
4. **Entregar o aviso concreto ao autor.** SHA, resumo, saída do portão, arquivo
   do backup, mudanças em partidas existentes e lacunas ainda abertas. No `main`,
   push aciona a implantação automática; **nenhum agente desta trilha dá push**.
5. **Depois do push do autor.** Conferir saúde e `GET /v1/version` (versão esperada,
   protocolo 4 e `builtAt`), migração das partidas ativas para o estado 42 e a conta
   do autor aberta. Registrar resultado, sem inferir sucesso só pelo CI verde.

O ensaio de restauração/reversão com imagens atravessando a migração continua sem
evidência nesta entrega; ele é item expresso do “pronto” (§10.4, ato 23). Registro
antigo de procedimento escrito não equivale a ensaio executado. Tag/release também
permanecem atos do autor.

## O que fica para depois desta documentação

**Fase I, V4I-T1:** matriz dos quatro perfis padrão e perfis adicionais previstos,
três dificuldades, três ritmos, 50 sementes e duas janelas, identificando o conteúdo
com ondas por ano. Converter as faixas de Vitória/Gloriosa em **metas** do GDD §15.2,
sem apenas alargar a linha observada. Onde a medida não couber, levar propostas ao
autor. Comparar ouro por fonte/destino com a linha de base. As rodadas das fases
não substituem a matriz completa do fechamento.

Ainda em V4I-T1: `--perf` no candidato (avanços longos e Cerco), `--remote` com
50 bots, tamanho máximo de estado/visão e custo dos recibos, mais repetição manual
das sementes extremas por célula. Há medições anteriores de desempenho, mas esta
trilha não as refez nem as declara válidas para o SHA final.

**Aceitação e playtest, V4I-T2/T3:** o autor preenche a evidência por critério e joga
[manual-test-v0.4.md](manual-test-v0.4.md) em 15–20 minutos. Registrar Firefox,
Safari, celular e leitor de tela como vistos ou não vistos. O roteiro acelerado
não prova a semana natural, a conveniência da Vigília ou a vantagem de preparação.
O playtest externo continua por fazer; convite, formulário e relatório da v0.4
ficam para essa tarefa. Não houve playtest nesta entrega.

**Fechamento de produto, V4I-T4:** resolver ou obter decisão explícita para as
lacunas da aceitação, conferir textos e fichas com o autor, concluir documentos e
artefatos da release e conferir a entrada de Novidades antes de marcá-la publicada.
O próximo roadmap é a V4I-T5; não antecipar mapa, Legado, Votos ou Temporadas.

## Entrega desta trilha documental

Foram atualizados somente `architecture.md`, `acceptance-v0.4.md`,
`manual-test-v0.4.md` e esta retomada, um commit por arquivo, todos com prefixo
`V4-DOCS`. Código, testes, `CLAUDE.md`, deploy, balanceamento, roadmap e pendências
não foram editados.

Verificação: apenas `nice -n 19 pnpm exec prettier --check` nos documentos tocados,
com saída 0 por arquivo. O worktree não tem `node_modules` próprio: a primeira
chamada falhou com **254** por não encontrar `prettier`; as chamadas seguintes
usaram o executável já instalado na raiz compartilhada pelo `PATH`, sem instalar
ou alterar dependências. **Markdown é ignorado por `.prettierignore`**; o resultado
0 não atesta formatação desses textos. Referências e diff foram conferidos por
leitura; nenhum teste de jogo foi executado, nenhum golden/retrato regravado,
nenhum serviço iniciado, nenhum backup, push ou deploy feito.
