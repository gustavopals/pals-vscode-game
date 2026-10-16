# 0019 — Ferro, exército, formações e combate na v0.4

Data: 2026-10-16\
Estado: **aprovada pelo autor em 2026-10-16, em sessão de perguntas com opções**, respondidas **uma a uma**, em cinco rodadas (V4A-T2). Em todas o autor escolheu a premissa recomendada do [roadmap da v0.4](../roadmap-v0.4.md), §11.1. Nada aqui estava implementado na data da sessão.\
Escopo: GDD §5.1, §5.2, §5.9, §6.1, §8.3, §10.1 a §10.5, §10.8, §13.5, §14.3 e §17.1; [roadmap da v0.4](../roadmap-v0.4.md), lote 1 de decisões (V4A-T2, decisões 1 a 14, 25 e 26 da §11.1), e a herança da v0.3 (V4A-T2.1)

## Contexto

Primeiro lote das decisões da §11 do roadmap da v0.4: a herança da v0.3, o ferro, o Ferreiro, o exército, as formações, o combate, os relógios e o regime de publicação. Ele trava a Fase B. O lote 2 (decisões 15 a 24: Horda, presságios, sabotagem, Cerco, Crônica do Ano, os lotes de cartas e os objetivos 17 a 21) fica para a sessão V4E-T0 e o ADR 0020.

A sessão aconteceu em 2026-10-16, um dia depois da publicação da v0.3.0 (estado 24, protocolo 3). Antes dela, o autor não tinha jogado a v0.3 nem lido o conteúdo.

## Decisão

| # | Decisão | O que foi aplicado | Alternativa descartada | Tarefas |
|---|---|---|---|---|
| 1 | Lote 2 do Conselho | Entra na **Fase H da v0.4** (V4H-T1), em trilha de conteúdo que pode começar depois da Fase B. "O Cobrador do Rei" e "O Lobo Branco" entram sem a adaptação da v0.3. Gil e Ximena esperam o lote. O branch `wip/v3f-t1-lote2` é ponto de partida, não verde | v0.3.1 antes da Fase B | V4H-T1 |
| 2 | Ouro sem destino | **Medir primeiro**: o ferro, o treino, o reparo e a Muralha são os destinos novos. A medida de V4C-T4.3 volta ao autor com propostas de número antes da Fase D. Nenhuma regra de ouro nova antes disso | Soldo de soldado; ferro mais caro | V4B-T1, V4C-T4 |
| 3 | O ferro | No Mercado a **8,0 de ouro**, volume `200 × nível`, **sem caravana de ferro**. Achado na **Mina Abandonada** (40 a 80), destino que pede a Guilda Nv2 e é revelado pela Floresta Antiga ou pela Patrulha. O Armazém o guarda com o mesmo cap. Ferro inicial 0 | Ferro só por expedição; caravana de ferro | V4B-T1 |
| 4 | Armas e a forja | Armas como recurso **sem cap**. Um lote por vez, até `batchMax` (10). Cada arma custa **2 ferro + 1 madeira** e leva **6 min de jogo**. "+10% por nível" vale como tempo × 10/(10 + nível − 1). O custo é cobrado ao começar, e cancelar devolve 80% | Várias filas; o nível dá armas a mais por lote | V4B-T2 |
| 5 | Desgaste e reparo | **Entra, mínimo**. Um ponto de desgaste por expedição e por batalha comandada, com durabilidade pela raridade. Item em 0 fica sem bônus. O reparo é no Ferreiro, na mesma fila da forja, e custa ferro e tempo | Não entra (o Ferreiro só forja) | V4B-T3 |
| 6 | Guilda Nv5 e Lendário | **Não entram**. A Guilda fica no Nv4, e o Lendário fica com as relíquias (v0.5) | O Senhor da Guerra deixa um Lendário | — |
| 7 | Soldados e população | O soldado **sai da população** ao fim do treino: primeiro de um aldeão sem ofício, senão do edifício com mais gente. Ele **come 1,5/h**, não trabalha e **não deserta** por fome nem por moral. **Não conta no piso** de 3 aldeões. O limite é `10 × nível` do Quartel, e dispensar devolve um aldeão sem ofício, sem devolver o custo | O soldado vem de fora; soldados desertam como aldeões | V4C-T1 |
| 8 | Herói comandante | O herói nomeado na formação **ativa** não parte (expedição, caravana, sabotagem). Nas outras formações salvas, pode | Comanda de onde estiver | V4C-T2, V4F |
| 9 | Formações | Até **5** salvas, **6** postos, até **20 por posto** (30 com o Quartel Nv5+). **Uma** Defesa ativa. A formação pode pedir mais tropas do que há, e a prévia avisa | Sem teto por posto; formação só com o que existe | V4C-T2 |
| 10 | A prévia | Ordem `simulateBattle`, que grava o resultado (uma por vez) e conta para o objetivo. Usa **200 sementes derivadas por `hash`** da semente, da formação e do que se sabe, **nunca `state.rng`**. `purity.test.ts` ganha essa exceção, explícita | Leitura (`GET`), com o objetivo por "salvar uma formação depois da prévia" | V4D-T2 |
| 11 | A batalha em inteiros | Sorte de **90 a 110 por esquadrão por rodada**. Os fatores são frações (×0,5, ×1,5, ×1,25, ×0,7, ×1,2, ×2), com um arredondamento para baixo por conta. O desempate vai pelo defensor, depois pela ala (esquerda, centro, direita), depois pela linha. A batalha é instantânea na linha do tempo | Uma sorte só por rodada | V4D-T1 |
| 12 | Relógios | Tudo em **tempo de jogo** (treino, forja, reparo, viagem, sabotagem, presságios, Fortaleza), com **duas exceções em tempo real**: a **Hora da Vigília** (hora local) e o **intervalo de 60 min reais entre as ondas** do cerco | Tudo em tempo de jogo | V4E-T2, V4G-T1, V4G-T2 |
| 13 | A Hora da Vigília | O estado ganha `settings.realOriginMs` (de `games.created_at`, pelo contexto da migração) e `settings.vigil.utcOffsetMinutes` (do fuso IANA, calculado no servidor). **O motor calcula** a Vigília, sem horário de verão. Mudar a hora ou o fuso só vale para o que ainda não foi marcado | O servidor marca o cerco por uma ordem interna | V4G-T1, V4E-T2.4 |
| 14 | Incursão sem exército | Toda incursão vira batalha. Sem Defesa ativa, só a muralha e as torres lutam. O que passa aplica a regra da v0.2 (10%/15% e feridos) **na proporção do que passou**. A Paliçada Nv1 e Nv2 continua segurando, por HP, o que segurava. **Quem joga hoje não piora**: o golden dos lobos do dia 16 fica igual | Sem formação, a regra da v0.2 inteira, sem batalha | V4E-T2 |
| 25 | Os bots na guerra | As políticas mínimas (Quartel, Lanceiros e Arqueiros com o que sobra, uma formação ativa, o Plano = a Defesa ativa) entram no `economico`, que os perfis Preguiçoso, Regular e Dedicado usam. Um bot `militar` faz a finta, a sabotagem e a milícia, e é o Dedicado da guerra | Um perfil novo "Regular de guerra" | V4C-T1.8, V4I-T1 |
| 26 | Publicação | **Três publicações**, sempre com backup antes: no fim da Fase E (a formação defende), no fim da Fase G (o cerco; protocolo 4) e no fechamento. Entre elas, versões empilhadas no `main` local | Tudo no fechamento; uma por fase | V4E-T5, V4G-T5, V4I-T4 |

## A herança da v0.3 (V4A-T2.1)

| Pendência | Resposta do autor | O que muda |
|---|---|---|
| **F-1**: o objetivo 12 ("Erga a Guilda dos Aventureiros") manda erguer a Guilda mesmo a quem não envia expedição | **Manter.** Para quem segue a lista, o objetivo seguinte é a Patrulha, que dá trabalho ao herói que já recebe soldo | Nada. A medição da [balance-v0.3.md](../balance-v0.3.md), seção 15, fica como está |
| **F-4**: os alarmes passam do limite de 3 avisos por hora | **O alarme passa do limite.** Um aviso essencial nunca é engolido pela cota | O GDD §13.5 ganha a exceção. `policy.test.ts` já fixa o comportamento |
| **E-54**: a tabela do soldo por nível (2, 3, 4, 6, 8, 10, 12, 15, 18, 20) | **Aprovada** | Nada |
| **E-51**: as marcas da Crônica do Mercado a 85% e 115% | **Aprovadas** | Nada |
| **B-2** (da v0.2): guardar e reimportar as sessões na restauração de um backup | **Não; só documentar.** A restauração é rara e de emergência, e reimportar misturaria tokens de duas épocas | Nada; o custo já está em [deploy/README.md](../../deploy/README.md), "O que a restauração custa a quem joga" |

## Números propostos para as Fases B e C (V4A-T2.5)

**Propostos pelo agente e aprovados pelo autor em 2026-10-16**, em uma rodada de três perguntas: a durabilidade (8/10/14/20), o custo do reparo (1 ou 2 ferro por ponto e 2 min de jogo por ponto) e o resto da tabela, em bloco, todos com a recomendada. O que vem do GDD ou das decisões acima está marcado assim; o resto é proposta. Tudo vai para `packages/content`, em frações, com teste.

| O quê | Número | De onde vem |
|---|---|---|
| Ferro no Mercado | Base **8,0** de ouro; volume **`200 × nível`** por dia de jogo; venda a 85%, como os outros recursos; **sem caravana** | Decisão 3 e GDD §5.9 |
| Ferro na Mina Abandonada | **40 a 80** no último nó com prova; Guilda Nv2; revelada pela Floresta Antiga ou pela Patrulha | Decisão 3 |
| Ferro inicial e cap | **0**; divide o Armazém com a madeira e a pedra, com o mesmo cap por recurso | Decisão 3 |
| Ferreiro | Pede o Salão Nv4; vai até o **Nv6**; Nv1 custa 200 madeira, 200 pedra e 150 ouro em 20 min de jogo; os níveis seguintes seguem a curva de custo e tempo dos outros edifícios | GDD §6.1 |
| Forja | **2 ferro + 1 madeira** por arma, **6 min de jogo**; um lote por vez, até **10**; tempo × 10/(10 + nível − 1); cobra ao começar, devolve 80% ao cancelar | Decisão 4 e GDD §5.1 |
| Armas | Recurso **sem cap** no Armazém; não se vendem no Mercado | Decisão 4. Proposta: não vender (o Mercado não vira fonte de ouro por armas) |
| Durabilidade do item | **Comum 8, Incomum 10, Raro 14, Épico 20** pontos | Proposta. O Explorador faz de 3 a 4 expedições por semana real no ritmo Normal: um Comum dura umas duas semanas, um Épico cerca de um mês e meio |
| Desgaste | **1 ponto** por expedição concluída (a perdida não volta com o item) e por batalha que o herói comanda; item em 0 fica **sem bônus** e continua no arsenal | Decisão 5. Proposta: o desgaste conta no fim da expedição, não por nó |
| Reparo | No Ferreiro, na **mesma fila da forja**; custa **1 ferro por ponto** (Comum e Incomum) e **2 ferro por ponto** (Raro e Épico), e **2 min de jogo por ponto**; volta à durabilidade cheia | Proposta |
| Quartel | Pede o Salão Nv4; vai até o **Nv8**; Nv1 custa 250 madeira, 150 pedra e 100 ouro em 20 min de jogo; treino 5% mais rápido por nível | GDD §6.1 |
| Soldados | Limite **`10 × nível` do Quartel** (até 80); treino sequencial em lotes de até **10**; comem **1,5/h** de jogo; custos e tempos das unidades do GDD §10.2 | Decisão 7 e GDD §10.2 |
| Formações | Até **5** salvas, **6** postos, até **20 por posto** (30 com o Quartel Nv5+), **uma** Defesa ativa | Decisão 9 e GDD §10.1 |
| Tetos do estado | Uma fila de forja ou reparo (um lote); uma fila de treino (um lote); 5 formações; o arsenal continua em 30 | Proposta: tetos fixos, conferidos pela guarda de forma da versão nova |

## Consequências e verificação

- As decisões 1 a 14, 25 e 26 e os números das Fases B e C estão fechados: **a Fase B pode começar**.
- Cada número acima é premissa de tarefa e vai para `packages/content` com teste. Se o simulador mostrar problema em algum, ele volta ao autor como pergunta pontual, como na v0.3.
- As decisões 15 a 24 (lote 2) esperam a sessão V4E-T0 e o ADR 0020.
- Continuam do autor, fora deste ADR: a tag `v0.3.0`, conferir `schema_version = 24` em toda partida ativa, o ato 23 (backup fora do servidor, cópia do `RECOVERY_CODE_SECRET`, ensaio de reversão; antes da primeira publicação da v0.4) e jogar a v0.3.
