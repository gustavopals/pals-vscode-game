# Lords of the Guild — Roadmap da v0.2 "Estações e Conselho"

> **Status:** esqueleto. Todas as tarefas estão listadas com objetivo, dependências e "pronto quando"; só a **Fase A** está detalhada em subtarefas. Cada fase seguinte é detalhada na sessão que a abre.\
> **Versão do documento:** 0.1 (2026-10-01, escrito no fechamento da v0.1)\
> **Base:** [GAME_DESIGN.md](../GAME_DESIGN.md) v0.6: §16.2 (critérios da v0.2), §18.2 (seções que a v0.2 implementa) e §14 (contrato de arquitetura)\
> **Vem de:** [MVP-ROADMAP.md](../MVP-ROADMAP.md) (v0.1.0 — 2026-10-01), tarefa F5-T5\
> **Idioma:** português (Brasil); identificadores de código em inglês

Nenhuma tarefa deste documento foi executada. As caixas estão todas vazias.

---

## 0. Como usar este roadmap

### 0.1 O que é a v0.2

A v0.2 é a linha "Estações e Conselho" da tabela do GDD §16: **estações com efeito, armazenamento, moral, troca de ofício, cartas e cadeias, Torre de Vigia, Paliçada, lobos, dificuldade e ritmo**. O que o jogador deve sentir: "o mundo muda e me pede decisões".

O GDD §18.2 diz quais seções a v0.2 implementa: §4, §5.4–5.7, §6 (Celeiro, Armazém, Torre, Paliçada), §7, §8.2 (lobos e Ameaça com tiles abstratos) e §12.1. Os critérios de aceitação são os da §16.2:

1. O estoque para no cap e o painel mostra "cheio em".
2. Uma carta aparece a cada 8 h e expira em 24 h com a opção padrão.
3. Uma cadeia de 3 cartas funciona de ponta a ponta.
4. A incursão de lobos do dia 2 acontece offline e aparece no Relatório.
5. A troca de ofício reduz a produção por 2 h.
6. Dificuldade e ritmo são escolhidos na criação.

**Não entra:** heróis, Taverna, expedições, Mercado e caravanas, Mestres (v0.3); exército, Quartel, Ferreiro, ferro e armas, formações, Muralha de Pedra, presságios, Fortaleza, Cerco, Hora da Vigília com efeito (v0.4); mapa gráfico, postos avançados, Capela, relíquias, Legado, Temporadas (v0.5). A regra do projeto continua valendo: **não antecipar mecânicas de versões futuras, nem "só a estrutura"**. Onde uma regra da v0.2 cita algo de outra versão (a carta que entrega um herói, a Taverna na fórmula da moral, o disparo da Torre no nível 3), a parte de outra versão fica de fora, e os casos em que isso exige escolha estão na [§10](#10-decisões-que-esperam-o-autor).

Este roadmap também herda o que a v0.1 deixou por fazer: o playtest com outras pessoas (Fase A) e as dívidas técnicas que a v0.2 precisa pagar antes de mudar o estado do jogo (Fase B).

### 0.2 Estrutura do plano

```
Fase (A…F)  →  Tarefa (V2A-T1)  →  Subtarefa (V2A-T1.3)
```

Os identificadores começam com `V2` para não se confundirem com os da v0.1 (`F1-T3`). Cada tarefa traz: objetivo, seções do GDD, dependências, entregáveis, subtarefas com caixas de seleção (só na fase detalhada), **verificação**, **pronto quando**, tamanho e, na fase detalhada, um prompt sugerido.

| Tamanho | Significado |
|---|---|
| `S` | Uma sessão curta do Claude Code |
| `M` | Uma a duas sessões; plano aprovado antes de codar |
| `L` | Duas a quatro sessões; dividir pelas subtarefas, em branch, com merge ao final |

Os tamanhos das Fases B a F são estimativas feitas sem o detalhamento; valem até a sessão que detalhar a fase. Este documento não dá estimativa de prazo total: depende do resultado do playtest e das decisões da §10.

A ordem das fases é obrigatória. Dentro de uma fase, vale o campo "Depende de".

### 0.3 Ritual de cada tarefa

É o do [MVP-ROADMAP.md §0.3 e §A.4](../MVP-ROADMAP.md), com o que a v0.1 ensinou (§8):

1. Abrir a sessão lendo `CLAUDE.md`, as seções do GDD indicadas e a tarefa neste arquivo. Na primeira sessão de uma fase ainda não detalhada, o primeiro trabalho é **detalhar as subtarefas da fase** e mostrá-las ao autor.
2. Plano aprovado antes de codar em tarefas `M` e `L`.
3. Testes primeiro onde houver regra de jogo ou contrato de API.
4. Rodar a "Verificação" da tarefa e `pnpm verify` (mais `pnpm test:integration` se tocar o servidor e `pnpm test:e2e` se tocar o app) e mostrar a saída.
5. Marcar as caixas, preencher o Registro de Execução (§11) com o que foi verificado **e o que não foi**, registrar desvios do GDD em `docs/decisions/NNNN-titulo.md` e fazer um commit `V2C-T2: resumo`.
6. Uma tarefa por sessão.

### 0.4 A regra de toda mecânica nova

Vale para cada tarefa das Fases C, D e E (GDD §18.3). Uma mecânica só está pronta com:

- **dados em `@lotg/content`**, com schema zod e teste de conteúdo; nenhum número de jogo no motor, no servidor ou no app;
- **validação de comando** no motor, com código de recusa e frase legível em português;
- **evento na Crônica**, com o modelo de frase em `content`;
- **explicação do número** no `ViewState` (o texto que o jogador lê ao perguntar "por que este valor?"), calculada no motor;
- **teste**: unidade, propriedade de divisão de intervalo ainda exata, golden atualizado de propósito, e um teste em navegador quando houver interface;
- **GDD atualizado** se a regra mudou.

### 0.5 O que o Claude Code não decide sozinho

Tudo o que está na [§10](#10-decisões-que-esperam-o-autor), qualquer desvio do GDD, qualquer dependência nova, quem participa do playtest, e o que fazer com as partidas que já existem em produção quando o estado mudar de versão. Onde o GDD é vago, a tarefa traz a pergunta; a resposta vira ADR ou correção do GDD antes do código.

---

## 1. Fase A — Playtest e correções

**Meta da fase:** pessoas que não são o autor jogam a v0.1 por dois dias, o resultado fica escrito, e o que atrapalha é corrigido antes de qualquer mecânica nova.

Por que primeiro: o [MVP-ROADMAP.md](../MVP-ROADMAP.md) previa este playtest em F5-T2, antes da release. Por decisão do autor, a v0.1 fechou com o playtest do próprio autor, e o playtest com outras pessoas passou a ser a primeira tarefa da v0.2 (divergência registrada em [acceptance-v0.1.md](acceptance-v0.1.md)). Ninguém além do autor jogou ainda: o "Pronto quando" de F4-T3 (alguém de fora jogar) também não foi verificado.

### V2A-T1 · Playtest de 48 horas com 3 a 5 pessoas `M`

**Objetivo:** saber o que confunde, o que falta e se as pessoas voltam, com respostas escritas e números do banco.
**GDD:** §15.1 (regras de diversão), §15.5 (métricas agregadas, sem nome de jogador), §14.14 (o que se guarda da conta).
**Depende de:** v0.1.0 em produção.
**Entregáveis:** `docs/playtest/relatorio-v0.1.md`, preenchido a partir de [playtest/relatorio-modelo.md](playtest/relatorio-modelo.md); se preciso, ajuste em `deploy/analytics/ops.sql` (V2A-T1.2).

Quem faz o quê: **o autor** convida, entrega o endereço, recolhe as respostas e roda as consultas no Coolify (o agente não tem acesso ao `psql` de produção). **O agente** prepara as consultas, consolida o que o autor colar e classifica os achados com ele.

**Antes de convidar**

- [ ] V2A-T1.1 Conferir a produção no dia: `curl -s https://lords.palsincomehub.com/v1/health` responde `{"status":"ok","db":"ok"}` e `curl -s https://lords.palsincomehub.com/v1/version` traz o `builtAt` do último deploy. Anotar os dois no relatório. **Congelar o `main` durante as 48 horas**: desde o commit `223bdad`, todo push no `main` com a CI verde é implantado sozinho, e um deploy no meio do playtest muda o que as pessoas estão jogando.
- [ ] V2A-T1.2 Ensaiar as consultas de playtest de [`deploy/analytics/ops.sql`](../deploy/analytics/ops.sql). Elas foram escritas a partir do esquema e **nunca foram executadas em produção** (Registro da v0.1, F4-T4). O agente roda as quatro contra o banco de desenvolvimento (comando na "Verificação"), depois de uma partida curta, e corrige o que falhar. Duas limitações conhecidas, a tratar aqui:
  - as consultas **não têm filtro de período**: contam todas as contas que não se chamam "Bot …", inclusive as do autor e as de testes antigos. Para o playtest, acrescentar à CTE `jogadores` de cada consulta a janela de criação das contas, por exemplo `and created_at >= timestamptz '2026-10-05 00:00 America/Sao_Paulo' and created_at < timestamptz '2026-10-07 00:00 America/Sao_Paulo'` (as datas são as do playtest), e descomentar a linha que tira a conta do autor;
  - leituras não deixam rastro: "voltar" é dar ao menos um comando. Quem voltou só para olhar não aparece. As proporções são um piso.
- [ ] V2A-T1.3 Decidir (autor) se os dois itens de operação que ainda dependem dele são feitos antes de haver dados de outras pessoas no banco: cópia de `RECOVERY_CODE_SECRET` fora do Coolify e destino externo para os backups, hoje no mesmo disco do banco ([architecture.md §6.3](architecture.md)). Não bloqueiam o playtest; sem eles, perder o servidor perde os feudos dos convidados.
- [ ] V2A-T1.4 (Atenção: o servidor aceita 10 contas novas por hora por IP; convidados na mesma rede, como um escritório, podem bater nesse limite.) Escolher (autor) 3 a 5 pessoas, e a data e a hora de início e de fim. Preferir quem trabalha no computador, que é o público do jogo (GDD §1).

**O que entregar às pessoas**

- [ ] V2A-T1.5 Uma mensagem com:
  - o endereço do jogo, `https://lords.palsincomehub.com`, e a instrução inteira: abrir, clicar em **Jogar agora**, jogar quando quiser por dois dias. Sem explicar regras: descobrir se o jogo se explica é parte do teste;
  - o pedido de usar o **computador**. Navegadores de celular nunca foram conferidos (Registro da v0.1, F3W-T10), e Firefox e Safari não têm evidência registrada; pedir que digam qual navegador usaram;
  - o que fica guardado: conta anônima, nome de exibição escolhido pela pessoa, as ordens dadas no jogo e as datas de acesso, sem e-mail nem senha, e a conta pode ser excluída pelo próprio app (GDD §14.14; seção "Privacidade" do [README](../README.md));
  - o aviso de que é uma versão de teste e o feudo pode ser apagado;
  - a dica de gerar o **Código do Reino** se a pessoa for trocar de navegador ou de máquina;
  - quando chega o formulário (ao fim das 48 horas) e para quem mandar problemas no meio do caminho.
- [ ] V2A-T1.6 A página de apresentação ([ADR 0012](decisions/0012-pagina-de-apresentacao.md)) só entra na mensagem se o autor já tiver confirmado o endereço e o texto dela (ponto 1 do ADR). Se entrar, anotar no relatório: muda o que se mede no "primeiro contato".

**Durante as 48 horas**

- [ ] V2A-T1.7 Não mudar nada em produção. Anotar com data e hora o que as pessoas relatarem no meio do caminho e qualquer queda (o workflow `health.yml` avisa por e-mail; a chegada desse e-mail ao autor ainda não foi conferida).

**Depois**

- [ ] V2A-T1.8 Mandar o formulário: [playtest/formulario.md](playtest/formulario.md), colado em um formulário online ou na própria mensagem. Apelido opcional; nenhum outro dado pessoal.
- [ ] V2A-T1.9 Rodar as consultas (autor). No Coolify: projeto "Lords of the Guild" → recurso `lotg-db` → aba "Terminal" → `psql -U lotg lotg` → colar uma consulta por vez ([deploy/README.md](../deploy/README.md), seção "Operação"). São quatro, do bloco "Métricas do playtest" de `ops.sql`, com o filtro de período de V2A-T1.2: **sessões por dia**, **comandos por sessão** (com a duração), **tempo até o primeiro comando** e **retorno no dia 2**. Mais duas do começo do arquivo, para contexto: "Contas: total…" (quantos geraram Código do Reino) e "Comandos por tipo e resultado" (o que as pessoas tentaram e o que o jogo recusou). Colar as saídas no relatório, como vieram.
  - A consulta de retorno só inclui um dia de criação depois que **o dia seguinte terminou** no calendário de São Paulo. Para contas criadas no primeiro dia do playtest, ela só responde a partir do terceiro dia. Rodar cedo demais dá uma tabela vazia, e não "ninguém voltou".
  - Rodar antes de sete dias do fim: uma conta que a pessoa excluir some das métricas quando o expurgo passar.
- [ ] V2A-T1.10 Consolidar (agente, com o que o autor colar): preencher o modelo do relatório, uma linha por achado, com a origem (formulário, mensagem, consulta) e a classificação:
- [ ] V2A-T1.11 Fechar o que a v0.1 deixou sem verificar em produção e anotar em [acceptance-v0.1.md](acceptance-v0.1.md): (a) a partir de 2026-10-08 (autor), rodar as contagens de `ops.sql` e conferir que as contas de teste excluídas em 2026-10-01 saíram do banco (critério 12, expurgo de sete dias); (b) durante o playtest, reiniciar o `lotg-api` no Coolify com uma obra em andamento e uma aba aberta (critério 7); (c) registrar uma ausência de mais de 4 horas e, se acontecer, uma fome em tempo real (critérios 5 e 6); (d) conferir se o aviso de queda chegou ao e-mail.

  | Classe | Significado | Destino |
  |---|---|---|
  | **P0** | Bloqueia: a pessoa não conseguiu jogar, perdeu o feudo, ou o jogo mostrou algo errado sobre o estado | V2A-T2, antes de tudo |
  | **P1** | Atrapalha: a pessoa jogou, mas travou, entendeu errado ou desistiu por causa disso | V2A-T2 |
  | **P2** | Melhoria: seria melhor, mas ninguém parou por isso | Lista do relatório; entra em uma tarefa da v0.2 se couber |
  | **P3** | É de outra versão: pede mecânica que o GDD põe na v0.2 ou depois | Anotado na tarefa correspondente deste roadmap, ou no GDD §17.3 |

  A classificação é proposta pelo agente e **decidida pelo autor**. Um pedido de mecânica não vira P0 nem P1.
- [ ] V2A-T1.11 Registrar no relatório as decisões que saíram dele e o que **não** foi medido (por exemplo: quantas pessoas responderam, se alguém jogou no celular, se a conta do autor ficou de fora).

**Verificação:**

```bash
pnpm dev:up
# V2A-T1.2: as consultas rodam sem erro no banco de dev. O psql roda dentro do contêiner e não
# enxerga o arquivo: ele entra pela entrada padrão (por isso o -T).
docker compose -f deploy/docker-compose.dev.yml exec -T db psql -U lotg -d lotg -v ON_ERROR_STOP=1 < deploy/analytics/ops.sql
```

Esperado: nenhuma consulta falha. Este comando não foi executado ao escrever o roadmap; conferir na primeira sessão. As saídas de produção ficam coladas no relatório, com data e hora.

**Pronto quando:** `docs/playtest/relatorio-v0.1.md` existe, com as respostas de pelo menos 3 pessoas, as saídas das quatro consultas, **ao menos uma métrica de retorno no dia 2**, todos os achados classificados de P0 a P3 e as decisões do autor anotadas. Se menos de 3 pessoas responderem, a tarefa não está pronta: o autor decide entre convidar mais gente e registrar a amostra menor como divergência.

**Prompt sugerido:** "Leia CLAUDE.md, docs/roadmap-v0.2.md V2A-T1, deploy/analytics/ops.sql e docs/playtest/. Ensaie as quatro consultas de playtest no banco de desenvolvimento, acrescente o filtro de período e me diga o que mudou. Depois me entregue a mensagem para os convidados e espere eu colar as respostas do formulário e as saídas das consultas para montar docs/playtest/relatorio-v0.1.md."

### V2A-T2 · Correções dos P0 e P1 e a pergunta de balanceamento do ritmo 3× `M`

**Objetivo:** fechar o que o playtest achou de grave, e levar ao autor, com números, a pergunta que o simulador levantou no ritmo 3×.
**GDD:** §5.5, §6.3, §15.1 (itens 1 e 2), §15.2, §17.2.
**Depende de:** V2A-T1.
**Entregáveis:** commits de correção, cada um com teste de regressão; `docs/playtest/relatorio-v0.1.md` atualizado com o destino de cada achado; a resposta do autor à pergunta abaixo, registrada (ADR se mudar regra).

- [ ] V2A-T2.1 Cada P0 e cada P1 corrigido com teste de regressão e commit próprio (`V2A-T2: …`). Um P0 ou P1 cuja correção seja uma mecânica nova não é corrigido aqui: volta ao autor para reclassificar.
- [ ] V2A-T2.2 Repetir a medição do simulador e colar a saída no relatório. Em 2026-10-01, com a semente `pedra-alta-golden`, o bot econômico e 2 sessões por dia em 7 dias reais:

  | Ritmo | População | Salão | Comandos aceitos | Madeira parada | Pedra parada | Ouro parado |
  |---|---|---|---:|---:|---:|---:|
  | 1× | 26 de 35 | Nv3 | 55 | 10.017 | 4.190 | 1.637 |
  | 3× | 35 de 35 | Nv3 | 47 | 40.872 | 16.118 | 6.626 |

  No ritmo 3× o mundo produz três vezes mais entre duas visitas, mas o feudo termina **nos mesmos níveis de edifício**: com uma fila de obra só, cada visita inicia uma obra, e o progresso fica limitado pelo número de visitas, e não pelos recursos. O excedente se acumula sem uso. É o bot, e não uma pessoa: o playtest diz se jogadores reais sentem o mesmo.

  ```bash
  pnpm -s sim -- --seed pedra-alta-golden --days 7 --sessions-per-day 2 --time-scale 1 > /dev/null
  pnpm -s sim -- --seed pedra-alta-golden --days 7 --sessions-per-day 2 --time-scale 3 > /dev/null
  ```

- [ ] V2A-T2.3 Levar a pergunta ao autor, com o que o GDD já prevê. **A resposta é de regra de jogo e é do autor; o agente não ajusta números por conta própria.** O que a v0.2 do GDD já traz para este problema:
  - **caps de armazenamento** (§5.2 e §5.5): 500 por recurso antes do Celeiro e do Armazém; o excedente é perdido e aparece no Relatório. Limita o acúmulo, e a §15.2 dá a meta "nenhum recurso acima do cap por mais de 8 h para o perfil Regular". Ouro não tem cap (§5.1);
  - **segunda fila de obras** no Salão Nv4 e planejadas marcadas como **"iniciar quando houver recursos"** (§6.3): tiram o progresso da dependência de uma visita por obra;
  - **escolha de ritmo** na criação (§4.2), hoje fixado pelo servidor ([ADR 0011](decisions/0011-ritmo-3x-no-mvp.md));
  - a questão em aberto do GDD §17.2: **mercado e caravanas já na v0.2**, para dar saída ao excedente antes do cap.

  As perguntas: (a) alguma dessas entra **antes** das mecânicas novas, como correção, ou todas esperam a sua tarefa (V2C-T2 e V2C-T5)? (b) no ritmo 3×, o Salão Nv4 chega tarde demais para a segunda fila ajudar (o bot termina a semana no Nv3)? (c) as faixas de balanceamento do simulador, que só existem no ritmo 1, passam a existir no ritmo em que as pessoas jogam (V2B-T4)?
- [ ] V2A-T2.4 Se o autor mudar um número: alterar `@lotg/content`, regravar os goldens com `UPDATE_GOLDEN=1`, conferir o diff e atualizar o GDD no mesmo commit.
- [ ] V2A-T2.5 `pnpm verify`, `pnpm test:integration` e `pnpm test:e2e` verdes; deploy pelo `main`; `/v1/version` conferido depois.

**Verificação:**

```bash
pnpm verify
TEST_DATABASE_URL=postgres://lotg:lotg@localhost:5433/lotg_test pnpm test:integration
pnpm test:e2e
```

**Pronto quando:** zero P0 e P1 abertos no relatório, cada correção com teste, e a pergunta de balanceamento com resposta escrita do autor (mesmo que a resposta seja "espera a tarefa da mecânica").

**Prompt sugerido:** "Leia CLAUDE.md, docs/playtest/relatorio-v0.1.md e docs/roadmap-v0.2.md V2A-T2. Corrija os P0 e P1 um por vez, cada um com teste de regressão e commit próprio. Depois rode o simulador nos ritmos 1 e 3, me mostre os números e me faça as perguntas de V2A-T2.3; não mude nenhum número de jogo sem a minha resposta."

---

## 2. Fase B — Fundação técnica antes das mecânicas

**Meta da fase:** o que a v0.2 precisa ter no lugar antes de mudar o estado do jogo. Cada tarefa diz por que não pode esperar. Nenhuma delas acrescenta mecânica.

### V2B-T1 · Migração de `GameState` por `schemaVersion` `M`

**Objetivo:** um estado gravado na versão 1 carrega e joga na versão 2, e o servidor sabe o que fazer com um estado de versão que não conhece.
**Por que antes:** toda mecânica da v0.2 acrescenta campos ao estado (moral, experiência do ofício, Conselho, tiles). Hoje não existe código de migração: `GameState.schemaVersion` é o tipo literal `1` (`packages/engine/src/types.ts`), o servidor lê `games.state` do banco sem validar nem migrar (`packages/server/src/db/schema.ts`), e há partidas em produção. O GDD §15.4 pede o teste: "estados com `schemaVersion` antigo carregam e migram no servidor".
**GDD:** §14.6, §14.11, §15.4.
**Depende de:** V2A-T2.
**Entregáveis (a detalhar):** função pura de migração no motor (o estado é dele) chamada pelo servidor ao carregar; golden de um estado v1 real; teste de integração; documentação no README do motor e do servidor.
**Perguntas que a tarefa precisa responder antes de codar:** as partidas da v0.1 **migram** ou são **arquivadas** (§10, item 4)? Onde a migração roda: ao travar a partida (preguiçosa) ou em lote no arranque? E a **reversão**: a regra do projeto é migração compatível com a versão anterior (expandir, depois contrair), mas um estado já migrado para a versão 2 não é legível pela API da v0.1; a reversão atravessando uma migração nunca foi ensaiada (Registro da v0.1, F4-T5).
**Verificação:** teste de unidade da migração (v1 → v2, idempotente); teste de integração com uma partida gravada pela v0.1; a propriedade de divisão de intervalo continua exata em um estado migrado.
**Pronto quando:** uma cópia do estado de uma partida real da v0.1 carrega, avança e aceita comandos no código novo, e há um procedimento escrito para reverter um deploy que migrou estados.

### V2B-T2 · Gerador de números aleatórios com semente e fluxos nomeados `M`

**Objetivo:** sorteios determinísticos e reproduzíveis no motor.
**Por que antes:** a v0.2 é a primeira versão que sorteia (cartas do Conselho, chances diárias da moral, incursões por Ameaça). O GDD §18.1 item 3 pedia o gerador desde a v0.1; ele não existe: o estado tem o campo `rng`, vazio, e nenhuma regra sorteia (Registro da v0.1, F1-T11; [README do motor](../packages/engine/README.md)).
**GDD:** §14.3, §14.11 (`rng: Record<string, number[]>`), §18.1 item 3.
**Depende de:** V2B-T1 (o estado do gerador passa a ser usado; se o formato mudar, é migração).
**Entregáveis (a detalhar):** módulo do gerador no motor, inteiro e sem `Math.random()`; um fluxo por nome (`council`, e os que as mecânicas pedirem), para que sortear em um não desloque o outro; testes.
**Verificação:** a mesma semente dá a mesma sequência; a propriedade de divisão de intervalo vale **com sorteios no caminho** (`advanceTo(t2)` ≡ `advanceTo(t1)` + `advanceTo(t2)`, estado e eventos); `purity.test.ts` continua verde.
**Pronto quando:** um teste de propriedade com um evento sorteado de teste (sem mecânica nova no estado) passa com cortes em qualquer milissegundo.

### V2B-T3 · Ritmo e dificuldade escolhidos na criação da partida `M`

**Objetivo:** o jogador escolhe ritmo e dificuldade ao criar a partida; os dois ficam gravados e não mudam durante o ano.
**Por que antes:** é critério da §16.2, e a dificuldade é parâmetro de três mecânicas (cap de armazenamento, abandono por fome, opção padrão das cartas): elas precisam lê-la de algum lugar. Hoje a dificuldade é a constante `lord` e o ritmo vem de `GAME_TIME_SCALE` (`packages/server/src/games/service.ts`); `CreateGameRequestSchema` só aceita `difficulty: 'lord'` e `timeScale: 1`, e ignora o segundo (`packages/protocol/src/api.ts`; dívida do [ADR 0011](decisions/0011-ritmo-3x-no-mvp.md)).
**GDD:** §4.2, §12.1, §13.9, §14.5, §16.2.
**Depende de:** V2B-T1; decisão do autor sobre quais ritmos existem (§10, item 2).
**Entregáveis (a detalhar):** protocolo, criação da partida no servidor, escolha nas boas-vindas e em "Nova partida", dificuldade no estado, textos em `content`.
**Atenção:** nesta tarefa a dificuldade é só gravada e exibida; cada efeito entra na tarefa da sua mecânica. O app não pode mostrar uma escolha que ainda não muda nada sem dizer isso (ver §10, item 3, sobre o que chega à produção no meio da v0.2).
**Verificação:** integração (criar com cada combinação; valor inválido recusado com 400; partida antiga intacta); teste em navegador das boas-vindas; "do clique ao primeiro comando em menos de 30 s" (critério 1 da v0.1) continua valendo com as duas escolhas na tela.
**Pronto quando:** duas partidas criadas com ritmos diferentes mostram prazos diferentes em tempo real, e a dificuldade aparece no `ViewState`.

### V2B-T4 · Simulador no ritmo em que se joga `M`

**Objetivo:** faixas de balanceamento que falhem na CI no ritmo que os jogadores usam, e um bot que jogue as mecânicas da v0.2 conforme elas entram.
**Por que antes:** as faixas do `sim-cli` só existem no ritmo 1 (`packages/sim-cli/src/balance.test.ts`; "no ritmo 3 não há faixa definida", README do simulador), e a produção joga no ritmo 3. Foi o simulador que mostrou o problema de V2A-T2.2, mas nenhum teste o acusa. O GDD §15.3 pede um teste de CI com 50 sementes por perfil; hoje há uma semente.
**GDD:** §15.2, §15.3.
**Depende de:** V2A-T2 (a resposta do autor define a faixa), V2B-T3.
**Verificação:** `pnpm --filter @lotg/sim-cli test`.
**Pronto quando:** existe uma faixa aprovada pelo autor para cada ritmo oferecido, e o teste falha se o excedente parado passar do limite que o autor definir.

### V2B-T5 · Revisão independente da fundação `S`

**Objetivo:** uma revisão de leitura, por um agente que não escreveu o código, de V2B-T1 a V2B-T4, antes de as mecânicas se apoiarem nelas.
**Por que antes:** na v0.1, toda revisão independente achou defeitos reais (§8, lição 3). Migração e sorteio são os dois lugares em que um erro corrompe partidas de verdade.
**Depende de:** V2B-T1 a V2B-T4.
**Pronto quando:** cada defeito confirmado tem teste e correção, e o que ficou sem correção está escrito no Registro com o motivo.

---

## 3. Fase C — O mundo muda: economia da v0.2

**Meta da fase:** estações, armazenamento, ofício, moral e a segunda fila, todos no motor, com interface e teste. Critérios 1 e 5 da §16.2.

Cada tarefa segue a regra da §0.4.

### V2C-T1 · Estações com efeito `M`

**Objetivo:** os multiplicadores de produção por estação, o recrutamento mais rápido na primavera, e o inverno: lenha, obras mais lentas e a penalidade de produção sem lenha.
**GDD:** §2.1, §4.1, §5.3.
**Depende de:** V2B-T1.
**Fica para outra tarefa ou versão:** "moral −20" do frio entra com a moral (V2C-T4); expedições, presságios, preço da comida e cerco são de outras versões.
**Perguntas para o autor:** a tabela da §4.1 dá "lenha: 0,5 madeira por habitante/h" e, sem lenha, "produção ×0,8"; a falta de lenha é um evento com instante exato, como a fome (§5.6)? "Obras 50% mais lentas" vale para uma obra que atravessa a virada da estação, ou só para as iniciadas no inverno?
**Verificação:** unidade por estação; propriedade de divisão de intervalo atravessando viradas de estação; golden regravado de propósito.
**Pronto quando:** o `ViewState` explica cada taxa com o fator da estação, a virada de estação muda as taxas no instante exato, e a Crônica registra a falta de lenha.

### V2C-T2 · Armazenamento: Celeiro, Armazém e caps `M`

**Objetivo:** o estoque para no cap, o excedente é perdido e contado, e o painel diz "cheio em".
**GDD:** §5.1, §5.2 (cap inicial de 500), §5.5, §6.1, §6.2, §12.1 (cap por dificuldade), §12.2 (objetivo 4), §15.2, §16.2.
**Depende de:** V2B-T1, V2B-T3.
**Inclui:** o objetivo 4 volta a recompensar com o desbloqueio de Celeiro, Armazém e Torre de Vigia, como diz o [ADR 0002](decisions/0002-objetivo-4-v01.md) (a Torre só é construível depois de V2E-T1).
**Perguntas para o autor:** o que acontece com o estoque acima do cap em uma partida migrada da v0.1 (o simulador termina a semana com dezenas de milhares de madeira)? Recompensas de objetivo e devolução de cancelamento respeitam o cap? O Armazém da v0.2 limita madeira e pedra; ferro é da v0.4.
**Verificação:** propriedade "recursos nunca acima do cap" (GDD §15.4) e divisão de intervalo exata com o cap no caminho (encher é um evento da linha do tempo, como a comida acabar); teste em navegador do "cheio em".
**Pronto quando:** critério 1 da §16.2 provado por teste, e o Relatório de Retorno traz a linha de desperdício.

### V2C-T3 · Troca de ofício e experiência do ofício `M`

**Objetivo:** realocar custa: quem acabou de trocar de ofício produz menos por um dia de jogo; edifícios com postos ocupados acumulam experiência e produzem mais.
**GDD:** §5.3 (mestria), §5.4, §14.11 (`craftExperience`, `adaptation`), §16.2.
**Depende de:** V2B-T1.
**Perguntas para o autor:** a §5.4 fala em "ao menos metade dos postos ocupados", mas a v0.1 não tem número de postos por edifício: qual é? O critério diz "reduz a produção por 2 h": no ritmo 3× são 2 horas de jogo (40 minutos reais) ou 2 horas reais?
**Verificação:** unidade; propriedade de divisão de intervalo com o fim da adaptação como evento; golden.
**Pronto quando:** critério 5 da §16.2 provado por teste, e o `ViewState` mostra quantos trabalhadores estão em adaptação e até quando.

### V2C-T4 · Moral `L`

**Objetivo:** moral de 0 a 100, recalculada na virada do dia, com efeito na produção, as chances diárias de chegada e de partida de aldeões, e o abandono por fome longa.
**GDD:** §4.1 (frio), §5.3, §5.6 (moral −2 por dia faminto; abandono após 12 h de fome, não em Camponês), §5.7, §12.1.
**Depende de:** V2B-T2 (sorteios), V2B-T3 (dificuldade), V2C-T1 (frio).
**Fica de fora:** os termos da fórmula que são de outras versões (Taverna, relíquias). "Festival" e "ajustes de cartas" entram com as cartas (V2D-T1); "incursão sofrida" entra com os lobos (V2E-T3).
**Perguntas para o autor:** "o estoque de comida cobre 24 h" e "após 12 h de fome contínua": horas de jogo ou reais? "Festival dura 1 dia real" e "últimos 2 dias reais": como ficam nos outros ritmos? O multiplicador da moral usa fração inteira; confirmar o arredondamento.
**Verificação:** unidade de cada termo; propriedade com sorteios; teste de 30 dias offline com fome, abandono e moral.
**Pronto quando:** a aba Feudo mostra a moral, a faixa (Desesperado a Orgulhoso) e a explicação termo a termo, e a Crônica registra chegadas e partidas por moral.

### V2C-T5 · Segunda fila de obras e início automático das planejadas `M`

**Objetivo:** o Salão Nv4 abre a segunda fila; planejadas marcadas "iniciar quando houver recursos" começam sozinhas, na ordem da lista.
**GDD:** §6.1, §6.3 (as duas regras têm a tag `[v0.2]`, embora não estejam nos critérios da §16.2), §14.11 (`planned[].autoStart`).
**Depende de:** V2B-T1; resposta do autor em V2A-T2.3.
**Perguntas para o autor:** "começam automaticamente na virada de segmento em que os recursos existirem": o instante em que os recursos passam a bastar precisa ser um evento da linha do tempo, senão o resultado depende de como o intervalo foi dividido. Confirmar que é essa a regra.
**Verificação:** unidade; propriedade de divisão de intervalo com início automático; "não melhorar o mesmo edifício em duas filas".
**Pronto quando:** um feudo deixado sozinho com planejadas automáticas e recursos chegando inicia as obras nos instantes exatos, e o Relatório de Retorno as lista.

### V2C-T6 · Revisão independente e balanceamento da Fase C `S`

**Objetivo:** revisão de leitura da fase e uma rodada do simulador com caps, estações, moral e a segunda fila.
**Depende de:** V2C-T1 a V2C-T5, V2B-T4.
**Pronto quando:** defeitos confirmados corrigidos com teste; o bot Regular cumpre "nenhum recurso acima do cap por mais de 8 h" (§15.2) ou a diferença está escrita e levada ao autor.

---

## 4. Fase D — O Conselho do Feudo

**Meta da fase:** cartas a cada 4 dias de jogo, com opções, expiração, cadeias e interface. Critérios 2 e 3 da §16.2.

### V2D-T1 · Motor do Conselho `L`

**Objetivo:** sorteio ponderado entre as cartas elegíveis, no máximo 2 pendentes, expiração com a opção padrão, efeitos (recursos, moral com duração, flags, efeitos adiados e ocultos) e o comando de responder.
**GDD:** §7.1, §7.2, §12.1 (opção padrão por dificuldade), §14.11 (`council`), §17.1.
**Depende de:** V2B-T2, V2B-T3, V2C-T4.
**Fica de fora:** requisitos e efeitos de outras versões (`heroTrait`, `addHero`, `addUnits`, `reveal` de mapa gráfico).
**Perguntas para o autor:** a carta "expira em 24 h reais" e sai "a cada 4 dias de jogo (8 h reais)": no ritmo 3× o intervalo vira 2 h 40 min reais; a expiração acompanha o ritmo ou fica em 24 h reais? O motor só conhece tempo de jogo. Em Camponês a opção ao expirar é "sempre a melhor" e em Rei de Ferro a "pior": quem marca a melhor e a pior de cada carta? O conteúdo precisa desses dois campos.
**Verificação:** unidade; propriedade de divisão de intervalo com sorteio e expiração; teste de conteúdo (flags consistentes, toda carta com opção padrão); mesma semente, mesmas cartas.
**Pronto quando:** em um cenário roteirizado, uma carta é sorteada no instante previsto, uma segunda fica pendente, a terceira não é sorteada, e uma carta não respondida expira com a opção padrão da dificuldade.

### V2D-T2 · Cartas e cadeias da v0.2 `L`

**Objetivo:** o conjunto de cartas da v0.2 em `@lotg/content`, com ao menos uma cadeia de 3 cartas completa.
**GDD:** §7.1 (meta: 60 cartas, 5 cadeias, 6 roteirizadas no primeiro ano), Apêndice B (amostra de 12), §18.3 (tom de crônica, frases curtas).
**Depende de:** V2D-T1.
**Perguntas para o autor (bloqueiam a tarefa):** o GDD só traz 12 das 60 cartas, e a maioria delas depende de versões futuras: a "Estrangeira ferida" entrega um herói (v0.3; e a §16.2 põe "o primeiro herói chega pela carta do dia 2" na v0.3), "O Mercador Misterioso" exige Mercado, "A Filha do Ferreiro" exige Ferreiro, outras citam ondas do cerco, ferro e Clériga. **Quais cartas compõem a v0.2, quantas, e qual é a cadeia de 3 do critério?** Quem escreve o texto: o autor, ou o agente propõe e o autor aprova carta a carta?
**Verificação:** teste de conteúdo (schema, flags, nenhuma opção sem efeito, nenhuma referência a mecânica que não existe); cenário que percorre a cadeia inteira.
**Pronto quando:** critério 3 da §16.2 provado por um cenário de ponta a ponta, e todas as cartas aprovadas pelo autor.

### V2D-T3 · O Conselho na interface `M`

**Objetivo:** ver as cartas pendentes, ler custos e consequências, responder, saber quando a carta expira; aviso de carta nova; cartas no Relatório de Retorno.
**GDD:** §2.3, §13.2, §13.5, §13.6, §7.1.
**Depende de:** V2D-T1 (pode começar com as cartas de teste, antes de V2D-T2).
**Perguntas para o autor:** uma carta expira em 24 h e nada chega com a aba fechada (decisão da v0.1, ADR 0008 ponto 4). Isso basta para a v0.2?
**Verificação:** testes em navegador: responder pelo painel e pela paleta, só com o teclado, nos três temas; recusa legível ao responder uma carta expirada.
**Pronto quando:** critério 2 da §16.2 provado em navegador com o relógio controlado.

### V2D-T4 · Revisão independente da Fase D `S`

**Depende de:** V2D-T1 a V2D-T3.
**Pronto quando:** defeitos confirmados corrigidos com teste; nenhuma opção de carta dominante em todos os contextos (§15.1 item 8), conferido carta a carta.

---

## 5. Fase E — Ameaça: Torre, Paliçada e lobos

**Meta da fase:** o jogador vê a Ameaça, pode se preparar, e a primeira incursão acontece com ele fora. Critério 4 da §16.2.

### V2E-T1 · Torre de Vigia, tiles abstratos e Ameaça `M`

**Objetivo:** a Torre como edifício; os tiles de ameaça como dados, exibidos em lista; a Ameaça de 0 a 100 subindo a cada dia de jogo.
**GDD:** §6.1, §6.2, §8.1 (só a frase sobre tiles abstratos na v0.2), §8.2, §14.11 (`map`).
**Depende de:** V2B-T1, V2B-T2.
**Fica de fora:** mapa hexagonal e névoa gráfica (v0.5), presságios e o disparo da Torre no Nv3 (v0.4), limpar um tile (precisa de expedição ou exército).
**Perguntas para o autor:** quais tiles de ameaça existem na v0.2, e de onde vêm (semente, roteiro)? Sem como limpar um tile nem repelir com exército, a Ameaça só sobe: até onde, e o que a faz cair na v0.2? A Torre chega ao nível 5 na v0.2?
**Verificação:** unidade; propriedade; teste em navegador da lista de ameaças.
**Pronto quando:** a aba Feudo mostra a Ameaça com a explicação do número, e a Torre muda o que o jogador vê.

### V2E-T2 · Paliçada (níveis 1 e 2) `S`

**Objetivo:** a Paliçada como edifício, com Salão Nv3 como pré-requisito, até o nível 2.
**GDD:** §6.1, §6.2, §8.2.
**Depende de:** V2B-T1.
**Fica de fora:** HP de muralha por ala, dano e reparo (v0.4).
**Perguntas para o autor:** na v0.2 a Paliçada "absorve o ataque leve"; os níveis 1 e 2 diferem em quê, sem HP?
**Pronto quando:** construir a Paliçada muda o desfecho da incursão de V2E-T3, e o `ViewState` explica por quê.

### V2E-T3 · A incursão de lobos `M`

**Objetivo:** a incursão roteirizada de lobos acontece no instante marcado, com o jogador fora, resolve-se sozinha e aparece no Relatório de Retorno, com aviso prévio da Torre.
**GDD:** §2.2 (dia real 2), §8.2, §12.3, §5.7 (moral depois de incursão), §16.2.
**Depende de:** V2E-T1, V2E-T2, V2C-T4.
**Perguntas para o autor:** "lobos no dia 2" é o segundo dia **real** no ritmo Normal: qual é o instante em tempo de jogo? Sem paliçada, os lobos "levam **até** 15% de comida e madeira e ferem 1 aldeão": quanto exatamente, e o que é um aldeão ferido na v0.2? As incursões por Ameaça (chance diária acima de 40) entram na v0.2 ou só a roteirizada? A tag da §8.2 é "`[v0.2 lobos]` `[v0.4 completo]`".
**Atenção:** o Relatório de Retorno só é montado ao abrir a página depois de 4 h; uma aba deixada aberta não o recebe ([architecture.md §6.2](architecture.md)). O critério "aparece no Relatório" precisa valer também nesse caso, ou a limitação fica escrita.
**Verificação:** cenário offline com e sem Paliçada; propriedade; teste em navegador do Relatório.
**Pronto quando:** critério 4 da §16.2 provado por teste de integração e em navegador.

### V2E-T4 · Objetivos do Senhor da v0.2 `S`

**Objetivo:** os objetivos seguintes ao 4 que a v0.2 consegue cumprir, com a regra "nunca mais de 3 ativos".
**GDD:** §12.2 (`[v0.2 completo]`).
**Depende de:** V2C-T2, V2D-T1, V2E-T1, V2E-T2.
**Perguntas para o autor:** dos objetivos 5 a 15, só o 5 (Torre), o 6 (primeira carta) e o 9 (Paliçada) dependem só de mecânicas da v0.2; o 7 e o 8 pedem herói e Patrulha (v0.3) e os demais, exército. A lista da v0.2 pula esses, reordena, ou para no primeiro que não dá para cumprir? A recompensa do 5 ("revela 6 tiles") vale com tiles abstratos?
**Pronto quando:** um cenário roteirizado conclui todos os objetivos da v0.2 na ordem aprovada.

### V2E-T5 · Revisão independente da Fase E `S`

**Depende de:** V2E-T1 a V2E-T4.
**Pronto quando:** defeitos confirmados corrigidos com teste.

---

## 6. Fase F — Fechamento da v0.2

**Meta da fase:** os critérios da §16.2 provados, a v0.2 jogada por pessoas, versão etiquetada.

### V2F-T1 · Balanceamento com o simulador `M`

**Objetivo:** bots que jogam a v0.2 inteira (respondem cartas, constroem Celeiro, Armazém, Torre e Paliçada) e faixas que a CI confere.
**GDD:** §15.2, §15.3.
**Depende de:** Fases C, D e E; V2B-T4.
**Pronto quando:** as metas da §15.2 que valem na v0.2 (população, cap) estão dentro da faixa em 50 sementes, ou cada desvio tem decisão do autor.

### V2F-T2 · Critérios de aceitação da v0.2 `M`

**Objetivo:** um quadro como o de [acceptance-v0.1.md](acceptance-v0.1.md) para os seis critérios da §16.2, com prova automática e prova em produção.
**Depende de:** V2F-T1.
**Entregáveis:** `docs/acceptance-v0.2.md`; roteiro manual da v0.2.
**Pronto quando:** os seis critérios têm evidência escrita, por critério, com data e navegador. Na v0.1 essa evidência não chegou a ser escrita (§8, lição 7): aqui o quadro é preenchido durante o teste, e não depois.

### V2F-T3 · Playtest da v0.2 `M`

**Objetivo:** repetir V2A-T1 com a v0.2, com o mesmo formulário e as mesmas consultas, para comparar.
**Depende de:** V2F-T2.
**Pronto quando:** `docs/playtest/relatorio-v0.2.md` existe e compara o retorno no dia 2 com o da v0.1.

### V2F-T4 · Correções, documentação e release `S`

**Objetivo:** P0 e P1 do playtest corrigidos; `README.md`, `docs/architecture.md`, `CHANGELOG.md` e GDD em dia; tag `v0.2.0` e release.
**Depende de:** V2F-T3.
**Pronto quando:** zero P0 e P1 abertos, a CI verde no commit etiquetado e a tag criada pelo autor.

### V2F-T5 · Preparar a v0.3 `S`

**Objetivo:** `docs/roadmap-v0.3.md` no mesmo formato, com as lições da v0.2.
**Depende de:** V2F-T4.
**Pronto quando:** a primeira tarefa da v0.3 está detalhada o bastante para abrir a sessão seguinte.

---

## 7. Mapa dos critérios de aceitação (GDD §16.2) para tarefas

| # | Critério | Tarefas que o entregam | Como provar |
|---|---|---|---|
| 1 | O estoque para no cap e o painel mostra "cheio em" | V2C-T2 | Propriedade "nunca acima do cap" + teste em navegador |
| 2 | Uma carta aparece a cada 8 h e expira em 24 h com a opção padrão | V2B-T2, V2D-T1, V2D-T3 | Cenário no motor + teste em navegador com relógio controlado |
| 3 | Uma cadeia de 3 cartas funciona de ponta a ponta | V2D-T1, V2D-T2 | Cenário roteirizado com a cadeia inteira |
| 4 | A incursão de lobos do dia 2 acontece offline e aparece no Relatório | V2E-T1, V2E-T2, V2E-T3 | Integração com relógio adiantado + teste em navegador |
| 5 | A troca de ofício reduz a produção por 2 h | V2C-T3 | Unidade + teste em navegador |
| 6 | Dificuldade e ritmo são escolhidos na criação | V2B-T3 | Integração + teste em navegador das boas-vindas |

Os tempos dos critérios 2, 4 e 5 estão no ritmo Normal do GDD; como eles se leem nos outros ritmos é pergunta da §10, item 1.

---

## 8. O que o MVP ensinou

Lições tiradas do Registro de Execução ([MVP-ROADMAP.md §9](../MVP-ROADMAP.md)) e dos ADRs. O playtest com outras pessoas não aconteceu: **não há lição de playtest aqui**. O que o autor relatou ao jogar está na lição 4.

| # | Lição | Evidência | O que muda na v0.2 |
|---|---|---|---|
| 1 | **A plataforma mudou no meio da Fase 3, depois de nove tarefas prontas.** A extensão do VS Code foi implementada e testada por automação, mas nunca aberta em um editor real; quando o autor olhou para o que queria, era outra coisa | [ADR 0008](decisions/0008-cliente-web-com-aparencia-de-editor.md) ("nunca aberta em um editor real"; lista de "trabalho descartado"); Registro, F3-T2 a F3-T10, todas "Substituída pelo ADR 0008"; F3-T2: "**Não verificado:** F5 e a ativação em um VS Code real" | O autor joga cada fase em produção antes de a seguinte começar: o deploy automático a cada push torna isso barato. Uma decisão de experiência (como o Conselho aparece na tela) é mostrada ao autor na primeira tarefa que a toca, e não ao fim da fase |
| 2 | **Testes em navegador real acharam defeitos que os testes sem DOM não achavam.** | Registro, F3-T7: "Testes por renderização em texto: cliques, teclado, foco e os três temas **não foram verificados**". Depois, em Chromium: F3W-T2 (foco da árvore um quadro atrasado; boas-vindas piscando ao recarregar), F3W-T3 (`Esc` falhava antes do primeiro quadro), F3W-T4 (fechar a aba logo depois de uma ordem deixava o cache no passado) | Toda tarefa da v0.2 com interface tem teste em navegador na "Verificação" (§0.4). Segue valendo o limite: só Chromium é automatizado; Firefox, Safari e celular continuam sem conferência |
| 3 | **Revisões independentes por subagentes acharam defeitos reais em toda fase em que foram feitas.** | Registro, F2-T2: sete defeitos de concorrência e robustez no servidor (deadlock entre comando e exclusão, job travado, SQL em logs…); F3-T2: 12 defeitos confirmados e 6 riscos no cliente; F3W-T6: três defeitos achados por testes de unidade escritos por subagentes; F3W-T10: três defeitos médios e uma dúzia de menores (um 401 de proxy apagava a conta local) | A revisão deixa de ser iniciativa da sessão e vira tarefa: uma por fase (V2B-T5, V2C-T6, V2D-T4, V2E-T5), feita por quem não escreveu o código, com cada defeito confirmado virando teste |
| 4 | **Tempo de jogo e tempo real são coisas diferentes, e o GDD mistura os dois.** Com o ritmo fixo em 1 a diferença não aparecia; o autor achou o jogo lento, o ritmo foi a 3× depois da Fase 4, e foi preciso converter prazos e taxas no `ViewState` e trocar o lembrete do "dia 25" por 48 horas reais | [ADR 0011](decisions/0011-ritmo-3x-no-mvp.md); Registro, "Pós-F4 · ajustes de fechamento"; [architecture.md §5](architecture.md); os testes em navegador e de integração seguem no ritmo 1 | Todo número de tempo de uma regra nova diz de qual relógio é. O motor só conhece tempo de jogo; o `ViewState` só fala em tempo real. As frases do GDD em "horas reais" (cartas, festival, incursões) viram perguntas ao autor antes do código (§10, item 1). Cada regra com prazo tem ao menos um teste em um ritmo diferente de 1 |
| 5 | **Documento velho custa caro.** Os documentos de estado foram escritos antes do fato e corrigidos por anotações "(Depois: …)"; alguns ficaram com dois estados no mesmo texto | Registro, F0-T5, F1-T11, F2-T6, F3W-T9, F3W-T10 (anotações "Depois:"); `docs/acceptance-v0.1.md` no commit `bc807cd` dizia que os ajustes "ainda não estavam commitados" e, logo abaixo, que a CI tinha passado neles; `docs/architecture.md`, no mesmo commit, listava como não verificado o que a aceitação já registrava. Os dois foram reescritos no fechamento | Um documento de estado tem data e é reescrito, e não anotado, quando o fato muda. O Registro continua sendo o único lugar com histórico. Fechar uma tarefa inclui procurar o que ela tornou falso em `CLAUDE.md`, README e `docs/` |
| 6 | **"Um commit por tarefa" não foi cumprido, e o Registro não mede esforço.** | Registro: F1-T2 a F1-T8 no commit `ad76fd9`; F2-T1 a F2-T7 em `2b20231`; F3W-T1 a F3W-T8 em `8576c02` ("o código depende um do outro e do mesmo lockfile"); todas as linhas com data 2026-10-01 e "1" sessão | Este roadmap não traz estimativa de prazo. Onde tarefas dependem do mesmo lockfile, o plano já as junta em uma. Reverter uma mecânica precisa ser possível: uma mecânica, um commit |
| 7 | **O que dependia de um ato do autor ficou por fazer até o fim.** | Registro, F3-T9 e F3W-T10 (coluna "Manual" do roteiro nunca executada); [acceptance-v0.1.md](acceptance-v0.1.md): nenhuma linha do quadro com evidência por critério escrita por quem jogou; F4-T2 a F4-T4: backup fora do disco, cópia do segredo, canal de avisos, e-mail de alerta; F3W-T8: vínculo GitHub feito sem o `GITHUB_CLIENT_ID` e nunca exercitado de verdade | Tarefas que dependem do autor dizem **quem faz cada passo** (como V2A-T1) e ficam no começo da fase, e não no fim. O agente não constrói o que depende de uma decisão que ainda não existe: pergunta primeiro (§10) |
| 8 | **O simulador avisou, mas ninguém era obrigado a ouvir.** O bot já terminava a semana com cerca de 10.000 de madeira parada no ritmo 1; no ritmo 3× são 40.872. As faixas do teste só olham população, nível do Salão e fome, no ritmo 1 | Registro, F1-T10 ("~10.000 de madeira parada: sem caps de estoque (v0.2), o excedente não tem saída"); medição de 2026-10-01 em V2A-T2.2; README do `sim-cli` ("no ritmo 3 não há faixa definida") | V2B-T4: faixas no ritmo jogado, com limite para o excedente parado. V2A-T2.3 leva a pergunta ao autor antes das mecânicas |
| 9 | **Dizer "não verificado" funcionou.** As lacunas escritas no Registro foram as que acabaram fechadas ou viraram decisão consciente; as que não estavam escritas foram achadas por revisão | Registro: F0-T5 (CI nunca rodada → rodou), F3W-T9 (app atrás do proxy → conferido em F4-T1), F4-T4 (teste de alerta feito, e-mail não conferido) | O Registro da v0.2 (§11) tem coluna própria para o que não foi verificado |
| 10 | **Uma dependência entrou sem aprovação, e um segredo apareceu na saída de um comando.** | [ADR 0006](decisions/0006-types-node.md) (adotado na Fase 2, aprovado só no fechamento); Registro, F4-T1 ("a senha do primeiro banco apareceu na saída de um comando"; o banco foi recriado) | Dependência nova: ADR aprovado **antes** de instalar. Comandos de operação nunca imprimem variáveis de ambiente de produção |

---

## 9. Dívidas técnicas registradas

Conferidas no código em 2026-10-01. "Bloqueia" quer dizer: precisa estar resolvida antes da tarefa indicada.

### 9.1 Código

| Onde | O que é | Bloqueia a v0.2? |
|---|---|---|
| `packages/engine/src/types.ts` (`schemaVersion: 1`), `packages/server/src/db/schema.ts` (`state` lido sem validação) | Não existe migração de `GameState` | **Sim**: V2B-T1, antes de qualquer mecânica |
| `packages/engine/src/state.ts` (`rng: {}`) | Não existe gerador de números aleatórios | **Sim**: V2B-T2, antes de moral, cartas e incursões |
| `packages/protocol/src/api.ts` (`CreateGameRequestSchema`: `difficulty: 'lord'`, `timeScale: z.literal(1)`, aceito e ignorado), `packages/server/src/games/service.ts` (dificuldade constante, ritmo do servidor) | O jogador não escolhe ritmo nem dificuldade | **Sim**: V2B-T3 (critério 6 da §16.2) |
| `packages/engine/src/types.ts` (`capsEnabled: false`) | O ponto de corte dos caps existe só como tipo literal | Não bloqueia; é resolvido em V2C-T2 |
| `packages/sim-cli/src/balance.test.ts` | Faixas só no ritmo 1 e com uma semente; o GDD §15.3 pede 50 por perfil | **Sim** para o balanceamento: V2B-T4 |
| `packages/web` (Relatório de Retorno) | Só é montado ao abrir a página depois de 4 h; uma aba aberta a noite inteira não recebe | Não bloqueia; **afeta o critério 4** (V2E-T3) |
| `packages/web` (notificações) | Nada chega com a aba fechada | Não bloqueia; pesa mais com cartas que expiram (V2D-T3) |
| `docs/perf-v0.1.md` | O custo de `advanceTo` depois de dias sem acesso nunca foi medido; a v0.2 acrescenta trabalho a cada virada de dia (moral, sorteio, Ameaça), e no ritmo 3× há 36 viradas por dia real | Não bloqueia; medir em V2C-T6 |
| `docs/perf-v0.1.md`, tabela `commands` | Cada recibo guarda a resposta inteira (cerca de 3,4 kB por comando); o `ViewState` da v0.2 será maior | Não bloqueia; medir de novo em V2F-T1 |
| `packages/server/src/games/commands.ts` | Se o relógio do servidor andar para trás, `commands.server_time` guarda o instante regredido; um replay só pelo log usaria esse instante | Não |
| `packages/server` (GDD §14.5) | `GET /catalog` não existe; o `ViewState` traz o que o app exibe | Não; reavaliar com 60 cartas em `content` |
| `packages/web/src/workbench/EditorTabs.tsx` | Botões de fechar aba dentro do `tablist`, fora do padrão ARIA | Não |
| `packages/web/src/services/sessionLock.ts` | A espera de `storageSettle` protege de uma corrida que nunca foi reproduzida em teste | Não |
| `packages/server/src/routes/auth.ts` | Limite do *device flow* por IP; só importa se o vínculo GitHub for ligado | Não |
| App (GDD §13.6) | "Baixar cópia da partida (JSON)" não existe | Não |
| `packages/web/src/tabs/Settings.tsx` | A Hora da Vigília é guardada e não muda nada (é da v0.4) | Não |

### 9.2 Operação

| O que é | Bloqueia a v0.2? |
|---|---|
| Backups no mesmo disco do banco; falta um destino externo no Coolify | Não bloqueia o código; **recomendado antes do playtest** (V2A-T1.3) e **antes de V2B-T1** entrar em produção |
| Não há registro de que `RECOVERY_CODE_SECRET` foi copiado para fora do Coolify | Idem |
| A reversão nunca foi ensaiada atravessando uma migração | **Sim**, para V2B-T1 chegar à produção |
| `deploy/analytics/ops.sql` nunca foi executado em produção, e as consultas de playtest não têm filtro de período | **Sim**, para V2A-T1 (subtarefa V2A-T1.2) |
| Avisos do Coolify sem canal ligado; chegada do e-mail de alerta do GitHub e disparo pelo agendamento não conferidos | Não |
| Deploy automático a cada push no `main`: uma mecânica pela metade chega a quem está jogando | Não bloqueia; **precisa de decisão** (§10, item 3) |
| Verificação de saúde do Coolify desligada nas duas aplicações (Registro, F4-T1): vale só o `HEALTHCHECK` do Docker e o monitor do GitHub | Não bloqueia |
| NTP do servidor nunca conferido (MVP-ROADMAP §10); o tempo de jogo depende do relógio do servidor | Não bloqueia; conferir uma vez antes do playtest |
| `LOTG_GAME_URL` e `LOTG_LANDING_URL` da página de apresentação são variáveis de build nunca conferidas em produção (ADR 0012) | Não bloqueia; conferir antes de divulgar a página |
| Rajadas sincronizadas de leituras ficaram acima da meta local de p95 em `docs/perf-v0.1.md` | Não bloqueia com o público do playtest; medir de novo quando o `ViewState` crescer |
| A API é implantada antes do app: uma aba antiga aberta durante um deploy fala com a API nova. Hoje o app tolera campos a mais e preserva o cursor, mas uma mudança incompatível do `ViewState` precisa subir a versão do protocolo (`426`) | **Decidir em V2B-T1**, antes da primeira mudança de estado |
| Os testes de integração e em navegador rodam no ritmo 1; a produção, no 3. A conversão tem testes próprios, mas nenhum cenário de ponta a ponta roda no ritmo jogado | Não bloqueia; acrescentar um cenário no ritmo do servidor junto com V2B-T4 |

### 9.3 Verificação

| O que não foi verificado | Bloqueia a v0.2? |
|---|---|
| Firefox e Safari sem evidência registrada (o autor informou ter testado em dois navegadores, sem dizer quais); navegadores de celular nunca abertos; leitores de tela nunca usados | Não; o playtest (V2A-T1.5) pede o navegador de cada pessoa |
| A prova em produção dos 12 critérios da v0.1 não foi escrita por critério | Não; a v0.1 fechou assim por decisão do autor |
| O vínculo GitHub nunca foi exercitado com o GitHub real | Não; segue desligado |
| O expurgo de sete dias em produção (as contas de teste do fechamento saem em 2026-10-08) | Não; dá para conferir pelas contagens de `ops.sql` depois dessa data |

---

## 10. Decisões que esperam o autor

Em ordem de quando travam o trabalho.

| # | Decisão | Trava | O que o GDD ou o repositório já dizem |
|---|---|---|---|
| 1 | **Como os tempos do GDD se leem fora do ritmo Normal.** Carta a cada "8 h reais" e que expira em "24 h reais"; troca de ofício por "2 h"; fome de "12 h"; festival de "1 dia real"; lobos no "dia 2" | V2C-T3, V2C-T4, V2D-T1, V2E-T3 | §4.2: "todos os valores deste documento estão no ritmo Normal" e o motor roda em tempo de jogo. Lido assim, tudo escala com o ritmo; mas a §7.1 escreve "reais" de propósito na expiração das cartas |
| 2 | **Quais ritmos o jogador pode escolher.** | V2B-T3 | §4.2 dá Normal (1), Rápido (2) e Tranquilo (0,5). A produção cria partidas em 3× (ADR 0011), que não está nessa lista |
| 3 | **Como a v0.2 chega à produção.** Cada push no `main` é implantado; uma v0.2 pela metade (dificuldade que ainda não muda nada, caps sem Celeiro) apareceria para quem joga | Fase B em diante | O `CLAUDE.md` pede `main` sempre verde e branch para tarefas `L`; nada diz sobre esconder uma versão inteira. Opções: branch longa da v0.2, ligar as mecânicas por configuração do servidor, ou aceitar que a produção é o ambiente de teste |
| 4 | **O que acontece com as partidas da v0.1 quando o estado mudar.** Migrar (e com que estoque, se passar do cap) ou arquivar e começar de novo | V2B-T1, V2C-T2 | §15.4 pede que estados antigos carreguem e migrem; não fala do estoque acima do cap |
| 5 | **Balanceamento do ritmo 3×** (as três perguntas de V2A-T2.3) | V2A-T2, V2B-T4 | §5.5, §6.3, §15.2 |
| 6 | **Mercado e caravanas já na v0.2?** | Fase C | §17.2 lista como questão em aberto; a tabela da §16 os põe na v0.3 |
| 7 | **Quais cartas compõem a v0.2, qual é a cadeia de 3, e quem escreve.** | V2D-T2 | §7.1 e Apêndice B: 12 cartas de amostra, a maioria dependente de v0.3 ou v0.4 |
| 8 | **A carta roteirizada do dia 2** entrega um herói, que é da v0.3 | V2D-T2 | §2.2 e Apêndice B a descrevem; §16.2 põe o critério na v0.3 |
| 9 | **Opção "melhor" e "pior" de cada carta**, para Camponês e Rei de Ferro | V2D-T1 | §12.1; a estrutura da §7.2 só tem `isDefault` |
| 10 | **Lobos:** instante exato, quanto levam, o que é um aldeão ferido, e se as incursões por Ameaça entram na v0.2 | V2E-T3 | §8.2 ("até 15%", "ferem 1 aldeão"); tag "`[v0.2 lobos]` `[v0.4 completo]`" |
| 11 | **Ameaça sem como cair:** limpar um tile e repelir incursões dependem de mecânicas de outras versões | V2E-T1 | §8.2 |
| 12 | **Objetivos 5 a 15 na v0.2:** quais entram | V2E-T4 | §12.2; só 5, 6 e 9 dependem só da v0.2 |
| 13 | **Lenha e postos por edifício:** as regras da §4.1 e da §5.4 que não têm todos os números | V2C-T1, V2C-T3 | Perguntas nas tarefas |
| 14 | **Itens de operação pendentes desde a Fase 4:** destino externo dos backups, cópia do segredo, canal de avisos | V2A-T1.3, V2B-T1 | [architecture.md §6.3](architecture.md) |
| 15 | **Os oito pontos do ADR 0012** (página de apresentação) e se ela entra na mensagem do playtest | V2A-T1.6 | [ADR 0012](decisions/0012-pagina-de-apresentacao.md) |
| 16 | **Ligar o vínculo GitHub** (registrar o OAuth App) ou mantê-lo desligado na v0.2 | Nenhuma tarefa | ADR 0008, ponto 2 |

---

## 11. Registro de execução

Preencher ao fechar cada tarefa.

| Tarefa | Data | Commit | Sessões | O que foi feito e desvios | O que não foi verificado |
|---|---|---|---|---|---|
| V2A-T1 | | | | | |
| V2A-T2 | | | | | |
| V2B-T1 | | | | | |
| V2B-T2 | | | | | |
| V2B-T3 | | | | | |
| V2B-T4 | | | | | |
| V2B-T5 | | | | | |
| V2C-T1 | | | | | |
| V2C-T2 | | | | | |
| V2C-T3 | | | | | |
| V2C-T4 | | | | | |
| V2C-T5 | | | | | |
| V2C-T6 | | | | | |
| V2D-T1 | | | | | |
| V2D-T2 | | | | | |
| V2D-T3 | | | | | |
| V2D-T4 | | | | | |
| V2E-T1 | | | | | |
| V2E-T2 | | | | | |
| V2E-T3 | | | | | |
| V2E-T4 | | | | | |
| V2E-T5 | | | | | |
| V2F-T1 | | | | | |
| V2F-T2 | | | | | |
| V2F-T3 | | | | | |
| V2F-T4 | | | | | |
| V2F-T5 | | | | | |
