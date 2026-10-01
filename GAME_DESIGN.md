# Lords of the Guild — Game Design Document (GDD)

> **Status:** design consolidado / base para desenvolvimento com agentes de código (Codex, Claude Code)  
> **Versão do documento:** 0.6 (correções de fato depois da implantação: ritmo 3× nas partidas novas do MVP, Crônica sem viradas de dia, `features` em `GET /version`, produção no Coolify; escopo do jogo permanece v0.1)\
> **Idioma:** português (Brasil)  
> **Plataforma inicial:** app web no navegador, com aparência de editor de código (cliente) + servidor Node.js com PostgreSQL (contas e progresso online)  
> **Gênero:** estratégia e gerenciamento medieval assíncrono, com RPG de guilda e batalhas táticas por formação  
> **Inspirações:** Tribal Wars e OGame (progressão assíncrona), Against the Storm e Frostpunk (pressão das estações), Reigns e King of Dragon Pass (dilemas), Darkest Dungeon (expedições com risco), Into the Breach (combate determinístico e legível), auto-battlers (formação como decisão central).

**Em uma frase:** um feudo que você governa nas pausas do café, onde cada semana é um ano, e cada ano termina com um cerco que você passou a semana inteira preparando.

---

## 0. Como ler este documento

- Cada mecânica traz a **tag de versão** em que entra no jogo: `[v0.1]`, `[v0.2]`, `[v0.3]`, `[v0.4]`, `[v0.5]`, `[v0.6]`. Um agente implementando a `v0.2` deve ignorar tudo com tag maior, mas **não pode tomar decisões de arquitetura que impeçam** as versões seguintes (ver §14).
- A **semana completa de diversão** descrita em §2 fica pronta a partir da `v0.4`. As versões anteriores são incrementos jogáveis, cada um com seus próprios critérios de aceitação (§16).
- **Todos os números** deste documento são parâmetros iniciais de balanceamento. Vivem em arquivos de conteúdo/configuração (§14.4), nunca espalhados pela interface ou pelo motor.
- Nomes de jogo em português; identificadores de código em inglês (`townHall`, `lumberMill`, `siegeWave`).
- Mudanças em relação à v0.1 estão resumidas em §17 ("Decisões desta revisão").
- O jogo é **online desde a v0.1**: o progresso vive em um servidor Node.js + PostgreSQL, a conta nasce em um clique e o jogador continua de qualquer máquina. "Online" aqui não significa interação entre jogadores (isso é v1.0): significa servidor autoritativo e progresso persistente (§14).
- Mudanças da 0.3 em relação à 0.2: §1.1 (pilar 6), §4.3, §5.8, §11.6, §13.1, §13.6, §13.9, §14 inteira, §15.3 a §15.5, §16, §17 e §18.
- Mudanças documentais da 0.4: §14.5–14.10 e critérios de §16.1; decisões registradas em [ADRs 0003–0005](docs/decisions/README.md). Os contratos desta revisão estão refletidos no `MVP-ROADMAP.md` desde a versão 1.1 e foram implementados na Fase 2 (servidor) e na Fase 3 (cliente).
- Mudança da 0.5: o cliente deixa de ser uma extensão do VS Code e passa a ser um **app web com aparência de editor** ([ADR 0008](docs/decisions/0008-cliente-web-com-aparencia-de-editor.md)). Mudam §1, §13, §14.1, §14.2, §14.7 (vínculo GitHub), §14.10, §14.12–14.14, §16.1, §17 e §18. Regras de jogo, motor, servidor e contratos da API não mudam, com exceção das duas rotas novas do vínculo GitHub (§14.5).
- Mudanças da 0.6 (correções de fato, sem regra nova): nota sobre o ritmo do MVP em §4.2 ([ADR 0011](docs/decisions/0011-ritmo-3x-no-mvp.md)); versões dos comandos em §13.6; `GET /catalog`, `GET /version` e a Crônica em §14.5 ([ADRs 0007 e 0010](docs/decisions/README.md)); `GAME_TIME_SCALE` em §14.13; ritmo, hospedagem e critério 7 em §16.1 ([ADR 0009](docs/decisions/0009-implantacao-no-coolify.md)).

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
13. Interface e experiência no navegador
14. Arquitetura online: cliente, servidor, determinismo e dados
15. Balanceamento, testes de diversão e simulador
16. Roadmap, escopo por versão e critérios de aceitação
17. Decisões desta revisão e questões em aberto
18. Tarefas para o agente de código
Apêndices: A (unidades e inimigos), B (cartas do Conselho), C (expedições), D (heróis, traços, relíquias), E (presságios, feitos, Crônica), F (glossário)

---

## 1. Visão geral e pilares

**Lords of the Guild** é um jogo medieval de fantasia jogado no navegador, em uma página com a aparência de um editor de código. O jogador governa **Pedra Alta**, um feudo pequeno e vulnerável, ao longo de um **ano de jogo que dura uma semana real**. Durante a primavera e o verão ele constrói a economia, recruta heróis, explora um mapa coberto de névoa e repele incursões cada vez maiores. No outono recebe presságios sobre a **Horda** que marcha do norte. No inverno, o feudo enfrenta o **Cerco do Inverno**: três ondas de ataque resolvidas automaticamente com a formação que o jogador preparou. Sobreviva ou não, o ano termina com a **Crônica do Ano** e um novo ano começa, mais difícil e com mais opções.

O jogo **não é sobre programação**. A interface imita a bancada de um editor: árvore de navegação na lateral, abas no centro, tabelas, notificações com botões, uma linha na barra de status e uma paleta de comandos. Nenhuma linha de código, nenhum terminal, nada para instalar. As sessões duram de 2 a 10 minutos e o mundo continua andando com a aba fechada. O progresso vive em um servidor: a conta nasce com um clique em **Jogar agora**, sem e-mail nem senha, e o jogador continua de qualquer máquina.

### 1.1 Pilares de design

1. **Toda sessão tem uma decisão com custo real.** Nunca "clique para coletar". Alocar, construir, enviar, escolher um caminho, montar uma formação: cada ação fecha uma porta e abre outra.
2. **Tempo é o adversário, não o jogador ausente.** O calendário avança sozinho e o inverno chega para todos. Mas a ausência nunca é punida: produção offline respeita o estoque, incursões usam a formação salva, expedições seguem a postura definida. Quem volta encontra um relatório, não um castigo.
3. **Legível e explicável.** Cada número tem um "por quê" no tooltip. Cada batalha tem um relatório que diz **o que decidiu o resultado**. Nada de dados ocultos sem pista: o que você não sabe, você pode descobrir (vigias, batedores, presságios).
4. **O inimigo reage a você.** A Horda observa a sua última formação e traz contramedidas. Quem repete a mesma receita perde. Quem engana a Horda com uma formação-isca vence com estilo.
5. **Interface discreta, com cara de editor.** Parece uma ferramenta de trabalho aberta em uma aba do navegador: temas claro/escuro, teclado, barra de status com uma linha, notificações contidas. Jogável no trabalho sem constrangimento.
6. **Online desde o início, social depois.** Cada jogador governa o próprio feudo em um servidor autoritativo, com conta criada em segundos e progresso que o acompanha em qualquer máquina. Alianças e PvP vêm depois, sobre a mesma base (motor determinístico, conteúdo como dados, comandos validados).

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

Implementação: o motor roda em **tempo de jogo**; o servidor converte tempo real em tempo de jogo com um fator `timeScale` (1, 2 ou 0,5). Todos os valores deste documento estão no ritmo Normal. O ritmo é escolhido na criação da partida e não muda durante o ano.

> **Ritmo do MVP (v0.1, [ADR 0011](docs/decisions/0011-ritmo-3x-no-mvp.md)).** As partidas novas nascem com `timeScale` 3: o dia de jogo dura 40 minutos reais e o ano, 56 horas. O fator vem da configuração do servidor (`GAME_TIME_SCALE`, de 0,5 a 10, padrão 3), fica gravado na partida ao criá-la e não muda nas que já existem. O motor continua em tempo de jogo, com os números deste documento; o `ViewState` mostra prazos e taxas em tempo real. A escolha do ritmo pelo jogador continua na v0.2.

### 4.3 Hora da Vigília `[v0.4]`

Eventos que merecem presença (cerco, incursão forte do dia 6) acontecem na **Hora da Vigília**, horário local configurado pelo jogador (padrão 20:00). O cerco começa na primeira Hora da Vigília que caia pelo menos 6 h após o início do inverno; se não houver nenhuma, começa 12 h após o início do inverno. Estar presente **não é obrigatório**: tudo se resolve com o Plano de Batalha salvo (§10.8).

O cliente envia o fuso horário IANA do jogador (ex.: `America/Sao_Paulo`) e a hora local escolhida; o servidor converte para o instante UTC ao agendar. Mudar de fuso durante o ano não move um cerco já agendado.

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

A cada leitura ou comando novo de uma partida, o **servidor** avança o estado de `lastProcessedAt` até o relógio do servidor processando **segmentos entre eventos**: conclusão de obra, recrutamento, virada de dia de jogo, mudança de estação, chegada de expedição, incursão agendada, onda do cerco. Reenvios de comandos já registrados seguem o recibo da §14.8. Dentro de cada segmento as taxas são constantes. Isso garante que avançar 10 h de uma vez produz o mesmo estado que avançar dez vezes 1 h (§14.3). Um job horário avança partidas sem atividade, para que Crônicas e rankings existam mesmo para quem sumiu (§14.9). O relógio do cliente nunca é fonte de verdade.

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
- **Resolução de nó:** `poder_da_equipe = Σ (ataque + defesa + vida/10) × modificadores de classe/traço/equipamento`. Compara-se com a `dificuldade` do nó: razão ≥ 1,3 → Sucesso Pleno; ≥ 1,0 → Sucesso; ≥ 0,7 → Revés (ferimento leve, saque parcial); abaixo → Desastre (ferimento grave ou captura, saque perdido). Um fator de sorte de ±15% vem do RNG com semente (§14.3). Traços deslocam a razão (Corajoso +10% em Ousada, etc.).
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


### 11.6 Temporadas: a semana compartilhada `[v0.5]`

Com o progresso no servidor, o calendário pode ser **compartilhado**. Toda segunda-feira o servidor abre uma **Temporada**: semente única, mesmo mapa, mesmas cartas elegíveis e mesma Horda base para todos; entrada aberta até terça-feira. Quem entra joga um ano normal, mas a Crônica do Ano vai para um **ranking da semana** (pontuação, resultado do cerco, Feitos), e as Crônicas podem ser lidas por quem está na mesma Temporada. Fora da Temporada, a partida individual continua como sempre. Não há interação entre feudos: é a mesma prova, não a mesma arena.

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

## 13. Interface e experiência no navegador

O jogo é uma página única que imita a bancada de um editor de código. Usa as mesmas variáveis de tema de um editor (`--vscode-*`, definidas pelo próprio app para cada tema), ícones do conjunto codicons e fonte de interface do sistema, e funciona 100% com mouse **e** 100% com teclado. Nenhum terminal, nenhum arquivo para editar, nada para instalar. O app não usa o nome nem o logotipo do Visual Studio Code: tem a aparência de um editor, não a marca de um ([ADR 0008](docs/decisions/0008-cliente-web-com-aparencia-de-editor.md)).

### 13.1 Mapa de superfícies

| Superfície | Uso |
|---|---|
| **Barra de atividades** (faixa de ícones à esquerda) | Alterna a barra lateral entre o Feudo, a Crônica e a Conta; o ícone do Feudo mostra o badge de novidades |
| **Barra lateral / árvore** | Navegação, resumo e **badges** de pendências; ações nos itens |
| **Área central, em abas** | Abas como as de arquivos de um editor: Hoje, Feudo e, nas versões seguintes, Mapa, Exército, Guilda, Conselho e Mercado. A Crônica abre em uma aba própria |
| **Barra de status** | Uma linha, uma prioridade: cerco > decisões pendentes > obra > alerta de comida |
| **Notificações** | Avisos no canto inferior direito, com botões de ação; política configurável (§13.5) |
| **Paleta de comandos** | Abre com `F1` ou `Ctrl+K`. Todas as ações principais como comandos `Lords: …`, com listas de escolha para alocar, construir, enviar expedição |
| **Título e ícone da aba do navegador** | Nome do feudo e contador de novidades; no modo discreto, só um contador |
| **Armazenamento do navegador** | Credenciais da sessão, último estado conhecido (modo sem conexão) e preferências |

O navegador reserva alguns atalhos de editor (`Ctrl+Shift+P`, `Ctrl+P`, `Ctrl+W`), por isso a paleta usa `F1` e `Ctrl+K`. Em telas estreitas (menos de 720 px) a barra lateral se recolhe e abre por cima do conteúdo.

### 13.2 Árvore da barra lateral

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

### 13.5 Barra de status e notificações

- Barra de status (um item, à esquerda): `$(shield) Cerco em 1d 03h · $(bell) 2` → clique leva à aba correspondente. Sem pendências: `$(home) Pedra Alta · Muralha 00:42`. O título da aba do navegador repete o essencial (`(2) Pedra Alta`), para ser visto com a aba em segundo plano.
- **Modo discreto** (comando e configuração): o item vira apenas `$(circle-filled) 2h14`, o título da aba vira só esse contador e todas as notificações são suprimidas. Para quem joga no trabalho.
- Política de notificações: **Silenciosa** (nada), **Essenciais** (padrão: cerco, incursão, encruzilhada, carta nova, herói capturado), **Todas** (inclui obras e treinos). Limite de 3 notificações por hora; o excedente vira badge.
- As notificações aparecem dentro do app. Com a aba em segundo plano, o jogador pode **optar** por recebê-las também como notificações do navegador; a permissão só é pedida quando ele liga essa opção. Com a aba fechada nada é entregue na v0.1: quem volta lê o Relatório de Retorno.
- Toda notificação tem botões: `[Ver]` `[Decidir]` `[Silenciar 2h]`.
- **Relatório de Retorno:** ao abrir após 4 h ou mais ausente, o app abre na aba "Hoje" com o resumo.

### 13.6 Comandos (paleta de comandos)

`Lords: Ir para o Feudo` · `Lords: Alocar trabalhadores…` · `Lords: Construir ou melhorar…` · `Lords: Recrutar aldeões…` · `Lords: Enviar expedição…` · `Lords: Decidir carta do Conselho` · `Lords: Editar formação de defesa` · `Lords: Simular batalha` · `Lords: Abrir Crônica` · `Lords: Baixar Crônica (Markdown)` · `Lords: Modo discreto` · `Lords: Trocar tema` · `Lords: Nova partida…` · `Lords: Reiniciar partida` (com confirmação; na v0.1 é o próprio `Lords: Nova partida`, que arquiva o feudo atual e começa outro) · `Lords: Baixar cópia da partida (JSON)` (depois da v0.1: não há rota para isso) · `Lords: Vincular conta ao GitHub` · `Lords: Gerar Código do Reino` · `Lords: Entrar com Código do Reino` · `Lords: Sair desta máquina`.

As listas de escolha permitem jogar inteiramente pelo teclado: `Alocar trabalhadores` mostra cada edifício com `+`/`−` e a taxa resultante em tempo real.

### 13.7 Acessibilidade e tema

Navegação por teclado em todas as superfícies (ordem lógica, foco visível, foco preso dentro de diálogos e da paleta), ARIA nos grids, nada comunicado só por cor (ícones e texto acompanham), `prefers-reduced-motion` respeitado (animações são zero por padrão), números formatados em pt-BR, textos sem truncamento em larguras a partir de 480 px.

Três temas, escolhidos pelo jogador e lembrados no navegador: escuro (padrão), claro e alto contraste. Na primeira visita vale `prefers-color-scheme`. Os temas são conjuntos de valores para as variáveis `--vscode-*`; nenhum componente tem cor fixa.

### 13.8 Som

Nenhum por padrão. Opcional (`[v0.6]`): três sons curtos (carta, encruzilhada, cerco), desativados até o jogador ligar.

### 13.9 Entrada no jogo, conta e conexão `[v0.1]`

Meta: de abrir o endereço ao primeiro comando em **menos de 30 segundos**, sem instalar nada, sem e-mail, senha ou formulário. A conta existe antes de o jogador perceber que criou uma.

**Primeira abertura (aba de boas-vindas):**

```
LORDS OF THE GUILD

Como devemos chamar quem governa?    [ Gustavo           ]
Nome do feudo                         [ Pedra Alta        ]   (sugerido, editável)
Dificuldade   (•) Senhor   ( ) Camponês   ( ) Rei de Ferro
Ritmo         (•) Normal: um ano em 7 dias   ( ) Rápido   ( ) Tranquilo
Hora da Vigília  [ 20:00 ]   fuso: America/Sao_Paulo (detectado)

                        [ Jogar agora ]

Já governa um feudo em outra máquina?   [ Entrar com GitHub ]   [ Usar Código do Reino ]
```

- **Jogar agora** cria uma **conta anônima** no servidor e a primeira partida. Nada mais é pedido. As credenciais ficam no armazenamento deste navegador.
- **Vincular conta (opcional, a qualquer momento):** `Lords: Vincular conta ao GitHub` mostra um código curto e abre `github.com/login/device`; o jogador confirma lá e o vínculo se completa sozinho (§14.7). Alternativa sem GitHub: `Lords: Gerar Código do Reino` mostra um código de recuperação (ex.: `PEDR-7F3A-K9QD-M2XW-4HTB`) **uma única vez**; quem digitar o código em outro navegador assume a conta.
- **Nunca bloquear o jogo** por falta de vínculo. Um lembrete discreto aparece uma vez no dia 3 ("Proteja seu reino: vincule a conta para continuar de outra máquina") e pode ser dispensado para sempre. O lembrete importa mais no navegador: limpar os dados de navegação apaga a sessão de uma conta anônima sem vínculo.
- A árvore ganha o item `Conta: Gustavo · anônima` (ou `· GitHub`) com as ações "Vincular ao GitHub", "Código do Reino", "Sair desta máquina" e "Excluir conta".
- **Sem conexão:** a barra de status mostra `$(debug-disconnect) Sem ligação com o reino`; o app exibe o último estado conhecido (guardado no navegador) em modo leitura, com comandos desabilitados e uma frase honesta: "O mundo continua andando. Seus comandos voltam quando a ligação voltar." Reconexão com recuo exponencial (5 s → 60 s).
- **Duas abas ou duas máquinas ao mesmo tempo** funcionam: o servidor aplica cada comando uma vez e o outro cliente recebe o estado novo no próximo ciclo (30 s) ou ao agir. Abas do mesmo navegador dividem a mesma sessão; sair em uma sai em todas.
- **Trocar de máquina:** abrir o endereço, clicar em "Entrar com GitHub" ou digitar o Código do Reino. O progresso aparece em segundos, porque ele nunca esteve na máquina.

---

## 14. Arquitetura online: cliente, servidor, determinismo e dados

### 14.1 Visão geral

```
┌────────────────────────── Navegador (cliente) ────────────────────────────┐
│  App web com aparência de editor: barra de atividades, árvore, abas,      │
│  barra de status, paleta de comandos, cache e credenciais no navegador    │
│                            │ HTTPS · JSON · /v1 · polling de 30 s          │
└────────────────────────────┼──────────────────────────────────────────────┘
                             ▼
┌──────────────────── Servidor Node.js 22 (Fastify) ────────────────────────┐
│  auth · games · commands · view · events · battle-preview · chronicle      │
│  usa packages/engine + packages/content (o mesmo código do sim-cli)        │
│  job horário: avança partidas paradas                                      │
└────────────────────────────┬──────────────────────────────────────────────┘
                             ▼
            PostgreSQL 16  (accounts · sessions · refresh_tokens · games JSONB ·
                            commands · game_events · chronicles)
```

Princípios:

1. **O servidor é autoritativo e é o relógio.** O cliente envia comandos e recebe um `ViewState`; nunca envia estado, nem timestamps, nem resultados.
2. **O motor é um só.** `packages/engine` roda no servidor (verdade), no `sim-cli` (balanceamento e carga) e nos testes. O app web não precisa do motor: só exibe o que recebe.
3. **Determinismo permite replay.** Estado inicial + semente + log de comandos com os instantes do servidor reproduzem qualquer partida: depuração, auditoria e antitrapaça de graça.
4. **Uma queda do servidor não perde nada.** O avanço é preguiçoso e determinístico: o cerco das 20:00 calculado às 23:00, depois de uma indisponibilidade, dá exatamente o mesmo resultado.
5. **Online não é multiplayer (ainda).** Cada partida pertence a uma conta e não interage com outras até a v1.0. O que é compartilhado desde cedo: a infraestrutura, o ranking de Temporadas (`[v0.5]`) e a comparação de Crônicas.

### 14.2 Pacotes

```
lords-of-the-guild/
├── package.json                 # workspaces (pnpm)
├── GAME_DESIGN.md
├── packages/
│   ├── engine/                  # motor puro: estado, comandos, advanceTo, batalha, expedições, RNG
│   ├── content/                 # dados do jogo + schemas zod
│   ├── protocol/                # tipos e schemas zod da API /v1: Command, ViewState, erros (servidor e cliente)
│   ├── server/                  # Fastify + PostgreSQL: auth, partidas, comandos, job de avanço, migrações
│   ├── client-sdk/              # cliente HTTP tipado da API (usado pelo app web e pelo sim-cli)
│   ├── sim-cli/                 # bots de playtest: em processo (engine) ou contra um servidor (carga)
│   └── web/                     # app web (Preact): bancada com aparência de editor, sessão de jogo, cache
├── deploy/                      # Dockerfile, web.Caddyfile, migrations/, docker-compose.dev.yml, analytics/*.sql
└── tests/                       # integração servidor↔banco e app web↔servidor (navegador real)
```

`engine`, `content` e `protocol` não importam nada do navegador nem de servidor. `server` e `web` dependem deles e nunca um do outro. O app web não importa o motor.

### 14.3 Determinismo (motor)

1. **Tempo de jogo** em milissegundos inteiros. `advanceTo(state, t)` processa a **linha do tempo de eventos** (conclusões, viradas de dia, estações, chegadas, incursões, ondas) em ordem, aplicando produção contínua por segmento. Invariante testada por propriedade: `advanceTo(t2)` ≡ `advanceTo(t1)` seguido de `advanceTo(t2)` para qualquer `t1` intermediário.
2. **Aritmética inteira** para recursos: estoques em milésimos; a produção por segmento acumula `taxa × ms` em um acumulador por recurso e converte com divisão inteira, carregando o resto. O invariante acima fica **exato**, sem tolerância de ponto flutuante.
3. **RNG com semente e fluxos nomeados** (`council`, `market`, `omens`, `expedition:<id>`, `battle:<id>`, `horde`), cada fluxo com estado próprio dentro do `GameState`. A ordem de processamento de um subsistema não altera o sorteio de outro. Algoritmo sugerido: xoshiro128** ou mulberry32.
4. **Comandos** são a única forma de mudar o estado além de `advanceTo`. Cada comando é validado (recursos, pré-requisitos, limites) e recusado com um motivo legível, que chega à UI. O servidor chama `advanceTo(agora)` antes de aplicar um comando novo; reenvios retornam o recibo original sem chamar o motor (§14.8).
5. **Prévia** (Conselho de Guerra) usa o mesmo `resolveBattle` com sementes derivadas de `hash(seed, 'preview', i)`; roda no servidor porque só ele conhece a composição inimiga real por trás da névoa.

### 14.4 Conteúdo como dados

Tudo que é número ou texto de jogo vive em `packages/content`: `balance.ts` (taxas e fórmulas parametrizadas), `buildings.ts`, `units.ts`, `enemies.ts`, `cards/*.json`, `missions/*.json`, `omens.json`, `chronicle/*.json`, `objectives.json`, `achievements.json`. Schemas **zod** validam todo o conteúdo em teste: flags referenciadas existem, grafos de expedição são acíclicos e têm saída, o ciclo de contra-ataques está completo, toda carta tem exatamente uma opção padrão. O servidor expõe os catálogos estáticos em `GET /v1/catalog` com ETag pelo hash do conteúdo; o app guarda em cache.

### 14.5 Servidor e API

Stack: **Node.js 22 LTS**, **Fastify** (validação por schema, pequeno, rápido), **PostgreSQL 16** via `pg` + **Drizzle ORM** (SQL tipado, migrações em SQL versionadas), **zod** compartilhado via `protocol`, `pino` para logs, `jose` para JWT e `node:crypto` no servidor para aleatoriedade, SHA-256 e HMAC-SHA256. Sem Redis, sem filas, sem framework pesado até uma medição pedir.

Endpoints (`/v1`, JSON; erros no formato `{ code, message, details? }`):

| Método e rota | Função | Autenticação |
|---|---|---|
| `POST /auth/anonymous` | Cria conta anônima e a primeira sessão. Corpo: `{ displayName }` | — |
| `POST /auth/github/device` · `POST /auth/github/device/poll` | Inicia o *device flow* do GitHub e consulta a sua conclusão. O servidor só repassa a chamada ao GitHub (que não aceita chamadas diretas do navegador), usando o identificador público `GITHUB_CLIENT_ID`; não guarda nada | — |
| `POST /auth/github` | Vincula a conta atual ao GitHub ou entra em uma conta já vinculada. Corpo: `{ githubAccessToken }` (obtido pelo *device flow*); o servidor valida em `api.github.com/user` e guarda só o `github_id` | opcional |
| `POST /auth/recovery-code` | Gera ou rotaciona o Código do Reino; devolve em claro **uma vez**; grava só o hash | sessão |
| `POST /auth/recover` | Entra com o Código do Reino em outra máquina | — |
| `POST /auth/refresh` | Rotaciona o token na mesma sessão; detecta reuso de qualquer antecessor | refresh |
| `POST /auth/logout` | Revoga a sessão desta máquina | sessão |
| `GET /me` · `PATCH /me` · `DELETE /me` | Perfil · renomear · bloquear a conta imediatamente e agendar exclusão definitiva (§14.7) | sessão |
| `GET /games` · `POST /games` | Lista partidas · cria uma (`{ settlementName, difficulty, timeScale, vigilHourLocal, timezone, vows? }`). Na v0.1 o ritmo é o do servidor e o `timeScale` enviado é ignorado (§4.2) | sessão |
| `GET /games/:id/view` | Avança até agora e devolve `{ view, stateVersion }`; ETag da representação completa e `304` apenas se ela não mudou (§14.8) | sessão |
| `POST /games/:id/commands` | Aplica `{ commandId, type, payload }`; grava status e corpo da resposta para reenvio idempotente na mesma partida (§14.8) | sessão |
| `GET /games/:id/events?after=<seq>` | Eventos para notificações (obras, encruzilhadas, cartas, incursões, cerco) | sessão |
| `POST /games/:id/battle-preview` | Conselho de Guerra: 200 simulações com a névoa aplicada | sessão |
| `GET /games/:id/chronicle?year=` · `GET /games/:id/chronicle.md` | Crônica estruturada · Markdown pronto para abrir no editor. As viradas de dia não entram na Crônica; continuam em `GET /events` ([ADR 0007](docs/decisions/0007-cronica-sem-viradas-de-dia.md)) | sessão |
| `GET /catalog` | Catálogos estáticos de conteúdo (ETag). Não existe na v0.1 (o `ViewState` já traz tudo o que o app exibe) e nenhuma tarefa do MVP a pede; fica para depois da v0.1 | — |
| `GET /health` · `GET /version` | Saúde (inclui o banco) · versão do servidor, hash do conteúdo e o que está ligado (`features.githubDevice`, verdadeiro quando há `GITHUB_CLIENT_ID`; [ADR 0010](docs/decisions/0010-version-informa-o-que-esta-ligado.md)) | — |
| `GET /seasons/current` · `GET /leaderboard?season=` | Temporada da semana e ranking `[v0.5]` | — |

Regras:

- Toda requisição de partida autentica, verifica a propriedade e serializa o acesso à linha antes do avanço. Comando já registrado retorna sua resposta original antes de `advanceTo`; comando novo avança e aplica na mesma transação (§14.8).
- O `ViewState` é **derivado** e autossuficiente para exibição (taxas, tempos restantes em segundos, textos). Prazos e taxas saem em tempo real, já convertidos pelo ritmo da partida (§4.2). A névoa é aplicada no servidor: o cliente nunca recebe a composição inimiga real.
- Limites: 60 requisições/min por sessão; 10 criações de conta/h por IP; 5 tentativas de Código do Reino/h por IP; corpo até 64 KB; nomes de 2 a 24 caracteres.
- Versionamento: `/v1` estável; mudanças incompatíveis vão para `/v2` e um cliente antigo (uma aba aberta há dias, por exemplo) recebe `426 Upgrade Required` com mensagem amigável e a instrução de recarregar a página.

### 14.6 Banco de dados (PostgreSQL 16)

```sql
accounts     (id uuid pk, display_name text, github_id text unique null,
              recovery_code_hash text unique null, created_at, last_seen_at, deleted_at null)
sessions     (id uuid pk, account_id fk, device_label text,
              created_at, expires_at, revoked_at null)
refresh_tokens (token_hash text pk, session_id fk, created_at, used_at null)
games        (id uuid pk, account_id fk, status text,            -- active | archived
              seed text, difficulty text, time_scale numeric, timezone text, vigil_hour smallint,
              schema_version int, state jsonb, state_version bigint,
              last_processed_at timestamptz, created_at, updated_at)
commands     (game_id fk, id uuid,                              -- id = commandId; escopo: partida
              account_id fk, seq bigint, type text, payload jsonb, request_hash text,
              server_time timestamptz, result text, error_code text null,
              response_status smallint, response_body jsonb,
              pk (game_id, id), unique (game_id, seq))
game_events  (game_id fk, seq bigint, at timestamptz, kind text, payload jsonb, pk (game_id, seq))
chronicles   (game_id fk, year int, summary jsonb, score int, result text, created_at, pk (game_id, year))
```

- O `GameState` inteiro fica em `games.state` (JSONB). Colunas espelhadas (`status`, `last_processed_at`, `account_id`) servem às consultas e ao job horário. Crônica e eventos ficam em tabelas próprias para o estado quente permanecer pequeno (meta: menos de 150 KB por partida).
- `commands` guarda tanto o log para replay quanto o recibo de idempotência: `result` = `accepted | rejected`, `request_hash`, `response_status` e `response_body` são obrigatórios. Na v0.1, esses registros permanecem enquanto a partida existir, inclusive arquivada; não há expurgo por idade que permita executar novamente um UUID antigo. Exclusão da conta remove os recibos em cascata.
- Cada `sessions.id` identifica uma família de refresh tokens de uma máquina. `refresh_tokens` conserva todos os hashes dessa família até a expiração da sessão ou exclusão da conta; índice único parcial em `session_id where used_at is null` permite no máximo um token não utilizado por família. A validade também depende de `sessions.expires_at`, `revoked_at` e `accounts.deleted_at`.
- Todas as relações de propriedade usam `ON DELETE CASCADE`: conta → sessões → refresh tokens; conta → partidas → comandos/eventos/Crônicas; conta → comandos. `accounts.recovery_code_hash` permite busca única do HMAC do Código do Reino, nunca do código em claro.
- **Uma partida ativa por conta** na v0.1. Anos encerrados viram linhas em `chronicles` e a partida segue no mesmo registro (Ano 2, 3…). Começar outra partida arquiva a atual.
- Migrações versionadas em SQL (`deploy/migrations/0001_init.sql`, …), aplicadas no arranque do servidor com lock de migração.
- Backup: `pg_dump` diário com retenção de 14 dias, agendado na plataforma de hospedagem (§14.13); restauração ensaiada em um banco descartável e registrada em `deploy/README.md`.

### 14.7 Contas e autenticação

- **Conta anônima** criada no primeiro clique. O servidor devolve `accessToken` (JWT HS256, `sub` = conta, `sid` = sessão, `iss` = `PUBLIC_URL`, validade de até 15 min) e `refreshToken` (32 bytes aleatórios em base64url, guardado como SHA-256 em `refresh_tokens`). A sessão tem validade absoluta de 30 dias desde a criação; rotação não prorroga esse prazo e o JWT nunca ultrapassa `sessions.expires_at`. O app web guarda ambos no armazenamento do navegador (`localStorage`), sob uma política de conteúdo estrita (§14.14).
- **Rotação e reuso:** `POST /auth/refresh` localiza o hash, trava conta e sessão nessa ordem e revalida a conta, a sessão e o token dentro da transação. Token não utilizado: marca `used_at`, insere o sucessor e faz commit antes de responder. Token já utilizado, mesmo após várias rotações: grava `sessions.revoked_at`, faz commit e só então responde `401 SESSION_REVOKED`. Isso invalida todos os refresh tokens e JWTs da mesma família; sessões de outras máquinas continuam válidas. Token desconhecido ou sessão expirada: `401 UNAUTHORIZED`, sem alterar outra sessão.
- **Revogação sem cache:** toda requisição autenticada consulta conta e sessão no banco após validar o JWT; rejeita conta excluída, sessão revogada ou expirada. Na v0.1 não há cache positivo de autorização. Após o commit de logout, reuso ou exclusão, qualquer nova requisição é recusada também em outra instância da API. Operações que criam sessões ou alteram credenciais revalidam a conta sob lock para não reativar uma conta excluída.
- **Vínculo GitHub:** o cliente obtém o token pelo *device flow* do GitHub: pede um código ao servidor (`POST /auth/github/device`), mostra-o ao jogador com o endereço `github.com/login/device` e consulta a conclusão (`POST /auth/github/device/poll`). Essas duas rotas só repassam a chamada ao GitHub com o `GITHUB_CLIENT_ID`, têm limite de taxa por IP e não usam nenhum segredo. Com o token em mãos, o cliente chama `POST /auth/github`; o servidor valida em `GET https://api.github.com/user` e associa o `github_id`. O token do GitHub **não é armazenado**. Em outra máquina, o mesmo fluxo devolve a conta existente. Se o `github_id` já pertence a outra conta e esta máquina tem uma conta anônima com progresso, o cliente pergunta qual manter; estados **nunca** são mesclados.
- **Código do Reino:** 20 caracteres aleatórios uniformes do alfabeto `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (100 bits), exibidos em grupos de 4. Para buscar, remover espaços externos e hífens, converter para maiúsculas e validar exatamente 20 caracteres desse alfabeto. Guardar `HMAC-SHA256(RECOVERY_CODE_SECRET, codigo_normalizado)` em hexadecimal, com chave independente de `JWT_SECRET`, de pelo menos 32 bytes aleatórios. O código aparece em claro uma vez, nunca em logs. Usá-lo cria uma sessão nova; rotacioná-lo invalida somente o código anterior, não as sessões existentes. A troca da chave JWT não muda os códigos; substituir `RECOVERY_CODE_SECRET` invalida os códigos emitidos e exige um procedimento explícito. Decisão: [ADR 0003](docs/decisions/0003-codigo-do-reino-hmac.md).
- **Sair desta máquina:** revoga só a sessão atual e o app apaga seus tokens e cache local da conta, em todas as abas do navegador. Login por GitHub ou Código do Reino nunca restaura uma conta com `deleted_at` preenchido.
- **Excluir conta:** `DELETE /me` grava `deleted_at`, revoga todas as sessões, apaga o HMAC de recuperação e arquiva as partidas na mesma transação; responde `202 { deletedAt, purgeAfter }`, com instantes UTC e `purgeAfter = deletedAt + 7 dias`. A partir do commit, a conta fica inacessível por qualquer credencial e ausente das consultas da API e métricas de jogadores ativos; o app limpa tokens e cache. A retenção de sete dias é operacional, sem fluxo de desfazer exclusão na v0.1. O job faz hard delete em cascata na primeira execução com `now >= purgeAfter` (normalmente em até uma hora adicional); o banco interno ainda contém os registros até lá. Backups anteriores podem conter cópias até completar sua retenção de 14 dias contados da geração; isso deve constar na política e na confirmação, sem prometer remoção física imediata de todas as cópias.
- Nenhum e-mail ou senha obrigatório. Histórico, limites de revogação e exclusão: [ADR 0005](docs/decisions/0005-sessoes-e-exclusao.md).

### 14.8 Persistência, concorrência e idempotência

- **Identidade do comando:** chave única `(game_id, commandId)`. Após autenticar e verificar a propriedade, travar a partida com `SELECT … FOR UPDATE` e consultar essa chave. `request_hash` = SHA-256 do JSON canônico de `{ type, payload }` validado (chaves de objetos ordenadas recursivamente, ordem dos arrays preservada); o cabeçalho de versão não participa do hash. Mesma chave e mesmo hash retornam `response_status` e `response_body` originais, com `X-Lords-Replayed: true`, sem avançar, aplicar ou inserir eventos novamente. Mesma chave e outro hash: `409 COMMAND_ID_CONFLICT`, sem efeitos e sem substituir o recibo. Outra conta recebe 404 antes de qualquer consulta ao recibo.
- **Comando novo:** sob o lock, capturar a versão persistida e o instante do servidor; executar `advanceTo(agora)` e depois `applyCommand` sobre o estado avançado. Persistir estado, `last_processed_at`, incremento único de `state_version`, eventos com sequência por partida e recibo de comando com `seq` crescente na mesma transação. Só enviar a resposta após commit; falha inesperada faz rollback integral, permitindo nova tentativa com o mesmo UUID. Erros de autenticação, formato e propriedade ocorrem antes dessa transação e não geram recibo.
- **Recusa é um resultado persistido:** se o motor recusa, guardar o estado e os eventos de `advanceTo`, sem os efeitos da ação recusada. Não fazer rollback por erro de regra. Persistir também o recibo `422 { code: 'GAME_RULE', message, details: { code, message, view, events, stateVersion, staleView } }`; `details.code` é a recusa do motor. No sucesso, persistir `200 { view, events, stateVersion, staleView }` com eventos do avanço e do comando. Reenvios conservam inclusive recusas, mesmo que agora existam recursos; uma nova intenção exige outro UUID.
- **Versão persistida:** `stateVersion` começa em 1 e é uma string decimal na API, representando o `bigint` do banco. Cada escrita do estado incrementa uma vez: comando novo aceito ou recusado, leitura com eventos ou job. Leitura com apenas produção contínua não escreve e mantém a versão. Reenvio e conflito de UUID não a incrementam. Leituras que avançam também usam transação e lock da partida, evitando duplicar eventos com comandos ou jobs concorrentes.
- **Aviso de desatualização:** o cliente pode enviar `X-Lords-State-Version: <stateVersion>`; se diferir da versão persistida capturada ao obter o lock, `staleView = true`. Sem cabeçalho, `false`; formato inválido, `400 VALIDATION`. É um aviso: o motor valida a ação contra o estado atual. `If-Match` não é usado para esse aviso. O recibo mantém o `staleView` calculado na primeira tentativa.
- **Cache HTTP de `/view`:** resposta `200 { view, stateVersion }`; ETag fraco `W/"<sha256>"` calculado sobre o JSON canônico desse corpo completo, já derivado no instante da leitura. Autenticar e avançar antes de avaliar `If-None-Match`; representação igual retorna 304 sem corpo, com ETag. Respostas 200/304 usam `Cache-Control: private, no-cache` e `Vary: Authorization`. Produção e contagens regressivas podem mudar o ETag sem mudar `stateVersion`; não se promete 304 só porque nenhum evento foi persistido. Não inserir horário da requisição nem `requestId` nesse corpo. Respostas de autenticação e comandos usam `Cache-Control: no-store`.
- **Cliente após reenvio:** o SDK expõe o cabeçalho `X-Lords-Replayed` como metadado. A UI não reaplica eventos nem substitui a tela por um recibo antigo; busca `/view` e `/events` a partir do último cursor. `stateVersion` e ETag têm finalidades distintas; o cache local deve ser separado por servidor, conta e partida. Decisões e cenários: [ADR 0004](docs/decisions/0004-comandos-e-cache-http.md).
- Escrita sempre do estado completo (JSONB inteiro), sem patches parciais. Tamanho do estado e duração de `advanceTo` são medidos; alvo de p95 abaixo de 50 ms por requisição.

### 14.9 Tempo, relógio e job de avanço

- Relógio do servidor em UTC, com NTP ativo no host. Tempo de jogo = `(agora − yearStart) × timeScale`. A Hora da Vigília é convertida para UTC a partir de `timezone` e `vigil_hour` no momento do agendamento.
- **Avanço preguiçoso** nas leituras de partida e comandos novos (§14.8), mais um **job horário** (`advance-stale-games`) que avança partidas sem estado persistido há mais de 1 h, em lotes de 100 com `FOR UPDATE SKIP LOCKED`. Garante que Crônicas, rankings e eventos existam para quem sumiu e espalha a carga do dia 7.
- Nenhum temporizador por partida em memória. O processo pode reiniciar a qualquer momento sem efeito no jogo.

### 14.10 Cliente web

- O app usa o `client-sdk`. Com a aba do navegador visível, um ciclo de 30 s chama `GET /view` com ETag e `GET /events?after=` e converte eventos em notificações conforme a política (§13.5). Com a aba em segundo plano (`document.visibilityState`), o ciclo cai para 2 min e só atualiza a barra de status, o título da aba e os badges.
- Cache do último `ViewState` no armazenamento do navegador para exibição sem conexão (§13.9). Comandos nunca ficam em fila local: ou chegam ao servidor ou o jogador é avisado na hora.
- SDK e app seguem o contrato de recibos e ETag da §14.8; após `GAME_RULE`, exibem o estado avançado de `details`. Após logout, exclusão ou sessão revogada, apagam tokens, `ViewState`, ETag e cursor da conta local, evitando exibir progresso privado como se fosse apenas uma falha de rede.
- **Várias abas** do mesmo navegador dividem a sessão. Só uma aba renova o refresh token por vez (Web Locks API), e as outras passam a usar o token novo; sair ou perder a sessão em uma aba vale para todas.
- Preferências guardadas no navegador: notificações (`silent` · `essential` · `all`), modo discreto, tema e Hora da Vigília. O endereço do servidor não é uma preferência: o app fala com a própria origem.
- O app é servido na mesma origem da API (§14.13); não há CORS.

### 14.11 Modelo de dados do jogo (conceitual, vive em `games.state`)

```ts
type Resource = 'food' | 'wood' | 'stone' | 'gold' | 'iron' | 'weapons';
type Season = 'spring' | 'summer' | 'autumn' | 'winter';
type UnitType = 'spearman' | 'swordsman' | 'archer' | 'knight' | 'shieldbearer' | 'militia';
type Wing = 'left' | 'center' | 'right'; type Row = 'front' | 'back';

type GameState = {
  schemaVersion: number;
  seed: string; difficulty: 'peasant' | 'lord' | 'ironKing'; timeScale: 1 | 2 | 0.5;
  settings: { timezone: string; vigilHourLocal: number };
  clock: { gameTimeMs: number; yearStartMs: number; year: number };
  lastProcessedAt: number;                                   // tempo de jogo
  rng: Record<string, number[]>;                             // estado por fluxo
  settlement: {
    name: string; moral: number;
    resources: Record<Resource, number>;                     // milésimos
    accumulators: Record<Resource, number>;
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
  legacy: { points: number; unlocked: string[]; vows: string[] };
  stats: Record<string, number>;
};
```

Capacidade habitacional, limite de exército e caps de armazenamento são **derivados** dos edifícios em funções puras, nunca persistidos. A Crônica e os eventos ficam fora do `GameState` (tabelas `chronicles` e `game_events`); o motor apenas os **emite** como saída de `advanceTo` e `applyCommand`.

### 14.12 Estado do cliente

O app é uma página só. O estado da interface é reduzido a partir do que o servidor manda: o `ViewState`, os eventos, o estado da conexão e o da conta. Os componentes recebem o `ViewState` já pronto, não o `GameState`, e nunca calculam regras: um número que a interface precise mostrar e não esteja no `ViewState` é acrescentado no motor. Toda validação acontece no servidor; o app só valida a forma (zod de `protocol`) para falhar cedo.

### 14.13 Hospedagem e operação

Instalação de referência para dezenas a algumas centenas de jogadores: **um servidor** (2 vCPU, 2 a 4 GB de RAM, 40 GB de SSD) com [Coolify](https://coolify.io), em três recursos ([ADR 0009](docs/decisions/0009-implantacao-no-coolify.md)):

```yaml
proxy:     # da plataforma (Traefik): TLS automático (Let's Encrypt), HTTP → HTTPS; /v1 vai para a API e o resto para o app
lotg-web:  # imagem do alvo web: Caddy servindo os arquivos do app em HTTP, com os cabeçalhos de segurança
lotg-api:  # imagem do alvo runtime; roda migrações no arranque; stateless (2+ réplicas quando precisar)
lotg-db:   # postgres:16 com volume persistente e sem porta publicada; pg_dump diário agendado na plataforma
```

O contrato não depende do Coolify: qualquer hospedagem serve, desde que o app e a API fiquem na **mesma origem**, a rota `/v1` chegue inteira à API, o banco não seja acessível de fora e `TRUST_PROXY=true` só exista atrás de um proxy.

- Variáveis: `DATABASE_URL`, `JWT_SECRET` e `RECOVERY_CODE_SECRET` (cada um com 32+ bytes aleatórios independentes), `PUBLIC_URL`, `RATE_LIMIT_*`, `LOG_LEVEL`, `GAME_TIME_SCALE` (ritmo das partidas novas, §4.2), `GITHUB_CLIENT_ID` (identificador público do OAuth App usado no *device flow*; vazio deixa o vínculo desligado, como na v0.1 em produção). Não há segredo de GitHub: a validação usa o token do próprio usuário. Preservar a chave de recuperação nas atualizações e restaurações.
- Logs JSON (pino) via `docker logs` ou Loki; `GET /health` consultado por um monitor externo a cada minuto.
- Atualizar: novo deploy da API e do app a partir do `main`; o contêiner novo só recebe tráfego depois de passar no health check. Reverter: voltar à imagem do deploy anterior (a plataforma guarda as duas últimas); migrações sempre compatíveis com a versão anterior (expandir, depois contrair).
- Dimensionamento: um processo Node com `GET /view` de 100 KB e `advanceTo` de poucos milissegundos tem como alvo centenas de clientes em polling de 30 s, a confirmar por carga. Antes de milhares: medir custo de avanço, escrita e autorização; avaliar Postgres gerenciado e 2+ réplicas da API. Cache de `ViewState` não pode depender só de `stateVersion`, porque a representação também muda com o tempo (§14.8).
- Ambiente de desenvolvimento: `pnpm dev:up`, `pnpm dev:api` e `pnpm dev:web`; o servidor de desenvolvimento do app encaminha `/v1` para `http://localhost:3000`, então também em desenvolvimento o app e a API ficam na mesma origem.

### 14.14 Segurança e privacidade

HTTPS obrigatório; tokens no armazenamento do navegador, protegidos por uma política de conteúdo (CSP) sem `unsafe-inline`, sem `eval` e sem origens externas, e por nenhum script de terceiros na página; refresh rotativo com histórico completo por sessão e revogação consultada no banco; limites de taxa por IP e por sessão; validação zod de toda entrada (compartilhada com o cliente, que erra cedo, enquanto o servidor nunca confia); corpos limitados; cabeçalhos de segurança no Caddy; dependências auditadas em CI. Dados da conta: nome de exibição, `github_id` opcional, rótulo da máquina, datas de acesso e hashes de credenciais; progresso, comandos e recibos ficam vinculados à conta. Política de privacidade no README e no item "Conta" do app deve explicar bloqueio imediato, expurgo após sete dias pelo job e retenção de backups (§14.7). Exclusão pelo app, com confirmação e limpeza do cache local; não há recuperação da conta excluída na v0.1.

### 14.15 Multiplayer futuro (não construir agora)

A base já é um servidor autoritativo com motor compartilhado. Alianças, mercado entre jogadores e PvP acrescentam **comandos que afetam duas partidas** (transação sobre duas linhas, travadas em ordem determinística por `game_id`) e um canal de eventos entre contas. Nada disso exige refazer o que está aqui. Regras já decididas: proteção a novatos (sem PvP no primeiro ano), janelas de ataque na Hora da Vigília do defensor e registro completo de operações (a tabela `commands` já existe).

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

Bots com estratégias (`econômico`, `militar`, `explorador`, `preguiçoso`) jogam anos inteiros em segundos, emitindo CSV com recursos, população, exército, resultado do cerco e Legado por semente. Um teste de CI roda 50 sementes por perfil e falha se as metas da §15.2 saírem da faixa. É assim que os números deste documento serão corrigidos, não por achismo. Os mesmos bots rodam contra um servidor local pelo `client-sdk` para teste de carga (ex.: 300 bots em polling de 30 s) e de regressão da API.

### 15.4 Testes automatizados

- **Unitários:** produção, consumo, custos, gates, filas, escassez, moral, cartas, expedições, batalha (tabelas de contra-ataque, muralha, flanco, moral).
- **Propriedade (fast-check):** invariante de `advanceTo` por segmentos; recursos nunca negativos nem acima do cap; nenhum comando duplica recursos.
- **Golden tests:** relatórios de batalha e de expedição para sementes fixas (qualquer mudança de regra é visível no diff).
- **Conteúdo:** schemas zod em todo JSON; grafos acíclicos; flags consistentes.
- **Migração:** estados com `schemaVersion` antigo carregam e migram no servidor.
- **API e banco:** integração com PostgreSQL real (Docker) cobrindo recibos idênticos após reinício e outros comandos, conflito de UUID com payload diferente, avanço persistido mesmo em recusa, dois clientes concorrentes, ETag alterado sem escrita, reuso após múltiplas rotações, revogação entre instâncias e exclusão em duas etapas (§14.7–14.8).
- **Carga:** `sim-cli` contra servidor local, com metas de p95.
- **Integração do cliente:** o app web em um navegador real (sem interface) contra um servidor local: entrada, comandos, ETag, eventos, cache sem conexão, teclado e temas.

### 15.5 Métricas

O servidor já guarda comandos e eventos. Métricas de balanceamento (sessões por dia, decisões por sessão, dia do primeiro herói, resultado do cerco por perfil, abandono por dia da semana) saem de consultas SQL em `deploy/analytics/*.sql`, sempre agregadas e sem nome de jogador. O jogador vê as próprias estatísticas na aba Crônica. Nada é enviado a terceiros e não há SDK de telemetria no cliente.

---

## 16. Roadmap, escopo por versão e critérios de aceitação

| Versão | Nome | Entrega | O que o jogador sente |
|---|---|---|---|
| v0.1 | Fundação online | Servidor Node.js + PostgreSQL, conta em um clique, vínculo GitHub e Código do Reino, economia, construção, trabalhadores, avanço no servidor, calendário visível, Objetivos básicos, Crônica simples | "Minha aldeia cresce enquanto trabalho, de qualquer máquina" |
| v0.2 | Estações e Conselho | Estações, armazenamento, moral, troca de ofício, cartas e cadeias, Torre de Vigia, Paliçada, lobos, dificuldade, ritmo | "O mundo muda e me pede decisões" |
| v0.3 | Guilda | Taverna, heróis, expedições com encruzilhadas, Mercado e caravanas, Mestres | "Tenho uma equipe e histórias para contar" |
| v0.4 | Guerra e Cerco | Quartel, Ferreiro, ferro e armas, Muralha, formações, Conselho de Guerra, Horda adaptativa, presságios, Fortaleza e sabotagem, Cerco, milícia, Crônica do Ano | **A semana completa.** "Passei a semana me preparando e valeu" |
| v0.5 | Mundo e Legado | Mapa hexagonal, postos avançados, Capela e relíquias, Legado, Votos, anos seguintes, sementes, Temporadas semanais com ranking | "Quero jogar o Ano 2 de outro jeito" |
| v0.6 | Polimento | Academia, Feitos completos, som opcional, acessibilidade auditada, desempenho, localização en-US | Pronto para divulgação ampla |
| v1.0 | Multiplayer | Alianças, mercado entre jogadores, PvP, proteção a novatos | Mundo compartilhado |

### 16.1 Escopo exato da v0.1 — Fundação online

**Implementar:**

- [ ] App web com aparência de editor: barra de atividades, árvore lateral, área central em abas, barra de status e paleta de comandos.
- [ ] Estado inicial reproduzível de Pedra Alta com semente.
- [ ] Recursos comida, madeira, pedra e ouro; alocação e realocação de aldeões (grátis nesta versão).
- [ ] Produção e consumo contínuos com `advanceTo` por segmentos, aritmética inteira e invariante de divisão de intervalo testado.
- [ ] Calendário: estação e dia de jogo visíveis (sem efeitos de estação ainda); `timeScale` definido pelo servidor, 3 nas partidas novas (§4.2, [ADR 0011](docs/decisions/0011-ritmo-3x-no-mvp.md)), sem escolha pelo jogador.
- [ ] Salão do Senhor, Fazenda, Serraria, Pedreira, Mina, Habitações com níveis, custos e tempos vindos de `content`.
- [ ] Uma fila de obra ativa, planejamento visual, cancelamento com devolução de 80%.
- [ ] Recrutamento com limite habitacional, custo e fila.
- [ ] Escassez determinística (§5.6, sem abandono de aldeões).
- [ ] Objetivos 1–4 da §12.2.
- [ ] Crônica simples (log de eventos) e Relatório de Retorno após 4 h.
- [ ] Servidor Fastify + PostgreSQL com migrações, `GET /health`, `GET /version`, Docker Compose para desenvolvimento e produção no Coolify (§14.13, [ADR 0009](docs/decisions/0009-implantacao-no-coolify.md)).
- [ ] Contas: anônima em um clique, vínculo GitHub por *device flow*, Código do Reino, refresh rotativo, sair da máquina e excluir conta. Na v0.1 o vínculo GitHub fica desligado em produção e o critério 10 fecha pelo Código do Reino (ADR 0008, ponto 2).
- [ ] Partidas no servidor: `POST /games`, `GET /view` com ETag, `POST /commands` idempotente e transacional, `GET /events`, job horário de avanço.
- [ ] Pacotes `protocol` e `client-sdk` compartilhados; o app web não contém o motor.
- [ ] Tela de boas-vindas (§13.9), cache do último estado e modo sem conexão.
- [ ] Paleta de comandos com ir para o Feudo, alocar, construir, recrutar, reiniciar (com confirmação), vincular conta e gerar Código do Reino.
- [ ] Testes unitários e de propriedade do motor; teste de conteúdo com zod.

**Não implementar:** estações com efeito, cartas, heróis, exército, mapa, mercado, Temporadas, interação entre jogadores, som.

**Critérios de aceitação:**

1. Abrir o endereço, clicar em **Jogar agora** e dar o primeiro comando em menos de 30 segundos, sem instalar nada, sem e-mail, senha ou formulário.
2. Alocar um trabalhador a mais na Serraria altera a taxa de madeira/h imediatamente e reduz os livres.
3. Não é possível alocar mais que a população nem gastar o que não existe; o motivo da recusa aparece na UI.
4. Uma melhoria desconta recursos uma única vez, ocupa a fila e conclui no tempo configurado.
5. Fechar a aba por horas e reabrir mostra o intervalo simulado pelo servidor sem duplicar progresso; `advanceTo` por partes dá o mesmo resultado que de uma vez (teste de propriedade).
6. Escassez tratada corretamente em longos períodos offline, com o momento exato registrado na Crônica.
7. Reiniciar o servidor no meio do dia (reiniciar a API na plataforma de hospedagem; hoje, o recurso `lotg-api` no Coolify) não perde nem duplica nada; reenviar o mesmo `commandId` na mesma partida devolve status e corpo originais sem reaplicar, inclusive recusas; payload diferente com o mesmo UUID é recusado. O avanço do mundo persiste mesmo se a ação nova for recusada. Dois clientes na mesma conta não corrompem o estado (§14.8).
8. Todas as regras rodam em testes sem navegador nem servidor.
9. O app tem tema claro, escuro e de alto contraste e é navegável por teclado, inclusive a paleta de comandos.
10. Vincular ao GitHub ou usar o Código do Reino em outra máquina mostra o mesmo feudo em segundos.
11. Sem conexão, o app mostra o último estado conhecido, explica a situação e volta sozinho quando o servidor responde.
12. Excluir a conta bloqueia imediatamente acesso por JWT, refresh, GitHub e Código do Reino, remove a conta das consultas da API e limpa o cache local em todas as abas. No primeiro job a partir de `deletedAt + 7 dias`, conta, partidas, comandos/recibos, eventos, Crônicas, sessões e hashes de refresh são removidos do banco em cascata. Testes verificam separadamente bloqueio imediato, retenção antes do prazo e expurgo no limite; backups seguem os 14 dias de retenção da §14.7.

### 16.2 Critérios de aceitação das versões seguintes (resumo)

- **v0.2:** o estoque para no cap e o painel mostra "cheio em"; uma carta aparece a cada 8 h e expira em 24 h com a opção padrão; uma cadeia de 3 cartas funciona ponta a ponta; a incursão de lobos do dia 2 acontece offline e aparece no Relatório; a troca de ofício reduz a produção por 2 h; dificuldade e ritmo são escolhidos na criação.
- **v0.3:** o primeiro herói chega pela carta do dia 2; uma expedição para na encruzilhada, notifica, e após 6 h sem resposta segue a Postura; o relatório narra nó a nó; o Mercado respeita o volume diário; uma caravana pode ser emboscada.
- **v0.4:** uma formação salva defende offline; a prévia e a batalha real usam o mesmo código (golden test); a Horda altera a composição em resposta à última formação (teste determinístico); o cerco ocorre na Hora da Vigília com 3 ondas e Plano de Batalha; a Crônica do Ano é gerada e exportável em Markdown; o perfil Regular do `sim-cli` fica em 65–80% de Vitória.
- **v0.5:** mapa hexagonal com névoa em 3 estados; posto avançado produz; Legado e Votos aplicados ao Ano 2; duas partidas com a mesma semente geram o mesmo mapa e as mesmas cartas elegíveis; uma Temporada abre toda segunda-feira, aceita entradas até terça e publica o ranking ao fim da semana.

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
| Preact no app web | Vanilla; React/Vue | O editor de formação e a prévia justificam componentes; Preact pesa 3 KB |
| **Online desde a v0.1**, servidor autoritativo em Node.js + PostgreSQL | Local primeiro e sincronizar depois; local para sempre | Duas camadas de persistência dobram o trabalho, e um migrador local→nuvem seria um vetor de trapaça; com o motor puro, o servidor é uma camada fina |
| Conta **anônima em um clique**, vínculo opcional por GitHub (*device flow*) ou Código do Reino | E-mail e senha; link mágico por e-mail; só GitHub | Zero burocracia para começar, recuperação para quem quiser, nenhum serviço de e-mail para operar e nenhum segredo de OAuth no servidor |
| **App web com aparência de editor**, em vez de extensão do VS Code | Extensão do VS Code (implementada até a Fase 3 e descartada); os dois clientes em paralelo | O jogo não exige o VS Code nem instalação, e o cliente pode ser testado em um navegador real; a fantasia de "ferramenta de trabalho" se mantém pela aparência ([ADR 0008](docs/decisions/0008-cliente-web-com-aparencia-de-editor.md)) |
| Estado inteiro em JSONB + log de comandos | Tabelas normalizadas por subsistema | O motor é a fonte de verdade e muda a cada versão; JSONB evita migração de esquema a cada mecânica, e o log dá replay e auditoria |
| Avanço preguiçoso por requisição + job horário | Loop de simulação contínuo no servidor | Custo zero sem ninguém jogando, reinícios sem efeito e o mesmo resultado em qualquer horário de cálculo |
| Fastify + Drizzle + zod compartilhado | NestJS; Express; Prisma | Menos camadas para um time pequeno ou um agente; validação e tipos vêm do mesmo pacote `protocol` |
| Uma partida ativa por conta; anos sucessivos no mesmo registro | Várias partidas paralelas | Simplifica ranking, cache e a pergunta "qual feudo abrir" |
| Sem upload de saves locais | Importar JSON do jogador | Qualquer importação seria trapaça gratuita em um jogo com ranking |
| Recibo completo por comando; recusa preserva o avanço do mundo | Recalcular a resposta no reenvio; rollback de toda recusa | Reenvios após timeout têm resultado estável e não apagam eventos ocorridos na ausência ([ADR 0004](docs/decisions/0004-comandos-e-cache-http.md)) |
| Histórico de refresh por sessão, sem cache positivo de autorização | Guardar só o token anterior; cache de 60 s | Detectar reuso de qualquer antecessor e bloquear novas requisições após revogação, inclusive entre instâncias ([ADR 0005](docs/decisions/0005-sessoes-e-exclusao.md)) |
| ETag da resposta; versão persistida em cabeçalho de aviso separado | Usar `stateVersion` como ETag e `If-Match` como aviso | Produção contínua muda a tela sem escrita no banco; cache e aviso de concorrência têm contratos distintos ([ADR 0004](docs/decisions/0004-comandos-e-cache-http.md)) |
| Código do Reino com HMAC-SHA256 e chave própria | Argon2id; chave derivada do segredo JWT | Busca direta do código aleatório sem acoplar sua validade à troca da chave JWT ([ADR 0003](docs/decisions/0003-codigo-do-reino-hmac.md)) |

### 17.2 Questões em aberto (não bloqueiam nenhuma versão)

- A Horda deve lembrar das formações entre anos com que peso? (Proposta: 50% do peso do ano corrente.)
- Caravanas e mercado devem existir já na v0.2 (sem heróis como escolta) para dar saída ao excedente antes do cap?
- O Plano de Batalha por onda deve permitir também "reparo automático se pedra ≥ X"?
- Relíquias devem ter desvantagens (maldições) para não serem sempre boas?
- Mundo apenas humano ou com facções e raças a partir do Legado?
- No multiplayer, o cerco é compartilhado por aliança (defender juntos) ou individual?
- Quantos anos até o conteúdo repetir para um jogador Dedicado? (Meta: 3 anos sem repetir cartas de cadeia.)
- A Temporada começa na segunda-feira de qual fuso? (Proposta: o fuso do servidor, exibido no painel.)
- Vale moderar nomes de exibição quando houver ranking público?
- Oferecer um "modo offline sem conta" (motor dentro do app web, sem ranking) para quem não quer servidor? Custa pouco graças ao motor puro, mas duplica o caminho de persistência.

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

> **Objetivo:** implementar exatamente a §16.1, seguindo a arquitetura da §14.
>
> 1. Leia este `GAME_DESIGN.md` por inteiro antes de escrever código. Trate §14 como contrato de arquitetura e §16.1 como escopo.
> 2. Crie o monorepo (pnpm workspaces) com `packages/engine`, `content`, `protocol`, `server`, `client-sdk`, `sim-cli` e `web`, mais a pasta `deploy/`.
> 3. Implemente primeiro o motor: `GameState`, `createInitialState(seed, settings)`, `advanceTo(state, gameTimeMs)` por segmentos com aritmética inteira, RNG com fluxos nomeados, `applyCommand(state, command)` com validação e motivos de recusa, e a emissão de eventos e linhas de Crônica como saída.
> 4. Escreva os testes do motor antes da UI e do servidor: produção, consumo, escassez determinística, custos, fila única, gates por Salão, cancelamento, recrutamento e o teste de propriedade do invariante de `advanceTo`.
> 5. Coloque **todos** os números em `packages/content` com schemas zod validados em teste; defina `Command` e `ViewState` em `packages/protocol`.
> 6. Implemente o servidor: migrações SQL; `POST /auth/anonymous`, `/auth/github`, `/auth/recovery-code`, `/auth/recover`, `/auth/refresh`, `/auth/logout`; `/me`; `/games`; `/games/:id/view` com ETag; `/games/:id/commands` idempotente em transação com `FOR UPDATE`; `/games/:id/events`; `/health`; `/version`; limites de taxa; e o job `advance-stale-games`. Testes de integração com PostgreSQL em Docker.
> 7. Implemente o `client-sdk` tipado e o app web: aba de boas-vindas, credenciais e cache no navegador, árvore lateral, abas Hoje e Feudo, barra de status, paleta de comandos, ciclo de 30 s com ETag e modo sem conexão.
> 8. Dê ao app a aparência de um editor só com variáveis de tema (`--vscode-*`), três temas, navegação por teclado e tooltips explicativos em todos os números.
> 9. Escreva `deploy/docker-compose.yml` (caddy, api, db), `deploy/docker-compose.dev.yml`, `deploy/backup.sh` e um `README.md` com: instalar, rodar o banco local, rodar o servidor, rodar o app web, testar, e **implantar em um VPS do zero em dez passos**.
> 10. Não adicione interação entre jogadores, pagamentos, telemetria de terceiros, som, nem bibliotecas além de TypeScript, esbuild (ou equivalente), Vitest, fast-check, zod, Preact, Fastify, pg, Drizzle, jose e pino. Hashes e HMAC usam `node:crypto` somente no servidor.

### 18.2 Tarefas seguintes (uma por versão)

- **v0.2:** §4, §5.4–5.7, §6 (Celeiro, Armazém, Torre, Paliçada), §7 com as 60 cartas do Apêndice B como ponto de partida, §8.2 (lobos e Ameaça com tiles abstratos), §12.1. Critérios em §16.2.
- **v0.3:** §9 completo, §5.9. Grafos de expedição com 3 variantes por modelo.
- **v0.4:** §10, §11.1–11.4, §8.3, §9.5. `sim-cli` com os quatro perfis e teste de faixa da §15.2.
- **v0.5:** §8.1, §11.5, §11.6 (Temporadas e ranking), Capela e relíquias.

### 18.3 Regras permanentes para qualquer tarefa

- Nunca fixar números de demonstração na UI: o app exibe o `ViewState` que o motor produz.
- Nunca mudar uma regra sem atualizar o golden test correspondente e esta especificação.
- Toda nova mecânica entra com: dados em `content`, validação de comando, evento na Crônica, tooltip explicativo e teste.
- Conteúdo narrativo (cartas, relatórios, Crônica) em português do Brasil, tom de crônica medieval, frases curtas.
- Nenhuma regra de jogo no servidor fora do motor, e nenhuma no cliente: o servidor orquestra, o motor decide, o app exibe.

### 18.4 Checklist de implantação (para quem hospeda)

O passo a passo completo e o registro dos ensaios ficam em [`deploy/README.md`](deploy/README.md).

1. Servidor com Coolify; domínio apontando para o IP (registro A).
2. Criar o banco `lotg-db` (PostgreSQL 16, sem porta publicada) e a aplicação `lotg-api` (alvo `runtime`, rota `https://<domínio>/v1` sem remoção de prefixo). Gerar `JWT_SECRET` e `RECOVERY_CODE_SECRET` independentemente (duas execuções de `openssl rand -base64 48`); definir `DATABASE_URL`, `PUBLIC_URL` e `TRUST_PROXY=true`. Guardar a chave de recuperação junto aos segredos operacionais para restauração; nunca regenerá-la em cada deploy.
3. Criar a aplicação `lotg-web` (alvo `web`, rota `https://<domínio>`) e fazer o deploy das duas: o proxy obtém o certificado e a API aplica as migrações.
4. Conferir `https://<domínio>/v1/health` e `/v1/version`; abrir o domínio em um navegador limpo e jogar.
5. Agendar o backup diário do banco, com retenção de 14 dias, e ensaiar uma restauração em um banco descartável.
6. Registrar o OAuth App do GitHub e definir `GITHUB_CLIENT_ID` (opcional: vazio deixa o vínculo desligado).
7. Atualizar com um novo deploy; reverter para a imagem do deploy anterior.

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
| Conta anônima | Conta criada no primeiro clique, sem e-mail nem senha; vinculável depois |
| Código do Reino | Código de recuperação mostrado uma vez, usado para assumir a conta em outra máquina |
| Comando | Única forma de alterar o estado: validado e aplicado pelo servidor, idempotente por `commandId` |
| ViewState | Estado derivado e formatado que o servidor devolve para exibição; nunca contém a composição inimiga real |
| Temporada | Semana compartilhada com semente única e ranking, sem interação entre feudos |
