<div align="center">

# Lords of the Guild

**Um feudo para governar nas pausas do café. O mundo continua andando com a aba fechada.**

[![CI](https://github.com/gustavopals/pals-vscode-game/actions/workflows/ci.yml/badge.svg)](https://github.com/gustavopals/pals-vscode-game/actions/workflows/ci.yml)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Node.js 22](https://img.shields.io/badge/Node.js-22-417E38?style=flat-square&logo=nodedotjs&logoColor=white)
![Status: MVP no ar](https://img.shields.io/badge/status-MVP_no_ar-C19A55?style=flat-square)
![Licença: MIT](https://img.shields.io/badge/licen%C3%A7a-MIT-6eaf96?style=flat-square)

[O jogo](#o-jogo) · [Jogue](#jogue) · [Simulador](#experimente) · [Engenharia](#engenharia) · [Roadmap](#roadmap) · [Privacidade](#privacidade) · [Documentação](#documentacao)

</div>

![Arte conceitual de Pedra Alta: um castelo e sua vila entre a luz dourada do outono e as montanhas cobertas de neve.](docs/assets/readme/hero.png)

<a id="o-jogo"></a>

## Seu próximo reino cabe em uma aba do navegador

**Lords of the Guild** é um jogo medieval de estratégia e gerenciamento assíncrono, jogado no navegador, em uma página com a aparência de um editor de código. Você assume Pedra Alta, distribui o trabalho dos aldeões, melhora edifícios e decide como transformar uma pequena vila em um feudo que não passe fome.

A proposta é simples: sessões de **2 a 10 minutos**, decisões que continuam produzindo efeitos durante sua ausência e uma Crônica que conta a história do seu reino quando você volta.

> **Já dá para jogar:** o MVP (v0.1) está no ar em **[lords.palsincomehub.com](https://lords.palsincomehub.com)**. Motor de economia, simulador local, API online e app web com aparência de editor ([ADR 0008](docs/decisions/0008-cliente-web-com-aparencia-de-editor.md)) estão implementados, com testes automatizados, inclusive em navegador real. As imagens deste README continuam sendo **artes conceituais**, criadas com IA para apresentar o universo do jogo: não são capturas da interface.

### Quatro estações. Uma história para contar.

![Arte conceitual da mesma vila em quatro estações: primavera verde, verão dourado, outono acobreado e inverno nevado.](docs/assets/readme/seasons.png)

| 🌱 Primavera | ☀️ Verão | 🍂 Outono | ❄️ Inverno |
| :---: | :---: | :---: | :---: |
| Construir e crescer | Explorar com a Guilda | Abastecer e preparar | Resistir ao cerco |

Esse é o ciclo previsto para a evolução do jogo. O MVP implementa economia, obras, recrutamento, fome, objetivos e Crônica; o calendário já mostra a estação e o dia, mas **as estações ainda não têm efeito**. Efeitos sazonais, cartas do Conselho, heróis, exército e mapa são de versões futuras.

<a id="jogue"></a>

## Jogue agora, sem instalar nada

1. Abra **[lords.palsincomehub.com](https://lords.palsincomehub.com)**.
2. Escolha o seu nome e o nome do feudo e clique em **Jogar agora**. Não há e-mail, senha nem formulário.
3. Ponha os aldeões para trabalhar, comece uma obra e feche a aba. O servidor continua a conta; quando você voltar depois de algumas horas, o Relatório de Retorno diz o que aconteceu.

O que vale saber antes:

- **A interface é uma bancada de editor.** Barra de atividades, árvore lateral, abas, barra de status e paleta de comandos (`F1` ou `Ctrl+K`). Dá para jogar inteiro pelo teclado; há temas claro, escuro e de alto contraste.
- **O ritmo é 3×.** Uma hora real são três horas de jogo: o dia de jogo dura 40 minutos reais e o ano, 56 horas ([ADR 0011](docs/decisions/0011-ritmo-3x-no-mvp.md)). Prazos e taxas aparecem sempre em tempo real. A comida também acaba com a aba fechada.
- **A conta mora neste navegador.** Ela é anônima e fica no armazenamento do site: limpar os dados de navegação apaga o acesso. Para jogar em outro navegador ou outra máquina, gere um **Código do Reino** (paleta: "Lords: Conta: gerar Código do Reino") e guarde-o; no outro navegador, use "Usar Código do Reino", nas boas-vindas,.
- **O vínculo com o GitHub está desligado na v0.1.** O código existe, mas só foi testado com um GitHub simulado; por isso o app não mostra esses botões.
- **Sem conexão**, o app mostra o último estado conhecido em modo leitura e volta sozinho quando o servidor responde. Nenhuma ordem fica guardada para depois.
- **Testado em Chromium.** Firefox, Safari e navegadores de celular ainda não foram conferidos.

<a id="experimente"></a>

## Veja uma semana acontecer em segundos

O simulador permite conhecer as regras do jogo **sem Docker, servidor ou navegador**. Um bot econômico administra o feudo, e o motor calcula os acontecimentos entre as sessões.

Você precisa de **Node.js 22.12+** e **pnpm 9.15.9**, fixado no projeto. Com `nvm` e Corepack disponíveis:

```bash
git clone https://github.com/gustavopals/pals-vscode-game.git
cd pals-vscode-game
nvm use
corepack enable
pnpm install --frozen-lockfile
pnpm verify
```

Simule sete dias, com duas visitas ao feudo por dia:

```bash
pnpm -s sim -- --seed pedra-alta-golden --days 7 --strategy economico --sessions-per-day 2 > semana.csv
```

O terminal mostra o resumo da partida; `semana.csv` recebe **168 retratos horários** da economia, população e construções. A mesma semente e as mesmas opções reproduzem o mesmo resultado na mesma versão do motor e do conteúdo.

O simulador roda no **ritmo Normal do GDD**, em que sete dias reais são um ano de jogo: é nele que o balanceamento é definido. No servidor do MVP, com o ritmo 3×, esse mesmo ano passa em 56 horas.

Exemplo de resultado dessa simulação:

```text
População: 26 de 35 vagas
Níveis: townHall 3, farm 4, lumberMill 3, quarry 3, goldMine 3, housing 4
Estoque: food 162, wood 10017, stone 4190, gold 1637
Fome: nenhuma
Comandos: 55 aceitos, 0 recusados
```

Quer investigar o equilíbrio? Mude `--sessions-per-day` para `1` e compare os arquivos. O [guia do simulador](packages/sim-cli/README.md) explica o bot, cada coluna do CSV e as faixas verificadas nos testes.

<a id="engenharia"></a>

## Por trás do reino

O desafio técnico é fazer o tempo passar de forma consistente: uma hora calculada de uma vez precisa produzir o mesmo estado e os mesmos eventos que uma hora dividida em várias visitas.

| Decisão | Como aparece no código |
| --- | --- |
| **Motor puro e determinístico** | Estado, comandos e tempo explícitos; sem rede, relógio do sistema ou dependência do navegador. [Contrato público](packages/engine/src/index.ts) e [testes de pureza](packages/engine/src/purity.test.ts). |
| **Economia sem deriva de arredondamento** | Recursos em unidades inteiras de milésimos, com acumuladores. [Implementação](packages/engine/src/economy.ts) e [testes de propriedades com fast-check](packages/engine/src/economy.property.test.ts). |
| **Balanceamento separado das regras** | Números e textos em `content`, validados por schemas; comportamento em `engine`. [Conteúdo](packages/content/src) e [testes de balanceamento](packages/sim-cli/src/balance.test.ts). |
| **Partidas reproduzíveis** | Cenário de sete dias e snapshots de referência ajudam a detectar mudanças de comportamento. [Teste de cenário](packages/engine/src/scenario.test.ts). |
| **Servidor autoritativo** | O cliente manda ordens e recebe uma visão pronta; nunca manda estado, relógio nem resultado. Toda ordem é idempotente por `commandId`. [Servidor](packages/server/README.md). |
| **Contratos documentados e verificados** | Autenticação, comandos idempotentes, cache e exclusão de conta têm decisões registradas e testes de integração contra PostgreSQL real. [ADRs](docs/decisions/README.md) · [arquitetura](docs/architecture.md). |

### Um núcleo, dois caminhos de execução

A arquitetura conecta o mesmo motor ao simulador e ao servidor. Tudo o que está no diagrama está implementado; o servidor e o app estão em produção.

```mermaid
flowchart LR
    subgraph local["Execução local"]
        Sim["Simulador CLI"] --> Engine["Motor determinístico"]
        Engine --> Content["Conteúdo e schemas"]
    end
    subgraph server["Servidor"]
        API["API · Fastify"] <--> DB[("PostgreSQL")]
    end
    subgraph client["Navegador"]
        Web["App web · Preact<br/>aparência de editor"] <--> SDK["SDK HTTP"]
    end
    SDK <--> API
    Sim -. "modo remoto" .-> API
    API --> Engine
    classDef ready fill:#173e37,stroke:#6eaf96,color:#fff
    class Sim,Engine,Content,API,DB,SDK,Web ready
```

O desenho completo, com a implantação, o caminho de um comando, o funcionamento do tempo e a lista de divergências em relação ao GDD, está em [docs/architecture.md](docs/architecture.md).

**Base atual:** TypeScript, pnpm workspaces, Zod, Fastify, PostgreSQL com Drizzle, Preact, Vite, Vitest, fast-check, Playwright (testes em navegador real), ESLint, Prettier, Docker, Caddy e workflows de GitHub Actions.

<details>
<summary><strong>Explore a organização do monorepo</strong></summary>

```text
packages/
  engine/       Regras puras, economia e avanço do tempo
  content/      Números, textos e schemas do jogo
  sim-cli/      Bot econômico, simulações, relatórios CSV e carga contra a API
  protocol/     Tipos e schemas zod da API /v1: comandos, visão, erros
  server/       Servidor autoritativo: contas, partidas, comandos, jobs e migrações
  client-sdk/   Cliente HTTP tipado, usado pelo app web e pelo simulador
  web/          App web em Preact: bancada com aparência de editor
deploy/         Dockerfile (API e app), Caddyfile, migrações, Compose de desenvolvimento
tests/          Cenários do servidor e testes em navegador (e2e)
docs/           Arquitetura, decisões (ADRs), roteiro manual e medição de desempenho
```

O ESLint impede que `engine`, `content` e `protocol` importem `fastify`, `pg` ou módulos do Node, preservando a independência do núcleo; o app web não importa o motor nem o servidor.

</details>

<details>
<summary><strong>Comandos e ambiente de desenvolvimento</strong></summary>

| Comando | O que faz |
| --- | --- |
| `pnpm verify` | Executa lint, checagem de tipos e testes unitários |
| `pnpm test` | Executa a suíte unitária com Vitest |
| `pnpm --filter @lotg/engine test` | Executa apenas os testes do motor |
| `pnpm typecheck` | Confere os tipos em todos os pacotes |
| `pnpm lint` / `pnpm format` | Verifica / aplica a formatação do código |
| `pnpm build` | Compila os pacotes que têm build (servidor e app web) |
| `pnpm dev:up` / `pnpm dev:down` | Sobe / encerra os bancos locais, preservando volumes |
| `pnpm dev:logs` | Acompanha os logs dos contêineres |
| `pnpm dev:api` | Sobe a API no host com recarga automática; aplica as migrações no arranque |
| `pnpm dev:web` | Sobe o app web em `http://localhost:5173`, com `/v1` repassado para a API |
| `pnpm db:migrate` | Aplica as migrações no banco de dev sem subir a API |
| `pnpm db:psql` | Abre o PostgreSQL de desenvolvimento |
| `pnpm test:integration` | Executa testes de integração com `TEST_DATABASE_URL` definido |
| `pnpm test:e2e` | Testes em Chromium contra a API real e o `db_test` (antes: `pnpm dev:up` e `pnpm exec playwright install chromium`) |
| `pnpm -s sim -- --remote http://localhost:3000 --bots 50 --minutes 2` | Bots contra a API, com p50 e p95 por endpoint ([resultados](docs/perf-v0.1.md)) |
| `pnpm secrets:gen` | Cria `deploy/.env` e gera segredos ausentes, preservando os existentes |
| `pnpm docker:build` / `pnpm docker:build:web` | Constrói a imagem de produção da API / do app web |

Para chegar ao jogo rodando na sua máquina, com Docker e Compose v2 instalados:

```bash
pnpm dev:up        # db (5432) e db_test (5433)
pnpm secrets:gen   # cria deploy/.env com os segredos de desenvolvimento
pnpm dev:api       # http://localhost:3000/v1/health (deixe rodando)
pnpm dev:web       # em outro terminal: http://localhost:5173
```

O [Compose de desenvolvimento](deploy/docker-compose.dev.yml) publica as portas somente em `127.0.0.1`:

| Serviço | Porta | Persistência |
| --- | --- | --- |
| `db` — banco `lotg`, usuário/senha `lotg` | 5432 | Volume `lotg_db_dev` |
| `db_test` — banco `lotg_test` | 5433 | `tmpfs`, descartado ao reiniciar |
| `pgweb` — ferramenta opcional | 8081 | Inspeção do banco |

```bash
docker compose -f deploy/docker-compose.dev.yml --profile tools up -d pgweb
```

A API roda no host durante o desenvolvimento ([ADR 0001](docs/decisions/0001-api-no-host-em-dev.md)). O perfil `full` sobe a mesma API na imagem de produção, na porta 3000:

```bash
docker compose -f deploy/docker-compose.dev.yml --profile full up -d
```

O app em desenvolvimento fala com a API pela própria origem ([como o app é organizado](packages/web/README.md)). A suíte de integração do servidor roda contra o `db_test`:

```bash
TEST_DATABASE_URL=postgres://lotg:lotg@localhost:5433/lotg_test pnpm test:integration
```

Configurações estão em [deploy/.env.example](deploy/.env.example). `GAME_TIME_SCALE` define o ritmo das partidas novas (padrão 3). `JWT_SECRET` e `RECOVERY_CODE_SECRET` são independentes; a rotação do segundo invalida os Códigos do Reino emitidos. No WSL2, mantenha o repositório no sistema de arquivos Linux. `docker compose down -v` apaga os volumes do banco.

Para atualizar snapshots de referência intencionalmente, use `UPDATE_GOLDEN=1 pnpm test` e revise o diff antes de commitar.

</details>

<details>
<summary><strong>Implantação</strong></summary>

A produção roda em um servidor com Coolify, em três recursos: PostgreSQL, a API (alvo `runtime` do `deploy/Dockerfile`) e o app (alvo `web`, um Caddy servindo arquivos estáticos). O proxy da plataforma cuida do TLS e manda `/v1` para a API e o resto para o app, na mesma origem ([ADR 0009](docs/decisions/0009-implantacao-no-coolify.md)).

O passo a passo para implantar do zero, atualizar, reverter, fazer backup e restaurar, com o registro dos ensaios já feitos, está em **[deploy/README.md](deploy/README.md)**. Nada é implantado sozinho a cada `push`: o deploy é um ato manual.

</details>

<a id="roadmap"></a>

## A jornada de Pedra Alta

| Etapa | Situação |
| --- | --- |
| **Fundação técnica** — monorepo, ferramentas, Docker e workflow de CI | Implementada |
| **Motor e playtest local** — economia, construção, população, objetivos e simulador | Implementados |
| **Servidor online · v0.1** — contas, API e persistência | Implementado |
| **Cliente · v0.1** — app web com aparência de editor ([ADR 0008](docs/decisions/0008-cliente-web-com-aparencia-de-editor.md)) | Implementado |
| **Implantação · v0.1** — servidor público, backup e operação ([ADR 0009](docs/decisions/0009-implantacao-no-coolify.md)) | No ar; backup fora do servidor pendente |
| **Fechamento · v0.1** — critérios de aceitação em produção, playtest, versão e release | Em andamento |
| **Estações e Conselho · v0.2** — decisões sazonais | Planejado |
| **Guilda · v0.3** — heróis e exploração | Planejado |
| **Guerra e Cerco · v0.4** — defesa do feudo no inverno | Planejado |
| **Mundo, legado e polimento · v0.5–v0.6** | Planejados |

O [roadmap do MVP](MVP-ROADMAP.md) detalha tarefas e critérios de aceite, e o [registro de mudanças](CHANGELOG.md) resume o que a v0.1 entrega e os seus limites. O [Game Design Document](GAME_DESIGN.md) apresenta a visão completa, incluindo a evolução futura para multiplayer.

<a id="privacidade"></a>

## Privacidade

> Texto aprovado pelo autor em 2026-10-01. Descreve o que o código faz hoje (GDD §14.14).

- **O que o servidor guarda.** O nome de exibição que você escolheu, o rótulo do navegador, as datas de acesso e os hashes das credenciais (nunca o token nem o Código do Reino em claro). O progresso do feudo, as ordens dadas e a Crônica ficam vinculados à conta. O identificador do GitHub só seria guardado com o vínculo, que está desligado na v0.1.
- **O que fica no navegador.** As credenciais da sessão, as preferências e o último estado do feudo (para o modo sem conexão), no armazenamento local do site. Limpar os dados de navegação os apaga; sem Código do Reino, isso também apaga o acesso à conta.
- **Exclusão.** Excluir a conta pelo app bloqueia o acesso na hora e não tem volta. Os dados saem do banco na primeira limpeza depois de sete dias; cópias de segurança podem guardá-los por até 14 dias depois de geradas.
- **Nada de terceiros.** O app não carrega anúncios, rastreadores nem scripts de outros sites; fala só com a própria origem, por HTTPS.

<a id="documentacao"></a>

## Conheça as escolhas do projeto

- **[Game Design Document](GAME_DESIGN.md)** — experiência, sistemas, regras e escopo de cada versão.
- **[Plano de execução](MVP-ROADMAP.md)** — entregas, dependências e verificações do MVP.
- **[Arquitetura](docs/architecture.md)** — o que foi construído, como o tempo funciona e as divergências aceitas em relação ao GDD.
- **[Decisões de arquitetura](docs/decisions/README.md)** — contexto e justificativas dos contratos técnicos.
- **[Implantação e operação](deploy/README.md)** — a instalação em produção, backup, reversão e ensaios.
- **[Guia do simulador](packages/sim-cli/README.md)** — rode partidas, leia os relatórios e investigue o balanceamento.
- **[Registro de mudanças](CHANGELOG.md)** — o que cada versão entrega.

## Licença

[MIT](LICENSE) © 2026 Gustavo Pals. Os ícones do app são os Codicons (CC BY 4.0). O jogo não é afiliado a nenhum editor de código.

---

<div align="center">

**Um projeto de [@gustavopals](https://github.com/gustavopals)**

Game design, simulação determinística e uma experiência pensada para o cotidiano de quem programa.

<sub>Ilustrações conceituais geradas com IA · <a href="docs/assets/readme/ARTWORK.md">Prompts e arquivos das artes</a></sub>

</div>
