# Registro de mudanças

Todas as mudanças relevantes de Lords of the Guild ficam registradas aqui. O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e a numeração, o [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [0.1.0] — não lançada

"Fundação online": o MVP descrito no [GDD §16.1](GAME_DESIGN.md). O código está no `main` e o jogo está no ar em `https://lords.palsincomehub.com`, mas **a versão ainda não foi etiquetada nem publicada como release**: a tag `v0.1.0` e a release no GitHub são atos do autor. Também faltam a verificação dos 12 critérios de aceitação em produção e o playtest de 48 horas (roadmap, Fase 5).

### Adicionado

**Motor (`@lotg/engine`) e conteúdo (`@lotg/content`)**

- Estado inicial reproduzível de Pedra Alta a partir de uma semente.
- Quatro recursos (comida, madeira, pedra e ouro) com produção e consumo contínuos, em milésimos inteiros e com acumuladores: nenhuma conta usa ponto flutuante no estado.
- `advanceTo` por trechos da linha do tempo, com a invariante de divisão de intervalo testada por propriedade e sem tolerância: avançar de uma vez dá o mesmo estado e os mesmos eventos que avançar em partes.
- Seis edifícios (Salão do Senhor, Fazenda, Serraria, Pedreira, Mina de Ouro e Habitações) com níveis, custos e tempos vindos do conteúdo; uma obra ativa por vez, planejamento e cancelamento com devolução.
- Alocação de aldeões, recrutamento com fila, custo e limite habitacional.
- Fome determinística: começa no instante exato em que a comida acaba, reduz a produção e congela o recrutamento até a comida voltar.
- Calendário com ano, estação e dia. As estações ainda não têm efeito.
- Objetivos 1 a 4, com recompensa, e eventos emitidos já com a frase da Crônica.
- Comandos validados, com um código e uma frase em português para cada recusa.
- `deriveViewState`: tudo o que a interface mostra, com a explicação de cada número, em tempo real conforme o ritmo da partida.
- Números e textos de jogo em `@lotg/content`, validados por schemas zod.

**Servidor (`@lotg/server`), protocolo (`@lotg/protocol`) e SDK (`@lotg/client-sdk`)**

- API `/v1` em Fastify com PostgreSQL 16: contas, partidas, visão, comandos, eventos, Crônica, `GET /health` e `GET /version`.
- Conta anônima em um clique; sessões por navegador com JWT de 15 minutos e refresh rotativo com histórico completo (o reuso de um token antigo revoga a sessão); sair da máquina.
- Código do Reino para entrar em outro navegador, guardado só como HMAC-SHA256 com chave independente do JWT.
- Exclusão de conta em duas etapas: bloqueio imediato e remoção do banco pelo primeiro job depois de sete dias.
- Servidor autoritativo com avanço preguiçoso: leituras e comandos travam a partida e avançam o mundo até agora; um job avança as partidas paradas há mais de uma hora.
- Comandos idempotentes por `commandId`, com recibo completo: o reenvio devolve o status e o corpo originais; o mesmo identificador com outro conteúdo é recusado. Uma recusa do motor preserva o avanço do mundo.
- `GET /view` com ETag da representação completa.
- Ritmo por partida (`GAME_TIME_SCALE`, padrão 3): o dia de jogo dura 40 minutos reais e o ano, 56 horas ([ADR 0011](docs/decisions/0011-ritmo-3x-no-mvp.md)).
- Limites de taxa por sessão e por IP, validação zod de toda entrada, logs em JSON sem tokens nem códigos.
- Migrações SQL aplicadas no arranque, sob advisory lock.
- Schemas zod compartilhados entre servidor e cliente; um teste de tipos quebra a compilação se o protocolo e o motor divergirem.
- Cliente HTTP tipado, com renovação de sessão (uma por vez) e retentativas que reenviam a mesma ordem com o mesmo `commandId`.

**App web (`@lotg/web`)**

- Bancada com aparência de editor de código: barra de atividades, árvore lateral, abas, barra de status e paleta de comandos (`F1` ou `Ctrl+K`).
- Boas-vindas com dois campos e um clique (**Jogar agora**), sem e-mail, senha ou instalação.
- Abas Feudo, Hoje, Crônica (com download em Markdown), Preferências e Sobre.
- Temas escuro, claro e de alto contraste; navegação completa pelo teclado.
- Ciclo de atualização de 30 segundos (2 minutos em segundo plano), cache do último estado e modo sem conexão em leitura, com retorno automático.
- Relatório de Retorno ao abrir a página depois de 4 horas fora.
- Avisos no canto com limite por hora, "Silenciar 2h", modo discreto e, por opção do jogador, notificações do navegador com a aba em segundo plano.
- Várias abas dividindo a mesma sessão, com a renovação protegida por Web Locks.
- Lembrete "Proteja seu reino" 48 horas depois da primeira vez no navegador, para quem ainda não tem Código do Reino.
- Política de conteúdo estrita: só arquivos da própria origem, nenhum script ou estilo embutido, nada de terceiros.

**Simulador (`@lotg/sim-cli`)**

- Bot econômico que joga partidas inteiras só com o motor e gera um CSV com um retrato por hora; a mesma semente reproduz o mesmo arquivo.
- Modo remoto: bots contra uma API, com p50 e p95 por endpoint.

**Implantação e operação**

- Uma imagem para a API (alvo `runtime`, um único arquivo empacotado, sem `node_modules`) e outra para o app (alvo `web`, Caddy servindo arquivos estáticos com os cabeçalhos de segurança).
- Produção no Coolify em três recursos: banco, API e app na mesma origem, com o proxy da plataforma na borda ([ADR 0009](docs/decisions/0009-implantacao-no-coolify.md)).
- Backup diário do banco com retenção de 14 dias; restauração ensaiada em um banco descartável.
- Reversão da API para a imagem anterior ensaiada.
- Monitor de saúde externo (workflow `health.yml`) e consultas agregadas de operação.
- Procedimentos em [`deploy/README.md`](deploy/README.md).

**Testes**

- Testes unitários e de propriedade (fast-check) do motor, goldens do `ViewState`, da Crônica e de um cenário de sete dias, e teste de pureza da API pública.
- Faixas de balanceamento conferidas com o bot do simulador.
- Testes de integração do servidor contra PostgreSQL real, com relógio controlado, incluindo concorrência, idempotência, rotação de sessão e expurgo.
- Testes em Chromium real (`pnpm test:e2e`) contra a API e o banco de teste, com o app compilado e a política de conteúdo de produção.
- Workflow de CI com `verify`, integração, navegador e build das duas imagens.

**Projeto**

- Licença MIT.
- Decisões de arquitetura registradas em [`docs/decisions`](docs/decisions/README.md) e o desenho do que foi construído em [`docs/architecture.md`](docs/architecture.md).

### Divergências conscientes

O que a v0.1 faz diferente do desenho original do GDD, por decisão do autor. A lista completa, com o estado de cada item, está em [`docs/architecture.md` §6](docs/architecture.md).

- O cliente é um app web com aparência de editor, e não uma extensão do VS Code ([ADR 0008](docs/decisions/0008-cliente-web-com-aparencia-de-editor.md)). A extensão implementada antes foi removida.
- O ritmo é 3× e vem do servidor; o GDD previa ritmo fixo em 1 na v0.1. "Uma semana é um ano" não vale no MVP ([ADR 0011](docs/decisions/0011-ritmo-3x-no-mvp.md)).
- O vínculo com o GitHub fica desligado. O código existe e foi testado só com um GitHub simulado; quem troca de navegador usa o Código do Reino.
- A Crônica não traz as viradas de dia ([ADR 0007](docs/decisions/0007-cronica-sem-viradas-de-dia.md)).
- O objetivo 4 recompensa +50 ouro em vez de desbloquear edifícios que só existem na v0.2 ([ADR 0002](docs/decisions/0002-objetivo-4-v01.md)).
- O Código do Reino usa HMAC-SHA256 em vez de Argon2 ([ADR 0003](docs/decisions/0003-codigo-do-reino-hmac.md)).
- A produção roda no Coolify, e não em um VPS com Docker Compose ([ADR 0009](docs/decisions/0009-implantacao-no-coolify.md)).
- `GET /version` informa o que o servidor tem ligado ([ADR 0010](docs/decisions/0010-version-informa-o-que-esta-ligado.md)).
- "Reiniciar partida" é o comando "Nova partida", que arquiva o feudo atual.

### Limites conhecidos

- **Fora do escopo da v0.1:** efeitos de estação, cartas do Conselho, heróis, exército, mapa, mercado, Temporadas, interação entre jogadores e som.
- O jogador não escolhe dificuldade nem ritmo. A Hora da Vigília é guardada e ainda não muda nada no jogo.
- As partidas criadas antes do ritmo 3× continuam no ritmo 1; para o ritmo novo é preciso começar outra partida.
- Não existem `GET /catalog`, "Baixar cópia da partida (JSON)", gerador de números aleatórios (nenhuma regra sorteia) nem migração de estados entre versões (só existe a versão 1).
- O Relatório de Retorno só aparece ao abrir a página; uma aba deixada aberta não o recebe. Nada chega com a aba fechada.
- Uma conta anônima sem Código do Reino se perde se os dados do navegador forem apagados. Não há recuperação de conta excluída.
- O vínculo GitHub nunca foi testado com o GitHub real.
- Testado só em Chromium. Firefox, Safari, navegadores de celular e leitores de tela não foram conferidos; os passos manuais de [`docs/manual-test-v0.1.md`](docs/manual-test-v0.1.md) não foram executados.
- Os backups ficam no mesmo disco do banco. A reversão não foi ensaiada atravessando uma migração.
- O desempenho foi medido em uma máquina só, com partidas jovens; rajadas sincronizadas ficam acima da meta ([`docs/perf-v0.1.md`](docs/perf-v0.1.md)).
- O texto de privacidade do README e do app é provisório.
