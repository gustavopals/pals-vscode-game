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
- **Resposta:** a (1). Nenhum número muda antes da Fase D; a V4E dimensiona o ouro da Muralha e da Fortaleza contra o ouro parado do Rápido sem apertar o Normal, e mede de novo.


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
