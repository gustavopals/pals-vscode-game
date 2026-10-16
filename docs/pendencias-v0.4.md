# Lords of the Guild — Caixa de entrada do autor (v0.4)

> Criado na V4B-T1 (2026-10-16), por agente de código, sem a caixa de entrada da V4A-T1 (V4A-T1.11 não foi executada nesta árvore). As seções 1 a 4 ficam para quem fizer a V4A-T1; esta tarefa só preenche a seção 5.

## 1. O mais importante

(A preencher pela V4A-T1.)

## 2. O que continua aberto da v0.3

(A preencher pela V4A-T1.)

## 3. O que só o autor pode fazer

(A preencher pela V4A-T1.)

## 4. As decisões da §11 do roadmap

O lote 1 está no [ADR 0019](decisions/0019-ferro-exercito-formacoes-e-combate-na-v0.4.md), aprovado em 2026-10-16.

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
- Enquanto isso: `SURPLUS_RESOURCES` e `WASTE_RESOURCES` continuam sem o ferro, e as faixas não o têm. Até o Ferreiro (V4B-T2) o ferro não tem uso: o bot vende todo o ferro que tiver (`keptFromMarket` devolve 0 para ele). O CSV de cada partida traz as colunas `iron` e `iron_per_hour`, e o da matriz, `iron`.

**B-7. Com o ferro no sorteio do Mercado, a Crônica do Mercado tem mais linhas.** *(Medido.)*
- Enquanto isso: o passeio de cada virada sorteia quatro recursos no fluxo `market`, e a ordem é comida, madeira, pedra, ferro: todo preço depois da primeira virada com o Mercado de pé é outro. Em 50 partidas de dois anos de jogo, `marketPriceSwing` passou de 221 linhas (três recursos) para 336 (quatro): 3,4 por ano de jogo. As marcas continuam a 85% e 115%.

**B-8. A Mina Abandonada é revelada só pela Floresta Antiga; a Patrulha continua revelando só as Ruínas.** _(Pergunta para o autor: a decisão 3 diz "pela Floresta Antiga ou pela Patrulha".)_

- Enquanto isso: um nó revela um destino só (`rewards.reveals`), e todo nó da Patrulha já revela as Ruínas. A Floresta ganhou a revelação no último nó com prova de cada caminho, nas três variantes. No simulador, o Explorador acha a Mina em quase toda partida que passa pela Floresta.
- Se decidir diferente: a Patrulha pode revelar "o primeiro destino ainda não achado de uma lista" (as Ruínas, depois a Mina): é `reveals` aceitar uma lista, no schema e em `expeditionTurn.ts`.

**B-9. O GDD e o ADR divergem na Mina, e valeu a soma dos dois.** _(Leitura do agente.)_

- Enquanto isso: do ADR 0019, a Guilda Nv2 e o ferro de 40 a 80; do GDD §9.3, 4 h de jogo, 2 heróis e um Guerreiro. Na lista de destinos a Mina fica entre as Ruínas e o Pântano (o bot lê a lista de trás para a frente e manda o destino mais rico que passa: com 70 a 80 de ferro, a 8 de ouro, a Mina rende mais que as Ruínas). As fichas estão em [content-v0.4.md](content-v0.4.md), seção 1, **rascunho que o autor não leu**.

**B-10. O especulador não tem como comprar ferro para revender.** _(Leitura do agente.)_

- Enquanto isso: a arbitragem do especulador é comprar no balcão e revender por caravana; o ferro não vai por caravana (decisão 3), então a manobra não existe para ele. Comprar e vender ferro no mesmo dia continua dando prejuízo, provado por propriedade com o ferro (`market.property.test.ts`). O perfil `especulador` não foi rodado nesta tarefa.
