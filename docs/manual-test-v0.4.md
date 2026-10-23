# Roteiro manual da v0.4 (parcial, até a Fase D)

Um roteiro curto para o autor jogar a v0.4 "Guerra e Cerco" **em desenvolvimento**, jornada por jornada, com o que observar em cada uma e como adiantar o tempo. Cada observação vai para a coluna "Evidência manual" de [acceptance-v0.4.md](acceptance-v0.4.md), com data, navegador e ritmo; cada decisão de regra que o jogo mostrar e você quiser mudar vai para [pendencias-v0.4.md](pendencias-v0.4.md).

> **Estado em 2026-10-23.** Ninguém executou este roteiro, **nem o autor jogou nenhuma fase da v0.4**. Escrito no `main` em `c849bd8` (estado 31, protocolo 3) a partir do código (`tests/e2e/server.ts`, `tests/e2e/11-ferreiro.spec.ts`, `12-exercito.spec.ts`, `13-formacoes.spec.ts`) e dos roteiros de 15 minutos das Fases B e C ([pendencias-v0.4.md](pendencias-v0.4.md), seções 7 e 8). Cobre o que **existe hoje**: o ferro, a Mina Abandonada, o Ferreiro e a forja, o desgaste e o reparo, o Quartel, os soldados, as formações e a Defesa ativa, a aba Exército e a prévia do Conselho de Guerra, esta **só pela ordem `simulateBattle`** (o app ainda não tem botão "Simular": é da V4D-T4). O que ainda não existe aparece na seção "O que ainda não dá para jogar", com a fase que o entrega. **Nada da v0.4 está em produção** (a primeira publicação é a do fim da Fase E, decisão 26 do ADR 0019).

## Preparação

```bash
pnpm install
pnpm dev:up && pnpm secrets:gen
pnpm dev:api          # deixe rodando: http://localhost:3000/v1/health
pnpm dev:web          # em outro terminal: http://localhost:5173
curl -s localhost:3000/v1/version   # "protocol": 3
```

Abra `http://localhost:5173` numa janela anônima (ou perfil novo) para começar sem conta. Nas boas-vindas, escolha o ritmo **Rápido** (3×) e a dificuldade **Senhor**. Repita a jornada 5 em **Rei de Ferro** (o comandante só morre nela) e a 3 em **Camponês**.

| O que                                                   | Tempo de jogo                  | Tempo real no Rápido |
| ------------------------------------------------------- | ------------------------------ | -------------------- |
| Um dia de jogo (uma virada)                             | 2 h                            | 40 min               |
| Uma arma na forja                                       | 6 min no Ferreiro Nv1          | 2 min                |
| Um ponto de reparo                                      | 2 min                          | cerca de 40 s        |
| Treino de um lote de soldados                           | o prazo da conferência do app  | um terço do jogo     |
| Primavera, verão, outono / inverno                      | 24 dias cada / 12 dias         | 16 h cada / 8 h      |
| Relatório de Retorno                                    | —                              | 4 h sem abrir a página, ou com a aba fora de vista |

O prazo exato de cada lote vem da tela ("Revisar"); confira-o contra o relógio, nunca contra esta tabela.

## Como adiantar o tempo

Em produção o mundo anda no tempo de verdade e **nada** abaixo vale lá: nunca mexa no banco de produção. Em desenvolvimento use o servidor de teste com relógio adiantável, o mesmo da [v0.3](manual-test-v0.3.md):

```bash
pnpm dev:up
# terminal 1: a API de teste na porta 3100, com o Rápido como padrão
GAME_TIME_SCALE=3 pnpm --filter @lotg/server exec tsx ../../tests/e2e/server.ts
# terminal 2: o app falando com ela
LOTG_API_URL=http://127.0.0.1:3100 pnpm dev:web
# terminal 3: os atalhos
API=http://127.0.0.1:3100
t() { curl -s -X POST $API/__test/$1 -H 'content-type: application/json' -d "${2:-{\}}"; echo; }
```

O servidor de teste usa o `db_test` e **o esvazia ao subir**: não o rode junto com `pnpm test:integration` nem `pnpm test:e2e`, e encerre-o antes deles. As rotas valem para todos os feudos do banco, e o relógio da página não anda junto: as contagens regressivas saltam na leitura seguinte (até 30 s).

| Atalho                                                | O que faz                                                                                                       |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `t advance '{"ms":3600000}'`                          | adianta o relógio do servidor (aqui, 1 hora real)                                                               |
| `t council-recess` · `t horde-quiet`                  | sem cartas por sorteio; sem lobos (nem os do roteiro). **Comece por estes dois**                               |
| `t raise '{"building":"townHall","level":4}'`         | põe um edifício no nível (`smithy`, `barracks`, `guild`, `market`, `watchtower`, `palisade`…)                   |
| `t stock '{"resource":"iron","amount":200}'`          | põe o estoque de um recurso (`gold`, `food`, `wood`, `stone`, `iron`)                                           |
| `t soldiers '{"units":{"spearman":6,"archer":4}}'`    | põe soldados no exército sem passar pelo treino (`spearman`, `swordsman`, `archer`, `knight`, `shieldbearer`)   |
| `t hero '{"name":"Aldo"}'` · `t hero '{"name":"Brenna","classId":"archer"}'` | dá um herói ao feudo                                                    |
| `t item '{"defId":"huntingSpear"}'`                   | põe um item no arsenal                                                                                          |
| `t reveal '{"modelId":"abandonedMine"}'`              | revela um destino de expedição (aqui, a Mina Abandonada, que a Floresta Antiga revela de verdade)               |
| `t captive '{"name":"Aldo"}'`                         | põe o herói livre em cativeiro                                                                                  |
| `t threat '{"level":45}'`                             | põe a Ameaça em um valor                                                                                        |

`t soldiers` só muda a contagem de `army.units`: a fome, o limite e as formações são as do motor. Não há atalho para o ferro além de `t stock`, nem para o desgaste: para gastar um item, mande a expedição.

### O Relatório de Retorno depois de um salto

O relatório depende do relógio do **navegador** (4 h desde a última leitura). Para vê-lo sem esperar, no console do navegador (F12), logo antes de recarregar:

```js
for (const key of Object.keys(localStorage).filter((k) => k.startsWith('lords.cache:'))) {
  const cache = JSON.parse(localStorage.getItem(key));
  cache.lastSeenAt -= 5 * 60 * 60 * 1000;
  localStorage.setItem(key, JSON.stringify(cache));
}
location.reload();
```

É um atalho de desenvolvimento: uma ausência de verdade (uma noite) é a prova que vale.

## Jornadas

### 1. O ferro: Mercado e Mina Abandonada (cerca de 10 minutos)

Funda um feudo novo (Senhor, Rápido); `t council-recess` e `t horde-quiet`. Faz parte da Fase B (V4B-T1).

1. `t raise '{"building":"townHall","level":3}'` e `t raise '{"building":"market","level":1}'`. Aba **Mercado**: a linha do **Ferro** está lá, a 8,00 de ouro na base? `t stock '{"resource":"gold","amount":400}'`.
2. Compre 20 de ferro em duas etapas ("Revisar", "Confirmar"): o total é `quantidade × preço de hoje` e o ouro que sai do estoque é o que a conferência disse? Venda 10: paga menos do que cobrou?
3. Abra o painel de caravana (Mercado Nv2 com `t raise '{"building":"market","level":2}'`): o ferro **não** é oferecido. A frase diz por quê?
4. `t raise '{"building":"guild","level":2}'` e `t hero '{"name":"Aldo"}'`. Em "Expedições", mande a **Floresta Antiga** e adiante o tempo (`t advance '{"ms":900000}'`); na volta, a **Mina Abandonada** aparece entre os destinos? (Atalho: `t reveal '{"modelId":"abandonedMine"}'`.)
5. Mande a Mina com um Guerreiro. O ferro do saque chega ao Armazém, e a Crônica diz de onde veio? Com o Armazém cheio de ferro, o excesso vai ao chão e a frase diz?

O que observar:

- ☐ O ferro parece algo que se **acha** (Mina) ou se **compra**, e não que se produz? Faz sentido não haver caravana de ferro?
- ☐ O depósito de ferro cabe em tudo o que o Ferreiro e o Quartel pedem nos níveis iniciais?

### 2. O Ferreiro, a forja e o reparo (cerca de 15 minutos)

Fase B (V4B-T2 a T4). Prova em navegador: `tests/e2e/11-ferreiro.spec.ts`.

1. Sem o Ferreiro, o painel (na aba **Feudo**) diz como erguê-lo? `t raise '{"building":"townHall","level":4}'` e erga o Ferreiro pelo painel com o custo à vista (atalho: `t raise '{"building":"smithy","level":1}'`).
2. `t stock '{"resource":"iron","amount":100}'` e `t stock '{"resource":"wood","amount":100}'`. **Forje um lote de 3** em duas etapas: "Revisar a forja" mostra o custo (2 de ferro e 1 de madeira por arma) e o prazo; "Confirmar" cobra exatamente isso? Tente "O máximo que o estoque paga" e o botão com o estoque pobre.
3. Com a forja ocupada, tente um segundo lote: é recusado com a frase? **Cancele** o lote: volta 80% do ferro e da madeira, arredondado para baixo, e a frase do que volta bate com o estoque?
4. `t advance '{"ms":600000}'`: as armas chegam na hora que a tela anunciou, e a aba **Hoje** ("Antes de partir") lembrava da forja parada?
5. **O desgaste.** `t item '{"defId":"huntingSpear"}'`, equipe-o em Aldo (aba **Guilda**, ficha) e mande uma expedição. Na volta a ficha diz a condição ("N de M usos")? Depois de gastar tudo (um item Comum tem 8 usos; adiante várias expedições, ou confira só o primeiro ponto perdido), o item em 0 mostra que **não dá bônus**?
6. **O reparo.** No **Arsenal**, "Reparar" um item gasto: a conferência diz o ferro (1 por ponto no Comum e no Incomum, 2 no Raro e no Épico) e o prazo (2 min de jogo por ponto)? Com a forja ocupada pelo reparo, um lote novo é recusado, e o reparo não se cancela. No fim do prazo o item volta inteiro.
7. Pela paleta (F1): "forjar", "cancelar forja" e "reparar" chegam às mesmas conferências, só com o teclado?

O que observar:

- ☐ A forja parada te dá vontade de ter um Quartel? As armas fazem sentido como um recurso que não se vende?
- ☐ O reparo compensa o ferro, ou é mais barato achar outro item?

### 3. O Quartel, os soldados e o treino (cerca de 15 minutos)

Fase C (V4C-T1 e T3). Prova em navegador: `tests/e2e/12-exercito.spec.ts`.

1. Com o Salão no nível 4 (`t raise '{"building":"townHall","level":4}'`) e a aba **Exército** depois do Mercado: sem o Quartel ela diz como erguê-lo? Erga-o pelo painel (150 de madeira, 150 de pedra e 100 de ouro; atalho: `t raise '{"building":"barracks","level":1}'`). A tabela das **cinco** unidades (Lanceiro, Espadachim, Arqueiro, Cavaleiro, Escudeiro) diz o custo, a comida por hora e contra quem cada uma é forte?
2. `t stock` com o que a tela pedir. **Treine 3 Lanceiros** em duas etapas ("Revisar o treino", "Confirmar"): a conferência diz o custo do lote inteiro e o prazo? Os soldados saem da população (a contagem de aldeões **cai** ao fim do treino) e a comida por hora passa a contá-los (1,5 por soldado)? Os Espadachins e os Cavaleiros pedem armas: a tela diz quantas faltam?
3. **Cancele** um segundo lote: a frase de devolução (80% do custo; armas inteiras que couberem) bate com o estoque?
4. **Dispense** soldados: a confirmação diz que o custo **não volta** e que voltam aldeões sem ofício? Isso fecha a vaga de treino?
5. Os limites: o lote máximo é 10; o limite de soldados cresce com o nível do Quartel. Tente passar: a recusa diz o motivo? Com poucos aldeões, o **piso de 3** protege (o lote encolhe ou é recusado, com frase), e soldado **não deserta** com fome (aldeões, sim).
6. Em **Hoje**: com soldados e sem Defesa ativa, o aviso "Sem Defesa ativa" aparece (próxima jornada).

O que observar:

- ☐ Montar um exército parece uma troca econômica real (aldeões e comida contra soldados)?
- ☐ O treino tem um lugar claro no dia, ou some atrás da economia?

### 4. A formação, a Defesa ativa e o comandante (cerca de 15 minutos)

Fase C (V4C-T2 e T3). Prova em navegador: `tests/e2e/13-formacoes.spec.ts`.

1. `t soldiers '{"units":{"spearman":6,"archer":4,"shieldbearer":2}}'` e `t hero '{"name":"Aldo"}'`. No editor, ande pelos **seis postos** (três alas, Frente e Retaguarda) com as setas e aperte Enter para pôr tropa em três deles. O posto vazio se distingue do preenchido de relance? O Arqueiro só combate atrás: a tela barra pô-lo na Frente?
2. Nomeie **Aldo comandante de uma ala**, dê um nome e **salve**. Marque como **Defesa ativa**: a árvore diz "Defesa: <nome>"?
3. Mande **Aldo** em expedição: o app explica por que ele fica (o comandante da Defesa ativa não parte)? Em outra formação salva (que não é a ativa), ele parte?
4. Tire a Defesa ativa (ou troque-a): Aldo parte de novo. A barra de status diz "Sem Defesa ativa", e "Antes de partir" oferece "Ativar uma formação"?
5. **Apague** uma formação salva (confirma) e tente apagar a Defesa ativa (recusado com a frase). Salve seis formações: a sexta é recusada (o teto é de cinco).
6. Dispense soldados com a formação pedindo mais do que há: a tela diz o que **falta** de cada unidade, e a formação não é apagada.
7. Abra o app em **duas abas** e salve a mesma formação nas duas: uma vence, a outra é recusada ou sobrescreve? (A revisão da Fase C aceitou o caso; anote o que viu.)

O que observar:

- ☐ Montar a formação parece um quebra-cabeça rápido ou um formulário?
- ☐ Sem batalha ainda, o exército parece servir para alguma coisa? (A resposta honesta hoje é "para a prévia".)

### 5. A prévia do Conselho de Guerra, pela ordem (cerca de 10 minutos)

Fase D (V4D-T2). **Sem tela ainda** (V4D-T4): o app não tem botão "Simular". A ordem existe e a visão traz o resultado; para olhá-la à mão, mande a ordem pelo console do navegador no app **logado** e leia a visão.

1. Tenha uma formação salva (jornada 4) e anote o `id` dela (na visão, `army.formations`; por exemplo `formation-1`). Em desenvolvimento, no console (F12):

```js
const tokens = JSON.parse(localStorage.getItem('lords.tokens'));
const auth = { authorization: `Bearer ${tokens.accessToken}`, 'x-lords-protocol': '3' };
const games = await (await fetch('/v1/games', { headers: auth })).json();
const gameId = games.games[0].id;
const body = { commandId: crypto.randomUUID(), type: 'simulateBattle', payload: { formationId: 'formation-1' } };
const sent = await fetch(`/v1/games/${gameId}/commands`, {
  method: 'POST',
  headers: { ...auth, 'content-type': 'application/json' },
  body: JSON.stringify(body),
});
console.log(sent.status, await sent.json());
const view = await (await fetch(`/v1/games/${gameId}/view`, { headers: auth })).json();
console.log(view.view.army.preview);
```

   O token de acesso vale 15 minutos (se o `401` aparecer, recarregue a página para renová-lo e repita; confira o nome da chave em `localStorage` se `lords.tokens` vier vazio). O formato exato da resposta é o de `GET /v1/games/:id/view` (`ViewResponse`).

2. Leia `army.preview`: **Vitória, Gloriosa e Derrota** em percentuais (Vitória e Derrota somam 100), o **risco principal em uma frase**, as perdas esperadas por posto e o **inimigo suposto** (com `?` onde a informação não existe). A frase se entende sem ler o código?
3. Mande a ordem **de novo**: dá o mesmo resultado (200 simulações com sementes derivadas) e a nova substitui a anterior. Mude a formação (salve outra composição com o mesmo `id`) e leia a visão: a prévia fica **desatualizada** (`previewStale` na linha dessa formação, em `army.formations`)?
4. Sem soldados: a prévia diz que não há tropa e a Derrota é de 100%. Sem o Quartel: a ordem é recusada com `BARRACKS_REQUIRED`; com um `id` que não existe, `FORMATION_NOT_FOUND`.
5. A ordem **não** deve mexer na Crônica, nem no gerador do feudo: leia a Crônica antes e depois.

O que observar:

- ☐ A prévia ajuda a decidir, ou só mostra números? Dá vontade de ter o botão e o bloco do Conselho de Guerra na tela (V4D-T4)?

### 6. O comandante em batalha (só pelo motor)

Fase D (V4D-T3). **Não há como jogar isto na tela**: nenhuma incursão passa pela batalha ainda (V4E-T2). O motor tem a experiência do comandante, o ferimento (leve ou grave pela perda da ala), a morte **só em Rei de Ferro** e o desgaste do equipamento por batalha, provados em `packages/engine/src/battleOutcome.test.ts` e `battle.test.ts`. Ao fechar a Fase E, repita aqui: o herói ferido pela batalha, a morte em Rei de Ferro e a frase da Crônica ("battleFought" com os três fatores decisivos).

### 7. Uma partida migrada da v0.3 (estado 24 até o atual)

**Em produção**, quando a Fase E for publicada, o feudo que você já joga na v0.3.0 passa pelos sete passos (24 a 31) na primeira leitura (ou no job de avanço). **Não publique para isso**: a publicação é decisão do autor, com o backup manual antes. Anote, depois: nada se perdeu (estoques, níveis, aldeões, objetivos, cartas pendentes, expedições em curso, a caravana na estrada); **ferro em zero**; nenhuma arma, soldado nem formação de graça; nenhum evento da v0.4 antes da fronteira; quem estava com o jogo aberto vê "Recarregue a página" (`426`) só se o protocolo tiver subido (hoje continua 3).

**Em desenvolvimento**, monte uma partida da v0.3 com um retrato congelado do motor (por exemplo `packages/engine/src/__fixtures__/state-v24-raid-announced.json`, `state-v24-expedition-crossroads.json` ou `state-v24-warehouse-full.json`): crie uma partida pelo app, pare a API, grave o retrato por cima com `schema_version = 24` e `created_at` no passado o bastante, e suba a API de novo. Os mesmos pontos acima.

- ☐ Nada se perdeu; os objetivos concluídos não pagam de novo.
- ☐ Ferro 0, Ferreiro e Quartel por erguer (o Salão no nível 4 os libera).
- ☐ A incursão que já estava marcada resolve como na v0.3 (a composição-base da batalha é da V4E-T2).

## O que ainda não dá para jogar

| O que                                                                                       | Entra com a Fase                    |
| ------------------------------------------------------------------------------------------- | ----------------------------------- |
| Botão "Simular" e o bloco do Conselho de Guerra na tela, o relatório de batalha na aba     | Fase D (V4D-T4)                     |
| Incursão com batalha, a Defesa ativa que realmente defende (offline), a Muralha e a Paliçada ligadas ao estado | Fase E (V4E-T1, V4E-T2)             |
| Muralha de Pedra, Baluarte e Torre acima do Nv2; o reparo da muralha (`repairWall`)         | Fase E (V4E-T1)                     |
| A Horda que responde à última formação; os presságios por nível da Torre                    | Fase E (V4E-T3)                     |
| Fortaleza, sabotagem e o Acampamento de Saqueadores                                         | Fase F (V4F-T1, V4F-T2)             |
| O Cerco: a Hora da Vigília, três ondas, o Plano de Batalha, milícia, Queda e Reconstrução  | Fase G (V4G-T1, V4G-T2, V4G-T4)     |
| A Crônica do Ano em Markdown                                                                | Fase G (V4G-T3)                     |
| As cartas do lote 3 e os objetivos 17 a 21                                                  | Fase H                              |
| O balanceamento de fechamento e a faixa de Vitória do Regular                               | Fase G (V4G-T2.10) e V4I-T1         |

## Só para olhos humanos

- ☐ **Diversão** (roadmap da v0.4, §10.3): as tensões e os alívios aparecem aos pares? Ferro e Mina; soldado e aldeão; formação e comandante; treino e comida.
- ☐ **Peso da interface**: quantos cliques para forjar, treinar e salvar uma formação? A sessão cabe em 2 a 10 minutos? A v0.4 trocou diversão por microgerenciamento?
- ☐ **Textos**: unidades, formações, relatório de batalha, Crônica de batalha. Tom de crônica, frases curtas. Anote o que você reescreveria primeiro; tudo é rascunho ([content-v0.4.md](content-v0.4.md)).
- ☐ **Temas, teclado e 720 px**: as abas Feudo (Ferreiro), Guilda (Arsenal), Mercado (ferro) e Exército, o editor de formação e a conferência de forja, treino e reparo nos três temas, só pelo teclado e em janela estreita.
- ☐ **No ritmo da produção**: repita a jornada 2 em **Normal** (`GAME_TIME_SCALE=1`) e **Tranquilo**: os prazos de forja e treino na tela são os da API, em horas de relógio.

## Firefox, Safari, celular e leitor de tela

**Esta versão não foi verificada em nenhum desses.** Só o Chromium automatizado (Playwright) viu as telas da v0.4; ninguém usou o Ferreiro, a aba Exército nem o editor de formação em Firefox, em Safari, em celular nem com leitor de tela, e **a ausência fica escrita aqui**, como na v0.3. O que registrar, ao testar:

- ☐ **Firefox** (obrigatório à mão): jornadas 2 e 4, em duas abas, com o teclado: o foco do editor de formação (setas entre os seis postos, Enter abre o seletor, Esc volta) e o das conferências de forja e treino. Versão e sistema.
- ☐ **Safari**: carrega o app (`navigator.locks`, `localStorage` entre abas) e o editor? Versão.
- ☐ **Celular**: o editor de formação de seis postos cabe sem rolagem lateral (em 720 px os testes automáticos passam; em 360 px ninguém olhou)? O toque substitui o teclado, já que não há arrastar.
- ☐ **Leitor de tela** (qual): o posto vazio e o preenchido se distinguem por texto, não só por cor ou ícone? A conferência de forja e de treino é anunciada?

Registre cada um na tabela "Navegador e versão" de [acceptance-v0.4.md](acceptance-v0.4.md). Se não houver rodada, a linha continua "não", e a V4I-T2 fecha com a ausência escrita.
