import type { VersionResponse } from '@lotg/protocol';
import type { ComponentChild } from 'preact';
import { renderToString } from 'preact-render-to-string';
import { describe, expect, it } from 'vitest';

import type { Loadable } from '../app/controller';
import type { Actions } from '../components/actions';
import { DEFAULT_PREFERENCES, type Preferences, type ThemeId } from '../services/preferences';
import { APP_VERSION } from '../version';
import { AboutTab } from './About';
import { ChronicleTab } from './Chronicle';
import { parseChronicle } from './markdown';
import { SettingsTab } from './Settings';

const noop = () => {};
const actions: Actions = { order: noop, run: noop, playNow: noop };
const html = (node: ComponentChild) => renderToString(<>{node}</>);

const tags = (markup: string, pattern: RegExp): string[] => markup.match(pattern) ?? [];
const attribute = (tag: string, name: string) =>
  new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1] ?? null;
const hasAttribute = (tag: string, name: string) => new RegExp(`\\s${name}(=|\\s|>|/)`).test(tag);
const inputs = (markup: string, name: string) =>
  tags(markup, /<input[^>]*>/g).filter((tag) => attribute(tag, 'name') === name);

describe('Markdown da Crônica (parseChronicle)', () => {
  it('lê o título, os anos e as linhas de cada ano', () => {
    const markdown = [
      '# Crônica de Pedra Alta',
      '',
      '## Ano 1',
      '',
      '- A Fazenda chegou ao nível 2.',
      '- Três aldeões se juntaram ao feudo.',
      '',
      '## Ano 2',
      '',
      '- A fome começou.',
      '',
    ].join('\n');
    expect(parseChronicle(markdown)).toEqual([
      { kind: 'title', text: 'Crônica de Pedra Alta' },
      { kind: 'heading', text: 'Ano 1' },
      {
        kind: 'list',
        items: ['A Fazenda chegou ao nível 2.', 'Três aldeões se juntaram ao feudo.'],
      },
      { kind: 'heading', text: 'Ano 2' },
      { kind: 'list', items: ['A fome começou.'] },
    ]);
  });

  it('itens seguidos formam uma lista só, mesmo com linhas em branco entre eles', () => {
    expect(parseChronicle('- um\n- dois\n\n- três')).toEqual([
      { kind: 'list', items: ['um', 'dois', 'três'] },
    ]);
  });

  it('um título ou parágrafo entre itens separa as listas', () => {
    expect(parseChronicle('- um\n## Ano 2\n- dois\ntexto solto\n- três')).toEqual([
      { kind: 'list', items: ['um'] },
      { kind: 'heading', text: 'Ano 2' },
      { kind: 'list', items: ['dois'] },
      { kind: 'paragraph', text: 'texto solto' },
      { kind: 'list', items: ['três'] },
    ]);
  });

  it('a Crônica ainda vazia traz a nota em itálico, sem os asteriscos', () => {
    expect(
      parseChronicle('# Crônica de Pedra Alta\n\n## Ano 1\n\n*Ainda não há nada a contar.*\n'),
    ).toEqual([
      { kind: 'title', text: 'Crônica de Pedra Alta' },
      { kind: 'heading', text: 'Ano 1' },
      { kind: 'note', text: 'Ainda não há nada a contar.' },
    ]);
  });

  it('linhas em branco e espaços nas pontas são ignorados', () => {
    expect(parseChronicle('')).toEqual([]);
    expect(parseChronicle('\n\n   \n\t\n')).toEqual([]);
    expect(parseChronicle('\n\n  # Título  \n\n\n   - item   \n\n')).toEqual([
      { kind: 'title', text: 'Título' },
      { kind: 'list', items: ['item'] },
    ]);
  });

  it('aceita quebras de linha do Windows (CRLF)', () => {
    expect(parseChronicle('# Crônica\r\n\r\n## Ano 1\r\n\r\n- um\r\n- dois\r\n')).toEqual([
      { kind: 'title', text: 'Crônica' },
      { kind: 'heading', text: 'Ano 1' },
      { kind: 'list', items: ['um', 'dois'] },
    ]);
  });

  it('o que não é título, ano, item nem nota fica como parágrafo, sem perder texto', () => {
    expect(parseChronicle('Texto comum.\n#sem espaço\n-sem espaço\n**negrito**\n*')).toEqual([
      { kind: 'paragraph', text: 'Texto comum.' },
      { kind: 'paragraph', text: '#sem espaço' },
      { kind: 'paragraph', text: '-sem espaço' },
      { kind: 'paragraph', text: '**negrito**' },
      { kind: 'paragraph', text: '*' },
    ]);
  });

  it('HTML no conteúdo continua sendo só texto', () => {
    expect(parseChronicle('- <b>forte</b>\n<script>alert(1)</script>')).toEqual([
      { kind: 'list', items: ['<b>forte</b>'] },
      { kind: 'paragraph', text: '<script>alert(1)</script>' },
    ]);
  });
});

describe('aba Crônica', () => {
  const render = (document: Loadable<string>) =>
    html(<ChronicleTab document={document} actions={actions} />);

  it('enquanto carrega, diz isso a leitores de tela e não mostra o download', () => {
    for (const document of [{ status: 'idle' }, { status: 'loading' }] as const) {
      const markup = render(document);
      expect(markup).toMatch(/<p[^>]*role="status"[^>]*>Abrindo a Crônica…<\/p>/);
      expect(markup).not.toContain('<button');
    }
  });

  it('em caso de erro, mostra o motivo como alerta e oferece tentar de novo', () => {
    const markup = render({ status: 'error', message: 'Sem ligação com o reino.' });
    expect(markup).toMatch(/<p[^>]*role="alert"[^>]*>Sem ligação com o reino\.<\/p>/);
    expect(markup).toMatch(/<button[^>]*>Tentar de novo<\/button>/);
    expect(markup).not.toContain('Baixar Crônica');
  });

  it('pronta: texto formatado com título, anos e lista, e o botão de download', () => {
    const markup = render({
      status: 'ready',
      value:
        '# Crônica de Pedra Alta\n\n## Ano 1\n\n- A Fazenda chegou ao nível 2.\n- Chegou um aldeão.\n',
    });
    expect(markup).toMatch(/<button[^>]*>Baixar Crônica \(Markdown\)<\/button>/);
    expect(markup).toContain('<h1>Crônica de Pedra Alta</h1>');
    expect(markup).toContain('<h2>Ano 1</h2>');
    expect(markup).toContain(
      '<ul><li>A Fazenda chegou ao nível 2.</li><li>Chegou um aldeão.</li></ul>',
    );
    // A sintaxe do Markdown não aparece crua.
    expect(markup).not.toContain('## ');
    expect(markup).not.toContain('- A Fazenda');
  });

  it('a Crônica vazia mostra a nota, sem os asteriscos', () => {
    const markup = render({
      status: 'ready',
      value: '# Crônica de Pedra Alta\n\n## Ano 1\n\n*Ainda não há nada a contar.*\n',
    });
    expect(markup).toMatch(/<p[^>]*>Ainda não há nada a contar\.<\/p>/);
    expect(markup).not.toContain('*');
    expect(markup).not.toContain('<ul>');
  });

  it('HTML no texto da Crônica sai escapado, nunca como marcação', () => {
    const hostile = [
      '# <script>alert(1)</script>',
      '## <img src=x onerror=alert(2)>',
      '- <script>alert(3)</script>',
      '- <img src=x onerror="alert(4)">',
      '*<iframe src="javascript:alert(5)"></iframe>*',
      '<a href="javascript:alert(6)">clique</a>',
      '- Feudo de <b onmouseover=alert(7)>Zé</b> & cia',
    ].join('\n');
    const markup = render({ status: 'ready', value: hostile });
    for (const tag of ['<script', '<img', '<iframe', '<a ', '<b ', '<b>']) {
      expect(markup).not.toContain(tag);
    }
    // O texto continua lá, como texto.
    expect(markup).toContain('&lt;script>alert(1)&lt;/script>');
    expect(markup).toContain('&lt;img src=x onerror=alert(2)>');
    expect(markup).toContain('&lt;script>alert(3)&lt;/script>');
    expect(markup).toContain('&amp; cia');
    // Só os elementos que a aba desenha existem na saída.
    const elements = new Set([...markup.matchAll(/<([a-z0-9]+)[\s>]/g)].map((match) => match[1]));
    expect([...elements].sort()).toEqual(['article', 'button', 'div', 'h1', 'h2', 'li', 'p', 'ul']);
    // Nenhum atributo de evento chegou a uma tag.
    expect(tags(markup, /<[a-z0-9]+[^>]*\son[a-z]+=/g)).toEqual([]);
  });
});

describe('aba Preferências', () => {
  const render = (
    overrides: Partial<{
      preferences: Preferences;
      theme: ThemeId;
      browserNotificationsSupported: boolean;
    }> = {},
  ) =>
    html(
      <SettingsTab
        preferences={DEFAULT_PREFERENCES}
        theme="dark"
        browserNotificationsSupported={true}
        onChange={noop}
        onBrowserNotifications={noop}
        {...overrides}
      />,
    );
  const checked = (markup: string, name: string) =>
    inputs(markup, name)
      .filter((tag) => hasAttribute(tag, 'checked'))
      .map((tag) => attribute(tag, 'value'));

  it('diz que as preferências valem só neste navegador', () => {
    expect(render()).toContain('Valem só neste navegador.');
  });

  it('três temas em botões de rádio, com o tema em uso marcado', () => {
    const markup = render();
    const themes = inputs(markup, 'theme');
    expect(themes.map((tag) => attribute(tag, 'value'))).toEqual([
      'dark',
      'light',
      'high-contrast',
    ]);
    expect(themes.every((tag) => attribute(tag, 'type') === 'radio')).toBe(true);
    for (const label of ['Escuro', 'Claro', 'Alto contraste']) {
      expect(markup).toContain(label);
    }
    expect(checked(markup, 'theme')).toEqual(['dark']);
    expect(checked(render({ theme: 'light' }), 'theme')).toEqual(['light']);
    expect(checked(render({ theme: 'high-contrast' }), 'theme')).toEqual(['high-contrast']);
  });

  it('sem escolha guardada, marca o tema que o sistema escolheu', () => {
    const markup = render({
      preferences: { ...DEFAULT_PREFERENCES, theme: null },
      theme: 'light',
    });
    expect(checked(markup, 'theme')).toEqual(['light']);
  });

  it('três níveis de notificação, com o escolhido marcado e o limite por hora explicado', () => {
    const markup = render();
    const levels = inputs(markup, 'notifications');
    expect(levels.map((tag) => attribute(tag, 'value'))).toEqual(['silent', 'essential', 'all']);
    expect(levels.every((tag) => attribute(tag, 'type') === 'radio')).toBe(true);
    for (const label of ['Silencioso', 'Essenciais', 'Todos']) {
      expect(markup).toContain(label);
    }
    // O padrão do GDD §13.5 é "Essenciais".
    expect(checked(markup, 'notifications')).toEqual(['essential']);
    expect(
      checked(
        render({ preferences: { ...DEFAULT_PREFERENCES, notifications: 'silent' } }),
        'notifications',
      ),
    ).toEqual(['silent']);
    expect(markup).toContain('No máximo três avisos por hora');
  });

  it('notificações do navegador: opção desligada por padrão e a permissão só ao ligar', () => {
    const markup = render();
    const [checkbox] = inputs(markup, 'browserNotifications');
    expect(attribute(checkbox ?? '', 'type')).toBe('checkbox');
    expect(hasAttribute(checkbox ?? '', 'checked')).toBe(false);
    expect(hasAttribute(checkbox ?? '', 'disabled')).toBe(false);
    expect(markup).toContain('O navegador pede a sua permissão ao ligar.');
    const enabled = render({
      preferences: { ...DEFAULT_PREFERENCES, browserNotifications: true },
    });
    expect(hasAttribute(inputs(enabled, 'browserNotifications')[0] ?? '', 'checked')).toBe(true);
  });

  it('navegador sem notificações: a opção fica desabilitada, com a explicação', () => {
    const markup = render({ browserNotificationsSupported: false });
    const [checkbox] = inputs(markup, 'browserNotifications');
    expect(hasAttribute(checkbox ?? '', 'disabled')).toBe(true);
    expect(markup).toContain('Este navegador não tem notificações.');
    expect(markup).not.toContain('pede a sua permissão');
  });

  it('modo discreto como caixa de seleção, refletindo a preferência', () => {
    const off = inputs(render(), 'discreetMode')[0] ?? '';
    expect(attribute(off, 'type')).toBe('checkbox');
    expect(hasAttribute(off, 'checked')).toBe(false);
    const on = render({ preferences: { ...DEFAULT_PREFERENCES, discreetMode: true } });
    expect(hasAttribute(inputs(on, 'discreetMode')[0] ?? '', 'checked')).toBe(true);
    expect(on).toContain('Modo discreto');
  });

  it('Hora da Vigília: 24 opções, com a guardada selecionada', () => {
    const options = (markup: string) => tags(markup, /<option[^>]*>/g);
    const selected = (markup: string) =>
      options(markup)
        .filter((tag) => hasAttribute(tag, 'selected'))
        .map((tag) => attribute(tag, 'value'));
    const markup = render();
    expect(markup).toMatch(/<select[^>]*name="vigilHour"/);
    expect(options(markup).map((tag) => attribute(tag, 'value'))).toEqual(
      Array.from({ length: 24 }, (_, hour) => String(hour)),
    );
    expect(markup).toContain('>00:00</option>');
    expect(markup).toContain('>23:00</option>');
    expect(selected(markup)).toEqual(['20']);
    expect(selected(render({ preferences: { ...DEFAULT_PREFERENCES, vigilHour: 6 } }))).toEqual([
      '6',
    ]);
    expect(selected(render({ preferences: { ...DEFAULT_PREFERENCES, vigilHour: 0 } }))).toEqual([
      '0',
    ]);
  });

  it('todo campo tem rótulo: nenhum input ou select fica fora de um <label>', () => {
    const markup = render();
    const labelled = tags(markup, /<label>.*?<\/label>/g).join('');
    const fields = tags(markup, /<(input|select)[^>]*>/g);
    expect(fields.length).toBe(3 + 3 + 1 + 1 + 1);
    for (const field of fields) {
      expect(labelled).toContain(field);
    }
  });
});

describe('aba Sobre', () => {
  const version: VersionResponse = {
    server: '0.1.7',
    protocol: 1,
    contentHash: '0123456789abcdef',
    builtAt: '2026-10-01T12:00:00.000Z',
    features: { githubDevice: true },
  };
  const render = (server: Loadable<VersionResponse>) =>
    html(<AboutTab server={server} actions={actions} />);
  const states: Loadable<VersionResponse>[] = [
    { status: 'idle' },
    { status: 'loading' },
    { status: 'ready', value: version },
    { status: 'error', message: 'Sem ligação com o reino.' },
  ];

  it('mostra sempre a versão do app', () => {
    for (const state of states) {
      const markup = render(state);
      expect(markup).toContain('Lords of the Guild');
      expect(markup).toMatch(new RegExp(`<dt>App</dt><dd>${APP_VERSION.replace(/\./g, '\\.')}\\b`));
    }
  });

  it('com a resposta do servidor: versão, protocolo e hash do conteúdo', () => {
    const markup = render({ status: 'ready', value: { ...version, protocol: 7 } });
    expect(markup).toMatch(/<dt>Servidor<\/dt><dd>0\.1\.7 /);
    expect(markup).toContain('(protocolo 7)');
    expect(markup).toMatch(/<dt>Conteúdo<\/dt><dd[^>]*>0123456789abcdef<\/dd>/);
    expect(markup).toMatch(/<dt>Vínculo GitHub<\/dt><dd>ligado<\/dd>/);
    expect(markup).not.toContain('consultando');
  });

  it('diz quando o servidor não tem o vínculo com o GitHub', () => {
    const markup = render({
      status: 'ready',
      value: { ...version, features: { githubDevice: false } },
    });
    expect(markup).toMatch(/<dt>Vínculo GitHub<\/dt><dd>desligado neste servidor<\/dd>/);
  });

  it('enquanto consulta o servidor, diz "consultando…" sem inventar versão', () => {
    for (const state of [{ status: 'idle' }, { status: 'loading' }] as const) {
      const markup = render(state);
      expect(markup).toMatch(/<span[^>]*role="status"[^>]*>consultando…<\/span>/);
      expect(markup).not.toContain('Conteúdo');
      expect(markup).not.toContain('0123456789abcdef');
    }
  });

  it('se o servidor não respondeu, mostra o motivo', () => {
    const markup = render({ status: 'error', message: 'Sem ligação com o reino.' });
    expect(markup).toMatch(
      /<span[^>]*role="status"[^>]*>indisponível: Sem ligação com o reino\.<\/span>/,
    );
    expect(markup).not.toContain('consultando');
    expect(markup).not.toContain('Conteúdo');
  });

  it('leva à Privacidade e dá o crédito dos ícones', () => {
    const markup = render({ status: 'ready', value: version });
    expect(markup).toMatch(/<button[^>]*>Privacidade<\/button>/);
    expect(markup).toContain('Codicons');
  });

  it('não usa o nome do Visual Studio Code em nenhum estado', () => {
    for (const state of states) {
      const markup = render(state);
      expect(markup).not.toMatch(/Visual Studio Code/i);
      expect(markup).not.toMatch(/VS ?Code/i);
    }
  });
});

describe('ações das abas', () => {
  /** Percorre a árvore de componentes e clica em todos os botões, anotando o que foi pedido. */
  it('os botões da Crônica e do Sobre pedem comandos do app pelo id', () => {
    const ran: string[] = [];
    const recording: Actions = { ...actions, run: (id) => ran.push(id) };
    type VNodeLike = { type?: unknown; props?: Record<string, unknown> };
    const click = (node: unknown): void => {
      if (Array.isArray(node)) {
        node.forEach(click);
        return;
      }
      if (typeof node !== 'object' || node === null) {
        return;
      }
      const { type, props } = node as VNodeLike;
      if (type === 'button' && typeof props?.onClick === 'function') {
        (props.onClick as () => void)();
      }
      click(props?.children);
    };
    click(ChronicleTab({ document: { status: 'ready', value: '# Crônica' }, actions: recording }));
    click(ChronicleTab({ document: { status: 'error', message: 'falhou' }, actions: recording }));
    click(AboutTab({ server: { status: 'idle' }, actions: recording }));
    expect(ran).toEqual(['lords.downloadChronicle', 'lords.openChronicle', 'lords.privacy']);
  });
});
