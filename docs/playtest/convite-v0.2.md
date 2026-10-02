# Convite do playtest da v0.2

Para a tarefa V2F-T3 do [roadmap da v0.2](../roadmap-v0.2.md). Este arquivo tem três partes: a **mensagem** que vai para os convidados, o **roteiro do autor**, com o que fazer antes, durante e depois das 48 horas, e o **cenário guiado**, que cobre o que 48 horas não alcançam (V2F-T3.3). O formulário está em [formulario-v0.2.md](formulario-v0.2.md).

Convidar, entregar o endereço, recolher as respostas, conduzir o cenário guiado e rodar as consultas em produção **são atos do autor**: o agente não fala com as pessoas e não tem acesso ao banco de produção. Este documento é só o que não depende de pessoas.

**Estado em 2026-10-02: a v0.2 ainda não foi publicada.** Ela está no `main` local, sem `push`, e a produção roda a `v0.1.0`. O convite só pode sair depois de a v0.2 ser publicada (em dois passos, [deploy/README.md](../../deploy/README.md)) e de o autor a ter jogado. Quem abrir o endereço hoje joga a v0.1. O playtest da v0.1 (V2A-T1) também não aconteceu: não existe `relatorio-v0.1.md`, e por isso **não há linha de base de pessoas** para comparar (V2F-T3.5).

Este documento foi escrito enquanto as Fases C a F da v0.2 ainda eram implementadas. O que ele diz do jogo vem do roadmap e dos ADRs [0013](../decisions/0013-regras-da-v0.2-tempo-ritmo-migracao-e-economia.md) e [0014](../decisions/0014-conselho-e-ameaca-na-v0.2.md). **Conferir a mensagem contra o jogo publicado antes de enviar** (item do roteiro).

---

## 1. A mensagem

Notas para quem envia (não vão para os convidados):

- Trocar os três trechos entre `‹ ›`: o dia e a hora em que as 48 horas acabam, por onde a pessoa avisa se algo quebrar, e o nome de quem assina.
- **Não explicar regras**, nem na mensagem nem em conversa. Estações, cartas do Conselho, moral, lobos, Torre e Paliçada são exatamente o que se quer saber se o jogo explica sozinho. Se alguém perguntar "o que eu faço?", a resposta é "o que você faria se eu não estivesse aqui?", e a pergunta vai para as anotações.
- A mensagem não diz quanto dura um dia ou um ano do jogo, nem quanto a pessoa "deve" jogar ([ADR 0011](../decisions/0011-ritmo-3x-no-mvp.md)). Deixar assim: o que se mede é quando ela volta por conta própria.
- **Dificuldade e ritmo ficam por conta de cada um.** A tela inicial oferece as opções com uma frase cada. A mensagem não recomenda nenhuma: saber se essas frases bastam para escolher é parte do teste. O que cada pessoa escolheu é anotado depois (pergunta 15 do formulário e a consulta do roteiro).
- **A página de apresentação fica de fora** enquanto os oito pontos do [ADR 0012](../decisions/0012-pagina-de-apresentacao.md) não forem confirmados. Se entrar, anotar no relatório: muda o que se mede no primeiro contato.
- Mandar a mesma mensagem para todos, no mesmo dia. Quem recebe explicação a mais joga outro teste.
- Mesma duração (48 horas) e mesmo tipo de público do playtest da v0.1, para a diferença ser da versão (V2F-T3.1). Anotar quem é **novo** e quem é **retornante**. Para quem já tem um feudo, usar o parágrafo extra no fim desta seção.

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
> Quando as 48 horas acabarem, mando um formulário de 16 perguntas, uns dez minutos, sem resposta certa. O apelido é opcional.
>
> Obrigado por topar!
> ‹nome›

Parágrafo extra, **só para quem já jogou uma versão anterior** (entra depois de "Como jogar"):

> **Você já tem um feudo.** Ele continua lá, do jeito que você deixou: abra o jogo no mesmo navegador de antes. O jogo mudou desde a última vez, e eu queria saber o que você nota. Se aparecer o aviso "Há uma versão nova do jogo. Recarregue a página.", é só recarregar.

De onde vem cada frase, para quem for mexer no texto:

| O que a mensagem diz | Fonte |
|---|---|
| Endereço, o nome e o botão **Jogar agora** | Produção ([ADR 0009](../decisions/0009-implantacao-no-coolify.md)); tela de boas-vindas do app |
| "A tela deixa escolher a dificuldade e o ritmo" | Boas-vindas da v0.2 (V2B-T3, GDD §13.9); as opções vêm de `GET /v1/catalog` |
| "Eles aparecem nas Preferências" | V2B-T3.4: a aba Preferências mostra dificuldade e ritmo, sem editar |
| Computador, não celular | GDD §1 (público); navegadores de celular nunca foram abertos ([acceptance-v0.1.md](../acceptance-v0.1.md)) |
| O que o servidor guarda e a exclusão | Seção "Privacidade" do [README](../../README.md), texto aprovado pelo autor; GDD §14.14. É o mesmo parágrafo do [convite da v0.1](convite-v0.1.md) |
| Código do Reino | GDD §14.7; comando "Conta: gerar Código do Reino" e o botão "Usar Código do Reino" das boas-vindas |
| "O feudo continua lá" (retornantes) | [ADR 0013](../decisions/0013-regras-da-v0.2-tempo-ritmo-migracao-e-economia.md), decisão 4: as partidas da v0.1 são migradas, preservando tudo |
| "Há uma versão nova do jogo. Recarregue a página." | [ADR 0014](../decisions/0014-conselho-e-ameaca-na-v0.2.md), "Compatibilidade": resposta do servidor a um app anterior ao protocolo 2 |
| Formulário de 16 perguntas, apelido opcional | [formulario-v0.2.md](formulario-v0.2.md), parte A |

"O feudo desta rodada pode não ser mantido" continua sendo cautela, e não plano. A frase existe porque o backup externo ainda não foi feito. Feito o backup, o autor pode tirá-la.

**Duas frases a conferir no jogo publicado antes de enviar:** que as boas-vindas mostram mesmo dificuldade e ritmo antes de **Jogar agora**, e que as Preferências mostram os dois. Se o jogo publicado disser outra coisa, vale o jogo, e a mensagem muda.

---

## 2. Roteiro do autor

### O que 48 horas alcançam em cada ritmo

Para o autor, **não para os convidados**. Mostra o que a observação natural consegue ver e o que fica para o cenário guiado. Os instantes vêm dos ADRs 0013 e 0014 (primeira carta depois de 4 dias de jogo; uivos no dia 10 e lobos no dia 16 do ano 1; estações de 24 dias de jogo, inverno de 12).

| Acontecimento | Rápido (3×) | Normal (1×) | Tranquilo (0,5×) |
|---|---:|---:|---:|
| Primeira carta do Conselho | 2h40 | 8 h | 16 h |
| Prazo para responder uma carta | 24 h reais | 24 h reais | 24 h reais |
| Uivos (prenúncio) | 6 h | 18 h | 36 h |
| Incursão de lobos do ano 1 | 10 h | 30 h | **60 h: fora da janela** |
| Verão | 16 h | 48 h: no fim da janela | fora da janela |
| Outono | 32 h | fora da janela | fora da janela |
| Inverno (lenha e frio) | 48 h: no fim da janela | fora da janela | fora da janela |
| Virada do ano | **56 h: fora da janela** | fora da janela | fora da janela |

Leitura: **em nenhum ritmo as 48 horas mostram o inverno nem a virada do ano.** No Normal, a pessoa vê a primavera inteira e os lobos. No Tranquilo, nem os lobos. Por isso V2F-T3.3 separa a observação natural do cenário guiado (seção 3). E por isso o ritmo que cada pessoa escolheu entra em toda leitura das respostas: "não vi nenhuma carta" quer dizer coisas diferentes no Rápido e no Tranquilo.

### Antes de convidar

- [ ] **(autor)** Publicar a v0.2. Antes do primeiro `push`: backup externo e cópia do `RECOVERY_CODE_SECRET` fora do Coolify ([pendencias-v0.2.md](../pendencias-v0.2.md), seção 3). A publicação vai em **dois passos**, primeiro só a Fase B, depois o resto ([deploy/README.md](../../deploy/README.md), "A primeira publicação da v0.2 vai em dois passos").
- [ ] **(autor)** Ter jogado a v0.2 e lido as 21 cartas do Conselho. Elas foram escritas pelo agente e estão no jogo sem aprovação carta a carta. Convidar pessoas antes disso é mostrar a elas um texto que o autor não leu.
- [ ] **(autor, V2F-T2)** O quadro de aceitação da v0.2 preenchido. O playtest não substitui a aceitação.
- [ ] **(autor)** Conferir a mensagem da seção 1 contra o jogo publicado (as duas frases marcadas).
- [ ] **(autor)** No dia, conferir a produção e anotar as respostas para o relatório:

  ```bash
  curl -s https://lords.palsincomehub.com/v1/health    # esperado: {"status":"ok","db":"ok"}
  curl -s https://lords.palsincomehub.com/v1/version   # anotar server, builtAt e o hash do conteúdo
  ```

- [ ] **(autor, V2F-T3.1)** **Congelar o `main` pelas 48 horas.** Todo `push` no `main` com a CI verde é implantado sozinho, e um deploy no meio muda o que as pessoas estão jogando: o hash do conteúdo anotado acima é o que identifica a versão das cartas.
- [ ] **(autor, V2F-T3.1)** Escolher 3 a 5 pessoas e a janela. Preferir quem trabalha no computador (GDD §1). Anotar, para cada uma, se é nova ou retornante, sem identificar. O servidor aceita 10 contas novas por hora por IP: convidados na mesma rede podem bater nesse limite.
- [ ] **(autor)** Anotar a data e a hora do envio: é o começo da janela das consultas.
- [ ] **(autor)** Anotar o identificador da própria conta, para tirá-la das métricas (como no [convite da v0.1](convite-v0.1.md): ferramentas de desenvolvedor → Local Storage → chave `lords.account:self`, campo `accountId`).
- [ ] **(autor, V2F-T3.3)** Decidir como será o cenário guiado (seção 3) e **ensaiá-lo sozinho** antes de chamar alguém.
- [ ] **(agente, antes do envio)** Ensaiar no banco de desenvolvimento as duas consultas novas deste roteiro ("Ritmo e dificuldade" e "Acontecimentos"). Elas **nunca rodaram**.
- [ ] **(autor)** Mandar a mensagem da seção 1.

### Durante as 48 horas

- [ ] **(autor)** Nenhum deploy e nenhum reinício deliberado.
- [ ] **(autor)** Anotar, com data e hora, tudo o que as pessoas relatarem e qualquer queda. O workflow `health.yml` avisa por e-mail quando o jogo cai; a chegada desse e-mail nunca foi conferida, então olhar também a aba Actions do GitHub uma ou duas vezes por dia.
- [ ] **(autor)** Não responder dúvida de regra. Anotar a dúvida como veio. As mais prováveis nesta versão, para reconhecer e anotar sem responder: "por que parou de produzir?" (estoque cheio), "o que é essa carta?", "por que perdi comida?" (lobos), "por que a produção caiu?" (troca de ofício, frio ou moral).
- [ ] **(autor)** Não jogar na conta de ninguém nem pedir captura de tela do feudo durante a janela: muda o comportamento.

### Depois

- [ ] **(autor, V2F-T3.2)** Mandar a **parte A** do [formulário](formulario-v0.2.md), com as perguntas todas opcionais e sem coletar e-mail. Apelido opcional; nenhum outro dado pessoal.
- [ ] **(autor)** Rodar as consultas de [`deploy/analytics/ops.sql`](../../deploy/analytics/ops.sql) em produção: Coolify → `lotg-db` → Terminal → `psql -U lotg lotg`.
  1. Colar as três linhas `\set` do bloco "Filtro do playtest" **com os valores deste playtest**.
  2. Colar "Filtro em vigor" e conferir a janela, `conta_do_autor_existe` e `contas_nas_metricas`.
  3. Colar, uma por vez: **sessões por dia**, **comandos por sessão**, **tempo até o primeiro comando** e **retorno no dia 2**; e, do começo do arquivo, "Contas: total…" e "Comandos por tipo e resultado". Na v0.2, os tipos de comando mostram também quem respondeu carta e quem marcou obra para começar sozinha.
  4. Colar as duas consultas novas, abaixo.
  5. Copiar as saídas como vieram.
- [ ] **(autor)** Rodar a consulta de retorno **só depois que o segundo dia de cada conta terminar** no calendário de São Paulo, e tudo **antes de sete dias** do fim: conta excluída some das métricas no expurgo.
- [ ] **(autor, V2F-T3.3)** Conduzir o cenário guiado (seção 3) e anotar as respostas da **parte B** do formulário, em folha separada.
- [ ] **(autor)** Colar para o agente as respostas do formulário, as anotações e as saídas das consultas.
- [ ] **(agente, com o que o autor colar; V2F-T3.4 e T3.5)** Montar `docs/playtest/relatorio-v0.2.md` a partir de [relatorio-modelo.md](relatorio-modelo.md), com três acréscimos: uma coluna "novo ou retornante" e "ritmo e dificuldade" na tabela de participantes; uma seção "Módulo de diversão" com as respostas das perguntas 10 a 14; e uma seção "Cenário guiado", **separada**, com as respostas da parte B. Contagens sempre com denominador; nada de "retenção comprovada" com 3 a 5 pessoas. A classe de cada achado (P0 a P3) é proposta pelo agente e **decidida pelo autor**.
- [ ] **(agente)** Comparar o retorno no dia 2 com o da v0.1, **ou declarar que não há linha de base**, se o playtest da v0.1 não tiver acontecido até lá.

As duas consultas novas. Foram escritas para este roteiro a partir de `packages/server/src/db/schema.ts` e **não foram ensaiadas**: conferir no banco de desenvolvimento antes de usar, como V2A-T1.2 fez com as outras. As duas usam as mesmas três variáveis `\set` e são agregadas, sem nome de jogador.

```sql
-- Ritmo e dificuldade: o que as contas do playtest escolheram ao criar a partida.
with jogadores as (
  select id
  from accounts
  where display_name not like 'Bot %'
    and created_at >= :'playtest_inicio'::timestamptz
    and created_at < :'playtest_fim'::timestamptz
    and id <> :'conta_do_autor'::uuid
)
select g.time_scale as ritmo, g.difficulty as dificuldade, g.status, g.schema_version, count(*) as partidas
from games g
join jogadores j on j.id = g.account_id
group by 1, 2, 3, 4
order by 1, 2, 3;

-- Acontecimentos: quantas vezes cada tipo de evento aconteceu, e em quantas partidas.
-- Os nomes dos tipos são os de EVENT_TYPES em packages/content/src/chronicle.ts. Os que interessam
-- ao playtest da v0.2 são os de carta (sorteada, respondida, expirada), de estoque (cheio,
-- desperdício), de frio, de moral e de incursão.
with jogadores as (
  select id
  from accounts
  where display_name not like 'Bot %'
    and created_at >= :'playtest_inicio'::timestamptz
    and created_at < :'playtest_fim'::timestamptz
    and id <> :'conta_do_autor'::uuid
)
select e.kind as tipo, count(*) as eventos, count(distinct e.game_id) as partidas
from game_events e
join games g on g.id = e.game_id
join jogadores j on j.id = g.account_id
where e.kind <> 'dayStarted'
group by 1
order by 2 desc;
```

### O que as consultas não vão dizer

- Leituras não ficam gravadas no banco: só os comandos. Quem voltou, olhou o feudo e saiu sem dar nenhuma ordem **não aparece** como sessão nem como retorno. Na v0.2 isso pesa mais: o jogo agora dá motivo para voltar só para ler (o Relatório, uma carta, o aviso de estação). A pergunta 4 do formulário cobre a diferença.
- **Retornantes ficam de fora das métricas.** As consultas só contam contas **criadas dentro da janela**. Quem já tinha feudo não entra nelas, a não ser que a janela seja aberta até a criação da conta, o que mistura o que a pessoa fez antes. Para retornantes, o dado é o formulário.
- Uma carta que expirou não diz se a pessoa a viu. "Expirada" conta quem não voltou a tempo e quem leu e preferiu não responder.
- O que a pessoa sentiu no inverno: as 48 horas não chegam lá (tabela acima). Isso é do cenário guiado.

---

## 3. Cenário guiado (V2F-T3.3)

**Por que existe.** O inverno, o frio, a lenha e a virada do ano são metade do que a v0.2 promete ("meu feudo muda com as estações"), e nenhuma observação natural de 48 horas os alcança. O cenário guiado testa isso de propósito, em uma sessão curta. **As respostas dele nunca se somam às da observação natural**: a pessoa não chegou ali jogando, não escolheu o ritmo e sabe que está sendo observada.

Há dois caminhos. O primeiro é barato e natural; o segundo é controlado e precisa de ensaio.

### 3.1 Observação prolongada

Para quem escolheu o ritmo Rápido e quiser continuar: pedir que jogue até cerca de 60 horas depois de ter começado. O inverno começa na hora 48 e o ano vira na hora 56. Depois, mandar a **parte C** do formulário. No relatório, essas respostas ficam marcadas como "prolongada", com a hora em que a pessoa parou.

Limite: só vale para o Rápido, só para quem quiser, e a pessoa pode ter dormido durante o inverno inteiro (são 8 horas reais). Se dormiu, o que se mede é o Relatório de Retorno do inverno, o que também interessa.

### 3.2 Sessão guiada: "a véspera do inverno"

Uma pessoa por vez, cerca de 20 minutos, no computador do autor ou com a tela compartilhada. A pessoa recebe um feudo no fim do outono, prepara a ausência, o tempo é adiantado, e ela volta para ler o que aconteceu.

**Preparação.** É preciso um feudo perto do inverno, e **não existe ferramenta para criar um**. O caminho possível hoje é o servidor dos testes em navegador, que tem um relógio adiantável. Ele **nunca foi usado à mão para isto**, e tem uma diferença em relação aos testes automáticos: os testes adiantam também o relógio da página; à mão, só o do servidor anda, então é preciso recarregar a página depois de cada salto.

```bash
pnpm dev:up
# Terminal 1: a API de teste, na porta 3100, no ritmo da produção. APAGA o banco de teste ao subir.
GAME_TIME_SCALE=3 pnpm --filter @lotg/server exec tsx ../../tests/e2e/server.ts
# Terminal 2: o app compilado, em http://localhost:4173, falando com a API de teste
LOTG_API_URL=http://127.0.0.1:3100 pnpm --filter @lotg/web build
LOTG_API_URL=http://127.0.0.1:3100 pnpm --filter @lotg/web preview
# Terminal 3: adiantar o relógio do servidor (aqui, 1 hora real); depois, recarregar a página
curl -s -X POST http://127.0.0.1:3100/__test/advance -H 'content-type: application/json' -d '{"ms": 3600000}'
```

Com isso o autor cria um feudo, joga algumas visitas com saltos de algumas horas até o fim do outono (cerca de 46 horas reais depois do começo, no ritmo Rápido) e para ali. Não rodar `pnpm test:e2e` nem `pnpm test:integration` enquanto o feudo do cenário existir: os dois apagam o mesmo banco.

**Roteiro da sessão.** O autor fala pouco e anota muito.

1. Entregar o feudo com uma frase só: "Este feudo é seu. Olhe o que quiser. Você vai ficar umas horas sem poder voltar: faça o que achar que precisa antes de sair, e me avise quando terminar."
2. Pedir que a pessoa **pense em voz alta**. Não explicar nada. Anotar o que ela olha primeiro, o que lê, o que ignora, e quanto tempo leva.
3. Antes do salto, fazer as perguntas G1 e G2 da parte B do formulário.
4. Adiantar o relógio 8 horas reais (o inverno entra) e recarregar a página.
5. Deixar a pessoa ler o que encontrar. Anotar o que ela lê e em que ordem.
6. Fazer as perguntas G3 a G5.
7. Se houver tempo, adiantar mais 8 horas (o ano vira) e perguntar só: "o que mudou?".

**O que observar**, além das respostas: se ela achou a seção "Antes de partir"; se entendeu quanta madeira o inverno pede só pelo que a tela mostra; se deixou uma obra para começar sozinha; se, na volta, leu o Relatório ou foi direto aos números; se soube dizer o que faria diferente.

**Limites deste caminho, para escrever no relatório:** o feudo não é dela; o ritmo não foi escolha dela; ela sabe que está sendo observada; e o procedimento não foi ensaiado até a data deste documento.

### 3.3 Dúvidas registradas

Não há autor para perguntar. Ficam anotadas para ele decidir:

- **Falta uma forma de preparar um cenário.** O servidor de teste resolve com trabalho manual. Um roteiro que crie o feudo da véspera do inverno sozinho (como `pnpm capture:landing` faz para as capturas) seria código novo, fora do alcance deste documento.
- **Quem faz o cenário guiado.** As mesmas pessoas das 48 horas chegam sabendo jogar; pessoas novas chegam sem contexto. Recomendação: uma ou duas das que jogaram as 48 horas, depois de responderem a parte A, para o cenário não contaminar as respostas da observação natural.
- **O ritmo no playtest.** A mensagem não recomenda nenhum. Se todos escolherem o Tranquilo, 48 horas mostram muito pouco (tabela da seção 2). A alternativa é pedir o Rápido a todos: fica mais comparável e deixa de testar a escolha. A decisão é do autor.
- **Retornantes.** Só existem se o playtest da v0.1 acontecer antes. Sem ele, o único retornante é o autor, e a comparação "novo contra retornante" não existe.
