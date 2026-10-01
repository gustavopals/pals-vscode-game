# @lotg/landing

A página de apresentação do jogo: uma página estática, em domínio próprio, que diz o que é Lords of the Guild e leva ao jogo pelo botão **Jogar agora**. Decisão e motivos no [ADR 0012](../../docs/decisions/0012-pagina-de-apresentacao.md).

É HTML e CSS escritos à mão, com um script pequeno (dois arquivos de vinte linhas). Não usa Preact, não importa nenhum pacote do jogo (o lint barra) e não fala com servidor nenhum. O único vínculo com o jogo é um teste que confere as frases citadas contra `@lotg/content`.

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

Os testes de unidade leem as páginas e as folhas de estilo como texto: política de conteúdo, destino do botão, texto alternativo das imagens, cor só em `tokens.css`, contraste de cada par de texto e fundo, e as conferências da seção "O que a página pode dizer". Os testes em navegador (`tests/landing/landing.spec.ts`) não precisam da API nem do banco: provam a política de conteúdo valendo, as letras carregadas, o interruptor das duas leituras pelo clique e pelo teclado, os rótulos dentro da captura, o contraste do que foi desenhado, nenhuma rolagem lateral de 320 a 1920 px e a página sem JavaScript.

## Estrutura

| Arquivo | O que tem |
|---|---|
| `index.html` | A página inteira, na ordem em que se lê: herói, estações, feudo, álibi, vaga, cólofon e a barra de status |
| `404.html` | A página de caminho errado, servida pelo Caddy com o código 404 |
| `src/styles/tokens.css` | Cores e letras. É o **único** arquivo com valores de cor |
| `src/styles/page.css` | Uma seção por bloco de comentário, na ordem da página; as posições dos rótulos presos à captura ficam aqui |
| `src/main.ts`, `src/absence.ts` | O único script: quem troca de aba e volta lê na barra de status quanto tempo ficou fora |
| `src/site.ts` | Os endereços do jogo e da página, com os padrões de produção |
| `src/fonts/` | Grenze Gotisch e Alegreya (subconjunto latino), com o texto da licença de cada uma |
| `src/assets/` | A pintura das estações em três larguras (AVIF e WebP) e as capturas do jogo (WebP sem perda) |
| `public/` | Ícone, `robots.txt`, `licencas.txt` e `og.png`, a imagem da prévia do link |

## As duas vozes

A página fala em duas vozes, e a letra diz qual é. A do **escritório** (largura fixa, do sistema) descreve o que se vê de longe: "Parece trabalho.", os rótulos cinza, a faixa do álibi. A do **feudo** (Grenze Gotisch, em ouro) diz o que aquilo é: "É um feudo.", as flâmulas. O texto corrido é do cronista (Alegreya). A barra de status presa embaixo usa a cor e a letra da barra do jogo.

O herói mostra uma captura real do jogo com cinco rótulos e um interruptor que troca só os rótulos: "quem passa vê" uma tabela qualquer, "quem governa vê" as despensas. É só CSS (dois botões de opção antes da figura), então funciona sem script e pelo teclado. Abaixo de 68rem a captura fica pequena para a gótica dos rótulos: as duas leituras passam a uma lista, lado a lado, sem interruptor.

## O que a página pode dizer

A página só diz do jogo o que o jogo diz de si. `src/page.test.ts` pega as formas mais comuns de erro, e falha se:

- uma linha da Crônica citada não for uma frase de `chronicleTemplates`, ou for uma virada de dia ([ADR 0007](../../docs/decisions/0007-cronica-sem-viradas-de-dia.md));
- um edifício citado não existir no conteúdo com o mesmo nome;
- o texto disser "cada semana é um ano" ou der horas para um dia, estação ou ano de jogo (o ritmo é do servidor, [ADR 0011](../../docs/decisions/0011-ritmo-3x-no-mvp.md)), falar em "grátis", em multijogador ou no GitHub;
- aparecer o nome "Visual Studio Code", um estilo ou script embutido, ou um endereço escrito à mão.

O que os testes não alcançam e quem edita precisa manter:

- **As outras formas de dizer a mesma coisa.** Uma expressão regular não pega "um ano de jogo dura 56 horas", "não custa nada" ou o nome de outro editor. Promessa de duração, preço, multijogador e marca de editor continuam proibidos, com ou sem teste.
- **Nenhum número de regra no texto** (custos, taxas, prazos). As capturas mostram números porque são a tela do jogo; a página não os repete.
- **A pintura é arte conceitual**, gerada por IA, e a página diz isso na legenda e no rodapé. O jogo tem a cara das capturas, e é com uma captura que a página abre. As capturas mostram os ícones do app (Codicons, CC BY 4.0): o crédito fica no rodapé e em `public/licencas.txt`.
- **O que ainda não existe** (estações com efeito, Conselho, Guilda, cerco, mapa) só aparece no parágrafo "No horizonte", sem data.
- **Nada de terceiros**: nenhuma letra, script, imagem ou medição de audiência de outra origem. A política de conteúdo barra, e o GDD §18.1 proíbe telemetria.

## Capturas do jogo

As imagens do jogo são capturas de verdade, feitas por um roteiro que joga uma partida curta no app compilado, contra a API no ritmo de produção:

```bash
pnpm dev:up              # o roteiro usa o db_test; não rode junto com test:e2e nem test:integration
pnpm capture:landing     # tests/landing/capture/: PNG em packages/landing/test-results/capture/
```

O roteiro confere se os cinco pedaços rotulados da tela continuam onde `page.css` espera; se a tela do jogo mudar de disposição, ele falha e as posições dos rótulos precisam ser revistas. Depois de rodar:

1. Converter os três PNG para WebP sem perda, com o mesmo nome, em `src/assets/` (por exemplo `magick jogo-feudo.png -define webp:lossless=true jogo-feudo.webp`). O repositório não tem ferramenta de imagem: a conversão é feita à mão.
2. Rodar `pnpm capture:landing -g prévia` de novo, para a imagem da prévia do link (`public/og.png`) usar a captura nova.
3. Olhar o resultado: `pnpm test:e2e:landing` grava a página inteira em `packages/landing/test-results/`.

A pintura das estações vem de `docs/assets/readme/seasons.png`, redimensionada para 2143, 1400 e 900 px de largura e gravada em AVIF e WebP. A pasta `docs/` não entra no contexto do Docker: o que a página usa precisa estar neste pacote.

## Limites conhecidos

- Testada só em Chromium. Firefox e Safari não foram abertos. A página usa unidades de contêiner (`cqw`) nos rótulos presos à captura e `text-wrap: balance`; em navegador sem elas, os rótulos ficam com o tamanho da lista, maior, e sem o fio, e os títulos quebram onde couberem.
- A fonte de largura fixa é a do sistema de quem visita: a largura dos rótulos cinza varia um pouco de um sistema para outro. O teste confere que eles cabem na captura com as fontes do Chromium no Linux.
- Os `id` do HTML estão em inglês, como o resto do código; `#conteudo` é a exceção, porque aparece no endereço de quem usa "Pular para o conteúdo".
- O servidor de pré-visualização do Vite responde 404 sem corpo para endereços desconhecidos; a página de caminho errado com o código 404 é do Caddy, e quem a prova é `scripts/landing-smoke.sh`.
- Título, texto e endereço da página são propostas a confirmar pelo autor (ADR 0012).
