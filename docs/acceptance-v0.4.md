# Aceitação da v0.4

Quadro dos seis critérios do [GDD §16.2](../GAME_DESIGN.md), dos QA-19 a QA-34 e da
**Definição de pronto da versão** do [roadmap](roadmap-v0.4.md), §§10.1, 10.2 e 10.4.
Segue o formato de [acceptance-v0.3.md](acceptance-v0.3.md): prova automática,
limite da prova e evidência manual por preencher pelo autor. O roteiro está em
[manual-test-v0.4.md](manual-test-v0.4.md).

> **Conferência documental em 2026-11-06**, base `ccbaa5c` da terceira junção:
> estado **42**, protocolo **4**, catálogo de **59 cartas**, pacotes ainda em
> `0.3.0`. A v0.4 não foi publicada por esta entrega. Nenhuma evidência manual
> foi preenchida e nenhuma suíte de jogo foi executada nesta sessão.

## Como ler e como preencher

**Prova automática** significa que o arquivo e o cenário existem no código desta
base. Não significa execução verde neste commit: o portão do candidato deve ter
seu próprio registro de saída e contagem. `packages/*/src/**/*.test.ts` são provas
unitárias/de propriedade; `packages/server/test/` usa PostgreSQL; `tests/e2e/`
usa Chromium, app e API reais, com preparação e relógio controlados. Teste dirigido
com atalho não demonstra frequência natural, balanceamento ou diversão.

Cada célula manual recebe **data, quem, navegador/versão, sistema, ritmo,
dificuldade, ambiente e resultado** (passou/falhou/não observado), com captura ou
arquivo quando ajudar. Distinguir código, desenvolvimento e produção; não apagar
uma falha anterior. Aceitar o critério é ato do autor. A coluna vazia é intencional.

Não rodar suítes para preencher este documento. Ao coordenador cabe o portão,
uma suíte pesada por vez, com `nice -n 19` e Vitest `--maxWorkers=2`. Registrar
os números em [balance-v0.4.md](balance-v0.4.md) e no roadmap. Regras e leituras
seguem os ADRs [0019](decisions/0019-ferro-exercito-formacoes-e-combate-na-v0.4.md),
[0020](decisions/0020-horda-cerco-e-cronica-do-ano.md) e
[0021](decisions/0021-estatisticas-e-ranking.md), mais as respostas registradas
pelo autor; pendências não viram aceite por constarem aqui.

## Os seis critérios do GDD §16.2

| # | Critério | Prova automática existente | Limite / o que falta | Evidência manual |
|---|---|---|---|---|
| 1 | Uma formação salva defende offline | `packages/engine/src/raids.battle.test.ts`: “uma Defesa ativa que vence repele os lobos sem perda, e o relatório guarda a formação” e divisão de intervalo. `packages/engine/src/siege.property.test.ts`: “o jogador ausente por 30 dias atravessa o cerco, rescaldo e virada de ano com estado e eventos idênticos”. `packages/server/test/formations.test.ts`: salvar/recarregar/ativar; `packages/server/test/siege.test.ts`: Plano e ondas pelo contrato HTTP. `tests/e2e/13-formacoes.spec.ts` e `13-cerco.spec.ts`: relatório e Queda durante ausência. | As preparações são dirigidas. Ausência real, sobrevivência de uma partida normal e compreensão do Plano dependem de jogo humano; não há um único teste de navegador de 30 dias com toda a economia. | por preencher: data, navegador, quem |
| 2 | Prévia e batalha real usam o mesmo código, com golden | `packages/engine/src/warCouncil.test.ts`: “critério 2: inimigo conhecido e a semente da batalha real dão o relatório da batalha real”, golden do agregado e gerador intocado. `packages/engine/src/battle.test.ts`: sete contas à mão. `packages/engine/src/warCouncilOrders.test.ts`: alvo `siegeWave`, incerteza, névoa e assinatura. `tests/e2e/13-formacoes.spec.ts`: simular pelo teclado e desatualizar a prévia. | A distribuição de 200 simulações não promete o resultado de uma batalha com outra sorte. Prévia por onda existe no motor/protocolo; a tela oferece somente defesa comum. Não há prévia ofensiva do Acampamento. | por preencher: data, navegador, quem |
| 3 | Horda altera composição em resposta à última formação, deterministicamente | `packages/engine/src/hordeMind.test.ts`: “a formação de arqueiros aumenta lobos e cavalaria (critério 3)” e “a mesma memória e a mesma semente dão a mesma composição”. `packages/engine/src/horde.test.ts`: memória dos soldados efetivos, incursão adaptada, congelamento no inverno e reinício anual. `packages/engine/src/siege.waves.test.ts`: regeneração conserva redução/alerta/chefe. | Os testes do motor provam adaptação. **Sem prova automática encontrada** de uma finta completa pela API e pelo navegador demonstrando a mudança da composição entre ensaio e Cerco; presságios e tela não equivalem a essa jornada. | por preencher: data, navegador, quem |
| 4 | Cerco na Hora da Vigília, três ondas a cada 60 min reais e Plano | `packages/engine/src/vigil.test.ts`, `vigil.raids.test.ts` e `siege.timeline.test.ts`: cálculo civil, marcação e intervalo nos ritmos 0,5/1/3. `packages/engine/src/siege.golden.test.ts`: Cerco por dificuldade. `packages/engine/src/siege.property.test.ts`: Plano/decisões/ausência longa. `packages/server/test/siege.test.ts`: decisão e duas requisições com um recibo nos três ritmos. `tests/e2e/13-cerco.spec.ts`: Plano, troca, reparo, resultado e hora real no Rápido. | A primeira derrota encerra o Cerco, portanto pode haver menos de três ondas enfrentadas. Fusos são provados na conta da Vigília; não há produto cartesiano de três fusos × três ritmos em navegador. Atalho de Cerco não prova calendário natural. | por preencher: data, navegador, quem |
| 5 | Crônica do Ano gerada e exportável em Markdown | `packages/engine/src/yearEnd.test.ts`: fecho antes do ano novo, pontuação, seis Feitos, isolamento anual e divisão exata. `packages/server/src/games/chronicle.test.ts`: goldens `year-chronicle-victory.md` e `year-chronicle-fall.md`. `packages/server/test/chronicleYear.test.ts`: endpoint anual, 404 antes do fecho, propriedade e separação entre anos. | **Parcial no produto:** `GET /v1/games/:id/years/:year/chronicle.md` existe, mas não há seletor/download anual no app/SDK nem cenário de download anual em navegador. “Baixar Markdown” na Crônica baixa a geral. O “Pronto quando” de V4G-T3 exige a anual no app. | por preencher: data, navegador, quem |
| 6 | Regular do simulador em 65–80% de Vitória | `packages/sim-cli/src/bots/cerco.test.ts`: Plano, reparo, milícia e preparo. `packages/sim-cli/src/siege-report.test.ts`: contabilidade de ondas/resultados. `packages/sim-cli/src/balance.test.ts` e `bands.test.ts`: regressão contra a linha observada. | **Sem prova automática da meta encontrada.** `bands.ts` não exige 65–80% de Vitória do Regular. As medidas históricas não devem ser apresentadas como meta atingida. V4I-T1 precisa remedir a base com ondas 1/3 e 2/3, propor números e fixar metas; ver o registro datado do balanceamento. | por preencher: data, navegador, quem |

## Cenários integrados (roadmap §10.2)

Os QA-01 a QA-18 da v0.3 continuam valendo, em especial migração, divisão de
intervalo, ordem no instante, protocolo, exclusão e névoa. A tabela abaixo não
transforma cobertura parcial em aprovação integral.

| ID | Cenário / resultado a verificar | Prova automática existente | Limite / o que falta | Evidência manual |
|---|---|---|---|---|
| QA-19 | Partida v0.3 (estado 24), com atividades em curso, no outono/inverno; migra uma vez, sem brindes ou cobranças retroativas | `packages/engine/src/migrations.test.ts`, `fixtures.test.ts`, `campaign.migration.test.ts`, `siege.migration.test.ts`, `council.white-wolf-migration.test.ts`; `packages/server/test/games-migration.test.ts`: leitura, ordem, job e recibos. | Retratos de cada versão não são uma partida única com expedição, cativo, caravana, Mestre, cap e incursão juntos. Sem jornada em navegador de conta real migrada de 24 para 42; publicação e backup pendentes. | por preencher: data, navegador, quem |
| QA-20 | Comprar/vender ferro, forjar/cancelar, treinar/dispensar não dá lucro | `packages/engine/src/iron.property.test.ts`, `smithy.test.ts`, `army.property.test.ts`, `market.property.test.ts`; `packages/sim-cli/src/bots/mercado.test.ts` e `matrix.test.ts`: arbitragem especuladora. | Armas e itens não têm venda voluntária. A matriz completa do especulador no candidato deve ser registrada; propriedade não substitui a medição econômica do fechamento. | por preencher: data, navegador, quem |
| QA-21 | Fins de forja/reparo/treino/obra, virada, incursão e caravana no mesmo instante | `packages/engine/src/smithy.test.ts`, `repair.test.ts`, `army.test.ts`, `wallRepair.test.ts`, `raids.property.test.ts`, `campaign.property.test.ts`, `siege.timeline.test.ts`, `market.caravans.test.ts`; ordem em `advance.ts`. | **Sem prova automática encontrada** de todos juntos. Forja de armas e reparo de item compartilham fila e não terminam simultaneamente na mesma partida. Os testes provam encaixes e divisão por mecânica. | por preencher: data, navegador, quem |
| QA-22 | Casas, fome, piso de três, dispensa durante treino; soldados comem e não desertam | `packages/engine/src/army.test.ts`: piso/`trainingShortfall`, comida, fome e dispensa; `army.property.test.ts`: recursos/habitação. `tests/e2e/12-exercito.spec.ts`: treino/cancelamento/dispensa. | Sem cenário nomeado encontrado de dispensa durante outro lote de treino; conferir casas cheias e contagem visual durante a operação. | por preencher: data, navegador, quem |
| QA-23 | Comandante indisponível, saída/captura/morte e concorrência ao salvar | `packages/engine/src/formations.test.ts`, `battleOutcome.test.ts`, `campaign.test.ts`; `packages/server/test/formations.test.ts`; `tests/e2e/13-formacoes.spec.ts`. | Bloqueios e limpeza de referências têm testes. Ferimento impede uso, não apaga o plano. Sem cenário dedicado encontrado de duas abas salvando uma formação com edições diferentes; revisão da Fase C registra a escolha aceita. | por preencher: data, navegador, quem |
| QA-24 | Sete contas à mão, iniciativa empatada, muralha zerada, Ogro, mortos-vivos, doze rodadas | `packages/engine/src/battle.test.ts`, `battle.property.test.ts`, `battle.camp.test.ts`, `wall.test.ts` e `siege.outcome.test.ts`. | Empate de iniciativa é exercitado na conta dos arqueiros; cenário do Ogro e limite de rodadas estão nos goldens. A leitura humana dos fatores continua pendente. | por preencher: data, navegador, quem |
| QA-25 | Prévia conhecida/incerta, 200 simulações, gerador intocado | `packages/engine/src/warCouncil.test.ts`: igualdade, golden, pureza e custo; `warCouncilOrders.test.ts`: prévia de onda e névoa; `tests/e2e/13-formacoes.spec.ts`: tela. | O teste de custo não é medição em máquina lenta nem `--perf` do candidato. Sem seletor de onda na tela; percentuais não removem a incerteza. | por preencher: data, navegador, quem |
| QA-26 | Lobos dia 16 contra Paliçada; média com formação; forte sem formação | `packages/engine/src/raids.battle.test.ts`: sem defesa, Nv1, Defesa ativa, roteiro e forte; `raids.property.test.ts`; `palisade.test.ts`: regra herdada. | Provas distribuídas; sem cenário dedicado encontrado com toda a matriz Nv0/Nv1/Nv2 × tamanhos na batalha atual. Não confundir preservação da perda econômica com ausência de dano à muralha. | por preencher: data, navegador, quem |
| QA-27 | Reparar com obra/batalha e repetir a ordem; prioridade e cobrança única | `packages/engine/src/wallRepair.test.ts`: reparo antes da obra, custo e recusa; `raids.property.test.ts`: reparo/virada/batalha juntos. `packages/server/test/siege.test.ts`: reparo de emergência e reenvio. `tests/e2e/13-cerco.spec.ts`: confirmação/custo. | Reenvio HTTP do reparo comum usa o contrato geral de idempotência; não foi encontrado cenário específico de dois `repairWall` concorrentes pela API. | por preencher: data, navegador, quem |
| QA-28 | Isca no ensaio, troca no Cerco, mesma memória/semente | `packages/engine/src/hordeMind.test.ts`, `horde.test.ts`, `siege.waves.test.ts`, `yearEnd.test.ts` (A Finta); `packages/sim-cli/src/bots/cerco.test.ts`. | Prova do algoritmo e do Feito; falta a jornada completa do jogador/medição da vantagem com e sem isca no candidato. | por preencher: data, navegador, quem |
| QA-29 | Presságio por Torre só diz o que a onda revela | `packages/engine/src/hordeMind.test.ts`, `horde.test.ts`, `siege.waves.test.ts`, `warCouncilOrders.test.ts`; `packages/content/src/omens.test.ts`. | Presságio parcial é aproximação declarada. Vago não identifica onda; revisões/sabotagem podem retirar presságios da visão sem reescrever a Crônica. Inspecionar a compreensão humana. | por preencher: data, navegador, quem |
| QA-30 | Três sabotagens, quarta recusada, Desastre e Fortaleza que some | `packages/engine/src/sabotage.test.ts`, `hordeSabotage.test.ts`, `siege.waves.test.ts`; `tests/e2e/16-sabotagem-acampamento.spec.ts`. | A tela tem cenário dirigido; o cenário visual do alerta injeta a resposta, portanto não demonstra um Desastre natural. Viagens e dificuldade devem ser conferidas pelo autor. | por preencher: data, navegador, quem |
| QA-31 | Campanha com incursão no meio e tile restaurado no ano | `packages/engine/src/campaign.test.ts`, `campaign.property.test.ts`, `battle.camp.test.ts`; `tests/e2e/16-sabotagem-acampamento.spec.ts`: marcha, retorno e relatório. | Atalho/contagens não provam que o ataque vale economicamente; medir risco de sair e legibilidade da reserva de soldados. | por preencher: data, navegador, quem |
| QA-32 | Trinta dias fora, Plano, prazo exato, duas abas, ritmos/fusos e migração tardia | `packages/engine/src/siege.property.test.ts`, `siege.timeline.test.ts`, `siege.migration.test.ts`, `vigil.test.ts`, `vigil.orders.test.ts`; `packages/server/test/siege.test.ts`; `tests/e2e/13-cerco.spec.ts`. | Cobertura repartida por camada; não há todas as combinações em navegador nem ausência real de 30 dias. Conferir a Vigília percebida pelo autor e a janela sem resposta. | por preencher: data, navegador, quem |
| QA-33 | Milícia duplicada, piso na Queda e Reconstrução ×4/5 por dois dias | `packages/engine/src/siege.militia.test.ts`, `siege.outcome.test.ts`, `siege.aftermath.test.ts`; `packages/server/test/siege.test.ts`: ordens; `tests/e2e/13-cerco.spec.ts`: Queda jogável. | Milícia existe na ordem/visão, sem controle no app. Reconstrução começa na primavera seguinte à Queda; não há botão de saltar para o Degelo. | por preencher: data, navegador, quem |
| QA-34 | App/cache protocolo 3, recibo antigo e servidor anterior ao estado novo | `packages/server/test/siege.test.ts`: 426 sem avanço/recibo; `packages/server/test/games-migration.test.ts`: recibos originais e estado futuro sem escrita; `packages/web/src/game/gameSession.test.ts`: cache descartado, cursor mantido. | Teste de estado futuro não é ensaio de imagens e restauração. Reversão operacional atravessando migração continua sem evidência registrada nesta entrega. | por preencher: data, navegador, quem |

## Definição de pronto da versão (roadmap §10.4)

| Exigência | Prova automática / documento que existe | O que falta para declarar pronto | Evidência manual |
|---|---|---|---|
| Seis critérios com prova e evidência por critério | Tabela acima | Critérios 5 e 6 têm lacunas; toda a evidência humana está por preencher. | por preencher: data, navegador, quem |
| Todas as mecânicas e QA integrados cobertos | QA-19 a QA-34 acima; jornadas abaixo | Fechar as lacunas indicadas e validar o conjunto no candidato; não marcar pronto só pela existência dos arquivos. | por preencher: data, navegador, quem |
| ADRs 0019/0020 aprovados ou aplicados por delegação, pendências escritas | ADRs e `docs/pendencias-v0.4.md` | Aceite editorial e respostas ainda abertas continuam do autor; este documento não aprova desvios. | por preencher: data, navegador, quem |
| Feudo novo e migrado completam ano, Cerco e virada seguinte | `packages/engine/src/siege.property.test.ts`, `yearEnd.test.ts`; `packages/server/test/games-migration.test.ts`, `chronicleYear.test.ts` | Falta percurso humano das duas origens e prova conjunta com todos os ingredientes de QA-19. | por preencher: data, navegador, quem |
| Sessenta cartas com ficha e inventário do não lido | `packages/content/src/council.test.ts`, `council.white-wolf.test.ts`; `packages/engine/src/council.chains.test.ts`, `council.white-wolf-effects.test.ts`; `docs/content-v0.4.md` | Catálogo real: **59**. O alvo de 60 e a cobertura espontânea de todas em 50 sementes não estão comprovados. Ler o conteúdo não equivale a aprovar todas as fichas. | por preencher: data, navegador, quem |
| Matriz como metas, extremos, playtest/ausência registrada, zero P0/P1 | `packages/sim-cli/src/balance.test.ts`, `bands.test.ts`, `siege-report.test.ts`; `docs/balance-v0.4.md`; revisões em `docs/reviews/` | Fase I: metas, `--perf`/`--remote` do candidato, extremos e revisão final. **Playtest externo não realizado nesta entrega**; zero P0/P1 depende de triagem no candidato. | por preencher: data, navegador, quem |
| Ausência de estrutura das versões futuras | `packages/engine/src/migrations/shape.ts`, guardas por versão; `packages/protocol/src/protocol.test.ts`; `packages/web/src/bundle.test.ts` | Schemas/guardas não são auditoria semântica completa de escopo. Reino é exceção autorizada pelo ADR 0021, sem Temporadas; ondas por ano são a regra aprovada nesta base. | por preencher: data, navegador, quem |
| Migração, backup, restauração e reversão com ensaio | `packages/server/test/games-migration.test.ts`; procedimento em `deploy/README.md` | Backup do candidato e ensaio real com imagens/restauração, feitos pelo responsável operacional. Teste não demonstra recuperação do banco real. | por preencher: data, navegador, quem |
| Docs, capturas e página correspondem; CI verde e publicação autorizada | `packages/web/src/bundle.test.ts`, `packages/landing/src/page.test.ts`; automação de capturas em `tests/landing/capture/`; documentos desta versão | Conferir produto, release, capturas e três imagens; portão no SHA candidato, autorização e push do autor. Sem publicação nesta entrega. | por preencher: data, navegador, quem |

## Jornadas complementares

| Jornada | Prova automática existente | O que observar à mão | Evidência manual |
|---|---|---|---|
| Ferro, Mina Abandonada, forja e reparo | `packages/engine/src/iron.property.test.ts`, `repair.test.ts`, `smithy.test.ts`; `tests/e2e/10-mercado.spec.ts`, `11-ferreiro.spec.ts` | Custo/prazo antes da ordem, fila compartilhada, desgaste sem bônus, estoque e ferro fora da caravana. | por preencher: data, navegador, quem |
| Objetivos 17 a 21 | `packages/engine/src/objectives.v04.test.ts` | A próxima ação é clara; os dezesseis anteriores continuam acessíveis. | por preencher: data, navegador, quem |
| Lotes 2/3 e Lobo Branco | `packages/engine/src/council.chains.test.ts`, `council.white-wolf-effects.test.ts`, `council.coverage.test.ts`; `packages/sim-cli/src/coverage.test.ts` | Ler escolhas em voz alta; janela da caçada e consequência posterior, sem prometer bônus de Cerco. | por preencher: data, navegador, quem |
| Retorno e Antes de partir com guerra | `packages/web/src/game/returnReport.test.ts`, `beforeLeaving.test.ts`; `tests/e2e/03-retorno-e-conexao.spec.ts` | Ganhos, preço, decisão entre ondas e ausência de batalha/onda duplicada. | por preencher: data, navegador, quem |
| Hora da Vigília | `packages/server/test/games-vigil.test.ts`; `packages/engine/src/vigil.orders.test.ts` | Hora confirmada, fuso/aviso e prazos já marcados preservados. | por preencher: data, navegador, quem |
| Reino e saída do ranking, ADR 0021 | `packages/server/test/stats.test.ts`; `packages/web/src/tabs/kingdom.test.tsx`; `tests/e2e/15-reino.spec.ts` | Só nome do feudo/ouro alheios; sair do ranking não tira dos totais; cache de um minuto. | por preencher: data, navegador, quem |
| Novidades | `packages/web/src/news/entries.test.ts`, `readState.test.ts`, `app/news.test.ts`, `tabs/news.test.tsx`; `tests/e2e/15-novidades.spec.ts` | Foco, selo por conta/entre abas e v0.4 ainda marcada como rascunho. | por preencher: data, navegador, quem |

### Navegador e versão

Chromium tem cenários automáticos escritos; a execução no candidato deve constar
no portão. Nenhuma rodada manual foi registrada por esta sessão.

| Navegador / recurso | Versão / sistema | Verificado à mão? | Jornadas / resultado | Quem e quando |
|---|---|---|---|---|
| Chromium / Chrome | por preencher | não registrado | por preencher | por preencher |
| Firefox (obrigatório à mão) | por preencher | não registrado | por preencher | por preencher |
| Safari | por preencher | não registrado | por preencher | por preencher |
| Celular (aparelho e navegador) | por preencher | não registrado | por preencher | por preencher |
| Leitor de tela (qual) | por preencher | não registrado | por preencher | por preencher |

## O que esta entrega não verificou

Nenhum teste unitário, matriz, integração, build, Playwright ou produção foi
executado para redigir este documento. O roteiro manual ainda não foi jogado.
As provas listadas foram localizadas e lidas, sem regravar goldens ou retratos.
O portão, o backup, o push do autor, as metas da Fase I e o playtest continuam
separados da conclusão desta documentação; ver [retomada-v0.4.md](retomada-v0.4.md).
