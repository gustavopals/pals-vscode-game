# 0012 — Página de apresentação em domínio próprio

Data: 2026-10-01\
Estado: decidida pelo autor em 2026-10-01 (ter a página, dentro do monorepo, publicada pelo Coolify e com um botão para o jogo); implementada e no ar no mesmo dia; as escolhas da seção "Pontos a confirmar" são propostas\
Escopo: GDD §14.2 e §14.13; roadmap §1.2, §1.4, §1.5 e §9; ADR 0009

## Contexto

O endereço do jogo abre direto na bancada, com a tela de boas-vindas. Quem recebe o link em uma conversa não sabe o que é aquilo antes de entrar. O autor pediu uma página de apresentação "divertida e chamativa", com tema e letras próprios, que chame as pessoas para o jogo; pediu que ela ficasse neste monorepo, que o Coolify a publicasse e que tivesse um botão para o jogo.

Onde a página poderia ficar:

1. **Em domínio próprio, como mais um recurso do Coolify** (adotada).
2. Na mesma origem do jogo, em um caminho (`/conheca`). A página dividiria o `localStorage` com o jogo, onde ficam as credenciais; elas passariam a estar ao alcance de qualquer coisa que a página carregasse, e a política de conteúdo do app teria que valer para as duas.
3. Na raiz do domínio do jogo, com o jogo em outro endereço. Mudar a origem do jogo apaga as sessões e o cache de quem já joga, e mexe no que o [ADR 0009](0009-implantacao-no-coolify.md) decidiu.
4. Dentro do app, crescendo a tela de boas-vindas. O app tem a aparência sóbria de um editor de propósito; uma página chamativa ali contradiz o pilar 5 do GDD.

## Decisão

1. **Um pacote novo, `@lotg/landing`**: uma página estática, com HTML e CSS escritos à mão e um script pequeno, compilada pelo Vite. Não usa Preact, não importa nenhum pacote do jogo (o lint barra) e não fala com servidor nenhum. Só usa o que já era permitido: `vite` e `@types/node` em desenvolvimento, e `@lotg/content` nos testes.
2. **Domínio próprio e um quarto recurso no Coolify**, `lotg-landing`: o alvo `landing` do `deploy/Dockerfile`, com o mesmo Caddy do app servindo os arquivos na porta 80 ([`deploy/landing.Caddyfile`](../../deploy/landing.Caddyfile)). O jogo continua nos três recursos do ADR 0009 e não muda de endereço. Os alvos `web` e `landing` passam a sair de uma base comum (`static`), para a instalação do Caddy existir em um lugar só.
3. **O botão "Jogar agora" leva ao endereço do jogo**, na mesma aba. O endereço do jogo e o da própria página entram no build (`LOTG_GAME_URL` e `LOTG_LANDING_URL`), com os de produção como padrão.
4. **A página só diz do jogo o que o jogo diz de si.** Testes conferem as frases da Crônica citadas contra `@lotg/content` e os nomes dos edifícios, e barram as formas mais comuns de promessa de duração (ADR 0011), as viradas de dia (ADR 0007), preço, multijogador, GitHub e o nome "Visual Studio Code". Uma expressão regular não pega toda grafia: o resto é de quem edita. As pinturas aparecem rotuladas como arte conceitual gerada por IA; a imagem que abre a página é uma captura real do jogo, feita no ritmo de produção por um roteiro que pode ser repetido (`pnpm capture:landing`). O que ainda não existe fica em um parágrafo "No horizonte", sem data.
5. **Mesmas regras de navegador do app**: política de conteúdo estrita (aqui `default-src 'none'`), nenhum estilo ou script embutido, nada de terceiros, nenhuma medição de audiência, cor só em um arquivo e contraste conferido por teste.

O conceito ("Parece trabalho. É um feudo.") saiu de um painel: quatro propostas independentes e a do agente, avaliadas por três revisores com critérios diferentes. A do agente ficou em último, entre outras coisas por pôr a pintura como a outra face da tela do jogo. A vencedora mostra uma captura real lida de dois jeitos, e as pinturas só depois, com legenda.

## Pontos a confirmar

São escolhas que o pedido deixou em aberto. A página adota a opção da coluna "Adotado"; trocar qualquer uma é uma alteração localizada.

| # | Questão | Adotado | Alternativa |
|---|---|---|---|
| 1 | Endereço da página | `https://lordsoftheguild.palsincomehub.com`. O DNS curinga do domínio já aponta para o servidor | Qualquer outro: o domínio do recurso no Coolify, o padrão em `packages/landing/src/site.ts`, `LANDING_URL` em `.github/workflows/ci.yml` e em `health.yml` (um teste confere que os três batem) e a tabela de `deploy/README.md` |
| 2 | Letras | Grenze Gotisch (títulos) e Alegreya (texto), as duas sob a SIL Open Font License, com os arquivos dentro do repositório. A voz "de escritório" usa a letra de largura fixa do sistema | Outras famílias de licença aberta; nenhuma letra vem de fora |
| 3 | Título e tom | "Parece trabalho. É um feudo.", com humor seco sobre jogar no trabalho ("quem passa atrás da sua cadeira vê abas e uma barra de status", "O que você faz na pausa do café é assunto seu.") e o fecho "Vaga aberta: senhor ou senhora de Pedra Alta." | Um tom sem a piada do trabalho. Título e tagline são do autor |
| 4 | Artes do README na página | A pintura das estações, com a legenda "O pintor exagerou. Isto é arte conceitual de Pedra Alta, gerada por IA" | Página só com capturas do jogo |
| 5 | Capturas com números | As capturas mostram estoques, taxas e custos, porque são a tela do jogo. O texto da página não cita nenhum número de regra | Enquadrar as capturas para esconder os custos |
| 6 | Aviso para celular | Em tela estreita: "Feito para a tela do computador. No celular o jogo abre, mas ainda não foi testado." | Não dizer nada, ou conferir o jogo em celular antes |
| 7 | Monitor de saúde | O `health.yml` passa a consultar também a página | Monitorar só o jogo |
| 8 | GDD | §14.2 e §14.13 ganham uma linha cada, como correção de fato | Deixar o GDD só com o jogo |

## Consequências e verificação

- **Quatro recursos no Coolify.** O jogo continua sendo três; a página é o quarto e pode cair ou ser removida sem afetar o jogo. `deploy/README.md` descreve como criá-la.
- **Mais uma coisa para atualizar.** Nada avisa sozinho que uma captura ficou velha: o roteiro de capturas só roda à mão. Quando a tela do jogo mudar, é preciso rodá-lo; se a disposição mudou, ele falha e pede a revisão dos rótulos presos à captura. Quando o texto do jogo mudar, os testes da página apontam a frase que ficou para trás.
- **Peso.** Medido em Chromium: cerca de 350 kB em janelas de até 1400 px a 1×, cerca de 460 kB em telas mais largas ou de alta densidade (a pintura vem na versão de 2143 px, 246 kB) e 290 kB no celular. Quase tudo está em quatro arquivos: as duas fontes (84 kB), a captura do jogo (102 kB, ou 43 kB a estreita) e a pintura das estações. A pintura tem carregamento tardio, mas nas telas medidas o navegador a pede já na abertura.
- **Nome, ícone e créditos.** A página usa o nome "Lords of the Guild" como texto e o mesmo ícone do app; não cria logotipo. As capturas mostram os ícones do app (Codicons, CC BY 4.0), e o rodapé e `licencas.txt` dão o crédito.
- **Verificação.** `pnpm verify` (testes de unidade das páginas e das folhas de estilo); `pnpm test:e2e:landing` (Chromium, em tela de computador e de celular); `docker build --target landing` e `scripts/landing-smoke.sh`, na CI e contra a produção, para os cabeçalhos, o cache e a página de caminho errado.
