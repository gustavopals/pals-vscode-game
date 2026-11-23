import {
  buildings,
  caravanTexts,
  chronicleTemplates,
  councilCards,
  expeditionModels,
  expeditionOutcomes,
  expeditionPostures,
  feats,
  heroClasses,
  heroTraits,
  hordeUnits,
  masters,
  masterTexts,
  namedHeroes,
  omenTexts,
  siegeTexts,
  units,
  unitTexts,
  yearChronicleTexts,
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

  it('abre dizendo o que o jogo é: um ano inteiro para preparar um inverno', () => {
    const h1 = /<h1\b[^>]*>([\s\S]*?)<\/h1>/.exec(html)?.[1] ?? '';
    expect(text(h1).trim()).toBe('Um ano inteiro para preparar um inverno.');
  });

  it('abre com uma captura real do jogo, antes de qualquer pintura', () => {
    const first = tags(html, 'img').find((image) => attribute(image, 'alt') !== '') ?? '';
    expect(attribute(first, 'src')).toBe('/src/assets/jogo-feudo.webp');
    expect(attribute(first, 'alt')).toMatch(/^Captura real do jogo, na aba Feudo/);
    // Toda captura diz que é captura, e toda pintura diz que é arte conceitual.
    for (const image of tags(html, 'img')) {
      const source = attribute(image, 'src') ?? '';
      const alt = attribute(image, 'alt') ?? '';
      if (/\/jogo-(feudo|encruzilhada|cerco)/.test(source)) expect(alt).toMatch(/^Captura real/);
      if (/pedra-alta-estacoes/.test(source)) expect(alt).toMatch(/^Arte conceitual:/);
    }
  });

  it('tem o botão na faixa do alto, na abertura e no fecho', () => {
    expect(html.match(/href="%GAME_URL%"/g)).toHaveLength(3);
    expect(html).toMatch(/class="topbar-cta" href="%GAME_URL%"/);
  });

  it('a prévia do link tem título, descrição e imagem com endereço completo', () => {
    const meta = (property: string) =>
      attribute(
        tags(html, 'meta').find((tag) => attribute(tag, 'property') === property) ?? '',
        'content',
      );
    expect(meta('og:title')).toBe('Um ano inteiro para preparar um inverno.');
    expect(meta('og:description')).toMatch(/Cerco do Inverno/);
    expect(meta('og:url')).toBe('%SITE_URL%/');
    expect(meta('og:image')).toBe('%SITE_URL%/og.png');
    expect(html).toMatch(/<link rel="canonical" href="%SITE_URL%\/" \/>/);
  });

  it('o ano tem quatro estações, na ordem, cada uma com a âncora que o índice aponta', () => {
    const sections = tags(html, 'section').filter((tag) => attribute(tag, 'data-season') !== null);
    expect(sections.map((tag) => [attribute(tag, 'id'), attribute(tag, 'data-season')])).toEqual([
      ['primavera', 'spring'],
      ['verao', 'summer'],
      ['outono', 'autumn'],
      ['inverno', 'winter'],
    ]);
    // A faixa do alto e o índice levam às quatro, e o script acha a estação de cada ligação.
    const anchors = ['#primavera', '#verao', '#outono', '#inverno'];
    const hrefs = tags(html, 'a').map((tag) => attribute(tag, 'href'));
    for (const anchor of anchors) {
      expect(hrefs.filter((href) => href === anchor)).toHaveLength(2);
    }
    expect(
      tags(html, 'a')
        .map((tag) => attribute(tag, 'data-season-link'))
        .filter((season) => season !== null),
    ).toEqual(sections.map((tag) => attribute(tag, 'data-season')));
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

    it('toda linha da Crônica citada, em qualquer estação, é uma frase do conteúdo do jogo', () => {
      const quotes =
        html.match(/<blockquote class="chronicle-lines">[\s\S]*?<\/blockquote>/g) ?? [];
      expect(quotes.length).toBeGreaterThanOrEqual(7);
      const lines = quotes.flatMap(paragraphs);
      expect(lines.length).toBeGreaterThanOrEqual(16);

      // Cada modelo vira uma expressão em que os marcadores aceitam qualquer valor.
      const patterns = Object.values(chronicleTemplates).map(
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

    it('o que preenche as linhas da Crônica citadas também é do jogo', () => {
      // A onda confiada a uma formação e a onda sabotada, com os nomes que o motor usa.
      expect(Object.values(siegeTexts.waves)).toContain('As Feras');
      expect(prose).toContain('confiou As Feras a');
      expect(prose).toMatch(/a segunda onda da Horda foi enfraquecida/);
      // A tropa chamada ao pátio e o chefe que tomba.
      expect(prose).toContain(`8 ${units.swordsman.pluralLabel}`);
      expect(prose).toContain(`o ${hordeUnits.warlord.label} tombou`);
      // O edifício do Mestre, o depósito que enche e o destino das caravanas.
      for (const building of [buildings.quarry, buildings.granary, buildings.housing]) {
        expect(prose).toContain(building.label);
      }
      expect(prose).toContain(caravanTexts.destination);
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

    it('o tamanho do baralho do Conselho é o do jogo', () => {
      const count = /<span data-council-count>(\d+)<\/span>/.exec(html)?.[1];
      expect(Number(count)).toBe(councilCards.length);
    });

    it('a encruzilhada mostrada é uma captura real da aba Guilda, e diz o que mostra', () => {
      const sheet =
        /<figure class="shot shot-crossroads">([\s\S]*?)<\/figure>/.exec(html)?.[1] ?? '';
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
      // A página mostra os dois heróis da carta da estrangeira; os heróis com nome que vieram
      // depois não precisam estar nela, mas quem estiver tem de dizer o que o jogo diz.
      expect(shown.map((sheet) => sheet.name)).toEqual(['Edda', 'Rolf']);
      const expected = Object.values(namedHeroes)
        .filter((hero) => shown.some((sheet) => sheet.name === hero.name))
        .map((hero) => {
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

    it('as tropas são as cinco do Quartel, e quem vence quem é o que o jogo diz', () => {
      expect(itemsOf(html, 'units')).toEqual(
        Object.values(units).map((unit) => {
          const rule =
            unit.counters === null
              ? unitTexts.neutral
              : unitTexts.counters.replace('{unidade}', `o ${units[unit.counters].label}`);
          return `${unit.label} ${rule}`;
        }),
      );
    });

    it('a formação desenhada é uma formação que o jogo aceita', () => {
      const wings = html.match(/<li>\s*<p class="wing-name">[\s\S]*?<\/li>/g) ?? [];
      expect(wings).toHaveLength(3);
      const value = (wing: string, line: string) =>
        text(
          new RegExp(`<span class="post-line">${line}</span>([^<]*)</p>`).exec(wing)?.[1] ?? '',
        ).trim();
      const byPlural = new Map(Object.values(units).map((unit) => [unit.pluralLabel, unit]));
      const commanders: string[] = [];
      for (const wing of wings) {
        // Cada posto leva uma tropa do Quartel, na linha em que ela combate.
        expect(byPlural.get(value(wing, 'Frente'))?.line).toBe('front');
        expect(byPlural.get(value(wing, 'Retaguarda'))?.line).toBe('back');
        commanders.push(value(wing, 'Comanda'));
      }
      // Um herói não comanda duas alas, e quem comanda é herói do jogo.
      const named = commanders.filter((name) => name !== 'ninguém');
      expect(new Set(named).size).toBe(named.length);
      const heroes = Object.values(namedHeroes).map((hero) => hero.name);
      for (const name of named) expect(heroes).toContain(name);
    });

    it('os presságios citados são presságios vagos do jogo, palavra por palavra', () => {
      const omens = paragraphs(
        /<blockquote class="omen-lines">([\s\S]*?)<\/blockquote>/.exec(html)?.[1] ?? '',
      );
      expect(omens).toHaveLength(3);
      const vague: readonly string[] = Object.values(omenTexts.vague);
      for (const omen of omens) expect(vague).toContain(omen);
    });

    it('as três ondas, os três fins do Cerco e os Feitos são os do jogo', () => {
      const waves = (
        /<ol class="waves">([\s\S]*?)<\/ol>/.exec(html)?.[1]?.match(/<li>[\s\S]*?<\/li>/g) ?? []
      ).map((item) => text(item).trim());
      expect(waves).toEqual(Object.values(siegeTexts.waves));
      expect(itemsOf(html, 'endings')).toEqual([
        yearChronicleTexts.siegeResults.glorious,
        yearChronicleTexts.siegeResults.victory,
        yearChronicleTexts.siegeResults.fall,
      ]);
      expect(itemsOf(html, 'feats')).toEqual(feats.map((feat) => feat.label));
    });

    it('a captura do Cerco é uma captura real da aba Exército, e diz o que mostra', () => {
      const shot = /<figure class="shot shot-siege">([\s\S]*?)<\/figure>/.exec(html)?.[1] ?? '';
      const image = tags(shot, 'img')[0] ?? '';
      expect(attribute(image, 'src')).toBe('/src/assets/jogo-cerco.webp');
      expect(attribute(image, 'alt')).toMatch(/^Captura real do jogo, na aba Exército:/);
      expect(shot).toContain('/src/assets/jogo-cerco-estreito.webp');
    });

    it('a Crônica citada não traz viradas de dia (ADR 0007)', () => {
      expect(prose).not.toMatch(/Amanhece/);
    });

    it('os edifícios citados existem no jogo, com o mesmo nome', () => {
      const labels = Object.values(buildings).map((building) => building.label);
      for (const name of [
        'Fazenda',
        'Serraria',
        'Pedreira',
        'Mina de Ouro',
        'Habitações',
        'Celeiro',
        'Armazém',
        'Taverna',
        'Guilda dos Aventureiros',
        'Mercado',
        'Torre de Vigia',
        'Ferreiro',
        'Quartel',
        'Paliçada',
      ]) {
        expect(labels).toContain(name);
        expect(prose).toContain(name);
      }
    });

    it('não promete duração de dia, estação ou ano: o ritmo é do servidor (ADR 0011)', () => {
      expect(prose).not.toMatch(/cada semana/i);
      expect(prose).not.toMatch(/semana[^.]*\bano\b/i);
      expect(prose).not.toMatch(/\b\d+\s*(horas?|h)\b[^.]*\b(dia|ano|estação) de jogo/i);
      expect(prose).not.toMatch(/\b(dura|leva|demora)\b[^.]*\b(horas?|dias? reais|semanas?)\b/i);
    });

    it('não fala em preço, em jogar com outras pessoas nem em entrar com o GitHub', () => {
      expect(prose).not.toMatch(/gr[áa]tis|gratuit|de graça|pag(ue|ar|amento)/i);
      expect(prose).not.toMatch(/multiplayer|multijogador|com amigos|aliança|ranking/i);
      expect(prose).not.toMatch(/github/i);
    });

    it('as pinturas são apresentadas como arte conceitual, e o que ainda não existe, como horizonte', () => {
      // Cada janela em arco leva a legenda dela, e o cólofon repete para a página inteira.
      const arches = html.match(/<figure class="arch">[\s\S]*?<\/figure>/g) ?? [];
      expect(arches).toHaveLength(4);
      for (const arch of arches) expect(text(arch)).toContain('Arte conceitual, gerada por IA.');
      expect(prose).toMatch(/As pinturas desta página são arte conceitual gerada por IA/);
      // As capturas reproduzem os ícones do app, que pedem crédito (CC BY 4.0).
      expect(prose).toMatch(/Codicons \(licença CC BY 4\.0\)/);
      expect(prose).toMatch(/Isso ainda não se joga\./);
      // A guerra e o Cerco saíram do horizonte com a v0.4, as relíquias com a Capela (v0.5, Fase B), o Legado (Fase D) e o mapa desenhado (Fase E).
      expect(prose).toMatch(/No horizonte, sem data: postos avançados no mapa\./);
      expect(prose).not.toMatch(
        /No horizonte[^.]*(Guilda|expedi|guerra|Cerco|Horda|muralha|relíqu|Capela|legado|Legado|desenhado)/i,
      );
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
