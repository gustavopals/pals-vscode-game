# Pendências e dúvidas da v0.3

> **Para ler primeiro.** Em 2026-10-05, com a v0.2 fechada e no ar, o autor respondeu em uma sessão de perguntas às decisões de regra da v0.3 (ADRs [0017](decisions/0017-regras-da-v0.3-herois-taverna-e-soldo.md) e [0018](decisions/0018-expedicoes-mercado-mestres-e-cartas-na-v0.3.md)) e pediu a implementação da versão inteira nesta execução, tudo no `main`, com `push` quando houver versão estável. Este documento é a caixa de entrada dele, no formato de [pendencias-v0.2.md](pendencias-v0.2.md): o que foi decidido e de que modo, o que só ele pode fazer, as dúvidas que a implementação levantar e o que ficar sem verificação. É registro, não leitura obrigatória: o que precisar de resposta chega como pergunta curta com opções. Nasceu na tarefa V3A-T1 do [roadmap da v0.3](roadmap-v0.3.md) e cresce a cada fase.

## 1. O mais importante

Em cinco linhas, por ordem de importância:

1. **O backup fora do servidor, a cópia do `RECOVERY_CODE_SECRET` e o ensaio de reversão continuam por fazer, e a v0.3 vai subir a versão do estado em produção assim mesmo** (seção 3; dúvida A-2). O roadmap dizia que esses atos bloqueavam a chegada de qualquer migração de estado à produção; a autorização de `push` de 2026-10-05 não os cumpre. O agente faz um backup manual no servidor antes de cada `push` que sobe o estado: é o mínimo, não o substituto.
2. **Você não vai jogar cada fase antes de ela ir ao ar** (dúvida A-3). Quem joga em produção recebe cada fase sem que o autor a tenha jogado. "Versão estável" foi lido como o fim de uma fase com o portão inteiro verde; publicar a Fase C sozinha cobra soldo de heróis que ainda não têm trabalho. Se a régua for outra (por exemplo, só depois da Fase D), basta dizer.
3. **Os 18 grafos de expedição e as 24 cartas entram no jogo como "rascunho, não lido pelo autor"** (decisões 12 e 19; dúvida A-7). A leitura deles é sua, depois, um por um; os números das classes, dos traços e dos candidatos da Taverna do ADR 0017 também não foram lidos.
4. **Dezoito das 21 decisões foram aprovadas em bloco, sem leitura item a item** (seção 4). Só a 2, a 3 e a 6 foram respondidas uma a uma. Se o simulador mostrar problema em alguma, ela volta como pergunta pontual, com o número medido.
5. **A régua do ouro está medida** ([balance-v0.3.md](balance-v0.3.md), seção 1.3): em Senhor, no ritmo Rápido, o jogador de duas visitas termina o primeiro ano de jogo com 1,9 a 3,1 mil de ouro sem destino, e a semana, com 114 a 148 mil. É o número que a Guilda promete baixar. **Não houve playtest estruturado**, da v0.1, da v0.2 ou desta.

- **Para jogar em desenvolvimento:** `pnpm dev:up`, `pnpm dev:api`, `pnpm dev:web` e abrir `http://localhost:5173`.

## 2. O que continua aberto da v0.2

O registro completo está em [pendencias-v0.2.md](pendencias-v0.2.md) (seção 0, a tabela das respostas de 2026-10-05) e no [ADR 0016](decisions/0016-respostas-do-autor-as-pendencias-da-v0.2.md). O que sobrou:

| Item | O que é | Estado em 2026-10-05 |
|---|---|---|
| **B-2** | Na restauração de um backup, o procedimento deve guardar e reimportar as sessões? Hoje restaurar tira a sessão de quem jogou depois do backup ([deploy/README.md](../deploy/README.md), "O que a restauração custa a quem joga") | Sem resposta. Não foi levada ao autor na sessão de 2026-10-05, que tratou só das decisões 1 a 21 |
| Confirmação em bloco da v0.2 | O autor confirmou as leituras, as telas e os textos menores da v0.2 com quatro dias de jogo, sem ler item por item | Vale como confirmado (ADR 0016). Se ele trocar um deles, é mudança de conteúdo, golden e GDD no mesmo commit |
| Três frases novas da Fase G | Duas do painel da moral e uma da conta da lenha, escritas depois das aprovações | Não lidas pelo autor |
| Números da Fase G | Depósitos em 1.000, deserção por fome e aviso da Torre em tempo real, a fome que reabre | No ar desde 2026-10-05. Ninguém jogou com eles antes da publicação, e a matriz do simulador não mede a deserção (nenhum bot passa fome) |
| Resto da pendência C-8 | A fome que abre no caminho corta a Serraria, e a conta da lenha ainda diz que a lenha dá; "Antes de partir" pode dizer "A comida acaba em X" com o saldo de agora positivo | Defeito conhecido, marcado com `it.fails` em `packages/engine/src/seasonView.test.ts`. Pesa em V3F-T3, que acrescenta previsões à mesma tela |
| Três cartas de verão e de outono | Têm o mesmo desequilíbrio que a V2G-T4 corrigiu nas cartas da primavera; as tabelas da seção 4.2 de [content-v0.2.md](content-v0.2.md) estão velhas | Aberto. V3F-T1 mexe no catálogo e é o lugar de corrigir |
| "as Habitações já está no nível máximo" | Concordância errada em um texto de espera hoje inalcançável (`packages/engine/src/plannedView.ts`) | Aberto, sem pressa |
| Aviso da Torre no ritmo Tranquilo | No inverno, com a Torre Nv1, a obra da Paliçada cabe no aviso sem folga nenhuma | Aberto; lembrar ao escolher a janela de qualquer aviso novo da v0.3 |
| Firefox, Safari, celular e leitor de tela | Sem evidência nenhuma | Aberto; V3G-T2 registra |
| Expurgo de sete dias em produção | Nunca observado | Aberto |
| Os oito pontos do ADR 0012 e o vínculo GitHub | Endereço, letras, título e tom da página de apresentação; o vínculo continua desligado | Pendentes do autor (ato 24 do roadmap). A página não ganha texto sobre a Guilda antes do fechamento (V3G-T4.2) |

## 3. O que só o autor pode fazer

| Item | Por quê | Tarefa ou origem |
|---|---|---|
| **Backup fora do servidor** (destino externo para os backups do banco) | Os backups ficam no mesmo disco do banco; só o autor tem as credenciais de um destino externo. **Antes de a primeira migração de estado da v0.3 chegar à produção** | ato 23 do roadmap (§9.3) |
| **Cópia do `RECOVERY_CODE_SECRET` fora do Coolify** | Sem ela, perder o Coolify invalida todos os Códigos do Reino já emitidos | ato 23 |
| **Ensaio de reversão com duas imagens**, atravessando uma migração de estado, em banco descartável | Nunca foi feito; o procedimento de `deploy/README.md` saiu da leitura do código e de testes | ato 23; V2B-T1.6 |
| **Conferir no log do job `advance-stale-games` se alguma partida foi recusada no passo 11 → 12** | O agente não tem acesso ao banco nem aos logs de produção. Nenhum estado de produção tinha passado por esse passo antes da publicação da Fase G. O que se sabe: no arranque o job avançou 4 partidas paradas sem falha ([roadmap da v0.2](roadmap-v0.2.md), §11, "Lançamento da v0.2.0"); as outras migram na leitura, e ninguém olhou uma a uma | V3A-T1.1 |
| **Evidência manual por critério de aceitação da v0.2** | [acceptance-v0.2.md](acceptance-v0.2.md) tem a prova automática de cada critério e a evidência manual vazia | ato 23; V2F-T2 |
| **Playtest estruturado** (o da v0.1, o da v0.2 e o da v0.3) | Precisa de pessoas, de convite e de acesso ao banco de produção. O [convite](playtest/convite-v0.2.md) e o [formulário](playtest/formulario-v0.2.md) da v0.2 estão prontos | V2A-T1, V2F-T3, V3G-T3 |
| **Jogar cada fase da v0.3** | O roadmap previa o autor jogando cada fase antes de ela ser mesclada; com tudo no `main` e `push` em versão estável, a fase vai ao ar sem isso. O roteiro de cada fase sai junto com ela | V3C-T5.4, V3D-T5.5, V3E-T5.3, V3F-T4.4 |
| **Ler os 18 grafos de expedição e as 24 cartas do lote 2** | Curadoria é do autor. Entram como "rascunho, não lido pelo autor" em `docs/content-v0.3.md` (o arquivo nasce em V3C-T3) | decisões 12 e 19; V3D-T3.3, V3F-T1.7 |
| **Ler os números propostos no ADR 0017** (atributos das classes, traços, modelos e preços dos candidatos) | Propostos pelo agente depois da sessão; cobertos pela aprovação em bloco, sem leitura | V3A-T2.5 |
| **Canal de notificação do Coolify e o e-mail de alerta do GitHub** | Já eram pendências; conferir antes de um playtest | [deploy/README.md](../deploy/README.md) |
| **Tag e release da v0.3** | A publicação é por fase, com autorização; a tag e a release continuam do autor | V3G-T4 |

## 4. As decisões 1 a 21

Todas fechadas em 2026-10-05, em uma sessão de perguntas com opções. **"Respondida"** é a que o autor respondeu uma a uma; **"em bloco"** é a premissa recomendada do roadmap (§9), aprovada com as outras sem leitura item a item. Os números completos estão nos ADRs, que passam a ser a referência das tarefas.

| # | Decisão | O que foi aplicado | Modo | Onde |
|---|---|---|---|---|
| 1 | Relógios da v0.3 | Tudo em tempo de jogo, menos a espera da encruzilhada (6 h reais) e os prazos do soldo em atraso | em bloco | [ADR 0017](decisions/0017-regras-da-v0.3-herois-taverna-e-soldo.md) |
| 2 | Como chega à produção | Sem branches de fase: todo commit no `main`; `push` quando houver versão estável (lida como fim de fase com o portão verde), com backup manual antes de `push` que sobe o estado | **respondida: o autor trocou a premissa** | [ADR 0017](decisions/0017-regras-da-v0.3-herois-taverna-e-soldo.md) |
| 3 | Soldo quando falta ouro | 2 de ouro por hora de jogo por herói; sem dívida; com 12 h reais em atraso, Descontente; a partir de 24 h reais, parte um herói a cada 2 h reais; o atraso que reabre em menos de 2 h reais é o mesmo; Leal nunca parte | **respondida** ("Tempo real", a recomendada) | [ADR 0017](decisions/0017-regras-da-v0.3-herois-taverna-e-soldo.md) |
| 4 | Candidatos da Taverna | 2 nos níveis 1 e 2, 3 a partir do 3; rotação a cada 12 dias de jogo; preço fixo por modelo, de 80 a 300 | em bloco | [ADR 0017](decisions/0017-regras-da-v0.3-herois-taverna-e-soldo.md) |
| 5 | Limite de heróis | `1 + nível da Taverna`; recompensa de carta ou de expedição nunca é barrada | em bloco | [ADR 0017](decisions/0017-regras-da-v0.3-herois-taverna-e-soldo.md) |
| 6 | "Estrangeira ferida" | Dia 13 de jogo do ano 1; as duas opções dão herói (Edda ou Rolf); partidas em andamento recebem a carta uma vez, na primeira audiência com lugar | **respondida** ("Sim, a todos", a recomendada) | [ADR 0017](decisions/0017-regras-da-v0.3-herois-taverna-e-soldo.md) |
| 7 | Poder e atributos em inteiros | Atributos inteiros, +8% por nível sem compor, sorte de 85 a 115, desfecho por multiplicação cruzada | em bloco | [ADR 0017](decisions/0017-regras-da-v0.3-herois-taverna-e-soldo.md) |
| 8 | Ferimento, captura e morte | Leve 2 h e grave 12 h de jogo; o nó diz se fere ou captura; Camponês não captura; em Rei de Ferro a captura é morte | em bloco | [ADR 0017](decisions/0017-regras-da-v0.3-herois-taverna-e-soldo.md) |
| 9 | Sorteio por entidade | Fluxos `expedition:<id>` e `caravan:<id>`, apagados no fim; identificadores por contador; comando nunca sorteia | em bloco | [ADR 0017](decisions/0017-regras-da-v0.3-herois-taverna-e-soldo.md) |
| 10 | Moral da Taverna e festival | +5 de moral por nível; festival de 100 de comida e 50 de ouro, +15 por 24 h de jogo, um por estação | em bloco | [ADR 0017](decisions/0017-regras-da-v0.3-herois-taverna-e-soldo.md) |
| 11 | Encruzilhada e Postura | A opção de cada Postura marcada em cada encruzilhada; a da Cautelosa sem requisito; o prazo resolve antes de um comando no mesmo instante | em bloco | [ADR 0018](decisions/0018-expedicoes-mercado-mestres-e-cartas-na-v0.3.md) |
| 12 | Expedições que entram | Seis modelos, três variantes cada; destinos por descoberta; Guilda até o nível 4 | em bloco; o modo do conteúdo, **respondido** ("Escrevo e sigo; você revisa depois") | [ADR 0018](decisions/0018-expedicoes-mercado-mestres-e-cartas-na-v0.3.md) |
| 13 | O que se sabe antes de enviar | Duração, risco em palavra, poder e a dificuldade do primeiro trecho; o resto é "?" | em bloco | [ADR 0018](decisions/0018-expedicoes-mercado-mestres-e-cartas-na-v0.3.md) |
| 14 | Covil limpo e Ameaça | Ameaça −30 e o tile para de somar; os lobos voltam na virada do ano | em bloco | [ADR 0018](decisions/0018-expedicoes-mercado-mestres-e-cartas-na-v0.3.md) |
| 15 | Equipamento e custo de enviar | Três espaços, quatro raridades, sem desgaste nem venda; inventário de 30; enviar não custa provisões | em bloco | [ADR 0018](decisions/0018-expedicoes-mercado-mestres-e-cartas-na-v0.3.md) |
| 16 | Mercado | Comida, madeira e pedra; venda a 85% do preço do dia; `200 × nível` por recurso por dia de jogo; passeio de ±5% entre 60% e 160% da base | em bloco | [ADR 0018](decisions/0018-expedicoes-mercado-mestres-e-cartas-na-v0.3.md) |
| 17 | Caravanas | Mercado Nv2; só venda, até 300 unidades, 4 h de jogo, preço ×1,4 fixado no envio; emboscada de `máx(2, 10 − 5 × Torre)` por cento, zero com escolta; leva metade | em bloco | [ADR 0018](decisions/0018-expedicoes-mercado-mestres-e-cartas-na-v0.3.md) |
| 18 | Mestres | Aldeão nomeado, +15% no edifício em que trabalha, um por edifício; nunca escolhido por deserção | em bloco | [ADR 0018](decisions/0018-expedicoes-mercado-mestres-e-cartas-na-v0.3.md) |
| 19 | Lote 2 do Conselho | 24 cartas: 4 cadeias de 3, 2 roteirizadas, 10 avulsas; "O Lobo Branco" e "O Cobrador do Rei" adaptados | em bloco; o modo do conteúdo, **respondido** ("Escrevo e sigo; você revisa depois") | [ADR 0018](decisions/0018-expedicoes-mercado-mestres-e-cartas-na-v0.3.md) |
| 20 | Objetivos 11 a 16 | Seis novos; os de 1 a 10 intocados | em bloco | [ADR 0018](decisions/0018-expedicoes-mercado-mestres-e-cartas-na-v0.3.md) |
| 21 | IDEIA-08 a 12 | Todas entram, como interface ou conteúdo | em bloco | [ADR 0018](decisions/0018-expedicoes-mercado-mestres-e-cartas-na-v0.3.md) |

A decisão 22 (confirmar a v0.2) já estava respondida no ADR 0016. Os atos 23 e 24 estão nas seções 2 e 3.

## 5. Dúvidas levantadas durante a implementação

Cada item diz o que vale enquanto não houver resposta, onde está e o que muda se a resposta for outra. Os itens vão do mais importante para o menos, dentro de cada fase.

### Fase A: herança e decisões

São as contradições e as escolhas que o agente registrou ao escrever os ADRs 0017 e 0018, mais três leituras de traço. Nenhuma foi perguntada ao autor.

**A-1. A decisão 2, trocada, torna falsas frases do roadmap e do `CLAUDE.md`.**
- Enquanto isso: vale a instrução do autor, tudo no `main`. A §0.8 do roadmap e os cabeçalhos das Fases C a F foram corrigidos em V3A-T1; o `CLAUDE.md` não foi (a lista do que ficou falso nele está na subtarefa V3A-T1.12 do roadmap).
- Onde: ADR 0017, decisão 2 e "Consequências"; roadmap, §0.8; `CLAUDE.md`, "Convenções" ("Tarefas de tamanho `L` em branch") e "Ritual de conclusão de tarefa".
- Se decidir diferente: voltar aos branches de fase é reabrir a §0.8 como estava; nada no código depende disso.

**A-2. O ato 23 bloqueava a chegada de migração de estado à produção, e a autorização de `push` não o cumpre.**
- Enquanto isso: antes de cada `push` que sobe a versão do estado, o agente faz um backup manual do banco no servidor e anota o commit anterior como ponto de retorno, como na publicação da Fase G da v0.2. É o mínimo, não o substituto: o backup fica no mesmo disco, a cópia do `RECOVERY_CODE_SECRET` não existe fora do Coolify e a reversão nunca foi ensaiada.
- Onde: roadmap, §0.6 e §9.3 (ato 23); ADR 0017, "Consequências"; [deploy/README.md](../deploy/README.md), "Antes de um deploy que sobe a versão do estado".
- Se decidir diferente: se o ato 23 tiver de vir antes, nenhuma fase que sobe o estado (da B em diante) é publicada até ele ser feito; os commits continuam no `main` local.

**A-3. "Versão estável" é o fim de uma fase com o portão inteiro verde?**
- Enquanto isso: é essa a leitura. Cada fase que fecha com `pnpm verify`, integração, navegador e a matriz do simulador verdes pode ser publicada. Consequência dita: publicar a Fase C sozinha entrega a quem joga heróis que cobram soldo e ainda não têm trabalho (a Guilda é da Fase D).
- Onde: ADR 0017, decisão 2 e "Consequências".
- Se decidir diferente: com a régua "só depois da Fase D" (ou "só no fim da versão"), as fases se acumulam no `main` local e a publicação seguinte sobe várias versões do estado de uma vez, em passos, um por fase.

**A-4. O herói que o prazo do atraso deve e que não pode partir porque está fora.**
- Enquanto isso: continua devido enquanto o atraso durar e parte na primeira virada em que houver no feudo um herói que não seja Leal. Fechado o atraso, nada fica devido: não há dívida. Se só restam Leais, ninguém parte.
- Onde: ADR 0017, "Detalhes que as premissas deixavam abertos"; V3C-T1.4.
- Se decidir diferente: perdoar o que venceu com o herói fora torna a expedição um abrigo contra o atraso; é mudança de regra, de golden e de GDD em V3C-T1.

**A-5. "Perícia pesa ×1,5" no nó não tem conta definida.**
- Enquanto isso: nada foi implementado. Como um peso de atributo de nó vira fator do poder não está na premissa 7 nem em V3D-T1.6; a pergunta vai no plano de V3D-T1.
- Onde: ADR 0017, "Números que o GDD não tinha"; ADR 0018, "Consequências".
- Se decidir diferente: não há "diferente" ainda; a escolha muda a calibragem de todo grafo que usa peso de atributo.

**A-6. Com os atributos propostos, a equipe mínima das Ruínas nunca chega ao Desastre no chefe do exemplo.**
- Enquanto isso: a tabela de atributos fica como está. Se a captura marcada no chefe tem de ser possível, sobe a dificuldade do chefe ou a exigência de nível; conferir em V3D-T3.6.
- Onde: ADR 0017, "Calibragem".
- Se decidir diferente: mexer nos atributos-base por causa de um grafo muda o poder de todas as classes em todas as expedições.

**A-7. "Pronto quando: aprovados pelo autor" não vale com "escrevo e sigo".**
- Enquanto isso: V3D-T3 (os grafos) e V3F-T1 (as cartas), e o texto da "Estrangeira ferida" em V3C-T3, ficam prontas com o conteúdo implementado, testado e marcado "rascunho, não lido pelo autor". O passo "aprovado" da ficha fica pendente, um por grafo e um por carta (seção 3).
- Onde: ADR 0018, "O conteúdo narrativo: o que 'escrevo e sigo' muda"; roadmap, V3D-T3.3 e V3F-T1.7.
- Se decidir diferente: cada reescrita é mostrada antes de entrar. Texto e números são fáceis de trocar; os ids de carta, de opção e de modelo de expedição, depois de publicados, só mudam com passo de migração.

**A-8. O sorteio dos modelos da Taverna é com ou sem reposição dentro de uma rotação?**
- Enquanto isso: nada foi implementado. Os pesos do ADR 0017 foram pensados para sorteio sem reposição (a mesma oferta não aparece duas vezes na mesma lista); a escolha é do plano de V3C-T2.
- Onde: ADR 0017, "Detalhes que as premissas deixavam abertos" e "Modelos de candidato da Taverna".
- Se decidir diferente: com reposição, dois candidatos iguais podem aparecer juntos, e os pesos precisam de outra conta.

**A-9. Ganancioso: 10% de o saque de um nó se perder.**
- Enquanto isso: é a leitura do agente do Apêndice D do GDD, que só esboça o traço. O sorteio entraria na ordem fixa dos sorteios do nó, depois da sorte. Pede confirmação no plano de V3D-T1.
- Onde: ADR 0017, "Os oito traços, só com o que a v0.3 usa".
- Se decidir diferente: sem o sorteio, o Ganancioso só dá bônus e vira o traço dominante dos modelos baratos.

**A-10. Prudente: "armadilhas simples" lido como nó `hazard`.**
- Enquanto isso: em nó `hazard`, o Prudente não é sorteado para o ferimento leve de um Revés. Pede confirmação no plano de V3D-T1.
- Onde: ADR 0017, "Os oito traços".
- Se decidir diferente: outra leitura muda quais nós o catálogo de V3D-T3 marca.

**A-11. Rastreador: garante a revelação de um destino também no Revés.**
- Enquanto isso: é a leitura do agente. Se o catálogo de V3D-T3 não condicionar a revelação ao desfecho, o traço fica sem efeito e sai dos modelos de candidato.
- Onde: ADR 0017, "Os oito traços".
- Se decidir diferente: o "tile extra" do GDD é do mapa da v0.5 e não entra.

## 6. O que não foi verificado

### Fase A

Do mais arriscado para o menos. A lista cresce a cada fase.

1. **Se alguma partida de produção foi recusada no passo 11 → 12.** O agente não tem acesso ao banco nem ao log do job `advance-stale-games`. A produção responde `server: 0.2.0`, `protocol: 2`, `contentHash` `cea08e6e14163458`, `builtAt` 2026-10-05T16:51:29Z em `GET /v1/version`; isso não diz nada sobre partida recusada. O que há é o registro do lançamento: 4 partidas paradas avançadas no arranque, sem falha.
2. **Reversão com duas imagens, backup fora do servidor, restauração de verdade.** Nada disso foi feito (seção 3).
3. **Não houve playtest estruturado.** Toda linha "Diversão" do roadmap continua hipótese.
4. **As decisões em bloco não foram lidas item a item** pelo autor, e os números propostos no ADR 0017 não foram lidos por ele. A calibragem das classes foi conferida por conta, não por simulador: não existe código de herói ainda.
5. **A linha de base foi medida no Node 24.15.0**, e não no 22 do `.nvmrc`, em uma rodada só. Os tempos de `advanceTo` foram medidos com a máquina ocupada por outra suíte ([balance-v0.3.md](balance-v0.3.md), seção 1.6).
6. **A matriz não mede fome, frio nem deserção:** nenhum bot passa por eles. O mesmo vai valer para o soldo em atraso se nenhum bot ficar sem ouro (V3B-T2 e V3C-T5.2 precisam de um perfil que fique).
7. **A dispersão por semente** não foi olhada além do menor, da mediana e do maior do ouro (seção 2 de balance-v0.3.md, de V3B-T2).
8. **Estoque acima do limite nos retratos de estado da versão 12** e a cobertura de partidas migradas (um cenário só, Senhor no ritmo 3): herdados de V3A-T1.5, são a primeira coisa a olhar em V3B-T1.1.
9. **As dívidas da §10.1 do roadmap** foram reconferidas por busca no código, não por execução: nenhum teste foi escrito para elas.
10. **Os documentos em Markdown desta tarefa** tiveram links e âncoras conferidos por roteiro; não foram vistos em um visualizador.
