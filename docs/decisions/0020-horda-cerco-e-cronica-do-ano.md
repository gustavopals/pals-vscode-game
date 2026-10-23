# ADR 0020 — Horda, presságios, sabotagem, Cerco, Crônica do Ano e cartas na v0.4 (lote 2)

**Status:** aceito pelo autor em 2026-10-23, decisão a decisão (sessão V4E-T0). **Contexto:** o [roadmap da v0.4](../roadmap-v0.4.md), §11.2, trazia as decisões 15 a 24 com uma premissa recomendada cada; o autor as respondeu com a medição das Fases B e C na mão (o ouro com o exército, [balance-v0.4.md](../balance-v0.4.md), seção 6; resposta C-9) e com os sete cenários de batalha escritos à mão (`docs/content-v0.4.md`, seção 2; respostas D-1 a D-4 no [ADR 0019](0019-ferro-exercito-formacoes-e-combate-na-v0.4.md)). **Todas as dez ficaram na premissa recomendada**; na 21, a convocação da milícia só vale dentro da antecedência da Torre.

| # | Decisão | O que vale | Tarefas |
| --- | --- | --- | --- |
| 15 | A Horda aprende | guarda só a **última** formação vista (incursão ou onda); `peso = base(estação) + astúcia × contra(tipo, última)`, com astúcia por dificuldade (3/10, 1/2, 4/5) em `difficulties[]`; sem memória entre anos | V4E-T3 |
| 16 | Tiles e datas | a Fortaleza nasce na virada que abre o outono, soma +2 por dia, some com o fim do cerco e volta no outono seguinte; o Acampamento nasce no 25º dia de jogo (o "dia 3" do Normal), soma +2, é limpo pelo ataque e volta na virada do ano como o Covil; a Torre Nv3 a Nv5 avisa com 3, 4 e 5 h reais e revela a composição por partes | V4E-T1, V4E-T3, V4F-T2 |
| 17 | Sabotagem | só no outono com a Fortaleza de pé; exatamente 3 heróis por 6 h de jogo; até 3 por ano; cada nó com Sucesso −15% em uma onda; o Xamã revela a onda 3; o Desastre captura (pela dificuldade) e alerta (+10% na onda 1); a dificuldade sobe por tentativa | V4F-T1 |
| 18 | Presságios e as ondas | as três ondas são **geradas na virada que abre o outono**, com a memória da Horda daquele instante, e regeradas a cada formação nova vista até o inverno (a última vista vale); os presságios leem da versão atual e por isso nunca mentem sobre ela; chance `35% + 10% × (Torre − 1)` por virada de outono e de inverno, no fluxo `horde`; clareza por nível 1, 3 e 5 | V4E-T3, V4G-T2 |
| 19 | O Cerco e a Queda | ondas 40/60/80 + o Senhor da Guerra; dificuldade 7/10, 1, 13/10; Queda = 30% dos recursos, 20% da população (aldeões, sem Mestres nem heróis), muralha a 0, os dois edifícios de nível mais alto −2 (o Salão incluído), sem sorteio; Vitória Gloriosa sem ala rompida em onda nenhuma; derrotar o Senhor da Guerra encerra a onda 3 e dá o Feito; Primavera da Reconstrução ×4/5 por 2 dias de jogo | V4G-T2 |
| 20 | Plano de Batalha e presença | uma formação por onda, salva antes; entre ondas, decisão pendente com prazo de 60 min reais para trocar a formação e pedir reparo de emergência (pedra, na hora); sem resposta, o Plano vale; **sem** "reparo automático se pedra ≥ X" (GDD §17.2 deixa em aberto) | V4G-T2 |
| 21 | Milícia | ordem só com incursão forte ou cerco marcado dentro da antecedência da Torre; até 50% dos aldeões; 3/2/12, ×5/4; não produzem; dissolve ao fim da batalha; as baixas reduzem a população com o piso de 3 | V4G-T2 |
| 22 | Rescaldo e Crônica do Ano | luto −10 por 1 dia com mortos; festa +15 com Gloriosa; reparo com desconto até o fim do inverno; a Crônica do Ano montada **pelo servidor** dos eventos do ano e de um evento `yearEnded` com estatísticas, pontuação (pesos inteiros no conteúdo) e os seis Feitos do cerco, sem lista no estado; **"Avançar para o Degelo" não entra** | V4G-T3 |
| 23 | Os lotes 2 e 3 | 38 cartas (23 + 15), com "A Filha do Ferreiro", cartas de guerra e quatro roteirizadas; apresentadas em lotes de cinco antes da transcrição; o teste de palavras proibidas afrouxado carta a carta | V4H-T1, V4H-T2 |
| 24 | Objetivos 17 a 21 | (os do GDD §12.2 `[v0.4]`) e os sazonais ("Estoque 1.000 comida", "Sabote a Horda uma vez"): os cinco entram; os sazonais **não** (seriam os primeiros objetivos que se repetem por ano) | V4H-T3 |

## Consequências

- A Fase E começa quando o motor de batalha (V4D-T1) estiver no `main`: a Muralha (V4E-T1) é dado da batalha.
- O ouro parado do ritmo Rápido vai para a Muralha, com custos de ouro de fim de jogo e o reparo com ouro (resposta C-9, ADR 0019; os números estão abaixo, em "Números da Fase E").
- As cartas dos lotes 2 e 3 só entram no jogo depois de o autor ler cada lote de cinco (decisão 23).
- Os objetivos sazonais ficam fora da v0.4 (decisão 24); os cinco do GDD §12.2 são medidos no simulador antes de fechar (V4H-T3).
- O GDD (§8.2, §8.3, §9.5, §10.6, §11.1 a §11.4) é corrigido para estas respostas (V4E-T0.3).

## Números da Fase E respondidos em 2026-10-23: o ouro da Muralha

A resposta C-9 (ADR 0019, "Resposta de 2026-10-23") mandava o ouro parado do ritmo Rápido para "a Muralha e a Fortaleza"; a Fortaleza é o forte da Horda, e não um edifício do jogador, e o autor corrigiu o destino:

- **Os níveis 3 a 6 da Paliçada pedem ouro, além da madeira e da pedra, ×3 por nível:** Muralha de Pedra Nv3 **2.000**, Nv4 **6.000**; Baluarte Nv5 **18.000**, Nv6 **54.000** (80 mil no total). A madeira e a pedra seguem a regra do GDD (§6.2: Nv3 com 300 de madeira e 450 de pedra, ×1,6 por nível).
- **O reparo da muralha custa ouro além da pedra:** o mesmo tanto de ouro que de pedra (50% da pedra do nível), também no reparo de emergência entre as ondas do cerco.
- Medir na V4E-T5 contra a seção 6 do balanceamento: o ouro parado do Rápido cai, e o Normal não fica sem o Nv3.

