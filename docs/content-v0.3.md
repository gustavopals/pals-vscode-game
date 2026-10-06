# Conteúdo da v0.3: cartas do Conselho, heróis, Taverna e expedições

Data: 2026-10-05\
Tarefas: V3C-T3 do [roadmap da v0.3](roadmap-v0.3.md) (decisões 5 e 6 do [ADR 0017](decisions/0017-regras-da-v0.3-herois-taverna-e-soldo.md)) e V3C-T2 (a Taverna: decisões 4, 5 e 10; seção 5); o lote 2 entra aqui com V3F-T1; os dois grafos de expedição provisórios de V3D-T1 estão na seção 6\
Formato: a ficha da [§13.4 do roadmap da v0.3](roadmap-v0.3.md), que é a da v0.2 ([content-v0.2.md](content-v0.2.md)) com os campos de equipe e de herói

**Estado da curadoria: rascunho, não lido pelo autor.** A carta deste documento foi escrita pelo agente e entrou no jogo sem aprovação: o autor escolheu "escrevo e sigo; você revisa depois" ([ADR 0018](decisions/0018-expedicoes-mercado-mestres-e-cartas-na-v0.3.md); pendência A-7 de [pendencias-v0.3.md](pendencias-v0.3.md)). Texto, números e nomes são conteúdo, e trocar qualquer um deles é editar `packages/content/src/cards/scripted.ts` ou `heroes.ts` e regravar os goldens. **Os identificadores não:** `woundedStranger`, `shelter`, `tend`, `edda` e `rolf` ficam gravados no estado das partidas e estão fixados em `packages/content/src/council.test.ts`; mudar um deles depois de publicado pede passo de migração.

Onde este documento e o código divergirem, vale o código.

## Índice

1. [O que a v0.3 acrescenta ao catálogo](#1-o-que-a-v03-acrescenta-ao-catálogo)
2. [Regras editoriais novas](#2-regras-editoriais-novas)
3. [Fichas das cartas](#3-fichas-das-cartas)
4. [Heróis com nome](#4-heróis-com-nome)
5. [A Taverna: candidatos, nomes e frases](#5-a-taverna-candidatos-nomes-e-frases)
6. [Expedições: os dois grafos provisórios](#6-expedições-os-dois-grafos-provisórios)
7. [O que ficou para o lote 2](#7-o-que-ficou-para-o-lote-2)

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

## 6. Expedições: os dois grafos provisórios

**Rascunho, não lido pelo autor, e provisório** (V3D-T1; pendência D-12). São os grafos de teste que o motor das expedições pede para ter o que percorrer: **o catálogo de verdade (os seis modelos do ADR 0018, três variantes cada, com as fichas da §13.4 do roadmap) é de V3D-T3**, que vai reescrever estes dois. Os títulos, as pistas e as frases são do agente. Os arquivos são `packages/content/src/missions/patrol.ts` e `oldForest.ts`; a lista, `expeditionModels`, em `expeditions.ts`.

**Os identificadores ficam gravados no estado** (`guild.expeditions[].modelId` e `nodeId`, o `optionId` de uma escolha no percurso, e os mesmos nos relatórios): `patrol` e `oldForest` são os nomes que o catálogo de V3D-T3 deve manter. As chaves de nó e de opção podem mudar com o catálogo novo sem passo de migração: a expedição em curso cujo nó o conteúdo deixar de ter volta para casa com o que juntou, e o registro de um nó sumido não aparece no relatório.

**O que vale para todo grafo** (`expeditionModelsSchema`, conferido contra `balance.expeditions.graph`): acíclico; todo caminho termina em um nó `return`; de 2 a 5 nós por caminho, contando o retorno e sem a encruzilhada; cada nó de 5 a 45 minutos de jogo; três variantes por modelo; toda encruzilhada marca a opção de cada Postura, e a da Cautelosa não tem requisito; todo nó com dificuldade marca o Desastre (`injury` ou `capture`) e traz a frase de cada desfecho; o saque é só de recursos, em faixas; a duração anunciada do modelo é a do caminho mais longo. Nenhuma frase fala de ferro, arma, relíquia, planta, unidade, presságio, Mestre ou Mercado.

| Modelo | `id` | Duração | Equipe | Risco | Guilda | Variantes |
|---|---|---:|---|---|---:|---|
| Patrulha dos Arredores | `patrol` | 15 min | 1 herói | Baixo | Nv1 | três, sem encruzilhada: um nó com dificuldade (10 min) e a volta (5 min) |
| Floresta Antiga | `oldForest` | 1 h | 1 a 2 heróis | Baixo a médio | Nv1 | três, com uma encruzilhada de três opções, uma delas pedindo uma classe |

**Patrulha dos Arredores.** A dificuldade fica em volta de 30, a que o ADR 0017 recomenda para um herói de nível 1 sozinho (com até 36, um Guerreiro tem ao menos Sucesso em 30 de 31 sortes).

| Variante | Nó | Tipo | Dificuldade | Peso do nó | Desastre | Saque |
|---:|---|---|---:|---|---|---|
| 0 | A ronda pelas cercas | encontro | 30 | — | ferimento | 15 a 25 de ouro |
| 1 | O vau do riacho | perigo | 28 | perícia ×1/2 | ferimento | 12 a 22 de ouro |
| 2 | Rastros na estrada velha | encontro | 32 | — | ferimento | 18 a 28 de ouro |

**Floresta Antiga, variantes 0 e 1.** As duas têm o mesmo primeiro trecho e a mesma encruzilhada, com ramos diferentes adiante: é o que o teste de névoa usa (duas expedições iguais até a encruzilhada dão a mesma visão).

```
trilha    travel      15 min   "A trilha sob os carvalhos"        10 a 20 de madeira
 └→ encruzilhada               "A trilha se divide"
        Postura: Cautelosa → c · Equilibrada → b · Ousada → a
      a) "Abrir caminho pela mata fechada"   requer um Guerreiro
            pista: madeira boa e pegadas grandes; é preciso quem abra o caminho no braço
          variante 0: encontro 25 min "O javali da mata fechada"   dificuldade 55 · 60 a 90 de madeira, 20 a 30 de ouro
          variante 1: encontro 25 min "Os lenhadores sem senhor"   dificuldade 58 · 70 a 100 de madeira, 10 a 20 de ouro
      b) "Seguir o riacho"
            pista: chão escorregadio e alguma lenha; quem tem perícia passa melhor
          variante 0: perigo 25 min "As pedras do riacho"          dificuldade 36 · perícia ×1/2 · 40 a 60 de madeira
          variante 1: descoberta 25 min "A cabana do carvoeiro"    sem dificuldade · 30 a 50 de madeira
      c) "Voltar com o que já têm"
            pista: sem risco; o saque fica pequeno
retorno   return      20 min   "A volta pela trilha"
```

**Floresta Antiga, variante 2.** Outra entrada e outra encruzilhada, com o requisito em uma classe diferente.

```
orla      travel      15 min   "A orla da floresta"                sem saque
 └→ encruzilhada               "O tronco oco"
        Postura: Cautelosa → c · Equilibrada → b · Ousada → a
      a) "Subir ao ninho"                    requer um Arqueiro
            pista: algo brilha lá em cima; é preciso olho e mão firme de arqueiro
          perigo 25 min "O ninho no alto"                          dificuldade 40 · perícia ×1 · 30 a 50 de ouro
      b) "Descer o barranco"
            pista: troncos caídos lá embaixo, e quem os derrubou talvez ainda esteja por perto
          encontro 25 min "O fundo do barranco"                    dificuldade 38 · 50 a 70 de madeira
      c) "Dar meia-volta"
            pista: sem risco; voltam de mãos quase vazias
retorno   return      20 min   "A volta pela trilha"
```

**O que estes grafos não têm, e o catálogo terá:** o teste editorial do ADR 0018 (para cada opção, um cenário em que ela é a escolha razoável e um em que é ruim; a da Equilibrada não ser a melhor para toda equipe) **não foi feito**; nenhum nó marca captura; nenhuma recompensa revela destino, dá item ou experiência (V3D-T2); a Floresta sozinha com a Postura Ousada é quase sempre Revés ou Desastre para um Guerreiro de nível 1 (42 contra 55), o que é intencional como exemplo de risco, não como balanceamento.

**As outras frases** (`expeditionPostures`, `expeditionOutcomes`, `expeditionTexts`, `expeditionTemplates`, e os seis modelos de frase da Crônica em `chronicleTemplates`): os nomes das Posturas (Cautelosa, Equilibrada, Ousada) e dos desfechos (Sucesso pleno, Sucesso, Revés, Desastre) são os do GDD; as frases da Guilda e da Crônica são do agente, e nenhuma escreve número de regra (o teste de conteúdo confere).

## 7. O que ficou para o lote 2

- As 16 cartas do lote 2 e os efeitos e requisitos novos delas (V3F-T1): requisito de traço ou de classe, destino revelado, efeito de preço, efeito com sorteio.
- Uma carta que **deixe de sair** conforme a equipe (por exemplo, só para quem não tem herói): hoje nenhum requisito de carta olha os heróis.
- Outros heróis com nome: `arrivingCap` (4) e o teste "só roteirizada dá herói" valem enquanto os heróis de carta forem poucos e de uma vez por partida.
