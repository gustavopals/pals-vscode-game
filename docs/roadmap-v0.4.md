# Lords of the Guild — Roadmap da v0.4 "Guerra e Cerco"

> **Status:** **proposto, sem nenhuma tarefa executada.** É a entrega da tarefa V3G-T5 do [roadmap da v0.3](roadmap-v0.3.md), escrita em 2026-10-07 por um agente, **sem o autor**, no dia em que a v0.3 foi preparada para publicação. **Nenhuma decisão de regra da v0.4 foi tomada**: o que está na §9 são perguntas, cada uma com uma premissa recomendada, e a premissa só vale depois de o autor responder. Este esqueleto lê o GDD (§16, §8.3, §9.5, §10, §11, §4.3), o roadmap da v0.3 e o [relatório da v0.3](relatorio-v0.3.md); não foi conferido contra o código de uma versão que ainda não existe, e **o que diz da v0.3 vale para o commit em que foi escrito** (estado da v0.3 na versão 24 ou posterior, protocolo 3).\
> **Versão do documento:** 0.1 (2026-10-07)\
> **Base:** [GAME_DESIGN.md](../GAME_DESIGN.md) §16 (linha da v0.4), §16.2 (critérios da v0.4), §18.2, §8.3, §9.5, §10, §11, §4.3, §14 (contrato de arquitetura), §15.1 e §15.2\
> **Vem de:** [roadmap-v0.3.md](roadmap-v0.3.md), tarefa V3G-T5; [relatorio-v0.3.md](relatorio-v0.3.md); [pendencias-v0.3.md](pendencias-v0.3.md); [balance-v0.3.md](balance-v0.3.md)\
> **Forma de trabalho:** desenvolvimento 100% com Claude Code; o autor decide regras e autoriza a publicação\
> **Idioma:** português (Brasil); identificadores de código em inglês

**A v0.4 é a versão que fecha a semana.** Pelo GDD §16: "Passei a semana me preparando e valeu". Entrega: Quartel, Ferreiro, ferro e armas, Muralha, formações, Conselho de Guerra, Horda adaptativa, presságios, Fortaleza e sabotagem, Cerco, milícia e Crônica do Ano.

## Índice

- §0 Como usar este roteiro · §1 O que é a v0.4 · §2 O mapa das dependências que a v0.3 entrega · §3 O que a v0.3 ensinou · §4 Fase A (herança e linha de base) · §5 Fases seguintes, em esboço · §6 Lote 3 do Conselho · §7 O ouro sem destino · §8 Critérios de aceitação (resumo) · §9 Decisões que esperam o autor · §10 Registro de execução

---

## 0. Como usar este roteiro

- **Nenhuma tarefa está feita.** As caixas estão todas vazias. As Fases B em diante são **esboços** (o que, a ordem e as dependências); só a **primeira tarefa (V4A-T1)** está detalhada o bastante para abrir a sessão seguinte (V3G-T5.4).
- **Regras da versão anterior continuam valendo:** o servidor orquestra, o motor decide, o app exibe; nenhuma mecânica de versão futura entra, nem como campo vazio (a v0.5 é mapa, Capela, Legado e Temporadas); toda mecânica nova entra com dados em `content`, validação com motivo legível, evento na Crônica, explicação na tela e teste; só as bibliotecas permitidas; mudança de regra atualiza goldens e GDD no mesmo commit.
- **Decisões primeiro.** A v0.3 mostrou que decisões de regra fechadas **antes do código**, em uma sessão de perguntas com opções, evitaram retrabalho (§3). A §9 lista o que levar ao autor; nenhuma tarefa de motor da v0.4 começa sem a decisão que a trava.
- **Onde este roteiro e um ADR da v0.4 divergirem, vale o ADR.** Onde divergir do código, vale o código, e este documento é corrigido pela tarefa que achar a diferença.

## 1. O que é a v0.4 (GDD §16)

| Mecânica | Onde está no GDD | Observação |
|---|---|---|
| Quartel (Salão 4, nível 8, limite de exército = 10 × nível) | §6.1 | Treinar soldados |
| Ferreiro (Salão 4, nível 6) | §6.1, §5.9 | Armas: 2 ferro + 1 madeira → 1 arma, 6 min; reparo de equipamento; +10% por nível |
| Ferro e armas | §5.2, §5.9, §6.2 (Mercado) | O ferro entra no Mercado (preço-base 8,0) e na Mina Abandonada |
| Muralha de Pedra (Paliçada até o nível 6) | §6.1, §6.3, §8.2 | Reparo: 50% da pedra do nível atual, 15 min por 25% de HP |
| Exército, formações e combate | §10 (a mecânica central) | Espadachins e Cavaleiros; prévia e batalha real usam o mesmo código |
| Herói como comandante de ala | §10 | Repelir incursões dá experiência aos heróis-comandantes |
| Conselho de Guerra | §10, §11 | Simular uma batalha; objetivo "Simule uma batalha" |
| Horda adaptativa e Fortaleza da Horda | §8.3, §10.6 | A Horda altera a composição em resposta à última formação |
| Presságios | §11.1 | Também sobem o preço da comida no outono |
| Sabotagem | §9.5 | Expedição que usa o motor de expedições da v0.3 |
| O Cerco e a Hora da Vigília | §11.2, §4.3 | 3 ondas e Plano de Batalha; **a Hora da Vigília passa a ter efeito** |
| Milícia | §11.3 | — |
| Rescaldo e Crônica do Ano | §11.4 | Exportável em Markdown |
| Incursões completas | §8.2 | Saqueadores entram; incursões usam a Formação de Defesa ativa |
| Lote 3 do Conselho | §7, Apêndice B | Ver §6 |
| Critérios da v0.4 (§16.2) | §16.2 | Uma formação salva defende offline; a prévia e a batalha real usam o mesmo código (golden); a Horda altera a composição (teste determinístico); o cerco ocorre na Hora da Vigília com 3 ondas e Plano de Batalha; a Crônica do Ano é gerada e exportável em Markdown; o perfil Regular do `sim-cli` fica em 65–80% de Vitória |

**Não entra:** mapa hexagonal, postos avançados, Capela e relíquias, Legado, Votos, anos seguintes com semente, Temporadas, Academia, som, localização (v0.5 e v0.6). O `GameState` não ganha campo dessas versões, nem vazio.

**Atenção ao que a v0.3 deixou de fora de propósito e é da v0.4:** os destinos "Mina Abandonada" (ferro), "Acampamento de Saqueadores" (batalha), "Sabotagem" e "Caçada ao Dragão" (decisão 12 do ADR 0018), a recompensa de ferro que na v0.3 virou item da raridade equivalente, o reparo de equipamento (a v0.3 não tem desgaste nem reparo), "A Filha do Ferreiro" (carta que fica para a v0.4) e o nível 5 da Guilda.

## 2. O mapa das dependências que a v0.3 entrega

| A v0.4 precisa de… | A v0.3 entrega… | O que falta ou muda |
|---|---|---|
| **Herói como comandante de ala** | Heróis com classe, traços, atributos inteiros, nível, experiência, soldo, equipamento em três espaços (`guild.heroes`) | Nenhuma ala, nenhum papel de comando no estado. Os atributos e o poder são em inteiros e em milésimos, sem ponto flutuante: o combate herda a regra. Decidir como o herói em expedição ou capturado conta (§9) |
| **Sabotagem e ataque ao Acampamento** | O motor de expedições: grafos de nós com encruzilhada, Postura, desfechos por multiplicação cruzada, fluxos de sorteio por entidade (`expedition:<id>`), relatório nó a nó, ferimento, captura e Resgate | Modelos novos (conteúdo), requisitos de classe e de traço, um destino que **altera a Fortaleza**; recompensa e risco novos. O ADR 0017 (decisão 9) já prevê o fluxo por entidade |
| **Ferro** | O Mercado: preço que anda por dia, compra, venda a 85%, volume diário (`200 × nível` por recurso), caravanas e a lista de recursos | Incluir o ferro nas três coisas **muda o formato do estado do Mercado** (`prices`, `tradedToday`, `caravans[].resource`); passo de migração, preço-base 8,0 e volume. O Mercado não pode virar fonte de ferro sem limite (§9) |
| **Tiles e Ameaça** | `Covil de Lobos` como tile abstrato, Ameaça de 0 a 100, incursões por sorteio, o Covil limpo que volta na virada do ano, `threat.seasonEnemy` (os lobos do outono) | A Fortaleza da Horda é um tile novo; o Acampamento de Saqueadores também. A regra "o tile limpo volta no ano seguinte" precisa ser decidida de novo para eles |
| **Hora da Vigília com efeito** | Só rótulo e aviso (a v0.2 e a v0.3 não lhe dão efeito mecânico) | Define quando o Cerco acontece: a Hora da Vigília recebe efeito em tempo real? **Decisão** (§9). Os prazos que dependem de uma pessoa responder são em tempo real (ADR 0013, decisão 1) |
| **Conselho de Guerra e simulação** | A visão que traz o que o jogador precisa para decidir (poder contra dificuldade, régua da equipe) | A "prévia" e a batalha real têm de usar o mesmo código; golden de igualdade entre as duas |
| **Cadeia de cartas e objetivos de guerra** | Lote 2 do Conselho; efeito `addHero`; carta roteirizada; objetivos 11 a 16 | Efeitos novos (soldados, ferro, formação); objetivos 17 em diante |
| **Salvamento de estado** | `schemaVersion` 24 ou posterior; 12 passos de migração só na v0.3; 25 a 30 retratos por versão; guarda de forma completa | Cada mecânica da v0.4 sobe a versão; a regra "um passo por versão, sem emitir eventos nem sorteio" continua |
| **Protocolo** | Protocolo 3 | O que o app antigo não lê sobe o protocolo (formação, onda, Cerco na visão); adição não sobe |
| **Simulador** | Bots `explorador`, `ousado`, `especulador`; faixas da §15.2; colunas da Guilda e do Mercado | **O perfil Regular tem de ficar em 65 a 80% de Vitória no Cerco** (§16.2): é a primeira vez que o simulador mede vitória |

## 3. O que a v0.3 ensinou

Tiradas do Registro (§12 do roadmap da v0.3), de [pendencias-v0.3.md](pendencias-v0.3.md) e do [relatório](relatorio-v0.3.md). Cada uma diz o que muda na v0.4.

| # | Lição | Evidência | O que muda na v0.4 |
|---|---|---|---|
| 1 | **A revisão independente achou defeito real em toda fase depois do portão verde** | Fase C: 2 defeitos no motor e 3 no app; Fase D: 2 + 8 + 9 (os 9 editoriais) e 52 commits de correção; Fase E: cerca de 20 commits `V3E: corrige …`; só a Fase B teve zero defeitos confirmados (e 7 riscos) | Uma revisão por fase, **em tarefa própria e com relatório gravado no repositório** (os da Fase C não foram gravados, e o fechamento não pôde conferir as contagens) |
| 2 | **Arbitragem: uma regra sem teto vira lucro certo** | A caravana pagava 1,19 do preço de compra (comprar e enviar no mesmo instante dava lucro). Corrigido para +15% sobre o balcão, com teste de propriedade e teste de conteúdo que recusa o número que reabrir a manobra | Toda conversão entre recursos (ferro e arma, ouro e ferro, soldado e arma) entra com **propriedade que prova nenhum ciclo lucrativo no mesmo instante**; o bot `especulador` é o modelo |
| 3 | **Bots que não medem** | O bot da Fase D, com duas visitas por dia e prazo de 6 h, nunca decidia uma encruzilhada (0%); nenhum bot passou por captura nem morte; o ouro parado não caiu e só o bot certo mostrou; nenhum bot mandava caravana sem escolta | Cada mecânica nova ganha o bot que a exercita **antes** de a faixa ser fixada, e o relatório diz o que o bot não alcança. Em especial: o Cerco só tem faixa quando um bot de verdade o joga |
| 4 | **Decisões fechadas antes do código** | A sessão de 2026-10-05 fechou 21 decisões antes da Fase B; as mudanças de regra que vieram depois (12 h, +15%, soldo por nível, piso de 3 aldeões, primeira alocação do Mestre) foram todas respostas a números **medidos** | A §9 abre a sessão de decisões **antes** da Fase B; as perguntas que dependem de medida (ouro parado, tamanho das ondas) ficam para depois da primeira rodada do simulador, com a medida na mão |
| 5 | **Árvores separadas para paralelizar** | A Fase F (objetivos, Retorno, lote 2) e a Fase E (app) correram em árvores de trabalho separadas, juntadas por commits de mesclagem (`V3F-T2: junta …`, `V3F-T3: junta …`, `V3E: junta …`) | Continuar, **com os arquivos de cada árvore listados na tarefa** para o merge ser limpo; documentos compartilhados (Registro, pendências, `CLAUDE.md`) só são editados pelo integrador |
| 6 | **Subagentes no Sonnet para tarefas pontuais** | Pedido do autor de 2026-10-06: a execução em subagentes no Sonnet, e o modelo maior nas decisões de regra, nas revisões de motor e na integração arriscada | Mantido. Tarefas de busca de provas, documentos de fechamento e testes de conteúdo vão a subagentes; **revisão independente e decisão de regra, não** |
| 7 | **A primeira publicação salta vários estados** | A produção salta do 12 ao 24 ou além, e do protocolo 2 ao 3; nenhuma partida real foi migrada; o ensaio de reversão nunca foi feito | **Antes da v0.4**, ensaiar a reversão e a restauração com imagens e um estado real (o ato 23 do autor). A v0.4 não publica sobre uma v0.3 que ninguém jogou |
| 8 | **Ninguém jogou** | Nenhuma fase foi jogada pelo autor; nenhum playtest aconteceu (v0.1, v0.2 e v0.3); todo o conteúdo narrativo é rascunho | **A v0.4 não começa o motor do Cerco sem uma sessão de jogo da v0.3** (os roteiros de 15 minutos existem, nunca foram executados). Se a equipe, o Mercado e o soldo não divertem, a guerra herda o problema |
| 9 | **O ouro parado não caiu** | O soldo por nível baixou a soma do ouro final em 0,29% a 0,45%; os heróis não passam do nível 3 em um ano de jogo; a Mina rende de 11 a quase 400 vezes o soldo | Ver §7 |
| 10 | **Tempo real é só para o que depende de uma pessoa** | A espera da encruzilhada subiu de 6 h para 12 h reais depois da medida; o soldo em atraso é em tempo real; o resto escala com o ritmo | O Cerco, a Hora da Vigília e a Postura de defesa têm de decidir **qual relógio** (§9) |
| 11 | **Retratos congelados com o que a produção terá** | 25 retratos da versão 12, depois de cada versão; dois retratos novos antes de subir a versão (estoque acima do cap) | Cada versão nova congela retratos de **todas** as combinações de ritmo e dificuldade com Quartel, Ferreiro e exército, antes de subir |
| 12 | **Um teste que conta o que é novo precisa saber da linha nova** | Na Fase E, um cenário em navegador contava as linhas da árvore e não conhecia a linha "Mercado" | Toda mecânica com linha na árvore, na barra de status ou nos avisos atualiza os cenários de teclado e de ordem das setas **na mesma tarefa** |

## 4. Fase A — Herança e decisões

**Meta da fase:** antes de qualquer código da v0.4, medir de onde se parte com a v0.3 inteira, fechar o que a v0.3 deixou aberto e fechar com o autor as decisões que travam as Fases B e C.

### V4A-T1 · Herança da v0.3, linha de base e caixa de entrada `M`

**Objetivo:** medir a linha de base da v0.4 com a v0.3 fechada (publicada ou não) e abrir a caixa de entrada do autor, no molde de V3A-T1.
**GDD:** §14.3, §14.11, §15.2 a §15.4, §16.2.
**Depende de:** a v0.3 fechada: tag `v0.3.0` criada pelo autor e a publicação feita (ou, se ainda não, o commit candidato com a CI verde). **Se a v0.3 ainda não foi publicada, a tarefa mede o `main` e escreve isso.**
**Decisões:** nenhuma. A tarefa não muda regra nem código de jogo. Ela só **registra** o estado das decisões abertas.
**Trilha:** documentos.

**Arquivos:**

| Arquivo | O que a tarefa faz |
|---|---|
| **novo** `docs/balance-v0.4.md` | Seção 1: linha de base da v0.3 fechada (simulador com os perfis `explorador`, `ousado` e `especulador`, tamanhos, custo do avanço), no formato de [balance-v0.3.md](balance-v0.3.md) |
| **novo** `docs/pendencias-v0.4.md` | Caixa de entrada do autor: o que continua pendente da v0.3 (§3 do arquivo da v0.3), as decisões da §9 deste roteiro como "a decidir" e os atos do autor |
| `docs/roadmap-v0.4.md` (este) | Marca as caixas; preenche a linha V4A-T1 do §10; revisa a §2 contra o código |
| `packages/` | **Nada.** Se a tarefa achar um defeito, ele vira achado no Registro e uma tarefa de correção, não uma mudança escondida aqui |

**Subtarefas:**

- [ ] V4A-T1.1 **Onde estamos.** `main` contra `origin/main`; a produção (`GET /v1/version`: `server`, `protocol`, `builtAt`, `contentHash`); se a tag `v0.3.0` existe; **quantas partidas reais passaram pela migração** (pergunta ao autor: o agente não tem acesso ao banco de produção) e se alguma foi recusada.
- [ ] V4A-T1.2 **Os números de versão.** `CURRENT_SCHEMA_VERSION`, `PROTOCOL_VERSION`, `RNG_VERSION` e `RNG_STREAMS` (os fixos e as famílias de entidade), `VIEW_FORMAT`, `contentHash`, a versão dos pacotes (`0.3.0`).
- [ ] V4A-T1.3 **O mapa da §2.** Conferir cada linha desta tabela contra o código (`packages/engine/src/types.ts`, `expeditions*.ts`, `market*.ts`, `guild*.ts`, `threat*.ts`; `packages/protocol/src/view.ts`; `packages/content/src/balance.ts`): o que existe com o nome dito e o que mudou desde 2026-10-07 (o lote 2 do Conselho pode ter subido o estado).
- [ ] V4A-T1.4 **Os contratos que a v0.4 usa.** A ordem de `processEventsAt` (onde entra o Cerco: instante próprio ou dentro da virada?), `realToGameMs` para os prazos em tempo real, o molde dos fluxos por entidade para batalhas, e o que a visão não pode mostrar (a composição da Horda e a formação inimiga antes da hora, a névoa no servidor).
- [ ] V4A-T1.5 **Os retratos de estado.** Listar os retratos da versão atual, lidos um a um: os três ritmos, as três dificuldades, a equipe em expedição, o atraso do soldo, o Mercado com caravana, o Covil limpo, o Mestre à porta. Dizer o que **falta** para o que a v0.4 vai exigir (um feudo com Quartel e exército).
- [ ] V4A-T1.6 **O portão.** `pnpm verify` (pelo código de saída), integração, `pnpm build`, `pnpm test:e2e`, `pnpm test:e2e:landing`; anotar as contagens (a v0.3 fechou com mais de 11.000 testes de unidade, mais de 560 de integração e mais de 130 em navegador) e cada falha com o motivo.
- [ ] V4A-T1.7 **Linha de base do simulador.** As matrizes nas três dificuldades e com cada perfil (`--matrix`, `--matrix --difficulty …`, `--matrix --profile explorador`, `--profile especulador`); as faixas da v0.3 conferidas contra `MEASURED`; **o ouro parado por fonte e por destino**, que é a régua da §7.
- [ ] V4A-T1.8 **Tamanho e custo.** O estado, a visão e os recibos no pior caso (três expedições, três relatórios, quatro heróis, caravanas, Mestres); o custo de `advanceTo` em 1, 7 e 30 dias reais fora, no ritmo 3 (`--perf`); contra [perf-v0.1.md](perf-v0.1.md) e a V3G-T1.6 se tiver sido feita.
- [ ] V4A-T1.9 **Jogar a v0.3.** O autor joga o [roteiro manual da v0.3](manual-test-v0.3.md) e preenche [acceptance-v0.3.md](acceptance-v0.3.md); o que ele entender e não entender vira entrada em `pendencias-v0.4.md`. **Se isso não acontecer, escrever que a v0.4 começa sem jogar a v0.3** (lição 8).
- [ ] V4A-T1.10 **Dívidas.** Passar pela §10 do roadmap da v0.3 e pelas seções 5 e 6 de [pendencias-v0.3.md](pendencias-v0.3.md): resolvida (com o commit), continua ou nova.
- [ ] V4A-T1.11 **Caixa de entrada do autor.** Criar `docs/pendencias-v0.4.md` com: o mais importante em cinco linhas; o que continua aberto da v0.3; as decisões da §9 deste roteiro com a premissa recomendada; e os atos do autor (backup externo, cópia do `RECOVERY_CODE_SECRET`, ensaio de reversão, a publicação).
- [ ] V4A-T1.12 **`CLAUDE.md`.** Listar o que ficou falso nele (a lista do estado, a regra 6 que hoje barra exército, formação, cerco e ferro "até a versão deles", o regime de commits da v0.3, os comandos do simulador). Quem integra a fase atualiza; esta tarefa só entrega a lista.

**Testes:** nenhum teste novo, porque nenhum código muda. O que a tarefa roda: a verificação comum inteira; a matriz; e um roteiro descartável que confere links e âncoras dos documentos tocados (o Prettier não confere Markdown).

**Impacto em partidas antigas:** nenhum. A tarefa não sobe `schemaVersion`, não toca `content` e não publica.

**Evidência de conclusão:** (1) `docs/balance-v0.4.md` tem a seção 1 com comandos e saídas; (2) `docs/pendencias-v0.4.md` existe e abre com a página que diz o que decidir primeiro; (3) a linha V4A-T1 do §10 traz as contagens do portão e o que não foi verificado; (4) a §2 deste roteiro está conferida contra o código; (5) a lista do que ficou falso no `CLAUDE.md` está escrita.

**Verificação:**

```bash
pnpm dev:up
pnpm verify
TEST_DATABASE_URL=postgres://lotg:lotg@localhost:5433/lotg_test pnpm test:integration
pnpm build
pnpm test:e2e
pnpm test:e2e:landing
pnpm -s sim -- --matrix > matriz.csv 2> matriz.md
pnpm -s sim -- --matrix --profile explorador > explorador.csv 2> explorador.md
pnpm -s sim -- --seed pedra-alta-001 --game-year --time-scale 3 --sessions-per-day 2 > /dev/null
pnpm -s sim -- --perf
```

**Pronto quando:** as cinco evidências acima existem, o portão está verde no commit de partida (ou cada falha está registrada com o motivo) e o autor tem em `docs/pendencias-v0.4.md` uma página que diz o que decidir primeiro.

**Prompt sugerido:** "Leia CLAUDE.md, docs/roadmap-v0.4.md (§0 a §3 e V4A-T1), docs/relatorio-v0.3.md e docs/balance-v0.3.md. A v0.4 não tem nenhuma tarefa executada. Esta tarefa não muda código: confira a §2 contra o código, rode o portão inteiro e as matrizes do simulador, meça os tamanhos e o custo do avanço, registre a linha de base em docs/balance-v0.4.md e crie docs/pendencias-v0.4.md com as decisões da §9 como perguntas. Me mostre primeiro o que a v0.3 deixou aberto e o que eu preciso decidir antes da Fase B."

### V4A-T2 · Sessão de decisões, lote 1 → ADR `S`

**Objetivo:** fechar com o autor as decisões da §9 que travam a Fase B, em rodadas curtas de perguntas com opções (a recomendada primeiro, a alternativa e o que muda no jogo), e registrá-las num ADR novo (o próximo número livre depois do 0018). **Depende de:** V4A-T1. **Esboço:** a mesma estrutura de V3A-T2.

## 5. Fases seguintes, em esboço

Ordem proposta, **não aprovada**. Cada fase termina com revisão independente (lição 1) e uma rodada do simulador.

| Fase | Conteúdo | Depende de | Por que nesta ordem |
|---|---|---|---|
| **B. Ferro e Ferreiro** | Ferro (Mina Abandonada como destino de expedição; ferro no Mercado), Ferreiro, armas, reparo de equipamento, as recompensas de ferro | A: decisões do ferro e do Mercado | O ferro é a base de tudo o que vem: sem ele não há arma nem soldado. É também o teste de arbitragem (lição 2) |
| **C. Quartel e exército** | Quartel, soldados, limite de exército, treino, milícia | B | O exército precisa de arma; define o custo contínuo novo (o ouro sem destino, §7) |
| **D. Combate e formações** | Formações, a batalha determinística, a prévia com o mesmo código, o herói como comandante de ala, Conselho de Guerra | C | É o coração da versão (GDD §10): golden da prévia igual à batalha real |
| **E. Muralha, incursões completas e Horda** | Muralha de Pedra, reparo, saqueadores, a Horda adaptativa, a Fortaleza da Horda, presságios | D | Incursões e Horda usam a formação de defesa |
| **F. Sabotagem e Acampamento** | Os dois destinos de expedição que usam o motor da v0.3 e mexem na Fortaleza e na Horda | E (e a v0.3 inteira) | Reaproveita o motor de expedições; é onde a v0.3 paga seu investimento |
| **G. O Cerco** | A Hora da Vigília com efeito, 3 ondas e Plano de Batalha, o rescaldo, a Crônica do Ano em Markdown | D, E, F | Fecha a semana; os critérios de §16.2 (o perfil Regular entre 65% e 80% de Vitória) |
| **H. Lote 3 do Conselho e objetivos** | Cartas e objetivos de guerra | A a G | Conteúdo, depois das mecânicas que ele cita |
| **I. Fechamento** | Balanceamento, aceitação, playtest, correções, notas de versão, a v0.5 | todas | Como a Fase G da v0.3 |

O **Cerco** é a tarefa de maior risco (determinismo com sorteios, névoa, tempo real e a Hora da Vigília): ele merece um ADR próprio e a primeira revisão independente antes de qualquer tela.

## 6. Lote 3 do Conselho (V3G-T5.3)

O jogo tem 21 cartas (lote 1, v0.2). O **lote 2** (V3F-T1) prevê 24 cartas, o que leva a 45 das 60; **se o lote 2 entregou menos, o lote 3 cobre a diferença**. O que entrou de fato está em [content-v0.3.md](content-v0.3.md); a conta é **60 menos as cartas que existem no fim da v0.3**. Se as 24 previstas entraram, faltam **15**.

| O que o lote 3 precisa | Fonte | Observação |
|---|---|---|
| A quinta cadeia do GDD §7.1 que ficou de fora | ADR 0018, decisão 19: "A Filha do Ferreiro" fica para a v0.4 | Depende do Ferreiro (Fase B) |
| Cartas de guerra | GDD §7, §10 | Soldados, ferro, formação, presságio, saqueadores; **só entram depois de a mecânica existir** (o teste de `council.test.ts` barra por expressão regular o que ainda não existe) |
| Cartas da Fortaleza, da Hora da Vigília e do rescaldo | §8.3, §11.2, §11.4 | — |
| Cartas de herói | O catálogo de traços e as classes da v0.3 | Cada traço novo precisa de pelo menos uma opção que o use |
| A conta de cobertura | `packages/sim-cli/src/coverage.test.ts`, `SHOW_COVERAGE=1` | Quantas cartas chegam, de quais, em que estação, **por posse** (herói, Mestre, Mercado) |

Regras do conteúdo, as da v0.3: cada carta é rascunho até o autor ler; nenhum id publicado muda sem passo de migração; **toda carta nova muda o sorteio de todas as sementes** (goldens, retratos, `COUNCIL_SCENARIO_SEED`): a receita está no README do motor, "Uma carta nova".

## 7. O ouro sem destino (herdado da v0.3)

**O problema:** o ouro parado não caiu com nenhuma fase da v0.3 (C-23). O soldo por nível baixou a soma do ouro final em 0,29% a 0,45%; a Mina rende de 11 a quase 400 vezes o soldo; as obras levam de 12 a 17 mil e o resto não tem para onde ir (balance-v0.3.md, seção 14). O Explorador da semana do Rápido tira 258.908 de ouro da Mina e paga 4.805 de soldo (1,9%).

**O primeiro passo da v0.4 já está dado em parte:** o **soldo por nível** (2 a 20 por hora de jogo). Ele só pesa para quem tem heróis de nível alto, e ninguém passa do nível 3 em um ano de jogo. Os destinos que a v0.4 traz são **o Quartel e o exército** (soldo de soldado, treino), **o Ferreiro e o ferro** (compra no Mercado, armas), **a Muralha** (pedra e ouro) e **o reparo**. O que falta saber é se eles **absorvem** o ouro parado ou só criam outro buraco.

**Medida antes de regra:** a primeira rodada do simulador depois da Fase C (Quartel) mede o ouro por fonte e por destino com a tabela `goldTable` de V3E-T5, e **volta ao autor com propostas concretas** (soldo de soldado, custo de treino, preço do ferro). Nenhum número muda sem a resposta dele. Alternativas já ouvidas: experiência mais rápida; o soldo do nível 1 e do 2 mais alto; um destino novo.

## 8. Critérios de aceitação (resumo)

Os da §16.2 do GDD, como o roadmap da v0.3 faz na sua §8: uma tabela com os critérios, uma matriz de cenários integrados (QA) e os sinais de diversão, **escritas na V4A-T2**, quando as decisões da §9 existirem. Os critérios, hoje:

1. Uma formação salva defende offline.
2. A prévia e a batalha real usam o mesmo código (golden test).
3. A Horda altera a composição em resposta à última formação (teste determinístico).
4. O Cerco ocorre na Hora da Vigília com 3 ondas e Plano de Batalha.
5. A Crônica do Ano é gerada e exportável em Markdown.
6. O perfil Regular do `sim-cli` fica em 65–80% de Vitória.

Cenários integrados que a v0.4 herda da v0.3 e **não podem regredir**: QA-01 e QA-02 (migração e avanço longo), QA-03 (a ordem no mesmo instante, com o Cerco na lista), QA-14 (versões), QA-17 e QA-18 (exclusão e névoa: a formação da Horda não sai na visão antes da hora).

## 9. Decisões que esperam o autor, com premissas recomendadas

**Nada aqui foi decidido.** Cada linha é uma pergunta; a "premissa recomendada" é o que valeria se ele dissesse "pode ser", e é uma proposta do agente que escreveu este esqueleto, sem ler o código da v0.4 (que não existe).

| # | Pergunta | Trava | Premissa recomendada | Por quê, alternativa e o que validar |
|---|---|---|---|---|
| 1 | **Relógios da v0.4**: o Cerco, a Hora da Vigília e a preparação (presságio, Plano de Batalha) são tempo de jogo ou tempo real? | Fases D, E, G | Tudo em tempo de jogo e escala com o ritmo, **com uma exceção em tempo real**: a janela em que uma pessoa pode trocar a formação entre ondas | Mesmo critério da v0.3 (lição 10): é real o que depende de uma pessoa responder. Validar: o perfil de uma visita por dia não perde o Cerco por não estar presente |
| 2 | **O Cerco tem prazo de rendição ou espera o jogador?** | Fase G | O Cerco ocorre na hora marcada **com ou sem o jogador**, com a formação salva (GDD §16.2, critério 1: "defende offline") | É o critério do GDD. Alternativa: adiar o Cerco até a pessoa voltar (rejeitada pelo GDD) |
| 3 | **Herói e exército: o herói comanda uma ala e deixa de ir à expedição?** | Fase D | O herói é **uma coisa ou outra** no mesmo instante: em expedição ou comandante de ala. Escolher a ala é escolher não mandar a expedição | Evita herói em dois lugares; valida a pergunta "equipe ocupada" (balance-v0.3.md). Alternativa: o herói comanda só durante o Cerco |
| 4 | **O ferro no Mercado**: preço-base 8,0 entra na tabela, com volume diário próprio e caravana? | Fase B | Sim, com o mesmo molde (`200 × nível` por dia) e **sem caravana de ferro**; teste de propriedade de nenhum ciclo lucrativo (lição 2) | O GDD dá o preço e não dá o volume. Alternativa: ferro só por expedição e Mina Abandonada |
| 5 | **O Covil limpo, a Fortaleza e o Acampamento**: um tile limpo volta na virada do ano? | Fases E, F | O Covil continua como está; a Fortaleza **não** volta (derrotada, cai); o Acampamento volta como o Covil | A Ameaça precisa de fonte no ano 2. Validar: a Ameaça média por estação depois de limpar |
| 6 | **Perda do Cerco**: o que se perde ao ser derrotado? | Fase G | O GDD §11.4 diz o rescaldo; **definir o que é recuperável** (edifícios, aldeões, exército) antes de qualquer código | O critério 6 (65 a 80% de Vitória) só se mede com a perda definida |
| 7 | **Sabotagem**: pode ser tentada mais de uma vez por ano? | Fase F | Uma por estação, com custo de herói ocupado e risco de captura | Evita que a sabotagem seja o jeito certo de vencer o Cerco |
| 8 | **Lote 3 e conteúdo**: o autor lê as cartas e os grafos novos antes de eles entrarem? | Fase H, e todo conteúdo | Cada carta e cada grafo entram como "rascunho, não lido pelo autor" e a leitura é uma tarefa **antes** do playtest | A v0.3 inteira ficou como rascunho. Alternativa: parar a Fase H até a leitura |
| 9 | **A v0.4 começa sem jogar a v0.3?** | Fase A | Não: o autor joga o roteiro manual da v0.3 e preenche a aceitação antes de a Fase B abrir (lição 8) | Se a equipe e o Mercado não divertem, a guerra herda o problema |
| 10 | **O ouro sem destino** (§7) | Fase C | Medir depois do Quartel e levar as propostas ao autor | C-23 |
| 11 | **Nível 5 da Guilda e o Lendário** (itens) | Fase B | Entram com o Ferreiro (item raro precisa de reparo) | ADR 0018, decisões 12 e 15 |

## 10. Registro de execução

Preencher ao fechar cada tarefa, no formato do Registro da v0.3 (§12): tarefa, data, commit, sessões, o que foi feito e desvios, e **o que não foi verificado**.

| Tarefa | Data | Commit | Sessões | O que foi feito e desvios | O que não foi verificado |
|---|---|---|---|---|---|
| V4A-T1 | | | | | |
| V4A-T2 | | | | | |
| Fases B a I | | | | | |
