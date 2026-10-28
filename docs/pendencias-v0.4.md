# Pendências e dúvidas da v0.4

> **Para ler primeiro.** A v0.3.0 está no ar desde 2026-10-15 (estado 24, protocolo 3). Em 2026-10-16 o autor respondeu, uma a uma, às decisões do lote 1 da v0.4 e à herança da v0.3: todas com a premissa recomendada ([ADR 0019](decisions/0019-ferro-exercito-formacoes-e-combate-na-v0.4.md)). Este arquivo é a caixa de entrada do autor durante a v0.4, no molde de [pendencias-v0.3.md](pendencias-v0.3.md). Cada item diz o que vale enquanto não houver resposta.

## 1. O mais importante

0. **O ferro (V4B-T1) está no `main` desde 2026-10-19**, sem publicação (decisão 26). As dúvidas dele são as B-1 a B-10, na seção 5; a B-8 foi respondida (só a Floresta Antiga revela a Mina).

1. **Os números das Fases B e C foram aprovados em 2026-10-16** (V4A-T2.5; [ADR 0019](decisions/0019-ferro-exercito-formacoes-e-combate-na-v0.4.md), "Números propostos"): durabilidade 8/10/14/20, reparo a 1 ou 2 ferro por ponto, e o resto da tabela em bloco. A Fase B pode começar.
2. **A v0.4 começa sem ninguém ter jogado a v0.3** (V4A-T1.9). Nem você, nem outras pessoas, e o conteúdo dela (18 grafos, frases da Taverna, cartas, objetivos) continua rascunho que você não leu. A lição 8 da v0.3 diz que isso é o que mais custa no fim.
3. **O ato 23 precisa acontecer antes da primeira publicação da v0.4**, no fim da Fase E (decisão 26): backup fora do servidor, cópia do `RECOVERY_CODE_SECRET` fora do Coolify e o ensaio de reversão com imagens atravessando uma migração de estado. A v0.3 subiu doze versões de estado sem ele.
4. **A migração da v0.3 em produção não foi conferida no banco** (V4A-T1.1). O arranque migrou 4 partidas sem falha; falta o SQL de [deploy/README.md](../deploy/README.md) dizer que nenhuma partida ativa ficou abaixo de `schema_version = 24`.
5. **O lote 2 de decisões** (15 a 24: Horda, presságios, sabotagem, Cerco, milícia, Crônica do Ano, cartas, objetivos 17 a 21) só trava a Fase E e tem sessão própria (V4E-T0, ADR 0020). As premissas estão no [roadmap](roadmap-v0.4.md), §11.2.

## 2. O que continua aberto da v0.3

O registro completo está em [pendencias-v0.3.md](pendencias-v0.3.md). Respondidos em 2026-10-16 (ADR 0019): F-1 (o objetivo 12 fica), F-3 (o lote 2 vai para a Fase H; decisão 1), F-4 (o alarme passa do limite de 3 por hora; GDD §13.5), E-51 e E-54 (as marcas da Crônica e o soldo por nível, aprovados) e B-2 (as sessões não são reimportadas numa restauração). O que sobra:

| Item | O que é | Vale enquanto não houver resposta |
|---|---|---|
| **F-5** | A partida migrada que já voltou das Ruínas não conta o objetivo 16 | Nada: a produção nasceu na v0.3 já com o contador. Se aparecer, uma acomodação que some os relatórios |
| **F-6** | A ordem dos itens de "Antes de partir" não é a da V3F-T3.1 | A ordem do código |
| **P1 a P3** (plausíveis da revisão da Fase F) | O depósito que pode aparecer em dois blocos do Retorno; a caravana sem escolta como "alerta"; a marca da Postura entre duas visitas | Nada, até alguém ver na tela |
| **E-55 a E-60** | Decisões do agente na revisão da Fase E (o excedente como reserva simples, nomes no estado, o especulador) | Como estão |
| **"Ouro com destino"** | O ouro parado não caiu na v0.3 (menos de 0,5%) | A decisão 2: medir depois do Quartel (V4C-T4.3) e voltar com propostas antes da Fase D |
| **O conteúdo da v0.3** | 18 grafos, relatórios, Taverna, cartas da estrangeira, objetivos 11 a 16: rascunho | Fica como está; mudar uma frase é conteúdo, golden e GDD no mesmo commit |

## 3. O que só o autor pode fazer

| # | O quê | Quando |
|---|---|---|
| 27 | Conferir `schema_version = 24` no banco e o log do job; criar a tag `v0.3.0` e a release | Antes da Fase B |
| 28 | O ato 23: backup fora do servidor, cópia do `RECOVERY_CODE_SECRET`, ensaio de reversão | Antes do fim da Fase E |
| 29 | Jogar a v0.3 ([manual-test-v0.3.md](manual-test-v0.3.md)) e preencher [acceptance-v0.3.md](acceptance-v0.3.md); ler [content-v0.3.md](content-v0.3.md) | Quando puder; de preferência antes da Fase B |
| 30 | Playtest com outras pessoas (nunca houve, em versão nenhuma) | Depois da segunda publicação da v0.4 |
| 31 | Os oito pontos do ADR 0012 e o vínculo GitHub | Sem trava |

## 4. As decisões da v0.4

**Lote 1 (decisões 1 a 14, 25 e 26): respondido em 2026-10-16**, todas com a premissa recomendada ([ADR 0019](decisions/0019-ferro-exercito-formacoes-e-combate-na-v0.4.md)).

**Os números das Fases B e C (V4A-T2.5): aprovados em 2026-10-16** (ADR 0019, "Números propostos").

**Lote 2 (decisões 15 a 24): a decidir, na sessão V4E-T0.** Premissas recomendadas no [roadmap](roadmap-v0.4.md), §11.2:

| # | Decisão | Premissa recomendada, em uma linha |
|---|---|---|
| 15 | A Horda aprende | Guarda só a última formação vista; peso pela estação e pela astúcia da dificuldade; sem memória entre anos |
| 16 | Tiles e datas | A Fortaleza nasce no outono e volta todo ano; o Acampamento no 25º dia de jogo; a Torre Nv3 a Nv5 avisa com 3, 4 e 5 h reais |
| 17 | Sabotagem | Só no outono, 3 heróis, até 3 por ano; cada Sucesso tira 15% de uma onda |
| 18 | Presságios e as ondas | As ondas são geradas no outono e regeradas a cada formação nova vista; o presságio nunca mente sobre a versão atual |
| 19 | O Cerco e a Queda | Ondas 40/60/80 e o Senhor da Guerra; a Queda custa 30% dos recursos, 20% da população e dois níveis dos dois maiores edifícios, sem sorteio |
| 20 | Plano de Batalha | Uma formação por onda; 60 min reais entre ondas para trocar e pedir reparo; sem reparo automático |
| 21 | Milícia | Só com incursão forte ou cerco marcado; até 50% dos aldeões; dissolve ao fim |
| 22 | Rescaldo e Crônica do Ano | Luto e festa na moral; a Crônica do Ano montada pelo servidor; "Avançar para o Degelo" não entra |
| 23 | Os lotes 2 e 3 de cartas | 38 cartas, apresentadas em lotes de cinco antes da transcrição |
| 24 | Objetivos 17 a 21 | Os cinco do GDD entram; os sazonais não |

## 5. Dúvidas levantadas durante a implementação

### Fase B: o ferro (V4B-T1)

Vêm da tarefa V4B-T1 (o ferro como recurso, a Mina Abandonada e o ferro no Mercado), aplicada em 2026-10-16 ao conteúdo, ao motor, ao protocolo e ao simulador. **Estado na versão 25; protocolo ainda 3** (a visão cresceu por adição). **Nenhuma foi perguntada ao autor.**

**B-1. O ferro entra no fim da lista dos recursos, depois do ouro.** *(Leitura do agente.)*
- Enquanto isso: `RESOURCE_IDS` é `food, wood, stone, gold, iron`. Assim a ordem dos quatro que já existiam não muda em conta, em tela nem em CSV; o ferro aparece por último no estoque, na árvore ("Recursos"), na linha "Em estoque" do Conselho ("· 0 ferro") e no CSV do simulador (`iron`, `iron_per_hour`). No Mercado a ordem é a do ADR: comida, madeira, pedra, ferro.
- Se decidir diferente: pôr o ferro antes do ouro é trocar a ordem em `ids.ts` e regravar os goldens da visão; nenhuma regra muda.

**B-2. A caravana de ferro é recusada com `INVALID_AMOUNT`, e não com um código novo `INVALID_RESOURCE`.** *(Leitura do agente.)*
- Enquanto isso: o roadmap (V4B-T1.2) propõe `INVALID_RESOURCE`; o motor já recusava "o que não é uma carga" com `INVALID_AMOUNT` e a frase `caravanTexts.cargoOnly`, e a frase agora diz "O ferro não vai por caravana.". Um código novo mudaria a lista de recusas do protocolo e o teste de igualdade de tipos, sem mudar o que o jogador lê. A lista do que uma caravana leva ficou no conteúdo (`market.caravan.resources`), e `caravanOffer.resources` não traz o ferro.
- Se decidir diferente: acrescentar `INVALID_RESOURCE` ao motor e ao protocolo é um commit pequeno.

**B-3. A guarda da versão 25 confere o preço do ferro contra o piso e o teto do passeio, e a dos outros recursos não.** *(Leitura do agente.)*
- Enquanto isso: a V4B-T1.3 pede "preço dentro do piso e do teto do passeio"; as guardas das versões 21 a 24 deixavam o piso e o teto de fora (eram do conteúdo). O ferro tem os números escritos em `migrations/v25.ts` (4.800 e 12.800 milésimos); os outros três continuam como estavam. Mudar o preço-base do ferro no conteúdo pede, por isso, versão nova do estado.
- Se decidir diferente: tirar a conferência do ferro, ou estendê-la aos outros três (com a mesma consequência).

**B-4. A forma da versão 25 confere o ferro das expedições tirando-o e entregando o resto à forma da 24.** *(Leitura do agente; é código, não regra.)*
- Enquanto isso: cada registro de quantidades de uma expedição (`log[].gained`, `loot.resources` e, no relatório, `wasted`) ganha `iron`. A forma das expedições vem em camadas desde a versão 17 e lê a lista de recursos daquela versão; em vez de reescrevê-la, a guarda da 25 confere o ferro de cada registro, tira-o e passa o resto à forma da 24 (`ironAwareGuild`, em `migrations/v25.ts`). O teste do passo confere a recusa de um registro sem ferro.

**B-5. O app mostra o ferro onde já mostrava todos os recursos, antes da tela da V4B-T4.** *(Leitura do agente.)*
- Enquanto isso: o app lê a visão e não tem número de regra: o ferro aparece no estoque (com limite e a explicação "Nenhum ofício produz ferro: ele chega pelas expedições e pelo Mercado."), na árvore (uma linha a mais em "Recursos", o que muda a ordem das setas), na linha "Em estoque" do Conselho e na tabela do Mercado (quatro linhas, com Comprar e Vender). `VIEW_FORMAT` não subiu: a visão só cresceu. **Os cenários em navegador não rodaram** (sem Docker): `05-teclado-e-temas` (ordem das setas) e `10-mercado` (linhas da tabela) podem precisar de ajuste.

**B-6. O simulador não mede o excedente parado nem o desperdício do ferro.** *(Leitura do agente.)*
- Enquanto isso: `SURPLUS_RESOURCES` e `WASTE_RESOURCES` continuam sem o ferro, e as faixas não o têm. Até o Ferreiro (V4B-T2) o ferro não tem uso: o bot vende todo o ferro que tiver, a cada visita com o Mercado de pé (`surplusOf` devolve o estoque inteiro do ferro, e `keptFromMarket`, zero; V4B-T1.8). O CSV de cada partida traz as colunas `iron` e `iron_per_hour`, e o da matriz, `iron`.

**B-7. Com o ferro no sorteio do Mercado, a Crônica do Mercado tem mais linhas.** *(Medido.)*
- Enquanto isso: o passeio de cada virada sorteia quatro recursos no fluxo `market`, e a ordem é comida, madeira, pedra, ferro: todo preço depois da primeira virada com o Mercado de pé é outro. Em 50 partidas de dois anos de jogo, `marketPriceSwing` passou de 221 linhas (três recursos) para 336 (quatro): 3,4 por ano de jogo. As marcas continuam a 85% e 115%.

**B-8. A Mina Abandonada é revelada só pela Floresta Antiga; a Patrulha continua revelando só as Ruínas.** _(Pergunta para o autor: a decisão 3 diz "pela Floresta Antiga ou pela Patrulha".)_

- Enquanto isso: um nó revela um destino só (`rewards.reveals`), e todo nó da Patrulha já revela as Ruínas. A Floresta ganhou a revelação no último nó com prova de cada caminho, nas três variantes. No simulador, o Explorador acha a Mina em quase toda partida que passa pela Floresta.
- Se decidir diferente: a Patrulha pode revelar "o primeiro destino ainda não achado de uma lista" (as Ruínas, depois a Mina): é `reveals` aceitar uma lista, no schema e em `expeditionTurn.ts`.

**B-9. O GDD e o ADR divergem na Mina, e valeu a soma dos dois.** _(Leitura do agente.)_

- Enquanto isso: do ADR 0019, a Guilda Nv2 e o ferro de 40 a 80; do GDD §9.3, 4 h de jogo, 2 heróis e um Guerreiro. Na lista de destinos a Mina fica entre as Ruínas e o Pântano (o bot lê a lista de trás para a frente e manda o destino mais rico que passa: com 70 a 80 de ferro, a 8 de ouro, a Mina rende mais que as Ruínas). As fichas estão em [content-v0.4.md](content-v0.4.md), seção 1, **rascunho que o autor não leu**.

**B-10. O especulador não tem como comprar ferro para revender.** _(Leitura do agente.)_

- Enquanto isso: a arbitragem do especulador é comprar no balcão e revender por caravana; o ferro não vai por caravana (decisão 3), então a manobra não existe para ele. Comprar e vender ferro no mesmo dia continua dando prejuízo, provado por propriedade com o ferro (`market.property.test.ts`). O perfil `especulador` não foi rodado nesta tarefa.

### Fase B: o Ferreiro e as armas (V4B-T2)

**B-11. A arma é uma contagem fora do estoque, e não um recurso de `resources`.** _(Leitura do agente; o roadmap dizia `settlement.resources.weapons`.)_

- Enquanto isso: `settlement.weapons` é um inteiro de unidades, e a visão a traz em `smithy.weapons`. Pôr `weapons` em `RESOURCE_IDS` a levaria a todo `Record<ResourceId, …>`: estoque em milésimos, acumulador, desperdício, saque de expedição, efeito de carta, relatório e a conta do depósito, e nada disso serve a uma coisa que não tem depósito nem se vende. O Quartel (Fase C) lê `settlement.weapons`. Se preferir a arma como recurso, é mudança de estado (versão 27) e de toda a economia; a decisão 4 do ADR 0019 diz "sem cap" e "não se vendem", que a contagem já cumpre.

**B-12. O "+10% de produção por nível" é lido como tempo × 10 / (10 + nível − 1).** _(Leitura do agente; era a proposta do roadmap, aprovada em bloco com o ADR 0019.)_

- Enquanto isso: nível 1, 6 min por arma; nível 2, 5,45 min; nível 6, 4 min. Lido como "−10% de tempo por nível", o nível 6 daria 3 min. A fração fica em `balance.smithy.speedPerLevel` (1/10). O tempo do lote é fixado quando ele começa.

**B-13. Subir o Ferreiro não acelera o lote em curso, e cancelar devolve 80% do ferro e da madeira.** _(Leitura do agente.)_

- Enquanto isso: o fim do lote é um instante gravado no estado, como o de uma obra. A devolução usa `balance.construction.cancelRefund` (a regra das obras); o que não cabe no Armazém vai ao desperdício.

**B-14. O Explorador só ergue o Ferreiro depois do Quartel, que ainda não existe; a política fica inerte.** _(Leitura do agente.)_

- Enquanto isso: o Ferreiro foi tirado da corrida das obras de todos os bots (`sideBuildings`), e `erguer o Ferreiro` só age quando a lista de obras da visão tiver um edifício `barracks`. `forjar armas` age com o Ferreiro de pé e deixa de vender o ferro. Nenhuma faixa do simulador mudou (ver `docs/balance-v0.4.md`, seção "V4B-T2"). A Fase C troca a condição pelo nível do Quartel.

**B-15. A mensagem de `INVALID_AMOUNT` da forja é a mesma sigla da do Mercado, com outra frase.** _(Leitura do agente.)_

- Enquanto isso: `INVALID_AMOUNT` serve às duas ordens, e a frase vem do parâmetro (`count` = o lote máximo). Criar `INVALID_BATCH` mudaria o protocolo de recusas sem ganho para o jogador.

### Fase B: desgaste e reparo (V4B-T3)

**B-16. O item em reparo sai do arsenal para a forja e guarda o lugar dele; só se repara item do arsenal.** _(Leitura do agente.)_

- Enquanto isso: um item que um herói leva é devolvido ao arsenal (`unequipItem`) antes de ir ao Ferreiro; a recusa `ITEM_NOT_FOUND` diz isso. A alternativa (reparar com o herói em casa, sem desequipar) pede travar o item contra `equipItem` durante o reparo. O lugar guardado evita que o item, ao voltar, encontre o arsenal cheio e seja vendido.

**B-17. Só o item que chega a 0 tem linha na Crônica (`itemWorn`); o desgaste de cada ponto é silencioso.** _(Leitura do agente.)_

- Enquanto isso: um ponto por item por volta seria ruído. O app mostra a condição em `ItemView.condition`, `durability` e `conditionText`.

**B-18. O reparo não tem cancelamento e não depende do nível do Ferreiro.** _(Leitura do agente.)_

- Enquanto isso: 2 min de jogo por ponto em qualquer nível, no máximo 40 min (item Épico a zero). O ADR 0019 não fala de cancelar nem de velocidade por nível no reparo. Cancelar devolveria ferro e o item à condição de antes; fácil de acrescentar se o autor quiser.

**B-19. `wearPerBattle` não entrou.** _(Leitura do agente; o roadmap listava o campo.)_

- Enquanto isso: a batalha comandada é da Fase D; um campo sem uso seria antecipar mecânica (CLAUDE.md, regra 6). Entra com a batalha.

**B-20. O item cuja chave o conteúdo já não tem entra na migração com 8 de condição (a do Comum) e não é reparável.** _(Leitura do agente.)_

**B-26. Os bots do simulador não reparam nem erguem o Ferreiro (a política dele espera o Quartel, B-14); os itens se gastam e ficam sem bônus.** _(Leitura do agente.)_

- Enquanto isso: as faixas da matriz não saíram do lugar com isso (ver `docs/balance-v0.4.md`, seção 4). Quando o Ferreiro entrar na corrida, o Explorador deve desequipar o item gasto, repará-lo e equipá-lo de novo.

### Fase B: o Ferreiro na interface (V4B-T4)

**B-21. A visão ganhou o custo e o prazo de cada lote, e o que o cancelamento devolve, já escritos.** _(Leitura do agente; adição à visão, sem subir `VIEW_FORMAT`.)_

- Enquanto isso: `smithy.offer.options[]` traz, de 1 até o lote máximo, `amount`, `costText` ("20 de ferro e 10 de madeira"), `seconds` e `affordable`; `smithy.forge.refundText` ("Cancelar devolve 80%: 3 de ferro e 1 de madeira.") e `smithy.forge.cancelLabel` ("Cancelar (devolve 80%)"). O roadmap pedia o botão "Cancelar (devolve 80%)" e a conferência com custo e prazo, mas o 80% é número de regra (`balance.construction.cancelRefund`) e o custo de N armas é uma conta: pelas regras do app, ficam no motor. O app só os mostra.

**B-22. A forja em duas etapas não tem "dia da cotação": a conferência vale enquanto a visão disser que o lote cabe.** _(Leitura do agente.)_

- Enquanto isso: ao contrário da negociação, o custo do lote não muda com o dia; "Revisar a forja" abre a conferência com o custo e o prazo da visão, e "Confirmar" manda `forgeWeapons { amount }`. Se um lote entrar na forja por outro lado, a conferência fecha; se o estoque deixar de pagar, o servidor recusa (`INSUFFICIENT_RESOURCES`) com a frase dele. Nada é reenviado sozinho.

**B-23. O painel do Ferreiro fica na coluna das obras da aba Feudo, entre as Construções e os Objetivos; o aviso de `weaponsForged` só entra em "Todas".** _(Leitura do agente.)_

- Enquanto isso: o lote que fica pronto não pede ação (a barra de status não o conta, como o roadmap diz) e `forgeStarted` e `forgeCancelled` são ordens do jogador, que não avisam. O Retorno põe `weaponsForged` em "O feudo prosperou" (tópico `smithy`). Se o autor quiser o aviso também em "Essenciais", é mover o evento de lista em `notifications/policy.ts`.

**B-24. "Ferro parado" em "Antes de partir" é: há excedente de ferro vendável e o Ferreiro não está de pé (ou o depósito já perde o ferro).** _(Leitura do agente.)_

- Enquanto isso: com o Ferreiro de pé o ferro tem o que o gaste, e o item que vale é o da forja parada ("O Ferreiro está parado, e o estoque paga até N armas", botão "Forjar…"). O botão "Vender…" leva ao balcão do Mercado, onde a venda é conferida com o total. Ambos são só informação (`info`) e cedem a vez aos alertas.

**B-25. O ferro na caravana não foi tocado.** _(Leitura do agente.)_

- Enquanto isso: a tela só mostra o que a oferta de caravana da visão traz; o ferro não vem nela (decisão 3 do ADR 0019). A tabela, o formulário e o atalho "Vender até N" do depósito tratam o ferro como os outros recursos, pelos campos de `market.prices` e de `resources`.

**B-26. "Reparar…" só existe no Arsenal; o item equipado aparece na lista da paleta, travado.** _(Decisão do agente.)_

- A visão só deixa reparar o item no arsenal (o item na mão de um herói vem com `canRepair: false` e o `blockedReason` da visão). Por isso o botão "Reparar…" está na ficha do item do Arsenal, em duas etapas (Revisar, Confirmar), e a ficha do herói só mostra a condição (`conditionText`). A lista de `lords.repairItem` (paleta, árvore, Retorno, "Antes de partir") mostra todos os itens de `repairOffer`, os travados com cadeado e o motivo da visão; escolher um travado não envia nada e mostra o motivo.
- "Antes de partir" lembra o item equipado em 0 com o Ferreiro livre (tópico `worn`); a ação leva à lista, onde a frase da visão diz para devolvê-lo ao arsenal. Se o autor preferir "Desequipar e reparar" em um clique, é ordem nova.

**B-27. O aviso de `itemRepaired` e `itemWorn` é só em "Todas"; o reparo em curso não tem botão de cancelar.** _(Decisão do agente.)_

- `itemWorn` poderia ser "Essenciais" (o herói perdeu o bônus). Ficou em "Todas", como `weaponsForged`, e o Retorno o põe em "O que exigiu um preço", com "Reparar…". A linha do Ferreiro na árvore fica sem botão enquanto repara (a dica diz que o reparo não se cancela). A frase "não dá bônus" é a da visão; a tela não diz "sem bônus" com palavras próprias.

### Fase C: o Quartel e os soldados (V4C-T1)

**C-1. O Quartel no nível 8 não cabe no Armazém em Camponês e em Senhor, e o 7 e o 8 não cabem em Rei de Ferro.** _(Respondida pelo autor em 2026-10-21: **madeira-base 150**. O nível 8 pede 4.026 de madeira e cabe em Camponês e Senhor; em Rei de Ferro o Quartel para no 7, como as outras obras que pedem o Salão no nível 8. Os testes de `barracks.test.ts` e `storage.test.ts` têm os números novos.)_

- Com 250 de madeira no nível 1 e o fator de custo das obras, o nível 7 pede 4.194 e o 8 pede 6.710 de madeira. O Armazém no nível 8 guarda 5.200 em Camponês e em Senhor (o nível 8 do Quartel não se constrói) e 3.680 em Rei de Ferro (o 7 e o 8 não se constroem). O teto alcançável do Quartel é então 7 em Camponês e Senhor e 6 em Rei de Ferro, ou seja, 70 e 60 soldados. O roteiro pedia um teste de que "cada nível cabe no depósito nas três dificuldades"; ele está em `packages/content/src/barracks.test.ts` com a **lista exata** dos níveis que não cabem, e `storage.test.ts` repete a lista de alcançabilidade.
- Saídas: baixar o custo-base de madeira (150 daria o nível 8 em 4.026), baixar o teto do Quartel para 7, ou aceitar. **Recomendação do agente:** baixar o custo-base de madeira para 150, que resolve os dois primeiros casos e deixa Rei de Ferro como as outras obras caras (`townHall 8` já não é alcançável nele).

**C-2. `army` está na raiz do `GameState`, e não dentro de `settlement`.** _(Decisão do agente.)_

- O roteiro escreve `army: { units; training }` ao lado do Quartel em `settlement.buildings`. O estado guarda `state.army`, irmão de `guild` e `market`, porque o exército é um assunto próprio (as formações, a Fase D e os relatórios de batalha entram nele) e a migração mexe em um lugar só. Trocar de lugar pede passo de migração.

**C-3. O lote que o piso de aldeões encolhe termina com o que cabe e não devolve o custo; sem nenhum aldeão disponível, o lote some sem linha na Crônica.** _(Decisão do agente.)_

- A ordem confere o piso na hora (`NOT_ENOUGH_VILLAGERS`), mas a população pode cair (deserção, partida) entre a ordem e o fim do treino. `finishTraining` forma `min(lote, aldeões − 3)` soldados; o resto fica por treinar e o custo não volta. Se não sobra nenhum, nenhum evento é emitido (a Crônica não diz "0 soldados"). Alternativas: devolver o custo do que sobrou, ou adiar o fim do lote até haver aldeão. O caso é raro (exige perder aldeões durante um treino de poucos minutos).

**C-4. O treino não congela na fome.** _(Decisão do agente.)_

- A fila de recrutamento de aldeões fica congelada na fome (GDD §5.6). O treino de soldados não: o custo já foi pago e o soldado não depende de a despensa encher. Se o autor quiser o congelamento, é regra nova (`nextEventAt` e `finishTraining` olhariam `settlement.famine`).

**C-5. O soldado queima lenha e conta nas casas cheias e na reserva de comida da moral como habitante.** _(Leitura do agente de "inhabitants soma soldados".)_

- `inhabitants` agora soma soldados, então a lenha (`firewoodRate`), as casas cheias (moral), a vaga habitacional e a reserva de comida contam o soldado. A comida é a única conta em que ele pesa mais que o aldeão (1,5). Se o autor quiser que o soldado não queime lenha, é um fator novo em `firewoodRate`.

**C-6. `cancelTraining` devolve 80% das armas, para baixo; a arma não cabe em fração.** _(Decisão do agente.)_

- Um lote de 3 espadachins (3 armas) devolve 2 armas ao cancelar. O roteiro dizia "devolve 80%" sem tratar a arma. A visão diz o que volta ("Cancelar devolve 80% dos recursos e N armas").

**C-7. Os custos dos soldados e as frases do Quartel são rascunho.** _(Rascunho que o autor não leu.)_

- Os custos e tempos são os da tabela do GDD §10.2 (o Espadachim e o Cavaleiro levam uma arma inteira, o ferro entra pela arma). As quatro linhas da Crônica (`trainingStarted`, `trainingCancelled`, `soldiersTrained`, `soldiersDisbanded`), a frase do Escudeiro ("Sem vantagem nem fraqueza; protege a retaguarda.") e o texto do Quartel na visão são rascunho.

**C-8. Formações salvas (V4C-T2): o que o agente decidiu sem o autor.** _(Decisões do agente; o ADR 0019, decisões 8 e 9, fixa o resto.)_

- A linha do roteiro era `rear`; o conteúdo já chamava a retaguarda de `back` (`UnitLine`), e `LINE_IDS` é `front` e `back`, para uma só nomenclatura.
- Salvar uma formação **não exige o Quartel de pé** (o editor da V4C-T3 só aparece com ele). Se o autor quiser a trava, é uma recusa a mais em `checkFormation`.
- A formação precisa de **ao menos um posto com soldados**; o nome vai de 1 a 30 letras, aparado; nomes repetidos são aceitos.
- Quem **já comanda** uma ala continua nomeado se ficar ferido; só quem passa a ser nomeado precisa estar pronto (`HERO_UNAVAILABLE`, com a frase "não pode comandar agora"). Ativar uma formação cujo comandante está fora do feudo é aceito: ele só não parte de novo quando voltar.
- O comandante que sai do feudo (dispensado, desertor, capturado, morto) é tirado de **todas** as formações em silêncio, sem linha de Crônica própria (a do herói já conta); a ala fica sem comandante. Desmarcar a Defesa ativa (`setActiveFormation { id: null }`) também não gera linha.
- As frases novas da Crônica (`formationSaved`, `formationActivated`, `formationDeleted`) e os nomes das alas ("Ala esquerda", "Centro", "Ala direita") são rascunho que o autor não leu (`packages/content/src/chronicle.ts` e `formations.ts`).
- O bot `militar` (único) monta uma formação "Defesa do bot" com o que tem, sem comandante, e a ativa; o Regular não (decisão 25 deixava a escolha ao agente: o Regular não precisa dela até a batalha).

**C-9. O ouro parado com o exército (V4C-T4.3; decisão 2).** _(Respondida pelo autor em 2026-10-23: **Muralha cara em ouro**.)_

- A medida (docs/balance-v0.4.md, seção 6): o treino leva ~110 de ouro por partida, 0,06% do que a Mina dá na semana do Rápido; o ouro parado fica em 157 mil (Regular) e 300 mil (Dedicado) na semana do Rápido, 2 a 10 mil no Normal e menos de mil no Tranquilo.
- Opções apresentadas: (1) nenhuma regra agora, e a Muralha e a Fortaleza da Fase E com custos de ouro de fim de jogo, dimensionados por esta medida; (2) soldo de 1 ouro por hora de jogo por soldado (aperta o Normal); (3) aceitar.
- **Resposta:** a (1). Nenhum número muda antes da Fase D; a V4E dimensiona o ouro da Muralha contra o ouro parado do Rápido sem apertar o Normal, e mede de novo. **Correção e números, 2026-10-23:** a "Fortaleza" da opção era um engano (é o forte da Horda); o autor fixou o ouro dos níveis 3 a 6 em 2.000, 6.000, 18.000 e 54.000 (×3 por nível) e o reparo com ouro igual à pedra (ADR 0020, "Números da Fase E").

### Fase D: o motor de batalha (V4D-T1)

**D-1. As convenções da conta dos sete goldens (V4D-T1.1).** _(**Respondida pelo autor em 2026-10-23: as baixas valem na hora**, e o resto como o agente leu. Antes: leituras do agente; o GDD §10.4 e o ADR 0019, decisão 11, não fecham estes pontos. Estão em `docs/content-v0.4.md`, seção 2.0.)_

- **Ataques sequenciais.** A ordem é fixada no começo da rodada, mas as baixas valem na hora: o `n` de quem ataca é o de quando ele age, e um esquadrão destruído antes de agir não age. A alternativa (todos batem com o `n` do começo da rodada) é mais simples de explicar e muda os goldens.
- **Um arredondamento só.** O bruto fica fração exata e o piso é aplicado ao efetivo, não ao bruto nem ao absorvido.
- **Sorte fixada em 100** nos goldens (o motor injeta a sorte); a faixa 90 a 110 é provada por propriedade.
- **Moral por lado, começando em 100;** −10 por esquadrão destruído e −20 pela ala que cai (soma-se); a debandada (≤ 30) é conferida **no fim da rodada**, não no meio dela. O GDD não diz o valor inicial.
- **Ala "caída" inclui a ala vazia desde o início** para o flanco (o ataque cuja ala oposta não tem esquadrões flanqueia ×5/4 o Centro, depois a esquerda, depois a direita), mas só a ala que **tinha** esquadrões e os perdeu custa −20 de moral.
- **Residual** é por esquadrão, inteiro, e zera quando o esquadrão morre.

**D-2. A Paliçada como muralha nos goldens (V4D-T1.1).** _(**Respondida pelo autor em 2026-10-23: o excesso se perde**; a vida por nível continua da Fase E.)_ O GDD §10.1 só tem a Muralha, e a vida dela por nível (`wallHpPerLevel`) é da Fase E. Os cenários 2.1 e 2.4 usam uma muralha com 60 e 100 de vida **por ala**, só para a conta; a muralha não tem defesa, o corpo a corpo bate nela inteiro e o excesso de dano além da vida que resta se perde (não passa às tropas no mesmo golpe). Ao ligar a Paliçada ao motor, o autor ou a Fase E dizem a vida dela e se o excesso passa.

**D-3. Arqueiros e Retaguarda (V4D-T1.1).** _(**Respondida pelo autor em 2026-10-23: o arqueiro da Horda mira a Retaguarda por cima da Frente**; regra da T1.3.)_ O §10.1 diz que a Retaguarda "ataca à distância por cima da própria Frente" e é atingida "por arqueiros inimigos", mas não diz **onde** o arqueiro acerta. Nos goldens o arqueiro ataca a Frente da ala oposta como qualquer esquadrão (e a Retaguarda quando a Frente cai); só o cenário 2.5 tem arqueiros, e do lado do jogador. A regra "arqueiro inimigo acerta a Retaguarda por cima da Frente" fica para a T1.3, a decidir.

**D-4. Auras e o Lobo (V4D-T1.1).** _(**Respondida pelo autor em 2026-10-23: a aura do Senhor da Guerra vale para ele**, e o Lobo como o agente leu.)_ A aura do Senhor da Guerra (×5/4 para a Horda) vale **também para ele**. O Lobo "sempre ataca uma ala lateral": o da ala esquerda ou direita ataca a ala do mesmo lado; se ela caiu, flanqueia (×5/4) o Centro, depois a outra lateral (nos goldens o Lobo está sempre numa lateral; o do Centro iria à esquerda e depois à direita). O Escudeiro e as auras de comandante não entram nos goldens: ficam para a T1.3.

**D-5. As regras que o agente fechou no motor (V4D-T1.3 a T1.5, 2026-10-23).** _(**Aprovada inteira pelo autor em 2026-10-23**, com o Mago a 20 de dano e a experiência do comandante a 40. Antes: leituras e números do agente; todos com teste em `packages/engine/src/battle.test.ts`. Os sete goldens batem com a conta à mão linha a linha.)_

- **A sorte só é pedida a quem ataca**: um esquadrão sem a quem atacar não gasta sorte, e o destruído antes de agir também não (“só se sorteia o que pode acontecer”).
- **"Sem moral" quer dizer "não debanda"**: o documento (2.7) desconta a moral quando o Senhor da Guerra cai, então a moral do lado conta todas as perdas, e o lado só debanda se tiver um esquadrão vivo com moral. Se os dois lados debandam na mesma rodada, foge o atacante.
- **O comandante cai** quando um golpe inimigo chega à ala dele sem a Frente de pé (−15, a aura acaba); o comandante de uma ala sem soldados nunca é atingido. Fica **ferido** (a gravidade e o prazo são da Fase E) e só **morre em Rei de Ferro**; a batalha não captura.
- **Escudeiro**: o golpe à Retaguarda com a Frente de Escudeiros de pé (hoje só o do arqueiro da Horda) divide o bruto ao meio, e cada metade passa pela defesa de quem a recebe.
- **Muralha à distância**: o ×7/10 do arqueiro da Horda e o ×6/5 do Arqueiro do jogador valem com a muralha da ala de pé; qualquer Retaguarda da Horda (o Xamã também) passa por cima da muralha.
- **Contra-ataques não se somam**: o Lobo contra o Arqueiro já é ×3/2 pelo ciclo; o `bonusAgainst` não multiplica de novo.
- **Torres, Mago e Clériga** agem no fim da rodada, ala por ala, antes da debandada, em dano fixo (sem defesa nem sorte): a torre no primeiro esquadrão da ala oposta (Frente, senão Retaguarda), **12 × (nível − 2)**; o **Mago**, em cada esquadrão da ala oposta, **20 de dano** (número do agente), ×2 nos mortos-vivos, nas rodadas 3, 6, 9 e 12; a **Clériga** cura nas rodadas pares **10% da vida da Frente no começo da batalha** (primeiro o residual, depois soldados inteiros, até o efetivo inicial) e dá **+20 de moral** inicial ao lado. A Clériga não causa dano, então o "×2 de Clériga" do Esqueleto não tem efeito ainda.
- **Comandante de ala vazia** _(resposta do autor, 2026-10-23)_: o comandante só dá aura e moral se a ala dele tiver soldados no começo da batalha; numa ala vazia ele não conta (nem aura, nem moral, nem risco, nem experiência). Antes, a Clériga numa ala vazia dava +20 de moral sem risco.
- **Experiência do comandante**: **40**, inteira na vitória (e em "Resistiu"), metade na derrota, nada para quem morreu (números do agente).
- **Lado vazio**: o lado sem esquadrões no começo perde sem rodada nenhuma. Na Fase E, a incursão sem Defesa ativa (decisão 14) vai precisar de outra regra (a muralha e as torres lutando sozinhas).
- **Relatório**: o fator `wallAbsorbed` conta o dano que a muralha de fato tomou (o excesso perdido não entra), e `percent` é a parte do bruto da Horda; os outros fatores são o dano a mais (`bruto × (1 − 1/fator)`, piso) somado por lado. Empates na ordem do roadmap (muralha, contra-ataque, Retaguarda exposta, flanco, torre, aura).
- **`army.reportsKept` (3)** ficou em `balance.army`, como diz a T1.6; os outros números em `balance.battle`.


**D-6. A prévia do Conselho de Guerra (V4D-T2.1 e T2.3).** _(Decisões do agente; o GDD §10.5 e a decisão 10 não fecham estes pontos.)_

- **O inverno usa a composição-base do outono** na prévia; o cerco por onda é do §11.2.
- **O posto desconhecido sorteia só entre as unidades da linha dele**; sem unidade da estação naquela linha (a Retaguarda da primavera), pesos iguais entre as unidades comuns da linha, sem o Senhor da Guerra nem o Esqueleto.
- **Vitória** é vencer ou resistir; **Derrota**, o resto. **Gloriosa: respondida pelo autor em 2026-10-23: vitória sem que a Frente de nenhuma ala caia**, com ou sem muralha (era "sem muralha em zero", o que tornava gloriosa toda vitória sem muralha).
- **O risco principal** soma os fatores do relatório que favorecem a Horda, por fator e ala, nas derrotas se houve alguma; é aproximado, porque o relatório só guarda os três fatores decisivos.
- **As perdas esperadas** são a média por posto, arredondada ao inteiro mais próximo.

### Fase E: a Muralha de Pedra, o Baluarte e a Torre Nv3+ (V4E-T1)

**D-7. Os números da muralha e da Torre dos níveis novos (V4E-T1.1 e T1.3).** _(**Aprovada pelo autor em 2026-10-23**: a vida por ala 60, 100, 200, 320, 500 e 800, e a Torre revelando os tipos no Nv3, a quantidade no Nv4 e a composição exata no Nv5.)_

- **A vida por ala** (`balance.wall.hpByLevel`), do Nv1 ao Nv6: **60, 100, 200, 320, 500 e 800**. Os dois primeiros são as premissas dos cenários de `docs/content-v0.4.md`, seção 2 (60 e 100); dali em diante, cerca de × 1,6 por nível. O GDD §13.4 mostra "600 HP por ala" no Nv2 só como desenho de tela; o agente não o seguiu.
- **O reparo** (`balance.wall.repair`): reparar toda a muralha (as três alas a zero) custa metade da pedra da obra do nível e **ouro igual à pedra**; o custo é proporcional ao que falta, arredondado para cima. O prazo é de 15 min de jogo por 25% da vida de **uma ala**, também proporcional, com as alas em sequência (o texto "15 min por 25%" não diz se é por ala ou no total).
- **A Torre Nv3 a Nv5:** aviso com 3, 4 e 5 h reais (decisão 16), dano de 12, 24 e 36 por ala, e a composição revelada em três graus: Nv3 só os arquétipos ("muitas feras"), Nv4 a ordem de grandeza por ala, Nv5 a composição exata. Custo e tempo pela regra geral (× 1,6 e × 1,5) a partir do Nv2.
- **A Paliçada Nv3 a Nv6:** madeira e pedra × 1,6 a partir de 300 e 450 (Nv6: 1.229 e 1.843, arredondado), ouro de 2.000, 6.000, 18.000 e 54.000 (ADR 0020), tempo de 1 h no Nv3 e × 1,5 por nível (202,5 min no Nv6, abaixo do teto de 8 h).
- **Ligados ao jogo em 2026-10-23 (V4E-T1.2 a T1.4, branch `v4e-t1-estado`):** `maxLevel` 6 e 5; `futureLevels` e `futureWatchtowerLevels` saíram. A Torre Nv3 a Nv5 segue a regra geral sem tabela; a Paliçada Nv3 a Nv6 virou `buildings.palisade.levelTable` (o nível, o nome, o custo e o prazo de cada obra), e a Torre ganhou `composition` e `towerDamage` em `balance.threat.watchtowerLevels` (cinco entradas).

**D-8. Os comandantes depois da batalha (V4D-T3, 2026-10-23).** _(**Aprovada pelo autor em 2026-10-23.** Antes: Números e leituras do agente, por aprovar; testes em `packages/engine/src/battleOutcome.test.ts`.)_

- **As auras são dado da classe** (`heroClasses[].aura`), com os mesmos números da D-5 (+15% de defesa, +15% à distância, 20 de dano a cada 3 rodadas, 10% de cura a cada 2 rodadas e +20 de moral); saíram de `balance.battle.auras`, e o fator dos mortos-vivos ficou em `balance.battle.undeadFactor`. A ficha do herói diz o que ele dá como comandante (`commanderText`; as frases são rascunho).
- **A gravidade do ferimento** é "a parte do dano" lida como a parte dos soldados que a ala do comandante perdeu: **grave com metade ou mais** (`battle.commanderInjury.severeAtLoss`, 1/2), leve abaixo disso; os prazos são os das expedições (2 h e 12 h de jogo).
- **O desgaste por batalha** é de **1 ponto** por item de quem comandou e sobreviveu (`equipment.wearPerBattle`); quem morreu devolve o que levava ao arsenal sem desgaste.
- **A ordem**: a linha `battleFought` primeiro, depois, comandante a comandante, o ferimento ou a morte (`commanderInjured`, e `commanderDied`, evento novo além do que o roadmap pede, porque a frase de `heroDied` fala de expedição), depois a experiência e por último o desgaste.
- **A frase de `battleFought`** diz o desfecho e os três fatores decisivos sem número (`battleFactorLabels`, uma forma para o fator a favor do feudo e outra para o da Horda); sem fator, "a força dos braços". Rascunho que o autor não leu.

**D-9. A ordem `simulateBattle` e a prévia na visão (V4D-T2.2, T2.4 e T2.5).** _(Decisões do agente, por aprovar; estado 30 → 31.)_

- **O inimigo da prévia ainda é um palpite de conteúdo**: a Horda é da Fase E, então todo posto do inimigo é desconhecido (`?`). O total vem de `balance.battle.previewEnemy.units` pelo tamanho da incursão que a Ameaça marca (`raidSizeAt`): **24 (leve) e 40 (média)**, repartidos por posto em **25% Frente da esquerda, 30% Frente do centro, 15% Retaguarda do centro, 25% Frente da direita e 5% Retaguarda da direita** (números do agente, por aprovar). A estação é a de `lastProcessedAt`.
- **A prévia entra sem muralha** (`wall: {}`): o HP da muralha é da V4E-T1. Até lá "Gloriosa" é igual a "Vitória" na prévia, e a Torre conta (dano de torre a partir do Nv3).
- **A formação é um plano**: a prévia lança os soldados que o feudo tem, posto a posto, na ordem fixa dos postos (o que falta deixa o posto menor ou vazio); o herói comandante só conta se pode ser nomeado agora (`nominationReason`). Sem soldado nenhum, a visão diz isso em vez de apontar um fator.
- **`army.preview` guarda mais do que o roadmap lista**: `signature` (o `hashText` dos postos e comandantes, sem o nome, para `previewStale`), `runs`, `enemy` (o palpite por posto, para o `?` da visão) e `risk` como `{ factor, wing, amount }`. **Apagar a formação da prévia apaga a prévia** (a guarda do estado exige que a formação exista).
- **`stats.battlesSimulated`** mora em `stats` (registro livre de contadores), que já existia: o estado não ganha campo para ele, e a migração 30 → 31 só põe `army.preview: null`.
- **A ordem recusa na ordem**: `FORMATION_NOT_FOUND`, depois `BARRACKS_REQUIRED`. O código mora em `warCouncilOrders.ts` (não em `armyOrders.ts`), junto da montagem da entrada da prévia, para `armyOrders.ts` não importar a prévia.
- **O bot `militar`** simula a formação que monta antes de ativá-la; se a prévia der menos de 50% de vitória, salva "Defesa do bot B" (frente e Arqueiros repartidos por igual entre as três alas), simula e ativa a de melhor prévia. Só relê a visão (`army.preview.winsPercent`). Não tem faixa; `bands.ts`, `balance.test.ts` e `matrix.test.ts` ficaram como estavam.

**D-10. A muralha no estado, o reparo e a visão (V4E-T1.2 a T1.4, 2026-10-23).** _(Estado 31 → 32.)_ **Reparo aprovado pelo autor em 2026-10-23** (segura todas as filas, sem cancelamento, as três alas de uma vez). **Resposta do autor (2026-10-23):** a lista de obras diz o nome por nível, "Muralha de Pedra Nv3/Nv4" e "Baluarte Nv5/Nv6" (`buildingLabelAt` na visão). Demais pontos: decisões do agente, por aprovar.

- **Os níveis 3 a 6 da Paliçada seguram o que o 2 segura** (`palisadeLevels` com seis entradas, as quatro novas `medium`): até a V4E-T2 a incursão continua com a regra da v0.2, e a Muralha de Pedra não pode segurar menos que a Paliçada. O que a obra muda, na lista, é a vida de cada ala ("Cada ala da muralha passa a ter 200 de vida (em vez de 100).").
- **O aviso da Torre Nv3 a Nv5 passa do prazo da incursão sorteada no ritmo 3** (9, 12 e 15 h de jogo contra 6 h): o schema deixou de exigir que todo nível caiba no prazo (só os dois primeiros). A incursão sorteada é avisada na virada que a sorteia; a antecedência a mais só vale para as marcadas antes (as do roteiro). A medir na V4E-T2.
- **O reparo entra na frente de toda a fila**, não só da primeira: no instante da ordem toda obra em curso espera o prazo do reparo, e a obra que começa durante ele só corre depois. O prazo de tabela da lista de obras (`durationSeconds`) não conta essa espera. **O reparo não tem cancelamento** e repara sempre tudo o que falta (não há reparo de uma ala só).
- **A obra da Paliçada soma à vida de cada ala o que o nível novo dá a mais**, sem curar o dano (a ala com 40 de 100 vira 140 de 200); durante um reparo, o alvo do reparo sobe junto.
- **O dano de uma batalha** (`applyWallDamage`) põe cada ala no fim do relatório e não mexe no reparo em curso, que termina com o alvo que tinha (a batalha durante o reparo é da V4E-T2 e da revisão V4E-T5.1).
- **A prévia do Conselho de Guerra passou a receber a muralha de hoje** (antes `wall: {}`); a ala com vida zero entra sem muralha.
- **Os nomes Muralha de Pedra e Baluarte** aparecem na visão da defesa (`text`, `next`, `wall.levelLabel`) e não no rótulo da lista de obras, que continua "Paliçada".
- **Na visão**, `threat.defense.wall.repairOffer` dá a pedra, o ouro e o prazo em segundos reais; as frases do reparo e das torres são rascunho que o autor não leu, montadas no motor (`threatView.ts`), como as outras da defesa.
- **O cenário de 7 dias** deixou de pedir o nível 3 da Torre às 97 h (era para ver a recusa do teto, que não há mais).

## 6. O que não foi verificado

*Por tarefa, no Registro do [roadmap](roadmap-v0.4.md), §15.*

## 7. Roteiro de 15 minutos para o autor jogar a Fase B (V4B-T5.5)

Em desenvolvimento, sem mexer na produção: `pnpm dev:up`, `pnpm dev:api` e `pnpm dev:web`, e abrir `http://localhost:5173`. "Jogar agora" no ritmo Rápido. Para chegar logo ao Salão Nv4 e à Guilda Nv2, o caminho mais curto é seguir os objetivos; quem quiser pular, pode usar uma partida de teste pelas rotas `/__test` do servidor em navegador (`tests/e2e/server.ts`).

1. **O ferro no Mercado** (2 min): com o Mercado de pé, abra a aba Mercado. A linha do Ferro está lá, a 8,00 de ouro? Compre 20 e confira na tela o total antes de confirmar. A caravana **não** oferece ferro.
2. **A Mina Abandonada** (3 min): com a Guilda Nv2, mande uma expedição à Floresta Antiga. Na volta, a Mina aparece entre os destinos? Mande uma equipe com um Guerreiro. O ferro que ela traz chega ao Armazém, e a Crônica diz de onde veio?
3. **O Ferreiro e a forja** (4 min): com o Salão Nv4, erga o Ferreiro pelo painel da aba Feudo. Forje um lote de 3 em duas etapas ("Revisar a forja", "Confirmar"). O prazo e o custo são os que a tela disse? Cancele um segundo lote e veja se a frase do que volta bate com o estoque.
4. **O desgaste e o reparo** (4 min): depois de algumas expedições, a ficha de um item no Arsenal diz a condição dele ("Condição: N de M usos")? Mande reparar um item gasto e confira que a forja fica ocupada pelo reparo e que um lote novo é recusado.
5. **A sensação** (2 min): o ferro parece um recurso que se **acha** ou se **compra**, e não um que se produz? A forja parada te dá vontade de ter um Quartel? Anote em uma frase o que confundiu.

Se não der para jogar, fica registrado na linha V4B-T5 do Registro do roadmap que a Fase B fechou sem o autor jogar, como nas fases da v0.3.

## 8. Roteiro de 15 minutos para o autor jogar a Fase C (V4C-T4.5)

Em desenvolvimento, sem mexer na produção: `pnpm dev:up`, `pnpm dev:api` e `pnpm dev:web`, e abrir `http://localhost:5173`. "Jogar agora" no ritmo Rápido, seguindo os objetivos até o Salão Nv4.

1. **O Quartel** (3 min): erga o Quartel (150 de madeira, 150 de pedra, 100 de ouro). A aba **Exército** aparece depois do Mercado? A tabela das cinco unidades diz o custo, a comida por hora e contra quem cada uma é forte?
2. **O treino** (4 min): treine 3 Lanceiros em duas etapas ("Revisar o treino", "Confirmar"). A conferência diz o custo do lote inteiro e o prazo? Os soldados saem da população (a contagem de aldeões cai) e a comida por hora passa a contá-los? Cancele um segundo lote e veja se a frase do que volta bate com o estoque.
3. **A formação** (5 min): no editor, ande pelos seis postos com as setas e aperte Enter para pôr tropa em três deles. O posto vazio se distingue do preenchido de relance? Nomeie um herói comandante de uma ala, salve e marque como Defesa ativa. A árvore diz "Defesa: <nome>"? Tente mandar esse herói em expedição: a tela explica por que ele fica?
4. **O aviso** (1 min): tire a Defesa ativa. A barra de status diz "Sem Defesa ativa", e "Antes de partir" oferece "Ativar uma formação"?
5. **A sensação** (2 min): montar a formação parece um quebra-cabeça rápido ou um formulário? Sem batalha ainda, o exército parece servir para alguma coisa? Anote em uma frase o que confundiu.

Se não der para jogar, fica registrado na linha V4C-T4 do Registro do roadmap que a Fase C fechou sem o autor jogar.

**D-10. Os relatórios na visão (V4D-T4.3, 2026-10-23).** _(Decisão do agente, por aprovar.)_ `army.reports` traz o relatório já em frase (`battleReportTexts`, rascunho). O relatório guardado no estado ainda não registra a formação que lutou (a batalha é da Fase E): `adjustFormationId` é a Defesa ativa de hoje, nas defesas; a Fase E deve gravar a formação no relatório. A aura de uma ala só aparece na prévia como a do Xamã (heurística: a do Senhor da Guerra vale para o exército). A Vitória Gloriosa é vencer sem que a Frente de nenhuma ala caia (resposta do autor, 2026-10-23).

**D-11. O conteúdo das incursões como batalha (V4E-T2.1, 2026-10-23).** _(**Aprovada pelo autor em 2026-10-23**: leve 24, média 40, forte 64; a forte a partir de 95 no verão, 85 no outono e 80 no inverno, nunca na primavera; as roteirizadas dos dias 25, 37 e 61; a forte leva 20% e fere 3. Em 2026-10-26 as dos dias 25 e 37 passaram a leves e sem ferido: D-39.)_ _(Números do agente, por aprovar; `packages/content/src/raidWar.ts`; o motor ainda não os lê.)_ (1) **Tamanho** em pontos de tropa: leve 24 e média 40 (os da prévia do Conselho de Guerra), **forte 64**. (2) **Limiares da Ameaça por estação**: a média em 70 em todas (como a v0.2); o forte em 101 na primavera (nunca), 95 no verão, 85 no outono e 80 no inverno. (3) **Composição**: os pesos de `hordeBaseMix`, um sorteio por posto, só entre os tipos da linha do posto; a parte de cada posto é a de `balance.battle.previewEnemy.shares`; onde a estação não tem tipo de retaguarda (primavera), a parte dela vai para a Frente da mesma ala; o inverno usa o outono até o cerco (Fase F). (4) **Custo por tipo** no orçamento: Cavaleiro Negro 2, Ogro 4, Senhor da Guerra 12, os outros 1 (um posto de Ogros não pode ter a mesma contagem de um de Lobos). (5) **Perda**: leve e média repetem a v0.2; forte 20% e 3 feridos; na proporção do que passou (`scaledLoss`: parte do estoque × passou/total, feridos em teto, ao menos 1 se algo passou). (6) **Roteirizadas**: `raidersYear1Weak` (dia 25, leve), `raidersYear1Medium` (37, média) e `raidersYear1Rehearsal` (61, forte, ensaio); a composição delas sai da estação do dia. (7) `RAID_SIZE_IDS` continua com dois: o forte mora em `WAR_RAID_SIZE_IDS` até o estado 32. (8) As frases dos bandos (`bandSizes`) são rascunho que o autor não leu. Medir na V4E-T2.7.

## V4E-T3, parte pura (2026-10-23)

**D-21. Onde mora a astúcia e como a Horda pesa o "contra" (V4E-T3.2).** _(**Respondida pelo autor em 2026-10-23: ao ligar a Horda ao jogo (V4E-T3.1), a astúcia muda para cada dificuldade**, como o ADR diz.)_ _(Decisão do agente, por aprovar.)_ O ADR 0020 manda a astúcia em `difficulties[]`; pus em `balance.horde.cunning` (3/10, 1/2, 4/5) para não mudar `GET /catalog` nem o `ViewState` antes de o motor ler. O "contra" é `balance.horde.counterWeights[unidade]` (100 para Lanceiro, Espadachim, Arqueiro e Cavaleiro; 0 para o Escudeiro, que ninguém vence) vezes a **parte da formação vista** que é daquela unidade; o inimigo ganha esse peso se o arquétipo dele vence a unidade (ciclo de `ARCHETYPE_COUNTERS`). Com os pesos-base somando 100, uma formação 100% de arqueiros dá +50 (Senhor) a cada inimigo de arquétipo cavaleiro (Lobo e Cavaleiro Negro). Só entram os tipos da composição-base da estação (o Lobo na primavera, o Cavaleiro Negro só no outono): a Horda não inventa inimigo de outra estação. A base do inverno é a do outono (`hordeBaseMix.winter`). Sem memória, os pesos são os da estação.

**D-22. Presságios: chance, teto e memória (V4E-T3.3).** _(**Aprovada pelo autor em 2026-10-23**: teto de 90%, 6 presságios guardados, a contagem parcial em múltiplos de 5.)_ _(Decisão do agente, por aprovar.)_ `balance.omens`: 35% + 10 pontos por nível da Torre acima do 1, **teto de 90%** (o GDD não diz teto; com a Torre no 5 a chance é 75%), clareza `['vague','vague','partial','partial','exact']` (níveis 1-2, 3-4, 5; os níveis 2 e 4 ainda não existem no jogo com esse efeito), o estado guardará no máximo `kept: 6` presságios, e a contagem do presságio parcial arredonda a múltiplos de 5 ("cerca de 30"). Ainda **não ligado ao jogo**: nada disto muda o motor, o estado ou a visão.

**D-23. Parte pura sem estado.** `packages/engine/src/hordeMind.ts` tem as contas (resumir, pesos, sortear com gerador injetado, chance, clareza, frase) e nenhuma chamada no jogo; `balance.horde` e `balance.omens` entram no `contentHash` (via `balance`). A ligação ao estado 33, ao fluxo `horde` e à visão fica para a V4E-T3.1/T3.4 depois do estado 32.

**D-24. As frases dos presságios.** _(Rascunho que o autor não leu.)_ `packages/content/src/omens.ts`: uma frase vaga por inimigo dominante (para nunca mentir sobre a onda: "muitas feras" só quando os lobos dominam), uma parcial ("cerca de N <inimigo> ... pela ala X, na segunda noite") e uma exata (a composição inteira, no Apêndice E). `omens.ts` ainda não entra no `contentHash` (não é lido pelo jogo).

## V4E-T2, as incursões que viram batalha (2026-10-26)

Decisões do agente na V4E-T2 (estado 33), todas por aprovar. Os números são os da D-11, que o autor aprovou; o que segue é o como.

**D-31. Quando a composição é sorteada.** _(Decisão do agente, por aprovar.)_ A composição de uma incursão sorteada (`ScheduledRaid.composition`) sai no fluxo `horde` **logo depois do sorteio da incursão**, na virada que a marca, com a estação do instante em que ela chega (`buildRaidComposition`). As do roteiro e as marcadas antes do estado 33 ficam com `composition: null` e lutam com a composição-base da estação (`baseRaidComposition`), **sem sorteio**: o passo de migração não sorteia, e a do roteiro não gasta o fluxo. Consequência: toda semente mudou (o fluxo `horde` anda mais por incursão sorteada), e os retratos e goldens foram regravados.

**D-32. O passo 32 → 33.** _(Decisão do agente, por aprovar.)_ Cada incursão marcada ganha `composition: null` e cada relatório, `formationId: null` (não havia relatório: nenhuma incursão lutava antes). O passo marca **uma** incursão do roteiro da guerra (dias 25, 37 e 61) só quando a fronteira cai **dentro** da antecedência dela (a virada das 6 h de jogo antes já passou e a incursão não) e não há outra marcada; quem está antes da antecedência a recebe pela virada normal, e quem já passou do instante não a recebe (o molde dos lobos, versão 11). A marcada pelo passo leva `enemy: 'wolves'`, o inimigo de todo tile de hoje.

**D-33. Uma incursão marcada por vez, também no roteiro.** _(Decisão do agente, por aprovar.)_ A do roteiro da guerra só é marcada se não houver outra incursão marcada; senão ela não vem (não espera). É a regra das sorteadas (V2E-T3), estendida: duas batalhas no mesmo dia nunca acontecem.

**D-34. Sem quem ataque, a do roteiro não vem.** _(Decisão do agente, por aprovar.)_ A incursão do roteiro pede um inimigo à espreita (`raidingEnemy`): com o Covil de Lobos limpo por uma expedição, fora do outono, ninguém vem. No outono os lobos descem a serra de qualquer jeito (resposta do autor de 2026-10-06, ADR 0018), e a do 61º dia vem.

**D-35. A incursão forte, para a Paliçada e para as frases antigas, conta como média.** _(Decisão do agente, por aprovar.)_ `legacySize`: a regra da Paliçada da v0.2 (`palisadeAgainst`), as frases de `raidTemplates` e o custo da visão não têm o tamanho forte; ele conta como o médio. A perda da forte é a de `warRaids.losses.strong` (20% e 3 feridos, D-11), e o bando forte diz `warRaids.bandSizes.wolf.strong` (rascunho). Na semana roteirizada a forte do outono é segura pela Paliçada Nv2 como uma média (`scenario.test.ts`).

**D-36. A batalha só alivia a perda da v0.2.** _(Decisão do agente, por aprovar; é a leitura da decisão 14.)_ A perda é `min(o que a Paliçada deixava passar, o que passou pela batalha)`: a Paliçada que segura repele sem perda, como antes, e a batalha que vence ou segura também; a perdida cobra a regra da v0.2 na proporção do que passou (`scaledLoss`, feridos em teto e ao menos 1). Quem joga sem exército tem o mesmo desfecho de antes nos lobos do 16º dia (`raids.battle.test.ts`, três sementes). Sem Defesa ativa, só a muralha e as torres lutam.

**D-37. O que os vigias dizem da composição, e o ensaio do 61º dia.** _(Decisão do agente, por aprovar; frases em rascunho que o autor não leu.)_ `threat.incoming.compositionText`: nada nos níveis 1 e 2 da Torre (o Nv2 continua dizendo o tamanho); os tipos de inimigo no 3; quantos por ala, em múltiplos de 5, no 4; a composição exata no 5. A composição gravada nunca sai na visão. **O ensaio do cerco cai no início do 61º dia de jogo**, e não na Hora da Vigília: a conta da Vigília é da V4G-T1 (decisão 13), que vai movê-lo.

**D-38. Os bots com Defesa ativa e a coluna das perdidas (V4E-T2.7).** _(Decisão do agente, por aprovar.)_ Pela decisão 25, o `economico` (Regular e Dedicado) e o `preguicoso` passaram a montar e ativar a formação com os soldados do treino mínimo (`montarFormacao`, logo depois de `treinarMinimo`; antes só o `militar` a tinha); o Explorador e o Especulador herdam do econômico. A coluna `raids_lost` do roadmap **não foi criada**: a incursão perdida é a sofrida (`raids_suffered`, que já existe), e criar outra quebraria o CSV sem dizer nada novo; `wall_breaches` também não foi criada. A remedição está em [balance-v0.4.md](balance-v0.4.md), seção 9.

**D-39. O Preguiçoso do Rápido perde mais do que antes (V4E-T2.7, 2026-10-26).** _(**Respondida pelo autor em 2026-10-26: opção (b).** As incursões do roteiro da guerra dos dias 25 e 37 são **leves e não ferem ninguém** (levam do estoque como qualquer outra); a do dia 61, o ensaio, fica como está. Aplicada no branch `v4e-d39`: `warRaids.scripted[].injures` no conteúdo, lido pelo motor pelo id da incursão marcada (`raidInjures`, sem campo novo no estado); a do dia 37 mantém o id `raidersYear1Medium`, que fica gravado no estado; o passo 32 → 33 escreve o tamanho leve (a v0.4 não foi publicada); a visão da incursão à vista diz "não fere ninguém". A remedição está em [balance-v0.4.md](balance-v0.4.md), seção 10: em Senhor, o Preguiçoso do ano do Rápido volta a 9 a 11 objetivos (eram 4) e ao Salão Nv3 na hora 53 em parte das sementes (o menor nível final é 2; era 1), e o da semana do Rápido volta à população 36–54 (era 29–33), com 4 a 11 feridos (eram 12 a 21); fome e frio seguem em zero. O teste dos objetivos do Preguiçoso do Rápido voltou a `bots.test.ts`.)_ _(Era a pergunta de validação da decisão 14, "o Preguiçoso perde mais do que hoje?", e a resposta medida foi **sim**.)_ As incursões-batalha do roteiro da guerra caem nos dias 25 e 37 de jogo; no Rápido isso é por volta das horas reais 16 e 25, e a Paliçada pede o Salão no nível 3: o jogador de uma visita por dia não tem como se defender delas. Na semente `pedra-alta-001`, um ano de jogo no Rápido, o Preguiçoso sofre **7 incursões** (eram 5 no `main` de 2026-10-26, `1fac3e1`), **10 feridos** (eram 6), e os feridos e a moral o deixam sem ninguém na Pedreira de 25 h a 46 h reais: termina o ano com o **Salão no nível 1** (era 3) e **4 objetivos** (eram 11). A matriz (balance-v0.4.md, seção 9) mostra o mesmo nas 50 sementes. Fome e frio continuam em zero. A faixa foi remedida (é o jogo como está), e o teste que pedia ao Preguiçoso do Rápido os dez objetivos da v0.2 saiu da lista, com o porquê escrito (`bots.test.ts`). Opções, todas do autor: (a) as incursões do roteiro da guerra só para quem tem o Quartel ou a Paliçada; (b) as dos dias 25 e 37 leves e sem ferido; (c) o roteiro em dias de jogo contados do ritmo Normal, isto é, mais tarde no Rápido; (d) aceitar.

### V4E-T3 — decisões de implementação e limites (2026-10-27)

**D-40. Pesos iniciais das ondas.** _(Proposta do agente; não lida pelo autor.)_
A seção 12 de [content-v0.4.md](content-v0.4.md) inventaria as misturas e os postos
fixos. Os tamanhos 40/60/80 e a astúcia por dificuldade seguem o ADR 0020.
Não foi validada a taxa de Vitória do cerco, que ainda não existe.

**D-41. Revisão dos presságios.** _(Decisão de implementação.)_ A preparação tem
revisão; observar uma formação diferente no outono renova as ondas e limpa os
presságios correntes. As linhas anteriores da Crônica não mudam: registram o
que os vigias viram naquele instante. No inverno as ondas congelam. O parcial
revela um posto, com a contagem em múltiplos de cinco, sem revelar outros postos.

**D-42. O tile nasce depois de fechar a Ameaça do dia anterior.** _(Leitura da
ordem da virada.)_ A aparição ocorre no instante aprovado (o Acampamento no 25º dia de jogo, no verão; a Fortaleza na virada que abre o outono); o
primeiro +2 desse tile vem na virada seguinte. Isso mantém verdadeira a previsão
da Torre feita antes do surgimento. Sem Torre, a aparição não vira evento público.

**D-43. Pressão maior e finta limitada nas visitas.** _(Impacto medido; sem
aceitação humana.)_ [balance-v0.4.md](balance-v0.4.md), seção 11: 3.600 partidas;
zero fome/frio/recusas. O primeiro ano do Regular no Normal tem Ameaça média
próxima de 78 no outono/inverno. O Preguiçoso do Rápido sofre mais ferimentos.
A isca do militar foi vista em uma batalha de dez sementes em Senhor e uma em
Rei de Ferro, sem reduzir as incursões sofridas. Não se afirma benefício no cerco.

**D-44. Ligação às próximas fases.** A V4E-T3 prepara e congela ondas; a Fase G
vai agendá-las, aplicar sabotagem e encerrar a Fortaleza com o cerco. Até essa
ligação, ela fica ativa no inverno e é desativada no ano novo. Isso não significa
que o cerco foi implementado. A antiga premissa D-34 (limpar o Covil impede os
roteiros humanos) foi superada pelo Acampamento com data própria da decisão 16:
saqueadores não dependem dos lobos. Os roteiros continuam limitados a uma
incursão marcada por vez (D-33).

### V4E-T3 — correções da revisão independente (2026-10-27)

**D-45a. Quem ronda com vários tiles ativos.** _(Decisão provisória do agente, por aprovar.)_
`prowlingEnemy` escolhia o inimigo do primeiro tile ativo pela ordem alfabética da chave:
com o Acampamento e a Fortaleza, as incursões sorteadas depois do 25º dia se anunciavam como
de saqueadores ou da Horda, com a composição dos lobos (`hordeBaseMix`). **Escolhido:** uma
prioridade fixa no conteúdo, `prowlingTileOrder` = Covil de Lobos → Acampamento → Fortaleza:
com o Covil ativo as incursões comuns voltam a ser de lobos, como antes da V4E-T3; o
Acampamento só manda as dele com o Covil limpo. **Alternativa:** cada tile ativo marca as
próprias incursões, com composição do próprio inimigo (saqueadores e Horda com mistura
própria em `hordeBaseMix`), o que pede números novos e muda a pressão medida.

**D-45b. A prévia de uma incursão não lê presságio.** _(Decisão provisória do agente, por
aprovar.)_ Sem incursão à vista, a prévia de defesa usava o último presságio (de uma onda do
Cerco, até 105 inimigos) como inimigo conhecido da próxima incursão comum, e o parcial
misturava um posto da onda com a estimativa. **Escolhido:** a prévia de incursão usa só a
incursão à vista e o último relatório; os presságios ficam para a prévia de uma onda, na
Fase G. **Alternativa:** uma prévia "contra a onda N" à parte, já na Fase E, escolhida pelo
jogador no Conselho de Guerra.

**D-45c. Incursão sem formação vista não mexe na memória.** _(Decisão provisória do agente,
por aprovar.)_ Sem Defesa ativa, a batalha via um defensor sem posto; a memória virava `null`
e, no outono, as ondas eram regeradas sem memória: uma finta de graça (desligar a Defesa
antes de uma incursão). **Escolhido:** sem formação vista, a memória e as ondas ficam como
estavam. **Alternativa:** a Horda "lembrar" a milícia (uma formação vazia que conta como
vista e regera as ondas), o que mantém a finta mas a torna cara (o feudo sem defesa sofre a
incursão).

Também corrigidos, sem decisão: o presságio vago não diz mais a onda (`wave: null` na visão;
sem a chave `wave` no evento `omenSeen`); a guarda da forma 34 exige o Acampamento e a
Fortaleza na chave do próprio tipo (um de cada); e os números congelados da guarda têm teste
contra o conteúdo de hoje.

### V4G-T1 — Hora da Vigília (2026-10-27)

**G-1. Janela da Vigília e fallback.** _(Proposta do agente; não lida pelo autor.)_
O GDD §4.3 prevê +12 h de jogo se não houver Vigília, sem delimitar a busca.
Escolhida a janela de 24 h de jogo do evento: inverno [144 h, 168 h) e ensaio
[120 h, 144 h), buscando a partir de +6 h, inclusive. Se não couber, +12 h.
É a leitura que mantém o evento na data e torna útil o fallback no Rápido.
Prazos são arredondados para cima em milissegundos de jogo. Nenhum Cerco é criado.

**G-2. Chamadas offline e compatibilidade.** _(Proposta do agente; não lida pelo autor.)_
A criação e a migração sem contexto civil explícito usam origem 0, offset 0 e
`timezoneResolved: false`, de forma determinística. O servidor sempre passa `created_at`
e resolve o offset IANA na criação da linha; uma preferência posterior resolve no
instante da ordem. O offset só muda por essa ordem, sem atualização automática por DST.

**G-3. Marcação do ensaio.** _(Proposta do agente; não lida pelo autor.)_
Mantida a antecedência de 6 h de jogo, agora como instante próprio da linha do tempo
(pode não ser virada de dia). A tentativa é única: `stats.vigilRehearsalMarked`, também
quando não há vaga (D-33), impede repetir por mudar a preferência. Incursões antigas
já marcadas mantêm seu prazo. Quem migra com a fronteira em 114 h de jogo ou depois (o
instante em que o estado 34 marcava o ensaio) não recebe um ensaio novo: a versão antiga já
o marcou, o perdeu por falta de vaga ou o cumpriu, e o passo grava `stats.vigilRehearsalMarked`.
Nenhum prazo nasce no passo. _(Corrigido na revisão de 2026-10-27: o critério era
`migratedAtMs` antes do início do 61º dia, que dava uma segunda tentativa a quem migrou dentro
da antecedência sem vaga e que a migração seguinte, ao trocar `migratedAtMs`, desligaria.)_

**G-4. Alteração e replay.** _(Proposta do agente; não lida pelo autor.)_
Escolhida a ordem `setVigilHour { hourLocal, timezone }`, pelo caminho idempotente
das demais ordens. O servidor resolve o offset no instante da ordem, entrega
`CommandContext.vigil` ao motor e guarda o dado em `commands.payload.resolvedVigil`
para replay independente de ICU. Nenhum offset enviado pelo cliente é aceito.
Preferências permitem editar o fuso IANA; a hora confirmada vem da visão.

**G-5. Preferência alterada dentro da antecedência.** _(Proposta do agente; não lida pelo autor.)_
Se o ensaio ainda não foi marcado e o novo horário ainda é futuro, mas a
antecedência de 6 h já começou, a ordem marca agora (sujeita à vaga única).
Se o novo horário já passou (dentro da janela do evento), o ensaio é marcado agora e chega
6 h de jogo depois da ordem: mudar a hora não esquiva a incursão forte. A tentativa continua
única, e a ordem só olha o ensaio (as outras incursões do roteiro não são remarcadas).
_(Corrigido na revisão de 2026-10-27: antes, o horário já passado deixava o ensaio sem
marcação para sempre, e a ordem podia marcar o Acampamento que a virada do dia deixara de
fora por falta de vaga.)_


## V4H-T1 — Mercado e Coroa (2026-10-28)

**H-1. Arredondamento e momento do risco.** _(Proposta do agente; não lida pelo autor.)_
`resourcesPercent` arredonda a quantidade retirada ou concedida para baixo em milésimos,
lendo o estoque na resolução. O ganho respeita o depósito e conta desperdício.
A Clériga que reduz o risco da praga é consultada na virada da resolução, não na escolha;
vale em expedição ou recuperação, mas não em cativeiro (decisão 19). O risco reaproveita a
fila `council.delayed`: só guarda carta e opção, nunca o resultado, e não admite outro risco
aninhado. O herói Carismático que fala na escolha é o primeiro livre na lista, e o evento
guarda identificador e nome para a Crônica não trocar de interlocutor numa recarga.

**H-2. Duração e tendência do preço.** _(Proposta do agente; não lida pelo autor.)_
O fator dura `durationDays` dias completos de jogo a partir da escolha; seu vencimento
é um instante da linha do tempo, antes do passeio e do Conselho. Não há histórico de
fatores vencidos: a tendência compara o preço atual com o passeio e a estação de ontem;
o detalhamento explica cada fator vivo. O dia da cotação e o volume não mudam, conforme
§5.6 aprovado. A migração desta base é 35 → 36, em vez de 36 → 37 previsto no roadmap.


## V4H-T1 — quatro avulsas (2026-10-28)

**H-3. Participantes, cura e contingências.** _(Proposta do agente; não lida pelo autor.)_
As fichas §§7.4–7.5 e 8.1 escolhem participantes na chegada pelo fluxo `council`, sem
reposição, e guardam identificador e nome na ocorrência e no risco pendente. Livre
significa `idle` sem ferimento; comandante que permanece no feudo também pode conversar.
Na virada do risco só pode se ferir um participante ainda livre; com nenhum, vale o ramo
bom inteiro, sem sorteio. Com dois disponíveis o sorteio de quem se fere ocorre depois
do da chance. A cura parcial arredonda o prazo restante para cima em milissegundos,
para não dar mais de metade. A cura integral usa a mesma recuperação natural e emite `heroRecovered` depois da linha da
carta. Nas opções de cura (`healHero`), se o alvo sarou ou partiu antes da resposta, o custo
escolhido continua sendo o da ficha, sem cura substituta, e a frase de contingência proposta é:
"No {dia}º dia {daEstacao}, o curandeiro errante chegou tarde a {feudo}: {heroi} já não estava
entre os feridos da casa." A opção sem cura (`wait`) e o vencimento da carta preservam as
frases aprovadas na ficha §8.1.

**H-4. Persistência do recrutador.** _(Proposta do agente; não lida pelo autor.)_
O estado passa de 36 para 37: marcador booleano `guild.tavern.extraOffer`, desligado
na migração, e participantes opcionais em `council.pending`/`delayed` (obrigatórios nas
três cartas com alvo). O bônus é um candidato na próxima lista e se consome na rotação,
sem mudar limite de contratação ou número das listas seguintes. O teto persistido de
ofertas passa de três para quatro; as guardas antigas e os retratos v36 ficam congelados.
A escolha paga na hora exata de uma rotação vale para a seguinte: o instante vence
antes da ordem, como no restante do motor.


## V4F-T1 — Sabotagem da Fortaleza (2026-10-28)

**F-1. Duração da expedição de sabotagem e profundidade do grafo.** _(Proposta do agente; não lida pelo autor.)_
O roadmap (§§V4F-T1, 16.2) e o GDD §9.5 mencionam informalmente "6 h de jogo", enquanto os esquemas do motor (`ExpeditionVariantSchema`, `expeditions.ts`) fixam `maxDepth: 5` nós por caminho e `maxNodeMs: 60 min` (3.600.000 ms), resultando em duração total de 300 min (5 h de jogo) em todos os ramos das três variantes. Manteve-se conservadoramente a restrição existente da engine (5 nós de 60 min = 300 min) para total conformidade estrutural com os validadores e os limites de calibragem.

**F-2. Versão do esquema de estado (37 → 38).** _(Proposta do agente; não lida pelo autor.)_
O roadmap previa a transição 33 → 34 para a sabotagem. Como as etapas intermediárias (Vigília na 35, cartas na 36 e avulsas na 37) avançaram a numeração, a Sabotagem da Fortaleza adotou a transição 37 → 38 (`migrations/v37.ts` e `migrations/v38.ts`), introduzindo `horde.sabotages: { attempts, successes, alerted }` e o campo opcional `reductionPercent` nas ondas de `horde.wavePlan.waves`.

