# Lords of the Guild — Roadmap da v0.3 "Guilda"

> **Status:** plano **proposto**, escrito em 2026-10-02 por um agente, sem o autor, enquanto a v0.2 ainda era implementada. **Nenhuma tarefa foi executada e nenhuma decisão da §9 foi respondida.** É a entrega da tarefa V2F-T5 do [roadmap da v0.2](roadmap-v0.2.md), feita antes do fechamento da v0.2: por isso a seção de lições (§11) tem um espaço marcado para preencher depois, e a primeira tarefa (V3A-T1) confere no código tudo o que este plano presumiu.\
> **Versão do documento:** 0.1 (2026-10-02)\
> **Base:** [GAME_DESIGN.md](../GAME_DESIGN.md) v0.7: §16 (linha da v0.3), §16.2 (critérios da v0.3), §18.2 ("§9 completo, §5.9"), §14 (contrato de arquitetura), §15.1 (regras de diversão)\
> **Vem de:** [roadmap-v0.2.md](roadmap-v0.2.md), tarefa V2F-T5; ADRs [0013](decisions/0013-regras-da-v0.2-tempo-ritmo-migracao-e-economia.md) e [0014](decisions/0014-conselho-e-ameaca-na-v0.2.md); [pendencias-v0.2.md](pendencias-v0.2.md)\
> **Árvore em que foi escrito:** commit `e3d478e`, com a Fase B da v0.2 concluída e revisada e as Fases C a F em andamento em outras árvores. O que este plano diz das mecânicas da v0.2 (estações, caps, moral, Conselho, Ameaça) vem dos ADRs 0013 e 0014 e do Apêndice B do roadmap da v0.2, **não do código**\
> **Forma de trabalho:** desenvolvimento 100% com Claude Code, uma tarefa por sessão; o autor decide regras, aprova conteúdo e joga cada fase antes da seguinte\
> **Idioma:** português (Brasil); identificadores de código em inglês

Revisar este plano não conclui tarefas nem aprova regras. As premissas da §9 são **propostas**: viram regra quando o autor responder (sessões V3A-T2 e V3D-T0) ou, se ele pedir de novo uma execução sem ele, quando forem aplicadas por delegação e registradas como tal (§0.6). Onde este roadmap e um ADR divergirem, vale o ADR. Onde este roadmap e o código da v0.2 divergirem, vale o código, e este documento é corrigido em V3A-T1.

**Leia primeiro:** §0.2 (o que o jogador vai sentir), §0.3 (como o plano está organizado), §0.8 (como a v0.3 chega à produção), §9 (decisões e premissas) e §11 (o que a v0.2 ensinou). Para executar uma tarefa, leia a tarefa, o Apêndice B (nomes e contratos propostos) e a matriz da §8.

## Índice

- [0. Como usar este roadmap](#0-como-usar-este-roadmap)
- [1. Fase A — Herança e decisões](#1-fase-a--herança-e-decisões)
- [2. Fase B — Fundação da Guilda](#2-fase-b--fundação-da-guilda)
- [3. Fase C — Heróis e Taverna](#3-fase-c--heróis-e-taverna)
- [4. Fase D — Expedições](#4-fase-d--expedições)
- [5. Fase E — Mercado, caravanas e Mestres](#5-fase-e--mercado-caravanas-e-mestres)
- [6. Fase F — Lote 2 do Conselho e objetivos](#6-fase-f--lote-2-do-conselho-e-objetivos)
- [7. Fase G — Fechamento da v0.3](#7-fase-g--fechamento-da-v03)
- [8. Critérios de aceitação, cenários integrados e sinais de diversão](#8-critérios-de-aceitação-cenários-integrados-e-sinais-de-diversão)
- [9. Decisões que esperam o autor, com premissas recomendadas](#9-decisões-que-esperam-o-autor-com-premissas-recomendadas)
- [10. Dívidas conhecidas, herdadas da v0.2](#10-dívidas-conhecidas-herdadas-da-v02)
- [11. O que a v0.2 ensinou](#11-o-que-a-v02-ensinou)
- [12. Registro de execução](#12-registro-de-execução)
- [13. Conteúdo proposto: expedições e o lote 2 do Conselho](#13-conteúdo-proposto-expedições-e-o-lote-2-do-conselho)
- [Apêndice A — Modelos de prompt](#apêndice-a--modelos-de-prompt)
- [Apêndice B — Contratos de dados propostos da v0.3](#apêndice-b--contratos-de-dados-propostos-da-v03)

---

## 0. Como usar este roadmap

### 0.1 O que é a v0.3

A v0.3 é a linha "Guilda" da tabela do GDD §16: **Taverna, heróis, expedições com encruzilhadas, Mercado e caravanas, Mestres**. O GDD §18.2 diz o que ela implementa: "§9 completo, §5.9. Grafos de expedição com 3 variantes por modelo". A frase que o jogador deve poder dizer ao fim dela é a da tabela: **"Tenho uma equipe e histórias para contar."**

Os critérios de aceitação são os cinco da §16.2:

1. O primeiro herói chega pela carta do dia 2.
2. Uma expedição para na encruzilhada, notifica, e após 6 h sem resposta segue a Postura.
3. O relatório narra nó a nó.
4. O Mercado respeita o volume diário.
5. Uma caravana pode ser emboscada.

"Dia 2" é o dia real 2 do ritmo Normal; em outros ritmos vale a conversão da premissa 6 (§9). As "6 h" do critério 2 são tempo real, pela premissa 1.

**O que entra além dos critérios:** contratação na Taverna, soldo e o que acontece sem ouro, moral da Taverna e festival, equipamento, experiência e níveis, ferimento, captura e Resgate, limpar o Covil de Lobos (Ameaça −30, que o GDD §8.2 marca como `[v0.3]`), Mestres, o lote 2 do Conselho (§13.3) e os objetivos de herói e de expedição que o GDD §12.2 guardou para esta versão.

**Não entra:** exército, Quartel, Ferreiro, ferro, armas, formações, herói como comandante de ala, Muralha de Pedra, presságios, Fortaleza da Horda, sabotagem (§9.5), Cerco, Hora da Vigília com efeito (v0.4); mapa gráfico, postos avançados, Capela, relíquias, Legado, Temporadas (v0.5). Vale a regra do projeto: **não antecipar mecânicas de versões futuras, nem "só a estrutura"**. Onde uma regra da v0.3 cita algo de outra versão, a parte de outra versão fica de fora:

| O GDD diz | O que a v0.3 faz | Decisão |
|---|---|---|
| Um herói é expedição **ou** comandante de ala **ou** descanso (§9.1) | Só expedição, escolta de caravana e descanso. "Nomear comandante" não aparece em menu nenhum | — |
| Mina Abandonada dá 40 a 80 ferro (§9.3) | Fica para a v0.4, com o ferro | 12 |
| Acampamento de Saqueadores usa o sistema de batalha (§9.3) | Fica para a v0.4 | 12 |
| Sabotagem da Fortaleza e Caçada ao Dragão (§9.3, §9.5) | Ficam para a v0.4 e a v0.5 | 12 |
| Ruínas dão a planta da Capela; o Pântano dá relíquia (§9.3) | A recompensa de versão futura é trocada por item da raridade equivalente | 12, 15 |
| O Mercado negocia ferro (§5.9) | Comida, madeira e pedra | 16 |
| "O Lobo Branco" dá relíquia, presságio e lobos no cerco (Apêndice B) | A cadeia é reescrita com o que existe: expedição especial, Ameaça, incursão | 19 |
| "O Cobrador do Rei" chega com soldados (Apêndice B) | A cadeia termina sem batalha; o ramo de combate entra na v0.4 | 19 |
| Reparo de equipamentos no Ferreiro (§6.1) | Equipamento não se desgasta na v0.3 | 15 |
| Clériga cura, auras de comandante, Mago contra mortos-vivos (§9.1) | Classe conta só no que a v0.3 usa: poder, requisito de nó, opção de carta | 7 |

A v0.3 também herda o que a v0.2 deixar por fazer. Na data deste plano isso inclui: nada publicado, nenhuma decisão confirmada pelo autor, nenhum playtest com outras pessoas (§10 e §11).

### 0.2 O que o jogador vai sentir

**Promessa:** "Tenho uma equipe com nome, mando gente para fora das muralhas, e o que sobra no feudo vira ouro em vez de ir para o chão."

A v0.2 faz o mundo pedir decisões ao senhor do feudo. A v0.3 dá a ele **pessoas**: heróis que custam, se ferem e voltam com histórias. Como na v0.2, a versão só é divertida se cada tensão nova chegar junto com o seu alívio:

| Tensão (o mundo pede) | Alívio (o jogador responde) | Onde |
|---|---|---|
| O ouro passa a ter dono: cada herói cobra soldo a toda hora, e a Taverna troca os candidatos sem esperar por ninguém | Escolher quem contratar e quem dispensar; manter o ouro acima do soldo; a Taverna e o festival segurando a moral | Fase C |
| A equipe some além da muralha: um nó pode ferir ou capturar, e a encruzilhada espera uma resposta | Postura escolhida no envio, equipamento, escolher o caminho, ler o relatório nó a nó, o Resgate | Fase D |
| O estoque enche (o cap da v0.2), o preço muda todo dia e a estrada tem emboscada | Vender o excedente, comprar o que falta para o inverno, caravana com escolta | Fase E |
| O Conselho passa a pedir o que só uma equipe resolve | Opções abertas por um traço de herói, cadeias que nascem de uma expedição, um Mestre que chega para ficar | Fase F |

A jornada de quem joga no ritmo Rápido (3×: um ano em 56 horas reais, um dia de jogo em 40 minutos, uma hora de jogo em 20 minutos), com uma ou duas visitas por dia. As linhas da v0.2 continuam valendo; a tabela mostra só o que a v0.3 acrescenta:

| Hora real | O mundo | O que o jogador decide |
|---:|---|---|
| 0 | **Jogar agora**, como na v0.2 | Alocar, primeira obra, recrutar |
| 8 | **A estrangeira ferida** (dia 13 de jogo): o primeiro herói chega pela carta, sem custo. O soldo começa a sair do ouro: 6 por hora real | Acolher Edda agora, ou cuidar dela e receber Rolf um dia de jogo depois |
| ~10 | Lobos (dia 16), como na v0.2 | Ler o Relatório. A heroína ainda não tem trabalho: falta a Guilda |
| ~16 | **Verão**. O Salão Nv3 abre Taverna, Mercado e Guilda, além da Paliçada | Qual primeiro: a Guilda (dar trabalho a quem já recebe soldo), o Mercado (dar saída ao estoque cheio) ou a Taverna (moral e o segundo herói) |
| ~17 | Guilda Nv1: Patrulha dos Arredores (5 min reais) e Floresta Antiga (20 min) | Enviar a primeira Patrulha e escolher a Postura; ler o relatório nó a nó |
| ~20 | Taverna: dois candidatos, trocados a cada 8 h reais | Contratar (preço à vista mais soldo por hora) ou guardar o ouro para a Paliçada |
| ~24 | Covil dos Lobos: a equipe chega à **encruzilhada** e espera até 6 h reais | Escolher o caminho; sem resposta, a Postura decide. Covil limpo: Ameaça −30 |
| 32 | **Outono**: comida 30% mais cara no Mercado; a colheita enche o Celeiro | Vender a comida que iria para o chão; comprar madeira para a lenha |
| ~36 | Mercado Nv2: caravana a Porto do Rio (1h20 real), 40% a mais | Escoltar com um herói (sem risco, herói ocupado) ou arriscar a emboscada |
| 48 | **Inverno**: o ouro da mina tem de pagar o soldo e o que faltar de lenha | "Antes de partir" diz por quantas horas o ouro paga a equipe; o herói ferido descansa |
| 56 | **Ano 2**: os lobos voltam ao Covil; heróis, itens, Mestres e flags continuam | Rever a equipe e as rotas com o que aprendeu |

As horas são do ritmo 3× e servem para orientar o balanceamento; no ritmo Normal multiplicam-se por 3, menos a espera da encruzilhada, que é de 6 h reais em qualquer ritmo. Nenhuma delas é promessa ao jogador: a página de apresentação continua sem dizer quanto dura um dia ou um ano ([ADR 0011](decisions/0011-ritmo-3x-no-mvp.md)).

**Critérios de diversão de toda entrega** (GDD §15.1, aplicado à v0.3):

- **Custo e benefício lado a lado.** O candidato da Taverna mostra o preço, o soldo por hora real e o que ele permite fazer. O envio de uma expedição mostra duração, risco e o poder da equipe contra o primeiro trecho. A venda mostra o preço do dia, a base e quanto ainda cabe no volume de hoje.
- **Nada obriga a voltar.** A encruzilhada espera 6 h reais e então a Postura decide. A única perda nova por ausência é a que o GDD já prevê: ouro que acaba deixa o soldo em atraso. "Antes de partir" avisa com horas de antecedência (V3F-T3).
- **O resultado ruim ensina a próxima ação.** Um Revés ou um Desastre vem com a frase do porquê e com o que teria mudado o desfecho: a classe que faltou, a Postura, o item.
- **Toda escolha deixa rastro.** A opção da encruzilhada vira uma linha no relatório e na Crônica ("Edda escolheu a Galeria Inundada"), e o herói carrega o que ganhou.
- **Sem opção dominante.** Cada Postura, cada caminho, cada classe e cada destino do excedente (vender hoje, caravana, guardar) é o melhor em algum contexto. O revisor confere grafo a grafo e carta a carta.
- **Sessões de 2 a 10 minutos**, ações a dois cliques ou um comando, nada de coleta manual, nada de prêmio por login.
- **Conteúdo novo aparece pelos pré-requisitos e objetivos**, nunca como botão desligado de uma versão futura.

### 0.3 Estrutura do plano

```
Fase (A…G)  →  Tarefa (V3D-T1)  →  Subtarefa (V3D-T1.3)
```

Os identificadores começam com `V3`. Cada tarefa traz: objetivo, seções do GDD, dependências (inclusive **o que a v0.2 entrega** e ela usa), **decisões** que consome (§9), **trilha** (motor, app ou documentos, §0.4), **entregáveis** (arquivos), subtarefas com caixas de seleção, **diversão** (o que o jogador ganha e como se confere), **verificação** (comandos e resultado esperado), **pronto quando** e um **prompt sugerido** para abrir a sessão.

| Tamanho | Significado |
|---|---|
| `S` | Uma sessão curta do Claude Code |
| `M` | Uma a duas sessões; plano aprovado antes de codar |
| `L` | Duas a quatro sessões; dividir pelas subtarefas, em branch, com merge ao final |

Os tamanhos são complexidade relativa, não prazo. O documento não estima duração total.

| Fase | Entrega jogável | Tarefas |
|---|---|---|
| A — Herança e decisões | Este plano conferido contra o código; linha de base medida; lote 1 de decisões | V3A-T1, V3A-T2 |
| B — Fundação | Sorteio por expedição e por caravana, identidades determinísticas, simulador pronto | V3B-T1 a V3B-T3 |
| C — Heróis e Taverna | Receber o primeiro herói pela carta, pagar soldo, contratar e dispensar | V3C-T1 a V3C-T5 |
| D — Expedições | Enviar uma equipe, decidir na encruzilhada (ou deixar a Postura), ler o relatório | V3D-T0 a V3D-T5 |
| E — Mercado, caravanas e Mestres | Vender o excedente, mandar uma caravana, pôr um Mestre para trabalhar | V3E-T1 a V3E-T5 |
| F — Conselho e objetivos | Uma cadeia que depende da equipe; objetivos 11 a 16; Retorno com a Guilda | V3F-T1 a V3F-T4 |
| G — Versão completa | Um ano de jogo e a virada seguinte; playtest; release | V3G-T1 a V3G-T5 |

A ordem das fases é obrigatória. Dentro de uma fase vale o campo "Depende de". Dentro de C, a ordem recomendada é **C1 → C3 → C2 → C4 → C5**: o primeiro herói chega pela carta antes de existir Taverna, como no GDD §2.2, e o autor sente o soldo antes de poder contratar o segundo.

```
A ──► B ──► C ──► D ──► E ──► F ──► G
│     │     │     │     │     │
│     │     │     │     │     └─ F1 Cartas ─► F2 Objetivos ─► F3 Retorno ─► F4 Revisão
│     │     │     │     └─ E1 Mercado ─► E2 Caravanas ─► E3 Mestres ─► E4 Interface ─► E5 Revisão
│     │     │     └─ D0 Decisões ─► D1 Motor ─► D2 Desfechos ─► D3 Catálogo ─► D4 Interface ─► D5 Revisão
│     │     └─ C1 Heróis e soldo ─► C3 Estrangeira ferida ─► C2 Taverna ─► C4 Interface ─► C5 Revisão
│     └─ B1 Identidades e fluxos ─► B2 Simulador ─► B3 Revisão
└─ A1 Herança e linha de base ─► A2 Decisões
```

### 0.4 Ritual de cada tarefa (uma sessão de agente)

É o do [roadmap da v0.2, §0.4](roadmap-v0.2.md), com o que a v0.2 ensinou (§11):

1. **Abrir a sessão** com o prompt da tarefa (ou o modelo do Apêndice A). O prompt pede para ler `CLAUDE.md`, as seções do GDD indicadas, a tarefa, o Apêndice B e as premissas da §9 que a tarefa consome.
2. **Conferir as decisões.** Se uma decisão que a tarefa consome ainda não tem ADR, o agente **para e pergunta**, com a premissa recomendada da §9 como padrão. Só segue sem resposta se o autor tiver pedido a execução por delegação (§0.6).
3. **Conferir os caminhos marcados com †** (§0.9) antes de planejar: são arquivos da v0.2 que não existiam quando este plano foi escrito.
4. **Plano aprovado antes de codar** em tarefas `M` e `L`. O plano lista arquivos, nomes (eventos, códigos de recusa, campos do `ViewState`), o passo de migração e os testes, nessa ordem.
5. **Testes primeiro** onde houver regra de jogo ou contrato de API. Para o motor: unidade, propriedade de divisão de intervalo e golden; para o servidor: integração; para o app: unidade sem DOM e navegador.
6. **Mostrar a mecânica ao autor cedo.** Em tarefas com interface, a primeira versão funcional (um herói na lista, uma encruzilhada, um preço) é apresentada antes de a tela ficar completa.
7. **Verificação** da tarefa e a comum (§0.9), com a saída colada na conversa.
8. **Fechar:** marcar as caixas, preencher o Registro (§12) com o que foi verificado **e o que não foi**, registrar desvios em `docs/decisions/NNNN-titulo.md`, procurar o que a tarefa tornou falso em `CLAUDE.md`, READMEs e `docs/`, e fazer um commit `V3C-T2: resumo`.
9. **Uma tarefa por sessão.** Contexto limpo produz código melhor.

**Trilhas.** A v0.2 foi implementada por agentes em duas trilhas, cada uma em uma árvore de trabalho (`git worktree`) própria, e funcionou (§11.2). A v0.3 nasce com a divisão escrita em cada tarefa:

| Trilha | Pacotes | Tarefas típicas |
|---|---|---|
| **Motor** | `engine`, `content`, `protocol`, `server`, `sim-cli` | Regra, estado, migração, comando, evento, `ViewState`, integração, bot |
| **App** | `web`, `client-sdk`, `tests/e2e` | Abas, árvore, paleta, avisos, Retorno, testes em navegador |
| **Documentos** | `docs/`, GDD, READMEs | ADRs, inventário de conteúdo, balanceamento, aceitação |

O contrato entre as trilhas é o Apêndice B: a trilha do motor fixa os nomes do `ViewState` e dos comandos **antes** de a trilha do app começar, e o golden da visão (`packages/engine/src/__golden__/`) é o que o app usa nos testes sem DOM. Com um agente só, as trilhas são apenas a ordem do trabalho. Com vários, cada fase termina com uma **integração**: mesclar as trilhas, rodar o portão inteiro (§0.9) no resultado e registrar a linha "V3x (integração)" no §12. `CLAUDE.md` pertence a quem integra, e a integração inclui atualizá-lo (na v0.2 ele ficou para trás).

### 0.5 A regra de toda mecânica nova

Vale para cada tarefa das Fases C a F (GDD §18.3). Uma mecânica só está pronta com:

- **dados em `@lotg/content`**, com schema zod e teste de conteúdo; nenhum número de jogo no motor, no servidor ou no app;
- **passo de migração** (`packages/engine/src/migrations/v<N>.ts`) quando a forma do estado muda, com a fronteira do passo (`context.boundaryMs`) como origem de todo prazo que ele cria, e retratos congelados da versão anterior;
- **comando validado** no motor, com código de recusa em `REJECTION_CODES` (motor **e** protocolo, que têm teste de igualdade de tipos) e frase legível em português;
- **evento na Crônica**, com o tipo em `EVENT_TYPES` e o modelo de frase em `chronicleTemplates` (`packages/content/src/chronicle.ts`);
- **explicação do número** no `ViewState` (o `breakdown` que o jogador lê ao perguntar "por que este valor?"), calculada no motor, já em tempo real quando for prazo ou taxa;
- **teste**: unidade do instante exato, propriedade de divisão de intervalo ainda exata (estado, eventos **e** fluxos de sorteio, inclusive os que nascem e morrem no caminho), golden regravado de propósito com `UPDATE_GOLDEN=1` e diff conferido, um ritmo diferente de 1, e um teste em navegador quando houver interface;
- **política no bot do simulador** que usa a mecânica só com o `ViewState` (ou um registro de por que não usa);
- **GDD atualizado** se a regra mudou, no mesmo commit.

### 0.6 O que o agente não decide, e como as decisões se fecham

Tudo o que está na §9, qualquer desvio do GDD, qualquer dependência nova, quem participa do playtest, quando publicar. Onde o GDD é vago, a tarefa traz a pergunta e a §9 traz a **premissa recomendada**; a resposta do autor vira ADR ou correção do GDD antes do código.

As decisões fecham em **dois lotes**, cada um em uma sessão própria:

| Lote | Tarefa | Decisões | Resultado |
|---|---|---|---|
| 1 — Heróis, Taverna e fundação | V3A-T2 | 1 a 10 | **novo** `docs/decisions/0015-regras-da-v0.3-herois-taverna-e-soldo.md` |
| 2 — Expedições, Mercado, Mestres e cartas | V3D-T0 | 11 a 21 | **novo** `docs/decisions/0016-expedicoes-mercado-mestres-e-cartas-na-v0.3.md` |

As decisões 22, 23 e 24 são atos do autor e não bloqueiam tarefa nenhuma, com uma exceção: a 23 (operação) bloqueia a chegada de qualquer migração de estado à produção.

**Se o autor não estiver.** Na v0.2 as duas sessões não aconteceram: o autor pediu a versão inteira sem ele, e as premissas foram aplicadas por delegação. Isso só vale quando ele pede. Se pedir de novo, o procedimento é o que a v0.2 usou e que funcionou: aplicar a premissa recomendada, registrar o ADR com o estado "aplicada por delegação; aguarda confirmação", escrever uma linha por decisão em **novo** `docs/pendencias-v0.3.md` e não publicar nada. O agente não preenche a resposta do autor por suposição em nenhum outro caso, nem pergunta de novo o que já está registrado.

### 0.7 Contratos transversais de implementação

Os onze contratos da [§0.7 do roadmap da v0.2](roadmap-v0.2.md) continuam valendo. A tabela diz o que a v0.3 acrescenta a cada um e traz três contratos novos. As decisões de **regra** ficam na §9.

| Contrato | O que a v0.3 acrescenta |
|---|---|
| **Relógios explícitos** | Segunda constante de tempo real do jogo: a espera da encruzilhada (`crossroadsWaitRealMs`, 6 h), convertida com `settings.timeScale` no instante em que a equipe chega ao nó, como a expiração da carta. Todo o resto é tempo de jogo e termina em `Ms`: soldo, atraso, ferimento, rotação da Taverna, festival, duração dos nós, viagem da caravana, dia do Mercado (premissa 1) |
| **Fronteira da atualização** | Cada passo de migração da v0.3 conta os seus prazos de `context.boundaryMs`, nunca de `state.migratedAtMs`: a primeira rotação da Taverna, a carta da estrangeira em partidas que já passaram do dia 13, o primeiro preço do Mercado. O que o passo decide fica gravado no campo que ele criou ([README do motor](../packages/engine/README.md), "A fronteira é de cada passo") |
| **Eventos no mesmo instante** | A ordem fixa de `processEventsAt` ([ADR 0013](decisions/0013-regras-da-v0.2-tempo-ritmo-migracao-e-economia.md)) ganha os passos da v0.3. Proposta, a confirmar em cada tarefa: obras concluídas → aldeões e Mestres que chegam → ano → estação → dia (experiência do ofício, moral, sorteios da moral, **preços e volume do Mercado**, Conselho, Ameaça) → cartas que expiram e continuações → incursões → feridos que se recuperam → **heróis que se recuperam** → **rotação da Taverna** → **nós de expedição que terminam e prazos de encruzilhada**, por ordem de identificador da expedição → **caravanas que chegam**, por ordem de identificador → fim de adaptação → início automático → objetivos → fome, frio e **soldo em atraso** |
| **Simulação que termina** | Grafos de expedição são acíclicos e têm saída (teste de conteúdo); o soldo em atraso abre e fecha em instantes exatos sem oscilar quando ouro chega e sai no mesmo instante; o Mercado não tem ordem automática, então não encadeia |
| **Consistência numérica** | Atributos, poder, dificuldade, preço e experiência em inteiros; fatores em `{ num, den }`; **um arredondamento para baixo no fim** de cada conta (ADR 0013, 13a); comparações por multiplicação cruzada, sem divisão (premissa 7). O preço é guardado em milésimos de ouro por unidade |
| **Reenvio de comando** | Contratar, dispensar, enviar expedição, escolher caminho, equipar, negociar e enviar caravana passam pelo recibo transacional de `packages/server/src/games/commands.ts`. Duplo clique e duas abas não contratam, não vendem e não enviam duas vezes |
| **Visão e privacidade narrativa** | Nunca saem do servidor: a dificuldade e o conteúdo dos nós depois de uma encruzilhada ainda não alcançada, o estado dos fluxos de sorteio, os candidatos da próxima rotação, o preço de amanhã, o desfecho de uma caravana antes da chegada, efeitos ocultos de carta. O nome de uma flag e o identificador de um nó não são texto de interface |
| **Compatibilidade** | O `ViewState` cresce por adição. Se `pendingDecisions` for uma união fechada no protocolo 2 (conferir em V3A-T1), a encruzilhada como decisão pendente quebra o parse do app antigo: nessa tarefa (V3D-T1) o `protocol` passa a **3** e o servidor responde `426 UPGRADE_REQUIRED` a um cliente anterior. Recibos antigos nunca são reescritos; o cache local de outra versão é descartado, mas o cursor e a última visita continuam valendo (§11.1, lição 10) |
| **Relatório confiável** | O relatório de expedição é montado no motor, nó a nó, e viaja no estado e na visão enquanto a expedição existe e por um número limitado de relatórios depois. O Retorno agrupa eventos com totais vindos do motor; soldo pago e ouro de venda não são "produção" |
| **Conteúdo como dados** | Classes, traços, nomes, modelos de candidato, itens, grafos, preços-base e textos de nó em `content`, com identificadores estáveis. O teste de conteúdo confere: grafo acíclico e com saída, três variantes por modelo, toda encruzilhada com a opção de cada Postura, a da Cautelosa sem requisito, todo nó com desfecho de Desastre marcado |
| **Descoberta gradual** | Taverna, Mercado e Guilda aparecem com o Salão Nv3 e um objetivo que os explica. Um destino de expedição só aparece quando foi descoberto. Nada da v0.4 aparece, nem desligado |
| **Bot honesto** | As políticas novas (contratar, enviar, escolher caminho, vender, caravana) leem só o `ViewState`. O teste que barra `@lotg/content` em `packages/sim-cli/src/bots` continua valendo |
| **Entidades com identidade** (novo) | Herói, expedição, item, caravana e Mestre têm identificador gerado por **contador no estado** (`ids`), nunca por relógio, UUID ou sorteio. Quando duas entidades agem no mesmo instante, a ordem é a do identificador |
| **Estado de tamanho limitado** (novo) | Toda lista nova tem teto vindo do conteúdo: heróis, ofertas, expedições, relatórios guardados, itens, caravanas, Mestres. Um fluxo de sorteio de entidade é apagado quando a entidade termina. O tamanho do estado e do `ViewState` é medido em V3A-T1 e de novo a cada fase |
| **Pacote do app sem números** (novo) | Os schemas do protocolo validam só a forma e não leem `@lotg/content` em tempo de execução; quem confere um identificador contra o conteúdo é o servidor. `packages/web/src/bundle.test.ts` continua falhando se o pacote levar um número de regra ou uma frase do conteúdo (§11.1, lição 7) |

### 0.8 Como a v0.3 chega à produção

Na data deste plano a v0.2 está inteira no `main` **local**, sem `push`, e a produção roda a `v0.1.0`. A primeira publicação da v0.2 vai em dois passos ([deploy/README.md](../deploy/README.md), "A primeira publicação da v0.2 vai em dois passos"), e é ato do autor.

**Premissa recomendada (decisão 2):**

- **A v0.3 só sobe a versão do estado depois de a v0.2 estar publicada e migrada.** Empilhar versões de estado que nunca foram à produção repete o problema que a v0.2 criou: a produção saltaria várias versões de uma vez, sem imagem de reversão que as entenda. A Fase A não muda o estado e pode começar antes.
- **Fases A e B:** cada tarefa é um commit no `main`. A Fase B sobe a versão do estado sem mudar regra (entram só os contadores de identidade), e por isso pode ser publicada sozinha.
- **Fases C a F:** cada fase vive em um branch (`v3c-herois`, `v3d-expedicoes`, `v3e-mercado`, `v3f-conselho`) aberto como *pull request* desde o primeiro commit. O autor joga a fase no computador dele (`pnpm dev:up`, `pnpm dev:api`, `pnpm dev:web`) e ela é mesclada no `main`, e portanto publicada, **quando ele jogou e aprovou**.
- **Fase G:** no `main`.
- **Todo deploy que sobe a versão do estado** segue "Antes de um deploy que sobe a versão do estado" do `deploy/README.md`: backup conferido, cópia fora do servidor, SHA anotado. A partir da V2B-T1 a imagem anterior **recusa** um estado de versão futura com `500` e não grava nada: a janela da troca de contêiner vira um erro passageiro, não corrupção. Conferir em V3A-T1 que a imagem no ar já é dessa geração.

Se o autor pedir de novo tudo no `main` local sem `push`, vale o pedido, e a consequência fica escrita em `docs/pendencias-v0.3.md`: a publicação seguinte volta a ser em passos, um por fase que sobe o estado.

O `main` continua sempre verde. "Um commit por tarefa" vale dentro do branch de fase. Uma correção de revisão é um commit por defeito, com o defeito no título, como a v0.2 fez na Fase B.

### 0.9 Verificação comum

Toda tarefa herda esta verificação, além dos cenários específicos:

```bash
pnpm verify
# Se tocar servidor, persistência ou contrato HTTP (primeiro: pnpm dev:up):
TEST_DATABASE_URL=postgres://lotg:lotg@localhost:5433/lotg_test pnpm test:integration
# Um arquivo só: o filtro vai SEM "--" (com "--" o Vitest ignora o filtro e roda tudo)
TEST_DATABASE_URL=postgres://lotg:lotg@localhost:5433/lotg_test pnpm test:integration games
# Se tocar o app; depois da integração, nunca ao mesmo tempo (dividem o db_test):
pnpm test:e2e
# Se a aba Feudo, a barra de status ou o modo discreto mudarem de aparência:
pnpm capture:landing && pnpm test:e2e:landing
# Se tocar o motor ou o conteúdo: o simulador continua honesto e dentro das faixas
pnpm --filter @lotg/sim-cli test
# Se tocar documentos: o Prettier NÃO confere Markdown (.prettierignore tem *.md);
# links e âncoras são conferidos por script, e a renderização, a olho
pnpm exec prettier --check docs
```

As suítes que usam o banco apagam dados: só `db_test`, nunca a URL de produção. Sem `TEST_DATABASE_URL` a suíte de integração passa vazia e não prova nada. Cada tarefa registra no §12: commit, decisões aplicadas, comandos executados, resultado, cenário jogado pelo autor e o que não foi verificado.

**Marcas nos caminhos de arquivo:**

- **novo**: entregável da tarefa; o arquivo não existe.
- **†**: arquivo que a v0.2 previa (roadmap da v0.2, Apêndice B e entregáveis das Fases C a E) e que **não existia na árvore em que este plano foi escrito** (commit `e3d478e`). **Conferir no código ao abrir a v0.3**: o nome, o lugar e a forma podem ter mudado. V3A-T1 substitui cada † pelo caminho encontrado.
- Sem marca: o arquivo existia em `e3d478e`.

As subtarefas descrevem comportamento a provar e propõem nomes (Apêndice B); a tarefa pode mudar um nome, desde que atualize o apêndice.

---

## 1. Fase A — Herança e decisões

**Meta da fase:** antes de qualquer código da v0.3, saber o que a v0.2 entregou de verdade, medir de onde se parte e fechar com o autor as decisões que travam as Fases B e C.

Por que primeiro: este plano foi escrito com a v0.2 pela metade (§11). Ele descreve estações, caps, moral, Conselho e Ameaça pelo que os ADRs 0013 e 0014 decidiram, e cita arquivos que ainda não existiam. Uma tarefa que partisse dele sem conferir construiria sobre nomes errados.

### V3A-T1 · Conferência da herança da v0.2 e linha de base `M`

**Esta é a primeira tarefa da v0.3.** Está detalhada para abrir a sessão seguinte sem outra preparação.

**Objetivo:** corrigir este roadmap contra o código da v0.2, medir a linha de base da v0.3 e abrir a caixa de entrada do autor.
**GDD:** §14.3, §14.11, §15.2 a §15.4, §16.2.
**Depende de:** as Fases C a E da v0.2 no `main`, com o portão verde. O ideal é a v0.2 fechada (V2F-T4); se não estiver, a tarefa roda assim mesmo e registra o que falta.
**Decisões:** nenhuma. A tarefa não muda regra nem código de jogo. Ela só **registra** o estado da decisão 22 (confirmações pendentes da v0.2).
**Trilha:** documentos.

**Arquivos:**

| Arquivo | O que a tarefa faz |
|---|---|
| `docs/roadmap-v0.3.md` (este) | Troca cada † pelo caminho encontrado; corrige o Apêndice B.0 (o que a v0.2 entregou); preenche §11.3; revisa §10; preenche a linha V3A-T1 do §12 |
| **novo** `docs/balance-v0.3.md` | Seção 1: linha de base da v0.2 (simulador, tamanhos, custo do avanço), no formato de [balance-v0.2.md](balance-v0.2.md) |
| **novo** `docs/pendencias-v0.3.md` | Caixa de entrada do autor, no formato de [pendencias-v0.2.md](pendencias-v0.2.md): o que continua pendente da v0.2, as decisões 1 a 21 deste roadmap como "a decidir" e os atos 22 a 24 do autor |
| `packages/` | **Nada.** Se a conferência achar um defeito, ele vira achado no Registro e uma tarefa de correção, não uma mudança escondida aqui |

**Subtarefas:**

- [ ] V3A-T1.1 **Onde estamos.** `git status`, `git log --oneline -40`, `git tag`, `git worktree list`. Anotar: commit de partida, se as trilhas da v0.2 foram mescladas, se a v0.2 foi publicada (os dois passos de `deploy/README.md`) e o que a produção responde em `curl -s https://lords.palsincomehub.com/v1/version`. O agente não tem acesso ao banco de produção: o que depender dele fica como pergunta ao autor.
- [ ] V3A-T1.2 **Os números de versão.** Anotar `CURRENT_SCHEMA_VERSION` (`packages/engine/src/migrations.ts`; era 2 em `e3d478e`), a tabela de versões do [README do motor](../packages/engine/README.md), `PROTOCOL_VERSION` (`packages/protocol/src/index.ts`; era 1, a v0.2 previa 2), `RNG_VERSION` e `RNG_STREAMS` (`packages/engine/src/random.ts`), `CONTENT_VERSION` e o `contentHash` de `GET /v1/version` em desenvolvimento.
- [ ] V3A-T1.3 **Os caminhos marcados com †.** Para cada um (lista no Apêndice B.0), dizer: existe com esse nome; existe com outro nome ou em outro lugar; não existe e a mecânica mora em outro arquivo; a mecânica não foi entregue. Corrigir o caminho em todas as tarefas que o citam.
- [ ] V3A-T1.4 **Os contratos que a v0.3 usa.** Conferir no código, um a um, e corrigir o Apêndice B.0:
  - a ordem real de `processEventsAt` (`packages/engine/src/advance.ts`) contra a do ADR 0013;
  - a forma de `council` no estado: `pending`, `flags`, `seenThisYear`, `nextDrawAtMs`, `scheduled`, `effects`; como nasce o `instanceId` de uma carta (contador, instante ou derivado); se existe um teste com carta `scripted`, que o ADR 0014 diz que o motor aceita e o catálogo não usa;
  - o termo de efeitos temporários na moral: nome do campo, unidade da duração, como aparece em `morale.terms`;
  - `map.tiles`, `map.threat` e `horde.scheduledRaids`: nomes, e se um tile pode ficar inativo;
  - `pendingDecisions` no protocolo (`packages/protocol/src/view.ts`): união fechada por `kind` ou lista aberta. Disso depende o protocolo 3 (§0.7);
  - o corpo de `GET /v1/catalog` (`packages/server/src/catalog.ts`);
  - os tipos de `Effect` e de `requires` que as cartas aceitam, e o teste de conteúdo que proíbe herói, Mercado, ferro, exército e combate nas cartas (V3C-T3 e V3F-T1 vão afrouxá-lo de propósito);
  - os níveis máximos de Torre de Vigia e Paliçada, de que a caravana depende (premissa 17);
  - `beforeLeaving` e `ReturnReport.blocks` no app, que V3F-T3 estende;
  - as políticas e as colunas do simulador (`packages/sim-cli/src/bots/policies.ts`, `report.ts`).
- [ ] V3A-T1.5 **Os retratos de estado.** Listar os cenários de `packages/engine/src/fixtures.test.ts` da versão atual. O próximo passo de migração tem de encontrar o que estará em produção: os três ritmos, as três dificuldades, fronteira antiga, carta pendente, continuação agendada, efeito de moral em curso, incursão marcada, ferido, planejada automática, frio e estoque acima do cap. O que faltar vira a primeira subtarefa de V3B-T1, **antes** de subir a versão (README do motor, "Uma mecânica que muda o estado sobe a versão", passo 1).
- [ ] V3A-T1.6 **O portão.** Rodar a verificação comum inteira (§0.9) no commit de partida e anotar as contagens de testes. A integração da Fase B da v0.2 registrou 1.613 testes de unidade, 358 de integração e 56 em navegador: servem de comparação.
- [ ] V3A-T1.7 **Linha de base do simulador.** `pnpm -s sim -- --matrix > matriz.csv 2> matriz.md` e duas partidas de exemplo (Regular e Preguiçoso no ritmo 3). Registrar em `docs/balance-v0.3.md`, seção 1: data, commit, identificação (motor, versão do estado, `contentHash`), máquina, comando e a saída como veio. Dizer se as 50 sementes já dão resultados diferentes (na Fase B da v0.2 davam o mesmo, porque nada sorteava).
- [ ] V3A-T1.8 **Linha de base de tamanho e custo.** No cenário de um ano de jogo no ritmo 3: bytes do `GameState` e do `ViewState` em JSON, e o tempo de `advanceTo` para 1, 7 e 30 dias reais de ausência. A v0.3 acrescenta heróis, expedições, relatórios, itens e preços ao estado e à visão, e cada recibo de comando guarda a visão inteira ([perf-v0.1.md](perf-v0.1.md)): estes números são a régua do contrato "estado de tamanho limitado" (§0.7).
- [ ] V3A-T1.9 **Lições.** Preencher a §11.3 a partir de: `docs/pendencias-v0.2.md` (seções 4 e 5, que na data deste plano estavam vazias), o Registro do roadmap da v0.2 (§11), `docs/balance-v0.2.md`, o relatório das revisões por fase e, se existirem, `docs/playtest/relatorio-v0.1.md` e `relatorio-v0.2.md`. **Se não houve playtest, escrever que não houve**, e manter a §11.4 como está.
- [ ] V3A-T1.10 **Dívidas.** Passar pela §10 linha a linha: resolvida (com o commit), continua, ou nova.
- [ ] V3A-T1.11 **Caixa de entrada do autor.** Criar `docs/pendencias-v0.3.md` com: (1) o mais importante, em cinco linhas; (2) as confirmações da v0.2 que continuam abertas; (3) o que só o autor pode fazer (publicar, backup externo, ensaio de reversão, playtest); (4) as decisões 1 a 21 deste roadmap, uma linha cada, com a premissa.
- [ ] V3A-T1.12 **`CLAUDE.md`.** Listar o que ficou falso nele (na integração da Fase B da v0.2: versão do GDD, API pública do motor sem `migrateState`, "ainda não existe gerador", `GAME_TIME_SCALE` como ritmo de toda partida, o filtro de integração com `--`). Quem integra a fase atualiza; esta tarefa só entrega a lista.

**Testes:** nenhum teste novo, porque nenhum código muda. O que a tarefa roda: a verificação comum inteira; a matriz do simulador; e um roteiro descartável que confere links e âncoras dos três documentos tocados (o Prettier não confere Markdown).

**Impacto em partidas antigas:** nenhum. A tarefa não sobe `schemaVersion`, não toca `content` e não publica. Ela deixa escrito **em que versão de estado a produção está** e quais versões o próximo deploy atravessaria, que é o que V3B-T1 precisa saber antes de criar o primeiro passo de migração da v0.3.

**Evidência de conclusão:** (1) nenhum † resta neste documento; (2) o Apêndice B.0 diz "conferido em <data>, commit <sha>"; (3) `docs/balance-v0.3.md` tem a seção 1 com comandos e saídas; (4) `docs/pendencias-v0.3.md` existe; (5) a §11.3 está preenchida ou diz por que não pôde ser; (6) a linha V3A-T1 do §12 traz as contagens do portão e o que não foi verificado.

**Diversão:** nenhuma diretamente. É o que impede a v0.3 de construir sobre um nome que mudou, e é a régua para dizer, no fim, se a Guilda deu o que fazer com o ouro e com o estoque parado.

**Verificação:**

```bash
pnpm dev:up
pnpm verify
TEST_DATABASE_URL=postgres://lotg:lotg@localhost:5433/lotg_test pnpm test:integration
pnpm build
pnpm test:e2e
pnpm -s sim -- --matrix > matriz.csv 2> matriz.md
pnpm -s sim -- --seed pedra-alta-001 --game-year --time-scale 3 --sessions-per-day 2 > /dev/null
grep -c '†' docs/roadmap-v0.3.md    # esperado ao fim: só as ocorrências da legenda (§0.9) e desta linha
```

**Pronto quando:** as seis evidências acima existem, o portão está verde no commit de partida (ou cada falha está registrada com o motivo) e o autor tem em `docs/pendencias-v0.3.md` uma página que diz o que decidir primeiro.

**Prompt sugerido:** "Leia CLAUDE.md, docs/roadmap-v0.3.md (§0, V3A-T1, §10, §11 e Apêndice B), docs/roadmap-v0.2.md §11, docs/pendencias-v0.2.md e packages/engine/README.md. Esta tarefa não muda código: confira no repositório cada caminho marcado com † e cada contrato de V3A-T1.4, corrija o roadmap, rode o portão e a matriz do simulador, registre a linha de base em docs/balance-v0.3.md e crie docs/pendencias-v0.3.md. Me mostre primeiro a tabela 'previsto e encontrado'. Se não houve playtest, escreva que não houve."

### V3A-T2 · Sessão de decisões, lote 1 → ADR 0015 `S`

**Objetivo:** fechar com o autor as decisões que travam as Fases B e C e registrá-las.
**Depende de:** V3A-T1 (a sessão usa os números da linha de base e as confirmações da v0.2).
**Decisões:** 1 a 10.
**Trilha:** documentos.
**Entregáveis:** **novo** `docs/decisions/0015-regras-da-v0.3-herois-taverna-e-soldo.md`; GDD §5.7 (termos da Taverna e do festival), §6.1 (Taverna), §7.1 (carta roteirizada), §9.1 e §12.1 corrigidos onde a resposta mudar um número ou uma frase; linha em `docs/decisions/README.md`; §9 deste roadmap com a coluna "Registro".

- [ ] V3A-T2.1 Apresentar cada decisão do lote com a premissa da §9, a alternativa e o que muda no jogo; uma pergunta por vez, com a recomendação como padrão ("se não disser nada, fica assim").
- [ ] V3A-T2.2 Antes das decisões novas, passar pela decisão 22: uma confirmação da v0.2 que o autor trocar pode mudar uma premissa daqui (por exemplo, os ritmos oferecidos mudam as conversões da premissa 1).
- [ ] V3A-T2.3 Escrever o ADR com a tabela decisão, o que foi aplicado, alternativa descartada, razão, tarefas e seção do GDD, no formato do ADR 0013. Estado `aprovada` só com resposta do autor; por delegação, o estado diz isso (§0.6).
- [ ] V3A-T2.4 Corrigir o GDD e subir a versão do documento; onde o GDD diz "12 h" ou "24 h" sem dizer de quê, escrever "de jogo" ou "reais".
- [ ] V3A-T2.5 Propor, para aprovação, os números que o GDD não tem e a Fase C precisa: atributos-base das quatro classes e o preço de cada modelo de candidato (decisões 4 e 7). São conteúdo, e ficam no ADR como tabela.

**Verificação:** links do ADR e do GDD conferidos por script; `pnpm lint`.

**Pronto quando:** o ADR 0015 existe e nenhuma tarefa de B ou C tem decisão aberta sem resposta.

**Prompt sugerido:** "Leia CLAUDE.md, docs/roadmap-v0.3.md §9 e §0.6, docs/pendencias-v0.3.md e GAME_DESIGN.md §9.1, §5.7, §6.1 e §12.1. Vamos fechar o lote 1: primeiro as confirmações pendentes da v0.2, depois as decisões 1 a 10, uma por vez, com a sua recomendação como padrão. Registre em docs/decisions/0015-…md, corrija o GDD onde a resposta mudar uma frase e atualize a §9 do roadmap."

---

## 2. Fase B — Fundação da Guilda

**Meta da fase:** o que a v0.3 precisa ter no lugar antes da primeira mecânica. Nenhuma tarefa acrescenta regra de jogo; cada uma diz por que não pode esperar. A fase sobe a versão do estado sem mudar comportamento e pode ser publicada sozinha (§0.8).

### V3B-T1 · Identidades determinísticas e sorteio por entidade `M`

**Objetivo:** o motor consegue dar um identificador estável a uma entidade nova e sortear em um fluxo que pertence só a ela, sem que a ordem de processamento ou a divisão do intervalo mude o resultado.
**Por que antes:** a v0.3 é a primeira versão com entidades que nascem e morrem durante a partida (heróis, expedições, itens, caravanas). O GDD §14.3 prevê os fluxos `expedition:<id>` e `market`, mas `RNG_STREAMS` é uma lista fechada de três nomes (`council`, `morale`, `horde`), e nada no estado gera identificadores.
**GDD:** §14.3 (itens 1 e 3), §14.11.
**Depende de:** V3A-T2 (decisão 9). **Da v0.2 usa:** o gerador com fluxos nomeados (V2B-T2) e a migração por `schemaVersion` (V2B-T1).
**Decisões:** 9.
**Trilha:** motor.
**Entregáveis:** `packages/engine/src/random.ts` (famílias de fluxo e `dropStream`), **novo** `packages/engine/src/ids.ts` (`nextId`), `types.ts`, `state.ts`, `migrations.ts`, **novo** `migrations/v<N+1>.ts` e o passo em `migrations/v<N>.ts`, `migrations/shape.ts` (chaves de `rng`), `test-helpers.ts`, `random.property.test.ts`, `fixtures.test.ts`, `purity.test.ts`; [README do motor](../packages/engine/README.md); GDD §14.11.

- [ ] V3B-T1.1 Retratos que faltarem (V3A-T1.5): acrescentar os cenários a `fixtures.test.ts` **antes** de subir a versão, para que os arquivos congelados da versão anterior exercitem o que a v0.2 deixa no estado.
- [ ] V3B-T1.2 Identidades: `nextId(draft, kind)` devolve `<kind>-<n>` a partir de um contador em `state.ids` (`Record<string, number>`, vazio até o primeiro uso, como `rng`). Só comandos e eventos da linha do tempo criam entidades; `deriveViewState` e `nextEventAt` nunca. Se a v0.2 já tiver um contador para o `instanceId` das cartas (V3A-T1.4), generalizar aquele em vez de criar outro.
- [ ] V3B-T1.3 Famílias de fluxo: além dos nomes fixos, `random.ts` aceita `expedition:<id>` e `caravan:<id>` (lista `RNG_STREAM_FAMILIES`). A semente continua sendo o FNV-1a de `seed + ':' + nome`, então dois envios com identificadores diferentes sorteiam sequências independentes. Um nome fora da lista e das famílias lança erro: é defeito de código.
- [ ] V3B-T1.4 Fim de vida: `dropStream(draft, nome)` apaga o fluxo quando a entidade termina. Um identificador nunca é reutilizado (o contador só sobe), então um fluxo apagado não renasce com a mesma sequência.
- [ ] V3B-T1.5 Forma: a guarda de `rng` em `migrations/shape.ts` passa a conferir as chaves (nome fixo ou família conhecida) e os quatro inteiros de 32 bits de cada fluxo. O passo de migração acrescenta `ids: {}` e não muda mais nada. `RNG_VERSION` não muda: o algoritmo é o mesmo.
- [ ] V3B-T1.6 Propriedade: um cenário sintético em `test-helpers.ts` (fora da API pública) cria entidades em instantes marcados, sorteia nos fluxos delas e as encerra. A divisão de intervalo continua exata com fluxos nascendo e morrendo no caminho, e criar uma terceira entidade entre duas não desloca os sorteios das duas.
- [ ] V3B-T1.7 Documentar no README do motor: a tabela de versões, "Sorteios" (famílias, fim de vida) e "Identidades".

**Diversão:** indireta. É o que faz "a mesma semente dá o mesmo relatório de expedição" (GDD §15.4, golden) e impede que mandar uma segunda equipe mude a sorte da primeira.

**Verificação:**

```bash
pnpm --filter @lotg/engine test -- random
pnpm --filter @lotg/engine test -- migrations fixtures
pnpm --filter @lotg/engine test -- purity
TEST_DATABASE_URL=postgres://lotg:lotg@localhost:5433/lotg_test pnpm test:integration games-migration
```

Esperado: os retratos da versão anterior migram, avançam 30 dias e aceitam ordens; a propriedade vale com fluxos de entidade; a integração carrega uma linha gravada na versão anterior e a persiste na nova, uma vez.

**Pronto quando:** identificadores e fluxos por entidade existem, com propriedade e migração provadas, e nenhuma regra de jogo mudou (o golden do cenário de 7 dias só ganha o campo `ids`).

**Prompt sugerido:** "Leia CLAUDE.md, GAME_DESIGN.md §14.3, docs/decisions/0015-…md, docs/roadmap-v0.3.md V3B-T1 e packages/engine/README.md (Sorteios e Versões do estado). Apresente o plano (retratos que faltam, contador de identidades, famílias de fluxo, fim de vida, guarda de forma, passo de migração) e espere aprovação. Propriedade com fluxos que nascem e morrem antes do código."

### V3B-T2 · Simulador pronto para a Guilda `S`

**Objetivo:** o simulador tem o perfil `explorador` do GDD §15.3, as colunas que as Fases C a E vão preencher e a matriz lendo o que agora varia por semente.
**Por que antes:** na v0.2 o simulador avisou do excedente parado antes de qualquer pessoa. Na v0.3 ele precisa avisar de três coisas novas: ouro que não paga o soldo, equipe parada e Mercado sem uso.
**GDD:** §15.2 ("primeiro herói no dia 2"), §15.3.
**Depende de:** V3B-T1. **Da v0.2 usa:** bots como listas de políticas e a matriz por ritmo (V2B-T4).
**Trilha:** motor.
**Entregáveis:** **novo** `packages/sim-cli/src/bots/explorador.ts`; `bots/index.ts`, `bots/policies.ts`, `report.ts`, `matrix.ts`, `bands.ts`, `cli.ts`; `packages/sim-cli/README.md`; `docs/balance-v0.3.md` (seção 2).

- [ ] V3B-T2.1 Bot `explorador`: as políticas do `economico` mais as que as Fases C a E trarão. Nesta tarefa ele é igual ao `economico`, e um teste confere isso; cada mecânica acrescenta a sua política (§0.5).
- [ ] V3B-T2.2 Colunas reservadas, vazias até a mecânica existir: heróis, soldo pago, horas de soldo em atraso, heróis que partiram, expedições enviadas e desfechos por tipo, encruzilhadas decididas pelo jogador e pela Postura, horas de herói ocioso, unidades negociadas por recurso e parcela do volume diário usada, caravanas enviadas e emboscadas, Mestres.
- [ ] V3B-T2.3 Matriz: cada célula mostra o menor e o maior valor entre as 50 sementes. Com a v0.2 inteira as sementes passam a divergir (moral, Conselho e Ameaça sorteiam); registrar a dispersão medida.
- [ ] V3B-T2.4 Faixas: nenhuma nova nesta tarefa. As da v0.2 continuam valendo, e um teste confere que a Fase B não mudou nenhum número medido.

**Diversão:** o simulador é o detector de tédio e de desespero. Herói ocioso por horas e ouro zerado pelo soldo são os dois sinais novos.

**Verificação:**

```bash
pnpm --filter @lotg/sim-cli test
pnpm -s sim -- --seed pedra-alta-001 --game-year --time-scale 3 --strategy explorador > /dev/null
```

**Pronto quando:** o perfil `explorador` roda na matriz, as colunas reservadas saem no CSV e nenhum número medido da v0.2 mudou.

**Prompt sugerido:** "Leia CLAUDE.md, GAME_DESIGN.md §15.2 e §15.3, docs/roadmap-v0.3.md V3B-T2 e packages/sim-cli/README.md. Crie o bot explorador como lista de políticas, reserve as colunas da v0.3 e registre a dispersão por semente em docs/balance-v0.3.md. Não mude nenhum número de conteúdo."

### V3B-T3 · Revisão independente da fundação `S`

**Objetivo:** revisão de leitura, por um agente que não escreveu o código, de V3B-T1 e V3B-T2.
**Por que antes:** na v0.2, a revisão da fundação achou dez defeitos depois de todos os portões verdes, e ao menos dois deles estragariam partidas em produção: o estado da versão atual, que nunca era conferido, e o procedimento de publicação (§11.1, lições 2, 3 e 5).
**Depende de:** V3B-T1, V3B-T2.
**Entregáveis:** relatório da revisão ligado no Registro; correções, um commit por defeito, cada uma com teste de regressão.

- [ ] V3B-T3.1 Revisor independente (Apêndice A.4) sobre os commits da fase, sem aceitar teste verde como prova.
- [ ] V3B-T3.2 Tenta: identificador repetido depois de salvar e recarregar; fluxo de entidade que sobrevive à entidade; fluxo apagado e recriado; chave estranha em `rng` aceita pela guarda; migração de uma partida com fluxos da v0.2 já em uso; passo de migração rodando junto com os da v0.2 em uma partida que pulou publicações.
- [ ] V3B-T3.3 Confirma que o bot `explorador` não importa nada de `@lotg/content` e que o pacote do app continua sem números do jogo.
- [ ] V3B-T3.4 Classifica cada achado; corrige os confirmados; registra no §12 os cenários que não foram executados.

**Pronto quando:** cada defeito confirmado tem teste e correção, e o que ficou sem correção está no Registro com o motivo.

**Prompt sugerido:** "Leia CLAUDE.md e docs/roadmap-v0.3.md V3B-T3. Lance um subagente revisor com o prompt do Apêndice A.4 sobre os commits de V3B-T1 e V3B-T2; depois corrija cada defeito confirmado em um commit próprio, com teste de regressão, e me mostre o relatório."

---

## 3. Fase C — Heróis e Taverna

**Meta da fase:** o feudo tem heróis: o primeiro chega pela carta, cada um cobra soldo, e a Taverna oferece outros. Critério 1 da §16.2. Branch `v3c-herois` (§0.8).

Cada tarefa segue a regra da §0.5. A ordem recomendada é **C1 → C3 → C2 → C4 → C5**. O que o autor deve conseguir fazer ao fim da fase: receber a estrangeira ferida, ver o ouro pagando o soldo, contratar um segundo herói na Taverna, ficar sem ouro de propósito e entender, pela tela, o que acontece e em quanto tempo.

Nesta fase os heróis ainda não têm o que fazer: as expedições são da Fase D. Isso é intencional e curto. O soldo sem trabalho é a tensão que faz a Guilda ser a obra seguinte.

### V3C-T1 · Heróis no feudo: modelo, soldo e atraso `L`

**Objetivo:** o herói como entidade do estado, com classe, nível, traços e atributos derivados; o soldo como consumo contínuo de ouro; e o atraso do soldo com as suas consequências em instantes exatos.
**GDD:** §5.1 (ouro paga soldos), §9.1, §12.1 (linha "Heróis podem morrer", só o que esta tarefa usa), §13.3 ("soldos de heróis: −6/h incluídos"), §14.11 (`guild`), Apêndice D.
**Depende de:** V3B-T3. **Da v0.2 usa:** a conta única da produção em frações (ADR 0013, 13a), o modelo de consumo contínuo com instante exato de esgotamento (fome e lenha), a ordem fixa de eventos.
**Decisões:** 1, 3, 5, 7.
**Fica para outra tarefa:** como um herói chega (V3C-T3, V3C-T2); expedição, experiência ganha, ferimento, captura e equipamento (Fase D); aura de comandante e cura da Clériga (v0.4).
**Trilha:** motor.
**Entregáveis:** **novo** `packages/content/src/heroes.ts` (classes, traços, heróis nomeados, `xpToNext`), `ids.ts` (`HERO_CLASS_IDS`, `HERO_TRAIT_IDS`), `balance.ts` (**novo** `heroes`), `schemas.ts`, `chronicle.ts`, `index.ts`, `content.test.ts`; **novos** `packages/engine/src/heroes.ts` (derivações puras) e `wages.ts` (soldo e atraso); `economy.ts`, `timeline.ts`, `advance.ts`, `commands.ts` (**novo** `dismissHero`), `rejections.ts`, `types.ts`, `state.ts`, `migrations.ts`, `migrations/v<N>.ts`, `view.ts`, `test-helpers.ts`; `packages/protocol/src/commands.ts`, `view.ts`, `protocol.test.ts`; `tests/server/scenarios.test.ts`.

- [ ] V3C-T1.1 Conteúdo: quatro classes (`warrior`, `archer`, `mage`, `cleric`) com os seis atributos-base **inteiros** (vida, ataque, defesa, velocidade, perícia, vontade) aprovados no ADR 0015. Oito traços do Apêndice D, cada um com `label`, `text` e **só os efeitos que a v0.3 usa**; o que é de outra versão (aura de comandante do Veterano, por exemplo) não entra nem como campo. `balance.heroes: { wagePerHour: 2; arrears: { discontentAfterMs: 12 h de jogo; leaveAfterMs: 24 h de jogo; leaveEveryMs: 1 dia de jogo; discontentFactor: 4/5 }; maxLevel: 10; levelBonus: 8/100; xpToNext: [100, 282, 519, 800, 1118, 1469, 1852, 2262, 2700] }`. A tabela de experiência é `100 × n^1,5` arredondado para baixo, **escrita número a número**: o motor não calcula potência fracionária. Teste de conteúdo: toda classe tem os seis atributos positivos; a tabela é crescente e tem `maxLevel − 1` entradas.
- [ ] V3C-T1.2 Estado: `guild: { heroes: Hero[]; wageArrears: { sinceMs } | null }`, com `Hero = { id; name; classId; level; xp; traits; status: 'idle'; joinedAtMs; discontent: boolean }`. Os estados `expedition`, `escort`, `injured` e `captured` entram com as tarefas que os usam. A migração cria `guild` vazio. Atributos e poder são **derivados** (`heroes.ts`) e nunca gravados.
- [ ] V3C-T1.3 Soldo (premissa 3): consumo contínuo de ouro, `wagePerHour × heróis que recebem`, somado ao saldo do ouro como o consumo de comida é somado ao da comida. O `breakdown` do ouro diz "−12/h (soldo de 2 heróis)" já em tempo real. O instante em que o ouro acaba com soldo a pagar é evento da linha do tempo (`timeline.ts`): abre o atraso (`wageArrearsStarted`). Não há dívida: o que não foi pago não é cobrado depois. O atraso fecha no primeiro instante em que o saldo de ouro volta a ser positivo (`wageArrearsEnded`). Ouro que chega e sai no mesmo instante não faz o atraso oscilar.
- [ ] V3C-T1.4 Consequências, cada uma um evento com hora marcada: em `sinceMs + discontentAfterMs`, todo herói sem o traço Leal fica Descontente (`heroDiscontent`; atributos ×4/5 enquanto durar o atraso); a partir de `sinceMs + leaveAfterMs`, parte **um** herói a cada `leaveEveryMs` (`heroLeft`): o que chegou por último entre os que estão no feudo e não são Leais. O critério é fixo, sem sorteio. Fechado o atraso, todos deixam de estar Descontentes.
- [ ] V3C-T1.5 Comando `dismissHero { heroId }`: recusas `HERO_NOT_FOUND` e `HERO_BUSY` (a segunda só passa a acontecer na Fase D). Evento `heroDismissed`. Sem devolução de ouro.
- [ ] V3C-T1.6 `ViewState`: `guild.heroes[]` com `id`, `name`, `classLabel`, `level`, `xp`, `xpToNext`, `traits: Array<{ label, text }>`, `statusText`, `power`, `powerBreakdown`, `wagePerHour`, `discontent`; `guild.heroLimit`; `guild.wage: { perHour; coveredForSeconds: number | null; arrears: null | { secondsElapsed; text; discontentInSeconds: number | null; nextDepartureInSeconds: number | null } }`. `coveredForSeconds` é o número que "Antes de partir" vai mostrar: por quanto tempo o ouro paga a equipe.
- [ ] V3C-T1.7 Testes: soldo exato em milésimos; ouro acabando no instante previsto; atraso que abre, dura 12 h e 24 h de jogo e fecha; herói Leal que fica; dispensa durante o atraso; um ritmo diferente de 1; 30 dias sem acesso com dois heróis e ouro insuficiente; propriedade de divisão de intervalo com o atraso no caminho; golden regravado de propósito. Como ainda não há como ganhar um herói, os testes criam um por um auxiliar de `test-helpers.ts`. Integração: `dismissHero` reenviado devolve o recibo.

**Diversão:** o ouro deixa de ser o recurso que só acumula (6.626 parados no 3× da v0.1). O teste é o autor olhar o ouro e dizer por quantas horas ele paga a equipe, só com o que a tela mostra.

**Verificação:**

```bash
pnpm --filter @lotg/content test
pnpm --filter @lotg/engine test -- heroes
pnpm --filter @lotg/engine test -- wages
pnpm --filter @lotg/engine test -- economy.property
TEST_DATABASE_URL=postgres://lotg:lotg@localhost:5433/lotg_test pnpm test:integration scenarios
```

**Pronto quando:** o soldo sai do ouro no `ViewState` com a explicação, o atraso abre e fecha em instantes exatos registrados na Crônica, as consequências acontecem com o jogador fora, e a propriedade continua exata.

**Prompt sugerido:** "Leia CLAUDE.md, GAME_DESIGN.md §9.1 e Apêndice D, docs/decisions/0015-…md, docs/roadmap-v0.3.md V3C-T1 e Apêndice B, e packages/engine/README.md. Apresente o plano por subtarefa (conteúdo; estado e migração; soldo como consumo contínuo; atraso e consequências; dispensa; ViewState) e espere aprovação. É tarefa L: uma subtarefa por bloco, em branch, testes primeiro. Nada de expedição, equipamento ou comandante."

### V3C-T3 · A carta "Estrangeira ferida" `M`

**Objetivo:** a primeira carta roteirizada do jogo entrega o primeiro herói, sem custo, na data marcada, também para quem está fora e também nas partidas que já passaram da data (critério 1).
**GDD:** §2.2 (dia real 2), §7.1 (cartas roteirizadas furam o sorteio), §9.1 ("o primeiro herói chega grátis"), §12.3, Apêndice B (carta 1), §16.2.
**Depende de:** V3C-T1. **Da v0.2 usa:** o motor do Conselho (V2D-T1) com `scripted`, que o ADR 0014 diz que o motor aceita e o catálogo não usa; `autoResolve` por dificuldade; continuação e efeito adiado; a fronteira da migração.
**Decisões:** 6.
**Trilha:** motor.
**Entregáveis:** `packages/content/src/council.ts` † (efeito `addHero`), **novo** `packages/content/src/cards/scripted.ts` (a pasta `cards/` é †), `heroes.ts` (Edda, Guerreira Leal; Rolf, Arqueiro Prudente), `chronicle.ts` (`heroJoined`), `content.test.ts`; `packages/engine/src/council.ts` †, `heroes.ts`, `migrations/v<N>.ts`, `view.ts`, `scenario.test.ts`; **novo** `docs/content-v0.3.md` (inventário, começando por esta carta, com a ficha da §13.4).

- [ ] V3C-T3.1 Efeito `addHero { heroId; afterDays? }`: cria o herói nomeado do conteúdo com `nextId`. Com `afterDays`, o herói chega depois, como efeito adiado (o mecanismo que a v0.2 usa para efeitos que acontecem mais tarde; conferir o nome em V3A-T1.4). O limite de heróis (premissa 5) não barra um `addHero` de carta: uma recompensa nunca se perde.
- [ ] V3C-T3.2 A carta (premissa 6): `scripted: { atGameDay: 13 }`, ano 1. "Acolher": Edda entra agora. "Cuidar e deixar partir": +40 ouro, +5 de moral por 1 dia de jogo, e Rolf chega 1 dia de jogo depois. Nenhuma opção tem custo. `autoResolve`: Camponês e Senhor "Acolher"; Rei de Ferro "Cuidar e deixar partir". O texto segue a ficha da §13.4 e é aprovado pelo autor.
- [ ] V3C-T3.3 Prioridade: a carta roteirizada vencida entra antes do sorteio e antes de uma continuação agendada; com 2 pendentes, espera a primeira vaga, sem se perder. Expira em 24 h reais como as outras, e a expiração também entrega um herói.
- [ ] V3C-T3.4 Partidas antigas: o passo de migração agenda a carta para `context.boundaryMs + intervalo do Conselho` em toda partida que **já passou** do dia 13 do ano 1 e ainda não tem herói. Uma vez por partida, marcada por flag. Sem isso, quem joga desde a v0.1 nunca receberia o primeiro herói.
- [ ] V3C-T3.5 Teste de conteúdo: a proibição de "herói" nas cartas dá lugar a "nenhuma referência a ferro, exército, combate, presságio ou relíquia"; todo `addHero` aponta para um herói que existe; nenhuma carta cria herói com custo.
- [ ] V3C-T3.6 Testes: cenário no motor nas três dificuldades (responder cada opção; expirar); partida nova, partida migrada antes e depois do dia 13; ano 2 (não repete); propriedade com a carta e o efeito adiado no caminho; integração: responder, reenviar e responder de novo dá **um** herói.

**Diversão:** é o momento em que o feudo ganha um rosto. As duas opções têm de parecer boas: uma guerreira leal agora, ou ouro e um arqueiro amanhã. O teste é o autor hesitar.

**Verificação:**

```bash
pnpm --filter @lotg/content test
pnpm --filter @lotg/engine test -- council
pnpm --filter @lotg/engine test -- scenario
pnpm --filter @lotg/engine test -- migrations
TEST_DATABASE_URL=postgres://lotg:lotg@localhost:5433/lotg_test pnpm test:integration council
```

**Pronto quando:** critério 1 da §16.2 provado por cenário no motor nas três dificuldades e por integração, em partida nova e em partida migrada.

**Prompt sugerido:** "Leia CLAUDE.md, GAME_DESIGN.md §7.1, §9.1 e Apêndice B, docs/decisions/0014 e 0015, docs/roadmap-v0.3.md V3C-T3 e §13.4. Escreva primeiro a ficha da carta em docs/content-v0.3.md e me mostre. Depois apresente o plano (efeito addHero, carta roteirizada, prioridade, partidas migradas) e espere aprovação. Testes de cenário antes do código."

### V3C-T2 · Taverna: candidatos, contratação, moral e festival `M`

**Objetivo:** a Taverna como edifício; candidatos que mudam em cadência fixa; contratar; o termo da Taverna na moral; e o festival por comando.
**GDD:** §5.7 (`+5 × nível da Taverna`, `+15 durante festival`), §6.1, §6.2, §9.1 (recrutamento), Apêndice D (Carismático).
**Depende de:** V3C-T1, V3C-T3. **Da v0.2 usa:** a fórmula da moral com termos e efeitos temporários (V2C-T4, V2D-T1), o gate do Salão, o cap e o início automático nas obras, o fluxo de sorteio fixo.
**Decisões:** 4, 5, 10.
**Trilha:** motor.
**Entregáveis:** `packages/content/src/ids.ts` e `buildings.ts` (`tavern`: `requires: { townHall: 3 }`, 180 madeira, 60 pedra e 120 ouro, 15 min, nível máximo 5), `balance.ts` (**novo** `tavern`), `heroes.ts` (modelos de candidato e lista de nomes), `chronicle.ts` (`heroHired`, `festivalHeld`, `festivalEnded`); **novo** `packages/engine/src/tavern.ts`; `morale.ts` †, `random.ts` (`tavern` em `RNG_STREAMS`), `timeline.ts`, `advance.ts`, `commands.ts` (**novos** `hireHero`, `holdFestival`), `rejections.ts`, `types.ts`, `migrations/v<N>.ts`, `view.ts`; protocolo; `packages/sim-cli/src/bots/policies.ts`.

- [ ] V3C-T2.1 Conteúdo (premissas 4, 5 e 10): `tavern: { offersByLevel: [2, 2, 3, 3, 3]; rotationMs: 12 dias de jogo; moralePerLevel: 5; heroLimitBase: 1; heroLimitPerLevel: 1; festival: { cost: { food: 100, gold: 50 }; morale: 15; durationMs: 24 h de jogo; perSeason: 1 } }`. Modelos de candidato com classe, um ou dois traços, nível inicial, peso e **preço fixo** entre 80 e 300 ouro. Lista de nomes. Teste de conteúdo: nomes únicos; todo modelo com preço na faixa; pesos inteiros.
- [ ] V3C-T2.2 Rotação: as primeiras ofertas nascem no instante em que a Taverna Nv1 fica pronta (a conclusão de uma obra é evento da linha do tempo). Depois, `nextRotationAtMs += rotationMs`, sempre, como a cadência do Conselho. Cada rotação sorteia no fluxo `tavern`: modelo por `pickWeighted` na ordem do conteúdo, nome entre os que nenhum herói vivo usa. Quem não foi contratado sai. A rotação não gera linha na Crônica.
- [ ] V3C-T2.3 Comando `hireHero { offerId }`: recusas `TAVERN_REQUIRED`, `OFFER_GONE` (a oferta saiu na rotação; a rotação resolve **antes** de um comando no mesmo instante), `HERO_LIMIT` ("A Taverna Nv1 abriga 2 heróis"), `INSUFFICIENT_RESOURCES`. Um herói Carismático no feudo dá 20% de desconto, com o preço cheio e o desconto na explicação. Evento `heroHired`.
- [ ] V3C-T2.4 Moral: `+5 × nível da Taverna` entra como termo permanente da fórmula da v0.2 e aparece em `morale.terms`. O traço Devoto (+5 de moral do feudo) entra no mesmo lugar, uma vez por herói Devoto presente.
- [ ] V3C-T2.5 Festival: `holdFestival {}` cobra o custo, soma +15 de moral por 24 h de jogo pelo mecanismo de efeitos temporários da v0.2 e marca a estação. Recusas `TAVERN_REQUIRED`, `FESTIVAL_ALREADY_HELD` ("Um festival por estação") e `INSUFFICIENT_RESOURCES`. Como todo termo da moral, vale a partir da virada de dia seguinte.
- [ ] V3C-T2.6 `ViewState`: `tavern: { level; offers: Array<{ offerId; name; classLabel; level; traits; price; priceText; wagePerHour; affordable; blockedReason }>; nextRotationInSeconds; festival: { available; cost; blockedReason; activeForSeconds: number | null } }`. Os candidatos da próxima rotação não saem do servidor.
- [ ] V3C-T2.7 Bot: políticas "contratar quando o ouro paga o preço e 24 h de soldo" (explorador) e "nunca contratar" (preguiçoso, registrado).
- [ ] V3C-T2.8 Testes: mesma semente, mesmos candidatos; a rotação offline de 30 dias sorteia o mesmo que 30 dias de visitas; contratar no instante da rotação; limite por nível; desconto do Carismático; festival duas vezes na estação; propriedade com rotação e festival no caminho; integração: `hireHero` com duplo envio contrata e cobra uma vez.

**Diversão:** a Taverna vende a decisão mais pessoal do jogo: quem entra na equipe. O candidato some na rotação, então "depois eu vejo" tem preço. O teste é o autor comparar dois candidatos e saber dizer por que escolheu um.

**Verificação:**

```bash
pnpm --filter @lotg/content test
pnpm --filter @lotg/engine test -- tavern
pnpm --filter @lotg/engine test -- morale
pnpm --filter @lotg/engine test -- economy.property
TEST_DATABASE_URL=postgres://lotg:lotg@localhost:5433/lotg_test pnpm test:integration scenarios
```

**Pronto quando:** a Taverna oferece candidatos reproduzíveis pela semente, contratar cobra uma vez e respeita o limite, e a moral mostra os termos da Taverna e do festival.

**Prompt sugerido:** "Leia CLAUDE.md, GAME_DESIGN.md §5.7, §6.1 e §9.1, docs/decisions/0015-…md, docs/roadmap-v0.3.md V3C-T2 e Apêndice B, e packages/engine/src/random.ts. Apresente o plano (conteúdo, rotação ancorada, contratação, termos da moral, festival, ViewState) e espere aprovação. Testes primeiro."

### V3C-T4 · Heróis e Taverna na interface `M`

**Objetivo:** ver a equipe, o soldo e o atraso; contratar, dispensar e dar festival pelo painel, pela árvore e pela paleta.
**GDD:** §13.1 (aba Guilda), §13.2 ("Guilda · 3 heróis"), §13.3 ("Heróis 3"; soldo na linha do ouro), §13.5, §13.6.
**Depende de:** V3C-T2 (pode começar depois de V3C-T1, com a visão do golden).
**Trilha:** app.
**Entregáveis:** **nova** aba `packages/web/src/tabs/Guild.tsx`; **novos** `components/HeroesPanel.tsx` e `components/TavernPanel.tsx`; `app/router.ts` (`#/guilda`), `app/controller.ts`, `palette/commands.ts` (`lords.hireHero`, `lords.dismissHero`, `lords.holdFestival`), `ui/treeModel.ts`, `workbench/Tree.tsx` (`rowActions`), `workbench/StatusBar.tsx`, `notifications/policy.ts`, `components/Header.tsx`, `components/ResourcesTable.tsx`, `components/Today.tsx`; **novo** `tests/e2e/09-guilda.spec.ts`.

- [ ] V3C-T4.1 Primeira tela funcional ao autor antes da aba completa: a lista de heróis com nome, classe, nível, traços e soldo, e a linha do ouro com "−6/h (soldo de 1 herói)".
- [ ] V3C-T4.2 Um caminho de comando só: painel, árvore e paleta chamam `controller.runCommand`, que usa `controller.prepare` para fixar o `commandId`. "Contratar…" e "Dispensar…" pela paleta rodam **um fluxo por vez** e leem a conta e a visão **depois** de qualquer espera (§11.1, lição 9).
- [ ] V3C-T4.3 Soldo em atraso: aviso essencial ao abrir o atraso; a barra de status ganha o atraso na prioridade (decisões pendentes > frio, fome ou soldo em atraso > cheio em menos de 8 h > obra); a aba mostra "Descontentes em 3h" e "Um herói parte em 7h", com os números da visão.
- [ ] V3C-T4.4 Taverna: candidatos com preço, soldo por hora real e "troca em 5h20"; o botão de contratar diz o motivo quando bloqueado; o festival mostra custo, efeito e "um por estação".
- [ ] V3C-T4.5 Estados: sem Taverna e sem herói (a aba explica como o primeiro herói chega, sem prometer data); com herói e sem Guilda ("Sua equipe ainda não tem para onde ir: a Guilda dos Aventureiros abre com o Salão Nv3", texto vindo da visão); sem conexão (modo leitura).
- [ ] V3C-T4.6 Testes: unidade sem DOM com a visão do golden; navegador: a estrangeira ferida respondida pela aba Conselho faz o herói aparecer; contratar pelo painel, pela paleta e só com o teclado nos três temas; contratar com duplo clique e em duas abas contrata uma vez; o atraso aparece com o relógio adiantado. `pnpm capture:landing` se a aba Feudo ou a barra mudarem.

**Diversão:** a aba Guilda tem de dar vontade de olhar a equipe. Nome, classe e traços em uma linha; o custo sempre à vista. O teste é o autor contratar o segundo herói sem perguntar o que é soldo.

**Verificação:**

```bash
pnpm --filter @lotg/web test
pnpm test:e2e 09-guilda
```

**Pronto quando:** todas as superfícies (aba, árvore, paleta, aviso, barra, Hoje) mostram a equipe e o soldo, e o critério 1 está provado em navegador.

**Prompt sugerido:** "Leia CLAUDE.md, GAME_DESIGN.md §13.1 a §13.6, docs/roadmap-v0.3.md V3C-T4 e packages/web/README.md. Apresente o plano (aba Guilda, caminho único de comando, estados, avisos, testes) e espere aprovação. Me mostre a lista de heróis funcionando antes de completar a tela. Nenhuma regra de jogo no app."

### V3C-T5 · Revisão independente da Fase C `S`

**Objetivo:** revisão de leitura da fase, uma rodada do simulador com heróis e soldo, e o autor jogando a sequência da fase.
**Depende de:** V3C-T1 a V3C-T4.
**Entregáveis:** relatório da revisão; `docs/balance-v0.3.md` com a rodada; correções com regressão.

- [ ] V3C-T5.1 Revisor independente (Apêndice A.4) tenta: contratar duas vezes a mesma oferta; contratar no instante da rotação; ouro que chega e sai no instante em que o atraso abriria; dispensar o herói que estava para partir; carta da estrangeira com 2 pendentes, na virada do ano e em partida migrada; inferir a próxima rotação pela resposta HTTP.
- [ ] V3C-T5.2 Simulador, 50 sementes × perfis × ritmos × dificuldades: hora do primeiro herói, horas de atraso, heróis que partiram, ouro parado. **O perfil Preguiçoso não pode perder herói só por ter ficado fora uma noite**: se perder, a proteção é regra e vai ao autor (premissa 3).
- [ ] V3C-T5.3 Desempenho: tamanho do estado e da visão com seis heróis, contra a linha de base de V3A-T1.8.
- [ ] V3C-T5.4 O autor joga no ritmo 3: recebe a estrangeira, constrói a Taverna, contrata, deixa o ouro acabar e volta. Registrar o que ele entendeu e o que não. Mesclar `v3c-herois` só com a aprovação dele.

**Pronto quando:** defeitos confirmados corrigidos com teste; a meta "primeiro herói no dia 2" do GDD §15.2 medida; o autor jogou e aprovou.

**Prompt sugerido:** "Leia CLAUDE.md e docs/roadmap-v0.3.md V3C-T5. Lance o revisor independente (Apêndice A.4) sobre o branch v3c-herois, rode a matriz do simulador, registre em docs/balance-v0.3.md e me prepare o roteiro de 15 minutos para eu jogar a fase."

---

## 4. Fase D — Expedições

**Meta da fase:** enviar uma equipe, vê-la percorrer um grafo de nós com o jogador fora, decidir na encruzilhada (ou deixar a Postura decidir) e ler o relatório nó a nó. Critérios 2 e 3 da §16.2. Branch `v3d-expedicoes`.

A expedição é a mecânica central da v0.3 (GDD §9). O que o jogador deve conseguir ao fim da fase: escolher equipe e Postura sabendo o risco, ser avisado na encruzilhada, escolher um caminho ou não, e entender pelo relatório por que deu certo ou errado.

**Como a expedição cabe no determinismo.** Uma expedição é um grafo do conteúdo percorrido por **eventos da linha do tempo**. O fim de cada nó é um instante marcado em `nextEventAt`; é nele, e só nele, que o motor sorteia, no fluxo `expedition:<id>` (V3B-T1). A encruzilhada grava um prazo, convertido de tempo real para tempo de jogo no instante em que a equipe chega; o prazo também é um evento da linha do tempo, e nele a Postura decide. Nada depende de quando alguém consultou: avançar 10 h de uma vez ou em dez pedaços dá o mesmo relatório.

### V3D-T0 · Sessão de decisões, lote 2 → ADR 0016 `S`

**Objetivo:** fechar com o autor as decisões das expedições, do Mercado, dos Mestres e das cartas antes do código.
**Depende de:** V3C-T5.
**Decisões:** 11 a 21.
**Trilha:** documentos.
**Entregáveis:** **novo** `docs/decisions/0016-expedicoes-mercado-mestres-e-cartas-na-v0.3.md`; GDD §5.4, §5.9, §8.2, §9.2 a §9.4, §12.2 e Apêndices B e C corrigidos; §9 deste roadmap atualizada.

- [ ] V3D-T0.1 Apresentar cada decisão com a premissa da §9 como padrão. Para a 12 e a 19, mostrar o catálogo da §13.2 e o lote da §13.3 e perguntar quem escreve (premissa: o agente escreve, o autor aprova grafo a grafo e carta a carta).
- [ ] V3D-T0.2 Levar ao autor o que a Fase C mostrou: horas de atraso do soldo por perfil, ouro parado, se o Preguiçoso perdeu herói.
- [ ] V3D-T0.3 Escrever o ADR e corrigir o GDD: a espera da encruzilhada em tempo real, a lista de expedições desta versão, a fórmula de poder em inteiros, o volume diário, o risco da caravana, o que é um Mestre.

**Pronto quando:** nenhuma tarefa de D, E ou F tem decisão aberta.

**Prompt sugerido:** "Leia CLAUDE.md, docs/roadmap-v0.3.md §9, §13 e §0.6, docs/balance-v0.3.md e GAME_DESIGN.md §5.9, §9 e Apêndices B, C e D. Vamos fechar o lote 2: uma decisão por vez, com a sua recomendação como padrão; registre em docs/decisions/0016-…md e corrija o GDD."

### V3D-T1 · Motor das expedições `L`

**Objetivo:** a Guilda como edifício; enviar uma equipe; percorrer o grafo por eventos da linha do tempo; resolver cada nó em inteiros com o sorteio do fluxo da expedição; parar na encruzilhada, esperar e deixar a Postura decidir no prazo; devolver a equipe.
**GDD:** §4.1 (verão), §6.1 e §6.2 (Guilda), §9.2, §13.3 ("postura assume em 4h40"), §14.3, §14.11, §16.2, Apêndice C.
**Depende de:** V3D-T0, V3B-T1, V3C-T1. **Da v0.2 usa:** a linha do tempo de eventos, o prazo real convertido no nascimento (como a expiração da carta, ADR 0014, decisão 1), a regra "o prazo resolve antes de um comando no mesmo instante", `pendingDecisions`, o corte no cap com desperdício contado para ganhos discretos (ADR 0013, decisão 17), o protocolo versionado com `426`.
**Decisões:** 1, 7, 9, 11, 12, 13.
**Fica para outra tarefa:** o que o desfecho faz ao herói, experiência e itens (V3D-T2); o catálogo de verdade e os textos (V3D-T3). Esta tarefa usa **dois grafos de teste**.
**Trilha:** motor.
**Entregáveis:** `packages/content/src/ids.ts` e `buildings.ts` (`guild`: `requires: { townHall: 3 }`, 300 madeira, 100 pedra e 200 ouro, 20 min, nível máximo 4 nesta versão), **novo** `packages/content/src/expeditions.ts` (tipos, `ExpeditionModelSchema`, `balance.expeditions`), **nova** pasta `packages/content/src/missions/` (dois grafos de teste), `chronicle.ts`, `content.test.ts`; **novo** `packages/engine/src/expeditions.ts`; `heroes.ts` (poder da equipe), `timeline.ts`, `advance.ts`, `commands.ts` (**novos** `sendExpedition`, `chooseExpeditionPath`), `rejections.ts`, `types.ts`, `migrations/v<N>.ts`, `view.ts`; `packages/protocol/src/commands.ts`, `view.ts`, `index.ts` (protocolo 3, se preciso); servidor (versão mínima do cliente: conferir onde a v0.2 a pôs); `packages/client-sdk/src/client.ts`; **novo** `packages/server/test/expeditions.test.ts`.

- [ ] V3D-T1.1 Conteúdo: um **modelo** tem `id`, `label`, `riskLabel`, `requires` (nível da Guilda, tamanho da equipe, nível mínimo, classes, destino descoberto) e três **variantes**. Uma variante é um grafo: `start` e `nodes`, cada nó com `kind` (`travel`, `encounter`, `discovery`, `crossroads`, `hazard`, `camp`, `boss`, `return`), `title`, `durationMs`, e conforme o tipo: `difficulty` e os pesos dos atributos, `onDisaster` (`injury` ou `capture`), `rewards`, `next`, ou, na encruzilhada, `options` (cada uma com `id`, `label`, `hint`, `requires?` e `next`) e **`posture: { cautious; balanced; bold }`**, a opção de cada Postura marcada editorialmente, como no Apêndice C do GDD. `balance.expeditions: { crossroadsWaitRealMs: 6 h; summerDuration: 17/20; outcome: { full: 13/10; success: 1/1; setback: 7/10 }; luck: { min: 85; max: 115 }; slotsByGuildLevel: [1, 2, 2, 3]; reportsKept: 3 }`.
- [ ] V3D-T1.2 Teste de conteúdo: grafo acíclico; todo caminho chega a um nó `return`; de 3 a 5 nós de profundidade; duração de 10 a 45 min de jogo por nó; três variantes por modelo; toda encruzilhada com as três Posturas apontando para opções que existem; a opção da Cautelosa **sem requisito**; todo nó com `difficulty` tem `onDisaster`; nenhuma recompensa de versão futura (ferro, arma, relíquia, planta, unidade, presságio).
- [ ] V3D-T1.3 Estado: `guild.expeditions[]` com `id`, `modelId`, `variant`, `heroIds`, `posture`, `sentAtMs`, `durationFactor`, `status` (`traveling`, `atCrossroads`, `returning`), `nodeId`, `nodeEndsAtMs`, `crossroads: { decidesAtMs } | null`, `loot` e `log` (uma entrada por nó resolvido). `guild.reports[]` guarda os últimos `reportsKept` relatórios. A migração cria as duas listas vazias.
- [ ] V3D-T1.4 Envio, `sendExpedition { modelId; heroIds; posture }`: recusas `GUILD_REQUIRED`, `EXPEDITION_LIMIT` ("A Guilda Nv1 sustenta 1 expedição por vez"), `EXPEDITION_LOCKED` (destino não descoberto ou nível da Guilda), `HERO_UNAVAILABLE` (com o nome e o motivo), `TEAM_INVALID` (tamanho, classe ou nível, dizendo o que falta). **Um comando não sorteia**: a variante é `(hash da semente e do modelo + envios desse modelo no ano) mod 3`, o que também garante que as três variantes aparecem antes de repetir. O fator de duração da estação é **fixado no envio** (verão: ×17/20), como as obras da v0.2: a duração mostrada antes do envio é a que vale. Evento `expeditionSent`.
- [ ] V3D-T1.5 Percurso: o fim do nó atual (`nodeEndsAtMs`) entra em `nextEventAt`. No instante, o motor resolve o nó, acrescenta a entrada ao `log`, emite `expeditionNodeResolved` com a frase e passa ao nó seguinte. Duas expedições que terminam um nó no mesmo instante são processadas na ordem do identificador; cada uma sorteia no próprio fluxo, então a ordem não muda o resultado de nenhuma.
- [ ] V3D-T1.6 Resolução (premissa 7), toda em inteiros: `poder = Σ por herói (ataque + defesa + vida ÷ 10)`, calculado em milésimos, vezes os fatores de classe, traço e item do nó como frações, com um arredondamento para baixo no fim; `sorte` é um inteiro de 85 a 115 sorteado uma vez por nó com dificuldade; o desfecho sai por multiplicação cruzada, sem divisão: Sucesso Pleno se `poder × sorte × 10 ≥ dificuldade × 1300`, Sucesso se `poder × sorte ≥ dificuldade × 100`, Revés se `poder × sorte × 10 ≥ dificuldade × 700`, senão Desastre. A ordem dos sorteios dentro do nó é fixa e documentada: sorte, depois quem sofre o desfecho, depois as quantidades do saque na ordem do conteúdo. Nesta tarefa o desfecho decide só o saque (inteiro, parcial, nenhum) e a frase.
- [ ] V3D-T1.7 Encruzilhada: ao chegar, `status = atCrossroads`, `decidesAtMs = agora + crossroadsWaitRealMs × timeScale`, evento `expeditionAtCrossroads` e uma entrada em `pendingDecisions`. Comando `chooseExpeditionPath { expeditionId; optionId }`: recusas `EXPEDITION_NOT_WAITING`, `CROSSROADS_DECIDED` (o prazo resolve **antes** de um comando no mesmo instante), `INVALID_OPTION`, `OPTION_LOCKED` ("requer um Guerreiro na equipe"). No prazo, vale a opção marcada para a Postura da expedição; se ela estiver bloqueada para esta equipe, vale a da Cautelosa. Eventos `expeditionPathChosen` e `expeditionPostureDecided`, com o nome de quem decidiu. A equipe parada na encruzilhada continua recebendo soldo.
- [ ] V3D-T1.8 Retorno: no nó `return`, os recursos do saque entram no estoque cortados no cap, com o corte contado como na v0.2; os heróis voltam a `idle`; o `log` vira um relatório em `guild.reports` (os mais antigos saem); o fluxo `expedition:<id>` é apagado. Evento `expeditionReturned` com os totais.
- [ ] V3D-T1.9 `ViewState`: `guild.slots`; `guild.available[]` (cada modelo com `label`, `riskText`, `durationSeconds`, `requirementsText`, `locked`, `lockedReason`, e o que a premissa 13 deixa ver do primeiro trecho); `guild.expeditions[]` (onde está, quanto falta, o que já aconteceu, e na encruzilhada as opções com `label`, `hint`, `locked`, `lockedReason`, `decidesInSeconds`, `postureLabel` e `postureOptionLabel`); `guild.reports[]`; `pendingDecisions` com `{ kind: 'crossroads'; id; title; expiresInSeconds }`. **Não saem:** a dificuldade e o conteúdo dos nós depois de uma encruzilhada não alcançada, a sorte, o fluxo.
- [ ] V3D-T1.10 Protocolo: se V3A-T1.4 mostrou que `pendingDecisions` é uma união fechada, `protocol` passa a **3** e o servidor responde `426 UPGRADE_REQUIRED` a um cliente anterior, com a mesma frase da v0.2. Se a lista for aberta, registrar por que o protocolo não sobe.
- [ ] V3D-T1.11 Testes: os dois grafos de teste percorridos de ponta a ponta; o prazo da encruzilhada nos três ritmos (6 h reais em todos); escolha no instante do prazo; Postura com opção bloqueada; duas expedições simultâneas e uma terceira enviada no meio; envio no verão e virada de estação no caminho; 30 dias sem acesso com a equipe na encruzilhada; propriedade de divisão de intervalo com nós, sorteios e prazo no caminho, inclusive com o fluxo nascendo e sendo apagado; mesma semente, mesmo relatório; integração: enviar, reenviar, escolher em duas abas, escolher depois do prazo.

**Diversão:** nada ainda para ler: é a máquina. O que ela tem de garantir para a diversão vir depois: nenhuma encruzilhada decide sem o jogador ter tido 6 h reais, a Postura nunca escolhe o que a equipe não pode fazer, e o que foi mostrado antes do envio é o que vale.

**Verificação:**

```bash
pnpm --filter @lotg/content test
pnpm --filter @lotg/engine test -- expeditions
pnpm --filter @lotg/engine test -- economy.property
pnpm --filter @lotg/engine test -- random.property
TEST_DATABASE_URL=postgres://lotg:lotg@localhost:5433/lotg_test pnpm test:integration expeditions
```

**Pronto quando:** critério 2 da §16.2 provado no motor nos três ritmos e por integração; a propriedade vale com expedições; a mesma semente dá o mesmo relatório.

**Prompt sugerido:** "Leia CLAUDE.md, GAME_DESIGN.md §9.2 e Apêndice C, docs/decisions/0015 e 0016, docs/roadmap-v0.3.md V3D-T1 e Apêndice B, packages/engine/README.md e packages/server/README.md. Apresente o plano por subtarefa (conteúdo e schema; estado e migração; envio; percurso por eventos; resolução em inteiros; encruzilhada e Postura; retorno; ViewState; protocolo) e espere aprovação. É tarefa L: uma subtarefa por bloco, em branch, testes primeiro. Nada de exército, sabotagem ou mapa gráfico."

### V3D-T2 · Desfechos: ferimento, captura, Resgate, experiência e equipamento `M`

**Objetivo:** o que acontece ao herói e ao mundo depois de um nó: ferir, capturar, resgatar, ganhar experiência e nível, achar e equipar itens, revelar um destino, limpar o Covil de Lobos.
**GDD:** §8.2 ("−30 ao limpar um tile `[v0.3]`"), §9.1 (ferimentos, captura, equipamento, níveis), §9.2 (recompensas), §9.3 (Resgate), §12.1 ("Heróis podem morrer").
**Depende de:** V3D-T1. **Da v0.2 usa:** tiles abstratos e Ameaça (V2E-T1), o padrão do ferido com `untilMs` (V2E-T3), a dificuldade como parâmetro de regra.
**Decisões:** 8, 14, 15.
**Fica de fora:** desgaste e reparo de item (Ferreiro, v0.4); relíquias e plantas (v0.5); morte fora de Rei de Ferro.
**Trilha:** motor.
**Entregáveis:** **novo** `packages/content/src/items.ts` (espaços, raridades, catálogo), `heroes.ts`, `expeditions.ts`, `tiles.ts` † (destinos descobríveis), `balance.ts` (`injuries`), `chronicle.ts`; `packages/engine/src/expeditions.ts`, `heroes.ts`, `threat.ts` †, `timeline.ts`, `advance.ts`, `commands.ts` (**novos** `equipItem`, `unequipItem`), `rejections.ts`, `types.ts`, `migrations/v<N>.ts`, `view.ts`; protocolo.

- [ ] V3D-T2.1 Ferimento (premissa 8): Revés fere um herói de leve (2 h de jogo); Desastre, de forma grave (12 h de jogo) ou captura, **conforme o nó marca** em `onDisaster`. Quem sofre é sorteado no fluxo da expedição entre os da equipe. O herói ferido termina a expedição, mas não parte em outra até `untilMs`, que é evento da linha do tempo (`heroRecovered`).
- [ ] V3D-T2.2 Dificuldade: Camponês troca toda captura por ferimento grave; Senhor segue o que o nó marca; em Rei de Ferro, onde o nó marca captura, o herói **morre** (`heroDied`), e os itens dele voltam ao inventário. Cada caso com frase própria na Crônica.
- [ ] V3D-T2.3 Captura e Resgate: o capturado sai da equipe, não recebe soldo e não tem prazo nesta versão. Enquanto houver um capturado, o modelo "Resgate" fica disponível (2 h de jogo, 2 nós, 2 heróis); o sucesso devolve o herói (`heroRescued`). Se todos os heróis de uma expedição forem capturados, ela termina ali e o saque se perde.
- [ ] V3D-T2.4 Experiência e nível: cada nó dá experiência do conteúdo, proporcional ao desfecho; subir de nível é evento (`heroLeveledUp`); o nível entra nos atributos como fração (`(100 + 8 × (nível − 1)) / 100`, premissa 7), sem compor.
- [ ] V3D-T2.5 Equipamento (premissa 15): três espaços (`weapon`, `armor`, `accessory`), quatro raridades. Itens vêm do saque e de objetivos. `guild.inventory` tem teto do conteúdo; item achado com o inventário cheio vira ouro pelo valor do conteúdo, com linha na Crônica. Comandos `equipItem { heroId; itemId }` e `unequipItem { heroId; slot }`: recusas `HERO_BUSY`, `ITEM_NOT_FOUND`, `WRONG_SLOT`. O bônus do item entra no poder como fator, com a explicação.
- [ ] V3D-T2.6 Mundo: a recompensa `revealTile` acrescenta um destino à lista (tiles abstratos, sem mapa); o sucesso no Covil dos Lobos desliga o tile de ameaça e tira 30 da Ameaça (`threatTileCleared`). Pela premissa 14, o Covil volta a ficar ativo na virada do ano. A regra de visibilidade da v0.2 continua: sem Torre, o jogador sabe que limpou o Covil, e não o número da Ameaça.
- [ ] V3D-T2.7 `ViewState`: em cada herói, `statusText` ("Ferido: volta em 1h10", "Capturado nas Ruínas"), `equipment` e o que cada item soma; `guild.inventory[]`; em cada relatório, quem se feriu, quem subiu de nível e o que foi achado.
- [ ] V3D-T2.8 Testes: cada desfecho nas três dificuldades; ferido que se recupera no instante exato; captura seguida de Resgate; equipe inteira capturada; nível 10 não passa; inventário cheio; equipar durante a expedição é recusado; Covil limpo e a virada do ano; propriedade; golden do relatório.

**Diversão:** é aqui que a equipe ganha história: a cicatriz, o nível, a espada achada nas ruínas. A regra do GDD §12.3 vale: a derrota custa e ensina. O teste é o autor, depois de um Desastre, saber o que teria mudado o resultado e querer tentar o Resgate.

**Verificação:**

```bash
pnpm --filter @lotg/content test
pnpm --filter @lotg/engine test -- expeditions
pnpm --filter @lotg/engine test -- heroes
pnpm --filter @lotg/engine test -- threat
```

**Pronto quando:** um cenário roteirizado passa por Revés, Desastre com captura, Resgate, nível novo e item equipado, nas três dificuldades, e limpar o Covil muda a Ameaça.

**Prompt sugerido:** "Leia CLAUDE.md, GAME_DESIGN.md §8.2, §9.1 a §9.3 e §12.1, docs/decisions/0015 e 0016, docs/roadmap-v0.3.md V3D-T2 e Apêndice B. Apresente o plano (ferimento, dificuldade, captura e Resgate, experiência, itens, tiles) e espere aprovação. Primeiro os testes de cada desfecho por dificuldade."

### V3D-T3 · Catálogo de expedições e o relatório nó a nó `L`

**Objetivo:** os modelos de expedição da v0.3, com três variantes cada, escritos pelo agente e aprovados pelo autor grafo a grafo, e o relatório narrado nó a nó (critério 3).
**GDD:** §9.3, §9.4, Apêndice C, Apêndice E (modelos de frase), §14.4 (`missions/`), §15.4 (golden de relatório), §18.3 (tom de crônica, frases curtas).
**Depende de:** V3D-T2.
**Decisões:** 12, 13.
**Trilha:** motor e documentos.
**Entregáveis:** `packages/content/src/missions/*.ts` (um arquivo por modelo), `chronicle.ts` (frases por tipo de nó e por desfecho), `docs/content-v0.3.md` (inventário com a ficha da §13.4 e o estado da curadoria); testes de conteúdo; goldens do motor (`packages/engine/src/__golden__/`, um relatório por modelo); política do bot.

- [ ] V3D-T3.1 Primeira entrega (premissa 12): **Patrulha dos Arredores**, **Floresta Antiga**, **Covil dos Lobos** e **Resgate**, três variantes cada (12 grafos). Bastam para os critérios 2 e 3.
- [ ] V3D-T3.2 Segunda entrega: **Ruínas de Vel'Thar** (a variante A é a do Apêndice C do GDD, com a planta da Capela trocada por um item raro) e **Pântano Nebuloso** (sem relíquia: item épico), três variantes cada (6 grafos).
- [ ] V3D-T3.3 Para cada grafo, a ficha da §13.4: escrever primeiro em `docs/content-v0.3.md`, apresentar ao autor um modelo por vez, e só então transcrever para `content`.
- [ ] V3D-T3.4 Para cada opção de encruzilhada, uma equipe para a qual ela é a escolha razoável e uma para a qual é ruim. A opção marcada para a Equilibrada não pode ser a melhor para toda equipe: quando for, o grafo volta para reescrita.
- [ ] V3D-T3.5 Relatório (GDD §9.4): cada entrada do `log` vira uma frase de crônica que diz **o que aconteceu, quem se destacou e por que deu errado**, com variantes por desfecho. Quem se destaca é o herói com o maior atributo que o nó pesa, um critério fixo, sem sorteio. O relatório fecha com ganhos e perdas. O Markdown da Crônica (`GET /chronicle.md`) leva as mesmas frases.
- [ ] V3D-T3.6 Cobertura: em 50 sementes, por estação e nível da Guilda, quantos modelos estão disponíveis e quantos o bot envia; distribuição dos desfechos por modelo para equipes do nível esperado. Um modelo em que a equipe mínima nunca passa de Revés, ou nunca falha, volta ao autor.
- [ ] V3D-T3.7 Testes: schema e grafos; cada variante percorrida em todos os ramos por um teste gerado a partir do conteúdo; golden do relatório de cada modelo com semente fixa; nenhuma referência a mecânica de versão futura. Bot: políticas "enviar a expedição de maior recompensa que a equipe passa com folga" e "responder a encruzilhada pela Postura".
- [ ] V3D-T3.8 Congelar o conteúdo para o playtest (o `contentHash` de `/version` identifica) e registrar as decisões editoriais no inventário.

**Diversão:** o GDD §9.4 diz que o relatório é a recompensa emocional e precisa ser bom de ler. O teste é o autor ler um relatório em voz alta e conseguir recontar o que aconteceu sem olhar os números.

**Verificação:**

```bash
pnpm --filter @lotg/content test
pnpm --filter @lotg/engine test -- expeditions
pnpm --filter @lotg/engine test -- scenario
pnpm -s sim -- --seed pedra-alta-001 --game-year --time-scale 3 --strategy explorador 2>&1 >/dev/null | grep -i expedi
```

**Pronto quando:** critério 3 da §16.2 provado por golden; os grafos aprovados pelo autor no inventário; a cobertura e a distribuição dos desfechos registradas.

**Prompt sugerido:** "Leia CLAUDE.md, GAME_DESIGN.md §9.3, §9.4, Apêndices C e E e §18.3, docs/decisions/0016-…md, docs/roadmap-v0.3.md V3D-T3 e §13. Escreva os grafos em docs/content-v0.3.md com a ficha da §13.4, um modelo por vez, e espere a minha aprovação antes de transcrever para packages/content. Tom de crônica medieval, frases curtas, português do Brasil."

### V3D-T4 · Expedições na interface `M`

**Objetivo:** enviar pela aba Guilda, pela árvore e pela paleta; ver onde a equipe está; decidir a encruzilhada sabendo o prazo e o que a Postura fará; ler o relatório; equipar.
**GDD:** §2.3 (passos 2 e 4), §13.2, §13.3 ("Decisões pendentes"), §13.5 (a encruzilhada é aviso essencial), §13.6 (`Lords: Enviar expedição…`).
**Depende de:** V3D-T1 (pode começar com os grafos de teste, antes de V3D-T3).
**Trilha:** app.
**Entregáveis:** `packages/web/src/tabs/Guild.tsx`; **novos** `components/ExpeditionsPanel.tsx`, `components/CrossroadsCard.tsx` e `components/ExpeditionReport.tsx`; `app/controller.ts`, `palette/commands.ts` (`lords.sendExpedition`, `lords.chooseExpeditionPath`, `lords.equipItem`), `ui/treeModel.ts` ("Guilda · 3 heróis · 1 expedição na encruzilhada"), `workbench/StatusBar.tsx`, `notifications/policy.ts`, `components/Today.tsx`, `tabs/Chronicle.tsx`; `tests/e2e/09-guilda.spec.ts` (estendido).

- [ ] V3D-T4.1 Primeira encruzilhada funcional ao autor antes da tela completa: título, texto, opções com pista, prazo real e "sem resposta, a Postura Cautelosa escolhe: Recuar com o que têm".
- [ ] V3D-T4.2 Envio: escolher o modelo, a equipe e a Postura; a tela mostra duração, risco, poder da equipe e o que a premissa 13 deixa ver. Pela paleta, "Enviar expedição…" pergunta os três em listas de escolha, um fluxo por vez.
- [ ] V3D-T4.3 Encruzilhada: a decisão pendente aparece na aba Hoje, na árvore, na barra de status e como aviso com `[Escolher caminho]`. Opção bloqueada mostra o requisito. O prazo vencendo com a tela aberta avisa e fecha sem enviar; a recusa `CROSSROADS_DECIDED` troca a tela pela visão nova.
- [ ] V3D-T4.4 Relatório: nó a nó, com o desfecho em palavra e ícone (nada só por cor), quem se destacou, e ganhos e perdas no fim. A linha da Crônica liga ao relatório enquanto ele estiver guardado; depois, a linha continua legível sozinha.
- [ ] V3D-T4.5 Equipar: no herói, três espaços, com o que cada item soma ao poder.
- [ ] V3D-T4.6 Estados: sem Guilda; Guilda sem herói livre; todos os lugares ocupados; destino ainda não descoberto (não aparece); sem conexão.
- [ ] V3D-T4.7 Testes: unidade sem DOM; navegador: enviar, saltar o tempo, escolher o caminho pelo painel, pela paleta e só com o teclado nos três temas; deixar o prazo vencer com o relógio adiantado e ver a Postura na Crônica (critério 2); duas abas, uma escolhe, a outra vê a decisão sumir; duplo clique envia uma vez; no ritmo 3, o prazo da tela e o da API concordam.

**Diversão:** a encruzilhada é o momento em que voltar ao jogo vale a pena (GDD §17.1). O teste é o autor abrir o jogo, ver a equipe esperando e escolher sem perguntar o que as Posturas significam.

**Verificação:**

```bash
pnpm --filter @lotg/web test
pnpm test:e2e 09-guilda
GAME_TIME_SCALE=3 pnpm test:e2e 09-guilda -g "ritmo"
```

**Pronto quando:** critérios 2 e 3 da §16.2 provados em navegador com o relógio controlado, e todas as superfícies mostram a encruzilhada pendente.

**Prompt sugerido:** "Leia CLAUDE.md, GAME_DESIGN.md §13.2 a §13.6, docs/roadmap-v0.3.md V3D-T4 e packages/web/README.md. Apresente o plano (envio, encruzilhada, relatório, equipar, estados, testes) e espere aprovação. Me mostre a primeira encruzilhada funcional antes de completar a tela."

### V3D-T5 · Revisão independente da Fase D `S`

**Objetivo:** conferir determinismo, clareza e variedade das expedições, inclusive o caminho de quem ficou ausente; o autor joga uma expedição com encruzilhada.
**Depende de:** V3D-T1 a V3D-T4.

- [ ] V3D-T5.1 Revisor independente tenta: escolher depois do prazo; enviar o mesmo herói duas vezes (duplo clique, duas abas, reenvio); inferir pelo `ViewState` ou pela resposta HTTP o que há depois da encruzilhada; mudar o resultado de uma expedição enviando outra; migração no meio de uma espera; virada de ano e de estação com a equipe fora.
- [ ] V3D-T5.2 Revisão editorial grafo a grafo: opção dominante, Postura que nunca muda nada, risco que não corresponde ao rótulo, frase fora do tom.
- [ ] V3D-T5.3 Simulador, perfis de 1 e 2 visitas por dia em cada ritmo: encruzilhadas decididas pelo jogador e pela Postura, horas de herói ocioso, desfechos, capturas e Resgates. Se quase toda encruzilhada cair na Postura no perfil de 2 visitas, a janela está errada: vai ao autor.
- [ ] V3D-T5.4 Desempenho: tamanho do estado e da visão com três expedições e três relatórios guardados.
- [ ] V3D-T5.5 O autor joga, no ritmo 3, uma Patrulha e o Covil dos Lobos até o relatório, e diz a cada passo o que esperava. Mesclar `v3d-expedicoes` só com a aprovação dele.

**Pronto quando:** defeitos confirmados corrigidos com teste; nenhuma opção dominante, conferido grafo a grafo; o autor jogou e aprovou.

**Prompt sugerido:** "Leia CLAUDE.md e docs/roadmap-v0.3.md V3D-T5. Lance o revisor independente (Apêndice A.4) sobre o branch v3d-expedicoes com os cenários de V3D-T5.1, faça a revisão editorial dos grafos, rode o simulador e me prepare o roteiro para eu jogar o Covil dos Lobos."

---

## 5. Fase E — Mercado, caravanas e Mestres

**Meta da fase:** o excedente tem saída e preço; a caravana troca tempo e risco por ouro; um Mestre muda quanto vale um edifício. Critérios 4 e 5 da §16.2. Branch `v3e-mercado`.

O que o jogador deve conseguir ao fim da fase: olhar um estoque quase cheio e escolher entre vender hoje, mandar uma caravana ou guardar para o inverno, sabendo o que cada caminho paga.

A v0.2 deixou esta pergunta em aberto (GDD §17.2: "caravanas e mercado devem existir já na v0.2 para dar saída ao excedente antes do cap?") e respondeu "não". A Fase E é onde a resposta se confirma ou não: o simulador tem de mostrar o excedente parado e o desperdício caindo em relação à linha de base de V3A-T1.

### V3E-T1 · Mercado: preços, compra, venda e volume diário `M`

**Objetivo:** o Mercado como edifício; preços que mudam a cada dia de jogo; comprar e vender por ouro; e o volume diário por recurso (critério 4).
**GDD:** §4.1 (comida 30% mais cara no outono), §5.9, §6.1, §6.2, §13.2 ("comida 1,3 ▲"), §14.3 (fluxo `market`), §14.11 (`market`), §16.2.
**Depende de:** V3D-T5. **Da v0.2 usa:** caps de armazenamento (uma compra não passa do cap), a virada de dia como passo fixo de `processEventsAt`, o fluxo de sorteio fixo, o gate do Salão.
**Decisões:** 1, 16.
**Fica de fora:** ferro (v0.4); mercado entre jogadores (v1.0).
**Trilha:** motor.
**Entregáveis:** `packages/content/src/ids.ts` e `buildings.ts` (`market`: `requires: { townHall: 3 }`, 150 madeira, 100 pedra e 150 ouro, 15 min, nível máximo 5), `balance.ts` (**novo** `market`), `chronicle.ts`; **novo** `packages/engine/src/market.ts`; `random.ts` (`market` em `RNG_STREAMS`), `advance.ts`, `commands.ts` (**novo** `trade`), `rejections.ts`, `types.ts`, `migrations/v<N>.ts`, `view.ts`; protocolo; **novo** `packages/server/test/market.test.ts`; `packages/sim-cli/src/bots/policies.ts`.

- [ ] V3E-T1.1 Conteúdo (premissa 16): `market: { resources: ['food', 'wood', 'stone']; basePrice: { food: 1000, wood: 1200, stone: 2000 } (milésimos de ouro por unidade); sellRatio: 17/20; dailyVolumePerLevel: 200; walk: { maxStepPerMille: 50; reversion: 1/10; floor: 3/5; ceiling: 8/5 }; seasonal: { food: { autumn: 13/10, winter: 13/10 } } }`.
- [ ] V3E-T1.2 Preço: guardado em milésimos de ouro. Na virada de cada dia de jogo, **só se o Mercado existe**, o motor sorteia no fluxo `market`, por recurso e na ordem do conteúdo, um passo inteiro entre −50 e +50 por mil; aplica o passo e a reversão à média (um décimo da distância até a base), em uma conta só com um arredondamento para baixo; e limita o resultado entre o piso e o teto. O fator da estação e os efeitos de carta (V3F-T1) multiplicam o preço exibido, sem alterar o passeio. O `breakdown` diz "1,30 = 1,00 (base) × 1,3 (outono)".
- [ ] V3E-T1.3 Volume: `tradedToday` por recurso soma compra **e** venda; o limite é `200 × nível do Mercado`; zera na virada do dia de jogo, no mesmo passo do preço. O limite é por dia de jogo: uma visita nunca negocia mais do que o volume de um dia, por mais tempo que tenha passado.
- [ ] V3E-T1.4 Comando `trade { resource; direction: 'buy' | 'sell'; amount; quoteDay }`: recusas `MARKET_REQUIRED`, `INVALID_AMOUNT`, `DAILY_VOLUME_EXCEEDED` (dizendo quanto ainda cabe hoje), `INSUFFICIENT_RESOURCES`, `STORAGE_FULL` (uma compra que não cabe no cap é recusada inteira, não cortada) e `PRICE_CHANGED` (o dia de jogo virou entre a cotação e a ordem; a visão nova vem em `details`). O jogador compra pelo preço do dia e vende a 17/20 dele. O ouro pago arredonda para cima e o recebido, para baixo, em milésimos. Evento `marketTraded` com as quantidades exatas.
- [ ] V3E-T1.5 Crônica sem ruído: a mudança diária de preço não gera linha. Há um evento (`marketPriceSwing`) só quando um preço cruza 80% ou 125% da base, como a Ameaça da v0.2 só fala ao cruzar marcas.
- [ ] V3E-T1.6 `ViewState`: `market: { level; quoteDay; nextChangeInSeconds; prices: Array<{ resource; buy; sell; baseText; trend: 'up' | 'down' | 'flat'; breakdown; remainingToday; maxBuyable; maxSellable }> }`. O preço de amanhã não sai do servidor.
- [ ] V3E-T1.7 Bot: políticas "vender o recurso que enche em menos de 8 h, até o volume do dia" e "comprar madeira quando o inverno chega e a lenha não fecha". As duas leem só a visão.
- [ ] V3E-T1.8 Testes: preço dentro do piso e do teto por dois anos em 50 sementes; mesma semente, mesmos preços; vender exatamente até o limite e ser recusado na unidade seguinte; o limite zera na virada; comprar no cap; ordem no instante da virada; 30 dias sem acesso sorteiam o mesmo que 30 dias de visitas; propriedade com o passeio no caminho; nenhuma sequência de compra e venda no mesmo dia dá lucro; integração: `trade` com duplo envio negocia uma vez, e o reenvio depois da virada devolve o recibo original.

**Diversão:** o Mercado transforma "sobrou" em "quanto vale hoje". O volume diário impede que uma visita resolva tudo, e o preço que muda dá motivo para olhar. O teste é o autor ver "madeira cheia em 3h" e escolher entre o Armazém e o Mercado na mesma tela.

**Verificação:**

```bash
pnpm --filter @lotg/content test
pnpm --filter @lotg/engine test -- market
pnpm --filter @lotg/engine test -- economy.property
TEST_DATABASE_URL=postgres://lotg:lotg@localhost:5433/lotg_test pnpm test:integration market
```

**Pronto quando:** critério 4 da §16.2 provado por unidade, propriedade e integração, e a visão explica cada preço.

**Prompt sugerido:** "Leia CLAUDE.md, GAME_DESIGN.md §5.9 e §4.1, docs/decisions/0016-…md, docs/roadmap-v0.3.md V3E-T1 e Apêndice B, e packages/engine/src/random.ts. Apresente o plano (conteúdo, passeio do preço em inteiros, volume diário, comando trade, ViewState) e espere aprovação. Primeiro o teste 'nenhuma sequência de compra e venda dá lucro' e o do limite diário."

### V3E-T2 · Caravanas `M`

**Objetivo:** com o Mercado Nv2, mandar até 300 unidades a Porto do Rio por um preço melhor, com risco de emboscada que a escolta e a Torre reduzem (critério 5).
**GDD:** §5.9, §6.1 (Torre de Vigia), §9.1 (um herói faz uma coisa por vez), §16.2.
**Depende de:** V3E-T1, V3D-T1 (estado do herói), V3B-T1 (fluxo `caravan:<id>`). **Da v0.2 usa:** o nível da Torre de Vigia; o padrão "prazo e preço fixados no início".
**Decisões:** 9, 17.
**Trilha:** motor.
**Entregáveis:** `packages/content/src/balance.ts` (`market.caravan`), `chronicle.ts`; `packages/engine/src/market.ts` (ou **novo** `caravans.ts` se crescer), `heroes.ts`, `timeline.ts`, `advance.ts`, `commands.ts` (**novo** `sendCaravan`), `rejections.ts`, `types.ts`, `migrations/v<N>.ts`, `view.ts`; protocolo; `packages/server/test/market.test.ts`.

- [ ] V3E-T2.1 Conteúdo (premissa 17): `market.caravan: { requiresLevel: 2; maxUnits: 300; tripMs: 4 h de jogo; priceRatio: 7/5; slotsByLevel: [0, 1, 1, 2, 2]; ambush: { basePercent: 10; perWatchtowerLevel: 5; floorPercent: 2; lossRatio: 1/2 } }`.
- [ ] V3E-T2.2 Comando `sendCaravan { resource; amount; escortHeroId? }`: recusas `MARKET_LEVEL_REQUIRED`, `CARAVAN_LIMIT`, `INVALID_AMOUNT`, `INSUFFICIENT_RESOURCES`, `HERO_UNAVAILABLE`. A carga sai do estoque no envio. O preço por unidade é o de venda do dia vezes 7/5, **fixado no envio** e mostrado antes de confirmar. A caravana não conta no volume diário. Evento `caravanSent`.
- [ ] V3E-T2.3 Chegada: evento da linha do tempo em `arrivesAtMs`. Com escolta, não há sorteio. Sem escolta, um sorteio no fluxo `caravan:<id>`, com chance de `máx(2, 10 − 5 × nível da Torre)` por cento. Emboscada: perde metade da carga, arredondada para baixo; a outra metade é vendida. O ouro entra, o herói da escolta volta a `idle`, o fluxo é apagado. Eventos `caravanArrived` e `caravanAmbushed`, com as quantidades.
- [ ] V3E-T2.4 `ViewState`: `market.caravans[]` (carga, preço fixado, `arrivesInSeconds`, escolta) e `market.caravanOffer: { available; blockedReason; maxUnits; priceRatioText; tripSeconds; riskText; riskBreakdown }`. O risco é explicado termo a termo ("10% na estrada, −5 pela Torre de Vigia Nv1; com escolta, nenhum"). O desfecho não sai antes da chegada.
- [ ] V3E-T2.5 Bot: política "caravana com o excedente quando há herói ocioso; sem herói, só se a Torre estiver no nível 2".
- [ ] V3E-T2.6 Testes: a matriz QA-10 (com e sem escolta × Torre 0, 1 e 2): a emboscada só é possível sem escolta; em 1.000 caravanas de teste, a frequência fica na faixa esperada; preço fixado no envio mesmo com a virada do dia no caminho; herói ocupado até a chegada; duas caravanas chegando no mesmo instante; propriedade; integração com o relógio adiantado.

**Diversão:** a caravana é a primeira aposta do jogo: mais ouro, mais tarde, talvez metade. A escolta custa um herói parado. O teste é o autor hesitar entre escoltar e mandar a mesma heroína ao Covil.

**Verificação:**

```bash
pnpm --filter @lotg/engine test -- market
pnpm --filter @lotg/engine test -- random.property
TEST_DATABASE_URL=postgres://lotg:lotg@localhost:5433/lotg_test pnpm test:integration market
```

**Pronto quando:** critério 5 da §16.2 provado por cenário com semente fixa em que uma caravana é emboscada, e pela matriz QA-10.

**Prompt sugerido:** "Leia CLAUDE.md, GAME_DESIGN.md §5.9, docs/decisions/0016-…md, docs/roadmap-v0.3.md V3E-T2 e Apêndice B. Apresente o plano (envio com preço fixado, chegada como evento, emboscada sorteada no fluxo da caravana, escolta) e espere aprovação. Primeiro a matriz QA-10 como teste."

### V3E-T3 · Mestres `M`

**Objetivo:** aldeões nomeados e raros que trabalham em um edifício produtivo e dão +15% a ele.
**GDD:** §5.3, §5.4 ("Mestres: aldeões nomeados e raros (cartas, expedições) que ocupam um posto e dão +15% ao edifício"), Apêndice B (carta 2b, "um Mestre chega").
**Depende de:** V3E-T2. **Da v0.2 usa:** a conta única da produção (ADR 0013, 13a), a adaptação por coortes e a experiência do ofício (V2C-T3), o piso de população e as regras de quem parte ou se fere (V2C-T4, V2E-T3), a habitação.
**Decisões:** 18.
**Trilha:** motor.
**Entregáveis:** **novo** `packages/content/src/masters.ts` (Mestres nomeados e `balance.masters`), `chronicle.ts`, `expeditions.ts` (recompensa `addMaster`); **novo** `packages/engine/src/masters.ts`; `economy.ts`, `population.ts`, `morale.ts` †, `commands.ts` (**novo** `assignMaster`), `rejections.ts`, `types.ts`, `migrations/v<N>.ts`, `view.ts`; protocolo.

- [ ] V3E-T3.1 Conteúdo (premissa 18): `masters: { bonus: 3/20; maxPerBuilding: 1 }` e uma lista de Mestres nomeados, cada um com nome e ofício de origem (só narrativa: o bônus vale em qualquer edifício produtivo).
- [ ] V3E-T3.2 Estado: `settlement.masters[]` com `id`, `name`, `building` (ou `null`) e `adaptingUntilMs`; `settlement.mastersWaiting[]` para quem chegou sem vaga. O Mestre conta como habitante (casa e comida) e, quando alocado, como um trabalhador do edifício.
- [ ] V3E-T3.3 Chegada: por recompensa de expedição ou efeito de carta (`addMaster`). Com vaga, entra livre; sem vaga, espera à porta e entra no primeiro instante em que houver vaga (junto com os aldeões que chegam, na ordem fixa). Uma recompensa nunca se perde. Eventos `masterArrived` e `masterWaiting`.
- [ ] V3E-T3.4 Bônus: o fator `mestre` (23/20) entra na conta única da produção do edifício, com a sua linha na explicação; dois Mestres no mesmo edifício não somam, e por isso o segundo é recusado. Trocar um Mestre de edifício passa pela adaptação de 1 dia de jogo, sem o bônus enquanto durar.
- [ ] V3E-T3.5 Comando `assignMaster { masterId; building }` (`building: null` o deixa livre): recusas `MASTER_NOT_FOUND`, `BUILDING_HAS_MASTER`, `NOT_A_PRODUCTION_BUILDING`. Evento `masterAssigned`.
- [ ] V3E-T3.6 Proteção: um Mestre nunca é escolhido por deserção, partida por moral ou ferimento de incursão. Ele conta para o piso de população.
- [ ] V3E-T3.7 `ViewState`: `masters[]` (nome, onde trabalha, `adaptationEndsInSeconds`, `bonusPercent`), `mastersWaiting`, e em `workers[]` o Mestre do edifício com a linha no `breakdown` ("× 1,15 (Mestre Odo)").
- [ ] V3E-T3.8 Testes: chegada com e sem vaga; bônus exato em milésimos, sozinho e com estação, moral, mestria, fome e frio; troca com adaptação; deserção e incursão não o escolhem; fome com Mestre; propriedade; golden.

**Diversão:** o Mestre é a recompensa que fica. Ele faz o jogador querer voltar à Fazenda e pensar onde ele rende mais. O teste é o autor mudar o Mestre de edifício antes do outono, porque a tela mostra o quanto ele soma.

**Verificação:**

```bash
pnpm --filter @lotg/content test
pnpm --filter @lotg/engine test -- masters
pnpm --filter @lotg/engine test -- economy
pnpm --filter @lotg/engine test -- population
```

**Pronto quando:** um Mestre chega por expedição, trabalha, soma 15% com a explicação, e nenhuma regra de perda de população o alcança.

**Prompt sugerido:** "Leia CLAUDE.md, GAME_DESIGN.md §5.3 e §5.4, docs/decisions/0013 e 0016, docs/roadmap-v0.3.md V3E-T3 e Apêndice B. Apresente o plano (estado, chegada com e sem vaga, fator na conta única, adaptação, proteção) e espere aprovação. Testes primeiro."

### V3E-T4 · Mercado, caravanas e Mestres na interface `M`

**Objetivo:** comprar e vender vendo o preço, a base e o volume que resta; mandar uma caravana vendo preço, prazo e risco; alocar um Mestre vendo o que ele soma.
**GDD:** §13.1 (aba Mercado), §13.2, §13.3, §13.5, §13.6.
**Depende de:** V3E-T3 (o Mercado pode começar depois de V3E-T1).
**Trilha:** app.
**Entregáveis:** **nova** aba `packages/web/src/tabs/Market.tsx`; **novos** `components/MarketPanel.tsx` e `components/CaravanPanel.tsx`; `components/WorkersPanel.tsx` (Mestre), `components/ResourcesTable.tsx` (atalho "Vender" ao lado de "cheio em"), `app/router.ts` (`#/mercado`), `app/controller.ts`, `palette/commands.ts` (`lords.trade`, `lords.sendCaravan`, `lords.assignMaster`), `ui/treeModel.ts`, `notifications/policy.ts`; **novo** `tests/e2e/10-mercado.spec.ts`.

- [ ] V3E-T4.1 Primeira tela funcional ao autor: a tabela de preços com compra, venda, tendência e "cabem mais 140 hoje".
- [ ] V3E-T4.2 Negociar: quantidade por teclado ou botões de 10, 50 e "o máximo de hoje"; o total em ouro aparece antes de confirmar; `PRICE_CHANGED` mostra o preço novo e pede nova confirmação, sem reenviar sozinho; "Tentar de novo" em falha de rede reenvia a mesma ordem.
- [ ] V3E-T4.3 Caravana: recurso, quantidade, escolta opcional (lista dos heróis livres), com preço fixado, chegada e risco explicado; em trânsito, a linha "Caravana a Porto do Rio · 240 madeira · chega em 52 min".
- [ ] V3E-T4.4 Mestre: no painel de trabalhadores, o Mestre de cada edifício e a ação "Mover Mestre…", com o custo da troca antes de confirmar.
- [ ] V3E-T4.5 Árvore e avisos: "Mercado · comida 1,3 ▲ · madeira 1,1 ▼"; a emboscada é aviso essencial; a chegada sem emboscada só entra em "Todas".
- [ ] V3E-T4.6 Testes: unidade sem DOM; navegador: vender até o limite e ver a recusa com a frase; a virada do dia libera o volume; mandar caravana com e sem escolta; só com o teclado, nos três temas e em 720 px; duplo clique vende uma vez.

**Diversão:** a tabela de preços tem de se ler em cinco segundos. O teste é o autor vender o excedente em uma sessão de dois minutos e dizer quanto ainda poderia vender hoje.

**Verificação:**

```bash
pnpm --filter @lotg/web test
pnpm test:e2e 10-mercado
```

**Pronto quando:** critérios 4 e 5 provados em navegador, e o Mestre aparece e se move pelo painel de trabalhadores.

**Prompt sugerido:** "Leia CLAUDE.md, GAME_DESIGN.md §13.1 a §13.6, docs/roadmap-v0.3.md V3E-T4 e packages/web/README.md. Apresente o plano (aba Mercado, negociar, caravana, Mestre, avisos, testes) e espere aprovação. Me mostre a tabela de preços funcionando antes de completar a tela."

### V3E-T5 · Revisão independente e balanceamento da Fase E `S`

**Objetivo:** revisão de leitura da fase e a rodada do simulador que responde se o Mercado deu saída ao excedente.
**Depende de:** V3E-T1 a V3E-T4.

- [ ] V3E-T5.1 Revisor independente tenta: lucro por compra e venda repetidas, no mesmo dia e atravessando a virada; passar do volume diário com duas abas; comprar acima do cap; saber o desfecho da caravana antes da chegada; escoltar com um herói em expedição; Mestre perdido por deserção, incursão ou falta de vaga.
- [ ] V3E-T5.2 Simulador, a matriz inteira: desperdício e excedente parado contra a linha de base de V3A-T1; parcela do volume diário usada; ouro ganho por venda, por caravana e pela mina; emboscadas. Se o Mercado virar a melhor fonte de ouro em todo perfil, ou não for usado em nenhum, vai ao autor.
- [ ] V3E-T5.3 O autor joga, no ritmo 3: vende um excedente, manda uma caravana sem escolta e outra com, recebe um Mestre e o aloca. Mesclar `v3e-mercado` só com a aprovação dele.

**Pronto quando:** defeitos confirmados corrigidos com teste; a pergunta do GDD §17.2 respondida com números; o autor jogou e aprovou.

**Prompt sugerido:** "Leia CLAUDE.md e docs/roadmap-v0.3.md V3E-T5. Lance o revisor independente (Apêndice A.4) sobre o branch v3e-mercado, rode a matriz do simulador, compare com a linha de base em docs/balance-v0.3.md e me prepare o roteiro para eu jogar a fase."

---

## 6. Fase F — Lote 2 do Conselho e objetivos

**Meta da fase:** o Conselho passa a usar o que a v0.3 trouxe (heróis, expedições, Mercado, Mestres), os objetivos ensinam as ferramentas novas, e o Retorno conta a ausência com a equipe dentro. Branch `v3f-conselho`.

O que o jogador deve conseguir ao fim da fase: receber uma carta em que um traço de herói abre uma opção, acompanhar uma cadeia que nasceu de uma expedição, e voltar depois de horas fora entendendo o que a equipe fez.

### V3F-T1 · Cartas da v0.3: efeitos novos e o lote 2 `L`

**Objetivo:** os efeitos e requisitos de carta que dependem das mecânicas da v0.3, e o segundo lote de cartas, escrito pelo agente e aprovado pelo autor carta a carta.
**GDD:** §7.1 (meta de 60 cartas, 5 cadeias, 6 roteirizadas), §7.2 (`heroTrait`, `reveal`, `addHero`), §5.9 (efeitos de carta nos preços), Apêndices B e D, §18.3.
**Depende de:** V3E-T5; V3C-T3 (efeito `addHero`). **Da v0.2 usa:** o motor do Conselho inteiro (flags, continuações com prioridade, efeitos adiados e ocultos, `autoResolve`, cadência ancorada, virada de ano) e o lote 1 de 21 cartas.
**Decisões:** 19, 21.
**Trilha:** motor e documentos.
**Entregáveis:** `packages/content/src/council.ts` † (efeitos e requisitos novos), `packages/content/src/cards/` † (uma cadeia por arquivo: **novos** `mysterious-merchant.ts`, `refugees.ts`, `white-wolf.ts`, `kings-collector.ts`; `scripted.ts`; as avulsas no arquivo de avulsas da v0.2), `chronicle.ts`; `packages/engine/src/council.ts` †, `market.ts`, `expeditions.ts`, `view.ts`; `docs/content-v0.3.md`; testes de conteúdo e goldens; política do bot.

- [ ] V3F-T1.1 Efeitos novos, cada um com teste: `addMaster`; `revealTile` (acrescenta um destino à lista); `unlockExpedition` (abre uma expedição especial, uma vez); `marketPrice { resource; factor; durationDays }` (multiplica o preço exibido por alguns dias de jogo, com a sua linha na explicação do preço); `setFlag` a partir do desfecho de uma expedição (é assim que "O Lobo Branco" sabe que o Covil foi limpo).
- [ ] V3F-T1.2 Efeito com sorteio, `chance { ratio; then; else }` (a "Praga nos campos" do Apêndice B): **nunca é resolvido no comando**, porque `applyCommand` não sorteia. A resposta agenda o efeito para a virada de dia seguinte, e é nesse evento da linha do tempo que o motor sorteia, no fluxo `council`. A carta diz a chance em palavras e em número; o resultado vira evento (`cardEffectApplied`) no instante em que acontece.
- [ ] V3F-T1.3 Requisitos novos: `heroTrait` e `heroClass` em opções ("Negociar: requer um herói Carismático"), satisfeitos por um herói da equipe que não esteja capturado; `buildings` com Taverna, Mercado e Guilda; `flags` gravadas por expedições. A opção bloqueada diz o que falta. As três opções de `autoResolve` continuam sem custo e sem requisito.
- [ ] V3F-T1.4 O lote 2 (premissa 19, §13.3): **4 cadeias de 3 cartas** ("O Mercador Misterioso", "Os Refugiados", "O Lobo Branco", "O Cobrador do Rei"), **2 roteirizadas** ("Estrangeira ferida", já entregue em V3C-T3, e "O mercador itinerante") e **10 avulsas**: 24 modelos. Com as 21 do lote 1, o jogo fica com **45 das 60** cartas da meta do GDD.
- [ ] V3F-T1.5 Adaptações registradas no inventário e no ADR 0016: "O Lobo Branco" sem relíquia, presságio nem cerco; "O Cobrador do Rei" sem batalha; "A Filha do Ferreiro" não entra (exige o Ferreiro).
- [ ] V3F-T1.6 Convivência com o lote 1: a avulsa "Mais bocas à mesa" da v0.2 trata de refugiados sem Mestre. Ela e a cadeia "Os Refugiados" se excluem por flag (`notFlags`), para o jogador não receber as duas no mesmo ano.
- [ ] V3F-T1.7 Para cada carta, a ficha da §13.4, escrita primeiro em `docs/content-v0.3.md`, apresentada ao autor em lotes de 5 e só então transcrita. Para cada opção, um cenário em que ela é a escolha razoável e um em que é ruim.
- [ ] V3F-T1.8 Cadeias: percorrer cada ramo (aceitar, recusar, expirar, com e sem o herói que abre a opção extra); a continuação chega no prazo com 2 pendentes na frente; a cadeia atravessa estação e ano. "Sua escolha voltou" vale como na v0.2.
- [ ] V3F-T1.9 Cobertura: em 50 sementes, quantas cartas são elegíveis por estação, por nível do Salão e **por posse** (sem herói; com herói e sem Guilda; com Guilda; com Mercado). Um jogador que não construiu nada da v0.3 não pode ficar sem cartas: o lote 1 continua elegível.
- [ ] V3F-T1.10 Testes de conteúdo: schema; flags consistentes; continuações alcançáveis; todo `heroTrait` exigido existe no conteúdo; nenhuma referência a ferro, arma, exército, combate, presságio ou relíquia; cenário no motor que percorre "Os Refugiados" até o Mestre chegar e "O Lobo Branco" a partir de uma expedição; golden.
- [ ] V3F-T1.11 Inventário: o que falta para as 60 (15 cartas: "A Filha do Ferreiro", o ramo de batalha do Cobrador, quatro roteirizadas e as avulsas de guerra), para o lote 3 da v0.4.

**Diversão:** é quando a equipe começa a importar fora das expedições. O teste é o do GDD §7.1: toda opção é a melhor em algum contexto. Se a opção do herói for sempre a melhor, a carta virou um prêmio por ter herói, e não um dilema.

**Verificação:**

```bash
pnpm --filter @lotg/content test
pnpm --filter @lotg/engine test -- council
pnpm --filter @lotg/engine test -- scenario
pnpm -s sim -- --seed pedra-alta-001 --game-year --time-scale 3 --strategy explorador 2>&1 >/dev/null | grep -i carta
```

**Pronto quando:** as 24 cartas aprovadas pelo autor no inventário, duas cadeias provadas de ponta a ponta por cenário, e a cobertura por posse registrada.

**Prompt sugerido:** "Leia CLAUDE.md, GAME_DESIGN.md §7, Apêndices B e D e §18.3, docs/decisions/0014 e 0016, docs/content-v0.2.md, docs/roadmap-v0.3.md V3F-T1 e §13. Primeiro apresente o plano dos efeitos e requisitos novos e espere aprovação. Depois escreva as cartas em docs/content-v0.3.md com a ficha da §13.4, cinco por vez, e espere a minha aprovação de cada lote antes de transcrever. Tom de crônica medieval, frases curtas."

### V3F-T2 · Objetivos do Senhor da v0.3 `S`

**Objetivo:** os objetivos seguintes ao 10 que a v0.3 consegue cumprir, na ordem em que cada ferramenta nova resolve um problema já sentido.
**GDD:** §12.2 (os objetivos marcados `[v0.3]`).
**Depende de:** V3C-T4, V3D-T4, V3E-T4. **Da v0.2 usa:** os objetivos 1 a 10, a regra "nunca mais de 3 ativos" e as recompensas em moral temporária.
**Decisões:** 20.
**Trilha:** motor e app.
**Entregáveis:** `packages/content/src/objectives.ts` (condições novas: `heroCount`, `expeditionSent`, `crossroadsChosen`, `tradeDone`, `expeditionCompleted`), `schemas.ts`; `packages/engine/src/objectives.ts`, `view.ts`; árvore, painel e navegador.

- [ ] V3F-T2.1 Lista da v0.3 (premissa 20), com identificadores estáveis e os de 1 a 10 intocados: 11 `welcomeFirstHero` ("Acolha ou contrate o primeiro herói", item comum, GDD); 12 `buildGuild` ("Erga a Guilda dos Aventureiros: quem recebe soldo precisa de trabalho", +60 pedra); 13 `sendPatrol` ("Envie uma Patrulha", +50 ouro, GDD); 14 `sellSurplus` ("Venda no Mercado o que iria para o chão", +40 madeira); 15 `chooseAtCrossroads` ("Escolha um caminho em uma encruzilhada", +10 de moral por 1 dia de jogo); 16 `exploreRuins` ("Explore as Ruínas de Vel'Thar", item incomum, GDD). Os de exército continuam fora, sem buraco na sequência.
- [ ] V3F-T2.2 Partida migrada: o que já foi cumprido antes da migração conta na avaliação seguinte e paga uma vez.
- [ ] V3F-T2.3 Percorrer a sequência por teclado e por bot.

**Diversão:** cada objetivo aparece quando o problema já existe: a Guilda depois do primeiro soldo, o Mercado depois do primeiro "cheio em". Sem tarefa diária, sem prêmio por login.

**Verificação:**

```bash
pnpm --filter @lotg/content test
pnpm --filter @lotg/engine test -- objectives
pnpm test:e2e 05-teclado-e-temas -g "objetivos"
```

**Pronto quando:** um cenário roteirizado conclui os objetivos 11 a 16 na ordem aprovada, em partida nova e migrada.

**Prompt sugerido:** "Leia CLAUDE.md, GAME_DESIGN.md §12.2, docs/decisions/0016-…md e docs/roadmap-v0.3.md V3F-T2. Adicione os objetivos 11 a 16 com condições novas no conteúdo e no motor, teste de cenário completo e o teste em navegador por teclado."

### V3F-T3 · Retorno e "Antes de partir" com a Guilda `M`

**Objetivo:** o Relatório de Retorno e a seção "Antes de partir" passam a contar a equipe, as expedições, o soldo e o Mercado. É interface sobre o que o `ViewState` e os eventos já trazem; nenhuma regra nova.
**GDD:** §2.3 (passos 1 e 4: "lança processos para a próxima ausência: expedição, caravana"), §13.5, §15.1 (itens 1, 2 e 5).
**Depende de:** V3F-T1. **Da v0.2 usa:** `beforeLeaving` (V2C-T6) e o Retorno em três blocos (V2D-T4).
**Decisões:** 21.
**Trilha:** app.
**Entregáveis:** `packages/web/src/game/beforeLeaving.ts` †, `game/returnReport.ts`, `components/Today.tsx`, `tabs/Today.tsx`, `notifications/policy.ts`, `workbench/StatusBar.tsx`; `packages/protocol/src/report.ts`; `tests/e2e/03-retorno-e-conexao.spec.ts`.

- [ ] V3F-T3.1 "Antes de partir" ganha, na ordem de prioridade e ainda com o teto de cinco itens: encruzilhada esperando ("A equipe espera nas Ruínas: a Postura decide em 2h → Escolher caminho"); ouro que não paga o soldo por 24 h reais ("O ouro paga a equipe por mais 5h → Vender excedente"); herói livre com expedição disponível ("Edda está livre → Enviar em Patrulha"); recurso cheio em menos de 8 h, agora com a saída do Mercado ("Madeira cheia em 3h → Vender: cabem 140 hoje"); candidato que sai na rotação. Todos os números vêm da visão.
- [ ] V3F-T3.2 Retorno em três blocos: "prosperou" recebe expedição concluída com o saque, nível novo, caravana que chegou, Mestre que chegou, venda feita; "custou" recebe herói ferido, capturado ou que partiu, soldo em atraso, emboscada; "ainda pode decidir" recebe a encruzilhada pendente, o herói livre e o volume de hoje sem uso com o estoque perto do cap. A expedição decidida pela Postura entra no bloco do seu desfecho, com a marca "decidido pela Postura".
- [ ] V3F-T3.3 Cada item de "custou" tem a próxima ação ("Rolf foi capturado no Pântano → Enviar o Resgate").
- [ ] V3F-T3.4 Avisos: encruzilhada e captura são essenciais (GDD §13.5); retorno de expedição, chegada de caravana e nível novo só em "Todas". O limite de 3 avisos por hora continua.
- [ ] V3F-T3.5 Testes: unidade das funções puras com visões e eventos sintéticos (cada regra, ordem, teto, nenhum item); navegador: saltar 6 h com uma expedição que voltou, um herói ferido, uma caravana emboscada e uma encruzilhada esperando, e conferir os três blocos e os botões.

**Diversão:** é a mecânica mais barata e mais importante para quem joga uma vez por dia: sair com a equipe ocupada e o ouro garantido, e voltar para uma história. O teste é o autor, em dois minutos, dizer se deixou o feudo e a equipe preparados só com a aba Hoje.

**Verificação:**

```bash
pnpm --filter @lotg/web test -- beforeLeaving
pnpm --filter @lotg/web test -- returnReport
pnpm test:e2e 03-retorno-e-conexao -g "Guilda"
```

**Pronto quando:** a aba Hoje mostra os itens novos com ação, e o Retorno distribui os eventos da v0.3 nos três blocos sem omitir nem duplicar.

**Prompt sugerido:** "Leia CLAUDE.md, GAME_DESIGN.md §2.3 e §13.5, docs/roadmap-v0.3.md V3F-T3 e packages/web/README.md. Apresente o plano (regras novas de beforeLeaving, blocos do Retorno, avisos) e espere aprovação. Funções puras com testes sem DOM antes dos componentes; nenhuma regra de jogo no app."

### V3F-T4 · Revisão independente e editorial da Fase F `S`

**Objetivo:** conferir o Conselho com o lote 2 e o Retorno com a Guilda; o autor joga uma cadeia que depende da equipe.
**Depende de:** V3F-T1 a V3F-T3.

- [ ] V3F-T4.1 Revisor independente tenta: cumprir um requisito de traço com um herói capturado; receber duas vezes o herói ou o Mestre de uma carta; resolver um efeito com sorteio pelo comando; cadeia que trava quando o herói que a abriu parte ou morre; efeito de preço que sobrevive ao prazo.
- [ ] V3F-T4.2 Revisão editorial carta a carta, como em V2D-T5.2, mais: a opção do herói não domina; a carta não promete o que é de versão futura.
- [ ] V3F-T4.3 Simulador: cartas vistas, respondidas e expiradas por perfil; cadeias iniciadas e concluídas, com e sem equipe.
- [ ] V3F-T4.4 O autor joga "Os Refugiados" até o Mestre chegar, no ritmo 3. Mesclar `v3f-conselho` só com a aprovação dele.

**Pronto quando:** defeitos confirmados corrigidos com teste; nenhuma opção dominante; o autor jogou e aprovou.

**Prompt sugerido:** "Leia CLAUDE.md e docs/roadmap-v0.3.md V3F-T4. Lance o revisor independente (Apêndice A.4) sobre o branch v3f-conselho, faça a revisão editorial das 24 cartas, rode o simulador e me prepare o roteiro para eu jogar 'Os Refugiados'."

---

## 7. Fase G — Fechamento da v0.3

**Meta da fase:** os critérios da §16.2 provados, a v0.3 jogada por pessoas, versão etiquetada. No `main` (§0.8).

### V3G-T1 · Balanceamento com o simulador `M`

**Objetivo:** bots que jogam a v0.3 inteira e faixas que a CI confere.
**GDD:** §15.2, §15.3.
**Depende de:** Fases C a F.
**Trilha:** motor.
**Entregáveis:** `packages/sim-cli/src/bots/` (políticas de C a F reunidas no `explorador`; o `preguicoso` com as decisões mínimas), `bands.ts`, `balance.test.ts`, `docs/balance-v0.3.md`; ajustes aprovados em `content`, GDD e goldens.

- [ ] V3G-T1.1 A matriz da §8.3 com estratégias e sementes congeladas: 50 sementes × perfis de 1, 2 e 4 visitas × ritmos × dificuldades; um ano de jogo e 7 dias reais em tabelas separadas.
- [ ] V3G-T1.2 Medir: hora do primeiro herói, da Guilda, da Taverna e do Mercado; ouro (ganho por fonte, gasto por destino, horas de atraso); heróis contratados, feridos, capturados, que partiram; expedições por modelo e desfecho; encruzilhadas pelo jogador e pela Postura; horas de herói ocioso; volume negociado e parcela do limite; caravanas e emboscadas; Mestres; e, da v0.2, desperdício, excedente, frio, fome e fila ociosa, contra a linha de base.
- [ ] V3G-T1.3 Extremos antes das médias: as sementes que falham são repetidas à mão. Com sorteios em sete fluxos, a dispersão entre sementes é parte do resultado.
- [ ] V3G-T1.4 Metas aplicáveis do GDD §15.2: primeiro herói no dia real 2 do ritmo Normal (Regular); população de 30 a 40 no fim do ano (Regular, Senhor, Normal); nenhum recurso desperdiçando por mais de 8 h de jogo contínuas (Regular). Vitória no cerco não se aplica.
- [ ] V3G-T1.5 Ajustes aprovados pelo autor em `content`, com GDD e goldens no mesmo commit. Nunca facilitar o bot para esconder uma economia ruim.
- [ ] V3G-T1.6 Desempenho de novo: avanço longo (no 3×, 36 viradas de dia por dia real, cada uma agora com preço e volume do Mercado), tamanho do estado, da visão e dos recibos, p95 local com 50 bots, contra V3A-T1.8 e `docs/perf-v0.1.md`.

**Diversão:** o simulador mede tédio (herói parado, ouro parado, Mercado sem uso) e desespero (soldo em atraso, equipe capturada). Os dois têm de ficar dentro das faixas antes de pessoas jogarem.

**Verificação:**

```bash
pnpm --filter @lotg/sim-cli test
pnpm -s sim -- --matrix > matriz.csv 2> matriz.md
pnpm -s sim -- --seed pedra-alta-001 --game-year --time-scale 3 --sessions-per-day 1 --strategy preguicoso > /dev/null
```

**Pronto quando:** as metas aplicáveis estão dentro da faixa em 50 sementes, ou cada desvio tem decisão do autor.

**Prompt sugerido:** "Leia CLAUDE.md, GAME_DESIGN.md §15.2 e §15.3, docs/roadmap-v0.3.md V3G-T1 e §8.3, e docs/balance-v0.3.md. Complete os bots com as políticas de C a F, rode a matriz e me traga os extremos; não mude número nenhum sem a minha resposta."

### V3G-T2 · Critérios de aceitação da v0.3 `M`

**Objetivo:** um quadro para os cinco critérios da §16.2, com prova automática e prova em produção, **preenchido durante o teste**.
**Depende de:** V3G-T1.
**Trilha:** documentos.
**Entregáveis:** **novos** `docs/acceptance-v0.3.md` e `docs/manual-test-v0.3.md`.

- [ ] V3G-T2.1 Quadro com os cinco critérios e os cenários QA-01 a QA-18 (§8.2), com links para os testes e espaço para a evidência manual; distinguir código, desenvolvimento e produção.
- [ ] V3G-T2.2 Jornadas: conta nova e conta migrada da v0.2; um ano inteiro e a virada seguinte; cada ritmo; reenvio de comandos; sem conexão.
- [ ] V3G-T2.3 Navegador e versão em cada observação: Chromium automatizado; Firefox manual; Safari, celular e leitor de tela registrados como verificados ou não.
- [ ] V3G-T2.4 Release candidata com CI verde e o procedimento de reversão; implantar **só com autorização**.

**Pronto quando:** os cinco critérios têm evidência escrita, por critério, com data e navegador.

**Prompt sugerido:** "Leia CLAUDE.md, a aceitação e o roteiro manual da versão anterior e docs/roadmap-v0.3.md V3G-T2 e §8. Crie docs/acceptance-v0.3.md e docs/manual-test-v0.3.md com o quadro vazio e o roteiro, e me guie pelas jornadas, registrando cada evidência na hora."

### V3G-T3 · Playtest da v0.3 `M`

**Objetivo:** repetir o playtest com a v0.3, com o mesmo formulário, as mesmas consultas e as perguntas da §8.3, para comparar com o que houver.
**Depende de:** V3G-T2 (versão implantada com autorização).
**Trilha:** documentos; convidar e rodar consultas em produção são atos do autor.
**Entregáveis:** **novos** `docs/playtest/convite-v0.3.md`, `docs/playtest/formulario-v0.3.md` e `docs/playtest/relatorio-v0.3.md`.

- [ ] V3G-T3.1 Janela de 48 h com 3 a 5 pessoas (novas e retornantes, anotado), versão congelada, ritmo e dificuldade registrados.
- [ ] V3G-T3.2 As perguntas comparáveis das versões anteriores mais as cinco da §8.3.
- [ ] V3G-T3.3 Observação natural separada de cenário guiado, como no [formulário da v0.2](playtest/formulario-v0.2.md): em 48 h no ritmo Rápido a pessoa chega à Guilda e ao Mercado, mas não ao inverno com a equipe; o que as 48 h não cobrem é testado em cenário próprio e registrado à parte.
- [ ] V3G-T3.4 Contagens com denominadores e relatos; nada de "retenção comprovada" com amostra pequena. **Se a v0.1 e a v0.2 não tiverem amostra externa, declarar ausência de linha de base.**

**Pronto quando:** o relatório existe e diz, com números e relatos, se as pessoas lembram de um herói pelo nome.

**Prompt sugerido:** "Leia CLAUDE.md, docs/playtest/ e docs/roadmap-v0.3.md V3G-T3 e §8.3. Prepare a mensagem, o formulário com as perguntas da v0.3 e as consultas; espere eu colar as respostas para montar docs/playtest/relatorio-v0.3.md."

### V3G-T4 · Correções, documentação e release `S`

**Objetivo:** P0 e P1 do playtest corrigidos; documentação em dia; tag `v0.3.0`.
**Depende de:** V3G-T3.

- [ ] V3G-T4.1 Corrigir P0 e P1 com regressão; balanceamento só com o autor.
- [ ] V3G-T4.2 `README.md`, `CLAUDE.md`, `CHANGELOG.md`, GDD e página de apresentação contra o produto entregue (`pnpm capture:landing`). A página só diz do jogo o que o jogo diz de si.
- [ ] V3G-T4.3 `docs/architecture.md` reescrito como arquitetura da v0.3, não anotado.
- [ ] V3G-T4.4 Notas de versão: o que muda nas partidas antigas (a carta da estrangeira chega para quem já passou da data; nada é cortado), e o procedimento de reversão.
- [ ] V3G-T4.5 CI verde no commit candidato; o autor cria a tag e a release.

**Pronto quando:** zero P0 e P1 abertos, CI verde no commit etiquetado, tag criada pelo autor.

**Prompt sugerido:** "Leia CLAUDE.md, docs/playtest/relatorio-v0.3.md e docs/roadmap-v0.3.md V3G-T4. Corrija os P0 e P1 com regressão, atualize a documentação e a página de apresentação para o que foi entregue, e prepare as notas de versão; eu crio a tag."

### V3G-T5 · Preparar a v0.4 `S`

**Objetivo:** `docs/roadmap-v0.4.md` no mesmo formato, com as lições da v0.3.
**Depende de:** V3G-T4.

- [ ] V3G-T5.1 Consolidar o que funcionou, confundiu e trouxe gente de volta, com os casos negativos.
- [ ] V3G-T5.2 Mapear Quartel, Ferreiro, ferro e armas, formações, Conselho de Guerra, Horda, presságios, Fortaleza, sabotagem e Cerco às dependências entregues: herói como comandante de ala, expedições (sabotagem e ataque ao Acampamento usam o mesmo motor), Mercado (ferro), tiles e Ameaça, Hora da Vigília.
- [ ] V3G-T5.3 Lote 3 do Conselho: as 15 cartas que faltam para as 60.
- [ ] V3G-T5.4 Detalhar a primeira tarefa da v0.4 com arquivos, testes, impacto em partidas antigas e evidência de conclusão.

**Pronto quando:** a primeira tarefa da v0.4 está detalhada o bastante para abrir a sessão seguinte.

---

## 8. Critérios de aceitação, cenários integrados e sinais de diversão

### 8.1 Critérios do GDD §16.2 por tarefa

| # | Critério | Tarefas que o entregam | Como provar |
|---|---|---|---|
| 1 | O primeiro herói chega pela carta do dia 2 | V3C-T1, V3C-T3, V3C-T4 | Cenário no motor nas três dificuldades, em partida nova e migrada + integração + navegador |
| 2 | Uma expedição para na encruzilhada, notifica, e após 6 h sem resposta segue a Postura | V3B-T1, V3D-T1, V3D-T4 | Cenário no motor nos três ritmos + integração + navegador com relógio controlado |
| 3 | O relatório narra nó a nó | V3D-T2, V3D-T3, V3D-T4 | Golden do relatório de cada modelo + navegador |
| 4 | O Mercado respeita o volume diário | V3E-T1, V3E-T4 | Unidade, propriedade e integração + navegador |
| 5 | Uma caravana pode ser emboscada | V3E-T2, V3E-T4 | Cenário com semente fixa + a matriz QA-10 + navegador |

"Dia 2" é o dia real 2 do ritmo Normal: o dia 13 de jogo do ano 1 (premissa 6). As "6 h" do critério 2 são reais em qualquer ritmo (premissa 1). O "volume diário" é por dia de jogo (premissa 16).

Entregas que não aparecem nos cinco critérios e continuam obrigatórias: soldo e atraso, Taverna e contratação, moral da Taverna e festival, ferimento, captura e Resgate, experiência e equipamento, Covil limpo, Mestres, o lote 2 do Conselho, os objetivos 11 a 16, e o Retorno com a Guilda. Estão cobertas abaixo.

### 8.2 Matriz de cenários integrados

| ID | Cenário | Resultado a verificar | Tarefas |
|---|---|---|---|
| QA-01 | Carregar uma partida da v0.2 com carta pendente, continuação agendada, efeito de moral, incursão marcada, ferido, planejada automática e estoque acima do cap | Migrada uma vez por passo; nada perdido nem pago de novo; a carta da estrangeira agendada a partir da fronteira; nenhum evento da v0.3 antes da fronteira | V3B-T1, V3C-T3, e cada tarefa que sobe a versão |
| QA-02 | Avançar 30 dias de uma vez, por horas e com cortes aleatórios, com heróis em expedição, soldo em atraso, Mercado, caravana e Mestre | Estado, fluxos de sorteio (inclusive os que nascem e morrem), restos e eventos iguais; entrada não mutada | V3C-T5, V3D-T5, V3E-T5 |
| QA-03 | No mesmo instante: fim de nó, prazo de encruzilhada, chegada de caravana, ouro acabando, virada de dia (preço e volume), rotação da Taverna e carta expirando | Ordem documentada (§0.7), nenhuma cobrança duplicada, nenhum laço | V3D-T5, V3E-T5 |
| QA-04 | Ouro acaba e volta; 12 h e 24 h de jogo em atraso; herói Leal; herói em expedição; ouro que chega por recompensa; dispensa | Instantes exatos; um herói por dia de jogo; Leal fica; sem dívida; sem oscilação | V3C-T1 |
| QA-05 | Contratar com duplo clique, em duas abas, no instante da rotação, no limite e sem ouro | Uma contratação e uma cobrança; recusa com o motivo; oferta que saiu não volta | V3C-T2, V3C-T4 |
| QA-06 | Encruzilhada: o jogador escolhe; o prazo vence no clique; outra aba escolhe; a opção da Postura está bloqueada; 6 h reais em cada ritmo | Uma decisão; mesmo identificador, mesmo recibo; a Cautelosa como reserva; o prazo igual nos três ritmos | V3D-T1, V3D-T4 |
| QA-07 | A mesma expedição com a mesma semente; duas simultâneas; uma terceira enviada no meio | Mesmo relatório (golden); os sorteios de uma não mudam os das outras | V3B-T1, V3D-T1 |
| QA-08 | Desastre nas três dificuldades; captura, Resgate e volta; equipe inteira capturada | Camponês só fere; Senhor captura; Rei de Ferro mata; o Resgate aparece e some; o saque perdido é dito | V3D-T2 |
| QA-09 | Vender até o volume do dia e além; a virada libera; comprar no cap; preço mudou entre a cotação e a ordem; duplo clique | Limite por recurso respeitado; recusa com o que ainda cabe; uma negociação; nenhum lucro no mesmo dia | V3E-T1, V3E-T4 |
| QA-10 | A mesma caravana com e sem escolta, com Torre 0, 1 e 2 | Emboscada só sem escolta; risco e perda como o conteúdo diz; preço fixado no envio; herói solto na chegada | V3E-T2 |
| QA-11 | Mestre: chega com e sem vaga; trabalha; troca de edifício; fome, deserção e incursão no caminho | Nunca se perde; +15% com explicação; adaptação sem bônus; nenhuma regra de perda o escolhe | V3E-T3 |
| QA-12 | A carta roteirizada e uma cadeia do lote 2 com opção de traço, atravessando a virada do ano | Um herói, uma vez; a opção abre e fecha com a equipe; a cadeia chega ao fim em todos os ramos | V3C-T3, V3F-T1 |
| QA-13 | Reabrir depois de 4 h com expedição concluída, herói ferido, emboscada e encruzilhada esperando | Três blocos sem omitir nem duplicar; cada custo com a próxima ação | V3F-T3 |
| QA-14 | API nova com app e cache antigos; recibo antigo; imagem anterior diante de estado novo | 426 se o protocolo subiu; cache descartado e cursor mantido; recibo intocado; a imagem anterior recusa com 500 e não grava | V3D-T1, V3G-T2 |
| QA-15 | Fluxos novos nos três temas, por teclado e em 720 px | Preços, prazos e riscos legíveis; foco; nada só por cor; contraste de 4,5:1 ou mais | V3C-T4, V3D-T4, V3E-T4 |
| QA-16 | Jornada em navegador no ritmo 3 | Prazos do navegador e da API concordam, inclusive o prazo real da encruzilhada | V3D-T4, V3G-T2 |
| QA-17 | Exclusão de conta, renovação de sessão e nova partida depois das mecânicas | Contratos da v0.1 passam; nada atravessa contas; os dados novos entram no expurgo | V3G-T2 |
| QA-18 | Ler o `ViewState` e as respostas HTTP atrás do que não deve sair | Nenhum nó não alcançado, nenhum fluxo de sorteio, nenhuma oferta futura, nenhum preço de amanhã, nenhum desfecho de caravana; o pacote do app sem números do jogo | V3C-T5, V3D-T5, V3E-T5 |

### 8.3 Matriz de balanceamento e sinais de diversão

**Matriz mínima:** perfis de 1, 2 e 4 visitas por dia real × cada ritmo oferecido × cada dificuldade × 50 sementes fixas. Rodar inteira no fechamento (V3G-T1); as rodadas das fases não a substituem.

| Sinal | Como medir | Como usar |
|---|---|---|
| Equipe alcançável | Hora do primeiro herói, da Guilda, da Taverna e do segundo herói | "Primeiro herói no dia 2" é meta do GDD; o resto mostra travas |
| Ouro com destino | Ouro parado; ouro por fonte (mina, venda, caravana, saque) e por destino (soldo, contratação, obras) | O ouro parado tem de cair em relação à linha de base; nenhuma fonte pode dominar em todo perfil |
| Soldo suportável | Horas de soldo em atraso; heróis que partiram | No perfil Preguiçoso, zero partidas causadas só por ausência |
| Equipe ocupada | Horas de herói ocioso com expedição disponível | Detector de tédio da v0.3 |
| Encruzilhada viva | Decididas pelo jogador ÷ todas, por perfil | Se a Postura decide quase tudo em 2 visitas por dia, a janela está errada |
| Risco legível | Desfechos por modelo para a equipe mínima e para a equipe com folga | Um modelo que nunca falha ou nunca passa volta ao autor |
| Mercado útil | Parcela do volume diário usada; desperdício e excedente contra a linha de base | Responde à pergunta em aberto do GDD §17.2 |
| Estrada arriscada | Caravanas com e sem escolta; emboscadas | A escolta tem de ser escolha, não obrigação nem enfeite |
| Herói com nome (humano) | A pessoa diz o nome de um herói e o que aconteceu com ele | É o sinal da promessa da versão |
| Escolha com custo (humano) | O que escolheu na encruzilhada e o que deixou para trás | Boa resposta explica uma troca |
| História para contar (humano) | Um relatório ou uma cadeia que a pessoa reconta | Mede se o texto é lido |
| Peso da interface (humano) | Cliques para enviar uma expedição e para vender; duração da sessão | A versão não pode trocar diversão por microgerenciamento |

**Perguntas adicionais no playtest da v0.3** (ao fim das 48 h, não a cada login):

1. Qual herói você lembra pelo nome? O que aconteceu com ele?
2. Em uma encruzilhada, o que você escolheu e o que deixou para trás? Ou a equipe decidiu sem você?
3. Você leu algum relatório de expedição até o fim? O que ele contava?
4. O que você fez com o que sobrava no estoque? Faltou ouro em algum momento?
5. O que fez você querer voltar: a equipe, uma carta, um preço, outra coisa?

### 8.4 Definição de pronto da versão

- [ ] Os cinco critérios do GDD têm prova automática e evidência manual, por critério, com data e navegador.
- [ ] Soldo, Taverna, expedições, desfechos, equipamento, Mercado, caravanas, Mestres, cartas e objetivos têm os seus cenários integrados cobertos (§8.2).
- [ ] ADRs 0015 e 0016 aprovados, ou "aplicados por delegação" com as pendências escritas; proposta descartada não aparece como funcionalidade entregue.
- [ ] Um feudo novo e um migrado da v0.2 completam um ano e a virada seguinte sem travas, com equipe.
- [ ] Os grafos e as 24 cartas aprovados; o que falta para as 60 cartas está no inventário e no roadmap da v0.4.
- [ ] Matriz de balanceamento rodada; extremos analisados; playtest registrado, ou a ausência dele escrita; zero P0 e P1 abertos.
- [ ] Nada de exército, formação, cerco, ferro, presságio, relíquia ou mapa gráfico entrou, nem como campo vazio.
- [ ] Migração, backup, restauração e reversão com procedimento e ensaio; limites escritos.
- [ ] Documentação, capturas e página de apresentação correspondem ao produto; CI verde no commit candidato; publicação autorizada.

---

## 9. Decisões que esperam o autor, com premissas recomendadas

Os números são estáveis para referência nas tarefas. **Estado em 2026-10-02: nenhuma foi respondida.** São perguntas com uma recomendação: o agente não as aplica sem a resposta do autor, salvo se ele pedir a execução por delegação (§0.6). Cada decisão respondida vira linha de um ADR e deixa de ser pergunta para as tarefas.

Como ler: a coluna "Premissa recomendada" é o que vale se o autor disser "pode ser"; a coluna "Por quê, alternativa e o que validar" diz de onde ela vem, o que foi descartado e que medição a confirma ou derruba.

### 9.1 Lote 1: heróis, Taverna e fundação (V3A-T2 → ADR 0015)

| # | Decisão | Trava | Premissa recomendada | Por quê, alternativa e o que validar | Registro |
|---|---|---|---|---|---|
| 1 | **Relógios da v0.3** | V3C-T1, V3C-T2, V3D-T1, V3E-T1, V3E-T2 | Tudo é **tempo de jogo** e escala com o ritmo (soldo por hora de jogo, atraso de 12 h e 24 h, ferimento de 2 h e 12 h, rotação da Taverna, festival, duração dos nós, viagem da caravana, dia do Mercado), **exceto a espera da encruzilhada: 6 h reais** em qualquer ritmo, convertidas com `settings.timeScale` na chegada ao nó | É a regra do ADR 0013 (decisão 1) com a mesma exceção do ADR 0014: só é real a janela que depende de uma pessoa responder. Em tempo de jogo, no Rápido a espera seria de 2 h reais e a Postura decidiria quase sempre. Alternativa: tudo em tempo de jogo. Validar: parcela das encruzilhadas decididas pelo jogador no perfil de 2 visitas | a decidir |
| 2 | **Como a v0.3 chega à produção** | Fase B em diante | §0.8: a v0.3 só sobe a versão do estado depois de a v0.2 estar publicada e migrada; A, B e G no `main`; C a F em branch de fase, mesclado quando o autor jogou e aprovou | Empilhar versões de estado nunca publicadas foi o que obrigou a primeira publicação da v0.2 a ir em dois passos. Alternativa: tudo no `main` local sem `push`, como na v0.2, com uma publicação em passos depois | a decidir |
| 3 | **O soldo quando falta ouro** | V3C-T1 | Soldo é consumo **contínuo**: 2 ouro por hora de jogo por herói (no feudo, em expedição ou em escolta; capturado não recebe). Quando o ouro acaba, abre o **atraso** no instante exato, como a fome. **Não há dívida.** Com 12 h de jogo contínuas em atraso, todo herói sem o traço Leal fica Descontente (atributos ×0,8). A partir de 24 h, parte **um herói por dia de jogo**: o que chegou por último entre os que estão no feudo; Leal nunca parte; quem está fora só pode partir depois de voltar. O atraso fecha quando o saldo de ouro volta a ser positivo. Dispensar um herói é sempre possível, sem devolução. **Sem piso de heróis** | É o GDD §9.1 lido com o modelo que o motor já tem para a fome: instante exato, nada negativo, nada recalculado. Alternativas: cobrança por dia, na virada; dívida paga depois; prazos em tempo real. **O que validar: no Rápido, 12 h e 24 h de jogo são 4 h e 8 h reais.** Se o perfil Preguiçoso perder herói só por ter dormido, a proteção é regra nova e volta ao autor | a decidir |
| 4 | **Taverna: quantos heróis ela oferece, e de quanto em quanto tempo** | V3C-T2 | **2 candidatos** nos níveis 1 e 2, **3** a partir do nível 3. Rotação a cada **12 dias de jogo** (um dia real no Normal, 8 h no Rápido), ancorada como a cadência do Conselho; quem não foi contratado sai. Preço **fixo por modelo**, de 80 a 300 ouro, sem sorteio de preço; um Carismático no feudo dá 20% de desconto. Sorteio no fluxo `tavern` | O GDD diz "2–3 candidatos por dia". Lido como dia de jogo, no Rápido a lista trocaria a cada 40 minutos. Alternativas: sempre 3; rotação por dia de jogo. Validar: o jogador de 2 visitas vê cada lista ao menos uma vez | a decidir |
| 5 | **Limite de heróis** | V3C-T1, V3C-T2 | `1 + nível da Taverna`: 1 sem Taverna, 6 no nível 5. Uma recompensa de carta ou de expedição **nunca** é barrada pelo limite | O GDD não dá limite. Sem ele, o estado e a visão não têm teto, e os níveis 4 e 5 da Taverna venderiam só moral. Alternativa: sem limite, e o soldo limita. Validar: quantos heróis o perfil Dedicado sustenta | a decidir |
| 6 | **A "Estrangeira ferida" como primeira carta roteirizada** | V3C-T3 | Chega no início do **dia 13 de jogo do ano 1** (o começo do dia real 2 no Normal; 8 h reais no Rápido), antes dos lobos do dia 16. "Acolher": Edda, Guerreira Leal, entra agora. "Cuidar e deixar partir": +40 ouro, +5 de moral por 1 dia de jogo, e Rolf, Arqueiro Prudente, chega 1 dia de jogo depois. Nenhuma opção tem custo. `autoResolve`: Camponês e Senhor "Acolher"; Rei de Ferro "Cuidar e deixar partir". **Partidas que já passaram do dia 13 recebem a carta no primeiro instante do Conselho depois da migração**, uma vez. O soldo conta desde a chegada | É a carta 1 do Apêndice B do GDD. As duas opções dão herói: ninguém fica sem equipe porque a carta expirou. Sem a regra das partidas antigas, quem joga desde a v0.1 nunca teria o primeiro herói. Alternativas: depois dos lobos (dia 18), com a estrangeira ferida por eles; só partidas novas. Validar: o autor hesita entre as duas opções | a decidir |
| 7 | **"Poder da equipe" e atributos em inteiros** | V3C-T1, V3D-T1 | Atributos-base **inteiros** por classe. Nível: `atributo × (100 + 8 × (nível − 1)) / 100`, **sem compor**. Experiência por tabela escrita no conteúdo (100, 282, 519, 800, 1118, 1469, 1852, 2262, 2700). Poder: `Σ (ataque + defesa + vida ÷ 10)` em milésimos, vezes os fatores de classe, traço e item como frações, com **um arredondamento para baixo no fim**. Sorte: um inteiro de 85 a 115, uma vez por nó. Desfecho por multiplicação cruzada contra 1,3, 1,0 e 0,7. Um traço que "desloca a razão" entra como fator do poder naquele nó. Classe conta só em poder, requisito de nó e opção de carta | `100 × n^1,5`, `vida/10`, "+8%" e "±15%" não são inteiros do jeito que o GDD escreve, e o motor não usa ponto flutuante (§14.3). Alternativas: +8% composto; sorte contínua. Validar: os atributos-base propostos em V3A-T2.5 dão Sucesso à equipe mínima na Patrulha em mais de 9 de 10 sementes | a decidir |
| 8 | **Ferimento, captura e morte por dificuldade** | V3D-T2 | Leve: 2 h de jogo. Grave: 12 h de jogo. No Desastre, **o nó diz** se fere ou captura (`onDisaster`), marcado editorialmente. Camponês: toda captura vira ferimento grave. Senhor: como marcado. Rei de Ferro: onde está marcado captura, o herói morre. O capturado não recebe soldo e fica até o Resgate, **sem prazo** nesta versão. Quem sofre é sorteado no fluxo da expedição | A tabela do GDD §12.1 diz "Não / Não (captura) / Sim", e o §9.2 diz "ferimento grave ou captura" sem dizer qual. Marcar no nó é simples e revisável, como o `autoResolve` das cartas. Alternativas: sortear entre ferir e capturar; capturado com prazo. Validar: capturas por ano no perfil Regular | a decidir |
| 9 | **Sorteio por expedição e por caravana** | V3B-T1 | Fluxos `expedition:<id>` e `caravan:<id>`, que nascem no primeiro sorteio e são **apagados** quando a entidade termina; `tavern` e `market` são fluxos fixos. Identificadores por contador no estado, nunca reutilizados. **Um comando nunca sorteia**: a variante do grafo sai de uma conta sobre a semente, o modelo e o número de envios | É o que o GDD §14.3 prevê. Com um fluxo só, a ordem entre duas expedições mudaria a sorte das duas. Apagar o fluxo mantém o estado com teto. Alternativa: um fluxo `expedition` para todas. Validar: QA-07 | a decidir |
| 10 | **Taverna: moral e festival** | V3C-T2 | +5 de moral por nível, termo permanente. Festival por comando: 100 comida e 50 ouro (o custo da carta "Festival da Colheita" do GDD), +15 de moral por 24 h de jogo (12 dias de jogo), **um por estação** | O GDD dá o efeito e não dá custo nem limite. Sem limite, o festival seria moral comprada sem fim. O registro da v0.2 já anotava a duração do festival como dúvida aberta. Alternativas: custo que cresce com o nível; sem limite. Validar: moral média com e sem Taverna | a decidir |

### 9.2 Lote 2: expedições, Mercado, Mestres e cartas (V3D-T0 → ADR 0016)

| # | Decisão | Trava | Premissa recomendada | Por quê, alternativa e o que validar | Registro |
|---|---|---|---|---|---|
| 11 | **Encruzilhada e Postura** | V3D-T1 | A opção de cada Postura é **marcada em cada encruzilhada** (`posture: { cautious; balanced; bold }`), como o Apêndice C do GDD já faz. A opção da Cautelosa nunca tem requisito. Se a opção marcada estiver bloqueada para a equipe, vale a da Cautelosa. O prazo resolve **antes** de um comando no mesmo instante. A equipe parada continua recebendo soldo | "Melhor valor esperado" calculado no motor é ambíguo e não testável; é a mesma lição da opção automática das cartas (ADR 0014, decisão 9). Alternativa: o motor calcula. Validar: revisão grafo a grafo; a Equilibrada não é a melhor para toda equipe | a decidir |
| 12 | **Quais expedições entram, e como aparecem** | V3D-T1, V3D-T3 | Seis modelos, três variantes cada. Primeira entrega: Patrulha dos Arredores, Floresta Antiga, Covil dos Lobos e Resgate. Segunda: Ruínas de Vel'Thar e Pântano Nebuloso. **Ficam fora:** Mina Abandonada (ferro), Acampamento de Saqueadores (batalha), Sabotagem e Caçada ao Dragão. Recompensa de versão futura vira item da raridade equivalente. Um destino aparece **por descoberta, não por data**: Patrulha e Floresta com a Guilda Nv1; o Covil é conhecido desde a v0.2; as Ruínas são reveladas por uma Patrulha ou por carta; o Pântano, pelas Ruínas, e pede Guilda Nv3. **A Guilda vai até o nível 4 nesta versão** | O §9.3 do GDD mistura mecânicas de três versões, e a coluna "Disponível: dia N" está no ritmo Normal sem dizer se é data ou gate. O nível 5 da Guilda não mudaria nada que o jogador vê (ADR 0014, decisão 11). Alternativas: os dez modelos; disponibilidade por dia de jogo. Validar: cobertura por estação (V3D-T3.6) | a decidir |
| 13 | **O que o jogador sabe antes de enviar** | V3D-T1, V3D-T4 | Duração total, risco em palavra (Baixo, Médio, Alto), poder da equipe e a dificuldade do **primeiro trecho**, até a primeira encruzilhada. O que vem depois aparece como "?" até a equipe chegar. Cada opção de encruzilhada traz uma pista do risco e da recompensa | Pilar 3 do GDD ("nada de dados ocultos sem pista") contra a graça de explorar. Alternativas: o grafo inteiro à vista; só o rótulo de risco. Validar: o autor prevê o desfecho do primeiro nó | a decidir |
| 14 | **Covil limpo e Ameaça** | V3D-T2 | Limpar o Covil: Ameaça −30, e o tile para de somar +5 por dia. **Na virada do ano os lobos voltam**: o tile fica ativo de novo | O Covil é o único tile de ameaça até a v0.4. Limpo para sempre, Torre e Paliçada perderiam a função no ano 2. Alternativas: limpo para sempre; volta depois de N dias. Validar: Ameaça média por estação com e sem a expedição | a decidir |
| 15 | **Equipamento e custo de enviar** | V3D-T2 | Três espaços, quatro raridades (Lendário fora). Itens vêm de expedições e objetivos. **Sem desgaste nem reparo. Sem venda de item.** Inventário com teto de 30; item achado com o inventário cheio vira ouro pelo valor do conteúdo. **Enviar uma expedição não custa provisões**: custa o tempo e o soldo da equipe | Reparo é do Ferreiro (v0.4); o teto limita o estado. O GDD §5.1 cita "expedições" entre os usos da comida, e o §9 não dá número. Alternativas: itens à venda no Mercado; comida por herói por expedição. Validar: horas de herói ocioso | a decidir |
| 16 | **Mercado: preço, margem e volume diário** | V3E-T1 | Comida, madeira e pedra. Bases do GDD (1,0, 1,2 e 2,0), em milésimos de ouro. O jogador compra pelo preço do dia e vende a **85%** dele. **O dia do Mercado é o dia de jogo**: preço e volume mudam na virada. Volume: **`200 × nível` por recurso por dia, somando compra e venda**. Passeio diário de até ±5%, com reversão de um décimo da distância à base, limitado entre 60% e 160% da base. Comida ×1,3 no outono e no inverno. Compra que não cabe no cap é recusada inteira. Os preços só andam depois que o Mercado existe. A ordem leva o dia da cotação e é recusada se o dia virou | O GDD dá os números e deixa em aberto o que é "diário", como a margem se divide e até onde o passeio vai. No Rápido um dia dura 40 minutos: o volume por visita é o de um dia, e é isso que impede uma visita de esvaziar o estoque. Alternativas: volume por dia real; margem dividida entre compra e venda. Validar: nenhuma sequência no mesmo dia dá lucro. **Comprar comida no fim do verão e vender no outono dá lucro, e é intencional**: fica à vista no aviso de estação e é limitado pelo volume e pelo cap | a decidir |
| 17 | **Caravanas** | V3E-T2 | Mercado Nv2. Só venda, um recurso, até 300 unidades, 4 h de jogo. Preço: o de venda do dia ×1,4, **fixado no envio**. Uma caravana por vez; duas a partir do Mercado Nv4. Não conta no volume diário. Emboscada sorteada na chegada: **`máx(2, 10 − 5 × nível da Torre)` por cento**; zero com escolta. A emboscada leva **metade** da carga. A escolta ocupa um herói até a chegada | Com a Torre no nível 2, o máximo da v0.2, "−5% por nível" zeraria o risco e a escolta não serviria para nada: o piso de 2% mantém a escolha e o critério 5. O GDD não diz quanto se perde. Alternativas: "−5%" como redução relativa (10%, 9,5%, 9%); perda total. Validar: QA-10 | a decidir |
| 18 | **Mestres** | V3E-T3 | Aldeão nomeado. Conta como habitante (casa e comida) e, alocado, como um trabalhador. Dá **+15%** ao edifício produtivo em que trabalha; **um por edifício**. Trocar de edifício passa pela adaptação de 1 dia de jogo, sem o bônus. **Nunca** é escolhido por deserção, partida ou ferimento. Sem vaga, espera à porta. Vem de cartas e de expedições | A v0.2 não tem "postos" (ADR 0013, decisão 13), então "ocupa um posto" precisa de leitura. Perder uma recompensa rara em um sorteio de deserção seria frustração sem decisão. Alternativas: Mestre fora da população; bônus que soma. Validar: o bônus não torna um edifício obrigatório | a decidir |
| 19 | **Lote 2 do Conselho** | V3F-T1 | **24 cartas**: 4 cadeias de 3 ("O Mercador Misterioso", "Os Refugiados", "O Lobo Branco", "O Cobrador do Rei"), 2 roteirizadas, 10 avulsas (§13.3). Escritas pelo agente, aprovadas carta a carta. Total no jogo: **45 de 60**. "O Lobo Branco" e "O Cobrador do Rei" entram adaptados; "A Filha do Ferreiro" fica para a v0.4. Um requisito de traço é cumprido por qualquer herói da equipe que não esteja capturado. Efeito com sorteio é resolvido na virada de dia seguinte, nunca no comando | Das cinco cadeias do GDD §7.1, quatro cabem na v0.3 com adaptação. Alternativas: só as duas que não pedem adaptação; exigir o herói presente no feudo. Validar: cobertura por posse (V3F-T1.9); nenhuma opção de herói dominante | a decidir |
| 20 | **Objetivos 11 a 16** | V3F-T2 | Seis novos (V3F-T2.1): primeiro herói, Guilda, Patrulha, vender o excedente, escolher na encruzilhada, explorar as Ruínas. Os de 1 a 10 intocados | Três vêm do GDD §12.2; os outros três ensinam a Guilda, o Mercado e a encruzilhada no momento em que resolvem um problema sentido | a decidir |
| 21 | **Propostas de experiência (IDEIA-08 a 12)** | V3C-T4, V3D-T3, V3D-T4, V3F-T3 | **Todas entram** como interface ou conteúdo (§13.1); nenhuma muda regra | São o que torna as mecânicas legíveis; nenhuma cria moeda, tarefa diária ou prêmio por login | a decidir |

### 9.3 Atos do autor, que não são decisões de regra

| # | O que é | Trava | Recomendação | Estado em 2026-10-02 |
|---|---|---|---|---|
| 22 | **Confirmar as 18 decisões aplicadas por delegação na v0.2** ([pendencias-v0.2.md](pendencias-v0.2.md), seção 2), e aprovar as 21 cartas do lote 1 | Nenhuma tarefa; mas uma resposta diferente pode mudar uma premissa daqui | Antes da Fase C (V3A-T2.2). Resposta diferente vira um commit próprio, com conteúdo, golden e GDD | pendente |
| 23 | **Operação:** publicar a v0.2 em dois passos; backup externo; cópia do `RECOVERY_CODE_SECRET` fora do Coolify; ensaio de reversão com duas imagens | A chegada de qualquer migração de estado à produção | Antes de publicar a Fase B da v0.3 | pendente |
| 24 | **Os oito pontos do ADR 0012 e o vínculo GitHub** | Nenhuma | O vínculo continua desligado; a página de apresentação não ganha texto sobre a Guilda antes do fechamento (V3G-T4.2) | pendente |

**Registro:** para cada decisão, o ADR guarda o que foi aplicado, a data, a alternativa descartada, a razão, a tarefa afetada e a seção do GDD. Escolhas novas de regra vão ao ADR e ao GDD antes do código.

---

## 10. Dívidas conhecidas, herdadas da v0.2

Lidas em 2026-10-02 no roadmap da v0.2 (§9 e §11), em `pendencias-v0.2.md`, no `deploy/README.md` e no código do commit `e3d478e`. **A v0.2 não tinha terminado**: V3A-T1.10 confere cada linha e acrescenta as que as Fases C a F deixarem. "Bloqueia" quer dizer: precisa estar resolvida antes da tarefa indicada.

### 10.1 Código

| Onde | O que é | Bloqueia a v0.3? |
|---|---|---|
| `packages/engine/src/random.ts` (`RNG_STREAMS` com três nomes fixos) | Não há fluxo por entidade (`expedition:<id>`, `caravan:<id>`) nem como apagar um fluxo | **Sim**: V3B-T1 |
| `packages/engine/src/types.ts`, `state.ts` | Nada no estado gera identificadores de entidade | **Sim**: V3B-T1 |
| `packages/protocol/src/view.ts` (`pendingDecisions`) | Era `z.array(z.never())` em `e3d478e`; a v0.2 a troca por cartas. Se for união fechada, a encruzilhada quebra o app antigo | **Sim**: V3D-T1 (protocolo 3) |
| `packages/content/src/content.test.ts` e o schema das cartas † | A v0.2 proíbe herói e Mercado nas cartas, e os efeitos são só recursos, moral, flags e continuação | **Sim**: V3C-T3 e V3F-T1 afrouxam de propósito |
| Carta `scripted` | O ADR 0014 diz que o motor aceita e o catálogo não usa: caminho sem carta de verdade | **Sim**: V3C-T3 é o primeiro uso |
| Torre de Vigia e Paliçada até o nível 2 | "−5% por nível" na caravana zera o risco | Decisão 17 |
| `packages/web/src/game/returnReport.ts` | O Relatório só é montado ao abrir a página depois de 4 h; uma aba aberta a noite inteira não recebe | Não; pesa mais com encruzilhadas e capturas |
| `packages/web` (notificações) | **Nada chega com a aba fechada.** A encruzilhada espera 6 h reais e a carta, 24 h: quem fecha a aba só sabe ao voltar | Não. Notificação com a aba fechada pede *service worker* e é decisão de arquitetura: não entra sem ADR |
| `docs/perf-v0.1.md`, tabela `commands` | Cada recibo guarda a resposta inteira (cerca de 3,4 kB na v0.1). A visão da v0.3 leva heróis, expedições, relatórios, itens e preços | Não; medir em V3A-T1.8 e V3G-T1.6 |
| `packages/engine/src/advance.ts` | Custo de `advanceTo` depois de dias sem acesso. No 3× são 36 viradas de dia por dia real, e a v0.3 acrescenta preço e volume a cada uma | Não; medir |
| [README do motor](../packages/engine/README.md), "Limite conhecido" | Refazer a história de uma partida migrada exige o estado gravado em cada fronteira, que só um backup tem | Não; cada passo da v0.3 que cria prazo aumenta o limite |
| `docs/balance-v0.2.md` | As faixas do simulador são valores medidos com folga, não metas aprovadas; a meta de 30 a 40 habitantes do GDD não é atingida no ritmo 1 (26) | Não; V3G-T1 |
| Registro da v0.2, V2B-T0 | Três dúvidas de regra sem ADR: experiência do ofício com menos trabalhadores que o nível; duração do festival; frio e moral no mesmo instante ou na virada | A do festival é a decisão 10; as outras, conferir em V3A-T1 |
| `CLAUDE.md` | Ficou para trás na integração da Fase B da v0.2 | Não; V3A-T1.12 lista, quem integra corrige |
| `.prettierignore` (`*.md`) | O Prettier não confere Markdown: tabelas e links de documentos passam sem verificação automática | Não; links por script (§0.9) |
| `packages/server/src/games/commands.ts` | Relógio para trás grava `server_time` regredido | Não |
| `packages/web/src/workbench/EditorTabs.tsx` | Botões de fechar aba dentro do `tablist`; a v0.3 traz duas abas novas | Não |
| `packages/web/src/tabs/Settings.tsx` | A Hora da Vigília é guardada e não muda nada (v0.4) | Não |
| App (GDD §13.6) | "Baixar cópia da partida (JSON)" não existe | Não |

### 10.2 Operação

| O que é | Bloqueia a v0.3? |
|---|---|
| **A v0.2 não foi publicada.** A produção roda a `v0.1.0`, que não confere a versão do estado; a primeira publicação vai em dois passos e nunca foi ensaiada com imagens | **Sim**, para qualquer fase da v0.3 chegar à produção (decisões 2 e 23) |
| Backups no mesmo disco do banco; sem registro de cópia do `RECOVERY_CODE_SECRET` fora do Coolify | Idem |
| A reversão nunca foi ensaiada atravessando uma migração de estado | Idem |
| Restaurar um backup tira a sessão de quem jogou depois dele (`deploy/README.md`, "O que a restauração custa a quem joga") | Não; é o custo conhecido do último recurso |
| Deploy automático a cada `push` no `main` | Decisão 2 |
| `deploy/analytics/ops.sql` nunca rodou em produção; não tem consulta de ritmo, dificuldade, heróis ou expedições | Para o playtest (V3G-T3) |
| Avisos do Coolify sem canal; e-mail de alerta do GitHub não conferido | Não; conferir antes de um playtest |

### 10.3 Verificação

| O que não foi verificado | Bloqueia a v0.3? |
|---|---|
| **Ninguém além do autor jogou o jogo.** Os playtests da v0.1 e da v0.2 não aconteceram | Não bloqueia código. Tira o chão de toda afirmação sobre diversão (§11.4) |
| O autor não jogou nem aprovou nenhuma fase da v0.2; as 21 cartas e as frases de dificuldade e de ritmo não foram lidas por ele | Decisão 22 |
| Firefox e Safari sem evidência; celular e leitor de tela nunca usados | Não; V3G-T2 registra |
| `pnpm capture:landing` não foi rodado depois de as boas-vindas ficarem mais largas | Não; V3G-T4.2 |
| Expurgo de sete dias em produção | Não |

---

## 11. O que a v0.2 ensinou

**Como ler esta seção.** Ela foi escrita em 2026-10-02, com a v0.2 pela metade: a Fase B estava concluída e revisada, e as Fases C a F estavam sendo implementadas. A §11.1 traz as lições que **já se leem** no roadmap da v0.2 (§10 e §11), nos ADRs 0013 e 0014, em `pendencias-v0.2.md`, no `deploy/README.md` e no histórico do Git. A §11.2 descreve o modo de trabalho em que a v0.2 foi feita. A §11.3 é um espaço **a preencher ao fechar a v0.2**. A §11.4 diz o que não existe.

As dez lições do MVP ([roadmap da v0.2, §10](roadmap-v0.2.md)) continuam valendo e não são repetidas aqui.

### 11.1 Lições que já se leem

| # | Lição | Evidência | O que muda na v0.3 |
|---|---|---|---|
| 1 | **As decisões de regra foram aplicadas sem o autor, e nenhuma foi confirmada** | ADRs 0013 e 0014, estado "aplicada por delegação"; `pendencias-v0.2.md`, seção 2 (18 linhas) | As premissas da §9 são escritas para poderem ser aplicadas sem conversa: número, alternativa e o que validar. A §0.6 diz o que fazer com e sem o autor. A decisão 22 abre a v0.3 |
| 2 | **A revisão independente achou dez defeitos depois de todos os portões verdes** | Dez commits "V2B: corrige …" (`b686d72` a `e3d478e`), depois de 1.613 testes de unidade, 358 de integração e 56 em navegador passarem | Uma revisão por fase continua sendo tarefa (V3B-T3, V3C-T5, V3D-T5, V3E-T5, V3F-T4). Cada correção é um commit com o defeito no título |
| 3 | **Publicar virou um problema de ordem** | `deploy/README.md`, "A primeira publicação da v0.2 vai em dois passos" (`a453b62`): a imagem da `v0.1.0` não confere a versão do estado e gravaria por cima de partidas migradas | Decisão 2: a v0.3 não sobe a versão do estado antes de a v0.2 estar publicada e migrada; cada fase é publicável sozinha |
| 4 | **A fronteira da migração é de cada passo, não da primeira migração** | `b686d72`; README do motor, "A fronteira é de cada passo" | Todo passo da v0.3 que cria prazo conta de `context.boundaryMs` e é testado sobre partida com `migratedAtMs: null` e com fronteira antiga (§0.5, §0.7) |
| 5 | **O número da versão não é salvo-conduto** | `6e1fd38`: o estado da versão atual nunca era conferido; um campo a menos virava `NaN` e depois `null` no banco | Cada lista nova (heróis, expedições, itens, caravanas, Mestres) entra na guarda de forma, inclusive os objetos de dentro |
| 6 | **Os retratos de estado eram todos iguais** | `782d2a0`: todos Senhor, ritmo 1 e sem fronteira | V3A-T1.5 e V3B-T1.1: os retratos têm de trazer o que a produção terá, antes de subir a versão |
| 7 | **Um schema compartilhado levou os números do jogo ao navegador** | `852364f`: o protocolo lia `balance.paces` em tempo de execução, e o pacote do app passou a carregar a tabela inteira | Contrato "pacote do app sem números" (§0.7); os schemas de herói, expedição e Mercado no protocolo validam só a forma |
| 8 | **O bot só é honesto se o teste proibir o atalho** | `e3d478e`: o bot econômico calculava com números de `@lotg/content` e não via a fome | As políticas novas leem só a visão. Consequência para o motor: a visão tem de trazer o que um jogador precisa para decidir (poder contra dificuldade, preço contra base) |
| 9 | **Uma espera antes de um diálogo deixa acionar duas vezes** | `4c8dd56`: "Nova partida" acionada duas vezes fundava dois feudos | Contratar, enviar expedição e negociar rodam um fluxo por vez e leem a conta depois da espera; cada um tem teste de duplo acionamento (QA-05, QA-06, QA-09) |
| 10 | **O cache de outra versão guarda o cursor, não a visão** | `090bccf`: a volta depois de uma atualização virava avisos avulsos e abria no Feudo | O protocolo 3 vai descartar a visão de novo: o Retorno depois da atualização é cenário de teste (QA-14) |
| 11 | **Só é tempo real a janela que depende de uma pessoa responder** | ADR 0013, decisão 1; ADR 0014, decisão 1 (24 h reais para a carta) | Decisão 1: a espera da encruzilhada é a segunda, e a última, constante de tempo real |
| 12 | **Calcular "melhor" no motor é ambíguo; marcar no conteúdo é simples e revisável** | ADR 0014, decisão 9 (`autoResolve` por carta) | Decisões 8 e 11: a Postura e o desfecho do Desastre são marcados em cada nó |
| 13 | **Cada nível vendido tem de mudar algo que o jogador vê** | ADR 0014, decisão 11 (Torre e Paliçada até o nível 2) | Decisões 4, 5, 12 e 17: cada nível de Taverna, Mercado e Guilda tem efeito visível; a Guilda para no nível 4 |
| 14 | **Prazo fixado no início mantém a linha do tempo simples** | ADR 0013, decisão 13 (obras e recrutamento) | A duração da expedição e o preço da caravana são fixados no envio |
| 15 | **Um documento de pendências funcionou como caixa de entrada do autor** | `pendencias-v0.2.md`: o que foi decidido sem ele, o que só ele faz, o que não foi verificado | `docs/pendencias-v0.3.md` nasce na primeira tarefa (V3A-T1.11), e não no meio da execução |
| 16 | **O Prettier não confere Markdown, e um `--` muda o que a integração roda** | Registro da v0.2, V2B-T0 e V2B (integração) | §0.9: links por script; o filtro de integração sem `--` em todos os comandos deste plano |
| 17 | **O job de avanço parava diante de partidas ilegíveis, e ninguém via o motivo** | `4fa1010`: o lote não avançava e o log só trazia a contagem | A v0.3 cria mais passos de migração e mais formas de um estado ser recusado. A regra continua: uma partida ilegível não segura as outras, nada é gravado por cima dela, e a causa vai para o log (V3B-T3.2 tenta isso com os passos novos) |
| 18 | **As 50 sementes davam o mesmo resultado enquanto nada sorteava** | `docs/balance-v0.2.md`, seção 2 | Na v0.3 sete fluxos sorteiam: a matriz mostra menor e maior valor, e os extremos vêm antes das médias (V3B-T2.3, V3G-T1.3) |

### 11.2 O modo de trabalho da madrugada

Em 2026-10-01 o autor pediu a v0.2 inteira para a manhã seguinte, sem ele. O que se lê no repositório e no pedido que abriu a sessão sobre como isso foi feito. **Só a Fase B estava concluída quando este texto foi escrito**: o que vale para as Fases C a F é o combinado, e a §11.3 (pergunta H) confere se foi cumprido.

- **Agentes em trilhas.** A implementação foi dividida em duas trilhas, motor e app, cada uma em uma árvore de trabalho própria (`git worktree`, branch `web-track` para o app), com um orquestrador que integra. Houve também uma trilha de documentos (`docs-track`): este roadmap foi escrito nela, em paralelo.
- **Portões de verificação.** Ao fim da fase, as trilhas são mescladas e o resultado passa por `pnpm verify`, integração, `pnpm build` e os testes em navegador antes de a fase seguinte começar. A integração da Fase B registrou a trilha do app mesclada sem conflito e o portão verde.
- **Revisão independente por fase.** Um agente que não escreveu o código lê a fase. Na Fase B ele achou dez defeitos que os portões não acusavam, corrigidos um por commit.
- **Decisões por delegação.** As premissas recomendadas da §8 do roadmap da v0.2 foram aplicadas como regra, registradas nos ADRs 0013 e 0014 com o estado "aplicada por delegação", levadas ao GDD (versão 0.7) e listadas para confirmação em `pendencias-v0.2.md`.
- **Nada publicado.** Todos os commits ficaram no `main` local. `push` no `main` implanta, e publicar é do autor.

O que isso ensina, e o que muda na v0.3:

| O que funcionou | O que custou | Na v0.3 |
|---|---|---|
| Duas trilhas avançaram ao mesmo tempo, e a do app foi mesclada sem conflito | A trilha do app entregou o que o roadmap não pedia (boas-vindas mais largas, um botão a mais nas Preferências): sem contrato escrito, cada trilha decide sozinha | Cada tarefa diz a trilha (§0.4); o Apêndice B é fixado pela trilha do motor antes de o app começar |
| O portão no fim da fase deu à fase seguinte um ponto de partida verde | O portão não pega o que nenhum teste descreve: foi a revisão que achou os dez defeitos | Portão **e** revisão, sempre os dois |
| As premissas escritas permitiram trabalhar sem perguntas | **Nenhuma decisão foi confirmada**, as 21 cartas não foram lidas, e o autor não jogou fase nenhuma antes da seguinte | A §9 traz alternativa e validação em cada linha; o que o modo não substitui continua escrito como pendência, não como feito |
| Tudo no `main` local evitou publicar pela metade | A publicação acumulou e passou a exigir dois passos e um ensaio que não foi feito | Decisão 2 |
| O Registro disse o que não foi verificado | `CLAUDE.md`, reservado ao orquestrador, ficou desatualizado; a linha de V2B-T5 ainda estava vazia no Registro quando as correções já estavam no histórico | A integração de cada fase inclui `CLAUDE.md` e o Registro (§0.4) |

**O que o modo não faz**, e nenhum plano deve fingir que faz: jogar e dizer se é divertido; aprovar texto; confirmar regra; convidar pessoas; publicar; mexer na produção. Uma versão feita assim está **implementada e verificada por testes**, não **aceita**.

### 11.3 A preencher ao fechar a v0.2

> **ESPAÇO RESERVADO. Preencher em V3A-T1.9, quando a v0.2 estiver fechada (V2F-T4) ou, no mínimo, com as Fases C a F no `main`.** Nada abaixo foi escrito com base em fatos: são as perguntas a responder. Apagar este aviso ao preencher. Se uma linha não puder ser respondida, escrever por quê.

| # | Pergunta | Onde procurar | Lição, evidência e o que muda na v0.3 |
|---|---|---|---|
| A | O que as revisões das Fases C, D e E acharam? Algum tipo de defeito se repetiu? | Registro da v0.2 (§11), commits "V2C: corrige …" e seguintes | _a preencher_ |
| B | Quais premissas o autor trocou ao confirmar as decisões? O que isso custou em código, golden e GDD? | `pendencias-v0.2.md`, seção 2; ADRs 0013 e 0014 | _a preencher_ |
| C | Quais dúvidas a implementação levantou que nenhum ADR fechava? | `pendencias-v0.2.md`, seção 4 | _a preencher_ |
| D | O que ficou sem verificação? | `pendencias-v0.2.md`, seção 5; `docs/acceptance-v0.2.md` | _a preencher_ |
| E | Os caps, a segunda fila e o início automático resolveram o excedente parado? Com que números? | `docs/balance-v0.2.md` (rodadas de V2C-T7 e V2F-T1) | _a preencher_ |
| F | A moral, o Conselho e a Ameaça ficaram dentro das faixas? Houve espiral, carta dominante, Ameaça que só sobe? | Idem; `docs/content-v0.2.md` | _a preencher_ |
| G | Como foi a publicação em dois passos? O ensaio de reversão aconteceu? | `deploy/README.md`, "Ensaios de reversão" | _a preencher_ |
| H | O modo de trabalho em trilhas se manteve nas Fases C a F? Onde as trilhas se atrapalharam? | Registro da v0.2, linhas de integração | _a preencher_ |
| I | O que o autor disse depois de jogar cada fase? | Registro da v0.2 (V2C-T7.5, V2D-T5.4, V2E-T5.3) | _a preencher_ |
| J | O que o playtest da v0.2 disse: qual escolha as pessoas lembram, o que prepararam, se voltaram? | `docs/playtest/relatorio-v0.2.md` | _a preencher, ou "não houve playtest"_ |
| K | Qual nome, arquivo ou contrato da v0.2 saiu diferente do que o Apêndice B dela previa? | V3A-T1.3 e V3A-T1.4 | _a preencher_ |

### 11.4 O que não há: lição de playtest

**Não há nenhuma lição de playtest neste documento.** Na data em que foi escrito, ninguém além do autor tinha jogado o jogo: o playtest da v0.1 (V2A-T1) não aconteceu, e o da v0.2 (V2F-T3) depende de uma publicação que não foi feita. O que existe são [o convite](playtest/convite-v0.2.md) e [o formulário](playtest/formulario-v0.2.md) da v0.2, prontos.

Consequências, ditas com todas as letras:

- Toda linha "Diversão" deste plano é uma **hipótese**. O teste que ela propõe é sempre o autor, e o autor não é o público.
- A tabela de tensões e alívios (§0.2) vem do GDD e do simulador, não de pessoas.
- O simulador mede tédio e desespero de um bot. Ele não mede se alguém lembra o nome de um herói.
- Se a v0.3 começar antes de haver um playtest, ela constrói a segunda versão seguida sobre uma base que nenhuma pessoa de fora avaliou. Isso é uma escolha do autor, e fica registrada aqui para não parecer um descuido.

---

## 12. Registro de execução

Preencher ao fechar cada tarefa. Com trilhas em paralelo, cada fase ganha também uma linha "V3x (integração)".

| Tarefa | Data | Commit | Sessões | O que foi feito e desvios | O que não foi verificado |
|---|---|---|---|---|---|
| V3A-T1 | | | | | |
| V3A-T2 | | | | | |
| V3B-T1 | | | | | |
| V3B-T2 | | | | | |
| V3B-T3 | | | | | |
| V3C-T1 | | | | | |
| V3C-T3 | | | | | |
| V3C-T2 | | | | | |
| V3C-T4 | | | | | |
| V3C-T5 | | | | | |
| V3D-T0 | | | | | |
| V3D-T1 | | | | | |
| V3D-T2 | | | | | |
| V3D-T3 | | | | | |
| V3D-T4 | | | | | |
| V3D-T5 | | | | | |
| V3E-T1 | | | | | |
| V3E-T2 | | | | | |
| V3E-T3 | | | | | |
| V3E-T4 | | | | | |
| V3E-T5 | | | | | |
| V3F-T1 | | | | | |
| V3F-T2 | | | | | |
| V3F-T3 | | | | | |
| V3F-T4 | | | | | |
| V3G-T1 | | | | | |
| V3G-T2 | | | | | |
| V3G-T3 | | | | | |
| V3G-T4 | | | | | |
| V3G-T5 | | | | | |

---

## 13. Conteúdo proposto: expedições e o lote 2 do Conselho

**Estado:** proposta para as decisões 12, 19 e 21. Nenhum número, nome ou texto daqui vai para `content` sem a curadoria de V3D-T3 e V3F-T1 e o registro no ADR 0016. As tarefas continuam válidas se uma proposta for recusada.

### 13.1 Cinco ideias de experiência e onde entram

Continuam a numeração das sete da v0.2 ([roadmap da v0.2, §12.1](roadmap-v0.2.md)).

| ID | Ideia | O que muda para o jogador | Tarefa |
|---|---|---|---|
| IDEIA-08 | **"A equipe espera por você"** | A encruzilhada aparece no topo de "Você ainda pode decidir" e de "Antes de partir", com o prazo e o que a Postura fará se ele não responder | V3D-T4, V3F-T3 |
| IDEIA-09 | **Relatório que se reconta** | Nó a nó, com quem se destacou e por que deu errado, e uma frase de fecho; nada de tabela de números no lugar da história | V3D-T3 |
| IDEIA-10 | **O soldo em horas** | "O ouro paga a equipe por mais 5h", na aba Guilda e em "Antes de partir", em vez de só "−12/h" | V3C-T1, V3C-T4, V3F-T3 |
| IDEIA-11 | **A saída ao lado do problema** | "Cheio em 3h" ganha o atalho "Vender" ao lado do botão do Armazém, com quanto cabe no volume de hoje | V3E-T4 |
| IDEIA-12 | **O herói na Crônica** | As linhas da Crônica e as cartas citam o herói pelo nome; a continuação de uma cadeia lembra quem resolveu | V3D-T3, V3F-T1 |

### 13.2 Catálogo de expedições da v0.3

Do GDD §9.3, com o que a decisão 12 propõe. As durações são do GDD (tempo de jogo); a coluna "No Rápido" é a duração real sem contar a espera da encruzilhada.

| Modelo | Duração | No Rápido | Nós | Equipe | Risco | Recompensas na v0.3 | Como aparece | Entrega |
|---|---:|---:|---:|---|---|---|---|---|
| Patrulha dos Arredores | 15 min | 5 min | 2 | 1 herói | Baixo | Ouro, experiência, revela um destino | Guilda Nv1 | 1ª |
| Floresta Antiga | 1 h | 20 min | 3 | 1 a 2 heróis | Baixo a médio | Madeira, ouro, item comum | Guilda Nv1 | 1ª |
| Covil dos Lobos | 2 h | 40 min | 3 | 2 heróis | Médio | Ameaça −30; ouro; abre a cadeia "O Lobo Branco" | Conhecido desde a v0.2 | 1ª |
| Resgate | 2 h | 40 min | 2 | 2 heróis | Alto | Recupera o herói capturado | Enquanto houver um capturado | 1ª |
| Ruínas de Vel'Thar | 3 h | 1 h | 4 | 2 a 3 heróis, nível 2 ou mais | Médio | Pedra, ouro, item raro | Revelado por uma Patrulha ou por carta | 2ª |
| Pântano Nebuloso | 5 h | 1h40 | 5 | 3 heróis, 1 Mago | Alto | Item épico, ouro | Revelado pelas Ruínas; Guilda Nv3 | 2ª |

Três variantes por modelo: 18 grafos. **Fora desta versão:** Mina Abandonada (ferro), Acampamento de Saqueadores (batalha), Sabotagem da Fortaleza da Horda e Caçada ao Dragão.

**Exemplo completo, "Ruínas de Vel'Thar", variante A.** É o grafo do Apêndice C do GDD com o que a v0.3 precisa marcar: a opção de cada Postura, o desfecho do Desastre e a recompensa trocada.

```
N1  travel      20 min   "A trilha até as ruínas"
 └→ N2  crossroads        "A escadaria desaba atrás de vocês"
        posture: cautious → c · balanced → b · bold → a
      a) "Seguir pelo Corredor das Inscrições"   pista: armadilhas antigas; quem tem perícia passa
          └→ N3a  hazard     25 min   dificuldade 60 · perícia pesa ×1,5 · onDisaster: injury · item raro provável
               └→ N4  boss   30 min   "O Guardião de Pedra" · dificuldade 90 · onDisaster: capture
                                      recompensa: item raro (no lugar da planta da Capela), 80 pedra, 60 ouro
      b) "Atravessar a Galeria Inundada"         pista: água até o peito; requer um Guerreiro
          └→ N3b  encounter  25 min   dificuldade 50 · onDisaster: injury · 60 pedra, 35 ouro
               └→ N4  (o mesmo chefe)
      c) "Recuar com o que têm"                  pista: sem risco; o saque fica pequeno
          └→ N5
N5  return      20 min   mantém o saque atual
```

Na espera da encruzilhada o jogador vê as três opções com as pistas, o prazo real e "sem resposta, a Postura Equilibrada escolhe: Atravessar a Galeria Inundada". Se a equipe não tem Guerreiro, a opção (b) aparece bloqueada com o motivo, e a Postura Equilibrada cai na da Cautelosa.

### 13.3 O lote 2 do Conselho

**A conta das 60 cartas do GDD (§7.2: 60 cartas, incluindo 5 cadeias e 6 roteirizadas):**

| | Cartas | Cadeias | Roteirizadas |
|---|---:|---:|---:|
| Lote 1 (v0.2): 3 cadeias de 3 e 12 avulsas | 21 | 3, próprias da v0.2 | 0 |
| **Lote 2 (v0.3):** 4 cadeias de 3, 2 roteirizadas e 10 avulsas | **24** | 4 das 5 do GDD | 2 |
| No jogo ao fim da v0.3 | **45** | 7 | 2 |
| Falta para a meta (lote 3, v0.4) | **15** | 1 das 5 do GDD | 4 |

As três cadeias do lote 1 ("O Celeiro Comum", "A Ponte do Degelo", "A Promessa da Paliçada") não estão entre as cinco que o GDD nomeia: foram escritas para caber na v0.2. As cinco do GDD §7.1, e o que a v0.3 faz com cada uma:

| Cadeia do GDD | Entra na v0.3? | De que depende | Adaptação |
|---|---|---|---|
| **O Mercador Misterioso** | Sim | Mercado Nv1; a opção "Comprar o mapa" revela um destino de expedição | "Preços +20% por 2 dias" usa o efeito `marketPrice` |
| **Os Refugiados** | Sim | Mestres (a segunda carta entrega um) | Exclui-se com a avulsa "Mais bocas à mesa" do lote 1 |
| **O Lobo Branco** | Sim, adaptada | Guilda, a expedição ao Covil e um herói | Sem relíquia, presságio nem cerco: "Caçar" abre uma expedição especial com um acessório épico; "Oferecer carne" tira Ameaça; "Ignorar" torna média a próxima incursão por Ameaça |
| **O Cobrador do Rei** | Sim, adaptada | Nada para ser elegível; um herói Carismático abre "Negociar" | Sem batalha: o desfecho é multa, negociação ou perda de moral. O ramo com soldados entra na v0.4 |
| **A Filha do Ferreiro** | **Não** | Ferreiro (v0.4) | Lote 3 |

**As 24 cartas do lote 2, e de que cada uma depende:**

| Tipo | Carta | Escolha que provoca | Depende de |
|---|---|---|---|
| Roteirizada | **Estrangeira ferida** (dia 13 do ano 1) | Uma guerreira leal agora, ou ouro e um arqueiro amanhã | Entrega o primeiro herói |
| Roteirizada | **O mercador itinerante** (dia 20 do ano 1) | Trocar excedente por ouro uma vez, a preço ruim, ou esperar ter o próprio Mercado | Nada; prepara o Mercado |
| Cadeia 1/3 | O Mercador Misterioso | Comprar o mapa, prender o homem ou recusar | Mercado |
| Cadeia 2/3 | O que o mapa mostrava (ou a resposta dos mercadores) | Seguir a pista ou vender a informação | Mercado |
| Cadeia 3/3 | A última oferta do mercador | Fechar a história com lucro, com um destino novo ou com um inimigo a menos | Mercado |
| Cadeia 1/3 | Refugiados nos portões | Aceitar com vagas, dar provisões ou recusar | Nada para ser elegível |
| Cadeia 2/3 | O retorno dos refugiados | Acolher quem voltou: **um Mestre chega** | Mestres |
| Cadeia 3/3 | O ofício que eles trouxeram | Onde o Mestre trabalha, e o que o resto da vila acha | Mestres |
| Cadeia 1/3 | Pegadas brancas (outono, depois do Covil limpo) | Caçar, oferecer carne ou ignorar | Guilda, expedição, herói |
| Cadeia 2/3 | O Lobo Branco | Conforme o ramo: a caçada como expedição especial, ou a oferenda que se repete | Guilda, expedição, herói |
| Cadeia 3/3 | O que a floresta devolve | Desfecho; lembra quem caçou | Guilda, expedição, herói |
| Cadeia 1/3 | Impostos do Rei (recorrente, Salão Nv3) | Pagar, **negociar (Carismático)** ou recusar | Opção extra por traço |
| Cadeia 2/3 | O Cobrador do Rei | Multa dobrada, **negociar** ou ceder parte | Opção extra por traço |
| Cadeia 3/3 | A resposta da coroa | Desfecho por ramo | Opção extra por traço |
| Avulsa | Praga nos campos (Apêndice B) | Queimar, esperar com risco sorteado (**a Clériga reduz**) ou pagar | Opção extra por classe; efeito com sorteio |
| Avulsa | Boicote dos mercadores | Ceder, resistir com preço pior, ou buscar outra rota | Mercado |
| Avulsa | A caravana real | Vender a ela agora a bom preço ou guardar para o inverno | Mercado |
| Avulsa | Um bardo na Taverna | Pagar pela canção (moral) ou mandá-lo embora | Taverna |
| Avulsa | Recrutador de passagem | Pagar por um candidato a mais nesta rotação | Taverna |
| Avulsa | A dívida de jogo | Cobrir a dívida de um herói ou deixá-lo resolver | Herói |
| Avulsa | Duelo na praça | Permitir (moral, risco de ferimento leve) ou proibir | Herói |
| Avulsa | O curandeiro errante | Pagar pela cura de um herói ferido ou esperar | Herói ferido |
| Avulsa | O mapa rasgado | Comprar meio mapa: revela um destino mais cedo | Guilda |
| Avulsa | O aprendiz e o Mestre | Deixar o Mestre ensinar (experiência do ofício) ou manter a produção | Mestre |

Resumo por dependência:

| Depende de | Cartas | Quantas |
|---|---|---:|
| Herói ou Guilda para ser elegível | O Lobo Branco (3), A dívida de jogo, Duelo na praça, O curandeiro errante, O mapa rasgado | 7 |
| Entrega um herói | Estrangeira ferida | 1 |
| Elegível sem herói, com opção extra por traço ou classe | O Cobrador do Rei (3), Praga nos campos | 4 |
| Mercado para ser elegível | O Mercador Misterioso (3), Boicote dos mercadores, A caravana real | 5 |
| Prepara o Mercado, sem exigir | O mercador itinerante | 1 |
| Mestres | Os Refugiados (3), O aprendiz e o Mestre | 4 |
| Taverna | Um bardo na Taverna, Recrutador de passagem | 2 |
| **Total** | | **24** |

Onze cartas pedem herói de algum modo, cinco pedem o Mercado, e nenhuma pede ferro, exército ou combate. Os títulos e as escolhas são ponto de partida: V3F-T1 escreve e o autor aprova.

### 13.4 Fichas obrigatórias

Usar no inventário `docs/content-v0.3.md` e refletir nos schemas de `content`.

**Ficha de uma carta.** A da v0.2 ([roadmap da v0.2, §12.3](roadmap-v0.2.md)), mais:

- Requisitos de equipe: traço, classe ou edifício da v0.3 que abre cada opção, e a frase de quando ela está bloqueada.
- Efeitos da v0.3: herói ou Mestre que chega (com o nome), destino revelado, expedição aberta, efeito de preço com duração, efeito com sorteio (a chance em número e o instante em que se resolve).
- O que acontece se o herói que abriu a opção partir, for capturado ou morrer no meio da cadeia.
- Para cada opção de herói: um cenário em que **não** usar o herói é a escolha razoável.

**Ficha de um grafo de expedição:**

- Modelo, variante, requisitos de equipe, como o destino é descoberto, risco em palavra.
- O desenho do grafo, com tipo, duração (em tempo de jogo) e título de cada nó.
- Para cada nó com dificuldade: o número, os atributos que pesam, a classe ou o traço que ajuda, e `onDisaster`.
- Para cada encruzilhada: texto, opções com verbo no infinitivo, pista de cada uma, requisito, e a opção de cada Postura; a da Cautelosa sem requisito.
- Recompensas por desfecho, sem nada de versão futura.
- Frases do relatório por nó e por desfecho (Sucesso Pleno, Sucesso, Revés, Desastre), em tom de crônica, com `{heroi}` e o motivo.
- Uma equipe para a qual cada opção é a escolha razoável e uma para a qual é ruim.
- Estado da curadoria: rascunho → cenário validado → aprovado → implementado → observado no playtest.

### 13.5 Guardar para as próximas versões

Quartel, Ferreiro, ferro, armas, formações, comandante de ala, Conselho de Guerra, Horda, presságios, Fortaleza, sabotagem, Cerco e milícia ficam na v0.4; mapa gráfico, postos avançados, Capela, relíquias, plantas, Legado, Votos e Temporadas, na v0.5; Academia e som, na v0.6. A v0.3 não antecipa nada disso "para dar mais conteúdo". Também não entram: moeda de prestígio, tarefa diária, prêmio por login consecutivo, coleta por clique, mercado entre jogadores, sorteio de herói pago.

---

## Apêndice A — Modelos de prompt

### A.1 Abrir uma tarefa

```
Leia CLAUDE.md, as seções do GAME_DESIGN.md indicadas na tarefa, a tarefa <ID> em docs/roadmap-v0.3.md,
o Apêndice B do roadmap e os ADRs que a tarefa consome (docs/decisions/0013 a 0016, os que existirem).
Trabalhe só nessa tarefa. Se uma decisão que ela consome ainda não tem ADR, pare e me pergunte,
apresentando a premissa recomendada da §9 como padrão. Confira no código os caminhos marcados com †.
Se for M ou L, apresente um plano (arquivos, nomes de eventos/recusas/campos do ViewState, passo de
migração, testes) antes de codar e espere a minha aprovação.
Escreva os testes antes da implementação onde houver regra de jogo ou contrato de API.
Ao terminar, rode a "Verificação" da tarefa e a verificação comum (§0.9), cole as saídas, marque as
caixas, preencha o Registro (§12) com o que foi e o que não foi verificado, e faça um commit
"<ID>: <resumo>". Se precisar desviar do GDD, pare e me proponha um ADR antes.
```

### A.2 Retomar uma tarefa interrompida

```
Leia CLAUDE.md e a tarefa <ID> em docs/roadmap-v0.3.md. Veja `git status`, `git diff` e `git log -5`.
Me diga em cinco linhas o que já está feito, o que falta e se há algo quebrado (`pnpm verify`).
Depois continue pela próxima subtarefa não marcada.
```

### A.3 Sessão de decisões (V3A-T2 e V3D-T0)

```
Leia CLAUDE.md, docs/roadmap-v0.3.md §9 e §0.6, docs/pendencias-v0.3.md e as seções do GDD da tarefa.
Vamos fechar o lote <N> de decisões. Para cada uma: a pergunta em uma frase, a sua recomendação como
padrão ("se eu não disser nada, fica assim"), a alternativa e o que muda no jogo. Uma por vez.
Registre as respostas em docs/decisions/<NNNN>-<titulo>.md com o que foi aplicado, data, alternativa
descartada, razão, tarefa afetada e seção do GDD; corrija o GDD onde a resposta mudar uma frase ou um
número; atualize a §9 do roadmap para apontar para o ADR. Não preencha nenhuma resposta por suposição.
```

### A.4 Revisão independente (subagente que não escreveu o código)

```
Você é um revisor que não escreveu este código. Leia CLAUDE.md, docs/roadmap-v0.3.md (a fase indicada,
§0.7, §8.2 e §11.1) e os commits de <intervalo>. Não aceite teste verde como prova: para cada contrato
da §0.7 e cada cenário QA da fase, diga se há teste que o cubra e tente quebrá-lo com um caso concreto
(instante exato, duas abas, reenvio, migração no meio, cortes diferentes do intervalo, entidade que
nasce e morre, uma espera assíncrona acionada duas vezes).
Procure: número de jogo fora de packages/content; regra fora de packages/engine; sorteio em comando,
em visão ou em nextEventAt; fluxo de sorteio que sobrevive à entidade; identificador reutilizado;
informação escondida do jogador saindo no ViewState (nó não alcançado, próxima rotação, preço de amanhã,
desfecho de caravana); número ou frase do conteúdo no pacote do app; bot que lê algo além do ViewState;
lista do estado sem teto; e qualquer campo ou botão de versão futura (exército, ferro, cerco, relíquia).
Entregue uma lista de achados classificados (defeito confirmado com reprodução; risco; dúvida), cada um
com arquivo e linha. Não corrija nada: quem corrige é a sessão principal, um commit por defeito, com
teste de regressão.
```

### A.5 Integração de uma fase (quando houver trilhas em paralelo)

```
Leia CLAUDE.md e docs/roadmap-v0.3.md §0.4 e §0.9. Mescle a trilha do app na do motor (ou as duas no
branch da fase). Rode no resultado: pnpm verify, a integração inteira, pnpm build, pnpm test:e2e e
pnpm --filter @lotg/sim-cli test. Não corrija defeito de mecânica aqui: registre e devolva à trilha.
Atualize CLAUDE.md com o que a fase tornou falso. Preencha a linha "V3x (integração)" do Registro com
as contagens de testes, o que quebrou e o que não foi rodado. Não dê push.
```

### A.6 Definição de pronto (vale para toda tarefa)

- [ ] Comandos da "Verificação" executados, com saída colada na conversa.
- [ ] `pnpm verify` verde; integração, navegador e simulador quando a tarefa toca servidor, app ou motor.
- [ ] Nenhum número de jogo fora de `packages/content`; nenhuma regra fora de `packages/engine`; nenhuma conversão de tempo no app; nenhum sorteio fora de `advanceTo`.
- [ ] Passo de migração escrito e testado quando a forma do estado mudou; retratos da versão anterior congelados.
- [ ] Golden regravado de propósito, com o diff lido; GDD atualizado se a regra mudou.
- [ ] Documentação tocada quando o comportamento mudou (README do pacote, `docs/architecture.md`, `CLAUDE.md`, `deploy/README.md`).
- [ ] Caixas marcadas; Registro preenchido (com o que não foi verificado); ADR criado se houve desvio.
- [ ] Um commit `<ID>: <resumo>`; `main` (ou o branch de fase) continua verde; nenhum `push` sem o autor pedir.

### A.7 Sessão típica (exemplo com V3A-T1, a primeira)

1. Você: prompt da tarefa V3A-T1.
2. Agente: lê, roda `git status`, `git log` e `git worktree list`, e mostra a tabela "previsto e encontrado" dos caminhos marcados com †. Você confere o que saiu diferente.
3. Agente: confere os contratos de V3A-T1.4 no código e corrige o Apêndice B.0; roda o portão inteiro e a matriz do simulador; mede o tamanho do estado e da visão.
4. Agente: escreve `docs/balance-v0.3.md` (seção 1) e `docs/pendencias-v0.3.md`; preenche a §11.3 com o que os registros da v0.2 dizem, ou escreve que não há o que dizer.
5. Agente: confere links e âncoras por script, marca V3A-T1.1 a V3A-T1.12, preenche a linha do Registro e faz o commit `V3A-T1: confere a herança da v0.2 e mede a linha de base`.
6. Você: lê `docs/pendencias-v0.3.md` e abre a sessão de decisões (V3A-T2).

---

## Apêndice B — Contratos de dados propostos da v0.3

Referência única dos **nomes propostos** para estado, comandos, eventos, recusas e `ViewState`. Cada tarefa confirma ou ajusta os seus e atualiza este apêndice; nenhum campo entra antes da tarefa que o usa (regra 6 do `CLAUDE.md`). Tudo em tempo de jogo no estado e em tempo real no `ViewState`.

### B.0 O que a v0.2 entrega e a v0.3 usa

**Não conferido.** Esta tabela foi escrita a partir dos ADRs 0013 e 0014 e do Apêndice B do roadmap da v0.2, em uma árvore que só tinha a Fase B. V3A-T1 a confere no código e troca este aviso por "conferido em <data>, commit <sha>".

| Mecânica da v0.3 | O que ela usa da v0.2 | Entregue em | O que conferir ao abrir a v0.3 |
|---|---|---|---|
| Toda tarefa que muda o estado | Migração por `schemaVersion`: `migrateState`, um passo por versão, retratos congelados, fronteira por passo (`context.boundaryMs`), recusa de versão futura | V2B-T1 (existia em `e3d478e`) | `CURRENT_SCHEMA_VERSION` ao fim da v0.2; cenários de `fixtures.test.ts` |
| Taverna, Mercado, expedições, caravanas, efeito com sorteio | Gerador com semente e fluxos nomeados (`council`, `morale`, `horde`); só `advanceTo` sorteia | V2B-T2 (existia em `e3d478e`) | Se algum fluxo ganhou nome novo; como a v0.2 gera `instanceId` |
| Carta da estrangeira e lote 2 | Conselho: sorteio ponderado, 2 pendentes, expiração em 24 h reais, `autoResolve`, flags, continuações com prioridade, efeitos adiados e ocultos, `scripted` aceito pelo motor | V2D-T1, V2D-T2 | Forma de `council`; tipos de `Effect`; teste de conteúdo das cartas; arquivo das avulsas |
| Moral da Taverna, festival, traço Devoto, recompensas em moral | Fórmula diária da moral com termos, e efeitos temporários com duração em dias de jogo | V2C-T4, V2D-T1 | Nome do campo dos efeitos; como um termo novo entra em `morale.terms` |
| Covil limpo, destinos descobertos, risco da caravana | Tiles abstratos em lista, Ameaça de 0 a 100, Torre de Vigia até o nível 2 | V2E-T1 | Se um tile pode ficar inativo; o que a visão mostra sem Torre |
| Mestre que não é ferido; herói com `untilMs` | Ferido que não trabalha e volta em instante marcado | V2E-T3 | Como a incursão escolhe quem fere |
| Saque de expedição, compra no Mercado | Caps de armazenamento; ganho discreto cortado e contado | V2C-T2 | O ponto de entrada único de recursos (`storage.ts` †) |
| Mestres | Conta única da produção em frações; adaptação por coortes; experiência do ofício; piso de população | V2C-T1, V2C-T3, V2C-T4 | Onde um fator novo entra; como a deserção escolhe quem sai |
| Expedição 15% mais rápida no verão; comida mais cara no outono | Estações com efeito; prazo fixado no início | V2C-T1 | A forma de `seasons[].effects` |
| Encruzilhada como decisão pendente | `pendingDecisions` com cartas; protocolo 2; `426` para cliente anterior | V2D-T1 | União fechada ou lista aberta; onde o servidor compara a versão do cliente |
| Morte e captura por dificuldade | `settings.difficulty`; `balance.difficulties` | V2B-T3 (existia em `e3d478e`) | — |
| Textos de classe e de traço | `GET /v1/catalog` | V2B-T3 (existia em `e3d478e`) | A v0.3 **não** acrescenta nada ao catálogo: a visão continua autossuficiente (GDD §14.5). Reavaliar só se o tamanho da visão pedir |
| "Antes de partir" e Retorno com a Guilda | `beforeLeaving`; `ReturnReport.blocks` | V2C-T6, V2D-T4 | Assinaturas e a ordem de prioridade |
| Políticas novas dos bots | Bots como listas de políticas; matriz por ritmo; faixas | V2B-T4 (existia em `e3d478e`), V2F-T1 | Colunas do CSV; faixas em vigor |
| Objetivos 11 a 16 | Objetivos 5 a 10 e as condições novas | V2E-T4 | Recompensa em moral temporária; regra dos 3 ativos |

**Caminhos marcados com † neste documento** (previstos pela v0.2, inexistentes em `e3d478e`):

| Pacote | Caminhos |
|---|---|
| `packages/engine/src/` | `storage.ts`, `cold.ts`, `morale.ts`, `council.ts`, `threat.ts`, `raids.ts` |
| `packages/content/src/` | `council.ts`, `cards/`, `tiles.ts` |
| `packages/web/src/` | `tabs/Council.tsx`, `components/CouncilCard.tsx`, `components/ThreatPanel.tsx`, `game/beforeLeaving.ts` |
| `tests/e2e/` | `07-conselho.spec.ts`, `08-ameaca.spec.ts` (os arquivos novos da v0.3 presumem os números 09 e 10) |
| `docs/` | `content-v0.2.md`, `acceptance-v0.2.md`, `manual-test-v0.2.md`, `relatorio-v0.2.md`, `playtest/relatorio-v0.1.md`, `playtest/relatorio-v0.2.md` |

### B.1 `GameState`: o que a v0.3 acrescenta, por tarefa

**Cada tarefa que muda a forma do estado sobe `schemaVersion` e escreve o seu passo de migração.** O bloco mostra só os campos novos, na forma ao fim da v0.3; o resto é o estado da v0.2.

```ts
type GameState = {
  // …tudo o que a v0.2 deixa…
  ids: Record<string, number>;                         // V3B-T1: contadores de identidade; vazio até o primeiro uso
  rng: Record<string, number[]>;                       // + 'tavern' (V3C-T2), 'market' (V3E-T1),
                                                       //   'expedition:<id>' (V3D-T1), 'caravan:<id>' (V3E-T2); os de entidade são apagados no fim
  settlement: {
    // …
    buildings: Record<BuildingId, number>;             // + tavern (V3C-T2), guild (V3D-T1), market (V3E-T1); nível 0 = não construído
    masters: Array<{ id: string; name: string; building: ProductionBuildingId | null; adaptingUntilMs: number | null }>;  // V3E-T3
    mastersWaiting: Array<{ id: string; name: string }>;                                                                 // V3E-T3
  };
  guild: {
    heroes: Hero[];                                    // V3C-T1
    wageArrears: { sinceMs: number } | null;           // V3C-T1
    tavernOffers: Array<{ offerId: string; templateId: string; name: string; price: number }>;  // V3C-T2
    tavern: { nextRotationAtMs: number | null; festival: { untilMs: number } | null; festivalSeason: string | null };  // V3C-T2
    expeditions: Expedition[];                         // V3D-T1
    reports: ExpeditionReport[];                       // V3D-T1: os últimos `reportsKept`
    inventory: Item[];                                 // V3D-T2
  };
  market: {
    prices: Record<'food' | 'wood' | 'stone', number>; // V3E-T1: milésimos de ouro por unidade
    quoteDay: number;                                  // V3E-T1: dia de jogo da cotação
    tradedToday: Record<'food' | 'wood' | 'stone', number>;  // V3E-T1
    effects: Array<{ resource: string; factor: Ratio; untilMs: number; label: string }>;  // V3F-T1
    caravans: Caravan[];                               // V3E-T2
  };
  stats: Record<string, number>;                       // + expeditions_sent_<modelo>, heroes_lost, traded_<recurso>, caravans_ambushed
};

type Hero = {
  id: string; name: string; classId: 'warrior' | 'archer' | 'mage' | 'cleric';
  level: number; xp: number; traits: string[];
  status: 'idle' | 'expedition' | 'escort' | 'injured' | 'captured';   // os três últimos entram em V3D-T1, V3E-T2 e V3D-T2
  injury: { severity: 'light' | 'severe'; untilMs: number } | null;    // V3D-T2
  equipment: { weapon: string | null; armor: string | null; accessory: string | null };  // V3D-T2
  joinedAtMs: number; discontent: boolean;
};

type Expedition = {
  id: string; modelId: string; variant: 0 | 1 | 2; heroIds: string[];
  posture: 'cautious' | 'balanced' | 'bold';
  sentAtMs: number; durationFactor: Ratio;
  status: 'traveling' | 'atCrossroads' | 'returning';
  nodeId: string; nodeEndsAtMs: number | null;
  crossroads: { decidesAtMs: number } | null;
  loot: { resources: Partial<Record<ResourceId, number>>; items: string[]; xp: number };
  log: Array<{ nodeId: string; atMs: number; outcome: 'full' | 'success' | 'setback' | 'disaster' | 'passed' | 'chosen'; heroId?: string; optionId?: string; decidedBy?: 'player' | 'posture' }>;
};

type Caravan = { id: string; resource: 'food' | 'wood' | 'stone'; amount: number; unitPrice: number; arrivesAtMs: number; escortHeroId: string | null };
```

Atributos, poder, limite de heróis, lugares de expedição, preço exibido e risco da caravana são **derivados** em funções puras e nunca gravados. Diferença em relação ao esboço do GDD §14.11: `tavernOffers` guarda o modelo e o nome, não o herói inteiro; `market.prices` não tem ferro.

### B.2 Comandos novos

| Comando | Payload | Tarefa | Recusas |
|---|---|---|---|
| `dismissHero` | `{ heroId }` | V3C-T1 | `HERO_NOT_FOUND`, `HERO_BUSY` |
| `hireHero` | `{ offerId }` | V3C-T2 | `TAVERN_REQUIRED`, `OFFER_GONE`, `HERO_LIMIT`, `INSUFFICIENT_RESOURCES` |
| `holdFestival` | `{}` | V3C-T2 | `TAVERN_REQUIRED`, `FESTIVAL_ALREADY_HELD`, `INSUFFICIENT_RESOURCES` |
| `sendExpedition` | `{ modelId, heroIds, posture }` | V3D-T1 | `GUILD_REQUIRED`, `EXPEDITION_LIMIT`, `EXPEDITION_LOCKED`, `HERO_UNAVAILABLE`, `TEAM_INVALID` |
| `chooseExpeditionPath` | `{ expeditionId, optionId }` | V3D-T1 | `EXPEDITION_NOT_WAITING`, `CROSSROADS_DECIDED`, `INVALID_OPTION`, `OPTION_LOCKED` |
| `equipItem` · `unequipItem` | `{ heroId, itemId }` · `{ heroId, slot }` | V3D-T2 | `HERO_BUSY`, `ITEM_NOT_FOUND`, `WRONG_SLOT` |
| `trade` | `{ resource, direction, amount, quoteDay }` | V3E-T1 | `MARKET_REQUIRED`, `INVALID_AMOUNT`, `DAILY_VOLUME_EXCEEDED`, `INSUFFICIENT_RESOURCES`, `STORAGE_FULL`, `PRICE_CHANGED` |
| `sendCaravan` | `{ resource, amount, escortHeroId? }` | V3E-T2 | `MARKET_LEVEL_REQUIRED`, `CARAVAN_LIMIT`, `INVALID_AMOUNT`, `INSUFFICIENT_RESOURCES`, `HERO_UNAVAILABLE` |
| `assignMaster` | `{ masterId, building }` | V3E-T3 | `MASTER_NOT_FOUND`, `BUILDING_HAS_MASTER`, `NOT_A_PRODUCTION_BUILDING` |
| `answerCard` (estendido) | o mesmo | V3F-T1 | `OPTION_LOCKED` passa a citar o traço ou a classe que falta |

Os códigos novos entram em `REJECTION_CODES` no motor **e** no protocolo. O protocolo valida só a forma (identificadores como texto, quantidades como inteiros positivos); quem confere contra o conteúdo é o motor. `protocol` passa a **3** em V3D-T1 se `pendingDecisions` for uma união fechada.

### B.3 Eventos novos (`EVENT_TYPES` e `chronicleTemplates`)

| Evento | Quando | Tarefa |
|---|---|---|
| `wageArrearsStarted`, `wageArrearsEnded` | O ouro acaba ou volta com soldo a pagar | V3C-T1 |
| `heroDiscontent`, `heroLeft`, `heroDismissed` | 12 h e 24 h de jogo em atraso; dispensa | V3C-T1 |
| `heroJoined` | Herói que chega por carta ou recompensa | V3C-T3 |
| `heroHired`, `festivalHeld`, `festivalEnded` | Taverna | V3C-T2 |
| `expeditionSent`, `expeditionNodeResolved`, `expeditionAtCrossroads`, `expeditionPathChosen`, `expeditionPostureDecided`, `expeditionReturned` | Ciclo de uma expedição | V3D-T1 |
| `heroInjured`, `heroRecovered`, `heroCaptured`, `heroRescued`, `heroDied`, `heroLeveledUp`, `itemFound`, `tileRevealed`, `threatTileCleared` | Desfechos | V3D-T2 |
| `marketTraded`, `marketPriceSwing` | Negociação; preço que cruza 80% ou 125% da base | V3E-T1 |
| `caravanSent`, `caravanArrived`, `caravanAmbushed` | Caravana | V3E-T2 |
| `masterArrived`, `masterWaiting`, `masterAssigned` | Mestres | V3E-T3 |

A rotação da Taverna e a mudança diária de preço **não** geram evento: mudam só a visão. Marcadores novos para os modelos de frase: `{heroi}`, `{classe}`, `{expedicao}`, `{no}`, `{desfecho}`, `{item}`, `{mestre}`, `{preco}`, `{quantidade}` (acrescentar em `CHRONICLE_PLACEHOLDERS`).

### B.4 `ViewState`: campos novos

| Onde | Campo | Tarefa |
|---|---|---|
| raiz | `guild: { built; level; heroLimit; heroes: Array<{ id; name; classLabel; level; xp; xpToNext; traits: Array<{ label; text }>; statusText; power; powerBreakdown; wagePerHour; discontent }>; wage: { perHour; coveredForSeconds: number \| null; arrears: null \| { secondsElapsed; text; discontentInSeconds; nextDepartureInSeconds } } }` | V3C-T1 |
| raiz | `tavern: { level; offers: Array<{ offerId; name; classLabel; level; traits; price; priceText; wagePerHour; affordable; blockedReason }>; nextRotationInSeconds; festival: { available; cost; blockedReason; activeForSeconds } }` | V3C-T2 |
| `resources[]` (ouro) | o soldo no `perHour` e no `breakdown` | V3C-T1 |
| `morale.terms` | termos da Taverna, do festival e do traço Devoto | V3C-T2 |
| `guild` | `slots`; `available: Array<{ modelId; label; riskText; durationSeconds; requirementsText; locked; lockedReason; firstStretchText }>`; `expeditions: Array<{ id; label; statusText; nodeTitle; nodeEndsInSeconds; log: Array<{ title; text; outcomeLabel }>; crossroads: null \| { text; decidesInSeconds; postureLabel; postureOptionLabel; options: Array<{ id; label; hint; locked; lockedReason }> } }>`; `reports` | V3D-T1 |
| raiz | `pendingDecisions` ganha `{ kind: 'crossroads'; id; title; expiresInSeconds }` | V3D-T1 |
| `guild` | em cada herói `equipment` e `injury`; `inventory: Array<{ id; label; slotLabel; rarityLabel; bonusText }>` | V3D-T2 |
| `threat` | o Covil limpo no texto da explicação | V3D-T2 |
| raiz | `market: { level; quoteDay; nextChangeInSeconds; prices: Array<{ resource; buy; sell; baseText; trend; breakdown; remainingToday; maxBuyable; maxSellable }> }` | V3E-T1 |
| `market` | `caravans: Array<{ id; text; arrivesInSeconds; escortName }>`; `caravanOffer: { available; blockedReason; maxUnits; priceRatioText; tripSeconds; riskText; riskBreakdown }` | V3E-T2 |
| raiz | `masters: Array<{ id; name; buildingLabel; adaptationEndsInSeconds; bonusPercent }>`; `mastersWaiting: number` | V3E-T3 |
| `workers[]` | `master: null \| { name; bonusText }` e a linha no `breakdown` | V3E-T3 |
| `council.pending[].options[]` | `lockedReason` com o traço ou a classe que falta | V3F-T1 |
| `objectives[]` | sem mudança de forma; identificadores novos | V3F-T2 |

`ReturnReport` (`packages/protocol/src/report.ts`) não muda de forma: os blocos ganham itens novos (V3F-T3).

### B.5 Conteúdo novo (`@lotg/content`)

| Arquivo | O que entra | Tarefa |
|---|---|---|
| **novo** `heroes.ts`; `ids.ts`; `balance.ts` | Classes, atributos-base, traços, heróis nomeados, `xpToNext`, `balance.heroes` | V3C-T1 |
| `council.ts` †, **novo** `cards/scripted.ts` | Efeito `addHero`; a carta "Estrangeira ferida" | V3C-T3 |
| `buildings.ts`, `balance.ts`, `heroes.ts` | `tavern`; `balance.tavern`; modelos de candidato e lista de nomes | V3C-T2 |
| `buildings.ts`, **novo** `expeditions.ts`, **nova** pasta `missions/` | `guild`; tipos, schema e `balance.expeditions`; dois grafos de teste | V3D-T1 |
| **novo** `items.ts`; `balance.ts`; `tiles.ts` † | Itens, raridades, `balance.injuries`; destinos descobríveis | V3D-T2 |
| `missions/*.ts` | Os seis modelos, três variantes cada | V3D-T3 |
| `buildings.ts`, `balance.ts` | `market`; `balance.market`, com `caravan` | V3E-T1, V3E-T2 |
| **novo** `masters.ts` | Mestres nomeados; `balance.masters` | V3E-T3 |
| `council.ts` †, `cards/*.ts` † | Efeitos e requisitos novos; o lote 2 | V3F-T1 |
| `objectives.ts` | Objetivos 11 a 16 e condições novas | V3F-T2 |
| `chronicle.ts` | Eventos e marcadores da B.3 | cada tarefa |

---

**Próximo passo (2026-10-02):** fechar a v0.2. Depois, V3A-T1: conferir este plano contra o código, medir a linha de base e abrir `docs/pendencias-v0.3.md`. Nada desta versão começa a mudar o estado do jogo antes de a v0.2 estar publicada e migrada (§0.8), e publicar continua sendo uma ação separada, só com autorização do autor.
