# Convite do playtest da v0.3

Para a tarefa V3G-T3 do [roadmap da v0.3](../roadmap-v0.3.md). Este arquivo tem três partes, no molde do [convite da v0.2](convite-v0.2.md): a **mensagem** que vai para os convidados, o **roteiro do autor**, com o que fazer antes, durante e depois das 48 horas, e o **cenário guiado**, que cobre o que 48 horas não alcançam (V3G-T3.3). O formulário está em [formulario-v0.3.md](formulario-v0.3.md); o relatório, em [relatorio-v0.3.md](relatorio-v0.3.md).

Convidar, entregar o endereço, recolher as respostas, conduzir o cenário guiado e rodar as consultas em produção **são atos do autor**: o agente não fala com as pessoas e não tem acesso ao banco de produção. Este documento é só o que não depende de pessoas.

**Estado em 2026-10-07: o playtest não aconteceu, e nenhum convite foi mandado.** O da v0.1 (V2A-T1) e o da v0.2 (V2F-T3) também não aconteceram: não existem `relatorio-v0.1.md` nem `relatorio-v0.2.md`, e por isso **não há linha de base de pessoas** para comparar (V3G-T3.4). A v0.3 foi implementada **sem que o autor jogasse nenhuma fase**; o convite só deve sair depois de a v0.3 estar publicada (a publicação é do autor: [deploy/README.md](../../deploy/README.md), "A primeira publicação da v0.3") e de ele a ter jogado, ao menos pelo [roteiro manual](../manual-test-v0.3.md). Quem abrir o endereço antes da publicação joga a v0.2.

O que este documento diz do jogo vem do [roadmap da v0.3](../roadmap-v0.3.md) e dos ADRs [0017](../decisions/0017-regras-da-v0.3-herois-taverna-e-soldo.md) e [0018](../decisions/0018-expedicoes-mercado-mestres-e-cartas-na-v0.3.md). **Conferir a mensagem contra o jogo publicado antes de enviar** (item do roteiro).

---

## 1. A mensagem

Notas para quem envia (não vão para os convidados):

- Trocar os três trechos entre `‹ ›`: o dia e a hora em que as 48 horas acabam, por onde a pessoa avisa se algo quebrar, e o nome de quem assina.
- **Não explicar regras**, nem na mensagem nem em conversa. Heróis, soldo, Taverna, expedições, encruzilhada, Postura, Mercado e caravanas são exatamente o que se quer saber se o jogo explica sozinho. Se alguém perguntar "o que eu faço com o herói?", a resposta é "o que você faria se eu não estivesse aqui?", e a pergunta vai para as anotações.
- **Não dizer nomes de heróis, de destinos nem de cartas**: a pergunta 17 do formulário mede se a pessoa lembra de um herói pelo nome, e qualquer pista na mensagem a invalida.
- A mensagem não diz quanto dura um dia ou um ano do jogo, nem quanto a pessoa "deve" jogar ([ADR 0011](../decisions/0011-ritmo-3x-no-mvp.md)). Deixar assim: o que se mede é quando ela volta por conta própria.
- **Dificuldade e ritmo ficam por conta de cada um**, e a mensagem não recomenda nenhum. A tela inicial oferece as opções com uma frase cada, e na v0.3 cada dificuldade diz o que acontece com os heróis em expedição. O que cada pessoa escolheu é anotado depois (pergunta 15 do formulário e a consulta do roteiro).
- **A página de apresentação fica de fora** enquanto os oito pontos do [ADR 0012](../decisions/0012-pagina-de-apresentacao.md) não forem confirmados. Se entrar, anotar no relatório.
- Mandar a mesma mensagem para todos, no mesmo dia. Quem recebe explicação a mais joga outro teste.
- Mesma duração (48 horas) e mesmo tipo de público dos planos anteriores, para a diferença ser da versão (V3G-T3.1). Anotar quem é **novo** e quem é **retornante**. Para quem já tem um feudo (da v0.2), usar o parágrafo extra no fim desta seção.

O texto, pronto para colar:

> Oi! Estou fazendo um jogo e queria que você fosse uma das primeiras pessoas a jogar.
>
> **Lords of the Guild** é um jogo medieval de administrar um feudo. Roda no navegador, não instala nada e cabe em visitas de poucos minutos.
>
> **Como jogar**
> 1. Abra https://lords.palsincomehub.com no **computador** (em celular ainda não foi testado).
> 2. Escolha um nome, que pode ser inventado. A tela deixa escolher a dificuldade e o ritmo: escolha o que quiser, ou deixe como está. Clique em **Jogar agora**. Não tem cadastro, e-mail nem senha.
> 3. Jogue quando quiser, quanto quiser, até ‹dia e hora do fim›. O feudo continua andando enquanto você está fora: volte quando der vontade. Se não der, isso também me interessa.
>
> Não vou explicar as regras, de propósito: quero saber se o jogo se explica sozinho. Se alguma coisa não ficar clara, não é você que está errando. É isso que eu preciso descobrir.
>
> **Quatro pedidos**
> - Use sempre o mesmo navegador, fora da janela anônima: o seu feudo fica guardado nele. E repare qual navegador é (Chrome, Edge, Firefox, Safari…), que eu vou perguntar depois.
> - Repare também qual dificuldade e qual ritmo você escolheu. Eles aparecem nas Preferências do jogo, se você esquecer.
> - Se for jogar em outro computador ou outro navegador, gere antes um **Código do Reino**: no jogo, abra **Conta** na barra da esquerda e escolha "Gerar Código do Reino" (ou aperte F1 e procure por "Código do Reino"), e guarde o código. No outro navegador, escolha "Usar Código do Reino" na tela de entrada. Sem ele, limpar os dados do navegador apaga o acesso ao feudo.
> - Se algo quebrar ou parecer errado, me avise por ‹canal›, dizendo mais ou menos o dia e a hora.
>
> **O que fica guardado**
> A conta é anônima. O servidor guarda o nome que você escolher, o tipo de navegador, as ordens que você der ao feudo e as datas de acesso. Não guarda e-mail, senha nem nada que diga quem você é. Não há anúncios nem rastreadores. Você pode excluir a conta quando quiser, pelo próprio jogo, em **Conta**: o acesso é bloqueado na hora e os dados saem do servidor depois de sete dias (cópias de segurança podem guardá-los por até 14 dias).
>
> **É uma versão de teste.** Pode ter defeito, e o feudo desta rodada pode não ser mantido depois.
>
> Quando as 48 horas acabarem, mando um formulário de 23 perguntas, uns quinze minutos, sem resposta certa. O apelido é opcional.
>
> Obrigado por topar!
> ‹nome›

Parágrafo extra, **só para quem já jogou uma versão anterior** (entra depois de "Como jogar"):

> **Você já tem um feudo.** Ele continua lá, do jeito que você deixou: abra o jogo no mesmo navegador de antes. O jogo mudou bastante desde a última vez, e eu queria saber o que você nota. Se aparecer o aviso "Há uma versão nova do jogo. Recarregue a página.", é só recarregar.

De onde vem cada frase, para quem for mexer no texto:

| O que a mensagem diz | Fonte |
|---|---|
| Endereço, o nome e o botão **Jogar agora** | Produção ([ADR 0009](../decisions/0009-implantacao-no-coolify.md)); tela de boas-vindas do app |
| "A tela deixa escolher a dificuldade e o ritmo" | Boas-vindas da v0.2; as opções vêm de `GET /v1/catalog` |
| "Eles aparecem nas Preferências" | A aba Preferências mostra dificuldade e ritmo, sem editar |
| Computador, não celular | GDD §1 (público); navegadores de celular nunca foram abertos |
| O que o servidor guarda e a exclusão | Seção "Privacidade" do [README](../../README.md); GDD §14.14. É o mesmo parágrafo dos convites anteriores |
| Código do Reino | GDD §14.7 |
| "O feudo continua lá" (retornantes) | O estado de quem já joga é migrado na primeira leitura, do 12 até o atual, sem perder nada ([CHANGELOG.md](../../CHANGELOG.md), "O que muda nas partidas em andamento") |
| "Há uma versão nova do jogo. Recarregue a página." | Resposta `426` do servidor a um app anterior ao protocolo 3 |
| Formulário de 23 perguntas, apelido opcional | [formulario-v0.3.md](formulario-v0.3.md), parte A |

"O feudo desta rodada pode não ser mantido" continua sendo cautela, e não plano: o backup externo ainda não foi feito ([pendencias-v0.3.md](../pendencias-v0.3.md), seção 3). Feito o backup, o autor pode tirar a frase.

**Três frases a conferir no jogo publicado antes de enviar:** que as boas-vindas mostram dificuldade e ritmo antes de **Jogar agora**; que as Preferências mostram os dois; e que `GET /v1/version` responde `protocol: 3`.

---

## 2. Roteiro do autor

### O que 48 horas alcançam em cada ritmo

Para o autor, **não para os convidados**. Mostra o que a observação natural consegue ver e o que fica para o cenário guiado. Os instantes vêm dos ADRs 0013, 0014, 0017 e 0018: a carta da estrangeira ferida chega no início do 13º dia de jogo do ano 1 (12 dias de jogo depois de fundar); a Taverna troca a lista a cada 12 dias de jogo; a viagem da caravana é de 4 horas de jogo; as estações têm 24 dias de jogo e o inverno, 12. **Duas coisas são em tempo real, iguais em qualquer ritmo:** a espera da encruzilhada (12 h) e os prazos do soldo em atraso (12 h para o Descontente, 24 h para a primeira partida, 2 h entre as seguintes).

| Acontecimento | Rápido (3×) | Normal (1×) | Tranquilo (0,5×) |
|---|---:|---:|---:|
| Primeira carta do Conselho (sorteada) | 2h40 | 8 h | 16 h |
| **Carta da estrangeira ferida: o primeiro herói** | 8 h | 24 h | 48 h: **no limite da janela** |
| Primeira troca de candidatos da Taverna, depois de erguida | 8 h | 24 h | 48 h |
| Caravana a Porto do Rio (ida) | 1h20 | 4 h | 8 h |
| Espera na encruzilhada | 12 h reais | 12 h reais | 12 h reais |
| Soldo em atraso: Descontente; primeira partida | 12 h; 24 h | 12 h; 24 h | 12 h; 24 h |
| Incursão de lobos do ano 1 | 10 h | 30 h | **60 h: fora da janela** |
| Verão | 16 h | 48 h: no fim da janela | fora da janela |
| Inverno (lenha, frio e soldo) | 48 h: no fim da janela | fora da janela | fora da janela |
| Virada do ano | **56 h: fora da janela** | fora da janela | fora da janela |

Leitura: **no Normal, o primeiro herói chega ao fim do primeiro dia real, e a pessoa só tem a outra metade da janela para erguer a Guilda e mandar uma expedição.** No Tranquilo, a estrangeira chega nas últimas horas e a pessoa quase não vê a Guilda. **Em nenhum ritmo as 48 horas mostram o inverno com a equipe nem a virada do ano**, e o atraso do soldo só aparece se o ouro acabar. Por isso V3G-T3.3 separa a observação natural do cenário guiado (seção 3), e por isso o ritmo e a dificuldade de cada pessoa entram em toda leitura das respostas: "não vi um herói" quer dizer coisas diferentes no Rápido e no Tranquilo. A recomendação do GDD é o Rápido; se todos escolherem outro, o relatório diz que a Guilda quase não foi vista.

### Antes de convidar

- [ ] **(autor)** Publicar a v0.3. Antes do `push`: backup manual do banco (a migração sobe o estado do 12 para o atual), e, de preferência, backup externo e cópia do `RECOVERY_CODE_SECRET` fora do Coolify ([pendencias-v0.3.md](../pendencias-v0.3.md), seção 3). O procedimento de reversão está em [deploy/README.md](../../deploy/README.md), "Reverter depois de uma migração de estado": a imagem da `v0.2.0` **não** é destino de reversão sem restaurar o backup.
- [ ] **(autor)** Ter jogado a v0.3 pelo [roteiro manual](../manual-test-v0.3.md) e lido ao menos uma parte do conteúdo: os 18 grafos de expedição, os dez candidatos da Taverna, os heróis com nome e as cartas do lote 2 do Conselho estão no jogo **sem aprovação** ([content-v0.3.md](../content-v0.3.md)). Convidar pessoas antes disso é mostrar a elas um texto que o autor não leu.
- [ ] **(autor, V3G-T2)** O quadro de [aceitação da v0.3](../acceptance-v0.3.md) preenchido. O playtest não substitui a aceitação.
- [ ] **(autor)** Conferir a mensagem da seção 1 contra o jogo publicado (as três frases marcadas).
- [ ] **(autor)** No dia, conferir a produção e anotar as respostas para o relatório:

  ```bash
  curl -s https://lords.palsincomehub.com/v1/health    # esperado: {"status":"ok","db":"ok"}
  curl -s https://lords.palsincomehub.com/v1/version   # anotar server (0.3.0), protocol (3), builtAt e o hash do conteúdo
  ```

- [ ] **(autor, V3G-T3.1)** **Congelar o `main` pelas 48 horas.** Todo `push` no `main` com a CI verde é implantado sozinho, e um deploy no meio muda o que as pessoas estão jogando: o hash do conteúdo anotado acima é o que identifica a versão dos grafos e das cartas.
- [ ] **(autor, V3G-T3.1)** Escolher 3 a 5 pessoas e a janela. Preferir quem trabalha no computador (GDD §1). Anotar, para cada uma, se é nova ou retornante, sem identificar. O servidor aceita 10 contas novas por hora por IP: convidados na mesma rede podem bater nesse limite.
- [ ] **(autor)** Anotar a data e a hora do envio: é o começo da janela das consultas.
- [ ] **(autor)** Anotar o identificador da própria conta, para tirá-la das métricas (ferramentas de desenvolvedor → Local Storage → chave `lords.account:self`, campo `accountId`).
- [ ] **(autor, V3G-T3.3)** Decidir como será o cenário guiado (seção 3) e **ensaiá-lo sozinho** antes de chamar alguém.
- [ ] **(agente, antes do envio)** Ensaiar no banco de desenvolvimento as duas consultas novas deste roteiro ("Equipe e Mercado" e "Acontecimentos da v0.3"). Elas **nunca rodaram**.
- [ ] **(autor)** Mandar a mensagem da seção 1.

### Durante as 48 horas

- [ ] **(autor)** Nenhum deploy e nenhum reinício deliberado.
- [ ] **(autor)** Anotar, com data e hora, tudo o que as pessoas relatarem e qualquer queda. O workflow `health.yml` avisa por e-mail quando o jogo cai; a chegada desse e-mail nunca foi conferida, então olhar também a aba Actions do GitHub uma ou duas vezes por dia.
- [ ] **(autor)** Não responder dúvida de regra. Anotar a dúvida como veio. As mais prováveis nesta versão, para reconhecer e anotar sem responder: "o que faço com esse herói?", "por que o herói está descontente?" (soldo em atraso), "o que a Postura faz?", "por que não consigo vender mais?" (volume diário), "a caravana pode ser roubada?", "por que o herói não volta?" (cativeiro e Resgate), "por que perdi ouro?" (soldo).
- [ ] **(autor)** Não jogar na conta de ninguém nem pedir captura de tela do feudo durante a janela: muda o comportamento.
- [ ] **(autor)** **Não ajudar a lembrar nomes.** A pergunta 17 mede a lembrança sem ajuda.

### Depois

- [ ] **(autor, V3G-T3.2)** Mandar a **parte A** do [formulário](formulario-v0.3.md), com as perguntas todas opcionais e sem coletar e-mail. Apelido opcional; nenhum outro dado pessoal.
- [ ] **(autor)** Rodar as consultas de [`deploy/analytics/ops.sql`](../../deploy/analytics/ops.sql) em produção: Coolify → `lotg-db` → Terminal → `psql -U lotg lotg`.
  1. Colar as três linhas `\set` do bloco "Filtro do playtest" **com os valores deste playtest**.
  2. Colar "Filtro em vigor" e conferir a janela, `conta_do_autor_existe` e `contas_nas_metricas`.
  3. Colar, uma por vez: **sessões por dia**, **comandos por sessão**, **tempo até o primeiro comando** e **retorno no dia 2**; e, do começo do arquivo, "Contas: total…" e "Comandos por tipo e resultado". Na v0.3, os tipos de comando mostram também quem contratou, enviou expedição, escolheu caminho, negociou no Mercado e mandou caravana.
  4. Colar as consultas "Ritmo e dificuldade" e "Acontecimentos" do [convite da v0.2](convite-v0.2.md) (seção 2) e as duas novas, abaixo.
  5. Copiar as saídas como vieram.
- [ ] **(autor)** Rodar a consulta de retorno **só depois que o segundo dia de cada conta terminar** no calendário de São Paulo, e tudo **antes de sete dias** do fim: conta excluída some das métricas no expurgo.
- [ ] **(autor, V3G-T3.3)** Conduzir o cenário guiado (seção 3) e anotar as respostas da **parte B** do formulário, em folha separada.
- [ ] **(autor)** Colar para o agente as respostas do formulário, as anotações e as saídas das consultas.
- [ ] **(agente, com o que o autor colar; V3G-T3.4)** Montar o [relatório](relatorio-v0.3.md) a partir do [modelo](relatorio-modelo.md), com os acréscimos de [formulario-v0.3.md](formulario-v0.3.md) ("Como as respostas entram no relatório"). Contagens sempre com denominador; nada de "retenção comprovada" com 3 a 5 pessoas. A classe de cada achado (P0 a P3) é proposta pelo agente e **decidida pelo autor**.
- [ ] **(agente)** Comparar o retorno no dia 2 com o da v0.1 e o da v0.2, **ou declarar que não há linha de base**, se nenhum dos dois tiver acontecido até lá. Hoje não há.

As duas consultas novas. Foram escritas para este roteiro a partir de `packages/server/src/db/schema.ts` e dos tipos de evento de `packages/content/src/chronicle.ts` e **não foram ensaiadas**: conferir no banco de desenvolvimento antes de usar. As duas usam as mesmas três variáveis `\set` e são agregadas, sem nome de jogador.

```sql
-- Equipe e Mercado: quantas partidas do playtest chegaram a cada marco da v0.3.
-- Os nomes dos tipos são os de EVENT_TYPES em packages/content/src/chronicle.ts.
with jogadores as (
  select id
  from accounts
  where display_name not like 'Bot %'
    and created_at >= :'playtest_inicio'::timestamptz
    and created_at < :'playtest_fim'::timestamptz
    and id <> :'conta_do_autor'::uuid
),
marcos(tipo, marco) as (
  values
    ('heroJoined',            '1 primeiro herói'),
    ('heroHired',             '2 contratou na Taverna'),
    ('expeditionSent',        '3 mandou uma expedição'),
    ('expeditionAtCrossroads','4 chegou a uma encruzilhada'),
    ('expeditionPathChosen',  '5 escolheu o caminho'),
    ('expeditionPostureDecided','6 a Postura decidiu'),
    ('expeditionReturned',    '7 expedição voltou'),
    ('heroCaptured',          '8 herói capturado'),
    ('marketTraded',          '9 negociou no Mercado'),
    ('caravanSent',           'a mandou caravana'),
    ('caravanAmbushed',       'b caravana emboscada'),
    ('wageArrearsStarted',    'c soldo em atraso'),
    ('heroLeft',              'd herói foi embora')
)
select m.marco, m.tipo, count(distinct e.game_id) as partidas, count(*) as eventos
from marcos m
left join game_events e on e.kind = m.tipo
  and e.game_id in (select g.id from games g join jogadores j on j.id = g.account_id)
group by 1, 2
order by 1;

-- Encruzilhadas decididas pelo jogador e pela Postura, por ritmo e dificuldade.
with jogadores as (
  select id
  from accounts
  where display_name not like 'Bot %'
    and created_at >= :'playtest_inicio'::timestamptz
    and created_at < :'playtest_fim'::timestamptz
    and id <> :'conta_do_autor'::uuid
)
select g.time_scale as ritmo, g.difficulty as dificuldade,
       count(*) filter (where e.kind = 'expeditionPathChosen')     as escolhidas_pelo_jogador,
       count(*) filter (where e.kind = 'expeditionPostureDecided') as decididas_pela_postura
from game_events e
join games g on g.id = e.game_id
join jogadores j on j.id = g.account_id
where e.kind in ('expeditionPathChosen', 'expeditionPostureDecided')
group by 1, 2
order by 1, 2;
```

### O que as consultas não vão dizer

- Leituras não ficam gravadas no banco: só os comandos. Quem voltou, olhou o feudo e saiu sem dar nenhuma ordem **não aparece** como sessão nem como retorno. Na v0.3 isso pesa mais: o jogo dá motivo para voltar só para ler (o relatório de uma expedição, a encruzilhada, o preço). A pergunta 21 do formulário cobre a diferença.
- **Retornantes ficam de fora das métricas.** As consultas só contam contas **criadas dentro da janela**. Para retornantes, o dado é o formulário.
- Uma encruzilhada decidida pela Postura não diz se a pessoa a viu: "decidida pela Postura" conta quem não voltou a tempo e quem leu e deixou.
- **Se a pessoa lembra de um herói pelo nome**, o que lê o relatório até o fim e o que a faz voltar: só o formulário e a conversa.
- O que a pessoa sentiu no inverno com a equipe: as 48 horas não chegam lá (tabela acima). Isso é do cenário guiado.

---

## 3. Cenário guiado (V3G-T3.3)

**Por que existe.** O inverno com a equipe, o soldo em atraso depois de uma noite fora, a espera de 12 horas na encruzilhada e a virada do ano são metade do que a v0.3 promete ("a minha equipe tem nome e uma história"), e nenhuma observação natural de 48 horas os alcança. O cenário guiado testa isso de propósito, em uma sessão curta. **As respostas dele nunca se somam às da observação natural**: a pessoa não chegou ali jogando, não escolheu o ritmo e sabe que está sendo observada.

Há dois caminhos. O primeiro é barato e natural; o segundo é controlado e precisa de ensaio.

### 3.1 Observação prolongada

Para quem escolheu o ritmo Rápido e quiser continuar: pedir que jogue até cerca de 60 horas depois de ter começado. O inverno começa na hora 48 e o ano vira na hora 56. Depois, mandar a **parte C** do formulário. No relatório, essas respostas ficam marcadas como "prolongada", com a hora em que a pessoa parou.

Limite: só vale para o Rápido, só para quem quiser, e a pessoa pode ter dormido durante o inverno inteiro (são 8 horas reais). Se dormiu, o que se mede é o Relatório de Retorno do inverno, com a equipe, o que também interessa.

### 3.2 Sessão guiada: "a equipe e o inverno"

Uma pessoa por vez, cerca de 25 minutos, no computador do autor ou com a tela compartilhada. A pessoa recebe um feudo no fim do outono, **com a Guilda, a Taverna, o Mercado e dois ou três heróis**, prepara a ausência, o tempo é adiantado, e ela volta para ler o que aconteceu.

**Preparação.** É preciso um feudo perto do inverno, com equipe, e **não existe ferramenta que o crie**. O caminho possível hoje é o servidor dos testes em navegador, que tem um relógio adiantável e rotas para dar heróis, erguer edifícios e pôr uma expedição na encruzilhada. Ele **nunca foi usado à mão para isto**, e tem uma diferença em relação aos testes automáticos: os testes adiantam também o relógio da página; à mão, só o do servidor anda, então é preciso recarregar a página depois de cada salto. Os atalhos estão em [manual-test-v0.3.md](../manual-test-v0.3.md), "Como adiantar o tempo".

```bash
pnpm dev:up
# Terminal 1: a API de teste, na porta 3100, no ritmo da produção. APAGA o banco de teste ao subir.
GAME_TIME_SCALE=3 pnpm --filter @lotg/server exec tsx ../../tests/e2e/server.ts
# Terminal 2: o app compilado, em http://localhost:4173, falando com a API de teste
LOTG_API_URL=http://127.0.0.1:3100 pnpm --filter @lotg/web build
LOTG_API_URL=http://127.0.0.1:3100 pnpm --filter @lotg/web preview
# Terminal 3: preparar o feudo e adiantar o relógio (recarregar a página depois de cada salto)
API=http://127.0.0.1:3100
t() { curl -s -X POST $API/__test/$1 -H 'content-type: application/json' -d "${2:-{\}}"; echo; }
t council-recess; t horde-quiet
t raise '{"building":"townHall","level":3}'; t raise '{"building":"tavern","level":1}'
t raise '{"building":"guild","level":1}';   t raise '{"building":"market","level":2}'
t hero '{"name":"Aldo"}'; t hero '{"name":"Brenna","classId":"archer"}'
t advance '{"ms":3600000}'     # 1 hora real; repetir até o fim do outono (cerca de 46 h no Rápido)
```

Com isso o autor cria um feudo, joga algumas visitas com saltos de algumas horas até o fim do outono e para ali. Os heróis dados pela rota não são os "com nome" da carta: a pergunta G7 trabalha com os nomes que a pessoa viu. Não rodar `pnpm test:e2e` nem `pnpm test:integration` enquanto o feudo do cenário existir: os dois apagam o mesmo banco.

**Roteiro da sessão.** O autor fala pouco e anota muito.

1. Entregar o feudo com uma frase só: "Este feudo é seu. Olhe o que quiser. Você vai ficar umas horas sem poder voltar: faça o que achar que precisa antes de sair, e me avise quando terminar."
2. Pedir que a pessoa **pense em voz alta**. Não explicar nada. Anotar o que ela olha primeiro, o que lê, o que ignora, e quanto tempo leva.
3. Antes do salto, fazer as perguntas G1 e G2 da parte B do formulário.
4. Adiantar o relógio 8 horas reais (o inverno entra) e recarregar a página. Se a pessoa mandou uma expedição que chega a uma encruzilhada, adiantar mais 12 horas (o prazo vence): a Postura decide.
5. Deixar a pessoa ler o que encontrar. Anotar o que ela lê e em que ordem, e se abre o relatório da expedição.
6. Fazer as perguntas G3 a G7.
7. Se houver tempo, adiantar mais 8 horas (o ano vira) e perguntar só: "o que mudou?".

**O que observar**, além das respostas: se ela achou "Antes de partir"; se entendeu o soldo pelo que a tela mostra ("O ouro paga a equipe por mais…"); se mandou a equipe em expedição antes de sair; se vendeu o excedente; se escolheu a Postura de propósito; se, na volta, leu o Relatório ou foi direto aos números; se soube dizer o que faria diferente.

**Limites deste caminho, para escrever no relatório:** o feudo não é dela; o ritmo não foi escolha dela; os heróis vieram por atalho e não pela carta; ela sabe que está sendo observada; e o procedimento não foi ensaiado até a data deste documento.

### 3.3 Dúvidas registradas

Não há autor para perguntar. Ficam anotadas para ele decidir:

- **Falta uma forma de preparar um cenário.** O servidor de teste resolve com trabalho manual. Um roteiro que crie o feudo da véspera do inverno com equipe sozinho (como `pnpm capture:landing` faz para as capturas) seria código novo, fora do alcance deste documento.
- **Quem faz o cenário guiado.** As mesmas pessoas das 48 horas chegam sabendo jogar; pessoas novas chegam sem contexto. Recomendação: uma ou duas das que jogaram as 48 horas, depois de responderem a parte A, para o cenário não contaminar as respostas da observação natural.
- **O ritmo no playtest.** A mensagem não recomenda nenhum. Se todos escolherem o Tranquilo, 48 horas mostram quase nada da Guilda (tabela da seção 2). A alternativa é pedir o Rápido a todos: fica mais comparável e deixa de testar a escolha. A decisão é do autor.
- **Retornantes.** Só existem se algum playtest anterior tiver acontecido. Sem isso, o único retornante é o autor, e a comparação "novo contra retornante" não existe.
