# Roadmap da v0.5 — "Mundo e Legado"

> **Versão 0.1 do plano**, escrita em 2026-11-17, logo depois da publicação da v0.4.0
> (`333df054`, estado 42, protocolo 4). Rascunho para o autor responder às decisões da §4.
> Fonte das regras: GDD §8.1, §11.5, §11.6, a tabela de edifícios (Capela) e o Apêndice D
> (relíquias); critérios de aceitação no GDD §16.2.

## 0. Por que este plano é diferente dos anteriores

A v0.4 levou um mês. Medido no próprio Registro, a maior parte do tempo **não** foi escrever
mecânica: foi esperar e consertar o portão inteiro (o `pnpm verify` com a matriz do
simulador leva ~32 min; o portão completo, ~1h30), remedir faixas de balanceamento a cada
mudança de número, reescrever testes de expectativa exata e manter documentos de registro
muito longos. O autor pediu (2026-11-17): **entregar rápido, sem rodar a suíte inteira a cada
alteração, com funções que divirtam quem joga.**

Princípios desta versão:

1. **Jogador primeiro.** Cada fase termina com algo que o jogador vê e usa, e é publicada.
   Nada de fase "só de motor" que fica semanas parada esperando a tela.
2. **Publicar por fase.** Cada fase é uma publicação pequena (como na v0.2), com backup
   antes. Feedback real de jogadores vale mais que mais uma rodada de matriz.
3. **A CI é o portão pesado; o agente roda só o que tocou.** Ver §2.
4. **Balanceamento por observação, não por faixa exata.** A matriz roda uma vez por fase,
   no fechamento. Faixa que sai do lugar vira linha no balance e pergunta ao autor, não
   bloqueio de tarefa.
5. **Documentar curto.** Uma linha por tarefa no Registro (§9). O CLAUDE.md deixa de
   acumular a história (§3, tarefa V5A-T1).
6. **Escopo enxuto do GDD.** Onde o GDD pede muito (Legado com cenários, classes e unidades
   novas; dois inimigos novos), a v0.5 entrega o **mínimo que já diverte** e deixa o resto
   para a v0.6, com a decisão do autor (§4).

## 1. O que o jogador sente ao fim da v0.5

> "Quero jogar o Ano 2 de outro jeito."

- Abre a aba **Mapa** e vê Pedra Alta no centro de uma grade de hexágonos, com névoa, o
  Covil, o Acampamento, a Fortaleza no norte e os destinos das expedições **no lugar**.
- **Reivindica postos avançados** (Veio de Ferro, Floresta, Campos, Colinas) que produzem e
  que a Horda pode atacar.
- Ergue a **Capela** e guarda **relíquias** lendárias achadas nas expedições, cada uma com
  um efeito que muda o jeito de jogar.
- Fecha o ano, ganha **Legado** e começa o **Ano 2** escolhendo **Votos** (dificuldade a mais
  em troca de mais Legado), contra uma Horda maior e com um **inimigo novo**.
- Toda segunda-feira entra numa **Temporada**: a mesma semente para todos, e um **ranking da
  semana** com a Crônica do Ano de cada feudo.

## 2. Regime de trabalho rápido (vale para toda a v0.5)

### 2.1 O que o agente roda em cada tarefa (minutos, não horas)

- `pnpm typecheck` (ou só do pacote tocado).
- **Os testes dos arquivos que tocou**, pelo nome: `pnpm --filter @lotg/engine test -- relics`.
- Goldens tocados: `UPDATE_GOLDEN=1` no arquivo, conferir o diff e seguir.
- Mexeu na tela? Um cenário e2e **novo ou alterado**, só ele: `pnpm test:e2e 12-mapa`.
- **Não** roda `pnpm verify` inteiro, a matriz, a integração inteira nem o e2e inteiro.
- `nice -n 19` e Vitest com `--maxWorkers=2` continuam valendo (a máquina é do autor).

### 2.2 Quem roda o pesado

- **A CI no GitHub**, em branch: a tarefa V5A-T2 faz o `ci.yml` rodar em `push` para branches
  `v5-*` **sem o job de deploy**. O agente dá `push` no branch da fase (não no `main`) e
  confere o resultado com `gh run watch`. O computador do autor fica livre.
- **A matriz do simulador sai do `pnpm test`** (V5A-T2): vira `pnpm test:matrix`, que roda
  na CI do fechamento de fase e quando o agente mexer em número de balanceamento.
- **Portão completo local** só se a CI não puder provar algo (ex.: captura da landing).

### 2.3 O que não muda (são as regras que protegem os jogadores)

- O motor decide, o servidor orquestra, o app exibe; nenhum número fora de `content`.
- Toda mudança de forma do `GameState` tem passo de migração (`migrations/`) e retrato.
- Determinismo: sorteios só em `advanceTo`, fluxos nomeados, `nextId`.
- Névoa no servidor: o que o jogador não sabe não sai na visão (agora vale também para o mapa).
- Backup manual antes de todo `push` no `main` que sobe a versão do estado.
- `push` no `main` é publicar: só com o autor autorizando a fase.

### 2.4 Agentes e modelos

Ordem já combinada para este repositório: Codex (gpt-6.1-sol, xhigh) → Gemini Argon → outros
do agy → Claude por último. A sessão principal coordena, revisa o diff e as capturas de tela,
e recusa código ruim ou tela feia. Tarefas independentes da mesma fase podem correr em
worktrees separados (ex.: tela do mapa e relíquias), com uma junção por fase.

## 3. Ponto de partida (o que a v0.4 deixa pronto)

- **Tiles abstratos** desde a v0.2 (`map.tiles`: Covil, Acampamento, Fortaleza) e destinos por
  descoberta (`map.discovered`) desde a v0.3: o mapa é, em boa parte, **uma camada de
  interface e de geometria** sobre dados que já existem.
- **Semente** por partida (`world.seed`) e sorteio determinístico: falta só mostrá-la e deixar
  escolher.
- **Ano 2 já começa**: o Cerco termina, vem o rescaldo e a "Primavera da Reconstrução"; o
  feudo continua. Falta o que muda no Ano 2 (ondas maiores, inimigo novo, Votos, Legado).
- **Crônica do Ano** com pontuação e Feitos, exportável: é a base do Legado e do ranking.
- **Aba Reino** com totais e ranking de ouro ([ADR 0021](decisions/0021-estatisticas-e-ranking.md)):
  base do ranking da Temporada.
- **Uma partida ativa por conta** (`games_one_active_per_account`): a Temporada precisa decidir
  como convive com a partida pessoal (D-5).
- **Itens** com quatro raridades; o Lendário ficou reservado às relíquias.

## 4. Decisões do autor (um lote só, com recomendação)

Responder de uma vez antes da Fase B. Sem resposta, vale a recomendada.

| # | Pergunta | Recomendação |
|---|---|---|
| D-1 | **Regime rápido** da §2 (CI em branch, matriz fora do `pnpm test`, testes só do que tocou, publicação por fase). | **Aprovar.** |
| D-2 | **Ordem das fases.** | **Capela → Mapa → Postos → Ano 2 e Votos → Temporadas**: começa pelo que é rápido e visível; o mapa vem cedo porque o resto se apoia nele. |
| D-3 | **Mapa:** grade hexagonal em SVG na aba nova "Mapa", raio 3 (37 tiles) crescendo até 5 com a Torre; navegável por teclado; a árvore e as listas continuam existindo. | **Aprovar.** Sem bibliotecas novas (SVG à mão). |
| D-4 | **Partidas em andamento ganham o mapa?** | **Sim**: o passo de migração gera a grade pela semente e posiciona os tiles e destinos que a partida já conhece; o que ela já explorou fica Explorado. |
| D-5 | **Temporada e partida pessoal.** | **Uma conta tem a pessoal e, por semana, uma da Temporada** (duas partidas ativas, trocadas por um seletor). A da Temporada termina com o ano e vai para o arquivo. |
| D-6 | **Legado na v0.5.** | **Mínimo:** pontos de Legado (pontuação do ano + Feitos) guardados na conta e gastos em **Votos mais fortes e um cenário novo (Serra do Ferro)**. Classes e unidades novas ficam para a v0.6. |
| D-7 | **Votos.** | Os cinco do GDD (Sem muralhas, Inverno longo, Horda astuta, Comida escassa, Heróis mortais), escolhidos na Primavera do Ano 2 em diante, com o bônus de Legado do GDD. |
| D-8 | **Inimigo novo do Ano 2.** | **Só os Trolls** na v0.5 (lentos, muita vida, fracos contra lanceiros). O Necromante fica para a v0.6. Ondas +10% por ano, como no GDD. |
| D-9 | **Relíquias.** | As **oito** do GDD, achadas em **expedições lendárias** (uma por variante nova das Ruínas e do Pântano) e no tile Santuário do mapa; a Capela tem 1 espaço por nível (até 3). |
| D-10 | **Postos avançados.** | Até 3, como no GDD; incursão pode **danificar** um posto (para de produzir até o reparo, que custa madeira e pedra). Sem guarnição própria na v0.5. |
| D-11 | **Ranking da Temporada.** | Pontuação da Crônica do Ano, com resultado do Cerco e Feitos; nome do feudo (como o ranking de ouro), com a mesma opção de sair. Ler a Crônica de outro feudo da mesma Temporada: **sim**, só a Crônica do Ano já fechada. |
| D-12 | **Conteúdo narrativo** (nomes de tiles, relíquias, frases). | Agente escreve, autor lê **por amostra** na publicação de cada fase. |

## 5. Fases e tarefas

Cada tarefa traz **tamanho** (P = uma sessão curta, M = uma sessão, G = duas ou mais),
**entregas**, **pronto quando** e **teste mínimo**. Commits `V5B-T1: …`.

### Fase A — Preparar o terreno (P, 1 sessão)

- **V5A-T1 · CLAUDE.md enxuto (P).** Mover os parágrafos de história das v0.2–v0.4 para
  `docs/historico.md`; o CLAUDE.md fica com o que orienta o trabalho (regras, comandos,
  arquitetura, regime da v0.5) e menos de ~350 linhas. *Pronto quando* nenhuma regra se perde
  (conferir item a item) e o arquivo cabe na leitura de um agente sem estourar contexto.
- **V5A-T2 · Portão rápido (P).** `pnpm test` sem a matriz (`test:matrix` à parte); `ci.yml`
  roda em `push` para `v5-*` sem o deploy; `pnpm verify:fast` (lint + typecheck + unit sem
  matriz). *Teste:* um `push` de branch dispara a CI e não implanta.
- **V5A-T3 · Decisões (P).** Registrar as respostas da §4 em `docs/decisions/0022-regras-da-v0.5.md`
  e criar `docs/pendencias-v0.5.md` (caixa de entrada curta).

### Fase B — Capela e relíquias (M) · publica

Ganho rápido: um edifício novo e oito objetos com personalidade.

- **V5B-T1 · Capela (M).** Edifício `chapel` (Salão Nv5; 200 madeira, 300 pedra, 200 ouro;
  até Nv3): +5 moral, heróis curam 25% mais rápido, 1 espaço de relíquia por nível. Estado novo
  (`settlement.relics`, `guild.relicVault`), migração, recusas legíveis, Crônica.
- **V5B-T2 · As oito relíquias (M).** Conteúdo em `packages/content/src/relics.ts`; efeitos
  como fatores já existentes (produção, moral, lenha, cap de comida, presságio, velocidade de
  expedição, impostos, ataque dos lobos). Ordem `placeRelic`/`removeRelic`. Origem:
  recompensa de expedição lendária (D-9). *Teste:* cada efeito com um teste de motor.
- **V5B-T3 · Expedições lendárias (M).** Uma variante lendária nas Ruínas de Vel'Thar e uma
  no Pântano, com relíquia garantida no Sucesso e risco alto.
- **V5B-T4 · Tela (M).** Capela na aba Feudo e um painel "Relíquias" na Guilda (o que cada
  uma faz, onde está, colocar/retirar); paleta e árvore. *Teste:* um cenário e2e.
- **Fechamento:** CI verde no branch, matriz uma vez, backup, publicação, 1 linha no Registro.

### Fase C — O mapa (G) · publica

A maior mudança visual desde a v0.1.

- **V5C-T1 · Grade e névoa no motor (G).** `map.grid` (coordenadas axiais, raio 3→5), tipos
  de tile do GDD, névoa em 4 estados (Desconhecido, Avistado, Explorado, Reivindicado), a
  geração determinística pela semente, os tiles atuais (Covil, Acampamento, Fortaleza) e os
  destinos de expedição **posicionados** na grade. Migração (D-4). *Teste:* mesma semente →
  mesmo mapa (critério do GDD); névoa nunca vaza na visão.
- **V5C-T2 · Revelação (M).** Torre revela anéis; Patrulha revela vizinhos do explorado;
  expedição explora o tile do destino; o Rastreador revela um tile a mais (o traço finalmente
  completo). Eventos e frases na Crônica.
- **V5C-T3 · Aba Mapa (G).** SVG de hexágonos com a paleta dos três temas, ícones Codicons,
  foco e navegação por setas, ficha do tile ao lado ("o que há aqui, o que dá para fazer":
  enviar expedição, atacar o Acampamento, sabotar a Fortaleza, reivindicar). Celular: a grade
  cabe na largura. *Teste:* um e2e de navegação e um de ação a partir do mapa.
- **Fechamento** como na Fase B, mais a captura da landing (`pnpm capture:landing`) com o mapa.

### Fase D — Postos avançados (M) · publica

- **V5D-T1 · Reivindicar e produzir (M).** Ordem `claimOutpost { tileId }` (pede o tile
  Explorado e o Salão Nv5); até 3; produção: Veio de Ferro 3 ferro/h, Floresta +15% madeira,
  Campos +15% comida, Colinas +15% pedra (termos novos na explicação da produção).
- **V5D-T2 · Postos sob ataque (M).** A incursão pode mirar um posto (sorteio na marcação, no
  fluxo `horde`); posto danificado para de produzir até `repairOutpost`. A Horda que aprende
  passa a considerar postos expostos.
- **V5D-T3 · Tela (P).** Ações no mapa e linha na árvore; aviso de posto atacado.

### Fase E — O Ano 2 de outro jeito (G) · publica

- **V5E-T1 · Escala do Ano N (M).** Ondas +10% por ano; a Horda lembra a formação do ano
  anterior com peso reduzido; a Crônica do Ano numera os anos.
- **V5E-T2 · Trolls (M).** Unidade inimiga nova a partir do Ano 2 (D-8), com presságio
  próprio e entrada na prévia do Conselho de Guerra.
- **V5E-T3 · Votos (M).** Escolha na abertura do ano (ordem `takeVows`, até a primeira
  virada da Primavera); cinco efeitos e o bônus de Legado; a Crônica e o Relatório os mostram.
- **V5E-T4 · Legado mínimo (M).** Pontos na **conta** (coluna nova no servidor; o motor só
  calcula quantos o ano rende); loja curta: Votos mais fortes e o cenário **Serra do Ferro**
  (semente com mais Veios e mais Colinas, Horda com mais Saqueadores). Não dá poder bruto.
- **V5E-T5 · Tela (M).** Folha "Fim do ano" com Legado ganho, a escolha dos Votos e a loja.

### Fase F — Sementes e Temporadas (G) · publica

- **V5F-T1 · Semente visível e desafio (P).** A semente aparece nas Preferências e na Crônica;
  "Nova partida com esta semente" (amigos jogam o mesmo mundo sem servidor especial).
- **V5F-T2 · Temporada no servidor (G).** Job semanal: segunda 00:00 (horário de Brasília)
  abre a Temporada com semente única; entrada até terça 23:59; partida da Temporada ao lado
  da pessoal (D-5; muda `games_one_active_per_account`); rotas `GET /seasons/current` e
  `GET /leaderboard?season=` do GDD.
- **V5F-T3 · Ranking e Crônicas (M).** Ranking da semana (D-11) na aba Reino; ler a Crônica
  do Ano de outro feudo da mesma Temporada. Nada de dado pessoal (ADR 0021).
- **V5F-T4 · Tela (M).** Seletor "Minha partida / Temporada da semana", cartão da Temporada
  com contagem regressiva e ranking.

### Fase G — Fechamento da v0.5 (M)

- Matriz completa uma vez (com a política do princípio 4), portão completo na CI, roteiro
  de 15 min para o autor, landing com o mapa e o horizonte atualizado, CHANGELOG, tag e
  release. Revisão independente **só das partes de risco** (migração do mapa, Temporada no
  servidor, névoa no mapa), não da versão inteira.

## 6. Ordem, paralelismo e publicações

```
A ──► B (Capela) ──► publica
 └──► C (Mapa) ─────► publica ──► D (Postos) ──► publica
                                └► E (Ano 2) ───► publica ──► F (Temporadas) ──► publica ──► G
```

- B e C podem andar juntas em worktrees diferentes (pouco contato no código).
- D depende do mapa; E depende pouco do mapa (só a Serra do Ferro usa a grade); F depende de
  E (o ranking usa a Crônica do Ano com Votos e Legado).
- Cinco publicações. Cada uma: CI verde no branch, backup, `push` autorizado pelo autor.

## 7. Riscos e como reduzir

| Risco | Redução |
|---|---|
| Migração do mapa quebra partidas vivas | Retrato real da produção (anônimo) no teste de migração; publicação da Fase C em horário de pouco movimento. |
| O mapa fica feio ou lento no celular | SVG simples, sem animação contínua; capturas revisadas pela sessão principal antes de publicar. |
| Temporada mexe no modelo de partidas do servidor | Tarefa G isolada, com testes de integração focados nela e revisão independente. |
| Balanceamento sem a matriz a cada tarefa | Matriz no fechamento de cada fase; desvio vira pergunta ao autor, não bloqueio. |
| Testes focados deixam passar quebra em outro pacote | A CI do branch roda tudo antes de qualquer publicação. |

## 8. Fora da v0.5

Academia, Feitos completos, som, auditoria de acessibilidade, inglês (v0.6); Necromante,
classes e unidades novas pelo Legado (v0.6, D-6/D-8); qualquer interação entre feudos além do
ranking e da leitura de Crônicas (v1.0).

## 9. Registro de execução

Uma linha por tarefa: data, commit, agente, o que foi verificado (e o que não foi).

| Tarefa | Data | Commit | Agente | Verificado / não verificado |
|---|---|---|---|---|
| | | | | |
