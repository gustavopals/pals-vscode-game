# Conteúdo da v0.3: cartas do Conselho, heróis, Taverna e expedições

Data: 2026-10-05\
Tarefas: V3C-T3 do [roadmap da v0.3](roadmap-v0.3.md) (decisões 5 e 6 do [ADR 0017](decisions/0017-regras-da-v0.3-herois-taverna-e-soldo.md)) e V3C-T2 (a Taverna: decisões 4, 5 e 10; seção 5); o lote 2 entra aqui com V3F-T1; **o catálogo de expedições de V3D-T3 (seis modelos, dezoito grafos, com a ficha de cada um) está na seção 6**\
Formato: a ficha da [§13.4 do roadmap da v0.3](roadmap-v0.3.md), que é a da v0.2 ([content-v0.2.md](content-v0.2.md)) com os campos de equipe e de herói

**Estado da curadoria: rascunho, não lido pelo autor.** A carta deste documento foi escrita pelo agente e entrou no jogo sem aprovação: o autor escolheu "escrevo e sigo; você revisa depois" ([ADR 0018](decisions/0018-expedicoes-mercado-mestres-e-cartas-na-v0.3.md); pendência A-7 de [pendencias-v0.3.md](pendencias-v0.3.md)). Texto, números e nomes são conteúdo, e trocar qualquer um deles é editar `packages/content/src/cards/scripted.ts` ou `heroes.ts` e regravar os goldens. **Os identificadores não:** `woundedStranger`, `shelter`, `tend`, `edda` e `rolf` ficam gravados no estado das partidas e estão fixados em `packages/content/src/council.test.ts`; mudar um deles depois de publicado pede passo de migração.

Onde este documento e o código divergirem, vale o código.

## Índice

1. [O que a v0.3 acrescenta ao catálogo](#1-o-que-a-v03-acrescenta-ao-catálogo)
2. [Regras editoriais novas](#2-regras-editoriais-novas)
3. [Fichas das cartas](#3-fichas-das-cartas)
4. [Heróis com nome](#4-heróis-com-nome)
5. [A Taverna: candidatos, nomes e frases](#5-a-taverna-candidatos-nomes-e-frases)
6. [Expedições: o catálogo da v0.3](#6-expedições-o-catálogo-da-v03) (as fichas dos dezoito grafos)
7. [Desfechos: os itens e as frases](#7-desfechos-os-itens-e-as-frases)
8. [O que ficou para o lote 2](#8-o-que-ficou-para-o-lote-2)

## 1. O que a v0.3 acrescenta ao catálogo

| # | Carta | Tipo | Quando sai | No jogo | Curadoria |
|---:|---|---|---|---|---|
| 22 | Estrangeira ferida | Roteirizada | No começo do 13º dia de jogo, uma vez por partida; a partida que já passou dele, na primeira audiência com lugar | sim (V3C-T3) | rascunho, não lido pelo autor |

O catálogo tem 22 cartas: as 21 do primeiro lote e esta. Ela fica no fim da lista de `cards/index.ts`: não tem peso, nunca entra no sorteio por peso, e a posição dela não muda a chance de nenhuma outra. O que ela muda é a audiência em que chega: vai na frente das sorteadas, e naquela audiência o gerador não anda.

Estágios da curadoria (roadmap da v0.2, §12.3): rascunho → cenário validado → aprovado → implementado → observado no playtest. Esta carta está em "implementado", com o cenário validado por teste (`packages/engine/src/stranger.test.ts`), **sem ter passado por "aprovado"**.

## 2. Regras editoriais novas

Cada uma tem um teste em `packages/content/src/council.test.ts`.

- **O que nenhuma carta diz.** A regra da v0.2 ("nenhuma frase fala de herói, mapa, Mercado, ferro, exército ou combate") deu lugar a três, mais estreitas: (1) nenhuma carta fala de ferro, exército, combate, presságio, relíquia nem de edifício de versão futura; (2) nenhuma fala do que a v0.3 ainda não entregou (Mercado, mapa, expedição, Guilda, Taverna), e isso afrouxa de novo em V3F-T1; (3) **só a carta que entrega um herói** fala de herói, de classe ou de arma.
- **Herói de carta é recompensa, nunca compra.** A opção com `addHero` não tem custo nem requisito, não esconde o herói em efeito escondido e dá um herói só. O schema recusa o contrário.
- **Todo `addHero` aponta para um herói com nome que existe** (`namedHeroes`), e só uma carta roteirizada dá herói: ela sai uma vez por partida, então cada herói com nome chega no máximo uma vez.
- **Quem chega depois chega logo:** o prazo de um herói prometido não passa do intervalo entre duas audiências.
- **A roteirizada segue a ordem das outras cartas:** primeiro a opção que o conselho aplica sozinho em Senhor, por último a de Rei de Ferro. Como nenhuma das duas custa, a comparação "nenhuma opção sem custo é melhor em tudo" passou a contar o herói: quem chega agora vale mais do que quem chega depois.

## 3. Fichas das cartas

### 3.1 Roteirizada

#### Estrangeira ferida (`woundedStranger`, v1)

- **Dilema:** Uma guerreira leal agora, ou ouro e um arqueiro amanhã.
- **Quando sai:** roteirizada (`scripted: { atGameDay: 13 }`), sem peso, sem requisito de estação, edifício, flag ou moral. No começo do 13º dia de jogo: 24 h reais no ritmo Normal, 8 h no Rápido, 48 h no Tranquilo; antes dos lobos do roteiro (16º dia).
- **Repetição e virada do ano:** uma vez por partida. Não volta no ano 2 nem depois.
- **Lugar na mesa:** pede lugar e não o reserva. Com duas cartas pendentes, ou com uma continuação vencida ocupando o lugar que sobrava, espera a audiência seguinte, sem se perder.
- **Partidas que já existiam:** recebem a carta na primeira audiência com lugar depois da atualização, em qualquer ano, uma vez (ADR 0017, decisão 6: "Sim, a todos").
- **Texto:** Os vigias acharam uma mulher caída à beira da estrada, de espada na mão e com um talho fundo no flanco. Diz chamar-se Edda e não pede esmola: pede um teto até a ferida fechar. A quem lhe der abrigo, oferece o braço e a palavra.

| Opção | Custo e requisito | Consequência conhecida | Efeito oculto | Pista |
|---|---|---|---|---|
| **Acolher a estrangeira** (`shelter`) | sem custo | Edda, Guerreira (Leal), entra para o feudo agora; passa a cobrar soldo | — | Uma espada leal fica no feudo, e toda espada cobra soldo. |
| **Cuidar e deixar partir** (`tend`) | sem custo | +40 ouro; +5 de moral por 1 dia de jogo; Rolf, Arqueiro (Prudente), chega 1 dia de jogo depois e passa a cobrar soldo | — | Ela paga o cuidado em moedas, e diz que o irmão virá agradecer. |

Na tela, a consequência sai em uma frase com o tempo real do ritmo e o soldo por hora real. No ritmo Rápido: "Edda, Guerreira (Leal), entra para o feudo agora, com soldo de 6 ouro/h" e "+40 ouro; +5 de moral por 1 dia de jogo (40 min); Rolf, Arqueiro (Prudente), chega em 1 dia de jogo (40 min), com soldo de 6 ouro/h".

- **Requisitos de equipe:** nenhum. Nenhuma opção pede traço, classe ou edifício.
- **Efeitos da v0.3:**
  - `shelter`: `addHero { heroId: 'edda' }`. Entra no instante da resposta (ou do prazo).
  - `tend`: `resources { gold: 40 }`, `morale { amount: 5, durationDays: 1 }`, `addHero { heroId: 'rolf', afterDays: 1 }`. O ouro entra na hora; a moral vale na virada de dia seguinte; Rolf chega um dia de jogo depois da escolha, contado do instante dela (quem responde no meio do dia o recebe no meio do dia seguinte). A promessa não é segredo: a tela diz quem vem e em quanto tempo.
  - Nenhum sorteio. Nenhuma flag, nenhuma continuação.
- **Se ninguém responde (`autoResolve`):** Camponês: Acolher a estrangeira · Senhor: Acolher a estrangeira · Rei de Ferro: Cuidar e deixar partir. O prazo é o de toda carta, 24 h reais. **A expiração também entrega um herói**: ninguém fica sem equipe por estar fora.
- **Limite de heróis:** o limite de contratação não barra a carta. Com a lista no teto técnico (12), o herói espera à porta e entra quando um lugar abrir; não se perde.
- **Se o herói partir, for capturado ou morrer no meio da cadeia:** não se aplica; a carta não abre cadeia.
- **Crônica:**
  - Chegada: a frase geral ("o conselho de {feudo} pediu audiência: {carta}").
  - Acolher a estrangeira: No {dia}º dia {daEstacao}, o senhor de {feudo} deu teto à estrangeira ferida. Edda jurou a espada ao feudo que a acolheu.
    - Ao expirar: No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} deu teto à estrangeira ferida. Edda jurou a espada ao feudo que a acolheu.
    - Chegada da heroína (a frase geral de `heroJoined`): No {dia}º dia {daEstacao}, {heroi}, {classe}, passou a servir a {feudo}.
  - Cuidar e deixar partir: No {dia}º dia {daEstacao}, o senhor de {feudo} mandou tratar a estrangeira e a deixou seguir viagem. Edda pagou em moedas e prometeu mandar ao feudo o irmão, arqueiro de mão firme.
    - Ao expirar: No {dia}º dia {daEstacao}, sem palavra do senhor, as mulheres de {feudo} trataram a estrangeira, e ela seguiu viagem. Edda pagou em moedas e prometeu mandar ao feudo o irmão, arqueiro de mão firme.
    - Chegada do arqueiro (a frase dele, em `namedHeroes.rolf.arrival`): No {dia}º dia {daEstacao}, um arqueiro bateu ao portão de {feudo}: {heroi}, irmão de Edda, vindo pagar a dívida dela. Passou a servir ao senhor.
- **Cenários:**
  - Acolher a estrangeira. *Faz sentido:* o feudo quer o herói já, antes dos lobos do roteiro, e quem joga uma vez por dia prefere quem nunca parte por soldo: Edda é Leal. *É ruim:* o cofre está no fim e ninguém trabalha na Mina; o soldo começa na hora, e 40 de ouro pagariam 20 horas de jogo dele.
  - Cuidar e deixar partir. *Faz sentido:* falta ouro para uma obra agora, e um dia de jogo de espera não custa nada; ou o jogador prefere o Arqueiro (mais ataque, velocidade e perícia). *É ruim:* o feudo atrasa soldo com frequência: Rolf não é Leal, fica Descontente com 12 h reais de atraso e parte com 24 h.
  - **Não usar o herói é a escolha razoável?** Não há opção sem herói: as duas dão um, de propósito (ADR 0017, decisão 6). Quem não quer pagar soldo dispensa o herói depois, pela ordem de dispensa.
- **O que o agente decidiu ao escrever, e o autor pode trocar:**
  - Os rótulos das opções ("Acolher a estrangeira"; o ADR diz "Acolher") e todo o texto.
  - Rolf é o irmão de Edda, como no Apêndice B do GDD; a Crônica diz isso quando ele chega.
  - Na expiração em Rei de Ferro quem trata dela são "as mulheres de {feudo}", para a frase não repetir "o conselho".
  - A consequência na tela mostra o soldo do herói, por hora real: é o custo que a opção sem custo tem.

## 4. Heróis com nome

Estão em `namedHeroes` (`packages/content/src/heroes.ts`), com os identificadores em `NAMED_HERO_IDS`. Não são modelos da Taverna: só uma carta os entrega.

| Id | Nome | Tratamento | Classe | Nível | Traços | Quem entrega | Frase própria de chegada |
|---|---|---|---|---:|---|---|---|
| `edda` | Edda | feminino | Guerreira | 1 | Leal | "Estrangeira ferida", `shelter` | não (a geral) |
| `rolf` | Rolf | masculino | Arqueiro | 1 | Prudente | "Estrangeira ferida", `tend`, 1 dia de jogo depois | sim |

**A forma de tratamento (pendência C-1, decidida pelo agente).** O herói guarda `gender` (`'f'` ou `'m'`), e cada classe e cada traço têm duas formas no conteúdo, `label` e `labelFeminine`:

| Classe | `label` | `labelFeminine` |
|---|---|---|
| `warrior` | Guerreiro | Guerreira |
| `archer` | Arqueiro | Arqueira |
| `mage` | Mago | Maga |
| `cleric` | Clérigo | Clériga |

| Traço | `label` | `labelFeminine` |
|---|---|---|
| `brave` | Corajoso | Corajosa |
| `prudent` | Prudente | Prudente |
| `greedy` | Ganancioso | Gananciosa |
| `charismatic` | Carismático | Carismática |
| `devout` | Devoto | Devota |
| `veteran` | Veterano | Veterana |
| `loyal` | Leal | Leal |
| `tracker` | Rastreador | Rastreadora |

A frase de cada traço vale para as duas formas: um teste recusa "ele", "ela", "dele" e "dela" nela. Por isso a do Devoto mudou de "A fé dele levanta o ânimo do feudo." para "Tem fé, e a fé levanta o ânimo do feudo.".

## 5. A Taverna: candidatos, nomes e frases

**Rascunho, não lido pelo autor** (V3C-T2; pendência C-30). Os números são os do ADR 0017 ("Modelos de candidato da Taverna"), copiados; os nomes e as frases são do agente.

**Os modelos de candidato** (`tavernCandidates`, em `packages/content/src/heroes.ts`; ids em `TAVERN_CANDIDATE_IDS`, **na ordem do sorteio**). O id fica gravado no estado (`guild.tavernOffers[].templateId`): mudar um pede passo de migração, e mexer na ordem muda quem toda Taverna oferece.

| # | `id` | Classe | Traços | Nível | Peso | Preço (ouro) |
|---:|---|---|---|---:|---:|---:|
| 1 | `braveWarrior` | Guerreiro | Corajoso | 1 | 5 | 110 |
| 2 | `steadyWarrior` | Guerreiro | Prudente | 1 | 4 | 120 |
| 3 | `veteranWarrior` | Guerreiro | Veterano, Leal | 2 | 1 | 300 |
| 4 | `trackerArcher` | Arqueiro | Rastreador | 1 | 5 | 100 |
| 5 | `greedyArcher` | Arqueiro | Ganancioso | 1 | 4 | 80 |
| 6 | `veteranArcher` | Arqueiro | Veterano, Prudente | 2 | 2 | 220 |
| 7 | `greedyMage` | Mago | Ganancioso | 1 | 3 | 140 |
| 8 | `learnedMage` | Mago | Prudente, Carismático | 1 | 2 | 200 |
| 9 | `devoutCleric` | Clérigo | Devoto | 1 | 4 | 130 |
| 10 | `charismaticCleric` | Clérigo | Carismático | 1 | 3 | 160 |

O teste de conteúdo confere a tabela contra o ADR, a soma dos pesos (33), a faixa de preço (80 a 300), o nível do Veterano (2) e que o desconto do Carismático dá preço inteiro em todo modelo.

**Os nomes** (`heroNames`, **na ordem do sorteio**): 24, medievais portugueses, doze de cada forma de tratamento, alternados. A classe e os traços concordam com o nome ("Elvira — Clériga, Devota"). Nenhum é o de um herói de carta, e a lista é maior que o teto de heróis (12), de prometidos (4) e de candidatos (3) somados, para sempre sobrar um nome que ninguém usa.

| Feminino | Masculino |
|---|---|
| Aldara, Brites, Elvira, Guiomar, Leonor, Mafalda, Mécia, Sancha, Teresa, Urraca, Violante, Aldonça | Afonso, Bernardo, Diogo, Egas, Fernão, Gonçalo, Lopo, Martim, Nuno, Rui, Soeiro, Vasco |

**As frases da Crônica** (`chronicleTemplates`):

| Evento | Frase |
|---|---|
| `heroHired` | No {dia}º dia {daEstacao}, {heroi}, {classe}, aceitou na Taverna o soldo de {feudo}. O senhor pagou {preco} de ouro pelo trato. |
| `festivalHeld` | No {dia}º dia {daEstacao}, o senhor de {feudo} mandou abrir os barris da Taverna: houve festival, e o povo cantou até tarde. |
| `festivalEnded` | No {dia}º dia {daEstacao}, os barris secaram em {feudo}: o festival ficou para trás, e o povo voltou ao trabalho. |

`{preco}` é marcador novo: o ouro pago, já com o desconto. A troca dos candidatos não tem linha na Crônica.

**As frases da tela e das recusas** (montadas no motor, com os números do conteúdo):

| Onde | Frase |
|---|---|
| A Taverna, sem o Salão no nível 3 | A Taverna abre com o Salão do Senhor Nv3: nela o feudo contrata heróis e dá festivais. |
| A Taverna, com o Salão no nível 3 | Erga a Taverna: nela o feudo contrata heróis e dá festivais. |
| A Taverna erguida | Taverna Nv1: abriga 2 heróis, traz 2 candidatos a cada troca e soma 5 à moral. |
| A obra, na lista | Abriga 3 heróis, traz 2 candidatos a cada troca e soma 10 à moral. |
| O preço com desconto | 88 de ouro: 110, menos 20% por Mécia, Carismática |
| O festival | +15 de moral por 8 h, a partir da próxima virada do dia. Um festival por estação. |
| O termo da moral | Taverna Nv2 · Fé de Elvira · Festival na Taverna |
| `TAVERN_REQUIRED` | Erga a Taverna primeiro: ela abre com o Salão do Senhor Nv3. |
| `OFFER_GONE` | Esse candidato já não está na Taverna: a lista trocou, ou ele já foi contratado. |
| `HERO_LIMIT` | A Taverna Nv1 abriga 2 heróis, e o feudo já os tem: melhore a Taverna ou dispense um herói. |
| `FESTIVAL_ALREADY_HELD` | Um festival por estação: na Primavera o feudo já festejou. |

Os efeitos de traço que a Taverna trouxe: o Carismático multiplica o preço dos candidatos por 4/5, uma vez (`effects.tavernPrice`), e o Devoto soma 5 de moral enquanto está no feudo (`effects.morale`). As frases dos dois traços não mudaram.

## 6. Expedições: o catálogo da v0.3

**Rascunho, não lido pelo autor** (V3D-T3; pendência A-7). São os seis modelos do [ADR 0018](decisions/0018-expedicoes-mercado-mestres-e-cartas-na-v0.3.md), decisão 12, com três variantes cada: **dezoito grafos**, escritos pelo agente e postos no jogo sem aprovação grafo a grafo, pelo modo "escrevo e sigo; você revisa depois". O passo "aprovado" da ficha fica pendente, um por grafo. Os arquivos são `packages/content/src/missions/*.ts` (um por modelo); a lista, `expeditionModels`, em `expeditions.ts`. As tabelas de números desta seção saem de `packages/engine/src/__golden__/expedition-calibration.md`, que um teste mantém em dia com o conteúdo: **onde este documento e o golden divergirem, vale o golden**.

### 6.1 O que vale para todo grafo

- **Forma** (`expeditionModelsSchema`): acíclico; todo caminho termina em um nó de retorno; de 2 a 5 nós por caminho, contando o retorno e sem a encruzilhada; cada nó de 5 a 60 minutos de jogo (era 45: o Pântano tem cinco nós em cinco horas; pendência D-31); três variantes por modelo; a duração anunciada é a do caminho mais longo.
- **Prova.** Um nó tem uma frase (sem prova) ou uma prova, nunca os dois. A prova tem a dificuldade, a experiência, os pesos de atributo que o nó troca ou acrescenta ("perícia ×1,5"), **a classe que o nó favorece** (a de maior poder contra esses pesos; um teste confere, e recusa empate), o que o Desastre faz (fere gravemente ou captura) e cinco frases: uma por desfecho e a lição.
- **Recompensas por desfecho** (`balance.expeditions.lootShare` e `xpShare`): os recursos do nó vêm por inteiro no Sucesso, com um quarto a mais no Sucesso Pleno, pela metade no Revés e **nada** no Desastre. O item, o destino revelado, o Covil limpo e o cativo solto **só vêm do Sucesso em diante** (com um Rastreador na equipe, a revelação vem também no Revés). A experiência do nó vem por inteiro no Sucesso, com um quarto a mais no Pleno, pela metade no Revés e um quarto no Desastre. Nada aqui é de versão futura: recursos, itens das quatro raridades, destinos, o tile do Covil e o cativo.
- **Encruzilhada.** Uma em cada variante de três nós ou mais (a Patrulha não tem), com duas ou três opções, **da mais ambiciosa à mais segura**, cada uma com verbo no infinitivo e uma pista de risco e recompensa, sem número. Parte delas pede uma classe ou um traço. As três Posturas marcam opções diferentes, e a da Cautelosa nunca tem requisito: é a que vale quando a marcada está fora do alcance da equipe.
- **Frases** (GDD §9.4 e §18.3). Toda frase de desfecho diz quem se destacou, em `{heroi}`. Foram escritas **para qualquer herói ou heroína** (nada de "sozinho" ou "ferido" depois do nome) e **sem afirmar o dano**: quem sofre o desfecho é sorteado e ganha a linha própria, e em Camponês a captura vira ferimento. A lição é a frase que o Revés e o Desastre ganham **quando a equipe não tinha a classe que o nó favorece**; as outras três lições são gerais (`expeditionTexts.lessonPosture`, `lessonItem`, `lessonStrength`).
- **Identificadores estáveis.** O id do modelo, a posição da variante, a chave de cada nó e a de cada opção ficam gravados no estado de quem tem uma expedição em curso ou um relatório guardado. `expeditions.test.ts` fixa a lista inteira (`STABLE_IDS`): acrescentar é livre; **trocar ou tirar um pede passo de migração**. Texto, dificuldade, peso e recompensa são conteúdo, e trocar qualquer um deles é editar o arquivo e regravar os goldens.

### 6.2 O catálogo e as equipes de referência

| Modelo | `id` | Duração | Nós | Equipe | Risco | Rende | Como aparece |
|---|---|---:|---:|---|---|---|---|
| Patrulha dos Arredores | `patrol` | 15 min | 2 | 1 herói | Baixo | ouro, experiência; revela as Ruínas | Guilda Nv1 |
| Floresta Antiga | `oldForest` | 1 h | 3 | 1 a 2 heróis | Baixo a médio | madeira, ouro, item comum | Guilda Nv1 |
| Covil dos Lobos | `wolfDen` | 2 h | 3 | 2 heróis | Médio | limpa o Covil (Ameaça −30), ouro, item comum ou incomum | conhecido desde sempre; fecha com o Covil limpo |
| Resgate | `rescue` | 2 h | 3 (duas provas e a volta) | 2 heróis | Alto | solta o cativo; ouro e item incomum pelos caminhos mais duros | enquanto houver um herói em cativeiro |
| Ruínas de Vel'Thar | `ruins` | 3 h | 4 | 2 a 3 heróis, nível 2 ou mais | Médio | pedra, ouro, item raro; revela o Pântano | revelada por uma Patrulha (ou por carta, V3F) |
| Pântano Nebuloso | `swamp` | 5 h | 5 | 3 heróis, com um Mago | Alto | ouro, item raro e, vencido o chefe, item épico | revelado pelas Ruínas; Guilda Nv3 |

"Nós" conta o que a equipe atravessa no caminho mais longo, com o retorno e sem a encruzilhada. **O que o rótulo de risco quer dizer**, e o teste confere (`expeditions.calibration.test.ts`): *Baixo*, a equipe mínima passa em nove de cada dez e ninguém chega ao Desastre; *Baixo a médio*, a mínima passa de seis a nove e meio em dez pelo caminho do meio, sem Desastre; *Médio*, a mínima sofre Revés ou pior em três de cada dez ou mais, e o Desastre é possível para quem vai fraco ou ousa; *Alto*, a mínima passa em metade das vezes ou menos, e a captura acontece. "Passar" é não ter nenhuma prova abaixo do Sucesso.

**As equipes de referência** (sem traço e sem item): a **mínima** é o menor número de heróis, no menor nível que o modelo aceita, com as classes que ele exige e o resto na ordem Guerreiro, Arqueiro, Mago, Clérigo (é a do ADR 0017: "um Guerreiro de nível 1 sozinho"); a **fraca** é a mínima com Clérigos (a classe mais fraca na conta geral do poder) no lugar das classes que o modelo não exige; a **com folga** é o maior número de heróis, dois níveis acima. Nas tabelas, **P/S/R/D** são as sortes, de 31, que dão Sucesso Pleno, Sucesso, Revés e Desastre naquele nó.

"Razoável para" e "ruim para", em cada opção, vêm de um painel de equipes (todas as composições de um a três heróis que o modelo aceita, em quatro níveis, e com o traço quando uma opção o pede): é a equipe para a qual aquela opção rende mais do que as outras, com a maior vantagem, e a equipe para a qual ela é a pior das que pode tomar (ou a que nem pode). A régua do teste soma o que o caminho rende em média e desconta o dano; **não é regra do jogo**. O teste exige que nenhuma opção seja a melhor para todo o painel e que o caminho da Cautelosa seja a escolha de alguma equipe (aquela para a qual todo outro caminho dá Revés ou pior em metade das vezes).

### 6.3 Patrulha dos Arredores (`patrol`)

**Requisitos:** 1 herói; Guilda dos Aventureiros Nv1. **Descoberta:** aparece com a Guilda no nível pedido. **Risco:** Baixo. **Duração anunciada:** 15 min de jogo, sem a espera da encruzilhada. **Curadoria:** rascunho, não lido pelo autor.

#### Patrulha dos Arredores · variante A

```
fences  encontro 10 min  "A ronda pelas cercas"  dificuldade 36
home  retorno 5 min  "A volta ao portão"
```

| Nó | Tipo | Dif. | Pesa | Favorece | No Desastre | XP | Rende (no Sucesso) | Fraca | Mínima | Com folga |
|---|---|---:|---|---|---|---:|---|---|---|---|
| A ronda pelas cercas | encontro | 36 | o padrão | Guerreiro | fere gravemente | 12 | 15 a 25 de ouro; revela Ruínas de Vel'Thar | 0/3/28/0 | 4/26/1/0 | 19/12/0/0 |

Frases do relatório (sem a data, que abre todas: "No Nº dia da estação,"):

| Nó | Sucesso pleno | Sucesso | Revés | Desastre | Lição (quando falta a classe) |
|---|---|---|---|---|---|
| A ronda pelas cercas | {heroi} deu a volta nas cercas de {feudo} e pôs dois ladrões de galinha para correr. A bolsa deles ficou no chão. | {heroi} deu a volta nas cercas de {feudo} e recolheu o que os ladrões deixaram cair na fuga. | {heroi} chegou tarde às cercas de {feudo}: os ladrões já iam longe, e só ficou parte do que levavam. | {heroi} caiu na emboscada dos ladrões junto às cercas de {feudo} e voltou sem nada. | Um Guerreiro teria feito os ladrões largarem a bolsa só de chegar perto. |
| A volta ao portão | a patrulha de {feudo} tomou o caminho de casa. | | | | |

#### Patrulha dos Arredores · variante B

```
ford  perigo 10 min  "O vau do riacho"  dificuldade 40
home  retorno 5 min  "A volta ao portão"
```

| Nó | Tipo | Dif. | Pesa | Favorece | No Desastre | XP | Rende (no Sucesso) | Fraca | Mínima | Com folga |
|---|---|---:|---|---|---|---:|---|---|---|---|
| O vau do riacho | perigo | 40 | perícia ×1 | Arqueiro | fere gravemente | 12 | 12 a 22 de ouro; revela Ruínas de Vel'Thar | 0/16/15/0 | 7/24/0/0 | 22/9/0/0 |

Frases do relatório (sem a data, que abre todas: "No Nº dia da estação,"):

| Nó | Sucesso pleno | Sucesso | Revés | Desastre | Lição (quando falta a classe) |
|---|---|---|---|---|---|
| O vau do riacho | {heroi} atravessou o vau de pé enxuto e achou, na outra margem, a carga de um mascate que a enchente levou. | {heroi} atravessou o vau e recolheu o que a enchente tinha deixado na margem. | {heroi} escorregou no vau, e o riacho levou metade do que já estava recolhido. | a correnteza derrubou {heroi} no meio do vau, e o riacho ficou com tudo. | Um Arqueiro teria lido a correnteza antes de pôr o pé na água. |
| A volta ao portão | a patrulha de {feudo} tomou o caminho de casa. | | | | |

#### Patrulha dos Arredores · variante C

```
oldRoad  encontro 10 min  "Rastros na estrada velha"  dificuldade 42
home  retorno 5 min  "A volta ao portão"
```

| Nó | Tipo | Dif. | Pesa | Favorece | No Desastre | XP | Rende (no Sucesso) | Fraca | Mínima | Com folga |
|---|---|---:|---|---|---|---:|---|---|---|---|
| Rastros na estrada velha | encontro | 42 | vontade ×1 | Mago | fere gravemente | 12 | 18 a 28 de ouro; revela Ruínas de Vel'Thar | 2/26/3/0 | 6/25/0/0 | 21/10/0/0 |

Frases do relatório (sem a data, que abre todas: "No Nº dia da estação,"):

| Nó | Sucesso pleno | Sucesso | Revés | Desastre | Lição (quando falta a classe) |
|---|---|---|---|---|---|
| Rastros na estrada velha | {heroi} seguiu os rastros da estrada velha, sem se deixar enganar, até um acampamento vazio. O cofre ainda estava lá. | {heroi} seguiu os rastros da estrada velha e voltou com o que os salteadores esqueceram. | {heroi} perdeu os rastros da estrada velha ao cair da tarde e trouxe pouco. | os rastros da estrada velha levaram {heroi} direto a quem os tinha deixado. Não sobrou nada para trazer. | Um Mago não teria perdido o rastro quando a luz baixou e o medo subiu. |
| A volta ao portão | a patrulha de {feudo} tomou o caminho de casa. | | | | |

### 6.4 Floresta Antiga (`oldForest`)

**Requisitos:** 1 a 2 heróis; Guilda dos Aventureiros Nv1. **Descoberta:** aparece com a Guilda no nível pedido. **Risco:** Baixo a médio. **Duração anunciada:** 60 min de jogo, sem a espera da encruzilhada. **Curadoria:** rascunho, não lido pelo autor.

#### Floresta Antiga · variante A

```
trail  viagem 15 min  "A trilha sob os carvalhos"  sem prova
fork  encruzilhada  "A trilha se divide"   Cautelosa → turnBack · Equilibrada → stream · Ousada → thicket
  thicket) "Abrir caminho pela mata fechada"  [requer um Guerreiro]
      deepWoods  encontro 25 min  "O javali da mata fechada"  dificuldade 55
      home  retorno 20 min  "A volta pela trilha"
  stream) "Seguir o riacho"
      glade  perigo 25 min  "As pedras do riacho"  dificuldade 46
      → home (acima)
  turnBack) "Voltar com o que já têm"
      → home (acima)
```

| Nó | Tipo | Dif. | Pesa | Favorece | No Desastre | XP | Rende (no Sucesso) | Fraca | Mínima | Com folga |
|---|---|---:|---|---|---|---:|---|---|---|---|
| A trilha sob os carvalhos | viagem | — | — | — | — | — | 10 a 20 de madeira | — | — | — |
| O javali da mata fechada | encontro | 55 | o padrão | Guerreiro | fere gravemente | 22 | 60 a 90 de madeira; 20 a 30 de ouro; item (1 em 3): Lança de caça, Gibão acolchoado, Amuleto de osso | 0/0/0/31 | 0/0/24/7 | 31/0/0/0 |
| As pedras do riacho | perigo | 46 | perícia ×1 | Arqueiro | fere gravemente | 22 | 40 a 60 de madeira | 0/1/30/0 | 0/20/11/0 | 31/0/0/0 |

**Encruzilhada "A trilha se divide".** A trilha se parte em duas diante de um carvalho tombado. À esquerda, a mata fecha; à direita, ouve-se água.

| Opção | Postura | Requisito | Pista | Razoável para | Ruim para |
|---|---|---|---|---|---|
| Abrir caminho pela mata fechada | Ousada | um Guerreiro | A melhor madeira do bosque, e pegadas grandes na lama; é serviço para mais de um, com quem abra o caminho no braço. | Guerreiro + Arqueiro Nv2 (passa em 100%) | Guerreiro Nv1 (passa em 0%) |
| Seguir o riacho | Equilibrada | — | Chão escorregadio e lenha boa na outra margem; quem tem perícia passa melhor. | Arqueiro + Arqueiro Nv1 (passa em 100%) | Guerreiro + Arqueiro Nv2 (passa em 100%) |
| Voltar com o que já têm | Cautelosa | — | Sem risco; o saque fica pequeno. | Clérigo Nv1 (passa em 100%) | Guerreiro + Arqueiro Nv2 (passa em 100%) |

Frases do relatório (sem a data, que abre todas: "No Nº dia da estação,"):

| Nó | Sucesso pleno | Sucesso | Revés | Desastre | Lição (quando falta a classe) |
|---|---|---|---|---|---|
| A trilha sob os carvalhos | a expedição de {feudo} entrou na Floresta Antiga e juntou a lenha caída pelo caminho. | | | | |
| O javali da mata fechada | {heroi} abateu o javali da mata fechada, e a expedição de {feudo} cortou a melhor madeira do bosque. | {heroi} espantou o javali da mata fechada, e a expedição de {feudo} trabalhou em paz. | o javali da mata fechada passou por {heroi} e dispersou a expedição de {feudo}: metade da madeira ficou para trás. | o javali da mata fechada derrubou {heroi} e pôs a expedição de {feudo} para correr, sem uma tora sequer. | Um Guerreiro teria aguentado a carga do javali de frente. |
| As pedras do riacho | {heroi} passou as pedras do riacho sem um escorregão e achou do outro lado uma clareira de troncos secos. | {heroi} passou as pedras do riacho, e a expedição de {feudo} encheu os ombros de lenha. | {heroi} escorregou nas pedras do riacho, e metade da carga foi para a água. | as pedras do riacho derrubaram {heroi}, e a carga inteira desceu com a correnteza. | Um Arqueiro teria escolhido as pedras secas. |
| A volta pela trilha | a expedição de {feudo} deixou a Floresta Antiga. | | | | |

#### Floresta Antiga · variante B

```
trail  viagem 15 min  "A trilha sob os carvalhos"  sem prova
fork  encruzilhada  "A trilha se divide"   Cautelosa → turnBack · Equilibrada → stream · Ousada → thicket
  thicket) "Abrir caminho pela mata fechada"  [requer um Guerreiro]
      deepWoods  encontro 25 min  "Os lenhadores sem senhor"  dificuldade 58
      home  retorno 20 min  "A volta pela trilha"
  stream) "Seguir o riacho"
      glade  descoberta 25 min  "A cabana do carvoeiro"  sem prova
      → home (acima)
  turnBack) "Voltar com o que já têm"
      → home (acima)
```

| Nó | Tipo | Dif. | Pesa | Favorece | No Desastre | XP | Rende (no Sucesso) | Fraca | Mínima | Com folga |
|---|---|---:|---|---|---|---:|---|---|---|---|
| A trilha sob os carvalhos | viagem | — | — | — | — | — | 10 a 20 de madeira | — | — | — |
| Os lenhadores sem senhor | encontro | 58 | o padrão | Guerreiro | fere gravemente | 22 | 70 a 100 de madeira; 10 a 20 de ouro | 0/0/0/31 | 0/0/19/12 | 31/0/0/0 |
| A cabana do carvoeiro | descoberta | — | — | — | — | — | 30 a 50 de madeira | — | — | — |

**Encruzilhada "A trilha se divide".** A trilha se parte em duas diante de um carvalho tombado. À esquerda, a mata fecha; à direita, ouve-se água.

| Opção | Postura | Requisito | Pista | Razoável para | Ruim para |
|---|---|---|---|---|---|
| Abrir caminho pela mata fechada | Ousada | um Guerreiro | A melhor madeira do bosque, e pegadas grandes na lama; é serviço para mais de um, com quem abra o caminho no braço. | Guerreiro + Arqueiro Nv3 (passa em 100%) | Guerreiro Nv1 (passa em 0%) |
| Seguir o riacho | Equilibrada | — | Chão escorregadio e lenha boa na outra margem; quem tem perícia passa melhor. | Guerreiro Nv1 (passa em 100%) | Guerreiro + Arqueiro Nv3 (passa em 100%) |
| Voltar com o que já têm | Cautelosa | — | Sem risco; o saque fica pequeno. | — | Guerreiro + Arqueiro Nv3 (passa em 100%) |

Frases do relatório (sem a data, que abre todas: "No Nº dia da estação,"):

| Nó | Sucesso pleno | Sucesso | Revés | Desastre | Lição (quando falta a classe) |
|---|---|---|---|---|---|
| A trilha sob os carvalhos | a expedição de {feudo} entrou na Floresta Antiga e juntou a lenha caída pelo caminho. | | | | |
| Os lenhadores sem senhor | {heroi} encarou os lenhadores sem senhor da mata fechada, e eles largaram os machados e a pilha de toras. | {heroi} dividiu a mata fechada com os lenhadores sem senhor, à força de cara feia. | os lenhadores sem senhor não se assustaram com {heroi}: ficaram com a melhor parte, e a expedição de {feudo}, com as sobras. | os lenhadores sem senhor cercaram {heroi} e tomaram da expedição de {feudo} até o que ela já trazia. | Um Guerreiro teria feito os lenhadores pensarem duas vezes. |
| A cabana do carvoeiro | a expedição de {feudo} achou à beira do riacho a cabana vazia de um carvoeiro, com a lenha empilhada. | | | | |
| A volta pela trilha | a expedição de {feudo} deixou a Floresta Antiga. | | | | |

#### Floresta Antiga · variante C

```
edge  viagem 15 min  "A orla da floresta"  sem prova
hollow  encruzilhada  "O tronco oco"   Cautelosa → leave · Equilibrada → ravine · Ousada → climb
  climb) "Subir ao ninho"  [requer um Arqueiro]
      nest  perigo 25 min  "O ninho no alto"  dificuldade 50
      home  retorno 20 min  "A volta pela trilha"
  ravine) "Descer o barranco"
      ravineFloor  encontro 25 min  "O fundo do barranco"  dificuldade 40
      → home (acima)
  leave) "Dar meia-volta"
      → home (acima)
```

| Nó | Tipo | Dif. | Pesa | Favorece | No Desastre | XP | Rende (no Sucesso) | Fraca | Mínima | Com folga |
|---|---|---:|---|---|---|---:|---|---|---|---|
| A orla da floresta | viagem | — | — | — | — | — | — | — | — | — |
| O ninho no alto | perigo | 50 | perícia ×1,5 | Arqueiro | fere gravemente | 22 | 30 a 50 de ouro; item (1 em 2): Lança de caça, Gibão acolchoado, Amuleto de osso | 0/2/29/0 | 0/17/14/0 | 31/0/0/0 |
| O fundo do barranco | encontro | 40 | o padrão | Guerreiro | fere gravemente | 22 | 50 a 70 de madeira | 0/0/28/3 | 0/20/11/0 | 31/0/0/0 |

**Encruzilhada "O tronco oco".** Um tronco oco, da altura de um homem, guarda a entrada de um barranco. Há marcas de garra na casca e um ninho no alto.

| Opção | Postura | Requisito | Pista | Razoável para | Ruim para |
|---|---|---|---|---|---|
| Subir ao ninho | Ousada | um Arqueiro | Algo brilha lá em cima; é preciso olho e mão firme de arqueiro. | Arqueiro Nv1 (passa em 90%) | Guerreiro + Arqueiro Nv1 (passa em 100%) |
| Descer o barranco | Equilibrada | — | Troncos caídos lá embaixo, e quem os derrubou talvez ainda esteja por perto. | Guerreiro + Guerreiro Nv1 (passa em 100%) | Arqueiro Nv1 (passa em 13%) |
| Dar meia-volta | Cautelosa | — | Sem risco; voltam de mãos vazias. | Clérigo Nv1 (passa em 100%) | Guerreiro + Arqueiro Nv1 (passa em 100%) |

Frases do relatório (sem a data, que abre todas: "No Nº dia da estação,"):

| Nó | Sucesso pleno | Sucesso | Revés | Desastre | Lição (quando falta a classe) |
|---|---|---|---|---|---|
| A orla da floresta | a expedição de {feudo} contornou a orla da Floresta Antiga até achar por onde entrar. | | | | |
| O ninho no alto | {heroi} subiu ao ninho do tronco oco e desceu com tudo o que a gralha tinha juntado em anos. | {heroi} alcançou o ninho do tronco oco e trouxe as moedas da gralha. | um galho cedeu sob {heroi}, e metade do achado do ninho ficou no mato. | {heroi} despencou do tronco oco antes de tocar o ninho. | Um Arqueiro teria achado os galhos que aguentam o peso. |
| O fundo do barranco | {heroi} desceu na frente e achou o fundo do barranco vazio, com os troncos prontos para levar. | {heroi} afugentou o urso do barranco, e a expedição de {feudo} levou os troncos. | o urso do barranco avançou sobre {heroi} e só deixou a expedição de {feudo} sair com metade dos troncos. | o urso do barranco derrubou {heroi} e expulsou a expedição de {feudo}, que largou tudo na subida. | Um Guerreiro teria ficado entre o urso e a carga. |
| A volta pela trilha | a expedição de {feudo} deixou a Floresta Antiga. | | | | |

### 6.5 Covil dos Lobos (`wolfDen`)

**Requisitos:** 2 heróis; Guilda dos Aventureiros Nv1. **Descoberta:** conhecido desde sempre; fecha enquanto o Covil está limpo. **Risco:** Médio. **Duração anunciada:** 120 min de jogo, sem a espera da encruzilhada. **Curadoria:** rascunho, não lido pelo autor.

#### Covil dos Lobos · variante A

```
climb  perigo 40 min  "A subida pela pedreira solta"  dificuldade 84
mouth  encruzilhada  "A boca da toca"   Cautelosa → retreat · Equilibrada → smokeOut · Ousada → enterDen
  enterDen) "Entrar na toca atrás do lobo velho"
      oldWolf  chefe 45 min  "O lobo velho no fundo da toca"  dificuldade 90
      home  retorno 35 min  "A descida da serra"
  smokeOut) "Enfumaçar a toca e esperar na saída"
      smoke  encontro 45 min  "A matilha na fumaça"  dificuldade 86
      → home (acima)
  retreat) "Recuar com o que têm"
      → home (acima)
```

| Nó | Tipo | Dif. | Pesa | Favorece | No Desastre | XP | Rende (no Sucesso) | Fraca | Mínima | Com folga |
|---|---|---:|---|---|---|---:|---|---|---|---|
| A subida pela pedreira solta | perigo | 84 | perícia ×1 | Arqueiro | fere gravemente | 30 | 10 a 20 de ouro | 0/11/20/0 | 4/26/1/0 | 19/12/0/0 |
| O lobo velho no fundo da toca | chefe | 90 | o padrão | Guerreiro | fere gravemente | 45 | 50 a 80 de ouro; item (1 em 2): Lança de caça, Gibão acolchoado, Corno de batedor; **limpa o Covil** | 0/0/17/14 | 0/0/31/0 | 0/16/15/0 |
| A matilha na fumaça | encontro | 86 | perícia ×0,5 | Guerreiro | fere gravemente | 40 | 20 a 35 de ouro; **limpa o Covil** | 0/0/31/0 | 0/18/13/0 | 6/25/0/0 |

**Encruzilhada "A boca da toca".** A toca abre na pedra, escura e funda. Há ossos na entrada, e entre eles brilha o que a matilha arrastou das estradas.

| Opção | Postura | Requisito | Pista | Razoável para | Ruim para |
|---|---|---|---|---|---|
| Entrar na toca atrás do lobo velho | Ousada | — | O chefe da matilha está lá dentro, com tudo o que os lobos arrastaram; no escuro, ganha quem aguenta o tranco. | Guerreiro + Guerreiro Nv5 (passa em 100%) | Arqueiro + Arqueiro Nv2 (passa em 0%) |
| Enfumaçar a toca e esperar na saída | Equilibrada | — | A matilha sai aos poucos e cega de fumaça; pouco ouro, e o Covil fica limpo. | Arqueiro + Arqueiro Nv2 (passa em 74%) | Guerreiro + Guerreiro Nv5 (passa em 100%) |
| Recuar com o que têm | Cautelosa | — | Sem risco; os lobos ficam onde estão. | Clérigo + Clérigo Nv1 (passa em 100%) | Guerreiro + Guerreiro Nv5 (passa em 100%) |

Frases do relatório (sem a data, que abre todas: "No Nº dia da estação,"):

| Nó | Sucesso pleno | Sucesso | Revés | Desastre | Lição (quando falta a classe) |
|---|---|---|---|---|---|
| A subida pela pedreira solta | {heroi} achou o caminho firme na pedreira solta, e a expedição de {feudo} chegou à toca sem que um lobo desse o alarme. | {heroi} puxou a expedição de {feudo} pedreira acima, até a boca da toca. | a pedreira solta cedeu sob {heroi}: a expedição de {feudo} chegou à toca arranhada e com a matilha de pé. | a pedreira solta rolou com {heroi}, e a expedição de {feudo} chegou à toca sangrando. | Um Arqueiro teria visto de baixo qual pedra estava solta. |
| O lobo velho no fundo da toca | {heroi} matou o lobo velho no fundo da toca. A matilha fugiu serra acima, e a expedição de {feudo} recolheu o que havia entre os ossos. | {heroi} feriu o lobo velho, e a matilha deixou a toca para a expedição de {feudo}. | o lobo velho fez {heroi} recuar no escuro: a expedição de {feudo} saiu da toca com metade do achado e a matilha inteira. | o lobo velho derrubou {heroi} no fundo da toca, e a expedição de {feudo} saiu de lá sem nada. | Um Guerreiro teria fechado a passagem com o escudo. |
| A matilha na fumaça | {heroi} esperou na saída da toca enfumaçada, e nenhum lobo passou. O Covil ficou vazio. | {heroi} segurou a saída da toca enfumaçada, e a matilha se desfez serra acima. | o vento virou a fumaça contra {heroi}, e a matilha saiu da toca inteira e furiosa. | a matilha saiu da fumaça por cima de {heroi}, e a expedição de {feudo} largou tudo para descer a serra. | Um Guerreiro teria segurado a saída enquanto a fumaça fazia o resto. |
| A descida da serra | a expedição de {feudo} desceu a serra do Covil dos Lobos. | | | | |

#### Covil dos Lobos · variante B

```
gorge  encontro 40 min  "As sentinelas da garganta"  dificuldade 70
twoMouths  encruzilhada  "A toca de duas bocas"   Cautelosa → burnBrush · Equilibrada → blockAndEnter · Ousada → shootFromAbove
  shootFromAbove) "Flechar a matilha do alto do penedo"  [requer um Arqueiro]
      crag  chefe 45 min  "A matilha sob o penedo"  dificuldade 104
      home  retorno 35 min  "A descida da serra"
  blockAndEnter) "Fechar uma boca com pedras e entrar pela outra"
      narrowDen  chefe 45 min  "A toca apertada"  dificuldade 80
      → home (acima)
  burnBrush) "Queimar o mato em volta e descer"
      brushfire  perigo 45 min  "O fogo no mato"  dificuldade 60
      → home (acima)
```

| Nó | Tipo | Dif. | Pesa | Favorece | No Desastre | XP | Rende (no Sucesso) | Fraca | Mínima | Com folga |
|---|---|---:|---|---|---|---:|---|---|---|---|
| As sentinelas da garganta | encontro | 70 | o padrão | Guerreiro | fere gravemente | 30 | 10 a 20 de ouro | 0/6/25/0 | 0/26/5/0 | 15/16/0/0 |
| A matilha sob o penedo | chefe | 104 | perícia ×1,5 | Arqueiro | fere gravemente | 45 | 40 a 70 de ouro; item (1 em 2): Arco de freixo, Amuleto de osso, Corno de batedor; **limpa o Covil** | 0/0/31/0 | 0/19/12/0 | 8/23/0/0 |
| A toca apertada | chefe | 80 | o padrão | Guerreiro | fere gravemente | 40 | 25 a 40 de ouro; **limpa o Covil** | 0/0/28/3 | 0/13/18/0 | 1/26/4/0 |
| O fogo no mato | perigo | 60 | perícia ×0,5 | Guerreiro | fere gravemente | 20 | 10 a 15 de ouro | 7/24/0/0 | 27/4/0/0 | 31/0/0/0 |

**Encruzilhada "A toca de duas bocas".** A toca tem duas bocas, uma de cada lado de um penedo. Do alto do penedo se vê a matilha inteira deitada ao sol.

| Opção | Postura | Requisito | Pista | Razoável para | Ruim para |
|---|---|---|---|---|---|
| Flechar a matilha do alto do penedo | Ousada | um Arqueiro | Lá de cima os lobos não alcançam ninguém, e sobra tempo para revirar a toca; só serve a quem tem arqueiro. | Arqueiro + Arqueiro Nv2 (passa em 100%) | Guerreiro + Guerreiro Nv1 (não pode) |
| Fechar uma boca com pedras e entrar pela outra | Equilibrada | — | Luta de perto, em lugar apertado; o Covil fica limpo. | Guerreiro + Guerreiro Nv5 (passa em 100%) | Arqueiro + Arqueiro Nv1 (passa em 13%) |
| Queimar o mato em volta e descer | Cautelosa | — | Sem dente de lobo por perto; a matilha se espalha, mas volta à toca. | Clérigo + Clérigo Nv1 (passa em 100%) | Arqueiro + Arqueiro Nv5 (passa em 100%) |

Frases do relatório (sem a data, que abre todas: "No Nº dia da estação,"):

| Nó | Sucesso pleno | Sucesso | Revés | Desastre | Lição (quando falta a classe) |
|---|---|---|---|---|---|
| As sentinelas da garganta | {heroi} abateu as sentinelas da garganta antes do primeiro uivo, e a expedição de {feudo} subiu sem ser vista. | {heroi} abriu passagem entre as sentinelas da garganta para a expedição de {feudo}. | uma sentinela escapou de {heroi} e uivou: a expedição de {feudo} chegou à toca com a matilha à espera. | as sentinelas da garganta cercaram {heroi}, e a expedição de {feudo} só passou deixando sangue na pedra. | Um Guerreiro teria calado as sentinelas antes do primeiro uivo. |
| A matilha sob o penedo | {heroi} derrubou do alto do penedo a loba que guiava a matilha. Os outros fugiram, e a expedição de {feudo} revirou a toca com calma. | {heroi} flechou a matilha do alto do penedo até ela largar a toca. | a matilha achou o caminho do penedo antes de {heroi} acabar com as flechas: a expedição de {feudo} desceu às pressas, com metade do achado. | a matilha subiu o penedo por trás de {heroi}, e a expedição de {feudo} saltou de lá sem levar nada. | Um Arqueiro teria acertado a loba que guia a matilha. |
| A toca apertada | {heroi} entrou na frente pela boca aberta e acabou com a matilha lobo a lobo. O Covil ficou em silêncio. | {heroi} empurrou a matilha para o fundo da toca até ela se render à fome e à pedra. | os lobos derrubaram as pedras da outra boca enquanto {heroi} lutava: a matilha escapou, mordendo. | a toca apertada virou contra {heroi}: sem espaço para o golpe, a expedição de {feudo} saiu de costas e de mãos vazias. | Um Guerreiro teria ido na frente, onde só cabe um. |
| O fogo no mato | {heroi} pôs fogo no mato em volta da toca com o vento a favor. A matilha se espalhou, e ficou no chão o que ela guardava cá fora. | {heroi} queimou o mato em volta da toca, e a matilha se espalhou pela serra. | o fogo correu para o lado de {heroi}, e a expedição de {feudo} desceu a serra tossindo. | o fogo cercou {heroi}, e a expedição de {feudo} largou a carga para sair do mato. | Um Guerreiro teria aberto o aceiro mais depressa. |
| A descida da serra | a expedição de {feudo} desceu a serra do Covil dos Lobos. | | | | |

#### Covil dos Lobos · variante C

```
nightCamp  acampamento 40 min  "A noite na serra"  dificuldade 76
cubs  encruzilhada  "Os filhotes na toca"   Cautelosa → retreat · Equilibrada → driveAway · Ousada → killSheWolf
  killSheWolf) "Matar a loba antes que a matilha volte"
      sheWolf  chefe 45 min  "A loba e a cria"  dificuldade 94
      home  retorno 35 min  "A descida da serra"
  driveAway) "Espantar a matilha serra acima"
      pack  encontro 45 min  "A matilha de volta da caça"  dificuldade 94
      → home (acima)
  retreat) "Recuar com o que têm"
      → home (acima)
```

| Nó | Tipo | Dif. | Pesa | Favorece | No Desastre | XP | Rende (no Sucesso) | Fraca | Mínima | Com folga |
|---|---|---:|---|---|---|---:|---|---|---|---|
| A noite na serra | acampamento | 76 | vontade ×1,5, ataque ×0,5 | Clérigo | fere gravemente | 30 | 10 a 20 de ouro | 20/11/0/0 | 1/26/4/0 | 16/15/0/0 |
| A loba e a cria | chefe | 94 | o padrão | Guerreiro | fere gravemente | 45 | 60 a 90 de ouro; item (1 em 2): Lança de caça, Couro fervido, Amuleto de osso; **limpa o Covil** | 0/0/13/18 | 0/0/31/0 | 0/12/19/0 |
| A matilha de volta da caça | encontro | 94 | vontade ×1 | Mago | fere gravemente | 40 | 15 a 25 de ouro; **limpa o Covil** | 0/18/13/0 | 0/16/15/0 | 3/26/2/0 |

**Encruzilhada "Os filhotes na toca".** Do alto se vê a loba deitada à entrada, com os filhotes. O resto da matilha caça longe, e volta antes do meio-dia.

| Opção | Postura | Requisito | Pista | Razoável para | Ruim para |
|---|---|---|---|---|---|
| Matar a loba antes que a matilha volte | Ousada | — | Uma loba com cria vale por três; lá dentro está tudo o que a matilha juntou. | Guerreiro + Guerreiro Nv5 (passa em 100%) | Clérigo + Clérigo Nv3 (passa em 0%) |
| Espantar a matilha serra acima | Equilibrada | — | Gritos, tochas e sangue-frio quando ela voltar; pouco ouro, e o Covil fica limpo. | Mago + Clérigo Nv3 (passa em 100%) | Guerreiro + Guerreiro Nv5 (passa em 100%) |
| Recuar com o que têm | Cautelosa | — | Sem risco; os lobos ficam onde estão. | — | Guerreiro + Guerreiro Nv5 (passa em 100%) |

Frases do relatório (sem a data, que abre todas: "No Nº dia da estação,"):

| Nó | Sucesso pleno | Sucesso | Revés | Desastre | Lição (quando falta a classe) |
|---|---|---|---|---|---|
| A noite na serra | {heroi} manteve o fogo e a calma a noite inteira, com os uivos em volta. A expedição de {feudo} amanheceu descansada diante da toca. | {heroi} ficou de vigia na serra, e a expedição de {feudo} dormiu o bastante para subir ao amanhecer. | os uivos tiraram o sono de {heroi} e de todos: a expedição de {feudo} subiu à toca cansada e de nervos à flor da pele. | o medo venceu {heroi} no meio da noite: o fogo apagou, e os lobos provaram a expedição de {feudo} antes do amanhecer. | Um Clérigo teria mantido o ânimo da equipe com os uivos em volta. |
| A loba e a cria | {heroi} venceu a loba à entrada da toca antes de a matilha voltar. Sem ela, os lobos largaram a serra, e a expedição de {feudo} esvaziou a toca. | {heroi} pôs a loba para correr com a cria na boca, e a matilha foi atrás dela. | a loba segurou {heroi} à entrada até a matilha voltar: a expedição de {feudo} fugiu com metade do que tinha pegado. | a loba derrubou {heroi} à entrada da toca, e a matilha chegou a tempo de acabar o serviço. Nada saiu de lá. | Um Guerreiro teria aguentado a primeira investida da loba. |
| A matilha de volta da caça | {heroi} recebeu a matilha com fogo e voz, sem dar um passo atrás. Os lobos viraram serra acima e não olharam para trás. | {heroi} não arredou pé diante da matilha, e ela trocou a toca pela serra alta. | {heroi} hesitou quando a matilha voltou, e os lobos perceberam: ficaram com a toca, e a expedição de {feudo}, com as mordidas. | a matilha não teve medo de {heroi} nem das tochas, e a expedição de {feudo} desceu a serra correndo, sem nada. | Um Mago teria feito o fogo falar mais alto do que os lobos. |
| A descida da serra | a expedição de {feudo} desceu a serra do Covil dos Lobos. | | | | |

### 6.6 Resgate (`rescue`)

**Requisitos:** 2 heróis; Guilda dos Aventureiros Nv1. **Descoberta:** enquanto houver um herói em cativeiro. **Risco:** Alto. **Duração anunciada:** 120 min de jogo, sem a espera da encruzilhada. **Curadoria:** rascunho, não lido pelo autor.

#### Resgate · variante A

```
captorsTrail  perigo 45 min  "A trilha dos captores"  dificuldade 90
campAtHill  encruzilhada  "O acampamento ao pé do morro"   Cautelosa → waitForGuardChange · Equilibrada → cutRopesAtNight · Ousada → stormAtNoon
  stormAtNoon) "Atacar ao meio-dia e levar também o cofre"
      noonFight  chefe 45 min  "O bando ao meio-dia"  dificuldade 96
      home  retorno 30 min  "A fuga para casa"
  cutRopesAtNight) "Entrar à noite e cortar as cordas"
      nightRopes  chefe 45 min  "As cordas no escuro"  dificuldade 96
      → home (acima)
  waitForGuardChange) "Esperar a troca da guarda"
      guardChange  encontro 45 min  "A troca da guarda"  dificuldade 78
      → home (acima)
```

| Nó | Tipo | Dif. | Pesa | Favorece | No Desastre | XP | Rende (no Sucesso) | Fraca | Mínima | Com folga |
|---|---|---:|---|---|---|---:|---|---|---|---|
| A trilha dos captores | perigo | 90 | perícia ×1 | Arqueiro | fere gravemente | 30 | — | 0/3/28/0 | 0/24/7/0 | 13/18/0/0 |
| O bando ao meio-dia | chefe | 96 | o padrão | Guerreiro | **captura** | 50 | 60 a 90 de ouro; item (1 em 2): Arco de freixo, Couro fervido, Corno de batedor; **solta o cativo** | 0/0/11/20 | 0/0/29/2 | 0/9/22/0 |
| As cordas no escuro | chefe | 96 | perícia ×1 | Arqueiro | **captura** | 45 | 20 a 40 de ouro; **solta o cativo** | 0/0/31/0 | 0/18/13/0 | 6/25/0/0 |
| A troca da guarda | encontro | 78 | perícia ×0,5 | Guerreiro | **captura** | 40 | **solta o cativo** | 0/7/24/0 | 0/27/4/0 | 16/15/0/0 |

**Encruzilhada "O acampamento ao pé do morro".** Os captores acampam ao pé de um morro. O cativo está amarrado a uma carroça; o cofre do bando fica na tenda do meio.

| Opção | Postura | Requisito | Pista | Razoável para | Ruim para |
|---|---|---|---|---|---|
| Atacar ao meio-dia e levar também o cofre | Ousada | — | O bando inteiro acordado e com a mão na lâmina; quem ganhar leva tudo. | Guerreiro + Guerreiro Nv5 (passa em 94%) | Arqueiro + Arqueiro Nv1 (passa em 0%) |
| Entrar à noite e cortar as cordas | Equilibrada | — | Silêncio e mão leve; dá para soltar o cativo e encher os bolsos na saída. | Arqueiro + Arqueiro Nv5 (passa em 100%) | Guerreiro + Clérigo Nv1 (passa em 19%) |
| Esperar a troca da guarda | Cautelosa | — | O momento mais seguro para chegar à carroça; não sobra tempo para mais nada. | Guerreiro + Clérigo Nv1 (passa em 61%) | Guerreiro + Guerreiro Nv5 (passa em 100%) |

Frases do relatório (sem a data, que abre todas: "No Nº dia da estação,"):

| Nó | Sucesso pleno | Sucesso | Revés | Desastre | Lição (quando falta a classe) |
|---|---|---|---|---|---|
| A trilha dos captores | {heroi} seguiu a trilha dos captores sem pisar em um laço, e a expedição de {feudo} chegou ao acampamento sem ser vista. | {heroi} achou a trilha dos captores e levou a expedição de {feudo} até o acampamento deles. | {heroi} pisou em um laço dos captores: a expedição de {feudo} perdeu tempo e chegou com o acampamento alerta. | a trilha dos captores era uma cilada, e {heroi} caiu nela: a expedição de {feudo} chegou ao acampamento ferida e anunciada. | Um Arqueiro teria visto os laços armados na trilha. |
| O bando ao meio-dia | {heroi} rompeu o bando ao meio-dia, de frente. Os captores largaram o cativo e o cofre para salvar a pele. | {heroi} abriu caminho até a carroça em pleno dia, e a expedição de {feudo} saiu do acampamento com o cativo e o cofre. | o bando fechou em volta de {heroi} antes da carroça: a expedição de {feudo} recuou com o que agarrou, e o cativo ficou. | o bando fechou sobre {heroi} no meio do acampamento: a expedição de {feudo} foi desbaratada, e o cativo ficou onde estava. | Um Guerreiro teria segurado o bando enquanto as cordas eram cortadas. |
| As cordas no escuro | {heroi} cortou as cordas no escuro sem um estalo, e a expedição de {feudo} ainda esvaziou os alforjes do bando antes de sumir. | {heroi} cortou as cordas no escuro, e a expedição de {feudo} deixou o acampamento com o cativo. | um cão latiu quando {heroi} tocou a carroça: a expedição de {feudo} fugiu no escuro, e o cativo ficou amarrado. | o acampamento acordou em cima de {heroi}: a expedição de {feudo} foi desbaratada no escuro, e o cativo ficou amarrado. | Um Arqueiro teria chegado à carroça sem acordar ninguém. |
| A troca da guarda | {heroi} chegou à carroça na troca da guarda, e ninguém do bando deu pela falta do cativo antes do amanhecer. | {heroi} aproveitou a troca da guarda, e a expedição de {feudo} levou o cativo pelo lado do morro. | a guarda trocou mais cedo do que {heroi} contava: a expedição de {feudo} teve de largar a carroça e correr. | as duas guardas pegaram {heroi} entre elas: a expedição de {feudo} foi desbaratada, e a carroça continuou vigiada. | Um Guerreiro teria calado a sentinela que sobrou. |
| A fuga para casa | a expedição de resgate tomou o caminho de {feudo}, sem olhar para trás. | | | | |

#### Resgate · variante B

```
watchedFord  encontro 45 min  "O vau vigiado"  dificuldade 72
ruinedTower  encruzilhada  "A torre em ruínas"   Cautelosa → passFileThroughGap · Equilibrada → climbBackWall · Ousada → breakDoor
  breakDoor) "Arrombar a porta"  [requer um Guerreiro]
      oakDoor  chefe 45 min  "A guarda atrás da porta"  dificuldade 96
      home  retorno 30 min  "A fuga para casa"
  climbBackWall) "Escalar a parede dos fundos"
      backWall  chefe 45 min  "A parede dos fundos"  dificuldade 104
      → home (acima)
  passFileThroughGap) "Passar a lima pela fresta e esperar"
      gap  perigo 45 min  "A fresta ao pé da torre"  dificuldade 84
      → home (acima)
```

| Nó | Tipo | Dif. | Pesa | Favorece | No Desastre | XP | Rende (no Sucesso) | Fraca | Mínima | Com folga |
|---|---|---:|---|---|---|---:|---|---|---|---|
| O vau vigiado | encontro | 72 | o padrão | Guerreiro | fere gravemente | 30 | — | 0/3/28/0 | 0/23/8/0 | 12/19/0/0 |
| A guarda atrás da porta | chefe | 96 | o padrão | Guerreiro | **captura** | 50 | 50 a 80 de ouro; item (1 em 2): Arco de freixo, Couro fervido, Gibão acolchoado; **solta o cativo** | 0/0/11/20 | 0/0/29/2 | 0/9/22/0 |
| A parede dos fundos | chefe | 104 | perícia ×1,5 | Arqueiro | **captura** | 45 | 15 a 30 de ouro; **solta o cativo** | 0/0/31/0 | 0/19/12/0 | 8/23/0/0 |
| A fresta ao pé da torre | perigo | 84 | vontade ×1 | Mago | **captura** | 40 | **solta o cativo** | 2/26/3/0 | 0/26/5/0 | 15/16/0/0 |

**Encruzilhada "A torre em ruínas".** O cativo está no alto de uma torre meio caída. A porta é de carvalho, a parede dos fundos está rachada, e há uma fresta ao nível do chão.

| Opção | Postura | Requisito | Pista | Razoável para | Ruim para |
|---|---|---|---|---|---|
| Arrombar a porta | Ousada | um Guerreiro | A guarda inteira atrás dela, com o soldo do bando; é serviço para quem aguenta pancada. | Guerreiro + Guerreiro Nv5 (passa em 94%) | Guerreiro + Clérigo Nv1 (passa em 0%) |
| Escalar a parede dos fundos | Equilibrada | — | Pedra solta e altura; lá em cima há só um carcereiro, e a bolsa dele. | Arqueiro + Arqueiro Nv2 (passa em 100%) | Clérigo + Clérigo Nv1 (passa em 0%) |
| Passar a lima pela fresta e esperar | Cautelosa | — | Paciência e nervos, com a ronda passando ao lado; o cativo serra a própria saída, e é só o que se leva. | Clérigo + Clérigo Nv1 (passa em 90%) | Guerreiro + Guerreiro Nv5 (passa em 100%) |

Frases do relatório (sem a data, que abre todas: "No Nº dia da estação,"):

| Nó | Sucesso pleno | Sucesso | Revés | Desastre | Lição (quando falta a classe) |
|---|---|---|---|---|---|
| O vau vigiado | {heroi} tomou o vau vigiado antes que as sentinelas dessem o sinal, e a expedição de {feudo} atravessou sem deixar aviso. | {heroi} forçou a passagem no vau vigiado, e a expedição de {feudo} seguiu para a torre. | as sentinelas do vau seguraram {heroi} o bastante para tocar a corneta: a torre soube que vinha gente. | as sentinelas do vau derrubaram {heroi} na água, e a expedição de {feudo} atravessou ferida e esperada. | Um Guerreiro teria atravessado o vau na frente, com as flechas batendo no escudo. |
| A guarda atrás da porta | {heroi} arrombou a porta da torre e varreu a guarda escada acima. O cativo desceu livre, e o soldo do bando desceu junto. | {heroi} arrombou a porta da torre e venceu a guarda degrau a degrau, até a cela. | a guarda segurou {heroi} na escada da torre: a expedição de {feudo} saiu com o que achou embaixo, e a cela ficou trancada. | a guarda da torre fechou a porta atrás de {heroi}: a expedição de {feudo} lutou só para sair, e a cela continuou trancada. | Um Guerreiro teria sido o primeiro a passar pela porta. |
| A parede dos fundos | {heroi} escalou a parede dos fundos, rendeu o carcereiro dormindo e desceu com o cativo e com a bolsa dele. | {heroi} escalou a parede dos fundos e desceu o cativo por uma corda. | uma pedra da parede cedeu sob {heroi}, e o barulho acordou a torre: a expedição de {feudo} largou a corda e correu. | {heroi} caiu da parede dos fundos aos pés da ronda: a expedição de {feudo} foi desbaratada, e o cativo ficou no alto. | Um Arqueiro teria subido a parede e jogado a corda. |
| A fresta ao pé da torre | {heroi} passou a lima pela fresta e esperou imóvel, ronda após ronda. Antes do amanhecer o cativo estava do lado de fora. | {heroi} passou a lima pela fresta, e o cativo serrou a própria saída. | {heroi} perdeu a calma com a ronda tão perto e se afastou da fresta: a lima não chegou ao cativo. | a ronda deu com {heroi} junto à fresta: a expedição de {feudo} foi desbaratada, e a lima nunca chegou ao cativo. | Um Mago teria esperado sem tremer, com a ronda a dois passos. |
| A fuga para casa | a expedição de resgate tomou o caminho de {feudo}, sem olhar para trás. | | | | |

#### Resgate · variante C

```
firelessNight  acampamento 45 min  "A noite sem fogo"  dificuldade 78
cage  encruzilhada  "A gaiola no meio do acampamento"   Cautelosa → crawlByDitch · Equilibrada → looseHorses · Ousada → challengeChief
  challengeChief) "Desafiar o chefe do bando"  [requer o traço Corajoso]
      duel  chefe 45 min  "O duelo com o chefe do bando"  dificuldade 92
      home  retorno 30 min  "A fuga para casa"
  looseHorses) "Soltar os cavalos e entrar na confusão"
      stampede  chefe 45 min  "Os cavalos soltos"  dificuldade 106
      → home (acima)
  crawlByDitch) "Rastejar pela vala até a gaiola"
      ditch  perigo 45 min  "A vala até a gaiola"  dificuldade 80
      → home (acima)
```

| Nó | Tipo | Dif. | Pesa | Favorece | No Desastre | XP | Rende (no Sucesso) | Fraca | Mínima | Com folga |
|---|---|---:|---|---|---|---:|---|---|---|---|
| A noite sem fogo | acampamento | 78 | vontade ×1,5, ataque ×0,5 | Clérigo | fere gravemente | 30 | — | 17/14/0/0 | 0/25/6/0 | 14/17/0/0 |
| O duelo com o chefe do bando | chefe | 92 | o padrão | Guerreiro | **captura** | 50 | 70 a 100 de ouro; item (1 em 2): Arco de freixo, Couro fervido, Corno de batedor; **solta o cativo** | 0/0/15/16 | 0/0/31/0 | 0/14/17/0 |
| Os cavalos soltos | chefe | 106 | velocidade ×1, perícia ×0,5 | Arqueiro | **captura** | 45 | 20 a 35 de ouro; **solta o cativo** | 0/0/31/0 | 0/19/12/0 | 8/23/0/0 |
| A vala até a gaiola | perigo | 80 | perícia ×0,5 | Guerreiro | **captura** | 40 | **solta o cativo** | 0/4/27/0 | 0/25/6/0 | 14/17/0/0 |

**Encruzilhada "A gaiola no meio do acampamento".** O cativo está em uma gaiola de madeira no meio do acampamento, entre as tendas e os cavalos. O chefe do bando bebe sentado em cima do cofre.

| Opção | Postura | Requisito | Pista | Razoável para | Ruim para |
|---|---|---|---|---|---|
| Desafiar o chefe do bando | Ousada | traço Corajoso | Um contra um, diante de todos, valendo o cativo e o cofre; só quem não conhece o medo propõe uma coisa dessas. | Guerreiro + Guerreiro Nv5, com um Corajoso (passa em 100%) | Arqueiro + Arqueiro Nv1, com um Corajoso (passa em 0%) |
| Soltar os cavalos e entrar na confusão | Equilibrada | — | Pernas e mão ligeira; na correria dá para abrir a gaiola e pegar o que estiver solto. | Arqueiro + Arqueiro Nv1 (passa em 74%) | Guerreiro + Guerreiro Nv5, com um Corajoso (passa em 100%) |
| Rastejar pela vala até a gaiola | Cautelosa | — | Devagar e na lama, por baixo dos olhos do bando; o cativo, e nada além dele. | Guerreiro + Guerreiro Nv1 (passa em 87%) | Guerreiro + Guerreiro Nv5, com um Corajoso (passa em 100%) |

Frases do relatório (sem a data, que abre todas: "No Nº dia da estação,"):

| Nó | Sucesso pleno | Sucesso | Revés | Desastre | Lição (quando falta a classe) |
|---|---|---|---|---|---|
| A noite sem fogo | {heroi} manteve a expedição de {feudo} quieta e sem fogo a noite toda, a um grito do bando. Amanheceram perto, inteiros e sem serem vistos. | {heroi} segurou o ânimo da expedição de {feudo} em uma noite sem fogo, à vista das fogueiras do bando. | o frio venceu {heroi}, que acendeu um fogo pequeno: o bando viu a luz e dobrou a guarda. | a noite sem fogo quebrou {heroi}: a expedição de {feudo} amanheceu doente, cansada e com o bando à procura dela. | Um Clérigo teria feito a equipe aguentar o frio e o medo sem acender nada. |
| O duelo com o chefe do bando | {heroi} venceu o chefe do bando diante de todos. Ninguém ousou negar o trato: a gaiola foi aberta, e o cofre mudou de dono. | {heroi} derrubou o chefe do bando no duelo, e o bando cumpriu a palavra dele a contragosto. | o duelo entre {heroi} e o chefe do bando acabou sem vencedor: a expedição de {feudo} saiu viva, com o que lhe atiraram, e sem o cativo. | {heroi} perdeu o duelo com o chefe do bando, e o bando cobrou a aposta na hora: a expedição de {feudo} foi desbaratada, e a gaiola continuou fechada. | Um Guerreiro teria aguentado os golpes do chefe até ele cansar. |
| Os cavalos soltos | {heroi} soltou os cavalos e atravessou o acampamento na poeira: abriu a gaiola, e ainda catou o que o bando largou na correria. | {heroi} abriu a gaiola no meio da confusão dos cavalos, e a expedição de {feudo} sumiu com o cativo. | os cavalos correram para o lado errado, e {heroi} ficou à vista: a expedição de {feudo} fugiu com o que pegou, e a gaiola ficou fechada. | a poeira dos cavalos baixou cedo demais, com {heroi} no meio do acampamento: a expedição de {feudo} foi desbaratada, e a gaiola continuou fechada. | Um Arqueiro teria chegado à gaiola antes de a poeira baixar. |
| A vala até a gaiola | {heroi} rastejou pela vala até a gaiola e tirou as travas uma a uma. O bando só achou a gaiola vazia. | {heroi} chegou à gaiola pela vala, e a expedição de {feudo} voltou por ela com o cativo. | {heroi} atolou na vala a poucos passos da gaiola, e a expedição de {feudo} teve de voltar antes da ronda. | a ronda olhou para a vala na hora errada e deu com {heroi}: a expedição de {feudo} foi desbaratada, e a gaiola continuou fechada. | Um Guerreiro teria arrancado as travas da gaiola sem ferramenta. |
| A fuga para casa | a expedição de resgate tomou o caminho de {feudo}, sem olhar para trás. | | | | |

### 6.7 Ruínas de Vel'Thar (`ruins`)

**Requisitos:** 2 a 3 heróis, todos de nível 2 ou mais; Guilda dos Aventureiros Nv1. **Descoberta:** por descoberta: outra expedição o revela. **Risco:** Médio. **Duração anunciada:** 180 min de jogo, sem a espera da encruzilhada. **Curadoria:** rascunho, não lido pelo autor.

#### Ruínas de Vel'Thar · variante A

```
ruinsTrail  viagem 45 min  "A trilha até as ruínas"  sem prova
stairway  encruzilhada  "A escadaria desaba atrás de vocês"   Cautelosa → retreat · Equilibrada → floodedGallery · Ousada → inscriptionsCorridor
  inscriptionsCorridor) "Seguir pelo Corredor das Inscrições"
      corridor  perigo 45 min  "O Corredor das Inscrições"  dificuldade 110
      stoneGuardian  chefe 45 min  "O Guardião de Pedra"  dificuldade 92
      home  retorno 45 min  "A volta pela estrada dos mortos"
  floodedGallery) "Atravessar a Galeria Inundada"  [requer um Guerreiro]
      gallery  encontro 45 min  "A Galeria Inundada"  dificuldade 72
      → stoneGuardian (acima)
  retreat) "Recuar com o que têm"
      → home (acima)
```

| Nó | Tipo | Dif. | Pesa | Favorece | No Desastre | XP | Rende (no Sucesso) | Fraca | Mínima | Com folga |
|---|---|---:|---|---|---|---:|---|---|---|---|
| A trilha até as ruínas | viagem | — | — | — | — | — | — | — | — | — |
| O Corredor das Inscrições | perigo | 110 | perícia ×1,5 | Arqueiro | fere gravemente | 40 | 30 a 50 de pedra; 30 a 50 de ouro; item (1 em 2): Lâmina de Vel'Thar, Cota rebitada, Medalha do peregrino | 0/0/31/0 | 0/21/10/0 | 31/0/0/0 |
| A Galeria Inundada | encontro | 72 | o padrão | Guerreiro | fere gravemente | 35 | 50 a 70 de pedra; 30 a 40 de ouro | 0/11/20/0 | 4/26/1/0 | 31/0/0/0 |
| O Guardião de Pedra | chefe | 92 | o padrão | Guerreiro | **captura** | 60 | 70 a 90 de pedra; 50 a 70 de ouro; item (sempre): Lâmina de Vel'Thar, Cota rebitada, Medalha do peregrino; revela Pântano Nebuloso | 0/0/22/9 | 0/6/25/0 | 30/1/0/0 |

**Encruzilhada "A escadaria desaba atrás de vocês".** A escadaria desaba atrás de vocês. Adiante, um corredor de paredes escritas; à direita, uma galeria com água parada; e, entre os escombros, uma fresta por onde ainda se sai.

| Opção | Postura | Requisito | Pista | Razoável para | Ruim para |
|---|---|---|---|---|---|
| Seguir pelo Corredor das Inscrições | Ousada | — | Armadilhas antigas, e nichos que ninguém abriu; quem tem perícia passa. | Arqueiro + Mago + Clérigo Nv6 (passa em 100%) | Clérigo + Clérigo Nv2 (passa em 0%) |
| Atravessar a Galeria Inundada | Equilibrada | um Guerreiro | Água até o peito e coisa que se mexe debaixo dela; é preciso quem vá na frente abrindo passagem. | Guerreiro + Clérigo Nv2 (passa em 0%) | Guerreiro + Arqueiro + Mago Nv4 (passa em 100%) |
| Recuar com o que têm | Cautelosa | — | Sem risco; o saque fica pequeno. | Clérigo + Clérigo Nv2 (passa em 100%) | Guerreiro + Arqueiro + Mago Nv6 (passa em 100%) |

Frases do relatório (sem a data, que abre todas: "No Nº dia da estação,"):

| Nó | Sucesso pleno | Sucesso | Revés | Desastre | Lição (quando falta a classe) |
|---|---|---|---|---|---|
| A trilha até as ruínas | a expedição de {feudo} subiu a trilha até as Ruínas de Vel'Thar e desceu a escadaria da entrada. | | | | |
| O Corredor das Inscrições | {heroi} leu o Corredor das Inscrições laje por laje, e a expedição de {feudo} abriu os nichos sem disparar um dardo. | {heroi} guiou a expedição de {feudo} pelo Corredor das Inscrições, desviando do que estalava. | {heroi} pisou na laje errada do Corredor das Inscrições: os dardos voaram, e metade dos nichos ficou fechada. | o Corredor das Inscrições se fechou sobre {heroi}: a expedição de {feudo} passou, sangrando e sem abrir um nicho. | Um Arqueiro teria visto os fios esticados à altura do tornozelo. |
| A Galeria Inundada | {heroi} atravessou a Galeria Inundada na frente e matou o que se mexia debaixo da água. A expedição de {feudo} tirou do fundo pedra lavrada e moedas. | {heroi} abriu passagem pela Galeria Inundada, e a expedição de {feudo} carregou o que achou nas bordas. | algo puxou {heroi} para o fundo da Galeria Inundada: a expedição de {feudo} atravessou, mas largou metade da carga na água. | a Galeria Inundada quase ficou com {heroi}: a expedição de {feudo} chegou ao outro lado sem carga nenhuma. | Um Guerreiro teria ido na frente, com a água pelo peito. |
| O Guardião de Pedra | {heroi} quebrou o Guardião de Pedra pelo joelho, e ele não se levantou. A câmara atrás dele ficou aberta para a expedição de {feudo}. | {heroi} segurou o Guardião de Pedra o bastante para a expedição de {feudo} esvaziar a câmara que ele guardava. | o Guardião de Pedra jogou {heroi} contra a parede: a expedição de {feudo} recuou com o que tinha nas mãos, sem chegar à câmara. | o Guardião de Pedra derrubou {heroi}, e a porta da câmara desceu: a expedição de {feudo} foi desbaratada e fugiu das ruínas sem o tesouro. | Um Guerreiro teria aparado os golpes do Guardião de Pedra. |
| A volta pela estrada dos mortos | a expedição de {feudo} deixou as Ruínas de Vel'Thar. | | | | |

#### Ruínas de Vel'Thar · variante B

```
fallenGate  encontro 45 min  "Os saqueadores no portão caído"  dificuldade 70
threeArches  encruzilhada  "O pátio dos três arcos"   Cautelosa → retreat · Equilibrada → falseFloorHall · Ousada → ossuary
  ossuary) "Descer ao ossário"
      bones  perigo 45 min  "O ossário que canta"  dificuldade 104
      cryptGuardian  chefe 45 min  "O guardião da cripta"  dificuldade 116
      home  retorno 45 min  "A volta pela estrada dos mortos"
  falseFloorHall) "Atravessar o salão das lajes falsas"
      falseFloor  perigo 45 min  "O salão das lajes falsas"  dificuldade 84
      → cryptGuardian (acima)
  retreat) "Recuar com o que têm"
      → home (acima)
```

| Nó | Tipo | Dif. | Pesa | Favorece | No Desastre | XP | Rende (no Sucesso) | Fraca | Mínima | Com folga |
|---|---|---:|---|---|---|---:|---|---|---|---|
| Os saqueadores no portão caído | encontro | 70 | o padrão | Guerreiro | fere gravemente | 35 | 30 a 50 de pedra | 0/14/17/0 | 7/24/0/0 | 31/0/0/0 |
| O ossário que canta | perigo | 104 | vontade ×1,5, ataque ×0,5 | Clérigo | fere gravemente | 40 | 40 a 60 de pedra; 30 a 50 de ouro; item (1 em 2): Lâmina de Vel'Thar, Cota rebitada, Medalha do peregrino | 0/22/9/0 | 0/4/27/0 | 31/0/0/0 |
| O salão das lajes falsas | perigo | 84 | perícia ×1 | Arqueiro | fere gravemente | 40 | 40 a 70 de pedra; 20 a 40 de ouro | 0/18/13/0 | 12/19/0/0 | 31/0/0/0 |
| O guardião da cripta | chefe | 116 | vontade ×1 | Mago | **captura** | 60 | 60 a 80 de pedra; 60 a 80 de ouro; item (sempre): Lâmina de Vel'Thar, Cota rebitada, Medalha do peregrino; revela Pântano Nebuloso | 0/4/27/0 | 0/1/30/0 | 31/0/0/0 |

**Encruzilhada "O pátio dos três arcos".** O pátio tem três arcos. O primeiro desce a um ossário de onde vem um canto baixo; o segundo dá em um salão de lajes desiguais; o terceiro é por onde vocês entraram.

| Opção | Postura | Requisito | Pista | Razoável para | Ruim para |
|---|---|---|---|---|---|
| Descer ao ossário | Ousada | — | Os mortos de lá não descansam, e guardam o que foi enterrado com eles; quem tem fé firme não se perde. | Clérigo + Clérigo Nv4 (passa em 58%) | Arqueiro + Arqueiro Nv2 (passa em 0%) |
| Atravessar o salão das lajes falsas | Equilibrada | — | Chão que cede e pedra boa pelas paredes; quem tem perícia passa. | Arqueiro + Arqueiro Nv2 (passa em 0%) | Clérigo + Clérigo Nv4 (passa em 58%) |
| Recuar com o que têm | Cautelosa | — | Sem risco; o saque fica pequeno. | — | Guerreiro + Arqueiro + Mago Nv4 (passa em 100%) |

Frases do relatório (sem a data, que abre todas: "No Nº dia da estação,"):

| Nó | Sucesso pleno | Sucesso | Revés | Desastre | Lição (quando falta a classe) |
|---|---|---|---|---|---|
| Os saqueadores no portão caído | {heroi} desbaratou os saqueadores do portão caído, e a expedição de {feudo} ficou com o que eles tinham cavado. | {heroi} abriu passagem entre os saqueadores do portão caído. | os saqueadores do portão caído cercaram {heroi} e cobraram caro a passagem da expedição de {feudo}. | os saqueadores do portão caído emboscaram {heroi}: a expedição de {feudo} passou deixando sangue e sem levar nada deles. | Um Guerreiro teria feito os saqueadores cederem o portão. |
| O ossário que canta | {heroi} atravessou o ossário rezando mais alto do que os mortos cantavam, e a expedição de {feudo} recolheu o que fora enterrado com eles. | {heroi} não deu ouvidos ao canto do ossário e levou a expedição de {feudo} até o outro lado. | o canto do ossário entrou na cabeça de {heroi}: a expedição de {feudo} andou em círculos e saiu com metade do achado. | o canto do ossário levou {heroi} para o meio das ossadas, e a expedição de {feudo} largou tudo para ir buscar. | Um Clérigo teria calado o canto do ossário com uma prece. |
| O salão das lajes falsas | {heroi} marcou a giz as lajes firmes do salão, e a expedição de {feudo} tirou a pedra das paredes sem pressa. | {heroi} levou a expedição de {feudo} pelo salão das lajes falsas, pisando onde o chão aguentava. | uma laje falsa se abriu sob {heroi}: a expedição de {feudo} perdeu no buraco metade do que carregava. | o chão do salão cedeu inteiro sob {heroi}, e a carga da expedição de {feudo} foi para o fundo. | Um Arqueiro teria testado cada laje antes de pôr o peso. |
| O guardião da cripta | {heroi} encarou o guardião da cripta até ele baixar os olhos e voltar ao túmulo. A expedição de {feudo} abriu a arca sem pressa. | {heroi} resistiu ao olhar do guardião da cripta enquanto a expedição de {feudo} levava a arca. | o olhar do guardião da cripta paralisou {heroi}: a expedição de {feudo} saiu arrastando gente, com o que estava fora da arca. | o olhar do guardião da cripta dobrou {heroi}, e a laje da cripta se fechou: a expedição de {feudo} foi desbaratada e fugiu sem a arca. | Um Mago teria quebrado o olhar do guardião da cripta. |
| A volta pela estrada dos mortos | a expedição de {feudo} deixou as Ruínas de Vel'Thar. | | | | |

#### Ruínas de Vel'Thar · variante C

```
deadRoad  viagem 45 min  "A estrada dos mortos"  sem prova
cisternAndTower  encruzilhada  "A cisterna e a torre"   Cautelosa → gatherCourtyard · Equilibrada → descendCistern · Ousada → readSeals
  readSeals) "Romper os selos da torre"  [requer um Mago]
      seals  perigo 45 min  "Os selos da torre"  dificuldade 104
      facelessSentinel  chefe 45 min  "A sentinela sem rosto"  dificuldade 112
      home  retorno 45 min  "A volta pela estrada dos mortos"
  descendCistern) "Descer à cisterna"
      cistern  encontro 45 min  "O ninho na cisterna"  dificuldade 64
      → facelessSentinel (acima)
  gatherCourtyard) "Catar a pedra do pátio e voltar"
      courtyard  descoberta 45 min  "A pedra do pátio"  sem prova
      → home (acima)
```

| Nó | Tipo | Dif. | Pesa | Favorece | No Desastre | XP | Rende (no Sucesso) | Fraca | Mínima | Com folga |
|---|---|---:|---|---|---|---:|---|---|---|---|
| A estrada dos mortos | viagem | — | — | — | — | — | — | — | — | — |
| Os selos da torre | perigo | 104 | vontade ×1,5 | Mago | fere gravemente | 40 | 60 a 90 de ouro; item (1 em 2): Lâmina de Vel'Thar, Cota rebitada, Medalha do peregrino | 4/26/1/0 | 0/21/10/0 | 31/0/0/0 |
| O ninho na cisterna | encontro | 64 | o padrão | Guerreiro | fere gravemente | 35 | 50 a 70 de pedra; 20 a 30 de ouro | 0/23/8/0 | 17/14/0/0 | 31/0/0/0 |
| A pedra do pátio | descoberta | — | — | — | — | — | 20 a 30 de pedra | — | — | — |
| A sentinela sem rosto | chefe | 112 | perícia ×1 | Arqueiro | **captura** | 60 | 60 a 80 de pedra; 60 a 80 de ouro; item (sempre): Lâmina de Vel'Thar, Cota rebitada, Medalha do peregrino; revela Pântano Nebuloso | 0/0/25/6 | 0/10/21/0 | 31/0/0/0 |

**Encruzilhada "A cisterna e a torre".** No pátio há uma torre de porta selada, coberta de sinais, e a boca de uma cisterna seca. Pedra lavrada está espalhada pelo chão.

| Opção | Postura | Requisito | Pista | Razoável para | Ruim para |
|---|---|---|---|---|---|
| Romper os selos da torre | Ousada | um Mago | Os sinais da porta queimam quem não os entende; atrás deles, o que os senhores da cidade esconderam. | Mago + Clérigo Nv2 (passa em 0%) | Guerreiro + Arqueiro Nv2 (não pode) |
| Descer à cisterna | Equilibrada | — | Escuro, e ninho de alguma coisa; há pedra boa e moeda perdida no fundo. | Guerreiro + Arqueiro + Clérigo Nv6 (passa em 100%) | Mago + Clérigo Nv2 (passa em 0%) |
| Catar a pedra do pátio e voltar | Cautelosa | — | Sem risco; só a pedra que está à vista. | Clérigo + Clérigo Nv2 (passa em 100%) | Guerreiro + Arqueiro + Mago Nv4 (passa em 100%) |

Frases do relatório (sem a data, que abre todas: "No Nº dia da estação,"):

| Nó | Sucesso pleno | Sucesso | Revés | Desastre | Lição (quando falta a classe) |
|---|---|---|---|---|---|
| A estrada dos mortos | a expedição de {feudo} seguiu a estrada dos mortos até os muros de Vel'Thar e entrou pelo lado da torre. | | | | |
| Os selos da torre | {heroi} desfez os selos da torre um a um, sem uma faísca, e a expedição de {feudo} achou a sala do tesouro intacta. | {heroi} rompeu os selos da torre, e a expedição de {feudo} entrou. | um selo da torre estourou na mão de {heroi}: a porta abriu, e metade do que havia atrás dela virou cinza. | os selos da torre queimaram {heroi} e fundiram a porta. A expedição de {feudo} não levou nada dali. | Um Mago teria lido os selos em vez de forçá-los. |
| O ninho na cisterna | {heroi} desceu à cisterna e acabou com o ninho antes que ele acordasse. A expedição de {feudo} subiu a pedra e as moedas do fundo. | {heroi} manteve o ninho da cisterna encurralado enquanto a expedição de {feudo} carregava a pedra. | o ninho da cisterna acordou em cima de {heroi}: a expedição de {feudo} subiu a corda com metade da carga. | o ninho da cisterna cobriu {heroi}, e a expedição de {feudo} cortou a corda da carga para puxar gente. | Um Guerreiro teria descido primeiro e limpado o ninho. |
| A pedra do pátio | a expedição de {feudo} catou a pedra lavrada do pátio das ruínas e não foi além. | | | | |
| A sentinela sem rosto | {heroi} acertou a junta do elmo da sentinela sem rosto, e ela desabou em peças. A expedição de {feudo} levou o que ela guardava havia séculos. | {heroi} achou o ponto fraco da sentinela sem rosto, e a expedição de {feudo} passou por cima dela até o cofre. | a sentinela sem rosto foi mais rápida do que {heroi}: a expedição de {feudo} recuou com o que estava no chão, sem tocar no cofre. | a sentinela sem rosto derrubou {heroi} e trancou a passagem: a expedição de {feudo} foi desbaratada e fugiu sem o cofre. | Um Arqueiro teria acertado a junta do elmo, o único ponto fraco da sentinela. |
| A volta pela estrada dos mortos | a expedição de {feudo} deixou as Ruínas de Vel'Thar. | | | | |

### 6.8 Pântano Nebuloso (`swamp`)

**Requisitos:** 3 heróis, com ao menos um Mago; Guilda dos Aventureiros Nv3. **Descoberta:** por descoberta: outra expedição o revela. **Risco:** Alto. **Duração anunciada:** 300 min de jogo, sem a espera da encruzilhada. **Curadoria:** rascunho, não lido pelo autor.

#### Pântano Nebuloso · variante A

```
stakeTrail  viagem 60 min  "A trilha de estacas"  sem prova
mire  perigo 60 min  "O atoleiro"  dificuldade 130
lights  encruzilhada  "As luzes sobre a água"   Cautelosa → retreat · Equilibrada → followWillows · Ousada → crossOpenWater
  crossOpenWater) "Atravessar o charco, direto à ilha"
      openWater  encontro 60 min  "As luzes do charco"  dificuldade 140
      marshWitch  chefe 60 min  "A bruxa do charco"  dificuldade 170
      home  retorno 60 min  "A volta pelas estacas"
  followWillows) "Contornar pela margem dos salgueiros"
      willows  perigo 60 min  "A margem dos salgueiros"  dificuldade 132
      → marshWitch (acima)
  retreat) "Recuar com o que têm"
      → home (acima)
```

| Nó | Tipo | Dif. | Pesa | Favorece | No Desastre | XP | Rende (no Sucesso) | Fraca | Mínima | Com folga |
|---|---|---:|---|---|---|---:|---|---|---|---|
| A trilha de estacas | viagem | — | — | — | — | — | — | — | — | — |
| O atoleiro | perigo | 130 | perícia ×1 | Arqueiro | fere gravemente | 45 | — | 0/12/19/0 | 0/25/6/0 | 14/17/0/0 |
| As luzes do charco | encontro | 140 | o padrão | Guerreiro | **captura** | 55 | 80 a 120 de ouro; item (1 em 3): Lâmina de Vel'Thar, Cota rebitada, Medalha do peregrino | 0/0/17/14 | 0/0/29/2 | 0/9/22/0 |
| A margem dos salgueiros | perigo | 132 | vontade ×1 | Mago | fere gravemente | 50 | 30 a 50 de ouro | 0/26/5/0 | 0/24/7/0 | 13/18/0/0 |
| A bruxa do charco | chefe | 170 | vontade ×1,5 | Mago | **captura** | 80 | 100 a 150 de ouro; item (sempre): Cajado de brasa, Placas do guardião, Sinete do rei velho | 0/16/15/0 | 0/10/21/0 | 0/24/7/0 |

**Encruzilhada "As luzes sobre a água".** A névoa abre sobre um charco largo. Luzes azuis dançam no meio dele, em volta de uma ilha; pela margem, uma fila de salgueiros some na bruma.

| Opção | Postura | Requisito | Pista | Razoável para | Ruim para |
|---|---|---|---|---|---|
| Atravessar o charco, direto à ilha | Ousada | — | O caminho mais curto passa por onde as luzes moram; dizem que quem as segue não volta, e que a ilha está cheia do ouro dos que tentaram. | Guerreiro + Guerreiro + Mago Nv5 (passa em 84%) | Mago + Clérigo + Clérigo Nv1 (passa em 0%) |
| Contornar pela margem dos salgueiros | Equilibrada | — | As luzes chamam de longe; quem tem a cabeça firme segue os salgueiros e não olha para o lado. | Mago + Clérigo + Clérigo Nv1 (passa em 43%) | Guerreiro + Guerreiro + Mago Nv5 (passa em 100%) |
| Recuar com o que têm | Cautelosa | — | Sem risco; o pântano fica com os segredos dele. | — | Guerreiro + Guerreiro + Mago Nv5 (passa em 100%) |

Frases do relatório (sem a data, que abre todas: "No Nº dia da estação,"):

| Nó | Sucesso pleno | Sucesso | Revés | Desastre | Lição (quando falta a classe) |
|---|---|---|---|---|---|
| A trilha de estacas | a expedição de {feudo} entrou no Pântano Nebuloso pela trilha de estacas que os turfeiros deixaram. | | | | |
| O atoleiro | {heroi} sondou o atoleiro com a vara, passo a passo, e a expedição de {feudo} atravessou sem molhar a carga. | {heroi} achou a passagem do atoleiro, e a expedição de {feudo} atravessou com lama pelo joelho. | o atoleiro prendeu {heroi} até a cintura: a expedição de {feudo} perdeu horas e fôlego para sair dali. | o atoleiro quase engoliu {heroi}, e a expedição de {feudo} saiu dele quebrada. | Um Arqueiro teria distinguido o chão firme da lama que engole. |
| As luzes do charco | {heroi} atravessou o charco entre as luzes, golpeando o que subia da água. Na ilha, a expedição de {feudo} achou o ouro de todos os que não tinham chegado. | {heroi} abriu caminho pelo charco, e a expedição de {feudo} alcançou a ilha das luzes. | as coisas do charco agarraram {heroi} pelas pernas: a expedição de {feudo} chegou à ilha com metade da gente de pé e pegou o que pôde. | as luzes do charco fecharam em volta de {heroi}: a expedição de {feudo} foi desbaratada na água e não levou nada da ilha. | Um Guerreiro teria aberto caminho entre as coisas que as luzes escondem. |
| A margem dos salgueiros | {heroi} levou a expedição de {feudo} pela margem dos salgueiros sem que ninguém olhasse para as luzes, e ainda achou a canoa de um turfeiro, com a bolsa dentro. | {heroi} manteve a expedição de {feudo} na margem dos salgueiros, de costas para as luzes. | {heroi} olhou para as luzes e deu três passos charco adentro: a expedição de {feudo} gastou a tarde para tirar gente da água. | as luzes levaram {heroi} para longe dos salgueiros, e a expedição de {feudo} se perdeu na bruma atrás. | Um Mago teria sabido que as luzes mentem. |
| A bruxa do charco | {heroi} desfez a névoa da bruxa do charco palavra por palavra, e ela fugiu para o fundo. A cabana ficou para a expedição de {feudo}, com tudo o que havia nela. | {heroi} resistiu à bruxa do charco até ela largar a cabana, e a expedição de {feudo} levou o que a velha guardava. | a névoa da bruxa do charco entrou nos olhos de {heroi}: a expedição de {feudo} saiu da cabana às cegas, com o que estava à mão. | a bruxa do charco calou {heroi} com um gesto: a expedição de {feudo} foi desbaratada na névoa e deixou a cabana sem levar nada. | Um Mago mais firme teria desfeito a névoa da bruxa. |
| A volta pelas estacas | a expedição de {feudo} saiu do Pântano Nebuloso pela trilha de estacas, com lama até a cintura. | | | | |

#### Pântano Nebuloso · variante B

```
rottenRaft  perigo 60 min  "A balsa podre"  dificuldade 140
fever  acampamento 60 min  "A noite da febre"  dificuldade 120
sunkenVillage  encruzilhada  "A aldeia afundada"   Cautelosa → retreat · Equilibrada → diveForBell · Ousada → followDragMarks
  followDragMarks) "Seguir o rastro na lama"  [requer o traço Rastreador]
      dragLair  encontro 60 min  "A toca do que arrasta as redes"  dificuldade 138
      drownedOne  chefe 60 min  "O afogado que anda"  dificuldade 120
      home  retorno 60 min  "A volta pelas estacas"
  diveForBell) "Mergulhar até a capela do sino"
      chapel  perigo 60 min  "A capela debaixo da água"  dificuldade 128
      → drownedOne (acima)
  retreat) "Recuar com o que têm"
      → home (acima)
```

| Nó | Tipo | Dif. | Pesa | Favorece | No Desastre | XP | Rende (no Sucesso) | Fraca | Mínima | Com folga |
|---|---|---:|---|---|---|---:|---|---|---|---|
| A balsa podre | perigo | 140 | velocidade ×1, perícia ×0,5 | Arqueiro | fere gravemente | 45 | — | 0/15/16/0 | 1/26/4/0 | 17/14/0/0 |
| A noite da febre | acampamento | 120 | vontade ×1,5, ataque ×0,5 | Clérigo | fere gravemente | 45 | — | 12/19/0/0 | 0/26/5/0 | 15/16/0/0 |
| A toca do que arrasta as redes | encontro | 138 | o padrão | Guerreiro | **captura** | 55 | 80 a 120 de ouro; item (1 em 3): Lâmina de Vel'Thar, Cota rebitada, Medalha do peregrino | 0/0/18/13 | 0/0/30/1 | 0/10/21/0 |
| A capela debaixo da água | perigo | 128 | perícia ×1 | Arqueiro | fere gravemente | 50 | 40 a 60 de ouro | 0/13/18/0 | 0/26/5/0 | 15/16/0/0 |
| O afogado que anda | chefe | 120 | o padrão | Guerreiro | **captura** | 80 | 100 a 150 de ouro; item (sempre): Cajado de brasa, Placas do guardião, Sinete do rei velho | 0/0/31/0 | 0/9/22/0 | 0/24/7/0 |

**Encruzilhada "A aldeia afundada".** Telhados saem da água parada: uma aldeia inteira afundou aqui. Do campanário vem um toque abafado, e na lama da margem há um rastro largo, de coisa arrastada.

| Opção | Postura | Requisito | Pista | Razoável para | Ruim para |
|---|---|---|---|---|---|
| Seguir o rastro na lama | Ousada | traço Rastreador | Quem arrasta as redes dos pescadores guarda em algum lugar o que tira delas; só olho treinado não perde um rastro desses na água. | Guerreiro + Guerreiro + Mago Nv5, com um Rastreador (passa em 90%) | Mago + Clérigo + Clérigo Nv1, com um Rastreador (passa em 0%) |
| Mergulhar até a capela do sino | Equilibrada | — | Fôlego e mão segura no escuro; o cofre das esmolas afundou com a capela. | Guerreiro + Guerreiro + Mago Nv5 (passa em 100%) | Guerreiro + Guerreiro + Mago Nv5, com um Rastreador (passa em 100%) |
| Recuar com o que têm | Cautelosa | — | Sem risco; o pântano fica com os segredos dele. | — | Guerreiro + Guerreiro + Mago Nv5, com um Rastreador (passa em 100%) |

Frases do relatório (sem a data, que abre todas: "No Nº dia da estação,"):

| Nó | Sucesso pleno | Sucesso | Revés | Desastre | Lição (quando falta a classe) |
|---|---|---|---|---|---|
| A balsa podre | {heroi} conduziu a balsa podre de margem a margem antes que ela se desfizesse, e a expedição de {feudo} entrou seca no pântano. | {heroi} segurou a balsa podre inteira o bastante para a expedição de {feudo} atravessar. | a balsa podre se abriu sob {heroi} no meio do canal: a expedição de {feudo} chegou a nado, tossindo lodo. | a balsa podre virou com {heroi}, e a expedição de {feudo} saiu do canal quebrada. | Um Arqueiro teria pulado para a margem a tempo de segurar a corda. |
| A noite da febre | {heroi} velou a expedição de {feudo} em uma noite de mosquitos e febre, e ao amanhecer todos estavam de pé. | {heroi} cuidou dos febris no acampamento do pântano, e a expedição de {feudo} seguiu de manhã. | a febre do pântano pegou {heroi} junto com os outros: a expedição de {feudo} seguiu tremendo. | a febre do pântano derrubou {heroi}, e a expedição de {feudo} amanheceu sem forças. | Um Clérigo teria baixado a febre antes do amanhecer. |
| A toca do que arrasta as redes | {heroi} matou na própria toca o que arrastava as redes, e a expedição de {feudo} achou ali o que ele tirara dos pescadores em anos. | {heroi} expulsou da toca o que arrastava as redes, e a expedição de {feudo} recolheu o que havia lá. | o que arrasta as redes puxou {heroi} para a água: a expedição de {feudo} largou metade do achado para puxar de volta. | o que arrasta as redes enrolou {heroi} na própria rede: a expedição de {feudo} foi desbaratada e deixou a toca sem nada. | Um Guerreiro teria ficado entre a toca e a equipe. |
| A capela debaixo da água | {heroi} mergulhou até a capela do sino e voltou com o cofre das esmolas inteiro, de um fôlego só. | {heroi} achou a capela debaixo da água, e a expedição de {feudo} içou o cofre das esmolas. | {heroi} ficou sem fôlego dentro da capela afundada: o cofre abriu na subida, e metade das esmolas voltou ao lodo. | {heroi} quase não voltou da capela afundada, e o cofre das esmolas ficou onde estava. | Um Arqueiro teria achado a porta da capela no escuro da água. |
| O afogado que anda | {heroi} devolveu o afogado que anda ao fundo, de onde ele não devia ter saído. A casa do senhor da aldeia ficou aberta para a expedição de {feudo}. | {heroi} segurou o afogado que anda enquanto a expedição de {feudo} tirava da casa grande o que ele guardava. | o afogado que anda não sentiu os golpes de {heroi}: a expedição de {feudo} recuou com o que estava à porta. | o afogado que anda abraçou {heroi} e foi andando para a água: a expedição de {feudo} foi desbaratada e não levou nada. | Um Guerreiro mais calejado teria aguentado o abraço do afogado. |
| A volta pelas estacas | a expedição de {feudo} saiu do Pântano Nebuloso pela trilha de estacas, com lama até a cintura. | | | | |

#### Pântano Nebuloso · variante C

```
oldDike  viagem 60 min  "O dique velho"  sem prova
callingFog  perigo 60 min  "O nevoeiro que chama pelo nome"  dificuldade 128
hangingTree  encruzilhada  "A árvore dos enforcados"   Cautelosa → retreat · Equilibrada → takeCanal · Ousada → liftCurse
  liftCurse) "Desfazer a maldição da árvore"  [requer um Clérigo]
      curse  perigo 60 min  "A maldição dos enforcados"  dificuldade 150
      mudSerpent  chefe 60 min  "A serpente do lodo"  dificuldade 134
      home  retorno 60 min  "A volta pelas estacas"
  takeCanal) "Passar ao largo, pelo canal"
      canal  encontro 60 min  "O canal escuro"  dificuldade 104
      → mudSerpent (acima)
  retreat) "Recuar com o que têm"
      → home (acima)
```

| Nó | Tipo | Dif. | Pesa | Favorece | No Desastre | XP | Rende (no Sucesso) | Fraca | Mínima | Com folga |
|---|---|---:|---|---|---|---:|---|---|---|---|
| O dique velho | viagem | — | — | — | — | — | — | — | — | — |
| O nevoeiro que chama pelo nome | perigo | 128 | vontade ×1 | Mago | fere gravemente | 45 | — | 2/26/3/0 | 1/26/4/0 | 17/14/0/0 |
| A maldição dos enforcados | perigo | 150 | vontade ×1,5, ataque ×0,5 | Clérigo | **captura** | 55 | 80 a 120 de ouro; item (1 em 3): Lâmina de Vel'Thar, Cota rebitada, Medalha do peregrino | 0/16/15/0 | 0/4/27/0 | 0/19/12/0 |
| O canal escuro | encontro | 104 | o padrão | Guerreiro | fere gravemente | 50 | 30 a 50 de ouro | 0/10/21/0 | 0/23/8/0 | 12/19/0/0 |
| A serpente do lodo | chefe | 134 | perícia ×0,5 | Guerreiro | **captura** | 80 | 100 a 150 de ouro; item (sempre): Cajado de brasa, Placas do guardião, Sinete do rei velho | 0/0/31/0 | 0/11/20/0 | 0/25/6/0 |

**Encruzilhada "A árvore dos enforcados".** No fim do dique há uma árvore morta, com cordas velhas nos galhos e oferendas entre as raízes. Um canal passa ao largo dela, estreito e escuro.

| Opção | Postura | Requisito | Pista | Razoável para | Ruim para |
|---|---|---|---|---|---|
| Desfazer a maldição da árvore | Ousada | um Clérigo | As oferendas são de quem pediu e não foi atendido; quem souber rezar pelos enforcados leva o que eles deixaram. | Mago + Clérigo + Clérigo Nv3 (passa em 37%) | Guerreiro + Arqueiro + Mago Nv1 (não pode) |
| Passar ao largo, pelo canal | Equilibrada | — | Água pela cintura e coisa que morde; quem vai na frente abre o caminho. | Guerreiro + Guerreiro + Mago Nv5 (passa em 100%) | Mago + Clérigo + Clérigo Nv3 (passa em 31%) |
| Recuar com o que têm | Cautelosa | — | Sem risco; o pântano fica com os segredos dele. | — | Guerreiro + Mago + Clérigo Nv5 (passa em 100%) |

Frases do relatório (sem a data, que abre todas: "No Nº dia da estação,"):

| Nó | Sucesso pleno | Sucesso | Revés | Desastre | Lição (quando falta a classe) |
|---|---|---|---|---|---|
| O dique velho | a expedição de {feudo} entrou no Pântano Nebuloso por cima do dique velho, com água dos dois lados. | | | | |
| O nevoeiro que chama pelo nome | {heroi} respondeu ao nevoeiro que chamava pelo nome, e foi o nevoeiro que se calou. A expedição de {feudo} seguiu pelo dique sem perder ninguém. | {heroi} mandou a expedição de {feudo} tapar os ouvidos e atravessou o nevoeiro que chama pelo nome. | {heroi} ouviu o próprio nome no nevoeiro e saiu do dique: a expedição de {feudo} perdeu horas procurando. | o nevoeiro chamou {heroi} pelo nome até o dique acabar debaixo dos pés, e a expedição de {feudo} saiu da água quebrada. | Um Mago teria reconhecido que a voz do nevoeiro não era de gente. |
| A maldição dos enforcados | {heroi} rezou pelos enforcados um a um, e as cordas caíram dos galhos. As oferendas entre as raízes ficaram para a expedição de {feudo}. | {heroi} aquietou a árvore dos enforcados o bastante para a expedição de {feudo} recolher as oferendas. | a prece de {heroi} falhou na metade: a árvore dos enforcados acordou, e a expedição de {feudo} correu com o que tinha nas mãos. | as cordas da árvore dos enforcados desceram sobre {heroi}: a expedição de {feudo} foi desbaratada e não tocou nas oferendas. | Um Clérigo teria sabido o nome de cada enforcado. |
| O canal escuro | {heroi} foi na frente pelo canal escuro e matou o que mordia. No lodo do fundo, a expedição de {feudo} achou a bolsa de um afogado. | {heroi} abriu o canal escuro para a expedição de {feudo}, a golpes na água. | algo mordeu {heroi} no canal escuro: a expedição de {feudo} saiu do outro lado mancando. | o canal escuro ferveu em volta de {heroi}, e a expedição de {feudo} saiu dele quebrada. | Um Guerreiro teria ido na frente, com a água pela cintura. |
| A serpente do lodo | {heroi} cravou a serpente do lodo no tronco em que ela se enrolava. No ninho, a expedição de {feudo} achou o que ela engolira com os viajantes. | {heroi} feriu a serpente do lodo, e ela largou o ninho para a expedição de {feudo}. | a serpente do lodo enrolou {heroi} e só soltou a troco de sangue: a expedição de {feudo} levou o que estava na beira do ninho. | a serpente do lodo arrastou {heroi} para dentro da água: a expedição de {feudo} foi desbaratada e fugiu sem nada. | Um Guerreiro mais calejado teria segurado a cabeça da serpente. |
| A volta pelas estacas | a expedição de {feudo} saiu do Pântano Nebuloso pela trilha de estacas, com lama até a cintura. | | | | |


### 6.9 Decisões editoriais e o conteúdo congelado (V3D-T3.8)

**O conteúdo do playtest é o deste commit**: `GET /v1/version` mostra o `contentHash`, que com o catálogo desta tarefa é **`71b9c1898cce602f`** (também na linha V3D-T3 do Registro de execução do [roadmap](roadmap-v0.3.md), §12). Qualquer mudança em um número ou em uma frase do conteúdo muda o hash: se o que está no ar disser outro, o conteúdo já não é o desta seção.

O que o agente decidiu ao escrever, para o autor rever:

1. **Cada modelo ensina uma coisa.** A Patrulha, que cada prova pede uma classe (cercas: braço; vau: perícia; estrada velha: vontade). A Floresta, que a equipe decide o caminho (a mata fechada é de dupla com Guerreiro; o riacho, de quem vai só). O Covil, que há três jeitos de acabar um serviço e só dois limpam a toca. O Resgate, que mandar gente fraca buscar um cativo pode deixar dois lá. As Ruínas, que dois heróis chegam ao guardião e três o vencem. O Pântano, que o chefe é o filtro.
2. **As variantes de um modelo não são a mesma coisa com outro nome**: mudam a classe que a jornada pede. Em todo modelo há prova de braço (Guerreiro), de perícia (Arqueiro), de vontade (Mago) e de ânimo (Clérigo: vontade ×1,5 com o ataque pesando metade).
3. **O caminho da Cautelosa nem sempre é recuar.** No Resgate, os três caminhos soltam o cativo (o seguro não rende mais nada); no Covil B, o seguro espalha a matilha sem limpar a toca; nas Ruínas C, cata a pedra do pátio. Onde é recuar, a pista diz o que se perde.
4. **O caminho ousado costuma estar fora do alcance da equipe mínima**, de propósito: é o que faz a Postura Ousada ser uma aposta, e é onde o Desastre e a captura moram.
5. **O Apêndice C do GDD foi recalibrado** (variante A das Ruínas): com 60 e 50, o Corredor era o melhor caminho para toda equipe. Ficou em 110 (Corredor, perícia ×1,5), 72 (Galeria, pede Guerreiro) e 92 (Guardião).
6. **A pendência A-6 foi fechada pelos guardiões**: 92 (pedra, braço), 116 (cripta, vontade) e 112 (sentinela, perícia). A dupla de referência (Guerreiro e Arqueiro de nível 2) nunca é capturada e quase sempre sai com Revés; uma dupla sem a classe que o guardião pede pode deixar alguém lá; três de nível 4 não.
7. **O Pântano não pede nível**, porque o catálogo do ADR não pede: três heróis de nível 1 com um Mago podem ir, e passam em uma de cada cinco.
8. **Dois requisitos de traço**: o duelo com o chefe do bando (Resgate C) pede um Corajoso, e o rastro na lama (Pântano B), um Rastreador. Sem o traço, a Postura Ousada cai no caminho seguro.
9. **A frase do Desastre da estrada velha (Patrulha C) nunca aparece**: nenhuma equipe de um herói chega ao Desastre ali. Fica no conteúdo para o dia em que a dificuldade mudar.
10. **As frases dizem "{heroi} caiu", e quem se fere pode ser outro**: quem se destaca é o de maior poder contra o nó, e quem sofre é sorteado. Em uma equipe de dois, a Crônica pode dizer "o lobo velho fez Edda recuar" e, na linha seguinte, "Rolf sofreu um ferimento leve".

## 7. Desfechos: os itens e as frases

**Rascunho, não lido pelo autor** (V3D-T2; pendência D-22). O catálogo de itens e as frases do que o desfecho faz ao herói e ao mundo. Os três grafos provisórios que esta seção descrevia (`wolfDen`, `rescue`, `ruins`) foram reescritos em V3D-T3 e estão na seção 6.

**Os identificadores ficam gravados no estado:** os modelos (`guild.expeditions[].modelId`, `hero.captivity.modelId`, `map.discovered`) e os doze itens de `ITEM_IDS` (`guild.inventory[].defId`, `hero.equipment`). Um teste de conteúdo fixa a lista dos itens; mudar um desses nomes pede passo de migração.

**Os itens** (`packages/content/src/items.ts`; ADR 0018, decisão 15): um por espaço e raridade, todos como fator do poder.

| Espaço | Comum (+5%, 30 de ouro) | Incomum (+8%, 60) | Raro (+12%, 120) | Épico (+15%, 250) |
|---|---|---|---|---|
| Arma | Lança de caça | Arco de freixo | Lâmina de Vel'Thar | Cajado de brasa |
| Armadura | Gibão acolchoado | Couro fervido | Cota rebitada | Placas do guardião |
| Acessório | Amuleto de osso | Corno de batedor | Medalha do peregrino | Sinete do rei velho |

Cada item tem uma frase de crônica, sem número ("Aço antigo, tirado das ruínas sem um ponto de ferrugem."). **Com o catálogo de V3D-T3 as quatro raridades são achadas**: os comuns na Floresta e no Covil, os incomuns no Covil e no Resgate, os raros nas Ruínas e no caminho ousado do Pântano, e os épicos com os três chefes do Pântano.

**As frases dos desfechos** (`chronicleTemplates`, `heroHarmTemplates`, `expeditionTexts`, `guildTexts`, `equipmentTexts`, `injurySeverities`, `itemSlots`, `itemRarities`): catorze eventos novos na Crônica (o ferimento leve, o grave e o que a dificuldade pôs no lugar da captura; a cura; a captura; a morte; o Resgate; o nível; o item achado, vendido, equipado e devolvido; o destino revelado; o Covil limpo e os lobos que voltam; a expedição que não voltou). **Nenhuma flexiona o herói** (servem a Edda e a Rolf: "sofreu um ferimento leve", "caiu em cativeiro", "tombou"), e um teste de conteúdo barra "ferido", "levado" e "pronto" nelas. As notas do relatório ("Edda ficou em cativeiro.", "Achado: Lança de caça.") e as frases do arsenal não escrevem número de regra.

**Frase de traço ajustada:** a do Carismático perdeu "abre caminhos no conselho" (é do lote 2 de cartas, V3F-T1) e ficou "Sabe negociar: barateia quem a Taverna oferece." As dos outros traços não mudaram: desde esta tarefa fazem o que dizem.

## 8. O que ficou para o lote 2

- As 16 cartas do lote 2 e os efeitos e requisitos novos delas (V3F-T1): requisito de traço ou de classe, destino revelado, efeito de preço, efeito com sorteio.
- Uma carta que **deixe de sair** conforme a equipe (por exemplo, só para quem não tem herói): hoje nenhum requisito de carta olha os heróis.
- Outros heróis com nome: `arrivingCap` (4) e o teste "só roteirizada dá herói" valem enquanto os heróis de carta forem poucos e de uma vez por partida.
