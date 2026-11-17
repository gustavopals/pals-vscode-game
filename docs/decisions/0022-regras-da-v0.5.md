# ADR 0022 — Regras da v0.5 ("Mundo e Legado")

Data: 2026-11-17\
Status: **Aceito (2026-11-17)**\
Escopo: GDD §5.7, §6.1, §6.2, §8.1, §9.2, §9.3, §10.3, §10.6, §11.2, §11.5, §11.6, §16.2, §17.2 e Apêndices B e D; [roadmap da v0.5](../roadmap-v0.5.md), §2, §4, §5 e §8 (decisões D-1 a D-31); [pendências da v0.5](../pendencias-v0.5.md)

## Contexto

Com a v0.4.0 publicada em 2026-11-17 (`b7640394`, estado 42, protocolo 4), o [roadmap da v0.5](../roadmap-v0.5.md) ("Mundo e Legado") reuniu na §4 as 31 decisões de processo, escopo e regra necessárias para implementar Capela e relíquias, Ano 2 (escala, memória da Horda, Trolls e Votos), Sementes e Legado, Mapa hexagonal, Postos Avançados e Temporadas semanais.

Em **2026-11-17**, o autor respondeu ao lote completo da §4:

- **D-1 aprovada:** valem o regime rápido de verificação (§2 do roadmap) e a regra **"sem resposta vale a recomendada"**.
- **D-2 a D-31 aprovadas com a recomendação da tabela:** cada decisão vale conforme a coluna "Recomendação" da §4 do roadmap. Mudar qualquer uma depois é mudança de regra (conteúdo, golden e GDD no mesmo commit).
- **Ressalva da D-31 (ideias da §8):** pela regra "vale a recomendada", a recomendação da tabela para a D-31 é *"Escolher quais entram"*. Como não houve escolha explícita de itens da §8 pelo autor, **nenhuma ideia da §8 entra no escopo da v0.5** enquanto não houver escolha explícita. O ponto fica aberto em [pendencias-v0.5.md](../pendencias-v0.5.md).

## Decisão

| # | Assunto | Resolução (em vigor) | Tarefas / GDD |
| --- | --- | --- | --- |
| D-1 | Regime rápido e regra de decisão | Valem o regime rápido (§2 do roadmap: testes focados e sentinelas locais; portão pesado na CI) e a regra "sem resposta vale a recomendada". | V5A-T1, V5A-T2 |
| D-2 | Ordem das fases | **Capela (B) → Ano 2 (C) → Sementes e Legado (D) → Mapa (E) → Postos (F) → Temporadas (G) → Fechamento (H).** Quem começou na v0.4 no ritmo Rápido chega ao Ano 2 em 56 h; o mapa não trava as fases anteriores. | Fases B a H |
| D-3 | Branches e PR rascunho | O agente dá `push` em branch `v5-*` e abre PR rascunho para acionar a CI sem implantar. `push` no `main` continua restrito à autorização do autor por fase. | V5A-T2, Fases B a G |
| D-4 | Versão do estado por fase | Uma versão do `GameState` por fase publicada (B = 43, C = 44, E = 45, F = 46; D e G sem versão nova), em vez de uma por tarefa. Retratos gravados só no fecho da fase. | Fases B, C, E, F; §5.1 |
| D-5 | Relíquias e Capela | Entram as oito relíquias do GDD (Apêndice D). Espaços na Capela iguais ao nível do edifício (1 a 3). A Capela pede Salão Nv5, soma +5 de moral e acelera a cura de ferimentos novos em 25%. | V5B-T1, V5B-T2; GDD §6.1, Ap. D |
| D-6 | Origem das relíquias | Duas expedições lendárias em **modelos novos** (sem criar 4ª variante nos modelos atuais), entregando relíquia certa no Sucesso, em ordem fixa e sem sorteio; `whiteWolfHunt` entrega o Osso de Lobo; o Santuário entra com o mapa. | V5B-T3, V5E-T4; GDD §9.3, Ap. B |
| D-7 | Expedição lendária no Ano 1 | Disponível já no Ano 1, exigindo Capela erguida e Guilda Nv4, para que a relíquia possa chegar antes do primeiro Cerco. | V5B-T3; GDD §9.3, §11.5 |
| D-8 | Troca de relíquia | Livre a qualquer momento, mas o efeito da relíquia colocada só passa a valer na **próxima virada de dia de jogo**, evitando trocas de minuto. | V5B-T2, V5B-T4; GDD §6.1, Ap. D |
| D-9 | Relíquias com maldição | Não entram contrapartidas ou maldições nas relíquias na v0.5. | V5B-T2; GDD §17.2 |
| D-10 | Selo do Rei Antigo | Como não há mecânica contínua de impostos, o efeito é reduzir à **metade o ouro pedido pelas cartas da Coroa** (`kingsTax`, `kingsCollector`). | V5B-T2; GDD Ap. D |
| D-11 | Termo "+10 × relíquias de moral" | Retirado da fórmula do GDD §5.7: nenhuma das oito relíquias é de moral do feudo, e a Capela já soma +5. | V5A-T3, V5B-T1; GDD §5.7 |
| D-12 | Plantas (blueprints) | Ficam fora da v0.5 (adiadas para a v0.6). | GDD §9.2, §9.3 |
| D-13 | Escala das ondas no Ano N | Aplica-se o fator `1 + 0,10 × anos_anteriores` sobre o fator do ano já existente (no Ano 2: `2/3 × 11/10`). | V5C-T1; GDD §11.2, §11.5 |
| D-14 | Memória da Horda entre anos | Peso de **50%** para a última formação do ano anterior, aplicado **só no primeiro plano de ondas** do ano novo. | V5C-T1; GDD §10.6, §11.5, §17.2 |
| D-15 | Inimigo novo do Ano 2+ | Entra apenas o **Troll** (a partir do Ano 2, lento, muita vida, fraco contra Lanceiros). O Necromante fica para a v0.6. | V5C-T2; GDD §10.3, §11.5 |
| D-16 | Quais Votos entram | Quatro Votos: "Sem muralhas" (+40%), "Horda astuta" (+25%), "Comida escassa" (+20%) e "Heróis mortais" (+35%). "Inverno longo" fica para a v0.6. Voto que a dificuldade já impõe (astúcia e morte em Rei de Ferro) não é oferecido. | V5C-T3; GDD §11.5 |
| D-17 | Quando escolher Votos | Janela do fim do Cerco até **24 h reais** depois da virada do ano (escolha única no ano), e também na criação de partida nova. Sem resposta, nenhum Voto é ativado. | V5C-T3, V5C-T4; GDD §11.5 |
| D-18 | Escopo do Legado | Mínimo na v0.5: pontos somados na conta (pontuação + Feitos, multiplicados pelos Votos e pela dificuldade), visíveis na aba Reino. Único gasto na v0.5: o cenário **Serra do Ferro** (após o mapa). Votos são livres. Classes, unidades, demais cenários e estilos de Crônica ficam para a v0.6. | V5C-T3, V5D-T2, V5E-T4; GDD §11.5 |
| D-19 | Semente visível e escolhida | A semente da partida pessoal sai no `ViewState` e pode ser escolhida em `POST /games` em produção (aceita-se a previsibilidade para quem lê o código na partida pessoal). | V5D-T1; GDD §11.5, §14.5 |
| D-20 | Mapa hexagonal | SVG feito à mão na aba "Mapa", raio inicial 3 (37 hexágonos) até raio 5 (91 hexágonos). A árvore lateral e as listas nas demais abas continuam existindo. | V5E-T1 a V5E-T3; GDD §8.1, §13.1 |
| D-21 | Estados de névoa do mapa | Quatro estados (`Desconhecido`, `Avistado`, `Explorado`, `Reivindicado`), como no GDD §8.1; corrigido o §16.2 que dizia três. A névoa nunca regride. | V5A-T3, V5E-T1, V5E-T2; GDD §8.1, §16.2 |
| D-22 | Mapa em partidas migradas | Partidas em andamento ganham a grade na migração (estado 45) por conta determinística sobre `state.seed`, sem sorteio no `rng`; destinos já descobertos entram como `Explorado`. | V5E-T1; GDD §8.1, §15.4 |
| D-23 | Posto Avançado | Custo do GDD (250 madeira, 150 pedra, 100 ouro, 45 min de jogo), Salão Nv5, até 3 postos, em obra com prazo próprio fora da fila do feudo. Veio de Ferro dá 3 ferro/h contínuos; Floresta, Campos e Colinas dão +15% (23/20). | V5F-T1; GDD §6.1, §6.2, §8.1 |
| D-24 | Posto sob ataque | Sem sorteio: a incursão que rompe a defesa danifica o posto ativo mais distante, parando sua produção até reparo em madeira e pedra. Sem guarnição na v0.5. | V5F-T2, V5F-T3; GDD §8.1 |
| D-25 | Temporada e partida pessoal | Duas partidas ativas por conta (uma pessoal e uma da Temporada corrente), com seletor na interface. A partida da Temporada é arquivada ao fechar o ranking semanal. | V5G-T1, V5G-T3; GDD §11.6, §14.6 |
| D-26 | Ritmo, dificuldade e fuso da Temporada | **Ritmo 3× (Rápido) e dificuldade Senhor**, iguais para todos. Abre segunda-feira às **00:00 de Brasília** (`America/Sao_Paulo`, exibido na tela), aceita entradas até terça e publica o ranking no domingo às 23:59. | V5G-T1, V5G-T2; GDD §11.6, §17.2 |
| D-27 | Semente da Temporada | Escondida até o fechamento do ranking da semana, para evitar previsão da prova em andamento. | V5G-T1; GDD §11.5, §11.6 |
| D-28 | Ranking e Crônicas da Temporada | Ranking pela pontuação do Ano 1, mostrando só o nome do feudo e respeitando `accounts.ranking_listed` ([ADR 0021](0021-estatisticas-e-ranking.md)). Leitura aberta apenas para a Crônica do Ano fechada de quem está listado. | V5G-T2, V5G-T3; GDD §11.6 |
| D-29 | Moderação de nomes de feudo | Não entra ferramenta de moderação na v0.5; registrado em [pendencias-v0.5.md](../pendencias-v0.5.md) para o autor atualizar a política de privacidade. | V5A-T3; GDD §17.2 |
| D-30 | Conteúdo narrativo | O agente escreve os textos novos e o autor revisa por amostra em cada publicação. | Fases B, C, E, F |
| D-31 | Ideias de diversão da §8 | Pela regra "vale a recomendada", a recomendação é "Escolher quais entram". Sem escolha explícita do autor, **nenhuma ideia da §8 entra**; fica como pergunta aberta em [pendencias-v0.5.md](../pendencias-v0.5.md). | V5A-T3; roadmap §8 |

## Consequências e verificação

- As Fases B a H do [roadmap da v0.5](../roadmap-v0.5.md) estão destravadas com os contratos acima.
- O protocolo permanece na versão **4** (todas as entregas entram por adição na visão e nos comandos).
- O `GAME_DESIGN.md` é atualizado neste mesmo lote (V5A-T3) onde as decisões mudam regras ou fecham questões em aberto (§5.7, §9.2, §9.3, §11.5, §11.6, §16.2, §17.2 e Apêndice D).
- Os bots do `sim-cli` e as faixas medidas da matriz do Ano 1 não mudam antes da Fase H: qualquer alteração em golden do Ano 1 sem mecânica nova ativada é regressão (§5.2 do roadmap).
