# 0017 — Regras da v0.3: heróis, Taverna e soldo

Data: 2026-10-05\
Estado: **aprovada pelo autor em 2026-10-05, em sessão de perguntas**. Respondidas uma a uma: as decisões **3** e **6** (a opção recomendada nas duas) e a **2** (trocada por ele). As decisões **1, 4, 5 e 7 a 10** foram aprovadas **em bloco**, com a premissa recomendada de cada uma, **sem leitura item a item**. A tabela de números da seção "Números que o GDD não tinha" foi proposta pelo agente depois da sessão: está coberta pela aprovação em bloco e o autor não a leu. Nada aqui está implementado\
Escopo: GDD §4.2, §5.7, §6.1, §7.1, §9.1, §9.2, §12.1, §16.2 e Apêndices B e D; [roadmap da v0.3](../roadmap-v0.3.md), lote 1 de decisões (V3A-T2, decisões 1 a 10 da §9.1): Fases B e C, e o que as Fases D e E usam das decisões 1, 7, 8 e 9

## Contexto

O [roadmap da v0.3](../roadmap-v0.3.md) reúne na §9 as decisões de regra que o GDD deixa vagas, cada uma com uma **premissa recomendada**. O plano previa duas sessões de perguntas (V3A-T2 e V3D-T0). Em 2026-10-05 o autor respondeu às duas de uma vez, em perguntas com opções:

- **Decisão 3 (o soldo quando falta ouro):** escolheu **"Tempo real"**, que é a premissa recomendada.
- **Decisão 6 (a carta "Estrangeira ferida" nas partidas em andamento):** escolheu **"Sim, a todos"**, que é a premissa recomendada.
- **Decisão 2 (como a v0.3 chega à produção):** trocou a premissa. Nas palavras dele: "pode ir commitando tudo na main mesmo e dando push quando tiver uma versão estável".
- **Todas as outras (1, 4, 5 e 7 a 21):** "Todas as recomendadas, em bloco". As premissas da §9 valem como aprovadas, sem leitura item a item; se o simulador mostrar problema em alguma, ela volta ao autor como pergunta pontual.
- **Conteúdo narrativo (decisões 12 e 19):** "Escrevo e sigo; você revisa depois". Está no [ADR 0018](0018-expedicoes-mercado-mestres-e-cartas-na-v0.3.md).

Este ADR registra o lote 1 (decisões 1 a 10); o [ADR 0018](0018-expedicoes-mercado-mestres-e-cartas-na-v0.3.md), o lote 2 (11 a 21). Os números de cada linha são os da §9 e os das tarefas do roadmap, copiados para cá: **nas tarefas das Fases B a F, a referência passa a ser este ADR**. A sessão não levou ao autor o que a Fase C mostraria no simulador (V3D-T0.2), porque a Fase C ainda não existe.

## Decisão

| # | Decisão | O que foi aplicado | Alternativa descartada | Razão | Tarefas | GDD |
|---|---|---|---|---|---|---|
| 1 | Relógios da v0.3 (**em bloco**) | Tudo é **tempo de jogo** e escala com o ritmo: soldo por hora de jogo, ferimento de 2 h e 12 h de jogo, rotação da Taverna, festival, duração dos nós, viagem da caravana, dia do Mercado. **Duas exceções em tempo real**, iguais em qualquer ritmo e convertidas com `settings.timeScale` por `realToGameMs` quando o prazo nasce: a **espera da encruzilhada, de 6 h reais** (`expeditions.crossroadsWaitRealMs`), e os **prazos do soldo em atraso** (decisão 3) | Tudo em tempo de jogo: no Rápido a espera da encruzilhada seria de 2 h reais e a Postura decidiria quase sempre | É a regra do ADR 0013 (decisão 1) com o critério que o autor fixou no ADR 0016: é real a janela que depende de uma pessoa responder e o prazo de uma perda por ausência | V3C-T1, V3C-T2, V3D-T1, V3E-T1, V3E-T2 | §4.2, §9.1, §9.2 |
| 2 | Como a v0.3 chega à produção (**respondida: o autor trocou a premissa**) | **Sem branches de fase.** Todo commit vai direto para o `main`, um por tarefa (um por subtarefa nas tarefas `L`), com o portão verde. **`push` autorizado quando houver uma versão estável.** *Interpretação do agente, a confirmar:* "versão estável" é o **fim de uma fase com o portão inteiro verde** (`pnpm verify`, integração, navegador e a matriz do simulador), e todo `push` que sobe a versão do estado é precedido de um **backup manual do banco**, com o commit anterior anotado como ponto de retorno, como na Fase G da v0.2. Continuam valendo: a v0.3 só sobe o estado sobre a v0.2 publicada e migrada (cumprido: o estado em produção é o 12) e a regra de `deploy/README.md`, "Antes de um deploy que sobe a versão do estado" | A premissa da §9: `push` só quando o autor mandar; Fases C a F em branch de fase, mescladas depois de o autor jogar e aprovar | Instrução direta do autor em 2026-10-05 | todas | — |
| 3 | O soldo quando falta ouro (**respondida: "Tempo real", a recomendada**) | Soldo é consumo **contínuo**: **2 de ouro por hora de jogo por herói** (no feudo, em expedição, em escolta ou ferido; o capturado não recebe). Quando o ouro acaba com soldo a pagar, abre o **atraso** no instante exato, como a fome. **Não há dívida**: o que não foi pago não é cobrado depois. As consequências copiam o desenho da deserção por fome (ADR 0016, itens 2 e 3): **prazos em tempo real, cobrados na virada do dia de jogo**. Com **12 h reais** em atraso, todo herói sem o traço Leal fica **Descontente** (atributos ×4/5). A partir de **24 h reais**, parte **um herói a cada 2 h reais**: o que chegou por último entre os que estão no feudo e não são Leais, sem sorteio. **Leal nunca fica Descontente nem parte.** Quem está fora só pode partir depois de voltar. O atraso fecha quando o saldo de ouro volta a ser positivo, e todos deixam de estar Descontentes; **o atraso que reabre em menos de 2 h reais é o mesmo** e continua de onde estava. Dispensar um herói é sempre possível, sem devolução. **Sem piso de heróis** | Prazos em tempo de jogo (no Rápido, 4 h e 8 h reais: uma noite de sono custaria um herói); cada consequência em instante próprio da linha do tempo; cobrança por dia; dívida paga depois | É o GDD §9.1 lido com o modelo que o motor tem para a fome: reaproveita estado, conversão e testes já provados. No Normal os números são os do GDD | V3C-T1 | §4.2, §9.1 |
| 4 | Taverna: quantos candidatos, e de quanto em quanto tempo (**em bloco**) | **2 candidatos** nos níveis 1 e 2, **3** a partir do nível 3 (`offersByLevel: [2, 2, 3, 3, 3]`). Rotação a cada **12 dias de jogo** (um dia real no Normal, 8 h no Rápido), **ancorada** como a cadência do Conselho; as primeiras ofertas nascem quando a Taverna Nv1 fica pronta; quem não foi contratado sai. Preço **fixo por modelo**, de 80 a 300 de ouro, sem sorteio de preço; um Carismático no feudo dá 20% de desconto. Sorteio no fluxo `tavern` | Sempre 3; rotação por dia de jogo (no Rápido a lista trocaria a cada 40 minutos) | O GDD diz "2–3 candidatos por dia" sem dizer de que dia | V3C-T2 | §6.1, §9.1 |
| 5 | Limite de heróis (**em bloco**) | `1 + nível da Taverna`: 1 sem Taverna, 6 no nível 5 (`heroLimitBase: 1`, `heroLimitPerLevel: 1`). Uma recompensa de carta ou de expedição **nunca** é barrada pelo limite; a contratação é (`HERO_LIMIT`) | Sem limite, com o soldo limitando | O GDD não dá limite. Sem ele, o estado e a visão não têm teto, e os níveis 4 e 5 da Taverna venderiam só moral | V3C-T1, V3C-T2 | §9.1 |
| 6 | A "Estrangeira ferida" como primeira carta roteirizada (**respondida: "Sim, a todos", a recomendada**) | Chega no início do **dia 13 de jogo do ano 1** (o começo do dia real 2 no Normal; 8 h reais no Rápido), antes dos lobos do dia 16. **"Acolher":** Edda, Guerreira Leal, entra agora. **"Cuidar e deixar partir":** +40 de ouro, +5 de moral por 1 dia de jogo, e Rolf, Arqueiro Prudente, chega 1 dia de jogo depois. Nenhuma opção tem custo. `autoResolve`: Camponês e Senhor "Acolher"; Rei de Ferro "Cuidar e deixar partir". **As partidas que já passaram do dia 13 recebem a carta na primeira audiência do Conselho com lugar depois da publicação, uma vez**, estejam no ano 1 ou em outro. O soldo conta desde a chegada. O limite de heróis não barra a carta | Depois dos lobos (dia 18), com a estrangeira ferida por eles; só partidas novas | É a carta 1 do Apêndice B do GDD. As duas opções dão herói: ninguém fica sem equipe porque a carta expirou. Sem a regra das partidas em andamento, quem joga desde a v0.1 nunca teria o primeiro herói | V3C-T3 | §7.1, §9.1, §16.2, Apêndice B |
| 7 | "Poder da equipe" e atributos em inteiros (**em bloco**) | Atributos-base **inteiros** por classe (tabela abaixo). Nível: `atributo × (100 + 8 × (nível − 1)) / 100`, **sem compor**; nível máximo 10. Experiência por tabela escrita no conteúdo: `xpToNext = [100, 282, 519, 800, 1118, 1469, 1852, 2262, 2700]`. Poder: `Σ por herói (ataque + defesa + vida ÷ 10)`, em milésimos, vezes os fatores de classe, traço e item como frações, com **um arredondamento para baixo no fim**. Sorte: um inteiro de **85 a 115**, uma vez por nó com dificuldade. Desfecho por multiplicação cruzada, sem divisão: Sucesso Pleno se `poder × sorte × 10 ≥ dificuldade × 1300`; Sucesso se `poder × sorte ≥ dificuldade × 100`; Revés se `poder × sorte × 10 ≥ dificuldade × 700`; senão, Desastre. Um traço que "desloca a razão" entra como fator do poder naquele nó. Classe conta só em poder, requisito de nó e opção de carta | +8% composto por nível; sorte contínua | `100 × n^1,5`, `vida/10`, "+8%" e "±15%" não são inteiros do jeito que o GDD escreve, e o motor não usa ponto flutuante (§14.3) | V3C-T1, V3D-T1, V3D-T2 | §9.1, §9.2 |
| 8 | Ferimento, captura e morte por dificuldade (**em bloco**) | Revés: ferimento **leve**, 2 h de jogo. Desastre: ferimento **grave**, 12 h de jogo, ou captura, **conforme o nó marca** (`onDisaster: 'injury' \| 'capture'`), editorialmente. **Camponês:** toda captura vira ferimento grave. **Senhor:** como marcado. **Rei de Ferro:** onde está marcado captura, o herói **morre**, e os itens dele voltam ao inventário. O capturado não recebe soldo e fica até o Resgate, **sem prazo** nesta versão. Quem sofre é sorteado no fluxo da expedição. O ferido termina a expedição e não parte em outra até sarar | Sortear entre ferir e capturar; capturado com prazo | A tabela do GDD §12.1 diz "Não / Não (captura) / Sim", e o §9.2 diz "ferimento grave ou captura" sem dizer qual. Marcar no nó é simples e revisável, como o `autoResolve` das cartas | V3D-T2 | §9.1, §9.2, §12.1 |
| 9 | Sorteio por expedição e por caravana (**em bloco**) | Fluxos `expedition:<id>` e `caravan:<id>`, que nascem no primeiro sorteio e são **apagados** quando a entidade termina; `tavern` e `market` são fluxos fixos. Identificadores por **contador no estado**, nunca reutilizados. **Um comando nunca sorteia**: a variante do grafo sai de uma conta sobre a semente, o modelo e o número de envios (`(hash da semente e do modelo + envios desse modelo no ano) mod 3`) | Um fluxo `expedition` para todas: a ordem entre duas expedições mudaria a sorte das duas | É o que o GDD §14.3 prevê; apagar o fluxo mantém o estado com teto | V3B-T1 | §14.3 |
| 10 | Taverna: moral e festival (**em bloco**) | **+5 de moral por nível** da Taverna, termo permanente (`moralePerLevel: 5`). **Festival** por comando (`holdFestival`): custa **100 de comida e 50 de ouro**, dá **+15 de moral por 24 h de jogo** (12 dias de jogo), **um por estação** (`festival: { cost: { food: 100, gold: 50 }, morale: 15, durationMs: 24 h de jogo, perSeason: 1 }`). Como todo termo da moral, vale a partir da virada de dia seguinte | Custo que cresce com o nível; sem limite (moral comprada sem fim) | O GDD dá o efeito e não dá custo nem limite; o custo é o da carta "Festival da Colheita" do Apêndice B | V3C-T2 | §5.7, §6.1 |

### Constantes de conteúdo que as tarefas usam

Copiadas das tarefas do roadmap; valem como referência de V3C-T1 e V3C-T2.

```
balance.heroes (V3C-T1.1)
  wagePerHour: 2                       // ouro por hora de jogo, por herói que recebe
  arrears:
    discontentAfterRealMs: 12 h reais
    leaveAfterRealMs:      24 h reais
    leaveEveryRealMs:       2 h reais
    resumeWithinRealMs:     2 h reais
    discontentFactor:      4/5
  maxLevel: 10
  levelBonus: 8/100                    // por nível acima do 1, sem compor
  xpToNext: [100, 282, 519, 800, 1118, 1469, 1852, 2262, 2700]

tavern (V3C-T2.1)
  requires: { townHall: 3 } · 180 madeira, 60 pedra, 120 ouro · 15 min · nível máximo 5
  offersByLevel: [2, 2, 3, 3, 3]
  rotationMs: 12 dias de jogo
  moralePerLevel: 5
  heroLimitBase: 1 · heroLimitPerLevel: 1
  festival: { cost: { food: 100, gold: 50 }, morale: 15, durationMs: 24 h de jogo, perSeason: 1 }
  desconto do Carismático: 4/5 do preço, uma vez (dois Carismáticos não somam)
```

### Detalhes que as premissas deixavam abertos, com a leitura do agente

Não foram perguntados. Cada um é a leitura mais próxima da premissa aprovada e pode ser trocado no plano da tarefa.

- **O herói que o prazo deve e não pode partir** (decisão 3; V3C-T1.4 deixava a escolha ao plano). Vale a frase da premissa, "quem está fora só pode partir depois de voltar": o herói devido continua devido **enquanto o atraso durar** e parte na primeira virada em que houver no feudo um herói que não seja Leal. Fechado o atraso, nada fica devido (não há dívida). Se só restam Leais, ninguém parte.
- **Quem recebe soldo** (decisão 3): o ferido recebe; o capturado, não. A premissa só excluía o capturado.
- **A roteirizada com a mesa cheia** (decisão 6; V3C-T3.3): ela espera a audiência seguinte, sem se perder. Se isso basta ou se ela passa a reservar lugar como uma continuação é mudança de regra do Conselho e fica para o plano de V3C-T3.
- **A mesma oferta duas vezes na mesma rotação** (decisão 4): a premissa não diz se o sorteio dos modelos é com reposição. Fica para o plano de V3C-T2; os pesos abaixo foram pensados para sorteio **sem** reposição dentro de uma rotação.

## Números que o GDD não tinha (V3A-T2.5)

**Estado desta seção: proposta pelo agente, aprovada em bloco; conteúdo, ajustável pelo simulador.** O autor não leu os números. Mudar um deles depois é mudança de conteúdo e de golden, sem novo ADR, desde que a calibragem abaixo continue valendo.

### Atributos-base das classes (nível 1)

| Classe | `id` | Vida | Ataque | Defesa | Velocidade | Perícia | Vontade | Poder no nível 1 |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| Guerreiro(a) | `warrior` | 120 | 14 | 16 | 8 | 6 | 8 | **42** |
| Arqueiro(a) | `archer` | 90 | 18 | 9 | 14 | 14 | 8 | **36** |
| Mago(a) | `mage` | 70 | 22 | 6 | 9 | 10 | 16 | **35** |
| Clérigo/Clériga | `cleric` | 100 | 9 | 13 | 9 | 8 | 16 | **32** |

O poder é `ataque + defesa + vida ÷ 10`. Velocidade, Perícia e Vontade não entram no poder: servem aos **pesos de atributo dos nós** ("perícia pesa ×1,5", V3D-T1.1) e a requisitos. **Como um peso de atributo vira fator do poder não está definido em lugar nenhum** (nem na premissa 7, nem em V3D-T1.6): é pergunta para o plano de V3D-T1.

**Calibragem, conferida por conta exata sobre os 31 valores da sorte (85 a 115):**

| Equipe | Poder | Dificuldade | Sucesso Pleno | Sucesso | Revés | Desastre |
|---|---:|---:|---:|---:|---:|---:|
| Guerreiro Nv1 | 42 | 30 | 23 | 8 | 0 | 0 |
| Guerreiro Nv1 | 42 | 35 | 7 | 24 | 0 | 0 |
| Guerreiro Nv1 | 42 | 36 | 4 | 26 | 1 | 0 |
| Arqueiro Nv1 | 36 | 30 | 7 | 24 | 0 | 0 |
| Mago Nv1 | 35 | 30 | 4 | 26 | 1 | 0 |
| Clérigo Nv1 | 32 | 30 | 0 | 22 | 9 | 0 |
| Guerreiro + Arqueiro Nv2 | 84,24 | 50 | 31 | 0 | 0 | 0 |
| Guerreiro + Arqueiro Nv2 | 84,24 | 60 | 23 | 8 | 0 | 0 |
| Guerreiro + Arqueiro Nv2 | 84,24 | 90 | 0 | 9 | 22 | 0 |
| Guerreiro + Arqueiro + Mago Nv2 | 122,04 | 90 | 20 | 11 | 0 | 0 |

- **Patrulha dos Arredores:** com dificuldade **até 35**, um Guerreiro de nível 1 sozinho tem ao menos Sucesso em todos os valores da sorte, e com 36, em 30 de 31: a restrição da premissa 7 (mais de 9 em 10 sementes) pede **dificuldade de no máximo 36** nos nós da Patrulha. A recomendação para V3D-T3 é **30**, que também dá Sucesso a um Arqueiro sozinho (quem escolheu "Cuidar e deixar partir" tem Rolf, e não Edda) em todos os valores.
- **Ruínas de Vel'Thar** (dificuldades 50, 60 e 90 do exemplo da §13.2 do roadmap, para 2 a 3 heróis de nível 2 ou mais): a dupla da carta passa os nós de 50 e 60 e, contra o chefe, fica entre o Sucesso e o Revés; o terceiro herói garante o chefe.
- **O que a conta já mostra, para V3D-T3.6:** com estes números a equipe mínima das Ruínas **nunca** chega ao Desastre, e portanto nunca à captura marcada no chefe. Se a captura tem de ser possível ali, sobe a dificuldade do chefe ou a exigência de nível; não se mexe na tabela por causa de um grafo.

### Os oito traços, só com o que a v0.3 usa

| Traço | `id` | Efeito na v0.3 | O que do Apêndice D fica fora |
|---|---|---|---|
| Corajoso | `brave` | Poder do herói ×11/10 nos nós de uma expedição enviada com a Postura **Ousada**; no sorteio de quem sofre um ferimento, pesa 6 contra 5 dos outros (os "+20%") | — |
| Prudente | `prudent` | Poder do herói ×11/10 nos nós de uma expedição enviada com a Postura **Cautelosa**; em nó `hazard`, não é sorteado para o ferimento leve de um Revés (se a equipe inteira for Prudente, ninguém se fere) | — |
| Ganancioso | `greedy` | Com um Ganancioso na equipe, os **recursos** do saque ×5/4 (não soma por herói); em cada nó com dificuldade, 10% de o saque **daquele nó** se perder, sorteado no fluxo da expedição | — |
| Carismático | `charismatic` | Abre opções de carta com requisito `heroTrait` (V3F-T1.3); com um no feudo, os candidatos da Taverna custam 4/5 do preço | — |
| Devoto | `devout` | +5 de moral do feudo, uma vez por herói Devoto presente (V3C-T2.4); pode cumprir requisito `heroTrait` de carta | "Maldições" (não existem nesta versão) |
| Veterano | `veteran` | Nasce um nível acima: o nível já vem escrito no modelo ou no herói nomeado, sem efeito em tempo de execução | Aura de comandante (v0.4): não entra nem como campo |
| Leal | `loyal` | Nunca fica Descontente nem parte por soldo em atraso | — |
| Rastreador | `tracker` | Onde o grafo dá a revelação de um destino só a partir do Sucesso, um Rastreador na equipe a garante também no Revés | "Tile extra" (o mapa é da v0.5) |

Três dessas leituras criam regra que o Apêndice D só esboça e pedem confirmação no plano da tarefa que as implementa: o sorteio de 10% do Ganancioso (entra na ordem fixa dos sorteios do nó, V3D-T1.6, depois da sorte), "armadilhas simples" lido como nó `hazard` (Prudente) e o Rastreador. Se o catálogo de V3D-T3 não condicionar a revelação ao desfecho, o Rastreador fica sem efeito e sai dos modelos de candidato.

### Modelos de candidato da Taverna

| # | `id` | Classe | Traços | Nível inicial | Peso | Preço (ouro) |
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

A soma dos pesos é 33. O preço é o do modelo, sem sorteio. Os heróis nomeados da carta (Edda, Guerreira Leal, nível 1; Rolf, Arqueiro Prudente, nível 1) não são modelos da Taverna. Leal só aparece no modelo mais caro e mais raro: é o traço que anula o risco do soldo em atraso. O Mago, que o Pântano Nebuloso exige, tem 5 dos 33 pesos; se a cobertura de V3D-T3.6 mostrar que o jogador de duas visitas não consegue um a tempo, sobe o peso, não o preço. A lista de nomes dos candidatos é conteúdo de V3C-T2.

## Consequências e verificação

- **As tarefas das Fases B e C não têm mais decisão aberta.** Onde o roadmap diz "se o autor preferir tempo de jogo" (V3C-T1.1) ou "se a decisão 3 ficar como recomendada" (§0.7), vale o que está aqui: tempo real.
- **A decisão 2 torna falsas várias frases do roadmap**, que este ADR não corrige: a §0.8 (branches de fase, *pull request*, "`push` só quando o autor mandar"), os cabeçalhos das Fases C a F ("Branch `v3c-herois`"…), os prompts que dizem "em branch" e a regra de `CLAUDE.md` de que tarefas `L` vão em branch. Vale a instrução do autor: tudo no `main`.
- **O que o autor não vai fazer, e fica como pendência, não como feito:** jogar cada fase antes de ela ser publicada. As revisões "com o autor jogando" do roadmap viram revisão depois da publicação. Quem joga em produção recebe cada fase sem que o autor a tenha jogado antes.
- **"Versão estável" é interpretação do agente** (linha 2). Se o autor quiser outra régua (por exemplo, só depois da Fase D, quando os heróis têm o que fazer), vale a dele. Até a Fase D o soldo é cobrado de heróis sem trabalho: publicar a Fase C sozinha entrega isso a quem joga.
- **O ato 23 da §9.3 do roadmap continua do autor** (backup fora do servidor, cópia do `RECOVERY_CODE_SECRET`, ensaio de reversão com duas imagens). O roadmap diz que ele bloqueia a chegada de qualquer migração de estado à produção; a autorização de `push` desta sessão não o cumpre. O backup manual antes de cada `push` é o mínimo que o agente consegue fazer, não o substituto.
- **Tempo real no motor ganha cinco constantes:** a espera da encruzilhada e os quatro prazos do atraso do soldo, todos convertidos por `realToGameMs`. A consequência do atraso não ganha instante próprio na linha do tempo: é cobrada na virada do dia, logo depois da deserção por fome.
- **A validar no simulador** (a aprovação em bloco é condicionada a isso): o perfil Preguiçoso não perde herói por uma noite fora em nenhum ritmo; no Tranquilo, o aviso de "Antes de partir" chega antes das 12 h reais; o jogador de duas visitas vê cada lista da Taverna ao menos uma vez; quantos heróis o perfil Dedicado sustenta; moral média com e sem Taverna; a Patrulha com a equipe mínima em mais de 9 de 10 sementes. Um resultado ruim volta ao autor como pergunta pontual, com o número medido.
- Toda regra com prazo tem teste em um ritmo diferente de 1, e a divisão de intervalo continua exata com o soldo, o atraso, a rotação e o festival no caminho.
- O GDD passou à versão 0.8 com as frases que estas decisões mudam.
