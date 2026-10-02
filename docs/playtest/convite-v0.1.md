# Convite do playtest da v0.1

Para a tarefa V2A-T1 do [roadmap da v0.2](../roadmap-v0.2.md). Este arquivo tem duas partes: a **mensagem** que vai para os convidados (V2A-T1.5) e o **roteiro do autor**, com o que fazer antes, durante e depois das 48 horas.

Convidar, entregar o endereço, recolher as respostas e rodar as consultas em produção **são atos do autor**: o agente não fala com as pessoas e não tem acesso ao banco de produção. O que o agente já fez está marcado no roteiro; o que ele faz depois depende do que o autor colar.

**Estado em 2026-10-01:** o playtest ainda não aconteceu. Não existe `relatorio-v0.1.md`.

---

## 1. A mensagem

Notas para quem envia (não vão para os convidados):

- Trocar os três trechos entre `‹ ›`: o dia e a hora em que as 48 horas acabam, por onde a pessoa avisa se algo quebrar, e o nome de quem assina.
- **Não explicar regras**, nem na mensagem nem em conversa: descobrir se o jogo se explica é parte do teste. Se alguém perguntar "o que eu faço?", a resposta é "o que você faria se eu não estivesse aqui?", e a pergunta vai para as anotações.
- A mensagem não diz quanto dura um dia ou um ano do jogo, nem quanto tempo a pessoa "deve" jogar. Deixar assim: o que se mede é quando ela volta por conta própria.
- **A página de apresentação fica de fora** (V2A-T1.6) enquanto os oito pontos do [ADR 0012](../decisions/0012-pagina-de-apresentacao.md) não forem confirmados. Se entrar, anotar no relatório: muda o que se mede no "primeiro contato".
- Mandar a mesma mensagem para todos, no mesmo dia. Quem recebe explicação a mais joga outro teste.

O texto, pronto para colar:

> Oi! Estou fazendo um jogo e queria que você fosse uma das primeiras pessoas a jogar.
>
> **Lords of the Guild** é um jogo medieval de administrar um feudo. Roda no navegador, não instala nada e cabe em visitas de poucos minutos.
>
> **Como jogar**
> 1. Abra https://lords.palsincomehub.com no **computador** (em celular ainda não foi testado).
> 2. Escolha um nome, que pode ser inventado, e clique em **Jogar agora**. Não tem cadastro, e-mail nem senha.
> 3. Jogue quando quiser, quanto quiser, até ‹dia e hora do fim›. O feudo continua andando enquanto você está fora: volte quando der vontade. Se não der, isso também me interessa.
>
> Não vou explicar as regras, de propósito: quero saber se o jogo se explica sozinho. Se alguma coisa não ficar clara, não é você que está errando. É isso que eu preciso descobrir.
>
> **Três pedidos**
> - Use sempre o mesmo navegador, fora da janela anônima: o seu feudo fica guardado nele. E repare qual navegador é (Chrome, Edge, Firefox, Safari…), que eu vou perguntar depois.
> - Se for jogar em outro computador ou outro navegador, gere antes um **Código do Reino**: no jogo, abra **Conta** na barra da esquerda e escolha "Gerar Código do Reino" (ou aperte F1 e procure por "Código do Reino"), e guarde o código. No outro navegador, escolha "Usar Código do Reino" na tela de entrada. Sem ele, limpar os dados do navegador apaga o acesso ao feudo.
> - Se algo quebrar ou parecer errado, me avise por ‹canal›, dizendo mais ou menos o dia e a hora.
>
> **O que fica guardado**
> A conta é anônima. O servidor guarda o nome que você escolher, o tipo de navegador, as ordens que você der ao feudo e as datas de acesso. Não guarda e-mail, senha nem nada que diga quem você é. Não há anúncios nem rastreadores. Você pode excluir a conta quando quiser, pelo próprio jogo, em **Conta**: o acesso é bloqueado na hora e os dados saem do servidor depois de sete dias (cópias de segurança podem guardá-los por até 14 dias).
>
> **É uma versão de teste.** Pode ter defeito, e o feudo desta rodada pode não ser mantido depois.
>
> Quando as 48 horas acabarem, mando um formulário de 9 perguntas, uns cinco minutos, sem resposta certa. O apelido é opcional.
>
> Obrigado por topar!
> ‹nome›

De onde vem cada frase, para quem for mexer no texto:

| O que a mensagem diz | Fonte |
|---|---|
| Endereço, o nome e o botão **Jogar agora** | Produção ([ADR 0009](../decisions/0009-implantacao-no-coolify.md)); tela de boas-vindas do app, que pede o nome de quem governa e o do feudo |
| Computador, não celular | GDD §1 (público); navegadores de celular nunca foram abertos ([acceptance-v0.1.md](../acceptance-v0.1.md)) |
| O que o servidor guarda e a exclusão | Seção "Privacidade" do [README](../../README.md), texto aprovado pelo autor; GDD §14.14 |
| Código do Reino | GDD §14.7; comando "Conta: gerar Código do Reino" e o botão "Usar Código do Reino" das boas-vindas |
| Formulário de 9 perguntas, apelido opcional | [formulario.md](formulario.md) |

"O feudo desta rodada pode não ser mantido" é cautela, e não plano: o [ADR 0013](../decisions/0013-regras-da-v0.2-tempo-ritmo-migracao-e-economia.md) manda migrar as partidas da v0.1 preservando tudo. A frase existe porque o backup externo ainda não foi feito (item 3 do roteiro). Feito o backup, o autor pode tirá-la.

---

## 2. Roteiro do autor

### Antes de convidar

- [x] **(agente, V2A-T1.2)** Consultas de playtest ensaiadas no banco de desenvolvimento em 2026-10-01 e filtro de período acrescentado. Em produção elas **nunca rodaram**.
- [ ] **(autor, V2A-T1.1)** No dia, conferir a produção e anotar as duas respostas para o relatório:

  ```bash
  curl -s https://lords.palsincomehub.com/v1/health    # esperado: {"status":"ok","db":"ok"}
  curl -s https://lords.palsincomehub.com/v1/version   # anotar server e builtAt
  ```

- [ ] **(autor, V2A-T1.1)** **Congelar o `main` pelas 48 horas.** Todo `push` no `main` com a CI verde é implantado sozinho, e um deploy no meio muda o que as pessoas estão jogando. Em 2026-10-01 o `main` local tem os commits da v0.2 sem `push`: **não dar `push` antes do fim do playtest**, ou o playtest da v0.1 vira playtest de outra coisa.
- [ ] **(autor, V2A-T1.3)** Decidir se a cópia do `RECOVERY_CODE_SECRET` fora do Coolify e o destino externo dos backups ([architecture.md §6.3](../architecture.md)) são feitos antes de haver feudos de outras pessoas no banco. Não bloqueiam o playtest; sem eles, perder o servidor perde os feudos dos convidados.
- [ ] **(autor, V2A-T1.4)** Escolher 3 a 5 pessoas e a janela. Preferir quem trabalha no computador, que é o público do jogo (GDD §1). O servidor aceita 10 contas novas por hora por IP: convidados na mesma rede (um escritório, por exemplo) podem bater nesse limite.
- [ ] **(autor)** Anotar a data e a hora do envio: é o começo da janela das consultas.
- [ ] **(autor)** Anotar o identificador da própria conta, para tirá-la das métricas. O app não o mostra em nenhuma tela: ele está no navegador em que o autor joga (ferramentas de desenvolvedor → Local Storage → chave `lords.account:self`, campo `accountId`), ou sai do banco pelo nome de exibição (o cabeçalho do bloco de playtest de `ops.sql` traz a consulta).
- [ ] **(autor, V2A-T1.5)** Mandar a mensagem da seção 1.

### Durante as 48 horas

- [ ] **(autor, V2A-T1.7)** Nenhum deploy e nenhum reinício deliberado.
- [ ] **(autor, V2A-T1.7)** Anotar, com data e hora, tudo o que as pessoas relatarem e qualquer queda. O workflow `health.yml` avisa por e-mail quando o jogo cai; **a chegada desse e-mail nunca foi conferida**, então olhar também a aba Actions do GitHub uma ou duas vezes por dia.
- [ ] **(autor)** Não responder dúvida de regra. Anotar a dúvida como veio.

### Depois

- [ ] **(autor, V2A-T1.8)** Mandar o [formulário](formulario.md), com as perguntas todas opcionais e sem coletar e-mail. Apelido opcional; nenhum outro dado pessoal.
- [ ] **(autor, V2A-T1.9)** Rodar as consultas de [`deploy/analytics/ops.sql`](../../deploy/analytics/ops.sql) em produção: Coolify → `lotg-db` → Terminal → `psql -U lotg lotg`.
  1. Colar as três linhas `\set` do bloco "Filtro do playtest" **com os valores do playtest**: o começo e o fim da janela de criação das contas, no formato `'2026-10-05 00:00 America/Sao_Paulo'` (ano-mês-dia), e o identificador da conta do autor.
  2. Colar "Filtro em vigor" e conferir: a janela é a que se queria, `conta_do_autor_existe` é verdadeiro e `contas_nas_metricas` é o número de pessoas que criaram conta.
  3. Colar, uma por vez: **sessões por dia**, **comandos por sessão**, **tempo até o primeiro comando** e **retorno no dia 2**; e, do começo do arquivo, "Contas: total…" e "Comandos por tipo e resultado".
  4. Copiar as saídas como vieram.
- [ ] **(autor)** Rodar a consulta de retorno **só depois que o segundo dia de cada conta terminar** no calendário de São Paulo: antes disso ela devolve só a linha do total, com zero, e isso quer dizer "cedo demais", não "ninguém voltou". E rodar tudo **antes de sete dias** do fim: conta excluída some das métricas no expurgo.
- [ ] **(autor)** Colar para o agente as respostas do formulário, as anotações e as saídas das consultas.
- [ ] **(agente, com o que o autor colar; V2A-T1.10, T1.11 e T1.13)** Montar `docs/playtest/relatorio-v0.1.md` a partir de [relatorio-modelo.md](relatorio-modelo.md): uma linha por achado, com origem e classe proposta (P0 a P3). **A classe é decidida pelo autor.**
- [ ] **(autor, V2A-T1.12)** Fora da janela congelada, em conta de teste: reinício da API com obra em andamento e aba aberta; fome e retorno depois de tempo real longo; expurgo de sete dias. Registrar em [acceptance-v0.1.md](../acceptance-v0.1.md).

### O que as consultas não vão dizer

Leituras não ficam gravadas no banco: só os comandos. Quem voltou, olhou o feudo e saiu sem dar nenhuma ordem **não aparece** como sessão nem como retorno. Os números de retorno são um piso; a pergunta 4 do formulário ("quantas vezes você abriu o jogo") é o que cobre a diferença.
