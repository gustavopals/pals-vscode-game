# Lords of the Guild — Roadmap da v0.2 "Estações e Conselho"

> **Status:** planejado; revisão documental concluída, execução não iniciada. As 27 tarefas das Fases A–F têm subtarefas e entregáveis. Decisões de regra ainda abertas estão na §10; ideias adicionais estão na §12.\
> **Versão do documento:** 0.2 (2026-10-01, revisão após o fechamento da v0.1)\
> **Base:** [GAME_DESIGN.md](../GAME_DESIGN.md) v0.6: §16.2 (critérios da v0.2), §18.2 (seções que a v0.2 implementa) e §14 (contrato de arquitetura)\
> **Vem de:** [MVP-ROADMAP.md](../MVP-ROADMAP.md) (v0.1.0 — 2026-10-01), tarefa F5-T5\
> **Idioma:** português (Brasil); identificadores de código em inglês

Nenhuma tarefa de implementação deste documento foi executada. Revisar o plano não conclui tarefas nem aprova automaticamente propostas de regra.

**Leia primeiro:** §0.6 (experiência que queremos entregar), §0.7 (sequência de entregas) e §10 (decisões). Para implementar, leia a tarefa, os contratos da §0.8 e a matriz de testes da §7. Para conteúdo novo, veja as propostas da §12.

## Índice

- [0. Escopo, experiência e execução](#0-como-usar-este-roadmap)
- [1. Fase A — Playtest e correções](#1-fase-a--playtest-e-correções)
- [2. Fase B — Fundação técnica](#2-fase-b--fundação-técnica-antes-das-mecânicas)
- [3. Fase C — Economia e estações](#3-fase-c--o-mundo-muda-economia-da-v02)
- [4. Fase D — Conselho](#4-fase-d--o-conselho-do-feudo)
- [5. Fase E — Ameaça e defesas](#5-fase-e--ameaça-torre-paliçada-e-lobos)
- [6. Fase F — Balanceamento e release](#6-fase-f--fechamento-da-v02)
- [7. Aceitação e testes](#7-mapa-dos-critérios-de-aceitação-gdd-162-para-tarefas)
- [8. Lições do MVP](#8-o-que-o-mvp-ensinou)
- [9. Dívidas conhecidas](#9-dívidas-técnicas-registradas)
- [10. Decisões e recomendações](#10-decisões-que-esperam-o-autor)
- [11. Registro de execução](#11-registro-de-execução)
- [12. Ideias de experiência e conteúdo](#12-propostas-de-experiência-e-conteúdo)
- [13. Resultado desta revisão](#13-resultado-da-revisão-documental)

---

## 0. Como usar este roadmap

### 0.1 O que é a v0.2

A v0.2 é a linha "Estações e Conselho" da tabela do GDD §16: **estações com efeito, armazenamento, moral, troca de ofício, cartas e cadeias, Torre de Vigia, Paliçada, lobos, dificuldade e ritmo**. O que o jogador deve sentir: "o mundo muda e me pede decisões".

O GDD §18.2 diz quais seções a v0.2 implementa: §4, §5.4–5.7, §6 (Celeiro, Armazém, Torre, Paliçada), §7, §8.2 (lobos e Ameaça com tiles abstratos) e §12.1. Os critérios de aceitação são os da §16.2:

1. O estoque para no cap e o painel mostra "cheio em".
2. Uma carta aparece a cada 8 h e expira em 24 h com a opção padrão.
3. Uma cadeia de 3 cartas funciona de ponta a ponta.
4. A incursão de lobos do dia 2 acontece offline e aparece no Relatório.
5. A troca de ofício reduz a produção por 2 h.
6. Dificuldade e ritmo são escolhidos na criação.

**Não entra:** heróis, Taverna, expedições, Mercado e caravanas, Mestres (v0.3); exército, Quartel, Ferreiro, ferro e armas, formações, Muralha de Pedra, presságios, Fortaleza, Cerco, Hora da Vigília com efeito (v0.4); mapa gráfico, postos avançados, Capela, relíquias, Legado, Temporadas (v0.5). A regra do projeto continua valendo: **não antecipar mecânicas de versões futuras, nem "só a estrutura"**. Onde uma regra da v0.2 cita algo de outra versão (a carta que entrega um herói, a Taverna na fórmula da moral, o disparo da Torre no nível 3), a parte de outra versão fica de fora, e os casos em que isso exige escolha estão na [§10](#10-decisões-que-esperam-o-autor).

Este roadmap também herda o que a v0.1 deixou por fazer: o playtest com outras pessoas (Fase A) e as dívidas técnicas que a v0.2 precisa pagar antes de mudar o estado do jogo (Fase B).

### 0.2 Estrutura do plano

```
Fase (A…F)  →  Tarefa (V2A-T1)  →  Subtarefa (V2A-T1.3)
```

Os identificadores começam com `V2` para não se confundirem com os da v0.1 (`F1-T3`). Cada tarefa tem dependências, entregáveis, subtarefas com caixas de seleção e **pronto quando**. A verificação comum está na §0.9; os cenários específicos aparecem na tarefa e na §7. Referências ao GDD acompanham as regras correspondentes. A Fase A inclui prompts para a primeira sessão.

| Tamanho | Significado |
|---|---|
| `S` | Uma sessão curta do Claude Code |
| `M` | Uma a duas sessões; plano aprovado antes de codar |
| `L` | Duas a quatro sessões; dividir pelas subtarefas, em branch, com merge ao final |

Os tamanhos indicam a complexidade relativa, não um compromisso de prazo. Reestimar ao abrir a tarefa, depois das decisões aplicáveis da §10. Este documento não dá estimativa de prazo total: depende do playtest, do conteúdo aprovado e dos resultados do balanceamento.

A ordem das fases é obrigatória. Dentro de uma fase, vale o campo "Depende de".

### 0.3 Ritual de cada tarefa

É o do [MVP-ROADMAP.md §0.3 e §A.4](../MVP-ROADMAP.md), com o que a v0.1 ensinou (§8):

1. Abrir a sessão lendo `CLAUDE.md`, as seções do GDD indicadas e a tarefa neste arquivo. As subtarefas abaixo são a base: ao abrir uma fase, conferir os caminhos no código, resolver somente as decisões que a bloqueiam e ajustar o plano com o autor. Não reabrir decisões já registradas sem um motivo novo.
2. Plano aprovado antes de codar em tarefas `M` e `L`.
3. Testes primeiro onde houver regra de jogo ou contrato de API.
4. Rodar a "Verificação" da tarefa e `pnpm verify` (mais `pnpm test:integration` se tocar o servidor e `pnpm test:e2e` se tocar o app) e mostrar a saída.
5. Marcar as caixas, preencher o Registro de Execução (§11) com o que foi verificado **e o que não foi**, registrar desvios do GDD em `docs/decisions/NNNN-titulo.md` e fazer um commit `V2C-T2: resumo`.
6. Uma tarefa por sessão. Revisar documentação não autoriza publicar: `push` no `main` aciona o deploy. Testes do autor podem ocorrer em ambiente isolado; a passagem para produção segue a decisão 3 da §10.

### 0.4 A regra de toda mecânica nova

Vale para cada tarefa das Fases C, D e E (GDD §18.3). Uma mecânica só está pronta com:

- **dados em `@lotg/content`**, com schema zod e teste de conteúdo; nenhum número de jogo no motor, no servidor ou no app;
- **validação de comando** no motor, com código de recusa e frase legível em português;
- **evento na Crônica**, com o modelo de frase em `content`;
- **explicação do número** no `ViewState` (o texto que o jogador lê ao perguntar "por que este valor?"), calculada no motor;
- **teste**: unidade, propriedade de divisão de intervalo ainda exata, golden atualizado de propósito, e um teste em navegador quando houver interface;
- **GDD atualizado** se a regra mudou.

### 0.5 O que o Claude Code não decide sozinho

Tudo o que está na [§10](#10-decisões-que-esperam-o-autor), qualquer desvio do GDD, qualquer dependência nova, quem participa do playtest, e o que fazer com as partidas que já existem em produção quando o estado mudar de versão. Onde o GDD é vago, a tarefa traz a pergunta; a resposta vira ADR ou correção do GDD antes do código.


### 0.6 Experiência da versão: crescer, escolher, preparar e voltar

**Promessa da v0.2:** “Meu feudo muda com as estações; minhas decisões deixam uma história; consigo me preparar antes de sair.”

O sucesso desta versão não é ter muitos painéis. É o jogador conseguir responder: **o que mudou, por que mudou, o que posso decidir agora e o que acontecerá enquanto eu estiver fora?**

| Momento da jornada | Decisão do jogador | Sinal de progresso | Entregas |
|---|---|---|---|
| Primeira sessão | Alimentar a vila e escolher a primeira melhoria | Objetivos curtos, produção explicada, próximo desbloqueio visível | Preservar v0.1; V2B-T3, V2E-T4 |
| Preparar a ausência | Ampliar o estoque ou investir na produção; planejar obras | Prazo “cheio em”, motivo de bloqueio e fila automática visíveis | V2C-T2, V2C-T5 |
| Primeira mudança de estação | Adaptar a economia sem trocar todos de ofício por impulso | Taxas com fatores sazonais, adaptação e experiência compreensíveis | V2C-T1, V2C-T3 |
| Primeiro dilema | Gastar agora, conservar reservas ou aceitar uma consequência | Uma resposta do Conselho vira uma linha reconhecível na Crônica | V2D-T1 a V2D-T3 |
| Aproximação do perigo | Investir em aviso e defesa ou assumir a perda possível | Torre dá antecedência; Paliçada muda o resultado | V2E-T1 a V2E-T3 |
| Retorno | Recuperar o feudo ou aproveitar o que foi preparado | Relatório separa ganhos, perdas, motivos e decisões ainda disponíveis | V2C-T2, V2D-T3, V2E-T3 |
| Fim de um ano e início de outro | Rever prioridades com o que aprendeu | Calendário continua sem repetir eventos indevidos ou apagar cadeias por acidente | V2D-T2, V2E-T3, decisão 20 |

Os momentos são uma sequência de aprendizado, **não datas prometidas**: o ritmo é configurável e a v0.2 não contém o cerco. Não anunciar “venceu o ano”, Legado ou recompensas de guerra antes da versão correspondente.

**Critérios de diversão para toda entrega:**

- Mostrar o benefício junto do custo. Estoque limitado, adaptação e moral só acrescentam diversão se o jogador tiver uma alternativa viável, visível e alcançável.
- Preservar sessões de 2–10 minutos e ações principais a até dois cliques ou um comando (GDD §1 e §15.1). Nada de coleta manual repetitiva.
- Planejar offline deve funcionar: nenhum resultado pode depender de deixar a aba aberta; limite e expiração têm explicação antes de acontecer.
- O resultado ruim deve ensinar uma próxima ação. Medir se fome, frio e abandono juntos deixam algum caminho de recuperação; uma proteção nova exige decisão 19, não uma regra escondida no código.
- Não exigir que alguém acorde para responder uma carta. A cadência do Conselho precisa ser avaliada no ritmo 3× com 1–2 visitas por dia, incluindo o comportamento automático.
- Mostrar conteúdo novo gradualmente pelos pré-requisitos e objetivos. Não apresentar botões de heróis, mercado ou combate que a v0.2 não entrega.
- Combinar a observação humana com o simulador: testes provam consistência; as pessoas dizem se a escolha foi interessante e compreensível.

### 0.7 Entregas jogáveis e dependências

| Marco | Entrada | Demonstração para o autor | Condição para avançar |
|---|---|---|---|
| A — Entender o MVP | v0.1 fechada | Relatos, problemas e comparação do bot em 1×/3× | V2A-T1 e V2A-T2; ausência de amostra não pode virar playtest “aprovado” |
| B — Preservar o reino | Decisões 2–5 | Partida antiga carregada; partida nova com ritmo escolhido; replay reproduzível | Migração e reversão ensaiadas, contratos antigos protegidos |
| C — Economia sazonal | Fundação B revisada | Preparar uma ausência, atravessar uma estação e ver o resultado | Armazenamento e melhorias alcançáveis; automação funciona; recuperação possível |
| D — Conselho | Economia C revisada | Ler, escolher e acompanhar uma cadeia de três cartas | Sem opção sempre superior, expiração explicada, conteúdo elegível suficiente |
| E — Preparação e ameaça | Conselho D revisado | Comparar feudos com e sem defesa durante a mesma incursão | Aviso utilizável, perdas explicadas, objetivos possíveis |
| F — Versão completa | C, D e E integradas | Um ano de jogo e a virada seguinte; sessões e ausências reais | Critérios, playtest, documentação e publicação autorizada |

A sequência A → B → C → D → E → F continua sendo o padrão. Dentro de C, executar **C1 → C2 → C5 → C3 → C4 → C6**: entregar planejamento automático junto da pressão dos estoques antes da avaliação integrada evita testar apenas penalidades. Essa é uma ordem de desenvolvimento, não autorização para publicar C2 sozinho.

Cada fase produz uma versão para experimentar; não depende de publicar no `main`. Enquanto o playtest corre, leitura, desenhos de tela, escrita de cartas e decisões podem avançar sem mudar a versão observada nem marcar tarefas posteriores como concluídas. Alterar a ordem entre fases exige registrar o motivo com o autor.

**Exemplo de sessão de validação de C:** escolher uma obra automática, conferir reservas e produção, sair, avançar o relógio de teste através de uma estação e voltar. O autor deve conseguir explicar quais obras terminaram, o que foi desperdiçado e qual decisão pretende tomar a seguir.

### 0.8 Contratos transversais de implementação

Estas exigências detalham a arquitetura já existente; decisões de **regra** ainda abertas permanecem na §10.

| Contrato | Aplicação obrigatória |
|---|---|
| Relógios explícitos | Cada constante de prazo declara se é tempo de jogo ou real. O motor recebe tempo de jogo; o servidor converte. Se uma janela for fixada em horas reais, converter na criação usando o ritmo imutável da partida e persistir o prazo de jogo. A interface recebe prazos reais do `ViewState`; não inventa conversões. |
| Fronteira da atualização | V2B-T1 define o instante de adoção de regras novas. Não recalcular silenciosamente toda a ausência anterior com frio, caps e lobos que não existiam quando o jogador saiu. Qualquer efeito retroativo precisa ser decidido e comunicado. |
| Eventos no mesmo instante | Manter uma tabela de precedência no motor: fim de obra, população, calendário, efeitos temporários, decisões automáticas, incursões, objetivos e estabilização. A ordem final deve ser documentada e testada; não usar a ordem de importação dos módulos. |
| Simulação que termina | Eventos consumidos não reaparecem no mesmo instante; encadeamentos têm limite derivado do conteúdo finito. Verificar ausência de laços em falta de lenha, cap, mudança de moral e início automático. |
| Consistência numérica | Frações e milésimos inteiros, sem tolerância no teste de divisão de intervalo. O estado **e a sequência de eventos** devem coincidir, incluindo restos de produção e contadores de perdas. |
| Reenvio de comando | Responder uma carta, planejar uma obra e toda ordem nova passam pelo recibo transacional existente. Duplo clique, duas abas e resposta atrasada não podem pagar ou recompensar duas vezes. |
| Visão e privacidade narrativa | Regras, limites, elegibilidade e projeções vêm do servidor/motor. Não enviar efeitos ocultos, flags secretas ou conteúdo ainda não revelado para o navegador. O nome de uma flag não é texto de interface. |
| Compatibilidade | Definir tratamento de cache, cliente antigo, recibos históricos e protocolo antes da primeira alteração incompatível. Nunca reescrever recibos antigos para parecerem respostas novas; preservar seu status/corpo e a regra de idempotência. |
| Relatório confiável | Variação de estoque não equivale a produção: desconta gastos e perdas. Contabilizar desperdício, chegada/partida de aldeões e efeitos do Conselho por eventos ou totais autoritativos; manter cursores e paginação, sem duplicar na reconexão. |
| Conteúdo como dados | IDs estáveis, schemas, condições, efeitos, textos de recusa e Crônica em `content`; dados balanceáveis fora da UI e do servidor. O cliente só apresenta consequências que já estão calculadas. |
| Descoberta gradual | Todo desbloqueio tem um motivo visível e uma tarefa que o torna utilizável. Estado vazio, bloqueado, indisponível e erro têm mensagens diferentes. |
| Escopo de gravação | Uma alteração documental não cria migrações, configura ambientes ou implanta versões. A execução futura usa somente as ações autorizadas para a tarefa. |

### 0.9 Comandos e evidências comuns

Toda tarefa abaixo herda esta verificação, além dos seus cenários específicos:

```bash
pnpm verify
# Se tocar servidor, persistência ou contrato HTTP; primeiro preparar db_test:
pnpm dev:up
TEST_DATABASE_URL=postgres://lotg:lotg@localhost:5433/lotg_test pnpm test:integration
# Se tocar fluxos do app; rodar depois da integração, nunca ao mesmo tempo:
pnpm test:e2e
# Se alterar a página de apresentação ou suas capturas:
pnpm test:e2e:landing
```

As suites que usam o banco podem apagar dados de teste; usar apenas `db_test`, nunca a URL de produção. Sem `TEST_DATABASE_URL`, uma suíte vazia não prova integração. Não é necessário rodar navegador para uma mudança exclusivamente documental: conferir links, IDs, dependências e coerência com o GDD.

Cada tarefa registra: commit, decisão aplicada, comandos realmente executados, resultado, cenário jogado pelo autor e limitações. Caminhos marcados **“novo”** são entregáveis futuros; os demais são pontos de partida existentes, a conferir ao abrir a tarefa. As subtarefas listam comportamento a provar, não obrigam uma API interna específica.


---

## 1. Fase A — Playtest e correções

**Meta da fase:** pessoas que não são o autor jogam a v0.1 por dois dias, o resultado fica escrito, e o que atrapalha é corrigido antes de qualquer mecânica nova.

Por que primeiro: o [MVP-ROADMAP.md](../MVP-ROADMAP.md) previa este playtest em F5-T2, antes da release. Por decisão do autor, a v0.1 fechou com o playtest do próprio autor, e o playtest com outras pessoas passou a ser a primeira tarefa da v0.2 (divergência registrada em [acceptance-v0.1.md](acceptance-v0.1.md)). Ninguém além do autor jogou ainda: o "Pronto quando" de F4-T3 (alguém de fora jogar) também não foi verificado.

### V2A-T1 · Playtest de 48 horas com 3 a 5 pessoas `M`

**Objetivo:** saber o que confunde, o que falta e se as pessoas voltam, com respostas escritas e números do banco.
**GDD:** §15.1 (regras de diversão), §15.5 (métricas agregadas, sem nome de jogador), §14.14 (o que se guarda da conta).
**Depende de:** v0.1.0 em produção.
**Entregáveis:** `docs/playtest/relatorio-v0.1.md`, preenchido a partir de [playtest/relatorio-modelo.md](playtest/relatorio-modelo.md); se preciso, ajuste em `deploy/analytics/ops.sql` (V2A-T1.2).

Quem faz o quê: **o autor** convida, entrega o endereço, recolhe as respostas e roda as consultas no Coolify (o agente não tem acesso ao `psql` de produção). **O agente** prepara as consultas, consolida o que o autor colar e classifica os achados com ele.

**Antes de convidar**

- [ ] V2A-T1.1 Conferir a produção no dia: `curl -s https://lords.palsincomehub.com/v1/health` responde `{"status":"ok","db":"ok"}` e `curl -s https://lords.palsincomehub.com/v1/version` traz o `builtAt` do último deploy. Anotar os dois no relatório. **Congelar o `main` durante as 48 horas**: desde o commit `223bdad`, todo push no `main` com a CI verde é implantado sozinho, e um deploy no meio do playtest muda o que as pessoas estão jogando.
- [ ] V2A-T1.2 Ensaiar as consultas de playtest de [`deploy/analytics/ops.sql`](../deploy/analytics/ops.sql). Elas foram escritas a partir do esquema e **nunca foram executadas em produção** (Registro da v0.1, F4-T4). O agente roda as quatro contra o banco de desenvolvimento (comando na "Verificação"), depois de uma partida curta, e corrige o que falhar. Duas limitações conhecidas, a tratar aqui:
  - as consultas **não têm filtro de período**: contam todas as contas que não se chamam "Bot …", inclusive as do autor e as de testes antigos. Para o playtest, acrescentar à CTE `jogadores` de cada consulta a janela de criação das contas, por exemplo `and created_at >= timestamptz '2026-10-05 00:00 America/Sao_Paulo' and created_at < timestamptz '2026-10-07 00:00 America/Sao_Paulo'` (as datas são as do playtest), e descomentar a linha que tira a conta do autor;
  - leituras não deixam rastro: "voltar" é dar ao menos um comando. Quem voltou só para olhar não aparece. As proporções são um piso.
- [ ] V2A-T1.3 Decidir (autor) se os dois itens de operação que ainda dependem dele são feitos antes de haver dados de outras pessoas no banco: cópia de `RECOVERY_CODE_SECRET` fora do Coolify e destino externo para os backups, hoje no mesmo disco do banco ([architecture.md §6.3](architecture.md)). Não bloqueiam o playtest; sem eles, perder o servidor perde os feudos dos convidados.
- [ ] V2A-T1.4 (Atenção: o servidor aceita 10 contas novas por hora por IP; convidados na mesma rede, como um escritório, podem bater nesse limite.) Escolher (autor) 3 a 5 pessoas, e a data e a hora de início e de fim. Preferir quem trabalha no computador, que é o público do jogo (GDD §1).

**O que entregar às pessoas**

- [ ] V2A-T1.5 Uma mensagem com:
  - o endereço do jogo, `https://lords.palsincomehub.com`, e a instrução inteira: abrir, clicar em **Jogar agora**, jogar quando quiser por dois dias. Sem explicar regras: descobrir se o jogo se explica é parte do teste;
  - o pedido de usar o **computador**. Navegadores de celular nunca foram conferidos (Registro da v0.1, F3W-T10), e Firefox e Safari não têm evidência registrada; pedir que digam qual navegador usaram;
  - o que fica guardado: conta anônima, nome de exibição escolhido pela pessoa, as ordens dadas no jogo e as datas de acesso, sem e-mail nem senha, e a conta pode ser excluída pelo próprio app (GDD §14.14; seção "Privacidade" do [README](../README.md));
  - o aviso de que é uma versão de teste e o feudo pode ser apagado;
  - a dica de gerar o **Código do Reino** se a pessoa for trocar de navegador ou de máquina;
  - quando chega o formulário (ao fim das 48 horas) e para quem mandar problemas no meio do caminho.
- [ ] V2A-T1.6 A página de apresentação ([ADR 0012](decisions/0012-pagina-de-apresentacao.md)) só entra na mensagem se o autor já tiver confirmado o endereço e o texto dela (ponto 1 do ADR). Se entrar, anotar no relatório: muda o que se mede no "primeiro contato".

**Durante as 48 horas**

- [ ] V2A-T1.7 Manter versão e operação estáveis, sem deploy ou reinício deliberado. Um incidente real exige correção e registro do período afetado; combinar uma nova janela comparável, sem esconder a interrupção. Anotar com data e hora o que as pessoas relatarem no meio do caminho e qualquer queda (o workflow `health.yml` avisa por e-mail; a chegada desse e-mail ao autor ainda não foi conferida).

**Depois**

- [ ] V2A-T1.8 Mandar o formulário: [playtest/formulario.md](playtest/formulario.md), colado em um formulário online ou na própria mensagem. Apelido opcional; nenhum outro dado pessoal.
- [ ] V2A-T1.9 Rodar as consultas (autor). No Coolify: projeto "Lords of the Guild" → recurso `lotg-db` → aba "Terminal" → `psql -U lotg lotg` → colar uma consulta por vez ([deploy/README.md](../deploy/README.md), seção "Operação"). São quatro, do bloco "Métricas do playtest" de `ops.sql`, com o filtro de período de V2A-T1.2: **sessões por dia**, **comandos por sessão** (com a duração), **tempo até o primeiro comando** e **retorno no dia 2**. Mais duas do começo do arquivo, para contexto: "Contas: total…" (quantos geraram Código do Reino) e "Comandos por tipo e resultado" (o que as pessoas tentaram e o que o jogo recusou). Colar as saídas no relatório, como vieram.
  - A consulta de retorno só inclui um dia de criação depois que **o dia seguinte terminou** no calendário de São Paulo. Para contas criadas no primeiro dia do playtest, ela só responde a partir do terceiro dia. Rodar cedo demais dá uma tabela vazia, e não "ninguém voltou".
  - Rodar antes de sete dias do fim: uma conta que a pessoa excluir some das métricas quando o expurgo passar.
- [ ] V2A-T1.10 Consolidar (agente, com o que o autor colar): preencher o modelo do relatório, uma linha por achado, com a origem (formulário, mensagem, consulta) e a classificação:

  | Classe | Significado | Destino |
  |---|---|---|
  | **P0** | Bloqueia: a pessoa não conseguiu jogar, perdeu o feudo, ou o jogo mostrou algo errado sobre o estado | V2A-T2, antes de tudo |
  | **P1** | Atrapalha: a pessoa jogou, mas travou, entendeu errado ou desistiu por causa disso | V2A-T2 |
  | **P2** | Melhoria: seria melhor, mas ninguém parou por isso | Lista do relatório; entra em uma tarefa da v0.2 se couber |
  | **P3** | É de outra versão: pede mecânica que o GDD põe na v0.2 ou depois | Anotado na tarefa correspondente deste roadmap, ou no GDD §17.3 |

  A classificação é proposta pelo agente e **decidida pelo autor**. Um pedido de mecânica não vira P0 nem P1.
- [ ] V2A-T1.11 Registrar no relatório as decisões que saíram dele e o que **não** foi medido (por exemplo: quantas pessoas responderam, se alguém jogou no celular, se a conta do autor ficou de fora).
- [ ] V2A-T1.12 Tratar as verificações de operação separadamente do playtest: ensaiar reinício da API com obra e aba aberta **antes ou depois** da janela congelada, em conta de teste e com autorização de operação; verificar o alerta sem provocar queda durante a observação. Registrar em [acceptance-v0.1.md](acceptance-v0.1.md). Ausência real e fome podem ser observadas em conta própria, sem induzir perdas nos convidados. Conferir o expurgo somente após o prazo de sete dias de cada conta (as do fechamento, a partir de 2026-10-08); não adiar a conclusão das 48 h só por essa data. O que não puder ser conferido continua como pendência com responsável.
- [ ] V2A-T1.13 Registrar uma linha de base de diversão: uma decisão que cada participante lembra, o que esperava ao voltar e o que o fez sair. Guardar contagens e relatos anônimos, não uma alegação de retenção estatisticamente comprovada com 3–5 pessoas.

**Verificação:**

```bash
pnpm dev:up
# V2A-T1.2: as consultas rodam sem erro no banco de dev. O psql roda dentro do contêiner e não
# enxerga o arquivo: ele entra pela entrada padrão (por isso o -T).
docker compose -f deploy/docker-compose.dev.yml exec -T db psql -U lotg -d lotg -v ON_ERROR_STOP=1 < deploy/analytics/ops.sql
```

Esperado: nenhuma consulta falha. Este comando não foi executado ao escrever o roadmap; conferir na primeira sessão. As saídas de produção ficam coladas no relatório, com data e hora.

**Pronto quando:** `docs/playtest/relatorio-v0.1.md` existe, com as respostas de pelo menos 3 pessoas, as saídas das quatro consultas, **ao menos uma métrica de retorno no dia 2**, todos os achados classificados de P0 a P3 e as decisões do autor anotadas. Se menos de 3 pessoas responderem, a tarefa não está pronta: o autor decide entre convidar mais gente e registrar a amostra menor como divergência.

**Prompt sugerido:** "Leia CLAUDE.md, docs/roadmap-v0.2.md V2A-T1, deploy/analytics/ops.sql e docs/playtest/. Ensaie as quatro consultas de playtest no banco de desenvolvimento, acrescente o filtro de período e me diga o que mudou. Depois me entregue a mensagem para os convidados e espere eu colar as respostas do formulário e as saídas das consultas para montar docs/playtest/relatorio-v0.1.md."

### V2A-T2 · Correções dos P0 e P1 e a pergunta de balanceamento do ritmo 3× `M`

**Objetivo:** fechar o que o playtest achou de grave, e levar ao autor, com números, a pergunta que o simulador levantou no ritmo 3×.
**GDD:** §5.5, §6.3, §15.1 (itens 1 e 2), §15.2, §17.2.
**Depende de:** V2A-T1.
**Entregáveis:** commits de correção, cada um com teste de regressão; `docs/playtest/relatorio-v0.1.md` atualizado com o destino de cada achado; a resposta do autor à pergunta abaixo, registrada (ADR se mudar regra).

- [ ] V2A-T2.1 Cada P0 e cada P1 corrigido com teste de regressão e commit próprio (`V2A-T2: …`). Um P0 ou P1 cuja correção seja uma mecânica nova não é corrigido aqui: volta ao autor para reclassificar.
- [ ] V2A-T2.2 Repetir a medição do simulador e colar a saída no relatório. Em 2026-10-01, com a semente `pedra-alta-golden`, o bot econômico e 2 sessões por dia em 7 dias reais:

  | Ritmo | População | Salão | Comandos aceitos | Madeira parada | Pedra parada | Ouro parado |
  |---|---|---|---:|---:|---:|---:|
  | 1× | 26 de 35 | Nv3 | 55 | 10.017 | 4.190 | 1.637 |
  | 3× | 35 de 35 | Nv3 | 47 | 40.872 | 16.118 | 6.626 |

  Neste cenário medido, no ritmo 3× o mundo avança três vezes mais entre duas visitas, mas o feudo termina **nos mesmos níveis de edifício**: com uma fila de obra só, cada visita inicia uma obra, e o progresso fica limitado pelo número de visitas, e não pelos recursos. O excedente se acumula sem uso. É o bot, e não uma pessoa: o playtest diz se jogadores reais sentem o mesmo.

  ```bash
  pnpm -s sim -- --seed pedra-alta-golden --days 7 --sessions-per-day 2 --time-scale 1 > /dev/null
  pnpm -s sim -- --seed pedra-alta-golden --days 7 --sessions-per-day 2 --time-scale 3 > /dev/null
  ```

- [ ] V2A-T2.3 Levar a pergunta ao autor, com o que o GDD já prevê. **A resposta é de regra de jogo e é do autor; o agente não ajusta números por conta própria.** O que a v0.2 do GDD já traz para este problema:
  - **caps de armazenamento** (§5.2 e §5.5): 500 para comida, madeira e pedra antes do Celeiro e do Armazém, com o fator de dificuldade; o excedente é perdido e aparece no Relatório. Limita o acúmulo, e a §15.2 dá a meta "nenhum recurso acima do cap por mais de 8 h para o perfil Regular". Como o estoque é limitado, essa frase precisa medir **tempo desperdiçando produção**, não estoque acima do limite (decisão 17, §10). Ouro não tem cap (§5.1);
  - **segunda fila de obras** no Salão Nv4 e planejadas marcadas como **"iniciar quando houver recursos"** (§6.3): tiram o progresso da dependência de uma visita por obra;
  - **escolha de ritmo** na criação (§4.2), hoje fixado pelo servidor ([ADR 0011](decisions/0011-ritmo-3x-no-mvp.md));
  - a questão em aberto do GDD §17.2: **mercado e caravanas já na v0.2**, para dar saída ao excedente antes do cap.

  As perguntas: (a) alguma dessas entra **antes** das mecânicas novas, como correção, ou todas esperam a sua tarefa (V2C-T2 e V2C-T5)? (b) no ritmo 3×, o Salão Nv4 chega tarde demais para a segunda fila ajudar (o bot termina a semana no Nv3)? (c) as faixas de balanceamento do simulador, que só existem no ritmo 1, passam a existir no ritmo em que as pessoas jogam (V2B-T4)?
- [ ] V2A-T2.4 Se o autor mudar um número: alterar `@lotg/content`, regravar os goldens com `UPDATE_GOLDEN=1`, conferir o diff e atualizar o GDD no mesmo commit.
- [ ] V2A-T2.5 `pnpm verify`, `pnpm test:integration` e `pnpm test:e2e` verdes; apresentar a correção ao autor. Publicar somente quando autorizado, fora da janela congelada, e conferir `/v1/version` depois.

**Verificação:**

```bash
pnpm verify
TEST_DATABASE_URL=postgres://lotg:lotg@localhost:5433/lotg_test pnpm test:integration
pnpm test:e2e
```

**Pronto quando:** zero P0 e P1 abertos no relatório, cada correção com teste, e a pergunta de balanceamento com resposta escrita do autor (mesmo que a resposta seja "espera a tarefa da mecânica").

**Prompt sugerido:** "Leia CLAUDE.md, docs/playtest/relatorio-v0.1.md e docs/roadmap-v0.2.md V2A-T2. Corrija os P0 e P1 um por vez, cada um com teste de regressão e commit próprio. Depois rode o simulador nos ritmos 1 e 3, me mostre os números e me faça as perguntas de V2A-T2.3; não mude nenhum número de jogo sem a minha resposta."

---

## 2. Fase B — Fundação técnica antes das mecânicas

**Meta da fase:** o que a v0.2 precisa ter no lugar antes de mudar o estado do jogo. Cada tarefa diz por que não pode esperar. Nenhuma delas acrescenta mecânica.

### V2B-T1 · Migração de `GameState` por `schemaVersion` `M`

**Objetivo:** um estado gravado na versão 1 carrega e joga na versão 2, e o servidor sabe o que fazer com um estado de versão que não conhece.
**Por que antes:** toda mecânica da v0.2 acrescenta campos ao estado (moral, experiência do ofício, Conselho, tiles). Hoje não existe código de migração: `GameState.schemaVersion` é o tipo literal `1` (`packages/engine/src/types.ts`), o servidor lê `games.state` do banco sem validar nem migrar (`packages/server/src/db/schema.ts`), e há partidas em produção. O GDD §15.4 pede o teste: "estados com `schemaVersion` antigo carregam e migram no servidor".
**GDD:** §14.6, §14.11, §15.4.
**Depende de:** V2A-T2.
**Entregáveis:** função pura de migração no motor (o estado é dele) chamada pelo servidor ao carregar; golden de um estado v1 real; teste de integração; documentação no README do motor e do servidor.
**Perguntas que a tarefa precisa responder antes de codar:** as partidas da v0.1 **migram** ou são **arquivadas** (§10, item 4)? Onde a migração roda: ao travar a partida (preguiçosa) ou em lote no arranque? E a **reversão**: a regra do projeto é migração compatível com a versão anterior (expandir, depois contrair), mas um estado já migrado para a versão 2 não é legível pela API da v0.1; a reversão atravessando uma migração nunca foi ensaiada (Registro da v0.1, F4-T5).
**Verificação:** teste de unidade da migração (v1 → v2, idempotente); teste de integração com uma partida gravada pela v0.1; a propriedade de divisão de intervalo continua exata em um estado migrado.
**Pronto quando:** uma cópia do estado de uma partida real da v0.1 carrega, avança e aceita comandos no código novo, e há um procedimento escrito para reverter um deploy que migrou estados.

**Arquivos e entregáveis:** `packages/engine/src/types.ts`, `state.ts` e **novo** `migrations.ts`; `packages/server/src/games/repository.ts`, `jobs/advanceStaleGames.ts`, `db/schema.ts`; `packages/protocol/src/api.ts`; testes de integração e documentação de reversão.

**Subtarefas de execução:**

- [ ] V2B-T1.1 Registrar decisões 3 e 4; inventariar versões de estado, conteúdo, protocolo e recibos. Definir leitura de cliente antigo e tratamento de versão futura desconhecida sem gravar por cima.
- [ ] V2B-T1.2 Criar fixtures sanitizadas de v0.1 com obra, recrutamento, fome, objetivos concluídos e estoque alto. Validar a forma do JSON antes da migração; falha preserva os dados originais.
- [ ] V2B-T1.3 Implementar migração pura, sequencial e idempotente; persistir versão e estado atomicamente sob o lock da partida, inclusive no job. Se a migração ampliar a API pública do motor, atualizar seu contrato e o teste de pureza no mesmo passo. Aplicar campos novos apenas quando sua mecânica entrar; não criar heróis, mercado ou mapas gráficos.
- [ ] V2B-T1.4 Definir a fronteira temporal das regras (§0.8) e o destino de estoques acima do cap; preservar progresso, ritmo, filas, IDs de comandos, eventos e credenciais conforme a decisão. Testar duas leituras concorrentes da mesma partida antiga.
- [ ] V2B-T1.5 Ensaiar compatibilidade API nova/app antigo, replay de recibo antigo, cache antigo e recuperação de falha no meio da migração. Reversão de imagem só é suficiente se o estado continuar legível; documentar alternativa e eventual janela de perda de dados.
- [ ] V2B-T1.6 Gerar evidência de migração e reversão em banco descartável. Não copiar credenciais de produção para fixture nem executar migração de produção nesta validação.


### V2B-T2 · Gerador de números aleatórios com semente e fluxos nomeados `M`

**Objetivo:** sorteios determinísticos e reproduzíveis no motor.
**Por que antes:** a v0.2 é a primeira versão que sorteia (cartas do Conselho, chances diárias da moral, incursões por Ameaça). O GDD §18.1 item 3 pedia o gerador desde a v0.1; ele não existe: o estado tem o campo `rng`, vazio, e nenhuma regra sorteia (Registro da v0.1, F1-T11; [README do motor](../packages/engine/README.md)).
**GDD:** §14.3, §14.11 (`rng: Record<string, number[]>`), §18.1 item 3.
**Depende de:** V2B-T1 (o estado do gerador passa a ser usado; se o formato mudar, é migração).
**Entregáveis:** módulo do gerador no motor, inteiro e sem `Math.random()`; um fluxo por nome (`council`, e os que as mecânicas pedirem), para que sortear em um não desloque o outro; testes.
**Verificação:** a mesma semente dá a mesma sequência; a propriedade de divisão de intervalo vale **com sorteios no caminho** (`advanceTo(t2)` ≡ `advanceTo(t1)` + `advanceTo(t2)`, estado e eventos); `purity.test.ts` continua verde.
**Pronto quando:** vetores de RNG, independência de fluxos, persistência e agendamento sintético passam; a integração com `advanceTo` é retomada e provada com os primeiros eventos reais em V2C-T4/V2D-T1, sem mecanismo fictício na API pública.

**Arquivos e entregáveis:** **Novo** `packages/engine/src/random.ts`, `types.ts`, `state.ts`; testes de propriedade e `purity.test.ts`.

**Subtarefas de execução:**

- [ ] V2B-T2.1 Definir algoritmo inteiro e versionado, derivação de semente por nome de fluxo e serialização do estado; registrar vetores conhecidos de saída.
- [ ] V2B-T2.2 Implementar sorteio inteiro/ponderado com validação de pesos e escolha estável; pesos zero, conjunto vazio e todos os pesos zero têm desfecho explícito.
- [ ] V2B-T2.3 Provar que consumir o fluxo `council` não altera o fluxo da moral ou de ameaças e que salvar/recarregar continua a mesma sequência.
- [ ] V2B-T2.4 Provar ausência de mutação e de sorteio extra ao derivar uma visão do mesmo estado/instante, recusar uma ação ou devolver um recibo. O avanço legítimo do mundo antes de uma leitura ou recusa pode processar sorteios agendados; isso deve coincidir com avançar o mesmo intervalo sem a requisição. Polling não pode rerrolar resultados.
- [ ] V2B-T2.5 Testar um cenário sintético de eventos com cortes diferentes sem introduzir regra fictícia na API pública. Repetir a propriedade em `advanceTo` com eventos reais quando C4, D1 e E3 entrarem.


### V2B-T3 · Ritmo e dificuldade escolhidos na criação da partida `M`

**Objetivo:** o jogador escolhe ritmo e dificuldade ao criar a partida; os dois ficam gravados e não mudam durante o ano.
**Por que antes:** é critério da §16.2, e a dificuldade é parâmetro de três mecânicas (cap de armazenamento, abandono por fome, opção padrão das cartas): elas precisam lê-la de algum lugar. Hoje a dificuldade é a constante `lord` e o ritmo vem de `GAME_TIME_SCALE` (`packages/server/src/games/service.ts`); `CreateGameRequestSchema` só aceita `difficulty: 'lord'` e `timeScale: 1`, e ignora o segundo (`packages/protocol/src/api.ts`; dívida do [ADR 0011](decisions/0011-ritmo-3x-no-mvp.md)).
**GDD:** §4.2, §12.1, §13.9, §14.5, §16.2.
**Depende de:** V2B-T1; decisão do autor sobre quais ritmos existem (§10, item 2).
**Entregáveis:** protocolo, criação da partida no servidor, escolha nas boas-vindas e em "Nova partida", dificuldade no estado, textos em `content`.
**Atenção:** nesta tarefa a dificuldade é só gravada e exibida; cada efeito entra na tarefa da sua mecânica. O app não pode mostrar uma escolha que ainda não muda nada sem dizer isso (ver §10, item 3, sobre o que chega à produção no meio da v0.2).
**Verificação:** integração (criar com cada combinação; valor inválido recusado com 400; partida antiga intacta); teste em navegador das boas-vindas; "do clique ao primeiro comando em menos de 30 s" (critério 1 da v0.1) continua valendo com as duas escolhas na tela.
**Pronto quando:** duas partidas criadas com ritmos diferentes mostram prazos diferentes em tempo real, e a dificuldade aparece no `ViewState`.

**Arquivos e entregáveis:** `packages/content/src/balance.ts`, `schemas.ts`; `packages/engine/src/types.ts`, `view.ts`; `packages/protocol/src/api.ts`, `view.ts`; `packages/server/src/games/service.ts`; `packages/web/src/components/Welcome.tsx`, `palette/commands.ts` e diálogos.

**Subtarefas de execução:**

- [ ] V2B-T3.1 Fechar decisões 1 e 2: ritmos ofertados, padrão e unidades de duração; separar os efeitos de dificuldade disponíveis agora dos de versões futuras.
- [ ] V2B-T3.2 Criar configuração validada, persistida e imutável durante o ano; manter ritmo das partidas antigas, inclusive as de 3×. Definir compatibilidade do corpo antigo de criação.
- [ ] V2B-T3.3 Exibir uma opção recomendada e as alternativas sem atrasar o primeiro comando; informar efeitos concretos de ritmo/dificuldade, sem prometer morte de herói ou cerco na v0.2.
- [ ] V2B-T3.4 Conferir consumo, produção, tempo de obra, adaptação, avisos e expiração no `ViewState` de cada ritmo permitido; o cliente não calcula regras.
- [ ] V2B-T3.5 Testar criação e nova partida, valores inválidos, tentativa de alterar ritmo depois e acesso em outro navegador. Esconder efeitos ainda não disponíveis na versão entregue.


### V2B-T4 · Simulador no ritmo em que se joga `M`

**Objetivo:** faixas de balanceamento que falhem na CI no ritmo que os jogadores usam, e um bot que jogue as mecânicas da v0.2 conforme elas entram.
**Por que antes:** as faixas do `sim-cli` só existem no ritmo 1 (`packages/sim-cli/src/balance.test.ts`; "no ritmo 3 não há faixa definida", README do simulador), e a produção joga no ritmo 3. Foi o simulador que mostrou o problema de V2A-T2.2, mas nenhum teste o acusa. O GDD §15.3 pede um teste de CI com 50 sementes por perfil; hoje há uma semente.
**GDD:** §15.2, §15.3.
**Depende de:** V2A-T2 (a resposta do autor define a faixa), V2B-T3.
**Verificação:** `pnpm --filter @lotg/sim-cli test`.
**Pronto quando:** existe uma faixa aprovada pelo autor para cada ritmo oferecido, e o teste falha se o excedente parado passar do limite que o autor definir.

**Arquivos e entregáveis:** `packages/sim-cli/src/simulate.ts`, `report.ts`, `bots/`, `balance.test.ts`; `tests/e2e/server.ts`, cenários E2E e **novo** `docs/balance-v0.2.md`.

**Subtarefas de execução:**

- [ ] V2B-T4.1 Definir perfis por decisões e visitas: 1, 2 e 4 sessões por dia real, usando a mesma lista fixa de 50 sementes por perfil. Não confundir quantidade de sementes com variedade enquanto nenhum evento ainda sorteia.
- [ ] V2B-T4.2 Comparar uma duração real fixa e um ano completo de jogo em tabelas separadas; no ritmo 3×, sete dias reais atravessam três anos. Identificar ritmo, dificuldade, conteúdo e versão em todo relatório.
- [ ] V2B-T4.3 Registrar população, fome, progresso, comandos recusados e tempo de fila ociosa; habilitar perdas por cap, adaptação e Conselho conforme essas mecânicas existirem.
- [ ] V2B-T4.4 Registrar valores medidos e faixas aprovadas, com unidade e perfil, em `docs/balance-v0.2.md`. A meta de população 30–40 do GDD vale para Regular/Normal/Senhor; não reutilizar automaticamente em todas as combinações.
- [ ] V2B-T4.5 Adicionar cenário E2E no ritmo usado em produção, parametrizando o harness em vez de trocar globalmente o ritmo dos testes existentes.
- [ ] V2B-T4.6 Evoluir o bot com cada mecânica de C–E usando somente `ViewState`, sem ler flags secretas ou o RNG; congelar estratégias durante uma comparação de balanceamento.


### V2B-T5 · Revisão independente da fundação `S`

**Objetivo:** uma revisão de leitura, por um agente que não escreveu o código, de V2B-T1 a V2B-T4, antes de as mecânicas se apoiarem nelas.
**Por que antes:** na v0.1, toda revisão independente achou defeitos reais (§8, lição 3). Migração e sorteio são os dois lugares em que um erro corrompe partidas de verdade.
**Depende de:** V2B-T1 a V2B-T4.
**Pronto quando:** cada defeito confirmado tem teste e correção, e o que ficou sem correção está escrito no Registro com o motivo.

**Arquivos e entregáveis:** Código e testes de V2B-T1 a V2B-T4; relatório da revisão ligado no Registro de Execução.

**Subtarefas de execução:**

- [ ] V2B-T5.1 Revisor independente confere diffs e decisões contra as fixtures de v0.1, sem aceitar teste verde como prova de preservação dos dados.
- [ ] V2B-T5.2 Tentar migração concorrente, estado desconhecido, falha transacional, recibo antigo, cliente antigo e sorteios após recarregar.
- [ ] V2B-T5.3 Confirmar que a matriz de ritmos é exercitada e que o bot não conhece informações escondidas do jogador.
- [ ] V2B-T5.4 Classificar cada achado, corrigir defeitos confirmados com regressão e registrar os cenários que não foram executados.


---

## 3. Fase C — O mundo muda: economia da v0.2

**Meta da fase:** estações, armazenamento, ofício, moral e a segunda fila, todos no motor, com interface e teste. Critérios 1 e 5 da §16.2.

Cada tarefa segue a regra da §0.4.

### V2C-T1 · Estações com efeito `M`

**Objetivo:** os multiplicadores de produção por estação, o recrutamento mais rápido na primavera, e o inverno: lenha, obras mais lentas e a penalidade de produção sem lenha.
**GDD:** §2.1, §4.1, §5.3.
**Depende de:** V2B-T1, V2B-T3; decisão 13.
**Fica para outra tarefa ou versão:** "moral −20" do frio entra com a moral (V2C-T4); expedições, presságios, preço da comida e cerco são de outras versões.
**Perguntas para o autor:** a tabela da §4.1 dá "lenha: 0,5 madeira por habitante/h" e, sem lenha, "produção ×0,8"; a falta de lenha é um evento com instante exato, como a fome (§5.6)? "Obras 50% mais lentas" vale para uma obra que atravessa a virada da estação, ou só para as iniciadas no inverno?
**Verificação:** unidade por estação; propriedade de divisão de intervalo atravessando viradas de estação; golden regravado de propósito.
**Pronto quando:** o `ViewState` explica cada taxa com o fator da estação, a virada de estação muda as taxas no instante exato, e a Crônica registra a falta de lenha.

**Arquivos e entregáveis:** `packages/content/src/balance.ts`, `chronicle.ts`; `packages/engine/src/economy.ts`, `timeline.ts`, `advance.ts`, `construction.ts`, `population.ts`, `view.ts`; painéis do app.

**Subtarefas de execução:**

- [ ] V2C-T1.1 Fechar decisão 13 sobre lenha e duração de obras/recrutamento ao atravessar estação; representar fatores como frações.
- [ ] V2C-T1.2 Implementar efeitos da estação sobre taxas e duração, com mudança no instante correto, incluindo obra/recrutamento já em curso conforme a decisão.
- [ ] V2C-T1.3 Tratar falta e retomada de lenha como transições determinísticas; conservar milésimos e resolver comida/lenha acabando juntas sem oscilação no mesmo instante.
- [ ] V2C-T1.4 Mostrar estação, mudança de taxas, consumo de lenha e prazos no `ViewState`; diferenciar o aviso de frio do aviso de fome.
- [ ] V2C-T1.5 Testar fronteiras antes/no/depois da virada, inverno inteiro, salto de vários anos e um ritmo diferente de 1; jogar o caminho de preparação e o de recuperação.


### V2C-T2 · Armazenamento: Celeiro, Armazém e caps `M`

**Objetivo:** o estoque para no cap, o excedente é perdido e contado, e o painel diz "cheio em".
**GDD:** §5.1, §5.2 (cap inicial de 500), §5.5, §6.1, §6.2, §12.1 (cap por dificuldade), §12.2 (objetivo 4), §15.2, §16.2.
**Depende de:** V2B-T1, V2B-T3.
**Inclui:** o objetivo 4 volta a recompensar com o desbloqueio de Celeiro, Armazém e Torre de Vigia, como diz o [ADR 0002](decisions/0002-objetivo-4-v01.md) (a Torre só é construível depois de V2E-T1).
**Perguntas para o autor:** o que acontece com o estoque acima do cap em uma partida migrada da v0.1 (o simulador termina a semana com dezenas de milhares de madeira)? Recompensas de objetivo e devolução de cancelamento respeitam o cap? O Armazém da v0.2 limita madeira e pedra; ferro é da v0.4.
**Verificação:** propriedade "recursos nunca acima do cap" (GDD §15.4) e divisão de intervalo exata com o cap no caminho (encher é um evento da linha do tempo, como a comida acabar); teste em navegador do "cheio em".
**Pronto quando:** critério 1 da §16.2 provado por teste, e o Relatório de Retorno traz a linha de desperdício.

**Arquivos e entregáveis:** `packages/content/src/ids.ts`, `buildings.ts`, `schemas.ts`, `objectives.ts`; `packages/engine/src/types.ts`, `economy.ts`, `construction.ts`, `view.ts`; protocolo, painéis e relatório.

**Subtarefas de execução:**

- [ ] V2C-T2.1 Modelar edifícios ausentes no nível zero, construção inicial, gates e capacidades por dificuldade. Na v0.2, cap só para comida, madeira e pedra; ouro permanece ilimitado.
- [ ] V2C-T2.2 Fechar decisões 4 e 17: capacidade substitui ou soma ao limite inicial, arredondamento, estoque migrado, recompensas e devoluções. Centralizar a aplicação de ganhos limitada ao cap.
- [ ] V2C-T2.3 Fazer auditoria de alcançabilidade: custo da próxima melhoria deve caber em capacidades alcançáveis antes dela. Conferir especialmente Armazém que paga sua própria ampliação, Salão, dificuldade Rei de Ferro e níveis máximos; reportar travas ao autor antes de mudar números.
- [ ] V2C-T2.4 Contabilizar produção descartada separada de consumo e gastos, com total autoritativo e eventos determinísticos; agregar o texto do Relatório sem produzir uma linha por polling.
- [ ] V2C-T2.5 Tratar `cheio`, `cheio em`, saldo nulo/negativo e próxima mudança de estação; não exibir previsão exata além de um evento que muda a taxa sem considerar esse evento.
- [ ] V2C-T2.6 Testar ganho de carta/recompensa e cancelamento no limite, atualização simultânea de capacidade, cap com consumo contínuo, aritmética de restos e invariantes apenas para recursos limitados.
- [ ] V2C-T2.7 Integrar o desbloqueio do objetivo 4 sem pagar novamente quem já o concluiu; não bloquear construção apenas porque a recompensa antiga era diferente. Conferir limite, capacidade e desperdício no app e na ausência.


### V2C-T3 · Troca de ofício e experiência do ofício `M`

**Objetivo:** realocar custa: quem acabou de trocar de ofício produz menos por um dia de jogo; edifícios com postos ocupados acumulam experiência e produzem mais.
**GDD:** §5.3 (mestria), §5.4, §14.11 (`craftExperience`, `adaptation`), §16.2.
**Depende de:** V2B-T1, V2B-T3; decisões 1 e 13.
**Perguntas para o autor:** a §5.4 fala em "ao menos metade dos postos ocupados", mas a v0.1 não tem número de postos por edifício: qual é? O critério diz "reduz a produção por 2 h": no ritmo 3× são 2 horas de jogo (40 minutos reais) ou 2 horas reais?
**Verificação:** unidade; propriedade de divisão de intervalo com o fim da adaptação como evento; golden.
**Pronto quando:** critério 5 da §16.2 provado por teste, e o `ViewState` mostra quantos trabalhadores estão em adaptação e até quando.

**Arquivos e entregáveis:** `packages/content/src/balance.ts`, `schemas.ts`; `packages/engine/src/types.ts`, `population.ts`, `economy.ts`, `advance.ts`, `view.ts`; protocolo e `packages/web/src/components/WorkersPanel.tsx`.

**Subtarefas de execução:**

- [ ] V2C-T3.1 Fechar decisão 13: quantidade de postos, cálculo de metade ocupada, regra de entrada inicial no ofício e critério de experiência diária (fotografia ou tempo de ocupação). Evitar incentivo a mover aldeões só no instante da virada.
- [ ] V2C-T3.2 Definir coortes de trabalhadores em adaptação com prazo explícito; transferir, deixar livre e realocar não pode apagar nem multiplicar indevidamente a penalidade.
- [ ] V2C-T3.3 Acumular e perder experiência por edifício entre 0 e 100; explicar bônus e próxima atualização. Mestres e aldeões nomeados continuam fora desta versão.
- [ ] V2C-T3.4 Tratar perda de população, ferimento e recrutamento junto da ocupação: soma de trabalhadores nunca ultrapassa habitantes disponíveis.
- [ ] V2C-T3.5 Mostrar efeito e duração antes de confirmar uma troca, reaproveitando o fluxo de alocação; evitar um diálogo obrigatório em cada clique simples.
- [ ] V2C-T3.6 Testar 0/1/vários trabalhadores, corte na metade dos postos, realocações repetidas, desocupação, ganho diário e fim da adaptação em qualquer ritmo.


### V2C-T4 · Moral `L`

**Objetivo:** moral de 0 a 100, recalculada na virada do dia, com efeito na produção, as chances diárias de chegada e de partida de aldeões, e o abandono por fome longa.
**GDD:** §4.1 (frio), §5.3, §5.6 (moral −2 por dia faminto; abandono após 12 h de fome, não em Camponês), §5.7, §12.1.
**Depende de:** V2B-T2 (sorteios), V2B-T3 (dificuldade), V2C-T1 (frio), V2C-T2 (reservas), V2C-T3 (ocupação); decisão 19.
**Fica de fora:** os termos da fórmula que são de outras versões (Taverna, relíquias). Festival como efeito de uma carta e os demais ajustes temporários entram em V2D-T1; o comando de festival da Taverna não é antecipado. "Incursão sofrida" entra com os lobos (V2E-T3).
**Perguntas para o autor:** "o estoque de comida cobre 24 h" e "após 12 h de fome contínua": horas de jogo ou reais? "Festival dura 1 dia real" e "últimos 2 dias reais": como ficam nos outros ritmos? O multiplicador da moral usa fração inteira; confirmar o arredondamento.
**Verificação:** unidade de cada termo; propriedade com sorteios; teste de 30 dias offline com fome, abandono e moral.
**Pronto quando:** a aba Feudo mostra a moral, a faixa (Desesperado a Orgulhoso) e a explicação termo a termo, e a Crônica registra chegadas e partidas por moral.

**Arquivos e entregáveis:** `packages/content/src/balance.ts`, `chronicle.ts`; **novo** `packages/engine/src/morale.ts`, `famine.ts`, `population.ts`, `advance.ts`, `view.ts`; painel e relatórios.

**Subtarefas de execução:**

- [ ] V2C-T4.1 Definir na decisão 19 como combinar moral recalculada, −2 por dia faminto, partida por sorteio e partida por fome prolongada; especificar piso populacional e recuperação. Não deduzir essas regras de uma fórmula incompleta.
- [ ] V2C-T4.2 Calcular termos disponíveis, limitar a 0–100 e aplicar o fator de produção; deixar Taverna e relíquias fora. Efeitos temporários do Conselho entram quando D1 estiver disponível.
- [ ] V2C-T4.3 Implementar sorteios diários no fluxo da moral, respeitando vagas e habitantes elegíveis; contabilizar chegadas e partidas sem estourar alocação ou fila de recrutamento.
- [ ] V2C-T4.4 Testar limites 0/25/80/100, habitação cheia, alimento suficiente, frio e fome simultâneos, Camponês versus Senhor/Rei de Ferro e 30 dias sem acesso.
- [ ] V2C-T4.5 Apresentar decomposição da moral e sua próxima atualização; distinguir a mudança de um fator agora da atualização diária da moral.
- [ ] V2C-T4.6 Ensaiar recuperação de um feudo empobrecido e documentar qualquer estado sem saída. Alteração para impedir espiral de perdas precisa ser aprovada e reproduzida por teste.


### V2C-T5 · Segunda fila de obras e início automático das planejadas `M`

**Objetivo:** o Salão Nv4 abre a segunda fila; planejadas marcadas "iniciar quando houver recursos" começam sozinhas, na ordem da lista.
**GDD:** §6.1, §6.3 (as duas regras têm a tag `[v0.2]`, embora não estejam nos critérios da §16.2), §14.11 (`planned[].autoStart`).
**Depende de:** V2B-T1, V2C-T1, V2C-T2; resposta do autor em V2A-T2.3 e decisão 18.
**Perguntas para o autor:** "começam automaticamente na virada de segmento em que os recursos existirem": o instante em que os recursos passam a bastar precisa ser um evento da linha do tempo, senão o resultado depende de como o intervalo foi dividido. Confirmar que é essa a regra.
**Verificação:** unidade; propriedade de divisão de intervalo com início automático; "não melhorar o mesmo edifício em duas filas".
**Pronto quando:** um feudo deixado sozinho com planejadas automáticas e recursos chegando inicia as obras nos instantes exatos, e o Relatório de Retorno as lista.

**Arquivos e entregáveis:** `packages/engine/src/construction.ts`, `timeline.ts`, `advance.ts`, `commands.ts`, `types.ts`, `view.ts`; `packages/protocol/src/commands.ts`; SDK/paleta e `ConstructionsPanel.tsx`.

**Subtarefas de execução:**

- [ ] V2C-T5.1 Fechar decisão 18: ordem de planejadas bloqueadas, desempate de duas filas e preferência entre consumo de sobrevivência e gasto automático no mesmo instante.
- [ ] V2C-T5.2 Adicionar ativação/desativação explícita de início automático; migrar planos antigos como manuais. Planejar não cobra, iniciar cobra uma vez, cancelar segue a regra de devolução e cap.
- [ ] V2C-T5.3 Calcular quando recursos passam a bastar considerando consumo, cap e mudanças de taxa; não agendar um início que dependa de estoque impossível.
- [ ] V2C-T5.4 Abrir a segunda fila ao concluir Salão Nv4; tentar planos em ordem definida após comandos e eventos relevantes, sem iniciar duas melhorias do mesmo edifício.
- [ ] V2C-T5.5 Exibir próximo plano, custo, se é automático e por que espera: fila, recursos, capacidade insuficiente ou pré-requisito. Oferecer remoção/desativação antes de sair.
- [ ] V2C-T5.6 Testar duas filas disputando recursos, plano inicial inválido, cancelamento seguido de novo início, ganho por carta e fim de obra na mesma hora; avançar por intervalos diferentes dá os mesmos débitos e eventos.


### V2C-T6 · Revisão independente e balanceamento da Fase C `S`

**Objetivo:** revisão de leitura da fase e uma rodada do simulador com caps, estações, moral e a segunda fila.
**Depende de:** V2C-T1 a V2C-T5, V2B-T4.
**Pronto quando:** defeitos confirmados corrigidos com teste; o bot Regular satisfaz a métrica de desperdício aprovada na decisão 17 (§10), e há um caminho de melhorias alcançável em cada dificuldade. A invariável “estoque limitado ao cap” não serve como prova de bom balanceamento.

**Arquivos e entregáveis:** Código e testes da Fase C; `packages/sim-cli/src/`; `docs/balance-v0.2.md` e relatório de revisão.

**Subtarefas de execução:**

- [ ] V2C-T6.1 Revisão independente do conjunto: caps, lenha, fome, moral, experiência e filas automáticas no mesmo avanço.
- [ ] V2C-T6.2 Rodar as 50 sementes por perfil/ritmo/dificuldade acordados; medir descarte efetivo, tempo de fila ociosa e progressão, não apenas estoque final.
- [ ] V2C-T6.3 Demonstrar um caminho legal de compras até os desbloqueios da v0.2 em cada dificuldade; apontar qualquer nível anunciado mas inalcançável.
- [ ] V2C-T6.4 Medir avanços de 1, 7 e 30 dias reais, inclusive com muitas transições; registrar ambiente, tempo e quantidade de eventos, sem chamar uma medição isolada de capacidade de produção.
- [ ] V2C-T6.5 Fazer o autor jogar a sequência da §0.7, registrar o que entendeu e corrigir problemas antes de acrescentar o Conselho.


---

## 4. Fase D — O Conselho do Feudo

**Meta da fase:** cartas com opções, expiração, cadeias e interface, na cadência aprovada na decisão 1 (base do GDD: 4 dias de jogo). Critérios 2 e 3 da §16.2.

### V2D-T1 · Motor do Conselho `L`

**Objetivo:** sorteio ponderado entre as cartas elegíveis, no máximo 2 pendentes, expiração com a opção padrão, efeitos (recursos, moral com duração, flags, efeitos adiados e ocultos) e o comando de responder.
**GDD:** §7.1, §7.2, §12.1 (opção padrão por dificuldade), §14.11 (`council`), §17.1.
**Depende de:** V2B-T2, V2B-T3, V2C-T4; decisões 1, 9 e 18.
**Fica de fora:** requisitos e efeitos de outras versões (`heroTrait`, `addHero`, `addUnits`, `reveal` de mapa gráfico).
**Perguntas para o autor:** a carta "expira em 24 h reais" e sai "a cada 4 dias de jogo (8 h reais)": no ritmo 3× o intervalo vira 2 h 40 min reais; a expiração acompanha o ritmo ou fica em 24 h reais? O motor só conhece tempo de jogo. Em Camponês a opção ao expirar é "sempre a melhor" e em Rei de Ferro a "pior": quem marca a melhor e a pior de cada carta? O conteúdo precisa desses dois campos.
**Verificação:** unidade; propriedade de divisão de intervalo com sorteio e expiração; teste de conteúdo (flags consistentes, toda carta com opção padrão); mesma semente, mesmas cartas.
**Pronto quando:** em um cenário roteirizado, uma carta é sorteada no instante previsto, uma segunda fica pendente, a terceira não é sorteada, e uma carta não respondida expira com a opção padrão da dificuldade.

**Arquivos e entregáveis:** **Novos** módulos de Conselho em `packages/content/src/` e `packages/engine/src/`; `types.ts`, `timeline.ts`, `advance.ts`, `commands.ts`; protocolo e integração em `packages/server/test/`.

**Subtarefas de execução:**

- [ ] V2D-T1.1 Fechar decisões 1, 9 e 18: unidades de tempo, seleção quando não há elegíveis, prioridade de roteiro/cadeia, duas pendências, retomada do relógio e opção automática sem recursos.
- [ ] V2D-T1.2 Criar instância de carta com ID estável, prazo, opções e estado de resolução; distinguir ID de modelo e ID da ocorrência para cartas recorrentes e anos diferentes.
- [ ] V2D-T1.3 Implementar seleção ponderada no fluxo do Conselho, não repetição anual e efeitos temporários/adiados com ID próprio; efeitos só aplicam uma vez, inclusive na expiração.
- [ ] V2D-T1.4 Validar opção e recursos no estado atual após avanço; devolver motivo legível se a carta expirou ou outra aba respondeu. Definir o desempate exatamente no prazo e testá-lo.
- [ ] V2D-T1.5 Reusar a transação e recibos existentes para responder: mesmo `commandId` retorna o recibo original; um novo ID na mesma carta resolvida não concede nada novamente.
- [ ] V2D-T1.6 Manter opções executáveis na expiração e recursos não negativos. Uma opção dita conservadora não pode depender de um pagamento que o feudo já não consegue fazer sem alternativa definida.
- [ ] V2D-T1.7 Provar propriedades com sorteio, bloqueio por duas cartas, expiração, efeito adiado e virada de ano; testar conjunto elegível vazio sem busy loop e sem rerrolar pelo polling.


### V2D-T2 · Cartas e cadeias da v0.2 `L`

**Objetivo:** o conjunto de cartas da v0.2 em `@lotg/content`, com ao menos uma cadeia de 3 cartas completa.
**GDD:** §7.1 (meta: 60 cartas, 5 cadeias, 6 roteirizadas no primeiro ano), Apêndice B (amostra de 12), §18.3 (tom de crônica, frases curtas).
**Depende de:** V2D-T1.
**Perguntas para o autor (bloqueiam a tarefa):** o GDD só traz 12 das 60 cartas, e a maioria delas depende de versões futuras: a "Estrangeira ferida" entrega um herói (v0.3; e a §16.2 põe "o primeiro herói chega pela carta do dia 2" na v0.3), "O Mercador Misterioso" exige Mercado, "A Filha do Ferreiro" exige Ferreiro, outras citam ondas do cerco, ferro e Clériga. **Quais cartas compõem a v0.2, quantas, e qual é a cadeia de 3 do critério?** Quem escreve o texto: o autor, ou o agente propõe e o autor aprova carta a carta?
**Verificação:** teste de conteúdo (schema, flags, desfecho explícito para cada opção — inclusive recusar sem custo — e nenhuma referência a mecânica que não existe); cenário que percorre a cadeia inteira.
**Pronto quando:** critério 3 da §16.2 provado por um cenário de ponta a ponta, e todas as cartas aprovadas pelo autor.

**Arquivos e entregáveis:** **Novo** catálogo de cartas em `packages/content/src/`, schemas e testes; goldens do motor; **novo** `docs/content-v0.2.md` com inventário e revisão editorial.

**Subtarefas de execução:**

- [ ] V2D-T2.1 Fechar decisões 7 e 8: quantidade final, cadeias e roteiros compatíveis com v0.2. A meta do GDD continua 60 cartas/5 cadeias/6 roteirizadas até decisão registrada; o lote da §12 é protótipo, não redução tácita da entrega.
- [ ] V2D-T2.2 Para cada carta, escrever 2–4 frases, elegibilidade, opções, custos, efeitos, duração, pistas de consequências ocultas, resolução automática por dificuldade e frases de Crônica.
- [ ] V2D-T2.3 Validar referências: toda flag exigida tem origem alcançável, toda cadeia tem conclusão e nenhuma opção exige herói, Mercado, ferro, exército ou combate da v0.4.
- [ ] V2D-T2.4 Construir para cada opção um estado em que ela seja uma escolha razoável; conferir alimento escasso, ouro abundante, cap próximo e preparação de inverno. Rótulo de opção padrão não significa ótima em todo contexto.
- [ ] V2D-T2.5 Percorrer cada ramificação de cada cadeia, incluindo recusa, expiração e efeitos que atravessam ano/estação; cadeias temporizadas não podem ficar eternamente presas atrás de cartas comuns.
- [ ] V2D-T2.6 Medir cobertura de elegibilidade por estação e estágio do Salão em 50 sementes. Contar variantes de texto como variantes, não como escolhas novas; registrar intervalos sem conteúdo.
- [ ] V2D-T2.7 Apresentar o catálogo e os cenários ao autor para curadoria; congelar a versão de conteúdo do playtest e guardar as decisões no inventário.


### V2D-T3 · O Conselho na interface `M`

**Objetivo:** ver as cartas pendentes, ler custos e consequências, responder, saber quando a carta expira; aviso de carta nova; cartas no Relatório de Retorno.
**GDD:** §2.3, §13.2, §13.5, §13.6, §7.1.
**Depende de:** V2D-T1 (pode começar com as cartas de teste, antes de V2D-T2).
**Perguntas para o autor:** uma carta expira em 24 h e nada chega com a aba fechada (decisão da v0.1, ADR 0008 ponto 4). Isso basta para a v0.2?
**Verificação:** testes em navegador: responder pelo painel e pela paleta, só com o teclado, nos três temas; recusa legível ao responder uma carta expirada.
**Pronto quando:** critério 2 da §16.2 provado em navegador com o relógio controlado.

**Arquivos e entregáveis:** `packages/web/src/app/controller.ts`, `palette/commands.ts`, `app/router.ts`, `game/returnReport.ts`, notificações; **nova** aba/componente Conselho; protocolo/SDK.

**Subtarefas de execução:**

- [ ] V2D-T3.1 Apresentar a primeira carta funcional ao autor antes de completar a tela: situação, custo, consequência conhecida, prazo real e opção ao expirar.
- [ ] V2D-T3.2 Integrar painel, árvore e paleta pelo mesmo caminho de comando; preservar o `commandId` ao tentar novamente e impedir o clique duplicado durante o envio.
- [ ] V2D-T3.3 Mostrar requisito faltante e atualizar custos se o estado mudar; não esconder uma recusa de servidor com um botão que parece ter funcionado.
- [ ] V2D-T3.4 Tratar estados sem cartas, duas cartas, resposta em outra aba, conexão perdida, sessão encerrada e expiração enquanto o diálogo está aberto; nenhuma ordem fica guardada offline.
- [ ] V2D-T3.5 Incluir escolha, efeito posterior e expiração no Relatório/Crônica com referência compreensível à carta anterior; paginar eventos sem omitir desfechos.
- [ ] V2D-T3.6 Validar teclado, foco, temas e leitura sem depender de cor ou hover; notificações respeitam a política existente, sem exigir permissão para jogar.


### V2D-T4 · Revisão independente da Fase D `S`

**Objetivo:** conferir consistência, clareza e variedade do Conselho completo, incluindo o caminho automático de quem ficou ausente.
**Depende de:** V2D-T1 a V2D-T3.
**Pronto quando:** defeitos confirmados corrigidos com teste; nenhuma opção de carta dominante em todos os contextos (§15.1 item 8), conferido carta a carta.

**Arquivos e entregáveis:** Catálogo, motor e interface do Conselho; `docs/content-v0.2.md`; testes de integração e navegador.

**Subtarefas de execução:**

- [ ] V2D-T4.1 Revisor independente tenta responder após expiração, cobrar duas vezes, explorar outra aba e inferir efeitos ocultos pela resposta HTTP.
- [ ] V2D-T4.2 Revisar cada carta e ramificação quanto a elegibilidade, opção dominante, custo impagável e consequência sem pista.
- [ ] V2D-T4.3 Comparar o que o autor esperava ao escolher com o resultado e o texto da Crônica; corrigir discrepâncias sem alterar silenciosamente a regra.
- [ ] V2D-T4.4 Rodar cenários com 1–2 visitas/dia em todos os ritmos ofertados: medir cartas vistas, escolhidas, expiradas e tempo bloqueado por duas pendências.


---

## 5. Fase E — Ameaça: Torre, Paliçada e lobos

**Meta da fase:** o jogador vê a Ameaça, pode se preparar, e a primeira incursão acontece com ele fora. Critério 4 da §16.2.

### V2E-T1 · Torre de Vigia, tiles abstratos e Ameaça `M`

**Objetivo:** a Torre como edifício; os tiles de ameaça como dados, exibidos em lista; a Ameaça de 0 a 100 subindo a cada dia de jogo.
**GDD:** §6.1, §6.2, §8.1 (só a frase sobre tiles abstratos na v0.2), §8.2, §14.11 (`map`).
**Depende de:** V2B-T1, V2B-T2, V2C-T1, V2C-T2; decisão 11.
**Fica de fora:** mapa hexagonal e névoa gráfica (v0.5), presságios e o disparo da Torre no Nv3 (v0.4), limpar um tile (precisa de expedição ou exército).
**Perguntas para o autor:** quais tiles de ameaça existem na v0.2, e de onde vêm (semente, roteiro)? Sem como limpar um tile nem repelir com exército, a Ameaça só sobe: até onde, e o que a faz cair na v0.2? A Torre chega ao nível 5 na v0.2?
**Verificação:** unidade; propriedade; teste em navegador da lista de ameaças.
**Pronto quando:** a aba Feudo mostra a Ameaça com a explicação do número, e a Torre muda o que o jogador vê.

**Arquivos e entregáveis:** `packages/content/src/ids.ts`, `buildings.ts`, `schemas.ts`; **novo** módulo de ameaça no motor; `types.ts`, `timeline.ts`, `view.ts`; painel de ameaças.

**Subtarefas de execução:**

- [ ] V2E-T1.1 Fechar decisão 11: ameaças existentes, visibilidade, crescimento e redução possíveis nesta versão; definir o que cada nível construível da Torre entrega.
- [ ] V2E-T1.2 Modelar somente locais abstratos necessários para lobos; apresentar lista, sem coordenadas de mapa hexagonal, exército ou ruínas exploráveis.
- [ ] V2E-T1.3 Atualizar Ameaça em instantes definidos, limitar 0–100 e explicar suas fontes. Não sortear ataques de sistemas ainda fora do escopo.
- [ ] V2E-T1.4 Separar informação conhecida pelo motor da revelada ao jogador; Torre mostra antecipação e risco permitidos, sem vazar composição futura.
- [ ] V2E-T1.5 Testar Torre concluída antes/durante/depois da janela de aviso, virada de estação e ano, vários locais e aviso emitido uma única vez.


### V2E-T2 · Paliçada (níveis 1 e 2) `S`

**Objetivo:** a Paliçada como edifício, com Salão Nv3 como pré-requisito, até o nível 2.
**GDD:** §6.1, §6.2, §8.2.
**Depende de:** V2B-T1, V2C-T2, V2E-T1; decisão 11.
**Fica de fora:** HP de muralha por ala, dano e reparo (v0.4).
**Perguntas para o autor:** na v0.2 a Paliçada "absorve o ataque leve"; os níveis 1 e 2 diferem em quê, sem HP?
**Pronto quando:** construir a Paliçada muda o desfecho da incursão de V2E-T3, e o `ViewState` explica por quê.

**Arquivos e entregáveis:** `packages/content/src/buildings.ts`, `schemas.ts`; `packages/engine/src/construction.ts`, `view.ts`; painel e testes de construção.

**Subtarefas de execução:**

- [ ] V2E-T2.1 Definir na decisão 11 o efeito distinto dos níveis 1 e 2, sem criar HP/reparo da v0.4 nem vender uma melhoria sem benefício.
- [ ] V2E-T2.2 Implementar construção do zero, gate de Salão 3, custos, cap, planejamento e limite no nível 2.
- [ ] V2E-T2.3 Explicar o que a Paliçada protege e o que ainda pode ser perdido; não prometer proteção contra incursões humanas inexistentes.
- [ ] V2E-T2.4 Testar gate, limite de nível, cancelamento e conclusão no instante do ataque; integrar o resultado com V2E-T3.


### V2E-T3 · A incursão de lobos `M`

**Objetivo:** a incursão roteirizada de lobos acontece no instante marcado, com o jogador fora, resolve-se sozinha e aparece no Relatório de Retorno, com aviso prévio da Torre.
**GDD:** §2.2 (dia real 2), §8.2, §12.3, §5.7 (moral depois de incursão), §16.2.
**Depende de:** V2E-T1, V2E-T2, V2C-T4; decisões 1, 10, 11 e 19.
**Perguntas para o autor:** "lobos no dia 2" é o segundo dia **real** no ritmo Normal: qual é o instante em tempo de jogo? Sem paliçada, os lobos "levam **até** 15% de comida e madeira e ferem 1 aldeão": quanto exatamente, e o que é um aldeão ferido na v0.2? As incursões por Ameaça (chance diária acima de 40) entram na v0.2 ou só a roteirizada? A tag da §8.2 é "`[v0.2 lobos]` `[v0.4 completo]`".
**Atenção:** o Relatório de Retorno só é montado ao abrir a página depois de 4 h; uma aba deixada aberta não o recebe ([architecture.md §6.2](architecture.md)). O critério "aparece no Relatório" precisa valer também nesse caso, ou a limitação fica escrita.
**Verificação:** cenário offline com e sem Paliçada; propriedade; teste em navegador do Relatório.
**Pronto quando:** critério 4 da §16.2 provado por teste de integração e em navegador.

**Arquivos e entregáveis:** Módulo de ameaça/incursão no motor, `population.ts`, `chronicle.ts`, `timeline.ts`, `view.ts`; protocolo, `game/returnReport.ts` e E2E.

**Subtarefas de execução:**

- [ ] V2E-T3.1 Fechar decisões 1, 10, 11 e 19: instante roteirizado, ataques adicionais, fórmula de perda, ferimento/recuperação e resultado da Paliçada.
- [ ] V2E-T3.2 Preparar cenários idênticos com/sem Torre e com Paliçada 0/1/2; provar antecedência utilizável no ritmo 3× e tempo possível para erguer a defesa.
- [ ] V2E-T3.3 Executar a incursão uma vez no servidor mesmo com ninguém conectado; aplicar perdas, moral, Ameaça e ferimento em ordem documentada, conservando população e recursos válidos.
- [ ] V2E-T3.4 Resolver interações: fome/frio, colono chegando, Paliçada concluindo e duas incursões no mesmo instante. Conteúdo deve dizer se os ataques podem coincidir.
- [ ] V2E-T3.5 Registrar três informações no relato: aviso/preparação, o que a defesa mudou e perdas/recuperação. Dados de resultado vêm do motor; UI não calcula combate.
- [ ] V2E-T3.6 Testar retorno por reabertura, reconexão e aba deixada aberta. Se o Relatório só continuar existindo na reabertura, mostrar o acontecimento na Crônica/Hoje e documentar esse limite, sem alegar relatório automático novo.
- [ ] V2E-T3.7 Avançar 30 dias e dois anos para verificar frequência e ausência de cascata impossível de recuperar; repetir não pode aplicar de novo o ataque roteirizado do primeiro ano.


### V2E-T4 · Objetivos do Senhor da v0.2 `S`

**Objetivo:** os objetivos seguintes ao 4 que a v0.2 consegue cumprir, com a regra "nunca mais de 3 ativos".
**GDD:** §12.2 (`[v0.2 completo]`).
**Depende de:** V2C-T2, V2D-T1, V2D-T3, V2E-T1, V2E-T2.
**Perguntas para o autor:** dos objetivos 5 a 15, só o 5 (Torre), o 6 (primeira carta) e o 9 (Paliçada) dependem só de mecânicas da v0.2; o 7 e o 8 pedem herói e Patrulha (v0.3) e os demais, exército. A lista da v0.2 pula esses, reordena, ou para no primeiro que não dá para cumprir? A recompensa do 5 ("revela 6 tiles") vale com tiles abstratos?
**Pronto quando:** um cenário roteirizado conclui todos os objetivos da v0.2 na ordem aprovada.

**Arquivos e entregáveis:** `packages/content/src/objectives.ts`, schemas; `packages/engine/src/objectives.ts`, `view.ts`; árvore/painéis e testes E2E.

**Subtarefas de execução:**

- [ ] V2E-T4.1 Fechar decisão 12: ordem e recompensas dos objetivos possíveis; preservar IDs históricos 1–4 e usar IDs estáveis para os novos, sem renumerar progresso salvo.
- [ ] V2E-T4.2 Exibir até três objetivos ativos, com ação, motivo, recompensa e requisito faltante; nenhum objetivo depende de herói ou soldado ausente.
- [ ] V2E-T4.3 Testar progresso em partida nova e migrada: objetivo 4 já concluído não paga de novo, mas não impede os edifícios; fatos já cumpridos seguem a regra aprovada de reconhecimento.
- [ ] V2E-T4.4 Percorrer a sequência completa por teclado e por bot, conferindo que revela o próximo objetivo alcançável.
- [ ] V2E-T4.5 Incluir conclusão/recusa no Relatório sem notificação em excesso. Sugestões de objetivos sazonais da §12 só entram após aprovação, sem prêmios por login diário.


### V2E-T5 · Revisão independente da Fase E `S`

**Objetivo:** conferir se aviso, defesa, perda e recuperação formam uma sequência compreensível e determinística.
**Depende de:** V2E-T1 a V2E-T4.
**Pronto quando:** defeitos confirmados corrigidos com teste.

**Arquivos e entregáveis:** Código e conteúdo da Fase E; integração, E2E e `docs/balance-v0.2.md`.

**Subtarefas de execução:**

- [ ] V2E-T5.1 Revisão independente da preparação, antecedência dos avisos, perdas, Ameaça e objetivos alcançáveis.
- [ ] V2E-T5.2 Testar perdas e população contra adaptação, fome, recrutamento e moral; conferir que defesa tem efeito verificável e não apenas uma mensagem diferente.
- [ ] V2E-T5.3 Jogar com o autor os caminhos preparado, despreparado e ausente; registrar se a próxima ação de recuperação ficou clara.
- [ ] V2E-T5.4 Confirmar que nenhuma tarefa introduziu combate, recompensas de herói ou mapa da versão futura; corrigir defeitos com regressão.


---

## 6. Fase F — Fechamento da v0.2

**Meta da fase:** os critérios da §16.2 provados, a v0.2 jogada por pessoas, versão etiquetada.

### V2F-T1 · Balanceamento com o simulador `M`

**Objetivo:** bots que jogam a v0.2 inteira (respondem cartas, constroem Celeiro, Armazém, Torre e Paliçada) e faixas que a CI confere.
**GDD:** §15.2, §15.3.
**Depende de:** Fases C, D e E; V2B-T4.
**Pronto quando:** as metas da §15.2 que valem na v0.2 (população, cap) estão dentro da faixa em 50 sementes, ou cada desvio tem decisão do autor.

**Arquivos e entregáveis:** `packages/sim-cli/src/`, `packages/content/src/`, `docs/balance-v0.2.md`, `docs/perf-v0.1.md` como referência de comparação.

**Subtarefas de execução:**

- [ ] V2F-T1.1 Executar a matriz da §7.3, mantendo estratégias e sementes fixas; comparar um ano de jogo e períodos reais sem misturar os denominadores.
- [ ] V2F-T1.2 Medir progresso, estoque perdido, fome/frio, abandono, adaptação, ociosidade, cartas escolhidas/expiradas, cadeias concluídas e perdas por lobos.
- [ ] V2F-T1.3 Investigar extremos e sementes que falham, não apenas médias. Repetir uma semente problemática manualmente no simulador e no app quando relevante.
- [ ] V2F-T1.4 Auditar níveis alcançáveis e caminhos de recuperação, comparar 1/2/4 visitas e confirmar as metas aplicáveis do GDD; não aplicar vitória de cerco a uma versão sem cerco.
- [ ] V2F-T1.5 Ajustar números aprovados em `content`, atualizar GDD e goldens com justificativa; não facilitar o bot para esconder uma economia ruim.
- [ ] V2F-T1.6 Medir avanço longo, tamanho de `ViewState`, eventos e recibos e p95 local; registrar hardware, carga, commit e limitações.


### V2F-T2 · Critérios de aceitação da v0.2 `M`

**Objetivo:** um quadro como o de [acceptance-v0.1.md](acceptance-v0.1.md) para os seis critérios da §16.2, com prova automática e prova em produção.
**Depende de:** V2F-T1.
**Entregáveis:** `docs/acceptance-v0.2.md`; roteiro manual da v0.2.
**Pronto quando:** os seis critérios têm evidência escrita, por critério, com data e navegador. Na v0.1 essa evidência não chegou a ser escrita (§8, lição 7): aqui o quadro é preenchido durante o teste, e não depois.

**Arquivos e entregáveis:** **Novos** `docs/acceptance-v0.2.md`, `docs/manual-test-v0.2.md`; testes da §7 e documentação de deploy.

**Subtarefas de execução:**

- [ ] V2F-T2.1 Criar quadro para os seis critérios do GDD e verificações adicionais da §7.2, com links para testes e evidência manual; distinguir código, ambiente de prévia e produção.
- [ ] V2F-T2.2 Executar jornadas de conta nova e migrada, um ano/virada seguinte, diferentes ritmos e reenvio de comandos; incluir fluxo sem conexão.
- [ ] V2F-T2.3 Registrar navegador e versão em cada observação. Automatizar Chromium; conferir manualmente Firefox para o suporte anunciado e registrar Safari/celular/leitor de tela como verificados ou não.
- [ ] V2F-T2.4 Validar conteúdo, teclado, contraste, foco, mensagens de tempo e percepção de custo antes da escolha.
- [ ] V2F-T2.5 Preparar release candidata com CI verde e procedimento de reversão; implantar somente com autorização, então conferir saúde, versão e os cenários seguros em produção, sem apagar contas de jogadores.


### V2F-T3 · Playtest da v0.2 `M`

**Objetivo:** repetir V2A-T1 com a v0.2, com o mesmo formulário e as mesmas consultas, para comparar.
**Depende de:** V2F-T2.
**Pronto quando:** `docs/playtest/relatorio-v0.2.md` existe e compara o retorno no dia 2 com o da v0.1.

**Arquivos e entregáveis:** **Novo** `docs/playtest/relatorio-v0.2.md`; formulário/modelo existentes, consultas agregadas e `docs/balance-v0.2.md`.

**Subtarefas de execução:**

- [ ] V2F-T3.1 Repetir a janela de 48 h com 3–5 pessoas e registrar versão congelada, ritmo, dificuldade e participantes novos/retornantes. Não trocar duração ou público e atribuir a diferença somente à versão.
- [ ] V2F-T3.2 Manter as perguntas comparáveis da v0.1 e acrescentar o módulo da §7.3: decisão lembrada, consequência entendida, preparação, recuperação e vontade espontânea de voltar.
- [ ] V2F-T3.3 Separar observação natural de cenário guiado com relógio adiantado. Quarenta e oito horas não cobrem um ano de 56 h no ritmo 3×, nem uma semana no Normal; testar inverno e virada em cenário próprio ou prolongar a observação com registro.
- [ ] V2F-T3.4 Apresentar contagens/denominadores e relatos, sem alegar aumento comprovado de retenção com amostra pequena; separar retorno com comando de retorno apenas para olhar.
- [ ] V2F-T3.5 Classificar P0–P3, escolher correções com o autor e registrar o que não foi medido. Se a v0.1 não tiver amostra externa, declarar ausência de linha de base, nunca inventar comparação.


### V2F-T4 · Correções, documentação e release `S`

**Objetivo:** P0 e P1 do playtest corrigidos; `README.md`, `docs/architecture.md`, `CHANGELOG.md` e GDD em dia; tag `v0.2.0` e release.
**Depende de:** V2F-T3.
**Pronto quando:** zero P0 e P1 abertos, a CI verde no commit etiquetado e a tag criada pelo autor.

**Arquivos e entregáveis:** `README.md`, `CLAUDE.md`, `CHANGELOG.md`, `GAME_DESIGN.md`, `docs/architecture.md`, aceitação, guias dos pacotes, `deploy/README.md` e landing quando afetada.

**Subtarefas de execução:**

- [ ] V2F-T4.1 Corrigir P0/P1 e repetir testes dos caminhos afetados; submeter mudanças de balanceamento ao autor e revalidar cenários que o ajuste altera.
- [ ] V2F-T4.2 Conferir documentação, divulgação, capturas e limites conhecidos contra o produto entregue; não anunciar propostas não implementadas.
- [ ] V2F-T4.3 Preparar notas de versão com efeito nas partidas antigas, ritmos, novas escolhas e procedimento de migração/reversão.
- [ ] V2F-T4.4 Registrar CI do commit candidato, artefatos e verificação da implantação autorizada; a tag/release se refere exatamente ao código validado.
- [ ] V2F-T4.5 Autor aprova e cria/publica a versão conforme o fluxo do projeto; preencher Registro com resultados reais e deixar pendências restantes explícitas.


### V2F-T5 · Preparar a v0.3 `S`

**Objetivo:** `docs/roadmap-v0.3.md` no mesmo formato, com as lições da v0.2.
**Depende de:** V2F-T4.
**Pronto quando:** a primeira tarefa da v0.3 está detalhada o bastante para abrir a sessão seguinte.

**Arquivos e entregáveis:** **Novo** `docs/roadmap-v0.3.md`; lições, métricas e decisões da v0.2.

**Subtarefas de execução:**

- [ ] V2F-T5.1 Consolidar o que funcionou, confundiu e gerou retorno; preservar as dúvidas e casos negativos, não apenas elogios.
- [ ] V2F-T5.2 Mapear heróis, Taverna, expedições, Mercado e Mestres às dependências já entregues; não construir esses campos na v0.2.
- [ ] V2F-T5.3 Definir critérios de experiência da Guilda, decisões pendentes e a primeira entrega jogável.
- [ ] V2F-T5.4 Detalhar a primeira tarefa da v0.3 com arquivos, testes, impacto em partidas antigas e evidência de conclusão.


---

## 7. Mapa dos critérios de aceitação (GDD §16.2) para tarefas

| # | Critério | Tarefas que o entregam | Como provar |
|---|---|---|---|
| 1 | O estoque para no cap e o painel mostra "cheio em" | V2C-T2 | Propriedade "nunca acima do cap" + teste em navegador |
| 2 | Uma carta aparece a cada 8 h e expira em 24 h com a opção padrão | V2B-T2, V2D-T1, V2D-T3 | Cenário no motor + teste em navegador com relógio controlado |
| 3 | Uma cadeia de 3 cartas funciona de ponta a ponta | V2D-T1, V2D-T2 | Cenário roteirizado com a cadeia inteira |
| 4 | A incursão de lobos do dia 2 acontece offline e aparece no Relatório | V2E-T1, V2E-T2, V2E-T3 | Integração com relógio adiantado + teste em navegador |
| 5 | A troca de ofício reduz a produção por 2 h | V2C-T3 | Unidade + teste em navegador |
| 6 | Dificuldade e ritmo são escolhidos na criação | V2B-T3 | Integração + teste em navegador das boas-vindas |

Os tempos dos critérios 2, 4 e 5 estão no ritmo Normal do GDD; como eles se leem nos outros ritmos é pergunta da §10, item 1.


### 7.1 Como interpretar os critérios

A tabela acima preserva os seis critérios do GDD. Durações fora de 1× só podem virar asserções depois da decisão 1. “Nunca acima do cap” vale para os recursos limitados, **não para ouro**, e não prova que o jogador deixa de desperdiçar produção.

Há entregas do GDD que não aparecem nesses seis itens: moral, experiência de ofício, segunda fila, automação e avisos da Torre. Elas continuam obrigatórias no escopo e são cobertas abaixo.

### 7.2 Matriz de cenários integrados

| ID | Cenário | Resultado a verificar | Responsável |
|---|---|---|---|
| QA-01 | Carregar v0.1 com obra, fila, estoque alto e objetivo 4 concluído | Estado validado/migrado uma vez; progresso e desbloqueios preservados conforme a decisão; sem prêmio duplicado | V2B-T1, V2C-T2 |
| QA-02 | Avançar 30 dias de uma vez, por horas e com cortes aleatórios | Estado, RNG, restos, perdas e sequência de eventos exatamente iguais; chamada não muta entrada | V2C-T6, V2D-T4, V2E-T5 |
| QA-03 | Estação, fim de obra, adaptação, moral, carta e ataque no mesmo instante | Precedência documentada, nenhuma cobrança duplicada e nenhum laço no mesmo timestamp | V2C-T6, V2D-T4, V2E-T5 |
| QA-04 | Encher estoque; gastar; receber recompensa; cancelar obra | Caps respeitados, ouro sem cap, descarte contabilizado e projeção recalculada; recompensas/refundos seguem decisão explícita | V2C-T2 |
| QA-05 | Subir Salão/Armazém e comprar cada melhoria anunciada, em cada dificuldade | Nenhum ciclo de pré-requisitos ou custo que impeça para sempre a ampliação necessária; bloqueio temporário é explicado | V2C-T2, V2C-T6 |
| QA-06 | Fila automática com duas obras e poucos recursos, depois de ausência | Débitos e ordem iguais aos da execução acompanhada; UI explica por que espera | V2C-T5 |
| QA-07 | Frio, fome, moral baixa, ferimento e pouca população | Alocação e recursos válidos; resultado de recuperação conforme a decisão 19; casos sem saída identificados antes da release | V2C-T4, V2E-T3 |
| QA-08 | Carta expira no clique; outra aba responde; rede cai depois do commit | Uma resolução e um pagamento; mesmo ID recebe mesmo recibo; nova ordem na carta resolvida é recusada sem perder o avanço | V2D-T1, V2D-T3 |
| QA-09 | Duas cartas pendentes, catálogo inelegível, cadeia atrasada e ano mudando | Sem rerrolagem por polling, estouro de pendências ou cadeia sem desfecho; regra de roteiro/retomada comprovada | V2D-T2 |
| QA-10 | Mesma incursão com Torre 0/1 e Paliçada 0/1/2 | Antecedência e proteção têm efeito real; uma perda por ataque; relato explica causa e próximo passo | V2E-T3 |
| QA-11 | Reabrir após 4 h, reconectar e retomar aba em segundo plano | Relatório/Crônica não omitem nem duplicam novidades; cache e cursores corretos; limite da aba aberta registrado | V2D-T3, V2E-T3 |
| QA-12 | Um ano inteiro e a virada seguinte, com carta/efeito pendente | Nenhum reset indevido, roteiro do primeiro ano duplicado ou tempo negativo; política anual aplicada | V2D-T2, V2E-T3 |
| QA-13 | API nova, app/cache antigo, recibo antigo e reversão | Atualização orientada ou compatibilidade efetiva; acesso preservado; sem reinterpretação de recibo; procedimento de reversão ensaiado | V2B-T1, V2F-T2 |
| QA-14 | Fluxos novos nos três temas, por teclado e em tela menor | Custos/prazos legíveis, foco correto, nenhuma ação dependente só de cor/hover; limites de suporte registrados | V2D-T3, V2F-T2 |
| QA-15 | Jornada E2E no ritmo usado em produção | Prazos do navegador e da API concordam; conversão não ocorre duas vezes | V2B-T4, V2F-T2 |
| QA-16 | Exclusão/renovação de sessão e nova partida após adicionar mecânicas | Contratos da v0.1 continuam passando; efeitos não atravessam contas ou partidas; dados novos participam do expurgo | V2F-T2 |

### 7.3 Matriz de balanceamento e diversão

**Matriz mínima:** perfis de 1, 2 e 4 visitas por dia real × cada ritmo oferecido × cada dificuldade × 50 sementes fixas. Bots militares/exploradores e metas de vitória no cerco só entram nas versões correspondentes. Rodar a matriz completa no fechamento; testes menores durante a implementação não a substituem.

| Sinal | Como medir | Como usar |
|---|---|---|
| Progresso alcançável | Tempo até Salão 2/3/4, primeiro armazenamento, automação e defesa; bloqueios por cap/pré-requisito | Detectar travas antes de mexer em taxas |
| Uso do estoque | Quantidade descartada / produção bruta positiva do mesmo recurso; período contínuo de descarte com saldo positivo | Nunca somar unidades de recursos diferentes num único percentual; produção zero fica “não aplicável” |
| Planejamento offline | Tempo de fila ociosa apesar de plano automático viável; obras iniciadas/concluídas entre visitas | Automação reduz dependência de cliques; a meta é zero atraso indevido do motor |
| Sobrevivência e recuperação | Horas reais de fome/frio, partidas de aldeões, população mínima, tempo até saldo sustentável após ação de recuperação | Separar resultado da estratégia do bot de impossibilidade matemática de recuperação |
| Conselho utilizável | Cartas apresentadas, respondidas, expiradas, bloqueadas e inelegíveis; cadeias iniciadas/concluídas | Expiração frequente em 1–2 visitas pode apontar janela ruim; não forçar visitas extras para melhorar a métrica |
| Decisão com significado | Relato de escolha, alternativa e consequência, com uma frase anônima por participante | Boa resposta explica uma troca; repetir a opção “verde” não basta |
| Antecipação | Jogador consegue dizer o que espera da próxima estação ou ameaça antes de sair | Verificar avisos e clareza, não cobrar que ele consulte todas as abas |
| Retorno espontâneo | Comandos no dia 2 + resposta do formulário sobre voltar só para olhar | Registrar numerador/denominador; retorno sem comando não aparece na consulta |
| Peso da interface | Ações/cliques para preparar a ausência, duração da sessão observada, momentos de confusão | Investigar se a versão trocou diversão por microgerenciamento |

O limite quantitativo de desperdício, a cobertura esperada de cartas e as metas fora do Normal/Senhor são definidos em V2A-T2/V2B-T4, com o autor, e registrados antes do ajuste dos números. **A meta de oito horas do GDD ainda precisa da decisão 17 sobre unidade e definição.** Não inventar um percentual “bom” depois de ver o resultado do bot.

**Perguntas adicionais no playtest da v0.2, ao fim da sessão ou das 48 h:**

1. Qual escolha você lembra de ter feito? O que deixou de ganhar com ela?
2. Alguma consequência pareceu injusta ou impossível de prever? Qual?
3. O que você preparou antes de sair? Funcionou como esperava?
4. Em algum momento sobrou recurso, faltou objetivo ou parecia não haver saída?
5. Qual história do Conselho você gostaria de continuar? O que fez você querer voltar?

As perguntas complementam o formulário existente; não são um questionário obrigatório a cada login. O relatório distingue diversão observada, hipótese e opinião do autor. Sem nova telemetria de terceiros.

### 7.4 Definição de pronto da versão

- [ ] Os seis critérios do GDD têm prova automática e evidência manual identificada.
- [ ] Moral, ofícios, estações, automação e defesas têm seus cenários integrados cobertos.
- [ ] Decisões aplicáveis da §10 estão resolvidas; proposta descartada não aparece como funcionalidade entregue.
- [ ] Um feudo novo e um migrado completam a jornada sem travas de progressão.
- [ ] Catálogo aprovado, cadeias alcançáveis e opções automáticas executáveis; quantidade final confere com o GDD/ADR vigente.
- [ ] Matriz de balanceamento rodada, casos extremos analisados e playtest registrado; zero P0/P1 abertos.
- [ ] Compatibilidade, backup/restauração e reversão da atualização têm procedimento e ensaio correspondente; limites estão escritos.
- [ ] Divulgação, documentação e capturas correspondem ao produto; CI verde no commit candidato; publicação autorizada.

---

## 8. O que o MVP ensinou

Lições tiradas do Registro de Execução ([MVP-ROADMAP.md §9](../MVP-ROADMAP.md)) e dos ADRs. O playtest com outras pessoas não aconteceu: **não há lição de playtest aqui**. O que o autor relatou ao jogar está na lição 4.

| # | Lição | Evidência | O que muda na v0.2 |
|---|---|---|---|
| 1 | **A plataforma mudou no meio da Fase 3, depois de nove tarefas prontas.** A extensão do VS Code foi implementada e testada por automação, mas nunca aberta em um editor real; quando o autor olhou para o que queria, era outra coisa | [ADR 0008](decisions/0008-cliente-web-com-aparencia-de-editor.md) ("nunca aberta em um editor real"; lista de "trabalho descartado"); Registro, F3-T2 a F3-T10, todas "Substituída pelo ADR 0008"; F3-T2: "**Não verificado:** F5 e a ativação em um VS Code real" | O autor joga cada fase no ambiente definido na decisão 3 antes de a seguinte começar: produção só recebe a entrega autorizada e completa; uma prévia isolada pode ser usada antes disso. Uma decisão de experiência (como o Conselho aparece na tela) é mostrada ao autor na primeira tarefa que a toca, e não ao fim da fase |
| 2 | **Testes em navegador real acharam defeitos que os testes sem DOM não achavam.** | Registro, F3-T7: "Testes por renderização em texto: cliques, teclado, foco e os três temas **não foram verificados**". Depois, em Chromium: F3W-T2 (foco da árvore um quadro atrasado; boas-vindas piscando ao recarregar), F3W-T3 (`Esc` falhava antes do primeiro quadro), F3W-T4 (fechar a aba logo depois de uma ordem deixava o cache no passado) | Toda tarefa da v0.2 com interface tem teste em navegador na "Verificação" (§0.4). Segue valendo o limite: só Chromium é automatizado; Firefox, Safari e celular continuam sem conferência |
| 3 | **Revisões independentes por subagentes acharam defeitos reais em toda fase em que foram feitas.** | Registro, F2-T2: sete defeitos de concorrência e robustez no servidor (deadlock entre comando e exclusão, job travado, SQL em logs…); F3-T2: 12 defeitos confirmados e 6 riscos no cliente; F3W-T6: três defeitos achados por testes de unidade escritos por subagentes; F3W-T10: três defeitos médios e uma dúzia de menores (um 401 de proxy apagava a conta local) | A revisão deixa de ser iniciativa da sessão e vira tarefa: uma por fase (V2B-T5, V2C-T6, V2D-T4, V2E-T5), feita por quem não escreveu o código, com cada defeito confirmado virando teste |
| 4 | **Tempo de jogo e tempo real são coisas diferentes, e o GDD mistura os dois.** Com o ritmo fixo em 1 a diferença não aparecia; o autor achou o jogo lento, o ritmo foi a 3× depois da Fase 4, e foi preciso converter prazos e taxas no `ViewState` e trocar o lembrete do "dia 25" por 48 horas reais | [ADR 0011](decisions/0011-ritmo-3x-no-mvp.md); Registro, "Pós-F4 · ajustes de fechamento"; [architecture.md §5](architecture.md); os testes em navegador e de integração seguem no ritmo 1 | Todo número de tempo de uma regra nova diz de qual relógio é. O motor só conhece tempo de jogo; o `ViewState` só fala em tempo real. As frases do GDD em "horas reais" (cartas, festival, incursões) viram perguntas ao autor antes do código (§10, item 1). Cada regra com prazo tem ao menos um teste em um ritmo diferente de 1 |
| 5 | **Documento velho custa caro.** Os documentos de estado foram escritos antes do fato e corrigidos por anotações "(Depois: …)"; alguns ficaram com dois estados no mesmo texto | Registro, F0-T5, F1-T11, F2-T6, F3W-T9, F3W-T10 (anotações "Depois:"); `docs/acceptance-v0.1.md` no commit `bc807cd` dizia que os ajustes "ainda não estavam commitados" e, logo abaixo, que a CI tinha passado neles; `docs/architecture.md`, no mesmo commit, listava como não verificado o que a aceitação já registrava. Os dois foram reescritos no fechamento | Um documento de estado tem data e é reescrito, e não anotado, quando o fato muda. O Registro continua sendo o único lugar com histórico. Fechar uma tarefa inclui procurar o que ela tornou falso em `CLAUDE.md`, README e `docs/` |
| 6 | **"Um commit por tarefa" não foi cumprido, e o Registro não mede esforço.** | Registro: F1-T2 a F1-T8 no commit `ad76fd9`; F2-T1 a F2-T7 em `2b20231`; F3W-T1 a F3W-T8 em `8576c02` ("o código depende um do outro e do mesmo lockfile"); todas as linhas com data 2026-10-01 e "1" sessão | Este roadmap não traz estimativa de prazo. Onde tarefas dependem do mesmo lockfile, o plano já as junta em uma. Reverter uma mecânica precisa ser possível: uma mecânica, um commit |
| 7 | **O que dependia de um ato do autor ficou por fazer até o fim.** | Registro, F3-T9 e F3W-T10 (coluna "Manual" do roteiro nunca executada); [acceptance-v0.1.md](acceptance-v0.1.md): nenhuma linha do quadro com evidência por critério escrita por quem jogou; F4-T2 a F4-T4: backup fora do disco, cópia do segredo, canal de avisos, e-mail de alerta; F3W-T8: vínculo GitHub feito sem o `GITHUB_CLIENT_ID` e nunca exercitado de verdade | Tarefas que dependem do autor dizem **quem faz cada passo** (como V2A-T1) e ficam no começo da fase, e não no fim. O agente não constrói o que depende de uma decisão que ainda não existe: pergunta primeiro (§10) |
| 8 | **O simulador avisou, mas ninguém era obrigado a ouvir.** O bot já terminava a semana com cerca de 10.000 de madeira parada no ritmo 1; no ritmo 3× são 40.872. As faixas do teste só olham população, nível do Salão e fome, no ritmo 1 | Registro, F1-T10 ("~10.000 de madeira parada: sem caps de estoque (v0.2), o excedente não tem saída"); medição de 2026-10-01 em V2A-T2.2; README do `sim-cli` ("no ritmo 3 não há faixa definida") | V2B-T4: faixas no ritmo jogado, com limite para o excedente parado. V2A-T2.3 leva a pergunta ao autor antes das mecânicas |
| 9 | **Dizer "não verificado" funcionou.** As lacunas escritas no Registro foram as que acabaram fechadas ou viraram decisão consciente; as que não estavam escritas foram achadas por revisão | Registro: F0-T5 (CI nunca rodada → rodou), F3W-T9 (app atrás do proxy → conferido em F4-T1), F4-T4 (teste de alerta feito, e-mail não conferido) | O Registro da v0.2 (§11) tem coluna própria para o que não foi verificado |
| 10 | **Uma dependência entrou sem aprovação, e um segredo apareceu na saída de um comando.** | [ADR 0006](decisions/0006-types-node.md) (adotado na Fase 2, aprovado só no fechamento); Registro, F4-T1 ("a senha do primeiro banco apareceu na saída de um comando"; o banco foi recriado) | Dependência nova: ADR aprovado **antes** de instalar. Comandos de operação nunca imprimem variáveis de ambiente de produção |

---

## 9. Dívidas técnicas registradas

Conferidas no código em 2026-10-01. "Bloqueia" quer dizer: precisa estar resolvida antes da tarefa indicada.

### 9.1 Código

| Onde | O que é | Bloqueia a v0.2? |
|---|---|---|
| `packages/engine/src/types.ts` (`schemaVersion: 1`), `packages/server/src/db/schema.ts` (`state` lido sem validação) | Não existe migração de `GameState` | **Sim**: V2B-T1, antes de qualquer mecânica |
| `packages/engine/src/state.ts` (`rng: {}`) | Não existe gerador de números aleatórios | **Sim**: V2B-T2, antes de moral, cartas e incursões |
| `packages/protocol/src/api.ts` (`CreateGameRequestSchema`: `difficulty: 'lord'`, `timeScale: z.literal(1)`, aceito e ignorado), `packages/server/src/games/service.ts` (dificuldade constante, ritmo do servidor) | O jogador não escolhe ritmo nem dificuldade | **Sim**: V2B-T3 (critério 6 da §16.2) |
| `packages/engine/src/types.ts` (`capsEnabled: false`) | O ponto de corte dos caps existe só como tipo literal | Não bloqueia; é resolvido em V2C-T2 |
| `packages/sim-cli/src/balance.test.ts` | Faixas só no ritmo 1 e com uma semente; o GDD §15.3 pede 50 por perfil | **Sim** para o balanceamento: V2B-T4 |
| `packages/web` (Relatório de Retorno) | Só é montado ao abrir a página depois de 4 h; uma aba aberta a noite inteira não recebe | Não bloqueia; **afeta o critério 4** (V2E-T3) |
| `packages/web` (notificações) | Nada chega com a aba fechada | Não bloqueia; pesa mais com cartas que expiram (V2D-T3) |
| `docs/perf-v0.1.md` | O custo de `advanceTo` depois de dias sem acesso nunca foi medido; a v0.2 acrescenta trabalho a cada virada de dia (moral, sorteio, Ameaça), e no ritmo 3× há 36 viradas por dia real | Não bloqueia; medir em V2C-T6 |
| `docs/perf-v0.1.md`, tabela `commands` | Cada recibo guarda a resposta inteira (cerca de 3,4 kB por comando); o `ViewState` da v0.2 será maior | Não bloqueia; medir de novo em V2F-T1 |
| `packages/server/src/games/commands.ts` | Se o relógio do servidor andar para trás, `commands.server_time` guarda o instante regredido; um replay só pelo log usaria esse instante | Não |
| `packages/server` (GDD §14.5) | `GET /catalog` não existe; o `ViewState` traz o que o app exibe | Não; reavaliar com 60 cartas em `content` |
| `packages/web/src/workbench/EditorTabs.tsx` | Botões de fechar aba dentro do `tablist`, fora do padrão ARIA | Não |
| `packages/web/src/services/sessionLock.ts` | A espera de `storageSettle` protege de uma corrida que nunca foi reproduzida em teste | Não |
| `packages/server/src/routes/auth.ts` | Limite do *device flow* por IP; só importa se o vínculo GitHub for ligado | Não |
| App (GDD §13.6) | "Baixar cópia da partida (JSON)" não existe | Não |
| `packages/web/src/tabs/Settings.tsx` | A Hora da Vigília é guardada e não muda nada (é da v0.4) | Não |

### 9.2 Operação

| O que é | Bloqueia a v0.2? |
|---|---|
| Backups no mesmo disco do banco; falta um destino externo no Coolify | Não bloqueia o código; **recomendado antes do playtest** (V2A-T1.3) e **antes de V2B-T1** entrar em produção |
| Não há registro de que `RECOVERY_CODE_SECRET` foi copiado para fora do Coolify | Idem |
| A reversão nunca foi ensaiada atravessando uma migração | **Sim**, para V2B-T1 chegar à produção |
| `deploy/analytics/ops.sql` nunca foi executado em produção, e as consultas de playtest não têm filtro de período | **Sim**, para V2A-T1 (subtarefa V2A-T1.2) |
| Avisos do Coolify sem canal ligado; chegada do e-mail de alerta do GitHub e disparo pelo agendamento não conferidos | Não |
| Deploy automático a cada push no `main`: uma mecânica pela metade chega a quem está jogando | Não bloqueia; **precisa de decisão** (§10, item 3) |
| Verificação de saúde do Coolify desligada nas duas aplicações (Registro, F4-T1): vale só o `HEALTHCHECK` do Docker e o monitor do GitHub | Não bloqueia |
| NTP do servidor nunca conferido (MVP-ROADMAP §10); o tempo de jogo depende do relógio do servidor | Não bloqueia; conferir uma vez antes do playtest |
| `LOTG_GAME_URL` e `LOTG_LANDING_URL` da página de apresentação são variáveis de build nunca conferidas em produção (ADR 0012) | Não bloqueia; conferir antes de divulgar a página |
| Rajadas sincronizadas de leituras ficaram acima da meta local de p95 em `docs/perf-v0.1.md` | Não bloqueia com o público do playtest; medir de novo quando o `ViewState` crescer |
| A API é implantada antes do app: uma aba antiga aberta durante um deploy fala com a API nova. Hoje o app tolera campos a mais e preserva o cursor, mas uma mudança incompatível do `ViewState` precisa subir a versão do protocolo (`426`) | **Decidir em V2B-T1**, antes da primeira mudança de estado |
| Os testes de integração e em navegador rodam no ritmo 1; a produção, no 3. A conversão tem testes próprios, mas nenhum cenário de ponta a ponta roda no ritmo jogado | Não bloqueia; acrescentar um cenário no ritmo do servidor junto com V2B-T4 |

### 9.3 Verificação

| O que não foi verificado | Bloqueia a v0.2? |
|---|---|
| Firefox e Safari sem evidência registrada (o autor informou ter testado em dois navegadores, sem dizer quais); navegadores de celular nunca abertos; leitores de tela nunca usados | Não; o playtest (V2A-T1.5) pede o navegador de cada pessoa |
| A prova em produção dos 12 critérios da v0.1 não foi escrita por critério | Não; a v0.1 fechou assim por decisão do autor |
| O vínculo GitHub nunca foi exercitado com o GitHub real | Não; segue desligado |
| O expurgo de sete dias em produção (as contas de teste do fechamento saem em 2026-10-08) | Não; dá para conferir pelas contagens de `ops.sql` depois dessa data |

---

## 10. Decisões que esperam o autor

Os números são estáveis para referência nas tarefas. **Todas as decisões abaixo continuam abertas nesta revisão**; recomendações não substituem a resposta do autor. Uma decisão registrada no GDD ou em ADR deixa de ser pergunta nas próximas sessões.

| # | Decisão | Trava | O que o GDD ou o repositório já dizem |
|---|---|---|---|
| 1 | **Como os tempos do GDD se leem fora do ritmo Normal.** Carta a cada "8 h reais" e que expira em "24 h reais"; troca de ofício por "2 h"; fome de "12 h"; festival de "1 dia real"; lobos no "dia 2" | V2C-T3, V2C-T4, V2D-T1, V2E-T3 | §4.2: "todos os valores deste documento estão no ritmo Normal" e o motor roda em tempo de jogo. Lido assim, tudo escala com o ritmo; mas a §7.1 escreve "reais" de propósito na expiração das cartas |
| 2 | **Quais ritmos o jogador pode escolher.** | V2B-T3 | §4.2 dá Normal (1), Rápido (2) e Tranquilo (0,5). A produção cria partidas em 3× (ADR 0011), que não está nessa lista |
| 3 | **Como a v0.2 chega à produção.** Cada push no `main` é implantado; uma v0.2 pela metade (dificuldade que ainda não muda nada, caps sem Celeiro) apareceria para quem joga | Fase B em diante | O `CLAUDE.md` pede `main` sempre verde e branch para tarefas `L`; nada diz sobre esconder uma versão inteira. Opções: branch longa da v0.2, ligar as mecânicas por configuração do servidor, ou aceitar que a produção é o ambiente de teste |
| 4 | **O que acontece com as partidas da v0.1 quando o estado mudar.** Migrar (e com que estoque, se passar do cap) ou arquivar e começar de novo | V2B-T1, V2C-T2 | §15.4 pede que estados antigos carreguem e migrem; não fala do estoque acima do cap |
| 5 | **Balanceamento do ritmo 3×** (as três perguntas de V2A-T2.3) | V2A-T2, V2B-T4 | §5.5, §6.3, §15.2 |
| 6 | **Mercado e caravanas já na v0.2?** | Fase C | §17.2 lista como questão em aberto; a tabela da §16 os põe na v0.3 |
| 7 | **Quais cartas compõem a v0.2, qual é a cadeia de 3, e quem escreve.** | V2D-T2 | §7.1 e Apêndice B: 12 cartas de amostra, a maioria dependente de v0.3 ou v0.4 |
| 8 | **A carta roteirizada do dia 2** entrega um herói, que é da v0.3 | V2D-T2 | §2.2 e Apêndice B a descrevem; §16.2 põe o critério na v0.3 |
| 9 | **Opção "melhor" e "pior" de cada carta**, para Camponês e Rei de Ferro | V2D-T1 | §12.1; a estrutura da §7.2 só tem `isDefault` |
| 10 | **Lobos:** instante exato, quanto levam, o que é um aldeão ferido, e se as incursões por Ameaça entram na v0.2 | V2E-T3 | §8.2 ("até 15%", "ferem 1 aldeão"); tag "`[v0.2 lobos]` `[v0.4 completo]`" |
| 11 | **Ameaça sem como cair:** limpar um tile e repelir incursões dependem de mecânicas de outras versões | V2E-T1 | §8.2 |
| 12 | **Objetivos 5 a 15 na v0.2:** quais entram | V2E-T4 | §12.2; só 5, 6 e 9 dependem só da v0.2 |
| 13 | **Lenha e postos por edifício:** as regras da §4.1 e da §5.4 que não têm todos os números | V2C-T1, V2C-T3 | Perguntas nas tarefas |
| 14 | **Itens de operação pendentes desde a Fase 4:** destino externo dos backups, cópia do segredo, canal de avisos | V2A-T1.3, V2B-T1 | [architecture.md §6.3](architecture.md) |
| 15 | **Os oito pontos do ADR 0012** (página de apresentação) e se ela entra na mensagem do playtest | V2A-T1.6 | [ADR 0012](decisions/0012-pagina-de-apresentacao.md) |
| 16 | **Ligar o vínculo GitHub** (registrar o OAuth App) ou mantê-lo desligado na v0.2 | Nenhuma tarefa | ADR 0008, ponto 2 |
| 17 | **Contrato dos caps e métrica de desperdício:** limite inicial versus edifício, ganhos/cancelamentos, estoque herdado, alcance dos custos e significado das 8 h | V2C-T2, V2C-T6, V2F-T1 | §5.1: ouro sem cap; §5.5: excedente perdido; §15.2 fala em “acima do cap”, algo impossível após limitar o estoque |
| 18 | **Ordem e automações:** fila bloqueada, gastos simultâneos, pausa/retomada do Conselho, roteiro com duas pendências, desempate no vencimento e opção padrão impagável | V2C-T5, V2D-T1 | §6.3 e §7.1 não fecham esses casos; a ordem afeta o resultado offline |
| 19 | **Recuperação e moral:** combinar fórmula diária e penalidade por fome, perdas simultâneas de aldeões, piso populacional e tratamento de feridos | V2C-T4, V2E-T3 | §5.6/§5.7 podem acumular fome, frio, moral e abandono; §1.1/§15.1 prometem ausência sem castigo e recuperação, mas falta definir o limite |
| 20 | **Virada de ano na v0.2:** repetição de cartas e ataques, flags de cadeia, efeitos temporários e progresso | V2D-T2, V2E-T3 | Cartas comuns são anuais; o MVP já avança por vários anos. Legado e desfecho de cerco pertencem a versões futuras |
| 21 | **Quais propostas da §12 entram na entrega:** melhorias de apresentação, lote de cartas e eventual proteção nova | Tarefa indicada em cada proposta | Ideias desta revisão; não são funcionalidades implementadas nem regras aprovadas |

### 10.1 Recomendações para fechar as decisões

Estas são **propostas para revisão do autor**. O agente pode preparar cenários e protótipos locais para compará-las; não deve converter a coluna abaixo em regra de produção por conta própria.

| Decisões | Recomendação | Motivo e consequência a validar |
|---|---|---|
| 1, 2 | Separar velocidade do mundo de tempo disponível para uma decisão humana: manter uma janela real confortável para responder ao Conselho e avaliar a cadência com 1–2 visitas/dia. Preservar o 3× das partidas existentes; avaliar oferecê-lo explicitamente junto dos ritmos do GDD | No 3×, 8 h de jogo viram 2 h 40 min reais e 24 h viram 8 h. Se tudo escalar, cartas podem vencer durante uma noite. Decidir os prazos exige atualizar §4.2/§7.1 e os testes; não corrigir só o texto da UI |
| 3 | Desenvolver a v0.2 em branch de versão com demonstração isolada; publicar uma entrega coerente quando validada | Evita mostrar dificuldade sem efeito ou cap sem ferramenta de planejamento. O ambiente de prévia e a publicação precisam de autorização; não criar infraestrutura nesta revisão |
| 4 | Preferir preservar os feudos por migração, com fronteira temporal explícita e aviso do que muda | Arquivar/recomeçar é alternativa se o autor preferir. Estoque herdado acima do cap precisa de política própria; conservar, converter ou cortar são escolhas diferentes, nenhuma pode ocorrer silenciosamente |
| 5, 17 | Entregar armazenamento junto de automação e auditar todo caminho de melhoria; medir tempo efetivo de descarte e quantidade perdida, além da população | Cap sozinho troca excesso guardado por excesso perdido. A interpretação sugerida das 8 h é período contínuo desperdiçando produção, no relógio aprovado; isso corrige a métrica, não autoriza mudar capacidades |
| 6 | Manter Mercado/caravanas na v0.3 e avaliar primeiro as saídas já previstas em obras e Conselho | Evita criar preço, comércio e viagens para resolver uma hipótese ainda não testada. Reavaliar com evidência do simulador e do playtest |
| 7, 8 | Prototipar um lote com três cadeias curtas e dilemas sazonais (§12.2); manter a carta do primeiro herói para v0.3 | A meta final de 60 cartas permanece até revisão explícita. Quantidade não substitui variedade: medir elegibilidade e caminhos efetivamente vistos |
| 9, 18 | Marcar resolução automática editorialmente por dificuldade e garantir uma alternativa executável sem pagamento | “Melhor/pior” é ambíguo quando recursos e moral mudam. Se optar por seleção contextual, especificar e testar o critério no motor; não adivinhar utilidade no cliente |
| 10, 11 | Fechar primeiro uma incursão roteirizada compreensível, com aviso e proteção; comparar antes de habilitar recorrência por Ameaça | Com um covil ativo, +5 por dia de jogo leva a pressão rapidamente para cima no 3×. A regra de redução e a frequência precisam funcionar sem exército/expedições; qualquer redução de escopo é decisão explícita, não omissão |
| 12 | Preservar IDs 1–4 e desbloquear somente objetivos alcançáveis de Torre, Conselho e Paliçada, sem interromper a sequência por herói ausente | Números de exibição podem mudar; progresso persistido não. Objetivos sazonais adicionais só entram como proposta aprovada |
| 13 | Usar coortes para adaptação e declarar o critério de ocupação diária; em mudanças sazonais, preferir uma regra que a previsão consiga explicar | Confirmar postos e como contar metade ocupada. “50% mais lenta” precisa dizer se duração é ×1,5 ou velocidade ×0,5; testar uma obra que atravessa a virada |
| 14, 15, 16 | Resolver operação antes de expor migração real; manter GitHub desligado até pedido específico; revisar a landing com o que for entregue | Protege acesso às partidas e evita prometer recurso não conferido; não ampliar esta versão com OAuth real sem necessidade |
| 19 | Prototipar um piso de sobrevivência ou uma recuperação excepcional, visível e sem prêmio repetível; escolher apenas um se os cenários provarem necessidade | É mudança de regra, não correção técnica. Comparar com recuperação pelas regras atuais e respeitar a diferença de Rei de Ferro; ver IDEIA-06 |
| 20 | Preservar obras, recursos e efeitos em curso na virada; reiniciar apenas contadores anuais declarados; não repetir roteiro do primeiro ano por acidente | Cadência e flags de cadeia precisam de política explícita para que a história não se apague nem dobre recompensas |
| 21 | Priorizar explicações, Relatório e poucas histórias completas antes de adicionar outra moeda, árvore de habilidades ou sistema de combate | As habilidades de heróis já têm lugar na v0.3. Esta versão aprofunda o feudo e suas decisões |

### 10.2 Fechar em lotes, sem travar o planejamento inteiro

1. **Antes da Fase B:** decisões 2, 3, 4 e 5; contrato de tempo da decisão 1 suficiente para a arquitetura. Revisar operação da decisão 14.
2. **Antes de cada tarefa de C:** decisões 13, 17, 18 (filas) e 19 conforme a dependência. Não esperar aprovar todo o catálogo para construir a fundação.
3. **Antes de D:** decisões 1, 7, 8, 9, 18 (Conselho), 20 e propostas narrativas da 21.
4. **Antes de E:** decisões 10, 11, 12, 19 e 20 aplicadas aos lobos.
5. **Antes da divulgação/release:** pontos da landing, suporte e política de migração conferidos no produto final.

Para cada decisão registrar **resposta, data, alternativa descartada, razão, tarefa afetada e referência ao GDD/ADR**. Escolhas novas de regra vão ao ADR e ao GDD antes do código. Não preencher respostas do autor por suposição, nem pedir novamente o que já estiver resolvido.


---

## 11. Registro de execução

Preencher ao fechar cada tarefa.

| Tarefa | Data | Commit | Sessões | O que foi feito e desvios | O que não foi verificado |
|---|---|---|---|---|---|
| V2A-T1 | | | | | |
| V2A-T2 | | | | | |
| V2B-T1 | | | | | |
| V2B-T2 | | | | | |
| V2B-T3 | | | | | |
| V2B-T4 | | | | | |
| V2B-T5 | | | | | |
| V2C-T1 | | | | | |
| V2C-T2 | | | | | |
| V2C-T3 | | | | | |
| V2C-T4 | | | | | |
| V2C-T5 | | | | | |
| V2C-T6 | | | | | |
| V2D-T1 | | | | | |
| V2D-T2 | | | | | |
| V2D-T3 | | | | | |
| V2D-T4 | | | | | |
| V2E-T1 | | | | | |
| V2E-T2 | | | | | |
| V2E-T3 | | | | | |
| V2E-T4 | | | | | |
| V2E-T5 | | | | | |
| V2F-T1 | | | | | |
| V2F-T2 | | | | | |
| V2F-T3 | | | | | |
| V2F-T4 | | | | | |
| V2F-T5 | | | | | |


---

## 12. Propostas de experiência e conteúdo

**Estado desta seção: propostas desta revisão, para a decisão 21.** São ideias de design e exemplos editoriais, não regras aprovadas. Nenhum número daqui deve ser copiado para `content` sem balanceamento e registro da decisão. As tarefas anteriores continuam válidas se uma proposta for recusada.

### 12.1 Ideias com propósito, custo e prova de diversão

| ID | Ideia | O que muda para o jogador | Encaixe e limite | Como avaliar |
|---|---|---|---|---|
| IDEIA-01 | **“Antes de partir” na aba Hoje** | Um resumo de comida/lenha, estoques perto do limite, obra automática e decisões que vencerão | V2C-T2/C5 e V2D-T3; composição de informações autoritativas já disponíveis. Não joga sozinho nem adiciona bonificação por sair | Em uma sessão curta, a pessoa consegue dizer se deixou o feudo preparado |
| IDEIA-02 | **Aviso de mudança de estação** | “O inverno se aproxima” acompanhado das taxas que mudarão e de uma ação possível | V2C-T1; prazo e comparação calculados no motor. Sem prever RNG ou prometer proteção total | A pessoa faz uma preparação antes da primeira perda e explica por quê |
| IDEIA-03 | **“Sua escolha voltou” na Crônica** | A continuação de uma carta lembra a decisão anterior e mostra sua consequência | V2D-T2/D3; ligações entre eventos, sem novo recurso de reputação e sem revelar segredo antes da hora | Quem volta reconhece a história sem reler dezenas de entradas |
| IDEIA-04 | **Marcos de preparação** | Objetivos curtos como ampliar a despensa, deixar uma obra planejada e preparar a Paliçada | V2E-T4; objetivos alcançáveis, até três ativos, sem sequência diária obrigatória nem bônus por login | O próximo objetivo ensina uma ferramenta útil, em vez de pedir cliques repetidos |
| IDEIA-05 | **Retorno em três blocos** | “O feudo prosperou”, “O que exigiu um preço”, “Você ainda pode decidir” | V2D-T3/E3; apresentação de eventos e escolhas pendentes. Sem renomear perda de recurso como vitória | A pessoa entende o saldo e encontra uma ação em até uma leitura do resumo |
| IDEIA-06 | **Um caminho de recuperação** | Depois de uma crise, há uma forma explícita de voltar a produzir | V2C-T4/E3; testar primeiro regras existentes. Piso de população, ajuda excepcional ou proteção temporária são alternativas **mutuamente avaliadas**, não um pacote aprovado | Recuperar é possível sem reiniciar; provocar a crise repetidamente não gera ganho líquido |
| IDEIA-07 | **Identidade pelas escolhas** | Uma cadeia lembra se o senhor compartilhou reservas, manteve uma promessa ou preferiu cautela | V2D-T2; flags narrativas de escopo limitado e frases diferentes, sem árvore permanente de personalidade ou nova moeda | Duas escolhas geram relatos distintos e coerentes, sem exigir dois motores diferentes |

**Prioridade sugerida:** IDEIA-01, 03 e 05 aproveitam a base existente e ajudam diretamente a entender as novas mecânicas. IDEIA-02 e 04 acompanham estações e objetivos. IDEIA-06 só deve virar regra se os testes mostrarem necessidade. IDEIA-07 deve nascer em poucas cadeias, sem transformar o catálogo em centenas de combinações.

### 12.2 Primeiro lote para experimentar o Conselho

**Lote de validação proposto:** 3 cadeias de 3 cartas (9) + 12 cartas independentes (21 modelos ao todo). Serve para testar narrativa, elegibilidade e interface. **Não substitui a meta final de 60 cartas, 5 cadeias e 6 roteirizadas do GDD.** Se o autor preferir lançar uma quantidade menor, registrar a redução antes de alterar o critério de V2D-T2.

As três cadeias usam somente recursos, edifícios, moral, flags e efeitos adiados da v0.2:

| Cadeia proposta | Começo → escolha intermediária → desfecho | Trade-off central | Cuidados |
|---|---|---|---|
| **O Celeiro Comum** | Pedir madeira emprestada às reservas → decidir quem ajuda a repor os mantimentos → devolver o que foi guardado | Compartilhar agora ou conservar margem para obras/inverno | Não cria um segundo estoque secreto; todas as transferências seguem o cap normal |
| **A Ponte do Degelo** | Moradores pedem material → o trabalho encontra um obstáculo → a passagem volta a servir à vila | Gastar madeira, contratar ajuda com ouro ou adiar | Sem abrir mapa, rota comercial, aldeões nomeados ou produção permanente nova |
| **A Promessa da Paliçada** | Aldeões pedem proteção → o prazo se aproxima → reconhecer promessa cumprida ou explicar o atraso | Comprometer recursos cedo ou evitar uma promessa arriscada | Usa construção já existente; não concede proteção grátis nem dispara combate humano |

Cada cadeia precisa ter saída para **aceitar, recusar e expirar**, ainda que algumas terminem mais cedo. Uma decisão não pode gerar uma cobrança impossível e bloquear todas as cartas futuras. Continuação não pode depender só de sorte entre dezenas de cartas: sua elegibilidade, prioridade e prazo entram na decisão 18.

**Exemplo editorial completo — “O Celeiro Comum” (proposta para protótipo):**

1. **Tábuas para as reservas** — elegível com Celeiro construído, fora de crise imediata, uma vez por ano.
   > As prateleiras do celeiro cederam com a última carga. Os moradores propõem repartir o trabalho antes que a próxima colheita chegue. A madeira usada aqui fará falta nas obras do salão.

   | Opção | Efeito proposto | Continuação |
   |---|---|---|
   | Ceder 40 madeira | −40 madeira; +5 moral por 1 dia de jogo | Marca `common_granary_supported`; segunda carta na próxima janela definida |
   | Pagar pelo conserto | −30 ouro; +5 moral pela mesma duração | Mesma continuidade, com frase lembrando a escolha |
   | Conservar as reservas | Sem custo; nenhum prêmio oculto | Encerra este ramo com uma frase de Crônica |

2. **A vez de repartir** — continuação de uma ajuda, com prazo fixado ao resolver a primeira carta.
   > O conserto ficou pronto. Algumas famílias pedem uma pequena refeição em comum; outras preferem guardar cada saco para o frio. O conselho espera saber qual exemplo o senhor quer dar.

   | Opção | Efeito proposto | Continuação |
   |---|---|---|
   | Partilhar 30 comida | −30 comida; +10 moral por 1 dia de jogo | Marca `common_granary_shared` |
   | Guardar para o inverno | Sem custo; conserva mantimentos | Marca `common_granary_reserved` |

3. **O que ficou da escolha** — desfecho, alcançável nos dois ramos; o texto lembra o modo de financiar o conserto.
   > As prateleiras resistiram. Na mesa do conselho, a conversa retorna à decisão sobre os mantimentos. Alguns lembram a refeição repartida; outros, a prudência de guardar.

   Se houve partilha, a abertura menciona a mesa comum; se houve reserva, menciona o saco que não precisou ser aberto. O jogador escolhe **Receber a contribuição** (+20 comida, limitada pelo cap, com descarte explicado) ou **Deixar com as famílias** (+5 moral por 1 dia de jogo). A cadeia encerra suas flags transitórias e registra o desfecho.

**Antes de implementar este exemplo:** avaliar custos e benefícios em todas as estações/ritmos, definir expiração e opção automática para cada dificuldade e conferir se o ramo “sem custo” domina as alternativas. Durações acima são **hipóteses em dias de jogo**, não a resposta à decisão 1. Os reparos descritos são ficção da carta; não mudam capacidade nem adicionam dano estrutural ao Celeiro. Não duplicar o festival do GDD com uma segunda fonte permanente de moral.

**Doze cartas independentes sugeridas para o lote:**

| Tema | Escolha que deve provocar | Sistemas usados |
|---|---|---|
| Sementes para o próximo campo | Pagar comida agora ou ouro para poupar as reservas | Recursos e efeito adiado |
| Lenha ainda úmida | Investir ouro para conservar madeira ou aceitar um custo maior de material | Recursos; sem recurso “lenha seca” novo |
| A refeição dos pedreiros | Gastar comida para elevar o ânimo ou manter o estoque | Recursos/moral temporária |
| Um teto antes do frio | Prometer Habitações em prazo explícito ou recusar o compromisso | Flag, edifício e moral |
| A colheita de todos | Celebrar ou guardar para o inverno | Adaptar Festival da Colheita do GDD após curadoria |
| O poço entulhado | Usar pedra ou ouro para resolver uma demanda da vila | Recursos, consequência narrada |
| A serraria e o descanso | Consumir reservas para aliviar o trabalho ou conservar material | Recursos/moral; sem bônus de produção não modelado |
| Mais bocas à mesa | Acolher com vagas ou ajudar com provisões | Adaptar Refugiados sem Mestre/herói futuro; chegada e cap habitacional definidos |
| Vigília entre vizinhos | Atender a um pedido da vila ou guardar recursos para a Torre | Recursos e moral; não substitui a Torre nem cria defesa nova |
| A mesa dos aprendizes | Financiar aprendizado comunitário ou priorizar abastecimento | Narrativa/moral; sem Mestre ou XP individual |
| O celeiro quase cheio | Compartilhar parte da comida ou preservar o que ainda cabe | Recursos/moral; sem venda ou Mercado antecipado |
| A notícia da primavera | Acolher a mudança com uma pequena festa ou conservar ouro | Moral temporária e recursos |

Esses temas ainda não são cartas prontas: V2D-T2 escreve e aprova custos, elegibilidade, riscos e textos de cada opção. Não contar o título como conteúdo concluído.

### 12.3 Ficha obrigatória de uma carta pronta

Usar no inventário de conteúdo e refletir no schema que for implementado:

- ID do modelo, versão, estação/estágio elegível, repetição e dependências.
- Texto da situação, 2–3 opções com verbos e pistas de risco; sem requisito de versão futura.
- Custos e efeitos conhecidos, unidade de cada duração, efeito oculto com pista e momento de revelação.
- Opção automática por dificuldade, condição de execução e alternativa quando faltar recurso.
- Flags produzidas/consumidas e evento de continuação; condição de encerramento e comportamento na virada de ano.
- Frases de Crônica para escolha, expiração, efeito posterior e conclusão.
- Ao menos um cenário em que cada opção faça sentido e um em que seja ruim; teste de cada ramo.
- Estado da curadoria: rascunho → cenário validado → aprovado → implementado → observado no playtest.

### 12.4 Guardar para as próximas versões

Heróis e habilidades de classe, equipamentos, expedições e Mestres ficam na v0.3; formações e cerco, na v0.4; mapa/Legado, na v0.5; Academia, na v0.6. Esta revisão não antecipa essas mecânicas para “dar mais conteúdo”.

Evitar acrescentar agora moedas de prestígio, tarefas diárias obrigatórias, prêmios por login consecutivo ou coleta por clique. Não resolvem as perguntas atuais sobre escolhas, preparação e consequências, e aumentam o custo de balanceamento.

---

## 13. Resultado da revisão documental

Revisão de 2026-10-01 sobre o roadmap documental 0.1, GDD 0.6 e a base atual de conteúdo, motor, protocolo, servidor, app e simulador. **Nenhuma alteração de regra foi implementada.**

| Achado | Complemento/correção nesta revisão |
|---|---|
| Fases B–F descreviam intenção, mas não os passos de implementação | Todas as 27 tarefas agora têm subtarefas; caminhos e entregáveis por tarefa; verificação comum e cenários integrados |
| IDs duplicados em V2A-T1 e tabela de classificação deslocada | IDs únicos; classificação junto da consolidação; operação separada da observação |
| Reinício deliberado previsto no playtest congelado | Ensaio antes/depois, sem contaminar a janela; incidente real fica registrado |
| “Recurso acima do cap” não mede excesso depois de limitar estoque; ouro não tem cap | Escopo do cap explícito e decisão 17 para tempo/quantidade desperdiçada |
| Capacidade pode impedir comprar a ampliação que resolve o próprio limite | Auditoria de alcançabilidade por nível e dificuldade, incluindo a segunda fila |
| Ritmo 3× pode transformar escolhas diárias em cobranças durante a noite | Contrato de relógios, matriz por perfil e decisão sobre janela de resposta humana |
| Frio, fome, moral e ferimentos podem compor uma espiral sem recuperação | Cenário integrado, revisão da fórmula e proposta de recuperação sujeita à decisão |
| Conselho não fechava pausa, prioridade, expiração impagável e virada de ano | Decisões 18/20 e testes de fronteira, concorrência e catálogo vazio |
| Critérios do GDD não cobriam toda a experiência | Jornada, marcos jogáveis, matriz adicional e sinais de diversão observáveis |
| Prova de 48 h não alcança o inverno em todos os ritmos | Separação entre observação natural e cenário guiado de um ano/virada |
| Migração poderia aplicar regras novas à ausência antiga | Fronteira temporal, compatibilidade de cache/protocolo/recibo e ensaio de reversão |
| Faltavam propostas concretas de narrativa para a versão | Lote de validação, três cadeias, exemplo escrito e ficha de conteúdo; meta final do GDD preservada |

**Próximo passo de execução:** V2A-T1, conforme o fluxo vigente. As decisões e os protótipos documentais podem ser preparados enquanto a observação acontece. Começar uma mecânica posterior, alterar o escopo ou publicar continua sendo uma ação separada desta revisão.
