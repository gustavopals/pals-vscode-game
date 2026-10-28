# Lords of the Guild — Roadmap da v0.4 "Guerra e Cerco"

> **Status em 2026-10-22:** v0.4 em desenvolvimento. Fases A e B concluídas; Quartel e formações implementados (V4C-T1 e T2), interface do Exército em integração (V4C-T3). O registro da §15 e [retomada-v0.4.md](retomada-v0.4.md) detalham o ponto atual. O lote 1 de regras foi aprovado no [ADR 0019](decisions/0019-ferro-exercito-formacoes-e-combate-na-v0.4.md); o lote 2 espera V4E-T0. A primeira publicação continua prevista para o fim da Fase E.\
> **Versão do documento:** plano 0.2 (2026-10-15), com registro de execução atualizado em 2026-10-22.\
> **Base atual:** [GAME_DESIGN.md](../GAME_DESIGN.md) v0.9 e ADR 0019. Os apêndices propostos descrevem a base de planejamento; para o que já existe, consultar o registro e o código.\
> **Vem de:** [roadmap-v0.3.md](roadmap-v0.3.md) (V3G-T5, §12 e §13.5); [relatorio-v0.3.md](relatorio-v0.3.md); [retomada-v0.3.md](retomada-v0.3.md); [pendencias-v0.3.md](pendencias-v0.3.md); [balance-v0.3.md](balance-v0.3.md) (seções 14 e 15); [architecture.md](architecture.md); ADRs [0017](decisions/0017-regras-da-v0.3-herois-taverna-e-soldo.md) e [0018](decisions/0018-expedicoes-mercado-mestres-e-cartas-na-v0.3.md)\
> **Árvore conferida:** `main` local em `561b0ff` (um commit de documento à frente de `origin/main` = `c2cb21e`). **A v0.3.0 está em produção desde 2026-10-15, 19:54 UTC** (`c2cb21e`: estado **24**, protocolo **3**, pacotes em `0.3.0`); o job do arranque migrou e avançou 4 partidas sem falha. **O lote 2 do Conselho ficou fora da v0.3.0** (pendência F-3): o branch `wip/v3f-t1-lote2` (`2352e39`) está pela metade e não é verde. O que este plano diz do código foi conferido em `561b0ff` (Apêndice B.0)\
> **Forma de trabalho:** desenvolvimento 100% com Claude Code; o autor decide regras e autoriza a publicação; execução em subagentes no Sonnet, com o modelo maior nas decisões de regra, nas revisões de motor e na integração arriscada (pedido do autor de 2026-10-06)\
> **Idioma:** português (Brasil); identificadores de código em inglês

**A v0.4 é a versão que fecha a semana.** Pelo GDD §16: "Passei a semana me preparando e valeu". Entrega: Quartel, Ferreiro, ferro e armas, Muralha, formações, Conselho de Guerra, Horda adaptativa, presságios, Fortaleza e sabotagem, Cerco, milícia e Crônica do Ano.

**O que a revisão 0.2 corrigiu no esboço 0.1:**

- **A v0.3 foi publicada** (estado 24, protocolo 3, 2026-10-15). O esboço dizia "publicada ou não" e "nenhuma partida real foi migrada"; agora quatro partidas passaram pelos doze passos (12 → 24) no job do arranque, e falta o autor conferir no banco que nenhuma ficou para trás. A tag `v0.3.0` e a release continuam por criar; o `CHANGELOG.md` data a 0.3.0 de 2026-10-07, dia da preparação, e não da publicação.
- **O lote 2 do Conselho não entrou.** O esboço (§6) contava 45 cartas ao fim da v0.3 e 15 para o lote 3. O jogo tem **22 cartas** (as 21 do lote 1 e a "Estrangeira ferida"); faltam **38** para as 60, e o lote 2 (23 cartas, sem a roteirizada que já entrou) é herança. Os Mestres **Gil e Ximena não têm de onde vir** (só chegariam por carta), `addMaster`, `market.effects` e o requisito de carta por herói presente não existem, e nada no branch foi testado. Para onde vai o lote 2 é a **decisão 1** da §9.
- **O ouro sem destino tem número** (§13): a Mina é de 79% a 99,4% do ouro que entra e as obras são de 72% a 93% do que sai; ninguém compra no balcão; o soldo por nível mexeu 0,29% a 0,45% na soma (balance-v0.3.md, seção 14.4). O objetivo 12 piorou três células da matriz (F-1).
- **As pendências F-1 a F-6, E-51 a E-60 e os números que o autor não leu** (a tabela do soldo por nível, as marcas de 85% e 115% da Crônica do Mercado, o objetivo 12) entram na herança (§10) e na primeira rodada da sessão de decisões.
- **O mapa das dependências (a §2 do esboço) foi conferido no código**, e o Apêndice B.0 é novo: `RESOURCE_IDS` tem quatro recursos (sem ferro), `ENEMY_IDS` só `wolves`, `RAID_SIZE_IDS` só `light` e `medium`, um único tipo de tile, a Torre e a Paliçada em `maxLevel: 2`, treze edifícios, cinco fluxos fixos e duas famílias de entidade, `settings.timezone` e `settings.vigilHourLocal` **já no estado** (o motor não os usa), `heroCapture` por dificuldade (o molde para a astúcia), os testes de conteúdo que barram por expressão regular as palavras da guerra, e a ordem de `processEventsAt` com dezesseis passos.
- **As fases ganharam tarefas**, cada uma com arquivos, subtarefas, verificação com os comandos do repositório, "pronto quando" e a versão do estado que sobe (a v0.4 parte do **24**). A §10 tem os critérios por tarefa e a matriz QA-19 a QA-34; a §11 tem 26 decisões em dois lotes mais cinco atos do autor; os Apêndices A e B existem.
- **As lições da v0.3 (§11) foram conferidas contra o Registro** e ganharam o que a retomada de 2026-10-15 ensinou: o portão que estava vermelho em 24 testes porque uma tarefa não rodou a matriz, e a revisão independente da Fase F feita só sobre o que entrou.

## Índice

- [0. Como usar este roadmap](#0-como-usar-este-roadmap)
- [1. Fase A — Herança e decisões](#1-fase-a--herança-e-decisões)
- [2. Fase B — Ferro e Ferreiro](#2-fase-b--ferro-e-ferreiro)
- [3. Fase C — Quartel, exército e formações](#3-fase-c--quartel-exército-e-formações)
- [4. Fase D — Combate e Conselho de Guerra](#4-fase-d--combate-e-conselho-de-guerra)
- [5. Fase E — Muralha, incursões completas e Horda](#5-fase-e--muralha-incursões-completas-e-horda)
- [6. Fase F — Sabotagem e Acampamento](#6-fase-f--sabotagem-e-acampamento)
- [7. Fase G — O Cerco e a Crônica do Ano](#7-fase-g--o-cerco-e-a-crônica-do-ano)
- [8. Fase H — Conselho (lotes 2 e 3) e objetivos](#8-fase-h--conselho-lotes-2-e-3-e-objetivos)
- [9. Fase I — Fechamento da v0.4](#9-fase-i--fechamento-da-v04)
- [10. Critérios de aceitação, cenários integrados e sinais de diversão](#10-critérios-de-aceitação-cenários-integrados-e-sinais-de-diversão)
- [11. Decisões que esperam o autor, com premissas recomendadas](#11-decisões-que-esperam-o-autor-com-premissas-recomendadas)
- [12. Dívidas conhecidas, herdadas da v0.3](#12-dívidas-conhecidas-herdadas-da-v03)
- [13. O ouro sem destino](#13-o-ouro-sem-destino)
- [14. O que a v0.3 ensinou](#14-o-que-a-v03-ensinou)
- [15. Registro de execução](#15-registro-de-execução)
- [16. Conteúdo proposto: unidades, destinos de expedição e o lote 3](#16-conteúdo-proposto-unidades-destinos-de-expedição-e-o-lote-3)
- [Apêndice A — Modelos de prompt](#apêndice-a--modelos-de-prompt)
- [Apêndice B — Contratos de dados propostos da v0.4](#apêndice-b--contratos-de-dados-propostos-da-v04)
- [Mudanças propostas fora deste arquivo](#mudanças-propostas-fora-deste-arquivo)

> As seções são numeradas pela ordem do documento. A lista de decisões, que no roadmap da v0.3 era a §9, aqui é a **§11**; o texto das tarefas diz sempre "decisão N" e "§11".

---

## 0. Como usar este roadmap

### 0.1 O que é a v0.4

A v0.4 é a linha "Guerra e Cerco" do GDD §16. O §18.2 diz o que ela implementa: "§10, §11.1–11.4, §8.3, §9.5; `sim-cli` com os quatro perfis e teste de faixa da §15.2". A frase do jogador: **"Passei a semana me preparando e valeu."**

Os critérios de aceitação são os seis da §16.2:

1. Uma formação salva defende offline.
2. A prévia e a batalha real usam o mesmo código (golden test).
3. A Horda altera a composição em resposta à última formação (teste determinístico).
4. O Cerco ocorre na Hora da Vigília com 3 ondas e Plano de Batalha.
5. A Crônica do Ano é gerada e exportável em Markdown.
6. O perfil Regular do `sim-cli` fica em 65–80% de Vitória.

**O que entra além dos critérios:** ferro (Mina Abandonada e Mercado), Ferreiro e armas, desgaste e reparo de equipamento, Quartel e as cinco unidades treináveis, o herói como comandante de ala, o relatório de batalha com os três fatores decisivos, a Muralha de Pedra e o Baluarte (Paliçada até o nível 6), a Torre de Vigia até o nível 5, incursões que usam a Formação de Defesa ativa e saqueadores, a Horda adaptativa, a Fortaleza da Horda e o Acampamento de Saqueadores, presságios, sabotagem, o ensaio do cerco do dia 6, milícia, rescaldo, Primavera da Reconstrução, a Crônica do Ano, o lote 2 (herdado) e o lote 3 do Conselho, os objetivos 17 a 21 e o Retorno com a guerra.

**Não entra:** mapa hexagonal, postos avançados, Capela e relíquias, Legado, Votos, anos seguintes com semente visível, a Horda que lembra do ano anterior, Temporadas e ranking (v0.5); Academia, Feitos completos, som, localização (v0.6); mercado entre jogadores (v1.0). O `GameState` não ganha campo dessas versões, nem vazio. Onde uma regra da v0.4 cita algo de outra versão, a parte de outra versão fica de fora:

| O GDD diz | O que a v0.4 faz | Decisão |
|---|---|---|
| `tamanho_da_onda = … × (1 + 0,10 × anos_anteriores) × votos` (§11.2) | Só `base × dificuldade × sabotagens`; o fator do ano e os Votos são da v0.5 | 19 |
| A Horda lembra das formações do ano anterior (§11.5) | A memória é só da última formação vista nesta partida | 15 |
| Torre de Vigia revela mapa (§6.1) | A Torre Nv3+ dispara e clareia presságios; mapa é v0.5 | 16 |
| Ferro vem da Mina Abandonada, do Veio de Ferro e do Mercado (§5.1) | Mina Abandonada e Mercado; o Veio é posto avançado (v0.5) | 3 |
| Crônica do Ano com pontuação e Feitos (§11.4); Feitos completos (v0.6) | Pontuação e os Feitos ligados ao cerco; o resto é v0.6 | 22 |
| "Avançar para o Degelo" (§11.4) | A decidir: o servidor é o relógio | 22 |
| Relíquias no Pântano, planta da Capela nas Ruínas (§9.3) | Continuam trocadas por item | — |

A v0.4 herda o que a v0.3 deixou por fazer (§12): o lote 2 do Conselho, Gil e Ximena sem origem, o ouro sem destino (§13), as pendências F-1 a F-6, os números que o autor não leu, o ato 23 e, de novo, **ninguém jogou**.

### 0.2 O que o jogador vai sentir

**Promessa:** "O que eu construí, treinei e aprendi durante a semana decide uma noite de cerco, e eu entendo por que ganhei ou perdi."

A v0.3 deu pessoas ao feudo. A v0.4 dá um **inimigo que aprende** e uma **data**. Como nas versões anteriores, cada tensão chega com o seu alívio:

| Tensão (o mundo pede) | Alívio (o jogador responde) | Onde |
|---|---|---|
| O ferro é raro e caro, e só ele vira espada | A Mina Abandonada, o ferro no Mercado, o Ferreiro forjando enquanto se está fora | Fase B |
| Soldados comem mais e tiram braços da produção | Treinar em lotes, escolher o que treinar pelo que o ferro permite, montar a formação | Fase C |
| A incursão vira batalha, e a Paliçada passa a sofrer dano | Formação de Defesa ativa, prévia no Conselho de Guerra, reparo | Fases D e E |
| A Horda responde à última formação; presságios dizem só parte | Ler o relatório, adaptar, fintar; sabotar no outono ou guardar os heróis | Fases E e F |
| O cerco tem hora e três ondas, com ou sem o jogador | Plano de Batalha por onda, milícia, trocar entre ondas se estiver presente | Fase G |
| O ano acaba | A Crônica do Ano diz o que valeu; a Primavera da Reconstrução não pune duas vezes | Fase G |

A jornada de quem joga no ritmo Rápido (um ano em 56 horas reais), com uma ou duas visitas por dia. As linhas da v0.2 e da v0.3 continuam; a tabela mostra só o que a v0.4 acrescenta:

| Hora real | O mundo | O que o jogador decide |
|---:|---|---|
| ~16 | Verão. Salão Nv4 abre o Quartel e o Ferreiro | Lanceiros e Arqueiros só com madeira; a primeira formação salva |
| ~20 | Acampamento de Saqueadores conhecido; primeira incursão humana (fraca) usa a Formação de Defesa ativa | Ler o relatório de batalha: os três fatores decisivos |
| ~24 | Mina Abandonada descoberta; o ferro aparece no Mercado a 8 de ouro | Espadachins (1 arma) ou guardar o ferro para reparos |
| 32 | **Outono**: a Fortaleza da Horda surge; primeiro presságio | Sabotar (3 heróis por 6 h, risco de captura) ou guardar os heróis para comandar |
| ~40 | Incursão média; a Paliçada sofre dano | Reparar (50% da pedra do nível); Muralha de Pedra (Nv3) |
| ~46 | **Ensaio do cerco** (incursão forte, na Hora da Vigília) | A finta: a Horda guarda a formação que viu |
| 48 | **Inverno**. O cerco é marcado para a primeira Hora da Vigília ao menos 6 h depois | Plano de Batalha por onda; milícia de reserva |
| Vigília | **Cerco**: três ondas, 60 min entre elas | Presente: trocar a formação entre ondas; ausente: o Plano vale |
| 56 | Rescaldo; **Crônica do Ano** exportável; Ano 2 com a Primavera da Reconstrução | Ler a Crônica; rever a formação para o ano seguinte |

As horas são do ritmo 3× e orientam o balanceamento; nenhuma é promessa ao jogador ([ADR 0011](decisions/0011-ritmo-3x-no-mvp.md)). Quais prazos são reais e quais são de jogo é a decisão 12.

**Critérios de diversão de toda entrega** (GDD §15.1, aplicado à v0.4):

- **A decisão acontece antes; a resolução é automática e explicada.** Nada é controlado em tempo real; o relatório diz os três fatores decisivos e o botão "Ajustar formação" leva ao editor.
- **Custo e benefício lado a lado.** Cada unidade mostra o que come, o que custa e contra quem é forte; a prévia mostra Vitória, Gloriosa e Derrota com o risco principal em uma frase.
- **Nada obriga a voltar.** A formação salva defende; o Plano de Batalha vale sem o jogador; estar presente é vantagem, não exigência (GDD §10.8).
- **O resultado ruim ensina.** A Queda custa e o Ano 2 começa com desconto; o relatório diz o que teria mudado o desfecho.
- **Toda escolha deixa rastro.** A finta, a sabotagem e a formação de cada onda aparecem na Crônica do Ano.
- **Sem opção dominante.** Nenhuma unidade vence tudo (o ciclo de contra-ataques); nenhuma formação vence duas vezes contra a mesma Horda.
- **Sessões de 2 a 10 minutos**, e o cerco cabe em uma noite.

### 0.3 Estrutura do plano

```
Fase (A…I)  →  Tarefa (V4D-T1)  →  Subtarefa (V4D-T1.3)
```

Os identificadores começam com `V4`. Cada tarefa traz: objetivo, seções do GDD, dependências (inclusive **o que a v0.3 entrega** e ela usa), **decisões** que consome (§11), **trilha** (motor, app ou documentos), **entregáveis** (arquivos), subtarefas com caixas, **diversão**, **verificação** (comandos e resultado esperado), **impacto em partidas antigas** (a versão do estado e o passo), **pronto quando** e um **prompt sugerido**.

| Tamanho | Significado |
|---|---|
| `S` | Uma sessão curta |
| `M` | Uma a duas sessões; o plano fica escrito antes de codar |
| `L` | Duas a quatro sessões; dividir pelas subtarefas, um commit por subtarefa, no `main` |

| Fase | Entrega jogável | Tarefas | Estado |
|---|---|---|---|
| A — Herança e decisões | Linha de base com a v0.3 publicada; caixa de entrada; lote 1 de decisões | V4A-T1, V4A-T2 | 24 |
| B — Ferro e Ferreiro | Achar e comprar ferro; forjar armas; reparar equipamento | V4B-T1 a V4B-T5 | 25 a 27 |
| C — Quartel, exército e formações | Treinar soldados; montar e salvar uma formação; nomear comandantes | V4C-T1 a V4C-T4 | 28 a 29 |
| D — Combate e Conselho de Guerra | Simular uma batalha e ler o relatório | V4D-T1 a V4D-T5 | 30 |
| E — Muralha, incursões completas e Horda | A formação defende uma incursão; a Horda adapta; presságios | V4E-T0 a V4E-T5 | 31 a 33 |
| F — Sabotagem e Acampamento | Sabotar a Fortaleza; atacar o Acampamento | V4F-T1 a V4F-T4 | 34 |
| G — O Cerco e a Crônica do Ano | Três ondas na Hora da Vigília; milícia; rescaldo; Crônica exportável | V4G-T1 a V4G-T5 | 35 a 36; protocolo 4 |
| H — Conselho e objetivos | Lotes 2 e 3; objetivos 17 a 21; Retorno com a guerra | V4H-T1 a V4H-T5 | 37 |
| I — Fechamento | Faixa do Regular no cerco; aceitação; playtest; release; a v0.5 | V4I-T1 a V4I-T5 | — |

As versões do estado são a contagem prevista (uma por tarefa que muda a forma); a numeração exata é fixada pela tarefa e o Apêndice B a acompanha. A ordem das fases é obrigatória. Dentro de uma fase vale "Depende de".

```
A ──► B ──► C ──► D ──► E ──► F ──► G ──► H ──► I
│     │     │     │     │     │     │     └─ H1 Lote 2 ─► H2 Lote 3 ─► H3 Objetivos ─► H4 Retorno ─► H5 Revisão
│     │     │     │     │     │     └─ G1 Vigília ─► G2 Cerco ─► G3 Crônica do Ano ─► G4 Interface ─► G5 Revisão
│     │     │     │     │     └─ F1 Sabotagem ─► F2 Acampamento ─► F3 Interface ─► F4 Revisão
│     │     │     │     └─ E0 Decisões ─► E1 Muralha e Torre ─► E2 Incursões ─► E3 Horda e presságios ─► E4 Interface ─► E5 Revisão
│     │     │     └─ D1 Batalha ─► D2 Prévia ─► D3 Relatório e comandante ─► D4 Interface ─► D5 Revisão
│     │     └─ C1 Quartel ─► C2 Formações ─► C3 Interface ─► C4 Revisão
│     └─ B1 Ferro ─► B2 Ferreiro ─► B3 Desgaste e reparo ─► B4 Interface ─► B5 Revisão
└─ A1 Herança ─► A2 Decisões
```

**O lote 2 do Conselho** pode correr em trilha de conteúdo a partir da Fase B (V4H-T1 não depende de mecânica nova); fica na Fase H por ser onde se integra. Se o autor escolher a v0.3.1 (decisão 1), ele sai deste plano.

### 0.4 Ritual de cada tarefa (uma sessão de agente)

É o do [roadmap da v0.3, §0.4](roadmap-v0.3.md), com o que ela ensinou (§14):

1. **Abrir a sessão** com o prompt da tarefa (ou o modelo do Apêndice A).
2. **Conferir as decisões.** Se uma decisão que a tarefa consome não tem ADR, o agente **para e pergunta**, com a premissa recomendada da §11 como padrão. Só segue sem resposta se o autor tiver pedido execução por delegação.
3. **Conferir o mapa de arquivos** (Apêndice B.0) contra o código: o que as tarefas anteriores da v0.4 mudaram vale mais que ele.
4. **Plano escrito antes de codar** em `M` e `L`: arquivos, nomes (eventos, recusas, campos do `ViewState`), o passo de migração e os testes. Na v0.3 o autor pediu a execução sem a espera pela aprovação; se pedir de novo, vale o mesmo.
5. **Testes primeiro** onde houver regra de jogo ou contrato de API. Para a batalha: golden antes do motor.
6. **Mostrar a mecânica ao autor cedo**: uma formação na tela, uma prévia, um relatório. Na v0.3 nenhuma parada dessas aconteceu (lição 8); a subtarefa continua, e se não acontecer fica registrada como não feita.
7. **Verificação** da tarefa e a comum (§0.9), com a saída colada e o código de saída conferido.
8. **Fechar:** marcar as caixas, preencher o Registro (§15) com o que foi verificado **e o que não foi**, ADR para desvios, procurar o que a tarefa tornou falso em `CLAUDE.md`, READMEs e `docs/`, commit `V4C-T2: resumo`.
9. **Uma tarefa por sessão.**

**Trilhas** (motor: `engine`, `content`, `protocol`, `server`, `sim-cli`; app: `web`, `client-sdk`, `tests/e2e`; documentos) e integração por fase como na v0.3. **Novo nesta versão:** os arquivos de cada trilha ficam listados na tarefa (lição 5) e a revisão independente de cada fase deixa o relatório **no repositório** (`docs/reviews/v0.4-fase-<x>.md`; lição 1). `CLAUDE.md`, o Registro e as pendências pertencem a quem integra.

### 0.5 A regra de toda mecânica nova

A da v0.3 (§0.5 daquele roadmap; GDD §18.3), inteira: dados em `@lotg/content` com schema e teste; passo de migração com a fronteira do passo; comando com recusa em `REJECTION_CODES` (motor e protocolo) e frase em português; evento em `EVENT_TYPES` com modelo em `chronicleTemplates`; explicação do número no `ViewState`; teste de instante exato, propriedade de divisão de intervalo (estado, eventos e fluxos), golden regravado de propósito, um ritmo diferente de 1, navegador quando há tela; política no bot; nível alcançável nas três dificuldades; GDD atualizado. **A v0.4 acrescenta três:**

- **Nenhum ciclo lucrativo no mesmo instante** entre recursos: toda conversão nova (ouro ↔ ferro, ferro + madeira → arma, arma → soldado, soldado → aldeão) entra com teste de propriedade no molde de `market.property.test.ts` e uma política do bot `especulador` que tenta a manobra (lição 2).
- **Prévia igual à batalha.** Toda conta de combate mora em uma função pura que a prévia e a resolução chamam; um golden fixa o relatório de cada cenário e um teste prova que a prévia com a composição real dá o mesmo resultado da batalha (critério 2).
- **O que a Horda planeja não sai na visão.** Composição de onda, memória da Horda e sorteios de batalha ficam no servidor; o que sai é o que os vigias, os presságios e as sabotagens revelaram, com `?` onde não há informação (GDD §13.4).

### 0.6 O que o agente não decide, e como as decisões se fecham

Tudo o que está na §11, qualquer desvio do GDD, dependências novas, quem participa do playtest, quando publicar. As decisões fecham em **dois lotes**:

| Lote | Tarefa | Decisões | Resultado |
|---|---|---|---|
| 1 — Herança, ferro, exército, formações e combate | V4A-T2 | 1 a 14, 25 e 26 | **novo** `docs/decisions/0019-regras-da-v0.4-ferro-exercito-e-combate.md` |
| 2 — Horda, presságios, sabotagem, Cerco, Crônica e cartas | V4E-T0 | 15 a 24 | **novo** `docs/decisions/0020-horda-cerco-e-cronica-do-ano.md` |

Os números 0019 e 0020 são os próximos livres em `docs/decisions/`; se outro ADR entrar antes, vale o seguinte. O formato é o da sessão de 2026-10-05: perguntas com opções, a recomendada primeiro, poucas por rodada, começando pelas que mudam o jogo de quem já joga. Se o autor pedir a versão inteira por delegação, vale o procedimento da v0.3: premissa recomendada aplicada, ADR "aplicada por delegação; aguarda confirmação", uma linha por decisão em `docs/pendencias-v0.4.md`, e nada é publicado sem ele.

### 0.7 Contratos transversais de implementação

Os da v0.2 (§0.7 daquele roadmap) e os três da v0.3 (entidades com identidade, estado de tamanho limitado, pacote do app sem números) continuam. O que a v0.4 acrescenta a cada um:

| Contrato | O que a v0.4 acrescenta |
|---|---|
| **Relógios explícitos** | As constantes de tempo real de hoje (`council.expiryRealMs`; `famineDesertionAfterRealMs`, `famineDesertionEveryRealMs`, `famineResumeWithinRealMs`; `watchtowerLevels[].warningRealMs`; `heroes.arrears.*RealMs`; `expeditions.crossroadsWaitRealMs`) continuam entrando por `realToGameMs` (`units.ts`). A v0.4 acrescenta, se a decisão 12 ficar como recomendada, **o intervalo entre as ondas do cerco** (`siege.waveIntervalRealMs`, 60 min) e **a Hora da Vigília**, que é hora local e por isso real por definição (decisão 13). Tudo o mais (treino, forja, reparo, viagem do exército, sabotagem, presságios) é tempo de jogo |
| **Fronteira da atualização** | Cada passo conta de `context.boundaryMs`. Os passos da v0.4 não dão ferro, arma, soldado nem muralha a ninguém; a Fortaleza e o cerco de uma partida migrada no outono ou no inverno contam da fronteira (decisão 16) |
| **Eventos no mesmo instante** | A ordem de hoje (Apêndice B.0) ganha, **a confirmar em cada tarefa com teste do instante exato**: a forja e o reparo que terminam junto das obras (`finishConstructions`); o treino que termina junto dos recrutas (`finishRecruitments`), antes dos Mestres; o exército que volta do Acampamento logo depois das expedições; a **batalha de uma incursão** no lugar de `settleRaids` (depois da virada do dia, como hoje); o cerco como instante próprio, com as três ondas em instantes próprios, resolvidas em `settleRaids`; os presságios e a memória da Horda dentro da virada do dia, depois da Ameaça; a Fortaleza que surge na virada que abre o outono |
| **Simulação que termina** | A batalha tem no máximo 12 rodadas e cada rodada termina (teste); o cerco tem três ondas; a fila de forja e a de treino andam em lotes finitos; a milícia dissolve sozinha |
| **Consistência numérica** | Atributos, dano, HP, moral de batalha e tamanho de onda em inteiros; `sorte(0,9–1,1)` como inteiro de 90 a 110; `× 0,5`, `× 1,5`, `× 1,25`, `× 0,7`, `× 1,2` como frações; um arredondamento para baixo por conta; desempate pelo lado defensor e, dentro do lado, pela ala (esquerda, centro, direita) e pela linha |
| **Reenvio de comando** | Forjar, reparar, treinar, dispensar soldado, salvar formação, ativar, simular, atacar, sabotar, salvar o Plano, trocar entre ondas e convocar milícia passam pelo recibo transacional; duplo clique e duas abas não treinam nem convocam duas vezes |
| **Visão e privacidade narrativa** | Nunca saem: a composição de uma onda ou incursão além do que os vigias e presságios disseram, a memória da Horda, as sementes das 200 batalhas da prévia, o fluxo `horde` e os de entidade. O relatório de uma batalha já resolvida mostra a composição completa (GDD §8.2) |
| **Compatibilidade** | O `ViewState` cresce por adição nas Fases B a F (ferro, Ferreiro, exército, formações, muralha com HP, presságios). **A Fase G sobe o protocolo para 4**: `pendingDecisions` ganha a decisão entre ondas (`kind: 'siegeWave'`) e o app da v0.3 não a lê (`PendingDecisionSchema` é `z.discriminatedUnion('kind', [card, crossroads])`). Recibos antigos nunca são reescritos |
| **Relatório confiável** | O relatório de batalha é montado no motor, rodada a rodada, com os três fatores decisivos por atribuição de dano; viaja no estado por um número limitado de batalhas (`army.reportsKept`) e nos eventos. A Crônica do Ano é montada no servidor só com eventos e estatísticas que o motor emitiu |
| **Conteúdo como dados** | Unidades, inimigos, contra-ataques, pesos por estação, ondas, presságios, Feitos, grafos novos, preços em `content`, com ids estáveis fixados em teste |
| **Descoberta gradual** | Quartel e Ferreiro aparecem com o Salão Nv4 e um objetivo; a Mina Abandonada e o Acampamento por descoberta; a Fortaleza por data. Nada da v0.5 aparece |
| **Bot honesto** | As políticas de guerra leem só o `ViewState`, inclusive a prévia |
| **Estado de tamanho limitado** | Teto para formações salvas, relatórios de batalha, presságios guardados, sabotagens por ano; o tamanho do estado e da visão é medido em V4A-T1 e a cada fase |

### 0.8 Como a v0.4 chega à produção

**De onde se parte (2026-10-15).** A v0.3.0 está no ar (`c2cb21e`, estado 24, protocolo 3) desde 19:54 UTC, com backup `pg-dump-lotg-1792093376.dmp` de antes do `push`; o ponto de retorno da v0.3 é esse backup com o SHA `7bff36b`. Há pessoas jogando. O ato 23 (backup fora do servidor, cópia do `RECOVERY_CODE_SECRET`, ensaio de reversão com imagens) **continua por fazer**, e a primeira migração de doze passos foi feita em produção sem ele.

**O regime** é o da v0.3 depois de 2026-10-06 (ADR 0017, "Respostas de 2026-10-06"), até o autor dizer outra coisa: commits locais no `main`, um por tarefa (um por subtarefa nas `L`), sem branch de fase; **o agente não dá `push`**; ao fechar uma fase publicável, o agente faz o backup manual do banco, anota o SHA de retorno e avisa, e **o autor roda `git push origin main`**. Todo `push` com a CI verde é implantado sozinho.

**O que é publicável** (decisão 26, a confirmar): a Fase B sozinha dá ferro e Ferreiro sem exército (as armas ficam paradas); a Fase C dá soldados que comem sem defender; **a primeira publicação recomendada é o fim da Fase E**, quando a formação salva defende uma incursão (critério 1); a segunda, o fim da Fase G (o cerco), que sobe o protocolo; a terceira, o fechamento. Entre publicações as versões do estado se empilham no `main` local, como na v0.3, com o backup de antes do `push` como ponto de retorno. Uma migração chega a partidas vivas: o que um passo dá, tira ou marca é decisão de regra, e a nota de versão diz o que muda para quem já joga (V4I-T4).

**A regra que a v0.3 ensinou e vale aqui:** o portão inteiro (§0.9) roda no commit candidato, pelo código de saída, antes de avisar o autor; a retomada de 2026-10-15 achou 24 testes vermelhos porque uma tarefa não rodou a matriz.

### 0.9 Verificação comum

```bash
pnpm verify                      # lint + typecheck + unit (confira o código de saída, não o tail)
# Se tocar servidor, persistência ou contrato HTTP (primeiro: pnpm dev:up):
TEST_DATABASE_URL=postgres://lotg:lotg@localhost:5433/lotg_test pnpm test:integration
TEST_DATABASE_URL=postgres://lotg:lotg@localhost:5433/lotg_test pnpm test:integration games   # um arquivo: SEM "--"
# Se tocar o app; depois da integração, nunca ao mesmo tempo (dividem o db_test):
pnpm build && pnpm test:e2e
GAME_TIME_SCALE=3 pnpm test:e2e -g "ritmo"
# Se a aba Feudo, a barra de status ou o modo discreto mudarem de aparência:
pnpm capture:landing && pnpm test:e2e:landing
# Se tocar o motor ou o conteúdo: o simulador continua honesto e dentro das faixas
pnpm --filter @lotg/sim-cli test
pnpm -s sim -- --matrix > matriz.csv 2> matriz.md
# Se tocar documentos: o Prettier NÃO confere Markdown; links e âncoras por script
```

Toda tarefa registra no §15: commit, decisões aplicadas, comandos, resultado, o que o autor jogou e o que não foi verificado. **Marcas nos caminhos:** **novo** = o arquivo não existe em `561b0ff`; sem marca = existe.

---

## 1. Fase A — Herança e decisões

**Meta da fase:** antes de qualquer código da v0.4, medir de onde se parte com a v0.3 publicada, fechar o que ela deixou aberto e fechar com o autor as decisões que travam as Fases B, C e D.

Por que primeiro: a v0.3 foi publicada em 2026-10-15 sem a matriz de fechamento completa, sem `--perf`, sem playtest e com o lote 2 fora; ninguém mediu a linha de base depois dela. Sem essa régua não há como dizer, no fim, se a guerra deu destino ao ouro. E a Fase B não começa sem as decisões 1 a 6.

### V4A-T1 · Herança da v0.3, linha de base e caixa de entrada `M`

**Objetivo:** medir a linha de base da v0.4 com a v0.3 publicada, conferir este plano contra o código e abrir a caixa de entrada do autor, no molde de V3A-T1.
**GDD:** §14.3, §14.11, §15.2 a §15.4, §16.2.
**Depende de:** a v0.3.0 no ar (cumprido em 2026-10-15). A tag `v0.3.0` ainda não existe: a tarefa mede o `main` e escreve isso.
**Decisões:** nenhuma. A tarefa não muda regra nem código de jogo; só **registra** o estado das decisões abertas.
**Trilha:** documentos.

**Arquivos:**

| Arquivo | O que a tarefa faz |
|---|---|
| **novo** `docs/balance-v0.4.md` | Seção 1: linha de base da v0.3 publicada (as matrizes nas três dificuldades com os quatro perfis da rodada padrão, `ousado` e `especulador`; o ouro por fonte e por destino; tamanhos; `--perf`), no formato de [balance-v0.3.md](balance-v0.3.md) |
| **novo** `docs/pendencias-v0.4.md` | Caixa de entrada do autor, no formato de [pendencias-v0.3.md](pendencias-v0.3.md): o mais importante em cinco linhas; o que continua aberto da v0.3; o que só o autor pode fazer; as decisões 1 a 26 e os atos 27 a 31 deste roadmap como "a decidir" |
| `docs/roadmap-v0.4.md` (este) | Marca as caixas; preenche a linha V4A-T1 do §15; corrige o Apêndice B.0 onde o código divergir |
| `packages/` | **Nada.** Um defeito achado vira achado no Registro e tarefa de correção, não mudança escondida aqui |

**Subtarefas:**

- [x] V4A-T1.1 **Onde estamos.** `git status -sb`, `git log -5`; `main` contra `origin/main` (em 2026-10-15: `561b0ff` contra `c2cb21e`, um commit de documento à frente); a produção por `GET /v1/version` (`server`, `protocol`, `builtAt`, `contentHash`); se a tag `v0.3.0` existe; as árvores de trabalho e branches sobrando (`git worktree list`; os `worktree-agent-*`, `e2e-fixes`; o `wip/v3f-t1-lote2` **fica**). **Perguntas ao autor**, que o agente não consegue responder (sem acesso ao banco): com o SQL de [deploy/README.md](../deploy/README.md), nenhuma partida ativa ficou abaixo de `schema_version = 24`? O log do job `advance-stale-games` mostra alguma recusa?
- [x] V4A-T1.2 **Os números de versão.** `CURRENT_SCHEMA_VERSION` (24, `packages/engine/src/migrations.ts`), `PROTOCOL_VERSION` (3, `packages/protocol/src/index.ts`), `RNG_VERSION` (1) com `RNG_STREAMS` (`council`, `morale`, `horde`, `tavern`, `market`) e `RNG_STREAM_FAMILIES` (`expedition`, `caravan`) em `random.ts`, `VIEW_FORMAT` (2) e `CACHE_VERSION` (`3.2`) em `packages/web/src/game/gameSession.ts`, `ENGINE_VERSION` e a versão dos pacotes (`0.3.0`), `contentHash` de produção. **O primeiro passo de migração da v0.4 é o 24 → 25.**
- [x] V4A-T1.3 **O mapa.** Conferir o Apêndice B.0 linha a linha contra o código em `packages/engine/src/types.ts`, `advance.ts`, `random.ts`, `raids.ts`, `threat.ts`, `hordeTurn.ts`, `expeditions.ts`, `market.ts`, `equipment.ts`; `packages/content/src/ids.ts`, `balance.ts`, `tiles.ts`, `buildings.ts`, `items.ts`, `expeditions.ts`, `council.test.ts`, `expeditions.test.ts`; `packages/protocol/src/view.ts`, `api.ts`. Corrigir o apêndice onde divergir e registrar a diferença.
- [x] V4A-T1.4 **Os contratos que a v0.4 usa.** (a) A ordem de `processEventsAt` (dezesseis passos, quinze funções: `settleMasterArrivals` roda duas vezes; Apêndice B.0) e onde cada evento novo entra (§0.7); (b) `realToGameMs` e as dez constantes de tempo real de hoje; (c) `settings.timezone` e `settings.vigilHourLocal` já no estado, sem uso no motor, e `games.vigil_hour` na linha: o que falta para a Hora da Vigília ter efeito (um instante de origem em tempo real e a conversão de fuso; decisão 13); (d) o molde dos fluxos por entidade e `dropStream`; (e) `difficulties[].heroCapture` como molde de uma regra por dificuldade (astúcia); (f) `PendingDecisionSchema` com `card` e `crossroads` (o protocolo 4 é da Fase G); (g) o que a visão não pode mostrar (§0.7).
- [x] V4A-T1.5 **Os retratos de estado.** Listar os 44 retratos da versão 24 em `packages/engine/src/__fixtures__/` (598 arquivos `.json` ao todo, das versões 1 a 24), lidos um a um: os três ritmos, as três dificuldades, equipe em expedição, encruzilhada, cativo, soldo em atraso, Mercado com caravana, Covil limpo, Mestre à porta e trabalhando. Dizer o que **falta** para o que a v0.4 vai exigir antes de subir a versão: estoque de madeira e pedra no cap (o ferro vai dividir o Armazém), Torre e Paliçada no nível 2 (os níveis sobem), uma incursão marcada e anunciada (vira batalha), uma partida no outono e uma no inverno (Fortaleza e cerco contam da fronteira).
- [x] V4A-T1.6 **O portão.** `pnpm verify` (pelo código de saída), integração, `pnpm build`, `pnpm test:e2e`, `pnpm test:e2e:landing`, no Node 22 do `.nvmrc`; anotar as contagens e comparar com o portão do commit candidato da v0.3 (`pnpm verify` 136 arquivos, 11.525 testes e 1 falha esperada; integração 27 arquivos, 564; navegador 131; página 37 e 7 pulados) e cada falha com o motivo. **Feito em 2026-10-23 no `main` da Fase C fechada** (`fe50f71`, Node 22.22.3): `pnpm verify` 156 arquivos, 13.802 testes e 1 falha esperada; integração 28 arquivos, 566; navegador 152; página 39 e 7 pulados. Nenhuma falha.
- [x] V4A-T1.7 **Linha de base do simulador.** As matrizes nas três dificuldades (`--matrix`, `--difficulty peasant`, `--difficulty ironKing`), `--profile ousado` e `--profile especulador`; as faixas conferidas contra `MEASURED` (a seção 15 de balance-v0.3.md é a última regravação); **o ouro por fonte e por destino** (`goldTable`), que é a régua da §13; a hora do primeiro herói por perfil contra "primeiro herói no dia 2" (V3G-T1.2 não rodou). Registrar: data, commit, `contentHash`, Node, comandos e saídas, com menor e maior entre as 50 sementes.
- [x] V4A-T1.8 **Tamanho e custo.** Estado e visão no pior caso (seis heróis, três expedições, três relatórios, caravanas, Mestres: a referência da v0.3 é 6,1 a 6,7 kB de estado e 26,6 a 28,8 kB de visão) e `pnpm -s sim -- --perf` (1, 7 e 30 dias reais fora, ritmo 3), contra [perf-v0.1.md](perf-v0.1.md) e balance-v0.3.md, seção 10.6. A carga com 50 bots (`--remote`, contra a API de desenvolvimento) não rodou na v0.3: rodar e registrar p50/p95.
- [x] V4A-T1.9 **Jogar a v0.3.** O autor joga o [roteiro manual da v0.3](manual-test-v0.3.md) (ou os de 15 minutos de pendencias-v0.3.md, seções 7 e 8) e preenche [acceptance-v0.3.md](acceptance-v0.3.md); o que ele entender e não entender vira entrada em `docs/pendencias-v0.4.md`. **Se não acontecer, escrever que a v0.4 começa sem jogar a v0.3** (lição 8).
- [x] V4A-T1.10 **Dívidas.** Passar pela §12 deste roadmap, pela §10 do roadmap da v0.3, pelas seções 5 e 6 de pendencias-v0.3.md e pela §21 de architecture.md: resolvida (com o commit), continua ou nova. Em especial: F-1 a F-6; E-51 a E-60; a tabela do soldo por nível (E-54); o objetivo 12 (F-1); a pendência B-2 da v0.2 (sessões na restauração), nunca levada ao autor.
- [x] V4A-T1.11 **Caixa de entrada do autor.** Criar `docs/pendencias-v0.4.md`: (1) o mais importante, em cinco linhas; (2) o que continua aberto da v0.3; (3) o que só o autor pode fazer (tag `v0.3.0`, conferir a migração, ato 23, jogar, ler o conteúdo, playtest); (4) as decisões 1 a 26 (e os atos 27 a 31) com a premissa recomendada, como "a decidir". É registro: as decisões chegam ao autor como perguntas (§0.6).
- [x] V4A-T1.12 **`CLAUDE.md`.** Listar o que ficou falso nele (hoje diz que a v0.3 está "em execução", lista o estado por fase, a regra 6 barra ferro, exército, cerco e presságio "até a versão deles", cita o `push` da Fase D como pendente e a publicação como por fazer). Quem integra a Fase B atualiza; esta tarefa só entrega a lista.

**Testes:** nenhum teste novo. O que a tarefa roda: a verificação comum inteira; as matrizes; `--perf`; `--remote`; e um roteiro descartável que confere links e âncoras dos documentos tocados.

**Impacto em partidas antigas:** nenhum. Não sobe `schemaVersion`, não toca `content`, não publica.

**Diversão:** nenhuma diretamente. É a régua para dizer, no fim, se a guerra deu destino ao ouro e se o Regular vence o cerco.

**Verificação:**

```bash
nvm use && pnpm dev:up
pnpm verify
TEST_DATABASE_URL=postgres://lotg:lotg@localhost:5433/lotg_test pnpm test:integration
pnpm build
pnpm test:e2e
pnpm test:e2e:landing
pnpm -s sim -- --matrix > a1-lord.csv 2> a1-lord.md
pnpm -s sim -- --matrix --difficulty peasant > a1-peasant.csv 2> a1-peasant.md
pnpm -s sim -- --matrix --difficulty ironKing > a1-ironKing.csv 2> a1-ironKing.md
pnpm -s sim -- --matrix --profile ousado > a1-ousado.csv 2> a1-ousado.md
pnpm -s sim -- --matrix --profile especulador > a1-spec.csv 2> a1-spec.md
pnpm -s sim -- --seed pedra-alta-001 --game-year --time-scale 3 --strategy explorador --sessions-per-day 2 > /dev/null
pnpm -s sim -- --perf
pnpm dev:api &  pnpm -s sim -- --remote http://localhost:3000 --bots 50 --minutes 2
```

Esperado: tudo com saída 0; as três matrizes com 0 (nenhuma partida fora das faixas de `MEASURED`); os números iguais aos da seção 15 de balance-v0.3.md onde o commit é o mesmo.

**Evidência de conclusão:** (1) `docs/balance-v0.4.md` tem a seção 1 com comandos e saídas; (2) `docs/pendencias-v0.4.md` existe e abre com o que decidir primeiro; (3) a linha V4A-T1 do §15 traz as contagens do portão e o que não foi verificado; (4) o Apêndice B.0 está conferido contra o código; (5) a lista do `CLAUDE.md` está escrita; (6) as duas perguntas de V4A-T1.1 têm resposta ou estão nas pendências.

**Pronto quando:** as seis evidências existem, o portão está verde no commit de partida (ou cada falha está registrada com o motivo) e o autor tem em `docs/pendencias-v0.4.md` uma página que diz o que decidir primeiro.

**Prompt sugerido:** "Leia CLAUDE.md, docs/roadmap-v0.4.md (§0, V4A-T1, §11, §12, §13 e Apêndice B.0), docs/retomada-v0.3.md, docs/relatorio-v0.3.md e docs/balance-v0.3.md (seções 14 e 15). A v0.4 não tem nenhuma tarefa executada. Esta tarefa não muda código: confira o Apêndice B.0 contra o código, rode o portão inteiro e as matrizes do simulador, meça os tamanhos, o custo do avanço e a carga, registre a linha de base em docs/balance-v0.4.md e crie docs/pendencias-v0.4.md com as decisões da §11 como perguntas. Me mostre primeiro o ouro por fonte e por destino e o que a v0.3 deixou aberto. Se eu não jogar a v0.3, escreva que não joguei."

### V4A-T2 · Sessão de decisões, lote 1 → ADR 0019 `S`

**Objetivo:** fechar com o autor as decisões que travam as Fases B, C e D e registrá-las.
**Depende de:** V4A-T1 (a sessão usa a linha de base e o que ficou aberto).
**Decisões:** 1 a 14, 25 e 26 (§11.1).
**Trilha:** documentos.
**Entregáveis:** **novo** `docs/decisions/0019-regras-da-v0.4-ferro-exercito-e-combate.md`; GDD §5.1, §5.2, §5.9, §6.1, §6.2, §9.1, §10.1 a §10.5, §10.8, §12.2 corrigidos onde a resposta mudar um número ou uma frase; linha em `docs/decisions/README.md`; §11 deste roadmap com a coluna "Registro".

- [x] V4A-T2.1 **Antes das decisões novas, a herança:** F-1 (objetivo 12), F-3 (o lote 2: decisão 1), F-4 (alarmes acima de 3 por hora), E-54 (a tabela do soldo por nível), E-51 (as marcas de 85% e 115%), a pendência B-2 da v0.2, os atos do autor (tag `v0.3.0`, conferir a migração, ato 23). Uma rodada curta, com a recomendação de cada uma.
- [x] V4A-T2.2 Apresentar as decisões do lote em rodadas curtas (§0.6), pelas que mudam o jogo de quem já joga primeiro: 3 (ferro e Armazém), 7 (soldados e população), 14 (incursão sem exército), 26 (publicação); depois 2, 4, 5, 6, 8 a 13, 25.
- [x] V4A-T2.3 Escrever o ADR 0019 no formato do 0017: tabela decisão, o que foi aplicado, alternativa descartada, razão, tarefas e seção do GDD; o modo de cada resposta (respondida, em bloco, trocada). Estado `aprovada` só com resposta do autor.
- [x] V4A-T2.4 Corrigir o GDD e subir a versão do documento (0.9); onde o GDD diz "60 min", "6 h", "15 min" sem dizer de quê, escrever "de jogo" ou "reais".
- [x] V4A-T2.5 Propor, para aprovação, os números que o GDD não tem e as Fases B e C precisam (§16): preço-base e volume do ferro, o custo e o tempo da forja por nível em frações, a tabela de desgaste, o teto de formações salvas, os tetos de estado. São conteúdo e ficam no ADR como tabela. **Dizer ao autor que não foram lidos, se não forem.**

**Verificação:** links do ADR e do GDD por script; `pnpm lint`.

**Pronto quando:** o ADR 0019 existe e nenhuma tarefa de B, C ou D tem decisão aberta sem resposta.

**Prompt sugerido:** "Leia CLAUDE.md, docs/roadmap-v0.4.md §11 e §0.6, docs/pendencias-v0.4.md e GAME_DESIGN.md §5.1, §5.9, §6.1, §10.1 a §10.5 e §10.8. Vamos fechar o lote 1 em rodadas curtas de perguntas com opções, a recomendada primeiro: a herança da v0.3 (F-1, F-3, F-4, E-51, E-54, B-2, os atos) e depois as decisões 1 a 14, 25 e 26, começando pelas que mudam o jogo de quem já joga. Registre em docs/decisions/0019-…md, corrija o GDD onde a resposta mudar uma frase e atualize a §11 do roadmap. Não preencha nenhuma resposta por suposição."

---
## 2. Fase B — Ferro e Ferreiro

**Meta da fase:** o ferro existe como recurso, chega pela Mina Abandonada e pelo Mercado, e o Ferreiro o transforma em armas e em reparos. É a base de tudo o que vem (sem arma não há Espadachim nem Cavaleiro) e o primeiro teste de arbitragem da versão (lição 2). Nenhuma tarefa da fase tem batalha.

Ordem: **B1 → B2 → B3 → B4 → B5**. O que o autor deve conseguir fazer ao fim: descobrir a Mina Abandonada, voltar com ferro, ver o ferro no Armazém e no Mercado, forjar uma arma enquanto está fora, reparar um item gasto, e entender pela tela o que cada coisa custou.

### V4B-T1 · Ferro: recurso, Mina Abandonada e o ferro no Mercado `L`

**Objetivo:** o ferro como quinto recurso, com cap no Armazém, chegando por uma expedição nova e negociado no Mercado.
**GDD:** §5.1, §5.2, §5.5 (Armazém), §5.9, §9.3 (Mina Abandonada: 40 a 80 de ferro), §14.11.
**Depende de:** V4A-T2 (decisão 3). **Da v0.3 usa:** o motor de expedições e o catálogo (seis modelos, `access` por descoberta, `rewards.resources`), o Mercado (`prices`, `tradedToday`, `quoteDay`, o fluxo `market`, o passeio diário), o armazenamento por recurso (`storage.ts`), `nextId`.
**Decisões:** 3.
**Trilha:** motor.
**Entregáveis:** `packages/content/src/ids.ts` (`RESOURCE_IDS` + `iron`, `MARKET_RESOURCE_IDS` + `iron`, `EXPEDITION_MODEL_IDS` + `abandonedMine`), `balance.ts` (`resources.iron`, `storage` com o Armazém guardando ferro, `market.basePrices.iron` 8.000 milésimos, volume), **novo** `missions/abandonedMine.ts` (três variantes), `expeditions.ts`, `expeditions.test.ts` (afrouxar `ferros?` da expressão regular de propósito, só para a recompensa), `market.test.ts`, `chronicle.ts` (frases com ferro), `objectives.ts` (sem objetivo novo nesta tarefa); `packages/engine/src/types.ts`, `state.ts`, `storage.ts`, `economy.ts`, `market.ts`, `marketOrders.ts`, `marketTurn.ts`, `marketView.ts`, `caravanOrders.ts` (recusa de ferro, se a decisão 3 ficar), `migrations.ts`, **novo** `migrations/v25.ts` e o passo em `migrations/v24.ts`, `test-helpers.ts`, `fixtures.test.ts`; `packages/protocol/src/view.ts`, `commands.ts`, `protocol.test.ts`; `packages/sim-cli/src/bots/policies.ts` (vender ferro parado; o Explorador envia a Mina), `report.ts` (coluna `iron`), `bands.ts`; `packages/web/src/game/gameSession.ts` (`VIEW_FORMAT` não sobe: a visão só cresce); `tests/server/scenarios.test.ts`; README do motor; GDD §5.9.

- [x] V4B-T1.1 Retratos que faltarem (V4A-T1.5) em `fixtures.test.ts` **antes** de subir a versão: Armazém no cap de madeira e pedra; uma partida migrada em Rei de Ferro com Mercado e caravana na estrada.
- [x] V4B-T1.2 Conteúdo: `iron` em `RESOURCE_IDS` e `MARKET_RESOURCE_IDS`; `resources.iron` com rótulo; o Armazém guarda ferro com o mesmo cap de madeira e pedra (GDD §5.5: "cada"); preço-base 8,0 (8.000 milésimos), sem fator de estação; volume `200 × nível` como os outros (decisão 3); **sem caravana de ferro** (`caravanOffer` não o lista; `sendCaravan` com `iron` recusa `INVALID_RESOURCE`) se a decisão ficar como recomendada. Teste de conteúdo: o ferro não aparece em nenhuma recompensa que não seja a Mina Abandonada nem em carta nenhuma.
- [x] V4B-T1.3 Estado 24 → 25: `settlement.resources.iron` e o acumulador, `market.prices.iron`, `previousPrices.iron`, `tradedToday.iron`, `stats.bought_iron`, `sold_iron` (na migração: zero de ferro, preço na base, nada negociado). O passo não cria prazo, evento, identificador nem sorteio. Guarda: ferro nunca negativo, preço dentro do piso e do teto do passeio.
- [x] V4B-T1.4 Motor: o ferro no estoque, no cap, no desperdício (`storageWasted`), no `breakdown` do Armazém e na conta das planejadas (nenhum custo de obra usa ferro nesta tarefa); o passeio diário anda também para o ferro no fluxo `market` (**a ordem dos sorteios por recurso muda**: `food`, `wood`, `stone`, `iron`; o golden do Mercado é regravado de propósito e o diff lido); compra e venda a 85% com o volume do dia; `marketPriceSwing` para o ferro.
- [x] V4B-T1.5 Mina Abandonada (`abandonedMine`): modelo novo com três variantes, no molde do Pântano (requer Guilda Nv2; aparece por descoberta: revelada pela Floresta Antiga (B-8, respondida em 2026-10-16), decisão 3); recompensa de 40 a 80 de ferro no último nó com prova; Desastre marcado nó a nó (`onDisaster`); fichas em **novo** `docs/content-v0.4.md`, seção 1, **rascunho que o autor não leu**; ids fixados em `STABLE_IDS`; calibragem no golden `expedition-calibration.md` e o relatório em `expedition-catalog.json`.
- [x] V4B-T1.6 `ViewState`: `resources.iron` com `breakdown` e `depletesInSeconds`; `storage` com o ferro; `market.prices.iron` com `surplusSellable`; `guild.available[]` com a Mina. Nenhum número de regra no app.
- [x] V4B-T1.7 Propriedade: **nenhuma sequência de compra e venda de ferro no mesmo dia dá lucro** (`market.property.test.ts` ganha o ferro); divisão de intervalo com ferro chegando por expedição e indo ao chão no cap; um ritmo diferente de 1.
- [x] V4B-T1.8 Simulador: o Explorador envia a Mina quando a conhece e vende o ferro que não usa (até a Fase B não há uso: a coluna `iron` sai no CSV, e a faixa do Explorador é remedida de propósito); o `especulador` tenta comprar ferro para revender (prejuízo em toda célula).

**Diversão:** o ferro é o primeiro recurso que o jogador não produz: ele o **acha** ou o **compra**. O teste é o autor saber, pela tela, de onde veio cada unidade.

**Verificação:**

```bash
pnpm --filter @lotg/content test
pnpm --filter @lotg/engine test -- market
pnpm --filter @lotg/engine test -- expeditions
pnpm --filter @lotg/engine test -- storage
pnpm --filter @lotg/engine test -- migrations fixtures
pnpm --filter @lotg/engine test -- purity
TEST_DATABASE_URL=postgres://lotg:lotg@localhost:5433/lotg_test pnpm test:integration games-migration
pnpm --filter @lotg/sim-cli test
```

**Impacto em partidas antigas:** estado **25**. Ninguém ganha ferro; o Armazém passa a guardar um quarto recurso com o mesmo cap, sem mudar o que já está lá; o preço do ferro nasce na base e só anda com o Mercado de pé; a Mina Abandonada aparece por descoberta dali em diante.

**Pronto quando:** o ferro entra por expedição, cabe no Armazém, é negociado no Mercado sem ciclo lucrativo, e o golden do cenário de 7 dias só muda pelo ferro e pela ordem dos sorteios do Mercado.

**Prompt sugerido:** "Leia CLAUDE.md, GAME_DESIGN.md §5.1, §5.5, §5.9 e §9.3, docs/decisions/0019-…md, docs/roadmap-v0.4.md V4B-T1 e Apêndice B, e packages/engine/README.md (Mercado, Expedições, Versões do estado). Apresente o plano por subtarefa (retratos; conteúdo; estado e migração; motor; a Mina Abandonada; visão; propriedade; bots). É tarefa L: um commit por subtarefa. Nada de arma, Ferreiro ou soldado."

### V4B-T2 · Ferreiro e armas `M`

**Objetivo:** o Ferreiro como edifício e a forja como processo: 2 de ferro + 1 de madeira viram 1 arma em 6 min de jogo, mais rápido por nível; a arma é recurso sem cap.
**GDD:** §5.1 (armas), §6.1 (Ferreiro: Salão 4, nível 6, +10% por nível), §6.2 (200 madeira, 200 pedra, 150 ouro, 20 min), §6.3.
**Depende de:** V4B-T1. **Da v0.3 usa:** as filas de obras e a planejada automática (molde da fila de forja), a Taverna e a Guilda como edifícios que nascem no nível 0, `UpgradeView.effect`.
**Decisões:** 4.
**Trilha:** motor.
**Entregáveis:** `packages/content/src/ids.ts` (`BUILDING_IDS` + `smithy`), `buildings.ts`, `balance.ts` (**novo** `smithy`: receita, tempo, fator por nível como fração, lote máximo), `chronicle.ts` (`weaponsForged`, `forgeQueued`, `forgeCancelled`); `packages/engine/src/types.ts`, `state.ts`, **novo** `smithy.ts`, **novo** `smithyOrders.ts`, **novo** `smithyView.ts`, `advance.ts`, `timeline.ts`, `commands.ts` (`forgeWeapons { amount }`, `cancelForge`), `rejections.ts`, `migrations/v26.ts` e o passo em `v25.ts`; protocolo; `sim-cli` (política "forjar com o ferro parado"); README do motor; GDD §6.1.

- [x] V4B-T2.1 Conteúdo: `buildings.smithy` (Salão Nv4; custo e tempo do GDD; nível 6; **todo nível cabe no depósito nas três dificuldades**, com teste); `balance.smithy: { recipe: { iron: 2, wood: 1 }, perWeaponMs: 6 min, speedPerLevel: 1/10, batchMax }` (decisão 4: "+10% de produção por nível" lido como tempo × 10/(10 + nível − 1), em fração); o rótulo do recurso `weapons` (sem cap, como o ouro).
- [x] V4B-T2.2 Estado 25 → 26: `settlement.buildings.smithy` (0 na migração), `settlement.resources.weapons` (0), `settlement.forge: { amount; startedAtMs; endsAtMs } | null` (uma fila, um lote por vez). O passo não cria prazo nem evento.
- [x] V4B-T2.3 Ordem `forgeWeapons { amount }`: cobra ferro e madeira **ao começar o lote** (como uma obra), lote de 1 a `batchMax`; recusas `SMITHY_REQUIRED`, `FORGE_BUSY`, `INVALID_AMOUNT`, `INSUFFICIENT_RESOURCES`. `cancelForge` devolve 80% (a regra das obras). O fim do lote é instante da linha do tempo (`timeline.ts`), resolvido junto das obras concluídas (`finishConstructions`, §0.7), com `weaponsForged` e as armas entrando sem cap.
- [x] V4B-T2.4 `ViewState`: `smithy { built; level; forge: { amount; endsInSeconds } | null; perWeaponSeconds; offer: { maxAmount; costText } }`, `resources.weapons`; `UpgradeView.effect` do Ferreiro diz o que cada nível muda.
- [x] V4B-T2.5 Propriedade: nenhum ciclo lucrativo ferro → arma → (nada: a arma não se vende; o teste confere que não há caminho de volta); divisão de intervalo com um lote terminando no meio; ritmo diferente de 1.
- [x] V4B-T2.6 Simulador: o Explorador ergue o Ferreiro depois do Quartel (a política entra agora e fica inerte até a Fase C) e forja com o ferro parado; coluna `weapons`.

**Diversão:** forjar é a primeira coisa que acontece **enquanto se está fora** e que não é produção contínua. A arma parada na tela é a promessa do Quartel.

**Verificação:**

```bash
pnpm --filter @lotg/content test
pnpm --filter @lotg/engine test -- smithy
pnpm --filter @lotg/engine test -- timeline advance
pnpm --filter @lotg/engine test -- migrations fixtures
TEST_DATABASE_URL=postgres://lotg:lotg@localhost:5433/lotg_test pnpm test:integration scenarios
```

**Impacto em partidas antigas:** estado **26**. O Ferreiro entra no nível 0; quem tem o Salão Nv4 pode erguê-lo na fronteira. Ninguém tem arma.

**Pronto quando:** um lote forja no instante previsto com o jogador fora, a Crônica o registra, a tela diz quanto falta, e o `pnpm verify` continua verde com o Quartel ainda inexistente.

**Prompt sugerido:** "Leia CLAUDE.md, GAME_DESIGN.md §5.1, §6.1 a §6.3, docs/decisions/0019-…md, docs/roadmap-v0.4.md V4B-T2 e Apêndice B. Plano por subtarefa antes de codar: conteúdo, estado e migração, ordem e instante, visão, propriedade, bot. Nada de soldado."

### V4B-T3 · Desgaste e reparo de equipamento `M`

**Objetivo:** o item perde condição a cada uso e o Ferreiro o repara.
**GDD:** §6.1 (Ferreiro: "reparo de equipamentos"), §9.1 (equipamento), ADR 0018 (decisão 15: "sem desgaste nem reparo" na v0.3).
**Depende de:** V4B-T2. **Da v0.3 usa:** `Item`, `Hero.equipment`, `guild.inventory`, `equipItem`/`unequipItem`, o fator de item no poder.
**Decisões:** 5 (se a resposta for "não entra", a tarefa vira registro no §15 e a fase segue).
**Trilha:** motor.
**Entregáveis:** `packages/content/src/items.ts` (`durability` por raridade), `balance.ts` (`equipment.wearPerExpedition`, `wearPerBattle`, `repair: { ironPerPoint; msPerPoint }`), `chronicle.ts` (`itemWorn`, `itemRepaired`); `packages/engine/src/types.ts` (`Item.condition`), `equipment.ts`, `expeditionTurn.ts`, **novo** `repairOrders.ts`, `migrations/v27.ts` e o passo em `v26.ts`; protocolo; README; GDD §9.1.

- [x] V4B-T3.1 Conteúdo: durabilidade por raridade (número de usos), desgaste por expedição e, a partir da Fase D, por batalha em que o herói comanda; reparo custa ferro por ponto e tempo no Ferreiro, na mesma fila da forja (decisão 5).
- [x] V4B-T3.2 Estado 26 → 27: `Item.condition` (na migração, cheio); `settlement.forge` passa a aceitar `kind: 'repair'` com o `itemId`. Guarda: condição entre 0 e a durabilidade da raridade.
- [x] V4B-T3.3 Motor: o desgaste é cobrado no fim da expedição (um ponto por item equipado de quem voltou); um item em 0 não dá bônus e a ficha diz; `repairItem { itemId }` recusa `SMITHY_REQUIRED`, `FORGE_BUSY`, `ITEM_NOT_FOUND`, `ITEM_INTACT`, `INSUFFICIENT_RESOURCES`; o fim do reparo junto das obras.
- [x] V4B-T3.4 `ViewState`: `conditionText` em cada `ItemView`, `repairOffer` com custo e prazo; `heroes[].powerBreakdown` diz o item gasto.
- [x] V4B-T3.5 Testes: desgaste exato por expedição; o item que chega a 0 na expedição em curso; reparo com o jogador fora; o item gasto que é vendido por ouro ao cheio do arsenal (vale o conteúdo, não a condição; decisão 5); golden regravado.

**Diversão:** o item deixa de ser permanente, e o ferro ganha um segundo destino além da arma. O jogador escolhe entre forjar e reparar.

**Verificação:** `pnpm --filter @lotg/engine test -- equipment smithy expeditions migrations fixtures`; `pnpm --filter @lotg/content test`.

**Impacto em partidas antigas:** estado **27**. Todo item entra com a condição cheia; nenhum reparo é devido.

**Pronto quando:** um item se gasta, perde o bônus em 0, é reparado no Ferreiro, e a visão explica cada passo.

**Prompt sugerido:** "Leia CLAUDE.md, GAME_DESIGN.md §6.1 e §9.1, docs/decisions/0019-…md (decisão 5), docs/roadmap-v0.4.md V4B-T3 e Apêndice B. Se a decisão 5 for 'não entra', pare e registre. Senão, plano por subtarefa e testes primeiro."

### V4B-T4 · Ferro, Ferreiro e reparo na interface `M`

**Objetivo:** o jogador vê o ferro no estoque e no Mercado, ergue o Ferreiro, forja e repara pela tela.
**GDD:** §13.2, §13.3, §13.5, §13.6.
**Depende de:** V4B-T1 a V4B-T3 (os nomes do `ViewState` fixados). **Da v0.3 usa:** a aba Mercado (`tabs/Market.tsx`, `components/MarketPanel.tsx`, `ui/market.ts`), a aba Guilda (Arsenal), a árvore, a paleta, `controller.guildOrder`.
**Trilha:** app.
**Entregáveis:** `packages/web/src/tabs/Settlement.tsx` (o ferro no estoque e no Armazém), `tabs/Market.tsx` (o ferro na tabela e na negociação), `tabs/Guild.tsx` (condição e "Reparar…"), **novo** `components/SmithyPanel.tsx` (a aba Feudo ganha o painel do Ferreiro: forja, lote, prazo), `palette/commands.ts` (`lords.forgeWeapons`, `lords.cancelForge`, `lords.repairItem`), `app/controller.ts` (`forgeWeapons`, `cancelForge`, `repairItem` por `guildOrder`, travas `forge` e `repair:<item>`), `ui/treeModel.ts` (a linha "Ferreiro" sob Feudo), `workbench/Tree.tsx`, `game/gameSession.ts` (`nextPollMs`: o fim da forja e do reparo), `game/returnReport.ts` (`weaponsForged`, `itemRepaired` em "O feudo prosperou"), `game/beforeLeaving.ts` (ferro parado: "Vender…"; forja parada com ferro: "Forjar…"), `ui/market.test.ts`, `bundle.test.ts`; `tests/e2e/10-mercado.spec.ts` (o ferro), **novo** `tests/e2e/11-ferreiro.spec.ts`, `tests/e2e/05-teclado-e-temas.spec.ts` (a ordem das setas com a linha nova; lição 12); README do app.

- [x] V4B-T4.1 **Mostrar ao autor** o ferro na tabela do Mercado e o painel do Ferreiro com um lote em curso antes de completar a tela.
- [x] V4B-T4.2 Estoque e Mercado com o ferro; o total da negociação continua `quantidade × preço de hoje` (`ui/market.ts`), a única conta do app.
- [x] V4B-T4.3 Painel do Ferreiro: a obra quando não há Ferreiro; a forja em duas etapas ("Revisar", "Confirmar") como a negociação; o lote em curso com "termina em…" e "Cancelar (devolve 80%)"; o reparo pela ficha do item no Arsenal.
- [x] V4B-T4.4 Árvore, paleta, barra de status (a forja não entra na barra: não é decisão), avisos (`weaponsForged` como "todas"), Retorno e "Antes de partir".
- [x] V4B-T4.5 Navegador: forjar, cancelar, reparar, o ferro negociado, a ordem das setas; o cenário "no ritmo da produção".

**Diversão:** a sessão de dois minutos: vender a madeira parada, comprar ferro, mandar forjar, sair.

**Verificação:** `pnpm --filter @lotg/web test`; `pnpm build && pnpm test:e2e 10-mercado 11-ferreiro 05-teclado-e-temas`; `pnpm capture:landing && pnpm test:e2e:landing` (a aba Feudo muda).

**Impacto em partidas antigas:** nenhum no estado; `VIEW_FORMAT` não sobe (só adições).

**Pronto quando:** os quatro fluxos passam por teclado nos três temas e o pacote do app continua sem número do jogo.

**Prompt sugerido:** "Leia CLAUDE.md, packages/web/README.md, docs/roadmap-v0.4.md V4B-T4 e Apêndice B.4, e o golden da visão com ferro e Ferreiro. Mostre primeiro a tabela do Mercado com o ferro e o painel do Ferreiro. Depois a forja em duas etapas, o reparo, a árvore, a paleta, Retorno, 'Antes de partir' e os cenários em navegador. Nenhum número de jogo no app."

### V4B-T5 · Revisão independente e medição da Fase B `S`

**Objetivo:** revisão de leitura por um agente que não escreveu o código (Apêndice A.4), correções um commit por defeito, a rodada do simulador e o relatório gravado.
**Depende de:** V4B-T1 a V4B-T4.
**Entregáveis:** **novo** `docs/reviews/v0.4-fase-b.md`; correções `V4B: corrige …`; `docs/balance-v0.4.md`, seção 2; `docs/pendencias-v0.4.md`; `CLAUDE.md` e `docs/architecture.md` atualizados pela integração.

- [x] V4B-T5.1 Revisor independente sobre os commits da fase. Tenta: comprar ferro e vender no mesmo dia; forjar com o lote terminando no instante de uma obra; cancelar a forja duas vezes; reparar um item equipado por um herói em expedição; migração de uma partida com estoque no cap e caravana na estrada; o ferro em `caravanOffer`; o preço do ferro na visão sem Mercado.
- [x] V4B-T5.2 Corrige os confirmados, cada um com teste de regressão; classifica o resto; registra no §15.
- [x] V4B-T5.3 Simulador: as três matrizes, `especulador`, o ouro por fonte e por destino (o ferro comprado é o primeiro sumidouro novo: §13); faixas remedidas de propósito onde a regra mudou.
- [x] V4B-T5.4 Integração: portão inteiro, `CLAUDE.md`, `architecture.md`, README do motor e do app; linha "V4B (integração)" no §15. **Sem `push`.**
- [x] V4B-T5.5 O autor joga a fase (roteiro de 15 minutos em `docs/pendencias-v0.4.md`). Se não jogar, fica registrado.

**Pronto quando:** cada defeito confirmado tem teste e correção, o relatório está no repositório, a matriz está dentro das faixas regravadas e o Registro diz o que não foi verificado.

**Prompt sugerido:** "Leia CLAUDE.md e docs/roadmap-v0.4.md V4B-T5. Lance um revisor com o prompt do Apêndice A.4 sobre os commits da Fase B; grave o relatório em docs/reviews/v0.4-fase-b.md; corrija cada defeito confirmado em um commit próprio com teste; rode as matrizes e registre em docs/balance-v0.4.md, seção 2."

---

## 3. Fase C — Quartel, exército e formações

**Meta da fase:** o feudo treina soldados, que saem da população e comem mais, e o jogador monta e salva formações com um herói comandando cada ala. Ainda não há batalha: a formação salva é a promessa da Fase D e a Defesa ativa, a da Fase E. É a fase que cria o maior custo contínuo novo (comida dos soldados) e o primeiro destino novo do ouro (treino).

### V4C-T1 · Quartel e soldados `L`

**Objetivo:** o Quartel como edifício, as cinco unidades treináveis como conteúdo, o treino sequencial em lotes e os soldados como habitantes que não trabalham.
**GDD:** §5.2 (1,5 de comida por soldado por hora), §6.1 (Quartel: Salão 4, nível 8, limite 10 × nível, treino 5% mais rápido por nível), §6.2 (150 madeira, desde a resposta do autor à C-1; 150 pedra, 100 ouro, 20 min), §10.2 (as unidades), §17.1 ("soldados saem da população").
**Depende de:** V4B-T2 (armas). **Da v0.3 usa:** `population.villagers`, `inhabitants` e o piso (`masters.ts`), a fila de recrutamento (molde do treino), a conta única da produção em frações, `heroCapture` por dificuldade (molde de regra por dificuldade).
**Decisões:** 7.
**Trilha:** motor.
**Entregáveis:** `packages/content/src/ids.ts` (`BUILDING_IDS` + `barracks`, **novo** `UNIT_IDS`: `spearman`, `swordsman`, `archer`, `knight`, `shieldbearer`; `militia` só na Fase G), **novo** `units.ts` (a tabela do §10.2 e o ciclo de contra-ataques, com teste), `buildings.ts`, `balance.ts` (**novo** `army`: `capPerLevel: 10`, `trainingSpeedPerLevel: 1/20`, `batchMax: 10`, `foodPerSoldierPerHour: 3/2`, `formationsCap`), `chronicle.ts` (`trainingStarted`, `soldiersTrained`, `soldiersDisbanded`); `packages/engine/src/types.ts`, `state.ts`, **novo** `army.ts` (contas puras: limite, custo, comida), **novo** `armyOrders.ts`, **novo** `armyTurn.ts`, **novo** `armyView.ts`, `economy.ts` (a comida dos soldados no consumo), `population.ts`, `masters.ts` (`inhabitants` soma soldados), `famine.ts` (quem deserta por fome: só aldeões; decisão 7), `advance.ts`, `timeline.ts`, `commands.ts` (`trainSoldiers { unit, amount }`, `cancelTraining`, `disbandSoldiers { unit, amount }`), `rejections.ts`, `migrations/v28.ts` e o passo em `v27.ts`; protocolo; `sim-cli` (bot `militar`, V4C-T1.8); README; GDD §10.2.

- [x] V4C-T1.1 Retratos que faltarem antes de subir a versão: um feudo com as casas cheias e um com fome aberta (os soldados mudam as duas contas).
- [x] V4C-T1.2 Conteúdo: `buildings.barracks` (Salão Nv4; nível 8; **cada nível cabe no depósito nas três dificuldades**, com teste); as cinco unidades com atributos inteiros, iniciativa, linha, custo e tempo de treino do §10.2; o ciclo de contra-ataques como tabela (`counters: Record<UnitId, UnitId>`) e o Escudeiro neutro; teste de conteúdo: todo custo com arma pede uma arma inteira, nenhuma unidade custa ferro direto.
- [x] V4C-T1.3 Estado 27 → 28: `settlement.buildings.barracks` (0), `army: { units: Record<UnitId, number>; training: { unit; amount; startedAtMs; endsAtMs } | null; reportsKept… (fica para a Fase D) }`. Guarda: soma das unidades ≤ `capPerLevel × nível`, nenhuma unidade com o Quartel no 0.
- [x] V4C-T1.4 Ordem `trainSoldiers { unit, amount }`: um lote por vez, de 1 a 10, sequencial; cobra comida, ouro, madeira, pedra e armas ao começar; **o soldado sai da população ao terminar o treino** (decisão 7: um aldeão sem ofício vira soldado; com todos ocupados, sai do edifício com mais gente, a regra dos feridos) e precisa de vaga habitacional (que já tem: já morava); recusas `BARRACKS_REQUIRED`, `TRAINING_BUSY`, `ARMY_LIMIT`, `NOT_ENOUGH_VILLAGERS` (o piso de 3 aldeões protege), `INVALID_AMOUNT`, `INSUFFICIENT_RESOURCES`. `cancelTraining` devolve 80%. `disbandSoldiers` devolve aldeões sem ofício, sem devolução de custo.
- [x] V4C-T1.5 Consumo: 1,5 de comida por soldado por hora de jogo, somado ao consumo dos habitantes em `netRates`; o `breakdown` da comida diz "−15/h (10 soldados)"; a fome alcança os soldados? (decisão 7: a fome corta a produção e deserta aldeões; soldados **não** desertam por fome nem por moral, mas comem).
- [x] V4C-T1.6 Instante: o fim do treino na linha do tempo, resolvido junto dos recrutas que chegam (`finishRecruitments`), antes dos Mestres à porta (§0.7), com teste do instante exato e a razão no README.
- [x] V4C-T1.7 `ViewState`: `army { built; level; cap; units: Array<{ id; label; count; stats; counters; costText; foodPerHour }>; training: { unitLabel; amount; endsInSeconds } | null; offer: Array<{ unit; maxAmount; blockedReason }> }`; `population` ganha `soldiers`; `food.breakdown` com o termo.
- [x] V4C-T1.8 Simulador: bot **`militar`** (GDD §15.3: o `economico` mais erguer o Quartel e o Ferreiro, treinar com o que o ferro e a comida permitem; as políticas de formação entram em V4C-T2) e, **nos três bots da rodada padrão**, a política mínima de guerra que a decisão 25 fixar (o Regular tem de chegar ao cerco com exército para a faixa de 65 a 80% fazer sentido). Colunas `soldiers`, `soldiers_by_unit`, `training_batches`, `army_food`. Faixas remedidas de propósito.
- [x] V4C-T1.9 Propriedade: divisão de intervalo com treino terminando e fome abrindo no caminho; a comida nunca negativa; soldado + aldeão + Mestre nunca acima das casas; nenhum ciclo lucrativo aldeão → soldado → aldeão (dispensar não devolve nada).

**Diversão:** a militarização é uma troca econômica real (GDD §17.1): cada soldado é um braço a menos e uma boca e meia a mais. O teste é o autor olhar a comida e dizer por quanto tempo ela sustenta o exército.

**Verificação:**

```bash
pnpm --filter @lotg/content test
pnpm --filter @lotg/engine test -- army
pnpm --filter @lotg/engine test -- economy population famine
pnpm --filter @lotg/engine test -- economy.property
pnpm --filter @lotg/engine test -- migrations fixtures
TEST_DATABASE_URL=postgres://lotg:lotg@localhost:5433/lotg_test pnpm test:integration scenarios
pnpm --filter @lotg/sim-cli test
```

**Impacto em partidas antigas:** estado **28**. O Quartel entra no nível 0 e o exército, vazio; a comida de ninguém muda na fronteira.

**Pronto quando:** um lote treina no instante previsto com o jogador fora, os soldados comem, o piso protege os aldeões, e a matriz continua dentro das faixas regravadas.

**Prompt sugerido:** "Leia CLAUDE.md, GAME_DESIGN.md §5.2, §6.1, §10.2 e §17.1, docs/decisions/0019-…md (decisão 7), docs/roadmap-v0.4.md V4C-T1 e Apêndice B. É tarefa L: plano por subtarefa, um commit por subtarefa, testes primeiro. Nada de formação, batalha ou milícia."

### V4C-T2 · Formações salvas, Defesa ativa e comandantes `M`

**Objetivo:** o jogador monta formações de seis postos, nomeia um herói por ala, salva com nome e marca uma como Defesa ativa. Ainda sem batalha: a formação é dado.
**GDD:** §10.1 (o campo: 3 alas × 2 linhas, máximo 20 por posto, 30 com Quartel Nv5+; comandante por ala), §10.8 (formações salvas e Defesa ativa), §9.1 ("comandante de ala"), §13.4.
**Depende de:** V4C-T1. **Da v0.3 usa:** `Hero.status`, `HERO_BUSY`, `eligibleHeroIds` como molde, `nextId`.
**Decisões:** 8, 9.
**Trilha:** motor.
**Entregáveis:** `packages/content/src/ids.ts` (`WING_IDS`: `left`, `center`, `right`; `LINE_IDS`: `front`, `rear`), `balance.ts` (`army.formationsCap`, `postMax: 20`, `postMaxFromLevel: { level: 5, max: 30 }`), `chronicle.ts` (`formationSaved`, `formationActivated`, `formationDeleted`); `packages/engine/src/types.ts` (`Formation`), **novo** `formations.ts` (validação pura: unidades somam ≤ as que existem, linha certa por unidade, comandante elegível), `armyOrders.ts` (`saveFormation { id|null, name, posts, commanders }`, `deleteFormation`, `setActiveFormation`), `heroes.ts` (o herói comandante na formação ativa: `HERO_BUSY` ao enviar, se a decisão 8 ficar), `expeditionOrders.ts`, `caravanOrders.ts`, `armyView.ts`, `migrations/v29.ts` e o passo em `v28.ts`; protocolo; `sim-cli` (o `militar` monta uma formação com o que tem e a ativa; o Regular, pela decisão 25); README; GDD §10.8.

- [x] V4C-T2.1 Estado 28 → 29: `army.formations: Formation[]` (`id` de `nextId(draft, 'formation')`, `name`, `posts: Record<Wing, Record<Line, { unit; count } | null>>`, `commanders: Record<Wing, heroId | null>`), `army.activeFormationId: string | null`. Teto `formationsCap`. Guarda: contagens ≤ `postMax`, comandante existe e não está capturado.
- [x] V4C-T2.2 Validação: uma formação pode pedir mais unidades do que o feudo tem (ela é um plano; a prévia e a batalha preenchem o que há e avisam: GDD §10.8, "postos vazios por falta de unidades"); a linha de cada unidade é fixa (Arqueiro só atrás); o mesmo herói não comanda duas alas; o herói em expedição, escolta, ferido ou capturado não pode ser nomeado (`HERO_UNAVAILABLE`); **nomear o herói na formação ativa o impede de partir** (`HERO_BUSY` em `sendExpedition` e `sendCaravan`; decisão 8), e dispensá-lo o tira da formação.
- [x] V4C-T2.3 Ordens `saveFormation`, `deleteFormation` (não a ativa: `FORMATION_ACTIVE`), `setActiveFormation`; recusas `FORMATION_NOT_FOUND`, `FORMATIONS_CAP`, `INVALID_FORMATION` com a frase do que está errado. Nenhuma sorteia nem cria instante.
- [x] V4C-T2.4 `ViewState`: `army.formations[]` com `posts` rotulados, `commanders` com nome e classe, `shortfall` (o que falta de cada unidade), `isActive`; `army.editor: { units: disponíveis; heroes: elegíveis com o motivo; postMax }`; `guild.heroes[].commanding` (a ala e a formação); `pendingDecisions` **não** muda.
- [x] V4C-T2.5 Testes: salvar, editar, apagar, ativar; o comandante que parte em expedição; o cativo que era comandante; a formação que fica com postos vazios quando soldados são dispensados; golden.

**Diversão:** montar a formação é o quebra-cabeça da versão (GDD §17.1). Nesta fase ele ainda não é testado contra ninguém; o Conselho de Guerra (Fase D) é o que o torna legível.

**Verificação:** `pnpm --filter @lotg/engine test -- formations army heroes expeditions migrations fixtures`; integração `scenarios`.

**Impacto em partidas antigas:** estado **29**. `formations` vazia, sem Defesa ativa; ninguém muda de estado.

**Pronto quando:** uma formação salva sobrevive a recarregar a partida, o comandante não parte, e a visão diz o que falta em cada posto.

**Prompt sugerido:** "Leia CLAUDE.md, GAME_DESIGN.md §10.1, §10.8 e §13.4, docs/decisions/0019-…md (decisões 8 e 9), docs/roadmap-v0.4.md V4C-T2 e Apêndice B. Plano por subtarefa antes de codar. A formação é dado: nenhuma batalha nesta tarefa."

### V4C-T3 · Quartel, exército e editor de formação na interface `L`

**Objetivo:** a aba **Exército** (`#/exercito`, fixa depois do Mercado) com o Quartel, o treino e o editor de formação do GDD §13.4, sem a prévia (Fase D).
**GDD:** §13.2, §13.4, §13.5, §13.6.
**Depende de:** V4C-T1 e V4C-T2. **Da v0.3 usa:** o molde das abas Guilda e Mercado, `guildOrder`, a conferência em duas etapas, `oneAtATime`.
**Trilha:** app.
**Entregáveis:** **novo** `packages/web/src/tabs/Army.tsx`, **novos** `components/BarracksPanel.tsx`, `components/FormationEditor.tsx` (seis postos, seletor de tipo e quantidade com teclado, setas entre postos, `Enter` edita; arrastar é opcional e **não entra**), `components/FormationList.tsx`, **novo** `ui/army.ts` (textos e contas de apresentação: nenhuma regra), `palette/commands.ts` (`lords.trainSoldiers`, `lords.cancelTraining`, `lords.disbandSoldiers`, `lords.saveFormation`, `lords.setActiveFormation`, `lords.deleteFormation`, `lords.openArmy`), `app/controller.ts`, `app/router.ts`, `ui/treeModel.ts` (linha "Exército · 12 soldados · Defesa: Muralha Firme"), `workbench/Tree.tsx`, `game/gameSession.ts` (o fim do treino em `nextPollMs`), `game/returnReport.ts`, `game/beforeLeaving.ts` (sem Defesa ativa com soldados: "Ativar uma formação"), `bundle.test.ts`; **novo** `tests/e2e/12-exercito.spec.ts`, `05-teclado-e-temas.spec.ts`; README do app.

- [x] V4C-T3.1 **Mostrar ao autor** o editor com uma formação de três postos antes de completar a tela.
- [x] V4C-T3.2 Painel do Quartel: a obra; as unidades com custo, comida, contra quem é forte e fraca (do `ViewState`); o treino em duas etapas; o lote em curso; dispensar com confirmação.
- [x] V4C-T3.3 Editor: a grade do §13.4 sem a linha inimiga (Fase D a traz com `?`); o posto como botão (papel `gridcell`), o seletor como diálogo com foco por `useLayoutEffect`; o comandante por ala com o motivo de quem não pode; o estado da montagem é da tela e a ordem nasce em "Salvar"; "Ativar como Defesa"; a lista das salvas.
- [x] V4C-T3.4 Árvore, paleta, barra de status (sem Defesa ativa com exército é aviso, não decisão), Retorno, "Antes de partir".
- [x] V4C-T3.5 Navegador: treinar, cancelar, montar e salvar por teclado, ativar, o comandante que não parte, a ordem das setas da árvore, os três temas, 720 px.

**Diversão:** o editor tem de ser mais rápido de usar do que de explicar: seis postos, três comandantes, um botão.

**Verificação:** `pnpm --filter @lotg/web test`; `pnpm build && pnpm test:e2e 12-exercito 05-teclado-e-temas 09-guilda`; `pnpm capture:landing && pnpm test:e2e:landing`.

**Impacto em partidas antigas:** nenhum no estado; `VIEW_FORMAT` não sobe.

**Pronto quando:** uma formação é montada e ativada só pelo teclado, nos três temas, e o pacote do app não leva número nenhum das unidades.

**Prompt sugerido:** "Leia CLAUDE.md, packages/web/README.md, GAME_DESIGN.md §13.4, docs/roadmap-v0.4.md V4C-T3 e Apêndice B.4, e os goldens da visão com exército. Mostre primeiro o editor com três postos. É tarefa L: um commit por subtarefa. Sem prévia, sem linha inimiga, sem arrastar."

### V4C-T4 · Revisão independente e medição da Fase C `S`

Como V4B-T5, sobre a Fase C. **Entregáveis:** **novo** `docs/reviews/v0.4-fase-c.md`; correções `V4C: corrige …`; `docs/balance-v0.4.md`, seção 3; integração e `CLAUDE.md`.

- [x] V4C-T4.1 O revisor tenta: treinar com as casas cheias; o soldado e o piso de 3; a fome com soldados; dispensar durante o treino; o comandante dispensado, capturado ou que parte em caravana; duas abas salvando a mesma formação; a migração de uma partida com fome aberta; o número de unidades no pacote do app.
- [x] V4C-T4.2 Correções com teste; relatório no repositório; Registro.
- [x] V4C-T4.3 **A medição do ouro** (§13): o ouro por fonte e por destino com o treino e o ferro; **volta ao autor com propostas concretas** antes da Fase D (decisão 2).
- [x] V4C-T4.4 Integração: portão, `CLAUDE.md`, `architecture.md`, READMEs; linha no §15. Sem `push` (decisão 26).
- [x] V4C-T4.5 O autor joga a fase (roteiro em `docs/pendencias-v0.4.md`), ou fica registrado que não jogou.

**Pronto quando:** como V4B-T5, mais a medida do ouro entregue ao autor.

**Prompt sugerido:** como V4B-T5, trocando a fase.

---
## 4. Fase D — Combate e Conselho de Guerra

**Meta da fase:** o motor de batalha do GDD §10.4, determinístico e em inteiros, com a prévia que usa o mesmo código (critério 2), o relatório com os três fatores decisivos e o herói comandante com aura. Nenhuma incursão usa a batalha ainda (Fase E): a fase entrega o Conselho de Guerra, que é como o jogador aprende o sistema antes de ele ter consequência. É a tarefa de maior risco de regra da versão depois do Cerco, e por isso tem golden antes do código e revisão independente antes de qualquer tela.

### V4D-T1 · O motor de batalha `L`

**Objetivo:** `resolveBattle(defender, attacker, field, rng)` como função pura: até 12 rodadas, iniciativa, contra-ataques, muralha, torres, auras, flanco, moral e debandada, em inteiros e frações, com o relatório rodada a rodada.
**GDD:** §10.1 a §10.4, §10.7, Apêndice A.
**Depende de:** V4C-T2. **Da v0.3 usa:** a resolução de nó por multiplicação cruzada (molde das contas), `heroes.ts` (atributos e poder), os fluxos por entidade e `dropStream`, `hash.ts`.
**Decisões:** 10, 11.
**Trilha:** motor.
**Entregáveis:** `packages/content/src/units.ts` (inimigos do §10.3: `wolf`, `raider`, `banditArcher`, `blackKnight`, `ogre`, `skeleton`, `shaman`, `warlord`; regras especiais como dados), `balance.ts` (**novo** `battle`: `maxRounds: 12`, `luck: { min: 90, max: 110 }`, `absorb: 1/2`, `minDamage: 1/5`, `flank: 5/4`, `counter: 3/2`, `moralePerSquad: -10`, `moralePerWing: -20`, `moralePerCommander: -15`, `routBelow: 30`, as auras por classe, `towerDamagePerLevelAbove2: 12`, `wallHpPerLevel`), `chronicle.ts` (`battleFought`); **novos** `packages/engine/src/battle.ts` (a resolução), `battleReport.ts` (os três fatores por atribuição de dano, as baixas, o dano à muralha, a XP dos comandantes), `battle.test.ts`, `battle.property.test.ts`, `__golden__/battle-*.md` (um por cenário: paliçada contra lobos, flanco, contra-ataque, Ogro e muralha, debandada, 12 rodadas "Resistiu", Senhor da Guerra); `types.ts` (`BattleReport`), `migrations/v30.ts` e o passo em `v29.ts` (`army.reports`, `army.reportsKept`); README do motor ("Batalha"); GDD §10.4.

- [x] V4D-T1.1 **Goldens primeiro:** sete cenários escritos à mão a partir do §10.4, com a conta feita no documento (`docs/content-v0.4.md`, seção 3), antes de uma linha do motor.
- [x] V4D-T1.2 Conteúdo: os oito inimigos com arquétipo, atributos, iniciativa, linha e regra especial como dado (`alwaysLateral`, `ignoresWallHalf`, `noMorale`, `auraWing`, `auraArmy`, `endsWaveOnDeath`, `takesDoubleFrom: ['mage', 'cleric']`); teste: todo arquétipo tem contra-ataque definido.
- [x] V4D-T1.3 A resolução, em inteiros: ordenação por iniciativa com desempate pelo lado defensor e, dentro do lado, por ala e linha (decisão 11); alvo (Frente, Retaguarda, flanco ×5/4); dano bruto `atq × n × contra × aura × flanco × cobertura × sorte` com a sorte sorteada **uma vez por esquadrão por rodada** no fluxo da batalha; absorvido `def × n × 1/2`; efetivo `máx(bruto − absorvido, bruto × 1/5)`; baixas `piso((efetivo + residual) / vida)` com o residual guardado por esquadrão; Escudeiros absorvem 50% do dano à Retaguarda da ala; corpo a corpo bate na muralha até rompê-la (Ogro: metade); arqueiros inimigos ignoram a muralha a ×7/10; arqueiros do jogador atrás de muralha intacta ×6/5; torres (12 por nível acima de 2) por ala por rodada; Mago em área a cada 3 rodadas e ×2 contra mortos-vivos; Clériga cura 10% da Frente a cada 2 rodadas e +20 de moral; moral −10, −20, −15, debandada em ≤ 30 (mortos-vivos e o chefe sem moral); fim por lado sem esquadrões, debandada ou 12 rodadas ("Resistiu" em defesa; o atacante recua em ataque); o comandante só sofre dano quando a Frente da ala cai, e **nunca morre fora de Rei de Ferro** (`heroCapture` decide).
- [x] V4D-T1.4 O sorteio: a batalha recebe um fluxo nomeado (`battle:<id>`, família nova em `RNG_STREAM_FAMILIES`, apagado no fim do instante) e consome a sorte em ordem fixa; **a mesma entrada dá o mesmo relatório** (golden), e a ordem das batalhas de um instante é a do identificador.
- [x] V4D-T1.5 O relatório: por rodada (ataques, baixas, muralha, moral) e, no topo, os três fatores decisivos por atribuição de dano (muralha absorvida, contra-ataque, retaguarda exposta, flanco, torre, aura), como dados que a visão transforma em frase; baixas por posto; dano à muralha; XP dos comandantes (`expeditions.xpShare` como molde); `army.reports` com teto `reportsKept` (3).
- [x] V4D-T1.6 Estado 29 → 30: `army.reports: BattleReport[]` (vazio), `army.reportsKept` no conteúdo. Nenhum outro campo: a muralha com HP é da Fase E.
- [x] V4D-T1.7 Propriedade: a batalha termina em ≤ 12 rodadas para qualquer entrada válida; baixas nunca passam dos efetivos; o relatório é função da entrada e do fluxo; a divisão de intervalo não muda uma batalha (ela é instantânea).

**Diversão:** indireta. É o que faz a prévia e o relatório não mentirem.

**Verificação:**

```bash
pnpm --filter @lotg/content test
pnpm --filter @lotg/engine test -- battle
pnpm --filter @lotg/engine test -- random purity
pnpm --filter @lotg/engine test -- migrations fixtures
UPDATE_GOLDEN=1 pnpm --filter @lotg/engine test -- battle   # só na primeira gravação; conferir o diff
```

**Impacto em partidas antigas:** estado **30**. `army.reports` vazia; nenhuma batalha acontece por migração.

**Pronto quando:** os sete goldens batem com a conta feita à mão, a propriedade vale, e nenhuma incursão ainda chama a batalha.

**Prompt sugerido:** "Leia CLAUDE.md, GAME_DESIGN.md §10.1 a §10.4, §10.7 e Apêndice A, docs/decisions/0019-…md (decisões 10 e 11), docs/roadmap-v0.4.md V4D-T1 e Apêndice B. Escreva os sete goldens com a conta à mão em docs/content-v0.4.md antes do motor. É tarefa L: um commit por subtarefa. Tudo em inteiros e frações; a sorte é um inteiro de 90 a 110."

### V4D-T2 · Conselho de Guerra: a prévia `M`

**Objetivo:** "Simular" roda 200 batalhas com sementes fixas contra o inimigo provável e devolve Vitória, Gloriosa, Derrota, o risco principal e as perdas esperadas por posto, com o mesmo código da batalha real.
**GDD:** §10.5, §13.4, §12.2 (objetivo "Simule uma batalha").
**Depende de:** V4D-T1. **Da v0.3 usa:** `hash.ts` (a variante do grafo sem sorteio: o molde das 200 sementes), `purity.test.ts`.
**Decisões:** 10.
**Trilha:** motor.
**Entregáveis:** **novo** `packages/engine/src/warCouncil.ts` (`previewBattle`: as 200 sementes derivadas de `hash(seed, formationId, enemySample)`; a amostra do inimigo a partir do que se sabe; o agregado), `armyOrders.ts` (`simulateBattle { formationId }`, se a decisão 10 ficar como recomendada), `armyView.ts`, `balance.ts` (`battle.previewRuns: 200`), `chronicle.ts` (`battleSimulated`, escondido da Crônica), `objectives.ts` (o contador `battlesSimulated`); protocolo; README.

- [x] V4D-T2.1 A amostra do inimigo: o que se sabe (nesta fase, nada: a Horda é da Fase E; a prévia usa a composição-base da estação, Apêndice A, com `?` nos postos sem informação); cada uma das 200 batalhas preenche o desconhecido com uma amostra da composição provável, sorteada em um gerador **próprio da prévia**, semeado por `hash`, nunca `state.rng` (decisão 10).
- [x] V4D-T2.2 A ordem `simulateBattle { formationId }`: não sorteia no fluxo do estado, não cria entidade, grava `army.preview { formationId; atMs; wins; glorious; losses; risk; expectedLosses }` (um por vez; o anterior é substituído) e conta em `stats.battlesSimulated` (o objetivo da Fase H). Recusas `FORMATION_NOT_FOUND`, `BARRACKS_REQUIRED`. **`purity.test.ts` ganha a exceção explícita**: `warCouncil.ts` pode usar o gerador com semente derivada dentro de um comando, e o teste prova que `state.rng` sai igual ao que entrou.
- [x] V4D-T2.3 Critério 2 como teste: para uma composição inimiga totalmente conhecida, `previewBattle` com uma semente igual à da batalha real dá o mesmo relatório que `resolveBattle` (golden compartilhado).
- [x] V4D-T2.4 `ViewState`: `army.preview` com `winsPercent`, `gloriousPercent`, `lossesPercent`, `riskText` (montado no motor a partir do fator), `expectedLosses` por posto, `knownEnemy` por posto com `?`; `army.formations[].previewStale` quando a formação mudou depois.
- [x] V4D-T2.5 Simulador: o `militar` simula antes de ativar e troca a formação se a prévia der menos de 50% (política que lê só a visão).

**Diversão:** a prévia **ensina** (GDD §10.5). O teste é o autor entender, por uma frase, por que a ala esquerda cai.

**Verificação:** `pnpm --filter @lotg/engine test -- warCouncil battle purity`; integração `commands` (o reenvio devolve o recibo).

**Impacto em partidas antigas:** `army.preview` nasce `null` no passo da V4D-T1 (mesma versão 30 se as duas tarefas fecharem juntas; senão, 31).

**Pronto quando:** a prévia com inimigo conhecido é igual à batalha real, 200 simulações custam menos de 50 ms no ritmo 3 (`--perf`), e a visão traz o risco em uma frase.

**Prompt sugerido:** "Leia CLAUDE.md, GAME_DESIGN.md §10.5 e §13.4, docs/decisions/0019-…md (decisão 10), docs/roadmap-v0.4.md V4D-T2. A prévia usa o mesmo código da batalha e nunca o gerador do estado. Escreva primeiro o teste do critério 2."

### V4D-T3 · Comandantes, auras e o relatório de batalha na Crônica `S`

**Objetivo:** o herói comandante conta na batalha (auras do §10.1), ganha experiência e pode ser ferido; o relatório vira linhas da Crônica e evento com os três fatores.
**GDD:** §10.1 (auras), §10.4 (dano ao comandante), §8.2 (`[v0.4]` "repelir incursões dá experiência aos heróis-comandantes"), §10.7.
**Depende de:** V4D-T1, V4D-T2. **Da v0.3 usa:** `Hero.injury`, `heroLeveledUp`, `xpToNext`, o desgaste de item (V4B-T3).
**Trilha:** motor.
**Entregáveis:** `packages/content/src/heroes.ts` (`aura` por classe, como dado), `balance.ts` (`battle.commanderXp`), `chronicle.ts` (`battleFought` com `{fatores}`; `commanderInjured`); `packages/engine/src/battle.ts`, `battleReport.ts`, `heroes.ts`, `expeditionTurn.ts` (o desgaste por batalha); `expeditions.test.ts`.

- [x] V4D-T3.1 As auras como fatores de fração aplicados à ala; o Mago em área; a Clériga curando; a frase da ficha do herói diz o que ele dá como comandante.
- [x] V4D-T3.2 O comandante sofre dano quando a Frente cai: ferimento leve ou grave pela parte do dano (`heroCapture` em Rei de Ferro: morte); XP por batalha a quem comandou; o desgaste do equipamento por batalha.
- [x] V4D-T3.3 O evento `battleFought` com os três fatores como dados e a frase; `CHRONICLE_HIDDEN_EVENT_TYPES` ganha `battleSimulated`.

**Verificação:** `pnpm --filter @lotg/engine test -- battle heroes chronicle`.

**Impacto em partidas antigas:** nenhum (adição).

**Pronto quando:** uma formação com Clériga no centro dura mais rodadas no golden do que sem, e a ficha do herói diz por quê.

### V4D-T4 · O Conselho de Guerra na interface `M`

**Objetivo:** o editor ganha a linha inimiga com `?`, o botão "Simular", o bloco do Conselho de Guerra (§13.4) e o relatório de batalha com "Ajustar formação".
**Depende de:** V4D-T2, V4D-T3, V4C-T3.
**Trilha:** app.
**Entregáveis:** `packages/web/src/tabs/Army.tsx`, `components/FormationEditor.tsx` (a linha "Inimigo (prev.)"), **novos** `components/WarCouncilPanel.tsx`, `components/BattleReport.tsx` (por rodada colapsável, os três fatores no topo), `ui/army.ts`, `palette/commands.ts` (`lords.simulateBattle`), `app/controller.ts`, `game/returnReport.ts` (`battleFought` em "O que exigiu um preço"), `tests/e2e/12-exercito.spec.ts`; README do app.

- [x] V4D-T4.1 **Mostrar ao autor** a prévia de uma formação antes do resto.
- [x] V4D-T4.2 "Simular" como ordem com trava `preview:<formação>`; o bloco com Vitória, Gloriosa, Derrota e o risco em uma frase; "prévia desatualizada" quando a formação mudou.
- [x] V4D-T4.3 O relatório: rodadas colapsáveis, fatores, baixas, muralha, XP; "Ajustar formação" leva ao editor com a formação usada.
- [ ] V4D-T4.4 Navegador: simular, ler o relatório (posto por `/__test/battle`, rota de teste nova em `tests/e2e/server.ts`), teclado, temas.

**Verificação:** `pnpm --filter @lotg/web test`; `pnpm build && pnpm test:e2e 12-exercito`.

**Pronto quando:** a prévia aparece em menos de um ciclo de leitura e o relatório é lido só pelo teclado.

### V4D-T5 · Revisão independente da Fase D `S`

Como V4B-T5, sobre a Fase D, **antes de qualquer incursão usar a batalha**. **Entregáveis:** **novo** `docs/reviews/v0.4-fase-d.md`; correções `V4D: corrige …`; `docs/balance-v0.4.md`, seção 4 (a prévia por formação de referência: o que vence o quê); integração.

- [x] V4D-T5.1 O revisor tenta: ponto flutuante em qualquer conta; sorte fora da ordem; `state.rng` tocado pela prévia; relatório que depende da ordem de inserção dos esquadrões; dois esquadrões com a mesma iniciativa dos dois lados; muralha em 0 e Ogro; moral de mortos-vivos; o comandante morto fora de Rei de Ferro; a prévia com formação de outro feudo; o pacote do app com um atributo de unidade.
- [x] V4D-T5.2 Correções com teste; relatório; Registro; integração sem `push`.
- [x] V4D-T5.3 **Calibragem de referência** (`docs/content-v0.4.md`, seção 3): dez formações contra as composições-base de cada estação, com a prévia; o que nunca vence ou nunca perde volta ao autor.

**Pronto quando:** como V4B-T5, mais a calibragem gravada.

---

## 5. Fase E — Muralha, incursões completas e Horda

**Meta da fase:** a defesa passa a ter consequência: a Paliçada vira Muralha e Baluarte com HP e reparo, a Torre dispara, toda incursão é uma batalha com a Formação de Defesa ativa (critério 1), saqueadores entram, a Horda guarda a última formação e adapta a composição (critério 3), a Fortaleza surge no outono e os presságios dizem parte do que vem. É a **primeira publicação recomendada** (decisão 26).

### V4E-T0 · Sessão de decisões, lote 2 → ADR 0020 `S`

Como V4A-T2, para as decisões 15 a 24 (§11.2), com a medição das Fases B a D na mão (o ouro por destino, a calibragem da prévia). **Entregáveis:** **novo** `docs/decisions/0020-horda-cerco-e-cronica-do-ano.md`; GDD §8.2, §8.3, §9.5, §10.6, §11.1 a §11.4 corrigidos; §11 com a coluna "Registro".

- [x] V4E-T0.1 Levar primeiro o que as Fases B a D mostraram (o ouro, a calibragem, o que o revisor deixou em dúvida).
- [x] V4E-T0.2 Rodadas curtas: 14 (se ainda aberta), 16, 19 e 26 primeiro (mudam o jogo de quem já joga); depois 15, 17, 18, 20 a 24.
- [x] V4E-T0.3 ADR 0020; GDD; §11.

### V4E-T1 · Muralha de Pedra, Baluarte e Torre Nv3+ `M`

**Objetivo:** a Paliçada vai até o nível 6 (Nv3–4 Muralha de Pedra, Nv5–6 Baluarte) com HP por ala, dano que persiste e reparo; a Torre de Vigia vai até o 5 e dispara a partir do 3.
**GDD:** §6.1, §6.2 (Muralha de Pedra Nv3: 300 madeira, 450 pedra, 1 h), §6.3 (reparo: 50% da pedra do nível, 15 min por 25% de HP, prioridade na fila), §10.1 (muralha e torres), §8.2.
**Depende de:** V4D-T1 (a muralha é dado da batalha). **Da v0.3 usa:** `buildings.ts` (`maxLevel: 2` da Torre e da Paliçada), `construction.ts`, as filas, `threatView.ts`.
**Decisões:** 16 (a parte da Torre), 20 (reparo entre ondas fica para G).
**Trilha:** motor.
**Entregáveis:** `packages/content/src/buildings.ts` (Paliçada `maxLevel: 6` com os nomes por faixa e os custos; Torre `maxLevel: 5`), `balance.ts` (`threat.watchtowerLevels` com cinco entradas: antecedência, tamanho, **composição revelada** e `towerDamage`; `wall: { hpByLevel; repair: { stoneRatio: 1/2; msPerQuarter: 15 min } }`), `chronicle.ts` (`wallDamaged`, `wallRepairStarted`, `wallRepaired`); `packages/engine/src/types.ts` (`settlement.wall: { hp: Record<Wing, number> }`), **novo** `wall.ts`, `construction.ts` (a obra de reparo com prioridade), `commands.ts` (`repairWall`), `threat.ts`, `threatView.ts`, `migrations/v31.ts` e o passo em `v30.ts`; protocolo; README; GDD §6.1.

- [x] V4E-T1.1 Conteúdo (os níveis novos em `futureLevels`, fora do jogo até a T1.2; D-7): os níveis 3 a 6 da Paliçada com nome, custo (a regra geral ×1,6 a partir do base da Muralha), tempo, HP por ala; os níveis 3 a 5 da Torre com antecedência (3, 4 e 5 h reais?: **decisão 16**), o que revelam da composição e o dano por ala; **todo nível cabe no depósito nas três dificuldades**, com teste; a recusa no teto deixa de prometer versão futura.
- [x] V4E-T1.2 Estado 31 → 32 (o roadmap dizia 30 → 31; a prévia da V4D-T2 tomou a 31): `settlement.wall.hp` por ala (na migração: cheio pelo nível de hoje), `settlement.wallRepair: { untilMs; toHp } | null`. Guarda: HP ≤ o do nível.
- [x] V4E-T1.3 Motor (falta a incursão chamar a batalha e `applyWallDamage`: é da V4E-T2): a batalha recebe a muralha por ala e devolve o dano; o HP persiste; a obra de reparo (`repairWall`) custa 50% da pedra do nível, dura 15 min de jogo por 25% faltante, **entra na frente da fila** (a obra ativa espera; teste do instante) e termina junto das obras; a Torre Nv3+ entra na batalha como dano fixo por ala; o aviso da Torre diz da composição o que o nível permite.
- [x] V4E-T1.4 `ViewState`: `threat.defense` ganha `wall { levelLabel; hpText por ala; repairOffer }` e `tower { damageText; revealsComposition }`; `UpgradeView.effect` dos níveis novos.

**Verificação:** `pnpm --filter @lotg/content test`; `pnpm --filter @lotg/engine test -- wall construction threat battle migrations fixtures`.

**Impacto em partidas antigas:** estado **31**. A muralha de quem tem Paliçada entra com o HP cheio; a Torre e a Paliçada passam a ter obra além do nível 2 na fronteira.

**Pronto quando:** uma batalha rompe uma ala, o reparo a refaz no prazo com prioridade, e a obra do nível 3 cabe no depósito.

### V4E-T2 · Incursões completas: a Formação de Defesa ativa, saqueadores e as roteirizadas `L`

**Objetivo:** toda incursão é uma batalha com a Formação de Defesa ativa; entram os saqueadores e os bandoleiros; o tamanho é proporcional à Ameaça e à estação; as incursões roteirizadas dos dias 3, 4 e 6 do ritmo Normal (a do dia 6 é o **ensaio do cerco**, na Hora da Vigília); repelir dá XP e revela a composição.
**GDD:** §8.2 (`[v0.4]`), §10.9 (não: é da Fase F), §2.2, §4.3 (a Hora da Vigília do ensaio: decisão 13).
**Depende de:** V4E-T1, V4D-T3. **Da v0.3 usa:** `raids.ts`, `hordeTurn.ts`, `ScheduledRaid`, `settleRaids`, o fluxo `horde`, os uivos e os lobos do ano 1, `threat.seasonEnemy`, a Paliçada que "segura" (sai: a batalha decide).
**Decisões:** 14, 16, 13 (o instante do ensaio).
**Trilha:** motor.
**Entregáveis:** `packages/content/src/ids.ts` (`ENEMY_IDS` + `raider`, `banditArcher`, …; `RAID_SIZE_IDS` + `strong`), `tiles.ts` (`enemies` com frases por tamanho para cada inimigo; `raiderCamp` como tipo de tile), `balance.ts` (`raids.scripted` + os três do roteiro com `atGameDay` 25 (dia 3), 37 (dia 4) e 61 (dia 6: na Hora da Vigília, decisão 13); `raids.sizeByThreat` como tabela; `raids.compositionBySeason` do Apêndice A; o que uma incursão leva **quando a batalha é perdida** (a regra da v0.2, escalada pelo que passou: decisão 14)), `chronicle.ts` (`raidRepelled` e `raidSuffered` reescritos com a batalha; `raidBattle`); `packages/engine/src/raids.ts`, `hordeTurn.ts`, `threat.ts`, `battle.ts` (o lado atacante vindo de uma incursão), `threatView.ts`, `migrations/v32.ts` e o passo em `v31.ts` (`ScheduledRaid.composition`, `horde.lastSeen`? não: é T3); `sim-cli` (colunas `raids_repelled`, `raids_lost`, `wall_breaches`); README; GDD §8.2.

- [x] V4E-T2.1 Conteúdo: os inimigos que as incursões usam, o tamanho por Ameaça e estação (leve, média, forte), a composição por estação (Apêndice A) como pesos, as três roteirizadas, o que custa perder.
- [x] V4E-T2.2 Estado 31 → 32 (foi **32 → 33**: a Muralha da V4E-T1 ficou com o 32): `ScheduledRaid` ganha `composition: Array<{ enemy; count; wing; line }>` (sorteada **quando a incursão é marcada**, no fluxo `horde`, e nunca mostrada além do que a Torre revela), `size: 'strong'` possível; `horde.scheduledRaids` de uma partida migrada ganha composição no passo? **Não**: o passo não sorteia; a incursão já marcada sem composição é resolvida com a composição-base da estação, sem sorteio, e o teste prova.
- [x] V4E-T2.3 Motor: `settleRaids` monta o atacante da composição, o defensor da Formação de Defesa ativa (postos vazios ficam vazios; **sem formação ativa, a batalha roda só com a muralha e as torres**, decisão 14), chama `resolveBattle` com o fluxo `battle:<id>`, aplica o dano à muralha, as baixas ao exército, os feridos e as perdas de recursos se a batalha é perdida (a regra da v0.2 vale para o que passou), XP e ferimento aos comandantes, a Ameaça −35 como hoje, a moral; o relatório entra em `army.reports`; `raidRepelled`/`raidSuffered` levam a composição completa (GDD §8.2).
- [x] V4E-T2.4 As roteirizadas: dia 3 (fraca), dia 4 (média), dia 6 (forte, na Hora da Vigília: o instante é calculado como o do cerco, V4G-T1 traz a conta; **até lá, o ensaio cai no início do 61º dia de jogo**, e a tarefa escreve isso); só no ano 1 e só para partidas que ainda não passaram do instante (o molde dos lobos).
- [x] V4E-T2.5 Névoa: a composição não sai na visão além do que a Torre do nível revela; o aviso da Torre Nv2 continua dizendo o tamanho; os níveis 3 a 5, a composição por partes.
- [x] V4E-T2.6 Propriedade: divisão de intervalo com incursão, batalha, reparo e virada no mesmo instante; QA-03 com a batalha na lista.
- [x] V4E-T2.7 Simulador: o `militar` e, pela decisão 25, o `economico` mantêm uma Defesa ativa; `raids_repelled` e `raids_lost` por célula; faixas remedidas.

**Diversão:** o critério 1: a formação salva defende offline, e o relatório diz por quê.

**Verificação:**

```bash
pnpm --filter @lotg/content test
pnpm --filter @lotg/engine test -- raids threat battle hordeTurn
pnpm --filter @lotg/engine test -- advance economy.property
pnpm --filter @lotg/engine test -- migrations fixtures
TEST_DATABASE_URL=postgres://lotg:lotg@localhost:5433/lotg_test pnpm test:integration scenarios
pnpm --filter @lotg/sim-cli test
```

**Impacto em partidas antigas:** estado **32**. A incursão já marcada é resolvida com a composição-base; quem não tem exército nem formação é defendido só pela muralha (a Paliçada Nv1 e Nv2 continuam segurando o que seguravam, por HP e absorção: **conferir no golden que uma leve contra Nv1 não passa**); as roteirizadas dos dias 3, 4 e 6 só chegam a quem ainda não passou do instante.

**Pronto quando:** os lobos do dia 16 são uma batalha com o mesmo desfecho de hoje para um feudo com Paliçada Nv1 (golden), uma formação ativa repele uma média, e a prévia dessa incursão com a composição conhecida bate com a batalha real.

**Prompt sugerido:** "Leia CLAUDE.md, GAME_DESIGN.md §8.2 e Apêndice A, docs/decisions/0019 e 0020, docs/roadmap-v0.4.md V4E-T2 e Apêndice B, packages/engine/README.md (Ameaça). É tarefa L. Primeiro o golden dos lobos do dia 16 contra a Paliçada Nv1 com o desfecho de hoje; depois as incursões como batalha, os saqueadores, as roteirizadas, a névoa, a propriedade, os bots."

### V4E-T3 · A Horda aprende: memória, astúcia, Fortaleza e presságios `L`

**Objetivo:** a Horda guarda a última formação vista e altera a composição seguinte (critério 3); a astúcia é por dificuldade; a Fortaleza da Horda surge no primeiro dia do outono e o Acampamento de Saqueadores, no verão; os presságios revelam parte das ondas.
**GDD:** §10.6, §8.3, §11.1, §8.2 (tiles), Apêndice A e E.
**Depende de:** V4E-T2. **Da v0.3 usa:** `map.tiles`, `MapTile.threatActive`, `restoreTiles`, `threat.seasonEnemy`, o fluxo `horde`, a virada do dia.
**Decisões:** 15, 16, 18.
**Trilha:** motor.
**Entregáveis:** `packages/content/src/tiles.ts` (`hordeFortress`, `raiderCamp`), `balance.ts` (`horde: { cunning: por dificuldade em fração (3/10, 1/2, 4/5); counterWeights; baseWeightsBySeason }`, `omens: { chancePerDay: 35; perTowerLevelAbove1: 10; clarityByLevel; cap }`, `difficulties[].cunning`), **novo** `omens.ts` (as frases por clareza, Apêndice E), `chronicle.ts` (`omenSeen`, `fortressAppeared`, `campAppeared`); `packages/engine/src/types.ts` (`horde.lastFormationSeen`, `horde.omens`), `hordeTurn.ts` (a memória gravada ao fim de cada batalha; os pesos adaptados; os presságios na virada do dia, depois da Ameaça), `threat.ts` (os tiles por data), `threatView.ts`, `warCouncil.ts` (a prévia usa presságios como informação), `migrations/v33.ts` e o passo em `v32.ts`; `sim-cli` (a finta como política do `militar`: formação-isca no ensaio); README; GDD §10.6, §11.1.

- [x] V4E-T3.1 Estado 32 → 33: `horde.lastFormationSeen: { posts resumidos por arquétipo } | null`, `horde.omens: Array<{ atMs; clarity; wave; wing; enemy; count | null }>` com teto; `map.tiles` ganha `hordeFortress` (nasce **na virada que abre o outono**, soma +2 por dia como tile ativo; decisão 16) e `raiderCamp` (nasce no verão por descoberta ou data: decisão 16). Na migração: memória `null`, presságios vazios, e a partida já no outono recebe a Fortaleza na primeira virada depois da fronteira.
- [x] V4E-T3.2 A composição de uma incursão e, na Fase G, de uma onda: `peso(tipo) = peso_base(estação) + astúcia × peso_de_contra(tipo, última formação)`, em frações, com o sorteio no fluxo `horde` quando a incursão é marcada; **teste determinístico**: a mesma memória e a mesma semente dão a mesma composição, e uma formação cheia de arqueiros aumenta o peso de lobos e cavalaria (critério 3).
- [x] V4E-T3.3 Presságios: na virada de cada dia de outono e de inverno antes do cerco, `35% + 10% × (nível da Torre − 1)` no fluxo `horde`; a clareza pelo nível da Torre (Nv1 "muitas feras", Nv3 "cerca de 30 lobos na ala esquerda da segunda onda", Nv5 a composição exata de uma onda); o que o presságio diz é **verdade sobre a onda que será gerada** (decisão 18: as ondas do cerco são geradas na virada que abre o outono, com a memória daquele instante, e os presságios leem delas; a adaptação à última formação vale para o que ainda não foi lido? **Decisão 18 fixa**).
- [x] V4E-T3.4 `ViewState`: `threat.tiles` com a Fortaleza e o Acampamento; `army.omens[]` como frases; `army.preview.knownEnemy` alimentado pelos presságios e pelo que o último relatório mostrou.
- [x] V4E-T3.5 Simulador: a finta (formação-isca no ensaio, outra no cerco) como política do `militar`; coluna `omens`, `fortress_day`.

**Diversão:** o ciclo observar → antecipar → formar → ler (GDD §10.6). A finta é descoberta, não explicada.

**Verificação:** `pnpm --filter @lotg/engine test -- hordeTurn threat omens warCouncil migrations fixtures`; `pnpm --filter @lotg/content test`; `pnpm --filter @lotg/sim-cli test`.

**Impacto em partidas antigas:** estado **33**. A Fortaleza chega a quem está no outono ou no inverno na primeira virada depois da fronteira; a Horda não lembra nada de antes.

**Pronto quando:** o teste determinístico do critério 3 passa, um presságio nunca mente, e a Ameaça média por estação com a Fortaleza está medida.

### V4E-T4 · Muralha, incursões, Horda e presságios na interface `M`

**Objetivo:** o painel da Ameaça mostra a muralha com HP por ala, o reparo, a Torre que dispara, os tiles novos; a aba Exército lista os presságios e a linha inimiga da prévia usa o que se sabe; o relatório de uma incursão é o de batalha.
**Depende de:** V4E-T1 a V4E-T3, V4D-T4.
**Trilha:** app.
**Entregáveis:** `packages/web/src/tabs/Settlement.tsx` (painel da Ameaça), `components/ThreatPanel.tsx`, `tabs/Army.tsx` (presságios), `FormationEditor.tsx` (a linha inimiga), `palette/commands.ts` (`lords.repairWall`), `app/controller.ts`, `game/returnReport.ts` (a incursão como batalha, com os fatores; `wallDamaged`, `omenSeen`), `game/beforeLeaving.ts` (muralha danificada: "Reparar…"; incursão à vista sem Defesa ativa), `notifications/policy.ts` (presságio como "todas"; incursão forte como essencial), `tests/e2e/08-ameaca.spec.ts`, `12-exercito.spec.ts`; README do app.

- [ ] V4E-T4.1 **Mostrar ao autor** a muralha danificada e um presságio antes do resto.
- [x] V4E-T4.2 Painel da Ameaça com a muralha, o reparo em duas etapas, a Torre, os tiles; "Antes de partir" e Retorno.
- [x] V4E-T4.3 Presságios na aba Exército e na prévia; o relatório de incursão.
- [x] V4E-T4.4 Navegador: reparar, o presságio (`/__test/omen`), a incursão como batalha (`world.wolvesRoam()` com a formação ativa), a barra de status.

**Verificação:** `pnpm --filter @lotg/web test`; `pnpm build && pnpm test:e2e 08-ameaca 12-exercito`; `pnpm capture:landing && pnpm test:e2e:landing`.

### V4E-T5 · Revisão independente, medição e primeira publicação da Fase E `M`

Como V4B-T5, sobre a Fase E, mais a publicação (decisão 26). **Entregáveis:** **novo** `docs/reviews/v0.4-fase-e.md`; correções `V4E: corrige …`; `docs/balance-v0.4.md`, seção 5; `CHANGELOG.md` ("Não lançado": o que muda para quem já joga); `deploy/README.md` (a nota da publicação: do estado 24 ao 33); `CLAUDE.md`; `architecture.md`.

- [ ] V4E-T5.1 O revisor tenta: a composição de uma incursão na visão sem Torre; a memória da Horda lida pela prévia; a Fortaleza em partida migrada no inverno; a incursão marcada antes da migração; o reparo durante uma batalha; dois `repairWall`; a formação ativa apagada com incursão à vista; o presságio que mente; o pacote do app.
- [ ] V4E-T5.2 Correções; relatório; Registro.
- [ ] V4E-T5.3 Simulador: as três matrizes, o ouro por destino, incursões repelidas e perdidas por perfil, a Ameaça média por estação com a Fortaleza, a finta medida (a composição do cerco de prova com e sem isca).
- [ ] V4E-T5.4 Integração: o portão inteiro no commit candidato; `CLAUDE.md`; a nota de publicação; **backup manual do banco, SHA de retorno anotado, e o aviso ao autor**. O `push` é dele.
- [ ] V4E-T5.5 O autor joga a fase, ou fica registrado que não jogou.

**Pronto quando:** o critério 1 e o 3 estão provados no motor, na integração e no navegador; o portão está verde; o autor tem o aviso com o SHA e o backup.

---
## 6. Fase F — Sabotagem e Acampamento

**Meta da fase:** os dois destinos que a v0.3 deixou de fora de propósito (ADR 0018, decisão 12) e que usam o que ela construiu: a **sabotagem** da Fortaleza, uma expedição do outono que reduz as ondas do cerco e pode alertar a Horda, e o **ataque ao Acampamento de Saqueadores**, a batalha ofensiva do §10.9, com o exército fora do feudo. É onde a v0.3 paga o investimento, e onde a decisão central do outono nasce: gastar os heróis agora ou guardá-los para comandar.

### V4F-T1 · Sabotagem da Fortaleza `M`

**Objetivo:** o modelo de expedição `sabotage`, só no outono e só com a Fortaleza de pé: três heróis por 6 h de jogo, cada nó bem-sucedido reduz uma onda em 15% (até três sabotagens, −45%), o chefe é um Xamã que revela a composição da onda 3, o Desastre captura e alerta a Horda (+10% na onda 1), e a Fortaleza reforça a guarda a cada tentativa.
**GDD:** §9.5, §8.3, §11.2 (a fórmula da onda).
**Depende de:** V4E-T3 (a Fortaleza e as ondas geradas). **Da v0.3 usa:** o motor de expedições inteiro (`requires`, `access`, `onDisaster`, `rewards`, o fluxo `expedition:<id>`, captura e Resgate).
**Decisões:** 17.
**Trilha:** motor.
**Entregáveis:** `packages/content/src/ids.ts` (`EXPEDITION_MODEL_IDS` + `sabotage`), **novo** `missions/sabotage.ts` (três variantes; a dificuldade sobe com `horde.sabotages.attempts`), `expeditions.ts` (requisito `season`, `tile`, `teamSize: 3`; recompensas `weakensWave`, `revealsWave`; penalidade `alertsHorde` no Desastre), `balance.ts` (`horde.sabotage: { maxPerYear: 3; waveReduction: 3/20; alertIncrease: 1/10; guardIncreasePerAttempt }`), `chronicle.ts` (`hordeSabotaged`, `hordeAlerted`); `packages/engine/src/expeditionOrders.ts`, `expeditionTurn.ts`, `hordeTurn.ts`, `expeditionsView.ts`, `migrations/v34.ts` e o passo em `v33.ts` (`horde.sabotages: { attempts; successes; alerted }`); `sim-cli` (o `militar` sabota uma vez no outono se a prévia do cerco der menos de 65%); `docs/content-v0.4.md`, seção 3 (fichas, rascunho); README; GDD §9.5.

- [ ] V4F-T1.1 Conteúdo: as três variantes com o Xamã no último nó; os requisitos (outono, Fortaleza ativa, exatamente 3 heróis, `attempts < 3`); as recusas `SABOTAGE_SEASON`, `SABOTAGE_LIMIT`, `TEAM_SIZE`; ids em `STABLE_IDS`; o golden da calibragem e o do relatório.
- [ ] V4F-T1.2 Estado 33 → 34: `horde.sabotages` (zeros; zera na virada do ano).
- [ ] V4F-T1.3 Motor: cada nó com Sucesso soma uma redução **à onda que o nó marca** (as três ondas, um nó cada, mais o Xamã); o Desastre captura (pela dificuldade: `heroCapture`) e marca `alerted` (+10% na onda 1); a dificuldade de cada nó sobe por tentativa (`guardIncreasePerAttempt`, como fator); o Xamã derrotado grava a composição da onda 3 como presságio de clareza máxima.
- [ ] V4F-T1.4 `ViewState`: o destino com `sabotage { attemptsLeft; wavesWeakened; alerted }` e a régua da equipe; o relatório com o que cada nó fez à Horda.
- [ ] V4F-T1.5 Testes: três sabotagens e a quarta recusada; o Desastre que alerta; a captura em Senhor e a morte em Rei de Ferro; a Fortaleza que some (fim do cerco, V4G-T2) com a equipe no caminho (volta pela fronteira, o molde do nó que o conteúdo deixou de ter); propriedade com sabotagem e cerco no mesmo intervalo.

**Diversão:** a decisão estratégica do outono (GDD §8.3). O teste é o autor hesitar entre sabotar e guardar os heróis.

**Verificação:** `pnpm --filter @lotg/content test`; `pnpm --filter @lotg/engine test -- expeditions hordeTurn migrations fixtures`; `pnpm --filter @lotg/sim-cli test`.

**Impacto em partidas antigas:** estado **34**. Contadores zerados; quem está no outono pode sabotar desde a fronteira, se tem a Fortaleza.

**Pronto quando:** uma sabotagem reduz uma onda de prova em 15% no golden do cerco (V4G-T2 o fecha), o Desastre alerta, e a quarta tentativa é recusada com a frase.

### V4F-T2 · Ataque ao Acampamento de Saqueadores (batalha ofensiva) `M`

**Objetivo:** o exército viaja até o Acampamento, luta sem muralha própria e contra a paliçada do inimigo, e fica indisponível para a defesa até voltar; limpar o Acampamento desliga o tile (volta no ano seguinte, como o Covil).
**GDD:** §10.9, §8.2 (tiles), §9.3 ("Acampamento de Saqueadores usa o sistema de batalha").
**Depende de:** V4F-T1, V4E-T3. **Da v0.3 usa:** `threatTileCleared`/`threatTileRestored`, `restoreTiles`, o molde da expedição que viaja (`sentAtMs`, `nodeEndsAtMs`).
**Decisões:** 16 (o tile), 8 (comandantes fora).
**Trilha:** motor.
**Entregáveis:** `packages/content/src/balance.ts` (`army.campaign: { travelMs; campWall: hp; campGarrison por estação }`), `tiles.ts`, `chronicle.ts` (`armyMarched`, `campAssaulted`, `armyReturned`); `packages/engine/src/types.ts` (`army.campaign: { formationId; tile; departsAtMs; battleAtMs; returnsAtMs; report } | null`), `armyOrders.ts` (`attackCamp { formationId }`), `armyTurn.ts` (a batalha no instante da chegada; a volta), `battle.ts` (o lado atacante sem muralha; a paliçada do inimigo), `raids.ts` (a incursão que chega com o exército fora: a Defesa ativa fica sem os esquadrões que partiram), `migrations/v35.ts`? (**não**: `army.campaign` entra no passo da V4F-T1 se as duas fecharem juntas; senão, 35); `sim-cli`; README; GDD §10.9.

- [ ] V4F-T2.1 A ordem: recusas `ARMY_AWAY`, `CAMP_NOT_FOUND`, `FORMATION_NOT_FOUND`, `NO_SOLDIERS`; o exército que vai é o da formação (os comandantes vão juntos e ficam `HERO_BUSY`); a viagem é tempo de jogo (o tempo do tile, conteúdo).
- [ ] V4F-T2.2 A batalha na chegada (instante próprio, depois das expedições: §0.7), com `resolveBattle` invertido (o atacante é o jogador, a muralha é a do Acampamento); vitória limpa o tile (−30 de Ameaça, como o Covil) e dá saque; derrota ou 12 rodadas: o exército recua com as baixas.
- [ ] V4F-T2.3 A volta, com as baixas descontadas de `army.units`; a incursão que chega com o exército fora usa a formação ativa **sem** as unidades que partiram (a prévia avisa).
- [ ] V4F-T2.4 `ViewState`: `army.campaign` com onde está e quanto falta; `threat.tiles` com o Acampamento limpo; `army.editor` com o aviso de exército fora.
- [ ] V4F-T2.5 Testes: ataque e volta; incursão durante a campanha; o Acampamento que volta na virada do ano; propriedade.

**Diversão:** "outra decisão com custo" (GDD §10.9): atacar deixa o feudo exposto.

**Verificação:** `pnpm --filter @lotg/engine test -- army battle raids threat migrations fixtures`.

**Impacto em partidas antigas:** `army.campaign` nasce `null`.

**Pronto quando:** o exército ataca, volta com baixas, o tile some e volta no ano seguinte, e uma incursão no meio é lutada sem quem partiu.

### V4F-T3 · Sabotagem e Acampamento na interface `S`

**Objetivo:** a aba Guilda oferece a sabotagem como destino (com o contador e o alerta) e a aba Exército, "Atacar o Acampamento" com a prévia da batalha ofensiva.
**Depende de:** V4F-T1, V4F-T2, V4E-T4.
**Trilha:** app.
**Entregáveis:** `packages/web/src/tabs/Guild.tsx`, `tabs/Army.tsx`, `palette/commands.ts` (`lords.attackCamp`), `app/controller.ts`, `game/returnReport.ts`, `game/beforeLeaving.ts` (exército fora com incursão à vista), `tests/e2e/09-guilda.spec.ts`, `12-exercito.spec.ts`.

- [ ] V4F-T3.1 A sabotagem no painel de destinos com o que ela faz às ondas; o ataque com a prévia e a confirmação ("o feudo fica sem estes esquadrões por N h").
- [ ] V4F-T3.2 Retorno, "Antes de partir", avisos; navegador.

**Verificação:** `pnpm --filter @lotg/web test`; `pnpm build && pnpm test:e2e 09-guilda 12-exercito`.

### V4F-T4 · Revisão independente da Fase F `S`

Como V4B-T5. **Entregáveis:** **novo** `docs/reviews/v0.4-fase-f.md`; correções `V4F: corrige …`; `docs/balance-v0.4.md`, seção 6 (sabotagens por perfil; o Acampamento atacado; a Ameaça com e sem); integração sem `push`.

- [ ] V4F-T4.1 O revisor tenta: sabotar com dois heróis; a quarta sabotagem; a Fortaleza que some com a equipe lá; o comandante que sabota; o ataque com a formação ativa inteira e a incursão no meio; a composição da onda 3 na visão sem o Xamã; o Acampamento limpo duas vezes no ano.
- [ ] V4F-T4.2 Correções; relatório; Registro; integração.

---

## 7. Fase G — O Cerco e a Crônica do Ano

**Meta da fase:** a Hora da Vigília passa a ter efeito, o Cerco acontece com três ondas e Plano de Batalha (critério 4), com ou sem o jogador, a milícia é a carta desesperada, o rescaldo fecha o inverno e a Crônica do Ano é gerada e exportável (critério 5). **Sobe o protocolo para 4.** É a tarefa de maior risco da versão: determinismo com sorteios, névoa, tempo real e hora local. Tem revisão independente antes da tela (V4G-T2.8).

### V4G-T1 · A Hora da Vigília com efeito `M`

**Nota de execução (2026-10-27):** a base deste branch é o estado 34; esta tarefa usa **34 → 35**, sem criar o Cerco da V4G-T2. A janela/fallback e os limites conservadores estão nas pendências G-1 a G-5.

**Objetivo:** o motor consegue calcular o instante de jogo da primeira Hora da Vigília que cai ao menos 6 h depois do início do inverno (senão, 12 h depois), a partir de `settings.timezone`, `settings.vigilHourLocal` e um instante de origem em tempo real; mudar de fuso ou de hora não move um cerco já marcado.
**GDD:** §4.3, §2.1, §17.1 ("Hora da Vigília configurável").
**Depende de:** V4E-T2 (o ensaio do dia 6 passa a usar a mesma conta). **Da v0.3 usa:** `settings.timezone` e `settings.vigilHourLocal` (já no estado, sem uso), `games.vigil_hour` e `games.created_at` (na linha), `realToGameMs`.
**Decisões:** 12, 13.
**Trilha:** motor e servidor.
**Entregáveis:** `packages/engine/src/types.ts` (`settings.realOriginMs` e `settings.vigil: { hourLocal; utcOffsetMinutes; timezoneResolved }`, ou o que a decisão 13 fixar), **novo** `vigil.ts` (a conta pura: do instante de jogo ao instante real e à hora local, sem DST), `state.ts`, `migrations/v35.ts` e o passo em `v34.ts` (a origem real de uma partida migrada vem do servidor pelo contexto da migração: `context.realOriginMs`, lido de `games.created_at`), `migrations.ts` (`MigrationContext` ganha o campo); `packages/server/src/games/service.ts`, `repository.ts` (passa `created_at` e o offset calculado do fuso IANA com `Intl` **no servidor**), `catalog.ts`; `packages/protocol/src/api.ts` (`PATCH /games/:id/settings`? **não**: a mudança de Vigília continua pelas Preferências do app, que hoje só gravam `vigilHour` na linha; a tarefa decide com a decisão 13 se vira ordem `setVigilHour`); README do motor e do servidor; GDD §4.3.

- [x] V4G-T1.1 Decidir a forma pela decisão 13 e escrever a conta: `realMs = realOriginMs + gameMs / timeScale`; hora local = `(realMs + offset) mod 24 h`; o primeiro instante de jogo ≥ `inícioDoInverno + 6 h de jogo` cuja hora local é a da Vigília, em inteiros; sem DST (documentado como limite).
- [x] V4G-T1.2 Estado 34 → 35: `settings.realOriginMs` e `settings.vigil` (na migração, do contexto; o passo não cria prazo). A partida cujo fuso o servidor não resolve entra com offset 0 e a tela avisa.
- [x] V4G-T1.3 O ensaio do dia 6 (V4E-T2.4) passa a cair na Hora da Vigília pela mesma conta; teste nos três ritmos e em três fusos.
- [x] V4G-T1.4 Mudar a hora ou o fuso: vale para o que ainda não foi marcado; o cerco e o ensaio já marcados ficam.

**Verificação:** `pnpm --filter @lotg/engine test -- vigil raids migrations fixtures`; `TEST_DATABASE_URL=… pnpm test:integration games`.

**Impacto em partidas antigas:** estado **35**. A origem real vem de `created_at`; nada é marcado na fronteira.

**Pronto quando:** a conta dá a mesma Vigília no motor e em um cálculo independente no teste, e o ensaio do dia 6 cai nela.

### V4G-T2 · O Cerco: ondas, Plano de Batalha, milícia e rescaldo `L`

**Objetivo:** o cerco marcado para a Vigília do inverno, com três ondas geradas pela Horda, o Plano de Batalha por onda, a troca entre ondas para quem está presente, reparos de emergência, a milícia, os três resultados, a Queda, o rescaldo e a Primavera da Reconstrução.
**GDD:** §11.2, §11.3, §11.4 (sem a Crônica), §10.8 (Plano), §8.3.
**Depende de:** V4G-T1, V4F-T1. **Da v0.3 usa:** `pendingDecisions` (a decisão entre ondas, no molde da encruzilhada e do prazo real), `realToGameMs`, `moraleEffects`, `restoreTiles`.
**Decisões:** 12, 19, 20, 21.
**Trilha:** motor.
**Entregáveis:** `packages/content/src/balance.ts` (`siege: { waves: [40, 60, 80]; waveIntervalRealMs: 60 min; difficultyFactor: { peasant: 7/10, lord: 1, ironKing: 13/10 }; fall: { resourcesLost: 3/10; populationLost: 1/5; buildingsDamaged: 2; levelsLost: 2 }; reconstruction: { costFactor: 4/5; days: 2 }; mourning; feast }`, `army.militia: { maxShare: 1/2; unit: 'militia'; takesDamage: 5/4 }`, `units.ts` (`militia`, `warlord`), `chronicle.ts` (`siegeScheduled`, `siegeWaveFought`, `siegeWon`, `siegeGlorious`, `siegeFell`, `militiaCalled`, `militiaDisbanded`, `warlordSlain`, `reconstructionStarted`); `packages/engine/src/types.ts` (`siege: { atMs; waves: Wave[]; current; plan: Record<1|2|3, formationId | null>; result | null } | null`, `settlement.militia`), **novos** `siege.ts`, `siegeTurn.ts`, `siegeOrders.ts` (`setBattlePlan`, `swapWaveFormation`, `callMilitia`, `emergencyRepair`), `advance.ts` (o cerco e cada onda como instantes próprios; §0.7), `timeline.ts`, `hordeTurn.ts` (as ondas geradas na virada que abre o outono; as sabotagens aplicadas), `morale.ts`, `construction.ts` (a Reconstrução), `view.ts` (`pendingDecisions` ganha `kind: 'siegeWave'`), `migrations/v36.ts` e o passo em `v35.ts`; `packages/protocol/src/index.ts` (**`PROTOCOL_VERSION` 4**), `view.ts`, `protocol.test.ts`; `packages/server/src/plugins/errors.ts` (426); `packages/web/src/game/gameSession.ts` (`CACHE_VERSION` sobe com o protocolo); `sim-cli` (`siege_result`, `waves_won`, `militia_called`; a faixa do Regular, V4I-T1); README; GDD §11.2 a §11.4.

- [ ] V4G-T2.1 Estado 35 → 36: `siege` (`null` até a virada que abre o outono, quando as ondas são geradas com a Horda daquele instante e o cerco é marcado para a Vigília do inverno: a partida migrada no outono ou no inverno recebe as duas coisas na primeira virada depois da fronteira), `settlement.militia: { count; untilMs } | null`, `settlement.reconstructionUntilMs`. Guarda: três ondas, `current` de 0 a 3, plano com formações existentes.
- [ ] V4G-T2.2 As ondas: `tamanho = base × dificuldade × (1 − 15% × sabotagens)` em inteiros, composição típica do §11.2 adaptada pela Horda (V4E-T3), o Senhor da Guerra no centro da onda 3, o alerta +10% na onda 1; **névoa**: nada da composição sai além dos presságios.
- [ ] V4G-T2.3 O cerco na linha do tempo: a onda 1 na Vigília, a 2 e a 3 a cada 60 min reais (decisão 12), convertidos quando a onda anterior termina; cada onda é uma batalha com a formação do Plano (ou a Defesa ativa, sem Plano), o dano à muralha persistindo; a decisão `siegeWave` entre ondas com prazo real: `swapWaveFormation` troca a formação da próxima onda e `emergencyRepair` paga pedra (decisão 20); sem resposta, o Plano vale.
- [ ] V4G-T2.4 Resultado: Vitória Gloriosa (nenhuma ala rompida em nenhuma onda), Vitória, Queda (uma onda venceu: 30% dos recursos, 20% da população, muralha destruída, 2 edifícios −2 níveis, escolhidos sem sorteio: os dois de nível mais alto? **decisão 19**); derrotar o Senhor da Guerra encerra a onda 3; a Fortaleza some com o fim do cerco (volta no ano seguinte: decisão 16).
- [ ] V4G-T2.5 Milícia: `callMilitia { count }` só com incursão forte ou cerco marcado dentro da antecedência (decisão 21): até 50% dos aldeões viram Milicianos (3/2/12, ×5/4 de dano recebido), não produzem; dissolve ao fim; as perdas reduzem a população (o piso de 3 protege).
- [ ] V4G-T2.6 Rescaldo: luto (−10 por 1 dia se houve mortos) ou festa (+15 se Gloriosa); reparos com desconto até o fim do inverno; a Primavera da Reconstrução (custos ×4/5 por 2 dias de jogo) depois da Queda; "nunca há game over".
- [ ] V4G-T2.7 Protocolo 4: `pendingDecisions` com `siegeWave`; o SDK e o servidor; `CACHE_VERSION`; teste de igualdade de tipos.
- [ ] V4G-T2.8 **Revisão independente do motor do cerco antes da tela** (Apêndice A.4, com o relatório em `docs/reviews/v0.4-cerco.md`): determinismo, névoa, tempo real, o cerco com o jogador fora 30 dias, a migração no inverno.
- [ ] V4G-T2.9 Propriedade: divisão de intervalo com o cerco inteiro dentro, cortado entre ondas, antes da decisão e depois dela; golden de um cerco completo por dificuldade; `--perf` com o cerco.
- [ ] V4G-T2.10 Simulador: os bots salvam o Plano com a Defesa ativa e chamam a milícia quando a prévia da onda 3 dá menos de 50%; colunas e a tabela "Cerco" por célula.

**Diversão:** "Passei a semana me preparando e valeu." O teste é o autor ler o resultado e saber o que fazer diferente no ano 2.

**Verificação:**

```bash
pnpm --filter @lotg/content test
pnpm --filter @lotg/engine test -- siege
pnpm --filter @lotg/engine test -- advance economy.property vigil
pnpm --filter @lotg/engine test -- migrations fixtures purity
pnpm --filter @lotg/protocol test
TEST_DATABASE_URL=postgres://lotg:lotg@localhost:5433/lotg_test pnpm test:integration
pnpm --filter @lotg/sim-cli test
pnpm -s sim -- --perf
```

**Impacto em partidas antigas:** estado **36**, protocolo **4** (o app antigo recebe `426`). Quem está no outono ou no inverno recebe as ondas e a data do cerco na primeira virada depois da fronteira; quem já passou do inverno, nada até o ano seguinte.

**Pronto quando:** um cerco inteiro acontece com o jogador fora e o Plano salvo (critério 4 e 1), o golden por dificuldade existe, a decisão entre ondas funciona nos três ritmos, e a revisão independente do motor foi feita antes da tela.

**Prompt sugerido:** "Leia CLAUDE.md, GAME_DESIGN.md §11.2 a §11.4, §10.8 e §8.3, docs/decisions/0020-…md, docs/roadmap-v0.4.md V4G-T2 e Apêndice B, packages/engine/README.md (A linha do tempo, Sorteios). É tarefa L: um commit por subtarefa, golden do cerco antes do motor, revisão independente antes de qualquer tela. O protocolo sobe para 4 aqui."

### V4G-T3 · A Crônica do Ano `M`

**Objetivo:** ao fim do inverno (as 168 h do ritmo Normal) o servidor publica a Crônica do Ano: narrativa a partir do log, estatísticas, pontuação e os Feitos ligados ao cerco; exportável em Markdown.
**GDD:** §11.4, Apêndice E, §13.6, §15.5.
**Depende de:** V4G-T2. **Da v0.3 usa:** `GET /chronicle.md` (`?links=1`), `chronicleRows`, `CHRONICLE_HIDDEN_EVENT_TYPES`, `game_events`, `stats`.
**Decisões:** 22.
**Trilha:** motor e servidor.
**Entregáveis:** `packages/content/src/chronicle.ts` (`yearEnded` com as estatísticas como dados), **novo** `feats.ts` (os Feitos da v0.4: Primeiro Inverno, Muralha Intacta, Regicida da Horda, A Finta, Sabotador, Resgate), `balance.ts` (`score` como pesos inteiros); `packages/engine/src/calendar` (`processCalendar` emite `yearEnded` na virada do ano com `stats` do ano; o estado guarda `years: Array<{ year; score; feats }>` com teto? **decisão 22**: recomendado guardar só no evento e em `stats`, sem lista no estado), `migrations/v37.ts` se houver campo; `packages/server/src/games/chronicle.ts` (**novo** `GET /games/:id/years/:year/chronicle.md`: montado dos eventos do ano e do `yearEnded`), `routes`; protocolo (`api.ts`); `sim-cli` (`score`, `feats`); README do servidor; GDD §11.4.

- [ ] V4G-T3.1 O evento `yearEnded` na virada do ano (depois de `restoreTiles`, antes de a Ameaça subir), com população máxima, batalhas, expedições, cartas, o resultado do cerco, a pontuação e os Feitos do ano, calculados no motor de `stats` sem sorteio.
- [ ] V4G-T3.2 A rota do servidor monta o Markdown com os modelos do Apêndice E (seções por estação, as linhas da Crônica do ano, o cerco, a tabela de estatísticas, a pontuação, os Feitos); só com o que o jogador podia saber (as linhas já filtradas).
- [ ] V4G-T3.3 "Avançar para o Degelo": pela decisão 22 (recomendado **não entrar**: o servidor é o relógio e o calendário é o mesmo para quem joga; a alternativa é uma ordem que encerra o inverno só para aquele feudo, e muda a semana de 7 dias).
- [ ] V4G-T3.4 Testes: golden do Markdown de um ano com cerco vencido e um com Queda; a integração do endpoint; o ano 2 sem a Crônica do 1 duplicada.

**Verificação:** `pnpm --filter @lotg/engine test -- chronicle calendar`; `TEST_DATABASE_URL=… pnpm test:integration chronicle`.

**Impacto em partidas antigas:** sem campo novo se a decisão 22 ficar como recomendada; a partida que já passou da virada do ano não recebe a Crônica do ano anterior.

**Pronto quando:** o critério 5 está provado: um ano completo gera a Crônica, e ela baixa como Markdown no app.

### V4G-T4 · O Cerco e a Crônica do Ano na interface `L`

**Objetivo:** a barra de status com "Cerco em 1d 03h" (GDD §13.5), o Plano do Cerco no editor (uma formação por onda), a decisão entre ondas como decisão pendente (com "Trocar formação", "Reparar", "Convocar milícia"), o relatório por onda, o rescaldo, a aba Crônica com a Crônica do Ano e "Baixar (Markdown)".
**Depende de:** V4G-T2, V4G-T3, V4F-T3.
**Trilha:** app.
**Entregáveis:** `packages/web/src/tabs/Army.tsx` (Plano do Cerco), **novos** `components/SiegePanel.tsx`, `components/YearChronicle.tsx`, `tabs/Chronicle.tsx`, `workbench/StatusBar.tsx`, `ui/treeModel.ts`, `palette/commands.ts` (`lords.setBattlePlan`, `lords.swapWaveFormation`, `lords.emergencyRepair`, `lords.callMilitia`, `lords.downloadYearChronicle`), `app/controller.ts`, `game/gameSession.ts` (`CACHE_VERSION` 4.x; os prazos do cerco em `nextPollMs`), `notifications/policy.ts` (cerco e onda como essenciais), `game/returnReport.ts` (o cerco em três blocos; "Sua escolha voltou" com o Plano), `game/beforeLeaving.ts` (cerco marcado sem Plano), `tabs/Settings.tsx` (a Hora da Vigília diz quando o próximo cerco cai), `tests/e2e/13-cerco.spec.ts` (**novo**), `06-avisos-e-preferencias.spec.ts`, `05-teclado-e-temas.spec.ts`; README do app.

- [ ] V4G-T4.1 **Mostrar ao autor** a barra com "Cerco em…" e a decisão entre ondas antes do resto.
- [ ] V4G-T4.2 O Plano do Cerco; a decisão entre ondas com o prazo real ("a onda seguinte chega em…"), no topo de "Você ainda pode decidir" e de "Antes de partir"; a milícia com confirmação e o custo em braços.
- [ ] V4G-T4.3 O relatório por onda e o rescaldo; a Crônica do Ano na aba Crônica com o botão de baixar (a rota nova).
- [ ] V4G-T4.4 Barra, título, árvore, avisos, modo discreto; o Retorno de quem perdeu o cerco fora.
- [ ] V4G-T4.5 Navegador: um cerco inteiro com o relógio controlado (`/__test/siege` põe o cerco a N minutos), a troca entre ondas, a milícia, a Queda, o Markdown baixado; o cenário "no ritmo".

**Verificação:** `pnpm --filter @lotg/web test`; `pnpm build && pnpm test:e2e 13-cerco 06-avisos-e-preferencias 05-teclado-e-temas`; `GAME_TIME_SCALE=3 pnpm test:e2e 13-cerco -g "ritmo"`; `pnpm capture:landing && pnpm test:e2e:landing`.

**Pronto quando:** o cerco é jogado inteiro em navegador, por teclado, nos três temas, e o app antigo recebe `426` no cenário QA-14.

### V4G-T5 · Revisão independente, medição e segunda publicação da Fase G `M`

Como V4E-T5. **Entregáveis:** **novo** `docs/reviews/v0.4-fase-g.md`; correções `V4G: corrige …`; `docs/balance-v0.4.md`, seção 7 (o resultado do cerco por perfil, ritmo e dificuldade: **a primeira medida da faixa de 65 a 80%**); `CHANGELOG.md`; `deploy/README.md` (a publicação que sobe o protocolo); `CLAUDE.md`; `architecture.md`.

- [ ] V4G-T5.1 O revisor tenta: o cerco com o jogador fora 30 dias; a decisão entre ondas respondida no instante da onda; duas abas trocando a formação; a milícia convocada duas vezes; a Queda com 3 aldeões; o cerco em partida migrada no inverno com a Vigília já passada; a composição da onda 3 na visão; o fuso que muda no meio; o recibo antigo com protocolo 3.
- [ ] V4G-T5.2 Correções; relatório; Registro.
- [ ] V4G-T5.3 Simulador: as três matrizes com o cerco; a faixa do Regular medida (não fixada: V4I-T1); o ouro por destino.
- [ ] V4G-T5.4 Integração; portão; backup manual; SHA; aviso ao autor. O `push` é dele.
- [ ] V4G-T5.5 O autor joga um cerco (roteiro), ou fica registrado.

---

## 8. Fase H — Conselho (lotes 2 e 3) e objetivos

**Meta da fase:** o Conselho chega às 60 cartas (o lote 2 herdado, 23 cartas, e o lote 3, 15), com os efeitos novos que as cartas pedem; os objetivos 17 a 21; o Retorno e "Antes de partir" com a guerra. Conteúdo depois das mecânicas que ele cita (o teste de `council.test.ts` que barra por expressão regular ferro, exército, combate, presságio, quartel, muralha, horda e cerco é **afrouxado de propósito aqui**, carta a carta).

### V4H-T1 · O lote 2 do Conselho, herdado da v0.3 `L`

**Objetivo:** as 23 cartas do lote 2 (ADR 0018, decisão 19, menos a "Estrangeira ferida", que já entrou) e os efeitos que elas pedem: `addMaster` (a cadeia "Os Refugiados": Gil e Ximena ganham origem), `market.effects` (preço por carta), o requisito de carta por herói presente, a opção extra por traço ou classe, o efeito com sorteio resolvido na virada seguinte.
**GDD:** §7, Apêndice B; roadmap da v0.3, §13.3 (a lista das 24).
**Depende de:** V4A-T2 (decisão 1: se a resposta for "v0.3.1", a tarefa sai deste plano e vira a V3F-T1 retomada); **pode começar depois da Fase B**, em trilha de conteúdo. **Da v0.3 usa:** o branch `wip/v3f-t1-lote2` (`2352e39`: `council.effects.test.ts`, `council.ts`, `councilTurn.ts`, `councilView.ts` e três arquivos de cartas, **não verde, nunca testado**), `deliverMaster` (existe; nenhuma carta a chama), `scripted`.
**Decisões:** 1, 23.
**Trilha:** motor e conteúdo.
**Entregáveis:** os do branch, revisados um a um (não juntar sem revisar); `packages/content/src/cards/*.ts` (**novos** `refugees.ts`, `kingsCollector.ts`, `mysteriousMerchant.ts`, `whiteWolf.ts`, `scripted.ts` com "O mercador itinerante", avulsas), `council.ts` (efeitos `addMaster`, `marketPrice`, `rollEffect`; requisitos `heroPresent`, `heroTrait`, `heroClass`), `council.test.ts`, `chronicle.ts`; `packages/engine/src/council.ts`, `councilTurn.ts`, `councilView.ts`, `marketTurn.ts` (os efeitos sobre o preço), `migrations/v36.ts` e o passo em `v35.ts` (`market.effects`); `docs/content-v0.4.md`, seções 4 a 8 (as fichas aprovadas pelo autor); `sim-cli` (`SHOW_COVERAGE=1`: cobertura por posse); README do motor ("Uma carta nova": toda carta nova muda o sorteio de todas as sementes).

| V4H-T1 | 2026-10-28 | `7d760d7`, `c58342d`, `24199ce`, `b902b00` (`v4h-t1-cartas`), `b5c009c`, `adffa9c`, `303b79b`, `c552a43`, `c778f3f`, `0d3ff45` e o desta linha (`v4h-t1-avulsas`) | duas trilhas: Codex (`v4h-t1-cartas`, e início de `v4h-t1-avulsas`) e subagente Gemini (`v4h-t1-avulsas`) | **Parcial no roadmap; escopos Mercado/Coroa e quatro avulsas concluídos (43 cartas no catálogo) com correções da revisão.** Nove cartas transcritas de §§4.4, 5.1–5.5 e 6.1–6.3 aprovados (estado **35 → 36**) e quatro avulsas de §§7.3–7.5 e 8.1 (`passingRecruiter`, `gamblingDebt`, `squareDuel`, `wanderingHealer`, estado **36 → 37**: `guild.tavern.extraOffer` e `heroes` em `council.pending`/`delayed`, passo `v36ToV37` e guarda `stateV37`). Correções da revisão independente: arbitragem intradiária eliminada com início de `marketPrice` na próxima virada de dia (achados 1 e 3; `c552a43`); guarda e filtros de efeitos vencidos do Mercado em `stateV36`/`stateV37`, `nextMarketEffectAt` e `marketView` (achado 2; `c778f3f`); testes de contrato de `council.test.ts` cobrindo `rollEffect`, `resourcesPercent`, `marketPrice` e `option.requires.flags` com exceções restritas aos IDs aprovados (achado 4; `0d3ff45`); `firstFree` do bot preferindo opção gratuita sem perda imediata e `drawable` em `coverage.test.ts` restrito a cartas sem flag de cadeia (suspeita 5); fichas aprovadas de `kingsTax` e `merchantBoycott` mantidas sem travas arbitrárias e registradas como pendência H-5 (suspeita 6). Efeitos `tavernExtraOffer`, `injureHero` e `healHero` e requisitos `heroPresent` (1 ou 2) e `injuredHero` com testes; 55 retratos v36 congelados em `FROZEN` e 56 retratos v37 gravados; goldens regravados só com `UPDATE_GOLDEN=1` e diff conferido. **Verificação em `v4h-t1-avulsas`:** testes focados verdes; `pnpm typecheck` saída **0**; `pnpm lint` saída **0**. Propostas H-1 a H-5 nas pendências | **Simulador, cobertura em 50 sementes, replay completo de `migrations.test.ts` e verify inteiro ficaram para o coordenador.** Integração e navegador não executados; sem build, publicação ou push. `bands.ts` intocado. T1.1 e demais fichas/ganchos de T1.2–T1.4 (cadeias de mercadores/Lobo Branco/aprendiz) não concluídos nesta trilha |
