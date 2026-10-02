# Conteúdo da v0.2: o primeiro lote de cartas do Conselho

Data: 2026-10-02\
Tarefa: V2D-T2 do [roadmap da v0.2](roadmap-v0.2.md) (decisões 7, 8, 9 e 21 do [ADR 0014](decisions/0014-conselho-e-ameaca-na-v0.2.md)); a cadeia "A Promessa da Paliçada" entrou no jogo em V2E-T2\
Versão do conteúdo deste inventário: `2f8434b06481af37` (o `contentHash` de `GET /v1/version`; ver a seção 7)

**Estado da curadoria: todas as 21 cartas foram escritas pelo agente e aguardam a aprovação do autor, carta a carta.** Nenhuma foi lida pelo autor antes de entrar no jogo: a sessão de aprovação em lotes de cinco, que a tarefa pedia, não aconteceu (o autor pediu a versão inteira sem ela). As cartas estão no jogo como rascunho aprovável. Texto, custo e efeito de uma carta são conteúdo: trocar qualquer um deles é editar um arquivo de `packages/content/src/cards/` e regravar os goldens.

Este documento é o inventário do lote: a ficha de cada carta (a da §12.3 do roadmap), as regras editoriais que o lote segue, a cobertura medida e o que ficou para o lote seguinte. Onde ele e o código divergirem, vale o código: as fichas foram geradas a partir de `@lotg/content`, e os testes de `packages/content/src/council.test.ts` conferem as regras.

## Índice

1. [O lote em uma tabela](#1-o-lote-em-uma-tabela)
2. [Regras editoriais do lote](#2-regras-editoriais-do-lote)
3. [Fichas das cartas](#3-fichas-das-cartas)
4. [Cobertura: há assunto em toda audiência?](#4-cobertura-há-assunto-em-toda-audiência)
5. [A moral chega a 80?](#5-a-moral-chega-a-80)
6. [Limites conhecidos e o que fica para o lote 2](#6-limites-conhecidos-e-o-que-fica-para-o-lote-2)
7. [Versão do conteúdo](#7-versão-do-conteúdo)
8. [Como a cadeia da Paliçada entrou (V2E-T2)](#8-como-a-cadeia-da-paliçada-entrou-v2e-t2)

## 1. O lote em uma tabela

São **21 modelos**: 3 cadeias de 3 cartas e 12 avulsas. **As 21 estão em `@lotg/content`** e saem no jogo: as 3 da cadeia "A Promessa da Paliçada" entraram com o edifício dela (V2E-T2; a seção 8 conta o que mudou na entrada).

| # | Carta | Tipo | Quando sai | No jogo | Curadoria |
|---:|---|---|---|---|---|
| 1 | Tábuas para as reservas | Cadeia "O Celeiro Comum", 1/3 | Com o Celeiro; uma vez por ano | sim | escrita pelo agente; aguarda aprovação do autor |
| 2 | A vez de repartir | Cadeia "O Celeiro Comum", 2/3 | Continuação | sim | idem |
| 3 | O que ficou da escolha | Cadeia "O Celeiro Comum", 3/3 | Continuação | sim | idem |
| 4 | A ponte que o degelo levou | Cadeia "A Ponte do Degelo", 1/3 | Primavera e verão; uma vez por ano | sim | idem |
| 5 | A laje no leito do riacho | Cadeia "A Ponte do Degelo", 2/3 | Continuação | sim | idem |
| 6 | A passagem volta a servir | Cadeia "A Ponte do Degelo", 3/3 | Continuação | sim | idem |
| 7 | Os aldeões pedem uma cerca | Cadeia "A Promessa da Paliçada", 1/3 | Salão no nível 3; uma vez por ano | sim (desde V2E-T2) | idem |
| 8 | O prazo da paliçada | Cadeia "A Promessa da Paliçada", 2/3 | Continuação | sim (desde V2E-T2) | idem |
| 9 | A palavra do senhor | Cadeia "A Promessa da Paliçada", 3/3 | Continuação | sim (desde V2E-T2) | idem |
| 10 | A refeição dos pedreiros | Avulsa recorrente | Qualquer estação | sim | idem |
| 11 | A serraria e o descanso | Avulsa recorrente | Qualquer estação | sim | idem |
| 12 | Vigília entre vizinhos | Avulsa recorrente | Qualquer estação | sim | idem |
| 13 | Mais bocas à mesa | Avulsa recorrente | Qualquer estação | sim | idem |
| 14 | O poço entulhado | Avulsa | Qualquer estação; uma vez por ano | sim | idem |
| 15 | Sementes para o próximo campo | Avulsa | Primavera | sim | idem |
| 16 | A notícia da primavera | Avulsa | Primavera | sim | idem |
| 17 | A mesa dos aprendizes | Avulsa | Verão e outono | sim | idem |
| 18 | O celeiro quase cheio | Avulsa | Verão e outono, com o Celeiro e a moral em 60 ou mais | sim | idem |
| 19 | Lenha ainda úmida | Avulsa | Outono | sim | idem |
| 20 | Um teto antes do frio | Avulsa | Outono | sim | idem |
| 21 | A colheita de todos | Avulsa | Outono, com a moral em 40 ou mais | sim | idem |

As cartas 1 a 3, a 10 e a 14 vieram de V2D-T1 e foram revistas aqui (o que mudou está na seção 2). Nenhuma carta é roteirizada (decisão 8): a que entrega o primeiro herói fica para a v0.3.

Estágios da curadoria (roadmap §12.3): rascunho → cenário validado → aprovado → implementado → observado no playtest. As 21 estão em "implementado" **sem ter passado por "aprovado"**: as 18 primeiras desde V2D-T2, e as 3 da Paliçada desde V2E-T2, com o cenário de cada ramificação em `packages/engine/src/council.chains.test.ts`.

## 2. Regras editoriais do lote

O que o agente decidiu ao escrever, e que o autor pode rever. Cada regra tem um teste em `packages/content/src/council.test.ts`.

**Tom e forma.** Situação em 2 a 4 frases curtas, tom de crônica, sem número nenhum no texto. Opção com verbo no infinitivo, sem número (o custo aparece ao lado, vindo de `cost`). Toda opção tem pista. Toda frase da Crônica começa pela data e cita o feudo. Nenhuma frase fala de herói, mapa, Mercado, ferro, exército ou combate, nem traz nome de flag.

**Um dilema humano por carta.** Vizinhos com medo, viajantes no portão, rapazes que querem aprender, famílias no palheiro: cada carta tem gente, não só números. A linha "Dilema" de cada ficha diz qual é.

**Quem falta não é punido (Camponês e Senhor).** Nas cartas que o sorteio traz, a opção que o conselho aplica sozinho em Camponês e em Senhor **nunca tira recurso nem moral, nem depois**: quem não responde perde a oportunidade, e só. É a regra 5 da lista de diversão do GDD (§15.1: "faltar nunca destrói nada fora de Rei de Ferro") aplicada ao Conselho. A medida que a motivou: com uma opção automática de −5 de moral, uma carta expirada no meio de uma fome levava a moral de 28 a 23 e abria o sorteio de quem vai embora. Em **Rei de Ferro** o conselho aplica a opção mais dura das que não têm custo, quando há duas.

- Consequência: **Camponês e Senhor decidem igual em todas as cartas do lote.** Toda carta tem no máximo duas opções sem custo, e a outra é a dura. A linha "Cartas: opção automática" da tabela de dificuldades do GDD (§12.1) distingue as três; no lote 1 só Rei de Ferro se distingue. Fica como pergunta ao autor.
- Nas **continuações** a regra é outra: a carta só chega porque o senhor escolheu algo antes, e a conta dessa escolha pode custar moral mesmo sem resposta. Só a cadeia da Paliçada cobra: quem promete, não ergue nada e não volta paga a promessa quebrada (−15 em Camponês e em Senhor, −10 em Rei de Ferro).
- **Quem cumpriu não paga por faltar.** Uma carta pode marcar uma opção com requisito que o conselho aplica quando o prazo acaba **e o feudo já tem o que ela exige** (`autoResolveIfUnlocked`), em qualquer dificuldade. As três cartas da Paliçada marcam "Mostrar a paliçada": com a obra de pé, a promessa se cumpre mesmo sem o senhor na sala, e a Crônica nunca diz que a cerca "não saiu" diante de quem a vê. A tela mostra a mesma coisa antes ("se ninguém responder: mostrar a paliçada erguida").

**Nenhuma opção domina no papel.** Toda carta do sorteio tem ao menos uma opção com custo ou requisito. Entre duas opções sem custo, nenhuma é melhor em tudo o que a tela mostra (a que parece melhor esconde um efeito ou leva a história adiante). Toda opção paga dá algo que a sem custo não dá. Os cenários de cada ficha dizem quando cada opção é a escolha razoável e quando é ruim.

**A ordem das opções.** Primeiro as pagas (ou trancadas por um edifício), depois a que não custa nem arrisca (a de Senhor), por último a dura (a de Rei de Ferro). Quem lê de cima para baixo vê primeiro o que pode comprar.

**Quatro tipos de troca.** Recurso por moral (o poço, o descanso, as festas); agora por depois (as sementes, as lições, a hospedagem: paga-se hoje, o ganho vem em dias); certo por incerto com pista (deixar o poço, dizer que é só o vento, os pilares de pedra); e um recurso por outro (grão por lenha, pedra de amolar por madeira).

**Efeito oculto sempre com pista, sempre em dias.** Onze opções escondem um efeito; ele acontece de 2 a 5 viradas de dia depois e só então vira linha da Crônica. A pista diz a direção ("volta dobrado", "o que ronda costuma voltar"), nunca o número. Quando o efeito cai depois que a continuação chega (os pilares de pedra da Ponte), ele pode acontecer com ela ainda na mesa, e as frases das duas são escritas para as duas ordens: nenhuma diz "a primeira" de nada. Um teste lista essas opções, e opção nova nessa situação só entra depois da mesma revisão.

**Cartas recorrentes e a ronda.** O ano tem 21 audiências e o lote tem 10 cartas de uma vez por ano no sorteio: sem recorrentes o Conselho ficaria sem assunto no outono. Quatro avulsas são recorrentes, sem estação nem edifício: os assuntos de sempre. Para a mesma não vir duas vezes seguidas, cada uma grava a própria flag (`routine.<carta>`) em todas as opções e apaga as das outras três: uma recorrente só volta depois de outra recorrente ter passado pela mesa. É conteúdo puro, sem regra nova no motor. Em Camponês e Senhor, a opção automática de uma recorrente não mexe em nada: uma carta que pode expirar várias vezes por ano com o senhor fora não pinga prêmio nem castigo.

**Cadeias.** A continuação chega **2 dias de jogo** depois da escolha (4 quando a carta dá um prazo), e os efeitos de moral das cadeias duram **3 dias**: quem responde logo soma a moral de uma carta à da seguinte. O texto da continuação lembra a escolha anterior por variante de flag (IDEIA-03), e a primeira carta de cada cadeia, quando volta em outro ano, lembra como a história terminou (IDEIA-07). Cada cadeia tem saída para aceitar, recusar e expirar, e nenhuma deixa cobrança impossível.

**Cartas de estação lidas fora da estação.** O prazo de resposta é de 24 h reais, que no ritmo Rápido são 36 dias de jogo: uma carta do outono pode ser respondida no inverno. As frases da Crônica não afirmam a estação ("pela volta das cegonhas", não "pela primavera").

**O que mudou nas cinco cartas de V2D-T1.** Na cadeia do Celeiro: continuação em 2 dias (eram 3), moral por 3 dias (eram 2), e a primeira carta lembra o desfecho do ano anterior. "O poço entulhado": ceder a pedra dá +10 por 3 dias (eram +5 por 2), e mandar o povo cavar deixou de custar moral (é a opção de quem falta). "A refeição dos pedreiros" virou recorrente.

**O que o lote não faz** (ADR 0014, "O que uma carta pode fazer nesta versão"): nenhuma carta dá aldeão, experiência do ofício, edifício ou proteção. Dois temas da §12.2 do roadmap pediam isso e foram escritos sem: "Mais bocas à mesa" (os viajantes pagam a hospedagem com trabalho e seguem viagem; ninguém fica) e "A mesa dos aprendizes" (as lições rendem madeira e pedra dias depois, não experiência). "Um teto antes do frio" não é uma promessa com prazo: o motor só confere um edifício pela opção trancada, que serve à Paliçada (nasce no nível 0) e não às Habitações (nascem no nível 1). A promessa com prazo está na cadeia da Paliçada.

## 3. Fichas das cartas

Durações em **dias de jogo**. "Moral por N dias" conta em N viradas de dia. Os custos saem na hora da escolha; o que a opção esconde, na virada indicada. As frases da Crônica aparecem como estão no conteúdo, com os marcadores (`{dia}`, `{daEstacao}`, `{feudo}`, `{carta}`).

### 3.1 Cadeia "O Celeiro Comum"

Compartilhar agora ou conservar margem para as obras e o inverno. Três cartas; só a primeira é sorteada. Flags: `commonGranary.open` (cadeia em curso), `supported` ou `paid` (quem pagou o conserto), `shared` ou `reserved` (o exemplo dado), e os desfechos `stocked` e `gifted`, que ficam. O caminho de quem cede, reparte e deixa a colheita com as famílias passa por 65, 75 e 80 de moral.

#### Tábuas para as reservas (`commonGranaryPlanks`, v1)

- **Dilema:** Gastar com o celeiro de todos ou guardar a margem das obras.
- **Quando sai:** peso 3 no sorteio · uma vez por ano · todas as estações · exige o Celeiro no nível 1 · não sai com `commonGranary.open`.
- **Repetição e virada do ano:** Sai uma vez por ano e nunca com a cadeia aberta. No ano seguinte volta com outro texto, conforme a cadeia terminou.
- **Texto:** As prateleiras do celeiro cederam com a última carga. Os moradores propõem refazê-las antes que a próxima colheita chegue. A madeira usada ali fará falta nas obras do salão.
- **Texto com `commonGranary.gifted`:** As prateleiras do celeiro cederam outra vez. Os moradores, que não esqueceram a colheita deixada com eles, já vieram com os martelos. Falta a madeira, e ela fará falta nas obras do salão.
- **Texto com `commonGranary.stocked`:** As prateleiras do celeiro cederam outra vez, sob o peso do que as famílias lhe entregaram. Os moradores propõem refazê-las antes que a próxima colheita chegue. A madeira usada ali fará falta nas obras do salão.

| Opção | Custo e requisito | Consequência conhecida | Efeito oculto | Pista |
|---|---|---|---|---|
| **Ceder a madeira** (`cede`) | −40 madeira | +5 de moral por 3 dias de jogo | — | O conselho volta ao assunto quando as prateleiras estiverem de pé. |
| **Pagar o conserto** (`pay`) | −30 ouro | +5 de moral por 3 dias de jogo | — | Ouro traz carpinteiro de fora, e a madeira do feudo fica para as obras. |
| **Conservar as reservas** (`keep`) | sem custo | nenhuma | — | Nada se gasta, e o assunto morre aqui. |

- **Flags e continuação:**
  - Ceder a madeira: grava `commonGranary.open`; grava `commonGranary.supported`; agenda `commonGranaryShare` para 2 dias de jogo depois.
  - Pagar o conserto: grava `commonGranary.open`; grava `commonGranary.paid`; agenda `commonGranaryShare` para 2 dias de jogo depois.
- **Se ninguém responde (`autoResolve`):** Camponês: Conservar as reservas · Senhor: Conservar as reservas · Rei de Ferro: Conservar as reservas.
- **Crônica:**
  - Chegada com `commonGranary.gifted`: No {dia}º dia {daEstacao}, quem ficou com a colheita em {feudo} veio de martelo na mão oferecer o conserto do celeiro: {carta}.
  - Chegada com `commonGranary.stocked`: No {dia}º dia {daEstacao}, as prateleiras do celeiro de {feudo} cederam sob a contribuição das famílias, e o conselho voltou ao assunto: {carta}.
  - Ceder a madeira: No {dia}º dia {daEstacao}, o senhor de {feudo} cedeu madeira das obras ao celeiro. Os moradores pregaram tábuas até o anoitecer.
  - Pagar o conserto: No {dia}º dia {daEstacao}, o senhor de {feudo} pagou um carpinteiro de fora para refazer as prateleiras do celeiro. A madeira do feudo ficou para as obras.
  - Conservar as reservas: No {dia}º dia {daEstacao}, o senhor de {feudo} guardou a madeira e o ouro. O celeiro segue escorado com o que havia.
    - Ao expirar: No {dia}º dia {daEstacao}, o conselho de {feudo} esperou em vão pelo senhor e não mexeu nas reservas. O celeiro segue escorado com o que havia.
- **Cenários:**
  - Ceder a madeira. *Faz sentido:* A madeira sobra ou o Armazém está perto do limite; o senhor quer abrir a cadeia e somar a moral desta carta à da seguinte. *É ruim:* O inverno está à porta com a conta da lenha apertada, ou há uma obra esperando madeira.
  - Pagar o conserto. *Faz sentido:* O ouro está parado (nenhuma obra nem recruta o espera) e a madeira tem dono. *É ruim:* O Salão ou os recrutas esperam ouro.
  - Conservar as reservas. *Faz sentido:* Madeira e ouro têm dono: obra, lenha, recrutas. É a escolha do feudo que mal começou. *É ruim:* Há folga de madeira ou de ouro: perde-se a cadeia inteira, com o desfecho que dá comida ou moral de graça.

#### A vez de repartir (`commonGranaryShare`, v1)

- **Dilema:** Repartir a comida agora, pelo exemplo, ou guardá-la para o frio.
- **Quando sai:** só chega como continuação (peso 0 no sorteio) · qualquer estação.
- **Repetição e virada do ano:** Só chega como continuação, dois dias de jogo depois da escolha, em qualquer estação e em qualquer ano.
- **Texto:** O conserto do celeiro ficou pronto. Algumas famílias pedem uma refeição em comum para estrear as prateleiras; outras preferem guardar cada saco para o frio. O conselho quer saber que exemplo o senhor dá.
- **Texto com `commonGranary.supported`:** As prateleiras feitas com a madeira que o senhor cedeu já seguram a carga. Algumas famílias pedem uma refeição em comum para estreá-las; outras preferem guardar cada saco para o frio. O conselho quer saber que exemplo o senhor dá.
- **Texto com `commonGranary.paid`:** O carpinteiro pago pelo senhor entregou as prateleiras e seguiu viagem. Algumas famílias pedem uma refeição em comum para estreá-las; outras preferem guardar cada saco para o frio. O conselho quer saber que exemplo o senhor dá.

| Opção | Custo e requisito | Consequência conhecida | Efeito oculto | Pista |
|---|---|---|---|---|
| **Partilhar a comida** (`share`) | −30 comida | +10 de moral por 3 dias de jogo | — | Mesa farta hoje, um saco a menos no inverno. Quem come junto costuma lembrar. |
| **Guardar para o inverno** (`reserve`) | sem custo | nenhuma | — | Ninguém festeja, mas o frio respeita celeiro cheio. |

- **Flags e continuação:**
  - Partilhar a comida: grava `commonGranary.shared`; agenda `commonGranaryOutcome` para 2 dias de jogo depois.
  - Guardar para o inverno: grava `commonGranary.reserved`; agenda `commonGranaryOutcome` para 2 dias de jogo depois.
- **Se ninguém responde (`autoResolve`):** Camponês: Guardar para o inverno · Senhor: Guardar para o inverno · Rei de Ferro: Guardar para o inverno.
- **Crônica:**
  - Chegada com `commonGranary.supported`: No {dia}º dia {daEstacao}, a madeira cedida ao celeiro de {feudo} virou prateleira, e o conselho voltou ao assunto: {carta}.
  - Chegada com `commonGranary.paid`: No {dia}º dia {daEstacao}, o carpinteiro pago pelo senhor entregou as prateleiras do celeiro de {feudo}, e o conselho voltou ao assunto: {carta}.
  - Partilhar a comida: No {dia}º dia {daEstacao}, o senhor de {feudo} mandou abrir os sacos, e o feudo inteiro comeu à mesma mesa.
  - Guardar para o inverno: No {dia}º dia {daEstacao}, o senhor de {feudo} mandou guardar cada saco para o frio. Não houve festa nem queixa.
    - Ao expirar: No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} mandou guardar cada saco para o frio.
- **Cenários:**
  - Partilhar a comida. *Faz sentido:* A comida sobra ou o Celeiro está perto do limite; a moral da carta anterior ainda vale (soma 75) ou há outra carta na mesa para somar 80. *É ruim:* A despensa está curta, o inverno perto, ou os recrutas esperam comida.
  - Guardar para o inverno. *Faz sentido:* A comida está contada, ou é inverno. *É ruim:* O Celeiro está cheio e a comida vai ao chão: os 30 se perderiam de qualquer jeito, e a moral ficou na mesa.

#### O que ficou da escolha (`commonGranaryOutcome`, v1)

- **Dilema:** Ficar com a contribuição das famílias ou deixá-la com elas.
- **Quando sai:** só chega como continuação (peso 0 no sorteio) · qualquer estação.
- **Repetição e virada do ano:** Só chega como continuação. Fecha a cadeia: apaga as flags do caminho e grava como ela terminou, para a primeira carta lembrar no ano seguinte.
- **Texto:** As prateleiras resistiram à carga. Na mesa do conselho, a conversa volta à decisão sobre os mantimentos. As famílias oferecem ao celeiro uma parte da colheita.
- **Texto com `commonGranary.shared`:** As prateleiras resistiram à carga. Quem comeu à mesa do senhor não esqueceu: as famílias trazem agora uma parte da própria colheita. O conselho pergunta o que fazer com ela.
- **Texto com `commonGranary.reserved`:** As prateleiras resistiram à carga, e o saco guardado para o frio não precisou ser aberto. Aliviadas, as famílias oferecem ao celeiro uma parte da colheita. O conselho pergunta o que fazer com ela.

| Opção | Custo e requisito | Consequência conhecida | Efeito oculto | Pista |
|---|---|---|---|---|
| **Receber a contribuição** (`accept`) | sem custo | +40 comida | — | O que não couber no celeiro se perde. |
| **Deixar com as famílias** (`leave`) | sem custo | +10 de moral por 3 dias de jogo | — | Despensa cheia em cada casa alegra mais que celeiro cheio. |

- **Flags e continuação:**
  - Receber a contribuição: apaga `commonGranary.open`; apaga `commonGranary.supported`; apaga `commonGranary.paid`; apaga `commonGranary.shared`; apaga `commonGranary.reserved`; apaga `commonGranary.gifted`; grava `commonGranary.stocked`.
  - Deixar com as famílias: apaga `commonGranary.open`; apaga `commonGranary.supported`; apaga `commonGranary.paid`; apaga `commonGranary.shared`; apaga `commonGranary.reserved`; apaga `commonGranary.stocked`; grava `commonGranary.gifted`.
- **Se ninguém responde (`autoResolve`):** Camponês: Receber a contribuição · Senhor: Receber a contribuição · Rei de Ferro: Deixar com as famílias.
- **Crônica:**
  - Chegada com `commonGranary.shared`: No {dia}º dia {daEstacao}, quem comeu à mesa comum de {feudo} voltou com sacos às costas: {carta}.
  - Chegada com `commonGranary.reserved`: No {dia}º dia {daEstacao}, o saco guardado para o frio seguia fechado em {feudo}, e as famílias vieram ao conselho: {carta}.
  - Receber a contribuição: No {dia}º dia {daEstacao}, a contribuição das famílias subiu às prateleiras novas do celeiro de {feudo}.
    - Ao expirar: No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} recebeu a contribuição das famílias e a pôs nas prateleiras novas do celeiro.
  - Deixar com as famílias: No {dia}º dia {daEstacao}, o senhor de {feudo} deixou a colheita com quem a plantou. Falou-se disso em cada casa.
    - Ao expirar: No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} deixou a colheita com quem a plantou. Falou-se disso em cada casa.
- **Cenários:**
  - Receber a contribuição. *Faz sentido:* A comida faz falta e há lugar no Celeiro. *É ruim:* O Celeiro está cheio: o ganho é cortado, e a tela avisa antes.
  - Deixar com as famílias. *Faz sentido:* O Celeiro está cheio; a moral está a um passo dos 80 (com a mesa comum, chega lá); o feudo é grande, e 5% de produção por três dias valem mais que 40 de comida. *É ruim:* Há fome ou a despensa está no fim.

### 3.2 Cadeia "A Ponte do Degelo"

Gastar madeira, pagar ajuda com ouro ou adiar; no meio da obra, fazer direito, fazer barato ou desistir. Não há mapa, rota nem produção nova: a ponte existe na história, e o que ela rende é o que as cartas dizem. Flags: `thawBridge.open` (cadeia em curso), `timber` ou `hired` (quem começou a obra), e as duas que ficam: `piers` (a ponte de pedra: a primeira carta não volta mais) e `plank` (a pinguela: a carta volta no ano seguinte).

#### A ponte que o degelo levou (`thawBridgePlea`, v1)

- **Dilema:** Refazer a travessia com a madeira do feudo, com ouro, ou deixar para outro ano.
- **Quando sai:** peso 4 no sorteio · uma vez por ano · Primavera e Verão · não sai com `thawBridge.open` nem `thawBridge.piers`.
- **Repetição e virada do ano:** Sai uma vez por ano, na primavera ou no verão, e nunca com a cadeia aberta. Com a ponte de pedra feita, não volta mais; depois de uma pinguela, volta no ano seguinte com o texto que lembra que ela não resistiu.
- **Texto:** O degelo engrossou o riacho e levou o tabuleiro da ponte velha. Desde então os lavradores dão a volta pelo vau, com água pelo joelho e a carroça vazia. Pedem madeira para refazer a travessia.
- **Texto com `thawBridge.plank`:** A pinguela não resistiu às águas do degelo. Desde então os lavradores dão a volta pelo vau, com água pelo joelho e a carroça vazia. Pedem madeira para uma travessia que dure mais que um inverno.

| Opção | Custo e requisito | Consequência conhecida | Efeito oculto | Pista |
|---|---|---|---|---|
| **Ceder as vigas** (`timber`) | −40 madeira | +5 de moral por 3 dias de jogo | — | A obra começa. O riacho ainda tem o que dizer. |
| **Pagar carpinteiros de fora** (`hire`) | −40 ouro | +5 de moral por 3 dias de jogo | — | Gente de fora traz a própria madeira e cobra à vista. O riacho ainda tem o que dizer. |
| **Adiar a obra** (`postpone`) | sem custo | nenhuma | — | Nada se gasta. Os lavradores seguem pelo vau, e a ponte espera outro degelo. |

- **Flags e continuação:**
  - Ceder as vigas: grava `thawBridge.open`; grava `thawBridge.timber`; agenda `thawBridgeSlab` para 2 dias de jogo depois.
  - Pagar carpinteiros de fora: grava `thawBridge.open`; grava `thawBridge.hired`; agenda `thawBridgeSlab` para 2 dias de jogo depois.
- **Se ninguém responde (`autoResolve`):** Camponês: Adiar a obra · Senhor: Adiar a obra · Rei de Ferro: Adiar a obra.
- **Crônica:**
  - Chegada com `thawBridge.plank`: No {dia}º dia {daEstacao}, soube-se em {feudo} que o riacho levou a pinguela, e o conselho voltou ao assunto: {carta}.
  - Ceder as vigas: No {dia}º dia {daEstacao}, o senhor de {feudo} cedeu vigas das obras para a ponte do riacho. Os lavradores as levaram no ombro até a margem.
  - Pagar carpinteiros de fora: No {dia}º dia {daEstacao}, o senhor de {feudo} pagou carpinteiros de fora para refazer a ponte do riacho. Vieram com vigas, cordas e pressa.
  - Adiar a obra: No {dia}º dia {daEstacao}, o senhor de {feudo} deixou a ponte para depois. Os lavradores seguiram pelo vau.
    - Ao expirar: No {dia}º dia {daEstacao}, o conselho de {feudo} esperou em vão pelo senhor, e a ponte ficou para depois. Os lavradores seguiram pelo vau.
- **Cenários:**
  - Ceder as vigas. *Faz sentido:* A madeira sobra; o senhor quer a cadeia, que pode devolver em comida o que a ponte custou. *É ruim:* Há obra esperando madeira, ou o inverno está perto.
  - Pagar carpinteiros de fora. *Faz sentido:* O ouro está parado e a madeira tem dono. *É ruim:* O ouro está contado para os recrutas ou para o Salão.
  - Adiar a obra. *Faz sentido:* O feudo acabou de nascer e tudo tem dono. *É ruim:* Há folga: perde-se a cadeia (e o grão do campo de lá), e a carta só volta no ano seguinte.

#### A laje no leito do riacho (`thawBridgeSlab`, v1)

- **Dilema:** Fazer direito, fazer barato ou desistir no meio.
- **Quando sai:** só chega como continuação (peso 0 no sorteio) · qualquer estação.
- **Repetição e virada do ano:** Só chega como continuação. A flag da ponte de pedra e a da pinguela ficam gravadas e atravessam os anos.
- **Texto:** A obra da ponte parou no meio do riacho. Sob a lama do leito há uma laje que não deixa cravar as estacas. O mestre de obras vê dois caminhos, e o povo já fala em um terceiro.
- **Texto com `thawBridge.timber`:** As vigas que o senhor cedeu chegaram ao meio do riacho, e ali a obra parou. Sob a lama do leito há uma laje que não deixa cravar as estacas. O mestre de obras vê dois caminhos, e o povo já fala em um terceiro.
- **Texto com `thawBridge.hired`:** Os carpinteiros pagos pelo senhor avançaram até o meio do riacho, e ali a obra parou. Sob a lama do leito há uma laje que não deixa cravar as estacas. O mestre de obras vê dois caminhos, e o povo já fala em um terceiro.

| Opção | Custo e requisito | Consequência conhecida | Efeito oculto | Pista |
|---|---|---|---|---|
| **Assentar pilares de pedra** (`piers`) | −30 pedra | nenhuma | +90 comida, na 4ª virada de dia depois da escolha | Ponte de pedra aguenta carroça carregada, e mais de um degelo. |
| **Estender uma pinguela** (`plank`) | sem custo | nenhuma | — | Passa gente em fila; carroça, não. O próximo degelo dirá se ela fica. |
| **Largar a obra** (`abandon`) | sem custo | +30 madeira; −5 de moral por 2 dias de jogo | — | Recolhe-se a madeira que der, e o povo volta ao vau. |

- **Flags e continuação:**
  - Assentar pilares de pedra: grava `thawBridge.piers`; apaga `thawBridge.plank`; agenda `thawBridgeCrossing` para 2 dias de jogo depois.
  - Estender uma pinguela: grava `thawBridge.plank`; agenda `thawBridgeCrossing` para 2 dias de jogo depois.
  - Largar a obra: apaga `thawBridge.open`; apaga `thawBridge.timber`; apaga `thawBridge.hired`.
- **Se ninguém responde (`autoResolve`):** Camponês: Estender uma pinguela · Senhor: Estender uma pinguela · Rei de Ferro: Largar a obra.
- **Crônica:**
  - Chegada com `thawBridge.timber`: No {dia}º dia {daEstacao}, as vigas cedidas pelo senhor de {feudo} pararam no meio do riacho, e o conselho voltou ao assunto: {carta}.
  - Chegada com `thawBridge.hired`: No {dia}º dia {daEstacao}, os carpinteiros pagos pelo senhor de {feudo} pararam no meio do riacho, e o conselho voltou ao assunto: {carta}.
  - Assentar pilares de pedra: No {dia}º dia {daEstacao}, o senhor de {feudo} mandou assentar pilares de pedra sobre a laje do riacho. A ponte há de ver muitos degelos.
    - Efeito posterior: No {dia}º dia {daEstacao}, o grão do campo de lá começou a chegar a {feudo} pela ponte de pedra, carroça após carroça.
  - Estender uma pinguela: No {dia}º dia {daEstacao}, o senhor de {feudo} mandou contornar a laje com uma pinguela. Mais barata que a ponte, e mais estreita.
    - Ao expirar: No {dia}º dia {daEstacao}, sem palavra do senhor, o mestre de obras de {feudo} contornou a laje com uma pinguela. Mais barata que a ponte, e mais estreita.
  - Largar a obra: No {dia}º dia {daEstacao}, o senhor de {feudo} mandou largar a obra da ponte. Recolheu-se a madeira; os lavradores voltaram ao vau.
    - Ao expirar: No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} largou a obra da ponte. Recolheu-se a madeira; os lavradores voltaram ao vau.
- **Cenários:**
  - Assentar pilares de pedra. *Faz sentido:* A pedra sobra ou o Armazém está cheio; comida vai fazer falta em alguns dias; o senhor não quer refazer a ponte todo ano. *É ruim:* A pedra está contada para o Salão, ou o depósito de comida está cheio (os 90 seriam cortados).
  - Estender uma pinguela. *Faz sentido:* A pedra tem dono e o senhor quer fechar a história sem gastar mais. *É ruim:* A pedra sobra: ficam 90 de comida na mesa, e a carta volta no ano que vem.
  - Largar a obra. *Faz sentido:* A madeira faz falta agora (lenha, obra) e a moral tem folga. *É ruim:* A moral está na beira de uma faixa (fome, casas cheias); perde-se o desfecho.

#### A passagem volta a servir (`thawBridgeCrossing`, v1)

- **Dilema:** Inaugurar a travessia com festa ou sem ela.
- **Quando sai:** só chega como continuação (peso 0 no sorteio) · qualquer estação.
- **Repetição e virada do ano:** Só chega como continuação. Fecha a cadeia: saem as flags da obra; a da ponte de pedra ou a da pinguela fica.
- **Texto:** A travessia do riacho está pronta, e o povo já passa por ela. Falta saber se haverá festa. O conselho pergunta como o senhor quer inaugurá-la.
- **Texto com `thawBridge.piers`:** Os pilares de pedra que o senhor mandou assentar seguram a ponte nova, e as carroças já a experimentam. O povo quer saber se a travessia terá festa. O conselho pergunta como o senhor quer inaugurá-la.
- **Texto com `thawBridge.plank`:** A pinguela ficou pronta: passa gente em fila, e carroça nenhuma. Os lavradores levam os sacos às costas e não reclamam em voz alta. O conselho pergunta como o senhor quer inaugurá-la.
- **A ordem da história.** A carta chega 2 dias de jogo depois da escolha do meio e pode esperar 24 h reais na mesa; o grão que os pilares de pedra escondem cai na 4ª virada depois deles. Quem demora a responder vê o grão chegar antes da festa: na revisão das Fases D e E, isso aconteceu em 11 de 11 partidas do simulador em que os pilares foram escolhidos. Por isso nenhuma frase das duas cartas diz qual travessia foi a primeira, e o texto da carta não diz que as carroças esperam: elas já passam.

| Opção | Custo e requisito | Consequência conhecida | Efeito oculto | Pista |
|---|---|---|---|---|
| **Inaugurar a travessia com festa** (`feast`) | −40 comida | +15 de moral por 3 dias de jogo | — | Festa na travessia junta as duas margens, e a notícia segue pela estrada. |
| **Dispensar a cerimônia** (`quiet`) | sem custo | +5 de moral por 2 dias de jogo | — | A travessia serve do mesmo jeito. Só não vira história. |

- **Flags e continuação:**
  - Inaugurar a travessia com festa: apaga `thawBridge.open`; apaga `thawBridge.timber`; apaga `thawBridge.hired`.
  - Dispensar a cerimônia: apaga `thawBridge.open`; apaga `thawBridge.timber`; apaga `thawBridge.hired`.
- **Se ninguém responde (`autoResolve`):** Camponês: Dispensar a cerimônia · Senhor: Dispensar a cerimônia · Rei de Ferro: Dispensar a cerimônia.
- **Crônica:**
  - Chegada com `thawBridge.piers`: No {dia}º dia {daEstacao}, a ponte de {feudo} ficou pronta sobre os pilares de pedra que o senhor mandou assentar: {carta}.
  - Chegada com `thawBridge.plank`: No {dia}º dia {daEstacao}, a pinguela de {feudo} ficou pronta, estreita como foi pedida: {carta}.
  - Inaugurar a travessia com festa: No {dia}º dia {daEstacao}, o senhor de {feudo} inaugurou a travessia do riacho com pão e música. Dançou-se nas duas margens.
  - Dispensar a cerimônia: No {dia}º dia {daEstacao}, a travessia do riacho de {feudo} seguiu servindo, sem festa nem discurso.
    - Ao expirar: No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} deu a travessia do riacho por entregue, sem festa nem discurso.
- **Cenários:**
  - Inaugurar a travessia com festa. *Faz sentido:* A comida sobra; +15 por três dias leva o feudo a Orgulhoso (75) e, com qualquer outro efeito, aos 80. *É ruim:* A despensa está curta ou o inverno está perto.
  - Dispensar a cerimônia. *Faz sentido:* A comida está contada. *É ruim:* A comida sobra e a moral está a um passo dos 80.

### 3.3 Cadeia "A Promessa da Paliçada" (no jogo desde V2E-T2)

Comprometer-se cedo ou evitar uma promessa arriscada. A cadeia depende do edifício Paliçada e entrou com ele: está em `packages/content/src/cards/palisadePromise.ts`.

A carta não dá proteção nenhuma: quem protege é a Paliçada, erguida com as obras de sempre (200 de madeira e 50 de pedra, com o Salão no nível 3). A promessa rende +10 de moral na hora. No prazo (4 dias de jogo, mais as 24 h reais que a carta espera na mesa), quem mostra a obra ganha +15; quem pede mais alguns dias e mostra depois, +5; quem desfaz a promessa perde 10; quem adia e não cumpre, 15. São os números da carta 12 do Apêndice B do GDD ("+10 se construir, −15 se não"), com o prazo esticado para ninguém precisar voltar ao jogo só por causa dele. A opção "Mostrar a paliçada" aparece nas três cartas, trancada com o motivo enquanto o edifício não existe ("Requer a Paliçada."; com a obra em curso, "Requer a Paliçada, que ainda está em obras."): é assim que a carta confere a obra. Com a Paliçada de pé, é também a opção que o conselho aplica se a carta expirar (`autoResolveIfUnlocked`), nas três dificuldades.

Flags: `palisadePromise.open` (cadeia em curso) e os desfechos que ficam: `kept` (a primeira carta nunca mais volta) e `broken` (ela volta no ano seguinte, com o texto que lembra a promessa).

#### Os aldeões pedem uma cerca (`palisadePromisePlea`, v1)

- **Dilema:** Prometer proteção, com prazo, ou não se comprometer.
- **Quando sai:** peso 3 no sorteio · uma vez por ano · todas as estações · exige o Salão do Senhor no nível 3 · não sai com `palisadePromise.open` nem `palisadePromise.kept`.
- **Repetição e virada do ano:** Sai uma vez por ano, com o Salão no nível 3, e nunca com a cadeia aberta. Com a promessa cumprida, não volta mais; com a promessa quebrada, volta no ano seguinte lembrando dela.
- **Texto:** Há pegadas grandes na lama, junto aos currais, e as mães já não deixam as crianças buscar água sozinhas. Os aldeões pedem uma paliçada em volta do feudo. O conselho quer saber o que o senhor responde.
- **Texto com `palisadePromise.broken`:** Os aldeões voltam a pedir uma paliçada em volta do feudo. Lembram, sem levantar a voz, que ela já foi prometida uma vez. O conselho quer saber o que o senhor responde agora.

| Opção | Custo e requisito | Consequência conhecida | Efeito oculto | Pista |
|---|---|---|---|---|
| **Mostrar a paliçada erguida** (`show`) | requer a Paliçada | +10 de moral por 3 dias de jogo | — | Quem já fez não precisa prometer. |
| **Explicar que não é hora** (`explain`) | sem custo | nenhuma | — | Nada se promete e nada se deve. O medo continua do tamanho que está. |
| **Prometer a paliçada** (`promise`) | sem custo | +10 de moral por 3 dias de jogo | — | Promessa aquece hoje. O povo conta os dias, e cobra em quatro. |

- **Flags e continuação:**
  - Mostrar a paliçada erguida: apaga `palisadePromise.broken`; grava `palisadePromise.kept`.
  - Prometer a paliçada: grava `palisadePromise.open`; agenda `palisadePromiseDeadline` para 4 dias de jogo depois.
- **Se ninguém responde (`autoResolve`):** Camponês: Explicar que não é hora · Senhor: Explicar que não é hora · Rei de Ferro: Prometer a paliçada. **Com a Paliçada já erguida**, nas três dificuldades: Mostrar a paliçada erguida.
- **Crônica:**
  - Chegada com `palisadePromise.broken`: No {dia}º dia {daEstacao}, os aldeões de {feudo} voltaram a pedir a paliçada que um dia lhes foi prometida: {carta}.
  - Mostrar a paliçada erguida: No {dia}º dia {daEstacao}, o senhor de {feudo} levou os aldeões até a paliçada já erguida. Ninguém pediu mais nada.
    - Ao expirar: No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} levou os aldeões até a paliçada já erguida. Ninguém pediu mais nada.
  - Explicar que não é hora: No {dia}º dia {daEstacao}, o senhor de {feudo} explicou aos aldeões que a paliçada terá de esperar. Ouviram calados.
    - Ao expirar: No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} explicou aos aldeões que a paliçada terá de esperar. Ouviram calados.
  - Prometer a paliçada: No {dia}º dia {daEstacao}, o senhor de {feudo} prometeu aos aldeões uma paliçada em volta do feudo. Dormiu-se melhor naquela noite.
    - Ao expirar: No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} prometeu aos aldeões, em nome dele, uma paliçada em volta do feudo.
- **Cenários:**
  - Mostrar a paliçada erguida. *Faz sentido:* A Paliçada já está de pé: é moral de graça, e o assunto acaba. *É ruim:* Não se aplica sem a Paliçada: a opção fica trancada, com o motivo.
  - Explicar que não é hora. *Faz sentido:* O feudo não junta 200 de madeira e 50 de pedra tão cedo, ou a moral não aguenta uma promessa quebrada. *É ruim:* A obra cabe no estoque: prometer rende +10 agora e +15 no prazo.
  - Prometer a paliçada. *Faz sentido:* A Paliçada cabe no estoque ou vai caber em poucos dias: são +10 agora e +15 no prazo. *É ruim:* O material não vem: a promessa desfeita custa −10, e a adiada sem obra, −15.

#### O prazo da paliçada (`palisadePromiseDeadline`, v1)

- **Dilema:** Mostrar a obra, pedir prazo ou voltar atrás.
- **Quando sai:** só chega como continuação (peso 0 no sorteio) · qualquer estação.
- **Repetição e virada do ano:** Só chega como continuação, quatro dias de jogo depois da promessa.
- **Texto:** Passaram-se os dias da promessa. Os aldeões vieram ao salão sem pressa e sem sorriso, e olham para onde a paliçada devia estar. O conselho pergunta o que mostrar a eles.

| Opção | Custo e requisito | Consequência conhecida | Efeito oculto | Pista |
|---|---|---|---|---|
| **Mostrar a paliçada erguida** (`show`) | requer a Paliçada | +15 de moral por 3 dias de jogo | — | Palavra cumprida no prazo vale mais que a própria cerca. |
| **Pedir mais alguns dias** (`delay`) | sem custo | nenhuma | — | O povo espera mais quatro dias. Não espera uma terceira vez. |
| **Desfazer a promessa** (`withdraw`) | sem custo | −10 de moral por 3 dias de jogo | — | Dói agora, e acaba aqui. Quem adia e não cumpre paga mais caro. |

- **Flags e continuação:**
  - Mostrar a paliçada erguida: apaga `palisadePromise.open`; apaga `palisadePromise.broken`; grava `palisadePromise.kept`.
  - Pedir mais alguns dias: agenda `palisadePromiseReckoning` para 4 dias de jogo depois.
  - Desfazer a promessa: apaga `palisadePromise.open`; grava `palisadePromise.broken`.
- **Se ninguém responde (`autoResolve`):** Camponês: Pedir mais alguns dias · Senhor: Pedir mais alguns dias · Rei de Ferro: Desfazer a promessa. **Com a Paliçada erguida**, nas três dificuldades: Mostrar a paliçada erguida (a promessa foi cumprida, e o conselho a mostra pelo senhor).
- **Crônica:**
  - Chegada: No {dia}º dia {daEstacao}, os aldeões de {feudo} vieram cobrar a paliçada prometida: {carta}.
  - Mostrar a paliçada erguida: No {dia}º dia {daEstacao}, o senhor de {feudo} mostrou aos aldeões a paliçada que prometera. Passaram a mão nas estacas, um por um.
    - Ao expirar: No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} levou os aldeões até a paliçada prometida. Passaram a mão nas estacas, um por um.
  - Pedir mais alguns dias: No {dia}º dia {daEstacao}, o senhor de {feudo} pediu aos aldeões mais alguns dias para a paliçada. Concederam, contando nos dedos.
    - Ao expirar: No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} pediu aos aldeões mais alguns dias para a paliçada. Concederam, contando nos dedos.
  - Desfazer a promessa: No {dia}º dia {daEstacao}, o senhor de {feudo} desfez a promessa da paliçada diante dos aldeões. Saíram do salão sem se despedir.
    - Ao expirar: No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} desfez a promessa da paliçada. Os aldeões saíram do salão sem se despedir.
- **Cenários:**
  - Mostrar a paliçada erguida. *Faz sentido:* A Paliçada está de pé. A carta espera 24 h reais: dá tempo de erguê-la com a carta na mesa. *É ruim:* Não se aplica sem a Paliçada.
  - Pedir mais alguns dias. *Faz sentido:* Falta pouco para a obra: mais quatro dias (e mais 24 h reais) resolvem. *É ruim:* O material não vem: adiar e não cumprir custa −15, mais que desfazer agora.
  - Desfazer a promessa. *Faz sentido:* A obra não sai tão cedo: −10 certos, e o assunto acaba. *É ruim:* Falta pouco: pedir prazo não custa nada e ainda rende +5 ao mostrar a obra.

#### A palavra do senhor (`palisadePromiseReckoning`, v1)

- **Dilema:** A última chance de mostrar a obra.
- **Quando sai:** só chega como continuação (peso 0 no sorteio) · qualquer estação.
- **Repetição e virada do ano:** Só chega como continuação de quem pediu prazo. Fecha a cadeia.
- **Texto:** O segundo prazo também acabou. Os aldeões já não perguntam pela paliçada: perguntam se a palavra do senhor ainda vale. O conselho não tem mais dias para pedir.

| Opção | Custo e requisito | Consequência conhecida | Efeito oculto | Pista |
|---|---|---|---|---|
| **Mostrar a paliçada, enfim** (`show`) | requer a Paliçada | +5 de moral por 2 dias de jogo | — | Tarde, mas de pé. O povo perdoa atraso; não perdoa ausência. |
| **Explicar o atraso** (`admit`) | sem custo | −15 de moral por 3 dias de jogo | — | Explicação não é estaca. O povo ouve, e lembra. |

- **Flags e continuação:**
  - Mostrar a paliçada, enfim: apaga `palisadePromise.open`; apaga `palisadePromise.broken`; grava `palisadePromise.kept`.
  - Explicar o atraso: apaga `palisadePromise.open`; grava `palisadePromise.broken`.
- **Se ninguém responde (`autoResolve`):** Camponês: Explicar o atraso · Senhor: Explicar o atraso · Rei de Ferro: Explicar o atraso. **Com a Paliçada erguida**, nas três dificuldades: Mostrar a paliçada, enfim.
- **Crônica:**
  - Chegada: No {dia}º dia {daEstacao}, acabou o prazo que o senhor de {feudo} pedira para a paliçada: {carta}.
  - Mostrar a paliçada, enfim: No {dia}º dia {daEstacao}, o senhor de {feudo} mostrou enfim a paliçada prometida. Veio tarde, e veio.
    - Ao expirar: No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} mostrou enfim a paliçada prometida. Veio tarde, e veio.
  - Explicar o atraso: No {dia}º dia {daEstacao}, o senhor de {feudo} explicou por que a paliçada não saiu. Os aldeões ouviram até o fim, e ninguém respondeu.
    - Ao expirar: No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} tentou explicar por que a paliçada não saiu. Os aldeões ouviram até o fim, e ninguém respondeu.
- **Cenários:**
  - Mostrar a paliçada, enfim. *Faz sentido:* A Paliçada está de pé, ainda que tarde. *É ruim:* Não se aplica sem a Paliçada.
  - Explicar o atraso. *Faz sentido:* Não há obra a mostrar: é a única saída. *É ruim:* Com a Paliçada erguida, é jogar fora a promessa cumprida.

### 3.4 Avulsas recorrentes

Os assuntos de sempre do feudo: saem mais de uma vez por ano, em qualquer estação e com o feudo em qualquer estágio. Todas as opções gravam a flag da própria carta (`routine.<id>`) e apagam as das outras três: por isso as fichas abaixo não repetem essa lista opção por opção.

#### A refeição dos pedreiros (`masonsMeal`, v1)

- **Dilema:** Abrir a despensa para quem trabalha ou cobrar o dia de trabalho.
- **Quando sai:** peso 1 no sorteio · recorrente · todas as estações · não sai com `routine.masonsMeal`.
- **Repetição e virada do ano:** Recorrente: pode sair mais de uma vez por ano, nunca duas vezes seguidas entre as recorrentes.
- **Texto:** Os pedreiros largaram as ferramentas ao meio-dia. Pedem uma refeição quente antes de voltar à obra, e dizem que de barriga cheia o braço rende. A despensa é a mesma que alimenta o resto do feudo.

| Opção | Custo e requisito | Consequência conhecida | Efeito oculto | Pista |
|---|---|---|---|---|
| **Servir a refeição** (`feast`) | −40 comida; requer 100 de comida em estoque | +10 de moral por 2 dias de jogo | — | Barriga cheia, ânimo alto. |
| **Repartir o pão do dia** (`bread`) | sem custo | nenhuma | — | Nem festa, nem queixa. |
| **Mandar voltar ao trabalho** (`refuse`) | sem custo | +15 pedra; −5 de moral por 2 dias de jogo | — | A tarde rende mais pedra, e a obra guarda a mágoa. |

- **Flags e continuação:** só a ronda das recorrentes (as flags `routine.*`, descritas acima); nenhuma continuação.
- **Se ninguém responde (`autoResolve`):** Camponês: Repartir o pão do dia · Senhor: Repartir o pão do dia · Rei de Ferro: Mandar voltar ao trabalho.
- **Crônica:**
  - Chegada: a frase geral ("o conselho de {feudo} pediu audiência: {carta}").
  - Servir a refeição: No {dia}º dia {daEstacao}, o senhor de {feudo} mandou servir caldo e pão aos pedreiros. Cantou-se na obra até a tarde.
  - Repartir o pão do dia: No {dia}º dia {daEstacao}, os pedreiros de {feudo} repartiram o pão que havia e voltaram à obra.
    - Ao expirar: No {dia}º dia {daEstacao}, sem palavra do senhor, os pedreiros de {feudo} repartiram o pão que havia e voltaram à obra.
  - Mandar voltar ao trabalho: No {dia}º dia {daEstacao}, o senhor de {feudo} mandou os pedreiros de volta à obra sem almoço. A tarde rendeu pedra; o ânimo, não.
    - Ao expirar: No {dia}º dia {daEstacao}, sem palavra do senhor, o capataz de {feudo} mandou os pedreiros de volta à obra sem almoço. A tarde rendeu pedra; o ânimo, não.
- **Cenários:**
  - Servir a refeição. *Faz sentido:* A comida sobra (a opção pede 100 em estoque), o feudo é grande, ou há outra carta para somar moral. *É ruim:* A despensa está curta ou os recrutas esperam comida.
  - Repartir o pão do dia. *Faz sentido:* Tudo está contado. *É ruim:* A comida vai ao chão no depósito cheio: a refeição sairia de graça.
  - Mandar voltar ao trabalho. *Faz sentido:* Falta pedra para uma obra e a moral tem folga. *É ruim:* A moral está na beira de uma faixa.

#### A serraria e o descanso (`sawmillRest`, v1)

- **Dilema:** Dar descanso, investir nas serras ou manter o ritmo.
- **Quando sai:** peso 1 no sorteio · recorrente · todas as estações · não sai com `routine.sawmillRest`.
- **Repetição e virada do ano:** Recorrente: pode sair mais de uma vez por ano, nunca duas vezes seguidas entre as recorrentes.
- **Texto:** Os lenhadores pedem um dia de descanso. As serras estão cegas e os braços, pesados. O capataz avisa que serra parada não junta lenha.

| Opção | Custo e requisito | Consequência conhecida | Efeito oculto | Pista |
|---|---|---|---|---|
| **Conceder o descanso** (`rest`) | −30 madeira | +10 de moral por 2 dias de jogo | — | Braço descansado volta ao machado de boa vontade. |
| **Mandar afiar as serras** (`sharpen`) | −15 pedra | nenhuma | +45 madeira, na 2ª virada de dia depois da escolha | Serra afiada corta por duas. O ganho aparece em poucos dias, se houver onde guardar. |
| **Manter o ritmo** (`keep`) | sem custo | nenhuma | — | Nada se gasta. O cansaço fica para outro dia. |

- **Flags e continuação:** só a ronda das recorrentes (as flags `routine.*`, descritas acima); nenhuma continuação.
- **Se ninguém responde (`autoResolve`):** Camponês: Manter o ritmo · Senhor: Manter o ritmo · Rei de Ferro: Manter o ritmo.
- **Crônica:**
  - Chegada: a frase geral ("o conselho de {feudo} pediu audiência: {carta}").
  - Conceder o descanso: No {dia}º dia {daEstacao}, o senhor de {feudo} deu um dia de descanso aos lenhadores. A serraria calou, e ouviu-se riso na praça.
  - Mandar afiar as serras: No {dia}º dia {daEstacao}, o senhor de {feudo} mandou buscar pedra de amolar. Os lenhadores passaram o dia afiando, sentados, em vez de descansar.
    - Efeito posterior: No {dia}º dia {daEstacao}, as serras afiadas de {feudo} mostraram o fio: saiu da mata mais madeira do que se esperava.
  - Manter o ritmo: No {dia}º dia {daEstacao}, o senhor de {feudo} mandou os lenhadores de volta à mata. A serraria não parou.
    - Ao expirar: No {dia}º dia {daEstacao}, sem palavra do senhor, o capataz de {feudo} manteve os lenhadores na mata. A serraria não parou.
- **Cenários:**
  - Conceder o descanso. *Faz sentido:* A madeira sobra ou o Armazém está cheio; há outra carta para somar moral. *É ruim:* O inverno está à porta ou há obra esperando madeira.
  - Mandar afiar as serras. *Faz sentido:* A pedra sobra e a madeira vai fazer falta em alguns dias (a lenha do inverno). *É ruim:* A pedra está contada, ou o Armazém está cheio de madeira (o ganho seria cortado).
  - Manter o ritmo. *Faz sentido:* Madeira e pedra têm dono. *É ruim:* Qualquer uma das duas sobra.

#### Vigília entre vizinhos (`neighborsWatch`, v1)

- **Dilema:** Gastar lenha com o medo dos vizinhos, pedir esforço, ou acalmar com palavras.
- **Quando sai:** peso 1 no sorteio · recorrente · todas as estações · não sai com `routine.neighborsWatch`.
- **Repetição e virada do ano:** Recorrente: pode sair mais de uma vez por ano, nunca duas vezes seguidas entre as recorrentes.
- **Texto:** Há três noites algo ronda os currais, e ninguém viu o quê. Os vizinhos querem revezar a vigília e pedem lenha para as fogueiras. Quem vela de noite boceja no trabalho de dia.

| Opção | Custo e requisito | Consequência conhecida | Efeito oculto | Pista |
|---|---|---|---|---|
| **Ceder lenha para as fogueiras** (`fires`) | −25 madeira | +5 de moral por 3 dias de jogo | — | Fogueira acesa afasta o medo, e o que mais rondar. |
| **Revezar a vigília no escuro** (`vigil`) | sem custo | nenhuma | — | Sem fogueira vela-se do mesmo jeito: com mais frio e menos conversa. |
| **Dizer que é só o vento** (`wind`) | sem custo | +5 de moral por 1 dia de jogo | −20 comida, na 2ª virada de dia depois da escolha | A palavra do senhor acalma por uma noite. O que ronda costuma voltar. |

- **Flags e continuação:** só a ronda das recorrentes (as flags `routine.*`, descritas acima); nenhuma continuação.
- **Se ninguém responde (`autoResolve`):** Camponês: Revezar a vigília no escuro · Senhor: Revezar a vigília no escuro · Rei de Ferro: Dizer que é só o vento.
- **Crônica:**
  - Chegada: a frase geral ("o conselho de {feudo} pediu audiência: {carta}").
  - Ceder lenha para as fogueiras: No {dia}º dia {daEstacao}, o senhor de {feudo} cedeu lenha para as fogueiras da vigília. Os vizinhos velaram juntos, e nada chegou perto dos currais.
  - Revezar a vigília no escuro: No {dia}º dia {daEstacao}, os vizinhos de {feudo} revezaram a vigília no escuro, cada qual com o seu cajado. Nada sumiu dos currais.
    - Ao expirar: No {dia}º dia {daEstacao}, sem palavra do senhor, os vizinhos de {feudo} revezaram a vigília no escuro, cada qual com o seu cajado. Nada sumiu dos currais.
  - Dizer que é só o vento: No {dia}º dia {daEstacao}, o senhor de {feudo} disse aos vizinhos que era só o vento. Dormiu-se bem naquela noite.
    - Ao expirar: No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} disse aos vizinhos que era só o vento. Dormiu-se bem naquela noite.
    - Efeito posterior: No {dia}º dia {daEstacao}, o que rondava os currais de {feudo} voltou, e não era o vento: raposa, pelo rastro. Foram-se galinhas e um saco de grão.
- **Cenários:**
  - Ceder lenha para as fogueiras. *Faz sentido:* A madeira sobra; +5 por três dias soma com a carta seguinte. *É ruim:* A lenha está contada, no outono ou no inverno.
  - Revezar a vigília no escuro. *Faz sentido:* A madeira está contada e não há por que arriscar. *É ruim:* A madeira sobra.
  - Dizer que é só o vento. *Faz sentido:* O depósito de comida está cheio (20 a menos não fazem falta) e +5 hoje fecha os 80 com outro efeito. *É ruim:* A comida está curta: a perda vem em dois dias.

#### Mais bocas à mesa (`moreMouths`, v1)

- **Dilema:** Acolher, ajudar de passagem ou fechar o portão.
- **Quando sai:** peso 1 no sorteio · recorrente · todas as estações · não sai com `routine.moreMouths`.
- **Repetição e virada do ano:** Recorrente: pode sair mais de uma vez por ano, nunca duas vezes seguidas entre as recorrentes.
- **Texto:** Uma família de viajantes parou ao portão, com fome e pó da estrada. Pedem abrigo por algumas noites e oferecem os braços em troca. A despensa do feudo não cresce com as visitas.

| Opção | Custo e requisito | Consequência conhecida | Efeito oculto | Pista |
|---|---|---|---|---|
| **Acolher por uns dias** (`host`) | −40 comida; requer 100 de comida em estoque | +5 de moral por 2 dias de jogo | +30 madeira, +20 pedra, na 3ª virada de dia depois da escolha | Hóspede agradecido costuma pagar com os braços antes de seguir viagem. |
| **Dar provisões para a estrada** (`provide`) | −15 comida | +5 de moral por 2 dias de jogo | — | Quem segue viagem de barriga cheia fala bem do feudo. |
| **Fechar o portão** (`close`) | sem custo | nenhuma | — | Portão fechado não gasta pão, e não faz amigos. |

- **Flags e continuação:** só a ronda das recorrentes (as flags `routine.*`, descritas acima); nenhuma continuação.
- **Se ninguém responde (`autoResolve`):** Camponês: Fechar o portão · Senhor: Fechar o portão · Rei de Ferro: Fechar o portão.
- **Crônica:**
  - Chegada: a frase geral ("o conselho de {feudo} pediu audiência: {carta}").
  - Acolher por uns dias: No {dia}º dia {daEstacao}, o senhor de {feudo} abriu o portão aos viajantes. Houve mais bocas à mesa, e mais braços no trabalho.
    - Efeito posterior: No {dia}º dia {daEstacao}, os viajantes acolhidos em {feudo} seguiram estrada. Antes, pagaram a hospedagem com trabalho: lenha rachada e pedra carregada.
  - Dar provisões para a estrada: No {dia}º dia {daEstacao}, o senhor de {feudo} deu pão e queijo aos viajantes, e eles seguiram estrada agradecidos.
  - Fechar o portão: No {dia}º dia {daEstacao}, o senhor de {feudo} mandou fechar o portão. Os viajantes seguiram estrada sem olhar para trás.
    - Ao expirar: No {dia}º dia {daEstacao}, ninguém em {feudo} abriu o portão aos viajantes. Eles seguiram estrada sem olhar para trás.
- **Cenários:**
  - Acolher por uns dias. *Faz sentido:* A comida sobra (a opção pede 100 em estoque) e madeira ou pedra fazem falta. *É ruim:* A despensa está curta, ou o Armazém está cheio (o trabalho dos hóspedes seria cortado).
  - Dar provisões para a estrada. *Faz sentido:* Há comida para ser generoso, mas não para hospedar. *É ruim:* A comida está contada para os recrutas.
  - Fechar o portão. *Faz sentido:* Há fome ou a despensa está no fim. *É ruim:* A comida sobra.

### 3.5 Avulsas de uma vez por ano

#### O poço entulhado (`collapsedWell`, v1)

- **Dilema:** Gastar pedra com o poço, resolver no braço ou deixar desabar.
- **Quando sai:** peso 2 no sorteio · uma vez por ano · todas as estações.
- **Repetição e virada do ano:** Sai uma vez por ano, em qualquer estação.
- **Texto:** A boca do poço da praça cedeu durante a noite. As mulheres já descem ao riacho com os baldes, e a fila cresce. O mestre de obras pede pedra para refazer a mureta.

| Opção | Custo e requisito | Consequência conhecida | Efeito oculto | Pista |
|---|---|---|---|---|
| **Ceder a pedra** (`repair`) | −30 pedra | +10 de moral por 3 dias de jogo | — | Mureta bem assentada dura mais que a queixa. |
| **Mandar o povo cavar** (`dig`) | sem custo | nenhuma | — | Sem pedra nova, a mureta fica como der. A água volta, e é só. |
| **Deixar para depois** (`wait`) | sem custo | nenhuma | +20 pedra; −10 de moral por 2 dias de jogo, na 2ª virada de dia depois da escolha | O riacho fica longe, e o povo tem memória. Dizem que no entulho ainda há pedra boa. |

- **Flags e continuação:** nenhuma.
- **Se ninguém responde (`autoResolve`):** Camponês: Mandar o povo cavar · Senhor: Mandar o povo cavar · Rei de Ferro: Deixar para depois.
- **Crônica:**
  - Chegada: a frase geral ("o conselho de {feudo} pediu audiência: {carta}").
  - Ceder a pedra: No {dia}º dia {daEstacao}, o senhor de {feudo} cedeu pedra para o poço da praça. A água voltou antes do segundo dia.
  - Mandar o povo cavar: No {dia}º dia {daEstacao}, o senhor de {feudo} mandou o povo desentulhar o poço com as próprias mãos. A água voltou, e a mureta ficou como deu.
    - Ao expirar: No {dia}º dia {daEstacao}, sem palavra do senhor, o povo de {feudo} desentulhou o poço com as próprias mãos. A água voltou, e a mureta ficou como deu.
  - Deixar para depois: No {dia}º dia {daEstacao}, o senhor de {feudo} deixou o poço como estava. O povo seguiu descendo ao riacho.
    - Ao expirar: No {dia}º dia {daEstacao}, ninguém em {feudo} decidiu nada sobre o poço. O povo seguiu descendo ao riacho.
    - Efeito posterior: No {dia}º dia {daEstacao}, o poço de {feudo} desabou de vez. Do entulho saiu pedra de cantaria; da fila do riacho, só queixa.
- **Cenários:**
  - Ceder a pedra. *Faz sentido:* A pedra sobra; +10 por três dias dura até a carta seguinte e soma com ela. *É ruim:* O Salão ou o Armazém esperam pedra.
  - Mandar o povo cavar. *Faz sentido:* A pedra está contada e a moral está na beira de uma faixa. *É ruim:* A pedra sobra (ceder rende moral) ou a pedra falta e a moral tem folga (deixar para depois rende 20).
  - Deixar para depois. *Faz sentido:* Falta pedra para uma obra e a moral tem folga: de 60 para 50 por dois dias ainda é Contente. *É ruim:* A moral já está baixa (fome, frio, casas cheias): −10 derruba a faixa e, com 25 ou menos, pode levar alguém embora.

#### Sementes para o próximo campo (`springSeeds`, v1)

- **Dilema:** Tirar da mesa de hoje para a colheita de daqui a alguns dias.
- **Quando sai:** peso 3 no sorteio · uma vez por ano · Primavera.
- **Repetição e virada do ano:** Sai uma vez por ano, na primavera.
- **Texto:** Os lavradores abriram um campo novo junto ao riacho, e falta semente para ele. Pedem grão da despensa para lançar à terra. O que se planta hoje só volta à mesa daqui a alguns dias.

| Opção | Custo e requisito | Consequência conhecida | Efeito oculto | Pista |
|---|---|---|---|---|
| **Ceder o grão** (`sow`) | −40 comida | nenhuma | +80 comida, na 4ª virada de dia depois da escolha | Grão na terra volta dobrado em poucos dias, se houver onde guardar. |
| **Comprar a semente** (`buy`) | −30 ouro | nenhuma | +80 comida, na 4ª virada de dia depois da escolha | O ouro poupa a despensa, e a colheita vem do mesmo jeito. |
| **Deixar o campo em pousio** (`fallow`) | sem custo | nenhuma | — | Terra descansada não pede nada, e não dá nada. |

- **Flags e continuação:** nenhuma.
- **Se ninguém responde (`autoResolve`):** Camponês: Deixar o campo em pousio · Senhor: Deixar o campo em pousio · Rei de Ferro: Deixar o campo em pousio.
- **Crônica:**
  - Chegada: a frase geral ("o conselho de {feudo} pediu audiência: {carta}").
  - Ceder o grão: No {dia}º dia {daEstacao}, o senhor de {feudo} cedeu grão da despensa para o campo novo. Semeou-se até o sol baixar.
    - Efeito posterior: No {dia}º dia {daEstacao}, o campo novo de {feudo} deu a primeira colheita. O grão cedido voltou dobrado.
  - Comprar a semente: No {dia}º dia {daEstacao}, o senhor de {feudo} comprou semente a um vizinho para o campo novo. A despensa ficou como estava.
    - Efeito posterior: No {dia}º dia {daEstacao}, o campo novo de {feudo} deu a primeira colheita, da semente comprada a um vizinho. A despensa não tinha cedido um grão.
  - Deixar o campo em pousio: No {dia}º dia {daEstacao}, o senhor de {feudo} deixou o campo novo em pousio. A semente fica para outro ano.
    - Ao expirar: No {dia}º dia {daEstacao}, sem palavra do senhor, o campo novo de {feudo} ficou em pousio. A semente fica para outro ano.
- **Cenários:**
  - Ceder o grão. *Faz sentido:* Há comida para hoje e lugar para guardar daqui a quatro dias. *É ruim:* A despensa está no fim (40 a menos podem abrir a fome) ou o depósito está perto do limite (o retorno seria cortado).
  - Comprar a semente. *Faz sentido:* A comida está curta e o ouro, parado. *É ruim:* O ouro está contado para recrutas e obras, ou o depósito de comida está cheio.
  - Deixar o campo em pousio. *Faz sentido:* Não sobra comida nem ouro, ou o depósito de comida está no limite. *É ruim:* Há qualquer folga: é o melhor retorno do lote.

#### A notícia da primavera (`springNews`, v1)

- **Dilema:** Festa paga, festa de graça ou dia de trabalho.
- **Quando sai:** peso 3 no sorteio · uma vez por ano · Primavera.
- **Repetição e virada do ano:** Sai uma vez por ano, na primavera.
- **Texto:** As cegonhas voltaram ao telhado do salão, e com elas a certeza de que a primavera veio para ficar. O povo quer marcar o dia com música e um tonel aberto. O tesoureiro lembra que tonel não se enche sozinho.

| Opção | Custo e requisito | Consequência conhecida | Efeito oculto | Pista |
|---|---|---|---|---|
| **Abrir o tonel** (`cask`) | −40 ouro | +15 de moral por 2 dias de jogo | — | Dia de festa pesa pouco no cofre e muito na lembrança. |
| **Mandar tocar o sino** (`bells`) | sem custo | +5 de moral por 1 dia de jogo | — | Sino não custa nada, e festa sem tonel acaba cedo. |
| **Mandar todos ao campo** (`fields`) | sem custo | +25 comida; −5 de moral por 1 dia de jogo | — | Dia de sol é dia de enxada: a despensa agradece, o povo nem tanto. |

- **Flags e continuação:** nenhuma.
- **Se ninguém responde (`autoResolve`):** Camponês: Mandar tocar o sino · Senhor: Mandar tocar o sino · Rei de Ferro: Mandar todos ao campo.
- **Crônica:**
  - Chegada: a frase geral ("o conselho de {feudo} pediu audiência: {carta}").
  - Abrir o tonel: No {dia}º dia {daEstacao}, o senhor de {feudo} mandou abrir um tonel pela volta das cegonhas. Cantou-se até elas reclamarem.
  - Mandar tocar o sino: No {dia}º dia {daEstacao}, o sino de {feudo} saudou a volta das cegonhas. Houve sorrisos, e cada um voltou ao seu trabalho.
    - Ao expirar: No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} mandou tocar o sino pela volta das cegonhas. Houve sorrisos, e cada um voltou ao seu trabalho.
  - Mandar todos ao campo: No {dia}º dia {daEstacao}, o senhor de {feudo} mandou todos ao campo em vez da festa. A terra rendeu; a música ficou para outro ano.
    - Ao expirar: No {dia}º dia {daEstacao}, sem palavra do senhor, o capataz de {feudo} mandou todos ao campo em vez da festa. A terra rendeu; a música ficou para outro ano.
- **Cenários:**
  - Abrir o tonel. *Faz sentido:* O ouro está parado: +15 por dois dias leva o feudo a Orgulhoso (75) e, com qualquer +5, aos 80. *É ruim:* O ouro está contado.
  - Mandar tocar o sino. *Faz sentido:* O ouro está contado e a comida, em ordem. *É ruim:* A comida está curta: o dia de campo rende 25.
  - Mandar todos ao campo. *Faz sentido:* A comida está curta e a moral tem folga. *É ruim:* A moral está na beira de uma faixa.

#### A mesa dos aprendizes (`apprenticesTable`, v1)

- **Dilema:** Pagar pelo aprendizado ou pôr os rapazes para render hoje.
- **Quando sai:** peso 3 no sorteio · uma vez por ano · Verão e Outono.
- **Repetição e virada do ano:** Sai uma vez por ano, no verão ou no outono.
- **Texto:** Os rapazes do feudo querem aprender ofício com os mais velhos da serraria e da pedreira. Os velhos aceitam, se alguém pagar as horas que perdem ensinando. Aprendiz erra muito antes de acertar.

| Opção | Custo e requisito | Consequência conhecida | Efeito oculto | Pista |
|---|---|---|---|---|
| **Pagar as lições** (`teach`) | −40 ouro | +5 de moral por 3 dias de jogo | +40 madeira, +30 pedra, na 5ª virada de dia depois da escolha | Aprendiz bem ensinado paga a lição com trabalho, daqui a alguns dias. |
| **Deixar aprender olhando** (`watch`) | sem custo | nenhuma | — | Quem aprende olhando aprende devagar, e não custa nada. |
| **Mandar os rapazes à colheita** (`harvest`) | sem custo | +30 comida; −5 de moral por 2 dias de jogo | — | A despensa ganha hoje. O ofício fica para quando houver tempo, e os rapazes sabem disso. |

- **Flags e continuação:** nenhuma.
- **Se ninguém responde (`autoResolve`):** Camponês: Deixar aprender olhando · Senhor: Deixar aprender olhando · Rei de Ferro: Mandar os rapazes à colheita.
- **Crônica:**
  - Chegada: a frase geral ("o conselho de {feudo} pediu audiência: {carta}").
  - Pagar as lições: No {dia}º dia {daEstacao}, o senhor de {feudo} pagou as lições dos aprendizes. À noite, a mesa deles era a mais barulhenta do salão.
    - Efeito posterior: No {dia}º dia {daEstacao}, os aprendizes de {feudo} entregaram a primeira obra: tábuas direitas e pedra bem cortada.
  - Deixar aprender olhando: No {dia}º dia {daEstacao}, o senhor de {feudo} deixou os rapazes aprenderem olhando. Os velhos seguiram no trabalho, com plateia.
    - Ao expirar: No {dia}º dia {daEstacao}, sem palavra do senhor, os rapazes de {feudo} ficaram aprendendo de longe. Os velhos seguiram no trabalho, com plateia.
  - Mandar os rapazes à colheita: No {dia}º dia {daEstacao}, o senhor de {feudo} mandou os rapazes à colheita em vez da lição. Voltaram com os cestos cheios e a cara fechada.
    - Ao expirar: No {dia}º dia {daEstacao}, sem palavra do senhor, o capataz de {feudo} mandou os rapazes à colheita em vez da lição. Voltaram com os cestos cheios e a cara fechada.
- **Cenários:**
  - Pagar as lições. *Faz sentido:* O ouro está parado; madeira e pedra vão fazer falta em cinco dias. *É ruim:* O ouro está contado, ou o Armazém está cheio.
  - Deixar aprender olhando. *Faz sentido:* Tudo está contado e a moral está na beira de uma faixa. *É ruim:* O ouro sobra, ou a comida falta.
  - Mandar os rapazes à colheita. *Faz sentido:* A comida está curta e a moral tem folga. *É ruim:* A moral está na beira de uma faixa, ou o depósito de comida está cheio.

#### O celeiro quase cheio (`fullGranary`, v1)

- **Dilema:** Repartir o que sobra, trocá-lo por lenha ou guardar tudo.
- **Quando sai:** peso 3 no sorteio · uma vez por ano · Verão e Outono · exige o Celeiro no nível 1 · moral de 60 a 100.
- **Repetição e virada do ano:** Sai uma vez por ano, no verão ou no outono, com o Celeiro erguido e a moral em 60 ou mais.
- **Texto:** Os lavradores juram que a colheita deste ano não cabe no celeiro. O que sobrar apodrece ao relento antes do inverno. As famílias perguntam se o senhor reparte uma parte do grão enquanto ele ainda presta.

| Opção | Custo e requisito | Consequência conhecida | Efeito oculto | Pista |
|---|---|---|---|---|
| **Repartir o excedente** (`share`) | −80 comida; requer 300 de comida em estoque | +15 de moral por 2 dias de jogo | — | Grão repartido não apodrece, e o povo lembra de quem repartiu. |
| **Pagar lenha com grão** (`firewood`) | −60 comida; requer 300 de comida em estoque | +40 madeira | — | Quem recebe grão racha lenha de bom grado. O inverno agradece. |
| **Guardar cada saco** (`keep`) | sem custo | nenhuma | — | O que couber fica. O que não couber, o tempo leva. |

- **Flags e continuação:** nenhuma.
- **Se ninguém responde (`autoResolve`):** Camponês: Guardar cada saco · Senhor: Guardar cada saco · Rei de Ferro: Guardar cada saco.
- **Crônica:**
  - Chegada: a frase geral ("o conselho de {feudo} pediu audiência: {carta}").
  - Repartir o excedente: No {dia}º dia {daEstacao}, o senhor de {feudo} repartiu entre as famílias o grão que sobrava. Nenhum saco apodreceu; nenhuma casa ficou sem.
  - Pagar lenha com grão: No {dia}º dia {daEstacao}, o senhor de {feudo} pagou em grão a lenha que as famílias racharam. O celeiro aliviou, e a pilha de lenha cresceu.
  - Guardar cada saco: No {dia}º dia {daEstacao}, o senhor de {feudo} mandou guardar cada saco. O celeiro que se arranje.
    - Ao expirar: No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} mandou guardar cada saco no celeiro.
- **Cenários:**
  - Repartir o excedente. *Faz sentido:* A comida sobra de fato ou já vai ao chão; +15 por dois dias fica a um passo dos 80. *É ruim:* O inverno está à porta com o feudo grande: gastar a comida guardada para 24 h tira os +10 de moral que ela dá.
  - Pagar lenha com grão. *Faz sentido:* É outono, a conta da lenha está apertada e a comida sobra. *É ruim:* O Armazém está cheio de madeira.
  - Guardar cada saco. *Faz sentido:* A comida não sobra de verdade. *É ruim:* O Celeiro está cheio e a comida vai ao chão.

#### Lenha ainda úmida (`dampFirewood`, v1)

- **Dilema:** Pagar para a lenha render, salvar no braço ou deixar como está.
- **Quando sai:** peso 3 no sorteio · uma vez por ano · Outono.
- **Repetição e virada do ano:** Sai uma vez por ano, no outono.
- **Texto:** As chuvas do outono pegaram as pilhas de lenha descobertas. Madeira molhada faz mais fumaça que calor, e o inverno está perto. O lenhador mais velho pede telheiros de palha para secar as pilhas a tempo.

| Opção | Custo e requisito | Consequência conhecida | Efeito oculto | Pista |
|---|---|---|---|---|
| **Pagar os telheiros** (`sheds`) | −30 ouro | nenhuma | +45 madeira, na 3ª virada de dia depois da escolha | Lenha seca rende mais na lareira. O ganho aparece quando as pilhas secarem. |
| **Deixar secar ao tempo** (`leave`) | sem custo | nenhuma | — | Nada se gasta e nada se ganha: a lenha queima como estiver. |
| **Mandar rachar e empilhar ao vento** (`split`) | sem custo | −5 de moral por 2 dias de jogo | +25 madeira, na 3ª virada de dia depois da escolha | Lenha rachada fina seca sozinha. Dá para salvar no braço, e o braço reclama. |

- **Flags e continuação:** nenhuma.
- **Se ninguém responde (`autoResolve`):** Camponês: Deixar secar ao tempo · Senhor: Deixar secar ao tempo · Rei de Ferro: Mandar rachar e empilhar ao vento.
- **Crônica:**
  - Chegada: a frase geral ("o conselho de {feudo} pediu audiência: {carta}").
  - Pagar os telheiros: No {dia}º dia {daEstacao}, o senhor de {feudo} pagou telheiros de palha para a lenha. As pilhas atravessaram a chuva cobertas.
    - Efeito posterior: No {dia}º dia {daEstacao}, a lenha de {feudo} secou debaixo dos telheiros de palha. A mesma pilha passou a valer por mais achas.
  - Deixar secar ao tempo: No {dia}º dia {daEstacao}, o senhor de {feudo} deixou as pilhas de lenha secarem ao tempo.
    - Ao expirar: No {dia}º dia {daEstacao}, ninguém em {feudo} decidiu nada sobre a lenha úmida. As pilhas ficaram ao tempo.
  - Mandar rachar e empilhar ao vento: No {dia}º dia {daEstacao}, o senhor de {feudo} mandou o povo rachar a lenha fina e empilhá-la ao vento. Os braços doeram até a noite.
    - Ao expirar: No {dia}º dia {daEstacao}, sem palavra do senhor, o capataz de {feudo} mandou o povo rachar a lenha fina e empilhá-la ao vento. Os braços doeram até a noite.
    - Efeito posterior: No {dia}º dia {daEstacao}, a lenha rachada fina de {feudo} secou ao vento. Rendeu mais achas do que a pilha molhada prometia.
- **Cenários:**
  - Pagar os telheiros. *Faz sentido:* O ouro está parado e a lenha do inverno está contada. *É ruim:* O ouro está contado, ou o Armazém está cheio (o ganho seria cortado).
  - Deixar secar ao tempo. *Faz sentido:* Nada sobra e a moral está na beira de uma faixa. *É ruim:* Falta lenha e o ouro está parado.
  - Mandar rachar e empilhar ao vento. *Faz sentido:* Falta lenha, o ouro está contado e a moral tem folga. *É ruim:* A moral está na beira de uma faixa, ou o Armazém está cheio.

#### Um teto antes do frio (`roofBeforeCold`, v1)

- **Dilema:** Dar um teto, emprestar o salão ou mandar cada um fazer o seu.
- **Quando sai:** peso 3 no sorteio · uma vez por ano · Outono.
- **Repetição e virada do ano:** Sai uma vez por ano, no outono.
- **Texto:** Duas famílias dormem no palheiro desde a colheita. Pedem ao senhor um teto de verdade antes da primeira geada. O carpinteiro lembra que cada tábua dada agora é uma acha a menos no inverno.

| Opção | Custo e requisito | Consequência conhecida | Efeito oculto | Pista |
|---|---|---|---|---|
| **Ceder madeira e pedra** (`build`) | −50 madeira, −20 pedra | +10 de moral por 4 dias de jogo | — | Quem ganha um teto no outono não esquece no inverno. |
| **Abrigar as famílias no salão** (`hall`) | sem custo | nenhuma | — | O salão é grande e seco. Ninguém ganha casa, e ninguém dorme ao relento. |
| **Dar machados e mandar à mata** (`axes`) | sem custo | −5 de moral por 2 dias de jogo | +40 madeira, na 3ª virada de dia depois da escolha | Quem corta a própria viga demora, reclama, e às vezes corta de sobra. |

- **Flags e continuação:** nenhuma.
- **Se ninguém responde (`autoResolve`):** Camponês: Abrigar as famílias no salão · Senhor: Abrigar as famílias no salão · Rei de Ferro: Dar machados e mandar à mata.
- **Crônica:**
  - Chegada: a frase geral ("o conselho de {feudo} pediu audiência: {carta}").
  - Ceder madeira e pedra: No {dia}º dia {daEstacao}, o senhor de {feudo} cedeu madeira e pedra para o teto de duas famílias. Em poucos dias havia fumaça em duas chaminés novas.
  - Abrigar as famílias no salão: No {dia}º dia {daEstacao}, o senhor de {feudo} abriu o salão às duas famílias do palheiro. Dormiram secas, entre os bancos do conselho.
    - Ao expirar: No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} abrigou no salão as duas famílias do palheiro. Dormiram secas, entre os bancos do conselho.
  - Dar machados e mandar à mata: No {dia}º dia {daEstacao}, o senhor de {feudo} deu machados às famílias do palheiro e as mandou à mata. Foram resmungando.
    - Ao expirar: No {dia}º dia {daEstacao}, sem palavra do senhor, o capataz de {feudo} deu machados às famílias do palheiro e as mandou à mata. Foram resmungando.
    - Efeito posterior: No {dia}º dia {daEstacao}, as duas famílias de {feudo} fecharam o próprio teto com a madeira que cortaram. O que sobrou das vigas foi para a lenha do feudo.
- **Cenários:**
  - Ceder madeira e pedra. *Faz sentido:* Madeira e pedra sobram; +10 por quatro dias dura até a audiência seguinte. *É ruim:* É outono e a lenha está contada, ou há obra esperando.
  - Abrigar as famílias no salão. *Faz sentido:* Tudo está contado e a moral está na beira de uma faixa. *É ruim:* A madeira sobra (ceder rende moral) ou a madeira falta e a moral tem folga (os machados rendem 40).
  - Dar machados e mandar à mata. *Faz sentido:* Falta lenha para o inverno e a moral tem folga. *É ruim:* A moral está na beira de uma faixa (fome, casas cheias).

#### A colheita de todos (`harvestFeast`, v1)

- **Dilema:** Festa grande, festa pequena ou nenhuma: o outono paga, o inverno cobra.
- **Quando sai:** peso 4 no sorteio · uma vez por ano · Outono · moral de 40 a 100.
- **Repetição e virada do ano:** Sai uma vez por ano, no outono, com a moral em 40 ou mais.
- **Texto:** Os campos renderam, e as carroças voltam cheias. O povo pede uma festa da colheita, com mesa posta na praça. Os mais velhos lembram que o inverno come o que o outono guarda.

| Opção | Custo e requisito | Consequência conhecida | Efeito oculto | Pista |
|---|---|---|---|---|
| **Celebrar a colheita** (`feast`) | −100 comida, −50 ouro | +20 de moral por 2 dias de jogo | — | Festa grande corre as estradas, e feudo alegre atrai gente nova. |
| **Fazer uma festa modesta** (`modest`) | −40 comida | +10 de moral por 2 dias de jogo | — | Pão novo e um brinde: pouco para a lenda, bastante para o ânimo. |
| **Guardar tudo para o inverno** (`store`) | sem custo | nenhuma | — | Despensa cheia não canta. Também não passa fome. |

- **Flags e continuação:** nenhuma.
- **Se ninguém responde (`autoResolve`):** Camponês: Guardar tudo para o inverno · Senhor: Guardar tudo para o inverno · Rei de Ferro: Guardar tudo para o inverno.
- **Crônica:**
  - Chegada: a frase geral ("o conselho de {feudo} pediu audiência: {carta}").
  - Celebrar a colheita: No {dia}º dia {daEstacao}, o senhor de {feudo} mandou pôr a mesa na praça e celebrar a colheita. Comeu-se, bebeu-se e dançou-se até a madrugada.
  - Fazer uma festa modesta: No {dia}º dia {daEstacao}, o senhor de {feudo} mandou repartir pão novo e brindar à colheita. Festa curta, sono tranquilo.
  - Guardar tudo para o inverno: No {dia}º dia {daEstacao}, o senhor de {feudo} mandou guardar a colheita inteira. Não houve festa; trabalhou-se em silêncio.
    - Ao expirar: No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} mandou guardar a colheita inteira. Não houve festa; trabalhou-se em silêncio.
- **Cenários:**
  - Celebrar a colheita. *Faz sentido:* Comida e ouro sobram e há vaga nas Habitações: 80 de moral por dois dias são duas chances de 20% de um colono chegar. *É ruim:* Não há vaga nas casas (o colono não vem), ou a despensa está curta para o inverno.
  - Fazer uma festa modesta. *Faz sentido:* Há comida para gastar e o ouro está contado; ou já existe outro efeito de +10, e 80 saem mais barato. *É ruim:* A despensa está curta.
  - Guardar tudo para o inverno. *Faz sentido:* A despensa está curta para o inverno. *É ruim:* O depósito está cheio e a comida vai ao chão.

## 4. Cobertura: há assunto em toda audiência?

A cadência é de uma audiência a cada 4 dias de jogo: **21 por ano** (5 na primavera, 6 no verão, 6 no outono, 3 no inverno; a 21ª cai na virada do ano e já é da primavera seguinte).

### 4.1 Quantas cartas o sorteio tem ao alcance

Com a mesa livre e nenhuma carta vista no ano, por estação e nível do Salão (o que o nível libera, já erguido). Medido em `packages/engine/src/council.coverage.test.ts`:

| Estação | Salão 1 (sem depósitos) | Salão 2 (com o Celeiro) | Salão 3 ou mais |
|---|---:|---:|---:|
| Primavera | 8 | 9 | 10 |
| Verão | 7 | 9 | 10 |
| Outono | 9 | 11 | 12 |
| Inverno | 5 | 6 | 7 |

O Salão 3 tem uma carta a mais em todas as estações: o pedido da Paliçada, que olha o nível do Salão e não a obra. Nenhuma carta do lote pede dia mínimo: a estação inteira vê o mesmo número.

**O pior caso é 3.** Com todas as cartas de uma vez por ano já vistas e uma recorrente recém-saída da mesa (travada pela ronda), sobram as outras três recorrentes, em qualquer estação e com qualquer Salão. É o piso que a tarefa pedia ("ao menos 3 elegíveis em qualquer estação a partir do dia 4"), e o teste o confere em cada uma das 21 audiências.

**Com a moral baixa** (abaixo de 40) saem do sorteio "A colheita de todos" e "O celeiro quase cheio": ninguém pede festa com fome. As recorrentes continuam.

### 4.2 O que o bot vê em um ano, em 50 sementes

O perfil Regular (bot econômico, 2 visitas por dia), um ano de jogo, sementes `pedra-alta-001` a `pedra-alta-050`. Medido em `packages/sim-cli/src/coverage.test.ts`; para refazer as tabelas: `SHOW_COVERAGE=1 pnpm --filter @lotg/sim-cli test -- coverage`.

#### Ritmo Normal (um ano em 7 dias), 2 visitas por dia

50 sementes, 21 audiências por partida.

| Por partida | Menor a maior |
|---|---|
| Cartas que chegaram | 21 a 23 |
| Modelos diferentes | 14 a 19 |
| Continuações de cadeia | 0 a 4 |
| Respondidas pelo bot | 19 a 21 |
| Expiradas | 0 |
| Audiências puladas com a mesa cheia | 0 a 2 |
| Audiências sem carta por falta de assunto | 0 |

| Estação | Audiências | Cartas sorteadas por partida | Modelos vistos nas 50 sementes |
|---|---:|---|---:|
| Primavera | 6 | 5 a 6 | 10 |
| Verão | 6 | 4 a 6 | 10 |
| Outono | 6 | 5 a 6 | 12 |
| Inverno | 3 | 2 a 3 | 6 |

| Salão na chegada da carta | Cartas (soma das sementes) | Modelos diferentes |
|---:|---:|---:|
| 1 | 150 | 9 |
| 2 | 158 | 11 |
| 3 | 108 | 13 |
| 4 | 114 | 13 |
| 5 | 168 | 14 |
| 6 | 185 | 14 |
| 7 | 234 | 13 |

| Carta | Partidas em que apareceu | Vezes ao todo |
|---|---:|---:|
| Tábuas para as reservas | 50 | 58 |
| A vez de repartir | 29 | 29 |
| O que ficou da escolha | 29 | 29 |
| A ponte que o degelo levou | 50 | 55 |
| A laje no leito do riacho | 38 | 38 |
| A passagem volta a servir | 38 | 38 |
| Os aldeões pedem uma cerca | 50 | 61 |
| O prazo da paliçada | 0 | 0 |
| A palavra do senhor | 0 | 0 |
| O poço entulhado | 50 | 59 |
| A refeição dos pedreiros | 50 | 105 |
| A serraria e o descanso | 49 | 113 |
| Vigília entre vizinhos | 46 | 96 |
| Mais bocas à mesa | 49 | 113 |
| Sementes para o próximo campo | 40 | 44 |
| A notícia da primavera | 38 | 41 |
| A mesa dos aprendizes | 49 | 49 |
| O celeiro quase cheio | 49 | 49 |
| Lenha ainda úmida | 43 | 43 |
| Um teto antes do frio | 50 | 50 |
| A colheita de todos | 47 | 47 |

#### Ritmo Rápido (um ano em 56 horas), 2 visitas por dia

50 sementes, 21 audiências por partida.

| Por partida | Menor a maior |
|---|---|
| Cartas que chegaram | 10 |
| Modelos diferentes | 8 a 10 |
| Continuações de cadeia | 0 a 2 |
| Respondidas pelo bot | 8 |
| Expiradas | 0 |
| Audiências puladas com a mesa cheia | 11 a 13 |
| Audiências sem carta por falta de assunto | 0 |

| Estação | Audiências | Cartas sorteadas por partida | Modelos vistos nas 50 sementes |
|---|---:|---|---:|
| Primavera | 6 | 3 | 8 |
| Verão | 6 | 3 | 10 |
| Outono | 6 | 1 a 2 | 12 |
| Inverno | 3 | 1 a 2 | 7 |

| Salão na chegada da carta | Cartas (soma das sementes) | Modelos diferentes |
|---:|---:|---:|
| 1 | 100 | 8 |
| 2 | 100 | 9 |
| 3 | 100 | 10 |
| 4 | 100 | 14 |
| 5 | 100 | 10 |

| Carta | Partidas em que apareceu | Vezes ao todo |
|---|---:|---:|
| Tábuas para as reservas | 44 | 44 |
| A vez de repartir | 27 | 27 |
| O que ficou da escolha | 20 | 20 |
| A ponte que o degelo levou | 46 | 46 |
| A laje no leito do riacho | 4 | 4 |
| A passagem volta a servir | 4 | 4 |
| Os aldeões pedem uma cerca | 41 | 41 |
| O prazo da paliçada | 0 | 0 |
| A palavra do senhor | 0 | 0 |
| O poço entulhado | 41 | 41 |
| A refeição dos pedreiros | 25 | 29 |
| A serraria e o descanso | 32 | 34 |
| Vigília entre vizinhos | 30 | 35 |
| Mais bocas à mesa | 32 | 33 |
| Sementes para o próximo campo | 27 | 27 |
| A notícia da primavera | 24 | 24 |
| A mesa dos aprendizes | 35 | 35 |
| O celeiro quase cheio | 18 | 18 |
| Lenha ainda úmida | 11 | 11 |
| Um teto antes do frio | 9 | 9 |
| A colheita de todos | 18 | 18 |

A coluna "Audiências" da primavera conta 6 porque a da virada do ano entra nela.

### 4.3 O que as medidas dizem

- **Nenhuma audiência ficou sem carta por falta de assunto**, em nenhuma das 100 partidas. Não há intervalo sem conteúdo elegível a registrar.
- **No ritmo Normal** quem passa duas vezes por dia vê quase todas as audiências: 21 a 23 cartas por ano, de 14 a 19 modelos diferentes. Cada recorrente aparece pouco mais de duas vezes por ano, em média.
- **No ritmo Rápido** as visitas são a cada 18 dias de jogo: a mesa enche com duas cartas e de 11 a 13 audiências por ano são puladas. O ano traz 10 cartas. As do outono saem em poucas partidas ("Um teto antes do frio" em 9 de 50, "Lenha ainda úmida" em 11, "A colheita de todos" em 18), e o inverno traz uma ou duas cartas. Não é falta de assunto: é o limite de duas cartas na mesa somado ao prazo de 24 h reais (ADR 0014, decisões 1 e 18). Quem visita quatro vezes por dia vê mais.
- **Duas cadeias são percorridas.** No ritmo Normal a cadeia do Celeiro vai até o desfecho em 29 de 50 partidas e a da Ponte em 38; no Rápido a do Celeiro em 20 e a da Ponte em 4 (ela sai nas primeiras audiências, com o feudo ainda sem folga, e o bot só paga com folga). Um jogador que queira a cadeia a abre quando quiser: o bot é mais sovina que uma pessoa.
- **O bot nunca abre a cadeia da Paliçada.** O pedido dos aldeões aparece em todas as partidas do ritmo Normal e em 41 das 50 do Rápido, e as duas continuações, em nenhuma: a carta não tem opção paga para o bot pesar, e sem ela ele fica com a primeira opção sem custo, que é explicar que não é hora. Ele também não ergue a Paliçada: a política dela entra com a incursão de lobos (V2E-T3). Como quem só explica não grava flag nenhuma, o pedido volta no ano seguinte (61 chegadas em 50 partidas de um ano, contando a audiência da virada). As ramificações da cadeia são percorridas no motor (`council.chains.test.ts`), na API (`packages/server/test/palisade.test.ts`) e no cenário de 7 dias do golden.
- **O inverno não tem carta própria.** Vive das recorrentes e do que sobrou do ano. É a estação mais magra do lote.

## 5. A moral chega a 80?

Sem as cartas a moral vai de 0 a 60 (a base e a comida guardada, GDD §5.7). Com 80 ou mais, cada virada de dia tem 20% de chance de trazer um colono, se houver vaga. O lote foi escrito para que 80 seja alcançável por quem cuida do feudo:

- **Sozinha:** "A colheita de todos", celebrar (+20 por 2 dias).
- **Em cadeia:** no Celeiro Comum, partilhar (+10 por 3 dias) e, dois dias depois, deixar com as famílias (+10 por 3 dias) dão um dia em 80; na Ponte, ceder as vigas (+5 por 3 dias) e abrir com festa (+15 por 3 dias).
- **Somando duas cartas respondidas na mesma visita:** efeitos de cartas diferentes se somam. "Abrir o tonel" (+15) com qualquer +5; "Ceder a pedra" do poço (+10 por 3 dias) com outra de +10.

Medido nas mesmas 50 sementes, um ano de jogo, com o bot econômico (que só paga uma carta com folga e não escolhe pela moral):

| Ritmo | Visitas por dia | Partidas que chegam a 80 | Horas reais com 80 ou mais (mediana) | Partidas com ao menos um colono | Colonos por partida |
|---|---:|---:|---:|---:|---|
| Normal | 2 | 47 de 50 | 4 | 20 | 0 a 3 |
| Normal | 4 | 27 de 50 | 2 | 8 | 0 a 1 |
| Rápido | 2 | 6 de 50 | 0 | 0 | 0 |
| Rápido | 4 | 37 de 50 | 1 | 20 | 0 a 2 |

(Medido de novo em V2E-T2, com as três cartas da Paliçada no sorteio. No ritmo Rápido com duas visitas por dia o número caiu de 19 para 6 partidas: o ano traz 10 cartas, e o pedido da cerca, a que o bot só responde explicando, ocupa o lugar de uma das que dariam moral. Quem promete e cumpre ganha +10 e, quatro dias depois, +15: é mais um caminho até os 80, que o bot não usa.)

Quem responde duas cartas de uma vez soma os efeitos; quem responde uma por visita, não. É uma habilidade do jogador, e a tela a mostra (a conta da moral lista cada carta com o prazo). Um jogador que queira o colono chega lá mais vezes do que o bot.

## 6. Limites conhecidos e o que fica para o lote 2

1. **Faltam 39 cartas para a meta de 60 do GDD**, 2 cadeias e as 6 roteirizadas. Fica para o lote 2 (V2F-T5 planeja).
2. **Custos fixos.** Uma carta custa 15 a 150 unidades em qualquer estágio do feudo. Com 60 aldeões, 40 de madeira são troco, e +10 de moral por dois dias (5% da produção de todo o feudo) vale muito mais: no fim do ano as opções pagas de moral são quase sempre a melhor conta. O dilema entre os recursos continua (qual está sobrando), mas o preço deixa de pesar. Custos proporcionais ao estoque pedem um efeito novo no motor.
3. **Efeitos de moral pequenos para um feudo pequeno.** O inverso: com 10 aldeões, +5 de moral por dois dias rende menos do que os 25 de madeira que custa. No começo as opções pagas valem pela história e pela soma até 80, não pela conta.
4. **Camponês e Senhor decidem igual** quando uma carta expira (seção 2).
5. **O inverno não tem carta própria**, e no ritmo Rápido as cartas do outono saem pouco (seção 4.3).
6. **"O celeiro quase cheio" não confere o estoque para sair**: a carta pede o Celeiro e a moral em 60 ou mais (a de quem tem comida guardada), e as duas opções pagas ficam trancadas com menos de 300 de comida. Com o celeiro vazio e a moral alta por outra carta, o texto ("os lavradores juram que a colheita não cabe") fica otimista. Um requisito de estoque na carta, e não só na opção, é um requisito novo no motor.
7. **O bot do simulador não lê a consequência.** Decide pelo custo e pelo estoque: paga a opção mais cara que cabe com folga. Não distingue uma festa de um conserto, e por isso mede a economia com o Conselho, não a qualidade dos dilemas. Quem valida os dilemas é o autor e o playtest.
8. **Ninguém jogou as cartas.** Texto, tom, clareza do custo e da pista só se provam com gente lendo.
9. **O pedido da cerca pode chegar a quem já a ergueu.** Uma carta confere um edifício pelo nível mínimo ("com o Salão no nível 3") e pela opção trancada, mas não sabe **deixar de sair** porque um edifício existe. Com a Paliçada de pé, "Os aldeões pedem uma cerca" ainda sai uma vez: o texto pede o que já existe, e a opção "Mostrar a paliçada erguida" resolve o assunto (+10 de moral, e a carta não volta). Um requisito "sem este edifício", ou uma variante de texto por edifício, seria um requisito novo no motor.
10. **A cadeia da Paliçada não tem opção paga**, e por isso o bot do simulador nunca a abre (seção 4.3). A obra é o custo: 200 de madeira e 50 de pedra, fora da carta.
11. **Os ids de carta e de opção não se renomeiam sem migração.** O estado de uma partida guarda o id da carta na mesa, da continuação agendada e da opção cujo efeito escondido ainda vai acontecer. Para o motor, um id que o catálogo já não tem é carta que saiu: sem efeito e sem linha (ADR 0014). Renomear `sow` com partidas vivas tira do jogador a colheita que ele pagou; renomear `commonGranaryShare` deixa a cadeia aberta para sempre. Um teste (`packages/content/src/council.test.ts`) fixa os pares publicados e diz o que fazer: escrever antes o passo de migração do estado. Texto, números, pesos, requisitos, cartas novas e opções novas não têm esse custo. Uma linha na Crônica para o efeito perdido, ou a cadeia que se fecha sozinha, seriam regras novas, e aguardam o autor.

## 7. Versão do conteúdo

O `contentHash` de `GET /v1/version` e do resumo do simulador, com as 21 cartas deste lote e a Paliçada: **`2f8434b06481af37`** (com as 18 cartas de V2D-T2 era `aee14c5417faa5be`). Ele muda com qualquer número ou texto de `@lotg/content`, inclusive a ordem do catálogo, que faz parte do sorteio. **Não é o hash do playtest:** as tarefas seguintes da Fase E mexem no conteúdo (os lobos e os objetivos 5 a 10), e o hash que identifica a versão jogada é o que `/version` responder no dia. Este serve para saber se as cartas mudaram desde este inventário:

```bash
pnpm -s sim -- --seed pedra-alta-001 --days 1 2>&1 >/dev/null | grep conteúdo
```

## 8. Como a cadeia da Paliçada entrou (V2E-T2)

As três cartas estão em `packages/content/src/cards/palisadePromise.ts`, na lista de `cards/index.ts` **depois de `thawBridgeCrossing` e antes de `collapsedWell`** (cadeia nova entra antes das avulsas, nunca no meio de outra). O texto, os números e as flags são os das fichas da seção 3.3, como foram escritos em V2D-T2. O que a entrada acrescentou:

1. **`autoResolveIfUnlocked: 'show'` nas três cartas**, com a frase de quando é o conselho que mostra a obra (`expiredChronicle`). Como estava escrita, a cadeia cobrava a promessa de quem a tinha cumprido: o senhor que prometia, erguia a Paliçada e não voltava em 24 h reais via o conselho "pedir mais alguns dias" e, na segunda cobrança, "explicar por que a paliçada não saiu", com −15 de moral e a cerca de pé. A marca é conteúdo; a regra do motor é uma linha (`defaultOption`), e vale nas três dificuldades (seção 2, "Quem cumpriu não paga por faltar"). Está registrada no [ADR 0014](decisions/0014-conselho-e-ameaca-na-v0.2.md) e aguarda o autor, como o resto.
2. **A tranca diz quando falta pouco.** Com a obra em curso, a opção trancada mostra "Requer a Paliçada, que ainda está em obras." em vez de só "Requer a Paliçada.".
3. **A ordem do catálogo mudou o sorteio** de todo feudo com o Salão no nível 3 ou mais (abaixo disso a carta nova não é elegível, e o sorteio é o de antes). Foram regravados o golden de 7 dias e os retratos do motor; a semente de `COUNCIL_SCENARIO_SEED` e a de `WELL_FIRST_SEED` continuam valendo (os dois cenários ficam abaixo do Salão 3); e a linha de base de `packages/sim-cli/src/bands.ts` foi medida de novo nas três dificuldades ([balance-v0.2.md](balance-v0.2.md), seção 13).
4. **O cenário de 7 dias passa pela cadeia**, pelo caminho de quem cumpre: o pedido chega às 64 h, o senhor promete às 72 h, ergue a Paliçada às 76 h, é cobrado às 80 h e mostra a obra às 84 h. Para o pedido sair nessa semente o senhor do cenário passou a responder aos viajantes ("Fechar o portão"): com a mesa livre, a audiência das 64 h deixou de ser pulada.
5. **Os cenários do motor** (`council.chains.test.ts`): cumprir no prazo; erguer a obra com a cobrança já na mesa; atrasar e mostrar tarde; atrasar e não cumprir; desfazer a promessa e receber o pedido de novo no ano seguinte, com o texto que lembra dela; explicar; expirar nas três dificuldades, com a obra e sem ela; quem já tem a Paliçada quando o pedido chega; o ritmo Rápido; e a virada do ano com a promessa aberta. Os de conteúdo estão em `packages/content/src/council.test.ts`, e os da API, em `packages/server/test/palisade.test.ts`.
