# Lords of the Guild — Roadmap da v0.4 "Guerra e Cerco"

> **Status:** plano **proposto, sem nenhuma tarefa executada.** A versão 0.1 foi escrita em 2026-10-07 (entrega da tarefa V3G-T5 do [roadmap da v0.3](roadmap-v0.3.md)), por um agente, sem o autor, antes de a v0.3 ser publicada. **Esta versão 0.2, de 2026-10-15, foi reescrita contra o código e contra o que a v0.3 de fato entregou e publicou**, no formato do roadmap da v0.3: a Fase A está detalhada e executável; as Fases B a I têm tarefas concretas, com arquivos, subtarefas, verificação e o impacto em partidas vivas. **Nenhuma decisão de regra da v0.4 foi tomada**: a §9 é uma lista de perguntas com opções e uma recomendação cada, para a sessão de decisões (V4A-T2); nada ali vale antes de o autor responder.\
> **Versão do documento:** 0.2 (2026-10-15; a 0.1 é de 2026-10-07)\
> **Base:** [GAME_DESIGN.md](../GAME_DESIGN.md) v0.8: §16 (linha da v0.4), §16.2 (critérios), §18.2 ("§10, §11.1–11.4, §8.3, §9.5; `sim-cli` com os quatro perfis e teste de faixa da §15.2"), §18.3, §4.3, §5.1, §6.1 a §6.3, §8.2 (`[v0.4 completo]`), §8.3, §9.5, §10, §11.1 a §11.4, §12.2, §13.4, §13.5, §14 (contrato de arquitetura), §15.1 a §15.4, Apêndices A e E\
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
- [ ] V4A-T1.6 **O portão.** `pnpm verify` (pelo código de saída), integração, `pnpm build`, `pnpm test:e2e`, `pnpm test:e2e:landing`, no Node 22 do `.nvmrc`; anotar as contagens e comparar com o portão do commit candidato da v0.3 (`pnpm verify` 136 arquivos, 11.525 testes e 1 falha esperada; integração 27 arquivos, 564; navegador 131; página 37 e 7 pulados) e cada falha com o motivo.
- [x] V4A-T1.7 **Linha de base do simulador.** As matrizes nas três dificuldades (`--matrix`, `--difficulty peasant`, `--difficulty ironKing`), `--profile ousado` e `--profile especulador`; as faixas conferidas contra `MEASURED` (a seção 15 de balance-v0.3.md é a última regravação); **o ouro por fonte e por destino** (`goldTable`), que é a régua da §13; a hora do primeiro herói por perfil contra "primeiro herói no dia 2" (V3G-T1.2 não rodou). Registrar: data, commit, `contentHash`, Node, comandos e saídas, com menor e maior entre as 50 sementes.
- [ ] V4A-T1.8 **Tamanho e custo.** Estado e visão no pior caso (seis heróis, três expedições, três relatórios, caravanas, Mestres: a referência da v0.3 é 6,1 a 6,7 kB de estado e 26,6 a 28,8 kB de visão) e `pnpm -s sim -- --perf` (1, 7 e 30 dias reais fora, ritmo 3), contra [perf-v0.1.md](perf-v0.1.md) e balance-v0.3.md, seção 10.6. A carga com 50 bots (`--remote`, contra a API de desenvolvimento) não rodou na v0.3: rodar e registrar p50/p95.
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

- [ ] V4B-T1.1 Retratos que faltarem (V4A-T1.5) em `fixtures.test.ts` **antes** de subir a versão: Armazém no cap de madeira e pedra; uma partida migrada em Rei de Ferro com Mercado e caravana na estrada.
- [ ] V4B-T1.2 Conteúdo: `iron` em `RESOURCE_IDS` e `MARKET_RESOURCE_IDS`; `resources.iron` com rótulo; o Armazém guarda ferro com o mesmo cap de madeira e pedra (GDD §5.5: "cada"); preço-base 8,0 (8.000 milésimos), sem fator de estação; volume `200 × nível` como os outros (decisão 3); **sem caravana de ferro** (`caravanOffer` não o lista; `sendCaravan` com `iron` recusa `INVALID_RESOURCE`) se a decisão ficar como recomendada. Teste de conteúdo: o ferro não aparece em nenhuma recompensa que não seja a Mina Abandonada nem em carta nenhuma.
- [ ] V4B-T1.3 Estado 24 → 25: `settlement.resources.iron` e o acumulador, `market.prices.iron`, `previousPrices.iron`, `tradedToday.iron`, `stats.bought_iron`, `sold_iron` (na migração: zero de ferro, preço na base, nada negociado). O passo não cria prazo, evento, identificador nem sorteio. Guarda: ferro nunca negativo, preço dentro do piso e do teto do passeio.
- [ ] V4B-T1.4 Motor: o ferro no estoque, no cap, no desperdício (`storageWasted`), no `breakdown` do Armazém e na conta das planejadas (nenhum custo de obra usa ferro nesta tarefa); o passeio diário anda também para o ferro no fluxo `market` (**a ordem dos sorteios por recurso muda**: `food`, `wood`, `stone`, `iron`; o golden do Mercado é regravado de propósito e o diff lido); compra e venda a 85% com o volume do dia; `marketPriceSwing` para o ferro.
- [ ] V4B-T1.5 Mina Abandonada (`abandonedMine`): modelo novo com três variantes, no molde do Pântano (requer Guilda Nv2; aparece por descoberta: revelada pela Floresta Antiga ou por uma Patrulha, decisão 3); recompensa de 40 a 80 de ferro no último nó com prova; Desastre marcado nó a nó (`onDisaster`); fichas em **novo** `docs/content-v0.4.md`, seção 1, **rascunho que o autor não leu**; ids fixados em `STABLE_IDS`; calibragem no golden `expedition-calibration.md` e o relatório em `expedition-catalog.json`.
- [ ] V4B-T1.6 `ViewState`: `resources.iron` com `breakdown` e `depletesInSeconds`; `storage` com o ferro; `market.prices.iron` com `surplusSellable`; `guild.available[]` com a Mina. Nenhum número de regra no app.
- [ ] V4B-T1.7 Propriedade: **nenhuma sequência de compra e venda de ferro no mesmo dia dá lucro** (`market.property.test.ts` ganha o ferro); divisão de intervalo com ferro chegando por expedição e indo ao chão no cap; um ritmo diferente de 1.
- [ ] V4B-T1.8 Simulador: o Explorador envia a Mina quando a conhece e vende o ferro que não usa (até a Fase B não há uso: a coluna `iron` sai no CSV, e a faixa do Explorador é remedida de propósito); o `especulador` tenta comprar ferro para revender (prejuízo em toda célula).

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

- [ ] V4B-T2.1 Conteúdo: `buildings.smithy` (Salão Nv4; custo e tempo do GDD; nível 6; **todo nível cabe no depósito nas três dificuldades**, com teste); `balance.smithy: { recipe: { iron: 2, wood: 1 }, perWeaponMs: 6 min, speedPerLevel: 1/10, batchMax }` (decisão 4: "+10% de produção por nível" lido como tempo × 10/(10 + nível − 1), em fração); o rótulo do recurso `weapons` (sem cap, como o ouro).
- [ ] V4B-T2.2 Estado 25 → 26: `settlement.buildings.smithy` (0 na migração), `settlement.resources.weapons` (0), `settlement.forge: { amount; startedAtMs; endsAtMs } | null` (uma fila, um lote por vez). O passo não cria prazo nem evento.
- [ ] V4B-T2.3 Ordem `forgeWeapons { amount }`: cobra ferro e madeira **ao começar o lote** (como uma obra), lote de 1 a `batchMax`; recusas `SMITHY_REQUIRED`, `FORGE_BUSY`, `INVALID_AMOUNT`, `INSUFFICIENT_RESOURCES`. `cancelForge` devolve 80% (a regra das obras). O fim do lote é instante da linha do tempo (`timeline.ts`), resolvido junto das obras concluídas (`finishConstructions`, §0.7), com `weaponsForged` e as armas entrando sem cap.
- [ ] V4B-T2.4 `ViewState`: `smithy { built; level; forge: { amount; endsInSeconds } | null; perWeaponSeconds; offer: { maxAmount; costText } }`, `resources.weapons`; `UpgradeView.effect` do Ferreiro diz o que cada nível muda.
- [ ] V4B-T2.5 Propriedade: nenhum ciclo lucrativo ferro → arma → (nada: a arma não se vende; o teste confere que não há caminho de volta); divisão de intervalo com um lote terminando no meio; ritmo diferente de 1.
- [ ] V4B-T2.6 Simulador: o Explorador ergue o Ferreiro depois do Quartel (a política entra agora e fica inerte até a Fase C) e forja com o ferro parado; coluna `weapons`.

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

- [ ] V4B-T3.1 Conteúdo: durabilidade por raridade (número de usos), desgaste por expedição e, a partir da Fase D, por batalha em que o herói comanda; reparo custa ferro por ponto e tempo no Ferreiro, na mesma fila da forja (decisão 5).
- [ ] V4B-T3.2 Estado 26 → 27: `Item.condition` (na migração, cheio); `settlement.forge` passa a aceitar `kind: 'repair'` com o `itemId`. Guarda: condição entre 0 e a durabilidade da raridade.
- [ ] V4B-T3.3 Motor: o desgaste é cobrado no fim da expedição (um ponto por item equipado de quem voltou); um item em 0 não dá bônus e a ficha diz; `repairItem { itemId }` recusa `SMITHY_REQUIRED`, `FORGE_BUSY`, `ITEM_NOT_FOUND`, `ITEM_INTACT`, `INSUFFICIENT_RESOURCES`; o fim do reparo junto das obras.
- [ ] V4B-T3.4 `ViewState`: `conditionText` em cada `ItemView`, `repairOffer` com custo e prazo; `heroes[].powerBreakdown` diz o item gasto.
- [ ] V4B-T3.5 Testes: desgaste exato por expedição; o item que chega a 0 na expedição em curso; reparo com o jogador fora; o item gasto que é vendido por ouro ao cheio do arsenal (vale o conteúdo, não a condição; decisão 5); golden regravado.

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

- [ ] V4B-T4.1 **Mostrar ao autor** o ferro na tabela do Mercado e o painel do Ferreiro com um lote em curso antes de completar a tela.
- [ ] V4B-T4.2 Estoque e Mercado com o ferro; o total da negociação continua `quantidade × preço de hoje` (`ui/market.ts`), a única conta do app.
- [ ] V4B-T4.3 Painel do Ferreiro: a obra quando não há Ferreiro; a forja em duas etapas ("Revisar", "Confirmar") como a negociação; o lote em curso com "termina em…" e "Cancelar (devolve 80%)"; o reparo pela ficha do item no Arsenal.
- [ ] V4B-T4.4 Árvore, paleta, barra de status (a forja não entra na barra: não é decisão), avisos (`weaponsForged` como "todas"), Retorno e "Antes de partir".
- [ ] V4B-T4.5 Navegador: forjar, cancelar, reparar, o ferro negociado, a ordem das setas; o cenário "no ritmo da produção".

**Diversão:** a sessão de dois minutos: vender a madeira parada, comprar ferro, mandar forjar, sair.

**Verificação:** `pnpm --filter @lotg/web test`; `pnpm build && pnpm test:e2e 10-mercado 11-ferreiro 05-teclado-e-temas`; `pnpm capture:landing && pnpm test:e2e:landing` (a aba Feudo muda).

**Impacto em partidas antigas:** nenhum no estado; `VIEW_FORMAT` não sobe (só adições).

**Pronto quando:** os quatro fluxos passam por teclado nos três temas e o pacote do app continua sem número do jogo.

**Prompt sugerido:** "Leia CLAUDE.md, packages/web/README.md, docs/roadmap-v0.4.md V4B-T4 e Apêndice B.4, e o golden da visão com ferro e Ferreiro. Mostre primeiro a tabela do Mercado com o ferro e o painel do Ferreiro. Depois a forja em duas etapas, o reparo, a árvore, a paleta, Retorno, 'Antes de partir' e os cenários em navegador. Nenhum número de jogo no app."

### V4B-T5 · Revisão independente e medição da Fase B `S`

**Objetivo:** revisão de leitura por um agente que não escreveu o código (Apêndice A.4), correções um commit por defeito, a rodada do simulador e o relatório gravado.
**Depende de:** V4B-T1 a V4B-T4.
**Entregáveis:** **novo** `docs/reviews/v0.4-fase-b.md`; correções `V4B: corrige …`; `docs/balance-v0.4.md`, seção 2; `docs/pendencias-v0.4.md`; `CLAUDE.md` e `docs/architecture.md` atualizados pela integração.

- [ ] V4B-T5.1 Revisor independente sobre os commits da fase. Tenta: comprar ferro e vender no mesmo dia; forjar com o lote terminando no instante de uma obra; cancelar a forja duas vezes; reparar um item equipado por um herói em expedição; migração de uma partida com estoque no cap e caravana na estrada; o ferro em `caravanOffer`; o preço do ferro na visão sem Mercado.
- [ ] V4B-T5.2 Corrige os confirmados, cada um com teste de regressão; classifica o resto; registra no §15.
- [ ] V4B-T5.3 Simulador: as três matrizes, `especulador`, o ouro por fonte e por destino (o ferro comprado é o primeiro sumidouro novo: §13); faixas remedidas de propósito onde a regra mudou.
- [ ] V4B-T5.4 Integração: portão inteiro, `CLAUDE.md`, `architecture.md`, README do motor e do app; linha "V4B (integração)" no §15. **Sem `push`.**
- [ ] V4B-T5.5 O autor joga a fase (roteiro de 15 minutos em `docs/pendencias-v0.4.md`). Se não jogar, fica registrado.

**Pronto quando:** cada defeito confirmado tem teste e correção, o relatório está no repositório, a matriz está dentro das faixas regravadas e o Registro diz o que não foi verificado.

**Prompt sugerido:** "Leia CLAUDE.md e docs/roadmap-v0.4.md V4B-T5. Lance um revisor com o prompt do Apêndice A.4 sobre os commits da Fase B; grave o relatório em docs/reviews/v0.4-fase-b.md; corrija cada defeito confirmado em um commit próprio com teste; rode as matrizes e registre em docs/balance-v0.4.md, seção 2."

---

## 3. Fase C — Quartel, exército e formações

**Meta da fase:** o feudo treina soldados, que saem da população e comem mais, e o jogador monta e salva formações com um herói comandando cada ala. Ainda não há batalha: a formação salva é a promessa da Fase D e a Defesa ativa, a da Fase E. É a fase que cria o maior custo contínuo novo (comida dos soldados) e o primeiro destino novo do ouro (treino).

### V4C-T1 · Quartel e soldados `L`

**Objetivo:** o Quartel como edifício, as cinco unidades treináveis como conteúdo, o treino sequencial em lotes e os soldados como habitantes que não trabalham.
**GDD:** §5.2 (1,5 de comida por soldado por hora), §6.1 (Quartel: Salão 4, nível 8, limite 10 × nível, treino 5% mais rápido por nível), §6.2 (250 madeira, 150 pedra, 100 ouro, 20 min), §10.2 (as unidades), §17.1 ("soldados saem da população").
**Depende de:** V4B-T2 (armas). **Da v0.3 usa:** `population.villagers`, `inhabitants` e o piso (`masters.ts`), a fila de recrutamento (molde do treino), a conta única da produção em frações, `heroCapture` por dificuldade (molde de regra por dificuldade).
**Decisões:** 7.
**Trilha:** motor.
**Entregáveis:** `packages/content/src/ids.ts` (`BUILDING_IDS` + `barracks`, **novo** `UNIT_IDS`: `spearman`, `swordsman`, `archer`, `knight`, `shieldbearer`; `militia` só na Fase G), **novo** `units.ts` (a tabela do §10.2 e o ciclo de contra-ataques, com teste), `buildings.ts`, `balance.ts` (**novo** `army`: `capPerLevel: 10`, `trainingSpeedPerLevel: 1/20`, `batchMax: 10`, `foodPerSoldierPerHour: 3/2`, `formationsCap`), `chronicle.ts` (`trainingStarted`, `soldiersTrained`, `soldiersDisbanded`); `packages/engine/src/types.ts`, `state.ts`, **novo** `army.ts` (contas puras: limite, custo, comida), **novo** `armyOrders.ts`, **novo** `armyTurn.ts`, **novo** `armyView.ts`, `economy.ts` (a comida dos soldados no consumo), `population.ts`, `masters.ts` (`inhabitants` soma soldados), `famine.ts` (quem deserta por fome: só aldeões; decisão 7), `advance.ts`, `timeline.ts`, `commands.ts` (`trainSoldiers { unit, amount }`, `cancelTraining`, `disbandSoldiers { unit, amount }`), `rejections.ts`, `migrations/v28.ts` e o passo em `v27.ts`; protocolo; `sim-cli` (bot `militar`, V4C-T1.8); README; GDD §10.2.

- [ ] V4C-T1.1 Retratos que faltarem antes de subir a versão: um feudo com as casas cheias e um com fome aberta (os soldados mudam as duas contas).
- [ ] V4C-T1.2 Conteúdo: `buildings.barracks` (Salão Nv4; nível 8; **cada nível cabe no depósito nas três dificuldades**, com teste); as cinco unidades com atributos inteiros, iniciativa, linha, custo e tempo de treino do §10.2; o ciclo de contra-ataques como tabela (`counters: Record<UnitId, UnitId>`) e o Escudeiro neutro; teste de conteúdo: todo custo com arma pede uma arma inteira, nenhuma unidade custa ferro direto.
- [ ] V4C-T1.3 Estado 27 → 28: `settlement.buildings.barracks` (0), `army: { units: Record<UnitId, number>; training: { unit; amount; startedAtMs; endsAtMs } | null; reportsKept… (fica para a Fase D) }`. Guarda: soma das unidades ≤ `capPerLevel × nível`, nenhuma unidade com o Quartel no 0.
- [ ] V4C-T1.4 Ordem `trainSoldiers { unit, amount }`: um lote por vez, de 1 a 10, sequencial; cobra comida, ouro, madeira, pedra e armas ao começar; **o soldado sai da população ao terminar o treino** (decisão 7: um aldeão sem ofício vira soldado; com todos ocupados, sai do edifício com mais gente, a regra dos feridos) e precisa de vaga habitacional (que já tem: já morava); recusas `BARRACKS_REQUIRED`, `TRAINING_BUSY`, `ARMY_LIMIT`, `NOT_ENOUGH_VILLAGERS` (o piso de 3 aldeões protege), `INVALID_AMOUNT`, `INSUFFICIENT_RESOURCES`. `cancelTraining` devolve 80%. `disbandSoldiers` devolve aldeões sem ofício, sem devolução de custo.
- [ ] V4C-T1.5 Consumo: 1,5 de comida por soldado por hora de jogo, somado ao consumo dos habitantes em `netRates`; o `breakdown` da comida diz "−15/h (10 soldados)"; a fome alcança os soldados? (decisão 7: a fome corta a produção e deserta aldeões; soldados **não** desertam por fome nem por moral, mas comem).
- [ ] V4C-T1.6 Instante: o fim do treino na linha do tempo, resolvido junto dos recrutas que chegam (`finishRecruitments`), antes dos Mestres à porta (§0.7), com teste do instante exato e a razão no README.
- [ ] V4C-T1.7 `ViewState`: `army { built; level; cap; units: Array<{ id; label; count; stats; counters; costText; foodPerHour }>; training: { unitLabel; amount; endsInSeconds } | null; offer: Array<{ unit; maxAmount; blockedReason }> }`; `population` ganha `soldiers`; `food.breakdown` com o termo.
- [ ] V4C-T1.8 Simulador: bot **`militar`** (GDD §15.3: o `economico` mais erguer o Quartel e o Ferreiro, treinar com o que o ferro e a comida permitem; as políticas de formação entram em V4C-T2) e, **nos três bots da rodada padrão**, a política mínima de guerra que a decisão 25 fixar (o Regular tem de chegar ao cerco com exército para a faixa de 65 a 80% fazer sentido). Colunas `soldiers`, `soldiers_by_unit`, `training_batches`, `army_food`. Faixas remedidas de propósito.
- [ ] V4C-T1.9 Propriedade: divisão de intervalo com treino terminando e fome abrindo no caminho; a comida nunca negativa; soldado + aldeão + Mestre nunca acima das casas; nenhum ciclo lucrativo aldeão → soldado → aldeão (dispensar não devolve nada).

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

- [ ] V4C-T2.1 Estado 28 → 29: `army.formations: Formation[]` (`id` de `nextId(draft, 'formation')`, `name`, `posts: Record<Wing, Record<Line, { unit; count } | null>>`, `commanders: Record<Wing, heroId | null>`), `army.activeFormationId: string | null`. Teto `formationsCap`. Guarda: contagens ≤ `postMax`, comandante existe e não está capturado.
- [ ] V4C-T2.2 Validação: uma formação pode pedir mais unidades do que o feudo tem (ela é um plano; a prévia e a batalha preenchem o que há e avisam: GDD §10.8, "postos vazios por falta de unidades"); a linha de cada unidade é fixa (Arqueiro só atrás); o mesmo herói não comanda duas alas; o herói em expedição, escolta, ferido ou capturado não pode ser nomeado (`HERO_UNAVAILABLE`); **nomear o herói na formação ativa o impede de partir** (`HERO_BUSY` em `sendExpedition` e `sendCaravan`; decisão 8), e dispensá-lo o tira da formação.
- [ ] V4C-T2.3 Ordens `saveFormation`, `deleteFormation` (não a ativa: `FORMATION_ACTIVE`), `setActiveFormation`; recusas `FORMATION_NOT_FOUND`, `FORMATIONS_CAP`, `INVALID_FORMATION` com a frase do que está errado. Nenhuma sorteia nem cria instante.
- [ ] V4C-T2.4 `ViewState`: `army.formations[]` com `posts` rotulados, `commanders` com nome e classe, `shortfall` (o que falta de cada unidade), `isActive`; `army.editor: { units: disponíveis; heroes: elegíveis com o motivo; postMax }`; `guild.heroes[].commanding` (a ala e a formação); `pendingDecisions` **não** muda.
- [ ] V4C-T2.5 Testes: salvar, editar, apagar, ativar; o comandante que parte em expedição; o cativo que era comandante; a formação que fica com postos vazios quando soldados são dispensados; golden.

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

- [ ] V4C-T3.1 **Mostrar ao autor** o editor com uma formação de três postos antes de completar a tela.
- [ ] V4C-T3.2 Painel do Quartel: a obra; as unidades com custo, comida, contra quem é forte e fraca (do `ViewState`); o treino em duas etapas; o lote em curso; dispensar com confirmação.
- [ ] V4C-T3.3 Editor: a grade do §13.4 sem a linha inimiga (Fase D a traz com `?`); o posto como botão (papel `gridcell`), o seletor como diálogo com foco por `useLayoutEffect`; o comandante por ala com o motivo de quem não pode; o estado da montagem é da tela e a ordem nasce em "Salvar"; "Ativar como Defesa"; a lista das salvas.
- [ ] V4C-T3.4 Árvore, paleta, barra de status (sem Defesa ativa com exército é aviso, não decisão), Retorno, "Antes de partir".
- [ ] V4C-T3.5 Navegador: treinar, cancelar, montar e salvar por teclado, ativar, o comandante que não parte, a ordem das setas da árvore, os três temas, 720 px.

**Diversão:** o editor tem de ser mais rápido de usar do que de explicar: seis postos, três comandantes, um botão.

**Verificação:** `pnpm --filter @lotg/web test`; `pnpm build && pnpm test:e2e 12-exercito 05-teclado-e-temas 09-guilda`; `pnpm capture:landing && pnpm test:e2e:landing`.

**Impacto em partidas antigas:** nenhum no estado; `VIEW_FORMAT` não sobe.

**Pronto quando:** uma formação é montada e ativada só pelo teclado, nos três temas, e o pacote do app não leva número nenhum das unidades.

**Prompt sugerido:** "Leia CLAUDE.md, packages/web/README.md, GAME_DESIGN.md §13.4, docs/roadmap-v0.4.md V4C-T3 e Apêndice B.4, e os goldens da visão com exército. Mostre primeiro o editor com três postos. É tarefa L: um commit por subtarefa. Sem prévia, sem linha inimiga, sem arrastar."

### V4C-T4 · Revisão independente e medição da Fase C `S`

Como V4B-T5, sobre a Fase C. **Entregáveis:** **novo** `docs/reviews/v0.4-fase-c.md`; correções `V4C: corrige …`; `docs/balance-v0.4.md`, seção 3; integração e `CLAUDE.md`.

- [ ] V4C-T4.1 O revisor tenta: treinar com as casas cheias; o soldado e o piso de 3; a fome com soldados; dispensar durante o treino; o comandante dispensado, capturado ou que parte em caravana; duas abas salvando a mesma formação; a migração de uma partida com fome aberta; o número de unidades no pacote do app.
- [ ] V4C-T4.2 Correções com teste; relatório no repositório; Registro.
- [ ] V4C-T4.3 **A medição do ouro** (§13): o ouro por fonte e por destino com o treino e o ferro; **volta ao autor com propostas concretas** antes da Fase D (decisão 2).
- [ ] V4C-T4.4 Integração: portão, `CLAUDE.md`, `architecture.md`, READMEs; linha no §15. Sem `push` (decisão 26).
- [ ] V4C-T4.5 O autor joga a fase (roteiro em `docs/pendencias-v0.4.md`), ou fica registrado que não jogou.

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

- [ ] V4D-T1.1 **Goldens primeiro:** sete cenários escritos à mão a partir do §10.4, com a conta feita no documento (`docs/content-v0.4.md`, seção 2), antes de uma linha do motor.
- [ ] V4D-T1.2 Conteúdo: os oito inimigos com arquétipo, atributos, iniciativa, linha e regra especial como dado (`alwaysLateral`, `ignoresWallHalf`, `noMorale`, `auraWing`, `auraArmy`, `endsWaveOnDeath`, `takesDoubleFrom: ['mage', 'cleric']`); teste: todo arquétipo tem contra-ataque definido.
- [ ] V4D-T1.3 A resolução, em inteiros: ordenação por iniciativa com desempate pelo lado defensor e, dentro do lado, por ala e linha (decisão 11); alvo (Frente, Retaguarda, flanco ×5/4); dano bruto `atq × n × contra × aura × flanco × cobertura × sorte` com a sorte sorteada **uma vez por esquadrão por rodada** no fluxo da batalha; absorvido `def × n × 1/2`; efetivo `máx(bruto − absorvido, bruto × 1/5)`; baixas `piso((efetivo + residual) / vida)` com o residual guardado por esquadrão; Escudeiros absorvem 50% do dano à Retaguarda da ala; corpo a corpo bate na muralha até rompê-la (Ogro: metade); arqueiros inimigos ignoram a muralha a ×7/10; arqueiros do jogador atrás de muralha intacta ×6/5; torres (12 por nível acima de 2) por ala por rodada; Mago em área a cada 3 rodadas e ×2 contra mortos-vivos; Clériga cura 10% da Frente a cada 2 rodadas e +20 de moral; moral −10, −20, −15, debandada em ≤ 30 (mortos-vivos e o chefe sem moral); fim por lado sem esquadrões, debandada ou 12 rodadas ("Resistiu" em defesa; o atacante recua em ataque); o comandante só sofre dano quando a Frente da ala cai, e **nunca morre fora de Rei de Ferro** (`heroCapture` decide).
- [ ] V4D-T1.4 O sorteio: a batalha recebe um fluxo nomeado (`battle:<id>`, família nova em `RNG_STREAM_FAMILIES`, apagado no fim do instante) e consome a sorte em ordem fixa; **a mesma entrada dá o mesmo relatório** (golden), e a ordem das batalhas de um instante é a do identificador.
- [ ] V4D-T1.5 O relatório: por rodada (ataques, baixas, muralha, moral) e, no topo, os três fatores decisivos por atribuição de dano (muralha absorvida, contra-ataque, retaguarda exposta, flanco, torre, aura), como dados que a visão transforma em frase; baixas por posto; dano à muralha; XP dos comandantes (`expeditions.xpShare` como molde); `army.reports` com teto `reportsKept` (3).
- [ ] V4D-T1.6 Estado 29 → 30: `army.reports: BattleReport[]` (vazio), `army.reportsKept` no conteúdo. Nenhum outro campo: a muralha com HP é da Fase E.
- [ ] V4D-T1.7 Propriedade: a batalha termina em ≤ 12 rodadas para qualquer entrada válida; baixas nunca passam dos efetivos; o relatório é função da entrada e do fluxo; a divisão de intervalo não muda uma batalha (ela é instantânea).

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

- [ ] V4D-T2.1 A amostra do inimigo: o que se sabe (nesta fase, nada: a Horda é da Fase E; a prévia usa a composição-base da estação, Apêndice A, com `?` nos postos sem informação); cada uma das 200 batalhas preenche o desconhecido com uma amostra da composição provável, sorteada em um gerador **próprio da prévia**, semeado por `hash`, nunca `state.rng` (decisão 10).
- [ ] V4D-T2.2 A ordem `simulateBattle { formationId }`: não sorteia no fluxo do estado, não cria entidade, grava `army.preview { formationId; atMs; wins; glorious; losses; risk; expectedLosses }` (um por vez; o anterior é substituído) e conta em `stats.battlesSimulated` (o objetivo da Fase H). Recusas `FORMATION_NOT_FOUND`, `BARRACKS_REQUIRED`. **`purity.test.ts` ganha a exceção explícita**: `warCouncil.ts` pode usar o gerador com semente derivada dentro de um comando, e o teste prova que `state.rng` sai igual ao que entrou.
- [ ] V4D-T2.3 Critério 2 como teste: para uma composição inimiga totalmente conhecida, `previewBattle` com uma semente igual à da batalha real dá o mesmo relatório que `resolveBattle` (golden compartilhado).
- [ ] V4D-T2.4 `ViewState`: `army.preview` com `winsPercent`, `gloriousPercent`, `lossesPercent`, `riskText` (montado no motor a partir do fator), `expectedLosses` por posto, `knownEnemy` por posto com `?`; `army.formations[].previewStale` quando a formação mudou depois.
- [ ] V4D-T2.5 Simulador: o `militar` simula antes de ativar e troca a formação se a prévia der menos de 50% (política que lê só a visão).

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

- [ ] V4D-T3.1 As auras como fatores de fração aplicados à ala; o Mago em área; a Clériga curando; a frase da ficha do herói diz o que ele dá como comandante.
- [ ] V4D-T3.2 O comandante sofre dano quando a Frente cai: ferimento leve ou grave pela parte do dano (`heroCapture` em Rei de Ferro: morte); XP por batalha a quem comandou; o desgaste do equipamento por batalha.
- [ ] V4D-T3.3 O evento `battleFought` com os três fatores como dados e a frase; `CHRONICLE_HIDDEN_EVENT_TYPES` ganha `battleSimulated`.

**Verificação:** `pnpm --filter @lotg/engine test -- battle heroes chronicle`.

**Impacto em partidas antigas:** nenhum (adição).

**Pronto quando:** uma formação com Clériga no centro dura mais rodadas no golden do que sem, e a ficha do herói diz por quê.

### V4D-T4 · O Conselho de Guerra na interface `M`

**Objetivo:** o editor ganha a linha inimiga com `?`, o botão "Simular", o bloco do Conselho de Guerra (§13.4) e o relatório de batalha com "Ajustar formação".
**Depende de:** V4D-T2, V4D-T3, V4C-T3.
**Trilha:** app.
**Entregáveis:** `packages/web/src/tabs/Army.tsx`, `components/FormationEditor.tsx` (a linha "Inimigo (prev.)"), **novos** `components/WarCouncilPanel.tsx`, `components/BattleReport.tsx` (por rodada colapsável, os três fatores no topo), `ui/army.ts`, `palette/commands.ts` (`lords.simulateBattle`), `app/controller.ts`, `game/returnReport.ts` (`battleFought` em "O que exigiu um preço"), `tests/e2e/12-exercito.spec.ts`; README do app.

- [ ] V4D-T4.1 **Mostrar ao autor** a prévia de uma formação antes do resto.
- [ ] V4D-T4.2 "Simular" como ordem com trava `preview:<formação>`; o bloco com Vitória, Gloriosa, Derrota e o risco em uma frase; "prévia desatualizada" quando a formação mudou.
- [ ] V4D-T4.3 O relatório: rodadas colapsáveis, fatores, baixas, muralha, XP; "Ajustar formação" leva ao editor com a formação usada.
- [ ] V4D-T4.4 Navegador: simular, ler o relatório (posto por `/__test/battle`, rota de teste nova em `tests/e2e/server.ts`), teclado, temas.

**Verificação:** `pnpm --filter @lotg/web test`; `pnpm build && pnpm test:e2e 12-exercito`.

**Pronto quando:** a prévia aparece em menos de um ciclo de leitura e o relatório é lido só pelo teclado.

### V4D-T5 · Revisão independente da Fase D `S`

Como V4B-T5, sobre a Fase D, **antes de qualquer incursão usar a batalha**. **Entregáveis:** **novo** `docs/reviews/v0.4-fase-d.md`; correções `V4D: corrige …`; `docs/balance-v0.4.md`, seção 4 (a prévia por formação de referência: o que vence o quê); integração.

- [ ] V4D-T5.1 O revisor tenta: ponto flutuante em qualquer conta; sorte fora da ordem; `state.rng` tocado pela prévia; relatório que depende da ordem de inserção dos esquadrões; dois esquadrões com a mesma iniciativa dos dois lados; muralha em 0 e Ogro; moral de mortos-vivos; o comandante morto fora de Rei de Ferro; a prévia com formação de outro feudo; o pacote do app com um atributo de unidade.
- [ ] V4D-T5.2 Correções com teste; relatório; Registro; integração sem `push`.
- [ ] V4D-T5.3 **Calibragem de referência** (`docs/content-v0.4.md`, seção 2): dez formações contra as composições-base de cada estação, com a prévia; o que nunca vence ou nunca perde volta ao autor.

**Pronto quando:** como V4B-T5, mais a calibragem gravada.

---

## 5. Fase E — Muralha, incursões completas e Horda

**Meta da fase:** a defesa passa a ter consequência: a Paliçada vira Muralha e Baluarte com HP e reparo, a Torre dispara, toda incursão é uma batalha com a Formação de Defesa ativa (critério 1), saqueadores entram, a Horda guarda a última formação e adapta a composição (critério 3), a Fortaleza surge no outono e os presságios dizem parte do que vem. É a **primeira publicação recomendada** (decisão 26).

### V4E-T0 · Sessão de decisões, lote 2 → ADR 0020 `S`

Como V4A-T2, para as decisões 15 a 24 (§11.2), com a medição das Fases B a D na mão (o ouro por destino, a calibragem da prévia). **Entregáveis:** **novo** `docs/decisions/0020-horda-cerco-e-cronica-do-ano.md`; GDD §8.2, §8.3, §9.5, §10.6, §11.1 a §11.4 corrigidos; §11 com a coluna "Registro".

- [ ] V4E-T0.1 Levar primeiro o que as Fases B a D mostraram (o ouro, a calibragem, o que o revisor deixou em dúvida).
- [ ] V4E-T0.2 Rodadas curtas: 14 (se ainda aberta), 16, 19 e 26 primeiro (mudam o jogo de quem já joga); depois 15, 17, 18, 20 a 24.
- [ ] V4E-T0.3 ADR 0020; GDD; §11.

### V4E-T1 · Muralha de Pedra, Baluarte e Torre Nv3+ `M`

**Objetivo:** a Paliçada vai até o nível 6 (Nv3–4 Muralha de Pedra, Nv5–6 Baluarte) com HP por ala, dano que persiste e reparo; a Torre de Vigia vai até o 5 e dispara a partir do 3.
**GDD:** §6.1, §6.2 (Muralha de Pedra Nv3: 300 madeira, 450 pedra, 1 h), §6.3 (reparo: 50% da pedra do nível, 15 min por 25% de HP, prioridade na fila), §10.1 (muralha e torres), §8.2.
**Depende de:** V4D-T1 (a muralha é dado da batalha). **Da v0.3 usa:** `buildings.ts` (`maxLevel: 2` da Torre e da Paliçada), `construction.ts`, as filas, `threatView.ts`.
**Decisões:** 16 (a parte da Torre), 20 (reparo entre ondas fica para G).
**Trilha:** motor.
**Entregáveis:** `packages/content/src/buildings.ts` (Paliçada `maxLevel: 6` com os nomes por faixa e os custos; Torre `maxLevel: 5`), `balance.ts` (`threat.watchtowerLevels` com cinco entradas: antecedência, tamanho, **composição revelada** e `towerDamage`; `wall: { hpByLevel; repair: { stoneRatio: 1/2; msPerQuarter: 15 min } }`), `chronicle.ts` (`wallDamaged`, `wallRepairStarted`, `wallRepaired`); `packages/engine/src/types.ts` (`settlement.wall: { hp: Record<Wing, number> }`), **novo** `wall.ts`, `construction.ts` (a obra de reparo com prioridade), `commands.ts` (`repairWall`), `threat.ts`, `threatView.ts`, `migrations/v31.ts` e o passo em `v30.ts`; protocolo; README; GDD §6.1.

- [ ] V4E-T1.1 Conteúdo: os níveis 3 a 6 da Paliçada com nome, custo (a regra geral ×1,6 a partir do base da Muralha), tempo, HP por ala; os níveis 3 a 5 da Torre com antecedência (3, 4 e 5 h reais?: **decisão 16**), o que revelam da composição e o dano por ala; **todo nível cabe no depósito nas três dificuldades**, com teste; a recusa no teto deixa de prometer versão futura.
- [ ] V4E-T1.2 Estado 30 → 31: `settlement.wall.hp` por ala (na migração: cheio pelo nível de hoje), `settlement.wallRepair: { untilMs; toHp } | null`. Guarda: HP ≤ o do nível.
- [ ] V4E-T1.3 Motor: a batalha recebe a muralha por ala e devolve o dano; o HP persiste; a obra de reparo (`repairWall`) custa 50% da pedra do nível, dura 15 min de jogo por 25% faltante, **entra na frente da fila** (a obra ativa espera; teste do instante) e termina junto das obras; a Torre Nv3+ entra na batalha como dano fixo por ala; o aviso da Torre diz da composição o que o nível permite.
- [ ] V4E-T1.4 `ViewState`: `threat.defense` ganha `wall { levelLabel; hpText por ala; repairOffer }` e `tower { damageText; revealsComposition }`; `UpgradeView.effect` dos níveis novos.

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

- [ ] V4E-T2.1 Conteúdo: os inimigos que as incursões usam, o tamanho por Ameaça e estação (leve, média, forte), a composição por estação (Apêndice A) como pesos, as três roteirizadas, o que custa perder.
- [ ] V4E-T2.2 Estado 31 → 32: `ScheduledRaid` ganha `composition: Array<{ enemy; count; wing; line }>` (sorteada **quando a incursão é marcada**, no fluxo `horde`, e nunca mostrada além do que a Torre revela), `size: 'strong'` possível; `horde.scheduledRaids` de uma partida migrada ganha composição no passo? **Não**: o passo não sorteia; a incursão já marcada sem composição é resolvida com a composição-base da estação, sem sorteio, e o teste prova.
- [ ] V4E-T2.3 Motor: `settleRaids` monta o atacante da composição, o defensor da Formação de Defesa ativa (postos vazios ficam vazios; **sem formação ativa, a batalha roda só com a muralha e as torres**, decisão 14), chama `resolveBattle` com o fluxo `battle:<id>`, aplica o dano à muralha, as baixas ao exército, os feridos e as perdas de recursos se a batalha é perdida (a regra da v0.2 vale para o que passou), XP e ferimento aos comandantes, a Ameaça −35 como hoje, a moral; o relatório entra em `army.reports`; `raidRepelled`/`raidSuffered` levam a composição completa (GDD §8.2).
- [ ] V4E-T2.4 As roteirizadas: dia 3 (fraca), dia 4 (média), dia 6 (forte, na Hora da Vigília: o instante é calculado como o do cerco, V4G-T1 traz a conta; **até lá, o ensaio cai no início do 61º dia de jogo**, e a tarefa escreve isso); só no ano 1 e só para partidas que ainda não passaram do instante (o molde dos lobos).
- [ ] V4E-T2.5 Névoa: a composição não sai na visão além do que a Torre do nível revela; o aviso da Torre Nv2 continua dizendo o tamanho; os níveis 3 a 5, a composição por partes.
- [ ] V4E-T2.6 Propriedade: divisão de intervalo com incursão, batalha, reparo e virada no mesmo instante; QA-03 com a batalha na lista.
- [ ] V4E-T2.7 Simulador: o `militar` e, pela decisão 25, o `economico` mantêm uma Defesa ativa; `raids_repelled` e `raids_lost` por célula; faixas remedidas.

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

- [ ] V4E-T3.1 Estado 32 → 33: `horde.lastFormationSeen: { posts resumidos por arquétipo } | null`, `horde.omens: Array<{ atMs; clarity; wave; wing; enemy; count | null }>` com teto; `map.tiles` ganha `hordeFortress` (nasce **na virada que abre o outono**, soma +2 por dia como tile ativo; decisão 16) e `raiderCamp` (nasce no verão por descoberta ou data: decisão 16). Na migração: memória `null`, presságios vazios, e a partida já no outono recebe a Fortaleza na primeira virada depois da fronteira.
- [ ] V4E-T3.2 A composição de uma incursão e, na Fase G, de uma onda: `peso(tipo) = peso_base(estação) + astúcia × peso_de_contra(tipo, última formação)`, em frações, com o sorteio no fluxo `horde` quando a incursão é marcada; **teste determinístico**: a mesma memória e a mesma semente dão a mesma composição, e uma formação cheia de arqueiros aumenta o peso de lobos e cavalaria (critério 3).
- [ ] V4E-T3.3 Presságios: na virada de cada dia de outono e de inverno antes do cerco, `35% + 10% × (nível da Torre − 1)` no fluxo `horde`; a clareza pelo nível da Torre (Nv1 "muitas feras", Nv3 "cerca de 30 lobos na ala esquerda da segunda onda", Nv5 a composição exata de uma onda); o que o presságio diz é **verdade sobre a onda que será gerada** (decisão 18: as ondas do cerco são geradas na virada que abre o outono, com a memória daquele instante, e os presságios leem delas; a adaptação à última formação vale para o que ainda não foi lido? **Decisão 18 fixa**).
- [ ] V4E-T3.4 `ViewState`: `threat.tiles` com a Fortaleza e o Acampamento; `army.omens[]` como frases; `army.preview.knownEnemy` alimentado pelos presságios e pelo que o último relatório mostrou.
- [ ] V4E-T3.5 Simulador: a finta (formação-isca no ensaio, outra no cerco) como política do `militar`; coluna `omens`, `fortress_day`.

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
- [ ] V4E-T4.2 Painel da Ameaça com a muralha, o reparo em duas etapas, a Torre, os tiles; "Antes de partir" e Retorno.
- [ ] V4E-T4.3 Presságios na aba Exército e na prévia; o relatório de incursão.
- [ ] V4E-T4.4 Navegador: reparar, o presságio (`/__test/omen`), a incursão como batalha (`world.wolvesRoam()` com a formação ativa), a barra de status.

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

**Objetivo:** o motor consegue calcular o instante de jogo da primeira Hora da Vigília que cai ao menos 6 h depois do início do inverno (senão, 12 h depois), a partir de `settings.timezone`, `settings.vigilHourLocal` e um instante de origem em tempo real; mudar de fuso ou de hora não move um cerco já marcado.
**GDD:** §4.3, §2.1, §17.1 ("Hora da Vigília configurável").
**Depende de:** V4E-T2 (o ensaio do dia 6 passa a usar a mesma conta). **Da v0.3 usa:** `settings.timezone` e `settings.vigilHourLocal` (já no estado, sem uso), `games.vigil_hour` e `games.created_at` (na linha), `realToGameMs`.
**Decisões:** 12, 13.
**Trilha:** motor e servidor.
**Entregáveis:** `packages/engine/src/types.ts` (`settings.realOriginMs` e `settings.vigil: { hourLocal; utcOffsetMinutes }`, ou o que a decisão 13 fixar), **novo** `vigil.ts` (a conta pura: do instante de jogo ao instante real e à hora local, sem DST), `state.ts`, `migrations/v35.ts` e o passo em `v34.ts` (a origem real de uma partida migrada vem do servidor pelo contexto da migração: `context.realOriginMs`, lido de `games.created_at`), `migrations.ts` (`MigrationContext` ganha o campo); `packages/server/src/games/service.ts`, `repository.ts` (passa `created_at` e o offset calculado do fuso IANA com `Intl` **no servidor**), `catalog.ts`; `packages/protocol/src/api.ts` (`PATCH /games/:id/settings`? **não**: a mudança de Vigília continua pelas Preferências do app, que hoje só gravam `vigilHour` na linha; a tarefa decide com a decisão 13 se vira ordem `setVigilHour`); README do motor e do servidor; GDD §4.3.

- [ ] V4G-T1.1 Decidir a forma pela decisão 13 e escrever a conta: `realMs = realOriginMs + gameMs / timeScale`; hora local = `(realMs + offset) mod 24 h`; o primeiro instante de jogo ≥ `inícioDoInverno + 6 h de jogo` cuja hora local é a da Vigília, em inteiros; sem DST (documentado como limite).
- [ ] V4G-T1.2 Estado 34 → 35: `settings.realOriginMs` e `settings.vigil` (na migração, do contexto; o passo não cria prazo). A partida cujo fuso o servidor não resolve entra com offset 0 e a tela avisa.
- [ ] V4G-T1.3 O ensaio do dia 6 (V4E-T2.4) passa a cair na Hora da Vigília pela mesma conta; teste nos três ritmos e em três fusos.
- [ ] V4G-T1.4 Mudar a hora ou o fuso: vale para o que ainda não foi marcado; o cerco e o ensaio já marcados ficam.

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
**Entregáveis:** os do branch, revisados um a um (não juntar sem revisar); `packages/content/src/cards/*.ts` (**novos** `refugees.ts`, `kingsCollector.ts`, `mysteriousMerchant.ts`, `whiteWolf.ts`, `scripted.ts` com "O mercador itinerante", avulsas), `council.ts` (efeitos `addMaster`, `marketPrice`, `rollEffect`; requisitos `heroPresent`, `heroTrait`, `heroClass`), `council.test.ts`, `chronicle.ts`; `packages/engine/src/council.ts`, `councilTurn.ts`, `councilView.ts`, `marketTurn.ts` (os efeitos sobre o preço), `migrations/v37.ts` e o passo em `v36.ts` (`market.effects`); `docs/content-v0.4.md`, seção 4 (as fichas; **rascunho**); `sim-cli` (`SHOW_COVERAGE=1`: cobertura por posse); README do motor ("Uma carta nova": toda carta nova muda o sorteio de todas as sementes).

- [ ] V4H-T1.1 Ler o branch e decidir o que aproveita; registrar o que foi descartado.
- [ ] V4H-T1.2 Efeitos e requisitos novos, com teste de cada um e `council.effects.test.ts` verde.
- [ ] V4H-T1.3 As cartas, em lotes de cinco apresentados ao autor **antes** da transcrição (se ele responder "escrevo e sigo", vale como na v0.3 e fica registrado).
- [ ] V4H-T1.4 "O Cobrador do Rei" com o ramo de soldados e "O Lobo Branco" com presságio e cerco, **sem adaptação**, porque a v0.4 os tem.
- [ ] V4H-T1.5 Estado 36 → 37: `market.effects` (vazio). Goldens, retratos e `COUNCIL_SCENARIO_SEED` regravados de propósito (a receita do README).
- [ ] V4H-T1.6 Cobertura por posse (herói, Mestre, Mercado, exército) em 50 sementes.

**Verificação:** `pnpm --filter @lotg/content test`; `pnpm --filter @lotg/engine test -- council market migrations fixtures`; `SHOW_COVERAGE=1 pnpm --filter @lotg/sim-cli test -- coverage`.

**Impacto em partidas antigas:** estado **37**; as cartas novas entram no sorteio das audiências seguintes; nenhuma chega por migração.

**Pronto quando:** as 23 cartas existem com ficha, Gil e Ximena chegam por carta, e a cobertura mostra cada cadeia terminando em todos os ramos.

### V4H-T2 · O lote 3 do Conselho `L`

**Objetivo:** as 15 cartas que faltam para as 60: "A Filha do Ferreiro" (a quinta cadeia do GDD §7.1), cartas de guerra (soldados, ferro, formação, presságio, saqueadores, Fortaleza, Vigília, rescaldo), as quatro roteirizadas que faltam (o GDD §7.2 fala em seis), e cartas de herói para os traços sem uso em carta.
**GDD:** §7, Apêndice B.
**Depende de:** V4H-T1, Fase G. **Decisões:** 23.
**Trilha:** conteúdo.
**Entregáveis:** `packages/content/src/cards/**` (**novos** `smithsDaughter.ts`, `war.ts`, as roteirizadas), `council.test.ts`, `docs/content-v0.4.md`, seção 5; goldens e retratos regravados.

- [ ] V4H-T2.1 A lista proposta da §16.3, apresentada ao autor em lotes de cinco.
- [ ] V4H-T2.2 Cada traço novo e cada mecânica da v0.4 com ao menos uma opção que o use; nenhuma carta pede o que o feudo não pode ter.
- [ ] V4H-T2.3 Cobertura por estação e por posse; o inventário das 60.

**Verificação:** como V4H-T1.

**Pronto quando:** o catálogo tem 60 cartas, todas com ficha, e a cobertura em 50 sementes não deixa carta nenhuma sem sair.

### V4H-T3 · Objetivos 17 a 21 `S`

**Objetivo:** os cinco objetivos do GDD §12.2 `[v0.4]`: Salão Nv4 (desbloqueio: Quartel e Ferreiro); treinar 10 soldados (1 arma); salvar uma Formação de Defesa (presságio gratuito); simular uma batalha (+20 ouro); repelir uma incursão (XP ao comandante); os de 1 a 16 intocados.
**Depende de:** Fases C a E. **Decisões:** 24 (os sazonais).
**Trilha:** motor.
**Entregáveis:** `packages/content/src/objectives.ts`, `packages/engine/src/objectives.ts`, `objectivesView.ts`, **novo** `objectives.v04.test.ts`; `sim-cli` (a matriz remedida: F-1 mostrou que um objetivo muda o caminho de obras de todo bot).

- [ ] V4H-T3.1 Os cinco, com `targetKind` novo onde preciso; a partida migrada que já fez conta e paga uma vez.
- [ ] V4H-T3.2 **Medir antes de fechar** (lição de F-1): a matriz nas três dificuldades com os objetivos; o que piorar volta ao autor.

**Verificação:** `pnpm --filter @lotg/engine test -- objectives`; `pnpm --filter @lotg/sim-cli test`.

### V4H-T4 · Retorno e "Antes de partir" com a guerra `M`

**Objetivo:** o Relatório de Retorno conta a forja, o treino, as batalhas (com os fatores), o cerco, os presságios e a Crônica do Ano em três blocos; "Antes de partir" avisa do que a guerra pede (Defesa ativa, Plano, muralha, ferro).
**Depende de:** V4G-T4. **Trilha:** app.
**Entregáveis:** `packages/web/src/game/returnReport.ts`, `game/beforeLeaving.ts`, `notifications/policy.ts`, `tests/e2e/03-retorno-e-conexao.spec.ts`; README do app.

- [ ] V4H-T4.1 Os blocos com os eventos novos; a ordem de "Antes de partir" **escrita e testada** (F-6).
- [ ] V4H-T4.2 Navegador: reabrir depois de 4 h com cerco, batalha e forja na ausência.

### V4H-T5 · Revisão independente e editorial da Fase H `S`

Como V4B-T5, mais a revisão editorial carta a carta (como a dos 18 grafos na v0.3). **Entregáveis:** **novo** `docs/reviews/v0.4-fase-h.md`; correções `V4H: corrige …`; `docs/balance-v0.4.md`, seção 8; integração.

---

## 9. Fase I — Fechamento da v0.4

### V4I-T1 · Balanceamento com o simulador `M`

**Objetivo:** a matriz completa (os quatro perfis × três ritmos × três dificuldades × 50 sementes) com o cerco, as faixas da §15.2 do GDD fixadas **pela primeira vez como metas** (Preguiçoso 40 a 60% de Vitória; Regular 65 a 80% e 20 a 30% Gloriosa; Dedicado 90%+ e 50%+ Gloriosa; Regular em Rei de Ferro 35 a 50%), e as propostas ao autor onde a medida não cabe.
**GDD:** §15.2, §15.3, §16.2 (critério 6). **Depende de:** Fase H. **Decisões:** 25.
**Entregáveis:** `packages/sim-cli/src/bands.ts`, `balance.test.ts`, `matrix.ts`; `docs/balance-v0.4.md`, seção 9; `docs/pendencias-v0.4.md`.

- [ ] V4I-T1.1 A matriz inteira; a faixa do Regular **como meta**, não como medida com folga (é o critério 6); o que não cabe volta ao autor com propostas de número.
- [ ] V4I-T1.2 O ouro por fonte e por destino no fim da versão contra a linha de base de V4A-T1 (§13): o número que a v0.4 promete baixar.
- [ ] V4I-T1.3 `--perf` com cerco, `--remote` com 50 bots, tamanho do estado e da visão no pior caso.
- [ ] V4I-T1.4 Os extremos repetidos à mão (a semente de pior resultado por célula).

**Verificação:** as cinco matrizes; `pnpm -s sim -- --perf`; `pnpm --filter @lotg/sim-cli test`.

**Pronto quando:** o critério 6 é um teste que falha se o Regular sair de 65 a 80%, e o ouro parado está medido contra a linha de base.

### V4I-T2 · Critérios de aceitação da v0.4 `M`

**Entregáveis:** **novo** `docs/acceptance-v0.4.md` (os seis critérios e QA-19 a QA-34 com a prova automática de cada um e a evidência manual por preencher), **novo** `docs/manual-test-v0.4.md`. Firefox, Safari, celular e leitor de tela: ao menos uma rodada manual registrada, ou a ausência escrita.

### V4I-T3 · Playtest da v0.4 `M`

**Entregáveis:** `docs/playtest/convite-v0.4.md`, `formulario-v0.4.md`, `relatorio-v0.4.md`; as consultas de `deploy/analytics/ops.sql` com cerco, exército e ritmo. É do autor convidar; se não houver playtest, escrever que não houve (lição 8).

### V4I-T4 · Correções, documentação e release `S`

**Entregáveis:** `CHANGELOG.md` (0.4.0, com "O que muda nas partidas em andamento"), versão `0.4.0` nos oito pacotes e em `ENGINE_VERSION`, `docs/relatorio-v0.4.md`, `docs/architecture.md` reescrito, a página de apresentação sem a guerra no horizonte (e com as capturas refeitas: a aba Feudo e a árvore mudaram), `CLAUDE.md`, o portão inteiro no commit candidato, as três imagens construídas. A tag e a release são do autor; a publicação, a terceira da versão (decisão 26).

### V4I-T5 · Preparar a v0.5 `S`

**Entregáveis:** **novo** `docs/roadmap-v0.5.md` no mesmo formato: o mapa hexagonal sobre os tiles abstratos (`map.tiles`, `map.discovered`), postos avançados, Capela e relíquias (o Lendário), Legado e Votos (o fator de Votos na onda), anos seguintes (o fator do ano; a Horda que lembra), semente visível, Temporadas e ranking; as lições desta versão; a primeira tarefa detalhada.

---
## 10. Critérios de aceitação, cenários integrados e sinais de diversão

### 10.1 Critérios do GDD §16.2 por tarefa

| # | Critério | Tarefas que o entregam | Como provar |
|---|---|---|---|
| 1 | Uma formação salva defende offline | V4C-T2, V4E-T2, V4E-T4 | Cenário no motor com 30 dias fora e incursão no meio + integração + navegador com relógio controlado |
| 2 | A prévia e a batalha real usam o mesmo código (golden) | V4D-T1, V4D-T2 | Golden compartilhado: `previewBattle` com inimigo conhecido = `resolveBattle` |
| 3 | A Horda altera a composição em resposta à última formação (determinístico) | V4E-T3 | Mesma memória e semente → mesma composição; formação de arqueiros → mais lobos e cavalaria |
| 4 | O cerco ocorre na Hora da Vigília com 3 ondas e Plano de Batalha | V4G-T1, V4G-T2, V4G-T4 | Cenário nos três ritmos e três fusos + integração + navegador |
| 5 | A Crônica do Ano é gerada e exportável em Markdown | V4G-T3, V4G-T4 | Golden do Markdown + integração do endpoint + navegador (download) |
| 6 | O perfil Regular do `sim-cli` fica em 65–80% de Vitória | V4C-T1.8 (decisão 25), V4G-T2.10, V4I-T1 | `balance.test.ts` com a faixa como meta |

Entregas fora dos seis critérios e obrigatórias: ferro, Ferreiro, desgaste e reparo, Quartel, muralha com HP e reparo, Torre Nv3+, saqueadores e as roteirizadas, Fortaleza e presságios, sabotagem, Acampamento, milícia, rescaldo, os lotes 2 e 3, objetivos 17 a 21, Retorno. Estão na matriz abaixo.

### 10.2 Matriz de cenários integrados

Os QA-01 a QA-18 da v0.3 **não podem regredir**; em especial QA-01 e QA-02 (migração e avanço longo), QA-03 (a ordem no mesmo instante, agora com batalha, forja, treino e cerco), QA-14 (versões, com o protocolo 4), QA-17 e QA-18 (exclusão e névoa).

| ID | Cenário | Resultado a verificar | Tarefas |
|---|---|---|---|
| QA-19 | Carregar uma partida da v0.3 (estado 24) com expedição, encruzilhada, cativo, caravana, Mestre à porta, estoque no cap, incursão marcada e anunciada, no outono e no inverno | Migrada uma vez por passo até a versão atual; nada perdido nem pago de novo; ninguém ganha ferro, arma, soldado nem muralha; a Fortaleza e o cerco contam da fronteira; a incursão marcada resolve com a composição-base | toda tarefa que sobe a versão |
| QA-20 | Comprar ferro e vender no mesmo dia; forjar e dispensar; treinar e dispensar; comprar para forjar e revender | Nenhum ciclo dá lucro (propriedade e `especulador`) | V4B-T1, V4B-T2, V4C-T1 |
| QA-21 | Forja, reparo, treino e obra terminando no mesmo instante que uma virada, uma incursão e uma caravana | Ordem documentada (§0.7); nenhuma cobrança duplicada | V4B-T2, V4B-T3, V4C-T1, V4E-T2 |
| QA-22 | Soldados com as casas cheias, com fome aberta, com o piso de 3; dispensar durante o treino | Vaga e comida contadas; o piso protege; ninguém deserta por ser soldado | V4C-T1 |
| QA-23 | Comandante que parte em expedição, escolta, é dispensado, ferido ou capturado; duas abas salvando a mesma formação | `HERO_BUSY`; a formação perde o comandante; uma formação salva | V4C-T2 |
| QA-24 | Sete cenários de batalha com a conta à mão; dois esquadrões com a mesma iniciativa; muralha em 0; Ogro; mortos-vivos; 12 rodadas | Golden igual à conta; desempate fixo; inteiros | V4D-T1 |
| QA-25 | Prévia com inimigo conhecido; prévia com `?`; 200 simulações; `state.rng` antes e depois | Igual à batalha real; o gerador do estado intocado; < 50 ms | V4D-T2 |
| QA-26 | Lobos do dia 16 contra Paliçada Nv1, Nv2 e nenhuma; média contra formação ativa; forte sem formação | O desfecho da v0.2 preservado onde a Paliçada "segurava"; a formação repele; sem formação só a muralha luta | V4E-T2 |
| QA-27 | Reparo com prioridade durante obra; reparo durante batalha; dois `repairWall` | A obra ativa espera; o HP sobe no prazo; uma ordem | V4E-T1 |
| QA-28 | Formação-isca no ensaio e outra no cerco; a mesma memória e semente duas vezes | Composição determinística; a Horda responde à última | V4E-T3 |
| QA-29 | Presságio por nível da Torre; o que o presságio diz contra a onda gerada | Nunca mente; nada além da clareza do nível sai | V4E-T3 |
| QA-30 | Três sabotagens, a quarta, o Desastre, a Fortaleza que some com a equipe lá | Redução por onda; alerta; volta pela fronteira | V4F-T1 |
| QA-31 | Ataque ao Acampamento com incursão no meio; o tile que volta no ano | A defesa sem quem partiu; o tile volta | V4F-T2 |
| QA-32 | O cerco inteiro com o jogador fora 30 dias; a decisão entre ondas no instante da onda; em duas abas; nos três ritmos e três fusos; migração no inverno com a Vigília passada | O Plano vale; uma troca; o prazo real igual; a partida migrada recebe o cerco na primeira virada | V4G-T1, V4G-T2 |
| QA-33 | Milícia convocada duas vezes; a Queda com 3 aldeões; a Primavera da Reconstrução nas obras | Uma convocação; o piso protege; os custos ×4/5 por 2 dias | V4G-T2 |
| QA-34 | API nova com app e cache antigos (protocolo 3); recibo antigo; imagem anterior diante do estado novo | 426; cache descartado e cursor mantido; recibo intocado; 500 sem gravar | V4G-T2, V4I-T2 |

### 10.3 Matriz de balanceamento e sinais de diversão

**Matriz mínima:** os quatro perfis da rodada padrão (Preguiçoso, Regular, Dedicado, Explorador) mais `militar`, `ousado` e `especulador` a pedido × três ritmos × três dificuldades × 50 sementes, nas duas janelas. Rodar inteira no fechamento (V4I-T1); as rodadas das fases não a substituem.

| Sinal | Como medir | Como usar |
|---|---|---|
| Vitória no cerco | Resultado por perfil, ritmo e dificuldade | As faixas da §15.2 do GDD, como **metas** (critério 6) |
| Ouro com destino | Ouro por fonte e por destino contra a linha de base de V4A-T1 | O ouro parado tem de cair; o ferro, o treino e o reparo são os sumidouros novos (§13) |
| Exército sustentável | Horas de comida negativa por soldados; soldados dispensados por fome | No Preguiçoso, zero fome causada só por exército |
| Formação viva | Formações salvas; trocas depois de um relatório; a finta medida | Se ninguém troca, o relatório não ensina |
| Horda legível | Vitória com e sem presságios; com e sem Torre Nv3 | O presságio tem de valer uma obra |
| Sabotagem como escolha | Sabotagens por ano; capturas; vitória com 0, 1, 2 e 3 | Nem obrigatória nem inútil |
| Muralha útil | HP rompido por onda; reparos; vitória por nível de muralha | Cada nível vendido muda algo que o jogador vê |
| Cerco com o jogador fora | Vitória do perfil de uma visita por dia | "Estar presente é vantagem, não exigência" |
| O que valeu (humano) | A pessoa diz o que preparou na semana e se valeu | É a promessa da versão |
| A finta (humano) | A pessoa descobriu sozinha que a Horda responde à última formação? | Mede se o relatório é lido |
| Peso da interface (humano) | Cliques para montar e ativar uma formação; duração da sessão do cerco | Sem microgerenciamento |

**Perguntas no playtest da v0.4:** O que você preparou para o cerco e o que faltou? Você leu o relatório de uma batalha? O que ele dizia? Mudou a formação depois? Sabotou? Por quê? O cerco caiu em uma hora boa? Você estava lá?

### 10.4 Definição de pronto da versão

- [ ] Os seis critérios têm prova automática e evidência manual, por critério, com data e navegador.
- [ ] Ferro, Ferreiro, desgaste, Quartel, formações, batalha, prévia, muralha, incursões, Horda, presságios, sabotagem, Acampamento, cerco, milícia, rescaldo, Crônica do Ano, cartas e objetivos têm os cenários integrados cobertos (§10.2).
- [ ] ADRs 0019 e 0020 aprovados, ou "aplicados por delegação" com as pendências escritas.
- [ ] Um feudo novo e um migrado da v0.3 completam um ano com cerco e a virada seguinte sem travas.
- [ ] As 60 cartas existem com ficha; o que o autor não leu está inventariado.
- [ ] Matriz rodada; as faixas da §15.2 como metas; extremos analisados; playtest registrado, ou a ausência escrita; zero P0 e P1.
- [ ] Nada de mapa gráfico, posto avançado, Capela, relíquia, Legado, Voto, Temporada ou Academia entrou, nem como campo vazio.
- [ ] Migração, backup, restauração e reversão com procedimento e, desta vez, **ensaio feito** (ato 23).
- [ ] Documentação, capturas e página de apresentação correspondem ao produto; CI verde no commit candidato; publicação autorizada.

---

## 11. Decisões que esperam o autor, com premissas recomendadas

**Nada aqui foi decidido.** Cada linha é uma pergunta com opções; a "premissa recomendada" é o que valeria se o autor dissesse "pode ser", e é proposta do agente que revisou este plano contra o código da v0.3 publicada, sem código da v0.4 (que não existe). A coluna "Registro" fica vazia até a sessão.

Como ler: "Trava" diz que tarefa não começa sem a resposta; "Por quê, alternativa e o que validar" diz de onde a recomendação vem, o que foi descartado e que medição a confirma ou derruba.

### 11.1 Lote 1: herança, ferro, exército, formações e combate (V4A-T2 → ADR 0019)

| # | Decisão | Trava | Premissa recomendada | Por quê, alternativa e o que validar | Registro |
|---|---|---|---|---|---|
| 1 | **O lote 2 do Conselho**: v0.3.1 antes da Fase B, ou Fase H da v0.4? | V4H-T1; a Fase B se for v0.3.1 | **Fase H da v0.4**, em trilha de conteúdo que pode começar depois da Fase B; "O Cobrador do Rei" e "O Lobo Branco" entram sem adaptação, porque a v0.4 tem soldados, presságio e cerco; Gil e Ximena esperam | O branch não é verde e nunca foi testado; uma v0.3.1 publicaria o estado 25 (`market.effects`) para a v0.4 empilhar por cima, e exigiria do autor a leitura de 23 cartas antes de a v0.4 começar. Alternativa: v0.3.1 em duas semanas, com as cartas adaptadas como estão. Validar: quantas audiências um feudo perde sem as cartas (cobertura por estação com 22 cartas) || [ADR 0019](decisions/0019-ferro-exercito-formacoes-e-combate-na-v0.4.md), 2026-10-16: a premissa recomendada |
| 2 | **O ouro sem destino** (§13): a v0.4 cria regra nova para ele, ou mede os sumidouros que já traz? | V4B-T1, V4C-T4 | **Medir**: o ferro a 8 de ouro, o treino, o reparo e a Muralha são os destinos novos; a medida de V4C-T4.3 volta ao autor com propostas de número antes da Fase D. Nenhuma regra de ouro nova antes disso | É a resposta dele de 2026-10-06 ("medir após a Fase E e então decidir") levada à frente; a v0.3 provou que soldo pequeno não mexe no ouro (0,45%). Alternativas já ouvidas: soldo de soldado; preço do ferro mais alto; experiência mais rápida. Validar: a soma do ouro final das 1.200 partidas de Senhor contra 46,2 milhões || [ADR 0019](decisions/0019-ferro-exercito-formacoes-e-combate-na-v0.4.md), 2026-10-16: a premissa recomendada |
| 3 | **O ferro**: no Mercado a 8,0 com volume `200 × nível` e sem caravana; na Mina Abandonada (40 a 80); o Armazém o guarda com o mesmo cap; ferro inicial 0 | V4B-T1 | Sim a tudo; a Mina Abandonada pede Guilda Nv2 e é revelada pela Floresta Antiga ou pela Patrulha; **sem caravana de ferro** | O GDD dá o preço e não o volume; a caravana a +15% com ferro a 8 seria 1,2 de ouro por unidade de lucro sobre o balcão, o maior da tabela. Alternativas: ferro só por expedição (o Mercado não vira fonte sem limite, mas o jogador de uma visita nunca forja); caravana de ferro. Validar: o ferro comprado por perfil e a parcela do volume usada || [ADR 0019](decisions/0019-ferro-exercito-formacoes-e-combate-na-v0.4.md), 2026-10-16: a premissa recomendada |
| 4 | **Armas e a forja**: recurso sem cap; um lote por vez, até `batchMax` (10); 2 ferro + 1 madeira por arma em 6 min de jogo; "+10% por nível" como tempo × 10/(10 + nível − 1); cobrança ao começar; cancelar devolve 80% | V4B-T2 | Como escrito | É o GDD §5.1 e §6.1 lidos com o molde das obras; a fila única mantém o estado com teto. Alternativas: várias filas; "+10%" como armas a mais por lote. Validar: armas por semana no Regular contra as unidades que ele treina || [ADR 0019](decisions/0019-ferro-exercito-formacoes-e-combate-na-v0.4.md), 2026-10-16: a premissa recomendada |
| 5 | **Desgaste e reparo**: entra na v0.4? | V4B-T3 | **Entra, mínimo**: um ponto por expedição e por batalha comandada; durabilidade por raridade; item em 0 sem bônus; reparo no Ferreiro, na mesma fila da forja, por ferro e tempo | O GDD põe o reparo no Ferreiro e o `CLAUDE.md` já o reserva para a v0.4; sem desgaste o ferro só serve à arma. Alternativa: não entra (o Ferreiro só forja), e sai do GDD. Validar: itens em 0 por ano no Explorador || [ADR 0019](decisions/0019-ferro-exercito-formacoes-e-combate-na-v0.4.md), 2026-10-16: a premissa recomendada |
| 6 | **Guilda Nv5 e o Lendário** | V4B-T3, V4F-T1 | **Não entram**: a Guilda fica no Nv4 (o Nv5 daria as mesmas 3 expedições: `1 + 5/2 = 3`) e o Lendário fica com as relíquias (v0.5) | ADR 0018, decisões 12 e 15; nada na v0.4 pede o quinto nível. Alternativa: o Senhor da Guerra deixa um item Lendário. Validar: nada || [ADR 0019](decisions/0019-ferro-exercito-formacoes-e-combate-na-v0.4.md), 2026-10-16: a premissa recomendada |
| 7 | **Soldados e população**: saem da população ao fim do treino (um aldeão sem ofício; senão, do edifício com mais gente), comem 1,5/h, não trabalham, não desertam por fome nem por moral, não contam no piso de 3 aldeões; limite `10 × nível`; dispensar devolve o aldeão sem ofício e sem o custo | V4C-T1 | Como escrito | GDD §5.2 e §17.1 com o molde dos feridos e do Mestre (`inhabitants`). Alternativas: o soldado vem de fora (não sai da população); desertam por fome como aldeões. Validar: a comida do Regular com 20 soldados no inverno; o piso || [ADR 0019](decisions/0019-ferro-exercito-formacoes-e-combate-na-v0.4.md), 2026-10-16: a premissa recomendada |
| 8 | **Herói comandante e expedição**: o herói nomeado na formação **ativa** não parte (expedição, caravana, sabotagem); nas outras formações, pode | V4C-T2, V4F | Como escrito | Evita herói em dois lugares e dá peso à escolha (GDD §8.3). Alternativa: o herói comanda só no instante da batalha, de onde estiver. Validar: horas de herói ocioso no Explorador com uma formação ativa || [ADR 0019](decisions/0019-ferro-exercito-formacoes-e-combate-na-v0.4.md), 2026-10-16: a premissa recomendada |
| 9 | **Formações**: até 5 salvas; 6 postos; máximo 20 por posto (30 com Quartel Nv5+); uma Defesa ativa; a formação pode pedir mais do que há (a prévia avisa) | V4C-T2 | Como escrito | GDD §10.1 e §10.8; o teto limita o estado. Alternativas: sem teto; formação só com o que existe. Validar: formações salvas por perfil || [ADR 0019](decisions/0019-ferro-exercito-formacoes-e-combate-na-v0.4.md), 2026-10-16: a premissa recomendada |
| 10 | **A prévia**: ordem `simulateBattle` que grava o resultado (uma por vez) e conta para o objetivo, com 200 sementes derivadas por `hash` da semente, da formação e do que se sabe, **nunca `state.rng`**; `purity.test.ts` ganha a exceção explícita | V4D-T2 | Como escrito | Uma leitura (`GET`) não contaria para o objetivo "Simule uma batalha" e teria de viver no servidor; um comando que sorteia no fluxo do estado quebra a regra "só `advanceTo` sorteia". Alternativa: endpoint de leitura e o objetivo cumprido por "salvar uma formação depois de ler a prévia". Validar: custo das 200 batalhas (< 50 ms) || [ADR 0019](decisions/0019-ferro-exercito-formacoes-e-combate-na-v0.4.md), 2026-10-16: a premissa recomendada |
| 11 | **A batalha em inteiros**: sorte 90 a 110 por esquadrão por rodada; frações para ×0,5, ×1,5, ×1,25, ×0,7, ×1,2, ×2; um arredondamento para baixo por conta; desempate pelo defensor, depois ala (esquerda, centro, direita), depois linha; a batalha é instantânea na linha do tempo | V4D-T1 | Como escrito | GDD §14.3 e ADR 0013 (13a); "desempate pelo lado defensor" não diz o resto. Alternativa: sorte por rodada para todos. Validar: os sete goldens || [ADR 0019](decisions/0019-ferro-exercito-formacoes-e-combate-na-v0.4.md), 2026-10-16: a premissa recomendada |
| 12 | **Relógios da v0.4**: tudo em tempo de jogo (treino, forja, reparo, viagem, sabotagem, presságios, Fortaleza), **com duas exceções em tempo real**: a Hora da Vigília (hora local) e o intervalo entre as ondas do cerco (60 min reais, a janela de trocar a formação) | V4E-T2, V4G-T1, V4G-T2 | Como escrito | O critério da v0.3 (lição 10): é real o que depende de uma pessoa responder. Em tempo de jogo, no Rápido as ondas viriam a cada 20 min reais e ninguém trocaria nada. Alternativa: tudo em tempo de jogo. Validar: a parcela de trocas entre ondas no perfil de duas visitas || [ADR 0019](decisions/0019-ferro-exercito-formacoes-e-combate-na-v0.4.md), 2026-10-16: a premissa recomendada |
| 13 | **A Hora da Vigília**: o estado ganha `settings.realOriginMs` (de `games.created_at`, pelo contexto da migração) e `settings.vigil.utcOffsetMinutes` (do fuso IANA, calculado no servidor); o motor calcula a Vigília sem horário de verão; mudar a hora ou o fuso só vale para o que ainda não foi marcado | V4G-T1, V4E-T2.4 | Como escrito | `settings.timezone` e `vigilHourLocal` já estão no estado e ninguém os usa; o motor não pode ler o relógio nem a base de fusos. Alternativa: o servidor marca o cerco por uma ordem interna quando o outono abre (mais simples no motor, mas põe regra de jogo no servidor). Validar: três fusos nos testes; o limite do horário de verão escrito || [ADR 0019](decisions/0019-ferro-exercito-formacoes-e-combate-na-v0.4.md), 2026-10-16: a premissa recomendada |
| 14 | **Incursão sem exército**: toda incursão vira batalha; sem Defesa ativa, só a muralha e as torres lutam; o que passa aplica a regra da v0.2 (10%/15% e feridos) **na proporção do que passou**; a Paliçada Nv1 e Nv2 continuam segurando, por HP, o que seguravam | V4E-T2 | Como escrito | Quem joga hoje não tem exército e não pode piorar na fronteira (golden dos lobos do dia 16 igual ao de hoje). Alternativa: sem formação, a regra da v0.2 inteira, sem batalha. Validar: o Preguiçoso perde mais do que hoje? || [ADR 0019](decisions/0019-ferro-exercito-formacoes-e-combate-na-v0.4.md), 2026-10-16: a premissa recomendada |
| 25 | **O que o Regular faz na guerra** (processo que decide o critério 6): as políticas mínimas (Quartel, Lanceiros e Arqueiros com o que sobra, uma formação ativa, o Plano = a Defesa ativa) entram no `economico`, que os perfis Preguiçoso, Regular e Dedicado usam; o `militar` faz a finta, a sabotagem e a milícia e é o Dedicado da guerra | V4C-T1.8, V4I-T1 | Como escrito | Sem isso, o Regular perde todo cerco e a faixa de 65 a 80% não mede nada. Alternativa: um perfil novo "Regular de guerra". Validar: a faixa || [ADR 0019](decisions/0019-ferro-exercito-formacoes-e-combate-na-v0.4.md), 2026-10-16: a premissa recomendada |
| 26 | **Publicação da v0.4**: três publicações, pelo autor, com backup antes: fim da Fase E (a formação defende), fim da Fase G (o cerco; protocolo 4) e o fechamento; entre elas, versões empilhadas no `main` local | V4E-T5, V4G-T5, V4I-T4 | Como escrito | A Fase B sozinha dá ferro sem uso e a C, soldados que comem sem defender; a E é o primeiro ponto em que a semana de quem joga melhora. Alternativa: tudo no fechamento (três meses sem publicar); ou cada fase. Validar: o ato 23 feito antes da primeira || [ADR 0019](decisions/0019-ferro-exercito-formacoes-e-combate-na-v0.4.md), 2026-10-16: a premissa recomendada |

### 11.2 Lote 2: Horda, presságios, sabotagem, Cerco, Crônica e cartas (V4E-T0 → ADR 0020)

| # | Decisão | Trava | Premissa recomendada | Por quê, alternativa e o que validar | Registro |
|---|---|---|---|---|---|
| 15 | **A Horda aprende**: guarda só a **última** formação vista (incursão ou onda); `peso = base(estação) + astúcia × contra(tipo, última)`, com astúcia por dificuldade (3/10, 1/2, 4/5) em `difficulties[]`; sem memória entre anos | V4E-T3 | Como escrito | GDD §10.6; a memória do ano anterior é v0.5 (§11.5). Alternativa: média das últimas três. Validar: o teste determinístico e a finta medida | |
| 16 | **Tiles e datas**: a Fortaleza nasce na virada que abre o outono, soma +2 por dia, some com o fim do cerco e volta no outono seguinte; o Acampamento nasce no 25º dia de jogo (o "dia 3" do Normal), soma +2, é limpo pelo ataque e volta na virada do ano como o Covil; a Torre Nv3 a Nv5 avisa com 3, 4 e 5 h reais e revela a composição por partes | V4E-T1, V4E-T3, V4F-T2 | Como escrito | A Ameaça precisa de fonte no ano 2 (ADR 0018, decisão 14); o GDD dá a data da Fortaleza e não a do Acampamento ("dia 3", §2.2). Alternativas: Acampamento por descoberta; Fortaleza que não volta. Validar: a Ameaça média por estação com os três tiles | |
| 17 | **Sabotagem**: só no outono com a Fortaleza de pé; exatamente 3 heróis por 6 h de jogo; até 3 por ano; cada nó com Sucesso −15% em uma onda; o Xamã revela a onda 3; o Desastre captura (pela dificuldade) e alerta (+10% na onda 1); a dificuldade sobe por tentativa | V4F-T1 | Como escrito | GDD §9.5 e §8.3. Alternativa: uma por estação, sem reforço. Validar: vitória com 0 a 3 sabotagens no Regular | |
| 18 | **Presságios e as ondas**: as três ondas são **geradas na virada que abre o outono**, com a memória da Horda daquele instante, e regeradas a cada formação nova vista até o inverno (a última vista vale); os presságios leem da versão atual e por isso nunca mentem sobre ela; chance `35% + 10% × (Torre − 1)` por virada de outono e de inverno, no fluxo `horde`; clareza por nível 1, 3 e 5 | V4E-T3, V4G-T2 | Como escrito | Sem gerar cedo, o presságio não tem o que ler; sem regerar, a finta do dia 6 não funciona. Alternativa: ondas fixas no outono e a adaptação só pela astúcia da incursão. Validar: um presságio que fica falso depois da finta volta ao autor | |
| 19 | **O Cerco e a Queda**: ondas 40/60/80 + o Senhor da Guerra; dificuldade 7/10, 1, 13/10; Queda = 30% dos recursos, 20% da população (aldeões, sem Mestres nem heróis), muralha a 0, os dois edifícios de nível mais alto −2 (o Salão incluído), sem sorteio; Vitória Gloriosa sem ala rompida em onda nenhuma; derrotar o Senhor da Guerra encerra a onda 3 e dá o Feito; Primavera da Reconstrução ×4/5 por 2 dias de jogo | V4G-T2 | Como escrito | GDD §11.2 e §11.4; "dana 2 edifícios" não diz quais. Alternativas: edifícios sorteados; a Queda sem perda de população em Camponês. Validar: a faixa de vitória e o que a Queda custa no ano 2 do Regular | |
| 20 | **Plano de Batalha e presença**: uma formação por onda, salva antes; entre ondas, decisão pendente com prazo de 60 min reais para trocar a formação e pedir reparo de emergência (pedra, na hora); sem resposta, o Plano vale; **sem** "reparo automático se pedra ≥ X" (GDD §17.2 deixa em aberto) | V4G-T2 | Como escrito | GDD §10.8 e §11.2. Alternativa: o reparo automático pré-agendado no Plano. Validar: trocas entre ondas por perfil | |
| 21 | **Milícia**: ordem só com incursão forte ou cerco marcado dentro da antecedência da Torre (ou a qualquer hora do dia do cerco?); até 50% dos aldeões; 3/2/12, ×5/4; não produzem; dissolve ao fim da batalha; as baixas reduzem a população com o piso de 3 | V4G-T2 | Como escrito | GDD §11.3. Alternativa: convocar a qualquer hora, com o custo de produção. Validar: a milícia muda o resultado da onda 3 no Regular? | |
| 22 | **Rescaldo e Crônica do Ano**: luto −10 por 1 dia com mortos; festa +15 com Gloriosa; reparo com desconto até o fim do inverno; a Crônica do Ano montada **pelo servidor** dos eventos do ano e de um evento `yearEnded` com estatísticas, pontuação (pesos inteiros no conteúdo) e os seis Feitos do cerco, sem lista no estado; **"Avançar para o Degelo" não entra** | V4G-T3 | Como escrito | O servidor é o relógio e a semana tem 7 dias para todos; um Feito "completo" é v0.6. Alternativa: o Degelo como ordem que encerra o inverno do feudo. Validar: a Crônica de um ano com Queda é legível | |
| 23 | **Os lotes 2 e 3**: 38 cartas (23 + 15), com "A Filha do Ferreiro", cartas de guerra e quatro roteirizadas; apresentadas em lotes de cinco antes da transcrição; o teste de palavras proibidas afrouxado carta a carta | V4H-T1, V4H-T2 | Como escrito | O GDD §7.2 fala em 60 com 6 roteirizadas. Alternativa: "escrevo e sigo" como na v0.3 (tudo rascunho). Validar: a cobertura por posse e por estação | |
| 24 | **Objetivos 17 a 21** (os do GDD §12.2 `[v0.4]`) e os sazonais ("Estoque 1.000 comida", "Sabote a Horda uma vez"): os cinco entram; os sazonais **não** (seriam os primeiros objetivos que se repetem por ano) | V4H-T3 | Como escrito | F-1 mostrou que um objetivo muda o caminho de todo bot: medir antes de fechar. Alternativa: dois sazonais do outono. Validar: a matriz com os objetivos | |

### 11.3 Atos do autor, que não são decisões de regra

| # | O que é | Trava | Recomendação | Estado em 2026-10-15 |
|---|---|---|---|---|
| 27 | **A v0.3 publicada**: conferir no banco `schema_version = 24` em toda partida ativa e o log do job; criar a tag `v0.3.0` e a release; corrigir a data da 0.3.0 no `CHANGELOG.md` | V4A-T1.1 | Antes da Fase B | pendente |
| 28 | **Operação (o ato 23 da v0.3):** backup fora do servidor; cópia do `RECOVERY_CODE_SECRET` fora do Coolify; ensaio de reversão com duas imagens atravessando uma migração de estado, em banco descartável | A primeira publicação da v0.4 (decisão 26) | Antes do fim da Fase E; a v0.4 não deveria subir doze versões de estado de novo sem o ensaio | pendente desde a v0.2 |
| 29 | **Jogar a v0.3** (roteiros) e preencher `acceptance-v0.3.md`; ler o conteúdo (`content-v0.3.md`); responder a F-1, F-4, E-51, E-54 e B-2 | V4A-T1.9, V4A-T2.1 | Antes da Fase B | pendente |
| 30 | **Playtest** (o da v0.1, o da v0.2, o da v0.3 e o desta) | V4I-T3 | Convidar depois da segunda publicação | nunca houve |
| 31 | Os oito pontos do ADR 0012 e o vínculo GitHub | Nenhuma | Continuam como estão | pendente |

---

## 12. Dívidas conhecidas, herdadas da v0.3

Lidas em 2026-10-15 no Registro da v0.3 (§12), em `pendencias-v0.3.md` (seções 5 e 6), em `retomada-v0.3.md`, em `architecture.md` (§21) e no código em `561b0ff`. V4A-T1.10 passa linha a linha: resolvida, continua ou nova.

### 12.1 Código

| Onde | O que é | Bloqueia a v0.4? |
|---|---|---|
| `wip/v3f-t1-lote2` (`2352e39`) | O lote 2 pela metade: efeitos e requisitos em `council.ts`, `councilTurn.ts`, `councilView.ts`, `council.effects.test.ts` e três arquivos de cartas; **não verde, nunca testado** | Decisão 1; V4H-T1 |
| `packages/content/src/masters.ts` | Gil e Ximena existem e não têm de onde vir (`deliverMaster` existe; nenhuma carta a chama; `addMaster` não existe) | V4H-T1 |
| `packages/engine/src/types.ts` (`market`) | `market.effects` não existe; nenhuma carta mexe no preço | V4H-T1 |
| `packages/content/src/council.test.ts` (linha 345) e `expeditions.test.ts` (683) | Expressões regulares barram ferro, ferreiro, exército, combate, batalha, soldado, presságio, relíquia, quartel, muralha, horda, cerco, arma, planta, unidade, mestre e mercado nos textos | Afrouxar de propósito por tarefa (B1, H1, H2) |
| `packages/content/src/ids.ts` | `ENEMY_IDS = ['wolves']`, `RAID_SIZE_IDS = ['light', 'medium']`, `RESOURCE_IDS` sem ferro, um tipo de tile | B1, E2, E3 |
| `packages/content/src/buildings.ts` | Torre e Paliçada em `maxLevel: 2` com a recusa que promete versão futura | E1 |
| `packages/engine/src/types.ts` (`GameSettings`) | `timezone` e `vigilHourLocal` no estado sem uso; não há origem em tempo real | G1; decisão 13 |
| `packages/protocol/src/view.ts` | `PendingDecisionSchema` fechado em `card` e `crossroads` | G2 (protocolo 4) |
| `packages/engine/src/objectives.ts` | F-5: o contador `expeditionsReturned:<modelo>` não é preenchido por passo (a partida migrada não conta as Ruínas) | Não alcança ninguém hoje; se um passo da v0.4 reconstituir contadores, resolver junto |
| `packages/web/src/notifications/policy.ts` | F-4: alarmes passam do teto de 3 por hora desde a correção da Fase E | Resposta do autor (V4A-T2.1) |
| `packages/web/src/game/beforeLeaving.ts` | F-6: a ordem dos itens não é a do roadmap da v0.3 | V4H-T4 escreve e testa a ordem |
| `packages/content/src/balance.ts` | E-54: a tabela do soldo por nível proposta pelo agente; E-51: as marcas de 85% e 115% | Leitura do autor |
| `packages/engine/src/masterTurn.ts` | E-53: quem já teve edifício paga a adaptação ao voltar a trabalhar (leitura do agente) | Leitura do autor |
| `packages/content/src/objectives.ts` | F-1: o objetivo 12 manda erguer a Guilda a todo bot; o Preguiçoso do Tranquilo perde o Salão Nv4 na semana | Resposta do autor |
| `packages/engine/src/seasonView.test.ts` (`it.fails`) | C-8 da v0.2: as previsões de lenha e comida erram quando as duas acabam no mesmo inverno | Não; pesa em "Antes de partir" com o cerco |
| `packages/sim-cli` | V3G-T1 não rodou `--perf` nem a carga; a hora do primeiro herói contra a meta não foi medida; `economy.property.test.ts` estoura 30 s com a máquina ocupada | V4A-T1.7 e T1.8 |
| `.hermes.md` na raiz, árvores `worktree-agent-*`, branch `e2e-fixes`, banco `lotg_test_e2e` | Sobras da v0.3 | V4A-T1.1 lista; remover é ato de limpeza |
| `CLAUDE.md` | Descreve a v0.3 "em execução" e a publicação por fazer | V4A-T1.12 lista; a integração da Fase B corrige |

### 12.2 Operação

| O que é | Bloqueia a v0.4? |
|---|---|
| **Há pessoas jogando a v0.3.0** (estado 24) desde 2026-10-15; 4 partidas migradas pelo job; ninguém conferiu as outras | Ato 27 |
| O ato 23 por fazer; a primeira migração de doze passos foi feita sem ele | Ato 28 antes da primeira publicação |
| A tag `v0.3.0` e a release não existem; o `CHANGELOG.md` data a 0.3.0 de 2026-10-07 | Ato 27 |
| Backups no mesmo disco; sem canal do Coolify; e-mail do GitHub não conferido; `ops.sql` sem consultas de heróis, expedições, exército | V4I-T3 |
| `RATE_LIMIT_PER_MINUTE` em 600 desde 2026-10-06 | Não |
| A pendência B-2 da v0.2 (sessões na restauração) nunca foi levada ao autor | V4A-T2.1 |

### 12.3 Verificação

| O que não foi verificado | Bloqueia a v0.4? |
|---|---|
| **Ninguém jogou a v0.3** (nem o autor, nem playtest); todo o conteúdo narrativo é rascunho | Lição 8: V4A-T1.9 |
| Só Chromium; Firefox, Safari, celular e leitor de tela nunca | V4I-T2 |
| A matriz de fechamento da v0.3 foi a da retomada (67 de 72 células remedidas pelos objetivos); `--perf` e 50 bots não rodaram | V4A-T1 |
| O ensaio de reversão nunca foi feito; a migração 12 → 24 é a única evidência real, e foi conferida só pelo job do arranque | Ato 28 |
| As decisões 1 e 4 a 21 da v0.3 aprovadas em bloco; os números do ADR 0017 e a tabela do soldo não lidos | Herança nas pendências |

---

## 13. O ouro sem destino

**O problema, com número** ([balance-v0.3.md](balance-v0.3.md), seção 14.4, Senhor): a Mina é de **79% a 99,4%** do ouro que entra; o balcão e as caravanas somados passam de 5% só no Dedicado do Normal (10%) e do ano do Tranquilo (21%); o saque nunca chega a 1%. **O destino são as obras**: de 72% a 93% do que sai; o soldo é de 1,6% a 20%; **ninguém compra no balcão** (zero em todas as células). O Regular da semana do Rápido tira 201.039 da Mina e termina com 185.659 parados; o Explorador, 258.908 e 235.655. O soldo por nível (2 a 20) baixou a soma do ouro final de Senhor em 0,45% (46,36 → 46,16 milhões em 1.200 partidas); os objetivos 11 a 16, −2,5% a +0,5%.

**O que a v0.4 traz que gasta ouro:** o ferro no Mercado a 8 de ouro (o primeiro recurso que o jogador compra por necessidade); o treino (10 a 60 de ouro por soldado, mais comida); o Quartel e o Ferreiro (100 e 150 de ouro); a Muralha (pedra, não ouro); o reparo (ferro); a milícia (braços). O que falta saber é se eles **absorvem** o ouro parado de quem joga duas vezes por dia no Rápido (185 mil) ou só criam outro buraco pequeno, como o soldo.

**Medida antes de regra** (decisão 2): V4A-T1.7 fixa a linha de base com `goldTable`; V4B-T5.3 mede o ferro comprado; **V4C-T4.3 mede com o treino e volta ao autor com propostas concretas** (preço do ferro, custo do treino, um custo contínuo de exército, outra coisa) antes da Fase D; V4I-T1.2 fecha a conta. Nenhum número de ouro muda sem a resposta dele. Alternativas já ouvidas e não aplicadas: soldo de soldado (o GDD não o tem); experiência mais rápida; o soldo dos níveis 1 e 2 mais alto.

---

## 14. O que a v0.3 ensinou

Tiradas do Registro (§12 do roadmap da v0.3), de [pendencias-v0.3.md](pendencias-v0.3.md), do [relatório](relatorio-v0.3.md) e da [retomada](retomada-v0.3.md). Cada uma diz o que muda na v0.4.

| # | Lição | Evidência | O que muda na v0.4 |
|---|---|---|---|
| 1 | **A revisão independente achou defeito real em toda fase depois do portão verde** | B: 0 defeitos e 7 riscos; C: 2 + 3; D: 2 + 8 + 9 (52 commits); E: cerca de 25; F: 9 achados, 6 corrigidos. Os relatórios das Fases C e E não foram gravados e o fechamento não pôde conferir as contagens | Uma revisão por fase, em tarefa própria, **com o relatório em `docs/reviews/`**; o cerco tem revisão antes da tela |
| 2 | **Uma conversão sem teto vira lucro certo** | A caravana pagava 1,19 do preço de compra; corrigido para +15% sobre o balcão com propriedade e teste de conteúdo | Toda conversão (ouro ↔ ferro, ferro → arma, arma → soldado, soldado → aldeão) entra com propriedade de nenhum ciclo lucrativo e com o `especulador` tentando (§0.5) |
| 3 | **Bots que não medem** | 0% de encruzilhadas decididas com 6 h; ninguém capturado; ninguém comprando no balcão; os bots Regular e Dedicado erguem a Guilda e não enviam | Cada mecânica ganha o bot **antes** da faixa; o Regular tem políticas de guerra (decisão 25) ou o critério 6 não mede nada |
| 4 | **Decisões fechadas antes do código** | 21 decisões em uma sessão antes da Fase B; as mudanças depois (12 h, +15%, soldo por nível, piso de 3, primeira alocação) vieram de números medidos | Dois lotes (§11); as perguntas que dependem de medida (ouro, tamanho das ondas) vão ao autor com a medida na mão |
| 5 | **Árvores separadas para paralelizar** | Fases E e F em árvores separadas, juntadas por commits de mesclagem | Continua; os arquivos de cada trilha ficam listados na tarefa; os documentos compartilhados são do integrador |
| 6 | **Subagentes no Sonnet para execução** | Pedido do autor de 2026-10-06 | Mantido; revisão independente e decisão de regra, não |
| 7 | **A primeira publicação salta vários estados** | A produção foi do 12 ao 24 e do protocolo 2 ao 3 em um `push`; o ensaio de reversão nunca foi feito; deu certo nas 4 partidas que o job migrou | A v0.4 publica em três pontos (decisão 26) e **pede o ensaio antes do primeiro** (ato 28) |
| 8 | **Ninguém jogou** | Nenhuma fase foi jogada pelo autor; nenhum playtest em três versões; todo o conteúdo é rascunho | A v0.4 não começa o motor do cerco sem uma sessão de jogo da v0.3 (V4A-T1.9); as paradas "mostrar ao autor" continuam e são registradas quando não acontecem |
| 9 | **O ouro parado não caiu** | 0,45% com o soldo por nível; a Mina rende de 10 a 400 vezes o soldo | §13 |
| 10 | **Tempo real é só para o que depende de uma pessoa** | A encruzilhada foi de 6 h para 12 h reais depois da medida | Decisão 12: a Vigília e o intervalo entre ondas |
| 11 | **Retratos congelados com o que a produção terá** | 44 retratos da versão 24; dois retratos novos antes de subir a versão a cada tarefa | V4A-T1.5 lista os que faltam; cada tarefa congela antes de subir |
| 12 | **Um teste que conta o que é novo precisa saber da linha nova** | Um cenário em navegador contava as linhas da árvore e não conhecia "Mercado" | Toda linha nova na árvore atualiza `05-teclado-e-temas.spec.ts` na mesma tarefa |
| 13 | **Uma tarefa que não roda a matriz deixa o `main` vermelho** (novo) | A V3F-T2 não rodou a matriz; na retomada havia 24 testes vermelhos (22 do simulador, 1 de integração, 1 em navegador) | O portão inteiro, pelo código de saída, é parte de "pronto" de toda tarefa que toca motor ou conteúdo; a integração repete |
| 14 | **Um objetivo muda o caminho de todo bot** (novo) | O objetivo 12 fez todo perfil erguer a Guilda e piorou três células | V4H-T3 mede antes de fechar; os sazonais ficam de fora (decisão 24) |
| 15 | **Conteúdo pela metade não vai ao ar** (novo) | O lote 2 ficou fora da v0.3.0 por não ser verde e não ter sido lido | O lote 2 é tarefa com revisão (V4H-T1); nada de branch de conteúdo sem portão |

---

## 15. Registro de execução

Preencher ao fechar cada tarefa: tarefa, data, commit, sessões, o que foi feito e desvios, e **o que não foi verificado**. Com trilhas em paralelo, cada fase ganha também uma linha "V4x (integração)".

| Tarefa | Data | Commit | Sessões | O que foi feito e desvios | O que não foi verificado |
|---|---|---|---|---|---|
| Revisão 0.2 do plano (não é tarefa) | 2026-10-15 | base `561b0ff` | uma | Plano reescrito contra o código e contra a v0.3 publicada: o lote 2 como herança (decisão 1), Gil e Ximena, F-1 a F-6, o ouro com número, o Apêndice B.0 conferido, as Fases B a I com tarefas, a §11 com 26 decisões em dois lotes e cinco atos, o §15 vazio por tarefa. Nenhum código, nenhum outro documento | **Nenhum teste foi rodado**; a conferência foi por leitura do código em `561b0ff`. Não lidos por dentro: `raids.ts`, `hordeTurn.ts`, `warCouncil` (não existe), as políticas do simulador, `tests/e2e/server.ts` além das rotas |
| V4A-T1 | 2026-10-16 | `dbe38ac` (partida), `71e08f3` e o desta linha | uma (o orquestrador, com dois subagentes de leitura no Sonnet) | **Onde estamos:** `main` 4 commits de documento à frente de `origin/main` (`c2cb21e`, no ar: `0.3.0`, protocolo 3, `contentHash` `3a006cc05fed0b0f`, `builtAt` 2026-10-15T19:54Z); a tag `v0.3.0` não existe. **Versões:** estado 24, protocolo 3, `RNG_VERSION` 1, `VIEW_FORMAT` 2 (constante não exportada), `CACHE_VERSION` `3.2`, `ENGINE_VERSION` e pacotes `0.3.0`; o primeiro passo da v0.4 é o 24 → 25. **Apêndice B.0** conferido linha a linha por leitura: confere, com quatro correções aplicadas (o `boundaryMs` está no `StepContext`, não no `MigrationContext`; dez constantes de tempo real, não nove; dezesseis passos e quinze funções em `processEventsAt`; a linha do teste de expedições). **Retratos:** 44 da versão 24 (599 arquivos); falta, para a v0.4, um de inverno com equipe, um com Torre e Paliçada no nível 2 e incursão marcada, e um com o Armazém no cap conferido. **Portão:** `pnpm verify` **1** na primeira rodada, só por **dois testes de propriedade que estouraram os 30 s** com a máquina ocupada (134 de 136 arquivos, 11.523 testes); sozinhos passam em 21 s; corrigido em `71e08f3` (120 s por bloco); `pnpm build` **0**; `pnpm test:e2e:landing` **0** (37, 7 pulados). **Simulador:** as matrizes das três dificuldades **0** (3.600 partidas dentro das faixas), `ousado` e `especulador` **0** (a arbitragem dá prejuízo); `--perf` **0** (pior `advanceTo` de 40 ms em 30 dias reais fora). Linha de base em **novo** [balance-v0.4.md](balance-v0.4.md), seção 1, com o ouro por fonte e por destino. Caixa de entrada em **novo** [pendencias-v0.4.md](pendencias-v0.4.md). **Lista do `CLAUDE.md` que fica falsa** (para a integração da Fase B): linha 10 (a v0.3 "em execução"), 12 (`architecture.md` "reescrito para a v0.2"), 14 (estado 20 e produção no protocolo 2), 16 (o parágrafo da v0.3 "em execução"), 141 (regra 6: "a versão implementada é a v0.2… com a v0.3 em construção", o ferro e o exército como "ainda é erro" e as versões seguintes), 229 (prefixo de commit da v0.3) e 244 ("quem dá o `push` é o autor", que a decisão 26 e a publicação de 2026-10-15 refinam) | **Integração e navegador não rodaram: o Docker não estava disponível** (o portão do código igual, em `3cb6e01`, passou em 2026-10-15). A carga com 50 bots (`--remote`) também não. **A migração em produção não foi conferida no banco** e o log do job só foi lido no arranque (4 partidas, 0 falhas): as duas perguntas da T1.1 estão nas pendências (ato 27). **O autor não jogou a v0.3** (T1.9): a v0.4 começa sem isso. As impressões digitais dos retratos não foram conferidas uma a uma. `raids.ts` e `hordeTurn.ts` foram lidos só nos trechos que a busca tocou |
| V4A-T2 | 2026-10-16 | `dbe38ac` e o desta linha | uma, com o autor | O lote 1 (decisões 1 a 14, 25 e 26) e a herança da v0.3 (F-1, F-4, E-51, E-54, B-2) respondidos **um a um**, em cinco rodadas de perguntas, todos com a premissa recomendada: **novo** [ADR 0019](decisions/0019-ferro-exercito-formacoes-e-combate-na-v0.4.md). **V4A-T2.4:** o GDD na versão **0.9** (um subagente no Sonnet, conferido por amostra): as decisões do lote 1 no texto e toda duração sem unidade dizendo "de jogo" ou "reais"; o aviso da Torre, que dizia "de jogo", passou a "real", como o código. **V4A-T2.5:** os números das Fases B e C (ADR 0019, "Números propostos") **aprovados pelo autor** em uma rodada de três perguntas: durabilidade 8/10/14/20, reparo a 1 ou 2 ferro por ponto e 2 min de jogo por ponto, o resto em bloco | Os pontos do lote 2 que o GDD ficou marcando "a decidir (ADR 0020)" esperam a V4E-T0. Os links do ADR, do GDD e do roadmap conferidos por roteiro; `pnpm lint` 0 |
| V4B-T1 | 2026-10-16 (em curso) | branch **`v4b-t1-ferro`** = `6cb6245` (T1.1, `ab86177`; T1.2 a T1.6 num commit só, porque `iron` em `RESOURCE_IDS` não fica verde sem o estado 25) e **`wip/v4b-t1-7-8`** = `816bd7c` (T1.7 e T1.8, em parte); **nada junto no `main`** | uma, por um subagente numa árvore separada, parada às 12:36 no prazo do autor | Feito no branch: os retratos do Armazém cheio e da partida migrada com caravana; o ferro no conteúdo (8.000 milésimos, `200 × nível`, sem caravana), o **estado 25** (passo 24 → 25 sem prazo, evento, identificador nem sorteio), o motor (estoque, cap, desperdício, o sorteio do Mercado em comida, madeira, pedra, ferro), a visão e a **Mina Abandonada** (Guilda Nv2, três variantes, 40 a 80 de ferro, revelada pela Floresta Antiga); goldens regravados com o diff lido; 18 células de Senhor remedidas, em `docs/balance-v0.4.md` do branch; pendências B-1 a B-10 no `docs/pendencias-v0.4.md` do branch, **a B-8 pede resposta** (só a Floresta revela a Mina) | **Às 12:50, `pnpm verify` inteiro verde no branch** (`9a2ef30`, que junta o `main` de `769a3f8`, com o limite de 120 s, e resolve os conflitos de `GAME_DESIGN.md`, `balance-v0.4.md` e `pendencias-v0.4.md`): 136 arquivos, 11.987 testes e 1 falha esperada, código 0, no Node 22. No `6cb6245` sozinho houve quatro falhas, três por tempo e uma de faixa, já corrigida. Sem Docker: integração e navegador não rodaram, e `05-teclado-e-temas` e `10-mercado` devem precisar de ajuste (uma linha a mais na árvore e no Mercado). As matrizes de Camponês e Rei de Ferro não foram remedidas. **Para retomar:** com o Docker ligado, rodar a integração e o navegador no `v4b-t1-ferro` (os conflitos com o `main` já foram resolvidos em `9a2ef30`; falta só o `e252a8e`, que é deste registro), corrigir o que quebrar, juntar no `main`, remedir as outras duas dificuldades e só então trazer o `wip/v4b-t1-7-8` |
| V4B-T2 | | | | | |
| V4B-T3 | | | | | |
| V4B-T4 | | | | | |
| V4B-T5 | | | | | |
| V4B (integração) | | | | | |
| V4C-T1 | | | | | |
| V4C-T2 | | | | | |
| V4C-T3 | | | | | |
| V4C-T4 | | | | | |
| V4C (integração) | | | | | |
| V4D-T1 | | | | | |
| V4D-T2 | | | | | |
| V4D-T3 | | | | | |
| V4D-T4 | | | | | |
| V4D-T5 | | | | | |
| V4D (integração) | | | | | |
| V4E-T0 | | | | | |
| V4E-T1 | | | | | |
| V4E-T2 | | | | | |
| V4E-T3 | | | | | |
| V4E-T4 | | | | | |
| V4E-T5 | | | | | |
| V4E (integração e primeira publicação) | | | | | |
| V4F-T1 | | | | | |
| V4F-T2 | | | | | |
| V4F-T3 | | | | | |
| V4F-T4 | | | | | |
| V4F (integração) | | | | | |
| V4G-T1 | | | | | |
| V4G-T2 | | | | | |
| V4G-T3 | | | | | |
| V4G-T4 | | | | | |
| V4G-T5 | | | | | |
| V4G (integração e segunda publicação) | | | | | |
| V4H-T1 | | | | | |
| V4H-T2 | | | | | |
| V4H-T3 | | | | | |
| V4H-T4 | | | | | |
| V4H-T5 | | | | | |
| V4H (integração) | | | | | |
| V4I-T1 | | | | | |
| V4I-T2 | | | | | |
| V4I-T3 | | | | | |
| V4I-T4 | | | | | |
| V4I-T5 | | | | | |
| Lançamento da v0.4.0 | | | | | |

---
## 16. Conteúdo proposto: unidades, destinos de expedição e o lote 3

Ponto de partida para as tarefas de conteúdo; tudo é rascunho até o autor ler. As fichas vão para **novo** `docs/content-v0.4.md`.

### 16.1 Unidades e inimigos

As tabelas do GDD §10.2 e §10.3 entram como estão, em `packages/content/src/units.ts`, com os ids `spearman`, `swordsman`, `archer`, `knight`, `shieldbearer`, `militia` e `wolf`, `raider`, `banditArcher`, `blackKnight`, `ogre`, `skeleton`, `shaman`, `warlord`. O ciclo de contra-ataques é uma tabela (`counters`), e as regras especiais são campos, nunca código. O que o GDD não tem e V4A-T2.5 propõe: o número de armas que uma incursão humana perdida leva (nenhum), e a composição-base por estação do Apêndice A como pesos inteiros (Primavera 70/30; Verão 50/30/20; Outono 35/25/15/15/10).

### 16.2 Destinos de expedição novos

| Modelo | Requer | Aparece | Equipe | O que dá | Desastre |
|---|---|---|---|---|---|
| **Mina Abandonada** (`abandonedMine`) | Guilda Nv2 | Revelada pela Floresta Antiga ou por uma Patrulha | 1 a 3 | 40 a 80 de ferro no último nó com prova; um item nas variantes B e C | Ferimento ou captura, nó a nó |
| **Sabotagem** (`sabotage`) | Outono; Fortaleza ativa; 3 heróis; menos de 3 tentativas | Com a Fortaleza | Exatamente 3 | Cada nó com Sucesso: −15% em uma onda; o Xamã derrotado revela a onda 3 | Captura (pela dificuldade) e a Horda alertada (+10% na onda 1) |

O Acampamento de Saqueadores não é expedição: é a batalha ofensiva do exército (V4F-T2). A Caçada ao Dragão continua fora (v0.5 ou depois).

### 16.3 O lote 3 do Conselho (15 cartas) e a conta das 60

| | Cartas | Cadeias | Roteirizadas |
|---|---:|---:|---:|
| No jogo hoje (lote 1 + "Estrangeira ferida") | 22 | 3 | 1 |
| Lote 2, herdado (V4H-T1): 4 cadeias de 3, "O mercador itinerante" e 10 avulsas | 23 | 4 | 1 |
| **Lote 3** (V4H-T2) | **15** | 1 | 4 |
| **Total** | **60** | 8 | 6 |

Proposta do lote 3, uma linha por carta:

| Tipo | Carta | Escolha que provoca | Depende de |
|---|---|---|---|
| Cadeia 1/3 | A Filha do Ferreiro | Aceitar a aprendiz (forja mais rápida por um prazo) ou recusar | Ferreiro |
| Cadeia 2/3 | O segredo da têmpera | Pagar ferro por uma arma a mais por lote, ou guardar | Ferreiro |
| Cadeia 3/3 | A espada do Senhor | Um item raro, ou armas para a tropa | Ferreiro, Quartel |
| Roteirizada | O primeiro recruta (Salão Nv4) | Treinar o voluntário de graça (Lanceiro) ou mandá-lo à Fazenda | Quartel |
| Roteirizada | Os corvos do norte (1º dia de outono) | Erguer a Torre ao Nv3 com desconto ou ignorar o presságio | Outono |
| Roteirizada | O desertor (último dia de outono) | Pagar pela composição de uma onda ou expulsá-lo | Fortaleza |
| Roteirizada | A véspera (o dia do cerco) | Festa (moral) ou vigília (milícia pronta sem custo de produção por uma noite) | Cerco marcado |
| Avulsa | Mercenários de passagem | Contratar 5 Espadachins por ouro e armas, por um prazo, ou recusar | Quartel |
| Avulsa | Ferro de contrabando | Comprar barato com risco de ser falso (sorteio na virada) | Mercado |
| Avulsa | O capitão veterano | Um herói Veterano com desconto na Taverna | Taverna |
| Avulsa | A muralha rachada | Reparar agora com desconto ou esperar | Muralha danificada |
| Avulsa | Saqueadores pedem passagem | Pagar comida ou arriscar uma incursão fraca a mais | Acampamento ativo |
| Avulsa | O espião da Horda | Interrogar (presságio) ou enforcar (moral) | Fortaleza |
| Avulsa | Conselho de Guerra | Um comandante Prudente abre "ouvir": a prévia da próxima incursão de graça | Opção extra por traço |
| Avulsa | Depois da tempestade | Luto ou festa pelo cerco: reparo com desconto ou moral | Rescaldo |

Nenhuma carta pede o que o feudo não pode ter; cada mecânica da v0.4 tem ao menos uma; os títulos e as escolhas são ponto de partida.

### 16.4 Fichas obrigatórias

As da v0.3 (roadmap da v0.3, §13.4), mais: a **ficha de uma unidade** (atributos, iniciativa, linha, custo, treino, contra quem, frase da tela), a **ficha de um cenário de batalha** (a entrada, a conta rodada a rodada à mão, os três fatores esperados) e a **ficha de um presságio** (clareza, o que revela, a frase).

### 16.5 Guardar para as próximas versões

Caçada ao Dragão; Veio de Ferro (posto avançado); relíquias e o Lendário; a Horda que lembra do ano anterior; Votos e o fator do ano na onda; Feitos completos; "Avançar para o Degelo" se a decisão 22 o descartar; os objetivos sazonais.

---

## Apêndice A — Modelos de prompt

### A.1 Abrir uma tarefa

```
Leia CLAUDE.md, as seções do GAME_DESIGN.md indicadas na tarefa, a tarefa <ID> em docs/roadmap-v0.4.md,
o Apêndice B do roadmap e os ADRs que a tarefa consome (docs/decisions/0019 e 0020, os que existirem).
Trabalhe só nessa tarefa. Se uma decisão que ela consome ainda não tem ADR, pare e me pergunte,
apresentando a premissa recomendada da §11 como padrão. Confira o Apêndice B.0 contra o código.
Se for M ou L, escreva o plano (arquivos, nomes de eventos/recusas/campos do ViewState, passo de
migração, testes) antes de codar.
Escreva os testes antes da implementação onde houver regra de jogo ou contrato de API; na batalha,
o golden antes do motor.
Ao terminar, rode a "Verificação" da tarefa e a verificação comum (§0.9) pelo código de saída, cole
as saídas, marque as caixas, preencha o Registro (§15) com o que foi e o que não foi verificado, e
faça um commit "<ID>: <resumo>". Se precisar desviar do GDD, pare e me proponha um ADR antes. Não dê push.
```

### A.2 Retomar uma tarefa interrompida

```
Leia CLAUDE.md e a tarefa <ID> em docs/roadmap-v0.4.md. Veja `git status`, `git diff` e `git log -5`.
Me diga em cinco linhas o que já está feito, o que falta e se há algo quebrado (`pnpm verify`).
Depois continue pela próxima subtarefa não marcada.
```

### A.3 Sessão de decisões (V4A-T2 e V4E-T0)

```
Leia CLAUDE.md, docs/roadmap-v0.4.md §11 e §0.6, docs/pendencias-v0.4.md e as seções do GDD da tarefa.
Vamos fechar o lote <N>. Para cada decisão: a pergunta em uma frase, a sua recomendação como padrão
("se eu não disser nada, fica assim"), a alternativa e o que muda no jogo. Poucas por rodada, as que
mudam o jogo de quem já joga primeiro. Registre em docs/decisions/<NNNN>-<titulo>.md com o que foi
aplicado, data, alternativa descartada, razão, tarefa afetada e seção do GDD; corrija o GDD onde a
resposta mudar uma frase ou um número; atualize a §11 do roadmap. Não preencha resposta por suposição.
```

### A.4 Revisão independente (subagente que não escreveu o código)

```
Você é um revisor que não escreveu este código. Leia CLAUDE.md, docs/roadmap-v0.4.md (a fase indicada,
§0.7, §10.2 e §14) e os commits de <intervalo>. Não aceite teste verde como prova: para cada contrato
da §0.7 e cada cenário QA da fase, diga se há teste que o cubra e tente quebrá-lo com um caso concreto
(instante exato, duas abas, reenvio, migração no meio, cortes diferentes do intervalo, entidade que
nasce e morre, o jogador fora 30 dias, três fusos).
Procure: número de jogo fora de packages/content; regra fora de packages/engine; ponto flutuante em
conta de jogo; sorteio em comando, em visão ou em nextEventAt (a prévia é a exceção escrita: confira
que state.rng sai igual); fluxo de sorteio que sobrevive à entidade; composição de onda, memória da
Horda ou presságio além da clareza saindo no ViewState; número ou frase do conteúdo no pacote do app;
bot que lê algo além do ViewState; lista do estado sem teto; conversão entre recursos sem propriedade
de ciclo; e qualquer campo ou botão de versão futura (mapa, relíquia, Legado, Voto, Temporada).
Entregue uma lista de achados classificados (defeito confirmado com reprodução; risco; dúvida), cada
um com arquivo e linha, em docs/reviews/v0.4-<fase>.md. Não corrija nada: quem corrige é a sessão
principal, um commit por defeito, com teste de regressão.
```

### A.5 Integração de uma fase

```
Leia CLAUDE.md e docs/roadmap-v0.4.md §0.4, §0.8 e §0.9. Mescle as trilhas no main. Rode no resultado,
um comando de cada vez, pelo código de saída: pnpm verify, a integração inteira, pnpm build,
pnpm test:e2e, pnpm test:e2e:landing e pnpm --filter @lotg/sim-cli test. Não corrija defeito de
mecânica aqui: registre e devolva à trilha. Atualize CLAUDE.md, docs/architecture.md e os READMEs
com o que a fase tornou falso. Preencha a linha "V4x (integração)" do Registro com as contagens, o
que quebrou e o que não foi rodado. Se a fase é publicável (decisão 26): backup manual do banco,
SHA de retorno anotado, nota em deploy/README.md, e me avise. Não dê push.
```

### A.6 Definição de pronto (vale para toda tarefa)

- [ ] Comandos da "Verificação" executados, com saída colada e o código de saída conferido.
- [ ] `pnpm verify` verde; integração, navegador e simulador quando a tarefa toca servidor, app ou motor; a matriz quando toca motor ou conteúdo.
- [ ] Nenhum número de jogo fora de `packages/content`; nenhuma regra fora de `packages/engine`; nenhum ponto flutuante em conta de jogo; nenhuma conversão de tempo no app; nenhum sorteio fora de `advanceTo` (fora a exceção escrita da prévia).
- [ ] Passo de migração escrito e testado quando a forma do estado mudou; retratos da versão anterior congelados antes de subir.
- [ ] Golden regravado de propósito, com o diff lido; GDD atualizado se a regra mudou.
- [ ] Documentação tocada quando o comportamento mudou (README do pacote, `docs/architecture.md`, `CLAUDE.md`, `deploy/README.md`).
- [ ] Caixas marcadas; Registro preenchido (com o que não foi verificado); ADR criado se houve desvio.
- [ ] Um commit `<ID>: <resumo>`; `main` continua verde; nenhum `push`.

### A.7 Sessão típica (exemplo com V4A-T1, a primeira)

1. Você: o prompt de V4A-T1.
2. Agente: lê, roda `git status -sb`, `git log`, `git worktree list`, consulta `GET /v1/version` e confirma o commit de partida, o estado 24 e o protocolo 3. Você responde às duas perguntas de V4A-T1.1 (a migração no banco; o log do job).
3. Agente: roda o portão inteiro, as cinco matrizes, `--perf` e a carga; mede os tamanhos.
4. Agente: confere o Apêndice B.0 contra o código e corrige o que divergir; escreve `docs/balance-v0.4.md` (seção 1) e `docs/pendencias-v0.4.md`; revisa a §12.
5. Agente: confere links por script, marca V4A-T1.1 a T1.12, preenche o Registro e faz o commit `V4A-T1: confere a herança da v0.3 e mede a linha de base`.
6. Você: lê `docs/pendencias-v0.4.md` e abre a sessão de decisões (V4A-T2).

---

## Apêndice B — Contratos de dados propostos da v0.4

Referência única dos **nomes propostos** para estado, comandos, eventos, recusas e `ViewState`. Cada tarefa confirma ou ajusta os seus e atualiza este apêndice; nenhum campo entra antes da tarefa que o usa (regra 6 do `CLAUDE.md`). Tudo em tempo de jogo no estado e em tempo real no `ViewState`.

### B.0 O que a v0.3 entrega e a v0.4 usa

**Conferido em 2026-10-15, no commit `561b0ff`** (estado 24, protocolo 3), por leitura do código; nenhum teste foi rodado para esta conferência. V4A-T1.3 reconfere.

| Mecânica da v0.4 | O que ela usa da v0.3 | Onde está | O que a conferência achou |
|---|---|---|---|
| Toda tarefa que muda o estado | `migrateState`, um passo por versão, retratos congelados, `context.boundaryMs`, recusa de versão futura, guarda de forma | `packages/engine/src/migrations.ts`, `migrations/v1.ts` a `v24.ts`, `migrations/shape.ts`, `__fixtures__/` | `CURRENT_SCHEMA_VERSION` **24**; `GameState.schemaVersion: 24`; 598 retratos `.json`, 44 da versão 24. O primeiro passo da v0.4 é 24 → 25. `MigrationContext` traz só `timeScale`; o `StepContext`, que cada passo recebe, acrescenta `boundaryMs` (`migrations/step.ts`). A origem real da Vigília pede um campo novo no contexto (decisão 13) (a origem real da Vigília pede um campo novo: decisão 13) |
| Batalha, prévia, Horda, presságios | Gerador xoshiro128\*\* com fluxos fixos e por entidade; `dropStream`; só `advanceTo` sorteia | `random.ts` | `RNG_VERSION` 1; `RNG_STREAMS = ['council', 'morale', 'horde', 'tavern', 'market']`; `RNG_STREAM_FAMILIES = ['expedition', 'caravan']`. A família `battle` é nova; a prévia não pode usar `state.rng` (decisão 10) |
| Identidades (formação, batalha, campanha) | `nextId(draft, tipo)` por contador em `state.ids` | `ids.ts` | Tipos hoje: `hero`, `offer`, `expedition`, `item`, `caravan`, `master`. Novos: `formation`, `battle` |
| Ferro | `RESOURCE_IDS`, `MARKET_RESOURCE_IDS`, `storage.ts`, `market*.ts`, `caravanOrders.ts` | `packages/content/src/ids.ts`, `balance.ts` | `RESOURCE_IDS = ['food', 'wood', 'stone', 'gold']`; `MARKET_RESOURCE_IDS = ['food', 'wood', 'stone']`; `market.caravan.priceRatio` 23/20, `slotsByLevel [0,1,1,2,2]`; a guarda da versão 24 escreve os limites do Mercado (E-59): **mudar um deles pede versão nova** |
| Ferreiro, Quartel, Muralha, Torre | `BUILDING_IDS` (treze), `buildings.ts`, `construction.ts`, as duas filas, `UpgradeView.effect` | `packages/content/src/buildings.ts` | Torre (`watchtower`) e Paliçada (`palisade`) em `maxLevel: 2`, com a recusa que promete versão futura; a Taverna, a Guilda e o Mercado são o molde do edifício que nasce no nível 0 com teste "cabe no depósito" |
| Soldados | `population.villagers`, `inhabitants`, o piso (`aboveFloor` só conta aldeões), a fila de recrutamento, os feridos | `population.ts`, `masters.ts`, `raids.ts` | O Mestre é "um braço a mais" fora dos aldeões: o molde de um habitante que não é aldeão |
| Comandante de ala | `Hero` com `status: 'idle' \| 'expedition' \| 'escort' \| 'injured' \| 'captured'`, `injury`, `captivity`, `equipment` (3 espaços), `freedAtMs`; `heroCapture` por dificuldade; auras não existem | `types.ts`, `heroes.ts`, `content/heroes.ts` | Os traços têm só os efeitos que a v0.3 usa (C-7: a aura do Veterano não existe); `power` = ataque + defesa + vida/10 |
| Sabotagem, Mina Abandonada | O motor de expedições: `ExpeditionModelDef` com `requires`, `access`, nós com `onDisaster`, `rewards` (`resources`, `items`, `reveals`, `clearsTile`, `rescues`, `master`), três variantes, `STABLE_IDS`, os goldens de calibragem e catálogo | `content/expeditions.ts`, `missions/*.ts`, `engine/expedition*.ts` | Seis modelos (`patrol`, `oldForest`, `wolfDen`, `rescue`, `ruins`, `swamp`); `slotsByGuildLevel [1,2,2,3]`, `reportsKept 3`, `crossroadsWaitRealMs` 12 h. `expeditions.test.ts` (o `it` na linha 679, a expressão na 683) barra ferro, arma, relíquia, planta, unidade, presságio, exército, mestre e mercado nas frases e recompensas |
| Incursões como batalha | `ScheduledRaid { id; atMs; kind; enemy; size; announcedAtMs }`, `raids.scripted` (só `wolvesYear1`), `raids.damage.wolves`, `settleRaids`, `palisadeLevels`, `palisadeBreach` | `types.ts`, `raids.ts`, `hordeTurn.ts`, `balance.threat`, `balance.raids` | `ENEMY_IDS = ['wolves']`; `RAID_SIZE_IDS = ['light', 'medium']`; a Ameaça com `perActiveTilePerDay 2`, `seasonPerDay { autumn: 3 }`, `raidChanceAbove 40`, `mediumRaidAbove 70`, `raidDrop 35`, `raidLeadMs` 6 h, `tileClearedDrop 30`; `watchtowerLevels` com duas entradas (1 h e 2 h reais) |
| Tiles (Fortaleza, Acampamento) | `map.tiles: Record<string, MapTile>`, `MapTile { type; threatActive }`, `map.discovered`, `restoreTiles` na virada do ano, `threat.seasonEnemy` | `types.ts`, `threat.ts`, `content/tiles.ts` | `tileTypes` só `wolfDen`; `startingTiles` um; `enemies` só `wolves` com frases por tamanho |
| Hora da Vigília | `GameSettings { settlementName; timezone; vigilHourLocal; difficulty; timeScale }`; `games.vigil_hour`, `games.created_at`, `games.time_scale`; `realToGameMs` | `types.ts`, `units.ts`, `server/db/schema.ts`, `games/service.ts`, `web/tabs/Settings.tsx` | **O fuso e a hora já estão no estado** e não são usados por nenhuma regra; não há origem em tempo real no estado; o app grava `vigilHour` nas Preferências |
| Decisão entre ondas | `pendingDecisions` como união fechada por `kind` | `protocol/src/view.ts` (`PendingDecisionSchema`) | `z.discriminatedUnion('kind', [card, crossroads])`: a terceira sobe o protocolo para 4 |
| Crônica do Ano | `GET /chronicle`, `/chronicle.md?links=1`, `chronicleRows`, `CHRONICLE_HIDDEN_EVENT_TYPES`, `game_events`, `stats` | `server/src/games/*`, `protocol` | Não há evento de fim de ano nem rota por ano; `yearStarted` existe |
| Cartas | `scripted`, `COUNCIL_EFFECT_TYPES` (`resources`, `morale`, `setFlag`, `clearFlag`, `scheduleCard`, `addHero`), requisitos (`seasons`, `minDay`, `buildings`, `flags`, `notFlags`, `moralRange`), 22 cartas | `content/council.ts`, `cards/*.ts`, `council.test.ts` | O teste da linha 345 barra ferro, ferreiro, exército, combate, batalha, soldado, presságio, relíquia, quartel, muralha, horda e cerco; `deliverMaster` existe sem carta que o chame; `market.effects` não existe |
| Ordem do mesmo instante | `processEventsAt` | `advance.ts` (linhas 125 a 176) | `finishConstructions` → `finishRecruitments` → `recoverInjured` → `settleMasterArrivals` → `recoverHeroes` → `processCalendar` → `settleMasterArrivals` → `settleCouncil` → `settleHeroArrivals` → `finishAdaptations` → `settleRaids` → `settleTavern` → `settleExpeditions` → `settleCaravans` → `settlePlanned` → `settleScarcity` |
| Simulador | Bots `economico`, `preguicoso`, `explorador`, `ousado`, `especulador`; `--matrix --profile`, `--expeditions`, `--perf`, `--remote`, `--smoke`; `goldTable`; `MEASURED` | `packages/sim-cli/src/bots/*`, `matrix.ts`, `bands.ts` | Não há `militar` (GDD §15.3 o nomeia); nenhuma coluna de exército ou cerco |
| App | Abas Hoje, Feudo, Conselho, Guilda, Mercado, Crônica; `guildOrder`; a conferência em duas etapas; `VIEW_FORMAT 2`; `CACHE_VERSION '3.2'` | `packages/web/src` | Não há aba Exército; `tests/e2e/server.ts` tem rotas `/__test/*` (`hero`, `item`, `crossroads`, `captive`, `master`, `reveal`, `threat`, `stock`, `raise`…) como molde das novas |

### B.1 `GameState`: o que a v0.4 acrescenta, por tarefa

```ts
type GameState = {
  // …tudo o que a v0.3 deixa…
  schemaVersion: 37;                                   // a contagem prevista; cada tarefa fixa a sua
  settings: { …; realOriginMs: number; vigil: { hourLocal: number; utcOffsetMinutes: number } };  // V4G-T1 (35)
  rng: Record<string, number[]>;                       // + 'battle:<id>' (V4D-T1), apagado no fim do instante
  settlement: {
    buildings: Record<BuildingId, number>;             // + smithy (V4B-T2, 26), barracks (V4C-T1, 28); palisade até 6 e watchtower até 5 (V4E-T1)
    resources: Record<ResourceId, number>;             // + iron (V4B-T1, 25; com cap no Armazém), weapons (V4B-T2; sem cap)
    forge: { kind: 'weapons'; amount } | { kind: 'repair'; itemId } & { startedAtMs; endsAtMs } | null;  // V4B-T2, V4B-T3 (27)
    wall: { hp: Record<WingId, number> };              // V4E-T1 (31)
    wallRepair: { untilMs: number; toHp: number } | null;
    militia: { count: number; untilMs: number } | null;    // V4G-T2 (36)
    reconstructionUntilMs: number | null;              // V4G-T2
  };
  army: {                                              // V4C-T1 (28)
    units: Record<UnitId, number>;
    training: { unit: UnitId; amount: number; startedAtMs: number; endsAtMs: number } | null;
    formations: Formation[];                           // V4C-T2 (29); até balance.army.formationsCap
    activeFormationId: string | null;
    reports: BattleReport[];                           // V4D-T1 (30); até balance.battle.reportsKept
    preview: BattlePreview | null;                     // V4D-T2
    campaign: { formationId; tile; departsAtMs; battleAtMs; returnsAtMs } | null;  // V4F-T2 (34)
    battlePlan: Record<1 | 2 | 3, string | null>;      // V4G-T2 (36)
  };
  horde: {
    scheduledRaids: ScheduledRaid[];                   // + composition (V4E-T2, 32), size 'strong'
    lastFormationSeen: FormationSummary | null;        // V4E-T3 (33)
    omens: Omen[];                                     // V4E-T3; teto balance.omens.cap
    sabotages: { attempts: number; successes: number; alerted: boolean };  // V4F-T1 (34); zera na virada do ano
  };
  siege: { atMs: number; waves: Wave[]; current: 0 | 1 | 2 | 3; result: 'glorious' | 'victory' | 'fall' | null } | null;  // V4G-T2 (36)
  market: { …; prices/previousPrices/tradedToday com iron; effects: MarketEffect[] };  // V4B-T1 (25); V4H-T1 (37)
  map: { tiles: Record<string, MapTile> };             // + hordeFortress, raiderCamp (V4E-T3)
  stats: Record<string, number>;                       // + weaponsForged, soldiersTrained, battlesFought, battlesSimulated, raidsRepelled, sabotages, siegeResult:<ano>…
};

type Formation = {
  id: string; name: string;
  posts: Record<WingId, Record<LineId, { unit: UnitId; count: number } | null>>;
  commanders: Record<WingId, string | null>;            // heroId
};
type Item = { id; defId; condition: number };          // V4B-T3 (27)
type Hero = { …; status: … };                           // sem estado novo: o comandante é campo da formação (decisão 8)
```

### B.2 Comandos novos

| Comando | Payload | Tarefa | Recusas |
|---|---|---|---|
| `forgeWeapons` | `{ amount }` | V4B-T2 | `SMITHY_REQUIRED`, `FORGE_BUSY`, `INVALID_AMOUNT`, `INSUFFICIENT_RESOURCES` |
| `cancelForge` | `{}` | V4B-T2 | `NO_FORGE` |
| `repairItem` | `{ itemId }` | V4B-T3 | `SMITHY_REQUIRED`, `FORGE_BUSY`, `ITEM_NOT_FOUND`, `ITEM_INTACT`, `INSUFFICIENT_RESOURCES` |
| `trainSoldiers` | `{ unit, amount }` | V4C-T1 | `BARRACKS_REQUIRED`, `TRAINING_BUSY`, `ARMY_LIMIT`, `NOT_ENOUGH_VILLAGERS`, `INVALID_AMOUNT`, `INSUFFICIENT_RESOURCES` |
| `cancelTraining`, `disbandSoldiers` | `{}`, `{ unit, amount }` | V4C-T1 | `NO_TRAINING`, `INVALID_AMOUNT` |
| `saveFormation` | `{ id: string \| null, name, posts, commanders }` | V4C-T2 | `FORMATIONS_CAP`, `FORMATION_NOT_FOUND`, `INVALID_FORMATION`, `HERO_UNAVAILABLE` |
| `deleteFormation`, `setActiveFormation` | `{ formationId }` | V4C-T2 | `FORMATION_NOT_FOUND`, `FORMATION_ACTIVE` |
| `simulateBattle` | `{ formationId }` | V4D-T2 | `BARRACKS_REQUIRED`, `FORMATION_NOT_FOUND` |
| `repairWall` | `{}` | V4E-T1 | `WALL_INTACT`, `REPAIR_BUSY`, `INSUFFICIENT_RESOURCES` |
| `attackCamp` | `{ formationId }` | V4F-T2 | `ARMY_AWAY`, `CAMP_NOT_FOUND`, `NO_SOLDIERS`, `FORMATION_NOT_FOUND` |
| `setBattlePlan` | `{ wave, formationId \| null }` | V4G-T2 | `FORMATION_NOT_FOUND`, `SIEGE_STARTED` |
| `swapWaveFormation`, `emergencyRepair` | `{ formationId }`, `{}` | V4G-T2 | `NO_WAVE_DECISION`, `INSUFFICIENT_RESOURCES` |
| `callMilitia` | `{ count }` | V4G-T2 | `MILITIA_NOT_ALLOWED`, `MILITIA_ACTIVE`, `INVALID_AMOUNT` |
| `sendExpedition` | (o de hoje) | V4F-T1 | + `SABOTAGE_SEASON`, `SABOTAGE_LIMIT`, `TEAM_SIZE`; + `HERO_BUSY` para o comandante da formação ativa (V4C-T2) |

Toda recusa entra em `REJECTION_CODES` do motor e do protocolo, com o teste de igualdade de tipos, e tem de ser alcançável (`commands.test.ts`).

### B.3 Eventos novos (`EVENT_TYPES` e `chronicleTemplates`)

`weaponsForged`, `forgeQueued`, `forgeCancelled`, `itemWorn`, `itemRepaired` (B); `trainingStarted`, `soldiersTrained`, `soldiersDisbanded`, `formationSaved`, `formationActivated`, `formationDeleted` (C); `battleFought`, `battleSimulated` (escondido da Crônica), `commanderInjured` (D); `wallDamaged`, `wallRepairStarted`, `wallRepaired`, `raidBattle`, `omenSeen`, `fortressAppeared`, `campAppeared` (E); `hordeSabotaged`, `hordeAlerted`, `armyMarched`, `campAssaulted`, `armyReturned` (F); `siegeScheduled`, `siegeWaveFought`, `siegeWon`, `siegeGlorious`, `siegeFell`, `militiaCalled`, `militiaDisbanded`, `warlordSlain`, `reconstructionStarted`, `yearEnded` (G). Os marcadores novos: `{unidade}`, `{ala}`, `{fatores}`, `{onda}`.

### B.4 `ViewState`: campos novos

| Onde | Campo | Tarefa |
|---|---|---|
| `resources` | `iron` (com cap, `breakdown`, `depletesInSeconds`), `weapons` | V4B-T1, V4B-T2 |
| `market.prices` | `iron` (sem caravana) | V4B-T1 |
| **novo** `smithy` | `built`, `level`, `forge`, `perWeaponSeconds`, `offer`, `repairOffers[]` | V4B-T2, V4B-T3 |
| `guild.heroes[].equipment[]`, `guild.inventory[]` | `conditionText`, `repairable` | V4B-T3 |
| **novo** `army` | `built`, `level`, `cap`, `units[]`, `training`, `offer[]`, `formations[]` (com `shortfall`, `isActive`, `previewStale`), `editor`, `preview`, `omens[]`, `campaign`, `battlePlan`, `reports[]` | V4C-T1 a V4G-T2 |
| `population` | `soldiers`, `militia` | V4C-T1, V4G-T2 |
| `guild.heroes[]` | `commanding: { formationName; wing } \| null`, `auraText` | V4C-T2, V4D-T3 |
| `threat.defense` | `wall { levelLabel; hp[]; repairOffer }`, `tower { damageText; revealsComposition }` | V4E-T1 |
| `threat.incoming` | `knownComposition[]` (por nível da Torre) | V4E-T2 |
| `threat.tiles[]` | a Fortaleza e o Acampamento, com o que cada um faz | V4E-T3 |
| **novo** `siege` | `scheduledInSeconds`, `vigilText`, `waves[]` (só o que se sabe), `current`, `plan`, `result`, `rescaldoText` | V4G-T2 |
| `pendingDecisions[]` | `{ kind: 'siegeWave', wave, decidesInSeconds, options }` (**protocolo 4**) | V4G-T2 |
| **novo** `year` | `number`, `endsInSeconds`, `chronicleAvailable` | V4G-T3 |

### B.5 Conteúdo novo (`@lotg/content`)

`units.ts` (unidades, inimigos, contra-ataques, composições por estação), `omens.ts`, `feats.ts`, `missions/abandonedMine.ts`, `missions/sabotage.ts`, `cards/*` dos lotes 2 e 3; em `balance.ts`: `resources.iron`, `smithy`, `army`, `battle`, `wall`, `horde`, `omens`, `siege`, `score`; em `buildings.ts`: `smithy`, `barracks`, os níveis novos da Torre e da Paliçada; em `tiles.ts`: `hordeFortress`, `raiderCamp`, os inimigos novos; em `difficulties[]`: `cunning`, `siegeFactor`. Tudo com schema zod e teste de conteúdo, e os ids fixados em teste.

---

## Mudanças propostas fora deste arquivo

Nada além de `docs/roadmap-v0.4.md` foi editado nesta revisão. O que ela achou que pede mudança em outro lugar, para quem executar V4A-T1 ou o autor:

1. **`CHANGELOG.md`**: a 0.3.0 está datada de 2026-10-07; a publicação foi em 2026-10-15. A seção "O que muda nas partidas em andamento" diz "o lote 2 do Conselho pode ter subido a versão" e "Objetivos 11 a 16 e o lote 2": o lote 2 **não entrou** (F-3).
2. **`CLAUDE.md`**: descreve a v0.3 como em execução e a publicação como pendente; a lista do estado por fase, a regra 6 ("ainda é erro: … ferro no Mercado (v0.4)…") e o regime de `push` precisam do estado de 2026-10-15 e, a partir da Fase B, da v0.4 em execução. V4A-T1.12 entrega a lista; a integração da Fase B aplica.
3. **`docs/retomada-v0.3.md`**: diz "apague-o quando a versão fechar (a tag `v0.3.0`)"; a tag ainda não existe. Fica até o ato 27.
4. **`docs/roadmap-v0.3.md`**, §12: a linha V3G-T5 diz "o lote 3 depende do lote 2, que ficou fora"; o destino do lote 2 passa a ser a decisão 1 deste roadmap.
5. **`GAME_DESIGN.md`**: §12.2 lista os objetivos `[v0.4]` sem id; §4.3 pede o fuso IANA, que já está no estado; §11.2 tem o fator do ano e os Votos (v0.5) na fórmula; §10.8 e §11.2 não dizem se "60 min" é real ou de jogo. Tudo isso é da sessão de decisões (V4A-T2.4 e V4E-T0.3), não desta revisão.
6. **`docs/decisions/README.md`**: ganhará as linhas 0019 e 0020 nas sessões.
7. **`packages/content/src/council.test.ts`** (linha 345) e **`expeditions.test.ts`** (linha 683): as expressões regulares que barram as palavras da guerra serão afrouxadas carta a carta e recompensa a recompensa, nas tarefas B1, H1 e H2, nunca de uma vez.
8. **Limpeza do repositório** (não é tarefa): `.hermes.md` na raiz sem rastreio; as árvores `worktree-agent-*` e o branch `e2e-fixes` sobrando da v0.3 (`git worktree prune`); o banco `lotg_test_e2e`.
