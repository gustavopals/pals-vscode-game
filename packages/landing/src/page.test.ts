import {
  buildings,
  caravanTexts,
  chronicleTemplates,
  councilCards,
  expeditionModels,
  expeditionOutcomes,
  expeditionPostures,
  heroClasses,
  heroTraits,
  items,
  masters,
  masterTexts,
  namedHeroes,
  raidTemplates,
} from '@lotg/content';
import { describe, expect, it } from 'vitest';

import health from '../../../.github/workflows/health.yml?raw';
import smoke from '../../../scripts/landing-smoke.sh?raw';
import notFoundHtml from '../404.html?raw';
import indexHtml from '../index.html?raw';

/**
 * As páginas são HTML escrito à mão: estes testes leem o texto delas, sem DOM, e conferem o
 * que não pode se perder em uma edição: a política de conteúdo, o destino do botão, e que a
 * página só diz do jogo o que o jogo diz de si.
 */

const pages = { 'index.html': indexHtml, '404.html': notFoundHtml };

const tags = (html: string, name: string): string[] =>
  html.match(new RegExp(`<${name}\\b[^>]*>`, 'g')) ?? [];
const attribute = (tag: string, name: string): string | null =>
  new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1] ?? null;
/** O texto visível, sem marcação e com os espaços de quebra de linha reduzidos a um. */
const text = (html: string): string =>
  html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ');
/** As opções de uma carta ou de uma encruzilhada, como pares [rótulo, pista]. */
const optionsOf = (fragment: string): string[][] =>
  [
    ...fragment.matchAll(
      /<span class="option-label">([\s\S]*?)<\/span>\s*<span class="option-hint"\s*>([\s\S]*?)<\/span\s*>/g,
    ),
  ].map((match) => [text(match[1] ?? '').trim(), text(match[2] ?? '').trim()]);
/** O texto de cada `<li>` da lista com a classe dada. */
const itemsOf = (html: string, className: string): string[] =>
  (
    new RegExp(`<ul class="${className}">([\\s\\S]*?)</ul>`)
      .exec(html)?.[1]
      ?.match(/<li\b[^>]*>[\s\S]*?<\/li>/g) ?? []
  ).map((item) => text(item).trim());

describe.each(Object.entries(pages))('%s', (_name, html) => {
  it('está em português do Brasil e tem um único título principal', () => {
    expect(html).toMatch(/<html lang="pt-BR">/);
    expect(tags(html, 'h1')).toHaveLength(1);
  });

  it('tem política de conteúdo estrita: só esta origem, nada embutido, nada de fora', () => {
    const csp = tags(html, 'meta')
      .filter((tag) => attribute(tag, 'http-equiv') === 'Content-Security-Policy')
      .map((tag) => attribute(tag, 'content'));
    expect(csp).toHaveLength(1);
    const policy = csp[0] ?? '';
    expect(policy).toContain("default-src 'none'");
    for (const directive of ['script-src', 'style-src', 'img-src', 'font-src']) {
      expect(policy).toContain(`${directive} 'self';`);
    }
    expect(policy).not.toMatch(/unsafe-inline|unsafe-eval|https?:|data:|\*/);
  });

  it('não tem estilo nem script embutido', () => {
    expect(html).not.toMatch(/\sstyle="/);
    expect(html).not.toMatch(/<style\b/);
    expect(html).not.toMatch(/\son[a-z]+="/);
    for (const script of tags(html, 'script')) {
      expect(attribute(script, 'src')).toMatch(/^\/src\//);
      expect(attribute(script, 'type')).toBe('module');
    }
    // Um <script> com conteúdo seria barrado pela política; aqui ele nem chega a existir.
    expect(html).not.toMatch(/<script\b[^>]*>\s*[^<\s]/);
  });

  it('não escreve endereço nenhum: os de fora entram pelos marcadores do build', () => {
    expect(html).not.toMatch(/https?:\/\//);
    const markers = new Set(html.match(/%[A-Z][A-Z_]*%/g) ?? []);
    for (const marker of markers) expect(['%GAME_URL%', '%SITE_URL%']).toContain(marker);
  });

  it('toda imagem tem texto alternativo e tamanho declarado', () => {
    const images = tags(html, 'img');
    expect(images.length).toBeGreaterThan(0);
    for (const image of images) {
      expect(attribute(image, 'alt'), image).not.toBeNull();
      expect(attribute(image, 'width'), image).toMatch(/^\d+$/);
      expect(attribute(image, 'height'), image).toMatch(/^\d+$/);
    }
  });

  it('o botão "Jogar agora" leva ao jogo', () => {
    // O Prettier pode quebrar a linha dentro da marca de fechamento: `</a\n>`.
    const links = html.match(/<a\b[^>]*>[\s\S]*?<\/a\s*>/g) ?? [];
    const play = links.filter((link) => text(link).trim() === 'Jogar agora');
    expect(play.length).toBeGreaterThan(0);
    for (const link of play) expect(link).toMatch(/\shref="%GAME_URL%"/);
    // E nada mais aponta para o jogo com outro nome.
    const toGame = links.filter((link) => /%GAME_URL%/.test(link));
    expect(toGame).toEqual(play);
  });

  it('não usa o nome de nenhum editor de código', () => {
    expect(html).not.toMatch(/Visual Studio Code|VS ?Code|VSCode/i);
  });
});

describe('index.html', () => {
  const html = indexHtml;
  const prose = text(html);

  it('o título da aba não é o do jogo (o monitor de saúde distingue os dois sites)', () => {
    const title = /<title>([^<]*)<\/title>/.exec(html)?.[1] ?? '';
    expect(title).toMatch(/^Lords of the Guild: /);
    expect(title).not.toBe('Lords of the Guild');
  });

  it('o monitor de saúde e a verificação de fumaça procuram exatamente esse título', () => {
    const title = /<title>[^<]*<\/title>/.exec(html)?.[0] ?? '';
    expect(health).toContain(`grep --quiet '${title}'`);
    expect(smoke).toContain(`'${title}'`);
  });

  it('diz em duas vozes o que o jogo é', () => {
    const h1 = /<h1\b[^>]*>([\s\S]*?)<\/h1>/.exec(html)?.[1] ?? '';
    expect(text(h1).trim()).toBe('Parece trabalho. É um feudo.');
    expect(h1).toMatch(/class="voice-office">Parece trabalho\.</);
    expect(h1).toMatch(/class="voice-fief">É um feudo\.</);
  });

  it('tem o botão no herói, no fecho e na barra de status', () => {
    expect(html.match(/href="%GAME_URL%"/g)).toHaveLength(3);
    expect(html).toMatch(/class="statusbar-cta" href="%GAME_URL%"/);
  });

  it('a prévia do link tem título, descrição e imagem com endereço completo', () => {
    const meta = (property: string) =>
      attribute(
        tags(html, 'meta').find((tag) => attribute(tag, 'property') === property) ?? '',
        'content',
      );
    expect(meta('og:title')).toBe('Parece trabalho. É um feudo.');
    expect(meta('og:description')).toMatch(/pausas do café/);
    expect(meta('og:url')).toBe('%SITE_URL%/');
    expect(meta('og:image')).toBe('%SITE_URL%/og.png');
    expect(html).toMatch(/<link rel="canonical" href="%SITE_URL%\/" \/>/);
  });

  it('o interruptor das duas leituras são dois botões de opção com rótulo, um deles marcado', () => {
    const radios = tags(html, 'input').filter((tag) => attribute(tag, 'type') === 'radio');
    expect(radios).toHaveLength(2);
    expect(new Set(radios.map((radio) => attribute(radio, 'name')))).toEqual(new Set(['reading']));
    expect(radios.filter((radio) => /\schecked\b/.test(radio))).toHaveLength(1);
    for (const radio of radios) {
      expect(html).toContain(`<label for="${attribute(radio, 'id')}">`);
    }
    // Cada pedaço da tela tem as duas leituras, na mesma ordem.
    const labels = /<dl class="labels">([\s\S]*?)<\/dl>/.exec(html)?.[1] ?? '';
    expect(labels.match(/<dt>/g)).toHaveLength(5);
    expect(labels.match(/<dd>/g)).toHaveLength(5);
  });

  it('o códice tem um bloco por coisa que se governa, cada um com a orelha de arquivo e o título', () => {
    const tiles = html.match(/<article class="tile [\s\S]*?<\/article>/g) ?? [];
    expect(tiles).toHaveLength(8);
    const tabs = tiles.map((tile) =>
      text(/<p class="tab"[^>]*>([^<]*)<\/p>/.exec(tile)?.[1] ?? '').trim(),
    );
    expect(tabs).toEqual([
      'feudo.csv',
      'conselho.md',
      'vigia.log',
      'guilda.csv',
      'expedicao.log',
      'mercado.csv',
      'mestres.txt',
      'cronica.md',
    ]);
    for (const tile of tiles) expect(tile).toMatch(/<h3 id="tile-[a-z]+-title">/);
  });

  it('a hierarquia dos títulos não pula nível', () => {
    const levels = (html.match(/<h[1-6]\b/g) ?? []).map((tag) => Number(tag[2]));
    expect(levels[0]).toBe(1);
    levels.reduce((previous, level) => {
      expect(level - previous).toBeLessThanOrEqual(1);
      return level;
    });
  });

  describe('só diz do jogo o que o jogo diz de si', () => {
    /** O texto de cada `<p>` de um trecho de HTML, sem marcação. */
    const paragraphs = (fragment: string): string[] =>
      (fragment.match(/<p\b[^>]*>[\s\S]*?<\/p>/g) ?? []).map((line) => text(line).trim());

    it('toda linha da Crônica citada, em qualquer bloco, é uma frase do conteúdo do jogo', () => {
      const quotes =
        html.match(/<blockquote class="chronicle-lines">[\s\S]*?<\/blockquote>/g) ?? [];
      expect(quotes.length).toBeGreaterThanOrEqual(5);
      const lines = quotes.flatMap(paragraphs);
      expect(lines.length).toBeGreaterThanOrEqual(15);

      // Cada modelo vira uma expressão em que os marcadores aceitam qualquer valor. Os lobos
      // têm as frases deles (`raidTemplates`): o uivo, e a chegada seguida do desfecho.
      const wolves = raidTemplates.wolves;
      const templates = [
        ...Object.values(chronicleTemplates),
        ...Object.values(wolves.howl),
        ...Object.values(wolves.arrival).flatMap((arrival) =>
          Object.values(wolves.outcome).map((outcome) => `${arrival} ${outcome}`),
        ),
      ];
      const patterns = templates.map(
        (template) =>
          new RegExp(
            `^${template
              .split(/\{[a-zA-Z]+\}/)
              .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
              .join('.+')}$`,
          ),
      );
      for (const line of lines) {
        expect(
          patterns.some((pattern) => pattern.test(line)),
          `"${line}" não é uma frase da Crônica`,
        ).toBe(true);
      }
    });

    it('a carta do Conselho mostrada é a "Estrangeira ferida", palavra por palavra', () => {
      const card = /<figure class="card">([\s\S]*?)<\/figure>/.exec(html)?.[1] ?? '';
      const def = councilCards.find((item) => item.id === 'woundedStranger');
      expect(def).toBeDefined();
      expect(text(/<p class="card-title">([^<]*)<\/p>/.exec(card)?.[1] ?? '').trim()).toBe(
        def?.title,
      );
      expect(
        paragraphs(/<blockquote class="card-text">([\s\S]*?)<\/blockquote>/.exec(card)?.[1] ?? ''),
      ).toEqual([def?.text]);
      expect(optionsOf(card)).toEqual(
        def?.options.map((option) => [option.label, option.hint ?? '']),
      );
    });

    it('a encruzilhada mostrada é uma captura real da aba Guilda, e diz o que mostra', () => {
      const sheet = /<figure class="crossroads">([\s\S]*?)<\/figure>/.exec(html)?.[1] ?? '';
      const image = tags(sheet, 'img')[0] ?? '';
      expect(attribute(image, 'src')).toBe('/src/assets/jogo-encruzilhada.webp');
      expect(attribute(image, 'alt')).toMatch(/^Captura real do jogo, na aba Guilda:/);
      const forest = expeditionModels.find((model) => model.id === 'oldForest');
      const fork = Object.values(forest?.variants[0]?.nodes ?? {}).find(
        (node) => node.kind === 'crossroads',
      );
      expect(fork?.kind).toBe('crossroads');
      // A captura é da encruzilhada da Floresta Antiga, e a legenda e o texto alternativo dizem isso.
      expect(forest?.label).toBe('Floresta Antiga');
      expect(text(sheet)).toContain('a encruzilhada da Floresta Antiga');
    });

    it('as Posturas, os destinos e os desfechos são os do jogo, com as frases dele', () => {
      const postures = /<dl class="postures">([\s\S]*?)<\/dl>/.exec(html)?.[1] ?? '';
      const shown = [...postures.matchAll(/<dt>([\s\S]*?)<\/dt>\s*<dd>([\s\S]*?)<\/dd>/g)].map(
        (match) => [text(match[1] ?? '').trim(), text(match[2] ?? '').trim()],
      );
      expect(shown).toEqual(
        Object.values(expeditionPostures).map((posture) => [posture.label, posture.text]),
      );
      expect(itemsOf(html, 'destinations')).toEqual(expeditionModels.map((model) => model.label));
      expect(itemsOf(html, 'outcomes')).toEqual(
        (['full', 'success', 'setback', 'disaster'] as const).map(
          (outcome) => expeditionOutcomes[outcome].label,
        ),
      );
    });

    it('as fichas dos heróis dizem a classe e o traço do jogo, com a frase do traço', () => {
      const sheets = html.match(/<li class="sheet">[\s\S]*?<\/li>/g) ?? [];
      const shown = sheets.map((sheet) => ({
        name: text(/<p class="sheet-name">([^<]*)<\/p>/.exec(sheet)?.[1] ?? '').trim(),
        line: text(/<p class="sheet-class">([^<]*)<\/p>/.exec(sheet)?.[1] ?? '').trim(),
        trait: paragraphs(sheet).at(-1),
      }));
      const expected = Object.values(namedHeroes).map((hero) => {
        const heroClass = heroClasses[hero.classId];
        const trait = heroTraits[hero.traits[0] ?? 'loyal'];
        const feminine = hero.gender === 'f';
        return {
          name: hero.name,
          line: `${feminine ? heroClass.labelFeminine : heroClass.label} · ${
            feminine ? trait.labelFeminine : trait.label
          }`,
          trait: trait.text,
        };
      });
      expect(shown).toEqual(expected);
    });

    it('os Mestres são os quatro do jogo, com o ofício de origem de cada um', () => {
      expect(itemsOf(html, 'masters')).toEqual(
        Object.values(masters).map(
          (master) =>
            `${master.gender === 'f' ? masterTexts.titleFeminine : masterTexts.titleMasculine} ${master.name}, ${master.originText}`,
        ),
      );
    });

    it('o destino das caravanas e o item citado são os do jogo', () => {
      expect(prose).toContain(caravanTexts.destination);
      const names = Object.values(items).map((item) => item.label);
      expect(names).toContain('Lança de caça');
      expect(prose).toContain('Lança de caça');
    });

    it('a Crônica citada não traz viradas de dia (ADR 0007)', () => {
      expect(prose).not.toMatch(/Amanhece/);
    });

    it('os edifícios citados existem no jogo, com o mesmo nome', () => {
      const labels = Object.values(buildings).map((building) => building.label);
      for (const name of ['Fazenda', 'Serraria', 'Pedreira', 'Mina de Ouro', 'Habitações']) {
        expect(labels).toContain(name);
        expect(prose).toContain(name);
      }
    });

    it('não promete duração de dia, estação ou ano: o ritmo é do servidor (ADR 0011)', () => {
      expect(prose).not.toMatch(/cada semana/i);
      expect(prose).not.toMatch(/semana[^.]*\bano\b/i);
      expect(prose).not.toMatch(/\b\d+\s*(horas?|h)\b[^.]*\b(dia|ano|estação) de jogo/i);
    });

    it('não fala em preço, em jogar com outras pessoas nem em entrar com o GitHub', () => {
      expect(prose).not.toMatch(/gr[áa]tis|gratuit|de graça|pag(ue|ar|amento)/i);
      expect(prose).not.toMatch(/multiplayer|multijogador|com amigos|aliança|ranking/i);
      expect(prose).not.toMatch(/github/i);
    });

    it('as pinturas são apresentadas como arte conceitual, e o que ainda não existe, como horizonte', () => {
      expect(prose).toMatch(/arte conceitual de Pedra Alta, gerada por IA/);
      expect(prose).toMatch(/A pintura desta página é arte conceitual gerada por IA/);
      // As capturas reproduzem os ícones do app, que pedem crédito (CC BY 4.0).
      expect(prose).toMatch(/Codicons \(licença CC BY 4\.0\)/);
      expect(prose).toMatch(/Isso ainda não se joga\./);
      // A Guilda e o Mercado saíram do horizonte com a v0.3: o que ainda falta é a guerra, o mapa e o legado.
      expect(prose).toMatch(
        /No horizonte, sem data: a guerra e o Cerco do Inverno; mapa e legado\./,
      );
      expect(prose).not.toMatch(/No horizonte[^.]*(Guilda|expedi)/);
      expect(prose).toMatch(/não é afiliado a nenhum editor de código/);
    });
  });
});

describe('404.html', () => {
  it('não entra em buscadores e oferece o caminho de volta', () => {
    expect(notFoundHtml).toMatch(/<meta name="robots" content="noindex" \/>/);
    expect(notFoundHtml).toMatch(/<a class="cta" href="\/">Voltar ao começo<\/a>/);
  });

  it('só usa endereços absolutos da própria origem: a página é servida em qualquer caminho', () => {
    const urls = [...notFoundHtml.matchAll(/\s(?:href|src)="([^"]*)"/g)].map((match) => match[1]);
    for (const url of urls) expect(url).toMatch(/^(\/|%GAME_URL%$)/);
  });
});
