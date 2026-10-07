# 0018 — Expedições, Mercado, Mestres e cartas na v0.3

Data: 2026-10-05\
Estado: **aprovada pelo autor em 2026-10-05, em sessão de perguntas**. As decisões **11 a 21** foram aprovadas **em bloco**, com a premissa recomendada de cada uma, **sem leitura item a item**. Respondido à parte: **o modo do conteúdo narrativo** das decisões 12 e 19 ("Escrevo e sigo; você revisa depois"). Nenhum grafo de expedição e nenhuma carta do lote 2 foram lidos pelo autor. Nada aqui estava implementado na data da sessão. **Em 2026-10-06, com a Fase D no motor (V3D-T1 a T3), o autor respondeu a três pontos dela** (seção "Respostas de 2026-10-06"): a decisão 14 ganhou a regra do outono, confirmada\
Escopo: GDD §5.4, §5.9, §6.1, §8.2, §9.2, §9.3, §9.4, §12.2 e Apêndices B e C; [roadmap da v0.3](../roadmap-v0.3.md), lote 2 de decisões (V3D-T0, decisões 11 a 21 da §9.2): Fases D, E e F

## Contexto

Segundo lote das decisões da §9 do [roadmap da v0.3](../roadmap-v0.3.md): expedições, Mercado, caravanas, Mestres, o lote 2 do Conselho e os objetivos. O plano previa uma sessão própria para ele (V3D-T0), depois da Fase C. Em 2026-10-05 o autor respondeu aos dois lotes na mesma sessão, e o que ele disse está no Contexto do [ADR 0017](0017-regras-da-v0.3-herois-taverna-e-soldo.md). Para este lote:

- **Decisões 11 a 21:** "Todas as recomendadas, em bloco". As premissas da §9.2 valem como aprovadas, sem leitura item a item; se o simulador mostrar problema em alguma, ela volta ao autor como pergunta pontual.
- **Conteúdo narrativo (os 18 grafos de expedição e as 24 cartas, decisões 12 e 19):** "Escrevo e sigo; você revisa depois". O agente escreve, registra cada grafo e cada carta em `docs/content-v0.3.md` (arquivo que V3C-T3 cria) com o estado **"rascunho, não lido pelo autor"**, e implementa **sem esperar aprovação** grafo a grafo ou carta a carta.

Os números de cada linha são os da §9 e os das tarefas do roadmap, copiados para cá: nas tarefas das Fases D a F, a referência passa a ser este ADR. Duas coisas que V3D-T0 previa **não aconteceram**: o autor não viu o catálogo da §13.2 nem o lote da §13.3 (V3D-T0.1), e não recebeu os números da Fase C (V3D-T0.2), que ainda não existe.

## Decisão

| # | Decisão | O que foi aplicado | Alternativa descartada | Razão | Tarefas | GDD |
|---|---|---|---|---|---|---|
| 11 | Encruzilhada e Postura | A opção de cada Postura é **marcada em cada encruzilhada** (`posture: { cautious; balanced; bold }`), como o Apêndice C do GDD já faz. A opção da **Cautelosa nunca tem requisito**. Se a opção marcada estiver bloqueada para a equipe, vale a da Cautelosa. A espera é de **12 h reais** em qualquer ritmo (ADR 0017, decisão 1), convertida quando a equipe chega ao nó. O prazo resolve **antes** de um comando no mesmo instante (`CROSSROADS_DECIDED`). A equipe parada continua recebendo soldo | O motor calcular o "melhor valor esperado" | Calcular é ambíguo e não testável; é a mesma lição da opção automática das cartas (ADR 0014, decisão 9) | V3D-T1 | §9.2, Apêndice C |
| 12 | Quais expedições entram, e como aparecem | **Seis modelos, três variantes cada (18 grafos).** Primeira entrega: Patrulha dos Arredores, Floresta Antiga, Covil dos Lobos e Resgate. Segunda: Ruínas de Vel'Thar e Pântano Nebuloso. **Ficam fora:** Mina Abandonada (ferro), Acampamento de Saqueadores (batalha), Sabotagem da Fortaleza da Horda e Caçada ao Dragão. Recompensa de versão futura vira item da raridade equivalente (a planta da Capela, um item raro; a relíquia do Pântano, um item épico). Um destino aparece **por descoberta, não por data**: Patrulha e Floresta com a Guilda Nv1; o Covil é conhecido desde a v0.2; as Ruínas são reveladas por uma Patrulha ou por carta; o Pântano, pelas Ruínas, e pede Guilda Nv3; o Resgate, enquanto houver um capturado. **A Guilda vai até o nível 4 nesta versão.** **Modo (respondido):** o agente escreve os grafos e implementa; ficam marcados "rascunho, não lido pelo autor" | Os dez modelos do GDD; disponibilidade por dia de jogo; aprovação grafo a grafo antes de transcrever (a premissa da §9 e de V3D-T3.3) | O §9.3 do GDD mistura mecânicas de três versões, e a coluna "Disponível: dia N" está no ritmo Normal sem dizer se é data ou gate. O nível 5 da Guilda não mudaria nada que o jogador vê (ADR 0014, decisão 11). O modo é instrução direta do autor | V3D-T1, V3D-T3 | §6.1, §9.2, §9.3 |
| 13 | O que o jogador sabe antes de enviar | Duração total, risco em palavra (Baixo, Médio, Alto), poder da equipe e a dificuldade do **primeiro trecho**, até a primeira encruzilhada. O que vem depois aparece como "?" até a equipe chegar. Cada opção de encruzilhada traz uma **pista** do risco e da recompensa. A dificuldade e o conteúdo dos nós depois de uma encruzilhada não alcançada não saem do servidor | O grafo inteiro à vista; só o rótulo de risco | Pilar 3 do GDD ("nada de dados ocultos sem pista") contra a graça de explorar | V3D-T1, V3D-T4 | §9.2 |
| 14 | Covil limpo e Ameaça | Limpar o Covil: **Ameaça −30**, e o tile para de somar os seus +2 por dia (`map.tiles.wolfDen.threatActive` passa a falso). **Na virada do ano os lobos voltam**: o tile fica ativo de novo. Sem Torre, o jogador sabe que limpou o Covil, e não o número da Ameaça. **Confirmado em 2026-10-06:** com o Covil limpo, no outono os lobos descem a serra assim mesmo (`threat.seasonEnemy`): só o outono soma e só nele há sorteio de incursão | Limpo para sempre (Torre e Paliçada perderiam a função no ano 2); volta depois de N dias | O Covil é o único tile de ameaça até a v0.4 | V3D-T2 | §8.2 |
| 15 | Equipamento e custo de enviar | Três espaços (`weapon`, `armor`, `accessory`), quatro raridades (Lendário fora). Itens vêm de expedições e de objetivos. **Sem desgaste nem reparo. Sem venda de item.** Inventário com teto de **30**; item achado com o inventário cheio vira ouro pelo valor do conteúdo, com linha na Crônica. **Enviar uma expedição não custa provisões**: custa o tempo e o soldo da equipe | Itens à venda no Mercado; comida por herói por expedição | Reparo é do Ferreiro (v0.4); o teto limita o estado. O GDD §5.1 cita "expedições" entre os usos da comida, e o §9 não dá número | V3D-T2 | §9.1 |
| 16 | Mercado: preço, margem e volume diário | Comida, madeira e pedra (ferro fora). Bases do GDD (1,0, 1,2 e 2,0), em milésimos de ouro por unidade. O jogador compra pelo preço do dia e vende a **85%** dele. **O dia do Mercado é o dia de jogo**: preço e volume mudam na virada. Volume: **`200 × nível` por recurso por dia, somando compra e venda**. Passeio diário de até ±5%, com reversão de um décimo da distância à base, limitado entre **60% e 160%** da base. Comida ×1,3 no outono e no inverno, sobre o preço exibido. Compra que não cabe no cap é recusada inteira. Os preços só andam depois que o Mercado existe. A ordem leva o dia da cotação e é recusada se o dia virou (`PRICE_CHANGED`). O ouro pago arredonda para cima e o recebido, para baixo, em milésimos | Volume por dia real; margem dividida entre compra e venda | O GDD dá os números e deixa em aberto o que é "diário", como a margem se divide e até onde o passeio vai. No Rápido um dia dura 40 minutos: o volume por visita é o de um dia, e é isso que impede uma visita de esvaziar o estoque | V3E-T1 | §5.9, §6.1 |
| 17 | Caravanas | Mercado Nv2. Só venda, um recurso, até **300** unidades, **4 h de jogo** de viagem. Preço: o de venda do dia ×23/20 (**era ×7/5; mudou na resposta de 2026-10-07, abaixo**), **fixado no envio**. Uma caravana por vez; duas a partir do Mercado Nv4. Não conta no volume diário. Emboscada sorteada na chegada, no fluxo `caravan:<id>`: **`máx(2, 10 − 5 × nível da Torre)` por cento**; zero com escolta. A emboscada leva **metade** da carga, arredondada para baixo, e a outra metade é vendida. A escolta ocupa um herói até a chegada | "−5%" como redução relativa (10%, 9,5%, 9%); perda total | Com a Torre no nível 2, o máximo da v0.2, "−5% por nível" zeraria o risco e a escolta não serviria para nada: o piso de 2% mantém a escolha e o critério 5 da §16.2. O GDD não diz quanto se perde | V3E-T2 | §5.9 |
| 18 | Mestres | Aldeão nomeado. Conta como **habitante** (casa e comida) e, alocado, como **um trabalhador**. Dá **+15%** ao edifício produtivo em que trabalha (fator 23/20 na conta única da produção); **um por edifício**. Trocar de edifício passa pela adaptação de 1 dia de jogo, sem o bônus enquanto durar. **Nunca** é escolhido por deserção, partida por moral ou ferimento de incursão, e conta para o piso de população (**nota de 2026-10-07: já não conta; o piso protege 3 aldeões comuns, com quantos Mestres houver; ver "Respostas de 2026-10-07"**). Sem vaga, espera à porta e entra quando houver. Vem de cartas e de expedições | Mestre fora da população; bônus que soma | A v0.2 não tem "postos" (ADR 0013, decisão 13), então "ocupa um posto" precisa de leitura. Perder uma recompensa rara em um sorteio de deserção seria frustração sem decisão | V3E-T3 | §5.4 |
| 19 | Lote 2 do Conselho | **24 cartas**: 4 cadeias de 3 ("O Mercador Misterioso", "Os Refugiados", "O Lobo Branco", "O Cobrador do Rei"), 2 roteirizadas ("Estrangeira ferida", no dia 13 de jogo do ano 1, e "O mercador itinerante", no dia 20) e 10 avulsas (roadmap, §13.3). Total no jogo: **45 de 60**. **Adaptações:** "O Lobo Branco" entra sem relíquia, presságio nem cerco; "O Cobrador do Rei", sem batalha; "A Filha do Ferreiro" fica para a v0.4. A cadeia "Os Refugiados" e a avulsa "Mais bocas à mesa" do lote 1 se excluem por flag. Um requisito de traço ou de classe é cumprido por qualquer herói da equipe que não esteja capturado. **Efeito com sorteio é resolvido na virada de dia seguinte, no fluxo `council`, nunca no comando.** As três opções de `autoResolve` continuam sem custo e sem requisito. **Modo (respondido):** o agente escreve as cartas e implementa; ficam marcadas "rascunho, não lido pelo autor" | Só as duas cadeias que não pedem adaptação; exigir o herói presente no feudo; aprovação carta a carta, em lotes de 5, antes de transcrever (a premissa da §9 e de V3F-T1.7) | Das cinco cadeias do GDD §7.1, quatro cabem na v0.3 com adaptação. O modo é instrução direta do autor | V3F-T1 | §7.1, §7.2, Apêndice B |
| 20 | Objetivos 11 a 16 | Seis novos, com os de 1 a 10 intocados: 11 `welcomeFirstHero` ("Acolha ou contrate o primeiro herói", item comum) · 12 `buildGuild` ("Erga a Guilda dos Aventureiros: quem recebe soldo precisa de trabalho", +60 pedra) · 13 `sendPatrol` ("Envie uma Patrulha", +50 ouro) · 14 `sellSurplus` ("Venda no Mercado o que iria para o chão", +40 madeira) · 15 `chooseAtCrossroads` ("Escolha um caminho em uma encruzilhada", +10 de moral por 1 dia de jogo) · 16 `exploreRuins` ("Explore as Ruínas de Vel'Thar", item incomum). Os de exército continuam fora, sem buraco na sequência. O que já foi cumprido antes da migração conta e paga uma vez | Os objetivos do GDD como estavam (dependem de exército) | Três vêm do GDD §12.2 (11, 13 e 16); os outros três ensinam a Guilda, o Mercado e a encruzilhada no momento em que resolvem um problema sentido | V3F-T2 | §12.2 |
| 21 | Propostas de experiência (IDEIA-08 a 12) | **Todas entram** como interface ou conteúdo (roadmap, §13.1), e nenhuma muda regra: "a equipe espera por você", o relatório que se reconta, o soldo em horas, a saída ao lado do problema, o herói na Crônica | Deixar para depois do playtest | São o que torna as mecânicas legíveis; nenhuma cria moeda, tarefa diária ou prêmio por login | V3C-T4, V3D-T3, V3D-T4, V3E-T4, V3F-T3 | §9.4, §13 |

### Constantes de conteúdo que as tarefas usam

Copiadas das tarefas do roadmap; valem como referência de V3D-T1, V3D-T2, V3E-T1, V3E-T2 e V3E-T3.

```
guild (V3D-T1, entregáveis)
  requires: { townHall: 3 } · 300 madeira, 100 pedra, 200 ouro · 20 min · nível máximo 4 nesta versão

balance.expeditions (V3D-T1.1)
  crossroadsWaitRealMs: 12 h reais
  summerDuration: 17/20                 // fixado no envio
  outcome: { full: 13/10, success: 1/1, setback: 7/10 }
  luck: { min: 85, max: 115 }
  slotsByGuildLevel: [1, 2, 2, 3]
  reportsKept: 3
  grafo: 3 a 5 nós de profundidade · 10 a 45 min de jogo por nó · três variantes por modelo

balance.injuries e itens (V3D-T2)
  ferimento leve: 2 h de jogo · grave: 12 h de jogo
  Resgate: 2 h de jogo, 2 nós, 2 heróis
  Covil limpo: Ameaça −30; o tile volta na virada do ano
  inventário: teto de 30 · espaços: weapon, armor, accessory · quatro raridades

market (V3E-T1.1)
  requires: { townHall: 3 } · 150 madeira, 100 pedra, 150 ouro · 15 min · nível máximo 5
  resources: ['food', 'wood', 'stone']
  basePrice: { food: 1000, wood: 1200, stone: 2000 }    // milésimos de ouro por unidade
  sellRatio: 17/20
  dailyVolumePerLevel: 200
  walk: { maxStepPerMille: 50, reversion: 1/10, floor: 3/5, ceiling: 8/5 }
  seasonal: { food: { autumn: 13/10, winter: 13/10 } }
  marketPriceSwing: evento só quando um preço cruza 80% ou 125% da base

market.caravan (V3E-T2.1)
  requiresLevel: 2 · maxUnits: 300 · tripMs: 4 h de jogo · priceRatio: 23/20 (era 7/5 até 2026-10-07)
  slotsByLevel: [0, 1, 1, 2, 2]
  ambush: { basePercent: 10, perWatchtowerLevel: 5, floorPercent: 2, lossRatio: 1/2 }

masters (V3E-T3.1)
  bonus: 3/20 · maxPerBuilding: 1 · adaptação ao trocar de edifício: 1 dia de jogo
```

### O catálogo de expedições desta versão

Do GDD §9.3, com as durações do GDD (tempo de jogo). É a tabela da §13.2 do roadmap, que passa a valer como ponto de partida do conteúdo.

| Modelo | Duração | Nós | Equipe | Risco | Recompensas na v0.3 | Como aparece | Entrega |
|---|---:|---:|---|---|---|---|---|
| Patrulha dos Arredores | 15 min | 2 | 1 herói | Baixo | Ouro, experiência, revela um destino | Guilda Nv1 | 1ª |
| Floresta Antiga | 1 h | 3 | 1 a 2 heróis | Baixo a médio | Madeira, ouro, item comum | Guilda Nv1 | 1ª |
| Covil dos Lobos | 2 h | 3 | 2 heróis | Médio | Ameaça −30; ouro; abre a cadeia "O Lobo Branco" | Conhecido desde a v0.2 | 1ª |
| Resgate | 2 h | 2 | 2 heróis | Alto | Recupera o herói capturado | Enquanto houver um capturado | 1ª |
| Ruínas de Vel'Thar | 3 h | 4 | 2 a 3 heróis, nível 2 ou mais | Médio | Pedra, ouro, item raro | Revelado por uma Patrulha ou por carta | 2ª |
| Pântano Nebuloso | 5 h | 5 | 3 heróis, 1 Mago | Alto | Item épico, ouro | Revelado pelas Ruínas; Guilda Nv3 | 2ª |

### O conteúdo narrativo: o que "escrevo e sigo" muda

- Cada grafo e cada carta nasce em `docs/content-v0.3.md`, com a ficha da §13.4 do roadmap, e com o estado da curadoria **"rascunho, não lido pelo autor"**. A escala da ficha continua (rascunho → cenário validado → aprovado → implementado → observado no playtest), mas o conteúdo entra no jogo **sem passar por "aprovado"**: esse passo é do autor e fica pendente, um por grafo e um por carta.
- As tarefas V3D-T3 (V3D-T3.3, "Pronto quando: os grafos aprovados pelo autor") e V3F-T1 (V3F-T1.7, "as 24 cartas aprovadas pelo autor") **não ficam prontas pela aprovação**: ficam prontas com o conteúdo implementado, testado e marcado como rascunho. O mesmo vale para o texto da "Estrangeira ferida" (V3C-T3.2).
- Texto e números das cartas e dos grafos são conteúdo, fáceis de trocar; os **ids** de carta, de opção e de modelo de expedição, uma vez publicados, só mudam com passo de migração. Vale o que valeu no lote 1: quando o autor revisar, cada reescrita é mostrada a ele antes de entrar.
- O teste editorial que o roadmap pede a quem escreve continua: para cada opção de encruzilhada e de carta, um cenário em que ela é a escolha razoável e um em que é ruim; a opção da Equilibrada não pode ser a melhor para toda equipe; nenhuma opção de herói dominante.

## Respostas de 2026-10-06

Com o motor das expedições, os desfechos e o catálogo implementados (V3D-T1 a V3D-T3), o autor respondeu em sessão de perguntas a três pontos que a implementação levantou. Valem onde divergirem do texto acima.

| Ponto | Resposta do autor | O que vale |
|---|---|---|
| **Os lobos do outono** (pendência D-24; a validação que a decisão 14 mandava voltar a ele) | **"Manter os lobos do outono"** | A regra que o agente criou na V3D-T2 fica: **no outono os lobos descem a serra, com o Covil limpo ou não** (`balance.threat.seasonEnemy: { autumn: 'wolves' }`). Com o Covil limpo, a primavera, o verão e o inverno não têm subida da Ameaça nem sorteio de incursão (a incursão que já estava marcada ainda chega); o outono soma os seus +3 por dia e sorteia, como sempre. Na virada do ano o tile volta a ficar ativo. Descartadas: nenhum lobo até a virada do ano; o Covil limpo por N dias; limpo para sempre. Nenhum código mudou com a resposta |
| **O prazo da encruzilhada** (decisão 11; pendência D-71; terceira rodada, mesmo dia) | **"12 h reais"** (era 6 h) | Sem resposta em 12 h reais, em qualquer ritmo, a Postura decide. Muda só o número (`crossroadsWaitRealMs`); a regra da Postura e o bloqueio da opção marcada ficam. Convertido no nascimento do prazo: o que já estava parado não muda, sem passo de migração |
| **As variantes dos grafos** (decisão 11 e conteúdo; pendência D-54) | **"Fica assim"** | O ciclo 0, 1, 2 por destino fica |

As outras duas respostas do mesmo dia são do lote 1 e das dificuldades: o herói capturado e o limite de heróis ([ADR 0017](0017-regras-da-v0.3-herois-taverna-e-soldo.md), decisão 5 e "Respostas de 2026-10-06") e a frase sobre o destino dos heróis na descrição de cada dificuldade ([pendências da v0.3](../pendencias-v0.3.md), D-25).

## Respostas de 2026-10-07

Com a Fase E implementada (V3E-T1 a T4) e a revisão independente feita (V3E-T5.1), o autor respondeu em uma quarta rodada de perguntas. Valem onde divergirem do texto acima.

| Ponto | Resposta do autor | O que vale |
|---|---|---|
| **A arbitragem balcão → caravana** (decisão 17; defeito D1 da revisão: com ×7/5 a caravana pagava 0,85 × 1,4 = 1,19 do preço de compra, e comprar 300 no balcão para enviar no mesmo instante rendia 57 de ouro na comida, 68,4 na madeira e 114 na pedra, sem risco com escolta) | **"Caravana paga +15% sobre o balcão"** | `market.caravan.priceRatio` passa de 7/5 para **23/20**: 17/20 × 23/20 = **0,9775** do preço de compra, e a manobra sempre perde (na base, −6,9, −8,1 e −13,5 de ouro por 300 unidades). O schema do conteúdo recusa `sellRatio × caravan.priceRatio ≥ 1`. **A especulação sazonal fica**, menor: comida comprada no verão a 1,00 e enviada no outono rende 0,27 por unidade na base (era 0,547), limitada ao que o depósito guarda; a medição por ano está em [docs/balance-v0.3.md](../balance-v0.3.md), "Revisão da Fase E". A caravana que já estava na estrada mantém o preço fixado no envio (não há partida em produção com caravana: a Fase E não foi publicada) |
| **O piso de população e os Mestres** (decisão 18; achado da revisão: com o piso contando habitantes, cada Mestre tirava um aldeão da proteção, e a fome de 60 dias com 6 aldeões e 0, 1, 2, 3 ou 4 Mestres deixava 3, 2, 1, 0 e 0 aldeões) | **"O piso protege 3 aldeões"** | `aboveFloor` volta a contar só `population.villagers`: nenhuma partida por moral e nenhuma deserção por fome deixam menos de 3 **aldeões**, com quantos Mestres houver (no mesmo cenário: 3 em todos). O Mestre continua habitante para a casa, a comida, a lenha, as casas cheias e a comida guardada da moral; só o piso deixou de contá-lo. A nota da moral diz "com 3 aldeões ou menos" |
| **A primeira alocação do Mestre** (decisão 18; pendência E-30: na V3E-T3 o agente decidiu que toda chegada a um edifício, a primeira inclusive, custava a adaptação) | **"É imediata"** | O Mestre que nunca trabalhou em edifício nenhum, ao ser alocado pela primeira vez, **rende inteiro e com o bônus na hora**. Só mudar de um edifício para outro custa 1 dia de jogo sem o bônus. **Decidido pelo agente, para o autor rever** (a resposta deixou a pergunta aberta): quem já teve um edifício e ficou livre **também paga a adaptação ao voltar a trabalhar**, até no mesmo edifício; sem isso, uma ordem intermediária que o deixasse livre tornaria toda troca gratuita. O estado ganhou `worked` em cada Mestre do feudo (**versão 24**); na migração, quem tem edifício ou está em adaptação já trabalhou, e quem está sem edifício ganha a alocação imediata, uma vez. A visão diz a verdade nos dois casos (`masters[].firstAssignment`, `assignText`, e `options[].gainWhileAdaptingPerHour` igual a `gainPerHour` quando não há adaptação a pagar) |

## Consequências e verificação

- **Nenhuma tarefa de D, E ou F tem decisão de regra aberta.** O que ficou aberto é de plano de tarefa: como um peso de atributo de nó vira fator do poder (ADR 0017, "Números que o GDD não tinha"), e as leituras dos traços Ganancioso, Prudente e Rastreador.
- **A encruzilhada sobe o protocolo para 3** (V3D-T1.10): é consequência da decisão 11 e já estava no plano; quem está com o app aberto recebe `426` e recarrega.
- **A conferir com os números que o autor confirmou no ADR 0016** (decisão 14): +2 por tile, +3 no outono, −35 por incursão, sorteio só acima de 40. Com o Covil limpo, só o outono soma. O simulador tem de dizer a Ameaça média por estação com e sem a expedição, e se limpar o Covil na primavera deixa o feudo sem incursão nenhuma até o outono. Se deixar, a decisão 14 volta ao autor. **Voltou, e ele respondeu em 2026-10-06** (seção acima): deixa, e os lobos do outono ficam.
- **Comprar comida no fim do verão e vender no outono dá lucro, e é intencional** (decisão 16): fica à vista no aviso de estação e é limitado pelo volume e pelo cap. O que não pode dar lucro é uma sequência de compra e venda no mesmo dia.
- **A validar no simulador** (a aprovação em bloco é condicionada a isso): a parcela das encruzilhadas decididas pelo jogador no perfil de 2 visitas; capturas por ano no perfil Regular; horas de herói ocioso; a matriz QA-10 das caravanas (com e sem escolta × Torre 0, 1 e 2); se o bônus do Mestre torna um edifício obrigatório; a cobertura das cartas por posse (V3F-T1.9) e a dos modelos por estação (V3D-T3.6). Um resultado ruim volta ao autor como pergunta pontual, com o número medido.
- **O que o autor não leu e está no jogo como rascunho** tem de aparecer em um lugar só, para a revisão dele: o inventário `docs/content-v0.3.md` e uma linha por pendência em `docs/pendencias-v0.3.md` (nenhum dos dois existe ainda; nascem com as tarefas).
- Cada item de regra entra com conteúdo, golden, GDD e teste no mesmo commit (regra 8 do projeto). O GDD passou à versão 0.8 com as frases que estas decisões mudam; os Apêndices B e C ganharam só a nota do que a v0.3 troca.

## Nota de 2026-10-06 à decisão 15: os bônus de item de um herói somam

A revisão independente da Fase D (achado B15) mostrou que os itens, como fatores que se multiplicavam um a um (entre si e com o nível e o traço), faziam uma equipe de nível 2 com nove itens raros valer 244 contra o chefe mais forte do catálogo (170), sempre com Sucesso. **Desde o commit `V3D: corrige os bônus de item…`, os itens de um herói entram na conta do poder como um fator só: 1 mais a soma dos bônus.** Três raros valem +36%, e não 1,12³ = +40,5%; com um item só nada muda. O nível e o traço continuam multiplicando.

É decisão do agente, aplicada sem a pergunta ao autor (pendência D-65 de [pendencias-v0.3.md](../pendencias-v0.3.md)): voltar a multiplicar é desfazer um bloco de `heroFactors`, em `packages/engine/src/heroes.ts`. O resto da decisão 15 não muda. Na mesma revisão, dois identificadores de item foram trocados sem passo de migração (`pilgrimRelic` → `travelerMedal`, `oldKingSignet` → `captainChain`): nenhuma versão publicada tem itens.
