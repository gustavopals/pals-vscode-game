# Pendências e dúvidas da v0.3

> **Para ler primeiro.** Em 2026-10-05, com a v0.2 fechada e no ar, o autor respondeu em uma sessão de perguntas às decisões de regra da v0.3 (ADRs [0017](decisions/0017-regras-da-v0.3-herois-taverna-e-soldo.md) e [0018](decisions/0018-expedicoes-mercado-mestres-e-cartas-na-v0.3.md)) e pediu a implementação da versão inteira nesta execução, tudo no `main`, com `push` quando houver versão estável. Este documento é a caixa de entrada dele, no formato de [pendencias-v0.2.md](pendencias-v0.2.md): o que foi decidido e de que modo, o que só ele pode fazer, as dúvidas que a implementação levantar e o que ficar sem verificação. É registro, não leitura obrigatória: o que precisar de resposta chega como pergunta curta com opções. Nasceu na tarefa V3A-T1 do [roadmap da v0.3](roadmap-v0.3.md) e cresce a cada fase.

## 1. O mais importante

Em seis linhas, por ordem de importância:

1. **O backup fora do servidor, a cópia do `RECOVERY_CODE_SECRET` e o ensaio de reversão continuam por fazer, e a v0.3 vai subir a versão do estado em produção assim mesmo** (seção 3; dúvida A-2). O roadmap dizia que esses atos bloqueavam a chegada de qualquer migração de estado à produção; a autorização de `push` de 2026-10-05 não os cumpre. O agente faz um backup manual no servidor antes de cada `push` que sobe o estado: é o mínimo, não o substituto.
2. **Você não vai jogar cada fase antes de ela ir ao ar** (dúvida A-3). Quem joga em produção recebe cada fase sem que o autor a tenha jogado. "Versão estável" foi lido como o fim de uma fase com o portão inteiro verde; publicar a Fase C sozinha cobra soldo de heróis que ainda não têm trabalho. Se a régua for outra (por exemplo, só depois da Fase D), basta dizer.
3. **Os 18 grafos de expedição e as 24 cartas entram no jogo como "rascunho, não lido pelo autor"** (decisões 12 e 19; dúvida A-7). A leitura deles é sua, depois, um por um; os números das classes, dos traços e dos candidatos da Taverna do ADR 0017 também não foram lidos.
4. **Dezoito das 21 decisões foram aprovadas em bloco, sem leitura item a item** (seção 4). Só a 2, a 3 e a 6 foram respondidas uma a uma. Se o simulador mostrar problema em alguma, ela volta como pergunta pontual, com o número medido.
5. **A régua do ouro está medida** ([balance-v0.3.md](balance-v0.3.md), seção 1.3): em Senhor, no ritmo Rápido, o jogador de duas visitas termina o primeiro ano de jogo com 1,9 a 3,1 mil de ouro sem destino, e a semana, com 114 a 148 mil. É o número que a Guilda promete baixar. **Não houve playtest estruturado**, da v0.1, da v0.2 ou desta.
6. **A carta do primeiro herói está no jogo, com texto que você não leu, e quem não responde às cartas a recebe um dia depois** (seção 5, C-13 e C-14; [content-v0.3.md](content-v0.3.md)). Ela pede lugar na mesa do Conselho e não o reserva: quem joga a recebe na audiência do 13º dia de jogo; quem deixa duas cartas na mesa, na seguinte. Toda partida, nova ou antiga, ganha um herói e passa a pagar soldo. Reservar o lugar é mudança de regra, e a pergunta é sua.
7. **A Taverna está no motor, no servidor e, desde a V3C-T4, na tela (a aba Guilda)** (seção 5, C-20 a C-36; [balance-v0.3.md](balance-v0.3.md), seção 4). Quatro coisas pedem a sua atenção, nesta ordem: **(a)** a aba Guilda existe, mas ninguém além dos testes a usou, e seis frases dela são rascunho (C-37 a C-46; a C-31 está resolvida); **(b)** no ritmo Rápido a lista de candidatos troca a cada 8 h reais, e quem visita duas vezes por dia perde uma de cada três listas, o contrário do que o ADR 0017 pedia para validar (C-21); **(c)** com a Taverna na fila de obras o Salão sobe mais devagar em três células do simulador e a meta de desperdício do Regular volta a falhar no ritmo Normal (C-22); **(d)** o ouro parado subiu, e contratar não o gasta: cinco heróis custam cem vezes menos do que a Mina do fim de jogo rende (C-23).

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

**A-8. O sorteio dos modelos da Taverna é com ou sem reposição dentro de uma rotação?** *(Fechada em V3C-T2 pelo orquestrador da execução: sem reposição. Ver C-20.)*
- Enquanto isso: implementado sem reposição. Os pesos do ADR 0017 foram pensados para sorteio sem reposição (a mesma oferta não aparece duas vezes na mesma lista); a escolha é do plano de V3C-T2.
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

### Fase C: correções da revisão independente (V3C-T5)

Vêm das revisões independentes da Fase C. Cada item diz o que a correção **mudou de regra**; os de "dúvida" não mudaram nada e só pedem resposta. **Nenhuma foi perguntada ao autor**: as de regra foram decididas pelo orquestrador ou pelo agente das correções, e os commits são os `V3C: corrige …`.

**C-47. A virada do dia cobra também o atraso do soldo que fechou há menos de 2 h reais.** *(Mudança de regra; revisão M-D1.)*
- O defeito: a virada só cobrava o atraso **aberto** naquele instante. Pôr três aldeões na Mina um segundo antes de cada virada e tirá-los um segundo depois fechava e reabria o mesmo atraso para sempre: trinta dias de jogo, sessenta horas de atraso contadas, nenhum herói Descontente na virada, nenhum herói partindo.
- Enquanto isso: a virada que encontra o atraso fechado **dentro da janela de retomada** (a mesma das 2 h reais da decisão 3) cobra as partidas que a duração dele já devia e ainda não tinha cobrado. Ninguém fica Descontente com o atraso fechado. Fora da janela, nada.
- **A consequência que o autor precisa conhecer:** quem paga de verdade um atraso velho pode perder um herói mesmo assim. Se o atraso passou das 24 h reais (ou de mais um passo de 2 h) depois da última virada e o ouro chegou antes da seguinte, o herói que o prazo já devia parte nessa virada, com o soldo em dia. Pagar antes de o prazo vencer é o que o segura. Não há como o motor distinguir o pagamento de verdade do truque sem olhar o futuro.
- Onde: `wageLedgerAt` e `turnWages`, em `packages/engine/src/wages.ts`; README do motor, "Heróis e soldo".
- Se decidir diferente: (a) cobrar só quando o atraso **reabrir** dentro da janela (ninguém que pagou e ficou em dia perde herói; a partida passa a acontecer no instante em que o ouro acaba de novo, fora da virada, e a ordem do instante ganha um passo); (b) aceitar o truque como jogada legítima (ele pede presença em toda virada) e voltar à regra antiga.

**C-48. A deserção por fome da v0.2 tinha o mesmo furo, e foi corrigida do mesmo jeito: é mudança de regra em partidas vivas.** *(Mudança de regra da v0.2, feita pelo agente no espírito do ADR 0016, item 3; para o autor confirmar. Revisão M-D1b.)*
- O defeito, reproduzido: fome aberta, e todos os aldeões mandados à Fazenda um segundo antes de cada virada e tirados um segundo depois. Em doze dias de jogo no ritmo 1 a fome fechou e reabriu doze vezes, contou mais de 20 h, e **ninguém desertou**. A janela do ADR 0016 guardava a duração, mas a virada só cobrava a fome aberta.
- Enquanto isso: a virada que encontra a fome fechada **há menos de 2 h reais** cobra os desertores que a duração dela já devia; a conta fica em `lastFamine.deserted`. O piso de 3 e a dificuldade Camponês valem como antes. Nenhuma forma de estado mudou, não há passo de migração, e nenhum golden nem retrato mudou.
- **Quem joga de verdade sente assim:** se a fome passou das 12 h reais (ou de mais um passo de 2 h) depois da última virada e a comida voltou antes da seguinte, o aldeão que já era devido deserta nessa virada, com a despensa cheia. A aba da moral avisa antes ("A fome acabou há pouco, mas já devia um aldeão: ele deserta na próxima virada do dia, em 1 h."). O texto do aviso é rascunho do agente.
- **O que não foi corrigido:** o termo da fome na **moral** (−20 e −2 por dia) continua contando só com a fome aberta na virada; o mesmo vaivém ainda o evita. O custo do truque é real (todo aldeão movido se readapta por um dia de jogo), e mexer na moral de quem está alimentado é mudança maior; fica para o autor.
- Onde: `famineLedgerAt` (`packages/engine/src/famine.ts`), `desertFromFamine` (`moraleTurn.ts`), a nota em `moraleView.ts`; GDD §5.6; README do motor, "Moral".
- A matriz do simulador: não mexeu (nenhum bot passa fome por 12 h reais; ver o Registro).
- Se decidir diferente: as mesmas alternativas de C-47.

**C-49. O atraso que reabre dentro da janela devolve o Descontente na hora, sem linha na Crônica.** *(Mudança de regra; revisão M-D2.)*
- O defeito: fechado o atraso, ninguém fica Descontente; reaberto no mesmo instante (ouro que entra e sai), o herói só voltava a estar Descontente na virada seguinte. Duas ordens davam um dia de jogo de poder inteiro.
- Enquanto isso: ao reabrir dentro da janela, com a duração contada já nas 12 h reais, quem não é Leal volta a estar Descontente naquele instante. A Crônica não repete "ficou descontente": a linha é da virada em que ele ficou.
- Limite conhecido: no vaivém de C-47 (fechar antes de toda virada), o herói passa a estar Descontente sem que a Crônica tenha dito isso alguma vez, porque nenhuma virada o encontrou com o atraso aberto. A ficha dele mostra o estado.
- Onde: `resumeDiscontent`, em `packages/engine/src/wages.ts`.
- Se decidir diferente: emitir a linha também na retomada é uma chamada a `emit`; o risco é a Crônica repetir a frase a cada vaivém.

**C-50. Os prazos do atraso contam, para cada herói, do atraso vivido por ele.** *(Mudança de regra, decidida pelo orquestrador e formulada pelo agente; para o autor rever. Revisão M-R1.)*
- O defeito: a tela promete 12 h reais até o Descontente e 24 h até a partida, mas os prazos eram só do atraso. Um herói contratado em um atraso de dois dias ficava Descontente e partia na virada seguinte, menos de 2 h depois de pago o preço dele.
- Enquanto isso: o atraso vivido por um herói é `min(duração do atraso, tempo desde a chegada dele)`. Ele só fica Descontente com 12 h reais vividas e só **pode** partir com 24 h. Os devidos continuam sendo os do atraso (um a cada 2 h reais depois das 24 h); parte o último a chegar **entre os que já podem**. Se ninguém pode ainda (só Leais, ou só recém-chegados), o devido daquela virada fica perdoado, como já ficava com só Leais.
- **Onde o agente se afastou da sugestão do orquestrador**, que era não perdoar enquanto houvesse quem fosse se tornar elegível: guardar o devido faria dois recém-chegados partirem **na mesma virada** ao completarem as 24 h (em bloco, o que a regra do perdão existe para impedir). Com o perdão, o recém-chegado parte no primeiro passo de 2 h que vencer depois das 24 h dele: entre 24 h e 26 h reais vividas, mais a espera pela virada; dois que chegam juntos partem com um passo de diferença. A promessa da tela ("com 24 h, parte um herói a cada 2 h") se cumpre, e `nextDepartureInSeconds` diz a virada exata (testado nos três ritmos).
- Aproximação conhecida: o estado não guarda os intervalos em que um atraso retomado esteve fechado; quem chegou durante um deles conta também o resto do intervalo (no máximo 2 h reais).
- A frase do atraso ganha, só quando há um herói assim: "Para quem chegou com o atraso já aberto, os dois prazos contam da chegada." Rascunho do agente.
- Onde: `heroArrearsMs`, `turnWages`, `nextDiscontentAt` e `nextWageDepartureAt`, em `packages/engine/src/wages.ts`.
- Se decidir diferente: (a) prazos só do atraso, como antes, e a tela passa a dizer o prazo de verdade do recém-chegado; (b) guardar o devido (a sugestão original), aceitando a partida em bloco.

**C-51. Um herói com nome é prometido uma vez só, e a lista dos prometidos cumpre o teto.** *(Endurecimento; revisão M-R3.)*
- O risco: `promiseHero` não olhava `arrivingCap`; uma quinta promessa só era barrada pela guarda de forma, ao gravar, com erro 500 em toda escrita daquela partida. E o mesmo herói com nome podia ser prometido duas vezes.
- Enquanto isso: quem já foi prometido ou já serve ao feudo (pelo nome: os nomes de carta nunca são sorteados para candidato) não é prometido de novo, e a carta que o daria não diz que deu. Com isso a lista tem no máximo um lugar por herói com nome, e um teste de conteúdo exige que eles caibam todos no teto: a recompensa nunca é perdida por ele. Nenhuma carta de hoje chega a esses casos.
- Onde: `promiseHero`, em `packages/engine/src/arrivals.ts`; `packages/content/src/content.test.ts`.
- Se decidir diferente: se algum dia uma carta puder dar "outro" herói com o mesmo nome (um irmão, um retorno), o herói precisa de um identificador de origem no estado.

**C-52. O atraso fecha com o saldo de ouro exatamente em zero.** *(Mudança de regra e de uma frase do GDD §9.1; revisão M-R6.)*
- O risco: um mineiro rende exatamente o soldo de dois heróis. Com o atraso aberto e o saldo em zero, os heróis recebiam o soldo inteiro e o atraso continuava aberto ("fecha quando o saldo volta a ser positivo"): ficavam Descontentes e partiam pagos.
- Enquanto isso: fecha quando o saldo **deixa de ser negativo**. Continua sendo o contrário exato da condição que abre (que pede saldo negativo), e a divisão de intervalo continua exata (o saldo só muda em instantes de evento ou de ordem). A fome e o frio não mudaram: pedem saldo positivo, porque cortam a produção enquanto duram.
- Onde: `goldCoversWages`, em `packages/engine/src/economy.ts`; GDD §9.1 ("deixa de ser negativo").
- Se decidir diferente: voltar ao "positivo" é uma linha; a tela teria de dizer que pagar o soldo inteiro não basta.

**C-53. `balance.tavern.festival.perSeason` saiu do conteúdo.** *(Limpeza; revisão M-Q5. Não muda regra.)*
- O que era: o ADR 0017 (decisão 10) escreve `perSeason: 1` entre os números do festival, mas o motor nunca o leu: "um por estação" é `festivalHeldThisSeason`, que compara o último festival com o começo da estação. O schema só aceitava o valor 1, para ninguém achar que trocá-lo mudaria algo.
- Enquanto isso: o campo não existe; a regra é a mesma. O texto do ADR ficou como registro da decisão.
- Se decidir diferente: dois festivais por estação pedem um contador no estado (versão nova e passo de migração), e aí o campo volta com o motor lendo.

### Fase C: a interface da Guilda (V3C-T4)

Vêm da implementação de V3C-T4 (a aba Guilda, os três comandos, a árvore, a barra, os avisos, "Antes de partir" e o Relatório). **Nenhuma foi perguntada ao autor**; todas foram decididas pelo agente da tarefa. As três primeiras são as que pedem resposta.

**C-37. A aba diz "Sua equipe ainda não tem para onde ir", mas não diz "abre com o Salão Nv3".** *(Desvio do texto do roadmap, V3C-T4.5.)*
- Enquanto isso: a frase da visão é "Sua equipe ainda não tem para onde ir: as expedições esperam a Guilda dos Aventureiros, que o feudo ainda não sabe erguer. Até lá, os heróis ficam no feudo, e o soldo corre." O edifício da Guilda só existe na Fase D: prometer o nível do Salão hoje seria um número de regra de um edifício que o conteúdo não tem.
- Onde: `guildTexts.noDestination`, em `packages/content/src/heroes.ts`; `guild.text` na visão.
- Se decidir diferente: é trocar a frase no conteúdo (e o golden); a V3D-T1, que cria o edifício, troca a frase por uma com o requisito de verdade.

**C-38. Quatro frases novas no conteúdo são rascunho do agente.**
- Enquanto isso: `guildTexts.noHeroes` ("Nenhum herói serve ao feudo ainda. O primeiro costuma chegar pelo Conselho: quando alguém pedir abrigo, a resposta é sua. Os seguintes, quem traz é a Taverna."), `awaited`, `noDestination` (C-37) e `dismiss` ("Dispensar não devolve nada: o que foi pago pelo trato não volta, e quem parte não fica à espera. O soldo deixa de correr na mesma hora."). Nenhuma traz número nem data, e um teste do motor barra isso.
- Onde: `packages/content/src/heroes.ts`; as frases de ligação do app estão em `packages/web/src/ui/guild.ts`.
- Se decidir diferente: mudança de conteúdo e golden no mesmo commit. "O primeiro costuma chegar pelo Conselho" dá uma pista da carta roteirizada sem dizer o dia; se preferir não dar pista nenhuma, é uma frase.

**C-39. A aba Guilda é fixa e vem depois do Conselho; o GDD §13.1 a cita antes.**
- Enquanto isso: as abas fixas são Hoje, Feudo, Conselho, Guilda. Em 720 px as quatro cabem.
- Onde: `visibleTabs`, em `packages/web/src/app/router.ts`.
- Se decidir diferente: é a ordem de uma lista e dos testes que a conferem.

**C-40. O soldo em atraso entra na barra de status depois da fome e do frio e antes das cartas.**
- Enquanto isso: sem ligação > incursão à vista > fome e frio > soldo em atraso > decisões pendentes > depósito > obra. O roadmap põe "frio, fome ou soldo em atraso" no mesmo degrau; quando a fome e o atraso coincidem, a linha é a da fome, e o atraso continua no cabeçalho, na árvore e na aba.
- Onde: `statusTopic`, em `packages/web/src/ui/format.ts`.
- Se decidir diferente: uma linha "Fome e soldo em atraso", como já existe "Fome e frio".

**C-41. Contratar e dar festival pelo painel não pedem confirmação; dispensar pede sempre.**
- Enquanto isso: no painel o preço e o soldo (ou o custo e o efeito do festival) estão ao lado do botão, e a ordem segue, como "Construir". O botão "Contratar" da árvore também contrata direto, com o preço na linha e na dica. Pela paleta, contratar mostra a lista com os preços, e o festival confirma (pela árvore também). O duplo clique não contrata duas vezes.
- Onde: `palette/commands.ts` (`hireHero`, `holdFestival`, `dismissHero`).
- Se decidir diferente: uma confirmação a mais em `hireHero`, com o preço e o soldo.

**C-42. O herói contratado não vira aviso; o que uma carta prometeu, sim.**
- Enquanto isso: `heroJoined` avisa no nível "Essenciais", sem tom de alarme; `heroHired`, `heroDismissed` e `festivalHeld` não avisam em nível nenhum (são ordens do jogador), nem quando a ordem veio de outro navegador; `festivalEnded` só em "Todas". O atraso que abre, o herói descontente e o que parte são alarmes.
- Onde: `packages/web/src/notifications/policy.ts`.
- Se decidir diferente: mover o tipo de lista.

**C-43. No Relatório de Retorno o soldo não tem coluna: está dentro da "Produção" do ouro.**
- Enquanto isso: a nota da tabela diz "(no ouro, o soldo dos heróis: ele não é gasto de uma ordem)" quando há equipe. Os eventos da equipe caem nos blocos (quem chegou e o festival em "prosperou"; o atraso, o descontente e quem partiu em "exigiu um preço"). O tratamento completo é a V3F-T3.
- Onde: `packages/web/src/game/returnReport.ts`, `components/Today.tsx`.
- Se decidir diferente: nada antes da V3F-T3; a coluna pede que o motor some o soldo pago em um evento.

**C-44. "Heróis N" só aparece no cabeçalho quando há herói, e "Antes de partir" só fala do soldo quando o ouro acaba em menos de um dia.**
- Enquanto isso: o feudo sem herói não mostra "Heróis 0"; o item do soldo usa o mesmo horizonte de um dia dos outros itens e leva à Mina de Ouro (não sugere dispensar ninguém).
- Onde: `components/Header.tsx`, `game/beforeLeaving.ts`.
- Se decidir diferente: são duas condições.

**C-45. Os ícones da Guilda são a bússola, a pessoa e a xícara.**
- Enquanto isso: `compass` (Guilda), `person` (herói), `coffee` (Taverna), dos Codicons, que não têm caneca nem espada.
- Onde: `packages/web/src/ui/guild.ts`.
- Se decidir diferente: três constantes.

**C-46. Uma ordem da Guilda aceita não ganha aviso de confirmação.**
- Enquanto isso: quem contrata, dispensa ou dá festival vê o resultado na aba Guilda, na árvore e na linha do ouro; a Crônica registra a frase. Pela paleta, com outra aba à vista, o único sinal é a árvore. A resposta a uma carta, que é o caso parecido, mostra a frase da Crônica por alguns segundos; aqui não, porque o aviso ficaria por cima da coluna da Taverna, onde está o botão seguinte.
- Onde: `controller.guildOrder`, em `packages/web/src/app/controller.ts`.
- Se decidir diferente: um aviso curto com a frase do evento (`heroHired`, `heroDismissed`, `festivalHeld`), como `tellOwnAnswers` faz com a carta.

### Fase C: a Taverna (V3C-T2)

Vêm da implementação de V3C-T2 (o edifício, os candidatos em rotação, `hireHero`, a moral, `holdFestival`; estado na versão 16). **Nenhuma foi perguntada ao autor.** A C-20 o orquestrador da execução decidiu antes de a tarefa começar; as outras são do agente da tarefa. As quatro primeiras depois dela são as que pedem resposta.

**C-20. O sorteio dos candidatos é sem reposição dentro de uma lista, e nenhum candidato repete o nome de quem já serve.** *(Decidida pelo orquestrador; fecha a A-8.)*
- Enquanto isso: em uma rotação, dois candidatos nunca são o mesmo modelo, e nenhum tem o nome de um herói do feudo, de um prometido por carta ou de outro candidato da lista. De uma rotação para a outra pode haver repetição: o mesmo modelo, e o nome de um candidato que saiu sem ser contratado.
- Onde: `drawOffers`, em `packages/engine/src/tavernTurn.ts`; `tavern.test.ts`, "em uma rotação ninguém repete".
- Se decidir diferente: com reposição, os pesos do ADR 0017 pedem outra conta; mexer na ordem dos modelos ou dos nomes muda quem toda Taverna oferece, como uma carta nova muda o sorteio do Conselho.

**C-21. No ritmo Rápido a lista de candidatos troca a cada 8 h reais: quem visita duas vezes por dia perde uma de cada três listas.** *(Pergunta para o autor.)*
- Enquanto isso: vale o ADR 0017, decisão 4: rotação de 12 dias de jogo, que são 24 h reais no Normal, 48 h no Tranquilo e 8 h no Rápido. O mesmo ADR pede para validar que "o jogador de duas visitas vê cada lista da Taverna ao menos uma vez": no Rápido, o ritmo de produção, isso **não vale por conta** (12 h entre visitas contra 8 h de lista), e o simulador não conta listas vistas. "Depois eu vejo" tem preço, como a tarefa quer; no Rápido o preço é perder candidatos sem nunca tê-los visto.
- Onde: `balance.tavern.rotationMs`; [balance-v0.3.md](balance-v0.3.md), seção 4.6.
- Se decidir diferente: a rotação em tempo real (como o prazo de uma carta) seria a sexta constante de tempo real do motor; uma rotação mais longa em tempo de jogo (36 dias de jogo dá 24 h reais no Rápido e três dias reais no Normal) muda o Normal junto. As duas são mudança de conteúdo, de golden e de GDD.

**C-22. Com a Taverna na fila de obras, o Salão sobe mais devagar e a meta de desperdício do Regular volta a falhar no ritmo Normal.** *(Regressão medida; pergunta para o autor.)*
- Enquanto isso: nenhum número foi mexido para compensar, e os bots Regular, Dedicado e Preguiçoso não foram tocados. As faixas foram regravadas com o que o jogo faz hoje. Em Senhor: o Salão termina um nível abaixo no Regular da semana do Tranquilo (50 de 50 sementes), no Preguiçoso do ano do Tranquilo (38 de 50) e no Regular da semana do Rápido (4 de 50); a meta de 8 h de jogo sem desperdício falha no Normal em uma semente (10 h), no ano do Rápido em duas (9 h), e a semana do Rápido sobe de 33 para 36 h.
- Onde: [balance-v0.3.md](balance-v0.3.md), seção 4.5; `packages/sim-cli/src/balance.test.ts`, "a meta de desperdício".
- Se decidir diferente: é o bot escolhendo a obra mais barata; um jogador que queira o Salão primeiro o terá. Se o atraso incomodar no jogo, as saídas são de conteúdo (a curva de custo da Taverna, ou o pré-requisito de cada nível), nunca no bot.

**C-23. O ouro parado subiu, e contratar não o gasta.** *(Medida; é o número que a v0.3 promete baixar.)*
- Enquanto isso: em Senhor, na semana do Rápido, o Regular termina com até 212 mil de ouro parado (eram 150 mil) e o Explorador, que contrata os cinco heróis que a Taverna deixa, com até 239 mil. A moral da Taverna traz mais gente e mais produção; o soldo de seis heróis é de 36 de ouro por hora real contra 2.500 da Mina.
- Onde: [balance-v0.3.md](balance-v0.3.md), seção 4.4.
- Se decidir diferente: nada a decidir agora. O que o plano tem para gastar ouro são as expedições e o Mercado (Fases D e E); se depois delas o número continuar assim, a pergunta volta com a medida.

**C-31. O app de hoje já deixa erguer a Taverna, e ainda não tem onde contratar.** *(**Resolvida na V3C-T4**, em 2026-10-05: a aba Guilda contrata, dispensa e dá festival pelo painel, pela árvore e pela paleta. O texto abaixo fica como registro.)*
- Enquanto isso: a obra aparece na lista de construções da aba Feudo como a de qualquer edifício (presa ao Salão no nível 3), e erguê-la soma moral, que a tela já explica termo a termo. Os candidatos, a contratação e o festival não têm tela: só a API. A aba Guilda é a V3C-T4.
- Onde: `tests/e2e/09-guilda.spec.ts` (o que há em navegador); roadmap, V3C-T4.
- Se decidir diferente: publicar a Fase C sem a V3C-T4 entrega um edifício de 360 de material cuja metade do efeito é invisível. A leitura do agente é que a V3C-T4 vem antes do `push`.

**C-24. A troca dos candidatos tem instante próprio na linha do tempo, e entra na ordem do instante depois das incursões.** *(Decidida pelo agente; é a proposta da §0.7 do roadmap.)*
- Enquanto isso: a rotação conta do instante em que a obra da Taverna termina, que quase nunca é uma virada de dia, e é processada no instante exato (`nextTavernRotationAt`, um candidato de `nextEventAt`). Na ordem do instante vem depois das obras, da virada do dia, dos heróis que chegam e das incursões, e antes das planejadas e dos objetivos: a lista nasce com o número de candidatos do nível daquele instante e sem o nome de quem acabou de chegar.
- Onde: `processEventsAt`, em `packages/engine/src/advance.ts`; README do motor, "Taverna"; `tavern.test.ts`.
- Se decidir diferente: cobrar a rotação na virada do dia seguinte tira um instante da linha do tempo e deixa o candidato na tela até 2 h de jogo depois de trocado.

**C-25. Subir o nível da Taverna não mexe na lista que está na mesa: o terceiro candidato vem na troca seguinte.** *(Decidida pelo agente.)*
- Enquanto isso: o número de candidatos é o do nível no instante da rotação. Quem chega ao nível 3 espera até 12 dias de jogo pelo terceiro.
- Onde: `offersPerRotation`, `rotateOffers`.
- Se decidir diferente: sortear o candidato que falta no fim da obra é um sorteio a mais em um instante que já existe; a lista passaria a ter candidatos de idades diferentes.

**C-26. O festival dura 12 viradas de dia e acaba na décima terceira, sem instante próprio; dado na estação seguinte com o anterior em curso, troca o efeito.** *(Decidida pelo agente.)*
- Enquanto isso: "24 h de jogo (12 dias de jogo)" do ADR 0017 não é contradição com o roadmap: o dia de jogo tem 2 h. O festival é um efeito temporário de moral como os das cartas: não mexe na moral na hora, conta em doze viradas e a seguinte o encerra, com a linha `festivalEnded` na Crônica. "Um por estação" olha o instante do último festival dado: no primeiro instante da estação nova o feudo pode festejar de novo, mesmo com o anterior ainda valendo, e o efeito é trocado, não somado (a moral não chega a +30). O custo não cresce com o nível da Taverna.
- Onde: `holdFestival`, em `packages/engine/src/tavernOrders.ts`; `endFestival`, em `tavernTurn.ts`.
- Se decidir diferente: somar dois festivais, ou exigir que o anterior tenha acabado, é mudança de regra pequena, com golden.

**C-27. O estado guarda o instante do último festival e o preço cheio de cada oferta; o Apêndice B do roadmap foi ajustado.** *(Decidida pelo agente.)*
- Enquanto isso: `guild.tavern` é `{ nextRotationAtMs, festival: { untilMs } | null, lastFestivalAtMs }` (o apêndice previa `festivalSeason: string`), e cada oferta, `{ offerId, templateId, name, gender, price }` (o apêndice não tinha `gender`). O preço gravado é o do modelo no instante da rotação: mudar o preço de um modelo no conteúdo só vale da troca seguinte em diante. O desconto do Carismático não é gravado: é conta da hora.
- Onde: `packages/engine/src/types.ts`; `migrations/v16.ts`.
- Se decidir diferente: ler o preço do conteúdo a cada vez faz uma oferta mudar de preço na tela depois de uma publicação.

**C-28. A visão `tavern` existe sempre: sem Taverna, vem com nível zero, listas vazias e a frase que diz o que a abre.** *(Decidida pelo agente.)*
- Enquanto isso: a interface de V3C-T4 não precisa de frase própria para "sem Taverna": o texto vem do motor ("A Taverna abre com o Salão do Senhor Nv3: nela o feudo contrata heróis e dá festivais.").
- Onde: `packages/engine/src/tavernView.ts`.
- Se decidir diferente: `tavern: null` economiza cerca de 400 bytes por visão e empurra a frase para o app.

**C-29. O perfil Explorador entrou na rodada padrão da matriz; o Regular e o Dedicado continuam com o bot econômico.** *(Decidida pelo agente; era o plano escrito em `matrix.ts` desde a Fase B.)*
- Enquanto isso: a matriz tem quatro perfis e 24 células por dificuldade, e a suíte ficou cerca de um terço mais lenta nessa parte. O Regular e o Explorador visitam o feudo com a mesma cadência: a diferença entre as células é a contratação. A meta de desperdício do GDD §15.2 continua cobrada só do Regular. O Dedicado e o Preguiçoso não contratam (V3C-T2.7 pedia isso do Preguiçoso).
- Onde: `PROFILES`, em `packages/sim-cli/src/matrix.ts`; `bots/explorador.ts`.
- Se decidir diferente: dar a política de contratar ao econômico faria as três células medirem a Guilda e tiraria a comparação.

**C-30. Os 24 nomes dos candidatos, as frases da Crônica e as da tela da Taverna são rascunho do agente.**
- Enquanto isso: estão no jogo e em [content-v0.3.md](content-v0.3.md), marcados "rascunho, não lido pelo autor". Doze nomes de mulher e doze de homem, medievais portugueses, nenhum igual ao de um herói de carta.
- Onde: `heroNames` e `tavernCandidates`, em `packages/content/src/heroes.ts`; `chronicle.ts`.
- Se decidir diferente: trocar um nome é conteúdo; **mexer na ordem da lista muda o sorteio de toda Taverna**, e o golden.

**C-32. Com a Taverna, a cama vazia que o bot deixa nas Habitações é ocupada por um colono.**
- Enquanto isso: os bots deixam uma cama livre para a moral não cair com as casas cheias. Com a moral acima de 80, que a Taverna dá sem carta nenhuma, um colono chega e ocupa a cama: as casas enchem, a moral perde 10 e volta a subir quando o bot amplia as Habitações. O teste que cobrava "as casas nunca enchem" passou a cobrar isso só de quem não tem Taverna.
- Onde: `packages/sim-cli/src/bots/bots.test.ts`.
- Se decidir diferente: é regra da v0.2 (o colono atraído pela fama) encontrando a moral da v0.3. Se o vaivém incomodar no jogo, a pergunta é de regra: o colono deve vir quando só resta uma cama?

**C-33. A coluna `wages_paid` do simulador continua vazia.**
- Enquanto isso: `heroes`, `wage_arrears_hours` e `heroes_departed` são medidas. O jogo não conta o soldo pago em lugar nenhum, e somar amostras de hora em hora daria um número que parece exato e não é.
- Onde: `MEASURED_COLUMNS`, em `packages/sim-cli/src/report.ts`.
- Se decidir diferente: um contador em `stats` é uma linha no motor e um golden; fica para quando alguém precisar do número.

**C-34. O limite de contratação conta todo herói do feudo, o da carta também.**
- Enquanto isso: com a Taverna no nível 1 e Edda no feudo, o jogador contrata um herói, não dois. É a leitura do ADR 0017, decisão 5 ("1 + nível da Taverna"), em que o "1" é o lugar do herói da carta.
- Onde: `heroLimitBlock`, em `packages/engine/src/tavern.ts`.
- Se decidir diferente: contar só os contratados daria sete heróis no nível 5.

**C-35. Um estado com a Taverna de pé e sem rotação marcada é acomodado na fronteira do primeiro avanço.**
- Enquanto isso: só existe posto à mão, em teste (`/__test/raise`); a lista nasce ancorada no instante em que o estado estava. No jogo a Taverna só fica de pé pelo fim de uma obra.
- Onde: `advanceWith`, em `packages/engine/src/advance.ts`.
- Se decidir diferente: nada a decidir; fica registrado porque é um sorteio fora de um instante marcado, em um estado que o jogo não produz.

**C-36. `CLAUDE.md` foi atualizado nos fatos que a tarefa tornou falsos.**
- Enquanto isso: o estado na versão 16, o fluxo `tavern`, a Taverna na ordem do instante e na lista do que existe, as rotas de teste novas e o parágrafo do estado da v0.3. Nenhuma regra de trabalho mudou.
- Onde: `CLAUDE.md`.
- Se decidir diferente: é o ritual de conclusão de tarefa ("procurar o que a tarefa tornou falso"); se preferir rever essas edições antes, o diff está no commit de documentos da tarefa.

### Fase C: a carta da estrangeira (V3C-T3)

Vêm da implementação de V3C-T3 (a carta roteirizada "Estrangeira ferida", o efeito `addHero`, os heróis com nome; estado na versão 15). **Nenhuma foi perguntada ao autor.** As quatro primeiras o orquestrador da execução decidiu antes de a tarefa começar; as outras são do agente da tarefa. **Daqui em diante toda partida ganha um herói e passa a pagar soldo.**

**C-11. O herói prometido ("Rolf chega 1 dia de jogo depois") fica em uma lista própria da guilda, e chega em um instante exato.** *(Decidida pelo agente.)*
- Enquanto isso: `guild.arriving` guarda `{ namedHeroId, atMs }`. Não foi reusado `council.delayed`, que é dos efeitos **escondidos** e nunca sai na visão: a promessa de um herói não é segredo, e a visão mostra quem vem e em quanto tempo (`guild.arriving[]`). "Um dia de jogo depois" conta do instante da escolha, e não é uma virada de dia: quem responde no meio do dia recebe o herói no meio do dia seguinte. A chegada é um instante novo da linha do tempo (`nextHeroArrivalAt`).
- Onde: `packages/engine/src/arrivals.ts`, `heroes.ts`, `timeline.ts`; README do motor, "Heróis e soldo".
- Se decidir diferente: fazer a chegada cair sempre em uma virada de dia tira um instante da linha do tempo e deixa o prazo desigual (de zero a um dia de jogo a mais); é mudança de regra e de golden.

**C-12. O herói que chega entra na ordem do instante logo depois do Conselho.** *(Decidida pelo agente.)*
- Enquanto isso: `settleHeroArrivals` roda depois de `settleCouncil` e antes do fim das adaptações, das incursões, dos objetivos e da conta do ouro. Consequências: a carta que expira dá o herói no mesmo instante; a virada de dia em que ele chega **não** cobra dele o soldo em atraso que já existia; o sorteio do Conselho e a moral daquela virada não o veem (uma carta do lote 2 que pergunte por um herói só o encontra na audiência seguinte); o soldo dele já entra na conta do ouro daquele instante.
- Onde: `processEventsAt`, em `packages/engine/src/advance.ts`; `stranger.test.ts`, "a ordem do instante".
- Se decidir diferente: pôr a chegada junto dos aldeões que chegam, antes da virada, faz a virada cobrar de quem acabou de entrar um atraso antigo e pede outra saída para o herói dado por uma carta que expira.

**C-13. A roteirizada não reserva lugar na mesa: com duas cartas pendentes, espera a audiência seguinte.** *(Decidida pelo orquestrador; é a pergunta que V3C-T3.3 deixava para o plano.)*
- Enquanto isso: a regra do Conselho não mudou. A carta não se perde, mas **atrasa para quem não responde às cartas dos dias 5 e 9**. Medido: quem passa pelo feudo uma vez por dia (o Preguiçoso do simulador) tem o herói na hora real 48 no ritmo Rápido e no Normal, e não na 24; quem nunca aparece o recebe pelo conselho 64 h reais depois da fundação no ritmo Normal (a carta chega na audiência do 21º dia e expira no 33º) e cerca de 53 h no Rápido. Quem responde às cartas a recebe na audiência do 13º dia: 8 h reais no Rápido, 24 h no Normal, 48 h no Tranquilo. O critério 1 do GDD §16.2 ("o primeiro herói chega pela carta do dia 2") vale para quem joga; para quem falta, é o dia 3.
- Onde: `drawCard`, em `packages/engine/src/councilTurn.ts`; `stranger.test.ts`, "prioridade"; [balance-v0.3.md](balance-v0.3.md), seção 3.3; GDD §7.1.
- Se decidir diferente: (a) **a roteirizada reserva lugar**, como a continuação vencida: a audiência do 13º dia a entrega sempre que houver **um** lugar, e, com a mesa cheia, a primeira carta que sair abre o lugar para ela (por expiração ou por resposta), sem esperar audiência. É mudança de regra do Conselho, de golden e de GDD. (b) A roteirizada ignora o limite de duas e chega como terceira carta: muda `maxPending` para ela e a tela do Conselho. (c) Fica como está.

**C-14. O texto da carta, os rótulos das opções e as frases da Crônica são rascunho do agente.**
- Enquanto isso: a ficha está em [content-v0.3.md](content-v0.3.md), marcada "rascunho, não lido pelo autor". "Acolher" virou "Acolher a estrangeira". Rolf é o irmão de Edda, como no Apêndice B do GDD. A opção mostra na tela o soldo que o herói passa a cobrar ("…, com soldo de 6 ouro/h").
- Onde: `packages/content/src/cards/scripted.ts`, `heroes.ts` (`namedHeroes`), `chronicle.ts` (`heroJoined`).
- Se decidir diferente: texto e números são conteúdo, e trocar é regravar goldens. Os identificadores (`woundedStranger`, `shelter`, `tend`, `edda`, `rolf`) ficam no estado das partidas: depois de publicados, só mudam com passo de migração.

**C-15. Nenhum bot escolhe "Cuidar e deixar partir", e o Preguiçoso do ritmo Normal atrasa o soldo por 21 h reais.**
- Enquanto isso: os dois bots ficam com a primeira opção sem custo, "Acolher", em toda dificuldade: toda partida da matriz termina com Edda, que é Leal, e **ninguém parte por soldo porque ela não parte, não porque o soldo esteja folgado**. O Preguiçoso do Normal soma 21 h reais de atraso em toda semente e dificuldade; com um herói que não fosse Leal isso passaria das 12 h do Descontente e ficaria a 3 h de perdê-lo (conta dos prazos, não medida). A linha de base do simulador foi regravada de propósito, nas três dificuldades, e algumas células pioraram (Rei de Ferro, Regular do Normal: menor população de 64 para 59).
- Onde: [balance-v0.3.md](balance-v0.3.md), seção 3; `packages/sim-cli/src/balance.test.ts`, "a estrangeira entrega o primeiro herói…".
- Se decidir diferente: um perfil de bot que escolha o arqueiro e um que fique sem ouro são de V3C-T5; se o atraso do Preguiçoso incomodar, a alavanca é de conteúdo (o soldo, os prazos, ou o ouro inicial), nunca o bot.

**C-16. Os heróis que já existiam na versão 14 entram na 15 com a forma de tratamento masculina.**
- Enquanto isso: `HERO_GENDER_FROM_V14 = 'm'`, valor fixo do passo. A versão 14 dizia a classe em uma forma só ("Guerreiro"), e a ficha continua como estava. **Nenhuma partida de verdade passa por aqui com herói**: a versão 14 nunca foi publicada e nenhuma regra dela dava herói a ninguém; só os retratos e os estados de teste têm algum (inclusive uma "Edda" e uma "Isolda" de teste, que na 15 migrada continuam "Guerreiro" e "Mago").
- Onde: `packages/engine/src/migrations/v14.ts` (`v14ToV15`).
- Se decidir diferente: nada a decidir enquanto a 14 não tiver ido à produção.

**C-17. A regra "nenhuma carta fala de…" virou três, e a palavra "espada" voltou a ser permitida na carta do herói.**
- Enquanto isso: (1) nenhuma carta fala de ferro, exército, combate, presságio, relíquia nem de edifício de versão futura; (2) nenhuma fala de Mercado, mapa, expedição, Guilda ou Taverna, até V3F-T1; (3) só a carta com `addHero` fala de herói, classe ou arma. "Soldado", "batalha", "quartel", "muralha", "horda" e "cerco" continuam barradas em todas.
- Onde: `packages/content/src/council.test.ts`; [content-v0.3.md](content-v0.3.md), seção 2.
- Se decidir diferente: é editorial; cada regra é uma expressão regular no teste.

**C-18. A história do cenário de 7 dias (o golden do motor) mudou, e uma cadeia ficou mais curta nela.**
- Enquanto isso: a carta ocupa a audiência do 21º dia (as do 13º e do 17º encontram a mesa cheia), e dali em diante o sorteio é outro. O roteiro continua passando pelas três cadeias, mas "A Promessa da Paliçada" agora é perguntada com a Paliçada já de pé, e o senhor do roteiro a mostra em vez de prometer e ser cobrado: a carta "O prazo da paliçada" não aparece mais no golden. O caminho de quem promete e cumpre continua provado em `council.chains.test.ts`. Nenhuma das 58 ordens do roteiro mudou de resultado.
- Onde: `packages/engine/src/test-helpers.ts` (`weekAnswers`), `scenario.test.ts`, `__golden__/scenario-7-days.json`.
- Se decidir diferente: dá para procurar outras respostas ou outro instante da Paliçada que devolvam a cadeia inteira ao golden; é trabalho de teste, não de regra.

**C-19. O simulador mede a guilda de cada partida, mas as colunas do CSV continuam vazias.**
- Enquanto isso: `Summary.guild` (heróis no fim, hora real do primeiro, horas com o soldo em atraso, heróis que partiram) sai dos eventos e é conferido em `balance.test.ts`. As colunas `heroes`, `wages_paid`, `wage_arrears_hours` e `heroes_departed` do CSV seguem reservadas (pendência C-9).
- Onde: `packages/sim-cli/src/report.ts`.
- Se decidir diferente: V3C-T5 liga as colunas ao que já é medido.

### Fase C: heróis no feudo (V3C-T1)

Vêm da implementação de V3C-T1 (heróis, soldo e atraso; estado na versão 14). Nenhuma foi perguntada ao autor. **Nenhuma regra dá um herói a ninguém ainda**: tudo abaixo só passa a valer para quem joga depois da carta de V3C-T3.

**C-1. O herói não tem gênero no estado, e a ficha diz "Edda — Guerreiro", "Isolda — Mago, Veterano, Ganancioso".**
- Enquanto isso: cada classe e cada traço têm um rótulo só, no masculino (`heroClasses`, `heroTraits`), e o herói guarda só nome, classe e traços. O ADR 0017 fala em "Edda, Guerreira Leal".
- Onde: `packages/content/src/heroes.ts`; `Hero` em `packages/engine/src/types.ts`; `guildView.ts` (`classLabel`, `traits[].label`).
- Se decidir diferente: (a) **recomendada:** o herói ganha um campo de forma de tratamento, e a classe e os traços, as duas formas; é um campo novo no estado, e o lugar de fazê-lo é V3C-T3, que traz os heróis nomeados, antes de qualquer publicação da Fase C (depois de publicado, é mais um passo de migração). (b) Rótulos neutros de propósito ("Guerreiro(a)" não; algo como "da Guarda"), sem campo. (c) Deixar como está.
- **Decidida pelo agente em V3C-T3, pela opção (a), para o autor rever:** o herói guarda `gender` (`'f'` ou `'m'`), cada classe e cada traço têm `label` e `labelFeminine` no conteúdo, e a visão escolhe: "Edda — Guerreira", "Rolf — Arqueiro", "Isolda — Maga, Veterana, Gananciosa". A frase do Devoto perdeu o "dele". O estado subiu para a versão 15 (pendência C-16). Trocar de ideia depois de publicar é outro passo de migração.

**C-2. O teto da lista de heróis é 12 (`balance.heroes.rosterCap`), e é o agente que o escolheu.**
- Enquanto isso: a guarda do estado recusa uma lista maior. O limite de contratação continua `1 + nível da Taverna` (até 6), e a recompensa de carta ou de expedição não é barrada por ele; o teto de 12 é o único número que barraria também uma recompensa. Nesta tarefa nada põe herói no feudo, então nada é barrado ainda.
- Onde: `packages/content/src/balance.ts`; `packages/engine/src/migrations/v14.ts` (`HERO_ROSTER_CAP_V14`); GDD §9.1; roadmap, §0.7, "Estado de tamanho limitado".
- Se decidir diferente: outro número é conteúdo, mais a constante da guarda. **O que acontece com a recompensa que chegaria com a lista cheia** (o herói não entra? vira ouro?) é pergunta do plano de V3C-T3 e de V3D-T2; sem teto nenhum, o estado e a visão não têm tamanho máximo.
- **Decidida pelo agente em V3C-T3, para o autor rever:** o teto de 12 fica, e a recompensa **espera, não se perde**. O herói de uma carta que encontra a lista cheia fica entre os prometidos (`guild.arriving`), com a tela dizendo que ele espera à porta, e entra no instante em que um lugar abrir: a virada de dia em que um herói parte sem soldo, ou a ordem de dispensa. Na prática é impossível hoje (o limite de contratação chega a 6 com a Taverna no teto, e só uma carta dá herói), e está provado por teste (`stranger.test.ts`, "o teto da lista de heróis não tira a recompensa de ninguém"). A lista dos prometidos tem o teto dela, `arrivingCap` (4), também do agente; a recompensa de expedição (V3D-T2) ainda vai precisar da mesma resposta.

**C-3. Quem chega no meio de um atraso antigo paga um passo do prazo na virada seguinte.**
- Enquanto isso: com só Leais no feudo, o que o prazo cobraria fica perdoado a cada virada (`departed` acompanha os devidos). Um herói que não é Leal e chega com o atraso já passado das 24 h reais fica Descontente na primeira virada e é devido no primeiro passo de 2 h reais depois dela: não sai em bloco pelo que ficou para trás, mas também não ganha as 24 h de carência de novo.
- Onde: `turnWages`, em `packages/engine/src/wages.ts`; teste "só Leais…" em `wages.test.ts`.
- Se decidir diferente: dar a cada herói a própria carência pede guardar, por herói, desde quando ele está sem soldo; é campo novo e outra conta.

**C-4. Enquanto o atraso dura, o que a Mina entrega vai inteiro para o soldo, e o cofre fica em zero.**
- Enquanto isso: é o molde do frio com a madeira. Com três heróis (6 por hora) e um mineiro (uns 4), o atraso fica aberto para os três, o ouro não se acumula e ninguém é "o herói pago": todos ficam Descontentes e partem na ordem de chegada, até a Mina cobrir quem sobrou. Não há dívida.
- Onde: `flowRate`, em `packages/engine/src/economy.ts`; README do motor, "Heróis e soldo".
- Se decidir diferente: pagar herói por herói (os primeiros recebem, o último fica em atraso) pede um atraso por herói. Deixar o ouro da Mina acumular durante o atraso faria o atraso fechar e reabrir a cada milésimo: não fecha a conta exata.

**C-5. Com o saldo de ouro exatamente em zero e o cofre vazio, o atraso não abre; se já estava aberto, não fecha.**
- Enquanto isso: é a mesma folga da fome (a que abre com saldo negativo e fecha com saldo positivo), e é a frase do GDD: "fecha quando o saldo de ouro volta a ser positivo". O caso é a Mina rendendo exatamente o soldo: quem já estava em atraso continua, embora o soldo de agora esteja sendo pago.
- Onde: `goldRunsOutIn` e `goldCoversWages`, em `economy.ts`.
- Se decidir diferente: fechar com saldo zero pede cuidado para o atraso não oscilar no mesmo instante; é mudança de regra e de golden.

**C-6. O atraso que fecha e reabre tira o Descontente até a virada seguinte.**
- Enquanto isso: fechado o atraso, ninguém fica Descontente; reaberto dentro da janela, a duração e os heróis cobrados continuam, e o Descontente volta na próxima virada do dia, com outra linha na Crônica. Um ganho pequeno de ouro logo depois de cada virada deixa os heróis sem a penalidade pela maior parte do dia de jogo, sem atrasar as partidas. Hoje o jogador não tem como pôr ouro no cofre quando quer; com o Mercado (Fase E), terá.
- Onde: `settleWageArrears` e `turnWages`, em `wages.ts`.
- Se decidir diferente: manter o Descontente enquanto o registro do último atraso estiver dentro da janela é mudança pequena, de regra e de golden; conferir em V3E-T5.

**C-7. As frases dos traços não têm números e falam de efeitos que ainda não existem.**
- Enquanto isso: só o Leal tem efeito no motor (`effects.loyalInArrears`). As frases dos outros sete dizem em palavras o que o ADR 0017 prevê para a v0.3 ("Rende mais quando a ordem é de ousadia…"), sem número. Não aparecem para ninguém até haver herói com o traço.
- Onde: `packages/content/src/heroes.ts`; o schema recusa dígito na frase.
- Se decidir diferente: cada frase é reescrita na tarefa que implementa o efeito (V3C-T2, V3D-T1, V3D-T2, V3F-T1), com o número vindo do campo do efeito.

**C-8. `HERO_BUSY` não entrou.**
- Enquanto isso: `dismissHero` só recusa com `HERO_NOT_FOUND`. O teste das recusas exige que toda recusa seja alcançável, e nesta fase todo herói está no feudo.
- Onde: `packages/engine/src/commands.test.ts`; roadmap, Apêndice B.2.
- Se decidir diferente: nada a decidir; entra em V3D-T1, com o primeiro herói fora do feudo.

**C-9. As quatro colunas do simulador desta tarefa continuam vazias.**
- Enquanto isso: `heroes`, `wages_paid`, `wage_arrears_hours` e `heroes_departed` saem vazias. Nenhum bot tem como ter herói antes de V3C-T3, e `wages_paid` pede um total que nem a visão nem os eventos trazem (o soldo é consumo contínuo, como a comida).
- Onde: `packages/sim-cli/src/report.ts` (`RESERVED_COLUMNS`).
- Se decidir diferente: V3C-T5 as preenche; para `wages_paid` o motor teria de contar o soldo pago em `stats`, o que muda os retratos.

**C-10. `CLAUDE.md` foi atualizado nos fatos que a tarefa tornou falsos.**
- Enquanto isso: a versão do estado (14), a lista das constantes de tempo real (mais as quatro do soldo), a ordem fixa do instante (a cobrança do soldo e o atraso em `settleScarcity`) e o parágrafo "A v0.3 está em execução". Nenhuma regra de trabalho mudou.
- Onde: `CLAUDE.md`, "Estado", "Detalhes que não são óbvios", "Persistência" e "Motor".
- Se decidir diferente: reverter é um commit.

### Fase B: fundação da Guilda

Vêm da revisão independente de V3B-T1 (roadmap, §12, linha V3B-T3): nenhum defeito confirmado, sete riscos e quatro dúvidas. Os riscos R3, R4a, R6 e R7 e a dúvida D3 foram corrigidos em commits próprios. O que ficou:

**B-1 (D2). As famílias `expedition` e `caravan` já são aceitas em `rng` antes de existir expedição ou caravana.**
- Enquanto isso: fica como está. É o que V3B-T1.3 e a decisão 9 do ADR 0017 pedem, nenhum campo de mecânica entrou no `GameState` (a regra 6 do `CLAUDE.md` continua cumprida), e, com `ids: {}`, a conferência cruzada recusa qualquer fluxo de entidade gravado: na prática nenhum estado de hoje pode ter um.
- Onde: `packages/engine/src/random.ts` (`RNG_STREAM_FAMILIES`), `migrations/v13.ts`; README do motor, "O que a fundação não prova".
- Se decidir diferente: tirar as famílias até a Fase D é reescrever a guarda da versão 13 já publicada no `main`, com outro passo de migração.

**B-2 (R1, R2, R5, R4b e R4c). Quatro garantias que a fundação não dá e que cada mecânica tem de provar.**
- Enquanto isso: nada a fazer no estado 13, que não tem entidade nenhuma. Estão escritas no README do motor como obrigação de quem implementar as Fases D e E: fluxo apagado não reaparece e nada sorteia depois do `dropStream` no mesmo instante; a guarda da versão que criar expedições e caravanas exige fluxos só de entidades vivas; a divisão de intervalo é repetida com os instantes da mecânica e com entidades criadas por comando; e a visão e `nextEventAt` são provadas por comportamento, porque o teste de pureza não vê importação indireta.
- Onde: README do motor, "O que a fundação não prova, e cada mecânica tem de provar"; V3D-T1 e V3E-T2.
- Se decidir diferente: não é decisão do autor; é lista de conferência das revisões V3D-T5 e V3E-T5.

**B-3 (D1 e D4). Duas dúvidas da revisão sem enunciado no repositório.**
- Enquanto isso: nada mudou por causa delas. O relatório da revisão não foi gravado em arquivo, e quem integrou a fase recebeu só os identificadores; o enunciado está na conversa da revisão.
- Onde: roadmap, §12, linha V3B-T3.
- Se decidir diferente: se alguma delas pedir código, entra como correção `V3B: corrige …` antes da Fase C.

**B-4. O fluxo de entidade ficou mais estrito do que o registrado em V3B-T1.**
- Enquanto isso: o nome é `<família>:<família>-<n>`, com `1 ≤ n ≤ ids[família]`. Um herói não tem fluxo próprio: se alguma mecânica quiser sortear "por herói", precisa de uma família nova (`hero`), em uma versão de estado nova.
- Onde: commit `33f8411`; README do motor, "Sorteios".
- Se decidir diferente: afrouxar de novo é mudar a guarda e a forma do estado.

## 6. O que não foi verificado

### Fase C (V3C-T4)

Do mais arriscado para o menos.

1. **Ninguém jogou com a aba Guilda.** O critério de diversão da tarefa ("o autor contratar o segundo herói sem perguntar o que é soldo") e a "primeira tela funcional ao autor" (V3C-T4.1) não aconteceram: a tarefa foi feita de uma vez, e quem viu a tela foram os testes e quatro capturas que o agente olhou.
2. **Só Chromium.** Firefox, Safari e leitor de tela não foram testados. O contraste e o foco foram medidos em Chromium, nos três temas.
3. **A estrangeira ferida em navegador vai à mesa por uma rota de teste** (`/__test/council-deal`), não pelo 13º dia de jogo: o caminho do dia 13 é coberto pelos testes do motor e do servidor (V3C-T3).
4. **O herói que parte e o que fica descontente não têm cenário em navegador**: o do atraso para quando ele abre (aviso, barra, árvore, aba). As consequências são cobertas no motor; o aviso delas, em teste de unidade do app.
5. **O herói prometido ("Rolf chega em…") e a Taverna sem candidatos** só têm teste de unidade, com o golden.
6. **Em 720 px as duas colunas da aba ficam lado a lado e apertadas**; não há rolagem lateral e nada é cortado, mas ninguém julgou se a leitura é boa.
7. **As frases novas não foram lidas pelo autor** (C-37, C-38).

### Fase C (V3C-T2)

Do mais arriscado para o menos.

1. **Ninguém viu a Taverna em uma tela.** Não há interface (V3C-T4). Em navegador há um cenário só, pela API (`09-guilda.spec.ts`): a obra na lista de construções, a Taverna posta de pé por uma rota de teste, os candidatos e uma contratação com duplo envio.
2. **Nenhum herói que não é Leal ficou sem soldo no simulador.** O Explorador nunca atrasa o soldo, e os outros perfis só têm Edda. A premissa "o Preguiçoso não perde herói por uma noite fora" continua sem medida (C-15, e a seção 4.6 de balance-v0.3.md).
3. **Nenhuma partida de produção passou pelos passos 13 → 16.** Nada foi enviado. O backup manual antes do `push` continua sendo do autor (A-2).
4. **O texto não foi lido pelo autor**: os nomes, as frases da Crônica e as da tela (C-30).
5. **A rotação no instante exato da virada de estação, do ano e de uma incursão** só está coberta pela propriedade (instantes quaisquer, 150 feudos), não por um teste escrito para cada encontro. Há teste do instante exato para a obra que termina na rotação, para a ordem dada na rotação e para o festival na virada de estação.
6. **O desconto do Carismático com o Carismático fora do feudo** não existe ainda: todo herói está no feudo até a Fase D.
7. **Camponês e Rei de Ferro**: as 50 sementes rodaram uma vez, para a linha de base; a cada `pnpm test` só 3 sementes conferem.
8. **Um teste do motor falhou uma vez e passou na repetição**, antes de qualquer mudança desta tarefa (`pnpm --filter @lotg/engine test`: 1 falha em 4.491 na primeira execução, nenhuma na segunda). O nome do teste não ficou registrado e a falha não se repetiu nas execuções seguintes.
9. **`SHOW_COVERAGE=1`, `pnpm test:e2e:landing`, `pnpm capture:landing` e `pnpm docker:build`** não rodaram. A aba Feudo ganhou uma linha na lista de construções (a Taverna); as capturas da página de apresentação não foram refeitas.

### Fase C (V3C-T3)

Do mais arriscado para o menos.

1. **O texto da carta não foi lido pelo autor**, nem os nomes, nem as frases da Crônica, nem a frase da opção na tela (seção 5, C-14).
2. **A opção "Cuidar e deixar partir" não passa pelo simulador.** O arqueiro, o ouro, a moral e a chegada adiada estão provados no motor e na integração, e nenhum bot os joga; o que o soldo faz a um herói que não é Leal em uma partida de bot não foi medido (C-15).
3. **Nenhuma partida de produção passou pelos passos 13 → 14 → 15.** Nada foi enviado. Toda partida em produção (na versão 12) vai receber a carta na primeira audiência com lugar depois da publicação e, 24 h reais depois, se ninguém responder, um herói com soldo. O backup manual antes do `push` continua sendo do autor (A-2).
4. **O app não mostra nada da guilda.** A carta aparece na aba Conselho pelo que já existia, com a frase da opção; o herói acolhido, o prometido ("Rolf chega em…") e o soldo só existem na visão. Os testes em navegador rodam com o conselho em recesso e **não exercitam a carta**: passaram sem mudança. A interface é V3C-T4.
5. **A divisão de intervalo com o herói adiado** foi provada por propriedade com uma carta só e um herói só; a lista dos prometidos com dois ou mais ao mesmo tempo só tem teste de forma.
6. **O herói que espera lugar (lista no teto)** só foi exercitado com heróis postos por auxiliar de teste: nenhuma partida chega a 12 heróis.
7. **A rodada do simulador foi feita com o conteúdo de antes do último ajuste de texto** (três frases; nenhum número). O teste da linha de base confere Senhor com o conteúdo do commit; Camponês e Rei de Ferro, só com 3 sementes.
8. **`--perf`, o tamanho do estado e da visão com herói, `SHOW_COVERAGE=1`, `pnpm test:e2e:landing`, `pnpm capture:landing` e `pnpm docker:build`** não rodaram.

### Fase C (V3C-T1)

Do mais arriscado para o menos.

1. **Nenhuma partida de verdade tem herói.** Não existe ordem nem evento que dê um; todo teste põe heróis por um auxiliar (`addHero`, no motor; `enlistHeroes`, direto no banco de teste). O soldo, o atraso e as consequências nunca foram vistos em uma partida jogada do começo, e o app não mostra nada da guilda (a interface é V3C-T4): nos testes em navegador a visão traz a guilda vazia.
2. **O simulador não mede o soldo.** Nenhum bot tem herói; a matriz passou sem mudança de faixa porque nada mudou para quem não tem herói. Tudo o que o ADR 0017 manda validar no simulador (o Preguiçoso não perde herói por uma noite fora; o aviso chega antes das 12 h reais no Tranquilo; quantos heróis o Dedicado sustenta) continua por fazer, em V3C-T5.
3. **O backup do banco de produção e a passagem de partidas de produção pelo passo 13 → 14.** Nada foi enviado. O passo só foi exercitado nos 25 retratos da versão 13 e nos casos de integração.
4. **"Por quanto tempo o ouro paga a equipe" foi conferido contra o motor em feudos simples** (os três ritmos, com e sem um mineiro e a moral subindo no caminho), não por propriedade: a fome ou o frio que abrem no caminho, a virada de estação e uma obra da Mina terminando não têm teste que compare o segundo anunciado com o do motor. A previsão é pela estação de agora, como a da comida.
5. **O tamanho do estado e da visão com a lista cheia** (12 heróis) não foi medido; a medição por fase é de V3C-T5. `--perf` não foi rodado.
6. **A visão guardada no navegador por uma versão anterior do app** é descartada ao primeiro campo novo (`guild`), como em toda adição ao `ViewState`; é o comportamento esperado (roadmap, §0.7, "Compatibilidade"), e não foi conferido em navegador nesta tarefa.
7. **As frases novas** (cinco da Crônica, duas do fim do atraso, oito dos traços, a do atraso na visão) não foram lidas pelo autor.
8. **`pnpm test:e2e:landing`, `pnpm capture:landing` e `pnpm docker:build`** não rodaram: nada da página, da aparência do app ou da imagem mudou.

### Fase B

1. **O backup manual do banco de produção antes do `push` da Fase B.** A fase sobe o estado de 12 para 13; nada foi enviado, e o backup é o primeiro passo de quem der o `push` (dúvida A-2).
2. **Nenhuma partida de produção passou pelo passo 12 → 13.** Só os 25 retratos e os casos de integração. Uma linha de produção com um fluxo de nome estranho em `rng` passaria a responder `500` (sem ser gravada por cima; o job diz o id e a causa): nenhum motor publicado escreveu um fluxo assim, mas ninguém olhou o banco.
3. **Reversão de imagem atravessando o passo 12 → 13:** não ensaiada, como as anteriores.
4. **A revisão independente foi de leitura:** não rodou a integração nem o navegador, não comparou o motor novo com o anterior por execução e não tocou o banco de produção. O portão inteiro rodou depois, no fechamento da fase (roadmap, §12, "V3B (integração)").
5. **A matriz completa do simulador** (`--matrix` nas três dificuldades) e `--perf` não foram rodados além do que o `pnpm test` cobre; a Fase B não mudou número nem regra.
6. **`pnpm test:e2e:landing`, `pnpm capture:landing` e `pnpm docker:build`** não rodaram: nada da página, da aparência do app ou da imagem mudou.
7. **O texto que o agendador grava no log** quando o job falha não tem teste; o relatório que ele grava (`failedGameIds`, `firstFailure`) tem.


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
