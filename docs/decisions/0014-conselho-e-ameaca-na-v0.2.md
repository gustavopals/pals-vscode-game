# 0014 — Conselho e ameaça na v0.2

Data: 2026-10-01\
Estado: aplicada por delegação do autor em 2026-10-01; **aguarda confirmação decisão a decisão** ([pendencias-v0.2.md](../pendencias-v0.2.md))\
Escopo: GDD §6.1, §7.1, §7.2, §8.2, §12.1, §12.2 e §14.5; roadmap da v0.2, lote 2 de decisões (V2D-T0): Fases D e E

## Contexto

Segundo lote das decisões da §8 do [roadmap da v0.2](../roadmap-v0.2.md): Conselho do Feudo, lobos, Ameaça, Torre de Vigia, Paliçada, objetivos e virada de ano. Como no [ADR 0013](0013-regras-da-v0.2-tempo-ritmo-migracao-e-economia.md), o autor pediu a implementação inteira sem a sessão de perguntas; aplicou-se **a premissa recomendada de cada decisão**, com os detalhes que faltavam. Nada aqui foi respondido pelo autor.

## Decisão

| # | Decisão | O que foi aplicado | Alternativa descartada | Razão | Tarefas | GDD |
|---|---|---|---|---|---|---|
| 1 | Prazos do Conselho | A cadência é de **4 dias de jogo** entre sorteios (8 h reais no Normal; 2 h 40 no Rápido). A **expiração é de 24 h reais** em qualquer ritmo: `expiresAtMs = instante do sorteio + 24 h × timeScale`, convertido no sorteio. Efeitos "por N dias" contam dias de jogo | Expiração em tempo de jogo (8 h reais no Rápido) | É a única janela que depende de uma pessoa responder; em tempo de jogo venceria durante uma noite | V2D-T1 | §7.1 |
| 7 | Quais cartas, quantas, quem escreve | Lote 1: **3 cadeias de 3 cartas + 12 avulsas = 21**, escritas pelo agente, com a ficha da §12.3 do roadmap, em `docs/content-v0.2.md`. **A aprovação carta a carta pelo autor ficou pendente**: as cartas estão no jogo como rascunho aprovável. A meta de 60 do GDD fica para o lote 2 | Esperar a aprovação para pôr no jogo | O autor pediu a versão inteira jogável pela manhã; texto e números das cartas são conteúdo, fáceis de trocar | V2D-T2 | §7.1, Apêndice B |
| 8 | A carta roteirizada que entrega um herói | Fica para a **v0.3**. Nenhuma carta roteirizada no lote 1 (o motor aceita `scripted`, mas o catálogo não usa) | Antecipar o herói | Antecipar o herói é antecipar a Guilda | V2D-T2 | §7.1, §16.2 |
| 9 | Opção "melhor" e "pior" por dificuldade | Cada carta marca `autoResolve: { peasant, lord, ironKing }` **editorialmente**; as três opções existem e **não têm custo nem requisito** | Calcular "melhor" e "pior" no motor | Calcular é ambíguo e não testável; marcar é simples e revisável | V2D-T1 | §12.1 |
| 10 | Lobos | Uivos (prenúncio, sem informação) no início do **dia 10** do ano 1; incursão roteirizada no início do **dia 16** do ano 1 (30 h de jogo: segundo dia real no Normal, 10 h no Rápido), só em partidas que ainda não passaram desse instante. Incursão **leve**: perde **10%** da comida e da madeira e fere **1** aldeão; **média**: **15%** e **2** feridos. Ferido não trabalha por **1 dia de jogo**. Incursão com perdas: moral **−10 por 2 dias de jogo**. **Incursões por Ameaça entram**: a cada virada de dia, chance de `máx(0, Ameaça − 40)%`; leve abaixo de 60, média a partir de 60; marcada para **6 h de jogo** depois; no máximo uma incursão marcada por vez | Só a roteirizada; perdas "até 15%" sorteadas | Sem incursões recorrentes, Torre e Paliçada seriam compradas uma vez e esquecidas; perda fixa é explicável | V2E-T3 | §8.2, §12.3 |
| 11 | Ameaça, Torre e Paliçada | Ameaça de 0 a 100: **+5 por dia de jogo** por tile de ameaça ativo (o Covil de Lobos, ativo desde o dia 1) e **+3 por dia** no outono; cai **−10 em toda incursão**, repelida ou sofrida. **Só é visível com a Torre.** Torre Nv1: mostra o número e a explicação, e avisa **1 h de jogo** antes; Nv2: avisa **2 h** antes e diz o tamanho. Paliçada Nv1 segura incursões leves (sem perda nem ferido); Nv2 segura também as médias; média contra Nv1: **metade** da perda e 1 ferido. Torre e Paliçada vão até o **nível 2** nesta versão | Ameaça só cai ao limpar tile (impossível na v0.2); Torre até o Nv5 sem efeito novo | Cada nível vendido tem de mudar algo que o jogador vê; limpar tile e Nv3+ pertencem às versões que os usam | V2E-T1, V2E-T2 | §6.1, §8.2 |
| 12 | Objetivos 5 a 10 | 5 `buildWatchtower` (+40 pedra) · 6 `answerFirstCard` (+10 moral por 1 dia) · 7 `buildGranaryOrWarehouse` (+60 madeira) · 8 `planAutoStart` (+30 ouro) · 9 `buildPalisade` (+100 madeira) · 10 `surviveWinterWithoutCold` (+15 moral por 1 dia). Os objetivos 1–4 não mudam de ID. O objetivo 4 passa a recompensar o desbloqueio (ADR 0002) | Os objetivos 5–15 do GDD como estão (dependem de herói e exército) | Cada um ensina uma ferramenta nova quando ela resolve um problema já sentido | V2E-T4, V2C-T2 | §12.2 |
| 18 | Ordem no Conselho | Cadência **ancorada**: `nextDrawAtMs += intervalo` sempre, mesmo quando o sorteio é pulado por haver 2 pendentes. Continuação agendada tem **prioridade** sobre o sorteio e não é bloqueada por ele: chega no primeiro instante em que houver menos de 2 pendentes a partir do prazo. A expiração é resolvida **antes** de um comando no mesmo instante (`CARD_EXPIRED`) | Cadência relativa à última resposta | O resultado offline não pode depender de como o intervalo foi dividido | V2D-T1 | §7.1 |
| 20 | Virada de ano | `seenThisYear` zera; flags, cartas pendentes, continuações agendadas, efeitos, obras e recursos continuam; a incursão roteirizada é só do ano 1; as por Ameaça continuam | Zerar flags a cada ano | A história não se apaga nem dobra recompensas | V2D-T1, V2E-T3 | §7.1, §8.2 |
| 21 | Propostas de experiência (IDEIA-01 a 07) | **Todas entram**: "Antes de partir", aviso de estação, "Sua escolha voltou", marcos de preparação, Retorno em três blocos, variantes de texto por escolha. A IDEIA-06 (piso de população) é regra e está no ADR 0013, decisão 19 | Deixar para depois do playtest | São o que torna as mecânicas legíveis; nenhuma cria moeda, tarefa diária ou prêmio por login | V2C-T6, V2D-T2, V2D-T4, V2E-T4 | §2.3, §13.5 |

### O que uma carta pode fazer nesta versão

Efeitos: recursos (ganho cortado no cap, com o corte contado), moral com duração em dias de jogo, gravar e apagar flag, agendar outra carta. Requisitos: estação, dia mínimo, edifícios, flags, faixa de moral. Efeitos ocultos têm sempre uma pista e viram evento no instante em que acontecem; nunca saem no `ViewState`. Ficam fora: herói, traço, unidades, mapa, Mercado, ferro, combate.

### Compatibilidade

O `ViewState` passa a trazer cartas em `pendingDecisions`, que o app da v0.1 não sabe ler. O protocolo sobe para **2** e o servidor responde `426 UPGRADE_REQUIRED` ("Há uma versão nova do jogo. Recarregue a página.") a um `X-Lords-Client` anterior. O cache local de uma versão anterior é descartado.

## Consequências e verificação

- O GDD foi corrigido em §6.1, §7.1, §8.2 e §12.2 com os números aplicados.
- Critérios 2, 3 e 4 da §16.2: cenário no motor nas três dificuldades, a cadeia "O Celeiro Comum" de ponta a ponta nas duas ramificações, e a incursão de lobos com o jogador fora, por integração e em navegador.
- A mesma incursão com Torre 0/1/2 e Paliçada 0/1/2 (matriz QA-10) prova que aviso e proteção têm efeito real.
- **O que o autor precisa confirmar**, incluindo o texto das 21 cartas, está em [pendencias-v0.2.md](../pendencias-v0.2.md).
