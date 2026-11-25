# @lotg/landing

A página de apresentação do jogo: uma página estática, em domínio próprio, que diz o que é Lords of the Guild e leva ao jogo pelo botão **Jogar agora**. Decisão e motivos no [ADR 0012](../../docs/decisions/0012-pagina-de-apresentacao.md).

É HTML e CSS escritos à mão, com um script pequeno (dois arquivos, quarenta linhas ao todo). Não usa Preact, não importa nenhum pacote do jogo (o lint barra) e não fala com servidor nenhum. O único vínculo com o jogo é um teste que confere as frases citadas contra `@lotg/content`.

A página foi **refeita do zero em 2026-11-17**, a pedido do autor, com outro tema e outros textos: é o **almanaque** descrito abaixo. A anterior (o "códice" azul e ouro, com letra gótica e a piada do escritório) ficou no histórico do Git.

## Rodar

```bash
pnpm dev:landing                    # http://localhost:5174, com recarga automática
pnpm --filter @lotg/landing build   # packages/landing/dist, com hash no nome dos arquivos
pnpm docker:build:landing           # imagem com o Caddy servindo o dist na porta 80
```

Dois endereços entram no build ([`src/site.ts`](src/site.ts)): o do jogo, destino do botão, e o da própria página, usado na prévia que mensageiros e redes sociais mostram do link. Os de produção são o padrão; para outra instalação:

```bash
LOTG_GAME_URL=https://jogo.exemplo.com LOTG_LANDING_URL=https://exemplo.com pnpm --filter @lotg/landing build
docker build -f deploy/Dockerfile --target landing --build-arg LOTG_GAME_URL=… --build-arg LOTG_LANDING_URL=… .
```

No HTML eles aparecem como `%GAME_URL%` e `%SITE_URL%`; um marcador com outro nome derruba o build.

## Testar

```bash
pnpm --filter @lotg/landing test    # testes de unidade (sem navegador)
pnpm test:e2e:landing               # Chromium, a página compilada, em tela de computador e de celular
scripts/landing-smoke.sh <endereço> # a página servida pelo Caddy: cabeçalhos, cache e o 404
```

Os testes de unidade leem as páginas e as folhas de estilo como texto: política de conteúdo, destino do botão, texto alternativo das imagens, cor só em `tokens.css`, contraste de cada par de texto e fundo, e as conferências da seção "O que a página pode dizer". Os testes em navegador (`tests/landing/landing.spec.ts`) não precisam da API nem do banco: provam a política de conteúdo valendo, as letras carregadas, o índice das estações, a faixa do alto que veste a estação sob ela (e o contraste dela em cada uma), as janelas da pintura, as capturas no tamanho certo, o teclado, o contraste do que foi desenhado, nenhuma rolagem lateral de 320 a 1920 px e a página sem JavaScript.

## Estrutura

| Arquivo | O que tem |
|---|---|
| `index.html` | A página inteira, na ordem em que se lê: a faixa do alto, a abertura com a captura do jogo, o índice das quatro estações, o modo de usar, as quatro estações (Primavera, Verão, Outono, Inverno), o fecho e o cólofon |
| `404.html` | A página de caminho errado, servida pelo Caddy com o código 404 |
| `src/styles/tokens.css` | Cores e letras. É o **único** arquivo com valores de cor |
| `src/styles/page.css` | Uma seção por bloco de comentário, na ordem da página |
| `src/main.ts`, `src/season.ts` | O único script: a faixa do alto veste a cor da estação que está sob ela e marca o nome dela no índice |
| `src/site.ts` | Os endereços do jogo e da página, com os padrões de produção |
| `src/fonts/` | Fraunces (em pé e em itálico) e Instrument Sans (subconjunto latino), com o texto da licença de cada uma |
| `src/assets/` | A pintura das estações em duas larguras (AVIF e WebP) e as capturas do jogo (WebP sem perda): a aba Feudo larga e estreita, a barra no modo discreto, a folha da encruzilhada da aba Guilda e o painel do Cerco da aba Exército, largo e estreito |
| `public/` | Ícone, `robots.txt`, `licencas.txt` e `og.png`, a imagem da prévia do link |

## O almanaque

A página é o **Almanaque de Pedra Alta**: o ano do jogo contado em quatro estações, e o chão escurece com ele. Papel claro na abertura, verde pálido na Primavera, trigo no Verão, vinho no Outono e noite no Inverno; depois do Inverno, o papel volta ("Depois do inverno, outra primavera."). O título é "Um ano inteiro para preparar um inverno.", e cada estação conta o que o jogador faz nela:

- **Primavera**, "Plante antes de sonhar.": os ofícios e as obras, a fome e o frio, e o Conselho, com a carta "Estrangeira ferida" palavra por palavra e o tamanho do baralho.
- **Verão**, "A estrada rende, e cobra.": os heróis (as fichas de Edda e Rolf), as expedições com a encruzilhada (captura real), as três Posturas, os quatro desfechos e os onze destinos, o Mercado com as caravanas e os quatro Mestres.
- **Outono**, "Ferro, pátio e presságio.": o ferro e o Ferreiro, as cinco tropas do Quartel com quem vence quem, uma formação desenhada pela página (três alas, frente e retaguarda, um comandante por ala), a Defesa ativa, os presságios, a sabotagem da Fortaleza e o Acampamento.
- **Inverno**, "Três ondas, uma muralha.": o Cerco do Inverno com o Plano de Batalha (captura real do painel do Cerco), as três ondas pelo nome, a milícia, os três fins possíveis e a Crônica do Ano com os Feitos.

Três regras de desenho sustentam a página:

- **Cada trecho troca sete papéis** (`--ground`, `--text`, `--soft`, `--accent`, `--strip`, `--rule`, `--shadow`, em `tokens.css`), e `page.css` só fala neles. Uma estação nova, ou uma cor trocada, é uma mudança em `tokens.css` e no bloco das estações de `page.css`; o teste de contraste em `styles.test.ts` lista cada par usado e precisa acompanhar.
- **O que está na letra de largura fixa é do jogo, palavra por palavra**: as linhas da Crônica, o texto da carta, a frase de cada traço, Postura, tropa e presságio, os destinos e os fins do Cerco. O texto da página é Instrument Sans; os títulos, Fraunces (o itálico de Fraunces marca "um inverno." e os algarismos romanos). Quem acrescentar uma citação usa a tira `.said` e confere a frase em `page.test.ts`.
- **A pintura aparece por uma janela em arco**, uma por estação: é a mesma imagem das quatro estações, com `object-position` diferente em cada arco (`.arch-spring` … `.arch-winter`), e cada janela leva a legenda "Arte conceitual, gerada por IA.".

A faixa do alto fica presa e traz a marca, as quatro estações (a partir de 48rem) e o botão. O script põe `data-season` em `<html>` conforme a estação que está logo abaixo dela, e a faixa veste o chão dessa estação; sem script ela fica sempre em papel. A única coisa que se move é o botão que afunda sob o ponteiro e a cor da faixa, por transição, e `base.css` desliga as duas para quem pediu menos movimento. Não há animação declarada (o teste de `styles.test.ts` continua a provar isso).

## O que a página pode dizer

A página só diz do jogo o que o jogo diz de si. `src/page.test.ts` pega as formas mais comuns de erro, e falha se:

- uma linha da Crônica citada, em qualquer estação (`<blockquote class="chronicle-lines">`), não for uma frase de `chronicleTemplates`, ou for uma virada de dia ([ADR 0007](../../docs/decisions/0007-cronica-sem-viradas-de-dia.md)); o que preenche as linhas (o nome da onda, a tropa, o chefe da Horda, os edifícios, o destino das caravanas) também é conferido;
- a carta do Conselho mostrada não for a "Estrangeira ferida" palavra por palavra (título, texto, rótulo e pista de cada opção), ou o número de cartas dito não for o de `councilCards`;
- as fichas dos heróis não disserem a classe, o traço e a frase do traço de `namedHeroes` e `heroTraits`; as Posturas, os destinos e os desfechos não forem os de `expeditionPostures`, `expeditionModels` e `expeditionOutcomes`; os Mestres não forem os quatro de `masters` com o ofício de origem;
- as tropas não forem as cinco de `units`, com a frase de quem vence quem; a formação desenhada puser uma tropa na linha em que ela não combate ou o mesmo herói em duas alas; um presságio não for um dos vagos de `omenTexts`; as ondas, os três fins do Cerco e os Feitos não forem os de `siegeTexts`, `yearChronicleTexts` e `feats`;
- um edifício citado não existir no conteúdo com o mesmo nome;
- o texto disser "cada semana é um ano" ou der horas para um dia, estação ou ano de jogo (o ritmo é do servidor, [ADR 0011](../../docs/decisions/0011-ritmo-3x-no-mvp.md)), falar em "grátis", em multijogador, em ranking ou no GitHub;
- a primeira imagem da página não for a captura real do jogo, uma captura não se disser captura, uma pintura não se disser arte conceitual;
- aparecer o nome "Visual Studio Code", um estilo ou script embutido, ou um endereço escrito à mão.

O que os testes não alcançam e quem edita precisa manter:

- **As outras formas de dizer a mesma coisa.** Uma expressão regular não pega "um ano de jogo dura 56 horas", "não custa nada" ou o nome de outro editor. Promessa de duração, preço, multijogador e marca de editor continuam proibidos, com ou sem teste. O título fala em "um ano inteiro": é o ano do jogo, e a página não diz quanto ele dura.
- **Nenhum número de regra no texto** (custos, taxas, prazos). As capturas mostram números porque são a tela do jogo; a página não os repete. As contagens que o texto traz ("cinco tropas", "três ondas", o tamanho do baralho) são de coisas que a página lista pelo nome ou que um teste confere.
- **O texto corrido é da página, e não é conferido palavra por palavra.** Ele parafraseia o que o jogo faz (a Paliçada que pode repelir sem batalha, o Plano que vale com o jogador fora, a Horda que guarda a formação, a milícia cujas baixas são permanentes, a Queda que não encerra a partida). Quando uma regra dessas mudar, o parágrafo muda junto.
- **A pintura é arte conceitual**, gerada por IA, e a página diz isso em cada janela e no cólofon. O jogo tem a cara das capturas, e é com uma captura que a página abre. As capturas mostram os ícones do app (Codicons, CC BY 4.0): o crédito fica no cólofon e em `public/licencas.txt`.
- **O que ainda não existe** só pode aparecer num parágrafo "No horizonte", sem data. Hoje ele está vazio e foi retirado: a guerra e o Cerco saíram com a v0.4; relíquias, Legado, o mapa desenhado, os postos avançados e as Temporadas, com a v0.5. Para prometer algo novo, volte com "No horizonte, sem data: …" e ajuste `page.test.ts`.
- **Nada de terceiros**: nenhuma letra, script, imagem ou medição de audiência de outra origem. A política de conteúdo barra, e o GDD §18.1 proíbe telemetria.

## Capturas do jogo

As imagens do jogo são capturas de verdade, feitas por um roteiro que joga uma partida curta no app compilado, contra a API no ritmo de produção:

```bash
pnpm dev:up              # o roteiro usa o db_test; não rode junto com test:e2e nem test:integration
pnpm capture:landing     # tests/landing/capture/: PNG em packages/landing/test-results/capture/
```

São seis imagens, todas em 2×:

| Arquivo | O que é | Janela |
|---|---|---|
| `jogo-feudo` | A aba Feudo, a da abertura | 1040 × 765 |
| `jogo-feudo-estreito` | A mesma aba, para os celulares | 480 × 780 |
| `jogo-discreto-barra` | A barra de status no modo discreto | 1280 de largura |
| `jogo-encruzilhada` | A folha da encruzilhada na aba Guilda (só o elemento) | 1040 × 1100 |
| `jogo-cerco` | O alto do painel do Cerco na aba Exército, do título até as duas primeiras ondas | 1040 × 1500 |
| `jogo-cerco-estreito` | O mesmo painel, até a primeira onda, para os celulares | 480 × 2600 |

A API das capturas (`tests/landing/capture/server.ts`) tem três rotas de controle copiadas do servidor dos testes em navegador: `/__test/hero` põe Edda e Rolf no feudo; `/__test/crossroads` põe a Guilda de pé e os dois na encruzilhada da primeira variante da Floresta Antiga, com a Postura Equilibrada e 12 h de prazo; `/__test/siege` põe o feudo às vésperas do Cerco (Quartel, Paliçada e Torre de pé, a muralha inteira, soldados, duas formações salvas, uma delas a Defesa ativa, e as três ondas marcadas). **A partida das capturas está na Primavera do ano 1**: o Cerco foi posto de fora, e por isso a captura dele é só o painel (que diz "Ano 1 · Inverno"), sem o cabeçalho do feudo. O roteiro imprime o tamanho de cada recorte em pixels de CSS; o `width` e o `height` das imagens em `index.html` são o dobro, e mudam juntos.

O roteiro confere se os cinco pedaços da aba Feudo que o texto alternativo descreve (`REGIONS`: árvore, tabela de recursos, trabalhadores, obra em andamento e barra de status) continuam onde estavam; se a tela do jogo mudar de disposição, ele falha, e o texto alternativo e a legenda precisam ser relidos. A página nova não prende rótulos à captura: não há posição em porcentagem para rever. O recorte do Cerco falha se as duas primeiras ondas deixarem de estar na mesma fileira.

O roteiro clica depressa nos botões de trabalhador e, com a máquina carregada, já perdeu um clique (falha em "Trabalhadores (5/5)"): rodar de novo resolve. Depois de rodar:

1. Converter os seis PNG para WebP sem perda, com o mesmo nome, em `src/assets/` (por exemplo `magick jogo-feudo.png -define webp:lossless=true jogo-feudo.webp`). O repositório não tem ferramenta de imagem: a conversão é feita à mão. Faça isso antes do passo 3: `pnpm test:e2e:landing` esvazia `packages/landing/test-results/`, com os PNG dentro.
2. Rodar `pnpm capture:landing -g prévia` de novo, para a imagem da prévia do link (`public/og.png`) usar a captura nova. A prévia é composta com a própria página: o título, a marca, a captura da aba Feudo e a tira das quatro estações.
3. Olhar o resultado: `pnpm test:e2e:landing` grava a página inteira, em computador e em celular, em `packages/landing/test-results/`.

A pintura das estações vem de `docs/assets/readme/seasons.png`, redimensionada para 2143 e 1400 px de largura e gravada em AVIF e WebP. A pasta `docs/` não entra no contexto do Docker: o que a página usa precisa estar neste pacote.

## Limites conhecidos

- Testada só em Chromium. Firefox e Safari não foram abertos. A página usa `text-wrap: balance`, `aspect-ratio` e `object-position`; em navegador sem o primeiro, os títulos quebram onde couberem.
- A letra de largura fixa é a do sistema de quem visita: a largura das tiras de citação varia um pouco de um sistema para outro.
- A captura da página inteira no celular passa de 16 mil pixels de altura em 2,6×: o ImageMagick não a abre com os limites padrão. Abra-a em um visualizador de imagens, ou corte-a antes.
- Os `id` das estações (`#primavera`, `#verao`, `#outono`, `#inverno`) e `#conteudo` estão em português, porque aparecem no endereço; os outros estão em inglês, como o resto do código.
- O servidor de pré-visualização do Vite responde 404 sem corpo para endereços desconhecidos; a página de caminho errado com o código 404 é do Caddy, e quem a prova é `scripts/landing-smoke.sh`.
- **O título da aba mudou** ("Lords of the Guild: um ano inteiro para preparar um inverno"), e o monitor de saúde (`.github/workflows/health.yml`) e `scripts/landing-smoke.sh` procuram por ele. Entre o `push` e o fim do deploy da página, o monitor agendado pode acusar a página antiga uma vez.
- Título, textos, tema e endereço da página são propostas a confirmar pelo autor (ADR 0012). **O autor não viu o almanaque de 2026-11-17 antes de a página ser feita**, e ninguém além dos testes e de quem a escreveu a abriu; não houve teste em aparelho físico nem com leitor de tela.
