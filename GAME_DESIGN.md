# Lords of the Guild — Game Design Document (GDD)

> **Status:** design consolidado / base para desenvolvimento com agentes de código (Codex, Claude Code)  
> **Versão do documento:** 0.2 (reescrita e expansão da v0.1)  
> **Idioma:** português (Brasil)  
> **Plataforma inicial:** extensão do Visual Studio Code (VS Code)  
> **Gênero:** estratégia e gerenciamento medieval assíncrono, com RPG de guilda e batalhas táticas por formação  
> **Inspirações:** Tribal Wars e OGame (progressão assíncrona), Against the Storm e Frostpunk (pressão das estações), Reigns e King of Dragon Pass (dilemas), Darkest Dungeon (expedições com risco), Into the Breach (combate determinístico e legível), auto-battlers (formação como decisão central).

**Em uma frase:** um feudo que você governa nas pausas do café, onde cada semana é um ano, e cada ano termina com um cerco que você passou a semana inteira preparando.

---

## 0. Como ler este documento

- Cada mecânica traz a **tag de versão** em que entra no jogo: `[v0.1]`, `[v0.2]`, `[v0.3]`, `[v0.4]`, `[v0.5]`, `[v0.6]`. Um agente implementando a `v0.2` deve ignorar tudo com tag maior, mas **não pode tomar decisões de arquitetura que impeçam** as versões seguintes (ver §14).
- A **semana completa de diversão** descrita em §2 fica pronta a partir da `v0.4`. As versões anteriores são incrementos jogáveis, cada um com seus próprios critérios de aceitação (§16).
- **Todos os números** deste documento são parâmetros iniciais de balanceamento. Vivem em arquivos de conteúdo/configuração (§14.3), nunca espalhados pela interface ou pelo motor.
- Nomes de jogo em português; identificadores de código em inglês (`townHall`, `lumberMill`, `siegeWave`).
- Mudanças em relação à v0.1 estão resumidas em §17 ("Decisões desta revisão").

### Índice

1. Visão geral e pilares
2. A experiência de uma semana (o Primeiro Ano)
3. Loops de jogo (sessão, dia, semana)
4. Calendário, estações e ritmo
5. Economia: recursos, população, moral e armazenamento
6. Edifícios e construção
7. Conselho do Feudo: cartas, dilemas e cadeias narrativas
8. Mapa, exploração e ameaça
9. Guilda, heróis e expedições com encruzilhadas
10. Exército, formações e combate (mecânica central)
11. O Cerco do Inverno, a Crônica do Ano e o Legado
12. Dificuldade, objetivos e tutorial
13. Interface e experiência no VS Code
14. Arquitetura, determinismo e dados
15. Balanceamento, testes de diversão e simulador
16. Roadmap, escopo por versão e critérios de aceitação
17. Decisões desta revisão e questões em aberto
18. Tarefas para o agente de código
Apêndices: A (unidades e inimigos), B (cartas do Conselho), C (expedições), D (heróis, traços, relíquias), E (presságios, feitos, Crônica), F (glossário)

---

## 1. Visão geral e pilares

**Lords of the Guild** é um jogo medieval de fantasia jogado dentro do VS Code. O jogador governa **Pedra Alta**, um feudo pequeno e vulnerável, ao longo de um **ano de jogo que dura uma semana real**. Durante a primavera e o verão ele constrói a economia, recruta heróis, explora um mapa coberto de névoa e repele incursões cada vez maiores. No outono recebe presságios sobre a **Horda** que marcha do norte. No inverno, o feudo enfrenta o **Cerco do Inverno**: três ondas de ataque resolvidas automaticamente com a formação que o jogador preparou. Sobreviva ou não, o ano termina com a **Crônica do Ano** e um novo ano começa, mais difícil e com mais opções.

O jogo **não é sobre programação**. O VS Code é a interface: árvores de navegação, painéis, tabelas, notificações com botões e comandos. Nenhuma linha de código, nenhum terminal. As sessões duram de 2 a 10 minutos e o mundo continua andando com o editor fechado.

### 1.1 Pilares de design

1. **Toda sessão tem uma decisão com custo real.** Nunca "clique para coletar". Alocar, construir, enviar, escolher um caminho, montar uma formação: cada ação fecha uma porta e abre outra.
2. **Tempo é o adversário, não o jogador ausente.** O calendário avança sozinho e o inverno chega para todos. Mas a ausência nunca é punida: produção offline respeita o estoque, incursões usam a formação salva, expedições seguem a postura definida. Quem volta encontra um relatório, não um castigo.
3. **Legível e explicável.** Cada número tem um "por quê" no tooltip. Cada batalha tem um relatório que diz **o que decidiu o resultado**. Nada de dados ocultos sem pista: o que você não sabe, você pode descobrir (vigias, batedores, presságios).
4. **O inimigo reage a você.** A Horda observa a sua última formação e traz contramedidas. Quem repete a mesma receita perde. Quem engana a Horda com uma formação-isca vence com estilo.
5. **Interface discreta, nativa do editor.** Parece uma ferramenta do VS Code: temas claro/escuro, teclado, status bar com uma linha, notificações contidas. Jogável no trabalho sem constrangimento.
6. **Começar simples, pensar grande.** Single-player local primeiro. A arquitetura (motor determinístico, conteúdo como dados, comandos validados) prepara multiplayer sem construí-lo agora.

### 1.2 Fantasia do jogador

Ser o senhor ou a senhora de Pedra Alta: chegar com cinco aldeões e um baú de moedas, ouvir os lobos uivarem na segunda noite, contratar uma guerreira errante na taverna, mandar batedores às ruínas, ler nos corvos que a Horda trará feras, erguer muralhas às pressas no outono e, na longa noite do inverno, ver a sua formação resistir à terceira onda por um fio. E então ler na Crônica: *"No ano um da Casa de Pedra Alta, a muralha cedeu ao norte, mas o Senhor da Guerra tombou diante dos lanceiros."*

### 1.3 Por que isto se sustenta por uma semana

| Dia | O que é novo | Por que o jogador volta |
|---|---|---|
| 1 | Economia, construção, primeiros objetivos | Ver a aldeia crescer; primeira carta do Conselho |
| 2 | Primeiro herói, taverna, mercado, lobos | Patrulhar, vender excedente, descobrir o mapa |
| 3 | Quartel, paliçada, primeira incursão humana | Montar a primeira formação; saqueadores no mapa |
| 4 | Ferreiro, ruínas, cadeia narrativa | Expedição com encruzilhada; item raro; ferro |
| 5 | Outono: colheita, Fortaleza da Horda, presságios | Decidir entre estocar e sabotar a Horda |
| 6 | Incursão forte (ensaio do cerco), últimas obras | Ajustar a formação com base no relatório |
| 7 | Inverno: frio, lenha, Cerco em 3 ondas, Crônica do Ano | Ver o resultado da semana; abrir o Ano 2 com Legado |

Mais detalhes em §2. Os três motores de variedade são: **calendário** (o mundo muda sem o jogador), **cartas e encruzilhadas** (narrativa com escolhas) e **Horda adaptativa** (o desafio muda porque você jogou).

---

## 2. A experiência de uma semana (o Primeiro Ano)

### 2.1 Estrutura do ano `[v0.2 calendário]` `[v0.4 cerco]`

No ritmo **Normal**, um ano de jogo dura **168 horas reais** (7 dias) a partir da criação da partida ou do início do ano:

| Estação | Horas reais | Dias de jogo | Tom |
|---|---|---|---|
| Primavera | 0 – 48 h | 1 – 24 | Crescimento, tutorial narrativo, lobos |
| Verão | 48 – 96 h | 25 – 48 | Expansão, primeiros saqueadores, expedições |
| Outono | 96 – 144 h | 49 – 72 | Colheita, presságios, Fortaleza da Horda, preparação |
| Inverno | 144 – 168 h | 73 – 84 | Frio, lenha, **Cerco do Inverno**, Crônica do Ano |

Um **dia de jogo** dura 2 horas reais. Produção e consumo são contínuos; eventos discretos (cartas, preços, moral, checagem de incursão) acontecem na virada de cada dia de jogo. Ritmos alternativos em §4.2.

### 2.2 Linha do tempo detalhada (ritmo Normal, jogador de duas sessões de 10 minutos por dia)

| Dia real | Mundo (acontece sozinho) | Desbloqueios típicos do jogador | Decisões típicas da sessão |
|---|---|---|---|
| **1** Primavera | Chegada a Pedra Alta; objetivos iniciais; 1ª carta do Conselho às 8 h; uivos ao anoitecer (aviso) | Fazenda, Serraria, Pedreira, Mina, Habitações; Salão Nv2 abre Celeiro, Armazém e Torre de Vigia | Alocar aldeões, escolher a primeira obra, recrutar |
| **2** Primavera | Carta roteirizada "Estrangeira ferida" entrega o 1º herói; 1ª incursão de lobos (leve); mercador itinerante | Salão Nv3 abre Taverna, Mercado, Guilda, Paliçada | Contratar herói, 1ª patrulha, vender excedente, iniciar paliçada |
| **3** Verão | Acampamento de saqueadores aparece no mapa; 1ª incursão humana (fraca) | Salão Nv4 abre Quartel e Ferreiro; Lanceiros e Arqueiros | Treinar tropa, montar a 1ª formação, expedição à Floresta Antiga |
| **4** Verão | Ruínas reveladas; início da cadeia "O Mercador Misterioso"; incursão média | Espadachins; mapa raio 4; Mina Abandonada (ferro) | Encruzilhada nas ruínas, decidir entre ferro e muralha |
| **5** Outono | Colheita (+30% comida); **Fortaleza da Horda** surge ao norte; 1º Presságio; preços de comida sobem | Salão Nv5 abre Capela e Posto Avançado; Cavaleiros | Estocar ou investir; sabotar a Horda ou guardar os heróis |
| **6** Outono | Presságios diários; **incursão forte** (ensaio do cerco); última janela de sabotagem | Torres; Muralha de pedra | Ler o relatório da incursão, corrigir a formação, reparar, salvar plano por onda |
| **7** Inverno | Comida ×0,4; lenha consumida; **Cerco** na Hora da Vigília (3 ondas, 60 min entre elas); Rescaldo; **Crônica do Ano** às 168 h | Legado; escolha de Votos para o Ano 2 | Convocar milícia, reposicionar entre ondas, ler a Crônica, iniciar o Degelo |

Jogadores mais ativos chegam aos desbloqueios antes (gate por nível do Salão), mas **o mundo segue o calendário**: a Fortaleza, os presságios e o cerco têm data. Isso dá ao jogador ativo mais preparo, não um jogo diferente.

### 2.3 O que o jogador faz quando volta

1. **Lê o Relatório de Retorno** (aparece após 4 h ou mais ausente): produção, eventos, incursões, expedições, cartas pendentes.
2. **Resolve decisões pendentes**: cartas do Conselho, encruzilhadas, formação após relatório de batalha.
3. **Ajusta a economia**: realoca trabalhadores, inicia obra, recruta, negocia.
4. **Lança processos para a próxima ausência**: expedição, treinamento, caravana, plano de batalha.
5. **Sai.** Nada exige voltar antes de 8 h; algo sempre acontece em menos de 8 h.

---

## 3. Loops de jogo

### 3.1 Loop de sessão (2 – 10 min)

`Relatório → Decisões pendentes → Ajustes econômicos → Lançar processos → Sair`

### 3.2 Loop de dia real (2 – 3 sessões)

`Carta do Conselho → Obra concluída → Expedição em encruzilhada → Incursão (às vezes) → Novo desbloqueio`

### 3.3 Loop de ano (7 dias)

`Crescer (Primavera) → Expandir e armar (Verão) → Estocar, ler presságios, sabotar (Outono) → Resistir (Inverno) → Crônica → Legado → Ano seguinte`

### 3.4 Loop de longo prazo (semanas)

`Anos sucessivos com Votos → novos cenários e classes → desafios com semente compartilhada → multiplayer (futuro)`

**Duração ideal de sessão:** 2 – 10 minutos. **Tempo entre ações significativas:** nunca acima de 8 h; tipicamente 1 – 4 h.

---

## 4. Calendário, estações e ritmo

### 4.1 Efeitos das estações `[v0.2]`

| Estação | Comida | Madeira | Pedra | Ouro | Outros efeitos |
|---|---:|---:|---:|---:|---|
| Primavera | ×1,2 | ×1,0 | ×1,0 | ×1,0 | Recrutamento de aldeões 20% mais rápido |
| Verão | ×1,0 | ×1,15 | ×1,15 | ×1,0 | Expedições 15% mais rápidas |
| Outono | ×1,3 | ×1,0 | ×1,0 | ×1,1 | Colheita; presságios; preço da comida sobe 30% |
| Inverno | ×0,4 | ×0,8 | ×0,8 | ×1,0 | **Lenha:** 0,5 madeira por habitante/h; obras 50% mais lentas; cerco |

Sem lenha no inverno: moral −20 e produção ×0,8 ("frio"). Sem comida: regras de escassez (§5.6).

### 4.2 Ritmos `[v0.2]`

| Ritmo | Duração do ano | Para quem |
|---|---|---|
| Normal | 7 dias | Padrão: uma semana, um ano |
| Rápido | 3,5 dias | Quem joga muitas vezes por dia; testes |
| Tranquilo | 14 dias | Quem abre o editor 1 vez por dia |

Implementação: o motor roda em **tempo de jogo**; a extensão converte tempo real em tempo de jogo com um fator `timeScale` (1, 2 ou 0,5). Todos os valores deste documento estão no ritmo Normal. O ritmo é escolhido na criação da partida e não muda durante o ano.

### 4.3 Hora da Vigília `[v0.4]`

Eventos que merecem presença (cerco, incursão forte do dia 6) acontecem na **Hora da Vigília**, horário local configurado pelo jogador (padrão 20:00). O cerco começa na primeira Hora da Vigília que caia pelo menos 6 h após o início do inverno; se não houver nenhuma, começa 12 h após o início do inverno. Estar presente **não é obrigatório**: tudo se resolve com o Plano de Batalha salvo (§10.8).

---

## 5. Economia: recursos, população, moral e armazenamento

### 5.1 Recursos

| Recurso | Origem | Usos | Versão |
|---|---|---|---|
| Comida | Fazenda, colheita, caça, mercado | Sustento, recrutamento, soldados, expedições | v0.1 |
| Madeira | Serraria, expedições | Edifícios, lanças e arcos, lenha no inverno | v0.1 |
| Pedra | Pedreira, ruínas | Edifícios avançados, muralhas, torres, reparos | v0.1 |
| Ouro | Mina de Ouro, mercado, saque | Recrutamento, heróis, mercado, soldos de heróis | v0.1 |
| Ferro | Mina Abandonada, Veio de Ferro (posto avançado), mercado | Armas, equipamentos | v0.4 |
| Armas | Ferreiro (2 ferro + 1 madeira → 1 arma, 6 min) | Espadachins e Cavaleiros | v0.4 |

Comida, madeira, pedra e ferro têm **capacidade de armazenamento** (§5.5). Ouro e armas não têm limite.

### 5.2 Parâmetros iniciais

| Parâmetro | Valor |
|---|---:|
| População inicial | 5 aldeões |
| Capacidade habitacional inicial | 10 |
| Comida / Madeira / Pedra / Ouro iniciais | 180 / 120 / 65 / 250 |
| Produção por trabalhador/h (nível 1) — Fazenda / Serraria / Pedreira / Mina | 10 / 8 / 5 / 4 |
| Consumo de comida | 1 por habitante/h (aldeões) · 1,5 por soldado/h |
| Recrutar aldeão | 50 comida + 10 ouro, 20 min, fila de até 5 |
| Capacidade inicial de armazenamento (antes de Celeiro/Armazém) | 500 por recurso |

### 5.3 Fórmulas

```
produção/h (por edifício) = trabalhadores × taxa_base × bônus_nível × estação × moral × mestria
bônus_nível                = 1 + 0,20 × (nível − 1)
moral (multiplicador)      = 0,75 + 0,5 × (moral / 100)          → moral 50 = ×1,0 ; 100 = ×1,25 ; 0 = ×0,75
mestria                    = 1 + 0,30 × (experiência_do_ofício / 100)   [v0.2, ver 5.4]
comida líquida/h           = produção − habitantes × 1 − soldados × 1,5
```

### 5.4 Trabalhadores

- Cada aldeão é **habitante** e pode ser **trabalhador** em um edifício produtivo, **recruta** em treinamento ou **soldado** (soldados não produzem e comem mais). Heróis **não** contam como população.
- `[v0.1]` Realocar é imediato e gratuito.
- `[v0.2]` **Troca de ofício:** trabalhadores recém-realocados produzem 50% por 1 dia de jogo (2 h). Cada edifício produtivo acumula **experiência do ofício** (0 – 100): +4 por dia de jogo com ao menos metade dos postos ocupados, −8 por dia de jogo vazio. Bônus máximo +30%. Efeito desejado: especializar compensa; ficar trocando a toda hora custa.
- `[v0.3]` **Mestres:** aldeões nomeados e raros (cartas, expedições) que ocupam um posto e dão +15% ao edifício.

### 5.5 Armazenamento `[v0.2]`

| Edifício | Capacidade nível 1 | Por nível adicional |
|---|---:|---:|
| Celeiro (comida) | 900 | +600 |
| Armazém (madeira, pedra, ferro — cada) | 900 | +600 |

Produção acima do limite é perdida e gera a linha "Celeiro cheio: 120 comida desperdiçadas" no Relatório. O painel mostra **"cheio em 7 h"** para que o jogador planeje a próxima sessão. Limites tornam o progresso offline previsível e impedem acúmulo infinito.

### 5.6 Escassez

- Recursos nunca ficam negativos. Se a comida não cobre um intervalo, aplica-se só o disponível, registra-se o **momento exato** em que acabou (determinístico) e a partir dali: recrutamento e treinamento pausam, produção ×0,75, moral −2 por dia de jogo faminto.
- `[v0.2]` Após 12 h de fome contínua, 1 aldeão abandona o feudo por dia de jogo (não em dificuldade Camponês).
- A fome **não** destrói edifícios nem heróis. É uma pressão, não um game over.

### 5.7 Moral `[v0.2]`

Moral vai de 0 a 100 e é recalculada na virada de cada dia de jogo:

```
moral = 50
      + 10 se o estoque de comida cobre 24 h  |  −20 se há fome
      − 10 se população ≥ capacidade habitacional
      + 5 × nível da Taverna
      + 15 durante festival (dura 1 dia real)
      + 10 × relíquias de moral
      − 10 por incursão sofrida com perdas nos últimos 2 dias reais
      + ajustes de cartas (duram o que a carta disser)
      → limitar entre 0 e 100
```

Efeitos: multiplicador de produção (§5.3); moral ≥ 80 dá 20% de chance diária de um colono gratuito chegar (se houver vaga); moral ≤ 25 dá 20% de chance diária de um aldeão partir. Faixas exibidas: Desesperado (0–24), Inquieto (25–49), Contente (50–74), Orgulhoso (75–100).

### 5.8 Cálculo offline

Ao abrir a extensão ou antes de qualquer comando, o motor avança de `lastProcessedAt` até agora processando **segmentos entre eventos**: conclusão de obra, recrutamento, virada de dia de jogo, mudança de estação, chegada de expedição, incursão agendada. Dentro de cada segmento as taxas são constantes. Isso garante que avançar 10 h de uma vez produz o mesmo estado que avançar dez vezes 1 h (§14.2). Nunca usar timers que só rodam com o editor aberto como fonte de verdade.

### 5.9 Mercado `[v0.3]`

- **Mercado Nv1:** compra e venda de comida, madeira, pedra e ferro por ouro. Preços-base (em ouro por unidade): comida 1,0 · madeira 1,2 · pedra 2,0 · ferro 8,0. Spread de 15% entre compra e venda. Volume diário máximo: 200 × nível do Mercado por recurso (evita exploração).
- **Preços:** passeio aleatório diário de ±5% com reversão à média, mais efeitos sazonais (comida +30% no outono e inverno) e de cartas (boicote, caravana real).
- **Mercado Nv2 — Caravanas:** envie até 300 unidades a Porto do Rio (4 h de viagem, preço +40%). Risco de emboscada de 10% (zero com escolta de 1 herói; −5% por nível da Torre de Vigia).

---

## 6. Edifícios e construção

### 6.1 Catálogo

| Edifício | Pré-requisito | Nv máx | Função | Versão |
|---|---|---:|---|---|
| Salão do Senhor (`townHall`, "Prefeitura" na v0.1) | — | 8 | Portão de desbloqueios; recrutar aldeões; +5 de capacidade por nível; 2ª fila de obras no Nv4 | v0.1 |
| Fazenda | — | 10 | Comida | v0.1 |
| Serraria | — | 10 | Madeira | v0.1 |
| Pedreira | — | 10 | Pedra | v0.1 |
| Mina de Ouro | — | 10 | Ouro | v0.1 |
| Habitações | — | 10 | +5 de capacidade por nível | v0.1 |
| Celeiro | Salão 2 | 8 | Capacidade de comida | v0.2 |
| Armazém | Salão 2 | 8 | Capacidade de madeira, pedra e ferro | v0.2 |
| Torre de Vigia | Salão 2 | 5 | Revela mapa (raio 1 + nível/2); aviso prévio de incursão; presságios mais claros; a partir do Nv3 dispara contra inimigos (§10.4) | v0.2 |
| Paliçada / Muralha | Salão 3 | 6 | HP de muralha em batalha: Nv1–2 Paliçada (madeira), Nv3–4 Muralha de Pedra, Nv5–6 Baluarte | v0.2 (Nv1–2) / v0.4 |
| Taverna | Salão 3 | 5 | +5 moral por nível; rotação diária de heróis para contratar; festivais | v0.3 |
| Mercado | Salão 3 | 5 | Comércio; caravanas a partir do Nv2 | v0.3 |
| Guilda dos Aventureiros | Salão 3 | 5 | Expedições; expedições simultâneas = 1 + nível/2 (arredondado para baixo); gestão de equipamentos | v0.3 |
| Quartel | Salão 4 | 8 | Treinar soldados; limite de exército = 10 × nível; treino 5% mais rápido por nível | v0.4 |
| Ferreiro | Salão 4 | 6 | Armas (2 ferro + 1 madeira); reparo de equipamentos; +10% de produção de armas por nível | v0.4 |
| Capela | Salão 5 | 3 | 1 slot de relíquia por nível; +5 moral; heróis curam 25% mais rápido | v0.5 |
| Posto Avançado (no mapa) | Salão 5 | 3 | Reivindica um tile e produz o recurso dele | v0.5 |
| Academia | Salão 6 | 5 | Pesquisas (árvore curta, §17.3) | v0.6 |

Regra de gate: um edifício nunca pode ultrapassar `nível do Salão + 1`.

### 6.2 Custos e tempos

```
custo(nível)  = arredondar(custo_base × 1,6^(nível − 1))        (Salão usa 1,8)
tempo(nível)  = mín(8 h, tempo_base × 1,5^(nível − 1))
```

| Edifício | Custo base (Nv1→2 ou construção) | Tempo base |
|---|---|---:|
| Salão do Senhor | 150 madeira, 100 pedra, 100 ouro | 10 min |
| Fazenda | 80 madeira, 40 ouro | 5 min |
| Serraria | 100 madeira, 50 pedra | 5 min |
| Pedreira | 120 madeira, 30 ouro | 6 min |
| Mina de Ouro | 120 madeira, 80 pedra | 8 min |
| Habitações | 80 madeira, 20 pedra | 4 min |
| Celeiro / Armazém | 160 madeira, 80 pedra | 10 min |
| Torre de Vigia | 120 madeira, 120 pedra, 50 ouro | 12 min |
| Paliçada (Nv1) | 200 madeira, 50 pedra | 20 min |
| Muralha de Pedra (Nv3) | 300 madeira, 450 pedra | 1 h |
| Taverna | 180 madeira, 60 pedra, 120 ouro | 15 min |
| Mercado | 150 madeira, 100 pedra, 150 ouro | 15 min |
| Guilda dos Aventureiros | 300 madeira, 100 pedra, 200 ouro | 20 min |
| Quartel | 250 madeira, 150 pedra, 100 ouro | 20 min |
| Ferreiro | 200 madeira, 200 pedra, 150 ouro | 20 min |
| Capela | 200 madeira, 300 pedra, 200 ouro | 30 min |
| Posto Avançado | 250 madeira, 150 pedra, 100 ouro | 45 min |

O limite de 8 h garante que **nenhuma obra exige mais que uma noite**.

### 6.3 Regras de construção

- `[v0.1]` Uma fila com uma obra ativa. Outras melhorias podem ser **planejadas** (ficam na lista com custo visível) mas não começam sozinhas.
- `[v0.2]` Salão Nv4 abre uma segunda fila. Planejadas podem ser marcadas como **"iniciar quando houver recursos"** (começam automaticamente na virada de segmento em que os recursos existirem, na ordem da lista).
- Custos são descontados ao iniciar; o efeito vale só ao concluir. Cancelar devolve 80% dos recursos.
- Não é possível melhorar o mesmo edifício em duas filas ao mesmo tempo, nem iniciar sem recursos ou pré-requisitos.
- `[v0.4]` Obras de **reparo** (muralha e torres danificadas) custam 50% da pedra do nível atual e levam 15 min por 25% de HP; têm prioridade na fila.
- Toda conclusão gera uma linha na Crônica e, se a política de notificações permitir, um aviso.


---

## 7. Conselho do Feudo: cartas, dilemas e cadeias narrativas `[v0.2]`

O Conselho é o motor de **narrativa e variedade diária**. A cada 4 dias de jogo (8 h reais) o jogador recebe uma **carta**: uma situação com 2 ou 3 opções, cada uma com custos e consequências claras, algumas com efeitos adiados ou sigilosos ("há rumores de que…").

### 7.1 Regras

- Máximo de **2 cartas pendentes**. Com 2 pendentes, novas cartas não são sorteadas (o tempo "congela" para o Conselho, não para o mundo).
- Uma carta **expira em 24 h reais**; ao expirar, aplica-se a opção marcada como padrão (sempre a mais conservadora).
- Sorteio ponderado entre cartas **elegíveis**: estação, dia mínimo, edifícios existentes, nível do Salão, faixa de moral e **flags** (marcadores narrativos deixados por cartas anteriores). Cartas roteirizadas (ex.: a que entrega o primeiro herói) têm data fixa e furam o sorteio.
- Cada carta aparece **no máximo uma vez por ano**, exceto as marcadas como recorrentes (impostos, mercador).
- **Cadeias:** uma carta pode gravar uma flag que habilita uma continuação dias depois. Meta: 5 cadeias de 2–3 cartas no primeiro ano ("O Mercador Misterioso", "O Lobo Branco", "A Filha do Ferreiro", "Os Refugiados", "O Cobrador do Rei").
- Toda opção deve ser **a melhor em algum contexto**. Se uma opção é sempre dominante, a carta está mal escrita.
- Traços de heróis (§9.2) e edifícios podem **abrir opções extras** ("Negociar — requer herói Carismático").

### 7.2 Estrutura de dados (conceitual)

```ts
type CouncilCard = {
  id: string;                        // 'refugees_at_the_gate'
  title: string;
  text: string;                      // 2–4 frases, tom de crônica
  weight: number;                    // peso no sorteio
  recurring?: boolean;
  requires?: {
    seasons?: Season[]; minDay?: number; buildings?: Partial<Record<Building, number>>;
    flags?: string[]; notFlags?: string[]; moralRange?: [number, number]; heroTrait?: HeroTrait;
  };
  scripted?: { atGameDay: number };  // fura o sorteio
  options: Array<{
    id: string; label: string; isDefault?: boolean;
    requires?: { heroTrait?: HeroTrait; building?: Building; resources?: Partial<Record<Resource, number>> };
    effects: Effect[];               // recursos, moral (com duração), flags, spawnEvent (adiado), reveal, addHero, addUnits…
    hiddenEffects?: Effect[];        // revelados só no relatório, após a escolha
  }>;
};
```

Exemplos completos no Apêndice B. Meta de conteúdo para o primeiro ano: **60 cartas** (incluindo as 5 cadeias e 6 roteirizadas).

---

## 8. Mapa, exploração e ameaça

### 8.1 O mapa `[v0.5]` (dados e tiles de ameaça já existem de forma abstrata na `[v0.2]`)

- Grade **hexagonal** centrada em Pedra Alta, raio 3 no início (37 tiles), expandindo para raio 5 com a Torre de Vigia e expedições.
- Cada tile tem **estado de névoa**: Desconhecido → Avistado (tipo visível) → Explorado (detalhes e recompensas) → Reivindicado (posto avançado).
- Tipos de tile: Floresta, Colinas, Campos, Lago, Pântano, Ruínas, Veio de Ferro, Santuário, Covil de Lobos, Acampamento de Saqueadores, Fortaleza da Horda (surge no outono, sempre na borda norte).
- Revelação: Torre de Vigia revela anéis em volta do feudo; Patrulhas revelam tiles adjacentes aos já explorados; expedições exploram um tile específico.
- `[v0.5]` **Postos Avançados:** reivindicar um tile produz o recurso dele (Veio de Ferro: 3 ferro/h; Floresta: +15% madeira; Campos: +15% comida; Colinas: +15% pedra). Até 3 postos. Postos podem ser atacados por incursões (perdem produção até reparo).

Até a `v0.5`, o mapa gráfico não existe: tiles de ameaça e destinos de expedição aparecem como **listas** no painel. O motor já modela tiles desde a `v0.2` para que o mapa visual seja apenas uma camada de interface.

### 8.2 Ameaça e incursões `[v0.2 lobos]` `[v0.4 completo]`

- **Ameaça** (0–100) é exibida na Torre de Vigia. Sobe +5 por dia de jogo para cada tile de ameaça ativo (covil, acampamento) e +3 por dia de jogo no outono. Cai −30 ao limpar um tile e −10 ao repelir uma incursão.
- **Incursões roteirizadas** (sempre acontecem, ritmo Normal): lobos no dia 2 (leve), saqueadores no dia 3 (fraca), dia 4 (média), **ensaio do cerco** no dia 6 (forte, na Hora da Vigília).
- **Incursões por Ameaça:** a cada virada de dia de jogo, chance de incursão = `máx(0, Ameaça − 40) %`. Tamanho proporcional à Ameaça e à estação.
- A Torre de Vigia dá **aviso prévio**: 1 h por nível. O aviso diz o que os vigias conseguem ver (quanto mais nível, mais detalhes de composição).
- Incursões usam a **Formação de Defesa ativa**. Sem exército e sem paliçada, lobos e saqueadores levam até 15% de comida e madeira e ferem 1 aldeão (moral −10). Com paliçada e sem exército, a paliçada absorve o ataque leve; ataques médios ou mais causam dano à paliçada.
- Repelir incursões dá experiência aos heróis-comandantes e **informação**: o relatório mostra a composição inimiga completa, alimentando a leitura da Horda (§10.6).

### 8.3 Fortaleza da Horda `[v0.4]`

Surge no primeiro dia do outono. É a origem do Cerco. Expedições de **sabotagem** (§9.5) bem-sucedidas reduzem em 15% o tamanho de cada onda (máximo 3 sabotagens, −45%). Cada tentativa é cara e arriscada: heróis podem ser capturados. É a principal decisão estratégica do outono: **gastar os heróis agora para enfraquecer o inimigo, ou preservá-los para comandar as alas no cerco.**

---

## 9. Guilda, heróis e expedições com encruzilhadas `[v0.3]`

### 9.1 Heróis

- **Classes:** Guerreiro(a) (linha de frente, aura de defesa), Arqueiro(a) (batedor, aura de alcance), Mago(a) (dano em área, indispensável contra mortos-vivos), Clériga/Clérigo (cura, aura de moral). Novas classes chegam via Legado.
- **Atributos:** Vida, Ataque, Defesa, Velocidade, Perícia (exploração, armadilhas, saque), Vontade (moral, magia).
- **Nível 1–10**, XP de expedições e batalhas: `xp_para_subir(n) = 100 × n^1,5`. Cada nível: +8% nos atributos da classe.
- **Equipamento:** Arma, Armadura, Acessório. Raridades: Comum, Incomum, Raro, Épico (Lendário só a partir do Ano 2).
- **Traços:** 1–2 por herói (Apêndice D). Alteram opções de cartas, chances em encruzilhadas e auras.
- **Soldo:** 2 ouro/h por herói. Sem ouro por 12 h, o herói fica "Descontente" (−20% atributos) e, após 24 h, parte.
- **Ferimentos:** Leve (2 h de recuperação), Grave (12 h). **Morte** só na dificuldade Rei de Ferro. Nas demais, um desastre resulta em **Captura**, que gera a expedição especial "Resgate".
- Um herói faz uma coisa por vez: expedição **ou** comandante de ala **ou** descanso. Essa exclusividade é deliberada (ver §8.3).
- **Recrutamento:** a Taverna mostra 2–3 candidatos por dia com classe, traços e preço (80–300 ouro). O primeiro herói chega grátis pela carta roteirizada do dia 2.

### 9.2 Expedições

Uma expedição é um **grafo de nós** (3–5 de profundidade) percorrido por uma equipe de 1–4 heróis. Tipos de nó: Deslocamento, Encontro (combate), Descoberta (saque), **Encruzilhada** (escolha), Perigo (armadilha, clima), Acampamento (descanso, cura parcial), Chefe.

**Ciclo de vida:**

```
Planejada → Em viagem → [Nó] → … → Na Encruzilhada (aguarda jogador) → … → Retornando → Concluída (relatório)
```

- Cada nó dura de 10 a 45 min. A duração total aparece antes do envio.
- **Encruzilhada:** a expedição para e notifica ("Sua equipe chegou a uma bifurcação"). O jogador escolhe no painel da Guilda. Se não responder em **6 h**, a **Postura** da expedição decide: **Cautelosa** (opção segura), **Equilibrada** (melhor valor esperado), **Ousada** (maior recompensa). A Postura é escolhida no envio.
- **Resolução de nó:** `poder_da_equipe = Σ (ataque + defesa + vida/10) × modificadores de classe/traço/equipamento`. Compara-se com a `dificuldade` do nó: razão ≥ 1,3 → Sucesso Pleno; ≥ 1,0 → Sucesso; ≥ 0,7 → Revés (ferimento leve, saque parcial); abaixo → Desastre (ferimento grave ou captura, saque perdido). Um fator de sorte de ±15% vem do RNG com semente (§14.2). Traços deslocam a razão (Corajoso +10% em Ousada, etc.).
- **Recompensas:** recursos, equipamentos, relíquias, **plantas** (blueprints que desbloqueiam edifícios antes do nível do Salão), recrutas, revelação de tiles, presságios, XP.
- Guilda Nv1 permite 1 expedição simultânea; Nv2–3 permitem 2; Nv4–5 permitem 3.

### 9.3 Catálogo de expedições do primeiro ano

| Expedição | Duração | Nós | Requisitos | Risco | Recompensas típicas | Disponível |
|---|---:|---:|---|---|---|---|
| Patrulha dos Arredores | 15 min | 2 | 1 herói | Baixo | Ouro, XP, revela 1 tile adjacente | Dia 2 |
| Floresta Antiga | 1 h | 3 | 1–2 heróis | Baixo–médio | Madeira, peles (ouro), equipamento comum, ervas | Dia 2 |
| Covil dos Lobos | 2 h | 3 | 2 heróis | Médio | Remove tile de ameaça; peles; desencadeia "O Lobo Branco" | Dia 3 |
| Ruínas de Vel'Thar | 3 h | 4 | 2–3 heróis Nv≥2 | Médio | Pedra, ouro, item raro, planta da Capela | Dia 4 |
| Mina Abandonada | 4 h | 4 | 2 heróis, 1 Guerreiro | Médio | 40–80 ferro; risco de desabamento | Dia 4 |
| Acampamento de Saqueadores (ataque) | 3 h | 3 | Exército + 1 herói (usa o sistema de batalha, §10) | Alto | Saque; remove tile; −30 Ameaça | Dia 4 |
| Pântano Nebuloso | 5 h | 5 | 3 heróis, 1 Mago | Alto | Relíquia, item épico | Dia 5 |
| Sabotagem da Fortaleza da Horda | 6 h | 4 | 3 heróis Nv≥4 | Muito alto | −15% em todas as ondas do cerco; presságio completo | Outono |
| Resgate | 2 h | 2 | 2 heróis | Alto | Recupera herói capturado | Quando houver captura |
| Caçada ao Dragão | 8 h | 5 | 4 heróis Nv≥7 | Lendário | Equipamento lendário, relíquia | Ano 2+ |

Cada modelo tem **3 variantes** de grafo para não se repetir dentro do ano. Exemplo completo de grafo no Apêndice C.

### 9.4 Relatório de expedição

Narrado em tom de crônica, nó a nó: o que aconteceu, quem se destacou, o que foi encontrado, por que algo deu errado ("Rolf ignorou o aviso de Mira e pisou na laje solta"). Fecha com a lista de ganhos e perdas. O relatório é a recompensa emocional; precisa ser bom de ler.

### 9.5 Sabotagem da Horda

Expedição especial do outono. Cada nó bem-sucedido reduz uma onda; o chefe do grafo é um **Xamã** que, derrotado, revela a composição completa da onda 3. Desastre captura um herói e **alerta a Horda** (+10% na onda 1). Decisão central: até três sabotagens, cada uma ocupando 3 heróis por 6 h e com risco crescente (a Fortaleza reforça a guarda após cada tentativa).

---

## 10. Exército, formações e combate — a mecânica central `[v0.4]`

Inspirado em auto-battlers e em Into the Breach: **a decisão acontece antes**, a resolução é automática, determinística e explicada. O jogador não controla unidades em tempo real; ele monta a formação, lê o relatório e aprende.

### 10.1 O Campo de Batalha

```
                 ALA ESQUERDA     CENTRO        ALA DIREITA
Inimigo          Retaguarda       Retaguarda    Retaguarda
                 Frente           Frente        Frente
                 ───────────── MURALHA (defesa) ─────────────
Jogador          Frente           Frente        Frente
                 Retaguarda       Retaguarda    Retaguarda
Comandante       [herói]          [herói]       [herói]
```

- **3 alas × 2 linhas = 6 postos.** Cada posto recebe **um esquadrão**: um tipo de unidade e uma quantidade (máximo 20 por posto; o Quartel Nv5+ eleva para 30).
- **Frente** recebe os golpes de corpo a corpo. **Retaguarda** ataca à distância por cima da própria Frente e só é atingida quando a Frente da ala cai (ou por arqueiros inimigos).
- **Comandante:** 1 herói por ala, com aura (Guerreiro +15% defesa da ala; Arqueiro +15% dano à distância da ala; Mago dano em área a cada 3 rodadas e ×2 contra mortos-vivos; Clériga +20 moral e cura 10% da Frente a cada 2 rodadas).
- **Muralha** (só em defesa): HP dividido igualmente entre as 3 alas. Corpo a corpo inimigo bate na muralha até rompê-la; arqueiros inimigos ignoram a muralha mas sofrem ×0,7; arqueiros do jogador atrás de muralha intacta ganham ×1,2.
- **Torres** (Torre de Vigia Nv3+): dano à distância automático por ala a cada rodada (12 por nível acima de 2).

### 10.2 Unidades do jogador

| Unidade | Atq | Def | Vida | Iniciativa | Linha | Custo | Treino |
|---|---:|---:|---:|---:|---|---|---:|
| Lanceiro | 6 | 4 | 20 | 3 | Frente | 30 comida, 10 ouro, 5 madeira | 10 min |
| Espadachim | 8 | 5 | 24 | 3 | Frente | 40 comida, 20 ouro, 1 arma | 12 min |
| Arqueiro | 7 | 2 | 16 | 4 | Retaguarda | 30 comida, 15 ouro, 8 madeira | 10 min |
| Cavaleiro | 10 | 6 | 30 | 5 | Frente | 60 comida, 60 ouro, 1 arma | 15 min |
| Escudeiro | 3 | 9 | 30 | 2 | Frente | 40 comida, 15 ouro, 10 madeira, 5 pedra | 12 min |
| Miliciano | 3 | 2 | 12 | 2 | Frente | Aldeão convocado (§11.3) | Imediato |

Soldados **saem da população** (precisam de vaga habitacional e comem 1,5/h). Treinamento é sequencial no Quartel, em lotes de até 10.

**Ciclo de contra-ataques (×1,5 de dano):** Espadachim → Lanceiro → Cavaleiro → Arqueiro → Espadachim. Escudeiros não têm vantagem nem fraqueza e **protegem**: absorvem 50% do dano dirigido à Retaguarda da própria ala. Milicianos sofrem ×1,25 de qualquer inimigo.

### 10.3 Inimigos

| Inimigo | Arquétipo | Atq | Def | Vida | Inic | Regra especial |
|---|---|---:|---:|---:|---:|---|
| Lobo | Cavaleiro | 7 | 2 | 14 | 6 | Sempre ataca uma ala lateral; ×1,5 contra Arqueiro |
| Saqueador | Espadachim | 6 | 3 | 18 | 3 | — |
| Bandoleiro Arqueiro | Arqueiro | 6 | 2 | 14 | 4 | Retaguarda |
| Cavaleiro Negro | Cavaleiro | 10 | 6 | 30 | 5 | — |
| Ogro | — | 14 | 6 | 80 | 1 | Metade do seu dano ignora a muralha; recebe ×1,5 de Lanceiros |
| Esqueleto | Lanceiro | 5 | 4 | 16 | 2 | Sem moral; recebe ×2 de Mago e Clériga |
| Xamã | Apoio | 4 | 2 | 14 | 3 | Retaguarda; +20% de ataque para a própria ala |
| Senhor da Guerra (chefe) | — | 18 | 8 | 200 | 4 | Aura +25% para toda a Horda; derrotá-lo encerra a onda |

### 10.4 Resolução (até 12 rodadas)

```
para cada rodada:
  ordenar todos os esquadrões vivos por iniciativa (desc), desempate pelo lado defensor
  para cada esquadrão:
    alvo = Frente da ala oposta; se vazia, Retaguarda; se a ala oposta caiu → flanqueia o Centro (ou ala vizinha) com ×1,25
    se atacante é corpo a corpo e a muralha da ala está de pé: o dano vai para a muralha (Ogro: 50% muralha, 50% unidades)
    dano_bruto    = atq × n_atacantes × contra × aura × flanco × cobertura × sorte(0,9–1,1)
    absorvido     = def_alvo × n_alvos × 0,5
    dano_efetivo  = máx(dano_bruto − absorvido, dano_bruto × 0,2)      // ao menos 20% sempre passa
    baixas        = piso((dano_efetivo + dano_residual_do_esquadrão) / vida_unidade); o resto fica como dano residual
  Escudeiros redirecionam para si 50% do dano que atingiria a Retaguarda da própria ala
  Torres: dano fixo por ala; Mago: área a cada 3 rodadas; Clériga: cura a cada 2 rodadas
  moral: −10 por esquadrão destruído, −20 por ala caída, −15 se um comandante cai; ≤ 30 → debandada (fim)
fim:
  um lado sem esquadrões, debandada ou 12 rodadas
  em defesa, 12 rodadas = "Resistiu" (vitória do defensor); em ataque, 12 rodadas = atacante recua
```

Mortos-vivos e o Senhor da Guerra não têm moral. Heróis-comandantes recebem dano apenas quando a Frente da ala cai; podem ser **feridos**, nunca mortos fora de Rei de Ferro.

### 10.5 Conselho de Guerra (prévia)

Antes de salvar a formação, o jogador pode **Simular**: o motor roda 200 batalhas com sementes fixas, preenchendo o que não se sabe do inimigo com amostras da composição provável (presságios e vigias reduzem a incerteza). Saída:

- Vitória %, Vitória Gloriosa % (sem brecha na muralha), Derrota %.
- **Risco principal**, em uma frase gerada a partir da atribuição de dano ("ala esquerda: lobos superam arqueiros desprotegidos").
- Perdas esperadas por posto.

A prévia **ensina** o sistema. Ela usa o mesmo código da batalha real (nunca uma heurística separada), por isso nunca mente dentro do que é conhecido.

### 10.6 A Horda aprende

Depois de cada batalha, a Horda guarda a **composição que você usou**. A próxima incursão (e as ondas do cerco) é gerada assim:

```
peso(tipo_inimigo) = peso_base(estação, ano) + astúcia × peso_de_contra(tipo_inimigo, sua_última_formação)
astúcia: Camponês 0,3 · Senhor 0,5 · Rei de Ferro 0,8
```

Consequências de design:

- Repetir a mesma formação é punido progressivamente. O jogador precisa **ler o relatório e adaptar**.
- **Finta:** como a Horda reage à **última** formação vista, o jogador pode usar uma formação-isca na incursão do dia 6 (cheia de arqueiros, por exemplo) para que o cerco traga lobos e cavalaria, e então defender com lanceiros e escudeiros. Isso é intencional e deve ser descoberto, não explicado no tutorial.
- Presságios (§11.1) e sabotagens revelam parte do que a Horda planeja, fechando o ciclo: observar → antecipar → formar → ler o relatório.

### 10.7 Relatório de batalha

Resumo por rodada (colapsável) e, no topo, os **três fatores decisivos** calculados pela atribuição de dano (ex.: "1. Muralha de pedra absorveu 48% do dano inimigo. 2. Lanceiros à direita contra-atacaram a cavalaria (×1,5). 3. Retaguarda esquerda exposta na rodada 5."). Baixas, dano à muralha, XP dos comandantes, saque. Botão **"Ajustar formação"** leva direto ao editor com a formação usada.

### 10.8 Formações salvas e Plano de Batalha

- O jogador salva formações com nome ("Muralha Firme", "Anticavalaria") e marca uma como **Defesa ativa**.
- `[v0.4]` **Plano de Batalha** para o cerco: uma formação por onda, decidida antes. Se o jogador estiver presente, pode trocar entre ondas (60 min de intervalo); se não, o plano vale. Estar presente é uma vantagem, não uma exigência.
- Postos vazios por falta de unidades são preenchidos com uma mensagem de alerta na prévia, nunca silenciosamente.

### 10.9 Batalhas ofensivas

Atacar um Acampamento de Saqueadores ou um Covil usa o mesmo sistema, sem muralha do lado do jogador e com a muralha (paliçada do acampamento) do lado inimigo. O exército viaja (tempo do tile) e fica indisponível para defesa até voltar: outra decisão com custo.

---

## 11. O Cerco do Inverno, a Crônica do Ano e o Legado

### 11.1 Presságios `[v0.4]`

A partir do primeiro dia do outono, a cada dia de jogo há 35% de chance (+10% por nível da Torre de Vigia acima de 1) de um **Presságio**: uma frase de crônica que revela algo das ondas do cerco. Clareza por nível da Torre: Nv1 "muitas feras"; Nv3 "cerca de 30 lobos na ala esquerda da segunda onda"; Nv5 composição exata de uma onda. Sabotagens e desertores (carta) também revelam. Presságios ficam listados no painel do Exército ao lado do editor de formação.

### 11.2 O Cerco `[v0.4]`

| Onda | Tamanho base (Senhor) | Composição típica (antes da adaptação) |
|---|---:|---|
| 1 — "Os Saqueadores" | 40 unidades | Saqueadores, Bandoleiros Arqueiros, 1 Xamã |
| 2 — "As Feras" | 60 unidades | Lobos, Ogros, Saqueadores |
| 3 — "A Longa Noite" | 80 unidades + Senhor da Guerra | Cavaleiros Negros, Esqueletos, Xamãs, chefe no Centro |

```
tamanho_da_onda = base × dificuldade × (1 − 0,15 × sabotagens_bem_sucedidas) × (1 + 0,10 × anos_anteriores) × votos
dificuldade: Camponês 0,7 · Senhor 1,0 · Rei de Ferro 1,3
```

- Ondas a cada **60 min** a partir da Hora da Vigília (§4.3). Dano na muralha persiste entre ondas; reparos de emergência custam pedra e levam 15 min por 25% de HP (só se o jogador estiver presente, ou pré-agendados no Plano).
- **Resultados:** **Vitória Gloriosa** (nenhuma ala rompida em nenhuma onda), **Vitória** (resistiu com brechas), **Queda** (uma onda venceu). A Queda custa 30% dos recursos, 20% da população, destrói a muralha e dana 2 edifícios (−2 níveis cada). Nunca há game over: "Pedra Alta sobrevive em ruínas" e o Ano 2 começa com a Primavera da Reconstrução (custos ×0,8 por 2 dias).
- Derrotar o Senhor da Guerra encerra a onda 3 imediatamente e vale um Feito.

### 11.3 Milícia `[v0.4]`

Durante incursões fortes e o cerco, o jogador pode **convocar a milícia**: até 50% dos aldeões viram Milicianos (3/2/12). Enquanto convocados, não produzem. Sobreviventes voltam ao trabalho; perdas reduzem a população. É a carta desesperada que torna a última onda dramática.

### 11.4 Rescaldo e Crônica do Ano `[v0.4]`

Após o cerco até o fim do inverno: reparos com desconto, luto (moral −10 por 1 dia se houve mortos) ou festa (moral +15 se Vitória Gloriosa). Às 168 h publica-se a **Crônica do Ano**: narrativa gerada a partir do log (Apêndice E), estatísticas (população máxima, batalhas, expedições, cartas), **pontuação** e Feitos. Pode ser exportada como Markdown no editor (§13.6). O jogador pode **"Avançar para o Degelo"** logo após o cerco para não esperar.

### 11.5 Legado e anos seguintes `[v0.5]`

- **Legado:** pontos ganhos pela pontuação do ano e por Feitos. Gastos entre anos em desbloqueios **permanentes de conta** (não de bônus de poder): novos cenários (Vale das Brumas, Costa Salgada, Serra do Ferro), novas classes de herói, novos tipos de unidade, estilos de Crônica, e **Votos**.
- **Votos:** modificadores escolhidos no início do ano que aumentam a dificuldade e o Legado: "Sem muralhas" (+40%), "Inverno longo (2 dias)" (+30%), "Horda astuta (astúcia 0,8)" (+25%), "Comida escassa (×0,8)" (+20%), "Heróis mortais" (+35%).
- **Anos seguintes:** o feudo continua (edifícios, heróis, exército), com ondas +10% por ano, novos inimigos a partir do Ano 2 (Trolls, Necromante) e expedições lendárias. A Horda **lembra** das formações do ano anterior com peso reduzido.
- **Semente da partida:** toda partida tem uma semente visível. Duas partidas com a mesma semente e o mesmo ritmo têm o mesmo mapa, as mesmas cartas elegíveis e a mesma Horda base. Permite "desafios da semana" entre amigos sem servidor.


---

## 12. Dificuldade, objetivos e tutorial

### 12.1 Dificuldades `[v0.2]`

| | Camponês | Senhor (padrão) | Rei de Ferro |
|---|---|---|---|
| Tamanho das ondas | ×0,7 | ×1,0 | ×1,3 |
| Astúcia da Horda | 0,3 | 0,5 | 0,8 |
| Fome faz aldeões partirem | Não | Sim | Sim |
| Heróis podem morrer | Não | Não (captura) | **Sim** |
| Capacidade de armazenamento | ×1,25 | ×1,0 | ×0,8 |
| Cartas: opção padrão ao expirar | Sempre a melhor | Conservadora | Pior |
| Legado | ×0,5 | ×1,0 | ×1,5 |

### 12.2 Objetivos do Senhor (tutorial vivo) `[v0.1 básico]` `[v0.2 completo]`

Uma lista curta de objetivos sempre visível no painel, com recompensas pequenas e texto que **ensina o porquê**. Nunca mais de 3 ativos; concluir um revela o próximo. Os primeiros 15 cobrem os dias 1–3:

1. Aloque 2 aldeões na Fazenda ("comida é o que mantém todo o resto") → +20 ouro
2. Inicie a melhoria das Habitações → +30 madeira
3. Recrute 3 aldeões → +40 comida
4. Alcance Salão Nv2 → desbloqueio: Celeiro, Armazém, Torre de Vigia
5. Construa a Torre de Vigia ("ver o inimigo é metade da batalha") → revela 6 tiles
6. Responda à primeira carta do Conselho → +10 moral
7. Contrate ou acolha o primeiro herói → equipamento comum
8. Envie uma Patrulha → +50 ouro
9. Construa a Paliçada → +100 madeira
10. Alcance Salão Nv4 → desbloqueio: Quartel, Ferreiro
11. Treine 10 soldados → 1 arma
12. Salve uma Formação de Defesa → presságio gratuito
13. Simule uma batalha no Conselho de Guerra → +20 ouro
14. Repila uma incursão → +XP para o comandante
15. Explore um tile de Ruínas → item incomum

Depois do 15º, os objetivos passam a ser **sazonais** (outono: "Estoque 1.000 comida", "Sabote a Horda uma vez") e **anuais** (Feitos, Apêndice E).

### 12.3 Tutorial

Não há tutorial em telas. O tutorial são: os Objetivos, os tooltips em todos os números, a carta roteirizada do dia 2, a incursão leve de lobos (a derrota custa pouco e ensina a paliçada) e a prévia do Conselho de Guerra, que explica o risco em uma frase.

---

## 13. Interface e experiência no VS Code

O jogo deve parecer uma ferramenta nativa: usa os tokens de tema do VS Code (`--vscode-*`), codicons, fontes do editor, e funciona 100% com mouse **e** 100% com teclado. Nenhum terminal, nenhum arquivo para editar.

### 13.1 Mapa de superfícies

| Superfície | Uso |
|---|---|
| **Activity Bar** | Ícone próprio abre a view "Lords of the Guild" |
| **Side Bar / TreeView** | Navegação, resumo e **badges** de pendências; ações inline nos itens |
| **Webview (painel central)** | Um único WebviewPanel com abas internas: Feudo, Mapa, Exército, Guilda, Conselho, Mercado, Crônica |
| **Status Bar** | Uma linha, uma prioridade: cerco > decisões pendentes > obra > alerta de comida |
| **Notificações** | Com botões de ação; política configurável (§13.5) |
| **Command Palette / QuickPick** | Todas as ações principais como comandos `Lords: …`, com QuickPicks para alocar, construir, enviar expedição |
| **Editor** | Só para abrir a Crônica exportada em Markdown (opcional) |

### 13.2 TreeView

```
LORDS OF THE GUILD
├── Hoje em Pedra Alta                        ● 2 decisões
├── Feudo: Pedra Alta · Outono, dia 9
│   ├── Recursos        comida 412/1500 (+29/h) · madeira 655/900 ⚠ cheio em 4h
│   ├── Trabalhadores   14/18 alocados · 4 livres
│   ├── Construções     Muralha Nv2→3 · 00:42
│   └── Conselho        1 carta pendente (expira em 14h)
├── Mapa                3 tiles por explorar perto · Ameaça 42
├── Exército            28 soldados · Defesa: "Muralha Firme" · Cerco em 2d 05h
├── Guilda              3 heróis · 1 expedição na encruzilhada
├── Mercado             comida 1,3 ▲ · ferro 7,6 ▼
├── Crônica             último: "Os lobos recuaram diante da paliçada"
└── Configurações
```

Clique em um item abre a aba correspondente do painel. Itens com pendência exibem badge. Menu de contexto nos edifícios ("Melhorar", "Planejar") e nos heróis ("Enviar em expedição", "Nomear comandante").

### 13.3 Painel do Feudo (aba padrão)

```
PEDRA ALTA · Salão Nv3 · Outono, dia 9 do Ano 1          ⚠ Cerco em 2d 05h   Ameaça 42
Moral 68 (Contente) · Aldeões 18 · Soldados 28 · Habitação 46/50 · Livres 4 · Heróis 3

RECURSOS        ESTOQUE   CAP    /HORA   TENDÊNCIA
Comida            412    1500    +29     cheio em 37h
Madeira           655     900    +55     cheio em 4h ⚠
Pedra             210     900    +22
Ferro              24     900     +0
Ouro              318      —     +13     (soldos de heróis: −6/h incluídos)
Armas               6      —      +0

TRABALHADORES (14/18)                     CONSTRUÇÕES
Fazenda   Nv3   4  [−][+]   89/h          ▶ Muralha Nv2 → Nv3 (pedra)                 00:42   [Cancelar]
Serraria  Nv3   4  [−][+]   55/h          ○ Torre de Vigia Nv2 → Nv3 (planejada)      192 madeira, 192 pedra, 80 ouro  [Iniciar quando houver]
Pedreira  Nv2   3  [−][+]   22/h
Mina      Nv2   3  [−][+]   19/h          DISPONÍVEL
Ferreiro  Nv1   0  [−][+]    0/h          Celeiro Nv2 → Nv3    256 madeira, 128 pedra · 15 min
                                          Quartel Nv3 → Nv4    1.024 madeira, 614 pedra, 410 ouro · 1h08

DECISÕES PENDENTES (2)
• Conselho: "Desertores da Horda"                    expira em 14h    [Decidir]
• Expedição "Ruínas de Vel'Thar" na encruzilhada     postura assume em 4h40   [Escolher caminho]

OBJETIVOS
☑ Construa a Paliçada   ☐ Treine 20 soldados (12/20)   ☐ Explore um tile de Ruínas
```

Tooltips explicam cada número: *"Comida +29/h = 4 trabalhadores × 10 × 1,4 (Nv3) × 1,3 (outono) × 1,09 (moral 68) × 1,12 (mestria 40) = 89/h, menos 18 aldeões × 1 e 28 soldados × 1,5"*. As taxas por edifício mostram a produção bruta; a tabela de recursos mostra a líquida.

### 13.4 Aba Exército — editor de formação

```
CAMPO DE BATALHA — Defesa de Pedra Alta       Formação: "Muralha Firme" ▾   [Salvar]  [Simular]  [Plano do Cerco]
Muralha Nv2 (Paliçada) · 600 HP por ala · Torre Nv2 (sem disparo; Nv3 ativa torres)

                 ALA ESQUERDA          CENTRO                  ALA DIREITA
Inimigo (prev.)  Lobos ~10 ?           Saqueadores 18          Cav. Negros ~6 (presságio)
                 ?                     Bandoleiros Arq. 8      ?
                 ───────────────────── MURALHA ─────────────────────
Frente           Lanceiros 4 ▾         Escudeiros 5 ▾          Lanceiros 5 ▾
Retaguarda       Arqueiros 5 ▾         Arqueiros 6 ▾           [vazio] ▾
Comandante       — ▾                   Edda (Guerreira) ▾      Rolf (Arqueiro) ▾

Reserva: Espadachins 3                                       Presságios (3) ▸

CONSELHO DE GUERRA (200 simulações)
Vitória 71% · Gloriosa 24% · Derrota 29%
Risco principal: ala esquerda — lobos superam arqueiros desprotegidos. Sugestão: Lanceiros ou Escudeiros à frente.
```

Interação: clique no posto abre um seletor (tipo + quantidade com slider/teclado); setas movem o foco entre postos; `Enter` edita; arrastar e soltar é opcional. O painel inimigo mostra `?` onde a informação não existe.

### 13.5 Status Bar e notificações

- Status Bar (um item, à esquerda): `$(shield) Cerco em 1d 03h · $(bell) 2` → clique abre o painel. Sem pendências: `$(home) Pedra Alta · Muralha 00:42`.
- **Modo discreto** (comando e configuração): o item vira apenas `$(circle-filled) 2h14` e todas as notificações são suprimidas. Para quem joga no trabalho.
- Política de notificações: **Silenciosa** (nada), **Essenciais** (padrão: cerco, incursão, encruzilhada, carta nova, herói capturado), **Todas** (inclui obras e treinos). Limite de 3 notificações por hora; o excedente vira badge.
- Toda notificação tem botões: `[Ver]` `[Decidir]` `[Silenciar 2h]`.
- **Relatório de Retorno:** ao abrir após 4 h ou mais ausente, o painel abre na aba "Hoje" com o resumo.

### 13.6 Comandos (Command Palette)

`Lords: Abrir painel` · `Lords: Alocar trabalhadores…` · `Lords: Construir ou melhorar…` · `Lords: Recrutar aldeões…` · `Lords: Enviar expedição…` · `Lords: Decidir carta do Conselho` · `Lords: Editar formação de defesa` · `Lords: Simular batalha` · `Lords: Exportar Crônica (Markdown)` · `Lords: Modo discreto` · `Lords: Nova partida…` · `Lords: Reiniciar partida` (com confirmação) · `Lords: Exportar/Importar partida`.

Os QuickPicks permitem jogar inteiramente pelo teclado: `Alocar trabalhadores` mostra cada edifício com `+`/`−` e a taxa resultante em tempo real.

### 13.7 Acessibilidade e tema

Navegação por teclado em todos os painéis (ordem lógica, foco visível), ARIA nos grids, nada comunicado só por cor (ícones e texto acompanham), contraste conforme o tema ativo, `prefers-reduced-motion` respeitado (animações são zero por padrão), números formatados em pt-BR, textos sem truncamento em larguras a partir de 480 px (painel lateral estreito).

### 13.8 Som

Nenhum por padrão. Opcional (`[v0.6]`): três sons curtos (carta, encruzilhada, cerco), desativados até o jogador ligar.

---

## 14. Arquitetura, determinismo e dados

### 14.1 Pacotes

```
lords-of-the-guild/
├── package.json                 # workspaces
├── GAME_DESIGN.md
├── packages/
│   ├── engine/                  # motor puro em TypeScript: estado, comandos, advanceTo, batalha, expedições, RNG
│   ├── content/                 # dados: balance, buildings, units, enemies, cards, missions, omens, chronicle (+ schemas zod)
│   ├── sim-cli/                 # simulador headless e bots de playtest (§15.3)
│   ├── extension/               # VS Code: ativação, TreeView, status bar, notificações, persistência, scheduler
│   └── webview/                 # UI: TypeScript + Preact (permitido pelo tamanho; nada além disso)
└── tests/                       # testes de integração extensão↔motor
```

`engine` e `content` **não importam nada do VS Code**. A `extension` traduz tempo real em tempo de jogo, persiste e exibe. A `webview` só envia comandos e renderiza o estado recebido.

### 14.2 Determinismo

1. **Tempo de jogo** em milissegundos inteiros. `advanceTo(state, t)` processa a **linha do tempo de eventos** (conclusões, viradas de dia, estações, chegadas, incursões) em ordem, aplicando produção contínua por segmento. Invariante testada por propriedade: `advanceTo(t2)` ≡ `advanceTo(t1)` seguido de `advanceTo(t2)` para qualquer `t1` intermediário.
2. **Aritmética inteira** para recursos: estoques em milésimos; produção por segmento acumula `taxa × ms` em um acumulador por recurso e converte com divisão inteira, carregando o resto. Isso torna o invariante acima **exato**, sem tolerância de ponto flutuante.
3. **RNG com semente e fluxos nomeados** (`council`, `market`, `omens`, `expedition:<id>`, `battle:<id>`, `horde`), cada fluxo com estado próprio dentro do `GameState`. A ordem de processamento de um subsistema não altera o sorteio de outro. Algoritmo sugerido: xoshiro128** ou mulberry32.
4. **Comandos** são a única forma de mudar o estado além de `advanceTo`. Cada comando é validado (recursos, pré-requisitos, limites) e rejeitado com um motivo legível, que a UI mostra. Antes de qualquer comando, `advanceTo(agora)`.
5. **Prévia** (Conselho de Guerra) usa o mesmo `resolveBattle` com sementes derivadas de `hash(seed, 'preview', i)`.

### 14.3 Conteúdo como dados

Tudo que é número ou texto de jogo vive em `packages/content`: `balance.ts` (taxas, fórmulas parametrizadas), `buildings.ts`, `units.ts`, `enemies.ts`, `cards/*.json`, `missions/*.json`, `omens.json`, `chronicle/*.json`, `objectives.json`, `achievements.json`. Schemas **zod** validam todo o conteúdo em teste: flags referenciadas existem, grafos de expedição são acíclicos e têm saída, ciclo de contra-ataques está completo, toda carta tem exatamente uma opção padrão.

### 14.4 Persistência

- Arquivo JSON em `context.globalStorageUri` (`save.json` + `save.bak` rotativo), não `globalState`, porque o estado cresce (mapa, Crônica, histórico da Horda). `globalState` guarda só preferências.
- Salvar após cada comando e a cada 60 s com o editor aberto. Escrita atômica (arquivo temporário + rename).
- `schemaVersion` com **migrações encadeadas** (`migrate_1_to_2`, …). Testes carregam saves de versões antigas.
- Crônica limitada a 2.000 linhas por ano; anos anteriores ficam resumidos.
- Exportar/Importar partida (JSON) para suporte, backup e desafios por semente.

### 14.5 Scheduler na extensão

Com o editor aberto, um `setInterval` de 30 s chama `advanceTo(agora)`, difunde o estado para a Webview e a TreeView e converte eventos do motor em notificações conforme a política. Com o editor fechado, nada roda; a próxima abertura faz o catch-up. O motor devolve eventos ("obra concluída", "encruzilhada", "cerco em 1 h") e a extensão decide o que mostrar.

### 14.6 Modelo de dados (conceitual)

```ts
type Resource = 'food' | 'wood' | 'stone' | 'gold' | 'iron' | 'weapons';
type Season = 'spring' | 'summer' | 'autumn' | 'winter';
type UnitType = 'spearman' | 'swordsman' | 'archer' | 'knight' | 'shieldbearer' | 'militia';
type Wing = 'left' | 'center' | 'right'; type Row = 'front' | 'back';

type GameState = {
  schemaVersion: number;
  seed: string; difficulty: 'peasant' | 'lord' | 'ironKing'; timeScale: 1 | 2 | 0.5;
  clock: { gameTimeMs: number; yearStartMs: number; year: number };
  lastProcessedAt: number;                                   // tempo de jogo
  rng: Record<string, number[]>;                             // estado por fluxo
  settlement: {
    name: string; moral: number;
    resources: Record<Resource, number>;                     // milésimos
    accumulators: Record<Resource, number>;
    caps: Record<Resource, number | null>;
    population: { villagers: number; soldiers: number; recruitsInTraining: number };
    workers: Record<Building, number>;
    craftExperience: Record<Building, number>;
    adaptation: Array<{ building: Building; count: number; untilMs: number }>;
    buildings: Record<Building, number>;
    wallHp: Record<Wing, number>;
    constructionQueues: Array<null | { building: Building; targetLevel: number; startedAtMs: number; finishesAtMs: number; isRepair?: boolean }>;
    planned: Array<{ building: Building; targetLevel: number; autoStart: boolean }>;
    recruitmentQueue: Array<{ quantity: number; finishesAtMs: number }>;
  };
  council: { pending: Array<{ cardId: string; drawnAtMs: number; expiresAtMs: number }>; flags: Record<string, true>; seen: string[]; nextDrawAtMs: number };
  map: { radius: number; tiles: Record<string, { type: TileType; fog: 'unknown' | 'sighted' | 'explored' | 'claimed'; threatActive?: boolean; outpostLevel?: number }>; threat: number };
  guild: { heroes: Hero[]; expeditions: Expedition[]; tavernOffers: Array<{ hero: Hero; price: number; untilMs: number }> };
  army: { units: Record<UnitType, number>; trainingQueue: Array<{ unit: UnitType; remaining: number; finishesAtMs: number }>;
          formations: Array<{ id: string; name: string; slots: Record<`${Wing}:${Row}`, null | { unit: UnitType; count: number }>; commanders: Record<Wing, string | null> }>;
          activeDefenseId: string | null; siegePlan: Record<1 | 2 | 3, string | null> };
  horde: { memory: Array<Record<UnitType, number>>; scheduledRaids: Array<{ atMs: number; kind: 'scripted' | 'threat' | 'siegeWave'; wave?: 1 | 2 | 3; composition?: EnemyComposition }>; sabotages: number; omens: Omen[] };
  market: { prices: Record<Exclude<Resource, 'gold' | 'weapons'>, number>; tradedToday: Record<Resource, number>; caravans: Caravan[] };
  objectives: { active: string[]; completed: string[] };
  chronicle: Array<{ atMs: number; kind: string; text: string; data?: unknown }>;
  legacy: { points: number; unlocked: string[]; vows: string[] };
  stats: Record<string, number>;
};
```

Capacidade habitacional, limite de exército e caps de armazenamento são **derivados** dos edifícios em funções puras, nunca persistidos.

### 14.7 Comunicação Webview ↔ extensão

Mensagens tipadas como uniões discriminadas (`{ type: 'command', command: Command }` / `{ type: 'state', state: ViewState }` / `{ type: 'error', reason }`). A Webview recebe um **ViewState** derivado (já com taxas, tempos restantes e textos formatados), não o `GameState` bruto. Toda validação acontece no motor.

### 14.8 Multiplayer futuro (não construir agora)

Backend Node.js (NestJS ou Fastify) com PostgreSQL; simulação e validação de comandos **no servidor**, reusando o pacote `engine` sem alterações; idempotência por `commandId`; autenticação; o cliente VS Code vira um "terminal" do mesmo motor. A separação `engine`/`extension` existe para isso. Alianças e PvP só depois de economia, combate e proteção de contas estáveis.

---

## 15. Balanceamento, testes de diversão e simulador

### 15.1 Regras de diversão (checklist de design)

1. Toda sessão tem ao menos uma decisão com custo de oportunidade visível.
2. Nenhuma espera obrigatória maior que 8 h até a próxima ação significativa.
3. Pelo menos uma novidade (sistema, carta de cadeia, inimigo, tile) por dia real na primeira semana.
4. A tensão sobe: Ameaça visível, incursões crescentes, presságios, contagem para o cerco.
5. Voltar é recompensado; faltar nunca destrói nada fora de Rei de Ferro.
6. Todo número é explicável em um tooltip; toda batalha tem três fatores decisivos.
7. Todas as ações principais a no máximo dois cliques (ou um comando) do painel.
8. Nenhuma opção de carta ou formação é dominante em todos os contextos.

### 15.2 Metas de balanceamento (ritmo Normal, dificuldade Senhor)

| Perfil | Comportamento | Meta no cerco |
|---|---|---|
| Preguiçoso | 1 sessão/dia de 5 min, decisões razoáveis | 40–60% de Vitória |
| Regular | 2 sessões/dia de 10 min | 65–80% de Vitória, 20–30% Gloriosa |
| Dedicado | 4+ sessões/dia, finta e sabotagens | 90%+ de Vitória, 50%+ Gloriosa |
| Regular em Rei de Ferro | 2 sessões/dia | 35–50% de Vitória |

Outras metas: população 30–40 no dia 7 (Regular); primeiro herói no dia 2; primeira formação salva no dia 3; nenhum recurso acima do cap por mais de 8 h para o perfil Regular.

### 15.3 Simulador headless (`sim-cli`)

Bots com estratégias (`econômico`, `militar`, `explorador`, `preguiçoso`) jogam anos inteiros em segundos, emitindo CSV com recursos, população, exército, resultado do cerco e Legado por semente. Um teste de CI roda 50 sementes por perfil e falha se as metas da §15.2 saírem da faixa. É assim que os números deste documento serão corrigidos, não por achismo.

### 15.4 Testes automatizados

- **Unitários:** produção, consumo, custos, gates, filas, escassez, moral, cartas, expedições, batalha (tabelas de contra-ataque, muralha, flanco, moral).
- **Propriedade (fast-check):** invariante de `advanceTo` por segmentos; recursos nunca negativos nem acima do cap; nenhum comando duplica recursos.
- **Golden tests:** relatórios de batalha e de expedição para sementes fixas (qualquer mudança de regra é visível no diff).
- **Conteúdo:** schemas zod em todo JSON; grafos acíclicos; flags consistentes.
- **Migração:** saves antigos carregam.
- **Integração:** comandos da extensão disparam o motor e atualizam o ViewState.

### 15.5 Métricas locais (opt-in)

Sem telemetria por padrão. Opcionalmente, estatísticas locais (sessões/dia, duração, decisões por sessão, dia do primeiro herói, resultado do cerco) visíveis na aba Crônica, para o próprio jogador e para playtests.

---

## 16. Roadmap, escopo por versão e critérios de aceitação

| Versão | Nome | Entrega | O que o jogador sente |
|---|---|---|---|
| v0.1 | Fundação | Economia, construção, trabalhadores, offline, calendário visível, Objetivos básicos, Crônica simples | "Minha aldeia cresce enquanto trabalho" |
| v0.2 | Estações e Conselho | Estações, armazenamento, moral, troca de ofício, cartas e cadeias, Torre de Vigia, Paliçada, lobos, dificuldade, ritmo | "O mundo muda e me pede decisões" |
| v0.3 | Guilda | Taverna, heróis, expedições com encruzilhadas, Mercado e caravanas, Mestres | "Tenho uma equipe e histórias para contar" |
| v0.4 | Guerra e Cerco | Quartel, Ferreiro, ferro e armas, Muralha, formações, Conselho de Guerra, Horda adaptativa, presságios, Fortaleza e sabotagem, Cerco, milícia, Crônica do Ano | **A semana completa.** "Passei a semana me preparando e valeu" |
| v0.5 | Mundo e Legado | Mapa hexagonal, postos avançados, Capela e relíquias, Legado, Votos, anos seguintes, sementes | "Quero jogar o Ano 2 de outro jeito" |
| v0.6 | Polimento | Academia, Feitos completos, som opcional, acessibilidade auditada, desempenho, localização en-US | Pronto para o Marketplace |
| v1.0 | Multiplayer | Contas, alianças, economia compartilhada, PvP | Mundo persistente |

### 16.1 Escopo exato da v0.1 — Fundação

**Implementar:**

- [ ] Extensão com Activity Bar, TreeView, WebviewPanel e Status Bar.
- [ ] Estado inicial reproduzível de Pedra Alta com semente.
- [ ] Recursos comida, madeira, pedra e ouro; alocação e realocação de aldeões (grátis nesta versão).
- [ ] Produção e consumo contínuos com `advanceTo` por segmentos, aritmética inteira e invariante de divisão de intervalo testado.
- [ ] Calendário: estação e dia de jogo visíveis (sem efeitos de estação ainda); `timeScale` fixo em 1.
- [ ] Salão do Senhor, Fazenda, Serraria, Pedreira, Mina, Habitações com níveis, custos e tempos vindos de `content`.
- [ ] Uma fila de obra ativa, planejamento visual, cancelamento com devolução de 80%.
- [ ] Recrutamento com limite habitacional, custo e fila.
- [ ] Escassez determinística (§5.6, sem abandono de aldeões).
- [ ] Objetivos 1–4 da §12.2.
- [ ] Crônica simples (log de eventos) e Relatório de Retorno após 4 h.
- [ ] Persistência em `globalStorageUri` com `schemaVersion` e `save.bak`.
- [ ] Comandos da Command Palette para abrir painel, alocar, construir, recrutar e reiniciar (com confirmação).
- [ ] Testes unitários e de propriedade do motor; teste de conteúdo com zod.

**Não implementar:** estações com efeito, cartas, heróis, exército, mapa, mercado, multiplayer, som.

**Critérios de aceitação:**

1. Instalar, abrir o painel e encontrar uma partida nova sem configuração.
2. Alocar um trabalhador a mais na Serraria altera a taxa de madeira/h imediatamente e reduz os livres.
3. Não é possível alocar mais que a população nem gastar o que não existe; o motivo da recusa aparece na UI.
4. Uma melhoria desconta recursos uma única vez, ocupa a fila e conclui no tempo configurado.
5. Fechar e reabrir o VS Code depois de horas simula o intervalo sem duplicar progresso; `advanceTo` por partes dá o mesmo resultado que de uma vez (teste de propriedade).
6. Escassez tratada corretamente em longos períodos offline, com o momento exato registrado na Crônica.
7. Salvar e recarregar não duplica nada; o reset só acontece após confirmação.
8. Todas as regras rodam em testes sem o VS Code aberto.
9. O painel respeita tema claro e escuro e é navegável por teclado.

### 16.2 Critérios de aceitação das versões seguintes (resumo)

- **v0.2:** o estoque para no cap e o painel mostra "cheio em"; uma carta aparece a cada 8 h e expira em 24 h com a opção padrão; uma cadeia de 3 cartas funciona ponta a ponta; a incursão de lobos do dia 2 acontece offline e aparece no Relatório; a troca de ofício reduz a produção por 2 h; dificuldade e ritmo são escolhidos na criação.
- **v0.3:** o primeiro herói chega pela carta do dia 2; uma expedição para na encruzilhada, notifica, e após 6 h sem resposta segue a Postura; o relatório narra nó a nó; o Mercado respeita o volume diário; uma caravana pode ser emboscada.
- **v0.4:** uma formação salva defende offline; a prévia e a batalha real usam o mesmo código (golden test); a Horda altera a composição em resposta à última formação (teste determinístico); o cerco ocorre na Hora da Vigília com 3 ondas e Plano de Batalha; a Crônica do Ano é gerada e exportável em Markdown; o perfil Regular do `sim-cli` fica em 65–80% de Vitória.
- **v0.5:** mapa hexagonal com névoa em 3 estados; posto avançado produz; Legado e Votos aplicados ao Ano 2; duas partidas com a mesma semente geram o mesmo mapa e as mesmas cartas elegíveis.

---

## 17. Decisões desta revisão e questões em aberto

### 17.1 Decisões tomadas (podem ser revertidas pelo produto)

| Decisão | Alternativas consideradas | Por quê |
|---|---|---|
| Ano de 7 dias reais com Cerco no dia 7 | Progressão infinita sem fim de arco; campanhas de 30 dias | Um objetivo claro na escala de uma semana evita o "para quê continuar" do dia 3; o fim do ano gera recomeço com variação |
| Combate por **formação em alas**, determinístico e com prévia | Combate por "poder total" (um número contra outro); tower defense em tempo real | Formação cria um quebra-cabeça com leitura e adaptação; "poder total" não tem decisão; tempo real não cabe em sessões de 2 min |
| **Horda adaptativa** com astúcia por dificuldade | Ondas fixas; escala pura com o exército do jogador | Fixas se resolvem com uma receita; escala pura dá sensação de futilidade; adaptação cria o ciclo observar-antecipar-formar e permite a finta |
| Expedições com **encruzilhadas que esperam** o jogador, com Postura padrão | Expedições totalmente automáticas; expedições que exigem presença | Esperar transforma a volta ao editor em um momento de decisão; a Postura impede punição por ausência |
| Cartas do Conselho a cada 8 h, máximo 2 pendentes, expiram em 24 h | Cartas ilimitadas; cartas só com o editor aberto | Cadência previsível, sem acúmulo e sem obrigar presença |
| Soldados **saem da população** e comem mais | Exército separado da população | Faz da militarização uma troca econômica real |
| Ferro e Armas como recursos de guerra; Lanceiros e Arqueiros só com madeira | Exército só com ouro; cadeias produtivas longas | Dá propósito ao Ferreiro e ao mapa sem travar o exército básico |
| Morte de heróis só em Rei de Ferro; **Captura** e **Resgate** nas demais | Morte sempre; nunca morte | Captura preserva o apego e gera conteúdo (missão de resgate) |
| Sem game over; Queda tem custo pesado e Ano 2 de reconstrução | Game over no cerco perdido | Perder a semana inteira afasta; perder metade do feudo e continuar dói o suficiente |
| Hora da Vigília configurável para o cerco | Cerco em horário fixo relativo à criação | O horário relativo poderia cair às 3 h da manhã |
| Mapa hexagonal só na v0.5, com tiles abstratos desde a v0.2 | Mapa desde o início | O mapa gráfico é caro; os dados dele são baratos e destravam cartas, expedições e Ameaça antes |
| Preact permitido na Webview | Vanilla; React/Vue | O editor de formação e a prévia justificam componentes; Preact pesa 3 KB |
| Salvar em arquivo (`globalStorageUri`) desde a v0.1 | `globalState` | Evita migração dolorosa quando mapa e Crônica crescerem |

### 17.2 Questões em aberto (não bloqueiam nenhuma versão)

- A Horda deve lembrar das formações entre anos com que peso? (Proposta: 50% do peso do ano corrente.)
- Caravanas e mercado devem existir já na v0.2 (sem heróis como escolta) para dar saída ao excedente antes do cap?
- O Plano de Batalha por onda deve permitir também "reparo automático se pedra ≥ X"?
- Relíquias devem ter desvantagens (maldições) para não serem sempre boas?
- Mundo apenas humano ou com facções e raças a partir do Legado?
- No multiplayer, o cerco é compartilhado por aliança (defender juntos) ou individual?
- Quantos anos até o conteúdo repetir para um jogador Dedicado? (Meta: 3 anos sem repetir cartas de cadeia.)

### 17.3 Ideias registradas, não priorizadas

- **Academia (v0.6):** árvore curta de 12 pesquisas, 3 por estação, com escolhas excludentes por fila (ex.: "Arados de ferro" ou "Celeiros profundos").
- **Modo Foco (experimental, desligado por padrão):** sessões de foco de 25 min no editor dão +10% de produção pelo mesmo período. Risco: contradiz o pilar "não é sobre o trabalho"; só com opt-in explícito.
- **Desafio da semana:** semente publicada semanalmente no README; ranking por honra, sem servidor.
- **Facções da Horda** com temperamentos (Feras, Mortos, Mercenários) escolhidas por semente, alterando pesos base.
- **Nomes para aldeões notáveis** além dos Mestres, aparecendo na Crônica.
- **Localização en-US** com todo texto de jogo já em `content`.

---

## 18. Tarefas para o agente de código

### 18.1 Primeira tarefa — v0.1 Fundação

> **Objetivo:** implementar exatamente a §16.1, preparando a arquitetura da §14.
>
> 1. Leia este `GAME_DESIGN.md` por inteiro antes de escrever código. Trate §14 como contrato de arquitetura e §16.1 como escopo.
> 2. Crie o monorepo com `packages/engine`, `packages/content`, `packages/extension`, `packages/webview` e `packages/sim-cli` (este último com um bot trivial que só aloca trabalhadores, para validar o pipeline).
> 3. Implemente primeiro o motor: `GameState`, `createInitialState(seed)`, `advanceTo(state, gameTimeMs)` por segmentos com aritmética inteira, RNG com fluxos nomeados, `applyCommand(state, command)` com validação e motivos de recusa.
> 4. Escreva os testes do motor antes da UI: produção, consumo, escassez determinística, custos, fila única, gates por Salão, cancelamento, recrutamento, e o teste de propriedade do invariante de `advanceTo`.
> 5. Coloque **todos** os números em `packages/content` com schemas zod validados em teste.
> 6. Implemente a extensão: ativação, TreeView, WebviewPanel com a aba Feudo, Status Bar, comandos, persistência em arquivo com `schemaVersion` e `save.bak`, scheduler de 30 s, Relatório de Retorno.
> 7. Implemente a Webview com tokens de tema do VS Code, navegação por teclado e tooltips explicativos em todos os números.
> 8. Documente no `README.md`: instalar, compilar, rodar com F5 (Extension Development Host), testar, e como rodar o `sim-cli`.
> 9. Não adicione multiplayer, autenticação, telemetria, som, nem bibliotecas além de TypeScript, esbuild (ou equivalente), Vitest, fast-check, zod e Preact.

### 18.2 Tarefas seguintes (uma por versão)

- **v0.2:** §4, §5.4–5.7, §6 (Celeiro, Armazém, Torre, Paliçada), §7 com as 60 cartas do Apêndice B como ponto de partida, §8.2 (lobos e Ameaça com tiles abstratos), §12.1. Critérios em §16.2.
- **v0.3:** §9 completo, §5.9. Grafos de expedição com 3 variantes por modelo.
- **v0.4:** §10, §11.1–11.4, §8.3, §9.5. `sim-cli` com os quatro perfis e teste de faixa da §15.2.
- **v0.5:** §8.1, §11.5, Capela e relíquias.

### 18.3 Regras permanentes para qualquer tarefa

- Nunca fixar números de demonstração na UI: a Webview exibe o `ViewState` que o motor produz.
- Nunca mudar uma regra sem atualizar o golden test correspondente e esta especificação.
- Toda nova mecânica entra com: dados em `content`, validação de comando, evento na Crônica, tooltip explicativo e teste.
- Conteúdo narrativo (cartas, relatórios, Crônica) em português do Brasil, tom de crônica medieval, frases curtas.

---

## Apêndice A — Unidades, inimigos e contra-ataques

Tabelas completas em §10.2 e §10.3. Resumo do ciclo:

```
Espadachim ─(×1,5)→ Lanceiro ─(×1,5)→ Cavaleiro ─(×1,5)→ Arqueiro ─(×1,5)→ Espadachim
Escudeiro: neutro; protege a Retaguarda da ala (absorve 50%)
Miliciano: recebe ×1,25 de tudo
Lobo = Cavaleiro (sempre lateral; ×1,5 vs Arqueiro) · Ogro: recebe ×1,5 de Lanceiro; ignora 50% da muralha · Esqueleto: ×2 de Mago/Clériga, sem moral
```

**Composições-base da Horda por estação** (pesos antes da adaptação): Primavera — Lobos 70%, Saqueadores 30%. Verão — Saqueadores 50%, Bandoleiros 30%, Lobos 20%. Outono — Saqueadores 35%, Cavaleiros Negros 25%, Ogros 15%, Bandoleiros 15%, Xamãs 10%. Inverno (cerco) — por onda, §11.2.

---

## Apêndice B — Cartas do Conselho (amostra de 12 das 60)

| # | Carta | Quando | Opções (efeitos) |
|---|---|---|---|
| 1 | **Estrangeira ferida** (roteirizada) | Dia 2 | Acolher: ganha Edda, Guerreira Leal · Cuidar e deixar partir: +40 ouro, +5 moral e no dia seguinte chega o irmão dela, Rolf, Arqueiro Prudente |
| 2 | **Refugiados nos portões** | Primavera/Verão | Aceitar: +3 aldeões (se houver vaga; senão acampam: −5 moral), −60 comida · Dar provisões e seguir: −40 comida, flag `refugiados_gratos` → carta 2b "O retorno dos refugiados" (um Mestre chega) · Recusar: nada |
| 3 | **O Mercador Misterioso** (cadeia 1/3) | Verão, Mercado ≥1 | Comprar o mapa: −80 ouro, revela 3 tiles, flag `mapa_do_mercador` · Prender: +50 ouro, −10 moral, flag `mercador_hostil` → preços +20% por 2 dias · Recusar |
| 4 | **Praga nos campos** | Verão | Queimar a plantação: −30% da comida estocada, sem efeito futuro · Rezar e esperar: 50% de perder 50%, Clériga reduz para 20% · Pagar o alquimista: −120 ouro |
| 5 | **O Lobo Branco** (cadeia) | Outono, após Covil | Caçar: gera expedição especial (relíquia Osso de Lobo) · Oferecer carne: −80 comida, presságio claro · Ignorar: lobos +30% no cerco |
| 6 | **Impostos do Rei** (recorrente) | Salão ≥3 | Pagar: −15% do ouro · Negociar (Carismático): −7% · Recusar: +10 moral, flag `rebelde` → "O Cobrador do Rei" chega com soldados em 2 dias (batalha ofensiva contra você ou multa dobrada) |
| 7 | **Festival da Colheita** | Outono, 1× | Celebrar: −100 comida, −50 ouro, +20 moral por 2 dias, +2 colonos · Festa modesta: −40 comida, +8 moral · Trabalhar: −5 moral |
| 8 | **Desertores da Horda** | Outono | Aceitar como soldados: +4 Espadachins, 20% de sabotagem na onda 1 (−10% muralha) · Interrogar: −60 ouro, revela composição da onda 2 · Expulsar: +5 moral |
| 9 | **A Filha do Ferreiro** (cadeia) | Verão, Ferreiro ≥1 | Deixar aprender: Ferreiro +10% permanente, flag → mais tarde ela forja um item raro · Manter a tradição: +5 moral dos conservadores |
| 10 | **Minério na pedreira** | Pedreira ≥3 | Escavar: Pedreira parada 4 h, +60 ferro · Ignorar |
| 11 | **Cometa sobre as montanhas** | Outono | Consultar o eremita: −60 ouro, composição da onda 3 · Interpretar com o Mago (requer Mago): presságio aleatório claro · Ignorar: +5 moral ("o povo prefere não saber") |
| 12 | **Aldeões exigem muralhas** | Verão, Muralha = 0 | Prometer: +10 moral se construir em 2 dias, −15 se não · Explicar: nada · Imposto da muralha: +100 pedra, −10 moral |

Padrão de escrita: 2–4 frases de situação, opções com verbo no infinitivo, efeitos sempre visíveis exceto os marcados como rumor.

---

## Apêndice C — Exemplo de grafo de expedição: Ruínas de Vel'Thar (variante A)

```
N1 Deslocamento (20 min) "A trilha até as ruínas"
 └→ N2 Encruzilhada (aguarda) "A escadaria desaba atrás de vocês"
      ├→ N3a Perigo (25 min) "Corredor das Inscrições"   dificuldade 60 · Perícia conta ×1,5 · item raro provável
      │     └→ N4 Chefe (30 min) "O Guardião de Pedra"   dificuldade 90 · recompensa: planta da Capela, 80 pedra, 60 ouro
      ├→ N3b Encontro (25 min) "Galeria Inundada"        dificuldade 50 · requer Guerreiro · 60 pedra, 35 ouro
      │     └→ N4 (mesmo chefe)
      └→ N3c Retorno seguro "Recuar com o que têm"       mantém o saque atual (ervas, 20 ouro)
N5 Retorno (20 min)
```

Postura Cautelosa escolhe N3c; Equilibrada N3b; Ousada N3a. O relatório cita quem decidiu e por quê.

---

## Apêndice D — Heróis: traços e relíquias

**Traços (1–2 por herói):**

| Traço | Efeito |
|---|---|
| Corajoso | +10% em escolhas Ousadas; +20% de chance de ferimento |
| Prudente | +10% em escolhas Cautelosas; nunca cai em armadilhas simples |
| Ganancioso | +25% de saque; 10% de chance de evento negativo por nó |
| Carismático | Opções de negociação em cartas; heróis da Taverna 20% mais baratos |
| Devoto | Reduz efeitos de pragas e maldições; +5 moral do feudo |
| Veterano | +1 nível inicial; aura de comandante +5% |
| Leal | Nunca parte por falta de soldo |
| Rastreador | Revela 1 tile extra por expedição |

**Relíquias (Capela, `[v0.5]`):** Chifre dos Ancestrais (+10 moral do exército em batalha) · Coração de Carvalho (Serraria +15%) · Olho do Vigia (presságios sempre com clareza Nv3) · Selo do Rei Antigo (impostos −50%) · Osso de Lobo (lobos −30% de ataque) · Lâmpada do Eremita (expedições 10% mais rápidas) · Pedra de Sal (cap de comida +20%) · Manto do Inverno (lenha −50%).

---

## Apêndice E — Presságios, Feitos e Crônica

**Presságios (exemplos por clareza):** "Corvos voam do norte em bandos: a Horda trará muitas feras." (Nv1) · "Os vigias contam cerca de trinta lobos rumando para o oeste do vale: ala esquerda, segunda noite." (Nv3) · "Um desertor desenha no chão: 24 cavaleiros negros, 30 esqueletos, 3 xamãs e o Senhor da Guerra no centro." (Nv5)

**Feitos (amostra de 30):** Primeiro Inverno (sobreviver ao cerco) · Muralha Intacta (Vitória Gloriosa) · Regicida da Horda (derrotar o Senhor da Guerra) · A Finta (vencer o cerco após mudar mais de 60% da formação em relação ao dia 6) · Sabotador (3 sabotagens em um ano) · Celeiro Cheio (nunca passar fome no ano) · Senhor Amado (moral ≥ 80 por 3 dias) · Resgate (recuperar um herói capturado) · Cartógrafo (explorar todos os tiles do raio 3) · Rei de Ferro (vencer em Rei de Ferro).

**Crônica — modelos de frase (gerados por evento, com variações):** "No {dia}º dia da {estação}, {evento}." · Conclusão de obra: "Os pedreiros ergueram {edifício} ao {nível}º nível." · Incursão repelida: "{inimigos} vieram pelo {ala}; a {muralha/paliçada} resistiu e {comandante} liderou a resposta." · Encruzilhada: "{herói} escolheu {opção}; {consequência}." · Cerco: "A terceira onda rompeu o {ala}, mas {unidade} de {comandante} derrubou o Senhor da Guerra."

---

## Apêndice F — Glossário

| Termo | Significado |
|---|---|
| Ano | Ciclo completo de 4 estações; 7 dias reais no ritmo Normal |
| Dia de jogo | 2 h reais; momento das viradas discretas |
| Hora da Vigília | Horário local escolhido pelo jogador para o cerco e eventos fortes |
| Ameaça | Indicador 0–100 que gera incursões extras |
| Conselho | Sistema de cartas de dilema |
| Encruzilhada | Nó de expedição que aguarda decisão do jogador |
| Postura | Política padrão da expedição (Cautelosa, Equilibrada, Ousada) |
| Ala / Linha / Posto | Estrutura do Campo de Batalha (3 × 2 = 6 postos) |
| Conselho de Guerra | Prévia simulada da batalha |
| Horda | Inimigo do inverno; adapta-se à última formação vista |
| Finta | Usar uma formação-isca para induzir a Horda ao erro |
| Presságio | Informação parcial sobre as ondas do cerco |
| Plano de Batalha | Formação escolhida por onda, aplicada mesmo com o jogador ausente |
| Queda | Derrota no cerco; custo pesado, sem game over |
| Crônica | Log narrativo; a Crônica do Ano fecha o ciclo |
| Legado / Votos | Meta-progressão permanente / modificadores de dificuldade escolhidos |
| Semente | Valor que determina mapa, cartas elegíveis e Horda base |
