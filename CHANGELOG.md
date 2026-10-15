# Registro de mudanças

Todas as mudanças relevantes de Lords of the Guild ficam registradas aqui. O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e a numeração, o [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [Não lançado]

Nada ainda.

## [0.3.0] — 2026-10-15

**v0.3 "A Guilda"** (GDD §16.2 e §18.2; plano em [`docs/roadmap-v0.3.md`](docs/roadmap-v0.3.md)): o feudo ganha uma equipe. Heróis com nome, soldo e classe vêm de uma carta do Conselho e da Taverna, saem em expedição de seis tipos com encruzilhadas e Posturas, voltam com um relatório nó a nó, e o excedente do estoque vira ouro no Mercado, por balcão ou por caravana.

A versão foi implementada por agentes de código entre 2026-10-05 e 2026-10-07, tudo no `main`, por fases (A a F; a Fase G é o fechamento), cada uma com revisão independente depois do portão verde. As decisões de regra 1 a 21 foram fechadas pelo autor em 2026-10-05 ([ADR 0017](docs/decisions/0017-regras-da-v0.3-herois-taverna-e-soldo.md) e [ADR 0018](docs/decisions/0018-expedicoes-mercado-mestres-e-cartas-na-v0.3.md)), e outras rodadas de perguntas em 2026-10-06 e 2026-10-07 mudaram regras (abaixo). O que foi feito, fase por fase: [`docs/relatorio-v0.3.md`](docs/relatorio-v0.3.md).

O que esta versão **não** tem, dito antes de tudo: **nenhum playtest aconteceu** (nem o desta versão, nem o da v0.1 e o da v0.2: não há linha de base de pessoas); **o autor não jogou nenhuma fase** antes da seguinte, como o roadmap pedia; o quadro em [`docs/acceptance-v0.3.md`](docs/acceptance-v0.3.md) tem a prova automática de cada critério e a coluna de evidência manual **vazia**; **todo o conteúdo narrativo** (os 18 grafos de expedição, os relatórios, os candidatos da Taverna, os heróis com nome) é **rascunho que o autor não leu**, e as decisões 1 e 4 a 21 foram aprovadas em bloco, sem leitura item a item; só o **Chromium** foi usado (Firefox, Safari, celular e leitor de tela, não); **nenhuma partida real de produção passou pela migração** do estado 12 para o atual, só retratos congelados; **o ensaio de reversão com imagens nunca foi feito**; o backup fora do servidor e a cópia do `RECOVERY_CODE_SECRET` fora do Coolify continuam pendentes; e a matriz de balanceamento de fechamento (V3G-T1) e o desempenho com 50 bots não foram registrados. A tag e a release são do autor.

### O que muda nas partidas em andamento

Quem já joga a v0.2 (estado 12) mantém o feudo: ele é migrado, um passo por versão, na primeira leitura ou pelo job de avanço.

- **Nada se perde nem se paga de novo**, e nenhum acontecimento da v0.3 é calculado antes da fronteira da migração. Os passos não emitem eventos nem sorteiam.
- **A carta da "Estrangeira ferida" chega também a quem já passou do 13º dia de jogo**, na primeira audiência do Conselho com lugar, uma vez. Sem ela, quem joga desde a v0.1 nunca teria o primeiro herói. Nenhum herói é dado por migração.
- **Nenhum soldo de antes da migração é cobrado**: o soldo só existe depois que o primeiro herói chega.
- **O piso de população** protege 3 aldeões comuns; os Mestres não contam (resposta do autor de 2026-10-07).
- **A fome (e o soldo em atraso) que fechou há pouco e já devia uma deserção é cobrada na virada seguinte** ("o que venceu é cobrado"): é mudança de regra da v0.2 em partidas vivas, **confirmada pelo autor em 2026-10-06**.
- **Quem está com o jogo aberto recebe "Há uma versão nova do jogo. Recarregue a página."** (`426`), porque o protocolo sobe de 2 para 3; o cache do app é descartado e o cursor da Crônica, mantido.
- **Reversão.** Depois da primeira publicação, a imagem anterior **não** é destino de reversão sem restaurar o backup: a `v0.2.0` recusa um estado de versão futura com `500`, sem gravar, mas uma partida já migrada só volta com o backup. O procedimento, o ponto de retorno e o aviso estão em [`deploy/README.md`](deploy/README.md), "Reverter depois de uma migração de estado" e "A primeira publicação da v0.3". **Faça o backup manual do banco antes do `push`.**

### Mudado

Com as respostas do autor (2026-10-06 e 2026-10-07):

- **Espera da encruzilhada de 12 h reais** em qualquer ritmo (era 6 h na proposta): com 6 h, quem visita uma ou duas vezes por dia nunca decidia uma encruzilhada.
- **Soldo em atraso em tempo real**: 12 h para o Descontente, 24 h para a primeira partida e 2 h entre as seguintes; Leal nunca parte; o atraso que reabre em menos de 2 h reais continua de onde estava.
- **O soldo cresce com o nível do herói**: 2, 3, 4, 6, 8, 10, 12, 15, 18 e 20 de ouro por hora de jogo, do nível 1 ao 10 (tabela proposta pelo agente, para o autor rever).
- **A caravana paga 15% sobre o balcão** (era 1,4 vezes o preço de venda do dia): a manobra de comprar e enviar no mesmo instante dava lucro certo.
- **A primeira alocação de um Mestre é imediata**; só mudar de edifício custa um dia de jogo de adaptação (estado 24).
- **O capturado não conta no limite de heróis**; os lobos do outono descem mesmo com o Covil limpo; as dificuldades dizem o que acontece aos heróis em expedição.
- **O ouro parado não caiu** com o Mercado, as caravanas e o soldo por nível: está registrado em [`docs/balance-v0.3.md`](docs/balance-v0.3.md) e fica para a v0.4.

### Adicionado

**Motor (`@lotg/engine`) e conteúdo (`@lotg/content`)**

- **Heróis e soldo**: quatro classes, oito traços, atributos inteiros, nível e experiência por tabela; soldo como consumo contínuo de ouro, sem dívida; o atraso abre no instante exato em que o ouro acaba. Limite de heróis de 1 mais o nível da Taverna; uma recompensa nunca é barrada pelo limite.
- **A carta roteirizada "Estrangeira ferida"** (`addHero`; Edda, Guerreira Leal, e Rolf, Arqueiro Prudente) e a lista dos heróis prometidos.
- **Taverna** (níveis 1 a 5): candidatos em rotação, contratação, dispensa, moral e festival (um por estação).
- **Guilda dos Aventureiros** (níveis 1 a 4) e **expedições**: seis modelos (Patrulha dos Arredores, Floresta Antiga, Covil de Lobos, Resgate, Ruínas de Vel'Thar e Pântano Nebuloso), três variantes cada, 18 grafos; encruzilhada com prazo real e **Postura** (Cautelosa, Equilibrada, Ousada); relatório nó a nó; ferimento (2 h e 12 h de jogo), captura e **Resgate**, morte em Rei de Ferro; experiência; equipamento em três espaços, quatro raridades e doze itens; Covil de Lobos que pode ser limpo (a Ameaça cai e o tile para de somar, até a virada do ano).
- **Mercado** (níveis 1 a 5): preço que anda a cada dia de jogo, compra, venda a 85% do preço e volume diário por recurso. **Caravanas a Porto do Rio** (Mercado nível 2), com preço fixado no envio, emboscada sorteada na chegada e escolta. **Mestres** (Odo, Berta, Gil e Ximena): +15% no edifício em que trabalham.
- **Objetivos 11 a 16**. O **lote 2 do Conselho ficou fora** desta versão (pendência F-3): o Conselho continua com as 21 cartas da v0.2 e a "Estrangeira ferida".
- **Estado na versão 24**, em doze passos de 12 a 24, com contadores de identidade (`state.ids`) e fluxos de sorteio por entidade (`expedition:` e `caravan:`), apagados quando a entidade termina.
- Eventos novos com frase na Crônica para cada mecânica acima.

**Servidor (`@lotg/server`), protocolo (`@lotg/protocol`) e SDK (`@lotg/client-sdk`)**

- **Protocolo 3.** Ordens novas: contratar, dispensar, festival, enviar expedição, escolher caminho, equipar, enviar o Resgate, negociar (`trade`), enviar caravana (com o dia da cotação) e alocar Mestre. Recusa `PRICE_CHANGED` quando o dia da cotação virou.
- `GET /v1/catalog` com as frases novas das dificuldades.

**App web (`@lotg/web`)**

- **Abas Guilda e Mercado**: heróis com ficha, soldo e atraso; Taverna; destinos com risco, duração, régua da equipe e Postura; a folha da encruzilhada com o prazo real; relatórios nó a nó; arsenal; tabela de preços, negociação em duas etapas, caravanas e Mestres; atalho "Vender até N".
- **Relatório de Retorno e "Antes de partir"** com a Guilda e o Mercado: uma linha por expedição, a marca da Postura, vendas, emboscadas e o que ainda se pode decidir.
- Avisos, linha da árvore, barra de status e paleta de comandos para cada ordem nova.

**Simulador (`@lotg/sim-cli`)**

- Bots `explorador`, `ousado` e `especulador`; colunas da Guilda e do Mercado nos CSVs; ouro por fonte e por destino; faixas remedidas.

**Página de apresentação (`@lotg/landing`)**

- O parágrafo "No horizonte" deixa de prometer a Guilda, os heróis e as expedições: o horizonte fica com a guerra e o Cerco do Inverno, o mapa e o legado.

### Corrigido

Defeitos que as revisões independentes acharam depois de cada portão verde, todos com teste de regressão (um commit por defeito, `V3x: corrige …`):

- **Soldo e fome** (Fase C): o atraso que escapava da cobrança fechando logo antes da virada (e o mesmo furo na deserção por fome da v0.2); o Descontente que saía de graça; o herói que chegava a um atraso velho e partia sem carência; a promessa de herói que podia passar do teto e repetir o herói com nome; o evento da contratação que levava o modelo do candidato para fora do servidor; o atraso aberto com a Mina pagando o soldo inteiro; o número do festival que o motor ignorava.
- **App** (Fase C): o Relatório de Retorno sem a contratação e o festival em "Gasto"; o "Tentar de novo" que sobrevivia à troca de feudo ou de conta; a linha "Guilda" da árvore sem o alerta do ouro; avisos que gastavam os três da hora.
- **Expedições** (Fase D): o cativo resgatado que voltava devendo o atraso inteiro; a equipe presa em um caminho que o conteúdo deixou de ter; dois Resgates para um cativo e dois envios ao Covil; oito defeitos no app (a classe pedida e a equipe sugerida lidas da visão, o aviso "decidida em outra aba" que era falso, o botão do Resgate da ficha errada, o item vendido que sumia do retorno); nove defeitos editoriais nos grafos (opção dominante, lições impossíveis, pistas que mentiam, "Covil dos Lobos" e "Covil de Lobos").
- **Mercado, caravanas e Mestres** (Fase E): a escolta ou expedição perpétua que blindava o herói do soldo em atraso; as guardas do estado que deixavam passar um Mercado e caravanas impossíveis; os nomes invertidos nos eventos de Mestre; a carga perdida lida como corte de depósito no Relatório; a conferência velha que sobrevivia a um novo clique; o foco que sumia ao fechar a conferência; a tela sem o número do excedente; a emboscada barrada pela cota de avisos.

## [0.2.0] — 2026-10-05

**v0.2 "Estações e Conselho"** (GDD §16.2 e §18.2; plano em [`docs/roadmap-v0.2.md`](docs/roadmap-v0.2.md)): o feudo muda com as estações, o estoque tem limite, o Conselho traz dilemas com prazo e os lobos vêm com ou sem o jogador.

A versão foi implementada por agentes de código entre a noite de 2026-10-01 e 2026-10-02 e **publicada por fase no `main`**, por autorização do autor: as Fases A e B, depois a Fase C, depois as Fases D e E, em três envios em 2026-10-02; a primeira publicação foi em dois passos, como [`deploy/README.md`](deploy/README.md) pede. Em 2026-10-05, com quatro dias de jogo em produção e outras pessoas jogando, o autor respondeu às pendências ([ADR 0016](docs/decisions/0016-respostas-do-autor-as-pendencias-da-v0.2.md)); a Fase G aplicou as respostas e foi publicada no mesmo dia (envio às 13:11, horário de Brasília; `builtAt` 16:17 UTC), depois de um backup manual do banco. **A tag `v0.2.0` e a release foram criadas nesse dia, a pedido do autor**, sobre o commit que sobe os números de versão dos pacotes e de `GET /v1/version` para `0.2.0`.

O que esta versão **não** tem, dito antes de tudo: nenhum playtest organizado com outras pessoas aconteceu (nem o da v0.1, nem o da v0.2), embora haja gente jogando em produção; o autor não jogou cada fase antes da seguinte, como o roadmap pedia; e o quadro dos critérios em [`docs/acceptance-v0.2.md`](docs/acceptance-v0.2.md) tem a prova automática de cada um e a coluna de evidência manual **vazia**: a versão foi fechada por decisão do autor, não por aceitação critério a critério. As regras nasceram aplicadas por delegação (ADRs [0013](docs/decisions/0013-regras-da-v0.2-tempo-ritmo-migracao-e-economia.md), [0014](docs/decisions/0014-conselho-e-ameaca-na-v0.2.md) e [0015](docs/decisions/0015-cronica-sem-o-fecho-diario-do-desperdicio.md)) e foram confirmadas pelo autor em 2026-10-05, as principais uma a uma e as leituras, telas e textos menores em bloco ([`docs/pendencias-v0.2.md`](docs/pendencias-v0.2.md)). Os backups continuam no mesmo disco do banco, e a reversão atravessando uma migração de estado não foi ensaiada. O roteiro para jogar em desenvolvimento está em [`docs/manual-test-v0.2.md`](docs/manual-test-v0.2.md).

### Mudado em 2026-10-05, com as respostas do autor (Fase G)

O autor respondeu às pendências com quatro dias de jogo em produção ([ADR 0016](docs/decisions/0016-respostas-do-autor-as-pendencias-da-v0.2.md)). As regras deixam de valer "por delegação": estão confirmadas, com as mudanças abaixo. O estado do jogo sobe para a **versão 12**.

- **Deserção por fome em tempo real**: 12 h reais de carência e depois um aldeão a cada 2 h reais, em qualquer ritmo, cobrados na virada do dia. No ritmo Rápido fica três vezes mais lenta; no Normal não muda; no Tranquilo saem dois por virada.
- **A fome que reabre logo é a mesma**: se a fome volta com menos de 2 h reais sem fome, o prazo e a contagem continuam de onde estavam. Mandar todos à Fazenda e de volta deixou de zerar o prazo.
- **Aviso da Torre de Vigia em tempo real**: 1 h real no nível 1 e 2 h reais no nível 2, em qualquer ritmo.
- **Celeiro e Armazém guardam 1.000 no nível 1** (eram 900): em Senhor o Salão do Senhor nível 8 passa a caber no Armazém.
- **O objetivo 4 volta a dar 50 de ouro**, além de desbloquear o Celeiro, o Armazém e a Torre de Vigia. Quem já o tinha cumprido não recebe o ouro depois.
- **Sete correções nas cartas do Conselho**, com cada reescrita aprovada pelo autor: nas cartas da primavera a moral perdida dura mais e o poço custa menos; "Um teto antes do frio", "Vigília entre vizinhos", a Ponte do Degelo e o Celeiro Comum deixam de prometer o que a regra não dá; as pistas da Promessa da Paliçada ficam sem número; "Tábuas para as reservas" e "A notícia da primavera" não saem mais com a moral abaixo de 40. Nenhum id mudou.
- **Descrições das dificuldades**: dizem o que o Conselho faz por quem falta ("decide sem cobrar nada do feudo" em Camponês e em Senhor; "escolhe o caminho mais duro" em Rei de Ferro).
- **Recusas de obra com a concordância certa** ("As Habitações já estão em obras.").
- **App**: a fome e o frio passam na frente da carta pendente na barra de status e no título; depois de uma incursão o botão é "Ver a defesa" quando a Paliçada não pode começar, e não ordena mais a Torre; na aba Feudo os Objetivos vêm antes do painel da Ameaça.

### Adicionado

**Motor (`@lotg/engine`) e conteúdo (`@lotg/content`)**

- **Dificuldade e ritmo por partida**: Camponês, Senhor e Rei de Ferro; Rápido (3×, recomendado), Normal (1×) e Tranquilo (0,5×). Gravados no estado na criação e imutáveis. Da dificuldade, três coisas mudam regra: o limite do estoque, a deserção por fome e a opção que o Conselho aplica quando uma carta expira (ADR 0013, decisões 2 e 2a; ADR 0014, decisão 9).
- **Migração do estado por versão** (`migrateState`, `CURRENT_SCHEMA_VERSION`, `StateMigrationError`): um passo por versão, do 1 ao 12, cada um conferindo a forma exata da versão de que parte. A partida da v0.1 entra nas regras novas a partir de uma **fronteira** (`migratedAtMs`) e nada da ausência anterior é recalculado com regras que não existiam (ADR 0013, decisão 4). Retratos congelados de cada versão em `packages/engine/src/__fixtures__/`.
- **Sorteios com semente** (`random.ts`: xoshiro128\*\* só com inteiros, fluxos nomeados `council`, `morale` e `horde`). O estado do gerador é gravado com a partida e nunca sai na visão; só `advanceTo` sorteia, em instantes da linha do tempo, e a divisão de intervalo continua exata com os sorteios no caminho.
- **Estações com efeito**: fatores de produção por estação, obras iniciadas no inverno mais lentas, recrutamento ordenado na primavera mais rápido, prazos fixados quando nascem. No inverno a lareira queima madeira por habitante; sem madeira abre o **frio**, com produção e moral menores (GDD §4.1; ADR 0013, decisão 13).
- **Armazenamento**: comida, madeira e pedra param no limite, que cresce com o **Celeiro** e o **Armazém** (Salão Nv2) e com o fator da dificuldade; o ouro não tem limite. O que não cabe é desperdício contado, e um custo que nenhum depósito comporta é recusado com `EXCEEDS_STORAGE` e a frase do que fazer. O estoque herdado acima do limite fica (GDD §5.5; ADR 0013, decisão 17).
- **Segunda fila de obras** (Salão Nv4) e **planejadas automáticas**: "iniciar quando houver recursos", na ordem da lista, pulando as bloqueadas, no milissegundo em que a produção completa o custo. Comandos `setAutoStart` e `planConstruction { autoStart, targetLevel }`; recusas `QUEUE_LOCKED`, `NOT_PLANNED` e `STALE_LEVEL` (GDD §6.3; ADR 0013, decisão 18).
- **Troca de ofício e experiência**: quem chega a um edifício rende metade por um dia de jogo; cada ofício ocupado ganha experiência e a mestria rende mais (GDD §5.3 e §5.4).
- **Moral** de 0 a 100, recalculada a cada virada de dia, com efeito na produção, colonos e partidas por sorteio, deserção por fome longa (não em Camponês) e um **piso de 3 aldeões** (GDD §5.6 e §5.7; ADR 0013, decisão 19).
- **Conselho do Feudo**: uma audiência a cada 4 dias de jogo, no máximo 2 cartas à espera, **24 h reais** para responder em qualquer ritmo; sem resposta, o conselho aplica a opção marcada para a dificuldade, que nunca tem custo. Efeitos escondidos, continuações agendadas, flags e a virada de ano. Comando `answerCard`; recusas `CARD_NOT_PENDING`, `CARD_EXPIRED`, `INVALID_OPTION` e `OPTION_LOCKED` (GDD §7; ADR 0014).
- **O primeiro lote de 21 cartas**: as cadeias "O Celeiro Comum", "A Ponte do Degelo" e "A Promessa da Paliçada", de três cartas cada, e 12 avulsas, quatro delas recorrentes ([`docs/content-v0.2.md`](docs/content-v0.2.md)). Nenhuma é roteirizada; a carta do herói fica para a v0.3.
- **Torre de Vigia, tiles abstratos e Ameaça**: o Covil de Lobos como tile sem mapa e a Ameaça de 0 a 100, que sobe com os tiles ativos e com o outono e cai a cada incursão. **Só quem tem a Torre a vê**: sem ela, o número, os tiles e as incursões marcadas não saem do servidor. Torre até o nível 2: o primeiro avisa a incursão antes, o segundo também diz o tamanho (GDD §8.2; ADR 0014, decisões 10 e 11). Os números da subida e da queda estão em `packages/content/src/balance.ts` (`balance.threat`) e são revistos no balanceamento de fechamento.
- **Paliçada** (Salão Nv3), níveis 1 e 2: segura as incursões até um tamanho e deixa passar metade do estrago das maiores.
- **Incursões de lobos**: os uivos no 10º dia e a incursão leve do roteiro no 16º dia do ano 1, com ou sem o jogador; depois, incursões sorteadas pela Ameaça. Uma incursão sofrida leva uma parte da comida e da madeira, fere aldeões por um dia de jogo (eles voltam sozinhos ao ofício) e baixa a moral por dois dias; a frase da Crônica diz o que a teria detido (GDD §8.2 e §12.3).
- **Objetivos 5 a 10** do Senhor: Torre de Vigia, primeira carta respondida, primeiro depósito, uma obra automática, Paliçada e um inverno sem frio; a visão diz o que falta em cada um (`missing`) e onde ele se cumpre (`target`). Os ids 1 a 4 não mudaram (ADR 0014, decisão 12).
- Eventos novos com frase na Crônica para cada mecânica acima, e na visão a explicação de cada número novo, já em tempo real.

**Servidor (`@lotg/server`), protocolo (`@lotg/protocol`) e SDK (`@lotg/client-sdk`)**

- `POST /games` aceita `difficulty` e `timeScale` (um dos ritmos oferecidos); valor fora da lista é `400 VALIDATION`. Sem os campos, valem Senhor e `GAME_TIME_SCALE`.
- **`GET /v1/catalog`**: as opções de nova partida (dificuldades, ritmos e os padrões), sem autenticação, com ETag. `client.catalog()` no SDK.
- **Protocolo 2**: a visão passou a trazer as cartas do Conselho (`council`, `pendingDecisions`), que o app do protocolo 1 não sabe ler. Um cliente que manda `X-Lords-Protocol` diferente recebe `426 UPGRADE_REQUIRED` com "Há uma versão nova do jogo. Recarregue a página." As rotas continuam em `/v1`.
- Migração do estado sob o lock da partida (`loadGame`), gravada na primeira escrita com um só incremento de `state_version`, também pelo job de avanço. Estado de versão futura ou fora da forma responde `500` **sem gravar por cima**; o job conta a falha e segue com as outras partidas.
- A nota "Sua escolha voltou" no Markdown da Crônica, sob a linha da carta que continua outra.

**App web (`@lotg/web`)**

- Dificuldade e ritmo nas boas-vindas, em "Nova partida" e nas Preferências, com "Jogar agora" ainda a um clique.
- Estação e o que ela muda no cabeçalho; a conta da lenha no outono e no inverno; aviso de frio; a linha "Lareira" na árvore.
- Limite do estoque com a explicação, "cheio em" com o alerta e a obra do depósito ao lado, e o que vai ao chão.
- Uma linha por fila de obras, planejadas com a caixa "Iniciar quando houver recursos" e o que cada uma espera.
- O custo da troca de ofício antes do clique, a adaptação e a barra de experiência.
- A moral no cabeçalho e no painel "Moral", termo a termo, com o conselho do que fazer.
- **"Antes de partir"** na aba Hoje: até cinco itens, cada um com o botão que resolve; aviso de estação uma hora antes e na virada.
- **A aba Conselho**: a carta com custo, consequência conhecida, pista, o que tranca cada opção, o prazo de relógio e o que o conselho faria sozinho; aviso de carta nova, linha na árvore, na aba Hoje e na barra de status.
- **O Relatório de Retorno em três blocos**: "O feudo prosperou", "O que exigiu um preço" (cada perda com a próxima ação) e "Você ainda pode decidir". A aba que ficou aberta e fora de vista por 4 h ou mais também o recebe, na volta.
- O painel da Ameaça com a Torre de Vigia e a defesa ao lado, o alarme da incursão, os feridos no cabeçalho e nos ofícios.
- Os objetivos 5 a 10 no painel, na árvore e na aba Hoje, cada um com o botão que leva até onde ele se cumpre.
- O painel Recrutar e o cabeçalho mostram quanto falta para o próximo aldeão chegar.

**Simulador (`@lotg/sim-cli`)**

- A matriz de balanceamento (`pnpm -s sim -- --matrix`): 3 perfis de visita × 3 ritmos × 50 sementes, em duas janelas (7 dias reais e um ano de jogo), com faixas por ritmo e por dificuldade (`--difficulty`) que `pnpm test` cobra.
- O bot `preguicoso` (uma visita por dia), os bots como listas de políticas e uma política para cada mecânica nova; `--game-year`, `--difficulty`, `--seeds` e `--perf` (o custo do motor em ausências longas).
- A cobertura do Conselho em 50 sementes (`src/coverage.ts`).

**Operação e documentação**

- Procedimentos de reversão depois de uma migração de estado e da primeira publicação em dois passos ([`deploy/README.md`](deploy/README.md)).
- Consultas do playtest com filtro de período em `deploy/analytics/ops.sql`; convite e formulário do playtest em `docs/playtest/`.
- [`docs/architecture.md`](docs/architecture.md) reescrito como "Arquitetura da v0.2"; GDD na versão 0.7; ADRs 0013 a 0015; [`docs/roadmap-v0.3.md`](docs/roadmap-v0.3.md) proposto.

### Alterado

- **O objetivo 4** passou a desbloquear o Celeiro, o Armazém e a Torre de Vigia, no lugar dos 50 de ouro do [ADR 0002](docs/decisions/0002-objetivo-4-v01.md). Quem o concluiu na v0.1 não ganha nem perde nada.
- **`GAME_TIME_SCALE`** deixou de ser o ritmo de toda partida nova: é o padrão de quem não escolhe.
- **A Crônica** também deixou de trazer o fecho diário do desperdício (`storageWasted`), que continua em `GET /events` e no Relatório ([ADR 0015](docs/decisions/0015-cronica-sem-o-fecho-diario-do-desperdicio.md)).
- Toda partida nasce na primavera: com o efeito da estação, o começo do jogo ficou mais farto do que na v0.1.
- O cache do app no navegador traz a marca da versão; o de outra versão é descartado, e a primeira volta depois de uma atualização tem um relatório sem a comparação dos estoques.
- Seguir um aviso do jogo ("Ver", "Decidir") recolhe os outros avisos do jogo.
- Página de apresentação: crédito dos ícones Codicons (CC BY 4.0), que aparecem nas capturas do jogo, no rodapé e em `licencas.txt`; ajustes de texto ("Não há e-mail nem senha", legenda da captura, aviso para celular, página de caminho errado); `id` do HTML em inglês; imagem da prévia do link refeita.
- O monitor de saúde (`health.yml`) passa a consultar também a página de apresentação, e testes amarram o título e o endereço dela ao que o monitor, o deploy e a verificação de fumaça procuram.

### Efeito nas partidas antigas

- **Nada se perde.** Uma partida da v0.1 é migrada na primeira leitura ou pelo job de avanço (em até cerca de uma hora depois de cada publicação), uma vez, preservando estoques, obras, planejadas, população e objetivos.
- **Tudo conta da fronteira**, o instante em que a migração encontrou a partida: a moral nasce em 50 e é recalculada na primeira virada de dia; a experiência do ofício começa em zero; ninguém passa a render metade; as planejadas antigas continuam manuais; a primeira carta chega 4 dias de jogo depois; a Ameaça começa em zero; os lobos do roteiro só vêm para quem ainda não passou do 16º dia do ano 1.
- **O estoque acima do novo limite fica**, não recebe produção e pode ser gasto. Uma partida parada no inverno e sem madeira abre o frio na fronteira, com a linha na Crônica. A fome que já vinha de antes conta desde quando começou (pendência C-3).
- **O ritmo e a dificuldade não mudam**: a partida segue no ritmo em que nasceu (inclusive um que o jogo não oferece mais, com um rótulo calculado) e na dificuldade Senhor.
- **Quem concluiu os quatro objetivos** recebe os seguintes na fronteira, sem prêmio repetido; o que já tinha feito conta ali.
- **Os recibos antigos** nunca são reescritos: o reenvio de uma ordem da v0.1 devolve o corpo original.
- **Uma aba aberta desde antes da publicação** do protocolo 2 recebe o aviso para recarregar a página.
- **Reverter a imagem da API** depois de uma migração de estado não desfaz a migração. Desde a Fase B toda imagem recusa um estado mais novo que o dela, sem gravar por cima; a da `v0.1.0` não confere e **não pode** ser destino de reversão. Os caminhos são avançar com uma correção ou restaurar o backup anterior ao deploy ([`deploy/README.md`](deploy/README.md), "Reverter depois de uma migração de estado").

### Limites conhecidos

- **Ninguém além dos agentes jogou a v0.2.** As decisões de regra, as frases de dificuldade e de ritmo, as 21 cartas e os textos novos aguardam o autor ([`docs/pendencias-v0.2.md`](docs/pendencias-v0.2.md)). Os playtests da v0.1 e da v0.2 não aconteceram.
- **Balanceamento em aberto**: no momento destas notas a Ameaça sobe até perto do máximo e fica lá, e as incursões sorteadas são quase todas médias ([`docs/balance-v0.2.md`](docs/balance-v0.2.md), seção 14.4); os números da subida e da queda estão sendo revistos (roadmap, V2F-T1). Também ficaram para o autor: níveis anunciados que ninguém alcança em Senhor e Rei de Ferro, obras que se esgotam cedo no ritmo Rápido com o ouro empilhando, a deserção rápida no ritmo Rápido e a meta de desperdício fora do ritmo Normal (pendências C-1, C-2, C-5 e C-6). A matriz completa do simulador (V2F-T1) não foi rodada no fechamento.
- **A reversão atravessando uma migração de estado nunca foi ensaiada com imagens**, e nenhum estado de produção passou pelas migrações antes da publicação. Os backups continuam no mesmo disco do banco, e não há registro de cópia de `RECOVERY_CODE_SECRET` fora do Coolify.
- **A aba que fica à vista o tempo todo** não recebe o Relatório de Retorno: recebe os avisos e as linhas da Crônica de cada acontecimento. Nada chega com a aba fechada; uma carta pode expirar sem o jogador saber (24 h reais de prazo).
- **"As mesmas ordens dão o mesmo feudo em qualquer ritmo"** deixa de valer quando uma carta expira: o prazo da carta é de relógio.
- **As previsões da visão** não contam com as incursões (são segredo até os vigias as verem) e têm dois defeitos conhecidos quando a lenha e a comida acabam no mesmo inverno (pendência C-8).
- **Só Chromium** nos testes automáticos; Firefox, Safari, celular e leitor de tela não foram conferidos. As capturas da página de apresentação mostram a bancada de antes da v0.2 (`pnpm capture:landing` não foi rodado).
- **Volume**: a visão ficou de 2 a 3 vezes maior que a da v0.1, e cada recibo de ordem guarda uma; o volume da tabela `commands` e a carga com 50 bots não foram medidos de novo.
- **Ainda não existem** (GDD, versões seguintes): heróis, Taverna, expedições, Mercado e caravanas, Mestres (v0.3); exército, Muralha de Pedra e níveis 3 em diante da Torre e da Paliçada, Hora da Vigília com efeito (v0.4); mapa gráfico (v0.5). "Baixar cópia da partida (JSON)" continua sem existir.

## [0.1.0] — 2026-10-01

"Fundação online": o MVP descrito no [GDD §16.1](GAME_DESIGN.md), no ar em `https://lords.palsincomehub.com`. Tag `v0.1.0`; [release no GitHub](https://github.com/gustavopals/pals-vscode-game/releases/tag/v0.1.0).

O autor jogou a versão em produção, em dois navegadores, gostou e decidiu fechar o MVP; os 12 critérios de aceitação são dados como aceitos por essa decisão, sem avaliação critério a critério. Não há evidência escrita por critério: [`docs/acceptance-v0.1.md`](docs/acceptance-v0.1.md) diz em que cada aprovação se apoia e o que ninguém verificou. **O playtest de 48 horas com outras pessoas não foi realizado; passou para a v0.2**, como primeira tarefa ([`docs/roadmap-v0.2.md`](docs/roadmap-v0.2.md)).

### Adicionado

**Motor (`@lotg/engine`) e conteúdo (`@lotg/content`)**

- Estado inicial reproduzível de Pedra Alta a partir de uma semente.
- Quatro recursos (comida, madeira, pedra e ouro) com produção e consumo contínuos, em milésimos inteiros e com acumuladores: nenhuma conta usa ponto flutuante no estado.
- `advanceTo` por trechos da linha do tempo, com a invariante de divisão de intervalo testada por propriedade e sem tolerância: avançar de uma vez dá o mesmo estado e os mesmos eventos que avançar em partes.
- Seis edifícios (Salão do Senhor, Fazenda, Serraria, Pedreira, Mina de Ouro e Habitações) com níveis, custos e tempos vindos do conteúdo; uma obra ativa por vez, planejamento e cancelamento com devolução.
- Alocação de aldeões, recrutamento com fila, custo e limite habitacional.
- Fome determinística: começa no instante exato em que a comida acaba, reduz a produção e congela o recrutamento até a comida voltar.
- Calendário com ano, estação e dia. As estações ainda não têm efeito.
- Objetivos 1 a 4, com recompensa, e eventos emitidos já com a frase da Crônica.
- Comandos validados, com um código e uma frase em português para cada recusa.
- `deriveViewState`: tudo o que a interface mostra, com a explicação de cada número, em tempo real conforme o ritmo da partida.
- Números e textos de jogo em `@lotg/content`, validados por schemas zod.

**Servidor (`@lotg/server`), protocolo (`@lotg/protocol`) e SDK (`@lotg/client-sdk`)**

- API `/v1` em Fastify com PostgreSQL 16: contas, partidas, visão, comandos, eventos, Crônica, `GET /health` e `GET /version`.
- Conta anônima em um clique; sessões por navegador com JWT de 15 minutos e refresh rotativo com histórico completo (o reuso de um token antigo revoga a sessão); sair da máquina.
- Código do Reino para entrar em outro navegador, guardado só como HMAC-SHA256 com chave independente do JWT.
- Exclusão de conta em duas etapas: bloqueio imediato e remoção do banco pelo primeiro job depois de sete dias.
- Servidor autoritativo com avanço preguiçoso: leituras e comandos travam a partida e avançam o mundo até agora; um job avança as partidas paradas há mais de uma hora.
- Comandos idempotentes por `commandId`, com recibo completo: o reenvio devolve o status e o corpo originais; o mesmo identificador com outro conteúdo é recusado. Uma recusa do motor preserva o avanço do mundo.
- `GET /view` com ETag da representação completa.
- Ritmo por partida (`GAME_TIME_SCALE`, padrão 3): o dia de jogo dura 40 minutos reais e o ano, 56 horas ([ADR 0011](docs/decisions/0011-ritmo-3x-no-mvp.md)).
- Limites de taxa por sessão e por IP, validação zod de toda entrada, logs em JSON sem tokens nem códigos.
- Migrações SQL aplicadas no arranque, sob advisory lock.
- Schemas zod compartilhados entre servidor e cliente; um teste de tipos quebra a compilação se o protocolo e o motor divergirem.
- Cliente HTTP tipado, com renovação de sessão (uma por vez) e retentativas que reenviam a mesma ordem com o mesmo `commandId`.

**App web (`@lotg/web`)**

- Bancada com aparência de editor de código: barra de atividades, árvore lateral, abas, barra de status e paleta de comandos (`F1` ou `Ctrl+K`).
- Boas-vindas com dois campos e um clique (**Jogar agora**), sem e-mail, senha ou instalação.
- Abas Feudo, Hoje, Crônica (com download em Markdown), Preferências e Sobre.
- Temas escuro, claro e de alto contraste; navegação completa pelo teclado.
- Ciclo de atualização de 30 segundos (2 minutos em segundo plano), cache do último estado e modo sem conexão em leitura, com retorno automático.
- Relatório de Retorno ao abrir a página depois de 4 horas fora.
- Avisos no canto com limite por hora, "Silenciar 2h", modo discreto e, por opção do jogador, notificações do navegador com a aba em segundo plano.
- Várias abas dividindo a mesma sessão, com a renovação protegida por Web Locks.
- Lembrete "Proteja seu reino" 48 horas depois da primeira vez no navegador, para quem ainda não tem Código do Reino.
- Política de conteúdo estrita: só arquivos da própria origem, nenhum script ou estilo embutido, nada de terceiros.

**Página de apresentação (`@lotg/landing`)**

- Página estática em domínio próprio, com o botão **Jogar agora** que leva ao jogo ([ADR 0012](docs/decisions/0012-pagina-de-apresentacao.md)): o título em duas vozes ("Parece trabalho. É um feudo."), uma captura real do jogo lida de dois jeitos por um interruptor que é só CSS, e a barra de status da página com o botão sempre à mão.
- Só diz do jogo o que o jogo diz de si: testes conferem as frases da Crônica citadas contra o conteúdo e barram as formas mais comuns de promessa de duração, preço, multijogador e o nome "Visual Studio Code". As pinturas aparecem como arte conceitual; as capturas são refeitas por um roteiro (`pnpm capture:landing`).
- Política de conteúdo `default-src 'none'`, letras servidas pela própria página (Grenze Gotisch e Alegreya, SIL OFL), nenhuma medição de audiência.

**Simulador (`@lotg/sim-cli`)**

- Bot econômico que joga partidas inteiras só com o motor e gera um CSV com um retrato por hora; a mesma semente reproduz o mesmo arquivo.
- Modo remoto: bots contra uma API, com p50 e p95 por endpoint.

**Implantação e operação**

- Uma imagem para a API (alvo `runtime`, um único arquivo empacotado, sem `node_modules`), outra para o app (alvo `web`, Caddy servindo arquivos estáticos com os cabeçalhos de segurança) e outra para a página de apresentação (alvo `landing`, sobre a mesma base do Caddy).
- Produção no Coolify em três recursos: banco, API e app na mesma origem, com o proxy da plataforma na borda ([ADR 0009](docs/decisions/0009-implantacao-no-coolify.md)). A página de apresentação é um quarto recurso, em domínio próprio.
- Backup diário do banco com retenção de 14 dias; restauração ensaiada em um banco descartável.
- Reversão da API para a imagem anterior ensaiada.
- Deploy automático: cada push no `main` é implantado pelo job `deploy` da CI, depois de todos os outros jobs passarem (API, depois o app, depois a página de apresentação). Com a CI vermelha, nada vai ao ar.
- Monitor de saúde externo (workflow `health.yml`) e consultas agregadas de operação.
- Procedimentos em [`deploy/README.md`](deploy/README.md).

**Testes**

- Testes unitários e de propriedade (fast-check) do motor, goldens do `ViewState`, da Crônica e de um cenário de sete dias, e teste de pureza da API pública.
- Faixas de balanceamento conferidas com o bot do simulador.
- Testes de integração do servidor contra PostgreSQL real, com relógio controlado, incluindo concorrência, idempotência, rotação de sessão e expurgo.
- Testes em Chromium real (`pnpm test:e2e`) contra a API e o banco de teste, com o app compilado e a política de conteúdo de produção.
- Testes em Chromium da página de apresentação (`pnpm test:e2e:landing`), em tela de computador e de celular.
- Workflow de CI com `verify`, integração, navegador (app e página de apresentação) e build das três imagens.

**Projeto**

- Licença MIT.
- Decisões de arquitetura registradas em [`docs/decisions`](docs/decisions/README.md) e o desenho do que foi construído em [`docs/architecture.md`](docs/architecture.md).

### Divergências conscientes

O que a v0.1 faz diferente do desenho original do GDD, por decisão do autor. A lista completa, com o estado de cada item, está em [`docs/architecture.md` §6](docs/architecture.md).

- O cliente é um app web com aparência de editor, e não uma extensão do VS Code ([ADR 0008](docs/decisions/0008-cliente-web-com-aparencia-de-editor.md)). A extensão implementada antes foi removida.
- O ritmo é 3× e vem do servidor; o GDD previa ritmo fixo em 1 na v0.1. "Uma semana é um ano" não vale no MVP ([ADR 0011](docs/decisions/0011-ritmo-3x-no-mvp.md)).
- O vínculo com o GitHub fica desligado. O código existe e foi testado só com um GitHub simulado; quem troca de navegador usa o Código do Reino.
- A Crônica não traz as viradas de dia ([ADR 0007](docs/decisions/0007-cronica-sem-viradas-de-dia.md)).
- O objetivo 4 recompensa +50 ouro em vez de desbloquear edifícios que só existem na v0.2 ([ADR 0002](docs/decisions/0002-objetivo-4-v01.md)).
- O Código do Reino usa HMAC-SHA256 em vez de Argon2 ([ADR 0003](docs/decisions/0003-codigo-do-reino-hmac.md)).
- A produção roda no Coolify, e não em um VPS com Docker Compose ([ADR 0009](docs/decisions/0009-implantacao-no-coolify.md)).
- `GET /version` informa o que o servidor tem ligado ([ADR 0010](docs/decisions/0010-version-informa-o-que-esta-ligado.md)).
- "Reiniciar partida" é o comando "Nova partida", que arquiva o feudo atual.
- Há uma página de apresentação em domínio próprio, que o GDD não previa ([ADR 0012](docs/decisions/0012-pagina-de-apresentacao.md)).
- **Fechamento sem playtest externo.** O roadmap pedia um playtest de 48 horas com 3 a 5 pessoas antes da versão (F5-T2). Ele não foi realizado: a v0.1 fecha com o playtest do próprio autor, e o playtest com outras pessoas passou para a v0.2.
- **Aceitação sem evidência por critério.** O roadmap pedia a evidência de cada um dos 12 critérios registrada em produção, em Chromium e em Firefox (F5-T1). Os critérios foram dados como aceitos pela decisão do autor de fechar, sem avaliação um a um, apoiados nos testes automáticos e nas conferências registradas em [`docs/acceptance-v0.1.md`](docs/acceptance-v0.1.md).

### Limites conhecidos

- **Fora do escopo da v0.1:** efeitos de estação, cartas do Conselho, heróis, exército, mapa, mercado, Temporadas, interação entre jogadores e som.
- O jogador não escolhe dificuldade nem ritmo. A Hora da Vigília é guardada e ainda não muda nada no jogo.
- As partidas criadas antes do ritmo 3× continuam no ritmo 1; para o ritmo novo é preciso começar outra partida.
- Não existem `GET /catalog`, "Baixar cópia da partida (JSON)", gerador de números aleatórios (nenhuma regra sorteia) nem migração de estados entre versões (só existe a versão 1).
- O Relatório de Retorno só aparece ao abrir a página; uma aba deixada aberta não o recebe. Nada chega com a aba fechada.
- Uma conta anônima sem Código do Reino se perde se os dados do navegador forem apagados. Não há recuperação de conta excluída.
- O vínculo GitHub nunca foi testado com o GitHub real.
- Os testes automáticos rodam só em Chromium. O autor jogou em dois navegadores, sem registrar quais: Firefox não está confirmado. Safari, navegadores de celular e leitores de tela não foram conferidos. Os passos manuais de [`docs/manual-test-v0.1.md`](docs/manual-test-v0.1.md) não têm registro de execução.
- Não foram verificados em produção: o reinício da API com uma obra em andamento e a aba aberta, a fome e o retorno depois de um período longo de tempo real, e o expurgo de sete dias de uma conta excluída. Esses pontos se apoiam nos testes automáticos.
- Não houve playtest com outras pessoas antes do fechamento: o ritmo 3× e a clareza da interface só foram avaliados pelo autor.
- Os backups ficam no mesmo disco do banco. A reversão não foi ensaiada atravessando uma migração.
- Não há registro de cópia de `RECOVERY_CODE_SECRET` fora do Coolify: perder o servidor sem essa cópia invalida todos os Códigos do Reino. Os avisos da plataforma ainda não têm canal ligado.
- O desempenho foi medido em uma máquina só, com partidas jovens; rajadas sincronizadas ficam acima da meta ([`docs/perf-v0.1.md`](docs/perf-v0.1.md)). Em produção só foi medida uma carga pequena (5 bots por 2 minutos).
