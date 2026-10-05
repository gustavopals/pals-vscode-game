# Lords of the Guild — Roadmap da v0.2 "Estações e Conselho"

> **Status:** em execução desde 2026-10-01, por pedido do autor: a v0.2 inteira, sem a sessão de perguntas. Desde a manhã de 2026-10-02, por autorização do autor, cada fase é enviada ao `main` (e implantada) quando fecha verde; em 2026-10-02 as Fases A a E estavam implementadas e enviadas, e a Fase F era fechada de forma enxuta (§11). As decisões de regra da §8 foram **aplicadas por delegação**, com a premissa recomendada de cada uma, nos ADRs [0013](decisions/0013-regras-da-v0.2-tempo-ritmo-migracao-e-economia.md) e [0014](decisions/0014-conselho-e-ameaca-na-v0.2.md), e aguardam a confirmação do autor em [pendencias-v0.2.md](pendencias-v0.2.md). O que cada tarefa entregou está no Registro de execução (§11). Esta é a terceira revisão do documento, reescrita para execução com agentes de código (uma tarefa por sessão, prompts prontos, premissas por decisão).\
> **Versão do documento:** 0.3 (2026-10-01; a 0.2 foi a revisão documental do fechamento da v0.1)\
> **Base:** [GAME_DESIGN.md](../GAME_DESIGN.md) v0.7 (as regras da v0.2 já dizem o que os ADRs 0013 e 0014 decidiram): §16.2 (critérios da v0.2), §18.2 (seções que a v0.2 implementa), §14 (contrato de arquitetura), §15.1 (regras de diversão)\
> **Vem de:** [MVP-ROADMAP.md](../MVP-ROADMAP.md) (v0.1.0, 2026-10-01), tarefa F5-T5\
> **Forma de trabalho:** desenvolvimento 100% com Claude Code, uma tarefa por sessão; o autor decide regras, aprova conteúdo e joga cada fase antes da seguinte\
> **Idioma:** português (Brasil); identificadores de código em inglês

Revisar este plano não conclui tarefas nem aprova regras. As premissas da §8 nasceram como **propostas**. Em 2026-10-01 o autor pediu a versão inteira implementada sem a sessão de perguntas, e elas passaram a valer como regra **por delegação**: estão nos ADRs 0013 e 0014 e no GDD, e cada tarefa as segue sem perguntar de novo. Nenhuma foi respondida pelo autor; a confirmação, decisão a decisão, está pendente em [pendencias-v0.2.md](pendencias-v0.2.md), e uma resposta diferente vira alteração de conteúdo, golden e GDD no mesmo commit. Onde este roadmap e um ADR divergirem, vale o ADR.

**Leia primeiro:** §0.2 (o que o jogador vai sentir), §0.3 (como o plano está organizado), §0.8 (como a v0.2 chega à produção) e §8 (decisões e premissas). Para executar uma tarefa, leia a tarefa, o Apêndice B (nomes e contratos propostos) e a matriz da §7.

## Índice

- [0. Como usar este roadmap](#0-como-usar-este-roadmap)
- [1. Fase A — Playtest da v0.1 e correções](#1-fase-a--playtest-da-v01-e-correções)
- [2. Fase B — Fundação técnica](#2-fase-b--fundação-técnica-antes-das-mecânicas)
- [3. Fase C — O mundo muda: economia sazonal](#3-fase-c--o-mundo-muda-economia-sazonal)
- [4. Fase D — O Conselho do Feudo](#4-fase-d--o-conselho-do-feudo)
- [5. Fase E — Ameaça: Torre, Paliçada e lobos](#5-fase-e--ameaça-torre-paliçada-e-lobos)
- [6. Fase F — Fechamento da v0.2](#6-fase-f--fechamento-da-v02)
- [6b. Fase G — Correções com as respostas do autor](#6b-fase-g--correções-com-as-respostas-do-autor)
- [7. Critérios de aceitação, cenários integrados e sinais de diversão](#7-critérios-de-aceitação-cenários-integrados-e-sinais-de-diversão)
- [8. Decisões que esperam o autor, com premissas recomendadas](#8-decisões-que-esperam-o-autor-com-premissas-recomendadas)
- [9. Dívidas conhecidas](#9-dívidas-conhecidas)
- [10. O que o MVP ensinou](#10-o-que-o-mvp-ensinou)
- [11. Registro de execução](#11-registro-de-execução)
- [12. Conteúdo proposto: o primeiro lote do Conselho](#12-conteúdo-proposto-o-primeiro-lote-do-conselho)
- [Apêndice A — Modelos de prompt](#apêndice-a--modelos-de-prompt)
- [Apêndice B — Contratos de dados propostos da v0.2](#apêndice-b--contratos-de-dados-propostos-da-v02)

---

## 0. Como usar este roadmap

### 0.1 O que é a v0.2

A v0.2 é a linha "Estações e Conselho" da tabela do GDD §16: **estações com efeito, armazenamento, moral, troca de ofício, cartas e cadeias, Torre de Vigia, Paliçada, lobos, dificuldade e ritmo**. O GDD §18.2 diz quais seções ela implementa: §4, §5.4–5.7, §6 (Celeiro, Armazém, Torre, Paliçada), §7, §8.2 (lobos e Ameaça com tiles abstratos) e §12.1. Os critérios de aceitação são os seis da §16.2:

1. O estoque para no cap e o painel mostra "cheio em".
2. Uma carta aparece a cada 8 h e expira em 24 h com a opção padrão.
3. Uma cadeia de 3 cartas funciona de ponta a ponta.
4. A incursão de lobos do dia 2 acontece offline e aparece no Relatório.
5. A troca de ofício reduz a produção por 2 h.
6. Dificuldade e ritmo são escolhidos na criação.

Os tempos dos critérios 2, 4 e 5 estão no ritmo Normal do GDD; em outros ritmos valem as conversões da premissa 1 (§8).

**Não entra:** heróis, Taverna, expedições, Mercado e caravanas, Mestres (v0.3); exército, Quartel, Ferreiro, ferro, armas, formações, Muralha de Pedra, presságios, Fortaleza, Cerco, Hora da Vigília com efeito (v0.4); mapa gráfico, postos avançados, Capela, relíquias, Legado, Temporadas (v0.5). Vale a regra do projeto: **não antecipar mecânicas de versões futuras, nem "só a estrutura"**. Onde uma regra da v0.2 cita algo de outra versão (a carta que entrega um herói, a Taverna na fórmula da moral, o disparo da Torre no nível 3), a parte de outra versão fica de fora.

A v0.2 também herda o que a v0.1 deixou por fazer: o playtest com outras pessoas (Fase A) e as dívidas técnicas que precisam ser pagas antes de mudar o estado do jogo (Fase B).

### 0.2 O que o jogador vai sentir

**Promessa:** "Meu feudo muda com as estações, minhas decisões deixam uma história, e consigo me preparar antes de sair."

A v0.1 é um feudo que cresce sozinho e nunca pede nada. A v0.2 precisa criar **três tensões** e **três alívios**, sempre aos pares. É isso que faz a versão ser divertida, e não a quantidade de painéis:

| Tensão (o mundo pede) | Alívio (o jogador responde) | Onde |
|---|---|---|
| O estoque enche e a produção vai para o chão; o inverno corta a comida e come madeira | Celeiro, Armazém, planejar obras que começam sozinhas, estocar lenha antes do frio | Fase C |
| O Conselho traz um dilema com prazo e sem resposta certa | Escolher, pagar, e ver a escolha voltar numa carta seguinte e na Crônica | Fase D |
| A Ameaça sobe e os lobos vêm à noite, com ou sem o jogador | Torre (saber antes) e Paliçada (perder menos) | Fase E |

A jornada de quem joga no ritmo da produção (3×: um ano em 56 horas reais), com uma ou duas visitas por dia:

| Hora real | O mundo | O que o jogador decide |
|---:|---|---|
| 0 | **Jogar agora**; escolhe dificuldade e ritmo; objetivos 1–3 | Alocar, primeira obra, recrutar (como na v0.1) |
| ~2h40 | Primeira carta do Conselho (4 dias de jogo) | Ler um dilema curto e responder, ou deixar para a próxima visita (24 h reais de prazo) |
| ~5 | Salão Nv2 abre Celeiro, Armazém e Torre; a madeira passa de 400 e o painel diz "cheio em 3h" | Ampliar o estoque ou gastar; deixar o Celeiro planejado para "começar quando houver recursos" |
| ~6 | Uivos ao anoitecer (prenúncio, sem informação); com a Torre, mais tarde, "lobos em 1 h" e o que os vigias veem | Nada obrigatório: a incursão se resolve sozinha. Quem tem Paliçada não perde nada |
| ~10 | **Lobos** (dia 16 de jogo): 10% da comida e da madeira sem Paliçada, um aldeão ferido por um dia | Ler no Relatório o que a defesa teria mudado; planejar a Paliçada (Salão Nv3) |
| 16 | **Verão**: madeira e pedra ×1,15; Salão Nv3 abre a Paliçada | Especializar os ofícios (a experiência do ofício começa a pagar) |
| 32 | **Outono**: comida ×1,3, ouro ×1,1, Ameaça sobe mais rápido; aviso "o inverno chega em 16 h" com a conta da lenha | Estocar madeira, ampliar o Celeiro, segunda fila no Salão Nv4 |
| 48 | **Inverno**: comida ×0,4, lenha 0,5 por habitante/h, obras mais lentas; sem madeira, o frio | Sobreviver com o que preparou; o Relatório diz se faltou lenha e por quanto tempo |
| 56 | **Ano 2**: as cartas voltam a ser elegíveis, as flags ficam, a história continua | Rever prioridades com o que aprendeu |

As horas são do ritmo 3× e servem para orientar o balanceamento; no ritmo Normal multiplicam-se por 3. Nenhuma delas é promessa ao jogador: a página de apresentação continua sem dizer quanto dura um dia ou um ano (ADR 0011).

**Critérios de diversão de toda entrega** (GDD §15.1, aplicado à v0.2):

- **Custo e benefício lado a lado.** Cap, adaptação, moral e lobos só são divertidos se a alternativa for visível, viável e alcançável na mesma tela: "cheio em 3h" vem com o botão do Celeiro; "frio" vem com o número de madeira que falta.
- **Nada obriga a voltar.** Nenhuma regra pune quem ficou dois dias fora além do que o GDD já prevê; nenhuma carta exige acordar para responder (24 h reais de prazo; a opção padrão é sempre a conservadora).
- **O resultado ruim ensina a próxima ação.** Toda perda (desperdício, frio, lobos, aldeão que partiu) vem com a frase do porquê e com uma ação possível. O Relatório de Retorno separa "o que prosperou", "o que custou" e "o que ainda dá para decidir".
- **Toda escolha deixa rastro.** Uma resposta ao Conselho vira uma linha reconhecível na Crônica, e a continuação da cadeia lembra a escolha.
- **Sem opção dominante.** Cada opção de carta é a melhor em algum contexto (comida escassa, ouro sobrando, inverno à porta). O revisor confere carta a carta.
- **Sessões de 2 a 10 minutos**, ações a dois cliques ou um comando, nada de coleta manual, nada de prêmio por login.
- **Conteúdo novo aparece pelos pré-requisitos e objetivos**, nunca como botão desligado de uma versão futura.

### 0.3 Estrutura do plano

```
Fase (A…F)  →  Tarefa (V2C-T2)  →  Subtarefa (V2C-T2.3)
```

Os identificadores começam com `V2` para não se confundirem com os da v0.1 (`F1-T3`). Cada tarefa traz: objetivo, seções do GDD, dependências, **decisões** que ela consome (§8), **entregáveis** (arquivos), subtarefas com caixas de seleção, **diversão** (o que o jogador ganha e como se confere), **verificação** (comandos e resultado esperado), **pronto quando** e um **prompt sugerido** para abrir a sessão.

| Tamanho | Significado |
|---|---|
| `S` | Uma sessão curta do Claude Code |
| `M` | Uma a duas sessões; plano aprovado antes de codar |
| `L` | Duas a quatro sessões; dividir pelas subtarefas, em branch, com merge ao final |

Os tamanhos são complexidade relativa, não prazo. O documento não estima duração total: depende do playtest, da curadoria do conteúdo e do balanceamento.

| Fase | Entrega jogável | Tarefas |
|---|---|---|
| A — Entender a v0.1 | Relatório do playtest com outras pessoas; correções | V2A-T1, V2A-T2 |
| B — Preservar o reino | Partida antiga carregando no código novo; ritmo e dificuldade escolhidos; simulador no ritmo jogado | V2B-T0 a V2B-T5 |
| C — Economia sazonal | Preparar uma ausência, atravessar uma estação, ver o resultado | V2C-T1 a V2C-T7 |
| D — Conselho | Ler, escolher e acompanhar uma cadeia de três cartas | V2D-T0 a V2D-T5 |
| E — Preparação e ameaça | Comparar feudos com e sem defesa na mesma incursão | V2E-T1 a V2E-T5 |
| F — Versão completa | Um ano de jogo e a virada seguinte; playtest; release | V2F-T1 a V2F-T5 |
| G — Respostas do autor | As decisões de 2026-10-05 aplicadas ao jogo que já tem jogadores | V2G-T1 a V2G-T7 |

A ordem das fases é obrigatória. Dentro de uma fase vale o campo "Depende de". Dentro de C, a ordem recomendada é **C1 → C2 → C5 → C3 → C4 → C6 → C7**: entregar a pressão do estoque junto com a automação das obras, para que o autor jogue com a tensão e o alívio ao mesmo tempo.

```
A ──► B ──► C ──► D ──► E ──► F
      │     │     │     │
      │     │     │     └─ E1 Torre/Ameaça ─► E2 Paliçada ─► E3 Lobos ─► E4 Objetivos ─► E5 Revisão
      │     │     └─ D0 Decisões ─► D1 Motor ─► D2 Cartas ─► D3 Interface ─► D4 Retorno/Crônica ─► D5 Revisão
      │     └─ C1 Estações ─► C2 Armazenamento ─► C5 Filas ─► C3 Ofício ─► C4 Moral ─► C6 Antes de partir ─► C7 Revisão
      └─ B0 Decisões ─► B1 Migração ─► B2 RNG ─► B3 Ritmo/dificuldade ─► B4 Simulador ─► B5 Revisão
```

### 0.4 Ritual de cada tarefa (uma sessão de agente)

É o do [MVP-ROADMAP.md §0.3 e §A.4](../MVP-ROADMAP.md), com o que a v0.1 ensinou (§10):

1. **Abrir a sessão** com o prompt da tarefa (ou o modelo do Apêndice A). O prompt pede para ler `CLAUDE.md`, as seções do GDD indicadas, a tarefa, o Apêndice B e as premissas da §8 que a tarefa consome.
2. **Conferir as decisões.** Se uma decisão que a tarefa consome ainda não tem ADR, o agente **para e pergunta** antes de codar, apresentando a premissa recomendada da §8 como padrão. Resposta registrada vira ADR e não é perguntada de novo.
3. **Plano aprovado antes de codar** em tarefas `M` e `L`. O plano lista arquivos, nomes (eventos, códigos de recusa, campos do `ViewState`) e testes, nessa ordem.
4. **Testes primeiro** onde houver regra de jogo ou contrato de API. Para o motor: unidade, propriedade de divisão de intervalo e golden; para o servidor: integração; para o app: unidade sem DOM e navegador.
5. **Mostrar a mecânica ao autor cedo.** Em tarefas com interface, a primeira versão funcional (uma carta, um "cheio em", um aviso de lobos) é apresentada antes de a tela ficar completa.
6. **Verificação** da tarefa e `pnpm verify` (mais `pnpm test:integration` se tocar o servidor, `pnpm test:e2e` se tocar o app, `pnpm test:e2e:landing` e `pnpm capture:landing` se a aba Feudo, a barra de status ou o modo discreto mudarem de aparência), com a saída colada na conversa.
7. **Fechar:** marcar as caixas, preencher o Registro (§11) com o que foi verificado **e o que não foi**, registrar desvios em `docs/decisions/NNNN-titulo.md`, procurar o que a tarefa tornou falso em `CLAUDE.md`, READMEs e `docs/`, e fazer um commit `V2C-T2: resumo`.
8. **Uma tarefa por sessão.** Contexto limpo produz código melhor.

### 0.5 A regra de toda mecânica nova

Vale para cada tarefa das Fases C, D e E (GDD §18.3). Uma mecânica só está pronta com:

- **dados em `@lotg/content`**, com schema zod e teste de conteúdo; nenhum número de jogo no motor, no servidor ou no app;
- **comando validado** no motor, com código de recusa em `REJECTION_CODES` (motor **e** protocolo, que têm teste de igualdade de tipos) e frase legível em português;
- **evento na Crônica**, com o tipo em `EVENT_TYPES` e o modelo de frase em `chronicleTemplates` (`packages/content/src/chronicle.ts`);
- **explicação do número** no `ViewState` (o `breakdown` que o jogador lê ao perguntar "por que este valor?"), calculada no motor, já em tempo real quando for prazo ou taxa;
- **teste**: unidade do instante exato, propriedade de divisão de intervalo ainda exata (estado **e** eventos), golden regravado de propósito com `UPDATE_GOLDEN=1` e diff conferido, e um teste em navegador quando houver interface;
- **bot do simulador** que usa a mecânica (ou um registro de por que não usa);
- **GDD atualizado** se a regra mudou, no mesmo commit.

### 0.6 O que o agente não decide, e como as decisões se fecham

Tudo o que está na §8, qualquer desvio do GDD, qualquer dependência nova, quem participa do playtest, e o que fazer com as partidas em produção quando o estado mudar de versão. Onde o GDD é vago, a tarefa traz a pergunta e a §8 traz a **premissa recomendada**; a resposta do autor vira ADR ou correção do GDD antes do código.

Para não travar o plano inteiro, as decisões fecham em **dois lotes**, cada um em uma sessão própria:

| Lote | Tarefa | Decisões | Resultado |
|---|---|---|---|
| 1 — Fundação e economia | V2B-T0 | 1, 2, 3, 4, 5, 13, 14, 17, 18 (filas), 19 | `docs/decisions/0013-regras-da-v0.2-tempo-ritmo-migracao-e-economia.md` |
| 2 — Conselho e ameaça | V2D-T0 | 1 (Conselho), 7, 8, 9, 10, 11, 12, 18 (Conselho), 20, 21 | `docs/decisions/0014-conselho-e-ameaca-na-v0.2.md` |

As decisões 6, 15 e 16 não bloqueiam tarefa nenhuma e podem esperar. Em cada ADR, registrar **resposta, data, alternativa descartada, razão, tarefa afetada e seção do GDD**. O agente não preenche a resposta do autor por suposição, nem pergunta de novo o que já está registrado.

### 0.7 Contratos transversais de implementação

Detalham a arquitetura existente. As decisões de **regra** ficam na §8.

| Contrato | Aplicação obrigatória |
|---|---|
| **Relógios explícitos** | Cada constante de prazo em `content` declara se é tempo de jogo (`…Ms`, escala com o ritmo) ou tempo real (`…RealMs`, não escala). O motor só conhece tempo de jogo: prazos reais são convertidos com `state.settings.timeScale` (gravado na partida, imutável) no momento em que o prazo nasce. O `ViewState` só fala em tempo real; o app não converte nada |
| **Fronteira da atualização** | A migração de estado (V2B-T1) grava `migratedAtMs`. Regras novas valem a partir dali: caps não cortam estoque herdado, o Conselho conta a primeira carta a partir da migração, a incursão roteirizada do ano 1 só acontece em partidas que ainda não passaram do instante dela. Nada de recalcular silenciosamente a ausência anterior com regras que não existiam |
| **Eventos no mesmo instante** | Ordem fixa em `processEventsAt` (`packages/engine/src/advance.ts`), documentada no README do motor e testada: obras concluídas → aldeões que chegam (recrutados, colonos) → virada de ano → estação → dia (moral, experiência do ofício, sorteios do Conselho e da Ameaça, nesta ordem) → incursões marcadas → início automático de planejadas → objetivos → fome, frio e feridos. Nunca a ordem de importação dos módulos |
| **Simulação que termina** | Um evento consumido não reaparece no mesmo instante; encadeamentos têm limite derivado do conteúdo finito (cartas por ano, filas, planejadas). Testar ausência de laço em: lenha acabando e voltando, cap atingido com consumo, moral mudando de faixa, início automático que libera outro início |
| **Consistência numérica** | Frações `{ num, den }` e milésimos inteiros; sem tolerância no teste de divisão de intervalo. Estado **e** sequência de eventos coincidem, inclusive restos de produção, contadores de desperdício e o estado do RNG |
| **Reenvio de comando** | Responder uma carta, marcar início automático e toda ordem nova passam pelo recibo transacional de `packages/server/src/games/commands.ts`. Duplo clique, duas abas e resposta atrasada não pagam nem recompensam duas vezes; "Tentar de novo" reenvia o mesmo `commandId` |
| **Visão e privacidade narrativa** | O `ViewState` só leva o que o jogador pode saber: efeitos ocultos de cartas, a composição de uma incursão sem Torre e o estado do RNG nunca saem do servidor. O nome de uma flag não é texto de interface |
| **Compatibilidade** | O `ViewState` cresce por adição; `pendingDecisions` deixa de ser `never[]` em V2D-T1, o que quebra o parse do app antigo: nessa tarefa o `protocol` passa a 2 e o servidor responde `426 UPGRADE_REQUIRED` a um `X-Lords-Client` anterior, com "Recarregue a página". Recibos antigos nunca são reescritos; o cache local antigo é descartado pela versão |
| **Relatório confiável** | Variação de estoque não é produção: o Relatório desconta gastos, perdas e desperdício a partir de eventos com totais vindos do motor, agregados por dia (nunca uma linha por polling), com cursores que não duplicam na reconexão |
| **Conteúdo como dados** | IDs estáveis, schemas, condições, efeitos, textos de recusa e de Crônica em `content`. O cliente só apresenta consequências já calculadas |
| **Descoberta gradual** | Todo desbloqueio tem um motivo visível (objetivo, gate do Salão) e uma tarefa que o torna utilizável. Estado vazio, bloqueado, indisponível e erro têm mensagens diferentes |
| **Bot honesto** | O bot do simulador joga só com o `ViewState`, como o app; nunca lê o `GameState`, flags ou o RNG |

### 0.8 Como a v0.2 chega à produção

Hoje todo `push` no `main` com a CI verde é implantado sozinho (`.github/workflows/ci.yml`, job `deploy`), e a CI roda também em *pull requests*. Isso é bom para a Fase A e para a Fase B (nenhuma delas muda regra de jogo), e ruim para as Fases C a E, em que uma mecânica pela metade apareceria para quem joga.

**Premissa recomendada (decisão 3):**

- **Fases A e B:** cada tarefa é um commit no `main`, implantado como hoje. Partidas existentes não mudam de comportamento (a migração preserva tudo; a dificuldade só é exibida; o ritmo novo só vale para partidas novas).
- **Fases C, D e E:** cada fase vive em um branch (`v2c-economia`, `v2d-conselho`, `v2e-ameaca`) aberto como *pull request* desde o primeiro commit, para a CI rodar a cada tarefa. O autor joga a fase no computador dele (`pnpm dev:up`, `pnpm dev:api`, `pnpm dev:web`, com `GAME_TIME_SCALE=3` em `deploy/.env` para sentir o ritmo da produção) ou em um recurso de prévia no Coolify, se ele quiser criá-lo (ato do autor). A fase é mesclada no `main`, e portanto publicada, **quando o autor jogou e aprovou** a demonstração da tabela da §0.3.
- **Fase F:** no `main`, como A e B.

O `main` continua sempre verde. Dentro do branch de fase, "um commit por tarefa" vale como no `main`. Reverter uma mecânica precisa ser possível: uma mecânica, um commit.

### 0.9 Verificação comum

Toda tarefa herda esta verificação, além dos cenários específicos:

```bash
pnpm verify
# Se tocar servidor, persistência ou contrato HTTP (primeiro: pnpm dev:up):
TEST_DATABASE_URL=postgres://lotg:lotg@localhost:5433/lotg_test pnpm test:integration
# Se tocar o app; depois da integração, nunca ao mesmo tempo (dividem o db_test):
pnpm test:e2e
# Se a aba Feudo, a barra de status ou o modo discreto mudarem de aparência:
pnpm capture:landing && pnpm test:e2e:landing
# Se tocar o motor ou o conteúdo: o simulador continua honesto e dentro das faixas
pnpm --filter @lotg/sim-cli test
```

As suítes que usam o banco apagam dados: só `db_test`, nunca a URL de produção. Sem `TEST_DATABASE_URL` a suíte de integração passa vazia e não prova nada. Cada tarefa registra no §11: commit, decisões aplicadas, comandos executados, resultado, cenário jogado pelo autor e o que não foi verificado.

Caminhos marcados **novo** são entregáveis; os demais existem e devem ser conferidos ao abrir a tarefa. As subtarefas descrevem comportamento a provar e propõem nomes (Apêndice B); a tarefa pode mudar um nome, desde que atualize o apêndice.

---

## 1. Fase A — Playtest da v0.1 e correções

**Meta da fase:** pessoas que não são o autor jogam a v0.1 por dois dias, o resultado fica escrito, e o que atrapalha é corrigido antes de qualquer mecânica nova.

Por que primeiro: o [MVP-ROADMAP.md](../MVP-ROADMAP.md) previa este playtest em F5-T2, antes da release. Por decisão do autor, a v0.1 fechou com o playtest do próprio autor, e o playtest com outras pessoas passou a ser a primeira tarefa da v0.2 ([acceptance-v0.1.md](acceptance-v0.1.md)). Ninguém além do autor jogou ainda. O que o playtest disser sobre **o que confunde, o que falta e se as pessoas voltam** é a melhor evidência que a v0.2 vai ter para escolher o que fazer primeiro.

### V2A-T1 · Playtest de 48 horas com 3 a 5 pessoas `M`

**Objetivo:** saber o que confunde, o que falta e se as pessoas voltam, com respostas escritas e números do banco.
**GDD:** §15.1 (regras de diversão), §15.5 (métricas agregadas, sem nome de jogador), §14.14 (o que se guarda da conta).
**Depende de:** v0.1.0 em produção.
**Entregáveis:** **novo** `docs/playtest/relatorio-v0.1.md`, a partir de [playtest/relatorio-modelo.md](playtest/relatorio-modelo.md); ajuste em `deploy/analytics/ops.sql` (V2A-T1.2).

Quem faz o quê: **o autor** convida, entrega o endereço, recolhe as respostas e roda as consultas no Coolify (o agente não tem acesso ao `psql` de produção). **O agente** prepara as consultas, consolida o que o autor colar e classifica os achados com ele.

**Antes de convidar**

- [ ] V2A-T1.1 Conferir a produção no dia: `curl -s https://lords.palsincomehub.com/v1/health` responde `{"status":"ok","db":"ok"}` e `curl -s https://lords.palsincomehub.com/v1/version` traz o `builtAt` do último deploy. Anotar os dois no relatório. **Congelar o `main` durante as 48 horas**: todo push no `main` com a CI verde é implantado sozinho, e um deploy no meio do playtest muda o que as pessoas estão jogando.
- [x] V2A-T1.2 Ensaiar as consultas de playtest de [`deploy/analytics/ops.sql`](../deploy/analytics/ops.sql) no banco de desenvolvimento, depois de uma partida curta (elas **nunca rodaram em produção**). Corrigir o que falhar. Duas limitações a tratar: acrescentar à CTE `jogadores` de cada consulta a janela de criação das contas (por exemplo `and created_at >= timestamptz '2026-10-05 00:00 America/Sao_Paulo' and created_at < timestamptz '2026-10-07 00:00 America/Sao_Paulo'`) e descomentar a linha que tira a conta do autor; e lembrar que leituras não deixam rastro ("voltar" é dar ao menos um comando; quem voltou só para olhar não aparece). — *Registro: Ensaiadas no banco de desenvolvimento; a janela e a conta do autor entram por três variáveis do `psql` (`\set`), não por valores escritos em cada consulta. Nunca rodaram em produção.*
- [ ] V2A-T1.3 Decidir (autor) se os dois itens de operação pendentes são feitos antes de haver dados de outras pessoas no banco: cópia de `RECOVERY_CODE_SECRET` fora do Coolify e destino externo para os backups ([architecture.md §6.3](architecture.md)). Não bloqueiam o playtest; sem eles, perder o servidor perde os feudos dos convidados.
- [ ] V2A-T1.4 Escolher (autor) 3 a 5 pessoas e a janela. Preferir quem trabalha no computador, que é o público do jogo (GDD §1). O servidor aceita 10 contas novas por hora por IP: convidados na mesma rede podem bater nesse limite.

**O que entregar às pessoas**

- [x] V2A-T1.5 Uma mensagem com: o endereço `https://lords.palsincomehub.com` e a instrução inteira (abrir, clicar em **Jogar agora**, jogar quando quiser por dois dias; sem explicar regras: descobrir se o jogo se explica é parte do teste); o pedido de usar o **computador** e de dizer qual navegador usou; o que fica guardado (conta anônima, nome de exibição, ordens e datas de acesso, sem e-mail nem senha; a conta pode ser excluída pelo app); o aviso de que é versão de teste; a dica do **Código do Reino** para quem trocar de máquina; e quando chega o formulário. — *Registro: O texto está pronto em [playtest/convite-v0.1.md](playtest/convite-v0.1.md), com três campos para o autor preencher. **Enviar é ato do autor e não aconteceu.***
- [x] V2A-T1.6 A página de apresentação ([ADR 0012](decisions/0012-pagina-de-apresentacao.md)) só entra na mensagem se o autor já tiver confirmado endereço e texto. Se entrar, anotar: muda o que se mede no "primeiro contato". — *Registro: Na mensagem pronta a página ficou de fora: o ADR 0012 segue sem confirmação.*

**Durante as 48 horas**

- [ ] V2A-T1.7 Sem deploy nem reinício deliberado. Anotar, com data e hora, o que as pessoas relatarem e qualquer queda (`health.yml` avisa por e-mail; a chegada desse e-mail nunca foi conferida).

**Depois**

- [ ] V2A-T1.8 Mandar o formulário [playtest/formulario.md](playtest/formulario.md). Apelido opcional; nenhum outro dado pessoal.
- [ ] V2A-T1.9 Rodar as consultas (autor): Coolify → `lotg-db` → Terminal → `psql -U lotg lotg`, uma consulta por vez: **sessões por dia**, **comandos por sessão**, **tempo até o primeiro comando**, **retorno no dia 2**, mais "Contas: total…" e "Comandos por tipo e resultado". Colar as saídas como vieram. A consulta de retorno só responde para um dia de criação depois que o dia seguinte terminou em São Paulo; rodar cedo demais dá tabela vazia, e não "ninguém voltou". Rodar antes de sete dias do fim: conta excluída some das métricas no expurgo.
- [ ] V2A-T1.10 Consolidar (agente, com o que o autor colar): uma linha por achado, com origem e classe. **P0** bloqueia (não conseguiu jogar, perdeu o feudo, o jogo mostrou algo errado); **P1** atrapalha (travou, entendeu errado, desistiu); **P2** melhoria; **P3** pede mecânica de outra versão (anotar na tarefa deste roadmap ou no GDD §17.3). A classificação é proposta pelo agente e **decidida pelo autor**; pedido de mecânica não vira P0 nem P1.
- [ ] V2A-T1.11 Registrar o que **não** foi medido (quantos responderam, celular, se a conta do autor ficou de fora) e as decisões que saíram.
- [ ] V2A-T1.12 Verificações de operação **fora** da janela congelada, em conta de teste: reinício da API com obra em andamento e aba aberta; fome e retorno depois de tempo real longo; expurgo de sete dias (as contas do fechamento saem a partir de 2026-10-08). Registrar em [acceptance-v0.1.md](acceptance-v0.1.md).
- [ ] V2A-T1.13 Linha de base de diversão: uma decisão que cada participante lembra, o que esperava ao voltar, o que o fez sair. Contagens e relatos anônimos; sem alegação estatística com 3 a 5 pessoas.

**Diversão:** esta tarefa mede a linha de base. Sem ela, a v0.2 não sabe se ficou mais divertida.

**Verificação:**

```bash
pnpm dev:up
# V2A-T1.2: as consultas rodam sem erro no banco de dev (o psql do contêiner lê pela entrada padrão)
docker compose -f deploy/docker-compose.dev.yml exec -T db psql -U lotg -d lotg -v ON_ERROR_STOP=1 < deploy/analytics/ops.sql
```

**Pronto quando:** `docs/playtest/relatorio-v0.1.md` existe, com as respostas de pelo menos 3 pessoas, as saídas das quatro consultas, ao menos uma métrica de retorno no dia 2, todos os achados classificados e as decisões do autor anotadas. Com menos de 3 respostas o autor decide entre convidar mais gente e registrar a amostra menor como divergência.

**Prompt sugerido:** "Leia CLAUDE.md, docs/roadmap-v0.2.md V2A-T1, deploy/analytics/ops.sql e docs/playtest/. Ensaie as quatro consultas de playtest no banco de desenvolvimento, acrescente o filtro de período e me diga o que mudou. Depois me entregue a mensagem para os convidados e espere eu colar as respostas do formulário e as saídas das consultas para montar docs/playtest/relatorio-v0.1.md."

### V2A-T2 · Correções dos P0 e P1 e a pergunta de balanceamento do ritmo 3× `M`

**Objetivo:** fechar o que o playtest achou de grave e levar ao autor, com números, a pergunta que o simulador levantou no ritmo 3×.
**GDD:** §5.5, §6.3, §15.1 (itens 1 e 2), §15.2, §17.2.
**Depende de:** V2A-T1.
**Entregáveis:** commits de correção, cada um com teste de regressão; relatório atualizado com o destino de cada achado; a resposta do autor registrada (ADR se mudar regra).

- [ ] V2A-T2.1 Cada P0 e cada P1 corrigido com teste de regressão e commit próprio (`V2A-T2: …`). Um P0 ou P1 cuja correção seja uma mecânica nova volta ao autor para reclassificar.
- [x] V2A-T2.2 Repetir a medição do simulador e colar a saída no relatório. *Registro: medida de novo em 2026-10-01, idêntica à tabela abaixo. Como o relatório de playtest não existe, a saída está em [balance-v0.2.md](balance-v0.2.md), seção 1.* Em 2026-10-01, com a semente `pedra-alta-golden`, o bot econômico e 2 sessões por dia em 7 dias reais:

  | Ritmo | População | Salão | Comandos aceitos | Madeira parada | Pedra parada | Ouro parado |
  |---|---|---|---:|---:|---:|---:|
  | 1× | 26 de 35 | Nv3 | 55 | 10.017 | 4.190 | 1.637 |
  | 3× | 35 de 35 | Nv3 | 47 | 40.872 | 16.118 | 6.626 |

  No 3× o mundo anda três vezes mais entre duas visitas, mas o feudo termina nos **mesmos níveis**: com uma fila só, cada visita inicia uma obra, e o progresso fica limitado pelo número de visitas, não pelos recursos. O excedente se acumula sem uso.

  ```bash
  pnpm -s sim -- --seed pedra-alta-golden --days 7 --sessions-per-day 2 --time-scale 1 > /dev/null
  pnpm -s sim -- --seed pedra-alta-golden --days 7 --sessions-per-day 2 --time-scale 3 > /dev/null
  ```

- [ ] V2A-T2.3 Levar ao autor a decisão 5 (§8) com o que o GDD já prevê para o problema: caps (§5.5), segunda fila e início automático (§6.3), escolha de ritmo (§4.2) e a questão em aberto do Mercado (§17.2). Perguntas: (a) alguma delas entra **antes** das mecânicas, como correção, ou todas esperam a sua tarefa (V2C-T2 e V2C-T5)? (b) no 3×, o Salão Nv4 chega tarde demais para a segunda fila ajudar? (c) as faixas do simulador passam a existir no ritmo jogado (V2B-T4)? **A resposta é de regra e é do autor.**
- [ ] V2A-T2.4 Se o autor mudar um número: alterar `@lotg/content`, regravar os goldens com `UPDATE_GOLDEN=1`, conferir o diff e atualizar o GDD no mesmo commit.
- [ ] V2A-T2.5 Publicar somente quando autorizado, fora da janela congelada, e conferir `/v1/version` depois.

**Diversão:** o jogador de duas visitas por dia não deve terminar a semana com dezenas de milhares de madeira paradas: é o sinal de que faltou decisão (§0.2, pilar 1 do GDD). A tarefa não resolve isso; ela garante que a Fase C resolva com números na mão.

**Verificação:** a comum (§0.9), com integração e navegador.

**Pronto quando:** zero P0 e P1 abertos, cada correção com teste, e a decisão 5 com resposta escrita do autor (mesmo que seja "espera a tarefa da mecânica").

**Prompt sugerido:** "Leia CLAUDE.md, docs/playtest/relatorio-v0.1.md e docs/roadmap-v0.2.md V2A-T2. Corrija os P0 e P1 um por vez, cada um com teste de regressão e commit próprio. Depois rode o simulador nos ritmos 1 e 3, me mostre os números e me faça as perguntas de V2A-T2.3; não mude nenhum número de jogo sem a minha resposta."

---

## 2. Fase B — Fundação técnica antes das mecânicas

**Meta da fase:** o que a v0.2 precisa ter no lugar antes de mudar o estado do jogo. Nenhuma tarefa acrescenta mecânica; cada uma diz por que não pode esperar. Todas entram no `main` e vão para a produção sem mudar o comportamento das partidas existentes (§0.8).

### V2B-T0 · Sessão de decisões, lote 1 → ADR 0013 `S`

**Objetivo:** fechar, em uma sessão com o autor, as decisões que travam as Fases B e C, e registrá-las em um ADR.
**Depende de:** V2A-T2 (a resposta da decisão 5 entra aqui).
**Decisões:** 1 (contrato de tempo), 2, 3, 4, 5, 13, 14, 17, 18 (filas), 19.
**Entregáveis:** **novo** `docs/decisions/0013-regras-da-v0.2-tempo-ritmo-migracao-e-economia.md`; GDD §4.1, §4.2, §5.4–5.7, §6.3 corrigidos onde a resposta mudar um número ou uma frase; linha no `docs/decisions/README.md`.

- [ ] V2B-T0.1 Apresentar ao autor cada decisão do lote com a premissa recomendada da §8, a alternativa e o que muda no jogo; uma pergunta por vez, com a recomendação como padrão ("se não disser nada, fica assim"). — *Registro: A sessão não aconteceu: o autor pediu a versão sem ela.*
- [ ] V2B-T0.2 Escrever o ADR com a tabela resposta/alternativa/razão/tarefa/seção do GDD; marcar o estado como `aprovada`. — *Registro: O ADR 0013 está escrito, com a premissa recomendada de cada decisão, mas o estado dele é "aplicada por delegação", não `aprovada`. Falta a confirmação do autor ([pendencias-v0.2.md](pendencias-v0.2.md)).*
- [x] V2B-T0.3 Corrigir o GDD: onde uma frase dizia "reais" e a resposta é "de jogo" (ou o contrário), reescrever a frase; acrescentar os números que faltavam (postos por edifício, instante dos lobos, perdas exatas).
- [x] V2B-T0.4 Atualizar a §8 deste roadmap: decisão fechada deixa de ser pergunta e aponta para o ADR.

**Verificação:** links do ADR e do GDD válidos; `pnpm lint` (o Prettier confere o Markdown).

**Pronto quando:** o ADR 0013 está aprovado e nenhuma tarefa de B ou C tem uma decisão aberta sem resposta.

**Prompt sugerido:** "Leia CLAUDE.md, docs/roadmap-v0.2.md §8 e §0.6, e GAME_DESIGN.md §4, §5.4–5.7 e §6.3. Vamos fechar o lote 1 de decisões: me apresente uma por vez com a sua recomendação como padrão, registre minhas respostas em docs/decisions/0013-…md, corrija o GDD onde a resposta mudar uma frase e atualize a §8 do roadmap."

### V2B-T1 · Migração de `GameState` por `schemaVersion` `M`

**Objetivo:** um estado gravado na versão 1 carrega e joga na versão 2, e o servidor sabe o que fazer com um estado de versão que não conhece.
**Por que antes:** toda mecânica da v0.2 acrescenta campos ao estado. Hoje `GameState.schemaVersion` é o literal `1` (`packages/engine/src/types.ts`), o servidor lê `games.state` sem validar nem migrar (`packages/server/src/games/repository.ts`), e há partidas em produção. O GDD §15.4 pede: "estados com `schemaVersion` antigo carregam e migram no servidor".
**GDD:** §14.6, §14.11, §15.4.
**Depende de:** V2B-T0 (decisões 3 e 4).
**Entregáveis:** **novo** `packages/engine/src/migrations.ts` (função pura `migrateState(json): GameState`); `types.ts` (`schemaVersion: 2`, `settings` com `difficulty` e `timeScale`, `migratedAtMs`); `state.ts`; `packages/server/src/games/repository.ts` e `jobs/advanceStaleGames.ts` (migram ao travar a partida e persistem a versão nova); **novo** `packages/engine/src/__fixtures__/state-v1-*.json`; teste de integração; procedimento de reversão em `deploy/README.md`.

- [x] V2B-T1.1 Inventariar o que tem versão: estado (`schemaVersion`), conteúdo (`contentHash` em `/version`), protocolo (`protocol: 1`), recibos (`response_body` com o `ViewState` da época). Definir o tratamento de cada um no README do servidor: cliente antigo (426 só quando o protocolo subir), versão de estado **futura** desconhecida (recusar com erro interno sem gravar por cima, para uma reversão de imagem não corromper o banco).
- [x] V2B-T1.2 Criar fixtures da v0.1, sanitizadas (sem nome real de conta), geradas pelo motor atual em cenários fixos: feudo recém-criado; com obra ativa e planejadas; com fome; com os objetivos 1–4 concluídos; com estoque alto (o cenário do simulador de 7 dias). Validar a forma do JSON com zod antes de migrar; falha de validação preserva o original e sobe erro. — *Registro: A forma é conferida por guardas escritas à mão (`packages/engine/src/migrations/shape.ts`), não por zod: o motor não ganha dependência.*
- [x] V2B-T1.3 Implementar `migrateState`: sequencial (`1 → 2`, pronta para `2 → 3`), idempotente, pura (entra no `purity.test.ts`). A versão 2 muda **só o que a fundação exige**: `settings.capsEnabled` sai; `settings.difficulty = 'lord'` e `settings.timeScale` entram (o servidor passa o `time_scale` da linha); `migratedAtMs = lastProcessedAt`; `rng` fica como está. Campos de moral, Conselho e ameaça entram **com as suas tarefas**, cada uma com o seu passo de migração e os seus valores iniciais.
- [x] V2B-T1.4 Servidor: `lockGame` lê a linha, migra se `schema_version` for menor que a atual, e persiste estado e versão **na mesma transação** do avanço (`persistState`), inclusive no job. Duas leituras concorrentes da mesma partida antiga migram uma vez (o lock garante). A fronteira da atualização (§0.7) nasce aqui: `migratedAtMs`.
- [x] V2B-T1.5 Compatibilidade: reenvio de um recibo da v0.1 devolve o corpo original (sem reescrever); o cache antigo do app é descartado quando `schemaVersion`/`protocol` mudam (`packages/web/src/services/store.ts`, chave `cacheKey`); uma aba antiga continua funcionando enquanto o protocolo for 1. — *Registro: A marca de versão do cache ficou no valor guardado (`GameCache.version`, em `packages/web/src/game/gameSession.ts`), não na chave: o cursor de eventos e a última visita do cache antigo são reaproveitados.*
- [ ] V2B-T1.6 Reversão: documentar em `deploy/README.md` que voltar a imagem **depois** de uma migração de estado deixa as partidas migradas ilegíveis pela v0.1, e o procedimento: restaurar o backup anterior ao deploy (perde o que foi jogado desde então) ou avançar para uma imagem corrigida. Ensaiar em banco descartável: migrar, reverter a imagem, observar a falha controlada, restaurar. — *Registro: **Parcial.** O procedimento está escrito em `deploy/README.md` ("Reverter depois de uma migração de estado") e a recusa de versão futura tem teste de integração. **O ensaio com duas imagens em banco descartável não foi feito.** Achado no caminho: o motor da `v0.1.0` não confere a versão do estado e lê a versão 2 sem falhar; da versão 3 em diante ele gravaria por cima sem as regras novas.*

**Diversão:** nenhuma diretamente. Protege os feudos de quem já joga: perder o feudo é o pior P0 possível.

**Verificação:**

```bash
pnpm --filter @lotg/engine test -- migrations
TEST_DATABASE_URL=postgres://lotg:lotg@localhost:5433/lotg_test pnpm test:integration games
```

Esperado: cada fixture v1 migra, avança 30 dias e aceita comandos; migrar duas vezes dá o mesmo estado; a propriedade de divisão de intervalo vale sobre um estado migrado; a integração carrega uma linha gravada com `schema_version = 1` e a persiste com `2`.

**Pronto quando:** uma cópia do estado de uma partida real da v0.1 carrega, avança e aceita comandos no código novo, e há um procedimento escrito e ensaiado para reverter um deploy que migrou estados.

**Prompt sugerido:** "Leia CLAUDE.md, docs/decisions/0013-…md, docs/roadmap-v0.2.md V2B-T1 e Apêndice B, packages/engine/README.md e packages/server/README.md. Apresente o plano (fixtures, forma da versão 2, onde o servidor migra, reversão) e espere aprovação. Depois escreva os testes de migração antes do código."

### V2B-T2 · Gerador de números aleatórios com semente e fluxos nomeados `M`

**Objetivo:** sorteios determinísticos e reproduzíveis no motor.
**Por que antes:** a v0.2 é a primeira versão que sorteia (cartas do Conselho, chances diárias da moral, incursões por Ameaça). O estado tem o campo `rng`, vazio, e nenhuma regra sorteia (README do motor).
**GDD:** §14.3 (xoshiro128** ou mulberry32; fluxos `council`, `horde`, …), §14.11 (`rng: Record<string, number[]>`), §18.1 item 3.
**Depende de:** V2B-T1.
**Entregáveis:** **novo** `packages/engine/src/random.ts`; `state.ts` (semente derivada por fluxo a partir de `seed`); testes de vetores, independência e propriedade.

- [x] V2B-T2.1 Algoritmo inteiro e versionado (recomendação: xoshiro128**, estado de 4 inteiros de 32 bits, só operações inteiras, sem `Math.random`). Semente de cada fluxo = hash determinístico de `seed + ':' + nome` (SplitMix32 sobre os bytes da string). Vetores conhecidos de saída gravados em teste. — *Registro: A semente de cada fluxo é FNV-1a de 32 bits sobre `seed + ':' + nome`, expandido por SplitMix32.*
- [x] V2B-T2.2 API interna (não exportada pelo pacote): `nextInt(state, stream, maxExclusive)`, `chance(state, stream, ratio)` e `pickWeighted(state, stream, items)` com validação dos pesos. Pesos zero são ignorados; conjunto vazio ou todos os pesos zero devolvem `null`, nunca lançam. O fluxo é criado sob demanda na primeira chamada.
- [x] V2B-T2.3 Fluxos da v0.2: `council` (sorteio de cartas), `morale` (chegadas e partidas), `horde` (incursões por Ameaça). Consumir um não desloca o outro; salvar e recarregar continua a mesma sequência (o estado é JSON puro).
- [x] V2B-T2.4 Pureza: `deriveViewState`, recusas e recibos **não** sorteiam; só `advanceTo` sorteia, em eventos marcados na linha do tempo. Polling não rerrola nada: avançar até `t2` de uma vez ou em dez pedaços consome o RNG igual.
- [x] V2B-T2.5 Propriedade: um cenário sintético de teste (fora da API pública, em `test-helpers.ts`) com um evento diário que sorteia prova a divisão de intervalo exata com sorteios no caminho. A integração com eventos reais entra em V2C-T4, V2D-T1 e V2E-T3.

**Diversão:** indireta. É o que permite "a mesma semente dá as mesmas cartas" (GDD §11.5) e, no futuro, desafios da semana.

**Verificação:**

```bash
pnpm --filter @lotg/engine test -- random
pnpm --filter @lotg/engine test -- purity
```

**Pronto quando:** a mesma semente dá a mesma sequência; fluxos são independentes; a propriedade vale com sorteios; `purity.test.ts` continua verde.

**Prompt sugerido:** "Leia CLAUDE.md, GAME_DESIGN.md §14.3, docs/roadmap-v0.2.md V2B-T2 e packages/engine/README.md. Implemente o gerador com semente e fluxos nomeados, com vetores de teste primeiro, e prove a divisão de intervalo exata com um evento sintético que sorteia."

### V2B-T3 · Ritmo e dificuldade escolhidos na criação da partida `M`

**Objetivo:** o jogador escolhe ritmo e dificuldade ao criar a partida; os dois ficam gravados e não mudam durante o ano (critério 6).
**Por que antes:** a dificuldade é parâmetro de três mecânicas (cap, abandono por fome, opção padrão das cartas) e precisa existir antes delas. Hoje a dificuldade é a constante `lord` e o ritmo vem de `GAME_TIME_SCALE` (`packages/server/src/games/service.ts`); `CreateGameRequestSchema` aceita só `difficulty: 'lord'` e `timeScale: 1`, e ignora o segundo (`packages/protocol/src/api.ts`).
**GDD:** §4.2, §12.1, §13.9, §14.5, §16.2.
**Depende de:** V2B-T1; decisões 1 e 2.
**Entregáveis:** `packages/content/src/balance.ts` (**novo** `difficulties` com rótulo, descrição e os fatores da v0.2; **novo** `paces` com `timeScale`, rótulo e descrição); `schemas.ts`; `packages/engine/src/types.ts`, `state.ts`, `view.ts` (`settlement.difficulty`, `difficultyLabel`, `paceLabel`); `packages/protocol/src/api.ts`; `packages/server/src/games/service.ts`; `packages/web/src/components/Welcome.tsx`, `palette/commands.ts` ("Nova partida…"), `tabs/Settings.tsx` (mostra os dois, sem editar).

- [x] V2B-T3.1 Conteúdo: `difficulties: { peasant, lord, ironKing }` com `label`, `description` (uma frase sobre o que muda **nesta versão**) e os fatores que a v0.2 usa (`storageCapacity`, `famineDesertion`, `cardAutoResolve`); `paces` com os ritmos da decisão 2 (premissa: `1`, `3` padrão, `0.5`), rótulo e descrição em tempo real ("um ano em 56 horas"). Teste de conteúdo: um ritmo padrão, fatores dentro da faixa do GDD §12.1. — *Registro: `cardAutoResolve` **não** foi criado: pelo ADR 0014 (decisão 9) a opção automática é marcada em cada carta. Entraram a mais `recommended` (dificuldades e ritmos) e `hint` (ritmos).*
- [x] V2B-T3.2 Protocolo e servidor: `CreateGameRequestSchema` aceita `difficulty` entre os IDs do conteúdo e `timeScale` entre os valores de `paces`; valor inválido é `400 VALIDATION`; corpo sem os campos usa o padrão (compatibilidade com o app antigo). `GAME_TIME_SCALE` deixa de definir o ritmo das partidas novas e passa a ser o **padrão** quando o corpo não traz `timeScale` (os testes continuam com `1`). Partidas antigas não mudam.
- [x] V2B-T3.3 Motor: `settings.difficulty` e `settings.timeScale` no estado (já previstos pela migração); `deriveViewState` passa a ler o ritmo do estado quando `options.timeScale` não vier. `ViewState.settlement` ganha `difficulty`, `difficultyLabel` e `paceLabel`.
- [x] V2B-T3.4 Boas-vindas (GDD §13.9): duas linhas de opções com a recomendada marcada e uma frase por opção; **Jogar agora** continua a um clique com os padrões (critério 1 da v0.1: menos de 30 s até o primeiro comando). "Nova partida…" pela paleta pergunta os dois em listas de escolha. Nas Preferências, "Dificuldade: Senhor · Ritmo: um ano em 56 horas (não mudam durante o ano)". — *Registro: As opções chegam ao app por `GET /v1/catalog`. A linha das Preferências usa o `paceLabel` inteiro ("Ritmo: Rápido: um ano em 56 horas").*
- [x] V2B-T3.5 Enquanto a dificuldade ainda não muda nada (até V2C-T2), a descrição diz isso ("Nesta versão a dificuldade muda o armazenamento, a fome e o Conselho; eles chegam em breve") só se a tarefa for publicada antes da Fase C; com a premissa da §0.8, a frase é a definitiva. — *Registro: Vale a frase definitiva (§0.8): as descrições já falam de Celeiro, Armazém, deserção e Conselho, que só chegam nas Fases C e D.*
- [x] V2B-T3.6 Testes: integração (criar com cada combinação; inválido 400; sem campos usa os padrões; partida antiga intacta); navegador (boas-vindas com as duas escolhas, só pelo teclado; duas partidas com ritmos diferentes mostram prazos diferentes); unidade do `ViewState`.

**Diversão:** escolher o ritmo é a primeira decisão com custo: quem joga uma vez por dia escolhe 0,5× e não perde cartas; quem quer ver o inverno nesta semana escolhe 3×. A descrição de cada opção tem que deixar isso claro em uma frase.

**Verificação:**

```bash
pnpm --filter @lotg/content test
TEST_DATABASE_URL=postgres://lotg:lotg@localhost:5433/lotg_test pnpm test:integration games
pnpm test:e2e 01-entrada
```

**Pronto quando:** duas partidas criadas com ritmos diferentes mostram prazos diferentes em tempo real, a dificuldade aparece no `ViewState` e nas Preferências, e o primeiro comando continua a menos de 30 s do clique.

**Prompt sugerido:** "Leia CLAUDE.md, GAME_DESIGN.md §4.2, §12.1 e §13.9, docs/decisions/0013-…md e docs/roadmap-v0.2.md V2B-T3. Apresente o plano (conteúdo, protocolo, servidor, boas-vindas) e espere aprovação. Testes de integração e de conteúdo primeiro."

### V2B-T4 · Simulador no ritmo em que se joga `M`

**Objetivo:** faixas de balanceamento que falhem na CI no ritmo que os jogadores usam, com várias sementes, e um bot preparado para jogar as mecânicas da v0.2 conforme elas entram.
**Por que antes:** as faixas de `packages/sim-cli/src/balance.test.ts` só existem no ritmo 1 e com uma semente; a produção joga no 3. Foi o simulador que mostrou o problema de V2A-T2.2, mas nenhum teste o acusa. O GDD §15.3 pede 50 sementes por perfil.
**GDD:** §15.2, §15.3.
**Depende de:** V2A-T2 (decisão 5), V2B-T3.
**Entregáveis:** `packages/sim-cli/src/simulate.ts`, `report.ts`, `bots/economico.ts`, **novo** `bots/preguicoso.ts`, `balance.test.ts`; **novo** `docs/balance-v0.2.md`; `tests/e2e/server.ts` (ritmo parametrizável).

- [x] V2B-T4.1 Perfis por visitas: 1, 2 e 4 sessões por dia real; lista fixa de 50 sementes (`pedra-alta-001` … `-050`); cada ritmo oferecido; dificuldade Senhor (as outras entram quando tiverem efeito). O relatório identifica ritmo, dificuldade, `contentHash` e versão do motor.
- [x] V2B-T4.2 Duas tabelas: uma duração real fixa (7 dias) e um ano de jogo completo. No 3×, sete dias reais atravessam três anos; não misturar denominadores.
- [x] V2B-T4.3 Colunas novas no CSV e no resumo: horas de fila ociosa com planejadas viáveis, comandos recusados por motivo, aldeões livres por hora. Reservar (sem implementar) as colunas que C a E vão preencher: desperdício por recurso, horas de frio, moral, cartas vistas/respondidas/expiradas, perdas por lobos.
- [x] V2B-T4.4 Faixas: as atuais (população 20–40, Salão ≥ 3, sem fome em 2 sessões/dia) passam a valer **por ritmo**, com os valores aprovados em V2A-T2; nova faixa de "excedente parado" com o limite que o autor definir. Registrar valores medidos e faixas, com unidade e perfil, em `docs/balance-v0.2.md`. — *Registro: As faixas são os **valores medidos com folga** (10% na população, 5% nos tetos), não limites aprovados pelo autor: V2A-T2 não teve resposta dele. A faixa fixa de 20 a 40 no ritmo 1 deu lugar à medida (23 a 29).*
- [x] V2B-T4.5 Cenário E2E no ritmo da produção: `tests/e2e/server.ts` aceita `GAME_TIME_SCALE` por variável (padrão 1) e um teste em `03-retorno-e-conexao.spec.ts` sobe com 3 e confere que os prazos do navegador e da API concordam. Não trocar o ritmo dos testes existentes. — *Registro: Os cenários fundam o feudo no ritmo Rápido pelas boas-vindas e rodam sempre com a suíte; com `GAME_TIME_SCALE=3` no servidor de teste também passam.*
- [x] V2B-T4.6 Interface do bot pronta para a v0.2: `Bot` continua `(view, act)`; um bot é uma lista de **políticas** (comida primeiro, obra mais barata, …) para que C a E acrescentem políticas (ampliar quando "cheio em" < 8 h, responder a carta com a opção mais barata, construir Paliçada quando a Ameaça for conhecida) sem reescrever o bot. O bot só lê o `ViewState`.

**Diversão:** o simulador é o detector de tédio: fila ociosa, excedente parado e aldeão livre por horas são sinais de que o jogo não pediu nada.

**Verificação:**

```bash
pnpm --filter @lotg/sim-cli test
pnpm -s sim -- --seed pedra-alta-001 --days 7 --sessions-per-day 2 --time-scale 3 > /dev/null
GAME_TIME_SCALE=3 pnpm test:e2e 03-retorno-e-conexao -g "ritmo"
```

**Pronto quando:** existe uma faixa aprovada para cada ritmo oferecido, o teste falha se o excedente parado passar do limite aprovado, e o cenário E2E no ritmo 3 passa.

**Prompt sugerido:** "Leia CLAUDE.md, GAME_DESIGN.md §15.2 e §15.3, docs/roadmap-v0.2.md V2B-T4, packages/sim-cli/README.md e docs/decisions/0013-…md. Apresente o plano (perfis, sementes, colunas, faixas por ritmo, políticas do bot) e espere aprovação. Não ajuste nenhum número de conteúdo nesta tarefa."

### V2B-T5 · Revisão independente da fundação `S`

**Objetivo:** revisão de leitura, por um agente que não escreveu o código, de V2B-T1 a V2B-T4, antes de as mecânicas se apoiarem nelas.
**Por que antes:** na v0.1, toda revisão independente achou defeitos reais (§10, lição 3). Migração e sorteio são os dois lugares em que um erro corrompe partidas de verdade.
**Depende de:** V2B-T1 a V2B-T4.
**Entregáveis:** relatório da revisão ligado no Registro; correções com teste de regressão.

- [ ] V2B-T5.1 Revisor independente (subagente com o prompt do Apêndice A.4) confere diffs e decisões contra as fixtures da v0.1, sem aceitar teste verde como prova de preservação dos dados.
- [ ] V2B-T5.2 Tenta: migração concorrente; versão de estado desconhecida; falha transacional no meio da migração; recibo antigo reenviado; cliente antigo; sorteios depois de salvar e recarregar; criação de partida com corpo antigo e com corpo inválido.
- [ ] V2B-T5.3 Confirma que a matriz de ritmos é exercitada e que o bot não lê nada além do `ViewState`.
- [ ] V2B-T5.4 Classifica cada achado; corrige os confirmados com regressão; registra no §11 os cenários que não foram executados.

**Pronto quando:** cada defeito confirmado tem teste e correção, e o que ficou sem correção está no Registro com o motivo.

**Prompt sugerido:** "Leia CLAUDE.md e docs/roadmap-v0.2.md V2B-T5. Lance um subagente revisor com o prompt do Apêndice A.4 sobre os commits de V2B-T1 a V2B-T4; depois corrija cada defeito confirmado com um teste de regressão e me mostre o relatório."

---

## 3. Fase C — O mundo muda: economia sazonal

**Meta da fase:** estações, armazenamento, segunda fila, ofício e moral, todos no motor, com interface, bot e teste; e a aba Hoje dizendo o que preparar antes de sair. Critérios 1 e 5 da §16.2. Branch `v2c-economia` (§0.8).

Cada tarefa segue a regra da §0.5. A ordem recomendada é **C1 → C2 → C5 → C3 → C4 → C6 → C7**. O que o autor deve conseguir fazer ao fim da fase: escolher uma obra automática, conferir reservas e produção, sair, atravessar uma estação com o relógio de teste e voltar sabendo o que terminou, o que foi desperdiçado e o que fazer a seguir.

### V2C-T1 · Estações com efeito `M`

**Objetivo:** os multiplicadores de produção por estação, o recrutamento mais rápido na primavera, e o inverno: lenha, obras mais lentas e o frio.
**GDD:** §2.1, §4.1, §5.3.
**Depende de:** V2B-T5; decisão 13 (lenha e duração de obras na virada).
**Fica para outra tarefa:** "moral −20" do frio entra com a moral (V2C-T4); expedições, presságios, preço da comida e cerco são de outras versões.
**Entregáveis:** `packages/content/src/balance.ts` (`seasons[].effects`, **novo** `winter`), `chronicle.ts` (`coldStarted`, `coldEnded`); `packages/engine/src/economy.ts`, `timeline.ts`, `advance.ts`, `construction.ts`, `population.ts`, **novo** `cold.ts`, `view.ts`; `packages/web/src/components/ResourcesTable.tsx`, `Header.tsx`, `ui/treeModel.ts`.

- [x] V2C-T1.1 Conteúdo: cada estação ganha `effects: { production: Record<ResourceId, Ratio>; recruitmentDuration: Ratio; constructionDuration: Ratio; firewoodPerVillagerPerHour: number }` com os números da tabela §4.1 (comida ×1,2/×1,0/×1,3/×0,4; madeira e pedra ×1,15 no verão e ×0,8 no inverno; ouro ×1,1 no outono; recrutamento ×0,8 na primavera; obras ×1,5 e lenha 0,5 no inverno). **Novo** `winter: { cold: { productionMultiplier: 4/5 } }`. Teste de conteúdo: toda estação tem os quatro recursos e fatores positivos. — *Registro: A lenha é fração (`firewoodPerVillagerPerHour: { num: 1, den: 2 }`), não o `number` 0,5: o motor só faz conta com inteiros. Os efeitos ficam em `balance.calendar.seasons[].effects`.*
- [x] V2C-T1.2 Produção: o fator da estação entra em `economy.ts` como fração, no mesmo lugar do bônus de nível e da fome; a mudança vale no instante exato da virada (`seasonChanged` já é evento da linha do tempo). O `breakdown` de cada taxa cita o fator ("× 1,3 (outono)"). — *Registro: A produção virou uma conta só (`productionFactors`: nível, mestria, estação, moral, fome, frio), com um arredondamento no fim; a visão escreve um termo por fator.*
- [x] V2C-T1.3 Durações (premissa 13): uma obra **iniciada** no inverno tem `finishesAtMs` calculado com ×1,5; uma obra que atravessa a virada mantém o prazo. Um recrutamento **ordenado** na primavera leva ×0,8. O `UpgradeView.durationSeconds` e `recruitment.secondsPerVillager` já refletem a estação atual, e o texto diz por quê. — *Registro: O fator da estação entra **antes** do teto de 8 h (nenhuma obra do conteúdo atual chega ao teto). Na primavera o ×0,8 vale para a ordem inteira de recrutamento. O porquê vem em `durationNote`.*
- [x] V2C-T1.4 Lenha: no inverno, a madeira tem consumo contínuo de `0,5 × habitantes` por hora de jogo, somado ao saldo (`perHour` e `breakdown` da madeira mostram "−9/h (lenha de 18 habitantes)"). O instante em que a madeira acaba no inverno é evento da linha do tempo, como a comida (`timeline.ts`): abre o **frio** (`settlement.cold = { sinceMs }`, evento `coldStarted`), produção ×0,8 em tudo; o frio termina no primeiro instante em que a madeira volta a ser positiva (`coldEnded`) e **sempre** na virada para a primavera. Comida e madeira acabando no mesmo instante: fome e frio abrem na ordem fixa, sem oscilação. — *Registro: O frio termina quando o estoque cobre ao menos um instante de lenha ou o saldo fica positivo já com a penalidade (o contrário exato da condição que o abre), e sempre na primavera. `settleFamine` deu lugar a `settleScarcity` (fome, depois frio, até o repouso). `advanceTo` acomoda fome e frio no instante atual antes de o tempo andar.*
- [x] V2C-T1.5 `ViewState`: `calendar.seasonEffects: string` (uma frase com o que a estação atual muda); `calendar.nextSeason: { id, label, secondsUntil, changes: string[] }` (as frases do que vai mudar, para o aviso de V2C-T6); `winter: null | { firewoodPerHour, cold: null | { secondsElapsed, text } }`. O aviso de frio é diferente do de fome na barra de status e nos avisos (`notifications/policy.ts`: essencial). — *Registro: Campos além do previsto: `calendar.nextSeason.firewood` e `winter.firewood` (a conta da lenha), `durationNote` nas obras e no recrutamento. No app (`7b69129`): cabeçalho, conta da lenha à vista, aviso de frio, linha da Lareira na árvore, barra de status e avisos (`coldStarted` é alarme; `coldEnded` e `famineEnded` chegam como alívio).*
- [x] V2C-T1.6 Testes: unidade por estação (taxa exata em milésimos); fronteiras antes/no/depois da virada; inverno inteiro com e sem madeira; salto de dois anos de uma vez igual a 730 passos; propriedade de divisão de intervalo atravessando viradas e o início do frio; um ritmo diferente de 1; golden regravado de propósito. Navegador: a aba Feudo mostra "× 1,3 (outono)" no tooltip e o aviso de frio na barra. — *Registro: O frio tem golden próprio (`chronicle-winter.txt`) e dois `ViewState` novos. Navegador: "o ano passa" (02-feudo) e "ritmo Rápido: a lareira do inverno" (03). O fim do frio pela primavera (`reason: thaw`) só tem teste de motor.*

**Diversão:** o jogador sente o ano passar sem olhar o calendário: a colheita do outono enche o Celeiro, o inverno cobra lenha. O teste de diversão é o autor dizer, antes do inverno chegar, quanta madeira precisa guardar, só com o que a tela mostra.

**Verificação:**

```bash
pnpm --filter @lotg/engine test -- economy
pnpm --filter @lotg/engine test -- cold
pnpm --filter @lotg/engine test -- advance
pnpm test:e2e 02-feudo
```

**Pronto quando:** o `ViewState` explica cada taxa com o fator da estação, a virada muda as taxas no instante exato, o frio começa e termina em instantes exatos registrados na Crônica, e o golden novo foi conferido linha a linha.

**Prompt sugerido:** "Leia CLAUDE.md, GAME_DESIGN.md §4.1 e §5.3, docs/decisions/0013-…md, docs/roadmap-v0.2.md V2C-T1 e Apêndice B, e packages/engine/README.md. Apresente o plano (conteúdo, onde o fator entra, lenha e frio como eventos, campos novos do ViewState, testes) e espere aprovação. Testes de unidade e de propriedade antes do código."

### V2C-T2 · Armazenamento: Celeiro, Armazém e caps `M`

**Objetivo:** o estoque para no cap, o excedente é perdido e contado, o painel diz "cheio em", e o objetivo 4 volta a desbloquear Celeiro, Armazém e Torre.
**GDD:** §5.1, §5.2 (cap inicial de 500), §5.5, §6.1, §6.2, §12.1 (cap por dificuldade), §12.2 (objetivo 4), §15.2, §16.2 (critério 1).
**Depende de:** V2C-T1; decisões 4 (estoque herdado) e 17 (contrato dos caps).
**Entregáveis:** `packages/content/src/ids.ts` (`granary`, `warehouse`, `watchtower` em `BUILDING_IDS`), `buildings.ts` (os três, com `requires: { townHall: 2 }`; a Torre só é **construível** depois de V2E-T1: até lá `maxLevel: 0`, e o teste de conteúdo aceita isso só para ela), `balance.ts` (**novo** `storage`), `objectives.ts` (recompensa do objetivo 4 vira desbloqueio, [ADR 0002](decisions/0002-objetivo-4-v01.md)), `chronicle.ts` (`buildingFounded`, `storageFilled`, `storageWasted`); `packages/engine/src/types.ts`, `economy.ts`, `construction.ts`, `timeline.ts`, **novo** `storage.ts`, `view.ts`; protocolo; `packages/web/src/components/ResourcesTable.tsx`, `ConstructionsPanel.tsx`, `game/returnReport.ts`.

- [x] V2C-T2.1 Conteúdo: `storage: { baseCapacity: 500; buildings: { granary: { resources: ['food'], level1: 900, perLevel: 600 }, warehouse: { resources: ['wood', 'stone'], level1: 900, perLevel: 600 } } }`; `difficulties[].storageCapacity` (×1,25 / ×1,0 / ×0,8). Edifícios no nível 0: `buildings.granary = 0`; construir é a melhoria 0 → 1 pelo custo base, com `requires.townHall` como gate além de `nível do Salão + 1`. Ouro continua sem cap. — *Registro: **A Torre de Vigia não entrou**: `watchtower` fica para V2E-T1. O nível inicial e o `requires` são de cada edifício (`buildings[].initialLevel`; `balance.initial.buildingLevel` saiu). Antes do edifício, o lugar chama "Despensa" (comida) e "Pátio" (madeira e pedra), texto escrito pelo agente.*
- [x] V2C-T2.2 Motor: `storageCapacity(state, resource)` derivada (premissa 17: `máx(500, capacidade do edifício) × fator da dificuldade`, em milésimos, arredondando para baixo). Toda entrada de recurso passa por `storage.ts`: a produção contínua tem o instante de **encher** como evento da linha do tempo (`storageFilled`, uma vez por episódio); depois dele, a produção daquele recurso vira desperdício em `stats.wasted_<recurso>`; ganhos discretos (recompensa de objetivo, devolução de cancelamento, efeito de carta) são cortados no cap, com o corte contado. Estoque **herdado** acima do cap fica como está e não recebe produção até cair abaixo (premissa 4). — *Registro: `storageFilled` não guarda nada no estado: em repouso, "cheio" é o próprio estoque. O único campo novo é `settlement.wasted` (milésimos ainda não relatados). Recusa nova, fora do Apêndice B: `EXCEEDS_STORAGE`, quando o custo não cabe no depósito.*
- [x] V2C-T2.3 Relatório: na virada de cada dia de jogo, se houve desperdício no dia, o evento `storageWasted` leva as quantidades por recurso ("Celeiro cheio: 120 comida desperdiçadas"); nunca uma linha por polling. `buildReturnReport` ganha a linha de desperdício e passa a separar produção, gasto e perda a partir dos eventos. — *Registro: O evento diário leva unidades inteiras e a fração passa ao dia seguinte. **`storageWasted` fica fora da Crônica** ([ADR 0015](decisions/0015-cronica-sem-o-fecho-diario-do-desperdicio.md), decidido pelo agente, aguardando o autor); continua em `GET /events` e no Relatório. Os eventos levam totais em `data` (`spent_*`, `gained_*`, `wasted_*`). No app (`c762177`): tabela Antes, Produção, Gasto, Recebido, Perdido, Agora e uma linha de desperdício.*
- [x] V2C-T2.4 `ViewState`: `resources[].cap` preenchido (ouro `null`), `fullInSeconds` (`null` se não está subindo ou já está cheio), `full: boolean`, `wastedToday`, e o `breakdown` explica a capacidade ("500 iniciais; Celeiro Nv2: 1.500"). A previsão de "cheio em" não olha além do próximo evento que muda a taxa (virada de estação, fim de obra): se o enchimento cai depois dele, mostra "depois da virada do outono". — *Registro: A explicação do limite vem em `capBreakdown`; quando o enchimento cai depois de algo que muda a taxa, `fullInSeconds` é `null` e `fullNote` diz "Não enche antes da virada…". Campos a mais: `storageBuilding`, `storageLabel`, `fullNote`, `wastingPerHour`, `effect` nas obras e `lost` na devolução.*
- [x] V2C-T2.5 Auditoria de alcançabilidade (antes de mexer em número): com a capacidade inicial de cada dificuldade, o custo de **cada** melhoria do caminho até o Salão Nv4 e os Nv2 de Celeiro e Armazém cabe no cap vigente antes dela? Rei de Ferro (×0,8 = 400) é o caso apertado: o Salão Nv2 custa 150 madeira, 100 pedra, 100 ouro; o Celeiro Nv2 custa 256 madeira e 128 pedra. Tabela no plano; travas vão ao autor. — *Registro: Tabela em [balance-v0.2.md](balance-v0.2.md) §4.1. Nenhuma trava até o Salão Nv4 e os depósitos Nv2, nas três dificuldades. **Travas de fim de jogo, levadas ao autor sem mexer em número:** em Senhor, o Salão 7→8 custa 5.102 de madeira e o Armazém Nv8 guarda 5.100; Pedreira e Mina 9→10 custam 5.154. Em Rei de Ferro o Armazém para no Nv7 (o Nv8 custa 4.295 e ele guarda 3.600).*
- [x] V2C-T2.6 Objetivo 4: a recompensa passa a ser o desbloqueio (texto "Desbloqueia Celeiro, Armazém e Torre de Vigia"), com `reward` vazio em recursos; partidas migradas que já o concluíram não recebem nada de novo e **não** ficam sem os edifícios (o gate é o Salão Nv2, não o objetivo). — *Registro: O texto é "desbloqueia o Celeiro e o Armazém"; a Torre entra na frase em V2E-T1. Quem ainda não concluiu o objetivo deixa de ganhar os 50 de ouro.*
- [x] V2C-T2.7 Interface: a tabela de recursos mostra `412 / 1.500` e "cheio em 4h" com destaque abaixo de 8 h; a linha da árvore repete ("madeira 655/900 ⚠ cheio em 4h", GDD §13.2); o painel de construções lista Celeiro e Armazém em "Construir" com o motivo quando bloqueado. Bot: política "ampliar o estoque do recurso que enche em menos de 8 h". — *Registro: A tabela mantém as colunas Estoque e Cap do GDD §13.3 (o "655/900" fica na árvore). O painel tem as listas "Melhorar" e "Construir", sem "Nv0". O aviso do depósito traz o custo, o efeito e o botão da obra na mesma caixa. Bot: `ampliar o estoque`, depois de `obra mais barata`.*
- [x] V2C-T2.8 Testes: propriedade "recurso limitado nunca acima do cap, exceto herdado" (GDD §15.4) e divisão de intervalo exata com o enchimento no caminho; ganho de recompensa e cancelamento no limite; capacidade mudando com uma obra concluída no mesmo instante do enchimento; cap com consumo contínuo (comida); 30 dias cheios geram 30 eventos de desperdício, e não um por hora. Navegador: "cheio em" aparece, e some ao construir o Celeiro. — *Registro: Navegador: "a Despensa enche" (02-feudo). `EXCEEDS_STORAGE` e o estoque herdado acima do limite só têm teste de motor e sem DOM.*

**Diversão:** o cap transforma "sobrou" em "escolha": ampliar (Celeiro) ou gastar (obra). O teste é o autor ver "cheio em 3h" e saber, na mesma tela, o que fazer. Um cap sem o botão do Celeiro ao lado é só punição.

**Verificação:**

```bash
pnpm --filter @lotg/content test
pnpm --filter @lotg/engine test -- storage
pnpm --filter @lotg/engine test -- economy.property
pnpm test:e2e 02-feudo -g "cheio"
```

**Pronto quando:** critério 1 da §16.2 provado por propriedade e em navegador, o Relatório de Retorno traz a linha de desperdício, e a auditoria de alcançabilidade está no Registro.

**Prompt sugerido:** "Leia CLAUDE.md, GAME_DESIGN.md §5.5, §6.1–6.2 e §12.1, docs/decisions/0002 e 0013, docs/roadmap-v0.2.md V2C-T2 e Apêndice B. Apresente o plano com a tabela de alcançabilidade por dificuldade e espere aprovação. Propriedade 'nunca acima do cap' antes do código."

### V2C-T5 · Segunda fila de obras e início automático das planejadas `M`

**Objetivo:** o Salão Nv4 abre a segunda fila; planejadas marcadas "iniciar quando houver recursos" começam sozinhas, na ordem da lista, nos instantes exatos.
**GDD:** §6.1, §6.3 (as duas regras têm a tag `[v0.2]`), §14.11 (`planned[].autoStart`).
**Depende de:** V2C-T2; decisão 18 (filas).
**Entregáveis:** `packages/content/src/balance.ts` (`construction.queues: 2`, `secondQueueTownHallLevel: 4`), `chronicle.ts` (`constructionAutoStarted`); `packages/engine/src/construction.ts`, `timeline.ts`, `advance.ts`, `commands.ts` (`planConstruction` com `autoStart`, **novo** `setAutoStart`), `types.ts`, `view.ts`; `packages/protocol/src/commands.ts`; `packages/client-sdk`; `packages/web/src/components/ConstructionsPanel.tsx`, `palette/commands.ts`; bot.

- [x] V2C-T5.1 Estado: `constructionQueues` passa a ter duas posições; a segunda só aceita obra com Salão ≥ 4 (recusa `QUEUE_LOCKED`: "A segunda fila abre com o Salão do Senhor Nv4"). `planned[]` ganha `autoStart: boolean`; a migração marca as planejadas antigas como manuais. Continua proibido melhorar o mesmo edifício em duas filas (`ALREADY_UPGRADING`). — *Registro: Com a fila ocupada e o Salão abaixo do Nv4, a recusa é sempre `QUEUE_LOCKED`; `QUEUE_BUSY` ficou para as duas filas ocupadas. Quantas filas estão abertas é derivado do nível do Salão, nunca guardado.*
- [x] V2C-T5.2 Comandos: `planConstruction { building, autoStart? }` (padrão `false`) e `setAutoStart { building, autoStart }` (recusa `NOT_PLANNED`). Planejar não cobra; iniciar cobra uma vez; cancelar segue a devolução de 80% e o cap.
- [x] V2C-T5.3 Início automático (premissa 18): o motor tenta as planejadas automáticas **na ordem da lista** em três ocasiões: depois de todo comando, depois de todo evento discreto que muda recursos ou filas (obra concluída, recompensa, efeito de carta), e no instante em que a produção contínua passa a cobrir o custo. Esse instante é evento da linha do tempo (`nextAutoStartAt` em `timeline.ts`): para cada recurso que falta, `faltante ÷ saldo líquido`, só se o saldo for positivo e o custo couber no cap; senão a planejada espera com motivo. Uma planejada bloqueada **não** impede as seguintes. Evento `constructionAutoStarted` ("Com as reservas cheias, os pedreiros começaram sozinhos a Serraria Nv3"). — *Registro: Em `planned.ts` (`settlePlanned`), alternando com os objetivos até o repouso. Planejar como automática o que já pode começar inicia a obra na mesma ordem. A obra automática **não** olha a reserva de lenha.*
- [x] V2C-T5.4 `ViewState`: `constructions.queues: Array<active | null>` (a `active` atual continua como atalho para a primeira, por compatibilidade), `queuesUnlocked: number`; `planned[]` ganha `autoStart` e `waiting: { reason: 'queue' | 'resources' | 'capacity' | 'gate' | 'upgrading'; text; etaSeconds: number | null }` ("espera 120 madeira: em 2h10", "não cabe no Armazém: amplie-o"). — *Registro: `waiting` é `null` quando a planejada já pode começar (só nas manuais); `text` não leva o prazo, que vai em `etaSeconds`. Campo a mais: `constructions.queuesNote`.*
- [x] V2C-T5.5 Interface: no painel de construções, cada planejada tem a marca "Iniciar quando houver recursos" (um clique, `rowActions` em `workbench/Tree.tsx` e botão no painel) e a linha de espera; a paleta "Planejar obra…" pergunta se é automática. Duas filas aparecem como duas linhas de obra ativa. Bot: política "planejar a próxima melhoria do caminho como automática". — *Registro: No app (`2bb72f7`): uma linha por fila, caixa "Iniciar quando houver recursos" que só muda com a confirmação do servidor, grupo "Planejadas" na árvore, comando `lords.toggleAutoStart` e, fora do pedido, o botão "Iniciar agora" na manual que já pode começar. Bot: `planejar automáticas`; a ordem dos bots mudou (obras antes de `recrutar`).*
- [x] V2C-T5.6 Testes: duas filas disputando recursos; planejada cara atrás de uma barata; cancelamento seguido de início automático; recompensa de objetivo que destrava um início; fim de obra e enchimento no mesmo instante; propriedade: avançar por intervalos diferentes dá os mesmos débitos, as mesmas obras e os mesmos instantes. Navegador: deixar duas planejadas automáticas, saltar 6 h, ver as duas iniciadas no Relatório. — *Registro: Navegador: "duas planejadas automáticas começam sozinhas na ausência" (02-feudo). **As duas filas abertas ao mesmo tempo não foram exercitadas em navegador contra o servidor** (chegar ao Salão Nv4 é longo): estão em testes de motor, de servidor e sem DOM.*

**Diversão:** é o alívio para o jogador de uma visita por dia: a obra que ele não estava lá para iniciar começou sozinha. O teste é o simulador: a fila ociosa com planejadas viáveis deve cair para perto de zero no perfil de 1 visita por dia.

**Verificação:**

```bash
pnpm --filter @lotg/engine test -- construction
pnpm --filter @lotg/engine test -- timeline
pnpm --filter @lotg/sim-cli test
pnpm test:e2e 02-feudo -g "sozinha"
```

**Pronto quando:** um feudo deixado sozinho com planejadas automáticas e recursos chegando inicia as obras nos instantes exatos, o Relatório as lista, e o simulador mostra a fila ociosa caindo no perfil de 1 visita por dia.

**Prompt sugerido:** "Leia CLAUDE.md, GAME_DESIGN.md §6.3, docs/decisions/0013-…md, docs/roadmap-v0.2.md V2C-T5 e Apêndice B, e packages/engine/src/timeline.ts. Apresente o plano (estado, comandos, o evento de 'recursos bastam', ordem das planejadas, ViewState, painel) e espere aprovação. Propriedade de divisão de intervalo com início automático antes do código."

### V2C-T3 · Troca de ofício e experiência do ofício `M`

**Objetivo:** realocar custa: quem acabou de trocar de ofício produz metade por um dia de jogo; edifícios com postos ocupados acumulam experiência e produzem mais (critério 5).
**GDD:** §5.3 (mestria), §5.4, §14.11 (`craftExperience`, `adaptation`), §16.2.
**Depende de:** V2C-T5; decisão 13 (postos e critério de ocupação).
**Entregáveis:** `packages/content/src/balance.ts` (**novo** `craft`), `chronicle.ts` (`craftMastered`); `packages/engine/src/population.ts`, `economy.ts`, `advance.ts`, `timeline.ts`, `types.ts`, `view.ts`; `packages/web/src/components/WorkersPanel.tsx`, `palette/commands.ts` (lista "Alocar trabalhadores…" mostra o custo da troca).

- [x] V2C-T3.1 Conteúdo: `craft: { adaptationMs: 1 dia de jogo; adaptationMultiplier: 1/2; experiencePerDay: 4; experienceLossPerDay: 8; maxExperience: 100; masteryBonus: 3/10; occupiedWorkersPerLevel: 1 }` (premissa 13: um edifício conta como ocupado no dia se, na virada, tem ao menos `nível` trabalhadores; não há limite de postos na v0.2). — *Registro: Em `balance.craft`, com os nomes dos artífices e as frases em `craftGuilds`.*
- [x] V2C-T3.2 Adaptação por coortes: `adaptation: Array<{ building, count, untilMs }>`. Aumentar trabalhadores cria uma coorte com `untilMs = agora + adaptationMs`; diminuir remove primeiro das coortes mais novas (quem acabou de chegar sai primeiro, para a penalidade não se multiplicar); o fim de cada coorte é evento da linha do tempo (sem linha na Crônica: só muda a taxa). Realocar o mesmo aldeão duas vezes no dia não zera nem dobra o prazo. Partida migrada: todo mundo já adaptado. — *Registro: Quem nunca teve ofício também se adapta (o recém-recrutado e o aldeão livre rendem metade no primeiro dia de jogo no edifício). Repetir a ordem com o mesmo número não recomeça o prazo; mover e voltar no mesmo instante custa.*
- [x] V2C-T3.3 Experiência: `craftExperience: Record<ProductionBuildingId, number>` (0–100, parte em 0); na virada do dia, +4 se ocupado, −8 se vazio, limitado; a mestria entra em `economy.ts` como `1 + 0,3 × exp/100` em fração exata. Ao chegar a 100 pela primeira vez no ano: evento `craftMastered` ("Os lenhadores de Pedra Alta dominam o ofício"). — *Registro: Campo a mais no estado: `settlement.craftMasteredYear`, para o "uma vez por ano". "Vazio" foi lido ao pé da letra: com gente, mas menos do que o nível pede, a experiência não sobe nem cai.*
- [x] V2C-T3.4 Produção: `trabalhadores adaptados × taxa + trabalhadores em adaptação × taxa ÷ 2`, com nível, estação, fome, frio e mestria, em milésimos. A soma de trabalhadores nunca ultrapassa os habitantes disponíveis, inclusive quando aldeões partem (V2C-T4) ou se ferem (V2E-T3): remover do edifício com mais gente, primeiro os em adaptação. — *Registro: `releaseExcessWorkers` em `population.ts`; quem a chama é a moral (V2C-T4), quando alguém parte ou deserta.*
- [x] V2C-T3.5 `ViewState`: `workers[]` ganha `experience`, `masteryBonusPercent`, `adapting`, `adaptationEndsInSeconds`, e o `breakdown` explica ("4 × 10 × 1,4 (Nv3) × 1,12 (mestria 40) × 1,3 (outono); 2 em adaptação por 38 min"). Na lista de alocação, ao aumentar: "+2 produzirão metade por 40 min" antes de confirmar; sem diálogo extra no clique simples. — *Registro: Campos a mais: `workersRules`, `occupiedFrom`, `experienceTrend`, `experienceNote`, `adaptingCohorts`, `perNewWorkerPerHour`. O `breakdown` escreve os termos de modo que multipliquem até o total. No app (`d9be8f1`): "+1 aqui: +4/h agora, +8/h depois de 2 h" em cada edifício e a prévia a cada tecla na lista de alocação; a frase "produzirão metade" não foi escrita no app, por ser número de regra.*
- [x] V2C-T3.6 Testes: 0, 1 e vários trabalhadores; ocupado por um dia e vazio por dois; coortes com cortes na metade; fim de adaptação como evento (propriedade); ganho diário em ritmo 3; golden. Navegador: "+1 na Serraria" mostra o custo da troca e a taxa sobe no fim do prazo. — *Registro: Navegador: "+1 na Serraria" e "vinte e cinco dias no mesmo ofício" (02-feudo). Várias levas com prazos diferentes no mesmo edifício só têm teste de unidade.*

**Diversão:** especializar passa a valer a pena, e a reorganização de outono (mais na Fazenda antes do inverno) vira uma decisão com prazo. O teste: o autor planeja a troca de ofício **antes** da estação mudar, porque a tela mostra o custo.

**Verificação:**

```bash
pnpm --filter @lotg/engine test -- population
pnpm --filter @lotg/engine test -- economy
pnpm test:e2e 02-feudo -g "ofício"
```

**Pronto quando:** critério 5 da §16.2 provado por unidade e em navegador, e o `ViewState` mostra quantos estão em adaptação, até quando, e a experiência de cada edifício.

**Prompt sugerido:** "Leia CLAUDE.md, GAME_DESIGN.md §5.3–5.4, docs/decisions/0013-…md, docs/roadmap-v0.2.md V2C-T3 e Apêndice B. Apresente o plano (coortes, experiência diária, fórmula em frações, ViewState, lista de alocação) e espere aprovação. Testes primeiro."

### V2C-T4 · Moral `L`

**Objetivo:** moral de 0 a 100, recalculada na virada do dia, com efeito na produção, as chances diárias de chegada e partida de aldeões, e o abandono por fome longa.
**GDD:** §4.1 (frio), §5.3, §5.6 (−2 por dia faminto; abandono após 12 h de fome, não em Camponês), §5.7, §12.1.
**Depende de:** V2C-T3; decisão 19 (recuperação e piso).
**Fica de fora:** Taverna, relíquias e festival por comando (versões futuras); ajustes temporários de cartas entram em V2D-T1; "incursão sofrida" entra em V2E-T3. Os dois últimos só acrescentam termos à mesma fórmula.
**Entregáveis:** `packages/content/src/balance.ts` (**novo** `morale`), `chronicle.ts` (`moraleBandChanged`, `villagerArrived`, `villagerLeft`, `villagerDeserted`); **novo** `packages/engine/src/morale.ts`, `famine.ts`, `population.ts`, `advance.ts`, `types.ts`, `view.ts`; `packages/web/src/components/Header.tsx` (moral e faixa), `Panels.tsx` (explicação termo a termo), `game/returnReport.ts`.

- [x] V2C-T4.1 Conteúdo: `morale: { base: 50; foodCovers24h: 10; famine: -20; faminePerDay: -2; housingFull: -10; cold: -20; multiplier: { base: 3/4, perPoint: 1/200 }; bands: [{ id: 'desperate', max: 24, label: 'Desesperado' }, …]; arrival: { minMorale: 80, chance: 1/5 }; departure: { maxMorale: 25, chance: 1/5 }; famineDesertionAfterMs: 12 h de jogo; populationFloor: 3 }` e `difficulties[].famineDesertion` (Camponês `false`). — *Registro: `foodReserve: { coverMs, bonus }` no lugar de `foodCovers24h: 10`, para o prazo ficar no conteúdo e não no nome do campo.*
- [x] V2C-T4.2 Cálculo (premissa 19): na virada de cada dia, `moral = 50 + termos`, limitada a 0–100, com os termos desta versão: comida cobre 24 h de jogo (+10), fome (−20, mais −2 por dia inteiro de fome contínua), habitação cheia (−10), frio (−20), efeitos temporários (V2D-T1) e incursão com perdas nos últimos 2 dias de jogo (V2E-T3). O multiplicador `0,75 + 0,5 × moral/100` entra na produção como fração `(150 + moral) / 200`. Partida migrada nasce com 50 e recalcula na próxima virada. — *Registro: Os efeitos temporários ficam em `settlement.moraleEffects` (não em `council.effects`) e ninguém grava neles ainda: **sem eles a moral vai de 0 a 60**. O frio aberto não conta na virada para a primavera. Ordem da virada: experiência, recálculo, colono, partida, deserção.*
- [x] V2C-T4.3 Sorteios (fluxo `morale`, na virada, depois do recálculo): moral ≥ 80 e vaga livre → 20% de um colono chegar (`villagerArrived`, "Atraído pela fama de Pedra Alta, um colono chegou"); moral ≤ 25 → 20% de um aldeão partir (`villagerLeft`). Fome contínua ≥ 12 h → um aldeão deserta por dia de jogo (`villagerDeserted`), exceto Camponês. Nenhuma partida leva a população abaixo de `populationFloor`; quem parte sai do edifício com mais gente (V2C-T3.4). — *Registro: O colono só é exercitado com efeitos gravados à mão nos testes: nenhuma regra desta fase leva a moral a 80.*
- [x] V2C-T4.4 Faixas: `moraleBandChanged` só quando a faixa muda ("O povo de Pedra Alta anda inquieto"), para a Crônica não repetir todo dia. O Relatório conta chegadas, partidas e a faixa atual. — *Registro: No app (`d9ea930`): o Relatório conta colonos, partidas e deserções, diz de quanto a moral caiu e aponta o conselho da visão.*
- [x] V2C-T4.5 `ViewState`: `morale: { value, band, bandLabel, multiplierPercent, terms: Array<{ label, amount }>, nextUpdateInSeconds }`. O cabeçalho mostra "Moral 68 (Contente)"; o tooltip lista os termos; "muda na próxima virada do dia (em 23 min)" separa o fator que já mudou da moral que ainda não foi recalculada. — *Registro: Campos a mais: `text`, `breakdown`, `next`, `nextText`, `advice`, `foodReserve`, `notes`, `effects` e `recruitment.moraleNote`. **`terms` explica a conta da próxima virada (`next.value`)**, não a moral de agora. No app: cabeçalho, painel "Moral", linha na árvore e avisos.*
- [x] V2C-T4.6 Recuperação (IDEIA-06): cenário de teste "feudo empobrecido" (fome, frio, moral 0, 3 aldeões) tem de voltar a produzir com uma sequência de ações que o Relatório sugere; o piso impede o espiral. Se o cenário mostrar um estado sem saída, parar e levar ao autor: proteção nova é regra, não correção. — *Registro: O feudo empobrecido se refaz com dois na Fazenda e um na Serraria em um dia de jogo, em Senhor e em Rei de Ferro; nenhum estado sem saída foi achado.*
- [x] V2C-T4.7 Testes: cada termo isolado; limites 0/25/80/100; habitação cheia; fome e frio juntos; Camponês contra Senhor; 30 dias sem acesso com fome, deserção e piso; propriedade com sorteios no caminho (a primeira com evento real); golden. Navegador: moral e faixa no cabeçalho, tooltip com os termos. — *Registro: É a primeira propriedade com sorteio real no caminho. Navegador: "a moral e a faixa no cabeçalho" (02-feudo). A faixa Orgulhoso e o aviso de colono só têm teste de unidade.*

**Diversão:** a moral é o termômetro que liga as outras mecânicas: comida sobrando sobe, frio desce, e o colono grátis é a recompensa visível por cuidar bem. O teste é o autor ler "Inquieto" e saber, pelo tooltip, qual termo mudar.

**Verificação:**

```bash
pnpm --filter @lotg/engine test -- morale
pnpm --filter @lotg/engine test -- famine
pnpm --filter @lotg/engine test -- economy.property
pnpm test:e2e 02-feudo -g "moral"
```

**Pronto quando:** a aba Feudo mostra a moral, a faixa e a explicação termo a termo; a Crônica registra chegadas, partidas e mudanças de faixa; o cenário "feudo empobrecido" se recupera; a propriedade vale com sorteios reais.

**Prompt sugerido:** "Leia CLAUDE.md, GAME_DESIGN.md §5.6–5.7 e §12.1, docs/decisions/0013-…md, docs/roadmap-v0.2.md V2C-T4 e Apêndice B, e packages/engine/src/random.ts. Apresente o plano (termos desta versão, sorteios, deserção, piso, ViewState) e espere aprovação. Primeira subtarefa: os testes de cada termo e o cenário 'feudo empobrecido'."

### V2C-T6 · "Antes de partir" e o aviso de estação `M`

**Objetivo:** a aba Hoje diz, em até cinco linhas, o que preparar antes de sair, e a mudança de estação avisa o que vai mudar e o que fazer. É interface sobre números que já estão no `ViewState`; nenhuma regra nova.
**GDD:** §2.3 (passo 4: "lança processos para a próxima ausência"), §13.3, §13.5, §15.1 (itens 1, 2 e 6).
**Depende de:** V2C-T1, V2C-T2, V2C-T5, V2C-T4; decisão 21 (IDEIA-01 e IDEIA-02).
**Entregáveis:** **novo** `packages/web/src/game/beforeLeaving.ts` (função pura, testada sem DOM); `tabs/Today.tsx`, `components/Today.tsx`; `notifications/policy.ts`; `ui/format.ts`; `workbench/StatusBar.tsx` (prioridade: decisões > frio ou fome > cheio em < 8 h > obra).

- [x] V2C-T6.1 `beforeLeaving(view)` devolve até cinco itens `{ severity: 'danger' | 'warning' | 'info'; text; command?: { id, arg } }`, nesta ordem de prioridade: comida acaba antes de 24 h reais ("Comida acaba em 9h → Alocar na Fazenda"); inverno a menos de 24 h reais com madeira insuficiente para a lenha ("O inverno chega em 16h. 18 habitantes queimam 9 madeira/h; o estoque dura 7h → Estocar madeira"); recurso cheio em menos de 8 h ("Madeira cheia em 3h → Ampliar o Armazém"); fila de obra livre sem planejada automática ("Nenhuma obra começa sozinha → Planejar"); aldeões livres. Todos os números vêm do `ViewState` (`depletesInSeconds`, `nextSeason`, `winter.firewoodPerHour`, `fullInSeconds`, `planned[].autoStart`, `population.free`). — *Registro: Todo item tem comando e rótulo de botão (`command` é obrigatório). A lista também diz a fome e o frio em andamento, a planejada automática travada e a obra que termina em menos de 8 h sem nada depois; o depósito cuja obra termina antes de ele encher some. A lenha usa `firewood.missing`, não "o estoque dura".*
- [x] V2C-T6.2 A seção "Antes de partir" aparece na aba Hoje abaixo do Relatório (ou no topo, quando não há relatório), com um botão por item que chama `controller.runCommand`. Sem itens: "O feudo está preparado para a sua ausência."
- [x] V2C-T6.3 Aviso de estação: 1 h real antes da virada (do `secondsToNextSeason`), um aviso essencial "O inverno chega em 1h" com as frases de `calendar.nextSeason.changes`; na virada, o evento `seasonChanged` já existente vira aviso com o mesmo texto. Não prever sorteio nem prometer proteção. — *Registro: O texto é "Inverno à vista: chega em 59 min, às 21:40." (a visão não traz o artigo da estação; a hora é a do relógio do navegador). Um aviso por virada (`seasonWarned`, no cache da partida).*
- [x] V2C-T6.4 Barra de status e título da aba: o item de maior prioridade entre decisões pendentes, frio/fome, "cheio em < 8h" e obra. O modo discreto continua só com o contador. — *Registro: A prioridade "decisões pendentes" só tem teste de unidade com lista forjada: `pendingDecisions` é `never[]` até V2D-T1.*
- [x] V2C-T6.5 Testes: unidade de `beforeLeaving` com visões sintéticas (cada regra, ordem, limite de cinco, nenhum item); navegador: a seção aparece, o botão executa, o aviso de estação chega 1 h antes com o relógio adiantado, nos três temas e por teclado. `pnpm capture:landing` se a aba Feudo ou a barra mudarem. — *Registro: **`pnpm capture:landing` não foi rodado**, por instrução do orquestrador: a aba Feudo e a barra mudaram em toda a fase e mudam de novo nas Fases D e E; as capturas da página de apresentação ficam para o fechamento da versão (V2F-T4.2).*

**Diversão:** é a mecânica mais barata e mais importante da fase para quem joga uma vez por dia: sair tranquilo. O teste de diversão é o autor, em uma sessão de dois minutos, dizer se deixou o feudo preparado, só com a aba Hoje.

**Verificação:**

```bash
pnpm --filter @lotg/web test -- beforeLeaving
pnpm test:e2e 03-retorno-e-conexao -g "Antes de partir"
pnpm test:e2e 06-avisos-e-preferencias -g "estação"
```

**Pronto quando:** a aba Hoje mostra "Antes de partir" com itens acionáveis, o aviso de estação chega 1 h antes e na virada, e a barra de status respeita a prioridade nova.

**Prompt sugerido:** "Leia CLAUDE.md, GAME_DESIGN.md §2.3 e §13.5, docs/roadmap-v0.2.md V2C-T6 e packages/web/README.md. Apresente o plano (regras de beforeLeaving, lugar na aba Hoje, aviso de estação, prioridade da barra) e espere aprovação. Função pura com testes sem DOM antes dos componentes; nenhuma regra de jogo no app."

### V2C-T7 · Revisão independente e balanceamento da Fase C `S`

**Objetivo:** revisão de leitura da fase e uma rodada do simulador com caps, estações, moral, ofício e filas; o autor joga a sequência da §0.3 antes de o Conselho entrar.
**Depende de:** V2C-T1 a V2C-T6; V2B-T4.
**Entregáveis:** relatório da revisão; `docs/balance-v0.2.md` com a rodada; correções com regressão; `packages/sim-cli/src/bots/` com as políticas de C.

- [ ] V2C-T7.1 Revisor independente (Apêndice A.4) sobre o conjunto: caps, lenha, fome, frio, moral, experiência e filas automáticas no mesmo avanço; precedência de eventos; nenhum número fora de `content`.
- [ ] V2C-T7.2 Rodada do simulador: 50 sementes × perfis 1/2/4 visitas × ritmos × dificuldades. Medir desperdício efetivo (quantidade e horas contínuas), fila ociosa, horas de frio e fome, deserções, população mínima e progressão (hora do Salão 2/3/4, do Celeiro, do Armazém). A faixa de desperdício aprovada na decisão 17 vale aqui: o perfil Regular não passa de 8 h de jogo contínuas desperdiçando um recurso.
- [ ] V2C-T7.3 Caminho de compras legal até os desbloqueios da fase em cada dificuldade; qualquer nível anunciado e inalcançável vai ao autor.
- [ ] V2C-T7.4 Desempenho: `advanceTo` de 1, 7 e 30 dias reais no ritmo 3 (36 viradas de dia por dia real, cada uma com moral, experiência e desperdício), tamanho do `ViewState` e do estado; registrar máquina, commit e números em `docs/balance-v0.2.md`, comparando com `docs/perf-v0.1.md`.
- [ ] V2C-T7.5 O autor joga (ritmo 3 em `deploy/.env`): planeja uma obra automática, confere "Antes de partir", sai, atravessa uma estação com o relógio do servidor de teste (`tests/e2e/server.ts` ou `pnpm dev:api` com um dia real) e volta. Registrar o que ele entendeu e o que não. Corrigir antes de abrir a Fase D; mesclar `v2c-economia` só com a aprovação dele.

**Pronto quando:** defeitos confirmados corrigidos com teste; o bot Regular satisfaz a faixa de desperdício; há caminho alcançável em cada dificuldade; o autor jogou e aprovou a fase.

**Prompt sugerido:** "Leia CLAUDE.md e docs/roadmap-v0.2.md V2C-T7. Lance o revisor independente (Apêndice A.4) sobre o branch v2c-economia, rode a matriz do simulador, registre em docs/balance-v0.2.md e me prepare o roteiro de 15 minutos para eu jogar a fase."

---

## 4. Fase D — O Conselho do Feudo

**Meta da fase:** cartas com opções, custos, prazo, expiração, cadeias e interface, na cadência aprovada; o Relatório de Retorno reorganizado para contar a história. Critérios 2 e 3 da §16.2. Branch `v2d-conselho`.

O Conselho é o motor de narrativa da v0.2 (GDD §7). O que o jogador deve conseguir ao fim da fase: ler uma carta, entender o custo e a consequência conhecida de cada opção, escolher (ou deixar expirar sabendo o que acontece), e reconhecer a escolha quando ela volta na carta seguinte e na Crônica.

### V2D-T0 · Sessão de decisões, lote 2 → ADR 0014 `S`

**Objetivo:** fechar com o autor as decisões do Conselho e da ameaça antes do código, e registrá-las.
**Depende de:** V2C-T7.
**Decisões:** 1 (prazos do Conselho), 7, 8, 9, 10, 11, 12, 18 (Conselho), 20, 21.
**Entregáveis:** **novo** `docs/decisions/0014-conselho-e-ameaca-na-v0.2.md`; GDD §7.1, §8.2, §12.2 corrigidos; §8 deste roadmap atualizada.

- [ ] V2D-T0.1 Apresentar cada decisão com a premissa da §8 como padrão; para a 7 e a 8, mostrar o lote da §12 e perguntar quem escreve (premissa: o agente escreve, o autor aprova carta a carta). — *Registro: A sessão não aconteceu: o autor pediu a versão sem ela.*
- [x] V2D-T0.2 Escrever o ADR, corrigir o GDD (instante dos lobos, perdas exatas, o que a Paliçada Nv2 faz, objetivos da v0.2) e atualizar a §8. — *Registro: Feito em 2026-10-01, junto com V2B-T0 (commits `242296b` e `9b1d3e8`). O ADR 0014 está "aplicado por delegação" e aguarda a confirmação do autor.*

**Pronto quando:** nenhuma tarefa de D ou E tem decisão aberta.

**Prompt sugerido:** "Leia CLAUDE.md, docs/roadmap-v0.2.md §8, §12 e §0.6, e GAME_DESIGN.md §7, §8.2 e §12.2. Vamos fechar o lote 2: uma decisão por vez, com a sua recomendação como padrão; registre em docs/decisions/0014-…md e corrija o GDD."

### V2D-T1 · Motor do Conselho `L`

**Objetivo:** sorteio ponderado entre as cartas elegíveis, no máximo 2 pendentes, expiração com a opção padrão da dificuldade, efeitos (recursos, moral com duração, flags, continuação agendada, efeitos ocultos) e o comando de responder.
**GDD:** §7.1, §7.2, §12.1 (opção padrão por dificuldade), §14.11 (`council`), §17.1.
**Depende de:** V2D-T0; V2B-T2; V2C-T4.
**Fica de fora:** `heroTrait`, `addHero`, `addUnits`, `reveal` de mapa, requisitos de Mercado ou Ferreiro.
**Entregáveis:** **novo** `packages/content/src/council.ts` (tipos e schema `CouncilCardSchema`, `balance.council`), **novo** `packages/content/src/cards/` (duas cartas de teste nesta tarefa; o catálogo vem em V2D-T2), `chronicle.ts` (`cardDrawn`, `cardAnswered`, `cardExpired`, `cardEffectApplied`); **novo** `packages/engine/src/council.ts`, `types.ts`, `timeline.ts`, `advance.ts`, `commands.ts` (**novo** `answerCard`), `morale.ts` (termo de efeitos temporários), `view.ts`; `packages/protocol/src/commands.ts`, `view.ts` (`pendingDecisions` deixa de ser `never[]`; **`protocol: 2`** e `426` para cliente anterior), `index.ts`; `packages/server/src/plugins/auth.ts` ou rota (versão mínima do cliente); `packages/client-sdk`; teste de integração.

- [x] V2D-T1.1 Conteúdo: `CouncilCard` com `id`, `title`, `text` (2–4 frases), `weight`, `recurring?`, `requires?: { seasons?, minDay?, buildings?, flags?, notFlags?, moralRange? }`, `scripted?: { atGameDay }`, `options[]` com `id`, `label`, `requires?: { building?, resources? }`, `cost?`, `effects: Effect[]`, `hiddenEffects?: Effect[]`, `hint` (a pista do que pode acontecer), e **`autoResolve: { peasant: optionId; lord: optionId; ironKing: optionId }`** (premissa 9: a opção automática é marcada editorialmente por dificuldade; as três têm de existir e ser executáveis sem custo). `Effect` da v0.2: `resources` (com cap), `morale { amount, durationDays }`, `setFlag`, `clearFlag`, `scheduleCard { cardId, afterDays }`. `balance.council: { drawIntervalDays: 4; maxPending: 2; expiryRealMs: 24 h }`. Teste de conteúdo: ids únicos, toda flag exigida tem quem a grave, toda `scheduleCard` aponta para carta existente, as três opções automáticas existem e não têm custo, nenhum requisito de versão futura. — *Registro: Tipos em `council.ts`, cartas em `cards/`, `balance.council` em `balance.ts` e os schemas (`CouncilCardSchema`, `CouncilCatalogSchema`) em `schemas.ts`, com os outros. `hiddenEffects` virou `hidden: { afterDays, effects, chronicle }`; a opção ganhou `chronicle` e `expiredChronicle`; a carta, `variants` e `arrival`. As cartas de teste ficam em `test-helpers.ts`; o conteúdo já nasceu com cinco cartas de verdade.*
- [x] V2D-T1.2 Estado: `council: { pending: Array<{ instanceId; cardId; drawnAtMs; expiresAtMs }>; flags: Record<string, true>; seenThisYear: string[]; nextDrawAtMs; scheduled: Array<{ cardId; atMs }>; effects: Array<{ id; kind: 'morale'; amount; untilMs }> }`. `instanceId` distingue a ocorrência (cartas recorrentes, anos diferentes) do modelo. Migração: `nextDrawAtMs = migratedAtMs + intervalo`. — *Registro: Estado na versão 8. Além do previsto: `pending[].origin`, `scheduled[].previousInstanceId`, `delayed` (efeitos escondidos à espera) e `expired` (ocorrências expiradas no ano). Os efeitos de moral ficam em `settlement.moraleEffects`. Na migração, a primeira audiência é a primeira virada de dia a partir de fronteira + intervalo.*
- [x] V2D-T1.3 Sorteio (fluxo `council`): em `nextDrawAtMs`, se houver menos de 2 pendentes, uma carta roteirizada vencida tem prioridade; senão `pickWeighted` entre as elegíveis (estação, dia mínimo, edifícios, flags, faixa de moral, não vista neste ano salvo recorrente); nenhuma elegível → nada, sem busy loop. `nextDrawAtMs += intervalo` sempre (cadência ancorada, premissa 18): com 2 pendentes, o sorteio é pulado e o próximo acontece no instante seguinte da cadência. `expiresAtMs = agora + expiryRealMs × timeScale` (prazo real convertido na hora, §0.7). Evento `cardDrawn`. — *Registro: O sorteio acontece na virada do dia, depois da moral (`councilTurn.ts`). A continuação com o prazo vencido reserva o lugar dela. Carta roteirizada implementada e sem uso: nenhuma carta do lote é roteirizada.*
- [x] V2D-T1.4 Expiração: evento da linha do tempo em `expiresAtMs`; aplica `autoResolve[dificuldade]` e emite `cardExpired` com a frase do que foi feito. Desempate no instante exato: a expiração roda **antes** de um comando no mesmo instante (o comando chega com o estado avançado, e encontra a carta já resolvida: `CARD_EXPIRED`). — *Registro: No mesmo instante o sorteio vem **antes** da expiração: no ritmo Normal, a carta sem resposta expira em cima de uma audiência, que é pulada (dúvida aberta). `CARD_EXPIRED` só vale para o que expirou no ano de jogo corrente; depois da virada do ano a recusa é `CARD_NOT_PENDING`.*
- [x] V2D-T1.5 Comando `answerCard { instanceId, optionId }`: recusas `CARD_NOT_PENDING`, `CARD_EXPIRED`, `INVALID_OPTION`, `OPTION_LOCKED` (requisito, com o nome do edifício), `INSUFFICIENT_RESOURCES` (reusa, com o que falta). Aplica custo e efeitos uma vez; agenda continuações; emite `cardAnswered` e, para efeitos ocultos, `cardEffectApplied` **no instante em que o efeito acontece** (é aí que o jogador descobre). Reenvio do mesmo `commandId` devolve o recibo; um `commandId` novo na mesma carta resolvida recebe `CARD_NOT_PENDING` sem perder o avanço. — *Registro: O efeito escondido acontece N viradas de dia depois da escolha (no mínimo uma), nunca na hora.*
- [x] V2D-T1.6 Efeitos temporários de moral entram como termo da fórmula de V2C-T4 (`+5 (carta: Tábuas para as reservas, por 1 dia)`), expiram no instante marcado; flags persistem entre anos; `seenThisYear` zera na virada do ano (premissa 20).
- [x] V2D-T1.7 `ViewState`: `council: { pending: Array<{ instanceId; title; text; expiresInSeconds; defaultOptionId; defaultOptionLabel; options: Array<{ id; label; cost: ResourceCostView[]; affordable; locked; lockedReason; effectsText: string; hint: string }> }>; nextCardInSeconds: number | null; blockedByPending: boolean }` e `pendingDecisions: Array<{ kind: 'card'; id; title; expiresInSeconds }>`. Efeitos ocultos **não** saem; flags não saem. — *Registro: Campos além do previsto: `nextAudienceInSeconds`, `note`, `rulesText`, e em cada carta `expiryNote` e `followsFrom`. `effectsText` avisa quando o ganho não cabe no depósito.*
- [x] V2D-T1.8 Protocolo e servidor: `protocol: 2`; o servidor compara `X-Lords-Client` com a versão mínima e responde `426 UPGRADE_REQUIRED` ("Há uma versão nova do jogo. Recarregue a página."); o app já trata `UPGRADE_REQUIRED` (conferir em `packages/web/src/app/controller.ts`) e descarta o cache da versão antiga. — *Registro: O 426 continua decidido por `X-Lords-Protocol`, o mecanismo que já existia, e não pela comparação de `X-Lords-Client` com uma versão mínima.*
- [x] V2D-T1.9 Testes: cenário roteirizado com duas cartas de teste (sorteio no instante previsto; segunda pendente; terceira não sorteada; expiração com a opção da dificuldade, nas três); propriedade de divisão de intervalo com sorteio, expiração e efeito adiado no caminho; mesma semente, mesmas cartas; conjunto elegível vazio por 30 dias; virada de ano; integração: responder, reenviar, responder de novo, responder depois de expirar, dois clientes. — *Registro: `council.test.ts`, `council.property.test.ts` e `packages/server/test/council.test.ts`.*

**Diversão:** nada ainda para o jogador: é a máquina. O que a tarefa precisa garantir para a diversão vir depois: nenhuma carta expira sem o jogador ter tido 24 h reais, e a opção automática nunca custa nada que ele não tenha.

**Verificação:**

```bash
pnpm --filter @lotg/content test
pnpm --filter @lotg/engine test -- council
pnpm --filter @lotg/engine test -- economy.property
TEST_DATABASE_URL=postgres://lotg:lotg@localhost:5433/lotg_test pnpm test:integration council
```

**Pronto quando:** o cenário roteirizado passa nas três dificuldades, a propriedade vale com sorteio e expiração, a integração prova idempotência da resposta, e o protocolo 2 recusa o cliente 1 com 426.

**Prompt sugerido:** "Leia CLAUDE.md, GAME_DESIGN.md §7 e §12.1, docs/decisions/0014-…md, docs/roadmap-v0.2.md V2D-T1 e Apêndice B, packages/engine/README.md e packages/server/README.md. Apresente o plano por subtarefa (conteúdo e schema; estado e migração; sorteio e expiração; comando; ViewState; protocolo 2) e espere aprovação. É tarefa L: uma subtarefa por bloco, em branch, testes primeiro."

### V2D-T2 · Cartas e cadeias da v0.2 `L`

**Objetivo:** o primeiro lote de cartas em `@lotg/content`, escrito pelo agente e aprovado pelo autor carta a carta, com ao menos uma cadeia de 3 cartas completa (critério 3).
**GDD:** §7.1 (meta de 60 cartas, 5 cadeias, 6 roteirizadas no primeiro ano), Apêndice B, §18.3 (tom de crônica, frases curtas).
**Depende de:** V2D-T1; decisões 7 e 8.
**Entregáveis:** `packages/content/src/cards/*.ts` (uma cadeia por arquivo, cartas avulsas em `standalone.ts`), **novo** `docs/content-v0.2.md` (inventário com a ficha da §12.3 e o estado da curadoria), testes de conteúdo, goldens do motor, bot com a política "responder a carta".

- [x] V2D-T2.1 Lote 1 (premissa 7): **3 cadeias de 3 cartas** ("O Celeiro Comum", "A Ponte do Degelo", "A Promessa da Paliçada", §12.2) e **12 cartas avulsas** (temas da §12.2), 21 modelos, usando só recursos, edifícios, moral, flags e continuações. A "Estrangeira ferida" fica para a v0.3 (premissa 8). O GDD continua com a meta de 60; a §12 registra o que falta e V2F-T5 planeja o lote 2. — *Registro: 21 modelos: três cadeias e 12 avulsas (4 recorrentes, 8 de uma vez por ano). "A Promessa da Paliçada" entrou em `content` em V2E-T2, quando a Paliçada passou a existir.*
- [ ] V2D-T2.2 Para cada carta: a ficha da §12.3 preenchida (texto de 2–4 frases, elegibilidade, opções com verbo no infinitivo, custos, efeitos, duração em dias de jogo, pista do efeito oculto, `autoResolve` por dificuldade, frases de Crônica para escolha, expiração e efeito posterior). Escrever primeiro em `docs/content-v0.2.md`, apresentar ao autor em lotes de 5, e só então transcrever para `content`. — *Registro: As 21 fichas estão em `docs/content-v0.2.md` e no jogo. **Nenhuma foi apresentada ao autor**: a aprovação em lotes de cinco não aconteceu.*
- [x] V2D-T2.3 Para cada opção, um cenário em que ela é a escolha razoável e um em que é ruim (comida escassa, ouro sobrando, cap próximo, inverno à porta). Rótulo de opção automática não quer dizer ótima. Nenhuma opção "sem custo" pode dominar: quando dominar, a carta volta para reescrita. — *Registro: Um cenário bom e um ruim por opção, em cada ficha; o juízo é do agente. Regra editorial decidida pelo agente: em Camponês e Senhor a opção automática de uma carta do sorteio nunca tira recurso nem moral.*
- [x] V2D-T2.4 Cadeias: percorrer cada ramificação (aceitar, recusar, expirar), a continuação chega no prazo mesmo com 2 cartas pendentes na frente (premissa 18: continuação agendada tem prioridade sobre o sorteio), e efeitos que atravessam estação e ano. "Sua escolha voltou": o texto da continuação lembra a escolha anterior (IDEIA-03/07), por variante de texto escolhida pela flag. — *Registro: `council.chains.test.ts` percorre "O Celeiro Comum" e "A Ponte do Degelo" em todas as ramificações; a da Paliçada está nos testes de V2E-T2.*
- [x] V2D-T2.5 Cobertura: em 50 sementes, por estação e nível do Salão, quantas cartas são elegíveis e quantas o bot vê; intervalos sem conteúdo elegível vão ao inventário. Variante de texto não conta como carta nova. — *Registro: `docs/content-v0.2.md`, seção 4; `council.coverage.test.ts` (elegibilidade por estação e Salão, com estados montados) e `coverage.ts` no simulador (o que o bot vê em 50 sementes).*
- [x] V2D-T2.6 Testes de conteúdo (`content.test.ts`): schema; flags consistentes; continuações alcançáveis; toda carta com as três opções automáticas sem custo; nenhuma referência a herói, Mercado, ferro, exército ou combate; cenário no motor que percorre "O Celeiro Comum" de ponta a ponta nas duas ramificações; golden com a cadeia. — *Registro: `packages/content/src/council.test.ts` e o golden de 7 dias, que passa pelas cadeias.*
- [ ] V2D-T2.7 Congelar a versão do conteúdo para o playtest (o `contentHash` de `/version` identifica) e registrar as decisões editoriais no inventário. — *Registro: As decisões editoriais estão no inventário, mas **nada foi congelado**: o conteúdo mudou em V2E-T2, T3 e T4 (hoje `10164e0ffb6b06e8`; o inventário cita `2f8434b06481af37`, o das cartas). O hash do playtest é o que `/version` responder no dia.*

**Diversão:** aqui mora a história. O teste é o do GDD §7.1: "toda opção é a melhor em algum contexto". O autor lê cada carta e diz qual opção escolheria em dois cenários diferentes; se a resposta for sempre a mesma, a carta não está pronta.

**Verificação:**

```bash
pnpm --filter @lotg/content test
pnpm --filter @lotg/engine test -- council
pnpm --filter @lotg/engine test -- scenario
pnpm -s sim -- --seed pedra-alta-001 --days 7 --time-scale 3 2>&1 >/dev/null | grep -i carta
```

**Pronto quando:** critério 3 da §16.2 provado por cenário de ponta a ponta, as 21 cartas aprovadas pelo autor no inventário, e a cobertura por estação registrada.

**Prompt sugerido:** "Leia CLAUDE.md, GAME_DESIGN.md §7, Apêndice B e §18.3, docs/decisions/0014-…md, docs/roadmap-v0.2.md V2D-T2 e §12. Escreva as três cadeias em docs/content-v0.2.md com a ficha da §12.3, cinco cartas por vez, e espere a minha aprovação de cada lote antes de transcrever para packages/content. Tom de crônica medieval, frases curtas, português do Brasil."

### V2D-T3 · O Conselho na interface `M`

**Objetivo:** ver as cartas pendentes, ler custos e consequências, responder pelo painel, pela árvore e pela paleta, saber quando a carta expira e o que acontece se expirar; aviso de carta nova.
**GDD:** §2.3, §13.2, §13.3 ("Decisões pendentes"), §13.5, §13.6 (`Lords: Decidir carta do Conselho`), §7.1.
**Depende de:** V2D-T1 (pode começar com as cartas de teste, antes de V2D-T2).
**Entregáveis:** **nova** aba `packages/web/src/tabs/Council.tsx` e componente `components/CouncilCard.tsx`; **novo** `tests/e2e/07-conselho.spec.ts`; `app/controller.ts`, `app/router.ts` (`#/conselho`), `palette/commands.ts` (`lords.answerCard`), `ui/treeModel.ts` (item "Conselho · 1 carta pendente (expira em 14h)"), `workbench/StatusBar.tsx` (decisões pendentes no topo da prioridade), `notifications/policy.ts` (carta nova é essencial), `components/Today.tsx` ("Decisões pendentes").

- [ ] V2D-T3.1 Primeira carta funcional ao autor antes da tela completa: título, texto, opções com custo, consequência conhecida e pista, prazo real e "se não responder: <opção automática>". — *Registro: A carta foi feita e a tela completada na mesma sessão; três capturas foram enviadas ao autor, que **não a viu antes**.*
- [x] V2D-T3.2 Um caminho de comando só: painel, árvore e paleta chamam `controller.runCommand('lords.answerCard', { instanceId, optionId })`, que usa `controller.prepare` para fixar o `commandId`; "Tentar de novo" reenvia o mesmo; o botão fica desabilitado durante o envio. — *Registro: `controller.answerCard` e `controller.answering`.*
- [x] V2D-T3.3 Opção bloqueada mostra o requisito ("requer Celeiro"); custo impagável mostra o que falta; recusa do servidor aparece com a frase (`GAME_RULE`) e a carta some se já expirou ou foi respondida em outra aba (a visão de `details` substitui a tela).
- [x] V2D-T3.4 Estados: sem cartas ("O Conselho não tem nada a tratar. Próxima reunião em 2h10"), uma, duas (e "o Conselho espera a sua resposta antes de trazer outra"), sem conexão (modo leitura), sessão encerrada, expiração com o diálogo aberto (a tela avisa e fecha sem enviar). — *Registro: As frases de mesa cheia e de conselho sem assunto são `council.note`, do servidor.*
- [x] V2D-T3.5 Aviso "Nova carta do Conselho: <título>" com `[Decidir]`, respeitando a política; badge no ícone do Feudo; título da aba `(1) Pedra Alta`; modo discreto só com o contador. — *Registro: A carta nova não entra no contador de novidades: quem a conta é o de decisões pendentes.*
- [x] V2D-T3.6 Testes: unidade sem DOM dos componentes com uma visão de exemplo; navegador: responder pelo painel, pela paleta e só com o teclado nos três temas; expiração com o relógio adiantado mostra a opção automática na Crônica (critério 2); duas abas, uma responde, a outra vê a carta sumir. — *Registro: `tests/e2e/07-conselho.spec.ts`, 12 cenários. Os outros arquivos rodam com o conselho em recesso (`/__test/council-recess`).*

**Diversão:** ler uma carta tem de dar vontade de responder: texto curto, opções com verbo, custo visível, e nunca a sensação de "escolhi errado por não ter visto o preço". O teste é o autor responder a primeira carta sem perguntar nada.

**Verificação:**

```bash
pnpm --filter @lotg/web test
pnpm test:e2e 07-conselho
```

**Pronto quando:** critério 2 da §16.2 provado em navegador com o relógio controlado, e todas as superfícies (painel, árvore, paleta, aviso, barra, Hoje) mostram a carta pendente.

**Prompt sugerido:** "Leia CLAUDE.md, GAME_DESIGN.md §13.2–13.6, docs/roadmap-v0.2.md V2D-T3 e packages/web/README.md. Apresente o plano (aba Conselho, caminho único de comando, estados, avisos, testes) e espere aprovação. Me mostre a primeira carta funcional antes de completar a tela."

### V2D-T4 · Retorno em três blocos e "Sua escolha voltou" `M`

**Objetivo:** o Relatório de Retorno conta a ausência em três blocos ("O feudo prosperou", "O que exigiu um preço", "Você ainda pode decidir"), e a Crônica liga a continuação de uma carta à escolha anterior.
**GDD:** §2.3 (passo 1), §13.5 (Relatório de Retorno), §11.4 (a Crônica como recompensa emocional, antecipada só na forma de ler), §15.1 (item 5: voltar é recompensado).
**Depende de:** V2D-T3; V2C-T2 (desperdício), V2C-T4 (moral); decisão 21 (IDEIA-03 e IDEIA-05).
**Entregáveis:** `packages/protocol/src/report.ts` (`ReturnReport` com os três blocos), `packages/web/src/game/returnReport.ts`, `components/Today.tsx`, `tabs/Chronicle.tsx`, `tabs/markdown.ts`; `packages/content/src/chronicle.ts` (frases de continuação com `{carta}` e `{opcao}`); `packages/server/src/games/events.ts` (se o evento de continuação precisar de `data.previousCardId`).

- [x] V2D-T4.1 `buildReturnReport` separa os eventos da ausência em três blocos, por tipo: prosperou (obras concluídas, colonos, mestria, cartas respondidas pelo jogador antes de sair com efeito aplicado, objetivos); custou (desperdício, fome, frio, deserções, partidas, expirações com o que a opção automática fez, lobos em V2E-T3); ainda pode decidir (cartas pendentes com prazo, planejadas esperando por motivo, aldeões livres). A variação de estoque fica como tabela abaixo, com produção, gasto e perda separados a partir dos eventos. Nenhuma regra; só agrupamento do que o servidor mandou. — *Registro: `ReturnReport.blocks`, opcional; o item tem `topic`, `severity` e `action.label` além do previsto.*
- [x] V2D-T4.2 Cada item do bloco "custou" tem a próxima ação ("Celeiro cheio: 120 comida desperdiçadas → Ampliar o Celeiro"), reaproveitando `beforeLeaving`. — *Registro: `costAction`.*
- [x] V2D-T4.3 "Sua escolha voltou": o evento `cardDrawn` de uma continuação leva `data.previousCardId` e `data.previousOptionId`; a frase da Crônica lembra ("Lembrando as tábuas cedidas ao celeiro, o conselho volta ao assunto…"); na aba Crônica, a linha da continuação liga à da escolha anterior (âncora, sem reler dezenas de entradas). O Markdown exportado mantém a ligação em texto. — *Registro: A nota "Sua escolha voltou" é escrita pelo servidor no Markdown (`games/chronicleMarkdown.ts`); o app a lê e leva o foco à linha citada. As frases das continuações vêm das variantes de cada carta.*
- [x] V2D-T4.4 Eventos paginados sem omitir desfechos: o relatório usa o cursor existente (`GET /events?after=`) e não duplica na reconexão; uma aba deixada aberta durante a ausência mostra os blocos ao reabrir a aba Hoje (sem prometer relatório automático; limite registrado em V2E-T3.6). — *Registro: A aba aberta e fora de vista por 4 h recebe um aviso que leva à aba Hoje; a que ficou à vista não recebe relatório.*
- [x] V2D-T4.5 Testes: unidade de `buildReturnReport` com eventos sintéticos (cada tipo cai no bloco certo; ordem; ação sugerida); navegador: saltar 6 h com uma carta respondida, outra expirada, um desperdício e uma planejada iniciada, e conferir os três blocos e a âncora na Crônica. — *Registro: `returnReport.test.ts` e o cenário "três blocos" de `03-retorno-e-conexao.spec.ts`, com a carta posta na mesa por `/__test/council-deal`.*

**Diversão:** é o momento em que o jogo "fala" com o jogador que voltou. O teste é o do IDEIA-05: a pessoa entende o saldo e encontra uma ação em uma leitura do resumo.

**Verificação:**

```bash
pnpm --filter @lotg/web test -- returnReport
pnpm test:e2e 03-retorno-e-conexao -g "três blocos"
```

**Pronto quando:** o Relatório de Retorno tem os três blocos com ações, e uma continuação de carta aponta para a escolha anterior na Crônica e no Markdown.

**Prompt sugerido:** "Leia CLAUDE.md, GAME_DESIGN.md §2.3 e §13.5, docs/roadmap-v0.2.md V2D-T4 e packages/web/src/game/returnReport.ts. Apresente o plano (três blocos, ações, ligação de cartas na Crônica) e espere aprovação. Função pura com testes antes dos componentes."

### V2D-T5 · Revisão independente da Fase D `S`

**Objetivo:** conferir consistência, clareza e variedade do Conselho completo, incluindo o caminho automático de quem ficou ausente; o autor joga uma cadeia inteira.
**Depende de:** V2D-T1 a V2D-T4.
**Entregáveis:** relatório da revisão; correções com regressão; rodada do simulador com cartas.

- [ ] V2D-T5.1 Revisor independente tenta: responder depois de expirar; cobrar duas vezes (duplo clique, duas abas, reenvio); inferir efeitos ocultos pela resposta HTTP ou pelo `ViewState`; forçar duas cartas pendentes e uma continuação agendada atrás delas; virar o ano com carta pendente.
- [ ] V2D-T5.2 Revisão editorial carta a carta: elegibilidade, opção dominante, custo impagável, consequência sem pista, texto fora do tom.
- [ ] V2D-T5.3 Simulador: perfis de 1 e 2 visitas por dia, em cada ritmo: cartas vistas, respondidas, expiradas, bloqueadas por 2 pendentes, cadeias iniciadas e concluídas. Expiração frequente em 1 visita/dia aponta janela ruim (vai ao autor; não forçar visitas).
- [ ] V2D-T5.4 O autor joga "O Celeiro Comum" de ponta a ponta no ritmo 3 e diz, a cada carta, o que esperava; discrepância entre expectativa e resultado é defeito de texto, corrigido sem mudar a regra em silêncio. Mesclar `v2d-conselho` só com a aprovação dele.

**Pronto quando:** defeitos confirmados corrigidos com teste; nenhuma opção dominante, conferido carta a carta; o autor jogou e aprovou.

**Prompt sugerido:** "Leia CLAUDE.md e docs/roadmap-v0.2.md V2D-T5. Lance o revisor independente (Apêndice A.4) sobre o branch v2d-conselho com os cenários de V2D-T5.1, faça a revisão editorial das 21 cartas, rode o simulador e me prepare o roteiro para eu jogar 'O Celeiro Comum'."

---

## 5. Fase E — Ameaça: Torre, Paliçada e lobos

**Meta da fase:** o jogador vê a Ameaça (se tiver a Torre), pode se preparar, e a primeira incursão acontece com ele fora. Critério 4 da §16.2. Branch `v2e-ameaca`.

O que o jogador deve conseguir ao fim da fase: comparar dois feudos na mesma incursão, um com Torre e Paliçada e outro sem, e explicar a diferença com o que o Relatório diz.

### V2E-T1 · Torre de Vigia, tiles abstratos e Ameaça `M`

**Objetivo:** a Torre como edifício; o Covil de Lobos como tile abstrato em lista; a Ameaça de 0 a 100 subindo a cada dia de jogo, visível só com a Torre.
**GDD:** §6.1, §6.2, §8.1 (só a frase sobre tiles abstratos), §8.2, §14.11 (`map`).
**Depende de:** V2D-T5; decisão 11.
**Fica de fora:** mapa hexagonal e névoa gráfica (v0.5), presságios e o disparo da Torre no Nv3 (v0.4), limpar um tile (precisa de expedição ou exército, v0.3/v0.4).
**Entregáveis:** `packages/content/src/buildings.ts` (`watchtower` passa a construível, `maxLevel: 2` nesta versão, `requires: { townHall: 2 }`), `balance.ts` (**novo** `threat`), **novo** `tiles.ts` (`wolfDen`), `chronicle.ts` (`threatRose` só ao cruzar 40 e 70; `raidAnnounced`); **novo** `packages/engine/src/threat.ts`, `types.ts`, `timeline.ts`, `advance.ts`, `view.ts`; **novo** `packages/web/src/components/ThreatPanel.tsx`, `ui/treeModel.ts`; **novo** `tests/e2e/08-ameaca.spec.ts`.

- [x] V2E-T1.1 Conteúdo (premissa 11): `threat: { perActiveTilePerDay: 5; autumnPerDay: 3; raidChanceAbove: 40; mediumRaidAbove: 60; repelDrop: 10; raidLeadMs: 6 h de jogo; warningPerTowerLevelMs: 1 h de jogo }`; `tiles.wolfDen: { label: 'Covil de Lobos', threat: true, active desde o dia 1 }`; Torre: `watchtower.levels: { 1: { reveals: 'threatLevel', warningMs: 1 h }, 2: { warningMs: 2 h, reveals: 'raidSize' } }`. — *Registro: Nomes ajustados: `seasonPerDay: { autumn: 3 }`, `raidDrop`, `watchtowerLevels: [{ warningMs, revealsRaidSize }]`, `chronicleMarks`, `max`; `warningPerTowerLevelMs` não entrou. Torre: Salão Nv2, 120 madeira, 120 pedra, 50 ouro.*
- [x] V2E-T1.2 Estado: `map: { tiles: Record<string, { type; threatActive: boolean }>; threat: number }` e `horde: { scheduledRaids: Array<{ id; atMs; kind: 'scripted' | 'threat'; enemy: 'wolves'; size: 'light' | 'medium'; announcedAtMs }> }`. Migração: covil ativo, Ameaça 0, nenhuma incursão agendada. — *Registro: Estado na versão 9. `announcedAtMs` é `number | null`.*
- [x] V2E-T1.3 Ameaça: na virada do dia, +5 por tile ativo, +3 no outono, limitada a 100; o sorteio e a redução entram em V2E-T3. `threatRose` só ao cruzar as marcas de 40 e 70 ("Os vigias contam mais uivos a cada noite"), para a Crônica não repetir. — *Registro: O +3 conta os dias de outono que passam. `threatRose` só é emitido para quem tem a Torre naquela virada.*
- [x] V2E-T1.4 Névoa de informação: sem Torre, `ViewState.threat = { known: false, text: 'Sem uma Torre de Vigia, ninguém sabe o que ronda o feudo' }`; com Torre Nv1, `known: true`, o número, a tendência e a explicação ("+5/dia: Covil de Lobos; +3/dia: outono"); com Nv2, também o tamanho da incursão anunciada. O que não é revelado **não sai do servidor**. — *Registro: `ViewState.threat` é uma união fechada por `known`: o schema recusa o que a névoa esconde. Sem Torre, nem os tiles saem.*
- [x] V2E-T1.5 Painel "Ameaça" na aba Feudo e item na árvore ("Ameaça 42 · Covil de Lobos"), com o motivo e a ação (construir ou melhorar a Torre, a Paliçada). Bot: política "Torre quando o Salão chega a 2 e há folga". — *Registro: O painel fica depois de Construções, abaixo da dobra em 1280×800; a Ameaça não entrou no cabeçalho.*
- [x] V2E-T1.6 Testes: subida diária e nas estações; limite 100; Torre concluída antes, durante e depois de uma janela de aviso (o aviso aparece ao concluir, se ainda houver tempo); virada de ano; propriedade; navegador: o painel muda ao construir a Torre. — *Registro: A Torre concluída antes, durante e depois da janela de aviso foi testada em V2E-T3 (`threat.raids.test.ts`), quando as incursões passaram a existir.*

**Diversão:** a Torre compra informação, a mercadoria mais valiosa de um jogo assíncrono: "lobos em 1 h" dá tempo de voltar. O teste é o autor, sem Torre, sentir que não sabe; e com ela, saber o que fazer.

**Verificação:**

```bash
pnpm --filter @lotg/content test
pnpm --filter @lotg/engine test -- threat
pnpm test:e2e 08-ameaca -g "Torre"
```

**Pronto quando:** a aba Feudo mostra a Ameaça com a explicação só com a Torre, e a Torre muda o que o jogador vê.

**Prompt sugerido:** "Leia CLAUDE.md, GAME_DESIGN.md §6.1, §8.1–8.2, docs/decisions/0014-…md, docs/roadmap-v0.2.md V2E-T1 e Apêndice B. Apresente o plano (conteúdo, estado, subida da Ameaça, névoa de informação, painel) e espere aprovação. Testes primeiro; nada de mapa gráfico, exército ou presságios."

### V2E-T2 · Paliçada (níveis 1 e 2) `S`

**Objetivo:** a Paliçada como edifício, com Salão Nv3 como pré-requisito, até o nível 2, com efeito distinto por nível na incursão.
**GDD:** §6.1, §6.2, §8.2.
**Depende de:** V2E-T1; decisão 11.
**Fica de fora:** HP de muralha por ala, dano e reparo (v0.4).
**Entregáveis:** `packages/content/src/ids.ts` e `buildings.ts` (`palisade`, `requires: { townHall: 3 }`, `maxLevel: 2`, 200 madeira e 50 pedra, 20 min; `levels: { 1: { absorbs: 'light' }, 2: { absorbs: 'medium' } }`); `packages/engine/src/construction.ts`, `view.ts`; painel e testes de construção.

- [x] V2E-T2.1 Construção do zero (0 → 1), gate do Salão 3, custos, cap, planejamento e início automático, limite no nível 2 nesta versão (o Nv3 é Muralha de Pedra, v0.4: `MAX_LEVEL` com a frase "A Muralha de Pedra chega em uma versão futura"). — *Registro: Estado na versão 10.*
- [x] V2E-T2.2 Efeito (premissa 11): Nv1 absorve incursões leves (sem perdas, sem ferido); Nv2 absorve também as médias; uma incursão média contra Nv1 perde metade. O `ViewState.threat.defense` explica ("Paliçada Nv1: segura ataques leves; os médios ainda custam metade"). — *Registro: Os níveis ficam em `balance.threat.palisadeLevels` e `palisadeBreach`; a regra é `palisadeAgainst`. `threat.defense` ganhou `building` e `next`.*
- [x] V2E-T2.3 Não prometer proteção contra incursões humanas (não existem na v0.2) nem dano à Paliçada.
- [x] V2E-T2.4 Testes: gate, limite de nível, cancelamento, conclusão no mesmo instante do ataque (ordem fixa: obra conclui antes da incursão); integração do efeito em V2E-T3. — *Registro: `palisade.test.ts`. Com a tarefa entrou a cadeia "A Promessa da Paliçada" e a marca `autoResolveIfUnlocked`, **acréscimo do agente à decisão 9 do ADR 0014**.*

**Diversão:** a Paliçada é a primeira obra "de seguro": custa agora, paga quando o jogador não está. O teste é o autor construí-la depois de perder uma vez para os lobos, sem que ninguém mande.

**Verificação:**

```bash
pnpm --filter @lotg/engine test -- construction
pnpm --filter @lotg/content test
```

**Pronto quando:** construir a Paliçada muda o desfecho da incursão de V2E-T3, e o `ViewState` explica por quê.

**Prompt sugerido:** "Leia CLAUDE.md, GAME_DESIGN.md §6.1–6.2 e §8.2, docs/decisions/0014-…md e docs/roadmap-v0.2.md V2E-T2. Adicione a Paliçada (níveis 1 e 2) com gate, custos e a explicação do efeito; os testes do desfecho ficam em V2E-T3."

### V2E-T3 · A incursão de lobos `M`

**Objetivo:** a incursão roteirizada de lobos acontece no instante marcado, com o jogador fora, resolve-se sozinha, aparece no Relatório, e a Torre avisa antes; as incursões por Ameaça seguem o mesmo caminho.
**GDD:** §2.2 (dia real 2), §8.2, §12.3, §5.7 (moral depois de incursão), §16.2 (critério 4).
**Depende de:** V2E-T2; V2C-T4; decisões 10, 11, 19, 20.
**Entregáveis:** `packages/content/src/balance.ts` (`raids`), `chronicle.ts` (`wolvesHowl`, `raidRepelled`, `raidSuffered`, `villagerInjured`, `villagerRecovered`); `packages/engine/src/threat.ts` (**novo** `raids.ts` se crescer), `population.ts`, `morale.ts`, `timeline.ts`, `advance.ts`, `view.ts`; `packages/web/src/game/returnReport.ts`, `components/ThreatPanel.tsx`; `tests/e2e/08-ameaca.spec.ts` (estendido).

- [x] V2E-T3.1 Conteúdo (premissa 10): `raids: { scripted: [{ id: 'wolvesYear1', enemy: 'wolves', size: 'light', atGameDay: 16, howlAtGameDay: 10 }]; wolves: { light: { lossRatio: 1/10, resources: ['food', 'wood'], injuries: 1 }, medium: { lossRatio: 3/20, injuries: 2 } }; injuryMs: 1 dia de jogo; moraleOnLosses: -10; moraleLossDays: 2 }`. A roteirizada só acontece no ano 1 e só em partidas que ainda não passaram do dia 16 na migração (premissa 20). — *Registro: A forma é `raids.damage[inimigo][tamanho]`. Estado na versão 11.*
- [x] V2E-T3.2 Incursões por Ameaça (fluxo `horde`, na virada do dia, depois da subida): chance `máx(0, Ameaça − 40)%`; tamanho leve abaixo de 60, médio a partir de 60; a incursão é agendada para `agora + raidLeadMs` (6 h de jogo), e `announcedAtMs = atMs − aviso da Torre`. Sem Torre, o aviso não existe; com Torre, `raidAnnounced` no instante do aviso e `threat.incoming` no `ViewState` ("Lobos em 1h; os vigias contam um bando pequeno"). Uivos (`wolvesHowl`) no dia 10 do ano 1, como prenúncio sem informação. — *Registro: `hordeTurn.ts`. Enquanto a incursão do roteiro está marcada, nada é sorteado.*
- [x] V2E-T3.3 Resolução, uma vez, no instante marcado, na ordem fixa (depois das obras concluídas, para uma Paliçada que termina no mesmo instante contar): com Paliçada suficiente, `raidRepelled` ("Os lobos recuaram diante da paliçada") e Ameaça −10; senão, perdas de 10% (ou 15%) de comida e madeira em milésimos, `injuries` aldeões feridos (`settlement.injured: Array<{ untilMs }>`, não trabalham por um dia, saem do edifício com mais gente, voltam com `villagerRecovered`), termo de moral −10 por 2 dias, `raidSuffered` com as quantidades exatas, e Ameaça −10 também (o bando se satisfez). Recursos e população continuam válidos. — *Registro: `settlement.injured` guarda `{ untilMs, building }`: o ferido volta sozinho ao ofício. A recuperação roda antes do calendário.*
- [x] V2E-T3.4 Interações testadas: fome ou frio no mesmo instante; colono chegando; duas incursões no mesmo dia (não acontece: no máximo uma agendada por vez); migração no meio de uma janela de aviso.
- [x] V2E-T3.5 Relatório e Crônica: três informações em toda incursão (aviso e preparação, o que a defesa mudou, perdas e recuperação), com os números do motor. Com Torre Nv2, o relato diz o que os vigias viram antes.
- [x] V2E-T3.6 Retorno: reabrir depois de 4 h mostra a incursão no bloco "custou" (ou "prosperou", se repelida); aba deixada aberta recebe o aviso e a linha da Crônica, e o limite do Relatório automático fica registrado no `docs/architecture.md`. — *Registro: O limite está em `docs/architecture.md` (6.2) e no README do app.*
- [x] V2E-T3.7 Testes: cenário offline idêntico com Torre 0/1/2 e Paliçada 0/1/2 (matriz QA-10); propriedade com sorteio da Ameaça; 30 dias e dois anos (frequência, sem cascata e sem repetir a roteirizada); integração com relógio adiantado (critério 4); navegador: o Relatório mostra a incursão depois do salto. Bot: política "Paliçada quando a Ameaça conhecida passa de 40". — *Registro: `threat.raids.test.ts`, `packages/server/test/raids.test.ts` e `08-ameaca.spec.ts`. Em navegador, a Torre e a Paliçada são postas no nível pelo servidor de teste (`/__test/raise`).*

**Diversão:** é a primeira vez que o mundo faz algo *contra* o feudo, e a regra do GDD §12.3 vale: a derrota custa pouco e ensina a Paliçada. O teste é o autor, depois da primeira incursão, saber exatamente o que teria mudado o resultado.

**Verificação:**

```bash
pnpm --filter @lotg/engine test -- threat
pnpm --filter @lotg/engine test -- scenario
TEST_DATABASE_URL=postgres://lotg:lotg@localhost:5433/lotg_test pnpm test:integration raids
pnpm test:e2e 08-ameaca
```

**Pronto quando:** critério 4 da §16.2 provado por integração e em navegador, a matriz QA-10 passa, e a Ameaça oscila em vez de só subir.

**Prompt sugerido:** "Leia CLAUDE.md, GAME_DESIGN.md §8.2, §5.7 e §12.3, docs/decisions/0014-…md, docs/roadmap-v0.2.md V2E-T3 e Apêndice B. Apresente o plano (roteirizada, por Ameaça, aviso da Torre, resolução na ordem fixa, feridos, Relatório) e espere aprovação. Primeiro a matriz de cenários QA-10 como teste."

### V2E-T4 · Objetivos do Senhor da v0.2 `S`

**Objetivo:** os objetivos seguintes ao 4 que a v0.2 consegue cumprir, com a regra "nunca mais de 3 ativos", ensinando as ferramentas novas na ordem em que ajudam.
**GDD:** §12.2 (`[v0.2 completo]`).
**Depende de:** V2C-T2, V2C-T5, V2D-T3, V2E-T1, V2E-T2; decisão 12.
**Entregáveis:** `packages/content/src/objectives.ts` (novas condições: `cardAnswered`, `plannedAutoStart`, `seasonSurvived`), `schemas.ts`; `packages/engine/src/objectives.ts`, `view.ts`; árvore, painel e E2E.

- [x] V2E-T4.1 Lista da v0.2 (premissa 12), com IDs estáveis e os 1–4 intocados: 5 `buildWatchtower` ("Construa a Torre de Vigia: ver o inimigo é metade da batalha", +40 pedra); 6 `answerFirstCard` ("Responda à primeira carta do Conselho", +10 moral por 1 dia); 7 `buildGranaryOrWarehouse` ("Amplie o estoque antes que a produção vá para o chão", +60 madeira); 8 `planAutoStart` ("Deixe uma obra marcada para começar sozinha", +30 ouro); 9 `buildPalisade` ("Construa a Paliçada", +100 madeira, GDD); 10 `surviveWinterWithoutCold` ("Atravesse o inverno sem passar frio", +15 moral por 1 dia). Os de herói, Patrulha e exército (7, 8, 10–15 do GDD) ficam para as suas versões, sem buraco na sequência exibida. — *Registro: Condição a mais: `anyBuildingLevel`, para o objetivo 7.*
- [x] V2E-T4.2 Até três ativos, com ação, motivo, recompensa e requisito faltante; concluir um revela o próximo; nenhum depende de herói ou soldado. — *Registro: `objectives[]` ganhou `missing` e `target`.*
- [x] V2E-T4.3 Partida nova e migrada: objetivo 4 já concluído não paga de novo nem bloqueia; fatos já cumpridos antes da migração contam na próxima avaliação (`evaluateObjectives` roda depois de todo comando e evento). — *Registro: Sem subir a versão do estado: os contadores novos ficam em `stats`.*
- [x] V2E-T4.4 Percorrer a sequência inteira por teclado e por bot; o Relatório lista conclusões sem excesso de avisos. — *Registro: Em navegador, o Salão Nv3 é posto pelo servidor de teste. Vários objetivos cumpridos de uma vez viram uma linha do Relatório e um aviso só.*

**Diversão:** os objetivos são o tutorial vivo: cada um aponta a ferramenta nova no momento em que ela resolve um problema que o jogador já sentiu (IDEIA-04). Sem tarefa diária, sem prêmio por login.

**Verificação:**

```bash
pnpm --filter @lotg/content test
pnpm --filter @lotg/engine test -- objectives
pnpm test:e2e 05-teclado-e-temas -g "objetivos"
```

**Pronto quando:** um cenário roteirizado conclui todos os objetivos da v0.2 na ordem aprovada, em partida nova e migrada.

**Prompt sugerido:** "Leia CLAUDE.md, GAME_DESIGN.md §12.2, docs/decisions/0002 e 0014, e docs/roadmap-v0.2.md V2E-T4. Adicione os objetivos 5 a 10 da v0.2 com condições novas no conteúdo e no motor, teste de cenário completo e o teste em navegador por teclado."

### V2E-T5 · Revisão independente da Fase E `S`

**Objetivo:** conferir se aviso, defesa, perda e recuperação formam uma sequência compreensível e determinística; o autor joga os três caminhos.
**Depende de:** V2E-T1 a V2E-T4.

- [ ] V2E-T5.1 Revisor independente sobre preparação, antecedência dos avisos, perdas, Ameaça, feridos e objetivos; procurar vazamento de informação no `ViewState` sem Torre.
- [ ] V2E-T5.2 Perdas e população contra adaptação, fome, recrutamento e moral: nenhuma soma de trabalhadores acima dos habitantes, nenhum recurso negativo; a defesa tem efeito mensurável, não só frase diferente.
- [ ] V2E-T5.3 O autor joga os caminhos preparado, despreparado e ausente, no ritmo 3; registrar se a próxima ação ficou clara. Mesclar `v2e-ameaca` com a aprovação dele.
- [ ] V2E-T5.4 Confirmar que nada de combate, herói ou mapa gráfico entrou; corrigir defeitos com regressão.

**Pronto quando:** defeitos confirmados corrigidos com teste; o autor jogou e aprovou.

**Prompt sugerido:** "Leia CLAUDE.md e docs/roadmap-v0.2.md V2E-T5. Lance o revisor independente (Apêndice A.4) sobre o branch v2e-ameaca com os cenários de V2E-T5.1 e V2E-T5.2, corrija o que confirmar e me prepare o roteiro dos três caminhos."

---

## 6. Fase F — Fechamento da v0.2

**Meta da fase:** os critérios da §16.2 provados, a v0.2 jogada por pessoas, versão etiquetada. No `main` (§0.8).

### V2F-T1 · Balanceamento com o simulador `M`

**Objetivo:** bots que jogam a v0.2 inteira (respondem cartas, constroem Celeiro, Armazém, Torre e Paliçada, planejam obras automáticas) e faixas que a CI confere.
**GDD:** §15.2, §15.3.
**Depende de:** Fases C, D e E.
**Entregáveis:** `packages/sim-cli/src/bots/` (políticas de C–E reunidas no bot econômico; **novo** `preguicoso.ts` com 1 visita por dia e decisões mínimas), `balance.test.ts`, `docs/balance-v0.2.md`; ajustes aprovados em `content`, GDD e goldens.

- [ ] V2F-T1.1 Rodar a matriz da §7.3 com estratégias e sementes congeladas: 50 sementes × perfis 1/2/4 visitas × ritmos × dificuldades; um ano de jogo e 7 dias reais em tabelas separadas.
- [ ] V2F-T1.2 Medir: progressão (hora do Salão 2/3/4, Celeiro, Armazém, Torre, Paliçada), desperdício (quantidade e horas contínuas), frio e fome, deserções, população mínima e final, adaptação, fila ociosa, cartas vistas/respondidas/expiradas, cadeias concluídas, incursões sofridas e repelidas.
- [ ] V2F-T1.3 Extremos antes das médias: sementes que falham, repetidas à mão no simulador e, quando relevante, no app.
- [ ] V2F-T1.4 Metas aplicáveis do GDD §15.2: população 30–40 no fim do ano (Regular, Senhor, Normal); desperdício do Regular dentro da faixa aprovada; nenhum nível anunciado e inalcançável; caminho de recuperação em todas as dificuldades. Vitória no cerco não se aplica.
- [ ] V2F-T1.5 Ajustes aprovados pelo autor em `content`, com GDD e goldens no mesmo commit e justificativa no `docs/balance-v0.2.md`. Nunca facilitar o bot para esconder uma economia ruim.
- [ ] V2F-T1.6 Desempenho de novo: avanço longo, tamanho do `ViewState`, eventos e recibos, p95 local com 50 bots (comparar com `docs/perf-v0.1.md`); hardware, commit e limitações registrados.

**Diversão:** o simulador não mede diversão; mede tédio (fila ociosa, excedente) e desespero (fome, frio, deserção). Ambos têm de ficar dentro das faixas antes de pessoas jogarem.

**Verificação:**

```bash
pnpm --filter @lotg/sim-cli test
pnpm -s sim -- --seed pedra-alta-001 --days 7 --sessions-per-day 1 --time-scale 3 --strategy preguicoso > /dev/null
```

**Pronto quando:** as metas aplicáveis estão dentro da faixa em 50 sementes, ou cada desvio tem decisão do autor.

**Prompt sugerido:** "Leia CLAUDE.md, GAME_DESIGN.md §15.2–15.3, docs/roadmap-v0.2.md V2F-T1 e §7.3, e docs/balance-v0.2.md. Complete o bot econômico com as políticas de C–E, crie o preguiçoso, rode a matriz e me traga os extremos; não mude número nenhum sem a minha resposta."

### V2F-T2 · Critérios de aceitação da v0.2 `M`

**Objetivo:** um quadro como o de [acceptance-v0.1.md](acceptance-v0.1.md) para os seis critérios da §16.2, com prova automática e prova em produção, **preenchido durante o teste** (lição 7 da §10).
**Depende de:** V2F-T1.
**Entregáveis:** **novos** `docs/acceptance-v0.2.md` e `docs/manual-test-v0.2.md`.

- [x] V2F-T2.1 Quadro com os seis critérios e os cenários QA-01 a QA-16 (§7.2), com links para os testes e espaço para a evidência manual; distinguir código, prévia e produção. — *Registro: [acceptance-v0.2.md](acceptance-v0.2.md): para cada linha, o arquivo e o nome dos testes (conferidos com `grep` em `b1b892a`), o que a prova não cobre e a coluna de evidência manual vazia ("aguarda o autor"). "Como preencher" pede onde (desenvolvimento, servidor de teste, prévia, produção), o que estava no ar, o navegador e o ritmo. Os testes cujo nome cita números da Ameaça ficaram de fora, porque esses números estão em revisão (V2F-T1).*
- [ ] V2F-T2.2 Jornadas: conta nova e migrada; um ano inteiro e a virada seguinte (com o relógio de `tests/e2e/server.ts`); cada ritmo; reenvio de comandos; sem conexão. — *Registro: o roteiro está escrito em [manual-test-v0.2.md](manual-test-v0.2.md) (conta nova, partida migrada, uma estação, uma carta e uma cadeia, a primeira incursão, um ano e a virada), com dois jeitos de adiantar o tempo em desenvolvimento: o banco de desenvolvimento e o servidor de `tests/e2e/server.ts`. **Nenhuma jornada foi executada**, e os comandos do roteiro não foram rodados por quem o escreveu. Reenvio e sem conexão estão no quadro (QA-08, QA-11), não em jornada própria.*
- [ ] V2F-T2.3 Navegador e versão em cada observação: Chromium automatizado; Firefox manual; Safari, celular e leitor de tela registrados como verificados ou não.
- [ ] V2F-T2.4 Conteúdo, teclado, contraste, foco, mensagens de tempo e percepção de custo antes de escolher.
- [ ] V2F-T2.5 Release candidata com CI verde e procedimento de reversão (V2B-T1.6); implantar **só com autorização**; conferir saúde, versão e os cenários seguros em produção sem apagar contas de jogadores.

**Pronto quando:** os seis critérios têm evidência escrita, por critério, com data e navegador.

**Prompt sugerido:** "Leia CLAUDE.md, docs/acceptance-v0.1.md, docs/manual-test-v0.1.md e docs/roadmap-v0.2.md V2F-T2 e §7. Crie docs/acceptance-v0.2.md e docs/manual-test-v0.2.md com o quadro vazio e o roteiro, e me guie pelas jornadas, registrando cada evidência na hora."

### V2F-T3 · Playtest da v0.2 `M`

**Objetivo:** repetir V2A-T1 com a v0.2, com o mesmo formulário, as mesmas consultas e as perguntas da §7.3, para comparar.
**Depende de:** V2F-T2 (versão implantada com autorização).
**Entregáveis:** **novo** `docs/playtest/relatorio-v0.2.md`.

- [ ] V2F-T3.1 Janela de 48 h com 3–5 pessoas (novas e retornantes, anotado), versão congelada, ritmo e dificuldade registrados. Mesma duração e público, para a diferença ser da versão.
- [ ] V2F-T3.2 Perguntas comparáveis da v0.1 mais o módulo de diversão da §7.3 (decisão lembrada, consequência entendida, preparação, recuperação, vontade de voltar).
- [ ] V2F-T3.3 Observação natural separada de cenário guiado: 48 h não cobrem um ano no 3× (56 h) nem no Normal; inverno e virada são testados em cenário próprio ou com observação prolongada, registrada.
- [ ] V2F-T3.4 Contagens com denominadores e relatos; nada de "retenção comprovada" com amostra pequena; retorno com comando separado de retorno só para olhar.
- [ ] V2F-T3.5 P0–P3 classificados com o autor; o que não foi medido fica escrito. Se a v0.1 não tiver amostra externa, declarar ausência de linha de base.

**Diversão:** é a única medida que vale: pessoas dizendo qual escolha lembram, o que prepararam e se quiseram voltar.

**Pronto quando:** o relatório existe e compara o retorno no dia 2 com o da v0.1 (ou declara que não há linha de base).

**Prompt sugerido:** "Leia CLAUDE.md, docs/playtest/relatorio-v0.1.md e docs/roadmap-v0.2.md V2F-T3 e §7.3. Prepare a mensagem, o formulário com o módulo de diversão e as consultas com o filtro de período; espere eu colar as respostas para montar docs/playtest/relatorio-v0.2.md."

### V2F-T4 · Correções, documentação e release `S`

**Objetivo:** P0 e P1 do playtest corrigidos; `README.md`, `CLAUDE.md`, `docs/architecture.md`, `CHANGELOG.md`, GDD e página de apresentação em dia; tag `v0.2.0` e release.
**Depende de:** V2F-T3.

- [ ] V2F-T4.1 Corrigir P0/P1 com regressão; balanceamento só com o autor.
- [ ] V2F-T4.2 Documentação e capturas contra o produto entregue (`pnpm capture:landing`; os rótulos presos às capturas em `packages/landing/src/styles/page.css`); a página de apresentação só diz do jogo o que o jogo diz de si; nada de propostas não implementadas. — *Registro: **só a documentação.** `README.md` da raiz deixou de dizer que as estações não têm efeito, que o ritmo é fixo em 3× e que a v0.2 é "planejada"; o exemplo do simulador foi refeito com a saída de hoje. **As capturas não foram refeitas** (`pnpm capture:landing` não rodou em nenhuma tarefa da v0.2) e o texto da página de apresentação não foi revisto.*
- [x] V2F-T4.3 Notas de versão: efeito nas partidas antigas (migração, fronteira), ritmos e dificuldades, o que o Conselho faz, e o procedimento de reversão. — *Registro: `CHANGELOG.md`, seção "[Não lançado]": a v0.2 por pacote (Adicionado, Alterado), "Efeito nas partidas antigas" (com a reversão) e "Limites conhecidos". Diz que não há tag nem release e que a publicação foi por fase no `main`. Os números da Ameaça não estão nas notas: citam o GDD §8.2 e `balance.threat`.*
- [x] V2F-T4.4 `docs/architecture.md` reescrito como "Arquitetura da v0.2" (lição 5: reescrever, não anotar); `CLAUDE.md` com o estado novo e os comandos novos. — *Registro: [architecture.md](architecture.md) reescrito do começo (o estado e as versões, os sorteios, a ordem do mesmo instante, os relógios, o Conselho, a Ameaça, o catálogo, o protocolo 2 e o 426, as divergências e os limites). `CLAUDE.md`: o estado da v0.2, os comandos da matriz, do `--perf`, do `--game-year` e da cobertura, o filtro de integração sem `--`, e as regras que mudaram (versões do estado, sorteios, ordem do mesmo instante, catálogo, protocolo 2, névoa, cartas).*
- [x] V2F-T4.5 CI verde no commit candidato; o autor cria a tag e a release; Registro preenchido com o que ficou pendente. — *Registro: em 2026-10-05 o autor pediu a tag e a release à sessão de código; ver a linha "Lançamento da v0.2.0" do Registro (§11).*

**Pronto quando:** zero P0 e P1 abertos, CI verde no commit etiquetado, tag criada pelo autor.

**Prompt sugerido:** "Leia CLAUDE.md, docs/playtest/relatorio-v0.2.md e docs/roadmap-v0.2.md V2F-T4. Corrija os P0/P1 com regressão, atualize a documentação e a página de apresentação para o que foi entregue, e prepare as notas de versão; eu crio a tag."

### V2F-T5 · Preparar a v0.3 `S`

**Objetivo:** `docs/roadmap-v0.3.md` no mesmo formato, com as lições da v0.2 e o lote 2 do Conselho.
**Depende de:** V2F-T4.

- [x] V2F-T5.1 Consolidar o que funcionou, confundiu e trouxe gente de volta, com os casos negativos. — *Registro: [roadmap-v0.3.md](roadmap-v0.3.md), §11: as lições que já se liam (§11.1, `d9957d7`) e as do fechamento (§11.3: revisões que acharam defeito em toda fase, os tipos de defeito que se repetiram, as trilhas e os portões, a publicação por fase, a parada da máquina de madrugada, o fechamento enxuto das Fases D e E). "O que trouxe gente de volta" não existe: não houve playtest (§11.4).*
- [x] V2F-T5.2 Mapear Taverna, heróis, expedições, Mercado e Mestres às dependências entregues (RNG, Conselho, tiles abstratos, moral); a "Estrangeira ferida" como primeira carta roteirizada da v0.3. — *Registro: roadmap da v0.3, Fases B a E, com o campo "Da v0.2 usa" em cada tarefa e a carta em V3C-T3 (`d9957d7`), escrito com a v0.2 pela metade; a V3A-T1 confere contra o código.*
- [x] V2F-T5.3 Lote 2 do Conselho (rumo às 60 cartas do GDD): quantas, quais cadeias, com herói ou não. — *Registro: roadmap da v0.3, §13.3, e V3F-T1 (`d9957d7`). Nada aprovado pelo autor.*
- [x] V2F-T5.4 Detalhar a primeira tarefa da v0.3 com arquivos, testes, impacto em partidas antigas e evidência de conclusão. — *Registro: V3A-T1 (conferência da herança da v0.2 e linha de base), `d9957d7`.*

**Pronto quando:** a primeira tarefa da v0.3 está detalhada o bastante para abrir a sessão seguinte.

---

## 6b. Fase G — Correções com as respostas do autor

Acrescentada em 2026-10-05, depois de o autor responder às pendências com quatro dias de jogo em produção ([ADR 0016](decisions/0016-respostas-do-autor-as-pendencias-da-v0.2.md)). Vem **antes da v0.3**. Há jogadores em produção: cada tarefa diz o que acontece com a partida em andamento, e nada é enviado ao `main` remoto sem o autor pedir (todo `push` com a CI verde é implantado).

### V2G-T1 · Depósitos em 1.000 e o ouro do objetivo 4 `M`

**Objetivo:** o Salão nível 8 cabe no Armazém em Senhor, e o objetivo 4 paga a Torre que o objetivo 5 pede (ADR 0016, itens 1 e 7).
**Depende de:** nada.

- [x] V2G-T1.1 `storage.buildings.{granary,warehouse}.level1` de 900 para 1.000; `townHallLevel2` com `reward: { gold: 50 }`, mantendo o desbloqueio.
- [x] V2G-T1.2 Testes de conteúdo, motor, servidor e app na regra nova; a lista de tetos por dificuldade recalculada.
- [x] V2G-T1.3 Goldens regravados com o diff lido; retratos congelados das versões 1 a 10 intactos.
- [x] V2G-T1.4 Linha de base do simulador medida de novo, com o antes e o depois; bots sem mudança.
- [x] V2G-T1.5 GDD §5.5 e §12.2 e uma seção datada em `docs/balance-v0.2.md`.

**Partidas em andamento:** a capacidade sobe no instante em que a imagem nova entra; quem já cumpriu o objetivo 4 não recebe os 50 de ouro. Sem versão nova do estado.
**Verificação:** `pnpm verify`, `pnpm test:integration`, `pnpm test:e2e`.
**Pronto quando:** o teste de alcançabilidade mostra o Salão 8 ao alcance em Senhor e nenhuma faixa do simulador piora sem explicação.

### V2G-T2 · Deserção em tempo real e a fome que reabre `M`

**Objetivo:** uma noite de sono no ritmo Rápido não custa meia dúzia de aldeões, e mandar todos à Fazenda e de volta não zera o prazo (ADR 0016, itens 2 e 3).
**Depende de:** V2G-T1 (para não regravar os mesmos goldens duas vezes).

- [x] V2G-T2.1 As duas escolhas de regra, respondidas pelo autor em 2026-10-05: a deserção **continua na virada do dia**, onde saem os aldeões que o prazo real já deve (dois por virada no Tranquilo); a fome que reabre com menos de **2 h reais** sem fome é a mesma. Falta só o plano de implementação.
- [x] V2G-T2.2 Conteúdo: carência e passo da deserção em milissegundos **reais**, convertidos com `settings.timeScale`, como `council.expiryRealMs`.
- [x] V2G-T2.3 Motor: a deserção na ordem do mesmo instante, com teste do instante exato; a fome que reabre dentro da janela guarda o início anterior.
- [x] V2G-T2.4 Versão 12 do estado e passo de migração (o campo que lembra quando a última fome acabou; o que mais o plano pedir). Partida em fome na fronteira: a contagem não recomeça nem salta.
- [x] V2G-T2.5 Visão e textos: o painel da moral e o aviso de fome dizem os prazos em tempo real; teste que reproduz o furo de C-4 e fica no repositório.
- [x] V2G-T2.6 Propriedade de divisão de intervalo rodada com fome, deserção e reabertura no caminho; goldens; GDD §5.6 e §12.1.

**Partidas em andamento:** migram na primeira leitura. No Rápido a deserção fica três vezes mais lenta; no Normal nada muda; no Tranquilo fica duas vezes mais rápida que hoje.
**Verificação:** `pnpm verify`, `pnpm test:integration`, `pnpm test:e2e`; a matriz não mede fome (nenhum bot passa fome), então a prova é de teste do motor e de integração nos três ritmos.
**Pronto quando:** nos três ritmos a primeira deserção vem na primeira virada do dia a partir de 12 h reais de fome e as seguintes acompanham o passo de 2 h reais (dois por virada no Tranquilo), e a manobra de C-4 não muda nenhum desses instantes.

### V2G-T3 · Aviso da Torre de Vigia em tempo real `M`

**Objetivo:** a antecedência do aviso é de 1 h real no nível 1 e de 2 h reais no nível 2, em qualquer ritmo (ADR 0016, item 4).
**Depende de:** V2G-T2 (a mesma conversão de tempo real).

- [x] V2G-T3.1 Conteúdo: `watchtowerLevels[].warningRealMs`; o motor converte com o ritmo ao decidir o instante do aviso.
- [x] V2G-T3.2 Incursão já marcada ou já anunciada em partida em andamento: o que vale é o aviso que ainda não saiu; nenhum aviso sai duas vezes. Dizer no plano se pede versão nova do estado.
- [x] V2G-T3.3 A matriz QA-10 nos três ritmos; textos do painel da Ameaça e da obra da Torre; goldens; GDD §8.2.

**Partidas em andamento:** no Rápido o aviso triplica; no Normal nada muda; no Tranquilo cai à metade (de 2 h e 4 h reais para 1 h e 2 h).
**Verificação:** `pnpm verify`, `pnpm test:integration`, `pnpm test:e2e 08-ameaca`.
**Pronto quando:** o painel anuncia a mesma antecedência nos três ritmos e a obra da Paliçada continua cabendo na janela.

### V2G-T4 · Os sete problemas das cartas `M`

**Objetivo:** corrigir o que a revisão editorial achou e ninguém aplicou (pendências, DE-3), com cada reescrita aprovada pelo autor antes de entrar (ADR 0016, item 5).
**Depende de:** nada.

- [x] V2G-T4.1 Proposta por carta, com texto e números de antes e de depois, para o autor aprovar: a opção dura que vale mais que a neutra na primavera (pedreiros, poço, notícia da primavera); "Um teto antes do frio"; "Vigília entre vizinhos"; as pistas da promessa da Paliçada; as duas cartas que saem com o feudo em fome; a Ponte do Degelo; o Celeiro Comum.
- [x] V2G-T4.2 Aplicar só o aprovado. **Nenhum id de carta ou de opção muda** (o teste de `council.test.ts` do conteúdo fixa os publicados).
- [x] V2G-T4.3 Goldens, retratos da versão atual e a semente de cenário do Conselho, pela receita "Uma carta nova" do README do motor quando o sorteio mudar; `docs/content-v0.2.md` com as fichas atualizadas.

**Partidas em andamento:** carta já na mesa mostra o texto novo; efeito já aplicado não é refeito.
**Verificação:** `pnpm verify`, `pnpm test:integration`, `pnpm test:e2e 07-conselho`, `SHOW_COVERAGE=1 pnpm --filter @lotg/sim-cli test -- coverage`.
**Pronto quando:** o autor aprovou as sete e a cobertura do Conselho não perdeu carta.

### V2G-T5 · Descrições das dificuldades e textos pequenos `S`

**Objetivo:** as boas-vindas dizem o que o Conselho faz por quem falta (ADR 0016, item 6), e a concordância de "As Habitações já está em obras." é corrigida.
**Depende de:** V2G-T1 e V2G-T2 (as frases citam depósitos e deserção).

- [x] V2G-T5.1 Três descrições propostas ao autor e aprovadas; chegam à tela por `GET /v1/catalog`.
- [x] V2G-T5.2 As duas frases de recusa com a concordância certa, com os testes e goldens que as fixam.

**Verificação:** `pnpm verify`, `pnpm test:integration catalog`, `pnpm test:e2e 01-entrada`.
**Pronto quando:** nenhuma frase das boas-vindas promete o que a regra não faz.

### V2G-T6 · App: barra de status, botão da defesa e ordem da aba Feudo `M`

**Objetivo:** a fome não some atrás de uma carta, o botão depois da incursão não gasta a madeira da Paliçada, e o jogador novo acha os objetivos (ADR 0016, itens 8, 9 e 10).
**Depende de:** nada no motor.

- [x] V2G-T6.1 `statusTopic`: fome e frio na frente da decisão pendente, na barra e no título.
- [x] V2G-T6.2 `defenseCommand`: "Ver a defesa" quando a Paliçada não pode começar, no Relatório e em "Antes de partir".
- [x] V2G-T6.3 Aba Feudo: Objetivos antes do painel da Ameaça; conferir em 1280×800 e em 720×800.
- [x] V2G-T6.4 `pnpm capture:landing` e as três imagens e o `og.png` da página de apresentação, velhas desde a Fase C.

**Verificação:** `pnpm verify`, `pnpm test:e2e`, `pnpm test:e2e:landing`.
**Pronto quando:** os três comportamentos têm teste em navegador e a página de apresentação mostra a bancada de hoje.

### V2G-T7 · Fechar a fase `S`

**Objetivo:** documentos no estado novo e o que é do autor dito com clareza.
**Depende de:** V2G-T1 a V2G-T6.

- [x] V2G-T7.1 Conferir os dois defeitos das previsões de C-8 contra o commit `85a9373`: o que ficou, com teste que o marque.
- [x] V2G-T7.2 `CLAUDE.md`, READMEs, `docs/architecture.md`, `docs/acceptance-v0.2.md` e `docs/pendencias-v0.2.md` no estado novo.
- [ ] V2G-T7.3 Do autor: publicar, tag `v0.2.0` e release; backup externo e cópia do `RECOVERY_CODE_SECRET` fora do Coolify.

**Pronto quando:** a primeira tarefa da v0.3 (V3A-T1) pode abrir com a v0.2 fechada.

---

## 7. Critérios de aceitação, cenários integrados e sinais de diversão

### 7.1 Critérios do GDD §16.2 por tarefa

| # | Critério | Tarefas que o entregam | Como provar |
|---|---|---|---|
| 1 | O estoque para no cap e o painel mostra "cheio em" | V2C-T2 | Propriedade "nunca acima do cap" + navegador |
| 2 | Uma carta aparece a cada 8 h e expira em 24 h com a opção padrão | V2B-T2, V2D-T1, V2D-T3 | Cenário no motor (três dificuldades) + navegador com relógio controlado |
| 3 | Uma cadeia de 3 cartas funciona de ponta a ponta | V2D-T1, V2D-T2 | Cenário roteirizado com "O Celeiro Comum" nas duas ramificações |
| 4 | A incursão de lobos do dia 2 acontece offline e aparece no Relatório | V2E-T1, V2E-T2, V2E-T3 | Integração com relógio adiantado + navegador |
| 5 | A troca de ofício reduz a produção por 2 h | V2C-T3 | Unidade + navegador |
| 6 | Dificuldade e ritmo são escolhidos na criação | V2B-T3 | Integração + navegador das boas-vindas |

"8 h", "24 h" e "2 h" são no ritmo Normal; em outros ritmos valem as conversões da premissa 1 (as 24 h da expiração são reais em qualquer ritmo). "Nunca acima do cap" vale para comida, madeira e pedra, não para ouro nem para estoque herdado.

Entregas do GDD que não aparecem nos seis critérios e continuam obrigatórias: estações com efeito, moral, segunda fila e início automático, Torre e Ameaça, Paliçada, objetivos da v0.2, "Antes de partir" e o Relatório em três blocos. Estão cobertas abaixo.

### 7.2 Matriz de cenários integrados

| ID | Cenário | Resultado a verificar | Tarefas |
|---|---|---|---|
| QA-01 | Carregar v0.1 com obra, planejadas, estoque alto e objetivo 4 concluído | Migrado uma vez; progresso e desbloqueios preservados; sem prêmio duplicado; estoque herdado intacto | V2B-T1, V2C-T2, V2E-T4 |
| QA-02 | Avançar 30 dias de uma vez, por horas e com cortes aleatórios | Estado, RNG, restos, desperdício e eventos iguais; entrada não mutada | V2B-T2, V2C-T7, V2D-T5, V2E-T5 |
| QA-03 | Estação, fim de obra, adaptação, moral, carta, incursão e início automático no mesmo instante | Ordem documentada (§0.7), nenhuma cobrança duplicada, nenhum laço | V2C-T7, V2D-T5, V2E-T5 |
| QA-04 | Encher estoque; gastar; receber recompensa; cancelar obra | Caps respeitados, ouro sem cap, desperdício contado, "cheio em" recalculado | V2C-T2 |
| QA-05 | Subir Salão e Armazém e comprar cada melhoria anunciada, em cada dificuldade | Nenhum custo acima do cap alcançável; bloqueio temporário explicado | V2C-T2, V2C-T7 |
| QA-06 | Duas planejadas automáticas e poucos recursos, depois de ausência | Débitos e ordem iguais aos da execução acompanhada; motivo da espera na tela | V2C-T5 |
| QA-07 | Frio, fome, moral baixa, ferido e pouca população | Alocação válida; piso; recuperação possível; sem estado sem saída | V2C-T4, V2E-T3 |
| QA-08 | Carta expira no clique; outra aba responde; rede cai depois do commit | Uma resolução e um pagamento; mesmo ID, mesmo recibo; novo ID recusado sem perder o avanço | V2D-T1, V2D-T3 |
| QA-09 | Duas pendentes, catálogo inelegível, continuação agendada atrás, ano mudando | Sem rerrolagem por polling; cadência ancorada; continuação chega; sem duplicar roteiro | V2D-T1, V2D-T2 |
| QA-10 | Mesma incursão com Torre 0/1/2 e Paliçada 0/1/2 | Aviso e proteção com efeito real; uma perda por ataque; relato explica causa e próximo passo | V2E-T3 |
| QA-11 | Reabrir após 4 h, reconectar, aba em segundo plano | Três blocos sem omitir nem duplicar; cursores corretos; limite da aba aberta registrado | V2D-T4, V2E-T3 |
| QA-12 | Um ano inteiro e a virada seguinte, com carta e efeito pendentes | `seenThisYear` zera; flags, obras, efeitos e pendentes continuam; roteirizada não repete | V2D-T1, V2E-T3 |
| QA-13 | API nova, app e cache antigos, recibo antigo, reversão | 426 no protocolo 2; cache descartado; recibo intocado; reversão ensaiada | V2B-T1, V2D-T1, V2F-T2 |
| QA-14 | Fluxos novos nos três temas, por teclado e em 720 px | Custos e prazos legíveis; foco; nada só por cor; contraste ≥ 4,5:1 | V2C-T6, V2D-T3, V2F-T2 |
| QA-15 | Jornada E2E no ritmo 3 | Prazos do navegador e da API concordam; conversão uma vez só | V2B-T4, V2F-T2 |
| QA-16 | Exclusão, renovação de sessão e nova partida depois das mecânicas | Contratos da v0.1 passam; nada atravessa contas; dados novos entram no expurgo | V2F-T2 |

### 7.3 Matriz de balanceamento e sinais de diversão

**Matriz mínima:** perfis de 1, 2 e 4 visitas por dia real × cada ritmo oferecido × cada dificuldade × 50 sementes fixas. Rodar inteira no fechamento (V2F-T1); rodadas menores durante as fases (V2C-T7, V2D-T5) não a substituem.

| Sinal | Como medir | Como usar |
|---|---|---|
| Progresso alcançável | Hora do Salão 2/3/4, Celeiro, Armazém, Torre, Paliçada; bloqueios por cap ou pré-requisito | Detectar travas antes de mexer em taxas |
| Uso do estoque | Desperdiçado ÷ produção bruta do mesmo recurso; horas contínuas desperdiçando com saldo positivo | Nunca somar recursos diferentes num percentual; produção zero é "não se aplica" |
| Planejamento offline | Horas de fila ociosa com planejada automática viável; obras iniciadas entre visitas | A meta é zero atraso indevido do motor |
| Sobrevivência e recuperação | Horas de fome e frio; deserções; população mínima; horas até saldo sustentável depois da ação de recuperação | Separar estratégia ruim do bot de impossibilidade matemática |
| Conselho utilizável | Cartas vistas, respondidas, expiradas, bloqueadas; cadeias iniciadas e concluídas | Expiração frequente em 1 visita/dia aponta janela ruim |
| Tensão que sobe | Ameaça média por estação; incursões sofridas e repelidas; hora da primeira Paliçada | A Ameaça tem de oscilar, não só subir |
| Decisão com significado (humano) | Uma frase anônima por participante: escolha, alternativa, consequência | Boa resposta explica uma troca; repetir "a opção verde" não basta |
| Antecipação (humano) | A pessoa diz o que espera da próxima estação ou ameaça antes de sair | Mede avisos e clareza, não obriga a consultar abas |
| Retorno espontâneo (humano) | Comandos no dia 2 + formulário sobre voltar só para olhar | Numerador e denominador; sem alegação estatística |
| Peso da interface (humano) | Cliques para preparar a ausência; duração da sessão; momentos de confusão | A versão não pode trocar diversão por microgerenciamento |

**Perguntas adicionais no playtest da v0.2** (ao fim das 48 h, não a cada login):

1. Qual escolha você lembra de ter feito? O que deixou de ganhar com ela?
2. Alguma consequência pareceu injusta ou impossível de prever? Qual?
3. O que você preparou antes de sair? Funcionou como esperava?
4. Em algum momento sobrou recurso, faltou objetivo ou parecia não haver saída?
5. Qual história do Conselho você gostaria de continuar? O que fez você querer voltar?

### 7.4 Definição de pronto da versão

- [ ] Os seis critérios do GDD têm prova automática e evidência manual, por critério, com data e navegador.
- [ ] Estações, moral, ofício, filas, "Antes de partir", Conselho, Retorno em três blocos, Torre, Paliçada, lobos e objetivos têm seus cenários integrados cobertos (§7.2).
- [ ] ADRs 0013 e 0014 aprovados; proposta descartada não aparece como funcionalidade entregue.
- [ ] Um feudo novo e um migrado completam um ano e a virada seguinte sem travas.
- [ ] As 21 cartas aprovadas; cadeias alcançáveis; opções automáticas executáveis; o que falta para as 60 está no inventário e no roadmap da v0.3.
- [ ] Matriz de balanceamento rodada; extremos analisados; playtest registrado; zero P0/P1 abertos.
- [ ] Migração, backup, restauração e reversão com procedimento e ensaio; limites escritos.
- [ ] Documentação, capturas e página de apresentação correspondem ao produto; CI verde no commit candidato; publicação autorizada.

---

## 8. Decisões que esperam o autor, com premissas recomendadas

Os números são estáveis para referência nas tarefas. **Estado em 2026-10-01:** as decisões dos dois lotes foram **aplicadas por delegação do autor**, cada uma com a sua premissa recomendada, e estão registradas nos ADRs [0013](decisions/0013-regras-da-v0.2-tempo-ritmo-migracao-e-economia.md) (lote 1) e [0014](decisions/0014-conselho-e-ameaca-na-v0.2.md) (lote 2). Nenhuma foi respondida pelo autor: todas **aguardam confirmação**, linha a linha, em [pendencias-v0.2.md](pendencias-v0.2.md). As sessões de perguntas (V2B-T0 e V2D-T0) não aconteceram; o autor pediu a versão inteira sem elas. A coluna "Premissa recomendada" guarda a proposta como foi escrita; a coluna "Registro" diz onde a decisão está. O ADR traz os detalhes que a premissa deixava em aberto (por exemplo 2a, 13a e 19a) e, onde os dois divergirem, **vale o ADR**. Uma decisão registrada deixa de ser pergunta para as tarefas: elas seguem o ADR sem perguntar de novo.

| # | Decisão | Trava | Premissa recomendada | Por quê, e o que validar | Registro |
|---|---|---|---|---|---|
| 1 | **Como os tempos do GDD se leem fora do ritmo Normal** | V2C-T1, T3, T4; V2D-T1; V2E-T3 | Tudo é **tempo de jogo** e escala com o ritmo (cadência das cartas a cada 4 dias de jogo, adaptação de 1 dia, fome de 12 h, festival de 1 dia, lobos no dia 16, moral por 2 dias), **exceto a expiração da carta, que é 24 h reais** em qualquer ritmo, convertida com `settings.timeScale` no instante do sorteio | O motor só conhece tempo de jogo (§4.2). A única janela que depende de uma pessoa responder é a da carta; no 3× ela viraria 8 h e venceria durante uma noite. Validar com o simulador em 1 visita/dia: quase nenhuma carta expira | [0013](decisions/0013-regras-da-v0.2-tempo-ritmo-migracao-e-economia.md) (regra geral) e [0014](decisions/0014-conselho-e-ameaca-na-v0.2.md) (prazos do Conselho) |
| 2 | **Quais ritmos o jogador escolhe** | V2B-T3 | Três: **1×** ("um ano em 7 dias"), **3×** ("um ano em 56 horas", **padrão**, o ritmo da produção) e **0,5×** ("um ano em 14 dias") | O autor achou o 1× lento ([ADR 0011](decisions/0011-ritmo-3x-no-mvp.md)); o GDD §4.2 tem 2× como "Rápido" e ninguém jogou nele. Partidas existentes não mudam. Atualizar §4.2 | [0013](decisions/0013-regras-da-v0.2-tempo-ritmo-migracao-e-economia.md) (2 e 2a) |
| 3 | **Como a v0.2 chega à produção** | Fase B em diante | §0.8: A, B e F no `main`; C, D e E em branch de fase, mesclado quando o autor jogou e aprovou | Evita mostrar dificuldade sem efeito ou cap sem Celeiro. Um recurso de prévia no Coolify é ato do autor, não desta revisão | [0013](decisions/0013-regras-da-v0.2-tempo-ritmo-migracao-e-economia.md), **diferente da premissa**: em 2026-10-01 o autor pediu tudo no `main` **local**, um commit por tarefa, **sem branches de fase e sem `push`** (`push` no `main` implanta); ele joga em desenvolvimento e decide quando publicar |
| 4 | **Partidas da v0.1 quando o estado mudar** | V2B-T1, V2C-T2 | **Migrar**, preservando tudo; `migratedAtMs` como fronteira; estoque acima do cap **fica** e não recebe produção até cair abaixo; moral 50; Ameaça 0; primeira carta a partir da migração | Arquivar perderia os feudos de quem joga. Cortar o estoque silenciosamente seria um P0. O Relatório explica a mudança uma vez | [0013](decisions/0013-regras-da-v0.2-tempo-ritmo-migracao-e-economia.md) |
| 5 | **Balanceamento do ritmo 3×** (V2A-T2.3) | V2A-T2, V2B-T4 | Esperar caps e início automático (V2C-T2, V2C-T5); faixas por ritmo em V2B-T4 com limite de excedente parado a definir com os números de V2A-T2 | Corrigir número antes das mecânicas que resolvem o problema seria ajustar duas vezes | [0013](decisions/0013-regras-da-v0.2-tempo-ritmo-migracao-e-economia.md) |
| 6 | **Mercado e caravanas já na v0.2?** | Fase C | **Não**: v0.3 | Caps, automação e cartas já dão saída ao excedente; reavaliar com o simulador e o playtest | não entra: v0.3 |
| 7 | **Quais cartas, quantas, quem escreve** | V2D-T2 | Lote 1: **3 cadeias de 3 + 12 avulsas = 21**, escritas pelo agente em `docs/content-v0.2.md` e aprovadas carta a carta; a meta de 60 fica para o lote 2 (V2F-T5) | O Apêndice B do GDD tem 12 cartas, a maioria de versões futuras. Quantidade não substitui variedade: medir elegibilidade | [0014](decisions/0014-conselho-e-ameaca-na-v0.2.md); aprovação carta a carta pendente |
| 8 | **A carta roteirizada do dia 2 entrega um herói** | V2D-T2 | Fica para a **v0.3** (o GDD §16.2 já põe o critério lá). Nenhuma roteirizada no lote 1 | Antecipar o herói é antecipar a Guilda | [0014](decisions/0014-conselho-e-ameaca-na-v0.2.md) |
| 9 | **Opção "melhor" e "pior" por dificuldade** | V2D-T1 | `autoResolve: { peasant, lord, ironKing }` **marcado editorialmente** em cada carta; as três sem custo | Calcular "melhor" no motor é ambíguo e não testável; editorial é simples e revisável | [0014](decisions/0014-conselho-e-ameaca-na-v0.2.md) |
| 10 | **Lobos:** instante, perdas, ferido, incursões por Ameaça | V2E-T3 | Uivos no dia 10, incursão no **dia 16** do ano 1 (30 h de jogo: segundo dia real no Normal, 10 h no 3×); perda de **10%** de comida e madeira; **1 ferido** por 1 dia de jogo (não trabalha); moral −10 por 2 dias; **incursões por Ameaça entram** (chance diária `máx(0, Ameaça − 40)%`, leve < 60, média ≥ 60, com 6 h de antecedência) | Sem incursões recorrentes, Torre e Paliçada seriam compradas uma vez e esquecidas; com elas, a tensão sobe (§15.1 item 4). Validar frequência no simulador | [0014](decisions/0014-conselho-e-ameaca-na-v0.2.md) |
| 11 | **Ameaça sem como cair; Torre e Paliçada por nível** | V2E-T1, V2E-T2 | Ameaça cai **−10 em toda incursão**, repelida ou sofrida; só visível com a Torre; Torre Nv1 revela o número e avisa 1 h antes, Nv2 avisa 2 h e diz o tamanho; Paliçada Nv1 absorve leves, Nv2 absorve médias (média contra Nv1: metade da perda). Torre e Paliçada até o **nível 2** nesta versão | Dá a cada nível um efeito que o jogador vê e evita vender melhoria vazia; limpar tile e Nv3+ ficam para as versões que os usam | [0014](decisions/0014-conselho-e-ameaca-na-v0.2.md) |
| 12 | **Objetivos 5 a 15 na v0.2** | V2E-T4 | Seis novos (V2E-T4.1): Torre, primeira carta, estoque, obra automática, Paliçada, inverno sem frio; IDs 1–4 intocados | Cada um ensina uma ferramenta nova no momento em que ela resolve um problema sentido (IDEIA-04) | [0014](decisions/0014-conselho-e-ameaca-na-v0.2.md) |
| 13 | **Lenha, obras lentas e postos por edifício** | V2C-T1, V2C-T3 | Lenha 0,5 madeira por habitante/h **no inverno**, como consumo contínuo; falta de madeira abre o **frio** (×0,8, moral −20) em instante exato; obras **iniciadas** no inverno levam ×1,5 (as em curso mantêm o prazo); recrutamento **ordenado** na primavera leva ×0,8; **sem limite de postos**: ocupado = ao menos `nível` trabalhadores na virada | Prazos fixados no início mantêm a linha do tempo simples e o invariante exato; um limite de postos seria regra nova que a v0.1 não tem | [0013](decisions/0013-regras-da-v0.2-tempo-ritmo-migracao-e-economia.md) (13 e 13a) |
| 14 | **Operação pendente desde a Fase 4** | V2A-T1.3, V2B-T1 | Backups externos e cópia do `RECOVERY_CODE_SECRET` **antes** de a migração chegar à produção | Protege o acesso às partidas | pendente do autor |
| 15 | **Os oito pontos do ADR 0012** | V2A-T1.6, V2F-T4 | Confirmar antes de a página entrar na mensagem do playtest | Não bloqueia | pendente do autor |
| 16 | **Ligar o vínculo GitHub** | Nenhuma | Continua **desligado** na v0.2 | Sem pedido do autor, sem OAuth App | pendente do autor |
| 17 | **Contrato dos caps e métrica de desperdício** | V2C-T2, T7; V2F-T1 | `cap = máx(500, capacidade do edifício) × dificuldade`; ganhos discretos cortados no cap e contados; estoque herdado intocado; **"8 h"** = horas de jogo contínuas desperdiçando um recurso, no perfil Regular | "Acima do cap" é impossível depois de limitar; a métrica certa é tempo desperdiçando | [0013](decisions/0013-regras-da-v0.2-tempo-ritmo-migracao-e-economia.md) |
| 18 | **Ordem e automações** | V2C-T5, V2D-T1 | Planejadas automáticas tentadas **na ordem da lista, pulando as bloqueadas**; o instante "recursos bastam" é evento da linha do tempo; cadência do Conselho **ancorada** (`nextDrawAtMs += intervalo` mesmo quando pulado por 2 pendentes); continuação agendada tem **prioridade** sobre o sorteio; expiração resolve **antes** de um comando no mesmo instante; opção automática **nunca tem custo** | Sem essas regras o resultado offline depende de como o intervalo foi dividido | [0013](decisions/0013-regras-da-v0.2-tempo-ritmo-migracao-e-economia.md) (filas) e [0014](decisions/0014-conselho-e-ameaca-na-v0.2.md) (Conselho) |
| 19 | **Recuperação e moral** | V2C-T4, V2E-T3 | Fórmula diária com fome −20 **mais** −2 por dia inteiro de fome; deserção após 12 h de fome (não em Camponês); **piso de 3 aldeões** para toda partida de aldeão; nenhuma outra proteção até os cenários provarem necessidade | Frio, fome, moral e lobos podem compor espiral; o piso é a proteção mínima e visível (IDEIA-06) | [0013](decisions/0013-regras-da-v0.2-tempo-ritmo-migracao-e-economia.md) (19 e 19a) |
| 20 | **Virada de ano** | V2D-T1, V2E-T3 | `seenThisYear` zera; flags, pendentes, agendadas, efeitos, obras e recursos continuam; a roteirizada dos lobos é só do ano 1; incursões por Ameaça continuam | A história não se apaga nem dobra recompensas | [0014](decisions/0014-conselho-e-ameaca-na-v0.2.md) |
| 21 | **Propostas de experiência (IDEIA-01 a 07)** | V2C-T6, V2D-T2, V2D-T4, V2E-T4 | **Todas entram** como tarefas de interface ou de conteúdo (não mudam regra), exceto IDEIA-06, que é regra e vai pela decisão 19 | São o que torna as mecânicas legíveis; nenhuma cria moeda, tarefa diária ou prêmio por login | [0014](decisions/0014-conselho-e-ameaca-na-v0.2.md) |

**Registro:** para cada decisão, o ADR guarda o que foi aplicado, a data, a alternativa descartada, a razão, a tarefa afetada e a seção do GDD; o GDD (versão 0.7) já diz o que os dois ADRs decidiram. As decisões 14, 15 e 16 são atos do autor e continuam com ele; na 6 vale a premissa: Mercado e caravanas não entram na v0.2. Escolhas novas de regra vão ao ADR e ao GDD antes do código.

---

## 9. Dívidas conhecidas

Conferidas no código em 2026-10-01. "Bloqueia" quer dizer: precisa estar resolvida antes da tarefa indicada.

### 9.1 Código

| Onde | O que é | Bloqueia a v0.2? |
|---|---|---|
| `packages/engine/src/types.ts` (`schemaVersion: 1`), `packages/server/src/games/repository.ts` (`state` lido sem validação) | Não existe migração de `GameState` | **Sim**: V2B-T1 |
| `packages/engine/src/state.ts` (`rng: {}`) | Não existe gerador de números aleatórios | **Sim**: V2B-T2 |
| `packages/protocol/src/api.ts` (`difficulty: 'lord'`, `timeScale: z.literal(1)` aceito e ignorado), `packages/server/src/games/service.ts` | O jogador não escolhe ritmo nem dificuldade | **Sim**: V2B-T3 |
| `packages/engine/src/types.ts` (`capsEnabled: false`) | O ponto de corte dos caps existe só como tipo literal | Resolvido em V2B-T1 (sai) e V2C-T2 |
| `packages/protocol/src/view.ts` (`pendingDecisions: z.array(z.never())`) | O app antigo não consegue ler uma carta pendente | **Sim**: V2D-T1 sobe o protocolo para 2 |
| `packages/sim-cli/src/balance.test.ts` | Faixas só no ritmo 1 e com uma semente | **Sim** para o balanceamento: V2B-T4 |
| `packages/web/src/game/returnReport.ts` | O Relatório só é montado ao abrir a página depois de 4 h; uma aba aberta a noite inteira não recebe | Não; afeta o critério 4 (V2E-T3.6) |
| `packages/web` (notificações) | Nada chega com a aba fechada | Não; pesa mais com cartas que expiram (24 h reais aliviam) |
| `docs/perf-v0.1.md` | Custo de `advanceTo` depois de dias sem acesso nunca medido; no 3× há 36 viradas por dia real, cada uma com moral, experiência, sorteios e desperdício | Não; medir em V2C-T7 e V2F-T1 |
| `docs/perf-v0.1.md`, tabela `commands` | Cada recibo guarda a resposta inteira (~3,4 kB); o `ViewState` da v0.2 será maior | Não; medir em V2F-T1 |
| `packages/server/src/games/commands.ts` | Relógio para trás grava `server_time` regredido | Não |
| `packages/server` | `GET /catalog` não existe | Não; reavaliar quando o catálogo de cartas crescer |
| `packages/web/src/workbench/EditorTabs.tsx` | Botões de fechar aba dentro do `tablist` | Não |
| `packages/web/src/services/sessionLock.ts` | `storageSettle` protege de uma corrida nunca reproduzida | Não |
| App (GDD §13.6) | "Baixar cópia da partida (JSON)" não existe | Não |
| `packages/web/src/tabs/Settings.tsx` | A Hora da Vigília é guardada e não muda nada (v0.4) | Não |

### 9.2 Operação

| O que é | Bloqueia a v0.2? |
|---|---|
| Backups no mesmo disco do banco; falta um destino externo no Coolify | **Recomendado antes do playtest** (V2A-T1.3) e **antes de V2B-T1** entrar em produção |
| Não há registro de que `RECOVERY_CODE_SECRET` foi copiado para fora do Coolify | Idem |
| A reversão nunca foi ensaiada atravessando uma migração | **Sim**, para V2B-T1 chegar à produção (V2B-T1.6) |
| `deploy/analytics/ops.sql` nunca rodou em produção; sem filtro de período | **Sim**, para V2A-T1 (V2A-T1.2) |
| Deploy automático a cada push no `main` | **Decisão 3** (§0.8) |
| Avisos do Coolify sem canal; e-mail de alerta do GitHub não conferido; NTP do servidor nunca conferido | Não; conferir antes do playtest |
| `LOTG_GAME_URL` e `LOTG_LANDING_URL` da página nunca conferidos em produção | Não; conferir antes de divulgar a página |
| A API é implantada antes do app: uma aba antiga fala com a API nova | Tratado em V2B-T1.5 e V2D-T1.8 (426) |

### 9.3 Verificação

| O que não foi verificado | Bloqueia a v0.2? |
|---|---|
| Firefox e Safari sem evidência; celular e leitor de tela nunca usados | Não; o playtest pede o navegador de cada pessoa; V2F-T2 registra |
| Prova em produção dos 12 critérios da v0.1 por critério | Não; a v0.1 fechou assim por decisão do autor |
| Vínculo GitHub com o GitHub real | Não; segue desligado |
| Expurgo de sete dias em produção (contas do fechamento saem em 2026-10-08) | Não; conferir por `ops.sql` depois dessa data |

---

## 10. O que o MVP ensinou

Lições do Registro de Execução ([MVP-ROADMAP.md §9](../MVP-ROADMAP.md)) e dos ADRs. Não há lição de playtest com outras pessoas: ele não aconteceu.

| # | Lição | Evidência | O que muda na v0.2 |
|---|---|---|---|
| 1 | **A plataforma mudou no meio da Fase 3**, depois de nove tarefas prontas: a extensão do VS Code nunca foi aberta em um editor real | [ADR 0008](decisions/0008-cliente-web-com-aparencia-de-editor.md); Registro F3-T2 a F3-T10 | O autor joga cada fase antes de a seguinte começar (V2C-T7.5, V2D-T5.4, V2E-T5.3); uma decisão de experiência é mostrada na primeira tarefa que a toca (V2D-T3.1) |
| 2 | **Testes em navegador real acharam defeitos que os testes sem DOM não achavam** | Registro F3-T7 e F3W-T2 a F3W-T4 (foco atrasado, `Esc` antes do primeiro quadro, cache no passado) | Toda tarefa com interface tem teste em navegador na "Verificação". Só Chromium é automatizado |
| 3 | **Revisões independentes acharam defeitos reais em toda fase** | Registro F2-T2 (sete defeitos de concorrência), F3-T2 (12), F3W-T6 (3), F3W-T10 (3 médios) | Uma revisão por fase, como tarefa (V2B-T5, V2C-T7, V2D-T5, V2E-T5), por quem não escreveu o código |
| 4 | **Tempo de jogo e tempo real são coisas diferentes, e o GDD mistura os dois** | [ADR 0011](decisions/0011-ritmo-3x-no-mvp.md); "Pós-F4"; [architecture.md §5](architecture.md) | Contrato de relógios (§0.7); decisão 1 fechada antes do código; toda regra com prazo tem teste em ritmo diferente de 1 |
| 5 | **Documento velho custa caro**: documentos de estado anotados com "(Depois: …)" ficaram com dois estados | Registro F0-T5, F1-T11, F2-T6, F3W-T9, F3W-T10; `acceptance-v0.1.md` em `bc807cd` | Documento de estado tem data e é reescrito (V2F-T4.4). O Registro é o único histórico. Fechar uma tarefa inclui procurar o que ela tornou falso |
| 6 | **"Um commit por tarefa" não foi cumprido** | Registro: F1-T2 a F1-T8 em `ad76fd9`; F2-T1 a F2-T7 em `2b20231`; F3W-T1 a F3W-T8 em `8576c02` | Uma mecânica, um commit, também dentro do branch de fase; reverter uma mecânica tem de ser possível |
| 7 | **O que dependia de um ato do autor ficou por fazer até o fim** | Registro F3-T9, F3W-T10, F4-T2 a F4-T4; `acceptance-v0.1.md` sem evidência por critério | Tarefas do autor dizem quem faz cada passo e ficam no começo da fase (V2A-T1, V2B-T0, V2D-T0); o quadro de aceitação é preenchido durante o teste (V2F-T2) |
| 8 | **O simulador avisou, mas ninguém era obrigado a ouvir** (10.000 de madeira parada no 1×, 40.872 no 3×) | Registro F1-T10; V2A-T2.2; README do `sim-cli` | Faixas no ritmo jogado com limite de excedente (V2B-T4); o bot evolui com cada mecânica (§0.5) |
| 9 | **Dizer "não verificado" funcionou**: as lacunas escritas foram fechadas ou viraram decisão | Registro F0-T5, F3W-T9, F4-T4 | O Registro (§11) tem coluna própria para o que não foi verificado |
| 10 | **Uma dependência entrou sem aprovação, e um segredo apareceu na saída de um comando** | [ADR 0006](decisions/0006-types-node.md); Registro F4-T1 | Dependência nova: ADR aprovado antes de instalar. Comandos de operação nunca imprimem variáveis de produção |

---

## 11. Registro de execução

Preencher ao fechar cada tarefa.

| Tarefa | Data | Commit | Sessões | O que foi feito e desvios | O que não foi verificado |
|---|---|---|---|---|---|
| V2A-T1 | 2026-10-01 | `43b9983` | agente, trilha motor | **Parcial: o playtest não aconteceu.** Só o que não depende de pessoas nem da produção: as consultas de `deploy/analytics/ops.sql` ensaiadas no banco de desenvolvimento, com a janela e a conta do autor por variáveis do `psql` e a consulta nova "Filtro em vigor" (T1.2); a mensagem do convite pronta, sem a página de apresentação (T1.5, T1.6). Ninguém foi convidado e `docs/playtest/relatorio-v0.1.md` não existe. T1.1, T1.3, T1.4 e T1.7 a T1.13 seguem abertas e são do autor. Desvio: `\set` em vez de valores em cada consulta (no Coolify, colar as três linhas antes; sem elas a consulta falha em vez de rodar sem filtro) | As consultas nunca rodaram em produção. O ensaio usou horários sintéticos, não uma partida de vários dias. O caminho para achar o identificador da conta (o app não o mostra em tela nenhuma) foi lido no código, não aberto em um navegador. A mensagem não foi lida por ninguém |
| V2A-T2 | 2026-10-01 | `43b9983` | agente, trilha motor | **Parcial.** T2.2: medição repetida nos ritmos 1 e 3, idêntica à tabela da tarefa, registrada em `docs/balance-v0.2.md` §1 (o relatório de playtest não existe). T2.1 e T2.4 ficaram sem objeto: sem playtest não há P0 nem P1, e nenhum número mudou. T2.3: a decisão 5 foi aplicada por delegação no ADR 0013 ("esperar caps e início automático"), **sem resposta do autor**. T2.5 não se aplica: nada foi publicado | Tudo o que depende do playtest |
| V2B-T0 | 2026-10-01 | `242296b`, `9b1d3e8` | agentes (orquestrador e trilha motor) | **A sessão com o autor não aconteceu.** O ADR 0013 foi escrito com a premissa recomendada de cada decisão e vale "por delegação"; a confirmação, decisão a decisão, está pendente em `pendencias-v0.2.md` (T0.1 e T0.2 sem marca). GDD levado à versão 0.7 (T0.3) e §8 com a coluna "Registro" (T0.4). Desvio: o GDD foi tocado também em §5.3, §14.4, §14.11, §15.2, §15.4, §16 e §18.2, uma frase cada, onde a decisão deixaria o texto contraditório | O Prettier não confere Markdown (`.prettierignore` tem `*.md`); links e colunas foram conferidos por script, a renderização não. Dúvidas de regra que os ADRs não fecham: experiência do ofício com menos trabalhadores que o nível, duração do festival, frio e moral no mesmo instante ou na virada |
| V2B-T1 | 2026-10-01 | `43580ca` (motor e servidor), `6d14b6d` (cache do app) | agentes, trilhas motor e app | `migrateState(stored, { timeScale })`, `CURRENT_SCHEMA_VERSION` (2) e `StateMigrationError` no motor; um arquivo por versão em `migrations/`; seis retratos `state-v1-*.json` congelados com impressão digital e os da versão atual como goldens. O servidor migra sob o lock (`loadGame`), grava na escrita seguinte com um incremento de `state_version`, e recusa versão futura ou forma estranha com 500 sem gravar por cima. O app marca o cache com `CACHE_VERSION`. Golden do cenário de 7 dias regravado; o diff só tem os campos da versão 2. Desvios: guarda de forma escrita à mão em vez de zod; `difficulty` e `timeScale` dentro de `settings` (GDD §14.11 corrigido); o teste de integração avança 21 dias, não 30 (a sessão de teste vale 30); regra nova: uma versão de estado por tarefa que muda a forma | **O ensaio de reversão com duas imagens não foi feito** (T1.6 sem marca). Nenhum estado de produção foi usado: só retratos do motor da v0.1 e três partidas de desenvolvimento. O servidor inteiro da `v0.1.0` diante de um estado da versão 2 não foi rodado, só o motor. Dois ramos defensivos de `migrateState` sem teste. App novo contra API ainda na v0.1 (visão sem `difficultyLabel`) não foi exercitado |
| V2B-T2 | 2026-10-01 | `363a2a7` | agente, trilha motor | `packages/engine/src/random.ts`: xoshiro128\*\* com fluxos nomeados (`council`, `morale`, `horde`), semente por FNV-1a mais SplitMix32, `nextInt`, `chance` e `pickWeighted` internos ao pacote, `RNG_VERSION = 1`. Vetores de referência gravados; divisão de intervalo provada com um evento sintético que sorteia. `advance.ts` ganhou `advanceWith` para a prova usar o laço real. A forma do estado não mudou (`rng` continua `Record<string, number[]>`, vazio até o primeiro sorteio). Decisão do agente: toda chamada que devolve valor gasta o fluxo, mesmo em certeza | Nenhuma regra sorteia ainda: a prova usa o evento sintético. Os vetores do SplitMix32 são próprios, não comparados com fonte externa. Integração não rodada na tarefa (rodou na integração da fase) |
| V2B-T3 | 2026-10-01 | `02863a4` (motor), `01d53f6` e `6d14b6d` (app) | agentes, trilhas motor e app | `balance.difficulties` e `balance.paces` no conteúdo; `POST /games` aceita `difficulty` e `timeScale` (inválido é 400, sem os campos valem Senhor e `GAME_TIME_SCALE`); `GET /v1/catalog` novo, com ETag; `settlement.difficulty`, `difficultyLabel` e `paceLabel` na visão; `client.catalog()`; `--difficulty` no simulador. No app: dois grupos de opções nas boas-vindas, duas listas em "Nova partida", linha nas Preferências. No caminho, um defeito corrigido: `F1` logo ao abrir a página deixava a paleta sem aparecer (`useLayoutEffect` nas assinaturas). Desvios: sem `cardAutoResolve` (ADR 0014); `hint` e `recommended` a mais; ETag do catálogo pelo corpo inteiro; boas-vindas mais largas (720 px) e botão "Nova partida…" nas Preferências, que o roadmap não pedia | **As frases de dificuldade e de ritmo foram escritas pelo agente e não foram lidas pelo autor.** Só Chromium; leitor de tela não usado. Catálogo com o padrão da produção (3) só em unidade. Cache HTTP de `/catalog` em navegador de verdade. `pnpm capture:landing` não foi rodado |
| V2B-T4 | 2026-10-01 | `35710b9` (motor), `b56949d` (app) | agentes, trilhas motor e app | `pnpm -s sim -- --matrix`: 3 perfis × 3 ritmos × 50 sementes, duas tabelas (7 dias reais e um ano de jogo), colunas novas e reservadas no CSV, faixas por ritmo em `bands.ts`, bots como listas de políticas, bot `preguicoso`. A matriz inteira roda no `pnpm test` (cerca de 2 s). No navegador, dois cenários no ritmo Rápido conferem prazos e taxas da tela contra a API. Nenhum número de conteúdo mudou. Desvios: as faixas são os valores medidos com folga, não limites do autor; `contentHash` virou função de `@lotg/protocol`; o segundo cenário de navegador (Relatório de Retorno no ritmo 3) não estava pedido | **Nenhuma faixa foi aprovada pelo autor**; fila ociosa e aldeões sem ofício são medidos, sem faixa. As 50 sementes dão hoje o mesmo resultado, porque nada sorteia. `--remote` com o bot `preguicoso` não foi rodado. A meta do GDD §15.2 (30 a 40 habitantes no dia 7) não é atingida no ritmo 1: a medida é 26 |
| V2B (integração) | 2026-10-01 | `98a85b6` e o commit deste registro | agente de integração | Trilha do app (`web-track`) mesclada ao `main` sem conflito. Portão no resultado: `pnpm verify` (1.613 testes de unidade em 60 arquivos), integração (358 em 13), `pnpm build`, navegador (56 de 56) e os dois cenários "ritmo" com `GAME_TIME_SCALE=3`. Nada quebrou. Corrigido nos documentos: o filtro de um arquivo de integração é `pnpm test:integration games`, sem `--` (com `--` o Vitest ignora o filtro e roda tudo). Apêndice B atualizado com o que a fase mudou. **O autor não jogou nem aprovou nada desta fase; nada foi publicado** | `pnpm test:e2e:landing` e `pnpm capture:landing` não foram rodados (a página de apresentação não mudou; as boas-vindas ficaram mais largas e o roteiro de captura passa por elas). `CLAUDE.md`, reservado ao orquestrador, ficou desatualizado: GDD v0.6, API pública do motor sem `migrateState`, "ainda não existe gerador", `GAME_TIME_SCALE` como ritmo de toda partida nova e o filtro de integração com `--` |
| V2B-T5 | | | | | |
| V2C-T1 | 2026-10-02 | `642dc9a` (motor), `7b69129` (app) | agentes, trilhas motor e app | Estações com efeito: `balance.calendar.seasons[].effects` e `winter.cold` no conteúdo; a produção virou uma conta só em frações (`productionFactors`), com um arredondamento no fim; obra iniciada no inverno × 1,5 e recrutamento ordenado na primavera × 0,8, com o prazo fixado no início; a lenha entra no saldo da madeira e o instante em que ela acaba abre o frio (`settlement.cold`, `coldStarted`, `coldEnded`). Estado na versão 3. Na visão: `calendar.seasonEffects`, `calendar.nextSeason`, `winter`, `durationNote`. No app: o que a estação muda no cabeçalho, a conta da lenha à vista no outono e no inverno, aviso de frio com ícone próprio, Lareira na árvore, barra de status. Bot: `guardar lenha`. **Golden regravado e lido:** toda partida nasce na primavera, então o começo do jogo mudou (comida × 1,2, recruta em 16 min; no ritmo 1 o Regular vai de 26 para 34 aldeões em 7 dias). Desvios: a lenha é fração, não `number`; `settleFamine` virou `settleScarcity`; `advanceTo` acomoda fome e frio antes de o tempo andar (uma partida migrada no inverno sem madeira abre o frio na fronteira); a visão tem campos além do Apêndice B; o fim da fome passou a avisar como alívio; "madeira acaba em" só aparece quando a lenha não chega até a primavera | **Nenhum bot da matriz passa frio**: a madeira sobra, e não há medida do que o frio custa a um feudo jogado; ele só está provado nos testes do motor, do servidor e em um cenário de navegador. O fim do frio pela primavera não foi exercitado em navegador; fome e frio juntos, só sem DOM. A nota de prazo quando o teto de 8 h absorve o fator (nenhuma obra do conteúdo chega ao teto). Tema escuro no inverno não foi olhado em captura. Leitor de tela não usado; só Chromium |
| V2C-T2 | 2026-10-02 | `0a97310` (motor), `c762177` (app) | agentes, trilhas motor e app | O estoque de comida, madeira e pedra para no limite (`balance.storage`: 500 iniciais; 900 mais 600 por nível do depósito; vezes o fator da dificuldade), o excedente é desperdício contado (`settlement.wasted`, `stats.wasted_*`, `storageFilled` uma vez por episódio, `storageWasted` por dia de jogo), e o Celeiro e o Armazém existem (nível 0, Salão Nv2). Recusa nova `EXCEEDS_STORAGE`. Objetivo 4 com a recompensa "desbloqueia o Celeiro e o Armazém". Estado na versão 4. **Auditoria de alcançabilidade** ([balance-v0.2.md](balance-v0.2.md) §4.1): nenhuma trava até o Salão Nv4 e os depósitos Nv2, nas três dificuldades; travas de fim de jogo em Senhor (o Salão 7→8 pede 5.102 de madeira e o Armazém Nv8 guarda 5.100) e em Rei de Ferro (o Armazém para no Nv7), sem mexer em número. No app: Cap com explicação, "cheio em" com alerta abaixo de 8 h, aviso do depósito com o custo e o botão da obra ao lado, listas "Melhorar" e "Construir", cancelamento dizendo o que se perderia, Relatório com produção, gasto, recebido e perdido. Bot: `ampliar o estoque`. Desvios: **a Torre de Vigia não entrou** (V2E-T1); **ADR 0015, novo e decidido pelo agente**: o fecho diário do desperdício fica fora da Crônica; `balance.initial.buildingLevel` saiu; a tabela mantém as colunas Estoque e Cap; o roteiro do golden de 7 dias ganhou ordens para passar por depósito, desperdício e frio | A meta do GDD §15.2 (nenhum recurso desperdiçando por mais de 8 h de jogo, perfil Regular) estava longe ao fim da tarefa: 136 de 168 h com depósito cheio no ritmo 1. A migração 3 → 4 só foi provada com retratos e com linhas do banco de teste. `EXCEEDS_STORAGE` e o estoque herdado acima do limite não têm cenário em navegador. Camponês e Rei de Ferro foram medidos com uma semente, sem faixa. As partidas do banco de desenvolvimento não foram conferidas depois da migração |
| V2C-T5 | 2026-10-02 | `edd3b04` (motor), `2bb72f7` (app) | agentes, trilhas motor e app | Segunda fila com o Salão Nv4 (`construction.queues: 2`, `secondQueueTownHallLevel: 4`) e planejadas automáticas: estado na versão 5 (`constructionQueues` sempre com duas posições, `planned[].autoStart`), comandos `planConstruction { autoStart? }` e `setAutoStart`, recusas `QUEUE_LOCKED` e `NOT_PLANNED`, `settlePlanned` e `nextAutoStartAt` (o instante exato em que a produção completa o custo), evento `constructionAutoStarted`. Na visão: `queues`, `queuesUnlocked`, `queuesNote`, `planned[].waiting`. No app: uma linha por fila, a caixa "Iniciar quando houver recursos" (só muda com a confirmação do servidor), a linha de espera com a ação, o grupo "Planejadas" na árvore e a pergunta na paleta. Bot: `planejar automáticas`. **Simulador, 1 visita por dia, 7 dias reais:** a fila ociosa com obra planejada cai de 168 h para 0 h nos três ritmos; contando qualquer obra, para 35 h (1×), 67 h (0,5×) e 91 h (3×), porque o jogo aceita uma planejada por edifício. Desvios: **a ordem dos bots mudou** (obras antes de `recrutar`) para tirar 6 h reais de fome do Regular no ritmo 3, contra a regra "o ajuste é nos números, nunca no bot" (as duas medições estão em balance-v0.2.md §5.5); `waiting` pode ser `null` e o `text` não leva o prazo; `QUEUE_BUSY` ficou só para as duas filas ocupadas; no app, o botão "Iniciar agora" e a leitura do servidor no instante do `etaSeconds`, que o roadmap não pedia | **As duas filas abertas não foram exercitadas em navegador contra o servidor** (só motor, servidor e sem DOM). Nenhuma linha gravada em `schema_version = 4` foi lida do banco em teste. `--remote` e `--smoke` não rodaram com a política nova. A cadeia "obra automática → objetivo → recompensa → outra obra" dentro de `advanceTo` não acontece com o conteúdo de hoje. **Balanceamento por decidir:** no ritmo Rápido, Regular e Dedicado chegam em 7 dias reais ao Salão Nv7, o teto alcançável em Senhor; no ritmo Normal a população do dia 7 mede 45, acima dos 30 a 40 do GDD §15.2. Nenhuma pessoa usou as planejadas automáticas |
| V2C-T3 | 2026-10-02 | `cfb5434` (motor), `d9be8f1` (app) | agentes, trilhas motor e app | Troca de ofício e experiência (`balance.craft`, `craftGuilds`): estado na versão 6 (`adaptation` em coortes, `craftExperience`, `craftMasteredYear`); quem chega a um edifício rende metade por um dia de jogo, quem sai é tirado das levas mais novas, e o fim de cada leva é evento da linha do tempo, sem linha na Crônica; a experiência conta na virada do dia e vira mestria na conta única da produção; `craftMastered` uma vez por edifício e por ano; `releaseExcessWorkers`. Na visão: `workersRules` e os campos novos de `workers[]`; as previsões ("cheio em", "acaba em", a espera das planejadas, a conta da lenha) passaram a contar com o fim da adaptação (`craftForecast`). No app: o custo da troca à vista antes do clique ("+1 aqui: +4/h agora, +8/h depois de 2 h"), a experiência com barra, a prévia a cada tecla na lista de alocação. **Critério 5 da §16.2** provado por unidade e em navegador. Bot: não refaz a alocação a cada visita. Desvios: `craftMasteredYear` além do Apêndice B; quem nunca teve ofício também se adapta; com gente, mas menos do que o nível pede, a experiência não sobe nem cai; **o bot ganhou "plantar para crescer", além do pedido** (Regular no ritmo 1: de 45 para 68 aldeões em 7 dias; balance-v0.2.md §6.4 separa o efeito da mecânica do efeito do bot); `previewAllocation` repete no app a ordem de saída do motor, só para a prévia, com um teste em navegador que a compara com o servidor | A matriz em Camponês e em Rei de Ferro não foi rodada de novo. Carga contra servidor não medida (a visão ficou mais cara: a matriz foi de cerca de 7 s para 11 s). Duas medições de balance-v0.2.md (§6.3 e §6.4) não têm comando que as repita. Várias levas com prazos diferentes no mesmo edifício só têm teste de unidade. Leitor de tela não usado; só Chromium |
| V2C-T4 | 2026-10-02 | `ef6ff0d` (motor), `d9ea930` (app) | agentes, trilhas motor e app | Moral de 0 a 100 (`balance.morale`): estado na versão 7 (`settlement.morale`, `settlement.moraleEffects`); recalculada na virada do dia (`moraleTurn.ts`: experiência, recálculo, sorteio do colono, sorteio da partida, deserção por fome), fator `(150 + moral) / 200` na conta única da produção, piso de 3 aldeões, eventos `moraleBandChanged`, `villagerArrived`, `villagerLeft` e `villagerDeserted`. **É a primeira regra que sorteia** (fluxo `morale`), com a divisão de intervalo provada com os sorteios no caminho. Na visão, `morale` traz a conta **da próxima virada**, exata (uma propriedade confere em 500 feudos), e `recruitment.moraleNote`. O feudo empobrecido (fome, frio, moral 0, 3 aldeões) se refaz em um dia de jogo, em Senhor e em Rei de Ferro. No app: moral e faixa no cabeçalho, painel "Moral" termo a termo, linha na árvore, avisos, Relatório com quem chegou e quem se foi; na fome, um segundo aviso anuncia a deserção antes de ela acontecer. Bot: deixa uma cama vazia a partir de 20 aldeões. Desvios: os efeitos temporários ficam em `settlement.moraleEffects`, não em `council.effects`; `foodReserve { coverMs, bonus }` no lugar de `foodCovers24h`; a política de manter a despensa foi medida e não entrou no bot; o roteiro do golden de 7 dias mudou (com a deserção, o antigo levava o feudo de 22 a 3 aldeões); o frio aberto não conta na virada para a primavera | **Sem os efeitos temporários a moral vai de 0 a 60**: a faixa Orgulhoso e o colono só são exercitados com efeitos gravados à mão nos testes, e ficam inalcançáveis no jogo até V2D-T1 e V2E-T4. A deserção é rápida no ritmo 3 (4 h reais de carência, depois um aldeão a cada 40 min): é o GDD §5.6 ao pé da letra, contra a regra 5 do §15.1, e ninguém decidiu. A migração 6 → 7 só foi provada com retratos e pelo servidor de teste. As comparações de política do bot usaram 3 sementes e variantes que não ficaram no código. O `:has()` do cabeçalho só foi visto em Chromium. Leitor de tela não usado |
| V2C-T6 | 2026-10-02 | `c744dc3` | agente, trilha app | Só interface, sem campo novo no motor nem no protocolo. `beforeLeaving(view)` (`packages/web/src/game/beforeLeaving.ts`) devolve até cinco itens, cada um com o botão que resolve: comida, lenha, depósitos, obras que não começam sozinhas, aldeões livres; a seção "Antes de partir" fica na aba Hoje, abaixo do Relatório ou no topo. Aviso de estação uma hora real antes ("Inverno à vista: chega em 59 min, às 21:40.", com as frases de `nextSeason.changes`) e de novo na virada, um por virada (`seasonWarned`). Barra de status e título da aba: decisões pendentes, fome e frio, depósito cheio ou a menos de 8 h, obra. A árvore diz "2 a preparar" ou "pronto para a ausência". Desvios: todo item tem comando obrigatório, com rótulo; a lista também diz a fome e o frio em andamento, a planejada automática travada e a obra que termina sem nada depois (senão a tela diria "preparado" com o feudo passando fome); os textos diferem dos exemplos do roadmap (sem o artigo da estação, com a hora do relógio do navegador, com `firewood.missing` no lugar de "o estoque dura"); o título da aba passou a repetir o assunto da barra | **`pnpm capture:landing` não foi rodado**: as capturas da página de apresentação estão velhas desde V2C-T1 e ficam para V2F-T4.2. A prioridade "decisões pendentes" só tem teste de unidade com lista forjada (`pendingDecisions` é vazio até V2D-T1). O aviso de estação no ritmo Rápido não foi exercitado em navegador. O aviso de uma hora antes saindo de cena na virada só tem teste de unidade. Leitor de tela não usado; só Chromium |
| V2C (integração) | 2026-10-02 | `080599a` e o commit deste registro | agente de integração | Trilha do app (`web-track`) mesclada ao `main` sem conflito: ela já trazia o `main` inteiro. Portão no resultado: `pnpm verify` (3.079 testes de unidade em 70 arquivos), integração (405 em 18), `pnpm build`, navegador (67 de 67), os três cenários "ritmo" com `GAME_TIME_SCALE=3` e, por garantia, `pnpm test:e2e:landing` (37 passaram, 7 pulados). Nada quebrou. As caixas de V2C-T1 a V2C-T6 foram marcadas depois de conferir no código os nomes, os testes e os cenários de navegador que cada trilha declarou; o Apêndice B passou a dizer o que a fase entregou. No README do app, uma frase corrigida (a nota de prazo fica acima das listas "Melhorar" e "Construir"). **O autor não jogou nem aprovou nada desta fase; nada foi publicado; V2C-T7 (revisão independente, rodada de balanceamento e o autor jogando) não foi feita** | `pnpm capture:landing` não foi rodado: a página de apresentação mostra a aba Feudo de antes da Fase C. Tudo rodou em Node 24.19.0, e o repositório pede o 22 (`.nvmrc`), que é o da CI. Uma aba antiga diante do servidor novo não foi exercitada: em produção o app não valida as respostas (`validateResponses` só vale em desenvolvimento), então ela deve ler a visão nova sem erro, mas ninguém viu. Nenhum estado de produção passou pelas migrações 3 a 7. `CLAUDE.md`, reservado ao orquestrador, ficou desatualizado: estado na versão 7, `settleFamine` (hoje `settleScarcity` e `settlePlanned`), a ordem do mesmo instante (faltam o fim de adaptação, as planejadas e o frio), "nenhuma regra sorteia" (a moral sorteia), a lista de mecânicas proibidas no estado (moral já existe) e o ciclo de leitura do app (lê antes dos 30 s quando uma obra, uma espera ou uma adaptação termina) |
| V2C-T7 | | | | | |
| V2D-T0 | 2026-10-01 | `242296b`, `9b1d3e8` | agentes (orquestrador e trilha motor) | Feita junto com V2B-T0, **sem a sessão com o autor**: ADR 0014 escrito com as premissas, "aplicado por delegação"; GDD §7, §8.2 e §12.2 corrigidos; §8 atualizada (T0.2). T0.1 sem marca | A confirmação do autor, decisão a decisão; o texto das cartas ainda não existe |
| V2D-T1 | 2026-10-02 | `be6ef31` (conteúdo), `08e14a2` (motor, protocolo e servidor) | agente, trilha motor | O motor do Conselho: estado na versão 8 (`council { pending, flags, seenThisYear, nextDrawAtMs, scheduled, delayed, expired }`), sorteio no fluxo `council` na virada do dia, depois da moral, com cadência ancorada de 4 dias de jogo e no máximo 2 cartas à espera; expiração em 24 h reais × ritmo, com a opção marcada para a dificuldade; efeito escondido N viradas depois, como `cardEffectApplied`; comando `answerCard` com as recusas `CARD_NOT_PENDING`, `CARD_EXPIRED`, `INVALID_OPTION` e `OPTION_LOCKED`; `ViewState.council` e `pendingDecisions`; **protocolo 2**, com 426 para o cliente do protocolo 1. Bot: `responder a carta`. Golden de 7 dias regravado e lido: passa pelo Conselho inteiro sem mudar o resultado das ordens antigas. Desvios: schemas em `schemas.ts`; `hidden: { afterDays, effects, chronicle }` no lugar de `hiddenEffects`; `delayed`, `expired` e `origin` além do Apêndice B; a primeira audiência de uma partida migrada cai na virada de dia seguinte a fronteira + 4 dias; o 426 é decidido por `X-Lords-Protocol`, não por `X-Lords-Client`; cinco cartas de verdade no lugar de duas de teste. **A regra "as mesmas ordens dão o mesmo feudo em qualquer ritmo" deixa de valer quando uma carta expira** (o prazo é de relógio): consequência da decisão 1 do ADR 0014. O ADR 0014 ganhou a seção "Detalhes fechados na implementação", com decisões do agente à espera do autor | A migração 7 → 8 só foi provada com retratos e com uma linha no banco de teste. No ritmo Normal a carta sem resposta expira em cima de uma audiência, e essa audiência é pulada (o sorteio vem antes da expiração): ninguém decidiu se é a ordem certa. A matriz do simulador não exercita expiração, efeito escondido nem cadeia. Ao fim da tarefa, em Rei de Ferro, ritmo Normal e perfil Regular, metade das sementes deixava a madeira 9 h de jogo no limite (a meta do GDD é 8); a medida mudou nas tarefas seguintes |
| V2D-T2 | 2026-10-02 | `7aa808a`; a cadeia da Paliçada em `c6a67a5` (V2E-T2) | agente, trilha motor | O primeiro lote: **21 cartas**, em três cadeias de três ("O Celeiro Comum", "A Ponte do Degelo", "A Promessa da Paliçada") e 12 avulsas (4 recorrentes, com uma ronda de flags `routine.*` para a mesma não sair duas vezes seguidas, e 8 de uma vez por ano). `docs/content-v0.2.md` tem a ficha de cada uma, um cenário bom e um ruim por opção, a cobertura medida e os limites. `council.chains.test.ts` percorre as cadeias em todas as ramificações (aceitar, recusar, expirar nas três dificuldades); `council.coverage.test.ts` garante ao menos 3 cartas elegíveis em qualquer audiência. Com as cartas a moral 80 ficou alcançável: 40 de 50 sementes chegam lá no ritmo Normal. Bot: paga a opção mais cara que cabe com folga; o preguiçoso responde sem gastar. **Regra editorial decidida pelo agente:** em Camponês e Senhor a opção automática de uma carta do sorteio nunca tira recurso nem moral; com isso as duas dificuldades decidem igual em todas as cartas, e só Rei de Ferro se distingue. Desvios da §12.2: números da cadeia do Celeiro (continuação em 2 dias, moral por 3); "Mais bocas à mesa" não traz aldeão, "A mesa dos aprendizes" não dá experiência do ofício e "Um teto antes do frio" não é promessa com prazo, porque o ADR 0014 fecha a lista de efeitos. T2.2 e T2.7 sem marca | **Nenhuma carta foi lida nem aprovada pelo autor, e ninguém jogou o lote**: texto, custo, pista e tom só foram conferidos pelo agente e pelos testes de forma. O conteúdo não foi congelado (mudou nas três tarefas seguintes). O bot não lê a consequência das cartas: a matriz mede a economia com o Conselho ligado, não se os dilemas são bons. A cobertura não foi medida no ritmo Tranquilo nem com 1 visita por dia; no Rápido com 2 visitas o jogador vê cerca de 10 cartas por ano e as do outono saem pouco. O inverno não tem carta própria. Camponês e Rei de Ferro rodam com 3 sementes na suíte |
| V2D-T3 | 2026-10-02 | `192c186` | agente, trilha app | O Conselho na interface, sem campo novo no motor: aba fixa `#/conselho` (`tabs/Council.tsx`), a carta (`components/CouncilCard.tsx`) com o custo, a consequência conhecida, a pista e o que tranca cada opção, o prazo de relógio e o que o conselho faz sozinho. Um caminho só de comando (`lords.answerCard` → `controller.answerCard`, com o mesmo `commandId` no "Tentar de novo"). Árvore, aba Hoje, barra de status, título da aba, badge do Feudo e aviso de carta nova (essencial, com "Decidir" e "Silenciar 2h"). **Critério 2 da §16.2** provado em navegador com o relógio controlado. Fora do pedido: depois de responder, a frase da Crônica da escolha aparece por alguns segundos; o prazo a menos de 8 h ganha sinal de aviso; na lista da paleta vem marcada a opção automática, que nunca custa. Desvios: os outros testes em navegador rodam com o **conselho em recesso** (`/__test/council-recess`), para não dependerem de qual carta a semente tira; com uma carta só, a paleta abre direto as opções; a carta nova não entra no contador de novidades. T3.1 sem marca: o autor não viu a carta antes da tela completa | O clique em uma opção responde na hora, sem confirmação, e a decisão é irreversível: ninguém disse se basta o custo ao lado do botão. A continuação de cadeia na tela (`followsFrom`) só tem teste sem DOM, fora o cenário dos três blocos. Leitor de tela não usado; só Chromium. A letra com serifa da carta é a primeira fonte diferente da interface e não foi vista pelo autor. `pnpm capture:landing` não foi rodado |
| V2D-T4 | 2026-10-02 | `4c70926`, `831c761` | agente, trilha app | O Relatório de Retorno em três blocos (`ReturnReport.blocks`: "O feudo prosperou", "O que exigiu um preço", "Você ainda pode decidir"), montados por `buildBlocks` só com os eventos e a visão; cada perda tem a próxima ação (`costAction`), e os botões são refeitos com a visão de agora. A conta dos estoques ficou abaixo, e "A Crônica da ausência", recolhida. **"Sua escolha voltou":** o servidor escreve, no Markdown da Crônica, uma nota sob a linha da continuação citando a escolha anterior (`games/chronicleMarkdown.ts`, função pura); a aba Crônica mostra a citação e leva o foco à linha citada. **A aba que ficou aberta e fora de vista** por 4 h ou mais conta a ausência (`away`, no cache) e, na volta, mostra um aviso que leva ao relatório. `831c761` corrige uma corrida dos testes (o salto de tempo com uma leitura em voo), não do app. Desvios: o item do bloco tem `topic`, `severity` e `action.label` além do Apêndice B; a trilha do app tocou `packages/server` (aditivo, nenhuma rota nem schema mudou); a linha de contagens e a linha solta de desperdício saíram da aba Hoje; viradas de estação e de ano, ordens de outro navegador e cartas que chegaram ficam só na Crônica da ausência | O descarte de uma aba em segundo plano pelo navegador foi simulado com `visibilitychange` e recarga, não visto de fato. A aba que fica à vista a noite inteira continua sem relatório (limite registrado em `architecture.md`, 6.2). Ausências de vários dias com dezenas de eventos: os blocos não têm limite de linhas, e ninguém mediu a leitura. No bloco pendente a continuação usa a frase do servidor: "Sua escolha voltou" só aparece na Crônica, porque a visão não diz quem decidiu. Leitor de tela não usado; só Chromium |
| V2D-T5 | | | | | |
| V2E-T1 | 2026-10-02 | `ed84a24` (motor), `2cb74b5` (app) | agentes, trilhas motor e app | A Torre de Vigia (nível 0, Salão Nv2, até o nível 2), o Covil de Lobos como tile sem mapa (`tiles.ts`) e a Ameaça, de 0 a 100: +5 por tile ativo e +3 por dia de outono, na virada do dia, depois do Conselho. Estado na versão 9 (`map { tiles, threat }`, `horde { scheduledRaids }`). **Névoa de informação:** `ViewState.threat` é uma união fechada; sem Torre só saem a frase, a Torre e a defesa, e o schema recusa o resto. `threatRose` (ao cruzar 40 e 70) só é emitido para quem tem a Torre. O objetivo 4 passou a liberar também a Torre. No app: painel "Ameaça" na aba Feudo, linha na árvore com o botão da obra, aviso do relato dos vigias. Bot: `erguer a Torre`. Desvios: união por `known` em vez de campos opcionais; nomes de conteúdo ajustados; `raidAnnounced` ficou para V2E-T3; sem Torre os tiles também ficam escondidos; o roteiro do golden de 7 dias mudou (a Torre é erguida às 25 h) | Em navegador a Torre só é erguida no ritmo 1 e até o nível 1; `threat.incoming` só existia com estado montado à mão até V2E-T3. A migração 8 → 9 só foi provada com retratos e com o banco de teste. As causas de duas variações da matriz não foram investigadas semente a semente. O painel fica abaixo da dobra em 1280×800 e a Ameaça não está no cabeçalho, como o GDD §13.3 desenha. Leitor de tela não usado; só Chromium |
| V2E-T2 | 2026-10-02 | `c6a67a5` (motor), `aadf88a` (app, junto com V2E-T3) | agentes, trilhas motor e app | A Paliçada (nível 0, Salão Nv3, 200 madeira e 50 pedra, até o nível 2; `MAX_LEVEL` diz "A Muralha de Pedra chega em uma versão futura."). Estado na versão 10. A regra inteira é `palisadeAgainst(nível, tamanho)`: aberta, segura ou rompida pela metade (`balance.threat.palisadeLevels`, `palisadeBreach`). `threat.defense` explica o que o nível segura, com ou sem Torre, e `incoming.defenseText` diz se a obra em curso fica pronta antes do ataque. Com ela entrou a cadeia "A Promessa da Paliçada" (três cartas). **Acréscimo do agente à decisão 9 do ADR 0014:** a marca `autoResolveIfUnlocked`; com a Paliçada de pé, o conselho mostra a obra por quem prometeu e não voltou, em vez de cobrar −15 de moral com uma Crônica falsa. No app: a caixa da defesa com a obra ao lado. Desvios: os níveis ficam em `balance.threat`, não em `buildings.ts`; `threat.defense` ganhou `building` e `next`; dois testes do simulador afrouxados, com o motivo escrito neles | A obra real da Paliçada (Salão Nv3) não é jogada em navegador: os cenários a põem no nível pelo servidor de teste. A cadeia da Paliçada não é percorrida pelo simulador (o bot sempre recusa a promessa). O pedido "os aldeões pedem uma cerca" pode chegar a quem já tem a Paliçada, e volta todo ano a quem recusa. Nenhuma pessoa leu as três cartas |
| V2E-T3 | 2026-10-02 | `b4bf6c1` (motor), `aadf88a` (app) | agentes, trilhas motor e app | As incursões de lobos: estado na versão 11 (`settlement.injured`), `raids.ts` e `hordeTurn.ts`. Os uivos no início do 10º dia e a incursão leve do roteiro no início do 16º, só no ano 1; depois, o sorteio no fluxo `horde` a cada virada (chance Ameaça − 40 %, leve abaixo de 60, marcada para 6 h de jogo depois, uma por vez). A Torre avisa pelo nível que tem (`raidAnnounced`, `threat.incoming`); a Paliçada suficiente repele; senão, perda de 10% ou 15% de comida e madeira, feridos por um dia de jogo, −10 de moral por 2 dias, e a frase diz o que teria evitado. Toda incursão baixa a Ameaça em 10. **Critério 4 da §16.2** provado por integração (`raids.test.ts`) e em navegador; a matriz QA-10 (Torre 0/1/2 × Paliçada 0/1/2) passa. No app: alarme, barra de status, feridos no cabeçalho e nos ofícios, a incursão em "custou" ou "prosperou" do Relatório, a coluna "Levado". Bot: `erguer a Paliçada`. Desvios: o ferido guarda o ofício e volta a ele sozinho; a recuperação roda antes do calendário; `raided_<recurso>` nos eventos; campos de visão além dos pedidos (`raidChancePercent`, `raidRisk`, `raidCosts`, `incoming.costText`, `population.injuredNote`); os testes em navegador rodam com a **Horda calada** por padrão (`/__test/horde-quiet`) | **O "pronto quando" não foi atingido em um ponto: a Ameaça não oscila.** Com a queda de 10 por incursão ela sobe até 90 a 100 e fica; depois da incursão do roteiro, 97% das incursões são médias, e um feudo sem Paliçada sofre cerca de 16 por ano de jogo (uma a cada 3 h 20 reais no ritmo Rápido). O nível 1 da Paliçada quase só corta pela metade. Nenhum número foi mudado; as alternativas medidas estão em `balance-v0.2.md`, seção 14.4, e vão para V2F-T1. Uma incursão sofrida gera de 3 a 6 linhas na Crônica. Incursões médias e a Torre Nv2 não têm cenário em navegador. Ninguém jogou: se a frequência diverte ou cansa só foi medido com bots |
| V2E-T4 | 2026-10-02 | `35d1021` (motor), `8bc28b9` (app) | agentes, trilhas motor e app | Os objetivos 5 a 10 (`buildWatchtower`, `answerFirstCard`, `buildGranaryOrWarehouse`, `planAutoStart`, `buildPalisade`, `surviveWinterWithoutCold`), com os prêmios do ADR 0014 e as condições `anyBuildingLevel`, `cardAnswered`, `plannedAutoStart` e `seasonSurvived`. O prêmio em moral é um efeito passageiro. `objectives[]` ganhou `missing` (o que falta agora) e `target` (onde se cumpre). Uma partida migrada com o objetivo 4 concluído recebe os seguintes na fronteira, sem prêmio repetido, e o que já estava feito conta ali. No app: os objetivos em aberto no painel, na aba Hoje e na árvore, cada um com o botão que leva até lá; vários cumpridos de uma vez viram uma linha do Relatório e um aviso só. Um cenário roteirizado conclui os dez na ordem, em partida nova e na migrada, e o teclado percorre os dez em navegador. Bot: `seguir os objetivos`; Regular e Dedicado concluem os dez em um ano de jogo, em toda semente. Desvios: `missing`, `target` e `anyBuildingLevel` além do roadmap; sem subir a versão do estado (contadores em `stats`); `evaluateObjectives` reavalia o que acaba de revelar; os cumpridos ficam recolhidos no painel, e não com ☑ como no GDD §13.3 | **O objetivo 5 pede a Torre (50 de ouro) antes de o jogador ter motivo para pôr gente na Mina:** o bot Preguiçoso, que nunca realoca, termina o ano do ritmo Normal com o Salão um nível abaixo na maioria das sementes. Nada foi mudado; vai para V2F-T1. O objetivo 10 leva um ano de jogo, e depois dele a lista acaba. Os dois bots seguem os objetivos sempre: a matriz deixou de medir quem os ignora. Uma partida migrada da v0.1 não foi aberta em navegador. As frases dos objetivos são do agente |
| V2DE (integração) | 2026-10-02 | `391f3b9` e o commit deste registro | agente de integração | Trilha do app (`web-track`) mesclada ao `main` sem conflito: ela já trazia o `main` inteiro. Portão no resultado: `pnpm verify` (4.772 testes de unidade em 93 arquivos), integração (452 em 23), `pnpm build`, navegador (90 de 90), os quatro cenários "no ritmo da produção" com `GAME_TIME_SCALE=3` e, por garantia, `pnpm test:e2e:landing` (37 passaram, 7 pulados). Nada quebrou. As caixas de V2D-T1 a V2D-T4 e de V2E-T1 a V2E-T4 foram marcadas depois de conferir no código os nomes, os testes e os cenários que cada trilha declarou; ficaram sem marca V2D-T2.2 e V2D-T3.1 (dependiam do autor) e V2D-T2.7 (o conteúdo não foi congelado). O Apêndice B passou a dizer o que as duas fases entregaram. Em `architecture.md`, quatro linhas que a v0.2 tornou falsas foram corrigidas, entre elas o limite do Relatório para a aba que fica aberta (V2E-T3.6). **O autor não jogou nem aprovou nada destas fases; nada delas foi publicado (`origin/main` está em `b2667de`, o fim da Fase C); V2D-T5 e V2E-T5 (as revisões independentes e o autor jogando) não foram feitas.** O estado está na versão 11 e o conteúdo é `10164e0ffb6b06e8` | `pnpm capture:landing` não foi rodado: a página de apresentação mostra a bancada de antes das Fases C, D e E (sem a aba Conselho, a Ameaça, os feridos e os objetivos novos). Tudo rodou em Node 24.19.0, e o repositório pede o 22 (`.nvmrc`), que é o da CI. Uma aba do protocolo 1 diante do servidor novo só foi vista pelo teste do 426. Nenhum estado de produção passou pelas migrações 8 a 11, as destas fases. As imagens Docker não foram construídas. `CLAUDE.md`, reservado ao orquestrador, continua desatualizado: além do que a linha da Fase C lista, faltam o Conselho, a Ameaça e as incursões na ordem do mesmo instante, o protocolo 2, o estado na versão 11, as rotas `/__test` novas e o conselho em recesso e a Horda calada nos testes em navegador |
| V2E-T5 | | | | | |
| V2F-T1 | | | | | |
| V2F-T2 | 2026-10-02 | o commit "V2F-T2: …" (quadro e roteiro) e o deste registro | agente, trilha de documentos | **Fechamento enxuto, a pedido do autor: só os documentos.** [acceptance-v0.2.md](acceptance-v0.2.md) com os seis critérios e QA-01 a QA-16, cada um com os testes que o provam (arquivo e nome, conferidos com `grep` em `b1b892a`), o que eles não cobrem e a evidência manual vazia; [manual-test-v0.2.md](manual-test-v0.2.md) com seis jornadas para o autor jogar em desenvolvimento e dois jeitos de adiantar o tempo. T2.1 marcada; T2.2 a T2.5 sem marca. Achado ao escrever: às 23:21 UTC `GET /v1/version` em produção respondia `protocol: 1` e `builtAt` 15:19 UTC, a Fase C; as Fases D e E, enviadas às 23:04 UTC, não estavam implantadas. Desvio: os testes cujo nome cita números da Ameaça não entraram no quadro, porque a V2F-T1 os revia ao mesmo tempo | **Nenhum critério tem evidência manual, nenhuma jornada foi executada e nenhum navegador além do Chromium dos testes foi usado** (T2.2 a T2.4). Os comandos do roteiro (o atalho no banco, o servidor de teste, o retrato da v0.1, o atalho do relatório no console) não foram rodados por quem os escreveu. Não há release candidata nem conferência da CI do commit publicado (T2.5). As suítes não foram rodadas de novo: os números do quadro são os da integração das Fases D e E. Sem QA de navegador para uma partida migrada (QA-01) e para a virada do ano (QA-12); a reversão (QA-13) nunca foi ensaiada |
| V2F-T3 | | | | | |
| V2F-T4 | 2026-10-02 | os commits "V2F-T4: …" deste registro | agente, trilha de documentos | **Fechamento enxuto: só T4.2 (a parte de documentação), T4.3 e T4.4.** `CHANGELOG.md` com a v0.2 em "[Não lançado]", o efeito nas partidas antigas e os limites; `docs/architecture.md` reescrito como "Arquitetura da v0.2"; `CLAUDE.md` com o estado da v0.2, os comandos novos e as regras que mudaram; `README.md` da raiz sem o que tinha ficado falso; [roadmap-v0.3.md](roadmap-v0.3.md), §11.3, preenchida com as lições desta execução. Os números da Ameaça (subida por dia e queda por incursão) não foram escritos em documento nenhum: a V2F-T1 os revia ao mesmo tempo, e os textos citam o GDD §8.2 e `balance.threat`. T4.1 sem objeto (sem playtest, sem P0 nem P1); T4.5 é do autor (tag e release) | **O playtest (V2F-T3) não aconteceu**, então nenhum P0 ou P1 de pessoas existe para corrigir. **As capturas da página de apresentação não foram refeitas** (`pnpm capture:landing`) e o texto dela não foi revisto contra a v0.2. **A matriz completa do simulador (V2F-T1) não estava registrada** ao escrever: o exemplo do README e os números do `CHANGELOG` são os de `b1b892a` e das rodadas da Fase C. O Prettier não confere Markdown (`*.md` no `.prettierignore`): os documentos não foram vistos em um visualizador, e os links foram conferidos à mão. A CI do commit publicado não foi conferida; `/v1/version` ainda dizia `protocol: 1` |
| V2F-T5 | 2026-10-02 | `d9957d7`; a §11.3 do roadmap da v0.3 nos commits de V2F-T4 | agentes, trilha de documentos | `d9957d7`: [roadmap-v0.3.md](roadmap-v0.3.md) (fases A a G, 30 tarefas, 24 decisões com premissa, a primeira tarefa detalhada, o lote 2 do Conselho, as lições que já se liam) e o convite e o formulário do playtest da v0.2, escritos com a v0.2 pela metade. No fechamento: a §11.3 preenchida (revisões, tipos de defeito repetidos, trilhas e portões, publicação por fase, parada da máquina de madrugada, fechamento enxuto das Fases D e E) e a §11.2 e a §11.4 corrigidas no que tinham ficado falsas. As quatro subtarefas marcadas | Nenhuma decisão da §9 da v0.3 foi respondida, e o plano presume nomes da v0.2 que a V3A-T1 tem de conferir no código. As lições de playtest não existem (não houve). As linhas B, I e J da §11.3 ("o que o autor trocou", "o que ele disse", "o que o playtest disse") ficam por completar quando houver resposta |
| V2G-T1 | 2026-10-05 | o commit `V2G-T1: …` | agente, conferido pela sessão principal | Celeiro e Armazém no nível 1 de 900 para 1.000 e o objetivo 4 de volta com 50 de ouro (ADR 0016, itens 1 e 7). Em Senhor o Salão 8 passa a caber (Armazém Nv8: 5.200 contra 5.102) e os cinco edifícios de produção e moradia chegam ao nível 9; Rei de Ferro não muda de teto. Goldens e os retratos da versão 11 regravados; os das versões 1 a 10 intactos; bots sem mudança. Linha de base do simulador medida de novo nas três dificuldades (`docs/balance-v0.2.md`, seção 18). **Pioras medidas e aceitas como estão:** o Preguiçoso no ritmo Tranquilo perde gente e um nível de Salão (20 aldeões e Salão 3 na semana, eram 26 e Salão 4), porque o bot gasta os 50 de ouro na Fazenda e atrasa a Mina; no ritmo Normal em Senhor uma semente de 50 (`pedra-alta-026`) passa da meta de 8 h de desperdício (9 h); em Rei de Ferro o Regular do Normal fecha a semana com Salão 6 no pior caso (era 7). No golden de 7 dias o frio do inverno começa quatro dias de jogo mais tarde e dura menos, e a expectativa da moral inquieta foi de 152 h para 160 h | Ninguém jogou com os números novos: tudo é bot e teste. A causa da piora do Preguiçoso no Tranquilo é inferência da leitura de uma semente. `pnpm capture:landing` não rodou (fica para V2G-T6.4). O frio do golden de 7 dias é pego pela virada do dia com 12 minutos de folga: frágil a qualquer mudança de número |

---
| V2G-T6 (T6.1 a T6.3) | 2026-10-05 | `3ec85ef` | agente em árvore separada, conferido pela sessão principal | Barra de status e título: fome e frio na frente da decisão pendente (`statusTopic`). Botão da defesa: ordena a Paliçada só quando ela pode começar agora; em qualquer outro caso é "Ver a defesa", que leva ao painel da Ameaça, e nunca mais ordena a Torre (`defenseCommand`, usado por "Antes de partir" e pelo Relatório). Aba Feudo: Objetivos antes do painel da Ameaça. Escolhas do agente: a carta some da barra enquanto há fome ou frio, mas continua no contador do título, no ícone do Feudo, na árvore e na aba do Conselho; a linha "Hoje" da árvore continua com as decisões na frente. Quatro cenários de navegador novos ou alterados; a suíte passou com 95 de 95 junto com a V2G-T1 | A T6.4 (capturas da página de apresentação) fica para o fim da fase. O GDD §13.5 ainda dava a ordem antiga da barra (corrigido em V2G-T7). Só Chromium |
| V2G-T2 | 2026-10-05 | `ffc6b68` | agente, conferido pela sessão principal | Deserção por fome em tempo real (12 h reais de carência, depois um aldeão a cada 2 h reais), cobrada na virada do dia: saem os devidos menos os que já saíram, e o que o piso impediu fica perdoado. A fome que reabre com menos de 2 h reais sem fome continua de onde parou; o tempo sem fome não conta. **Estado na versão 12**: `famine` guarda `carriedMs` e `deserted`, e `lastFamine` lembra a última fome que acabou; nenhum instante novo na linha do tempo. Passo 11 → 12: a partida em fome entra com a contagem que a regra nova teria cobrado na última virada até a fronteira. Medido nos testes: no ritmo 3 a primeira deserção vem entre 12 h reais e 12 h mais um dia de jogo, depois uma a cada três viradas; no 1, uma por virada, como antes; no 0,5, duas por virada. Teste permanente da manobra de C-4 nos três ritmos, pelo motor e pela API. Golden de 7 dias: só a forma do estado. Matriz do simulador idêntica byte a byte. Escolhas do agente: `VIEW_FORMAT` não subiu (a duração da fome na visão passou a incluir o que a fome retomada já tinha durado, o que não desmente nenhuma visão em cache); duas frases novas no painel da moral, com os prazos | Nenhum estado de produção passou pelo passo 11 → 12 antes da publicação: só retratos e estados montados em teste. A matriz não mede a deserção (nenhum bot passa fome). As duas frases novas da moral não foram lidas pelo autor |
| V2G-T3 | 2026-10-05 | `bb7fe6a` | agente, conferido pela sessão principal | Aviso da Torre em tempo real: 1 h real no nível 1 e 2 h reais no nível 2 (`warningRealMs`), convertido pelo ritmo. Sem mudança na forma do estado. Partida em andamento: a incursão já anunciada continua à vista e não se repete; a ainda não anunciada, já dentro da janela nova, é anunciada no primeiro instante processado. O schema do conteúdo confere que o aviso cabe no prazo da incursão em todo ritmo oferecido. Matriz QA-10 nos três ritmos | **No Tranquilo, no inverno, com a Torre Nv1, a obra da Paliçada cabe no aviso sem folga nenhuma** (30 min de jogo de obra para 1 h real de aviso): só quem ordena no instante do alarme chega a tempo. Num ritmo acima de 3, fora dos oferecidos, a antecedência passaria do prazo da incursão. `08-ameaca` em navegador só no ritmo 1 |
| V2G-T4 | 2026-10-05 | `070c7e5`, `cb22cba` | agente em árvore separada; junção e retratos pela sessão principal | Os sete problemas das cartas, com o texto e os números que o autor aprovou um a um (ADR 0016). Nenhum id mudou; nenhum modelo novo. Com as cartas entrando depois da versão 12, os retratos da 11 ficaram congelados com as cartas de antes e cinco da 12 foram regravados (`council`, `storage` e os três de fome, em que o sorteio muda porque duas cartas deixaram de sair com a moral abaixo de 40). Linha de base do simulador medida de novo (`docs/balance-v0.2.md`, seção 20): três células saíram da faixa antiga por uma semente em 50 cada (desperdício do Dedicado no Normal em Senhor, 3 → 5 h; ouro parado do Regular no Tranquilo; desperdício do Dedicado no ano do Rápido em Rei de Ferro, 15 → 18 h). A cobertura do Conselho não perdeu carta | O mesmo desequilíbrio da primavera existe em três cartas de verão e de outono, fora dos sete. O ausente de Rei de Ferro ainda pode sair com mais pedra em feudo pequeno. As tabelas da seção 4.2 de `docs/content-v0.2.md` já estavam velhas e não foram refeitas. Ninguém jogou com os textos novos |
| V2G-T5 | 2026-10-05 | `48d92b2` | agente em árvore separada, conferido pela sessão principal | As três descrições das dificuldades aprovadas pelo autor. Concordância das recusas de obra pelo artigo do edifício no conteúdo: o agente corrigiu cinco frases da mesma tabela, não só as duas citadas | `plannedView.ts` ainda tem "as Habitações já está no nível máximo", texto de espera hoje inalcançável |
| V2G-T6.4 | 2026-10-05 | `3ff0d11`, `1b5fb9d` | agente, conferido pela sessão principal | Capturas da página de apresentação refeitas com a bancada da v0.2: a janela larga passou de 1040 × 480 para 1040 × 720 e a estreita de 480 × 520 para 480 × 780, as cinco regiões e as posições dos rótulos foram refeitas, e o `og.png` regravado. Depois do último commit do motor a captura foi rodada de novo e bate pixel a pixel com as imagens do repositório. **Texto da página:** duas frases que davam estações com efeito e Conselho como futuro foram trocadas, com o antes e o depois aprovados pelo autor | A figura ficou mais alta (não cabe inteira em uma tela de 720 px de altura) e mais densa; o fio do rótulo dos contadores atravessa quatro linhas de texto; o rótulo da barra de status cabe num vão de uns 50 px, e uma linha a mais na árvore derruba a conferência. Só Chromium. Imagem Docker e `landing-smoke.sh` não rodaram antes do envio |
| V2G-T7 | 2026-10-05 | `416e465`, `3a4c134` e o commit deste registro | sessão principal e um agente | **C-8:** os dois defeitos das previsões ainda existiam e foram corrigidos só na visão (`seasonView.ts`, `craftProjection.ts`), sem regra, sem `advanceTo`, sem forma de estado e sem golden: a conta da lenha olha os cortes do caminho, e o "acaba em" da escassez que abre depois da outra passa a ter prazo dentro da estação. Um resto fica marcado com `it.fails` em `seasonView.test.ts`: a fome que abre no caminho corta a Serraria e a conta ainda diz que a lenha dá. Documentos no estado novo: `CLAUDE.md`, CHANGELOG, GDD §13.5, pendências, aceitação. **Portão final sobre tudo:** `pnpm verify` com 5.162 testes e uma falha esperada, integração com 468, navegador com 95 de 95, página de apresentação com 37 e 7 pulados, captura com 2 de 2 | Uma frase nova da conta da lenha ("…a reposição só alcança a lareira mais adiante: antes disso faltam…") não foi lida pelo autor. "Antes de partir" pode dizer "A comida acaba em X" com o saldo de agora positivo, quando o frio no caminho corta a Fazenda. Tag `v0.2.0`, release, backup externo, cópia do `RECOVERY_CODE_SECRET` e evidência manual por critério continuam do autor (V2G-T7.3) |
| Lançamento da v0.2.0 | 2026-10-05 | `6788c41` (Fase G publicada) e o commit `Lançar a v0.2.0` | sessão principal, a pedido do autor | **Publicação da Fase G:** backup manual do `lotg-db` às 16:11 UTC (`pg-dump-lotg-1791216677.dmp`, sucesso, agendamento intacto), com a produção em `4d94889` (`builtAt` 2026-10-03 01:58 UTC) como ponto de retorno; `push` de 15 commits às 16:11 UTC; CI verde; produção com `builtAt` 2026-10-05 16:17 UTC e `contentHash` `cea08e6e14163458`. No arranque o job avançou 4 partidas sem falha, e a leitura de um jogador ativo respondeu 200 em seguida. **Lançamento:** pacotes, `ENGINE_VERSION`, `SERVER_VERSION`, `APP_VERSION` e as outras constantes de versão em `0.2.0`; CHANGELOG datado; tag anotada `v0.2.0` e release no GitHub criadas depois da CI verde desse commit | Não há cópia do backup fora do servidor nem registro de cópia do `RECOVERY_CODE_SECRET` fora do Coolify: o passo 2 de "Antes de um deploy que sobe a versão do estado" não foi cumprido, por depender do autor. Só 4 partidas paradas passaram pelo passo 11 → 12 no arranque; as outras migram na leitura, e ninguém olhou uma a uma. Nenhuma partida de produção em fome foi conferida na fronteira |

## 12. Conteúdo proposto: o primeiro lote do Conselho

**Estado:** proposta para as decisões 7, 8 e 21. Nenhum número daqui vai para `content` sem a curadoria de V2D-T2 e o registro no ADR 0014. As tarefas continuam válidas se uma proposta for recusada.

### 12.1 As sete ideias de experiência e onde entram

| ID | Ideia | O que muda para o jogador | Tarefa |
|---|---|---|---|
| IDEIA-01 | **"Antes de partir"** na aba Hoje | Um resumo acionável do que preparar: comida, lenha, estoque cheio, obra automática, aldeões livres | V2C-T6 |
| IDEIA-02 | **Aviso de mudança de estação** | "O inverno chega em 1h" com o que muda e uma ação possível | V2C-T6 |
| IDEIA-03 | **"Sua escolha voltou"** na Crônica | A continuação de uma carta lembra a decisão e liga à linha anterior | V2D-T2, V2D-T4 |
| IDEIA-04 | **Marcos de preparação** | Objetivos que ensinam Celeiro, obra automática, Paliçada e lenha | V2E-T4 |
| IDEIA-05 | **Retorno em três blocos** | "O feudo prosperou", "O que exigiu um preço", "Você ainda pode decidir", com ações | V2D-T4 |
| IDEIA-06 | **Um caminho de recuperação** | Piso de população e a ação de recuperação sugerida; é regra, decidida na 19 | V2C-T4 |
| IDEIA-07 | **Identidade pelas escolhas** | Variantes de texto por flag em poucas cadeias; sem árvore de personalidade nem moeda | V2D-T2 |

### 12.2 O lote de 21 cartas

**Três cadeias de 3 cartas** (9), só com recursos, edifícios, moral, flags e continuações da v0.2:

| Cadeia | Começo → meio → desfecho | Trade-off central | Cuidados |
|---|---|---|---|
| **O Celeiro Comum** | Tábuas para as reservas → A vez de repartir → O que ficou da escolha | Compartilhar agora ou conservar margem para obras e inverno | Não cria estoque secreto; transferências seguem o cap |
| **A Ponte do Degelo** | Moradores pedem material → O trabalho encontra um obstáculo → A passagem volta a servir | Gastar madeira, pagar ajuda com ouro, ou adiar | Sem mapa, rota comercial, aldeões nomeados ou produção permanente nova |
| **A Promessa da Paliçada** | Aldeões pedem proteção → O prazo se aproxima → Promessa cumprida ou atraso explicado | Comprometer recursos cedo ou evitar uma promessa arriscada | Usa a Paliçada de V2E-T2 (elegível só com Salão ≥ 3); não dá proteção grátis |

Cada cadeia tem saída para aceitar, recusar e expirar; nenhuma decisão gera cobrança impossível ou bloqueia as cartas futuras; a continuação chega por agendamento com prioridade (premissa 18).

**Exemplo completo, "O Celeiro Comum"** (proposta para protótipo; durações em dias de jogo):

1. **Tábuas para as reservas**: elegível com Celeiro ≥ 1, sem fome, uma vez por ano.
   > As prateleiras do celeiro cederam com a última carga. Os moradores propõem repartir o trabalho antes que a próxima colheita chegue. A madeira usada aqui fará falta nas obras do salão.

   | Opção | Efeito | Continuação |
   |---|---|---|
   | Ceder 40 madeira | −40 madeira; +5 moral por 1 dia | Flag `commonGranary.supported`; agenda a carta 2 para 3 dias depois |
   | Pagar o conserto | −30 ouro; +5 moral por 1 dia | Mesma continuação, com a variante "pagou" |
   | Conservar as reservas | Sem custo; sem prêmio oculto | Encerra o ramo com uma frase na Crônica |

   `autoResolve`: Camponês e Senhor "Conservar as reservas"; Rei de Ferro "Conservar as reservas" (a pior aqui é a sem efeito: a cadeia se perde).

2. **A vez de repartir**: continuação agendada.
   > O conserto ficou pronto. Algumas famílias pedem uma pequena refeição em comum; outras preferem guardar cada saco para o frio. O conselho espera saber qual exemplo o senhor quer dar.

   | Opção | Efeito | Continuação |
   |---|---|---|
   | Partilhar 30 comida | −30 comida; +10 moral por 1 dia | Flag `commonGranary.shared`; agenda a carta 3 |
   | Guardar para o inverno | Sem custo | Flag `commonGranary.reserved`; agenda a carta 3 |

3. **O que ficou da escolha**: desfecho nos dois ramos; a abertura lembra a mesa comum ou o saco que não precisou ser aberto.
   > As prateleiras resistiram. Na mesa do conselho, a conversa retorna à decisão sobre os mantimentos.

   **Receber a contribuição** (+20 comida, limitada pelo cap, com o desperdício explicado) ou **Deixar com as famílias** (+5 moral por 1 dia). A cadeia limpa as flags transitórias e registra o desfecho.

**Doze cartas avulsas** (temas; V2D-T2 escreve e aprova texto, custos, elegibilidade e riscos):

| Tema | Escolha que provoca | Sistemas |
|---|---|---|
| Sementes para o próximo campo | Pagar comida agora ou ouro para poupar as reservas | Recursos; efeito adiado |
| Lenha ainda úmida (outono) | Investir ouro para conservar madeira ou aceitar perda | Recursos; sem recurso "lenha seca" |
| A refeição dos pedreiros | Gastar comida para elevar o ânimo ou manter o estoque | Recursos; moral temporária |
| Um teto antes do frio | Prometer Habitações em prazo ou recusar o compromisso | Flag, edifício, moral |
| A colheita de todos (outono) | Celebrar ou guardar para o inverno | Adaptação do Festival da Colheita do GDD, sem colonos extras |
| O poço entulhado | Pedra ou ouro para resolver uma demanda da vila | Recursos; consequência narrada |
| A serraria e o descanso | Consumir reservas para aliviar o trabalho ou conservar material | Recursos; moral |
| Mais bocas à mesa | Acolher com vagas ou ajudar com provisões | Refugiados sem Mestre; chegada respeita o cap habitacional |
| Vigília entre vizinhos | Atender um pedido da vila ou guardar para a Torre | Recursos; moral; não substitui a Torre |
| A mesa dos aprendizes | Financiar aprendizado comunitário ou priorizar abastecimento | Moral; experiência do ofício de um edifício (+4, uma vez) |
| O celeiro quase cheio | Compartilhar parte da comida ou preservar o que ainda cabe | Recursos; moral; sem venda |
| A notícia da primavera | Acolher a estação com uma pequena festa ou conservar ouro | Moral temporária; recursos |

### 12.3 Ficha obrigatória de uma carta pronta

Usar no inventário `docs/content-v0.2.md` e refletir no schema de `content`:

- ID do modelo, versão, estação e estágio elegíveis, repetição e dependências (flags, edifícios, faixa de moral).
- Texto da situação (2–4 frases, tom de crônica), 2–3 opções com verbo no infinitivo e pista de risco; nenhum requisito de versão futura.
- Custos e efeitos conhecidos, unidade de cada duração (dias de jogo), efeito oculto com pista e momento de revelação.
- `autoResolve` por dificuldade, sempre sem custo.
- Flags gravadas e consumidas, continuação agendada (carta e prazo), condição de encerramento e comportamento na virada do ano.
- Frases de Crônica para escolha, expiração, efeito posterior e conclusão; variantes por flag quando a continuação lembra a escolha.
- Um cenário em que cada opção faz sentido e um em que é ruim; teste de cada ramo.
- Estado da curadoria: rascunho → cenário validado → aprovado → implementado → observado no playtest.

### 12.4 Guardar para as próximas versões

Heróis, equipamentos, expedições, Mestres e Mercado ficam na v0.3; formações, cerco e Muralha de Pedra na v0.4; mapa gráfico, Legado e Temporadas na v0.5; Academia na v0.6. Esta versão não antecipa nada disso "para dar mais conteúdo". Também não entram: moeda de prestígio, tarefa diária obrigatória, prêmio por login consecutivo, coleta por clique.

---

## Apêndice A — Modelos de prompt

### A.1 Abrir uma tarefa

```
Leia CLAUDE.md, as seções do GAME_DESIGN.md indicadas na tarefa, a tarefa <ID> em docs/roadmap-v0.2.md,
o Apêndice B do roadmap e os ADRs que a tarefa consome (docs/decisions/0013 e 0014, quando existirem).
Trabalhe só nessa tarefa. Se uma decisão que ela consome ainda não tem ADR, pare e me pergunte,
apresentando a premissa recomendada da §8 como padrão. Se for M ou L, apresente um plano
(arquivos, nomes de eventos/recusas/campos do ViewState, testes) antes de codar e espere a minha aprovação.
Escreva os testes antes da implementação onde houver regra de jogo ou contrato de API.
Ao terminar, rode a "Verificação" da tarefa e `pnpm verify` (mais integração, navegador e simulador
quando a tarefa tocar servidor, app ou motor), cole as saídas, marque as caixas, preencha o Registro (§11)
com o que foi e o que não foi verificado, e faça um commit "<ID>: <resumo>". Se precisar desviar do GDD,
pare e me proponha um ADR antes.
```

### A.2 Retomar uma tarefa interrompida

```
Leia CLAUDE.md e a tarefa <ID> em docs/roadmap-v0.2.md. Veja `git status`, `git diff` e `git log -5`.
Me diga em cinco linhas o que já está feito, o que falta e se há algo quebrado (`pnpm verify`).
Depois continue pela próxima subtarefa não marcada.
```

### A.3 Sessão de decisões (V2B-T0 e V2D-T0)

```
Leia CLAUDE.md, docs/roadmap-v0.2.md §8 e §0.6 e as seções do GDD indicadas na tarefa.
Vamos fechar o lote <N> de decisões. Para cada uma: a pergunta em uma frase, a sua recomendação como
padrão ("se eu não disser nada, fica assim"), a alternativa e o que muda no jogo. Uma por vez.
Registre as respostas em docs/decisions/<NNNN>-<titulo>.md com resposta, data, alternativa descartada,
razão, tarefa afetada e seção do GDD; corrija o GDD onde a resposta mudar uma frase ou um número;
atualize a §8 do roadmap para apontar para o ADR. Não preencha nenhuma resposta por suposição.
```

### A.4 Revisão independente (subagente que não escreveu o código)

```
Você é um revisor que não escreveu este código. Leia CLAUDE.md, docs/roadmap-v0.2.md (a fase indicada,
§0.7 e §7.2) e os commits de <intervalo>. Não aceite teste verde como prova: para cada contrato da §0.7
e cada cenário QA da fase, diga se há teste que o cubra e tente quebrá-lo com um caso concreto
(instante exato, duas abas, reenvio, migração no meio, estado desconhecido, cortes diferentes do intervalo).
Procure número de jogo fora de packages/content, regra fora de packages/engine, informação escondida do
jogador saindo no ViewState, e qualquer campo ou botão de versão futura. Entregue uma lista de achados
classificados (defeito confirmado com reprodução; risco; dúvida), cada um com arquivo e linha.
Não corrija nada: quem corrige é a sessão principal, com teste de regressão.
```

### A.5 Definição de pronto (vale para toda tarefa)

- [ ] Comandos da "Verificação" executados, com saída colada na conversa.
- [ ] `pnpm verify` verde; integração, navegador e simulador quando a tarefa toca servidor, app ou motor.
- [ ] Nenhum número de jogo fora de `packages/content`; nenhuma regra fora de `packages/engine`; nenhuma conversão de tempo no app.
- [ ] Golden regravado de propósito, com o diff lido; GDD atualizado se a regra mudou.
- [ ] Documentação tocada quando o comportamento mudou (README do pacote, `docs/architecture.md`, `CLAUDE.md`, `deploy/README.md`).
- [ ] Caixas marcadas; Registro preenchido (com o que não foi verificado); ADR criado se houve desvio.
- [ ] Um commit `<ID>: <resumo>`; `main` (ou o branch de fase) continua verde.

### A.6 Sessão típica (exemplo com V2C-T2)

1. Você: prompt da A.1 com `<ID> = V2C-T2`.
2. Agente: lê, confere que as decisões 4 e 17 estão no ADR 0013, propõe o plano com a tabela de alcançabilidade por dificuldade e os nomes (`granary`, `warehouse`, `storageFilled`, `storageWasted`, `fullInSeconds`). Você aprova.
3. Agente: escreve `storage.test.ts` e a propriedade "nunca acima do cap"; os testes falham; implementa `storage.ts` e os pontos de entrada em `economy.ts` e `construction.ts`; os testes passam; regrava o golden e lê o diff.
4. Agente: painel de recursos com "cheio em"; teste em navegador; `pnpm verify`, integração, E2E e simulador; cola as saídas.
5. Agente: marca V2C-T2.1 a V2C-T2.8, preenche a linha do Registro, faz o commit `V2C-T2: armazenamento com Celeiro, Armazém, caps e desperdício`.
6. Você: joga cinco minutos no ritmo 3 e diz se "cheio em" fez você querer construir o Celeiro. Próxima sessão, V2C-T5.

---

## Apêndice B — Contratos de dados propostos da v0.2

Referência única dos **nomes propostos** para estado, comandos, eventos, recusas e `ViewState`. Cada tarefa confirma ou ajusta os seus e atualiza este apêndice; nenhum campo entra antes da tarefa que o usa (regra 6 do `CLAUDE.md`). Tudo em tempo de jogo no estado e em tempo real no `ViewState`.

### B.1 `GameState`, por tarefa

A versão 2 de verdade (V2B-T1) tem só o que está marcado com V2B abaixo; **ao fim da Fase C o estado está na versão 7** (3 em V2C-T1, 4 em V2C-T2, 5 em V2C-T5, 6 em V2C-T3, 7 em V2C-T4), com tudo o que está marcado com V2C; **ao fim da Fase E, na versão 11** (8 em V2D-T1, 9 em V2E-T1, 10 em V2E-T2, 11 em V2E-T3; V2E-T4 não mudou a forma). **Cada tarefa que muda a forma do estado sobe `schemaVersion` e escreve o seu passo de migração** ([README do motor](../packages/engine/README.md), "Uma mecânica que muda o estado sobe a versão"): o bloco mostra a forma ao fim da v0.2, não a da versão 2.

```ts
type GameState = {
  schemaVersion: 11;                                  // 2 em V2B-T1; 7 ao fim da Fase C; 11 ao fim da Fase E; sobe a cada tarefa que muda a forma
  seed: string;
  settings: {
    settlementName: string; timezone: string; vigilHourLocal: number;
    difficulty: 'peasant' | 'lord' | 'ironKing';      // V2B-T1 (migração grava 'lord'); V2B-T3
    timeScale: number;                                // V2B-T1 (do games.time_scale)
  };
  migratedAtMs: number | null;                        // V2B-T1: fronteira das regras novas
  clock: { gameTimeMs: number; yearStartMs: number; year: number };
  lastProcessedAt: number;
  rng: Record<string, number[]>;                      // V2B-T2: vazio até o primeiro sorteio; nomes válidos em RNG_STREAMS (council, morale, horde)
  settlement: {
    name: string;
    resources: Record<ResourceId, number>; accumulators: Record<ResourceId, number>;
    population: { villagers: number };
    workers: Record<ProductionBuildingId, number>;
    buildings: Record<BuildingId, number>;            // + granary, warehouse (V2C-T2); watchtower (V2E-T1), palisade (V2E-T2); nível 0 = não construído
    constructionQueues: Array<Construction | null>;   // V2C-T5: sempre duas posições; quantas estão abertas sai do nível do Salão
    planned: Array<{ building: BuildingId; targetLevel: number; autoStart: boolean }>;  // V2C-T5
    recruitmentQueue: Array<{ finishesAtMs: number }>;
    famine: { sinceMs: number } | null;
    cold: { sinceMs: number } | null;                 // V2C-T1
    wasted: Record<ResourceId, number>;               // V2C-T2: desperdício ainda não relatado, em milésimos
    craftExperience: Record<ProductionBuildingId, number>;                      // V2C-T3
    craftMasteredYear: Record<ProductionBuildingId, number>;                    // V2C-T3: ano da última mestria; 0 = nunca
    adaptation: Array<{ building: ProductionBuildingId; count: number; untilMs: number }>;  // V2C-T3
    morale: number;                                   // V2C-T4
    moraleEffects: Array<{ id: string; label: string; amount: number; untilMs: number }>;  // V2C-T4; desde V2D-T1 as cartas, as incursões (id fixo 'raid') e os objetivos ('objective:<id>') gravam aqui, só por addMoraleEffect
    injured: Array<{ untilMs: number; building: ProductionBuildingId | null }>;  // V2E-T3: o ferido guarda o ofício e volta a ele sozinho
  };
  council: {                                          // V2D-T1
    pending: Array<{ instanceId: string; cardId: string; drawnAtMs: number; expiresAtMs: number;
                     origin: { cardId: string; optionId: string; instanceId: string } | null }>;  // origin: a escolha que trouxe a continuação
    flags: Record<string, true>; seenThisYear: string[]; nextDrawAtMs: number;       // nextDrawAtMs cai sempre em uma virada de dia
    scheduled: Array<{ cardId: string; atMs: number; previousCardId: string; previousOptionId: string; previousInstanceId: string }>;
    delayed: Array<{ atMs: number; instanceId: string; cardId: string; optionId: string }>;  // efeitos escondidos à espera do instante deles
    expired: string[];                                // ocorrências que expiraram no ano: é o que distingue CARD_EXPIRED de CARD_NOT_PENDING
    // os efeitos temporários de moral não ficam aqui: estão em settlement.moraleEffects (V2C-T4)
  };
  map: { tiles: Record<string, { type: 'wolfDen'; threatActive: boolean }>; threat: number };  // V2E-T1
  horde: { scheduledRaids: Array<{ id: string; atMs: number; kind: 'scripted' | 'threat'; enemy: 'wolves'; size: 'light' | 'medium'; announcedAtMs: number | null }> };  // V2E-T1 (vazio), V2E-T3; no máximo uma por vez
  objectives: { active: string[]; completed: string[] };
  stats: Record<string, number>;                      // + wasted_<recurso> (V2C-T2); cardsDrawn, cardsDrawn:<carta>, cardsAnswered, cardsExpired (V2D-T1); raids_suffered, raids_repelled (V2E-T3); plansMarkedAuto, coldSpellsThisSeason, seasonsSurvived:<estação> (V2E-T4)
};
```

### B.2 Comandos novos

| Comando | Payload | Tarefa | Recusas |
|---|---|---|---|
| `planConstruction` (estendido) | `{ building, autoStart?: boolean }`; como automática, o que já pode começar começa na mesma ordem | V2C-T5 | as atuais |
| `setAutoStart` | `{ building, autoStart: boolean }` | V2C-T5 | `NOT_PLANNED` |
| `answerCard` | `{ instanceId, optionId }` | V2D-T1 | `CARD_NOT_PENDING`, `CARD_EXPIRED`, `INVALID_OPTION`, `OPTION_LOCKED`, `INSUFFICIENT_RESOURCES` |
| `POST /games` (estendido) | `{ difficulty?, timeScale? }`; sem os campos valem a dificuldade recomendada e `GAME_TIME_SCALE` | V2B-T3 | `400 VALIDATION` |
| `GET /catalog` (rota nova, sem sessão) | resposta: `{ contentHash, newGame: { difficulties[], paces[], defaults } }` | V2B-T3 | — |

Códigos novos em `REJECTION_CODES` (motor e protocolo): `EXCEEDS_STORAGE` (V2C-T2: o custo não cabe no depósito), `QUEUE_LOCKED` (V2C-T5: fila ocupada com o Salão abaixo do Nv4; `QUEUE_BUSY` ficou para as duas filas ocupadas), `NOT_PLANNED` (V2C-T5), `CARD_NOT_PENDING`, `CARD_EXPIRED`, `INVALID_OPTION`, `OPTION_LOCKED` (V2D-T1). `protocol` passa a **2** em V2D-T1.

### B.3 Eventos novos (`EVENT_TYPES` e `chronicleTemplates`)

| Evento | Quando | Tarefa |
|---|---|---|
| `coldStarted`, `coldEnded` | A madeira acaba ou volta no inverno; `coldEnded.data = { reason: 'firewood' \| 'thaw', sinceMs }` | V2C-T1 |
| `buildingFounded` | Obra 0 → 1 concluída | V2C-T2 |
| `storageFilled` | O estoque de um recurso atinge o cap (uma vez por episódio) | V2C-T2 |
| `storageWasted` | Virada do dia com desperdício no dia, por recurso, em unidades inteiras. **Fora da Crônica** (`CHRONICLE_HIDDEN_EVENT_TYPES`, [ADR 0015](decisions/0015-cronica-sem-o-fecho-diario-do-desperdicio.md)); continua em `GET /events` | V2C-T2 |
| `constructionAutoStarted` | Planejada automática iniciada pelo motor | V2C-T5 |
| `craftMastered` | Experiência do ofício chega a 100 (uma vez por ano) | V2C-T3 |
| `moraleBandChanged` | A faixa da moral muda; `data.morale` e `data.previousMorale` dizem o sentido | V2C-T4 |
| `villagerArrived`, `villagerLeft`, `villagerDeserted` | Colono por moral alta; partida por moral baixa; deserção por fome | V2C-T4 |
| `cardDrawn`, `cardAnswered`, `cardExpired`, `cardEffectApplied` | Ciclo de uma carta; o efeito escondido, N viradas de dia depois da escolha. O `cardDrawn` de uma continuação leva `previousCardId`, `previousOptionId` e `previousInstanceId` em `data` | V2D-T1 |
| `threatRose` | A Ameaça cruza 40 e 70. **Só é emitido para quem tem a Torre naquela virada** | V2E-T1 |
| `raidAnnounced` | Aviso da Torre, pelo nível que ela tem no instante; a Torre concluída dentro da janela avisa ao concluir | V2E-T3 |
| `wolvesHowl` | Prenúncio do ano 1, no início do 10º dia, sem informação | V2E-T3 |
| `raidRepelled`, `raidSuffered`, `villagerInjured`, `villagerRecovered` | Resolução da incursão e feridos. `raidSuffered` leva o que foi levado em `data.raided_<recurso>`; sem Torre, o evento não leva a Ameaça | V2E-T3 |

Marcadores que a Fase C acrescentou a `CHRONICLE_PLACEHOLDERS`: `{alivio}` (de `coldReliefs`), `{deposito}`, `{recurso}`, `{perda}`, `{artifices}` e `{feito}` (de `craftGuilds`), `{moral}`, `{aldeao}`. As Fases D e E acrescentaram `{carta}` e `{opcao}` (V2D-T1), `{ameaca}` (V2E-T1), `{inimigo}` e `{bando}` (V2E-T3).

Desde V2C-T2, os eventos que mexem no estoque levam os totais em `data` (`spent_<recurso>`, `gained_<recurso>`, `wasted_<recurso>`): é deles que o Relatório de Retorno separa produção, gasto e perda. O início e o cancelamento da obra 0 → 1 têm frases próprias (`foundingTemplates`); a conclusão é o evento `buildingFounded`.

### B.4 `ViewState`: campos novos

| Onde | Campo | Tarefa |
|---|---|---|
| `settlement` | `difficulty`, `difficultyLabel`, `paceLabel` | V2B-T3 |
| `calendar` | `seasonEffects: string`; `nextSeason: { id, label, secondsUntil, changes: string[], firewood: FirewoodView \| null }` | V2C-T1 |
| raiz | `winter: null \| { firewoodPerHour: number; firewood: FirewoodView; cold: null \| { secondsElapsed: number; text: string } }`, com `FirewoodView = { perHour, winterTotal, winterProduction, stock, missing, text }` | V2C-T1 |
| `constructions.available[]`, `planned[]`, `recruitment` | `durationNote: string \| null` (o porquê do prazo: a estação) | V2C-T1 |
| `resources[]` | `cap` preenchido (ouro `null`); `capBreakdown`; `storageBuilding`; `storageLabel`; `full: boolean`; `fullInSeconds: number \| null`; `fullNote: string \| null`; `wastingPerHour`; `wastedToday: number` | V2C-T2 |
| `constructions.available[]`, `planned[]` | `effect: string \| null` (o que a obra muda; hoje só nos depósitos); em `active.refund[]`, `lost` (o que não caberia de volta) | V2C-T2 |
| `constructions` | `queues: Array<active \| null>`; `queuesUnlocked: number`; `queuesNote: string \| null`; `planned[].autoStart`; `planned[].waiting: null \| { reason; text; etaSeconds: number \| null }` (`null` quando já pode começar; `text` sem o prazo) | V2C-T5 |
| `workers[]` | `experience`, `masteryBonusPercent`, `occupiedFrom`, `experienceTrend`, `experienceNote`, `adapting`, `adaptationEndsInSeconds`, `adaptingCohorts: Array<{ count; endsInSeconds }>`, `perNewWorkerPerHour` | V2C-T3 |
| raiz | `workersRules: { adaptationSeconds; adaptationText; removalText; experienceText; experienceMax; masteryMaxBonusPercent }` | V2C-T3 |
| raiz | `morale: { value; band; bandLabel; multiplierPercent; text; terms: Array<{ id; label; amount }>; breakdown; nextUpdateInSeconds; next: { value; band; bandLabel; multiplierPercent }; nextText; advice; foodReserve: { covered; holdsAtNextTurn; needed; missing; bonus; text }; notes: string[]; effects: Array<{ label; amount; endsInSeconds }> }`. `terms` é a conta da **próxima** virada (`next.value`) | V2C-T4 |
| `recruitment` | `moraleNote: string \| null` (o que recrutar custa à moral) | V2C-T4 |
| raiz | `council: { pending: Array<{ instanceId; title; text; expiresInSeconds; defaultOptionId; defaultOptionLabel; expiryNote; followsFrom: null \| { title; optionLabel; text }; options: Array<{ id; label; cost; affordable; locked; lockedReason; effectsText; hint }> }>; nextCardInSeconds: number \| null; blockedByPending: boolean; nextAudienceInSeconds; note: string \| null; rulesText }`. `nextCardInSeconds` é `null` quando a próxima audiência não pode trazer carta (mesa cheia ou nada elegível). Efeitos escondidos e flags não saem | V2D-T1 |
| raiz | `pendingDecisions: Array<{ kind: 'card'; id; title; expiresInSeconds }>` (deixa de ser `never[]`) | V2D-T1 |
| raiz | `threat`, **união fechada por `known`**. Sem Torre: `{ known: false; text; incoming: null; watchtower; defense }`, e o schema recusa qualquer outro campo. Com Torre: `{ known: true; text; level; max; risePerDay; nextLevel; nextRiseInSeconds; trend; sources: string[]; tiles: Array<{ id; label; active }>; raidChancePercent; raidRisk; raidCosts: string[]; incoming: null \| { enemy; enemyLabel; inSeconds; sizeText: string \| null; text; costText; defenseText }; watchtower; defense }`. `watchtower = { building; level; text; next: string \| null }`; `defense = { building; palisadeLevel; text; next: string \| null }` | V2E-T1, V2E-T2, V2E-T3 |
| `population` | `injured: number`; `secondsToNextRecovery: number \| null`; `injuredNote: string \| null` | V2E-T3 |
| `workers[]` | `injured: number` (os feridos que voltam a este ofício) | V2E-T3 |
| `objectives[]` | `missing: string \| null` (o que falta agora, em frase) e `target` (onde se cumpre: `workers`, `building`, `recruitment`, `council`, `planned` ou `season`); a recompensa em moral sai com o prazo real; IDs novos | V2E-T4 |

`ReturnReport` (`packages/protocol/src/report.ts`) ganhou na Fase C, todos opcionais: `resources[].spent`, `received`, `wasted` e `produced` (V2C-T2); `counts.settlersArrived`, `villagersLeft` e `villagersDeserted`, e `morale: { value; band; bandLabel; before? }` (V2C-T4). Ganhou em V2D-T4 `blocks: { prospered: Item[]; cost: Item[]; pending: Item[] }`, opcional, com `Item = { text; topic?; severity?; action?: { command; arg?; label } }`; e em V2E-T3, `resources[].raided` e `counts.raidsSuffered`, `raidsRepelled`, `villagersInjured` e `villagersRecovered`.

### B.5 Conteúdo novo (`@lotg/content`)

| Arquivo | O que entra | Tarefa |
|---|---|---|
| `balance.ts` | `difficulties` (`label`, `description`, `recommended`, `storageCapacity`, `famineDesertion`; **sem** `cardAutoResolve`: a opção automática é marcada em cada carta, ADR 0014) e `paces` (`timeScale`, `label`, `description`, `hint`, `recommended`) | V2B-T3 |
| `balance.ts`, `chronicle.ts` | `calendar.seasons[].effects` (a lenha é fração), `winter.cold`; `coldReliefs` | V2C-T1 |
| `balance.ts`, `buildings.ts`, `ids.ts` | `storage` (`baseCapacity`, `buildings.<depósito>` com `resources`, `level1`, `perLevel`, `unbuilt`), `granary`, `warehouse`, `initialLevel` e `requires` em todo edifício, `foundingTemplates`. **`watchtower` entra inteira em V2E-T1** | V2C-T2 |
| `balance.ts` | `construction.queues: 2`, `secondQueueTownHallLevel` | V2C-T5 |
| `balance.ts`, `chronicle.ts` | `craft`; `craftGuilds` (artífices, feito e, desde V2C-T4, `artisan`) | V2C-T3 |
| `balance.ts`, `ids.ts`, `chronicle.ts` | `morale` (com `foodReserve: { coverMs, bonus }`), `MORALE_BAND_IDS`, `MORALE_TERM_IDS`, `moraleBandTemplates`, `idleVillager` | V2C-T4 |
| `council.ts`, `schemas.ts`, `balance.ts`, `cards/*.ts` | tipos (`CouncilCard`, opção com `chronicle`, `expiredChronicle` e `hidden: { afterDays, effects, chronicle }`; carta com `variants`, `arrival` e, desde V2E-T2, `autoResolveIfUnlocked`), `CouncilCardSchema` e `CouncilCatalogSchema`, `balance.council`, e o catálogo de 21 cartas (`commonGranary.ts`, `thawBridge.ts`, `palisadePromise.ts`, `standalone.ts`) | V2D-T1, V2D-T2, V2E-T2 |
| `balance.ts`, `tiles.ts`, `buildings.ts`, `ids.ts` | `threat` (`max`, `perActiveTilePerDay`, `seasonPerDay`, `chronicleMarks`, `raidChanceAbove`, `mediumRaidAbove`, `raidDrop`, `raidLeadMs`, `watchtowerLevels`, `palisadeLevels`, `palisadeBreach`), `tileTypes`, `startingTiles`, `enemies`, `raidSizes`, `watchtower`, `palisade`, `raids` (`scripted`, `damage[inimigo][tamanho]`, `injuryMs`, `moraleOnLosses`, `moraleLossDays`), `TILE_TYPE_IDS`, `ENEMY_IDS`, `RAID_SIZE_IDS` | V2E-T1 a V2E-T3 |
| `objectives.ts` | objetivos 5–10, as condições `anyBuildingLevel`, `cardAnswered`, `plannedAutoStart` e `seasonSurvived`, e `morale { amount, durationDays, label }` na recompensa | V2C-T2 (objetivo 4), V2E-T4 |
| `chronicle.ts` | eventos e marcadores da B.3 | cada tarefa |

---

**Próximo passo de execução (2026-10-05):** a Fase G (§6b) está feita e registrada; o que resta da v0.2 é do autor (V2G-T7.3: tag `v0.2.0`, release, backup externo, cópia do `RECOVERY_CODE_SECRET`, evidência manual por critério). Depois vem a v0.3, por [roadmap-v0.3.md](roadmap-v0.3.md). O parágrafo seguinte é o de 2026-10-02 e fica como histórico.

**Próximo passo de execução (2026-10-02, histórico):** a Fase F, começando pelo balanceamento com o simulador (V2F-T1), que herda o que as Fases D e E mediram e não mudaram: a Ameaça que não oscila, o ouro da Torre no objetivo 5 e a frequência das incursões. As Fases A a E foram enviadas ao `main` por fase; as Fases D e E, por último, às 20:04, em `b1b892a`, e às 20:21 a produção ainda respondia `protocol: 1`. Os documentos de fechamento estão nas linhas V2F-T2, V2F-T4 e V2F-T5 do Registro. As revisões independentes com o autor jogando não foram feitas (V2D-T5, V2E-T5 e V2C-T7, da qual só a rodada do simulador e o desempenho têm commit, `4faa40e`). O playtest (V2A-T1) e as confirmações das decisões continuam pendentes do autor ([pendencias-v0.2.md](pendencias-v0.2.md)); publicar continua sendo uma ação separada, só com autorização.
